# Step 7 Publish

Read this file at the start of Step 7. `<checkout>` is the primary repository's checkout (its worktree when Step 0.3 made one), `<record>` is the record directory, `<remote>` and `<default>` come from Step 0.2, and `<branch>` is the run's branch. In a run with a worktree, read `worktree.md` for the commands; with more than one repository, read `multi-repo.md` for Step 7. Every git command in this step runs as `git -C <checkout>`, except when `<checkout>` is the session's own directory: then it runs without `-C <checkout>`, since the skill pre-approves only the plain read-only forms.

## Opening

Take `date -u +%Y-%m-%dT%H:%M:%SZ` now and copy the output into `run.md`. Write the `7` entry `running` in steps.json with its input hashes.

Publication runs only when all of these hold:

- No blocking defect is open and Step 6 passed. A run with an open blocking defect or a failed Step 6 ends `blocked` here and publishes nothing.
- The host is `github`. On any other host the run ends `prepared` with the push command.
- The request has no "do not publish".

When publication does not run, the run ends `prepared`. Before it ends, write the body for the publish commands the report gives. With one open pull request on the branch, read `pr-body.md` and write the continued pull request comment to `<record>/comment-<n>.md`, numbered as `record.md` says, so the report can give the `gh pr comment <pr> --body-file <absolute path>` command. With no pull request, write the pull request body to `<record>/pr-body.md`, so the report can give the `gh pr create` command.

A question about a commit, a push or a pull request, raised because an ask-first rule applies, ends the run `prepared` when the answer before any push is anything but a clear yes. The same answer after the run's first push ends `blocked` and the pushed work stays as it is.

## 7.1 Commit

Commit the work of each slice whose closing commit is not yet on the branch, one commit per slice, and record each sha as the slice's `commit` in steps.json.

- Write the message as `type(scope): subject`, lowercase, with a body that says why the change was made. When the repository's instruction files set another form, follow them.
- Write a bare `@token` in backticks.
- Name no model, no agent type and no tool, in the subject or the body. Type no attribution trailer.
- Stage paths by name only. Never run `git add -A` or `git add .`.
- Before each commit run `git -C <checkout> diff --cached --name-only` and confirm the list is exactly the slice's paths and holds nothing under `.reimagine/`. Unstage anything else with `git -C <checkout> restore --staged <path>`.

After the run's first push returns, commit only CI repairs (item 5 of Step 7.3).

## 7.2 Push and pull request

Before pushing, judge whether the push or the pull request triggers a deploy. Read the default branch's workflow files with `git -C <checkout> show <remote>/<default>:<path>` for each path that `git -C <checkout> ls-tree -r --name-only <remote>/<default> .github/workflows` lists, and the workflow files of the commit being pushed with `git -C <checkout> show HEAD:<path>` for each path that `git -C <checkout> ls-tree -r --name-only HEAD .github/workflows` lists. Judge a `push` or `pull_request` trigger from either set; a workflow that deploys in either set counts. A `pull_request_target` workflow is judged from the default branch's file. When a push or the pull request triggers a deploy, ask first, naming the workflow, and treat any answer but a clear yes as a denial.

Before every push read the remote head with `git -C <checkout> ls-remote --heads <remote> refs/heads/<branch>`:

- Before the first push of the run it must equal the sha Step 0.2 fetched, or be absent for a branch that is new.
- Before a CI repair push it must equal the last sha this run pushed.

A difference ends the run `blocked`, naming the branch and the two shas. Never force push, rebase, reset or amend.

For a continued branch, also run Step 0.2's pull request query again before the first push. A pull request that was recorded and is missing from the open list (closed or merged), one with a different base branch, a pull request opened since Step 0, several open pull requests, or a list of 100 entries (incomplete) ends the run `blocked`.

Push with `git -C <checkout> push -u <remote> <branch>`. When it returns, take `date -u +%Y-%m-%dT%H:%M:%SZ`, run `git -C <checkout> rev-parse HEAD`, and keep both as the last push time and the last pushed sha. Do the same after every later push.

**No open pull request on the branch.** Read `pr-body.md`. Write the body from its `## Pull request body` template to `<record>/pr-body.md`. Open the pull request against the default branch:

`gh pr create --title "<title>" --body-file <absolute path to pr-body.md> --base <default>`

Add `--head <branch>` on a continued branch. The title is the single ticket's title, or the plan's one-line summary when there are several inputs, at most 70 characters. Record the pull request in steps.json as `runs[].pr`, in the form `github:<owner>/<repo>#<n>`, from the url `gh pr create` prints.

A pull request opened on a continued branch lists, under "Decisions for the reviewer", the commits that were on the branch before the run (the foreign commits from `inputs.md`) and says they were reviewed as part of this run's diff.

**One open pull request on the branch.** Read `pr-body.md`, write the continued pull request comment from its `## Continued pull request comment` template to `<record>/comment-<n>.md`, numbered as `record.md` says, and post it after the push:

`gh pr comment <pr> --body-file <absolute path to comment-<n>.md>`, where `<pr>` is the pull request number.

Never edit the body of that pull request. Record it as `runs[].pr`.

Every `--body-file` is an absolute path.

## 7.3 CI

Read `ci-watch.md` and carry out its items 1 to 4 for the pull request, starting from the last push time. Item 5 is here.

**Item 5, repair.** A red result (a required check, a required workflow, a deferred check or an applicable workflow that finished and did not pass) is repaired in a cycle:

1. Read the failure from the failing run's log with `gh run view <run-id> --log-failed`, in its own Bash call.
2. Judge the higher-risk rule before the round. A run that is higher-risk uses `code-review` or its stand-in, and a run never goes back to the other role.
3. Re-enter Step 5 for one round on the repair, then run Step 6 in full once.
4. Commit the repair under the rules of 7.1, read the remote head as 7.2 says (it must equal the last pushed sha), push, and take `date` and the new sha.
5. Return to `ci-watch.md` item 1 for the new head.

At most three cycles run. A result still red after the third, or a repair the round cannot fix, ends the run `blocked` with the pull request linked in the report and nothing further pushed. A pull request that is not OPEN, a changed base and a merge conflict end it `blocked` at once, as `ci-watch.md` says. An expired run budget ends it `blocked` with the pull request left as it is.

## 7.4 Ticket comments

After the pull request is open and 7.3 has ended without a block (green, or not applicable), post one status comment per ticket per run. Read the `## Ticket comment` template in `pr-body.md` and write each body first.

- GitHub: write the body to `<record>/ticket-<id-slug>.md` and post `gh issue comment <n> --body-file <absolute path>`.
- Azure DevOps: use the Azure DevOps MCP tool when one is listed, else `az boards work-item update --id <n> --discussion "<text>"`, reading the text from a file when quoting fails.
- Salesforce: use the Salesforce MCP tool when one is listed.
- A host with no tool: put the comment text in the report instead of posting.

Post no comment before the plan is final and none on a run that ends `blocked`. Open no issue. File and text inputs get no comment.

## 7.5 Deferred items

List each deferred item with its reason in the report and in the pull request body. A deferred item never becomes an issue, a comment that asks for one, or a pull request.

Write the `7` entry in steps.json: `complete` after its outputs exist, `failed` when the run ends `blocked` here. Every terminal state goes to Final report handling in SKILL.md.
