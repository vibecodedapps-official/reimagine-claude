#!/bin/sh
# revert-tests.sh: run a bundle's changed test files twice, in a copy of its head and in a
# copy of its merge-base with the test code at its head state, and write one result file
# with a verdict per file. A test file that passes in both copies does not detect the
# bundle's other changes.
#
# Usage:
#   sh revert-tests.sh run <repo> <base> <head> <keys file> <work dir> <result file>
#   sh revert-tests.sh bg <repo> <base> <head> <keys file> <work dir> <result file>
#   sh revert-tests.sh wait <result file>
#
# `bg` and `wait` let a caller whose single command may not outlast a timeout, such as an
# agent's shell tool in a headless session, run a bundle that takes longer: it starts `bg`
# in the background and repeats `wait` until it exits other than 3.
# - `bg` removes `<result file>.exit`, creates `<result file>.err`, and runs `run` as a
#   child, in its own process group, with its output in `.err`. When the child ends, `bg`
#   writes the child's exit status to `<result file>.exit.tmp` and renames it to `.exit`.
#   At REVERT_TESTS_DEADLINE seconds (default 3600) it sends the child's group TERM, and
#   KILL 60 seconds later, and adds `revert-tests: stopped at the deadline of <n> seconds`
#   to `.err`. On HUP, INT, or TERM it sends the group TERM and exits 2 without writing
#   `.exit`. When `bg` is gone without a signal (KILL), the group's leader sends the group
#   TERM within a second, unless the group had one already, and KILL 60 seconds later;
#   `.exit` is not written.
# - `wait` checks every 2 seconds for at most REVERT_TESTS_WAIT seconds (default 540).
#   With `.exit` present, it prints the last line of `.err` that is not blank on stderr
#   (or, with none and a status other than 0, `revert-tests: the run ended with status
#   <n>`), so a shell's job notice before `run`'s own line is dropped, removes both files, and
#   exits 0 for status 0, else 2. With neither file present after 30 seconds (or the
#   window, when shorter), it exits 2: no run started. At the window's end it exits 3.
#
# Portability: bash (Linux, macOS, Git Bash), which the script re-executes itself under
# when another sh starts it, and awk in forms mawk and gawk accept. Each command needs its
# own process group, from job control, and dash turns job control off when it has no
# controlling terminal, as under CI; bash does not. Under `set -m` bash can print
# `child setpgid (N to N): ...` at a job's start, when the child's own setpgid call fails
# after the parent's has already placed it (seen on macOS, about one start in 2000, the
# job in its own group every time); the script drops that line, and fails the start if
# the job is alive but leads no group of its own.
# Every git call only reads: rev-parse, merge-base, diff-tree, ls-tree, and cat-file.
# GIT_DIR, GIT_WORK_TREE, and GIT_INDEX_FILE from the caller are unset first.
#
# Keys file: one line per value, `<key><TAB><value>`. `command` (required), `setup`, and
# `timeout` (whole seconds, 1 or more, default 300) at most once; `run` (one or more) and
# `path` (none or more) once per pattern. No `path` line means the default test_paths:
# **/test/**, **/tests/**, **/__tests__/**, **/*_test.*, **/test_*.*, **/*.test.*,
# **/*.spec.*, **/*Tests/**, **/*Test.*, **/*Tests.*. Patterns follow git's glob pathspec
# rules (`*` does not cross `/`, `**` does).
#
# Work dir: must not exist. The script creates it, writes the two copies and their
# temporary and cache directories in it, and removes it on every exit.
#
# Steps:
# 1. The changed paths are those of `git diff-tree -r --no-renames` from the merge-base to
#    the head, so a rename is its old path deleted and its new path added. Test code is
#    each changed path that matches a `path` pattern. The files to run are the test-code
#    paths present at the head that match a `run` pattern, sorted, at most 20; the rest
#    are `not run: file cap`. With none, the result says `no changed tests to run`.
# 2. When the head tree or the merge-base tree holds over 1 GB of blobs, nothing runs:
#    `not run: tree over 1 GB`.
# 3. The reverted copy is the merge-base tree with each test-code path at its head state:
#    its head content and mode, or absent when the head lacks it. When a test-code path
#    and a merge-base path cannot both exist (one is a file where the other needs a
#    directory), nothing runs: `not run: path conflict`. Both copies are written from
#    `git cat-file`, as stage 1 step 6 exports a tree: a symlink as a file holding its
#    target, a submodule absent, a Git LFS pointer as the pointer file, and a path with a
#    newline, or with an empty, `.`, `..`, or `.git` component, not written. The result
#    lists each, at most 50 per kind per copy, with the count.
# 4. In each copy, from its root: `setup` with `sh -c`, then for each file
#    `sh -c '<command> "$1"' sh <path>`. The reverted copy runs only the files that
#    passed at the head, and only when the head copy's setup passed. Each command runs
#    with TMPDIR, TMP, TEMP, and XDG_CACHE_HOME in the work dir, GIT_CEILING_DIRECTORIES
#    set to the work dir, every GIT_* variable unset, the caller's LC_ALL, and stdin from
#    /dev/null. Each command's deadline is the smaller of `timeout` and what is left of
#    the bundle's cap, counted from the first command. The cap is 1800 seconds, or
#    REVERT_TESTS_CAP when set (whole seconds; tests/audit/revert-tests.sh sets it, so its time
#    cap case does not wait 30 minutes). Each command starts as a
#    job under `set -m`, in its own process group. At the deadline the group gets TERM,
#    then KILL 10 seconds later. Whether the command ends or times out, the group then
#    gets KILL, and the script waits until no process in it is left. A process that
#    leaves the group (setsid, a daemon) is beyond reach; on Windows, a native program's
#    own children are outside the group.
# 5. Verdicts per file:
#    passes at head and without the change   exit 0 in both copies
#    passes at head only                     exit 0 at the head, another status reverted
#    does not pass at head                   another status at the head, or a timeout
#    not run: <reason>                       setup failed, a timeout in the reverted
#                                            copy, a path conflict, or a cap
#    Every exit status of the command counts as a run, 126 and 127 included.
# 6. The result file is written to `<result file>.tmp` and renamed into place.
#
# Output tails are the last 80 lines of the command's output and errors, unredacted, each
# line cut at 400 bytes, with NUL and carriage return bytes removed.
#
# Exit status of `run`:
#   2  wrong arguments or keys, the work dir exists, a git step or write failed, a job
#      did not start in its own process group, or a process group was still live 10
#      seconds after KILL (one line on stderr; no result file)
#   0  the result file is written, whatever the verdicts
# `bg` exits 0 once `.exit` is written, else 2. `wait` exits as `run` did (0, or 2 with
# its stderr), 2 for no run started or an unreadable `.exit`, and 3 while still running.

