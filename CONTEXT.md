# Vaulty — Conhecimento operacional

O Vaulty tem como problema central a dificuldade de encontrar e preservar informações operacionais confiáveis. Controle de acesso e rastreabilidade são condições para disponibilizar essas informações adequadamente.

## Concepção

**Problema definido pelo proponente:** desenvolvedores perdem tempo procurando chaves de API e documentação em conversas pessoais com outras pessoas; essas informações também podem ser necessárias a outros desenvolvedores.

**Solução proposta pelo representante do projeto:** centralizar essas informações em um local onde os usuários com a permissão necessária possam acessar o que precisam.

**Benefício esperado:** reduzir o tempo gasto na procura e facilitar o acesso compartilhado às informações operacionais. A forma de medir esse benefício ainda precisa ser definida.

**Critério de sucesso confirmado:** um desenvolvedor autorizado consegue encontrar no Vaulty a informação de que necessita sem precisar perguntar a outra pessoa onde ela está. Esse critério pressupõe que a informação esteja cadastrada e que o desenvolvedor tenha a permissão necessária; metas de tempo e o procedimento de avaliação ainda precisam ser definidos.

**Conteúdo compartilhado entre equipes:** a empresa possui duas equipes de desenvolvimento, além da infraestrutura, e uma equipe pode compartilhar informações com a outra. Não há responsável obrigatório por conteúdo. Usuários podem consultar, cadastrar, editar ou remover conteúdo conforme suas permissões. Esse esclarecimento substitui a decisão anterior de atribuir a responsabilidade de manutenção ao TL; não estabelece, por si só, cadastro de equipes ou permissões por equipe no sistema.

**Acesso ao conteúdo (modelo atualizado em 04/11/2026):** membros comuns pertencem a no máximo um time e têm acesso uniforme à coleção desse time; não existem concessões independentes por pasta ou item nem raiz pública. Owner, Admin e Maintainer são papéis globais sem participação em time, com os alcances definidos nesta página. Esse modelo substitui a decisão anterior de grupos ACL, concessões individuais e herança de permissões por pasta. Os documentos de requisitos e modelo conceitual já marcam esses trechos como históricos superados; veja também a ADR 0002.

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

O objetivo ON01, os requisitos de usuário RU01–RU06, os detalhamentos funcionais, as regras e seus critérios de aceite estão em [docs/REQUISITOS.md](./docs/REQUISITOS.md). A especificação preserva o levantamento e os critérios históricos, e sua seção inicial identifica o modelo atual implementado; os requisitos de autorização por pasta, herança, grupos ACL e raiz pública estão superados. O modelo e a revisão conceitual registram a mesma distinção. O plano de entregas local organiza a execução.

## Contexto de uso e público prioritário

A primeira entrega tem como público prioritário os desenvolvedores de uma startup, incluindo aqueles que também exercem funções de DevOps.

### Equipes e lideranças iniciais informadas pelo proponente

Cada equipe terá uma coleção principal e um Líder de coleção.

| Equipe | Líder |
|---|---|
| Financeiro | Marcelo Serpa |
| IOT | Andrew Senra |
| OsMangas | Matheus Silveira |
| DropTable_OsMangas | Rafael Augusto |
| Administração | Giovani Martings |

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

**Convite ao workspace**:
Convite por e-mail que cria o vínculo do usuário com o workspace, sem conceder acesso a coleções.

**Papel**:
Conjunto de permissões atribuído a um membro no escopo global do workspace ou de uma coleção.

**Papel global**:
Conjunto de permissões do membro no workspace, distinto dos papéis que recebe em coleções.

**Papel de coleção**:
Conjunto de permissões de um membro limitado a uma coleção específica.

**Membro do workspace**:
Pessoa que aceitou um convite ao workspace. Contas globais (Owner, Admin ou Maintainer) não pertencem a times; as demais podem ficar sem time até serem associadas a exatamente um.

**Membro de coleção (modelo fixo implementado)**:
Papel de coleção com leitura, criação, edição e exclusão de conteúdo em toda a coleção, sem administrar seus integrantes nem compartilhar conteúdo com outras equipes.

