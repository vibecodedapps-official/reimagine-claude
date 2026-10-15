# Stage 9: act

Stage 9 runs only on `/audit:act <run-id> <item-id...> [--per-item]`, after a run has
written its report, and it is the audit's one write phase. The read-only boundary of a
run does not apply, but every write below waits for the user's yes, and no commit
message, ticket text, pull request text or drafted comment names a model, an agent or a
tool. Act takes the run id and the item ids the user approved and never widens that
list. It changes the user's checkout on the bundle's branch, never the exports under
`trees/`, and it leaves the audit's state and `runs.json` as they are. Inputs: the run's
entry in `${CLAUDE_PLUGIN_DATA}/runs.json`, `report.md`, `converged.md`, `manifest.json`,
`audit-brief.md`, `stages.json` (the audited bundle shas) and `act/log.md` when it
exists. Outputs: `act/log.md`, appended to and never rewritten, holding every action,
check result and commit sha; the saved diffs, patches and messages under `act/`; and the
commits the user approved. Record this invocation's block as
`${CLAUDE_PLUGIN_ROOT}/skills/audit/SKILL.md`, "Invocation block", says; after a
compaction, read the item ids and `--per-item` from the block recorded there.

## Steps

1. **Bind the approval.**
   1. Find the run in `runs.json`. `report.md` is the line `revision: sha256:<hex>`, one
      LF, then the body. Recompute the hash over those bytes with Bash, never from the
      Read tool's text, and compare it with the first line:

      ```
      tail -n +2 <run dir>/report.md | { sha256sum 2>/dev/null || shasum -a 256; }
      head -n 1 <run dir>/report.md
      ```

      When they differ, the report was edited after it was written: stop and say so.
   2. Every item id must name a `C<n>` item of the report. An unknown id stops act; no
      id is added or guessed.
   3. Show each approved item: id, title, severity, gate, disposition, tickets,
      repository, files and recommended change, with the report revision. Say when an
      item is `provisional`, `contested` or `dismissed`.
   4. When a Live checks block is open, its `status` `not run: not approved` or
      `under review`, warn. For a bundle that is not a GitHub pull request and whose
      brief records no `-> <remote>/...` mapping for its branch, the recorded head was
      read from the local branch act is about to change: a commit, rebase or merge that
      moves it makes `--live` refuse the import, so import first if the results matter.
      For a pull request bundle, whose recorded head is its `headRefOid`, or a bundle
      with a mapping line, say that a local change leaves the recorded head where it is
      and a push that updates the pull request or the mapped ref moves it.
   5. Ask the user to confirm, then log `approve` with the run id, revision, item ids,
      `--per-item` and time. The approval is bound to that run, that revision and those
      items. Before every commit, rebase or merge, recompute the revision as in step
      1.1; when it differs from the approved one, stop.

2. **Check each repository** an approved item's recommended change names:
   - `git -C <repo> rev-parse --abbrev-ref HEAD` equals the bundle's branch;
   - `git -C <repo> status --porcelain --untracked-files=no` prints nothing: no
     modified tracked file and no staged change.

   Otherwise stop and say what differs. Act never stashes, resets, cleans or checks
   out. Untracked files do not stop it: list the `??` lines of
   `git -C <repo> status --porcelain --untracked-files=all` in `act/log.md`, and never
   stage them. A clean tracked tree is required here even for paths a check is known to
   regenerate; changes a check makes are handled in step 4.

3. **Detect drift.** Take the bundle's audited head from `stages.json` and list
   `git -C <repo> rev-list <audited head>..HEAD`. A commit `act/log.md` records as act's
   own is expected; any other commit is drift, and so is an audited head that is not
   an ancestor of `HEAD` (`git -C <repo> merge-base --is-ancestor <audited head> HEAD`).

   A logged `rebase` or `merge` entry is an act-owned move from its old head to its new
   one. When that new head is an ancestor of `HEAD`, the latest such new head takes the
   audited head's place in the list above, and later commits are judged the same way;
   an audited head that is not an ancestor is not drift when a logged rebase explains
   the rewrite. An unlogged rewrite or an unfinished operation is never act's own.

   A bundle with `head: working-tree` has an audited head no branch ever held, so its
   drift is judged by tree. Take `head_tree` from `stages.json`. Let `B` be the parent
   of the first act commit `act/log.md` records for this run that is an ancestor of
   `HEAD`, else `HEAD`; with a logged rebase or merge whose new head is an ancestor of
   `HEAD`, `B` is the latest such new head and the tree comparison is skipped for that
   explained move. Drift is `git -C <repo> rev-parse B^{tree}` differing from
   `head_tree`, or a commit in `git -C <repo> rev-list B..HEAD` that act did not log. A
   clean `HEAD` audited as it stands, or a rewritten history with the same tree, is not
   drift. On drift here, say the committed tree differs from the audited one and show
   `git -C <repo> log --oneline -5 B`.

   Show any drift (`git -C <repo> log --oneline` for the commits) and ask before going
   on. Log the answer as `drift`.

