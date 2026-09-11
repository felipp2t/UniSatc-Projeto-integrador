# Rootly API (Java/Spring Boot)

Port em Java/Spring Boot do backend do [Rootly](../../rootly), seguindo o schema-alvo fixado em
[`database/`](../../database). Sistema single-tenant: uma única empresa/workspace, sem cadastro
público — contas só nascem ao aceitar um convite por e-mail.

## Stack

| Concern | Tecnologia |
|---|---|
| Framework | Spring Boot 3.5 |
| Persistência | Spring Data JPA + Hibernate |
| Banco | PostgreSQL (local, já existente — sem migration de criação) |
| Migrations | Flyway (`baseline-on-migrate`, schema já existe fora do Flyway) |
| Auth | JWT (`jjwt`) via cookies HTTP-Only (RNF01) |
| Senhas | Argon2 (`Argon2PasswordEncoder` + BouncyCastle) (RNF02) |
| Validação | Bean Validation (`jakarta.validation`) |

## Como rodar

1. Garanta que existe um banco Postgres local chamado `rootly` (schema já criado a partir de
   `database/sql.txt`).
2. Copie `.env.example` e ajuste `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`/`JWT_SECRET` conforme seu
   ambiente (essas variáveis têm defaults em `application.properties`, então rodar sem `.env`
   também funciona contra um Postgres local com usuário `postgres`).
3. `mvn spring-boot:run`

A API sobe em `http://localhost:8080`.


## Endpoints (RF01–RF07)

Tabela resumida abaixo; documentação completa de cada endpoint (o que a função faz passo a
passo, parâmetros, respostas, códigos de erro) em [`docs/API.md`](docs/API.md).

Todos os cookies (`accessToken`, `refreshToken`) são `httpOnly` + `secure` + `sameSite=Strict` +
`path=/` (RNF01). Rotas autenticadas exigem o cookie `accessToken` válido.

| RF | Método | Rota | Auth | Request body | Sucesso | Erros |
|---|---|---|---|---|---|---|
| RF01 | POST | `/invites/{inviteId}/accept` | Não | `{ name, password, confirmPassword }` | 200, seta cookies | 400 senhas não conferem, 404 convite não existe, 409 convite expirado/já usado |
| RF02 | POST | `/auth/login` | Não | `{ email, password }` | 200, seta cookies | 401 credenciais inválidas |
| RF03 | POST | `/auth/refresh` | Cookie `refreshToken` | — | 200, roda os cookies | 401 refresh token inválido/expirado |
| RF04 | POST | `/auth/logout` | Cookie `refreshToken` | — | 204, limpa os cookies | 401 refresh token inválido |
| RF05 | PATCH | `/me/password` | Sim | `{ currentPassword, newPassword, confirmPassword }` | 204 | 400 senhas não conferem, 401 senha atual incorreta |
| RF06 | PATCH | `/me` | Sim | `{ name }` | 204 | 400 nome inválido (< 3 caracteres) |
| RF07 | GET | `/me` | Sim | — | 200 `{ id, name, email }` | 401 não autenticado |

Trocar a senha (RF05) invalida (deleta) todos os refresh tokens do usuário, forçando novo login
em outras sessões — igual ao comportamento do rootly original.

## Estrutura do código

Camadas técnicas em `src/main/java/com/rootly/api`: `controller`, `service`, `repository`,
`entity`, `enums`, `dto`, `config` (Spring Security + filtro JWT), `exception` (hierarquia de
erros + `@RestControllerAdvice`).

Entidades mapeadas até agora: `User`, `RefreshToken`, `Workspace`, `WorkspaceRole`,
`WorkspaceMember`, `WorkspaceInvite` — apenas o necessário para RF01-07. As demais tabelas do
schema-alvo (`collection`, `item*`, `notification`, `activity_log`) já existem no banco, mas
ganham entidade/repositório quando as RFs correspondentes forem migradas.
