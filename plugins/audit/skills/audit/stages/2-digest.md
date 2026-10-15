# Stage 2: digest

Stage 2 starts as soon as stage 1 completes, together with stages 3 and 4. It applies when
`audit-brief.md` classes a source of truth as a document corpus, meaning more than half of
its files have document extensions. Its inputs are `audit-brief.md`, `common.md`,
`claims.md`, `groups.md`, every `diffs/<bundle>.stat`, and each corpus at its pinned sha.
Its outputs are one `guidelines/chunk-N.md` and one `guidelines/digest-N.md` per chunk, and
`baseline/2-check.md`. A digest is a pointer for the auditors: they cite the original
document at its sha, never the digest. Agents: one `audit:digester` per chunk.

## Steps

1. **Applicability.** When the brief lists no document corpus, write the stage 2 entry
   with status `not_applicable`, no outputs and no agents, and stop. The stage counts as
   satisfied for the barrier and the report lists it in Coverage.
2. **Entry.** Write the stage 2 entry as `running` (SKILL.md, State files). Its inputs are
   the `git hash-object --no-filters` hashes of `audit-brief.md`, `common.md`, `claims.md`,
   `groups.md` and each `diffs/<bundle>.stat`, the pinned sha of each corpus, and
   `plugin_version`.
3. **Chunk each corpus.** Every count and boundary below comes from a file on disk through
   shell, never from model output. For each corpus `<source>`:
   1. List the tracked files with sizes, `git -C <repo> ls-tree -r -l --full-tree <sha>`,
      and the text files, `git -C <repo> grep -I -l -e "" <sha>` (each path comes back as
      `<sha>:<path>`). A file of the tree with a size above 0 that the second list lacks is
      binary: it is skipped and listed. Symlinks, submodules and LFS pointers are listed as
      the brief records them and never chunked.
   2. Walk the text files in path order, directory by directory. A chunk takes whole
      directories while it stays at or under 450,000 bytes; a directory that alone is
      larger is split by files in path order.
   3. A text file over 450,000 bytes becomes byte ranges, each its own chunk and never
      mixed with other files. A range is the chunk entry `<path> bytes <start>-<end>`,
      0-based with `end` exclusive. From `start` 0: when 450,000 bytes or fewer remain,
      `end` is the file size; otherwise `end` is `start` plus the output of
      `tail -c +<start+1> <file> | head -c 450001 | sed '$d' | wc -c`, which cuts at the
      last LF in the window so no line is split. When that prints 0, one line is longer
      than the window: cut at `start` plus 450,000 and mark the range `line split`. The
      next range starts at `end`.
   4. `<file>` is the file measured. An exported tree is measured in place at
      `<run dir>/trees/<name>/<path>`. A directly read tree is written once by redirect,
      `git -C <repo> show <sha>:<path> > <run dir>/tmp/<source slug>/<path>`, and that copy
      is measured. Remove each copy once every chunk file for its ranges is written, and
      remove `<run dir>/tmp/<source slug>/` on every exit from this step, a stop or a
      failure part way included.
   5. Number the chunks from 1 across all corpora in source order. For chunk `N`, write
      `guidelines/chunk-N.md`: the source name, its sha, its read path and mode from the
      brief, the file list with sizes, the chunk's total bytes and, in the corpus's first
      chunk only, its skipped binary files. A byte-range chunk lists its one entry
      `<path> bytes <start>-<end>` and adds the range's first line number
      (`head -c <start> <file> | wc -l`, plus 1), its line count
      (`tail -c +<start+1> <file> | head -c <end-start> | wc -l`, plus 1 when the range's
      last byte is not an LF), and the file's total size.
   6. The chunk's scope id is `digest-N`. Keep, for the entry, each file split by range
      with its ranges and their chunk numbers.
4. **Launch.** Queue one `audit:digester` per chunk (SKILL.md, Queue and Agent launch
   rules); digests are the first jobs of the queue. When `_test` `hold` names stage 2,
   queue them and launch none until the stage it waits on has ended its initial agents.
   The prompt names, by absolute path, `audit-brief.md`, `common.md`, `claims.md`,
   `groups.md`, every `diffs/<bundle>.stat`, the scope file `guidelines/chunk-N.md`, the
   output file `guidelines/digest-N.md` and the scratch folder `tmp/agents/digest-N/`.
   It adds the stage's duties in a few lines: read every file of the chunk in full, or for
   a byte-range chunk the named range in slices of at most 24,000 bytes; end
   `status: failed at byte <offset>`, never `complete`, when the range was not read to
   its end; list each rule with its text, its strength (`MUST`, `SHOULD` or `MAY`) and
   `repo@sha:path:line`; and add a `potential finding:` line naming the group wherever a
   rule collides with a claim or the diff stat. The agent definition holds the rest.
5. **On each completion.** Apply `_test` `fail` for role `digester` at scope `digest-N`
   or `any`. Read the output; its last line must be `status: complete`. On a failure,
   follow the ladder (SKILL.md, Roles): relaunch on the same model, then on `fable`
   recorded as a swap, then the scope fails. Record each agent in the entry. On success,
   run `git hash-object --no-filters guidelines/digest-N.md` and record the hash in the
   entry's `output_hashes` map as `"guidelines/digest-N.md": "<hash>"`. These are the
   final digest hashes that the barrier of stage 4 compares with each pass-one report's
   `consumed:` list.
6. **End.** When every chunk is complete or failed:
   1. Run the read-only check (SKILL.md, Read-only check), which writes
      `baseline/2-check.md`.
   2. Write the stage 2 entry last: status `complete` when every chunk completed, else
      `failed` with a `failed_scopes` list naming each failed chunk and its files; outputs:
      every `guidelines/chunk-N.md`, every completed `guidelines/digest-N.md` and
      `baseline/2-check.md`; `output_hashes`; and `split_files`, one object per file split
      by range, `{ "source": "<source>", "path": "<path>", "bytes": <size>, "ranges":
      ["<start>-<end>", ...], "chunks": [<N>, ...] }`, or an empty list. The report lists
      every `split_files` entry in its Coverage.
   3. Print the stage boundary line (SKILL.md, Soft budget). With `_test`
      `expire_budget_after_stage: 2`, the budget expires now.

A failed stage 2 counts as satisfied for the barrier, so the run goes on; the chunks never
digested are coverage loss and the run ends `partial`. Next, go to the barrier step of
`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/4-pass-one.md` for every scope whose pass-one
report is already complete.
