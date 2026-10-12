# Especificação de requisitos — Vaulty

Versão de trabalho iniciada em 11/10/2026 e revisada em 12/10/2026 a partir do levantamento inicial, das decisões registradas no projeto e dos acordos desta sessão.

## Alcance e situação

Este documento consolida os requisitos discutidos até aqui; a revisão do conjunto completo ainda está em andamento. Ele complementa o [levantamento inicial](../Valty_Levantamento_Requisitos_ABNT%202.docx.pdf), o [contexto do domínio](../CONTEXT.md), o [plano de entregas](../PLANO-DE-ENTREGAS.md) e o [ADR do workspace único](./adr/0001-workspace-unico-por-empresa.md).

“Confirmado” significa acordado com o proponente do projeto nesta sessão. Os requisitos são propostas do grupo para o contexto descrito; não foram levantados em entrevistas nem aprovados pela infraestrutura da empresa. O contato com a empresa tratou da assinatura necessária à continuidade do projeto. Esta especificação é uma versão de trabalho e não constitui uma baseline aprovada pela empresa nem evidência de implementação.

### Convenções de identificação

- **ON:** objetivo de negócio.
- **RU:** requisito de usuário — objetivo ou tarefa que a pessoa precisa realizar.
- **RF:** requisito funcional — comportamento do sistema.
- **RN:** regra de negócio — condição que rege esse comportamento.
- **CA:** critério de aceite — condição verificável para avaliar o atendimento ao requisito.
- Os identificadores RF01–RF40 e RN01–RN10 do levantamento são preservados. RF41 acrescenta busca; RF42–RF47, grupos/compartilhamento; RF48, backup manual; RF49, recuperação de senha; RF50, readmissão; RF51, renomeação de papel; RF52/RF53, consulta e renomeação de grupos. RN11–RN21 detalham novas regras de conteúdo, senha, proteção de papéis e refinamentos de revisão. RNF15–RNF17 acrescentam desempenho da busca, consistência do backup e prazo de avisos. O `RN9` do PDF é referenciado como RN09. Manter o ID não significa manter um enunciado antigo que foi expressamente revisado nesta sessão.
- Critérios recebem identificadores próprios por grupo, como `RF41-CA01` e `RF28-SEG-CA01`, evitando referências ambíguas. `DOC` reúne critérios de cadastro, substituição e consulta de anexos, relacionados a RF28, RF29, RF30 e RF34.

## Objetivo de negócio

**ON01 — Objetivo de negócio confirmado:** reduzir o tempo e a dependência de outras pessoas para localizar informações operacionais, permitindo que desenvolvedores autorizados encontrem e consultem o conteúdo centralizado no Vaulty. Esse objetivo orienta a revisão dos requisitos de organização, busca e consulta com permissão; não estabelece ainda uma meta quantitativa de redução de tempo.

## Requisitos de usuário

**RU01 — Necessidade do usuário confirmada:** o desenvolvedor precisa localizar e consultar as informações operacionais necessárias ao seu trabalho, respeitando suas permissões de acesso, sem depender de alguém para indicar onde estão. Essa necessidade contribui para o ON01 e orienta os requisitos de navegação por pastas, busca por título e consulta de conteúdo.

**RU02 — Necessidade do usuário confirmada:** o colaborador autorizado precisa cadastrar, atualizar e retirar de uso informações operacionais, para manter o conteúdo compartilhado útil e atualizado. Essa necessidade contribui para o ON01 e orienta os requisitos de criação, edição, arquivamento e exclusão de conteúdo, conforme suas regras e permissões. Não há responsável obrigatório pelo conteúdo; as operações podem ser realizadas por quem tiver a permissão correspondente, inclusive no compartilhamento entre equipes.

**RU03 — Necessidade do usuário confirmada:** o responsável pela gestão de acesso precisa conceder e ajustar as permissões dos colaboradores, para que cada pessoa consulte e mantenha apenas o conteúdo autorizado. Essa necessidade contribui para o ON01 e orienta os requisitos de gestão de papéis, definição de permissões e atribuição de papéis a membros. Essa responsabilidade não é automaticamente atribuída ao TL; as regras vigentes determinam quem pode realizar cada operação.

**RU04 — Necessidade do usuário confirmada:** o colaborador autorizado precisa consultar quem realizou alterações no conteúdo e quando elas ocorreram, para esclarecer mudanças e acompanhar a manutenção das informações. Essa necessidade apoia a rastreabilidade e a confiabilidade do conteúdo e orienta RF35 e RF36 do levantamento inicial, relativos ao registro e à consulta do histórico. As ações e dados iniciais estão definidos em RF35/RF36; os pontos ainda pendentes são indicados nessas seções. Essa necessidade não implica histórico de versões ou recuperação de conteúdo anterior.

**RU05 — Necessidade do usuário confirmada:** o colaborador precisa ser informado sobre mudanças em sua conta ou permissões, para compreender alterações em seu acesso ao sistema. Essa necessidade orienta RF37 a RF40 do levantamento inicial, relativos às notificações. Os eventos e condições iniciais estão definidos em RF37–RF40; os detalhes pendentes são indicados nessa seção. A necessidade não determina, por si só, a tecnologia de comunicação.

**RU06 — Necessidade do usuário confirmada:** o responsável autorizado precisa convidar colaboradores para ingressar no Vaulty, permitindo o acesso ao conhecimento compartilhado conforme as regras da empresa. Essa necessidade orienta RF10 e RF11 do levantamento inicial, relativos ao envio e aceite de convites, e se relaciona ao RF01, que restringe a criação de contas ao aceite de convite válido. As regras vigentes preveem que inicialmente somente donos enviam convites, sem definir papel no convite; o aceite cria a conta e o vínculo com acesso inicial limitado.

## Requisitos funcionais e critérios de aceite

### Conta e convites — refinamento em andamento

**RF02 — Autenticar usuário, mensagem de falha:** quando o e-mail não existir ou a senha estiver incorreta, informar “E-mail ou senha inválidos”, sem identificar qual informação falhou. Comportamento confirmado pelo proponente em 12/10/2026.

- **RF02-CA01 — Credenciais inválidas:** usar a mesma mensagem para conta inexistente e senha incorreta; não iniciar uma sessão nessas tentativas.

**RF03 — Renovar automaticamente a sessão:** renovar automaticamente a sessão enquanto a autorização de renovação for válida. Se a renovação falhar porque a sessão expirou ou foi invalidada, encaminhar o usuário ao login. Comportamento confirmado pelo proponente em 12/10/2026.

- **RF03-CA01 — Renovação válida:** permitir continuidade automática da sessão enquanto sua renovação for válida, sem solicitar novo login a cada expiração do acesso de curta duração.
- **RF03-CA02 — Sessão expirada ou invalidada:** se a renovação for rejeitada por expiração ou invalidação, encaminhar ao login; falhas temporárias de rede não são classificadas automaticamente como sessão inválida por esse critério.
- **RF03-CA03 — Prazo de renovação:** a autorização de renovação vale por sete dias após sua emissão no login ou em uma renovação bem-sucedida. Uma sessão sem renovação bem-sucedida por sete dias exige novo login. Esse prazo é distinto dos 15 minutos do acesso de curta duração; não estabelece um limite absoluto de sete dias para uma sessão continuamente renovada.

**RF04 — Encerrar a sessão atual:** o logout remove o acesso da sessão atual no navegador e impede sua renovação, sem desconectar outras sessões ou dispositivos. Comportamento confirmado pelo proponente em 12/10/2026.

- **RF04-CA01 — Alcance:** encerrar somente a sessão que solicitou o logout; outras sessões do mesmo usuário não são encerradas por essa operação.
- **RF04-CA02 — Renovação e acesso residual:** a sessão encerrada não pode ser renovada. Acessos já emitidos podem continuar válidos até expirarem, por no máximo 15 minutos, conforme o modelo atual; o logout não promete revogação imediata de autorizações já emitidas.

**RF10 — Convidar novo colaborador sem conta:** o sistema deve permitir que o dono convide por e-mail um novo colaborador que ainda não possua conta no Vaulty. Esse recorte foi confirmado pelo proponente em 12/10/2026 e substitui a expressão “com ou sem conta prévia” do levantamento inicial. O convite não define o papel; o ingresso segue as regras de acesso inicial.

- **RF10-CA01 — Conta existente:** se o e-mail já estiver associado a uma conta, o convite de cadastro é rejeitado e não cria outra conta ou vínculo.
- **RF10-CA02 — Quem convida:** inicialmente, somente donos enviam convites, conforme a decisão vigente.
- **RF10-CA03 — Validade:** o convite vale por sete dias a partir de sua criação. Ao atingir o prazo de expiração, não pode mais ser aceito ou recusado, conforme RN07 do levantamento inicial. Esse prazo foi confirmado pelo proponente em 12/10/2026 e corresponde à configuração atual.
- **RF10-CA04 — Reenvio:** manter apenas um convite pendente por e-mail. Reenviar cria um novo convite com validade de sete dias a partir de sua criação e invalida o link anterior; o convite substituído não pode mais ser aceito. Esse comportamento foi confirmado pelo proponente em 12/10/2026.
- **RF10-CA05 — Confirmação:** ao criar o convite e encaminhar o e-mail para envio, informar “Convite criado; e-mail encaminhado para envio”. Essa confirmação não afirma que a mensagem já foi entregue ao destinatário; o envio é posterior, conforme o fluxo atual de e-mails.

**Base da conferência:** o serviço de convites já rejeita e-mails cadastrados e exige dono. Essa conferência de comportamento não comprova que todos os critérios dos convites estejam implementados ou testados. A readmissão de alguém removido é um fluxo separado definido em RF50; não reabre o convite de cadastro para contas existentes.

**RF11 — Aceitar convite e ingressar:** o convidado informa nome, senha e confirmação da senha. Com convite válido e dados aceitos, o sistema cria a conta, vincula o novo membro ao workspace único e inicia sua sessão automaticamente, com acesso inicial limitado. Fluxo confirmado pelo proponente em 12/10/2026.

- **RF11-CA01 — Dados de cadastro:** solicitar nome, senha e confirmação de senha; a confirmação deve corresponder à senha. O e-mail da conta é o associado ao convite.
- **RF11-CA02 — Conta e vínculo:** criar a conta e o vínculo ao workspace na mesma transação, sem exigir escolha ou criação de outro workspace.
- **RF11-CA03 — Sessão inicial:** iniciar a sessão automaticamente após a conclusão do cadastro.
- **RF11-CA04 — Acesso inicial:** conceder o papel inicial de membro, com leitura apenas de conteúdo acessível pela raiz, grupos, compartilhamento ou herança, sem escrita e sem visibilidade de itens secretos, conforme RN19. O dono atribui o papel definitivo depois; o convite não carrega esse papel.
- **RF11-CA05 — Convite indisponível:** convites inválidos, expirados, revogados ou já utilizados não permitem concluir o cadastro. O sistema informa que o convite está indisponível e orienta solicitar outro ao dono, sem criar conta ou vínculo em decorrência dessa tentativa.
- **RF11-CA06 — Identidade por e-mail:** o e-mail da conta é o associado ao convite, sem troca por outro endereço durante o cadastro. Esse e-mail permanece fixo no perfil nesta entrega.

