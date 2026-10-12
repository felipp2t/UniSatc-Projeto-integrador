# Modelo conceitual — Vaulty

Iniciado em 11/10/2026 e revisado em 12/10/2026 a partir das decisões desta sessão, da [especificação de requisitos](./REQUISITOS.md), do [contexto](../CONTEXT.md) e do [ADR do workspace único](./adr/0001-workspace-unico-por-empresa.md). Representa conceitos do domínio e suas relações; não define tabelas, APIs ou uma implementação pronta.

## Conceitos

| Conceito | Significado |
|---|---|
| Empresa | Organização atendida por uma instalação do Vaulty |
| Workspace | Espaço compartilhado único da empresa, que reúne membros, pastas e itens |
| Conta | Identidade de acesso preservada mesmo após a remoção do vínculo ao workspace |
| Membro | Pessoa com vínculo ativo ao workspace |
| Papel | Conjunto de permissões de ações atribuído ao membro |
| Permissão | Autorização para uma ação, como consulta, edição, Compartilhamento ou Gestão de grupos |
| Grupo de acesso | Conjunto de membros usado como público de compartilhamentos |
| Pasta | Agrupamento hierárquico de itens e subpastas |
| Item | Conteúdo do tipo texto, link, segredo ou documento |
| Compartilhamento | Concessão de acesso a uma pasta ou item para um grupo ou membro |
| Anexo | Arquivo único vinculado a um item do tipo documento |

O grupo pode representar “Equipe 1”, mas não substitui o papel. O TL aparece no cenário de uso descrito pelo proponente; não é responsável obrigatório pelo conteúdo. “Raiz” designa a localização no workspace sem pasta pai, não uma equipe ou responsável.

## Relações e cardinalidades

`1` significa exatamente um; `0..1`, nenhum ou um; `0..N`, nenhum ou vários. As relações expressam os extremos permitidos, não a quantidade de registros já existentes.

| Relação | Cardinalidade e interpretação | Base |
|---|---|---|
| Empresa / workspace | Uma instalação atende uma empresa com exatamente um workspace | ADR vigente |
| Workspace / membro | Cada membro pertence a um workspace; um workspace inicializado mantém ao menos um dono e pode ter vários membros | ADR vigente |
| Membro / papel | Cada membro tem um papel; um papel pode estar atribuído a `0..N` membros | Modelo atual preservado; múltiplos papéis não foram adotados |
| Papel / permissão | Um papel reúne `0..N` permissões; a mesma permissão pode constar em vários papéis | Gestão de permissões existente |
| Workspace / grupo | Cada grupo pertence ao workspace; o workspace pode ter `0..N` grupos | Compartilhamento acordado |
| Membro / grupo | Um membro participa de `0..N` grupos; um grupo reúne `0..N` membros | Decisão desta sessão |
| Pasta / pasta pai | Cada pasta tem `0..1` pasta pai; uma pasta pode ter `0..N` subpastas | Hierarquia existente |
| Item / pasta | Cada item fica em `0..1` pasta; uma pasta pode conter `0..N` itens. Sem pasta, o item fica na raiz | Modelo existente |
| Item do tipo documento / anexo | Cada documento possui exatamente um anexo | RN14 |
| Compartilhamento / alvo | Cada concessão tem exatamente um alvo: pasta ou item; um alvo pode ter `0..N` concessões locais | Decisão desta sessão |
| Compartilhamento / destinatário | Cada concessão tem exatamente um destinatário: grupo ou membro; um destinatário pode receber `0..N` concessões | Decisão desta sessão |

A raiz e a herança podem fornecer acesso mesmo sem concessões locais. Compartilhar um item não concede acesso à pasta nem aos outros itens dela. Cada grupo, membro e alvo envolvido pertence ao workspace da empresa.

## Gestão e proteção de papéis

Somente donos criam, editam ou excluem papéis e definem permissões nesta entrega. Um papel personalizado começa sem permissões; suas ações são escolhidas em um catálogo fixo. Nomes são únicos no workspace segundo RN05, e papéis com membros não podem ser excluídos.

