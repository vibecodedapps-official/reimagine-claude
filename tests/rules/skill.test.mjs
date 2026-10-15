// The rules skill's steps. The skill is text the model follows, so these read the text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SKILL = readFileSync(new URL('../../plugins/rules/skills/rules/SKILL.md', import.meta.url), 'utf8');

test('R36: the adopt step passes only the options the user gave, never the plan\'s options line', () => {
  const line = SKILL.split('\n').find((l) => l.startsWith('- On adopt,'));
  assert.notEqual(line, undefined);
  assert.equal(line.includes('options:'), false);
  assert.equal(line.includes('--adopt'), true);
});
