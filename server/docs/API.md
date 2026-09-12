# API — RF01 a RF10 (autenticação, convite e conta do usuário)

Referência detalhada de cada endpoint implementado no backend Java. Para instruções de setup e
bootstrap do banco, veja [`../README.md`](../README.md).

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
- `POST /auth/login`, `POST /auth/register`, `POST /auth/forgot-password` e
  `POST /auth/reset-password` (sujeitos a brute-force/spam) têm rate limit de 5 requisições por
  minuto por IP, via `RateLimitFilter` (Bucket4j, em memória) — passar do limite responde
  `429 Too Many Requests`.
- Não existe cadastro público: uma conta só nasce quando alguém já autenticado envia um convite
  (RF01) e o convidado conclui o cadastro com o token recebido por e-mail (RF02). Hoje qualquer
  usuário autenticado pode convidar; restringir isso a administradores é trabalho futuro (quando
  a dashboard e o sistema de papéis existirem).

---

## RF01 — Convite de novo usuário

**`POST /invites`** — autenticado (cookie `accessToken`).

Envia um convite por e-mail (JavaMail) para um endereço ainda não cadastrado, contendo um link
para a tela de cadastro do frontend com `email` e `token` na query string.

O que a função faz, em ordem:
1. Confere que não existe usuário com esse `email` (senão `409`).
2. Apaga qualquer convite anterior pendente para o mesmo `email` (reenviar substitui o convite
   antigo).
3. Cria um `UserInvite` com um token opaco (`UUID.randomUUID()`), associado a quem convidou
   (`invited_by_user_id`) e com validade de 7 dias (`invite.expiration-ms`).
4. Envia o e-mail com o link `${FRONTEND_URL}/cadastro?email=...&token=...`.

| | |
|---|---|
| Auth | Cookie `accessToken` |
| Request body | `{ "email": string }` |
| Sucesso | `201`, corpo vazio |
| `400` | e-mail inválido/ausente |
| `401` | não autenticado |
| `409` | já existe uma conta com esse e-mail |

---

## RF02 — Cadastro via convite

**`POST /auth/register`** — sem autenticação.

Completa o cadastro de quem recebeu um convite, usando o `email` + `token` que vieram do link do
e-mail (RF01).

O que a função faz, em ordem:
1. Valida que `password == confirmPassword` (senão `400`).
2. Busca o convite (`user_invite`) por `email` + `token` (senão `404`).
3. Confere se `expires_at` ainda não passou; se expirou, apaga o convite e responde `409`.
4. Confere que ainda não existe usuário com esse `email` (senão `409`).
5. Cria o `User` com `name`, `email` e `password_hash` (Argon2) a partir da senha enviada.
6. Apaga o convite (uso único).
7. Gera um access token (JWT) e um refresh token (persistido em `refresh_token`), devolvidos como
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

## RF03 — Login

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

## RF04 — Renovação de sessão (refresh)

**`POST /auth/refresh`** — autenticação via cookie `refreshToken` (não via `accessToken`).

Troca um refresh token válido por um novo par de tokens, permitindo que a sessão continue sem
pedir login de novo — usado quando o `accessToken` (curta duração) expira.

O que a função faz:
1. Lê o cookie `refreshToken` da requisição (`401` se ausente).
2. Busca esse token na tabela `refresh_token` (`401` se não existir).
3. Deleta o token encontrado (uso único — todo refresh invalida o token anterior).
4. Confere se ele já havia expirado (`401` se sim — mesmo já tendo sido deletado no passo
   anterior).
5. Emite um novo access token + um novo refresh token (rotação), devolvidos como cookies.

| | |
|---|---|
| Auth | Cookie `refreshToken` |
| Sucesso | `200`, corpo vazio, roda os cookies (novo `accessToken` + novo `refreshToken`) |
| `401` | cookie ausente, token inexistente ou expirado |

---

## RF05 — Logout

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

## RF06 — Esqueci minha senha

**`POST /auth/forgot-password`** — sem autenticação.

Dispara um e-mail (JavaMail) com um link de redefinição de senha, se o e-mail informado tiver
conta.

O que a função faz:
1. Busca o usuário por `email`. Se não existir, não faz nada — mas a resposta é idêntica à do
   caso de sucesso, para não revelar se o e-mail está cadastrado.
