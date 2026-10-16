#!/bin/sh
# drift.sh: PreToolUse hook for Bash and PowerShell calls. Reads the tool call from stdin
# and acts only when it runs `git commit`. Reads stdin, the hub (CLAUDE.md, or AGENTS.md
# behind the adapter), the spokes it indexes and the staged file list; never reads git
# history and never writes a file. Prints at most one JSON object and always exits 0:
#   deny:    a pointer names a missing path, an index line is malformed, or the hub or a
#            spoke is over its line cap
#   advise:  additionalContext names spokes that cover staged paths and are not staged
#   nothing: not a commit, no hub, or no finding

json=$(awk '{ printf "%s", $0 }')
case $json in
*commit*) ;;
*) exit 0 ;;
esac

TAB=$(printf '\t')
NL='
'

raw=$(printf '%s\n' "$json" | sed -n -E 's/^.*"command"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*$/\1/p')
[ -n "$raw" ] || exit 0

# PowerShell escapes with a backtick and never with a backslash.
ps=0
case $json in
*'"tool_name":"PowerShell"'* | *'"tool_name": "PowerShell"'*) ps=1 ;;
esac

# One line "D<dir>" per distinct directory where the command runs git commit.
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
')
[ -n "$dirs" ] || exit 0

cwd=$(printf '%s\n' "$json" | sed -n -E 's/^.*"cwd"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*$/\1/p' | sed -e 's/\\\\/\\/g' -e 's/\\"/"/g')
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

check_root() {
	root=$1
	hub=CLAUDE.md
	[ -f "$root/CLAUDE.md" ] || return 0
	if awk '{ sub(/\r$/, ""); if (NR == 1) l = $0 } END { exit (NR == 1 && l == "@AGENTS.md") ? 0 : 1 }' "$root/CLAUDE.md" 2>/dev/null; then
		hub=AGENTS.md
		[ -f "$root/AGENTS.md" ] || return 0
	fi

	todo="$hub$NL"
	seen="$NL$hub$NL"
	cov=
	havecov=
	first=1
	while [ -n "$todo" ]; do
		cur=${todo%%"$NL"*}
		todo=${todo#*"$NL"}
		# Prints P/M lines for the index, then N<count>, then S for a ## Spokes line.
		o="$NL$(awk '
		{ sub(/\r$/, "") }
		$0 == "## Spokes" { insp = 1; hasS = 1; next }
		insp && (index($0, "# ") == 1 || index($0, "## ") == 1) { insp = 0 }
		insp && substr($0, 1, 2) == "- " {
			rest = substr($0, 3)
			p = index(rest, ": ")
			ok = 0
			if (p > 1) {
				path = substr(rest, 1, p - 1)
				desc = substr(rest, p + 2)
				f = substr(path, 1, 1)
				l = substr(path, length(path))
				ok = 1
				if (index(path, " ") || index(path, "`") || index(path, ":") || index(path, "\\") || index(path, "](")) ok = 0
				if (f == "@" || f == "/" || f == "<" || f == "[" || l == "/" || l == ">") ok = 0
				if (desc !~ /^[^ ].*\. [^ ].*\.$/) ok = 0
			}
			if (!ok) { print "M\t" $0; next }
			pre = ""
			d = desc
			while ((a = index(d, "`")) > 0) {
				d = substr(d, a + 1)
				b = index(d, "`")
				if (b == 0) break
				tok = substr(d, 1, b - 1)
				d = substr(d, b + 1)
				if (tok != "" && !index(tok, " ") && !index(tok, "\t")) pre = pre (pre == "" ? "" : " ") tok
			}
			print "P\t" path "\t" pre
		}
		END { print "N\t" NR; if (hasS) print "S" }
		' "$root/$cur" 2>/dev/null)"
		case $o in
		*"${NL}N$TAB"*) ;;
		*) continue ;;
		esac
		if [ -n "$first" ]; then
			first=
			cap=60
			case $o in
			*"${NL}S") ;;
			*) return 0 ;;
			esac
		else
			cap=200
		fi
		n=${o#*"${NL}N$TAB"}
		n=${n%%"$NL"*}
		if [ "$n" -gt "$cap" ] 2>/dev/null; then
			addf "$cur has $n lines, over the $cap-line cap"
		fi
		while IFS= read -r rec; do
			case $rec in
			M"$TAB"*)
				addf "$cur has a malformed index line: ${rec#M"$TAB"}"
				;;
			P"$TAB"*)
				rest=${rec#P"$TAB"}
				path=${rest%%"$TAB"*}
				pre=${rest#*"$TAB"}
				if [ ! -e "$root/$path" ]; then
					addf "$cur points to missing path $path"
				elif [ -f "$root/$path" ]; then
					c=$pre
					if [ -z "$c" ]; then
						case $path in
						*/*)
							d=${path%/*}
							case $d in
							docs | docs/*) ;;
							*) c="$d/" ;;
							esac
							;;
						esac
					fi
					cov="$cov$path$TAB$c$NL"
					[ -z "$c" ] || havecov=1
					case $seen in
					*"$NL$path$NL"*) ;;
					*)
						seen="$seen$path$NL"
						todo="$todo$path$NL"
						;;
					esac
				fi
				;;
			esac
		done <<EOF
$o
EOF
	done

	[ -n "$havecov" ] || return 0
	staged=$(git -C "$root" -c core.quotepath=off diff --cached --name-only 2>/dev/null)
	[ -n "$staged" ] || return 0
	list=$(printf '%s\n--\n%s\n' "$cov" "$staged" | awk -F '\t' '
	!sect && $0 == "--" { sect = 1; next }
	!sect {
		if ($1 == "") next
		if (!($1 in cp)) { order[++n] = $1; cp[$1] = "" }
		cp[$1] = cp[$1] " " $2
		next
	}
	{ st[$0] = 1; sl[++m] = $0 }
	END {
		for (i = 1; i <= n; i++) {
			s = order[i]
			if (s in st) continue
			k = split(cp[s], pf, " ")
			hit = 0
			for (j = 1; j <= k && !hit; j++)
				for (q = 1; q <= m; q++)
					if (index(sl[q], pf[j]) == 1) { hit = 1; break }
			if (hit) print s
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
	printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"repo-docs: %s"}}\n' "$msg"
elif [ -n "$recheck" ]; then
	msg=$(printf '%s' "$recheck" | jesc ', ')
	printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"repo-docs: the staged change touches paths these spokes cover; recheck them: %s"}}\n' "$msg"
fi
exit 0
