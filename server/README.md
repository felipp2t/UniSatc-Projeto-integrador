# Vaulty API (Java/Spring Boot)

Port em Java/Spring Boot do backend do [Vaulty](../../vaulty). Cada instalação representa uma
única empresa, com um workspace único — sem cadastro público: contas só nascem quando o **dono
do workspace** convida um e-mail; o convite chega por e-mail (JavaMail) com um link que libera a
tela de cadastro, e o aceite já vincula a conta ao workspace com o papel `Member` (acesso
inicial, ainda sem RBAC granular). Senha esquecida também é resolvida por e-mail, com um token
de redefinição de uso único.

## Stack

| Concern | Tecnologia |
|---|---|
| Framework | Spring Boot 3.5 |
| Persistência | Spring Data JPA + Hibernate |
| Banco | PostgreSQL 17 (serviço local via Docker Compose) |
| Migrations | Flyway (`src/main/resources/db/migration`) |
| Auth | JWT (`jjwt`) via cookies HTTP-Only (RNF01) |
| Senhas | Argon2 (`Argon2PasswordEncoder` + BouncyCastle) (RNF02) |
| E-mail | Spring Mail (JavaMail) + outbox transacional com retentativas |
| Validação | Bean Validation (`jakarta.validation`) |
| Testes de integração | JUnit + Testcontainers com PostgreSQL real |

## Como rodar

1. Inicie o PostgreSQL:

   ```bash
   docker compose up -d
   ```

   O Compose cria o banco `vaulty`, exposto em `localhost:5432`, com usuário e senha `vaulty`.
2. Copie `.env.example` para `.env` e ajuste as variáveis. Para o banco iniciado pelo Compose,
   use `DB_USERNAME=vaulty` e `DB_PASSWORD=vaulty`. Gere um valor aleatório de pelo menos 32 bytes
   para `JWT_SECRET`; a aplicação não inicia se essa variável estiver ausente. O `.env` é carregado
   automaticamente pelo Spring Boot, sem precisar exportar as variáveis no terminal.
   Para criar e consultar segredos, configure `SECRET_ENCRYPTION_KEY` com 32 bytes aleatórios
   codificados em Base64. Gere-a, por exemplo, com `openssl rand -base64 32` e mantenha a mesma
   chave entre reinicializações para poder descriptografar os valores já salvos.
3. Para testar convites e recuperação de senha, configure `MAIL_HOST`, `MAIL_PORT`,
   `MAIL_USERNAME`, `MAIL_PASSWORD` e `MAIL_FROM`. Com Mailtrap Email Sandbox, use o host
   `sandbox.smtp.mailtrap.io`, porta `2525` e as credenciais exibidas na aba SMTP do seu Sandbox.
   Os endpoints gravam o e-mail na outbox na mesma transação dos tokens; um worker o envia em
   segundo plano e faz até 5 tentativas. Assim, `201`/`204` confirma o enfileiramento, não a
   entrega pelo servidor SMTP.
4. Execute a API com Java 17+ e Maven:

   ```bash
   mvn spring-boot:run
   ```

   Em um banco vazio, o Flyway cria as tabelas de autenticação, convite e recuperação de senha.
   A migration `V2` também insere o usuário inicial `admin@gmail.com`. Como não existe cadastro
   público, solicite a redefinição de senha desse e-mail para definir a primeira senha e então
   enviar o primeiro convite.

A API sobe em `http://localhost:8080`.

A documentação interativa OpenAPI está disponível em `http://localhost:8080/swagger-ui.html`; a
especificação JSON pode ser acessada em `http://localhost:8080/v3/api-docs`.

Para executar todos os testes, inclusive os de integração, mantenha o Docker ativo e rode:

```bash
mvn verify
```


## Endpoints — Conta e convites

Os IDs abaixo seguem a [especificação do projeto](../docs/REQUISITOS.md). O quadro descreve a implementação atual, não comprova atendimento aos novos critérios.

Tabela resumida abaixo; documentação completa de cada endpoint (o que a função faz passo a
passo, parâmetros, respostas, códigos de erro) em [`docs/API.md`](docs/API.md).

