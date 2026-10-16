#!/usr/bin/env node
// Sets a plugin's version in its manifest and its catalog entry (and, for audit, the plugin_version literals),
// changes nothing else, then runs tools/lint.mjs. It does not tag and does not edit the changelog.
// Usage: node tools/release.mjs <plugin> <version>
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CATALOG = '.claude-plugin/marketplace.json';
const LITERAL = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]*[0-9A-Za-z])?/g;

const SEMVER_CORE = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?';
const SEMVER = new RegExp(`^${SEMVER_CORE}$`);

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

class Refusal extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const crlfCount = (s) => (s.match(/\r\n/g) ?? []).length;

function readText(rel) {
  try {
    return readFileSync(join(root, rel), 'utf8');
  } catch {
    return null;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// ---- JSON spans (the text is valid JSON; these find positions only)

const skipSpace = (text, i) => {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
};

function skipValue(text, i) {
  if (text[i] === '"') {
    let j = i + 1;
    while (text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
    return j + 1;
  }
  if (text[i] === '{' || text[i] === '[') {
    let j = i, depth = 0;
    do {
      if (text[j] === '"') { j = skipValue(text, j); continue; }
      if (text[j] === '{' || text[j] === '[') depth++;
      if (text[j] === '}' || text[j] === ']') depth--;
      j++;
    } while (depth > 0);
    return j;
  }
  let j = i;
  while (j < text.length && !/[\s,\]}]/.test(text[j])) j++;
  return j;
}

// The members of the object whose '{' is at index `at`: key plus the span of the value token.
function members(text, at) {
  const out = [];
  let i = at + 1;
  for (;;) {
    i = skipSpace(text, i);
    if (text[i] === '}') return out;
    if (text[i] === ',') { i++; continue; }
    const keyEnd = skipValue(text, i);
    const key = JSON.parse(text.slice(i, keyEnd));
    i = skipSpace(text, skipSpace(text, keyEnd) + 1);
    const end = skipValue(text, i);
    out.push({ key, start: i, end });
    i = end;
  }
}

// The span of the string value of the one "version" member holding `current`, or null.
function versionSpan(text, at, current) {
  const hits = members(text, at).filter((m) => m.key === 'version' && text[m.start] === '"' && JSON.parse(text.slice(m.start, m.end)) === current);
  return hits.length === 1 ? [hits[0].start, hits[0].end] : null;
}

function entrySpan(text, plugin) {
  const top = members(text, skipSpace(text, 0));
  const list = top.find((m) => m.key === 'plugins' && text[m.start] === '[');
  if (!list) return null;
  let i = list.start + 1;
  for (;;) {
    i = skipSpace(text, i);
    if (text[i] === ']') return null;
    if (text[i] === ',') { i++; continue; }
    const end = skipValue(text, i);
    if (text[i] === '{') {
      const name = members(text, i).find((m) => m.key === 'name' && text[m.start] === '"');
      if (name && JSON.parse(text.slice(name.start, name.end)) === plugin) return i;
    }
    i = end;
  }
}

// ---- edits

function splice(text, edits, replacement) {
  let out = '', pos = 0;
  for (const [start, end] of edits) {
    out += text.slice(pos, start) + replacement;
    pos = end;
  }
  return out + text.slice(pos);
}

function onlySpansDiffer(original, edited, edits, replacement) {
  let from = 0, to = 0;
  for (const [start, end] of edits) {
    const keep = start - from;
    if (edited.slice(to, to + keep) !== original.slice(from, start)) return false;
    to += keep;
    if (edited.slice(to, to + replacement.length) !== replacement) return false;
    to += replacement.length;
    from = end;
  }
  return edited.slice(to) === original.slice(from);
}

function auditFiles(dir) {
  const out = [];
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...auditFiles(rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

function literalsIn(text) {
  const found = [];
  let offset = 0;
  text.split('\n').forEach((line, i) => {
    if (line.includes('plugin_version')) {
      for (const m of line.matchAll(LITERAL)) found.push({ line: i + 1, value: m[0], span: [offset + m.index, offset + m.index + m[0].length] });
    }
    offset += line.length + 1;
  });
  return found;
}

function plan(plugin, version) {
  const manifestPath = `plugins/${plugin}/.claude-plugin/plugin.json`;
  const manifestText = readText(manifestPath);
  const catalogText = readText(CATALOG);
  const catalog = catalogText === null ? undefined : parseJson(catalogText);
  const entry = isObject(catalog) && Array.isArray(catalog.plugins) ? catalog.plugins.findIndex((e) => isObject(e) && e.name === plugin) : -1;
  if (manifestText === null || entry < 0) throw new Refusal(`release: no plugin ${plugin}`);

  const manifest = parseJson(manifestText);
  if (!isObject(manifest)) throw new Refusal(`release: cannot find the version of ${plugin} in ${manifestPath}`);
  const current = manifest.version;
  const listed = catalog.plugins[entry].version;
  if (current !== listed) {
    throw new Refusal(`release: ${plugin} manifest has ${current}, the catalog has ${listed}; fix that first`);
  }
  if (typeof current !== 'string' || !SEMVER.test(current)) throw new Refusal(`release: cannot find the version of ${plugin} in ${manifestPath}`);
  if (compareSemver(version, current) <= 0) throw new Refusal(`release: ${version} is not above ${current}`);

  const files = [];
  if (plugin === 'audit') {
    for (const file of auditFiles('plugins/audit').sort()) {
      const text = readText(file);
      const literals = literalsIn(text);
      const bad = literals.find((l) => l.value !== current);
      if (bad) throw new Refusal(`release: ${file}:${bad.line}: plugin_version literal ${bad.value} differs from ${current}`);
      if (literals.length) files.push({ path: file, text, edits: literals.map((l) => l.span) });
    }
  }

  const manifestSpan = versionSpan(manifestText, skipSpace(manifestText, 0), current);
  const entryAt = entrySpan(catalogText, plugin);
  const catalogSpan = entryAt === null ? null : versionSpan(catalogText, entryAt, current);
  if (!manifestSpan) throw new Refusal(`release: cannot find the version of ${plugin} in ${manifestPath}`);
  if (!catalogSpan) throw new Refusal(`release: cannot find the version of ${plugin} in ${CATALOG}`);

  const expectedManifest = { ...manifest, version };
  const expectedCatalog = { ...catalog, plugins: catalog.plugins.map((e, i) => (i === entry ? { ...e, version } : e)) };
  return {
    current,
    files: [
      { path: manifestPath, text: manifestText, edits: [manifestSpan], expected: expectedManifest },
      { path: CATALOG, text: catalogText, edits: [catalogSpan], expected: expectedCatalog },
      ...files,
    ],
  };
}

function edited(file, version) {
  const replacement = file.expected ? JSON.stringify(version) : version;
  const text = splice(file.text, file.edits, replacement);
  const sound = onlySpansDiffer(file.text, text, file.edits, replacement)
    && crlfCount(text) === crlfCount(file.text)
    && (!file.expected || JSON.stringify(parseJson(text)) === JSON.stringify(file.expected));
  if (!sound) throw new Refusal(`release: refusing a change beyond the version in ${file.path}`);
  return text;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) throw new Refusal('release: usage: node tools/release.mjs <plugin> <version>', 2);
  const [plugin, version] = args;
  if (!SEMVER.test(version)) throw new Refusal(`release: ${version} is not semver`);

  const { current, files } = plan(plugin, version);
  const texts = files.map((f) => edited(f, version));
  files.forEach((f, i) => writeFileSync(join(root, f.path), texts[i]));
  for (const f of files) console.log(`release: ${f.path}: ${current} -> ${version}`);

  const lint = spawnSync(process.execPath, ['tools/lint.mjs'], { cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 1 << 28 });
  process.stdout.write(lint.stdout ?? '');
  process.stderr.write(lint.stderr ?? '');
  process.exitCode = lint.status ?? 1;
}

try {
  main();
} catch (err) {
  if (!(err instanceof Refusal)) throw err;
  console.log(err.message);
  process.exitCode = err.code;
}
