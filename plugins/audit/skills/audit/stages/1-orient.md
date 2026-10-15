# Stage 1: orient

The orchestrator runs this stage alone, first, for `command: run`, and for
`/audit:resume` when stage 1 is the first stage to rerun. It reads the invocation block,
the manifest when one is named, the claims files, the `file:` exports, the audited
repositories and their forge data. It writes the run directory and everything in it that
the later stages read: `invocations.md`, `manifest.json`, `stages.json`, the read-only
baseline, `forge/`, `diffs/`, `trees/`, `revert/`, `claims.md`, `groups.md`,
`audit-brief.md`, and the run's copies of `common.md` and `audit-evidence.md`, plus the
`runs.json` entry. Step 0 runs before the baseline and writes only what it names; a stop
in step 0 ends the command with one message. Step 1b takes the baseline before any other
work on the repositories, so everything after it is covered by the stage's read-only
check.

Scripts are `${CLAUDE_PLUGIN_ROOT}/scripts/<name>.sh`, run as
`sh <resolved absolute path> ...`. Every Bash command of this stage that runs git, or a
script that runs git, begins with `export GIT_NO_LAZY_FETCH=1;`, so a missing object
fails instead of being fetched from a promisor remote; the commands below are written
without that prefix. Every `gh api` call passes `--hostname <host>`, names one endpoint,
is the only read of its Bash call, and never runs inside a shell loop. Forge output goes
to a file by shell redirect and never passes through the model: a tool result cannot
hold a large output, and the Write tool would re-serialize it.

Every stop line below keeps its text byte for byte and is followed by one plain sentence
on what is wrong and what to change, for example "Bundle app has no base; add a base
branch to it in the manifest."

## Steps

