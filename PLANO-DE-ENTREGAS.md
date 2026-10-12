# Plano de entregas — Vaulty

Plano proposto em 08/10/2026, baseado nas issues abertas do repositório e nas decisões de domínio registradas nelas. Atualização de 12/10/2026: a entrega à banca é em **27/11/2026**. As cinco etapas são incrementais do mesmo projeto. Datas intermediárias e viabilidade dependem do progresso observado e da disponibilidade da equipe nos fins de semana.

Os requisitos e critérios acordados nesta sessão estão consolidados em [docs/REQUISITOS.md](./docs/REQUISITOS.md); a concepção e o vocabulário estão em [CONTEXT.md](./CONTEXT.md).

## Equipe e responsabilidades

| Pessoa | Responsabilidade principal | Dupla de integração |
|---|---|---|
| Back 1 | Empresa, convites, membros, papéis, sessão e autorização | Front 1 |
| Front 1 | Entrada, conta, gestão da empresa e permissões | Back 1 |
| Back 2 | Pastas, itens, arquivos e contratos de conteúdo | Front 2 |
| Front 2 | Navegação, conteúdo, upload e estados das telas | Back 2 |

As duplas podem trabalhar em paralelo. Back 1 define o contrato de autorização usado pelos dois módulos; Back 2 define os contratos de conteúdo. Front 1 concentra alterações compartilhadas de sessão e permissões; Front 2 concentra o navegador de pastas e itens.

## Premissas de domínio

- Cada instalação representa uma empresa e possui um único workspace, provisionado com o dono inicial. Não existe criação nem seleção de workspaces no uso normal.
- Pastas, itens, membros e papéis pertencem ao workspace por `workspace_id`.
- Uma pasta na raiz tem `parent_id = NULL`; um item na raiz tem `collection_id = NULL`. A raiz é representada pelo workspace.
- Inicialmente, somente donos enviam convites e atribuem papéis definitivos. O convite pede apenas e-mail e não carrega papel.
- Aceitar um convite cria a conta e o vínculo à empresa na mesma transação.
- O novo membro recebe leitura de pastas e itens acessíveis pela raiz ou por compartilhamento/herança, sem escrita e sem leitura de valores secretos até receber um papel definitivo. Pastas restritas não ficam automaticamente acessíveis.
- A empresa sempre mantém ao menos um dono. Somente um dono existente pode atribuir esse papel.
- Mudanças de papel podem levar até 15 minutos para refletir no token; cada renovação deve incluir as permissões atuais.
- A API aplica autorização por recurso e ação. Ocultar ações na interface é parte da experiência de uso.

