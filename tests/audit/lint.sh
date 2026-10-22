#!/bin/sh
# lint.sh: static checks for the audit plugin files.
#
# Usage: sh tests/audit/lint.sh [root]
#
# root defaults to $LINT_ROOT, else plugins/audit in the repository that holds this
# script. Use it to lint a copy, for example a copy of the plugin with Edit added to
# an agent's tools, which must fail.
#
# File list: inside a git work tree, `git ls-files --cached --others
# --exclude-standard` run from root (tracked files plus new files that are not
# ignored, so files a change adds count before they are staged), keeping only files
# that exist. Outside a git work tree, every file under root except .git/.
#
# Checks:
# - commands/run.md, resume.md, act.md, handoff.md exist; every commands/*.md has
#   frontmatter keys description, argument-hint, allowed-tools.
# - agents/digester.md, mapper.md, auditor.md, adversary.md, merger.md exist; every
#   agents/*.md has frontmatter keys name (equal to the file name), description,
#   model, tools; every tools entry (YAML list, comma string, or [flow list]) is one
#   of Read, Grep, Glob, Bash, Write; and no Edit or NotebookEdit token appears
#   anywhere in the file.
# - skills/audit/SKILL.md has frontmatter keys name and description, and the
#   description names the phrase "reimagine audit"; it names each of the nine stage
#   files and skills/audit/resume.md by path, and every stages/*.md path it mentions
#   exists under skills/audit/.
# - skills/audit/handoff.md, skills/audit/live.md, skills/audit/work-items.md, and
#   skills/audit/resume.md exist.
# - Every scripts/<name>.sh path that a file under skills/, commands/, or agents/
#   mentions exists under scripts/.
# - .claude-plugin/plugin.json parses as JSON (node, else python3, else skipped with
#   a note). The catalog that lists the plugin is checked by tools/lint.mjs.
# - No file under .claude-plugin/, commands/, skills/, agents/, or README.md names a
#   design document of the repository (docs/requirements.md, architecture.md,
#   build-plan.md, decisions.md, acceptance.md): a plugin directory holds only what a
#   user installs.
# - No file under agents/, skills/, commands/ mentions `advisor`, except a line that
#   forbids it: one matching (no|never|not)( use)?( the)? `?advisor, any case, such as
#   "no advisor", "never the `advisor`", or "do not use the advisor".
# - Every gh read in a file under agents/, skills/, or commands/ names its host. In a
#   backtick span, a `gh pr <sub>` or `gh issue <sub>` command with at least one
#   argument after <sub> must pass -R or --repo a <host>/<owner>/<repo> value, attached
#   or separated, or an argument that starts with https:// or http:// or is <url>; a
#   `gh api` command with at least one argument must pass the option --hostname with
#   a value, as `--hostname <host>` or `--hostname=<host>`; the text inside another
#   argument, such as `q=--hostname`, does not count. A command may
#   start anywhere in the span (after a blank, `;`, `|`, `&`, or `(`) and ends at the
#   next `;`, `|`, `&`, or `)`. A single-quoted argument with no blank, `;`, `|`, `&`,
#   or `)` in it counts without its quotes; other single-quoted text is ignored. Without
#   a host, gh uses its default host, which can differ from the bundle's. A span with no
#   argument, such as "`gh api` calls" or "`gh issue view` has no parent field", is
#   prose and does not count, nor does an argument that starts with `*`, as in an
#   allowed-tools pattern. Not checked: a span that runs across lines, and lines inside
#   ``` fenced code blocks. A self-test runs the check on fixed sample lines first and
#   fails when its result differs from the expected one; an awk failure also fails.
# - sha256sum lines, including fenced lines, under skills/audit/ (except scripts/)
#   also name shasum; outside ``` fences, patch git diff spans with a three-dot
#   range under skills/audit/ (except scripts/) and agents/ pass --no-ext-diff,
#   excluding --numstat and --name-only. Fixed sample self-tests run first; awk
#   failure fails each check.
# - The converged item shape, the ``` fenced block whose first line is
#   `## C<n>: <title>`, appears in agents/merger.md and in
#   skills/audit/stages/7-converge.md, and the two blocks are the same after leading
#   blanks and CRs are removed. The merger reads only its own file and its prompt, so
#   the shape the stage 7 check needs must be in merger.md.
# - agents/merger.md has the tools Read, Grep and Write and no other, in any order, and
#   names its paging rule ("Read pages of at most 600 lines", "A page the tool refuses
#   is read again"), the anchored Grep pattern `^## <id>$`, the gap check ("with no
#   gap") and `status: failed at <file>:<line>`, which skills/audit/common.md also
#   names. skills/audit/stages/7-converge.md names
#   awk 'END { print NR }', and steps 6, 7.3 and 7.4, the three merger prompts, each
#   say "line count".
# - The command list in hard rule 2 of skills/audit/common.md and in Boundaries item 2
#   of agents/auditor.md, adversary.md, mapper.md and digester.md, read as one line,
#   names `git rev-parse`, `git merge-base`, `git ls-tree`, `git cat-file` with `-t`,
#   `-s` or `-p`, and `git branch --list`; all but the digester's also name `cut` and
#   `uniq`, and bar `sort -o`, `--output` or `--compress-program` and `uniq` with an
#   output file operand.
# - The default rank in skills/audit/stages/1-orient.md lists `AGENTS.md`, `CLAUDE.md`,
#   `README.md`, `docs/`, `.claude/rules/`, `.claude/skills/` and `REVIEW.md` in that
#   order, and says `REVIEW.md` is read at the pinned base with `git show <base>:<path>`;
#   skills/audit/stages/9-act.md names the two directories and `REVIEW.md` at the base
#   among the sources of the required checks; it and skills/audit/common.md name the
#   rules in `.claude/rules/` that apply to a file, the skills in `.claude/skills/` and
#   the `REVIEW.md` copies the brief records at the base among the instruction files
#   read before a change; each file is read as one line.
# - skills/audit/common.md says every agent reports and labels a finding as if
#   `REVIEW.md`'s severity calibration and do-not-report rules were absent, since the
#   report applies them and counts what each skips.
# - skills/audit/SKILL.md allowed-tools pre-approves `git ls-tree`, `git cat-file` and
#   `git branch --list`, each also in its `git -C *` form; the bare `git cat-file` only
#   with `-t`, `-s` or `-p`, since `--textconv` and `--filters` run configured programs.
#
# Exit 0 when every check passes. Otherwise print one line per failure and exit 1.

