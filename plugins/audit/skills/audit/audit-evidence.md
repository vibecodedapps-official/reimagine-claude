# Audit evidence rules for this run

Stage 1 copies this file into the run directory as `audit-evidence.md`, next to
`common.md`. Only the auditor and the adversary read it, in every mode the adversary has:
pass two, the late adversary, and the second opinion. The digester, the mapper and the
merger do not. Every rule of `common.md` applies here as well, and a section, rule or hard
rule named below without a file is the one in `common.md`.

## Evidence

These rules add to the "Evidence" section of `common.md` for the cases that only the
auditor and the adversary meet: reverted test runs, run-once scripts, matched literals,
open pull requests, and tests.

### Reverted test runs

For a bundle whose manifest sets `test_command`, stage 1 runs the bundle's changed test
files with `revert-tests.sh`, twice and outside every audited repository: in a copy of
the head, and in a copy of the merge-base that holds each changed path under `test_paths`
at its head state. `revert/<bundle>.md` gives one verdict per test file, what each copy
held, and each run's exit status and output tail. It is a run: cite its line
(`revert/<bundle>.md:<line>`), the test file, and the copy.

What the result file can hold:

- Every exit status of the test command is a result, 126 and 127 included. A file that
  exits other than 0 at the head is `does not pass at head`, whatever the status means.
- A file is `not run: <reason>` only for a setup that failed, a timeout in the reverted
  copy, a path conflict between the test code and the merge-base tree, or a cap: at most
  20 test files per bundle (the rest are `not run: file cap`), 30 minutes for the whole
  bundle, and no run at all when the head or the merge-base tree holds over 1 GB.
- The reverted copy runs only the files that passed at the head.
- Each tail is the last 80 lines of output, unredacted.

How to read a verdict:

- No verdict counts as evidence until the output tail shows, by name, that the tests the
  bundle added or changed in that file ran in that copy and were not skipped. Other tests
  of the file running is not enough: an unchanged test can pass while the changed one
  skips. When the tail cannot show it (no names, a cut tail, an empty collection, a
  wrapper that hides them), the verdict is a lead only.
- `passes at head and without the change` is a lead with a run behind it. It supports
  `verified fact` only when the tail shows the changed tests ran in both copies, the
  agent names the behavior the ticket asks for that those tests should detect, and cites
  the diff hunk outside `test_paths` that implements it, so the reverted copy lacked it.
  When the implementation sits in a changed test-code path (kept at its head state; the
  result file lists these), or cannot be found, the verdict stays a lead. A file can pass
  in both copies for a sound reason: a refactor, or a test of behavior the merge-base
  already had.
- `passes at head only` does not prove that the file detects the behavior. Reverting by
  path cannot show that point when the test also needs a file outside `test_paths` that
  the bundle added or changed (a fixture, a helper, an import, a command): that file is
  reverted too, and the run fails for its absence, not for the missing behavior. Read the
  tail and judge the file as without the run.
- `does not pass at head` is a lead, never a finding by itself. Without `test_setup` a
  copy has no installed dependencies; the result file shows whether setup ran, and the
  tail shows why the run failed.
- The verdict is per file. When the reverted copy's tail shows, by name, that a changed
  test passed before a later test failed, that test passes without the change, whatever
  the file's verdict, and the rules for a file that passes in both copies apply to it.
- A changed file outside `test_paths` stays at the merge-base in the reverted copy, so
  the tests inside it are not measured. A `not run` verdict gives its reason.
- A tail is quoted no further than the finding needs, and never where it holds a
  credential, a token, a password or a connection string.

### Rerun of a run-once script

