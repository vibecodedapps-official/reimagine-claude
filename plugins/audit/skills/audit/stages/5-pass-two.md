# Stage 5: pass two

Stage 5 starts for a scope the moment that scope clears the barrier of stage 4; it never
waits for other scopes. Its inputs are `audit-brief.md`, `common.md`,
`audit-evidence.md`, every complete `pass1/<scope>.md`, and the `domain/<source>-map.md`
files. Its outputs are `pass2/<scope>.md` per pass-one report,
`domain/<source>-map.r2.md` per corrected map, `pass2/<scope>-topup.md` per map-correction
top-up, `ledger/inventory.txt`, `ledger/5.md` and `baseline/5-check.md`. Agents: one fresh
`audit:adversary` per complete pass-one report, plus a top-up `audit:auditor` per scope a
map correction touches. SKILL.md and `common.md` apply throughout; this file does not
restate the finding schema or the output contract.

## Steps

1. **Entry.** When the first scope clears the barrier, write the stage 5 entry as
   `running` (SKILL.md, State files), with the `git hash-object --no-filters` hashes of
   its inputs.

2. **Launch.** For each scope that clears the barrier, queue one `audit:adversary` (SKILL.md,
   Queue and Agent launch rules), with the adversary's model from the role table, the
   manifest `models` key or a prose override. Each is a new agent, never a fork and never
   the continuation of another agent, so it starts without pass one's framing. The prompt
   names, by absolute path, `audit-brief.md`, `common.md`, `audit-evidence.md`, the scope
   file `scope/<scope>.md`, the one report `pass1/<scope>.md`, the output file
   `pass2/<scope>.md` and the scratch folder `tmp/agents/pass2-<scope>/`, and gives the
   scope's question ids and text and how much to attack at the tier:

   | Tier | Verified OK items and outward-trace entries to attack |
   |---|---|
   | low | none |
   | medium | up to 5 of each per report, the ones the adversary judges riskiest |
   | high | all |

   A pass-one scope that failed has no report and gets no adversary; its coverage loss is
   already recorded.

3. **What the adversary writes.** In the shapes `common.md` gives (`## Pass-two
   verdicts`, `## Output contract`), checked on completion:
   - a verdict for every finding of the report, its top-up section included: `survives`,
     `downgraded`, `reworded` or `dropped`, each with evidence, after opening every
     citation, looking for counter-evidence, and challenging severity and label;
   - `## Verified OK challenged`, one line per item attacked with its result; the report
     marks those items `challenged` and the rest `not challenged`;
   - `## Outward trace challenged` when the report has `## Outward trace`, one line per
     entry attacked, or `none` (`audit-evidence.md`, `## Outward trace challenged`);
   - `## Coverage gaps`; for a report with `## Outward trace` it also holds
     `outward trace: <repo>:<path>:<symbol> not traced` for each changed symbol the report
     neither traces nor lists on its `not traced:` line, and for each symbol on that line;
   - new findings in the `common.md` schema, each with `origin: pass2` and an id
     `<scope>-P<n>`;
   - `## Map corrections`: map file, line, what is wrong, and the source quote at its sha
     that shows it, or `none`;
   - at every tier, `## Claims challenged`, with a line for every `verification` claim the
     report marks true, then `## Decisions challenged` and `## Scope challenged`;
   - `runs:`, `consumed:`, and a last line `status: complete`.

   A finding without a verdict makes the file incomplete, and so does a `verification`
   claim marked true without a line under `## Claims challenged`; both are failures. An
   entry of the report's `## Decisions`, `## Scope` or `## Outward trace` with no line in
   the matching challenged section, or a missing heading there, is not a failure: record
   each such entry as `not challenged` in the entry, and the report shows it with that
   mark. That covers every outward-trace entry at low tier and those past the tier's
   count. Challenge lines and the entries they challenge are report items, not findings,
   and never enter `ledger/5.md`; a new finding from a broken entry is a finding like any
   other.

