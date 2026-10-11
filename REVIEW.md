# PR #126 — Correções e revisão final

PR: https://github.com/felipp2t/UniSatc-Projeto-integrador/pull/126
Branch: `feat/122-workspace-singleton-and-invite-authorization`
Referência original: `0f4493aac4d16a98cdd10089a718c154f3ff9709`, mais as correções desta revisão.
Base do PR: `f5a47a9216a716f52b0c55ab5290a9a0ef94cee5`.
Data: 2026-10-11.

**Revisão final com `thermo-nuclear-code-quality-review`: sem achados pendentes no escopo revisado.** Este documento registra a revisão técnica e a validação das correções.

## Achados originais corrigidos

| Achado | Correção |
|---|---|
| Migration falhava quando já existia um workspace | V5 cria o workspace somente quando não existe nenhum, preserva o proprietário e os dados existentes e garante seu vínculo Owner. V5/V6 usam o workspace real para os papéis, sem depender de UUIDs fixos distribuídos. Múltiplos workspaces continuam sendo rejeitados explicitamente. |
| JWT validado separadamente para identidade e papel | Uma única validação produz `AccessTokenClaims`, consumido diretamente pelo filtro. Falhas rejeitam a autenticação inteira. Tokens antigos sem papel continuam autenticados, com authorities vazias; a compatibilidade está documentada. |
| Limpeza de testes exposta em produção | Removido `UserRepository.deleteAllByEmailNot`. A fixture comum centraliza a limpeza por JDBC em transação e preserva o proprietário pelo vínculo com o workspace. Os testes de workspace usam rollback em vez de apagar o schema e executar migrations novamente. |

## Ajustes encontrados nas revisões seguintes

- Removidas as fábricas `WorkspaceRole.owner/member` e a sobrecarga de emissão de JWT que ficaram sem necessidade.
- O suporte de workspace agora configura o singleton existente; membros recebem o papel Member explicitamente.
- A fixture de convite reutiliza `WorkspaceService.addAsMember`, eliminando uma segunda implementação do vínculo de membro.
- A limpeza aproveita o `ON DELETE CASCADE` existente, sem repetir a exclusão de memberships.
- Os testes das constraints exigem os nomes `uq_workspace_singleton` e `ck_workspace_singleton`. A fixture persiste o usuário antes da inserção por JDBC, evitando um falso positivo por erro de FK.
- README e documentação da API refletem o upgrade que preserva dados e a compatibilidade com tokens antigos.

## Verificação

- Build limpo com `mvn -o -B clean verify -Dsurefire.runOrder=random`: **44 testes; 0 falhas; 0 erros; 0 ignorados; BUILD SUCCESS**.
- Também houve execuções completas anteriores com build e suíte aprovados durante as rodadas de correção.
- Testes novos de migration cobrem instalação vazia, workspace existente com e sem Owner previamente criado, preservação de dados/vínculo e rejeição de múltiplos workspaces.
- Testes novos do filtro verificam principal e authorities de Owner/Member, compatibilidade sem papel e rejeição de assinatura incorreta, expiração, token malformado, subject inválido/ausente e papel inválido.
- Teste de refresh confirma que a emissão recalcula o papel a partir do vínculo atual.
- `git diff --check`: aprovado.
- Revisão do diff completo contra a base do PR, incluindo novas correções e testes: nenhum arquivo Java alterado ultrapassa 1.000 linhas; o maior tem 202 linhas. Nenhum parser duplicado ou método de limpeza de testes permanece em produção.

A suíte foi executada com Java 21/Maven em container temporário e PostgreSQL isolado por Testcontainers. O snapshot validado foi comparado com os arquivos da branch local. O banco de desenvolvimento não foi usado pelos testes.
