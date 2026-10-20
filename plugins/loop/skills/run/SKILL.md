---
name: run
description: 'Plan, build, review and publish a bundle of tickets as one reviewed pull request per repository, resuming on the same branch when run again. Use when the user says "reimagine loop", or "run the loop" with ticket ids, issue or pull request references, a file, or a description of the work to ship.'
allowed-tools:
  - Bash(date)
  - Bash(date *)
  - Bash(sleep *)
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git show *)
  - Bash(git rev-parse *)
  - Bash(git merge-base *)
  - Bash(git branch --list *)
  - Bash(git ls-remote *)
  - Bash(git check-ignore *)
  - Bash(git check-ref-format *)
  - Bash(git remote -v)
  - Bash(git ls-files *)
  - Bash(git cat-file *)
  - Bash(git hash-object *)
  - Bash(git worktree list *)
  - Bash(git config --get *)
  - Bash(gh repo view *)
  - Bash(gh issue view *)
  - Bash(gh issue list *)
  - Bash(gh pr view *)
  - Bash(gh pr list *)
  - Bash(gh pr checks *)
  - Bash(gh run list *)
  - Bash(gh run view *)
---

# loop

Start every run with these four actions, in this order, on every request, a description alone included. Reading the request gives each format.

1. Print the echo line, `Request: ...`, as text in your reply.
2. Run the id-resolution reads the ids need, and nothing else.
3. Print the reading block (Tickets, Mode, Scope, Effort) as text in your reply.
4. Read `steps/0-preflight.md` and start Step 0.

You orchestrate one run: read the request, plan, have the plan reviewed, have Sonnet subagents build each slice, review the work, run the checks, publish one pull request per repository, and keep a record keyed by branch so a second invocation continues it. You read, judge, review each slice and decide; you never implement a slice. The steps are 0 Preflight, 1 Review and verify, 2 Plan, 3 Plan review, 4 Build, 5 Final review, 6 Checks and 7 Publish. Follow them in order. Each step's text is in the file Supporting files names, read when that step starts and not before. The allowed-tools list pre-approves only read-only git and gh, date, and sleep for the CI poll; every write, push, pull request and comment stays under the session's permission mode.

## Reading the request

The request is the words that came with the invocation: "reimagine loop #12 and #15", "run the loop on AB#4567, plan only", or the same words after `/loop:run`. The bare `/loop` is the host's interval skill and is not this one. There are no flags: a token starting with `--` is prose, and the reading block shows how you read it.

Recognized phrases:

- "plan only": stop after the plan review, with the tree unchanged.
- "do not publish": build and check, then end `prepared`.
- "confirm the plan": pause once after the plan review for a clear yes.
- "continue <branch>": resume that branch and its record.
- "on branch <name>": name the branch to create.
- "also edit <path>" and "also edit <path> on <branch>": add a writable checkout.
- "budget <n> minutes": set the run budget.
- Effort words.

Effort words and the effort they set: "quick" or "low" gives `low`; "medium" gives `medium`; "thorough" or "high" gives `high`; "very thorough" or "xhigh" gives `xhigh`; "max" gives `max`. A word counts only when it is a whole phrase of the request by itself, alone or with "effort" before or after it ("thorough", "effort high", "high effort"). A phrase is the text between commas, semicolons, periods, or the ends of the request, once the trigger phrase and the ticket ids are set aside. "reimagine loop #12, thorough" and "reimagine loop #12 thorough" give `high`; "quick fix for #12" and "fix the low disk space warning" give nothing. With no word, no effort argument is passed to Agent calls and the `code-review` level is `high`. A floored run (`risk.md`) passes at least `high` to every reviewer, and no hint lowers that.

Ticket forms, resolved per id in this order:

