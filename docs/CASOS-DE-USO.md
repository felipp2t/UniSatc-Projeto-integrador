# Casos de uso — Vaulty

Versão de trabalho iniciada em 12/10/2026. Complementa a [especificação](./REQUISITOS.md) e o [modelo conceitual](./MODELO-CONCEITUAL.md). UC01–UC04 são os identificadores do levantamento inicial; UC05 acrescenta o fluxo central de localização e consulta. Os casos de uso ainda estão em refinamento com o proponente do projeto, sem validação externa pela empresa.

## UC01 — Aceitar convite e ingressar no workspace

**Situação:** consolidado em 12/10/2026 a partir de RF01/RF10/RF11 e decisões já aprovadas; sem validação externa presumida.

| Campo | Descrição |
|---|---|
| Ator principal | Convidado sem conta |
| Pré-condições | Link de convite válido e pendente, associado ao e-mail do destinatário |
| Pós-condições | Conta e vínculo criados, convite consumido e sessão iniciada com acesso inicial limitado |
| Vínculos | RU06, RF01, RF10, RF11, RN07/RN08 e regras de senha |

1. O convidado abre o link.
2. O sistema confere validade e disponibilidade do convite.
3. O convidado informa nome, senha e confirmação, mantendo o e-mail do convite.
4. O sistema valida os dados, cria conta e vínculo ao workspace único e consome o convite na mesma operação consistente.
5. O sistema registra o aceite e inicia a sessão com o papel inicial, sem escrita e sem acesso aos itens secretos, conforme RN19.

**Exceções:** convite inválido, expirado, revogado, recusado, substituído ou já usado impede cadastro; solicitar novo ao dono. Dados inválidos ou confirmação divergente impedem conclusão e permitem correção. Conta existente não usa esse fluxo; readmissão é RF50. Se o convidado optar por recusar, RF12 não cria conta e impede uso posterior daquele convite.

## UC02 — Cadastrar item de conhecimento

**Situação:** fluxo principal, alternativa A01 e exceções E01–E05 confirmados pelo proponente em 12/10/2026, reutilizando o identificador UC02 do levantamento inicial e os critérios por tipo já acordados. As revisões L01/L09 aprovadas em 12/10/2026 estão incorporadas abaixo.

| Campo | Descrição |
|---|---|
| Ator principal | Membro autorizado a cadastrar itens |
| Objetivo | Disponibilizar informação operacional no conteúdo compartilhado |
| Pré-condições | Membro autenticado, com permissão de criação e acesso à localização escolhida |
| Pós-condições de sucesso | Item ativo cadastrado na localização escolhida, consultável por usuários autorizados, com criação registrada no histórico sem valor secreto |
| Requisitos relacionados | RU02, RF28, RF30, RF35; acesso por conteúdo conforme RF45/RF46 |

### Fluxo principal confirmado

1. O membro escolhe a raiz ou uma pasta acessível e inicia o cadastro.
2. O membro seleciona o tipo: texto, link, segredo ou documento.
3. O membro preenche os dados do tipo escolhido; para documento, anexa um único arquivo.
4. Ao confirmar, o sistema confere a autorização atual e valida os dados conforme os critérios do tipo, incluindo a regra de título único na localização.
5. O sistema cadastra o item ativo na localização escolhida. Para segredo, cifra o valor preservando-o exatamente; para documento, armazena o único anexo conforme os formatos e o limite acordados.
6. O sistema registra a criação no histórico, sem incluir valores secretos, informa a conclusão e disponibiliza o item para consulta por usuários autorizados. O item segue o acesso da localização; o cadastro não concede acesso automaticamente a outras pessoas.

### Critérios por tipo

O fluxo referencia, sem duplicar, os critérios da [especificação](./REQUISITOS.md): RF28-SEG-CA01–CA10, RF28-LINK-CA01–CA06, RF28-TXT-CA01–CA05 e DOC-CA01/CA02/CA07/CA08. As regras RN11 e RN14 tratam da unicidade do título e do arquivo único.

### E01 — Dados inválidos ou título duplicado

**Situação:** confirmada pelo proponente em 12/10/2026.

1. Ao validar a confirmação, o sistema identifica dados inválidos ou título duplicado na localização escolhida, inclusive quando o título pertence a um item arquivado.
2. O item não é cadastrado. O sistema indica os campos que precisam de correção e permite nova tentativa.
3. Se a duplicidade envolver um item inacessível ao membro, a mensagem não revela dados desse item, como título original, tipo, conteúdo, estado ou autor.

