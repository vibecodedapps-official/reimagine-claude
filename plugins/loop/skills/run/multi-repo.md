# More than one repository

Read this file at the start of Step 0 when the request says "also edit", and at Step 1.2 when the user adopts additional repositories. It says how each step changes when more than one repository is writable.

The primary is the session's repository, or its worktree when Step 0.3 made one. Each "also edit <path>" is an additional writable checkout; "also edit <path> on <branch>" continues that branch there.

## Rules by step

**Host.** Every repository has the same host class and hostname. A mismatch ends the run `blocked`. Off github.com, every `gh` command except `gh api` that names a repository passes `-R <host>/<owner>/<repo>`.

**Commands.** Run git as `git -C <path>`. Run `gh` with `-R`, or inside the checkout in one Bash call as `cd <path> && <command>`. `gh api` takes no `-R`: for an additional repository, write its owner and name in the endpoint in place of `{owner}/{repo}` (for example `repos/owner/app-infra/pulls/<n>`). Spell each API read out on one line with its endpoint and `--hostname <host>`.

**Step 0.1.** Read the instruction files and the ask-first rules of every repository and union them. The permission statement lists each repository's push and pull request.

**Steps 0.2 to 0.4.** Run each per repository, with its own default branch, base commit and planning snapshot.

**Step 0.3.** The worktree exception applies to the primary only. For an additional repository, record its skip-worktree and assume-unchanged paths that differ from HEAD. No slice may edit them, because the edit is invisible to diff, `git add -N` and staging. A plan that needs one ends the run `blocked` at Step 2.

**Step 0.5.** The record lives only in the primary's original checkout. `inputs.md` and `run.md` get a section per repository.

**Steps 1 to 3.** Fetch each ticket from its owning repository. No slice spans repositories. Each repository has its own branch (new or continued), baseline and checks.

**Step 5.** Review only the repositories with a diff: mark new files with `git -C <path> add -N` and test with `git -C <path> diff <merge-base> --stat`. For each additional repository write `<record>/diff-<slug>.patch` from `git -C <path> diff <merge-base>`. The `fable` reviewer reads every patch. For a higher-risk run, `code-review` covers the primary in the session's checkout, and an `opus` stand-in reviews each additional repository (and a primary in a worktree), continued with SendMessage across rounds.

**Step 6 on `other`.** At the end of Step 6, write one body per repository with a diff: the primary's to `pr-body.md` and each other to `pr-body-<slug>.md`, each with the run suffix from run 2 on, as `record.md`, Files, says. On an Azure DevOps remote, also write one `comment-<n>.md` for each repository, numbered in turn, and the report names the repository each one goes with. Each body's "Related pull requests" says the links between the pull requests are added by hand.

**Step 7.** Publish one pull request per repository with a diff, each on its own branch and base:

- Write each body with "Related pull requests" set to "pending". Write the primary's to `pr-body.md` and each other to `pr-body-<slug>.md`.
- When every pull request is open, edit each body this loop opened once, to fill in the sibling links: `gh pr edit <n> --body-file <absolute path>`. On a continued branch whose pull request this loop opened, that edit and Step 7.2's body update are one edit, written with the sibling links.
- `done` needs every pull request green.
- A block in any repository stops publication in all. The one exception is the sibling-link edit of a pull request this run already opened.
- Closing references appear only in the ticket's own repository, as `pr-body.md` says.

**Handoff.** The first bundle is the primary, then the "also edit" order. A verified check is listed only for the first bundle.

## Adoption at Step 1.2

After the user answers the adoption question with a yes or a subset, run these in order across all adopted repositories:

1. Host detection for each.
2. Step 0.1 for each, and print the permission statement again.
3. Step 0.2 for each: default branch and base.
4. Step 0.3 clean-tree check for each. A dirty tree ends the run `blocked`.
5. The branch question below.
6. Step 0.2's continue checks for each repository that continues a branch.
7. Step 0.4 and the `.reimagine/` exclude for each.
8. The record sections for each.

### The branch question

Ask it once, for every repository that has no explicit branch. First compute the suggestions for each repository:

- The branch HEAD is on, when its tip equals the remote's tip and it is not the default branch.
- Every remote branch whose shared stem with another repository's seed name qualifies.

The shared stem of two names is their longest common prefix, kept whole when it is the whole of either name, else cut back to its last separator (`/`, `-`, `_` or `.`). It qualifies when it is not empty, is not cut at a `/`, and is not a prefix of this repository's default branch name.

Print one line per repository: `<path>: suggested <branch>[, <branch>]` or `<path>: no suggestion`. Then ask: reply `yes` to take the single suggestion where a repository has exactly one, then give one `<path>@<branch>` or `<path>@new` line for each other repository.

Validate each branch with `git check-ref-format --branch` and the exact remote ref `refs/heads/<branch>`. A branch that is missing from the remote, or a reply that does not cover every repository, ends the run `stopped`.

Return to the step that sent you here.