0. **Inputs, run directory and record.**

   a. **Tool check.** Run `command -v jq`. When it prints nothing, tell the user before
      anything else, in plain words: `jq` is not installed, so a GitHub pull request
      cannot be read (its fields are read with `jq`), the open pull request check
      (`collisions.sh`) does not run, the work-items file is not checked
      (`work-items.sh` reports `work-items: jq not found`), and live results cannot be
      checked or imported (`live.sh`). Name the install: `winget install jqlang.jq` on
      Windows, `brew install jq` on macOS, the system package manager on Linux. Then go
      on.

   b. **Read the request and the manifest.** The invocation block's `request:` line
      gives the effort hint (`effort low|medium|high`, or a tier word standing as its own
      phrase), the budget (`budget <n> minutes`), and model overrides
      (`<role> on <model>`, the role one of digester, mapper, auditor, adversary, merger,
      second opinion, the model one of opus, sonnet, haiku, fable). The manifest gives
      `questions`, `claims`, `budget`, `max_agents` and `models`. A value from the
      request wins over the manifest's for the same key or the same role; nothing else
      is read from the request. Read the manifest when `manifest:` is not `none`.
      Relative paths in it are relative to its own directory; relative paths in the
      inputs are relative to the session's directory. Under `/audit:resume`, ignore
      `manifest: none` and `inputs:` and rebuild both from the `source` key of the run's
      `manifest.json`; when the manifest file it names does not exist, stop with one line
      saying so.

   c. **Merge the inputs into bundles.** Each `inputs:` token (SKILL.md, Reading the
      request) is merged into the manifest's `bundles[]`:
      - `PR <n>`, `#<n>` naming a pull request, or a pull request URL adds a bundle with
        that `pr`. Its `repo` is the one `in <path>` names, else the session's
        repository when it has a GitHub remote for that owner and repository, else the
        manifest bundle with that remote; with none, stop:
        `no local clone for <id>; add it to the manifest`.
      - `branch <b> against <base>` sets `branch` and `base` on the bundle of that
        repository.
      - `tickets <id>, <id>`, an issue URL and `file:<path>` add tickets to the only
        bundle. With more than one bundle, ask once which bundle each belongs to.
      - A token ending in `.json` with no scheme prefix is the manifest itself.
      An input that disagrees with a manifest entry for the same bundle (another branch,
      base or pull request) stops the run and shows both values.

   d. **Normalize.** Validation messages name the key they concern.
      - Every path absolute. Every `repo`, reference `path` and source of truth `path`
        is a git checkout: store `git -C <path> rev-parse --show-toplevel`. For each
        such top level `<repo>`, when
        `git -C <repo> config --local --includes --get-regexp '^(remote\..*\.promisor|extensions\.partialclone)$'`
        exits 0, stop with one line per repository,
        `<repo>: partial clones are not supported`: an agent's `git show` or `git diff`
        would fetch missing objects over the network. `--includes` follows the file's
        `include` directives, which `--local` alone skips.
      - A slug is the text lowercased, with each run of characters outside `a-z0-9`
        turned into one `-`. Bundle names are the repository directory's base name,
        slugged, with `-2`, `-3` when two bundles share it; `<bundle>` in file names is
        this name. References and sources of truth keep their `name`, slugged.
      - Group names: each `groups[].name` is slugged, with no length cap. Stop with
        `groups: <name> slugs to nothing` when the slug is empty; with
        `groups: <name> is a reserved scope name` when it is `tests`, `hygiene`,
        `tests-hygiene`, `interactions`, `combined` or `unticketed`; with
        `groups: <a> and <b> share the slug <s>` when two entries share one; and with
        `groups: <name> collides with the top-up files of <scope>` when it equals
        `<scope>-topup` or `<scope>-maptopup` for another entry's slug or a reserved
        name. A name is never changed to make it pass. `cross-cutting` is not reserved.
      - Ticket and pull request ids: `github:owner/repo#n`, `file:<absolute path>`,
        `mcp:<tool>` for a ticket read with an Azure DevOps or Salesforce MCP tool the
        session has, or `text` for a ticket known only by the id and the words the user
        gave. A short `#n` is accepted only when the bundle's repository has exactly one
        GitHub remote (`git -C <repo> remote -v`); otherwise stop with
        `<id>: write it as github:owner/repo#n or file:<path>`, and add that a ticket
        on another forge comes in as a `file:` export. `<ticket>` in file names is the
        id slugged.
      - `<host>` of each GitHub id, the pull request first, then its tickets: the host
        of its URL when it was given as one; else the host of the bundle repository's
        fetch remote that names that owner and repository (`origin`'s when such remotes
        disagree and `origin` is one of them, else stop with
        `<id>: write it as a URL to name its host`); else, for a ticket, its pull
        request's host; else `github.com`. A URL's host is what follows the scheme and
        any `user@`, up to the first `/`; the scp form `[user@]host:path` ends at the
        `:`. An `https://` or `http://` host keeps its `:port`. An SSH host drops its
        port; `github.com` and `ssh.github.com` give `github.com`, and any other counts
        only when `gh auth status --json hosts --hostname <host> --jq '.hosts | length'`
        prints a number above 0 (once per distinct host); 0 means that remote gives no
        host, and any other answer stops with
        `<id>: cannot tell whether gh knows <host>; write the id as a URL or use gh 2.81.0 or later`.
        A `file://` remote, one with no `:` before its first `/`, and a drive path give
        no host. Hosts are compared lowercased, without a default `:443` or `:80`. A
        ticket known only from `closingIssuesReferences` takes the host of its `url` in
        `pr.json`. The host is not part of the id.
      - `ticket_token`, `run_once`, `test_run` and `test_paths`: a string becomes a
        one-element list. `run_once`, `test_run` and `test_paths` are repo-relative glob
        patterns (`*` does not cross `/`, `**` does). `head` takes only `working-tree`.
        `test_command` and `test_setup` are commands for `sh -c`; `test_timeout` is
        whole seconds, default 300. Setting `test_command` is the user's consent to run
        the bundle's own commands in step 6b.
      - `sources_of_truth`: when given, it replaces the default rank. The default rank
        is standards documents, guidelines, the repository's own documents
        (`AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/`), then ticket text; a standards
        or guidelines entry counts only when supplied.
      - `questions`: `default`, or a path to a markdown list of `id: question` lines,
        which replaces the four unless it holds the line `extends: default`, which
        keeps them and adds its own. The four:
        - `Q1` best practice: does the change follow the ranked sources and the
          repository's own conventions?
        - `Q2` semantic drift: does the code do what the ticket and the claims say, no
          more and no less?
        - `Q3` technical debt: what does the change leave for later, and is that
          recorded?
        - `Q4` decision quality: were the choices the right ones, which alternatives
          existed, and which does the auditor recommend, with the reason?
      - `models`: the merged map for digester, mapper, auditor, adversary, merger and
        `second-opinion`, each one of opus, sonnet, haiku, fable, else stop with
        `models: <role> must be one of opus, sonnet, haiku, fable`. `max_agents`
        defaults to 8 and is a whole number of 1 or more; `budget` is whole minutes, 0
        or more; a bad value stops with one line that starts with the key.
      - `scratch` is made absolute. `forge_exports` and `_test` are kept as given;
        `forge_exports.command` is recorded and never run.
      - `source`: the manifest's absolute path or `none`, the `request:` line and the
        inputs, with relative paths made absolute, so resume can merge them again.

   e. **Validate the bundles.** Stop at the first failing rule per bundle, with its
      line. A bundle needs a `repo`, a `pr` or a `branch`, and a base, else
      `bundle <name>: no base`; a `file:` pull request also needs `branch` and `base`.
      Each `ticket_token` entry holds `{n}` exactly once and one other character, else
      `bundle <name>: ticket_token must hold {n} once`. `run_once`, else
      `bundle <name>: run_once must be a pattern or a list of patterns`. `head`, else
      `bundle <name>: head must be working-tree`. The test keys, in this order:
      `bundle <name>: test_run, test_paths, test_setup, and test_timeout need test_command`;
      `bundle <name>: <key> must be a one-line command`;
      `bundle <name>: <key> must be a pattern or a list of patterns`;
      `bundle <name>: test_command needs test_run`;
      `bundle <name>: test_timeout must be whole seconds, 1 or more`. A `working-tree`
      bundle needs its branch checked out: `git -C <repo> rev-parse --abbrev-ref HEAD`
      equals it, else stop with
      `bundle <name>: head working-tree needs <branch> checked out, found <x>`. Then run
      `sh ${CLAUDE_PLUGIN_ROOT}/scripts/working-tree.sh check <repo>`, which writes
      nothing and runs no filter, hook or program; exit 1 or 2 stops the run showing the
      script's stderr lines. For a GitHub pull request bundle without a manifest
      `branch`, both checks run in 0k against `headRefName`. The refusals are thus known
      before the baseline, whose `git status` could run a filter.

   f. **Exported forge files.** For every `file:` ticket or pull request, read the file:
      markdown with frontmatter, or JSON. A ticket requires `id`, `url`, `title`,
      `state` and `description`, and may have `acceptance_criteria`, `fields`, `links`
      and `comments` (author, date, text). A pull request requires `id`, `url`, `title`
      and `body`, and may have `reviews` and `review_comments` (file, line, comments).
      Every file requires `source`, `exported_by` and `exported_at`. In the markdown
      form, the text after the frontmatter is the `description` or the `body` when the
      frontmatter does not set it. A missing required key stops the run with exactly
      `export <path>: missing <key>`, the path as given, the first missing key in the
      order above; check every export first and show one line per file that fails.
      Keep each missing optional key per file for the brief's "not in export" lines.

   g. **Claims files.** For each file in `claims`, run
      `sh ${CLAUDE_PLUGIN_ROOT}/scripts/handoff.sh detect <file>`. Exit 0 is a handoff
      (it has a `reimagine-handoff:` key, whatever its value), exit 1 a prose claims
      file, exit 2 stops the run naming the file. For each handoff run
      `sh ${CLAUDE_PLUGIN_ROOT}/scripts/handoff.sh check <file>`: it prints
      `handoff: ok`, or exits 1 with `handoff <file>:<line>: <message>` lines. Check
      every handoff, then stop showing every such line; exit 2 stops naming the file.
      Map each handoff to the manifest: a handoff bundle maps to the manifest bundle
      whose top level equals its `repo` resolved against the handoff's directory, else
      to the one with the same name; a handoff ticket maps when its id equals the
      normalized id, the export's `id`, or the issue number in the bundle's repository.
      Unmapped bundles and tickets keep the handoff's names and are listed in the
      brief's Handoff section.

   h. **Reading block.** Print the reading block (SKILL.md, Reading the request): the
      bundles with repository, pull request or branch and base, and tickets; the
      references; the sources of truth; the claims files; the effort hint; the budget
      and model overrides; and how each ticket resolved (`gh`, `file`, `text`,
      `mcp:<tool>`). Then tell the user to pause background fetch for these
      repositories until the run ends, for example VS Code's `git.autofetch`, since a
      fetch during the run moves remote-tracking refs.

   i. **Primary repository and scratch.** The primary repository is the session's
      repository when it is a bundle, else the first bundle. `<scratch>` is the first of:
      1. the manifest's `scratch`, which lies inside the primary repository's top level
         with `git -C <primary> check-ignore -q <scratch>/` succeeding. When the primary
         is a linked worktree, it may instead lie inside the main checkout (the first
         `worktree` entry of `git -C <primary> worktree list --porcelain`, never a
         sibling worktree) when
         `git -C <primary> rev-parse --path-format=absolute --git-common-dir` and the
         same command in the main checkout print the same directory; the ignore check
         then runs in the main checkout. Create it with `mkdir -p` when missing.
         Otherwise stop with `scratch <path>: not an ignored path inside <primary repo>`,
         or, for a linked worktree,
         `scratch <path>: not an ignored path inside <primary repo> or its main checkout <main checkout>`.
         With the key present, the rules below are not tried;
      2. `scratch/`, `tmp/` or `.scratch/` in the primary repository, when it exists and
         `git -C <primary> check-ignore -q <dir>/` succeeds;
      3. `.reimagine/`, when `git -C <primary> check-ignore -q .reimagine/` succeeds;
      4. `${CLAUDE_PLUGIN_DATA}/runs/`.
      The audit never writes to `.git/info/exclude` or any file of a git directory.

   j. **Run id and run directory.** The id is `<YYYY-MM-DD-HHMM>-<slug>` in local time;
      the slug is the first bundle's name and its pull request number (an export's
      `id`), or else its branch, slugged, at most 40 characters, with no forge call. When
      `${CLAUDE_PLUGIN_DATA}/runs.json` has the id or its directory exists, try `-2`,
      `-3`, and so on; 0j and 0m settle it. The run directory is
      `<scratch>/audit/<run-id>/`, one `audit` level below `<scratch>` even when
      `<scratch>` ends in `audit`. Before creating it, write out the resolved run
      directory and the resolved `<scratch>/audit` as whole paths, check that the parent
      of the first is the second, compared as whole paths (a parent merely named `audit`
      fails), and check that `<scratch>` still satisfies 0i; else stop with 0i's line.
      Create `<scratch>/audit/` with `mkdir -p`, then the run directory with `mkdir` and
      no `-p`; when that `mkdir` fails because the directory exists, take the next
      suffix and create again. Append the invocation block to `invocations.md` in it
      (SKILL.md, Invocation block).

   k. **Pull requests.** For each `github:` pull request, create `forge/<bundle>/` and
      run, as the only command of its Bash call,
      `gh pr view <n> -R <host>/<owner>/<repo> --json number,url,title,body,state,headRefName,headRefOid,baseRefName,baseRefOid,closingIssuesReferences,reviews,comments > forge/<bundle>/pr.json`.
      Read each field from the file with `jq`, for example
      `jq -r .headRefOid forge/<bundle>/pr.json`. Under `/audit:resume`, when
      `forge/<bundle>/pr.json.new` exists and its `url` names this bundle's host, owner,
      repository and number, move it to `pr.json` and query nothing; otherwise remove it
      and query. When `gh` is missing or not logged in, or `jq` is missing, stop and say
      the pull request needs `gh` and `jq`, or a `file:` export. When the read fails,
      stop with one line naming the host it queried and saying to give the id as a URL
      when that host is wrong. A stop in 0k removes what it wrote: the new run
      directory, or under resume the `pr.json` files it wrote or moved.
      - A manifest `branch` other than `headRefName`, or `base` other than `baseRefName`
        (`<remote>/<name>` equals `<name>`), stops the run showing both values.
      - Remote selection: for a pull request bundle, the remote whose URL names the
        owner and repository of `url` in `pr.json`, else `origin`, else the only remote;
        a repository with no remote stops with `bundle <name>: no remote`. For any other
        repository, `origin`, else the only remote, chosen only when step 1a needs a
        fetch there. Several remotes with no match and no `origin` stop the run with one
        line naming the repository and its remotes. `<remote>` below is this remote.
      - The head is `headRefOid` for a GitHub pull request, else the sha the `branch`
        resolves to; a `working-tree` bundle's head is built in step 1c, and without a
        manifest `branch` 0e's two checks run now against `headRefName`. The base ref is
        `<remote>/<baseRefName>` for a GitHub pull request, else `base`; its sha, the
        pinned base, is resolved locally in step 3. `baseRefOid` is the base as GitHub
        last evaluated it, kept for information only.

   l. **Manifest.** Show the merged, normalized manifest to the user as one fenced JSON
      block and save it as `manifest.json` in the run directory.

   m. **Registry.** Add `{run_id, path, primary_repo, created, state: "running"}` to
      `${CLAUDE_PLUGIN_DATA}/runs.json` under the `runs.json.lock/<owner>` protocol
      (SKILL.md, State files), `path` being the run directory of 0j. When, under the
      lock after the fresh read, an entry already has this id, or a stale lock's owner
      directory has this run's own owner name, add nothing: release only a lock this
      run holds, remove the run directory this run created in 0j, and stop with one
      line naming the id and saying another audit took it in the same minute, so run
      the command again. Any other refused or failed update follows that section's
      cases.

   n. **Completion record.** Write `stages.json` through `stages.json.tmp` and
      `mv -f`, with `plugin_version` `0.1.0-alpha.1`, empty `approvals`, and a stage 1 entry
      with status `running` whose inputs are the `git hash-object --no-filters` hashes
      of `manifest.json`, each claims file, the questions file and each `file:` export,
      and `plugin_version`. Record the stage's start time for the budget.

   Under `/audit:resume`, skip 0i, 0j and 0m: reuse the run directory, id and registry
   entry, even when `scratch` changed. In 0n, keep `approvals` and every stage's
   `superseded` records, and rewrite only the stage 1 entry.

