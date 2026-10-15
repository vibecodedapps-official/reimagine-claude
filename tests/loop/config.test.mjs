// The loop skill's configuration block and frontmatter. The skill and the README carry the same .reimagine.json block.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const SKILL = read('../../plugins/loop/skills/run/SKILL.md');
const README = read('../../plugins/loop/README.md');

// The body of the first ```json fenced block that contains "timeouts".
const configBlock = (text) => {
  for (const match of text.matchAll(/```json\n([\s\S]*?)\n```/g)) {
    if (match[1].includes('timeouts')) return match[1];
  }
  return null;
};

test('R81: the configuration block in SKILL.md is byte-identical to the one in README.md', () => {
  const skill = configBlock(SKILL);
  assert.notEqual(skill, null);
  assert.equal(skill, configBlock(README));
});

test('R81: the configuration block has exactly the keys commit, checks, timeouts, models, with the default values', () => {
  const config = JSON.parse(configBlock(SKILL));
  assert.deepEqual(Object.keys(config), ['commit', 'checks', 'timeouts', 'models']);
  assert.deepEqual(Object.keys(config.timeouts), ['subagent', 'review', 'check', 'ci', 'run']);
  assert.deepEqual(config.timeouts, { subagent: 20, review: 30, check: 15, ci: 45, run: 240 });
  assert.deepEqual(config.models, { implementer: 'sonnet', reviewer: 'fable', 'fallback-reviewer': 'opus', reader: 'haiku' });
});

test('R45: the SKILL.md frontmatter names the skill run and its description carries both trigger phrases', () => {
  const match = SKILL.match(/^---\n([\s\S]*?)\n---\n/);
  assert.notEqual(match, null);
  const lines = match[1].split('\n');
  assert.ok(lines.includes('name: run'));
  const description = lines.find((line) => line.startsWith('description:'));
  assert.ok(description.includes('reimagine loop'));
  assert.ok(description.includes('run the loop'));
});

test('the SKILL.md core stays within 5800 words', () => {
  const words = SKILL.split(/\s+/).filter(Boolean).length;
  assert.ok(words <= 5800, `SKILL.md has ${words} words`);
});
