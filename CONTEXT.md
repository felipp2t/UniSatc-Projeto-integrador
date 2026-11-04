# Vaulty — Conhecimento operacional

O Vaulty tem como problema central a dificuldade de encontrar e preservar informações operacionais confiáveis. Controle de acesso e rastreabilidade são condições para disponibilizar essas informações adequadamente.

## Concepção

**Problema definido pelo proponente:** desenvolvedores perdem tempo procurando chaves de API e documentação em conversas pessoais com outras pessoas; essas informações também podem ser necessárias a outros desenvolvedores.

**Solução proposta pelo representante do projeto:** centralizar essas informações em um local onde os usuários com a permissão necessária possam acessar o que precisam.

**Benefício esperado:** reduzir o tempo gasto na procura e facilitar o acesso compartilhado às informações operacionais. A forma de medir esse benefício ainda precisa ser definida.

**Critério de sucesso confirmado:** um desenvolvedor autorizado consegue encontrar no Vaulty a informação de que necessita sem precisar perguntar a outra pessoa onde ela está. Esse critério pressupõe que a informação esteja cadastrada e que o desenvolvedor tenha a permissão necessária; metas de tempo e o procedimento de avaliação ainda precisam ser definidos.

**Conteúdo compartilhado entre equipes:** a empresa possui duas equipes de desenvolvimento, além da infraestrutura, e uma equipe pode compartilhar informações com a outra. Não há responsável obrigatório por conteúdo. Usuários podem consultar, cadastrar, editar ou remover conteúdo conforme suas permissões. Esse esclarecimento substitui a decisão anterior de atribuir a responsabilidade de manutenção ao TL; não estabelece, por si só, cadastro de equipes ou permissões por equipe no sistema.

**Acesso por conteúdo acordado:** pastas podem ser compartilhadas com grupos de acesso, como “Equipe 1” e “Equipe 2”; os itens herdam o acesso da pasta. Exceções podem conceder acesso diretamente a um membro em um item, sem liberar a pasta ou os demais itens dela. O papel determina as ações permitidas e o compartilhamento determina o conteúdo acessível; ambos precisam permitir a operação. Essa modelagem utiliza grupos para o acesso habitual das equipes e concessões individuais para exceções, sem exigir múltiplos papéis por membro ou atribuir responsável ao conteúdo. A gestão, herança e o público da raiz estão acordados na especificação e no modelo. Os detalhes restantes estão na revisão de requisitos; a leitura inicial foi esclarecida no ADR e ainda precisa ser alinhada às issues.

**Tipos de conteúdo da primeira entrega:** links, documentos, segredos e textos atendem às informações que o projeto precisa centralizar inicialmente. Os detalhamentos acordados estão na especificação; vídeos ficam fora da entrega à banca.

**Localização de conteúdo na primeira entrega:** além de navegar pelas pastas, o usuário poderá pesquisar conteúdo pelo título, com resultados limitados ao conteúdo que tem permissão para consultar. Essa funcionalidade foi acordada na concepção e complementa o levantamento inicial, que não listava busca. Os critérios acordados estão na seção RF41 da especificação.

**Limite de escopo confirmado:** na primeira entrega, o Vaulty armazena e disponibiliza chaves de API existentes. A criação de chaves e a automação de solicitações de aprovação ficam fora dessa entrega e permanecem no processo da empresa.

**Prazo e objetivo de entrega:** entregar todo o projeto para a banca em 27 de novembro de 2026. Essa data obrigatória, informada pelo representante do projeto, substitui a meta aproximada anterior de 15 de dezembro. A viabilidade do conjunto frente à capacidade da equipe ainda precisa ser avaliada. A busca por título integra a etapa incremental 2 conforme o ajuste de plano acordado nesta sessão.

**Capacidade e disponibilidade relatadas:** quatro integrantes desenvolvem o projeto, dois no backend e dois no frontend. Todos trabalham e cursam a faculdade, concentrando o desenvolvimento aos sábados e domingos, sem estimativa confiável de horas semanais. A equipe utiliza inteligência artificial e relata maior rapidez na produção; não foi informado um ganho mensurável que permita utilizá-lo como garantia de cumprimento do prazo. A viabilidade de cronograma permanece em avaliação.

**Condição de avaliação pela banca:** segundo o representante do projeto, não são exigidos artefatos adicionais específicos; o grupo apresentará o que tiver desenvolvido. A ausência de funcionalidades consideradas muito importantes pode gerar desconto na avaliação. Não foi informada uma rubrica que identifique essas funcionalidades. O objetivo do grupo continua sendo entregar todo o projeto em 27 de novembro de 2026.