The brief's run-once list names, for each bundle with `run_once`, the changed files that
match its patterns, each with its change status, whether it exists at the merge-base, and,
for status `R` (moved to a new path) or `C` (copied), its merge-base path. "Safe to rerun"
means no repeated work, not the same end state. A run-once script is judged step by step
by the work it repeats; an argument from the end state ("a second run leaves one key
line", "the step is idempotent") clears nothing.

A script edited in place. A file with status `M` that exists at the merge-base, whose
change alters what the script does (not a comment-only edit), is a finding: a run-once
script that may already be applied was edited, and a runner that journals by name skips
it, so the edit never runs where the script was applied. The label is
`unverified assumption`, so the severity is at most `medium`. The `live check` asks
whether the script's name is in the journal (the table or file where the runner records
applied scripts) of each target environment: journaled means the edit never runs there
and the change belongs in a new script; journaled nowhere means no defect. An added file
(`A`) and a deletion (`D`) are not flagged by this rule: an added file has no journal
entry under any name, so it runs once on each install.

A script with status `R` or `C`. A runner that journals by name does not know the new
path, so the script runs again on every install that ran it at its merge-base path.

- The runner. Find how the runner turns a script into its journal key: the file name, a
  version prefix, a hash of the content, or an id inside the file. Search the audited
  repositories at the head sha for the directory of the run-once patterns and for the
  terms the runner uses for an applied script (`journal`, `applied`, `migrat`, or its
  own), and quote the lines that read and write the journal. Compare the key of the
  merge-base path with the key of the new path. When they differ (the key is the file
  name), the script runs again where it ran before the move. When they are the same (a
  version prefix or an id the move keeps), the runner does not see the move, and the file
  is judged as a script edited in place. When the audited repositories hold no such rule
  (a tool the repository only names, or a runner outside them), say so, write the finding
  as if the key were the file name, and let the live check settle it.
- Steps. A step is the part of the script that changes one thing: a key, a column, a
  function, a data set. Read the script at the merge-base path and merge-base sha, and at
  the new path and head sha, and compare the two directly, whatever the diff shows. For
  each step of the head script, work out what an install that ran the merge-base script
  already has. A step whose result that install lacks, such as a new column or a
  definition that differs, is needed work: it is what the change is for, and this check
  does not judge it. A step whose result that install already has is repeated work when
  nothing stops it, whatever its end state. Each result is judged on its own: a new
  result does not excuse repeated work on another, even inside one command or one
  rewrite of a file. A comment, a log line or a formatting change does not change a
  step's result.
- Repeated work. Say what the step does again: drops and adds a key or an index,
  rewrites or copies rows or files, sends something outside the store, or sets a
  definition to the value it already has.
- Guards. A guard clears repeated work only when it tests the result the step produces,
  or a fact that shows the result is there (such as the merge-base path's entry in the
  journal), and holds both ways: it skips the work on an install that has the result, and
  runs it on one that lacks it (an install that never ran the merge-base script, or a
  fresh one). Work out both installs from the run-once scripts that precede this one and
  quote them. A guard on something weaker, such as "a key exists", skips work an install
  still needs when its key has other columns. A guard may wrap one step or the whole
  script, but every needed step must still run: a whole-script exit that tests only one
  step's result skips the new steps wherever the merge-base path ran.
- The finding. One per script, naming each repeated step with its lines in both versions.
  The label is `unverified assumption`, because the repository does not show that any
  environment ran the script at its merge-base path. A journal that a ticket or pull
  request lists shows one environment on one date: cite it, and keep the live check.
  Severity is at most `medium`: `medium` when the repeated step drops and adds an object,
  walks rows or files, or sends something; `low` when it only sets a definition to the
  value the merge-base script set. The live check looks up the entry of the merge-base
  path in the journal of each target environment and reads the key it holds. Its
  results: the key is the file name, so the new path runs there and repeats the step, and
  the recommended change applies. The key survives the move, so the new path does not
  run there. No entry, so the new path runs once there with nothing to repeat. The
  recommended change guards the repeated step on its own result, or leaves the script at
  its merge-base path and puts the needed steps in a new script.
- A script checked and cleared gets a `## Verified OK` line that names the guard, or says
  that each step's result is new to an install that ran the merge-base script. Where the
  tier lets pass two attack Verified OK items, such an item is among the riskiest and is
  held to this section.

### Producers at head and base

