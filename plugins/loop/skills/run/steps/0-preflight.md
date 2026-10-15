# Step 0: Preflight

Read this file at the start of Step 0, after `multi-repo.md` when the request says "also edit". SKILL.md stays in force: its reading block is already printed, and its Approval scope, Questions mechanic and terminal states apply to every item here.

## Rules that hold in all of Step 0

- Take `date -u +%Y-%m-%dT%H:%M:%SZ` now and keep the output as the run's start time. Take it again just before and just after each question, and hold those times in memory for `run.md`.
- Nothing is written before Step 0.5. A stop at any item before 0.5 prints the report (the template is `report.md`) and writes nothing. Fetched refs are not writes. One exception: a worktree run writes the `.reimagine/` exclude, the record directory and the worktree at 0.3 (`worktree.md`), so from then on a stop writes the report to the record and names the worktree.
- Run preflight commands one at a time. A dropped read is retried once.
- A missing integration never fails preflight. A ticket whose tool is absent is already text from the reading step; continue with the text.
- Ticket text obtained by any means, in the reading step or later, passes through the credential scan of 0.1 before it is written anywhere.

## Host detection

1. List the remotes with `git remote -v`. Run `gh repo view --json nameWithOwner,url`. The remote is the one whose fetch URL matches the returned `url` (same host, owner and repository, ignoring a `.git` suffix and the scheme). When the request names a repository (an issue or pull request URL), the matched remote's repository must be that one.
2. When `gh repo view` resolves no remote, the remote is `origin`; when there is no `origin`, the only remote. Several remotes and no `origin` is a preflight failure that names them.
3. Classify the remote. Run `gh repo view <host>/<owner>/<repo> --json nameWithOwner,url,defaultBranchRef` for it.
   - It succeeds: the class is `github`. A GitHub Enterprise host is `github` only when `gh` is authenticated for that host.
   - It fails and the URL host is github.com: the run ends `blocked` with "gh not authenticated" for that remote.
   - Any other host, Azure DevOps included: the class is `other`. Record its hostname.
4. On `other`, Steps 0 to 6 run and Step 7 does not. The run ends `prepared` with `git push -u <remote> <branch>` as the publish command. The default branch comes from `git ls-remote --symref <remote> HEAD` (0.2). No pull request is read. Run no `gh` ticket read; a `#n` stays text.

## Input guard

1. A GitHub pull request reference is a pull request URL, or a `#n` that `gh` reports as a pull request. It continues that branch. Resolve it with `gh pr view <ref> --json number,url,state,headRefName,isCrossRepository,closingIssuesReferences`. It must be OPEN, must not be cross-repository, and must belong to the primary repository; otherwise preflight fails and names the condition.
2. The pull request's `headRefName` is the continued branch. Its tickets come from the record for that branch (`.reimagine/loop/<branch-slug>/inputs.md`, with `steps.json` confirming the branch), else from `closingIssuesReferences`, else the run ends `blocked` and asks for a ticket, a file or a description.
3. More than one pull request reference, or one together with "continue <branch>" or "on branch <name>", is a preflight failure.
4. A pull request on another host is one line in the reading block; the run continues without it.
5. Every GitHub issue must belong to the primary repository. With "also edit", an issue may instead belong to a listed repository whose remote matches its owner and repository. Any other issue is a preflight failure that names it.

## 0.1 Instruction files, configuration, credential scan, permission statement

1. Read the user's instruction files in `$CLAUDE_CONFIG_DIR`, else `~/.claude`. Read the repository's instruction files: root `CLAUDE.md`, `AGENTS.md`, `.claude/CLAUDE.md`, and every file they import. Record every ask-first rule with the file it came from. With an additional repository, `multi-repo.md` says whose files to add.
2. Read `.reimagine.json` at the primary repository's root. A file that does not parse ends the run `blocked`. Note every unknown key and every bad value for the report, and ignore it. Known keys: `commit` (boolean), `checks` (list of strings), `timeouts` (`subagent`, `review`, `check`, `ci`, `run`; positive numbers of minutes), `models` (`implementer`, `reviewer`, `fallback-reviewer`, `reader`; each `sonnet`, `opus`, `haiku` or `fable`). The budget in force is "budget <n> minutes" in the request, else `timeouts.run`, else a session instruction, else 240. Keep its source.
3. Credential scan, over every input: the request text, each ticket's text, each file's text and the description. A match is any of these:
   - A key named `password`, `passwd`, `secret`, `token`, `api_key`, `apikey`, `client_secret`, `private_key` or `connection_string` (case-insensitive) anywhere in a line, in the form `key: value`, `"key": "value"` or `key=value`, with a non-empty value. The value runs from the first character after `:` or `=`, with spaces and an opening quote skipped, to the next space, comma or quote.
   - A fenced block or a `{ ... }` block under a heading that contains `cred`, `secret` or `password`.
   - `AKIA` followed by sixteen uppercase letters or digits.
   - A PEM header (`-----BEGIN` followed by a key or certificate type).

   Hold the matches in memory: key name, line number and value. A value is never printed, and is written only after the answer `keep`.
