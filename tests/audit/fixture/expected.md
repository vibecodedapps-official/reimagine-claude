# Fixture expected outcomes

`sh tests/audit/fixture/build.sh <name>` builds `solo`, `solo-dirty`, `full`, `tokens`,
`patterns`, `review`, or `ground-truth` in a new temp directory and prints the absolute path of its manifest, nothing else. Below, `$F`
is that directory (the manifest's directory). Every value here is a literal. A value
changes only with a recorded reason: change `build.sh` and this file in the same commit,
and say why in the commit body.

`sh tests/audit/fixture/verify.sh <manifest path> [name]` checks the key literals below against
a built fixture with git commands (commit ids, the two-dot and three-dot diffs, the
skipped test, the solo-dirty symlink, branch, and `filter-ran`, the `MUST` rule, the
legacy ids, the CRLF bytes, the three tickets on `src/output.sh`, and, for `solo` and
`solo-dirty`, that the five handoff files and `manifest-working-tree.json` exist, the
handoff's hash and each verdicts file's heading hash below, and that `handoff.sh claims`
gives the claim count per kind below; for `tokens`, its commit ids and messages, files,
exports, and the `ticket_token` lines of its manifests; for `patterns`, its commit
ids, files, exports, and `run_once` line, plus four behavior checks run in temp copies;
for `review`, its commit ids, diffs, where `REVIEW.md` is at each base and head, its
rules, exports, and manifests, plus behavior checks run in temp copies;
and, for `ground-truth`, its commit ids, branches, diffs, exports, and manifest, plus a
behavior check per case run in temp copies)
and prints one line per mismatch. CI runs it after each build. Its expected values are copies of the literals
here, so a change to one changes the other.

The builder fixes the git identity (`fixture <fixture@example.invalid>`), the commit
dates (`2026-09-01 10:<n>:00 +0000`, one minute per commit in build order, except in
`ground-truth`, whose commits carry the dates its table lists at `10:00:00 +0000`), and turns off
global and system config, signing, and line-ending conversion. Commit ids are therefore
the same on every machine and are listed as literals (checked on Git Bash for Windows and
on Ubuntu with dash, gawk, and mawk).

## solo

### Layout

| Path | What it is |
|---|---|
| `$F/manifest.json` | One bundle: `./app`, branch `feature`, base `main`, ticket `file:./exports/APP-1.md`, claims `./session-summary.md` |
| `$F/manifest-missing-title.json` | The same bundle with tickets `file:./exports/APP-1.md` and `file:./exports/APP-2.md` |
| `$F/exports/APP-1.md` | Ticket export with id, url, title, state, description, source, exported_by, exported_at; no `acceptance_criteria` |
| `$F/exports/APP-2.md` | Ticket export with no `title` |
| `$F/session-summary.md` | The claims file |
| `$F/manifest-handoff.json` | `manifest.json` with `"claims": ["./handoff.md"]` |
| `$F/manifest-scratch.json` | `manifest.json` with `"scratch": "./app/.test-output"` added |
| `$F/manifest-working-tree.json` | `manifest.json` with `"head": "working-tree"` in the bundle; outside every repo, so no commit id changes |
| `$F/handoff.md` | The handoff, in the format of `skills/audit/handoff.md` (see "Handoff" below) |
| `$F/claims-verdicts.md` | A return-trip file for `$F/handoff.md`, its heading carrying the handoff's hash (see "Verdicts" below) |
| `$F/claims-verdicts-stale.md` | The same lines, its heading carrying a stale hash |
| `$F/app` | The app repo, checked out on `feature`, no tracked changes |

### Commits

| Commit | Id | Branch | Files |
|---|---|---|---|
| `initial user records tool` | `bd5d5e1e67a1fc55adeaa1452920245b1d368f7f` | merge-base | `.gitignore`, `README.md`, `data/users.csv`, `migrations/001_create_users.sh`, `run-tests.sh`, `src/users.sh`, `tests/test_users.sh` |
| `APP-1: add status column migration` | `9c5f77ce3ab9e36fff5bc6b12a230c26688316bf` | feature | `migrations/002_add_status.sh`, `tests/test_users.sh` |
| `APP-1: add deactivate command` | `0c23936980b254c4abd489d3ecfd296f5e7bc0db` | feature head | `src/users.sh`, `tests/test_users.sh` |
| `add a count command` | `26a0d2c212dea452164f51c60b31665043bb3b38` | main head, the base's later commit | `README.md`, `src/users.sh` |

- Merge-base: `bd5d5e1e67a1fc55adeaa1452920245b1d368f7f`.
- Commits on the base since the merge-base: `26a0d2c212dea452164f51c60b31665043bb3b38`
  (`add a count command`).
- File changed on both sides since the merge-base: `src/users.sh`.
- Changed files (three-dot): `migrations/002_add_status.sh`, `src/users.sh`,
  `tests/test_users.sh`; 3 files changed, 40 insertions(+), 2 deletions(-).

### Expected outcomes

- Ticket ids: `APP-1` (in the main manifest), `APP-2` (only in
  `manifest-missing-title.json`).
- Groups: one ticket group for `APP-1` holding all three changed files; no
  `cross-cutting` group. Tier `low`.
- Drift defect, high, against `APP-1`: the ticket asks for a soft delete (the row stays,
  status set to `inactive`); `deactivate_user` in `src/users.sh` line 21 deletes the row.
  Drift string: `grep -v "^$id," "$USERS_FILE"` (full line
  `    grep -v "^$id," "$USERS_FILE" > "$tmp"`).
- Skipped test: `test_deactivate_keeps_row` in `tests/test_users.sh`, skipped at line 38
  with reason `flaky on CI, fix after release`. It is the test that would catch the drift.
- Decoy: `migrations/002_add_status.sh` line 10, `    exit 0`. It looks like the
  migration quits without migrating; it is correct, because it runs only when the header
  already ends in `,status`, which makes a rerun safe. The comment on lines 7 and 8 says so.
  Expected: `dismissed` with a reason, or absent; it never counts.
- Claims file `session-summary.md`, three sentences after the heading:
  - True claim: `The migration adds a status column whose value is active for every existing row.`
  - False claim: `The full test suite passes with no skipped tests.` (one test is skipped)
  - Claim only production data can settle: `Every existing row was migrated.` Expected:
    `unverified assumption` with a `live check` field, listed in Live checks, counted no
    higher than `medium`.
- Test command: `sh run-tests.sh` (named in `README.md`). It exits 0 and writes the
  ignored file `.test-output/results.txt` (`.gitignore` line 1: `.test-output/`). Its
  output:

  ```
  pass test_list_users
  pass test_migration_adds_status
  skip test_deactivate_keeps_row: flaky on CI, fix after release
  ok tests/test_users.sh
  ```

- Untracked, not ignored: `notes/deactivate-draft.txt`, line 2 holds the drift string.
- `manifest-missing-title.json` stops before stage 1 with `export <path>: missing title`,
  where `<path>` names `exports/APP-2.md`.
- The main manifest runs, and the brief lists `acceptance_criteria` for `APP-1` as
  "not in export".

### Handoff

The five handoff files sit outside every repo, so no commit id above changes. `solo-dirty`
builds on `solo` and has the same five files. `full` has none of them, because its app
commit ids differ.

`handoff.md` holds one bundle `app` (repo `./app`, pr `none`, branch `feature`, base
`main`), the ticket `APP-1` (bundle `app`), decisions `D1` and `D2`, and the raised ticket
`R1`. The commits it lists are the `solo` commits `9c5f77c` and `0c23936`. It passes
`handoff.sh check`. The lines that matter:

| Item | Content | Truth in the fixture |
|---|---|---|
| `APP-1` state | `Active` | False: the export says `In Progress` |
| `APP-1` decision | keeps the row and sets its status to inactive | False: `deactivate_user` deletes the row |
| commit `0c23936` | says it keeps the row | False, for the same reason |
| verified 1 | `Deactivate was checked by hand against a copy of production data; check: not recorded` | Cannot be reproduced |
| verified 2 | `The test suite runs with one test skipped; check: sh run-tests.sh` | True when run |
| `D1` | deactivate removes the row; rejected: keep the row; `decided_by: checkpoint (recommended option taken)`; `recorded_at: checkpoint: plan review`; `status: default taken` | Describes the code |
| `D2` | whether a deactivated user can be reactivated is left for later; `options: none recorded`; `decided_by: not recorded`; `recorded_at: not recorded`; `status: deferred` | An open deferral with no owner |
| `R1` | ticket `APP-6`, bundle `app`, "add accepts a second row with an id that already exists", rank 1, `include`, reason "the bundle introduced it when it changed add_user" | Predates the bundle |

`sh plugins/audit/scripts/handoff.sh claims $F/handoff.md` prints these 11 claims, 4 `code`,
2 `verification`, 2 `decision`, 1 `scope`, 2 `status`. Fields are separated by one tab,
written `<TAB>` here:

```
status<TAB>tickets/APP-1/fields<TAB>app<TAB>APP-1<TAB>14<TAB>APP-1: type Story; state Active; iteration none; owner Developer
code<TAB>tickets/APP-1/problem<TAB>app<TAB>APP-1<TAB>14<TAB>Removing a user deletes the record, so its history is lost.
code<TAB>tickets/APP-1/decision<TAB>app<TAB>APP-1<TAB>14<TAB>Add a deactivate command that keeps the row and sets its status to inactive.
code<TAB>tickets/APP-1/commit/app/9c5f77c<TAB>app<TAB>APP-1<TAB>23<TAB>app 9c5f77c: add the status column migration so every row has a status.
code<TAB>tickets/APP-1/commit/app/0c23936<TAB>app<TAB>APP-1<TAB>24<TAB>app 0c23936: add the deactivate command, which keeps the row and sets its status to inactive.
verification<TAB>tickets/APP-1/verified/1<TAB>app<TAB>APP-1<TAB>26<TAB>Deactivate was checked by hand against a copy of production data; check: not recorded
verification<TAB>tickets/APP-1/verified/2<TAB>app<TAB>APP-1<TAB>27<TAB>The test suite runs with one test skipped; check: sh run-tests.sh
decision<TAB>decisions/D1<TAB>app<TAB>APP-1<TAB>31<TAB>Deactivate removes the row instead of setting a status. | rationale: A removed row needs no change to the reads. | options: chosen: remove the row; rejected: keep the row and set a status; why: every read would need a status filter | decided_by: checkpoint (recommended option taken) | recorded_at: checkpoint: plan review | status: default taken
decision<TAB>decisions/D2<TAB>app<TAB>APP-1<TAB>42<TAB>Whether a deactivated user can be reactivated is left for later. | rationale: not recorded | options: none recorded | decided_by: not recorded | recorded_at: not recorded | status: deferred
scope<TAB>raised/R1<TAB>app<TAB>APP-6<TAB>53<TAB>APP-6: Add accepts a second row with an id that already exists. | rank 1, include: The bundle introduced it when it changed add_user.
status<TAB>raised/R1/fields<TAB>app<TAB>APP-6<TAB>53<TAB>APP-6: type Bug; state New; iteration none; owner none
```

`sh plugins/audit/scripts/handoff.sh commits $F/handoff.md` prints
`app<TAB>9c5f77c<TAB>APP-1<TAB>23` and `app<TAB>0c23936<TAB>APP-1<TAB>24`.

Expected audit outcomes, each only when the stage that judges it completes:

- The `APP-1` state claim, the `APP-1` decision claim, and the `0c23936` commit claim are
  judged false, with the export and `src/users.sh` as the evidence.
- Verified 1 is never `true`. It is `not verified, not reproduced`, and appears in
  `claims-verdicts.md` as a recheck request, not a correction.
- Verified 2 is `true, reproduced` when the auditor ran `sh run-tests.sh` in the
  direct-read `solo` tree; it is `not verified, not reproduced` when that run was not made.
- `D1` is classed `needs owner (not recorded)`: deleting rows is hard to reverse, and no
  person decided.
- `D2` is classed `stale deferral`.
- `R1` is judged `introduced by the bundle: no`, because `add_user` at the merge-base
  `bd5d5e1e67a1fc55adeaa1452920245b1d368f7f` already appends without an id check, and
  `facts disagree with the handoff: yes`. The recommendation itself is not asserted.
- With `manifest-scratch.json`, the run directory lands under `app/.test-output/audit/`.
- With `manifest-working-tree.json`, stage 1 builds the head from the working tree
  (`working-tree.sh build $F/app`, with `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1`):
  head `ba95cc541264a8b32917d14ba729ae9729f76aac`, parent
  `0c23936980b254c4abd489d3ecfd296f5e7bc0db`, tree
  `44cdf018ff3489bd74ad79d5cd4e74b76ff56773`, and one untracked file,
  `notes/deactivate-draft.txt`. The brief lists that file as untracked at audit time and
  maps the app as `direct (working tree)`; `.git/index` is unchanged at the end, and
  Coverage discloses the object writes, that the head has no ref, and the untracked
  file. The file is part of the head, so citing it at the head sha is valid evidence
  here, unlike in an audit of `manifest.json`.

### Verdicts

`git hash-object --no-filters $F/handoff.md` is `1fb12a61bed320e07e48335abb48f9cb455d552e`.
`claims-verdicts.md` holds one claims file heading,
`## $F/handoff.md (handoff), hash 1fb12a61bed320e07e48335abb48f9cb455d552e`, and five
entries, each a main line with `ticket:`, `text:`, and `correction:` sub-lines (`ticket:` is
`APP-1` in all five, the ticket field `handoff.sh claims` prints for each claim):

| Claim | Ref | Verdict | Its `text:` | Expected handling |
|---|---|---|---|---|
| 1 | `tickets/APP-1/fields` | `false` | matches the handoff | applied: the correction (state `In Progress`) is used |
| 3 | `tickets/APP-1/decision` | `false` | does not match the handoff (`Add a deactivate command that keeps the row.`) | reconciliation work, not applied |
| 5 | `tickets/APP-1/commit/app/0c23936` | `contested` | matches | reconciliation work, not applied |
| 6 | `tickets/APP-1/verified/1` | `not verified` | matches | a recheck request: the entry stays under `verified`, its `check:` unchanged unless the session rechecked it |
| 7 | `tickets/APP-1/verified/2` | `true` | matches | nothing to apply |

`claims-verdicts-stale.md` holds the same entries under the heading hash
`0000000000000000000000000000000000000000`, which matches no file, so every entry is
reconciliation work and none is applied.

Expected outcomes of
`/audit:handoff $F/manifest-handoff.json --verdicts <file> --out <output>`, run in a
session whose repository is `$F/app`, each only when the command completes. Paths are
absolute because relative ones resolve against `$F/app`, and `--out` is given because the
fixture app has no scratch directory. `<output>` is a file under `$F` that does not exist
yet, such as `$F/handoff-verdicts.md`; the command writes it:

- With `$F/claims-verdicts.md`: the corrections applied list claim 1 and nothing else; the
  reconciliation list holds claims 3 and 5; the new handoff keeps the verified 1 entry;
  claim 7 is in neither list.
- With `$F/claims-verdicts-stale.md`: no correction is applied, and the reconciliation list
  holds all five claims, each with the hash mismatch as the reason.

### Traps that must not appear

- A finding that the feature deleted or removed `count_users`, the `count` command, or
  the README `count` line. Those come from the base's later commit and show only in a
  two-dot diff.
- A citation of `notes/deactivate-draft.txt` (untracked; invalid evidence).
- The decoy counted as a defect.

### Verify

```sh
A="git -C $F/app"
$A merge-base main feature                  # bd5d5e1e67a1fc55adeaa1452920245b1d368f7f
$A log --format='%H %s' bd5d5e1..main       # 26a0d2c... add a count command
$A diff --name-only bd5d5e1 main            # README.md, src/users.sh
$A diff --name-only main...feature          # migrations/002_add_status.sh, src/users.sh, tests/test_users.sh
$A diff main...feature --stat               # 3 files changed, 40 insertions(+), 2 deletions(-)
$A diff main..feature | grep count_users    # three lines starting with '-': the fake reversal
$A diff main...feature | grep -c count_users   # 0
$A rev-parse --abbrev-ref HEAD              # feature
$A status --porcelain                       # ?? notes/
$A check-ignore .test-output/results.txt    # .test-output/results.txt
grep -n 'grep -v' $F/app/src/users.sh $F/app/notes/deactivate-draft.txt
grep -n 'exit 0' $F/app/migrations/002_add_status.sh     # 10:    exit 0
grep -n '^skip ' $F/app/tests/test_users.sh              # 38:skip test_deactivate_keeps_row ...
grep -c '^title:' $F/exports/APP-2.md                    # 0
grep -c '^acceptance_criteria:' $F/exports/APP-1.md      # 0
```

## solo-dirty

Everything in `solo`, then the changes below. Commits from `solo` keep their ids.

### Head commit of `feature`

`add export probes`, id `6d2c9a58b52f0cd66760feefd29b1d1915d92045`, parent
`0c23936980b254c4abd489d3ecfd296f5e7bc0db`. It adds:

| Path | Content |
|---|---|
| `.gitattributes` | `tests/test_users.sh export-ignore`, `VERSION export-subst`, `probe.txt filter=probe` |
| `VERSION` | `version $Format:%H$` |
| `probe.txt` | one line of text, attribute `filter=probe` |
| `links/outside` | mode `120000` (symlink), target `/etc/hosts` |

### Checkout state

- Checked out on `scratch-branch`, which points at main
  (`26a0d2c212dea452164f51c60b31665043bb3b38`), not at `feature`.
- Modified tracked file: `README.md`, last line `Local edit, not committed.`
- Untracked file: `notes/deactivate-draft.txt` (the one from `solo`; no second one).
- Ignored file present: `.test-output/results.txt`, content `ok tests/test_users.sh`.
- Local config: `filter.probe.smudge` = `sh -c 'touch "$F/filter-ran"; cat'` and
  `filter.probe.process` = `sh -c 'touch "$F/filter-ran"'`, with `$F` written as an
  absolute path. The build sets them last, and no build command runs them, so
  `$F/filter-ran` does not exist after the build. A checkout of `feature` in a copy of
  the repo creates it, which shows the probe is live.

### Expected outcomes

- The app is read from an export under `trees/`; the dirty checkout is unchanged at the end.
- In the export: `tests/test_users.sh` is present (export-ignore not honored), `VERSION`
  still reads `version $Format:%H$`, and `links/outside` is a regular file whose
  content is `/etc/hosts`; the brief lists `links/outside`.
- `$F/filter-ran` does not exist after the run.
- Appending a line to `README.md`, to `notes/deactivate-draft.txt`, or to
  `.test-output/results.txt`, or deleting `.test-output/results.txt`, between two
  stages ends the run `blocked` and names the path.
- After a clean stage, `baseline/1-check.md` lists no ignored-file differences.
- With `manifest-working-tree.json`, the run stops before stage 1 with
  `bundle app: head working-tree needs feature checked out, found scratch-branch`,
  since the checkout is on `scratch-branch`, not `feature`.

### Traps that must not appear

- `$F/filter-ran` existing after a run.
- `VERSION` in the export holding a commit id instead of `$Format:%H$`.
- `tests/test_users.sh` missing from the export.
- The content of `/etc/hosts` anywhere in the run directory.

### Verify

```sh
A="git -C $F/app"
$A rev-parse --abbrev-ref HEAD           # scratch-branch
$A status --porcelain                    # " M README.md" and "?? notes/"
$A status --porcelain --ignored | grep '^!!'   # !! .test-output/
ls -la $F/app/.test-output               # results.txt
$A rev-parse feature                     # 6d2c9a58b52f0cd66760feefd29b1d1915d92045
$A ls-tree feature links/outside         # 120000 blob ... links/outside
$A cat-file -p feature:links/outside     # /etc/hosts
$A show feature:VERSION                  # version $Format:%H$
$A show feature:.gitattributes
$A config --local --get filter.probe.smudge
ls $F/filter-ran                         # No such file or directory
```

## full

Everything in `solo` (app with extra files and commits, ticket exports, claims file),
plus the repos `api`, `legacy`, and `guidelines`. There is no
`manifest-missing-title.json`. The app's commit ids differ from `solo`, because its base
commit has more files.

### Layout

| Path | What it is |
|---|---|
| `$F/manifest.json` | Bundles `./app` (tickets `APP-1`, `APP-3`, `APP-4`, `APP-5`) and `./api` (ticket `API-1`), each branch `feature`, base `main`; reference `legacy` (`./legacy`, ref `main`); sources of truth rank 1 `legacy source` (`./legacy`, ref `main`), rank 2 `guidelines` (`./guidelines`, ref `main`); claims `./session-summary.md` |
| `$F/manifest-groups.json` | The same plus a `groups` key with two entries: `accounts` and `output` |
| `$F/exports/` | `APP-1.md`, `APP-2.md`, `APP-3.md`, `APP-4.md`, `APP-5.md`, `API-1.md` |
| `$F/app` | On `feature`, no tracked changes, untracked `notes/deactivate-draft.txt` |
| `$F/api` | On `feature`, clean |
| `$F/legacy` | Detached at an older commit than `main` |
| `$F/guidelines` | On `main`, clean, about 1 MB of markdown |

### app commits

| Commit | Id | Files |
|---|---|---|
| `initial user records tool` (merge-base) | `6b27db42e063b1881b90f0b4c277d0a8ce2f3ab3` | solo's files plus `.gitattributes`, `config/settings.ini`, `src/export.sh`, `src/output.sh` |
| `APP-1: add status column migration` | `909a5186760b952463e561b7b8ffa254fe9774fe` | `migrations/002_add_status.sh`, `tests/test_users.sh` |
| `APP-1: add deactivate command` | `b56d1014729f12dc419e848564d5a908c93a4c67` | `src/users.sh`, `tests/test_users.sh` |
| `add a count command` (main head) | `a561bd9df3fa1f989f70cbad1756a5988613802f` | `README.md`, `src/users.sh` |
| `APP-3: paginate the user list` | `f543701150a8c73173285750243dec598fe9c998` | `config/settings.ini`, `src/output.sh`, `tests/test_output.sh` |
| `APP-4: short export keys as an option` | `262fad8c7cc3f312ecf6a119259882a86bb0dd00` | `config/settings.ini`, `src/export.sh`, `src/output.sh` |
| `APP-5: audit log for commands` (feature head) | `191e0ad183ea7509077bff3fd3b462d57d4b70e1` | `src/audit-log.sh`, `src/output.sh` |

Changed files (three-dot): `config/settings.ini`, `migrations/002_add_status.sh`,
`src/audit-log.sh`, `src/export.sh`, `src/output.sh`, `src/users.sh`,
`tests/test_output.sh`, `tests/test_users.sh`.

### Other repos

- api: main `9b9c1d5ed3a4b4c2cfa14b2f7175c8907656242e` (`initial importer`, the
  merge-base), feature head `a3e9b3223c3c82385d1d9f197d5f02323efdd116`
  (`API-1: log skipped import lines`, changes `bin/import-users.sh`, 3 insertions).
- legacy: `main` is `b3b208f6b760091e46d601739e93d43ee9f0bce7`
  (`legacy: deactivate keeps the row`); the checkout is detached at
  `2f21951b0c72eba8ccf5b3db9b4481ade113f8bd` (`legacy: list users`), which has no
  `deactivate`. Pinned ref `main`.
- guidelines: 57 tracked files, 1,116,252 bytes of markdown in all, in `style/`,
  `testing/`, `security/`, `operations/`, `data/`, `reviews/`, plus `README.md`; one
  commit, `guidelines corpus`, id `cfda47bf5fddf8bd2e82d8da1892391aabc68580`.

### Expected outcomes

Everything listed for `solo` about `APP-1` holds (drift, skipped test, decoy, claims),
with the line numbers given there. In addition:

- Ticket ids: `APP-1`, `APP-3`, `APP-4`, `APP-5` (app), `API-1` (api).
- The `MUST` rule, the only line with `MUST` in the corpus:
  `` Every shell script MUST run `set -eu` before its first command. ``, at
  `style/shell-scripts.md` line 5. The app breaks it in `src/audit-log.sh` (added by
  `APP-5`), which has no `set -eu`; every other `.sh` file in the app has it. The
  finding cites `style/shell-scripts.md` at the guidelines' pinned sha, not a digest.
- API break, found by the interaction auditor: `config/settings.ini` sets
  `export_keys=short` (line 4, `APP-4`), so `src/export.sh` writes `uid=<id>` (line 12,
  `KEY_ID=uid`) instead of `user_id=<id>`; api `bin/import-users.sh` reads only
  `user_id=` lines (line 8), so it imports nothing and, on `feature`, logs every record
  as `skip:`. `APP-4` also asked for the default `long`, so it is drift too.
- Legacy is read from an export at `b3b208f6b760091e46d601739e93d43ee9f0bce7`, not its
  checkout; its `deactivate` keeps the row and sets status `inactive`, which supports the
  `APP-1` drift finding.
- File touched by three tickets: `src/output.sh` (`APP-3`, `APP-4`, `APP-5`). It goes to
  `cross-cutting` and is listed in each former group with a note. Expected derived
  groups: `APP-1` (`migrations/002_add_status.sh`, `src/users.sh`,
  `tests/test_users.sh`), `APP-3` (`config/settings.ini`, `tests/test_output.sh`),
  `APP-4` (`config/settings.ini`, `src/export.sh`), `APP-5` (`src/audit-log.sh`),
  `cross-cutting` (`src/output.sh`), and the api's ticket group `API-1`
  (`bin/import-users.sh`). No merge: `APP-3` and `APP-4` each have exactly half their
  files in the other.
- With `manifest-groups.json`: exactly the groups `accounts`, `output`, and
  `unticketed` (`unticketed` holds the api's `bin/import-users.sh`, which no entry
  matches).
- Contested finding, `convention`: `formatRow` in `src/output.sh` line 20 (`APP-4`)
  breaks `` Function names SHOULD use snake_case, for example `print_rows`, not `printRows`. ``
  at `style/naming.md` line 5. Pass two downgrades it and the second opinion disputes it; it ends
  `contested` and counts at its lower severity.
- Contested finding, `verified fact`: `print_page` in `src/output.sh` (`APP-3`) sets
  `end=$((start + size))` (line 15), so a page prints `size + 1` rows: page 1 with size 2
  prints 3 rows. The comment on line 14 (`# sed ranges are inclusive, so the page ends at
  start + size.`) and the passing `tests/test_output.sh` (3 rows, page size 5) read the
  other way. It counts at its higher severity.
- CRLF file touched by two tickets: `config/settings.ini` (`APP-3`, `APP-4`), marked
  `-text` in `.gitattributes`. Feature content, every line ending `\r\n`: `[app]`,
  `name=users`, `page_size=500` (line 3, `APP-3`; the ticket says default 50),
  `export_keys=short` (line 4, `APP-4`; the ticket says default `long`). Act commits on
  it keep `\r\n` endings.

### Traps that must not appear

- solo's traps.
- A `MUST` finding citing a digest instead of `style/shell-scripts.md`.
- A legacy finding citing the detached checkout's `bin/users.sh` (no `deactivate`).
- `config/settings.ini` rewritten with `\n` line endings by act.

### Verify

```sh
cd $F
git -C app merge-base main feature                 # 6b27db42e063b1881b90f0b4c277d0a8ce2f3ab3
git -C app log --format=%s --name-only main..feature -- src/output.sh    # APP-3, APP-4, APP-5
git -C app show feature:config/settings.ini | od -c | head   # \r \n after each line
git -C app ls-files --eol config/settings.ini      # i/crlf ... attr/-text
git -C guidelines grep -n MUST main                # exactly one line: style/shell-scripts.md:5
git -C guidelines grep -n SHOULD main              # exactly one line: style/naming.md:5
git -C guidelines ls-files | wc -l                 # 57
(cd guidelines && git ls-files -z | xargs -0 cat | wc -c)   # 1116252 (du -sk varies with block size)
git -C legacy rev-parse HEAD                       # 2f21951b0c72eba8ccf5b3db9b4481ade113f8bd
git -C legacy rev-parse main                       # b3b208f6b760091e46d601739e93d43ee9f0bce7
git -C api diff --stat main...feature              # bin/import-users.sh | 3 +++
grep -L 'set -eu' $(git -C app ls-files '*.sh' | sed 's|^|app/|')   # app/src/audit-log.sh
```

## tokens

One repo, `app`, and four exported tickets with bare-number ids. It shares nothing with
`solo`: its commit ids are its own. It checks the `ticket_token` bundle key.

### Layout

| Path | What it is |
|---|---|
| `$F/manifest.json` | One bundle: `./app`, branch `feature`, base `main`, tickets `file:./exports/4567.md` to `4570.md`; no `ticket_token` |
| `$F/manifest-token.json` | The same bundle with `"ticket_token": ["#{n}", "[{n}]", "AB#{n}"]` |
| `$F/manifest-bad-token.json` | The same bundle with `"ticket_token": "#n"` |
| `$F/exports/4567.md` to `4570.md` | Ticket exports with ids `4567`, `4568`, `4569`, `4570`; no text names a file |
| `$F/app` | The app repo, checked out on `feature` |

### Commits

| Commit | Id | Branch | Files |
|---|---|---|---|
| `initial app` | `253d888eaa67c7c99b5f3d33a808835db8b6db39` | merge-base, main head | `README.md`, `src/app.sh` |
| `fix(#4567 #4568): reject empty input` | `2c91be9d37d6d3ba48068a20da316c7e6e70a245` | feature | `src/input.sh` |
| `build 4567 passed` | `e38ebff437050f6ce3653d0908515336d83bcfc3` | feature | `ci/status.txt` |
| `[4569] add the report command` | `04ccf504e5efa62a444f69a2edcd40d5d42e9180` | feature | `src/report.sh` |
| `AB#4570 rename the config key` | `dcae97565a63bbd4f6a52b6f9e1647530a32dd6f` | feature | `config/app.conf` |
| `migrated 4567 rows` | `b12b94c3072b10e1b5b5f4eace49e598e5ef093c` | feature head | `data/migration.txt` |

Changed files (three-dot): `ci/status.txt`, `config/app.conf`, `data/migration.txt`,
`src/input.sh`, `src/report.sh`. The tier is `medium` (1 bundle, 4 tickets, under 5,000
changed lines).

### Expected outcomes

Groups, worked out from Stage 1, "Groups", step 8 (rule 1, then extraction and merge; no
ticket text or commit message names a file, so rule 2 adds nothing):

- `manifest.json` (no token, so the bare id matches under the boundary rule alone):
  - `4567` matches `fix(#4567 #4568)`, `build 4567 passed`, and `migrated 4567 rows`;
  - `4568` matches `fix(#4567 #4568)`;
  - `4569` matches `[4569]`;
  - `4570` matches `AB#4570`.

  Groups: `app-4567` (`ci/status.txt`, `data/migration.txt`, `src/input.sh`), `app-4568`
  (`src/input.sh`), `app-4569` (`src/report.sh`), `app-4570` (`config/app.conf`). No file
  is in more than two groups, so nothing moves to `cross-cutting`. No merge: `app-4567`
  has one of its three files in `app-4568`, which is not more than half. No `unticketed`
  group.
- `manifest-token.json` (`#{n}`, `[{n}]`, `AB#{n}`):
  - `#4567` and `#4568` match only `fix(#4567 #4568)`; `build 4567 passed` and
    `migrated 4567 rows` hold no `#4567`, `[4567]`, or `AB#4567`;
  - `[4569]` matches `[4569] add the report command`;
  - `#4570` does not match `AB#4570` (a letter comes right before `#`), and `AB#4570`
    does.

  `ci/status.txt` and `data/migration.txt` are touched only by the build and migration
  commits, which name no ticket, so both go to `unticketed`. `app-4567` and `app-4568` each
  hold only `src/input.sh`, so each has all its files in the other and they merge into
  `app-4567+app-4568`. Groups: `app-4567+app-4568` (`src/input.sh`), `app-4569`
  (`src/report.sh`), `app-4570` (`config/app.conf`), `unticketed` (`ci/status.txt`,
  `data/migration.txt`).
- `manifest-bad-token.json` stops before stage 1 with
  `bundle app: ticket_token must hold {n} once`.

### Verify

```sh
A="git -C $F/app"
$A rev-parse main                          # 253d888eaa67c7c99b5f3d33a808835db8b6db39
$A log --reverse --format='%H %s' main..feature
$A diff --name-only main...feature         # ci/status.txt config/app.conf data/migration.txt src/input.sh src/report.sh
grep -c ticket_token $F/manifest.json      # 0
```

## patterns

One repo, `app`, and three exported tickets, with a planted case for each of four
patterns and a decoy for each. It shares nothing with `solo`: its commit ids are its own.
The manifest carries the bundle key `run_once`; it has no claims file. No comment, name,
commit message, or ticket text says that anything is wrong. Whether an audit finds a case
is not decided here: `docs/acceptance.md` records it per audit run, as observed, not
assumed.

### Layout

| Path | What it is |
|---|---|
| `$F/manifest.json` | One bundle: `./app`, branch `feature`, base `main`, tickets `file:./exports/PAT-1.md` to `PAT-3.md`, `"run_once": ["migrations/*.sh"]`; no `claims` |
| `$F/exports/PAT-1.md` to `PAT-3.md` | Ticket exports with ids `PAT-1`, `PAT-2`, `PAT-3`, in the format of `APP-1`; no `acceptance_criteria` |
| `$F/app` | The app repo, checked out on `feature`, not rebased onto `main`, no tracked changes |

### Commits

| Commit | Id | Branch | Files |
|---|---|---|---|
| `initial user records tool` | `72ca6912e7a55ef653f72a0667089e4d5b7c2a69` | merge-base | `.gitignore`, `data/users.csv`, `migrate.sh`, `migrations/001_create_users.sh`, `run-tests.sh`, `src/log.sh`, `src/reactivate.sh`, `src/users.sh`, `tests/test_users.sh` |
| `PAT-1: reject non-numeric ids in deactivate` | `e110cb26a794a40b733341d9ca397425c9b55bc1` | feature | `src/users.sh`, `tests/test_users.sh` |
| `PAT-2: add the warning count command` | `0c71299be23374e60d05f77fc1a0c292a945e9e6` | feature | `src/warnings.sh`, `tests/test_log.sh` |
| `PAT-3: add the email and last_login columns` | `7bdaa0e61667de685db3a70f204a3918fb53413f` | feature head | `migrations/001_create_users.sh`, `migrations/002_add_last_login.sh`, `tests/test_users.sh` |
| `log: lowercase the warning prefix` | `d84a2ec3bcdc1282bf12524ae08e24bf7928a7c8` | main head, the base's later commit | `src/log.sh` |

- Merge-base: `72ca6912e7a55ef653f72a0667089e4d5b7c2a69`.
- Commits on the base since the merge-base: `d84a2ec3bcdc1282bf12524ae08e24bf7928a7c8`
  (`log: lowercase the warning prefix`). It changes `src/log.sh` only, which no feature
  commit touches, so `main` merges into `feature` without a conflict.
- Changed files (three-dot): `migrations/001_create_users.sh`,
  `migrations/002_add_last_login.sh`, `src/users.sh`, `src/warnings.sh`,
  `tests/test_log.sh`, `tests/test_users.sh`; 6 files changed, 71 insertions(+).
- The test command is `sh run-tests.sh`. At the head it exits 0 and prints `pass` for
  every test, 6 in all, and `ok` for both test files; at the merge-base it runs 2 tests.
- `migrate.sh` writes its journal to `data/applied.txt`, which `.gitignore` lists.

### Expected outcomes

The ticket ids are `PAT-1`, `PAT-2`, `PAT-3`. Each case below gives where the defect is,
the finding that describes it, and the decoys that must not count. A decoy that counts is
a trap, and `docs/acceptance.md` records it as one.

**P17: a sibling that lacks the check (`PAT-1`).**

- Location: `src/reactivate.sh` lines 8 to 13, `reactivate_user`. It handles `id=$1`
  the way `deactivate_user` did before the change, with no check, and the file is not in
  the diff. The feature adds the check to `deactivate_user` in `src/users.sh` lines 25
  to 30.
- Expected finding: `reactivate_user` accepts a non-numeric id (`sh src/reactivate.sh abc`
  exits 0 and prints nothing), although `deactivate_user` now rejects it with
  `invalid id`. The ticket names only `deactivate`, so the finding is about the sibling
  that has the same id handling, not about a ticket requirement.
- With the outward trace, the `PAT-1` scope's entry for `deactivate_user` names
  `reactivate_user` as a sibling, with the shared contract (the same id argument and the
  same `users.csv` row match) and the finding's id.
- Decoys: `list_users` (`src/users.sh` line 8) takes no id and correctly has no check.
  `add_user` (lines 13 to 21) already rejects a bad id.

**P18: a test that passes without the change (`PAT-1`).**

- Location: `tests/test_users.sh` lines 25 to 27, `test_deactivate_rejects_bad_id`. It
  runs `grep -q "invalid id" src/users.sh`. The string exists at the merge-base, in
  `add_user` (`src/users.sh` line 16), so the test passes with the feature's change to
  `src/users.sh` reverted, and nothing runs `deactivate` with a bad id.
- Expected finding: the test would not catch a regression in what the ticket asks, that
  `deactivate` rejects a non-numeric id. The finding quotes the test and names the
  regression it misses: `deactivate` accepting `abc`.
- Decoy: `test_deactivate_keeps_row` (lines 29 to 32) runs `deactivate 2` and asserts that
  the row is still there with status `inactive`. It covers a different behavior and
  passes at the merge-base too, but it does not claim to test the rejection, so it does
  not count as a weak test of `PAT-1`.

**P19: a base change to what a fix matches on (`PAT-2`).**

- Location: `src/warnings.sh` line 7, `grep -c '^WARN:' "$1"`. The producer is `log_warn`
  in `src/log.sh` line 6, `printf 'WARN: %s\n' "$*"`, at the merge-base and at the head.
  Commit `d84a2ec3bcdc1282bf12524ae08e24bf7928a7c8` on `main` changes it to
  `printf 'warning: %s\n' "$*"`. The feature does not change `src/log.sh`.
- Expected finding: after the merge, `log_warn` writes lines that start `warning: `, and
  `count_warnings` counts 0 for them. The command that `PAT-2` asks for reports no
  warnings. The finding names the base commit.
- Also expected, a second case of the P18 pattern: `tests/test_log.sh` lines 8 to 10
  write their own `WARN:` lines instead of calling `log_warn`, so the test pins the
  producer's text without running it and passes after the merge. A finding that says so
  is correct, not a decoy that counts.
- Decoy: the count at the head, 2 for two `log_warn` lines, is right.

**P20: an edit to a run-once script that may already be applied (`PAT-3`).**

- Location: `migrations/001_create_users.sh` lines 11 to 15, the block that appends
  `,email` to the header and an empty field to each row. The file exists at the
  merge-base and matches `run_once` (`migrations/*.sh`). The block works on a fresh
  install: `sh migrate.sh` over the tracked seed gives `email` and `last_login`.
- Expected finding: an install where `001_create_users.sh` is in the journal
  (`data/applied.txt`) never runs the edited file again, because `migrate.sh` skips a
  name it has recorded, so that install gets `last_login` and no `email` column. That
  001 is not yet applied in every target environment is an `unverified assumption`, with
  a `live check`: whether `001_create_users.sh` is in the journal of each target.
  Severity no higher than `medium`.
- Decoy: `migrations/002_add_last_login.sh` is a new file, and a rerun is a no-op because
  of its guard on lines 7 to 9. It must not count, as a defect or as an edited run-once
  file. The guard in the edited 001 (line 11) makes a rerun of 001 a no-op too; that is
  not the finding.

### Behavior checks

`verify.sh` runs these in temp copies made with `git archive` or a temp clone, so the
fixture repo never changes. Each failed check prints one line that starts with the case.

- P17: at the head, `sh src/users.sh deactivate abc` exits non-zero with `invalid id`;
  `sh src/reactivate.sh abc` exits 0 with no output and leaves `data/users.csv` as it was.
- P18: with `src/users.sh` from the merge-base and the head's `tests/test_users.sh`,
  `sh tests/test_users.sh` exits 0, prints `pass test_deactivate_rejects_bad_id` and
  `pass test_deactivate_keeps_row`, and `sh src/users.sh deactivate abc` exits 0 with no
  output.
- P19: at the head, two `log_warn` lines give a count of 2. In a clone of `feature` after
  `git merge origin/main` (no conflict), two `log_warn` lines are `warning: ` lines and
  the count is 0.
- P20: install at the merge-base (run `migrate.sh` over the tracked seed, so the journal
  holds `001_create_users.sh`), copy `data/` into the head tree, run the head's
  `migrate.sh`. It prints only `applied 002_add_last_login.sh`, the header is
  `id,name,status,last_login` with no `email`, a second run prints nothing, and a direct
  rerun of 002 leaves the file as it was. A fresh install at the head (empty journal)
  prints `applied 001_create_users.sh` and `applied 002_add_last_login.sh`, the header is
  `id,name,status,email,last_login`, and a direct rerun of 001 and 002 leaves the file as
  it was.

### With `manifest-revert.json`

Stage 1 step 6b runs `tests/test_log.sh` and `tests/test_users.sh` with `sh`, in a copy of
the head and in a copy of the merge-base with `tests/` at its head state.
`tests/revert-tests.sh` (case 12) checks these verdicts:

- `tests/test_log.sh`: passes at head only. Without the change `src/warnings.sh` is
  absent, and the file exits 1.
- `tests/test_users.sh`: passes at head only. In the reverted copy its tail prints
  `pass test_deactivate_rejects_bad_id` and `pass test_deactivate_keeps_row` before
  `test_migration_adds_last_login` fails, since `migrations/002_add_last_login.sh` is
  absent there (exit 127 under bash, 2 under dash). The two passing lines show P18 by a
  run: under `common.md`'s "Reverted test runs", a changed test that passes by name in
  the reverted copy passes without the change, whatever the file's verdict.

### Verify

```sh
A="git -C $F/app"
$A merge-base main feature                  # 72ca6912e7a55ef653f72a0667089e4d5b7c2a69
$A log --format='%H %s' 72ca691..main       # d84a2ec... log: lowercase the warning prefix
$A diff --name-only 72ca691 main            # src/log.sh
$A diff --name-only main...feature          # migrations/001_create_users.sh migrations/002_add_last_login.sh src/users.sh src/warnings.sh tests/test_log.sh tests/test_users.sh
$A diff --shortstat main...feature          # 6 files changed, 71 insertions(+)
$A rev-parse --abbrev-ref HEAD              # feature
$A status --porcelain                       # no output
grep -n 'invalid id' $F/app/src/users.sh    # 16 and 27
grep -n 'WARN:' $F/app/src/log.sh $F/app/src/warnings.sh   # log.sh:6, warnings.sh:5 and 7
grep -c claims $F/manifest.json             # 0
sh tests/audit/fixture/verify.sh $F/manifest.json patterns        # verify patterns: ok
```

## review

One repo, `app`, two exported tickets and two manifests, one bundle each, for the
`REVIEW.md` rules of requirement 271. The first bundle's base holds a root `REVIEW.md`;
the second bundle makes the same change on a base with no `REVIEW.md` and adds the file
in its own commit, so the copy exists only in its head. Two base branches in one repo
keep the change, and so the findings, the same in both runs: only where `REVIEW.md` sits
differs. It shares nothing with `solo`: its commit ids are its own. No comment, name,
commit message, or ticket text says that anything is wrong. Whether an audit finds a
defect is not decided here: `docs/acceptance.md` records it per audit run (item 37).

### Layout

| Path | What it is |
|---|---|
| `$F/manifest.json` | Bundle one: `./app`, branch `feature`, base `main`, ticket `file:./exports/REV-1.md` |
| `$F/manifest-head-only.json` | Bundle two: `./app`, branch `head-only`, base `stable`, ticket `file:./exports/REV-2.md` |
| `$F/exports/REV-1.md`, `REV-2.md` | Ticket exports with ids `REV-1`, `REV-2`, in the format of `APP-1`; no `acceptance_criteria` |
| `$F/app` | The app repo, checked out on `feature`, no tracked changes |

`build.sh` prints `$F/manifest.json`; `manifest-head-only.json` sits beside it.

### Commits

| Commit | Id | Branch | Files |
|---|---|---|---|
| `initial job queue` | `14dc41fefcbab707adab0407318f5cfe46a3519d` | `stable`, merge-base of `head-only` | `README.md`, `data/jobs.csv`, `src/jobs.sh`, `tests/test_jobs.sh`, `vendor/strutil.sh` |
| `add the review instructions` | `7f893c4b5139561ff0aefb62edcbe039205f654a` | `main`, merge-base of `feature` | `REVIEW.md` |
| `REV-1: number jobs from a counter file` | `a5a49bd6121bc2988418810805376ee6d13389b1` | `feature` head | `src/jobs.sh`, `tests/test_jobs.sh`, `vendor/strutil.sh` |
| `REV-2: number jobs from a counter file, with review instructions` | `48b9701adebc8b87c620f4a52ff62fcf1ce5a9cb` | `head-only` head, on `stable` | `REVIEW.md`, `src/jobs.sh`, `tests/test_jobs.sh`, `vendor/strutil.sh` |

- Changed files (three-dot), bundle one: `src/jobs.sh`, `tests/test_jobs.sh`,
  `vendor/strutil.sh`; 3 files changed, 21 insertions(+), 6 deletions(-).
- Changed files (three-dot), bundle two: `REVIEW.md`, `src/jobs.sh`, `tests/test_jobs.sh`,
  `vendor/strutil.sh`; 4 files changed, 34 insertions(+), 6 deletions(-). Its
  `src/jobs.sh`, `tests/test_jobs.sh` and `vendor/strutil.sh` are those of `feature`.
- Each bundle has 1 ticket and under 500 changed lines, so the tier is `low`.
- `REVIEW.md` candidates (stage 1, step 6d): `REVIEW.md`, `src/REVIEW.md`,
  `tests/REVIEW.md` and `vendor/REVIEW.md`. `git ls-tree --full-tree <rev> -- <those>`
  prints `100644 blob d6131b7ab9ec0909709e0474674ad2ca589fb45e`, a tab and `REVIEW.md` at `main`,
  `feature` and `head-only`, and nothing at `stable`.
- The tests are `sh tests/test_jobs.sh`, from the repo root; they pass at every branch.

### `REVIEW.md`

The same 13 lines at `main` and in the head of `head-only`. Its three rules:

| Line | Rule | Kind |
|---|---|---|
| 5 | `- Report style nits as notes at most.` | severity calibration |
| 9 | ``- Do not report findings in `vendor/`.`` | do not report |
| 13 | `- Require a file:line citation for any concurrency finding.` | require evidence |

### Expected outcomes

Both bundles hold the same four defects; the head file lines are the same in both.

- Concurrency: `src/jobs.sh` lines 11 to 15, `next_id`, reads `data/next_id` and writes
  the next value with no lock, so two `add` calls at once can read the same id and write
  two rows with it. The ticket asks that an id is never reused. A quote of these lines
  with the causal explanation is a `verified fact` with a `file:line` citation. The race
  is not run here: its outcome depends on timing.
- Style nit: `src/jobs.sh` line 12 uses backticks, where the rest of the file uses
  `$(...)`.
- Vendored edit: `vendor/strutil.sh` line 5, `tr -d ' \t'`, deletes every blank, so
  `sh src/jobs.sh add 'nightly backup'` stores `nightlybackup`. The base version kept the
  inner blank. The file's header says it is copied from upstream. The defect shows in what
  `src/jobs.sh` stores, so the `vendor/` rule may not cover it.
- Vendored only: `vendor/strutil.sh` line 11, `repeat`, loops while `$i -le $2`, so
  `repeat ab 2` prints `ababab`; the base used `-lt` and printed `abab`. No file outside
  `vendor/` calls `repeat`, so the defect is in `vendor/` alone and the `vendor/` rule
  covers it.

With `manifest.json`, the report's header names `REVIEW.md` at
`7f893c4b5139561ff0aefb62edcbe039205f654a`; the nit shows at `note` at most, with its
reviewed severity; the `repeat` finding, with any other found in `vendor/` alone, leaves
the body and is counted in one line, `<n> findings skipped by REVIEW.md: <rule>`, with
`<n>` 1 or more; the concurrency finding shows the
require-evidence rule, met or held.

With `manifest-head-only.json`, the brief says `REVIEW.md: none at the base` and
`head-only REVIEW.md not applied: REVIEW.md`; the report's header says none applied at
the base and names the head-only copy; no severity is calibrated, no finding is skipped
and no gate is raised.

### Behavior checks

`verify.sh` runs these in temp copies made with `git archive`, so the fixture repo never
changes.

- `sh tests/test_jobs.sh` exits 0 at `main`, `feature`, `stable` and `head-only`.
- `sh src/jobs.sh add 'nightly backup'` leaves `data/jobs.csv` as `id,name` and
  `1,nightly backup` at `main` and `stable`, and as `id,name` and `1,nightlybackup` at
  `feature` and `head-only`, where `data/next_id` then holds `2`.
- `. vendor/strutil.sh; repeat ab 2` prints `abab` at `main` and `stable` and `ababab` at
  `feature` and `head-only`, where `git grep -l repeat <rev> -- src tests` prints nothing.

### Verify

```sh
A="git -C $F/app"
$A merge-base main feature                  # 7f893c4b5139561ff0aefb62edcbe039205f654a
$A merge-base stable head-only              # 14dc41fefcbab707adab0407318f5cfe46a3519d
$A diff --name-only main...feature          # src/jobs.sh tests/test_jobs.sh vendor/strutil.sh
$A diff --name-only stable...head-only      # REVIEW.md src/jobs.sh tests/test_jobs.sh vendor/strutil.sh
$A ls-tree --full-tree stable -- REVIEW.md  # no output
$A rev-parse --abbrev-ref HEAD              # feature
sh tests/audit/fixture/verify.sh $F/manifest.json review          # verify review: ok
```

## ground-truth

One repo, `svc`, a records import service in shell over CSV files, with ticket and pull
request exports and a claims file. It plants the 20 cases of
`tests/audit/fixture/ground-truth-cases.md` under their ids, S1 to H2, with the decoys each case
names. It shares nothing with the other fixtures. No comment, name, commit message,
ticket, or PR text says that anything is wrong. The PR bodies and the claims state what
the author believes, and five of those beliefs are false: S1's filter, S5's parity, T1's
waiver after the merge, C1's fail-closed import, and T2's coverage. Whether an audit finds a case is not decided here:
`docs/acceptance.md` records it per audit run, as observed, not assumed.

### Layout

| Path | What it is |
|---|---|
| `$F/manifest.json` | Two bundles on `./svc`, seven groups, `"claims": ["./session-summary.md"]` |
| `$F/exports/GT-0.md` to `GT-14.md`, no `GT-11.md` | Ticket exports with ids `GT-0` to `GT-14`, in the format of `APP-1`. `GT-0` is the merged sibling of `GT-5`, state `Done`, in no bundle. `GT-11` belongs to the other open pull request and has no export |
| `$F/exports/PR-1.md`, `PR-2.md` | Pull request exports with `id`, `url`, `title`, `body`, and provenance; `PR-1` has two threads |
| `$F/session-summary.md` | The build session's claims, one per ticket of bundle 1 |
| `$F/svc` | The repo, checked out on `feature`, no tracked changes, with branches `main`, `feature`, `gt-11-lookup`, `target`, and `stacked` |

Bundle 1: `./svc`, `pr: file:./exports/PR-1.md`, branch `feature`, base `main`,
`"run_once": ["migrations/*.sh"]`, tickets `GT-1` to `GT-10`, `GT-12`, and `GT-13`.
Bundle 2: `./svc`, `pr: file:./exports/PR-2.md`, branch `stacked`, base `target`, ticket
`GT-14`. Its branch is not checked out, so stage 1 reads it from an export of its head.
Thirteen tickets select `high`; an audit to compare with `patterns` passes
`--effort medium`.

The groups, each on `./svc`: `import-api` (S1, S2), `records` (S3, S4, S5), `bulk-rules`
(T1, C1, C2), `sql` (T2), `harness` (T3, T4, T5, C3, H1, H2), `migrations` (R1, R2, R3,
B2), and `stacked` (B1, `tests/scenarios_fetch/**`). No file is in two groups.

`PR-1`'s body lists the tickets, says of `GT-5` "items are optional for invoices, so
invoices now match orders (GT-0).", says of `GT-6` "If the settings cache cannot be read,
the import fails closed and rolls back.", and ends "Related: PR-3 (branch gt-11-lookup),
open against main, changes the lookup function for GT-11." Its threads:

- On `migrations/f_rank_gt13.sh` line 1, dated 2026-08-20: build 1.4.0-17 from this branch
  is on the shared test environment, whose journal then lists `001_create_schema.sh`,
  `002_records_columns.sh`, `003_records_pk.sh`, `f_audit_ops8.sh`, `f_lookup_ops7.sh`,
  and `f_rank_gt13.sh`, the order a fresh install of that build writes.
- On `tests/connection.sh` line 6, dated 2026-09-13: a logged connection line from a dev
  run, `Host=localhost;Database=svc;Username=svc_writer;Password=********`.

`PR-2`'s body is "Built on GT-14 (target)."

### Commits

| Commit | Id | Date | Branches | Files |
|---|---|---|---|---|
| `initial records import service` | `68541c48ed0e097c448180e9405c6a5b57b2a788` | 2026-06-01 | all | 57 files, among them `migrations/f_audit_ops8.sh`, `f_lookup_ops7.sh`, and `f_rank_ops9.sh` |
| `schemas: describe the study fields` | `19bb7943d81f5a6395ddd0e0ffe9e3080427ed4e` | 2026-06-22 | main, feature, gt-11-lookup, target | `schemas/study.json` |
| `GT-14: list the records with a status` | `ad42be4cb6a8e96b6e362b73a20d92e9a239b047` | 2026-07-02 | stacked | `tests/steps.sh` |
| `GT-14: add the update date to fetch_row` | `90179b16ccd54e549f6075596cde8bb8e0f0e1d7` | 2026-07-06 | stacked | `tests/steps.sh` |
| `steps: print the status first in fetch_row` | `b5bcfd802719df31dadadbd0dbfed34aea94bdb4` | 2026-07-10 | main, feature, gt-11-lookup, target | `tests/steps.sh` |
| `GT-0: stop requiring items on orders` | `b4cb796c71cc3ebaf11b211d57244592af62e833` | 2026-07-15 | main, feature, gt-11-lookup, target | `spec/orders.yml`, `spec/public/orders.yml`, `src/validate.sh` |
| `migrations: make the records key (id, type)` | `120f2bf261e9140e1cc81c57e07b1780236ee6b9` | 2026-07-28 | main, feature, gt-11-lookup, target | `migrations/003_records_pk.sh` |
| `docs: describe the commands` | `08081290881379bc6b7cfcd97a951b602513cf07` | 2026-08-14 | merge-base of `main` and `feature` | `README.md` |
| `GT-1: add the contract import endpoint` | `741a5e76fc60d8e37209bd437e03430a36665e88` | 2026-08-17 | feature | `src/handlers.sh` |
| `GT-13: rename the rank function script` | `face5b6264f805300d4ede99ba1295f2d5df39b0` | 2026-08-18 | feature | `migrations/f_rank_ops9.sh` to `f_rank_gt13.sh` (R088) |
| `GT-7: waive the flag error in bulk imports` | `0ed4041b6ca3f60b25248d27dc7ee42997b3128b` | 2026-08-19 | feature | `src/waiver.sh`, `tests/scenario_bulk.sh`, `tests/test_waiver.sh` |
| `GT-2: skip ineligible targets in related links` | `c50227fffaad9ba71359be4fbe893119c900aab2` | 2026-08-21 | feature | `src/links.sh`, `src/sweep.sh` |
| `GT-3: use the category reference in the person and org schemas` | `265206be0fa2f799264f2ca91429fb99ccdd7641` | 2026-08-22 | feature | `schemas/org.json`, `schemas/person.json`, `tests/test_schemas.sh` |
| `GT-4: write source_id when a site is created` | `a9997c92a63e2ac01020cc6266e14701d8dd9844` | 2026-08-24 | feature | `src/upsert.sh`, `tests/test_upsert_site.sh` |
| `rank function: skip rows without a score` | `732d4ba45e409dc7b8557f6a270fe6703cf4dc81` | 2026-08-25 | main, gt-11-lookup, target | `migrations/f_rank_ops9.sh` |
| `GT-5: make items optional for invoices` | `06afe9d377b8dafffbe6f9b8821439f44a448c22` | 2026-08-26 | feature | `src/validate.sh` |
| `GT-8: update the sql functions` | `0671734d45718043c434b3e25ab358dba3804743` | 2026-08-27 | feature | `sql/fn_guard.sql`, `sql/fn_order.sql`, `sql/fn_touch.sql`, `sql/trg_reread_json.sql`, `tests/test_sql_contract.sh` |
| `validator: prefix messages with the field path` | `a1dfff3c10661eda96738aa5cc949fd35deabf78` | 2026-08-29 | main head, gt-11-lookup, target | `src/validator.sh` |
| `GT-11: ignore deleted rows in the lookup function` | `f142c6e594cbb9fc9dc2da3a24b9b295fa61ef1b` | 2026-08-31 | gt-11-lookup head | `migrations/f_lookup_ops7.sh` to `f_lookup_gt11.sh` (R072) |
| `GT-6: follow the tenant settings in bulk imports` | `542a0d68a247ea82311e2ae11a41ab621785d7c5` | 2026-09-01 | feature | `src/bulk_import.sh`, `tests/test_bulk_import.sh` |
| `GT-10: add the office columns to the records key migration` | `7dacf80a10d149729f8cfac6d360a9e60695a3c7` | 2026-09-02 | feature | `migrations/003_records_pk.sh` to `003_records_pk_and_columns.sh` (R067) |
| `GT-12: match hrn ignoring case in the lookup function` | `c0522a3bcf59db79eaf358b9708dfd4c14d7dc74` | 2026-09-03 | feature | `migrations/f_lookup_ops7.sh` to `f_lookup_gt12.sh` (R073) |
| `GT-13: skip rows without a score in the rank function` | `222dc8c4b80cffe3f30d03a212e6ddd67178596a` | 2026-09-04 | feature | `migrations/f_rank_gt13.sh` |
| `GT-13: rename the audit function script` | `d2cb15c1d3c6ad4b94bbaef8bd6c60a63752a12e` | 2026-09-05 | feature | `migrations/f_audit_ops8.sh` to `f_audit_gt13.sh` (R061) |
| `GT-14: list the records with a status` | `77c261626555d680acd1f914954af7943424d5cc` | 2026-09-06 | target | `tests/steps.sh` |
| `GT-14: add the update date to fetch_row` | `54368f2585210328bd9a5360fe0aa3d1681a0027` | 2026-09-07 | target head | `tests/steps.sh` |
| `GT-9: add the dates scenario` | `44f026393f3b97e89d61faba0745ec199210276a` | 2026-09-08 | feature | `tests/scenario_dates.sh` |
| `GT-9: add the read and status steps` | `fcee9fd478c918392e2943ab76db544e5b5abc2a` | 2026-09-09 | feature | `tests/scenarios_steps.sh`, `tests/steps.sh` |
| `GT-9: add the report scenarios` | `3ca386280c2a6a4130f5b6e43a1363d2b605819d` | 2026-09-10 | feature | `env/dev/accounts.txt`, `tests/scenario_report_audit.sh`, `tests/scenario_report_read.sh` |
| `GT-9: add the record fetch step` | `4a321695576df33adfa0efd81b1ae2c1947cbe98` | 2026-09-11 | feature | `tests/scenario_fetch_record.sh`, `tests/steps_db.sh` |
| `GT-14: add the fetch scenarios` | `4aa559a282f955bff0b698214260a2e8770c51dc` | 2026-09-12 | stacked head | `tests/scenarios_fetch/by_id.sh`, `tests/scenarios_fetch/by_status.sh`, `tests/steps.sh` |
| `GT-9: add the hrn lookup scenario` | `2a88b28b4d9e9c6d028964eb5864dda8624327a7` | 2026-09-12 | feature head | `tests/scenario_hrn_lookup.sh`, `tests/steps_db.sh` |

- Merge-base of `main` and `feature`: `08081290881379bc6b7cfcd97a951b602513cf07`.
  Commits on `main` since it: `732d4ba` and `a1dfff3`. `main` merges into `feature`
  without a conflict; git follows the rank script's rename.
- Changed files (`main...feature`, `-M`): 32 files, 266 insertions(+), 19 deletions(-).
  The renames are `003_records_pk.sh` to `003_records_pk_and_columns.sh` (R067),
  `f_audit_ops8.sh` to `f_audit_gt13.sh` (R061), `f_lookup_ops7.sh` to `f_lookup_gt12.sh`
  (R073), and `f_rank_ops9.sh` to `f_rank_gt13.sh` (R081), all under `migrations/`.
- `gt-11-lookup` branches from `main`'s head and is in no bundle. `main...gt-11-lookup`
  shows `f_lookup_ops7.sh` to `f_lookup_gt11.sh` (R072).
- `target` holds the two `GT-14` commits rebuilt on `main`'s head. `stacked` holds the
  earlier two, `ad42be4` and `90179b1`, on the initial commit. Merge-base of `target`
  and `stacked`: `68541c48ed0e097c448180e9405c6a5b57b2a788`. `target..stacked` lists
  `4aa559a`, `90179b1`, and `ad42be4`. `target...stacked`: `tests/scenarios_fetch/by_id.sh`,
  `tests/scenarios_fetch/by_status.sh`, and `tests/steps.sh`; 3 files changed, 30
  insertions(+), 2 deletions(-). The two-dot `target stacked` diff, which a forge shows,
  is 11 files changed, 28 insertions(+), 44 deletions(-); no export carries it.
- `.gitignore` lists `.test-output/`, `data/applied.txt`, `data/schema.txt`, and
  `data/functions.txt`. `migrate.sh` journals each applied name in `data/applied.txt`
  and skips a name already there.
- At the head, `sh run-tests.sh` exits 0 with `ok` for its six test files.
  `sh tests/run_scenarios.sh` exits 1 under `ENV=dev`, with `FAIL fetch_record` and the
  rest passing. Under `ENV=qa` it also prints `FAIL report_read` and
  `skip scenario_report_audit`.

### Expected outcomes

Each case gives the ticket, where the defect is, the finding that describes it, the
reviewer's severity from the case set, and the decoys that must not count. A decoy that
counts is a trap, and `docs/acceptance.md` records it as one. The case set also says why
the original review missed each case; this section does not repeat it. Lines are at the
`feature` head unless a commit is named.

**S1: one of three arms gets the filter (`GT-2`, medium).**

- Location: `src/links.sh` lines 30 to 52, the type A and type B arms of
  `related_links`, which print every linked target. The feature adds `eligible` to the
  direct arm only (line 26). `src/sweep.sh` lines 7 to 9 read only `data/relations.csv`.
- Expected finding: `K2` reaches `X9` (`rejected`) through type B
  (`data/via_b.csv` line 1). `related_links K2` still prints `K2,X9`,
  `sh src/importer.sh import K2` prints `rejected K2` and exits 1, and the sweep prints no
  line for it. A finding on the type A arm alone is the same defect.
- Decoy: the direct arm's `K3,X2` is filtered, the sweep prints `dropped K3,X2`, and
  `sh src/importer.sh import K3` prints `imported K3`. `GT-2` asks for that: the importer
  imports such a record without the dropped link. A finding that `K3` should still be
  rejected is a trap.

**S2: a new endpoint without the guard (`GT-1`, high).**

- Location: `src/handlers.sh` lines 52 to 54, `import_contract`, copied from
  `import_document` (lines 47 to 50) without `enforce_import_right "$role" || return 1`.
  `tests/test_import_rights.sh` line 12 lists the six older endpoints.
- Expected finding: any role can import a contract.
  `sh src/handlers.sh import_contract viewer k1` exits 0 and writes `contract,k1`, while
  `import_document` exits 1 with `forbidden: role viewer may not import`.
- Decoy: `health` (lines 56 to 59) has no guard and needs none: it takes no record and
  writes nothing.

**S3: two of four schemas fixed (`GT-3`, medium).**

- Location: `schemas/site.json` line 6 and `schemas/study.json` line 7 still declare
  `"category": {"type": "string"}`. The feature changes `person.json` (line 9) and
  `org.json`, and `tests/test_schemas.sh` covers those two. `GT-3` names all four.
- Expected finding: `site.json` takes the same change. `study.json` cannot be loaded:
  commit `19bb794` left a trailing comma, and `jq empty schemas/study.json` fails with
  `parse error` at line 8.

**S4: a test that pins the lossy update (`GT-4`, medium).**

- Location: `src/upsert.sh` lines 49 to 56, `upsert_site`, writes the incoming
  `source_id` on update. `upsert_person` (lines 31 to 38) and `upsert_org` (lines 40 to
  47) keep the stored one when the incoming one is empty.
  `tests/test_upsert_site.sh` lines 16 to 19, `test_update_replaces_source_id`, asserts
  the loss.
- Expected finding: an update that omits `source_id` empties it for a site (`9,N,`),
  where a person keeps it (`9,N,src-9`). The new test freezes that, so a fix must change
  a test.

**S5: the code half of a sibling change (`GT-5`, low).**

- Location: `src/validate.sh` line 10 no longer requires `items` for invoices.
  `spec/invoices.yml` and `spec/public/invoices.yml` still list `- items` under
  `required:` (line 7). `GT-0`'s commit `b4cb796` changed the code and both order specs.
- Expected finding: the published invoice contract still requires `items`, so the PR
  body's parity with `GT-0` holds for the code only.

**T1: a waiver that matches the old message (`GT-7`, high).**

- Location: `src/waiver.sh` line 6, `grep -vxF "$FLAG_REQUIRED"`, removes the line
  `flag is required`. The producer is `src/validator.sh` line 10 at the merge-base and the
  head. `main`'s `a1dfff3`, ten days after the waiver commit, makes it print
  `record.flag: flag is required`. `tests/test_waiver.sh` lines 6 to 9 build their input
  from the same constant, and `tests/scenario_bulk.sh` line 11 accepts an empty result or
  the flag message.
- Expected finding: after the merge, the waiver removes nothing: a record without a
  flag still has `record.flag: flag is required` in the waiver's output, the error the
  waiver exists to remove. The unit test passes before and after, and the scenario
  passes either way. The finding names the base commit.

**T2: text checks counted as coverage (`GT-8`, medium).**

- Location: `tests/test_sql_contract.sh` lines 31 to 43 add text checks for
  `fn_touch.sql`, `fn_guard.sql`, and `fn_order.sql`; nothing checks
  `sql/trg_reread_json.sql`, whose lines 4 to 8 the feature changes. No script outside
  `tests/` reads a `.sql` file. The claim is `session-summary.md` lines 15 and 16.
- Expected finding: nothing runs the SQL, so the claim is false. The trigger change has no
  check at all: the contract test passes with `trg_reread_json.sql` at the merge-base.
  `fn_order.sql`'s check (lines 41 to 43) asserts statement order only.

**T3: a control that never runs (`GT-9`, low).**

- Location: `tests/scenario_dates.sh` lines 13 and 14. The header (lines 3 and 4) calls
  the second assertion a control, but `assert_eq` (`tests/lib.sh` lines 6 to 13) exits on
  a failure, and the controlled assertion comes first.
- Expected finding: when the updated date is wrong, the scenario exits 1 after line 13,
  and the control never prints, in the case it was written for.

**T4: a step that reads the previous scenario's row (`GT-9`, low).**

- Location: `tests/steps.sh` line 6, `LAST_ROW`, set by `step_read_record` (lines 14 to
  16) and read by `step_assert_active` (lines 19 to 29). `tests/run_scenarios.sh` runs
  the function scenarios in one process with no reset. `scenario_assert_only`
  (`tests/scenarios_steps.sh` lines 15 to 18) asserts without reading.
- Expected finding: `scenario_assert_only` alone fails with `run the read step first`;
  after `scenario_read_active` in the same process it passes on that scenario's row.

**T5: a role the skip tag does not name (`GT-9`, low).**

- Location: `tests/scenario_report_read.sh` line 3 tags `api_user` only, and line 8 reads
  as `report_reader`, which only `env/dev/accounts.txt` lists (line 3). `tests/hook.sh`
  skips on the tagged roles only.
- Expected finding: under `ENV=qa` the scenario runs and fails with
  `accounts file env/qa/accounts.txt has no role report_reader` instead of being skipped.
- Decoy: `tests/scenario_report_audit.sh` tags both roles (lines 3 and 4) and is skipped
  on qa.

**C1: a callee that fails two ways (`GT-6`, high).**

- Location: `src/bulk_import.sh` lines 22 and 23 call `get_setting`.
  `src/settings.sh` lines 22 to 36: `cache timeout` and `cache unavailable` return 2, and
  the import fails; any other read error prints an empty value and returns 0.
- Expected finding: one cache failure stops the whole batch (a missing cache: exit 1,
  `records.csv` unchanged). Any other read failure, such as a directory in place of the
  cache, turns every setting-keyed rule off for the batch with no message: a batch
  without offices is imported. The PR body and the claims (`session-summary.md` line 12)
  describe only the first branch.

**C2: a third rule on the same key (`GT-6`, medium).**

- Location: `src/rules.sh` lines 30 to 32, the `office_code` rule, keyed on
  `require_office`. The merge-base passed `null`, which turns every rule on; the feature
  passes the tenant's two settings (`src/bulk_import.sh` line 24). `GT-6` names only the
  flag and office rules.
- Expected finding: with `require_office=no`, a record with an office and no
  `office_code` is imported, where the merge-base rejects it with
  `office_code is required`. No ticket, PR line, or test covers the change.
- Decoys: the `flag is required` rule (lines 24 to 26) and the `office is required` rule
  (lines 27 to 29) follow the settings too, and `GT-6` asks for that. A finding that
  they changed is a trap. Only the `office_code` rule is outside the ticket.

**C3: a store read without the tenant (`GT-9`, medium).**

- Location: `tests/steps_db.sh` lines 47 to 55, `step_fetch_record`, runs
  `src/store.sh fetch` without `APP_TENANT`. `src/store.sh` lines 8 to 13 return no rows
  when it is unset. The older steps read `data/audit.csv` through `tests/dbclient.sh`,
  which has no tenant filter.
- Expected finding: the step fails with `expected 1 row, got 0`, which reads as missing
  data; with `APP_TENANT=acme` it passes.
- Decoy: `PR-1`'s thread on `tests/connection.sh` shows `Password=********`.
  `log_connection` (lines 9 to 13) masks the password on purpose, and
  `connection_string` (line 6) passes the real one. A finding that the helper drops the
  password is a trap.

**H1: a read as the writer account (`GT-9`, medium).**

- Location: `tests/scenario_hrn_lookup.sh` lines 3 and 8 run a two-column read as
  `svc_writer`, the account the service writes with (`src/upsert.sh` line 7,
  `env/dev/accounts.txt` line 1).
- Expected finding: the scenario needs a read-only role; with the writer's account, a
  copied step can write to the service's tables.
  No tree holds the grants. `src/upsert.sh` line 7 and its `wrote ... as $DB_ACCOUNT`
  message are the only sign of the account's rights.
- Decoys: `tests/scenario_report_read.sh` line 8 and `tests/scenario_report_audit.sh`
  line 9 read as `report_reader`, and the unchanged `tests/scenario_audit_event.sh` reads
  as `api_user`. No tree shows either account writing, so a finding that they hold too
  many rights has no support. `tests/test_upsert_site.sh` runs `src/upsert.sh`, whose
  statements write, so it correctly runs as the writer.

**H2: a built query where a bound one exists (`GT-9`, low).**

- Location: `tests/steps_db.sh` lines 57 to 61, `step_find_by_hrn`, doubles quotes
  (line 59) and builds `where hrn = '<value>'` (line 60). `query_param` (lines 25 to 28)
  binds a value.
- Expected finding: use `query_param`; the built form is sound only while the quoting
  rule holds, and the next copy may take untrusted input.

**R1: a rename that reruns a key rebuild (`GT-10`, medium).**

- Location: `migrations/003_records_pk_and_columns.sh` lines 12 to 15, the unconditional
  drop and add of the `pk:` line, the same as `003_records_pk.sh` at the merge-base. The
  feature adds the column step (lines 17 to 19) and renames the file (R067).
  `migrate.sh` lines 9 to 16 journal by name.
- Expected finding: every install that journaled `003_records_pk.sh` runs the renamed
  file and rebuilds the key again (`rebuilt pk`). A guard that only checks for a `pk:`
  line is wrong: an older install's `pk: id` is what this block moves to `pk: id,type`.
  The guard must compare the key's columns, and it must still let the column step (lines
  17 to 19) run on an install that journaled the old name. The run-once rule checks a
  rename for repeated work. The key step is repeated work: an install that journaled
  `003_records_pk.sh` already has `pk: id,type`. The finding is an `unverified
  assumption`, at most `medium`, with a `live check` on the journal for
  `003_records_pk.sh`.
