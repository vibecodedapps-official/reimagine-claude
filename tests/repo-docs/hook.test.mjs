// Runs the repo-docs drift hook (plugins/repo-docs/hooks/drift.sh) against throwaway repositories, one test per rule.
// The hook needs sh, git, awk and sed on PATH. Every repository lives under one temporary base that is removed at the end.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

let base;
let env;
let gitEnv;

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

const repo = (name, files) => {
  const dir = join(base, name);
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) write(dir, path, content);
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
};

const hook = (input, envOverride = {}) => {
  // A forward-slash path relative to cwd, which Git Bash on Windows reads as given.
  const r = spawnSync('sh', ['plugins/repo-docs/hooks/drift.sh'], { cwd: root, env: { ...env, ...envOverride }, input, encoding: 'utf8' });
  assert.equal(r.status, 0, `hook exited ${r.status}\n${r.stderr}`);
  return r.stdout;
};

const run = (command, cwd, extra = {}) =>
  hook(
    JSON.stringify({
      session_id: 'test',
      hook_event_name: 'PreToolUse',
      tool_name: extra.tool ?? 'Bash',
      tool_input: { command, description: extra.description ?? 'Run a command' },
      cwd,
    }),
    extra.env,
  );

const deny = (finding) =>
  '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"repo-docs: ' + finding + '"}}\n';
const advise = (spokes) =>
  '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"repo-docs: the staged change touches paths these spokes cover; recheck them: ' + spokes + '"}}\n';

const brokenHub = '# Broken\n\nA test repository.\n\n## Spokes\n\n- docs/gone.md: Gone notes. Read always.\n';
const brokenFinding = 'CLAUDE.md points to missing path docs/gone.md';
const hubTo = (path) => '# Broken\n\nA test repository.\n\n## Spokes\n\n- ' + path + ': A. Read always.\n';

const spokesHub = (extra) =>
  '# Spokes\n\nA test repository.\n\n## Commands\n\n- not-a-pointer\n\n## Spokes\n\n' +
  '- docs/api.md: API rules. Read before editing under `src/api/`.\n' +
  '### Group\n\n' +
  '- src/worker/CLAUDE.md: Worker rules. Read before editing the worker.\n' +
  '- docs/style.md: Style rules. Read always.\n' +
  extra +
  '- src: The source tree. Read when lost.\n\n## After\n\n- not a pointer either\n';
const spokesFiles = (extra) => ({
  'CLAUDE.md': spokesHub(extra),
  'docs/api.md': '# API\n\nRules.\n',
  'docs/style.md': '# Style\n\nRules.\n\n## Spokes\n\n- CLAUDE.md: The hub. Read first.\n',
  'src/api/x.js': 'x\n',
  'src/worker/CLAUDE.md': '# Worker\n\nRules.\n',
  'src/worker/job.js': 'j\n',
  'docs/notes.txt': 'n\n',
});

let broken;
let spokes;
let brokenPath;

// Back to a clean index and tree after a step that staged changes.
const clean = (dir) => {
  git(dir, 'reset', '-q');
  git(dir, 'checkout', '-q', '--', '.');
  rmSync(join(dir, 'src/api/y.js'), { force: true });
};
const stage = (dir, path, content) => {
  write(dir, path, content);
  git(dir, 'add', '--', path);
};

before(() => {
  base = mkdtempSync(join(tmpdir(), 'repo-docs-hook-'));
  const emptyConfig = join(base, 'empty.gitconfig');
  writeFileSync(emptyConfig, '');
  env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: emptyConfig, GIT_CEILING_DIRECTORIES: base };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  gitEnv = { ...env, GIT_AUTHOR_DATE: '2026-09-01T10:00:00Z', GIT_COMMITTER_DATE: '2026-09-01T10:00:00Z' };
  broken = repo('broken', { 'CLAUDE.md': brokenHub });
  brokenPath = broken;
  spokes = repo('spokes', spokesFiles(''));
});

after(() => rmSync(base, { recursive: true, force: true }));

