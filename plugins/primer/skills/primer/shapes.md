# Shapes

This file gives the shape of each instruction file primer writes or checks, with its cap. Read it before you write or check any of them.

## Counting and caps

- Hub: 60 lines. Nested `CLAUDE.md`: 60 lines. Rule: 200 lines. `SKILL.md`: 150 lines. `docs/` pages: no cap.
- Count every line the file has, frontmatter and blank lines included. A last line without a newline counts.
- A file over its cap is split by topic into another file of the right shape. Never delete a real constraint to fit.

## Hub

The hub is the root `CLAUDE.md`, or the root `AGENTS.md` under the AGENTS.md section. It has these parts and nothing else:

```
<!-- primer -->
# <repository name>

<Two or three sentences on what the repository is.> Read `docs/<page>.md` before <kind of work>.

## Commands

- `<command>`: <what it checks>.

## Constraints

- <A hard constraint every task follows.>
```

- Line 1 is exactly the marker. The host strips it before the text reaches the session. It opts the repository in to the drift hook.
- The reading sentence appears only for a long document that no rule or skill covers. Write one sentence per document, naming the file and the condition.
- List a command only when a manifest, build file, script or workflow holds it. List a constraint only when the repository states or enforces it.
- Nothing for people goes in the hub. No `@path` import appears in it, except the one-line `@AGENTS.md` file of the AGENTS.md section.

The drift hook checks the opening paragraph, which runs from the `# ` heading to the first `## ` line. Every backticked token there that holds a `/` or ends in `.md`, and holds no space, `<`, `>`, `*`, `{` or `?`, must name a path that exists, spelled exactly as written, case included. So:

- Put a placeholder in angle brackets, as in `plugins/<name>/`. A token with `<` is not checked.
- Write a URL as plain text or as a Markdown link, never in backticks.
- Write a glob with its `*`.

## Nested CLAUDE.md

A subdirectory gets its own `CLAUDE.md` when its subtree has its own build and checks.

```
# <subtree>

<One or two sentences on what the subtree is.>

## Commands

- `<command>`: <what it checks>.

## Constraints

- <A hard constraint for work in this subtree.>
```

- The cap is 60 lines. There is no marker.
- The host loads the file when a file under its directory is read or edited. The drift hook names it for a recheck when a commit touches files under it.
- A `.claude/CLAUDE.md` is not a nested file. Adopt merges it into the hub.

## Rules

A rule is `.claude/rules/<topic>.md`, at most 200 lines, in declarative prose.

- A rule without frontmatter loads in every session, so keep these few. Write one only for a convention every task needs that is too long for one constraint bullet.
- A rule with `paths` loads when a matching file is touched. Use the template:

```
---
paths:
  - "src/api/**/*.ts"
  - "*.sql"
---
# <Topic>

<The convention for these files, in declarative prose.>
```

- Write `paths` as a YAML block list of quoted globs. The host also reads a comma-separated string, such as `paths: "src/**/*.ts, *.sql"`; keep that form where a file has it. Any other value is one the host cannot read.
- A glob without a `/` matches at every depth. Brace groups such as `src/**/*.{ts,tsx}` are allowed.
- Every glob must match a tracked file when the rule is committed. Scope follows the tasks the rule governs, not the paths it mentions.
- A rule never holds an `@path` import. To send the reader to a `docs/` file, name it in words and say when to read it.

## Skills

A skill is `.claude/skills/<name>/SKILL.md`, at most 150 lines.

```
---
name: <name>
description: <Trigger phrases first.> <What it does, in one sentence.>
---
# <name>

Done when <one sentence>.

1. <One action>: `<command>`. The output shows <what>.
2. <One action>: `<command>`. The output shows <what>.

## Checks

- `<command>`: <what passing shows>.

## Report

<What to tell the user when it ends.>
```

- Every `SKILL.md` needs a `description`. The drift hook denies a commit without one.
- Add `disable-model-invocation: true` when the procedure publishes, deploys, pushes or touches a live system.
- Add `paths`, in the form a rule uses, when the skill belongs to one area. The skill stays hidden until a matching file is touched.
- Add `allowed-tools` only for read-only commands every run needs.
- Name a fact that the hub or a rule holds by its file. Do not repeat it. A skill never imports.
- Move a reference longer than a screen into a supporting file beside `SKILL.md`. Name it from the body and say when to read it.

## docs pages

A `docs/` page holds long-form material for people and for the hub's reading sentences. It has no cap. The hub names it with its condition, or the skill that needs it reads it. `README.md` is for people only. Agent content in it moves out. A long one splits into `docs/` pages it links.

## AGENTS.md

- A repository that keeps a root `AGENTS.md` uses it as the hub, with the three parts of the Hub section. Write no `CLAUDE.md`.
- Say once in the reply that the host reads a root `AGENTS.md` directly from Claude Code 2.1.277, and that an older session needs a `CLAUDE.md` holding exactly `@AGENTS.md`.
- A root `CLAUDE.md` that is exactly `@AGENTS.md` plus at most one newline is kept and followed.
- When a root `CLAUDE.local.md` exists, the host does not read `AGENTS.md`. The plan proposes the one-line `CLAUDE.md` and writes it on the yes.
- A nested `AGENTS.md` with no root one stays where it is and is listed. Never move it.
- Rules and skills are Claude-only files. A repository shared with other tools keeps its shared facts in `AGENTS.md`.

## Imports, prose and history

- The hub holds no `@path` import, because an import there loads at launch. The one exception is `@AGENTS.md`.
- A rule or skill never imports, because the host does not expand `@path` inside `.claude/rules/`.
- Report an import of a file git does not track, or of a file outside the repository, and leave it alone.
- Every instruction file is declarative prose. Never reword a dated or historical entry; append a correction.
- Delete no real constraint to shorten a file. Repair inbound links in the same change as a move.

## The person's own files

`CLAUDE.local.md`, the user's own `CLAUDE.md` and `rules/` in their configuration directory, and auto memory belong to the person. Read them to avoid duplication. Never write them. The one exception is a memory note the user approves for deletion, which the promote pass handles.
