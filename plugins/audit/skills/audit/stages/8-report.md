# Stage 8: report

Stage 8 always runs, after stage 7 or after any failed stage or expired budget, and the
orchestrator writes it alone. It does not run when the run is `blocked`: then no report
is written, the reason is printed, and every finished stage file stays on disk. The rules
in `${CLAUDE_PLUGIN_ROOT}/skills/audit/SKILL.md` and the run's `common.md` hold. The
report's headings and layout are in `${CLAUDE_PLUGIN_ROOT}/skills/audit/report.md`; this
file says where each part comes from and how the verdict is decided. Inputs:
`converged.md`, `gate.md`, `ledger/5.md`, `ledger/6.md`, `ledger/7.md`, the `pass1/` and
`pass2/` files, `claims.md`, `audit-brief.md`, `manifest.json`, `stages.json`,
`usage.md`, `baseline/*-check.md`, `late/adversary.md`, and the live files
`live/findings.md`, `live/claims.md` and each `live/carried/<id>.md`, whichever exist.
The results files `live/results-<k>.md` that the derived files cite are read for each
result's text, approver and time; a `result_file` result's text is its copy
`live/results-<k>/<line>.txt`, hashed in `live/results-<k>/SHA256SUMS`. Outputs:
`report.md`, `work-items.jsonl` and `claims-verdicts.md`, with the format of
`work-items.jsonl` in `${CLAUDE_PLUGIN_ROOT}/skills/audit/work-items.md` and the format of
`claims-verdicts.md` at the end of this file.

## Steps

1. **Write the stage 8 entry as `running`.** Record the input hashes with
   `git hash-object --no-filters`: `converged.md`, `gate.md`, the ledger files,
   `claims.md`, `audit-brief.md`, `manifest.json`, `late/adversary.md`, the live files,
   and each `pass1/` and `pass2/` file read, whichever exist, a live file that does not
   exist as `absent` (`${CLAUDE_PLUGIN_ROOT}/skills/audit/live.md`). `stages.json` and
   `usage.md` are run state: they are read and not hashed, since this stage writes its
   own entry into `stages.json`. The results files never change and are not hashed.

2. **Pick the source of items,** the first that applies:
   1. `converged.md`, when it exists and the stage 7 entry records
      `"converged_check": "pass"`, whatever stage 7's status: a failed late adversary
      does not discard a checked merge. Its items, gates and dispositions are used as
      they stand.
   2. Else the ledger, when `ledger/5.md` exists and the stage 5 entry does not record
      `"ledger_build": "failed"`. One item per ledger finding, in the state after its
      last verdict in `ledger/5.md` and `ledger/6.md`; a `no verdict: ...` state,
      `output failed` included, earns no credit. `ledger/7.md` verdicts are not
      applied, since this path runs only when no merge passed stage 7's check, so they
      are unchecked. `gate.md` is never reused here: it may predate the failed check.
      Recompute every gate:

      ```
      sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh gate <run dir> --tier <tier> --stage6 <stage 6 status> --late failed > <run dir>/tmp/gate-report.md
      ```

      With `--late failed` no late verdict is credited, so every `P`, `T` and `X`
      finding is provisional, and the report's limits say why; stage 6 credit stands,
      since stage 6 is `complete` only after its own check passed. When the script
      exits nonzero (its `ledger: ` lines go to stderr) or a ledger file it needs is
      missing, compute the gates by hand from the ledger files present under the rules
      of `${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/7-converge.md`, step 4, and name the
      script failure in the report's limits. Add every carried finding
      (`live/carried/<id>.md` whose id `live/findings.md` lists), one item per id,
      joined with its positions in `ledger/6.md` and, marked unchecked, `ledger/7.md`,
      and gated by the live rule. A position on a finding whose live review has not
      completed is `pending review`: listed under the item, it never sets the
      severity, label or disposition. Disposition: `dismissed` when the last verdict is
      `dropped` and no one asked to restore it; `contested` when verdicts disagree on
      existence or severity; else `agreed`.
   3. Else the `pass1/` and `pass2/` files: one item per finding, every one
      `provisional`, with whatever pass-two verdicts exist, and the carried findings
      added as in path 2.

   In paths 2 and 3, stage 8 assigns `C<n>` ids itself, in ledger order (file order for
   path 3), each item naming its finding id as absorbed, so every reported item can be
   given to `/audit:act`. Remove `tmp/gate-report.md` once read.

   Then apply the `REVIEW.md` rules `audit-brief.md` records, on every path, each to the
   items in the files its copy governs. The orchestrator judges whether an item falls
   under a rule, from its title, question, evidence and files, and names the rule's
   `<path>:<line>` under every item it touches. In this order:
   1. Do not report: an item the rule covers is skipped. It leaves the body (sections 2
      to 7 and 9, the counts, the verdict and the `next:` block), never counts, and
      `work-items.jsonl` drops it from every operation, and an operation left with no
      item. A claim whose verdict rests on it keeps its verdict and cites its evidence,
      not its id. Each such rule gets one line in section 2,
      `<n> findings skipped by REVIEW.md: <rule>`, `<n>` the items it skipped, `0`
      included, and `<rule>` the rule as quoted with its `(<path>:<line>)`. An item two
      rules cover is counted in the first one's line.
   2. Require evidence: an item of the rule's class that does not meet it (`common.md`,
      "When a finding counts") is held: the report shows its gate as `provisional`, with
      the gate it had and `held by REVIEW.md: <rule>`, and it never counts. An item
      that meets it says `REVIEW.md evidence met: <rule>`.
   3. Severity calibration: the rule sets the severity of each item it covers, and of
      each position of a contested one, before step 4 counts. The item shows the
      calibrated severity and `reviewed <severity>, set by REVIEW.md: <rule>`, also
      when they are equal. A calibration never lifts a severity over the `medium` cap
      of an `unverified assumption`.