Conforme RN20, usar “Título indisponível nesta localização”, sem dados do item oculto. O proponente aceitou em L01 a inferência de que o título está reservado; a ocultação em busca/listagem permanece obrigatória.

### E02 — Acesso à localização retirado durante o cadastro

**Situação:** confirmada pelo proponente em 12/10/2026.

1. O membro tinha acesso à localização ao iniciar o cadastro.
2. Durante o preenchimento, uma mudança retira a última origem de acesso à localização.
3. Ao confirmar, o sistema confere novamente a autorização, não salva o item e informa “Não foi possível cadastrar nesta localização”.

A verificação na confirmação não substitui o controle de acesso na seleção inicial da localização.

### E03 — Anexo inválido ou falha no envio

**Situação:** confirmada pelo proponente em 12/10/2026.

1. O arquivo enviado tem formato não aceito, ultrapassa 20 MB ou não pode ser enviado por falha.
2. O cadastro do documento não é concluído. O sistema informa o problema e permite selecionar outro arquivo ou tentar novamente.
3. Um documento sem o anexo exigido não é disponibilizado como cadastro concluído.

Os formatos e o limite seguem DOC-CA07/CA08. A limpeza de eventuais arquivos temporários é um detalhe técnico ainda não especificado.

### A01 — Cancelar o cadastro

**Situação:** confirmada pelo proponente em 12/10/2026.

1. O membro cancela antes de confirmar o envio do cadastro.
2. Nenhum item fica cadastrado ou disponível para consulta em decorrência desse cadastro cancelado.

Após confirmar o envio, sair da tela não garante desfazer a operação; o alcance do cancelamento foi revisado pelo proponente em L09, conforme RN21.

### E04 — Falha ao salvar o item

**Situação:** confirmada pelo proponente em 12/10/2026, aplicável a texto, link, segredo e documento.

1. Uma falha impede salvar o item.
2. O sistema informa que o cadastro não foi concluído e permite nova tentativa, sem exibir sucesso nem expor valores secretos nas mensagens.

Para segredos, essa exceção também aplica RF28-SEG-CA10. Ela descreve uma falha que impede a gravação; se houver perda da resposta e resultado desconhecido, aplicar E05/RN21, sem afirmar incorretamente que o item não foi salvo.

### E05 — Resultado da gravação desconhecido

Se houver perda da resposta e não for possível determinar se o cadastro foi concluído, informar essa incerteza e verificar o cadastro antes de repetir. Não apresentar sucesso nem afirmar que a gravação falhou sem evidência. O mecanismo concreto de verificação ainda precisa ser implementado; a condição foi aprovada em L09.

## UC03 — Definir permissões de um papel

**Situação:** consolidado em 12/10/2026 a partir de RF20–RF22 e regras de papéis aprovadas.

| Campo | Descrição |
|---|---|
| Ator principal | Dono |
| Pré-condições | Dono autenticado e ativo, papel existente no workspace |
| Pós-condições | Conjunto de permissões atualizado e evento registrado |
| Vínculos | RU03, RF20, RF21, RF22, RN17 |

1. O dono consulta os papéis e seleciona um papel personalizado.
2. Consulta o conjunto atual e escolhe ações disponíveis no catálogo fixo.
3. O sistema valida autorização, catálogo e proteção dos papéis iniciais.
4. Atualiza o conjunto e registra quem realizou a alteração.
5. As permissões atuais são incluídas nos tokens renovados, com vigência em até 15 minutos; grupos/concessões não mudam por essa operação.

**Exceções:** membro que não é dono, ação fora do catálogo ou tentativa de alterar permissões básicas de Dono/Membro inicial é rejeitada. O caso não oferece criação de novas ações por texto livre.

## UC04 — Consultar histórico de atividades

**Situação:** consolidado em 12/10/2026 a partir de RF35/RF36 e L03 aprovado.

| Campo | Descrição |
|---|---|
| Ator principal | Membro com permissão de consulta ao histórico |
| Pré-condições | Membro autenticado e ativo, com a permissão correspondente |
| Pós-condições | Eventos autorizados apresentados, sem alterar registros |
| Vínculos | RU04, RF35, RF36 |

1. O membro acessa o histórico e pode selecionar período, pessoa, ação e tipo de recurso.
2. O sistema confere permissão e visibilidade dos eventos.
3. Apresenta resultados paginados do mais recente para o mais antigo, com data/hora, participante, ação e identificação do recurso.
4. O membro pode consultar outras páginas sem editar ou excluir eventos.

**Alternativa de público:** donos recebem o histórico global. Leitores delegados recebem somente eventos de conteúdo existente e atualmente acessível; eventos administrativos e de recursos excluídos são exclusivos dos donos nesta entrega.

