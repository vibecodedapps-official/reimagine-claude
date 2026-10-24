# Build plan: 0.1.0

Drafted 2026-10-14. requirements.md and architecture.md win over this plan. Requirements are cited as R1 to R283; the primer milestones M10 to M19 follow M9, and M20 to M28 follow them, each dated where it was added. Each milestone ends with its checks green on the implementer's machine; `npm test` runs from M1 on, `npm run lint` from M7 on, and the forbidden-name sweep (decision 10) runs before every commit from the first one. Pushes and pull requests follow the ask-first rules of the owner's instruction files; the handoff that starts the implementation says what is approved.

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
- `/plugin marketplace add vibecodedapps-official/reimagine-engine` and `/plugin install <name>@reimagine-engine` work for each plugin alone (acceptance item 1).

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

## Primer: M10 to M19

Added 2026-10-20. Requirements are cited as R1 to R268; the primer section is R237 to R268 and decisions 73 to 89 settle what the spikes changed. Each milestone ends with its checks green on the implementer's machine and its acceptance items recorded; lint runs with `LINT_DENY_TOKENS` set before every commit. The same orchestrator and subagent split as above. `main` is a release channel, so each milestone's push follows the owner's yes and takes the next prerelease version of any plugin it changes (decision 60).

| # | Milestone | Adds | Depends on |
|---|---|---|---|
| M10 | primer hook | `plugins/primer` manifest, `hooks/`, `tests/primer/hook.test.mjs`, catalog entry at `0.1.0-alpha.1`, lint names and shapes | - |
| M11 | shapes and placement | `skills/primer/shapes.md`, `placement.md`, the skill's frontmatter and mode selection | M10 |
| M12 | init | the `init` mode | M11 |
| M13 | adopt | the `adopt` mode, the messy fixture extended; this repository converted | M12 |
| M14 | maintain verify | the verify pass and `primer: no drift` | M13 |
| M15 | promote | the promote pass, the memory fixture, the stamp | M14 |
| M16 | propose | the propose pass and the session source | M15 |
| M17 | notice | `hooks/notice.sh` and its test | M15 |
| M18 | siblings | the audit source list, the loop brief line | M13 |
| M19 | catalog, retirement and release | README, `.claude/settings.json`, `repo-docs` deleted, primer 0.1.0, tags | M10 to M18 |

M18 may run beside M14 to M17. Nothing else runs in parallel: each milestone adds to `SKILL.md`, so two branches would conflict.

### M10: primer hook

Work items:

1. `plugins/primer/.claude-plugin/plugin.json` at `0.1.0-alpha.1`, `LICENSE`, `README.md` (install, requirements, a use section that says what each mode does, the migration line of R268). Commit: `feat(primer): add the plugin manifest and readme`.
2. `hooks/hooks.json` with the two hooks of R259 and `hooks/drift.sh` (R260 to R265): the commit-detection grammar, `cwd` and `-C` resolution, the hub lookup and the marker, the caps, the hub path check, the `paths` reader with its three forms, brace expansion and the `**/` prefix, `git ls-files` matching, the deny and advice forms. `hooks/notice.sh` is M17; until then `hooks.json` declares only the PreToolUse hook and lint's primer shape matches that. Commit: `feat(primer): add the drift hook`.
3. `tests/primer/hook.test.mjs`: the R260 positives and negatives; each R262 finding on a fixture repository with a hub, a nested `CLAUDE.md`, three rules (unscoped, block list, comma string) and a skill; the brace, slashless and `[` glob cases of decision 80 with literal file lists; the R263 advice for a rule, a skill and a nested file; the adapter and the direct `AGENTS.md` hub; no marker quiet; expected strings as literals. Commit: `test(primer): cover the drift hook`.
4. `tools/lint.mjs`: `primer` in the names, the two executables, the primer `hooks.json` shape beside the rules one, the primer description phrases (R219, R245); `tests/lint/lint.test.mjs` gains one negative case per new message. Commit: `feat(lint): know the primer plugin`.
5. Catalog entry for primer at `0.1.0-alpha.1`, `metadata.version` raised, README install, update and uninstall lines, `CHANGELOG.md` heading `## primer 0.1.0-alpha.1 - <date>` (R1, R14, R15, decision 87). Commit: `feat(catalog): publish primer at 0.1.0-alpha.1`.

