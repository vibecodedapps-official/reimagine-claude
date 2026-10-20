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

test('R82: Step 0.5 asks git about .reimagine/ with its trailing slash, so an excluded directory that does not exist yet reads as ignored', () => {
  const text = section(PREFLIGHT, '0.5 The record');
  assert.notEqual(text, null);
  assert.ok(text.includes('`git check-ignore -q .reimagine/`'));
  assert.ok(!text.includes('`git check-ignore -q .reimagine`'));
});

test('R86: Step 0.5 compares a description with the text files after the credentials decision', () => {
  assert.ok(PREFLIGHT.includes('holds the same text after the credentials decision'));
});

test('R92: the no-new-work path runs 3.7.2 and 3.7.4 before Step 6', () => {
  assert.ok(PREFLIGHT.includes('run 3.7.2 and 3.7.4 there, and go to Step 6'));
});

test('R74: SKILL.md says which remote is Azure DevOps by its four host forms', () => {
  const text = section(SKILL, 'Reading the request');
  assert.notEqual(text, null);
  for (const host of ['`dev.azure.com`', '`ssh.dev.azure.com`', '`vs-ssh.visualstudio.com`', 'ends in `.visualstudio.com`']) {
    assert.ok(text.includes(host), `Reading the request does not name ${host}`);
  }
  assert.ok(text.includes('On `ssh.dev.azure.com` and `vs-ssh.visualstudio.com` the organization is the segment after `v3/`, spelled `<host>:v3/` or `ssh://<host>/v3/`, and the project the segment after it.'), 'Reading the request does not say where the organization is in an ssh remote');
});

test('R74: host detection records whether an other remote is Azure DevOps, and its organization', () => {
  const text = section(PREFLIGHT, 'Host detection');
  assert.notEqual(text, null);
  assert.ok(text.includes('whether the remote is Azure DevOps'));
  assert.ok(text.includes('its organization and project'));
});

test('R215: on other, preflight sends the run to write its body file at the end of Step 6', () => {
  const text = section(PREFLIGHT, 'Host detection');
  assert.notEqual(text, null);
  assert.ok(text.includes('At the end of Step 6 it reads `pr-body.md` and writes the run\'s body file'));
});

test('R74: SKILL.md finds the organization and project of the visualstudio.com form and of the _git short form', () => {
  const text = section(SKILL, 'Reading the request');
  assert.notEqual(text, null);
  assert.ok(text.includes('On any other host ending in `.visualstudio.com`, the organization is the subdomain and the project the first path segment that is not `DefaultCollection`.'));
  assert.ok(text.includes('On `dev.azure.com` the organization is the first path segment and the project the second.'));
  assert.ok(text.includes('When the project segment is `_git`, as in `dev.azure.com/<org>/_git/<repo>`, the project has the repository\'s name.'));
  assert.ok(!text.includes('On any other host, which has the form'));
});
