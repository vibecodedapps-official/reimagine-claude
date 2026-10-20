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

test('R87: Step 7.1 logs each commit as the commit line a later run reads', () => {
  assert.ok(section(PUBLISH, '7.1 Commit').includes('`- commit <full sha> <subject>`'));
});

test('R90: Step 7.4 comments on a done ticket only when no run logged a comment on it', () => {
  assert.ok(section(PUBLISH, '7.4 Ticket comments').includes('logs a comment on it'));
});

test('R86: a slice in the plan names a description input by its text file', () => {
  assert.ok(read('steps/1-plan.md').includes('or by `text-<k>.md` for a description'));
});

test('R92: Steps 3.6 and 3.7 run when Step 3 is reused', () => {
  const build = read('steps/4-build.md');
  assert.ok(build.includes('When Step 3 is reused, they still run'));
  assert.ok(build.includes('run only 3.7.2 and 3.7.4'));
});

const SKILL = read('SKILL.md');
const BUILD = read('steps/4-build.md');
const REPORT = read('report.md');
const RECORD = read('record.md');
const MULTI = read('multi-repo.md');

// The closing rules of pr-body.md, which sit after the body template's fence.
const closingRules = () => {
  const start = PR_BODY.indexOf('Closing rules:');
  const end = PR_BODY.indexOf('\n## Continued pull request comment');
  assert.ok(start !== -1 && end > start, 'pr-body.md has no closing rules before the continued comment');
  return PR_BODY.slice(start, end);
};

test('R117: an Azure DevOps ticket keeps the AB# form on github and takes a work item link on an Azure DevOps remote', () => {
  const text = closingRules();
  assert.ok(text.includes('On `github` write an Azure DevOps ticket as `Refs AB#<n>`.'));
  assert.ok(text.includes('`Refs [<type> <n>](https://dev.azure.com/<org>/<project>/_workitems/edit/<n>)`'));
  assert.ok(text.includes('`System.WorkItemType`'), 'the link text does not take the work item type');
  assert.ok(text.includes('`System.TeamProject`'), 'the link does not take the work item project');
  assert.ok(text.includes('`%20`'), 'the link does not encode spaces in the project');
});

test('R117: pr-body.md says a Refs line does not attach the work item', () => {
  assert.ok(closingRules().includes('A `Refs` line does not attach the work item to the pull request.'));
});

test('R215: on an Azure DevOps remote the body is always the short form, with the full body in the first comment', () => {
  assert.ok(PR_BODY.includes('the description is capped at 4,000 characters'));
  assert.ok(PR_BODY.includes('"Details are in the first comment."'));
  assert.ok(PR_BODY.includes('`<record>/comment-<n>.md`'));
});

test('R215: on other the body covers every input of every run of the record', () => {
  assert.ok(PR_BODY.includes('On a host other than `github`, the body always covers every input of every run of the record'));
});

test('R215: pr-body.md names both callers and hands back to the step that sent the run', () => {
  assert.ok(PR_BODY.split('\n')[2].includes('`steps/4-build.md`'), 'pr-body.md does not name Step 6 as a caller');
  assert.equal(PR_BODY.trimEnd().split('\n').at(-1), 'Return to the step that sent you here.');
});

test('R215: on other, Step 6 reads pr-body.md and writes the body before it ends prepared', () => {
  const text = section(BUILD, 'Step 6 Checks');
  assert.notEqual(text, null);
  const other = text.slice(text.indexOf('On any other host'));
  const reads = other.indexOf('read `pr-body.md`');
  assert.ok(reads !== -1, 'Step 6 does not read pr-body.md on other');
  assert.ok(reads < other.indexOf('`prepared`'), 'Step 6 ends prepared before it writes the body');
});

test('R215: a prepared run on a non-GitHub host names the comment file to post first', () => {
  assert.ok(section(SKILL, 'Terminal states').includes('`comment-<n>.md`'));
  assert.ok(section(REPORT, 'Sections').includes('`comment-<n>.md`'));
});

test('R215: a prepared run on a non-GitHub host still gives the pull request title', () => {
  assert.ok(section(SKILL, 'Terminal states').includes('in place of the `gh` command, give the title and name the body file'));
  assert.ok(section(REPORT, 'Sections').includes('in place of a `gh` command, the title, the absolute path of the body file'));
});

test('R215: SKILL.md reads pr-body.md at the end of Step 6 on other', () => {
  assert.ok(section(SKILL, 'Supporting files').includes('or, on `other`, at the end of Step 6'));
});

test('R215: the record writes the body and comment files at the end of Step 6 off github', () => {
  const files = section(RECORD, 'Files');
  assert.ok(files.includes('| `pr-body.md`, `pr-body-<slug>.md` | Step 7.2, or the end of Step 6 on `other` |'));
  assert.ok(files.includes('| `comment-<n>.md` | Step 7, or the end of Step 6 on an Azure DevOps remote |'));
});

test('R215: with several repositories on other, each body says its sibling links are added by hand', () => {
  assert.ok(MULTI.includes('the links between the pull requests are added by hand'));
});

test('R215: the Azure DevOps short form leaves What changed to the comment file, so only Closes grows with the inputs', () => {
  assert.ok(PR_BODY.includes('the body always takes the short form, with nothing measured: `## Related pull requests`, `## Closes`, and last the line "Details are in the first comment."'));
  assert.ok(!PR_BODY.includes('`## What changed` with one line per input'));
  assert.ok(PR_BODY.includes('Only `## Closes` grows with the inputs, one line per ticket.'));
});

test('R215: with several repositories on other, the body names take the run suffix and each comment file is named with its repository', () => {
  assert.ok(MULTI.includes('each with the run suffix from run 2 on, as `record.md`, Files, says'));
  assert.ok(MULTI.includes('one `comment-<n>.md` for each repository, numbered in turn, and the report names the repository each one goes with'));
  assert.ok(section(REPORT, 'Sections').includes('with several repositories, each file with the repository it goes with'));
});
