---
description: "Start a read-only, adversarial audit of a finished bundle of pull requests and tickets, from a manifest file or inputs given in words, ending in a report. /audit:run also answers to the prose request \"reimagine audit ...\"."
argument-hint: '[<manifest.json>] [<inputs...>] [<prose>]'
allowed-tools: Bash(git -C * rev-parse *), Read, Skill
---

You forward this request to the audit skill. Take the steps below in order, and write no file in any of them.

1. Read the words between the markers below. They are what the user typed after the command.

<user-text>
"$ARGUMENTS"
</user-text>

   - Split the words into tokens at spaces. Quoted text stays one token.
   - This command takes no flags. When any token starts with `--`, reject with
     `audit: no flags; say it in words (effort high, budget 30 minutes, adversary on fable)`.
   - The manifest is the first token that ends in `.json` and has no scheme prefix. A scheme
     prefix is a name of two or more characters and a `:` at the start of the token, such as
     `file:` or `github:`. A single letter followed by `:/` or `:\`, such as `C:/`, is a drive
     letter, so that token is a path. With no such token, the manifest is `none`.
   - Every other token is an input or prose, kept verbatim in the order typed, such as a pull
     request number or URL, `in <path>`, ticket ids, `file:<path>` exports, or the words for
     tier, budget and model overrides. The skill tells inputs from prose.
   - There must be a manifest or at least one other token.

2. Validate cheaply. Relative paths in the request are relative to the session's directory;
   relative paths inside the manifest are relative to the manifest's directory.
   - The manifest, when given, exists and parses as a JSON object. Check it with the Read tool.
   - Every repository path the manifest names, in `bundles[].repo`, `references[].path`,
     `sources_of_truth[].path` and `groups[].repo`, passes `git -C <path> rev-parse --git-dir`.
   - Every `file:<path>` input names an existing file. Check it with the Read tool.

   When a rule of step 1 or step 2 fails, reject with one short line `audit: <reason>` that
   names the token or path, such as `audit: not a git repository: <path>`. Then run nothing
   else and do not load the skill. The skill validates the manifest in full.

3. Build the block below. `request` holds the words as typed, on one line. List every token
   but the manifest as `- <token>`, or write `inputs: none`. Every other key keeps the value shown.

```
command: run
request: <the words as typed, on one line>
manifest: <path> | none
inputs:
- <token>
run-id: none
items: none
per-item: false
from: none
live: none
out: none
verdicts: none
memory: none
```

   Show the user a short summary in plain words, not the block: the manifest and the inputs.
   Then add one plain sentence: a background fetch, such as VS Code's `git.autofetch`, moves
   remote refs and can stop the audit, so pause it while the audit runs.

4. Invoke the Skill tool with skill `audit:audit` and that block as the args, then follow the
   skill. Do not read the request into bundles, plan the audit or act on it yourself.
