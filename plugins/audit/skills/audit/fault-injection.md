# Fault injection (`_test`)

The orchestrator reads this file only when the manifest has a `_test` key; a normal audit
never loads it. The key lets an acceptance run force an agent failure, a missing
acknowledgment, a held stage, an expired budget, a planted map error, or a small split
threshold. Each field changes how one stage behaves and nothing else. The stage files
mention `_test` where a field touches them; the rules for each field are here alone.

## Recording

When the manifest has `_test`, the orchestrator records the whole key in `audit-brief.md`
and in the report's Coverage section, then applies each field it holds. An injected
failure is handled exactly as a real one: it follows the failure ladder of its role, and
every relaunch and swap it causes is recorded in the stage entry and named in the report.

## Fields

- `fail`: a list of `{ role, scope, times }`. `role` is digester, mapper, auditor,
  adversary, merger, or second-opinion (a stage 6 launch). `scope` is a group, a source,
  a chunk id, a stage 6 scope, or `any`. A stage 6 scope is `second-opinion` for a
  single batch, and `second-opinion` joined by a hyphen to `<k>` for batch `<k>` when
  there are several. The scope `second-opinion` matches every batch scope as a prefix,
  so it reaches each batch of stage 6. The first `times` completions of that role at that
  scope count as failures, across relaunches and swaps, and the failure ladder applies
  to each. A merger failure injected this way still goes to the orchestrator merge.
- `drop_ack`: `{ input, times }`. In stage 6, the acknowledgment of the named
  run-directory input counts as missing in the first `times` answers, so the sentinel
  check fails for those answers and the ladder applies.
- `hold`: `{ stage, until }`. The named stage's agents are queued, and none is launched
  until every initial agent of stage `until` has ended (for stage 4, the pass-one agents,
  before any barrier top-up).
- `expire_budget_after_stage`: a stage number. The budget counts as expired the moment
  that stage's entry is written, whether or not the run has a `budget`.
- `plant_map_error`: a source name. When that source's mapper completes, and before the
  orchestrator accepts its file, it changes the conclusion of one quoted answer in
  `domain/<source>-map.md` to its opposite, keeping the quote, and records the line in the
  stage 3 entry as `test_planted`.
- `ledger_split_bytes`: a byte count. It replaces both 450,000-byte thresholds of stage 7:
  the one that chooses the split mode, and the one that splits a group's slice into parts.