Todos os cookies (`accessToken`, `refreshToken`) são `httpOnly` + `secure` + `sameSite=Strict` +
`path=/` (RNF01). Rotas autenticadas exigem o cookie `accessToken` válido. Como cookies `secure`
não são enviados pelo navegador em HTTP, os testes autenticados em `http://localhost` exigem HTTPS
ou o envio manual do cabeçalho `Cookie` pela ferramenta de testes.

Cada par de tokens é associado ao registro `workspace_member` do usuário. O JWT de acesso inclui
o ID desse vínculo; a cada requisição autenticada, o servidor confirma que o vínculo ainda existe
para o mesmo usuário e obtém dele o papel atual. Remover o membro invalida imediatamente o acesso
por JWT e, pela FK `ON DELETE CASCADE`, remove também seus refresh tokens. Uma readmissão cria outro
vínculo, sem revalidar sessões antigas. O access token legado sem `membershipId` recebe `401`;
refresh tokens existentes são associados ao vínculo atual pela V20, e os sem vínculo são
descartados. Login de usuário sem vínculo não emite sessão; um refresh migrado de membro atual pode
rotacionar e emitir um novo par.

A V20 mantém a política existente de workspace, membros e proprietário. O papel é consultado no
banco por requisição, mas grupos, concessões e herança de permissões não existem nesta branch e
seguem para as issues #132/#133. Isso não representa atendimento integral ao RNF04 nem validação
completa de conteúdo granular.

| RF | Método | Rota | Auth | Request body | Sucesso | Erros |
|---|---|---|---|---|---|---|
| — | GET | `/invites` | Sim, só o dono | — | 200, lista `{ id, email, invitedByUserId, invitedByName, createdAt, expiresAt }` | 401 não autenticado, 403 não é o dono |
| RF10 | POST | `/invites` | Sim, só o dono | `{ email }` | 201 | 400 e-mail inválido, 401 não autenticado, 403 não é o dono, 409 e-mail já cadastrado |
| RF12 | POST | `/invites/decline` | Não | `{ email, token }` | 204 | 400 corpo inválido, 404 convite indisponível, 429 limite de tentativas |
| RF01/RF11 | POST | `/auth/register` | Não | `{ email, token, name, password, confirmPassword }` | 200, seta cookies | 400 senhas não conferem, 404 convite não encontrado, 409 convite expirado ou e-mail já cadastrado |
| RF02 | POST | `/auth/login` | Não | `{ email, password }` | 200, seta cookies | 401 credenciais inválidas |
| RF03 | POST | `/auth/refresh` | Cookie `refreshToken` | — | 200, roda os cookies | 401 refresh token inválido/expirado |
| RF04 | POST | `/auth/logout` | Cookie `refreshToken` | — | 204, limpa os cookies | 401 refresh token inválido |
| RF49 | POST | `/auth/forgot-password` | Não | `{ email }` | 204 sem corpo (sempre, exista ou não a conta) | 429 limite por IP |
| RF49 | POST | `/auth/reset-password` | Não | `{ token, newPassword, confirmPassword }` | 204 sem corpo, sem iniciar sessão | 400 senhas não conferem, 401 token inválido/expirado/utilizado, 429 limite por IP |
| RF05 | PATCH | `/me/password` | Sim | `{ currentPassword, newPassword, confirmPassword }` | 204 | 400 senha atual incorreta ou senhas não conferem, 401 não autenticado |
| RF06 | PATCH | `/me` | Sim | `{ name }` | 204 | 400 nome inválido (< 3 caracteres) |
| RF07 | GET | `/me` | Sim | — | 200 `{ id, name, email }` | 401 não autenticado |

Trocar a senha (RF05) e redefini-la via e-mail (RF49) invalidam todos os refresh tokens e todos os
tokens de redefinição pendentes do usuário. Access tokens já emitidos podem continuar válidos por
até 15 minutos. Na recuperação, a interface apresenta a mensagem neutra definida em RF49-CA01; após
sucesso encaminha ao login sem sessão automática (RF49-CA06); diante de `401`, informa que o link está
indisponível e oferece nova solicitação (RF49-CA07). Esses comportamentos de interface pertencem à #140.

`GET /invites` lista apenas convites ainda não expirados cujo e-mail não pertence a uma conta; a
resposta inclui `id`, `email`, `invitedByUserId`, `invitedByName`, `createdAt` e `expiresAt`.

## Notificações