if [ -z "${BASH_VERSION:-}" ]; then
	if ! command -v bash > /dev/null 2>&1; then
		echo "revert-tests: needs bash" >&2
		exit 2
	fi
	exec bash "$0" "$@"
fi

set -u

# The commands run under the caller's LC_ALL, not the script's.
lc_set=${LC_ALL+x}
lc_val=${LC_ALL-}
LC_ALL=C
export LC_ALL
GIT_OPTIONAL_LOCKS=0
GIT_NO_LAZY_FETCH=1
export GIT_OPTIONAL_LOCKS GIT_NO_LAZY_FETCH
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

tab=$(printf '\t')
cr=$(printf '\r')
soh=$(printf '\001')

die() {
	printf '%s\n' "revert-tests: $*" >&2
	exit 2
}

usage() {
	echo "usage: revert-tests.sh run|bg <repo> <base> <head> <keys file> <work dir> <result file>, or wait <result file>" >&2
	exit 2
}

# secs <name> <value>: die unless the value is whole seconds, 1 or more.
secs() {
	case $2 in
	'' | *[!0-9]* | 0*) die "$1 must be whole seconds, 1 or more" ;;
	esac
}

# forkdone <pid> <file> [<remove>]: after a job started under `set -m` with fd 2 on <file>.
# Bash's child prints `<name>: child setpgid (N to N): <error>` when its own setpgid call
# fails (see Portability); drop a line of that shape, pass on any other, then fail unless
# the job leads its own group, removing <remove> first when given. Builtins only until
# the check: a child forked here, right after the job's start under job control, can
# lose its record in bash (`wait_for: No record of process`), after which the run's
# work directory vanished mid-run on Linux. The caller removes <file> later.
forkdone() {
	while IFS= read -r fd_line || [ -n "$fd_line" ]; do
		case $fd_line in
		*': child setpgid ('[0-9]*' to '[0-9]*'): '*) ;;
		*) printf '%s\n' "$fd_line" >&2 ;;
		esac
	done < "$2"
	if ! kill -0 -"$1" 2> /dev/null && kill -0 "$1" 2> /dev/null; then
		kill -KILL "$1" 2> /dev/null
		wait "$1" 2> /dev/null
		[ -z "${3:-}" ] || rm -f "$3"
		die "cannot start a job in its own process group"
	fi
}

