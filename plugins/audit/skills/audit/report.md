# Report template

Stage 8 fills this template into `<run dir>/report.md` from what is on disk:
`converged.md`, the ledger files, the `pass1/` and `pass2/` files, `claims.md`,
`stages.json`, `usage.md` and the live files. Everything between `<` and `>` is filled
in, and every section is present, with `none` when it is empty. Finding and item shapes
are those of `common.md`. `${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/8-report.md` says
where each part comes from and how the counts and the verdict are computed; this file
fixes the layout.

The items come from `converged.md` when its check passed (the stage 7 entry records
`"converged_check": "pass"`), else from the ledger files with every gate recomputed by
`ledger.sh gate`, else from the pass-one and pass-two files with every item
`provisional`. Beside the report, stage 8 writes `work-items.jsonl` (format in
`${CLAUDE_PLUGIN_ROOT}/skills/audit/work-items.md`), validated by `work-items.sh check`
and never applied, and `claims-verdicts.md`, the verdicts returned to the build session
(format in `stages/8-report.md`).

Outside sections 11 (Coverage) and 12 (Usage), which are run records, the report names no
model, agent type or tool: a position is named by its review (pass one, pass two, second
opinion, late review), never by what produced it.

## Revision line

The report's first line is its revision:

```
revision: sha256:<hex>
```

`<hex>` is the SHA-256 of every byte below that line, as written. The body is written
first, hashed with `sha256sum` or `shasum -a 256`, and the file assembled by shell
redirect from the revision line and the body, so no byte is serialized again; nothing
edits the file afterwards. `/audit:act` binds its approval to this line and `live.sh`
binds a `--live` file to it. A resume that writes a new report gives it a new revision,
which voids every act approval given against a different revision.

## Partial and blocked runs

- When a stage failed or the budget expired, the report is still written from what is
  on disk, by the item sources above. Every finding that has not passed the review gate
  is marked `provisional`. The verdict is `audit incomplete`, with the counts so far,
  never `ready to merge`, and the terminal state is `partial`.
- When no report can be written, or a read-only check failed, the run is `blocked`: this
  template is not used, and the reason is printed.

## Body

```
# audit report: <run-id>

run: <run-id> | terminal state: <reported | partial>
run directory: <absolute path of the run directory>
manifest: <absolute path of <run dir>/manifest.json> (source: <the manifest file given, or prose inputs>)
resume: /audit:resume <run-id>
tier: <tier> (<reason>)
bundles: <bundle> <repo> <head sha> against <base> <base sha> (merge-base <sha>), ...
REVIEW.md: <bundle> <path> at <base sha>, ... | <bundle> none applied at the base | not read[; head-only REVIEW.md not applied: <bundle> <path>, ...][; head change not applied: <bundle> <path>, ...]
generated: <time>
```

The header carries everything a reader needs to find the record when nothing else was
shown, as in a headless session: the run id, the run directory, the manifest path, the
terminal state and the resume command. For a `head: working-tree` bundle, `<head sha>` is
followed by `(working tree on <parent sha>)`, the built commit and the `HEAD` it sits on.
The `REVIEW.md:` line names each copy applied, read at the bundle's base, or says none
applied there, or `not read` when `sources_of_truth` replaced the default rank; a copy
only the head holds, or changes, is named as not applied.

### 1. Verdict

`not ready` when a counted item is `blocker` or `high`; else `merge after fixes` when a
counted item is `medium`; else `ready to merge`. A `partial` run says `audit incomplete`.
The counts come first, then the verdict, then the rule that decided it, so a reader can
check it.

Counts table: for each severity (blocker, high, medium, low, note), the number of items
by gate (`counts`, `provisional`) and by disposition (`agreed`, `contested`,
`dismissed`). A contested item counts at the severity the counting rule gives: equal
severities at that severity; with one `dropped` position only when the keeping position
is `verified fact`; otherwise the higher severity when its position is `verified fact`,
else the lower. `provisional` and `dismissed` items never count. Severities are those
after a `REVIEW.md` calibration, an item a `REVIEW.md` rule holds is `provisional`, and an
item one skips is in no count (`stages/8-report.md`, step 2).

The verdict line reads:

`verdict: <verdict> | counted: <n> blocker, <n> high, <n> medium, <n> low, <n> note | provisional: <n> | contested: <n> | dismissed: <n>`

After the verdict line, a plain line `next:` heads the closing lines that stage 8 prints
at its end, the same lines here and there: `act first:`, the ordered plan of section 5
(two to five numbered steps, each with a reason clause), the `/audit:act <run-id> <ids>`
line, the `recommended: /audit:act` line with its `reason:` lines only when its ids
differ, `your decision:`, and the `/audit:resume <run-id> --live <file>` line when the
run is eligible for one. The plan names the contested and decision items it takes and
why; contested items keep their status and the user chooses. Decision entries stay off
both act lines. Each labeled line starts with its label; each plan step is one plain line
starting `1. `, `2. ` and so on, with no heading or nested item block. No line of the
block starts with `#### C`, `- claim ` or `#### live `, which `work-items.sh`,
`memory.sh` and `live.sh` parse, and the block adds no `###` or `####` heading. It is
part of the body the revision hashes, written from the report's own content and the
stage entries. When the run has no entry in `runs.json`, the closing says that the
`/audit:act` and `--live` lines need the entry added first.

