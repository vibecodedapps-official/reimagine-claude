# reimagine-claude

One repository and one marketplace, `reimagine-claude`, holding four Claude Code plugins that install and work alone: `rules`, `loop`, `audit` and `repo-docs`, each under `plugins/<name>/`. The design documents under `docs/` specify the 0.1.0 release; where they disagree, requirements.md wins over architecture.md, and both win over build-plan.md. Read docs/requirements.md before changing behavior under `plugins/` or `tests/`, docs/architecture.md before adding or moving a file, and docs/acceptance.md before running or recording an acceptance item; the three are longer than the 200-line spoke cap, so they are named here and not indexed.

## Commands

- `npm test`: runs the node:test suites under `tests/`, which also drive the audit and repo-docs sh scripts.
- `npm run lint`: runs `tools/lint.mjs`, the repository rules of R219 and R220; set `LINT_DENY_TOKENS` to a comma-separated list in the command's environment to check for those tokens too.

## Constraints

- Every file is written for this suite: none imports history, links to another project, or records a run made elsewhere.
- `plugins/<name>/` holds only what a user installs: no tests, design documents or fixtures.
- Every shipped file under `plugins/` is ASCII.
- A new script under `plugins/` ships only with its test under `tests/`.
- No manifest declares `userConfig` or `dependencies`, and no file references `${user_config.*}`; `package.json` has no dependencies.
- No shipped file names a person, a person's email address, an absolute path under a user's home, or a repository other than this one.
- Commit messages, pull request text and ticket comments never name a model, agent type or tool.
- Commits read `type(scope): subject` in lowercase with a body that says why; a bare `@token` in a subject or pull request text goes in backticks.
- A commit that moves or renames files changes no file content.
- Each plugin's manifest version and catalog entry agree; a plugin directory changed since its last tag carries a version above that tag.
- Every test and script runs on ubuntu, macOS and Windows with Git for Windows; the awk-using audit scripts also run on mawk.
- A requirement number is never reused; a retired one keeps its number with "Retired" and the reason.

## Spokes

- docs/build-plan.md: The milestones, their work items, commit subjects and checks. Read before starting or finishing a milestone.
- docs/decisions.md: The settled decisions with their evidence and what reopens them. Read before reversing a design choice.
