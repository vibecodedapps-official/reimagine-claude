// The session-start notice. staleNotice runs on fake rule texts; the script runs as a process on temporary directories set
// through CLAUDE_CONFIG_DIR and home, so no test reads or writes the real ~/.claude.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, staleNotice } from '../../plugins/rules/scripts/rules.mjs';

const SCRIPT = fileURLToPath(new URL('../../plugins/rules/scripts/rules.mjs', import.meta.url));
const TEXTS = { 'core.md': 'C1\nC2\n', 'windows.md': 'WC\n' };
const END = '<!-- reimagine:house-rules end -->';
const block = (options, digest, body, join = 'none') =>
  `<!-- reimagine:house-rules begin version=0.0.1 options=${options} join=${join} digest=${digest} -->\n${body}${END}\n`;
const crlf = (text) => text.replace(/\n/g, '\r\n');
const notice = (path) => `{"systemMessage":"rules: the house rules in ${path} are older than this plugin's; run /rules to update them"}`;
const PATH = '/h/.claude/CLAUDE.md';
// block() bodies and their digests: C1 and C2 are the current text for core, C1 and OLD an out-of-date one.
const CURRENT = block('core', 'cb477dddc15de845', 'C1\nC2\n');
const OLD = block('core', 'be1ba97540b68c56', 'C1\nOLD\n');
const OLD_RULES = `mine\n\n${block('core', '6d3e610aaf815551', 'old rules\n', 'blank')}`;

test('R41: staleNotice gives the notice line for an unedited block whose digest is not the shipped one', () => {
  assert.equal(staleNotice(PATH, OLD, TEXTS), notice(PATH));
  assert.equal(staleNotice(PATH, `mine\n\n${OLD}below\n`, TEXTS), notice(PATH));
  assert.equal(staleNotice(PATH, block('core,windows', 'cb477dddc15de845', 'C1\nC2\n'), TEXTS), notice(PATH));
});

test('R41: staleNotice is empty for a current block, whatever the options of the block', () => {
  assert.equal(staleNotice(PATH, CURRENT, TEXTS), '');
  assert.equal(staleNotice(PATH, `mine\n\n${CURRENT}`, TEXTS), '');
  assert.equal(staleNotice(PATH, block('core,windows', 'd6a8ad4498204e38', 'WC\n\nC1\nC2\n'), TEXTS), '');
});

test('R41: staleNotice is empty for an edited block, an absent block, a missing file and a malformed one', () => {
  assert.equal(staleNotice(PATH, block('core', 'cb477dddc15de845', 'C1\nEDIT\n'), TEXTS), '');
  assert.equal(staleNotice(PATH, block('core', 'be1ba97540b68c56', 'C1\nEDIT\n'), TEXTS), '');
  assert.equal(staleNotice(PATH, 'mine\n', TEXTS), '');
  assert.equal(staleNotice(PATH, '', TEXTS), '');
  assert.equal(staleNotice(PATH, null, TEXTS), '');
  assert.equal(staleNotice(PATH, `a\n${END}\n`, TEXTS), '');
});

test('R41: staleNotice stays quiet when the digest of the shipped body is declined, and not for any other digest', () => {
  assert.equal(staleNotice(PATH, OLD, TEXTS, ['cb477dddc15de845']), '');
  assert.equal(staleNotice(PATH, OLD, TEXTS, ['0000000000000000', 'cb477dddc15de845']), '');
  assert.equal(staleNotice(PATH, OLD, TEXTS, ['be1ba97540b68c56']), notice(PATH));
  assert.equal(staleNotice(PATH, OLD, TEXTS, []), notice(PATH));
  // The declined digest is that of the body for the block's own options.
  assert.equal(staleNotice(PATH, block('core,windows', 'cb477dddc15de845', 'C1\nC2\n'), TEXTS, ['cb477dddc15de845']), notice(PATH));
  assert.equal(staleNotice(PATH, block('core,windows', 'cb477dddc15de845', 'C1\nC2\n'), TEXTS, ['d6a8ad4498204e38']), '');
});

test('R41, R42: a block whose file changed line ending keeps its state, and a hand edit stays quiet', () => {
  assert.equal(staleNotice(PATH, crlf(OLD), TEXTS), notice(PATH));
  assert.equal(staleNotice(PATH, crlf(`mine\n\n${OLD}`), TEXTS), notice(PATH));
  assert.equal(staleNotice(PATH, crlf(CURRENT), TEXTS), '');
  assert.equal(staleNotice(PATH, crlf(block('core', 'cb477dddc15de845', 'C1\nEDIT\n')), TEXTS), '');
  assert.equal(staleNotice(PATH, crlf(OLD), TEXTS, ['cb477dddc15de845']), '');
});

function sandbox(fn) {
  return () => {
    const root = mkdtempSync(join(tmpdir(), 'rules-session-'));
    const s = { root, claudeDir: join(root, 'claude'), data: join(root, 'data'), home: join(root, 'home') };
    mkdirSync(s.claudeDir);
    mkdirSync(s.home);
    s.claude = join(s.claudeDir, 'CLAUDE.md');
    s.env = { CLAUDE_CONFIG_DIR: s.claudeDir };
    s.spawn = (...argv) => spawnSync(process.execPath, [SCRIPT, ...argv],
      { env: { ...process.env, ...s.env, HOME: s.home, USERPROFILE: s.home }, encoding: 'utf8' });
    // The expected line has the path as JSON writes it: a backslash doubled.
    s.notice = () => notice(s.claude.replace(/\\/g, '\\\\'));
    try { fn(s); } finally { rmSync(root, { recursive: true, force: true }); }
  };
}