### 2. Findings by ticket

Per ticket, then `unticketed`, then `cross-cutting`, items severity first. Each item sits
under a heading `#### C<n>: <title>`, which the work-items validator reads. Under it:
the effective severity, gate, disposition, absorbed ledger ids, the evidence as cited in
the ledger, what breaks and for whom, and the item's state after each review (pass-two
verdict, second opinion, late review). A provisional item is marked `provisional` and
says which review it still lacks, or `held by REVIEW.md: <rule>` beside the gate it
had. Under each item a `REVIEW.md` rule touches, the rule with its `<path>:<line>`: a
calibrated severity with `reviewed <severity>, set by REVIEW.md: <rule>`, and
`REVIEW.md evidence met: <rule>` for an item that meets a require-evidence rule.

After the items, one line per `REVIEW.md` do-not-report rule, `0` included, the items it
removed from every section of the body:

`<n> findings skipped by REVIEW.md: <rule>`

### 3. Verified as sound

Every Verified OK item of pass one, marked `challenged` or `not challenged` by the tier's
pass-two rule: none at low, up to five per report at medium, all at high. A challenged
item that failed its challenge moves to section 2 as the finding it became and is noted
here.

### 4. Disagreements kept

Every `contested` item: each position with its review, severity, label and evidence,
and the severity the counting rule counted it at. No side is picked.

### 5. Recommended next steps

Ordered: what to fix before merge, what to check live, what to record for later work.
The two to five numbered steps with their reasons, the same as in `next:` and the
closing, naming the contested or decision items the plan takes and why.

### 6. Code fixes

By repository, then file: each change, with the item ids it resolves.

### 7. Work-item fixes

Per ticket: the ticket text to change, drafted, with the item ids. Drafted text names no
model, agent or tool.

Then each operation of `work-items.jsonl`, one line each: its `W<n>` id, the op, the
target, the item ids it covers and its reason. These are drafts for a person or an
adapter; act applies none of them.

### 8. Decisions

Three parts.

- Decision ledger: each `decision` claim with its class (`stale deferral`,
  `needs <owner>`, `default taken` or `evidenced`), resolution, authority, whether
  alternatives were weighed, reversibility class, the recommendation and the owner. The
  auditor's position and the adversary's follow, or `not challenged` when pass two wrote
  no line for the entry; when they differ both are kept and no side is picked. A claim
  that is `not assessed` is listed with that mark only.
- Raised tickets: each `scope` claim with whether the bundle introduced it, whether the
  fix lies inside the bundle's repositories, cost, the recommendation (`include` or
  `defer`) and its reason, the handoff's ranking, and whether the facts and the
  recommendation differ from the handoff, each stated on its own. The adversary's
  position follows, or `not challenged`. A `scope` claim that is `not assessed` is
  listed with that mark only.
- Other decisions: each decision the change made or needs that is not a `decision`
  claim, with the recommendation, the reason and a reversibility class (`reversible`,
  `hard to reverse` or `contract change`). A named owner, from the tickets only, for
  `hard to reverse` and `contract change`; otherwise "owner not recorded". Act posts a
  decision to its ticket as a drafted comment only when the user says so for that item.

Decision and scope entries are report entries, not findings: they get no item id, never
enter a ledger and never change the counts.

### 9. Live checks

One block per live check: each finding with a live check, and each environment claim,
keyed by claim number, in the form of `${CLAUDE_PLUGIN_ROOT}/skills/audit/live.md`, "The
report's Live checks blocks":

```
#### live <finding id> | live claim <n>
- item: C<n> | claim <n>
- query: <the query or command, exactly as the check states it>
- where: <where it runs>                  (finding)
- env: <name>                             (env claim)
- results: <what each result changes>     (finding)
- status: not run: not approved | run, approved by <who> at <time>: <result>; derived: <derived>; <reviewed | under review: <what it lacks>>
```

For a result kept as a file, `<result>` is `in live/results-<k>/<line>.txt, sha256:<hex>`,
the copy and its hash from `SHA256SUMS`. A result returns through
`/audit:resume <run-id> --live <file>`. Every approved live access is logged here, each
result with its approver and time. `none` when no finding has a live check and no claim
is an environment claim.

### 10. Claims

Every numbered claim of `claims.md` with its kind (`code`, `decision`, `verification`,
`scope` or `status`), then `true`, `false` or `not verified`, and the item id or the
evidence. `other` sentences are counted, not listed. A `decision` or `scope` claim with
no pass-one entry is `not verified`, reason `not assessed`.

