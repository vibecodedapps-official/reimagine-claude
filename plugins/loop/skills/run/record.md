# The record

Read this file at Step 0.2 when the run's record directory exists, else at Step 0.5. It holds the record's location, its files, the completion record, and the rules for a record a prior run left; you return to it whenever a step writes a record file.

## Location

1. The record directory is `.reimagine/loop/<branch-slug>/` in the primary repository's original checkout. It stays there in a worktree run and in a multi-repository run; no additional repository and no worktree holds a record.
2. The branch and `<branch-slug>` are set as SKILL.md, Record, says.
3. `steps.json` keeps the exact branch name. A record whose `steps.json` branch differs from this run's branch is a slug collision and ends preflight `blocked`, naming both branches.
4. `.reimagine/` goes into the file that `git rev-parse --git-path info/exclude` names, never into `.gitignore`. Nothing under `.reimagine/` is ever staged, and no commit contains a record file.
5. Every shell argument that names a record file is its absolute path, for example `C:/src/app/.reimagine/loop/feat-68-4567-export/pr-body.md`.
6. A file outside the record is never overwritten by a record write.

## Files

All names are relative to the record directory. Times in every file are copied from `date -u +%Y-%m-%dT%H:%M:%SZ` output.

| File | Written | Holds |
|---|---|---|
| `inputs.md` | Step 0.5, extended in Step 1 | One section per run, headed `## Run <n>: <start time>`: the request with its time, the reading block, each ticket as fetched, files and text inputs, on an existing record the branch state (An existing record), verification notes, drift corrections, buildable status, the risk floor |
| `plan.md` | Step 2, extended in Step 3 | The plan, and a review log per round. A later run appends a section for its slices and its review log (An existing record); the sections above it stay as they are |
| `run.md` | From Step 0.5 on | The durable log, one section per run headed `## Run <n>: <start time>` (see below) |
| `steps.json` | Every step start and end | The completion record (see the next section) |
| `report.md` | Every terminal state | The report, compiled from `run.md` and never from memory. Every section is present; an empty one says "none". Rewritten each time |
| `handoff.md`, `audit-manifest.json` | After the run's own commit | The typed handoff and the audit manifest (`handoff.md` in the skill). Rewritten each run. The loop never commits in order to write them |
| `pre-<n>.status`, `pre-<n>.patch`, `pre-<n>.hashes` | Before every implementer or fix call, and before a question from Step 3.7 on | `git status`, a patch and file hashes of the checkout, for restoring after a failed call and for comparing after a reply. `<n>` is one more than the highest number among the record's `pre-*.status` files, or 1 when there is none, so it is unique across checkouts and runs |
| `diff.patch`, `diff-<slug>.patch` | Before a review that reads a patch | The review patch of the primary checkout, and of an additional repository named by `<slug>` |
| `pr-body.md`, `pr-body-<slug>.md` | Step 7.2, or the end of Step 6 on `other` | The pull request body, and the body for an additional repository |
| `comment-<n>.md` | Step 7, or the end of Step 6 on an Azure DevOps remote | The text of the pull request comment, one per comment; on an Azure DevOps remote, the full body to post as the first comment. `<n>` is one more than the highest number among the record's `comment-*.md` files, or 1 when there is none |
| `ticket-<id-slug>.md` | Step 7.4 | The status comment text for one ticket |
| `text-<k>.md` | Step 0.5 | One ad-hoc description, `<k>` numbered from 1 across runs, so the handoff can name it. A description whose text, after the credentials decision, equals an existing `text-<k>.md` is that input, and no new file is written |

The bodies and comment texts (`pr-body*.md`, `comment-<n>.md`, `ticket-*.md`) are never committed.

