---
name: pr-draft
description: Analyzes branch commits vs develop and generates branch name, PR title, and a PR description following the project's fixed template.
---

## 1. Collect diff vs develop
```bash
git log origin/develop..HEAD --oneline --no-merges
git diff origin/develop...HEAD --stat
git diff origin/develop...HEAD
```
Fall back to local `develop` if `origin/develop` is unavailable.

## 2. Split uncommitted changes if necessary ⚠️
Carefully check if the diff mixes **unrelated concerns** (e.g. a new feature alongside an unrelated refactor in different modules). If so, warn the user and list what should be separate PRs. Generate output only for the dominant concern.

## 3. Detect the related issue number
Look for an issue reference in:
- The current branch name (e.g. `123-fix-login`, `feat/123-fix-login`)
- Commit messages in the diff (e.g. `#123`, `DROP-595`, `fixes #123`)
- Explicit mention in the conversation

If a number is found, use it. If nothing is found, ask the user whether this work relates to an issue before generating the branch name — don't guess.

## 4. Generate output

**Branch name** — `<type>/<issue-number>-<short-slug>` when there is a related issue, otherwise `<type>/<short-slug>` (all lowercase, kebab-case).
```
feat/123-jwt-refresh-rotation   (linked to issue #123)
feat/jwt-refresh-rotation       (no linked issue)
```

**PR title** — `<type>(<scope>): <description>`, always in English regardless of the language used in the conversation.
```
feat(auth): add JWT refresh token rotation
```

**PR description** — always output using this exact template (fixed sections, in Portuguese, regardless of the language used in the conversation):

```markdown
## O que muda
<resumo objetivo da alteração>

## Por quê
<contexto de negócio ou técnico>

## Como testar
<passos reprodutíveis>

## Checklist
- [ ] Testes cobrindo o cenário
- [ ] Documentação atualizada
- [ ] Sem segredos/credenciais no diff
- [ ] Impacto de performance avaliado
```

Fill each section based on the actual diff — no placeholder text in the final output. "Como testar" must list concrete, reproducible steps (commands, pages, or flows to exercise), not a generic instruction.

If mixed concerns were found in step 2, append a `⚠️ Changes that may belong to another PR` section with suggestions.