1. **Fetch, baseline and working-tree head.**

   a. **Fetch approval.** For each audited repository (bundles, references, sources of
      truth), find the refs that are missing or stale. A ref is missing when
      `git -C <repo> rev-parse --verify <ref>^{commit}` fails. A pull request head is
      stale when `headRefOid` is no local ref's sha, or is absent
      (`git -C <repo> cat-file -e <sha>^{commit}` fails). A local base may be behind and
      only a fetch can tell, so the base fetch is always part of the question for every
      GitHub pull request bundle and every bundle whose `base` is a remote-tracking ref;
      such a run always asks once. Nothing contacts a remote before approval.

      Ask once, saying first why (a local base or pull request may be missing or
      behind; the fetch writes remote-tracking refs only, never a branch or a file),
      then listing per repository the remote, the refs and the exact commands. For a missing bare name, list the check
      `git -C <repo> ls-remote --tags <remote> refs/tags/<name>` (a printed line means a
      tag) and both candidate fetches; on approval run the check, then the matching
      fetch. The fetches take no tags, and the empty `--refmap=` keeps a configured
      refspec such as `+refs/tags/*:refs/tags/*` from writing its own destination,
      which `--no-tags` alone does not:
      - a pull request head that is missing or stale:
        `git -C <repo> fetch --no-tags --refmap= <remote> +refs/pull/<n>/head:refs/remotes/<remote>/pr/<n>/head`
      - the base of every GitHub pull request bundle, and of every bundle whose `base` is
        `<base remote>/<baseRefName>` (`<base remote>` the configured remote the ref
        names, else the selected remote):
        `git -C <repo> fetch --no-tags --refmap= <base remote> +refs/heads/<baseRefName>:refs/remotes/<base remote>/<baseRefName>`
      - a missing 40-hex sha, which then resolves as `<remote>/audit/<sha>`:
        `git -C <repo> fetch --no-tags --refmap= <remote> +<sha>:refs/remotes/<remote>/audit/<sha>`;
        a remote that refuses it ends the run `blocked` naming the sha;
      - a missing name that is a tag on the remote, which then resolves as
        `<remote>/tags/<name>`:
        `git -C <repo> fetch --no-tags --refmap= <remote> +refs/tags/<name>:refs/remotes/<remote>/tags/<name>`
      - any other missing ref: when it is `<other>/<branch>` and `<other>` is a
        configured remote (`git -C <repo> remote`),
        `git -C <repo> fetch --no-tags --refmap= <other> +refs/heads/<branch>:refs/remotes/<other>/<branch>`;
        else it is a bare branch name, a slash allowed, fetched by the same refspec from
        the selected remote and resolved as `<remote>/<branch>`.
      A second remote is listed in the same question with its own target. A
      `working-tree` bundle takes no head fetch and no stale-head test. `--prune` is
      never added; a remote's own `prune` setting is accepted as part of the approved
      fetch.

      Record the answer in `stages.json` `approvals` with kind `fetch`, target
      `<repo name>:<remote>`, the decision, the time, `commands` (the exact commands
      run, the `ls-remote` checks included) and `resolved` (each bare name to `tag` or
      `branch`), one entry per repository and remote. Every ref that resolves under
      another name gets a mapping line in the brief's Read paths:
      `<ref as given> -> <remote>/<branch>`, `<ref as given> -> <remote>/tags/<name>`
      or `<sha> -> <remote>/audit/<sha>`. After fetching, check each pinned head with
      `git -C <repo> cat-file -e <sha>^{commit}` and every other fetched ref, the pull
      request base included, with `git -C <repo> rev-parse --verify <ref>^{commit}`;
      one that fails ends the run `blocked` naming it. On decline, the local base is
      used as is and the brief records "base: local ref, refresh declined"; a head or
      base that still does not resolve ends the run `blocked` with the reason. Under
      `/audit:resume`, a recorded approval covers only the commands in its `commands`,
      matched through `resolved` without contacting the remote; new commands are asked
      once and recorded as a new entry.

   b. **Baseline.** Create `baseline/` in the run directory. For each audited repository
      `<name>`, once even when it has several roles, run
      `sh ${CLAUDE_PLUGIN_ROOT}/scripts/readonly.sh snapshot <repo> <run dir> <run dir>/baseline/<name>`.
      It writes `baseline/<name>.marker`, `.status`, `.refs`, `.stash`, `.config`,
      `.hashes` and `.ignored`. A non-zero exit ends the run `blocked` with the script's
      message, since the boundary cannot be checked.

   c. **Working-tree head.** For each bundle with `head: working-tree`, run
      `sh ${CLAUDE_PLUGIN_ROOT}/scripts/working-tree.sh build <repo>`. It builds a commit
      from the working tree in a temporary index copied from the repository's own, so
      the index, refs and files stay untouched; its only writes are objects. Exit 0
      prints `head <sha>`, `parent <sha>`, `tree <sha>`, an `untracked <path>` line per
      untracked file that is not ignored, and a `flagged <path>` line per skip-worktree
      or assume-unchanged path, held at its index version; keep every line. The commit
      has no ref, and the same working tree and `HEAD` give the same sha. Stderr with
      exit 0 is a git warning, not a refusal. Exit 1 prints
      `working-tree: refused: <reason>` lines and exit 2 one failure line; either ends
      the run `blocked` showing the lines.

