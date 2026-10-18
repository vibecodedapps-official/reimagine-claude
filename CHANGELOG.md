# Changelog

One changelog for the suite. Each plugin releases on its own line; a release gets a heading `## <plugin> <version> - <date>`, newest first, with one bullet per change saying what changed and why.

## Unreleased

- Design documents for 0.1.0 under `docs/`: requirements, architecture, build plan, decisions, acceptance.

## rules 0.1.3 - 2026-10-18

- The first Code rule asks for the smallest change that stays correct as the code grows, in place of "Make the smallest correct change." The old wording let "smallest" outweigh "correct": a fix patched one site in the fewest lines, skipped the sibling site and bypassed existing helpers. The new rule follows the code's patterns, changes every place the behavior lives, shapes for a known next change without building it, and still adds nothing for a need only imagined.
- The decision rule also asks for the assumption every option shares, whether it was checked, and what would overturn the recommendation, so a reviewer can see past the frame the options set.
- A new Working rule raises a request that is itself wrong as the first decision, with the evidence and what to do instead, rather than carrying it out in silence.
- A new Ask first rule names, before work starts, the steps the permission mode is likely to deny, so they can be allowed up front.
- A new Ask first rule treats a call the permission mode or a hook denies as a question: it is reported in full and the work waits, never routed around with another command, a script or a subagent, and a retry reissues only the same calls.

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
