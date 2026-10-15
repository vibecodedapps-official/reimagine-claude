# Common rules for this run

Stage 1 copies this file into the run directory as `common.md` and fills in the header
below. Every agent of the run reads it, and the orchestrator follows it too. It is the one
home of the hard rules, the evidence rules, the finding schema and the output contract;
the stage files and the agent definitions cite its sections by name and do not restate
them. The rules that only the auditor and the adversary need are in `audit-evidence.md`,
next to this file, and the sections below that belong to them point there.

```
run id: <run-id>
run directory: <absolute path>
tier: low | medium | high
questions:
- <id>: <question>
```

The default questions are four: `Q1` best practice, `Q2` semantic drift (the change does
more or less than the ticket asks), `Q3` technical debt, and `Q4` decision quality. The
manifest `questions` key replaces them, or adds to them when it holds `extends: default`.
The header lists the questions this run asks.

## Hard rules

Every rule holds in every stage, for the orchestrator and for every agent.

1. **Read-only boundary.** While `/audit:run` or `/audit:resume` runs, nothing changes an
   audited repository's tracked files, its untracked files that are not ignored, its
   index, branches, tags, stashes, config or remotes. Every bundle, reference and source
   of truth is an audited repository. The writes allowed are these, and nothing else:
   - the run directory;
   - audit's data directory `${CLAUDE_PLUGIN_DATA}`: `runs.json`, its lock directory
     `runs.json.lock` with the owner directory inside it, its temporary file
     `runs.json.<owner>.tmp`, and the orchestrator's working copies for the reverted
     test runs under `revert-work/<run id>/`, removed when those runs end;
   - `git fetch` into remote-tracking refs, once the user has approved it for the run;
   - for a bundle with `head: working-tree`, the loose objects that
     `working-tree.sh build` writes into the repository's object store, in stage 1 and
     when resume rebuilds the head; the report discloses them;
   - whatever a bundle's own test commands write outside every audited repository and
     the run directory, under the consent its `test_command` key gives; the report
     discloses it.
   An ignored file written by a run that an agent logged under its `runs:` heading is
   allowed and reported, never passed over in silence.
2. **Prevention and detection.** No agent has Edit or NotebookEdit. An agent with Bash
   runs only these commands:
   - `git show`, `git log`, `git grep`, `git ls-files`, and
     `git diff --no-ext-diff --no-textconv --no-color <base>...<head>`, each also as
     `git -C <repo> <command>`;
   - `git hash-object --no-filters <file>`, never with `-w`, for the `consumed:` hashes;
   - `rg` and `ls`;
   - the read-only forms of `sed -n`, `awk`, `diff`, `wc`, `sort`, `head`, `tail` and
     `grep`, as commands or as pipe stages, over an exported file under the run directory
     or over `git show` output; `cat` of an exported file; and, for a digester's byte
     range, `git show` output piped through `tail -c`, `head -c`, `wc -c` or `sed '$d'`
     and one `awk` stage that numbers lines, in slices of at most 24000 bytes;
   - when a question needs a run in a directly read tree, the repository's own test or
     lint commands, which may write ignored build output.

   No command edits a file in place: no `sed -i`, no `awk -i inplace`, no sed `w`, `W` or
   `e` command, no `w` or `e` flag, and no awk program with `system()`, output
   redirection, `getline` from a command, or a pipe to a command. No output goes into an
   audited tree. An agent may redirect a command's output into its own scratch folder,
   `<run dir>/tmp/agents/<stage>-<scope>[-<n>]/`, which its prompt names, and keeps it
   raw. The digester keeps its narrower byte-range rule.

   A diff always names two commits. A `git diff` against the working tree refreshes the
   index even with `--no-optional-locks`, so it never runs. In a bundle with
   `head: working-tree`, `git grep` always names the head sha, since a plain `git grep`,
   or `rg` over `git ls-files`, misses the untracked files that belong to the head. The
   orchestrator runs status as `git -C <repo> --no-optional-locks status ...`, and
   `readonly.sh` sets `GIT_OPTIONAL_LOCKS=0`, so no status check rewrites the index.

   This is instruction, not enforcement: nothing blocks Bash mechanically. Detection is
   `readonly.sh`. The orchestrator snapshots every audited repository in stage 1 and
   checks it after every stage. A change to tracked files, untracked files that are not
   ignored, refs, the index, stashes or config, an added or deleted file included, ends
   the run `blocked`, unless an approved fetch caused it, or a background fetch the user
   confirmed (a `background-fetch` entry in `approvals`, as the `### Read-only check`
   section of `SKILL.md` says). A change among ignored files that no logged run accounts
   for ends it too, unless it is another audit run's or a handoff's file under an audited
   repository's `<scratch>/audit/`, or under the same path in the main checkout of a
   primary repository that is a linked worktree, outside this run's directory. The check
   does not see: an ignored file replaced by one of the same size with its modification
   time restored; changes inside `.git/` other than refs, stashes and config; a nested
   repository's refs other than its HEAD, its stashes and its config; a change inside a
   repository that sits in an ignored directory, such as a linked worktree, other than an
   entry added or removed at its top level; and changes outside the audited
   repositories. The user's own edits to an audited repository during a run trip the
   check as well.
