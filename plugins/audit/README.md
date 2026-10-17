# audit

Audit a set of pull requests or branches against their tickets, and stop at a report. The audit is read-only and adversarial: it runs nine stages, from orient to act, and every finding must cite evidence. A finding counts only after a fresh adversary other than its author challenged it and a second opinion saw it. The audit changes nothing until you ask it to act on items you approve.

## Install

```
/plugin marketplace add vibecodedapps-official/reimagine-claude
/plugin install audit@reimagine-claude
```

## Requirements

- Node 22 or later.
- On Windows, Git for Windows.
- `jq` for three parts: the live checks, the validation of `work-items.jsonl`, and the check for collisions with open pull requests. On Windows, `winget install jqlang.jq`; on macOS, `brew install jq`, or the `/usr/bin/jq` that macOS 15 and later ship.

Without `jq`, everything else runs. Stage 1 says what it will skip. No other tool is required.

## Use

Say it in plain words:

- `reimagine audit PR 123 and 124 in app, tickets AB#4567 and AB#4580`
- `reimagine audit ./audit-manifest.json`
- `/audit:run` followed by the same words

Inputs in the request:

- `PR <n>`, `#<n>`, or a pull request URL.
- `in <path>`: the repository. The default is the session's repository.
- `branch <b> against <base>`: audit a branch instead of a pull request.
- `tickets <id>, <id>`: the tickets the work answers to.
- `file:<path>`: an exported ticket or pull request (see below).
- A path ending in `.json`: the manifest. The loop's handoff writes this file.

Phrases the audit recognizes:

- `effort low`, `effort medium`, `effort high`, or the tier word alone as its own phrase: sets the tier.
- `budget <n> minutes`: a soft time budget for this invocation.
- `<role> on <model>`: run a role on another model, for example `auditor on sonnet`. Roles are digester, mapper, auditor, adversary, merger and second opinion. Models are opus, sonnet, haiku and fable.

Everything else goes in the manifest.

Before it does anything else, the audit prints what it read: bundles, references, sources of truth, claims files, effort, budget, model overrides, and how each ticket was found. Then it asks you to pause background fetch, for example VS Code `git.autofetch`, since a fetch during the run can stop it.

Commands:

- `/audit:run <manifest or inputs>`: start a run. It takes no flags.
- `/audit:resume <run-id> [--from <stage>] [--live <file>]`: continue a run, or rerun from a stage.
- `/audit:act <run-id> <item-id...> [--per-item]`: commit the approved items.
- `/audit:handoff [--out <path>] [--verdicts <claims-verdicts.md>] [--memory <dir>]`: write a typed handoff from a build session.

## The manifest

A JSON file. Relative paths in it are relative to the manifest's directory. Every key below is shown; only `bundles` is needed.

```json
{
  "bundles": [
    { "repo": "./app", "pr": "#123", "tickets": ["#40", "file:./exports/AB-4567.md"],
      "ticket_token": "AB#{n}", "run_once": ["migrations/**"],
      "test_command": "npm test --", "test_run": ["test/**/*.test.js"],
      "test_paths": ["test/**"], "test_setup": "npm ci", "test_timeout": 300 },
    { "repo": "./api", "branch": "feature", "base": "main", "head": "working-tree",
      "tickets": ["file:./exports/AB-4580.md"] }
  ],
  "references": [ { "name": "shared-lib", "path": "./shared-lib", "ref": "main" } ],
  "sources_of_truth": [ { "rank": 1, "name": "guidelines", "path": "./guidelines", "ref": "main" } ],
  "claims": ["./session-summary.md"],
  "scratch": "./app/.scratch",
  "forge_exports": { "command": "export-tickets --project AB", "exported_at": "2026-10-01T09:00:00Z" },
  "groups": [ { "name": "accounts", "repo": "./app", "files": ["src/users.js", "migrations/**"] } ],
  "questions": "./questions.md",
  "models": { "adversary": "fable", "second-opinion": "opus" },
  "budget": 90,
  "max_agents": 8,
  "_test": {}
}
```

- `bundles`: the work to audit, one entry per repository.
  - `repo`: the local checkout.
  - `pr`, or `branch` with `base`: what to audit.
  - `tickets`: the ticket ids or `file:` exports.
  - `ticket_token`: how commit messages name an exported ticket; `{n}` stands for its id.
  - `run_once`: glob patterns for run-once files, such as database migrations.
  - `head`: only `working-tree`, which audits the uncommitted state of the checkout.
  - `test_command`: runs the changed tests with the change reverted. Setting it is your consent to run the repository's own commands.
  - `test_run`, `test_paths`, `test_setup`, `test_timeout`: the test files to run, the paths that hold test code, a setup command, and seconds per command (default 300).
- `references`: other repositories to read, each pinned to a ref.
- `sources_of_truth`: ranked sources that decide what is right. This replaces the default order.
- `claims`: files that state what the work claims to do, such as a session summary or a handoff.
- `scratch`: where the run directory goes (see below).
- `forge_exports`: the command and time that produced the export files. It is recorded and never run.
- `groups`: review groups by file pattern. This replaces the groups the audit derives from tickets.
- `questions`: `default`, or a file of `id: question` lines. A line `extends: default` keeps the four default questions.
- `models`: the model for a role: `digester`, `mapper`, `auditor`, `adversary`, `second-opinion` or `merger`.
- `budget`: a soft budget in minutes.
- `max_agents`: how many agents run at once. The default is 8.
- `_test`: fault injection for the plugin's own tests. Leave it out.