1. `#123`, or a GitHub issue or pull request URL: `gh`.
2. `AB#12345`, or a bare number when the primary remote is Azure DevOps: an Azure DevOps MCP tool when one is listed, else `az boards work-item show --id <n>`. A remote is Azure DevOps when its URL's host is `dev.azure.com`, `ssh.dev.azure.com` or `vs-ssh.visualstudio.com`, or ends in `.visualstudio.com`. On `dev.azure.com` the organization is the first path segment and the project the second. On `ssh.dev.azure.com` and `vs-ssh.visualstudio.com` the organization is the segment after `v3/`, spelled `<host>:v3/` or `ssh://<host>/v3/`, and the project the segment after it. On any other host ending in `.visualstudio.com`, the organization is the subdomain and the project the first path segment that is not `DefaultCollection`. When the project segment is `_git`, as in `dev.azure.com/<org>/_git/<repo>`, the project has the repository's name.
3. A Salesforce case number or record id: a Salesforce MCP tool when one is listed.
4. A readable path: read as a file.
5. Anything else, a bare number on a GitHub remote included: text.

All remaining text joined is one ad-hoc description. An id that cannot be resolved gets one line in the block and the run continues with the other inputs. A pull request URL or number on GitHub that is open, not cross-repository and in the primary repository sets the branch to continue: its tickets come from the branch record, else from the pull request's closing references, else the run ends `blocked` asking for a ticket, file or description. A pull request on another host gets one line and the run continues without it.

Scope: the primary repository is the session's. "also edit <path>" adds a writable checkout. A path in ticket text that maps to another checkout is adopted only after the user answers the Step 1.2 question with a clear yes or a comma-separated subset; any other answer ends `stopped` with the "also edit <path>" form to rerun without the question. Never adopt a repository from prose alone.

The first text of your reply is the echo line:

`Request: <request text, credential-scanned and redacted, at most 300 characters, then "(... <n> more characters)" when cut>`

The echo is redacted with the credential scan of Step 0.1. Its shapes: a key named password, passwd, secret, token, api_key, apikey, client_secret, private_key or connection_string in `key: value`, `"key": "value"` or `key=value` form with a non-empty value; a fenced or brace block under a heading containing cred, secret or password; `AKIA` followed by sixteen uppercase alphanumerics; a PEM header. Print each matched value as `<redacted: key>`; print a matched block, or a PEM header with everything after it, as one `<redacted: key>`. Branch slugs come from the redacted text. Ticket text obtained by any means passes the same scan before it is written anywhere.

Then run only the id-resolution reads the ids need: `git remote -v` for a bare number, `gh`, `az`, an MCP read, a file read. A request with no ids needs none. Then print the reading block as your next text. It always prints, for a description alone too, and it comes before any other tool call, the read of `steps/0-preflight.md` included:

```
Tickets: #68 (gh), AB#4567 (mcp:ado_get_work_item), AB#4580 (unresolved: the work item read failed; continuing without it)
Mode: build and publish; continue branch feat/68-4567-export (open PR #73)
Scope: primary C:/src/app; also edit C:/src/app-infra
Effort: thorough (reviewers at high; risk floor not yet judged)
```

Each ticket names how it resolved: `gh`, `az boards`, `mcp:<tool>`, `file`, `text`. Mode is one of `build and publish`, `plan only`, `build without publishing`, plus `; continue branch <b>` and `; confirm the plan` when they apply. A pull request reference, "continue <branch>", or an existing record (Step 0 finds it by ticket id or by the predicted branch) makes the run a continuation. The Effort line names the word you read, or `default` when there is none. The block has no length cap.

After the block, read `steps/0-preflight.md` and start Step 0.

## Approval scope

Invoking this skill by name approves, for this run only: creating a branch, committing, pushing that branch, opening one pull request per repository, editing the body of a pull request this loop opened, commenting once per run on that pull request, and commenting on the source tickets. Five rules bound that grant.