3. **No model, agent or tool names** in anything external: commit messages, pull request
   and ticket text, and drafted comments. The report and the run records stay in the run
   directory and may name them.
4. **No advisor tool**, in the orchestrator or in any agent.
5. **Live data only from a `--live` file.** Credentials and live systems (databases,
   dashboards, production APIs) serve only a question the code cannot answer, and only
   through a result the user supplies. A needed check becomes an item of the report's
   Live checks section: an agent writes the `live check` field of a finding and nothing
   more. Neither an agent nor the orchestrator asks for or uses live access during a run.
   The user runs the check and returns the result in a `--live` file through
   `/audit:resume` (`live.md`); the approval is recorded from that file, and the report
   logs each access.
6. **Evidence cited.** A statement is not a fact until its evidence is cited, as
   "Evidence" says.
7. **Disk first.** Every agent writes its output file before it reports back, and returns
   only the path and one line of status.
8. **Claims are not facts.** The session summary under audit, and every sentence of
   `claims.md`, is a claim to verify, never a source of truth.

## Evidence

Every piece of evidence names its repository and the commit it was read at. It is one of
four kinds:

- **Quote:** `repo@sha:path:line`, with the lines quoted.
- **Search:** the exact command, its scope and its result, an empty result included.
  This is how an absence is shown.
- **Run:** the exact command, where it ran, and its output, marked as cut where it is
  cut. Every run is logged under the agent's `runs:` heading.
- **Live result:** the result of an approved live check that the user returned with
  `--live`, cited by its file and line, `live/results-<k>.md:<line>` (or
  `live/carried/<id>.md` for a carried finding), and, for a result kept as a file, by its
  copy `live/results-<k>/<line>.txt`. It counts as a run the approver made, so it can
  demonstrate a defect, once it has passed the review gate of stage 7
  (`stages/7-converge.md`).

Forge evidence is a URL with a quote. A finding keeps what its evidence
**demonstrates** apart from what it **infers**. The labels:

- `verified fact`: the defect itself is demonstrated, by a quote with a causal
  explanation, or by a run.
- `unverified assumption`: the defect is not demonstrated. Its severity is at most
  `medium`.
- `convention`: the finding rests on the rule of a ranked source, not on broken behavior.

A digest (`guidelines/digest-<n>.md`) or a map (`domain/<source>-map.md`) is a pointer,
never evidence. Cite the original document or source at its pinned sha.

A finding with a `live check` stays `unverified assumption`, under its cap, until a live
result for it has passed the review gate. A rationale missing from a ticket or a pull
request is not by itself a defect. The diff is always the three-dot diff in
`diffs/<bundle>.diff`. A two-dot diff of base and head shows the base's own changes as
reversals on the head, so it is never used.

### Reading trees and searching

`audit-brief.md` maps each bundle, reference and source of truth to the path to read and
the sha it is pinned at. How to read depends on the brief's mode for the tree.

- **Directly read tree** (the repository's own checkout, at the pinned sha, with no
  tracked changes): search with `git -C <repo> grep <pattern> <sha>`, or with `rg` over
  the files `git -C <repo> ls-files` lists. A plain `rg` over the working tree also sees
  untracked and ignored files, so it is never used. A symlink that leads outside the
  repository is not followed. A citation of an untracked, ignored or outside path is not
  valid evidence, except as the next item allows.
