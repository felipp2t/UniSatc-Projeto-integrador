---
name: pr-draft
description: Analyzes branch changes against develop, writes a project-specific PR body to the repository root, and outputs a ready-to-run gh pr create command.
---

# PR draft — UniSatc Projeto Integrador

Use the Git repository root (`git rev-parse --show-toplevel`) as the working
directory. This is a monorepo with `web/` and `server/`; do not assume the
current directory is the repository root.

## 1. Collect the diff against develop

Prefer the remote branch and fall back to the local branch when necessary:

```bash
git fetch origin develop --quiet
git log origin/develop..HEAD --oneline --no-merges
git diff origin/develop...HEAD --stat
git diff origin/develop...HEAD
```

If `origin/develop` is unavailable, use `develop` in all three commands.

Also inspect uncommitted work:

```bash
git status --short
git diff --stat
git diff --cached --stat
```

Never include unrelated pre-existing changes in the PR body. If the diff mixes
unrelated concerns, warn outside `PR_DRAFT.md` and generate the draft only for
the dominant concern.

## 2. Detect the related issue

Look for an issue number in this order:

- Current branch name (`feat/97-design-system-components`)
- Commit messages in the diff (`#97`, `fixes #97`)
- Explicit issue reference in the conversation

If no issue number is found, ask the user before generating a `Closes #...`
line. Do not guess an issue number.

## 3. Project validation commands

Use commands relevant to the changed area:

- Frontend changes: `cd web && pnpm run check && pnpm run build`
- Backend changes: `cd server && mvn -B verify`
- Run both when the change touches both areas.

Record failures accurately in `Como testar`; do not claim a command passed if it
was not run successfully.

## 4. Write `PR_DRAFT.md`

Write the file at the Git repository root, not inside `web/`:

```text
<repository-root>/PR_DRAFT.md
```

Overwrite an existing draft. The file must contain only the PR description,
with sections in Portuguese and no command, title, or branch metadata:

```markdown
## O que muda
<resumo objetivo da alteração>

## Por quê
<contexto de negócio ou técnico>

## Como testar
<passos reproduzíveis, incluindo comandos e páginas/fluxos>

## Checklist
- [ ] Testes cobrindo o cenário
- [ ] Documentação atualizada
- [ ] Migrações de banco conferidas (não aplicável quando a PR não toca migrações)
- [ ] ADR criada ou atualizada (não aplicável quando a PR não altera uma decisão arquitetural registrada)
- [ ] Sem segredos/credenciais no diff
- [ ] Impacto de performance avaliado

Closes #<NN>
```

Keep `Closes #<NN>` as the last line only when an issue was identified.

There is currently no repository pull-request template to mirror. If
`.github/pull_request_template.md` is added later, keep its checklist identical
to this one.

## 5. Output the command

After writing the file, output one command block for the user to run:

```bash
git push -u origin <branch-name>
gh pr create --base develop \
  --title "<type>(<scope>): <description in English>" \
  --body-file PR_DRAFT.md
```

Use `--base develop` explicitly. Never use `--draft`.

Branch format:

- With issue: `<type>/<issue-number>-<short-kebab-slug>`
- Without issue: `<type>/<short-kebab-slug>`

If the current branch already follows the format, use it verbatim. Otherwise,
include `git branch -m <branch-name>` before the push command.

PR titles use English and Conventional Commits style, for example:

```text
feat(ui): add design system component catalog
```
