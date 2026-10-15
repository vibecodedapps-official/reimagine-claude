# reimagine-claude

A suite of four Claude Code plugins built on three ideas: achieve more with less; say how, not what; take work from development to production in bulk.

- `rules`: house rules as one block in your `CLAUDE.md`, kept current by a script, plus the Concise Plain output style.
- `loop`: plan, build, review and publish a bundle of tickets as one reviewed pull request per repository, resuming on the same branch when run again.
- `audit`: a read-only, adversarial audit of finished pull requests that stops at a report, with an act step for approved items.
- `repo-docs`: instruction files in hub and spoke form, with a hook that blocks a commit when the hub points at a missing file or a file outgrows its cap.

Status: alpha. `rules`, `loop` and `audit` are built and published as a prerelease from `main`; `repo-docs` is not built yet. The build order is in `docs/build-plan.md`.

## Alpha install

The catalog on `main` lists the three built plugins at `0.1.0-alpha.1`. On a Windows machine:

1. Install Git for Windows and put it on `PATH`, and Node 22 or later. For the audit's live checks, work-item validation and collision check, install `jq` (`winget install jqlang.jq`); without it the audit still runs and says what it skipped.
2. Without a GitHub SSH key on the machine, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` in the environment before starting Claude Code, so the marketplace is cloned over HTTPS.
3. In Claude Code:

```
/plugin marketplace add vibecodedapps-official/reimagine-claude
/plugin install rules@reimagine-claude
/plugin install loop@reimagine-claude
/plugin install audit@reimagine-claude
```

4. Restart the session, run `/rules` and answer its question, then pick the output style with `/output-style rules:Concise Plain`.

An alpha updates to 0.1.0 with `/plugin update <name>@reimagine-claude` once that version is in the catalog; the alpha version sorts below it.

## Requirements

- Claude Code 2.1.296 or later (the version the design was checked on).
- Node 22 or later.
- On Windows, Git for Windows (the repo-docs hook and the audit scripts run under its `sh`).
- For the audit's live checks, work-item validation and collision check: `jq`. Without it the audit still runs and says what it skipped.

## Install

The blocks in this section and the two below are the 0.1.0 form; until then only the three plugins the alpha section names are in the catalog.

```
/plugin marketplace add vibecodedapps-official/reimagine-claude
/plugin install rules@reimagine-claude
/plugin install loop@reimagine-claude
/plugin install audit@reimagine-claude
/plugin install repo-docs@reimagine-claude
```

Each plugin works alone. After installing `rules`, run `/rules` (also reachable as `/rules:rules`) and answer the question it asks; then pick the output style with `/output-style rules:Concise Plain`.

## Use

- Loop: say `reimagine loop #12 and #15` or `run the loop on AB#4567, plan only`, or type `/loop:run` followed by the same words. There are no flags; the skill prints how it read your request before it does anything. The bare `/loop` is Claude Code's own interval skill, not this one.
- Audit: say `reimagine audit PR 123 and 124 in app, tickets AB#4567 and AB#4580`, or pass the manifest a loop run wrote.
- repo-docs: run `/repo-docs` in a repository; it says whether it will bootstrap, adopt or maintain before it writes.

## Update

```
/plugin marketplace update reimagine-claude
/plugin update rules@reimagine-claude
/plugin update loop@reimagine-claude
/plugin update audit@reimagine-claude
/plugin update repo-docs@reimagine-claude
```

Restart the session afterwards. When the house rules changed, a one-line notice at startup says to run `/rules`.

## Uninstall

Run `/rules --remove` first if you want the block out of your `CLAUDE.md`; it gives back the file's original bytes.

```
/plugin uninstall rules@reimagine-claude
/plugin uninstall loop@reimagine-claude
/plugin uninstall audit@reimagine-claude
/plugin uninstall repo-docs@reimagine-claude
```

The audit keeps its run registry in the plugin data directory; delete it by hand if you want it gone.

## Development

Node 22 or later, no dependencies. `npm test` runs the suites under `tests/`; `npm run lint` runs the repository rules in `tools/lint.mjs`. CI runs both on ubuntu, macOS and Windows, runs the audit's awk suites again under mawk, and validates every manifest with a pinned Claude Code version.

Design documents, in reading order: `docs/requirements.md`, `docs/architecture.md`, `docs/build-plan.md`, `docs/decisions.md`, `docs/acceptance.md`.

Releases are per plugin, in this order: `node tools/release.mjs <plugin> <version>`, then a heading `## <plugin> <version> - <date>` in `CHANGELOG.md`, then `claude plugin tag --push plugins/<plugin>`, which creates `<plugin>--v<version>`. Lint requires the heading only once the tag exists.

## License

Apache-2.0. See `LICENSE`.
