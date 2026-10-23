<!-- primer -->
# reimagine-engine

One repository and one marketplace, `reimagine-engine`, holding four Claude Code plugins that install and work alone: `rules`, `loop`, `audit` and `primer`, each under `plugins/<name>/`; `repo-docs` is retired and keeps only its tags and changelog headings. The design documents under `docs/` specify the primer 0.1.0 release; where they disagree, requirements.md wins over architecture.md, and both win over build-plan.md. Read `docs/requirements.md` before changing behavior under `plugins/` or `tests/`. Read `docs/architecture.md` before adding or moving a file. Read `docs/build-plan.md` before starting or finishing a milestone. Read `docs/acceptance.md` before running or recording an acceptance item. Read `docs/decisions.md` before reversing a design choice.

## Commands

- `npm test`: runs the node:test suites under `tests/`, which also drive the audit and primer sh scripts.
- `npm run test:<area>`: runs one directory's suites, for `rules`, `loop`, `audit`, `primer`, `lint` and `release`.
- `npm run lint`: runs `tools/lint.mjs`, the repository rules of R219 and R220; set `LINT_DENY_TOKENS` to a comma-separated list in the command's environment to check for those tokens too.
- A commit runs the area scripts that cover what it touched; `npm test` and `npm run lint` with `LINT_DENY_TOKENS` set run once per milestone before its push, and CI runs the whole suite on every push to `main` and every pull request.

## Constraints

- Every file is written for this suite: none imports history, links to another project, or records a run made elsewhere.
- No file references `${user_config.*}`, and `package.json` has no dependencies.
- Commit messages, pull request text and ticket comments never name a model, agent type or tool.
- Commits read `type(scope): subject` in lowercase with a body that says why; a bare `@token` in a subject or pull request text goes in backticks.
- A commit that moves or renames files changes no file content.
- Every test and script runs on ubuntu, macOS and Windows with Git for Windows.
- A requirement number is never reused; a retired one keeps its number with "Retired" and the reason.