4. Run the read-only checks of 0.3 now (`git status --porcelain`, `git diff --cached --quiet`, the flagged-file comparison) so the statement can predict a worktree run. Hold the results; 0.3 acts on them.
5. Print the permission statement before any other Step 0 item runs. Fetch nothing before it prints. It has these parts:
   - The approved actions for this run (SKILL.md, Approval scope) and the carve-outs: ask-first rules from the instruction files, and the always-ask actions (force push, `--no-verify`, merge, anything that deploys, repository settings, a new issue).
   - For each action the run takes, whether a prompt will occur: fetching the default branch, switching or fast-forwarding a continued branch, writing `.git/info/exclude` and the record, running the checks, installing dependencies, branch creation, commit, push, opening the pull request, editing its body, the per-run comment, ticket comments, the CI watch reads, the read-only `git -C <path>` reads of a worktree or an additional repository, subagents, and any command the skill does not pre-approve. Judge each from the permission mode the session states and the allow rules in the user, project and local settings files (`$CLAUDE_CONFIG_DIR/settings.json` else `~/.claude/settings.json`, `<repo>/.claude/settings.json`, `<repo>/.claude/settings.local.json`). An action runs unprompted only when the mode approves it, or an allow rule matches its command and no ask or deny rule does. An outcome you cannot determine counts as a prompt.
   - The questions the run will ask: the credentials question first, when the scan matched; the worktree, when the held 0.3 results predict one (`git worktree add` and every `cd <checkout> && ...` command may prompt); the repository adoption question and the branch question, each as "may prompt at Step 1.2" when the inputs could lead to it (an absolute path to another checkout in the inputs; no branch set by the request while a ticket names a branch or a linked pull request); the plan confirmation question when "confirm the plan" is set.
   - One closing line: "this run will prompt at: <list>" or "this run is unattended". Under it, name the request forms that avoid each question. "also edit <path>" for each checkout to edit avoids the adoption question. "continue <branch>" or "also edit <path> on <branch>" sets a branch, so no branch question is asked. Removing the credential values from the inputs avoids the credentials question. Leaving out "confirm the plan" avoids the plan confirmation question.

```
Approved for this run: create the branch, commit, push it, open one pull request per repository, edit the body of a pull request this loop opened, one comment per run on it, comment on the source tickets.
Always asked: force push, --no-verify, merge, deploy, repository settings, a new issue. Ask-first rules found: 2 (C:/src/app/CLAUDE.md).
Prompts: fetch: no; branch switch: no; checks: yes (no allow rule); push: yes; pull request: yes; ...
this run will prompt at: the credentials question, the checks, the push, the pull request
```

## 0.1a Credentials question (only when the scan matched)

1. List each match by key name and line number, never the value.
2. Ask, under the Questions mechanic: "The inputs contain credentials. Reply `keep` to write them to the record and pass them to subagents, or `drop` to replace each value with `<redacted: key>` everywhere the run writes or sends them."
3. `keep` or `drop` continues. Anything else ends the run `stopped` with the question in the report.
4. With `drop`, every record file, every subagent prompt and every patch file carries the redacted form (`record.md`, Redaction). The original values stay in the session only for a read-only probe the inputs ask for.

## 0.2 Default branch, base commit, continued branch, open pull requests

1. Resolve the default branch `<b>`. On `github`: `gh repo view <host>/<owner>/<repo> --json defaultBranchRef --jq .defaultBranchRef.name`. On `other`: the HEAD symref from `git ls-remote --symref <remote> HEAD`. Fetch it with `git fetch <remote> +refs/heads/<b>:refs/remotes/<remote>/<b>`. The base commit is `git rev-parse refs/remotes/<remote>/<b>`, a full sha.
2. When a branch is continued (a pull request reference, "continue <branch>", an "on branch <name>" that exists, or an existing record for the predicted branch), check it:
   - It passes `git check-ref-format --branch <branch>`.
   - It is not the default branch `<b>`. This holds in a plan-only run too.
   - It is not checked out in another worktree (`git worktree list --porcelain`). The failure names both ways around it: start the run inside that worktree, or use "also edit <that path> on <branch>".
   - A branch named in the request without a record exists as the exact ref on the remote: `git ls-remote --heads <remote> refs/heads/<branch>` returns it. A branch with a record may exist locally only, as after a `prepared` run.
