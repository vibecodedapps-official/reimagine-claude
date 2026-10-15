# Stage 6: second opinion

The orchestrator's procedure for stage 6. The preamble in
`${CLAUDE_PLUGIN_ROOT}/skills/audit/SKILL.md` (queue, budget, agent launch rules, `_test`
handling, `stages.json` writing, read-only check) and the run's `common.md` apply
throughout. The request's inputs, sentinel form, text, ask order and answer format are in
`${CLAUDE_PLUGIN_ROOT}/skills/audit/second-opinion-request.md`; this file says how to build
the request, launch the agents and check their answers. Stage 6 starts when stage 5 is
`complete` or `failed`: every scope has finished pass two and every map-correction top-up
has finished. Inputs: `ledger/5.md`, `audit-brief.md`, `common.md`, `audit-evidence.md`,
`claims.md`, every diff and stat, every `pass2/` file, and the live inputs:
`live/findings.md`, each `live/carried/<id>.md` it names, and its result copies
(`${CLAUDE_PLUGIN_ROOT}/skills/audit/live.md`, "Derivation"). Outputs:
`second-opinion/request.md`, `second-opinion/inputs/*`, `second-opinion/response.md`,
`second-opinion/batch-<k>.txt` for each batch when the mandatory set is split,
`second-opinion/request-<k>.md` and `second-opinion/response-<k>.md` for each batch `<k>`
from 2, `ledger/mandatory.txt`, and `ledger/6.md`.

## Steps

1. **Check the budget, then write the entry.** Stage 6 always runs unless the budget has
   expired; then nothing launches, the stage 6 entry is written `failed` with "not run:
   budget expired", and the run goes to stage 8. Otherwise write the stage 6 entry as
   `running` with its input hashes (`git hash-object --no-filters <file>`): `ledger/5.md`
   and each run-directory input above, and each live input by its hash or `absent` when
   it does not exist. The result copies are not hashed, as `live.md` says. A live input
   that goes from absent to present, or back, is a change that reruns the stage on
   resume.

