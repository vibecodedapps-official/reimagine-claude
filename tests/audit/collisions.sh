#!/bin/sh
# collisions.sh: tests for scripts/collisions.sh.
#
# Usage: sh tests/audit/collisions.sh
#
# Writes small `gh pr list` outputs in a temp directory and compares the script's output
# and exit status with literals. Prints one line per mismatch and `collisions test: ok` on
# success; exits 1 on any mismatch. When jq is missing it prints a note and exits 0.
set -u

if ! command -v jq >/dev/null 2>&1; then
	echo "collisions test: note: jq not found, nothing was tested"
	exit 0
fi

root=$(cd "$(dirname "$0")/../.." && pwd)
cs=$root/plugins/audit/scripts/collisions.sh

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fails=0
fail() {
	echo "collisions test: $*"
	fails=$((fails + 1))
}
tab=$(printf '\t')

# run <name> <expected status> <expected output> <file> <own> <limit> <path>...
run() {
	name=$1 want_st=$2 want=$3
	shift 3
	if out=$(cd "$tmp" && sh "$cs" "$@" 2>&1); then st=0; else st=$?; fi
	[ "$st" = "$want_st" ] || fail "$name: expected exit $want_st, got $st"
	[ "$out" = "$want" ] || fail "$name: got '$out', expected '$want'"
}

# PR 1 is the bundle's own. PR 2 adds the same name, PR 3 the same version under another
# prefix, PR 4 the same name in another directory and an unrelated file, PR 5 deletes a
# file of the same name, PR 6 renames one in with the same version, PR 7 was cut by gh.
cat > "$tmp/list.json" <<'EOF'
[
 {"number":1,"url":"https://github.com/o/r/pull/1","headRefName":"own","changedFiles":1,"files":[{"path":"db/migrations/V3__add_status.sql","changeType":"ADDED"}]},
 {"number":7,"url":"https://github.com/o/r/pull/7","headRefName":"big","changedFiles":250,"files":[{"path":"src/a.js","changeType":"MODIFIED"}]},
 {"number":2,"url":"https://github.com/o/r/pull/2","headRefName":"b","changedFiles":2,"files":[{"path":"db/migrations/V3__add_status.sql","changeType":"ADDED"},{"path":"README.md","changeType":"MODIFIED"}]},
 {"number":3,"url":"https://github.com/o/r/pull/3","headRefName":"c","changedFiles":1,"files":[{"path":"db/migrations/v3_other.sql","changeType":"ADDED"}]},
 {"number":4,"url":"https://github.com/o/r/pull/4","headRefName":"d","changedFiles":2,"files":[{"path":"db/seed/V3__add_status.sql","changeType":"ADDED"},{"path":"db/migrations/init.sql","changeType":"MODIFIED"}]},
 {"number":5,"url":"https://github.com/o/r/pull/5","headRefName":"e","changedFiles":1,"files":[{"path":"db/migrations/V3__add_status.sql","changeType":"DELETED"}]},
 {"number":6,"url":"https://github.com/o/r/pull/6","headRefName":"f","changedFiles":1,"files":[{"path":"db/migrations/3-renamed.sql","changeType":"RENAMED"}]}
]
EOF

want="collision${tab}db/migrations/V3__add_status.sql${tab}same name${tab}https://github.com/o/r/pull/2${tab}db/migrations/V3__add_status.sql${tab}ADDED
collision${tab}db/migrations/V3__add_status.sql${tab}same version${tab}https://github.com/o/r/pull/3${tab}db/migrations/v3_other.sql${tab}ADDED
collision${tab}db/migrations/V3__add_status.sql${tab}same version${tab}https://github.com/o/r/pull/6${tab}db/migrations/3-renamed.sql${tab}RENAMED
cut${tab}https://github.com/o/r/pull/7${tab}1${tab}250"
run "mixed list" 0 "$want" list.json 1 100 db/migrations/V3__add_status.sql

