#!/usr/bin/env node
// House rules: keeps one marked block of rules in the user's CLAUDE.md. Usage: node rules.mjs <verb> <dataDir> [args]
//   status         print the block's state and the options in use
//   plan           show the change and save it; takes --options <list> and --adopt
//   remove         show the removal of the block and save it
//   apply          write the saved change (a backup first), or delete a file this plugin created
//   decline        record the saved change's digest so the session notice stays quiet
//   session-start  print one notice line when the block is stale and not declined; never writes
// Everything above main() is pure: it takes file text, options and rule texts.
// Instruction files are read as latin1, so every byte outside the block (a BOM, a stray non-UTF-8 byte) survives.
import { createHash } from 'node:crypto';
import { chmodSync, constants, lstatSync, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const OPTIONS = ['core', 'windows'];
// Body order: the Windows part first, then the core part.
const ORDER = ['windows', 'core'];
export const PARTS = { windows: 'windows.md', core: 'core.md' };
export const END = '<!-- reimagine:house-rules end -->';
const BEGIN_PREFIX = '<!-- reimagine:house-rules begin';
const BEGIN = /^<!-- reimagine:house-rules begin version=(\S+) options=([a-z,]+) join=(none|blank|newline) digest=([0-9a-f]{16}) -->$/;
const JOINS = { none: 0, blank: 1, newline: 2 };
const BOM = '\u00ef\u00bb\u00bf';
const HOPS = 4, MAX_FILES = 50, MAX_BYTES = 256 * 1024;
const PLAN_FILE = 'rules-plan.json';
const STATE_FILE = 'rules-state.json';
const VERBS = ['status', 'plan', 'remove', 'apply', 'decline'];

class Refusal extends Error {}
const refuse = (message) => { throw new Refusal(message); };

const hash = (body) => createHash('sha256').update(body, 'latin1').digest('hex').slice(0, 16);
// A digest covers the body with CRLF as LF, so a change of line ending does not read as an edit.
export const digest = (body) => hash(body.replace(/\r\n/g, '\n'));
const fileHash = (text) => (text === null ? 'missing' : createHash('sha256').update(text, 'latin1').digest('hex'));
// The file's line ending is that of its first line; a file with no line break takes LF.
export const eolOf = (text) => { const i = text.indexOf('\n'); return i > 0 && text[i - 1] === '\r' ? '\r\n' : '\n'; };
export const defaultOptions = (platform) => (platform === 'win32' ? ['core', 'windows'] : ['core']);

// The option list for --options. core is always in; windows is refused off Windows.
export function parseOptions(value, platform) {
  const list = String(value ?? '').split(',').map((s) => s.trim());
  const bad = list.filter((o) => !OPTIONS.includes(o));
  if (bad.length) refuse(`--options takes a comma-separated list of ${OPTIONS.join(', ')}; got "${value ?? ''}"`);
  if (list.includes('windows') && platform !== 'win32') refuse('the windows option is offered only on Windows');
  return OPTIONS.filter((o) => o === 'core' || list.includes(o));
}

// The rules for the options, parts joined by one empty line, in the given line ending. texts maps a part file name to its
// LF text.
export function render(options, texts, eol = '\n') {
  const body = ORDER.filter((o) => options.includes(o)).map((o) => texts[PARTS[o]]).join('\n');
  return body.replace(/\n/g, eol);
}

const beginLine = (version, options, join, body) =>
  `${BEGIN_PREFIX} version=${version} options=${options.join(',')} join=${join} digest=${digest(body)} -->`;

// Finds the block. Line numbers in a malformed report are 1-based.
export function inspect(text) {
  const begins = [], ends = [];
  let at = text.startsWith(BOM) ? 3 : 0, n = 0;
  while (at < text.length) {
    const nl = text.indexOf('\n', at);
    const next = nl < 0 ? text.length : nl + 1;
    const line = text.slice(at, nl < 0 ? text.length : nl).replace(/\r$/, '');
    n++;
    if (line.startsWith(BEGIN_PREFIX)) begins.push({ n, at, next, line });
    else if (line === END) ends.push({ n, at, next, line });
    at = next;
  }
  if (!begins.length && !ends.length) return { kind: 'absent' };
  const lines = [...begins, ...ends].map((m) => m.n).sort((a, b) => a - b);
  if (begins.length !== 1 || ends.length !== 1) return { kind: 'malformed', lines, reason: `${begins.length} begin and ${ends.length} end markers` };
  const [b] = begins, [e] = ends;
  if (e.n < b.n) return { kind: 'malformed', lines, reason: 'the end marker comes before the begin marker' };
  const m = b.line.match(BEGIN);
  const options = m?.[2].split(',');
  if (!m || options.some((o) => !OPTIONS.includes(o))) return { kind: 'malformed', lines, reason: 'the begin marker cannot be read' };
  return { kind: 'block', start: b.at, bodyStart: b.next, bodyEnd: e.at, end: e.next, version: m[1], options, join: m[3], digest: m[4] };
}

// The text with the block taken out, and the bytes its join added when taking them joins no two lines.
export function removeBlock(text, found) {
  const eol = eolOf(text);
  const joinBytes = eol.repeat(JOINS[found.join]);
  const before = text.slice(0, found.start);
  const kept = before.slice(0, before.length - joinBytes.length);
  const takeJoin = before.endsWith(joinBytes) && (kept === '' || kept.endsWith('\n') || (found.join === 'newline' && found.end === text.length));
  return (takeJoin ? kept : before) + text.slice(found.end);
}

// The first line (1-based) outside the block that holds Markdown adopt does not handle: a comment mark, a fence, a quote, a
// table pipe, or a line starting with `<`. Adopt only edits a file with none; 0 when there is none.
export function gate(text, found) {
  const bad = (t) => t.includes('<!--') || t.includes('-->') || t.includes('|') || /^[ \t]*(`{3,}|~{3,}|>|<)/.test(t);
  let n = 0, at = text.startsWith(BOM) ? 3 : 0;
  while (at < text.length) {
    const nl = text.indexOf('\n', at), end = nl < 0 ? text.length : nl + 1;
    n++;
    if (!(found?.kind === 'block' && at >= found.start && at < found.end) && bad(text.slice(at, end).replace(/\r?\n$/, ''))) return n;
    at = end;
  }
  return 0;
}

// The plan for the target. text is the file's content, or null when it does not exist. Returns the state, the content to
// write (null for no change), the digest of the proposed body, and the options it records. imported holds what scanImports
// found in the files the target imports; adopt moves rules the file already holds into the block.
export function planTarget({
  text, options, recorded, version, texts, platform, declined = [], remove = false, adopt: adopting = false, imported = [],
}) {
  const found = inspect(text ?? '');
  // Where no body is known, the imports are named without counts.
  const brief = imported.length ? { overlap: { imports: imported.map(({ ref, missed, unreadable }) => ({ ref, missed, unreadable })) } } : {};
  if (found.kind === 'malformed') return { state: 'malformed', after: null, note: `${found.reason}, at lines ${found.lines.join(', ')}`, ...brief };
  if (remove) {
    return found.kind === 'absent' ? { state: 'absent', after: null, note: 'there is no block to remove', ...brief }
      : { state: 'remove', after: removeBlock(text, found), options: found.options, recommend: 'apply', ...brief };
  }
  const eol = eolOf(text ?? '');
  // The plan once the body is known: the plain change, or the adopted one when the file already holds rules.
  const propose = (state, opts, body, plain) => {
    const base = found.kind === 'block' ? removeBlock(text, found) : text ?? '';
    const ov = overlap(body, base, imported);
    const stop = gate(text ?? '', found), adopt = adopting && ov.n > 0 && !stop;
    const after = adopt ? adoptRules(base, (join) => `${beginLine(version, opts, join, body)}${eol}${body}${END}${eol}`, body) : plain;
    const { all, ...counts } = ov, shown = { ...counts, n: adopt ? 0 : ov.n, gate: stop };
    if (after === null) return { state, after, options: opts, ...(ov.n || imported.length ? { overlap: shown } : {}) };
    // Decline only when what is already present, once adopt has moved the file's own copies, covers every rule.
    const recommend = ov.n && !stop && !adopting ? 'adopt' : (adopt ? ov.k : all) === ov.total ? 'decline' : 'apply';
    return { state, after, digest: digest(body), options: opts, declined: declined.includes(digest(body)), overlap: shown, recommend };
  };
  if (found.kind === 'absent') {
    const opts = options ?? recorded ?? defaultOptions(platform);
    const body = render(opts, texts, eol);
    const before = text ?? '';
    const join = before === '' ? 'none' : before.endsWith('\n') ? 'blank' : 'newline';
    return propose('absent', opts, body, before + eol.repeat(JOINS[join]) + beginLine(version, opts, join, body) + eol + body + END + eol);
  }
  const inFile = text.slice(found.bodyStart, found.bodyEnd);
  if (digest(inFile) !== found.digest) {
    return { state: 'edited', after: null, options: found.options, edits: [render(found.options, texts, eol), inFile],
      note: 'the block was edited by hand; move your lines below the end marker, then run /rules again', ...brief };
  }
  const opts = options ?? found.options;
  const body = render(opts, texts, eol);
  if (digest(body) === found.digest && opts.join() === found.options.join()) {
    return propose('current', opts, body, null);
  }
  const block = beginLine(version, opts, found.join, body) + eol + body + END + eol;
  // The end marker may lack its line break; the replacement keeps the file's last byte as it was.
  const tail = found.end === text.length && !text.endsWith('\n') ? block.slice(0, -eol.length) : block;
  return propose('stale', opts, body, text.slice(0, found.start) + tail + text.slice(found.end));
}

const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])( +|$)(.*)$/;
const QUOTE = /^ *>/;
const BREAK = /^ {0,3}(=+|-{2,}|\*{3,}|_{3,})[ \t]*$/;
const HTML = /^ {0,3}<([A-Za-z]|\/)/;
const RAW_OPEN = /^ {0,3}<(script|pre|style|textarea)\b/i, RAW_CLOSE = /<\/(script|pre|style|textarea)>/i;
const lead = (t) => { const m = t.match(ITEM); return m ? lead(m[4]) : t; };
const itemCol = (m) => m[1].length + m[2].length + Math.min(m[3].length, 4);
// The fence state after a line: the opening run while inside a fenced block, else null. extra is the indent a list item allows.
const fenceAfter = (fence, t, extra = 0) => {
  const m = t.match(new RegExp(`^ {0,${3 + extra}}(\`{3,}|~{3,})(.*)$`));
  if (!fence) return m && !(m[1][0] === '`' && m[2].includes('`')) ? m[1] : null;
  return m && m[1][0] === fence[0] && m[1].length >= fence.length && isBlank(m[2]) ? null : fence;
};
// Text is latin1, where the byte A0 of a UTF-8 character reads as U+00A0, so white space here is a space or a tab only.
const HEAD = /^ {0,3}#{1,6}([ \t]|$)/;
// A segment, within which code spans pair: a heading line, or consecutive lines up to a blank line, a marker, a heading, a
// new list item, a fence, or a quote. continues(prev, t) says whether line t joins the segment of prev.
const continues = (prev, t) => !(HEAD.test(prev) || isBlank(t) || t.startsWith(BEGIN_PREFIX) || t === END
  || ITEM.test(t) || HEAD.test(t) || QUOTE.test(t) || fenceAfter(null, t));
const isBlank = (t) => /^[ \t]*$/.test(t);
const words = (s) => s.replace(/[ \t]+/g, ' ').replace(/^ | $/g, '');
const within = (skip, s) => skip && s >= skip.start && s < skip.end;

// The backtick runs of t. A backslash before an odd run escapes its first backtick only; the rest of the run can still open.
const ticks = (t) => [...t.matchAll(/`+/g)].map((m) => {
  let b = 0;
  while (t[m.index - 1 - b] === '\\') b++;
  return { at: m.index, end: m.index + m[0].length, len: m[0].length, esc: b % 2 === 1, tick: true };
});
// The pairing rule for code spans, shared by strip() and hide(): a run opens a span of its length (less an escaped first
// backtick) that the next run of that length closes, whole and escaped or not, since backslashes are literal inside a span.
// closer returns that run's index, or -1.
const opens = (r) => r.len - r.esc;
const closer = (runs, k) => {
  for (let j = k + 1; j < runs.length; j++) if (runs[j].tick && runs[j].len === opens(runs[k])) return j;
  return -1;
};

// t with its HTML comments blanked, and the comment and code-span state at its end. A backtick run is a code span when a run
// of the same length follows on the line or, through later(len), later in the paragraph; a comment mark inside one is text.
// Masked text, in comments and code spans, is NUL: neither a boundary nor part of an import path.
const MASK = '\0';
function strip(t, open, span, later) {
  const marks = [...ticks(t), ...[...t.matchAll(/<!--|--!?>/g)].map((m) => ({ at: m.index, s: m[0] }))].sort((x, y) => x.at - y.at);
  let out = '', at = 0;
  for (let k = 0; k < marks.length; k++) {
    const m = marks[k];
    if (span) { if (m.tick && m.len === span) span = 0; }
    else if (open) { if (m.s === '-->' || m.s === '--!>') { out += MASK.repeat(m.at + m.s.length - at); at = m.at + m.s.length; open = false; } }
    else if (m.s === '<!--') { out += t.slice(at, m.at); at = m.at; open = true; }
    else if (m.tick && opens(m)) {
      const c = closer(marks, k);
      if (c >= 0) k = c;
      else if (later(opens(m))) span = opens(m);
    }
  }
  return [out + (open ? MASK.repeat(t.length - at) : t.slice(at)), open, span];
}

// The lines of a text (byte offsets in the original, a BOM left out) and its units: headings, list items and paragraphs,
// each with its first and last line, its normalized text, and whether it is odd. A unit matches a rule only when it is plain
// (see the checks at the end); every line also records whether it is scanned for imports.
export function units(text, skip) {
  const lines = [], list = [];
  for (let at = text.startsWith(BOM) ? 3 : 0; at < text.length;) {
    const nl = text.indexOf('\n', at), e = nl < 0 ? text.length : nl + 1;
    lines.push({ s: at, e, t: text.slice(at, nl < 0 ? text.length : nl).replace(/\r$/, ''), scan: false });
    at = e;
  }
  // last[i] maps a backtick run length to the last line of line i's segment that holds such a run.
  const last = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    last[i] = i + 1 < lines.length && continues(lines[i].t, lines[i + 1].t) ? last[i + 1] : new Map();
    for (const r of ticks(lines[i].t)) if (!last[i].has(r.len)) last[i].set(r.len, i);
  }
  // own is the list item that an open fence or comment belongs to; html is how the open HTML block ends.
  let cur = null, fence = null, comment = false, html = null, own = null, span = 0;
  const flush = () => { if (cur) { cur.norm = words(cur.parts.join(' ')); list.push(cur); } cur = null; };
  lines.forEach((ln, i) => {
    const { s, t } = ln;
    const indent = t.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
    const start = (kind, parts, more) => { flush(); cur = { kind, a: i, b: i, parts, odd: false, bad: false, ...more }; };
    const nested = () => cur?.kind === 'item' && (indent >= cur.col || !cur.gap);
    const hold = () => { cur.parts.push(t); cur.b = i; cur.gap = false; cur.odd = true; };
    const classify = () => {
      if (within(skip, s) || (t.startsWith(BEGIN_PREFIX) || t === END) && !fence && !comment) { flush(); fence = html = own = null; comment = false; span = 0; return; }
      if (own && !isBlank(t) && indent < own.col) { fence = own = null; comment = false; flush(); }
      if (QUOTE.test(t) && (fence || comment)) return;
      if (fence) { fence = fenceAfter(fence, t, own?.col ?? 0); if (own) hold(); return; }
      if (html) {
        if (!(html === 'blank' ? isBlank(t) : html.test(t))) return;
        html = null;
        if (!isBlank(t)) return;
      }
      if (i && !continues(lines[i - 1].t, t)) span = 0;
      const [stripped, open, inSpan] = QUOTE.test(t) ? [t, false, span] : strip(t, comment, span, (len) => last[i].get(len) > i);
      const hadComment = comment || stripped !== t;
      comment = open;
      span = inSpan;
      const rebase = (x) => ' '.repeat(indent) + x.replace(/^[ \t]+/, '').replace(/[ \t]+$/, ' ');
      const m = stripped === t ? t : rebase(stripped.replaceAll(MASK, ' ')), shown = stripped === t ? t : rebase(stripped);
      if (hadComment && isBlank(m)) { if (nested()) { cur.odd = true; cur.gap = false; } else flush(); return; }
      if (isBlank(m)) { if (cur?.kind === 'item') cur.gap = true; else flush(); return; }
      if (QUOTE.test(m) || BREAK.test(m) || HTML.test(m)) {
        if (cur) { cur.odd = true; cur.skip ||= cur.kind === 'para' && BREAK.test(m); }
        flush();
        if (HTML.test(m)) html = RAW_OPEN.test(m) ? (RAW_CLOSE.test(m) ? null : RAW_CLOSE) : 'blank';
        return;
      }
      const item = m.match(ITEM), head = m.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/);
      const starts = item && !(cur?.kind === 'item' && item[1].length > cur.indent);
      if (fence = fenceAfter(null, item ? lead(m) : m, cur?.kind === 'item' ? cur.col : 0)) {
        if (starts) { start('item', [item[4]], { indent: item[1].length, col: itemCol(item) }); cur.odd = true; }
        else if (nested()) hold(); else flush();
        return;
      }
      if (head && !(cur?.kind === 'item' && indent >= cur.col)) {
        flush();
        list.push(ln.u = { kind: 'head', level: head[1].length, a: i, b: i, odd: false, norm: words(`${head[1]} ${head[2] ?? ''}`) });
        ln.m = shown;
        ln.scan = !t.includes('\t');
        return;
      }
      if (starts) start('item', [item[4]], { indent: item[1].length, col: itemCol(item) });
      else if (cur?.kind === 'item' && cur.gap && indent < cur.col) start('para', [m]);
      else if (cur) { cur.gap = false; cur.parts.push(m); cur.b = i; }
      else if (indent < 4) start('para', [m]);
      else return;
      const plain = starts ? item[3].length === 1 && item[4] !== '' && !ITEM.test(item[4]) && !QUOTE.test(item[4])
        : cur.a === i || cur.kind === 'para' ? indent <= 3 : indent >= cur.col && indent <= cur.col + 3 && !item && !head;
      cur.bad ||= !plain || t.includes('\t') || m.includes('|');
      cur.odd ||= cur.bad || hadComment;
      ln.u = cur;
      ln.m = shown;
      ln.scan = !cur.bad;
    };
    const wasOpen = !!(fence || comment);
    classify();
    if (!wasOpen && (fence || comment)) own = cur?.kind === 'item' && (cur.a === i || indent >= cur.col) ? cur : null;
    if (!fence && !comment) own = null;
  });
  flush();
  // A unit matches only when it starts at column 0, since indented text may belong to a container, when its raw lines are
  // its match text (nothing was stripped or hidden from it), and when what follows it ends it: a blank line, the end, a
  // heading, a house-rules marker, or a plain item.
  const ends = (t) => t === undefined || isBlank(t) || /^#{1,6}([ \t]|$)/.test(t) || t.startsWith(BEGIN_PREFIX) || t === END
    || /^([-*+]|\d{1,9}[.)]) [^ \t]/.test(t);
  for (const u of list) {
    u.odd ||= /^[ \t]/.test(lines[u.a].t) || !ends(lines[u.b + 1]?.t);
    const raw = words(lines.slice(u.a, u.b + 1).map((l) => l.t).join(' '));
    u.odd ||= (u.kind === 'item' ? raw.replace(/^([-*+]|\d{1,9}[.)])( |$)/, '') : raw) !== u.norm;
  }
  return { lines, list };
}
const ruleNorms = (list) => list.filter((u) => u.kind !== 'head' && !u.odd).map((u) => u.norm);

// How the rules in body overlap what is already there: n of them in base (the file without its block), k in what the
// imported files hold, and per import. total counts the body's items and paragraphs, not its headings.
function overlap(body, base, imported) {
  const rules = ruleNorms(units(body).list), mine = new Set(ruleNorms(units(base).list));
  const count = (set) => rules.filter((r) => set.has(r)).length;
  const theirs = new Set(imported.flatMap((i) => [...i.units]));
  return { total: rules.length, n: count(mine), k: count(theirs), all: count(new Set([...mine, ...theirs])),
    imports: imported.map(({ ref, units: set, missed, unreadable }) => ({ ref, n: count(set), missed, unreadable })) };
}

// The text with every rule unit that body also holds taken out, a heading of body too when its section held only such
// units, and one blank line after a removed run that had blank lines around it. block goes before the first level 1 or 2
// heading at column 0 after the first removed line, else at the end, so no user text ends up after the end marker where it
// would read as part of the block. block(join) renders the block. Above a heading that had a blank line before it, the
// block gets a blank line on each side and join=blank, so remove still gives the trimmed file.
export function adoptRules(text, block, body) {
  const { lines, list } = units(text), mine = units(body).list;
  const same = (head) => new Set(mine.filter((u) => (u.kind === 'head') === head).map((u) => u.norm));
  const rules = same(false), heads = same(true), gone = lines.map(() => false), extra = new Set();
  const blank = (i) => isBlank(lines[i].t);
  list.filter((u) => u.kind !== 'head' && !u.odd && rules.has(u.norm)).forEach((u) => { for (let i = u.a; i <= u.b; i++) gone[i] = true; });
  // Last heading first, so a removed subheading counts when its parent's section is judged.
  list.filter((u) => u.kind === 'head' && !u.odd && heads.has(u.norm)).reverse().forEach((h) => {
    const end = list.find((u) => u.kind === 'head' && u.a > h.a && u.level <= h.level)?.a ?? lines.length;
    const only = lines.slice(h.a + 1, end).every((_, i) => blank(h.a + 1 + i) || gone[h.a + 1 + i]);
    if (only && list.some((u) => u.kind !== 'head' && u.a > h.a && u.a < end && gone[u.a])) gone[h.a] = true;
  });
  gone.forEach((g, i) => {
    if (!g || gone[i - 1]) return;
    let y = i;
    while (gone[y + 1]) y++;
    if ((i === 0 || blank(i - 1)) && y + 1 < lines.length && blank(y + 1)) extra.add(y + 1);
  });
  const first = gone.indexOf(true), eol = eolOf(text);
  const at = first < 0 ? -1 : list.find((u) => u.kind === 'head' && u.level < 3 && u.a > first && !gone[u.a] && lines[u.a].t.startsWith('#'))?.a ?? lines.length;
  const kept = (from, to) => lines.slice(from, to).filter((_, k) => !gone[from + k] && !extra.has(from + k));
  const [pre, post] = [kept(0, at), kept(at, lines.length)];
  const tail = (l) => text.slice(l.s, l.e);
  const spaced = post.length > 0 && blank(at - 1) && pre.some((l) => !isBlank(l.t));
  while (spaced && isBlank(pre.at(-1).t)) pre.pop();
  const head = text.slice(0, lines[0]?.s ?? 0) + pre.map(tail).join('') + (pre.length && !tail(pre.at(-1)).endsWith('\n') ? eol : '');
  return spaced ? head + eol + block('blank') + eol + post.map(tail).join('') : head + block('none') + post.map(tail).join('');
}

// A unit's text with its code spans blanked. A span is a backtick run and the next run of the same length in the unit; a
// run with no partner, or opened after a backslash, is literal text.
function hide(par) {
  const runs = ticks(par);
  let out = '', at = 0;
  for (let k = 0; k < runs.length; k++) {
    const c = opens(runs[k]) ? closer(runs, k) : -1;
    if (c < 0) continue;
    const from = runs[k].at + runs[k].esc;
    out += par.slice(at, from) + par.slice(from, runs[c].end).replace(/[^\n]/g, MASK);
    at = runs[c].end;
    k = c;
  }
  return out + par.slice(at);
}

// Imports as Claude reads them: an @ at a line start or after white space, in the lines units() marks as scanned, outside
// code spans; the path runs to the first space not escaped with a backslash, or the first masked character (cut).
export function imports(text, found) {
  const { lines } = units(text, found?.kind === 'block' ? found : null), groups = new Map(), out = [];
  lines.forEach((ln, i) => { if (ln.scan && !ln.u.skip) (groups.get(ln.u) ?? groups.set(ln.u, []).get(ln.u)).push(i); });
  // Spans pair within a segment: a run of consecutive scanned lines that continues() joins.
  const runs = [];
  for (const rows of groups.values()) {
    rows.forEach((i, k) => (rows[k - 1] === i - 1 && continues(lines[i - 1].t, lines[i].t) ? runs.at(-1).push(i) : runs.push([i])));
  }
  for (const rows of runs) {
    const seen = hide(rows.map((i) => lines[i].m).join('\n')).split('\n');
    rows.forEach((i, k) => {
      for (const m of seen[k].matchAll(/(?<=^|[ \t])@(?!["'])((?:\\ |[^ \t\0])+)/g)) {
        out.push({ n: i + 1, token: `@${m[1]}`, path: m[1].replace(/\\ /g, ' ') });
      }
    });
  }
  return out;
}

// A small line diff: the changed run between the common head and tail, with three lines of context on each side.
export function diff(before, after, from, to) {
  const a = before === '' ? [] : before.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  const b = after === '' ? [] : after.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const ctx = (lines) => lines.map((l) => ` ${l}`);
  return [`--- ${from}`, `+++ ${to}`, `@@ line ${Math.max(head - 2, 1)} @@`,
    ...ctx(a.slice(Math.max(head - 3, 0), head)),
    ...a.slice(head, a.length - tail).map((l) => `-${l}`), ...b.slice(head, b.length - tail).map((l) => `+${l}`),
    ...ctx(a.slice(a.length - tail, a.length - tail + 3))].join('\n');
}

// The one target: CLAUDE.md in $CLAUDE_CONFIG_DIR, else in ~/.claude. A symlink is followed to the file it points to;
// logical is the path before that.
export function targets(env, home = homedir()) {
  const logical = join(env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'CLAUDE.md');
  return { path: existsSync(logical) && lstatSync(logical).isSymbolicLink() ? realpathSync(logical) : logical, logical };
}

// Reads what the target imports, as Claude loads it: relative paths against the importing file's directory, breadth
// first, four hops. Each top-level import gets the rule units of every file it reaches, the count of imports that could
// not be followed (unreadable or over a bound; imports past the last hop are not loaded, so are not counted), and
// whether its own file could not be read. shallow checks only that each top-level import can be read.
export function scanImports(text, file, found, home, logical = file, shallow = false) {
  const cache = new Map();
  const real = (path) => { try { return realpathSync(path); } catch { return path; } };
  const load = (path) => {
    const key = real(path);
    if (!cache.has(key)) {
      let got = null;
      try {
        const info = statSync(path);
        if (cache.size < MAX_FILES && info.isFile() && info.size <= MAX_BYTES) got = readFileSync(path, 'latin1');
      } catch {}
      cache.set(key, got === null ? null : { body: got });
    }
    return cache.get(key);
  };
  const root = new Set([file, logical].map(real));
  const where = (from, raw) => {
    const path = Buffer.from(raw, 'latin1').toString('utf8');
    return path.startsWith('~/') ? join(home, path.slice(2)) : resolve(dirname(from), path);
  };
  return imports(text, found).map(({ n, token, path }) => {
    const beside = where(logical, path), first = beside !== where(file, path) && load(beside) === null ? where(file, path) : beside;
    const reach = { ref: `${n}: ${token}`, units: new Set(), missed: 0, unreadable: false }, seen = new Set([first]);
    for (const queue = [[first, 1]]; queue.length;) {
      const [at, hop] = queue.shift();
      if (root.has(real(at))) continue;
      const file = load(at);
      if (file === null) { reach.missed++; reach.unreadable ||= hop === 1; continue; }
      if (shallow) continue;
      // Each file is parsed once, whichever import reaches it.
      file.norms ??= ruleNorms(units(file.body).list);
      file.paths ??= imports(file.body).map((i) => i.path);
      file.norms.forEach((u) => reach.units.add(u));
      for (const next of file.paths.map((p) => where(at, p))) {
        if (seen.has(next)) continue;
        if (hop < HOPS) { seen.add(next); queue.push([next, hop + 1]); }
      }
    }
    return reach;
  });
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// The shipped part texts in LF form.
export const loadTexts = (root = ROOT) =>
  Object.fromEntries(Object.values(PARTS).map((f) => [f, readFileSync(join(root, 'rules', f), 'latin1').replace(/\r\n/g, '\n')]));
export const pluginVersion = (root = ROOT) => JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8')).version;
export const readText = (path) => { try { return readFileSync(path, 'latin1'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const readJson = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return undefined; throw e; } };
export const loadState = (dataDir) => ({ created: false, declined: [], ...readJson(join(dataDir, STATE_FILE)) });
const save = (dataDir, file, value) => { mkdirSync(dataDir, { recursive: true }); writeAtomic(join(dataDir, file), `${JSON.stringify(value, null, 2)}\n`, undefined, 'utf8'); };
const stamp = (now) => now.toISOString().replace(/\D/g, '').slice(0, 14);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Each step but status and session-start reads, changes and writes the shared plan and state files, and Claude may run two
// applies at once, so steps take turns through a lock directory. A lock older than a minute is from a run that died.
function locked(dataDir, fn) {
  const lock = join(dataDir, 'rules.lock');
  mkdirSync(dataDir, { recursive: true });
  for (let tries = 0; ; tries++) {
    try { mkdirSync(lock); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - statSync(lock).mtimeMs > 60_000) { rmSync(lock, { recursive: true, force: true }); continue; } } catch {}
      if (tries >= 200) refuse(`another /rules step holds ${lock}; nothing was written; run /rules again`);
      sleep(50);
    }
  }
  try { return fn(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

// Writes beside the target, then renames over it. On Windows a rename that fails, as when another process holds the
// file, is retried once after a short wait.
function writeAtomic(path, text, backup, encoding = 'latin1') {
  const tmp = `${path}.reimagine-tmp-${process.pid}`;
  writeFileSync(tmp, text, encoding);
  if (existsSync(path)) chmodSync(tmp, statSync(path).mode & 0o777);
  try { renameSync(tmp, path); } catch (e) {
    if (process.platform === 'win32') {
      sleep(500);
      try { renameSync(tmp, path); return; } catch {}
    }
    rmSync(tmp, { force: true });
    refuse(`could not replace ${path} (${e.code})${backup ? `; the backup is ${backup}` : ''}`);
  }
}

function report(t, plan) {
  const shown = (text) => Buffer.from(text, 'latin1').toString('utf8');
  const lines = [`target: ${t.path}`];
  const declined = plan.declined ? ' (you declined this text before)' : '';
  lines.push(`state: ${plan.state}${declined}${plan.note ? `; ${plan.note}` : ''}`);
  if (plan.options) lines.push(`options: ${plan.options.join(',')}`);
  const ov = plan.overlap;
  for (const i of ov?.imports ?? []) {
    const holds = ov.total === undefined ? '' : i.missed ? `holds at least ${i.n} of ${ov.total} rules; ${i.missed} import${i.missed === 1 ? '' : 's'} could not be read`
      : i.n ? `holds ${i.n} of ${ov.total} rules` : 'holds none of the rules';
    const what = i.unreadable ? ' that cannot be read' : holds && ` that ${holds}`;
    lines.push(`note: line ${shown(i.ref)} imports a file${what}; it is left as it is`);
  }
  const idle = plan.after === null;
  if (ov?.n) lines.push(idle ? `note: ${ov.n} of ${ov.total} rules are also present outside the block, duplicating it` : `note: ${ov.n} of ${ov.total} rules already present outside the block; applying duplicates them`);
  if (ov?.n && idle && !ov.gate) lines.push('note: /rules --adopt moves those lines into the block');
  if (ov?.n && ov.gate) {
    lines.push(`note: adopt leaves this file alone because line ${ov.gate} holds Markdown it does not handle; trim the copy by hand, then run /rules`);
  }
  if (plan.edits) lines.push(diff(...plan.edits.map(shown), 'the rules this plugin would write', `the block in ${t.path}`));
  if (plan.after === null) return [...lines, 'change: none'];
  const advice = {
    adopt: ['note: /rules --adopt moves those lines into the block'],
    decline: ov?.k ? [`note: ${ov.k} of ${ov.total} rules come from imports; applying duplicates them; declining leaves this file unchanged`] : [],
  }[plan.recommend] ?? [];
  const proposed = diff(shown(t.text ?? ''), shown(plan.after), t.path, `${t.path} (proposed)`);
  return [...lines, 'change: ready', `recommend: ${plan.recommend}`, ...advice, proposed];
}

// The notice line for the session hook, or '' when there is none. A block is stale when it is unedited and its digest
// differs from the digest of the shipped rules for the block's own options; a declined shipped digest stays quiet.
export function staleNotice(path, text, texts, declined = []) {
  const found = inspect(text ?? '');
  if (found.kind !== 'block' || digest(text.slice(found.bodyStart, found.bodyEnd)) !== found.digest) return '';
  const shipped = digest(render(found.options, texts));
  if (shipped === found.digest || declined.includes(shipped)) return '';
  return JSON.stringify({ systemMessage: `rules: the house rules in ${path} are older than this plugin's; run /rules to update them` });
}

// A hook must never fail a session start: any error gives no output.
function sessionStart(dataDir, env, home) {
  try {
    const { path } = targets(env, home);
    return [staleNotice(path, readText(path), loadTexts(), loadState(dataDir).declined)].filter(Boolean);
  } catch { return []; }
}

// Returns the output lines. A refusal throws.
export function main(argv, { env = process.env, platform = process.platform, now = new Date(), home = homedir() } = {}) {
  const [verb, dataDir, ...rest] = argv;
  if (verb === 'session-start') return sessionStart(dataDir, env, home);
  if (!VERBS.includes(verb)) refuse(`unknown command ${verb}; use status, plan, remove, apply, decline or session-start`);
  if (!dataDir) refuse('the data directory argument is missing');
  if (rest.includes('--adopt') && verb !== 'plan') refuse(`--adopt goes with plan, not ${verb}`);
  const step = () => run(verb, dataDir, rest, { env, platform, now, home });
  return verb === 'status' ? step() : locked(dataDir, step);
}

function run(verb, dataDir, rest, { env, platform, now, home }) {
  const t = targets(env, home);
  const state = loadState(dataDir);
  if (verb === 'apply' || verb === 'decline') {
    const p = readJson(join(dataDir, PLAN_FILE)) ?? {};
    if (!p.path) refuse('there is no planned change; run /rules again');
    if (verb === 'decline') {
      state.declined = [...new Set([...state.declined, p.digest])].filter(Boolean);
      save(dataDir, STATE_FILE, state);
      save(dataDir, PLAN_FILE, {});
      return [`rules: declined the change to ${p.path}; the session notice stays quiet for this text`];
    }
    const before = readText(p.path);
    if (lstatSync(p.path, { throwIfNoEntry: false })?.isSymbolicLink()) refuse(`${p.path} is a symbolic link that points to a missing file, so nothing was written`);
    if (fileHash(before) !== p.before) refuse(`${p.path} changed after the diff was shown, so nothing was written; run /rules again`);
    if (before !== null && statSync(p.path).nlink > 1) refuse(`${p.path} has multiple hard links, so nothing was written`);
    const after = Buffer.from(p.after, 'base64').toString('latin1');
    if (p.remove && state.created && after === '') {
      rmSync(p.path);
      state.created = false;
      delete state.options;
      save(dataDir, STATE_FILE, state);
      save(dataDir, PLAN_FILE, {});
      return [`rules: removed ${p.path}, which /rules had created and which held nothing else`];
    }
    let backup;
    if (before !== null) {
      backup = `${p.path}.reimagine-backup-${stamp(now)}`;
      try { copyFileSync(p.path, backup, constants.COPYFILE_EXCL); } catch (e) { refuse(`could not back up ${p.path} to ${backup} (${e.code}); nothing was written`); }
    } else mkdirSync(dirname(p.path), { recursive: true });
    writeAtomic(p.path, after, backup);
    if (before === null) state.created = true;
    if (p.remove) delete state.options; else state.options = p.options;
    save(dataDir, STATE_FILE, state);
    save(dataDir, PLAN_FILE, {});
    return [`rules: wrote ${p.path}${backup ? `; the backup is ${backup}` : ''}`];
  }
  let options;
  const adopt = rest.includes('--adopt');
  const args = rest.filter((a) => a !== '--adopt');
  const at = args.indexOf('--options');
  if (at >= 0 && args.length > at + 2) refuse(`unexpected argument "${args[at + 2]}" after --options list`);
  if (at >= 0) options = parseOptions(args[at + 1], platform);
  t.text = readText(t.path);
  const imported = verb !== 'status' && t.text ? scanImports(t.text, t.path, inspect(t.text), home, t.logical, verb === 'remove') : [];
  const plan = planTarget({ text: t.text, options, recorded: state.options, version: pluginVersion(), texts: loadTexts(), platform,
    declined: state.declined, remove: verb === 'remove', adopt, imported });
  if (verb === 'status') {
    const kept = ['current', 'stale', 'edited'].includes(plan.state) || !!state.options;
    return [`state: ${plan.state} ${t.path}${plan.options ? ` options=${plan.options.join(',')}${kept ? '' : ' (default)'}` : ''}`,
      `options recorded: ${kept ? 'yes' : 'no'}`];
  }
  save(dataDir, PLAN_FILE, plan.after === null ? {} : { path: t.path, before: fileHash(t.text), after: Buffer.from(plan.after, 'latin1').toString('base64'),
    digest: plan.digest, options: plan.options, remove: verb === 'remove' });
  return report(t, plan);
}

// Node resolves the entry point through symlinks, so compare with the resolved path.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const lines = main(process.argv.slice(2));
    process.stdout.write(lines.length ? `${lines.join('\n')}\n` : '');
  } catch (e) {
    process.stdout.write(`${e instanceof Refusal ? `rules: ${e.message}` : `rules: unexpected error: ${e?.stack ?? e}`}\n`);
    process.exitCode = 1;
  }
}
