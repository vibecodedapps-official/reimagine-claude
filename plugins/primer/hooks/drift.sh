#!/bin/sh
# drift.sh: PreToolUse hook for Bash and PowerShell calls. Reads the tool call from stdin
# and acts only when it runs `git commit`. Reads stdin, the hub (CLAUDE.md, or AGENTS.md
# behind the adapter, or AGENTS.md alone) and, only when its first line is <!-- primer -->,
# the tracked nested CLAUDE.md files, rules and skills, `git ls-files` for their globs and the
# changed file list; never reads git history and never writes a file. Prints at most one JSON
# object and always exits 0:
#   deny:    a file is over its line cap, the hub names a missing path, a paths value cannot
#            be read or matches no tracked file, or a skill has no description
#   advise:  additionalContext names rules, skills and nested files that cover changed
#            paths and are not changed
#   nothing: not a commit, no opted-in hub, or no finding

json=
while IFS= read -r in_line || [ -n "$in_line" ]; do
	json=$json$in_line
done
case $json in
*commit*) ;;
*) exit 0 ;;
esac

TAB=$(printf '\t')
NL='
'

raw=$(printf '%s\n' "$json" | LC_ALL=C sed -n -E 's/^.*"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*$/\1/p')
[ -n "$raw" ] || exit 0

# PowerShell escapes with a backtick and never with a backslash.
ps=0
case $json in
*'"tool_name":"PowerShell"'* | *'"tool_name": "PowerShell"'*) ps=1 ;;
esac