- Decoys for this rule: `f_lookup_gt12.sh` (R073) and `f_audit_gt13.sh` (R061). Each
  has one step that installs the function's definition, and the rename changes that
  definition, so an install that ran the old name does not have the new one yet. A
  finding that one of them repeats work on a rerun is a false positive. `f_rank_gt13.sh`
  (R081) is the same against the merge-base, but `main`'s `732d4ba` gives
  `f_rank_ops9.sh` the same score filter, so on an install that ran that later body the
  renamed script sets the same definition again. A `low` finding that says so is right,
  not a decoy hit. Findings about these files for R2 (the collision), R3 (a journaled name with
  a later body), or B2, and a finding that the columns step is not guarded (a second
  rerun), are other findings.

**R2: two open pull requests rename one script (`GT-12`, high).**

- Location: `migrations/f_lookup_gt12.sh`, renamed from `f_lookup_ops7.sh` (R073) with a
  new body (line 13). `gt-11-lookup` renames the same file to `f_lookup_gt11.sh` (R072)
  with another body. `PR-1`'s body names that pull request and its branch.
- Expected finding: merging both stops on a rename/rename conflict over
  `f_lookup_ops7.sh`, and each plain resolution loses a change. Kept as two files, both
  define `lookup`, and the later in name order, `f_lookup_gt12.sh`, replaces `GT-11`'s
  deleted-row filter wherever both run. Kept under the name the first merge deployed, the
  script is journaled and skipped wherever that ran. The fix is a name neither has used,
  with both bodies. No export lists `PR-3`'s files; the evidence is the branch and the
  body line.

