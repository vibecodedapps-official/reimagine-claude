# ground-truth.sh: the build of the ground-truth fixture. tests/audit/fixture/build.sh sources
# this file for `build.sh ground-truth` and uses its g, init, commit_at, and put helpers.
#
# One repo, svc: a small records import service in shell over CSV files. Branches: main,
# feature (checked out), gt-11-lookup, target, and stacked. Every commit has a fixed date.

# ---------------------------------------------------------------------------
# tests/steps.sh in parts, so each branch writes its own version.
# gt_steps <format old|dated|new|newdated> <by_status 0|1> <field 0|1> <read 0|1>
gt_steps() {
	cat <<'EOF'
#!/bin/sh
# steps.sh: shared steps for the scenarios. Source this file. The variables below are
# shared by every scenario that runs in the same process.

RECORDS=${RECORDS:-data/records.csv}
EOF
	case $1 in
	dated | newdated) echo 'DATES=${DATES:-data/dates.csv}' ;;
	esac
	if [ "$4" = 1 ]; then
		echo 'LAST_ROW='
	fi
	echo
	case $1 in
	old)
		cat <<'EOF'
# fetch_row <id>: print the record as id,name,status.
fetch_row() {
    awk -F, -v OFS=, -v id="$1" 'NR > 1 && $1 == id { print $1, $2, $3 }' "$RECORDS"
}
EOF
		;;
	dated)
		cat <<'EOF'
# fetch_row <id>: print the record as id,name,status,updated.
fetch_row() {
    updated=$(awk -F, -v id="$1" '$1 == id { print $3 }' "$DATES")
    awk -F, -v OFS=, -v id="$1" -v u="$updated" 'NR > 1 && $1 == id { print $1, $2, $3, u }' "$RECORDS"
}
EOF
		;;
	new)
		cat <<'EOF'
# fetch_row <id>: print the record as status=<status> id=<id>.
fetch_row() {
    awk -F, -v id="$1" 'NR > 1 && $1 == id { print "status=" $3 " id=" $1 }' "$RECORDS"
}
EOF
		;;
	newdated)
		cat <<'EOF'
# fetch_row <id>: print the record as status=<status> id=<id> updated=<date>.
fetch_row() {
    updated=$(awk -F, -v id="$1" '$1 == id { print $3 }' "$DATES")
    awk -F, -v id="$1" -v u="$updated" 'NR > 1 && $1 == id { print "status=" $3 " id=" $1 " updated=" u }' "$RECORDS"
}
EOF
		;;
	esac
	if [ "$3" = 1 ]; then
		echo
		echo 'FETCH_STATUS_FIELD=3'
	fi
	if [ "$2" = 1 ]; then
		cat <<'EOF'

# fetch_rows_by_status <status>: print the fetch_row line of every record with this status.
fetch_rows_by_status() {
    for id in $(awk -F, -v s="$1" 'NR > 1 && $3 == s { print $1 }' "$RECORDS"); do
        fetch_row "$id"
    done
}
EOF
	fi
	if [ "$4" = 1 ]; then
		cat <<'EOF'

# step_read_record <id>: read the record and keep its fetch_row line in LAST_ROW.
step_read_record() {
    LAST_ROW=$(fetch_row "$1")
}

# step_assert_active: check that the record read last has the status active.
step_assert_active() {
    if [ -z "$LAST_ROW" ]; then
        echo "run the read step first"
        return 1
    fi
    case $LAST_ROW in
    'status=active '*) return 0 ;;
    esac
    echo "record is not active: $LAST_ROW"
    return 1
}
EOF
	fi
}

# gt_links <direct_filter 0|1>: src/links.sh; the filter makes the direct arm skip
# targets that are not eligible.
gt_links() {
	cat <<'EOF'
#!/bin/sh
# links.sh: related links between records and targets. Source this file.

RELATIONS=${RELATIONS:-data/relations.csv}
VIA_A=${VIA_A:-data/via_a.csv}
VIA_B=${VIA_B:-data/via_b.csv}
TARGETS=${TARGETS:-data/targets.csv}

# eligible <target>: succeed when the target's status is active or pending.
eligible() {
    status=$(awk -F, -v t="$1" '$1 == t { print $2 }' "$TARGETS")
    case $status in
    active | pending) return 0 ;;
    esac
    return 1
}

# related_links <record>: print record,target for every target the record is linked to,
# directly and through type A and type B relations.
related_links() {
    rec=$1

    # Direct relations: one row per link in relations.csv.
    while IFS=, read -r from target; do
        [ "$from" = "$rec" ] || continue
EOF
	if [ "$1" = 1 ]; then
		echo '        eligible "$target" || continue'
	fi
	cat <<'EOF'
        printf '%s,%s\n' "$rec" "$target"
    done < "$RELATIONS"

    # Relations through type A: via_a.csv rows are record,target. A link is
    # reported once, even when the file lists it twice.
    seen=
    while IFS=, read -r from target; do
        [ "$from" = "$rec" ] || continue
        case " $seen " in
        *" $target "*) continue ;;
        esac
        seen="$seen $target"
        printf '%s,%s\n' "$rec" "$target"
    done < "$VIA_A"

    # Relations through type B: via_b.csv rows are record,target. Same reporting
    # as type A.
    seen=
    while IFS=, read -r from target; do
        [ "$from" = "$rec" ] || continue
        case " $seen " in
        *" $target "*) continue ;;
        esac
        seen="$seen $target"
        printf '%s,%s\n' "$rec" "$target"
    done < "$VIA_B"
}
EOF
}

# gt_handlers <contract 0|1>: src/handlers.sh; the contract endpoint is the seventh import.
gt_handlers() {
	cat <<'EOF'
#!/bin/sh
# handlers.sh <endpoint> <role> [args]: the service's endpoints. An import appends
# "<type>,<id>" to data/imported.csv, or to the file named by IMPORTED.
set -eu

IMPORTED=${IMPORTED:-data/imported.csv}

# enforce_import_right <role>: succeed for the roles that may import.
enforce_import_right() {
    case $1 in
    importer | admin) return 0 ;;
    esac
    echo "forbidden: role $1 may not import" >&2
    return 1
}

# write_record <type> <id>: append one imported record.
write_record() {
    printf '%s,%s\n' "$1" "$2" >> "$IMPORTED"
}

import_person() {
    enforce_import_right "$role" || return 1
    write_record person "$1"
}

import_org() {
    enforce_import_right "$role" || return 1
    write_record org "$1"
}

import_site() {
    enforce_import_right "$role" || return 1
    write_record site "$1"
}

import_study() {
    enforce_import_right "$role" || return 1
    write_record study "$1"
}

import_event() {
    enforce_import_right "$role" || return 1
    write_record event "$1"
}

import_document() {
    enforce_import_right "$role" || return 1
    write_record document "$1"
}
EOF
	if [ "$1" = 1 ]; then
		cat <<'EOF'

import_contract() {
    write_record contract "$1"
}
EOF
	fi
	cat <<'EOF'

# health: report that the service is up. It takes no record and writes nothing.
health() {
    echo ok
}

endpoint=${1:-}
role=${2:-}
if [ $# -ge 2 ]; then shift 2; else shift $#; fi

EOF
	if [ "$1" = 1 ]; then
		cat <<'EOF'
case $endpoint in
import_person | import_org | import_site | import_study | import_event | import_document | import_contract)
    "$endpoint" "$@"
    ;;
EOF
	else
		cat <<'EOF'
case $endpoint in
import_person | import_org | import_site | import_study | import_event | import_document)
    "$endpoint" "$@"
    ;;
EOF
	fi
	cat <<'EOF'
health) health ;;
*) echo "usage: handlers.sh <endpoint> <role> [args]" >&2; exit 2 ;;
esac
EOF
}

# gt_schema <type> <category plain|ref>: schemas/<type>.json.
gt_schema() {
	cat <<EOF
{
  "title": "$1",
  "type": "object",
EOF
	if [ "$2" = ref ]; then
		cat <<'EOF'
  "definitions": {
    "category_ref": {"type": "object", "properties": {"code": {"type": "string"}}}
  },
EOF
	fi
	cat <<'EOF'
  "properties": {
    "id": {"type": "string"},
EOF
	if [ "$2" = ref ]; then
		echo '    "category": {"$ref": "#/definitions/category_ref"}'
	else
		echo '    "category": {"type": "string"}'
	fi
	cat <<'EOF'
  }
}
EOF
}

