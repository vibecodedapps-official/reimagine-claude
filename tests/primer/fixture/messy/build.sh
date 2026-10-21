#!/bin/sh
# build.sh: build the primer messy fixture, a small Node repository whose instructions are in the
# hub-and-index form of an older documentation plugin, for the hand-run acceptance item where
# /primer adopts it. Builds in a new directory under TMPDIR (else /tmp) and prints that
# directory's absolute path on stdout, nothing else.
#
# Usage: sh tests/primer/fixture/messy/build.sh
#
# Git runs with fixed identity, fixed commit dates, no global or system config, no signing,
# and no line-ending conversion, so commit ids are the same on every machine. On Windows
# (Git Bash) the printed path is in C:/ form.
set -eu

T=$(mktemp -d "${TMPDIR:-/tmp}/messy.XXXXXX")
if command -v cygpath >/dev/null 2>&1; then
	T=$(cygpath -m "$T")
fi

GIT_CONFIG_NOSYSTEM=1
GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_NOSYSTEM GIT_CONFIG_GLOBAL
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL \
	GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL

# Keep stdout for the directory path only.
exec 3>&1 1>/dev/null

g() {
	git -c user.name=fixture -c user.email=fixture@example.invalid \
		-c commit.gpgsign=false -c tag.gpgsign=false -c core.autocrlf=false \
		-c core.safecrlf=false -c init.defaultBranch=main "$@"
}

# commit <message>: stage everything, then commit with the next fixed date.
n=0
commit() {
	g -C "$T" add -A
	n=$((n + 1))
	GIT_AUTHOR_DATE="2026-09-01 10:$(printf '%02d' "$n"):00 +0000"
	GIT_COMMITTER_DATE=$GIT_AUTHOR_DATE
	export GIT_AUTHOR_DATE GIT_COMMITTER_DATE
	g -C "$T" commit -q -m "$1"
}

# put <path>: write stdin to <path> under the fixture directory.
put() {
	mkdir -p "$(dirname "$T/$1")"
	cat > "$T/$1"
}

# architecture: write docs/architecture.md to stdout, exactly 230 lines: a 22 line head, 41
# event blocks of 5 lines, then 3 plain sentence lines.
architecture() {
	cat <<'EOF'
# Architecture

messy has three parts: the API in `src/api/`, the worker in `worker/`, and the web front end
in `src/web/`. The web front end calls the API over HTTP and holds no state of its own. The
API answers each call itself and enqueues a job when a write needs follow-up work. The
worker takes jobs from the queues and runs them, and it never talks to the web front end.

## Request flow

1. The browser loads the plain files that `src/web/` serves and calls `/api/` from there.
2. The API parses the request and checks the body with `validateBody`.
3. An invalid body ends the call with a 400 and the shared error shape.
4. A valid call reads or writes records through one store module.
5. A write that needs follow-up work enqueues a job and answers without waiting for it.
6. The API answers with the status and body that the handler returned.
7. The worker polls its queues and takes the next job for a queue.
8. The worker runs the job and logs one JSON line for it.
9. A failed job is retried with a delay that doubles, up to five times.
10. A job that fails the fifth time moves to the `dead` queue.

## Event catalog

EOF
	i=1
	while [ "$i" -le 41 ]; do
		if [ $((i % 2)) -eq 1 ]; then
			queue=report.build
		else
			queue=mail.send
		fi
		printf '### Event %s\n- Queue: %s\n- Payload: an object with id and attempt.\n- Producer: the API, after a write that needs follow-up work.\n\n' "$i" "$queue"
		i=$((i + 1))
	done
	cat <<'EOF'
Every event carries the id of the record that caused it.
The worker treats a repeated event as a no-op once its job id is recorded.
New events are added to this catalog in the same change that adds the producer.
EOF
}

g init -q "$T"
g -C "$T" symbolic-ref HEAD refs/heads/main

put package.json <<'EOF'
{
  "name": "messy",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test",
    "lint": "node scripts/lint.mjs",
    "build": "node scripts/build.mjs",
    "release": "sh scripts/release.sh"
  }
}
EOF