3. **Decide the terminal state** from stages 1 to 7; stage 8's own entry is `running`.
   The state is `reported` when every applicable stage 1 to 7 entry is `complete` or
   `not_applicable`, and `partial` when any of them failed, is `running` or missing, or
   the budget expired (`SKILL.md`, "Terminal states"). It is final only once step 12
   writes stage 8 `complete`; a failed read-only check in step 11 makes the run
   `blocked`.

4. **Count before deciding.** An item counts only when its gate is `counts` and no
   `REVIEW.md` rule skips or holds it (step 2). Its counted severity, after calibration:
   - `agreed`: its severity.
   - `contested` with two positions: equal severities count at that severity; with one
     position `dropped`, the item counts only when the keeping position's label is
     `verified fact`, at that position's severity, and otherwise does not count; else
     the higher severity counts when the higher position's label is `verified fact`,
     and the lower one when it is not.
   - `contested` with more than two positions: when the highest position's label is
     `verified fact`, the item counts at the highest severity; otherwise apply the
     two-position rule to the highest and the lowest positions.
   - `dismissed`: never counts.
   - `provisional`: never counts, whatever its disposition.

   A label of `unverified assumption` caps a severity at `medium` (`common.md`,
   "Finding schema"). The report shows the counts so a reader can check the verdict.

5. **Decide the verdict.**
   - A `partial` run: `audit incomplete`, with the counts so far; never `ready to
     merge`.
   - Any counted item at `blocker` or `high`: `not ready`.
   - Else any counted item at `medium`: `merge after fixes`.
   - Else `ready to merge`.

   The verdict line gives the verdict, the counts by severity, the provisional,
   contested and dismissed counts, in the form `report.md` fixes.