set -u

root=${1:-${LINT_ROOT:-$(cd "$(dirname "$0")/../../plugins/audit" && pwd)}}
cd "$root" 2>/dev/null || {
	echo "lint: cannot enter root $root"
	exit 1
}

fails=0
fail() {
	echo "lint: $*"
	fails=$((fails + 1))
}
note() {
	echo "note: $*"
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
files=$tmp/files

git rev-parse --is-inside-work-tree >/dev/null 2>&1 && in_git=1 || in_git=0
if [ "$in_git" = 1 ]; then
	git ls-files --cached --others --exclude-standard |
		while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done |
		sort -u > "$files"
else
	[ -e .git ] && note "git cannot list files here; listing every file under $root instead"
	find . -type f ! -path './.git/*' | sed 's|^\./||' | sort -u > "$files"
fi

# The repository's design documents, which no plugin file names.
doc_names='docs/(requirements|architecture|build-plan|decisions|acceptance)\.md'

# frontmatter <file>: print the lines between the opening and closing --- lines.
frontmatter() {
	tr -d '\r' < "$1" | awk '
		NR == 1 { if ($0 ~ /^---[ \t]*$/) next; exit }
		/^---[ \t]*$/ { exit }
		{ print }'
}

# need_keys <file> <key>...: fail for each key missing from the frontmatter.
need_keys() {
	nk_file=$1
	shift
	frontmatter "$nk_file" > "$tmp/fm"
	if [ ! -s "$tmp/fm" ]; then
		fail "$nk_file: no frontmatter block"
		return
	fi
	for nk_key in "$@"; do
		grep -q "^$nk_key:" "$tmp/fm" || fail "$nk_file: frontmatter lacks $nk_key"
	done
}

# hits <file> <message>: read `grep -n` output from stdin and fail once per line,
# naming <file>, the line number, and <message>. Feed it by redirection, not by a
# pipe, so the failure count stays in this shell.
hits() {
	while IFS= read -r hit; do
		echo "lint: $1:${hit%%:*}: $2"
	done > "$tmp/hits"
	if [ -s "$tmp/hits" ]; then
		cat "$tmp/hits"
		fails=$((fails + $(wc -l < "$tmp/hits")))
	fi
}

# tools_of: print one entry per line of the tools key in the frontmatter on stdin,
# written as a YAML list, a comma string, or a [flow, list].
tools_of() {
	awk '
		function out(x) { gsub(/^[ \t"]+|[ \t"]+$/, "", x); if (x != "") print x }
		/^tools:/ {
			t = 1; v = $0; sub(/^tools:[ \t]*/, "", v); gsub(/[][]/, "", v)
			n = split(v, a, ","); for (i = 1; i <= n; i++) out(a[i]); next
		}
		t && /^[ \t]*-/ { v = $0; sub(/^[ \t]*-[ \t]*/, "", v); out(v); next }
		t && /^[ \t]*$/ { next }
		{ t = 0 }' | tr -d "'"
}

# listed <regex>: print the listed files that match an extended regex.
listed() {
	grep -E "$1" "$files" || true
}

# Commands.
for c in run resume act handoff; do
	grep -qx "commands/$c.md" "$files" || fail "missing: commands/$c.md"
done
for f in $(listed '^commands/[^/]+\.md$'); do
	need_keys "$f" description argument-hint allowed-tools
done

# Agents.
for a in digester mapper auditor adversary merger; do
	grep -qx "agents/$a.md" "$files" || fail "missing: agents/$a.md"
done
for f in $(listed '^agents/[^/]+\.md$'); do
	need_keys "$f" name description model tools
	base=$(basename "$f" .md)
	if [ -s "$tmp/fm" ] && ! grep -qE "^name:[ \t]*['\"]?$base['\"]?[ \t]*$" "$tmp/fm"; then
		fail "$f: frontmatter name is not $base"
	fi
	tools_of < "$tmp/fm" > "$tmp/tools"
	if [ -s "$tmp/fm" ] && [ ! -s "$tmp/tools" ]; then
		fail "$f: tools list is empty"
	fi
	while IFS= read -r t; do
		case $t in
		Read | Grep | Glob | Bash | Write) ;;
		*) fail "$f: tool not allowed: $t (allowed: Read, Grep, Glob, Bash, Write)" ;;
		esac
	done < "$tmp/tools"
	if [ "$f" = agents/merger.md ] && [ "$(LC_ALL=C sort "$tmp/tools" | tr '\n' ' ')" != "Grep Read Write " ]; then
		fail "$f: tools are not exactly Read, Grep, Write"
	fi
	tr -d '\r' < "$f" | grep -nwE 'Edit|NotebookEdit' > "$tmp/grep"
	hits "$f" "mentions Edit or NotebookEdit" < "$tmp/grep"