**R3: a journaled name with a later body (`GT-13`, medium).**

- Location: `migrations/f_rank_gt13.sh` line 13, the score guard, copied in `222dc8c`
  from `main`'s `732d4ba`. The rename `face5b6` had no guard, and `PR-1`'s thread of
  2026-08-20 shows the shared environment's journal with `f_rank_gt13.sh`.
- Expected finding: deploying the head there skips `f_rank_gt13.sh`, so the guard never
  runs in that environment. Whether the journal still holds the name is an `unverified
  assumption`, with a `live check` on the shared environment's journal.

**B2: a rename and an edit in one commit (`GT-13`, low).**

- Location: commit `d2cb15c`, `migrations/f_audit_ops8.sh` to `f_audit_gt13.sh` with a
  body change; git scores it R061 and `git log --follow` reaches the initial commit.
- Expected finding: a forge that shows this as a deletion and an addition breaks the
  file's history in that view; a rename-only commit before the edit avoids it. No forge
  view is exported, so a `none` here measures missing evidence as well as detection.

**B1: a branch on the target's old commits (`GT-14`, bundle 2, medium).**

- Location: the `stacked` branch. Its merge-base with `target` is the initial commit,
  `68541c4`, and its `GT-14` commits `ad42be4` and `90179b1` repeat `target`'s
  `77c2616` and `54368f2` by message. `tests/scenarios_fetch/by_id.sh` line 6 and
  `by_status.sh` line 7 cut field 3 of `fetch_row`'s comma line. `target`'s `fetch_row`
  (`tests/steps.sh` line 11) prints `status=<s> id=<id> updated=<date>`.
