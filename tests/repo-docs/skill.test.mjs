// The repo-docs skill text: what it finds before choosing a mode, and what maintain reports when nothing drifts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SKILL = readFileSync(new URL('../../plugins/repo-docs/skills/repo-docs/SKILL.md', import.meta.url), 'utf8');

test('R203: ignored files are listed, and an ignored root instruction file stops the run', () => {
  assert.ok(SKILL.includes('`git ls-files --others --ignored --exclude-standard` (ignored)'));
  assert.ok(SKILL.includes('An instruction file git ignores is the user\'s own: it is listed, reported, and never edited, moved or written over.'));
  assert.ok(SKILL.includes('When the root `CLAUDE.md` or `AGENTS.md` is ignored by git, say so and stop with nothing written.'));
  assert.ok(SKILL.includes('Bootstrap never writes over an existing `CLAUDE.md` or `AGENTS.md`, whether named or chosen: say so and stop.'));
});

test('R206: maintain finds every import and nested AGENTS.md again and lists them with no drift', () => {
  assert.ok(SKILL.includes('every `@path` line in the hub and in each spoke (an untracked import is reported)'));
  assert.ok(SKILL.includes('print `repo-docs: no drift`, then one line per reported item in the form `- <item>: <why>`, and write nothing.'));
});