**Líder de coleção**:
Único membro que ocupa o papel de liderança de uma coleção; esse papel inclui todas as permissões de Membro, além de administrar os integrantes e compartilhar conteúdo com outras equipes. Owner e Admin também podem administrar membros dos times, e o Líder atual ou Owner/Admin transfere a liderança antes da remoção do Líder atual.

**Owner global (papel fixo implementado)**:
Papel global único por workspace, sem participação em time, que inclui todas as capacidades de Admin, com acesso a todo o conteúdo e segredos de todas as coleções, podendo criar, editar e excluir conteúdo, atribuir os papéis globais existentes e transferir a titularidade; as permissões dos papéis são fixas.

**Admin global (papel fixo implementado)**:
Papel global sem participação em time, com acesso a todo o conteúdo e segredos de todas as coleções, podendo criar, editar e excluir conteúdo; administra convites, membros dos times e criação ou exclusão de times e coleções, sem poder atribuir papéis globais ou transferir a titularidade.

**Maintainer global (papel fixo implementado)**:
Papel global sem participação em time, somente de leitura de todos os conteúdos e segredos em todas as coleções, sem permissão para criar, editar, excluir ou compartilhar conteúdo. Os papéis globais e de coleção têm permissões fixas, não personalizáveis.

**Conta de manutenção**:
Identidade global usada para manter o Vaulty, separada da conta empresarial usada pela mesma pessoa em uma equipe.

**Grupo de acesso (modelo anterior, superado)**:
Conjunto de membros usado como público de concessões ACL; esse mecanismo não participa da autorização implementada. A equipe atual é representada por um time associado a uma coleção raiz.

**Compartilhamento**:
Publicação por um Líder de coleção que cria uma cópia sincronizada do item na coleção de uma ou mais equipes destinatárias; cada equipe recebe uma única cópia por original, atualizações e renomeações do original sincronizam, o Líder atual da coleção pode revogar publicações anteriores, e Owner ou Admin pode revogar compartilhamentos de uma coleção sem time associado.

**Compartilhamentos recebidos (projeção implementada)**:
Pasta gerenciada dentro da coleção destinatária que organiza cópias sincronizadas e somente leitura pelo nome do time que as publicou e pelo caminho original capturado ao compartilhar; o nome do time é preservado mesmo após renomear ou excluir o time de origem ou reassociar sua coleção. A cópia mantém esse caminho em Compartilhamentos quando o original é movido dentro da coleção de origem. O destinatário não pode editar, remover, duplicar ou compartilhar novamente a cópia; a origem pode revogá-la apenas para aquele destinatário, sem afetar outros. Cópias são removidas quando a concessão termina ou o original é excluído.

**Permissão de Compartilhamento**:
Capacidade exclusiva do Líder de coleção de publicar itens ou pastas inteiras para outra equipe como cópias sincronizadas e somente leitura.

**Permissão de Gestão de grupos**:
Capacidade de Owner, Admin ou Líder de coleção para adicionar e remover membros de equipes; Owner e Admin podem administrar todas as equipes e o Líder administra a sua.

**Acesso uniforme à coleção:** todos os membros da coleção têm o mesmo escopo de acesso em todas as pastas e itens; o papel de coleção determina se podem ler, criar, editar ou excluir conteúdo. Não há permissões específicas por pasta ou item.

**Acesso à equipe:** cada equipe tem uma coleção principal, que pode estar associada a somente um time por vez; associação à equipe concede o papel Membro nessa coleção. Remover alguém revoga imediatamente todo o seu acesso, inclusive aos conteúdos que criou, que permanecem na coleção para os demais.

**Saída voluntária do time:** no escopo atual, Membros não podem sair do time por conta própria; Líder, Owner ou Admin administra sua remoção.

**Mudança de time:** ao mudar uma pessoa de time, o acesso à coleção anterior é revogado imediatamente e o acesso à nova coleção é concedido; o conteúdo criado permanece na coleção de origem.

**Coleções por equipe:** no escopo atual, cada equipe tem uma única coleção.

**Criação de equipe:** Owner ou Admin deve designar exatamente um Líder ao criar a equipe.

**Exclusão de equipe:** excluir uma equipe remove seus integrantes, mas preserva sua coleção, seu conteúdo e os compartilhamentos relacionados, que continuam sincronizados com a coleção.

