# repo-docs

Keeps a repository's instruction files in hub and spoke form. Claude Code loads the hub in every session and reads a spoke only when the task needs it.

## Install

```
/plugin marketplace add vibecodedapps-official/reimagine-claude
/plugin install repo-docs@reimagine-claude
```

## Requirements

Git. On Windows, Git for Windows: the drift hook runs under its `sh`. Nothing else; no Node, no `jq`.

## Use

Run `/repo-docs` in a repository (also reachable as `/repo-docs:repo-docs`). It says which mode it runs in before it writes anything:

- `bootstrap`: the repository has no `CLAUDE.md` or `AGENTS.md`. It writes a hub from what it reads in the repository and leaves it uncommitted for you to review.
- `adopt`: a `CLAUDE.md` or `AGENTS.md` exists somewhere in the repository but there is no hub. It lists every instruction and documentation file, shows a plan, and asks once. On yes it splits files that are over their cap, hold rules for two scopes, or duplicate another, turns `@path` imports into pointers, moves agent rules out of `README.md` into a spoke, and commits moves and rewrites separately. It touches documentation files only.
- `maintain`: a hub exists. It checks the hub and spokes against the code. With nothing to fix it says so and writes nothing; otherwise it shows a plan and asks once, as adopt does.

Name a mode to force it:

```
/repo-docs adopt
```

Running it again after adopt or maintain changes nothing.

## The hub and its spokes

The hub is the root `CLAUDE.md`, at most 60 lines, with four parts:

- What the repository is.
- The commands that verify work.
- The hard constraints for every task.
- An index of spokes, under a line `## Spokes`.

A spoke is a file the hub points to, under `docs/` or beside the code it governs, at most 200 lines.

The index holds one line per spoke:

```
## Spokes

- docs/api.md: How the API handlers validate input and report errors. Read before editing under `src/api/`.
- docs/release.md: The release steps and who approves them. Read before a release.
```

The path is bare and relative to the repository root. A path prefix in backticks in the second sentence tells the drift hook which staged files that spoke covers. A spoke beside the code it governs, such as `src/api/CLAUDE.md`, covers its own directory without one.

If the repository keeps `AGENTS.md`, that file is the hub and `CLAUDE.md` holds exactly the line `@AGENTS.md`.

## Drift hook

Before each `git commit` that Claude Code runs through its Bash or PowerShell tool in a repository with a hub, the hook checks the hub.

It blocks the commit, with the reason, when:

- a pointer names a path that does not exist;
- an index line does not follow the pointer form;
- the hub is over 60 lines;
- a spoke is over 200 lines.

When the commit stages files a spoke covers and the spoke itself is not staged, it lets the commit run and tells Claude which spokes to recheck.

In a repository without a hub (no `## Spokes` line in `CLAUDE.md`) it does nothing. It never writes a file. It is not a git hook: commits made outside Claude Code are not checked.

## Uninstall

```
/plugin uninstall repo-docs@reimagine-claude
```

The files it wrote stay in your repositories.

## License

Apache-2.0. See `LICENSE`.