done

# Skill and stage files.
skill=skills/audit/SKILL.md
if grep -qx "$skill" "$files"; then
	need_keys "$skill" name description
	grep -q 'reimagine audit' "$tmp/fm" ||
		fail "$skill: description does not name the phrase reimagine audit"
	tr -d '\r' < "$skill" > "$tmp/skill"
	for s in 1-orient 2-digest 3-domain 4-pass-one 5-pass-two 6-second-opinion \
		7-converge 8-report 9-act; do
		grep -q "stages/$s\.md" "$tmp/skill" || fail "$skill: does not name stages/$s.md"
	done
	grep -q 'skills/audit/resume\.md' "$tmp/skill" || fail "$skill: does not name skills/audit/resume.md"
	for t in 'git ls-tree' 'git -C * ls-tree' 'git cat-file -t' 'git cat-file -s' \
		'git cat-file -p' 'git -C * cat-file' 'git branch --list' 'git -C * branch --list'; do
		grep -qF "Bash($t *)" "$tmp/fm" || fail "$skill: allowed-tools lacks Bash($t *)"
	done
	! grep -qF 'Bash(git cat-file *)' "$tmp/fm" ||
		fail "$skill: allowed-tools pre-approves every form of git cat-file"
	for p in $(grep -oE 'stages/[A-Za-z0-9._-]+\.md' "$tmp/skill" | sort -u); do
		[ -f "skills/audit/$p" ] || fail "missing: skills/audit/$p (named in $skill)"
	done
