---
name: primer
description: 'Use when the user says "turn this into a skill", "we keep doing this", "add this to the project instructions" or "check the instruction files", or runs /primer. Keeps the project instructions of a repository in the forms Claude Code loads: a short CLAUDE.md hub, path-scoped rules, nested CLAUDE.md files and skills.'
argument-hint: "[init | adopt | maintain]"
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git show *)
  - Bash(git rev-parse *)
  - Bash(git ls-files *)
  - Bash(git check-ignore *)
  - Bash(git grep *)
---

# /primer

Keep the repository's project instructions in the forms Claude Code loads, in one of three modes: `init`, `adopt` or `maintain`. Before writing, moving or proposing anything, read `shapes.md` and `placement.md` in this skill's directory.

## Choose the mode

- The first line of the reply, before any read beyond what choosing needs and before any write, is exactly `primer: mode <init|adopt|maintain> (<one-line reason>)`.
- Find files with `git ls-files`, `git ls-files --others --exclude-standard` (untracked, not ignored) and `git ls-files --others --ignored --exclude-standard` (ignored). The mode is chosen from the files on disk, ignored ones included.
- When the root `CLAUDE.md` or root `AGENTS.md` is ignored by git, say so after the mode line and stop with nothing written.
- A mode named after the command (`/primer adopt`) forces it. A forced `init` never writes over an existing `CLAUDE.md` or `AGENTS.md`: say so and stop.
- Otherwise find the hub: the root `CLAUDE.md`; the root `AGENTS.md` when the root `CLAUDE.md` is exactly `@AGENTS.md` plus at most one newline; the root `AGENTS.md` when there is no root `CLAUDE.md`. Then, in order: the hub's line 1 is exactly `<!-- primer -->` and no line of it is exactly `## Spokes`: `maintain`. Else any `CLAUDE.md` or `AGENTS.md` exists at any depth, `.claude/CLAUDE.md` included: `adopt`. Else: `init`.
- When one of the four phrases invoked the skill for one item (a checklist just run, a fact to record, a memory note), the mode line still comes first, its reason names the item, and the reply runs the proposal of that item alone (see Proposals), with no other pass. This prerelease replies with exactly `primer: proposals are not in this prerelease; nothing was written.` and stops.

## Every mode

- Writes are documentation files only: `CLAUDE.md` and `AGENTS.md` at any depth, `.claude/rules/**`, `.claude/skills/**`, `README.md`, and Markdown under `docs/`.
- Never edit code, configuration, settings, CI files, package manifests, `CLAUDE.local.md`, anything git ignores, or the auto memory directory. The one exception is a memory note the user approves for deletion in its own question.
- Never install a git hook and never write a linter rule, a test or a hook. Where placement item 1 or 2 applies, the plan proposes the check for the user.
- Never run `/init`, `/doctor` or `/memory`.
- Read `CLAUDE.local.md`, the user's own `CLAUDE.md` and `rules/`, and auto memory to avoid duplication; never write them.
- Obey every ask-first rule in the instruction files the session loaded. Anything outside the plan asks again.

## Commits

- `init` writes the hub and leaves it uncommitted.
- `adopt`, and `maintain` when it has changes, print a plan that lists every commit, ask once, and make those commits. One yes covers the listed commits. `maintain` with nothing to change writes nothing.
- A commit follows the repository's own commit convention when its instruction files name one, else `docs(primer): <subject>` in lowercase. The body's first line is `Instruction-file <mode> pass, <YYYY-MM-DD>.`, followed by why. A commit message never names a model, an agent or a tool.
- Stage only the paths the plan names, by path. Never push, amend, or pass `--no-verify`.
- The drift hook runs on every commit. When it denies, read its findings, fix the files, and commit again; never route around it. When it advises a recheck, recheck the files it names before the next commit.

## Proposals

A proposal is shown before anything it describes is written, in one shared form for skills and memory notes.

```
<n>. Skill `<name>`
   From: <file and line, script, build target, memory note, or this session>
   Seen: <how often>; steps as observed:
     1. <step>
   Writes: .claude/skills/<name>/SKILL.md
```

```
<n>. Memory note <file> (<type>, modified <date>)
   Text: <the note's text, quoted>
   Writes: <destination file>: <the line to be written>
```

A skill candidate taken from an instruction file says that the procedure leaves that file in the same commit. Nothing in a proposal is written without a yes. After a memory note's line is written, a separate question for that note offers its topic file and its `MEMORY.md` line for deletion; a no leaves both. A `user` note is never proposed.

## Init

Reads `README.md`, manifests and build files, CI workflows, the test layout, the top-level directories and `docs/`, writes the hub uncommitted, proposes the first rules and skills the repository shows, and names `/init` as the host's unopinionated alternative. This prerelease does not run it yet. After the mode line, reply with exactly this one line and stop, reading and writing nothing more:

`primer: init is not in this prerelease; nothing was written.`

## Adopt

Inventories every instruction and documentation file, plans the moves and rewrites, asks once, and commits moves before rewrites. This prerelease does not run it yet. After the mode line, reply with exactly this one line and stop, reading and writing nothing more:

`primer: adopt is not in this prerelease; nothing was written.`

## Maintain

Runs three passes, verify, promote and propose, that feed one plan and one question. With nothing to change it prints `primer: no drift`. This prerelease does not run it yet. After the mode line, reply with exactly this one line and stop, reading and writing nothing more:

`primer: maintain is not in this prerelease; nothing was written.`
