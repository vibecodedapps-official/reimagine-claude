// House rules. The pure functions run on fake rule texts with literal digests; main() runs on temporary directories set
// through CLAUDE_CONFIG_DIR and home, so no test reads or writes the real ~/.claude.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, linkSync, realpathSync, statSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  adoptRules, defaultOptions, diff, imports, inspect, loadTexts, main, parseOptions, planTarget, pluginVersion, removeBlock, render, scanImports, targets, units,
} from '../../plugins/rules/scripts/rules.mjs';

const SCRIPT = fileURLToPath(new URL('../../plugins/rules/scripts/rules.mjs', import.meta.url));
// The bytes EF BB BF (a UTF-8 byte order mark) and FF (never valid UTF-8), as latin1 reads them.
const BOM = '\u00ef\u00bb\u00bf';
const FF = '\u00ff';
const TEXTS = { 'core.md': 'C1\nC2\n', 'windows.md': 'WC\n' };
const END = '<!-- reimagine:house-rules end -->';
const begin = (options, join, digest, version = '0.0.1') =>
  `<!-- reimagine:house-rules begin version=${version} options=${options} join=${join} digest=${digest} -->`;
const plan = (text, more = {}) => planTarget({ text, version: '9.9.9', texts: TEXTS, platform: 'linux', ...more });
// The current block for core on LF, as this file's fake texts render it.
const CORE_LF = `${begin('core', 'blank', 'cb477dddc15de845', '9.9.9')}\nC1\nC2\n${END}\n`;
// The digest of the shipped body for options core, as the script printed it.
const SHIPPED_CORE_DIGEST = 'fb0beeaaf8e7f02f';

test('R25: the block version is the version in the manifest of the plugin root, and the shipped manifest is 0.1.0', () => {
  assert.equal(pluginVersion(), '0.1.0');
  const dir = mkdtempSync(join(tmpdir(), 'rules-test-'));
  try {
    mkdirSync(join(dir, '.claude-plugin'));
    writeFileSync(join(dir, '.claude-plugin/plugin.json'), '{"version":"1.2.3"}\n');
    assert.equal(pluginVersion(dir), '1.2.3');
    writeFileSync(join(dir, '.claude-plugin/plugin.json'), '{');
    assert.throws(() => pluginVersion(dir), SyntaxError);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('R18: the shipped body has a fixed digest for options core and for options core,windows', () => {
  const texts = loadTexts();
  assert.equal(plan(null, { texts, options: ['core'] }).digest, 'fb0beeaaf8e7f02f');
  assert.equal(plan(null, { texts, options: ['core', 'windows'], platform: 'win32' }).digest, 'a08ab3d815a1d9af');
});

test('R18: the Windows paragraph is in the block only when the windows option is', () => {
  const texts = loadTexts();
  assert.match(texts['windows.md'], /^On Windows, Bash is Git Bash/);
  assert.equal(texts['core.md'].includes('On Windows, Bash is Git Bash'), false);
  assert.equal(plan(null, { texts }).after.includes('On Windows, Bash is Git Bash'), false);
  assert.equal(plan(null, { texts, platform: 'win32' }).after.includes('On Windows, Bash is Git Bash'), true);
});

test('R19: core.md holds the item that sends a question to a tool, integration or file first', () => {
  const items = units(loadTexts()['core.md']).list.filter((u) => u.kind === 'item').map((u) => u.norm);
  assert.ok(items.includes('When a tool, integration, or file in the session can answer a question, use it before asking me.'));
});

test('R20: core.md holds the item that asks for one report, with no progress notes', () => {
  const items = units(loadTexts()['core.md']).list.filter((u) => u.kind === 'item').map((u) => u.norm);
  assert.ok(items.includes('Report once, when the task is done or when the next step turns on my answer; no progress notes unless I ask for them.'));
});

test('R36: render joins the parts with one empty line, windows before core, in the line ending given', () => {
  assert.equal(render(['core'], TEXTS), 'C1\nC2\n');
  assert.equal(render(['core', 'windows'], TEXTS), 'WC\n\nC1\nC2\n');
  assert.equal(render(['windows', 'core'], TEXTS), 'WC\n\nC1\nC2\n');
  assert.equal(render(['core'], TEXTS, '\r\n'), 'C1\r\nC2\r\n');
  assert.equal(render(['core', 'windows'], TEXTS, '\r\n'), 'WC\r\n\r\nC1\r\nC2\r\n');
});

test('R36: core is the default, with windows added on Windows', () => {
  assert.deepEqual(defaultOptions('linux'), ['core']);
  assert.deepEqual(defaultOptions('darwin'), ['core']);
  assert.deepEqual(defaultOptions('win32'), ['core', 'windows']);
  assert.deepEqual(plan(null, { platform: 'win32' }).options, ['core', 'windows']);
  assert.equal(plan(null, { platform: 'win32' }).digest, 'd6a8ad4498204e38');
});

test('R36: --options is checked and put in order, core is always in, and windows is refused off Windows', () => {
  assert.deepEqual(parseOptions('core', 'linux'), ['core']);
  assert.deepEqual(parseOptions('windows,core', 'win32'), ['core', 'windows']);
  assert.deepEqual(parseOptions('windows', 'win32'), ['core', 'windows']);
  assert.deepEqual(parseOptions(' core , windows ', 'win32'), ['core', 'windows']);
  assert.throws(() => parseOptions('windows', 'darwin'), { message: 'the windows option is offered only on Windows' });
  assert.throws(() => parseOptions('core,windows', 'linux'), { message: 'the windows option is offered only on Windows' });
  assert.throws(() => parseOptions('core,bogus', 'linux'),
    { message: '--options takes a comma-separated list of core, windows; got "core,bogus"' });
  assert.throws(() => parseOptions('', 'linux'), { message: '--options takes a comma-separated list of core, windows; got ""' });
});

test('R36: recorded options are kept on a rerun, and --options overrides them', () => {
  assert.deepEqual(plan(null, { recorded: ['core', 'windows'] }).options, ['core', 'windows']);
  assert.equal(plan(null, { recorded: ['core', 'windows'] }).digest, 'd6a8ad4498204e38');
  assert.deepEqual(plan(null, { recorded: ['core', 'windows'], options: ['core'] }).options, ['core']);
  assert.equal(plan(null, { recorded: ['core', 'windows'], options: ['core'] }).digest, 'cb477dddc15de845');
  // A block in the file keeps its own options, whatever the platform default.
  assert.equal(plan(`mine\n\n${CORE_LF}`, { platform: 'win32' }).state, 'current');
});

test('R25: a missing file gets the block with join=none, and the block ends with a line ending', () => {
  const p = plan(null);
  assert.equal(p.state, 'absent');
  assert.equal(p.after, `${begin('core', 'none', 'cb477dddc15de845', '9.9.9')}\nC1\nC2\n${END}\n`);
  assert.equal(p.digest, 'cb477dddc15de845');
  assert.deepEqual(p.options, ['core']);
  assert.equal(plan('').after, `${begin('core', 'none', 'cb477dddc15de845', '9.9.9')}\nC1\nC2\n${END}\n`);
});

test('R25, R23: a file with a final newline gets join=blank, one empty line', () => {
  assert.equal(plan('mine\n').after, `mine\n\n${begin('core', 'blank', 'cb477dddc15de845', '9.9.9')}\nC1\nC2\n${END}\n`);
});

test('R25, R23: a file without a final newline gets join=newline, a line break and an empty line', () => {
  assert.equal(plan('mine').after, `mine\n\n${begin('core', 'newline', 'cb477dddc15de845', '9.9.9')}\nC1\nC2\n${END}\n`);
});

test('R25: a CRLF file gets a CRLF block, with the digest of the body in LF', () => {
  assert.equal(plan('mine\r\n').after,
    `mine\r\n\r\n${begin('core', 'blank', 'cb477dddc15de845', '9.9.9')}\r\nC1\r\nC2\r\n${END}\r\n`);
});

test('R23: a byte order mark and a byte that is not UTF-8 are kept, as latin1 characters', () => {
  const bom = `${BOM}mine ${FF}\n`;
  assert.equal(plan(bom).after, `${bom}\n${begin('core', 'blank', 'cb477dddc15de845', '9.9.9')}\nC1\nC2\n${END}\n`);
});

test('R26: absent, current, stale, edited and declined each plan as the table says', () => {
  assert.equal(plan('mine\n').state, 'absent');
  assert.deepEqual(plan(`mine\n\n${CORE_LF}`), { state: 'current', after: null, options: ['core'] });
  const stale = plan(`mine\n\n${begin('core', 'blank', 'be1ba97540b68c56')}\nC1\nOLD\n${END}\n`);
  assert.equal(stale.state, 'stale');
  assert.equal(stale.after, `mine\n\n${CORE_LF}`);
  assert.equal(stale.declined, false);
  assert.deepEqual(plan(`mine\n\n${begin('core', 'blank', 'cb477dddc15de845')}\nC1\nEDIT\n${END}\n`), {
    state: 'edited', after: null, options: ['core'], edits: ['C1\nC2\n', 'C1\nEDIT\n'],
    note: 'the block was edited by hand; move your lines below the end marker, then run /rules again',
  });
  assert.equal(plan('mine\n', { declined: ['cb477dddc15de845'] }).declined, true);
  assert.equal(plan(`${begin('core', 'none', 'be1ba97540b68c56')}\nC1\nOLD\n${END}\n`, { declined: ['cb477dddc15de845'] }).declined, true);
});

test('R26, R42: a block reads the same after its file changes line ending, and a hand edit stays edited', () => {
  const lf = `mine\n\n${CORE_LF}`;
  const crlf = `mine\r\n\r\n${begin('core', 'blank', 'cb477dddc15de845', '9.9.9')}\r\nC1\r\nC2\r\n${END}\r\n`;
  assert.equal(plan(lf).state, 'current');
  assert.equal(plan(crlf).state, 'current');
  assert.equal(plan(crlf.replace(/\r\n/g, '\n')).state, 'current');
  assert.equal(plan(lf.replace(/\n/g, '\r\n')).state, 'current');
  const old = `mine\r\n\r\n${begin('core', 'blank', 'be1ba97540b68c56')}\r\nC1\r\nOLD\r\n${END}\r\n`;
  assert.equal(plan(old).state, 'stale');
  assert.equal(plan(old.replace(/\r\n/g, '\n')).state, 'stale');
  assert.equal(plan(crlf.replace('C2', 'EDIT')).state, 'edited');
  assert.equal(plan(crlf.replace('C2', 'EDIT').replace(/\r\n/g, '\n')).state, 'edited');
});

test('R32: a decline recorded for the text matches a CRLF file, and the digest recorded is the LF one', () => {
  assert.equal(plan('mine\r\n', { declined: ['cb477dddc15de845'] }).declined, true);
  assert.equal(plan('mine\r\n').digest, 'cb477dddc15de845');
});

test('R26: a version change alone, with the same rules, is current', () => {
  assert.equal(plan(`${begin('core', 'none', 'cb477dddc15de845', '0.0.1')}\nC1\nC2\n${END}\n`).state, 'current');
});

test('R26, R23: a stale block in the middle is replaced in place, and the text below the end marker is kept', () => {
  const p = plan(`top\n\n${begin('core', 'blank', 'be1ba97540b68c56')}\nC1\nOLD\n${END}\nbelow\n`);
  assert.equal(p.after, `top\n\n${CORE_LF}below\n`);
});

test('R25: a stale CRLF block stays CRLF', () => {
  const p = plan(`mine\r\n\r\n${begin('core', 'blank', 'be1ba97540b68c56')}\r\nC1\r\nOLD\r\n${END}\r\n`);
  assert.equal(p.after, `mine\r\n\r\n${begin('core', 'blank', 'cb477dddc15de845', '9.9.9')}\r\nC1\r\nC2\r\n${END}\r\n`);
});

test('R23: an end marker with no final newline is replaced without adding one', () => {
  const p = plan(`${begin('core', 'none', 'be1ba97540b68c56')}\nC1\nOLD\n${END}`);
  assert.equal(p.after, `${begin('core', 'none', 'cb477dddc15de845', '9.9.9')}\nC1\nC2\n${END}`);
});

test('R26: each malformed shape is reported with its line numbers and writes nothing', () => {
  const b = begin('core', 'none', 'cb477dddc15de845');
  const cases = [
    [`a\n${b}\nC1\n`, '1 begin and 0 end markers, at lines 2'],
    [`a\n${END}\n`, '0 begin and 1 end markers, at lines 2'],
    [`${b}\n${b}\nC1\n${END}\n`, '2 begin and 1 end markers, at lines 1, 2, 4'],
    [`${END}\nC1\n${b}\n`, 'the end marker comes before the begin marker, at lines 1, 3'],
    ['<!-- reimagine:house-rules begin version=1 options=core -->\nC1\n' + `${END}\n`, 'the begin marker cannot be read, at lines 1, 3'],
    [`${begin('core,bogus', 'none', 'cb477dddc15de845')}\nC1\n${END}\n`, 'the begin marker cannot be read, at lines 1, 3'],
  ];
  for (const [text, note] of cases) {
    assert.deepEqual(plan(text), { state: 'malformed', after: null, note });
    assert.deepEqual(plan(text, { remove: true }), { state: 'malformed', after: null, note });
  }
});

test('R26: inspect finds a CRLF block by its byte offsets', () => {
  const text = `ab\r\n${begin('core', 'none', 'cb477dddc15de845')}\r\nC1\r\n${END}\r\nz`;
  const found = inspect(text);
  assert.deepEqual(found, { kind: 'block', start: 4, bodyStart: 103, bodyEnd: 107, end: 143, version: '0.0.1', options: ['core'], join: 'none', digest: 'cb477dddc15de845' });
  assert.equal(text.slice(found.bodyStart, found.bodyEnd), 'C1\r\n');
});

test('R31: remove takes the block and the bytes of its join, for each join value', () => {
  const b = (j) => `${begin('core', j, 'cb477dddc15de845')}\nC1\nC2\n${END}\n`;
  assert.equal(removeBlock(b('none'), inspect(b('none'))), '');
  assert.equal(removeBlock(`mine\n\n${b('blank')}`, inspect(`mine\n\n${b('blank')}`)), 'mine\n');
  assert.equal(removeBlock(`mine\n\n${b('newline')}`, inspect(`mine\n\n${b('newline')}`)), 'mine');
  const crlf = `mine\r\n\r\n${begin('core', 'blank', 'cb477dddc15de845')}\r\nC1\r\nC2\r\n${END}\r\n`;
  assert.equal(removeBlock(crlf, inspect(crlf)), 'mine\r\n');
  // Join bytes are taken only when that joins no two lines of the user's text.
  assert.equal(removeBlock(`mine\n${b('blank').replace('blank', 'newline')}`, inspect(`mine\n${b('newline')}`)), 'mine\n');
  assert.equal(removeBlock(`last line\n\n${b('newline')}below\n`, inspect(`last line\n\n${b('newline')}below\n`)), 'last line\n\nbelow\n');
  assert.equal(removeBlock(`a\n${b('blank')}b\n`, inspect(`a\n${b('blank')}b\n`)), 'a\nb\n');
  assert.equal(removeBlock(`a\n${b('blank')}`, inspect(`a\n${b('blank')}`)), 'a\n');
  const crlfJoined = `a\r\n${begin('core', 'blank', 'cb477dddc15de845')}\r\nC1\r\nC2\r\n${END}\r\nb\r\n`;
  assert.equal(removeBlock(crlfJoined, inspect(crlfJoined)), 'a\r\nb\r\n');
  const middle = `top\n\n${b('blank')}below\n`;
  assert.deepEqual(plan(middle, { remove: true }), { state: 'remove', after: 'top\nbelow\n', options: ['core'], recommend: 'apply' });
  assert.deepEqual(plan('mine\n', { remove: true }), { state: 'absent', after: null, note: 'there is no block to remove' });
});

test('R31: remove of a block with a line typed into it is edited, with nothing to write', () => {
  const text = `${begin('core', 'blank', 'cb477dddc15de845')}\nC1\nC2\nmine\n${END}\n`;
  const p = plan(text, { remove: true });
  assert.equal(p.state, 'edited');
  assert.equal(p.after, null);
});

test('R31, R23: install then remove gives back the original bytes for LF, CRLF, BOM and no final newline', () => {
  for (const original of ['', 'mine\n', 'mine', 'one\r\ntwo\r\n', 'one\r\ntwo', `${BOM}mine\n`, `${BOM}mine`]) {
    const installed = plan(original).after;
    assert.equal(plan(installed, { remove: true }).after, original, JSON.stringify(original));
  }
});

test('diff shows the changed lines with three lines of context', () => {
  assert.equal(diff('a\nb\nc\nd\n', 'a\nb\nc\nd\n\nX\n', 'f', 'f (proposed)'), '--- f\n+++ f (proposed)\n@@ line 2 @@\n b\n c\n d\n+\n+X');
  assert.equal(diff('a\nOLD\nz\n', 'a\nNEW\nz\n', 'f', 'g'), '--- f\n+++ g\n@@ line 1 @@\n a\n-OLD\n+NEW\n z');
  assert.equal(diff('', 'X\n', 'f', 'g'), '--- f\n+++ g\n@@ line 1 @@\n+X');
});

// main() on temporary directories. AT and LATER are the injected clocks for backup names.
const AT = new Date('2026-10-03T12:00:00Z');
const LATER = new Date('2026-10-03T12:00:01Z');
const SHIPPED = loadTexts();

function sandbox(fn) {
  return async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'rules-test-'));
    const s = { root, claudeDir: join(root, 'claude'), data: join(root, 'data'), home: join(root, 'home') };
    s.claude = join(s.claudeDir, 'CLAUDE.md');
    s.env = { CLAUDE_CONFIG_DIR: s.claudeDir };
    mkdirSync(s.home);
    s.run = (verb, rest = [], { now = AT, platform = 'linux' } = {}) => main([verb, s.data, ...rest], { env: s.env, platform, now, home: s.home });
    // The script as a process, on the real platform, with the sandbox as its config and home.
    s.procEnv = () => ({ ...process.env, ...s.env, HOME: s.home, USERPROFILE: s.home });
    s.spawn = (verb, rest = []) => spawnSync(process.execPath, [SCRIPT, verb, s.data, ...rest], { env: s.procEnv(), encoding: 'utf8' });
    s.state = () => JSON.parse(readFileSync(join(s.data, 'rules-state.json'), 'utf8'));
    s.planFile = () => JSON.parse(readFileSync(join(s.data, 'rules-plan.json'), 'utf8'));
    try { return await fn(s, t); } finally { rmSync(root, { recursive: true, force: true }); }
  };
}
const bytes = (path) => readFileSync(path, 'latin1');
const put = (path, text) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, text, 'latin1'); };

