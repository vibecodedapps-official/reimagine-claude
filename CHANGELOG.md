# Changelog

One changelog for the suite. Each plugin releases on its own line; a release gets a heading `## <plugin> <version> - <date>`, newest first, with one bullet per change saying what changed and why.

## Unreleased

- Design documents for 0.1.0 under `docs/`: requirements, architecture, build plan, decisions, acceptance.
- Design documents for the `primer` plugin under `docs/`, which replaces `repo-docs` from its release: requirements 237 to 268, decisions 73 to 89, milestones M10 to M19, acceptance items 27 to 36.

## primer 0.1.0-alpha.5 - 2026-10-21

- `/primer` runs the verify pass of `maintain` in a repository whose hub starts with `<!-- primer -->`. It checks the hub, nested `CLAUDE.md` files, rules and skills against the repository: what the drift hook denies, that each command they name exists and does what its line says, and that each statement is true of the files it covers. With drift it prints one plan with file and line, asks once and commits the fixes; with none it prints `primer: no drift` and the items it reports, and writes nothing. Drift in `README.md`, `CONTRIBUTING.md` and `docs/` pages, and contradictions between instruction files, are reported and never rewritten. The promote and propose passes are not in this prerelease.
- The mode check reads the hub from disk. The host drops HTML comments from the `CLAUDE.md` it loads at session start, so a run that chose from that copy saw no marker and chose `adopt`.

## primer 0.1.0-alpha.4 - 2026-10-21

- `/primer` runs `adopt` in a repository with instruction files but no hub starting with `<!-- primer -->`, or with a hub and spoke index. It inventories every instruction and documentation file, plans the moves, rewrites and proposals in one message, and asks once. On a yes it commits the moves first, with the documentation links they break repaired, then the rewrites, and writes the hub's marker last so the drift hook checks the finished set. An index pointer whose condition is a file pattern becomes a path-scoped rule, a task a skill, and a directory a nested `CLAUDE.md`. Pinned files, untracked imports and `CONTRIBUTING.md` stay as they are. `maintain` still stops with nothing written.
- The mode line is the first line of the reply with nothing before it, and an instruction-file commit carries no trailer that names a model, an agent or a tool.

## primer 0.1.0-alpha.3 - 2026-10-21

- `/primer` runs `init` in a repository with no `CLAUDE.md` or `AGENTS.md`. It reads the readme, manifests, build files, CI workflows, test layout and contributing guide, writes a root `CLAUDE.md` of at most 60 lines with the marker, the commands and the constraints the repository holds, and leaves it uncommitted for the user to read. In the same reply it proposes the skills, path-scoped rules and nested `CLAUDE.md` files the repository shows, asks once, and writes none without a yes. `adopt` and `maintain` still stop with nothing written.

## primer 0.1.0-alpha.2 - 2026-10-20

- `/primer` chooses its mode from the files on disk and states it as the first line of the reply: `init` with no `CLAUDE.md` or `AGENTS.md`, `adopt` with instruction files but no hub starting with `<!-- primer -->`, and `maintain` with one. Each mode then says it is not in this prerelease and writes nothing, so the mode selection can be tried before the modes land.
- The skill gains the two reference files its modes read: the shape and cap of each instruction file, and the eleven placement items that decide where a piece of project information goes.

## primer 0.1.0-alpha.1 - 2026-10-20

- First prerelease of `primer`, which replaces `repo-docs` from its 0.1.0 release. It ships the drift hook: before each `git commit` Claude Code runs in a repository whose `CLAUDE.md` or `AGENTS.md` starts with `<!-- primer -->`, the hook denies the commit when an instruction file is over its cap, a path the hub's opening paragraph names is missing, a rule's `paths` cannot be read or matches no tracked file, or a skill has no description, and otherwise names the rules, skills and nested `CLAUDE.md` files that cover the staged change. The `/primer` skill answers that its modes are not in this prerelease.
- The catalog lists five plugins until the primer release removes `repo-docs`.

## loop 0.1.2 - 2026-10-20

- A run on a host other than GitHub writes the pull request body its `prepared` report names, at the end of Step 6. Before, that run never read the body template, so the report pointed to a file that was not there and the body was written by hand. The body covers every input of every run of the record, one per repository.
- On an Azure DevOps remote a ticket is a link to its work item, named by its type, in place of `Refs AB#<n>`, which Azure Repos does not link; and, under the 4,000-character description cap, the body holds only the related pull requests, the closing lines and a pointer to the full body in a comment file to post first. The report asks the user to link the work items with the host's tooling, since a `Refs` line does not attach them.

## audit 0.1.2 - 2026-10-20

- The merger reads every file it takes whole to its last line, in pages, and checks it reached the line count its prompt gives. A ledger over the host's single-read limit was read in part before, and a merger could miss positions without saying so. It finds a ledger section for a duplicate check with Grep and reads only that section.
- The agents' command lists name `git rev-parse`, `git merge-base`, `git ls-tree`, `git cat-file -t|-s|-p`, `git branch --list`, `cut` and `uniq`, the read-only commands agents used outside the list; `sort -o`, `--output` and `--compress-program` and `uniq` with an output file are barred, since they write or run a program.
- A run started on 0.1.1 resumes from stage 1, as after every audit release.

