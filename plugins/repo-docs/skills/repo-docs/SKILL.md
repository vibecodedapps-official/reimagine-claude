---
name: repo-docs
description: 'Keep the instruction files of a repository in hub and spoke form: write a CLAUDE.md hub from the repository, adopt existing instruction and documentation files into one, or check the hub and its spokes for drift and fix it. Use when the user runs /repo-docs, or asks to set up, organize, split, tidy or check the CLAUDE.md, AGENTS.md or agent docs of a repository.'
argument-hint: "[bootstrap | adopt | maintain]"
allowed-tools:
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git show *)
  - Bash(git rev-parse *)
  - Bash(git ls-files *)
  - Bash(git check-ignore *)
  - Bash(git grep *)
---

# /repo-docs

Keep the repository's instruction files in hub and spoke form, in one of three modes: `bootstrap`, `adopt` or `maintain`. Before planning any change, read `spokes.md` and `placement.md` in this skill's directory.

## Every mode

- State the mode before any write. The first line of your first reply is `repo-docs: mode <bootstrap|adopt|maintain> (<one-line reason>)`.
- Touch documentation files only: `CLAUDE.md` and `AGENTS.md` at any depth, `README.md`, files under `docs/`, and other Markdown files that hold documentation or instructions. Never edit code, configuration, CI files, package manifests, settings files, or anything under `.git/`. Never edit `CLAUDE.local.md` or anything under `.claude/`: those are the user's own.
- `README.md` is for people: agent content never goes in it, and user content never goes in the hub. When a README is long, it is split into `docs/` pages.
- Never install a git hook and never write a linter rule or check. When placement puts a rule in a check, propose it in the plan for the user.
- Never reword a dated or historical entry; append a correction as a new dated entry. Never delete a real constraint to get under a cap; split the file instead.
- Obey every ask-first rule in the instruction files the session loaded. The one question of adopt and maintain lists every commit it will make, so one yes covers those commits; anything outside the plan asks again.
- Commits follow the repository's own commit convention when its instruction files name one; otherwise `docs(repo): <subject>` in lowercase. The body says why, and its first line is `Instruction-file <mode> pass, <YYYY-MM-DD>.` A commit message never names a model, an agent or a tool. Stage only the paths the plan names, by path. Never push, amend, or pass `--no-verify`.
- Find files with `git ls-files`, `git ls-files --others --exclude-standard` (untracked, not ignored) and `git ls-files --others --ignored --exclude-standard` (ignored). An instruction file git ignores is the user's own: it is listed, reported, and never edited, moved or written over.

## Choose the mode

- The mode is chosen from the files on disk, ignored ones included. When the root `CLAUDE.md` or `AGENTS.md` is ignored by git, say so and stop with nothing written.
- When the request names `bootstrap`, `adopt` or `maintain`, use it. Bootstrap never writes over an existing `CLAUDE.md` or `AGENTS.md`, whether named or chosen: say so and stop.
- Otherwise: a hub exists (the root `CLAUDE.md` holds a line exactly `## Spokes`, or it is the adapter line `@AGENTS.md` and the root `AGENTS.md` holds that line): `maintain`. Else, any `CLAUDE.md` or `AGENTS.md` exists at any depth: `adopt`. Else: `bootstrap`.

## Bootstrap

1. State the mode.
2. Read the repository: `README.md`, package manifests and build files (their scripts and targets), CI workflows, the test layout, the top-level directories, and the list of files under `docs/`.
3. Write the root `CLAUDE.md` in the hub form of `spokes.md`: the name and two or three sentences on what the repository is; under `## Commands` only commands that exist in a manifest, build file or CI workflow; under `## Constraints` only rules the repository states or enforces, never invented ones; under `## Spokes` a pointer for each existing file under `docs/` that an agent needs for some task and that has at most 200 lines, with a condition saying when. A needed file over 200 lines gets no pointer, since the hook denies every commit while a spoke is over its cap: name it in plain text in the opening sentences with when to read it, and say in the reply that it is over the cap. With no such file, keep the `## Spokes` line with nothing under it.
4. Check the hub before you finish: at most 60 lines, every pointer in the pointer form, every path it names exists, every file it points to at most 200 lines.
5. Write nothing else. Leave `CLAUDE.md` uncommitted, show it, and say it is ready for the user to review and commit.

## Adopt