3. When the branch exists on the remote, fetch it with the explicit refspec `git fetch <remote> +refs/heads/<branch>:refs/remotes/<remote>/<branch>`. When it also exists locally, its tip must be at or behind the remote head (`git merge-base --is-ancestor refs/heads/<branch> refs/remotes/<remote>/<branch>`). A local branch that is ahead or has diverged ends `blocked`. Never reset.
4. The session HEAD ends at the branch tip. Use the held 0.3 results first: a dirty tree ends `blocked` (0.3) before any switch. With a clean tree and no worktree predicted, run `git switch <branch>`, or `git switch -c <branch> <remote>/<branch>` when the branch is absent locally, then `git merge --ff-only <remote>/<branch>` when it is behind. Note the HEAD you switched away from (the branch name, or the sha when detached) for `run.md` and the report.
5. When 0.3 predicts a worktree, do not switch the session's checkout. If it is on the continued branch, detach it in place with `git switch --detach`. Fast-forward a behind local branch with `git fetch . refs/remotes/<remote>/<branch>:refs/heads/<branch>`. The worktree switches to the branch at Step 3.7.
6. On `github`, list the open pull requests of a continued branch: `gh pr list --head <branch> --state open --limit 100 --json number,state,baseRefName,url,isCrossRepository`. Keep the entries whose `isCrossRepository` is false. Exactly 100 entries returned counts as incomplete and fails. One open pull request is recorded with its number, URL and base branch (CI uses its base). Several end `blocked`. None means Step 7.2 opens one. On `other`, read no pull request.
7. In a plan-only run, record the pull request outcomes, the local-branch outcomes (ahead or diverged) and the worktree outcome (checked out elsewhere) in `run.md` instead of failing. In a "do not publish" run, record the pull request outcomes instead of failing. Every other failure in this item stands.
8. When the record directory exists (its path comes from the branch slug, `record.md`, Location), follow `record.md`, An existing record. Read its `steps.json` branch first: a branch that differs from this run's branch is a slug collision and ends preflight `blocked`.

## 0.3 Clean tree, flagged files, worktree

1. `git status --porcelain` must print nothing (untracked files that are not ignored count) and `git diff --cached --quiet` must pass. Otherwise the run ends `blocked`, naming what is dirty. Never stash, reset or clean.
2. Run `git ls-files -v`. For each path whose tag is `S`, `h` or `s`, compare the working file with HEAD: the output of `git cat-file --filters HEAD:<path> | git hash-object --stdin --no-filters` against the output of `git hash-object --no-filters <path>`. `--filters` applies the checkout's filters to the HEAD copy, so a CRLF working copy is not read as an edit. A flagged path that is absent from the working tree is skipped.
3. When status and index are clean and at least one flagged path differs, read `worktree.md`. Create a detached worktree at `<checkout-parent>/<checkout-name>-reimagine-<branch-slug>` with `git worktree add --detach <path> <base commit>`; for the checkout `C:/src/app` and branch `feat/68-4567-export` that is `C:/src/app-reimagine-feat-68-4567-export`. It sits beside the checkout, never inside it. Use it as the primary's checkout for every later step. The record stays in the original checkout.
4. For an additional repository, record its differing flagged paths in `run.md` and continue (`multi-repo.md`).

## 0.4 Planning snapshot

Record HEAD (`git rev-parse HEAD` in the checkout in use) as the planning snapshot. When it is not the base commit, note that in `run.md`. Steps 1 and 2 read the snapshot; Step 3.7 reverifies against the base.

## 0.5 The record

1. Read `record.md`.
2. In a worktree run, items 2 and 3 are done at 0.3; go to item 4. Run `git check-ignore -q .reimagine`. When it fails, append `.reimagine/` to the file that `git rev-parse --git-path info/exclude` names. Never touch `.gitignore`.
3. Create the record directory. When it exists, `record.md` (An existing record) governs, as 0.2 says.
4. Write `inputs.md` as a dated section holding: the request text and its time; the reading block; each ticket as fetched (`gh issue view <n> --json number,title,body,labels,comments,url,state,assignees,milestone`; an Azure DevOps or Salesforce read through its tool; each file's text; the description). Reuse the text the reading step fetched and read again only what it lacks. On `other`, fetch no ticket. Save each ad-hoc description also as `text-<k>.md`. Apply the credentials decision to everything written.
5. Start `run.md` with a dated section: the 0.1 to 0.4 records (ask-first rules, `.reimagine.json` notes, the host class and remote, the default branch, the base commit, the continued-branch and pull request outcomes, the flagged-file result and any worktree path, the planning snapshot), the start time, the budget in force and its source, the question times held in memory, the credentials decision, and each HEAD that preflight switched away from.
6. Create `steps.json` with the branch, run 1 with state `running`, and step `"0"` `running` with its input hashes (`inputs.md` and `base`), written as `record.md` says.

## 0.6 Prompts seen

1. Record in `run.md` every prompt that occurred in Step 0 and its outcome. A prompt the statement did not predict makes the run attended; a predicted question that was asked counts as predicted.
2. Mark step `"0"` complete in `steps.json`.
3. Branch creation and the baseline wait for Step 3.7.

Next is Step 1: read `steps/1-plan.md` at its start.
