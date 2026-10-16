// Runs tools/lint.mjs against copies of this repository, one clean copy and one mutation per message.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
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

const put = (dir, path, text) => {
  const file = join(dir, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

// Replaces the first occurrence of from; a newline in from or to follows the file's own line ending.
const edit = (dir, path, from, to) => {
  const text = read(dir, path);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const a = from.replaceAll('\n', eol);
  assert.ok(text.includes(a), `${path} lacks ${JSON.stringify(from)}`);
  put(dir, path, text.replace(a, () => to.replaceAll('\n', eol)));
};

const append = (dir, path, text) => put(dir, path, read(dir, path) + text);

const editJson = (dir, path, change) => {
  const value = JSON.parse(read(dir, path));
  change(value);
  put(dir, path, JSON.stringify(value, null, 2) + '\n');
};

const catalog = '.claude-plugin/marketplace.json';
const manifest = (name) => `plugins/${name}/.claude-plugin/plugin.json`;
const entry = (c, name) => c.plugins.find((p) => p.name === name);

const setVersion = (dir, name, version) => {
  editJson(dir, manifest(name), (m) => { m.version = version; });
  editJson(dir, catalog, (c) => { entry(c, name).version = version; });
};
const bump = (dir, name) => setVersion(dir, name, '0.1.0-alpha.2');

// A bump of the audit plugin would also differ from the plugin_version literals in its text, so its tag goes instead.
const settle = (dir, name) => (name === 'audit' ? git(dir, 'tag', '-d', 'audit--v0.1.0-alpha.1') : bump(dir, name));

const files = (dir, sub = '') =>
  readdirSync(join(dir, sub), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(dir, `${sub}${e.name}/`) : [`${sub}${e.name}`]));

const caseDir = () => {
  const dir = join(base, `case-${++seq}`);
  cpSync(clean, dir, { recursive: true });
  return dir;
};

const lint = (dir, extraEnv = {}) =>
  spawnSync(process.execPath, ['tools/lint.mjs'], { cwd: dir, encoding: 'utf8', env: { ...env, ...extraEnv }, timeout: 120000 });

const shown = (r) => `status ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`;

const passes = (r) => {
  assert.equal(r.status, 0, shown(r));
  assert.match(r.stdout, /^lint: ok \(\d+ files, 4 plugins\)\n$/, shown(r));
};

const fails = (r, n, messages) => {
  assert.equal(r.status, 1, shown(r));
  const lines = r.stdout.split('\n');
  assert.equal(lines.pop(), '', shown(r));
  assert.equal(lines[0], `lint: ${n} failure(s)`, shown(r));
  assert.deepEqual(lines.slice(1), messages.map((m) => `- ${m}`), shown(r));
};

const negative = (title, mutate, n, messages, extraEnv) =>
  test(title, () => {
    const dir = caseDir();
    mutate(dir);
    fails(lint(dir, extraEnv), n, messages);
  });

const positive = (title, mutate) =>
  test(title, () => {
    const dir = caseDir();
    mutate(dir);
    passes(lint(dir));
  });

const extra = 'plugins/rules/rules/extra.md';
const repoUrl = 'https://github.com/vibecodedapps-official/reimagine-claude';

const headings = [
  '## Unreleased',
  '## repo-docs 0.1.0-alpha.1 - 2026-10-15',
  '## audit 0.1.0-alpha.1 - 2026-10-15',
  '## loop 0.1.0-alpha.1 - 2026-10-15',
  '## rules 0.1.0-alpha.1 - 2026-10-15',
];
const changelog = (list) => '# Changelog\n\n' + list.map((h) => `${h}\n\n`).join('');

// The suite checks the rules, not the release state: the copy holds every plugin at 0.1.0-alpha.1, one heading each.
const pin = (dir) => {
  for (const name of ['rules', 'loop', 'audit', 'repo-docs']) setVersion(dir, name, '0.1.0-alpha.1');
  for (const path of ['plugins/audit/skills/audit/SKILL.md', 'plugins/audit/skills/audit/resume.md', 'plugins/audit/skills/audit/stages/1-orient.md']) {
    put(dir, path, read(dir, path).split('\n').map((l) => (l.includes('plugin_version') ? l.replace(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]*[0-9A-Za-z])?/g, '0.1.0-alpha.1') : l)).join('\n'));
  }
  put(dir, 'CHANGELOG.md', changelog(headings));
};

