# Handoff format

A handoff is a build session's typed account of a bundle of work. For each ticket it gives
the ticket's fields, the problem, the decision, the commits and what the session says it
verified; for each decision, its rationale, the options, who decided, where the decision
is recorded and its status; for each ticket raised during the work, how confident the
session is that it belongs in the bundle. `/audit:handoff` writes one (the skill mode
`command: handoff`, procedure below). An audit reads one when the manifest's `claims` key
lists it: stage 1 recognizes it with `handoff.sh detect`, validates it with
`handoff.sh check` and turns every item into a typed claim with `handoff.sh claims`. A
handoff is a set of claims to verify, never a source of truth.

This file is the single home of the format. `${CLAUDE_PLUGIN_ROOT}/scripts/handoff.sh`
follows it, and `stages/1-orient.md` reads handoffs by it.

## Layout

A handoff is a UTF-8 markdown file. Lines end in LF or CRLF: one CR before each LF is
removed before parsing, and line numbers stay physical. A UTF-8 byte order mark at the
start of the first line is ignored. Every value sits on one line and holds no tab.

```
---
reimagine-handoff: 1
generated: <ISO 8601 time>
---

# Handoff: <title>

## Bundles

- <bundle name>: repo <path>; pr <id or none>; branch <branch>; base <base ref>

## Tickets

### <ticket id>
- type: <work item type, issue type, or label>
- state: <state>
- iteration: <iteration path, sprint, or milestone, or none>
- owner: <assignee, or none>
- parent: <ticket id>                         (optional)
- links:                                      (optional; or `links: none`)
  - <type>: <target>
- bundles: <bundle name>[, <bundle name>...]
- problem: <the problem or gap>
- decision: <the solution that was decided>
- commits:
  - <bundle name> <sha>: <what the commit does and why, one line>
- verified:
  - <a statement the build session says it checked>; check: <the command, query, or evidence, or not recorded>

## Decisions

### D<n>
- ticket: <ticket id>
- decision: <the decision>
- rationale: <why, or not recorded>
- options:
  - chosen: <option>
  - rejected: <option>; why: <reason>
- decided_by: role: <role> | checkpoint (recommended option taken) | not recorded
- recorded_at: commit <sha> | url <URL> | checkpoint: <where in the session> | not recorded
- status: taken | default taken | deferred | deferred to <owner>

## Raised tickets

### R<n>
- ticket: <ticket id>
- type: <work item type, issue type, or label>
- state: <state>
- iteration: <iteration path, sprint, or milestone, or none>
- owner: <assignee, or none>
- parent: <ticket id>                         (optional)
- links:                                      (optional; or `links: none`)
  - <type>: <target>
- bundles: <bundle name>[, <bundle name>...] | none
- summary: <one sentence>
- rank: <whole number; 1 is the highest confidence it belongs in this bundle>
- in_bundle_confidence: include | lean include | lean defer | defer
- reason: <why>
```

## Rules

1. The frontmatter is the first block: a `---` line, exactly two keys,
   `reimagine-handoff: 1` and `generated:` with a non-empty value, then a `---` line. A
   `reimagine-handoff:` value other than `1` is an error ("unsupported handoff version").
2. The four `## ` sections appear once each, in this order: `## Bundles`, `## Tickets`,
   `## Decisions`, `## Raised tickets`. A section with no items holds the single line
   `none`. `## Bundles` never holds `none` and needs at least one bundle, since every
   other item refers to one. A `# ` title line may appear once, after the frontmatter and
   before `## Bundles`.
3. A bundle name is the repository directory's base name, lowercased, with `-2`, `-3`
   added in list order when two bundles share it. It matches `^[a-z0-9][a-z0-9._-]*$`,
   so it holds no space, comma or semicolon; a base name that does not fit is slugged,
   each run of other characters becoming one `-`. Bundle names are unique. A
   `## Bundles` line is split from the right: the last `; base `, then the last
   `; branch ` before it, then the last `; pr ` before that. What lies between `: repo `
   and that point is the path, which may hold any character but a tab. Path, pr, branch
   and base are not empty; pr is `none` for a bundle without a pull request. A relative
   path is relative to the handoff's directory; `/audit:handoff` writes absolute paths.