put src/api/handlers.js <<'EOF'
import { validateBody } from './validate.js';

const items = new Map();
let nextId = 1;

export function createItem(body) {
  const checked = validateBody(body);
  if (!checked.ok) return { status: 400, body: { error: { code: 'INVALID_BODY', message: checked.message } } };
  const item = { id: nextId++, name: checked.value.name };
  items.set(item.id, item);
  return { status: 201, body: item };
}

export function getItem(id) {
  const item = items.get(Number(id));
  if (!item) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'no such item' } } };
  return { status: 200, body: item };
}
EOF

put src/api/validate.js <<'EOF'
export function validateBody(body) {
  if (typeof body !== 'object' || body === null) return { ok: false, message: 'body must be an object' };
  const keys = Object.keys(body);
  if (keys.some((key) => key !== 'name')) return { ok: false, message: 'unknown field' };
  if (typeof body.name !== 'string') return { ok: false, message: 'name must be a string' };
  const name = body.name.trim();
  if (name.length === 0 || name.length > 200) return { ok: false, message: 'name must be 1 to 200 characters' };
  return { ok: true, value: { name } };
}
EOF

put src/web/app.js <<'EOF'
const list = document.querySelector('#items');

async function load() {
  const response = await fetch('/api/items');
  const page = await response.json();
  list.replaceChildren(...page.items.map((item) => Object.assign(document.createElement('li'), { textContent: item.name })));
}

load();
EOF

put test/handlers.test.js <<'EOF'
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem, getItem } from '../src/api/handlers.js';

describe('handlers', () => {
  test('creates an item with a trimmed name', () => {
    const result = createItem({ name: ' a ' });
    assert.equal(result.status, 201);
    assert.equal(result.body.name, 'a');
  });

  test('answers 404 for a missing item', () => {
    assert.equal(getItem(99).status, 404);
  });
});
EOF

put scripts/lint.mjs <<'EOF'
import { readdirSync } from 'node:fs';

console.log(`lint: checked ${readdirSync('src').length} directories`);
EOF

put scripts/build.mjs <<'EOF'
import { cpSync, readdirSync } from 'node:fs';

for (const name of readdirSync('src/web')) {
  if (name.endsWith('.js')) cpSync(`src/web/${name}`, `src/web/dist/${name}`);
}
EOF

put scripts/release.sh <<'EOF'
#!/bin/sh
# release.sh <x.y.z>: check the tree, run the checks, and tag the release locally.
set -eu