if [ "${1:-}" = bg ]; then
	[ $# -eq 7 ] || usage
	shift
	out=$6
	outdir=$(dirname "$out")
	[ -d "$outdir" ] || die "no directory for the result file: $outdir"
	deadline=${REVERT_TESTS_DEADLINE:-3600}
	secs REVERT_TESTS_DEADLINE "$deadline"
	rm -f "$out.exit" "$out.exit.tmp"
	[ ! -e "$out.exit" ] || die "cannot remove $out.exit"
	true 2> /dev/null > "$out.fork" || die "cannot write $out.fork"
	true 2> /dev/null > "$out.err" || die "cannot write $out.err"
	child=
	trap 'if [ -n "$child" ]; then kill -TERM -"$child" 2> /dev/null; fi; exit 2' HUP INT TERM
	# Its own process group, so TERM also reaches a foreground git step, which would
	# otherwise hold off `run`'s trap until it returns. The group's leader outlives a KILL
	# of `bg` (an agent's harness ends a session's shells so), so it ends the run itself.
	bgpid=$$
	set -m
	{ (
		termed=
		trap 'termed=1' TERM
		bash "$0" run "$@" &
		r=$!
		n=0
		while kill -0 "$r" 2> /dev/null; do
			if ! kill -0 "$bgpid" 2> /dev/null; then
				if [ "$n" -eq 0 ] && [ -z "$termed" ]; then
					kill -TERM 0 2> /dev/null
				elif [ "$n" -ge 60 ]; then
					kill -KILL 0 2> /dev/null
				fi
				n=$((n + 1))
			fi
			sleep 1
		done
		wait "$r"
	) > "$out.err" 2>&1 < /dev/null & } 2> "$out.fork"
	child=$!
	set +m
	# Without `.err`, `wait` reports no run started rather than still running.
	forkdone "$child" "$out.fork" "$out.err"
	(
		n=0
		fired=
		while kill -0 "$child" 2> /dev/null; do
			if [ "$n" -eq "$deadline" ]; then
				kill -TERM -"$child" 2> /dev/null
				fired=1
			elif [ "$n" -ge $((deadline + 60)) ]; then
				kill -KILL -"$child" 2> /dev/null
				break
			fi
			sleep 1
			n=$((n + 1))
		done
		[ -z "$fired" ] || exit 3
	) &
	dog=$!
	wait "$child"
	st=$?
	wait "$dog"
	if [ $? -eq 3 ]; then
		echo "revert-tests: stopped at the deadline of $deadline seconds" >> "$out.err"
	fi
	rm -f "$out.fork"
	if ! { printf '%s\n' "$st" > "$out.exit.tmp" && mv -f "$out.exit.tmp" "$out.exit"; }; then
		rm -f "$out.exit.tmp"
		die "cannot write $out.exit"
	fi
	exit 0
fi

if [ "${1:-}" = wait ]; then
	[ $# -eq 2 ] || usage
	out=$2
	win=${REVERT_TESTS_WAIT:-540}
	secs REVERT_TESTS_WAIT "$win"
	grace=30
	if [ "$win" -lt "$grace" ]; then
		grace=$win
	fi
	n=0
	while :; do
		if [ -f "$out.exit" ]; then
			st=$(cat "$out.exit")
			case $st in
			'' | *[!0-9]*) die "not a status in $out.exit" ;;
			esac
			line=$(awk 'NF { l = $0 } END { print l }' "$out.err" 2> /dev/null)
			if [ -n "$line" ]; then
				printf '%s
' "$line" >&2
			elif [ "$st" != 0 ]; then
				echo "revert-tests: the run ended with status $st" >&2
			fi
			rm -f "$out.exit" "$out.err"
			[ "$st" = 0 ] && exit 0
			exit 2
		fi
		if [ "$n" -ge "$grace" ] && [ ! -e "$out.err" ]; then
			die "no run started for $out"
		fi
		if [ "$n" -ge "$win" ]; then
			echo "revert-tests: still running" >&2
			exit 3
		fi
		sleep 2
		n=$((n + 2))
	done
fi

[ $# -eq 7 ] && [ "$1" = run ] || usage
repo=$2
base=$3
head=$4
keys=$5
work=$6
out=$7

[ -f "$keys" ] || die "no keys file: $keys"
if [ -e "$work" ] || [ -L "$work" ]; then
	die "work dir exists: $work"
fi
outdir=$(dirname "$out")
[ -d "$outdir" ] || die "no directory for the result file: $outdir"

made=
live=
wdog=
renamed=
# stopdog: end the watchdog. KILL, not TERM: the watchdog is forked holding the TERM trap
# below, and bash 3.2 prints `run_pending_traps: bad value in trap_list[15]` on stderr
# when a TERM lands before the child has reset it.
stopdog() {
	kill -KILL "$wdog" 2> /dev/null
}
cleanup() {
	# A signal during the cleanup must not cut it short.
	trap '' HUP INT TERM
	if [ -n "$wdog" ]; then
		stopdog
	fi
	if [ -n "$live" ]; then
		kill -KILL -"$live" 2> /dev/null
		cn=0
		while kill -0 -"$live" 2> /dev/null && [ "$cn" -lt 10 ]; do
			sleep 1
			cn=$((cn + 1))
		done
	fi
	if [ -n "$made" ]; then
		chmod -R u+w "$work" 2> /dev/null
		rm -rf "$work"
	fi
	if [ -z "$renamed" ]; then
		rm -f "$out.tmp"
	fi
}
trap cleanup EXIT
trap 'trap "" HUP INT TERM; exit 2' HUP INT TERM

mkdir -p "$work" || die "cannot create the work dir: $work"
made=1
w=$work/.state
mkdir "$w" || die "cannot create a directory in $work"

g() {
	git -c core.quotePath=false -C "$repo" "$@" < /dev/null
}

# Keys.
command=
setup=
timeout=
has_command=
has_setup=
: > "$w/run.pat"
: > "$w/path.pat"
while IFS= read -r line || [ -n "$line" ]; do
	line=${line%"$cr"}
	[ -n "$line" ] || continue
	key=${line%%"$tab"*}
	[ "$key" != "$line" ] || die "keys: a line without a tab"
	val=${line#*"$tab"}
	[ -n "$val" ] || die "keys: an empty value for $key"
	case $key in
	command)
		[ -z "$has_command" ] || die "keys: command given twice"
		command=$val
		has_command=1
		;;
	setup)
		[ -z "$has_setup" ] || die "keys: setup given twice"
		setup=$val
		has_setup=1
		;;
	timeout)
		[ -z "$timeout" ] || die "keys: timeout given twice"
		case $val in
		*[!0-9]* | 0*) die "keys: timeout must be whole seconds, 1 or more" ;;
		esac
		timeout=$val
		;;
	run) printf '%s\n' "$val" >> "$w/run.pat" || die "cannot write in $work" ;;
	path) printf '%s\n' "$val" >> "$w/path.pat" || die "cannot write in $work" ;;
	*) die "keys: unknown key $key" ;;
	esac
