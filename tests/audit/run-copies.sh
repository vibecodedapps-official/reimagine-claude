#!/bin/sh
# run-copies.sh: tests for scripts/run-copies.sh.
#
# Usage: sh tests/audit/run-copies.sh
#
# Copies the script into a temp plugin tree beside a small skills/audit/common.md and
# audit-evidence.md, so the whole output is a literal and the lookup from the script's
# own path is exercised; then runs the shipped script against the shipped files, whose
# header lines are literals and whose other bytes are compared with their source. Each
# bad argument is run with its exit code and message.
#
# Prints one line per mismatch and `run-copies test: ok` on success; exits 1 on any
# mismatch.
set -u

root=$(cd "$(dirname "$0")/../.." && pwd)
rc=$root/plugins/audit/scripts/run-copies.sh

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fails=0
fail() {
	echo "run-copies test: $*"
	fails=$((fails + 1))
}

# run <label> <expected exit> <expected stderr> <script> <args...>: stdout must be empty.
run() {
	label=$1
	want_st=$2
	want_err=$3
	script=$4
	shift 4
	if out=$(sh "$script" "$@" 2> "$tmp/err"); then st=0; else st=$?; fi
	err=$(cat "$tmp/err")
	[ "$st" = "$want_st" ] || fail "$label: expected exit $want_st, got $st"
	[ "$out" = "" ] || fail "$label: expected no stdout, got '$out'"
	[ "$err" = "$want_err" ] || fail "$label: expected stderr '$want_err', got '$err'"
}

# same <label> <file a> <file b>: byte-equal files.
same() {
	cmp -s "$2" "$3" || fail "$1: $2 differs from $3"
}

# ---------------------------------------------------------------------------
# A small plugin tree. The body holds a second fence with the placeholder text, which
# must stay as it is, and the evidence file ends without a newline.
P=$tmp/plugin
mkdir -p "$P/scripts" "$P/skills/audit" "$tmp/run" "$tmp/run2"
cp "$rc" "$P/scripts/run-copies.sh"
cat > "$P/skills/audit/common.md" <<'EOF'
# Common rules for this run

Stage 1 copies this file and fills in the header below.

```
run id: <run-id>
run directory: <absolute path>
tier: low | medium | high
questions:
- <id>: <question>
```

## Hard rules

An example of the header, which is not the header:

```
run id: <run-id>
- <id>: <question>
```
EOF
printf 'Evidence rules.\r\nNo final newline' > "$P/skills/audit/audit-evidence.md"

printf -- '- Q1: best practice\r\n- Q2: semantic drift, no more and no less\n' > "$tmp/q.md"
run "small tree" 0 "" "$P/scripts/run-copies.sh" "$tmp/run" 2026-10-24-0912-app-1 medium "$tmp/q.md"
cat > "$tmp/want-common.md" <<EOF
# Common rules for this run

Stage 1 copies this file and fills in the header below.

