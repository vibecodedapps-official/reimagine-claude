# CI watch

Read this file from Step 7.3 in `steps/7-publish.md`, after the pull request is open and the first push has returned. It holds items 1 to 4 of Step 7.3; item 5 (repair) is in `steps/7-publish.md`. `<host>` is the host recorded at Step 0, `github.com` included. `<n>` is the pull request number, `<base>` its base branch, `<sha>` a commit sha. `{owner}` and `{repo}` stay as written; `gh` fills them from the repository of the session's directory. For an additional repository, write its owner and name in their place (`multi-repo.md`).

## 1. Reads

Make every read with `gh`, one read per Bash call, never inside a shell loop. Spell every API read out on one line with `--hostname <host>`. A failed read ends the run `blocked`, naming the read. Never treat a failed read as "nothing required".

One exception: the rules read below returning HTTP 403 with a message to upgrade or to make the repository public means the repository has no rulesets. Record that in `run.md` and take the required checks from branch protection alone.

**Required checks.** Read them once, before the first poll:

- `gh api --hostname <host> repos/{owner}/{repo}/branches/<base> --jq .protection` gives `required_status_checks`: the `contexts`, and the `checks` with their `app_id`. Never use the `/protection` endpoint.
- `gh api --hostname <host> "repos/{owner}/{repo}/rules/branches/<base>?per_page=100" --paginate` gives the rulesets' required status checks and required workflows.

`<base>` is the pull request's base branch.

**The pull request, at every poll.** Read it with these two reads, each in its own Bash call:

- `gh pr view <n> --json headRefOid,mergeable,baseRefName,state`
- `gh api --hostname <host> repos/{owner}/{repo}/pulls/<n> --jq .merge_commit_sha`

Then judge:

- A state other than OPEN ends the run `blocked`.
- A `baseRefName` that differs from `<base>` ends it `blocked` (retargeted).
- Read the live remote head with `git ls-remote --heads <remote> refs/heads/<branch>`. It must equal the last sha this run pushed. A `headRefOid` that differs from the last pushed sha is pending within two minutes of the push and a mismatch after that; a mismatch ends the run `blocked`.
- `CONFLICTING` ends the run `blocked` at once.

**Results,** for the head commit and for the test merge commit (`merge_commit_sha`), each read in its own Bash call:

- `gh api --hostname <host> "repos/{owner}/{repo}/commits/<sha>/check-runs?filter=latest&per_page=100"`. Page it when `total_count` exceeds 100.
- `gh api --hostname <host> "repos/{owner}/{repo}/commits/<sha>/status?per_page=100" --paginate`

For each required workflow: `gh api --hostname <host> "repos/{owner}/{repo}/actions/runs?head_sha=<sha>&per_page=100" --paginate`, matching a run to the required workflow by its workflow path and its repository.

Use only the latest result per context and per check suite.

## 2. Applicability

Decide which workflows apply to the pull request from the workflow files:

- Judge a `pull_request_target` workflow from the base branch's file.
- Apply the `branches`, `branches-ignore`, `paths`, `paths-ignore` and `types` filters. The type is `opened` for a pull request this run opened and `synchronize` for a continued branch or after a repair push.
- A filter you cannot judge counts as a match.
- A skip marker in the head commit message makes a `pull_request` workflow not applicable: `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]`, or a `skip-checks: true` trailer. Required checks stay required.
- A deferred check (one Step 6 left to CI) whose filters exclude the pull request is not expected. Name it in the report.

## 3. Pass

A result passes when it is success, neutral or skipped. Anything else that finished fails.

The gated commit is the test merge commit when it has any result, else the head commit.

- A required check is met when its latest result on the gated commit passes, from the required app when the rule sets one.
- A required check that exists only as a status and names an app ends the run `blocked`: a status carries no app.
- A required workflow is met when its latest run for the head commit passes.

## 4. Polling and green

Poll about thirty seconds apart: wait with `sleep 30` in its own Bash call. At each poll take `date -u +%Y-%m-%dT%H:%M:%SZ` and check the run budget.

Judge nothing before two minutes have passed since the push, counted from the time taken right after the push returned.

The result is green when all of these hold:

- Every required check and required workflow is met.
- Every expected deferred check passed.
- Every applicable workflow reported.
- Every latest result finished and passed.

A result still pending past the `ci` budget (45 minutes by default) ends the run `blocked`. The result is not applicable only when nothing is required, applicable or expected, and nothing was seen within two minutes.

Return to Step 7.3 item 5 in `steps/7-publish.md`.
