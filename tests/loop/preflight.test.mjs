// Step 0's branch rules: finding an existing record and reading the branch state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const PREFLIGHT = read('../../plugins/loop/skills/run/steps/0-preflight.md');
const SKILL = read('../../plugins/loop/skills/run/SKILL.md');

// The text of a "## <heading>" section, up to the next "## " heading.
const section = (text, heading) => {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start === -1) return null;
  const end = text.indexOf('\n## ', start + 1);
  return end === -1 ? text.slice(start) : text.slice(start, end);
};

test('R83: Step 0.2 looks for an existing record by ticket id before it predicts a branch', () => {
  const text = section(PREFLIGHT, '0.2 Default branch, base commit, continued branch, open pull requests');
  assert.notEqual(text, null);
  const lookup = text.indexOf('`tickets`');
  assert.ok(lookup !== -1, 'Step 0.2 does not read the tickets list of existing records');
  assert.ok(text.includes('.reimagine/loop/'), 'Step 0.2 does not name the record directories it reads');
  assert.ok(lookup < text.indexOf('predicted'), 'Step 0.2 predicts a branch before it looks for a record by ticket id');
});

test('R83: the branch rule in SKILL.md sends the run to an existing record that holds one of its tickets', () => {
  const text = section(SKILL, 'Record');
  assert.notEqual(text, null);
  assert.ok(text.includes('holds one of the request\'s tickets'));
});

test('R87: Step 0.5 appends a run to an existing record instead of creating run 1', () => {
  const text = section(PREFLIGHT, '0.5 The record');
  assert.notEqual(text, null);
  assert.ok(text.includes('n+1') || text.includes('<n>'), 'Step 0.5 does not number a new run on an existing record');
  assert.ok(text.includes('Branch state'), 'Step 0.5 does not write the branch state to inputs.md');
});
