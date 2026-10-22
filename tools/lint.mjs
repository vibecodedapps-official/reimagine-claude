#!/usr/bin/env node
// Repository lint: checks the repository this file sits in and depends on nothing but node: built-ins.
//   syntax and import rules for every .mjs, script budgets
//   catalog and manifest consistency, README install lines, skill, style, hook and agent shapes
//   ASCII, licenses, what a plugin may ship, executables and their tests, .gitattributes
//   the chat block, the loop skill's supporting files, gh api spans, the audit plugin_version literals
//   the tag rule, CHANGELOG headings, owner-specific strings
// Usage: node tools/lint.mjs
//   LINT_DENY_TOKENS=a,b node tools/lint.mjs   also fails on any file holding one of the tokens (case-insensitive)
// Prints "lint: ok (<files> files, <plugins> plugins)" and exits 0, or "lint: N failure(s)", one "- <message>" per failure, and exits 1.
import { execFile, spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));

const CATALOG = '.claude-plugin/marketplace.json';
const NAMES = ['rules', 'loop', 'audit', 'primer'];
const RETIRED = ['repo-docs'];
const LOOP_SKILL = 'plugins/loop/skills/run/SKILL.md';
const LOOP_DIR = 'plugins/loop/skills/run/';
const RULES_SKILL = 'plugins/rules/skills/rules/SKILL.md';
const AUDIT_SKILL = 'plugins/audit/skills/audit/SKILL.md';
const PRIMER_SKILL = 'plugins/primer/skills/primer/SKILL.md';
const STYLE = 'plugins/rules/output-styles/concise-plain.md';
const CHAT = 'plugins/rules/chat/instructions.md';
const RULES_HOOKS = 'plugins/rules/hooks/hooks.json';
const PRIMER_HOOKS = 'plugins/primer/hooks/hooks.json';
const MERGER = 'plugins/audit/agents/merger.md';
const CONVERGE = 'plugins/audit/skills/audit/stages/7-converge.md';
const AUDIT_MANIFEST = 'plugins/audit/.claude-plugin/plugin.json';
const EXECUTABLES = [
  'plugins/rules/scripts/rules.mjs',
  ...['readonly', 'handoff', 'ledger', 'working-tree', 'revert-tests', 'live', 'memory', 'work-items', 'collisions']
    .map((n) => `plugins/audit/scripts/${n}.sh`),
  'plugins/primer/hooks/drift.sh',
  'plugins/primer/hooks/notice.sh',
];
const EXECUTABLE_EXTENSIONS = ['.sh', '.mjs', '.js', '.cjs', '.py', '.ps1', '.bat', '.cmd', '.exe'];
const PLUGIN_TOP = ['.claude-plugin', 'skills', 'commands', 'agents', 'hooks', 'scripts', 'output-styles', 'rules', 'chat', 'README.md', 'LICENSE'];
const GITATTRIBUTES = ['* text=auto eol=lf', '*.sh text eol=lf', '*.mjs text eol=lf', '*.md text eol=lf'];
const GIT_READS = ['status', 'diff', 'log', 'show', 'rev-parse', 'merge-base', 'branch --list', 'ls-remote', 'check-ignore',
  'check-ref-format', 'remote -v', 'ls-files', 'cat-file', 'hash-object', 'worktree list', 'config --get', 'for-each-ref', 'ls-tree', 'grep'];
const GH_READS = ['repo view', 'issue view', 'issue list', 'pr view', 'pr list', 'pr checks', 'run list', 'run view'];
const PRE_APPROVED = new RegExp(`^Bash\\((date|date \\*|sleep \\*|git (${GIT_READS.join('|')})( \\*)?|gh (${GH_READS.join('|')})( \\*)?)\\)$`);