test('R22, R27: a saved plan keeps a Unicode config path, and apply writes there', sandbox((s) => {
  s.env.CLAUDE_CONFIG_DIR = join(s.root, 'claude-\u00e9\u6f22');
  const claude = join(s.root, 'claude-\u00e9\u6f22', 'CLAUDE.md');
  s.run('plan');
  assert.equal(s.planFile().path, claude);
  assert.deepEqual(s.run('apply'), [`rules: wrote ${claude}`]);
  assert.equal(existsSync(claude), true);
}));

test('R23, R27: reports decode UTF-8 text while paths and file bytes are kept', sandbox((s) => {
  s.env.CLAUDE_CONFIG_DIR = join(s.root, 'claude-\u00e9');
  const path = join(s.root, 'claude-\u00e9', 'CLAUDE.md');
  const original = '# Jos\u00c3\u00a9\n@notes-\u00c3\u00bc.md\n';
  put(path, original);
  const out = s.run('plan');
  assert.equal(out[0], `target: ${path}`);
  assert.equal(out.includes('note: line 2: @notes-\u00fc.md imports a file that cannot be read; it is left as it is'), true);
  const shown = out.find((line) => line.startsWith('--- '));
  assert.equal(shown.split('\n').includes(' # Jos\u00e9'), true);
  assert.equal(shown.split('\n')[0], `--- ${path}`);
  s.run('apply');
  assert.equal(bytes(path).startsWith(original), true);
  put(path, bytes(path).replace('<!-- reimagine:house-rules end -->', 'Se\u00c3\u00b1or line\n<!-- reimagine:house-rules end -->'));
  assert.equal(s.run('plan').some((line) => line.split('\n').includes('+Se\u00f1or line')), true);
  put(path, `${BOM}# Mine\n${FF}\n`);
  const unusual = s.run('plan').find((line) => line.startsWith('--- '));
  assert.equal(unusual.split('\n').includes(' \ufeff# Mine'), true);
  assert.equal(unusual.split('\n').includes(' \ufffd'), true);
}));

test('R36: options refuse leftover arguments and empty list items', sandbox((s) => {
  assert.throws(() => s.run('plan', ['--options', 'core,', 'windows']), { message: 'unexpected argument "windows" after --options list' });
  assert.throws(() => s.run('plan', ['--options', 'core,']), { message: '--options takes a comma-separated list of core, windows; got "core,"' });
  assert.throws(() => s.run('plan', ['--options', 'core', 'windows']), { message: 'unexpected argument "windows" after --options list' });
  assert.equal(s.run('plan', ['--options', 'core, windows'], { platform: 'win32' }).includes('options: core,windows'), true);
}));

test('R22: the target comes from CLAUDE_CONFIG_DIR, else from the home directory', sandbox((s) => {
  assert.deepEqual(targets(s.env, s.home), { path: s.claude, logical: s.claude });
  assert.equal(targets({}, s.home).path, join(s.home, '.claude', 'CLAUDE.md'));
  assert.equal(targets({ CLAUDE_CONFIG_DIR: '' }, s.home).path, join(s.home, '.claude', 'CLAUDE.md'));
}));

test('R22: with CLAUDE_CONFIG_DIR unset, plan and apply use the CLAUDE.md under the home directory', sandbox((s) => {
  s.env = {};
  const path = join(s.home, '.claude', 'CLAUDE.md');
  assert.equal(s.run('plan')[0], `target: ${path}`);
  assert.deepEqual(s.run('apply'), [`rules: wrote ${path}`]);
  assert.equal(existsSync(path), true);
  assert.equal(existsSync(s.claude), false);
}));

test('R36, R37: status reports the default options on a first run, and the recorded ones after an apply', sandbox((s) => {
  assert.deepEqual(s.run('status'), [`state: absent ${s.claude} options=core (default)`, 'options recorded: no']);
  assert.deepEqual(s.run('status', [], { platform: 'win32' }), [`state: absent ${s.claude} options=core,windows (default)`, 'options recorded: no']);
  s.run('plan', ['--options', 'core,windows'], { platform: 'win32' });
  s.run('apply');
  assert.deepEqual(s.state().options, ['core', 'windows']);
  assert.deepEqual(s.run('status'), [`state: current ${s.claude} options=core,windows`, 'options recorded: yes']);
  // A rerun with no --options keeps the recorded options, so it plans no change.
  assert.deepEqual(s.run('plan').slice(-3), ['state: current', 'options: core,windows', 'change: none']);
  assert.throws(() => s.run('plan', ['--options', 'windows']), { message: 'the windows option is offered only on Windows' });
  // The options stay recorded after the file is deleted.
  rmSync(s.claude);
  assert.deepEqual(s.run('status'), [`state: absent ${s.claude} options=core,windows`, 'options recorded: yes']);
}));

test('R18, R36: the windows option puts the shipped Windows paragraph before the core rules in the block', sandbox((s) => {
  s.run('plan', ['--options', 'core,windows'], { platform: 'win32' });
  s.run('apply');
  const lines = bytes(s.claude).split('\n');
  assert.match(lines[0], /^<!-- reimagine:house-rules begin version=0\.1\.0 options=core,windows join=none digest=[0-9a-f]{16} -->$/);
  assert.equal(lines.slice(1).join('\n'), `${SHIPPED['windows.md']}\n${SHIPPED['core.md']}${END}\n`);
}));

test('R36: adopt on a block that holds the windows option runs off Windows when no --options is given', sandbox((s) => {
  s.run('plan', ['--options', 'core,windows'], { platform: 'win32' });
  s.run('apply', [], { platform: 'win32' });
  const rule = `- Make the calls within the task, architecture included; someone else's area is no
  reason by itself to defer. Explain the ones that matter in a line. Ask only for my
  preference, an authority I lack, a fact you can't find, or input that avoids a costly
  or hard-to-undo mistake. Ask with one recommendation and its tradeoffs; add a second
  option only when it wins under a condition I control, and name it. Do the work that
  doesn't depend on the answer first.
`;
  put(s.claude, `${bytes(s.claude)}${rule}`);
  assert.throws(() => s.run('plan', ['--adopt', '--options', 'core,windows'], { platform: 'linux' }),
    { message: 'the windows option is offered only on Windows' });
  const out = s.run('plan', ['--adopt'], { platform: 'linux' });
  assert.equal(out.includes('options: core,windows'), true);
  assert.equal(out.includes('change: ready'), true);
}));

