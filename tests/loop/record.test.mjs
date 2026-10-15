// The record rules in record.md, and the sections the other skill files cite from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../../plugins/loop/skills/run/', import.meta.url);
const read = (path) => readFileSync(new URL(path, DIR), 'utf8');
const FILES = [
  ...readdirSync(DIR).filter((name) => name.endsWith('.md')),
  ...readdirSync(new URL('steps/', DIR)).filter((name) => name.endsWith('.md')).map((name) => `steps/${name}`),
];
const RECORD = read('record.md');

// The text of a "## <heading>" section, up to the next "## " heading.
const section = (text, heading) => {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start === -1) return null;
  const end = text.indexOf('\n## ', start + 1);
  return end === -1 ? text.slice(start) : text.slice(start, end);
};

test('every section of record.md that a skill file cites by name exists', () => {
  let cited = 0;
  for (const file of FILES) {
    for (const match of read(file).matchAll(/`record\.md`(?:, | \()([A-Z][a-z]+(?: [a-z]+)*)/g)) {
      cited++;
      assert.notEqual(section(RECORD, match[1]), null, `${file} cites record.md, ${match[1]}, and record.md has no such section`);
    }
  }
  assert.ok(cited >= 2, `only ${cited} citations of record.md sections found`);
});

test('R87: an existing record lists the commits from the merge-base and writes the foreign ones to inputs.md', () => {
  const text = section(RECORD, 'An existing record');
  assert.notEqual(text, null);
  for (const phrase of ['git log', '<merge-base>..<tip>', 'foreign', '`inputs.md`', 'interrupted']) {
    assert.ok(text.includes(phrase), `An existing record does not mention ${phrase}`);
  }
});

test('R96: the commit snapshot names its location, its state and the sections of the external form', () => {
  const text = section(RECORD, 'Commit snapshot');
  assert.notEqual(text, null);
  for (const phrase of ['docs/runs/<branch-slug>/plan.md', 'docs/runs/<branch-slug>/report-<n>.md', '`publishing`', 'What changed', 'Checks', 'Deferred items', 'Blocked, stopped or prepared']) {
    assert.ok(text.includes(phrase), `Commit snapshot does not mention ${phrase}`);
  }
});