**Exceções:** sem permissão, negar consulta; sem correspondências autorizadas, apresentar resultado vazio sem revelar eventos ocultos. Nunca apresentar senhas, valores secretos, tokens ou conteúdo completo de anexos.

## UC05 — Localizar e consultar informação operacional

**Situação:** fluxo principal, alternativas A01–A03 e exceções E01–E03 consolidados a partir das decisões confirmadas pelo proponente. A03 e E03 aplicam os critérios de busca já acordados; os demais fluxos foram confirmados em 12/10/2026.

| Campo | Descrição |
|---|---|
| Ator principal | Membro do workspace |
| Objetivo | Encontrar e consultar a informação operacional necessária ao trabalho |
| Pré-condição | Membro autenticado |
| Resultado esperado | Informação consultada conforme o tipo do item, sem exposição de itens não autorizados |
| Requisitos relacionados | RU01, RF41 e consulta de itens/anexos; acesso por conteúdo conforme RF45/RF46 |

### Fluxo principal confirmado

1. O membro informa palavras do título na busca.
2. O sistema pesquisa conforme os critérios do RF41 e retorna somente itens para os quais o membro tem a permissão de consulta e acesso ao conteúdo. Itens não autorizados não aparecem e não revelam sua existência, título, tipo ou localização nos resultados.
3. O membro seleciona um dos resultados autorizados apresentados.
4. O sistema confere novamente a autorização atual e apresenta o conteúdo conforme o tipo do item. Essa conferência cobre mudanças de acesso entre a busca e a abertura; não substitui a filtragem anterior dos resultados. Itens secretos ficam completamente ocultos sem a permissão de leitura do valor, conforme RN19, mesmo se houver compartilhamento do item.

### A01 — Localizar por navegação de pastas

**Situação:** confirmado pelo proponente em 12/10/2026.

1. Em vez de pesquisar, o membro navega pela raiz e pelas pastas acessíveis.
2. O sistema apresenta somente pastas e itens aos quais o membro tem acesso, respeitando as permissões de consulta.
3. O membro seleciona um item apresentado.
4. O fluxo retorna ao passo 4 do fluxo principal: o sistema confere novamente a autorização atual antes de abrir o conteúdo.

Pastas e itens não autorizados não são exibidos. Se a última origem de acesso for retirada entre a listagem e a abertura, aplica-se a exceção E01.

### E01 — Acesso retirado após a pesquisa

**Situação:** confirmada pelo proponente em 12/10/2026.

1. O item foi apresentado porque o membro tinha autorização no momento da pesquisa.
2. Antes da abertura, uma alteração elimina a última origem de acesso ao item.
3. Ao abrir, o sistema confere a autorização atual, bloqueia a consulta e informa “Item indisponível”, sem revelar novos dados ou distinguir falta de acesso de exclusão na mensagem.

Essa exceção não permite apresentar itens que já eram inacessíveis no momento da busca; eles continuam omitidos, conforme RF41-CA04.

### A02 — Consultar item compartilhado em pasta restrita

**Situação:** confirmado pelo proponente em 12/10/2026.

1. Um item dentro de uma pasta inacessível foi compartilhado diretamente com o membro, cujo papel permite consultá-lo.
2. O item aparece na busca quando corresponde à consulta. O resultado mostra título e tipo, sem revelar o caminho da pasta restrita; a indicação de arquivamento continua aplicável quando o filtro incluir arquivados.
3. O membro seleciona o resultado e o sistema confere novamente a autorização antes de abrir o item diretamente.
4. Esse acesso não libera a pasta nem os demais itens dela; a apresentação do conteúdo não revela o caminho restrito.

### E02 — Item excluído após a pesquisa

**Situação:** confirmada pelo proponente em 12/10/2026.

1. O item existia e era acessível quando foi apresentado nos resultados.
2. Antes da abertura, o item é excluído definitivamente.
3. Ao tentar abrir, o sistema informa “Item indisponível”, sem apresentar conteúdo ou novos dados do item excluído. A mensagem é a mesma usada na E01.

### A03 — Pesquisa sem correspondências acessíveis

Conforme RF41-CA08, se não houver itens correspondentes acessíveis ao membro, o sistema informa “Nenhum item encontrado” e permite alterar a busca. A mensagem não distingue ausência de itens de existência de itens não autorizados.

### E03 — Consulta vazia

Conforme RF41-CA07, uma consulta vazia não executa a pesquisa. O membro pode informar palavras para iniciar a busca.

Essa consolidação documenta o comportamento acordado até aqui, sem presumir validação externa pela empresa ou implementação concluída.
