# Times, papéis globais fixos e publicações recebidas

**Status:** implementado nas etapas 1–13; registrado em 05/11/2026
**Substitui:** somente as regras de autorização/compartilhamento do [ADR 0001](0001-workspace-unico-por-empresa.md) que pressupõem ACL por grupos, concessões e herança. A decisão de workspace único por empresa permanece vigente.

## Contexto

O modelo anteriormente documentado combinava papéis editáveis, grupos de acesso, concessões por pasta/item e herança. A implementação entregue passou a usar equipes (times) com uma coleção raiz, papéis globais fixos e publicações entre equipes. Manter os dois modelos como se ambos fossem atuais tornaria ambígua a regra de autorização.

## Decisão

- Cada workspace tem exatamente um Owner. Owner, Admin e Maintainer são globais e sem time. Só Owner atribui Admin/Maintainer e transfere a titularidade; ao transferir, o antigo Owner passa a Admin.
- Um membro comum pode estar sem time ou pertencer a um único time. Cada time tem uma coleção raiz e um Líder. A associação ao time concede acesso uniforme à coleção; convite aceito não concede acesso ao conteúdo.
- Não existem ACLs de grupo, concessões por pasta/item, herança configurável ou raiz pública. O acesso decorre do papel global ou do time/coleção associado.
- O Líder atual publica itens ou pastas para times destinatários. O backend mantém projeções recebidas somente leitura, cobertura do conteúdo publicado e relações internas com os originais. O nome do time e caminho original são capturados; nomes atuais do conteúdo são usados na apresentação.
- Revogar uma publicação remove a projeção do destinatário afetado. Excluir o original remove suas projeções. Excluir um time remove seus membros, mas preserva coleção, conteúdo e publicações; a coleção sem time fica acessível aos papéis globais até reassociação. A reassociação não reescreve metadados de origem capturados.
- As rotas legadas `/workspaces/{workspaceId}/groups` e os endpoints antigos de ACL, herança, concessões e origens em `/sharing` retornam HTTP 410 Gone.

## Consequências

A especificação e o modelo conceitual mantêm os requisitos anteriores como histórico de levantamento, mas identificam claramente os trechos superados. Não se deve inferir que a proposta anterior foi validada pela empresa. Esta decisão documenta o código presente no repositório e não certifica execução de testes backend nem CI.