2. **Build the request.**
   1. **Sentinel copies.** For each input the template lists that exists, write a copy
      at `second-opinion/inputs/<run-relative path>` (create the parent with `mkdir -p`)
      whose first line is `audit-sentinel: <run-relative path> <token>` and whose
      remaining bytes are the input's: `printf 'audit-sentinel: %s %s\n' <path> <token> >
      <copy>`, then `cat <input> >> <copy>`. The token is new per copy, from `od -An -N8
      -tx1 /dev/urandom | tr -d ' \n'` (16 hex characters). The originals are never
      changed, and audited sources are never copied. Keep each sentinel line, one per
      line, in `tmp/sentinels.txt`, and each path with its token for the entry's
      `sentinels` map.
   2. **The request file.** Write `second-opinion/request.md` from the template's
      `## Request` block: each input copy by absolute path, each audited source by
      absolute read path and sha from the brief, the asks in the template's order. When
      `live/carried/` holds an `X<n>`, fill ask 4 with the first free number after the
      highest carried `X<n>`; a carried id is reserved.
   3. **The mandatory set.** Run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh mandatory
      <run dir> > <run dir>/tmp/mandatory.txt` and, only on exit 0, `mv -f
      <run dir>/tmp/mandatory.txt <run dir>/ledger/mandatory.txt`. A nonzero exit fails
      stage 6. The file holds one id per line, sorted and unique: every `ledger/5.md` id
      at blocker, high or medium after pass two, every id pass two downgraded or dropped,
      and every id `live/findings.md` lists. Count it with `wc -l`; never read the ids
      into the conversation, and never type one into a file or a tool argument.
   4. **Batches.** With at most 60 ids there is one batch: its ids are the whole of
      `ledger/mandatory.txt`, and asks 1 and 2 end with `for every such finding`. With
      more, split the file in id order by shell, for example `awk 'NR % 60 == 1 { k++ }
      { print > ("<run dir>/second-opinion/batch-" k ".txt") }'
      <run dir>/ledger/mandatory.txt`, and asks 1 and 2 end with the placeholder line
      `for these ids: IDS-BATCH-<k>`.
   5. **Later batch requests.** For each batch `<k>` from 2, write
      `second-opinion/request-<k>.md`: the same inputs, acknowledgment section and answer
      format, with asks 1 and 2 only, each ending `for these ids: IDS-BATCH-<k>`. Asks 3
      to 6, the additions and the merge verdicts belong to the first batch alone.
   6. **Fill the slots by shell.** In each request file that holds a placeholder, replace
      it in place with that batch's ids: `ids=$(paste -sd, <batch file> | sed 's/,/, /g')`,
      then `awk -v p=IDS-BATCH-<k> -v ids="$ids" '{ i = index($0, p); if (i) { n++; $0 =
      substr($0, 1, i - 1) ids substr($0, i + length(p)) } print } END { exit (n == 0 ||
      ids !~ /[^ ]/) }' <request file> > <run dir>/tmp/request.new && mv -f
      <run dir>/tmp/request.new <request file>`. The awk exits 1 when no line held the
      placeholder or the ids are empty, so `mv` does not run and stage 6 fails rather
      than send a slot ending in `for these ids:`.

3. **Launch one agent per batch.** For each batch, launch a fresh `audit:adversary` with
   the Agent tool, in the background, never as a fork, `subagent_type: audit:adversary`,
   `model: fable`, or the model the manifest `models` key or a prose override sets for
   `second-opinion`. Its scope is `second-opinion` when there is one batch, else
   `second-opinion-<k>` for batch `<k>` (batch 1 included). Each gets its own scratch
   folder `<run dir>/tmp/agents/6-second-opinion/` or
   `<run dir>/tmp/agents/6-second-opinion-<k>/`, created before the launch. The prompt
   says the agent works in second-opinion mode and names by absolute path:
   `audit-brief.md`, `common.md`, `audit-evidence.md`, its request
   (`second-opinion/request.md` for batch 1, `second-opinion/request-<k>.md` from 2), its
   output file (`second-opinion/response.md` for batch 1,
   `second-opinion/response-<k>.md` from 2) and its scratch folder. It tells the agent to
   answer the request as it asks, write the answer to the output file itself, and end
   that file with `status: complete`. Launch every batch at once, within the queue cap
   (`max_agents`); a batch that does not fit waits for a free slot, and a relaunch goes
   first. The headless rule holds: never end the turn while a batch runs, since the
   turn's end ends the session; wait for each completion notification.

4. **Check each completion.** The answer file is the agent's own: it is never retyped,
   copied over or edited, and nothing is appended to it. A batch's attempt fails when:
   - the agent returned an error, or its output file is missing, or the file's last
     nonblank line is not `status: complete`;
   - an input is unacknowledged: for each line of `tmp/sentinels.txt`, `grep -qF --
     "<line>" <output file>` must succeed, and `grep -n '^ *not read:' <output file>` must
     print nothing. Write the unacknowledged lines to `tmp/unack-<k>.txt` by a shell loop
     and count them with `wc -l`. When `_test.drop_ack` names an input by its
     run-relative path, treat its acknowledgment as missing for the first `times` checks,
     counted across batches and relaunches, whatever the answer says;
   - a mandatory id of its batch has no position: run `sh
     ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh missing <run dir> > <run dir>/tmp/missing.txt`
     (a nonzero exit fails stage 6). The script scans every `second-opinion/response*.md`,
     so for one batch count `tmp/missing.txt` with `wc -l`; for batch `<k>` of several,
     run `LC_ALL=C comm -12 <run dir>/second-opinion/batch-<k>.txt
     <run dir>/tmp/missing.txt > <run dir>/tmp/missing-<k>.txt` and count that with
     `wc -l`. Never read either list into the conversation;
   - a `_test.fail` entry with role `adversary` or `second-opinion` and scope `any`,
     `second-opinion` (which matches every `second-opinion-<k>`) or this batch's scope
     marks the completion failed, as `fault-injection.md` says.

   The ladder applies to each batch on its own. On the first failed attempt, relaunch
   that batch with `model: opus` and the same prompt, scope, scratch folder and output
   file; the relaunch first moves the failed file aside with `mv -f <output file>
   <run dir>/tmp/agents/<folder>/failed-response.md`. This is a swap: record in the
   entry's `swaps` the role second opinion, the scope, from the requested model to
   `opus`, and the reason (the error, no `status: complete`, the unacknowledged inputs,
   the count of missing positions, or `_test.fail`). A second failed attempt fails stage
   6 for that batch; its answer, when it exists, stays where it is. The other batches
   still run to the end and are checked as above.

5. **Write `ledger/6.md` once,** when every batch has finished, from the answer files.
   First run `ledger.sh missing` once more into `tmp/missing.txt`; that file is the
   stage-end list of mandatory ids without a position. Each part sits under its own `## ` heading, so that a position section, which runs to
   the next `## ` line, never takes in another part. In this order:
   - `## Role`: `audit:adversary`, the requested model, the number of batches with their
     scopes, and each swap with its batch and reason.
   - `## Acknowledgments`: one line per input with its sentinel line and `acknowledged`,
     or `not acknowledged` with the batch whose answer missed it.
   - One section per finding id that an answer gives a position for:

     ```
     ## <id>
     - position: <agree | disagree | restore requested | recalibrate <from> -> <to>> <reason>
     - evidence: <the evidence the answer cites>
     - answer location: second-opinion/response[-<k>].md, <heading or line>
     ```

     Each line is nonempty, and there is one section per id. When an answer states two
     positions for one id, the last one stands; both stay in the answer file. A position
     that asks to restore a dropped finding starts `restore requested`, the only phrase
     that asks the late adversary for a verdict. A carried id with a position gets its
     section like any other.
   - `## Additions`: each `### X<n>: <title>` block from `second-opinion/response.md`,
     with `- origin: second-opinion`, copied by shell (awk from the heading to the next
     `## ` or `### ` line, or a line that is exactly `runs:`, `consumed:`, `opened:` or
     `status: complete`), never retyped. Their numbers are the
     ones the answer used, after the highest carried `X<n>`. Only the first batch has
     additions.
   - `## Merge verdict (non-binding)`: the answer's verdict per bundle, marked
     non-binding; it never replaces the report's verdict rules.
   - `## Seen, no position`: write this heading line yourself, ending with a newline,
     then run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh seen <run dir> >>
     <run dir>/ledger/6.md`, redirected and never read. The script reads `ledger/6.md`,
     so the parts above must be on disk first. It lists every `ledger/5.md` id that is
     neither mandatory nor positioned; a mandatory id is never listed there.
   - `## Stage failure`, only when stage 6 failed: the mandatory ids still without a
     position (appended by shell from `tmp/missing.txt`, never typed), the
     unacknowledged inputs with their batches, any failed shell step, and the line
     `No finding passes the review gate on stage 6's account.`

   The file is complete then and is not rewritten. Step 6 may only append to
   `## Stage failure`.