test('R26: plan writes nothing for current, malformed and edited targets', sandbox((s) => {
  s.run('plan');
  s.run('apply');
  const current = s.run('plan');
  assert.ok(current.includes('state: current'));
  assert.ok(current.includes('change: none'));
  assert.deepEqual(s.planFile(), {});
  const text = bytes(s.claude);
  put(s.claude, `mine\n${END}\n`);
  const malformed = s.run('plan');
  assert.ok(malformed.includes('state: malformed; 0 begin and 1 end markers, at lines 2'));
  assert.ok(malformed.includes('change: none'));
  assert.deepEqual(s.planFile(), {});
  put(s.claude, text.replace('## Working', '## Working (mine)'));
  assert.equal(s.run('status')[0], `state: edited ${s.claude} options=core`);
  const edited = s.run('plan');
  assert.ok(edited.includes('state: edited; the block was edited by hand; move your lines below the end marker, then run /rules again'));
  const shown = edited.join('\n');
  assert.ok(shown.includes(`--- the rules this plugin would write\n+++ the block in ${s.claude}\n@@ line `));
  assert.ok(shown.includes('\n-## Working\n+## Working (mine)\n'));
  assert.deepEqual(s.planFile(), {});
}));

test('R27: apply refuses when the target changed after the plan, and writes nothing', sandbox((s) => {
  put(s.claude, 'mine\n');
  s.run('plan');
  put(s.claude, 'mine, changed\n');
  assert.throws(() => s.run('apply'),
    { message: `${s.claude} changed after the diff was shown, so nothing was written; run /rules again` });
  assert.equal(bytes(s.claude), 'mine, changed\n');
  assert.deepEqual(readdirSync(s.claudeDir), ['CLAUDE.md']);
}));

test('R27: a file created after the plan, where none was, is a change too', sandbox((s) => {
  s.run('plan');
  put(s.claude, 'new\n');
  assert.throws(() => s.run('apply'),
    { message: `${s.claude} changed after the diff was shown, so nothing was written; run /rules again` });
  assert.equal(bytes(s.claude), 'new\n');
}));

test('R27: apply with no saved plan, or after the plan was used, refuses', sandbox((s) => {
  assert.throws(() => s.run('apply'), { message: 'there is no planned change; run /rules again' });
  s.run('plan');
  s.run('apply');
  assert.throws(() => s.run('apply'), { message: 'there is no planned change; run /rules again' });
  assert.deepEqual(s.planFile(), {});
}));

test('R29: an existing file is backed up with the time in its name, and no temporary file is left', sandbox((s) => {
  put(s.claude, 'mine\n');
  s.run('plan');
  assert.deepEqual(s.run('apply'), [`rules: wrote ${s.claude}; the backup is ${s.claude}.reimagine-backup-20261003120000`]);
  assert.deepEqual(readdirSync(s.claudeDir).sort(), ['CLAUDE.md', 'CLAUDE.md.reimagine-backup-20261003120000']);
  assert.equal(bytes(`${s.claude}.reimagine-backup-20261003120000`), 'mine\n');
  assert.ok(bytes(s.claude).startsWith('mine\n\n<!-- reimagine:house-rules begin version=0.1.0 options=core join=blank digest='));
  assert.equal(s.state().created, false);
  assert.deepEqual(readdirSync(s.data).sort(), ['rules-plan.json', 'rules-state.json']);
}));

test('R29: a backup that already exists is never overwritten, and nothing is written', sandbox((s) => {
  put(s.claude, 'mine\n');
  put(`${s.claude}.reimagine-backup-20261003120000`, 'older backup\n');
  s.run('plan');
  assert.throws(() => s.run('apply'),
    { message: `could not back up ${s.claude} to ${s.claude}.reimagine-backup-20261003120000 (EEXIST); nothing was written` });
  assert.equal(bytes(s.claude), 'mine\n');
  assert.equal(bytes(`${s.claude}.reimagine-backup-20261003120000`), 'older backup\n');
}));

test('R29, R31: a missing file is created and recorded, and remove deletes it with no backup', sandbox((s) => {
  s.run('plan');
  assert.deepEqual(s.run('apply'), [`rules: wrote ${s.claude}`]);
  assert.equal(s.state().created, true);
  assert.deepEqual(readdirSync(s.claudeDir), ['CLAUDE.md']);
  s.run('remove', [], { now: LATER });
  assert.deepEqual(s.run('apply', [], { now: LATER }), [`rules: removed ${s.claude}, which /rules had created and which held nothing else`]);
  assert.deepEqual(readdirSync(s.claudeDir), []);
  assert.deepEqual(s.state(), { created: false, declined: [] });
}));

test('R29, R31: remove refuses a block the user edited, so the file and its lines stay', sandbox((s) => {
  s.run('plan');
  s.run('apply');
  const text = bytes(s.claude), marker = text.lastIndexOf(END);
  put(s.claude, `${text.slice(0, marker)}MY OWN RULE\n${text.slice(marker)}`);
  const edited = bytes(s.claude);
  const out = s.run('remove', [], { now: LATER });
  assert.ok(out.includes('state: edited; the block was edited by hand; move your lines below the end marker, then run /rules --remove again'));
  assert.equal(out.at(-1), 'change: none');
  assert.equal(bytes(s.claude), edited);
  assert.deepEqual(s.planFile(), {});
  assert.throws(() => s.run('apply', [], { now: LATER }), { message: 'there is no planned change; run /rules again' });
}));

test('R31: a created file that the user added to is kept on remove, holding only the user text', sandbox((s) => {
  s.run('plan');
  s.run('apply');
  put(s.claude, `${bytes(s.claude)}mine\n`);
  s.run('remove', [], { now: LATER });
  assert.deepEqual(s.run('apply', [], { now: LATER }), [`rules: wrote ${s.claude}; the backup is ${s.claude}.reimagine-backup-20261003120001`]);
  assert.equal(bytes(s.claude), 'mine\n');
}));

test('R23, R31: install then remove leaves each fixture file equal to its original bytes', async () => {
  const fixtures = {
    'join none, an empty file': '',
    'join blank, LF': '# Mine\n\nKeep this.\n',
    'join newline, no final newline': '# Mine\n\nKeep this.',
    CRLF: '# Mine\r\n\r\nKeep this.\r\n',
    'CRLF, no final newline': '# Mine\r\n\r\nKeep this.',
    'BOM and a non-UTF-8 byte': `${BOM}# Mine ${FF}\n`,
  };
  for (const [label, original] of Object.entries(fixtures)) {
    await sandbox((s) => {
      put(s.claude, original);
      s.run('plan');
      s.run('apply');
      const installed = bytes(s.claude);
      assert.ok(installed.startsWith(original), label);
      if (label.startsWith('CRLF')) assert.equal(installed.replace(/\r\n/g, '').includes('\n'), false, 'the block uses CRLF');
      else assert.equal(installed.includes('\r'), false, label);
      s.run('remove', [], { now: LATER });
      s.run('apply', [], { now: LATER });
      assert.equal(bytes(s.claude), original, label);
      assert.equal(bytes(`${s.claude}.reimagine-backup-20261003120000`), original, label);
    })();
  }
});

test('R32: a decline is recorded with its digest, and the next plan says so', sandbox((s) => {
  const old = `mine\n\n${begin('core', 'blank', '6d3e610aaf815551')}\nold rules\n${END}\n`;
  put(s.claude, old);
  assert.ok(s.run('plan').includes('state: stale'));
  assert.deepEqual(s.run('decline'), [`rules: declined the change to ${s.claude}; the session notice stays quiet for this text`]);
  assert.deepEqual(s.state().declined, [SHIPPED_CORE_DIGEST]);
  assert.deepEqual(s.planFile(), {});
  assert.ok(s.run('plan').includes('state: stale (you declined this text before)'));
  assert.equal(bytes(s.claude), old);
}));

test('R32: decline with no saved plan refuses', sandbox((s) => {
  assert.throws(() => s.run('decline'), { message: 'there is no planned change; run /rules again' });
}));

test('R35: an @ import in the target is noted and left as it is', sandbox((s) => {
  put(s.claude, '@~/shared/rules.md\nmine\n');
  const out = s.run('plan');
  assert.ok(out.includes('note: line 1: @~/shared/rules.md imports a file that cannot be read; it is left as it is'));
  s.run('apply');
  assert.ok(bytes(s.claude).startsWith('@~/shared/rules.md\nmine\n\n<!-- reimagine:house-rules begin'));
}));

test('R30: two applies started at once are serialized, so one writes and the other finds no plan', sandbox(async (s) => {
  // Claude sends the two apply calls in one message, so the processes run side by side.
  const env = s.procEnv();
  const apply = () => new Promise((done) => {
    const child = spawn(process.execPath, [SCRIPT, 'apply', s.data], { env });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.on('close', (status) => done({ status, stdout }));
  });
  // The spawned script runs on the real platform, where Windows adds its option to the default (R36).
  const options = process.platform === 'win32' ? ['core', 'windows'] : ['core'];
  for (let i = 0; i < 10; i++) {
    rmSync(s.claudeDir, { recursive: true, force: true });
    rmSync(s.data, { recursive: true, force: true });
    assert.equal(s.spawn('plan').status, 0);
    const both = await Promise.all([apply(), apply()]);
    const won = both.filter((r) => r.status === 0), lost = both.filter((r) => r.status === 1);
    assert.equal(won.length, 1, `round ${i}`);
    assert.equal(lost.length, 1, `round ${i}`);
    assert.equal(won[0].stdout, `rules: wrote ${s.claude}\n`, `round ${i}`);
    assert.equal(lost[0].stdout, 'rules: there is no planned change; run /rules again\n', `round ${i}`);
    assert.deepEqual(s.planFile(), {}, `round ${i}`);
    assert.equal(s.state().created, true, `round ${i}`);
    assert.deepEqual(s.state().options, options, `round ${i}`);
    assert.deepEqual(readdirSync(s.data).sort(), ['rules-plan.json', 'rules-state.json'], `round ${i}`);
    assert.deepEqual(readdirSync(s.claudeDir), ['CLAUDE.md'], `round ${i}`);
  }
}));

