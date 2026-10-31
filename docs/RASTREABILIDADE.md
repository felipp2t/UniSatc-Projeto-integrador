# Rastreabilidade e situação — Vaulty

Matriz iniciada em 12/10/2026 como execução documental de L14. Relaciona requisitos às necessidades, issues existentes e cenários de verificação. A situação da issue é um retrato do GitHub e não comprova atendimento a todos os critérios novos.

## Como ler

- **Confirmado:** comportamento acordado na sessão ou consolidado do levantamento e decisões existentes.
- **Implementado:** exige conferir código e contratos, além de uma issue fechada.
- **Verificado:** exige resultado de teste identificado, com ambiente, versão e data.
- Os cenários e arquivos citados abaixo são candidatos de verificação; nenhum foi executado nesta tarefa documental.
- Prioridades dos RF01–RF40 são herdadas das labels do backlog original. Novos requisitos ainda precisam de priorização e estimativa conjunta da equipe; não há data intermediária prometida.

## Matriz funcional

| RF | Necessidade / contexto | Issues vinculadas | Situação da issue principal | Prioridade herdada | Cenário de verificação / caso de uso |
|---|---|---|---|---|---|
| RF01 | RU06 | [#6](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/6), [#68](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/68), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento) | CLOSED | essencial | UC01: convite válido, sem cadastro público |
| RF02 | Conta/sessão | [#7](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/7), [#67](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/67), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento), [#145](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/145) (refinamento FE) | CLOSED | essencial | Login válido/inválido, sem revelar conta |
| RF03 | Conta/sessão | [#8](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/8), [#69](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/69), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento), [#145](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/145) (refinamento FE) | CLOSED | essencial | Renovação, expiração e sessão invalidada |
| RF04 | Conta/sessão | [#9](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/9), [#69](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/69), [#70](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/70), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento), [#145](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/145) (refinamento FE) | CLOSED | essencial | Logout atual e preservação de outras sessões |
| RF05 | Conta/sessão | [#10](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/10), [#72](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/72), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento), [#145](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/145) (refinamento FE) | CLOSED | essencial | Senha atual, confirmação e retorno ao login |
| RF06 | RU02 | [#11](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/11), [#71](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/71), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento) | CLOSED | essencial | Nome editável e e-mail fixo |
| RF07 | RU01 | [#12](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/12), [#70](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/70), [#71](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/71), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento) | CLOSED | essencial | Perfil próprio sem dados sigilosos |
| RF08 | RU01 | [#13](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/13), [#73](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/73) | CLOSED | essencial | Consulta com vínculo ativo |
| RF09 | Conta/sessão | [#14](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/14), [#73](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/73) | CLOSED | essencial | Atualização pelo dono sem outro workspace |
| RF10 | RU06 | [#15](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/15), [#74](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/74), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento) | CLOSED | essencial | Envio/reenvio, validade e conta existente |
| RF11 | RU06 | [#16](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/16), [#68](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/68), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento) | CLOSED | essencial | UC01: conta e vínculo consistentes |
| RF12 | RU06 | [#17](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/17), [#76](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/76) | OPEN | importante | Recusa sem login e link inutilizado |
| RF13 | RU06 | [#18](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/18), [#75](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/75) | OPEN | importante | Revogação pendente sem afetar conta aceita |
| RF14 | RU06 | [#19](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/19), [#75](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/75) | OPEN | importante | Listagem pendente e expiração |
| RF15 | RU03 | [#20](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/20), [#77](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/77), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento) | CLOSED | essencial | Nome/papel e e-mail restrito |
| RF16 | RU03 | [#21](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/21), [#77](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/77) | OPEN | essencial | Remoção, último dono e token antigo |
| RF17 | RU03 | [#22](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/22), [#78](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/78) | OPEN | essencial | Atribuição e propagação em até 15 minutos |
| RF18 | RU03 | [#23](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/23), [#80](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/80) | OPEN | essencial | Papel novo vazio e nome único |
| RF19 | RU03 | [#24](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/24), [#82](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/82) | OPEN | importante | Papel em uso e papéis protegidos |
| RF20 | RU03 | [#25](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/25), [#79](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/79) | OPEN | essencial | Consulta de papéis restrita aos donos |
| RF21 | RU03 | [#26](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/26), [#81](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/81) | OPEN | essencial | UC03: catálogo, proteção e atualização |
| RF22 | RU03 | [#27](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/27), [#81](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/81) | OPEN | importante | Consulta de permissões restrita aos donos |
| RF23 | RU02 | [#28](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/28), [#84](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/84), [#85](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/85), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento) | CLOSED | essencial | Pasta autorizada, nome e herança |
| RF24 | RU02 | [#29](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/29), [#85](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/85) | OPEN | essencial | Renomeação preserva conteúdo/concessões |
| RF25 | RU02 | [#30](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/30), [#85](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/85) | OPEN | essencial | Pasta vazia incluindo itens arquivados |
| RF26 | RU01 | [#31](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/31), [#84](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/84), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento) | CLOSED | essencial | UC05-A01: ocultação de pastas restritas |
| RF27 | RU01 | [#32](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/32), [#84](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/84), [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144) (refinamento) | CLOSED | importante | Caminho não revela segmentos inacessíveis |
| RF28 | RU02 | [#33](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/33), [#87](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/87), [#90](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/90) | OPEN | essencial | UC02: quatro tipos e validações |
| RF29 | RU02 | [#34](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/34), [#89](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/89) | OPEN | essencial | Item ativo, tipo mantido e resultado desconhecido |
| RF30 | RU02 | [#35](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/35), [#88](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/88) | OPEN | importante | UC02: um anexo, formato e tamanho |
| RF31 | RU02 | [#36](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/36), [#91](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/91) | OPEN | essencial | Arquivamento e título reservado |
| RF32 | RU02 | [#37](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/37), [#91](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/91) | OPEN | essencial | Restauração sem recuperar concessões removidas |
| RF33 | RU02 | [#38](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/38), [#91](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/91) | OPEN | essencial | Item arquivado, confirmação e exclusão |
| RF34 | RU01 | [#39](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/39), [#86](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/86) | OPEN | essencial | UC05-A01: listagem sem itens ocultos |
| RF35 | RU04 | [#40](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/40) | OPEN | essencial | Registro dos eventos sem dados sigilosos |
| RF36 | RU04 | [#41](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/41), [#92](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/92) | OPEN | essencial | UC04: filtros e públicos do histórico |
| RF37 | RU05 | [#42](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/42), [#96](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/96) | OPEN | importante | Destinatários afetados e aviso genérico de perda |
| RF38 | RU05 | [#43](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/43), [#93](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/93) | OPEN | importante | Avisos próprios, paginação e referência antiga |
| RF39 | RU05 | [#44](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/44), [#94](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/94) | OPEN | importante | Leitura somente pelo destinatário |
| RF40 | RU05 | [#45](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/45), [#95](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/95) | OPEN | desejavel | Entrega ativa, falha e reconexão |
| RF41 | RU01 | [#129](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/129), [#134](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/134) | OPEN; implementação/verificação pendentes | a priorizar | UC05 e teste RNF15, palavras e público |
| RF42 | RU03 | [#130](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/130), [#131](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/131) | OPEN; implementação/verificação pendentes | a priorizar | Grupo autorizado e nome único |
| RF43 | RU03 | [#130](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/130), [#131](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/131) | OPEN; implementação/verificação pendentes | a priorizar | Composição de grupos e acesso na próxima requisição |
| RF44 | RU03 | [#130](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/130), [#131](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/131) | OPEN; implementação/verificação pendentes | a priorizar | Grupo sem membros/concessões |
| RF45 | RU03 | [#132](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/132), [#133](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/133) | OPEN; implementação/verificação pendentes | a priorizar | Pasta→grupo, item→membro e múltiplas origens |
| RF46 | RU03 | [#132](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/132), [#133](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/133) | OPEN; implementação/verificação pendentes | a priorizar | Interrupção/cópia/reativação da herança |
| RF47 | RU03 | [#132](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/132), [#133](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/133) | OPEN; implementação/verificação pendentes | a priorizar | Exibir origens sem ampliar acesso |
| RF48 | Preservação do conhecimento (ON01) | [#135](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/135), [#136](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/136) | OPEN; implementação/verificação pendentes | a priorizar | Backup de dono, pacote completo e falha |
| RF49 | Conta/sessão | [#139](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/139), [#140](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/140) | Backend verificado (8 testes); frontend desenvolvido; integração/E2E pendente na #140 | a priorizar | RF49-CA01, RF49-CA06 e RF49-CA07 dependem de interface; RF49-CA02, RF49-CA03, RF49-CA04 e RF49-CA05 cobertos no backend. Ver [API](../server/docs/API.md) e [testes](../server/src/test/java/com/vaulty/api/auth/PasswordRecoveryIntegrationTest.java). |
| RF50 | RU03 | [#141](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/141), [#142](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/142) | OPEN; implementação/verificação pendentes | a priorizar | Readmissão limitada sem reativar token antigo |
| RF51 | RU03 | [#143](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/143), [#80](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/80) | OPEN; implementação/verificação pendentes | a priorizar | Renomeação de papel sem afetar atribuições |
| RF52 | RU03 | [#130](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/130), [#131](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/131) | OPEN; implementação/verificação pendentes | a priorizar | Listagem por Gestão de grupos |
| RF53 | RU03 | [#130](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/130), [#131](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/131) | OPEN; implementação/verificação pendentes | a priorizar | Renomeação de grupo preserva vínculos |

### Evidência frontend RF49 — 29/10/2026

As telas existentes de solicitação e redefinição apresentam mensagem genérica, tratam link indisponível (incluindo token só com espaços), preservam a senha válida e distinguem erros de validação, limite de tentativas, servidor e rede. Após redefinir, tentam encerrar a sessão, usam limpeza local sem callback se o logout falhar e retornam ao login sem token no redirect.

Em 31/10/2026, no commit `a8e59e9` (branch `feat/140-password-recovery-rf49`, já rebaseada no `develop` `040f0ab`), no ambiente Windows com Node.js 22.16.0 e Vitest 5.0.5, a suíte completa passou com **296 testes em 32 arquivos** e a seleção focal abaixo passou com **86 testes em 3 arquivos** (um subconjunto da suíte completa, não testes adicionais). O arquivo de recuperação sozinho passou com **49 testes**. Comandos executados em `web/`:

```sh
pnpm test
pnpm test src/api/get-api-error-message.test.ts src/pages/recuperacao-senha.test.tsx src/pages/cadastro.test.tsx
pnpm test src/pages/recuperacao-senha.test.tsx
```

Nesse commit também passaram o check estático (`pnpm check`, 133 arquivos), TypeScript (`pnpm exec tsc -b`) e `pnpm build`. Antes de o histórico da branch ser resumido, a suíte completa também passou em rodadas sequenciais e com duas execuções simultâneas, sem timeout; no `a8e59e9`, cujo conteúdo é idêntico ao do último commit anterior ao resumo, ela foi executada uma vez, de forma sequencial. A última alteração de código antes do resumo, um ajuste de classe de espaçamento no esqueci a senha, foi verificada só nessa execução sequencial. O espaçamento entre o campo e o botão foi medido no navegador (28px, com a região de status vazia, com erro e com a mensagem visível). A mensagem de erro de rede dos formulários de autenticação e de cadastro por convite agora é a padrão de `src/api/get-api-error-message.ts`.

As contagens registradas antes da reescrita do histórico não são reproduzíveis por SHA, porque esses commits deixaram de existir na branch; vale apenas a contagem acima.

Essa evidência cobre comportamento frontend e sessão local. Validade real de uma hora, uso único, invalidação de links anteriores e revogação de sessões no banco dependem da verificação backend em #139; os mocks frontend não comprovam esses critérios. Depois da redefinição o backend remove os refresh tokens e o `/auth/logout` responde 401 sem limpar os cookies; o frontend só limpa o estado local, e o acesso já emitido pode valer por até 15 minutos (limite de #139). O registro não declara fechamento de #140.

## Matriz não funcional

| RNF | Issue original / situação | Verificação prevista |
|---|---|---|
| RNF01 | [#47](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/47) / CLOSED | Cookies e ciclo de sessão, sem exposição de tokens |
| RNF02 | [#48](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/48) / CLOSED | Senha armazenada por hash, não em claro |
| RNF03 | [#49](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/49) / CLOSED | Rotas protegidas rejeitam acesso sem sessão |
| RNF04 | [#50](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/50) / OPEN | Papel, vínculo ativo e acesso por conteúdo |
| RNF05 | [#51](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/51) / CLOSED | Contratos REST e OpenAPI correspondentes |
| RNF06 | [#52](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/52) / OPEN | 360×800/768×1024/1366×768 e Android real |
| RNF07 | [#53](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/53) / CLOSED | Persistência relacional e vínculos |
| RNF08 | [#54](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/54) / OPEN | Storage dos anexos e restauração consistente |
| RNF09 | [#55](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/55) / OPEN | Entrega sem recarregar e reconexão |
| RNF10 | [#56](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/56) / OPEN | Regras críticas vinculadas a resultados de teste |
| RNF11 | [#57](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/57) / CLOSED | Limites efetivos, excesso e recuperação |
| RNF12 | [#58](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/58) / OPEN | Cabeçalhos/origens no ambiente local |
| RNF13 | [#59](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/59) / OPEN | Chrome/Edge/Firefox Windows e Chrome Android |
| RNF14 | [#60](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/60) / OPEN | Segredo cifrado e recuperação autorizada |
| RNF15 | [#138](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/138) / OPEN | 120 buscas, seis sessões, mínimo de 114 ≤ 2s |
| RNF16 | [#135](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/135), [#137](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/137) / OPEN | ZIP completo, pausa de gravações, chave original e recuperação em base descartável |
| RNF17 | [#45](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/45), [#55](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/55), [#95](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/95) / OPEN (escopo atualizado) | Até 5s em conexão ativa, fora da janela desconectada |

## Artefatos de teste existentes — candidatos, não resultados

| Grupo de requisitos | Arquivos existentes para conferir e adaptar |
|---|---|
| Conta, convite e senha | `server/src/test/java/com/vaulty/api/invite/InviteAndRegisterIntegrationTest.java`, `server/src/test/java/com/vaulty/api/service/CredentialServiceIntegrationTest.java` |
| Sessão e propagação de papel | `server/src/test/java/com/vaulty/api/auth/AccessTokenRoleClaimIntegrationTest.java`, `web/src/auth/session.integration.test.ts` |
| Workspace e membros | `server/src/test/java/com/vaulty/api/workspace/WorkspaceMemberIntegrationTest.java`, `server/src/test/java/com/vaulty/api/workspace/WorkspaceSingletonMigrationTest.java` |
| Pastas | `server/src/test/java/com/vaulty/api/workspace/WorkspaceCollectionIntegrationTest.java` |
| E-mail | `server/src/test/java/com/vaulty/api/service/EmailOutboxIntegrationTest.java` |
| Limitação de requisições | `server/src/test/java/com/vaulty/api/config/RateLimitRegistryTest.java` |

A presença dos arquivos não demonstra que cubram os novos critérios de grupos, compartilhamento, ocultação de segredos ou readmissão. Conferir cada teste e registrar evidências depois da implementação. Os métodos de desempenho e compatibilidade ainda não foram executados.

## Evidência necessária para declarar verificação

Para cada cenário executado, registrar requisito/critério, versão do código, ambiente, dados, resultado esperado/obtido, data e falhas. Uma captura isolada ou fechamento da issue não substitui o resultado dos cenários negativos.

## Situação de fechamento

O proponente aprovou os refinamentos L01–L09 e autorizou L10–L14. Isso permite preparar uma versão candidata para revisão da equipe; a aprovação dos demais integrantes, a priorização dos acréscimos e o encaixe até 27/11/2026 permanecem pendentes. Não foi publicada uma baseline do grupo. O backlog foi vinculado às tarefas abaixo; isso não aprova datas, não atribui pessoas e não declara os requisitos implementados.

Os detalhes de limites, pacote e automação foram aprovados em 12/10/2026 e estão em [DETALHES-TECNICOS.md](./DETALHES-TECNICOS.md). As evidências de teste continuam pendentes.

## Tarefas criadas/vinculadas em 12/10/2026

| Frente | Issues |
|---|---|
| Grupos | [#130](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/130), [#131](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/131) |
| Compartilhamento e herança | [#132](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/132), [#133](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/133) |
| Interface de busca | [#134](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/134) |
| Backup manual | [#135](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/135), [#136](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/136) |
| Verificação de restauração | [#137](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/137) |
| Desempenho da busca | [#138](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/138) |
| Recuperação de senha | [#139](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/139), [#140](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/140) |
| Readmissão | [#141](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/141), [#142](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/142) |
| Renomeação de papel | [#143](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/143) |
| Conferência da base concluída | [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144), [#145](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/145) |

A busca BE já tinha a issue [#129](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/129) e foi reutilizada. O fechamento histórico das issues antigas não é evidência dos critérios acrescentados; as tarefas de conferência registram o trabalho de adequação e verificação.
