# Detalhes técnicos para fechamento — aprovado

Preparado em 12/10/2026 para concluir o item 1 do fechamento de requisitos. **Situação: conjunto aprovado pelo proponente em 12/10/2026 e incorporado à especificação. Implementação, equipamento concreto e evidências de teste continuam pendentes.** Reutiliza os contratos atuais onde existem. Não define novas funcionalidades de produto.

## 1. Limites dos campos

| Campo | Decisão aprovada | Base |
|---|---|---|
| Nome da conta | 3 a 255 caracteres | Manter contrato existente |
| Nome do workspace | 3 a 100 caracteres | Manter contrato existente |
| Descrição do workspace | Até 2.000 caracteres | Manter contrato existente |
| Nome de papel | 1 a 50 caracteres | Entidade existente e regra de nome obrigatório |
| Nome de grupo | 1 a 50 caracteres | Reutilizar o limite do nome de papel |
| Nome de pasta | 1 a 255 caracteres | Manter contrato existente |
| Título do item | 1 a 255 caracteres | Alinhar ao limite de nomes de pasta |
| Descrição do item | Até 2.000 caracteres, opcional | Alinhar à descrição do workspace |
| Texto/Markdown | Até 100.000 caracteres; obrigatório e não apenas espaços | Limite aprovado para notas e procedimentos |
| Valor secreto | Até 8.192 caracteres; obrigatório e não apenas espaços | Limite aprovado para credenciais e pequenos blocos sigilosos |
| Endereço de link | Até 2.048 caracteres; HTTP/HTTPS completo | Limite aprovado para o cadastro de links |
| Senha | Mínimo aprovado de 8 caracteres, sem adicionar máximo nesta decisão | Preservar contrato atual e RN15/RN16 |
| Anexo | Até 20.000.000 bytes | Interpretar 20 MB como decimal, não 20 MiB |

Conferir tamanho de nomes/títulos após o tratamento de espaços nas extremidades já aprovado. Não remover espaços ou normalizar valor secreto, senha ou Markdown. Alinhar a contagem de comprimento entre interface, API e banco na implementação, incluindo caracteres Unicode; uma divergência de contagem não deve permitir exceder o limite nem alterar o valor informado. A ausência de máximo novo para senha não permite dispensar limites gerais de requisição da implementação.

## 2. Formato do backup

Decisão: entregar `vaulty-backup-AAAA-MM-DD-HHmmss.zip`, contendo:

- `manifest.json`: versão do formato (inicialmente 1), data/hora, versão da aplicação, inventário de anexos, tamanhos e hashes SHA-256 para conferência de completude.
- `database.dump`: exportação PostgreSQL em formato custom, restaurável pelo utilitário pg_restore.
- `attachments/`: arquivos anexados com sua identificação preservada e mapeada no inventário.

Preservar no banco os vínculos e os dados cifrados dos segredos. O inventário não inclui valores secretos, senhas ou tokens. Ainda que o banco contenha dados de autenticação necessários à recuperação, isso não autoriza expô-los no inventário, nas mensagens ou nos logs.