Check:

- `npm test` and `npm run lint` with the deny tokens pass on Windows and on one POSIX machine; the hook suite passes under mawk.
- `claude plugin validate --strict` on the root and `plugins/primer`; `claude plugin tag --dry-run plugins/primer`.
- Acceptance item 27 on Windows; item 1 for primer from the local catalog, then from GitHub after the push.

### M11: shapes and placement

Work items:

1. `skills/primer/shapes.md`: one template per row of the architecture's shape table, the caps, the counting rule, the marker, the `AGENTS.md` rule and the `CLAUDE.local.md` case (R238 to R240, R243, R244). Commit: `feat(primer): add the shapes`.
2. `skills/primer/placement.md`: the eleven items with the tasks test and one example each, the personal-content report (R241, R252). Commit: `feat(primer): add the placement rule`.
3. `skills/primer/SKILL.md`: name, the description with the four phrases first, `allowed-tools` for the read-only git and file reads every mode needs, the mode selection and the first-line mode statement, the write boundary, the commit rules, the proposal format shared by skills and memory, and a stub per mode that says what the mode will do and stops (R245 to R247). Commit: `feat(primer): add the skill core`.
4. `tests/primer/skill.test.mjs`: the frontmatter, the phrases, the cap of R240 on the skill's own files, every file `SKILL.md` names existing. Commit: `test(primer): cover the skill files`.

Check:

- `npm test`, lint; the skill answers to `/primer` and `/primer:primer` and prints its mode line on a throwaway repository with no instruction file (acceptance item 28, the mode line only).

### M12: init

Work items:

1. The `init` mode in `SKILL.md` (R248): what it reads, the hub it writes uncommitted, the first rules and skills it proposes, the `/init` sentence. Commit: `feat(primer): add the init mode`.

Check:

- Acceptance item 28 on a throwaway repository with code, a `CONTRIBUTING.md` procedure and a release script: a hub under 60 lines with the marker and the three parts, a proposal for the procedure and the script, nothing written without a yes.

### M13: adopt

Work items:

1. `tests/primer/fixture/messy/build.sh`: the repo-docs messy fixture's content plus a repo-docs hub with a `## Spokes` index whose pointers cover a file pattern, a task and a directory, a procedure in `CONTRIBUTING.md`, an `@notes/local.md` import of an untracked file, a `.claude/CLAUDE.md`, and a README with agent rules, deterministic as the audit fixtures are; `tests/primer/fixture.test.mjs` checks the build. Commit: `test(primer): add the messy docs fixture`.
2. The `adopt` mode in `SKILL.md` (R249): inventory, the refactor conditions, what pins a file (decision 53), the destinations, the kept-statement check, moves before rewrites, the migration from a `## Spokes` hub, the `CLAUDE.local.md` adapter proposal. Commit: `feat(primer): add the adopt mode`.
3. Adopt on this repository, as the milestone's acceptance: the run's own commits (the hub with the marker, no index, the five design documents in backticks in the opening sentence; whatever rules or skills the plan proposes and the owner accepts), then `chore(repo): enable primer for sessions here` switching `.claude/settings.json` and the README development paragraph to `primer@reimagine-engine` (R16, R268 in part). The repo-docs hook stays installed on the owner's machine and prints nothing once no index remains.

Check:

- Acceptance item 29 on the messy fixture, twice; item 30 on this repository, with the drift hook denying a commit after a path in the opening paragraph is broken.

### M14: maintain verify

Work items:

1. The `maintain` mode's verify pass in `SKILL.md` (R250, R251): the hook's findings, commands against manifests and workflows, statements against the files they cover, skill steps' commands and files, lost procedures, duplicates, oversized skills, the `/doctor prompt-audit` sentence, `primer: no drift`. Commit: `feat(primer): add the verify pass`.

