// The handoff format the audit reads and writes: the decided-by table of R139, identical to the loop's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const AUDIT = read('../../plugins/audit/skills/audit/handoff.md');
const LOOP = read('../../plugins/loop/skills/run/handoff.md');

// The decided_by table: from its "- `decided_by`" line through the line that bars names.
const decidedByTable = (text) => {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith('- `decided_by`'));
  if (start === -1) return null;
  const end = lines.findIndex((line, i) => i > start && line.includes('Never a person\'s name'));
  return end === -1 ? null : lines.slice(start, end + 1).join('\n');
};

test('R139: the audit handoff carries the decided-by table and maps a run decision to a role', () => {
  const table = decidedByTable(AUDIT);
  assert.notEqual(table, null, 'the audit handoff.md has no decided_by table');
  assert.ok(table.includes('  - run: `role: orchestrator`'));
  assert.ok(AUDIT.indexOf('- `decided_by`') < AUDIT.indexOf('\n## Rules\n'), 'the table is not under the format');
});

test('R139: the decided-by tables of the audit and the loop are identical', () => {
  assert.equal(decidedByTable(AUDIT), decidedByTable(LOOP));
});