6. **Fill the body** in the order of `report.md`. The first line is
   `# audit report: <run-id>`. The header under it carries what a reader needs to find
   the record when nothing else was shown, as in a headless session: the run id, the
   absolute run directory, the manifest path, the terminal state, and the resume
   command `/audit:resume <run-id>`, with the tier and the bundles as `report.md` lays
   them out, and the `REVIEW.md:` line from the brief. Outside the Coverage and Usage
   sections, which are run records, the report names no model, agent type or tool: a
   position is named by its review (pass one, pass two, second opinion, late review),
   never by what produced it. The twelve sections:
   1. **Verdict**, from steps 4 and 5, then the `next:` block of step 14.
   2. **Findings by ticket**, severity first. Each item sits under a heading
      `#### C<n>: <title>`, which the work-items validator reads, with its evidence,
      gate, disposition and absorbed ids. A `provisional` item says which review it
      still lacks, from its `gate.md` reason, or from the recomputed gate in path 2,
      or that a `REVIEW.md` rule holds it. Then the skip lines of step 2.
   3. **Verified as sound**: every Verified OK item of the pass-one reports, marked
      `challenged` when a pass-two `## Verified OK challenged` list names it, else
      `not challenged`. At low tier every one is `not challenged`.
   4. **Disagreements kept**: every `contested` item with each position and its
      evidence, no side picked.
   5. **Recommended next steps**: the ordered plan of step 14.
   6. **Code fixes**, by repository and file, with item ids.
   7. **Work-item fixes**: the ticket text to change, drafted, naming no model, agent
      or tool; then each operation of `work-items.jsonl` with its `W<n>` id, op,
      target, the item ids it covers and its reason. The operations are decided here
      and numbered from `W1` in order, so step 7 writes the same list with the same
      ids.
   8. **Decisions**, in three parts. Decision and scope entries are report entries,
      not findings: they get no `C<n>`, enter no ledger and change no count; a finding
      an entry names in its `finding:` field is in section 2 like any other.
      1. Decision ledger: each `decision` claim with its class (`stale deferral`,
         `needs <owner>`, `default taken`, `evidenced`), its resolution, authority and
         evidence from the pass-one `## Decisions` entry, its reversibility class, the
         recommendation and the owner, then the auditor's position and the
         adversary's from `## Decisions challenged`, or `not challenged` when that
         list has no line for it. When the two differ both stay. A claim the stage 4
         entry records as `not assessed` is listed with that mark alone.
      2. Raised tickets: each `scope` claim with the fields of the pass-one `## Scope`
         entry (introduced by the bundle, fix inside the bundle's repositories, cost,
         recommendation, the handoff's ranking, whether facts or recommendation
         differ from the handoff) and the adversary's position from
         `## Scope challenged`, or `not challenged`. A `not assessed` scope claim is
         listed with that mark alone.
      3. Other decisions: each decision the change made or needs that is not a
         `decision` claim, with recommendation, reason and reversibility class
         (`reversible`, `hard to reverse`, `contract change`); an owner only for the
         last two and only when the tickets name one, else `owner not recorded`.
   9. **Live checks**: one block per check, in the form of `live.md`, "The report's
      Live checks blocks": `#### live <finding id>` for a finding, `#### live claim <n>`
      for an environment claim. Each `status` comes from `live/findings.md`,
      `live/claims.md`, the results files they cite and the `live` approvals in
      `stages.json`: `not run: not approved`, or a run result with its approver, time,
      derivation and review state, `under review` while its `gate.md` reason is
      `live result not yet reviewed`. A result kept as a file is cited by its copy and
      the hash from `SHA256SUMS`, and so is each result a newer one outranks. Every
      result shown is logged as an access with its approver and time. Results come back through
      `/audit:resume <run-id> --live <file>`.
   10. **Claims**: every numbered claim of `claims.md` with its kind, its verdict and
       the finding or evidence, from the pass-one Claims lists as revised by later
       verdicts. A `verification` claim is `true, reproduced` only when the audit
       reproduced the stated result itself, `false, contradicted` only with
       counter-evidence, else `not verified, not reproduced` with the reason. A claim
       no list covers, or one the stage 4 entry records as `not assessed`, is
       `not verified`, the reason `not assessed` for the latter. A claim a
       `## Claims challenged` line overturned shows both verdicts and is `contested`.
       A live claim takes its derived verdict: `true, reproduced` stays when the late
       adversary's line in `late/adversary.md` is `upheld`, becomes `contested` when it
       is `overturned`, and becomes `not verified, not reproduced`, reason `live result
       not challenged`, when there is no line. An environment claim with no live
       result stays `not verified, not reproduced`, reason `needs a live check: env
       <name>` (`common.md`, "Claim kinds"). Say once here that reproducing a stated
       result does not show that the build session ran its stated check.
   11. **Coverage**, a run record, from `stages.json`, `audit-brief.md` and the check
       files:
       - each handoff claims file with its path, hash and whether `handoff.sh check`
         validated it, from the brief;
       - the `work-items.sh` result, filled in at step 8;
       - each stage run, not applicable, failed or swapped, and why; every swap by
         name, with the requested model of each agent, written as "requested", never
         "used";
       - at low tier, that one auditor covered the ticket, the tests and work-item
         hygiene;
       - failed scopes and scopes not run because the budget expired, with the last
         byte offset of a digest that ended `status: failed at byte <offset>`;
       - each `decision` or `scope` claim recorded `not assessed`, and each entry
         `not challenged` because pass two wrote no line for it;
       - each line of the stage 5 entry's `brief_errata`, as the adversaries wrote it;
       - the outward trace, from the `pass1/` and `pass2/` files and the stage 4 and 5
         entries, so it shows even when pass two failed: each scope recorded
         `outward trace: not assessed`; each `not traced:` symbol; each entry with
         result `incomplete`; each entry cut to `(<k> of <n> checked)` with its
         `not listed:` locations; each `outward trace:` line of a pass-two
         `## Coverage gaps`; and the number of entries `not challenged`. A symbol on
         two lists shows once. None of these fails a scope or changes a count;
       - each bundle whose base refresh was declined (the brief's `base: local ref,
         refresh declined` line);
       - each `head: working-tree` bundle: the loose objects `working-tree.sh build`
         wrote to the object store, that the head commit has no ref and may be pruned
         by `git gc`, the files untracked and the paths flagged at audit time, and
         that a flagged path is held at its index version, so a change to it during
         the run may escape the read-only check;
       - stage 6: whether the mandatory ids went out in batches (`batched`), each
         sentinel acknowledgment that failed (`sentinels`), every mandatory id left
         without a position (`missing_positions`), and each batch relaunched on
         `opus` or failed;
       - every file stage 2 split by byte range (`split_files`): source, path, size,
         each range and the chunk id that covered it, with that chunk's status;
       - unanswered questions and departures from the stage plan;
       - map corrections not applied, from `ledger/5.md`;
       - when exports were used, that the forge was not queried;
       - the ignored-file differences each read-only check accepted, and what the check
         does not detect: an ignored file replaced at the same size with a restored
         modification time; changes inside `.git/` other than refs, stashes and
         config; a nested repository's changes other than its HEAD, stashes or
         config; changes inside a repository in an ignored directory, such as a
         linked worktree, other than a top-level entry added or removed; and changes
         outside the audited repositories. When a `baseline/<stage>-check.md` holds
         `note mtime precision: seconds`, say the comparison used whole seconds, so a
         same-size rewrite within one second went unseen;
       - the manifest's `_test` key, when present.
   12. **Usage**, a run record, per stage from `usage.md` and the stage entries:
       agents run with their requested models, wall-clock time, and tokens, each
       labeled "task notification, subagent_tokens; scope not documented", the stage
       6 agents included like any other. No total is presented as exact.

   Write the body to `<run dir>/report.body.tmp` with the Write tool, not yet to
   `report.md` and never by a shell heredoc or `printf`: a body carried in a command's
   text passes the process argument cap, and the write fails. Only the revision line
   and the assembly of `report.md` in step 9 run by shell. Coverage is filled in two
   passes: everything but the `work-items.sh` result now, that result at step 8.

7. **Write `work-items.jsonl`** in the run directory from the operations of section 7,
   one JSON object per line, in the format of `work-items.md`. With no operations the
   file is written empty. The file is a draft for an adapter; nothing in the audit or in
   act applies it.

8. **Validate it** from the run directory, with `${CLAUDE_PLUGIN_ROOT}` resolved:

   ```
   sh ${CLAUDE_PLUGIN_ROOT}/scripts/work-items.sh check work-items.jsonl report.body.tmp claims.md
   ```

   Put the result in the Coverage section of `report.body.tmp`, a text change that
   touches no item:
   - exit 0: `work-items: ok`;
   - exit 1: the file is kept, every `work-items <file>:<line>: <message>` line is
     listed, and the file is marked not ready for an adapter;
   - exit 2: the file is kept, and Coverage says it was not validated, with the
     script's message (`work-items: jq not found` when `jq` is missing).

   Nothing in the report changes to satisfy the validator; a mismatch is reported, not
   hidden.

9. **The revision line.** Hash the exact bytes of `report.body.tmp` and assemble
   `report.md` by shell redirect, so no byte is serialized again. Use absolute paths
   and no `cd`. Stop, writing no `report.md`, unless `hex` is exactly 64 lowercase
   hexadecimal characters:

   ```
   hex=$( (sha256sum "<run dir>/report.body.tmp" 2>/dev/null || shasum -a 256 "<run dir>/report.body.tmp") | cut -d' ' -f1)
   case $hex in ''|*[!0-9a-f]*) printf 'no sha-256 hex: %s\n' "$hex" >&2; exit 1 ;; esac
   [ ${#hex} -eq 64 ] || { printf 'no sha-256 hex: %s\n' "$hex" >&2; exit 1; }
   { printf 'revision: sha256:%s\n' "$hex"; cat "<run dir>/report.body.tmp"; } > "<run dir>/report.md"
   ```

   The Write tool never writes `report.md`, and nothing edits it after this step. The
   revision is the SHA-256 of every byte after the first LF; act recomputes it with
   `tail -n +2 report.md | { sha256sum 2>/dev/null || shasum -a 256; }`. Remove
   `report.body.tmp`.

10. **Write `claims-verdicts.md`** in the format below, with the revision `<hex>` of
    step 9. It is written with the Write tool and not hashed.

11. **Read-only check.** Run the check in `SKILL.md`, "Read-only check", and write
    `baseline/8-check.md`. When it fails the run is `blocked`: the report stays on disk,
    and step 14 prints the reason and `blocked` in place of a verdict.

12. **Write the stage 8 entry last,** once the check has passed, as `SKILL.md`, "State
    files", says: status `complete`, the input hashes of step 1, and the outputs
    `["report.md", "claims-verdicts.md", "work-items.jsonl"]`.

13. **Update `${CLAUDE_PLUGIN_DATA}/runs.json`:** set this run's `state` to the terminal
    state under the lock, as `SKILL.md`, "State files", says. On a refusal or a failure,
    go on by that section's cases: a missing entry, a stale state, or a correct registry
    with a leftover lock.

14. **Print and stop,** in plain words: the verdict as a sentence, the absolute path of
    `report.md`, and the terminal state. For `partial`, say that
    `/audit:resume <run-id>` finishes the missing work and print it, when the run's
    entry is in `runs.json`. When the entry is absent, whatever the state, print the
    JSON entry and the resolved registry path for adding by hand, as `SKILL.md`, "State
    files", says, in place of a bare resume command, and say that the `/audit:act` and
    `--live` lines need the entry first. Then print the closing lines, the same ones the
    report's `next:` block holds, computed from the report just written:
    - `act first: <ids, each with one short reason, or none>`. An item is listed when
      it counts, its disposition is `agreed`, its severity is `blocker`, `high` or
      `medium`, and its recommended change lies inside the bundle's repositories;
      ordered by severity, then id. A `low` or `note` item stays in the report and may
      still be given to act; one clause says that leaving it off this line dismisses
      nothing.
    - The ordered plan of section 5: two to five numbered steps, each one plain line
      starting `1. `, `2. ` and so on, with a reason clause, covering what to fix
      before merge, what to check live, and what to record for later. It names which
      contested or decision items it takes and why; a decision entry is named in
      words, never with an invented `C<n>`.
    - `/audit:act <run-id> <ids>`: the `act first` ids in that order, and only report
      items `C<n>`; omitted when none are listed. A decision or scope entry has no
      `C<n>` and never appears, and a `W<n>` operation is not an act argument. With no
      registry entry the line is still printed, since act takes the run id, with the
      note that act stops at its first step until the entry is added.
    - `recommended: /audit:act <run-id> <ids>`, only when its ids differ from the strict
      line: the strict ids in order, then the contested `C<n>` items the orchestrator
      would take that are fixable inside the bundle's repositories, by severity and id,
      each addition with a line `reason: <id>: <reason>`. It may stand alone when the
      strict list is empty. The added items stay `contested` and stay under
      `your decision`; the user chooses.
    - `your decision: <list, or none>`: each `contested` or `provisional` item with what
      it lacks; each item whose recommended change lies outside the bundle's
      repositories; and, from section 8, each entry open for the user's authority with
      the decision needed: decision claims of class `needs <owner>` or
      `stale deferral`, every scope claim with its `include` or `defer`
      recommendation, and each other decision the change needs and has not made.
      Entries the change already settled (`evidenced`, `default taken`, made
      decisions) stay in the report and are not listed.
    - `/audit:resume <run-id> --live <file>`, only when a Live checks block has
      `status` `not run: not approved` and resume would accept the import: the rerun
      stage it would compute is none or 6 or later, which here means every stage 1 to 5
      entry is `complete` or `not_applicable` with every listed output present
      (`${CLAUDE_PLUGIN_ROOT}/skills/audit/resume.md`). A `partial` run that fails this
      gets the plain `/audit:resume <run-id>` line only, since `--live` would be
      refused. With the line, say that the file holds one `## <id>` section per check
      run, with its result lines (`live.md`, "The --live file"), and that resume
      refuses the import once a bundle's recorded head or base stops matching, so the
      import comes before committing or pushing on the audited branch. A result
      already imported and `under review` needs no `--live`: plain
      `/audit:resume <run-id>` reconciles it, and the closing says so when that is the
      only open state.

    Nothing runs after this; `/audit:act` is a separate command.

## `claims-verdicts.md`

The return trip to the build session, written at step 10 from the report's Claims
section and the claims files, in this format:

```
# Claims verdicts: <run-id>

report revision: sha256:<hex>
generated: <time>

Apply a line only when its file hash and claim text match what you hold. `false` lines
are corrections: the statement is contradicted by the cited evidence. `not verified` lines
on verification claims are recheck requests: the audit could not reproduce the check, which
is not evidence the statement is wrong. `not reproducible here` lines are not recheck
requests: the check ran against an environment the audit cannot reach, so run it against
that environment and feed the result back with `/audit:resume <run-id> --live <file>`.
`contested` lines need a person to decide.

## <claims file absolute path> (handoff | prose), hash <git hash-object --no-filters>

- claim <n> [<kind>] <source file>:<line> <handoff ref or ->: <true | false | not verified | not reproducible here | contested>; finding: <C<n>, ... or none>; evidence: <pointer>
  ticket: <the claim's ticket id, or none>
  text: <the claim's text as in claims.md>
  correction: <text or none>
```

- The title, the two header lines and the paragraph are written as shown.
- One entry per `claim` line of `claims.md`: a main line, then three sub-lines indented
  two spaces, `ticket:`, `text:` and `correction:`, each holding the whole rest of its
  line, so a text or a correction may contain `; `. Entries are grouped by claims file
  in claim order. The file hash is the one stage 1 recorded for that claims file in its
  entry's `inputs`, so it names the bytes the audit read. `other` sentences are not
  listed.
- `ticket` is the ticket the claim is about: for a handoff claim, the ticket field
  `handoff.sh claims` printed; for a prose claim, the ticket stage 1 tagged it with, an
  export written as its `id`; else `none`.
- `(handoff)` marks a file `handoff.sh detect` accepted, else `(prose)`. The handoff ref
  is the one in the claim line, or `-` for a prose claim.
- `not reproducible here` is the verdict of an environment claim that no live result
  has settled; one with a live result takes the verdict of the report's Claims section
  like any other.
- `contested` marks a claim whose auditor and adversary verdicts differ; the report's
  Claims section gives both. Otherwise the verdict is the report's. For a
  `verification` claim, `true` means reproduced and not overturned.
- `correction` is the corrected text for a `false` line, drawn from the cited evidence,
  and `none` for every other verdict. It names no model, agent or tool.
- `evidence` points to the report item `C<n>` or to the evidence the verdict rests on.

The run ends here. `SKILL.md`, "Stage order and control flow", holds what follows: the
run is over, and `/audit:act` or `/audit:resume` each start a new invocation.