4. **On each completion.** Record tokens and duration labeled "task notification,
   subagent_tokens; scope not documented". The adversary failed when it returned an error,
   its file is missing, its last line is not `status: complete`, or step 3 found a missing
   verdict or claims line. A `_test` `fail` entry with role `adversary` and this scope or
   `any` turns the scope's first `times` completions into failures. Ladder (SKILL.md,
   Roles): relaunch on the same model; then on `fable`, recorded as a swap; then the scope
   fails and its findings have no pass-two verdict. Check the budget before every launch
   (SKILL.md, Soft budget); once it has expired, launch nothing and record each scope not
   run.

5. **Map corrections.** Once every adversary has finished or failed:
   1. Collect every `## Map corrections` entry and open its source quote at the pinned
      sha. An entry whose quote does not match the source is rejected and listed under
      `## Map corrections not applied` (step 6).
   2. For each map with an accepted correction, write `domain/<source>-map.r2.md`: a
      `# Corrections` header listing each correction (line, original text, corrected
      text, the pass-two file that raised it, the source quote), then the map's full text
      with the corrected lines replaced. `domain/<source>-map.md` and its stage 3 hash
      stay as they are.
   3. For every scope whose pass-one `consumed:` list names a corrected map, at any hash,
      queue a top-up `audit:auditor`. Its prompt says "mode: top-up after a map
      correction", names by absolute path `audit-brief.md`, `common.md`,
      `audit-evidence.md`, the scope file `scope/<scope>.md`, the corrected map, the
      output file `pass2/<scope>-topup.md` and the scratch folder
      `tmp/agents/pass2-<scope>-<n>/`, `<n>` counting the scope's top-ups from 1, and
      gives the corrected lines. The agent applies the corrected answers to the scope's
      files and tags each finding `origin: topup` with an id `<scope>-T<n>`; the
      `pass1/` files do not change.
   4. A top-up failure follows the auditor ladder with scope id `<scope>-maptopup`; a
      `_test` `fail` entry with role `auditor` and that id or `any` applies. A failed
      top-up is coverage loss and makes stage 5 `failed`.
   5. One round only: a map correction that a top-up raises is not acted on; list it
      under `## Map corrections not applied` with the reason "one round". That list lives
      in `ledger/5.md` and the stage 5 entry, never in `audit-brief.md`, whose hash every
      later stage records.
   6. Every top-up finishes before stage 6 starts. Top-up findings are late additions and
      are not challenged in this stage.