# One line "D<dir>" per distinct directory where the command runs git commit, then one line "A"
# when the command runs git add anywhere.
dirs=$(printf '%s\n' "$raw" | awk -v ps="$ps" '
BEGIN { SEP = "\001" }

function unescape(s,    i, n, c, d, out) {
	n = length(s)
	out = ""
	for (i = 1; i <= n; i++) {
		c = substr(s, i, 1)
		if (c != "\\" || i == n) { out = out c; continue }
		i++
		d = substr(s, i, 1)
		if (d == "\"") out = out "\""
		else if (d == "\\") out = out "\\"
		else if (d == "/") out = out "/"
		else if (d == "n") out = out "\n"
		else if (d == "t" || d == "r" || d == "b" || d == "f") out = out " "
		else if (d == "u") { out = out substr(s, i - 1, 6); i += 4 }
		else out = out "\\" d
	}
	return out
}

function joindir(a, d) {
	if (d == "") return a
	if (substr(d, 1, 1) == "/" || substr(d, 1, 1) == "\\" || substr(d, 2, 1) == ":") return d
	if (a == "") return d
	return a "/" d
}

function record(dir) {
	if (!(dir in seen)) { seen[dir] = 1; print "D" dir }
}

# The lowercased part of a word after its last / or \.
function basename(w,    k, ch) {
	for (k = length(w); k >= 1; k--) {
		ch = substr(w, k, 1)
		if (ch == "/" || ch == "\\") break
	}
	return tolower(substr(w, k + 1))
}

# str holds nw words, each followed by SEP.
function analyze(str, nw,    a, i, j, k, w, t, cmd, base, dir, edir, hasc) {
	split(str, a, SEP)
	i = 1
	edir = ""
	while (i <= nw) {
		w = a[i]
		if (w ~ /^[A-Za-z_][A-Za-z0-9_]*=/) { i++; continue }
		base = basename(w)
		if (index(" if then else elif do while until ! time command exec nohup ", " " base " ")) { i++; continue }
		if (base == "env" || base == "sudo") {
			i++
			while (i <= nw && substr(a[i], 1, 1) == "-") {
				t = a[i]
				i++
				if (base == "env") {
					if (t == "-u" || t == "-S") i++
					else if (t == "-C") { edir = joindir(edir, a[i]); i++ }
					else if (substr(t, 1, 8) == "--chdir=") edir = joindir(edir, substr(t, 9))
				}
				else if (length(t) == 2 && index("ugUCDhprtT", substr(t, 2, 1))) i++
			}
			continue
		}
		break
	}
	if (i > nw) return
	cmd = a[i]
	base = basename(cmd)
	if (base == "sh" || base == "bash" || base == "dash" || base == "zsh" || base == "sh.exe" || base == "bash.exe") {
		hasc = 0
		for (j = i + 1; j <= nw && (substr(a[j], 1, 1) == "-" || substr(a[j], 1, 1) == "+"); j++) {
			if (a[j] == "-o" || a[j] == "+o") j++
			else if (a[j] ~ /^-[A-Za-z]*c[A-Za-z]*$/) hasc = 1
		}
		if (hasc && j <= nw) split_commands(a[j])
		return
	}
	if (base == "git" || base == "git.exe") {
		dir = edir
		j = i + 1
		while (j <= nw && substr(a[j], 1, 1) == "-") {
			t = a[j]
			if (t == "-C" || t == "--work-tree") { dir = joindir(dir, a[j + 1]); j += 2 }
			else if (substr(t, 1, 12) == "--work-tree=") { dir = joindir(dir, substr(t, 13)); j++ }
			else if (t == "-c" || t == "--git-dir" || t == "--namespace" || t == "--config-env") j += 2
			else j++
		}
		if (j <= nw && a[j] == "add") adds = 1
		if (j <= nw && a[j] == "commit") {
			for (k = j + 1; k <= nw; k++)
				if (a[k] == "--dry-run" || a[k] == "--help" || a[k] == "-h") return
			record(dir)
		}
	}
}

function split_commands(s,    i, n, c, e, st, cur, inw, cmd, nw, dq) {
	n = length(s)
	st = 0; cur = ""; inw = 0; cmd = ""; nw = 0; dq = ""
	for (i = 1; i <= n; i++) {
		c = substr(s, i, 1)
		if (st == 1) {
			if (c == "\047") st = 0
			else cur = cur c
			continue
		}
		if (st == 2) {
			e = substr(s, i + 1, 1)
			if (ps == 1 && c == "`") { if (i < n) { cur = cur e; dq = dq e; i++ } }
			else if (ps != 1 && c == "\\" && (e == "\"" || e == "\\")) { cur = cur e; dq = dq e; i++ }
			else if (c == "\"") {
				st = 0
				if (index(dq, "$(") || index(dq, "`")) split_commands(dq)
			}
			else { cur = cur c; dq = dq c }
			continue
		}
		if (c == "\047") { st = 1; inw = 1; continue }
		if (c == "\"") { st = 2; inw = 1; dq = ""; continue }
		if (ps == 1 && c == "`") {
			if (i < n) { i++; cur = cur substr(s, i, 1) }
			inw = 1
			continue
		}
		if (c == " " || c == "\t" || c == "\n" || index(";&|(){}`", c)) {
			if (inw) { cmd = cmd cur SEP; nw++; cur = ""; inw = 0 }
			if (c != " " && c != "\t" && nw > 0) { analyze(cmd, nw); cmd = ""; nw = 0 }
			continue
		}
		cur = cur c
		inw = 1
	}
	if (inw) { cmd = cmd cur SEP; nw++ }
	if (nw > 0) analyze(cmd, nw)
}

{ split_commands(unescape($0)) }
END { if (adds) print "A" }
')
[ -n "$dirs" ] || exit 0
hasadd=
case "$NL$dirs$NL" in
*"${NL}A${NL}"*) hasadd=1 ;;
esac

cwd=$(printf '%s\n' "$json" | LC_ALL=C sed -n -E 's/^.*"cwd"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*$/\1/p' | LC_ALL=C sed -e 's/\\\\/\\/g' -e 's/\\"/"/g')
if [ -z "$cwd" ] || [ ! -d "$cwd" ]; then
	cwd=.
fi

findings=
recheck=

addf() {
	findings="$findings$1$NL"
}

# Join stdin lines with $1, escaped for a JSON string.
jesc() {
	awk -v sep="$1" '
	BEGIN {
		for (i = 1; i < 32; i++) cc[sprintf("%c", i)] = 1
		cc[sprintf("%c", 127)] = 1
	}
	{
		o = ""
		n = length($0)
		for (i = 1; i <= n; i++) {
			c = substr($0, i, 1)
			if (c == "\\") o = o "\\\\"
			else if (c == "\"") o = o "\\\""
			else if (c == "\t") o = o "\\t"
			else if (!(c in cc)) o = o c
		}
		out = out (NR > 1 ? sep : "") o
	}
	END { printf "%s", out }'
}