\`\`\`
run id: 2026-10-24-0912-app-1
run directory: $tmp/run
tier: medium
questions:
- Q1: best practice
- Q2: semantic drift, no more and no less
\`\`\`

## Hard rules

An example of the header, which is not the header:

\`\`\`
run id: <run-id>
- <id>: <question>
\`\`\`
EOF
same "small tree common.md" "$tmp/run/common.md" "$tmp/want-common.md"
same "small tree audit-evidence.md" "$tmp/run/audit-evidence.md" "$P/skills/audit/audit-evidence.md"
[ ! -e "$tmp/run/common.md.tmp" ] && [ ! -e "$tmp/run/audit-evidence.md.tmp" ] || fail "small tree: a .tmp file was left"

# A second run replaces the copies: a stale common.md with other content goes away.
printf 'stale\n' > "$tmp/run/common.md"
run "second run" 0 "" "$P/scripts/run-copies.sh" "$tmp/run" 2026-10-24-0912-app-1 medium "$tmp/q.md"
same "second run common.md" "$tmp/run/common.md" "$tmp/want-common.md"

# A run directory with a backslash and an id with a dollar sign reach the header as they are.
mkdir -p "$tmp/run3"
run "verbatim values" 0 "" "$P/scripts/run-copies.sh" "$tmp/run3" 'id$x\y' low "$tmp/q.md"
sed -n '6,7p' "$tmp/run3/common.md" > "$tmp/got-head"
printf 'run id: id$x\\y\nrun directory: %s\n' "$tmp/run3" > "$tmp/want-head"
same "verbatim values header" "$tmp/got-head" "$tmp/want-head"

# Bad arguments: exit 1, nothing written.
run "three arguments" 1 "usage: run-copies.sh <run dir> <run id> <tier> <questions file>" "$P/scripts/run-copies.sh" "$tmp/run2" id low
run "five arguments" 1 "usage: run-copies.sh <run dir> <run id> <tier> <questions file>" "$P/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/q.md" extra
run "empty id" 1 "run-copies: the run id is empty or holds a blank" "$P/scripts/run-copies.sh" "$tmp/run2" "" low "$tmp/q.md"
run "id with a blank" 1 "run-copies: the run id is empty or holds a blank" "$P/scripts/run-copies.sh" "$tmp/run2" "a b" low "$tmp/q.md"
run "bad tier" 1 "run-copies: tier 'Low' is not low, medium or high" "$P/scripts/run-copies.sh" "$tmp/run2" id Low "$tmp/q.md"
run "missing run directory" 1 "run-copies: $tmp/none is not a directory" "$P/scripts/run-copies.sh" "$tmp/none" id low "$tmp/q.md"
run "run directory is a file" 1 "run-copies: $tmp/q.md is not a directory" "$P/scripts/run-copies.sh" "$tmp/q.md" id low "$tmp/q.md"
run "missing questions file" 1 "run-copies: cannot read $tmp/none.md" "$P/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/none.md"
: > "$tmp/empty.md"
run "empty questions file" 1 "run-copies: $tmp/empty.md is empty" "$P/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/empty.md"
printf -- '- Q1: best practice\nQ2: no dash\n' > "$tmp/bad1.md"
run "question line without a dash" 1 "run-copies: $tmp/bad1.md:2: not a '- <id>: <question>' line" "$P/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/bad1.md"
printf -- '- Q 1: id with a blank\n' > "$tmp/bad2.md"
run "question id with a blank" 1 "run-copies: $tmp/bad2.md:1: not a '- <id>: <question>' line" "$P/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/bad2.md"
printf -- '- Q1: \n' > "$tmp/bad3.md"
run "question without text" 1 "run-copies: $tmp/bad3.md:1: not a '- <id>: <question>' line" "$P/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/bad3.md"
printf -- '- Q1: best practice\n\n' > "$tmp/bad4.md"
run "blank question line" 1 "run-copies: $tmp/bad4.md:2: not a '- <id>: <question>' line" "$P/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/bad4.md"
[ -z "$(ls -A "$tmp/run2")" ] || fail "bad arguments: something was written to the run directory"

# IO failures: exit 2.
Q=$tmp/plugin2
mkdir -p "$Q/scripts" "$Q/skills/audit"
cp "$rc" "$Q/scripts/run-copies.sh"
printf 'Evidence.\n' > "$Q/skills/audit/audit-evidence.md"
run "missing common.md" 2 "run-copies: cannot read $Q/scripts/../skills/audit/common.md" "$Q/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/q.md"
printf '# No header\n\n```\nrun id: <run-id>\nrun directory: <absolute path>\nquestions:\n- <id>: <question>\n```\n' > "$Q/skills/audit/common.md"
run "header without a tier line" 2 "run-copies: $Q/scripts/../skills/audit/common.md has no header to fill" "$Q/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/q.md"
printf '# No fence\n\nrun id: <run-id>\nrun directory: <absolute path>\ntier: low | medium | high\nquestions:\n- <id>: <question>\n' > "$Q/skills/audit/common.md"
run "header outside a fence" 2 "run-copies: $Q/scripts/../skills/audit/common.md has no header to fill" "$Q/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/q.md"
rm "$Q/skills/audit/audit-evidence.md"
printf '```\nrun id: <run-id>\nrun directory: <absolute path>\ntier: low | medium | high\nquestions:\n- <id>: <question>\n```\n' > "$Q/skills/audit/common.md"
run "missing audit-evidence.md" 2 "run-copies: cannot read $Q/scripts/../skills/audit/audit-evidence.md" "$Q/scripts/run-copies.sh" "$tmp/run2" id low "$tmp/q.md"
[ -z "$(ls -A "$tmp/run2")" ] || fail "IO failures: something was written to the run directory"

# ---------------------------------------------------------------------------
# The shipped files, with the four default questions. The header is lines 10 to 16 of
# the shipped common.md and lines 10 to 19 of the copy; every other line is its source's.
S=$root/plugins/audit/skills/audit
R=$tmp/shipped
mkdir -p "$R"
cat > "$tmp/default.md" <<'EOF'
- Q1: best practice: does the change follow the ranked sources and the repository's own conventions?
- Q2: semantic drift: does the code do what the ticket and the claims say, no more and no less?
- Q3: technical debt: what does the change leave for later, and is that recorded?
- Q4: decision quality: were the choices the right ones, which alternatives existed, and which does the auditor recommend, with the reason?
EOF
run "shipped files" 0 "" "$rc" "$R" 2026-10-24-1030-app-12 high "$tmp/default.md"
sed -n '10,19p' "$R/common.md" > "$tmp/got-header"
cat > "$tmp/want-header" <<EOF
\`\`\`
run id: 2026-10-24-1030-app-12
run directory: $R
tier: high
questions:
- Q1: best practice: does the change follow the ranked sources and the repository's own conventions?
- Q2: semantic drift: does the code do what the ticket and the claims say, no more and no less?
- Q3: technical debt: what does the change leave for later, and is that recorded?
- Q4: decision quality: were the choices the right ones, which alternatives existed, and which does the auditor recommend, with the reason?
\`\`\`
EOF
same "shipped header" "$tmp/got-header" "$tmp/want-header"
head -n 9 "$R/common.md" > "$tmp/got-lead"
head -n 9 "$S/common.md" > "$tmp/want-lead"
same "shipped lead" "$tmp/got-lead" "$tmp/want-lead"
tail -n +20 "$R/common.md" > "$tmp/got-body"
tail -n +17 "$S/common.md" > "$tmp/want-body"
same "shipped body" "$tmp/got-body" "$tmp/want-body"
same "shipped audit-evidence.md" "$R/audit-evidence.md" "$S/audit-evidence.md"
grep -q 'run id: <run-id>' "$R/common.md" && fail "shipped: a placeholder line was left"
grep -q '^- <id>: <question>$' "$R/common.md" && fail "shipped: the question placeholder was left"

if [ "$fails" -eq 0 ]; then
	echo "run-copies test: ok"
	exit 0
fi
exit 1
