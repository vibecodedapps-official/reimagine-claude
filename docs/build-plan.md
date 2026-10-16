# Build plan: 0.1.0

Drafted 2026-10-14. requirements.md and architecture.md win over this plan. Requirements are cited as R1 to R231. Each milestone ends with its checks green on the implementer's machine; `npm test` runs from M1 on, `npm run lint` from M7 on, and the forbidden-name sweep (decision 10) runs before every commit from the first one. Pushes and pull requests follow the ask-first rules of the owner's instruction files; the handoff that starts the implementation says what is approved.

The implementation runs with an Opus orchestrator and Sonnet subagents. The orchestrator owns every design document, every commit, and every check; subagents write files from a brief that quotes the requirement and see nothing else.

| # | Milestone | Adds | Depends on |
|---|---|---|---|
| M1 | rules | `plugins/rules`, `tests/rules` | - |
| M2 | loop | `plugins/loop` with the record and `steps.json` | - |
| M3 | loop idempotency | second runs, foreign commits, resume | M2 |
| M4 | audit | `plugins/audit`, `tests/audit` | - |
| M5 | repo-docs | `plugins/repo-docs`, `tests/repo-docs`, the adopt fixture | - |
| M6 | catalog | `.claude-plugin/marketplace.json`, README install lines, the repository's own hub | M1 to M5 |
| M7 | lint | `tools/lint.mjs`, `tests/lint` | M6 |
| M8 | CI | `.github/workflows/ci.yml` | M7 |
| M9 | release | `tools/release.mjs`, `tests/release`, tags 0.1.0 | M8 |

M1, M2, M4 and M5 are independent and may proceed in parallel on branches; M3 follows M2.

## M1: rules

Work items:

1. `plugins/rules/.claude-plugin/plugin.json`, `LICENSE`, `README.md`. Commit: `feat(rules): add the plugin manifest and readme`.
2. `rules/core.md` with the two Working edits (R18 to R21) and `rules/windows.md`. Commit: `feat(rules): add the house rules text`.
3. `scripts/rules.mjs` with verbs `status`, `plan [--adopt] [--options]`, `apply`, `remove`, `decline`, `session-start` (R22 to R38, R41, R42). Commit: `feat(rules): add the house rules script`.
4. `tests/rules/rules.test.mjs` and `tests/rules/session-start.test.mjs`: one case per requirement, digests as literals (R18 to R42). Commit: `test(rules): cover the house rules script`.
5. `skills/rules/SKILL.md` with `disable-model-invocation: true`, the ask before apply, and the output style line (R39, R40). Commit: `feat(rules): add the /rules skill`.
6. `hooks/hooks.json` with the SessionStart hook (R41). Commit: `feat(rules): add the staleness notice hook`.
7. `output-styles/concise-plain.md` v4.5 and `chat/instructions.md` (R43, R44). Commit: `feat(rules): add the output style and chat block`.

Check:

- `npm test` passes on Windows and on one POSIX machine.
- A fresh profile (`CLAUDE_CONFIG_DIR` outside the repository) with `--plugin-dir plugins/rules`: `/rules` plans, asks, applies; the file is created with the block (acceptance item 2).
- A profile holding a hand copy of the rules: plan recommends adopt; adopt leaves the bytes outside the block unchanged and writes a backup (acceptance item 3).
- The notice line appears at startup after the shipped text changes (acceptance item 4).
- `rules:Concise Plain` is listed and selectable (acceptance item 5).

## M2: loop

Work items:

1. Manifest, `LICENSE`, `README.md`. Commit: `feat(loop): add the plugin manifest and readme`.
2. `skills/run/SKILL.md`: name `run`, description with the trigger phrases, allowed-tools, the reading block, approval scope, roles, budgets, rounds, terminal states, the `## Supporting files` section (R45 to R72, R94). Commit: `feat(loop): add the skill core`.
3. `steps/0-preflight.md` (R73 to R81, R52, R53) and `record.md` with the record location, files and `steps.json` schema (R82, R84, R85). Commit: `feat(loop): add preflight and the record`.
4. `steps/1-plan.md` (R97 to R103, R66), `risk.md` (R69, R70, R51). Commit: `feat(loop): add plan and review`.
5. `steps/4-build.md` (R104 to R114, R95). Commit: `feat(loop): add build, final review and checks`.
6. `steps/7-publish.md`, `pr-body.md`, `ci-watch.md`, `multi-repo.md`, `worktree.md` (R115 to R132). Commit: `feat(loop): add publish, ci watch, multi-repo and worktree`.
7. `report.md`, `handoff.md` (R133 to R141). Commit: `feat(loop): add report and handoff formats`.

