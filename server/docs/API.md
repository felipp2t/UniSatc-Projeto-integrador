# API — Conta, convites e pastas

Referência detalhada de cada endpoint implementado no backend Java. Para instruções de setup e
bootstrap do banco, veja [`../README.md`](../README.md).

Os IDs seguem a [especificação de requisitos](../../docs/REQUISITOS.md). Esta página descreve os endpoints implementados; decisões novas de grupos, compartilhamento, remoção e readmissão ainda exigem conferência de implementação e não são presumidas como concluídas.

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
- **Início do RNF04** (autorização por permissão no próprio token): o `accessToken` carrega uma
  claim `role` com o nome do papel do usuário no workspace (`Owner` ou `Member`, por enquanto —
  ainda não existem papéis customizados nem permissões granulares por recurso/ação). A claim é
  calculada a cada emissão/renovação de token (login, registro, refresh), nunca lida do banco a
  cada requisição. `JwtAuthenticationFilter` expõe isso como uma `GrantedAuthority` do Spring
  Security, pronta para checagens futuras (`hasAuthority(...)`) quando RBAC granular existir.
  Identidade e papel são extraídos de uma única validação do JWT. Tokens antigos sem `role`
  continuam autenticados, mas não recebem authorities.

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
| `401` | e-mail não encontrado ou senha incorreta |
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
5. Emite um novo access token + um novo refresh token (rotação), devolvidos como cookies. Tokens
   expirados são removidos pela manutenção agendada.

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
| RF23 | POST | `/workspaces/{workspaceId}/collections` | Cookie `accessToken` |
| RF26 | GET | `/workspaces/{workspaceId}/collections` | Cookie `accessToken` |
| RF27 | GET | `/workspaces/{workspaceId}/collections/{collectionId}/path` | Cookie `accessToken` |
