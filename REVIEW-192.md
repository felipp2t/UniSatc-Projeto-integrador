# Thermo-nuclear review — PR #192

PR: [feat(members): permite alterar o cargo de membros do workspace](https://github.com/felipp2t/UniSatc-Projeto-integrador/pull/192)

Branch revisada: `feat/issue-78-member-role`  
Base local: `origin/develop` (`b7944b0`)

## Achado encontrado e resolvido

### Alto — rebaixar o dono principal não transfere a referência de ownership

O seletor permite trocar o cargo de qualquer membro com cargo `Owner`, inclusive o próprio dono principal. O fluxo sinaliza que esse usuário perderá o acesso de gestão de membros ao selecionar outro cargo ([configuracoes-workspace.tsx](/home/felipe/www/projeto-integrador/web/src/pages/_protected/configuracoes-workspace.tsx:414)). Porém, o endpoint backend `WorkspaceMemberService.changeRole` apenas altera o cargo do vínculo e não atualiza `workspace.owner` quando o dono principal é rebaixado ([WorkspaceMemberService.java](/home/felipe/www/projeto-integrador/server/src/main/java/com/vaulty/api/service/WorkspaceMemberService.java:69)).

Essa referência ainda é usada para conceder acesso efetivo ao conteúdo em `EffectiveContentAccess` e para autorizar alterações de compartilhamento em `WorkspaceSharingService`. Assim, após rebaixar o dono principal com outro Owner presente, o usuário rebaixado ainda pode manter acesso baseado em `workspace.owner`, enquanto o novo Owner pode não conseguir executar operações de compartilhamento que dependem dessa referência. O aviso e a mudança de cargo deixam de corresponder ao acesso efetivo.

**Correção aplicada:** `requireOwnerForUpdate` agora retorna o workspace já bloqueado para escrita. Ao rebaixar o dono principal, `WorkspaceMemberService.changeRole` transfere `workspace.owner` para outro Owner na mesma transação, antes de recalcular os acessos e notificações. O teste de integração verifica o novo `ownerId`, que o sucessor consegue alterar permissões de compartilhamento e que o usuário rebaixado recebe 403.

## Resultado da segunda review

Não encontrei achados pendentes no diff revisado.

## Revisão estrutural

O fluxo foi separado em hook, diálogo e componentes de lista, sem ultrapassar o limite de 1000 linhas por arquivo. Não encontrei outro problema estrutural de alta confiança no diff.

## Verificação

- `mvn -B -Dtest=WorkspaceRoleIntegrationTest test` — 14 testes passaram.
- `mvn -B verify` — 280 testes passaram.
- `corepack pnpm@11.10.0 --dir web run check` — passou.
- `corepack pnpm@11.10.0 --dir web run build` — passou.
- `corepack pnpm@11.10.0 --dir web test` — 333 testes passaram.
- `git diff --check` — sem problemas de whitespace.
