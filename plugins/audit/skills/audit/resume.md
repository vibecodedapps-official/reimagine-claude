# Resume

`/audit:resume <run-id> [--from <stage>] [--live <file>]` reruns an audit from a stage,
reusing only the outputs whose inputs have not changed: it never reuses a stale stage and
never throws away a finished one. The first stage to rerun is the earliest of the
`--from` stage; the first stage whose entry is missing, not complete, or lists a missing
output; stage 5 when `ledger/inventory.txt` is missing; the first stage whose inputs
changed; and stage 1 when a direct tree or a working-tree bundle changed. With `--live`,
resume first imports the user's live check results, and a result reruns the stages that
review it (`${CLAUDE_PLUGIN_ROOT}/skills/audit/live.md`). The orchestrator reads this file
when the invocation block says `command: resume`; the rules of
`${CLAUDE_PLUGIN_ROOT}/skills/audit/SKILL.md` hold throughout, and every script runs as
`sh <resolved absolute path of ${CLAUDE_PLUGIN_ROOT}/scripts/<name>.sh> ...`.

## Steps

1. **Find the run.** Read `${CLAUDE_PLUGIN_DATA}/runs.json` and take the entry whose
   `run_id` is the block's `run-id`. When there is none, or its `path` does not exist,
   stop with one line saying so. The run directory is that `path`. Append this
   invocation's block to `<run dir>/invocations.md` (`SKILL.md`, "Invocation block").
   After a compaction, the `from` and `live` values are read from the last block there.

2. **Recover the state.** Read `manifest.json` and `stages.json` in the run directory,
   nothing else yet. A missing `manifest.json` stops resume with one line: the run
   directory cannot be recovered.
   - With `--live`, a missing `stages.json`, a stage 1 entry that is missing or
     `running`, or a missing `audit-brief.md` stops resume before anything changes, with
     the line `--live answers the findings of a finished run; resume without --live first`.
   - Without `--live`, a missing `stages.json` sends the run to stage 1 with no
     approvals and no superseded records, and stage 1 writes a new `stages.json`.
   - Every approval in `stages.json` `approvals` stands and is not asked again.
   - A stage whose status is `running` is incomplete: its agents belonged to another
     session. It reruns, and nothing waits for those agents.
   - When the stage 1 entry is missing or `running`, or `audit-brief.md` does not exist,
     the first stage to rerun is 1: remove every `forge/<bundle>/pr.json.new`, so stage 1
     never reuses a file this invocation did not write, skip steps 3 to 6, and run steps
     7 to 10. Stage 1 then rebuilds its inputs from `manifest.json`'s `source` key
     merged with the prose inputs recorded in it, as step 5 does for hashing; the block's
     `manifest: none` and empty inputs are ignored.
   - Otherwise read `audit-brief.md`, `common.md` and `audit-evidence.md`, and go on
     with step 3.