**Coleção sem equipe:** a coleção preservada após a exclusão da equipe fica acessível apenas a Owner, Admin e Maintainer até ser associada a outra equipe; os antigos membros perdem acesso.

**Reassociação de coleção:** ao associar uma coleção preservada a outro time, seus integrantes recebem acesso uniforme a todo o conteúdo e aos compartilhamentos já existentes nela.

**Exclusão de coleção:** somente uma coleção sem equipe pode ser excluída diretamente; essa exclusão remove seu conteúdo e os compartilhamentos sincronizados relacionados.

**Compartilhamentos recebidos:** pastas e itens compartilhados aparecem em `Compartilhamentos/<equipe de origem>/<nome compartilhado>`, são sincronizados com a origem e somente leitura para a equipe destinatária. Cópias recebidas não podem ser compartilhadas novamente; revogar a publicação ou excluir o original remove a cópia.

**Acesso global:** Owner e Admin podem ler e criar, editar ou excluir conteúdo em todas as coleções, incluindo valores secretos; Maintainer pode ler tudo, mas não alterar conteúdo. A publicação de compartilhamentos continua exclusiva do Líder de coleção, com a exceção administrativa de revogação por Owner/Admin quando o time de origem foi excluído. Os demais membros só acessam coleções às quais pertencem, conforme o papel de coleção.

**Acesso inicial ao conteúdo:** ser membro do workspace não concede acesso a coleções. Membros sem associação a uma coleção não podem ver seu conteúdo; a associação à coleção define o acesso conforme o papel de coleção, enquanto Owner, Admin e Maintainer têm o alcance global definido para seus papéis.

**Convite aceito:** a pessoa passa a ser membro do workspace sem papel global e sem acesso a conteúdo; Membro é exclusivamente um papel de coleção.

**Atribuição de papel global:** somente Owner pode atribuir Admin ou Maintainer a um membro do workspace já convidado; tornar alguém Owner exige transferência da titularidade.

**Separação entre papéis globais e de time:** atribuir um papel global a um membro de time remove sua associação ao time na mesma operação; uma conta global não pertence a time.

**Remoção de papel global:** ao remover Admin ou Maintainer, Owner mantém a conta no workspace sem papel global e sem time; ela não acessa conteúdo até ser associada a um time.

**Transferência da titularidade:** existe exatamente um Owner por workspace; a titularidade deve ser transferida para outro membro antes de o Owner atual ser removido ou deixar de ocupar o papel.

**Sucessão do Owner:** ao transferir a titularidade, o Owner anterior passa automaticamente ao papel Admin.

**Gestão de papéis:** somente o Owner atribui os papéis globais fixos; as definições e permissões de Owner, Admin e Maintainer não são personalizáveis. Cada coleção também usa os papéis fixos Membro e Líder.

**Histórico de atividades**:
Registro das ações relevantes e seus participantes, preservado após a exclusão de recursos e sujeito à permissão de consulta e à visibilidade do conteúdo.

**Notificação**:
Aviso pessoal persistido para informar ao destinatário uma mudança em seu acesso.

**Auditoria e avisos:** o histórico não inclui senhas, valores secretos, tokens ou conteúdo completo de anexos e não é editável ou excluível pela interface/API comum. Donos consultam globalmente; leitores delegados respeitam o acesso ao conteúdo. As notificações são pessoais e persistem mesmo se a entrega em tempo real falhar. Os critérios e as pendências estão em RF35–RF40.

**Refinamento aprovado em 12/10/2026:** L01–L09 foram aceitos pelo proponente, incluindo regras de autorização e acesso por pasta que foram posteriormente substituídas em 04/11/2026 pelo modelo global e por coleção registrado nesta página. Os demais pontos daquele refinamento e L10–L14 continuam documentados na especificação e na revisão; a autorização para completar documentação e preparar implementação/verificação não constitui evidência de execução.

## Relações