Check:

- Acceptance item 31: on the adopted messy fixture, remove a command from `package.json` and rename a file a rule describes; the plan lists both; after the fix a second run prints `primer: no drift`.

### M15: promote

Work items:

1. `tests/primer/fixture/memory/build.sh`: a memory directory in the layout of decision 83 with one note per type, the index written with the em dash as an octal escape, and a stamp older than two of the notes; `tests/primer/fixture.test.mjs` checks it. Commit: `test(primer): add the memory fixture`.
2. The promote pass in `SKILL.md` (R256, R257): the directory and key, the candidates by type, the proposal lines, the separate deletion question, the stamp. Commit: `feat(primer): add the promote pass`.

Check:

- Acceptance item 32 on a scratch profile whose `projects/<key>/memory/` is the fixture: the `feedback` note becomes a constraint, the undated `project` note a rule, the `reference` a sentence in the hub, the `user` note is not offered; the deletion is asked per note and a no leaves the file.

### M16: propose

Work items:

1. The propose pass in `SKILL.md` (R253 to R255): the four sources, the candidate display, what a written skill holds, what leaves the instruction file, the never list, the session source raised once at the end of a task. Commit: `feat(primer): add the propose pass`.

Check:

- Acceptance item 33: on the adopted messy fixture the `CONTRIBUTING.md` procedure is a candidate and the release script is not, since the adopted `release` skill runs it; a yes writes `.claude/skills/<name>/SKILL.md` under 150 lines with a description and `CONTRIBUTING.md` unchanged (decision 91); in a new session, "turn this into a skill" after a pasted checklist invokes the skill for that item alone.

### M17: notice

Work items:

1. `hooks/notice.sh` (R258) and its entry in `hooks.json`; lint's primer hook shape becomes the two-hook form (R259). Commit: `feat(primer): add the memory notice`.
2. `tests/primer/notice.test.mjs` on the memory fixture: the count with and without a stamp, `user` and `reference` notes ignored, no marker quiet, the worktree key of decision 83, nothing written. Commit: `test(primer): cover the memory notice`.

Check:

- Acceptance item 34, headless and then interactive: the line appears after a new note and disappears after a promote pass.

### M18: siblings

Work items:

1. Audit: `.claude/rules/` and `.claude/skills/` in the default source list of stage 1, stage 9 and `common.md` (R267); audit `0.1.3`. Commit: `feat(audit): rank project rules and skills as sources of truth`.
2. Loop: the brief line of R267 in `steps/4-build.md`; loop `0.1.3`. Commit: `feat(loop): bind a loaded rule in the implementer brief`.
3. CHANGELOG headings for both, tags after the push.

Check:

- `npm test`, lint; acceptance item 35, a low-tier audit run whose stage 1 source list names the two directories.

### M19: catalog, retirement and release

Work items:

1. Delete `plugins/repo-docs/` and `tests/repo-docs/`; remove the catalog entry and the README install, use, update and uninstall lines for repo-docs; lint's names drop `repo-docs` and the changelog rule keeps accepting its headings; the README line of R268. Commit: `refactor(catalog): retire repo-docs`.
2. `node tools/release.mjs primer 0.1.0`, the README status line, `CHANGELOG.md` heading `## primer 0.1.0 - <date>`. Commit: `release(primer): 0.1.0`.
3. Tags `primer--v0.1.0` after the owner's approval; the acceptance record.

Check:

- Lint passes after tagging; `claude plugin validate --strict` on the root and each remaining plugin; acceptance item 1 for primer from GitHub, item 21, item 22 at the new tag, item 36.

## Host alignment: M20 to M23

Added 2026-10-22. Requirements R270 to R276, decisions 94 to 103, acceptance items 37 to 43; the spikes are recorded under "pre-implementation spikes for host alignment" in acceptance.md. The same orchestrator and subagent split as above; each milestone ends with its checks green and its acceptance items recorded, lint runs with `LINT_DENY_TOKENS` set before every commit, and each push follows the owner's yes at the next version of any plugin it changes. These milestones are built after M25 and M24.

