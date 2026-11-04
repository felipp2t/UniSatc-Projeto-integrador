## O que muda
Adiciona links seguros para notificações de alteração de acesso quando existe um único recurso identificável. A API revalida a permissão atual antes de incluir a referência; notificações antigas, amplas ou sem acesso válido continuam genéricas. O sino e os avisos em tempo real compartilham a navegação e removem referências em cache antes da sincronização.

## Por quê
Permite que a pessoa abra diretamente a pasta ou item afetado sem expor referências de recursos cujo acesso foi revogado.

## Como testar
- Frontend: `cd web && pnpm run check && pnpm run build`; validar uma notificação de pasta e uma de item, além de uma notificação genérica.
- Backend: `cd server && mvn -B verify`; validar que uma referência acessível é incluída e que uma referência revogada ou antiga permanece genérica.
- Nesta execução, passaram Biome nos arquivos alterados, `tsc -b`, `vite build`, `mvn -B -DskipTests compile` e `git diff --check`. Os testes não foram executados.

## Checklist
- [ ] Testes cobrindo o cenário
- [ ] Documentação atualizada
- [ ] Migrações de banco conferidas (não aplicável)
- [ ] ADR criada ou atualizada (não aplicável)
- [ ] Sem segredos/credenciais no diff
- [ ] Impacto de performance avaliado

Closes #93