3. **Check the head and base shas.** Every forge read of this step and of step 5 names
   the host stage 1 used, read from its saved forge files: the host of the `url` in
   `forge/<bundle>/pr.json` for a pull request, and the host of the `url` in the ticket's
   own forge file for a ticket. Before any query, resolve the host of each GitHub pull
   request and ticket id again from the inputs step 5 merges, as stage 1 resolves hosts
   (`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/1-orient.md`), and compare it with the
   saved one. A ticket known only from a pull request's closing references takes its
   host from `pr.json` and is not compared. When a saved file is missing, its `url` gives
   no host, the resolution stops, or a host differs, query nothing: the first stage to
   rerun is 1, handled as step 2 handles a missing `audit-brief.md`. With `--live`, stop
   instead with the step 2 line and change nothing.

   Then, per bundle, resolve the head and base as stage 1 did, through the brief's ref
   mapping lines (`<ref as given> -> <remote>/...`), and compare each with the sha the
   brief records:
   - A GitHub pull request: run stage 1's `gh pr view` read once, with that host, its
     output redirected to `forge/<bundle>/pr.json.new`. When `gh` exits nonzero or the
     file is empty, stop resume with one line: the forge cannot be queried. That is never
     a changed head. The head is `headRefOid` read from the file with `jq`; the base is
     the sha of the local remote-tracking ref `<remote>/<baseRefName>`, `<remote>` chosen
     as stage 1 chooses it from the file's `url`. The pull request's `baseRefOid` is a
     cached value and is not compared. Step 5 projects this same file; there is no
     second query.
   - Any other bundle: the shas its `branch` and `base` refs resolve to.
   - A `head: working-tree` bundle has no ref for its head, so the head is built again:
     run `working-tree.sh check <repo>`, which writes nothing and runs no filter, hook or
     program, so a refusal (exit 1) or exit 2 stops resume with its lines; create
     `<run dir>/tmp/`; run
     `readonly.sh snapshot <repo> <run dir> <run dir>/tmp/wt-<name>`; run
     `working-tree.sh build <repo>` as stage 1 does, keeping its `flagged` lines for
     step 6; then run
     `readonly.sh check <repo> <run dir> <run dir>/tmp/wt-<name> <run dir>/tmp/wt-<name> <run dir>/tmp/wt-<name>-check`.
     A refusal from the build, a `blocked` line (exit 1) or exit 2 from either script
     stops resume with the script's lines, so the build never leaves a change that a new
     baseline would absorb. An unchanged working tree and `HEAD` give the recorded sha
     and write back any pruned objects before an agent launches.

   A changed head or base sha, or a base sha not present locally (resume does not
   fetch), stops and asks whether to restart from stage 1, showing each bundle's
   recorded and current shas. The base counts as well as the merge-base: the brief's
   base commit list and its set of files changed on both sides depend on the base tip.
   On yes, the first stage to rerun is 1: skip steps 4 to 6 and go to step 7. On no,
   stop and change nothing. With `--live`, stop without asking and change nothing, with
   the line
   `--live answers the findings of a finished run; the head or base changed, resume without --live first`,
   then one line per changed bundle:
   `<bundle>: head recorded <sha> now <sha>; base recorded <sha> now <sha>`, with
   `(moved)` after the sha that changed and `not present locally` for a sha that does
   not resolve. Every stop removes each `forge/<bundle>/pr.json.new`; a stage 1 rerun
   keeps and reuses them, and step 6 removes them otherwise.

4. **Live results.** The formats, modes and messages are in
   `${CLAUDE_PLUGIN_ROOT}/skills/audit/live.md`. Skip this step when step 2 or 3 sent
   the run to stage 1, or when there is neither `--live` nor `<run dir>/live/`.
   1. **Eligibility.** With `--live`, steps 2 and 3 have already stopped a run whose
      `stages.json`, stage 1 entry or brief is missing, whose saved forge files give no
      host or another host, or whose head or base changed.
   2. **Preliminary rerun stage.** Compute the first rerun stage by the rules of steps 5
      and 6 as if no live file existed (the live inputs of stages 6 to 8 left out of the
      comparison), without removing a file, printing or stopping. It may be none. With
      `--live`, stop with the step 2 line when `<run dir>/report.md` is missing or that
      stage is before 6: the file answers the findings of a finished run, and a rerun
      from stage 5 or before would replace what it answers.
   3. **Import.** With `--live`, run
      `live.sh import <file> <run dir>/report.md <run dir>`, the file as an absolute
      path. It validates the copy it keeps, never the original. On exit 1 or 2, stop
      with the script's lines; nothing has been recorded or superseded.
   4. **Reconcile** on every resume, with or without `--live`, when `<run dir>/live/`
      exists and the preliminary rerun stage is none or 6 or later. When it is 5 or
      before nothing is reconciled, since step 7 retires the imports. Reconciling
      follows `live.md`, "Reconciling": `live.sh active <run dir>`; each `approve` line
      recorded in `stages.json` `approvals` (kind `live`, target the id, decision
      `approved`, time `approved_at`, `by` and `source`), the file written through a
      temporary file and `mv -f`; `live.sh carry <run dir> <id>` for each `carry` line;
      `<run dir>/tmp/live-entries/` removed, then one entry file there per `new` or
      `changed` winner, derived from the winning result (for a `result_file` entry, its
      copy under `live/results-<k>/`, read in full); then
      `live.sh assemble <run dir> <run dir>/tmp/live-entries`. Any nonzero exit stops
      resume with the script's lines, before anything is superseded or rerun. Steps 5
      and 6 then hash the reconciled files, so a result committed before an interruption
      is reconciled before the "run is current" exit, and a changed derived file is
      seen. The orchestrator runs no query itself.

