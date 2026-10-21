#!/bin/sh
# build.sh: build the primer memory fixture, an auto memory directory for the messy fixture with
# one note per type, an index in the host's form with the em dash written as an octal escape so
# this file stays ASCII, and a review stamp older than two of the notes, for the fixture test, the
# notice test, and the hand-run acceptance item where /primer promotes the notes. Builds in a new
# directory under TMPDIR (else /tmp) and prints that directory's absolute path on stdout, nothing
# else.
#
# Usage: sh tests/primer/fixture/memory/build.sh
#
# The directory holds memory/ and stamp. On Windows (Git Bash) the printed path is in C:/ form.
set -eu

T=$(mktemp -d "${TMPDIR:-/tmp}/memory.XXXXXX")
if command -v cygpath >/dev/null 2>&1; then
	T=$(cygpath -m "$T")
fi

# Keep stdout for the directory path only.
exec 3>&1 1>/dev/null

mkdir -p "$T/memory"

printf '2026-09-15T12:00:00.000Z\n' > "$T/stamp"

{
	printf '%s \342\200\224 %s\n' '- [No direct push](no-direct-push.md)' 'changes reach main through a pull request'
	printf '%s \342\200\224 %s\n' '- [Item ids are numbers](item-ids-are-numbers.md)' 'API ids are integers; handlers convert with Number()'
	printf '%s \342\200\224 %s\n' '- [Issue tracker](issue-tracker.md)' 'bugs and requests at https://example.invalid/messy/issues'
	printf '%s \342\200\224 %s\n' '- [Reply style](reply-style.md)' 'user prefers short replies, no tables'
} > "$T/memory/MEMORY.md"

cat > "$T/memory/no-direct-push.md" <<'EOF'
---
name: no-direct-push
description: Changes reach main through a pull request, never a direct push
metadata:
  node_type: memory
  type: feedback
  originSessionId: 00000000-0000-4000-8000-000000000001
  modified: 2026-09-10T09:00:00.000Z
---

Never push to `main` directly; push a branch and open a pull request.

**Why:** The user corrected a direct push to main.

**How to apply:** Every change goes to a branch and reaches `main` through a pull request.
EOF

cat > "$T/memory/item-ids-are-numbers.md" <<'EOF'
---
name: item-ids-are-numbers
description: API item ids are integers assigned from 1; handlers convert a path id with Number()
metadata:
  node_type: memory
  type: project
  originSessionId: 00000000-0000-4000-8000-000000000002
  modified: 2026-10-05T14:30:00.000Z
---

Item ids in the API are integers assigned in order from 1, and a handler converts a path id with `Number()` before it looks the item up.

**Why:** Clients send ids as strings in the URL path, and the store keys items by number.

**How to apply:** Convert with `Number()` in every handler that takes an id; never compare a raw path id with a stored id.
EOF

cat > "$T/memory/issue-tracker.md" <<'EOF'
---
name: issue-tracker
description: Where bugs and feature requests for messy are tracked
metadata:
  node_type: memory
  type: reference
  originSessionId: 00000000-0000-4000-8000-000000000001
  modified: 2026-10-06T08:15:00.000Z
---

Bugs and feature requests for messy are tracked at https://example.invalid/messy/issues.
EOF

cat > "$T/memory/reply-style.md" <<'EOF'
---
name: reply-style
description: The user prefers short replies with no tables
metadata:
  node_type: memory
  type: user
  originSessionId: 00000000-0000-4000-8000-000000000002
  modified: 2026-09-01T17:45:00.000Z
---

The user prefers short replies with no tables.
EOF

printf '%s\n' "$T" >&3
