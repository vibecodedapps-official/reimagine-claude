// A second run on a record: reuse in every step file, and what Step 7 publishes on a continued branch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../plugins/loop/skills/run/${path}`, import.meta.url), 'utf8');
const PUBLISH = read('steps/7-publish.md');
const PR_BODY = read('pr-body.md');

// The text from a "## <heading>" line up to the next "## " heading.
const section = (text, heading) => {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start === -1) return null;
  const end = text.indexOf('\n## ', start + 1);
  return end === -1 ? text.slice(start) : text.slice(start, end);
};

test('R91: Step 7.2 updates the body of a pull request this loop opened with gh pr edit --body-file', () => {
  const text = section(PUBLISH, '7.2 Push and pull request');
  assert.notEqual(text, null);
  assert.ok(text.includes('gh pr edit <pr> --body-file <absolute path>'));
  assert.ok(text.includes('names it in `pr`'), 'Step 7.2 does not judge the pull request its own by runs[].pr');
});

test('R91: the continued pull request comment leaves the body alone only when this loop did not open the pull request', () => {
  const text = section(PR_BODY, 'Continued pull request comment');
  assert.notEqual(text, null);
  assert.ok(!text.includes('Its body is never edited.'));
  assert.ok(text.includes('when this loop opened the pull request'));
});

test('R90: Step 7.4 posts no ticket comment for a ticket that was done at Step 0', () => {
  const text = section(PUBLISH, '7.4 Ticket comments');
  assert.notEqual(text, null);
  assert.ok(text.includes('done at Step 0'));
});

test('R92: every step file applies the reuse rule of the record before it writes a step entry', () => {
  for (const file of ['steps/1-plan.md', 'steps/4-build.md', 'steps/7-publish.md']) {
    assert.ok(read(file).includes('`record.md`, Reuse and resume'), `${file} does not apply record.md, Reuse and resume`);
  }
});