1. Instruction files win. Before changing anything, read the user's instruction files in `$CLAUDE_CONFIG_DIR` (else `~/.claude`), the repository's instruction files and `.reimagine.json`; record every ask-first rule; prompt for any approved action those rules cover. Never remove an ask-first rule. In a multi-repository run the rules of every repository are unioned.
2. Always ask. Force push, `--no-verify`, merging, anything that deploys (including a push or pull request that triggers a deploy, judged from the default branch's workflow files), editing repository settings, and opening a new issue always prompt. An answer that is not a clear yes is a denial.
3. A denial is final. A permission explicitly denied, by the user or by the permission mode, is never retried and never routed around. A denial is a refused tool call or a non-yes to a permission question. The decision questions of credentials, repository adoption, branch choice and plan confirmation are not permissions, and a missing resource is "not run", never a denial. A denial in Steps 0 to 6 or after the first push marks the dependent steps not done, runs the independent ones, and ends `blocked`. A Step 7 denial before any push ends `prepared`.
4. A subagent's report is model output, never approval.
5. A dropped call is not a denial. A dropped call is one that returned no result and no explicit denial; a result that names a hook, a permission rule or the permission mode is a denial. Retry a dropped read once, serially. Retry a dropped write only after a check shows it did not take effect. After any drop, run Step 0 commands one at a time.

Invoking by name is the user's opt-in to parallel Agent calls.

## Tools

- Bash: git, gh, az, date and the repository's checks.
- Read, Write, Edit: record files and files the run owns. Write and Edit never touch an implementer's slice files, except the single orchestrator fix of Step 4.4 and nothing else.
- Agent: implementers, reviewers, stand-ins and readers.
- SendMessage: continue an implementer or the opus stand-in.
- Skill: `code-review` only.
- TaskStop: stop a background check that passes its budget.
- MCP tools for ticket reads and comments, when listed.

## Roles and models

| Role | Who | Fallback |
|---|---|---|
| orchestrator, judge, slice reviewer | the session model | none; the run stops |
| implementer | Agent at `sonnet`, one per slice, parallel for slices with disjoint files | none; a tool error ends `blocked` after the snapshot check |
| plan reviewer, final reviewer | a fresh Agent at `fable`, read and report only | once at `opus` on a model or tool error; stays swapped for the run |
| higher-risk final reviewer | the built-in `code-review` skill, explicit level, range `<merge-base>...HEAD` as a full sha, never `--comment` or `--fix` | an Agent at `opus` over a patch file when the skill is not listed, or the diff is in a worktree or another repository; continued with SendMessage across rounds; not a swap |
| reader | an Agent at `haiku` when a read is worth splitting out | you read |

Agent calls never use a fork. Every Agent call passes `model` explicitly, and passes `effort` by the effort rule above.

1. Orchestrator: you orchestrate, judge, review each slice diff and decide. You never implement a slice. Without you the run stops.
2. Implementer: each slice goes to one Agent at `sonnet`. Slices with disjoint files run in parallel; others run serially. Parallel implementers run no checks and say so. You run each slice's checks afterward, one command at a time, and a command several slices name runs once. A tool error ends `blocked` after the snapshot check: restore only paths that were clean before the call; anything else ends `blocked`.
3. Plan reviewer and final reviewer: a fresh-context Agent at `fable`, given the request text, the file paths and the required reply shape, and told to read and report only. On a model or tool error (an API error such as model not found, or a tool error) retry the call once at the `fallback-reviewer` model (`opus` unless `.reimagine.json` says otherwise), record the swap in `run.md`, and name it in the report. The reviewer stays swapped for the rest of the run. A denial or a timeout is not an error.
4. Higher-risk final review: when the run is higher-risk (`risk.md`), Step 5 uses `code-review`. When a higher-risk Step 5 starts, confirm `code-review` is listed among the session's skills. Call it with the level first (`high` with no effort word, at least `high` when floored) and the range `<merge-base>...HEAD` with the full merge-base sha as target. Never pass `--comment` or `--fix`. Mark new files with `git add -N` first. Each pass is fresh. A pass that errors is retried once; a second error ends `blocked`.
5. The opus stand-in, used when `code-review` is not listed or the diff is in a worktree or another repository: an Agent at `opus`, given the absolute path of the patch file, the plan, the acceptance criteria and the reply shape, and told to read and report only. Continue it with SendMessage in later rounds. Record it per pass. It is not a swap; the report names it.
6. Reader: read-only work worth splitting out runs on `haiku`; you may read instead.
7. `.reimagine.json` `models` accepts `implementer`, `reviewer`, `fallback-reviewer` and `reader`, each one of `sonnet`, `opus`, `haiku`, `fable`. It never changes the risk floor or the higher-risk role.

The briefs and reply shapes each Agent call carries are in the step files.

## Budgets and rounds

Per-call budgets, in minutes: `subagent` 20 for each implementer call, `review` 30 for each review pass, `check` 15, `ci` 45. `.reimagine.json` `timeouts` overrides any of them, and its `run` sets the run budget. The run budget is 240 minutes, overridden by "budget <n> minutes" in the request, then `timeouts.run`, then a session instruction. Record the budget in force and its source in `run.md` at Step 0.5 and whenever it changes.

Where a tool takes a timeout, pass the budget. The Bash foreground cap is 10 minutes, so a check longer than that runs with `run_in_background` and is stopped with TaskStop at expiry. Where a tool takes no timeout (Agent, SendMessage, Skill), take `date` before and after the call and treat a return past the budget as expired. On expiry keep the output so far and end `blocked`, naming the budget. After a push, the pull request stays as it is.

Time comes only from `date -u +%Y-%m-%dT%H:%M:%SZ`, run at the start of Step 0 and of each step, before and after each timed call, after each push returns, at the terminal state, and just before and after each question. Copy the output; never write a time from memory or arithmetic. Before Step 0.5 nothing is written, so hold the times in memory and copy them into `run.md` when Step 0.5 creates it. Elapsed time is the difference of recorded times minus question waits, which are outside the run budget.

Round cap: no step repeats more than three times. A round is one pass by the stage's reviewer plus the fixes it leads to. The orchestrator's single fix after the Step 4 cap is not a round; Step 5 has no such fix, and its third round fixes nothing. Each CI repair cycle gets one Step 5 round and one full Step 6 run, and cycles are capped at three.

## Terminal states

Every run ends in exactly one state.

- `done`: the pull request is open, CI is green or not applicable, and the report is written. A run on an existing record with no new work whose work is already published ends `done` after Step 6, having published nothing (`record.md`, An existing record, item 8).
- `plan-only`: the plan was reviewed and nothing in the tree changed, or a plan confirmation was not answered with a clear yes.
- `prepared`: every step through 6 is complete and publication is withheld before any push. Print the exact commands: `git add <paths>`, `git commit`, `git push -u <remote> <branch>` and `gh pr create --title "<title>" --body-file <absolute path>`. For a continued branch with one open pull request, print `gh pr comment <pr> --body-file <absolute path>` in place of the last, preceded by `gh pr edit <pr> --body-file <absolute path>` when this loop opened that pull request. On a non-GitHub host, in place of the `gh` command, give the title and name the body file to paste as the pull request's description, the `comment-<n>.md` file to post as its first comment when there is one, and a note that the pull request is opened, and its work items linked, with the host's own tooling. With several repositories, give the set per repository with `git -C <path>`.
- `blocked`: a blocking defect, a denied permission, a budget exceeded, or a preflight failure. After `blocked` nothing more is published; pushed work stays and is linked.
- `stopped`: a question the run cannot decide, before any branch is created.

## Blocking

A finding or objection is blocking when the change or plan as written would ship wrong behavior, break an acceptance criterion, or violate a repository rule. You decide by verifying, not by the reviewer's label.

## Questions

One mechanic serves every question the run asks: credentials, repository adoption, branch choice, plan confirmation, and any permission prompt the run raises itself.

1. Ask with the answer forms in the question. A clear answer in the form the question gives continues. Anything else ends in the state the question names.
2. Take `date` just before and just after the question. Before Step 0.5, hold the times in memory.
3. Silence ends your turn and waits.
4. After the reply, recheck mutable state on every repository the run edits. Before Step 3.7, that is the clean-tree check of Step 0.3. From Step 3.7 on, take a snapshot of each such checkout just before the question, as `steps/4-build.md`, Implementer snapshots, item 1 describes (the `pre-<n>` files, numbered in the same sequence), and after the reply compare the checkout with it: status, diff and hashes. End `blocked`, naming any change.

## Failure rules

- A shell quoting failure is fixed by writing the text to a file in the record and passing its absolute path.
- A check that failed at baseline is not the loop's to fix. Match it by test names, not counts, and report it with the evidence.
- Every shell argument that names a record file is its absolute path under the session's original checkout.
- A sha before `:<path>` is written literally or as `${sha}:<path>`, never `$sha:<path>`: some shells read `:t` or `:l` after a variable as a modifier and alter the path without an error.

## Configuration

`.reimagine.json` at the primary repository's root. Every key is optional; the values shown are the defaults, except `checks`, which is an example.

```json
{
  "commit": false,
  "checks": ["npm test", "npm run lint"],
  "timeouts": { "subagent": 20, "review": 30, "check": 15, "ci": 45, "run": 240 },
  "models": { "implementer": "sonnet", "reviewer": "fable", "fallback-reviewer": "opus", "reader": "haiku" }
}
```

- `commit`: with `true`, the run commits a snapshot of the plan and report as `record.md`, Commit snapshot, says.
- `checks`: the commands Step 6 runs. With no `checks` key, Step 6.1 discovery applies.
- `timeouts`: per-call budgets in minutes (`subagent`, `review`, `check`, `ci`) and the run budget (`run`).
- `models`: the subagent model for each role, one of `sonnet`, `opus`, `haiku`, `fable`.

Unknown keys and bad values are reported and ignored. A file that does not parse ends preflight `blocked`.

## Record

The record lives at `.reimagine/loop/<branch-slug>/` in the primary repository's original checkout, keyed by branch so a second invocation finds it. `steps.json` is the only record of completion. `record.md` holds the layout, the files and the rules; read it at Step 0.5.

1. `<branch-slug>` is the branch name lowercased, with each run of characters outside `[a-z0-9]` replaced by `-`, cut to at most 60 characters, then trailing `-` removed. For `feat/68-4567-export` it is `feat-68-4567-export`.
2. The branch is known at preflight. It is the continued branch; else the "on branch" name; else the branch of the one existing record that holds one of the request's tickets, which Step 0.2 finds by ticket id, so adding or reordering tickets keeps the branch; else the predicted name: `fix/<ids>-<slug>` when any ticket is labeled bug or titled "fix" (any case), else `feat/<ids>-<slug>` when there is a ticket, else `work/<slug>`. `<ids>` are the ticket numbers joined with `-`. `<slug>` comes from the first ticket's title, else the redacted description, else the file name, made mechanically so every run predicts the same name: lowercase it, replace each run of characters outside `[a-z0-9]` with `-`, drop `-` at both ends, keep the first 40 characters even when that cuts a word, then drop a trailing `-`. For the title "count() should accept an optional predicate" the slug is `count-should-accept-an-optional-predicat`. A predicted name that matches an existing local or remote branch with no record ends preflight `blocked`.

## Final report handling

At every terminal state:

1. When the run has its own commit (Step 7.1), read `handoff.md`, then write `handoff.md` and `audit-manifest.json` in the record first.
2. Read `report.md` and fill the report from `run.md`, never from memory.
3. Before Step 0.5, print the report and write nothing. From Step 0.5 on, write it to the record's `report.md`, rewritten at every terminal state, and print it.
4. With `commit: true` and state `done`, post the report's external form as one pull request comment, as `record.md`, Commit snapshot, says; it is the run's one comment on the pull request. A run on the no-new-work path of published work posts nothing.
5. From Step 0.5 on, close the run's entry in `steps.json` (`ended`, `state`), and give each slice this run built and did not commit its `files` (`record.md`, steps.json, item 3).

## Supporting files

Read each file at its point and not before. A sentence that only says where a later rule lives is not a read, and reading early authorizes nothing.

- `steps/0-preflight.md`: after the reading block.
- `steps/1-plan.md`: at the start of Step 1.
- `steps/4-build.md`: when Step 3 ends with a final plan in a run that is not plan-only. Read it at 3.6 when the plan is to be confirmed, else at 3.7. On an existing record with no new work, read it at the end of Step 0 to run Step 6.
- `steps/7-publish.md`: at the start of Step 7.
- `risk.md`: at Step 1.6, and whenever the floor or the higher-risk rule is judged.
- `record.md`: at Step 0.2 when the run's record directory exists, else at Step 0.5.
- `ci-watch.md`: at Step 7.3.
- `multi-repo.md`: at the start of Step 0 when the request says "also edit", or when Step 1.2 adopts a repository.
- `worktree.md`: when the exception of Step 0.3 applies, before the worktree is created.
- `pr-body.md`: when Step 7 writes a pull request body, a continued pull request comment or a ticket comment, or, on `other`, at the end of Step 6.
- `report.md`: at every terminal state.
- `handoff.md`: in Final report handling, when the run has its own commit.