Dono e Membro inicial são papéis protegidos contra renomeação, exclusão e alteração das permissões básicas. Um dono existente pode conceder o papel Dono a outro membro, preservando ao menos um dono. Alterações de papel ou de suas permissões têm prazo de até 15 minutos; mudanças de acesso por conteúdo e remoção do vínculo têm efeito na próxima requisição. Compartilhamento não amplia as ações permitidas pelo papel.

Criação, edição, exclusão, mudanças de permissões e atribuições são registradas no histórico, identificando quem as realizou. Os critérios estão em RF17–RF22, RF51, RN05/RN06 e RN17.

## Conta, remoção e readmissão

Uma conta pode permanecer sem vínculo ativo depois da remoção do membro. Remover exige dono, confirmação e preservação de ao menos um dono. A remoção impede acesso ao workspace na próxima requisição e renovação das sessões, retira grupos e concessões individuais e preserva conteúdo e autoria histórica.

O dono pode readmitir essa conta, reativando o vínculo com o papel inicial e acesso limitado. Papel anterior, grupos e concessões individuais não retornam automaticamente. A readmissão RF50 é distinta do convite de cadastro para quem não possui conta. Um token antigo não deve restaurar os acessos anteriores por causa da readmissão.

## Como decidir o acesso

Para um membro que não seja dono, uma operação precisa atender a duas condições:

1. O papel permite a ação solicitada.
2. O membro tem acesso ao conteúdo pela raiz, por herança, por uma concessão ao seu grupo ou por compartilhamento direto.

Os donos têm acesso global ao conteúdo. Isso não dispensa as regras da operação, como arquivar antes de excluir definitivamente ou respeitar o tamanho do anexo.

Compartilhamento controla o público; não concede automaticamente permissão para editar, excluir ou ler valores secretos. Gestão de grupos administra todos os grupos do workspace, inclusive os que dão acesso a conteúdo restrito.

## Herança

| Situação | Comportamento acordado |
|---|---|
| Pasta criada na raiz | Herda o público da raiz: todos os membros, conforme seus papéis |
| Subpasta com herança ativa | Recebe o acesso efetivo do pai, além de suas concessões locais |
| Interromper a herança | Copia as concessões atuais para uma lista própria, preservando os destinatários; deixa de acompanhar mudanças dos compartilhamentos do pai |
| Restringir após interromper | Ajustar a lista copiada; interromper sozinho não reduz o público |
| Reativar a herança | Volta a acompanhar o pai e preserva concessões locais como acessos adicionais |
| Item em uma pasta | Herda o acesso efetivo da pasta e pode receber concessões individuais adicionais |
| Remover uma concessão | Elimina apenas essa origem; outras origens continuam válidas |
| Alterar grupo ou acesso | A alteração deve produzir efeito na próxima requisição |

A cópia das concessões de um grupo não transforma seus integrantes em concessões individuais: alterações na composição desse grupo continuam influenciando o acesso. A concessão “todos os membros” é um público próprio, preservado na cópia sem expansão em uma lista fixa; para restringir o público, ela deve ser retirada.

## Cenário para revisão do modelo: duas equipes

- Ana pertence ao grupo Equipe 1; Bruno, ao grupo Equipe 2. Ambos têm papel que permite leitura de itens.
- “Desenvolvimento” é acessível a todos. As subpastas “Equipe 1” e “Equipe 2” interrompem a herança e têm suas listas ajustadas aos grupos correspondentes.
- “Documentação da API” fica em “Equipe 2” e é compartilhada diretamente com Ana.
- “Chave de produção”, também em “Equipe 2”, não é compartilhada com Ana.