A group scope or the `combined` scope checks every literal string or data shape the
change adds or alters a match on (a pattern, a prefix, a key, a field), with `git show`,
`git log` and `git grep` only. Find the code that produces it with `git grep`, and read
that producer with `git -C <repo> show <sha>:<path>` at the head sha and at the base sha
the brief records. The leads are the commits of the range from the merge-base to the
base, `git log <merge-base>..<base> -- <producer path>`, never commits picked by author
date. A finding needs evidence that the incompatible producer survives integration: the
head leaves the producer as it is, and the base's version produces a form the change does
not match. Quote both reads. A matcher the change leaves as it is is skipped. When the
brief says the base was not fetched (`base: local ref, refresh declined`), the finding
says the base read may be stale. A change on the base is not a deleted feature: the check
asks whether the changed code still matches what the merged result produces.

### Open pull request collisions

For a bundle whose pull request is on GitHub and whose run-once list gives a new path
(an `A` entry, or the new path of an `R` or `C`), stage 1 reads the first 100 open pull
requests and runs `collisions.sh` over them. Its rows reach the brief:

- `collision`: another open pull request adds or moves a file into the same directory
  with the same file name (`same name`) or the same leading version token
  (`same version`). It is a candidate, and a candidate is a lead, not a finding.
- `cut`: the forge returned fewer files of that pull request than it has.
- `cut-list`: the list may hold more open pull requests than were read.

For each candidate, find how the runner keys its journal, as "Rerun of a run-once script"
says, and compare the keys of both paths, whatever the row's kind. Keys that differ,
shown by quoted runner lines, clear the candidate: say so in the output with the quote.
Keys that match, or no runner found, give a finding on the new script. It states the
forge fact apart from its effect: the other pull request's URL and path, and that the
brief read the list in stage 1; then the effect, that where both merge, the runner
applies one script and skips the other, or fails. The label is `unverified assumption`,
so the severity is at most `medium`, and the `live check` asks which pull request merges
first and, when no runner was found, how the runner keys its journal. A `cut` row, a
`cut-list` row, or `open PRs not read` is a gap in what could be checked, never a
finding.

### Weak tests

The scope whose checklist covers tests reads each added or changed test and flags one
that asserts the code's own constant or a value computed the way the code computes it,
pins text without running the code that produces it, or accepts a wrong outcome among
those it allows. A flag is a lead. It becomes a finding only when the agent names the
regression the test would miss, with the test quoted. With the default questions it is
filed under `Q2`: the change is not shown to do what the ticket says, since its test
passes without it. With a custom question list it is filed under the question closest to
test coverage, or the first question when none fits, and the finding says so. This check
reads the tests; it does not run them.

### Test accounts

Apart from the weak-test check, and whether or not a test's assertions are adequate,
the same scope flags an added or changed test, step or scenario that runs as an account,
role or credential with write or admin rights when everything it does as that account
only reads. The flag goes on the test that picks the account, not on a shared step that
takes the role as a parameter.

- A grant or a role definition shows the rights. With one quoted, the finding is
  labeled by the rules of "Evidence", and a demonstrated grant gives `verified fact`.
- Code outside the tests that writes as the account (found with `git grep` on its name),
  or a name that says writer, owner or admin, only points to the rights. With only a
  pointer, the label is `unverified assumption`, and the `live check` queries the
  account's grants, and whether a read-only role exists, in each environment the test
  runs in.
- With neither a grant nor a pointer, the account is not flagged: an accounts file entry
  holds a name and a secret reference, not rights.

The finding names the account, where its rights come from, and the narrower role the test
needs, such as a read-only role a sibling test already uses. One finding per account,
naming each test. With the default questions it is filed under `Q1`: the test holds more
rights than it uses. With a custom question list it is filed under the question closest
to best practice, or the first question when none fits, and the finding says so. This
check reads only.

## Outward trace

A group scope and the `combined` scope write `## Outward trace` after `## Verified OK` and
before `## Claims`; no other scope writes it. It records what the auditor checked outside
the changed lines, so pass two can challenge it. It is a report section, not a list of
findings.

