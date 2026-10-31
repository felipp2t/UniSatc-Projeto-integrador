# API — Conta, convites e pastas

Referência detalhada de cada endpoint implementado no backend Java. Para instruções de setup e
bootstrap do banco, veja [`../README.md`](../README.md).

Os IDs seguem a [especificação de requisitos](../../docs/REQUISITOS.md). Esta página descreve os endpoints implementados. A gestão de grupos de acesso está disponível e cada sessão é vinculada ao vínculo atual do membro no workspace; tokens antigos não são reativados por readmissão. Compartilhamento/herança de pastas com grupos (#132/#133) e rotas de remoção de usuários continuam fora deste contrato.

Convenções gerais:
- Todas as respostas de erro seguem o mesmo formato JSON (`GlobalExceptionHandler`):
  ```json
  { "timestamp": "...", "status": 401, "error": "Unauthorized", "message": "...", "path": "/..." }
  ```
- Rotas autenticadas exigem o cookie `accessToken` válido (RNF01). Sem ele, ou com token
  inválido/expirado, o filtro JWT simplesmente não autentica a requisição e o Spring Security
  responde `401 Unauthorized` antes de chegar no controller.
- Os cookies `accessToken` e `refreshToken` são sempre `httpOnly` + `secure` + `sameSite=Strict`
  + `path=/` (RNF01) — nunca aparecem no corpo da resposta.
- Senhas nunca são retornadas em nenhuma resposta.
- `POST /auth/login`, `POST /auth/register`, `POST /auth/forgot-password`,
  `POST /auth/reset-password` e `POST /invites/validate` (sujeitos a brute-force/spam) têm
  rate limit de 5 requisições por minuto por IP e caminho, via `RateLimitFilter` (janela fixa
  em memória) — cada caminho tem contador próprio e passar do limite responde
  `429 Too Many Requests`. O registro remove IPs inativos e tem limite rígido de 10.000 entradas;
  ao atingir esse limite, novos IPs recebem `429` até haver espaço, sem reiniciar limites ativos.
- Convites e recuperações usam uma outbox transacional: token e e-mail são gravados juntos, mas o
  SMTP é chamado por um worker após o commit. Falhas de envio são tentadas novamente até 5 vezes;
  por isso, a resposta HTTP confirma que o e-mail foi enfileirado, não que já foi entregue.
- Não existe cadastro público: uma conta só nasce quando o dono do workspace envia um convite
  (RF10) e o convidado conclui o cadastro com o token recebido por e-mail (RF01/RF11), entrando no
  workspace único da empresa com o papel `Member` (acesso inicial, sem RBAC granular ainda).
- Cada sessão está vinculada a um `workspace_member.id`: o JWT de acesso contém `membershipId` e
  o refresh token persistido referencia o mesmo vínculo. Em cada requisição autenticada,
  `JwtAuthenticationFilter` confirma no banco que o vínculo ainda existe para o usuário do JWT e
  usa o papel atual do vínculo como authority. O access token legado sem `membershipId` não
  autentica e recebe `401`; o papel do banco é atualizado efetivamente por requisição, sem esperar
  o limite de validade de até 15 minutos do JWT.
- Excluir um vínculo invalida imediatamente os access tokens associados e a FK com `ON DELETE
  CASCADE` remove seus refresh tokens. Uma readmissão cria outro vínculo e não recupera a sessão
  anterior. A migration V20 associa refresh tokens existentes ao vínculo atual do usuário e
  descarta os que não têm vínculo. Portanto, um refresh migrado ainda válido de um membro atual
  pode emitir novo par de tokens; login sem vínculo não emite sessão.
- Isso documenta somente o comportamento implementado nesta branch. Grupos, concessões, herança e
  validação granular completa de conteúdo não existem aqui e pertencem às issues #132/#133; não se
  afirma atendimento integral ao RNF04.

---

## RF10 — Convite de novo usuário

**`POST /invites`** — autenticado (cookie `accessToken`), **somente o dono do workspace**.

Envia um convite por e-mail (JavaMail) para um endereço ainda não cadastrado, contendo um link
para a tela de cadastro do frontend com `email` e `token` na query string.

O que a função faz, em ordem:
1. Confere que quem está chamando é o dono do workspace único (senão `403`).
2. Confere que não existe usuário com esse `email` (senão `409`).
3. Apaga qualquer convite anterior pendente para o mesmo `email` (reenviar substitui o convite
   antigo).
4. Cria um `UserInvite` com um token opaco (`UUID.randomUUID()`), associado a quem convidou
   (`invited_by_user_id`) e com validade de 7 dias (`invite.expiration-ms`).
5. Grava na outbox o e-mail com o link `${FRONTEND_URL}/cadastro?email=...&token=...`; o worker
   envia após o commit e aplica retentativas em falhas temporárias.

| | |
|---|---|
| Auth | Cookie `accessToken`, apenas o dono do workspace |
| Request body | `{ "email": string }` |
| Sucesso | `201`, corpo vazio |
| `400` | e-mail inválido/ausente |
| `401` | não autenticado |
| `403` | autenticado, mas não é o dono do workspace |
| `409` | já existe uma conta com esse e-mail |

**`GET /invites`** — autenticado (cookie `accessToken`), **somente o dono do workspace**.

Lista convites pendentes e utilizáveis. A resposta é uma lista, inclusive vazia, com os campos
`id`, `email`, `invitedByUserId`, `invitedByName`, `createdAt` e `expiresAt`. A consulta inclui
somente convites cuja validade ainda não terminou e cujo e-mail ainda não pertence a uma conta.
Os itens são ordenados por `createdAt` decrescente e, em caso de empate, por `id` decrescente.

| | |
|---|---|
| Auth | Cookie `accessToken`, apenas o dono do workspace |
| Sucesso | `200`, lista de convites (pode ser vazia) |
| `401` | não autenticado |
| `403` | autenticado, mas não é o dono do workspace |

**`POST /invites/validate`** — público, sem autenticação.

Valida o par `email` + `token` antes da tela de cadastro. O corpo contém ambos os campos; eles não são enviados na query string. Para um convite pendente e válido, responde `200` com o e-mail canônico do convite e `remainingSeconds`, calculado pelo servidor. A resposta usa `Cache-Control: no-store`.

Convites inexistentes, expirados, recusados, revogados, substituídos ou já utilizados retornam a mesma resposta genérica `404` (“Convite indisponível”), sem revelar o motivo. A validação é apenas informativa: `POST /auth/register` volta a validar o convite dentro da transação que cria conta e vínculo.

O endpoint usa o limite existente de cinco requisições por minuto por IP e caminho, com contador separado de `/auth/register`.

**`POST /invites/decline`** — público, sem autenticação.

Recebe o mesmo corpo `{ "email": string, "token": string }` da validação. Recusa somente um
convite pendente e válido, marcando `user_invite.status` como `DECLINED`; convites inexistentes,
expirados, já usados ou já recusados respondem `404` com a mensagem genérica “Convite indisponível”.
O cadastro também consulta somente convites pendentes, então um convite recusado não pode ser aceito.
O endpoint retorna `204`, usa `Cache-Control: no-store` e tem limite de cinco requisições por minuto
por IP e caminho.

**`POST /invites/{id}/revoke`** — autenticado (cookie `accessToken`), somente o dono atual do
workspace.

Revoga um convite pendente pelo seu `id` (UUID), marcando-o como `REVOKED`. Um convite revogado
deixa de ser aceito por `POST /invites/validate` e `POST /auth/register`. A operação não altera
contas existentes nem vínculos de membros já criados. Convites que não existem ou não estão mais
pendentes respondem `404` com a mensagem genérica “Convite indisponível”.

| | |
|---|---|
| Auth | Cookie `accessToken`, apenas o dono atual do workspace |
| Sucesso | `204`, corpo vazio |
| `401` | não autenticado |
| `403` | autenticado, mas não é o dono do workspace |
| `404` | convite inexistente ou indisponível (não pendente) |

---

## RF01/RF11 — Cadastro via convite

**`POST /auth/register`** — sem autenticação.

Completa o cadastro de quem recebeu um convite, usando o `email` + `token` que vieram do link do
e-mail (RF10).

O que a função faz, em ordem:
1. Valida que `password == confirmPassword` (senão `400`).
2. Busca o convite (`user_invite`) por `email` + `token` (senão `404`).
3. Confere se `expires_at` ainda não passou; se expirou, responde `409` sem alterar o registro.
   A manutenção agendada remove convites expirados fora da transação da requisição.
4. Confere que ainda não existe usuário com esse `email` (senão `409`).
5. Cria o `User` com `name`, `email` e `password_hash` (Argon2) a partir da senha enviada.
6. Vincula o novo usuário ao workspace único com o papel `Member` (acesso inicial, ainda sem
   RBAC granular) — na mesma transação da criação da conta.
7. Apaga o convite (uso único).
8. Gera um access token (JWT) e um refresh token (persistido em `refresh_token`), devolvidos como
   cookies — o usuário já entra logado, sem precisar chamar `/auth/login` em seguida.

| | |
|---|---|
| Request body | `{ "email": string, "token": string, "name": string (min 3), "password": string (min 8), "confirmPassword": string (min 8) }` |
| Sucesso | `200`, corpo vazio, seta `accessToken` + `refreshToken` |
| `400` | senhas não conferem, ou corpo inválido |
| `404` | nenhum convite com esse `email`/`token` |
| `409` | convite expirado, ou e-mail já cadastrado |
| `429` | mais de 5 tentativas por IP em 1 minuto (rate limit) |

---

## RF02 — Login

**`POST /auth/login`** — sem autenticação.

Autentica um usuário existente por e-mail e senha.

O que a função faz:
1. Busca o usuário por `email` (senão `401` — mesma mensagem genérica de credenciais erradas,
   para não revelar se o e-mail existe).
2. Compara a senha enviada com o `password_hash` armazenado via Argon2 (`401` se não bater).
3. Gera um novo access token (JWT, `sub` = id do usuário) e um novo refresh token (persistido no
   banco), devolvidos como cookies.

| | |
|---|---|
| Request body | `{ "email": string, "password": string }` |
| Sucesso | `200`, corpo vazio, seta `accessToken` + `refreshToken` |
| `401` | e-mail não encontrado ou senha incorreta; ambas as falhas retornam `E-mail ou senha inválidos` |
| `429` | mais de 5 tentativas por IP em 1 minuto (rate limit) |

---

## RF03 — Renovação de sessão (refresh)

**`POST /auth/refresh`** — autenticação via cookie `refreshToken` (não via `accessToken`).

Troca um refresh token válido por um novo par de tokens, permitindo que a sessão continue sem
pedir login de novo — usado quando o `accessToken` (curta duração) expira.

O que a função faz:
1. Lê o cookie `refreshToken` da requisição (`401` se ausente).
2. Busca esse token na tabela `refresh_token` (`401` se não existir).
3. Confere se ele expirou (`401` se sim, sem tentar apagar dentro da transação que será revertida).
4. Se estiver válido, deleta o token encontrado (uso único — todo refresh invalida o anterior).
5. Confirma que o vínculo de workspace associado ao refresh token ainda existe para o usuário.
   Se existir, emite um novo access token com `membershipId` e um novo refresh token ligado ao
   vínculo atual (rotação), devolvidos como cookies. Isso também permite migrar um refresh token
   pré-V20 que a migration associou ao vínculo atual. Vínculo removido ou inexistente resulta em
   `401`; tokens expirados são removidos pela manutenção agendada.

| | |
|---|---|
| Auth | Cookie `refreshToken` |
| Sucesso | `200`, corpo vazio, roda os cookies (novo `accessToken` + novo `refreshToken`) |
| `401` | cookie ausente, token inexistente ou expirado |

---

## RF04 — Logout

**`POST /auth/logout`** — autenticação via cookie `refreshToken`.

Encerra a sessão atual invalidando o refresh token no servidor (o `accessToken` em si não pode
ser revogado por ser stateless, mas expira em minutos).

O que a função faz:
1. Lê o cookie `refreshToken` (`401` se ausente).
2. Busca e deleta esse token do banco (`401` se não existir).
3. Limpa (`Max-Age=0`) os cookies `accessToken` e `refreshToken` no cliente.

| | |
|---|---|
| Auth | Cookie `refreshToken` |
| Sucesso | `204`, corpo vazio, limpa os cookies |
| `401` | cookie ausente ou token inexistente |

---

## RF49 — Esqueci minha senha

**`POST /auth/forgot-password`** — sem autenticação.

Dispara um e-mail (JavaMail) com um link de redefinição de senha, se o e-mail informado tiver
conta.

O que a função faz:
1. Busca o usuário por `email`. Se não existir, não faz nada — mas a resposta é idêntica à do
   caso de sucesso, para não revelar se o e-mail está cadastrado.
2. Se existir, apaga tokens de redefinição anteriores desse usuário, cria um novo
   `PasswordResetToken` (validade de 1h, `password-reset.expiration-ms`) e grava na outbox o e-mail
   com o link `${FRONTEND_URL}/redefinir-senha?token=...`. O worker envia após o commit.

| | |
|---|---|
| Request body | `{ "email": string }` |
| Sucesso | `204` sempre, exista ou não o e-mail |
| `429` | mais de 5 tentativas por IP em 1 minuto (rate limit) |

---

## RF49 — Redefinição de senha

**`POST /auth/reset-password`** — sem autenticação (o token do e-mail já autoriza a operação).

Define uma nova senha a partir do token recebido por e-mail (RF49).

O que a função faz:
1. Valida que `newPassword == confirmPassword` (senão `400`).
2. Busca o `PasswordResetToken` (senão `401`).
3. Confere se ele expirou (`401` se sim, sem alterar o registro); a manutenção agendada remove
   tokens expirados.
4. Grava o novo `password_hash` (Argon2) no usuário associado ao token.
5. **Deleta todos os refresh tokens e todos os tokens de redefinição do usuário** — o link se
   torna de uso único e qualquer outra sessão/dispositivo precisa autenticar de novo.

| | |
|---|---|
| Request body | `{ "token": string, "newPassword": string (min 8), "confirmPassword": string (min 8) }` |
| Sucesso | `204` |
| `400` | senhas não conferem, ou corpo inválido |
| `401` | token inexistente ou expirado |
| `429` | mais de 5 tentativas por IP em 1 minuto (rate limit) |

---

## RF05 — Troca de senha

**`PATCH /me/password`** — autenticado (cookie `accessToken`).

Permite ao usuário logado trocar a própria senha, exigindo a senha atual como confirmação.

O que a função faz:
1. Valida que `newPassword == confirmPassword` (senão `400`).
2. Busca o usuário autenticado (`userId` vem do `accessToken`).
3. Compara `currentPassword` com o `password_hash` atual via Argon2 (`400` se não bater).
4. Grava o novo `password_hash` (Argon2).
5. **Deleta todos os refresh tokens e tokens de redefinição pendentes do usuário** — qualquer
   outra sessão/dispositivo precisa autenticar de novo e links antigos deixam de funcionar. A
   sessão atual continua valendo até o `accessToken` expirar naturalmente (é stateless, não dá
   para revogar na hora).

| | |
|---|---|
| Auth | Cookie `accessToken` |
| Request body | `{ "currentPassword": string, "newPassword": string (min 8), "confirmPassword": string (min 8) }` |
| Sucesso | `204` |
| `400` | senha atual incorreta, `newPassword` != `confirmPassword`, ou corpo inválido |
| `401` | não autenticado |

---

## RF06 — Atualização do perfil

**`PATCH /me`** — autenticado (cookie `accessToken`).

Atualiza os dados do próprio perfil. Hoje só existe `name` como campo editável — `email` é o
identificador de login (imutável por aqui) e senha tem endpoint próprio (RF05).

O que a função faz:
1. Busca o usuário autenticado.
2. Substitui `name` pelo valor enviado (com `trim()`).

| | |
|---|---|
| Auth | Cookie `accessToken` |
| Request body | `{ "name": string (3 a 255 caracteres após `trim`) }` |
| Sucesso | `204` |
| `400` | nome vazio ou menor que 3 caracteres |
| `401` | não autenticado |

---

## RF07 — Consulta do perfil autenticado

**`GET /me`** — autenticado (cookie `accessToken`).

Retorna os dados públicos do usuário logado (usado, por exemplo, para popular a tela de perfil no
front-end assim que a sessão carrega).

O que a função faz:
1. Busca o usuário autenticado pelo `userId` do token.
2. Devolve `id`, `name` e `email` (nunca a senha).

| | |
|---|---|
| Auth | Cookie `accessToken` |
| Sucesso | `200`, `{ "id": string, "name": string, "email": string }` |
| `401` | não autenticado |

---

## RF15 — Listagem de membros

**`GET /workspaces/{workspaceId}/members`** — autenticado (cookie `accessToken`), com vínculo ao workspace.

Retorna `id`, `userId`, `name`, `roleId` e `roleName` dos membros do workspace. O campo `email`
é incluído apenas quando o solicitante tem atualmente o papel `Owner`, conforme o estado persistido
no banco. Para os demais membros, a propriedade `email` é omitida da resposta, inclusive para o
próprio solicitante; a visibilidade não é decidida pela claim `role` do JWT.

| | |
|---|---|
| Sucesso | `200`, lista de membros |
| `401` | não autenticado |
| `404` | workspace inexistente ou solicitante sem vínculo |

O refinamento de permissões para conteúdo, grupos e herança de pastas é tratado nas dependências
#130 e #132; esta rota descreve apenas a listagem e a visibilidade dos dados de membro.

---

## RF17 — Atribuição de papel a um membro

**`PUT /workspaces/{workspaceId}/members/{memberId}/role`** — autenticado, somente donos.

Body: `{ "roleId": "uuid" }`. Retorna o membro atualizado, com `email`.

Dono é qualquer membro com o papel `Owner`; o workspace pode ter vários. Como só donos atribuem
papéis, somente um dono existente concede o papel `Owner`. A troca que deixaria o workspace sem
nenhum dono é rejeitada; os donos são travados durante a operação para que trocas simultâneas não
contornem a regra. Atribuir o papel que o membro já tem não altera nada.

A mudança é registrada como `member_role_changed` (com `previousRoleId` e `roleId`) e o membro
recebe a notificação genérica de acesso atualizado. O filtro JWT lê o papel atual do banco a cada
requisição, então a mudança vale antes do limite de 15 minutos do token.

| | |
|---|---|
| Sucesso | `200`, membro atualizado |
| `400` | `roleId` ausente |
| `401` | não autenticado |
| `403` | solicitante não é dono |
| `404` | workspace, membro ou papel inexistente |
| `409` | rebaixaria o último dono |

---

## RF18, RF19, RF20 e RF22 — Papéis

Todas as rotas exigem autenticação e o papel `Owner`; outros membros recebem `403` e quem não é
membro do workspace recebe `404`.

Os papéis `Owner` e `Member` são protegidos (`builtIn: true`) e não podem ser excluídos. Nomes têm
de 1 a 50 caracteres, sem espaços nas extremidades, e são únicos no workspace ignorando maiúsculas
e acentos (migration V21, mesma normalização de pastas, itens e grupos).

### Listar papéis

**`GET /workspaces/{workspaceId}/roles`**

Retorna `[{ "id", "name", "builtIn", "memberCount" }]`, ordenado por nome.

### Criar papel

**`POST /workspaces/{workspaceId}/roles`** — body `{ "name": "Financeiro" }`.

O papel nasce sem permissões. Responde `201` com o papel criado, `400` para nome inválido e `409`
para nome equivalente a um existente. Registra `role_created`.

### Consultar permissões de um papel

**`GET /workspaces/{workspaceId}/roles/{roleId}/permissions`**

Retorna `[{ "resource", "action" }]`. A ação `all` é expandida nas ações individuais; o papel
`Owner` retorna o catálogo completo. Papel de outro workspace ou inexistente responde `404`.

### Excluir papel

**`DELETE /workspaces/{workspaceId}/roles/{roleId}`**

Responde `204` e remove também as permissões do papel. Registra `role_deleted`. Responde `409` para
os papéis protegidos ou para papel atribuído a algum membro; troque o papel dos membros antes.

---

## RF23, RF26 e RF27 — Pastas e navegação

As rotas exigem autenticação pelo cookie `accessToken` e vínculo ao workspace. O papel `Member`
recebe acesso somente de leitura nesta etapa; a criação é permitida apenas ao proprietário.

### Criar pasta

**`POST /workspaces/{workspaceId}/collections`** — somente o proprietário.

Request:
```json
{ "name": "Engenharia", "parentId": null }
```

`parentId` pode ser omitido ou `null` para criar na raiz. Para subpastas, deve apontar para uma
pasta do mesmo workspace. O nome é removido de espaços nas extremidades, não pode ficar vazio e
aceita até 255 caracteres. Uma pasta com o mesmo nome no mesmo nível responde `409`; o nome pode
se repetir em outros níveis.

Sucesso (`201`):
```json
{ "id": "uuid", "name": "Engenharia", "parentId": null }
```

### Listar pastas

**`GET /workspaces/{workspaceId}/collections?parentId={uuid}&page=0&size=20`** — qualquer membro.

Sem `parentId`, lista as pastas da raiz. Com `parentId`, lista somente filhas diretas da pasta.
`page` começa em zero (padrão `0`); `size` deve estar entre 1 e 100 (padrão `20`). A ordenação
é por nome e, em caso de empate, por ID. Uma página além do fim retorna `items` vazio.

Sucesso (`200`):
```json
{
  "items": [{ "id": "uuid", "name": "Engenharia", "parentId": null }],
  "page": 0,
  "size": 20,
  "totalItems": 1,
  "totalPages": 1
}
```

O deslocamento (`page × size`) não pode exceder `2147483647`, limite da paginação JPA.
Parâmetros de paginação inválidos respondem `400`. Se a pasta pai não existir no workspace,
responde `404`.

### Consultar caminho para breadcrumb

**`GET /workspaces/{workspaceId}/collections/{collectionId}/path`** — qualquer membro.

Sucesso (`200`): lista de `{ "id", "name" }` ordenada da raiz até a pasta consultada. A raiz é
representada pelo workspace, então não aparece como item nessa lista. Pasta inexistente ou fora
do workspace responde `404`.

| | |
|---|---|
| `400` | nome ausente, vazio ou maior que 255 caracteres |
| `401` | não autenticado |
| `403` | membro sem permissão para criar (nesta etapa, não é o proprietário) |
| `404` | workspace sem vínculo, pasta pai ausente ou pasta fora do workspace |
| `409` | nome já utilizado no mesmo nível |

## RF30 — Anexos de documentos e imagens

O arquivo é enviado ao storage compatível com S3; o banco guarda somente sua chave opaca e
metadados. Cada item `file` ou `image` possui exatamente um anexo. A primeira entrega aceita PDF,
TXT, Markdown, DOCX, XLSX, PPTX, PNG e JPEG (`.jpg`/`.jpeg`), com até **20.000.000 bytes** por
arquivo. Vídeos não são aceitos.

**`POST /workspaces/{workspaceId}/items/attachments`** — autenticado; exige `item/create`.

Recebe `multipart/form-data` com `title`, `file`, `description` opcional (até 2.000 caracteres) e
`collectionId` opcional. Cria um novo item do tipo `file` ou `image` e seu único anexo. A pasta,
quando informada, precisa pertencer ao mesmo workspace. Títulos seguem a unicidade normalizada de
itens.

**`PUT /workspaces/{workspaceId}/items/{itemId}/attachment`** — autenticado; exige `item/update`.

Substitui o anexo por um arquivo novo. O sistema mantém o arquivo anterior se o envio ou a gravação
falhar. Após a confirmação, o arquivo anterior é removido; não há histórico de versões recuperáveis.
Itens arquivados não podem ser alterados até serem restaurados.

**`PUT /workspaces/{workspaceId}/items/{itemId}/metadata`** — autenticado; exige `item/update`.

Atualiza `{ "title": string, "description": string | null }` sem alterar o conteúdo do anexo nem
a pasta. `title` é obrigatório (1–255 caracteres); `description` é opcional (até 2.000 caracteres).
Conflito de título retorna `409`.

**`PUT /workspaces/{workspaceId}/items/{itemId}`** — autenticado; exige `item/update`.

Atualiza título e conteúdo de itens `text`, `link` ou `secret`, preservando tipo e pasta. O corpo
contém `title` e exatamente um campo de conteúdo conforme o tipo (`textContent`, `linkUrl` ou
`value`). Texto aceita até 100.000 caracteres e não pode ser vazio ou conter apenas espaços; URLs
HTTP/HTTPS aceitam até 2.048 caracteres; segredos aceitam até 8.192 caracteres e são armazenados
cifrados. Itens arquivados não podem ser alterados. Conflito de título retorna `409`; sucesso
retorna o item atualizado e registra `ITEM_UPDATED` sem incluir o valor do segredo.

**`GET /workspaces/{workspaceId}/items/{itemId}/attachment`** — autenticado; exige `item/read`.

Entrega o arquivo com seu MIME type e nome original. PDF e imagens usam `inline` por padrão quando
o navegador oferece suporte; `?download=true` força `attachment`. O download não expõe a chave nem
uma URL pública do storage e usa `Cache-Control: no-store`. Itens arquivados permanecem consultáveis
conforme as permissões atuais.

As operações de criação, substituição e edição de metadados são registradas no histórico de
atividades sem incluir bytes nem chave do storage.

Se `app.storage.s3.bucket` não estiver configurado, a aplicação inicia sem storage e as rotas de
upload, substituição e download retornam `503 Service Unavailable`.

## Exclusão definitiva de itens arquivados (issue #38)

**`DELETE /workspaces/{workspaceId}/items/{itemId}?confirm=true`** — autenticado; exige vínculo
ao workspace e a permissão `item:delete`.

`confirm` é opcional e tem padrão `false`; sem `confirm=true`, a operação responde `400` e não
exclui o item. Apenas itens previamente arquivados podem ser excluídos definitivamente; um item
ativo responde `409`. Item inexistente ou pertencente a outro workspace responde `404`.

Para excluir um item do tipo `secret`, o usuário também precisa de `secret:read` e `secret:delete`.
Sem `secret:read`, o segredo é tratado como indisponível e responde `404`; sem `secret:delete`,
responde `403`. O vínculo e as permissões são avaliados pela autorização existente do workspace.

Sucesso retorna `204` sem corpo. A exclusão no banco remove em cascata os dados associados,
incluindo segredo, arquivo e mídia, e libera o título para reutilização. O histórico registra
`item_deleted` (`resourceType: item`) com um snapshot de `type` e `title`.

Para itens `file` e `image`, a resposta `204` confirma a exclusão no banco; a remoção do objeto no
storage é tentada em `afterCommit`. Falhas são registradas em log, não desfazem a exclusão
confirmada e não têm retentativa durável.

## RF31 — Arquivar item

**`POST /workspaces/{workspaceId}/items/{itemId}/archive`** — autenticado; exige `item/update`.
Para itens do tipo `secret`, também exige `secret/update` e o usuário precisa ter `secret/read`;
sem `secret/read`, o item retorna `404` para manter sua existência oculta. A operação marca o
item como arquivado sem remover seus dados. Itens arquivados deixam de aparecer nas listagens e
buscas padrão; continuam acessíveis por consulta, revelação de segredo e download de anexo conforme
as permissões atuais. O título permanece reservado na mesma localização.

Sucesso retorna `204`. Repetir a operação em item já arquivado retorna `409`. Item ausente, fora
do workspace ou oculto por falta de `secret/read` retorna `404`; ausência de permissão retorna
`403`. O histórico registra `item_archived` com tipo e título, sem incluir conteúdo de texto,
URL, valor do segredo nem dados do anexo. Arquivar/restaurar usa `item/update` (e também
`secret/update` para segredos); `item/delete` fica reservado à exclusão permanente.

## RF32 — Restaurar item arquivado

**`POST /workspaces/{workspaceId}/items/{itemId}/restore`** — autenticado; exige `item/update`.
Para itens do tipo `secret`, também exige `secret/update` e o usuário precisa ter `secret/read`;
sem `secret/read`, o item retorna `404` para manter sua existência oculta. A restauração remove
somente a marca de arquivamento, preservando o conteúdo e o anexo. Ela não recria acessos que
tenham sido removidos.

Sucesso retorna `204`. Item ativo retorna `409`. Item ausente, fora do workspace ou oculto por falta
de `secret/read` retorna `404`; ausência de permissão retorna `403`. A restauração é registrada no
histórico como `item_restored`, com tipo e título, sem incluir conteúdo de texto, URL, valor do
segredo nem dados do anexo.

## Gestão de grupos de acesso

Todas as rotas abaixo exigem autenticação pelo cookie `accessToken`, vínculo atual ao workspace e
a permissão global `group/manage`. Essa permissão administra grupos e integrantes; ela não concede
leitura nem acesso a conteúdo. A permissão pode ser atribuída pelo modelo `role_permission`, mas a
API de administração de papéis ainda não está disponível.

**`GET /workspaces/{workspaceId}/groups`** lista os grupos do workspace, ordenados por nome e ID.
Responde `200` com uma lista de `{ "id": "uuid", "name": "Equipe" }`, inclusive quando vazia.

**`POST /workspaces/{workspaceId}/groups`** cria um grupo e responde `201` com `{ "id": "uuid",
"name": "Equipe" }`. O corpo é `{ "name": string }`: o nome é obrigatório, tem de 1 a 50
caracteres e espaços nas pontas são removidos. Nomes que conflitam após normalização de caixa,
acentos e espaços retornam `409` dentro do mesmo workspace.

**`PUT /workspaces/{workspaceId}/groups/{groupId}`** renomeia o grupo usando o mesmo corpo e as
mesmas regras de validação. Responde `200` com o grupo atualizado; conflito de nome retorna `409`.
Renomear não altera seus integrantes. Enviar o nome atual não cria evento de histórico.

**`DELETE /workspaces/{workspaceId}/groups/{groupId}`** exclui um grupo vazio e responde `204`.
Grupo com integrantes retorna `409`; os vínculos precisam ser removidos antes. O backend ainda não
implementa concessões de acesso de conteúdo a grupos nem compartilhamento/herança de pastas (#132),
portanto esta rota não documenta nem promete comportamento sobre concessões futuras.

**`GET /workspaces/{workspaceId}/groups/{groupId}/members`** lista integrantes atuais com os campos
`workspaceMemberId`, `userId`, `name` e `email`. `workspaceMemberId` identifica o vínculo atual ao
workspace usado para adicionar/remover a pessoa; não é o ID do usuário. O grupo só referencia a
membership atual, então uma readmissão posterior não recria automaticamente a associação.

**`PUT /workspaces/{workspaceId}/groups/{groupId}/members/{workspaceMemberId}`** adiciona o vínculo
atual identificado pelo `workspaceMemberId` e responde `204`. A membership precisa pertencer ao
workspace da rota; ID inexistente ou de outro workspace retorna `404`. Repetir a inclusão é
idempotente e não gera outro evento de histórico.

**`DELETE /workspaces/{workspaceId}/groups/{groupId}/members/{workspaceMemberId}`** remove a
associação e responde `204`. Repetir a remoção também responde `204` e não cria outro evento.

Nas rotas de grupo, `401` indica ausência de autenticação, `403` indica falta de vínculo ou da
permissão `group/manage`, e `404` indica workspace/grupo inexistente ou fora do workspace. Corpo
inválido responde `400`; nome duplicado e tentativa de excluir grupo com integrantes respondem
`409`.

Criação, renomeação, exclusão e alterações reais de integrantes são registradas no histórico. Os
eventos de administração de grupo são exclusivos do proprietário do workspace; usuários delegados
com `group/manage` não veem esse histórico. As rotas de grupo ainda não emitem notificações de mudança
de acesso; quando essa integração for feita, deve chamar `NotificationService.accessChanged(Collection<UUID>)`
na transação relevante. A migration V19 de grupos sucede a V18 de notificações.

## Histórico de atividades

**`GET /workspaces/{workspaceId}/activity`** — autenticado pelo cookie `accessToken`; exige
vínculo ao workspace e a permissão `activity/read`.

Aceita `page` (padrão `0`), `size` (padrão `20`, entre `1` e `100`), `from` e `to` (instantes
ISO-8601 inclusivos), `actorId`, `action` e `resourceType`. A ordenação é da atividade mais nova
para a mais antiga, com ID como desempate. O total e as páginas contam apenas eventos visíveis ao
usuário. `action` aceita `folder_created`, `folder_renamed`, `folder_deleted`, `item_created`,
`item_updated`, `item_archived`, `item_restored`, `item_deleted`, `member_invited`, `member_joined`,
`member_role_changed`, `member_removed`, `member_invite_revoked`, `member_invite_declined`,
`workspace_renamed`, `role_created`, `role_deleted`, `role_permissions_changed`, `group_created`,
`group_renamed`, `group_deleted`, `group_member_added` ou `group_member_removed`; `resourceType`
aceita `folder`, `item`, `member`, `workspace`, `role` ou `group`. Os valores são sensíveis a
maiúsculas e minúsculas. Valor desconhecido, intervalo invertido ou paginação inválida responde `400`.

O proprietário vê todo o histórico do workspace. Para os demais usuários, são retornados somente
eventos de itens e pastas ainda existentes no mesmo workspace, respeitando `item/read` ou
`collection/read` atuais; eventos de itens secretos exigem também `secret/read`. Eventos de
membros, workspace, papéis, exclusões e recursos que já não existem são exclusivos do proprietário.
Itens arquivados continuam contando como existentes.

Sucesso (`200`):
```json
{
  "activities": [{
    "id": "uuid",
    "actorId": "uuid",
    "actorName": "Ana",
    "actorContext": "USER",
    "action": "item_created",
    "resourceType": "item",
    "resourceId": "uuid",
    "snapshot": { "type": "text", "title": "Runbook" },
    "createdAt": "2026-10-23T12:00:00Z"
  }],
  "page": 0,
  "size": 20,
  "totalItems": 1,
  "totalPages": 1
}
```

| | |
|---|---|
| `400` | período ou paginação inválida |
| `401` | não autenticado |
| `403` | sem `activity/read` |
| `404` | workspace não encontrado ou sem vínculo |

## Notificações

As notificações são avisos fixos de conta e acesso. A migration `V18` cria a tabela `notification`,
com chave estrangeira para o destinatário (`ON DELETE CASCADE`) e índice por destinatário e data.
`V19` está reservada para outra issue. O campo `metadata` contém o identificador do evento, por
exemplo `{ "event": "PROFILE_UPDATED" }`; os títulos e textos são fixos e não incluem referências,
títulos de recursos, links nem segredos. Notificações não concedem nem verificam acesso a recursos.

**`GET /notifications?page=0&size=20&unread=false`** — autenticado (cookie `accessToken`).

Lista somente as notificações do usuário autenticado, da mais recente para a mais antiga (ID como
desempate). `page` começa em `0` (padrão `0`) e `size` tem padrão `20`. Com `unread=true`, lista
apenas as não lidas (`readAt` nulo). A requisição responde `400`
se `page` for negativo, se `size` estiver fora do intervalo `1`–`100`, ou se `page × size` exceder
`2147483647`, limite do deslocamento da paginação JPA.

`unreadCount` é o total de não lidas do usuário, independente do filtro e da página, para o badge
do centro de notificações. A migration `V22` cria o índice `ix_notification_recipient_read_created`
para a listagem filtrada e a contagem.

Como os avisos são fixos e não carregam títulos, caminhos nem links de recursos, não há referência
antiga a revalidar antes de apresentá-los (RF38-CA03). Se um produtor passar a incluir referências
(#42, #132), elas precisam ser conferidas contra o acesso atual nesta listagem.

Sucesso (`200`):
```json
{
  "notifications": [{
    "id": "uuid",
    "title": "Dados da conta atualizados",
    "content": "Os dados da sua conta foram atualizados.",
    "metadata": { "event": "PROFILE_UPDATED" },
    "readAt": null,
    "createdAt": "2026-10-26T12:00:00Z"
  }],
  "page": 0,
  "size": 20,
  "totalItems": 1,
  "totalPages": 1,
  "unreadCount": 1
}
```

**`PATCH /notifications/{notificationId}/read`** — autenticado (cookie `accessToken`).

Marca como lida uma notificação pertencente ao usuário autenticado. Repetir a chamada é seguro e
preserva o `readAt` original. ID inexistente ou pertencente a outro usuário responde `404`.

| | |
|---|---|
| Sucesso | `204`, corpo vazio |
| `401` | não autenticado |
| `404` | notificação inexistente ou não pertencente ao usuário |

**`PATCH /notifications/read`** — autenticado (cookie `accessToken`).

Marca como lidas todas as notificações não lidas do usuário autenticado e responde `204`. Avisos já
lidos mantêm o `readAt` original e notificações de outros usuários nunca são alteradas. Repetir a
chamada é seguro.

**`GET /notifications/stream`** — autenticado (cookie `accessToken`), `text/event-stream`.

Abre um stream SSE por usuário (RF40/RNF09). SSE foi mantido no lugar do WebSocket previsto no
levantamento porque a entrega é só do servidor para o cliente e o refinamento não exige uma
tecnologia específica. São permitidas até cinco conexões simultâneas por usuário; uma
conexão adicional responde `429`. Cada stream expira junto com a validade do token de acesso
(`jwt.access-token-expiration-ms`, 15 minutos por padrão) e deve ser reaberto pelo cliente; assim
uma sessão expirada ou revogada não continua ouvindo. A cada 25 segundos
(`app.notifications.heartbeat-interval-ms`) o servidor envia o comentário SSE `:keep-alive`, que
não é um evento e evita que proxies encerrem a conexão ociosa. Ao receber uma notificação, o stream envia o evento `notification`, com o ID da
notificação como `id` SSE e como dado JSON (string UUID), por exemplo:

```text
event:notification
id:8e8a9d8f-3c94-4d22-a290-598566ea5b16
data:"8e8a9d8f-3c94-4d22-a290-598566ea5b16"
```

A notificação é persistida antes da emissão, que ocorre somente após o commit da transação. A
entrega em tempo real é best effort: o cliente deve chamar `GET /notifications` ao conectar e ao
reconectar para recuperar avisos persistidos. Falha ou desconexão do stream não desfaz a operação
que originou o aviso.

Trocas de perfil (`PATCH /me`) e senha (`PATCH /me/password`) geram os eventos fixos
`PROFILE_UPDATED` e `PASSWORD_CHANGED`. Produtores futuros de mudanças de acesso podem chamar
`NotificationService.accessChanged(Collection<UUID> affectedRecipients)`, que deduplica os IDs e
emite o aviso fixo `ACCESS_CHANGED`. A troca de papel de um membro (RF17) já usa esse aviso. Grupos,
compartilhamentos, herança e alterações das permissões de um papel ainda não emitem avisos; esse
fan-out pertence às issues #42 e #132.

## Tabela-resumo

| RF | Método | Rota | Auth |
|---|---|---|---|
| RF10 | POST | `/invites` | Cookie `accessToken` |
| RF11 | POST | `/invites/validate` | Não |
| RF12 | POST | `/invites/decline` | Não |
| RF01/RF11 | POST | `/auth/register` | Não |
| RF02 | POST | `/auth/login` | Não |
| RF03 | POST | `/auth/refresh` | Cookie `refreshToken` |
| RF04 | POST | `/auth/logout` | Cookie `refreshToken` |
| RF49 | POST | `/auth/forgot-password` | Não |
| RF49 | POST | `/auth/reset-password` | Não |
| RF05 | PATCH | `/me/password` | Cookie `accessToken` |
| RF06 | PATCH | `/me` | Cookie `accessToken` |
| RF07 | GET | `/me` | Cookie `accessToken` |
| RF15 | GET | `/workspaces/{workspaceId}/members` | Cookie `accessToken` |
| RF17 | PUT | `/workspaces/{workspaceId}/members/{memberId}/role` | Cookie `accessToken` + dono |
| RF20 | GET | `/workspaces/{workspaceId}/roles` | Cookie `accessToken` + dono |
| RF18 | POST | `/workspaces/{workspaceId}/roles` | Cookie `accessToken` + dono |
| RF22 | GET | `/workspaces/{workspaceId}/roles/{roleId}/permissions` | Cookie `accessToken` + dono |
| RF19 | DELETE | `/workspaces/{workspaceId}/roles/{roleId}` | Cookie `accessToken` + dono |
| RF23 | POST | `/workspaces/{workspaceId}/collections` | Cookie `accessToken` |
| RF26 | GET | `/workspaces/{workspaceId}/collections` | Cookie `accessToken` |
| RF27 | GET | `/workspaces/{workspaceId}/collections/{collectionId}/path` | Cookie `accessToken` |
| RF30 | POST | `/workspaces/{workspaceId}/items/attachments` | Cookie `accessToken` |
| RF30 | PUT | `/workspaces/{workspaceId}/items/{itemId}/attachment` | Cookie `accessToken` |
| RF30 | PUT | `/workspaces/{workspaceId}/items/{itemId}/metadata` | Cookie `accessToken` |
| RF29 | PUT | `/workspaces/{workspaceId}/items/{itemId}` | Cookie `accessToken` |
| RF30 | GET | `/workspaces/{workspaceId}/items/{itemId}/attachment` | Cookie `accessToken` |
| #38 | DELETE | `/workspaces/{workspaceId}/items/{itemId}?confirm=true` | Cookie `accessToken` |
| RF31 | POST | `/workspaces/{workspaceId}/items/{itemId}/archive` | Cookie `accessToken` |
| RF32 | POST | `/workspaces/{workspaceId}/items/{itemId}/restore` | Cookie `accessToken` |
| RF36 | GET | `/workspaces/{workspaceId}/activity` | Cookie `accessToken` |
| RF— | GET | `/workspaces/{workspaceId}/groups` | Cookie `accessToken` + `group/manage` |
| RF— | POST | `/workspaces/{workspaceId}/groups` | Cookie `accessToken` + `group/manage` |
| RF— | PUT | `/workspaces/{workspaceId}/groups/{groupId}` | Cookie `accessToken` + `group/manage` |
| RF— | DELETE | `/workspaces/{workspaceId}/groups/{groupId}` | Cookie `accessToken` + `group/manage` |
| RF— | GET | `/workspaces/{workspaceId}/groups/{groupId}/members` | Cookie `accessToken` + `group/manage` |
| RF— | PUT | `/workspaces/{workspaceId}/groups/{groupId}/members/{workspaceMemberId}` | Cookie `accessToken` + `group/manage` |
| RF— | DELETE | `/workspaces/{workspaceId}/groups/{groupId}/members/{workspaceMemberId}` | Cookie `accessToken` + `group/manage` |
| RF16 | DELETE | `/workspaces/{workspaceId}/members/{membershipId}?confirmMemberId={membershipId}` | Cookie `accessToken` + dono |
| RF38 | GET | `/notifications` | Cookie `accessToken` |
| RF39 | PATCH | `/notifications/{notificationId}/read` | Cookie `accessToken` |
| RF39 | PATCH | `/notifications/read` | Cookie `accessToken` |
| — | GET | `/notifications/stream` | Cookie `accessToken` |

**`DELETE /workspaces/{workspaceId}/members/{membershipId}?confirmMemberId={membershipId}`** — somente um
membro ativo com papel `Owner` pode remover um vínculo. A confirmação deve repetir o ID do vínculo no caminho; ausente ou
divergente retorna `400`, tentativa do último dono retorna `409`, e sucesso retorna `204`. A remoção apaga
apenas o vínculo, revogando sessões e participações em grupos vinculadas por cascade, e registra
`member_removed` com ator e snapshot do membro. Conta, conteúdo e autoria histórica permanecem.
