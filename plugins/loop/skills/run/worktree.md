# The detached worktree run

Read this file when Step 0.3's exception applies (a flagged file differs from HEAD and the tree is clean), before the worktree is created.

## Creating it

The worktree path is `<checkout-parent>/<checkout-name>-reimagine-<branch-slug>`, for example `C:/src/app-reimagine-feat-68-export` beside `C:/src/app`. It sits beside the checkout, never inside it.

Do Step 0.5's work first, in the original checkout: add the `.reimagine/` exclude and create the record directory. The record then exists before the worktree does, and from then a stop writes the report.

Create the worktree detached at the base commit: `git worktree add --detach <path> <base>`.

Record two roots in `run.md`:

- `<checkout>`: the worktree.
- `<record>`: the record directory, under the original checkout.

## Working in it

- Run every git command for the primary as `git -C <checkout>`.
- Run every other command that acts on its tree (checks, `git add -N`, `gh` calls that read its branch) in one Bash call as `cd <checkout> && <command>`, with absolute paths. A bare `cd` that outlives the call is never used.
- Install dependencies in the worktree before the baseline, with the install the repository names, under the `check` budget. When no install is known and a check fails for that reason, the check is "not run" in the worktree, not a baseline failure.
- A continued branch checked out in the session's checkout cannot be checked out in the worktree. Step 0.2 detached the session in place; if the session is still on the branch, end the run `blocked`.
- A branch switch inside the worktree detaches in place and fast-forwards with `git fetch . refs/remotes/<remote>/<branch>:refs/heads/<branch>`.
- Name `<checkout>` as the only checkout in every implementer brief.
- Diff reviews read `<record>/diff.patch`, written from `git -C <checkout> diff <merge-base>` after `git -C <checkout> add -N`. A higher-risk run uses the `opus` stand-in, because `code-review` reviews only the session's checkout.
- Step 7.2 opens the pull request with `cd <checkout> && gh pr create --head <branch> --body-file <record>/pr-body.md ...`, with `<record>` as an absolute path.

## At the end

Keep the worktree. The report names it and the command `git worktree remove <path>`. When a handoff names the worktree, it must stay until the audit has run.

Return to Step 0.3 in `steps/0-preflight.md`.