As regras de validade, reenvio, recusa e revogação devem ser respeitadas no aceite. Os limites aprovados constam da tabela de dados; os cenários de ingresso estão em UC01. Essa especificação não afirma que recusa e revogação já estejam implementadas.

**RF12 — Recusar convite:** o convidado pode recusar um convite pelo link, sem estar autenticado. Após a recusa, aquele convite não pode mais ser aceito; o dono pode enviar outro convite posteriormente. Fluxo confirmado pelo proponente em 12/10/2026.

- **RF12-CA01 — Acesso ao fluxo:** a recusa usa o link do convite e não exige login.
- **RF12-CA02 — Validade:** somente um convite pendente e válido pode ser recusado; RN07 e as condições de indisponibilidade continuam aplicáveis.
- **RF12-CA03 — Efeito:** a recusa não cria conta ou vínculo e impede o aceite posterior daquele convite. Um novo convite pode ser enviado pelo dono, conforme RF10.

**RF13 — Revogar convite pendente:** inicialmente, somente donos podem revogar convites pendentes. A revogação invalida o link na próxima tentativa de uso e não afeta contas criadas por convites já aceitos. Esse detalhamento foi confirmado pelo proponente em 12/10/2026.

- **RF13-CA01 — Autorização:** solicitações de revogação por membros que não sejam donos são rejeitadas.
- **RF13-CA02 — Efeito:** um convite pendente revogado não pode ser aceito; o cadastro por seu link é bloqueado conforme RF11-CA05.
- **RF13-CA03 — Conta existente:** a revogação de convite não remove nem altera conta ou vínculo já criados pelo aceite. Remover membros é uma operação distinta.

**RF14 — Listar convites pendentes:** inicialmente, somente donos consultam a listagem de convites pendentes, com e-mail do destinatário, quem convidou, data de criação e expiração. Esse detalhamento foi confirmado pelo proponente em 12/10/2026.

- **RF14-CA01 — Autorização:** a listagem é restrita aos donos.
- **RF14-CA02 — Dados exibidos:** cada entrada apresenta e-mail, quem convidou, data de criação e expiração.
- **RF14-CA03 — Convites utilizáveis:** convites expirados não aparecem como pendentes utilizáveis. Convites aceitos, recusados, revogados ou substituídos também não são apresentados como pendentes utilizáveis.

**RF06 — Atualizar o próprio perfil, recorte confirmado:** o e-mail não pode ser alterado pelo perfil nesta entrega. Essa decisão preserva a identidade associada ao convite e corresponde ao modelo atual, no qual o nome é o dado de perfil editável; a alteração de senha pertence ao RF05.

- **RF06-CA01 — E-mail fixo:** tentativas de alterar o e-mail pelo fluxo de perfil não modificam o endereço associado à conta.

### Membros — RF15, RF16, RF17 e RF50

Conjunto confirmado pelo proponente em 12/10/2026. Conta, vínculo ao workspace, papel, participação em grupos e concessões de acesso são conceitos distintos.

**RF15 — Listar membros:** membros podem consultar o nome e o papel dos demais membros. O e-mail fica visível apenas a quem administra membros; inicialmente, essa administração cabe aos donos.

- **RF15-CA01 — Dados comuns:** membros ativos consultam nome e papel dos demais membros.
- **RF15-CA02 — E-mail restrito:** o e-mail é retornado e exibido apenas a quem administra membros, não apenas ocultado visualmente.

**RF17 — Atribuir ou alterar papel:** inicialmente, somente donos atribuem ou alteram papéis. Cada membro mantém um único papel, independentemente de participar de vários grupos.

- **RF17-CA01 — Autorização:** rejeitar atribuição ou alteração por quem não é dono, conforme a decisão vigente.
- **RF17-CA02 — Último dono:** impedir rebaixar o último dono; outro dono precisa permanecer.
- **RF17-CA03 — Vigência:** manter o prazo acordado de até 15 minutos para mudanças de papel, com permissões atuais em cada token renovado.
- **RF17-CA04 — Histórico:** registrar quem realizou a atribuição ou mudança de papel, incluindo a atribuição inicial do papel definitivo pelo dono.

**RF16 — Remover membro do workspace:** inicialmente, somente donos podem remover membros, com confirmação explícita identificando a pessoa. Remover o vínculo não exclui a conta nem o conhecimento criado por ela.

- **RF16-CA01 — Autorização e confirmação:** exigir dono e confirmação explícita identificando o membro antes de executar a remoção.
- **RF16-CA02 — Último dono:** impedir remover o último dono; outro dono precisa permanecer.
- **RF16-CA03 — Acesso:** o membro removido perde acesso ao workspace na próxima requisição, mesmo com token de acesso ainda válido. A validade do token não substitui a verificação do vínculo ativo. Essa regra é distinta do prazo residual de logout e mudanças de senha e do prazo para alteração de papel.
- **RF16-CA04 — Sessões:** impedir a renovação das sessões do membro removido.
- **RF16-CA05 — Grupos e concessões:** remover suas participações em grupos e suas concessões individuais de acesso; concessões vinculadas a grupos de outros membros não são eliminadas por essa operação.
- **RF16-CA06 — Preservação:** manter a conta desvinculada e preservar seus itens, pastas, anexos e sua identificação nos eventos históricos.
- **RF16-CA07 — Histórico:** registrar quem realizou a remoção.
- **RF16-CA08 — Interface:** impedir o acesso ao conteúdo após a perda do vínculo e apresentar uma mensagem orientando a procurar um dono.

**RF50 — Readmitir uma conta existente:** o dono pode reativar o vínculo de uma conta removida ao workspace. A pessoa retorna com acesso inicial limitado, sem recuperar automaticamente o papel anterior, participações em grupos ou concessões individuais.

- **RF50-CA01 — Autorização:** somente donos podem readmitir a conta existente; o fluxo é separado do convite de cadastro RF10/RF11.
- **RF50-CA02 — Identidade:** preservar a conta e reativar seu vínculo, sem exigir criar outra conta com o mesmo e-mail.
- **RF50-CA03 — Acesso inicial:** conceder o papel inicial de membro e aplicar o acesso limitado de RF11-CA04. Não restaurar automaticamente papel anterior, grupos ou compartilhamentos individuais.