const SEMVER_CORE = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?';
const SEMVER = new RegExp(`^${SEMVER_CORE}$`);
const HEADING = new RegExp(`^## (${[...NAMES, ...RETIRED].join('|')}) (${SEMVER_CORE}) - (\\d{4}-\\d{2}-\\d{2})$`);
const FENCE = /^\s*```/;

const ROOT_HOOKS = {
  hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/scripts/rules.mjs', 'session-start', '${CLAUDE_PLUGIN_DATA}'] }] }] },
};
const PRIMER_HOOK = {
  hooks: {
    PreToolUse: [{ matcher: 'Bash|PowerShell', hooks: [{ type: 'command', command: 'sh "${CLAUDE_PLUGIN_ROOT}/hooks/drift.sh"' }] }],
    SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'sh "${CLAUDE_PLUGIN_ROOT}/hooks/notice.sh"' }] }],
  },
};

// ---- helpers

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const shown = (v) => (v === undefined || v === null ? 'missing' : typeof v === 'string' ? v : JSON.stringify(v));
const isSemver = (v) => typeof v === 'string' && SEMVER.test(v);

function parseSemver(v) {
  const dash = v.indexOf('-');
  const core = (dash < 0 ? v : v.slice(0, dash)).split('.').map(Number);
  return { core, pre: dash < 0 ? null : v.slice(dash + 1).split('.') };
}

function compareIdentifiers(a, b) {
  const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
  if (an && bn) return Number(a) - Number(b);
  if (an !== bn) return an ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareSemver(a, b) {
  const x = parseSemver(a), y = parseSemver(b);
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] < y.core[i] ? -1 : 1;
  if (!x.pre || !y.pre) return x.pre === y.pre ? 0 : x.pre ? -1 : 1;
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i++) {
    const c = compareIdentifiers(x.pre[i], y.pre[i]);
    if (c) return c;
  }
  return Math.sign(x.pre.length - y.pre.length);
}

function same(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]));
  }
  return a === b;
}

const unquote = (s) => (/^(['"]).*\1$/.test(s) && s.length >= 2 ? s.slice(1, -1) : s);

// Scalars map to strings, block lists to arrays of strings.
function frontmatter(text) {
  const fm = new Map();
  const lines = (text ?? '').split('\n');
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  for (let i = 1; i < end; i++) {
    const m = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(lines[i]);
    if (!m) continue;
    if (m[2].trim() !== '') { fm.set(m[1], unquote(m[2].trim())); continue; }
    const items = [];
    while (i + 1 < end && /^\s*-\s+/.test(lines[i + 1])) items.push(unquote(lines[++i].replace(/^\s*-\s+/, '').trim()));
    fm.set(m[1], items.length ? items : '');
  }
  return fm;
}

// A list value as entries: a block list, a [a, b] flow list or a comma-separated scalar (commas inside parentheses stay).
function listEntries(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value === '') return [];
  const body = /^\[.*\]$/.test(value) ? value.slice(1, -1) : value;
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') depth = Math.max(0, depth - 1);
    else if (body[i] === ',' && depth === 0) { parts.push(body.slice(start, i)); start = i + 1; }
  }
  parts.push(body.slice(start));
  return parts.map((p) => unquote(p.trim())).filter(Boolean);
}

function outsideFences(text) {
  const out = [];
  let inside = false;
  text.split('\n').forEach((line, i) => {
    if (FENCE.test(line)) inside = !inside;
    else if (!inside) out.push({ n: i + 1, line });
  });
  return out;
}

function fencedBlocks(text) {
  const blocks = [];
  let open = null;
  for (const line of text.split('\n')) {
    if (!FENCE.test(line)) { if (open) open.push(line); continue; }
    if (open) { blocks.push(open); open = null; } else open = [];
  }
  return blocks;
}

// ---- inputs

function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  return r.error ? { status: -1, stdout: '' } : { status: r.status, stdout: r.stdout };
}

const isRegular = (rel) => lstatSync(join(root, rel), { throwIfNoEntry: false })?.isFile() === true;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

function loadContext() {
  const inside = git(['rev-parse', '--is-inside-work-tree']);
  const isWork = inside.status === 0 && inside.stdout.trim() === 'true';
  const listed = isWork
    ? git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).stdout.split('\0').filter(Boolean)
    : walk('');
  const files = [...new Set(listed)].filter(isRegular).sort();
  const fileSet = new Set(files);
  const shallow = isWork && git(['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true';
  const cache = new Map();
  const bytes = (rel) => {
    if (!fileSet.has(rel)) return null;
    if (!cache.has(rel)) cache.set(rel, readFileSync(join(root, rel)));
    return cache.get(rel);
  };
  // A UTF-16 file is read by its byte order mark, so the rules see its text and not its bytes.
  const decode = (buf) => {
    const utf16 = buf[0] === 0xff && buf[1] === 0xfe ? 'le' : buf[0] === 0xfe && buf[1] === 0xff ? 'be' : null;
    if (!utf16) return buf.toString('utf8');
    const body = Buffer.from(buf.subarray(2, 2 + ((buf.length - 2) & ~1)));
    return (utf16 === 'be' ? body.swap16() : body).toString('utf16le');
  };
  const text = (rel) => { const buf = bytes(rel); return buf === null ? null : decode(buf).replace(/\r/g, ''); };
  const json = (rel) => {
    try {
      const value = JSON.parse(text(rel));
      return isObject(value) ? value : null;
    } catch {
      return null;
    }
  };
  const plugins = files
    .map((f) => /^plugins\/([^/]+)\/\.claude-plugin\/plugin\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => ({ dir: m[1], path: m[0], manifest: json(m[0]) }))
    .sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
  const tagCache = new Map();
  const tagsOf = (p) => {
    if (!tagCache.has(p)) {
      const prefix = `${p}--v`;
      const all = git(['tag', '--list', `${prefix}*`]).stdout.split('\n').map((t) => t.trim()).filter(Boolean);
      const semver = all
        .map((tag) => ({ tag, version: tag.slice(prefix.length) }))
        .filter((t) => isSemver(t.version))
        .sort((a, b) => compareSemver(a.version, b.version));
      tagCache.set(p, { all: new Set(all), semver });
    }
    return tagCache.get(p);
  };
  return {
    files, fileSet, bytes, text, json, plugins, isWork, shallow, tagsOf,
    shipped: files.filter((f) => f.startsWith('plugins/')),
    catalog: json(CATALOG),
  };
}

// ---- rules 1 to 4

async function syntaxFailures(ctx) {
  const results = await Promise.all(ctx.files.filter((f) => f.endsWith('.mjs')).map(async (file) => {
    try {
      await run(process.execPath, ['--check', file], { cwd: root });
      return null;
    } catch (err) {
      // The first stderr line is the file's absolute path; the error line names the defect.
      const lines = String(err.stderr ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      const line = lines.find((l) => /^\w*Error\b/.test(l)) ?? lines[0] ?? `exit code ${err.code}`;
      return `${file}: node --check failed: ${line}`;
    }
  }));
  return results.filter(Boolean);
}

const IMPORT_FORMS = [
  /\bimport\b[^'";()]*?\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
];

function importFailures(ctx) {
  const out = [];
  for (const file of ctx.files.filter((f) => f.endsWith('.mjs') && (f.startsWith('plugins/') || f.startsWith('tools/')))) {
    const text = ctx.text(file);
    const found = IMPORT_FORMS.flatMap((re) => [...text.matchAll(re)].map((m) => ({ at: m.index, spec: m[1] })));
    for (const { spec } of found.sort((a, b) => a.at - b.at)) {
      if (!/^(node:|\.\/|\.\.\/)/.test(spec)) out.push(`${file}: imports ${spec}, not a node: built-in`);
    }
  }
  return out;
}

function budgetFailures(ctx) {
  const out = [];
  const rules = 'plugins/rules/scripts/rules.mjs';
  const source = ctx.text(rules);
  if (source !== null) {
    const lines = source.split('\n').length - 1 + (source !== '' && !source.endsWith('\n') ? 1 : 0);
    if (lines > 700) out.push(`${rules}: ${lines} lines, over the 700-line budget`);
  }
  const skill = ctx.text(LOOP_SKILL);
  if (skill !== null) {
    const words = skill.split(/\s+/).filter(Boolean).length;
    if (words > 5800) out.push(`${LOOP_SKILL}: ${words} words, over the 5800-word cap`);
  }
  return out;
}

// ---- rules 5 to 18

function catalogFailures(ctx) {
  const out = [];
  const { catalog, plugins } = ctx;
  const readable = plugins.filter((p) => p.manifest);
  const entries = Array.isArray(catalog?.plugins) ? catalog.plugins.filter(isObject) : [];
  const meta = isObject(catalog?.metadata) ? catalog.metadata : {};

  if (!catalog) out.push(`${CATALOG}: missing or not JSON`);
  for (const p of plugins) if (!p.manifest) out.push(`${p.path}: missing or not JSON`);

  if (catalog) {
    if (catalog.name !== 'reimagine-claude') out.push(`${CATALOG}: name is ${shown(catalog.name)}, not reimagine-claude`);
    if (typeof meta.description !== 'string' || meta.description.trim() === '') out.push(`${CATALOG}: metadata.description is missing`);
    if (!isSemver(meta.version)) out.push(`${CATALOG}: metadata.version is missing or not semver`);
    for (const e of entries) {
      if (!NAMES.includes(e.name)) out.push(`${CATALOG}: entry ${shown(e.name)} is not one of ${NAMES.join(', ')}`);
    }
    for (const e of entries) {
      const ok = e.source === `./plugins/${e.name}` && ctx.fileSet.has(`plugins/${e.name}/.claude-plugin/plugin.json`);
      if (!ok) out.push(`${CATALOG}: entry ${shown(e.name)} source ${shown(e.source)} is not a plugin directory ./plugins/${shown(e.name)}`);
    }
    for (const e of entries) {
      const manifest = readable.find((p) => p.dir === e.name)?.manifest;
      if (!manifest) continue;
      for (const field of ['name', 'version']) {
        if (e[field] !== manifest[field]) out.push(`${CATALOG}: entry ${shown(e.name)} has ${field} ${shown(e[field])}, the manifest has ${shown(manifest[field])}`);
      }
    }
    for (const p of plugins) {
      if (!entries.some((e) => e.name === p.dir)) out.push(`plugins/${p.dir}: no catalog entry`);
    }
    const release = entries.every((e) => isSemver(e.version) && !e.version.includes('-'));
    const names = entries.map((e) => shown(e.name));
    if (release && [...names].sort().join(', ') !== [...NAMES].sort().join(', ')) {
      out.push(`${CATALOG}: lists ${names.join(', ')}; a release catalog lists ${NAMES.join(', ')}`);
    }
  }

  const versioned = [
    ...entries.map((e) => ({ where: `${CATALOG} entry ${shown(e.name)}`, value: e.version })),
    ...readable.map((p) => ({ where: p.path, value: p.manifest.version })),
  ];
  for (const v of versioned) if (!isSemver(v.value)) out.push(`${v.where}: version ${shown(v.value)} is not semver`);

  const repositories = new Map();
  for (const p of readable) {
    const r = p.manifest.repository;
    if (r !== undefined) repositories.set(shown(r), (repositories.get(shown(r)) ?? 0) + 1);
  }
  let common = null, best = 0;
  for (const [value, count] of repositories) if (count > best) { common = value; best = count; }
  if (common !== null) {
    for (const p of readable) {
      if (shown(p.manifest.repository) !== common) out.push(`${p.path}: repository is ${shown(p.manifest.repository)}; the other manifests name ${common}`);
    }
  }

  const holders = [
    ...(catalog ? [{ where: CATALOG, obj: catalog }] : []),
    ...entries.map((e) => ({ where: `${CATALOG} entry ${shown(e.name)}`, obj: e })),
    ...readable.map((p) => ({ where: p.path, obj: p.manifest })),
  ];
  for (const key of ['dependencies', 'userConfig']) {
    for (const h of holders) if (Object.hasOwn(h.obj, key)) out.push(`${h.where}: declares ${key}`);
  }

  for (const file of ctx.shipped) {
    ctx.text(file).split('\n').forEach((line, i) => {
      if (line.includes('${user_config.')) out.push(`${file}:${i + 1}: references \${user_config.*}`);
    });
  }
  return out;
}

// ---- rules 19 to 31

function readmeFailures(ctx) {
  const out = [];
  const lines = (ctx.text('README.md') ?? '').split('\n').map((l) => l.trim());
  const names = Array.isArray(ctx.catalog?.plugins) ? ctx.catalog.plugins.filter(isObject).map((e) => shown(e.name)) : [];
  for (const verb of ['install', 'uninstall']) {
    for (const n of names) {
      const line = `/plugin ${verb} ${n}@reimagine-claude`;
      if (!lines.includes(line)) out.push(`README.md: no line ${line}`);
    }
  }
  return out;
}

function skillFailures(ctx) {
  const out = [];
  const rulesSkill = ctx.text(RULES_SKILL);
  if (frontmatter(rulesSkill).get('disable-model-invocation') !== 'true') out.push(`${RULES_SKILL}: frontmatter lacks disable-model-invocation: true`);

  const loop = ctx.text(LOOP_SKILL);
  const loopFm = frontmatter(loop);
  if (loop === null || loopFm.get('name') !== 'run') out.push(`${LOOP_SKILL}: frontmatter name is ${loopFm.get('name') || 'missing'}, not run`);
  if (loop !== null) {
    const description = String(loopFm.get('description') ?? '');
    for (const phrase of ['reimagine loop', 'run the loop']) {
      if (!description.includes(phrase)) out.push(`${LOOP_SKILL}: description does not name "${phrase}"`);
    }
  }
  if (ctx.files.some((f) => f.startsWith('plugins/loop/commands/'))) out.push('plugins/loop/commands: the loop has no commands; its skill is the entry point');
  for (const entry of listEntries(loopFm.get('allowed-tools'))) {
    if (!PRE_APPROVED.test(entry)) out.push(`${LOOP_SKILL}: allowed-tools entry ${entry} is not a pre-approved read`);
  }

  if (!String(frontmatter(ctx.text(AUDIT_SKILL)).get('description') ?? '').includes('reimagine audit')) {
    out.push(`${AUDIT_SKILL}: description does not name "reimagine audit"`);
  }
  for (const c of ['run', 'resume', 'act', 'handoff']) {
    const file = `plugins/audit/commands/${c}.md`;
    if (!ctx.fileSet.has(file)) out.push(`${file}: missing`);
  }

  const primer = String(frontmatter(ctx.text(PRIMER_SKILL)).get('description') ?? '');
  for (const phrase of ['turn this into a skill', 'we keep doing this', 'add this to the project instructions', 'check the instruction files']) {
    if (!primer.includes(phrase)) out.push(`${PRIMER_SKILL}: description does not name "${phrase}"`);
  }

  const style = ctx.text(STYLE);
  const styleFm = frontmatter(style);
  if (style === null || styleFm.get('name') !== 'Concise Plain') out.push(`${STYLE}: name is not Concise Plain`);
  if (style !== null) {
    if (!String(styleFm.get('description') ?? '').trim().endsWith('v4.5.')) out.push(`${STYLE}: description does not end in v4.5.`);
    if (styleFm.get('keep-coding-instructions') !== 'true') out.push(`${STYLE}: keep-coding-instructions is not true`);
  }
  return out;
}

function hookFailures(ctx) {
  const out = [];
  if (!same(ctx.json(RULES_HOOKS), ROOT_HOOKS)) out.push(`${RULES_HOOKS}: not the SessionStart startup shape`);
  if (!same(ctx.json(PRIMER_HOOKS), PRIMER_HOOK)) out.push(`${PRIMER_HOOKS}: not the PreToolUse Bash|PowerShell and SessionStart startup shape`);
  const manifests = new Map(ctx.plugins.map((p) => [p.path, p.manifest]));
  const message = (file) => `${file}: hooks outside ${RULES_HOOKS} and ${PRIMER_HOOKS}`;
  for (const file of ctx.shipped) {
    if (posix.basename(file) === 'hooks.json' && ![RULES_HOOKS, PRIMER_HOOKS].includes(file)) out.push(message(file));
    else if (manifests.get(file) && Object.hasOwn(manifests.get(file), 'hooks')) out.push(message(file));
  }
  return out;
}

// ---- rules 32 to 39

function fileFailures(ctx) {
  const out = [];
  for (const file of ctx.shipped) {
    const buf = ctx.bytes(file);
    const at = buf.findIndex((b) => b > 0x7f);
    if (at < 0) continue;
    const line = buf.subarray(0, at).filter((b) => b === 0x0a).length + 1;
    out.push(`${file}:${line}: not ASCII`);
  }

  const notLicense = (file) => `${file}: not the Apache License 2.0 text with Copyright 2026 vibecodedapps.net`;
  const license = ctx.text('LICENSE');
  if (license === null || !license.includes('Apache License') || !license.includes('Version 2.0, January 2004')
    || !license.split('\n').includes('Copyright 2026 vibecodedapps.net')) out.push(notLicense('LICENSE'));
  for (const p of ctx.plugins) {
    const file = `plugins/${p.dir}/LICENSE`;
    const mine = ctx.text(file);
    if (mine === null || (license !== null && mine !== license)) out.push(notLicense(file));
  }
  for (const p of ctx.plugins) {
    if (!ctx.fileSet.has(`plugins/${p.dir}/README.md`)) out.push(`plugins/${p.dir}/README.md: missing`);
  }

  const forbidden = ['test', 'tests', 'fixture', 'fixtures', 'docs'];
  for (const file of ctx.shipped) {
    const rest = file.split('/').slice(2);
    if (!PLUGIN_TOP.includes(rest[0]) || rest.some((s) => forbidden.includes(s)) || posix.basename(file).includes('.test.')) {
      out.push(`${file}: not something a plugin installs`);
    }
  }

  const modes = new Map();
  if (ctx.isWork) {
    for (const rec of git(['ls-files', '-s', '-z']).stdout.split('\0').filter(Boolean)) {
      const tab = rec.indexOf('\t');
      modes.set(rec.slice(tab + 1), rec.slice(0, rec.indexOf(' ')));
    }
  }
  for (const file of ctx.shipped) {
    const script = EXECUTABLE_EXTENSIONS.includes(posix.extname(file).toLowerCase()) || modes.get(file) === '100755';
    if (script && !EXECUTABLES.includes(file)) out.push(`${file}: an executable file R6 does not list`);
  }

  const named = [];
  const named37 = [];
  for (const file of ctx.shipped) {
    const m = /^plugins\/([^/]+)\/(skills|commands|agents|hooks)\//.exec(file);
    if (!m) continue;
    for (const hit of ctx.text(file).matchAll(/(?<![\w./-])(scripts|hooks)\/[A-Za-z0-9_.-]+\.(sh|mjs|js)\b/g)) {
      const target = `plugins/${m[1]}/${hit[0]}`;
      if (!ctx.fileSet.has(target)) named37.push(`${file}: names ${hit[0]}, which ${target} does not hold`);
      else named.push(target);
    }
  }
  out.push(...named37);

  const tests = ctx.files.filter((f) => f.startsWith('tests/'));
  const covered = (path) => {
    const base = posix.basename(path);
    return tests.some((t) => posix.basename(t) === base || ctx.text(t).includes(base));
  };
  for (const path of new Set([...EXECUTABLES, ...named])) {
    if (!covered(path)) out.push(`${path}: no test under tests/ names it`);
  }

  const attributes = (ctx.text('.gitattributes') ?? '').split('\n').map((l) => l.trim());
  for (const line of GITATTRIBUTES) if (!attributes.includes(line)) out.push(`.gitattributes: lacks the line ${line}`);
  return out;
}

// ---- rules 40 to 45

function chatFailures(ctx) {
  const out = [];
  const lines = (ctx.text(CHAT) ?? '').split('\n');
  const fences = lines.filter((l) => FENCE.test(l)).length;
  if (fences !== 2) out.push(`${CHAT}: holds ${Math.floor(fences / 2)} fenced blocks, not one`);
  return out;
}

function supportingFailures(ctx) {
  const out = [];
  const skill = ctx.text(LOOP_SKILL);
  if (skill === null) return out;
  const supporting = ctx.files
    .filter((f) => f.startsWith(LOOP_DIR) && f.endsWith('.md') && f !== LOOP_SKILL)
    .map((f) => f.slice(LOOP_DIR.length));
  const lines = skill.split('\n');
  const start = lines.indexOf('## Supporting files');
  if (start < 0) {
    out.push(`${LOOP_SKILL}: no ## Supporting files section`);
    return out;
  }
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end < 0) end = lines.length;
  const spans = [...lines.slice(start + 1, end).join('\n').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  for (const rel of supporting) if (!spans.includes(rel)) out.push(`${LOOP_SKILL}: ## Supporting files does not name ${rel}`);
  for (const span of spans) {
    if (span.endsWith('.md') && !ctx.fileSet.has(LOOP_DIR + span)) out.push(`${LOOP_SKILL}: ## Supporting files names ${span}, which does not exist`);
  }
  for (const rel of supporting) {
    const paragraph = lastParagraph(ctx.text(LOOP_DIR + rel));
    if (!/\b(Return to|Next is|[Gg]oes to|[Gg]o to|reads? `[^`]+\.md`)/.test(paragraph)) {
      out.push(`${LOOP_DIR}${rel}: the last paragraph names no hand-off`);
    }
  }
  return out;
}

function lastParagraph(text) {
  const lines = text.split('\n');
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === '') end--;
  let start = end;
  while (start > 0 && lines[start - 1].trim() !== '') start--;
  return lines.slice(start, end).join(' ');
}

// ---- rules 46 to 52

function ghApiFailures(ctx) {
  const unclosed = [], noHost = [];
  for (const file of ctx.shipped.filter((f) => f.endsWith('.md'))) {
    for (const { n, line } of outsideFences(ctx.text(file))) {
      const ticks = line.split('`').length - 1;
      if (ticks % 2 === 1 && line.slice(line.lastIndexOf('`') + 1).includes('gh api')) unclosed.push(`${file}:${n}: gh api span not closed on the line`);
      for (const m of line.matchAll(/`([^`]*)`/g)) {
        if (lacksHostname(m[1])) noHost.push(`${file}:${n}: gh api span without --hostname`);
      }
    }
  }
  return [...unclosed, ...noHost];
}

function lacksHostname(span) {
  for (const m of span.matchAll(/(?:^|[\s;|&(])gh\s+api(?=[\s;|&)]|$)/g)) {
    const words = span.slice(m.index + m[0].length).split(/[;|&)]/)[0].split(/\s+/).filter(Boolean);
    if (!words.length || words[0].startsWith('*')) continue;
    if (!words.some((w) => w === '--hostname' || w.startsWith('--hostname='))) return true;
  }
  return false;
}

function agentFailures(ctx) {
  const out = [];
  const allowed = ['Read', 'Grep', 'Glob', 'Bash', 'Write'];
  for (const file of ctx.shipped.filter((f) => /^plugins\/[^/]+\/agents\/[^/]+\.md$/.test(f))) {
    const tools = listEntries(frontmatter(ctx.text(file)).get('tools'));
    if (!tools.length) out.push(`${file}: frontmatter lacks tools`);
    for (const t of tools) if (!allowed.includes(t)) out.push(`${file}: tools entry ${t} is not one of ${allowed.join(', ')}`);
  }
  return out;
}

function mergerShape(text) {
  const block = fencedBlocks(text ?? '').find((b) => b.length && b[0].trimStart().startsWith('## C<n>: '));
  return block ? block.map((l) => l.trimStart()) : null;
}

function mergerFailures(ctx) {
  const out = [];
  const shapes = [MERGER, CONVERGE].map((f) => mergerShape(ctx.text(f)));
  [MERGER, CONVERGE].forEach((f, i) => { if (!shapes[i]) out.push(`${f}: no fenced ## C<n> item shape`); });
  if (shapes[0] && shapes[1] && shapes[0].join('\n') !== shapes[1].join('\n')) {
    out.push(`${MERGER}: the ## C<n> item shape differs from ${CONVERGE}`);
  }
  return out;
}

function pluginVersionFailures(ctx) {
  const out = [];
  const version = ctx.json(AUDIT_MANIFEST)?.version;
  let found = 0;
  for (const file of ctx.shipped.filter((f) => f.startsWith('plugins/audit/'))) {
    ctx.text(file).split('\n').forEach((line, i) => {
      if (!line.includes('plugin_version')) return;
      for (const m of line.matchAll(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]*[0-9A-Za-z])?/g)) {
        found++;
        if (typeof version === 'string' && m[0] !== version) out.push(`${file}:${i + 1}: plugin_version literal ${m[0]} differs from the audit manifest ${version}`);
      }
    });
  }
  if (!found) out.push('plugins/audit: no plugin_version literal');
  return out;
}