2. **Forge data.** For each bundle, save under `forge/<bundle>/`:
   - `pr.md`: title, body, state, reviews and review comments (file, line, comments)
     from `pr.json` and `pr-review-comments.json`; for an export, its content.
   - `<ticket>.md` for each ticket of the bundle and each one `closingIssuesReferences`
     names: text, state, acceptance criteria, fields, links (for a GitHub ticket, the
     pull requests from `closed_by`), comments, and `parent: github:<repo>#<number>`,
     `parent: none` or `parent: not read`. For an export, its content; for
     `mcp:<tool>`, the tool's result written with the Write tool; for `text`, the id
     and the user's words, marked as not read from a forge.
   Each `.md` file starts with a provenance block: the source (`gh`, `mcp:<tool>`,
   `text`, or the export's `source`, `exported_by` and `exported_at`) and the time read.
   The brief says when no forge was queried for a bundle.

   The reads, each the only command of its Bash call, with `<host>` the host from 0d of
   the pull request or ticket read, a parent read taking its ticket's host:
   - `pr.json`, read once in 0k and never hashed. Its hashed form leaves out the shas,
     which resume compares first, and the fields that depend on who is logged in:
     `jq '{number,url,title,body,state,headRefName,baseRefName,closingIssuesReferences: [.closingIssuesReferences[] | {number, url}],reviews: [.reviews[] | {author: .author.login, state, body, submittedAt}], comments: [.comments[] | {author: .author.login, body, createdAt}]}' forge/<bundle>/pr.json > forge/<bundle>/pr.hash.json`
   - the review comments:
     `gh api --hostname <host> --paginate repos/<owner>/<repo>/pulls/<n>/comments --jq '.[] | {id, path, line, original_line, commit_id, body, user: .user.login, created_at, updated_at, in_reply_to_id}' > forge/<bundle>/pr-review-comments.json`
   - each GitHub ticket:
     `gh issue view <n> -R <host>/<owner>/<repo> --json number,url,title,body,state,labels,comments,closedByPullRequestsReferences --jq '{number,url,title,body,state,labels: [.labels[].name], closed_by: [.closedByPullRequestsReferences[] | {number, url}], comments: [.comments[] | {author: .author.login, body, createdAt}]}' > forge/<bundle>/<ticket>.json`
   - each GitHub ticket's parent, `{"parent":null}` when it has none, by GraphQL since
     `gh issue view` has no parent field:
     `gh api --hostname <host> graphql -f query='query($owner: String!, $repo: String!, $n: Int!) { repository(owner: $owner, name: $repo) { issue(number: $n) { parent { number url repository { nameWithOwner } } } } }' -f owner=<owner> -f repo=<repo> -F n=<n> --jq '{parent: (.data.repository.issue.parent | if . then {number, url, repo: .repository.nameWithOwner} else null end)}' > forge/<bundle>/<ticket>.parent.json`

   A failed read of a ticket the manifest or the request names stops the run with one
   line naming the host and saying to give that id as a URL when the host is wrong. A
   failed review comments read stops with one line naming the read and the host. A
   failed read of a ticket known only from `closingIssuesReferences`, or of any parent,
   is a gap, since its host came from a read that worked: remove the file the redirect
   left, write `<ticket>.md` saying it was not read or give `parent: not read`, list
   the gap in the brief's Forge section with the host and the first line of the error,
   and record it in `forge_gaps`, a map from the run-relative path to the ticket's URL,
   so resume tries it again. A gap's file is not an output.

   Hash `pr.hash.json`, `pr-review-comments.json`, each `<ticket>.json` and
   `<ticket>.parent.json`, and each `mcp:<tool>` ticket's `<ticket>.md` with
   `git hash-object --no-filters <file>` into `forge_hashes`, a map from run-relative
   path to hash. Exports are hashed in 0n instead.

3. **Shas.** For each bundle record:
   - the head (0k; a `working-tree` bundle's is the `head` of step 1c, with its `parent`
     and `tree`) and the pinned base, `git -C <repo> rev-parse <ref>^{commit}` of the
     base ref after step 1a, never `baseRefOid`. `<base>` and `<head>` below are these
     shas;
   - the merge-base, `git -C <repo> merge-base <base> <head>`;
   - the base commits since the merge-base, `git -C <repo> log --oneline <head>..<base>`;
   - the files changed on both sides: the intersection of
     `git -C <repo> diff --name-only <base>...<head>` and
     `git -C <repo> diff --name-only <head>...<base>`;
   - for a bundle with `run_once`, the run-once list:
     `git -C <repo> diff --no-ext-diff --no-textconv --no-color --name-status -M <base>...<head> -- ':(glob)<pattern>' ...`,
     one pathspec per pattern. `-M` shows a moved file as `R` with its score whatever
     the user's diff configuration. The left side of a three-dot diff is the merge-base,
     so `M`, `D` and `R` exist there, while `A` and the new path of a `C` are new;
     `--name-status` prints the status and score, then the source path, then the new
     path. A file moved in from outside the patterns shows as `A`. A key that matches
     no changed file gives the list `none`.
   - for a bundle with a `github:` pull request whose run-once list has a new name (an
     `A`, or the new path of an `R` or `C`), the open pull request check: two open pull
     requests on one base can each add a script that a runner records under the same
     key. Read the open pull requests on the base, with `<host>`, `<owner>`, `<repo>`
     and `<baseRefName>` from `pr.json`:
     `gh pr list -R <host>/<owner>/<repo> --base <baseRefName> --state open --limit 100 --json number,url,headRefName,changedFiles,files > forge/<bundle>/open-prs.json`
     then
     `sh ${CLAUDE_PLUGIN_ROOT}/scripts/collisions.sh forge/<bundle>/open-prs.json <PR number> 100 <new path>... > forge/<bundle>/collisions.tsv`,
     one argument per new path. It prints `collision`, `cut` and `cut-list` rows; a
     candidate is a lead, never a finding. Hash `collisions.tsv` into `forge_hashes`,
     never `open-prs.json`, so an unrelated open pull request does not invalidate stage
     1 on resume. A failed `gh` read is a gap as in step 2, recorded as
     `forge/<bundle>/collisions.tsv` with the pull request's `url`. A script exit 2, or
     a refusal of the script by the permission check, stops the run with its line; a
     refusal is never a gap. Any other bundle gets no check, and the brief says why.
   For every reference and source of truth with a `path`, record its pinned sha,
   `git -C <path> rev-parse <ref>^{commit}`.

4. **Diffs.** For each bundle write `diffs/<bundle>.diff`,
   `git -C <repo> diff --no-ext-diff --no-textconv --no-color <base>...<head>`, and
   `diffs/<bundle>.stat`, `git -C <repo> diff --numstat <base>...<head>`, one line per
   file with added and deleted counts (`-` for a binary file). Always three dots: a
   two-dot diff shows changes on the base as reversals on the head.

5. **Stacks.** When a bundle's base sha or base ref is another bundle's head, record
   the stack in order. The brief states the combined state under audit: each bundle at
   its head, each diff taken against the bundle below it.

6. **Readable trees and reverted tests.**

   a. **How each tree is read.** For every bundle at its head and every reference and
      source of truth at its pinned sha:
      - **Direct** when `git -C <repo> rev-parse HEAD` is that sha,
        `git -C <repo> --no-optional-locks status --porcelain --untracked-files=no` is
        empty, and `git -C <repo> ls-files -v` shows no path tagged `S`, `h` or `s`.
        Agents read the checkout (`common.md`, Reading trees and searching). A
        `working-tree` bundle is `direct (working tree)` when `HEAD` is the `parent` of
        step 1c and no `flagged` line was printed; agents search it with
        `git -C <repo> grep <pattern> <head sha>`. With a `flagged` line it is exported,
        so the flagged paths are read at their index version.
      - **Export** otherwise. Size it first: the sum of blob sizes in
        `git -C <repo> ls-tree -r -l --full-tree <sha>`. Over 1 GB (1,073,741,824
        bytes), ask the user and record the answer in `approvals` with kind
        `export-over-1gb`; on decline the tree is read with
        `git -C <repo> show <sha>:<path>`, mode `git show`, and only agents with Bash
        are assigned to it, which leaves out the merger. To export:
        1. Remove `<run dir>/trees/<name>/` when present (`rm -rf`, inside the run
           directory only).
        2. List the tree, `git -C <repo> ls-tree -r -z --full-tree <sha>`, into
           `trees/<name>.lstree`: `<mode> <type> <object>\t<path>` entries, NUL
           terminated.
        3. Write every entry under `trees/<name>/` from one
           `git -C <repo> cat-file --batch` stream, by a program saved as
           `trees/<name>.export.<ext>` (`sh` for a shell script). It feeds the blob ids
           from a file on standard input (`git -C <repo> cat-file --batch < <ids file>`),
           or reads each reply before sending the next id, so the pipe cannot block. For
           each reply header `<oid> <type> <size>` it copies exactly `<size>` bytes and
           drops the one newline after them, in the program rather than a process per
           blob. A shell form may copy each blob with `head -c <size>`; where `head -c`
           may read ahead (a non-GNU `head`), it writes each blob with
           `git -C <repo> cat-file blob <oid> > <file>` instead.
        4. Mode `100644` is a regular file and `100755` one with the executable bit.
           `120000` is a regular file holding the link target, never followed, listed
           in the brief. `160000` is a submodule, listed with its commit and not
           exported. A blob starting `version https://git-lfs.github.com/spec/v1` is
           written as the pointer file and listed as a pointer, not the object. A path
           with a newline is not written and is listed.
        `cat-file` reads objects only, so no checkout filter, driver or attribute runs.
        Never use `git archive` (it honors `export-ignore` and `export-subst`),
        `git checkout-index` (it runs filters), a checkout, a switch or a worktree.
      The brief maps each name to its read path, sha and mode (`direct`,
      `direct (working tree)`, `export` or `git show`). An export holds tracked files
      only, so no test or lint command runs in it; a run happens only in a directly
      read tree, else that check is "not run". Step 6b is the one exception.

   b. **Changed tests with the change reverted.** Only the orchestrator runs this. First
      remove `<run dir>/revert/` and `${CLAUDE_PLUGIN_DATA}/revert-work/<run id>/` when
      present (`rm -rf`, those two only), so nothing of an interrupted attempt remains.
      Then, for each bundle with `test_command`, in manifest order:
      1. Write `revert/<bundle>.keys` with the Write tool, one `<key><TAB><value>` line
         per value: `command` (`test_command`), `setup` (`test_setup`, when given),
         `timeout` (`test_timeout`, when given), one `run` line per `test_run` pattern,
         and one `path` line per `test_paths` pattern (none when the key is absent, so
         the script's default list applies). No key's text passes through a shell
         command line.
      2. Start, with the Bash tool's `run_in_background` set to true,
         `sh ${CLAUDE_PLUGIN_ROOT}/scripts/revert-tests.sh bg <repo> <base> <head> <run dir>/revert/<bundle>.keys ${CLAUDE_PLUGIN_DATA}/revert-work/<run id>/<bundle> <run dir>/revert/<bundle>.md`,
         with the shas of step 3. Then run
         `sh ${CLAUDE_PLUGIN_ROOT}/scripts/revert-tests.sh wait <run dir>/revert/<bundle>.md`
         in the foreground with the Bash tool's `timeout` at 600000. It returns within
         nine minutes; while it exits 3 (still running), run it again, at most eight
         times in all. Never end the turn while the run is in the background: in a
         headless session the end of the turn ends the session. A completion notice for
         the background call changes nothing; `wait` decides, and answers at once when
         the run is done.
      3. `wait` exit 0: the result file is written, whatever its verdicts. Exit 2: stop
         the run with its stderr line. After the eighth exit 3, stop the run with
         `revert-tests: no result after 72 minutes` and the background call's output
         file.
      The script runs each changed test file in a copy of the head and in a copy of the
      merge-base with the test code at its head state, writes one verdict per file, and
      keeps to the caps in its header (20 files, `test_timeout` per command, 30 minutes
      per bundle, no run over 1 GB); every exit status, 127 included, is a result. The
      commands run with the user's environment and credentials, and their output tails
      are kept unredacted. Agents read `revert/<bundle>.md` as `audit-evidence.md`,
      Reverted test runs, says.

   c. **Source classes.** For each source of truth with a `path`, count the tracked files
      at the pinned sha by extension. When more than half are documents (`.md`, `.mdx`,
      `.markdown`, `.txt`, `.rst`, `.adoc`, `.asciidoc`, `.html`, `.htm`, `.pdf`), it is
      a document corpus, else a code base. Record the class and the counts in the brief.

7. **Claims.** Write `claims.md` from every claims file, numbered from 1 across all
   files in file order, one claim per line:

   ```
   <n>. [claim:<kind>] <bundle>/<ticket or none> <source file>:<line> (<handoff ref>): <text> -> <target>
   <n>. [claim:<kind>] <bundle>/<ticket or none> <source file>:<line>: <text> -> <target>
   <n>. [other] <bundle or none>/<ticket or none> <source file>:<line>: <text> -> none
   ```

   The first shape is a handoff claim, the second a prose claim, the third a prose
   sentence that is not a claim. A handoff's claims are the lines of
   `sh ${CLAUDE_PLUGIN_ROOT}/scripts/handoff.sh claims <file>` (kind, ref, bundle,
   ticket, line, text, tab-separated), one claim per line, never split, with the
   script's kind, never one chosen by judgment; a mapped bundle or ticket takes the
   manifest's name (0g). The handoff's other lines are not listed. A prose file is
   split into sentences in file order; headings, list items and table cells count as
   sentences, a sentence across lines takes its first line, and nothing is dropped.
   Each checkable statement about the work gets the first kind that applies:
   1. `verification`: something was checked, tested, verified, confirmed, reproduced,
      or passes;
   2. `decision`: a choice made or rejected, a deferral, or who decided;
   3. `scope`: what belongs in or out of the bundle, or a ticket's rank for inclusion;
   4. `status`: a work item's type, state, iteration, owner or links;
   5. `code`: any other checkable statement about code, data or behavior.
   Anything else is `other`. Tag each line with its bundle and ticket, or `none`.
   `<ticket>` is the manifest's normalized id when the handoff id maps to one. Step 9
   appends the target.

8. **Groups.** Map every changed file of every `.stat` to a review group in
   `groups.md`. Group ids are slugs: a ticket's group is `<bundle>-<ticket>`; the fixed
   groups are `unticketed` and `cross-cutting`.

   With a manifest `groups` key, each entry is a group whose id is its slug from 0d,
   with globs relative to its `repo`; a file matching two entries goes to both with a
   note, and unmatched changed files go to `unticketed`. Nothing below is derived.

   Otherwise derive, per bundle:
   1. A ticket's commits are those whose message names its token: for
      `github:owner/repo#n`, `owner/repo#n`, and `#n` when the issue is in the bundle's
      repository; for any other ticket its `id`, or, when the bundle has `ticket_token`,
      each pattern with `{n}` replaced by the `id` as written. A pattern is a literal
      template, never a regex. A token matches only when the characters just before and
      after it, when present, are neither a letter nor a digit, and the one before a
      GitHub token is also not `-`, `_`, `.` or `/`. So `#12` does not match `#123`,
      `APP-1` does not match `APP-10` or `XAPP-1` but matches in `feature/APP-1`, and
      with `#{n}` the commit `fix(#4567 #4568)` belongs to both tickets while `AB#4567`
      belongs to neither. In a bundle with one ticket, every commit is that ticket's. A
      handoff's commits, from `sh ${CLAUDE_PLUGIN_ROOT}/scripts/handoff.sh commits <file>`
      (bundle, sha, ticket, line), are matched by prefix among
      `git -C <repo> log --format=%H <merge-base>..<head>` and join the ticket's
      commits; a sha that matches none or several, or a commit whose message names
      another ticket than the handoff gives, is noted in the brief's Handoff section.
   2. A ticket's group holds the changed files that the pull request description, the
      commit messages or the ticket text name, by path or file name, and every changed
      file its commits touch. A file several tickets touch goes to each, with a note
      naming them.
   3. Files no ticket explains go to `unticketed`.
   4. A file whose mapping is uncertain goes to both groups with a note saying why.
   5. Extraction: a file in more than two derived groups moves to `cross-cutting` and
      stays listed in each of them with the note `moved to cross-cutting`.
   6. Merge: after extraction, two ticket groups merge when each has more than half of
      its remaining files in the other, checked pairwise in ticket order, once; the
      merged id joins both with `+`, and the brief records the merge.
   A `working-tree` head commit, `audit: working tree`, names no ticket; with more than
   one ticket, a file only that commit changes is matched by name or goes to
   `unticketed`, and the brief says so.

   Format:

   ```
   ## <group id>: <ticket id or entry name, or unticketed or cross-cutting>
   - <bundle>:<path> (+<added> -<deleted>) [note]
   ```

   `unticketed` and `cross-cutting` are written only when they hold a file. Every
   changed file is in at least one group. The tests, hygiene and interactions
   specialists of stage 4 are scopes, not groups.

9. **Claim assignment.** Append ` -> <target>` to every `claim` line of `claims.md`:
   1. `scope` and `status` claims go to `hygiene`, which is not a group; stage 4 gives
      them to the `hygiene` scope at high, `tests-hygiene` at medium and `combined` at
      low.
   2. A `code`, `decision` or `verification` claim goes to the group whose files it
      concerns, and to `cross-cutting` for a file there.
   3. One that names no file goes to its ticket's group when that group exists, else
      the first group holding a file of its bundle, else the first group.
   4. Never a group absent from `groups.md` or without files.
   `other` lines get ` -> none`. Check that every `claim` line names `hygiene` or a
   group with at least one file, so stage 4 schedules it, and reassign any other by
   rule 3.

10. **Tier, brief and the end of the stage.**

    a. **Tier.** Count bundles, distinct tickets and changed lines (added plus deleted
       over every `.stat`; binary files count 0 and are noted). The tier is the first
       row whose conditions all hold:
       - `low`: 1 bundle, 1 ticket, under 500 changed lines;
       - `medium`: up to 3 bundles, up to 5 tickets, under 5,000 changed lines;
       - `high`: anything else.
       The effort hint from 0b overrides it. Write the tier with its reason and the
       counts, or "set by the effort hint". The tier sets the pass-one scopes, how much
       pass two attacks and whether the late adversary runs. At `low`, the brief notes
       that one auditor covers the ticket, the tests and work-item hygiene with one
       checklist instead of separate specialists.

    b. **Stage applicability.** Stage 2 applies when a source of truth is a document
       corpus, stage 3 when one is a code base. Record both in the brief.

    c. **`audit-brief.md`**, with these sections:
       - Scope: bundles, repositories, pull requests, tickets.
       - Tier and reason.
       - Bundles, each with head, pinned base, merge-base, base commits since the
         merge-base, files changed on both sides, its stack, the `ticket_token`
         patterns, and:
         - for a GitHub pull request, `headRefOid` as the head (with a line when it
           differs from the local `HEAD`) and `baseRefOid` labeled "base as GitHub last
           evaluated it", for information only; resume compares the head and the
           pinned base;
         - the run-once list: the patterns, then per file its status letter and score,
           its path, `from <old path>` for `R` and `C`, and `exists at merge-base` or
           `new`, or `none`; under each new name one `candidate:` line per `collision`
           row (kind, the other pull request's URL, its path, its change type), or
           `no candidate among <k> open PRs` (`<k>` from `open-prs.json`, the bundle's
           own left out); one line per `cut` or `cut-list` row saying no candidate was
           found among the files read; or `open PRs not read` with the gap, or why no
           check ran;
         - with `test_command`, `revert/<bundle>.md` and its verdict counts, or
           `no changed tests to run`;
         - for a `working-tree` bundle, its `parent` and `tree` shas, that the head is a
           built commit with no ref, the files "untracked at audit time" (part of the
           head, possibly left out of the user's own commit) and the paths "flagged at
           audit time, held at the index version", one per line, and the groups note of
           step 8.
       - Combined state.
       - Sources of truth: the rank used and whether it replaced the default, each
         source with its sha and class.
       - References, each with its sha.
       - Read paths: name, path, sha and mode, and the ref mapping lines of step 1a.
       - Export notes: symlinks with targets, submodules, LFS pointers, paths not
         written, declined exports.
       - Forge: queried or not per bundle, each ticket's resolution, the "not in export"
         keys, the gaps, the `forge_exports` record.
       - Questions.
       - Stage applicability.
       - Run directory: its path, and whether it is inside the session's repository.
       - Test injection: the `_test` key, when present.
       - Handoff: each handoff with its hash and that it passed `handoff.sh check`, its
         claim counts by kind, the mapping notes of 0g and the commit notes of step 8;
         `none` when no claims file is a handoff.
       - Claims: that every claim has a scope stage 4 schedules, with counts per kind
         and per target.
       - Placement rules: from the user's instruction files in `$CLAUDE_CONFIG_DIR`, else
         `~/.claude` (`CLAUDE.md` and the files it indexes), each rule that says where a
         documented fact goes, quoted with its file and the time read, or `none`. It is a
         snapshot at audit time, as the exports are; resume does not read those files
         again, and `/audit:resume <run-id> --from 1` does.
       - Corrections: empty, filled in stage 5.

    d. **Run copies.** Read `${CLAUDE_PLUGIN_ROOT}/skills/audit/common.md` with the Read
       tool and write it to `common.md` in the run directory with the Write tool, not
       `cp`, filling its header: run id, run directory, tier and the question list. Copy
       `${CLAUDE_PLUGIN_ROOT}/skills/audit/audit-evidence.md` to `audit-evidence.md` in
       the run directory the same way, with no header to fill.

    e. **Read-only check.** Run it as SKILL.md, Read-only check, says; it writes
       `baseline/1-check.md`. The entry below is written only after it passes.

    f. **Stage entry.** Write the stage 1 entry through `stages.json.tmp` and `mv -f`:
       status `complete`; outputs `manifest.json`, `audit-brief.md`, `common.md`,
       `audit-evidence.md`, `claims.md`, `groups.md`, every `diffs/` and `forge/` file,
       every `trees/<name>/` export with its `trees/<name>.lstree` and the
       `trees/<name>.export.<ext>` actually written, each `revert/<bundle>.keys` and
       `revert/<bundle>.md`, and `baseline/1-check.md`; inputs those of 0n plus each
       bundle's head, pinned base and merge-base shas (`baseRefOid` beside the base for
       a GitHub pull request), `head_parent` and `head_tree` for a `working-tree`
       bundle, the pinned sha of every reference and source of truth, `forge_hashes`,
       and `forge_gaps` (an empty map when no read was a gap); `agents`, `swaps` and
       `superseded` empty unless resume recorded moves.

    g. **Boundary.** Print the stage boundary line (SKILL.md, Soft budget). With a budget
       of 0, or `_test` `expire_budget_after_stage: 1`, the budget has now expired.

With the budget expired, record stages 2 to 7 as SKILL.md, Soft budget, says and read
`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/8-report.md` next. Otherwise stages 2, 3 and 4
start together: read `${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/2-digest.md`,
`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/3-domain.md` and
`${CLAUDE_PLUGIN_ROOT}/skills/audit/stages/4-pass-one.md`, and launch their agents in the
queue order SKILL.md gives.