- Expected finding: `stacked` was not updated after `target` was rebuilt. Merging
  `target` into it conflicts in `tests/steps.sh`, and with `target`'s side taken both new
  scenarios exit 1. The finding cites the merge-base and the duplicated commits, not the
  PR body.

### Behavior checks

`verify.sh` runs these in temp clones of `svc`, so the fixture repo never changes. Each
failed check prints one line that starts with the case. Merges run with `--no-ff` and a
fixed identity.

- S1: at the head, `related_links K2` prints `K2,X9`; `sh src/importer.sh import K2`
  prints `rejected K2` and exits 1; `sh src/sweep.sh` prints only `dropped K3,X2`;
  `sh src/importer.sh import K3` prints `imported K3` and exits 0. The `GT-2` export says
  the importer then imports such a record without the link.
- S2: `sh src/handlers.sh import_contract viewer k1` exits 0 and writes `contract,k1`;
  `import_document viewer k1` exits 1.
- S3: `jq empty schemas/study.json` exits non-zero; `site.json`'s category is
  `{"type":"string"}`; `person.json` and `org.json` have the reference.
- S4: a create then an empty-source update gives `9,N,` for a site and `9,N,src-9` for a
  person; `sh tests/test_upsert_site.sh` exits 0.
- S5: `sh src/validate.sh invoice id customer` prints `valid`; `- items` appears once in
  each invoice spec and in neither order spec. `sh src/validate.sh unknown id customer`
  exits 2 with `unknown kind unknown`, so no defect outside the cases sits there.