# exact <path>: true when every segment of <path> exists under $root with that spelling.
# `test -e` alone accepts another case on a case-insensitive filesystem, where a pointer
# written that way passes here and is a missing path on Linux.
exact() {
	ex_dir=$root
	ex_rest=$1
	while [ -n "$ex_rest" ]; do
		case $ex_rest in
		*/*) ex_seg=${ex_rest%%/*}; ex_rest=${ex_rest#*/} ;;
		*) ex_seg=$ex_rest; ex_rest= ;;
		esac
		[ -n "$ex_seg" ] || continue
		ex_hit=
		for ex_f in "$ex_dir"/* "$ex_dir"/.*; do
			if [ "${ex_f##*/}" = "$ex_seg" ] && [ -e "$ex_f" ]; then
				ex_hit=1
				break
			fi
		done
		[ -n "$ex_hit" ] || return 1
		ex_dir=$ex_dir/$ex_seg
	done
	return 0
}

# lines_over <file> <cap>: adds a finding when the file on disk has more than <cap> lines.
lines_over() {
	lo_n=$(awk 'END { print NR }' "$root/$1" 2>/dev/null)
	if [ "$lo_n" -gt "$2" ] 2>/dev/null; then
		addf "$1 has $lo_n lines, over its cap of $2"
	fi
}

# tracked <pathspec>: the tracked files of the pathspec in path order.
tracked() {
	git -C "$root" -c core.quotepath=off ls-files -- "$1" 2>/dev/null | LC_ALL=C sort
}

# glob_list <glob>: sets gl to the files one paths glob matches, one per line.
glob_list() {
	gl=
	gl_opt=--cached
	if [ -n "$hasadd" ]; then
		gl_opt="--cached --others --exclude-standard"
	fi
	# Prints each brace expansion of the glob, with **/ before a pattern that has no /.
	gl_pats=$(printf '%s\n' "$1" | awk '
	function emit(s) {
		if (!index(s, "/")) s = "**/" s
		print s
	}

	function expand(s,    i, j, k, n, d, c, has, start, pre, post) {
		n = length(s)
		for (i = 1; i <= n; i++) {
			if (substr(s, i, 1) != "{") continue
			d = 0
			has = 0
			for (j = i; j <= n; j++) {
				c = substr(s, j, 1)
				if (c == "{") d++
				else if (c == "}") { d--; if (d == 0) break }
				else if (c == "," && d == 1) has = 1
			}
			if (j > n || !has) continue
			pre = substr(s, 1, i - 1)
			post = substr(s, j + 1)
			d = 0
			start = i + 1
			for (k = i + 1; k <= j; k++) {
				c = substr(s, k, 1)
				if (k == j || (c == "," && d == 0)) {
					expand(pre substr(s, start, k - start) post)
					start = k + 1
				}
				else if (c == "{") d++
				else if (c == "}") d--
			}
			return
		}
		emit(s)
	}

	{ expand($0) }')
	while IFS= read -r gl_p; do
		[ -n "$gl_p" ] || continue
		gl_out=$(git -C "$root" -c core.quotepath=off ls-files $gl_opt -- ":(glob)$gl_p" 2>/dev/null)
		[ -z "$gl_out" ] || gl="$gl$gl_out$NL"
	done <<EOF
$gl_pats
EOF
}

# check_front <file> <skill>: reads the frontmatter of a rule or a skill, checks its paths
# value and globs and, when <skill> is not empty, its description.
check_front() {
	cf=$1
	cf_desc=
	# Prints U for a paths value that cannot be read, G<glob> for each glob, H for a description.
	cf_fm=$(awk '
	function trim(s) {
		sub(/^[ \t]+/, "", s)
		sub(/[ \t]+$/, "", s)
		return s
	}

	function additem(it,    f, n) {
		it = trim(it)
		f = substr(it, 1, 1)
		if (f == "\"" || f == "\047") {
			n = length(it)
			if (n < 2 || substr(it, n, 1) != f) return 0
			it = substr(it, 2, n - 2)
		}
		if (it != "") IT[++NI] = it
		return 1
	}

	# Splits at commas outside quotes and outside brace groups.
	function splitlist(s,    i, n, c, q, d, cur) {
		n = length(s)
		q = ""
		d = 0
		cur = ""
		for (i = 1; i <= n; i++) {
			c = substr(s, i, 1)
			if (q != "") { if (c == q) q = "" }
			else if (c == "\"" || c == "\047") q = c
			else if (c == "{") d++
			else if (c == "}") { if (d > 0) d-- }
			else if (c == "," && d == 0) {
				if (!additem(cur)) bad = 1
				cur = ""
				continue
			}
			cur = cur c
		}
		if (!additem(cur)) bad = 1
	}

	{ sub(/\r$/, ""); L[NR] = $0 }
	END {
		if (L[1] != "---") exit
		for (e = 2; e <= NR && L[e] != "---"; e++) ;
		if (e > NR) exit
		for (i = 2; i < e; i++) {
			if (!pk && substr(L[i], 1, 6) == "paths:") pk = i
			if (!dk && substr(L[i], 1, 12) == "description:") dk = i
		}
		if (pk) {
			v = trim(substr(L[pk], 7))
			if (v == "") {
				for (i = pk + 1; i < e && L[i] ~ /^[ \t]*- /; i++) {
					match(L[i], /^[ \t]*- /)
					if (!additem(substr(L[i], RLENGTH + 1))) bad = 1
				}
			}
			else if (substr(v, 1, 1) == "[") {
				n = length(v)
				if (substr(v, n, 1) != "]") bad = 1
				else splitlist(substr(v, 2, n - 2))
			}
			else {
				f = substr(v, 1, 1)
				if (f == "\"" || f == "\047") {
					n = length(v)
					if (n < 2 || substr(v, n, 1) != f) bad = 1
					else v = substr(v, 2, n - 2)
				}
				if (!bad) splitlist(v)
			}
			if (bad || NI == 0) print "U"
			else for (i = 1; i <= NI; i++) print "G" IT[i]
		}
		if (dk) {
			v = trim(substr(L[dk], 13))
			if (v != "" && v != "\"\"" && v != "\047\047") print "H"
			else if (v == "" && dk + 1 < e && L[dk + 1] ~ /^[ \t]/ && L[dk + 1] ~ /[^ \t]/) print "H"
		}
	}' "$root/$cf" 2>/dev/null)
	while IFS= read -r cf_rec; do
		case $cf_rec in
		U) addf "$cf has a paths value the host cannot read" ;;
		G*)
			cf_g=${cf_rec#G}
			havecov=1
			glob_list "$cf_g"
			if [ -z "$gl" ]; then
				addf "$cf paths glob $cf_g matches no tracked file"
			else
				cov="$cov$(printf '%s' "$gl" | CF=$cf awk 'NF { print ENVIRON["CF"] "\t" $0 }')$NL"
			fi
			;;
		H) cf_desc=1 ;;
		esac
	done <<EOF
$cf_fm
EOF
	if [ -n "$2" ] && [ -z "$cf_desc" ]; then
		addf "$cf has no description"
	fi
}

