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
| Banco | PostgreSQL (local, schema-alvo já existente — ver abaixo) |
| Migrations | Flyway (`baseline-on-migrate` sobre o schema existente + `db/migration` para o que falta) |
| Auth | JWT (`jjwt`) via cookies HTTP-Only (RNF01) |
| Senhas | Argon2 (`Argon2PasswordEncoder` + BouncyCastle) (RNF02) |
| E-mail | Spring Mail (JavaMail) — convite de novo usuário e recuperação de senha |
| Validação | Bean Validation (`jakarta.validation`) |

## Como rodar

1. Garanta que existe um banco Postgres local chamado `rootly` com o schema-alvo já criado
   (`user`, `refresh_token`, `workspace*`, `collection`, `item*`, `notification`,
   `activity_log`...). O Flyway faz o baseline desse schema existente na primeira execução e, a
   partir daí, aplica só as migrations incrementais em `src/main/resources/db/migration` — hoje,
   uma única (`V1`) que cria `user_invite` e `password_reset_token`, as duas tabelas novas do
   fluxo de convite/recuperação de senha.
2. Copie `.env.example` para `.env` (`server/.env`, já ignorado pelo git) e preencha
   `DB_USERNAME`/`DB_PASSWORD` com as credenciais do seu Postgres local e `JWT_SECRET` com um
   valor aleatório de pelo menos 32 bytes — nenhuma dessas três variáveis tem default em
   `application.properties` (são segredos, não podem viver no arquivo versionado), então a
   aplicação falha ao subir se alguma faltar. O `.env` é carregado automaticamente pelo Spring
   Boot via `spring.config.import` — não precisa exportar as variáveis manualmente.
3. Ajuste `MAIL_HOST`/`MAIL_PORT`/`MAIL_USERNAME`/`MAIL_PASSWORD`/`MAIL_FROM` e `FRONTEND_URL` no
   `.env` para o envio de e-mails de convite/recuperação de senha funcionar de verdade (sem isso,
   o Spring Mail tenta enviar e falha silenciosamente do ponto de vista do cliente — a chamada
   ainda responde `204`).
4. Como não existe cadastro público, a migration `V2__insert_admin_user.sql` já semeia um usuário
   inicial (`admin@gmail.com`) pra você conseguir logar e enviar o primeiro convite sem precisar
   inserir nada manualmente no banco.
5. `mvn spring-boot:run`

A API sobe em `http://localhost:8080`.


## Endpoints (RF01–RF10)

Tabela resumida abaixo; documentação completa de cada endpoint (o que a função faz passo a
passo, parâmetros, respostas, códigos de erro) em [`docs/API.md`](docs/API.md).

Todos os cookies (`accessToken`, `refreshToken`) são `httpOnly` + `secure` + `sameSite=Strict` +
`path=/` (RNF01). Rotas autenticadas exigem o cookie `accessToken` válido.

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

Trocar a senha (RF08) e redefini-la via e-mail (RF07) invalidam (deletam) todos os refresh tokens
do usuário, forçando novo login em outras sessões.

## Estrutura do código

Camadas técnicas em `src/main/java/com/rootly/api`: `controller`, `service`, `repository`,
`entity`, `dto`, `config` (Spring Security + filtro JWT), `exception` (hierarquia de erros +
`@RestControllerAdvice`).

Entidades mapeadas até agora: `User`, `RefreshToken`, `UserInvite`, `PasswordResetToken` — apenas
o necessário para RF01-10. As demais tabelas do schema-alvo (`collection`, `item*`,
`notification`, `activity_log`) ganham entidade/repositório quando as RFs correspondentes forem
migradas.