# gt_spec <name> <kind Order|Invoice> <items 0|1> <public 0|1>: spec/<name>.yml, and the
# published copy under spec/public/. <items> says whether `items` is required.
gt_spec() {
	if [ "$4" = 1 ]; then
		echo "# $1.yml: the $2 document as published to API consumers."
	else
		echo "# $1.yml: the $2 document."
	fi
	cat <<EOF
$2:
  type: object
  required:
    - id
    - customer
EOF
	if [ "$3" = 1 ]; then
		echo '    - items'
	fi
	cat <<'EOF'
  properties:
    id: {type: string}
    customer: {type: string}
    items: {type: array}
EOF
}

# gt_validate <order items 0|1> <invoice items 0|1>: src/validate.sh.
gt_validate() {
	cat <<'EOF'
#!/bin/sh
# validate.sh <order|invoice> <field>...: check that the fields given for a document
# include every required one. Prints "valid", or "<field> is required" and exits 1.
set -eu

# required_for <kind>: print the required fields of a document kind.
required_for() {
    case $1 in
EOF
	if [ "$1" = 1 ]; then
		echo '    order) echo "id customer items" ;;'
	else
		echo '    order) echo "id customer" ;;'
	fi
	if [ "$2" = 1 ]; then
		echo '    invoice) echo "id customer items" ;;'
	else
		echo '    invoice) echo "id customer" ;;'
	fi
	cat <<'EOF'
    *) echo "unknown kind $1" >&2; exit 2 ;;
    esac
}

kind=${1:-}
[ $# -ge 1 ] && shift
fields=$(required_for "$kind") || exit 2
for field in $fields; do
    case " $* " in
    *" $field "*) ;;
    *)
        echo "$field is required"
        exit 1
        ;;
    esac
done
echo valid
EOF
}

# gt_validator <prefixed 0|1>: src/validator.sh.
gt_validator() {
	cat <<'EOF'
#!/bin/sh
# validator.sh validate <record file>: print one error per line for a record of
# key=value lines.
set -eu
. "$(dirname "$0")/messages.sh"

EOF
	if [ "$1" = 1 ]; then
		cat <<'EOF'
# report <field> <message>: print one error line, led by the field path.
report() {
    printf 'record.%s: %s\n' "$1" "$2"
}

validate() {
    f=$1
    grep -q '^id=.' "$f" || report id "$ID_REQUIRED"
    grep -q '^flag=.' "$f" || report flag "$FLAG_REQUIRED"
EOF
	else
		cat <<'EOF'
validate() {
    f=$1
    grep -q '^id=.' "$f" || echo "$ID_REQUIRED"
    grep -q '^flag=.' "$f" || echo "$FLAG_REQUIRED"
EOF
	fi
	cat <<'EOF'
    name=$(sed -n 's/^name=//p' "$f")
    if [ "${#name}" -gt 40 ]; then
        printf "$NAME_TOO_LONG\n" 40
    fi
}

case ${1:-} in
validate) shift; validate "$@" ;;
*) echo "usage: validator.sh validate <record file>" >&2; exit 2 ;;
esac
EOF
}

# gt_fn <name> <key> <description> <definition> [note]: a function script under
# migrations/ that stores the definition of <key> in data/functions.txt.
gt_fn() {
	cat <<EOF
#!/bin/sh
# $1: define the $2 function: $3.
set -eu

f=\${FUNCTIONS_FILE:-data/functions.txt}
tmp=\$f.tmp
touch "\$f"

EOF
	if [ -n "${5:-}" ]; then
		echo "# $5"
	fi
	cat <<EOF
# The definitions live in one file, one "<name>: <statement>" line each. A function
# script replaces only its own line, so it can run against any state of the file.
# Replace the stored definition, then record it.
grep -v '^$2:' "\$f" > "\$tmp" || true
echo "$2: $4" >> "\$tmp"
mv "\$tmp" "\$f"
echo "defined $2"
EOF
}

# gt_rank <guard 0|1> <name>: migrations/f_rank_<n>.sh.
gt_rank() {
	if [ "$1" = 1 ]; then
		gt_fn "$2" rank "the position of each record by score" "select id, rank() over (order by score desc) from records where score is not null"
	else
		gt_fn "$2" rank "the position of each record by score" "select id, rank() over (order by score desc) from records"
	fi
}

# gt_lookup <name> <select>: migrations/f_lookup_<n>.sh.
gt_lookup() {
	gt_fn "$1" lookup "the record id for a hrn" "$2"
}

# gt_pk <renamed 0|1>: the records key migration; renamed also adds the office columns.
gt_pk() {
	if [ "$1" = 1 ]; then
		echo '#!/bin/sh'
		echo '# 003_records_pk_and_columns.sh: make the records key (id, type) and add the office columns.'
	else
		echo '#!/bin/sh'
		echo '# 003_records_pk.sh: make the records key (id, type).'
	fi
	cat <<'EOF'
set -eu

f=${SCHEMA_FILE:-data/schema.txt}
tmp=$f.tmp

# The schema file lists the key as "pk: <columns>". Drop the current line, then add
# the new key at the end, so the file always holds exactly one key line. The other
# lines of the file keep their order, and the file is replaced in one step, so an
# interrupted run leaves the old file in place.
grep -v '^pk:' "$f" > "$tmp"
echo 'pk: id,type' >> "$tmp"
mv "$tmp" "$f"
echo "rebuilt pk"
EOF
	if [ "$1" = 1 ]; then
		cat <<'EOF'

# The office columns go at the end of the columns line.
sed 's/^columns: .*/&,office,office_code/' "$f" > "$tmp"
mv "$tmp" "$f"
EOF
	fi
}

# gt_audit <name> <variant old|new>: migrations/f_audit_<n>.sh.
gt_audit() {
	if [ "$2" = old ]; then
		gt_fn "$1" audit "the events of a record" "select event from audit where id = ?"
	else
		gt_fn "$1" audit "the events of a record with their hrn" "select hrn, event from audit where id = ? order by hrn" "Events are listed by hrn, so a record always reads in the same order."
	fi
}

# gt_bulk <settings 0|1>: src/bulk_import.sh; with settings, the rules follow the
# tenant's settings.
gt_bulk() {
	cat <<'EOF'
#!/bin/sh
# bulk_import.sh <file>: import the records of a batch file (id,name,flag,office,
# office_code) into data/records.csv. The batch goes into a staging copy that replaces
# records.csv once every record is in.
set -eu
here=$(dirname "$0")
. "$here/settings.sh"
. "$here/rules.sh"

records=${RECORDS_FILE:-data/records.csv}
stage=$records.stage
tenant=${APP_TENANT:-acme}

fail() {
    echo "bulk import failed: $1" >&2
    exit 1
}

trap 'rm -f "$stage"' EXIT
cp "$records" "$stage"

EOF
	if [ "$1" = 1 ]; then
		cat <<'EOF'
require_flag=$(get_setting require_flag) || fail "settings are not available"
require_office=$(get_setting require_office) || fail "settings are not available"
settings="require_flag=$require_flag require_office=$require_office"
EOF
	else
		echo 'settings=null'
	fi
	cat <<'EOF'

while IFS= read -r line; do
    errors=$(check "$settings" "$line")
    if [ -n "$errors" ]; then
        fail "$errors"
    fi
    printf '%s\n' "$line" | awk -F, -v t="$tenant" '{ print $1 "," $2 ",active," t }' >> "$stage"
done < "$1"

mv "$stage" "$records"
echo "imported"
EOF
}