4. Item headings. A ticket is `### <ticket id>`, the id being the whole rest of the line
   after `### `, spaces and colons included. A decision is `### D<n>` and a raised
   ticket `### R<n>`, `<n>` a whole number from 1. Ids are unique within their section,
   and ticket ids are unique across the whole handoff. The `ticket` values of
   `## Raised tickets` are unique too, and none is an id in `## Tickets`. Every name in a
   `bundles:` value is a bundle of `## Bundles`, named once per value; a ticket lists at
   least one, and a raised ticket lists at least one or says `none`.
5. Ticket ids. The checker takes any id; `/audit:handoff` writes each in its normalized
   form: `github:<owner>/<repo>#<n>`, `ado:<org>/<project>#<n>`, `sf:<case number>` or
   `file:<path>`. Two tickets with the same short id in two repositories are then
   distinct by construction.
6. Item keys are `- <key>: <value>` at column 0, in the order shown above, and no other
   key. A key appears exactly once, except the optional `parent` and `links` (tickets and
   raised tickets), which appear at most once. Values are not empty. A list key
   (`commits`, `verified`, `options`, `links`) has an empty value followed by at least
   one entry indented exactly two spaces (`  - `), or the value `none` (`options` takes
   `none recorded` in its place). The ticket fields hold what the forge holds: `type` is
   the work item type, issue type or label, else `issue`; `iteration` is the iteration
   path, sprint or milestone and `owner` the assignee, each `none` when the forge or the
   ticket has no such field.
7. A commit entry is `  - <bundle name> <sha>: <text>`. The bundle is one of the ticket's
   `bundles`; the sha is 7 to 40 lowercase hex digits; the text is not empty. Within one
   ticket, two entries with the same bundle never name the same commit, so neither sha is
   a prefix of the other. One commit may appear under two tickets.
8. A verified entry is split at the first `; check: `, both parts not empty. The check
   part says how the statement was checked, or `not recorded`. A check part that starts
   with `env:` is `env: <name>; <check>`, split at the first `;` after `env: `, name and
   check not empty. Such a statement is an environment claim: only a live check against
   that environment can settle it.
9. An options entry starts `chosen: ` or `rejected: `. A rejected entry is split at the
   first `; why: `, both parts not empty. At most one entry is `chosen:`. When `status`
   is `taken` or `default taken` and options are listed, exactly one is `chosen:`.
10. A decision's `ticket` resolves to a `### ` id in `## Tickets` first, else to the
    `ticket` value of an item in `## Raised tickets`; with neither it is an error.
11. `status` is `taken`, `default taken`, `deferred`, or `deferred to <owner>` with a
    non-empty owner. `in_bundle_confidence` is `include`, `lean include`, `lean defer`
    or `defer`. Ranks are distinct whole numbers from 1. `recorded_at` is
    `commit <sha>` (7 to 40 lowercase hex digits), `url <URL>`, `checkpoint: <where>`
    (each with a non-empty value), or `not recorded`.
12. `decided_by` is `role: <role>` with a non-empty role,
    `checkpoint (recommended option taken)`, or `not recorded`. It names a role, never a
    person, and never a model, an agent or a tool. `role: <role>` is written when the
    record names who decided by their role; a choice taken at a checkpoint on the
    recommended option is `checkpoint (recommended option taken)`; anything else is
    `not recorded`. `handoff.sh check` also accepts a `person: <name>` value, so that a
    file from another writer still parses; the writer of this plugin never produces one,
    and turns a person's name in the record into the role it played, else
    `not recorded`.
13. A links entry is `  - <type>: <target>`, split at the first `: `, both parts not
    empty, and no entry appears twice in one item. A parent is not the item's own ticket
    id (for a raised ticket, its `ticket` value). `parent` and `links` give the ticket's
    parent and linked work items, such as `closed by` a pull request, as the forge or
    export records them; `links: none` says the record shows no links.
14. Blank lines are allowed anywhere. Any other line that fits none of the shapes above
    is an error.
15. A claim line, the six fields `claims` prints joined by tabs, is at most 8,000 bytes.
    A claim is read as one line and a reader cannot page within a line, so a longer one
    is an error, never a truncation. Ids and bundle names count against the cap, and a
    decision's claim joins all its keys, so long options count too.

