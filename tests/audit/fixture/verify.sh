#!/bin/sh
# verify.sh <manifest path> [name]: check a built fixture against the key literals in
# tests/audit/fixture/expected.md.
#
# Usage: m=$(sh tests/audit/fixture/build.sh solo) && sh tests/audit/fixture/verify.sh "$m" solo
#
# name is solo, solo-dirty, full, tokens, patterns, or ground-truth. Without it, the name
# comes from the fixture directory: manifest-groups.json means full; otherwise an app
# checkout on scratch-branch means solo-dirty; otherwise solo. tokens, patterns, and
# ground-truth are never detected: pass the name.
#
# Expected values are literals copied from expected.md; change them only together with
# expected.md and build.sh, with the reason in the commit body.
# Exit 0 when every check passes; otherwise print one line per mismatch and exit 1.
set -u

# Run every git call without the user's global or system config, as build.sh does.
GIT_CONFIG_NOSYSTEM=1
GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_NOSYSTEM GIT_CONFIG_GLOBAL
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL \
	GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL

m=${1:-}
if [ -z "$m" ] || [ ! -f "$m" ]; then
	echo "verify: no manifest at '$m'"
	exit 2
fi
F=$(cd "$(dirname "$m")" && pwd)
A=$F/app

name=${2:-}
if [ -z "$name" ]; then
	if [ -f "$F/manifest-groups.json" ]; then
		name=full
	elif [ "$(git -C "$A" rev-parse --abbrev-ref HEAD 2>/dev/null)" = scratch-branch ]; then
		name=solo-dirty
	else
		name=solo
	fi
fi
case $name in
solo | solo-dirty | full | tokens | patterns | ground-truth) ;;
*)
	echo "verify: unknown fixture '$name'"
	exit 2
	;;
esac

fails=0
fail() {
	echo "verify $name: $*"
	fails=$((fails + 1))
}

# same <label> <expected> <actual>
same() {
	[ "$2" = "$3" ] || fail "$1: expected '$2', got '$3'"
}

rev() {
	git -C "$1" rev-parse "$2" 2>/dev/null
}

finish() {
	if [ "$fails" -gt 0 ]; then
		exit 1
	fi
	echo "verify $name: ok"
}

# tokens: the commits, their files, the exports, and the three manifests.
if [ "$name" = tokens ]; then
	same "app base" 253d888eaa67c7c99b5f3d33a808835db8b6db39 "$(rev "$A" main)"
	same "app merge-base" 253d888eaa67c7c99b5f3d33a808835db8b6db39 \
		"$(git -C "$A" merge-base main feature 2>/dev/null)"
	same "app feature head" b12b94c3072b10e1b5b5f4eace49e598e5ef093c "$(rev "$A" feature)"
	same "app commits on feature" "2c91be9d37d6d3ba48068a20da316c7e6e70a245 fix(#4567 #4568): reject empty input|e38ebff437050f6ce3653d0908515336d83bcfc3 build 4567 passed|04ccf504e5efa62a444f69a2edcd40d5d42e9180 [4569] add the report command|dcae97565a63bbd4f6a52b6f9e1647530a32dd6f AB#4570 rename the config key|b12b94c3072b10e1b5b5f4eace49e598e5ef093c migrated 4567 rows" \
		"$(git -C "$A" log --reverse --format='%H %s' main..feature 2>/dev/null | tr '\n' '|' | sed 's/|$//')"
	same "app files changed" "ci/status.txt config/app.conf data/migration.txt src/input.sh src/report.sh" \
		"$(git -C "$A" diff --name-only main...feature 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
	same "app checkout branch" feature "$(git -C "$A" rev-parse --abbrev-ref HEAD 2>/dev/null)"
	for id in 4567 4568 4569 4570; do
		same "export $id id" "id: $id" "$(grep '^id:' "$F/exports/$id.md" 2>/dev/null)"
	done
	same "manifest.json ticket_token lines" 0 \
		"$(grep -c ticket_token "$F/manifest.json" 2>/dev/null)"
	same "manifest-token.json ticket_token" '"ticket_token": ["#{n}", "[{n}]", "AB#{n}"],' \
		"$(sed -n 's/^ *"ticket_token"/"ticket_token"/p' "$F/manifest-token.json" 2>/dev/null)"
	same "manifest-bad-token.json ticket_token" '"ticket_token": "#n",' \
		"$(sed -n 's/^ *"ticket_token"/"ticket_token"/p' "$F/manifest-bad-token.json" 2>/dev/null)"
	finish
	exit 0
fi

