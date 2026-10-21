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

A rule or a nested `CLAUDE.md` takes the skill form with its own first line, `<n>. Rule .claude/rules/<topic>.md` or `<n>. Nested <dir>/CLAUDE.md`; its `Seen:` line holds the convention or the commands as found, and its `Writes:` line names the file.

## Init

1. State the mode.
2. Read `README.md`, package manifests and build files (their scripts and targets), CI workflows, the test layout, the top-level directories, `CONTRIBUTING.md`, and the files under `docs/` with their line counts.
3. Write the root `CLAUDE.md` in the hub shape of `shapes.md`, at most 60 lines: the marker; the repository name and two or three sentences drawn from `README.md` and the manifests; a reading sentence only for a long `docs/` file that a kind of work needs; under `## Commands`, only commands a manifest, build file, script or workflow holds, each with what it checks; under `## Constraints`, only constraints the repository states or enforces, such as a CI check or a rule in `CONTRIBUTING.md`. Leave it uncommitted and unstaged.
4. Check the hub before replying: line 1 is exactly `<!-- primer -->`, it has at most 60 lines and the three parts and nothing else, and every backticked path in its opening paragraph exists spelled exactly. Fix any miss.
5. Propose what the repository shows, each placed by `placement.md` and shown in the form of Proposals: a skill for a numbered procedure in `CONTRIBUTING.md` or a runbook under `docs/`, and for a script or build target whose use takes more than one command or a setup step; a nested `CLAUDE.md` for a directory with its own build; a path-scoped rule for a convention of one area. Ask once which to write, by number. Write none without a yes; on a yes, write the ones named, uncommitted. When the repository shows none, say so in one line.
6. End the reply with the hub's path, its line count, that it is uncommitted, and this sentence: `/init` is the host's unopinionated alternative: it writes a `CLAUDE.md` from its own reading of the repository, without the marker or these shapes.

## Adopt

Inventories every instruction and documentation file, plans the moves and rewrites, asks once, and commits moves before rewrites. This prerelease does not run it yet. After the mode line, reply with exactly this one line and stop, reading and writing nothing more:

`primer: adopt is not in this prerelease; nothing was written.`

## Maintain

Runs three passes, verify, promote and propose, that feed one plan and one question. With nothing to change it prints `primer: no drift`. This prerelease does not run it yet. After the mode line, reply with exactly this one line and stop, reading and writing nothing more:

`primer: maintain is not in this prerelease; nothing was written.`
