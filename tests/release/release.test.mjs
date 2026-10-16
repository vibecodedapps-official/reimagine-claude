// Runs tools/release.mjs against copies of this repository, one case per behavior.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

let base;
let env;
let clean;
let seq = 0;

const git = (cwd, ...args) => {
  const r = spawnSync(
    'git',
    ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'init.defaultBranch=main', ...args],
    { cwd, env, encoding: 'utf8' },
  );
  assert.equal(r.status, 0, `git ${args.join(' ')} in ${cwd}\n${r.stderr}`);
  return r.stdout;
};

const read = (dir, path) => readFileSync(join(dir, path), 'utf8');
const put = (dir, path, text) => writeFileSync(join(dir, path), text);

const catalog = '.claude-plugin/marketplace.json';
const manifest = (name) => `plugins/${name}/.claude-plugin/plugin.json`;
const skill = 'plugins/audit/skills/audit/SKILL.md';
const resume = 'plugins/audit/skills/audit/resume.md';
const orient = 'plugins/audit/skills/audit/stages/1-orient.md';

// The suite checks the script, not the release state: the copy holds every plugin at 0.1.0-alpha.1, one heading each.
const pin = (dir) => {
  for (const path of [catalog, ...['rules', 'loop', 'audit', 'repo-docs'].map(manifest)]) {
    put(dir, path, read(dir, path).replace(/("version": ")[^"]*"/g, (_, head) => `${head}0.1.0-alpha.1"`));
  }
  for (const path of [skill, resume, orient]) {
    const lines = read(dir, path).split('\n');
    put(dir, path, lines.map((l) => (l.includes('plugin_version') ? l.replace(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]*[0-9A-Za-z])?/g, '0.1.0-alpha.1') : l)).join('\n'));
  }
  put(dir, 'CHANGELOG.md', '# Changelog\n\n## repo-docs 0.1.0-alpha.1 - 2026-10-15\n\n## audit 0.1.0-alpha.1 - 2026-10-15\n\n## loop 0.1.0-alpha.1 - 2026-10-15\n\n## rules 0.1.0-alpha.1 - 2026-10-15\n');
};

const caseDir = () => {
  const dir = join(base, `case-${++seq}`);
  cpSync(clean, dir, { recursive: true });
  return dir;
};

const commit = (dir) => {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'change');
};

const release = (dir, ...args) =>
  spawnSync(process.execPath, ['tools/release.mjs', ...args], { cwd: dir, encoding: 'utf8', env, timeout: 120000 });

const shown = (r) => `status ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`;

const changed = (dir) => git(dir, 'status', '--porcelain').split('\n').filter(Boolean);

const refuses = (title, prepare, args, status, line) =>
  test(title, () => {
    const dir = caseDir();
    prepare(dir);
    const r = release(dir, ...args);
    assert.equal(r.status, status, shown(r));
    assert.equal(r.stdout, `${line}\n`, shown(r));
    assert.deepEqual(changed(dir), [], shown(r));
  });

before(() => {
  base = mkdtempSync(join(tmpdir(), 'release-'));
  const emptyConfig = join(base, 'empty.gitconfig');
  writeFileSync(emptyConfig, '');
  const template = join(base, 'template');
  mkdirSync(template);
  env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: emptyConfig, GIT_CEILING_DIRECTORIES: base };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.LINT_DENY_TOKENS;

  clean = join(base, 'clean');
  mkdirSync(clean);
  const listed = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean);
  for (const path of listed) {
    if (!lstatSync(join(root, path)).isFile()) continue;
    mkdirSync(dirname(join(clean, path)), { recursive: true });
    copyFileSync(join(root, path), join(clean, path));
  }
  pin(clean);
  git(clean, 'init', '-q', `--template=${template}`);
  git(clean, 'add', '-A');
  git(clean, 'commit', '-q', '-m', 'init');
  for (const m of read(clean, 'CHANGELOG.md').matchAll(/^## (\S+) (\S+) - \d{4}-\d{2}-\d{2}\r?$/gm)) {
    git(clean, 'tag', `${m[1]}--v${m[2]}`);
  }
  git(clean, 'repack', '-q', '-a', '-d');
});

after(() => rmSync(base, { recursive: true, force: true }));

test('R221: rules 0.1.0 changes only the version in the manifest and its catalog entry', () => {
  const dir = caseDir();
  const before = read(dir, manifest('rules'));
  const r = release(dir, 'rules', '0.1.0');
  assert.equal(r.status, 0, shown(r));
  const lines = r.stdout.split('\n');
  assert.equal(lines.pop(), '', shown(r));
  assert.equal(lines.length, 3, shown(r));
  assert.equal(lines[0], 'release: plugins/rules/.claude-plugin/plugin.json: 0.1.0-alpha.1 -> 0.1.0', shown(r));
  assert.equal(lines[1], 'release: .claude-plugin/marketplace.json: 0.1.0-alpha.1 -> 0.1.0', shown(r));
  assert.ok(lines[2].startsWith('lint: ok ('), shown(r));
  assert.ok(before.includes('"version": "0.1.0-alpha.1"'));
  assert.equal(read(dir, manifest('rules')), before.replace('"version": "0.1.0-alpha.1"', '"version": "0.1.0"'));
  const versions = Object.fromEntries(JSON.parse(read(dir, catalog)).plugins.map((p) => [p.name, p.version]));
  assert.deepEqual(versions, { 'repo-docs': '0.1.0-alpha.1', audit: '0.1.0-alpha.1', loop: '0.1.0-alpha.1', rules: '0.1.0' });
  assert.deepEqual(changed(dir), [' M .claude-plugin/marketplace.json', ' M plugins/rules/.claude-plugin/plugin.json']);
});

test('R221: audit 0.1.0 also sets the plugin_version literals', () => {
  const dir = caseDir();
  const r = release(dir, 'audit', '0.1.0');
  assert.equal(r.status, 0, shown(r));
  const lines = r.stdout.split('\n');
  assert.equal(lines.pop(), '', shown(r));
  assert.equal(lines.length, 6, shown(r));
  assert.deepEqual(lines.slice(0, 5), [
    'release: plugins/audit/.claude-plugin/plugin.json: 0.1.0-alpha.1 -> 0.1.0',
    'release: .claude-plugin/marketplace.json: 0.1.0-alpha.1 -> 0.1.0',
    'release: plugins/audit/skills/audit/SKILL.md: 0.1.0-alpha.1 -> 0.1.0',
    'release: plugins/audit/skills/audit/resume.md: 0.1.0-alpha.1 -> 0.1.0',
    'release: plugins/audit/skills/audit/stages/1-orient.md: 0.1.0-alpha.1 -> 0.1.0',
  ], shown(r));
  assert.ok(lines[5].startsWith('lint: ok ('), shown(r));
  assert.deepEqual(changed(dir), [
    ' M .claude-plugin/marketplace.json',
    ' M plugins/audit/.claude-plugin/plugin.json',
    ' M plugins/audit/skills/audit/SKILL.md',
    ' M plugins/audit/skills/audit/resume.md',
    ' M plugins/audit/skills/audit/stages/1-orient.md',
  ]);
  assert.equal(read(dir, skill).split('\n')[306], '  "plugin_version": "0.1.0",');
  assert.equal(read(dir, resume).split('\n')[155], '   - `plugin_version`, compared with the literal `"0.1.0"`; any other recorded value');
  assert.equal(read(dir, orient).split('\n')[277], '      `mv -f`, with `plugin_version` `0.1.0`, empty `approvals`, and a stage 1 entry');
});

test('R221: a CRLF manifest stays CRLF', () => {
  const dir = caseDir();
  const path = manifest('loop');
  const lf = read(dir, path);
  assert.ok(!lf.includes('\r'));
  put(dir, path, lf.replaceAll('\n', '\r\n'));
  // The repository's attributes normalize CRLF to LF on commit; this file keeps its bytes.
  mkdirSync(join(dir, '.git', 'info'), { recursive: true });
  writeFileSync(join(dir, '.git', 'info', 'attributes'), `${path} -text\n`);
  commit(dir);
  const r = release(dir, 'loop', '0.1.0-alpha.2');
  assert.equal(r.status, 0, shown(r));
  const after = read(dir, path);
  const lines = after.split('\n');
  assert.equal(lines.pop(), '');
  assert.ok(lines.length > 1);
  assert.ok(lines.every((l) => l.endsWith('\r')), 'every line ends with CR');
  assert.equal(after, lf.replace('"version": "0.1.0-alpha.1"', '"version": "0.1.0-alpha.2"').replaceAll('\n', '\r\n'));
});

test('R221: releasing loop leaves the other manifests unchanged', () => {
  const dir = caseDir();
  const r = release(dir, 'loop', '0.1.0-alpha.2');
  assert.equal(r.status, 0, shown(r));
  assert.deepEqual(changed(dir), [' M .claude-plugin/marketplace.json', ' M plugins/loop/.claude-plugin/plugin.json']);
  for (const name of ['rules', 'audit', 'repo-docs']) {
    assert.equal(JSON.parse(read(dir, manifest(name))).version, '0.1.0-alpha.1', name);
  }
});

refuses('R221: refuses a usage error with one argument', () => {}, ['rules'], 2,
  'release: usage: node tools/release.mjs <plugin> <version>');

refuses('R221: refuses a version that is not semver', () => {}, ['rules', '1.0'], 1,
  'release: 1.0 is not semver');

refuses('R221: refuses an unknown plugin', () => {}, ['nope', '0.1.0'], 1,
  'release: no plugin nope');

refuses('R221: refuses the current version', () => {}, ['rules', '0.1.0-alpha.1'], 1,
  'release: 0.1.0-alpha.1 is not above 0.1.0-alpha.1');

refuses('R221: refuses a version below the current one', () => {}, ['rules', '0.0.9'], 1,
  'release: 0.0.9 is not above 0.1.0-alpha.1');

refuses('R221: refuses a manifest and catalog that disagree', (dir) => {
  const text = read(dir, catalog);
  const at = text.indexOf('"name": "rules"');
  assert.ok(at >= 0);
  const from = text.indexOf('"version": "0.1.0-alpha.1"', at);
  assert.ok(from >= 0);
  put(dir, catalog, text.slice(0, from) + '"version": "0.1.0-alpha.9"' + text.slice(from + '"version": "0.1.0-alpha.1"'.length));
  commit(dir);
}, ['rules', '0.1.0'], 1,
'release: rules manifest has 0.1.0-alpha.1, the catalog has 0.1.0-alpha.9; fix that first');

refuses('R221: refuses an audit literal that differs from the version', (dir) => {
  const lines = read(dir, resume).split('\n');
  assert.ok(lines[155].includes('0.1.0-alpha.1'));
  lines[155] = lines[155].replace('0.1.0-alpha.1', '0.1.0-alpha.9');
  put(dir, resume, lines.join('\n'));
  commit(dir);
}, ['audit', '0.1.0'], 1,
'release: plugins/audit/skills/audit/resume.md:156: plugin_version literal 0.1.0-alpha.9 differs from 0.1.0-alpha.1');

test('R221: runs lint afterwards and exits with its status', () => {
  const dir = caseDir();
  put(dir, 'plugins/rules/notes.txt', 'notes\n');
  const r = release(dir, 'rules', '0.1.0');
  assert.equal(r.status, 1, shown(r));
  assert.equal(r.stdout, [
    'release: plugins/rules/.claude-plugin/plugin.json: 0.1.0-alpha.1 -> 0.1.0',
    'release: .claude-plugin/marketplace.json: 0.1.0-alpha.1 -> 0.1.0',
    'lint: 1 failure(s)',
    '- plugins/rules/notes.txt: not something a plugin installs',
    '',
  ].join('\n'), shown(r));
});

test('R221: does not tag or touch the changelog', () => {
  const dir = caseDir();
  const tags = git(dir, 'tag', '--list');
  const log = readFileSync(join(dir, 'CHANGELOG.md'));
  assert.notEqual(tags, '');
  const r = release(dir, 'rules', '0.1.0');
  assert.equal(r.status, 0, shown(r));
  assert.equal(git(dir, 'tag', '--list'), tags);
  assert.ok(readFileSync(join(dir, 'CHANGELOG.md')).equals(log));
});