- T1: at the head, a record without a flag gives no output after the waiver. In a clone
  of `feature` after a merge of `main` (exit 0), it gives
  `record.flag: flag is required`. `tests/test_waiver.sh` and `tests/scenario_bulk.sh`
  exit 0 at the head and after the merge.
- T2: `tests/test_sql_contract.sh` exits 0 at the head and with
  `sql/trg_reread_json.sql` from the merge-base; no file matching `*.sh` outside `tests/`
  contains `psql` or `.sql`.
- T3: with record 1's updated date changed to `2026-08-09`, `tests/scenario_dates.sh`
  exits 1, prints the failure of `updated date of record 1`, and prints no line for
  `created date of record 1`.
- T4: `sh tests/run_scenarios.sh scenario_assert_only` prints `run the read step first`
  and exits 1; with `scenario_read_active` first it exits 0.
- T5: `ENV=qa sh tests/run_scenarios.sh report_read report_audit` prints the
  accounts-file error, `FAIL report_read`, and `skip scenario_report_audit`, and exits 1;
  under `ENV=dev` both pass.
- C1: a 3-record batch with no cache file exits 1 and leaves `records.csv` unchanged, with
  no staging file left; a batch of three records without an office, with a directory in
  place of the cache, exits 0 and imports all three.
- C2: with `require_flag=yes` and `require_office=no`, `4,Edsger,yes,north,` is imported
  at the head; at the merge-base the same batch exits 1 with `office_code is required`.