# gt_sql_contract <touch 0|1> <guard 0|1> <order 0|1>: tests/test_sql_contract.sh.
gt_sql_contract() {
	cat <<'EOF'
#!/bin/sh
# Contract tests for the files under sql/. run-tests.sh runs this file from the repo root.
set -eu

# unguarded_notify <file>: succeed when a notify_ call is not the line after an if.
unguarded_notify() {
    ! awk '/perform notify_/ { if (prev !~ /^[ \t]*if /) bad = 1 } { prev = $0 } END { exit bad }' "$1"
}

run() {
    "$1"
    echo "pass $1"
}

test_stamp_returns_the_row() {
    grep -qi 'returning' sql/fn_stamp.sql
}

test_stamp_has_no_null_placeholder() {
    if grep -qi ':= null' sql/fn_stamp.sql; then
        return 1
    fi
}

test_stamp_notifies_nobody() {
    if unguarded_notify sql/fn_stamp.sql; then
        return 1
    fi
}
EOF
	if [ "$1" = 1 ]; then
		cat <<'EOF'

test_touch_returns_the_row() {
    grep -qi 'returning' sql/fn_touch.sql
}
EOF
	fi
	if [ "$2" = 1 ]; then
		cat <<'EOF'

test_guard_checks_before_notify() {
    if unguarded_notify sql/fn_guard.sql; then
        return 1
    fi
}
EOF
	fi
	if [ "$3" = 1 ]; then
		cat <<'EOF'

test_order_header_before_lines() {
    awk '/insert into order_header/ { h = NR } /insert into order_lines/ { l = NR } END { exit !(h && l && h < l) }' sql/fn_order.sql
}
EOF
	fi
	echo
	echo 'run test_stamp_returns_the_row'
	echo 'run test_stamp_has_no_null_placeholder'
	echo 'run test_stamp_notifies_nobody'
	if [ "$1" = 1 ]; then echo 'run test_touch_returns_the_row'; fi
	if [ "$2" = 1 ]; then echo 'run test_guard_checks_before_notify'; fi
	if [ "$3" = 1 ]; then echo 'run test_order_header_before_lines'; fi
}

