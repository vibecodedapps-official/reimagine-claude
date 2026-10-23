# rules

House rules for Claude Code sessions: one block in your `CLAUDE.md`, kept current by a script, plus the Concise Plain output style.

## What it installs

- The house rules block, in `$CLAUDE_CONFIG_DIR/CLAUDE.md` when that variable is set, else `~/.claude/CLAUDE.md`. Nothing is written until you answer yes to a diff.
- The output style `rules:Concise Plain`.
- A chat block, in `chat/instructions.md` inside the plugin. It is for pasting into a chat product's custom instructions. Nothing installs it.

The plugin never edits `settings.json`.

## Requirements

Node 22 or later.

## Install

```
/plugin marketplace add vibecodedapps-official/reimagine-engine
/plugin install rules@reimagine-engine
```

## Use

Run `/rules` (also reachable as `/rules:rules`). It shows the change as a diff and asks before it writes. Once per change.

- `/rules`: add the block, or update it when the plugin's rules are newer.
- `/rules --remove`: take the block out.
- `/rules --decline`: keep the file as it is, and stop the startup notice for the current text.
- `/rules --adopt`: move rules you already have in the file into the block, so they are not duplicated.
- `/rules --options core,windows`: pick which parts go in the block. `core` is always included. `windows` is offered only on Windows.
- `/rules --adopt --options core`: both at once, in either order.

Any other argument is refused, and nothing runs.

## What the block looks like

The block sits between two marker lines:

```
<!-- reimagine:house-rules begin version=<v> options=<list> join=<none|blank|newline> digest=<16 hex> -->
...the rules...
<!-- reimagine:house-rules end -->
```

Put your own lines outside the block, above the begin marker or below the end marker. If you edit inside the block, `/rules` sees it, shows you the difference, and leaves the block alone until you move your lines out.

## Backups

Before it changes an existing file, the script copies it to `<path>.reimagine-backup-<YYYYMMDDHHMMSS>`.

## Startup notice

When the block in your file is older than the plugin's, a session start prints one line:

```
rules: the house rules in <path> are older than this plugin's; run /rules to update them
```

Run `/rules` to update, or `/rules --decline` to silence it for that text.

## Output style

`/rules` ends by printing how to select the style. Run:

```
/output-style rules:Concise Plain
```

Or run `/config` and choose Output style.

## Uninstall

1. Run `/rules --remove` to take the block out. It gives back the original bytes of the file. A file the plugin created is deleted, unless you added text to it.
2. Run `/plugin uninstall rules@reimagine-engine`.

## License

Apache-2.0. See `LICENSE`.