# patterns: the commits, their files, the exports, the manifest, and the behavior of the
# four planted cases, each run in a temp copy so the fixture repo never changes.
if [ "$name" = patterns ]; then
	mb=72ca6912e7a55ef653f72a0667089e4d5b7c2a69
	same "app merge-base" $mb "$(git -C "$A" merge-base main feature 2>/dev/null)"
	same "app feature head" 7bdaa0e61667de685db3a70f204a3918fb53413f "$(rev "$A" feature)"
	same "app main head" d84a2ec3bcdc1282bf12524ae08e24bf7928a7c8 "$(rev "$A" main)"
	same "app commits on feature" "e110cb26a794a40b733341d9ca397425c9b55bc1 PAT-1: reject non-numeric ids in deactivate|0c71299be23374e60d05f77fc1a0c292a945e9e6 PAT-2: add the warning count command|7bdaa0e61667de685db3a70f204a3918fb53413f PAT-3: add the email and last_login columns" \
		"$(git -C "$A" log --reverse --format='%H %s' "$mb..feature" 2>/dev/null | tr '\n' '|' | sed 's/|$//')"
	same "app commits on main since the merge-base" "d84a2ec3bcdc1282bf12524ae08e24bf7928a7c8 log: lowercase the warning prefix" \
		"$(git -C "$A" log --format='%H %s' "$mb..main" 2>/dev/null)"
	same "app files changed on main since the merge-base" "src/log.sh" \
		"$(git -C "$A" diff --name-only "$mb" main 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
	same "app files changed" "migrations/001_create_users.sh migrations/002_add_last_login.sh src/users.sh src/warnings.sh tests/test_log.sh tests/test_users.sh" \
		"$(git -C "$A" diff --name-only main...feature 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
	same "app diff stat" "6 files changed, 71 insertions(+)" \
		"$(git -C "$A" diff --shortstat main...feature 2>/dev/null | sed 's/^ //')"
	same "app checkout branch" feature "$(git -C "$A" rev-parse --abbrev-ref HEAD 2>/dev/null)"
	for id in PAT-1 PAT-2 PAT-3; do
		same "export $id id" "id: $id" "$(grep '^id:' "$F/exports/$id.md" 2>/dev/null)"
	done
	same "manifest.json run_once" '"run_once": ["migrations/*.sh"],' \
		"$(sed -n 's/^ *"run_once"/"run_once"/p' "$F/manifest.json" 2>/dev/null)"
	same "manifest.json claims lines" 0 "$(grep -c claims "$F/manifest.json" 2>/dev/null)"
	same "manifest-revert.json test keys" '"test_command": "sh", "test_run": "tests/test_*.sh",' \
		"$(sed -n 's/^ *"test_command"/"test_command"/p' "$F/manifest-revert.json" 2>/dev/null)"
	same "manifest-revert.json is manifest.json plus the test keys" "$(cat "$F/manifest.json" 2>/dev/null)" \
		"$(grep -v '"test_command"' "$F/manifest-revert.json" 2>/dev/null)"

	# Behavior, in temp copies. tree <rev> <dir> exports a revision of the app repo.
	tmp=$(mktemp -d)
	trap 'rm -rf "$tmp"' EXIT
	tree() {
		mkdir -p "$2" &&
			git -c core.autocrlf=false -C "$A" archive "$1" 2>/dev/null | tar -x -C "$2"
	}
	gm() {
		git -c user.name=fixture -c user.email=fixture@example.invalid \
			-c commit.gpgsign=false -c core.autocrlf=false "$@"
	}

	# P17: at the head, deactivate rejects a non-numeric id and reactivate accepts one.
	tree feature "$tmp/p17"
	out=$(cd "$tmp/p17" && sh src/users.sh deactivate abc 2>&1)
	rc=$?
	[ "$rc" -ne 0 ] && [ "$out" = "invalid id" ] ||
		fail "P17: deactivate at the head does not reject a non-numeric id (exit $rc, output '$out')"
	out=$(cd "$tmp/p17" && sh src/reactivate.sh abc 2>&1)
	rc=$?
	[ "$rc" -eq 0 ] && [ -z "$out" ] ||
		fail "P17: reactivate at the head rejects a non-numeric id (exit $rc, output '$out')"
	same "P17: data/users.csv after reactivate with a non-numeric id" \
		"id,name,status|1,Ada,active|2,Grace,active|3,Linus,active" \
		"$(tr '\n' '|' < "$tmp/p17/data/users.csv" | sed 's/|$//')"

	# P18: with the feature's src/users.sh change reverted (the merge-base file, the head
	# tests), the weak test passes and the decoy passes, while deactivate no longer
	# rejects a bad id. At the head the suite passes and deactivate rejects it.
	tree feature "$tmp/p18"
	(cd "$tmp/p18" && sh run-tests.sh >/dev/null 2>&1) ||
		fail "P18: the test suite fails at the head"
	git -C "$A" show "$mb:src/users.sh" > "$tmp/p18/src/users.sh" 2>/dev/null
	out=$(cd "$tmp/p18" && sh tests/test_users.sh 2>&1)
	rc=$?
	[ "$rc" -eq 0 ] || fail "P18: tests/test_users.sh fails with the src/users.sh change reverted (exit $rc)"
	printf '%s\n' "$out" | grep -qx 'pass test_deactivate_rejects_bad_id' ||
		fail "P18: test_deactivate_rejects_bad_id does not pass with the src/users.sh change reverted"
	printf '%s\n' "$out" | grep -qx 'pass test_deactivate_keeps_row' ||
		fail "P18: test_deactivate_keeps_row does not pass with the src/users.sh change reverted"
	out=$(cd "$tmp/p18" && sh src/users.sh deactivate abc 2>&1)
	rc=$?
	[ "$rc" -eq 0 ] && [ -z "$out" ] ||
		fail "P18: deactivate with a non-numeric id is rejected with the src/users.sh change reverted (exit $rc, output '$out')"

	# P19: at the head count_warnings counts the two lines log_warn writes; after a clean
	# merge of main into a clone of feature, log_warn writes a different prefix and the
	# count is 0.
	tree feature "$tmp/p19"
	(cd "$tmp/p19" && . ./src/log.sh && log_warn disk low && log_warn slow reply) > "$tmp/p19.log"
	same "P19: count_warnings at the head" 2 "$(cd "$tmp/p19" && sh src/warnings.sh count "$tmp/p19.log" 2>&1)"
	if gm clone -q -b feature "$A" "$tmp/p19m" 2>/dev/null &&
		gm -C "$tmp/p19m" merge -q --no-edit origin/main >/dev/null 2>&1; then
		(cd "$tmp/p19m" && . ./src/log.sh && log_warn disk low && log_warn slow reply) > "$tmp/p19m.log"
		same "P19: warning lines after the merge" 2 "$(grep -c '^warning: ' "$tmp/p19m.log")"
		same "P19: count_warnings after the merge" 0 "$(cd "$tmp/p19m" && sh src/warnings.sh count "$tmp/p19m.log" 2>&1)"
	else
		fail "P19: main does not merge cleanly into feature"
	fi

	# P20: an install migrated at the merge-base (journal written) gets only last_login
	# when the head's migrate.sh runs, and a rerun is a no-op. A fresh install at the head
	# gets both columns.
	tree "$mb" "$tmp/p20old"
	(cd "$tmp/p20old" && sh migrate.sh >/dev/null 2>&1)
	same "P20: journal at the merge-base" 001_create_users.sh "$(cat "$tmp/p20old/data/applied.txt" 2>/dev/null)"
	tree feature "$tmp/p20"
	cp "$tmp/p20old/data/users.csv" "$tmp/p20old/data/applied.txt" "$tmp/p20/data/"
	out=$(cd "$tmp/p20" && sh migrate.sh 2>&1)
	same "P20: migrate.sh output on the migrated install" "applied 002_add_last_login.sh" "$out"
	same "P20: header on the migrated install" "id,name,status,last_login" "$(head -n 1 "$tmp/p20/data/users.csv")"
	grep -q email "$tmp/p20/data/users.csv" && fail "P20: the migrated install has an email column"
	cp "$tmp/p20/data/users.csv" "$tmp/p20.once"
	out=$(cd "$tmp/p20" && sh migrate.sh 2>&1)
	same "P20: migrate.sh output on a rerun" "" "$out"
	(cd "$tmp/p20" && sh migrations/002_add_last_login.sh)
	cmp -s "$tmp/p20.once" "$tmp/p20/data/users.csv" || fail "P20: a rerun of 002 changed data/users.csv"
	tree feature "$tmp/p20new"
	out=$(cd "$tmp/p20new" && sh migrate.sh 2>&1)
	same "P20: migrate.sh output on a fresh install at the head" \
		"applied 001_create_users.sh|applied 002_add_last_login.sh" \
		"$(printf '%s\n' "$out" | tr '\n' '|' | sed 's/|$//')"
	same "P20: header on a fresh install at the head" "id,name,status,email,last_login" \
		"$(head -n 1 "$tmp/p20new/data/users.csv" 2>/dev/null)"
	cp "$tmp/p20new/data/users.csv" "$tmp/p20new.once"
	(cd "$tmp/p20new" && sh migrations/001_create_users.sh && sh migrations/002_add_last_login.sh)
	cmp -s "$tmp/p20new.once" "$tmp/p20new/data/users.csv" || fail "P20: a rerun of 001 and 002 changed data/users.csv on a fresh install"

	finish
	exit 0
fi