describe('repo-docs drift hook', () => {
  test('hooks.json registers one PreToolUse hook for Bash and PowerShell', () => {
    const json = JSON.parse(readFileSync(join(root, 'plugins/repo-docs/hooks/hooks.json'), 'utf8'));
    assert.deepEqual(json, {
      hooks: { PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: 'sh "${CLAUDE_PLUGIN_ROOT}/hooks/drift.sh"' }] }] },
    });
  });

  const positive = [
    'git commit -m x',
    'git add -A && git commit -m x',
    'git add -A; git commit -m x',
    'git add -A\ngit commit -m x',
    'echo msg | git commit -F -',
    '(git commit -m x)',
    'env GIT_AUTHOR_NAME=a git commit -m x',
    'sudo git commit -m x',
    'GIT_EDITOR=true git commit',
    'bash -c "git commit -m x"',
    "sh -c 'git add -A; git commit -m x'",
    '& git commit -m x',
    'git.exe commit -m x',
    '& "C:\\Program Files\\Git\\cmd\\git.exe" commit -m x',
    'git -c user.name=a commit -m x',
    'git --git-dir=.git commit -m x',
    'git --git-dir .git --work-tree . commit -m x',
    'git --no-pager commit -m "fix; things"',
  ];
  for (const command of positive) {
    test(`detects a commit: ${JSON.stringify(command)}`, () => {
      assert.equal(run(command, broken), deny(brokenFinding));
    });
  }

  const wrapped = [
    'if git diff --cached --quiet; then echo none; else git commit -m x; fi',
    'for f in a; do git commit -m x; done',
    '! git commit -m x',
    'time git commit -m x',
    'command git commit -m x',
    'bash -o pipefail -c "git commit -m x"',
    'echo "$(git commit -m x)"',
    '/usr/bin/env git commit -m x',
    'git -C "$REPO" commit -m x',
  ];
  for (const command of wrapped) {
    test(`detects a commit: ${JSON.stringify(command)}`, () => {
      assert.equal(run(command, broken), deny(brokenFinding));
    });
  }

  test('detects a commit after env -C from a non-repository cwd', () => {
    assert.equal(run('env -C broken git commit -m x', base), deny(brokenFinding));
  });

  test('detects a commit after git -C ~/dir with HOME set', () => {
    assert.equal(run('git -C ~/broken commit -m x', base, { env: { HOME: base } }), deny(brokenFinding));
  });

  test('detects a commit from the PowerShell tool', () => {
    assert.equal(run('git commit -m x', broken, { tool: 'PowerShell' }), deny(brokenFinding));
  });

  test('PowerShell reads a backslash before a closing quote as a plain character', () => {
    assert.equal(run('cd "C:\\work\\"; git commit -m x', broken, { tool: 'PowerShell' }), deny(brokenFinding));
  });

  test('PowerShell reads a backtick before a quote as a literal quote', () => {
    assert.equal(run('echo "a`"b"; git commit -m x', broken, { tool: 'PowerShell' }), deny(brokenFinding));
  });

  test('Bash keeps a backslash-escaped quote inside the string', () => {
    assert.equal(run('echo "x\\"; git commit -m x', broken, { tool: 'Bash' }), '');
  });

  test('detects a commit in pretty-printed stdin', () => {
    const input = {
      session_id: 'test',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m x', description: 'Run a command' },
      cwd: broken,
    };
    assert.equal(hook(JSON.stringify(input, null, 2)), deny(brokenFinding));
  });

  const slashed = (p) => p.replaceAll('\\', '/');
  const directory = [
    ['a relative -C', () => 'git -C broken commit -m x'],
    ['a forward-slash -C', () => `git -C ${slashed(brokenPath)} commit -m x`],
    ['a quoted OS-path -C', () => `git -C "${brokenPath}" commit -m x`],
    ['a forward-slash --work-tree=', () => `git --work-tree=${slashed(brokenPath)} commit -m x`],
  ];
  for (const [label, command] of directory) {
    test(`detects a commit from a non-repository cwd with ${label}`, () => {
      assert.equal(run(command(), base), deny(brokenFinding));
    });
  }

  const negative = [
    ['git log --grep commit', {}],
    ['echo git commit', {}],
    ['echo "a; git commit"', {}],
    ['git commit-tree HEAD^{tree}', {}],
    ['git show HEAD:commit', {}],
    ['ls commit', {}],
    ['git status', { description: 'git commit the staged change' }],
    ['git status', { description: 'commit' }],
    ['git commit --dry-run', {}],
    ['git commit --help', {}],
    ['git commit -h', {}],
  ];
  for (const [command, extra] of negative) {
    test(`stays quiet: ${JSON.stringify(command)} ${extra.description ?? ''}`.trim(), () => {
      assert.equal(run(command, broken, extra), '');
    });
  }

  test('stays quiet on empty stdin', () => {
    assert.equal(hook(''), '');
  });

  test('stays quiet on stdin that is not JSON', () => {
    assert.equal(hook('not json commit'), '');
  });

  test('prints nothing without a CLAUDE.md', () => {
    assert.equal(run('git commit -m x', repo('nohub', { 'a.txt': 'a\n' })), '');
  });

  test('prints nothing outside a repository', () => {
    const dir = join(base, 'plain');
    write(dir, 'CLAUDE.md', brokenHub);
    assert.equal(run('git commit -m x', dir), '');
  });

  test('prints nothing for a long CLAUDE.md with no Spokes line', () => {
    const dir = repo('long', { 'CLAUDE.md': '# Long\n' + '- docs/gone.md: Gone notes. Read always.\n'.repeat(99) });
    assert.equal(run('git commit -m x', dir), '');
  });

  test('a clean hub with nothing staged prints nothing', () => {
    assert.equal(run('git commit -m x', spokes), '');
  });

  describe('line caps', () => {
    const capHub = (n) => '# Cap\n' + 'x\n'.repeat(n) + '## Spokes\n\n- docs/a.md: A. Read always.\n';
    test('a 60-line hub passes', () => {
      const dir = repo('cap-hub-60', { 'CLAUDE.md': capHub(56), 'docs/a.md': 'a\n' });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a 61-line hub is denied', () => {
      const dir = repo('cap-hub-61', { 'CLAUDE.md': capHub(57), 'docs/a.md': 'a\n' });
      assert.equal(run('git commit -m x', dir), deny('CLAUDE.md has 61 lines, over the 60-line cap'));
    });
    test('a 200-line spoke passes', () => {
      const dir = repo('cap-spoke-200', { 'CLAUDE.md': hubTo('docs/a.md'), 'docs/a.md': 's\n'.repeat(200) });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a 201-line spoke is denied', () => {
      const dir = repo('cap-spoke-201', { 'CLAUDE.md': hubTo('docs/a.md'), 'docs/a.md': 's\n'.repeat(201) });
      assert.equal(run('git commit -m x', dir), deny('docs/a.md has 201 lines, over the 200-line cap'));
    });
    test('a last line without a newline still counts', () => {
      const hub = '# Cap\n' + 'x\n'.repeat(57) + '## Spokes\n\n- docs/a.md: A. Read always.';
      const dir = repo('cap-no-newline', { 'CLAUDE.md': hub, 'docs/a.md': 'a\n' });
      assert.equal(run('git commit -m x', dir), deny('CLAUDE.md has 61 lines, over the 60-line cap'));
    });
  });

  test('several findings come in order', () => {
    const hub = '# Many\n' + 'x\n'.repeat(56) + '## Spokes\n\n- docs/big.md: Big. Read always.\n- docs/gone.md: Gone. Read always.\n';
    const dir = repo('many', { 'CLAUDE.md': hub, 'docs/big.md': 'b\n'.repeat(201) });
    assert.equal(
      run('git commit -m x', dir),
      deny('CLAUDE.md has 61 lines, over the 60-line cap; CLAUDE.md points to missing path docs/gone.md; docs/big.md has 201 lines, over the 200-line cap'),
    );
  });

  test('a spoke index is followed', () => {
    const dir = repo('nested', { 'CLAUDE.md': hubTo('docs/a.md'), 'docs/a.md': '# A\n\n## Spokes\n\n- docs/b.md: B. Read always.\n' });
    assert.equal(run('git commit -m x', dir), deny('docs/a.md points to missing path docs/b.md'));
  });

  describe('malformed index lines', () => {
    const lines = [
      '- `docs/api.md`: API rules. Read always.',
      '- [api](docs/api.md): API rules. Read always.',
      '- docs/: Docs. Read always.',
      '- @docs/api.md: API rules. Read always.',
      '- docs/api.md: API rules',
    ];
    lines.forEach((line, i) => {
      test(`denies ${line}`, () => {
        const dir = repo(`bad-${i}`, { 'CLAUDE.md': '# Bad\n\n## Spokes\n\n' + line + '\n', 'docs/api.md': 'a\n' });
        assert.equal(run('git commit -m x', dir), deny('CLAUDE.md has a malformed index line: ' + line));
      });
    });
    test('escapes a double quote and a backslash in the finding', () => {
      const line = '- docs/a"b\\c.md: Q. Read always.';
      const dir = repo('bad-quote', { 'CLAUDE.md': '# Bad\n\n## Spokes\n\n' + line + '\n', 'docs/api.md': 'a\n' });
      assert.equal(
        run('git commit -m x', dir),
        '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"repo-docs: CLAUDE.md has a malformed index line: - docs/a\\"b\\\\c.md: Q. Read always."}}\n',
      );
    });
  });

  describe('adapter', () => {
    const fine = '# Fine\n\nA test repository.\n\n## Spokes\n\n- docs/a.md: A. Read always.\n';
    test('@AGENTS.md with a newline reads AGENTS.md as the hub', () => {
      const dir = repo('adapter-nl', { 'CLAUDE.md': '@AGENTS.md\n', 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), deny('AGENTS.md points to missing path docs/gone.md'));
    });
    test('@AGENTS.md without a newline reads AGENTS.md as the hub', () => {
      const dir = repo('adapter-bare', { 'CLAUDE.md': '@AGENTS.md', 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), deny('AGENTS.md points to missing path docs/gone.md'));
    });
    test('@AGENTS.md with CRLF reads AGENTS.md as the hub', () => {
      const dir = repo('adapter-crlf', { 'CLAUDE.md': '@AGENTS.md\r\n', 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), deny('AGENTS.md points to missing path docs/gone.md'));
    });
    test('a clean AGENTS.md hub prints nothing', () => {
      const dir = repo('adapter-fine', { 'CLAUDE.md': '@AGENTS.md\n', 'AGENTS.md': fine, 'docs/a.md': 'a\n' });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('an adapter with no AGENTS.md prints nothing', () => {
      const dir = repo('adapter-missing', { 'CLAUDE.md': '@AGENTS.md\n' });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('@AGENTS.md with two newlines is not the adapter', () => {
      const dir = repo('adapter-two', { 'CLAUDE.md': '@AGENTS.md\n\n', 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), '');
    });
  });

  test('a CRLF hub is read', () => {
    const hub = '# Broken\r\n\r\nA test repository.\r\n\r\n## Spokes\r\n\r\n- docs/gone.md: Gone notes. Read always.\r\n';
    const dir = repo('crlf', { 'CLAUDE.md': hub });
    assert.equal(run('git commit -m x', dir), deny(brokenFinding));
  });

  test('staged paths name the spokes to recheck', () => {
    const steps = [
      ['src/api/x.js changed', [['src/api/x.js', 'x2\n']], advise('docs/api.md')],
      ['src/api/x.js and docs/api.md changed', [['src/api/x.js', 'x2\n'], ['docs/api.md', '# API\n\nRules 2.\n']], ''],
      ['src/worker/job.js changed', [['src/worker/job.js', 'j2\n']], advise('src/worker/CLAUDE.md')],
      ['src/api/x.js and src/worker/job.js changed', [['src/api/x.js', 'x2\n'], ['src/worker/job.js', 'j2\n']], advise('docs/api.md, src/worker/CLAUDE.md')],
      ['docs/notes.txt changed', [['docs/notes.txt', 'n2\n']], ''],
      ['a new file src/api/y.js', [['src/api/y.js', 'y\n']], advise('docs/api.md')],
    ];
    try {
      for (const [label, changes, expected] of steps) {
        clean(spokes);
        for (const [path, content] of changes) stage(spokes, path, content);
        assert.equal(run('git commit -m x', spokes), expected, label);
      }
    } finally {
      clean(spokes);
    }
  });

  test('a deny wins over advice', () => {
    const dir = repo('deny-wins', spokesFiles('- docs/gone.md: Gone. Read always.\n'));
    stage(dir, 'src/api/x.js', 'x2\n');
    assert.equal(run('git commit -m x', dir), deny(brokenFinding));
  });

  describe('never writes a file', () => {
    const status = (dir) => git(dir, 'status', '--porcelain=v1', '--ignored', '-uall');
    const unchanged = (dir, command) => {
      const prior = { status: status(dir), entries: readdirSync(base).sort() };
      const out = run(command, dir);
      assert.deepEqual({ status: status(dir), entries: readdirSync(base).sort() }, prior);
      return out;
    };
    test('a deny leaves the repository and the base as they were', () => {
      assert.equal(unchanged(broken, 'git commit -m x'), deny(brokenFinding));
    });
    test('advice leaves the repository and the base as they were', () => {
      try {
        stage(spokes, 'src/api/x.js', 'x2\n');
        assert.equal(unchanged(spokes, 'git commit -m x'), advise('docs/api.md'));
      } finally {
        clean(spokes);
      }
    });
  });
});
