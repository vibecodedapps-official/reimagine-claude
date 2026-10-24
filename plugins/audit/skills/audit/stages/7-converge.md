# Stage 7: converge

Stage 7 starts once stage 6 has ended, `complete` or `failed`, unless the budget has
expired. The orchestrator runs it: a late adversary challenges the findings that arrived
after pass one, a script decides which findings count, and a merger folds every ledger
id into one list of items. The rules in `${CLAUDE_PLUGIN_ROOT}/skills/audit/SKILL.md`
and the run's `common.md` hold throughout. Inputs: `ledger/5.md`, `ledger/6.md`,
`audit-brief.md`, `common.md`, `audit-evidence.md`, and the live inputs
`live/findings.md`, `live/claims.md` and each `live/carried/<id>.md` that
`live/findings.md` names (`${CLAUDE_PLUGIN_ROOT}/skills/audit/live.md`). Each input is
recorded in the stage entry with its hash, a live input as `absent` when it does not
exist; the live files exist only on a run resumed with live results, and a claim-only
result leaves `live/findings.md` absent. Outputs: `late/adversary.md` when the late
adversary runs, `ledger/7.md`, `gate.md`, `converged.md`, and in split mode
`ledger/slices/<group>.md` and `converged/<group>.md` (a group cut by size has parts
`<group>-<k>`).

## Steps

1. **Budget and entry.** When the budget has expired, stage 7 does not start and gets no
   entry; go to stage 8. Otherwise write the stage 7 entry as `running` with its input
   hashes. Before every launch in this stage check the budget again; once it has
   expired, launch nothing more, let the running agents finish, and go to stage 8
   (`SKILL.md`, "Soft budget").