done < "$keys"
[ -n "$has_command" ] || die "keys: no command"
[ -s "$w/run.pat" ] || die "keys: no run pattern"
timeout=${timeout:-300}
cap=${REVERT_TESTS_CAP:-1800}
secs REVERT_TESTS_CAP "$cap"
paths_default=
if [ ! -s "$w/path.pat" ]; then
	paths_default=1
	printf '%s\n' '**/test/**' '**/tests/**' '**/__tests__/**' '**/*_test.*' '**/test_*.*' \
		'**/*.test.*' '**/*.spec.*' '**/*Tests/**' '**/*Test.*' '**/*Tests.*' > "$w/path.pat" ||
		die "cannot write in $work"
fi

if g config --get-regexp '^(remote\..*\.promisor|extensions\.partialclone)$' > /dev/null; then
	die "partial clones are not supported"
fi

# Shas.
head_sha=$(g rev-parse --verify --quiet "$head^{commit}") || die "not a commit: $head"
base_sha=$(g rev-parse --verify --quiet "$base^{commit}") || die "not a commit: $base"
mb=$(g merge-base "$base_sha" "$head_sha") || die "no merge-base of $base and $head"

# nulines: NUL-separated input to one item per line; a newline inside an item becomes
# \001, so such an item is still one line and can be told apart.
nulines() {
	tr '\n\000' '\001\n'
}

# changed <pattern file> <magic> [<diff filter>]: `<status><TAB><path>` per changed path
# that matches a pattern (magic `glob`) or matches none (magic `exclude,glob`).
changed() {
	ch_file=$1
	ch_magic=$2
	ch_filter=${3:-}
	set --
	while IFS= read -r ch_p; do
		set -- "$@" ":($ch_magic)$ch_p"
	done < "$ch_file"
	if [ "$ch_magic" = exclude,glob ]; then
		set -- . "$@"
	fi
	if [ -n "$ch_filter" ]; then
		g diff-tree -r --no-renames -z --name-status "--diff-filter=$ch_filter" "$mb" "$head_sha" -- "$@"
	else
		g diff-tree -r --no-renames -z --name-status "$mb" "$head_sha" -- "$@"
	fi
}

# pairs: the NUL-separated `status, path` stream of `changed` to one line per path.
pairs() {
	nulines | awk 'NR % 2 == 1 { s = $0; next } { print s "\t" $0 }'
}

changed "$w/path.pat" glob > "$w/tc.raw" || die "git diff-tree failed"
pairs < "$w/tc.raw" > "$w/tc" || die "cannot list the test code"
changed "$w/run.pat" glob AMT > "$w/rn.raw" || die "git diff-tree failed"
pairs < "$w/rn.raw" > "$w/rn" || die "cannot list the run patterns"
changed "$w/path.pat" exclude,glob > "$w/out.raw" || die "git diff-tree failed"
pairs < "$w/out.raw" > "$w/outside" || die "cannot list the other paths"

# Test-code paths, without the status: the files to run (at the head, matching `run`), the
# rest present at the head, and those deleted at the head. A path holding a newline or tab goes
# to the unwritable list.
awk -F '\t' -v soh="$soh" -v rn="$w/rn" -v run="$w/torun.all" -v keep="$w/kept" \
	-v del="$w/deleted" -v nl="$w/tc.nl" '
	BEGIN {
		while ((getline l < rn) > 0) {
			t = index(l, "\t")
			r[substr(l, t + 1)] = 1
		}
	}
	{
		t = index($0, "\t")
		s = substr($0, 1, t - 1)
		p = substr($0, t + 1)
		if (index(p, soh) > 0 || index(p, "\t") > 0) { print p > nl; next }
		if (s == "D") print p > del
		else if (p in r) print p > run
		else print p > keep
	}' "$w/tc" || die "awk failed"