# ground-truth: the branches, commits, exports, and manifest, then one behavior check per
# planted case, each run in a temp clone of svc so the fixture repo never changes.
if [ "$name" = ground-truth ]; then
	A=$F/svc
	# The svc scripts read these; a caller's value, such as ENV for interactive shells,
	# would change their results.
	unset APP_TENANT DATA_DIR DATES DB_ACCOUNT DB_HOST DB_NAME ENV FETCH_STATUS_FIELD \
		FUNCTIONS_FILE IMPORTED RECORDS RECORDS_FILE RELATIONS SCHEMA_FILE SETTINGS_CACHE \
		TARGETS VIA_A VIA_B
	mb=08081290881379bc6b7cfcd97a951b602513cf07
	init=68541c48ed0e097c448180e9405c6a5b57b2a788
	tmp=$(mktemp -d)
	trap 'rm -rf "$tmp"' EXIT

	# lines: join the lines of stdin with '|', so a failure prints one line.
	lines() {
		tr -d '\r' | tr '\n' '|' | sed 's/|$//'
	}

	# heads <label prefix>: the five branch heads of svc.
	heads() {
		for bh in feature:2a88b28b4d9e9c6d028964eb5864dda8624327a7 \
			main:a1dfff3c10661eda96738aa5cc949fd35deabf78 \
			gt-11-lookup:f142c6e594cbb9fc9dc2da3a24b9b295fa61ef1b \
			target:54368f2585210328bd9a5360fe0aa3d1681a0027 \
			stacked:4aa559a282f955bff0b698214260a2e8770c51dc; do
			same "$1${bh%%:*} head" "${bh#*:}" "$(rev "$A" "refs/heads/${bh%%:*}")"
		done
	}
	heads "svc "

	# Every commit of the Commits table, with its subject.
	git -C "$A" log --all --format='%H %s' > "$tmp/commits" 2>/dev/null
	while IFS= read -r c; do
		grep -qxF "$c" "$tmp/commits" || fail "commit not found: $c"
	done <<-'EOF'
		68541c48ed0e097c448180e9405c6a5b57b2a788 initial records import service
		19bb7943d81f5a6395ddd0e0ffe9e3080427ed4e schemas: describe the study fields
		ad42be4cb6a8e96b6e362b73a20d92e9a239b047 GT-14: list the records with a status
		90179b16ccd54e549f6075596cde8bb8e0f0e1d7 GT-14: add the update date to fetch_row
		b5bcfd802719df31dadadbd0dbfed34aea94bdb4 steps: print the status first in fetch_row
		b4cb796c71cc3ebaf11b211d57244592af62e833 GT-0: stop requiring items on orders
		120f2bf261e9140e1cc81c57e07b1780236ee6b9 migrations: make the records key (id, type)
		08081290881379bc6b7cfcd97a951b602513cf07 docs: describe the commands
		741a5e76fc60d8e37209bd437e03430a36665e88 GT-1: add the contract import endpoint
		face5b6264f805300d4ede99ba1295f2d5df39b0 GT-13: rename the rank function script
		0ed4041b6ca3f60b25248d27dc7ee42997b3128b GT-7: waive the flag error in bulk imports
		c50227fffaad9ba71359be4fbe893119c900aab2 GT-2: skip ineligible targets in related links
		265206be0fa2f799264f2ca91429fb99ccdd7641 GT-3: use the category reference in the person and org schemas
		a9997c92a63e2ac01020cc6266e14701d8dd9844 GT-4: write source_id when a site is created
		732d4ba45e409dc7b8557f6a270fe6703cf4dc81 rank function: skip rows without a score
		06afe9d377b8dafffbe6f9b8821439f44a448c22 GT-5: make items optional for invoices
		0671734d45718043c434b3e25ab358dba3804743 GT-8: update the sql functions
		a1dfff3c10661eda96738aa5cc949fd35deabf78 validator: prefix messages with the field path
		f142c6e594cbb9fc9dc2da3a24b9b295fa61ef1b GT-11: ignore deleted rows in the lookup function
		542a0d68a247ea82311e2ae11a41ab621785d7c5 GT-6: follow the tenant settings in bulk imports
		7dacf80a10d149729f8cfac6d360a9e60695a3c7 GT-10: add the office columns to the records key migration
		c0522a3bcf59db79eaf358b9708dfd4c14d7dc74 GT-12: match hrn ignoring case in the lookup function
		222dc8c4b80cffe3f30d03a212e6ddd67178596a GT-13: skip rows without a score in the rank function
		d2cb15c1d3c6ad4b94bbaef8bd6c60a63752a12e GT-13: rename the audit function script
		77c261626555d680acd1f914954af7943424d5cc GT-14: list the records with a status
		54368f2585210328bd9a5360fe0aa3d1681a0027 GT-14: add the update date to fetch_row
		44f026393f3b97e89d61faba0745ec199210276a GT-9: add the dates scenario
		fcee9fd478c918392e2943ab76db544e5b5abc2a GT-9: add the read and status steps
		3ca386280c2a6a4130f5b6e43a1363d2b605819d GT-9: add the report scenarios
		4a321695576df33adfa0efd81b1ae2c1947cbe98 GT-9: add the record fetch step
		4aa559a282f955bff0b698214260a2e8770c51dc GT-14: add the fetch scenarios
		2a88b28b4d9e9c6d028964eb5864dda8624327a7 GT-9: add the hrn lookup scenario
	EOF

	same "svc merge-base of main and feature" $mb "$(git -C "$A" merge-base main feature 2>/dev/null)"
	same "svc merge-base of target and stacked" $init "$(git -C "$A" merge-base target stacked 2>/dev/null)"
	same "svc commits on main since the merge-base" \
		"a1dfff3c10661eda96738aa5cc949fd35deabf78 732d4ba45e409dc7b8557f6a270fe6703cf4dc81" \
		"$(git -C "$A" log --format=%H "$mb..main" 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
	same "svc commits in target..stacked" \
		"4aa559a282f955bff0b698214260a2e8770c51dc 90179b16ccd54e549f6075596cde8bb8e0f0e1d7 ad42be4cb6a8e96b6e362b73a20d92e9a239b047" \
		"$(git -C "$A" log --format=%H target..stacked 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
	renames=$(git -C "$A" diff -M --name-status main...feature 2>/dev/null | grep '^R' | tr '\t' ' ' | lines)
	same "svc renames in main...feature" \
		"R067 migrations/003_records_pk.sh migrations/003_records_pk_and_columns.sh|R061 migrations/f_audit_ops8.sh migrations/f_audit_gt13.sh|R073 migrations/f_lookup_ops7.sh migrations/f_lookup_gt12.sh|R081 migrations/f_rank_ops9.sh migrations/f_rank_gt13.sh" \
		"$renames"
	renames11=$(git -C "$A" diff -M --name-status main...gt-11-lookup 2>/dev/null | tr '\t' ' ' | lines)
	same "svc renames in main...gt-11-lookup" "R072 migrations/f_lookup_ops7.sh migrations/f_lookup_gt11.sh" "$renames11"
	same "svc diff stat main...feature" "32 files changed, 266 insertions(+), 19 deletions(-)" \
		"$(git -C "$A" diff -M --shortstat main...feature 2>/dev/null | sed 's/^ //')"
	same "svc diff stat target...stacked" "3 files changed, 30 insertions(+), 2 deletions(-)" \
		"$(git -C "$A" diff --shortstat target...stacked 2>/dev/null | sed 's/^ //')"
	same "svc checkout branch" feature "$(git -C "$A" rev-parse --abbrev-ref HEAD 2>/dev/null)"
	same "svc status" "" "$(git -C "$A" status --porcelain 2>/dev/null | lines)"

	# Exports, manifest, and the PR exports' key lines.
	same "exports" "GT-0.md GT-1.md GT-10.md GT-12.md GT-13.md GT-14.md GT-2.md GT-3.md GT-4.md GT-5.md GT-6.md GT-7.md GT-8.md GT-9.md PR-1.md PR-2.md" \
		"$(cd "$F/exports" 2>/dev/null && ls | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')"
	for id in GT-0 GT-1 GT-2 GT-3 GT-4 GT-5 GT-6 GT-7 GT-8 GT-9 GT-10 GT-12 GT-13 GT-14 PR-1 PR-2; do
		same "export $id id" "id: $id" "$(grep '^id:' "$F/exports/$id.md" 2>/dev/null)"
	done
	same "export GT-0 state" "state: Done" "$(grep '^state:' "$F/exports/GT-0.md" 2>/dev/null)"
	case $(cat "$F/exports/GT-2.md" 2>/dev/null | tr '\n' ' ' | tr -s ' ') in
	*'The importer then imports a record linked to such a target, without that link, instead of rejecting the record.'*) ;;
	*) fail "GT-2 export does not say the importer then imports a record without the dropped link" ;;
	esac
	mf=$(tr -d ' \t\r\n' < "$F/manifest.json")
	same "manifest.json bundle 1" \
		'{"repo":"./svc","pr":"file:./exports/PR-1.md","branch":"feature","base":"main","run_once":["migrations/*.sh"],"tickets":["file:./exports/GT-1.md","file:./exports/GT-2.md","file:./exports/GT-3.md","file:./exports/GT-4.md","file:./exports/GT-5.md","file:./exports/GT-6.md","file:./exports/GT-7.md","file:./exports/GT-8.md","file:./exports/GT-9.md","file:./exports/GT-10.md","file:./exports/GT-12.md","file:./exports/GT-13.md"]}' \
		"$(printf '%s\n' "$mf" | sed -n 's/.*"bundles":\[\({[^}]*}\),.*/\1/p')"
	same "manifest.json bundle 2, the last" \
		'{"repo":"./svc","pr":"file:./exports/PR-2.md","branch":"stacked","base":"target","tickets":["file:./exports/GT-14.md"]}' \
		"$(printf '%s\n' "$mf" | sed -n 's/.*"bundles":\[{[^}]*},\({[^}]*}\)\],.*/\1/p')"
	same "manifest.json groups on ./svc" "import-api records bulk-rules sql harness migrations stacked" \
		"$(printf '%s\n' "$mf" | tr '{' '\n' | sed -n 's/^"name":"\([^"]*\)","repo":"\.\/svc".*/\1/p' | tr '\n' ' ' | sed 's/ $//')"
	same "manifest.json claims lines" 1 "$(grep -cF '"claims": ["./session-summary.md"]' "$F/manifest.json")"
	same "manifest-revert.json test keys, bundle 1 only" \
		'"test_command": "sh", "test_run": ["tests/test_*.sh", "tests/scenario_*.sh"],' \
		"$(sed -n 's/^ *"test_command"/"test_command"/p' "$F/manifest-revert.json" 2>/dev/null)"
	same "manifest-revert.json is manifest.json plus the test keys" "$(cat "$F/manifest.json" 2>/dev/null)" \
		"$(grep -v '"test_command"' "$F/manifest-revert.json" 2>/dev/null)"
	pr1=$(cat "$F/exports/PR-1.md" 2>/dev/null | tr '\n' ' ' | tr -s ' ')
	for s in 'items are optional for invoices, so invoices now match orders (GT-0).' \
		'If the settings cache cannot be read, the import fails closed and rolls back.' \
		'Related: PR-3 (branch gt-11-lookup), open against main, changes the lookup function for GT-11.' \
		'build 1.4.0-17' \
		'001_create_schema.sh 002_records_columns.sh 003_records_pk.sh f_audit_ops8.sh f_lookup_ops7.sh f_rank_gt13.sh' \
		'Host=localhost;Database=svc;Username=svc_writer;Password=********'; do
		case $pr1 in
		*"$s"*) ;;
		*) fail "PR-1 export has no '$s'" ;;
		esac
	done
	same "PR-1 threads (file, line, date)" "migrations/f_rank_gt13.sh 1 2026-08-20|tests/connection.sh 6 2026-09-13" \
		"$(sed -n 's/^ *- file: //p; s/^ *line: //p; s/^ *date: //p' "$F/exports/PR-1.md" 2>/dev/null | paste -d ' ' - - - | lines)"
	case $(cat "$F/exports/PR-2.md" 2>/dev/null) in
	*'Built on GT-14 (target).'*) ;;
	*) fail "PR-2 export has no 'Built on GT-14 (target).'" ;;
	esac

	# Behavior, in temp clones.
	gm() {
		git -c user.name=fixture -c user.email=fixture@example.invalid \
			-c commit.gpgsign=false -c core.autocrlf=false "$@"
	}
	# clone <dir> <rev>: a clone of svc in $tmp/<dir>, checked out at <rev>, detached.
	clone() {
		gm clone -q -n -c core.autocrlf=false "$A" "$tmp/$1" 2>/dev/null &&
			gm -C "$tmp/$1" checkout -q --detach "$2" 2>/dev/null
	}
	# run <dir> <command>...: run a command in $tmp/<dir>; set rc to its exit code and out
	# to its output and errors, lines joined with '|'.
	run() {
		out=$(cd "$tmp/$1" && shift && "$@" 2>&1)
		rc=$?
		out=$(printf '%s\n' "$out" | lines)
	}
	# has <line>: succeed when the last run printed this line.
	has() {
		case "|$out|" in *"|$1|"*) return 0 ;; esac
		return 1
	}
	# says <text>: succeed when the last run's output contains this text.
	says() {
		case $out in *"$1"*) return 0 ;; esac
		return 1
	}
	# linenos <text> <file>: the numbers of the lines of <file> at the head that contain <text>.
	linenos() {
		grep -nF -e "$1" "$tmp/head/$2" 2>/dev/null | cut -d: -f1 | tr '\n' ' ' | sed 's/ $//'
	}
	clone head origin/feature || fail "a clone of svc at feature failed"

	# S1: the feature filters the direct arm of related_links only.
	run head sh -c '. ./src/links.sh && related_links K2'
	same "S1: related_links K2" K2,X9 "$out"
	run head sh src/importer.sh import K2
	[ "$rc" -eq 1 ] && [ "$out" = "rejected K2" ] ||
		fail "S1: importer.sh import K2 does not print 'rejected K2' and exit 1 (exit $rc, output '$out')"
	run head sh src/sweep.sh
	same "S1: sweep.sh output" "dropped K3,X2" "$out"
	run head sh src/importer.sh import K3
	[ "$rc" -eq 0 ] && [ "$out" = "imported K3" ] ||
		fail "S1: importer.sh import K3 does not print 'imported K3' and exit 0 (exit $rc, output '$out')"

	# S2: import_contract has no import guard.
	run head env IMPORTED="$tmp/s2.csv" sh src/handlers.sh import_contract viewer k1
	[ "$rc" -eq 0 ] && [ "$(cat "$tmp/s2.csv" 2>/dev/null)" = contract,k1 ] ||
		fail "S2: import_contract viewer k1 does not exit 0 and write contract,k1 (exit $rc, output '$out')"
	run head env IMPORTED="$tmp/s2.csv" sh src/handlers.sh import_document viewer k1
	[ "$rc" -eq 1 ] && [ "$out" = "forbidden: role viewer may not import" ] ||
		fail "S2: import_document viewer k1 does not exit 1 with 'forbidden: role viewer may not import' (exit $rc, output '$out')"

	# S3: site.json keeps the string category; study.json keeps 19bb794's trailing comma.
	same "S3: schemas/study.json line 7" '    "category": {"type": "string"},' \
		"$(sed -n 7p "$tmp/head/schemas/study.json" 2>/dev/null | lines)"
	same "S3: schemas/site.json line 6" '"category": {"type": "string"}' \
		"$(sed -n 's/^ *//; 6p' "$tmp/head/schemas/site.json" 2>/dev/null | lines)"
	for s in person org; do
		grep '"category"' "$tmp/head/schemas/$s.json" 2>/dev/null | grep -qF '"$ref"' ||
			fail "S3: the category of schemas/$s.json is not a reference"
	done
	if command -v jq >/dev/null 2>&1; then
		run head jq empty schemas/study.json
		[ "$rc" -ne 0 ] && says 'parse error' ||
			fail "S3: jq empty schemas/study.json does not fail with a parse error (exit $rc, output '$out')"
		run head jq -c .properties.category schemas/site.json
		same "S3: site.json category by jq" '{"type":"string"}' "$out"
	fi

	# S4: an update without source_id empties a site's and keeps a person's.
	mkdir "$tmp/s4" && : > "$tmp/s4/site.csv" && : > "$tmp/s4/person.csv"
	for t in site person; do
		run head env DATA_DIR="$tmp/s4" sh src/upsert.sh "upsert_$t" 9 N src-9
		run head env DATA_DIR="$tmp/s4" sh src/upsert.sh "upsert_$t" 9 N ''
	done
	same "S4: site row after an update without source_id" 9,N, "$(lines < "$tmp/s4/site.csv")"
	same "S4: person row after an update without source_id" 9,N,src-9 "$(lines < "$tmp/s4/person.csv")"
	run head sh tests/test_upsert_site.sh
	[ "$rc" -eq 0 ] || fail "S4: tests/test_upsert_site.sh fails at the head (exit $rc, output '$out')"

	# S5: the code no longer requires items for invoices; both invoice specs still do.
	run head sh src/validate.sh invoice id customer
	same "S5: validate.sh invoice id customer" valid "$out"
	for s in spec/invoices.yml spec/public/invoices.yml; do
		same "S5: '- items' lines in $s" 1 "$(grep -cF -e '- items' "$tmp/head/$s" 2>/dev/null)"
	done
	for s in spec/orders.yml spec/public/orders.yml; do
		same "S5: '- items' lines in $s" 0 "$(grep -cF -e '- items' "$tmp/head/$s" 2>/dev/null)"
	done
	# An unknown kind exits 2 with the message on stderr and nothing on stdout.
	out=$(cd "$tmp/head" && sh src/validate.sh unknown id customer 2>"$tmp/s5.err")
	rc=$?
	err=$(lines < "$tmp/s5.err")
	[ "$rc" -eq 2 ] && [ -z "$out" ] && [ "$err" = "unknown kind unknown" ] ||
		fail "S5: validate.sh unknown id customer does not exit 2 with 'unknown kind unknown' on stderr (exit $rc, stdout '$(printf '%s\n' "$out" | lines)', stderr '$err')"

	# T1: the waiver drops the bare flag message at the head; after main's a1dfff3 the
	# message has the field path, the waiver drops nothing, and both tests still pass.
	printf 'id=7\nname=Edsger\n' > "$tmp/t1.record"
	run head sh -c 'sh src/validator.sh validate "$1" | sh src/waiver.sh' t1 "$tmp/t1.record"
	same "T1: errors after the waiver at the head" "" "$out"
	for t in tests/test_waiver.sh tests/scenario_bulk.sh; do
		run head sh "$t"
		[ "$rc" -eq 0 ] || fail "T1: $t fails at the head (exit $rc, output '$out')"
	done
	if clone t1 origin/feature && gm -C "$tmp/t1" merge -q --no-ff --no-edit origin/main >/dev/null 2>&1; then
		run t1 sh -c 'sh src/validator.sh validate "$1" | sh src/waiver.sh' t1 "$tmp/t1.record"
		same "T1: errors after the waiver after the merge of main" "record.flag: flag is required" "$out"
		for t in tests/test_waiver.sh tests/scenario_bulk.sh; do
			run t1 sh "$t"
			[ "$rc" -eq 0 ] || fail "T1: $t fails after the merge of main (exit $rc, output '$out')"
		done
	else
		fail "T1: the merge of main into a clone of feature does not exit 0"
	fi

	# T2: the contract test passes with the merge-base trigger too, and no script outside
	# tests/ reads SQL.
	run head sh tests/test_sql_contract.sh
	[ "$rc" -eq 0 ] || fail "T2: tests/test_sql_contract.sh fails at the head (exit $rc, output '$out')"
	mkdir "$tmp/t2" && cp -R "$tmp/head/sql" "$tmp/head/tests" "$tmp/t2/" &&
		git -C "$tmp/head" show "$mb:sql/trg_reread_json.sql" > "$tmp/t2/sql/trg_reread_json.sql" 2>/dev/null
	run t2 sh tests/test_sql_contract.sh
	[ "$rc" -eq 0 ] ||
		fail "T2: tests/test_sql_contract.sh fails with sql/trg_reread_json.sql from the merge-base (exit $rc, output '$out')"
	run head sh -c "git ls-files '*.sh' | grep -v '^tests/' | xargs grep -lF -e psql -e .sql /dev/null"
	same "T2: scripts outside tests/ that mention psql or .sql" "" "$out"

	# T3: with record 1's updated date wrong, scenario_dates.sh stops at the first assertion
	# and the control never runs.
	mkdir "$tmp/t3" && cp -R "$tmp/head/tests" "$tmp/head/data" "$tmp/t3/" &&
		awk -F, -v OFS=, '$1 == 1 { $3 = "2026-08-09" } { print }' "$tmp/head/data/dates.csv" > "$tmp/t3/data/dates.csv"
	run t3 sh tests/scenario_dates.sh
	[ "$rc" -eq 1 ] && says 'updated date of record 1' && says 2026-08-09 && ! says 'created date of record 1' ||
		fail "T3: with updated date 2026-08-09, scenario_dates.sh does not exit 1 after the failure of 'updated date of record 1' alone (exit $rc, output '$out')"

	# T4: step_assert_active reads LAST_ROW, which only an earlier scenario in the same
	# process sets.
	run head sh tests/run_scenarios.sh scenario_assert_only
	[ "$rc" -eq 1 ] && has 'run the read step first' ||
		fail "T4: scenario_assert_only alone does not fail with 'run the read step first' (exit $rc, output '$out')"
	run head sh tests/run_scenarios.sh scenario_read_active scenario_assert_only
	[ "$rc" -eq 0 ] ||
		fail "T4: scenario_assert_only after scenario_read_active fails (exit $rc, output '$out')"

	# T5: scenario_report_read reads as report_reader, a role its skip tag does not name.
	run head env ENV=qa sh tests/run_scenarios.sh report_read report_audit
	[ "$rc" -eq 1 ] && has 'accounts file env/qa/accounts.txt has no role report_reader' &&
		has 'FAIL report_read' && has 'skip scenario_report_audit' ||
		fail "T5: under ENV=qa report_read does not fail on its accounts file while report_audit is skipped (exit $rc, output '$out')"
	run head env ENV=dev sh tests/run_scenarios.sh report_read report_audit
	[ "$rc" -eq 0 ] && ! has 'FAIL report_read' && ! has 'skip scenario_report_audit' ||
		fail "T5: under ENV=dev report_read and report_audit do not both pass (exit $rc, output '$out')"

	# C1: a missing cache stops the batch; a directory in place of the cache turns every
	# setting-keyed rule off.
	printf '4,Edsger,yes,,\n5,Barbara,yes,,\n6,Donald,yes,,\n' > "$tmp/c1.batch"
	cp "$tmp/head/data/records.csv" "$tmp/c1.csv"
	run head env RECORDS_FILE="$tmp/c1.csv" SETTINGS_CACHE="$tmp/c1.none" sh src/bulk_import.sh "$tmp/c1.batch"
	[ "$rc" -eq 1 ] || fail "C1: a batch with no cache file exits $rc, not 1 (output '$out')"
	cmp -s "$tmp/head/data/records.csv" "$tmp/c1.csv" || fail "C1: a batch with no cache file changed records.csv"
	[ ! -e "$tmp/c1.csv.stage" ] || fail "C1: a batch with no cache file left its staging file"
	mkdir "$tmp/c1.cache"
	run head env RECORDS_FILE="$tmp/c1.csv" SETTINGS_CACHE="$tmp/c1.cache" sh src/bulk_import.sh "$tmp/c1.batch"
	[ "$rc" -eq 0 ] && [ "$(grep -c -e '^4,Edsger,' -e '^5,Barbara,' -e '^6,Donald,' "$tmp/c1.csv")" = 3 ] ||
		fail "C1: a batch without offices, with a directory in place of the cache, is not imported (exit $rc, output '$out')"

	# C2: with require_office=no the office_code rule is off at the head; the merge-base,
	# which turned every rule on, rejects the record.
	printf 'require_flag=yes\nrequire_office=no\n' > "$tmp/c2.cache"
	printf '4,Edsger,yes,north,\n' > "$tmp/c2.batch"
	cp "$tmp/head/data/records.csv" "$tmp/c2.csv"
	run head env RECORDS_FILE="$tmp/c2.csv" SETTINGS_CACHE="$tmp/c2.cache" sh src/bulk_import.sh "$tmp/c2.batch"
	[ "$rc" -eq 0 ] && grep -q '^4,Edsger,' "$tmp/c2.csv" ||
		fail "C2: 4,Edsger,yes,north, is not imported at the head (exit $rc, output '$out')"
	clone c2 "$mb" && cp "$tmp/c2/data/records.csv" "$tmp/c2mb.csv"
	run c2 env RECORDS_FILE="$tmp/c2mb.csv" SETTINGS_CACHE="$tmp/c2.cache" sh src/bulk_import.sh "$tmp/c2.batch"
	[ "$rc" -eq 1 ] && says 'office_code is required' ||
		fail "C2: at the merge-base 4,Edsger,yes,north, does not exit 1 with 'office_code is required' (exit $rc, output '$out')"

	# C3: step_fetch_record reads the store without APP_TENANT, which returns no rows.
	run head sh -c '. tests/steps_db.sh && step_fetch_record 1'
	[ "$rc" -ne 0 ] && [ "$out" = 'expected 1 row, got 0' ] ||
		fail "C3: step_fetch_record 1 does not fail with 'expected 1 row, got 0' (exit $rc, output '$out')"
	run head env APP_TENANT=acme sh -c '. tests/steps_db.sh && step_fetch_record 1'
	[ "$rc" -eq 0 ] && [ "$out" = 'fetched record 1' ] ||
		fail "C3: with APP_TENANT=acme step_fetch_record 1 does not print 'fetched record 1' (exit $rc, output '$out')"

	# H1: the hrn scenario reads as svc_writer, the account the service writes with.
	same "H1: svc_writer lines in tests/scenario_hrn_lookup.sh" "3 8" "$(linenos svc_writer tests/scenario_hrn_lookup.sh)"
	same "H1: svc_writer lines in src/upsert.sh" 7 "$(linenos svc_writer src/upsert.sh)"
	same "H1: svc_writer lines in env/dev/accounts.txt" 1 "$(linenos svc_writer env/dev/accounts.txt)"

	# H2: step_find_by_hrn doubles quotes and builds the where clause; query_param binds.
	same "H2: quote doubling lines in tests/steps_db.sh" 59 "$(linenos "''" tests/steps_db.sh)"
	same "H2: built where clause lines in tests/steps_db.sh" 60 "$(linenos "where hrn = '" tests/steps_db.sh)"
	sed -n 57,61p "$tmp/head/tests/steps_db.sh" 2>/dev/null | grep -q '^step_find_by_hrn()' ||
		fail "H2: tests/steps_db.sh lines 57 to 61 do not define step_find_by_hrn"
	sed -n 25,28p "$tmp/head/tests/steps_db.sh" 2>/dev/null | grep -q '^query_param()' ||
		fail "H2: tests/steps_db.sh lines 25 to 28 do not define query_param"

	# R1: an install that journaled 003_records_pk.sh runs the renamed script and rebuilds
	# the key again; an install from before the key change ends with pk: id,type.
	clone r1 "$mb" && (cd "$tmp/r1" && sh migrate.sh) >/dev/null 2>&1
	grep -qx 003_records_pk.sh "$tmp/r1/data/applied.txt" 2>/dev/null ||
		fail "R1: the journal at the merge-base does not hold 003_records_pk.sh"
	gm -C "$tmp/r1" checkout -q --detach origin/feature 2>/dev/null
	run r1 sh migrate.sh
	has 'rebuilt pk' && has 'applied 003_records_pk_and_columns.sh' ||
		fail "R1: over a journal holding 003_records_pk.sh, migrate.sh at the head does not print 'rebuilt pk' and 'applied 003_records_pk_and_columns.sh' (exit $rc, output '$out')"
	clone r1old "$init" && (cd "$tmp/r1old" && sh migrate.sh) >/dev/null 2>&1
	same "R1: key of an install at the initial commit" "pk: id" \
		"$(grep '^pk:' "$tmp/r1old/data/schema.txt" 2>/dev/null | lines)"
	gm -C "$tmp/r1old" checkout -q --detach origin/feature 2>/dev/null
	run r1old sh migrate.sh
	same "R1: key of that install after migrate.sh at the head" "pk: id,type" \
		"$(grep '^pk:' "$tmp/r1old/data/schema.txt" 2>/dev/null | lines)"

	# R2: feature and gt-11-lookup each rename f_lookup_ops7.sh, to different names.
	case "|$renames|" in
	*"|R073 migrations/f_lookup_ops7.sh migrations/f_lookup_gt12.sh|"*) ;;
	*) fail "R2: main...feature has no rename R073 of f_lookup_ops7.sh to f_lookup_gt12.sh ('$renames')" ;;
	esac
	[ "$renames11" = "R072 migrations/f_lookup_ops7.sh migrations/f_lookup_gt11.sh" ] ||
		fail "R2: main...gt-11-lookup is not the rename R072 of f_lookup_ops7.sh to f_lookup_gt11.sh ('$renames11')"
	# Merged in turn into main, the second rename conflicts; with both files kept at their
	# branch versions, the second script's body is the only lookup definition left.
	if clone r2 origin/main && gm -C "$tmp/r2" merge -q --no-ff --no-edit origin/gt-11-lookup >/dev/null 2>&1; then
		gm -C "$tmp/r2" merge -q --no-ff --no-edit origin/feature >/dev/null 2>&1
		rc=$?
		unmerged=$(git -C "$tmp/r2" diff --name-only --diff-filter=U 2>/dev/null)
		[ "$rc" -ne 0 ] && printf '%s\n' "$unmerged" | grep -qx migrations/f_lookup_gt11.sh &&
			printf '%s\n' "$unmerged" | grep -qx migrations/f_lookup_gt12.sh ||
			fail "R2: the merge of feature after gt-11-lookup does not stop with migrations/f_lookup_gt11.sh and migrations/f_lookup_gt12.sh unmerged (exit $rc, unmerged '$(printf '%s\n' "$unmerged" | lines)')"
		if git -C "$tmp/r2" show origin/gt-11-lookup:migrations/f_lookup_gt11.sh > "$tmp/r2/migrations/f_lookup_gt11.sh" 2>/dev/null &&
			git -C "$tmp/r2" show origin/feature:migrations/f_lookup_gt12.sh > "$tmp/r2/migrations/f_lookup_gt12.sh" 2>/dev/null; then
			(cd "$tmp/r2" && FUNCTIONS_FILE=$tmp/r2.functions && export FUNCTIONS_FILE &&
				sh migrations/f_lookup_gt11.sh && sh migrations/f_lookup_gt12.sh) >/dev/null 2>&1
			same "R2: lookup lines after f_lookup_gt11.sh then f_lookup_gt12.sh" \
				"lookup: select id from audit where lower(hrn) = lower(?)" \
				"$(grep '^lookup:' "$tmp/r2.functions" 2>/dev/null | lines)"
		else
			fail "R2: migrations/f_lookup_gt11.sh on gt-11-lookup or migrations/f_lookup_gt12.sh on feature is missing"
		fi
	else
		fail "R2: the merge of gt-11-lookup into a clone of main does not exit 0"
	fi

	# R3: f_rank_gt13.sh got its score guard after the rename was deployed; over the journal
	# in PR-1's thread, migrate.sh at the head skips it.
	r3old=$(git -C "$tmp/head" show face5b6264f805300d4ede99ba1295f2d5df39b0:migrations/f_rank_gt13.sh 2>/dev/null)
	[ -n "$r3old" ] && ! printf '%s\n' "$r3old" | grep -q 'score is not null' ||
		fail "R3: f_rank_gt13.sh at face5b6 is missing or has 'score is not null'"
	same "R3: 'score is not null' lines in f_rank_gt13.sh at the head" 1 \
		"$(grep -c 'score is not null' "$tmp/head/migrations/f_rank_gt13.sh" 2>/dev/null)"
	clone r3 face5b6264f805300d4ede99ba1295f2d5df39b0 && (cd "$tmp/r3" && sh migrate.sh) >/dev/null 2>&1
	same "R3: journal of a fresh install at face5b6, as PR-1's thread lists it" \
		"001_create_schema.sh|002_records_columns.sh|003_records_pk.sh|f_audit_ops8.sh|f_lookup_ops7.sh|f_rank_gt13.sh" \
		"$(lines < "$tmp/r3/data/applied.txt" 2>/dev/null)"
	printf '%s\n' 001_create_schema.sh 002_records_columns.sh 003_records_pk.sh f_audit_ops8.sh \
		f_lookup_ops7.sh f_rank_gt13.sh > "$tmp/r3/data/applied.txt"
	gm -C "$tmp/r3" checkout -q --detach origin/feature 2>/dev/null
	run r3 sh migrate.sh
	[ "$rc" -eq 0 ] && ! says 'defined rank' ||
		fail "R3: over the journal in PR-1's thread, migrate.sh at the head fails or prints 'defined rank' (exit $rc, output '$out')"

	# B2: d2cb15c renames and edits the audit script in one commit; git follows it.
	same "B2: rename in d2cb15c" "R061 migrations/f_audit_ops8.sh migrations/f_audit_gt13.sh" \
		"$(git -C "$tmp/head" show -M --name-status --format= d2cb15c1d3c6ad4b94bbaef8bd6c60a63752a12e 2>/dev/null | tr '\t' ' ' | lines)"
	same "B2: git log --follow of migrations/f_audit_gt13.sh" "d2cb15c1d3c6ad4b94bbaef8bd6c60a63752a12e $init" \
		"$(git -C "$tmp/head" log --follow --format=%H HEAD -- migrations/f_audit_gt13.sh 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"

	# B1: stacked sits on the initial commit with target's old GT-14 commits; a merge of
	# target conflicts in tests/steps.sh, and target's fetch_row breaks both new scenarios.
	same "B1: files in target...stacked" "tests/scenarios_fetch/by_id.sh tests/scenarios_fetch/by_status.sh tests/steps.sh" \
		"$(git -C "$A" diff --name-only target...stacked 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"
	if clone b1 origin/stacked; then
		same "B1: merge-base of stacked and target" $init "$(git -C "$tmp/b1" merge-base HEAD origin/target 2>/dev/null)"
		for s in by_id by_status; do
			run b1 sh "tests/scenarios_fetch/$s.sh"
			[ "$rc" -eq 0 ] || fail "B1: tests/scenarios_fetch/$s.sh fails at the stacked head (exit $rc, output '$out')"
		done
		gm -C "$tmp/b1" merge -q --no-ff --no-edit origin/target >/dev/null 2>&1
		rc=$?
		unmerged=$(git -C "$tmp/b1" diff --name-only --diff-filter=U 2>/dev/null | lines)
		[ "$rc" -ne 0 ] && [ "$unmerged" = tests/steps.sh ] ||
			fail "B1: the merge of target into stacked does not stop with tests/steps.sh unmerged (exit $rc, unmerged '$unmerged')"
		gm -C "$tmp/b1" checkout -q --theirs tests/steps.sh 2>/dev/null
		for s in by_id by_status; do
			run b1 sh "tests/scenarios_fetch/$s.sh"
			[ "$rc" -eq 1 ] ||
				fail "B1: tests/scenarios_fetch/$s.sh with target's tests/steps.sh exits $rc, not 1 (output '$out')"
		done
	else
		fail "B1: a clone of svc at stacked failed"
	fi

	# Isolation: every check ran in a temp copy, so svc is as built, ignored files included.
	heads "isolation: svc "
	same "isolation: svc status" "" "$(git -C "$A" status --porcelain --ignored 2>/dev/null | lines)"

	finish
	exit 0