Check:

- Every step file's last paragraph names the next read; the core is under the word cap that M7 will enforce (5,800 words).
- Prose invocation triggers the skill and the reading block prints before any tool call other than id resolution (acceptance item 7); "run the loop" reaches `/loop:run`, not the host's bundled `/loop` (acceptance item 25).
- A plan-only run on a throwaway repository writes `inputs.md`, `plan.md`, `run.md`, `steps.json`, `report.md` and leaves the tree clean (acceptance item 8).
- A full run on a throwaway GitHub repository with one ticket opens one pull request, comments on the ticket, and names no model, agent or tool in either (acceptance item 9).
- An ask-first rule in the profile's `CLAUDE.md` makes the publish step prompt; that is expected behavior (acceptance item 11).
- A dirty tree ends preflight `blocked` without stashing (acceptance item 12).

## M3: loop idempotency

Work items:

1. `record.md` additions: append rules, reuse rules, resume rules, the slug collision check (R86, R88, R92, R93, R96). Commit: `feat(loop): add resume rules to the record`.
2. Preflight additions: branch prediction, existing record detection, foreign commit listing, ticket done marks (R83, R87, R89). Commit: `feat(loop): read the branch state at preflight`.
3. Plan and publish additions: appended slices, body update versus comment, one comment per run (R86, R90, R91). Commit: `feat(loop): continue a record on a second run`.

