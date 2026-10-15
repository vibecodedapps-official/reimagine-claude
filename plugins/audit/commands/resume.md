---
description: "Resume an audit run by its id, from the first stage that is incomplete or whose inputs changed, or from a named stage, optionally with a file of approved live check results. A new audit starts with /audit:run, which also answers to the prose request \"reimagine audit ...\"."
argument-hint: '<run-id> [--from <stage>] [--live <file>]'
allowed-tools: Read, Skill
---

You forward this request to the audit skill. Take the steps below in order, and write no file in any of them.

1. Read the words between the markers below. They are what the user typed after the command.

<user-text>
"$ARGUMENTS"
</user-text>

   - Split the words into tokens at spaces. Quoted text stays one token.
   - A flag is a token that starts with `--`. The flags are `--from` and `--live`, each at most
     once, each with one value: the next token, which does not start with `--`. Reject any other
     flag, a repeated flag and a missing value.
   - `--from` is a stage number, a whole number from 1 to 8. Without it, from is `none`.
   - `--live` is the path of an existing file of approved live check results. Without it, live
     is `none`. A live file answers the findings of a finished report, so `--live` together
     with a `--from` of 1 to 5 is rejected.
   - Exactly one other token is given, the run id, made only of letters, digits, `.`, `_` and
     `-`. Reject a missing run id, a second one and any other character.

2. Validate cheaply.
   - Read `${CLAUDE_PLUGIN_DATA}/runs.json` with the Read tool. It exists, parses as JSON and
     holds an entry whose `run_id` is the run id.
   - With `--live`, the file exists. Check it with the Read tool and leave its content to the
     skill.

   When a rule of step 1 or step 2 fails, reject with one short line `audit: <reason>` that
   names the token, such as `audit: --from must be 1 to 8, got 9`,
   `audit: --live cannot be used with --from 1 to 5` or
   `audit: run <run-id> not found in runs.json`. Then run nothing else and do not load the
   skill. Check nothing more here: the skill checks the run directory, its stages, the bundle
   heads and the live file against the report.

3. Build the block below. Every key not named in this step keeps the value shown.

```
command: resume
request: none
manifest: none
inputs: none
run-id: <id>
items: none
per-item: false
from: none | <stage>
live: none | <file>
out: none
verdicts: none
memory: none
```

   Show the user a short summary in plain words, not the block: the run id, and the stage or
   the live file when given.

4. Invoke the Skill tool with skill `audit:audit` and that block as the args, then follow the
   skill. Do not decide which stages rerun, or act on the run yourself.