| # | Milestone | Adds | Depends on |
|---|---|---|---|
| M20 | review file | `REVIEW.md` in the audit's source lists and the loop's review request; the fixture; audit and loop versions | - |
| M21 | evals | the eval cases under `tests/evals/`, `npm run eval`, the release-order line in README | - |
| M22 | measurement | the startup-cost item and the auto-mode items run and recorded; the preamble sentence | - |
| M23 | workflow engine | the script, the stage 4 engine switch, resume, lint rules, item 15 through the engine; audit version | M20; the gate of R270, not met on 2026-10-22 (decision 103) |

M20, M21 and M22 may run in parallel, since none touches `plugins/primer/` or another's files; every edit to `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `tools/lint.mjs` and `README.md` is serialized. M23 runs alone, after M20, since both edit the audit's stage files, and only when its gate is met: the spikes of 2026-10-22 assessed it and found it not met (decision 103), so M23 is not built in this pass and waits for the reopening decision 103 names.

### M20: review file

Work items:

1. Audit: `REVIEW.md` at the root and in the parent directories of each changed file, read at the base commit, in the default source list of stage 1, stage 9 and `common.md`; stage 1 records the copies read and their shas; the report's severity labels, the `<n> findings skipped by REVIEW.md: <rule>` line, the "always check" pass-one check and the "require evidence" gate (R271). `tests/audit/fixture/build.sh` gains a `review` mode, or extends `patterns`, with a root `REVIEW.md` that caps nits, excludes one path and requires a `file:line` citation for one class, and a second bundle whose `REVIEW.md` exists only in its head; `tests/audit/lint.sh` learns the new list entry. Audit takes its next version. Commit: `feat(audit): read the base commit's review file as a source of truth`.
2. Loop: the one sentence of R272 in `steps/4-build.md`; loop takes its next version. Commit: `feat(loop): name the review file in the final review request`.
3. After the push: the CHANGELOG headings for both, commit `docs(changelog): add the audit and loop headings` naming the versions, pushed, then `claude plugin tag --push` for each; the acceptance record, commit `docs(acceptance): record the review file milestone`.

Check:

- `npm run test:audit` and `npm run test:loop` on each commit; `npm test` and lint with the deny tokens before the push.
- Acceptance item 37 on both bundles, headless, with the permission mode recorded.

### M21: evals

Work items:

1. `tests/evals/loop/prose-trigger/`, `tests/evals/loop/bundled-loop/`, `tests/evals/primer/mode-line/`, each `prompt.md` with `plugins`, `max_turns` and `allowed_tools` and its `graders/` (R273, decision 100), in the form of the spike's two cases; `tests/evals/results/` in `.gitignore` beside the ignore list of R224, whose text gains the entry. Commit: `test(evals): add the trigger and mode-line cases`.
2. `package.json`: `"eval": "claude plugin eval . --eval-dir tests/evals --runs 2 --no-publish"`; README's development section names it and its needs (the host's eval command, a login, git 2.31 or later), and the release order runs it after the changelog heading and before the tag. Commit: `chore(repo): add the eval script and its release step`.

Check:

- Lint and `npm run test:lint`; acceptance item 38: every case at 2 of 2 with the plugin, the forced failure reported, the scores recorded with the host version and the permission mode, commit `docs(acceptance): record the evals milestone`.

### M22: measurement

Work items:

1. acceptance.md: nothing to build; item 39 run and recorded as the baseline of R274, item 40 to 42 run under `--permission-mode auto` with every refusal verbatim, and the records naming the permission mode (R275). A difference from the manual-mode runs becomes a decision. Commit: `docs(acceptance): record the startup cost and the auto-mode pass`.

Check:

- Items 39 to 42 recorded; nothing under `plugins/` changed.

### M23: workflow engine

Built only when the gate of R270 is met and recorded. Work items:

1. `plugins/audit/workflows/passes.js` (R270): the literal `meta`, three `phase()` calls, `agent()` with `schema` for every unit, the agent counts from the baseline record; stage 4's engine selection and the `engine` field with its reason, stages 5 and 6 reading the script's return from the run directory; `stages.json` gains the session id, run id, script path and phase reached, and `resume.md` relaunches with `resumeFromRunId` (R161). Decisions 21 and 24 gain a sentence each on what the workflow path makes unnecessary. Audit takes its next version. Commit: `feat(audit): run passes one, two and the second opinion as a workflow`.
2. `tools/lint.mjs`: the workflow rule of R219 and R6's script list; `tests/lint/lint.test.mjs` gains one negative case per message. Commit: `feat(lint): check the audit workflow script`.
3. After the push: the CHANGELOG heading, commit `docs(changelog): add the audit <version> heading`, pushed, then the tag; the acceptance record, commit `docs(acceptance): record the workflow engine milestone`.

Check:

- `npm test` and lint; acceptance item 43: item 15's counts through the engine at tokens at or under the baseline, both recorded; the stopped run relaunched; `disableWorkflows` forcing `engine: prompt`; the prompt-path result on the same fixture unchanged.

## House-rule edit eight: M24

Added 2026-10-22. Requirement R269, decision 93. Built after M25 and before M20 to M23. Depends on nothing; touches `plugins/rules/` and `tests/rules/` only.

| # | Milestone | Adds | Depends on |
|---|---|---|---|
| M24 | house-rule edit eight | the Working item and the chat block line, the test assertion and the moved digest literals, rules 0.1.5 | - |

### M24: house-rule edit eight

Work items:

1. The item of R269 in `plugins/rules/rules/core.md` under Working, after "A review is read-only unless I ask for changes.", wrapped like its neighbors; the one line under Content in the fenced block of `plugins/rules/chat/instructions.md`, which is not listed among the block's deliberate differences, since it does not differ from the item. `tests/rules/rules.test.mjs`: an `items.includes` assertion for R269 beside those of R19 to R236, and the shipped digest literals for `core` and `core,windows`, the rule count and any adopt line numbers, moved by running the script once and pasting the observed values (decision 11), in the same commit. Commit: `feat(rules): judge findings, do not count them`, body in the form of the 2026-10-18 commit `feat(rules): raise the request and its frame, and never route around a denial`.
2. `node tools/release.mjs rules 0.1.5`. Commit: `release(rules): 0.1.5`.
3. After the push: the `## rules 0.1.5 - <date>` heading in `CHANGELOG.md`, commit `docs(changelog): add the rules 0.1.5 heading`, pushed, then `claude plugin tag --push plugins/rules`; the acceptance record, commit `docs(acceptance): record the house-rule edit eight milestone`.