fi

if [ "$name" = full ]; then
	mb=6b27db42e063b1881b90f0b4c277d0a8ce2f3ab3
	later=5a6d60c0a485e6a069f04e0f73f8dfedcb498ff2
	head=191e0ad183ea7509077bff3fd3b462d57d4b70e1
else
	mb=bd5d5e1e67a1fc55adeaa1452920245b1d368f7f
	later=26a0d2c212dea452164f51c60b31665043bb3b38
	if [ "$name" = solo ]; then
		head=0c23936980b254c4abd489d3ecfd296f5e7bc0db
	else
		head=6d2c9a58b52f0cd66760feefd29b1d1915d92045
	fi
fi

# Every fixture: merge-base, the base's later commit, the feature head.
same "app merge-base" "$mb" "$(git -C "$A" merge-base main feature 2>/dev/null)"
same "app commits on main since the merge-base" "$later add a count command" \
	"$(git -C "$A" log --format='%H %s' "$mb..main" 2>/dev/null)"
same "app feature head" "$head" "$(rev "$A" feature)"
same "app files changed on main since the merge-base" "README.md src/users.sh" \
	"$(git -C "$A" diff --name-only "$mb" main 2>/dev/null | tr '\n' ' ' | sed 's/ $//')"

# The base's later change shows as a removal only in the two-dot diff.
n3=$(git -C "$A" diff main...feature 2>/dev/null | grep -c '^-.*count_users')
n2=$(git -C "$A" diff main..feature 2>/dev/null | grep -c '^-.*count_users')
same "count_users removals in the three-dot diff" 0 "$n3"
same "count_users removals in the two-dot diff" 3 "$n2"

