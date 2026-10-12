# Revisão de consistência e lacunas — Vaulty

Revisão de 12/10/2026. Escopo: [especificação](./REQUISITOS.md), [casos de uso](./CASOS-DE-USO.md), [modelo conceitual](./MODELO-CONCEITUAL.md), [contexto](../CONTEXT.md), [plano](../PLANO-DE-ENTREGAS.md), [ADR](./adr/0001-workspace-unico-por-empresa.md), levantamento inicial e referências de IDs da documentação do backend. Não é auditoria de implementação nem comprovação de atendimento aos requisitos.

**Situação após avaliação em 12/10/2026:** o proponente aceitou todos os itens. L01–L09 são decisões aprovadas e incorporadas aos requisitos; L10–L14 são encaminhamentos autorizados, cuja execução continua pendente onde não houver resultado ou evidência. A aprovação do proponente não substitui a revisão dos demais integrantes nem a validação externa. As colunas abaixo preservam o texto avaliado como registro da proposta aceita.

## Correções realizadas nesta revisão

- Atualizada a convenção de IDs para RF41–RF51, RN11–RN17 e RNF15/RNF16; preservados os identificadores anteriores.
- Alinhados os IDs de conta/convites/perfil no README e na documentação da API à especificação. Pastas passaram a referenciar RF23/RF26/RF27, em vez de reutilizar RF11. Endpoints e código não foram alterados.
- Corrigidas afirmações desatualizadas de que raiz, herança e método do teste de busca ainda não estavam definidos. Os detalhes que continuam abertos são identificados abaixo.
- Separadas as regras de senha das regras de conteúdo.
- Explicitado no plano que exclusão definitiva exige arquivamento prévio, além de confirmação e autorização.
- Atualizado o retrato de progresso: #122, #28, #31, #32 e #70 estão fechadas. Isso não comprova as novas regras de acesso ou o percurso integrado completo.
- Mantido o backup manual, sem periodicidade, retenção ou guarda das cópias pelo Vaulty; vídeos, Apple/iPhone e Safari continuam fora da entrega.

## Decisões de negócio aprovadas — registro do texto avaliado

| ID / prioridade | Lacuna ou conflito | Recomendação proposta |
|---|---|---|
| L01 / Alta | Um título reservado por item oculto pode ser descoberto pela rejeição de duplicidade, embora RF41/UC05 ocultem sua existência | Manter a unicidade e uma mensagem genérica “Título indisponível nesta localização”, sem dados do item. Reconhecer explicitamente que isso revela disponibilidade do título; se nem essa inferência for aceitável, a regra de unicidade precisa ser revista. Não afirmar que só trocar a mensagem resolve as duas exigências |
| L02 / Alta | Membro inicial não lê valores secretos, mas não está definido se pode ver título/tipo/descrição desses itens. Compartilhar um segredo também não concede sua leitura pelo papel | Para a primeira entrega, ocultar integralmente itens secretos de quem não possui permissão de leitura de seu conteúdo, mesmo se houver concessão ao item. Isso simplifica busca, listagem e consulta, mas é uma proposta de restrição adicional a confirmar |
| L03 / Alta | Leitores delegados do histórico não têm regra operacional para eventos de recursos excluídos nem para eventos administrativos | Na primeira entrega, exibir eventos de conteúdo excluído e eventos administrativos somente aos donos. Para os demais leitores, mostrar eventos de recursos existentes e atualmente acessíveis. Essa escolha restringe o público sem exigir reconstruir permissões históricas; precisa de aprovação |
| L04 / Alta | Ainda não foi definida a matriz completa de destinatários de compartilhamento nem como copiar o público da raiz ao interromper herança | Manter inicialmente os cenários já acordados: pasta → grupo e item → membro. Representar “todos os membros” como público próprio, sem copiar uma lista fixa de pessoas. Ao interromper a herança, copiar essa concessão e exigir que ela seja retirada para tornar a pasta restrita |
| L05 / Média | Nome/renomeação de grupo, consulta de grupos e consulta de papéis/permissões ainda não têm critérios próprios | Exigir nomes únicos de grupos usando a mesma comparação dos papéis. Permitir listagem e renomeação a quem possui Gestão de grupos; limitar RF20/RF22 inicialmente aos donos. Novas operações de grupos precisam ser formalizadas antes de serem incluídas no compromisso |
| L06 / Alta | Avisos de retirada de acesso podem revelar títulos restritos; alterações coletivas ainda não têm destinatários e tratamento definidos | Notificar cada membro afetado pelo acesso efetivo, incluindo o efeito da herança. Para perda de acesso, usar aviso genérico sem título, caminho ou link restrito. Revalidar referências de notificações antigas antes da exibição. Mudanças nas permissões de um papel devem avisar seus membros, e não somente mudanças de atribuição |
| L07 / Média | Retenção e volume de histórico/notificações e prazo de entrega não estão definidos | Nesta entrega, não adicionar expurgo automático; usar paginação. Definir uma meta inicial de até 5 segundos para atualização em tempo real em conexão ativa, mantendo recuperação após reconexão. A meta de 5 segundos é proposta, não requisito aprovado |
| L08 / Média | Limites dos campos e regras completas de edição/consulta ainda estão dispersos; texto obrigatório não define conteúdo só em branco | Reutilizar limites existentes onde já há contrato; definir uma tabela por campo para o restante. Rejeitar texto só em branco e preservar Markdown. Formalizar autorização, resultado e falhas de edição/arquivamento/restauração, sem acrescentar movimentação de itens/pastas que não foi acordada |
| L09 / Alta | Cancelamento com envio iniciado e perda de resposta após salvar podem contrariar “nenhum item cadastrado” ou duplicar tentativas | Definir cancelamento garantido apenas antes da confirmação do envio; após confirmar, sair da tela não garante desfazer a operação. Quando o resultado da gravação for desconhecido, informar essa incerteza e verificar o cadastro antes de tentar de novo. Isso revisa o alcance amplo do cancelamento e precisa de aprovação |

