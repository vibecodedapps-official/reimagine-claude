# Stage 3: domain map

Stage 3 starts as soon as stage 1 completes, together with stages 2 and 4. It applies when
`audit-brief.md` classes a source of truth as a code base. Its inputs are `audit-brief.md`,
`common.md`, `claims.md`, `groups.md`, the `forge/<bundle>/` files, and each code base at
its pinned sha. Its outputs are one `domain/<source>-questions.md` and one
`domain/<source>-map.md` per code base, and `baseline/3-check.md`. A map is a pointer for
the auditors: they cite the source at its sha, never the map. Agents: one `audit:mapper`
per code base.

## Steps

1. **Applicability.** When the brief lists no code base, write the stage 3 entry with
   status `not_applicable`, no outputs and no agents, and stop. The stage counts as
   satisfied for the barrier and the report lists it in Coverage.
2. **Entry.** Write the stage 3 entry as `running` (SKILL.md, State files). Its inputs are
   the `git hash-object --no-filters` hashes of `audit-brief.md`, `common.md`, `claims.md`,
   `groups.md` and every `forge/<bundle>/` file, the pinned sha of each code base, and
   `plugin_version`.
3. **Questions.** For each code base `<source>`, write `domain/<source>-questions.md`, one
   block per ticket. Each question asks how `<source>` handles something the ticket
   changes: one question per behavior, rule, input, output or edge case that the ticket
   text, its acceptance criteria, or a `claim` line of `claims.md` tagged with the ticket
   says the change adds, alters or removes. When the source is the system the change ports
   or replaces, the questions are parity questions: does the change do what the source
   does, case by case. Number them `<ticket>-M<n>`, and give each the id of the group in
   `groups.md` whose files it concerns and the claim numbers it covers. A ticket with no
   question for this source is listed with `none`.
4. **Launch.** Queue one `audit:mapper` per code base (SKILL.md, Queue and Agent launch
   rules); maps follow the digests and come before pass one. When `_test` `hold` names
   stage 3, queue them and launch none until the stage it waits on has ended its initial
   agents. The scope id is `<source>`. The prompt names, by absolute path,
   `audit-brief.md`, `common.md`, the scope file `domain/<source>-questions.md`, the output
   file `domain/<source>-map.md` and the scratch folder `tmp/agents/domain-<source>/`,
   and gives the source's read path and sha from the brief and those of every other code
   base. It adds the stage's duties in a few lines: answer every question against this
   source with quotes, `repo@sha:path:line`; write `not found` with the search used where
   the source holds no answer; and note each place where this source and another code base
   disagree, with a quote from each. The agent definition holds the rest.
5. **On each completion.** Apply `_test` `fail` for role `mapper` at scope `<source>` or
   `any`. Read the output; its last line must be `status: complete`. On a failure, follow
   the ladder (SKILL.md, Roles): relaunch on the same model, then on `fable` recorded as a
   swap, then the scope fails. Record each agent in the entry. On success:
   1. When `_test` `plant_map_error` names this source, change one quoted answer's
      conclusion in `domain/<source>-map.md` to its opposite, keep its quote, and record
      the line number and the original line in the entry as `test_planted`. Do this
      before hashing.
   2. Run `git hash-object --no-filters domain/<source>-map.md` and record the hash in the
      entry's `output_hashes` map. These are the final map hashes that the barrier of
      stage 4 compares with each pass-one report's `consumed:` list.
6. **End.** When every code base is complete or failed:
   1. Run the read-only check (SKILL.md, Read-only check), which writes
      `baseline/3-check.md`.
   2. Write the stage 3 entry last: status `complete` when every map completed, else
      `failed` with the failed sources in a `failed_scopes` list; outputs: every question
      file, every completed map and `baseline/3-check.md`; `output_hashes`; and
      `test_planted` when set.
   3. Print the stage boundary line (SKILL.md, Soft budget). With `_test`
      `expire_budget_after_stage: 3`, the budget expires now.

A failed stage 3 counts as satisfied for the barrier, so the run goes on; the questions
never answered are coverage loss and the run ends `partial`. The stage 3 map and its hash
stay fixed: a correction from pass two goes to `domain/<source>-map.r2.md`
(`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/5-pass-two.md`). Next, go to the barrier step of
`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/4-pass-one.md` for every scope whose pass-one
report is already complete.