# Skipped test.
same "skipped test line" 'skip test_deactivate_keeps_row "flaky on CI, fix after release"' \
	"$(git -C "$A" show feature:tests/test_users.sh 2>/dev/null | grep '^skip ')"

case $name in
solo)
	same "app checkout branch" feature "$(git -C "$A" rev-parse --abbrev-ref HEAD 2>/dev/null)"
	;;
solo-dirty)
	same "app checkout branch" scratch-branch "$(git -C "$A" rev-parse --abbrev-ref HEAD 2>/dev/null)"
	same "symlink entry mode" 120000 \
		"$(git -C "$A" ls-tree feature links/outside 2>/dev/null | cut -d' ' -f1)"
	same "symlink target" /etc/hosts "$(git -C "$A" cat-file -p feature:links/outside 2>/dev/null)"
	same "app status" " M README.md|?? notes/" \
		"$(git -C "$A" status --porcelain 2>/dev/null | tr '\n' '|' | sed 's/|$//')"
	[ -f "$A/.test-output/results.txt" ] || fail "ignored file .test-output/results.txt is missing"
	[ ! -e "$F/filter-ran" ] || fail "filter-ran exists: $F/filter-ran"
	;;
full)
	same "MUST rule" 'main:style/shell-scripts.md:5:Every shell script MUST run `set -eu` before its first command.' \
		"$(git -C "$F/guidelines" grep -n MUST main 2>/dev/null)"
	same "legacy HEAD" 2f21951b0c72eba8ccf5b3db9b4481ade113f8bd "$(rev "$F/legacy" HEAD)"
	same "legacy main" b3b208f6b760091e46d601739e93d43ee9f0bce7 "$(rev "$F/legacy" main)"
	same "config/settings.ini bytes on feature" \
		5b6170705d0d0a6e616d653d75736572730d0a706167655f73697a653d3530300d0a6578706f72745f6b6579733d73686f72740d0a \
		"$(git -C "$A" show feature:config/settings.ini 2>/dev/null | od -An -tx1 | tr -d ' \n')"
	same "tickets touching src/output.sh" \
		"APP-5: audit log for commands|APP-4: short export keys as an option|APP-3: paginate the user list" \
		"$(git -C "$A" log --format=%s main..feature -- src/output.sh 2>/dev/null | tr '\n' '|' | sed 's/|$//')"
	;;