Fontes: [épico #2](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/2), [épico #3](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/3), [#50](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/50) e [#68](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/68).

## Entrega 1 — Entrada na empresa e primeiras pastas

**Objetivo:** demonstrar dono acessando a empresa, convidando alguém, convidado criando a conta e navegando pelas pastas com acesso inicial limitado.

| Pessoa | Escopo | Issues |
|---|---|---|
| Back 1 | Garantir workspace único; conferir provisionamento do dono; adequar convite/cadastro ao vínculo com a empresa; restringir convite ao dono; implementar autorização necessária ao acesso inicial | [#122](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/122), alinhamento do épico #2 e início de #50 |
| Front 1 | Formulário de convite, cadastro pelo token, menu do usuário e logout | #74, #68, #70 |
| Back 2 | Criar/listar pastas e fornecer o caminho de navegação | #28, #31, #32 |
| Front 2 | Navegador, breadcrumb, criação de pastas e estados de loading, erro e vazio | #84, parte de #85 e #101 |

### Dependências

1. A #122 está fechada na consulta de 11/10/2026. Back 1 confere o provisionamento e a restrição de workspace único na integração e utiliza essa base nos demais fluxos.
2. Back 1 e Front 1 acordam validação do convite, cadastro, erros e resultado da sessão. Conferem o backend já existente para identificar ajustes necessários.
3. Back 1 define a representação do acesso inicial e a verificação de permissões antes da integração das rotas de pastas.
4. Back 2 e Front 2 acordam os contratos da raiz, subpastas e breadcrumb. A construção das telas pode avançar enquanto a API é implementada.

### Situação conferida em 12/10/2026

#122, #28, #31, #32 e #70 estão fechadas. Tratar workspace único, criação/listagem de pastas, breadcrumb e logout como base para conferência integrada, sem contar suas implementações como trabalho novo. Isso não comprova o atendimento às novas regras de nomes, compartilhamento e herança.

### Critérios de conclusão

- Instalação inicializada possui um workspace e um dono; reiniciar mantém seus identificadores.
- O banco rejeita um segundo workspace e a API não oferece criação pelo usuário.
- O dono envia convite; aceitar cria conta e vínculo na mesma transação.
- Convites inválidos, expirados, revogados ou já utilizados recebem tratamento adequado.
- O convidado consulta pastas acessíveis; tentativas de alteração são bloqueadas pela API. O isolamento por compartilhamento e herança é integrado na etapa 2.
- O dono cria pastas e subpastas, navega e volta pelo breadcrumb.
- Login e logout funcionam no percurso integrado.

## Entrega 2 — Gestão de acesso, conteúdo básico e chaves de API

**Objetivo:** permitir organizar textos e links e conceder permissões aos colaboradores; demonstrar que um desenvolvedor autorizado encontra e consulta uma chave de API existente sem perguntar a outra pessoa onde ela está.

| Pessoa | Escopo | Issues |
|---|---|---|
| Back 1 | Criar/listar papéis, definir/consultar permissões, atribuir papel ao membro e consolidar autorização | #23, #25, #26, #27, #22, #50 |
| Front 1 | Listar/criar papéis, editar permissões, atribuir papel e controlar ações disponíveis | #79, #80, #81, #78, #83 |
| Back 2 | Renomear/excluir pastas; criar e listar itens, começando por texto e link | #29, #30, parte de #33 e #39 |
| Front 2 | Concluir operações de pastas; listar/criar itens e visualizar texto/link | #85, #86, parte de #87 e #90 |

### Refinamento da gestão de papéis

Aplicar os critérios RF18–RF22 e RF51: administração inicialmente restrita aos donos, nome único conforme RN05, papel personalizado criado sem permissões, catálogo fixo de ações e proteção de Dono e Membro inicial contra renomeação, exclusão e alteração das permissões básicas. Registrar criação, edição, exclusão, mudanças de permissões e atribuições no histórico. Mudanças de permissões do papel respeitam os até 15 minutos já acordados; grupos e compartilhamentos continuam com efeito na próxima requisição.

RF51 identifica a renomeação já prevista em #80 e exige conferir e alinhar o trabalho do backend. A exclusão deve impedir papéis em uso e papéis iniciais, conforme RN06/RN17. RF20/RF22 são inicialmente restritos aos donos, conforme L05 aprovado. RF52/RF53 formalizam listagem e renomeação de grupos por Gestão de grupos, com nome único; incluir esses vínculos ao avaliar o esforço.

### Fluxo de chaves de API antecipado

Este fluxo passa da entrega 4 para a entrega 2, acompanhado de criptografia e autorização:

| Pessoa | Escopo adicional | Issues |
|---|---|---|
| Back 1 | Criptografia e autorização da criação e consulta de segredos | #60, #50 e parte de #33 |
| Front 1 | Visualização autorizada de segredo com revelar/copiar | Parte de #90 |
| Back 2 | Integrar segredos ao contrato de criação/listagem de itens; implementar busca por título respeitando permissões de consulta | Parte de #33/#39; busca: #129 (BE) / #134 (FE) |
| Front 2 | Criação de segredos no formulário por tipo; busca por título e apresentação dos resultados | Parte de #87; busca: #129 (BE) / #134 (FE) |

A busca é uma adição acordada nesta sessão, com critérios em RF41 e UC05, vinculada a #129 (BE) e #134 (FE). Essa adição, assim como os demais requisitos, é uma proposta do grupo ainda sem validação externa com a empresa. Back 2 coordena o contrato comum de itens com Back 1; Front 2 e Front 1 coordenam os componentes de criação e consulta.

### Ampliação de acesso — RF42–RF47

Decisões consolidadas em [docs/MODELO-CONCEITUAL.md](./docs/MODELO-CONCEITUAL.md) e [docs/REQUISITOS.md](./docs/REQUISITOS.md): grupos, compartilhamento por conteúdo, herança configurável e apresentação das origens de acesso. Constituem trabalho adicional; não estão cobertos apenas pela implementação original de papéis. Issues vinculadas: [#130](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/130), [#131](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/131), [#132](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/132), [#133](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/133). A estimativa e a viabilidade até 27/11 ainda precisam ser avaliadas.

| Pessoa | Responsabilidade proposta para o trabalho adicional |
|---|---|
| Back 1 | Gestão de grupos e permissões administrativas; contrato da avaliação de acesso efetivo |
| Front 1 | Gestão de grupos e compartilhamento, herança e origens de acesso |
| Back 2 | Aplicar o acesso efetivo às operações de pastas, itens, busca e anexos |
| Front 2 | Integrar resultados, navegação e acesso a itens compartilhados sem liberar outros conteúdos |

A distribuição acima é uma proposta operacional para encaixar o modelo na etapa 2, não uma estimativa de capacidade acordada. Antes de assumir datas, criar subtarefas e avaliar o esforço adicional. O mecanismo de acesso por conteúdo deve ser integrado antes de considerar concluída a separação entre Equipe 1 e Equipe 2. A entrega 1 usa o público inicial da raiz e a autorização básica; não comprova a conclusão desse isolamento.

Cenário de conclusão: Equipe 1 acessa sua pasta; Equipe 2 acessa a própria; um documento da Equipe 2 é compartilhado com um membro da Equipe 1; esse membro consegue consultá-lo, mas não os demais documentos. Remover a última origem de acesso impede a próxima requisição. Permissões de ação e de leitura de segredo continuam sendo verificadas.

### Dependências

- O contrato de permissões deve distinguir leitura de itens da leitura do conteúdo de segredos.
- Listar papéis e consultar permissões devem estar disponíveis antes de integrar o editor e a atribuição ao membro.
- Criação de papéis, configuração de permissões e atribuição devem formar um fluxo integrado.
- Texto e link usam contratos acordados entre Back 2 e Front 2, incluindo validação, nomes duplicados e erros de autorização.

### Critérios de conclusão

- Dono cria um papel, configura permissões e atribui ao membro.
- O membro executa somente as ações autorizadas; a renovação do token traz as permissões atuais.
- A proteção do último dono é aplicada nas alterações de papel.
- Usuários autorizados criam e consultam textos e links na raiz ou em uma pasta.
- Um usuário com permissão cadastra uma chave de API existente como segredo, com conteúdo cifrado na persistência.
- Um desenvolvedor autorizado encontra a chave pela navegação ou busca por título e consulta seu conteúdo sem perguntar onde ela está.
- A API bloqueia a consulta ao conteúdo da chave por usuários sem permissão, incluindo membros com acesso inicial limitado.
- A busca retorna somente conteúdo que o usuário tem permissão para consultar e não inclui valores de segredos nos resultados.
- A interface não mantém segredos em estado global nem os registra em logs.
- É possível renomear e excluir uma pasta vazia; excluir pasta com conteúdo é bloqueado.
- Loading, erro, vazio e acesso negado estão tratados nas telas entregues.

As issues #33, #87 e #90 permanecem abertas até a conclusão dos demais tipos comprometidos com a entrega. Vídeos ficam fora da entrega à banca, conforme revisão de escopo nesta sessão; esse ajuste ainda precisa ser refletido nas issues que os incluem. A implementação da #60 é antecipada para esta etapa; edição e demais operações sobre segredos são completadas na entrega 3.

## Entrega 3 — Ciclos completos de gestão

**Objetivo:** concluir manutenção da empresa e do conteúdo, incluindo edição, remoção e arquivamento.

| Pessoa | Escopo | Issues |
|---|---|---|
| Back 1 | Remover membros, excluir papéis sem membros e listar/revogar/recusar convites | #21, #24, #19, #18, #17 |
| Front 1 | Gestão de membros, exclusão de papéis, convites pendentes, recusa por link, perfil, senha e configurações da empresa | #77, #82, #75, #76, #71, #72, #73 |
| Back 2 | Editar, arquivar, restaurar e excluir itens definitivamente | #34, #36, #37, #38 |
| Front 2 | Edição, arquivamento/restauração/exclusão e filtros das listagens | #89, #91 e conclusão do escopo disponível de #86/#90 |

### Dependências e distribuição

- Front 1 pode antecipar perfil, senha e configurações enquanto aguarda APIs de convites, aproveitando os endpoints existentes.
- Se houver desequilíbrio de carga, Front 2 assume perfil e senha após concluir o fluxo de itens.
- Renomear papéis aparece no escopo da #80: conferir suporte no backend e registrar o trabalho faltante antes de integrar essa ação.
- Back 1 apoia Back 2 na edição de segredos para preservar a criptografia. Edição, arquivamento, restauração e exclusão atendem também aos segredos entregues na etapa 2.

### Refinamento da gestão de membros

RF15–RF17 detalham visibilidade de nome/papel, e-mail restrito à administração, confirmação de remoção, proteção do último dono e preservação de conteúdo e autoria. Remover exige negar o acesso ao workspace na próxima requisição e a renovação das sessões, retirando grupos e concessões individuais; esse efeito não aguarda os 15 minutos admitidos para mudanças de papel.

RF50 acrescenta readmissão pelo dono, preservando a conta e reativando o vínculo com acesso inicial limitado, sem restaurar automaticamente papel anterior, grupos ou concessões. Esse trabalho adicional está em [#141](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/141), [#142](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/142) e ainda precisa de estimativa antes de confirmar sua execução nesta etapa. Back 1 e Front 1 são os responsáveis propostos pela integração desse fluxo, dentro da divisão existente.

### Critérios de conclusão

- Remover ou rebaixar um dono só é permitido se outro permanecer.
- Papéis em uso não podem ser excluídos.
- Convites podem ser consultados, revogados e recusados; recusa por token funciona sem sessão.
- Perfil, troca de senha e edição dos dados da empresa funcionam com as permissões aplicáveis.
- Edição mantém o tipo do item; arquivamento e restauração atualizam a listagem.
- Exclusão definitiva exige item arquivado, confirmação explícita e autorização, conforme RN13 e RF33.

## Entrega 4 — Arquivos e histórico

**Objetivo:** completar os tipos de conteúdo e tornar as ações relevantes rastreáveis.

| Pessoa | Escopo | Issues |
|---|---|---|
| Back 1 | Auditoria e consulta de histórico; conferir rastreabilidade das operações de segredos | #40 e #41 |
| Front 1 | Histórico e integração da consulta de atividades | #92 |
| Back 2 | Storage compatível com S3, anexos e ciclo de arquivos/mídia | #54, #35 e conclusão dos tipos correspondentes em #33/#34/#38 |
| Front 2 | Upload, visualização de arquivos/mídia e conclusão dos formulários por tipo | #88 e conclusão de #87/#90 |

### Dependências

- Antecipar a estrutura da #40 após estabilizar a autorização. Cada pessoa de backend adiciona os registros das ações do próprio módulo durante sua implementação.
- Back 1 define o contrato de auditoria; Back 2 o utiliza em pastas, itens e arquivos.
- Segredos são entregues na etapa 2 e têm seu ciclo de manutenção completado na etapa 3; conferir sua integração ao histórico sem registrar seus valores.
- Back 2 e Front 2 acordam upload, limites, erros, metadados e obtenção do arquivo antes de integrar a tela.

### Critérios de conclusão

- Arquivos e mídia podem ser enviados, consultados e removidos conforme suas permissões.
- Conteúdo de segredo fica cifrado na persistência e não é retornado a usuários sem autorização.
- A interface não mantém segredos em estado global nem os registra em logs.
- O histórico registra ações relevantes e mantém os nomes gravados mesmo após exclusão dos recursos.
- Consulta de histórico oferece filtros e paginação previstos na #92.
- Todos os tipos comprometidos com a entrega estão concluídos: texto, link, segredo e documentos/arquivos, incluindo imagens. Vídeos ficam adiados e não integram esse critério de conclusão; atualizar as issues correspondentes para refletir o recorte.

### Critérios refinados de auditoria

Aplicar RF35/RF36: registrar os eventos acordados de conteúdo, acesso, convites e geração de backup; preservar identificação histórica; excluir valores secretos, senhas, tokens e conteúdo completo dos anexos. Consulta exige permissão própria, inicialmente dos donos e delegável por papel. Usar filtros por período, pessoa, ação e recurso, com paginação e ordem decrescente.

Donos consultam o histórico global. Outros leitores autorizados só recebem eventos de conteúdo acessível; recursos excluídos não se tornam públicos. O recorte aprovado em L03 exibe eventos de recursos excluídos e eventos administrativos apenas aos donos; implementar essa condição antes de concluir o histórico.

## Entrega 5 — Notificações e conclusão da qualidade

**Objetivo:** entregar comunicação de eventos, atualização em tempo real e verificação dos percursos completos.

| Pessoa | Escopo | Issues |
|---|---|---|
| Back 1 | Gerar, consultar e marcar notificações como lidas | #42, #43, #44 |
| Front 1 | Centro de notificações, leitura e toast de nova notificação | #93, #94, #96 |
| Back 2 | Entrega em tempo real e conclusão das pendências de cabeçalhos/CORS e testes críticos | #45, #55, #58, #56 |
| Front 2 | Cliente WebSocket e conclusão da responsividade, compatibilidade e estados globais | #95, #102/#52, #103/#59, #101 |

### Dependências

- Concluir persistência e consulta HTTP de notificações antes de integrar entrega por WebSocket.
- Definir eventos e formato das mensagens entre as quatro pessoas.
- Reconexão e revalidação HTTP devem recuperar notificações após perda de conexão.
- #45 e #55, #102 e #52, #103 e #59 têm escopos relacionados: compartilhar critérios e evidências de conclusão, evitando trabalho duplicado.

### Critérios de conclusão

- Notificações persistem, são consultáveis e podem ser marcadas como lidas.
- Eventos recebidos atualizam lista e badge sem recarregar a página.
- Reconexão e recuperação após perda de conexão funcionam.
- Percursos principais funcionam nos navegadores e tamanhos de tela previstos.
- A matriz acordada é Chrome, Edge e Firefox no Windows, além de Chrome em celular Android real. Aplicar os percursos e larguras definidos em RNF06/RNF13 e registrar as versões usadas. Apple/iPhone e Safari ficam fora desta entrega; atualizar as issues de compatibilidade para refletir esse recorte.
- Regras críticas de autorização, convites, último dono e persistência têm cobertura adequada.

### Critérios refinados de notificações

Aplicar RF37–RF40: avisos pessoais de mudanças de papel, grupos e compartilhamento, sem valores secretos; consulta e marcação de leitura restritas ao destinatário. Persistir os avisos e recuperá-los após reconexão. Falha de entrega em tempo real não desfaz a operação de origem e o aviso permanece consultável. Avisos de retirada de acesso não oferecem links que permitam consultar o conteúdo restrito.

O recorte aprovado não inclui expurgo automático; usar paginação e aplicar RNF17 (até 5 segundos em conexão ativa). Avisar membros afetados pelo acesso efetivo, incluindo herança e mudanças nas permissões de papéis; avisos de perda de acesso e referências antigas não revelam conteúdo restrito. Agregação e mecanismos de entrega ainda precisam de detalhe técnico. Compartilhar os critérios entre as issues relacionadas e considerar a dependência dos novos grupos e compartilhamentos na estimativa.

## Qualidade durante todas as entregas

### Backup manual — escopo adicional a planejar

RF48 e RNF16 definem um botão de geração manual, restrito aos donos, que entrega um único arquivo para download reunindo banco e anexos com vínculos consistentes. Falhas na geração não apresentam cópia incompleta como válida e permitem nova tentativa. O usuário decide onde guardar o arquivo; o Vaulty não agenda cópias nem administra frequência, retenção ou armazenamento. A recuperação usa procedimento técnico documentado, sem botão de restauração na interface nesta entrega.

A funcionalidade está em [#135](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/135), [#136](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/136), com recuperação/verificação em [#137](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/137). Estimativa e etapa de execução ainda precisam ser atribuídas. Avaliar o esforço e encaixe no prazo antes de distribuí-la à equipe; o formato ZIP, a pausa de gravações e a chave original por configuração foram aprovados no contrato técnico; implementar e verificar os passos concretos de recuperação permanece pendente.

### Critérios transversais

Responsividade, estados de interface, autorização e testes críticos acompanham cada funcionalidade. A entrega 5 conclui a cobertura do conjunto.

- Tratar loading, erro, vazio e acesso negado em cada tela.
- Aplicar validação e autorização no backend em cada operação.
- Cobrir regras críticas com testes junto de sua implementação.
- Conferir comportamento em desktop e mobile durante a integração.
- Atualizar OpenAPI e tipos gerados quando os contratos mudarem.
- Manter instruções de execução e configuração compatíveis com a entrega.

## Organização do trabalho no GitHub

1. Criar um milestone por entrega e distribuir as issues conforme este plano. Na consulta de 08/10/2026, as issues abertas não tinham milestone.
2. Manter uma issue principal em execução por pessoa e ordenar as próximas por dependência.
3. Definir contrato da API antes de implementar cada fluxo: campos, respostas, erros e permissões.
4. Dividir issues amplas em subtarefas para representar entregas parciais. Fechar a issue original somente quando todos os critérios forem atendidos.
5. Registrar lacunas da implementação atual como tarefas explícitas, principalmente adequação de convites/cadastro ao workspace único.
6. Integrar PRs pequenos ao longo da etapa, com revisão da outra pessoa da mesma especialidade.
7. Encerrar cada entrega com uma demonstração integrada usando usuários com permissões diferentes.

## Próximos marcos integrados

**Meta principal:** concluir a entrega 1.

**Avanço seguinte:** entregar textos, links e o fluxo de cadastro, localização e consulta autorizada de chaves de API da entrega 2, após estabilizar autorização e navegação de pastas.

O percurso demonstrado deve incluir: dono acessa → convida → convidado cria a conta → entra na empresa → navega por pastas → tem escrita bloqueada → encerra a sessão. O marco seguinte demonstra: usuário autorizado cadastra uma chave → desenvolvedor com permissão encontra e consulta a chave → usuário sem permissão tem a consulta bloqueada.

O prazo da banca é 27/11/2026. A equipe tem quatro integrantes, dois por frente, com trabalho concentrado aos sábados e domingos e sem estimativa confiável de horas semanais. Recomenda-se definir metas intermediárias pelo progresso observado e reservar o último fim de semana antes da banca para estabilização e preparação da apresentação; esse cronograma ainda precisa ser acordado.

Na consulta de 11/10/2026, #122, #70 e #72 estão fechadas: conferir seus fluxos na integração sem contabilizar sua implementação como trabalho novo. As issues consultadas continuam sem milestone. Uma issue fechada, por si só, não comprova a conclusão do percurso integrado.

## Revisão e fechamento dos requisitos

Consultar [docs/REVISAO-REQUISITOS.md](./docs/REVISAO-REQUISITOS.md) para o registro da revisão aprovada pelo proponente. L01–L09 já definem o comportamento; L10–L14 autorizam os encaminhamentos e ainda exigem execução e evidências. A aprovação não comprova o encaixe do trabalho adicional no prazo. Estimar os novos requisitos e reavaliar prioridades antes de assumir que todo o escopo cabe em 27/11.

Na consulta de 12/10/2026, foram encontradas 106 issues, 74 abertas e nenhuma com milestone. Os números são um retrato de organização do backlog, não uma medida de esforço ou de percentual de implementação.

## Artefatos preparados após a aprovação da revisão

- [Rastreabilidade](./docs/RASTREABILIDADE.md): vínculos de RF01–RF53/RNF01–RNF17 com o backlog e cenários candidatos.
- [Gestão de requisitos](./docs/GESTAO-REQUISITOS.md): versão candidata 0.2 e registro das mudanças, com revisão dos demais integrantes ainda pendente.
- [Recuperação de backup](./docs/RECUPERACAO-BACKUP.md): contrato e sequência técnica a operacionalizar, sem restauração já comprovada.

RF52/RF53 acrescentam listagem e renomeação de grupos e RNF17 define até 5 segundos para avisos em conexão ativa. Incluir esses vínculos e suas verificações na estimativa de grupos/notificações; a aprovação do comportamento não garante capacidade até 27/11.

## Detalhes técnicos aprovados

Aplicar [docs/DETALHES-TECNICOS.md](./docs/DETALHES-TECNICOS.md): limites dos campos, anexos de até 20.000.000 bytes, pacote ZIP completo, geração única com gravações pausadas e consultas disponíveis, chave original pela configuração sem inclusão em claro no ZIP. Liberar a pausa também em falha.

Preparar Playwright com seis contextos isolados para o RNF15, preservando as 120 medições e a apuração aprovadas. Usar as dimensões 360×800, 768×1024 e 1366×768 e Android real. Preparar origem HTTPS local acessível ao Windows/Android, registrando hardware e versões reais; esses valores e os resultados não são presumidos pela aprovação.

## Backlog vinculado ao refinamento

Consultar a [matriz atualizada](./docs/RASTREABILIDADE.md) para todos os requisitos e tarefas. As novas frentes têm issues separadas para backend/interface e acompanhamento de verificação. Busca BE reutiliza #129. Desempenho RNF15 está em [#138](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/138); a conferência da base historicamente concluída está em [#144](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/144), [#145](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/145). A criação de issues não constitui estimativa de esforço nem confirmação de entrega até 27/11.