for f in torun.all kept deleted tc.nl; do
	if [ -f "$w/$f" ]; then
		sort -o "$w/$f" "$w/$f" || die "cannot sort $f"
	else
		: > "$w/$f"
	fi
done
head -n 20 "$w/torun.all" > "$w/torun" || die "cannot list the files to run"
tail -n +21 "$w/torun.all" > "$w/capped" || die "cannot list the files to run"

# Result parts, assembled at the end.
: > "$w/verdicts"
: > "$w/setup.md"
: > "$w/runs.md"
: > "$w/special.md"
reason_all=

# verdict <path> <text>
verdict() {
	printf '%s\t%s\n' "$1" "$2" >> "$w/verdicts" || die "cannot write in $work"
}

# sizeof <sha>: the sum of the tree's blob sizes, in bytes.
sizeof() {
	g ls-tree -r -l --full-tree "$1" > "$w/size.raw" || die "git ls-tree failed"
	awk '$2 == "blob" { s += $4 } END { printf "%.0f\n", s }' "$w/size.raw"
}

# entries <sha> <out> <skipped>: the tree's entries, `<mode> <type> <oid> <size><TAB><path>`,
# one per line, without the paths step 3 does not write (those go to <skipped>). A path
# with a tab is not written either, since `read` would trim it.
entries() {
	g ls-tree -r -l -z --full-tree "$1" > "$w/ls.raw" || die "git ls-tree failed"
	nulines < "$w/ls.raw" | awk -v soh="$soh" -v skip="$3" '
		{
			t = index($0, "\t")
			p = substr($0, t + 1)
			bad = (index(p, soh) > 0 || index(p, "\t") > 0)
			n = split(p, c, "/")
			for (i = 1; i <= n; i++)
				if (c[i] == "" || c[i] == "." || c[i] == ".." || tolower(c[i]) == ".git")
					bad = 1
			if (bad) {
				gsub(soh, "\\n", p)
				print p > skip
				next
			}
			print
		}' > "$2" || die "awk failed"
	[ -f "$3" ] || : > "$3"
}

if head --version 2> /dev/null | grep -q 'GNU coreutils'; then
	gnu_head=1
else
	gnu_head=
fi

