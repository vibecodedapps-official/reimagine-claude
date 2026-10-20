# The report

Read this file at every terminal state (`done`, `plan-only`, `prepared`, `blocked`, `stopped`), after `handoff.md` when the run has its own commit and before you print the report.

Fill every section from `run.md` (and from `inputs.md`, `plan.md` and `steps.json` where a section names them), never from memory. An empty section says `none`; you never drop a section.

Where the report goes:

- Before Step 0.5 the report is printed only. The tree may be dirty and `.reimagine/` may not be excluded yet, so you write nothing. The report names the preflight item that failed and the fix.
- From Step 0.5 on, write the report to `report.md` in the record, rewriting the file at every terminal state, and print the same text.

A headless session does not show text written before a Skill call, so the header alone must let a reader find the record: the record path, the terminal state and the pull request link are in the header, not only in the sections.

## Template

```
# loop report

- Run number: <n>
- Branch: <branch name | none created (a run would use <name>)>
- Record: <absolute path of the record directory>
- Terminal state: <done | plan-only | prepared | blocked | stopped>
- Host: <github | other (<hostname>)>
- Run budget: <minutes> (<request | .reimagine.json | default | session instruction>)
- Base commit: <sha | none>
- Merge-base: <sha | none>
- Worktree: <absolute path; remove with `git worktree remove <path>` | none>
- Repositories: <primary: <absolute path>, base <remote>/<branch>, pull request <link | none>; also edit <absolute path>, base <remote>/<branch>, pull request <link | none>; ...>
- Pull request: <link per repository | none; for a continued branch, the pull request commented on>
- CI state: <green | not applicable (<reason>) | pending | failed | not reached>
- Handoff: <absolute path of handoff.md | not written: <reason>>
- Audit: </audit:run "<absolute path of audit-manifest.json>" (the command needs the audit plugin) | not suggested>

## Attended or unattended

## Risk

## What changed

## Decisions

## Findings rejected and why

## Checks

## Deferred items

## Blocked, stopped or prepared

## Log
```

## Header

- Branch: when no branch was created (preflight failed, `plan-only`, or `stopped` before a branch), write `none created (a run would use <name>)` with the predicted or given name.
- Run budget: the minutes in force and their source, in the order of precedence: request ("budget <n> minutes"), `.reimagine.json` `timeouts.run`, session instruction, else the default (240).
- Worktree: the path of the detached worktree with its `git worktree remove <path>` line, or `none`. The handoff names the worktree as the repository, so the worktree stays until the audit has run.
- Repositories: the primary first, then each "also edit" path in request order, each with its base and its pull request.
- Pull request: a link per repository, or `none`. On a continued branch, name the pull request the run commented on.
- CI state: `green`, `not applicable (<reason>)`, `pending`, `failed`, or `not reached` when Step 7.3 never ran.
- Handoff: the absolute path when `handoff.md` was written, else `not written: <reason>`, for example `not written: no commit from this run`.
- Audit: write the `/audit:run` line with the absolute manifest path only when the handoff was written and the work spans more than one repository, more than one ticket, or 500 or more changed lines (added plus deleted, from `git diff --numstat <merge-base>...HEAD` in each repository, summed). Add the note that the command needs the audit plugin. Otherwise write `not suggested`.

## Sections

### Attended or unattended

State the mode: attended when any action prompted, else unattended. List the prompts the Step 0.1 permission statement predicted and Step 0.6 saw, each with how it was answered; the prompts predicted and not seen; the prompts seen and not predicted. For each question the run asked, give the wait from question to reply (question waits are outside the run budget).

### Risk

- The floor trigger that applied, or `none`. When an edit touched a sensitive area and did not trigger the floor, say why (an incidental edit).
- The effort hint, and the effort in force for reviewers.
- The higher-risk judgment and the criterion that decided it, at the plan, after Step 4, and at each later judgment point.
- The Step 5 role for each round.
- Every reviewer swap, with its reason. A stand-in review pass is not a swap.
- The `.reimagine.json` model overrides in force, and the values the run reported and ignored.

### What changed

Per input: the completion status (`complete`, `partial`, `blocked` or `not started`); the changes made; each acceptance criterion with its evidence; the drift corrections.

### Decisions

Each decision: the choice, the reason, and who decided: `user`, `plan confirmation`, `review` or `run`. Then every code-review pass and stand-in pass with its round, level, range and result. A subagent's report is never cited as approval.

### Findings rejected and why

Each rejected finding with its source, its round and the reason for the rejection.

### Checks

- Run: the command, its source (`.reimagine.json`, a manifest, a CI job) and the result.
- Not run: the exact command, the directory and the reason. A not-run check always has its command.
- Deferred to CI: the check with its job name.
- Failing at baseline: the evidence (test names, not counts) and whether it still fails. A baseline match carries that evidence.
- Write `denied` only for a refused permission.

### Deferred items

Each deferred item with its description and its reason. No issue was opened for any of them.

### Blocked, stopped or prepared

For `done`, write `none`. For `plan-only`, write `not run` and give the absolute path of `plan.md`.

For `blocked`, `stopped` and `prepared`:

- What is blocked, or the question with both positions.
- The steps not done.
- Where the work is: the local branch, the pull request link, and each repository's HEAD before preflight switched it.
- What would unblock it, with the rerun text for a repository gate ("also edit <path>").
- A budget that expired, with its value and the step it expired in.
- What was already pushed.

For `prepared`, also give the branch, the commit state, and the exact commands in order:

1. `git add <paths>`
2. `git commit`
3. `git push -u <remote> <branch>`
4. `gh pr create --title "<title>" --body-file <absolute path of the body file>`; for a continued branch with one open pull request, `gh pr comment <pr> --body-file <absolute path>` instead, preceded by `gh pr edit <pr> --body-file <absolute path of the body file>` when this loop opened that pull request; on a non-GitHub host, in place of a `gh` command, the title, the absolute path of the body file to paste as the pull request's description, the absolute path of the `comment-<n>.md` file to post as its first comment when there is one (with several repositories, each file with the repository it goes with), and the note that the pull request opens, and its work items are linked, with that host's own tooling.

### Log

The implementer per slice and its model; the rounds used per step; the CI repair cycles; the elapsed time against the run budget, without the question waits. Copy times from the `date -u` output recorded in `run.md`; compute nothing from memory.

## Rules

- The report has exactly one terminal state, one of the five.
- Name every reviewer swap. Give each rejected finding with its reason. Give each baseline match with its evidence.
- For `plan-only`, the What changed, Checks and Blocked sections say `not run`, and the plan path is given.
- For `blocked` and `stopped`, nothing is published after the state.
- The report may name models, agents and tools, because it stays in the record. Anything posted from it follows the external form in `record.md`, Commit snapshot.
- With `commit: true`, `record.md`, Commit snapshot, says which sections the posted form keeps.

Return to Final report handling in SKILL.md.