A documentação do PostgreSQL confirma que pg_dump produz uma cópia internamente consistente do banco e que o formato custom usa pg_restore. Essa consistência não abrange automaticamente arquivos guardados fora do banco: [PostgreSQL — pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [backup e restauração](https://www.postgresql.org/docs/17/backup-dump.html).

## 3. Consistência de banco e anexos

Para uma instalação local com um servidor de aplicação, executar uma geração por vez:

1. Colocar gravações em pausa e aguardar as operações de escrita já iniciadas terminarem.
2. Manter consultas disponíveis; novas tentativas de gravação recebem aviso para tentar após o backup.
3. Exportar banco e anexos enquanto a pausa impedir alterações nos dois conjuntos, incluindo processos de fundo que possam modificar conteúdo ou remover arquivos.
4. Montar e conferir o pacote antes de disponibilizá-lo como cópia concluída.
5. Encerrar a pausa tanto em sucesso quanto em falha.

A pausa não encerra sessões nem altera permissões. Esse desenho é uma decisão específica para o escopo local, sem promessa de funcionar com múltiplos servidores independentes. Arquivos temporários da geração não constituem retenção de backups: devem ser removidos após entrega ou falha conforme o ciclo técnico definido na implementação.

## 4. Material para recuperar segredos

Decisão: a restauração deve receber a mesma chave de criptografia usada para os dados cifrados, fornecida pela configuração do operador; não incluir a chave em claro no ZIP. O inventário pode identificar a versão da configuração/formato necessário, sem conter o valor da chave.

Documentar expressamente: sem esse material original, restaurar banco e anexos não permite recuperar os valores secretos. A responsabilidade de conservar esse material e de guardar o arquivo baixado não é assumida pelo Vaulty. Não se acrescenta gerenciamento de chaves pela interface.

## 5. Recuperação técnica

Completar o procedimento de RECUPERACAO-BACKUP.md com a implementação:

1. Validar versão e inventário do ZIP, incluindo tamanhos e hashes.
2. Preparar um banco e um repositório de anexos vazios em ambiente descartável.
3. Fornecer a chave original pela configuração.
4. Restaurar o banco custom com pg_restore e os anexos correspondentes.
5. Conferir itens, arquivos, grupos, compartilhamentos e leitura autorizada de segredo de teste.
6. Negar leitura ao usuário sem permissão e registrar as evidências.

Usar versão compatível de PostgreSQL/ferramentas e configuração da aplicação registrada no pacote/procedimento. Os comandos concretos dependem de RF48 e do storage que ainda serão implementados; não declarar o procedimento operacional antes disso.

## 6. Automação e evidências dos testes

Decisão: usar Playwright para seis contextos de navegador independentes, um por usuário. Não reaproveitar o mesmo armazenamento de sessão entre eles. A documentação descreve o isolamento e o uso simultâneo de contextos: [Playwright — autenticação](https://playwright.dev/docs/auth).

- Desempenho RNF15: executar no Chrome no Windows usado na apresentação, com 1.000 itens e as 120 pesquisas já acordadas. Cada contexto aguarda a resposta/timeout antes da próxima pesquisa; contextos executam em paralelo.
- Medir até o resultado correspondente à pesquisa estar apresentado, evitando considerar uma lista antiga como conclusão. Preservar erros, timeouts e resultados vazios na apuração.
- Testar compatibilidade nos navegadores acordados. Playwright permite canais Chrome/Edge; seu Firefox distribuído não é, por si só, evidência do Firefox estável instalado. Confirmar o percurso também no Firefox estável efetivamente usado: [Playwright — navegadores](https://playwright.dev/docs/browsers).
- Fazer o teste móvel em Chrome no Android real; emulação não substitui essa evidência.
- Usar áreas de visualização de 360×800, 768×1024 e 1366×768 pixels CSS, mantendo as larguras aprovadas e acrescentando alturas reproduzíveis.
- Registrar CPU, memória, versão do Windows, navegadores, versão do código e método de execução; no Android, modelo, versão do sistema e navegador.
- Para desempenho, os contextos acessam localmente no mesmo computador. Para Android, usar a mesma rede local e um endereço de aplicação acessível ao aparelho, sem presumir que localhost no celular seja o computador.
- Preparar a execução local para autenticação no navegador, considerando cookies, origens e transporte. Decisão: servir interface/API por uma origem HTTPS local acessível ao Windows/Android, sem tornar os testes dependentes de internet nem desligar a proteção de cookies como solução automática.

A ferramenta ainda não está instalada no projeto e nenhum desses testes foi executado. Na implementação, aplicar os controles do projeto antes de introduzir dependências; não confundir aprovação deste desenho com resultado de teste.

## 7. Dados concretos do cenário de busca

Usar uma base sintética e reprodutível com exatamente 1.000 itens, dois grupos de equipe e seis contas de teste com diferentes públicos/permissões. Preparar uma lista fixa de consultas e resultados esperados por usuário, incluindo itens secretos e itens compartilhados individualmente. Os termos e resultados concretos devem ser versionados com o teste, sem credenciais reais.

Preservar o método já aprovado: 20 consultas por usuário (10 de uma palavra, 5 de várias palavras, 5 sem resultados acessíveis), ao menos 114 de 120 em até 2 segundos, timeout de 10 segundos. Não reinterpretar seis janelas ociosas como seis buscas concorrentes.

## O que depende do usuário e o que depende da implementação

A aprovação em 12/10/2026 definiu limites, formato e desenho do procedimento. Hardware, modelo do celular e versões reais só podem ser registrados quando escolhidos e usados pela equipe. Não inventar esses valores nem substituí-los pelas características do ambiente do assistente.

O formato final dos contratos, a implementação de exportação/storage/chaves e os resultados dos testes continuam sendo trabalho técnico. A escolha de Full-Text Search também depende de atender aos critérios RF41; este acordo não a transforma em decisão concluída.
