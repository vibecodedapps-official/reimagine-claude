# Placement

Every piece of information goes at the narrowest scope where it stays authoritative and loads only when a task needs it. The hub loads in every session, so each line there costs every task. A spoke costs only the tasks that read it.

## The rule

Take the first item that fits.

1. A checkable pattern (a naming rule, a forbidden import, a format a tool can verify) belongs in a linter, a test or a hook. When the repository has that tool, say so in the plan as a proposal for the user. repo-docs touches documentation files only, so it never writes the check itself. Until the check exists, keep the rule where items 2 to 5 put it.
2. Everywhere and short (a constraint every task follows, a command every change runs): the hub, under `## Constraints` or `## Commands`.
3. One directory (rules that govern work inside one directory tree): a directory spoke, `<dir>/CLAUDE.md` beside that code, pointed to from the hub.
4. Long-form (design, procedures, background a task reads in full): a page under `docs/`, pointed to from the hub with a condition saying when to read it.
5. Install or use (how a person installs, configures, or runs the project): `README.md`, or a `docs/` page that `README.md` links when the README is long.
6. None of these (stale, duplicated elsewhere, or true of every project): deleted. The plan says which line and why.

## Scope follows tasks

Place a rule by the tasks it governs, not by the paths it mentions.

Example: a rule that mentions `src/db/` but governs every change that adds a query belongs where every such task reads it, not in `src/db/CLAUDE.md`. A task that adds a query from outside `src/db/` never loads that spoke, so the rule would be missed.

Ask "which tasks must obey this?" and place the rule where exactly those tasks load it. When the answer is "every task", it is hub material even if it names one path.

## README and the hub

- `README.md` is for people. Agent instructions in it (lines addressed to an AI assistant or agent, coding rules for automated changes) move to a spoke or the hub by the rule above. The README keeps what a person needs.
- The hub is for agents. Install steps, badges, screenshots and usage examples for people never go in it.
- A long `README.md` is split into `docs/` pages it links. That is a rewrite of the README and is planned like any other.

## What never moves or changes

- A dated or historical entry (a decision log, a changelog line, a dated note) is never reworded. It may move only verbatim. A correction is appended as a new dated entry.
- A real constraint is never deleted to shorten a file. The file is split instead.
- When a file moves, every documentation link to it is repaired in the same commit as the move.