No run rewrites a file a prior run wrote, except `steps.json`, `plan.md` (appended), and `report.md`, `handoff.md` and `audit-manifest.json` (rewritten). The counters keep `pre-<n>`, `comment-<n>` and `text-<k>` apart. The other per-run files (`diff*.patch`, `pr-body*.md`, `ticket-*.md`) take a run suffix from run 2 on: `-run<n>` before the extension, with `<n>` the run's number, as in `diff-run2.patch`, `pr-body-run2.md`, `pr-body-app-infra-run2.md` and `ticket-68-run2.md`. Within one run, a later write of the same file replaces it.

`run.md` holds, per run:

- The start time, the base commit, the merge-base, the planning snapshot, and each HEAD that preflight switched away from.
- On an existing record: the run that was interrupted, if any, and the step it stopped in; each step reused; and the step the run resumed at, with the reason.
- The ask-first rules found, with their files.
- Each prompt and its answer, with the times before and after.
- The checks discovered, each with its source and its baseline result.
- Every edit made after Step 5.1's last full check run.
- Per review round: the findings received, those verified, those rejected with the reason, and those fixed.
- Every reviewer swap with its reason, the implementer per slice, every stand-in pass, and every code-review pass with its stage, round, level, range and result.
- The risk floor and each higher-risk judgment, with the criterion that applied.
- Every decision: the choice, the reason, the options weighed with why each was rejected, who decided (`user`, `plan confirmation`, `review` or `run`), and where it was published.
- Each commit the run made (slice commits, the snapshot commit, CI repairs), as a line `- commit <full sha> <subject>`. A later run tells the loop's own commits from foreign ones by these lines alone.
- Each pull request the run opened, whose body it edited, or on which it commented, with the file it posted, and each ticket it commented on, with its file.
- The budget in force and every change to it, and every time taken from `date`.

## steps.json

`steps.json` is the only record of completion; `run.md` is the narrative.

```json
{
  "branch": "feat/68-4567-export",
  "tickets": ["github:owner/app#68", "ado:org/project#4567"],
  "runs": [
    { "n": 1, "started": "2026-10-14T18:02:11Z", "ended": "2026-10-14T19:40:02Z", "state": "done", "pr": "github:owner/app#73" },
    { "n": 2, "started": "2026-10-15T09:00:40Z", "ended": null, "state": "running" }
  ],
  "steps": {
    "0": { "status": "complete", "run": 2, "started": "...", "ended": "...", "inputs": { "base": "<sha>", "head": "<sha>" }, "outputs": ["inputs.md", "run.md"] },
    "1": { "status": "complete", "run": 1, "started": "...", "ended": "...", "inputs": { "github:owner/app#68": "2026-10-14T17:55:02Z" }, "outputs": ["inputs.md"] },
    "4": { "status": "running", "run": 2, "started": "...", "ended": null, "inputs": { "plan.md": "<hash>" }, "outputs": [], "slices": { "export-api": { "status": "complete", "run": 1, "tickets": ["github:owner/app#68"], "commit": "<sha>" }, "export-docs": { "status": "running", "run": 2, "tickets": ["ado:org/project#4567"] } } }
  }
}
```