```
## Outward trace
- <scope>-OT<n>: <repo>:<path>:<symbol> (<repo>@<sha>:<path>:<line>); siblings: <names with citations, or none>; callees: <newly called functions and the failure branches the change handles or does not, or none>; consumers: <readers of any input or output the change widens, or none>; decisions: <listed below, or none>; result: sound, evidence: <...> | finding <id>[, <id>] | incomplete: <what was not resolved>
  - decision <repo>@<sha>:<path>:<line> <what it decides>; reads: <the widened part>; outcome: unchanged | changed from <merge-base branch> to <head branch> | new value, <branch taken>; covered: yes, <source:line and quote> | no, <texts searched and term> | n/a[; finding <id>]
- not traced: <repo>:<path>:<symbol> (<path>:<line>), ... (cap reached)
```

Changed symbols:

- A changed symbol is each function, method, query, type, config key or endpoint the
  change adds, alters or removes. Its identity is `<repo>:<path>:<symbol>`, cited at the
  head sha. A removed symbol is cited at the merge-base sha, its entry says `removed`, and
  it is traced for its consumers. An input the change widens that is none of these, such
  as an argument or a variable passed on to existing code, is a changed symbol too, named
  by where the new value enters.
- At most 15 entries per scope, riskiest first: public entry points, changed signatures,
  widened inputs, then error paths. The symbols over the cap go on one `not traced:` line,
  which is absent when the cap was not reached. A scope that changes no symbol, such as a
  docs-only scope, writes `none` under the heading and nothing else.
- The second opinion traces at most 10 symbols, in the same form and order of risk.

One hop:

- The trace goes one hop from each changed symbol. Siblings are its direct siblings: the
  same family, the same query branches, and the types the ticket names. Callees are the
  functions it calls directly that the change adds. Consumers are the code that reads an
  input or output the change widens, directly. Per symbol, at most 5 siblings, 5 callees,
  10 consumers and 8 decision points are checked, riskiest first. A cut list is followed
  by `(<k> of <n> checked)`; the overflow is listed on the entry's `not traced:` or
  `not listed:` line.
- A sibling that lacks the change is a finding only when the entry cites the shared
  contract and shows the sibling breaks it. The contract is the ticket, a ranked source,
  a shared interface or caller, or the same input contract. A ranked source's rule alone,
  with no broken behavior shown, gives the label `convention`. Otherwise the entry says
  why the missing change is not a defect.
- Consumers are searched in every tree the brief maps, not only the scope's bundle, as
  "Reading trees and searching" says, with the commands hard rule 2 allows.

Widened inputs and their decision points:

- A change widens an input or output when its readers can now receive a value, key or
  shape they could not receive at the merge-base. These widen: a fixed value replaced by
  a variable one (`null` or a constant replaced by a real map or setting); a larger type,
  range or set of allowed values (a new enum member, a required field made optional, a
  scalar made a list); a new key, field, column, header or option that existing code
  reads; a source replaced by one that can return other values. These do not: a
  narrowing, a change of name that keeps the same values, a value only new code reads,
  and a refactor that passes the same values. The decision rules apply only to a consumer
  of a widened input or output.
- A decision point runs, skips or changes something because of the widened part: a rule,
  a branch (`if`, `case`, a guard, an early return), or a key lookup. A helper that only
  tests the input and returns the answer, such as a predicate, is the reader, not a
  decision point: the decisions that act on its answer are listed instead. Code that does
  not use the widened part is not a decision point and is not counted. The decision rules
  apply to consumers in product code; a test that reads the widened input is judged by
  the tests checklist.
- `decisions:` follows `consumers:` and is `none` when `consumers` is none. The decision
  points of every consumer go on `  - decision` lines under the entry. They are not
  entries: they count toward neither the 15 entries of a scope nor the 10 consumers of a
  symbol. Every decision point that reads the widened part counts toward `n`. At most 8
  are listed per entry, across its consumers. When `n` is over 8, the uncovered come
  first: the ones that no ticket, pull request or claim text mentions (search each one's
  field, message or condition), then the ones whose own condition uses the widened part,
  then the rest in file order. `decisions:` then carries `(<k> of <n> checked)`, and a
  `not listed:` part gives the `<path>:<line>` of each one left out.
