// The repo-docs skill text: what it finds before choosing a mode, what bootstrap points to, and what maintain reports when nothing drifts.
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

test('R204: adopt checks what it keeps against the code, so the second run finds no drift', () => {
  assert.ok(SKILL.includes('Check every statement you keep or write against the code it describes, as maintain does: a command does what its line says, and a rule names files and behavior that exist. Correct a statement the code makes untrue in the rewrite that carries it, and list it under `Rewrites`.'));
});

test('R206: maintain finds every import and nested AGENTS.md again and lists them with no drift', () => {
  assert.ok(SKILL.includes('every `@path` line in the hub and in each spoke (an untracked import is reported)'));
  assert.ok(SKILL.includes('print `repo-docs: no drift`, then one line per reported item in the form `- <item>: <why>`, and write nothing.'));
});

test('R198: bootstrap points only to files within the spoke cap and names a longer one in plain text', () => {
  assert.ok(SKILL.includes('a pointer for each existing file under `docs/` that an agent needs for some task and that has at most 200 lines, with a condition saying when. A needed file over 200 lines gets no pointer, since the hook denies every commit while a spoke is over its cap: name it in plain text in the opening sentences with when to read it, and say in the reply that it is over the cap.'));
  assert.ok(SKILL.includes('4. Check the hub before you finish: at most 60 lines, every pointer in the pointer form, every path it names exists, every file it points to at most 200 lines.'));
});
