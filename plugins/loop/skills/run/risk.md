# Risk floor, higher-risk rule, effort hint

Read this file at Step 1.6, and read it again whenever you judge the risk floor or the higher-risk rule: in Step 2, in Step 4.5, before every Step 5 round and before every CI repair.

## Risk floor

A change is floored when it adds, alters or removes any of these, directly or through shared code or configuration:

1. an authentication or authorization check
2. a permission rule
3. a schema or a migration
4. a row-level security policy
5. a data access path
6. the signature or behavior of a public API

Check the shared code and configuration the change touches, not only the files it names. A helper, a middleware, a base class or a config key that one of the six depends on counts.

An incidental edit does not trigger the floor. Examples: a typo in a migrations README, a comment in an auth module, a rename with no signature change.

Judge the floor on the plan (Step 2) and again on the actual diff after Step 4 (Step 4.5). Judge the diff itself, not the plan's promise. The floor never falls: once a judgment finds a trigger, the run stays floored for every later step, even when a later edit removes the change that triggered it.

A floored run passes effort at least `high` to every reviewer, and uses at least level `high` for the `code-review` skill, whatever the effort hint says.

The report names the trigger. When an edit touched a sensitive area and did not trigger the floor, the report says why (for example, "a comment edit in the auth module").

## Higher-risk rule

A run is higher-risk when any one of these holds over the whole run:

1. a risk floor trigger exists
2. more than eight distinct files change across all slices, created files included
3. a new module, type, interface or rule section is cited by another file

Judge it at the plan, after Step 4, before every Step 5 round and before every CI repair. At the plan, count the files the slices own. After that, judge it on the diff from the merge-base with the default branch. Once a run is higher-risk it stays higher-risk.

The rule selects the Step 5 role and nothing else. A higher-risk run reviews its whole diff with the `code-review` skill in place of the fresh `fable` reviewer, with an explicit level (the effort level in force, below), the range `<merge-base>...HEAD` as a full sha, and never `--comment` or `--fix`. The rule never reruns Step 3 or the build, and never changes the implementer. `.reimagine.json` never changes the role it selects.

When the `code-review` skill is not listed, or the diff lives in a worktree or an additional repository, use an Agent at `opus` over a patch file instead. Send it the Reviewer request from `steps/1-plan.md`, with the acceptance criteria and the same reply shape. Continue that agent with SendMessage in the later rounds. This stand-in is not a model swap; name it in the report.

A run that turns higher-risk during Step 5 or during a CI repair moves to the `code-review` role (or its stand-in) for its remaining rounds. The move does not reset the cap of three rounds: count the rounds already used.

## Effort hint

Effort words in the request set the effort:

| Words | Effort |
|---|---|
| "quick", "low" | `low` |
| "medium" | `medium` |
| "thorough", "high" | `high` |
| "very thorough", "xhigh" | `xhigh` |
| "max" | `max` |

The effort maps to the `effort` argument of every Agent call you make for a reviewer, and to the level of the `code-review` skill. With no effort word, pass no `effort` argument and use level `high` for `code-review`.

The hint never lowers a floored run below `high`: a floored run with "quick" passes `high`. A hint above `high` stands.

Record the hint, the floor and the effort in force in `inputs.md`, and name all three in the report.

Return to the step that sent you here.
