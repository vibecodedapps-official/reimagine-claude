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

const SKILL = read('SKILL.md');

test('R83: a record whose pull request merged or closed ends preflight blocked', () => {
  const text = section(RECORD, 'An existing record');
  assert.ok(text.includes('gh pr view <n> --json state'));
  assert.ok(text.includes('"on branch <name>" form that starts a new branch'));
});

test('R86: a description matches its text file after the credentials decision, and a slice names it by that file', () => {
  assert.ok(RECORD.includes('whose text, after the credentials decision, equals an existing `text-<k>.md`'));
  assert.ok(section(RECORD, 'steps.json').includes('`text-<k>.md` for a description'));
});

test("R87: a commit is the loop's own only by a commit line in run.md", () => {
  assert.ok(RECORD.includes('as a line `- commit <full sha> <subject>`'));
  const text = section(RECORD, 'An existing record');
  assert.ok(text.includes('anywhere else, such as the base commit, a head or a planning snapshot, does not count'));
  assert.ok(!text.includes('a prefix of at least seven characters'));
});

test('R87: the branch tip is the remote head when the branch exists on the remote', () => {
  assert.ok(section(RECORD, 'An existing record').includes('`<tip>` is `refs/remotes/<remote>/<branch>` when the branch exists on the remote'));
});

test('R89: a slice committed outside the loop is found by the hashes of its files', () => {
  assert.ok(section(RECORD, 'steps.json').includes('git -C <checkout> hash-object -- <path>'));
  assert.ok(section(RECORD, 'An existing record').includes('git rev-parse <tip>:<path>'));
  assert.ok(section(SKILL, 'Final report handling').includes('its `files`'));
});

test("R90: a run with no new work publishes nothing only when the record's work is published", () => {
  const text = section(RECORD, 'An existing record');
  assert.ok(text.includes("The record's work is published when"));
  assert.ok(text.includes('Step 7 runs in full'));
});

test('R92: Step 4 is reused only when the slices it built are committed', () => {
  assert.ok(section(RECORD, 'Reuse and resume').includes('to have a `commit` on the branch'));
});

test('R92: Step 3.7 sets up the checkout when Step 3 is reused and on the no-new-work path', () => {
  const text = section(RECORD, 'Reuse and resume');
  assert.ok(text.includes('so it runs also when Step 3 is reused'));
  assert.ok(text.includes('run only 3.7.2 and 3.7.4'));
});

test('R96: under commit: true a run with no new work on published work posts no report comment', () => {
  assert.ok(section(RECORD, 'Commit snapshot').includes('except on the no-new-work path of published work'));
  assert.ok(section(SKILL, 'Final report handling').includes('no-new-work path of published work posts nothing'));
});

test('R90: work is published when its pull request is open, whoever opened it', () => {
  const text = section(RECORD, 'An existing record');
  assert.ok(text.includes('Step 0.2 item 7 found one open pull request on the branch'));
  assert.ok(!text.includes('found an open pull request that a `runs` entry names in `pr`'));
});