6. **Write `ledger/5.md` once,** after every adversary and every top-up has finished or
   failed. It holds every finding raised in stages 4 and 5, dropped ones included; only a
   block of a failed file that cannot be parsed is left out, and `## Failed outputs`
   counts it. The script writes the finding sections; the orchestrator never copies a
   finding by hand.
   1. Write `ledger/inventory.txt` with printf, one record per line, five fields
      separated by blanks, paths relative to the run directory:

      ```
      pass1 <scope> <path> <requested model> complete|failed
      pass2 <scope> <path or -> <requested model or -> complete|failed|not-run
      topup <scope> <path> <requested model> complete|failed
      ```

      `pass1` names the current `pass1/<scope>.md`, never a `.pre-topup.md` copy. Each
      complete pass-one scope has one `pass2` record, `not-run` when the budget stopped
      it; a failed pass-one scope has none. `topup` has one record per
      `pass2/<scope>-topup.md` attempted. A record that is not complete and has no file
      uses `-` for the path, and for the model when none was requested. Every `.md` file
      under `pass1/` and `pass2/` except `*.pre-topup.md` gets exactly one record, in scope
      order.
   2. Run `mkdir -p <run dir>/tmp`, then
      `sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh build5 <run dir> > <run dir>/tmp/ledger5.md`.
      Never redirect it into `ledger/5.md`: a failed build (exit 1, no output) must leave
      no `ledger/5.md`, since stage 8 prefers the ledger files when they exist. Per scope
      in inventory order, the script writes the pass-one findings (barrier top-up
      findings included), then the pass-two additions, then the top-up findings, one
      section per id:

      ```
      ## <finding id>
      - origin: pass1 | pass2 | topup
      - author: <agent type>, model <requested model>, file <path>
      ### Original
      <the finding's full text, verbatim>
      ### Pass-two verdicts
      - <verdict> by audit:adversary (model <requested model>) in <pass2 path>: <reason>; evidence: <as cited>
        (`- none` when the finding has no verdict)
      ### State after pass two
      <severity>, <label>, <survives | downgraded | reworded | dropped | no verdict: late addition | no verdict: scope failed | no verdict: not run, budget expired | no verdict: output failed>
      ```

      Then, per scope with a complete pass two, `## Verified OK challenged: <scope>` and
      `## Coverage gaps: <scope>`, cut from the pass-two file, and, when a record is
      `failed`, `## Failed outputs` with one line per failed file: `- <path>`,
      `- <path> (<n> blocks not parsed)`, or `- <kind> <scope>: no file` for a record
      whose path is `-`. A well-formed finding of a failed file keeps its section with the
      state `no verdict: output failed` and no verdict credit.
   3. Append to `tmp/ledger5.md`, after the script's output, always both sections and in
      this order: `## Map corrections applied` (each `.r2.md` file and its lines) and
      `## Map corrections not applied` (each rejected or one-round correction with its
      reason). An empty one has the body `none`. They are judged, so the script does not
      write them; `check --through 5` compares only the text before the first
      `## Map corrections applied` line with the script's output.
   4. Run `mv -f <run dir>/tmp/ledger5.md <run dir>/ledger/5.md`, then
      `sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh check <run dir> --through 5 > <run dir>/tmp/check5.txt`.
      Read only `wc -l` of that file and its first 50 lines (`head -n 50`), never the
      whole output.
   5. A nonzero exit from `build5` or from the check comes with problem lines starting
      `ledger: `. When the inventory is the cause (a missing or extra record, a wrong
      status or path), fix it and rerun sub-steps 2 to 4 once. A second nonzero exit, or
      a problem in a pass-one or pass-two file rather than the inventory, fails stage 5
      and the run ends `partial`. When `build5` never succeeded, nothing was moved and no
      `ledger/5.md` exists; record `"ledger_build": "failed"` in the stage 5 entry. Remove
      `<run dir>/tmp/ledger5.md` when done.

7. **Completion.** Stage 5 is `complete` when every pass-one report got a complete pass
   two, every top-up succeeded, and `ledger/5.md` is written and passes
   `check --through 5`; otherwise it is `failed` and the run ends `partial`. When the
   budget expired, still write the inventory and `ledger/5.md` from what is on disk,
   through step 6 with the same temporary file and move, so stage 8 can use them.

8. **Read-only check.** Run the check of SKILL.md (Read-only check), which writes
   `baseline/5-check.md`. An ignored-file difference from an adversary or top-up with
   Bash is pending until its `runs:` heading settles it.

9. **Entry last.** Once the check has passed, write the stage 5 entry (SKILL.md, State
   files): status; inputs; outputs, every `pass2/` file, each `.r2.md`,
   `ledger/inventory.txt` with its hash, and `ledger/5.md`; agents; swaps; failed scopes;
   the map corrections not applied; each decision, scope or outward-trace entry recorded
   as `not challenged`; `ledger_build` when the build failed; `brief_errata`, every line
   of every pass-two `## Brief errata` section other than `none`, each prefixed with its
   scope (`<scope>: <line>`), or an empty list; and each `_test` fault applied. The brief
   itself is never edited; the report's Coverage repeats the list.

Next, when every scope has finished pass two and every top-up has ended, read
`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/6-second-opinion.md`.