- **Working-tree bundle** (`head: working-tree`, mode `direct (working tree)`): the head
  is a commit built from the working tree, with no ref, holding the modified files and
  the untracked files that are not ignored. Search it only with
  `git -C <repo> grep <pattern> <head sha>`; `rg` over `git ls-files` misses its
  untracked files. The files the brief lists as untracked at audit time belong to the
  head and are valid evidence, cited at the head sha as `repo@sha:path:line`; an ignored
  or outside path is still not. When the brief lists a path as flagged at audit time, the
  bundle is read from an export of its head instead (mode `export`), which holds the
  untracked files and each flagged path at its index version, not the local file. A
  flagged path inside a submodule is absent, as every submodule path is.
- **Exported tree** (`<run dir>/trees/<name>/`): tracked files only, at the pinned sha;
  the export of a working-tree head also holds the files the brief lists as untracked. A
  symlink is a regular file holding its target and is not resolved. Submodules are absent
  and listed in the brief. Git LFS files are their pointer files. Cite as
  `repo@sha:path:line` with the repository-relative path, never the export path. No test
  or lint command runs in an export, whatever it needs; such a question is marked
  `not run`. The one exception is stage 1's run of a bundle's changed tests, in its own
  copies, read as `audit-evidence.md` says.
- **Read by `git show`** (an export over 1 GB the user declined): read each file with
  `git -C <repo> show <sha>:<path>`. Only agents with Bash are assigned such a tree.

### Reverted test runs

The rules for reading `revert/<bundle>.md`, the result of stage 1's reverted test runs,
are in `audit-evidence.md` under the same heading. Only the auditor and the adversary use
them.

### Rerun of a run-once script

The rules for a run-once script that the diff shows with status `R` or `C` are in
`audit-evidence.md` under the same heading. Only the auditor and the adversary use them.

## Finding schema

Every finding is exactly this block:

```
### <scope>-F<n>: <one-line title>
- severity: blocker | high | medium | low | note
- question: Q1 | Q2 | Q3 | Q4 | <custom id>
- label: verified fact | unverified assumption | convention
- claims: <claim numbers tested, or none>
- evidence: <quote, search, or run, per Evidence>
- demonstrated: <what the evidence shows>
- inferred: <what follows from it but is not shown>
- what the code does:
- what breaks, and for whom:
- recommended change: <repo> <path> <change>
- alternatives: <each weighed, and the one recommended>
- live check: <query>; <where it runs>; <what each result changes>; or none
- work-item impact: <ticket, acceptance criterion, or none>
```

The report splits the `live check` field at its semicolons, so the query, the place and
the results hold no semicolon of their own; outcomes are joined with periods.

When a `recommended change` adds or moves a documented fact (a rationale, a history note,
a decision, a how-to, a ticket number), its author first reads the instruction files that
apply to the target file: the repository's `AGENTS.md` and `CLAUDE.md` and the files they
index, at the root and in each directory on the file's path (a nested file governs its
subtree), as the tree read for the audit holds them, and the placement rules
`audit-brief.md` records from the user's own instruction files. Where those files give the
fact a home (commit messages, a docs file, a changelog), the recommendation names that
home, with a pointer from the code where it helps, and never a place they exclude.

### Ids and origin tags

The id says where a finding comes from. Ids are case-sensitive.

- `<scope>-F<n>`: pass one. A barrier top-up appended to `pass1/<scope>.md` under a
  `## Top-up` heading continues the same numbering.
- `<scope>-P<n>`: a new finding of a pass-two adversary, with the line `- origin: pass2`
  right after the title.
- `<scope>-T<n>`: a finding of a top-up auditor after a map correction, in
  `pass2/<scope>-topup.md`, with `- origin: topup`.
- `X<n>`: a finding the second opinion adds, with `- origin: second-opinion`.
- `L<n>`: a finding the late adversary raises, with `- origin: late`.
- `C<n>`: a converged item of stage 7, which absorbs one or more of the ids above. Its
  block is given in `stages/7-converge.md`; it is never a finding block.