**Impacto:** RF50 está vinculado a [#141](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/141), [#142](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/142); a estimativa permanece pendente. RF16 exige conferir o vínculo ativo nas requisições e impedir reutilização de sessões removidas; a readmissão não pode restaurar autorizações anteriores por um token antigo. O estado da readmissão na interface e as evidências de implementação ainda precisam ser definidos.

### Papéis e permissões — RF18–RF22 e RF51

Conjunto confirmado pelo proponente em 12/10/2026. Inicialmente, somente donos criam, editam ou excluem papéis e definem suas permissões. Consulta de papéis e permissões (RF20/RF22) é inicialmente restrita aos donos, conforme aprovação de L05.

**RF18 — Criar papel personalizado:** permitir ao dono criar um papel com nome obrigatório e único no workspace, começando sem permissões.

- **RF18-CA01 — Autorização:** rejeitar criação por quem não é dono.
- **RF18-CA02 — Nome:** exigir nome válido conforme RN05, rejeitando nome vazio ou composto apenas por espaços.
- **RF18-CA03 — Permissões iniciais:** um papel novo não recebe permissões automaticamente; o dono configura o conjunto antes de atribuí-lo a membros.
- **RF18-CA04 — Histórico:** registrar a criação e quem a realizou.

**RF21 — Definir permissões de papel:** permitir ao dono selecionar as permissões de um papel a partir da lista fixa de ações oferecida pelo sistema.

- **RF21-CA01 — Autorização:** rejeitar definição ou alteração por quem não é dono.
- **RF21-CA02 — Catálogo:** aceitar somente ações disponíveis no catálogo do sistema. Criar ou editar um papel não permite inventar novas ações.
- **RF21-CA03 — Papéis iniciais:** impedir alterar as permissões básicas de Dono e Membro inicial, conforme RN17.
- **RF21-CA04 — Vigência:** mudanças nas permissões respeitam o prazo de até 15 minutos já acordado; cada token renovado precisa refletir as permissões atuais. Essa regra não altera a vigência na próxima requisição para mudanças de compartilhamento, grupos ou remoção de membros.
- **RF21-CA05 — Histórico:** registrar a alteração de permissões e quem a realizou.

**RF19 — Excluir papel sem membros:** permitir ao dono excluir um papel personalizado somente se não estiver atribuído a membros.

- **RF19-CA01 — Autorização:** rejeitar exclusão por quem não é dono.
- **RF19-CA02 — Vínculos:** papel atribuído a qualquer membro não pode ser excluído; primeiro devem ser alterados os papéis dos membros, conforme RN06.
- **RF19-CA03 — Papéis iniciais:** impedir excluir Dono ou Membro inicial, mesmo sem vínculos, conforme RN17.
- **RF19-CA04 — Histórico:** registrar a exclusão e quem a realizou.

**RF51 — Renomear papel personalizado:** permitir ao dono editar o nome de um papel personalizado, respeitando RN05 e preservando suas atribuições e permissões. Esse identificador formaliza a edição de nome já prevista no escopo da issue de interface #80; o contrato do backend ainda precisa ser alinhado.

- **RF51-CA01 — Autorização e nome:** exigir dono e nome válido e único no workspace.
- **RF51-CA02 — Proteção:** impedir renomear Dono e Membro inicial, conforme RN17.
- **RF51-CA03 — Histórico:** registrar a edição e quem a realizou.

A atribuição de papéis continua em RF17: somente um dono existente pode conceder o papel Dono, preservando ao menos um dono. As concessões de conteúdo não concedem ações além das permissões do papel. Os critérios de consulta RF20/RF22 estão definidos abaixo; os detalhes de implementação e evidências continuam pendentes. RF51 está vinculado a [#143](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/143) e #80 (FE); a avaliação de esforço permanece pendente.

### Consulta de papéis — RF20 e RF22

**RF20 — Listar papéis:** o sistema deve permitir que donos consultem os papéis cadastrados no workspace, incluindo os papéis iniciais e personalizados.

- **RF20-CA01 — Autorização:** inicialmente somente donos consultam a listagem; outros membros não recebem essa informação por esse fluxo.

**RF22 — Consultar permissões de um papel:** o sistema deve permitir que donos consultem o conjunto de permissões associado a um papel específico do workspace.

- **RF22-CA01 — Autorização e resultado:** inicialmente somente donos consultam esse conjunto; a consulta informa as ações do papel selecionado, sem modificar suas permissões.

### RF05 — Trocar a própria senha

**RF05 — Trocar a própria senha:** o membro autenticado informa sua senha atual, a nova senha e a confirmação da nova senha. A senha atual deve ser validada antes de permitir a alteração. Essa exigência foi confirmada pelo proponente em 12/10/2026 e corresponde ao fluxo atual do backend.

- **RF05-CA01 — Autenticação e senha atual:** exigir autenticação e senha atual correta para alterar a própria senha; senha atual incorreta impede a alteração.
- **RF05-CA02 — Confirmação:** a confirmação deve corresponder à nova senha; divergência impede a alteração.
- **RF05-CA03 — Sessões e links após troca:** uma troca concluída impede a renovação das sessões anteriores e invalida os links de recuperação pendentes, exigindo novo login para renovar o acesso. Acessos já emitidos podem continuar válidos até expirarem, por no máximo 15 minutos, conforme o modelo atual.
- **RF05-CA04 — Conclusão na interface:** após a troca concluída, confirmar a alteração e encaminhar o usuário ao login, sem mantê-lo no fluxo autenticado da interface. Essa navegação não elimina o prazo residual de acessos já emitidos definido em RF05-CA03.

A regra comum de tamanho da senha está definida em RN15, preservando a distinção entre cadastro, troca autenticada (RF05) e recuperação (RF49).

### RF49 — Recuperar acesso por redefinição de senha

O sistema deve permitir que uma pessoa que esqueceu sua senha solicite a redefinição por e-mail e defina uma nova senha por um link válido, sem precisar estar autenticada. Esse requisito foi confirmado pelo proponente em 12/10/2026 e formaliza uma funcionalidade existente no backend que não estava separada no levantamento inicial.

RF49 é distinto do RF05: recuperação não exige conhecer a senha atual, enquanto troca de senha é realizada por um usuário autenticado. Os critérios de validade do link, mensagens e efeitos sobre sessões estão definidos abaixo. A documentação técnica chama esses fluxos de RF06/RF07; esses identificadores precisam ser alinhados à numeração da especificação, sem renumerar os RF06/RF07 originais do levantamento.

- **RF49-CA01 — Solicitação sem revelar cadastro:** apresentar a mesma mensagem para e-mails cadastrados ou inexistentes: “Se houver uma conta com esse e-mail, você receberá orientações para redefinir a senha.” A mensagem não confirma a existência da conta nem afirma que o e-mail já foi entregue. Esse comportamento foi confirmado pelo proponente em 12/10/2026 e corresponde ao tratamento atual da solicitação no backend.
- **RF49-CA02 — Validade do link:** o link de redefinição vale por uma hora a partir de sua criação; ao atingir a expiração, não permite redefinir a senha.
- **RF49-CA03 — Uso único:** após uma redefinição concluída, o link utilizado deixa de funcionar e não pode ser reutilizado para alterar a senha novamente.
- **RF49-CA04 — Nova solicitação:** uma nova solicitação de recuperação para a conta invalida os links de redefinição anteriores e gera um novo link com validade de uma hora a partir de sua criação. Somente o link mais recente pode ser utilizado, enquanto válido e ainda não usado.
- **RF49-CA05 — Sessões e links após redefinição:** uma redefinição concluída invalida os links de recuperação pendentes e impede a renovação das sessões anteriores, exigindo novo login. Acessos já emitidos podem continuar válidos até expirarem, por no máximo 15 minutos, conforme o modelo atual; não se promete encerramento imediato dessas autorizações já emitidas.
- **RF49-CA06 — Conclusão:** após redefinir a senha, informar que a operação foi concluída e encaminhar a pessoa ao login, sem iniciar uma sessão automaticamente.
- **RF49-CA07 — Link indisponível:** se o link for inválido, expirado ou já utilizado, não alterar a senha, informar que o link está indisponível e oferecer iniciar uma nova solicitação de recuperação.

### Requisitos originais consolidados — conta, workspace e pastas

Os enunciados abaixo consolidam o levantamento inicial e decisões já documentadas, conforme L13 autorizado. Não representam novas funcionalidades nem evidência de implementação.

**RF01 — Criar conta por convite:** permitir cadastro exclusivamente pelo aceite de um convite válido, sem cadastro público. O dono inicial é provisionado conforme o ADR, fora desse fluxo.

- **RF01-CA01 — Entrada:** bloquear criação pública de contas sem convite; o cadastro normal segue RF11.

**RF07 — Consultar o próprio perfil:** permitir ao membro autenticado consultar os dados do próprio perfil.

- **RF07-CA01 — Dados:** apresentar nome e e-mail da própria conta, sem senha, hash ou tokens. Não confundir essa consulta com a visibilidade de e-mail de outros membros em RF15.

**RF08 — Consultar dados da empresa:** permitir ao membro ativo consultar os dados do workspace único da empresa.

- **RF08-CA01 — Vínculo:** exigir vínculo ativo e não oferecer seleção de outro workspace.

**RF09 — Atualizar dados da empresa:** permitir ao dono atualizar nome e descrição do workspace existente, conforme o ADR e o contrato atual.

- **RF09-CA01 — Atualização:** exigir dono e dados válidos; alterar a configuração sem criar outro workspace ou modificar seus vínculos.

**RF23 — Criar pasta:** permitir a quem possui a permissão correspondente criar uma pasta na raiz ou em uma pasta acessível.

- **RF23-CA01 — Validação:** exigir autorização e nome válido conforme RN03; a pasta segue a herança de acesso acordada, sem alterar concessões de outras pastas.

**RF24 — Renomear pasta:** permitir a quem possui a permissão correspondente renomear uma pasta acessível.

- **RF24-CA01 — Preservação:** aplicar RN03 e preservar a localização, os itens, subpastas e compartilhamentos ao alterar o nome.

**RF25 — Excluir pasta vazia:** permitir exclusão autorizada somente de pasta sem subpastas nem itens, conforme RN04.

- **RF25-CA01 — Conteúdo:** rejeitar exclusão quando houver subpastas ou itens ativos/arquivados; não excluir em cascata.

**RF26 — Listar pastas:** apresentar somente pastas acessíveis ao membro, respeitando a permissão de consulta.

- **RF26-CA01 — Ocultação:** a listagem não revela pastas restritas sem acesso; essa condição se soma à verificação do vínculo ativo.

**RF27 — Consultar caminho de navegação:** apresentar o caminho acessível para orientar a navegação de pastas.

- **RF27-CA01 — Visibilidade:** não revelar nomes ou segmentos de pastas inacessíveis pelo caminho de navegação. Itens compartilhados dentro de pasta restrita seguem UC05-A02, sem caminho restrito.

### RF28 — Criar itens tipados

Mantém-se o requisito do levantamento: permitir criar itens de link, documento, segredo e texto. Os grupos abaixo detalham os tipos discutidos; os critérios são parciais onde indicado.

#### Segredo

**RF28 — Cadastro de segredos, detalhamento confirmado:** o cadastro de um item do tipo segredo exige título e valor secreto; permite descrição opcional e escolha da localização na raiz ou em uma pasta. A descrição registra finalidade e orientações de uso, sem repetir o valor secreto. Esses dados atendem ao cadastro inicial acordado e contribuem para o RU02. Não é exigida indicação de responsável ou TL no cadastro do conteúdo.

**Critérios de aceite confirmados para RF28 — tipo segredo (parciais):**

- **RF28-SEG-CA01 — Dados obrigatórios:** o cadastro exige título e valor secreto.
- **RF28-SEG-CA02 — Descrição:** a descrição é opcional; destina-se à finalidade e às orientações de uso, sem repetir o valor secreto. Essa orientação de preenchimento não estabelece uma validação automática de equivalência entre descrição e segredo.
- **RF28-SEG-CA03 — Localização:** o usuário pode escolher a raiz ou uma pasta para armazenar o item, respeitando as permissões aplicáveis.
- **RF28-SEG-CA04 — Título duplicado:** o cadastro é rejeitado se já existir um item com o mesmo título na localização escolhida, ignorando maiúsculas/minúsculas, acentos e espaços nas extremidades; o mesmo título pode ser utilizado em outra pasta.
- **RF28-SEG-CA05 — Título reservado por item arquivado:** um item arquivado também impede cadastrar outro com o mesmo título na mesma localização; o título pode ser reutilizado após renomear ou excluir definitivamente o item anterior.
- **RF28-SEG-CA06 — Preservação do valor secreto:** o valor aceito no cadastro é preservado exatamente como informado, sem remover espaços, normalizar maiúsculas/minúsculas ou acentos, nem alterar caracteres. A criptografia e a posterior consulta autorizada devem preservar esse valor.
- **RF28-SEG-CA07 — Valor secreto vazio:** o cadastro é rejeitado quando o valor secreto estiver vazio ou contiver somente espaços em branco; essa validação não modifica os valores aceitos.
- **RF28-SEG-CA08 — Validação do título:** o cadastro é rejeitado quando o título estiver vazio ou contiver somente espaços. Ao salvar um título válido, os espaços nas extremidades são removidos; por exemplo, ` Chave da API ` é salvo como `Chave da API`.
- **RF28-SEG-CA09 — Cadastro concluído:** o segredo cadastrado fica disponível na localização escolhida para consulta por usuários autorizados, e sua criação é registrada no histórico sem incluir o valor secreto. Esse critério vincula o cadastro à consulta autorizada, ao RF35 e à criptografia prevista no RNF14.
- **RF28-SEG-CA10 — Falha no cadastro:** quando o cadastro não puder ser concluído, o sistema informa que o segredo não foi salvo e permite nova tentativa, sem expor o valor secreto na mensagem de erro.

Os limites aprovados constam da tabela de dados e do contrato técnico; os cenários de cadastro estão em UC02. As regras já acordadas de criptografia e autorização permanecem aplicáveis.

#### Link

**RF28 — Cadastro de links, detalhamento confirmado:** o cadastro de um item do tipo link exige título e endereço, permite descrição opcional e escolha da localização na raiz ou em uma pasta. Esse detalhamento contribui para o RU02 e reaproveita as regras de título e localização acordadas para os itens.

**Critérios de aceite confirmados para RF28 — tipo link (parciais):**

- **RF28-LINK-CA01 — Dados:** título e endereço são obrigatórios; a descrição é opcional.
- **RF28-LINK-CA02 — Localização:** o usuário pode escolher a raiz ou uma pasta, respeitando as permissões aplicáveis.
- **RF28-LINK-CA03 — Título:** títulos vazios ou compostos apenas por espaços são rejeitados; espaços nas extremidades são removidos ao salvar.
- **RF28-LINK-CA04 — Duplicidade:** o título deve ser único na localização, considerando itens ativos e arquivados e ignorando maiúsculas/minúsculas, acentos e espaços nas extremidades. O mesmo título é permitido em outra pasta.
- **RF28-LINK-CA05 — Endereço:** o cadastro aceita endereços completos com `http://` ou `https://`, inclusive de ambientes internos; endereços vazios, incompletos ou com outros esquemas são rejeitados.
- **RF28-LINK-CA06 — Disponibilidade:** o cadastro não exige que o endereço esteja acessível naquele momento, pois o ambiente pode depender de VPN ou estar temporariamente indisponível.

Limites e cenários comuns de cadastro estão na tabela de dados e em UC02.

#### Texto

**RF28 — Cadastro de textos, detalhamento confirmado:** o cadastro de um item do tipo texto exige título e conteúdo textual, permite descrição opcional e escolha da localização na raiz ou em uma pasta. Esse detalhamento contribui para o RU02 e reaproveita as regras comuns de título e localização.

**Critérios de aceite confirmados para RF28 — tipo texto (parciais):**

- **RF28-TXT-CA01 — Dados:** título e conteúdo textual são obrigatórios; a descrição é opcional.
- **RF28-TXT-CA02 — Localização:** o usuário pode escolher a raiz ou uma pasta, respeitando as permissões aplicáveis.
- **RF28-TXT-CA03 — Título:** títulos vazios ou compostos apenas por espaços são rejeitados; espaços nas extremidades são removidos ao salvar.
- **RF28-TXT-CA04 — Duplicidade:** o título deve ser único na localização, considerando itens ativos e arquivados e ignorando maiúsculas/minúsculas, acentos e espaços nas extremidades. O mesmo título é permitido em outra pasta.

- **RF28-TXT-CA05 — Formato do conteúdo:** o conteúdo textual aceita Markdown, permitindo títulos, listas, links e blocos de código para procedimentos e documentação técnica.
- **RF28-TXT-CA06 — Conteúdo vazio:** rejeitar conteúdo composto apenas por espaços em branco, sem concluir o cadastro. Preservar o Markdown dos valores aceitos.

Limites e cenários comuns de cadastro estão na tabela de dados e em UC02; validar a renderização do Markdown na implementação.

### Documentos e anexos — RF28, RF29, RF30 e RF34

**RF28 e RF30 — Cadastro de documentos, detalhamento confirmado:** cada item do tipo documento é cadastrado com um único arquivo anexado. Para adicionar outro arquivo, o usuário deve criar um novo item, em vez de anexá-lo ao mesmo item.

**Critérios de aceite confirmados para RF28/RF30 — tipo documento (parciais):**

- **DOC-CA01 — Anexo no cadastro:** o cadastro de um item do tipo documento inclui um arquivo anexado.
- **DOC-CA02 — Quantidade de arquivos:** não é permitido anexar um segundo arquivo ao mesmo item; outro arquivo deve ser cadastrado em um novo item.
- **DOC-CA03 — Edição do item:** os dados do item, como título e descrição, podem ser editados por usuários com a permissão correspondente, mantendo as regras aplicáveis aos títulos.
- **DOC-CA04 — Conteúdo do arquivo:** o Vaulty não oferece edição do conteúdo do arquivo anexado; essa atividade é realizada fora do sistema.
- **DOC-CA05 — Substituição do anexo:** um usuário autorizado pode enviar um arquivo atualizado para substituir o anexo anterior, mantendo exatamente um arquivo vinculado ao item. Essa operação não estabelece histórico de versões recuperáveis.
- **DOC-CA06 — Falha na substituição:** se o envio da nova versão falhar, o arquivo anterior permanece disponível e o sistema informa que a substituição não foi concluída.
- **DOC-CA07 — Formatos de arquivo:** a primeira entrega aceita PDF (`.pdf`), texto (`.txt`), Markdown (`.md`), documentos de escritório (`.docx`, `.xlsx`, `.pptx`) e imagens PNG (`.png`) e JPEG (`.jpg`, `.jpeg`). Formatos fora dessa lista são rejeitados. Vídeos ficam fora da primeira entrega, conforme revisão de escopo nesta sessão.
- **DOC-CA08 — Tamanho do anexo:** cada arquivo anexado pode ter até 20 MB; arquivos acima desse limite são rejeitados. O limite aplica-se tanto ao cadastro quanto à substituição do anexo. Na substituição rejeitada, o arquivo anterior permanece disponível, conforme DOC-CA06. O limite aprovado é de 20.000.000 bytes (MB decimal), distinto de 20 MiB.
- **DOC-CA09 — Consulta do anexo:** usuários autorizados podem baixar os arquivos e visualizar imagens e PDFs no navegador quando houver suporte. Documentos de escritório ficam disponíveis para download; a visualização no navegador não é obrigatória para eles. Quando não houver suporte à visualização de imagem ou PDF, o download permanece disponível.

Editar os dados do item, editar o conteúdo do arquivo e substituir o anexo são operações distintas. A validação técnica dos formatos aceitos será definida na implementação.

### Manutenção e consulta de itens — RF29, RF31, RF32 e RF34

**RF29 — Editar item:** permitir a um membro autorizado atualizar um item ativo acessível, mantendo seu tipo.

- **RF29-CA01 — Condições:** conferir vínculo ativo, permissão de edição e acesso ao item; rejeitar edição de item arquivado, conforme RN12.
- **RF29-CA02 — Validação:** aplicar as regras de título e do tipo. Segredos preservam o valor aceito e sua criptografia; documentos podem substituir o único anexo conforme DOC-CA05/CA06.
- **RF29-CA03 — Resultado e falha:** uma edição concluída disponibiliza os novos dados aos usuários autorizados e gera evento no histórico. Se a falha impedir salvar, não apresentar sucesso; se o resultado for desconhecido, verificar antes de repetir, conforme RN21.

**RF31 — Arquivar item:** permitir arquivamento autorizado de item ativo e acessível, sem excluir seus dados ou anexo.

- **RF31-CA01 — Transição:** passar de ativo para arquivado; rejeitar novo arquivamento de item já arquivado, conforme RN01. O título continua reservado na localização.
- **RF31-CA02 — Efeito:** respeitar o filtro padrão da busca, manter consulta autorizada e registrar a ação no histórico.

**RF32 — Restaurar item arquivado:** permitir restauração autorizada de item arquivado e acessível.

- **RF32-CA01 — Transição:** passar de arquivado para ativo; rejeitar restauração de item que não esteja arquivado, conforme RN02.
- **RF32-CA02 — Resultado:** disponibilizar o item ativo conforme o acesso atual, preservando conteúdo/anexo e registrando a ação; não recuperar acessos anteriormente removidos por causa da restauração.

**RF34 — Listar itens de uma localização:** permitir consulta dos itens acessíveis da raiz ou pasta, conforme as permissões.

- **RF34-CA01 — Ocultação:** não apresentar itens sem acesso, incluindo segredos sem permissão de leitura do valor, conforme RN19. A seleção e a abertura seguem UC05.

Movimentação de pastas/itens não é acrescentada ao escopo por esses enunciados. A manutenção aplica as mesmas validações de acesso e dados acordadas para o cadastro; regras de exclusão definitiva continuam em RF33/RN13.

### RF33 — Excluir definitivamente

**RF33 — Confirmação de exclusão definitiva:** antes de executar a exclusão, o sistema exibe o título do item e exige confirmação explícita, informando que o item e seu anexo, quando houver, não poderão ser recuperados pelo Vaulty. Sem confirmação, a exclusão não é executada. Essa condição se soma ao arquivamento prévio e à permissão correspondente.

A execução está condicionada à RN13. O registro de atividades é tratado pelo RF35; esta seção não define um mecanismo técnico de remoção do arquivo.

### Auditoria — RF35 e RF36

Conjunto confirmado pelo proponente em 12/10/2026. O histórico registra eventos e não equivale a versões recuperáveis de conteúdo.

**RF35 — Registrar atividades relevantes:** registrar automaticamente os eventos definidos abaixo, preservando a identificação histórica e sem incluir dados sigilosos.

| Categoria | Eventos acordados |
|---|---|
| Conteúdo | Criação, edição, arquivamento, restauração e exclusão de pastas/itens conforme as operações aplicáveis |
| Membros e acesso | Mudanças em membros, papéis, permissões, grupos e compartilhamentos, incluindo alterações de herança |
| Convites | Criação, aceite, recusa e revogação; reenvio é registrado como criação do novo convite que substitui o anterior |
| Backup | Geração de backup |

- **RF35-CA01 — Dados do evento:** registrar data/hora, quem realizou, ação, recurso afetado e identificação legível do recurso.
- **RF35-CA02 — Operações sem login:** identificar o participante pelo contexto disponível, como o convite; não apresentar essa identificação contextual como comprovação de uma sessão autenticada.
- **RF35-CA03 — Sigilo:** nunca registrar senhas, valores secretos, tokens ou conteúdo completo dos anexos.
- **RF35-CA04 — Preservação:** manter registros e identificação histórica após remover membros ou excluir recursos, sem depender da existência atual deles para apresentar o evento.
- **RF35-CA05 — Imutabilidade operacional:** não oferecer edição ou exclusão do histórico pela interface ou API comum. Essa condição não afirma proteção absoluta contra alteração direta por quem administra o banco.

**RF36 — Consultar histórico:** exigir uma permissão própria de consulta ao histórico, inicialmente dos donos e delegável por papel. Donos consultam o histórico global; os demais leitores autorizados devem respeitar a visibilidade do conteúdo.

- **RF36-CA01 — Autorização:** somente quem possui a permissão de consulta pode usar esse fluxo; donos a recebem inicialmente e podem delegá-la por papel.
- **RF36-CA02 — Ordenação e paginação:** apresentar do mais recente para o mais antigo, com paginação.
- **RF36-CA03 — Filtros:** permitir filtros por período, pessoa, ação e tipo de recurso.
- **RF36-CA04 — Visibilidade:** leitores delegados recebem somente eventos de recursos de conteúdo existentes e atualmente acessíveis. Eventos administrativos são apresentados somente aos donos nesta entrega; consulta ao histórico não libera títulos ou atividades de conteúdo restrito.
- **RF36-CA05 — Recursos excluídos:** nesta entrega, eventos de conteúdo excluído são apresentados somente aos donos; leitores delegados não os recebem. A exclusão não torna o evento público. Esse recorte foi aprovado em L03 e não exige reconstruir concessões históricas.

Não haverá expurgo automático de histórico nesta entrega, conforme L07; a consulta usa paginação. A política de retenção futura e o detalhe de registro de operações malsucedidas não estão incluídos por esse acordo.

### Notificações — RF37 a RF40

Conjunto confirmado pelo proponente em 12/10/2026. Notificações pessoais são distintas do histórico de auditoria.

**RF37 — Avisar sobre mudanças de acesso:** notificar o destinatário sobre mudança de papel, inclusão ou remoção de grupos e concessão ou retirada de compartilhamento.

- **RF37-CA01 — Eventos:** avisar cada membro afetado pela mudança de acesso efetivo, inclusive por herança. Alterações nas permissões de um papel avisam seus membros, além dos avisos de mudança de atribuição.
- **RF37-CA02 — Conteúdo:** informar o que mudou, sem incluir valores secretos. A notificação não concede acesso ao recurso.
- **RF37-CA03 — Retirada de acesso:** usar aviso genérico sem título, caminho ou link restrito. O aviso não revela referências ao conteúdo perdido nem contorna o acesso atual.

**RF38 — Consultar notificações recebidas:** cada usuário consulta somente as próprias notificações, preservadas para consulta posterior.

- **RF38-CA01 — Privacidade:** impedir que um usuário consulte notificações de outro por esse fluxo.
- **RF38-CA02 — Persistência:** avisos ficam disponíveis para consulta posterior com paginação; receber em tempo real não é a única forma de acessá-los. Não haverá expurgo automático nesta entrega.
- **RF38-CA03 — Referências antigas:** antes de apresentar referências de uma notificação antiga, conferir o acesso atual; ocultar títulos, caminhos e links que o destinatário não possa mais consultar.

**RF39 — Marcar notificações como lidas:** o destinatário pode marcar suas notificações como lidas.

- **RF39-CA01 — Autorização:** somente o destinatário pode alterar o estado de leitura das próprias notificações.

**RF40 — Entregar notificações em tempo real:** atualizar os avisos sem recarregar a página, usando o fluxo já previsto no levantamento, em conjunto com RNF09.

- **RF40-CA01 — Atualização:** entregar as notificações ao destinatário sem exigir recarregar a página.
- **RF40-CA02 — Reconexão:** após reconectar, recuperar as notificações persistidas para que uma interrupção não seja a única causa de perda de um aviso.
- **RF40-CA03 — Falha de entrega:** falhar a entrega em tempo real não desfaz a operação que originou o aviso; ele permanece disponível para consulta posterior.

O prazo está no RNF17; não haverá expurgo automático nesta entrega. Destinatários são os membros afetados pelo acesso efetivo e as referências respeitam o acesso atual. Agregação de avisos e mecanismos técnicos de entrega permanecem detalhes a especificar, sem presumir exposição de conteúdo restrito.

### RF41 — Pesquisar itens pelo título

**RF41 — Requisito funcional confirmado:** o sistema deve permitir pesquisar itens pelo título, exibindo somente resultados que o usuário tenha permissão para consultar. Esse requisito atende ao RU01 e contribui para o ON01. O identificador dá continuidade aos RF01–RF40 do levantamento inicial. Sua implementação integra a etapa incremental 2; os critérios de aceite acordados estão definidos abaixo. Trata-se de uma adição acordada nesta sessão, vinculada a #129 (BE) e #134 (FE), sem validação externa com a empresa.

**Comportamento de busca confirmado:** a pesquisa por título deve buscar palavras completas, ignorando diferenças entre maiúsculas, minúsculas e acentos; por exemplo, `producao` deve encontrar “Chave da API de Produção”, respeitando as permissões. Não é exigido que os fragmentos `prod` ou `duc` encontrem “Produção”. Essa definição esclarece a expressão anterior “parte do título”. O usuário sugeriu Full-Text Search como opção de implementação; a configuração técnica ainda precisa ser avaliada para atender ao comportamento acordado, sem pressupor que variações linguísticas sejam obrigatórias ou proibidas.

**Critérios de aceite confirmados para RF41:**

- **RF41-CA01 — Correspondência:** pesquisar `producao` ou `PRODUÇÃO` encontra um item autorizado com título “Chave da API de Produção”. A busca considera palavras completas e ignora maiúsculas, minúsculas e acentos; não é obrigatória a correspondência por prefixos ou fragmentos internos de palavras.
- **RF41-CA02 — Múltiplas palavras:** o título deve conter todas as palavras pesquisadas, em qualquer ordem. `api producao` encontra “Chave da API de Produção”, mas não “API de Homologação”.
- **RF41-CA03 — Alcance:** a busca abrange itens da raiz e de todas as pastas do workspace, sem exigir que o usuário saiba onde o conteúdo está.
- **RF41-CA04 — Permissões e ocultação:** os resultados incluem somente itens que o membro pode consultar, considerando a permissão do papel e o acesso ao conteúdo. Itens secretos também ficam integralmente ocultos quando falta a permissão de leitura de seu valor, conforme RN19. Itens não autorizados não aparecem nem revelam sua existência, título, tipo ou localização nos resultados. Valores de segredos não são expostos na busca. A autorização é conferida novamente ao abrir um resultado, pois o acesso pode ter mudado após a pesquisa.
- **RF41-CA05 — Arquivamento:** por padrão, somente itens ativos aparecem; um filtro permite incluir arquivados, respeitando as permissões.
- **RF41-CA06 — Apresentação:** cada resultado exibe título e tipo, com indicação de arquivamento quando aplicável. O caminho da pasta é exibido somente quando acessível ao membro. Um item compartilhado diretamente pode aparecer e ser aberto mesmo dentro de uma pasta inacessível, mas seu caminho restrito permanece oculto, sem liberar a pasta ou seus demais itens. O conteúdo é consultado ao abrir o item, conforme as permissões.
- **RF41-CA07 — Consulta vazia:** uma consulta vazia não executa a pesquisa.
- **RF41-CA08 — Sem correspondências:** quando não houver correspondências acessíveis ao usuário, o sistema informa “Nenhum item encontrado” e permite alterar a busca.
- **RF41-CA09 — Acesso retirado após a pesquisa:** se o membro perder o acesso após receber os resultados e antes de abrir um item, a consulta é bloqueada com a mensagem “Item indisponível”, sem revelar novos dados ou distinguir falta de acesso de exclusão na mensagem. Itens já inacessíveis no momento da pesquisa continuam omitidos, conforme RF41-CA04.
- **RF41-CA10 — Exclusão após a pesquisa:** se um item apresentado nos resultados for excluído definitivamente antes da abertura, o sistema informa “Item indisponível”, sem apresentar conteúdo ou novos dados do item excluído, conforme UC05-E02.

Esses critérios registram o comportamento acordado nesta sessão; a escolha e a configuração da implementação ainda precisam ser avaliadas frente a eles.

### RF42 — Criar grupos de acesso

O sistema deve permitir criar grupos de acesso no workspace por usuários com a permissão de Gestão de grupos.

- **RF42-CA01:** donos recebem Gestão de grupos inicialmente e podem delegá-la por papel.
- **RF42-CA02:** membros sem Gestão de grupos não podem criar grupos.
- **RF42-CA03:** exigir nome de grupo válido e único conforme RN18.

### RF43 — Gerenciar integrantes de grupos

O sistema deve permitir incluir e remover membros de grupos por usuários com Gestão de grupos, em todos os grupos do workspace.

- **RF43-CA01:** a administração independe de acesso prévio ao conteúdo compartilhado com o grupo.
- **RF43-CA02:** um membro pode participar de vários grupos sem receber outro papel.
- **RF43-CA03:** alterações na composição do grupo são registradas no histórico e valem na próxima requisição de conteúdo; outras origens de acesso continuam sendo consideradas.

### RF44 — Excluir grupos sem vínculos

O sistema deve permitir excluir um grupo por usuários com Gestão de grupos apenas quando ele não tiver membros nem concessões vinculadas.

- **RF44-CA01:** qualquer um desses vínculos impede a exclusão, sem remoção em cascata.
- **RF44-CA02:** concessões copiadas para uma pasta ao interromper a herança também impedem excluir o grupo enquanto estiverem vinculadas a ele.
- **RF44-CA03:** a exclusão autorizada é registrada no histórico, conforme o acordo de auditoria da gestão de grupos.

### RF45 — Gerenciar compartilhamento de conteúdo

O sistema deve permitir gerenciar concessões de acesso a pastas e itens por membros com a permissão de Compartilhamento e acesso prévio ao alvo.

- **RF45-CA01:** donos recebem Compartilhamento inicialmente e podem delegá-la por papel; editar conteúdo não concede Compartilhamento automaticamente.
- **RF45-CA02:** pastas podem ser compartilhadas com grupos de acesso; um item pode ser compartilhado diretamente com um membro como exceção, sem liberar sua pasta ou outros itens.
- **RF45-CA03:** a operação sobre conteúdo exige a permissão de ação do papel e acesso ao alvo; donos têm acesso global.
- **RF45-CA04:** remover uma concessão elimina somente sua origem, preservando as demais origens de acesso existentes.
- **RF45-CA05:** mudanças nos compartilhamentos valem na próxima requisição, sem depender da renovação do token.

Nesta entrega, a configuração manual limita-se a pasta → grupo e item → membro. Concessões copiadas ao interromper herança preservam seus destinatários, e “todos os membros” é um público próprio. Não se inclui cadastro manual de grupo → item ou membro → pasta além desses cenários.

### RF46 — Gerenciar herança de acesso de pastas

O sistema deve permitir interromper e reativar a herança por membros com Compartilhamento e acesso à pasta.

- **RF46-CA01:** subpastas herdam o acesso do pai por padrão; pastas na raiz herdam seu público de todos os membros.
- **RF46-CA02:** interromper copia as concessões atuais para uma lista própria, preservando grupos como grupos e “todos os membros” como público próprio, sem expandi-los em listas fixas de pessoas. Para restringir a pasta, retirar as concessões amplas dessa lista.
- **RF46-CA03:** reativar inclui o público atual do pai e mantém as concessões locais como acessos adicionais.
- **RF46-CA04:** itens herdam o acesso efetivo da pasta, com concessões individuais adicionais; a mudança de herança vale na próxima requisição.

### RF47 — Exibir origens de acesso

O sistema deve mostrar na interface de compartilhamento de onde vem cada acesso, distinguindo as origens aplicáveis, como grupo, herança e concessão direta.

- **RF47-CA01:** a apresentação permite identificar por que um membro continua acessando após uma concessão individual ser removida quando existe outra origem de acesso.

RF42–RF47 estão vinculados a [#130](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/130), [#131](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/131), [#132](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/132), [#133](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/133); implementação e estimativa continuam pendentes. Detalhes de apresentação e critérios adicionais permanecem em elaboração. As cardinalidades e os cenários estão no [modelo conceitual](./MODELO-CONCEITUAL.md).

### RF52 — Listar grupos de acesso

O sistema deve permitir que quem possui Gestão de grupos consulte os grupos do workspace.

- **RF52-CA01 — Autorização:** somente quem possui Gestão de grupos recebe a listagem por esse fluxo.

### RF53 — Renomear grupo de acesso

O sistema deve permitir que quem possui Gestão de grupos renomeie um grupo, preservando suas participações e concessões, conforme a unicidade definida em RN18.

- **RF53-CA01 — Autorização e nome:** exigir Gestão de grupos e nome válido e único no workspace; rejeitar a alteração em caso de conflito.
- **RF53-CA02 — Preservação:** renomear não altera quem integra o grupo nem os recursos compartilhados com ele.

RF52/RF53 formalizam L05, aprovado pelo proponente. A criação também segue RN18, e as operações de grupos permanecem registradas no histórico. A evidência de implementação continua pendente.

### RF48 — Gerar backup sob demanda

O sistema deve oferecer um botão para o usuário iniciar a geração de uma cópia de backup com os dados do banco e os arquivos anexados. A geração é manual, sem agendamento automático ou gerenciamento das cópias guardadas pelo usuário.

- **RF48-CA01 — Acionamento:** a geração ocorre por solicitação explícita do usuário pelo botão de backup.
- **RF48-CA02 — Escopo:** a cópia inclui banco e anexos, conforme RNF16-CA01.
- **RF48-CA03 — Autorização:** somente donos podem gerar o backup do workspace. O botão fica disponível apenas para donos e a operação no servidor também rejeita solicitações de outros membros, independentemente de suas permissões de consulta ou compartilhamento.
- **RF48-CA04 — Entrega da cópia:** ao concluir a geração, o sistema disponibiliza um único arquivo para download, reunindo os dados do banco e os anexos. O dono escolhe onde guardá-lo; o Vaulty não administra esse armazenamento.
- **RF48-CA05 — Falha na geração:** se a geração não terminar, o sistema informa que o backup não foi concluído e permite nova tentativa. Um arquivo incompleto não é apresentado como cópia válida nem como backup concluído.
- **RF48-CA06 — Pacote:** entregar um ZIP com versão do formato, data/hora e versão da aplicação em manifest.json, banco em database.dump custom e anexos em attachments/. O inventário inclui identificação, tamanhos e hashes SHA-256 sem valores secretos, senhas ou tokens.
- **RF48-CA07 — Consistência operacional:** uma geração por vez na instalação local; pausar gravações, aguardar operações iniciadas, incluir processos de fundo que modifiquem dados/anexos e manter consultas. Novas gravações recebem aviso para tentar após o backup. Liberar a pausa tanto em sucesso quanto em falha; não encerrar sessões ou alterar permissões por causa dela.

O formato aprovado é ZIP com manifest.json, database.dump custom do PostgreSQL e attachments/. A recuperação será técnica e documentada, sem botão na interface. O requisito está vinculado a [#135](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/135), [#136](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/136), com recuperação em [#137](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/137); a estimativa continua pendente.

## Regras de negócio

### Acesso por conteúdo — decisão de modelagem confirmada

O papel determina quais ações um membro pode executar; o compartilhamento determina em quais pastas ou itens pode executá-las. A operação exige a permissão correspondente no papel e acesso ao conteúdo.

- Grupos de acesso representam públicos habituais, como “Equipe 1” e “Equipe 2”. Pastas podem ser compartilhadas com esses grupos.
- Itens herdam o acesso da pasta. O compartilhamento direto com um membro concede acesso adicional ao item específico, sem liberar a pasta ou os demais itens dela.
- Subpastas herdam o acesso da pasta pai por padrão. Podem interromper a herança e definir um público próprio; nesse caso, as concessões herdadas da pasta pai não liberam acesso à subpasta. O acesso global dos donos permanece aplicável.
- Um membro pode participar de vários grupos sem receber outro papel; grupo de acesso e papel são conceitos distintos.
- Exemplo: Ana, do grupo Equipe 1 e com papel Leitor, não acessa os documentos da Equipe 2 por padrão. O compartilhamento direto de “Documentação da API” com Ana permite consultar esse item, mas não a chave de produção ou outros itens da Equipe 2.
- A concessão de acesso ao conteúdo não atribui responsabilidade por sua manutenção.

Essa modelagem foi acordada nesta sessão e está formalizada em RF42–RF47 e no modelo conceitual. Critérios adicionais de grupos, revogação e herança permanecem em elaboração. A permissão e as condições para compartilhar e o público da raiz estão definidos abaixo. O modelo atual de um papel por membro pode ser preservado; não foi acordada atribuição de múltiplos papéis.

**Permissão de Compartilhamento confirmada:** “Compartilhamento” permite gerenciar concessões de acesso a pastas e itens, separadamente de consulta e edição. Os donos recebem essa permissão inicialmente e podem concedê-la a outros papéis. Poder editar conteúdo não concede automaticamente essa permissão. Para compartilhar uma pasta ou item, o membro precisa ter a permissão de Compartilhamento e já ter acesso ao conteúdo; essa permissão não libera acesso a conteúdo restrito por si só.

**Acesso global dos donos confirmado:** donos têm acesso a todas as pastas e itens do workspace, incluindo conteúdo restrito, para administrar o workspace e os compartilhamentos. Não precisam de concessões por conteúdo. Para os demais membros, a operação continua exigindo a permissão da ação e acesso ao conteúdo por grupo, concessão direta ou herança.

**Alteração de herança confirmada:** interromper ou reativar a herança de uma pasta exige a permissão de Compartilhamento e acesso à pasta. Permissão de edição não autoriza essa alteração por si só.

**Interrupção da herança confirmada:** ao interromper a herança, o sistema copia as concessões atuais para uma lista própria da pasta, que pode ser ajustada por quem tem permissão de Compartilhamento e acesso à pasta. A cópia mantém os destinatários das concessões: grupos continuam grupos, sem expansão para concessões individuais. A pasta deixa de acompanhar alterações do compartilhamento da pasta pai, mas concessões a grupos continuam considerando seus integrantes atuais. Interromper a herança não restringe automaticamente o público; é necessário ajustar a lista copiada.

**Reativação da herança confirmada:** reativar a herança volta a incluir o público atual da pasta pai e preserva as concessões locais como acessos adicionais. A pasta volta a acompanhar mudanças do compartilhamento do pai; uma concessão local preservada pode manter o acesso mesmo após a retirada de uma concessão herdada.

**Remoção de concessões confirmada:** retirar uma concessão elimina somente aquela origem de acesso. O membro continua com acesso se houver outra concessão aplicável, por grupo, herança ou compartilhamento direto; o acesso global dos donos permanece. A interface de compartilhamento mostra as origens do acesso para esclarecer esse comportamento. Exemplo: remover o compartilhamento individual com Ana não elimina o acesso concedido por um grupo do qual ela participa.

**Gestão de grupos confirmada:** uma permissão própria, “Gestão de grupos”, permite criar grupos de acesso e incluir ou remover membros deles. Os donos recebem essa permissão inicialmente e podem delegá-la por papel. Ela é distinta de Compartilhamento, que controla concessões sobre pastas e itens. Alterar a composição de um grupo altera o acesso ao conteúdo compartilhado com ele, sem autorizar, por si só, alterações nos compartilhamentos.

**Alcance e auditoria de Gestão de grupos confirmados:** essa permissão administra todos os grupos de acesso do workspace. A administração não depende de acesso prévio às pastas ou itens compartilhados com os grupos. As alterações são registradas no histórico; delegar a permissão autoriza a administração global dos grupos e de sua composição.

**Exclusão de grupo confirmada:** excluir um grupo exige Gestão de grupos e ausência de membros e concessões de compartilhamento vinculadas. Se houver qualquer um desses vínculos, a exclusão é rejeitada, sem remoção em cascata; eles precisam ser ajustados antes. Concessões locais copiadas ao interromper a herança também impedem a exclusão enquanto vinculadas ao grupo.

**Vigência das alterações de acesso ao conteúdo confirmada:** mudanças na composição de grupos, nos compartilhamentos e na herança produzem efeito na próxima requisição, sem depender de renovação do token. A avaliação considera as demais origens de acesso ainda existentes. O prazo vigente de até 15 minutos para mudanças de papel permanece uma regra distinta. A retirada de acesso não recupera conteúdo já consultado ou baixado.

**Público inicial da raiz confirmado:** a raiz é acessível a todos os membros. Pastas diretamente na raiz herdam esse público por padrão, mas podem interromper a herança. Itens na raiz seguem esse público. O papel continua limitando as ações permitidas e a leitura do conteúdo de segredos; acesso à raiz não concede acesso a pastas que interromperam a herança.

**Impacto sobre decisões anteriores:** a leitura inicial já foi esclarecida no ADR; alinhar os épicos #2/#3 para que respeite o compartilhamento, em vez de presumir acesso a todas as pastas. A busca RF41 e a consulta de itens e anexos também precisam aplicar o acesso por conteúdo. O código atual não implementa essa modelagem; as funcionalidades RF42–RF47 têm requisitos e critérios iniciais, mas ainda precisam de issues, implementação e avaliação de esforço no plano de entregas.

### Regras de papéis

**RN05 — Nome único de papel:** o nome é obrigatório e único no workspace, ignorando maiúsculas/minúsculas, acentos e espaços nas extremidades. A regra se aplica à criação e à renomeação; nomes vazios ou compostos apenas por espaços são rejeitados. Esse detalhamento complementa RN05 do levantamento inicial.

**RN06 — Papel em uso:** um papel atribuído a membros não pode ser excluído. Primeiro é necessário alterar os papéis desses membros. Essa regra preserva RN06 do levantamento e é complementada pela proteção dos papéis iniciais.

**RN17 — Proteção dos papéis iniciais:** Dono e Membro inicial não podem ser renomeados, excluídos ou ter suas permissões básicas alteradas. O papel Dono preserva a administração e o acesso global acordados; Membro inicial preserva o acesso limitado de RF11-CA04. As permissões administrativas já acordadas de Compartilhamento e Gestão de grupos pertencem inicialmente aos donos e podem ser delegadas em papéis personalizados.

### Regras de senha

**RN15 — Tamanho mínimo de senha:** senhas devem ter no mínimo oito caracteres no cadastro por convite (RF11), na troca da própria senha (RF05) e na recuperação (RF49). Valores abaixo desse tamanho são rejeitados sem concluir a operação. Regra confirmada pelo proponente em 12/10/2026; o identificador dá continuidade a RN01–RN14, sem alterar as regras anteriores.

**RN16 — Preservação da senha:** permitir espaços e caracteres especiais sem remover espaços nas extremidades, mudar maiúsculas/minúsculas, normalizar acentos ou modificar a senha informada. A confirmação deve corresponder exatamente à senha. Essa regra vale para cadastro, troca e recuperação e também orienta a comparação no login; ela não dispensa os demais critérios de validade nem altera o armazenamento por hash previsto no RNF02. Regra confirmada pelo proponente em 12/10/2026.

### Regras de conteúdo e ciclo de vida

**RN11 — Títulos de itens por localização:** dois itens não podem ter o mesmo título na mesma pasta; títulos iguais são permitidos em pastas diferentes. A regra também se aplica aos itens da raiz, como uma mesma localização. A comparação ignora maiúsculas/minúsculas, acentos e espaços nas extremidades: `Chave da API` e ` chave da api ` contam como o mesmo título, assim como `Chave de Produção` e `Chave de Producao`. Itens arquivados continuam reservando seu título na localização, para evitar conflitos na restauração; reutilizar o título exige renomear ou excluir definitivamente o item anterior. Essa regra foi acordada nesta sessão para os itens em geral e é distinta da RN03 do levantamento, que trata dos nomes de pastas.

**RN03 — Comparação de nomes de pastas:** duas pastas não podem ter o mesmo nome dentro da mesma pasta pai; pastas diretamente na raiz são comparadas entre si. A comparação ignora maiúsculas/minúsculas, acentos e espaços nas extremidades, como na regra de títulos de itens. Por exemplo, `Produção` e ` producao ` são nomes duplicados na mesma localização. Esse detalhamento foi confirmado nesta sessão e se aplica à criação e à renomeação de pastas.

**RN04 — Pasta vazia para exclusão:** uma pasta só pode ser excluída quando não contiver subpastas nem itens ativos ou arquivados. Itens arquivados continuam vinculados à pasta e impedem sua exclusão. O sistema deve rejeitar a exclusão enquanto houver qualquer um desses conteúdos; não há exclusão em cascata. Esse detalhamento complementa RF25 e RN04 do levantamento inicial.

**RN12 — Consulta e edição de itens arquivados:** um item arquivado permanece consultável por usuários com a permissão necessária, mas precisa ser restaurado antes de qualquer edição, incluindo alteração de título, conteúdo ou substituição de anexo. Essa regra detalha RF29, RF31 e RF32. Para liberar um título reservado por renomeação de um item arquivado, é necessário restaurá-lo antes de renomear.

**RN13 — Exclusão definitiva de itens:** a exclusão definitiva exige que o item esteja arquivado e que o usuário tenha a permissão correspondente; tentativas de excluir definitivamente um item ativo são rejeitadas. Essa regra detalha RF33 e foi acordada nesta sessão.

**RN14 — Arquivo por item do tipo documento:** um item do tipo documento possui exatamente um arquivo anexado; múltiplos arquivos exigem itens distintos. A expressão “um documento” usada nesta sessão foi esclarecida como um arquivo anexado a um item do tipo documento.

### Regras aprovadas na revisão L01–L09

**RN18 — Nome de grupo:** exigir nome obrigatório e único no workspace, usando a comparação dos nomes de papéis: ignorar maiúsculas/minúsculas, acentos e espaços nas extremidades. A regra vale para criar e renomear grupos.

**RN19 — Visibilidade de segredos:** quem não possui a permissão de leitura do valor secreto não vê o item nem seus metadados em busca, listagem ou consulta, mesmo com concessão ao conteúdo. Donos mantêm o acesso global acordado. O acesso inicial de membros não expõe itens secretos.

**RN20 — Título reservado por conteúdo oculto:** manter a unicidade de títulos e informar “Título indisponível nesta localização” quando houver conflito, sem apresentar dados do item oculto. Aceita-se que essa rejeição revele a disponibilidade do título; a ocultação em busca/listagem não promete eliminar essa inferência no cadastro.

**RN21 — Cancelamento e resultado desconhecido:** o cancelamento garantido é anterior à confirmação do envio. Após confirmar, sair da tela não garante desfazer a gravação. Se a resposta se perder e não for possível saber se o cadastro foi concluído, informar resultado desconhecido e verificar o cadastro antes de repetir; não declarar que o item não foi salvo sem essa certeza.

## Ciclo de vida dos itens

**Ciclo de vida de itens confirmado:** um item cadastrado fica ativo; pode passar de ativo para arquivado e de arquivado para ativo por restauração, conforme RF31/RF32 e RN01/RN02. A exclusão definitiva só é permitida a partir do estado arquivado. Um item arquivado permanece consultável com permissão e não pode ser editado até ser restaurado.

| Situação inicial | Operação | Situação final | Condições principais |
|---|---|---|---|
| Novo item | Cadastrar | Ativo | Dados válidos e permissão correspondente |
| Ativo | Arquivar (RF31) | Arquivado | Permissão correspondente; RN01 |
| Arquivado | Restaurar (RF32) | Ativo | Permissão correspondente; RN02 |
| Arquivado | Editar (RF29) | Operação rejeitada | Restaurar antes; RN12 |
| Ativo | Excluir definitivamente (RF33) | Operação rejeitada | Arquivar antes; RN13 |
| Arquivado | Excluir definitivamente (RF33) | Excluído definitivamente | Permissão e confirmação explícita; RN13 |

A exclusão definitiva não oferece recuperação pelo Vaulty. O histórico de auditoria é distinto do conteúdo e não equivale a versionamento recuperável.

## Rastreabilidade inicial

Os vínculos abaixo organizam a relação entre as necessidades confirmadas e os requisitos existentes; não indicam que todos já foram detalhados ou implementados.

| Necessidade | Requisitos relacionados | Regras e condições relevantes |
|---|---|---|
| RU01 — Localizar e consultar | RF26, RF27, RF34, RF41, RF45, RF46 | Permissões; RF41-CA01 a RF41-CA10; consulta de anexos DOC-CA09; UC05-A01/A02 e UC05-E01/E02 |
| RU02 — Manter conteúdo | RF23–RF25, RF28–RF33 | RN03, RN04, RN11–RN14; critérios por tipo; UC02, UC02-A01 e UC02-E01–E04 |
| RU03 — Gerir acesso | RF15–RF22, RF42–RF47, RF50–RF53 | Alinhamentos de papéis e permissões nos épicos #2/#3 e ADR |
| RU04 — Esclarecer alterações | RF35, RF36, RF43, RF44 | RF35-CA01–CA05; RF36-CA01–CA05; criação de segredo sem valor no histórico: RF28-SEG-CA09 |
| RU05 — Receber avisos | RF37–RF40 | Critérios de eventos, privacidade, persistência, leitura e reconexão em RF37–RF40 |
| RU06 — Convidar colaboradores | RF01, RF10, RF11; readmissão em RF50 | Convite sem papel; ingresso com acesso inicial limitado, conforme ADR |
| Necessidade de conta e sessão — vinculada aos fluxos existentes | RF02–RF07, RF49 | RN15/RN16; critérios de sessão, troca e recuperação; necessidade ainda sem novo RU próprio |
| Preservação do conhecimento — relacionada ao ON01 | RF48, RNF16 | Backup manual, cópia consistente e recuperação técnica documentada |

ON01 orienta diretamente RU01–RU03. RU04 apoia a confiabilidade e rastreabilidade; RU05 e RU06 apoiam o acesso e a participação no sistema.

## Requisitos não funcionais em refinamento

### RNF15 — Desempenho da busca

Com uma base de 1.000 itens e 6 usuários simultâneos, pelo menos 95% das buscas devem apresentar resultados em até 2 segundos, medidos desde o envio da pesquisa até a exibição dos resultados, incluindo a verificação de acesso. Meta confirmada pelo proponente em 12/10/2026; o identificador dá continuidade aos RNF01–RNF14 do levantamento inicial.

- **RNF15-CA01 — Carga:** executar o cenário com 1.000 itens e 6 usuários simultâneos, utilizando as regras de acesso previstas para RF41.
- **RNF15-CA02 — Medição:** medir cada busca do envio até a exibição dos resultados, incluindo a verificação de acesso e sem limitar a medição ao processamento do servidor.
- **RNF15-CA03 — Meta:** pelo menos 95% das buscas medidas devem concluir a apresentação dos resultados em até 2 segundos.

**Rastreabilidade:** ON01 → RU01 → RF41 → RNF15. A meta de desempenho não dispensa a ocultação de itens não autorizados.

**Ambiente confirmado:** o sistema será executado em computador local na apresentação à banca; o teste deve usar esse computador ou um ambiente local equivalente, com as seis sessões acessando a aplicação. As características do computador e as condições concretas de acesso ainda precisam ser registradas; o método de seis sessões independentes está definido abaixo.

**Método de teste confirmado em 12/10/2026:** automatizar seis sessões independentes, autenticadas como usuários distintos, executando buscas concorrentes e medindo desde o envio de cada pesquisa até a exibição dos resultados. As sessões devem ter armazenamento de autenticação isolado para não compartilhar logins. Manter seis abas ou sessões ociosas abertas não comprova a carga concorrente. A ferramenta aprovada é Playwright, com seis contextos de navegador independentes e usuários distintos.

Para demonstração manual das permissões, podem ser usados seis perfis separados do navegador, cada um com um usuário de teste. Essa demonstração não substitui a medição automatizada do RNF15.

**Quantidade inicial confirmada:** cada um dos seis usuários executa 20 buscas, variando os termos pesquisados, totalizando 120 medições. As seis sessões realizam suas sequências de buscas de forma concorrente. Pelo menos 114 das 120 buscas devem concluir a apresentação dos resultados em até 2 segundos para atender à meta de 95%.

**Apuração confirmada:** buscas com erro ou timeout contam como falhas entre as 120 tentativas, sem descarte ou substituição por novas medições. Uma busca válida sem correspondências conta como concluída quando a mensagem “Nenhum item encontrado” aparece; para atender à meta, essa apresentação também deve ocorrer em até 2 segundos. Uma busca que conclui acima de 2 segundos não atende à meta, mesmo que tenha sucesso funcional.

**Ritmo de envio confirmado:** as seis sessões executam em paralelo. Cada sessão envia uma busca, aguarda a conclusão ou falha e então inicia a próxima, até completar suas 20 tentativas. Isso mantém no máximo uma busca em andamento por sessão e até seis buscas em andamento no conjunto; não exige simultaneidade exata em todas as tentativas.

**Timeout do teste confirmado:** uma tentativa que não conclui em até 10 segundos é encerrada como timeout e conta como falha entre as 120 tentativas. Esse limite pertence ao procedimento de teste e não altera a meta de até 2 segundos; respostas concluídas entre 2 e 10 segundos também não atendem à meta.

**Distribuição das pesquisas confirmada:** cada usuário executa 10 buscas com uma palavra, 5 com várias palavras e 5 sem resultados acessíveis, com termos previamente definidos. No conjunto, são 60 buscas com uma palavra, 30 com várias palavras e 30 sem resultados acessíveis, totalizando 120 tentativas. Os termos e resultados esperados devem ser preparados considerando as permissões de cada usuário.

Ainda precisam ser registradas as condições de rede e as características do computador, além dos usuários, termos e dados concretos do teste. Não há evidência de atendimento à meta nesta especificação.

### RNF06 — Responsividade, escopo confirmado

O uso em dispositivos móveis inclui os mesmos fluxos principais de conteúdo oferecidos no desktop: localizar, consultar, cadastrar e manter conteúdo, respeitando as permissões do membro e adaptando a apresentação ao tamanho da tela. O uso móvel não fica restrito à consulta. Esse detalhamento foi confirmado pelo proponente em 12/10/2026 e complementa o RNF06 do levantamento inicial.

- **RNF06-CA01 — Larguras de referência:** avaliar os fluxos principais de conteúdo com a área de visualização do navegador nas dimensões de 360×800, 768×1024 e 1366×768 pixels CSS, representando tela pequena, intermediária e desktop. Essas dimensões são referências de teste, não limites exclusivos de funcionamento nem exigências de pontos de quebra específicos.
- **RNF06-CA02 — Conteúdo e ações acessíveis:** nas larguras de referência, nenhuma ação ou informação essencial aos fluxos avaliados fica cortada ou inacessível. A página não exige rolagem horizontal; tabelas de conteúdo e blocos de código podem ter rolagem horizontal própria, sem provocar rolagem horizontal da página.
- **RNF06-CA03 — Interação por toque:** nas telas menores, menus, formulários e ações dos fluxos avaliados funcionam por toque, sem depender de passar o mouse sobre um elemento para acessar informações ou executar operações.
- **RNF06-CA04 — Verificação em dispositivo real:** além da avaliação nas três larguras do navegador, executar os fluxos principais em um celular real disponível à equipe, conferindo toque, uso do teclado virtual e envio de arquivo. O modelo do aparelho, o sistema operacional e o navegador devem ser registrados com as evidências do teste.

**Plataforma móvel confirmada:** o teste em celular real será realizado em Android. Apple/iPhone ficam fora do escopo de compatibilidade desta entrega, conforme decisão do proponente em 12/10/2026.

As dimensões aprovadas são 360×800, 768×1024 e 1366×768 pixels CSS. A execução local usará uma origem HTTPS acessível ao Windows/Android na rede local; o aparelho concreto e os detalhes de configuração ainda precisam ser registrados. O navegador confirmado é Chrome, com modelo do aparelho e versões do Android e do navegador registrados no teste. Não se presume, neste momento, que todos os fluxos administrativos já tenham sido detalhados para avaliação móvel. A rede necessária para esse teste é distinta do cenário local automatizado do RNF15.

### RNF13 — Compatibilidade de navegadores

Em 12/10/2026, o proponente confirmou Chrome, Edge e Firefox no Windows como matriz de compatibilidade de desktop. Avaliar as versões estáveis disponíveis no momento do teste e registrar os números das versões efetivamente usadas, assim como a versão do Windows.

- **RNF13-CA01 — Matriz de desktop:** executar a avaliação em Chrome, Edge e Firefox no Windows, registrando as versões utilizadas. Safari fica fora da matriz de desktop dessa entrega, revisando o recorte do levantamento inicial.
- **RNF13-CA02 — Percursos comuns:** executar nos três navegadores os mesmos percursos de login, busca e consulta, cadastro de texto/link/segredo/documento, envio e download de arquivo, edição, arquivamento e restauração, com usuários e dados equivalentes e conforme as permissões. Os percursos devem ser concluídos nos três navegadores; não se exige apresentação visual idêntica.

- **RNF13-CA03 — Matriz móvel:** executar o teste móvel previsto no RNF06 em Chrome no Android, registrando o modelo do aparelho e as versões do Android e do Chrome usados.

Apple/iPhone e Safari ficam fora do escopo desta entrega. Esse recorte revisa o levantamento inicial, que também citava Safari, e ainda precisa ser refletido nas issues de compatibilidade.

### RNF16 — Consistência do backup sob demanda

A cópia gerada pelo backup manual deve incluir os dados do banco e os arquivos anexados, permitindo recuperar a organização e os vínculos entre itens e anexos de forma consistente. O conteúdo obrigatório do backup foi confirmado pelo proponente e o mecanismo foi esclarecido em 12/10/2026.

- **RNF16-CA01 — Conteúdo e consistência:** a cópia inclui os dados do banco e os anexos com vínculos consistentes. Gerar somente a cópia do banco ou somente dos arquivos não atende ao requisito.

**Recorte corrigido:** o Vaulty não executa backups periódicos nem administra frequência, retenção ou local de armazenamento das cópias. O usuário inicia a geração por um botão; onde e por quanto tempo guardará o backup ficam fora do escopo. As regras anteriores de cópia ao final do dia e retenção de sete cópias foram substituídas por esse esclarecimento.

- **RNF16-CA02 — Procedimento de recuperação:** disponibilizar um procedimento técnico documentado para restaurar os dados do banco e os anexos a partir da cópia gerada, preservando seus vínculos. A restauração não terá botão na interface nesta entrega.
- **RNF16-CA03 — Segredos:** fornecer a mesma chave de criptografia original pela configuração do operador; não incluir a chave em claro no ZIP. Sem esse material, não afirmar que os valores secretos podem ser recuperados.
- **RNF16-CA04 — Verificação:** conferir versão e inventário e executar restauração em banco/storage descartáveis, verificando vínculos, anexos, consulta autorizada de segredo de teste e negativa de acesso indevido antes de declarar a cópia recuperável. Registrar as evidências; este critério não declara que o teste já foi executado.

O formato, a consistência e o fornecimento da chave foram aprovados no contrato técnico. A geração é restrita aos donos; comandos e evidência real de restauração permanecem pendentes até RF48 ser implementado.

### RNF17 — Prazo de notificações em conexão ativa

Em conexão ativa, a notificação de uma operação concluída deve atualizar a interface do destinatário em até 5 segundos. Essa meta foi aprovada em L07 em 12/10/2026 e não substitui a recuperação de avisos persistidos após reconexão.

- **RNF17-CA01 — Medição:** medir desde a conclusão da operação que origina o aviso até a atualização da interface de seu destinatário, mantendo a conexão ativa.
- **RNF17-CA02 — Reconexão:** períodos sem conexão são avaliados pelo fluxo de recuperação RF40-CA02, sem afirmar cumprimento da meta de 5 segundos durante a desconexão.

O ambiente concreto e o procedimento de medição ainda precisam ser registrados antes da verificação.

### Classificação dos RNF01–RNF14 do levantamento

| IDs | Classificação para a especificação | Forma de avaliar ou detalhe restante |
|---|---|---|
| RNF01, RNF02, RNF14 | Proteção de credenciais e segredos com mecanismos técnicos já previstos | Conferir transporte de tokens, armazenamento por hash e cifragem de segredos, preservando seu valor e sem exposição indevida |
| RNF03, RNF04 | Condições de autenticação e autorização | Verificar sessões, vínculo ativo, papel e acesso efetivo; revisar negativas e prazos acordados, sem assumir que token válido libera conteúdo |
| RNF05 | Restrição de interface REST e documentação OpenAPI | Conferir contratos e documentação das operações entregues; não confundir documentação gerada com teste das regras |
| RNF06, RNF13 | Qualidade de apresentação e compatibilidade | Usar os critérios de larguras, toque, Windows/Android e navegadores já definidos |
| RNF07, RNF08 | Restrições de persistência relacional e armazenamento de anexos | Preservar PostgreSQL e storage compatível com S3 do escopo; verificar vínculos de documentos e recuperação |
| RNF09 | Comunicação sem recarregar a página e mecanismo de entrega previsto | Aplicar RF40/RNF17, persistência e reconexão; validar a entrega no ambiente concreto |
| RNF10 | Condição de verificação por testes de regras críticas | Relacionar regras a casos e evidências; não inventar percentual de cobertura que não foi acordado |
| RNF11 | Proteção por limitação de requisições | Registrar limites e cenários da configuração efetiva; a configuração não se torna requisito universal de todos os endpoints |
| RNF12 | Condições de comunicação e cabeçalhos | Verificar origens permitidas, cabeçalhos e ambiente usado; distinguir o resultado exigido da ferramenta usada no backend |

Essa classificação implementa o encaminhamento L13 sem trocar automaticamente tecnologias ou prometer evidência de conformidade. Os testes e detalhes de configuração continuam sujeitos à implementação e à verificação.

## Restrições e opções de solução

### Carga de uso estimada

Em 12/10/2026, o proponente estimou aproximadamente 30 usuários cadastrados e até 6 usuários simultâneos. Essa estimativa orienta o cenário de teste de desempenho; não é um limite obrigatório de cadastro ou de sessões.

O cenário inicial de teste, confirmado pelo proponente, considera 1.000 itens e 6 usuários simultâneos. Os 1.000 itens são uma referência de teste com margem para crescimento, não um limite de armazenamento.

A meta, a carga, Playwright e o método estão definidos no RNF15 e no contrato técnico. Ainda falta registrar o computador, o aparelho, as versões e gerar a base e consultas concretas.

- **Escopo de anexos:** os formatos acordados são os de DOC-CA07; cada item possui um arquivo, limitado a 20 MB. Vídeos ficam fora da entrega à banca.
- **Edição de arquivo:** não há editor de conteúdo de arquivos anexados no Vaulty; é possível substituir o anexo, conforme DOC-CA05/CA06.
- **Segredos:** a criptografia prevista no RNF14 do levantamento acompanha o fluxo antecipado para a etapa 2; o valor aceito deve ser preservado exatamente.
- **Full-Text Search:** sugestão técnica do usuário para RF41, ainda sujeita à verificação dos critérios. Não é parte do enunciado funcional nem uma escolha técnica concluída.
- **Criação de chaves e aprovações:** continuam fora da primeira entrega, conforme a concepção.

## Dados e limites — aprovados em 12/10/2026

| Campo | Limite ou condição | Origem |
|---|---|---|
| Nome da conta | 3 a 255 caracteres | Contrato existente |
| Nome do workspace | 3 a 100 caracteres | Contrato existente |
| Descrição do workspace | Até 2.000 caracteres | Contrato existente |
| Nome de papel | 1 a 50 caracteres, obrigatório e único | Entidade existente e RN05 |
| Nome de grupo | 1 a 50 caracteres, obrigatório e único | Limite aprovado e RN18 |
| Nome de pasta | 1 a 255 caracteres, obrigatório e único no pai | Contrato existente e RN03 |
| Título de item | 1 a 255 caracteres, único por localização | Limite aprovado, RN11/RN20 |
| Descrição de item | Até 2.000 caracteres, opcional | Limite aprovado |
| Conteúdo de texto/Markdown | Até 100.000 caracteres, obrigatório e não apenas espaços | Limite aprovado e preservação de Markdown |
| Valor secreto | Até 8.192 caracteres, obrigatório e não apenas espaços | Limite aprovado e preservação exata |
| Endereço de link | Até 2.048 caracteres; HTTP/HTTPS completo | Limite aprovado |
| Senha | Mínimo de 8 caracteres; sem máximo novo nesta decisão | RN15/RN16 e contrato existente |
| Anexo | Um por documento e até 20.000.000 bytes, nos formatos definidos | DOC-CA01/CA07/CA08 |

Alinhar contagem de comprimento entre interface, API e banco, incluindo Unicode. Verificar os limites de nomes/títulos após o tratamento de espaços nas extremidades já aprovado; não remover espaços ou normalizar senha, segredo ou Markdown. A ausência de máximo novo para senha não dispensa os limites gerais de requisição da implementação.

O desenho de backup e testes está em [DETALHES-TECNICOS.md](./DETALHES-TECNICOS.md), aprovado pelo proponente. Hardware, versões reais, comandos e evidências dependem da implementação e da execução pela equipe.

## Gestão, rastreabilidade e recuperação

- [RASTREABILIDADE.md](./RASTREABILIDADE.md): RF01–RF53 e RNF01–RNF17 ligados a necessidades, issues existentes e cenários candidatos de verificação.
- [GESTAO-REQUISITOS.md](./GESTAO-REQUISITOS.md): registro das mudanças e versão candidata 0.2 para revisão dos integrantes.
- [RECUPERACAO-BACKUP.md](./RECUPERACAO-BACKUP.md): contrato e sequência técnica de recuperação, ainda sem execução comprovada.

## Pendências de especificação e alinhamento

A lista única, priorizada e com recomendações aprovadas pelo proponente em 12/10/2026 está em [REVISAO-REQUISITOS.md](./REVISAO-REQUISITOS.md). O documento distingue decisões de negócio aprovadas, detalhes de implementação/verificação ainda pendentes e tarefas de documentação. A aprovação define o comportamento e autoriza os encaminhamentos; não comprova implementação, testes ou aprovação pelos demais integrantes.

## Base didática e fontes

A organização aplica as notas do vault da disciplina de Engenharia de Requisitos: aula 02 (níveis de requisitos e critérios de aceite), aula 05 (classificação), aula 07 (especificação), aula 09 (identificação) e aula 10 (rastreabilidade). As siglas e os identificadores são convenções do projeto, não exigências de prefixo do material didático.

- [Levantamento inicial em PDF](../Valty_Levantamento_Requisitos_ABNT%202.docx.pdf).
- [Issues do projeto](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues), consultadas em 11/10/2026.
- [Empresa e membros — épico #2](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/2) e [Papéis e permissões — épico #3](https://github.com/felipp2t/UniSatc-Projeto-integrador/issues/3), com alinhamentos de 23/09/2026.
- Cenário de uso e decisões de refinamento fornecidos pelo proponente do projeto nesta sessão, sem validação externa dos requisitos.
