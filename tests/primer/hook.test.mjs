// Runs the primer drift hook (plugins/primer/hooks/drift.sh) against throwaway repositories, one test per rule.
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
  const r = spawnSync('sh', ['plugins/primer/hooks/drift.sh'], { cwd: root, env: { ...env, ...envOverride }, input, encoding: 'utf8' });
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

const deny = (findings) =>
  '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"primer: ' + findings + '"}}\n';
const advise = (files) =>
  '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"primer: the staged change touches files these cover; recheck them: ' + files + '"}}\n';

// The hub is 12 lines; the nested CLAUDE.md is 11; the skill is 8.
const opening = (doc) =>
  'A test repository. Read `' + doc + '` before changing the design; the handlers are under `src/api/`, `README.md` is for people, `plugins/<name>/` is a placeholder, `src/*.ts` is a glob and `npm test` is a command.';
const hubOf = (para) =>
  '<!-- primer -->\n# Fixture\n\n' + para + '\n\n## Commands\n\n- `npm test`: runs the tests; `docs/gone.md` here is not checked.\n\n## Constraints\n\n- Keep every file short.\n';
const hubText = hubOf(opening('docs/design.md'));
const brokenHub = hubOf(opening('docs/gone.md'));
const brokenFinding = 'CLAUDE.md names missing path docs/gone.md';

const codeWith = (front) => '---\n' + front + '\n---\n# Code\n\nType every export.\n';
const libWith = (front) => '---\n' + front + '\n---\n# Lib\n\nKeep lib pure.\n';
const pickWith = (front) => '---\n' + front + '\n---\n# Pick\n\nA and B only.\n';
const skillText =
  '---\nname: release\ndescription: Cut a release. Use when the user says "cut a release".\npaths: scripts/**\n---\n# Release\n\n1. Run `scripts/release.sh`.\n';
const skillNoDescription = skillText.replace('description: Cut a release. Use when the user says "cut a release".\n', '');
const apiText = '# API\n\nThe handlers.\n\n## Commands\n\n- `npm test`: runs the tests.\n\n## Constraints\n\n- Validate input.\n';

const baseFiles = {
  'CLAUDE.md': hubText,
  'README.md': '# Fixture\n',
  'docs/design.md': '# Design\n\nNotes.\n',
  'notes/deep/todo.md': '# Todo\n',
  'src/api/CLAUDE.md': apiText,
  'src/api/handler.ts': 'export const h = 1;\n',
  'src/app.tsx': 'export const a = 1;\n',
  'src/a.ts': 'export const x = 1;\n',
  'src/b.ts': 'export const x = 1;\n',
  'src/c.ts': 'export const x = 1;\n',
  'lib/g.ts': 'export const g = 1;\n',
  'tests/g.test.ts': 'test;\n',
  'scripts/release.sh': 'echo release\n',
  '.claude/rules/style.md': '# Style\n\nWrite plain prose.\n',
  '.claude/rules/code.md': codeWith('paths: ["src/**/*.{ts,tsx}", "*.md"]'),
  '.claude/rules/lib.md': libWith('paths: lib/*.ts, tests/**/*.test.ts'),
  '.claude/rules/area/pick.md': pickWith('paths:\n  - "src/[ab].ts"'),
  '.claude/skills/release/SKILL.md': skillText,
};

// The base fixture with overrides applied; a null value deletes the path.
const files = (overrides = {}) => {
  const out = { ...baseFiles };
  for (const [path, content] of Object.entries(overrides)) {
    if (content === null) delete out[path];
    else out[path] = content;
  }
  return out;
};
const make = (name, overrides) => repo(name, files(overrides));

// Appends filler lines to a text that has `have` lines, up to `total` lines.
const pad = (text, have, total) => text + 'x\n'.repeat(total - have);

let broken;
let brokenPath;
let fixture;

// Back to a clean index and tree after a step that changed files.
const clean = (dir) => {
  git(dir, 'reset', '-q');
  git(dir, 'checkout', '-q', '--', '.');
  rmSync(join(dir, 'src/new.ts'), { force: true });
};
const stage = (dir, path, content) => {
  write(dir, path, content);
  git(dir, 'add', '--', path);
};