A scope is a group or a specialist scope; its id holds no space and no colon. Every
finding with an `- origin:` line is a **late addition**.

## Verified OK list

Each item checked and found sound, with its evidence:

```
## Verified OK
- <scope>-OK<n>: <what was checked>; evidence: <quote, search, or run>
```

## Outward trace

A group scope and the `combined` scope write `## Outward trace` after `## Verified OK` and
before `## Claims`; no other scope writes it. Its entry form and rules, and the pass-two
`## Outward trace challenged` section, are in `audit-evidence.md` under the same heading.
Only the auditor and the adversary use them.

## Claim kinds

Every claim in `claims.md` has a kind. A handoff's claims take their kind from the
handoff script, never from judgment. A prose sentence takes the kind of the first rule
that fits it:

1. `verification`: it says something was checked, tested, verified, confirmed,
   reproduced, or passes.
2. `decision`: it states a choice made or rejected, a deferral, or who decided.
3. `scope`: it says what belongs in the bundle or out of it, or ranks a ticket for
   inclusion.
4. `status`: a work item's type, state, iteration, owner or links.
5. `code`: any other checkable statement about code, data or behavior.

A claim targets a group id from `groups.md`, or `hygiene`. Every `scope` and `status`
claim targets `hygiene`; the stage files say which scope receives them.

## Claims list

Each claim assigned to the scope in `claims.md` gets one line:

```
## Claims
- claim <n>: true | false | not verified; <finding id, or evidence>
```

A `not verified` line gives the reason, such as "needs a live check". A `verification`
claim takes one of these lines instead:

```
- claim <n>: true, reproduced; <the run or quote that reproduces the stated result>
- claim <n>: false, contradicted; <evidence>
- claim <n>: not verified, not reproduced; <why: not run, no access, needs a live check, budget expired, exported tree, or setup differs>
```

A `verification` claim is `true, reproduced` only when the agent reproduced the stated
result itself: by a run, or by a quote when the stated result is a fact of the code at
the pinned sha. A quote of other text saying the check was done is not a reproduction.
`false, contradicted` needs counter-evidence. A run under a setup other than the one the
stated check needs (another directory, a missing environment variable, service or
account, another environment than the one named) is not counter-evidence: the claim is
`not verified, not reproduced`, and the reason names what differs. A reproduced result
does not show that the session under audit ran its stated check; the report says so once,
in its Claims section.

## Env claims

An env claim is a `verification` claim whose check part, the text after the first
`; check: ` of its entry, starts with `env: ` (`env: <name>; <check>`, as `handoff.md`
defines it). The rule is mechanical, and stage 1 adds no marker to `claims.md`. The check
names the environment `<name>`, which the audit cannot reach, so a run here is a run
against another environment. Pass one writes the claim as
`not verified, not reproduced; needs a live check: env <name>`, never `true` or `false`
from a run here. The report lists each env claim by number in its Live checks section,
with its environment and command, and `claims-verdicts.md` gives it the verdict
`not reproducible here` until a live result settles it (`live.md`).

## Decisions

Every scope writes `## Decisions` after `## Claims`: one line for every `decision` claim
assigned to it, by claim number, or `none` when it has none.

```
## Decisions
- claim <n> (<handoff ref or none>): <class>; resolution: <taken | open deferral | settled later by <record>>; alternatives weighed: <yes, <evidence> | no>; authority: <person: <name> | role: <role> | checkpoint | not recorded>; tracked by: <where | nothing>; work depends on it: <yes, <why> | no>; reversibility: <reversible | hard to reverse | contract change>; recommendation: <text>; finding: <finding id or none>
```

Three dimensions are read from the record; the class follows from them.

- Resolution: `taken` (status `taken` or `default taken`); `open deferral` (status
  `deferred` or `deferred to <owner>`); or `settled later`, a deferral that a later
  commit, comment, ticket field or document shows was decided, treated as `taken` with
  that record as `recorded_at`.
- Authority: `person: <name>`, `role: <role>`, `checkpoint`, or `not recorded`. For a
  deferral, the owner in `deferred to <owner>`, judged the same way.