## Detalhes de implementação e verificação — sem adicionar escopo automaticamente

| ID / prioridade | Pendência | Encaminhamento recomendado |
|---|---|---|
| L10 / Alta | Banco/anexos não bastam para recuperar segredos sem o material criptográfico; formato, consistência e restauração do backup estão abertos | Definir um pacote único com versão e inventário e documentar como fornecer o material criptográfico na recuperação. Escolher um procedimento que capture banco e anexos consistentemente e verificar a restauração em uma base descartável antes de declarar a cópia recuperável. Não incluir botão de restauração, agendamento ou armazenamento externo |
| L11 / Alta | Implementação atual e decisões novas têm diferença de alcance de autorização; execução local no Android precisa de configuração adequada | Conferir vínculo ativo em cada operação do workspace, concessões atuais em busca/listagem/download e impossibilidade de readmissão reativar tokens antigos. Preparar a execução local para navegador desktop e Android, registrando rede, origem e transporte que permitam o login. Não declarar que só ocultar botões ou conferir o token satisfaz essas regras |
| L12 / Média | Testes definidos ainda não têm base, ferramenta e evidências concretas; Full-Text Search não foi escolhido definitivamente | Fixar computador, aparelho, versões, condições de rede, usuários, títulos e resultados esperados. Executar as 120 buscas já acordadas e registrar todas as falhas. Avaliar a solução de busca contra palavras completas, acentos e múltiplas palavras sem presumir que qualquer configuração de Full-Text Search atende ao requisito |

## Trabalho documental e de gerenciamento

| ID / prioridade | Pendência | Encaminhamento recomendado |
|---|---|---|
| L13 / Alta | Nem todos os RF/RNF originais têm enunciado e critérios consolidados; o PDF e os UC01/UC03/UC04 continuam históricos | Completar os requisitos originais ainda referenciados somente por regras/fluxos, atualizar os três casos de uso e classificar o que é qualidade, restrição ou escolha técnica. Publicar a especificação revisada como referência atual, preservando o PDF inicial como fonte histórica |
| L14 / Alta | IDs ainda não têm matriz completa requisito → issue → teste; novos requisitos não estão todos no backlog; não há baseline e cronograma estimado | Vincular cada requisito às issues e evidências correspondentes, distinguir requisito confirmado de implementado/verificado, atribuir prioridade e versão e obter revisão do grupo. Criar uma baseline do grupo e registrar mudanças posteriores com motivo/impacto. Estimar os acréscimos antes de prometer a entrega integral em 27/11 |

## Cobertura do material original

O retrato anterior à aprovação confirmou 165 critérios de aceite com identificadores únicos na especificação atual. A quantidade não demonstra completude nem implementação.

