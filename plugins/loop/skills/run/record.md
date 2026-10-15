# The record

Read this file at Step 0.5; it holds the record's location, its files and the completion record, and you return to it whenever a step writes a record file.

## Location

1. The record directory is `.reimagine/loop/<branch-slug>/` in the primary repository's original checkout. It stays there in a worktree run and in a multi-repository run; no additional repository and no worktree holds a record.
2. `<branch-slug>` is the branch name lowercased, with each run of characters outside `[a-z0-9]` replaced by `-`, cut to at most 60 characters, then trailing `-` removed. For `feat/68-4567-export` it is `feat-68-4567-export`.
3. The branch is known at preflight. It is the continued branch; else the "on branch" name; else the predicted name: `fix/<ids>-<slug>` when any ticket is labeled bug or titled "fix" (any case), else `feat/<ids>-<slug>` when there is a ticket, else `work/<slug>`. `<ids>` are the ticket numbers joined with `-`. `<slug>` comes from the first ticket's title, else the redacted description, else the file name, made mechanically so every run predicts the same name: lowercase it, replace each run of characters outside `[a-z0-9]` with `-`, drop `-` at both ends, keep the first 40 characters even when that cuts a word, then drop a trailing `-`. For the title "count() should accept an optional predicate" the slug is `count-should-accept-an-optional-predicat`. A predicted name that matches an existing local or remote branch with no record ends preflight `blocked`.
4. `steps.json` keeps the exact branch name. A record whose `steps.json` branch differs from this run's branch is a slug collision and ends preflight `blocked`, naming both branches.
5. `.reimagine/` goes into the file that `git rev-parse --git-path info/exclude` names, never into `.gitignore`. Nothing under `.reimagine/` is ever staged, and no commit contains a record file.
6. Every shell argument that names a record file is its absolute path, for example `C:/src/app/.reimagine/loop/feat-68-4567-export/pr-body.md`.
7. A file outside the record is never overwritten by a record write.

## Files

All names are relative to the record directory. Times in every file are copied from `date -u +%Y-%m-%dT%H:%M:%SZ` output.

| File | Written | Holds |
|---|---|---|
| `inputs.md` | Step 0.5, extended in Step 1 | One dated section per run: the request with its time, the reading block, each ticket as fetched, files and text inputs, verification notes, drift corrections, buildable status, the risk floor |
| `plan.md` | Step 2, extended in Step 3 | The plan, and a review log per round. Slices for later runs are appended |
| `run.md` | From Step 0.5 on | The durable log, one dated section per run (see below) |
| `steps.json` | Every step start and end | The completion record (see the next section) |
| `report.md` | Every terminal state | The report, compiled from `run.md` and never from memory. Every section is present; an empty one says "none". Rewritten each time |
| `handoff.md`, `audit-manifest.json` | After the run's own commit | The typed handoff and the audit manifest (`handoff.md` in the skill). Rewritten each run. The loop never commits in order to write them |
| `pre-<n>.status`, `pre-<n>.patch`, `pre-<n>.hashes` | Before every implementer or fix call | `git status`, a patch and file hashes of the checkout, for restoring after a failed call. `<n>` is unique across checkouts |
| `diff.patch`, `diff-<slug>.patch` | Before a review that reads a patch | The review patch of the primary checkout, and of an additional repository named by `<slug>` |
| `pr-body.md`, `pr-body-<slug>.md` | Step 7.2 | The pull request body, and the body for an additional repository |
| `comment-<n>.md` | Step 7 | The text of the pull request comment, one per comment |
| `ticket-<id-slug>.md` | Step 7.4 | The status comment text for one ticket |
| `text-<k>.md` | Step 0.5 | One ad-hoc description, `<k>` numbered from 1 across runs, so the handoff can name it |

The bodies and comment texts (`pr-body*.md`, `comment-<n>.md`, `ticket-*.md`) are never committed.

`run.md` holds, per run:

- The start time, the base commit, the merge-base, the planning snapshot, and each HEAD that preflight switched away from.
- The ask-first rules found, with their files.
- Each prompt and its answer, with the times before and after.
- The checks discovered, each with its source and its baseline result.
- Every edit made after Step 5.1's last full check run.
- Per review round: the findings received, those verified, those rejected with the reason, and those fixed.
- Every reviewer swap with its reason, the implementer per slice, every stand-in pass, and every code-review pass with its stage, round, level, range and result.
- The risk floor and each higher-risk judgment, with the criterion that applied.
- Every decision: the choice, the reason, the options weighed with why each was rejected, who decided (`user`, `plan confirmation`, `review` or `run`), and where it was published.
- The budget in force and every change to it, and every time taken from `date`.

## steps.json

`steps.json` is the only record of completion; `run.md` is the narrative.

```json
{
  "branch": "feat/68-4567-export",
  "runs": [
    { "n": 1, "started": "2026-10-14T18:02:11Z", "ended": "2026-10-14T19:40:02Z", "state": "done", "pr": "github:owner/app#73" }
  ],
  "steps": {
    "0": { "status": "complete", "run": 1, "started": "...", "ended": "...", "inputs": { "inputs.md": "<hash>", "base": "<sha>" }, "outputs": ["inputs.md", "run.md"] },
    "4": { "status": "running", "run": 1, "started": "...", "ended": null, "inputs": { "plan.md": "<hash>" }, "outputs": [], "slices": { "export-api": { "status": "complete", "commit": "<sha>" } } }
  }
}
```

1. `branch` is the exact branch name. `runs` has one entry per run: `n`, `started`, `ended` (`null` while the run is open), `state` (`running`, then the terminal state), and `pr` once the run opens a pull request. `pr` is `github:<owner>/<repo>#<n>`; this is how a later run knows the pull request body is this loop's own to edit.
2. `steps` has the keys `"0"` to `"7"`. Each entry has `status` (`running`, `complete`, `failed` or `skipped`), `run` (the run number that last wrote it), `started`, `ended`, `inputs` (file name to hash, plus `base` where the step reads the base commit), and `outputs` (file names). Step `"4"` also has `slices`, keyed by slice name, each with its own `status` and, once built, its `commit`.
3. Hashes are `git hash-object --no-filters <absolute path>`.
4. Write an entry as `running`, with its input hashes, when the step starts. Write it `complete` only after every output exists. Mark a step you do not take `skipped` (Step 7 in a plan-only run, for example). Mark a step that ended without its outputs `failed`.
5. In Step 0 the entry is written at the end of 0.5, once `inputs.md` exists to hash, and marked `complete` at 0.6.
6. Every write goes to `<record>/steps.json.tmp` and is moved over `steps.json` with `mv <tmp> <file>`, with no flags (a flag makes the host ask) and both as absolute paths. Write the whole file each time, keeping every entry you did not change.
7. Only you write `steps.json`; an implementer never does.

## Redaction

1. After the answer `drop` at Step 0.1a, every record file carries `<redacted: key>` in place of each matched value, where `key` is the matched key name in lowercase. An `AKIA` match reads `<redacted: aws_access_key>`, a PEM header and its body `<redacted: pem_key>`, and a block under a heading `<redacted: block>`.
2. Patch files (`diff.patch`, `diff-<slug>.patch`, `pre-<n>.patch`) are scanned the same way before they are written, and so are the bodies and comment texts.
3. After `keep`, or when the scan matched nothing, nothing is redacted. Do not read the original values back from the record to answer a question; the session holds them.

Return to Step 0.5 in `steps/0-preflight.md`.