Check:

- `npm run test:rules` on each commit; `npm test` and lint with the deny tokens before the push.
- Acceptance items 4 and 22 rerun: the staleness notice on a profile holding the 0.1.4 block, headless, with the display of the notice recorded as not seen; the tag rule at `rules--v0.1.5`; each recorded with date, machine, versions and permission mode.

## Test performance: M25

Added 2026-10-22. Requirements R277 to R279, decisions 104 to 108, acceptance item 44. M25 is built first, before M24 and M20 to M23, so that every later milestone pays less for its checks. The suite's coverage does not change: no test is weakened, skipped or deleted, every script keeps its test (R6), fixture literals stay observed (decision 11) and everything still runs on ubuntu, macOS and Windows (R17); CI's matrix is unchanged. Depends on nothing; touches `package.json`, `CLAUDE.md`, `tests/` and `plugins/audit/scripts/revert-tests.sh`.

| # | Milestone | Adds | Depends on |
|---|---|---|---|
| M25 | test performance | the area scripts and the policy line, concurrency in the lint and primer hook suites, the `revert-tests.sh` tick, the after-timings | - |

### M25: test performance

Work items, each its own commit, in this order:

1. `tests/lint/lint.test.mjs`: the cases move under one `describe` with `concurrency` set from `availableParallelism()` as `tests/audit/sh.test.mjs` does, with the `before` and `after` hooks inside it; each case keeps its own copy of the repository from `caseDir()` and the `seq` counter stays synchronous, so nothing is shared. `tests/primer/hook.test.mjs`: the groups whose cases each build their own repository with `make()` get `concurrency`; the "files the command itself stages" group shares one fixture through `before` and stays serial. Commit: `test(perf): run independent cases concurrently`.
2. `plugins/audit/scripts/revert-tests.sh`: `REVERT_TESTS_TICK` (R279), read beside the three variables it already reads, with the poll loops at one tick, the `wait` interval at two and the watchdog's TERM-to-KILL grace at ten; a value is validated as the others are. `tests/audit/revert-tests.sh` exports a low tick and keeps every `sleep 60` fixture the watchdog ends; the suite proves the default is unchanged by one case that runs with the variable unset. Audit takes its next version in the same commit. Commit: `feat(audit): read the poll tick from the environment`.
3. `package.json`: the six area scripts of R277; `CLAUDE.md`'s `## Commands`: one bullet per area script, or one bullet naming the pattern, and the policy line, under the 60-line cap (R238). Commit: `chore(repo): add the area test scripts`.
4. The after-timings: each test file alone with `node --test --test-reporter=spec`, then `npm test` and `npm run lint` whole, on the machine of the baseline, recorded under acceptance item 44 beside the baseline, with the permission mode line; a missed target is recorded by how much and which lever fell short.