Check (acceptance item 10, the milestone's acceptance):

- On a throwaway GitHub repository, run 1 with ticket A opens a pull request.
- Run 2 with ticket A: verifies checks, rewrites the report, commits nothing, posts nothing, ends `done`; `steps.json` shows run 2.
- Run 3 with tickets A and B: appends a slice, builds only B, updates the pull request body once, posts one comment, comments on B.
- A commit pushed to the branch by hand between runs appears in `inputs.md` as foreign and is included in the step 5 diff.
- Interrupt run 4 after step 2 (kill the session); run 5 resumes at step 3 after rechecking the tree.
- `git status --porcelain` is empty after every run.

## M4: audit

Work items:

1. Manifest, `LICENSE`, `README.md` (R5 on `jq`). Commit: `feat(audit): add the plugin manifest and readme`.
2. The nine scripts under `scripts/` with the embedded literals of R185 (R184, R185). Commit: `feat(audit): add the audit scripts`.
3. `tests/audit/*.sh`, `tests/audit/sh.test.mjs`, `tests/audit/lint.sh`, `tests/audit/fixture/**`, with every literal that depends on an embedded string produced by running `build.sh` once and pasting the observed value (R186, decision 11). Two commits: `test(audit): add the script suites and fixtures`, then `test(audit): set observed fixture literals`.
4. `skills/audit/SKILL.md`, `common.md`, `audit-evidence.md`, `handoff.md`, `live.md`, `report.md`, `work-items.md`, `fault-injection.md`, `resume.md` (R148 to R152, R162 to R174, R175 to R183, R187 to R189). Commit: `feat(audit): add the orchestrator and shared rules`.
5. `stages/1-orient.md` to `stages/9-act.md` with stage 6 rewritten around the fresh adversary and `second-opinion-request.md` (R153 to R161, R190 to R195). Commit: `feat(audit): add the nine stages`.
6. `agents/digester.md`, `mapper.md`, `auditor.md`, `adversary.md` (with the default second-opinion mode), `merger.md` (R150). Commit: `feat(audit): add the agents`.
7. `commands/run.md`, `resume.md`, `act.md`, `handoff.md` (R142, R196). Commit: `feat(audit): add the commands`.

Check:

- `npm test` passes on ubuntu, macOS and Windows; the awk suites pass under mawk.
- A low-tier headless run on the patterns fixture ends `reported` with stage 6 run by a `fable` adversary and every read-only check at exit 0 (acceptance item 14).
- A medium run on the ground-truth fixture reaches the expected counts; `/audit:act` commits one item (acceptance item 15).
- `/audit:resume --live` reruns stages 6 to 8 (acceptance item 16); `/audit:handoff --verdicts` applies matching lines (acceptance item 17).

## M5: repo-docs

Work items:

1. Manifest, `LICENSE`, `README.md`. Commit: `feat(repo-docs): add the plugin manifest and readme`.
2. `skills/repo-docs/SKILL.md`, `placement.md`, `spokes.md` (R197 to R206). Commit: `feat(repo-docs): add the skill`.
3. `hooks/drift.sh` and `hooks/hooks.json` (R207 to R211). Commit: `feat(repo-docs): add the drift hook`.
4. `tests/repo-docs/hook.test.mjs`: commit detection positives and negatives, missing path denies, cap overrun denies, recheck advice, adapter accepted, no hub quiet (R208 to R210). Commit: `test(repo-docs): cover the drift hook`.
5. `tests/repo-docs/fixture/messy/` builder: a repository with a long `CLAUDE.md` holding two scopes, a `docs/` file nothing points to, a nested `AGENTS.md`, an `@import`, and a README with agent rules (R204). Commit: `test(repo-docs): add the messy docs fixture`.

Check:

- `npm test` passes on all three operating systems.
- Bootstrap on an empty repository writes a hub under 60 lines (acceptance item 18).
- Adopt on the messy fixture produces the planned moves and rewrites in separate commits and changes nothing on a second run (acceptance item 19).
- The hook denies a commit whose hub names a missing path, allows it after the fix, and names a spoke to recheck when a covered file is staged (acceptance item 20).

## M6: catalog

Work items:

1. `.claude-plugin/marketplace.json` with four entries at `0.1.0-alpha.1` and the catalog's own `metadata.version` (R1, R14, decisions 32 and 58); M9 sets 0.1.0. Commit: `feat(catalog): add the catalog version`.
2. `README.md`: confirm the install, update and uninstall blocks match the catalog line for line and add whatever R219 requires. Commit only if something changed: `docs(readme): align install lines with the catalog`.
3. The repository's own `CLAUDE.md` hub, written with `/repo-docs` bootstrap (R16). Commit: `docs(repo): add the instruction hub`.

Check:

- `claude plugin validate --strict .` and each plugin pass.
- `/plugin marketplace add vibecodedapps-official/reimagine-claude` and `/plugin install <name>@reimagine-claude` work for each plugin alone (acceptance item 1).

## M7: lint

Work items:

1. `tools/lint.mjs` with every rule of R219 and the deny-token rule of R220. Commit: `feat(lint): add the repository rules`.
2. `tests/lint/lint.test.mjs`: a clean copy passes; one negative case per message. Commit: `test(lint): cover every rule`.

Check:

- `npm run lint` (the script exists in `package.json`) prints `lint: ok` with exit 0 on the tree; with `LINT_DENY_TOKENS` set to the implementer's list it still passes. The four `0.1.0-alpha.1` tags and their changelog headings exist, so the tag and changelog rules check them from the start.
- Each negative case fails with its message.

## M8: CI

Work items:

1. `.github/workflows/ci.yml`: test matrix with full history, the mawk job, the validate job with the pinned version (R222, decision 27). Commit: `ci: add lint, test, mawk and validate jobs`.
2. `.github/dependabot.yml` for actions. Commit: `ci: add dependabot for actions`.

Check:

- One green run on `main` across ubuntu, macOS and Windows (acceptance item 21).

## M9: release

Work items:

1. `tools/release.mjs` and `tests/release/release.test.mjs` (R221). Commit: `feat(release): add the version bump script`.
2. `CHANGELOG.md` headings `## rules 0.1.0`, `## loop 0.1.0`, `## audit 0.1.0`, `## repo-docs 0.1.0` with the date, written before the tags so lint passes right after tagging (R15). Commit: `docs(changelog): record 0.1.0`.
3. Tags `rules--v0.1.0`, `loop--v0.1.0`, `audit--v0.1.0`, `repo-docs--v0.1.0` with `claude plugin tag --push plugins/<name>` after the owner's approval (R14). No commit.
4. acceptance.md record entry for the release run (acceptance items 1 to 25).

Check:

- Lint passes after tagging; a one-line change under a plugin without a version bump fails the tag rule, and a bump to 0.1.1 passes with no 0.1.1 heading (acceptance item 22).

## Acceptance record

Every milestone's acceptance items are run in a scratch profile (`CLAUDE_CONFIG_DIR` outside the repository) and recorded in acceptance.md with date, machine and versions. An item that cannot run is recorded as not run with the reason.

## Out of scope

Everything in requirements 225 to 231.
