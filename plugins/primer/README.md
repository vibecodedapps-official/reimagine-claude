# primer

Keeps a repository's project instructions in the forms Claude Code loads: a short `CLAUDE.md` hub, path-scoped rules under `.claude/rules/`, nested `CLAUDE.md` files and skills under `.claude/skills/`. It promotes auto memory into them and checks every commit with a hook.

Status: prerelease. This version ships the drift hook, the memory notice, the `init` and `adopt` modes, and the verify, promote and propose passes of `maintain`; `/primer` says which modes the installed version runs.

## Install

```
/plugin marketplace add vibecodedapps-official/reimagine-claude
/plugin install primer@reimagine-claude
```

## Requirements

Git. On Windows, Git for Windows: the hooks run under its `sh`. Nothing else; no Node, no `jq`.

## Use

Run `/primer` in a repository (also reachable as `/primer:primer`). It reads the files on disk and says its mode on the first line before it writes anything:

- `init`: the repository has no `CLAUDE.md` or `AGENTS.md` anywhere. It reads the README, manifests, build files, CI workflows, tests and `docs/`, writes the hub and leaves it uncommitted for you to review. It proposes the first rules and skills the repository shows and writes none without a yes. Claude Code's own `/init` is the unopinionated alternative.
- `adopt`: instruction or documentation files exist but there is no hub. It lists every instruction and documentation file, shows a plan and asks once. On a yes it commits moves first and rewrites after. It touches documentation files only.
- `maintain`: a hub exists. It checks the instruction files against the code, offers auto memory notes about the repository for promotion, and proposes skills for procedures it finds. With nothing to change it prints `primer: no drift` and writes nothing.

Name a mode to force it:

```
/primer adopt
```

The skill also answers to "turn this into a skill", "we keep doing this", "add this to the project instructions" and "check the instruction files".

A repository kept by repo-docs converts in one `/primer` run in adopt mode: the hub gets the marker, each spoke pointer becomes a rule, a skill, a nested `CLAUDE.md` or a sentence in the hub, and the index goes.

## The hub

The hub is the root `CLAUDE.md`, or the root `AGENTS.md` when the repository keeps one. It is at most 60 lines, with these parts:

- Line 1 is exactly `<!-- primer -->`, which Claude Code strips before the text reaches the session.
- A `# ` heading with the repository name, then two or three sentences on what it is, with one sentence naming each long document to read before a kind of work.
- `## Commands`: the commands that verify work.
- `## Constraints`: the hard constraints every task follows.

The other files have caps too: a nested `CLAUDE.md` at most 60 lines, a rule 200, a `SKILL.md` 150. Every line of the file counts.

## Drift hook

Before each `git commit` that Claude Code runs through its Bash or PowerShell tool in a repository whose hub starts with `<!-- primer -->`, the hook checks the instruction files.

It blocks the commit, with the reason, when:

- the hub or a nested `CLAUDE.md` is over 60 lines, a rule is over 200, or a `SKILL.md` is over 150;
- a path in backticks in the hub's opening paragraph does not exist, spelled exactly;
- a rule's or skill's `paths` cannot be read;
- a `paths` glob matches no tracked file;
- a skill has no `description`.

When the commit touches files that a path-scoped rule, a skill's `paths` or a nested `CLAUDE.md` covers, and that file is not part of the commit, it lets the commit run and tells Claude which files to recheck.

Without the marker it does nothing. It never writes a file. It is not a git hook: commits made outside Claude Code are not checked.

## Memory notice

When a session starts in a repository whose hub starts with `<!-- primer -->`, the notice counts the `feedback` and `project` notes in the repository's auto memory that changed since the last promote pass, and shows one line when there are any:

```
primer: auto memory has 2 notes since the last review; run /primer
```

`/primer` in `maintain` mode reviews them and records the review, after which the line goes until new notes arrive. Without the marker the notice says nothing. It never writes a file.

## Uninstall

```
/plugin uninstall primer@reimagine-claude
```

The files it wrote stay in your repositories.

## License

Apache-2.0. See `LICENSE`.