// ---- rules 53 to 56

function tagFailures(ctx) {
  if (!ctx.isWork) return ['tag rule: not a git work tree'];
  if (ctx.shallow) return ['tag rule: the clone is shallow; fetch the full history and tags (git fetch --unshallow --tags)'];
  const below = [], changed = [];
  for (const p of ctx.plugins) {
    const v = p.manifest?.version;
    const last = isSemver(v) ? ctx.tagsOf(p.dir).semver.at(-1) : null;
    if (!last) continue;
    if (compareSemver(v, last.version) < 0) below.push(`${p.dir}: version ${v} is below the tag ${last.tag}`);
    const dir = `plugins/${p.dir}/`;
    const diff = git(['diff', '--quiet', last.tag, '--', dir]);
    if (diff.status !== 0 && diff.status !== 1) { changed.push(`${p.dir}: git diff --quiet ${last.tag} -- ${dir} exited ${diff.status}`); continue; }
    const differs = diff.status === 1
      || git(['ls-files', '--others', '--exclude-standard', '--', dir]).stdout.trim() !== '';
    if (differs && compareSemver(v, last.version) <= 0) changed.push(`${p.dir}: ${dir} changed since ${last.tag}; set a version above ${last.version}`);
  }
  return [...below, ...changed];
}

// ---- rules 57 to 60

