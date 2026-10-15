# Second-opinion request template

Stage 6 (`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/6-second-opinion.md`) builds
`<run dir>/second-opinion/request.md` from this template, and, when the mandatory set is
split into batches, `second-opinion/request-<k>.md` for each batch `<k>` from 2. A fresh
`audit:adversary` in second-opinion mode reads one request per batch.

## Inputs and sentinels

The request's inputs are these run-directory files, each listed only when it exists:

- `audit-brief.md`
- `common.md`
- `audit-evidence.md`
- `claims.md`
- every `diffs/<bundle>.diff` and `diffs/<bundle>.stat`
- `ledger/5.md`: every finding with its original text and its pass-two verdict, dropped
  findings included
- every `pass2/<scope>.md` and `pass2/<scope>-topup.md`, for the verdicts and the
  coverage gaps
- `live/findings.md`, each `live/carried/<id>.md` it names, and its result copies
  (`live/results-<k>/<line>.txt`, `live.md`, "Derivation"): the findings a live result
  answers, the text of each carried finding, and each result kept as a file

Each input reaches the agent as a copy at `second-opinion/inputs/<run-relative path>`.
The copy's first line is the sentinel and its remaining bytes are the input's, unchanged:

```
audit-sentinel: <run-relative path> <token>
```

`<token>` is 16 hexadecimal characters, new for each copy, from `od -An -N8 -tx1
/dev/urandom` with the spaces removed. The stage keeps every path and token for its
`sentinels` map. The originals are never changed.

Audited sources are never inputs and never copied: the request names each one by the
absolute read path and sha in `audit-brief.md`, and the agent reads it there.

The request has one form. It names every input copy by its absolute path and carries no
inline content, so it has no size cap and no diff is ever left out of it.

## Request

Fill each `<...>` and keep the asks in this order. A request for batch `<k>` from 2 keeps
`## Inputs`, `## Acknowledge your inputs first`, asks 1 and 2 only, and `## Answer
format`.

```
# Second opinion for audit <run-id>

You are giving an independent second opinion on an audit of a bundle of changes. Read
only; change no file except the output file your prompt names. The audit's rules,
evidence kinds and finding schema are in common.md and audit-evidence.md; use them. The
session summary and every sentence in claims.md are claims to verify, not facts.

## Inputs

<one line per input copy: "- <absolute path under second-opinion/inputs/>">

Audited sources, read at the pinned shas in audit-brief.md:
<one line per bundle, reference and source of truth: name, absolute read path, sha, mode>

## Acknowledge your inputs first

Begin your answer with a section "## Acknowledgments" that quotes, for every input
above, its first line exactly as you read it (the line starting "audit-sentinel:"). List
an input you could not open as "not read: <path>".

## Asks, in this order

1. For each finding at severity blocker, high or medium, and each finding
   live/findings.md lists, judged with its live result: your verdict (agree, disagree,
   or change severity) with your own evidence, not the auditor's. A finding with a file
   under live/carried/ is carried: its text is in that file, and the ledger may hold no
   section for it. <id slot>
2. For each finding pass two downgraded or dropped: your position, with evidence. A
   finding that asks 1 and 2 both cover gets one position. <id slot>
3. Dropped findings you would restore, each with the reason and evidence.
4. Before you choose new findings, trace outward from at most 10 changed symbols,
   riskiest first, as the "Outward trace" section of audit-evidence.md describes:
   siblings, newly called functions, consumers, and, for a consumer of a widened input,
   each decision that reads the widened part, checked against the ticket and claims text
   the brief names. The trace is for your own search; do not write it out. Then give up
   to ten findings no reviewer raised, from the trace or anywhere else, each in the
   finding schema of common.md under a heading "### X<n>: <title>" with the line
   "- origin: second-opinion", numbered from X<first free number>.
5. Severity recalibration: any finding whose severity you would change, from and to,
   with the reason.
6. A non-binding merge verdict per bundle: not ready, merge after fixes, or ready to
   merge. It never replaces the report's verdict rules.

Also consider the coverage gaps the pass-two files list.

## Answer format

- One line per finding position, starting with the finding id and a colon (a leading
  "- " is fine): "<id>: <agree | disagree | restore requested | recalibrate <from> -> <to>>;
  <evidence>; <reason>". Give a position for every id your slots name and for no other.
- Evidence per common.md: a quote (repo@sha:path:line), a search, or a run, naming the
  repo and commit.
- At most 3,000 words in total, and at most two quoted lines per citation.
- End with the merge verdicts of ask 6 when this request has it, else with your last
  position, then a last line "status: complete".
```

The `<id slot>` at the end of asks 1 and 2 is one line. With one batch it reads `for
every such finding`. With more than one it reads `for these ids: IDS-BATCH-<k>` with the
batch number filled in, and the stage replaces `IDS-BATCH-<k>` by shell with the batch's
ids; no id is ever typed into a request. In ask 4, `<first free number>` is 1, or the
number after the highest `X<n>` under `live/carried/`, since a carried id is reserved for
its finding.

## Acknowledgment rule

This rule is the stage's, not part of the request text. After each batch's answer, the
stage compares every input's sentinel line with the answer: a sentinel not quoted
exactly, or an input listed as `not read:`, means access to that input is not
confirmed, and the attempt fails. The ladder then relaunches the batch on `opus`; a
second failure fails stage 6, and no finding passes the review gate on its account. The
stage also requires a position for every mandatory id of the batch, and an id missing
one fails the attempt the same way. With `_test.drop_ack` naming an input, its
acknowledgment counts as missing for the first `times` checks, whatever the answer says.
