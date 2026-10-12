# Revisão de qualidade — PR #128

PR: https://github.com/felipp2t/UniSatc-Projeto-integrador/pull/128

Base: `f2c567ee65ac6ef550ff88bafda10fc869509dca` (`develop`). Head original: `d940b2e1d18d1da9efc83f12a72e497d8b138ed1`. Revisão final inclui as correções locais na branch `feat/pastas-paginadas`.

## Parecer final

**Sem achados pendentes no escopo revisado.** Foram aplicados os critérios da skill `thermo-nuclear-code-quality-review` após cada rodada de correção. Esse parecer representa os arquivos examinados e a validação executada, não uma garantia de ausência de qualquer defeito possível.

## Rodada 1 — Achados originais corrigidos

### Médio — Unicidade implementada em dois caminhos

Em `WorkspaceCollectionService.create`, a pré-consulta de nomes duplicados repetia a regra já garantida por `uq_collection_workspace_parent_name` e pelo tratamento de sua violação. A consulta não eliminava a necessidade do tratamento concorrente.

**Correção:** removidos a pré-consulta, a bifurcação raiz/subpasta e os dois métodos `exists...`. A constraint continua sendo a fonte da unicidade. O `saveAndFlush` traduz somente a violação dessa constraint para 409 e relança as demais violações. O teste HTTP de duplicidade agora exercita esse caminho.

### Médio — Consulta de vínculo duplicava o caminho canônico

O novo `WorkspaceMemberRepository.findByWorkspaceIdAndUserId` carregava membro e papel sem que o fluxo precisasse deles. Já existia `WorkspaceRepository.findByIdAndMemberUserId` para consultar o workspace visível ao usuário.

**Correção:** o serviço passou a reutilizar a consulta existente e seu helper retorna `Workspace`. O método redundante foi removido. Foram preservados o 404 sem vínculo e o 403 para criação por membro que não é proprietário.

## Rodada 2 — Limite de paginação corrigido

### Médio — Contrato aceitava offsets incompatíveis com JPA

A validação aceitava `page=107374183&size=20`. Uma reprodução isolada falhou com `InvalidDataAccessApiUsageException: Page offset exceeds Integer.MAX_VALUE (2147483647)` em `PageableUtils.getOffsetAsInteger`, em vez de devolver uma resposta controlada.

**Correção:** a validação existente agora rejeita `page × size > Integer.MAX_VALUE` com 400. A multiplicação usa `long` para evitar overflow na própria validação. O limite foi documentado em `server/docs/API.md`.

**Regressão:** testes cobrem o primeiro offset inválido para tamanho 20, multiplicação acima do limite com página máxima, a última página válida para tamanho 20 e o offset máximo exato com tamanho 1. Também foi acrescentado um teste de conflito de nomes dentro da mesma pasta pai, complementando a cobertura de duplicidade na raiz.

## Rodada 3 — Revisão final

Reexaminados os arquivos da PR e as correções, incluindo fluxo transacional, tradução de conflitos, contratos de entrada e saída, consultas, hierarquia, paginação e documentação. Não foram encontrados novos problemas concretos de estrutura, abstração, duplicação ou crescimento de condicionais que justifiquem outra alteração.

Os métodos distintos para raiz e filhos mantêm explícita a semântica de `NULL`; a CTE de breadcrumb mantém a travessia no repositório. Nenhum arquivo cruza 1.000 linhas. Não há motivo demonstrado para acrescentar camadas ou fragmentar esses módulos.

## Validação final

Executada em `server/`:

- `mvn -o -B test`: **57 testes, zero falhas, zero erros, zero ignorados; BUILD SUCCESS**.
- `mvn -o -B -Dmaven.repo.local=/tmp/pr128-maven-cache -DskipTests verify`: **BUILD SUCCESS**, incluindo geração do JAR e reempacotamento Spring Boot. Os testes foram executados separadamente pelo comando anterior.
- `git diff --check`: passou.

O primeiro `verify` offline executou os 55 testes anteriores com sucesso, mas parou por falta de sete artefatos de empacotamento no cache. Suas licenças foram classificadas pela política local como permissivas (Apache-2.0 e BSD-2-Clause), e os artefatos foram obtidos somente em um cache temporário para concluir a validação. Nenhuma dependência foi adicionada ao projeto.

As alterações anteriores do usuário foram preservadas. As correções foram preparadas na branch da PR, `feat/pastas-paginadas`.