- A decision is covered when a source names it and says it follows the change. A source
  names a decision by its own field, message or condition, alone or in a group the text
  states in full. "The flag and office rules" names two rules, not a third, and a word
  that is only part of a name does not match (`office` is not `office_code`). The sources
  are the ticket and its acceptance criteria; the pull request title, body and comments;
  the bundle's commit messages; the claims; and a test that asserts the decision's outcome
  for a value the widened input can now carry. An edit to the decision's own lines is not
  coverage: it shows what to review, not that the change is meant. Naming only the key or
  setting the decision reads does not cover it, nor does a source that names the decision
  but not the change (a ticket that adds a column the decision tests), nor a test whose
  input satisfies every rule. `covered: yes` gives the source, line and quote.
  `covered: no` gives the texts searched and the term, which is the evidence of absence.
  `covered: n/a` goes with the outcome `unchanged`.
- A decision whose outcome is `changed` or `new value` and that is not covered is a
  finding. The outcome is judged over every value the widened input can now carry, not
  only the values the repository holds at the head. The finding quotes the value at the
  merge-base, the value at the head, and the decision, and explains why its branch
  differs. The label follows "Evidence": `verified fact` when those quotes and an empty
  coverage search show it, `unverified assumption` when a source's wording could reach
  the decision. Under `inferred` it says that nobody may have meant the change. It is
  filed under the question that asks for no more than the ticket says (`Q2` by default),
  or the closest one, and says so. It is not a missing rationale: it rests on a changed
  outcome. One finding names every uncovered decision of one consumer.

Results:

- `sound` needs evidence (a quote, or a search with its empty result), and every decision
  line `unchanged` or `covered: yes`.
- `finding` names the findings the entry raised, written in the finding schema.
- `incomplete` names what the auditor could not resolve, such as a consumer outside the
  mapped trees; the report lists it.

Entry lines are `- ` list lines, and a decision line is an indented `  - ` line under its
entry, with no id. No `### ` line, and no line that is only `runs:` or `status: complete`,
appears inside the section, so no trace line reads as a finding, a verdict, or the end of
a block under the parsing rules of the output contract.

## Outward trace challenged

A pass-two adversary writes `## Outward trace challenged` when the pass-one report has
`## Outward trace`, between `## Verified OK challenged` and `## Coverage gaps`:

```
## Outward trace challenged
- <scope>-OT<n>: upheld | broken, finding <scope>-P<n>; evidence: <...>
```

- At every tier, the adversary checks the trace for completeness against the scope's
  diff. Each changed symbol that is neither traced nor on the `not traced:` line, and
  each symbol on the `not traced:` line, goes in `## Coverage gaps` as
  `outward trace: <repo>:<path>:<symbol> not traced`.
- Entries are attacked by tier: none at `low`, up to 5 of the riskiest at `medium`, all
  of them at `high`. An attack repeats the entry's search or run and looks for a sibling,
  callee, consumer or decision point it missed. It opens the source each `covered: yes`
  line cites, and searches the ticket, pull request, claims and tests where a line says
  `covered: no`.
- One line per attacked entry, or `none` when no entry was attacked. A broken entry
  becomes a new pass-two finding `<scope>-P<n>`, and its line names it.
- These lines are challenge lines, not findings, and never enter the ledger files.

## Brief errata

An adversary that notices an error in `audit-brief.md` (a wrong sha, base or merge-base,
a tree mapped to the wrong path or mode, a run-once list or untracked list that does not
match the diff, a ticket resolved to the wrong source) records it under `## Brief errata`
at the end of its output, before `runs:`:

```
## Brief errata
- <brief section>: <what the brief states>; correct: <what the evidence shows>; evidence: <quote, search, or run>
```

The heading is present in every pass-two file, with `none` when the adversary noticed no
error. The orchestrator collects the lines into `brief_errata`; the brief itself is not
edited. An erratum is not a finding. When it changes a finding, the adversary's verdict
or a new finding says so, with the erratum as part of the evidence.
