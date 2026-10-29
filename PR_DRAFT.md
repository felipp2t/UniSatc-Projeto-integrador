## O que muda
Adiciona a tela de perfil da conta com nome editável, e-mail somente para leitura e data de criação. Inclui feedback de carregamento, erro e sucesso. A API passa a retornar `createdAt` e valida o nome do perfil com limite de 100 caracteres.

## Por quê
Atende à issue #71, permitindo que cada pessoa consulte os próprios dados e atualize o nome sem alterar o e-mail associado à conta.

## Como testar
- No frontend, execute `cd web && pnpm run check && pnpm run build`.
- No backend, execute `cd server && mvn -B verify`.
- Entre na aplicação e abra **Conta > Perfil**. Confira os dados, edite o nome com até 100 caracteres, salve e confirme a mensagem de sucesso e o nome atualizado no cabeçalho. Confirme também o estado de erro ao ficar sem conexão.

## Checklist
- [ ] Testes cobrindo o cenário
- [ ] Documentação atualizada
- [x] Migrações de banco conferidas (não aplicável; esta alteração não inclui migrações)
- [x] ADR criada ou atualizada (não aplicável; esta alteração não altera uma decisão arquitetural registrada)
- [ ] Sem segredos/credenciais no diff
- [ ] Impacto de performance avaliado

Closes #71
