// The primer skill files: the directory contents, the frontmatter, the mode and write rules, the line cap, the shapes and the placement items.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const DIR = new URL('../../plugins/primer/skills/primer/', import.meta.url);
const SKILL = readFileSync(new URL('SKILL.md', DIR), 'utf8');
const SHAPES = readFileSync(new URL('shapes.md', DIR), 'utf8');
const PLACEMENT = readFileSync(new URL('placement.md', DIR), 'utf8');

function lineCount(text) {
  if (text === '') return 0;
  const newlines = text.split('\n').length - 1;
  return newlines + (text.endsWith('\n') ? 0 : 1);
}

test('R237: the skill directory holds SKILL.md, placement.md and shapes.md only', () => {
  assert.deepEqual(readdirSync(DIR).sort(), ['SKILL.md', 'placement.md', 'shapes.md']);
});

test('R245: the frontmatter names the skill, the four phrases first, and read-only tools', () => {
  const lines = SKILL.split(/\r?\n/);
  assert.equal(lines[0], '---');
  const end = lines.indexOf('---', 1);
  assert.ok(end > 1, 'the frontmatter has a closing ---');
  const front = lines.slice(1, end);
  assert.ok(front.includes('name: primer'));
  const description = front.find((l) => l.startsWith('description:'));
  assert.ok(description, 'a description line exists');
  const value = description.slice('description:'.length).trim().replace(/^'/, '');
  assert.ok(value.startsWith('Use when the user says "turn this into a skill", "we keep doing this", "add this to the project instructions" or "check the instruction files"'));
  const at = front.findIndex((l) => l.startsWith('allowed-tools:'));
  assert.ok(at >= 0, 'an allowed-tools line exists');
  const tools = [];
  for (const l of front.slice(at + 1)) {
    if (!l.startsWith('  ')) break;
    tools.push(l.replace(/^ {2}- /, ''));
  }
  assert.deepEqual(tools, [
    'Read',
    'Grep',
    'Glob',
    'Bash(git status *)',
    'Bash(git diff *)',
    'Bash(git log *)',
    'Bash(git show *)',
    'Bash(git rev-parse *)',
    'Bash(git ls-files *)',
    'Bash(git check-ignore *)',
    'Bash(git grep *)',
  ]);
});

test('R245: the mode is the first line, chosen from the files on disk', () => {
  assert.ok(SKILL.includes('- The first line of the reply, before any read beyond what choosing needs and before any write, is exactly `primer: mode <init|adopt|maintain> (<one-line reason>)`, with no text before it.'));
  assert.ok(SKILL.includes('The mode is chosen from the files on disk, ignored ones included.'));
  assert.ok(SKILL.includes('- A mode named after the command (`/primer adopt`) forces it. A forced `init` never writes over an existing `CLAUDE.md` or `AGENTS.md`: say so and stop.'));
  assert.ok(SKILL.includes('- Otherwise find the hub: the root `CLAUDE.md`; the root `AGENTS.md` when the root `CLAUDE.md` is exactly `@AGENTS.md` plus at most one newline; the root `AGENTS.md` when there is no root `CLAUDE.md`. Then, in order: the hub\'s line 1 is exactly `<!-- primer -->` and no line of it is exactly `## Spokes`: `maintain`. Else any `CLAUDE.md` or `AGENTS.md` exists at any depth, `.claude/CLAUDE.md` included: `adopt`. Else: `init`.'));
});

test('R246 and R247: the write boundary and the commit rules', () => {
  assert.ok(SKILL.includes('- Writes are documentation files only: `CLAUDE.md` and `AGENTS.md` at any depth, `.claude/rules/**`, `.claude/skills/**`, `README.md`, and Markdown under `docs/`.'));
  assert.ok(SKILL.includes('- Never edit code, configuration, settings, CI files, package manifests, `CLAUDE.local.md`, anything git ignores, or the auto memory directory. The one exception is a memory note the user approves for deletion in its own question.'));
  assert.ok(SKILL.includes('- Never install a git hook and never write a linter rule, a test or a hook.'));
  assert.ok(SKILL.includes('else `docs(primer): <subject>` in lowercase. The body\'s first line is `Instruction-file <mode> pass, <YYYY-MM-DD>.`, followed by why.'));
  assert.ok(SKILL.includes('- Stage only the paths the plan names, by path. Never push, amend, or pass `--no-verify`.'));
});

test('R248 and R247: init reads the repository, writes the hub uncommitted, proposes, and names /init', () => {
  assert.ok(SKILL.includes('2. Read `README.md`, package manifests and build files (their scripts and targets), CI workflows, the test layout, the top-level directories, `CONTRIBUTING.md`, and the files under `docs/` with their line counts.'));
  assert.ok(SKILL.includes('Leave it uncommitted and unstaged.'));
  assert.ok(SKILL.includes('Ask once which to write, by number. Write none without a yes; on a yes, write the ones named, uncommitted.'));
  assert.ok(SKILL.includes('`/init` is the host\'s unopinionated alternative: it writes a `CLAUDE.md` from its own reading of the repository, without the marker or these shapes.'));
  assert.ok(!SKILL.includes('primer: init is not in this prerelease'));
});

test('R249: adopt inventories, keeps pinned files, converts an index, moves before rewrites, and asks once', () => {
  assert.ok(SKILL.includes('3. Refactor a file only when it is over its cap, holds content for two scopes, or duplicates another. Every other file stays as it is.'));
  assert.ok(SKILL.includes('A link from a documentation file does not pin.'));
  assert.ok(SKILL.includes('a pointer whose condition is a file pattern becomes a path-scoped rule with that pattern in `paths`; one whose condition is a task becomes a skill; one whose condition is a directory becomes a nested `CLAUDE.md` in it.'));
  assert.ok(SKILL.includes('A procedure in `CONTRIBUTING.md` is proposed as a skill, and `CONTRIBUTING.md` stays as it is.'));
  assert.ok(SKILL.includes('Correct an untrue statement in the rewrite that holds it.'));
  assert.ok(SKILL.includes('8. On the yes, make the move commit first: the `git mv` of each move and the path edits of documentation links to the moved files, index lines included, and nothing else, so no commit leaves a broken link.'));
  assert.ok(!SKILL.includes('primer: adopt is not in this prerelease'));
});

test('R240: SKILL.md is within its cap of 150 lines, counted as the file has them', () => {
  assert.equal(lineCount('a\nb\nc'), 3);
  assert.equal(lineCount('a\nb\nc\n'), 3);
  assert.equal(lineCount(''), 0);
  const n = lineCount(SKILL);
  assert.ok(n <= 150, `SKILL.md has ${n} lines`);
});

test('R237: every skill file SKILL.md names exists', () => {
  const host = new Set(['CLAUDE.md', 'AGENTS.md', 'README.md', 'CLAUDE.local.md', 'MEMORY.md', 'SKILL.md', 'CONTRIBUTING.md', 'CHANGELOG.md']);
  const named = new Set();
  for (const m of SKILL.matchAll(/`([^`\n]+)`/g)) {
    if (/^[A-Za-z0-9_.-]+\.md$/.test(m[1]) && !host.has(m[1])) named.add(m[1]);
  }
  assert.deepEqual([...named].sort(), ['placement.md', 'shapes.md']);
  for (const name of named) assert.ok(existsSync(new URL(name, DIR)), `${name} exists`);
  assert.ok(SKILL.includes('read `shapes.md` and `placement.md` in this skill\'s directory.'));
});

test('R238 and R262: the shapes file opens the hub template with the marker and names the caps', () => {
  assert.ok(SHAPES.includes('- Hub: 60 lines. Nested `CLAUDE.md`: 60 lines. Rule: 200 lines. `SKILL.md`: 150 lines. `docs/` pages: no cap.'));
  assert.ok(SHAPES.replace(/\r\n/g, '\n').includes('```\n<!-- primer -->\n# <repository name>\n'));
});

test('R241 and R252: placement holds the eleven items in order and the personal-content form', () => {
  const lines = PLACEMENT.split(/\r?\n/);
  const start = lines.indexOf('## Items');
  assert.ok(start >= 0, 'an Items heading exists');
  let stop = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (stop < 0) stop = lines.length;
  const numbers = [];
  for (const l of lines.slice(start + 1, stop)) {
    const m = /^(\d+)\. /.exec(l);
    if (m) numbers.push(Number(m[1]));
  }
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.ok(PLACEMENT.includes('- <file>:<line>: <text>: belongs in <CLAUDE.local.md | your own CLAUDE.md | the rules plugin\'s house rules block>'));
});
