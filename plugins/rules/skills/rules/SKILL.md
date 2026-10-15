---
name: rules
description: Adds, updates, adopts, declines or removes the house rules block in the user's CLAUDE.md, and shows each change before it is made.
argument-hint: "[--remove | --decline | --adopt | --options core,windows]"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" *)
---

# /rules

Manage the house rules block in the user's `CLAUDE.md`. Only the script writes. You never edit `CLAUDE.md` or any settings file yourself, and you never use the Edit or Write tool on them. You run the script, show its output, and ask before each change.

The arguments:

<arguments>
$ARGUMENTS
</arguments>

## Accepted arguments

- Empty.
- `--remove`
- `--decline`
- `--adopt`
- `--options <list>`, where the list is comma-separated `core` and `windows`.
- `--adopt` together with `--options <list>`, in either order.

Anything else: tell the user these are the accepted forms, and stop. Do not run anything.

Put no text from the user into a command except the options list, written with no spaces.

## Step 1: status

Run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" status "${CLAUDE_PLUGIN_DATA}"
```

Use the output only to tell the user the state in one line.

## Step 2: report

Run exactly one command, chosen by the arguments:

- `--remove`:
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" remove "${CLAUDE_PLUGIN_DATA}"`
- Empty or `--decline`:
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" plan "${CLAUDE_PLUGIN_DATA}"`
- `--adopt`, with `--options <list>` added when given:
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" plan "${CLAUDE_PLUGIN_DATA}" --adopt`
- `--options <list>` alone:
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" plan "${CLAUDE_PLUGIN_DATA}" --options <list>`

Show the output verbatim in a fenced code block.

If a command prints a line that starts with `rules:` and exits with an error, show it verbatim, do not retry, and go to step 4.

## Step 3: ask, then act

- If the output says `change: none`, say nothing will change, and go to step 4.
- If the argument is `--decline` and the output says `change: ready`, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" decline "${CLAUDE_PLUGIN_DATA}"` without asking. The user already said so. Show the output verbatim, and go to step 4.
- Otherwise ask the user once whether to make this change. Recommend what the `recommend:` line says.
  - `apply`: ask apply or decline.
  - `decline`: ask apply or decline.
  - `adopt`: offer three choices: adopt (recommended), apply anyway, or decline.
- On apply, or on apply anyway, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" apply "${CLAUDE_PLUGIN_DATA}"`.
- On decline, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" decline "${CLAUDE_PLUGIN_DATA}"`.
- On adopt, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs" plan "${CLAUDE_PLUGIN_DATA}" --adopt`, adding `--options <list>` only when the arguments gave `--options <list>`, with the user's list written with no spaces. Show that output verbatim in a fenced code block. If it says `change: ready`, this is a different change, so ask once more, apply or decline, and run `apply` or `decline` as above. If it says `change: none`, say nothing will change.

Show the output of each `apply` and `decline` verbatim in a fenced code block.

## Step 4: always last

Print how to select the output style:

```
/output-style rules:Concise Plain
```

Or run `/config` and choose Output style.

Say that the chat block for chat products is in `${CLAUDE_PLUGIN_ROOT}/chat/instructions.md`. It is for pasting into a chat product's custom instructions. Nothing installs it.
