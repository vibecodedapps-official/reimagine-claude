# Placement

Every piece of project information goes to the one destination that loads for the tasks that need it. Read this file before placing, moving or proposing anything.

## The rule

Take the first item that fits. Then apply the tasks test.

1. Name the tasks that must obey the piece.
2. Check that the destination loads for exactly those tasks, no more and no fewer.
3. Scope follows the tasks a rule governs, not the paths it mentions.

Example: "never commit generated files" governs every commit, so it is a hub constraint even though it mentions `dist/`. A nested `CLAUDE.md` under `dist/` would load only when a file there is touched, and a commit from elsewhere would miss the rule.

The reverse also holds. "Money values are integers in cents" mentions no path, but only tasks that touch `src/billing/` obey it. A path-scoped rule for that area loads for those tasks and for no others. A hub line would cost every task for a fact that few need.

When the tasks test fails, take the next item that fits. Do not widen or narrow a destination to make a piece fit. Move to the next item instead.

Place each piece once. A piece that two destinations both hold is duplicated, and item 11 deletes the extra copy.

## Where each destination loads

- The hub and unscoped rules load in every session at launch.
- A path-scoped rule loads when a matching file is read or edited.
- A nested `CLAUDE.md` loads when a file under its directory is read or edited.
- A skill's description is always listed. Its body loads when the skill is invoked or judged relevant. A skill with `paths` stays hidden until a matching file is touched.
- A `docs/` page loads only when something names it and a task reads it.

A destination that loads too widely costs every task that did not need the piece. A destination that loads too narrowly lets a task miss a piece it must obey.

## Items

Each entry gives the destination and one example of a piece that lands there.

1. A checkable pattern goes to a linter, a test or a hook. Example: "imports from `internal/` are forbidden outside `src/core/`". The plan proposes the check to the user. Primer never writes it. Until the check exists, place the piece by the items below.
2. A thing that must happen at a point in every task goes to a hook. Example: "run the formatter after every file edit". The plan proposes the hook to the user. Primer never writes it. Until the hook exists, place the piece by the items below.
3. A procedure, a checklist or a section that has become steps goes to a skill. Example: the release steps in CONTRIBUTING.md.
4. A piece every task must obey, in one line, goes to the hub as a constraint or a command. Example: "`npm run lint` must pass before a commit".
5. A topic every task must know goes to an unscoped rule. Example: how errors are logged and reported across the code base.
6. A piece for one kind of file or one area goes to a path-scoped rule. Example: "every handler under `src/api/` validates its input with the schema module".
7. A piece for one subtree with its own build and checks goes to a nested `CLAUDE.md` in that subtree. Example: "`services/billing/` builds with `make build` and tests with `make check`".
8. Long-form material that a task reads in full goes to a `docs/` page. The hub names the page with the condition for reading it, or the skill that needs the page reads it. Example: the data model write-up that explains why orders and invoices are separate tables.
9. Install, use or contribute information for a person goes to `README.md`, or to a `docs/` page that `README.md` links. Example: "run `bin/deploy staging` to try a build on the shared environment".
10. A personal preference or a note about one machine is reported and left for the user. The report says where it belongs: `CLAUDE.local.md`, the user's own `CLAUDE.md`, or the house rules block the `rules` plugin owns. Example: "use tabs, I find them easier".
11. A piece that is derivable from the code, duplicated elsewhere, true of every project, or stale is deleted. The plan gives the line and the reason. Example: "the test runner is in package.json" is derivable.

Items 1 and 2 never end a placement. A piece that fits item 1 or 2 is also placed by item 3 or later, so the rule still loads while the proposal is open.

## Personal content

A personal preference in the hub or a rule is first person, a path on one machine, or a taste. List each one in the plan or the report under item 10, in this form:

```
- <file>:<line>: <text>: belongs in <CLAUDE.local.md | your own CLAUDE.md | the rules plugin's house rules block>
```

Leave the line in place. Primer never moves or deletes personal content. The user decides.

Do not rewrite the text of the line in the report. Quote it as found, so the user can search for it.

## Skill or rule

A skill is for steps done in order with checks. A rule is for a fact.

- A procedure inside a rule or a hub section that has become numbered steps moves to a skill (item 3).
- A single command is a hub command (item 4), not a skill.
- A fact stays a rule even when a skill uses it. The skill reads the rule and does not copy it.
- A checklist with no order, such as a list of things to avoid, is a set of facts. Place each fact by the items above.
- A procedure that only one area uses still goes to a skill. Give the skill `paths` for that area, so it stays hidden until a matching file is touched.