4. **Baseline checks and regenerated files.** Before the first change in each
   repository, run its required checks (from its `AGENTS.md`, `CLAUDE.md`, `README.md`,
   CI configuration or package scripts) and the checks that cover the approved items.
   Log each command, where it ran, its exit status and its failures as `baseline`,
   failures already present included.

   Around every check run, baseline or later, save the worktree diff and the index
   diff under `<run dir>/act/` before it and compare both after it:

   ```
   git -C <repo> diff --no-ext-diff --no-textconv --binary --full-index --no-color
   git -C <repo> diff --cached --no-ext-diff --no-textconv --binary --full-index --no-color
   ```

   A tracked path whose diff changed is one the check rewrote; hunks already in the
   saved diff, such as another group's unstaged hunks, are not. When a check rewrote a
   tracked path, stop, show the path and its diff, and ask once whether to record it as
   a regenerated path and restore it after this and later identical runs. Capture its
   diff by byte-preserving redirect:

   ```
   git -C <repo> diff --no-ext-diff --no-textconv --binary --full-index --no-color -- <path> > <run dir>/act/regen-<n>.diff
   ```

   Nothing is restored unless that command exits 0. On a clear yes, hash the saved file
   with `sha256sum`, or `shasum -a 256` where that is missing, log
   `- <time> <repo> regen <path>: approved diff <file>, sha256 <hash>`, and run
   `git -C <repo> restore -- <path>`. Without a yes, stop. The approval covers that
   repository, path and saved diff only, and that path is never staged with a group;
   when a group's intended fix touches it, stop and ask rather than discard intended
   hunks as regeneration.

   After each later check run, capture a changed regenerated path the same way. Only an
   exit of 0 and a byte-identical comparison with the saved approved diff permit the
   restore; log the file, hash, comparison and restore result as `regen`. A different
   diff, or a change to any other tracked path, stops and is shown, and may be approved
   as a new saved diff by the same procedure. A failed capture or comparison never
   permits a restore. A check must leave the index as staged: an index diff that
   differs from the saved one stops and is shown, never restored by this rule.

   Before the first edit, read the instruction files that apply to each file a group
   touches: `AGENTS.md`, `CLAUDE.md` and the files they index, at the root and in each
   directory on the file's path, and the user's own `CLAUDE.md` in
   `$CLAUDE_CONFIG_DIR`, else `~/.claude`, with the files it indexes. Those files decide
   where a documented fact goes. When a recommended change puts a rationale, history
   note, decision, how-to or ticket number where they exclude it, stop and show the
   place they name before editing.

5. **Group the items.** Group by ticket and repository, from each item's work-item
   impact; an item with several tickets goes to the first listed, noted in the log, and
   an item with no ticket is a group of its own. With `--per-item`, every item is its
   own group. Order the groups by the manifest's ticket order, then by item id.

6. **A rebase or merge item first.** When an item's fix is to rebase or merge the
   branch onto another ref, it runs apart from the edit path and before any group
   commit in that repository in this invocation.
   1. Show the exact `git -C <repo> rebase <ref>` or `git -C <repo> merge <ref>` and the
      item ids, and ask in words; when `act/log.md` holds act commits on that branch,
      name them as commits a rebase rewrites.
   2. Record `HEAD` before the command, `<old head>`, and the target ref with its
      resolved tip. Record the branch's publication ref: the branch of the same name on its
      push remote (`branch.<branch>.pushRemote`, else `remote.pushDefault`, else
      `branch.<branch>.remote`), not the ref it tracks, which can be the base. When more
      than one remote could supply it, or the branch is published under another name,
      ask which. Read its tip with `git -C <repo> ls-remote <remote> refs/heads/<name>`,
      which moves no ref, and record it, or `none` for both when the remote has no such
      branch; a failed read gives `force push owed: unknown` with the error.
   3. Recompute the revision, confirm a clean tracked tree and index, and run the
      approved command. A conflict stops: show
      `git -C <repo> diff --name-only --diff-filter=U --no-ext-diff`, log the stop, and
      resolve, continue or abort nothing without the user's words. Any other failure
      stops with its exit status and output.
   4. After success, record the new `HEAD` and decide `force push owed` in this order,
      any exit other than 0 or 1 stopping with the error:
      1. `git -C <repo> cat-file -e <publication tip>^{commit}` fails: `unknown`, the
         published tip is not in the local repository.
      2. `git -C <repo> merge-base --is-ancestor <publication tip> <old head>` exits 1:
         `unknown`, the publication ref has commits `<old head>` lacks; say to
         integrate them before any push.
      3. `git -C <repo> merge-base --is-ancestor <publication tip> <new head>`: exit 0
         gives `no`, exit 1 gives `yes`.

      With no publication ref, or after a failed read, it is `unknown`, and say which.
   5. Log the move in the form of step 9, rerun the covering and required checks under
      step 4's rule, and compare them with the baseline. An introduced failure stops
      every group in that repository: show it with `<old head>`, and go on only on
      the user's words. No group commit is made for a fix the new head already holds.