Lever 4 of the pass, lint's concurrent syntax check, is already in the code (decision 107), so R278 is a review item and no commit.

Check:

- `npm test` and lint with the deny tokens pass on Windows and on one POSIX machine; the audit sh suites pass under mawk with the tick set and unset.
- Acceptance item 44: a full `npm test` at half the baseline or better and every area script under 30 seconds except `test:audit`, whose target is the baseline of `revert-tests.sh` alone divided by the tick ratio.
- After the push, the `## audit <version> - <date>` heading for the version item 2 set, commit `docs(changelog): add the audit <version> heading`, pushed, then `claude plugin tag --push plugins/audit`; the after-timings of item 4 and the record, commit `docs(acceptance): record the test performance milestone`.

## House-rule edit nine and Concise Plain 4.6: M26

Added 2026-10-24. Requirement R280 and the amended R43, decision 111. Built after M20 to M25. Depends on nothing; touches `plugins/rules/`, `tests/rules/`, `tools/lint.mjs` and `tests/lint/` only.

| # | Milestone | Adds | Depends on |
|---|---|---|---|
| M26 | house-rule edit nine and Concise Plain 4.6 | the Done item, the test assertion and the moved digest literals; the four style changes in the style and the chat block, and the lint literal at 4.6; rules 0.1.6 | - |

### M26: house-rule edit nine and Concise Plain 4.6

Work items, in this order:

1. The design documents: R280 in the form of R269 and R43 at version 4.6 in `docs/requirements.md`, decision 111 in `docs/decisions.md`, and this section. Commit: `docs(design): specify house-rule edit nine and concise plain 4.6`.
2. The item of R280 in `plugins/rules/rules/core.md` at the end of Done, wrapped like its neighbors. `tests/rules/rules.test.mjs`: an `items.includes` assertion for R280 beside that of R269, and the shipped digest literals for `core` and `core,windows`, the rule count and any adopt line numbers, moved by running the script once and pasting the observed values (decision 11), in the same commit. Commit: `feat(rules): report an edit from the diff, not the plan`.
3. `plugins/rules/output-styles/concise-plain.md`: the four changes of decision 111, the description ending in `v4.6.`; `plugins/rules/chat/instructions.md`: the same four changes inside the fenced block and the header line at `Concise Plain v4.6`, the list of deliberate differences unchanged; `tools/lint.mjs` and `tests/lint/lint.test.mjs`: the `v4.5` literals become `v4.6`. Commit: `feat(rules): concise plain 4.6, drafts for the reader and words as they were put`.
4. No version bump: the rules manifest and its catalog entry are already 0.1.6, above `rules--v0.1.5`, from the rename commit (decision 110); `git tag --list 'rules--v*'` and lint confirm it.
5. After the push: the `## rules 0.1.6 - <date>` heading in `CHANGELOG.md`, one bullet per change, the rename included, commit `docs(changelog): add the rules 0.1.6 heading`, pushed, then `claude plugin tag --push plugins/rules`; the acceptance record, commit `docs(acceptance): record the house-rule edit nine milestone`.