- Alternatives weighed: yes when a record the agent can open (a commit body in a bundle,
  a ticket or pull request comment in the forge data, a document at a pinned sha) states
  at least one alternative and why it was not taken. The handoff's own `rejected: ...;
  why:` lines are claims, not such a record: a `recorded_at` the agent opened and found
  to support them counts. A `checkpoint:` pointer or `not recorded` cannot be opened, so
  the entry says `alternatives weighed: no (not in a readable record)`.

Reversibility is `reversible`, `hard to reverse` (undoing it needs a data migration or
coordinated work), or `contract change` (it alters what another system or user relies
on).

The class is the first of these that holds:

1. `stale deferral`: an open deferral with no `person:` owner, or one that nothing in the
   forge data or the repositories tracks (no ticket, comment or document names it as
   open).
2. `needs <owner>`: an open deferral with a `person:` owner that the record tracks; or a
   taken decision that is `hard to reverse` or a `contract change` and whose authority is
   not `person:`. `<owner>` is the deferral's owner, else the person or role the tickets
   or comments name for it, else `owner (not recorded)`.
3. `default taken`: a taken decision without alternatives weighed.
4. `evidenced`: a taken decision with alternatives weighed.

Every decision lands in exactly one class: an open deferral in 1 or 2, a taken decision
in 2, 3 or 4. The decision sentences of a prose claims file are classed the same way, from
what the record shows.

## Scope

A scope that holds `hygiene` claims (`hygiene`, `tests-hygiene`, `combined`) also writes
`## Scope` after `## Decisions`: one line for every `scope` claim, or `none`.

```
## Scope
- claim <n> (<handoff ref or none>): introduced by the bundle: <yes | no | partly>, <evidence against the merge-base>; fix inside the bundle's repos: <yes | no, <repo>>; cost: <small | medium | large>, <why>; recommendation: <include | defer>, <reason>; handoff ranking: <rank and confidence, or none>; facts disagree with the handoff: <yes, <what the handoff states that the evidence contradicts> | no>; recommendation differs from the handoff: <yes | no>; finding: <finding id or none>
```

Decision and scope entries are report items, not findings. They never enter
`ledger/5.md`, `ledger/6.md` or `ledger/7.md`, pass no review gate, and never change the
verdict counts. An entry the auditor did not write is `not assessed`, and one the
adversary gave no line is `not challenged`; neither fails a scope, and the agents still
write every entry and line. When an entry shows a defect (a `stale deferral` or
`needs <owner>` that the bundle's work depends on, or a scope fact that ships a
regression), the agent files a separate `Q4` finding and names it in the entry's
`finding:` field. A defect the adversary finds first is a pass-two addition,
`<scope>-P<n>`. Those findings pass the gate like any other.

## Pass-two verdicts

An adversary gives each finding exactly one verdict, with evidence:

- `survives`: the finding stands as written.
- `downgraded`: it stands at a lower severity or a weaker label; both are given.
- `reworded`: the defect is real, but the title, scope or reasoning is wrong; the
  corrected text is given.
- `dropped`: the finding is wrong; the counter-evidence is given.

```
### verdict on <finding id>: survives | downgraded | reworded | dropped
- severity: <old> -> <new> | unchanged
- label: <old> -> <new> | unchanged
- evidence: <quote, search, or run>
- reason:
```

After the verdicts, a pass-two adversary attacks the Verified OK list as far as the tier
allows, under `## Verified OK challenged`, one line per item with its result. When the
pass-one report has `## Outward trace`, it then writes `## Outward trace challenged`
(`audit-evidence.md`). Then it writes `## Coverage gaps`, and `## Map corrections`: the
map file, the line, what is wrong, and the source quote that shows it, or `none`.

At every tier, after `## Map corrections`, it writes three challenge sections:

```
## Claims challenged
- claim <n>: upheld | overturned to <true, reproduced | false, contradicted | not verified, not reproduced>; evidence: <...>
## Decisions challenged
- claim <n>: agree | disagree, <class>; evidence: <...>
## Scope challenged
- claim <n>: agree | disagree, <what differs>; evidence: <...>
```