A `verification` claim is `true, reproduced` only when the audit reproduced the stated
result itself, `false, contradicted` only with counter-evidence, and otherwise
`not verified, not reproduced` with the reason. An environment claim always needs a live
check: without a result it is `not verified, not reproduced`, reason
`needs a live check: env <name>`. A claim with a live result takes its derived verdict,
`contested` when the late review overturned it, or `not verified, not reproduced` when
the late review gave no line. One line says that reproducing a stated result does not
show that the build session ran its stated check. Where the auditor's and the
adversary's verdicts differ, both are shown and the claim is `contested`.

`claims-verdicts.md`, beside this report, carries these verdicts back to the build
session, where `/audit:handoff --verdicts` applies the ones whose file hash and claim
text still match.

### 11. Coverage

A run record.

- Handoffs: each handoff claims file, its hash, and whether `handoff.sh check`
  validated it.
- Work items: the `work-items.sh check` result for `work-items.jsonl`: `work-items: ok`;
  or the error lines and that the file is not ready for an adapter; or that it was not
  validated, and why.
- Stages: each stage 1 to 8 as `complete`, `not applicable`, `failed`, `swapped` or
  `not run: budget expired`, with the reason.
- Swaps: every swap, with stage, role, scope, the requested model it left, the requested
  model it went to, and the reason.
- Failed scopes and the files, rules or questions they left unreviewed, with the last
  byte offset of a digest that ended `status: failed at byte <offset>`.
- Each `decision` or `scope` claim that is `not assessed` (the pass-one report has no
  entry for it), and each entry `not challenged` because pass two wrote no line for it.
  Neither fails a scope or changes a count.
- Outward trace, from the pass files and stage entries, so it shows even when pass two
  failed or never ran: each scope whose trace is `not assessed`; each `not traced:`
  symbol; each entry with result `incomplete`; each entry cut to `(<k> of <n> checked)`,
  a cut decision list included, with its `not listed:` locations; each `outward trace:`
  line of a pass-two `## Coverage gaps`; and the number of trace entries
  `not challenged`. A symbol shows once. None fails a scope or changes a count.
- Each bundle whose base refresh the user declined (the brief's `base: local ref,
  refresh declined`): its base commit list and overlap set are as of that ref.
- Each `head: working-tree` bundle: the loose objects `working-tree.sh build` wrote to
  the object store (an allowed write); that the head commit has no ref and `git gc` may
  prune it; the files untracked and the paths flagged at audit time, each flagged path
  held at its index version, so its local content is not in the head and a change to it
  during the run may escape the read-only check.
- Each bundle with `test_command`: whether the changed test files ran with the change
  reverted, or none were found to run; the setup exit status per copy when `test_setup`
  is set; the verdict counts; every `not run` with its reason; the changed paths outside
  `test_paths`, whose tests were not measured; and that the bundle's own commands ran
  with the user's environment and credentials, in copies under the plugin's data
  directory that were removed, and may have written outside the audited repositories
  (an allowed write).
- Stage 6: whether the mandatory ids went out in batches (`batched`), each sentinel
  acknowledgment that failed (`sentinels`), every mandatory id left without a position
  (`missing_positions`), and each batch relaunched on `opus` or failed.
- Corpus files stage 2 split by byte range: source, path, size, each range, and the
  chunk id (`digest-N`) that covered it, with that chunk's status.
- Unanswered questions, and questions marked "not run".
- Departures from the stage plan, such as the low tier's single auditor covering the
  tests and work-item hygiene.
- Read-only check: each `baseline/<stage>-check.md` result, and every ignored file
  accepted, with the run that wrote it. What the check does not detect: an ignored file
  replaced at the same size with a restored modification time; changes inside `.git/`
  other than refs, stashes and config; a nested repository's changes other than its
  HEAD, stashes or config; changes inside a repository that sits in an ignored
  directory, such as a linked worktree, other than a top-level entry added or removed;
  and changes outside the audited repositories. When a check file carries
  `note mtime precision: seconds`, the ignored-file comparison used whole seconds, so a
  same-size rewrite within one second went unseen. A user's own edit to an audited
  repository during the run would also have tripped the check.
- Forge: the bundles not queried, and each export's "not in export" keys.
- Test injection: the manifest's `_test` key, when present.

### 12. Usage

A run record, per stage, from `usage.md` and the stage entries: the agents run, each
with its requested model (the report says "requested", never "used"), wall-clock time,
and tokens as the task notification reported them, labeled "task notification,
subagent_tokens; scope not documented", or "not reported" when the notification gave
none. The stage 6 agents are listed like any other. Each stage names its swaps: role,
scope, the requested model before and after, and the reason. Any sum is labeled "sum of
reported numbers, not exact".
