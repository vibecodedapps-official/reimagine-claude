// Builds the primer messy fixture (tests/primer/fixture/messy/build.sh) in a throwaway directory and checks its
// shape: history, tracked files, the hub and its index, the long architecture spoke, and the quiet drift hooks.
// Needs sh and git.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const real = (p) => (process.platform === 'win32' ? realpathSync(p).toLowerCase() : realpathSync(p));
const newlines = (text) => (text.match(/\n/g) ?? []).length;

describe('primer messy fixture', () => {
  test('builds the messy repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'primer-fixture-'));
    try {
      const build = spawnSync('sh', ['tests/primer/fixture/messy/build.sh'], {
        cwd: root,
        env: { ...process.env, TMPDIR: dir.replaceAll('\\', '/') },
        encoding: 'utf8',
      });
      assert.equal(build.status, 0, build.stderr);
      const lines = build.stdout.split('\n');
      assert.equal(lines.length, 2, `stdout holds one line: ${JSON.stringify(build.stdout)}`);
      assert.equal(lines[1], '');
      const repo = lines[0];
      assert.ok(existsSync(repo), `${repo} exists`);
      assert.ok(real(repo).startsWith(real(dir) + sep), `${repo} lies inside ${dir}`);

      const emptyConfig = join(dir, 'empty-gitconfig');
      writeFileSync(emptyConfig, '');
      const git = (...args) =>
        spawnSync('git', ['-C', repo, ...args], {
          env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: emptyConfig },
          encoding: 'utf8',
        });
      const out = (...args) => {
        const r = git(...args);
        assert.equal(r.status, 0, `git ${args.join(' ')}\n${r.stderr}`);
        return r.stdout;
      };

      assert.equal(
        out('log', '--format=%H %s'),
        '17bd2d849415a083e4db48940118c4d02cfcddee feat(worker): add the queue worker\n699701ae36daed9388958f628e0f119c34dcf597 chore: start the project\n',
      );
      assert.equal(out('status', '--porcelain'), '');
      assert.equal(
        out('ls-files'),
        [
          '.claude/CLAUDE.md',
          '.gitignore',
          'CLAUDE.md',
          'CONTRIBUTING.md',
          'README.md',
          'docs/api-notes.md',
          'docs/api-rules.md',
          'docs/architecture.md',
          'docs/decisions.md',
          'docs/release-checklist.md',
          'docs/style.md',
          'docs/web.md',
          'package.json',
          'scripts/build.mjs',
          'scripts/lint.mjs',
          'scripts/release.sh',
          'src/api/handlers.js',
          'src/api/validate.js',
          'src/web/app.js',
          'test/handlers.test.js',
          'worker/AGENTS.md',
          'worker/queue.js',
        ].join('\n') + '\n',
      );
      assert.ok(out('ls-files', '-s', 'scripts/release.sh').startsWith('100755 '));

      const hub = readFileSync(join(repo, 'CLAUDE.md'), 'utf8');
      assert.equal(newlines(hub), 28);
      const hubLines = hub.split('\n');
      assert.equal(hubLines[0], '# messy');
      assert.equal(hubLines.filter((l) => l === '## Spokes').length, 1);
      assert.ok(hubLines.includes('@notes/local.md'));

      assert.ok(existsSync(join(repo, 'notes', 'local.md')));
      assert.equal(git('check-ignore', '-q', 'notes/local.md').status, 0);
      assert.notEqual(git('ls-files', '--error-unmatch', 'notes/local.md').status, 0);
      assert.ok(out('ls-files').split('\n').includes('.claude/CLAUDE.md'));

      assert.equal(newlines(readFileSync(join(repo, 'docs', 'architecture.md'), 'utf8')), 230);
      const indexed = hubLines.slice(hubLines.indexOf('## Spokes') + 1).flatMap((l) => {
        const m = /^- (\S+): /.exec(l);
        return m ? [m[1]] : [];
      });
      assert.deepEqual(indexed, [
        'docs/api-rules.md',
        'docs/release-checklist.md',
        'docs/web.md',
        'docs/style.md',
        'docs/decisions.md',
      ]);
      for (const file of indexed) {
        assert.ok(newlines(readFileSync(join(repo, file), 'utf8')) <= 200, `${file} has at most 200 lines`);
      }

      const contributing = readFileSync(join(repo, 'CONTRIBUTING.md'), 'utf8').split('\n');
      const heading = contributing.indexOf('## Adding an endpoint');
      assert.notEqual(heading, -1);
      const steps = contributing.slice(heading + 1).filter((l) => /^\d+\. /.test(l));
      assert.equal(steps.length, 5);
      steps.forEach((step, i) => assert.ok(step.startsWith(`${i + 1}. `), step));

      const readme = readFileSync(join(repo, 'README.md'), 'utf8').split('\n');
      assert.ok(readme.includes('## Notes for AI agents'));

      const event = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' }, cwd: repo });
      for (const hookPath of ['plugins/repo-docs/hooks/drift.sh', 'plugins/primer/hooks/drift.sh']) {
        const hook = spawnSync('sh', [hookPath], { cwd: root, input: event, encoding: 'utf8' });
        assert.equal(hook.status, 0, `${hookPath}: ${hook.stderr}`);
        assert.equal(hook.stdout, '', hookPath);
      }

      const tests = spawnSync('node', ['--test'], { cwd: repo, encoding: 'utf8' });
      assert.equal(tests.status, 0, tests.stdout + tests.stderr);

      // A nested CLAUDE.md that adopt writes under src/web/ is not copied into the served files.
      writeFileSync(join(repo, 'src', 'web', 'CLAUDE.md'), '# src/web\n');
      const buildRun = spawnSync('node', ['scripts/build.mjs'], { cwd: repo, encoding: 'utf8' });
      assert.equal(buildRun.status, 0, buildRun.stderr);
      assert.deepEqual(readdirSync(join(repo, 'src', 'web', 'dist')), ['app.js']);
      assert.equal(
        readFileSync(join(repo, 'src', 'web', 'dist', 'app.js'), 'utf8'),
        readFileSync(join(repo, 'src', 'web', 'app.js'), 'utf8'),
      );

      const release = spawnSync('sh', ['scripts/release.sh'], { cwd: repo, encoding: 'utf8' });
      assert.equal(release.status, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