function changelogFailures(ctx) {
  const out = [];
  const lines = (ctx.text('CHANGELOG.md') ?? '').split('\n');
  const headings = [];
  let above = null;
  lines.forEach((line, i) => {
    if (!line.startsWith('## ') || line === '## Unreleased') return;
    const m = HEADING.exec(line);
    if (!m) {
      out.push(`CHANGELOG.md:${i + 1}: heading ${line.slice(3)} is not ## <plugin> <version> - <YYYY-MM-DD>`);
      return;
    }
    const h = { n: i + 1, plugin: m[1], version: m[2], date: m[3] };
    if (above && h.date > above.date) out.push(`CHANGELOG.md:${h.n}: ${h.plugin} ${h.version} is dated after the heading above it`);
    above = h;
    headings.push(h);
  });
  if (!ctx.isWork || ctx.shallow) return out;

  for (const p of ctx.plugins) {
    if (!isSemver(p.manifest?.version)) continue;
    for (const t of ctx.tagsOf(p.dir).semver) {
      if (!headings.some((h) => h.plugin === p.dir && h.version === t.version)) out.push(`CHANGELOG.md: no heading ## ${p.dir} ${t.version} for the tag ${t.tag}`);
    }
  }
  for (const h of headings) {
    const current = ctx.plugins.find((p) => p.dir === h.plugin)?.manifest?.version;
    if (!ctx.tagsOf(h.plugin).all.has(`${h.plugin}--v${h.version}`) && h.version !== current) {
      out.push(`CHANGELOG.md:${h.n}: ${h.plugin} ${h.version} has no tag ${h.plugin}--v${h.version}; fetch the tags (git fetch --tags)`);
    }
  }
  return out;
}