before(() => {
  base = mkdtempSync(join(tmpdir(), 'lint-'));
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
  // One tag per changelog heading, as a release leaves them, so a bump still waiting for its heading stays untagged.
  for (const m of read(clean, 'CHANGELOG.md').matchAll(/^## (\S+) (\S+) - \d{4}-\d{2}-\d{2}\r?$/gm)) {
    git(clean, 'tag', `${m[1]}--v${m[2]}`);
  }
  git(clean, 'repack', '-q', '-a', '-d');
});

after(() => rmSync(base, { recursive: true, force: true }));

test('R218: a clean copy prints lint: ok (<f> files, 4 plugins) and exits 0', () => {
  passes(lint(caseDir()));
});

test('R219: <file>: node --check failed: <stderr line>', () => {
  const dir = caseDir();
  put(dir, 'tools/broken.mjs', 'export const = 1;\n');
  const r = lint(dir);
  assert.equal(r.status, 1, shown(r));
  const lines = r.stdout.split('\n');
  assert.equal(lines.length, 3, shown(r));
  assert.equal(lines[0], 'lint: 1 failure(s)', shown(r));
  assert.ok(lines[1].startsWith('- tools/broken.mjs: node --check failed: '), shown(r));
  assert.equal(lines[2], '', shown(r));
});

negative('R38: <file>: imports <s>, not a node: built-in', (dir) => put(dir, 'tools/extra.mjs', "import x from 'lodash';\nexport default x;\n"), 1, [
  'tools/extra.mjs: imports lodash, not a node: built-in',
]);
negative('R38: <file>: imports <s>, not a node: built-in (bare import)', (dir) => put(dir, 'tools/extra.mjs', "import 'lodash';\n"), 1, [
  'tools/extra.mjs: imports lodash, not a node: built-in',
]);
negative('R38: <file>: imports <s>, not a node: built-in (dynamic import)', (dir) => put(dir, 'tools/extra.mjs', "const x = await import('lodash');\nexport default x;\n"), 1, [
  'tools/extra.mjs: imports lodash, not a node: built-in',
]);
negative('R38: <file>: imports <s>, not a node: built-in (require)', (dir) => put(dir, 'tools/extra.mjs', "const x = require('lodash');\nexport default x;\n"), 1, [
  'tools/extra.mjs: imports lodash, not a node: built-in',
]);
positive('R38: node: and relative specifiers pass', (dir) =>
  put(dir, 'tools/extra.mjs', "import { x } from 'node:fs';\nimport y from './y.mjs';\nimport z from '../z.mjs';\nconst w = await import('node:os');\nexport default [x, y, z, w];\n"));

negative('R38: rules.mjs over the 700-line budget', (dir) => {
  put(dir, 'plugins/rules/scripts/rules.mjs', '// x\n'.repeat(701));
  bump(dir, 'rules');
}, 1, ['plugins/rules/scripts/rules.mjs: 701 lines, over the 700-line budget']);
negative('R38: rules.mjs over the 700-line budget (last line without a newline)', (dir) => {
  put(dir, 'plugins/rules/scripts/rules.mjs', '// x\n'.repeat(700) + '// x');
  bump(dir, 'rules');
}, 1, ['plugins/rules/scripts/rules.mjs: 701 lines, over the 700-line budget']);
positive('R38: rules.mjs at 700 lines passes', (dir) => {
  put(dir, 'plugins/rules/scripts/rules.mjs', '// x\n'.repeat(700));
  bump(dir, 'rules');
});

negative('R219: loop SKILL.md over the 5800-word cap', (dir) => {
  append(dir, 'plugins/loop/skills/run/SKILL.md', '\n' + 'w '.repeat(2102) + '\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/skills/run/SKILL.md: 5850 words, over the 5800-word cap']);
positive('R219: loop SKILL.md at 5800 words passes', (dir) => {
  append(dir, 'plugins/loop/skills/run/SKILL.md', '\n' + 'w '.repeat(2052) + '\n');
  bump(dir, 'loop');
});

negative('R219: .claude-plugin/marketplace.json: missing or not JSON (missing)', (dir) => rmSync(join(dir, catalog)), 1, [
  '.claude-plugin/marketplace.json: missing or not JSON',
]);
negative('R219: .claude-plugin/marketplace.json: missing or not JSON (not JSON)', (dir) => put(dir, catalog, '{ not json\n'), 1, [
  '.claude-plugin/marketplace.json: missing or not JSON',
]);
negative('R219: <manifest>: missing or not JSON', (dir) => {
  put(dir, manifest('loop'), '{ not json\n');
}, 1, ['plugins/loop/.claude-plugin/plugin.json: missing or not JSON']);

negative('R1: .claude-plugin/marketplace.json: name is <name>, not reimagine-claude', (dir) => editJson(dir, catalog, (c) => { c.name = 'other'; }), 1, [
  '.claude-plugin/marketplace.json: name is other, not reimagine-claude',
]);
negative('R1: .claude-plugin/marketplace.json: name is missing, not reimagine-claude', (dir) => editJson(dir, catalog, (c) => { delete c.name; }), 1, [
  '.claude-plugin/marketplace.json: name is missing, not reimagine-claude',
]);
negative('R219: .claude-plugin/marketplace.json: metadata.description is missing', (dir) => editJson(dir, catalog, (c) => { delete c.metadata.description; }), 1, [
  '.claude-plugin/marketplace.json: metadata.description is missing',
]);
negative('R219: .claude-plugin/marketplace.json: metadata.description is missing (empty)', (dir) => editJson(dir, catalog, (c) => { c.metadata.description = ''; }), 1, [
  '.claude-plugin/marketplace.json: metadata.description is missing',
]);
negative('Decision 32: .claude-plugin/marketplace.json: metadata.version is missing or not semver', (dir) => editJson(dir, catalog, (c) => { c.metadata.version = '1.0'; }), 1, [
  '.claude-plugin/marketplace.json: metadata.version is missing or not semver',
]);
negative('Decision 32: .claude-plugin/marketplace.json: metadata.version is missing or not semver (missing)', (dir) => editJson(dir, catalog, (c) => { delete c.metadata.version; }), 1, [
  '.claude-plugin/marketplace.json: metadata.version is missing or not semver',
]);

negative('R1: .claude-plugin/marketplace.json: entry <name> is not one of rules, loop, audit, repo-docs', (dir) => {
  editJson(dir, catalog, (c) => { c.plugins.push({ name: 'extra', source: './plugins/loop', description: 'x', version: '0.1.0-alpha.1' }); });
  append(dir, 'README.md', '/plugin install extra@reimagine-claude\n/plugin uninstall extra@reimagine-claude\n');
}, 2, [
  '.claude-plugin/marketplace.json: entry extra is not one of rules, loop, audit, repo-docs',
  '.claude-plugin/marketplace.json: entry extra source ./plugins/loop is not a plugin directory ./plugins/extra',
]);
negative('R219: .claude-plugin/marketplace.json: entry <name> source <source> is not a plugin directory ./plugins/<name>', (dir) => {
  editJson(dir, catalog, (c) => { entry(c, 'loop').source = './plugins/nope'; });
}, 1, ['.claude-plugin/marketplace.json: entry loop source ./plugins/nope is not a plugin directory ./plugins/loop']);
negative('R219: .claude-plugin/marketplace.json: entry <name> has <field> <entry value>, the manifest has <manifest value>', (dir) => {
  editJson(dir, catalog, (c) => { entry(c, 'loop').version = '0.1.0-alpha.2'; });
}, 1, ['.claude-plugin/marketplace.json: entry loop has version 0.1.0-alpha.2, the manifest has 0.1.0-alpha.1']);
negative('R219: .claude-plugin/marketplace.json: entry <name> has <field> missing, the manifest has <manifest value>', (dir) => {
  editJson(dir, catalog, (c) => { delete entry(c, 'loop').version; });
}, 2, [
  '.claude-plugin/marketplace.json: entry loop has version missing, the manifest has 0.1.0-alpha.1',
  '.claude-plugin/marketplace.json entry loop: version missing is not semver',
]);
negative('R219: plugins/<dir>: no catalog entry', (dir) => {
  editJson(dir, catalog, (c) => { c.plugins = c.plugins.filter((p) => p.name !== 'loop'); });
}, 1, ['plugins/loop: no catalog entry']);
negative('R1: .claude-plugin/marketplace.json: lists <names>; a release catalog lists rules, loop, audit, repo-docs', (dir) => {
  for (const name of ['rules', 'loop', 'repo-docs']) setVersion(dir, name, '0.1.0');
  editJson(dir, catalog, (c) => { c.plugins = c.plugins.filter((p) => p.name !== 'audit'); });
}, 2, [
  'plugins/audit: no catalog entry',
  '.claude-plugin/marketplace.json: lists rules, loop, repo-docs; a release catalog lists rules, loop, audit, repo-docs',
]);

negative('R14: <manifest>: version <v> is not semver', (dir) => {
  editJson(dir, manifest('loop'), (m) => { m.version = '1.0'; });
}, 2, [
  '.claude-plugin/marketplace.json: entry loop has version 0.1.0-alpha.1, the manifest has 1.0',
  'plugins/loop/.claude-plugin/plugin.json: version 1.0 is not semver',
]);
negative('R14: .claude-plugin/marketplace.json entry <name>: version <v> is not semver', (dir) => {
  editJson(dir, catalog, (c) => { entry(c, 'loop').version = '1.0'; });
}, 2, [
  '.claude-plugin/marketplace.json: entry loop has version 1.0, the manifest has 0.1.0-alpha.1',
  '.claude-plugin/marketplace.json entry loop: version 1.0 is not semver',
]);

negative('R219: <manifest>: repository is <value>; the other manifests name <r>', (dir) => {
  editJson(dir, manifest('loop'), (m) => { m.repository = 'https://example.invalid/x'; });
  bump(dir, 'loop');
}, 1, [`plugins/loop/.claude-plugin/plugin.json: repository is https://example.invalid/x; the other manifests name ${repoUrl}`]);
negative('R219: <manifest>: repository is missing; the other manifests name <r>', (dir) => {
  editJson(dir, manifest('loop'), (m) => { delete m.repository; });
  bump(dir, 'loop');
}, 1, [`plugins/loop/.claude-plugin/plugin.json: repository is missing; the other manifests name ${repoUrl}`]);

negative('R9: <manifest>: declares dependencies', (dir) => {
  editJson(dir, manifest('loop'), (m) => { m.dependencies = {}; });
  bump(dir, 'loop');
}, 1, ['plugins/loop/.claude-plugin/plugin.json: declares dependencies']);
negative('R9: .claude-plugin/marketplace.json: declares dependencies', (dir) => editJson(dir, catalog, (c) => { c.dependencies = {}; }), 1, [
  '.claude-plugin/marketplace.json: declares dependencies',
]);
negative('R9: .claude-plugin/marketplace.json entry <name>: declares dependencies', (dir) => editJson(dir, catalog, (c) => { entry(c, 'loop').dependencies = {}; }), 1, [
  '.claude-plugin/marketplace.json entry loop: declares dependencies',
]);
negative('R7: <manifest>: declares userConfig', (dir) => {
  editJson(dir, manifest('loop'), (m) => { m.userConfig = {}; });
  bump(dir, 'loop');
}, 1, ['plugins/loop/.claude-plugin/plugin.json: declares userConfig']);
negative('R7: .claude-plugin/marketplace.json: declares userConfig', (dir) => editJson(dir, catalog, (c) => { c.userConfig = {}; }), 1, [
  '.claude-plugin/marketplace.json: declares userConfig',
]);
negative('R7: .claude-plugin/marketplace.json entry <name>: declares userConfig', (dir) => editJson(dir, catalog, (c) => { entry(c, 'loop').userConfig = {}; }), 1, [
  '.claude-plugin/marketplace.json entry loop: declares userConfig',
]);
negative('R7: <file>:<line>: references ${user_config.*}', (dir) => {
  put(dir, extra, 'a\nSet ${user_config.token} here.\n');
  bump(dir, 'rules');
}, 1, [`${extra}:2: references \${user_config.*}`]);

negative('R219: README.md: no line /plugin install <n>@reimagine-claude', (dir) => {
  const text = read(dir, 'README.md').split('\n').filter((l) => l.trim() !== '/plugin install loop@reimagine-claude').join('\n');
  put(dir, 'README.md', text);
}, 1, ['README.md: no line /plugin install loop@reimagine-claude']);
negative('R219: README.md: no line /plugin uninstall <n>@reimagine-claude', (dir) => {
  const text = read(dir, 'README.md').split('\n').filter((l) => l.trim() !== '/plugin uninstall loop@reimagine-claude').join('\n');
  put(dir, 'README.md', text);
}, 1, ['README.md: no line /plugin uninstall loop@reimagine-claude']);

negative('R39: <file>: frontmatter lacks disable-model-invocation: true', (dir) => {
  edit(dir, 'plugins/rules/skills/rules/SKILL.md', 'disable-model-invocation: true\n', '');
  bump(dir, 'rules');
}, 1, ['plugins/rules/skills/rules/SKILL.md: frontmatter lacks disable-model-invocation: true']);

negative('R45: <file>: frontmatter name is <name>, not run', (dir) => {
  edit(dir, 'plugins/loop/skills/run/SKILL.md', '\nname: run\n', '\nname: go\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/skills/run/SKILL.md: frontmatter name is go, not run']);
negative('R45: <file>: frontmatter name is missing, not run', (dir) => {
  edit(dir, 'plugins/loop/skills/run/SKILL.md', '\nname: run\n', '\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/skills/run/SKILL.md: frontmatter name is missing, not run']);
negative('R45: <file>: description does not name "reimagine loop"', (dir) => {
  edit(dir, 'plugins/loop/skills/run/SKILL.md', '"reimagine loop"', '"reimagine-loop"');
  bump(dir, 'loop');
}, 1, ['plugins/loop/skills/run/SKILL.md: description does not name "reimagine loop"']);
negative('R45: <file>: description does not name "run the loop"', (dir) => {
  edit(dir, 'plugins/loop/skills/run/SKILL.md', '"run the loop"', '"run-the-loop"');
  bump(dir, 'loop');
}, 1, ['plugins/loop/skills/run/SKILL.md: description does not name "run the loop"']);
negative('R45: plugins/loop/commands: the loop has no commands; its skill is the entry point', (dir) => {
  put(dir, 'plugins/loop/commands/run.md', '# run\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/commands: the loop has no commands; its skill is the entry point']);
negative('R59: <file>: allowed-tools entry <entry> is not a pre-approved read', (dir) => {
  edit(dir, 'plugins/loop/skills/run/SKILL.md', '  - Bash(date)\n', '  - Bash(date)\n  - Bash(git push *)\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/skills/run/SKILL.md: allowed-tools entry Bash(git push *) is not a pre-approved read']);

negative('R142: <file>: description does not name "reimagine audit"', (dir) => {
  edit(dir, 'plugins/audit/skills/audit/SKILL.md', '"reimagine audit"', '"reimagine-audit"');
  settle(dir, 'audit');
}, 1, ['plugins/audit/skills/audit/SKILL.md: description does not name "reimagine audit"']);
for (const name of ['run', 'resume', 'act', 'handoff']) {
  negative(`R142: <file>: missing (commands/${name}.md)`, (dir) => {
    rmSync(join(dir, `plugins/audit/commands/${name}.md`));
    settle(dir, 'audit');
  }, 1, [`plugins/audit/commands/${name}.md: missing`]);
}

negative('R43: <file>: name is not Concise Plain', (dir) => {
  edit(dir, 'plugins/rules/output-styles/concise-plain.md', '\nname: Concise Plain\n', '\nname: Plain\n');
  bump(dir, 'rules');
}, 1, ['plugins/rules/output-styles/concise-plain.md: name is not Concise Plain']);
negative('R43: <file>: description does not end in v4.5.', (dir) => {
  edit(dir, 'plugins/rules/output-styles/concise-plain.md', 'procedures. v4.5.', 'procedures.');
  bump(dir, 'rules');
}, 1, ['plugins/rules/output-styles/concise-plain.md: description does not end in v4.5.']);
negative('R43: <file>: keep-coding-instructions is not true', (dir) => {
  edit(dir, 'plugins/rules/output-styles/concise-plain.md', 'keep-coding-instructions: true', 'keep-coding-instructions: false');
  bump(dir, 'rules');
}, 1, ['plugins/rules/output-styles/concise-plain.md: keep-coding-instructions is not true']);

negative('R8: plugins/rules/hooks/hooks.json: not the SessionStart startup shape', (dir) => {
  edit(dir, 'plugins/rules/hooks/hooks.json', '"startup"', '"resume"');
  bump(dir, 'rules');
}, 1, ['plugins/rules/hooks/hooks.json: not the SessionStart startup shape']);
negative('R8: plugins/rules/hooks/hooks.json: not the SessionStart startup shape (missing)', (dir) => {
  rmSync(join(dir, 'plugins/rules/hooks/hooks.json'));
  bump(dir, 'rules');
}, 1, ['plugins/rules/hooks/hooks.json: not the SessionStart startup shape']);
negative('R207: plugins/repo-docs/hooks/hooks.json: not the PreToolUse Bash|PowerShell shape', (dir) => {
  edit(dir, 'plugins/repo-docs/hooks/hooks.json', '"Bash|PowerShell"', '"Bash"');
  bump(dir, 'repo-docs');
}, 1, ['plugins/repo-docs/hooks/hooks.json: not the PreToolUse Bash|PowerShell shape']);
negative('R8: <file>: hooks outside plugins/rules/hooks/hooks.json and plugins/repo-docs/hooks/hooks.json (hooks.json)', (dir) => {
  put(dir, 'plugins/loop/hooks/hooks.json', '{}\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/hooks/hooks.json: hooks outside plugins/rules/hooks/hooks.json and plugins/repo-docs/hooks/hooks.json']);
negative('R8: <file>: hooks outside plugins/rules/hooks/hooks.json and plugins/repo-docs/hooks/hooks.json (manifest)', (dir) => {
  editJson(dir, manifest('loop'), (m) => { m.hooks = {}; });
  bump(dir, 'loop');
}, 1, ['plugins/loop/.claude-plugin/plugin.json: hooks outside plugins/rules/hooks/hooks.json and plugins/repo-docs/hooks/hooks.json']);

negative('R3: <file>:<line>: not ASCII', (dir) => {
  put(dir, extra, 'ok\ncaf\u00e9\nna\u00efve\n');
  bump(dir, 'rules');
}, 1, [`${extra}:2: not ASCII`]);

negative('R4: <file>: not the Apache License 2.0 text with Copyright 2026 vibecodedapps.net (root)', (dir) => {
  for (const path of ['LICENSE', 'plugins/rules/LICENSE', 'plugins/loop/LICENSE', 'plugins/audit/LICENSE', 'plugins/repo-docs/LICENSE']) {
    edit(dir, path, 'Copyright 2026 vibecodedapps.net', 'Copyright 2026 someone');
  }
  for (const name of ['rules', 'loop', 'audit', 'repo-docs']) settle(dir, name);
}, 1, ['LICENSE: not the Apache License 2.0 text with Copyright 2026 vibecodedapps.net']);
negative('R4: <file>: not the Apache License 2.0 text with Copyright 2026 vibecodedapps.net (plugin differs)', (dir) => {
  append(dir, 'plugins/loop/LICENSE', 'x\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/LICENSE: not the Apache License 2.0 text with Copyright 2026 vibecodedapps.net']);
negative('R4: <file>: not the Apache License 2.0 text with Copyright 2026 vibecodedapps.net (plugin missing)', (dir) => {
  rmSync(join(dir, 'plugins/loop/LICENSE'));
  bump(dir, 'loop');
}, 1, ['plugins/loop/LICENSE: not the Apache License 2.0 text with Copyright 2026 vibecodedapps.net']);

negative('R2: plugins/<dir>/README.md: missing', (dir) => {
  rmSync(join(dir, 'plugins/loop/README.md'));
  bump(dir, 'loop');
}, 1, ['plugins/loop/README.md: missing']);

negative('R2: <file>: not something a plugin installs (first segment)', (dir) => {
  put(dir, 'plugins/loop/notes.txt', 'n\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/notes.txt: not something a plugin installs']);
negative('R2: <file>: not something a plugin installs (fixtures segment)', (dir) => {
  put(dir, 'plugins/rules/rules/fixtures/a.txt', 'a\n');
  bump(dir, 'rules');
}, 1, ['plugins/rules/rules/fixtures/a.txt: not something a plugin installs']);
negative('R2: <file>: not something a plugin installs (.test. in the name)', (dir) => {
  put(dir, 'plugins/rules/rules/a.test.txt', 'a\n');
  bump(dir, 'rules');
}, 1, ['plugins/rules/rules/a.test.txt: not something a plugin installs']);

negative('R6: <file>: an executable file R6 does not list (extension)', (dir) => {
  put(dir, 'plugins/loop/scripts/extra.sh', 'echo x\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/scripts/extra.sh: an executable file R6 does not list']);
negative('R6: <file>: an executable file R6 does not list (git mode 100755)', (dir) => {
  git(dir, 'update-index', '--chmod=+x', 'plugins/rules/README.md');
  bump(dir, 'rules');
}, 1, ['plugins/rules/README.md: an executable file R6 does not list']);

negative('R219: <file>: names <match>, which plugins/<dir>/<match> does not hold', (dir) => {
  put(dir, 'plugins/rules/skills/rules/extra.md', 'Run scripts/nope.sh now.\n');
  bump(dir, 'rules');
}, 1, ['plugins/rules/skills/rules/extra.md: names scripts/nope.sh, which plugins/rules/scripts/nope.sh does not hold']);
negative('R6: <path>: no test under tests/ names it', (dir) => {
  for (const path of files(dir, 'tests/')) {
    if (basename(path) === 'drift.sh' || read(dir, path).includes('drift.sh')) rmSync(join(dir, path));
  }
}, 1, ['plugins/repo-docs/hooks/drift.sh: no test under tests/ names it']);

negative('R223: .gitattributes: lacks the line <line>', (dir) => {
  put(dir, '.gitattributes', '* text=auto eol=lf\n*.mjs text eol=lf\n*.md text eol=lf\n');
}, 1, ['.gitattributes: lacks the line *.sh text eol=lf']);

const chat = 'plugins/rules/chat/instructions.md';
negative('R44: <file>: holds <n> fenced blocks, not one (none)', (dir) => {
  put(dir, chat, '# Chat\n\nNo block here.\n');
  bump(dir, 'rules');
}, 1, [`${chat}: holds 0 fenced blocks, not one`]);
negative('R44: <file>: holds <n> fenced blocks, not one (two)', (dir) => {
  put(dir, chat, '```\na\n```\n\n```\nb\n```\n');
  bump(dir, 'rules');
}, 1, [`${chat}: holds 2 fenced blocks, not one`]);
negative('R44: <file>: the fenced block has <n> characters, over 5000', (dir) => {
  put(dir, chat, '# Chat\n\n```\n' + 'x'.repeat(5001) + '\n```\n');
  bump(dir, 'rules');
}, 1, [`${chat}: the fenced block has 5001 characters, over 5000`]);
positive('R44: a fenced block of 5000 characters passes', (dir) => {
  put(dir, chat, '# Chat\n\n```\n' + 'x'.repeat(5000) + '\n```\n');
  bump(dir, 'rules');
});

const loopSkill = 'plugins/loop/skills/run/SKILL.md';
negative('R219: <file>: no ## Supporting files section', (dir) => {
  edit(dir, loopSkill, '\n## Supporting files\n', '\n## Supporting file\n');
  bump(dir, 'loop');
}, 1, [`${loopSkill}: no ## Supporting files section`]);
negative('R219: <file>: ## Supporting files does not name <relative path>', (dir) => {
  put(dir, 'plugins/loop/skills/run/extra.md', '# Extra\n\nReturn to the step that sent you here.\n');
  bump(dir, 'loop');
}, 1, [`${loopSkill}: ## Supporting files does not name extra.md`]);
negative('R219: <file>: ## Supporting files names <span>, which does not exist', (dir) => {
  append(dir, loopSkill, '- `gone.md`: never read.\n');
  bump(dir, 'loop');
}, 1, [`${loopSkill}: ## Supporting files names gone.md, which does not exist`]);
negative('R219: <file>: the last paragraph names no hand-off', (dir) => {
  append(dir, 'plugins/loop/skills/run/risk.md', '\nThe end.\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/skills/run/risk.md: the last paragraph names no hand-off']);

negative('R121: <file>:<line>: gh api span not closed on the line', (dir) => {
  put(dir, extra, 'a\nRun `gh api --hostname h repos/x/y\n');
  bump(dir, 'rules');
}, 1, [`${extra}:2: gh api span not closed on the line`]);
negative('R121: <file>:<line>: gh api span without --hostname', (dir) => {
  put(dir, extra, 'a\nRun `gh api repos/x/y` now.\n');
  bump(dir, 'rules');
}, 1, [`${extra}:2: gh api span without --hostname`]);
negative('R121: <file>:<line>: gh api span without --hostname (second command in the span)', (dir) => {
  put(dir, extra, 'Run `gh api --hostname h a; gh api b` now.\n');
  bump(dir, 'rules');
}, 1, [`${extra}:1: gh api span without --hostname`]);
positive('R121: spans with --hostname, a bare gh api, an allowed-tools pattern and a fenced block pass', (dir) => {
  put(dir, extra, [
    'Run `gh api --hostname h repos/x/y` now.',
    'Run `gh api repos/x/y --hostname=h` now.',
    'Name `gh api` alone.',
    'Allow `Bash(gh api *)` in the list.',
    '```',
    'gh api repos/x/y',
    '```',
    '',
  ].join('\n'));
  bump(dir, 'rules');
});

negative('R162: <file>: frontmatter lacks tools', (dir) => {
  put(dir, 'plugins/loop/agents/x.md', '---\nname: x\n---\nBody.\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/agents/x.md: frontmatter lacks tools']);
negative('R162: <file>: tools entry <entry> is not one of Read, Grep, Glob, Bash, Write (block list)', (dir) => {
  put(dir, 'plugins/loop/agents/x.md', '---\nname: x\ntools:\n  - Read\n  - Edit\n---\nBody.\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/agents/x.md: tools entry Edit is not one of Read, Grep, Glob, Bash, Write']);
negative('R162: <file>: tools entry <entry> is not one of Read, Grep, Glob, Bash, Write (comma-separated)', (dir) => {
  put(dir, 'plugins/loop/agents/x.md', '---\nname: x\ntools: Read, Edit\n---\nBody.\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/agents/x.md: tools entry Edit is not one of Read, Grep, Glob, Bash, Write']);
negative('R162: <file>: tools entry <entry> is not one of Read, Grep, Glob, Bash, Write (flow list)', (dir) => {
  put(dir, 'plugins/loop/agents/x.md', '---\nname: x\ntools: [Read, NotebookEdit]\n---\nBody.\n');
  bump(dir, 'loop');
}, 1, ['plugins/loop/agents/x.md: tools entry NotebookEdit is not one of Read, Grep, Glob, Bash, Write']);

const merger = 'plugins/audit/agents/merger.md';
const converge = 'plugins/audit/skills/audit/stages/7-converge.md';
negative('R219: <file>: no fenced ## C<n> item shape (merger)', (dir) => {
  edit(dir, merger, '## C<n>: <title>\n- absorbs', '## D<n>: <title>\n- absorbs');
  settle(dir, 'audit');
}, 1, [`${merger}: no fenced ## C<n> item shape`]);
negative('R219: <file>: no fenced ## C<n> item shape (stage 7)', (dir) => {
  edit(dir, converge, '## C<n>: <title>\n   - absorbs', '## D<n>: <title>\n   - absorbs');
  settle(dir, 'audit');
}, 1, [`${converge}: no fenced ## C<n> item shape`]);
negative('R219: plugins/audit/agents/merger.md: the ## C<n> item shape differs from plugins/audit/skills/audit/stages/7-converge.md', (dir) => {
  edit(dir, merger, '- tickets: <work-item impact>\n', '- tickets: <work-item impact>\n- extra: <x>\n');
  settle(dir, 'audit');
}, 1, [`${merger}: the ## C<n> item shape differs from ${converge}`]);

negative('R219: <file>:<line>: plugin_version literal <literal> differs from the audit manifest <version>', (dir) => {
  put(dir, 'plugins/audit/skills/audit/extra.md', 'The "plugin_version" is "0.1.0-alpha.9".\n');
  settle(dir, 'audit');
}, 1, ['plugins/audit/skills/audit/extra.md:1: plugin_version literal 0.1.0-alpha.9 differs from the audit manifest 0.1.0-alpha.1']);
negative('R219: plugins/audit: no plugin_version literal', (dir) => {
  for (const path of files(dir, 'plugins/audit/')) {
    if (read(dir, path).includes('plugin_version')) put(dir, path, read(dir, path).replaceAll('plugin_version', 'plugin_ver'));
  }
  settle(dir, 'audit');
}, 1, ['plugins/audit: no plugin_version literal']);

negative('R14: tag rule: not a git work tree', (dir) => rmSync(join(dir, '.git'), { recursive: true, force: true }), 1, ['tag rule: not a git work tree']);
test('R14: tag rule: the clone is shallow; fetch the full history and tags (git fetch --unshallow --tags)', () => {
  const source = clean.replaceAll('\\', '/');
  const dir = join(base, `case-${++seq}`);
  git(base, 'clone', '-q', '--depth', '1', `file://${source.startsWith('/') ? '' : '/'}${source}`, dir);
  fails(lint(dir), 1, ['tag rule: the clone is shallow; fetch the full history and tags (git fetch --unshallow --tags)']);
});
negative('R14: <p>: version <v> is below the tag <t>', (dir) => git(dir, 'tag', 'rules--v0.1.0-alpha.3'), 2, [
  'rules: version 0.1.0-alpha.1 is below the tag rules--v0.1.0-alpha.3',
  'CHANGELOG.md: no heading ## rules 0.1.0-alpha.3 for the tag rules--v0.1.0-alpha.3',
]);
negative('R14: <p>: plugins/<p>/ changed since <t>; set a version above <tv> (tracked file)', (dir) => append(dir, 'plugins/rules/README.md', '\nMore.\n'), 1, [
  'rules: plugins/rules/ changed since rules--v0.1.0-alpha.1; set a version above 0.1.0-alpha.1',
]);
negative('R14: <p>: plugins/<p>/ changed since <t>; set a version above <tv> (new file)', (dir) => put(dir, extra, 'x\n'), 1, [
  'rules: plugins/rules/ changed since rules--v0.1.0-alpha.1; set a version above 0.1.0-alpha.1',
]);
negative('R14: <p>: git diff --quiet <t> -- plugins/<p>/ exited <n>', (dir) => {
  const blob = git(dir, 'rev-parse', 'HEAD:README.md').trim();
  git(dir, 'tag', '-d', 'rules--v0.1.0-alpha.1');
  git(dir, 'tag', 'rules--v0.1.0-alpha.1', blob);
  append(dir, 'plugins/rules/README.md', '\nMore.\n');
}, 1, ['rules: git diff --quiet rules--v0.1.0-alpha.1 -- plugins/rules/ exited 128']);
positive('R14: a changed plugin with a version above its tag passes without a changelog heading', (dir) => {
  append(dir, 'plugins/rules/README.md', '\nMore.\n');
  bump(dir, 'rules');
});

negative('R15: CHANGELOG.md:<line>: heading <heading> is not ## <plugin> <version> - <YYYY-MM-DD>', (dir) => {
  put(dir, 'CHANGELOG.md', changelog([...headings, '## Release notes']));
}, 1, ['CHANGELOG.md:13: heading Release notes is not ## <plugin> <version> - <YYYY-MM-DD>']);
negative('R15: CHANGELOG.md:<line>: <plugin> <version> is dated after the heading above it', (dir) => {
  put(dir, 'CHANGELOG.md', changelog([...headings.slice(0, 4), '## rules 0.1.0-alpha.1 - 2026-10-16']));
}, 1, ['CHANGELOG.md:11: rules 0.1.0-alpha.1 is dated after the heading above it']);
negative('R15: CHANGELOG.md: no heading ## <p> <tv> for the tag <p>--v<tv>', (dir) => {
  put(dir, 'CHANGELOG.md', changelog(headings.slice(0, 4)));
}, 1, ['CHANGELOG.md: no heading ## rules 0.1.0-alpha.1 for the tag rules--v0.1.0-alpha.1']);
negative('R15: CHANGELOG.md:<line>: <p> <hv> has no tag <p>--v<hv>; fetch the tags (git fetch --tags)', (dir) => {
  put(dir, 'CHANGELOG.md', changelog([...headings, '## rules 0.1.0-alpha.0 - 2026-10-01']));
}, 1, ['CHANGELOG.md:13: rules 0.1.0-alpha.0 has no tag rules--v0.1.0-alpha.0; fetch the tags (git fetch --tags)']);
positive('R15: a heading for the current version waits for its tag', (dir) => {
  put(dir, 'CHANGELOG.md', changelog([headings[0], '## rules 0.1.0-alpha.2 - 2026-10-16', ...headings.slice(1)]));
  append(dir, 'plugins/rules/README.md', '\nMore.\n');
  bump(dir, 'rules');
});

negative('R10: <file>:<line>: names an email address', (dir) => {
  put(dir, extra, 'Mail someone@example.com now.\n');
  bump(dir, 'rules');
}, 1, [`${extra}:1: names an email address`]);
negative('R10: <file>:<line>: names a path under a user\'s home', (dir) => {
  put(dir, extra, 'Open C:/Users/alice/x now.\n');
  bump(dir, 'rules');
}, 1, [`${extra}:1: names a path under a user's home`]);
negative('R10: <file>:<line>: names a path under a user\'s home (/home)', (dir) => {
  put(dir, extra, 'Open /home/alice/x now.\n');
  bump(dir, 'rules');
}, 1, [`${extra}:1: names a path under a user's home`]);
negative('R10: <file>:<line>: names a path under a user\'s home (lower case)', (dir) => {
  put(dir, extra, 'Open c:/users/alice/x now.\n');
  bump(dir, 'rules');
}, 1, [`${extra}:1: names a path under a user's home`]);
negative('R10: <file>:<line>: names a repository other than this one', (dir) => {
  put(dir, extra, 'See https://github.com/someone/other for it.\n');
  bump(dir, 'rules');
}, 1, [`${extra}:1: names a repository other than this one`]);
positive('R10: an address at a .invalid domain passes', (dir) => {
  put(dir, extra, 'Mail audit@example.invalid now.\n');
  bump(dir, 'rules');
});
positive('R10: a placeholder home path passes', (dir) => {
  put(dir, extra, 'Open /home/<user>/x now.\n');
  bump(dir, 'rules');
});
positive('R10: a placeholder repository passes', (dir) => {
  put(dir, extra, 'See https://github.com/owner/repo for it.\n');
  bump(dir, 'rules');
});
positive('R10: other placeholders and this repository pass', (dir) => {
  put(dir, extra, [
    'Clone git@github.com:vibecodedapps-official/reimagine-claude.git now.',
    `Or ${repoUrl} here, or ${repoUrl}.`,
    'Open /Users/you/x and C:/Users/<name>/y and /home/$USER/z.',
    'See https://github.com/example-org/y and https://github.com/:owner/repo.',
    '',
  ].join('\n'));
  bump(dir, 'rules');
});

const token = ['zebra', 'quux'].join('-');
const absent = ['none', 'here'].join('-');
const denied = (list) => ({ LINT_DENY_TOKENS: list });

test('R220: <file>:<line>: holds a token from LINT_DENY_TOKENS', () => {
  const dir = caseDir();
  put(dir, 'docs/notes.md', 'one\n' + 'Zebra' + '-QUUX' + ' two\n');
  const r = lint(dir, denied(' ' + token + ' ,,'));
  fails(r, 1, ['docs/notes.md:2: holds a token from LINT_DENY_TOKENS']);
  assert.ok(!r.stdout.toLowerCase().includes('zebra'), shown(r));
});
test('R220: the first line of each file with a token is reported once, whichever token matches', () => {
  const dir = caseDir();
  put(dir, 'docs/a.md', token + '\nnext\n');
  put(dir, 'docs/b.md', 'one\ntwo\n' + token + '\n' + token + '\n');
  fails(lint(dir, denied(absent + ',' + token)), 2, [
    'docs/a.md:1: holds a token from LINT_DENY_TOKENS',
    'docs/b.md:3: holds a token from LINT_DENY_TOKENS',
  ]);
});
test('R220: a token that no file holds passes', () => {
  passes(lint(caseDir(), denied(' ' + token + ' ,,')));
});
test('R220: a list of empty pieces passes', () => {
  const dir = caseDir();
  put(dir, 'docs/notes.md', 'one\n');
  passes(lint(dir, denied(' , ,,')));
});