Após aplicar a aprovação e L13, RF01–RF53 possuem enunciados consolidados, incluindo RF30 no grupo de documentos/anexos. Isso não significa que todos os limites de campo, interfaces ou evidências estejam concluídos.

RNF01–RNF14 receberam uma classificação entre qualidade, condições de verificação e restrições de solução; RNF15–RNF17 possuem metas e critérios próprios. Os contratos técnicos e os testes ainda precisam de evidências. Os limites restantes e os detalhes de backup/testes foram propostos e aprovados pelo proponente em 12/10/2026; estão na tabela da especificação e no contrato técnico.

A matriz [RASTREABILIDADE.md](./RASTREABILIDADE.md) liga RF01–RF53 e RNF01–RNF17 a issues existentes ou ao trabalho ainda a criar/vincular. Os arquivos de testes são apenas candidatos, sem resultados presumidos. UC01–UC05 estão consolidados em [CASOS-DE-USO.md](./CASOS-DE-USO.md). A gestão da versão candidata e das revisões está em [GESTAO-REQUISITOS.md](./GESTAO-REQUISITOS.md).

## Diferenças com o levantamento inicial a preservar na revisão

- Convites de cadastro somente para quem não tem conta; readmissão separada em RF50.
- Convite sem papel definitivo e ingresso com acesso inicial limitado.
- Acesso por conteúdo com grupos/herança além do papel; donos com acesso global.
- Alterações de papel/permissões em até 15 minutos; grupos/concessões/herança e remoção de membro com efeito na próxima requisição.
- Busca RF41, backup manual RF48, recuperação RF49 e renomeação de papel RF51 identificados explicitamente.
- Um anexo por documento, limite de 20 MB ainda a converter em bytes, formatos definidos e vídeos adiados.
- Exclusão definitiva somente após arquivamento, com confirmação.
- Desktop Windows com Chrome/Edge/Firefox e móvel Android/Chrome; Apple/iPhone/Safari fora da entrega.
- Origem como proposta do grupo, sem atribuir entrevistas ou aprovação de requisitos à empresa.

## Situação do GitHub e da revisão

Consulta de 12/10/2026: 106 issues, 74 abertas e nenhuma com milestone. As issues #122, #28, #31, #32 e #70 estão fechadas. Os números não estimam o esforço restante. O retrato acima foi obtido antes da atualização do backlog. A operação posterior está registrada em [ATUALIZACAO-BACKLOG.md](./ATUALIZACAO-BACKLOG.md); o histórico de fechamento foi preservado.

L01–L09 foram aprovados e incorporados; L10–L12 tratam de preparação técnica e verificação ainda a executar; L13/L14 organizam o fechamento documental e a revisão do grupo. Resolver as lacunas relevantes e revisar o conjunto com o grupo permite estabelecer uma baseline acadêmica. Validação externa com a empresa permanece uma atividade pendente, não uma aprovação presumida.

## Execução dos encaminhamentos autorizados

- **L10:** contrato e sequência de recuperação preparados em [RECUPERACAO-BACKUP.md](./RECUPERACAO-BACKUP.md); formato ZIP, pausa de gravações e chave fornecida por configuração foram aprovados; os comandos concretos e a implementação continuam pendentes. Nenhuma restauração foi executada ou comprovada.
- **L11:** regras documentadas; implementação de vínculos/concessões e configuração real Windows/Android ainda precisam de conferência.
- **L12:** método RNF15 acordado; base, ferramenta, equipamento e execução dos testes continuam pendentes.
- **L13:** enunciados RF01–RF53 consolidados, UC01/UC03/UC04 atualizados e classificação dos RNF originais registrada. Limites técnicos sem contrato e resultados de teste continuam pendentes, sem aprovação externa inventada.
- **L14:** matriz de rastreabilidade e registro de mudanças preparados. A atualização e os vínculos do GitHub estão registrados na matriz e no relatório de backlog; estimativa de esforço e revisão dos demais integrantes permanecem pendentes. A versão candidata não é uma baseline do grupo.

## Proposta para os detalhes ainda abertos

[DETALHES-TECNICOS.md](./DETALHES-TECNICOS.md) reúne limites de campos, arquivo de backup, consistência, recuperação e preparação dos testes. O conjunto foi aprovado pelo proponente em 12/10/2026 e incorporado à especificação; essa aprovação não indica implementação ou resultado de teste.