`## Claims challenged` has a line for every `verification` claim the report marks true,
and may add any other claim the adversary finds misjudged. `## Decisions challenged` and
`## Scope challenged` have a line for every entry of the report's `## Decisions` and
`## Scope`. Each heading is present, with `none` only when the report gives nothing to
challenge under it. A `disagree` line names the class or the field it disputes. Challenge
lines are not findings and never enter the ledger files.

## When a finding counts

A finding counts toward the verdict only after a fresh adversary other than its author
challenged it and the second opinion saw it. `ledger.sh gate` decides this mechanically,
with fixed reason strings:

- At `medium` and above, a stage 6 position on the finding is required.
- At `low` and `note`, a complete stage 6 that requested it suffices.
- An `X<n>` counts once the late adversary gave it a verdict.
- An `L<n>` never counts, except a carried one under the live rule (`live.md`).
- When stage 6 failed, nothing passes on its account.

A converged item whose disposition is `contested` counts at one severity:

- Equal severities count at that severity.
- With one `dropped` position, the item counts only when the position that keeps it is
  `verified fact`.
- Otherwise the higher severity counts when its position is `verified fact`, else the
  lower one.

An item whose gate is `provisional`, and an item that is `dismissed`, never counts.

## Output contract

Every agent:

1. Writes one output file, at the path its prompt names, and no other file, except raw
   command output in its own scratch folder when its prompt names one. It edits nothing
   in place; it rewrites its own output file with Write.
   - A pass-one file holds, in order: its findings, `## Verified OK`, `## Outward trace`
     (a group or `combined` scope only), `## Claims`, `## Decisions`, and, in a scope
     that holds `hygiene` claims, `## Scope`.
   - A pass-two file holds, in order: its verdicts and its new findings,
     `## Verified OK challenged`, `## Outward trace challenged` (when the pass-one report
     has `## Outward trace`), `## Coverage gaps`, `## Map corrections`,
     `## Claims challenged`, `## Decisions challenged`, `## Scope challenged`, and
     `## Brief errata` (`audit-evidence.md`).
2. Lists every command it ran under a `runs:` heading, one per line: the command, the
   directory it ran in, and its exit status; or `runs: none`.
3. Lists every digest and map file it read under a `consumed:` heading, one per line: the
   run-directory path and its hash from `git hash-object --no-filters <file>`; or
   `consumed: none`.
4. Ends the file with the line `status: complete`, as its last line.
5. Returns only the output path and one line of status.

Only the merger may add an `opened:` heading, before `consumed:`, listing each ledger file
or section it opened, with the path and the reason, one per line. It is not a `runs:`
entry: the merger has no shell, and `runs:` holds only commands, directories and exit
statuses, or `none`.

A file whose last line is not `status: complete` is a failed output, whatever the agent
returned.

```
runs:
- git -C /abs/app grep -n "limit" 1a2b3c4; /abs/app; exit 0
consumed:
- guidelines/digest-1.md 9f8e7d6c5b4a39281706f5e4d3c2b1a098765432
status: complete
```

`ledger.sh` parses every output it reads by these rules:

- A finding block starts at a line `### <id>: <title>`, and a verdict block at a line
  `### verdict on <id>: <verdict>`.
- A block ends at the next line that starts with `## ` or `### `, or at a line that is
  exactly `runs:`, `runs: none`, `consumed:`, `consumed: none`, `opened:`,
  `opened: none` or `status: complete`. Any other line that starts with one of those
  words is body text.
- A fence line is one whose first characters other than blanks are three backticks.
  Lines between two fence lines never start or end a block, and a file that ends inside
  a fence is an error.
- An id is `<scope>-F<n>`, `<scope>-P<n>`, `<scope>-T<n>`, `X<n>` or `L<n>`, and is
  case-sensitive: an id heading in the wrong case is an error. A position line of a
  second-opinion answer may start with a list number (`1. <id>: ...`).
- A finding block has exactly one `- severity:` line and one `- label:` line, each with
  an allowed value. A verdict block has exactly one verdict word and one `- severity:`,
  one `- label:` and one nonempty `- evidence:` line.
- A complete file ends with `status: complete`, and the script checks it against the
  inventory.

A duplicate id, two verdicts for one id, a verdict for an id with no finding, a pass-one
finding without a verdict in a complete pass-two file, and a malformed block are errors:
the script prints them, and the stage that ran it fails.
