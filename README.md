# reimagine-claude

A suite of four Claude Code plugins, built on three ideas: achieve more with less; say how, not what; take work from development to production in bulk.

- `rules`: house rules as one block in your `CLAUDE.md`, kept current by a script, plus the Concise Plain output style.
- `loop`: plan, build, review and publish a bundle of tickets as one reviewed pull request per repository, resuming on the same branch when run again.
- `audit`: a read-only, adversarial audit of finished pull requests that stops at a report, with an act step for approved items.
- `primer`: project instructions in the forms Claude Code loads, a short `CLAUDE.md`, path-scoped rules, nested instructions and skills, with a hook that checks every commit.

Status: `rules`, `loop` and `audit` are released from `main`, each with its own version and tag `<plugin>--v<version>`. `primer` ships as `0.1.0-alpha.<n>` prereleases until its 0.1.0 release, the drift hook first and the skill's modes after; `/primer` says what the installed one has. The build order is in `docs/build-plan.md`.

## Requirements

- Claude Code 2.1.296 or later (the version the design was checked on).
- Node 22 or later.
- On Windows, Git for Windows (the primer hooks and the audit scripts run under its `sh`).
- For the audit's live checks, work-item validation and collision check: `jq` (on Windows, `winget install jqlang.jq`; on macOS, `brew install jq`, or the `/usr/bin/jq` that macOS 15 and later ship). Without it the audit still runs and says what it skipped.

## Install

Without a GitHub SSH key on the machine, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` in the environment before starting Claude Code, so the marketplace is cloned over HTTPS. Then, in Claude Code:

```
/plugin marketplace add vibecodedapps-official/reimagine-claude
/plugin install rules@reimagine-claude
/plugin install loop@reimagine-claude
/plugin install audit@reimagine-claude
/plugin install primer@reimagine-claude
```

Each plugin works alone. After installing `rules`, run `/rules` (also reachable as `/rules:rules`) and answer the question it asks; then pick the output style with `/output-style rules:Concise Plain`.

## Use

- Loop: say `reimagine loop #12 and #15` or `run the loop on AB#4567, plan only`, or type `/loop:run` followed by the same words. There are no flags; the skill prints how it read your request before it does anything. The bare `/loop` is Claude Code's own interval skill, not this one.
- Audit: say `reimagine audit PR 123 and 124 in app, tickets AB#4567 and AB#4580`, or pass the manifest a loop run wrote.
- primer: put `<!-- primer -->` on the first line of a repository's `CLAUDE.md`, and the drift hook checks every commit Claude Code makes there against the instruction files. Run `/primer` in a repository to set up, adopt or check its instruction files; it says which mode it runs in before it writes.
- repo-docs is retired and left the catalog with the primer release: uninstall it with `/plugin uninstall repo-docs@reimagine-claude`, then run `/primer` in each repository it kept, and adopt converts the hub and its spokes in one run.

## Update

From a shell:

```
claude plugin marketplace update reimagine-claude
claude plugin update rules@reimagine-claude
claude plugin update loop@reimagine-claude
claude plugin update audit@reimagine-claude
claude plugin update primer@reimagine-claude
```

In a session, `/plugin marketplace update reimagine-claude` refreshes the catalog and `/plugin` opens the plugin manager, whose Installed tab updates a plugin; `/plugin update` is not a session command. An alpha install moves to 0.1.0 the same way; the alpha version sorts below it. Restart the session afterwards. When the house rules changed, a one-line notice at startup says to run `/rules`.

## Uninstall

Run `/rules --remove` first if you want the block out of your `CLAUDE.md`; it gives back the file's original bytes.

```
/plugin uninstall rules@reimagine-claude
/plugin uninstall loop@reimagine-claude
/plugin uninstall audit@reimagine-claude
/plugin uninstall primer@reimagine-claude
```

The audit keeps its run registry in the plugin data directory; delete it by hand if you want it gone.

## Development

Node 22 or later, no dependencies. `npm test` runs the suites under `tests/`; `npm run lint` runs the repository rules in `tools/lint.mjs`. CI runs both on ubuntu, macOS and Windows, runs the audit's awk suites again under mawk, and validates every manifest with a pinned Claude Code version.

The repository keeps its own `CLAUDE.md` as a primer hub, and `.claude/settings.json` declares this catalog and enables `primer` for sessions here, so the drift hook checks every commit. A session in a trusted folder fetches the catalog and the plugin; run `claude plugin install primer@reimagine-claude --scope project` once in the repository so every session, headless ones included, loads it. To leave it off on your machine, set `"primer@reimagine-claude": false` under `enabledPlugins` in `.claude/settings.local.json`.

Design documents, in reading order: `docs/requirements.md`, `docs/architecture.md`, `docs/build-plan.md`, `docs/decisions.md`, `docs/acceptance.md`.

Releases are per plugin, in this order: `node tools/release.mjs <plugin> <version>`, then a heading `## <plugin> <version> - <date>` in `CHANGELOG.md`, then `claude plugin tag --push plugins/<plugin>`, which creates `<plugin>--v<version>`. Lint requires the heading only once the tag exists.

## License

Apache-2.0. See `LICENSE`.