test('R30: a step waits while another holds the lock, and takes over a lock left by a run that died', sandbox(async (s) => {
  const env = s.procEnv();
  const lock = join(s.data, 'rules.lock');
  mkdirSync(lock, { recursive: true });
  const started = Date.now();
  const planned = new Promise((done) => spawn(process.execPath, [SCRIPT, 'plan', s.data], { env }).on('close', done));
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(existsSync(join(s.data, 'rules-plan.json')), false);
  rmSync(lock, { recursive: true });
  assert.equal(await planned, 0);
  assert.ok(Date.now() - started >= 600);
  assert.equal(existsSync(join(s.data, 'rules-plan.json')), true);
  mkdirSync(lock);
  utimesSync(lock, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'));
  assert.deepEqual(s.run('apply'), [`rules: wrote ${s.claude}`]);
  assert.equal(existsSync(lock), false);
}));

test('R37: the script prints a refusal on stdout and exits 1, and a status exits 0', sandbox((s) => {
  const bad = s.spawn('bogus');
  assert.equal(bad.stdout, 'rules: unknown command bogus; use status, plan, remove, apply, decline or session-start\n');
  assert.equal(bad.status, 1);
  const missing = spawnSync(process.execPath, [SCRIPT, 'plan'], { env: s.procEnv(), encoding: 'utf8' });
  assert.equal(missing.stdout, 'rules: the data directory argument is missing\n');
  assert.equal(missing.status, 1);
  const adopt = s.spawn('apply', ['--adopt']);
  assert.equal(adopt.stdout, 'rules: --adopt goes with plan, not apply\n');
  assert.equal(adopt.status, 1);
  const ok = s.spawn('status');
  // The spawned script runs on the real platform, where Windows adds its option to the default (R36).
  const defaults = process.platform === 'win32' ? 'core,windows' : 'core';
  assert.equal(ok.stdout, `state: absent ${s.claude} options=${defaults} (default)\noptions recorded: no\n`);
  assert.equal(ok.status, 0);
}));

test('R37: the script runs when its path goes through a symlink, as under a linked ~/.claude', sandbox((s) => {
  // A junction on Windows, which needs no extra rights; the type is ignored elsewhere.
  const linked = join(s.root, 'linked');
  symlinkSync(join(SCRIPT, '..', '..'), linked, 'junction');
  try {
    const r = spawnSync(process.execPath, [join(linked, 'scripts', 'rules.mjs'), 'status', s.data], { env: s.procEnv(), encoding: 'utf8' });
    const defaults = process.platform === 'win32' ? 'core,windows' : 'core';
    assert.equal(r.stdout.split('\n')[0], `state: absent ${s.claude} options=${defaults} (default)`);
    assert.equal(r.status, 0);
  } finally {
    unlinkSync(linked);
  }
}));

test('R24: apply and remove write through a target symlink', { skip: process.platform === 'win32' }, sandbox((s) => {
  const managed = join(realpathSync(s.root), 'managed.md');
  put(managed, 'managed line\n');
  mkdirSync(s.claudeDir);
  symlinkSync(managed, s.claude);
  assert.deepEqual(targets(s.env, s.home), { path: managed, logical: s.claude });
  s.run('plan');
  s.run('apply');
  assert.equal(lstatSync(s.claude).isSymbolicLink(), true);
  assert.ok(bytes(managed).includes('reimagine:house-rules begin'));
  assert.equal(bytes(`${managed}.reimagine-backup-20261003120000`), 'managed line\n');
  s.run('remove');
  s.run('apply', [], { now: LATER });
  assert.equal(lstatSync(s.claude).isSymbolicLink(), true);
  assert.equal(bytes(managed), 'managed line\n');
}));

test('R24: apply refuses a dangling target symlink without writing', { skip: process.platform === 'win32' }, sandbox((s, t) => {
  const missing = join(s.root, 'missing.md');
  mkdirSync(s.claudeDir);
  try { symlinkSync(missing, s.claude); } catch (e) { if (e.code === 'EPERM') { t.skip('symlinks are not permitted'); return; } throw e; }
  s.run('plan');
  assert.throws(() => s.run('apply'), { message: `${s.claude} is a symbolic link that points to a missing file, so nothing was written` });
  assert.equal(lstatSync(s.claude).isSymbolicLink(), true);
  assert.equal(existsSync(missing), false);
  assert.deepEqual(readdirSync(s.claudeDir), ['CLAUDE.md']);
}));

test('R24: apply refuses a hard-linked target without writing', sandbox((s) => {
  put(s.claude, 'managed line\n');
  const linked = join(s.root, 'managed.md');
  linkSync(s.claude, linked);
  s.run('plan');
  assert.throws(() => s.run('apply'), { message: `${s.claude} has multiple hard links, so nothing was written` });
  assert.equal(bytes(s.claude), 'managed line\n');
  assert.equal(bytes(linked), 'managed line\n');
  assert.equal(statSync(s.claude).nlink, 2);
  assert.deepEqual(readdirSync(s.claudeDir), ['CLAUDE.md']);
}));

test('R30: atomic replacement preserves existing permissions', { skip: process.platform === 'win32' }, sandbox((s) => {
  put(s.claude, 'private instructions\n');
  chmodSync(s.claude, 0o600);
  s.run('plan');
  s.run('apply');
  assert.equal(statSync(s.claude).mode & 0o777, 0o600);
}));

test('R26, R23, R31: a BOM before the first block preserves offsets, updates and removal bytes', () => {
  const current = `${BOM}${CORE_LF}`;
  assert.equal(plan(current).state, 'current');
  assert.equal(inspect(current).start, 3);
  assert.equal(plan(current, { remove: true }).after, BOM);
  const stale = `${BOM}${begin('core', 'none', '6d3e610aaf815551')}\nold rules\n${END}\n`;
  assert.equal(plan(stale).state, 'stale');
  assert.equal(plan(stale).after, `${BOM}${CORE_LF.replace('join=blank', 'join=none')}`);
  assert.equal(plan(stale, { remove: true }).after, BOM);
});


// Overlap, adopt and imports. RICH is a core text with headings, wrapped items and three rules.
const RICH = { ...TEXTS, 'core.md': '## Working\n\n- one\n- two\n  wrapped\n\n## Code\n\n- three\n' };
const rich = (text, more = {}) => plan(text, { texts: RICH, ...more });
const kinds = (text) => units(text).list.map((u) => `${u.kind}:${u.norm}`);
const richBlock = (eol = '\n') => `${begin('core', 'none', '63857e438c8dd232', '9.9.9')}${eol}${RICH['core.md'].replace(/\n/g, eol)}${END}${eol}`;

test('units: items, paragraphs and headings read as a Markdown reader sees them', () => {
  assert.deepEqual(kinds('- one\n  two\n'), ['item:one two']);
  assert.deepEqual(kinds('- one\ntwo\n- three'), ['item:one two', 'item:three']);
  assert.deepEqual(kinds('- one\n\n  but not on Fridays\n\nnext\n'), ['item:one but not on Fridays', 'para:next']);
  assert.deepEqual(kinds('* x\n- x\n1. x\n'), ['item:x', 'item:x', 'item:x']);
  assert.deepEqual(kinds('# T\npara   line\nmore\n\n## Sub  title\n'), ['head:# T', 'para:para line more', 'head:## Sub title']);
});

test('units: fenced code, HTML comments and indented code are not units', () => {
  assert.deepEqual(kinds('```\n- x\n```\n- y\n'), ['item:y']);
  assert.deepEqual(kinds('~~~sh\n- x\n```\n~~~\n- y\n'), ['item:y']);
  assert.deepEqual(kinds('<!-- a\n- x\n-->\n- y\n\n<!-- one -->\n- z\n'), ['item:y', 'item:z']);
  assert.deepEqual(kinds('<!-- a\n- x\n--!>\n- y\n'), ['item:y']);
  assert.deepEqual(kinds('<!-- a ` b -->\n- y\n'), ['item:y']);
  assert.deepEqual(kinds('`<!--` x\n\n- y\n'), ['para:`<!--` x', 'item:y']);
  assert.deepEqual(kinds('    - code\n\n- y\n'), ['item:y']);
  assert.deepEqual(kinds('- y\n\n    - nested code\n'), ['item:y - nested code']);
});

test('units: CRLF and a byte order mark leave the byte spans of the original', () => {
  const crlf = units('- a\r\n  b\r\n\r\npara\r\n');
  assert.deepEqual(crlf.list.map((u) => `${u.kind}:${u.norm}:${u.a}-${u.b}`), ['item:a b:0-1', 'para:para:3-3']);
  assert.deepEqual(crlf.lines.map((l) => [l.s, l.e]), [[0, 5], [5, 10], [10, 12], [12, 18]]);
  const bom = units(`${BOM}# H\n- x\n`);
  assert.deepEqual(bom.list.map((u) => u.norm), ['## H'.slice(1), 'x']);
  assert.equal(bom.lines[0].s, 3);
});

test('R34: the overlap counts the rules already outside the block, rewrapped or not, and not headings or the block', () => {
  assert.deepEqual(rich('mine\n\n## Working\n\n- one\n- two wrapped\n\n## Code\n\n- three\n').overlap,
    { total: 3, n: 3, k: 0, imports: [], gate: 0 });
  // A continuation may sit from the content column to three columns past it; further in is not a plain shape.
  assert.equal(rich('- one\n- two\n    wrapped\n').overlap.n, 2);
  assert.equal(rich('- one\n- two\n      wrapped\n').overlap.n, 1);
  assert.equal(rich('- one\n- two wrapped, and more\n- three\n').overlap.n, 2);
  assert.equal(rich('## Working\n\n## Code\n').overlap.n, 0);
  assert.equal(rich(`mine\n\n${begin('core', 'blank', 'e2baf3da43ffa57d')}\n- one\n- three\n${END}\n`).overlap.n, 0);
  assert.equal(rich(`- one\n\n${begin('core', 'blank', 'b758274ad57880ef')}\n- two wrapped\n${END}\n`).overlap.n, 1);
  // A current block still reports the copies beside it, but remove counts nothing.
  assert.equal(rich(`${richBlock()}`).overlap, undefined);
  assert.deepEqual(rich(`- one\n\n${richBlock()}`).overlap, { total: 3, n: 1, k: 0, imports: [], gate: 0 });
  assert.equal(rich('- one\n', { remove: true }).overlap, undefined);
});

test('R34: the recommendation is apply, adopt, or decline, and apply for remove', () => {
  const from = (...rules) => [{ ref: '3: @a.md', units: new Set(rules), missed: 0, unreadable: false }];
  assert.equal(rich('mine\n').recommend, 'apply');
  assert.equal(rich('mine\n- one\n').recommend, 'adopt');
  assert.equal(rich('mine\n', { imported: from('one', 'two wrapped', 'three') }).recommend, 'decline');
  assert.equal(rich('mine\n', { imported: from('one', 'three') }).recommend, 'apply');
  assert.deepEqual(rich('mine\n', { imported: from('one', 'three') }).overlap,
    { total: 3, n: 0, k: 2, imports: [{ ref: '3: @a.md', n: 2, missed: 0, unreadable: false }], gate: 0 });
  assert.equal(rich('mine\n', { imported: from('elsewhere') }).recommend, 'apply');
  assert.equal(rich('- one\n', { imported: from('two wrapped') }).recommend, 'adopt');
  const adopted = rich('- one\n', { imported: from('two wrapped'), adopt: true });
  assert.equal(adopted.recommend, 'apply');
  assert.equal(adopted.overlap.n, 0);
  assert.equal(rich('- one\n', { imported: from('one', 'two wrapped', 'three'), adopt: true }).recommend, 'decline');
  assert.equal(rich(richBlock(), { remove: true }).recommend, 'apply');
  assert.equal(rich(`${begin('core', 'blank', 'be1ba97540b68c56')}\nC1\nOLD\n${END}\n`, { texts: TEXTS }).recommend, 'apply');
});

test('R33: adopt removes a full copy, headings included, and puts the block where it was', () => {
  const p = rich('# Mine\n\n## Working\n\n- one\n- two wrapped\n\n## Code\n\n- three\n', { adopt: true });
  assert.equal(p.after, `# Mine\n\n${richBlock()}`);
  assert.equal(p.state, 'absent');
  assert.equal(p.recommend, 'apply');
  // No overlap: adopt plans as the plain plan does.
  assert.equal(rich('mine\n', { adopt: true }).after, rich('mine\n').after);
  assert.equal(rich('mine\n', { adopt: true }).after, `mine\n\n${begin('core', 'blank', '63857e438c8dd232', '9.9.9')}\n${RICH['core.md']}${END}\n`);
});

test('R33: a fenced example, a differing qualification, and user text under a heading are kept', () => {
  // The parser alone keeps the fenced example; plan --adopt leaves a file with a fence alone (the gate).
  assert.equal(adoptRules('mine\n\n```\n- one\n```\n\n- one\n', () => '[B]\n', RICH['core.md']), 'mine\n\n```\n- one\n```\n\n[B]\n');
  const kept = '- one\n\n  but only on Fridays\n';
  assert.equal(rich(kept, { adopt: true }).after, rich(kept).after);
  assert.equal(rich('## Working\n\n- one\n\n### Mine\n\nmy text\n', { adopt: true }).after, `## Working\n\n### Mine\n\nmy text\n${richBlock()}`);
  assert.equal(rich('## Code\n\n## Working\n\n- one\n', { adopt: true }).after, `## Code\n\n${richBlock()}`);
  assert.equal(rich('## Working\n\nmine\n- one\n', { adopt: true }).after, `## Working\n\nmine\n${richBlock()}`);
});

test('R33: one separator blank line goes with a removed run that had blank lines on both sides', () => {
  assert.equal(adoptRules('a\n\n- one\n\nb\n', () => '[B]\n', RICH['core.md']), 'a\n\nb\n[B]\n');
  assert.equal(adoptRules('a\n- one\n\nb\n', () => '[B]\n', RICH['core.md']), 'a\n\nb\n[B]\n');
  assert.equal(adoptRules('a\n\n- one\n## H\n', () => '[B]\n', RICH['core.md']), 'a\n\n[B]\n## H\n');
  assert.equal(adoptRules('- one\n\nb\n', () => '[B]\n', RICH['core.md']), 'b\n[B]\n');
  assert.equal(adoptRules('a\n\n- one\n\n- three\n\nb\n', () => '[B]\n', RICH['core.md']), 'a\n\nb\n[B]\n');
});

test('R33: adopt keeps CRLF, a byte order mark, and a missing final newline', () => {
  assert.equal(rich('mine\r\n\r\n- one\r\n- two wrapped\r\n', { adopt: true }).after, `mine\r\n\r\n${richBlock('\r\n')}`);
  assert.equal(rich(`${BOM}mine ${FF}\n\n- one\n`, { adopt: true }).after, `${BOM}mine ${FF}\n\n${richBlock()}`);
  assert.equal(rich('mine\n\n- one', { adopt: true }).after, `mine\n\n${richBlock()}`);
  assert.equal(rich('mine\n\n- one\n\ntail', { adopt: true }).after, `mine\n\ntail\n${richBlock()}`);
});

test('R33: adopt acts on a stale block and on a current one, and takes the old block out first', () => {
  const stale = rich(`mine\n\n- one\n\n${begin('core', 'blank', 'f93ce92b5912b8dc')}\n- OLD\n${END}\n`, { adopt: true });
  assert.equal(stale.state, 'stale');
  assert.equal(stale.after, `mine\n\n${richBlock()}`);
  const current = rich(`mine\n\n- one\n\n${richBlock().replace('none', 'blank')}`, { adopt: true });
  assert.equal(current.state, 'current');
  assert.equal(current.after, `mine\n\n${richBlock()}`);
  assert.deepEqual(rich(`mine\n\n${richBlock().replace('none', 'blank')}`, { adopt: true }), { state: 'current', after: null, options: ['core'] });
});

test('R33: a block adopted above a heading keeps the blank line before the heading, and remove gives the trimmed file', () => {
  const file = '# Mine\n\nUser line above.\n\n## Working\n\n- one\n- two wrapped\n\n## Code\n\n- three\n\n## Notes\n\nUser line below.\n';
  const p = rich(file, { adopt: true });
  assert.equal(p.after, `# Mine\n\nUser line above.\n\n${begin('core', 'blank', '63857e438c8dd232', '9.9.9')}\n${RICH['core.md']}${END}\n\n## Notes\n\nUser line below.\n`);
  assert.equal(plan(p.after, { texts: RICH, remove: true }).after, '# Mine\n\nUser line above.\n\n## Notes\n\nUser line below.\n');
  const crlf = rich(file.replace(/\n/g, '\r\n'), { adopt: true });
  assert.equal(plan(crlf.after, { texts: RICH, remove: true }).after, '# Mine\r\n\r\nUser line above.\r\n\r\n## Notes\r\n\r\nUser line below.\r\n');
});

test('R31, R33: remove after adopt leaves the trimmed file, for join=blank and join=newline blocks', () => {
  const DUP = { ...TEXTS, 'core.md': '- duplicate\n' };
  for (const [original, trimmed] of [['user\n\n- duplicate\n', 'user\n\n'], ['user\n- duplicate', 'user\n']]) {
    const installed = plan(original, { texts: DUP }).after;
    const adopted = plan(installed, { texts: DUP, adopt: true });
    assert.equal(adopted.state, 'current');
    assert.equal(plan(adopted.after, { texts: DUP, remove: true }).after, trimmed);
  }
});

test('R35: imports are found at a line start or after white space, and not in code, fences, quotes, words, or the block', () => {
  const text = [
    '@start.md', 'see @mid.md and @two.md', 'an @esc\\ aped/file.md here', '`@span.md` and ``@a`b.md``', '```', '@fenced.md', '```',
    '"@quoted.md" and @"q p.md"', 'mail a@b.c', `${begin('core', 'blank', 'd0c78d0f2fb160ad')}`, '@inblock.md', END, '\t@tab.md\r', '@~/home.md', '',
  ].join('\n');
  assert.deepEqual(imports(text, inspect(text)).map((i) => `${i.n} ${i.token} ${i.path}`), [
    '1 @start.md start.md', '2 @mid.md mid.md', '2 @two.md two.md', '3 @esc\\ aped/file.md esc aped/file.md', '14 @~/home.md ~/home.md']);
  assert.deepEqual(imports('no imports\n'), []);
  assert.deepEqual(imports(`${BOM}@~/extra.md\n`).map((i) => [i.n, i.token]), [[1, '@~/extra.md']]);
});

// scanImports on temporary files: each top-level import reaches its own files.
const reached = (rows) => rows.map(({ ref, units: set, missed, unreadable }) => ({ ref, units: [...set], missed, unreadable }));
const scan = (s, text) => reached(scanImports(text, s.claude, inspect(text), s.home));

test('R35: imports resolve relative to the importing file, from home with ~/, and as absolute paths', sandbox((s) => {
  put(join(s.claudeDir, 'toolkit', 'a.md'), '- one\n\n@nested.md\n');
  put(join(s.claudeDir, 'toolkit', 'nested.md'), '- two\n');
  put(join(s.home, 'shared.md'), '- three\n');
  put(join(s.root, 'abs.md'), '- four\n');
  const text = `@toolkit/a.md\n@~/shared.md\n@${join(s.root, 'abs.md')}\n@none.md\n`;
  assert.deepEqual(scan(s, text), [
    { ref: '1: @toolkit/a.md', units: ['one', '@nested.md', 'two'], missed: 0, unreadable: false },
    { ref: '2: @~/shared.md', units: ['three'], missed: 0, unreadable: false },
    { ref: `3: @${join(s.root, 'abs.md')}`, units: ['four'], missed: 0, unreadable: false },
    { ref: '4: @none.md', units: [], missed: 1, unreadable: true },
  ]);
}));

test('R35: a Unicode path is decoded from latin1 bytes, and an escaped space is one path', sandbox((s) => {
  put(join(s.claudeDir, 'n\u00e9\u6f22 x.md'), '- uni\n');
  const text = Buffer.from('@n\u00e9\u6f22\\ x.md\n', 'utf8').toString('latin1');
  assert.deepEqual(scan(s, text), [{ ref: `1: ${Buffer.from('@n\u00e9\u6f22\\ x.md', 'utf8').toString('latin1')}`, units: ['uni'], missed: 0, unreadable: false }]);
}));

test('R35: four hops are followed and the fifth is not, a cycle ends, and a missing nested file is incomplete', sandbox((s) => {
  const chain = ['f1', 'f2', 'f3', 'f4', 'f5'];
  chain.forEach((f, i) => put(join(s.claudeDir, `${f}.md`), `- ${f}\n\n${chain[i + 1] ? `@${chain[i + 1]}.md\n` : ''}`));
  assert.deepEqual(scan(s, '@f1.md\n'), [{ ref: '1: @f1.md', units: ['f1', '@f2.md', 'f2', '@f3.md', 'f3', '@f4.md', 'f4', '@f5.md'], missed: 0, unreadable: false }]);
  put(join(s.claudeDir, 'c1.md'), '- c1\n\n@c2.md\n');
  put(join(s.claudeDir, 'c2.md'), '- c2\n\n@c1.md\n');
  assert.deepEqual(scan(s, '@c1.md\n'), [{ ref: '1: @c1.md', units: ['c1', '@c2.md', 'c2', '@c1.md'], missed: 0, unreadable: false }]);
  put(join(s.claudeDir, 'm.md'), '- m\n\n@gone.md\n');
  assert.deepEqual(scan(s, '@m.md\n'), [{ ref: '1: @m.md', units: ['m', '@gone.md'], missed: 1, unreadable: false }]);
}));

test('R35: a directory, a file over 256 KiB, and the fifty-first file are read errors, not skipped', sandbox((s) => {
  mkdirSync(join(s.claudeDir, 'dir'), { recursive: true });
  put(join(s.claudeDir, 'big.md'), `- big\n<!-- ${'x'.repeat(256 * 1024)} -->`);
  put(join(s.claudeDir, 'ok.md'), `- ok\n\n<!-- ${'x'.repeat(256 * 1024 - 15)} -->`);
  assert.deepEqual(scan(s, '@dir\n@big.md\n@ok.md\n').map((r) => [r.unreadable, r.units]), [[true, []], [true, []], [false, ['ok']]]);
  const many = Array.from({ length: 51 }, (_, i) => `d${i}.md`);
  many.forEach((f) => put(join(s.claudeDir, f), `- ${f}\n`));
  const rows = scan(s, many.map((f) => `@${f}\n`).join(''));
  assert.deepEqual(rows.filter((r) => r.unreadable).map((r) => r.ref), ['51: @d50.md']);
  assert.equal(rows[0].units[0], 'd0.md');
}));

test('R35: a symlinked import resolves its own relative imports against the path it was reached by', { skip: process.platform === 'win32' }, sandbox((s) => {
  put(join(s.root, 'real', 'x.md'), '- x\n\n@sib.md\n');
  put(join(s.claudeDir, 'sib.md'), '- sib\n');
  symlinkSync(join(s.root, 'real', 'x.md'), join(s.claudeDir, 'link.md'));
  assert.deepEqual(scan(s, '@link.md\n'), [{ ref: '1: @link.md', units: ['x', '@sib.md', 'sib'], missed: 0, unreadable: false }]);
}));

test('R35, R34: the plan names what each import holds, and the units of a file are never joined across files', sandbox((s) => {
  const core = SHIPPED['core.md'];
  put(join(s.claudeDir, 'toolkit', 'a.md'), core);
  put(join(s.claudeDir, 'b.md'), 'nothing here\n');
  put(join(s.claudeDir, 'half.md'), `${core.split('\n').slice(0, 10).join('\n')}\n\n@gone.md\n`);
  put(s.claude, '# Mine\n\n@toolkit/a.md\n@b.md\n@half.md\n@missing.md\n');
  const out = s.run('plan', ['--options', 'core']);
  assert.deepEqual(out.slice(0, 10), [`target: ${s.claude}`, 'state: absent', 'options: core',
    'note: line 3: @toolkit/a.md imports a file that holds 32 of 32 rules; it is left as it is',
    'note: line 4: @b.md imports a file that holds none of the rules; it is left as it is',
    'note: line 5: @half.md imports a file that holds at least 2 of 32 rules; 1 import could not be read; it is left as it is',
    'note: line 6: @missing.md imports a file that cannot be read; it is left as it is',
    'change: ready', 'recommend: decline',
    'note: 32 of 32 rules come from imports; applying duplicates them; declining leaves this file unchanged']);
  assert.equal(out.some((l) => l.includes('already present outside the block')), false);
  assert.deepEqual(s.run('status').filter((l) => l.includes('note')), []);
}));

test('R34: the overlap note and the recommendation for a hand copy, and adopt then apply writes a backup', sandbox((s) => {
  const copy = `# Mine\n\n${SHIPPED['core.md']}`;
  put(s.claude, copy);
  const out = s.run('plan', ['--options', 'core']);
  assert.deepEqual(out.slice(0, 7), [`target: ${s.claude}`, 'state: absent', 'options: core',
    'note: 32 of 32 rules already present outside the block; applying duplicates them', 'change: ready', 'recommend: adopt',
    'note: /rules --adopt moves those lines into the block']);
  const adopted = s.run('plan', ['--adopt', '--options', 'core']);
  assert.deepEqual(adopted.slice(0, 5), [`target: ${s.claude}`, 'state: absent', 'options: core', 'change: ready', 'recommend: apply']);
  assert.equal(adopted[5].includes('-Any instruction file can add an ask-first rule; none removes one.'), true);
  assert.deepEqual(s.run('apply', [], { now: AT }), [`rules: wrote ${s.claude}; the backup is ${s.claude}.reimagine-backup-20261003120000`]);
  assert.equal(bytes(`${s.claude}.reimagine-backup-20261003120000`), copy);
  const after = bytes(s.claude);
  assert.equal(after.startsWith('# Mine\n\n<!-- reimagine:house-rules begin version=0.1.0 options=core join=none digest='), true);
  assert.equal(after.split('Make the smallest correct change').length, 2);
  assert.equal(s.run('plan', ['--options', 'core']).includes('state: current'), true);
  s.run('remove');
  s.run('apply', [], { now: LATER });
  assert.equal(bytes(s.claude), '# Mine\n\n');
}));

test('R33, R37: --adopt is read in either order, and refused with any verb but plan', sandbox((s) => {
  const flat = (rest) => s.run('plan', rest).join('\n');
  assert.equal(flat(['--adopt', '--options', 'core']), flat(['--options', 'core', '--adopt']));
  assert.equal(s.run('plan', ['--adopt']).includes('options: core'), true);
  assert.throws(() => s.run('remove', ['--adopt']), { message: '--adopt goes with plan, not remove' });
  assert.throws(() => s.run('status', ['--adopt']), { message: '--adopt goes with plan, not status' });
  assert.throws(() => s.run('apply', ['--adopt']), { message: '--adopt goes with plan, not apply' });
  assert.throws(() => s.run('plan', ['--adopt', '--options', 'core', 'windows']), { message: 'unexpected argument "windows" after --options list' });
}));

test('units: a fence indented into an item, with a qualification after it, belongs to the item, which then matches no rule', () => {
  const item = '- A review is read-only unless I ask for changes.\n\n  ```\n  example\n  ```\n\n  Exception: none.\n';
  assert.deepEqual(kinds(item), ['item:A review is read-only unless I ask for changes. ``` example ``` Exception: none.']);
  assert.deepEqual(kinds('- a\n\n```\nx\n```\n- b\n'), ['item:a', 'item:b']);
  const only = { ...TEXTS, 'core.md': '- A review is read-only unless I ask for changes.\n' };
  const p = plan(item, { texts: only, adopt: true });
  assert.equal(p.overlap.n, 0);
  assert.equal(p.after, plan(item, { texts: only }).after);
});

test('R35: a code span that opens on one line and closes on the next hides its @path, and a blank line ends an open span', () => {
  const found = (text) => imports(text).map((i) => i.token);
  assert.deepEqual(found('see `@a.md\nmore` and @b.md\n'), ['@b.md']);
  assert.deepEqual(found('see ``@a.md ` @c.md\n@d.md`` @e.md\n'), ['@e.md']);
  assert.deepEqual(found('an `unclosed @f.md\n\n@g.md\n'), ['@f.md', '@g.md']);
  assert.deepEqual(found('`@h.md` @i.md\n'), ['@i.md']);
});

test('units: any nested construct indented into an item, or directly after its line, belongs to the item and keeps it from matching', () => {
  const rule = '- A review is read-only unless I ask for changes.';
  const only = { ...TEXTS, 'core.md': `${rule}\n` };
  const cases = {
    comment: [`${rule}\n  <!-- exception -->\n  Except for generated files.\n`, 'item:A review is read-only unless I ask for changes. Except for generated files.'],
    'multi-line comment': [`${rule}\n\n  <!-- a\n  b -->\n\n  Except it.\n`, 'item:A review is read-only unless I ask for changes. Except it.'],
    'comment at column 0 with no blank line': [`${rule}\n<!-- note -->\nmore\n`, 'item:A review is read-only unless I ask for changes. more'],
    'fence at column 0 with no blank line': [`${rule}\n\`\`\`\nx\n\`\`\`\n`, 'item:A review is read-only unless I ask for changes. ```'],
    'indented code': [`${rule}\n\n      code\n\n  Except it.\n`, 'item:A review is read-only unless I ask for changes. code Except it.'],
    'indented heading': [`${rule}\n\n  # Note\n`, 'item:A review is read-only unless I ask for changes. # Note'],
  };
  for (const [name, [text, norm]] of Object.entries(cases)) {
    assert.deepEqual(kinds(text), [norm], name);
    const p = plan(text, { texts: only, adopt: true });
    assert.equal(p.overlap.n, 0, name);
    assert.equal(p.after, plan(text, { texts: only }).after, name);
  }
  // After a blank line, a comment or fence below the item's column ends it.
  assert.deepEqual(kinds(`${rule}\n\n<!-- note -->\nafter\n`), ['item:A review is read-only unless I ask for changes.', 'para:after']);
});

test('R35: an unmatched backtick is literal text, and a fence nested in a list item may be indented past three spaces', () => {
  const found = (text) => imports(text).map((i) => i.token);
  assert.deepEqual(found('prose then @rules.md\n'), ['@rules.md']);
  assert.deepEqual(found('prose ` then @rules.md\n'), ['@rules.md']);
  assert.deepEqual(found('a `x`` @one.md\nb @two.md\n'), ['@one.md', '@two.md']);
  assert.deepEqual(found('a ``x` @one.md\nb `` @two.md\n'), ['@two.md']);
  assert.deepEqual(found('a ``x` @one.md `` @two.md\n'), ['@two.md']);
  assert.deepEqual(found('1. step\n\n    ~~~\n    @x.md\n    ~~~\n\n@y.md\n'), ['@y.md']);
  assert.deepEqual(found('1. step\n\n   ~~~\n   @x.md\n   ~~~\n\n@y.md\n'), ['@y.md']);
  assert.deepEqual(found('1. step\n\n@z.md\n\n    ~~~\n    @x.md\n'), ['@z.md']);
});

test('a fence or comment that opens on a list item first line belongs to that item, in imports and in units', () => {
  const found = (text) => imports(text).map((i) => i.token);
  assert.deepEqual(found('- ```\n  @fake.md\n  ```\n\n@real.md\n'), ['@real.md']);
  assert.deepEqual(found('1. ~~~sh\n    @fake.md\n    ~~~\n\n@real.md\n'), ['@real.md']);
  assert.deepEqual(found('- - ```\n    @fake.md\n    ```\n\n@real.md\n'), ['@real.md']);
  assert.deepEqual(kinds('- ```\n  @fake.md\n  ```\n\n@real.md\n'), ['item:``` @fake.md ```', 'para:@real.md']);
  assert.deepEqual(kinds('- <!-- a\n  b -->\n\n- one\n- <!-- c --> two\n'), ['item:', 'item:one', 'item:two']);
  // The fence state stays right after such an item, so the rule below it is still found and adopted.
  assert.deepEqual(kinds('- ```\n  - one\n  ```\n\n- one\n'), ['item:``` - one ```', 'item:one']);
  assert.equal(adoptRules('- ```\n  - one\n  ```\n\n- one\n', () => '[B]\n', RICH['core.md']), '- ```\n  - one\n  ```\n\n[B]\n');
});

test('R35: a house-rules marker line is a hard boundary for units, so a managed block in an imported file keeps all its rules', sandbox((s) => {
  put(join(s.claudeDir, 'managed.md'), plan(null, { texts: SHIPPED }).after);
  const [row] = scan(s, '@managed.md\n');
  assert.equal(row.missed, 0);
  const p = plan('mine\n', { texts: SHIPPED, imported: [{ ref: '1: @managed.md', units: new Set(row.units), missed: 0, unreadable: false }] });
  assert.equal(p.overlap.k, 32);
  assert.equal(p.overlap.total, 32);
  assert.deepEqual(kinds(`- user\n${END}\n- next\n`), ['item:user', 'item:next']);
  assert.deepEqual(kinds(`- user\n${begin('core', 'none', 'cb477dddc15de845')}\nafter\n`), ['item:user', 'para:after']);
}));

test('R35: an import of a FIFO or a directory is a read error, and the scan returns', { skip: process.platform === 'win32' }, sandbox((s) => {
  const fifo = join(s.claudeDir, 'pipe');
  mkdirSync(s.claudeDir, { recursive: true });
  assert.equal(spawnSync('mkfifo', [fifo]).status, 0);
  mkdirSync(join(s.claudeDir, 'dir'));
  assert.deepEqual(scan(s, '@pipe\n@dir\n'), [
    { ref: '1: @pipe', units: [], missed: 1, unreadable: true },
    { ref: '2: @dir', units: [], missed: 1, unreadable: true },
  ]);
}));

test('R35: text is latin1, so the byte A0 of a UTF-8 character is not white space for paths or for unit text', sandbox((s) => {
  const latin = (text) => Buffer.from(text, 'utf8').toString('latin1');
  put(join(s.claudeDir, '\u00e0.md'), '- one\n');
  put(join(s.claudeDir, '\u6f22.md'), '- two\n');
  assert.deepEqual(imports(latin('@\u00e0.md and @\u6f22.md\n')).map((i) => i.token), [latin('@\u00e0.md'), latin('@\u6f22.md')]);
  assert.deepEqual(scan(s, latin('@\u00e0.md\n@\u6f22.md\n')).map((r) => [r.ref, r.units, r.unreadable]), [
    [`1: ${latin('@\u00e0.md')}`, ['one'], false], [`2: ${latin('@\u6f22.md')}`, ['two'], false]]);
  assert.deepEqual(kinds(latin('- caf\u00e0 x\n')), ['item:caf\u00c3\u00a0 x']);
}));

test('R33: only a plain shape may match a rule, so indented code, tabs, and deeper continuations are kept by adopt', () => {
  const only = { ...TEXTS, 'core.md': '- A review is read-only unless I ask for changes.\n' };
  const rule = 'A review is read-only unless I ask for changes.';
  const cases = {
    'five spaces after the marker': `-     ${rule}\n`,
    'tab after the marker': `-\t${rule}\n`,
    'tab in a continuation': `- A review is read-only\n\tunless I ask for changes.\n`,
    'continuation past the content column': `- A review is read-only\n      unless I ask for changes.\n`,
    'tab in a paragraph': `A review is read-only\n\tunless I ask for changes.\n`,
    'paragraph line at column 4': `A review is read-only\n    unless I ask for changes.\n`,
  };
  for (const [name, text] of Object.entries(cases)) {
    const p = plan(text, { texts: only, adopt: true });
    assert.equal(p.overlap.n, 0, name);
    assert.equal(p.after, plan(text, { texts: only }).after, name);
  }
  assert.equal(plan(`- ${rule}\n`, { texts: only, adopt: true }).after, `${begin('core', 'none', '6f5144b9eecde4b6', '9.9.9')}\n- ${rule}\n${END}\n`);
  assert.equal(plan(`mine\n\n${SHIPPED['core.md']}`, { texts: SHIPPED }).overlap.n, 32);
});

test('R33: adopt keeps text that only looks like a rule because the parser flattened a construct around it', () => {
  const R = 'A review is read-only unless I ask for changes.';
  const cases = {
    'lazy continuation': [`- ${R}\ntail\n`, `- ${R} tail\n`],
    'quote attached to an item': [`- ${R}\n> note\n`, `- ${R} > note\n`],
    'quote after a blank, in the item': [`- ${R}\n\n  > exception\n`, `- ${R}\n`],
    'parenthesis item nested': [`- ${R}\n  1) child\n`, `- ${R} 1) child\n`],
    'nested list after a blank': [`- ${R}\n\n  - exception\n`, `- ${R}\n`],
    'indented code after a blank': [`- ${R}\n\n      exception\n`, `- ${R}\n`],
    'item-owned fence after a blank': [`- ${R}\n\n  ~~~\n  example\n  ~~~\n`, `- ${R}\n`],
    'item-owned comment after a blank': [`- ${R}\n\n  <!-- exception -->\n`, `- ${R}\n`],
    'setext heading with ===': [`${R}\n===\n`, `- ${R} ===\n`],
    'setext heading with ---': [`${R}\n---\n`, `- ${R} ---\n`],
    'table': [`${R} | j\n--- | ---\nx | y\n`, `- ${R} | j --- | --- x | y\n`],
    'HTML block': [`<div>\n- ${R}\n- other\n</div>\n`, `- ${R}\n`],
    'raw HTML across a blank line': [`<script>\n- ${R}\n\n</script>\n`, `- ${R}\n`],
    'comment opened after prose': [`text <!--\n- ${R}\n- other -->\n`, `- ${R}\n`],
    'quote': [`> - ${R}\n`, `- ${R}\n`],
  };
  for (const [name, [text, rule]] of Object.entries(cases)) {
    const texts = { ...TEXTS, 'core.md': rule };
    assert.equal(plan(text, { texts, adopt: true }).after, plan(text, { texts }).after, name);
  }
  // The plain shape is still adopted, and so is a four-space wrap under a two-column item.
  const texts = { ...TEXTS, 'core.md': `- ${R}\n` };
  assert.equal(plan(`mine\n\n- ${R}\n`, { texts, adopt: true }).after, `mine\n\n${begin('core', 'none', '6f5144b9eecde4b6', '9.9.9')}\n- ${R}\n${END}\n`);
  assert.equal(plan('- A review is read-only\n    unless I ask for changes.\n', { texts, adopt: true }).after, `${begin('core', 'none', '6f5144b9eecde4b6', '9.9.9')}\n- ${R}\n${END}\n`);
});

test('R35: quotes, HTML blocks, tables, setext headings, tabs and nested containers are never scanned for imports', () => {
  const found = (text) => imports(text).map((i) => i.token);
  const cases = [
    ['> @x\n', []], ['  > @x\n', []], ['   > @x\n', []],
    ['> ~~~\n@x\n', ['@x']], ['~~~\n> ~~~\n@x\n~~~\n', []], ['> `\n@x\n`\n', ['@x']],
    ['> <!--\n@x\n', ['@x']], ['<!--\n> -->\n@x\n-->\n', []],
    ['   @x\n\n    @y\n', ['@x']],
    ['\t@x\n', []], ['text\t@x\n', []], ['-\t@x\n', []], ['-  @x\n', []], ['-     @x\n', []],
    ['- outer\n  - @x\n', []], ['- - @x\n', []], ['- > @x\n', []],
    ['- text\n  @a\n     @b\n      @c\n', ['@a', '@b']], ['- text\n @x\n', []],
    ['10. text\n    @a\n       @b\n        @c\n', ['@a', '@b']], ['1) ~~~\n   @x\n   ~~~\n', []],
    ['h | j\n--- | ---\n@x | y\n', []], ['| h | j |\n| --- | --- |\n| @x | y |\n', []],
    ['@x\n===\n', []], ['@x\n---\n', []],
    ['<div>\n@x\n</div>\n', []], ['<script>\n\n@x\n</script>\n', []],
    ['<!-- @x -->\n', []], ['<!--\n@x\n-->\n', []], ['<!--\n\n@x\n\n-->\n', []],
    ['@a <!-- @x --> @b\n', ['@a', '@b']], ['<!-- @a --> <!-- @b --> @c\n', ['@c']], ['<!--\n--> @x\n', ['@x']],
    ['- <!-- @x -->\n', []], ['- <!--\n  @x\n  -->\n', []], ['- text\n  <!--\n  @x\n  -->\n', []],
    ['<!--\n~~~\n-->\n@x\n', ['@x']], ['<!-- ` -->\n@x\n`\n', ['@x']], ['`<!--` @x\n', ['@x']],
    ['\\` @x `\n', ['@x']], ['- `\n- @x\n- `\n', ['@x']], ['text `\n# heading\n@x\n`\n', ['@x']], ['    `\n@x\n`\n', ['@x']],
    ['-  ~~~\n@x\n', ['@x']], ['- ~~~\n  code\n- @x\n', ['@x']], ['- ~~~\n  code\n\n@x\n', ['@x']],
    ['- <!--\n  comment\n- @x\n', ['@x']], ['- text\n# heading\n    ~~~\n@x\n', ['@x']],
    [`\`\n${END}\n@x\n\`\n`, ['@x']], [`~~~\n${END}\n@x\n`, []], [`<!--\n${END}\n@x\n`, ['@x']], [`- text\n${END}\n    ~~~\n@x\n`, ['@x']],
  ];
  for (const [text, tokens] of cases) assert.deepEqual(found(text), tokens, JSON.stringify(text));
});

test('R33: a unit whose raw lines differ from its match text, because a comment was stripped, is never counted or removed', () => {
  // The commented heading stays; the rules under it, and the heading that held only rules, are still adopted.
  const file = '## Working <!-- Keep this project-specific note. -->\n\n- one\n- two wrapped\n\n## Code\n\n- three\n';
  assert.equal(adoptRules(file, () => '[B]\n', RICH['core.md']), '## Working <!-- Keep this project-specific note. -->\n\n[B]\n');
  for (const [text, texts] of [['- one <!-- x -->\n', RICH], ['C1 <!-- x -->\nC2\n', TEXTS], ['<!-- x -->\n- one\n  <!-- y -->\n  more\n', RICH]]) {
    const p = plan(text, { texts, adopt: true });
    assert.equal(p.after, plan(text, { texts }).after, text);
  }
  assert.equal(adoptRules('## Code <!-- x -->\n\n- three\n', () => '[B]\n', RICH['core.md']), '## Code <!-- x -->\n\n[B]\n');
});

test('R35: comment marks inside a code span that wraps across lines are text, and a real comment ends only at its own mark', () => {
  const found = (text) => imports(text).map((i) => i.token);
  assert.deepEqual(found('a `b <!--\nc` @real.md\n\n@later.md\n'), ['@real.md', '@later.md']);
  assert.deepEqual(found('a `b <!--\nc --> d` @real.md\n\n@later.md\n'), ['@real.md', '@later.md']);
  assert.deepEqual(found('<!-- real `\n--> @y `\n'), ['@y']);
  assert.deepEqual(found('a `b --> c` @one.md <!-- @x --> @two.md\n'), ['@one.md', '@two.md']);
  assert.deepEqual(found('a ` <!--\nc `\n\n@later.md\n'), ['@later.md']);
  // A real comment, opened outside any span and never closed, hides the rest of its segment.
  assert.deepEqual(found('a ` <!--\n\n@later.md\n'), []);
  assert.deepEqual(found('`<!--` @x\n\n<!-- @y -->\n@z\n'), ['@x', '@z']);
  assert.deepEqual(found('<!--\n@x\n--!>\n@y\n'), ['@y']);
  assert.deepEqual(found('<!-- @x --!> @y\n'), ['@y']);
});

test('R33: indented text is never a rule, since it may belong to a container', () => {
  const R = 'A review is read-only unless I ask for changes.';
  const only = { ...TEXTS, 'core.md': `- ${R}\n` };
  const cases = {
    'nested rule after a quote': `- outer\n  > note\n\n  - ${R}\n`,
    'nested rule under a user item': `- outer\n\n  - ${R}\n`,
    'indented paragraph': `   ${R}\n`,
    'indented item': `  - ${R}\n`,
  };
  for (const [name, text] of Object.entries(cases)) {
    assert.equal(plan(text, { texts: only, adopt: true }).after, plan(text, { texts: only }).after, name);
  }
  assert.equal(plan(`mine\n\n${SHIPPED['core.md']}`, { texts: SHIPPED }).overlap.n, 32);
  assert.equal(plan(`mine\n\n${SHIPPED['core.md'].replace(/^/gm, '  ')}`, { texts: SHIPPED }).overlap.n, 0);
});

test('R33: a unit followed by anything but a blank line, the end, a heading, or a plain item is never a rule', () => {
  const R = 'A review is read-only unless I ask for changes.';
  const only = { ...TEXTS, 'core.md': `${R}\n` };
  const cases = {
    'single hyphen underline': `${R}\n-\n`, 'equals underline': `${R}\n=\n`, 'quote': `${R}\n> note\n`,
    'table row': `${R}\n| a | b |\n`, 'lone marker': `${R}\n-\n`, 'lone number': `${R}\n1.\n`, 'HTML': `${R}\n<div>\n`,
    'item then quote': `- ${R}\n> note\n`,
  };
  for (const [name, text] of Object.entries(cases)) {
    const texts = name.startsWith('item') ? { ...TEXTS, 'core.md': `- ${R}\n` } : only;
    assert.equal(plan(text, { texts, adopt: true }).after, plan(text, { texts }).after, name);
  }
  // Blank, end of text, a heading, a marker line, and a plain item after it are all fine.
  for (const text of [`${R}\n`, `${R}`, `${R}\n\nx\n`, `${R}\n# H\n`, `${R}\n- next\n`]) {
    assert.notEqual(plan(text, { texts: only, adopt: true }).after, plan(text, { texts: only }).after, text);
  }
  // The shipped texts still match in full, alone and with the Windows paragraph.
  const all = render(['windows', 'core'], SHIPPED);
  assert.equal(plan(`mine\n\n${all}`, { texts: SHIPPED, platform: 'win32', options: ['core', 'windows'] }).overlap.n, 33);
  assert.equal(plan(`mine\n\n${SHIPPED['core.md']}`, { texts: SHIPPED }).overlap.n, 32);
});

test('R33: a file that holds Markdown adopt does not handle is left alone, and plan recommends decline for it', () => {
  const R = 'A review is read-only unless I ask for changes.';
  const only = { ...TEXTS, 'core.md': `- ${R}\n` };
  const triggers = {
    'comment opener': ['mine\n<!-- note -->\n', 2], 'comment closer': ['mine\n\nx -->\n', 3], 'backtick fence': ['mine\n  ```\n  ```\n', 2],
    'tilde fence': ['~~~\n~~~\n', 1], 'quote': ['a\nb\n  > q\n', 3], 'pipe': ['a | b\n', 1], 'HTML block': ['a\n\n<div>\n', 3], 'closing tag': ['</div>\n', 1],
  };
  for (const [name, [extra, line]] of Object.entries(triggers)) {
    const text = `${extra}\n- ${R}\n`;
    const p = plan(text, { texts: only, adopt: true });
    assert.equal(p.after, plan(text, { texts: only }).after, name);
    assert.deepEqual([p.overlap.n, p.overlap.gate, p.recommend], [1, line, 'decline'], name);
    assert.deepEqual([plan(text, { texts: only }).overlap.gate, plan(text, { texts: only }).recommend], [line, 'decline'], name);
  }
  // Toggling adopt on a gated file with overlap leaves the recommendation at decline, so the command cannot loop.
  assert.deepEqual(['a | b\n\n- ' + R + '\n'].flatMap((x) => [false, true].map((adopt) => plan(x, { texts: only, adopt }).recommend)), ['decline', 'decline']);
  for (const html of ['<![CDATA[', '<?php', '<!DOCTYPE html>', '<pre>']) {
    assert.equal(plan(`mine\n${html}\n\n- ${R}\n`, { texts: only }).overlap.gate, 2, html);
  }
  assert.equal(plan(`a < b and c<d\n\n- ${R}\n`, { texts: only }).overlap.gate, 0);
  // A gated file with no overlap has nothing to report; the block's own lines never trigger the gate.
  assert.equal(plan('a | b\n', { texts: only }).recommend, 'apply');
  assert.equal(plan(`${BOM}mine\n\n- ${R}\n\n${richBlock()}`, { texts: only, adopt: true }).overlap.gate, 0);
  // A simple hand copy, with an import line, is adopted fully and plain plan recommends adopt.
  const copy = `# Mine\n\n@toolkit/a.md\n\n## Working\n\n- one\n- two wrapped\n\n## Code\n\n- three\n`;
  assert.equal(rich(copy, { adopt: true }).after, `# Mine\n\n@toolkit/a.md\n\n${richBlock()}`);
  assert.equal(rich(copy).recommend, 'adopt');
});

test('R35: a code span never pairs across the paragraphs of one list item', () => {
  const found = (text) => imports(text).map((i) => i.token);
  assert.deepEqual(found('- before `\n\n  @rules.md\n  after `\n'), ['@rules.md']);
  assert.deepEqual(found('- before `x\n  @hidden.md y` after\n\n  @shown.md\n'), ['@shown.md']);
});

test('R35: a code span never pairs across list items, so a comment between them stays a comment', () => {
  assert.deepEqual(imports('- `\n- <!-- @x -->\n- `\n').map((i) => i.token), []);
  assert.deepEqual(imports('- `\n- @y\n- `\n').map((i) => i.token), ['@y']);
  assert.deepEqual(imports('a `\n# h\n<!-- @x -->\n`\n').map((i) => i.token), []);
});

test('R35: one segmentation decides where code spans pair, so a heading backtick never pairs with a later paragraph', () => {
  const found = (text) => imports(text).map((i) => i.token);
  assert.deepEqual(found('# h `\n<!-- @x -->\nafter `\n'), []);
  assert.deepEqual(found('# h `\n\n<!-- @x -->\n\nafter ` @y\n'), ['@y']);
  assert.deepEqual(found('- a `\n  <!-- @x -->\n  b ` @y\n'), ['@y']);
  assert.deepEqual(found('para `\n```\n<!-- @x -->\n```\nafter ` @y\n'), ['@y']);
  assert.deepEqual(found('para `\n> q\n@y `\n'), ['@y']);
});

test('masked comments and code spans are not an import boundary', () => {
  const found = (t) => imports(t).map((i) => i.token);
  assert.deepEqual(found('`example`@plugins/rules/rules/core.md\n'), []);
  assert.deepEqual(found('`x` @a.md\n'), ['@a.md']);
  assert.deepEqual(found('<!-- c -->@b.md\n'), []);
  assert.deepEqual(found('<!-- c --> @b.md\n'), ['@b.md']);
  assert.deepEqual(found('@a.md<!-- c -->\n'), ['@a.md']);
  assert.deepEqual(found('@a.md`x`b\n'), ['@a.md']);
});

test('R35: a symlinked CLAUDE.md resolves imports beside the link first, then beside its destination', { skip: process.platform === 'win32' }, sandbox((s) => {
  const dest = join(realpathSync(s.root), 'real', 'CLAUDE.md');
  put(dest, '@a.md\n@b.md\n');
  mkdirSync(s.claudeDir, { recursive: true });
  symlinkSync(dest, s.claude);
  put(join(s.claudeDir, 'a.md'), '- link a\n');
  put(join(s.claudeDir, 'b.md'), '- link b\n');
  put(join(s.root, 'real', 'b.md'), '- dest b\n');
  put(join(s.root, 'real', 'c.md'), '- dest c\n');
  const text = '@a.md\n@b.md\n@c.md\n@d.md\n';
  assert.deepEqual(reached(scanImports(text, dest, inspect(text), s.home, s.claude)), [
    { ref: '1: @a.md', units: ['link a'], missed: 0, unreadable: false },
    { ref: '2: @b.md', units: ['link b'], missed: 0, unreadable: false },
    { ref: '3: @c.md', units: ['dest c'], missed: 0, unreadable: false },
    { ref: '4: @d.md', units: [], missed: 1, unreadable: true }]);
}));

test('R33: the block goes before the next level 1 or 2 heading, else at the end, never ahead of user text', () => {
  const rule = '- three\n';
  assert.equal(rich(`## Mine\n\n${rule}- Always use tabs in Go files.\n`, { adopt: true }).after, `## Mine\n\n- Always use tabs in Go files.\n${richBlock()}`);
  assert.equal(rich(`## Mine\n\n${rule}\n## Next\n\nx\n`, { adopt: true }).after,
    `## Mine\n\n${begin('core', 'blank', '63857e438c8dd232', '9.9.9')}\n${RICH['core.md']}${END}\n\n## Next\n\nx\n`);
  assert.equal(rich(`## Mine\n\n${rule}\n### Sub\n\nx\n`, { adopt: true }).after, `## Mine\n\n### Sub\n\nx\n${richBlock()}`);
  assert.equal(rich('- one\n- two wrapped\n', { adopt: true }).after, richBlock());
  assert.equal(rich('- one\n\nuser paragraph\n', { adopt: true }).after, `user paragraph\n${richBlock()}`);
});

test('R35: an import chain back to CLAUDE.md does not count the rules in its own block', sandbox((s) => {
  put(join(s.claudeDir, 'shared.md'), 'see @CLAUDE.md\n');
  put(s.claude, 'My notes. @shared.md\n');
  s.run('plan');
  s.run('apply');
  const text = readFileSync(s.claude, 'latin1');
  assert.ok(text.includes('reimagine:house-rules begin'));
  assert.deepEqual(scan(s, text), [{ ref: '1: @shared.md', units: ['see @CLAUDE.md'], missed: 0, unreadable: false }]);
  const out = s.run('plan', ['--options', 'core']).slice(0, 8);
  assert.deepEqual(out.filter((l) => l.includes('from imports')), []);
  assert.ok(out.includes('state: current'));
}));

const ruleLines = (n) => { const u = units(SHIPPED['core.md']); return u.list.filter((x) => x.kind !== 'head').slice(0, n).map((x) => u.lines.slice(x.a, x.b + 1).map((l) => l.t).join('\n')).join('\n'); };

test('R34: a current block reports the copies and the gate beside it, even when nothing changes', sandbox((s) => {
  put(s.claude, 'mine\n');
  s.run('plan');
  s.run('apply');
  put(s.claude, `${readFileSync(s.claude, 'latin1')}\n${ruleLines(1)}\n\nUse a | b\n`);
  const keep = (out) => out.filter((l) => /^(state|note|change|recommend)/.test(l));
  assert.deepEqual(keep(s.run('plan', ['--adopt'])), ['state: current',
    'note: 1 of 32 rules are also present outside the block, duplicating it',
    'note: adopt leaves this file alone because line 90 holds Markdown it does not handle; trim the copy by hand, then run /rules',
    'change: none']);
  assert.deepEqual(keep(s.run('plan')), ['state: current',
    'note: 1 of 32 rules are also present outside the block, duplicating it',
    'note: adopt leaves this file alone because line 90 holds Markdown it does not handle; trim the copy by hand, then run /rules',
    'change: none']);
}));

test('R34: a current block with an import holding every rule names the import; a gated file names no imports', sandbox((s) => {
  put(join(s.claudeDir, 'shared.md'), SHIPPED['core.md']);
  put(s.claude, 'mine\n');
  s.run('plan');
  s.run('apply');
  put(s.claude, `${readFileSync(s.claude, 'latin1')}\n@shared.md\n`);
  assert.ok(s.run('plan').includes('note: line 88: @shared.md imports a file that holds 32 of 32 rules; it is left as it is'));
  put(s.claude, `${SHIPPED['core.md']}\nUse a | b\n`);
  const gated = s.run('plan');
  assert.ok(gated.includes('recommend: decline'));
  assert.deepEqual(gated.filter((l) => l.includes('come from imports')), []);
}));

test('R34: decline only when the rules already present cover every rule, else apply', sandbox((s) => {
  const core = SHIPPED['core.md'];
  put(s.claude, `${ruleLines(1)}\nUse a | b\n`);
  assert.ok(s.run('plan').includes('recommend: apply'));
  put(join(s.claudeDir, 'shared.md'), ruleLines(12));
  put(s.claude, 'mine @shared.md\n');
  const part = s.run('plan');
  assert.ok(part.includes('recommend: apply'));
  assert.deepEqual(part.filter((l) => l.includes('come from imports')), []);
  put(join(s.claudeDir, 'shared.md'), core);
  const all = s.run('plan');
  assert.ok(all.includes('recommend: decline'));
  assert.ok(all.includes('note: 32 of 32 rules come from imports; applying duplicates them; declining leaves this file unchanged'));
}));

test('R35: a backslash escapes only an opening backtick; a closing run pairs and spans hide what they hold', () => {
  const found = (t) => imports(t).map((i) => i.token);
  assert.deepEqual(found('Use `C:\\repo\\` @rules.md and `other`'), ['@rules.md']);
  assert.deepEqual(found('Use \\\\`code @rules.md` end'), []);
  assert.deepEqual(found('Use `see @rules.md` here'), []);
  assert.deepEqual(found('Use \\`x @a.md` end'), ['@a.md`']);
  assert.deepEqual(found('`a\\` <!-- @x --> @y'), ['@y']);
  assert.deepEqual(found('- `a\\`\n  `b` @z\n'), ['@z']);
});

test('units and imports grow about linearly: four times the input takes under ten times as long', () => {
  // Linear growth gives a ratio near 4 and quadratic code near 16, so 10 sits between.
  // Each side is its best batch, taken after warm-up, so a slow patch must hit every batch to count.
  const timed = (run, text, count) => {
    const t0 = performance.now();
    for (let i = 0; i < count; i++) run(text);
    return performance.now() - t0;
  };
  const grows = (name, make, run, n) => {
    const [small, large] = [make(n), make(4 * n)];
    run(small);
    run(large);
    let count = 1;
    while (count < 256 && timed(run, small, count) < 50) count *= 2;
    const more = Math.max(1, Math.floor(count / 4));
    const [a, b] = [[], []];
    for (let k = 0; k < 5; k++) {
      a.push(timed(run, small, count) / count);
      b.push(timed(run, large, more) / more);
    }
    const ratio = Math.min(...b) / Math.min(...a);
    const ms = (list) => list.map((x) => x.toFixed(2)).join(', ');
    return [ratio < 10, `${name}: ratio ${ratio.toFixed(2)}; ms per run, small [${ms(a)}], large [${ms(b)}]`];
  };
  const stray = (n) => `${Array.from({ length: n }, (_, i) => `line ${i} with a stray \` tick`).join('\n')}\n`;
  assert.ok(...grows('units, stray ticks', stray, (t) => units(t), 8000));
  assert.ok(...grows('imports, stray ticks', stray, (t) => imports(t), 8000));
  assert.ok(...grows('imports, plain lines', (n) => 'a\n'.repeat(n), (t) => imports(t), 32768));
  assert.ok(...grows('imports, import lines', (n) => '@a.md\n'.repeat(n), (t) => imports(t), 32768));
});

test('R35: an escaped backtick consumes one of its run; the rest of the run can still open a span', () => {
  const found = (t) => imports(t).map((i) => i.token);
  // One backslash, then two backticks: the first is literal, the second opens a span.
  assert.deepEqual(found('Use \\`` @rules.md ` end'), []);
  assert.deepEqual(found('Use \\``code` @real.md and `other`'), ['@real.md']);
  assert.deepEqual(found('Use \\`x @a.md` end'), ['@a.md`']);
});