# write_batch <dest>: write each blob of $w/blobs from the `cat-file --batch` stream on
# stdin. GNU `head -c` reads no more than it copies, so the stream stays in step.
write_batch() {
	while IFS="$tab" read -r wb_mode wb_oid wb_size wb_path <&3; do
		IFS=' ' read -r wb_got wb_type wb_len || return 1
		[ "$wb_got" = "$wb_oid" ] && [ "$wb_type" = blob ] || return 1
		wb_f=$1/$wb_path
		wb_d=${wb_f%/*}
		[ -d "$wb_d" ] || mkdir -p "$wb_d" || return 1
		head -c "$wb_len" > "$wb_f" || return 1
		IFS= read -r wb_nl
	done 3< "$w/blobs"
}

# write_each <dest>: the same, one `cat-file blob` per blob, where `head -c` may read
# ahead.
write_each() {
	while IFS="$tab" read -r we_mode we_oid we_size we_path; do
		we_f=$1/$we_path
		we_d=${we_f%/*}
		[ -d "$we_d" ] || mkdir -p "$we_d" || return 1
		git -C "$repo" cat-file blob "$we_oid" > "$we_f" < /dev/null || return 1
	done < "$w/blobs"
}

# listed <file> <what>: a count line, then at most 50 lines of <file>, as markdown.
listed() {
	ls_n=$(wc -l < "$1" | tr -d ' ')
	if [ "$ls_n" -eq 0 ]; then
		printf -- '- %s: none\n' "$2"
		return
	fi
	printf -- '- %s: %s\n' "$2" "$ls_n"
	head -n 50 "$1" | awk '{ print "  - `" $0 "`" }'
	if [ "$ls_n" -gt 50 ]; then
		printf '  - and %s more\n' "$((ls_n - 50))"
	fi
}

# export_list <entries> <dest> <label> <skipped> <tree>: write every blob entry under <dest>, as
# stage 1 step 6 exports a tree, and describe the copy in special.md.
export_list() {
	el_dest=$2
	mkdir -p "$el_dest" || die "cannot create $el_dest"
	awk '{ t = index($0, "\t"); split(substr($0, 1, t - 1), m, " ");
		if (m[2] == "blob") print m[1] "\t" m[3] "\t" m[4] "\t" substr($0, t + 1) }' "$1" > "$w/blobs" ||
		die "awk failed"
	awk '{ t = index($0, "\t"); split(substr($0, 1, t - 1), m, " ");
		if (m[1] == "160000") print substr($0, t + 1) " at " m[3] }' "$1" > "$w/subs" ||
		die "awk failed"
	if [ -n "$gnu_head" ]; then
		cut -f 2 "$w/blobs" > "$w/oids" || die "cannot list the blobs"
		git -c core.quotePath=false -C "$repo" cat-file --batch < "$w/oids" | write_batch "$el_dest" ||
			die "cannot export $3 to $el_dest"
	else
		write_each "$el_dest" || die "cannot export $3 to $el_dest"
	fi
	: > "$w/links"
	: > "$w/lfs"
	while IFS="$tab" read -r el_mode el_oid el_size el_path; do
		el_f=$el_dest/$el_path
		case $el_mode in
		100755) chmod +x "$el_f" || die "cannot chmod $el_f" ;;
		120000) printf '%s -> %s\n' "$el_path" "$(cat "$el_f")" >> "$w/links" ;;
		esac
		if [ "$el_size" -ge 42 ] && [ "$el_size" -lt 1024 ]; then
			IFS= read -r el_first < "$el_f"
			if [ "$el_first" = 'version https://git-lfs.github.com/spec/v1' ]; then
				printf '%s\n' "$el_path" >> "$w/lfs"
			fi
		fi
	done < "$w/blobs"
	{
		printf '\n### The %s copy\n\n' "$3"
		listed "$w/links" "symlinks, written as a file holding the target"
		listed "$w/subs" "submodules, not written"
		listed "$w/lfs" "Git LFS pointers, written as the pointer file"
		listed "$4" "paths of the $5 tree not written (a newline or tab, or an empty, ., .., or .git part)"
	} >> "$w/special.md" || die "cannot write in $work"
}

# watchdog <pgid> <deadline>: at the deadline, TERM the group, then KILL it 10 seconds
# later.
watchdog() {
	# bash's own clock: a `date` child here can die of a broken pipe when the job ends
	# at once and the watchdog is killed before its first read.
	wd_start=$SECONDS
	while :; do
		sleep 1
		[ $((SECONDS - wd_start)) -lt "$2" ] || break
	done
	: > "$w/timedout"
	kill -TERM -"$1" 2> /dev/null
	sleep 10
	kill -KILL -"$1" 2> /dev/null
}

# gone <pgid>: wait until no process is left in the group, at most 10 seconds.
gone() {
	gn=0
	while kill -0 -"$1" 2> /dev/null; do
		[ "$gn" -lt 10 ] || return 1
		kill -KILL -"$1" 2> /dev/null
		sleep 1
		gn=$((gn + 1))
	done
}

start=
# runone <copy> <log> <setup | test> [<path>]: run one command in a copy. Sets rc (its
# exit status), to (1 when it timed out), secs (its duration), and capped (1 when no time
# was left, and then nothing ran).
runone() {
	ro_now=$(date +%s)
	[ -n "$start" ] || start=$ro_now
	ro_left=$((cap - (ro_now - start)))
	rc=
	to=
	secs=
	capped=
	if [ "$ro_left" -le 0 ]; then
		capped=1
		return
	fi
	ro_dl=$timeout
	[ "$ro_left" -ge "$ro_dl" ] || ro_dl=$ro_left
	ro_name=${1##*/}
	ro_tmp=$work/tmp/$ro_name
	ro_cache=$work/cache/$ro_name
	mkdir -p "$ro_tmp" "$ro_cache" || die "cannot create a directory in $work"
	rm -f "$w/timedout"
	true 2> /dev/null > "$w/fork" || die "cannot write $w/fork"
	set -m
	{ (
		cd "$1" || exit 125
		for ro_v in $(env | sed -n 's/^\(GIT_[A-Za-z0-9_]*\)=.*/\1/p'); do
			unset "$ro_v"
		done
		if [ -n "$lc_set" ]; then
			LC_ALL=$lc_val
			export LC_ALL
		else
			unset LC_ALL
		fi
		TMPDIR=$ro_tmp
		TMP=$ro_tmp
		TEMP=$ro_tmp
		XDG_CACHE_HOME=$ro_cache
		GIT_CEILING_DIRECTORIES=$work
		export TMPDIR TMP TEMP XDG_CACHE_HOME GIT_CEILING_DIRECTORIES
		if [ "$3" = setup ]; then
			exec sh -c "$setup"
		fi
		exec sh -c "$command \"\$1\"" sh "$4"
	) > "$2" 2>&1 < /dev/null & } 2> "$w/fork"
	ro_pg=$!
	set +m
	forkdone "$ro_pg" "$w/fork"
	live=$ro_pg
	watchdog "$ro_pg" "$ro_dl" &
	wdog=$!
	# Under job control bash reports a job killed by a signal on stderr; the result file
	# records the status instead.
	{
		wait "$ro_pg"
		rc=$?
	} 2> /dev/null
	stopdog
	wait "$wdog" 2> /dev/null
	wdog=
	kill -KILL -"$ro_pg" 2> /dev/null
	gone "$ro_pg" || die "process group $ro_pg still live 10 seconds after KILL"
	live=
	secs=$(($(date +%s) - ro_now))
	if [ -f "$w/timedout" ]; then
		to=1
	fi
}