- C3: `step_fetch_record 1` prints `expected 1 row, got 0` and fails; with
  `APP_TENANT=acme` it prints `fetched record 1`.
- H1 and H2: the literal lines above, by `grep -n`.
- R1: over a journal holding `003_records_pk.sh`, the head's `migrate.sh` prints
  `rebuilt pk` and `applied 003_records_pk_and_columns.sh`. An older install with
  `pk: id` ends with `pk: id,type`.
- R2: the two rename lines and scores above. In a clone of `main`, a merge of
  `gt-11-lookup` exits 0, and a merge of `feature` after it exits non-zero with
  `migrations/f_lookup_gt11.sh` and `migrations/f_lookup_gt12.sh` unmerged. With both
  files kept, running `f_lookup_gt11.sh` then `f_lookup_gt12.sh` leaves one `lookup:`
  line, `lookup: select id from audit where lower(hrn) = lower(?)`.
- R3: `face5b6`'s `f_rank_gt13.sh` has no `score is not null`, the head's has one; a
  fresh install at `face5b6` writes the journal the thread lists, in its order; over
  that journal, the head's `migrate.sh` prints no `defined rank` line.
- B2: the rename line and score above, and `git log --follow` lists `d2cb15c` then
  `68541c4`.
- B1: the merge-base and `target...stacked` above; a merge of `target` into a clone of
  `stacked` exits non-zero with `tests/steps.sh` unmerged; with `target`'s side of that
  file, both `tests/scenarios_fetch/*.sh` exit 1; at the `stacked` head both exit 0.
