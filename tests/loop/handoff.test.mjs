// The handoff format: the decided-by mapping of R139.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const HANDOFF = read('../../plugins/loop/skills/run/handoff.md');

// The decided_by table: from its "- `decided_by`" line through the line that bars names.
export const decidedByTable = (text) => {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith('- `decided_by`'));
  if (start === -1) return null;
  const end = lines.findIndex((line, i) => i > start && line.includes('Never a person\'s name'));
  return end === -1 ? null : lines.slice(start, end + 1).join('\n');
};

test('R139: the handoff maps the four deciders, and a run decision to a role, never to not recorded', () => {
  const table = decidedByTable(HANDOFF);
  assert.notEqual(table, null, 'handoff.md has no decided_by table');
  assert.ok(table.includes('  - user: `role: session user`'));
  assert.ok(table.includes('  - plan confirmation: `role: session user (plan confirmation)`'));
  assert.ok(table.includes('  - review: `checkpoint (recommended option taken)`'));
  assert.ok(table.includes('  - run: `role: orchestrator`'));
  assert.ok(!table.includes('not recorded'), 'a decider maps to not recorded');
});