# record <title> <log>: one run's block in runs.md or setup.md, from rc, to, and secs.
record() {
	if [ -n "$to" ]; then
		rd_status="timed out after $secs seconds (exit status $rc)"
	else
		rd_status=$rc
	fi
	printf '\n### %s\n\n- Exit status: %s\n- Duration in seconds: %s\n' "$1" "$rd_status" "$secs"
	rd_n=$(wc -l < "$2" | tr -d ' ')
	if [ ! -s "$2" ]; then
		printf -- '- Output: none\n'
		return
	fi
	if [ "$rd_n" -gt 80 ]; then
		printf -- '- Output, the last 80 of %s lines:\n\n' "$rd_n"
	else
		printf -- '- Output:\n\n'
	fi
	tail -n 80 "$2" | tr -d '\000\r' |
		awk '{ if (length($0) > 400) $0 = substr($0, 1, 400) " [cut]"; print "    " $0 }'
}

# Test-code paths, without the status, for the reverted copy.
awk -v soh="$soh" '{ t = index($0, "\t"); p = substr($0, t + 1);
	if (index(p, soh) == 0) print p }' "$w/tc" > "$w/tcpaths" || die "awk failed"

reason=
if [ -s "$w/torun" ]; then
	hs=$(sizeof "$head_sha") || exit 2
	ms=$(sizeof "$mb") || exit 2
	if [ "$hs" -gt 1073741824 ] || [ "$ms" -gt 1073741824 ]; then
		reason="tree over 1 GB"
	fi
fi
if [ -s "$w/torun" ] && [ -z "$reason" ]; then
	entries "$head_sha" "$w/e.head" "$w/skip.head"
	entries "$mb" "$w/e.mb" "$w/skip.mb"
	# The reverted copy: the merge-base entries outside the test code, then the head's
	# test-code entries.
	awk -v tcf="$w/tcpaths" '
		BEGIN { while ((getline l < tcf) > 0) tc[l] = 1 }
		{ t = index($0, "\t"); p = substr($0, t + 1) }
		FILENAME == ARGV[1] && !(p in tc) { print }
		FILENAME == ARGV[2] && (p in tc) { print }' "$w/e.mb" "$w/e.head" > "$w/e.rev" ||
		die "awk failed"
	# The first path with a leading part that is itself an entry: a file where a
	# directory must be.
	conflict=$(awk '
		{ t = index($0, "\t"); p = substr($0, t + 1); have[p] = 1; all[++n] = p }
		END {
			for (i = 1; i <= n; i++) {
				k = split(all[i], c, "/")
				pre = c[1]
				for (j = 1; j < k; j++) {
					if (pre in have) { print "`" pre "` and `" all[i] "`"; exit }
					pre = pre "/" c[j + 1]
				}
			}
		}' "$w/e.rev") || die "awk failed"
	if [ -n "$conflict" ]; then
		reason="path conflict, $conflict"
	fi
fi

# Runs.
: > "$w/passed"
if [ -s "$w/torun" ] && [ -n "$reason" ]; then
	while IFS= read -r p; do
		verdict "$p" "not run: $reason"
	done < "$w/torun"
elif [ -s "$w/torun" ]; then
	export_list "$w/e.head" "$work/head" head "$w/skip.head" head
	head_setup=ok
	if [ -n "$has_setup" ]; then
		runone "$work/head" "$w/setup.head.log" setup
		if [ -n "$capped" ]; then
			head_setup=cap
		else
			record "Setup, head copy" "$w/setup.head.log" >> "$w/setup.md" || die "cannot write in $work"
			[ -z "$to" ] && [ "$rc" -eq 0 ] || head_setup=failed
		fi
	fi
	i=0
	while IFS= read -r p <&4; do
		i=$((i + 1))
		case $head_setup in
		failed)
			verdict "$p" "not run: setup failed in the head copy"
			continue
			;;
		cap)
			verdict "$p" "not run: time cap"
			continue
			;;
		esac
		runone "$work/head" "$w/run.head.$i.log" test "$p"
		if [ -n "$capped" ]; then
			verdict "$p" "not run: time cap"
			continue
		fi
		record "\`$p\`, head copy" "$w/run.head.$i.log" >> "$w/runs.md" || die "cannot write in $work"
		if [ -n "$to" ]; then
			verdict "$p" "does not pass at head (timed out)"
		elif [ "$rc" -ne 0 ]; then
			verdict "$p" "does not pass at head (exit status $rc)"
		else
			printf '%s\t%s\n' "$i" "$p" >> "$w/passed" || die "cannot write in $work"
		fi
	done 4< "$w/torun"
	if [ -s "$w/passed" ]; then
		export_list "$w/e.rev" "$work/reverted" reverted "$w/skip.mb" merge-base
		rev_setup=ok
		if [ -n "$has_setup" ]; then
			runone "$work/reverted" "$w/setup.rev.log" setup
			if [ -n "$capped" ]; then
				rev_setup=cap
			else
				record "Setup, reverted copy" "$w/setup.rev.log" >> "$w/setup.md" ||
					die "cannot write in $work"
				[ -z "$to" ] && [ "$rc" -eq 0 ] || rev_setup=failed
			fi
		fi
		while IFS="$tab" read -r i p <&4; do
			case $rev_setup in
			failed)
				verdict "$p" "not run: setup failed in the reverted copy"
				continue
				;;
			cap)
				verdict "$p" "not run: time cap"
				continue
				;;
			esac
			runone "$work/reverted" "$w/run.rev.$i.log" test "$p"
			if [ -n "$capped" ]; then
				verdict "$p" "not run: time cap"
				continue
			fi
			record "\`$p\`, reverted copy" "$w/run.rev.$i.log" >> "$w/runs.md" ||
				die "cannot write in $work"
			if [ -n "$to" ]; then
				verdict "$p" "not run: timed out in the reverted copy"
			elif [ "$rc" -eq 0 ]; then
				verdict "$p" "passes at head and without the change"
			else
				verdict "$p" "passes at head only"
			fi
		done 4< "$w/passed"
	else
		printf '\n### The reverted copy\n\nNot written: no file passed at the head.\n' >> "$w/special.md" ||
			die "cannot write in $work"
	fi
