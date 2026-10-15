---
description: "Write a typed handoff from a build session, for an audit to read as claims, optionally applying a claims verdicts file and listing memory files to reconcile. A new audit starts with /audit:run, which also answers to the prose request \"reimagine audit ...\"."
argument-hint: '[--out <path>] [--verdicts <claims-verdicts.md>] [--memory <dir>]'
allowed-tools: Read, Skill
---

You forward this request to the audit skill. Take the steps below in order, and write no file in any of them; the skill writes the handoff.

1. Read the words between the markers below. They are what the user typed after the command.

<user-text>
"$ARGUMENTS"
</user-text>

   - Split the words into tokens at spaces. Quoted text stays one token.
   - Every token is a flag or a flag's value. The flags are `--out`, `--verdicts` and
     `--memory`, each at most once, each with one value: the next token, which does not start
     with `--`. Reject any other flag or token, a repeated flag and a missing value.
   - `--out` is the path the handoff is written to. Without it, out is `none`, and the skill
     picks the path.
   - `--verdicts` is the path of a claims verdicts file. Without it, verdicts is `none`.
   - `--memory` is the directory of the build session's memory files. It needs `--verdicts`:
     without that flag, reject with `audit: --memory needs --verdicts`. Without `--memory`,
     memory is `none`.

2. Validate cheaply with the Read tool. Relative paths are relative to the session's directory.
   - The `--out` path does not exist yet, as a file or a directory, so no handoff is ever
     overwritten.
   - The `--verdicts` file exists.
   - The `--memory` path exists and is a directory.

   When a rule of step 1 or step 2 fails, reject with one short line `audit: <reason>` that
   names the token or path, such as `audit: --out already exists: <path>` or
   `audit: --verdicts file not found: <path>`. Then run nothing else and do not load the skill.
   Check nothing more here: the skill checks where the handoff may go and what the verdicts say.

3. Build the block below. Every key not named in this step keeps the value shown.

```
command: handoff
request: none
manifest: none
inputs: none
run-id: none
items: none
per-item: false
from: none
live: none
out: none | <path>
verdicts: none | <file>
memory: none | <dir>
```

   Show the user a short summary in plain words, not the block: the output path, the verdicts
   file and the memory directory, each only when given.

4. Invoke the Skill tool with skill `audit:audit` and that block as the args, then follow the
   skill. Do not gather the record or write the handoff before the skill says how.
