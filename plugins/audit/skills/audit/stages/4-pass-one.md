# Stage 4: pass one

Stage 4 starts as soon as stage 1 completes, together with stages 2 and 3; enqueue its
jobs when theirs are queued, behind them. Its inputs are `audit-brief.md`, `common.md`,
`audit-evidence.md`, `groups.md`, `claims.md`, each `revert/<bundle>.md`, the questions in
the brief, and whatever `guidelines/digest-N.md` and `domain/<source>-map.md` files exist
when an auditor reads them. Its outputs are `scope/<scope>.md` and `pass1/<scope>.md` for
every scope, a `pass1/<scope>.pre-topup.md` copy for each scope that needed a top-up, and
`baseline/4-check.md`. Agents: one `audit:auditor` per scope, plus a top-up auditor per
barrier miss. SKILL.md and `common.md` apply throughout and are not restated here.

## Steps

1. **Entry.** Before the first launch, write the stage 4 entry as `running` (SKILL.md,
   State files), with the `git hash-object --no-filters` hashes of `audit-brief.md`,
   `groups.md`, `claims.md`, `common.md`, `audit-evidence.md` and each
   `revert/<bundle>.md`.

2. **Scopes by tier.** The tier is in `audit-brief.md`.

   | Tier | Scopes |
   |---|---|
   | low | one scope, `combined`: every group of `groups.md`, plus tests and work-item hygiene |
   | medium | one scope per group of `groups.md`; `tests-hygiene`; `interactions` when there is more than one bundle |
   | high | one scope per group of `groups.md`; `tests`; `hygiene`; `interactions` when there is more than one bundle |

   Group scopes include `unticketed` and `cross-cutting` when `groups.md` has them. A group
   with no files gets no scope and no agent; the entry records it as "skipped: no files".
   Scope is never merged or dropped to fit `max_agents`; extra work waits in the queue.

3. **Scope files.** Write `scope/<scope>.md` for each scope, holding:
   - the scope id and its role: group, `combined`, `tests`, `hygiene`, `tests-hygiene` or
     `interactions`;
   - the changed files it covers, with their notes from `groups.md`; a specialist scope
     gets every changed file of every bundle;
   - the run-once entries: for a group scope, the brief's run-once entries for its files;
     for `combined`, every entry of every bundle; each with its change status, its old
     path when the status is `R` or `C`, and whether it exists at the merge-base; a
     specialist scope gets `none`;
   - its claims, by number and kind, as stage 1 assigned them; `combined` gets every claim.
     Every `hygiene` claim goes to one scope: `hygiene` at high, `tests-hygiene` at medium,
     `combined` at low;
   - the revert files it reads: every `revert/<bundle>.md` for `tests`, `tests-hygiene` and
     `combined`; for a group scope, each one whose verdict list names a file of the scope;
     else `none`;
   - the tickets it concerns, and the read path of each repository from the brief;
   - the question ids to answer: every question, at every tier;
   - for a group scope and `combined`, the duty to write the outward trace (`## Outward
     trace` in `audit-evidence.md`); a specialist scope writes none;
   - its checklist rows from the table below: the role's row for a specialist or
     `combined`, and the decision row for every scope assigned a `decision` claim.

   | Role | Checklist |
   |---|---|
   | tests | Coverage of new behavior; weakened, deleted or skipped tests; CI configuration changes. Read each added or changed test and flag one that asserts the code's own constant or a value computed the way the code computes it, pins text without running the code that makes it, or accepts a wrong outcome among those it allows. A flag is a lead; it becomes a finding only when it names the regression the test would miss, with the test quoted. With the default questions it goes under Q2 (the test would pass without the change, so the change is not shown to do what the ticket says); with a custom list, under the question closest to test coverage, else the first, and the finding says so. Tests are read, not run, except that a revert file the scope lists is a run, read as `### Reverted test runs` in `audit-evidence.md` says. Apart from that, flag an added or changed test, step or scenario that runs as an account, role or credential with write or admin rights when everything it runs as that account only reads. Flag the test that picks the account, not a shared step that takes the role as a parameter. A grant or role definition shows the rights; code outside the tests that writes as the account (found with `git grep` on its name), or a name that says writer, owner or admin, only points to them; with neither, the account is not flagged, since an accounts file holds a name and a secret reference, not rights. Name the account, where its rights come from, and the narrower role the test needs, such as a read-only role a sibling test uses; one finding per account, naming each test. With a quoted grant, label it as `## Evidence` in `common.md` says; when the rights are only pointed to, label it `unverified assumption` and fill `live check` with a query on the account's grants and on whether a read-only role exists, per environment the test runs in. With the default questions it goes under Q1 (the test holds more rights than it uses); with a custom list, under the question closest to best practice, else the first, and the finding says so. |
   | hygiene | Each ticket matches the change; each acceptance criterion met or not, with evidence; deferred work recorded on a ticket; each `status` claim's parent and links checked against the forge data; every key the brief lists as "not in export" reported as a gap in what could be checked; the scope check for every `scope` claim (`## Scope` in `common.md`). |
   | tests-hygiene | Both rows above. |
   | interactions | Contracts, schemas and APIs changed in one bundle and used in another; the stack order and the combined state the brief states. |
   | combined | The group review of every changed file with its outward trace, plus the tests and hygiene rows, in one report. |
   | decision (every scope assigned a `decision` claim) | The decision ledger for each `decision` claim of the scope (`## Decisions` in `common.md`): three dimensions, class, reversibility, recommendation. |

   At low tier the report's Coverage says that one auditor covered the tickets, the tests
   and work-item hygiene with this checklist.