Check:

- `npm run test:rules` and `npm run test:lint` on each commit of items 2 and 3, each run as its own command with its exit code read; `npm test` and lint with the deny tokens before the push.
- Acceptance items 4, 5 and 22 rerun: the staleness notice on a profile holding the 0.1.5 block; the style listed as `rules:Concise Plain`; the tag rule at `rules--v0.1.6`; each recorded with date, machine, versions and permission mode.

## Field feedback 2026-10-23: M27 and M28

Added 2026-10-24. Requirements R281 to R283 and the amended R6, R50, R56, R76, R77, R81, R88, R116, R125, R139, R159, R184 and R193; decision 112; acceptance item 45. Eight findings from field runs of loop 0.1.4 and audit 0.1.6, verified against the shipped texts on 2026-10-24; one was dropped and the record helper of decision 31 stays deferred (decision 112). Two sub-milestones under one heading, since the plugins release separately: M27 touches `plugins/loop/` and `tests/loop/`, M28 `plugins/audit/`, `tests/audit/` and `tools/lint.mjs`. Neither bumps a version: the manifests already carry loop 0.1.5 and audit 0.1.7 from the rename commit (decision 110), above `loop--v0.1.4` and `audit--v0.1.6`. Each commit runs the area scripts that cover what it touched, each as its own command with its exit code read; `npm test` and lint with the deny tokens run once before the push.

| # | Milestone | Adds | Depends on |
|---|---|---|---|
| M27 | loop field feedback | the "primary <path>" and "base <branch>" phrases, the `base` key, the decided-by mapping | - |
| M28 | audit field feedback | `scripts/run-copies.sh` with its suite, the stage 7 slice-first mode choice, the stage 8 body sentence, the two act texts, the decided-by table | - |

M27 and M28 touch no common file but the design documents, which the first commit carries, and may proceed in either order.

### M27: loop field feedback

Work items, in this order, each test written first and seen failing against the untouched text:

1. The "primary <path>" phrase (R281, R50, R77): the grammar line in `SKILL.md` and `README.md`, the Scope line of the reading block, a "Primary checkout" item at the head of Step 0 in `steps/0-preflight.md` that resolves `<checkout>` and ends `blocked` on a path that is not a toplevel or a linked worktree, the `git -C <checkout>` and `cd <checkout> && ...` forms of `worktree.md` for every primary command, the permission statement's prompt line, Step 0.2.3's third way around, Step 0.2.5's switch in `<checkout>`, Step 0.3's exception limited to a main checkout, and the record location of `record.md` and `SKILL.md` for a named linked worktree. `tests/loop/preflight.test.mjs`: text assertions for the phrase, the stop, the third way around and the record location. Commit: `feat(loop): name the primary checkout with primary <path>`.
2. The "base <branch>" phrase and the `base` key (R282, R76, R81, R88, R116, R56, R125): the grammar line in `SKILL.md` and `README.md`, the Mode line, Step 0.2.1 resolving `<b>` from the phrase, the key, then the default, with the fetch failure ending `blocked`, the pull request base check of 0.2.7, `run.md` at 0.5, the `base` key in 0.1.2 and in the byte-identical configuration block of `SKILL.md` and `README.md`, `<default>` to `<base>` in `steps/7-publish.md`, `steps/4-build.md` 3.7.2, `risk.md`, `record.md` and `ci-watch.md`, and the primary-only sentence in `multi-repo.md`. `tests/loop/config.test.mjs`: the key list gains `base`; `tests/loop/preflight.test.mjs`: the resolution order and the Mode line. Commit: `feat(loop): take the base branch from the request or the configuration`.
3. The decided-by mapping (R139): `handoff.md`'s `run` line reads `role: orchestrator`. `tests/loop/handoff.test.mjs`: the table of R139 is present and identical to the audit's. Commit: `fix(loop): map a run decision to a role in the handoff`.