`handoff.sh check <file>` prints `handoff: ok` and exits 0. On a rule failure, `check`,
`claims` and `commits` print one line per error, `handoff <file>:<line>: <message>`, in
line order, nothing else, and exit 1. A usage error or an unreadable file exits 2.

## Writing a handoff

`/audit:handoff` runs this procedure in the build session, from the invocation block's
`out`, `verdicts` and `memory` fields. It writes one file, the handoff. It never edits a
tracked file, commits, pushes or posts to a forge. Scripts run as
`sh <resolved absolute path of ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.sh> ...`.

1. **Check the flags.** A `memory` directory needs a `verdicts` file, since
   `memory.sh` reads the false entries of one: with `memory` and no `verdicts`, stop
   with `audit: --memory needs --verdicts`. The `verdicts` file and the `memory`
   directory exist; `out`, when given, names no existing file or directory. Stop with
   one line naming the offending value on any failure, before any other command.
2. **Settle the bundles.** The primary repository is the session's, at its current
   branch; a loop record or the pull request may add the other repositories of the same
   work. Per bundle the base is the first of: the base the loop record names; the pull
   request's base branch,
   `gh pr view <n> -R <host>/<owner>/<repo> --json baseRefName,number,url` (or
   `gh pr view <url> --json baseRefName,number,url`), with the host of the repository's
   GitHub remote; the repository's default branch, proposed to the user, who confirms
   it. Never take the branch's upstream tracking ref as the base. Name the bundles by
   rule 3 and state them, each with repository, pull request, branch and base, before
   gathering anything.
3. **Gather the facts** from the session's own record of the work, and from nothing
   else:
   - a loop record under `.reimagine/loop/<branch-slug>/` in the primary repository
     when one exists, where `<branch-slug>` is the branch lowercased with every run of
     characters outside `[a-z0-9]` turned into `-`, at most 60 characters, and the
     branch in its `steps.json` equals the session's branch: `inputs.md` (each ticket
     as fetched), `plan.md` with its review log (the options offered and the answers
     given), `run.md` (the commit lines and the checks that ran), and its `handoff.md`
     when present, which this procedure checks against git, never copies blind;
   - the git log of each bundle, `git -C <repo> log --format='%H%n%B' <merge-base>..<head>`,
     the merge-base from `git -C <repo> merge-base <base> <head>`;
   - the pull request, when the branch has one;
   - the tickets: the ones the loop record or the request names, else the pull
     request's closing references. A GitHub issue is read with
     `gh issue view <url> --json number,title,state,assignees,milestone,labels,body,comments,closedByPullRequestsReferences`,
     and its parent with
     `gh api --hostname <host> graphql -f query='query{repository(owner:"<owner>",name:"<repo>"){issue(number:<n>){parent{number repository{nameWithOwner}}}}}'`.
     A ticket on another forge comes from the loop record or an export file the user
     names, never from memory.
   An id that cannot be resolved gets one line and the work continues with the rest.
4. **Normalize the ids** to `github:<owner>/<repo>#<n>`, `ado:<org>/<project>#<n>`,
   `sf:<case number>` or `file:<absolute path>`. A short id such as `#12` becomes
   `github:<owner>/<repo>#12` only when the bundle's repository has exactly one GitHub
   remote (`git -C <repo> remote -v`); otherwise stop with
   `<id>: write it as github:owner/repo#n, ado:org/project#n, sf:<case number> or file:<path>`.