7. **One commit per group,** one group at a time, in each repository it touches:
   1. Record `git -C <repo> ls-files --eol -- <files>` for each file the group touches.
   2. Make the group's change in the checkout.
   3. Run `git -C <repo> ls-files --eol -- <files>` again. Each file's working-tree line
      endings (`w/crlf`, `w/lf`, mixed) must be what they were; restore them before
      staging when an edit changed them.
   4. Stage the group's change, never a recorded regenerated path. When no other
      approved group touches the same file, the file holds only this group's hunks.
      When one does, stage only this group's hunks from a byte-exact patch written by
      shell redirect, never by a file-writing tool, keeping only this group's hunks:

      ```
      git -C <repo> diff --binary --no-color --no-ext-diff --no-textconv -- <file> > <run dir>/act/patches/<group>.patch
      git -C <repo> apply --cached --check <run dir>/act/patches/<group>.patch
      git -C <repo> apply --cached <run dir>/act/patches/<group>.patch
      ```

      When this group's hunks overlap or touch another group's, stop and ask. After
      staging, confirm with `git -C <repo> ls-files --eol` that each file's index line
      endings are unchanged.
   5. Rerun the checks that cover the change, then the required checks, after each
      group's staging, applying step 4's rule after every run.
   6. Compare each result with the baseline. A check that passed then and fails now is
      **introduced**: say so and offer no commit until the user decides. A failure
      present at baseline is **preexisting**: report it; it is not act's to fix.
   7. Show the staged diff
      (`git -C <repo> diff --cached --no-ext-diff --no-textconv --no-color`) and both
      results against the baseline, and ask before committing.
   8. On yes, recompute the revision, write the message to
      `<run dir>/act/msg-<group>.txt`, and run `git -C <repo> commit -F <file>`. The
      message follows the repository's convention, read from its `git log`, and names
      no model, agent or tool, with no trailer that does. No hook is skipped and
      `--no-verify` is never passed; when a hook fails, stop and report it.
   9. Log the commit.

8. **No push and no forge edits.** Act never pushes, and never edits a ticket or a pull
   request unless the user says so for that item. Work-item fixes and decision comments
   from the report are shown as drafts, and so are the operations of
   `work-items.jsonl`, none of which act applies. When the user says to post one for an
   item, post that one only, its text free of model, agent and tool names, and log it
   with its URL as `post`.

9. **`act/log.md`.** Append one line per action, in order:

   ```
   - <time> <repo> <action>: <command or decision>; <result or exit status>
   ```

   Actions: `approve`, `check-repo`, `drift`, `baseline`, `stage`, `check`, `commit`,
   `rebase`, `merge`, `regen`, `push`, `post`, `stop`. The forms that a later act on the
   same run reads to tell its own work from drift:

   ```
   - <time> <repo> commit <sha> on <branch>: items <ids>; ticket <id or none>
   - <time> <repo> rebase <old sha> -> <new sha> onto <ref>: items <ids>; publication ref <ref or none> at <sha or none>; force push owed: yes|no|unknown
   - <time> <repo> regen <path>: approved diff <file>, sha256 <hash>
   ```

   A merge has the rebase form with `merge` in its place, and both record the target
   ref's resolved tip with the command result. A matching restore of a regenerated path
   names the file and hash, the byte comparison and the restore result.

10. **Close.** On every end, a stop included, print what was committed, what was not, and
    why. Name each rebased or merged head with its target ref, its publication ref and
    tip, and `force push owed: yes|no|unknown`, saying when a force push is owed or the
    publication ref is absent; nothing was pushed. Then print:
    - that the audit's entry in `runs.json` is unchanged, since act writes only under
      `<run dir>/act/` and its invocation record;
    - the absolute path of `act/log.md`;
    - one live line, from the report's Live checks blocks (`live.md`) as they stand:
      - `live checks: none outstanding`, when no block has `status`
        `not run: not approved` or `under review`;
      - `live results needed: <ids>; /audit:resume <run-id> --live <file> imports them while resume's eligibility checks pass: each bundle's recorded head and base still resolve to the recorded shas, and no stage before 6 needs a rerun; resume rechecks all of that and refuses otherwise`,
        for the blocks `not run: not approved`. When this invocation committed, rebased
        or merged, add `This act <committed | rebased | merged> to <sha> on <branch>, the bundle's branch, so a bundle whose recorded head was read from that local branch stops matching (a GitHub pull request's head, or one read through a remote mapping in the brief's Read paths, moves when a push updates that ref); resume without --live to re-audit it`,
        naming the actual operation. Act does not recheck eligibility itself; the line
        states the condition and names resume as the check;
      - `live results imported, awaiting review: <ids>; /audit:resume <run-id> reconciles them, no --live needed, while no stage before 6 needs a rerun; after a head or base change resume asks to restart from stage 1, and approving that restart retires them`,
        for the blocks `under review`; when both states are open, print both;
      - `live checks: not checked (<report or entry> could not be read)`, when act
        stopped before it could read them.

This is the end of the invocation; `SKILL.md`, "Stage order and control flow", holds the
rest. A new `/audit:act` on the same run starts again at step 1 and reads `act/log.md`
to tell its own commits from drift.