Check:

- `npm run test:loop` and `npm run test:lint` on each commit; the `SKILL.md` core stays under 5,800 words.
- Acceptance item 45, item 8's plan-only run rerun headless on a throwaway repository with a linked worktree and a branch other than the default: once with "primary <linked worktree path>" from the main checkout, once with "base <branch>"; the Scope and Mode lines, the record's location and `run.md`'s base recorded.

### M28: audit field feedback

Work items, in this order:

1. `scripts/run-copies.sh` (R283, R6, R184) and `tests/audit/run-copies.sh`: a relocated copy of the script under a temporary root with a small `skills/audit/common.md` and `audit-evidence.md`, so the whole output is a literal and the `$0`-relative lookup is exercised, each bad argument with its exit code and message, and the shipped files, whose header lines are literals and whose body is compared byte for byte with its source; registered in `tests/audit/sh.test.mjs` beside its siblings and run under mawk where one is installed. `tools/lint.mjs`'s executable list gains it. Step 10d of `stages/1-orient.md` writes `questions.md` and runs the script. Commit: `feat(audit): copy the run's common files with a script`.
2. Stage 8 step 6: the body is written with the Write tool; only the revision line and the assembly of `report.md` run by shell. Commit: `fix(audit): write the report body with the write tool`.
3. Stage 7 step 5 (R159): assign the ids and cut the slices first, with the commands of step 7, then choose split mode when a slice passes the threshold or the sum passes three times it, else remove the slices; step 7 keeps the part cutting; step 12's entry gains the largest slice; `fault-injection.md`'s `ledger_split_bytes` bounds a slice. Commit: `feat(audit): split the merge on the largest slice`.
4. Stage 9 step 10 and `SKILL.md`'s Supporting files: the live line reads the blocks in `report.md`, whose grammar is in the skill's `live.md`, and `live.md` is a skill document, not a run file. Commit: `fix(audit): name report.md as the home of the live blocks`.
5. Stage 9 step 4 (R193): the first yes covers the path for the invocation; a later exit-0 rewrite is restored and logged with its new hash; the path is never staged with a group; a fix that touches it stops; the close names the regenerated paths once. Commit: `feat(audit): approve a regenerated path once per act`.
6. `handoff.md` (R139): the decided-by table after the format block, cited from rule 12 and from "Writing a handoff" step 7. `tests/audit/handoff.test.mjs`: the table is present and identical to the loop's. Commit: `fix(audit): carry the loop's decided-by mapping in the handoff`.

Check:

- `npm run test:audit` and `npm run test:lint` on each commit; the sh suites once under mawk where one is installed, else recorded as not run.
- Acceptance item 14 rerun, headless, which exercises `run-copies.sh` and the stage 8 sentence; its stage 7 entry records the byte total, the largest slice and the threshold.

### After the push

The `## loop 0.1.5 - <date>` and `## audit 0.1.7 - <date>` headings in `CHANGELOG.md`, one bullet per change, the rename bullet of decision 110 in each and the audit's "A run started on 0.1.6 resumes from stage 1" bullet, commit `docs(changelog): add the loop 0.1.5 and audit 0.1.7 headings`, pushed; then `claude plugin tag --push plugins/loop` and `claude plugin tag --push plugins/audit`, each after a yes; items 21 and 22 at the two tags; the acceptance record under a "field feedback 2026-10-23" heading, commit `docs(acceptance): record the field feedback milestones`.

## Acceptance record

Every milestone's acceptance items are run in a scratch profile (`CLAUDE_CONFIG_DIR` outside the repository) and recorded in acceptance.md with date, machine and versions. An item that cannot run is recorded as not run with the reason.

## Out of scope

Everything in requirements 225 to 231, 266 and 276.