1. `branch` is the exact branch name. `tickets` lists the normalized id of every ticket and file input any run of the record took, in the order first taken: `github:<owner>/<repo>#<n>`, `ado:<org>/<project>#<n>`, `sf:<case number>`, `file:<absolute path>`. Text inputs are not listed. Step 0.2 finds a record by these ids.
2. `runs` has one entry per run: `n`, `started`, `ended` (`null` while the run is open), `state` (`running`, then the terminal state, or `interrupted` when a later run finds it still open), and `pr` on the run that opened a pull request with `gh pr create`, as `github:<owner>/<repo>#<n>`. Only the run that opened the pull request writes `pr`; a run that edits or comments on one names it in `run.md`. A pull request that some entry's `pr` names is this loop's own, so a later run may edit its body; any other pull request gets a comment only.
3. `steps` has the keys `"0"` to `"7"`. Each entry has `status` (`running`, `complete`, `failed` or `skipped`), `run` (the run number that last wrote it), `started`, `ended`, `inputs` (see item 5), and `outputs` (file names). Step `"4"` also has `slices`, keyed by slice name, each with its own `status`, `run`, `tickets` (the ids of the inputs it serves, from `plan.md`: normalized ids, and `text-<k>.md` for a description) and, once committed at Step 7.1, its `commit`. A slice that a run built and did not commit also has `files`, written when the run ends (SKILL.md, Final report handling): each path the slice owns, relative to its checkout, mapped to the output of `git -C <checkout> hash-object -- <path>`, or to `deleted` for a path the slice removed. The slices of every run stay in the map.
4. Hashes are `git hash-object --no-filters <absolute path>`.
5. Each step records its inputs, and every start recomputes them:
   - `"0"`: `base`, the base commit, and `head`, the branch tip Step 0.2 found, or `none` for a branch that does not exist yet.
   - `"1"` and `"2"`: one key per input the step takes up, which is every input of the run that is not done (An existing record), keyed by its normalized id, or by `text-<k>.md` for a description. The value is the input's version: for a GitHub issue its `updatedAt` from `gh issue view <n> --json updatedAt`; for an Azure DevOps work item its `rev`; for a Salesforce case its `SystemModstamp`; for a file or a description the hash of the file or of its `text-<k>.md`. A version the tool does not give is `unknown`, which equals nothing, so the step runs.
   - `"3"` and `"4"`: `plan.md`, by its hash.
   - `"5"`, `"6"` and `"7"`: `plan.md`, by its hash, and `head`, the output of `git rev-parse HEAD` in the checkout in use.
6. Write an entry as `running`, with its inputs, when the step starts. Write it `complete` only after every output exists. Mark a step you do not take `skipped` (Step 7 in a plan-only run, for example). Mark a step that ended without its outputs `failed`. A step reused by Reuse and resume keeps its entry as it is.
7. In Step 0 the entry is written at the end of 0.5, once `inputs.md` exists, and marked `complete` at 0.6.
8. Every write goes to `<record>/steps.json.tmp` and is moved over `steps.json` with `mv <tmp> <file>`, with no flags (a flag makes the host ask) and both as absolute paths. Write the whole file each time, keeping every entry you did not change.
9. Only you write `steps.json`; an implementer never does.

## An existing record

Follow this section at Step 0.2, after the branch has been fetched and checked there, whenever the run's record directory exists, however Step 0.2 found it. Until Step 0.5 hold every result in memory; Step 0.5 writes them.