## rules 0.1.4 - 2026-10-20

- The upgrade plan shows each changed run of the block as its own hunk, with three lines of context. The diff trimmed only the common head and tail, and the begin marker changes on every version, so an upgrade showed the whole block removed and added again and hid the few rules that changed.

## rules 0.1.3 - 2026-10-18

- The first Code rule asks for the smallest change that stays correct as the code grows, in place of "Make the smallest correct change." The old wording let "smallest" outweigh "correct": a fix patched one site in the fewest lines, skipped the sibling site and bypassed existing helpers. The new rule follows the code's patterns, changes every place the behavior lives, shapes for a known next change without building it, and still adds nothing for a need only imagined.
- The decision rule also asks for the assumption every option shares, whether it was checked, and what would overturn the recommendation, so a reviewer can see past the frame the options set.
- A new Working rule raises a request that is itself wrong as the first decision, with the evidence and what to do instead, rather than carrying it out in silence.
- A new Ask first rule names, before work starts, the steps the permission mode is likely to deny, so they can be allowed up front.
- A new Ask first rule treats a call the permission mode or a hook denies as a question: it is reported in full and the work waits, never routed around with another command, a script or a subagent, and a retry reissues only the same calls.
- The chat block takes the output style's Links rule, since a session in the chat app can run `git remote -v` and read tool results: base URLs come from the remote, a URL a tool returned, the task or the user, and the Azure DevOps bullet says which remote gives the base. Its recommendation rule also asks for what would overturn it, in step with the house rules.
- The chat block's header no longer sets a 5,000-character cap. The chat app publishes no cap for its instructions field and took the whole block, so the header asks only that the block stay short.

## audit 0.1.1 - 2026-10-16

- The skill's shell lines hold under zsh and BSD tools: a stale registry lock with no owner directory is removed without an unmatched glob stopping the command, a sha held in a shell variable before `:<path>` is written so no shell reads it as a modifier, and the output of `wc` is compared as a number since BSD `wc` pads it.
- The README says where macOS users get `jq`.

## loop 0.1.1 - 2026-10-16

- A sha held in a shell variable before `:<path>` is written so no shell reads it as a modifier and alters the path.

## repo-docs 0.1.1 - 2026-10-16

- The drift hook checks the paths a pointer or a backticked prefix names by their exact spelling, so a pointer written in another case than the file is a missing path on every filesystem, as it already was on Linux, and a prefix in another case is dropped instead of silently losing the recheck advice.
- The hook reads its input under the C locale, so a byte that is not UTF-8 in the command no longer makes BSD `sed` stop and the commit pass unchecked on macOS.

## rules 0.1.2 - 2026-10-16

- A `/rules` step whose data directory or config directory denies a write on macOS or Linux (EACCES, or EPERM from an immutable flag) stops with the one-line refusal that Windows already gets, naming the directory to check, instead of printing a stack trace.
- An import chain that reaches the user's `CLAUDE.md` by another spelling of its name on a case-insensitive filesystem no longer counts the block as rules the import holds.

## rules 0.1.1 - 2026-10-16

- A `/rules` step whose data directory refuses to create the lock stops within a second and names the directory to check, instead of waiting ten seconds and reporting that another step holds the lock.

## repo-docs 0.1.0 - 2026-10-16

- First release.
- Bootstrap points only to `docs/` files within the 200-line spoke cap and names a longer one in plain text in the hub's opening sentences, so the hub it writes passes its own drift hook.

## audit 0.1.0 - 2026-10-16

- First release, with the behavior of 0.1.0-alpha.1.

## loop 0.1.0 - 2026-10-16

- First release, with the behavior of 0.1.0-alpha.1.

## rules 0.1.0 - 2026-10-16

- First release.
- On Windows, a `/rules` step that finds the lock still being removed by another step waits its turn instead of stopping with an unexpected error.

## repo-docs 0.1.0-alpha.1 - 2026-10-15

- First prerelease. `/repo-docs` keeps instruction files in hub and spoke form in three modes: bootstrap writes a hub, adopt inventories existing docs, plans, asks once and commits, and maintain checks the hub and spokes for drift.
- A PreToolUse drift hook in POSIX sh that denies a Claude Code commit when the hub or a spoke names a missing path, holds a malformed index line or is over its cap, and names the spokes to recheck when staged files fall under them.

## audit 0.1.0-alpha.1 - 2026-10-15

- First prerelease. Nine stages from orient to act, a read-only check after every stage, a fresh adversary per pass-one report, a second opinion by a fresh adversary with sentinel acknowledgments, a late adversary, a merger, and a report with a revision line that act and live results bind to.
- Nine POSIX sh scripts with their suites and deterministic fixtures: read-only snapshot and check, handoff validation, ledger build and gate, working-tree head, reverted test runs, live imports, memory scan, work-item validation and open pull request collisions.

## loop 0.1.0-alpha.1 - 2026-10-15

- First prerelease. Plan, build, review and publish a bundle of tickets as one reviewed pull request per repository; a second run on the same tickets continues the same branch and reuses every step whose inputs still hold.

## rules 0.1.0-alpha.1 - 2026-10-15

- First prerelease. One house-rules block in the user's `CLAUDE.md`, planned and applied by a script with a backup, a staleness notice at session start, and the Concise Plain output style.