test('R35: an edited block still names the imports of the target', sandbox((s) => {
  put(join(s.home, 'extra.md'), 'hello\n');
  put(s.claude, 'mine\n');
  s.run('plan');
  s.run('apply');
  put(s.claude, `@~/extra.md\n${readFileSync(s.claude, 'latin1').replace('## Working', '## Working with edits')}`);
  assert.deepEqual(s.run('plan').filter((l) => /^(state|note)/.test(l)), [
    'state: edited; the block was edited by hand; move your lines below the end marker, then run /rules again',
    'note: line 1: @~/extra.md imports a file; it is left as it is']);
}));

test('R35: a fenced example of a house-rules block in an imported file holds no rules; the marker lines are fence text', sandbox((s) => {
  const core = SHIPPED['core.md'];
  put(s.claude, 'See @README.md\n');
  for (const marked of [true, false]) {
    const inner = marked ? `${begin('core', 'none', '0000000000000000')}\n${core}${END}\n` : core;
    put(join(s.claudeDir, 'README.md'), `\`\`\`\n${inner}\`\`\`\n`);
    const out = s.run('plan').filter((l) => /^(note: line|recommend)/.test(l));
    assert.deepEqual(out, ['note: line 1: @README.md imports a file that holds none of the rules; it is left as it is', 'recommend: apply']);
  }
}));