1. Read `steps.json`. A `branch` that differs from this run's branch is a slug collision: end preflight `blocked`, naming both branches. On `github`, a pull request that a `runs` entry names in `pr` and that Step 0.2 item 7 does not list as open means the record's work is finished (merged or closed): end preflight `blocked`, in a plan-only run too, naming the pull request with its state from `gh pr view <n> --json state` and the "on branch <name>" form that starts a new branch for the request.
2. This run's number `<n>` is one more than the highest `n` in `runs`. A `runs` entry whose `ended` is `null` belongs to a run that was interrupted. At Step 0.5 write its `state` as `interrupted`, leave `ended` as `null`, and name in this run's `run.md` section the step it stopped in: the step whose entry has `status` `running` and that run's number, else the step after its last `complete` one.
3. Find the branch tip `<tip>`, the commit the run plans at. `<tip>` is `refs/remotes/<remote>/<branch>` when the branch exists on the remote, since Step 0.2 item 4 holds a local branch at or behind it and items 5 and 6 fast-forward it there. It is the local branch when the branch exists only locally, or when Step 0.2 item 5 plans at the local tip without fast-forwarding it (a session already on the continued branch). A plan-only run reads the tip by its ref, since it never switches the checkout. When the branch exists neither locally nor on the remote, as after a plan-only run, there is no tip: Step 3.7.2 creates the branch, every input is open, and items 4 and 5 list nothing.
4. Take the merge-base, `git merge-base refs/remotes/<remote>/<default> <tip>`, and list the commits on the branch with `git log --reverse --format='%H %an %s' <merge-base>..<tip>`.
5. Mark each commit. It is the loop's own when a `- commit <full sha> <subject>` line in `run.md` names its full sha; note the run whose section holds the line. A sha that `run.md` names anywhere else, such as the base commit, a head or a planning snapshot, does not count. Every other commit is foreign: made by hand, by another tool, or by someone else.
6. Judge each input of this run `done` or `open`. An input is done when `plan.md` names at least one slice that serves it and every such slice has a `commit` in `steps.json` that is on the branch (`git merge-base --is-ancestor <commit> <tip>` passes). A slice is open when `plan.md` holds it and it has no such commit. A slice whose commit is on the branch is never built again. A slice with no `commit` whose `files` all match the tip (for each path, `git rev-parse <tip>:<path>` prints the recorded hash, and a `deleted` path is absent at the tip) was committed outside the loop, as when the user ran the commands of a `prepared` run: it counts as committed, and at Step 0.5 its `commit` becomes the newest commit at the tip that touches its paths, `git log -1 --format=%H <tip> -- <paths>`, which stays foreign in the Branch state list.
7. At Step 0.5, write into this run's section of `inputs.md` a `### Branch state` list: the merge-base; each commit, oldest first, as `- <sha> <subject> (<author>): own, run <m>` or `- <sha> <subject> (<author>): foreign`; and each input as `- <id>: done (<commit sha>, ...)` or `- <id>: open`. Every diff review and every changed-lines count uses the merge-base with the default branch, so the foreign commits are reviewed with the loop's own whenever Step 5 runs. A pull request opened on this branch lists these commits (Step 7.2).
8. No new work: every input of the run is done and no slice serving them is open. Step 0 completes. Steps 1 to 5 are reused whatever their inputs; log `Steps 1 to 5 reused: no new work` in `run.md`. Step 3.7 runs its items 3.7.2 and 3.7.4 (Reuse and resume, item 7), and Step 6 runs in full, comparing any failure with the baseline that the last run to reach Step 3.7.3 recorded. The record's work is published when the run that last wrote Step `"7"` in `steps.json` (its `run`) ended `done`, and on `github` Step 0.2 item 7 found one open pull request on the branch, whoever opened it. With no Step `"7"` entry it is not published.
   - Published: write Step 7 `skipped`, commit nothing, push nothing, edit no pull request body, post no comment on the pull request or on any ticket, rewrite `report.md`, and end `done`.
   - Not published, as after a run that was interrupted or ended `blocked` or `prepared` at or before Step 7: Step 7 runs in full whatever its entry holds, as `steps/7-publish.md` says. Step 7.1 finds every slice committed, 7.2 pushes what the remote lacks and opens or updates the pull request, 7.3 watches CI, and 7.4 comments on each ticket that no run's `run.md` section logs a comment on.

   A plan-only run with no new work ends `plan-only` and names the existing `plan.md`.
9. Otherwise the run continues the record. Step 1 verifies only the open inputs; a done input keeps the notes of the run that verified it. Step 2 appends to `plan.md` a section `## Run <n> slices` with the slices for the open inputs; a prior run's open slice stays in its own section and is built in this run. Step 3 reviews the whole plan with this run's section named as the part to review, and appends its review log. Step 4 builds only the open slices. Step 5 reviews the whole diff from the merge-base. Step 7 publishes as `steps/7-publish.md` says for a continued branch.
10. Steps 1 to 7 then follow Reuse and resume.

## Reuse and resume