6. **Check the ledger.** When no batch failed, run `sh ${CLAUDE_PLUGIN_ROOT}/scripts/ledger.sh
   check <run dir> --through 6 --stage6 complete > <run dir>/tmp/check6.txt` and read only
   its line count (`wc -l`) and its first 50 lines (`head -n 50`). It checks one position
   per id, each position's provenance line in the answer files, the mandatory set, the
   `## Seen, no position` list and the `X<n>` additions. A nonzero exit fails stage 6:
   append `## Stage failure` with the review-gate line when it is not there yet, then the
   `ledger: ` lines from `tmp/check6.txt` by shell (`cat <run dir>/tmp/check6.txt >>
   <run dir>/ledger/6.md`), and list them in the stage entry.

7. **Completion.** Stage 6 is `complete` when every batch has an answer file ending
   `status: complete`, every input is acknowledged in every batch's answer, every
   mandatory id has a position, and `ledger/6.md` is written and passes the step 6 check.
   Otherwise it is `failed`, no finding passes the review gate on its account, and the
   run will end `partial`.

8. **Read-only check.** Run the check in `${CLAUDE_PLUGIN_ROOT}/skills/audit/SKILL.md`,
   "Read-only check", and write `baseline/6-check.md`.

9. **Write the stage 6 entry last,** once the check has passed, through a temporary file
   and `mv -f`: status, inputs, outputs, `agents` (one per launch and relaunch: type
   `audit:adversary`, requested model, scope, start, end, tokens labeled "task
   notification, subagent_tokens; scope not documented", duration, result), `swaps` with
   reasons, each `_test` fault applied, and these keys:

   ```json
   "sentinels": { "ledger/5.md": "<token>", "claims.md": "<token>" },
   "missing_positions": [],
   "batched": false
   ```

   `sentinels` maps each input's run-relative path to its token. `missing_positions`
   lists the mandatory ids still without a position at stage end, written from
   `tmp/missing.txt` by shell. `batched` is true when more than one batch was launched,
   else false. A failed stage also lists its unacknowledged inputs and `ledger: ` lines.

Next, read `${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/7-converge.md`.
