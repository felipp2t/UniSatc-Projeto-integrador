# API — RF01 a RF07 (autenticação e conta do usuário)

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
- `POST /auth/login` e `POST /invites/{inviteId}/accept` (os dois endpoints sujeitos a
  brute-force) têm rate limit de 5 requisições por minuto por IP, via `RateLimitFilter`
  (Bucket4j, em memória) — passar do limite responde `429 Too Many Requests`.

---

## RF01 — Criação de conta via convite

**`POST /invites/{inviteId}/accept`** — sem autenticação.

Completa o cadastro de um usuário "pendente" (criado antecipadamente quando o convite foi
emitido) e o vincula ao workspace. É a única forma de uma conta se tornar utilizável — não existe
cadastro público.

O que a função faz, em ordem:
1. Valida que `password == confirmPassword` (senão `400`).
2. Busca o convite (`workspace_invite`) pelo `inviteId` da URL (senão `404`).
3. Confere que o convite está com status `pending` (senão `409`, já aceito/recusado/revogado).
4. Confere que `expires_at` ainda não passou (senão `409`, expirado).
5. Localiza o usuário "pendente" associado ao convite (`invited_user_id`), define seu `name` e
   grava um `password_hash` real (Argon2) a partir da senha enviada.
6. Marca o convite como `accepted`.
7. Cria o `workspace_member` vinculando o usuário ao workspace do convite, com o papel
   (`role_id`) que o convite especifica — só se ainda não existir esse vínculo.
8. Gera um access token (JWT) e um refresh token (persistido em `refresh_token`), e os devolve
   como cookies — o usuário já entra logado, sem precisar chamar `/auth/login` em seguida.

| | |
|---|---|
| Path params | `inviteId` (UUID) |
| Request body | `{ "name": string (min 3), "password": string (min 8), "confirmPassword": string (min 8) }` |
| Sucesso | `200`, corpo vazio, seta `accessToken` + `refreshToken` |
| `400` | senhas não conferem, ou corpo inválido (nome/senha curtos demais) |
| `404` | nenhum convite com esse `inviteId` |
| `409` | convite já não está `pending`, ou já expirou |
| `429` | mais de 5 tentativas por IP em 1 minuto (rate limit, RNF de brute-force) |

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
| `429` | mais de 5 tentativas por IP em 1 minuto (rate limit, RNF de brute-force) |

---

## RF03 — Renovação de sessão (refresh)

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

## RF05 — Troca de senha

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
| Request body | `{ "name": string (min 3) }` |
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

## Tabela-resumo

| RF | Método | Rota | Auth |
|---|---|---|---|
| RF01 | POST | `/invites/{inviteId}/accept` | Não |
| RF02 | POST | `/auth/login` | Não |
| RF03 | POST | `/auth/refresh` | Cookie `refreshToken` |
| RF04 | POST | `/auth/logout` | Cookie `refreshToken` |
| RF05 | PATCH | `/me/password` | Cookie `accessToken` |
| RF06 | PATCH | `/me` | Cookie `accessToken` |
| RF07 | GET | `/me` | Cookie `accessToken` |