fi
while IFS= read -r p; do
	verdict "$p" "not run: file cap"
done < "$w/capped"

# count <verdict>: how many files have it; `not run` and `does not pass at head` count
# every reason.
count() {
	awk -v v="$1" '{ t = index($0, "\t"); s = substr($0, t + 1) }
		v == "not run" || v == "does not pass at head" { if (index(s, v) == 1) n++; next }
		s == v { n++ }
		END { print n + 0 }' "$w/verdicts"
}

# patterns <file>: the patterns on one line, in backticks.
patterns() {
	awk 'BEGIN { ORS = "" } { print (NR > 1 ? ", " : "") "`" $0 "`" } END { print "\n" }' "$1"
}

q="'"
{
	printf '# Changed tests run with the change reverted\n\n'
	printf -- '- Repo: `%s`\n' "$repo"
	printf -- '- Head: `%s`; merge-base: `%s`\n' "$head_sha" "$mb"
	printf -- '- test_command: `%s`, run per file as `sh -c %s<test_command> "$1"%s sh <path>`\n' \
		"$command" "$q" "$q"
	printf -- '- test_run: '
	patterns "$w/run.pat"
	if [ -n "$paths_default" ]; then
		printf -- '- test_paths (the default): '
	else
		printf -- '- test_paths: '
	fi
	patterns "$w/path.pat"
	if [ -n "$has_setup" ]; then
		printf -- '- test_setup: `%s`\n' "$setup"
	else
		printf -- '- test_setup: none, so a copy holds tracked files only\n'
	fi
	printf -- '- test_timeout: %s seconds per command; the bundle%ss cap is %s seconds from its first command\n' \
		"$timeout" "$q" "$cap"
	printf '\n## Verdicts\n\n'
	if [ ! -s "$w/verdicts" ]; then
		printf 'No changed tests to run.\n'
	else
		printf 'passes at head and without the change: %s; passes at head only: %s; does not pass at head: %s; not run: %s.\n\n' \
			"$(count 'passes at head and without the change')" "$(count 'passes at head only')" \
			"$(count 'does not pass at head')" "$(count 'not run')"
		awk 'FILENAME == ARGV[1] { t = index($0, "\t"); v[substr($0, 1, t - 1)] = substr($0, t + 1); next }
			{ print "- `" $0 "`: " v[$0] }' "$w/verdicts" "$w/torun.all"
	fi
	printf '\n## Paths\n\n'
	printf 'The reverted copy is the merge-base tree with each changed path under test_paths at its head state. A path under test_paths is test code whole, so production code in it keeps its head state there. A changed file outside test_paths stays at the merge-base, so tests inside it are not measured.\n\n'
	listed "$w/torun.all" "files to run"
	listed "$w/kept" "changed test-code paths not run, kept at their head state in the reverted copy"
	listed "$w/deleted" "test-code paths deleted at the head"
	cut -f 2- "$w/outside" | sort > "$w/outside.paths"
	listed "$w/outside.paths" "changed paths outside test_paths"
	awk -v soh="$soh" '{ gsub(soh, "\\n"); print }' "$w/tc.nl" > "$w/tc.nl.shown"
	listed "$w/tc.nl.shown" "test-code paths with a newline, not used"
	if [ -s "$w/special.md" ]; then
		printf '\n## Copies\n'
		cat "$w/special.md"
	fi
	if [ -s "$w/setup.md" ]; then
		printf '\n## Setup\n'
		cat "$w/setup.md"
	fi
	if [ -s "$w/runs.md" ]; then
		printf '\n## Runs\n'
		cat "$w/runs.md"
	fi
} > "$out.tmp" || die "cannot write $out.tmp"
mv -f "$out.tmp" "$out" || die "cannot rename $out.tmp"
renamed=1
exit 0