- Isolation: after the checks, the five branch heads and `svc`'s status are as built.

### With `manifest-revert.json`

Stage 1 step 6b runs bundle 1's eleven changed files under `tests/test_*.sh` and
`tests/scenario_*.sh` with `sh`, in a copy of the head and in a copy of the merge-base
with the test code (the default `test_paths`, so all of `tests/`) at its head state.
`tests/revert-tests.sh` (case 13) checks these verdicts:

- Passes at head and without the change: `tests/scenario_dates.sh` (T3's file) and
  `tests/scenario_hrn_lookup.sh` (H1's file).
- Does not pass at head: `tests/scenario_fetch_record.sh`, exit 1 with
  `expected 1 row, got 0` (C3).
- Passes at head only: `tests/scenario_bulk.sh`, `tests/scenario_report_audit.sh`,
  `tests/scenario_report_read.sh`, `tests/test_bulk_import.sh`, `tests/test_schemas.sh`,
  `tests/test_sql_contract.sh`, `tests/test_upsert_site.sh`, and `tests/test_waiver.sh`.
  In the reverted copy, `tests/test_sql_contract.sh` prints
  `pass test_stamp_has_no_null_placeholder` and `pass test_stamp_notifies_nobody`, and
  `tests/test_bulk_import.sh` prints `pass test_imports_the_batch`, before a later test
  fails.

Bundle 2 has no test keys.

### Verify

```sh
A="git -C $F/svc"
$A merge-base main feature                  # 08081290881379bc6b7cfcd97a951b602513cf07
$A merge-base target stacked                # 68541c48ed0e097c448180e9405c6a5b57b2a788
$A log --format=%h 0808129..main            # a1dfff3 732d4ba
$A diff --shortstat main...feature          # 32 files changed, 266 insertions(+), 19 deletions(-)
$A diff --shortstat target...stacked        # 3 files changed, 30 insertions(+), 2 deletions(-)
$A rev-parse --abbrev-ref HEAD              # feature
$A status --porcelain                       # no output
ls $F/exports                               # GT-0.md to GT-10.md, GT-12.md to GT-14.md, PR-1.md, PR-2.md
sh tests/audit/fixture/verify.sh $F/manifest.json ground-truth    # verify ground-truth: ok
```