# ---------------------------------------------------------------------------
# The base: the first commit holds the service as it was when the tests were written.
gt_first_commit() {
	put svc/.gitignore <<'EOF'
.test-output/
data/applied.txt
data/schema.txt
data/functions.txt
EOF
	put svc/run-tests.sh <<'EOF'
#!/bin/sh
# run-tests.sh: run every tests/test_*.sh from the repo root and write the results
# to .test-output/results.txt.
set -eu

mkdir -p .test-output
out=.test-output/results.txt
: > "$out"
fail=0
for t in tests/test_*.sh; do
    if sh "$t" >> "$out" 2>&1; then
        echo "ok $t" >> "$out"
    else
        echo "FAIL $t" >> "$out"
        fail=1
    fi
done
cat "$out"
exit "$fail"
EOF
	put svc/migrate.sh <<'EOF'
#!/bin/sh
# migrate.sh: apply migrations/*.sh in name order. Each applied name goes in the journal,
# data/applied.txt, and a name already in the journal is skipped.
set -eu

journal=data/applied.txt
mkdir -p data
touch "$journal"
for m in migrations/*.sh; do
    name=$(basename "$m")
    if grep -qx "$name" "$journal"; then
        continue
    fi
    sh "$m"
    echo "$name" >> "$journal"
    echo "applied $name"
done
EOF
	put svc/migrations/001_create_schema.sh <<'EOF'
#!/bin/sh
# 001_create_schema.sh: create the schema file, with the records key on id, when it is absent.
set -eu

f=${SCHEMA_FILE:-data/schema.txt}
if [ ! -f "$f" ]; then
    mkdir -p "$(dirname "$f")"
    printf 'table: records\npk: id\n' > "$f"
fi
EOF
	put svc/migrations/002_records_columns.sh <<'EOF'
#!/bin/sh
# 002_records_columns.sh: list the records columns in the schema file.
set -eu

f=${SCHEMA_FILE:-data/schema.txt}
if ! grep -q '^columns:' "$f"; then
    echo 'columns: id,type,name,status,tenant' >> "$f"
fi
EOF
	gt_lookup f_lookup_ops7.sh 'select id from audit where hrn = ?' | put svc/migrations/f_lookup_ops7.sh
	gt_rank 0 f_rank_ops9.sh | put svc/migrations/f_rank_ops9.sh
	gt_audit f_audit_ops8.sh old | put svc/migrations/f_audit_ops8.sh

	gt_links 0 | put svc/src/links.sh
	put svc/src/importer.sh <<'EOF'
#!/bin/sh
# importer.sh import <record>: import a record unless one of its related links points at
# a target that is not eligible.
set -eu
. "$(dirname "$0")/links.sh"

import_record() {
    rec=$1
    blocked=$(related_links "$rec" | while IFS=, read -r _ target; do
        eligible "$target" || echo "$target"
    done)
    if [ -n "$blocked" ]; then
        echo "rejected $rec"
        return 1
    fi
    echo "imported $rec"
}

case ${1:-} in
import) shift; import_record "$@" ;;
*) echo "usage: importer.sh import <record>" >&2; exit 2 ;;
esac
EOF
	gt_handlers 0 | put svc/src/handlers.sh
	put svc/src/upsert.sh <<'EOF'
#!/bin/sh
# upsert.sh <command> <id> <name> <source_id>: create or update a row of data/<type>.csv,
# whose rows are id,name,source_id. Commands: upsert_person, upsert_org, upsert_site.
set -eu

DATA=${DATA_DIR:-data}
DB_ACCOUNT=${DB_ACCOUNT:-svc_writer}

# row_exists <type> <id>: succeed when the table has a row with this id.
row_exists() {
    awk -F, -v id="$2" '$1 == id { found = 1 } END { exit !found }' "$DATA/$1.csv"
}

# current_source <type> <id>: print the stored source_id.
current_source() {
    awk -F, -v id="$2" '$1 == id { print $3 }' "$DATA/$1.csv"
}

# put_row <type> <id> <name> <source_id>: replace the row with this id, or append it.
put_row() {
    f=$DATA/$1.csv
    tmp=$f.tmp
    awk -F, -v OFS=, -v id="$2" -v name="$3" -v src="$4" '
        $1 == id { print id, name, src; found = 1; next }
        { print }
        END { if (!found) print id, name, src }' "$f" > "$tmp"
    mv "$tmp" "$f"
    echo "wrote $1 $2 as $DB_ACCOUNT"
}

# upsert_person <id> <name> <source_id>: keep the stored source_id when the incoming one is empty.
upsert_person() {
    src=$3
    if [ -z "$src" ]; then
        src=$(current_source person "$1")
    fi
    put_row person "$1" "$2" "$src"
}

# upsert_org <id> <name> <source_id>: keep the stored source_id when the incoming one is empty.
upsert_org() {
    src=$3
    if [ -z "$src" ]; then
        src=$(current_source org "$1")
    fi
    put_row org "$1" "$2" "$src"
}

# upsert_site <id> <name> <source_id>: write the incoming source_id on update.
upsert_site() {
    if row_exists site "$1"; then
        put_row site "$1" "$2" "$3"
    else
        put_row site "$1" "$2" ""
    fi
}

case ${1:-} in
upsert_person | upsert_org | upsert_site)
    cmd=$1
    shift
    "$cmd" "$@"
    ;;
*) echo "usage: upsert.sh <command> <id> <name> <source_id>" >&2; exit 2 ;;
esac
EOF
	gt_validate 1 1 | put svc/src/validate.sh
	put svc/src/messages.sh <<'EOF'
#!/bin/sh
# messages.sh: validation messages. Source this file.
ID_REQUIRED='id is required'
FLAG_REQUIRED='flag is required'
NAME_TOO_LONG='name is longer than %s characters'
EOF
	gt_validator 0 | put svc/src/validator.sh
	put svc/src/settings.sh <<'EOF'
#!/bin/sh
# settings.sh: tenant settings. Source this file. The settings are name=value lines in
# data/settings.cache, or in the file named by SETTINGS_CACHE.

SETTINGS_CACHE=${SETTINGS_CACHE:-data/settings.cache}

# read_cache: print the cache, or one error line on stderr.
read_cache() {
    if [ ! -e "$SETTINGS_CACHE" ]; then
        echo "cache unavailable" >&2
        return 1
    fi
    if [ -e "$SETTINGS_CACHE.lock" ]; then
        echo "cache timeout" >&2
        return 1
    fi
    cat "$SETTINGS_CACHE"
}

# get_setting <name>: print the value of a setting. A cache that is unavailable or
# times out stops the caller with status 2; any other read error gives an empty value.
get_setting() {
    if ! out=$(read_cache 2>&1); then
        case $out in
        *'cache timeout'* | *'cache unavailable'*)
            echo "$out" >&2
            return 2
            ;;
        *)
            echo
            return 0
            ;;
        esac
    fi
    printf '%s\n' "$out" | sed -n "s/^$1=//p"
}
EOF
	put svc/src/rules.sh <<'EOF'
#!/bin/sh
# rules.sh: the batch import rules. Source this file.
#
# check <settings> <record line>: print one error per failed rule for a record line
# (id,name,flag,office,office_code). <settings> is "null", which turns every rule on,
# or name=yes pairs separated by blanks.

# enabled <settings> <key>: succeed when the rule keyed on <key> applies.
enabled() {
    case $1 in
    null) return 0 ;;
    esac
    case " $1 " in
    *" $2=yes "*) return 0 ;;
    esac
    return 1
}

check() {
    settings=$1
    IFS=, read -r id name flag office office_code <<EOL
$2
EOL
    if enabled "$settings" require_flag && [ -z "$flag" ]; then
        echo "flag is required"
    fi
    if enabled "$settings" require_office && [ -z "$office" ]; then
        echo "office is required"
    fi
    if enabled "$settings" require_office && [ -n "$office" ] && [ -z "$office_code" ]; then
        echo "office_code is required"
    fi
}
EOF
	gt_bulk 0 | put svc/src/bulk_import.sh
	put svc/src/store.sh <<'EOF'
#!/bin/sh
# store.sh fetch <id>: print the data/records.csv row with this id. Rows are visible
# per tenant: APP_TENANT names the tenant whose rows come back.
set -eu

RECORDS=${RECORDS:-data/records.csv}

fetch() {
    if [ -z "${APP_TENANT:-}" ]; then
        return 0
    fi
    awk -F, -v id="$1" -v t="$APP_TENANT" 'NR > 1 && $1 == id && $4 == t { print }' "$RECORDS"
}

case ${1:-} in
fetch) shift; fetch "$@" ;;
*) echo "usage: store.sh fetch <id>" >&2; exit 2 ;;
esac
EOF

	put svc/data/relations.csv <<'EOF'
K1,X1
K3,X2
EOF
	put svc/data/via_a.csv <<'EOF'
K4,X3
EOF
	put svc/data/via_b.csv <<'EOF'
K2,X9
EOF
	put svc/data/targets.csv <<'EOF'
X1,active
X2,rejected
X3,pending
X9,rejected
EOF
	put svc/data/imported.csv <<'EOF'
person,100
EOF
	put svc/data/person.csv <<'EOF'
1,Ada,src-1
EOF
	put svc/data/org.csv <<'EOF'
1,Acme,src-1
EOF
	put svc/data/site.csv <<'EOF'
1,North,src-1
EOF
	put svc/data/records.csv <<'EOF'
id,name,status,tenant
1,Ada,active,acme
2,Grace,active,acme
3,Linus,inactive,acme
EOF
	put svc/data/dates.csv <<'EOF'
1,2026-06-02,2026-08-10
2,2026-06-02,2026-08-11
3,2026-06-03,2026-08-12
EOF
	put svc/data/audit.csv <<'EOF'
id,hrn,event
1,hrn-0001,created
2,hrn-0002,updated
3,hrn-0003,created
EOF
	put svc/data/settings.cache <<'EOF'
require_flag=yes
require_office=yes
EOF

	gt_schema person plain | put svc/schemas/person.json
	gt_schema org plain | put svc/schemas/org.json
	gt_schema site plain | put svc/schemas/site.json
	gt_schema study plain | put svc/schemas/study.json
	gt_spec orders Order 1 0 | put svc/spec/orders.yml
	gt_spec invoices Invoice 1 0 | put svc/spec/invoices.yml
	gt_spec orders Order 1 1 | put svc/spec/public/orders.yml
	gt_spec invoices Invoice 1 1 | put svc/spec/public/invoices.yml

	put svc/sql/fn_stamp.sql <<'EOF'
-- fn_stamp: stamp a record with the current time.
create or replace function stamp_record(p_id integer) returns timestamptz as $$
declare
    v_at timestamptz;
begin
    update records set stamped_at = now() where id = p_id returning stamped_at into v_at;
    return v_at;
end;
$$ language plpgsql;
EOF
	put svc/sql/fn_touch.sql <<'EOF'
-- fn_touch: set updated_at on a record.
create or replace function touch_record(p_id integer) returns void as $$
begin
    update records set updated_at = now() where id = p_id;
end;
$$ language plpgsql;
EOF
	put svc/sql/trg_reread_json.sql <<'EOF'
-- trg_reread_json: keep the flag column in step with the payload.
create or replace function sync_flag() returns trigger as $$
begin
    new.flag := new.payload ->> 'flag';
    return new;
end;
$$ language plpgsql;

create trigger records_sync_flag before insert or update on records
    for each row execute function sync_flag();
EOF
	put svc/sql/fn_order.sql <<'EOF'
-- fn_order: create an order with its lines.
create or replace function create_order(p_customer integer, p_items jsonb) returns integer as $$
declare
    v_id integer;
begin
    insert into order_lines (order_id, item) select v_id, value from jsonb_array_elements(p_items);
    insert into order_header (customer) values (p_customer) returning id into v_id;
    return v_id;
end;
$$ language plpgsql;
EOF
	put svc/sql/fn_guard.sql <<'EOF'
-- fn_guard: notify listeners after an order changes.
create or replace function order_changed(p_id integer, p_notify boolean) returns void as $$
begin
    perform notify_order(p_id);
end;
$$ language plpgsql;
EOF
	gt_sql_contract 0 0 0 | put svc/tests/test_sql_contract.sh

	put svc/tests/test_import_rights.sh <<'EOF'
#!/bin/sh
# Tests for the import endpoints in src/handlers.sh. run-tests.sh runs this file from the
# repo root.
set -eu

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
IMPORTED=$work/imported.csv
export IMPORTED
: > "$IMPORTED"

for endpoint in import_person import_org import_site import_study import_event import_document; do
    if sh src/handlers.sh "$endpoint" viewer k1 2>/dev/null; then
        echo "FAIL $endpoint accepted the viewer role"
        exit 1
    fi
    sh src/handlers.sh "$endpoint" importer k1
    echo "pass $endpoint"
done
[ "$(wc -l < "$IMPORTED" | tr -d ' ')" = 6 ]
EOF

	put svc/tests/lib.sh <<'EOF'
#!/bin/sh
# lib.sh: assertions for the scenarios. Source this file.

# assert_eq <expected> <actual> <label>: print "ok <label>", or print the difference and
# exit 1.
assert_eq() {
    if [ "$1" = "$2" ]; then
        echo "ok $3"
    else
        echo "FAIL $3: expected '$1', got '$2'"
        exit 1
    fi
}
EOF
	gt_steps old 0 0 0 | put svc/tests/steps.sh
	put svc/tests/connection.sh <<'EOF'
#!/bin/sh
# connection.sh: connection strings for the database steps. Source this file.

# connection_string <role> <secret>: build the connection string for a role.
connection_string() {
    printf 'Host=%s;Database=%s;Username=%s;Password=%s' "${DB_HOST:-localhost}" "${DB_NAME:-svc}" "$1" "$2"
}

# log_connection <role> <secret>: print the connection string with the password masked.
log_connection() {
    connection_string "$1" "$2" | sed 's/Password=.*/Password=********/'
    echo
}
EOF
	put svc/tests/dbclient.sh <<'EOF'
#!/bin/sh
# dbclient.sh <statement> [param]: run "select <columns> from <table> where <column> = <value>"
# against data/<table>.csv, whose first line names the columns. The value is a '...' literal
# (a doubled quote stands for one quote) or ?, which takes the param.
set -eu