1. State the mode.
2. Inventory every instruction and documentation file: every `CLAUDE.md` and `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, every file under `docs/`, other Markdown files that document or instruct, and other tools' instruction files (such as `.github/copilot-instructions.md` or `.cursorrules`), which are listed and left alone. For each, record: path; line count; tracked or untracked; the scopes it holds (which tasks each section governs, by `placement.md`); each `@path` import it holds and whether git tracks the target (`git ls-files --error-unmatch <path>`); what depends on it; whether an agent needs it for some task.
3. What depends on a file: an `@` import of it; a reference to it from a file that is not documentation (code, configuration, CI, a package manifest), found with `git grep -n -F <file name>`; or a fixed name other tools read (`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`, anything under `.github/`). A link from a documentation file does not pin a file: it is repaired in the commit that moves the file, in the same change as the move. Never move a file something depends on; extract content from it instead.
4. Decide. Refactor a file only when it is over its cap (the root `CLAUDE.md` is the hub, cap 60; any other instruction file is a spoke, cap 200), holds content for two scopes, or duplicates another file or a section of one. Leave every other file as it is and point to it from the hub when an agent needs it. In every case:
   - The root `CLAUDE.md` becomes the hub, in the four parts of `spokes.md`; what does not fit goes to spokes by `placement.md`.
   - Agent rules in `README.md` move to the hub or a spoke; the README keeps what a person needs.
   - Every `@path` import except an adapter line becomes a pointer, or is inlined when it is short and every task needs it. An import of an untracked file is reported and left in place.
   - With a root `AGENTS.md`, apply the adapter convention of `spokes.md`. Without one, a nested `AGENTS.md` stays in place and the hub points to it.
   - Dated entries move only verbatim.
   - Check every statement you keep or write against the code it describes, as maintain does: a command does what its line says, and a rule names files and behavior that exist. Correct a statement the code makes untrue in the rewrite that carries it, and list it under `Rewrites`.
5. Print the plan, in this form, leaving out empty sections:
```
repo-docs: mode adopt (<reason>)

Inventory
- <path>: <n> lines, <tracked|untracked>; scopes: <list>; imports: <list or none>; depended on by: <list or none>

Moves
- <from> -> <to>; links repaired in: <files or none>

Rewrites
- <path>: <what changes>, because <over cap | two scopes | duplicate | import | README agent rules | hub form>
- <new path>: new spoke holding <what>, from <source>

Reported, left as is
- <item>: <why>

Commits
1. docs(repo): <subject>
2. docs(repo): <subject>

Apply this plan? (yes/no)
```
6. Ask once and stop until the user answers. Anything but yes ends the run with nothing written.
7. Apply in the order of the plan's commits. The first commit, when there are moves, holds only the `git mv` of each moved file and the path edits of the links to it, so no commit leaves a broken link. Every other change goes in later commits, never in the move commit. The hub's rewrite comes last, so every path it names exists when it is committed. Before each commit, check what the drift hook checks (caps, pointer form, every named path exists); the hook blocks the commit otherwise.
8. Report: each commit's short hash and subject, the items reported and left as is, and that the working tree holds no change from the plan.

A second run after adopt finds the hub and reads as maintain. Adopt's result must pass every maintain check, so that run changes nothing.

## Maintain

1. State the mode.
2. Check, from the hub through every spoke it indexes (and the spokes they index):
   - what the drift hook checks: every named path exists, every index line is a pointer, the hub is at most 60 lines and every spoke at most 200;
   - the hub holds its four parts and nothing else;
   - every command under `## Commands` still exists in its manifest, build file or CI workflow;
   - every path, prefix and directory a pointer or spoke names still exists;
   - each spoke still matches the code it governs: read the files its prefixes or directory cover and look for statements the code makes untrue;
   - instruction and documentation files an agent needs that nothing points to, new `@path` imports, agent rules in `README.md`, duplicates;
   - every `@path` line in the hub and in each spoke (an untracked import is reported), and every nested `AGENTS.md` when no root `AGENTS.md` sits beside the hub (reported as left in place).

   Items adopt reported and left as is (an untracked import, a nested `AGENTS.md` it points to) are reported again, never changed.
3. With nothing to fix, print `repo-docs: no drift`, then one line per reported item in the form `- <item>: <why>`, and write nothing.
4. Otherwise print the plan in the adopt form, with a `Findings` section in place of `Inventory`, ask once, and apply it as adopt does.

## Supporting files

- `spokes.md`: the hub, spokes, the pointer form, caps and splitting, the adapter convention, imports, and what the drift hook checks.
- `placement.md`: where each piece of information goes.