5. **Recompute the input hashes.** For each stage entry, recompute every input it
   records, the way it was recorded:
   - Stage 1: the manifest (the file named by `manifest.json`'s `source` key, merged
     again with the recorded prose inputs and normalized, compared with
     `manifest.json`), each claims file, the questions file, the content hash of every
     `file:` ticket or pull request export, and `plugin_version`.
   - Stage 1's `forge_hashes`: each path in the map, recomputed by the read stage 1 made
     for it, with the same host, owner, repository, number and projection, its output
     piped to `git hash-object --no-filters --stdin` in place of the redirect, so no
     file is written. The pull request projection reads `forge/<bundle>/pr.json.new`
     from step 3 through the same `jq` filter, leaving out `headRefOid` and
     `baseRefOid`, which step 3 compares on their own. Each pipeline runs with
     `set -o pipefail` in front of it, or writes the producer's output to a temporary
     file and hashes it only after a zero exit, since a failed `gh` or `jq` would hash
     an empty input. The open pull request collision check reruns into a temporary
     directory, never over the run's files: the new run-once paths from the diff at the
     recorded shas, the open pull request list with the host, owner and repository of
     the `url` and the `baseRefName` and `number` in `pr.json.new`, then
     `collisions.sh`, whose output is hashed; each of the three has its exit code
     checked, and an empty path list from a failed diff is never read as no new name. A
     failed producer stops resume with one line, since the brief's evidence cannot be
     confirmed current; it is never a difference. A difference invalidates stage 1.
   - Stage 1's `forge_gaps`: for each path in the map, the read that would have written
     it, with the host, owner, repository and number of the URL the map gives, its output
     discarded. Exit 0 means the evidence can now be read, which invalidates stage 1 so
     the rerun reads it. A nonzero exit leaves the gap as it is, neither a difference nor
     a stop. An entry without the key has no gaps.
   - The pinned sha of every reference and source of truth, resolved again as stage 1
     did through the brief's ref mapping lines; a change invalidates stage 1.
   - Upstream stage outputs, by `git hash-object --no-filters <file>`.
   - `plugin_version`, compared with the literal `"0.1.1"`; any other recorded value
     invalidates stage 1.
   - The live inputs, by `git hash-object --no-filters <file>`: for stage 6,
     `live/findings.md` and each `live/carried/<id>.md` it names; for stages 7 and 8,
     those and `live/claims.md`. The result copies under `live/results-<k>/` are reviewer
     input and are not hashed (`live.md`, "Derivation"). So a finding result changes the
     inputs of stages 6 to 8, and a claim-only result, which leaves `live/findings.md`
     as it was, those of stages 7 and 8.
   A stage's inputs have changed when a recomputed value differs from the recorded one,
   or when an input is missing. An input recorded as `absent` is the one exception: it is
   unchanged while it stays absent, and absent to present, or present to absent, is a
   change. Step 4.2 uses the same rule.

6. **Pick the first stage to rerun,** the earliest of:
   - the `--from` stage, when given;
   - the first stage, in the order 1 to 8, whose entry is missing, whose status is
     anything but `complete` or `not_applicable` (`running`, `failed`, `superseded`),
     or that is `complete` but lists an output that does not exist;
   - stage 5, when its entry is `complete` but its outputs do not include
     `ledger/inventory.txt`, since `ledger.sh` needs the inventory;
   - the first stage whose inputs changed;
   - stage 1, when a tree the brief maps as `direct` fails a direct-read condition now:
     `git -C <repo> rev-parse HEAD` is not the pinned sha,
     `git -C <repo> --no-optional-locks status --porcelain --untracked-files=no` is not
     empty, or `git -C <repo> ls-files -v` shows a path flagged `S`, `h` or `s`. For a
     tree mapped `direct (working tree)` the condition is that
     `git -C <repo> rev-parse HEAD` is the recorded `head_parent` and the step 3 build
     printed no `flagged` line, so a path flagged since, in a checked-out submodule too,
     reruns stage 1;
   - stage 1, for a `head: working-tree` bundle in any mode, when the `flagged` lines of
     the step 3 build differ from the paths the brief lists as flagged at audit time.
   A `not_applicable` stage whose inputs have not changed is reused. When the first stage
   to rerun is not 1, or nothing needs a rerun, remove every
   `forge/<bundle>/pr.json.new` now. When nothing needs a rerun and no `--from` was
   given, say the run is current, print its report path and terminal state, and stop.