4. **Launch.** Queue one `audit:auditor` per scope (SKILL.md, Queue and Agent launch
   rules), with the auditor's model from the role table, the manifest `models` key or a
   prose override. The prompt names, by absolute path, `audit-brief.md`, `common.md`,
   `audit-evidence.md`, the scope file `scope/<scope>.md`, the output file
   `pass1/<scope>.md` and the scratch folder `tmp/agents/pass1-<scope>/`, and gives the
   scope's question ids and text. Finding ids are `<scope>-F<n>`. Record each launch:
   type, requested model, scope, start time.

5. **Hold.** When `_test` `hold` names stage 4, the jobs of step 4 wait until the stage it
   waits on has ended its initial agents. When `hold` waits on stage 4, the held stage's
   jobs wait until every auditor launched in step 4 has ended; top-ups do not count, so
   the barrier's top-up path runs. Record the hold in the entry.

6. **On each completion** of a pass-one auditor:
   1. Record the end time, the notification's `subagent_tokens` and `duration_ms`, labeled
      "task notification, subagent_tokens; scope not documented", in the entry and in
      `usage.md`.
   2. The agent failed when it returned an error, when `pass1/<scope>.md` is missing, or
      when its last line is not `status: complete`. A `_test` `fail` entry with role
      `auditor` and this scope or `any` turns the scope's first `times` completions into
      failures.
   3. On a failure, follow the ladder (SKILL.md, Roles): relaunch on the same model with
      the same prompt; then relaunch on `fable`, recorded as a swap with role, scope, from,
      to and reason; then the scope fails, with its coverage loss recorded. A relaunch
      overwrites the output file. A failed scope counts as done for the barrier and for
      the stage, and gets no pass two.
   4. On success, check that the report has a `runs:` heading and a `consumed:` heading;
      either may say none. `consumed:` names each digest and map read, with its hash.
      Then check coverage. The report's `## Decisions` must name every `decision` claim of
      the scope, and a scope that holds `hygiene` claims must have a `## Scope` naming
      every `scope` claim of the scope. A miss is not a failure: record each claim
      missed as `not assessed` in the entry; the report gives it the verdict
      `not verified` with the reason "not assessed". A group or `combined` report without
      `## Outward trace` is not a failure either: record "outward trace: not assessed"
      for the scope, and the report lists it.

