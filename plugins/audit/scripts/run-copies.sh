#!/bin/sh
# run-copies.sh: write the run's copies of common.md and audit-evidence.md.
#
# Usage:
#   sh run-copies.sh <run dir> <run id> <tier> <questions file>
#
# Reads skills/audit/common.md and skills/audit/audit-evidence.md of the plugin this
# script belongs to, found from its own path (../skills/audit/), and writes them into
# <run dir> as common.md and audit-evidence.md, so neither passes through the model. In
# common.md the four placeholder lines of the header, the first ``` fenced block, are
# filled: `run id: <run-id>` takes <run id>, `run directory: <absolute path>` takes
# <run dir> as given, `tier: low | medium | high` takes <tier>, and `- <id>: <question>`
# is replaced by the lines of <questions file>, each `- <id>: <question>` with an id that
# holds no blank or colon. Every other byte is copied unchanged; audit-evidence.md is
# copied byte for byte. An existing copy is replaced.
#
# Exit 0 when both files are written, with nothing on stdout. Exit 1 with one line on
# stderr on a bad argument: the count; a run id that is empty or holds a blank; a tier
# other than low, medium or high; a run directory that is not a directory; a questions
# file that cannot be read, is empty, or holds a line that is not `- <id>: <question>`
# (a trailing CR is allowed and dropped). Exit 2 with one line on stderr when a skill
# file cannot be read, when the header of common.md lacks one of its four placeholder
# lines, or when a write fails. Each copy is written to <name>.tmp beside its
# destination and moved into place, so a failure leaves no partial copy.
#
# POSIX sh plus awk; the awk programs use only features that mawk, gawk, and BSD awk all
# accept. Values reach awk through the environment, so a backslash in a path or an id is
# kept as it is.
set -u

usage() {
	echo "usage: run-copies.sh <run dir> <run id> <tier> <questions file>" >&2
	exit 1
}

[ $# -eq 4 ] || usage
dir=$1
id=$2
tier=$3
qf=$4

case $id in
'' | *[[:space:]]*)
	echo "run-copies: the run id is empty or holds a blank" >&2
	exit 1
	;;
esac
case $tier in
low | medium | high) ;;
*)
	echo "run-copies: tier '$tier' is not low, medium or high" >&2
	exit 1
	;;
esac
if [ ! -d "$dir" ]; then
	echo "run-copies: $dir is not a directory" >&2
	exit 1
fi
if [ ! -f "$qf" ] || [ ! -r "$qf" ]; then
	echo "run-copies: cannot read $qf" >&2
	exit 1
fi

# The questions file: every line is `- <id>: <question>`, and there is at least one.
# Prints the number of the first bad line, or 0 for an empty file; nothing when valid.
bad=$(awk '
	{ sub(/\r$/, ""); if ($0 !~ /^- [^ :]+: [^ ].*$/) { bad = NR; exit } }
	END { if (bad) print bad; else if (NR == 0) print 0 }
' "$qf") || exit 2
if [ -n "$bad" ]; then
	if [ "$bad" = 0 ]; then
		echo "run-copies: $qf is empty" >&2
	else
		echo "run-copies: $qf:$bad: not a '- <id>: <question>' line" >&2
	fi
	exit 1
fi

here=$(cd "$(dirname "$0")" && pwd) || exit 2
skill=$here/../skills/audit
for f in common.md audit-evidence.md; do
	if [ ! -f "$skill/$f" ] || [ ! -r "$skill/$f" ]; then
		echo "run-copies: cannot read $skill/$f" >&2
		exit 2
	fi
done

tmp=$dir/common.md.tmp
RC_ID=$id RC_DIR=$dir RC_TIER=$tier RC_QF=$qf awk '
	BEGIN {
		id = ENVIRON["RC_ID"]; dir = ENVIRON["RC_DIR"]; tier = ENVIRON["RC_TIER"]
		qf = ENVIRON["RC_QF"]; n = 0
		while ((getline line < qf) > 0) { sub(/\r$/, "", line); q[++n] = line }
		close(qf)
		fences = 0; sid = 0; sdir = 0; stier = 0; sq = 0
	}
	$0 == "```" { fences++; print; next }
	fences == 1 && $0 == "run id: <run-id>" { print "run id: " id; sid++; next }
	fences == 1 && $0 == "run directory: <absolute path>" { print "run directory: " dir; sdir++; next }
	fences == 1 && $0 == "tier: low | medium | high" { print "tier: " tier; stier++; next }
	fences == 1 && $0 == "- <id>: <question>" { for (i = 1; i <= n; i++) print q[i]; sq++; next }
	{ print }
	END { if (sid != 1 || sdir != 1 || stier != 1 || sq != 1) exit 3 }
' "$skill/common.md" > "$tmp"
st=$?
if [ "$st" -ne 0 ]; then
	rm -f "$tmp"
	if [ "$st" -eq 3 ]; then
		echo "run-copies: $skill/common.md has no header to fill" >&2
	else
		echo "run-copies: cannot write $dir/common.md" >&2
	fi
	exit 2
fi
if ! mv -f "$tmp" "$dir/common.md"; then
	rm -f "$tmp"
	echo "run-copies: cannot write $dir/common.md" >&2
	exit 2
fi

tmp=$dir/audit-evidence.md.tmp
if ! cat "$skill/audit-evidence.md" > "$tmp" || ! mv -f "$tmp" "$dir/audit-evidence.md"; then
	rm -f "$tmp"
	echo "run-copies: cannot write $dir/audit-evidence.md" >&2
	exit 2
fi
exit 0
