# Rootly API (Java/Spring Boot)

Port em Java/Spring Boot do backend do [Rootly](../../rootly). Sistema sem cadastro público —
contas só nascem quando alguém já autenticado convida um e-mail; o convite chega por e-mail
(JavaMail) com um link que libera a tela de cadastro. Senha esquecida também é resolvida por
e-mail, com um token de redefinição de uso único.

> Hoje qualquer usuário autenticado pode enviar convites. Restringir isso a administradores /
> usuários de maior autoridade é um trabalho futuro, quando o sistema de papéis e a dashboard
> existirem.

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

   O Compose cria o banco `rootly`, exposto em `localhost:5432`, com usuário e senha `rootly`.
2. Copie `.env.example` para `.env` e ajuste as variáveis. Para o banco iniciado pelo Compose,
   use `DB_USERNAME=rootly` e `DB_PASSWORD=rootly`. Gere um valor aleatório de pelo menos 32 bytes
   para `JWT_SECRET`; a aplicação não inicia se essa variável estiver ausente. O `.env` é carregado
   automaticamente pelo Spring Boot, sem precisar exportar as variáveis no terminal.
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


## Endpoints (RF01–RF10)

Tabela resumida abaixo; documentação completa de cada endpoint (o que a função faz passo a
passo, parâmetros, respostas, códigos de erro) em [`docs/API.md`](docs/API.md).

Todos os cookies (`accessToken`, `refreshToken`) são `httpOnly` + `secure` + `sameSite=Strict` +
`path=/` (RNF01). Rotas autenticadas exigem o cookie `accessToken` válido. Como cookies `secure`
não são enviados pelo navegador em HTTP, os testes autenticados em `http://localhost` exigem HTTPS
ou o envio manual do cabeçalho `Cookie` pela ferramenta de testes.

| RF | Método | Rota | Auth | Request body | Sucesso | Erros |
|---|---|---|---|---|---|---|
| RF01 | POST | `/invites` | Sim | `{ email }` | 201 | 400 e-mail inválido, 401 não autenticado, 409 e-mail já cadastrado |
| RF02 | POST | `/auth/register` | Não | `{ email, token, name, password, confirmPassword }` | 200, seta cookies | 400 senhas não conferem, 404 convite não encontrado, 409 convite expirado ou e-mail já cadastrado |
| RF03 | POST | `/auth/login` | Não | `{ email, password }` | 200, seta cookies | 401 credenciais inválidas |
| RF04 | POST | `/auth/refresh` | Cookie `refreshToken` | — | 200, roda os cookies | 401 refresh token inválido/expirado |
| RF05 | POST | `/auth/logout` | Cookie `refreshToken` | — | 204, limpa os cookies | 401 refresh token inválido |
| RF06 | POST | `/auth/forgot-password` | Não | `{ email }` | 204 (sempre, mesmo se o e-mail não existir) | — |
| RF07 | POST | `/auth/reset-password` | Não | `{ token, newPassword, confirmPassword }` | 204 | 400 senhas não conferem, 401 token inválido/expirado |
| RF08 | PATCH | `/me/password` | Sim | `{ currentPassword, newPassword, confirmPassword }` | 204 | 400 senhas não conferem, 401 senha atual incorreta |
| RF09 | PATCH | `/me` | Sim | `{ name }` | 204 | 400 nome inválido (< 3 caracteres) |
| RF10 | GET | `/me` | Sim | — | 200 `{ id, name, email }` | 401 não autenticado |

Trocar a senha (RF08) e redefini-la via e-mail (RF07) invalidam todos os refresh tokens e todos os
tokens de redefinição pendentes do usuário, forçando novo login em outras sessões e impedindo o
reuso de links antigos.

## Workspaces (em andamento)

| Método | Rota | Auth | Sucesso | Regra de acesso |
|---|---|---|---|---|
| POST | `/workspaces` | Sim | 201 com o workspace criado | Cria o workspace, o papel `Owner` e o vínculo do criador. |
| GET | `/workspaces` | Sim | 200 com a lista | Retorna somente workspaces dos quais o usuário é membro. |
| GET | `/workspaces/{workspaceId}` | Sim | 200 com o workspace | Exige vínculo de membro; sem vínculo, retorna 404. |
| GET | `/workspaces/{workspaceId}/members` | Sim | 200 com a lista de membros | Exige vínculo de membro; sem vínculo, retorna 404. |
| PUT | `/workspaces/{workspaceId}` | Sim | 200 com o workspace atualizado | Somente o proprietário pode substituir `name` e `description`; sem permissão, retorna 404. |

## Estrutura do código

Camadas técnicas em `src/main/java/com/rootly/api`: `controller`, `service`, `repository`,
`entity`, `dto`, `config` (Spring Security + filtro JWT), `exception` (hierarquia de erros +
`@RestControllerAdvice`).

Entidades mapeadas até agora: `User`, `RefreshToken`, `UserInvite`, `PasswordResetToken`,
`EmailOutbox`, `Workspace`, `WorkspaceRole` e `WorkspaceMember`. Coleções, itens, notificações,
histórico de atividades, arquivos, convites para workspaces e RBAC além do papel inicial de
proprietário ainda não foram implementados.