1. Step 0 runs in every run, and so does its clean-tree check. A run stopped during Steps 4 to 6 leaves its edits uncommitted, so the rerun ends `blocked` at Step 0.3 naming them, and never stashes, resets or cleans. The `pre-<n>` snapshots show what each call changed.
2. From Step 1 on, at the start of each step and before its entry is written, recompute the step's inputs (steps.json, item 5). Reuse the step when all of these hold: its entry is `complete`; every file its `outputs` lists exists; every recomputed input equals the recorded one; and every step before it in this run, from Step 1 on, was reused. Step 4 also needs every slice in its `slices` that serves an input of this run to have a `commit` on the branch (An existing record, item 6), since an uncommitted slice was built into a working tree that Step 0.3 has since found clean.
3. A reused step is not run, and its entry stays as it is. Log `Step <k> reused (entry of run <m>)` in `run.md`.
4. The first step that is not reused is where the run resumes. Log `resumed at Step <k>` in `run.md` with the reason: no entry, an entry that is not `complete`, a missing output, or the input that changed. That step and every step after it run, and each writes its entry with this run's number.
5. Within Step 4, a slice whose commit is on the branch is skipped; only open slices are built.
6. A run with no new work (An existing record, item 8) reuses Steps 1 to 5 by that item, not by this section.
7. Step 3.7 sets up the checkout of each run that builds or checks, so it runs also when Step 3 is reused. When Step 3 is reused in a run that is not plan-only, read `steps/4-build.md` and run Step 3.6 (when the request says "confirm the plan") and Step 3.7 before Step 4; Step 3's entry stays as it is unless a revision gives Step 3 a round. On the no-new-work path (An existing record, item 8), run only 3.7.2 and 3.7.4, then go to Step 6.

## Never rewrite

The loop never force pushes, rebases, resets or amends, on a new branch or a continued one. Fast-forwarding a local branch to the remote head belongs to Step 0.2 alone. Before every push, Step 7.2 reads the remote head with `git ls-remote`; a head that differs from the one Step 0.2 fetched, or for a CI repair from the last sha this run pushed, ends the run `blocked`.

## Commit snapshot

With `.reimagine.json` `commit: true`:

1. A run that publishes commits a snapshot at Step 7.1, after its slice commits and before its first push. It writes `docs/runs/<branch-slug>/plan.md`, a copy of the record's `plan.md`, and `docs/runs/<branch-slug>/report-<n>.md`, the report filled as at a terminal state but with the terminal state `publishing`, in its external form (item 3), where `<n>` is this run's number and `<branch-slug>` the record's slug. Stage the two paths by name and commit them alone, as `docs(runs): record the plan and report of run <n>`, with a body that says the repository keeps a snapshot of each run. Log it in `run.md` with its `- commit` line, like every commit of the run.
2. A run that publishes nothing (no new work on published work, `plan-only`, `prepared`, or `blocked` before its first push) commits no snapshot.
3. The external form of the report keeps, in this order: the header without its Record, Worktree, Repositories, Handoff and Audit lines, which name local paths; What changed; Checks; Deferred items; and Blocked, stopped or prepared. It leaves out Attended or unattended, Risk, Decisions, Findings rejected and why, and Log. Like every published text (`pr-body.md`), it names no model, agent or tool and no local path; a check's directory is written relative to the repository root.
4. At `done`, except on the no-new-work path of published work (An existing record, item 8), which posts nothing, post the report's external form as the run's pull request comment: write it to `comment-<n>.md` and post `gh pr comment <pr> --body-file <absolute path>`. Under `commit: true` this comment takes the place of Step 7.2's continued pull request comment, so the run still posts one comment on the pull request.

## Redaction

1. After the answer `drop` at Step 0.1a, every record file carries `<redacted: key>` in place of each matched value, where `key` is the matched key name in lowercase. An `AKIA` match reads `<redacted: aws_access_key>`, a PEM header and its body `<redacted: pem_key>`, and a block under a heading `<redacted: block>`.
2. Patch files (`diff.patch`, `diff-<slug>.patch`, `pre-<n>.patch`) are scanned the same way before they are written, and so are the bodies and comment texts.
3. After `keep`, or when the scan matched nothing, nothing is redacted. Do not read the original values back from the record to answer a question; the session holds them.

Return to the item of `steps/0-preflight.md` that sent you here.