check_root() {
	root=$1
	if [ -f "$root/CLAUDE.md" ]; then
		hub=CLAUDE.md
		if awk '{ sub(/\r$/, ""); if (NR == 1) l = $0 } END { exit (NR == 1 && l == "@AGENTS.md") ? 0 : 1 }' "$root/CLAUDE.md" 2>/dev/null; then
			hub=AGENTS.md
			[ -f "$root/AGENTS.md" ] || return 0
		fi
	elif [ -f "$root/AGENTS.md" ]; then
		hub=AGENTS.md
	else
		return 0
	fi
	mark=$(awk 'NR == 1 { sub(/\r$/, ""); print; exit }' "$root/$hub" 2>/dev/null)
	[ "$mark" = "<!-- primer -->" ] || return 0

	cov=
	ncov=
	havecov=

	lines_over "$hub" 60
	# One backticked token per line from the opening paragraph that looks like a path.
	tokens=$(awk '
	{ sub(/\r$/, ""); L[NR] = $0 }
	END {
		h = 0
		for (i = 1; i <= NR; i++) if (substr(L[i], 1, 2) == "# ") { h = i; break }
		s = h ? h + 1 : 2
		p = ""
		for (i = s; i <= NR && substr(L[i], 1, 3) != "## "; i++) p = p (i > s ? " " : "") L[i]
		while ((a = index(p, "`")) > 0) {
			p = substr(p, a + 1)
			b = index(p, "`")
			if (b == 0) break
			t = substr(p, 1, b - 1)
			p = substr(p, b + 1)
			if (t == "" || (!index(t, "/") && t !~ /\.md$/)) continue
			if (index(t, " ") || index(t, "\t") || index(t, "<") || index(t, ">") || index(t, "*") || index(t, "{") || index(t, "?")) continue
			if (t in tk) continue
			tk[t] = 1
			print t
		}
	}' "$root/$hub" 2>/dev/null)
	while IFS= read -r tok; do
		[ -n "$tok" ] || continue
		exact "$tok" || addf "$hub names missing path $tok"
	done <<EOF
$tokens
EOF

	nested=$(tracked ':(glob)**/CLAUDE.md' | awk '$0 != "CLAUDE.md" && $0 != ".claude/CLAUDE.md"')
	while IFS= read -r f; do
		[ -n "$f" ] && [ -f "$root/$f" ] || continue
		lines_over "$f" 60
		ncov="$ncov$f$TAB${f%CLAUDE.md}$NL"
		havecov=1
	done <<EOF
$nested
EOF

	rules=$(tracked ':(glob).claude/rules/**/*.md')
	while IFS= read -r f; do
		[ -n "$f" ] && [ -f "$root/$f" ] || continue
		lines_over "$f" 200
		check_front "$f" ""
	done <<EOF
$rules
EOF

	skills=$(tracked ':(glob).claude/skills/*/SKILL.md')
	while IFS= read -r f; do
		[ -n "$f" ] && [ -f "$root/$f" ] || continue
		lines_over "$f" 150
		check_front "$f" 1
	done <<EOF
$skills
EOF

	[ -z "$findings" ] || return 0
	[ -n "$havecov" ] || return 0
	changed=$(git -C "$root" -c core.quotepath=off diff --cached --name-only 2>/dev/null)
	if git -C "$root" -c core.quotepath=off rev-parse --verify -q HEAD >/dev/null 2>&1; then
		changed="$changed$NL$(git -C "$root" -c core.quotepath=off diff HEAD --name-only 2>/dev/null)"
	fi
	if [ -n "$hasadd" ]; then
		changed="$changed$NL$(git -C "$root" -c core.quotepath=off ls-files --others --exclude-standard 2>/dev/null)"
	fi
	# cov holds "<rule or skill><TAB><covered file>" lines, ncov "<nested file><TAB><its directory/>" lines.
	list=$(printf '%s\n--\n%s\n--\n%s\n' "$cov" "$ncov" "$changed" | awk -F '\t' '
	$0 == "--" { sect++; next }
	sect == 0 { if ($1 != "") { np++; pn[np] = $1; pf[np] = $2 } next }
	sect == 1 { if ($1 != "") { nn++; nm[nn] = $1; nd[nn] = $2 } next }
	$0 == "" || ($0 in st) { next }
	{ st[$0] = 1; sl[++m] = $0 }
	END {
		for (i = 1; i <= np; i++) {
			if ((pn[i] in st) || (pn[i] in out) || !(pf[i] in st)) continue
			out[pn[i]] = 1
			print pn[i]
		}
		for (i = 1; i <= nn; i++) {
			if ((nm[i] in st) || (nm[i] in out)) continue
			for (q = 1; q <= m; q++)
				if (index(sl[q], nd[i]) == 1) { out[nm[i]] = 1; print nm[i]; break }
		}
	}')
	[ -z "$list" ] || recheck="$recheck$list$NL"
}

roots=$NL
while IFS= read -r line; do
	case $line in
	D*) ;;
	*) continue ;;
	esac
	dir=${line#D}
	case $dir in
	"~") dir=$HOME ;;
	"~/"*) dir=$HOME/${dir#"~/"} ;;
	esac
	root=$(git -C "$cwd" -C "$dir" rev-parse --show-toplevel 2>/dev/null) || root=
	if [ -z "$root" ] && [ -n "$dir" ]; then
		root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || root=
	fi
	[ -n "$root" ] || continue
	case $roots in
	*"$NL$root$NL"*) continue ;;
	esac
	roots="$roots$root$NL"
	check_root "$root"
done <<EOF
$dirs
EOF

if [ -n "$findings" ]; then
	msg=$(printf '%s' "$findings" | jesc '; ')
	printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"primer: %s"}}\n' "$msg"
elif [ -n "$recheck" ]; then
	msg=$(printf '%s' "$recheck" | LC_ALL=C sort -u | jesc ', ')
	printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"primer: the staged change touches files these cover; recheck them: %s"}}\n' "$msg"
fi
exit 0