stmt=$1
param=${2:-}
cols=$(printf '%s\n' "$stmt" | sed -n 's/^select \(.*\) from [a-z_]* where .*/\1/p')
table=$(printf '%s\n' "$stmt" | sed -n 's/^select .* from \([a-z_]*\) where .*/\1/p')
col=$(printf '%s\n' "$stmt" | sed -n 's/^select .* from [a-z_]* where \([a-z_]*\) = .*/\1/p')
value=$(printf '%s\n' "$stmt" | sed -n 's/^select .* from [a-z_]* where [a-z_]* = //p')
case $value in
'?') value=$param ;;
\'*\')
    value=${value#\'}
    value=${value%\'}
    value=$(printf '%s\n' "$value" | sed "s/''/'/g")
    ;;
*)
    echo "dbclient: cannot read the value in: $stmt" >&2
    exit 1
    ;;
esac

awk -F, -v cols="$cols" -v col="$col" -v val="$value" '
NR == 1 { for (i = 1; i <= NF; i++) idx[$i] = i; next }
$(idx[col]) == val {
    n = split(cols, c, ",")
    line = ""
    for (i = 1; i <= n; i++) line = line (i > 1 ? "," : "") $(idx[c[i]])
    print line
}' "data/$table.csv"
EOF
	put svc/tests/steps_db.sh <<'EOF'
#!/bin/sh
# steps_db.sh: database steps. Source this file from the repo root. The database is the
# CSV tables under data/, queried through tests/dbclient.sh.

. tests/connection.sh

ENV=${ENV:-dev}
ACCOUNTS=env/$ENV/accounts.txt

# account_for <role>: print the secret reference of a role in this environment's accounts file.
account_for() {
    ref=$(awk -v r="$1" '$1 == r { print $2 }' "$ACCOUNTS")
    if [ -z "$ref" ]; then
        echo "accounts file $ACCOUNTS has no role $1" >&2
        return 1
    fi
    echo "$ref"
}

# run_sql <statement> [param]: send one statement to the database client.
run_sql() {
    sh tests/dbclient.sh "$1" "${2:-}"
}

# query_param <statement> <value>: run a statement whose ? is bound to the value.
query_param() {
    run_sql "$1" "$2"
}

# read_as <role> <statement> [value]: run a statement as one of the environment's roles.
read_as() {
    ref=$(account_for "$1") || return 1
    log_connection "$1" "$ref" >&2
    shift
    if [ $# -ge 2 ]; then
        query_param "$@"
    else
        run_sql "$1"
    fi
}

# step_audit_event <id>: print the event of an audit row, as api_user.
step_audit_event() {
    read_as api_user 'select event from audit where id = ?' "$1"
}
EOF
	put svc/tests/hook.sh <<'EOF'
#!/bin/sh
# hook.sh <scenario file>: print "skip <scenario>" when the scenario names a role, in a
# "# requires-role: <name>" line, that env/<ENV>/accounts.txt does not list.
set -eu

f=$1
accounts=env/${ENV:-dev}/accounts.txt
for role in $(sed -n 's/^# requires-role: //p' "$f"); do
    if ! grep -q "^$role " "$accounts"; then
        n=${f#tests/}
        echo "skip ${n%.sh}"
        exit 0
    fi
done
EOF
	put svc/tests/run_scenarios.sh <<'EOF'
#!/bin/sh
# run_scenarios.sh [name...]: run scenarios from the repo root; ENV picks
# env/<ENV>/accounts.txt, dev by default.
# A name is a scenario file, tests/scenario_<name>.sh, run as its own process once
# hook.sh allows it, or a function of tests/scenarios_steps.sh, run in this process.
# With no names, every scenario file runs, then the functions in file order.
set -u

. tests/steps.sh
. tests/scenarios_steps.sh

ENV=${ENV:-dev}
export ENV
fail=0

run_file() {
    note=$(sh tests/hook.sh "tests/scenario_$1.sh")
    if [ -n "$note" ]; then
        echo "$note"
        return 0
    fi
    if sh "tests/scenario_$1.sh"; then
        echo "pass $1"
    else
        echo "FAIL $1"
        fail=1
    fi
}

run_fn() {
    if "$1"; then
        echo "pass $1"
    else
        echo "FAIL $1"
        fail=1
    fi
}

if [ $# -eq 0 ]; then
    for f in tests/scenario_*.sh; do
        n=${f#tests/scenario_}
        run_file "${n%.sh}"
    done
    set -- $(sed -n 's/^\(scenario_[a-z_]*\)().*/\1/p' tests/scenarios_steps.sh)
fi
for name in "$@"; do
    case $name in
    scenario_*) run_fn "$name" ;;
    *) run_file "$name" ;;
    esac
done
exit "$fail"
EOF
	gt_scenarios_steps 0 | put svc/tests/scenarios_steps.sh
	put svc/tests/scenario_audit_event.sh <<'EOF'
#!/bin/sh
# scenario_audit_event.sh: the first audit row records a creation.
# requires-role: api_user
set -eu
. tests/lib.sh
. tests/steps_db.sh

assert_eq created "$(step_audit_event 1)" "audit event of row 1"
EOF
	put svc/env/dev/accounts.txt <<'EOF'
svc_writer vault:svc-writer
api_user vault:api-user
EOF
	put svc/env/qa/accounts.txt <<'EOF'
svc_writer vault:svc-writer
api_user vault:api-user
EOF
}

# gt_scenarios_steps <read 0|1>: tests/scenarios_steps.sh.
gt_scenarios_steps() {
	cat <<'EOF'
#!/bin/sh
# scenarios_steps.sh: scenarios written as functions. tests/run_scenarios.sh sources this
# file and runs them in one process.

# scenario_record_count: the records table lists three records.
scenario_record_count() {
    [ "$(wc -l < "$RECORDS" | tr -d ' ')" = 4 ]
}
EOF
	if [ "$1" = 1 ]; then
		cat <<'EOF'

# scenario_read_active: read an active record, then check its status.
scenario_read_active() {
    step_read_record 1 && step_assert_active
}

# scenario_assert_only: run the status check.
scenario_assert_only() {
    step_assert_active
}
EOF
	fi
}

# ---------------------------------------------------------------------------
# The build. Dates are fixed: the first commit is the older main point the stacked branch
# is cut from; the base of the feature is the last commit before it.
build_ground_truth() {
	init svc
	gt_first_commit
	commit_at svc 2026-06-01 "initial records import service"
	gt_old=$(g -C "$T/svc" rev-parse HEAD)

	gt_schema study plain | sed 's/^  "type": "object",$/  "type": "object",\n  "description": "A study and the sites that run it.",/; s/^    "category": {"type": "string"}$/&,/' | put svc/schemas/study.json
	commit_at svc 2026-06-22 "schemas: describe the study fields"

	gt_steps new 0 0 0 | put svc/tests/steps.sh
	commit_at svc 2026-07-10 "steps: print the status first in fetch_row"

	gt_validate 0 1 | put svc/src/validate.sh
	gt_spec orders Order 0 0 | put svc/spec/orders.yml
	gt_spec orders Order 0 1 | put svc/spec/public/orders.yml
	commit_at svc 2026-07-15 "GT-0: stop requiring items on orders"

	gt_pk 0 | put svc/migrations/003_records_pk.sh
	commit_at svc 2026-07-28 "migrations: make the records key (id, type)"

	put svc/README.md <<'EOF'
# svc

A small records import service in shell. Records, their relations, and the lookup tables
are CSV files under `data/`.

## Commands

    sh src/importer.sh import <record>
    sh src/handlers.sh <endpoint> <role> [args]
    sh src/bulk_import.sh <file>
    sh migrate.sh

## Tests

    sh run-tests.sh
    sh tests/run_scenarios.sh
EOF
	commit_at svc 2026-08-14 "docs: describe the commands"

	gt_feature
	gt_main_after
	gt_other_pr
	gt_stack
	g -C "$T/svc" checkout -q feature
}

gt_feature() {
	g -C "$T/svc" checkout -q -b feature

	gt_handlers 1 | put svc/src/handlers.sh
	commit_at svc 2026-08-17 "GT-1: add the contract import endpoint"

	g -C "$T/svc" mv migrations/f_rank_ops9.sh migrations/f_rank_gt13.sh
	gt_rank 0 f_rank_gt13.sh | put svc/migrations/f_rank_gt13.sh
	commit_at svc 2026-08-18 "GT-13: rename the rank function script"

	put svc/src/waiver.sh <<'EOF'
#!/bin/sh
# waiver.sh: read validation errors on stdin and print them without the flag error.
set -eu
. "$(dirname "$0")/messages.sh"

grep -vxF "$FLAG_REQUIRED" || true
EOF
	put svc/tests/test_waiver.sh <<'EOF'
#!/bin/sh
# Tests for src/waiver.sh. run-tests.sh runs this file from the repo root.
set -eu
. src/messages.sh

test_waiver_removes_the_flag_error() {
    out=$(printf '%s\n' "$FLAG_REQUIRED" | sh src/waiver.sh)
    [ -z "$out" ]
}

test_waiver_keeps_other_errors() {
    out=$(printf '%s\n%s\n' "$ID_REQUIRED" "$FLAG_REQUIRED" | sh src/waiver.sh)
    [ "$out" = "$ID_REQUIRED" ]
}

test_waiver_removes_the_flag_error
echo "pass test_waiver_removes_the_flag_error"
test_waiver_keeps_other_errors
echo "pass test_waiver_keeps_other_errors"
EOF
	put svc/tests/scenario_bulk.sh <<'EOF'
#!/bin/sh
# scenario_bulk.sh: a record without a flag goes through the validator and the
# waiver.
set -eu

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
printf 'id=7\nname=Edsger\n' > "$work/record"

errors=$(sh src/validator.sh validate "$work/record" | sh src/waiver.sh)
if [ -z "$errors" ] || printf '%s\n' "$errors" | grep -q 'flag is required'; then
    echo "ok bulk record"
else
    echo "FAIL bulk record: $errors"
    exit 1
fi
EOF
	commit_at svc 2026-08-19 "GT-7: waive the flag error in bulk imports"

	gt_links 1 | put svc/src/links.sh
	put svc/src/sweep.sh <<'EOF'
#!/bin/sh
# sweep.sh: print "dropped <record>,<target>" for every direct relation whose target is
# not eligible.
set -eu
. "$(dirname "$0")/links.sh"

while IFS=, read -r rec target; do
    eligible "$target" || echo "dropped $rec,$target"
done < "$RELATIONS"
EOF
	commit_at svc 2026-08-21 "GT-2: skip ineligible targets in related links"

	gt_schema person ref | put svc/schemas/person.json
	gt_schema org ref | put svc/schemas/org.json
	put svc/tests/test_schemas.sh <<'EOF'
#!/bin/sh
# Tests for the person and org schemas. run-tests.sh runs this file from the repo root.
set -eu

for type in person org; do
    grep -qF '"$ref": "#/definitions/category_ref"' "schemas/$type.json"
    echo "pass $type category reference"
done
EOF
	commit_at svc 2026-08-22 "GT-3: use the category reference in the person and org schemas"

	sed 's/put_row site "\$1" "\$2" ""/put_row site "$1" "$2" "$3"/' "$T/svc/src/upsert.sh" > "$T/upsert.sh.new"
	mv "$T/upsert.sh.new" "$T/svc/src/upsert.sh"
	put svc/tests/test_upsert_site.sh <<'EOF'
#!/bin/sh
# Tests for upsert_site in src/upsert.sh. run-tests.sh runs this file from the repo root.
set -eu

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
DATA_DIR=$work
export DATA_DIR
: > "$work/site.csv"

test_create_writes_source_id() {
    sh src/upsert.sh upsert_site 1 North src-1 > /dev/null
    grep -q '^1,North,src-1$' "$work/site.csv"
}

test_update_replaces_source_id() {
    sh src/upsert.sh upsert_site 1 North '' > /dev/null
    grep -q '^1,North,$' "$work/site.csv"
}

test_create_writes_source_id
echo "pass test_create_writes_source_id"
test_update_replaces_source_id
echo "pass test_update_replaces_source_id"
EOF
	commit_at svc 2026-08-24 "GT-4: write source_id when a site is created"

	gt_validate 0 0 | put svc/src/validate.sh
	commit_at svc 2026-08-26 "GT-5: make items optional for invoices"

	put svc/sql/fn_touch.sql <<'EOF'
-- fn_touch: set updated_at on a record and return it.
create or replace function touch_record(p_id integer) returns timestamptz as $$
declare
    v_at timestamptz;
begin
    update records set updated_at = now() where id = p_id returning updated_at into v_at;
    return v_at;
end;
$$ language plpgsql;
EOF
	put svc/sql/trg_reread_json.sql <<'EOF'
-- trg_reread_json: keep the flag column in step with the payload.
create or replace function sync_flag() returns trigger as $$
begin
    if jsonb_typeof(new.payload -> 'flag') = 'null' then
        new.flag := old.flag;
    else
        new.flag := new.payload ->> 'flag';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger records_sync_flag before insert or update on records
    for each row execute function sync_flag();
EOF
	put svc/sql/fn_order.sql <<'EOF'
-- fn_order: create an order with its lines.
create or replace function create_order(p_customer integer, p_items jsonb) returns integer as $$
declare
    v_id integer;
begin
    insert into order_header (customer) values (p_customer) returning id into v_id;
    insert into order_lines (order_id, item) select v_id, value from jsonb_array_elements(p_items);
    return v_id;
end;
$$ language plpgsql;
EOF
	put svc/sql/fn_guard.sql <<'EOF'
-- fn_guard: notify listeners after an order changes.
create or replace function order_changed(p_id integer, p_notify boolean) returns void as $$
begin
    if p_notify then
        perform notify_order(p_id);
    end if;
end;
$$ language plpgsql;
EOF
	gt_sql_contract 1 1 1 | put svc/tests/test_sql_contract.sh
	commit_at svc 2026-08-27 "GT-8: update the sql functions"

	gt_bulk 1 | put svc/src/bulk_import.sh
	put svc/tests/test_bulk_import.sh <<'EOF'
#!/bin/sh
# Tests for src/bulk_import.sh. run-tests.sh runs this file from the repo root.
set -eu

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp data/records.csv "$work/records.csv"
RECORDS_FILE=$work/records.csv
export RECORDS_FILE
printf '4,Edsger,yes,north,n1\n5,Barbara,yes,south,s1\n6,Donald,yes,east,e1\n' > "$work/batch.csv"

test_imports_the_batch() {
    SETTINGS_CACHE=data/settings.cache sh src/bulk_import.sh "$work/batch.csv" > /dev/null
    [ "$(wc -l < "$RECORDS_FILE" | tr -d ' ')" = 7 ]
}

test_stops_without_a_cache() {
    cp data/records.csv "$RECORDS_FILE"
    if SETTINGS_CACHE=$work/none sh src/bulk_import.sh "$work/batch.csv" 2> /dev/null; then
        return 1
    fi
    cmp -s data/records.csv "$RECORDS_FILE"
}

test_imports_the_batch
echo "pass test_imports_the_batch"
test_stops_without_a_cache
echo "pass test_stops_without_a_cache"
EOF
	commit_at svc 2026-09-01 "GT-6: follow the tenant settings in bulk imports"

	g -C "$T/svc" mv migrations/003_records_pk.sh migrations/003_records_pk_and_columns.sh
	gt_pk 1 | put svc/migrations/003_records_pk_and_columns.sh
	commit_at svc 2026-09-02 "GT-10: add the office columns to the records key migration"

	g -C "$T/svc" mv migrations/f_lookup_ops7.sh migrations/f_lookup_gt12.sh
	gt_lookup f_lookup_gt12.sh 'select id from audit where lower(hrn) = lower(?)' | put svc/migrations/f_lookup_gt12.sh
	commit_at svc 2026-09-03 "GT-12: match hrn ignoring case in the lookup function"

	gt_rank 1 f_rank_gt13.sh | put svc/migrations/f_rank_gt13.sh
	commit_at svc 2026-09-04 "GT-13: skip rows without a score in the rank function"

	g -C "$T/svc" mv migrations/f_audit_ops8.sh migrations/f_audit_gt13.sh
	gt_audit f_audit_gt13.sh new | put svc/migrations/f_audit_gt13.sh
	commit_at svc 2026-09-05 "GT-13: rename the audit function script"

	put svc/tests/scenario_dates.sh <<'EOF'
#!/bin/sh
# scenario_dates.sh: the dates of record 1 after the deploy.
# The second assertion is a control: it passes before and after the deploy, so if both
# fail the comparison itself is at fault.
set -eu
. tests/lib.sh

# date_of <id> <column>: print a column of data/dates.csv for the record.
date_of() {
    awk -F, -v id="$1" -v col="$2" '$1 == id { print $col }' data/dates.csv
}

assert_eq 2026-08-10 "$(date_of 1 3)" "updated date of record 1"
assert_eq 2026-06-02 "$(date_of 1 2)" "created date of record 1"
EOF
	commit_at svc 2026-09-08 "GT-9: add the dates scenario"

	gt_steps new 0 0 1 | put svc/tests/steps.sh
	gt_scenarios_steps 1 | put svc/tests/scenarios_steps.sh
	commit_at svc 2026-09-09 "GT-9: add the read and status steps"

	put svc/env/dev/accounts.txt <<'EOF'
svc_writer vault:svc-writer
api_user vault:api-user
report_reader vault:report-reader
EOF
	put svc/tests/scenario_report_read.sh <<'EOF'
#!/bin/sh
# scenario_report_read.sh: the reporting account reads the event of audit row 2.
# requires-role: api_user
set -eu
. tests/lib.sh
. tests/steps_db.sh

event=$(read_as report_reader 'select event from audit where id = ?' 2)
assert_eq updated "$event" "report read of audit row 2"
EOF
	put svc/tests/scenario_report_audit.sh <<'EOF'
#!/bin/sh
# scenario_report_audit.sh: the reporting account reads the event of audit row 3.
# requires-role: api_user
# requires-role: report_reader
set -eu
. tests/lib.sh
. tests/steps_db.sh

event=$(read_as report_reader 'select event from audit where id = ?' 3)
assert_eq created "$event" "report read of audit row 3"
EOF
	commit_at svc 2026-09-10 "GT-9: add the report scenarios"

	cat >> "$T/svc/tests/steps_db.sh" <<'EOF'

# step_fetch_record <id>: fetch one record through the store and check that one row came back.
step_fetch_record() {
    rows=$(sh src/store.sh fetch "$1" | wc -l | tr -d ' ')
    if [ "$rows" != 1 ]; then
        echo "expected 1 row, got $rows"
        return 1
    fi
    echo "fetched record $1"
}
EOF
	put svc/tests/scenario_fetch_record.sh <<'EOF'
#!/bin/sh
# scenario_fetch_record.sh: record 1 comes back from the store as one row.
set -eu
. tests/steps_db.sh

step_fetch_record 1
EOF
	commit_at svc 2026-09-11 "GT-9: add the record fetch step"

	cat >> "$T/svc/tests/steps_db.sh" <<'EOF'

# step_find_by_hrn <role> <hrn>: print the id and event of the audit row with this hrn.
step_find_by_hrn() {
    hrn=$(printf '%s' "$2" | sed "s/'/''/g")
    read_as "$1" "select id,event from audit where hrn = '$hrn'"
}
EOF
	put svc/tests/scenario_hrn_lookup.sh <<'EOF'
#!/bin/sh
# scenario_hrn_lookup.sh: the service account finds an audit row by its hrn.
# requires-role: svc_writer
set -eu
. tests/lib.sh
. tests/steps_db.sh

assert_eq 1,created "$(step_find_by_hrn svc_writer hrn-0001)" "audit row of hrn-0001"
EOF
	commit_at svc 2026-09-12 "GT-9: add the hrn lookup scenario"
}

# The base moves on after the merge-base: a guard in the rank function and a message
# format change in the validator.
gt_main_after() {
	g -C "$T/svc" checkout -q main
	gt_rank 1 f_rank_ops9.sh | put svc/migrations/f_rank_ops9.sh
	commit_at svc 2026-08-25 "rank function: skip rows without a score"

	gt_validator 1 | put svc/src/validator.sh
	commit_at svc 2026-08-29 "validator: prefix messages with the field path"
}

# gt-11-lookup: another change on main's head that renames the lookup script.
gt_other_pr() {
	g -C "$T/svc" checkout -q -b gt-11-lookup main
	g -C "$T/svc" mv migrations/f_lookup_ops7.sh migrations/f_lookup_gt11.sh
	gt_lookup f_lookup_gt11.sh "select id from audit where hrn = ? and event <> 'deleted'" | put svc/migrations/f_lookup_gt11.sh
	commit_at svc 2026-08-31 "GT-11: ignore deleted rows in the lookup function"
}

# target is cut at the first commit with two commits on the fetch helpers, then rebased
# onto main's head: its commits are new objects. stacked sits on the commits before the
# rebase.
gt_stack() {
	g -C "$T/svc" checkout -q -b stacked "$gt_old"
	gt_steps old 1 0 0 | put svc/tests/steps.sh
	commit_at svc 2026-07-02 "GT-14: list the records with a status"
	gt_steps dated 1 0 0 | put svc/tests/steps.sh
	commit_at svc 2026-07-06 "GT-14: add the update date to fetch_row"

	g -C "$T/svc" checkout -q -b target main
	gt_steps new 1 0 0 | put svc/tests/steps.sh
	commit_at svc 2026-09-06 "GT-14: list the records with a status"
	gt_steps newdated 1 0 0 | put svc/tests/steps.sh
	commit_at svc 2026-09-07 "GT-14: add the update date to fetch_row"

	g -C "$T/svc" checkout -q stacked
	gt_steps dated 1 1 0 | put svc/tests/steps.sh
	put svc/tests/scenarios_fetch/by_id.sh <<'EOF'
#!/bin/sh
# by_id.sh: the status of record 2 in its fetch_row line.
set -eu
. tests/steps.sh

status=$(fetch_row 2 | cut -d, -f"${FETCH_STATUS_FIELD:-3}")
[ "$status" = active ]
echo "ok status of record 2"
EOF
	put svc/tests/scenarios_fetch/by_status.sh <<'EOF'
#!/bin/sh
# by_status.sh: every row listed as active carries the status active.
set -eu
. tests/steps.sh

fetch_rows_by_status active | while IFS= read -r row; do
    [ "$(printf '%s\n' "$row" | cut -d, -f"${FETCH_STATUS_FIELD:-3}")" = active ] || exit 1
done
echo "ok active rows"
EOF
	commit_at svc 2026-09-12 "GT-14: add the fetch scenarios"
}

# ---------------------------------------------------------------------------
# gt_ticket <id> <title> <state>: write exports/<id>.md; the description is stdin.
gt_ticket() {
	{
		printf -- '---\nid: %s\nurl: https://tickets.example.invalid/browse/%s\ntitle: %s\nstate: %s\ndescription: |\n' "$1" "$1" "$2" "$3"
		sed 's/^/  /'
		printf 'source: file export\nexported_by: tracker export\nexported_at: 2026-09-29\n---\n'
	} | put "exports/$1.md"
}

write_ground_truth_exports() {
	gt_ticket GT-0 "Stop requiring items on orders" Done <<'EOF'
An order can be created without items. Remove `items` from the required fields of
orders in src/validate.sh, spec/orders.yml, and spec/public/orders.yml.
EOF
	gt_ticket GT-1 "Add the contract import endpoint" "In Progress" <<'EOF'
Add `import_contract` to src/handlers.sh. It writes the contract record like the other
import endpoints.
EOF
	gt_ticket GT-2 "Skip ineligible targets in related links" "In Progress" <<'EOF'
`related_links` in src/links.sh must not report a link to a target whose status is
neither active nor pending. The importer then imports a record linked to such a target,
without that link, instead of rejecting the record. Add src/sweep.sh, which prints the
links dropped this way as `dropped <record>,<target>`.
EOF
	gt_ticket GT-3 "Use the category reference in the record schemas" "In Progress" <<'EOF'
The `category` property of the person, org, site, and study schemas in schemas/ is a
plain string. Make it a reference to `#/definitions/category_ref` in all four, and add a
test for the schemas.
EOF
	gt_ticket GT-4 "Write source_id when a site is created" "In Progress" <<'EOF'
`upsert_site` in src/upsert.sh must write `source_id` when it creates a row. Add a test
for the site upsert.
EOF
	gt_ticket GT-5 "Make items optional for invoices" "In Progress" <<'EOF'
An invoice can be validated without items. Remove the requirement from the invoice
validation, as GT-0 did for orders.
EOF
	gt_ticket GT-6 "Follow the tenant settings in bulk imports" "In Progress" <<'EOF'
The bulk import applies the flag and office rules according to the tenant's settings,
`require_flag` and `require_office`, read from the settings cache.
EOF
	gt_ticket GT-7 "Waive the flag error in bulk imports" "In Progress" <<'EOF'
Add src/waiver.sh, which removes the flag error from validation output for tenants that
waive the flag. Add a unit test and a bulk scenario.
EOF
	gt_ticket GT-8 "Update the sql functions" "In Progress" <<'EOF'
Four updates under sql/: `fn_touch.sql` returns the new `updated_at`;
`trg_reread_json.sql` keeps `flag` when the payload flag is a JSON null; `fn_order.sql`
inserts the order header before its lines; `fn_guard.sql` notifies only when asked.
Cover them in tests/test_sql_contract.sh.
EOF
	gt_ticket GT-9 "Add scenarios for record reads" "In Progress" <<'EOF'
Add scenarios under tests/: the dates of a record after the deploy, a read step and a
status step, reads through the reporting account, a record fetch through the store, and
an audit lookup by hrn.
EOF
	gt_ticket GT-10 "Add the office columns to the records schema" "In Progress" <<'EOF'
Add the `office` and `office_code` columns to the records schema, in the records key
migration.
EOF
	gt_ticket GT-12 "Match hrn ignoring case in the lookup function" "In Progress" <<'EOF'
The lookup function compares the hrn without regard to case.
EOF
	gt_ticket GT-13 "Name the function scripts after their tickets" "In Progress" <<'EOF'
Rename `f_rank_ops9.sh` to `f_rank_gt13.sh` and `f_audit_ops8.sh` to `f_audit_gt13.sh`.
The rank function skips rows without a score, and the audit function also returns the
hrn.
EOF
	gt_ticket GT-14 "Fetch helpers for status lists" "In Progress" <<'EOF'
Add `fetch_rows_by_status` to tests/steps.sh, and add the update date to the line
`fetch_row` prints.
EOF

	put exports/PR-1.md <<'EOF'
---
id: PR-1
url: https://forge.example.invalid/svc/pulls/1
title: Import endpoints, schemas, rules, migrations and scenarios
body: |
  Covers GT-1 to GT-10, GT-12, and GT-13.

  - GT-1: the contract import endpoint
  - GT-2: related links skip targets that are not eligible, with a sweep report
  - GT-3: the category reference in the person and org schemas
  - GT-4: site upsert writes source_id
  - GT-5: items are optional for invoices, so invoices now match orders (GT-0).
  - GT-6: bulk imports follow the tenant settings. If the settings cache cannot be read,
    the import fails closed and rolls back.
  - GT-7: the flag waiver for bulk imports
  - GT-8: the four sql updates
  - GT-9: scenarios for record reads
  - GT-10, GT-12, and GT-13: migration changes

  Related: PR-3 (branch gt-11-lookup), open against main, changes the lookup function for GT-11.
source: file export
exported_by: tracker export
exported_at: 2026-09-29
threads:
  - file: migrations/f_rank_gt13.sh
    line: 1
    comments:
      - author: svc-dev
        date: 2026-08-20
        text: |
          Deployed build 1.4.0-17 from this branch to the shared test environment. Its
          journal afterwards:

              001_create_schema.sh
              002_records_columns.sh
              003_records_pk.sh
              f_audit_ops8.sh
              f_lookup_ops7.sh
              f_rank_gt13.sh
  - file: tests/connection.sh
    line: 6
    comments:
      - author: svc-dev
        date: 2026-09-13
        text: |
          Connection line from the dev run of scenario_hrn_lookup:

              Host=localhost;Database=svc;Username=svc_writer;Password=********
---
EOF
	put exports/PR-2.md <<'EOF'
---
id: PR-2
url: https://forge.example.invalid/svc/pulls/2
title: Add the fetch scenarios
body: Built on GT-14 (target).
source: file export
exported_by: tracker export
exported_at: 2026-09-29
---
EOF
}

write_ground_truth_session() {
	put session-summary.md <<'EOF'
# Session summary for GT-1 to GT-10, GT-12, and GT-13

GT-1: `import_contract` is added to src/handlers.sh and writes the record like the other
import endpoints.
GT-2: `related_links` skips targets that are not active or pending, and src/sweep.sh
reports the dropped links.
GT-3: schemas/person.json and schemas/org.json use the category reference, with
tests/test_schemas.sh.
GT-4: `upsert_site` writes `source_id` on create, with tests/test_upsert_site.sh.
GT-5: invoices no longer require items, matching orders.
GT-6: bulk imports follow `require_flag` and `require_office` from the settings cache.
If the settings cache cannot be read, the import fails closed and rolls back.
GT-7: src/waiver.sh removes the flag error, with tests/test_waiver.sh and
tests/scenario_bulk.sh.
GT-8: sql/fn_touch.sql, sql/trg_reread_json.sql, sql/fn_order.sql, and sql/fn_guard.sql
are covered by tests/test_sql_contract.sh.
GT-9: the scenarios under tests/ run with sh tests/run_scenarios.sh.
GT-10: the office columns are added in the records key migration.
GT-12 and GT-13: the lookup, rank, and audit function scripts are renamed.
The tests under tests/ pass with sh run-tests.sh.
EOF
}

write_ground_truth_manifest() {
	put manifest.json <<'EOF'
{
  "bundles": [
    { "repo": "./svc", "pr": "file:./exports/PR-1.md", "branch": "feature", "base": "main",
      "run_once": ["migrations/*.sh"],
      "tickets": ["file:./exports/GT-1.md", "file:./exports/GT-2.md",
                  "file:./exports/GT-3.md", "file:./exports/GT-4.md",
                  "file:./exports/GT-5.md", "file:./exports/GT-6.md",
                  "file:./exports/GT-7.md", "file:./exports/GT-8.md",
                  "file:./exports/GT-9.md", "file:./exports/GT-10.md",
                  "file:./exports/GT-12.md", "file:./exports/GT-13.md"] },
    { "repo": "./svc", "pr": "file:./exports/PR-2.md", "branch": "stacked", "base": "target",
      "tickets": ["file:./exports/GT-14.md"] }
  ],
  "groups": [
    { "name": "import-api", "repo": "./svc",
      "files": ["src/importer.sh", "src/links.sh", "src/sweep.sh", "src/handlers.sh",
                "tests/test_import_rights.sh", "data/relations.csv", "data/via_*.csv",
                "data/targets.csv", "data/imported.csv"] },
    { "name": "records", "repo": "./svc",
      "files": ["schemas/**", "spec/**", "src/upsert.sh", "src/validate.sh",
                "tests/test_schemas.sh", "tests/test_upsert_site.sh",
                "data/person.csv", "data/org.csv", "data/site.csv"] },
    { "name": "bulk-rules", "repo": "./svc",
      "files": ["src/bulk_import.sh", "src/rules.sh", "src/settings.sh", "src/messages.sh",
                "src/validator.sh", "src/waiver.sh", "tests/test_waiver.sh",
                "tests/test_bulk_import.sh", "tests/scenario_bulk.sh",
                "data/settings.cache"] },
    { "name": "sql", "repo": "./svc",
      "files": ["sql/**", "tests/test_sql_contract.sh"] },
    { "name": "harness", "repo": "./svc",
      "files": ["src/store.sh", "tests/lib.sh", "tests/steps.sh", "tests/steps_db.sh",
                "tests/connection.sh", "tests/dbclient.sh", "tests/hook.sh",
                "tests/run_scenarios.sh", "tests/scenarios_steps.sh",
                "tests/scenario_audit_event.sh", "tests/scenario_dates.sh",
                "tests/scenario_report_read.sh", "tests/scenario_report_audit.sh",
                "tests/scenario_fetch_record.sh", "tests/scenario_hrn_lookup.sh",
                "env/**", "data/records.csv", "data/dates.csv", "data/audit.csv"] },
    { "name": "migrations", "repo": "./svc",
      "files": ["migrate.sh", "migrations/**"] },
    { "name": "stacked", "repo": "./svc",
      "files": ["tests/scenarios_fetch/**"] }
  ],
  "claims": ["./session-summary.md"]
}
EOF
	# The same with stage 1's run of bundle 1's changed tests with the change reverted.
	awk '{ print } $0 == "      \"run_once\": [\"migrations/*.sh\"]," {
		print "      \"test_command\": \"sh\", \"test_run\": [\"tests/test_*.sh\", \"tests/scenario_*.sh\"]," }' \
		"$T/manifest.json" | put manifest-revert.json
}