`GET /notifications` lista, com paginação, os avisos do usuário autenticado; `PATCH
/notifications/{notificationId}/read` marca um aviso próprio como lido; e `GET
/notifications/stream` fornece avisos em tempo real por SSE (até cinco conexões por usuário,
30 minutos por conexão). O stream envia apenas o UUID da notificação como string JSON. Os avisos
persistidos podem ser recuperados consultando a lista ao conectar e reconectar; a emissão SSE é
best effort e acontece após o commit.

Os eventos atuais cobrem atualização de perfil e troca de senha. Há um ponto de integração
`accessChanged(Collection<UUID>)` para futuros produtores de mudanças de acesso, mas os CRUDs de
papéis, grupos, compartilhamentos e herança ainda não estão implementados. A issue #42 não completa
o fan-out de permissões nem eventos role-permission de ponta a ponta (CA01); a integração futura está
prevista na issue #130 e no trabalho de gestão de papéis. Os avisos usam título e texto fixos, sem
referências ou dados de recursos e sem segredos, e não verificam acesso. A migration `V18` cria a
tabela e seu índice; `V19` está reservada para outra issue. Consulte [`docs/API.md`](docs/API.md)
para formatos e respostas completos.

## Workspace (em andamento)

Cada instalação representa uma única empresa e tem **exatamente um workspace**, provisionado uma
vez pela migration `V5__enforce_workspace_singleton.sql`. Em instalações vazias, ela cria o
workspace e o vínculo `Owner` do admin inicial (seedado em `V2`). Em upgrades, preserva o
workspace e seu proprietário, garantindo seu papel e vínculo `Owner`. A migration `V6`
garante o papel `Member` no workspace existente. Não existe criação nem seleção de workspaces
em tempo de execução — a tabela `workspace` tem uma coluna `singleton` com `CHECK`/`UNIQUE` que torna uma
segunda linha impossível, inclusive sob concorrência.

| Método | Rota | Auth | Sucesso | Regra de acesso |
|---|---|---|---|---|
| GET | `/workspaces` | Sim | 200 com a lista (0 ou 1 item) | Retorna o workspace único, se o usuário for membro. |
| GET | `/workspaces/{workspaceId}` | Sim | 200 com o workspace | Exige vínculo de membro; sem vínculo, retorna 404. |
| GET | `/workspaces/{workspaceId}/members` | Sim | 200 com a lista de membros | Exige vínculo de membro; sem vínculo, retorna 404. |
| GET | `/workspaces/{workspaceId}/activity` | Sim | 200 com página do histórico | Exige `activity/read`; a visibilidade do histórico respeita as permissões atuais do usuário. |
| PUT | `/workspaces/{workspaceId}` | Sim | 200 com o workspace atualizado | Somente o proprietário pode substituir `name` e `description`; sem permissão, retorna 404. |
| POST | `/workspaces/{workspaceId}/collections` | Sim | 201 com a pasta criada | Exige `collection/create`; pasta pai deve pertencer ao mesmo workspace. |
| GET | `/workspaces/{workspaceId}/collections` | Sim | 200 com página de pastas do nível | Exige vínculo de membro; `parentId` omitido lista a raiz. `page` começa em 0 e `size` tem padrão 20 e máximo 100. |
| GET | `/workspaces/{workspaceId}/collections/{collectionId}/path` | Sim | 200 com o caminho da raiz à pasta | Exige vínculo de membro; pasta fora do workspace retorna 404. |
| PUT | `/workspaces/{workspaceId}/collections/{collectionId}` | Sim | 200 com a pasta renomeada | Exige `collection/update`; título repetido no nível retorna 409. |
| DELETE | `/workspaces/{workspaceId}/collections/{collectionId}` | Sim | 204 | Exige `collection/delete`; subpasta ou item bloqueia com 409. |

Pastas são persistidas na tabela `collection`. A raiz é o workspace e não possui registro: `parent_id = NULL` identifica pastas da raiz. Nomes são únicos dentro do mesmo nível e nomes de pais precisam pertencer ao mesmo workspace.

## Itens (Entrega 2)

