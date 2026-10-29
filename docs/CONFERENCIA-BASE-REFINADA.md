# Conferência da base refinada — issue #144

**Escopo:** conferência documental e por inspeção da base implementada para os critérios listados abaixo. A issue #144 não pode ser encerrada por esta conferência: permanecem dependências funcionais de #132 e #145, além dos fluxos separados de #130, #50 e #139.

**Como ler os resultados:** “presente por inspeção” descreve o código/configuração vistos nesta revisão; não significa teste executado nem aceite validado. “Pendente” marca requisito incompleto ou sem evidência suficiente. Os testes de regressão constam no repositório, mas não foram executados nesta rodada. A única verificação de alteração documental autorizada foi `git diff --check`.

## Matriz de critérios

| Critério | Conferência nesta base | Evidência inspecionada / pendência |
|---|---|---|
| RF01-CA01 — Entrada só por convite | Presente por inspeção | Cadastro público não existe; `POST /auth/register` exige convite pendente por e-mail e token. `AuthService.register`. |
| RF02-CA01 — Credenciais inválidas | Implementado nesta entrega; execução pendente | Ambos os ramos de `AuthService.login` lançam `E-mail ou senha inválidos`; regressão em `AuthLoginIntegrationTest`. Não executado nesta rodada. |
| RF03-CA01 — Renovação válida | Base de backend presente; FE pendente | Refresh rotativo em `AuthService.refreshToken`; renovação automática da sessão depende da interface em #145. |
| RF03-CA02 — Sessão expirada ou invalidada | Base de backend presente; FE pendente | Refresh ausente/inválido responde `401`; redirecionamento ao login e tratamento de falha temporária de rede pertencem a #145. |
| RF03-CA03 — Prazo de renovação | Presente por inspeção | `jwt.refresh-token-expiration-ms=604800000` (7 dias); access token configurado para `900000` (15 minutos). A rotação emite novo prazo. |
| RF04-CA01 — Alcance do logout | Presente por inspeção | `AuthService.logout` remove apenas o refresh token apresentado; demais sessões não são apagadas. |
| RF04-CA02 — Renovação e acesso residual | Presente por inspeção | Refresh usado no logout deixa de poder renovar; o access token stateless pode permanecer válido por até 15 minutos. Não há revogação imediata do token já emitido. |
| RF05-CA01 — Autenticação e senha atual | Presente por inspeção | `PATCH /me/password` exige autenticação e valida a senha atual em `CredentialService`. |
| RF05-CA02 — Confirmação | Presente por inspeção | Confirmação deve ser igual à nova senha; divergência rejeitada por `CredentialService`. |
| RF05-CA03 — Sessões e links após troca | Base de backend presente | `CredentialService` invalida refresh tokens e tokens de recuperação; access tokens já emitidos podem durar até 15 minutos. |
| RF05-CA04 — Conclusão na interface | Pendente — #145 | Confirmar a troca na interface e encaminhar o usuário ao login não é comportamento do backend. |
| RF06-CA01 — E-mail fixo | Presente por inspeção | `UpdateProfileRequest` contém apenas `name`; o endpoint de perfil não permite alterar e-mail. |
| RF07-CA01 — Dados do perfil | Presente por inspeção | `UserResponse` contém `id`, `name` e `email`; não inclui hash de senha nem tokens. |
| RF10-CA01 — Conta existente | Presente por inspeção | `InviteService` rejeita e-mail já associado a conta. |
| RF10-CA02 — Quem convida | Presente por inspeção | Criação/listagem de convites exige dono do workspace. |
| RF10-CA03 — Validade | Presente por inspeção | Convite recebe validade configurada de sete dias; aceite valida expiração. |
| RF10-CA04 — Reenvio | Presente por inspeção | Reenvio substitui o convite pendente para o mesmo e-mail, invalidando o token anterior e reiniciando o prazo. |
| RF10-CA05 — Confirmação | Parcial; texto de UI pendente — #145 | API retorna `201` sem corpo e grava mensagem na outbox transacional. Isso confirma enfileiramento, não entrega; a mensagem de confirmação exigida é da interface. |
| RF11-CA01 — Dados de cadastro | Presente por inspeção | Cadastro exige nome, senha e confirmação; senha e confirmação devem coincidir; e-mail/token são validados contra o convite. |
| RF11-CA02 — Conta e vínculo | Presente por inspeção | Criação da conta, vínculo ao workspace e consumo do convite ocorrem em `AuthService.register`, sob transação. |
| RF11-CA03 — Sessão inicial | Presente por inspeção | Cadastro emite access e refresh cookies após criar conta e vínculo. |
| RF11-CA04 — Acesso inicial | Presente apenas no modelo atual; não atende o refinamento completo | Ingresso usa papel `Member` e acesso normal de leitura; a implementação atual não demonstra todo o modelo de grupos/herança nem garante ocultação de segredos refinada por ACL. Depende de #132. |
| RF11-CA05 — Convite indisponível | Parcial | Backend rejeita convite inválido/expirado e não conclui o cadastro; orientar a pessoa a pedir outro convite é pendência da interface (#145). Revogação não integra este recorte. |
| RF11-CA06 — Identidade por e-mail | Presente por inspeção | A conta usa o e-mail do convite; perfil não oferece edição de e-mail (`RegisterRequest`, `UpdateProfileRequest`). |
| RF15-CA01 — Dados comuns | Presente por inspeção | Listagem fornece nome e papel aos membros com vínculo ao workspace. |
| RF15-CA02 — E-mail restrito | Implementado nesta entrega; execução pendente | `WorkspaceMemberService.list` inclui e-mail somente quando o dono atual do workspace no banco é o solicitante; claim de papel do JWT não decide visibilidade. Para não donos, `WorkspaceMemberResponse` omite totalmente a propriedade. Regressões em `WorkspaceMemberIntegrationTest`, não executadas nesta rodada. |
| RF23-CA01 — Validação e herança | Parcial; herança pendente — #132 | Nome é aparado, obrigatório, limitado a 255 caracteres e único após normalização da migração V12. Autorização de acesso herdado a pastas não está completa. |
| RF26-CA01 — Ocultação na listagem | Pendente — #132 | A listagem existente ainda não aplica ACL para ocultar pastas restritas; não marcar como concluído. |
| RF27-CA01 — Visibilidade do caminho | Pendente — #132 | O breadcrumb/caminho ainda não aplica ACL para ocultar segmentos restritos; não marcar como concluído. |

## Limites da conferência e dependências

- A inspeção de código não equivale à execução dos critérios nem à aprovação funcional. Nesta rodada não foram executados testes; foram apenas identificadas as regressões existentes para login e visibilidade de e-mail.
- A correção de RF15 usa o estado atual do dono persistido no banco, e não a claim `role` possivelmente antiga do JWT.
- RF03 e RF05 têm trabalho de interface em #145; critérios de ACL e herança para RF11/RF23/RF26/RF27 dependem de #132.
- Grupos (#130), remoção/readmissão e sessões (#50) e recuperação de conta (#139) permanecem fluxos separados. Esta conferência não declara esses escopos concluídos.
- Portanto, esta documentação não autoriza fechar #144 enquanto essas dependências e os critérios pendentes não forem concluídos e verificados.

## Referências de evidência

- Contrato da API: [`API.md`](../server/docs/API.md).
- Implementação de autenticação e convites: `server/src/main/java/com/vaulty/api/service/AuthService.java`, `CredentialService.java` e serviços de convite/workspace.
- Visibilidade dos membros: `server/src/main/java/com/vaulty/api/service/WorkspaceMemberService.java`, `WorkspaceMemberResponse.java` e `WorkspaceMapper.java`.
- Regressões disponíveis, não executadas nesta rodada: `server/src/test/java/com/vaulty/api/auth/AuthLoginIntegrationTest.java` e `server/src/test/java/com/vaulty/api/workspace/WorkspaceMemberIntegrationTest.java`.
- Critérios refinados: [issue #144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) e `docs/REQUISITOS.md`.
