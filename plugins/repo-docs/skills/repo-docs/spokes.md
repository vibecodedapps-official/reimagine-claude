# Hub and spokes

The hub loads in every session, so it holds only what every task needs. Everything else lives in spokes the hub points to, and you read a spoke when a task needs it. The drift hook checks the hub, the index and the caps before every commit Claude Code runs (section "What the drift hook checks").

## The hub

The hub is the root `CLAUDE.md` (or the root `AGENTS.md` under the adapter convention), at most 60 lines counting every line. It has exactly four parts, in this order, and nothing else:

1. A level 1 heading with the repository name, then two or three sentences on what the repository is.
2. `## Commands`: the commands that verify work (build, test, lint), one per bullet, each with what it checks.
3. `## Constraints`: the hard constraints that hold for every task, one per bullet.
4. `## Spokes`: the index, one pointer per line. The line `## Spokes` is exact: the drift hook finds the index by it, and a `CLAUDE.md` without it is not a hub to the hook.

Write the hub to this template:

```
# <name>

<What the repository is, in two or three sentences.>

## Commands

- `<command>`: <what it checks>.

## Constraints

- <A rule every task follows.>

## Spokes

- <path>: <What it holds>. <When to read it>.
```

An empty index is allowed when there are no spokes yet; keep the `## Spokes` line. User-facing content (install, usage, screenshots) never goes in the hub; it belongs in `README.md`.

## Spokes

A spoke is a file the hub points to. It sits under `docs/` (long-form, cross-cutting topics, as `docs/<topic>.md`) or beside the code it governs (rules for one directory, as `<dir>/CLAUDE.md`, which Claude Code also loads by itself when it works in that directory).

A spoke is declarative prose: statements of how things are and what holds, not a log of changes. It has at most 200 lines counting every line.

A spoke may index further spokes with its own `## Spokes` line and pointer lines in the same form; the hook follows those to any depth.

## Pointer form

The grammar is `- <path>: <what it holds>. <when to read it>.` One line per spoke. These rules apply:

- The line starts at column 0 with `- `.
- The path is bare and relative to the repository root: no backticks, no Markdown link, no angle brackets, no trailing slash, no leading `@` or `/`, no `.` or `..` segment, no spaces, no colon, forward slashes only.
- After the path comes `: `, then what the spoke holds as a sentence ending with a full stop, a space, then when to read it as a sentence ending with a full stop.
- The second sentence may name path prefixes in backticks, such as "Read before editing under `src/api/`." The drift hook takes as prefixes the backticked tokens of the second sentence that hold no space and name an existing file or directory: a staged file whose path starts with one is covered by the spoke. Tokens in the first sentence, and tokens that name nothing, are ignored.
- A pointer with no backticked prefix to a spoke beside the code (not at the root and not under `docs/`) covers that spoke's directory. A pointer with no prefix to a spoke under `docs/` or at the root covers nothing.
- The index runs from `## Spokes` to the next level 1 or 2 heading. Inside it, every column-0 line starting with `- ` must be a pointer; any other such line is malformed and blocks commits. Other lines (blank lines, level 3 group headings, prose) are ignored.

Valid and invalid lines:

```
- docs/api.md: How the API handlers validate input. Read before editing under `src/api/`.
- src/worker/CLAUDE.md: The worker's queue and retry rules. Read before editing the worker.
- docs/release.md: The release steps. Read before a release.

- `docs/api.md`: ...                  malformed: backticks around the path
- [api](docs/api.md): ...             malformed: a link
- docs/: ...                          malformed: trailing slash
- @docs/api.md: ...                   malformed: leading @
- docs/api.md: API rules              malformed: no second sentence
```

## Caps and splitting

- The hub cap is 60 lines; the spoke cap is 200. Lines are counted as the file has them, the last line included even without a final newline.
- A hub over the cap: move the longest topic sections into spokes and point to them; keep the four parts.
- A spoke over the cap: split it by topic into two or more spokes, each under the cap, and index every part where the original was indexed.
- Never delete a real constraint to get under a cap; split instead.
- Dated or historical entries are moved only verbatim and never reworded; a correction is appended as a new dated entry.

## Adapter convention

- A repository keeps `AGENTS.md` when the root `AGENTS.md` exists. Then `AGENTS.md` is the canonical hub and the root `CLAUDE.md` holds exactly the line `@AGENTS.md` with at most one newline after it: a regular file, never a symlink. The same holds in every directory that has an instruction file: `AGENTS.md` with the content, `CLAUDE.md` as the one-line adapter beside it. All or nothing across the tree.
- When there is no root `AGENTS.md`, every instruction file is a `CLAUDE.md`. A nested `AGENTS.md` that exists anyway is read by other tools by that name, so it stays where it is and the hub points to it as a directory spoke.

## Imports

- Claude Code expands a line `@<path>` in an instruction file into the file it names, in every session. In a hub this defeats the point of spokes.
- Every `@path` import except the adapter line becomes a pointer in the index, or, when the imported file is short and every task needs it, its content is inlined into the hub part it belongs to and the file stays where it is.
- An import of a file git does not track (`git ls-files --error-unmatch <path>` fails, or the path is outside the repository, such as `@~/...`) is reported to the user and left in place: never inlined, never turned into a pointer.

## What the drift hook checks

The hook runs before every `git commit` Claude Code runs through its Bash or PowerShell tool. With no hub (no `CLAUDE.md`, or no `## Spokes` line in it or in the `AGENTS.md` its adapter names) it prints nothing.

Otherwise it blocks the commit when any of these holds, and its reason starts `repo-docs: `, with the findings joined by `; `:

- `<file> points to missing path <path>`
- `<file> has <n> lines, over the <cap>-line cap`
- `<file> has a malformed index line: <line>`

When nothing blocks and a staged file is covered by a spoke that is not itself staged, it lets the commit run and adds this context: `repo-docs: the staged change touches paths these spokes cover; recheck them: <spokes>`. To recheck a spoke, read it against the staged change and update any statement the change made untrue, in the same commit.

The hook never writes a file and never reads git history. A blocked commit is fixed by fixing the hub or spoke, never by bypassing the hook.
