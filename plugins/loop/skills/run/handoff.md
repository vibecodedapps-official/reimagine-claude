# The handoff and the manifest

Read this file in Final report handling, before the report is filled, when the run has its own commit (Step 7.1) in some repository, in any terminal state.

Write `handoff.md` and `audit-manifest.json` in the record. Write them only from the record (`inputs.md`, `plan.md` with its review log, `run.md`, the pull request bodies the run wrote) and from git. A value the record does not hold is written as the format's `none`, `none recorded` or `not recorded`; you never invent an option, a reason, an owner or a check.

A run with no commit of its own writes neither file, and you never commit to make a handoff possible. The loop runs no check of its own on the file: the audit's `handoff.sh check` validates it when the audit reads it. Both files are rewritten by every run that has a commit of its own. No credential appears in either file; copy from the redacted record only.

## Parent and links

Do this late in the run, after the pull request exists, so the run's own pull request is included. For each GitHub issue input, make these reads, one per Bash call, never in a loop:

- Closing pull requests: `gh issue view <issue URL> --json closedByPullRequestsReferences`.
- The parent: `gh api --hostname <host> graphql -f query='query{repository(owner:"<owner>",name:"<repo>"){issue(number:<n>){parent{number repository{nameWithOwner}}}}}'`.

Record each result, or the failed read with its error line, in `run.md`. A failed read writes no key: the ticket gets no `parent` key or no `links` key, and you never write `links: none` for a read that failed. `links: none` is for a read that succeeded and returned no closing pull request. A ticket that is not a GitHub issue has neither key.

## Format

The file has this shape. Each section appears once, in this order.

```
---
reimagine-handoff: 1
generated: <ISO 8601 time from date -u>
---

# Handoff: <one line naming the work>

## Bundles
## Tickets
## Decisions
## Raised tickets
```

Rules for every section:

- A section with no items holds the line `none`. Bundles always has an item.
- Every value is on one line and holds no tab. Join a longer text with spaces.
- An item key is written `- <key>: <value>` at column 0, each key once, in the order given below.
- A list key (`commits`, `verified`, `options`, `links`) has an empty value followed by entries indented exactly two spaces, `  - <entry>`, or the value `none` (`none recorded` for `options`).
- `generated` is copied from the output of `date -u +%Y-%m-%dT%H:%M:%SZ`.

### Bundles

One item per repository with a diff of its own, primary first, then the "also edit" order:

`- <name>: repo <absolute path>; pr <github:owner/repo#n or none>; branch <branch>; base <remote>/<base branch>`

- `<name>` is the base name of the repository directory, lowercased, with each run of characters outside `a-z0-9._-` turned into `-`, prefixed with `r-` when it does not start with `a-z0-9`, and suffixed `-2`, `-3` on a clash.
- In a worktree run the repo is the worktree path. The worktree must stay until the audit has run.

### Tickets

One `### <ticket id>` per distinct input. Ids are normalized:

- `github:<owner>/<repo>#<n>`
- `ado:<org>/<project>#<n>`
- `sf:<case number>`
- `file:<absolute path>`; a text input uses the absolute path of its record file `text-<k>.md`.

Keys, in this order:

- `type`: `issue`, `work-item`, `case`, or `task` for a file or text input.
- `state`: the ticket's state, else `none`.
- `iteration`: the milestone or iteration, else `none`.
- `owner`: the login of the first assignee, else `none`.
- `parent` (optional, GitHub only): the parent issue as `github:<nameWithOwner>#<number>`. Omit the key when the issue has no parent or the read failed.
- `links` (optional, GitHub only): entries `  - closed by: github:<owner>/<repo>#<n>`, one per closing pull request; `none` only when the read succeeded and returned none. Omit the key when the read failed.
- `bundles`: the names of the bundles holding this input's commits, comma-separated.
- `problem`: Step 1's reading of the problem.
- `decision`: the approach the plan took.
- `commits`: `  - <bundle> <sha>: <commit subject>` for each commit this record's runs made, attributed to this input; the sha is 7 to 40 lowercase hex characters copied from git output; `none` when there is none.
- `verified`: `  - <statement>; check: <command | not recorded>` for each Step 6 check that ran and passed in the first bundle. Write the command with the directory it ran in, as `<command> (run in <absolute directory>)`. `none` when there is none.

### Decisions

One `### D<n>` per choice in the report's Decisions section, numbered in that order. Review passes are not decisions. Keys, in this order:

- `ticket`: the id of the ticket the decision concerns; the first ticket id for a decision about the whole run.
- `decision`: what was decided.
- `rationale`: why.
- `options`: `  - chosen: <option>` and `  - rejected: <option>; why: <reason>`, or `none recorded`.
- `decided_by`, from who decided, as the record names it:
  - user: `role: session user`
  - plan confirmation: `role: session user (plan confirmation)`
  - review: `checkpoint (recommended option taken)`
  - run: `role: orchestrator`
  - Never a person's name, and never a model, an agent or a tool.
- `recorded_at`: `url <link>` when the decision is published in a pull request or comment, else `checkpoint: <step>`.
- `status`: `taken`, `default taken` or `deferred`.

### Raised tickets

One `### R<n>` per deferred item, in the report's order. Keys, in this order:

- `ticket`: `<branch-slug>/deferred-<k>`, where `<k>` is the item's rank.
- `type`: `task`
- `state`: `new`
- `iteration`: `none`
- `owner`: `none`
- `bundles`: the bundle names the item touches, else the first bundle.
- `summary`: one line.
- `rank`: the item's position in the report's Deferred items, from 1.
- `in_bundle_confidence`: `defer`
- `reason`: the reason the item was deferred.

## Manifest

Write `audit-manifest.json` beside the handoff:

```
{"bundles":[{"repo":"<absolute path>","pr":"github:<owner>/<repo>#<n>","tickets":["<ticket id>"]},{"repo":"<absolute path>","branch":"<branch>","base":"<remote>/<base branch>","tickets":["<ticket id>"]}],"claims":["<absolute path of handoff.md>"]}
```

- One bundle per Bundles item, in the same order. `tickets` lists the ids of the tickets whose `bundles` value names that bundle.
- A bundle names its pull request only when the live remote head equals the local HEAD of that branch: compare the first field of `git -C <repo> ls-remote --heads <remote> refs/heads/<branch>` with `git -C <repo> rev-parse HEAD`. Otherwise the bundle carries `branch` and `base` and no `pr`.
- In a worktree run, `repo` is the worktree path.

## Example

A run on one GitHub issue, one repository at `/home/dev/widget-app` (owner `acme`), branch `feat/12-sync-retry`, one decision and one deferred item. The record is `/home/dev/widget-app/.reimagine/loop/feat-12-sync-retry/`.

`handoff.md`:

```
---
reimagine-handoff: 1
generated: 2026-10-14T19:41:07Z
---

# Handoff: retry failed syncs with backoff in widget-app

## Bundles

- widget-app: repo /home/dev/widget-app; pr github:acme/widget-app#14; branch feat/12-sync-retry; base origin/main

## Tickets

### github:acme/widget-app#12

- type: issue
- state: open
- iteration: v1.4
- owner: widget-dev
- parent: github:acme/widget-app#9
- links:
  - closed by: github:acme/widget-app#14
- bundles: widget-app
- problem: A failed sync is dropped after one attempt, so a short network outage loses the queued changes.
- decision: Retry a failed sync up to three times with growing delays, then keep the change queued for the next scheduled sync.
- commits:
  - widget-app 4e1a9c2: feat(sync): retry failed syncs with backoff
- verified:
  - A failed sync is retried three times with growing delays and then queued; check: npm test (run in /home/dev/widget-app)

## Decisions

### D1

- ticket: github:acme/widget-app#12
- decision: Retry up to three times with exponential backoff, then queue the change.
- rationale: Bounded retries keep a stuck sync from holding the worker, and the queue keeps the data.
- options:
  - chosen: three retries with exponential backoff, then queue
  - rejected: retry until the connection returns; why: a long outage would hold the sync worker with no bound
- decided_by: role: session user (plan confirmation)
- recorded_at: url https://github.com/acme/widget-app/pull/14
- status: taken

## Raised tickets

### R1

- ticket: feat-12-sync-retry/deferred-1
- type: task
- state: new
- iteration: none
- owner: none
- bundles: widget-app
- summary: Show the retry count on the sync status screen.
- rank: 1
- in_bundle_confidence: defer
- reason: The status screen belongs to another ticket and the plan did not cover it.
```

`audit-manifest.json` (the remote head of `feat/12-sync-retry` equals the local HEAD):

```
{"bundles":[{"repo":"/home/dev/widget-app","pr":"github:acme/widget-app#14","tickets":["github:acme/widget-app#12"]}],"claims":["/home/dev/widget-app/.reimagine/loop/feat-12-sync-retry/handoff.md"]}
```

Return to Final report handling in SKILL.md.