test('R34: with nothing to change, a copy beside the block is called a duplicate and adopt is offered unless the file is gated', sandbox((s) => {
  put(s.claude, 'mine\n');
  s.run('plan');
  s.run('apply');
  const installed = readFileSync(s.claude, 'latin1');
  put(s.claude, `${installed}\n${SHIPPED['core.md']}`);
  const keep = (out) => out.filter((l) => /^(state|note|change)/.test(l));
  assert.deepEqual(keep(s.run('plan')), ['state: current', 'note: 32 of 32 rules are also present outside the block, duplicating it',
    'note: /rules --adopt moves those lines into the block', 'change: none']);
  put(s.claude, `${installed}\n${SHIPPED['core.md']}\nUse a | b\n`);
  assert.deepEqual(keep(s.run('plan')).slice(0, 2), ['state: current', 'note: 32 of 32 rules are also present outside the block, duplicating it']);
  assert.equal(keep(s.run('plan')).some((l) => l.includes('--adopt moves')), false);
}));

test('R33: rules at the very top of a file leave no leading blank line', () => {
  assert.equal(adoptRules('- one\n\n# Project\n\nmine\n', () => '[B]\n', RICH['core.md']), '[B]\n# Project\n\nmine\n');
  assert.equal(rich('- one\n\n# Project\n\nmine\n', { adopt: true }).after, `${richBlock()}# Project\n\nmine\n`);
});

test('R35: a remove plan checks each import is readable and parses nothing', sandbox((s) => {
  put(join(s.claudeDir, 'a.md'), `${SHIPPED['core.md']}\n@deep.md\n`);
  put(s.claude, 'mine\n');
  s.run('plan');
  s.run('apply');
  put(s.claude, `@a.md\n@gone.md\n${readFileSync(s.claude, 'latin1')}`);
  assert.deepEqual(s.run('remove').filter((l) => l.startsWith('note')), [
    'note: line 1: @a.md imports a file; it is left as it is', 'note: line 2: @gone.md imports a file that cannot be read; it is left as it is']);
  assert.deepEqual(scanImports('@a.md\n', s.claude, inspect(''), s.home, s.claude, true).map((r) => [r.units.size, r.missed]), [[0, 0]]);
}));