esac

# Handoff files (solo and solo-dirty): the five files exist, the handoff's hash and each
# verdicts file's heading hash are the literals in expected.md, and the claim count per
# kind from handoff.sh equals the literals there. manifest-working-tree.json exists too.
case $name in
solo | solo-dirty)
	hs=$(cd "$(dirname "$0")/../../.." && pwd)/plugins/audit/scripts/handoff.sh
	for f in handoff.md manifest-handoff.json manifest-scratch.json claims-verdicts.md \
		claims-verdicts-stale.md manifest-working-tree.json; do
		[ -f "$F/$f" ] || fail "$f is missing"
	done
	same "handoff.md hash" 36b30bd89b131ec1eed669ab0a0c58bbc9c5aaa8 \
		"$(git hash-object --no-filters "$F/handoff.md" 2>/dev/null)"
	same "claims-verdicts.md heading hash" 36b30bd89b131ec1eed669ab0a0c58bbc9c5aaa8 \
		"$(sed -n 's/^## .* (handoff), hash //p' "$F/claims-verdicts.md" 2>/dev/null)"
	same "claims-verdicts-stale.md heading hash" 0000000000000000000000000000000000000000 \
		"$(sed -n 's/^## .* (handoff), hash //p' "$F/claims-verdicts-stale.md" 2>/dev/null)"
	same "claims-verdicts.md entries" 5 "$(grep -c '^- claim ' "$F/claims-verdicts.md" 2>/dev/null)"
	grep -q '"claims": \["./handoff.md"\]' "$F/manifest-handoff.json" 2>/dev/null ||
		fail "manifest-handoff.json does not list ./handoff.md as claims"
	grep -q '"scratch": "./app/.test-output"' "$F/manifest-scratch.json" 2>/dev/null ||
		fail "manifest-scratch.json has no scratch key ./app/.test-output"
	grep -q '"head": "working-tree"' "$F/manifest-working-tree.json" 2>/dev/null ||
		fail "manifest-working-tree.json has no head key working-tree"
	if claims=$(sh "$hs" claims "$F/handoff.md" 2>&1); then
		same "handoff claim counts" "code=4 verification=2 decision=2 scope=1 status=2" \
			"$(printf '%s\n' "$claims" | awk -F'\t' '{ n[$1]++ } END { printf "code=%d verification=%d decision=%d scope=%d status=%d", n["code"], n["verification"], n["decision"], n["scope"], n["status"] }')"
		same "handoff claim total" 11 "$(printf '%s\n' "$claims" | wc -l | tr -d ' ')"
	else
		fail "handoff.sh claims failed: $claims"
	fi
	;;
esac

finish
