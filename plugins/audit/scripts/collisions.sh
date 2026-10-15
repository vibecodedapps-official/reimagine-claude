#!/bin/sh
# collisions.sh: find other open pull requests that add a run-once script whose name
# collides with one the bundle adds.
#
# Usage:
#   sh collisions.sh <open-prs.json> <own PR number> <limit> <new path>...
#
# <open-prs.json> is the output of stage 1's `gh pr list ... --limit <limit> --json
# number,url,headRefName,changedFiles,files`. Each <new path> is a repo-relative path the
# bundle's run-once list gives as new: an `A` entry, or the new path of an `R` or `C`.
# The bundle's own PR is left out. A file of another PR is a candidate when it is in the
# same directory as a new path, its changeType is not DELETED, and it has the same file
# name (`same name`), or else both names have the same leading version token (`same
# version`). The token is taken from the file name after one leading V or v that comes
# before a digit: a run of digits, then any `.` or `_` groups of digits, so `V3__a.sql`,
# `v3_b.sql`, and `3-c.sql` all have the token 3, `003_x.sql` has 003, `1.2.sql` has 1.2,
# and `init.sql` has none. Paths in other directories are not compared.
#
# Prints one tab-separated line per finding, sorted and without duplicates:
#   collision <new path> <same name|same version> <other PR url> <other path> <changeType>
#   cut <other PR url> <files read> <changedFiles>    (gh returned fewer files than it has)
#   cut-list <limit>                                  (the list may hold more open PRs)
# and nothing when there is none; exits 0. Exits 2 with one line on stderr on a usage
# error, an unreadable file, a file that is not a pull request list, or a missing jq.
set -u

usage() {
	echo "usage: collisions.sh <open-prs.json> <own PR number> <limit> <new path>..." >&2
	exit 2
}

[ $# -ge 4 ] || usage
file=$1
own=$2
limit=$3
shift 3
case $own in '' | *[!0-9]*) usage ;; esac
case $limit in '' | *[!0-9]*) usage ;; esac

if ! command -v jq >/dev/null 2>&1; then
	echo "collisions: jq not found" >&2
	exit 2
fi
if [ ! -f "$file" ] || [ ! -r "$file" ]; then
	echo "collisions: cannot read $file" >&2
	exit 2
fi

tmp=$(mktemp) || exit 2
trap 'rm -f "$tmp"' EXIT

if ! jq -r --argjson own "$own" --argjson limit "$limit" '
	def dir: if test("/") then sub("/[^/]*$"; "") else "" end;
	def base: sub("^.*/"; "");
	def token: [base | sub("^[Vv](?=[0-9])"; "") | capture("^(?<t>[0-9]+([._][0-9]+)*)")] | first.t // null;
	if type != "array" or any(.[]; type != "object" or (.number | type) != "number"
		or (.url | type) != "string" or (.files | type) != "array") then error("shape") else . end
	| length as $listed
	| map(select(.number != $own)) as $others
	| $ARGS.positional as $new
	| ( $others[] as $pr
		| $pr.files[] | select(.changeType != "DELETED") as $f
		| $new[] as $n
		| select(($f.path | dir) == ($n | dir))
		| if ($f.path | base) == ($n | base) then ["collision", $n, "same name", $pr.url, $f.path, $f.changeType]
		  elif ($n | token) != null and ($f.path | token) == ($n | token) then ["collision", $n, "same version", $pr.url, $f.path, $f.changeType]
		  else empty end ),
	  ( $others[] | select((.changedFiles // 0) > (.files | length)) | ["cut", .url, (.files | length | tostring), (.changedFiles | tostring)] ),
	  ( if $listed >= $limit then ["cut-list", ($limit | tostring)] else empty end )
	| @tsv' --args "$@" < "$file" > "$tmp" 2>/dev/null; then
	echo "collisions: $file is not a pull request list" >&2
	exit 2
fi
# jq on Windows ends its lines with CRLF.
tr -d '\r' < "$tmp" | LC_ALL=C sort -u