5. **With `verdicts`, read the verdicts file.** It is a `claims-verdicts.md` written by
   an audit's stage 8. Under each heading
   `## <claims file absolute path> (handoff | prose), hash <hash>` its entries are a main
   line and three sub-lines:

   ```
   - claim <n> [<kind>] <source file>:<line> <handoff ref or ->: <true | false | not verified | not reproducible here | contested>; finding: <C<n>, ... or none>; evidence: <pointer>
     ticket: <the claim's ticket id, or none>
     text: <the claim's text as in claims.md>
     correction: <text or none>
   ```

   An entry is applied only when both match: the heading's hash equals
   `git hash-object --no-filters <that file>` now, and its `text:` value, the whole rest
   of the sub-line, equals the sixth tab-separated field of the line of
   `handoff.sh claims <that file>` whose second field equals the entry's handoff ref.
   Then:
   - a matching `false` entry is a correction: the statement is written from its
     `correction:` value, or left out when the correction is `none`;
   - a matching `not verified` entry on a `verification` claim is a recheck request: the
     statement stays under `verified`, its `check:` updated only when the session has
     run the check again;
   - a matching `true` entry needs nothing;
   - a `not reproducible here` entry changes nothing: its check ran against an
     environment the audit cannot reach, and is settled by running it there and feeding
     the result to `/audit:resume <run-id> --live <file>`;
   - an entry whose hash or text does not match, an entry under a `(prose)` heading, an
     entry about a ticket not in this handoff, and every `contested` entry are
     reconciliation work: listed with the reason, never applied.
6. **With `memory`, find the memory files** that mention a false claim:
   `memory.sh find <verdicts file> <memory dir>`. Each output line is `claim <n>`, the key
   and a file path, tab-separated, or `none` in place of the path when no file holds the
   key, or `claim <n>`, `-`, `no key` for a false entry without a key. On exit 2, print
   its message and stop. No memory file is edited; the output becomes work for the user.
7. **Write the handoff** in the format above, from the facts of step 3 alone:
   - each bundle's `repo` as an absolute path, and `generated` copied from
     `date -u +%Y-%m-%dT%H:%M:%SZ`;
   - `parent` and `links` from the forge record only: the parent read, the closing pull
     requests as `closed by` links, an export's links. A failed read writes no key;
     `links: none` only when a read succeeded and returned none. Never infer either from
     pull request or commit text;
   - each decision's status as recorded; a deferral stays `deferred` or
     `deferred to <owner>`. Where the record shows no alternative was weighed, write
     `options: none recorded`, and for a taken decision `status: default taken`. Never
     invent an option, a reason, an owner or a check;
   - `decided_by` by rule 12, and `recorded_at` pointing where the audit can read the
     decision: a commit body or a ticket or pull request comment. The audit cannot open
     a `checkpoint:` pointer, so a checkpoint choice that should count as weighed is
     recorded in one of those places first, by the user;
   - a statement the session checked under `verified`, with the exact check as it ran,
     naming what it needs to give the same result: the directory, the environment
     variables, the services or accounts and the environment it ran against. A check
     that ran against an environment the audit cannot reach, such as staging, is tagged
     `check: env: <name>; <check>`. The audit marks a statement `true` only when it
     reproduces the result itself;
   - the step 5 corrections applied.

   The handoff names no model, agent or tool and holds no credential, token or secret:
   prose that credits a model, an agent or a tool with work is written without the
   name, and a check is the command that ran.
8. **Choose the path,** never overwriting a file:
   - `out`, resolved against the session's directory, when given. It lies outside every
     repository (`git -C <its directory> rev-parse --show-toplevel` fails), or inside one
     and ignored there (`git -C <that top level> check-ignore -q <path>` exits 0). An
     existing file at the path stops the procedure with one line saying so.
   - Else `<scratch>/audit/handoff-<YYYY-MM-DD-HHMM>.md`, local time from
     `date +%Y-%m-%d-%H%M`, in the primary repository. `<scratch>` is the first of:
     `scratch/`, `tmp/` or `.scratch/` when it exists and
     `git -C <repo> check-ignore -q <dir>/` exits 0; `.reimagine/` when it is ignored the
     same way; else `${CLAUDE_PLUGIN_DATA}/runs/`. `<scratch>/audit/` is made with
     `mkdir -p`. When the file exists, add `-2`, then `-3`, and so on before `.md`.
   Write the one file with the Write tool.
9. **Validate** with `handoff.sh check <path>`. On exit 1, fix each line it names and
   write the same file again, at most three runs in all. When the third still fails,
   print the remaining lines and stop. Exit 2 stops with its message.
10. **Report.** Print the path; the corrections applied, or `none`; the reconciliation
    work, or `none`; with `memory`, the memory work per claim (each key with the files
    that hold it, `no file holds it` for `none`, `no key to search for` for `no key`),
    and that no file in the directory was edited. Then print a manifest as a fenced
    JSON block, with one bundle per `## Bundles` item (its absolute `repo`, `pr` as a
    normalized id when the bundle has a pull request, else `branch` and `base`, and the
    `tickets` whose `bundles` name it) and `claims` holding the handoff's absolute path.
    Say to save it outside the repository or in an ignored path, then print
    `/audit:run <saved manifest>`. The manifest is printed, never written.

