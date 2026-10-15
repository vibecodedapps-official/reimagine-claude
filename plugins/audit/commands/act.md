---
description: "Act on items of a finished audit report that the user names by id, such as C1 and C4: after approval and checks, the skill makes local commits for those fixes, one per item with --per-item. A new audit starts with /audit:run, which also answers to the prose request \"reimagine audit ...\"."
argument-hint: '<run-id> <item-id...> [--per-item]'
allowed-tools: Read, Skill
---

You forward this request to the audit skill. Take the steps below in order, and write no file in any of them.

1. Read the words between the markers below. They are what the user typed after the command.

<user-text>
"$ARGUMENTS"
</user-text>

   - Split the words into tokens at spaces.
   - A flag is a token that starts with `--`. The one flag is `--per-item`, which takes no
     value. Without it, per-item is `false`. Reject any other flag.
   - The first other token is the run id, made only of letters, digits, `.`, `_` and `-`.
     Reject any other character.
   - Every later token is an item id, `C` and a whole number from 1 up, such as `C3`, or a
     comma list of item ids with no spaces, such as `C1,C4`. An id given twice is kept once,
     at its first place. Reject any other token.
   - There must be a run id and at least one item id.

2. Validate cheaply. Read `${CLAUDE_PLUGIN_DATA}/runs.json` with the Read tool. It exists,
   parses as JSON and holds an entry whose `run_id` is the run id.

   When a rule of step 1 or step 2 fails, reject with one short line `audit: <reason>` that
   names the token, such as `audit: not an item id: X4`, `audit: no item ids given` or
   `audit: run <run-id> not found in runs.json`. Then run nothing else and do not load the
   skill. Check nothing more here: the skill checks the report, its revision, the item ids and
   each repository's checkout.

3. Build the block below, with the item ids in the order typed. Every key not named in this
   step keeps the value shown.

```
command: act
request: none
manifest: none
inputs: none
run-id: <id>
items: <id>[, <id>...]
per-item: true | false
from: none
live: none
out: none
verdicts: none
memory: none
```

   Show the user a short summary in plain words, not the block: the run id, the item ids, and
   one commit per item when `--per-item` is given.

4. Invoke the Skill tool with skill `audit:audit` and that block as the args, then follow the
   skill. Approval, checks and commits happen in the skill, and only for the items listed; do
   not act on any item yourself.
