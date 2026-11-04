# Normalização da documentação acadêmica — Vaulty

Pesquisa realizada em 12/10/2026. Formato escolhido pelo proponente: trabalho acadêmico completo. A base de edição está em [latex/vaulty.tex](./latex/vaulty.tex). Este guia registra as decisões de formatação; não reproduz as normas integralmente nem certifica a conformidade de um PDF ainda não compilado.

## Normas aplicáveis

| Norma | Aplicação |
|---|---|
| NBR 14724:2024 | Estrutura e apresentação do trabalho acadêmico |
| NBR 10520:2023 | Citações |
| NBR 6023:2025 | Referências |
| NBR 6024:2012 | Numeração progressiva das seções |
| NBR 6027:2012 | Sumário |
| NBR 6028:2021 | Resumos, resenhas e recensões |
| Normas de apresentação tabular, IBGE, 3. ed., 1993 | Tabelas de dados numéricos |

As edições das NBR foram conferidas na [Biblioteca da UFES](https://biblioteca.ufes.br/normalizacao). A NBR 15287:2025 trata de projetos de pesquisa: o fato de o produto se chamar “projeto integrador” não transforma automaticamente o documento em projeto de pesquisa. Para a entrega escolhida, adotamos a NBR 14724.

## Apresentação e estrutura

Adotar A4, texto preto, margens superior/esquerda de 3 cm e inferior/direita de 2 cm, apresentação em uma face, fonte 12 e entrelinhas 1,5. Exceções usam espaço simples; fonte menor e uniforme nas citações longas, notas, paginação e fontes/legendas. A norma não determina a família tipográfica. Escolhemos Times New Roman quando disponível, com TeX Gyre Termes como alternativa explicitamente identificada; tamanho reduzido de 10 pontos. Recuo de parágrafo de 1,25 cm e alinhamento justificado são escolhas deste modelo.

Capa, folha de rosto, folha de aprovação, resumos nos dois idiomas, sumário e referências integram a estrutura obrigatória; listas, agradecimentos, dedicatória, glossário, apêndices e anexos são condicionais/opcionais. Dados catalográficos precisam ser providenciados conforme o procedimento da biblioteca, sem inventar ficha. No eletrônico, vêm após a folha de rosto. A natureza ocupa a metade direita da mancha gráfica.

A capa não entra na contagem. Contar desde a folha de rosto, ocultando números nos pré-textuais; a página catalográfica não conta. Exibir algarismos arábicos desde a introdução, continuando até anexos. Em uma face, posicionar o número no alto à direita, a 2 cm das bordas superior/direita. Se houver impressão frente e verso, ajustar margens e posição dos números; o modelo atual é de uma face.

Fonte: [NBR 14724:2024, exemplar consultado no portal da FUNESA, itens 4 e 5](https://funesa.se.gov.br/wp-content/uploads/2025/06/TRABALHOS-ACADEMICOS.pdf).

## Seções e sumário

Organizar o conteúdo em seções; os comandos `\chapter` do abnTeX2 são apenas o mecanismo para as seções primárias e não imprimem a palavra “capítulo”. Cada seção primária começa em página nova. O número precede o título, separado por espaço, sem ponto ou hífen intermediário. Adotar hierarquia consistente no texto e no sumário; evitar ultrapassar cinco níveis. Títulos sem número, como referências e sumário, ficam centralizados. Folha de aprovação não recebe título.

Gerar o sumário automaticamente. Nele entram as partes textuais e pós-textuais, mantendo a ordem, grafia e hierarquia; os pré-textuais ficam de fora. As listas têm função própria e não substituem o sumário. Fonte de apoio: [orientações de apresentação gráfica da Biblioteca da UFSC](https://www.bu.ufsc.br/design/ApresentacaoGrafica.html); esse guia cita normas antigas de apresentação e foi usado somente para os pontos de numeração/sumário compatíveis com a edição atual.

Escolha tipográfica do modelo: seções primárias em maiúsculas/negrito; secundárias em negrito; terciárias em itálico; todas com 12 pontos. Conferir títulos longos, alinhamento das linhas seguintes e correspondência com o sumário no PDF final.

## Resumo e abstract

Escrever em parágrafo único, apresentando objetivo, método, resultados efetivamente obtidos e conclusão. Recomenda-se 150–500 palavras para trabalho acadêmico. As palavras-chave vêm abaixo, separadas por ponto e vírgula e encerradas por ponto; iniciais minúsculas, exceto nomes próprios e científicos. O abstract deve representar fielmente o resumo. Fonte: [Sistema de Bibliotecas da UFJ — NBR 6028:2021](https://sibi.ufj.edu.br/resumo-resenha-e-recensao-abnt-nbr-60282021/).

No arquivo inicial, ambos são campos de redação pendentes, não resumos finais. Os resultados de implementação/testes não serão preenchidos antes de existirem evidências.

## Citações

Adotar autor-data em todo o trabalho. Citação direta de até três linhas usa aspas duplas; a longa usa bloco sem aspas, espaço simples e fonte menor. Adotamos recuo esquerdo de 4 cm, recomendado pela norma. Indicar autor, ano e página ou localização disponível para a transcrição. Na indireta, identificar a fonte; página é opcional. Nomes pessoais entre parênteses usam maiúsculas/minúsculas, por exemplo `(Silva, 2023)`, e não automaticamente caixa alta. Siglas de instituições conservam sua grafia. Manter o mesmo critério para obras com quatro ou mais autores. Evitar citação de citação quando o original está disponível. Traduções e adaptações precisam ser identificadas.

Fonte de apoio: [guia de citações da Biblioteca do Instituto de Economia da Unicamp](https://www3.eco.unicamp.br/biblioteca/images/arquivos/NBR_10520_-_2023_-_Cita%C3%A7%C3%B5es.pdf). Esse guia conserva alguns trechos antigos; não adotamos sua afirmação de que página seria proibida em citações indiretas.

## Referências

Usar a edição 2025 da NBR 6023. Os elementos dependem do tipo documental: autoria, título, edição, local, editora, data e outros dados pertinentes. Para documentos consultados online, registrar endereço e data de acesso. Identificar corretamente órgãos/autores institucionais; não inventar autoria, edição, ano ou local ausentes. Manter uniforme o destaque dos títulos e a forma dos prenomes. Na lista autor-data, ordenar alfabeticamente; alinhamento à esquerda, espaço simples e uma linha simples em branco entre referências.

Fonte: [guia de referências NBR 6023:2025 da Unicamp](https://www3.eco.unicamp.br/biblioteca/images/arquivos/NBR60232025Referencias.pdf). A revisão final deverá confrontar as referências com os documentos realmente citados, incluindo páginas/URLs e edições usadas. As fontes de normalização desta pesquisa não substituem a bibliografia de Engenharia de Requisitos que será utilizada na fundamentação.

## Imagens, diagramas, quadros e tabelas

Identificar ilustrações acima do conteúdo, com designação, sequência, travessão e título. Abaixo, indicar fonte, inclusive “elaboração própria” quando pertinente, e notas necessárias. Mencionar cada elemento no texto e aproximá-lo da passagem correspondente. Respeitar a largura da ilustração também nos títulos e fontes. O guia de ilustrações da Unicamp consultado apresenta uma instrução conflitante sobre título abaixo; prevalece aqui o item 5.8 da NBR 14724:2024.

Para tabelas numéricas, adotar título e cabeçalho claros, unidades identificadas, fonte e notas abaixo; evitar grades laterais e linhas verticais desnecessárias. Em tabelas multipágina, repetir cabeçalho e indicar continuidade/conclusão. Não reduzir caracteres até ficarem ilegíveis: dividir o conteúdo ou usar página em paisagem mantendo paginação. Quadros de requisitos têm conteúdo predominantemente textual e recebem designação própria. Fonte: [IBGE — Normas de apresentação tabular](https://biblioteca.ibge.gov.br/visualizacao/livros/liv23907.pdf).

Decisões de produção: diagramas em PDF vetorial; capturas em PNG; fotografias em JPEG. SVG deve ser exportado para PDF antes da inclusão. Preservar proporções, contraste e legibilidade na escala final; 300 dpi para imagens raster é uma meta de qualidade de impressão, não uma exigência geral da ABNT. Não há dimensão única em centímetros para toda figura. Evitar capturas contendo credenciais ou dados pessoais reais. Fonte, legenda e resolução não devem ser confundidas.

## LaTeX e limites da automatização

Usamos abnTeX2 para estrutura e comandos acadêmicos. A [distribuição publicada no CTAN](https://ctan.org/pkg/abntex2) é 1.9.7, de 2018: ela antecede as três atualizações principais desta pesquisa. Portanto, carregar a classe não comprova conformidade atual. O modelo ajusta explicitamente apresentação e usa referências manuais inicialmente.

O [biblatex-abnt publicado no CTAN](https://ctan.org/pkg/biblatex-abnt) é 4.0. Não presumimos que ele implemente integralmente a NBR 6023:2025. A escolha/validação de automatização bibliográfica ficará para a inclusão da bibliografia, conferindo exemplos reais. Não misturar `abntex2cite` e `biblatex` no mesmo documento.

## Conferência antes da entrega

- Preencher os quatro autores, curso, natureza, orientador, cidade e identificação da banca com informações confirmadas.
- Confirmar com a instituição a ficha catalográfica e eventual modelo específico de aprovação; assinaturas e data de aprovação só depois do evento.
- Redigir resumo/abstract finais e completar a fundamentação com fontes efetivamente consultadas.
- Incorporar os requisitos consolidados preservando IDs, regras, critérios e rastreabilidade; a síntese inicial em LaTeX não substitui a especificação Markdown.
- Conferir PDF: margens, fontes incorporadas, paginação, sumário, títulos longos, notas, figuras/quadros/tabelas, URLs e referências cruzadas.
- Registrar evidências de testes apenas depois da execução. Manter separadas proposta, implementação e verificação.

Localizado um [manual público da SATC para Engenharia Mecânica](https://www.site.satc.edu.br/admin/arquivos/30073/manual-tcc-engenharia-mecanica.pdf). Ele é específico de outro curso; sua aplicabilidade ao integrador não foi confirmada. Os dados institucionais e a revisão visual permanecem pendentes, sem impedir a redação na base escolhida.