2. Se existir, apaga tokens de redefinição anteriores desse usuário, cria um novo
   `PasswordResetToken` (validade de 1h, `password-reset.expiration-ms`) e envia o e-mail com o
   link `${FRONTEND_URL}/redefinir-senha?token=...`.

| | |
|---|---|
| Request body | `{ "email": string }` |
| Sucesso | `204` sempre, exista ou não o e-mail |
| `429` | mais de 5 tentativas por IP em 1 minuto (rate limit) |

---

## RF07 — Redefinição de senha

**`POST /auth/reset-password`** — sem autenticação (o token do e-mail já autoriza a operação).

Define uma nova senha a partir do token recebido por e-mail (RF06).

O que a função faz:
1. Valida que `newPassword == confirmPassword` (senão `400`).
2. Busca o `PasswordResetToken` (senão `401`) e o apaga (uso único).
3. Confere se ele já havia expirado (`401` se sim — mesmo já tendo sido apagado no passo
   anterior).
4. Grava o novo `password_hash` (Argon2) no usuário associado ao token.
5. **Deleta todos os refresh tokens do usuário** — qualquer outra sessão/dispositivo logado
   precisa autenticar de novo.

| | |
|---|---|
| Request body | `{ "token": string, "newPassword": string (min 8), "confirmPassword": string (min 8) }` |
| Sucesso | `204` |
| `400` | senhas não conferem, ou corpo inválido |
| `401` | token inexistente ou expirado |
| `429` | mais de 5 tentativas por IP em 1 minuto (rate limit) |

---

## RF08 — Troca de senha

**`PATCH /me/password`** — autenticado (cookie `accessToken`).

Permite ao usuário logado trocar a própria senha, exigindo a senha atual como confirmação.

O que a função faz:
1. Valida que `newPassword == confirmPassword` (senão `400`).
2. Busca o usuário autenticado (`userId` vem do `accessToken`).
3. Compara `currentPassword` com o `password_hash` atual via Argon2 (`401` se não bater).
4. Grava o novo `password_hash` (Argon2).
5. **Deleta todos os refresh tokens do usuário** — qualquer outra sessão/dispositivo logado
   precisa autenticar de novo. A sessão atual continua valendo até o `accessToken` expirar
   naturalmente (é stateless, não dá pra revogar na hora).

| | |
|---|---|
| Auth | Cookie `accessToken` |
| Request body | `{ "currentPassword": string, "newPassword": string (min 8), "confirmPassword": string (min 8) }` |
| Sucesso | `204` |
| `400` | `newPassword` != `confirmPassword`, ou corpo inválido |
| `401` | não autenticado, ou `currentPassword` incorreta |

---

## RF09 — Atualização do perfil

**`PATCH /me`** — autenticado (cookie `accessToken`).

Atualiza os dados do próprio perfil. Hoje só existe `name` como campo editável — `email` é o
identificador de login (imutável por aqui) e senha tem endpoint próprio (RF08).

O que a função faz:
1. Busca o usuário autenticado.
2. Substitui `name` pelo valor enviado (com `trim()`).

| | |
|---|---|
| Auth | Cookie `accessToken` |
| Request body | `{ "name": string (min 3) }` |
| Sucesso | `204` |
| `400` | nome vazio ou menor que 3 caracteres |
| `401` | não autenticado |

---

## RF10 — Consulta do perfil autenticado

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

## Tabela-resumo

| RF | Método | Rota | Auth |
|---|---|---|---|
| RF01 | POST | `/invites` | Cookie `accessToken` |
| RF02 | POST | `/auth/register` | Não |
| RF03 | POST | `/auth/login` | Não |
| RF04 | POST | `/auth/refresh` | Cookie `refreshToken` |
| RF05 | POST | `/auth/logout` | Cookie `refreshToken` |
| RF06 | POST | `/auth/forgot-password` | Não |
| RF07 | POST | `/auth/reset-password` | Não |
| RF08 | PATCH | `/me/password` | Cookie `accessToken` |
| RF09 | PATCH | `/me` | Cookie `accessToken` |
| RF10 | GET | `/me` | Cookie `accessToken` |