else
	fail "missing: $skill"
fi

# The handoff and work-item formats, and the scripts the plugin files name.
for f in skills/audit/handoff.md skills/audit/live.md skills/audit/work-items.md skills/audit/resume.md; do
	grep -qx "$f" "$files" || fail "missing: $f"
done
for f in $(listed '^(skills|commands|agents)/'); do
	for p in $(tr -d '\r' < "$f" | grep -oE 'scripts/[A-Za-z0-9._-]+\.sh' | sort -u); do
		[ -f "$p" ] || fail "$f: names $p, which does not exist"
	done
done

# Plugin manifests.
if command -v node >/dev/null 2>&1; then
	json_check() { node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$1" 2>/dev/null; }
elif command -v python3 >/dev/null 2>&1; then
	json_check() { python3 -c 'import json, sys; json.load(open(sys.argv[1], encoding="utf-8"))' "$1" 2>/dev/null; }
else
	json_check() { return 0; }
	note "neither node nor python3 found; JSON parse check skipped"
fi
for j in .claude-plugin/plugin.json; do
	if grep -qx "$j" "$files"; then
		json_check "$j" || fail "$j: does not parse as JSON"
	else
		fail "missing: $j"
	fi
done

# No references to the repository's design documents.
for f in $(listed '^(\.claude-plugin/|commands/|skills/|agents/|README\.md$)'); do
	tr -d '\r' < "$f" | grep -nE "$doc_names" > "$tmp/grep"
	hits "$f" "names a design document of the repository" < "$tmp/grep"
done

# No advisor, except a line that forbids it.
for f in $(listed '^(agents|skills|commands)/'); do
	tr -d '\r' < "$f" | grep -ni 'advisor' |
		grep -viE '(no|never|not)( use)?( the)? `?advisor' > "$tmp/grep"
	hits "$f" "mentions advisor" < "$tmp/grep"
done

# gh_spans <kind>: read a file on stdin and print `<line>:` once per line that holds a
# backtick span with a gh command of that kind naming no host. Only spans opened and
# closed on the same line are read, and lines inside ``` fenced code blocks are skipped.
# In a span, a single-quoted argument that holds no blank, `;`, `|`, `&`, or `)` loses
# its quotes; other single-quoted text is blanked. Each command starts at `gh` (at the
# span's start or after a blank, `;`, `|`, `&`, or `(`) and runs to the next `;`, `|`,
# `&`, or `)`. Kind repo: `gh pr <sub>` or `gh issue <sub>` with at least one argument
# after <sub> passes neither -R nor --repo a <host>/<owner>/<repo> value (attached or
# separated) nor an argument that starts with https:// or http:// or is <url>. Kind api:
# `gh api` with at least one argument lacks the option --hostname (after a blank)
# followed by a blank or `=` and a value. An argument that starts with `*`
# (as in an allowed-tools pattern) does not count. The patterns are string regexes,
# since BSD awk ends a regex literal at a slash inside a bracket.
gh_spans() {
	awk -v kind="$1" '
		BEGIN {
			quoted = "\047[^\047]*\047"
			start = "(^|[ \t;|&(])gh[ \t]"
			sub_arg = "^gh[ \t]+(pr|issue)[ \t]+[A-Za-z-]+[ \t]+[^ \t*]"
			api_arg = "^gh[ \t]+api[ \t]+[^ \t*]"
			repo3 = "[ \t](-R|--repo)[ \t=]*[^ \t/]+/[^ \t/]+/[^ \t/]+"
			url = "[ \t](https://|http://|<url>([ \t]|$))"
			hostopt = "[ \t]--hostname([ \t]+|=)[^ \t=-]"
		}
		/^[ \t]*```/ { fence = !fence; next }
		fence { next }
		{
			n = split($0, a, "`")
			bad = 0
			for (i = 2; i < n; i += 2) {
				s = a[i]
				out = ""
				while (match(s, quoted)) {
					q = substr(s, RSTART + 1, RLENGTH - 2)
					if (q == "" || q ~ "[ \t;|&)]") q = "Q"
					out = out substr(s, 1, RSTART - 1) q
					s = substr(s, RSTART + RLENGTH)
				}
				s = out s
				while (match(s, start)) {
					s = substr(s, RSTART)
					if (substr(s, 1, 2) != "gh") s = substr(s, 2)
					c = s
					if (match(c, "[;|&)]")) c = substr(c, 1, RSTART - 1)
					if (kind == "repo" && c ~ sub_arg && c !~ repo3 && c !~ url) bad = 1
					if (kind == "api" && c ~ api_arg && c !~ hostopt) bad = 1
					s = substr(s, 3)
				}
			}
			if (bad) print NR ":"
		}'
}

