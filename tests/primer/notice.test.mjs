// Runs the primer notice hook (plugins/primer/hooks/notice.sh) against throwaway repositories and the memory fixture
// (tests/primer/fixture/memory/build.sh) placed where the host keeps auto memory. The hook needs sh, git, awk and sed on PATH.
// Everything lives under one temporary base that is removed at the end.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

let base;
let env;
let gitEnv;
let fixture;
let seq = 0;

const git = (cwd, ...args) => {
  const r = spawnSync(
    'git',
    ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', 'init.defaultBranch=main', ...args],
    { cwd, env: gitEnv, encoding: 'utf8' },
  );
  assert.equal(r.status, 0, `git ${args.join(' ')} in ${cwd}\n${r.stderr}`);
  return r.stdout;
};

const write = (dir, path, content) => {
  const file = join(dir, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};

const hub = '<!-- primer -->\n# demo\n';

const repo = (name, files = { 'CLAUDE.md': hub }) => {
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) write(dir, path, content);
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return realpathSync.native(dir);
};

// The key the host derives from a directory; test setup places the memory where the host keeps it.
const keyOf = (path) => realpathSync.native(path).replace(/[^A-Za-z0-9]/g, '-');

const memoryDir = (config, dir) => join(config, 'projects', keyOf(dir), 'memory');

const place = (dir, { stamp }) => {
  const unique = join(base, `run-${++seq}`);
  const config = join(unique, 'config');
  const data = join(unique, 'data');
  mkdirSync(data, { recursive: true });
  cpSync(join(fixture, 'memory'), memoryDir(config, dir), { recursive: true });
  if (stamp) {
    mkdirSync(join(data, 'reviewed'));
    cpSync(join(fixture, 'stamp'), join(data, 'reviewed', keyOf(dir)));
  }
  return { config, data };
};

const notice = (cwd, config, data, transcriptKey, envOverride = {}) => {
  const input = JSON.stringify({
    session_id: 'test',
    transcript_path: join(config, 'projects', transcriptKey ?? keyOf(cwd), 'test.jsonl'),
    cwd,
    hook_event_name: 'SessionStart',
    source: 'startup',
  });
  // A forward-slash path relative to cwd, which Git Bash on Windows reads as given.
  const r = spawnSync('sh', ['plugins/primer/hooks/notice.sh'], { cwd: root, env: { ...env, CLAUDE_PLUGIN_DATA: data, ...envOverride }, input, encoding: 'utf8' });
  assert.equal(r.status, 0, `hook exited ${r.status}\n${r.stderr}`);
  return r.stdout;
};

const line = (n) => `{"systemMessage":"primer: auto memory has ${n} notes since the last review; run /primer"}\n`;

const snapshot = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, e.name);
      if (e.isDirectory()) walk(path);
      else {
        const s = statSync(path);
        out.push([path, s.size, s.mtimeMs]);
      }
    }
  };
  walk(dir);
  return out.sort();
};

before(() => {
  base = mkdtempSync(join(tmpdir(), 'primer-notice-'));
  const emptyConfig = join(base, 'empty.gitconfig');
  writeFileSync(emptyConfig, '');
  env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: emptyConfig, GIT_CEILING_DIRECTORIES: base };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  gitEnv = { ...env, GIT_AUTHOR_DATE: '2026-09-01T10:00:00Z', GIT_COMMITTER_DATE: '2026-09-01T10:00:00Z' };
  const build = spawnSync('sh', ['tests/primer/fixture/memory/build.sh'], { cwd: root, env: { ...process.env, TMPDIR: base.replaceAll('\\', '/') }, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  fixture = build.stdout.trim();
});

after(() => rmSync(base, { recursive: true, force: true }));

describe('primer notice hook', () => {
  test('counts the notes newer than the stamp', () => {
    const dir = repo('my_repo.v2');
    const { config, data } = place(dir, { stamp: true });
    assert.equal(notice(dir, config, data), line(1));
  });

  test('counts every feedback and project note without a stamp', () => {
    const dir = repo('no-stamp');
    const { config, data } = place(dir, { stamp: false });
    assert.equal(notice(dir, config, data), line(2));
  });

  test('prints nothing when the hub has no marker', () => {
    const dir = repo('no-marker', { 'CLAUDE.md': '# demo\n' });
    const { config, data } = place(dir, { stamp: false });
    assert.equal(notice(dir, config, data), '');
  });

  test('prints nothing without a hub', () => {
    const dir = repo('no-hub', { 'README.md': '# demo\n' });
    const { config, data } = place(dir, { stamp: false });
    assert.equal(notice(dir, config, data), '');
  });

  test('reads the AGENTS.md that a CLAUDE.md adapter names', () => {
    const dir = repo('adapter', { 'CLAUDE.md': '@AGENTS.md\n', 'AGENTS.md': hub });
    const { config, data } = place(dir, { stamp: false });
    assert.equal(notice(dir, config, data), line(2));
  });

  test('reads a hub with CRLF line endings', () => {
    const dir = repo('crlf', { 'CLAUDE.md': '<!-- primer -->\r\n# demo\r\n' });
    const { config, data } = place(dir, { stamp: false });
    assert.equal(notice(dir, config, data), line(2));
  });

  test('finds the main checkout memory from a linked worktree', () => {
    const main = repo('with-worktree');
    const linked = join(base, 'linked-checkout');
    git(main, 'worktree', 'add', '-q', linked);
    const { config, data } = place(main, { stamp: true });
    assert.equal(notice(realpathSync.native(linked), config, data, keyOf(linked)), line(1));
  });

  test('uses the working directory outside a repository', () => {
    const dir = join(base, 'plain_dir.v1');
    write(dir, 'CLAUDE.md', hub);
    const { config, data } = place(dir, { stamp: false });
    assert.equal(notice(realpathSync.native(dir), config, data), line(2));
  });

  test('prints nothing without a memory directory', () => {
    const dir = repo('no-memory');
    const config = join(base, 'run-none', 'config');
    assert.equal(notice(dir, config, join(base, 'run-none', 'data')), '');
  });

  test('skips an index entry that leaves the memory directory', () => {
    const dir = repo('escape');
    const { config, data } = place(dir, { stamp: true });
    const memory = memoryDir(config, dir);
    appendFileSync(join(memory, 'MEMORY.md'), '- [Escape](../escape.md) - outside\n');
    write(dirname(memory), 'escape.md', '---\nname: escape\nmetadata:\n  type: feedback\n  modified: 2026-10-10T00:00:00.000Z\n---\n\nOutside.\n');
    assert.equal(notice(dir, config, data), line(1));
  });

  test('counts a file listed twice once', () => {
    const dir = repo('twice');
    const { config, data } = place(dir, { stamp: true });
    appendFileSync(join(memoryDir(config, dir), 'MEMORY.md'), '- [Again](item-ids-are-numbers.md) - listed again\n');
    assert.equal(notice(dir, config, data), line(1));
  });

  test('writes nothing', () => {
    const dir = repo('read-only');
    const withStamp = place(dir, { stamp: true });
    const without = place(dir, { stamp: false });
    for (const { config, data } of [withStamp, without]) {
      const before = [config, data, dir].map(snapshot);
      assert.notEqual(notice(dir, config, data), '');
      assert.deepEqual([config, data, dir].map(snapshot), before);
    }
  });
});