| Tentativa | Resultado esperado |
|---|---|
| Ana consulta um item da Equipe 1 | Permitido, pela concessão ao grupo e pela permissão de leitura |
| Ana consulta “Documentação da API” | Permitido, pelo compartilhamento individual e pela permissão de leitura |
| Ana consulta outro documento não compartilhado da Equipe 2 | Negado |
| Ana lê um valor secreto sem a permissão correspondente no papel | Negado, mesmo que haja acesso ao item |
| Ana edita o documento com papel somente de leitura | Negado: compartilhamento não concede edição |
| Retirar a concessão individual de Ana, sem outra origem de acesso ao documento | Próxima requisição negada |
| Retirar a concessão individual de Ana quando ela também pertence à Equipe 2 | Acesso continua pela concessão ao grupo |
| Dono consulta uma pasta restrita | Permitido pelo acesso global |
| Membro com Compartilhamento tenta compartilhar conteúdo ao qual não tem acesso | Negado |
| Excluir grupo com membros ou concessões vinculadas | Negado |

Um item compartilhado individualmente dentro de uma pasta inacessível pode aparecer na busca e ser aberto diretamente. O resultado exibe título e tipo, mas omite o caminho da pasta restrita; o acesso ao item não libera a pasta ou seus demais itens. Esse caminho está descrito em UC05-A02, nos [casos de uso](./CASOS-DE-USO.md).

## Auditoria e avisos pessoais

O histórico de atividades registra data/hora, participante, ação e identificação do recurso, preservando a autoria e o nome histórico após exclusões. Não inclui senhas, valores secretos, tokens ou conteúdo completo de anexos. Não há edição ou exclusão pela interface ou API comum.

Consulta exige uma permissão própria, inicialmente dos donos e delegável por papel. Donos têm consulta global; eventos de conteúdo respeitam o acesso do leitor ao recurso. Nesta entrega, eventos administrativos e de recursos excluídos são exclusivos dos donos; leitores delegados recebem eventos de recursos existentes e atualmente acessíveis.

Notificações pertencem a seus destinatários, que podem consultá-las e marcá-las como lidas. Mudanças de papel, grupos e compartilhamento geram avisos sem valores secretos. Os avisos persistem independentemente da entrega em tempo real e são recuperados após reconexão; falha de entrega não desfaz a operação de origem. Retirar acesso não oferece um link que contorne a restrição atual.

Os requisitos e critérios estão em RF35–RF40. Registro de evento é distinto de notificação pessoal e de recuperação de versões de conteúdo.

## Refinamento aprovado em 12/10/2026

Grupos têm nomes únicos; listagem e renomeação exigem Gestão de grupos (RF52/RF53). Nesta entrega, configuração manual de compartilhamento usa pasta → grupo e item → membro. Segredos ficam completamente ocultos sem leitura de seu valor. Histórico de conteúdo excluído e de eventos administrativos é exclusivo dos donos.

Avisos de perda de acesso são genéricos, sem referências restritas; referências de avisos antigos respeitam o acesso atual. Não haverá expurgo automático de histórico ou notificações nesta entrega; as consultas usam paginação. Notificações em conexão ativa têm meta de 5 segundos, conforme RNF17.

A rejeição de título reservado pode revelar sua indisponibilidade, sem dados do item oculto. Cancelamento garantido termina na confirmação do envio, e perda de resposta exige verificar o resultado antes de repetir. Esses refinamentos substituem as ambiguidades correspondentes, sem declarar implementação.

## Acordos e pendências

Acordados: um papel por membro no modelo atual, múltiplos grupos, concessões por conteúdo, exceções individuais, herança configurável em pastas, acesso global dos donos, duas permissões administrativas distintas, exclusão protegida de grupos e vigência na próxima requisição.

As pendências de grupos, acesso, histórico, notificações e cronograma estão consolidadas em [REVISAO-REQUISITOS.md](./REVISAO-REQUISITOS.md). L01–L09 foram aprovados pelo proponente; L10–L14 são encaminhamentos autorizados cuja execução e evidências continuam registradas como pendentes quando aplicável.

Nenhum esquema físico ou endpoint novo é definido por este modelo. As decisões precisam ser validadas com a empresa e refletidas nas issues.