if [ $# -lt 1 ]; then
	echo "usage: sh scripts/release.sh x.y.z" >&2
	exit 2
fi

if [ -n "$(git status --porcelain)" ]; then
	echo "release: the working tree is not clean" >&2
	exit 1
fi

npm test
npm run lint
npm run build
git tag -a "v$1" -m "messy $1"
EOF
chmod +x "$T/scripts/release.sh"

architecture | put docs/architecture.md

put docs/style.md <<'EOF'
# Code style

- Use two spaces for indentation and no tabs.
- End every statement with a semicolon.
- Use single quotes for strings and template literals only for interpolation.
- Name files in lower case with hyphens, such as `queue-worker.js`.
- Name functions with a verb and constants in upper snake case.
- Prefer `const`; use `let` only when the value changes.
- Prefer named exports over default exports.
- Import built-in modules with the `node:` prefix.
- Keep one blank line between functions and none inside them.
- Keep lines under 120 characters.
- Use `async` and `await` instead of promise chains.
- Throw `Error` objects, never strings.
- Leave a trailing newline at the end of every file.
- Order imports as built-in modules first, then project files.
- Do not leave unused variables or imports.
EOF

put docs/api-notes.md <<'EOF'
# API notes

Notes for people working on the HTTP handlers in `src/api/`.

## Requests

Every request body goes through `validateBody` before a handler reads any field of it.
A body with a field the handler does not know is rejected with a 400, and strings are
trimmed and capped at 200 characters.

## Errors

A failed call returns an object with an `error` key holding a `code` and a `message`.
The `code` is a stable upper snake case word that clients can match on. A response
never carries a stack trace or an internal path.

## Status codes

A create answers 201 and sets a `Location` header, a delete answers 204, and reads and
updates answer 200. Bad input is a 400, a missing record a 404, and a conflict a 409.

## Lists

A list takes `limit`, which defaults to 20 and may not exceed 100, and an opaque `cursor`.
The reply holds `items` and `next`; `next` is null on the last page.
EOF

put docs/api-rules.md <<'EOF'
# API handler rules

These rules hold for every handler file in src/api/.

## Validation

- Validate every request body with `validateBody` from `src/api/validate.js` before a handler reads it.
- Reject unknown fields with a 400 instead of ignoring them.
- Trim string fields and cap them at 200 characters.
- Validate path and query parameters the same way as bodies.

## Error shapes

- Return errors as `{ "error": { "code": "...", "message": "..." } }`.
- Use a stable upper snake case `code`; clients match on it, never on `message`.
- Never put a stack trace or an internal path in a response.
- Return the same error shape from every handler, including the unexpected ones.

## Status codes

- Return 200 for reads and updates, 201 with a `Location` header for creates, and 204 for deletes.
- Return 400 for invalid input, 404 for a missing record, and 409 for a conflict.
- Return 422 when the input is well formed but breaks a business rule.
- Use 500 only for faults the handler did not expect, and log them.

## Pagination

- List endpoints take `limit` (default 20, maximum 100) and `cursor`.
- Return `{ "items": [...], "next": "<cursor>" }` and set `next` to null on the last page.
- Sort by `id` ascending so a cursor stays stable between requests.
- Reject a `limit` above 100 with a 400 instead of lowering it.

## Logging

- Log one JSON line per request with `method`, `path`, `status`, and `ms`.
- Never log request bodies, tokens, or email addresses.
- Log errors at `error` level with the error `code`.
- Put a request id in every log line a handler writes.

## Handler structure

- Keep each handler a plain function that takes parsed input and returns `{ status, body }`.
- Keep state out of handlers; read and write records through one store module.
- Keep a handler under 30 lines and move shared checks into `src/api/validate.js`.
EOF

put docs/release-checklist.md <<'EOF'
# Release checklist

1. Make sure `main` is green: `npm test` and `npm run lint` both pass.
2. Update the version in `package.json` and commit it as `chore: release x.y.z`.
3. Run `npm run build` and check that `src/web/dist/` holds the new files.
4. Tag the commit with `vx.y.z` and push the tag.
5. Deploy the API first, then the worker, then the web files.
6. Watch the request logs for 10 minutes and look for 500 responses.
7. If the error rate rises, redeploy the last good tag.
8. Write the release notes from the commit subjects since the last tag.
9. Tell the team in the release channel when the deploy is done.
10. Close the milestone and move open issues to the next one.
EOF

put docs/web.md <<'EOF'
# Web front end

The web front end is plain files under `src/web/`, served as they are built.

## Commands

- `npm run build`: copies the `.js` files of `src/web/` into `src/web/dist/`, which git ignores.

## Constraints

- Use no bundler and no framework; the build only copies files.
- Never edit files under `src/web/dist/`; rebuild them instead.
- Fetch only from `/api/`; the web front end holds no state of its own beyond the page.
EOF

put docs/decisions.md <<'EOF'
# Decisions

Each entry records a project choice with its date.

- 2026-08-03: Use the built-in `node --test` runner and no test framework.
- 2026-08-10: Paginate lists with opaque cursors, not page numbers.
- 2026-08-17: Keep the web front end free of a bundler; `scripts/build.mjs` copies files.
- 2026-08-24: Run background jobs in a separate worker process, not in the API process.
EOF

put README.md <<'EOF'
# messy

messy is a small JSON API for keeping a list of items, with a web front end and a
background worker. It is written in plain JavaScript for Node and has no runtime
dependencies.

## Install

You need Node 20 or newer.

```
git clone https://example.invalid/messy.git
cd messy
npm install
```

## Usage

- `npm test` runs the tests.
- `npm run lint` checks the code.
- `npm run build` builds the web front end into `src/web/dist/`.

The API handlers live in `src/api/`, the web front end in `src/web/`, and the queue
worker in `worker/`. For the request and response rules, see the
[API notes](docs/api-notes.md).

## License

MIT. See the license field in `package.json`.

## Notes for AI agents

- Run the tests with `npm test` before you commit.
- Never edit generated files, such as anything under `src/web/dist/`.
- Keep handlers small and put checks in `src/api/validate.js`.
- Ask before adding a dependency.
- Write commit messages as `type(scope): subject`, lowercase.
- Leave the `notes/` directory alone; it holds personal files.
EOF

put CONTRIBUTING.md <<'EOF'
# Contributing

Thanks for helping with messy. Open a pull request against `main`; every change needs a test under `test/`.

## Adding an endpoint

1. Add the handler to `src/api/handlers.js` as a plain function that returns `{ status, body }`.
2. Validate its input with `validateBody` from `src/api/validate.js`.
3. Add a test for the success case and one for each error status under `test/`.
4. Run `npm test` and `npm run lint`; both must pass.
5. Describe the request and the response in `docs/api-notes.md`.
EOF

put .claude/CLAUDE.md <<'EOF'
# Working in messy

- Keep each commit to one concern; do not mix a rewrite with a behavior change.
- Delete dead code instead of commenting it out.
- Keep functions under 40 lines; split a longer one before adding to it.
- Read configuration from environment variables, never from constants in source.
EOF

put CLAUDE.md <<'EOF'
# messy

messy is a small JSON API with a web front end and a background worker. It runs on Node with no framework and keeps its dependency list short. Read docs/architecture.md before changing how the API, the worker and the web front end talk to each other.

## Commands

- `npm test`: runs the test suite with `node --test`.
- `npm run lint`: runs the project linter in `scripts/lint.mjs`.
- `npm run build`: builds the web front end into `src/web/dist/`.

## Constraints

- Write commit messages as `type(scope): subject`, lowercase, with a body that says why.
- Ask before adding a dependency, and name the package and the reason.
- Never commit secrets, tokens, or `.env` files.
- Run `npm test` and `npm run lint` before every commit.

The local notes load from this file.

@notes/local.md

## Spokes

- docs/api-rules.md: How the API handlers validate input, shape errors and pick status codes. Read before editing a handler file matching `src/api/*.js`.
- docs/release-checklist.md: The release steps, from a green main to the release note. Read before cutting a release.
- docs/web.md: The web front end's build command and constraints. Read before editing under `src/web/`.
- docs/style.md: The code style for every JavaScript file. Read before writing JavaScript.
- docs/decisions.md: The project's dated choices. Read before reversing one.
EOF

put .gitignore <<'EOF'
node_modules/
notes/
src/web/dist/
EOF

put notes/local.md <<'EOF'
My local notes for messy.
The staging database resets every night.
Ask the team for the API token before the demo.
EOF

g -C "$T" add -A
g -C "$T" update-index --chmod=+x scripts/release.sh
commit "chore: start the project"

put worker/queue.js <<'EOF'
const queues = new Map();

export function enqueue(name, job) {
  if (!queues.has(name)) queues.set(name, []);
  queues.get(name).push({ ...job, attempt: 0 });
}

export function next(name) {
  const queue = queues.get(name) ?? [];
  return queue.shift() ?? null;
}

export function size(name) {
  return (queues.get(name) ?? []).length;
}
EOF

put worker/AGENTS.md <<'EOF'
# Worker rules

These rules apply to work under `worker/` only.

- Name queues in lower case with a dot, such as `mail.send` or `report.build`.
- Retry a failed job at most 5 times, with a delay that doubles from 2 seconds.
- Move a job to the `dead` queue after the fifth failure and log its id.
- Make every job idempotent: running it twice must leave the same result as running it once.
- Give each job a unique id and check it before doing any work.
- Keep a job under 30 seconds; split longer work into several jobs.
- Never share state between jobs except through the queue.
- Log one JSON line per job with `queue`, `id`, `attempt`, and `ms`.
EOF

commit "feat(worker): add the queue worker"

printf '%s\n' "$T" >&3