## Claims

`handoff.sh claims <file>` turns a valid handoff into one claim per line, six fields
separated by one tab: `<kind>`, `<ref>`, `<bundle>`, `<ticket>`, `<line>`, `<text>`. Items
come in file order, and within an item the claims come in this order:

| Item | Kind | Ref | Bundle | Text |
|---|---|---|---|---|
| ticket `<id>` | `status` | `tickets/<id>/fields` | first of its `bundles` | `<id>: type <type>; state <state>; iteration <iteration>; owner <owner>`, then `; parent <parent>` and `; links <type> <target>, <type> <target>` (or `; links none`) when present |
| | `code` | `tickets/<id>/problem` | first of its `bundles` | the `problem` value |
| | `code` | `tickets/<id>/decision` | first of its `bundles` | the `decision` value |
| each commit entry | `code` | `tickets/<id>/commit/<bundle>/<sha>` | that entry's bundle | `<bundle> <sha>: <text>` |
| each verified entry, `<k>` from 1 | `verification` | `tickets/<id>/verified/<k>` | first of its `bundles` | the whole entry |
| decision `D<n>` | `decision` | `decisions/D<n>` | first bundle of its ticket, or `none` | `<decision> \| rationale: <rationale> \| options: <entries joined with "; "> \| decided_by: <decided_by> \| recorded_at: <recorded_at> \| status: <status>` |
| raised ticket `R<n>` | `scope` | `raised/R<n>` | its first bundle, or `none` | `<ticket>: <summary> \| rank <rank>, <in_bundle_confidence>: <reason>` |
| | `status` | `raised/R<n>/fields` | its first bundle, or `none` | `<ticket>: type <type>; state <state>; iteration <iteration>; owner <owner>`, with the same optional `parent` and `links` parts |

`<ticket>` is the ticket id; for a decision, its `ticket` value. `<line>` is the line of
the item's `### ` heading, or of the entry for a commit or verified entry. When `options`
is `none recorded`, the decision text says `options: none recorded`.

`handoff.sh commits <file>` prints `<bundle>`, `<sha>`, `<ticket>`, `<line>` per commit
entry, tab-separated, in file order. Stage 1 uses it to seed the review groups.

`handoff.sh detect <file>` exits 0 when the frontmatter has a `reimagine-handoff:` key,
whatever its value, 1 when it has none, and 2 when the file cannot be read.

## Example

```
---
reimagine-handoff: 1
generated: 2026-09-01T11:00:00Z
---

# Handoff: deactivate users

## Bundles

- app: repo /work/app; pr github:example-org/app#2; branch feat/1-deactivate; base origin/main

## Tickets

### github:example-org/app#1
- type: issue
- state: OPEN
- iteration: none
- owner: none
- parent: github:example-org/app#10
- links:
  - closed by: github:example-org/app#2
- bundles: app
- problem: Removing a user deletes the record, so its history is lost.
- decision: Add a deactivate command that keeps the row and sets its status to inactive.
- commits:
  - app 9c5f77c: add the status column migration so every row has a status.
- verified:
  - The test suite passes with one test skipped; check: sh run-tests.sh (run in /work/app)
  - The migration applies to the staging copy; check: env: staging; sh migrate.sh --dry-run

## Decisions

### D1
- ticket: github:example-org/app#1
- decision: Keep the row and mark it inactive instead of deleting it.
- rationale: The audit history must survive a deactivation.
- options:
  - chosen: soft delete with a status column
  - rejected: move the row to an archive table; why: every report query would need a union.
- decided_by: role: product owner
- recorded_at: url https://github.com/example-org/app/issues/1#issuecomment-1
- status: taken

### D2
- ticket: github:example-org/app#1
- decision: Whether a deactivated user can be reactivated is left for later.
- rationale: not recorded
- options: none recorded
- decided_by: not recorded
- recorded_at: not recorded
- status: deferred

## Raised tickets

none
```