// ---- rules 61 to 64

const HOME_WORDS = ['user', 'username', 'you', 'me', 'dev', 'name', 'example', 'runner'];
const OWNER_WORDS = ['owner', 'org', 'example', 'acme', 'octo-org', 'octocat'];
const bracketed = (s) => /^<.*>$/.test(s) || /^\{.*\}$/.test(s);

const isEmail = (m) => m[1] !== 'git' && !m[2].toLowerCase().endsWith('.invalid');
const isHome = (m) => {
  const u = m[1];
  return !(bracketed(u) || /^\$[A-Za-z_]\w*$/.test(u) || /^\$\{.*\}$/.test(u) || /^%[^%]+%$/.test(u) || u === '~' || u === '*' || HOME_WORDS.includes(u.toLowerCase()));
};
const isForeignRepo = (m) => {
  const owner = m[1].toLowerCase();
  if (bracketed(m[1]) || owner === ':owner' || OWNER_WORDS.includes(owner) || owner.startsWith('example-')) return false;
  // A full stop after a URL ends the sentence, not the name.
  const repo = m[2].replace(/\.+$/, '').replace(/\.git$/i, '').toLowerCase();
  return !(owner === 'vibecodedapps-official' && repo === 'reimagine-claude');
};

const OWNER_RULES = [
  { re: /(?<![\w.+-])([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g, test: isEmail, message: 'names an email address' },
  { re: /(?:[A-Za-z]:)?[\\/](?:Users|home)[\\/]([^\\/\s`'")\]]+)/gi, test: isHome, message: "names a path under a user's home" },
  {
    re: /(?<![\w.-])(?:github\.com|gitlab\.com|bitbucket\.org|dev\.azure\.com)[/:]([^/\s`'")\]]+)\/([^/\s`'")\]#?]+)/g,
    test: isForeignRepo,
    message: 'names a repository other than this one',
  },
];

function ownerFailures(ctx) {
  const out = [];
  for (const rule of OWNER_RULES) {
    for (const file of ctx.shipped) {
      ctx.text(file).split('\n').forEach((line, i) => {
        if ([...line.matchAll(rule.re)].some(rule.test)) out.push(`${file}:${i + 1}: ${rule.message}`);
      });
    }
  }
  return out;
}

function denyFailures(ctx) {
  const tokens = (process.env.LINT_DENY_TOKENS ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return [];
  const out = [];
  for (const file of ctx.files) {
    const lines = ctx.text(file).toLowerCase().split('\n');
    const at = lines.findIndex((l) => tokens.some((t) => l.includes(t)));
    if (at >= 0) out.push(`${file}:${at + 1}: holds a token from LINT_DENY_TOKENS`);
  }
  return out;
}

// ---- main

async function main() {
  const ctx = loadContext();
  const failures = [
    ...await syntaxFailures(ctx),
    ...importFailures(ctx),
    ...budgetFailures(ctx),
    ...catalogFailures(ctx),
    ...readmeFailures(ctx),
    ...skillFailures(ctx),
    ...hookFailures(ctx),
    ...fileFailures(ctx),
    ...chatFailures(ctx),
    ...supportingFailures(ctx),
    ...ghApiFailures(ctx),
    ...agentFailures(ctx),
    ...mergerFailures(ctx),
    ...pluginVersionFailures(ctx),
    ...tagFailures(ctx),
    ...changelogFailures(ctx),
    ...ownerFailures(ctx),
    ...denyFailures(ctx),
  ];
  if (!failures.length) {
    console.log(`lint: ok (${ctx.files.length} files, ${ctx.plugins.length} plugins)`);
    return;
  }
  console.log([`lint: ${failures.length} failure(s)`, ...failures.map((f) => `- ${f}`)].join('\n'));
  process.exitCode = 1;
}

await main();
