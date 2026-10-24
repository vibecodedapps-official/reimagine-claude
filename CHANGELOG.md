# Changelog

One changelog for the suite. Each plugin releases on its own line; a release gets a heading `## <plugin> <version> - <date>`, newest first, with one bullet per change saying what changed and why.

## Unreleased

- Design documents for 0.1.0 under `docs/`: requirements, architecture, build plan, decisions, acceptance.
- Design documents for the `primer` plugin under `docs/`, which replaces `repo-docs` from its release: requirements 237 to 268, decisions 73 to 89, milestones M10 to M19, acceptance items 27 to 36.

## rules 0.1.6 - 2026-10-24

- A new Done rule describes an edit from the diff, not from the plan: re-read the hunk and name only what is in it, and report a change that was planned and turned out unnecessary as not needed, never as made. A report had named a rewording the files did not hold.
- Concise Plain 4.6: what a person said or decided is reported in their words or a paraphrase that adds nothing, with the options as they were put, and a reading of their words labeled as the writer's; a draft to someone else matches its reader, plain and professional by default; a fact goes into a draft only when the reader cannot get it from a source the draft names, and a chat reply stays a few sentences unless the reader asked for the detail; before a draft is shown, even one for pasting, it is scanned for bare ids of the kinds the Links section names. The chat block carries the same four lines.
- The marketplace and repository are renamed `reimagine-engine`: the install and uninstall lines and the manifest's repository URL name it. The plugin id, skill, hook, output style and tag names do not change; a profile that installed under the old name needs the new marketplace entry.

## audit 0.1.6 - 2026-10-22

- `revert-tests.sh` with a fractional `REVERT_TESTS_TICK` no longer ends a deadline, the wait window or a cleanup bound up to a second early: the shell's clock counts whole seconds, so such a tick now waits one second more. A whole tick, the default included, waits as before.
- Agents report and label findings as if `REVIEW.md`'s severity and do-not-report rules were absent, and the report alone applies them. Before, an agent could drop a finding under a skip rule itself, so the report's line counting skipped findings showed 0.
- A run started on 0.1.5 resumes from stage 1, as after every audit release.

## loop 0.1.4 - 2026-10-22

- The final review request names the base commit's `REVIEW.md`, at the root and in each parent directory of a changed file, as review instructions when one exists, so the reviewer holds the change to the repository's own review calibration; a copy the branch adds or changes is not used.

## audit 0.1.5 - 2026-10-22

- `REVIEW.md` joins the default sources of truth, read at the bundle's base commit at the root and in each parent directory of a changed file, never from the bundle's own changes. Its severity rules set the report's labels, its skip rules remove findings from the body with one line per rule counting them, its always-check rules become pass-one checks, and its require-evidence rules hold an item that lacks a quote or a run. The report names the copies read and their shas, or says none applied at the base.
- A run started on 0.1.4 resumes from stage 1, as after every audit release.

## rules 0.1.5 - 2026-10-22

- A new Working rule makes finding issues and proposing changes a judgment, not a count: recommend the few that affect correctness or risk, or cost more to leave than to fix, each with its evidence and the two costs, and keep the rest as notes, apart and counted. A review that lists everything it can find buries the few items that matter. The chat block carries the same rule in one line.

## audit 0.1.4 - 2026-10-22

- `revert-tests.sh` reads `REVERT_TESTS_TICK`, whole or fractional seconds with a default of 1: each poll sleeps one tick, `wait` checks every two ticks and the watchdog's grace between TERM and KILL is ten ticks, so the script's own test runs in a fraction of its sleeping time. Unset, every delay is what it was; the deadlines, the wait window and the cleanup bounds stay in seconds.
- A run started on 0.1.3 resumes from stage 1, as after every audit release.

## primer 0.1.0 - 2026-10-22

- First release, with the behavior of 0.1.0-alpha.8: the drift hook, the memory notice, and the `init`, `adopt` and `maintain` modes of `/primer`.
- `repo-docs` leaves the catalog, which lists four plugins: `rules`, `loop`, `audit` and `primer`. A repository that repo-docs kept converts in one `/primer` run in adopt mode; uninstall repo-docs first, since the catalog does not list it and an update of it fails.

## loop 0.1.3 - 2026-10-22

- The implementer brief says that a rule the host loaded for the slice's files, such as a path-scoped rule under `.claude/rules/`, is binding, so a slice follows the project rules for the files it changes as it follows the instruction files.

## audit 0.1.3 - 2026-10-22

- The default sources of truth rank `.claude/rules/` and `.claude/skills/` after `docs/`, so a bundle that drifts from a path-scoped rule or a project skill is a finding. The act stage takes required checks from them and, before an edit, reads the rules that apply to the file and the skills; a recommended change places a documented fact by them too.
- A run started on 0.1.2 resumes from stage 1, as after every audit release.

## primer 0.1.0-alpha.8 - 2026-10-21

- A session that starts in a repository whose hub starts with `<!-- primer -->` shows one line, `primer: auto memory has <n> notes since the last review; run /primer`, when the repository's auto memory has `feedback` or `project` notes changed since the last promote pass, so notes about the repository get reviewed before they pile up. The promote pass writes the review stamp the line counts from. The memory is keyed by the main worktree's root, so a linked worktree sees the same count. The hook never writes a file and says nothing without the marker.

## primer 0.1.0-alpha.7 - 2026-10-21

- `maintain` runs the propose pass: it proposes skills from the instruction files, the repository and auto memory, in that order, each with its source, the steps as seen, how often it was seen and a name, and writes one in the skill shape only on its yes. A procedure taken from an instruction file leaves that file in the same commit, one from a memory note is offered for deletion, and one from `CONTRIBUTING.md` or another repository file changes nothing else. A skill for one command, for a fact, or for a procedure a skill already holds is never proposed.
- Saying "turn this into a skill" or "we keep doing this" after a checklist runs the proposal for that one item, with no other pass.

## primer 0.1.0-alpha.6 - 2026-10-21

- `maintain` runs the promote pass: it reads the repository's auto memory and proposes, per note, the line to write, with the note's text and its `modified` date. A `feedback` note about the code's conventions becomes a fact placed where the tasks that need it load it, an undated `project` note a rule or a `docs/` page, and a `reference` note a sentence in the hub; a `user` note is never offered, nor a note an instruction file already holds. On a yes the line is committed, then one question per note offers to delete its topic file and index line, and a no keeps both. After the pass the skill writes a review stamp for the session notice of a later prerelease.

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
