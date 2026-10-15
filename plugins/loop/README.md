# loop

Plan, build, review and publish a bundle of tickets as one reviewed pull request per repository. The loop reads your tickets, writes a plan and has it reviewed, has subagents build each slice, reviews the work, runs the checks, and opens the pull request. It keeps a record keyed by branch, so running it again on the same tickets or the same branch continues where it stopped instead of starting over.

## Install

```
/plugin marketplace add vibecodedapps-official/reimagine-claude
/plugin install loop@reimagine-claude
```

## Use

Say it in plain words:

- `reimagine loop #12 and #15`
- `run the loop on AB#4567, plan only`
- `/loop:run` followed by the same words

The bare `/loop` is Claude Code's own interval skill, so it does not start this one. That is expected. There are no flags; a word starting with `--` is read as prose.

Phrases the loop recognizes:

- `plan only`: write and review the plan, change nothing, stop.
- `do not publish`: build and check, then print the commands that push and open the pull request.
- `confirm the plan`: pause once after the plan review and wait for a clear yes.
- `continue <branch>`: resume that branch and its record.
- `on branch <name>`: use that branch name.
- `also edit <path>` and `also edit <path> on <branch>`: add a second checkout the run may change, with its own pull request.
- `budget <n> minutes`: set the run budget.
- Effort words: `quick` or `low`, `medium`, `thorough` or `high`, `very thorough` or `xhigh`, `max`. They set how hard the reviewers work. Work that touches auth, permissions, schemas, row-level security, data access or a public API is always reviewed at `high` or above.

Ticket forms:

- `#123`, or a GitHub issue or pull request URL.
- `AB#12345`, or a bare number when the repository's remote is Azure DevOps.
- A Salesforce case number or record id, when a Salesforce MCP tool is available.
- A path to a file.
- Pasted text, which is taken as a description of the work.

A reference to an open pull request in the repository continues that pull request's branch.

## What invoking approves

Invoking the loop by name approves, for that run only: creating a branch, committing, pushing that branch, opening one pull request per repository, editing the body of a pull request the loop opened, one comment per run on it, and comments on the source tickets. Your instruction files win: an ask-first rule there still prompts.

These always ask: a force push, `--no-verify`, a merge, anything that deploys, a change to repository settings, and a new issue. A permission you deny is final; the loop does not retry it or work around it.

## The record

Each run keeps its files in `.reimagine/loop/<branch-slug>/` in your checkout: the inputs as fetched, the plan, a log, a completion record, and the report. The directory is excluded through `.git/info/exclude`, never `.gitignore`, and is never committed. Run the loop again on that branch and it reads the record and continues.

## Configuration

An optional `.reimagine.json` at the repository root. Every key is optional; the values shown are the defaults, except `checks`, which is an example.

```json
{
  "commit": false,
  "checks": ["npm test", "npm run lint"],
  "timeouts": { "subagent": 20, "review": 30, "check": 15, "ci": 45, "run": 240 },
  "models": { "implementer": "sonnet", "reviewer": "fable", "fallback-reviewer": "opus", "reader": "haiku" }
}
```

- `commit`: with `true`, the run commits a snapshot of the plan and report to the branch and posts the report as a pull request comment.
- `checks`: the commands to run as checks. Without it the loop finds the repository's test, lint, typecheck and build commands.
- `timeouts`: minutes for each implementer call (`subagent`), each review pass (`review`), each check (`check`) and the CI wait (`ci`), and the whole run (`run`).
- `models`: the model for each role. Values are `sonnet`, `opus`, `haiku` or `fable`. This never changes the risk floor.

Unknown keys and bad values are reported and ignored. A file that does not parse stops the run before it starts.

## How a run ends

- `done`: the pull request is open, CI is green or not applicable, and the report is written.
- `plan-only`: the plan was reviewed and nothing changed.
- `prepared`: everything through the checks is done and nothing was pushed; the report has the exact commands.
- `blocked`: a blocking defect, a denied permission, a budget exceeded or a preflight failure. Nothing more is published; pushed work stays.
- `stopped`: a question the run could not settle, before any branch was created.

## Prerequisites

- `git`, and on Windows, Git for Windows.
- `gh`, signed in, for GitHub repositories.
- `az`, or an Azure DevOps MCP tool, to read Azure DevOps work items.
- Node is not needed by the loop itself.

On a host other than GitHub the loop runs every step through the checks and ends `prepared`, with the push commands in the report.

## Uninstall

Run `/plugin uninstall loop@reimagine-claude`. The `.reimagine/` directories in your repositories stay; delete them if you want them gone.

## License

Apache-2.0. See `LICENSE`.