test('R41: session-start prints the notice line and a newline for a stale block, writes nothing, and exits 0', sandbox((s) => {
  writeFileSync(s.claude, OLD_RULES);
  const r = s.spawn('session-start', s.data);
  assert.equal(r.stdout, `${s.notice()}\n`);
  assert.equal(r.status, 0);
  assert.equal(existsSync(s.data), false);
  assert.deepEqual(readdirSync(s.claudeDir), ['CLAUDE.md']);
}));

test('R41: session-start prints the literal notice with the path of the target', sandbox((s) => {
  writeFileSync(s.claude, OLD_RULES);
  const r = s.spawn('session-start', s.data);
  const parsed = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(parsed), ['systemMessage']);
  assert.equal(parsed.systemMessage, `rules: the house rules in ${s.claude} are older than this plugin's; run /rules to update them`);
}));

test('R41: session-start prints nothing for a current block made by plan and apply', sandbox((s) => {
  const planned = s.spawn('plan', s.data);
  assert.equal(planned.status, 0);
  assert.equal(s.spawn('apply', s.data).status, 0);
  const r = s.spawn('session-start', s.data);
  assert.equal(r.stdout, '');
  assert.equal(r.status, 0);
}));

test('R41: session-start prints nothing after the stale text is declined', sandbox((s) => {
  writeFileSync(s.claude, OLD_RULES);
  assert.equal(s.spawn('session-start', s.data).stdout, `${s.notice()}\n`);
  assert.equal(s.spawn('plan', s.data).status, 0);
  assert.equal(s.spawn('decline', s.data).status, 0);
  const r = s.spawn('session-start', s.data);
  assert.equal(r.stdout, '');
  assert.equal(r.status, 0);
}));

test('R41: session-start exits 0 and prints nothing with no data directory argument', sandbox((s) => {
  writeFileSync(s.claude, OLD_RULES);
  const r = s.spawn('session-start');
  assert.equal(r.stdout, '');
  assert.equal(r.status, 0);
}));

test('R41: session-start exits 0 and prints nothing when rules-state.json cannot be parsed', sandbox((s) => {
  writeFileSync(s.claude, OLD_RULES);
  mkdirSync(s.data);
  writeFileSync(join(s.data, 'rules-state.json'), '{ not json');
  const r = s.spawn('session-start', s.data);
  assert.equal(r.stdout, '');
  assert.equal(r.status, 0);
  assert.deepEqual(readdirSync(s.data), ['rules-state.json']);
}));

test('R41: session-start exits 0 and prints nothing when CLAUDE_CONFIG_DIR does not exist, and creates nothing', sandbox((s) => {
  s.env.CLAUDE_CONFIG_DIR = join(s.root, 'missing');
  const r = s.spawn('session-start', s.data);
  assert.equal(r.stdout, '');
  assert.equal(r.status, 0);
  assert.equal(existsSync(join(s.root, 'missing')), false);
  assert.equal(existsSync(s.data), false);
}));

test('R41: session-start never creates the data directory or a lock, and does not wait for a held lock', sandbox((s) => {
  writeFileSync(s.claude, OLD_RULES);
  assert.equal(s.spawn('session-start', s.data).status, 0);
  assert.equal(existsSync(s.data), false);
  mkdirSync(s.data);
  writeFileSync(join(s.data, 'rules-state.json'), '{"created":false,"declined":[]}\n');
  const quiet = s.spawn('session-start', s.data);
  assert.equal(quiet.stdout, `${s.notice()}\n`);
  assert.deepEqual(readdirSync(s.data), ['rules-state.json']);
  mkdirSync(join(s.data, 'rules.lock'));
  const held = s.spawn('session-start', s.data);
  assert.equal(held.stdout, `${s.notice()}\n`);
  assert.equal(held.status, 0);
  assert.deepEqual(readdirSync(s.data).sort(), ['rules-state.json', 'rules.lock']);
}));

test('R41: main returns the notice as one output line for a stale block, and none otherwise', sandbox((s) => {
  const run = () => main(['session-start', s.data], { env: s.env, platform: 'linux', home: s.home });
  assert.deepEqual(run(), []);
  writeFileSync(s.claude, OLD_RULES);
  assert.deepEqual(run(), [s.notice()]);
  assert.equal(existsSync(s.data), false);
}));

test('R41: session-start runs when its path goes through a symlink, as under a linked ~/.claude', sandbox((s) => {
  // A junction on Windows, which needs no extra rights; the type is ignored elsewhere.
  const linked = join(s.root, 'linked');
  symlinkSync(join(SCRIPT, '..', '..'), linked, 'junction');
  try {
    writeFileSync(s.claude, OLD_RULES);
    const r = spawnSync(process.execPath, [join(linked, 'scripts', 'rules.mjs'), 'session-start', s.data],
      { env: { ...process.env, ...s.env, HOME: s.home, USERPROFILE: s.home }, encoding: 'utf8' });
    assert.equal(r.stdout, `${s.notice()}\n`);
    assert.equal(r.status, 0);
  } finally {
    unlinkSync(linked);
  }
}));
