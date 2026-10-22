// Runs the audit plugin's POSIX sh suites, so npm test covers them on every CI system. One test per script, so a
// failure names it. The suites need sh, git, awk, and jq on PATH; a missing sh fails here rather than skipping.
// The suites run concurrently, the slowest registered first, each with its own temp data.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sh = (script, args = [], env = {}) =>
  new Promise((resolve, reject) => {
    // A forward-slash path relative to cwd, which Git Bash on Windows reads as given; a joined path would carry backslashes.
    const child = spawn('sh', [`tests/audit/${script}`, ...args], { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d) => (stderr += d));
    child.on('error', (e) => reject(new Error(`cannot start sh for ${script}: ${e.message}`)));
    // close follows the end of both streams, so stdout and stderr are complete here.
    child.on('close', (status) => resolve({ status, stdout, stderr, text: `${script} ${args.join(' ')}\n${stdout}${stderr}` }));
  });
const passes = async (script, args, env) => {
  const r = await sh(script, args, env);
  assert.equal(r.status, 0, r.text);
  return r;
};

const build = async (name, env) => {
  const r = await passes('fixture/build.sh', [name], env);
  const manifest = r.stdout.trim();
  assert.ok(manifest, `build.sh ${name} printed no manifest path`);
  return manifest;
};
const suite = (name) =>
  test(`${name}.sh passes`, async () => {
    const r = await passes(`${name}.sh`);
    assert.match(r.stdout, new RegExp(`^${name} test: ok$`, 'm'));
  });
const fixture = (name) =>
  test(`fixture ${name} builds and verifies`, async () => {
    const r = await passes('fixture/verify.sh', [await build(name), name]);
    assert.match(r.stdout, new RegExp(`^verify ${name}: ok$`, 'm'));
  });
// A global git config that forbids merges (merge.ff = only) must not reach the fixture builds.
const hostile = (name) =>
  test(`fixture ${name} verifies under a hostile global git config`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-gitconfig-'));
    try {
      const config = join(dir, 'hostile.gitconfig');
      writeFileSync(config, '[merge]\n\tff = only\n');
      const env = { GIT_CONFIG_GLOBAL: config };
      const r = await passes('fixture/verify.sh', [await build(name, env), name], env);
      assert.match(r.stdout, new RegExp(`^verify ${name}: ok$`, 'm'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

describe('sh suites', { concurrency: Math.max(1, availableParallelism() - 1) }, () => {
  for (const name of ['readonly', 'revert-tests', 'working-tree', 'live', 'ledger']) suite(name);
  for (const name of ['ground-truth', 'patterns']) hostile(name);
  for (const name of ['ground-truth', 'solo', 'solo-dirty', 'full', 'tokens', 'patterns', 'review']) fixture(name);
  for (const name of ['handoff', 'work-items', 'memory', 'collisions']) suite(name);
  test('lint.sh passes on plugins/audit', async () => {
    assert.match((await passes('lint.sh')).stdout, /^lint: ok$/m);
  });
});