7. **Supersede.** Every stage from the first rerun stage through stage 8 reruns. First
   compute `<k>` once, before anything moves: one more than the highest number under
   `superseded/`, or 1 when there is none. Every `<k>` of this step and step 8 is this
   one.
   - Retire the live results first. Whenever the first rerun stage is 5 or before, by
     any path (the stage 1 path of step 2, a restart from step 3, `--from`, or the first
     incomplete or changed stage), and `<run dir>/live/` exists, run
     `live.sh retire <run dir> <run dir>/superseded/<k>/live "stage <n> rerun"`, `<n>`
     the first rerun stage, before anything else here. The rerun replaces the findings
     and claims the results answered and may number the carried ids again, so the
     imports are retired and the derived files and `live/carried/` move under
     `superseded/`; the results files stay, so every approval's source still resolves. A
     nonzero exit stops resume, with the script's lines, before anything is superseded.
   - Then, for each rerun stage that has an entry, in order: move each of its outputs
     that exists to `superseded/<k>/<path>`, keeping the run-relative path (so
     `ledger/5.md` goes to `superseded/<k>/ledger/5.md`); then rewrite its entry with
     status `superseded` and one record per moved output in its `superseded` list:
     `path`, `moved_to` and `time`. Stage 5's outputs include `ledger/5.md`, stage 6's
     `ledger/6.md` and the `second-opinion/` files, stage 7's `ledger/7.md`. The files
     `forge/<bundle>/pr.json.new` are never moved; a stage 1 rerun reuses them.
   - When the first rerun stage is 1 and its entry is missing or `running`, supersede the
     stage 1 outputs that exist the same way.
   - When `stages.json` is missing, no entry lists outputs, so walk the run directory and
     move each of these paths that exists to `superseded/<k>/<path>`: `audit-brief.md`,
     `common.md`, `audit-evidence.md`, `claims.md`, `groups.md`, `diffs/`, `forge/`,
     `trees/`, `revert/`, `guidelines/`, `domain/`, `scope/`, `pass1/`, `pass2/`,
     `ledger/`, `second-opinion/`, `late/`, `converged/`, `converged.md`, `gate.md`,
     `report.md`, `claims-verdicts.md`, `work-items.jsonl`, `usage.md`, `tmp/` and
     `baseline/`. Keep the move records and put them in the `superseded` list of the new
     stage 1 entry when stage 1 writes it.
   `manifest.json`, `stages.json`, `invocations.md`, `superseded/` and the results files
   under `live/` are never moved. Stages before the first rerun stage keep their entries
   and outputs and are reused as they are.

8. **Take the baseline again.** When the first rerun stage is 1, stage 1 takes it.
   Otherwise take it now, before any agent launches: move the `baseline/` files, except
   the stage check files of reused stages, to `superseded/<k>/baseline/`, and run
   `readonly.sh snapshot <repo> <run dir> <run dir>/baseline/<name>` for each audited
   repository, which writes its new `baseline/<name>.marker` and snapshot files. The
   ignored base of the next check starts at the new baseline (`SKILL.md`, "Read-only
   check"). A fetch runs only when stage 1 reruns. A recorded approval covers only the
   commands in its `commands` list: planned commands for a repository and remote that
   all sit in one recorded list are not asked again; otherwise ask once, listing the new
   commands, and record a new approval entry.

9. **Mark the run running.** Set the run's `state` in `runs.json` to `running` under the
   lock (`SKILL.md`, "State files"). On a refusal or failure, go on as that section
   says, recording the limitation in `usage.md` and in the final entry of the first
   rerun stage. A resumed run has no budget: a soft budget binds only the invocation
   that gave it.

10. **Continue** at the `SKILL.md` section of the first rerun stage, and run every stage
    after it under the same rules as a new audit. When the first rerun stage is 2, 3 or
    4, launch every stage among 2, 3 and 4 that reruns together; a reused stage 2 or 3
    counts as satisfied for the barrier, and its recorded `output_hashes` are final.
    Each rerun stage writes a new entry that keeps the `superseded` list of step 7. A
    stage 1 rerun reuses this run's directory, run id, `runs.json` entry, approvals and
    superseded records, and rewrites only its own entry as `running`.

11. **Report.** Stage 8 writes a new `report.md` with a new revision line. An approval
    given to `/audit:act` against a superseded revision does not match it, by design, so
    act asks again.

Next, read the `SKILL.md` section of the first rerun stage, then its stage file, and
follow `SKILL.md`, "Stage order and control flow", from there.