# The same input in another order gives the same bytes.
jq 'reverse | map(.files |= reverse)' "$tmp/list.json" > "$tmp/reversed.json"
run "reordered list" 0 "$want" reversed.json 1 100 db/migrations/V3__add_status.sql

# The own PR is left out: as PR 2, the same file of PR 1 is a collision instead.
run "own PR left out" 0 "collision${tab}db/migrations/V3__add_status.sql${tab}same name${tab}https://github.com/o/r/pull/1${tab}db/migrations/V3__add_status.sql${tab}ADDED
collision${tab}db/migrations/V3__add_status.sql${tab}same version${tab}https://github.com/o/r/pull/3${tab}db/migrations/v3_other.sql${tab}ADDED
collision${tab}db/migrations/V3__add_status.sql${tab}same version${tab}https://github.com/o/r/pull/6${tab}db/migrations/3-renamed.sql${tab}RENAMED
cut${tab}https://github.com/o/r/pull/7${tab}1${tab}250" list.json 2 100 db/migrations/V3__add_status.sql

# A name with no version token matches only by name; leading zeros are kept.
cat > "$tmp/tokens.json" <<'EOF'
[
 {"number":2,"url":"https://github.com/o/r/pull/2","changedFiles":3,"files":[{"path":"m/init.sql","changeType":"MODIFIED"},{"path":"m/3_x.sql","changeType":"ADDED"},{"path":"m/1.2.sql","changeType":"ADDED"}]}
]
EOF
run "tokens" 0 "collision${tab}m/1.2_y.sql${tab}same version${tab}https://github.com/o/r/pull/2${tab}m/1.2.sql${tab}ADDED
collision${tab}m/init.sql${tab}same name${tab}https://github.com/o/r/pull/2${tab}m/init.sql${tab}MODIFIED" \
	tokens.json 1 100 m/003_x.sql m/init.sql m/1.2_y.sql m/setup.sql

# A top-level path is compared with top-level files only.
cat > "$tmp/top.json" <<'EOF'
[{"number":2,"url":"https://github.com/o/r/pull/2","changedFiles":2,"files":[{"path":"001.sql","changeType":"ADDED"},{"path":"m/001.sql","changeType":"ADDED"}]}]
EOF
run "top level" 0 "collision${tab}001_a.sql${tab}same version${tab}https://github.com/o/r/pull/2${tab}001.sql${tab}ADDED" top.json 1 100 001_a.sql

# A list as long as the limit may be cut; an empty list has nothing.
run "cut list" 0 "collision${tab}m/init.sql${tab}same name${tab}https://github.com/o/r/pull/2${tab}m/init.sql${tab}MODIFIED
cut-list${tab}1" tokens.json 1 1 m/init.sql
echo '[]' > "$tmp/empty.json"
run "empty list" 0 "" empty.json 1 100 m/init.sql
run "no collision" 0 "" tokens.json 1 100 other/init.sql

# Errors.
printf 'not json' > "$tmp/bad.json"
run "bad json" 2 "collisions: bad.json is not a pull request list" bad.json 1 100 m/a.sql
echo '{"number":1}' > "$tmp/object.json"
run "not a list" 2 "collisions: object.json is not a pull request list" object.json 1 100 m/a.sql
echo '[{"number":2,"url":"u"}]' > "$tmp/nofiles.json"
run "no files key" 2 "collisions: nofiles.json is not a pull request list" nofiles.json 1 100 m/a.sql
run "unreadable file" 2 "collisions: cannot read nope.json" nope.json 1 100 m/a.sql
run "usage, no path" 2 "usage: collisions.sh <open-prs.json> <own PR number> <limit> <new path>..." list.json 1 100
run "usage, bad number" 2 "usage: collisions.sh <open-prs.json> <own PR number> <limit> <new path>..." list.json x 100 m/a.sql

if [ "$fails" -gt 0 ]; then
	exit 1
fi
echo "collisions test: ok"
