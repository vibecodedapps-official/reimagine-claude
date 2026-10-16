// Builds the repo-docs messy fixture (tests/repo-docs/fixture/messy/build.sh) in a throwaway directory and checks its
// shape: history, tracked files, the two-scope CLAUDE.md, no hub line anywhere, and a quiet drift hook. Needs sh and git.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const real = (p) => (process.platform === 'win32' ? realpathSync(p).toLowerCase() : realpathSync(p));

describe('repo-docs messy fixture', () => {
  test('builds the messy repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'repo-docs-fixture-'));
    try {
      const build = spawnSync('sh', ['tests/repo-docs/fixture/messy/build.sh'], {
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
        'eb8c0c5ccfce0853d0d4d8be47824f5ff619da9b feat(worker): add the queue worker\n89c10f26d2e18903487c46d46df9c6c078d9f048 chore: start the project\n',
      );
      assert.equal(out('status', '--porcelain'), '');
      assert.equal(
        out('ls-files'),
        [
          '.gitignore',
          'CLAUDE.md',
          'README.md',
          'docs/api-notes.md',
          'docs/release-checklist.md',
          'docs/style.md',
          'package.json',
          'scripts/build.mjs',
          'scripts/lint.mjs',
          'src/api/handlers.js',
          'src/api/validate.js',
          'src/web/app.js',
          'worker/AGENTS.md',
          'worker/queue.js',
        ].join('\n') + '\n',
      );

      const claude = readFileSync(join(repo, 'CLAUDE.md'), 'utf8');
      assert.equal((claude.match(/\n/g) ?? []).length, 104);
      const claudeLines = claude.split('\n');
      assert.ok(claudeLines.includes('@docs/style.md'));
      assert.ok(claudeLines.includes('@notes/local.md'));

      // Tracked files plus the ignored notes file: no file holds a hub line.
      const everyFile = out('ls-files', '-c', '-o').split('\n').filter(Boolean);
      assert.ok(everyFile.includes('notes/local.md'));
      for (const file of everyFile) {
        const hubLines = readFileSync(join(repo, file), 'utf8').split(/\r?\n/).filter((l) => l === '## Spokes');
        assert.deepEqual(hubLines, [], `${file} holds no hub line`);
      }

      assert.ok(existsSync(join(repo, 'notes', 'local.md')));
      assert.equal(git('check-ignore', '-q', 'notes/local.md').status, 0);

      const tracked = out('ls-files').split('\n').filter(Boolean);
      const mentions = tracked.filter(
        (file) => file !== 'docs/release-checklist.md' && readFileSync(join(repo, file), 'utf8').includes('release-checklist'),
      );
      assert.deepEqual(mentions, []);

      const hook = spawnSync('sh', ['plugins/repo-docs/hooks/drift.sh'], {
        cwd: root,
        input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' }, cwd: repo }),
        encoding: 'utf8',
      });
      assert.equal(hook.status, 0, hook.stderr);
      assert.equal(hook.stdout, '');

      const buildRun = spawnSync('node', ['scripts/build.mjs'], { cwd: repo, encoding: 'utf8' });
      assert.equal(buildRun.status, 0, buildRun.stderr);
      assert.equal(
        readFileSync(join(repo, 'src', 'web', 'dist', 'app.js'), 'utf8'),
        readFileSync(join(repo, 'src', 'web', 'app.js'), 'utf8'),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