7. **Barrier.** Once stages 2 and 3 each have status `complete`, `failed` or
   `not_applicable`, compute the barrier for each scope whose pass-one report is
   complete:
   1. The final set is every file in the `output_hashes` of the stage 2 and stage 3
      entries, with those hashes. Confirm each with `git hash-object --no-filters <file>`;
      a file whose hash differs from its entry counts at its current hash. A
      `not_applicable` stage adds nothing; a `failed` stage adds the outputs it completed.
   2. Compare the set with the report's `consumed:` list. A final file the list lacks, or
      lists with another hash, is a miss.
   3. No miss: the scope clears the barrier. Start its pass two at once, per
      `${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/5-pass-two.md`, without waiting for other
      scopes.
   4. A miss: copy `pass1/<scope>.md` to `pass1/<scope>.pre-topup.md`, then queue a
      top-up `audit:auditor` for the scope. Its prompt says "mode: top-up after the
      barrier", names by absolute path `audit-brief.md`, `common.md`,
      `audit-evidence.md`, the scope file `scope/<scope>.md`, the output file
      `pass1/<scope>.md` and the scratch folder `tmp/agents/pass1-<scope>-<n>/`, `<n>`
      counting the scope's top-ups from 1, and gives each missed digest and map path with
      its hash and the scope's questions. The agent definition holds the top-up duties:
      apply every rule and answer of the missed files, cite the original at its sha, keep
      every line of the report but its last `status: complete`, and append a `## Top-up`
      section whose findings continue the scope's `F<n>` numbering, with `runs:`,
      `consumed:` and a last line `status: complete`.
   5. A top-up succeeded when the file ends with `status: complete`, holds a top-up
      section, and keeps the saved report: strip CR from every line, take the saved copy
      less its last `status: complete` line and trailing empty lines, and compare it line
      by line with the same number of leading lines of the new file; a `## Top-up` or
      `## top-up` heading must follow them. On a failure, restore the file from the saved
      copy and follow the ladder with scope id `<scope>-topup`; a `_test` `fail` entry
      naming that id or `any` applies. When the top-up scope fails, the scope still
      clears the barrier with its pass-one report, and the missed files are coverage
      loss.
   6. After a top-up succeeds, compute the barrier again, since a digest or a map may have
      changed while it ran, and repeat from sub-step 2 on a new miss. The scope clears
      once no miss remains.

8. **Budget.** Before every launch, relaunch and top-up, check the budget (SKILL.md, Soft
   budget). Once it has expired, launch nothing more, let running agents finish, record
   each scope or top-up not run as "not run: budget expired", and go to stage 8 when no
   agent runs.

9. **Completion.** Stage 4 is done when every scope has a complete report or has failed,
   every scope has cleared the barrier, and every top-up has finished or failed. Its
   status is `complete` when no scope failed and the budget cut no job, else `failed`, and
   the run ends `partial`. Pass two may already run for the scopes that cleared; it does
   not wait for this step.

10. **Read-only check.** Run the check of SKILL.md (Read-only check), which writes
    `baseline/4-check.md`. Auditors have Bash, so an ignored-file difference is accepted
    as pending while any of them runs and is settled against the finished auditors'
    `runs:` headings. A difference in tracked files, untracked files that are not
    ignored, refs, the index, the stash or config ends the run `blocked`.

11. **Entry last.** Once the check has passed, write the stage 4 entry (SKILL.md, State
    files): status; inputs, each consumed digest and map hash included; outputs, every
    `scope/` and `pass1/` file and each `.pre-topup.md` copy; agents; swaps; failed scopes
    with reasons; each claim recorded as `not assessed`; each scope recorded as "outward
    trace: not assessed"; and each `_test` fault applied.

Next, for each scope as it clears the barrier, read
`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/5-pass-two.md` and start its pass two; early
scopes do not wait for late ones.