- **Desenvolvedores** utilizam o **Conhecimento operacional** no trabalho cotidiano.
- O **Conhecimento operacional** pode ser compartilhado entre equipes, sem responsável obrigatório por conteúdo, respeitando as permissões de acesso e alteração.
- Uma **Coleção** pertence a uma equipe e contém pastas e itens; uma pasta pode conter itens e subpastas.
- Um **Documento** possui exatamente um arquivo anexado.
- Uma equipe corresponde a uma **Coleção principal**; cada membro comum pertence a no máximo uma equipe e recebe o papel Membro na coleção associada.
- Um **Membro do workspace** com papel global Owner, Admin ou Maintainer não pertence a time; os demais podem estar sem time até serem associados e pertencem a no máximo um time, recebendo o papel Membro na coleção correspondente. Cada coleção tem exatamente um Líder de coleção ativo; o Líder atual, Owner ou Admin pode administrar os membros do time e transferir a liderança antes da remoção do Líder atual.
- Remover um membro do time revoga imediatamente todo o acesso dele à coleção, inclusive aos itens que criou; o conteúdo permanece disponível para os demais membros da coleção.
- Compartilhar um item ou pasta entre equipes cria uma cópia sincronizada na coleção destinatária, em `Compartilhamentos/<equipe de origem>/<caminho original capturado>/<nome compartilhado>`; pastas incluem sua estrutura e conteúdo.
- Um mesmo compartilhamento pode ter várias equipes destinatárias, cada qual com sua cópia sincronizada independente.
- A cópia compartilhada é somente leitura para a equipe destinatária; alterações são feitas no original pela equipe de origem.
- Uma cópia recebida não pode ser compartilhada novamente; somente a equipe de origem pode publicar o original para outras equipes.
- Somente o **Líder de coleção** pode compartilhar itens com outras equipes.
- Revogar o compartilhamento ou excluir o original remove a cópia sincronizada da coleção destinatária.
- **Owner** ou **Admin** convida por e-mail ao workspace; após aceitar, o **Líder de coleção** pode adicionar esse membro existente à sua equipe e coleção.
- O papel de coleção concede o mesmo conjunto de permissões em todas as pastas e itens da coleção; não há ACLs específicas por pasta ou item.
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
- O modelo implementado representa equipes por **times** com coleção raiz e Líder; grupos de acesso pertencem ao modelo anterior, hoje retirado.
- **Modelo de autorização e compartilhamento implementado nas etapas 1–13:** decisões consolidadas nesta sessão: papéis globais fixos Owner, Admin e Maintainer são exclusivos e não pertencem a times; há exatamente um Owner, e somente ele atribui Admin/Maintainer ou transfere a titularidade, após o que passa a Admin; Owner inclui todas as capacidades de Admin, e ambos administram times, coleções, convites, membros e conteúdo globalmente; Maintainer só lê conteúdo e segredos; remover um papel global deixa a conta sem time e sem acesso até associação a um time; cada membro comum pertence a no máximo um time, recebe papel Membro, pode ler/criar/editar/excluir conteúdo de modo uniforme na coleção e não pode sair por conta própria; cada time tem uma coleção e exatamente um Líder, designado na criação, com todas as permissões de Membro e administração do time; remover ou transferir um membro revoga o acesso antigo imediatamente e mantém o conteúdo na coleção de origem; excluir um time remove integrantes, mas preserva coleção e compartilhamentos sincronizados, acessíveis apenas a papéis globais até reassociação; excluir coleção só é permitido sem time e remove conteúdo/cópias; Owner/Admin convidam ao workspace sem papel ou acesso inicial, e Owner atribui papéis globais depois do aceite; compartilhar é exclusivo do Líder e cria cópias independentes por destinatário, sincronizadas, somente leitura, não removíveis, duplicáveis ou republicáveis pelo destinatário, com nome de origem e caminho capturados, nome/conteúdo sincronizados, local estável e revogação independente por destino. O modelo substitui raiz pública, concessões por pasta/item e herança; os documentos de requisitos, modelo conceitual, revisão e ADR registram a substituição e preservam o levantamento anterior como histórico.
- Os critérios anteriores de grupos ACL, compartilhamentos por pasta/item e herança permanecem no levantamento como histórico e estão marcados como superados; não representam comportamento implementado.
- Permissão de **Compartilhamento** restrita ao Líder de coleção; não é concedida por editar conteúdo nem delegável a outros papéis de coleção.
- Papel do TL esclarecido no cenário de uso: avaliar a justificativa, aprovar a solicitação e intermediar a entrega da chave.
- O fluxo de solicitação de chave é um cenário de uso; não implica que o Vaulty deva criar credenciais ou automatizar aprovações.
