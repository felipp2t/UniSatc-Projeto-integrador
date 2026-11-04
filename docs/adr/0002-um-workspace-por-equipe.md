# Um workspace por equipe, administrado por um administrador geral

**Status:** aceito — substitui a parte de workspace único da [ADR 0001](0001-workspace-unico-por-empresa.md)

A instalação passa a ter vários workspaces, um por equipe. As demais decisões da ADR 0001 (papéis, donos, permissões, compartilhamento e remoção) continuam valendo dentro de cada workspace.

- **Administrador geral:** contas com `system_admin` (inicialmente só a conta seed `admin@gmail.com`, marcada pela migration `V30`) criam workspaces, consultam todos eles e convidam pessoas para qualquer workspace, escolhendo se entram como proprietárias ou como membros. No frontend, a tela inicial dele lista os workspaces; dali ele cria workspaces, edita nome e descrição, vê membros e convites pendentes, convida e revoga convites.
- **Acesso total do administrador geral:** ele age como dono de todos os workspaces (conteúdo, segredos, anexos, histórico, membros, papéis, grupos e compartilhamento) sem ser membro de nenhum. A migration `V31` o retira do workspace seed: outro dono assume, ou o workspace fica aguardando o convite de um proprietário. A sessão dele não tem membership (`refresh_token.workspace_member_id` vazio) e o papel é conferido no banco a cada requisição. No frontend, ele abre o conteúdo de um workspace pela página de administração, e um aviso indica qual workspace está acessando.
- **Líderes:** donos de um workspace convidam pessoas somente para o próprio workspace e só veem e revogam os convites dele.
- **Um workspace por pessoa:** cada conta pertence a um único workspace (`uq_workspace_member_user`). Por isso a sessão dos membros continua vinculada a uma única membership e não há troca de workspace. Um e-mail que já tem conta não pode ser convidado para outro workspace.
- **Workspace sem dono:** um workspace recém-criado fica sem `owner_id` até o primeiro convidado como proprietário concluir o cadastro.
- **Backup:** o backup é um dump do banco inteiro e expõe todos os workspaces; por isso só o administrador geral pode gerá-lo.

Essa decisão separa as equipes na mesma instalação sem exigir troca de sessão. Se uma pessoa precisar participar de mais de uma equipe, será preciso permitir várias memberships por conta e escolher o workspace ativo na sessão.