**Origem e levantamento dos requisitos:** o projeto é uma proposta elaborada pelo grupo. Os requisitos foram organizados a partir do cenário de uso descrito pelo proponente, do documento inicial, das issues e das decisões de refinamento desta sessão. O contato com um responsável da empresa tratou da assinatura necessária à continuidade do projeto; não houve entrevistas de levantamento nem confirmação ou aprovação dos requisitos pela infraestrutura. As decisões registradas como confirmadas representam acordos com o proponente do projeto, não validação externa.

**Fonte do levantamento e alinhamento:** [issues do projeto no GitHub](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues), consultadas em 2026-10-11. Os épicos [Empresa e membros (#2)](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/2) e [Papéis e permissões (#3)](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/3) contêm alinhamentos de domínio datados de 2026-09-23 que substituem critérios anteriores conflitantes. Esses registros documentam decisões do projeto e não constituem evidência de validação pela empresa.

**Ordem de entrega acordada:** o fluxo de cadastrar uma chave de API existente com criptografia, encontrá-la pela navegação ou busca por título e consultá-la com a permissão necessária foi antecipado para a etapa incremental 2 do plano de entregas local. Usuários sem autorização têm a consulta ao conteúdo bloqueada. Edição, arquivamento e demais operações continuam nas etapas seguintes. “Primeira entrega” nesta concepção refere-se ao produto inicialmente previsto para a banca; as entregas numeradas no plano são etapas incrementais desse produto.

## Especificação e rastreabilidade

O objetivo ON01, os requisitos de usuário RU01–RU06, os detalhamentos funcionais, as regras e seus critérios de aceite estão em [docs/REQUISITOS.md](./docs/REQUISITOS.md). Esse documento é a referência para os detalhes acordados nesta sessão; o plano de entregas local organiza sua execução. As cardinalidades, a herança e os cenários de acesso estão no [modelo conceitual](./docs/MODELO-CONCEITUAL.md). As decisões da revisão e os encaminhamentos técnicos pendentes estão na [revisão de requisitos](./docs/REVISAO-REQUISITOS.md).

## Contexto de uso e público prioritário

A primeira entrega tem como público prioritário os desenvolvedores de uma startup, incluindo aqueles que também exercem funções de DevOps.

### Cenário de uso descrito pelo proponente: obtenção de chave de API

Quando um desenvolvedor precisa de uma chave de API, solicita-a ao Team Leader (TL) e apresenta sua justificativa. O TL avalia o motivo e, se aprovar a solicitação, encaminha o pedido à equipe de infraestrutura. A infraestrutura retorna a chave ao TL, que a repassa ao desenvolvedor. Esse cenário contextualiza a proposta; não é apresentado como resultado de uma entrevista com a empresa.

## Linguagem

**Conhecimento operacional**:
Informações necessárias ao trabalho cotidiano da organização, como procedimentos, referências técnicas e informações de acesso.

**Desenvolvedor**:
Profissional da startup que desenvolve software e pode também exercer funções de DevOps.

**Team Leader (TL)**:
Líder da equipe que, no processo relatado, avalia a justificativa, aprova a solicitação de chave de API e intermedeia sua entrega.

**Equipe de infraestrutura**:
Equipe à qual o TL solicita a chave de API no processo atual relatado.

**Chave de API**:
Credencial utilizada para acessar uma API.

**Item**:
Unidade de conhecimento cadastrada no Vaulty como link, documento, segredo ou texto.

**Pasta**:
Agrupamento hierárquico de itens e subpastas dentro do workspace da empresa.

**Segredo**:
Item cujo conteúdo contém uma informação sigilosa, como uma chave de API, consultável com a permissão necessária.

**Documento**:
Item com um único arquivo anexado, que pode ser substituído por um usuário autorizado.

**Conta**:
Identidade de acesso que permanece existente mesmo após a remoção do vínculo ao workspace.

**Membro**:
Pessoa com vínculo ativo ao workspace.

**Papel**:
Conjunto de permissões que determina quais ações um membro pode executar.

**Grupo de acesso**:
Conjunto de membros usado para compartilhar o acesso a conteúdo, como o grupo “Equipe 1”.

**Compartilhamento**:
Concessão de acesso a uma pasta ou item para um grupo de acesso ou membro.

**Permissão de Compartilhamento**:
Permissão específica para gerenciar concessões de acesso a pastas e itens, distinta das permissões de consulta e edição.

**Permissão de Gestão de grupos**:
Permissão para criar grupos de acesso e incluir ou remover membros desses grupos, distinta de Compartilhamento.

**Atribuição de Gestão de grupos:** os donos recebem essa permissão inicialmente e podem concedê-la a outros papéis. Alterar a composição de um grupo altera o acesso dos membros ao conteúdo compartilhado com ele, mas essa permissão não autoriza alterar os compartilhamentos de pastas e itens.

**Alcance e rastreabilidade da Gestão de grupos:** a permissão administra todos os grupos de acesso do workspace, sem depender de acesso ao conteúdo compartilhado com cada grupo. Alterações nos grupos são registradas no histórico; delegar essa permissão concede confiança para administrar os grupos do workspace e sua composição.

**Exclusão de grupo de acesso:** um grupo só pode ser excluído por quem tem Gestão de grupos quando não tiver membros nem concessões de compartilhamento vinculadas. Se houver qualquer um desses vínculos, a exclusão é rejeitada; é necessário ajustar os vínculos antes de tentar novamente. Concessões locais copiadas ao interromper a herança também são vínculos de compartilhamento.

**Atribuição e alcance de Compartilhamento:** os donos recebem essa permissão inicialmente e podem concedê-la a outros papéis. A edição de conteúdo não concede automaticamente permissão de Compartilhamento. Para compartilhar uma pasta ou item, o membro precisa ter a permissão de Compartilhamento e já ter acesso ao conteúdo; a permissão não libera acesso a conteúdo restrito por si só.

**Acesso dos donos:** donos têm acesso global a todas as pastas e itens do workspace, incluindo conteúdo restrito, para administrar o espaço e seus compartilhamentos. Não precisam receber uma concessão individual para cada pasta ou item. Os demais membros dependem de acesso por grupo, concessão direta ou herança, além da permissão da ação.

**Herança entre pastas:** subpastas herdam o acesso da pasta pai por padrão. É possível interromper essa herança e definir um público próprio; as concessões herdadas da pasta pai deixam de liberar acesso à subpasta. Por exemplo, “Desenvolvimento” pode ser compartilhada com todos, enquanto “Equipe 1” e “Equipe 2” interrompem a herança e são compartilhadas com seus respectivos grupos. O acesso global dos donos continua aplicável, e os itens seguem o acesso efetivo de sua pasta, com as concessões individuais adicionais já acordadas.

**Alteração da herança:** interromper ou reativar a herança de uma pasta exige a permissão de Compartilhamento e acesso à pasta. A permissão de edição, por si só, não autoriza essa alteração.

**Interrupção da herança:** ao interromper a herança, o sistema copia as concessões atuais para uma lista própria da pasta, que pode ser ajustada por quem tem permissão de Compartilhamento e acesso à pasta. As concessões a grupos permanecem concessões a grupos, sem converter seus integrantes em concessões individuais. A pasta deixa de acompanhar alterações de compartilhamento da pasta pai; a participação nos grupos continua determinando o acesso pelas concessões copiadas. Interromper a herança não reduz automaticamente o público: a restrição exige ajustar a lista copiada.

**Reativação da herança:** reativar a herança volta a incluir o público atual da pasta pai e mantém as concessões locais como acessos adicionais. A partir dessa reativação, a pasta acompanha as mudanças de compartilhamento do pai. Uma concessão local preservada pode manter o acesso mesmo que uma concessão herdada seja retirada.

**Remoção de concessões e origens do acesso:** retirar uma concessão elimina apenas aquela origem de acesso; outras concessões aplicáveis, como participação em um grupo autorizado ou herança, continuam permitindo o acesso. A interface de compartilhamento deve mostrar de onde vem cada acesso. Por exemplo, retirar a concessão individual de Ana não retira seu acesso se ela continuar em um grupo autorizado. O acesso global dos donos continua aplicável.

**Vigência das alterações de acesso ao conteúdo:** mudanças na composição de grupos, nos compartilhamentos e na herança devem valer na próxima requisição, independentemente de renovação do token. Ao retirar uma origem de acesso, as demais origens continuam sendo consideradas. A decisão vigente de até 15 minutos para mudanças de papel é distinta e permanece aplicável; retirar um membro de um grupo não depende desse prazo. A revogação não recupera conteúdo já consultado ou baixado.

**Público inicial da raiz:** a raiz do workspace é acessível a todos os membros. Pastas diretamente na raiz herdam esse público por padrão e podem interromper a herança para restringir acesso. Itens na raiz seguem esse público; em todas as operações, o papel continua limitando as ações e a leitura do conteúdo de segredos. Acesso à raiz não libera pastas que interromperam a herança.

**Remoção e readmissão:** somente donos removem membros, com confirmação e sem remover o último dono. A conta e seu conteúdo são preservados, mas o vínculo deixa de permitir acesso na próxima requisição; grupos e concessões individuais são retirados. Um dono pode readmitir a conta com acesso inicial limitado, sem restaurar automaticamente papel ou acessos anteriores. Os critérios estão em RF15–RF17 e RF50 da especificação.

**Gestão de papéis:** inicialmente somente donos criam, editam ou excluem papéis e definem permissões a partir de um catálogo fixo. Papéis personalizados começam sem permissões; nomes são únicos no workspace. Dono e Membro inicial são protegidos contra renomeação, exclusão e alteração das permissões básicas. Papéis com membros não podem ser excluídos. Alterações e atribuições são registradas no histórico. Os critérios estão na especificação; essa definição não afirma implementação concluída.

**Histórico de atividades**:
Registro das ações relevantes e seus participantes, preservado após a exclusão de recursos e sujeito à permissão de consulta e à visibilidade do conteúdo.

**Notificação**:
Aviso pessoal persistido para informar ao destinatário uma mudança em seu acesso.

**Auditoria e avisos:** o histórico não inclui senhas, valores secretos, tokens ou conteúdo completo de anexos e não é editável ou excluível pela interface/API comum. Donos consultam globalmente; leitores delegados respeitam o acesso ao conteúdo. As notificações são pessoais e persistem mesmo se a entrega em tempo real falhar. Os critérios e as pendências estão em RF35–RF40.

**Refinamento aprovado em 12/10/2026:** L01–L09 foram aceitos pelo proponente, incluindo ocultação integral de segredos sem leitura do valor, grupos com nome único, matriz inicial pasta → grupo/item → membro, público “todos os membros”, recorte de histórico para donos, avisos sem referências restritas e cancelamento garantido somente antes do envio confirmado. L10–L14 autorizam completar documentação e preparar implementação/verificação, sem constituir evidências de execução. Os critérios estão na especificação e na revisão.

## Relações

- **Desenvolvedores** utilizam o **Conhecimento operacional** no trabalho cotidiano.
- O **Conhecimento operacional** pode ser compartilhado entre equipes, sem responsável obrigatório por conteúdo, respeitando as permissões de acesso e alteração.
- Um **Item** fica na raiz do workspace ou em uma **Pasta**; uma **Pasta** pode conter itens e subpastas.
- Um **Documento** possui exatamente um arquivo anexado.
- Um **Grupo de acesso** pode reunir vários membros, e um membro pode participar de vários grupos sem receber, por isso, outro **Papel**.
- Os itens herdam o **Compartilhamento** da pasta; o compartilhamento direto de um item concede acesso adicional sem liberar os demais itens ou a pasta.
- O **Papel** permite a ação e o **Compartilhamento** permite acesso ao conteúdo; a operação exige ambos.
- Uma subpasta herda o acesso da pasta pai por padrão, mas pode interromper a herança e definir seu próprio público, preservando o acesso global dos donos.
- No cenário descrito pelo proponente, o **Team Leader (TL)** avalia a justificativa do **Desenvolvedor** e encaminha à **Equipe de infraestrutura** as solicitações de **Chave de API** que aprova.
- O **Conhecimento operacional** precisa ser encontrado e preservado com confiabilidade.
- O acesso ao **Conhecimento operacional** depende de controle de acesso e rastreabilidade.

## Exemplo de diálogo

> **Desenvolvedor:** “Qual problema central o Vaulty deve resolver?”
> **Representante do projeto:** “A dificuldade de encontrar e preservar informações operacionais confiáveis.”

## Ambiguidades sinalizadas

- Problema central confirmado na concepção: encontrar e preservar informações operacionais confiáveis; controle de acesso e rastreabilidade são condições de disponibilização.
- Público prioritário confirmado: desenvolvedores, incluindo aqueles que exercem funções de DevOps na startup.
- A situação de procura por chaves foi descrita pelo proponente; critérios adicionais de confiabilidade e a medição do benefício ainda precisam ser definidos.
- Responsabilidade por conteúdo revista: não existe responsável obrigatório; a atribuição anteriormente sugerida ao TL foi substituída pelo esclarecimento sobre compartilhamento entre equipes.
- Equipes são representadas para fins de compartilhamento por **Grupos de acesso**, sem exigir cadastro da estrutura organizacional da empresa.
- Grupos, compartilhamentos e herança estão consolidados em RF42–RF47 e no modelo conceitual; detalhes pendentes e impactos no cronograma estão explicitados nesses documentos. A leitura inicial dos convidados foi esclarecida no ADR e ainda precisa ser alinhada às issues.
- Permissão de **Compartilhamento** confirmada: inicialmente atribuída aos donos e delegável a outros papéis; compartilhar exige essa permissão e acesso prévio ao conteúdo.
- Papel do TL esclarecido no cenário de uso: avaliar a justificativa, aprovar a solicitação e intermediar a entrega da chave.
- O fluxo de solicitação de chave é um cenário de uso; não implica que o Vaulty deva criar credenciais ou automatizar aprovações.