before(() => {
  base = mkdtempSync(join(tmpdir(), 'primer-hook-'));
  const emptyConfig = join(base, 'empty.gitconfig');
  writeFileSync(emptyConfig, '');
  env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: emptyConfig, GIT_CEILING_DIRECTORIES: base };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  gitEnv = { ...env, GIT_AUTHOR_DATE: '2026-09-01T10:00:00Z', GIT_COMMITTER_DATE: '2026-09-01T10:00:00Z' };
  broken = make('broken', { 'CLAUDE.md': brokenHub });
  brokenPath = broken;
  fixture = make('fixture', {});
});

after(() => rmSync(base, { recursive: true, force: true }));

describe('primer drift hook', () => {
  test('hooks.json registers one PreToolUse hook for Bash and PowerShell and one SessionStart hook for startup', () => {
    const json = JSON.parse(readFileSync(join(root, 'plugins/primer/hooks/hooks.json'), 'utf8'));
    assert.deepEqual(json, {
      hooks: {
        PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: 'sh "${CLAUDE_PLUGIN_ROOT}/hooks/drift.sh"' }] }],
        SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'sh "${CLAUDE_PLUGIN_ROOT}/hooks/notice.sh"' }] }],
      },
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

  test('prints nothing outside a repository', () => {
    const dir = join(base, 'plain');
    write(dir, 'CLAUDE.md', brokenHub);
    assert.equal(run('git commit -m x', dir), '');
  });

  test('a byte that is not UTF-8 in the command does not disable the hook under a UTF-8 locale', () => {
    const dir = make('bad-byte', { 'CLAUDE.md': brokenHub });
    const input = Buffer.concat([
      Buffer.from('{"tool_name":"Bash","tool_input":{"command":"git commit -m \\"caf'),
      Buffer.from([0xff]),
      Buffer.from('\\""},"cwd":' + JSON.stringify(dir) + '}'),
    ]);
    for (const locale of ['en_US.UTF-8', 'C.UTF-8', 'C']) assert.equal(hook(input, { LC_ALL: locale }), deny(brokenFinding), locale);
  });

  describe('quiet and opt-in', () => {
    test('the base fixture with nothing staged prints nothing', () => {
      assert.equal(run('git commit -m x', fixture), '');
    });
    test('a hub without the marker line prints nothing', () => {
      const dir = make('no-marker', { 'CLAUDE.md': brokenHub.split('\n').slice(1).join('\n') });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a marker on line 2 after a blank line prints nothing', () => {
      const dir = make('marker-line-2', { 'CLAUDE.md': '\n' + brokenHub });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a hub with CRLF line ends is read', () => {
      const dir = make('crlf-hub', { 'CLAUDE.md': brokenHub.replaceAll('\n', '\r\n') });
      assert.equal(run('git commit -m x', dir), deny(brokenFinding));
    });
    test('no CLAUDE.md or AGENTS.md prints nothing', () => {
      assert.equal(run('git commit -m x', repo('nohub', { 'a.txt': 'a\n' })), '');
    });
  });

  describe('which file is the hub', () => {
    const agentsFinding = 'AGENTS.md names missing path docs/gone.md';
    test('@AGENTS.md with a newline reads AGENTS.md as the hub', () => {
      const dir = make('adapter-nl', { 'CLAUDE.md': '@AGENTS.md\n', 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), deny(agentsFinding));
    });
    test('@AGENTS.md without a newline reads AGENTS.md as the hub', () => {
      const dir = make('adapter-bare', { 'CLAUDE.md': '@AGENTS.md', 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), deny(agentsFinding));
    });
    test('@AGENTS.md with CRLF reads AGENTS.md as the hub', () => {
      const dir = make('adapter-crlf', { 'CLAUDE.md': '@AGENTS.md\r\n', 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), deny(agentsFinding));
    });
    test('an adapter with no AGENTS.md prints nothing', () => {
      const dir = make('adapter-missing', { 'CLAUDE.md': '@AGENTS.md\n' });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('@AGENTS.md with two newlines is not the adapter, so CLAUDE.md is the hub and has no marker', () => {
      const dir = make('adapter-two', { 'CLAUDE.md': '@AGENTS.md\n\n', 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('AGENTS.md is the hub when no CLAUDE.md exists', () => {
      const dir = make('direct-agents', { 'CLAUDE.md': null, 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), deny(agentsFinding));
    });
    test('a CLAUDE.md without the marker beside a marked AGENTS.md prints nothing', () => {
      const dir = make('claude-wins', { 'CLAUDE.md': hubText.split('\n').slice(1).join('\n'), 'AGENTS.md': brokenHub });
      assert.equal(run('git commit -m x', dir), '');
    });
  });

  describe('hub path check', () => {
    test('a path spelled in another case is a missing path', () => {
      const dir = make('case-path', { 'CLAUDE.md': hubOf(opening('Docs/design.md')) });
      assert.equal(run('git commit -m x', dir), deny('CLAUDE.md names missing path Docs/design.md'));
    });
    test('a token named twice in the opening paragraph is one finding', () => {
      const dir = make('twice', { 'CLAUDE.md': hubOf(opening('docs/gone.md') + ' See `docs/gone.md` again.') });
      assert.equal(run('git commit -m x', dir), deny(brokenFinding));
    });
    test('a backticked URL is checked as a path', () => {
      const dir = make('url', { 'CLAUDE.md': hubOf(opening('https://example.invalid/x')) });
      assert.equal(run('git commit -m x', dir), deny('CLAUDE.md names missing path https://example.invalid/x'));
    });
    test('a double quote and a backslash in the finding are escaped', () => {
      const dir = make('quote', { 'CLAUDE.md': hubOf(opening('docs/a"b\\c.md')) });
      assert.equal(
        run('git commit -m x', dir),
        '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"primer: CLAUDE.md names missing path docs/a\\"b\\\\c.md"}}\n',
      );
    });
  });

  describe('line caps', () => {
    test('a 60-line hub passes', () => {
      const dir = make('cap-hub-60', { 'CLAUDE.md': pad(hubText, 12, 60) });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a 61-line hub is denied', () => {
      const dir = make('cap-hub-61', { 'CLAUDE.md': pad(hubText, 12, 61) });
      assert.equal(run('git commit -m x', dir), deny('CLAUDE.md has 61 lines, over its cap of 60'));
    });
    test('a 61-line hub whose last line has no newline is denied with 61', () => {
      const dir = make('cap-hub-no-newline', { 'CLAUDE.md': pad(hubText, 12, 61).slice(0, -1) });
      assert.equal(run('git commit -m x', dir), deny('CLAUDE.md has 61 lines, over its cap of 60'));
    });
    test('a 60-line nested CLAUDE.md passes', () => {
      const dir = make('cap-nested-60', { 'src/api/CLAUDE.md': pad(apiText, 11, 60) });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a 61-line nested CLAUDE.md is denied', () => {
      const dir = make('cap-nested-61', { 'src/api/CLAUDE.md': pad(apiText, 11, 61) });
      assert.equal(run('git commit -m x', dir), deny('src/api/CLAUDE.md has 61 lines, over its cap of 60'));
    });
    test('a 200-line rule passes', () => {
      const dir = make('cap-rule-200', { '.claude/rules/style.md': pad('# Style\n\nWrite plain prose.\n', 3, 200) });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a 201-line rule is denied', () => {
      const dir = make('cap-rule-201', { '.claude/rules/style.md': pad('# Style\n\nWrite plain prose.\n', 3, 201) });
      assert.equal(run('git commit -m x', dir), deny('.claude/rules/style.md has 201 lines, over its cap of 200'));
    });
    test('a 150-line SKILL.md passes', () => {
      const dir = make('cap-skill-150', { '.claude/skills/release/SKILL.md': pad(skillText, 8, 150) });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a 151-line SKILL.md is denied', () => {
      const dir = make('cap-skill-151', { '.claude/skills/release/SKILL.md': pad(skillText, 8, 151) });
      assert.equal(run('git commit -m x', dir), deny('.claude/skills/release/SKILL.md has 151 lines, over its cap of 150'));
    });
    test('a 70-line .claude/CLAUDE.md is not a nested file and has no cap', () => {
      const dir = make('cap-dot-claude', { '.claude/CLAUDE.md': '# Dot\n' + 'x\n'.repeat(69) });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('an untracked 70-line nested CLAUDE.md is not read', () => {
      const dir = make('cap-untracked', {});
      write(dir, 'docs/CLAUDE.md', '# Docs\n' + 'x\n'.repeat(69));
      assert.equal(run('git commit -m x', dir), '');
    });
  });

  describe('paths values', () => {
    const codeFinding = '.claude/rules/code.md has a paths value the host cannot read';
    test('a flow list that is not closed is unreadable', () => {
      const dir = make('paths-unclosed-flow', { '.claude/rules/code.md': codeWith('paths: [unclosed') });
      assert.equal(run('git commit -m x', dir), deny(codeFinding));
    });
    test('a quote that is not closed is unreadable', () => {
      const dir = make('paths-unclosed-quote', { '.claude/rules/code.md': codeWith('paths: "src/**') });
      assert.equal(run('git commit -m x', dir), deny(codeFinding));
    });
    test('an empty paths with no items is unreadable', () => {
      const dir = make('paths-empty', { '.claude/rules/code.md': codeWith('paths:') });
      assert.equal(run('git commit -m x', dir), deny(codeFinding));
    });
    test('a glob that matches no tracked file is denied', () => {
      const dir = make('paths-gone', { '.claude/rules/code.md': codeWith('paths: ["src/**/*.{ts,tsx}", "gone/*.md"]') });
      assert.equal(run('git commit -m x', dir), deny('.claude/rules/code.md paths glob gone/*.md matches no tracked file'));
    });
    test('a brace alternative that matches nothing is fine when another matches', () => {
      const dir = make('paths-brace-partial', { '.claude/rules/code.md': codeWith('paths: ["src/**/*.{ts,rs}"]') });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a quoted comma string is split into globs', () => {
      const dir = make('paths-quoted-string', { '.claude/rules/lib.md': libWith('paths: "lib/*.ts, tests/**/*.test.ts"') });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a rule with CRLF line ends is read', () => {
      const dir = make('paths-crlf', { '.claude/rules/lib.md': libWith('paths: lib/*.ts, tests/**/*.test.ts').replaceAll('\n', '\r\n') });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a slashless glob matches at depth', () => {
      const dir = make('paths-slashless', { '.claude/rules/area/pick.md': pickWith('paths:\n  - "[ab].ts"') });
      assert.equal(run('git commit -m x', dir), '');
    });
    test('a slashless glob that matches nothing is denied', () => {
      const dir = make('paths-slashless-gone', { '.claude/rules/area/pick.md': pickWith('paths:\n  - "[xy].ts"') });
      assert.equal(run('git commit -m x', dir), deny('.claude/rules/area/pick.md paths glob [xy].ts matches no tracked file'));
    });
    test('a skill paths glob that matches nothing is denied', () => {
      const dir = make('paths-skill-gone', { '.claude/skills/release/SKILL.md': skillText.replace('paths: scripts/**', 'paths: gone/**') });
      assert.equal(run('git commit -m x', dir), deny('.claude/skills/release/SKILL.md paths glob gone/** matches no tracked file'));
    });
    test('a skill without a description is denied', () => {
      const dir = make('skill-no-description', { '.claude/skills/release/SKILL.md': skillNoDescription });
      assert.equal(run('git commit -m x', dir), deny('.claude/skills/release/SKILL.md has no description'));
    });
    test('an untracked file counts for a glob only when the command runs git add', () => {
      const dir = make('paths-untracked', { '.claude/rules/gen.md': codeWith('paths: ["gen/*.ts"]') });
      write(dir, 'gen/x.ts', 'export const x = 1;\n');
      assert.equal(run('git commit -m x', dir), deny('.claude/rules/gen.md paths glob gen/*.ts matches no tracked file'));
      assert.equal(run('git add -A && git commit -m x', dir), advise('.claude/rules/gen.md'));
    });
  });

  test('several findings come in the order hub, nested, rules, skills', () => {
    const dir = make('order', {
      'CLAUDE.md': pad(brokenHub, 12, 61),
      'src/api/CLAUDE.md': pad(apiText, 11, 61),
      '.claude/rules/code.md': codeWith('paths: [unclosed'),
      '.claude/skills/release/SKILL.md': skillNoDescription,
    });
    assert.equal(
      run('git commit -m x', dir),
      deny(
        'CLAUDE.md has 61 lines, over its cap of 60; CLAUDE.md names missing path docs/gone.md; src/api/CLAUDE.md has 61 lines, over its cap of 60; .claude/rules/code.md has a paths value the host cannot read; .claude/skills/release/SKILL.md has no description',
      ),
    );
  });

  describe('advice from the changed set', () => {
    const codeMore = baseFiles['.claude/rules/code.md'] + 'More.\n';
    const steps = [
      ['src/api/handler.ts changed', [['src/api/handler.ts', 'export const h = 2;\n']], advise('.claude/rules/code.md, src/api/CLAUDE.md')],
      [
        'src/api/handler.ts and src/api/CLAUDE.md changed',
        [['src/api/handler.ts', 'export const h = 2;\n'], ['src/api/CLAUDE.md', apiText + 'More.\n']],
        advise('.claude/rules/code.md'),
      ],
      ['src/app.tsx changed, matched through a brace group', [['src/app.tsx', 'export const a = 2;\n']], advise('.claude/rules/code.md')],
      ['notes/deep/todo.md changed, matched by a slashless glob at depth', [['notes/deep/todo.md', '# Todo 2\n']], advise('.claude/rules/code.md')],
      ['src/a.ts changed', [['src/a.ts', 'export const x = 2;\n']], advise('.claude/rules/area/pick.md, .claude/rules/code.md')],
      ['src/c.ts changed', [['src/c.ts', 'export const x = 2;\n']], advise('.claude/rules/code.md')],
      ['lib/g.ts changed', [['lib/g.ts', 'export const g = 2;\n']], advise('.claude/rules/lib.md')],
      ['tests/g.test.ts changed', [['tests/g.test.ts', 'test 2;\n']], advise('.claude/rules/lib.md')],
      ['scripts/release.sh changed', [['scripts/release.sh', 'echo release 2\n']], advise('.claude/skills/release/SKILL.md')],
      ['src/app.tsx and .claude/rules/code.md changed', [['src/app.tsx', 'export const a = 2;\n'], ['.claude/rules/code.md', codeMore]], ''],
      ['.claude/rules/style.md changed, matched by the *.md glob of code.md', [['.claude/rules/style.md', '# Style\n\nWrite prose.\n']], advise('.claude/rules/code.md')],
    ];
    for (const [label, changes, expected] of steps) {
      test(label, () => {
        try {
          clean(fixture);
          for (const [path, content] of changes) stage(fixture, path, content);
          assert.equal(run('git commit -m x', fixture), expected);
        } finally {
          clean(fixture);
        }
      });
    }

    test('a change under a .claude/CLAUDE.md directory draws no advice', () => {
      const dir = make('advice-dot-claude', { '.claude/CLAUDE.md': '# Dot\n' + 'x\n'.repeat(69) });
      stage(dir, '.claude/x.txt', 'x\n');
      assert.equal(run('git commit -m x', dir), '');
    });
  });

  describe('files the command itself stages', () => {
    const dir = () => join(base, 'stage-set');
    before(() => make('stage-set', {}));
    const steps = [
      ['add then commit', [['src/api/handler.ts', 'export const h = 2;\n']], 'git add src/api/handler.ts && git commit -m x', advise('.claude/rules/code.md, src/api/CLAUDE.md')],
      ['commit -a', [['src/api/handler.ts', 'export const h = 2;\n']], 'git commit -am x', advise('.claude/rules/code.md, src/api/CLAUDE.md')],
      ['commit with a path', [['src/api/handler.ts', 'export const h = 2;\n']], 'git commit src/api/handler.ts -m x', advise('.claude/rules/code.md, src/api/CLAUDE.md')],
      ['add -A with an untracked file', [['src/new.ts', 'export const n = 1;\n']], 'git add -A && git commit -m x', advise('.claude/rules/code.md')],
      ['commit with an untracked file and no add', [['src/new.ts', 'export const n = 1;\n']], 'git commit -m x', ''],
    ];
    for (const [label, changes, command, expected] of steps) {
      test(label, () => {
        try {
          clean(dir());
          for (const [path, content] of changes) write(dir(), path, content);
          assert.equal(run(command, dir()), expected);
        } finally {
          clean(dir());
        }
      });
    }
  });

  test('a deny wins over advice', () => {
    const dir = make('deny-wins', { 'CLAUDE.md': brokenHub });
    stage(dir, 'src/app.tsx', 'export const a = 2;\n');
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
        stage(fixture, 'src/api/handler.ts', 'export const h = 2;\n');
        assert.equal(unchanged(fixture, 'git commit -m x'), advise('.claude/rules/code.md, src/api/CLAUDE.md'));
      } finally {
        clean(fixture);
      }
    });
  });
});