| Método | Rota | Sucesso | Regra |
|---|---|---|---|
| POST | `/workspaces/{workspaceId}/items` | 201 | `item/create`; segredos exigem também `secret/create`. |
| GET | `/workspaces/{workspaceId}/items` | 200 | Lista metadados paginados da raiz ou da pasta indicada por `collectionId`; segredos só aparecem para quem tem `secret/read`. |
| GET | `/workspaces/{workspaceId}/items/search?q=...` | 200 | Busca paginada por todas as palavras do título, em qualquer ordem, ignorando caixa e acentos; aplica as mesmas permissões. |
| GET | `/workspaces/{workspaceId}/items/{itemId}` | 200 | Retorna conteúdo/metadados do item autorizado; segredos ficam indisponíveis sem `secret/read`. |
| GET | `/workspaces/{workspaceId}/items/{itemId}/secret` | 200 | Revela o valor somente com `item/read` e `secret/read`. |
| POST | `/workspaces/{workspaceId}/items/attachments` | 201 | Cria item `file`/`image` com um anexo; exige `item/create`. |
| PUT | `/workspaces/{workspaceId}/items/{itemId}/attachment` | 200 | Substitui o anexo com `item/update`; falha preserva o anterior. |
| PUT | `/workspaces/{workspaceId}/items/{itemId}/metadata` | 204 | Atualiza título, descrição e pasta com `item/update`. |
| GET | `/workspaces/{workspaceId}/items/{itemId}/attachment` | 200 | Baixa o arquivo autorizado; PDF/imagens podem ser exibidos inline. `download=true` força download. |

Na criação, informe `type` (`text`, `link` ou `secret`), `title`, `collectionId` opcional e
respectivamente `textContent` (até 100.000 caracteres e não apenas espaços), `linkUrl` HTTP(S)
completa (até 2.048 caracteres) ou `value` (até 8.192 caracteres e não apenas espaços).
Texto/Markdown e valor secreto são preservados exatamente, incluindo espaços significativos. As listagens retornam `items`,
`page`, `size`, `totalItems` e `totalPages`; `page` começa em 0 e `size` vai de 1 a 100.
O valor de um segredo é criptografado com AES-256-GCM antes da gravação e nunca aparece nas
respostas de criação, listagem, busca ou consulta comum.

Anexos aceitam PDF, TXT, MD, DOCX, XLSX, PPTX, PNG e JPEG (`.jpg`/`.jpeg`), até
20.000.000 bytes por arquivo. Cada item `file`/`image` tem exatamente um anexo. A substituição usa
um objeto novo e mantém o anterior disponível se a gravação não concluir; não há histórico de versões.
O nome, MIME type e tamanho ficam no banco, mas o conteúdo fica no storage compatível com S3.
O storage é opcional: sem `app.storage.s3.bucket`, a aplicação inicia normalmente e endpoints de
anexo retornam `503 Service Unavailable`. Para habilitá-los, configure `app.storage.s3.bucket`,
`app.storage.s3.region`, `app.storage.s3.access-key` e `app.storage.s3.secret-key`; `app.storage.s3.endpoint`
é opcional para usar um endpoint compatível, e `app.storage.s3.path-style` aceita `true`/`false`.

Títulos de itens e nomes de pastas são únicos por localização, ignorando caixa, acentos e
espaços nas extremidades. Itens arquivados continuam reservando o título. A busca considera
palavras completas, usa todas as palavras da consulta e ordena por título normalizado e ID;
não pesquisa o conteúdo. A migração `V11` registra as permissões iniciais de `Member`
(`item/read` e `collection/read`), mantendo segredos e ações de escrita restritos.

A migração `V12` recalcula as identidades e a busca dos registros existentes. Caso encontre
nomes equivalentes na mesma localização, interrompe a atualização para regularização manual;
não renomeia nem exclui conteúdo automaticamente.

## Estrutura do código

Camadas técnicas em `src/main/java/com/vaulty/api`: `controller`, `service`, `repository`,
`entity`, `dto`, `config` (Spring Security + filtro JWT), `exception` (hierarquia de erros +
`@RestControllerAdvice`).

Entidades mapeadas até agora: `User`, `RefreshToken`, `UserInvite`, `PasswordResetToken`,
`EmailOutbox`, `Workspace`, `WorkspaceRole`, `WorkspaceMember`, `WorkspaceCollection`,
`WorkspaceItem`, `WorkspaceItemSecret`, `WorkspaceItemFile`, `WorkspaceItemMedia` e `RolePermission`.
Anexos e histórico de atividades estão implementados. Compartilhamento granular de conteúdo e gestão
de papéis ainda não foram implementados.