# Self-test of gh_spans on fixed lines, against fixed expected line numbers.
cat > "$tmp/gh-sample" <<'SAMPLE'
`gh api` GET calls and `gh issue view` has no parent field
`gh pr view <n> -R <host>/<owner>/<repo> --json x`
`gh api --hostname <host> --paginate repos/o/r/pulls/1/comments`
`gh api --hostname <host> graphql -f query='x y'`
`gh pr view <id> --json baseRefName`
`gh pr view 1 -R o/r --json x` and `gh api repos/o/r`
`gh issue view 1 --repo=o/r`
`gh api graphql -f a=b`
`Bash(gh pr view *)` and `Bash(gh api *)`
`gh issue view <n> --json title`
`gh pr diff 5 -R o/r`
`gh pr view 5 -Ro/r`
`gh api search/issues -f q=x`
`set -o pipefail; gh api repos/o/r/pulls`
`gh pr view <url> --json baseRefName`
`gh pr view https://github.com/o/r/pull/1`
`gh pr view 5 -Rh/o/r` and `gh issue view 5 --repo=h/o/r`
`jq . | gh api --hostname h repos/x`
`gh api --jq '.[] | gh api repos/x' --hostname h repos/o`
`gh pr` commands
`x=$(gh api repos/o/r)`
`ghost api x`
`gh pr view 7 -R 'github.com/o/r'`
`gh pr view 'https://github.com/o/r/pull/1' --json url`
`x` then `gh pr view 5 --json a`
`gh pr view 5 --jq '.url | test("https://x")'`
`gh pr view 5 --body x-https://y`
```sh
`gh api repos/o/r`
```
`gh issue view 5 -R h/o/r`
`gh api search/code -f q=--hostname`
`gh api repos/o/r --jq .--hostname`
`gh api --hostname=h repos/o/r`
`gh api --hostname --paginate repos/o/r`
SAMPLE
gh_got=$(gh_spans repo < "$tmp/gh-sample" | tr '\n' ' ')
[ "$gh_got" = "5: 6: 7: 10: 11: 12: 25: 26: 27: " ] ||
	fail "tests/audit/lint.sh: gh host self-test, kind repo: got lines $gh_got"
gh_got=$(gh_spans api < "$tmp/gh-sample" | tr '\n' ' ')
[ "$gh_got" = "6: 8: 13: 14: 21: 32: 33: 35: " ] ||
	fail "tests/audit/lint.sh: gh host self-test, kind api: got lines $gh_got"

# Every gh read names its host.
for f in $(listed '^(agents|skills|commands)/'); do
	tr -d '\r' < "$f" | gh_spans repo > "$tmp/grep" ||
		fail "$f: gh host check (repo) did not run"
	hits "$f" "gh pr or gh issue names no host; pass -R <host>/<owner>/<repo> or a URL" < "$tmp/grep"
	tr -d '\r' < "$f" | gh_spans api > "$tmp/grep" ||
		fail "$f: gh host check (api) did not run"
	hits "$f" "gh api names no host; add --hostname <host>" < "$tmp/grep"
done