An error names the key that is wrong.

### Exported tickets and pull requests

A ticket or pull request on a host without a tool goes in as a `file:` export, in markdown with frontmatter or in JSON. A ticket requires `id`, `url`, `title`, `state` and `description`. A pull request requires `id`, `url`, `title` and `body`. Every export also requires `source`, `exported_by` and `exported_at`. A missing key stops the run before stage 1. An Azure DevOps or Salesforce MCP tool, when present, can read a ticket instead.

## Effort tiers

The size of the work sets the default tier:

- `low`: one bundle, one ticket, and under 500 changed lines.
- `medium`: up to three bundles, five tickets, and under 5,000 changed lines.
- `high`: anything larger.

A phrase such as `effort high` overrides the default. The tier sets the scopes of the first pass, how much the second pass attacks, and whether the late adversary runs.

## Roles and models

| Role | Stage | Default model |
|---|---|---|
| digester | 2 | haiku |
| mapper | 3 | sonnet |
| auditor | 4 | opus |
| adversary | 5 and 7 | opus, fresh context |
| second opinion | 6 | fable, a fresh adversary; then opus |
| merger | 7 | sonnet |

The session model runs the stages. The `models` key, or a prose override, sets any role to opus, sonnet, haiku or fable. Every agent runs in the background with its own scratch folder. A failed agent is relaunched by a fixed ladder, and any model swap is named in the report.

## Where the run lives

Each run gets `<scratch>/audit/<run-id>/`, with an id like `2026-10-15-0930-app-123`. Scratch is the first of:

1. the manifest's `scratch` key, which must lie inside the primary repository and be ignored, or inside the main checkout of a linked worktree;
2. `scratch/`, `tmp/` or `.scratch/`, when present and ignored;
3. `.reimagine/`, when it is already ignored;
4. the plugin data directory, under `runs/`.

The registry `runs.json` in the plugin data directory lists every run with its path, primary repository, creation time and state. Apart from the approved fetch and the working-tree objects named under the read-only boundary below, the audit never writes `.git/info/exclude` or any other file of the git directory.

## The read-only boundary

During `/audit:run` and `/audit:resume`, the audit changes nothing in an audited repository: not tracked files, untracked files that are not ignored, the index, branches, tags, stashes, config or remotes. Every bundle, reference and source of truth counts as audited. It writes its run directory and its data directory. The report discloses the other writes: a fetch you approve updates remote-tracking refs, a `head: working-tree` bundle adds unreferenced objects to the object store, and a `test_command` you set may write outside the audited repositories.

- Agents have no Edit or NotebookEdit tool, and run only read-only commands.
- A snapshot taken before stage 1 is checked after every stage. Any change to an audited repository during a run stops it as `blocked`, your own edits included.
- Live data, such as a database query or a production log, enters only from a file you supply with `--live`. The audit never fetches it.

## How a run ends

- `reported`: every applicable stage completed and the report is written.
- `partial`: a report is written, but a stage failed or the budget ran out. The verdict is `audit incomplete`. Continue with `/audit:resume <run-id>`.
- `blocked`: no report could be written, or the read-only check failed. Finished stage files stay.

The report gives a verdict of `not ready`, `merge after fixes` or `ready to merge`, the findings by ticket, and the exact `/audit:act` line for the recommended items. Proposed ticket changes go in `work-items.jsonl`, which is never applied.

## Live checks

When a finding needs live data, the report holds a `live <id>` block with the exact query and where to run it. Run it yourself, put the results in a file, and pass it with `/audit:resume <run-id> --live <file>`. The file must match the report's revision and the exact query; a finding result reruns stages 6 to 8.

## Act

`/audit:act <run-id> <item-id...>` commits the items you approve, by id. It first checks that the report is unchanged, that HEAD is the bundle branch, and that the tracked tree is clean; it never stashes, resets, cleans or checks out. It shows commits made since the audit and asks before it goes on. It runs the checks before the first change, makes one commit per ticket and repository (or per item with `--per-item`), shows each staged diff and asks before each commit. It never skips hooks. Act never pushes, and never edits a ticket unless you say so for that item. It ends with what was and was not committed, whether a force push is owed, and the log path.

## Handoff

`/audit:handoff` writes a typed handoff from a build session, for the audit to read as a claims file. `--out <path>` sets the file, which must be outside every repository or ignored, and is never overwritten. `--verdicts <claims-verdicts.md>` applies the verdicts of a finished audit, but only lines whose file hash and claim text still match; the rest become work to reconcile. `--memory <dir>` lists the memory files that mention a claim the audit found false, and edits nothing.

## Uninstall

Run `/plugin uninstall audit@reimagine-claude`. The run registry and any runs in the plugin data directory stay, and so do run directories in your repositories; delete them if you want them gone.

## License

Apache-2.0. See `LICENSE`.
