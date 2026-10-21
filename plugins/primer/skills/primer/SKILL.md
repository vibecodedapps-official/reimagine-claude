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

- The first line of the reply, before any read beyond what choosing needs and before any write, is exactly `primer: mode <init|adopt|maintain> (<one-line reason>)`, with no text before it.
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
- A commit follows the repository's own commit convention when its instruction files name one, else `docs(primer): <subject>` in lowercase. The body's first line is `Instruction-file <mode> pass, <YYYY-MM-DD>.`, followed by why. A commit message never names a model, an agent or a tool, and carries no `Co-Authored-By` or other trailer that does.
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

1. State the mode.
2. Inventory every instruction and documentation file, tracked, untracked and ignored: `CLAUDE.md`, `AGENTS.md` and `CLAUDE.local.md` at any depth, `.claude/CLAUDE.md`, `.claude/rules/**`, `.claude/skills/**`, `README.md`, `CONTRIBUTING.md` and Markdown under `docs/`, with each file's line count and every `@path` import and what it names. List other tools' rule files, such as `.cursor/rules/` or `.github/copilot-instructions.md`, and leave them alone.
3. Refactor a file only when it is over its cap, holds content for two scopes, or duplicates another. Every other file stays as it is.
4. Never move a pinned file: one an `@` import names, one a file that is not documentation references (code, configuration, CI, a package manifest), or one with a name other tools read (`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`, anything under `.github/`). A link from a documentation file does not pin.
5. Place each piece by `placement.md` into the shapes of `shapes.md`:
   - In a `## Spokes` index, a pointer whose condition is a file pattern becomes a path-scoped rule with that pattern in `paths`; one whose condition is a task becomes a skill; one whose condition is a directory becomes a nested `CLAUDE.md` in it. The index goes, which converts the repository in one run.
   - A procedure in an instruction file becomes a skill and leaves that file. A procedure in `CONTRIBUTING.md` is proposed as a skill, and `CONTRIBUTING.md` stays as it is.
   - A topic section every task needs becomes an unscoped rule; a long document stays under `docs/` with one sentence in the hub's opening paragraph; agent content in `README.md` moves out; `.claude/CLAUDE.md` merges into the hub.
   - An import of a file git does not track, or outside the repository, is reported and left in place. When a root `CLAUDE.local.md` sits beside a root `AGENTS.md` hub, propose the one-line `CLAUDE.md` of `shapes.md`.
6. Check every statement kept or written against the code it describes: each command exists and does what its line says, each path exists, each rule names files and behavior that exist. Correct an untrue statement in the rewrite that holds it.
7. Print the plan in this form, then ask once:

```
primer: adopt plan
Moves (commit 1: <message>):
- git mv <from> <to>; links repaired in <files>
Rewrites (commit <n>: <message>):
- <file>: <what changes, and why>
Proposals:
<n>. <the proposal forms above>
Reported:
- <item>: <why>
```

8. On the yes, make the move commit first: the `git mv` of each move and the path edits of documentation links to the moved files, index lines included, and nothing else, so no commit leaves a broken link. Then make each rewrite commit; the last one writes the hub with its marker, so the drift hook checks the finished set. Write a proposal only on its own yes.
9. End with the commits made and the reported items. A second run reads as `maintain`.

## Maintain

1. State the mode.
2. Verify the instruction files, which are the hub, nested `CLAUDE.md` files, rules and skills, noting each finding with its file and line:
   - what the drift hook denies: a file over its cap, a missing path in the hub's opening paragraph, a `paths` value the host cannot read or a glob that matches no tracked file, a `SKILL.md` without `description`;
   - each command the hub or a nested `CLAUDE.md` names exists in a manifest, script or workflow and does what its line says;
   - each statement of the hub, a rule, a nested file or a skill is true of the files it covers: the names, paths and behavior it states exist;
   - each command and file a skill step names exists;
   - a skill whose procedure the repository no longer has is reported, never deleted; two skills with one procedure are reported as duplicates with the one to keep; a skill over its cap is split into a body and a supporting file beside it;
   - an import of a file git does not track, other tools' rule files and personal content are reported, as adopt reports them;
   - a statement in `README.md`, `CONTRIBUTING.md` or a `docs/` page that the code makes untrue is reported, never rewritten by this pass.
3. The promote and propose passes are not in this prerelease; skip them.
4. With a change to make, print the plan in the form of Adopt step 7 with `primer: maintain plan` as its first line, ask once, and on the yes make its commits; a fix is a rewrite, and a split adds a move only when a file moves.
5. With nothing to change, print `primer: no drift`, then one line per reported item as `- <item>: <why>`, and write nothing.
6. End the reply with this sentence: `/doctor prompt-audit` checks the instruction files for contradictions and stale model names; run it yourself when you want that check.
