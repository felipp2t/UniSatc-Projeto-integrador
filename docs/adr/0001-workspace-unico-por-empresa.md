# Um workspace compartilhado por empresa

**Status:** aceito

Cada instalação do Vaulty atende uma única empresa e possui um único workspace compartilhado. O workspace e o vínculo da conta inicial como dono serão provisionados uma vez por uma migration do banco de dados, registrada pelo Flyway, em vez de serem recriados por um hook de inicialização da aplicação. Assim, reiniciar a aplicação não duplica o workspace. O workspace pode ter vários donos, somente um dono existente pode atribuir essa role a outra pessoa, e a empresa deve manter ao menos um dono. Convites aceitos criam usuários vinculados a ele com acesso inicial somente de leitura a collections e items cujo acesso seja concedido pela raiz, por compartilhamento ou por herança, sem acesso ao conteúdo de items do tipo segredo; inicialmente, somente um dono pode atribuir o papel definitivo, e o RBAC poderá delegar essa permissão no futuro. Alterações de role e de permissões produzem efeito na próxima requisição autenticada. O access token identifica usuário e vínculo; a autorização usa o papel e as permissões persistidos, sem duplicar permissões como claim. Essa decisão simplifica o produto para o escopo atual de uma empresa por instalação, mas não oferece isolamento entre múltiplas empresas na mesma instalação.

## Complemento de domínio — 11/10/2026

A leitura inicial não concede acesso a pastas restritas que interromperam a herança. A raiz é acessível a todos os membros, conforme as ações permitidas por seus papéis. O [modelo conceitual](../MODELO-CONCEITUAL.md) acrescenta grupos, compartilhamentos por conteúdo e herança configurável, preservando um workspace por empresa e um papel por membro no modelo atual.

Mudanças de grupos, compartilhamentos e herança produzem efeito na próxima requisição. Isso é distinto do prazo de até 15 minutos para mudanças de papel, que permanece vigente. Donos têm acesso global ao conteúdo. Esse complemento registra decisões de domínio desta sessão; não declara que a modelagem de compartilhamento já esteja implementada ou validada com a empresa. As issues precisam refletir o novo alcance da leitura inicial.

## Remoção e readmissão — 12/10/2026

Remover um membro exige dono, confirmação explícita e preservação de ao menos um dono. A conta, o conteúdo criado e a autoria histórica permanecem, mas o acesso ao workspace é negado na próxima requisição, mesmo com token válido; a renovação das sessões é impedida e grupos e concessões individuais são retirados. Isso exige verificação do vínculo ativo e não aguarda o prazo de propagação de mudanças de papel.

Um dono pode readmitir a conta existente, reativando o vínculo com acesso inicial limitado, sem restaurar automaticamente papel anterior, grupos ou concessões individuais. Esse fluxo é separado do convite de cadastro e está definido em RF50. Trata-se de decisão de domínio ainda a implementar e refletir nas issues; a readmissão não pode reativar autorizações anteriores por um token antigo.

## Refinamento de visibilidade — 12/10/2026

A revisão L01–L09 foi aprovada pelo proponente. Itens secretos ficam integralmente ocultos sem permissão de leitura do valor; isso inclui membros com papel inicial, mesmo que haja concessão ao conteúdo. O acesso global dos donos permanece aplicável. Configuração manual de compartilhamento limita-se inicialmente a pasta → grupo e item → membro; a cópia de herança preserva grupos e o público “todos os membros”, sem expandir seus integrantes.

Histórico administrativo e de conteúdo excluído é exclusivo dos donos nesta entrega. Cancelamento garantido termina na confirmação do envio, e a rejeição de um título reservado pode revelar sua indisponibilidade sem dados do item oculto. Esses refinamentos estão detalhados na especificação e nos casos de uso; não são evidência de implementação ou aprovação externa.