2. **The late adversary.** It runs at medium and high, and at low only when
   `live/findings.md` or `live/claims.md` exists; at low it challenges only the live ids
   and the live true claims. With no late adversary, go to step 3 with the outcome
   `not-run`.

   1. Build the list of ids by script, so no id is typed into a prompt:

      ```
      mkdir -p <run dir>/tmp
      sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh late-ids <run dir> --tier <tier> --stage6 <complete|failed> > <run dir>/tmp/late-ids.txt
      ```

      `--stage6` is stage 6's status. A nonzero exit fails stage 7. The list holds, at
      medium and high, every ledger id with `origin: pass2` or `origin: topup`, every
      `### X<n>:` addition of `ledger/6.md` (`origin: second-opinion`), and, when
      stage 6 is complete, every id whose stage 6 position starts `restore requested`;
      at every tier, every `## <id>` of `live/findings.md`.

   2. Launch one fresh `audit:adversary` in late adversary mode, per `SKILL.md`, "Agent launch
      rules": the Agent tool, in the background, never a fork, `model` passed on the
      launch (the adversary role's model from a prose override, else the manifest `models`
      key, else `opus`), scope `late`, scratch folder `<run dir>/tmp/agents/7-late/`
      (`7-late-<n>/` for a relaunch). The prompt holds the paths of `audit-brief.md`,
      `common.md`, `audit-evidence.md`, `ledger/5.md`, `ledger/6.md`,
      `tmp/late-ids.txt`, and, whichever exist, `live/findings.md`, `live/claims.md`,
      each carried file `live/findings.md` names and each result copy the derived files
      cite (`live.md`, "Derivation"), for the adversary to read in full; and the output
      path `late/adversary.md`, which the agent writes itself.

   3. What the agent writes. For each listed id one block
      `### verdict on <id>: <verdict>`, the verdict one of `survives`, `downgraded`,
      `reworded`, `dropped`, with `- severity:`, `- label:`, `- evidence:` and
      `- reason:` lines, read against the stage 5 verdicts in `ledger/5.md`. A carried
      `X<n>` or `L<n>` is read from its `live/carried/<id>.md`, since the ledger may not
      hold it. Under `## Claims challenged`, one line per claim that `live/claims.md`
      derives `true, reproduced`, `upheld` or `overturned` with evidence, judged as any
      claim the report marks true (`common.md`, "Pass-two verdicts"). A defect it finds
      itself is written in the `common.md` schema as `### L<n>: <title>` with
      `origin: late`, numbered after the highest carried `L<n>` (a carried id is
      reserved); such a finding never counts on this run, since no review follows it.
      The file ends with `runs:` and `status: complete`.

   4. Check the file by script, then read only the size and the head of the output:

      ```
      sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh late-check <run dir> --tier <tier> --stage6 <complete|failed> > <run dir>/tmp/late-check.txt
      wc -l < <run dir>/tmp/late-check.txt
      head -n 50 <run dir>/tmp/late-check.txt
      ```

      It prints one `ledger: ` line per problem: a missing file, a last line other than
      `status: complete`, an end inside a fence, a malformed or duplicate heading, a bad
      verdict or finding body, a verdict for an id the list does not hold, a listed id
      with no verdict, an `L<n>` that reuses a carried id. It exits 0 with no output when
      the file is sound, 1 on a problem, 2 on a usage error. Then check by hand that each
      live true claim has its `## Claims challenged` line.

   5. Failure: an error, a nonzero exit or any line from `late-check`, a missing
      `status: complete`, or a live true claim without its line. A `_test.fail` entry
      with `role: adversary` and scope `late` or `any` applies (`SKILL.md`, "Fault
      injection"). Ladder: relaunch on the same model; then relaunch on `fable`,
      recorded as a swap; then the late scope fails. A failed scope is recorded with its
      coverage loss, every id the list holds; the late additions stay provisional, and
      the merger still runs. The outcome for the steps below is `complete` or `failed`.

3. **Write `ledger/7.md` once.** One section per challenged id, copied from the verdicts
   in `late/adversary.md`:

   ```
   ## <finding id>
   - verdict: <survives | downgraded | reworded | dropped> by audit:adversary (late, model <requested model>)
   - reason: <text>
   - evidence: <as cited>
   ```

   Then the agent's `### L<n>:` additions in the `common.md` schema with `origin: late`,
   each marked provisional. With no late adversary, the file holds the one line
   `No late adversary at low tier; late additions stay provisional.` At low with live
   files, that line comes first and the live ids' sections follow. When the late
   adversary failed, add `## Late adversary failed` with the ids it would have
   challenged, under its own heading so no finding section runs on into it.

4. **The review gate.** `gate.md` is the one source of each id's gate. Write it by script
   through a temporary file:

   ```
   mkdir -p <run dir>/tmp
   sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh gate <run dir> --tier <tier> --stage6 <complete|failed> --late <complete|failed|not-run> > <run dir>/tmp/gate.md
   ```

   Only on exit 0 run `mv -f <run dir>/tmp/gate.md <run dir>/gate.md`. A nonzero exit
   moves nothing, leaves no `gate.md`, and fails stage 7; stage 8 then recomputes the
   gates from the ledger. Remove `tmp/gate.md` when done. The script writes one line per
   id of the universe, `<id>: counts; <reason>` or `<id>: provisional; <reason>`: the
   `ledger/5.md` ids in ledger order, the `### X<n>:` ids of `ledger/6.md`, the
   `### L<n>:` ids of `ledger/7.md`, then the carried ids. A carried id is a file
   `live/carried/<id>.md` whose id `live/findings.md` lists; no other file is in the
   universe.

   A finding counts only after a fresh adversary other than its author challenged it
   and the second opinion saw it. The rows the script applies:

   | Origin | Counts when | Otherwise |
   |---|---|---|
   | `pass1`, with barrier top-up findings | a stage 5 verdict from a complete pass two, stage 6 `complete`, and at medium or above a stage 6 position | provisional |
   | `pass2`, `topup` | stage 6 `complete`, a late verdict, and at medium or above a stage 6 position | provisional; always at low unless the live rule credits it |
   | `second-opinion` (`X<n>`) | a late verdict | provisional; always at low unless the live rule credits it |
   | `late` (`L<n>`) | never, except a carried `L<n>` under the live rule | provisional |

   The severity is the state after pass two. At low or note, a complete stage 6 that
   requested the id (its acknowledgment) is enough, and the reason says
   `acknowledged`. A late verdict stands in place of the stage 5 verdict for the
   `pass2` and `topup` rows. When stage 6 failed, nothing passes on its account. A
   finding whose stage 5 scope failed has no stage 5 verdict. A `dropped` verdict is
   still a challenge; the disposition decides what follows from it.

   The live rule, checked first on every row: a finding in `live/findings.md` counts
   only when stage 6 completed with a position on it and the late adversary gave it a
   verdict, and it still needs the rest of its own row. A carried `X<n>` follows the
   `second-opinion` row plus the live rule. A carried `L<n>` counts under the live rule
   alone: by then a second opinion and a fresh adversary other than its author have
   both challenged it.

   The reasons are fixed strings, exactly as `ledger.sh gate` prints them. For a
   provisional id the first that applies wins, in this order: live, stage 6 failed,
   low tier, no stage 5 or late verdict, medium without a position.

   - `counts; stage 5 verdict, stage 6 position`
   - `counts; stage 5 verdict, stage 6 acknowledged (low or note)`
   - `counts; late verdict, stage 6 position`
   - `counts; late verdict, stage 6 acknowledged (low or note)`
   - `counts; late verdict` (an `X<n>`)
   - `counts; live review completed` (a live-listed id, and a carried `L<n>`)
   - `provisional; live result not yet reviewed`
   - `provisional; stage 6 failed`
   - `provisional; no stage 5 verdict`
   - `provisional; medium or above without a stage 6 position`
   - `provisional; late addition at low tier`
   - `provisional; no late verdict`
   - `provisional; late finding` (an `L<n>` raised on this run)

5. **Cut the slices, then choose the mode.** Add the byte sizes (`wc -c`) of
   `ledger/5.md`, `ledger/6.md`, `ledger/7.md` and, when they exist, `live/findings.md`
   and every `live/carried/<id>.md`. The threshold is 450,000 bytes, or
   `_test.ledger_split_bytes` when that is set; it sizes one merger's context, which
   the sum does not measure. When the sum is under the threshold, no slice cut from
   those files can pass it: record the sum, `not cut` as the largest slice and the
   threshold in the stage entry, and use normal mode (step 6) without building the
   slices. Otherwise assign every universe id to a group: for `pass1`, `pass2` and
   `topup` findings, the scope in the id; for `X<n>` and `L<n>` findings, carried ones
   included, the group whose files the recommended change or the evidence names, else
   `ungrouped`. Build each group's slice, `ledger/slices/<group>.md`, by shell with the
   commands of step 7, item 1; the orchestrator reads none of it. Measure each slice
   with `wc -c`. Record the sum, the largest slice and the threshold in the stage
   entry. Use split mode (step 7) when any slice is over the threshold, or when the sum
   is over three times it; otherwise remove `ledger/slices/` and use normal mode.

6. **Normal mode.** Launch one `audit:merger` by the same launch rules: the merger
   role's model from a prose override, else the manifest, else `sonnet`; scope
   `converged`; scratch folder `<run dir>/tmp/agents/7-converged/`. The prompt holds
   the paths of `audit-brief.md`, `common.md`, `ledger/5.md`, `ledger/6.md`,
   `ledger/7.md` and `gate.md`, with the instruction to take each item's gate from
   `gate.md`; `live/findings.md` and each carried file when they exist; a complete
   `converged.md` already on disk for the same ledger files, when there is one; the
   line count of each of these files, from `awk 'END { print NR }' <file>`, which also
   counts a last line with no newline; and the output path `converged.md`. The merger
   reads each of these files to its last line, in pages, and never edits them.
   It writes one item per distinct defect, in this shape, which `agents/merger.md`
   holds byte for byte because the merger never reads this file:

   ```
   ## C<n>: <title>
   - absorbs: <id>, <id>, ... (every ledger id this item takes in)
   - sources: <each id with its origin, author, and model>
   - gate: counts | provisional (the word alone, nothing after it)
   - disposition: agreed | contested | dismissed
   - severity: <the agreed severity, for agreed>
   - positions: <for contested, each reviewer's severity, label, verdict, and evidence pointer (ledger file and section)>
   - reason: <for dismissed, why it was dropped and not restored>
   - tickets: <work-item impact>
   - recommended change: <repo, path, change>
   ```

   Each item has exactly one `- absorbs:` line, its ids on one line separated by a
   comma and a space, and exactly one `- gate:` line; the check of step 8 reads both in
   those forms. Item ids are `C<n>`, the id the report, act and the claims verdicts
   use.

   The merger's rules:
   - `agreed`: the reviewers who saw the defect accept it at one severity.
     `contested`: they disagree on its existence or its severity; every position is
     kept with its evidence and no side is picked. `dismissed`: dropped and not
     restored, kept with the reason.
   - An item's gate is `counts` when any id it absorbs counts in `gate.md`. A counted
     item's severity, label and disposition come only from absorbed ids that count; a
     provisional duplicate never raises them.
   - A finding in `live/findings.md` whose `gate.md` reason is `live result not yet
     reviewed` is pending review. Every position this run's stages 6 and 7 gave on it,
     and its derivation, are listed under the item marked `pending review` and set
     none of its severity, label or disposition, even through a reviewed duplicate.
     Once its live review has completed they are ordinary positions, and the
     derivation reads `live result, approved by <who> at <time>`.
   - Ids run in ledger order and are stable once written: a relaunched merger, and the
     orchestrator's own merge, keep the ids of a complete `converged.md` for the same
     ledger files.
   - The file ends with `status: complete`.

7. **Split mode.** One `audit:merger` per group, then one final merger, over the
   slices step 5 built.

   1. Each group's slice, `ledger/slices/<group>.md`, is built by shell at step 5,
      before any merger starts; the orchestrator reads none of it, and no section
      passes through its own output. For each id of the group in id order, append,
      for each of `ledger/5.md`, `ledger/6.md` and `ledger/7.md` that has a section
      for it, a pointer line and that section; then its `live/findings.md` section and
      its carried file, when they exist, each after its pointer line; then its line of
      `gate.md`. In
      `ledger/5.md` a section is exactly `## <id>` and runs to the next `## ` line; a
      `### ` line never starts or ends one there, because each section embeds the
      finding's own heading under `### Original`. In `ledger/6.md` and `ledger/7.md` a
      section starts at a line that is exactly `## <id>` or begins `### <id>: ` and runs
      to the next `## ` line or `### <word>: ` line, `<word>` holding no space or
      colon. Every other part of a ledger file (role, acknowledgments, merge verdict,
      the seen list, map corrections, a failure note) sits under a `## ` heading that is
      not an id, which ends a section and is never cut out. Every path starts with
      `<run dir>/`; `<slice>` is the slice's full path:

      ```
      # ledger/5.md
      awk -v id=<id> '/^## /{p = ($0 == "## " id); if (p) f = 1} END{exit !f}' <run dir>/ledger/5.md &&
        printf 'source: ledger/5.md, section <id>\n' >> <slice> &&
        awk -v id=<id> '/^## /{p = ($0 == "## " id)} p' <run dir>/ledger/5.md >> <slice>
      # ledger/6.md and ledger/7.md (<n> is 6 or 7)
      awk -v id=<id> '/^## |^### [^ :]+: /{p = ($0 == "## " id || index($0, "### " id ": ") == 1); if (p) f = 1} END{exit !f}' <run dir>/ledger/<n>.md &&
        printf 'source: ledger/<n>.md, section <id>\n' >> <slice> &&
        awk -v id=<id> '/^## |^### [^ :]+: /{p = ($0 == "## " id || index($0, "### " id ": ") == 1)} p' <run dir>/ledger/<n>.md >> <slice>
      # live/findings.md, when it has a section for the id; a carried id's file whole
      awk -v id=<id> '/^## /{p = ($0 == "## " id); if (p) f = 1} END{exit !f}' <run dir>/live/findings.md &&
        printf 'source: live/findings.md, section <id>\n' >> <slice> &&
        awk -v id=<id> '/^## /{p = ($0 == "## " id)} p' <run dir>/live/findings.md >> <slice>
      [ -f <run dir>/live/carried/<id>.md ] &&
        printf 'source: live/carried/<id>.md\n' >> <slice> &&
        cat <run dir>/live/carried/<id>.md >> <slice>
      # once per id, after its sections
      awk -v id=<id> 'index($0, id ": ") == 1' <run dir>/gate.md >> <slice>
      ```

   2. A slice over the threshold of step 5 is cut into parts `<group>-1`, `<group>-2`,
      ... with slices `ledger/slices/<group>-<k>.md` and one merger each. Fill the
      parts greedily in id order: truncate `<run dir>/tmp/block.md`
      (`: > <run dir>/tmp/block.md`), build one id's block into it with the commands
      above, measure it with `wc -c`, and append it to the open part with `cat` and a
      redirect. A part closes when the next block
      would take it over the threshold, and that id opens the next part. An id whose
      block alone is over the threshold forms a part of its own, marked
      `over threshold` in a first slice line written by `printf` and in the stage
      entry. Every id lands in exactly one part, so the cut ends and is the same each
      time. Remove `tmp/block.md` when the slices are written.

   3. Launch one merger per group or part, scope `<group>` (or `<group>-<k>`), scratch
      folder `<run dir>/tmp/agents/7-<group>/`. The prompt holds the paths of
      `audit-brief.md`, `common.md`, its slice, the three ledger files "for duplicate
      checks only", the line count of `audit-brief.md`, `common.md` and the slice as in
      step 6, and the output path `converged/<group>.md` (or
      `converged/<group>-<k>.md`). It reads its slice and opens a ledger section, found
      with Grep, only to settle a suspected duplicate inside the slice, recording each
      section it opened and why under its own `opened:` heading, apart from `runs:`.
      Each item holds the defect, its sources, each position's severity and label, the
      disposition, the gate, the absorbed ids and a ledger section pointer, with no
      `C<n>` id yet, and the `absorbs` and `gate` lines in the forms of step 6. Each
      file ends with `status: complete`.

   4. Launch the final merger, scope `converged`, scratch folder
      `<run dir>/tmp/agents/7-converged/`, with the paths of `audit-brief.md`,
      `common.md`, every `converged/<group>.md` and part, `gate.md`, the ledger files
      "for duplicate checks only", the line count of each file but the ledger files as
      in step 6, and the output path `converged.md`. It assigns the `C<n>` ids, merges
      items that are one defect across groups or parts, and opens a ledger section
      only to settle such a duplicate, recorded under `opened:`. `converged.md` keeps
      the item shape of step 6.

8. **Check the merge against the ledger,** once `converged.md` exists:

   ```
   sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh check <run dir> --through 7 --tier <tier> --stage6 <complete|failed> --late <complete|failed|not-run> > <run dir>/tmp/check7.txt
   wc -l < <run dir>/tmp/check7.txt
   head -n 50 <run dir>/tmp/check7.txt
   ```

   Read only the line count and the first 50 lines. The script checks that every
   universe id sits in the `- absorbs:` list of exactly one item and no list names an
   unknown id; that each item's gate is `counts` exactly when an absorbed id counts;
   that `gate.md` equals the `gate` output; that no `C<n>` is used twice; and, when the
   late adversary completed, that `ledger/7.md` matches `late/adversary.md` and every
   id of the `late-ids` list has a `- verdict:` in `ledger/7.md`. That guards the copy
   of step 3; `late-check` guarded the agent's own file. Then check by hand:
   - no item's severity differs from its source finding's without a cited verdict that
     sets it (a pass-two `downgraded`, a stage 6 recalibration, a late verdict), and no
     severity or label follows a position marked `pending review`;
   - a counted item's severity, label and disposition follow only absorbed ids that
     count;
   - every `contested` item keeps each position with its evidence.

   Any line from the script or any failed hand check is a merger failure. Record
   `"converged_check": "pass"` or `"fail"`.

9. **Merger failure.** A merger fails when it returns an error, when its file's last
   line is not `status: complete` (such as `status: failed at <file>:<line>` for a file
   it could not read to its end), or when the check of step 8 fails. A `_test.fail`
   entry with `role: merger` and scope `any`, `converged` or the group applies.
   Ladder: the orchestrator merges itself, by step 6 or 7 (in split mode from the same
   slices), writing the same files, recorded as a swap from `audit:merger` to the
   orchestrator. It reads each input as step 2 of
   `${CLAUDE_PLUGIN_ROOT}/agents/merger.md` says: a file it reads whole to its last line,
   in pages, and a ledger file for duplicate checks only by the section Grep finds. A
   second failure, the orchestrator's merge failing the check or an input it cannot read
   to its end, fails stage 7, and stage 8 writes the report from the ledger.

10. **Stage status.** Stage 7 is `complete` when `ledger/7.md`, `gate.md` and
    `converged.md` are written and pass the check of step 8, and the late adversary,
    where it runs, succeeded. Otherwise it is `failed` and the run ends `partial`. A
    failed late scope fails the stage but does not discard a `converged.md` that passed
    the check; stage 8 uses it.

11. **Read-only check.** Run the check in `SKILL.md`, "Read-only check", and write
    `baseline/7-check.md`.

12. **Write the stage 7 entry last,** once the read-only check has passed, as
    `SKILL.md`, "State files", says: status; inputs with hashes, the live inputs by hash
    or `absent`; outputs; agents with requested model, scope, times, result and tokens
    labeled "task notification, subagent_tokens; scope not documented"; swaps; the mode
    with the byte total, the largest slice and the threshold, and each part marked
    `over threshold`;
    `converged_check`, absent when no merge was attempted; failed scopes with their
    coverage loss; and each `_test` fault applied.

Next, read `${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/8-report.md` and write the report.