# Hash portability and deterministic patch spans.
text_spans() {
	awk -v kind="$1" '
		/^[ \t]*```/ { fence = !fence; next }
		kind == "patch" && fence { next }
		{
			bad = 0
			if (kind == "hash" && /sha256sum/ && !/shasum/) bad = 1
			if (kind == "patch") {
				n = split($0, a, "`")
				for (i = 2; i < n; i += 2)
					if (a[i] ~ /git[ \t]+(-C[ \t]+[^`]+[ \t]+)?diff[ \t]/ &&
					    a[i] ~ /\.\.\./ && a[i] !~ /--(numstat|name-only)/ &&
					    a[i] !~ /--no-ext-diff/) bad = 1
			}
			if (bad) print NR ":"
		}'
}
cat > "$tmp/text-sample" <<'SAMPLE'
`sha256sum file`
`sha256sum file || shasum -a 256 file`
`git diff <base>...<head>`
`git -C <repo> diff <base>...<head>`
`git diff --no-ext-diff <base>...<head>`
`git diff --numstat <base>...<head>`
`git -C <repo> diff --name-only <base>...<head>`
`git diff --cached`
```sh
`sha256sum file` and `git diff <base>...<head>`
```
`x` then `git diff a...b` and `git diff c...d`
SAMPLE
for kind in hash patch; do
	if text_spans "$kind" < "$tmp/text-sample" > "$tmp/text-got"; then
		text_got=$(tr '\n' ' ' < "$tmp/text-got")
		case $kind in hash) text_expected='1: 10: ' ;; patch) text_expected='3: 4: 12: ' ;; esac
		[ "$text_got" = "$text_expected" ] || fail "tests/audit/lint.sh: $kind self-test: got lines $text_got"
	else
		fail "tests/audit/lint.sh: $kind self-test did not run"
	fi
done
for f in $(listed '^(skills/audit/|agents/)'); do
	case $f in skills/audit/*)
		text_spans hash < "$f" > "$tmp/grep" || fail "$f: hash portability check did not run"
		hits "$f" "sha256sum line lacks shasum fallback" < "$tmp/grep" ;;
	esac
	text_spans patch < "$f" > "$tmp/grep" || fail "$f: patch diff check did not run"
	hits "$f" "patch git diff lacks --no-ext-diff" < "$tmp/grep"
done

# The converged item shape is the same in the merger's file and in stage 7.
item_block() {
	tr -d '\r' < "$1" | awk '
		{ sub(/^[ \t]+/, "") }
		/^```/ { if (inb) exit; f = 1; next }
		f && !inb && $0 == "## C<n>: <title>" { inb = 1 }
		inb { print }
		{ f = 0 }
	'
}
for f in agents/merger.md skills/audit/stages/7-converge.md; do
	if [ -f "$f" ]; then
		item_block "$f" > "$tmp/item-$(basename "$f")"
		[ -s "$tmp/item-$(basename "$f")" ] ||
			fail "$f: no fenced converged item block starting with '## C<n>: <title>'"
	fi
done
if [ -s "$tmp/item-merger.md" ] && [ -s "$tmp/item-7-converge.md" ]; then
	cmp -s "$tmp/item-merger.md" "$tmp/item-7-converge.md" ||
		fail "agents/merger.md: the converged item block differs from skills/audit/stages/7-converge.md"
fi

# The merger reads every file it reads whole to its last line, and each merger prompt
# gives the line counts.
if [ -f agents/merger.md ]; then
	tr -d '\r' < agents/merger.md > "$tmp/merger"
	for s in 'Read pages of at most 600 lines' 'A page the tool refuses is read again' \
		'`^## <id>$`' 'with no gap' 'status: failed at <file>:<line>'; do
		grep -qF "$s" "$tmp/merger" || fail "agents/merger.md: does not name '$s'"
	done
fi
if [ -f skills/audit/common.md ]; then
	tr -d '\r' < skills/audit/common.md | grep -qF 'status: failed at <file>:<line>' ||
		fail "skills/audit/common.md: the output contract does not name 'status: failed at <file>:<line>'"
fi
# step <file> <regex>: print the numbered step whose first line matches the regex, up
# to the next numbered line.
step() {
	tr -d '\r' < "$1" | awk -v s="$2" 'p && /^[ \t]*[0-9]+\. / { exit } $0 ~ s { p = 1 } p'
}
converge=skills/audit/stages/7-converge.md
if [ -f "$converge" ]; then
	grep -qF "awk 'END { print NR }'" "$converge" ||
		fail "$converge: does not count lines with awk 'END { print NR }'"
	for s in '^6[.] [*][*]Normal mode' '^   3[.] Launch one merger per group' '^   4[.] Launch the final merger'; do
		step "$converge" "$s" > "$tmp/step"
		[ -s "$tmp/step" ] || fail "$converge: no step matching $s"
		grep -q 'line count' "$tmp/step" || fail "$converge: the merger prompt of step $s gives no line count"
	done
fi

# The command list of hard rule 2 and of each Bash agent's Boundaries item 2 holds the
# read-only git commands agents use; all but the digester's also hold the pipe stages
# cut and uniq and bar the sort and uniq forms that write a file.
for f in skills/audit/common.md agents/auditor.md agents/adversary.md agents/mapper.md agents/digester.md; do
	[ -f "$f" ] || continue
	case $f in
	skills/*) s='^2[.] [*][*]Prevention and detection' ;;
	*) s='^2[.] Bash runs only' ;;
	esac
	step "$f" "$s" | tr '\n\t' '  ' | tr -s ' ' > "$tmp/list"
	[ -s "$tmp/list" ] || fail "$f: no command list matching $s"
	set -- '`git rev-parse`' '`git merge-base`' '`git ls-tree`' \
		'`git cat-file` with `-t`, `-s` or `-p`' '`git branch --list`'
	case $f in
	agents/digester.md) ;;
	*) set -- "$@" '`cut`' '`uniq`' '`sort -o`, `--output` or `--compress-program`' '`uniq` with an output file operand' ;;
	esac
	for c in "$@"; do
		grep -qF "$c" "$tmp/list" || fail "$f: the command list lacks $c"
	done
done

# The default rank, the required checks and the instruction files read before a change
# name the rules and skills directories and REVIEW.md at the base; each file is read as
# one line.
f=skills/audit/stages/1-orient.md
if [ -f "$f" ]; then
	tr -d '\r' < "$f" | tr '\n\t' '  ' | tr -s ' ' > "$tmp/list"
	grep -qF '(`AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/`, `.claude/rules/`, `.claude/skills/`, `REVIEW.md`)' "$tmp/list" ||
		fail "$f: the default rank does not list .claude/rules/, .claude/skills/ and REVIEW.md after docs/"
	grep -qF 'read at the pinned base with `git show <base>:<path>`, never from the head or the working tree' "$tmp/list" ||
		fail "$f: the default rank does not say REVIEW.md is read at the base with git show <base>:<path>"
fi
f=skills/audit/stages/9-act.md
if [ -f "$f" ]; then
	tr -d '\r' < "$f" | tr '\n\t' '  ' | tr -s ' ' > "$tmp/list"
	grep -qF '`README.md`, `.claude/rules/`, `.claude/skills/`, `REVIEW.md` at the base, CI configuration' "$tmp/list" ||
		fail "$f: the required checks do not name .claude/rules/, .claude/skills/ and REVIEW.md at the base"
fi
# The report alone applies REVIEW.md's severity and do-not-report rules, so every agent
# reports as if they were absent; the file is read as one line.
f=skills/audit/common.md
if [ -f "$f" ]; then
	tr -d '' < "$f" | tr '
	' '  ' | tr -s ' ' > "$tmp/list"
	grep -qF 'every agent reports and labels a finding as if those rules were absent' "$tmp/list" ||
		fail "$f: does not say every agent reports as if REVIEW.md's severity and do-not-report rules were absent"
fi
for f in skills/audit/stages/9-act.md skills/audit/common.md; do
	[ -f "$f" ] || continue
	tr -d '\r' < "$f" | tr '\n\t' '  ' | tr -s ' ' > "$tmp/list"
	grep -qF 'the rules in `.claude/rules/` that apply to it (one with no `paths`, or one whose `paths` match it)' "$tmp/list" &&
		grep -qF 'the skills in `.claude/skills/`' "$tmp/list" ||
		fail "$f: the instruction files read before a change do not name the rules and skills that apply"
	grep -qF 'the `REVIEW.md` copies `audit-brief.md` records at the base' "$tmp/list" ||
		fail "$f: the instruction files read before a change do not name the REVIEW.md copies at the base"
done

if [ "$fails" -gt 0 ]; then
	exit 1
fi
echo "lint: ok"
