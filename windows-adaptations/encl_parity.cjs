#!/usr/bin/env node
'use strict';
// horosa_encl_parity_audit_v1 — enclosing-scope parity audit for a merge round (gotcha #118).
// For every frontend overlay target that upstream also changed this round: take each line OUR overlay added on top of
// the old upstream file, record the scope that encloses it in our previous release (class C > method m, object path
// model.effects.x, top-level function f, module level), then find the same line in the merged working tree (facade +
// registered sub-modules + known extra homes) and record its enclosing scope there. A line whose scope changed, or that
// vanished, is reported. Lines upstream itself carries in the new tree at the same scope are discounted.
// Why: string sentinels and the binding gates cannot see a block that landed at the wrong nesting level (an effect
// pasted between `state` and `reducers`, a call moved out of its callback). This compares scopes, not strings.
// Run it BEFORE committing a merge round (it compares the working tree against HEAD = the previous release).
// Usage: node windows-adaptations/encl_parity.cjs <old-upstream-ref> <new-upstream-ref> [substring-filter]
//   e.g.  node windows-adaptations/encl_parity.cjs e55c3a66 v3.15.0
// Output: MOVED / LOST lines per target (comment and import lines are listed too; read the code lines first).
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const REPO = path.resolve(__dirname, '..').split(path.sep).join('/');
const WSREL = 'local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c';
// HOROSA_ENCL_WS: audit another copy of the product tree (used for the negative self-proof on a doctored copy)
const WS = process.env.HOROSA_ENCL_WS ? process.env.HOROSA_ENCL_WS.split(path.sep).join('/') : `${REPO}/${WSREL}`;
const UI = `${WS}/astrostudyui`;
const CLONE = `${REPO}/tmp/mac-sync-2.6.7`;
const OLD = process.argv[2];
const NEW = process.argv[3];
if (!OLD || !NEW) { console.error('usage: node encl_parity.cjs <old-upstream-ref> <new-upstream-ref> [filter]'); process.exit(2); }
const UI_REAL = `${REPO}/${WSREL}/astrostudyui`;   // the parser always comes from the real tree
const parser = require(path.join(UI_REAL, 'node_modules', '@babel', 'parser'));
const traverse = require(path.join(UI_REAL, 'node_modules', '@babel', 'traverse')).default;
const PARSE = { sourceType: 'module', errorRecovery: true, plugins: ['jsx', 'classProperties', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread', 'decorators-legacy', 'exportDefaultFrom'] };

const git = (args, cwd) => { try { return cp.execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\r\n/g, '\n'); } catch (_e) { return null; } };
const upShow = (ref, rel) => git(['show', `${ref}:Horosa-Web/${rel}`], CLONE);
const headShow = (rel) => git(['show', `HEAD:${WSREL}/${rel}`], REPO);
const wsRead = (rel) => { try { return fs.readFileSync(`${WS}/${rel}`, 'utf8').replace(/\r\n/g, '\n'); } catch (_e) { return null; } };

const sets = JSON.parse(fs.readFileSync(`${UI}/scripts/source-sets.json`, 'utf8')).sets;
const EXTRA = {
  'astrostudyui/src/components/direction/AstroDirectMain.js': ['astrostudyui/src/components/direction/pdWarm.js'],
  'astrostudyui/src/components/planetarium/PlanetariumBabylon.js': fs.readdirSync(`${UI_REAL}/src/components/planetarium/babylon`).filter((f) => f.endsWith('.js')).map((f) => `astrostudyui/src/components/planetarium/babylon/${f}`),
  'astrostudyui/src/components/planetarium/babylon/PlanetariumRenderer.js': fs.readdirSync(`${UI_REAL}/src/components/planetarium/babylon`).filter((f) => f.endsWith('.js')).map((f) => `astrostudyui/src/components/planetarium/babylon/${f}`),
};
function setFiles(rel) {
  const key = rel.replace('astrostudyui/src/', '');
  const out = [rel];
  if (sets[key]) for (const f of sets[key].files) out.push(`astrostudyui/src/${sets[key].dir}/${f}`);
  for (const f of EXTRA[rel] || []) if (!out.includes(f)) out.push(f);
  return out;
}

/** line (1-based) -> enclosing scope label */
function scopeMap(src) {
  let ast;
  try { ast = parser.parse(src, PARSE); } catch (e) { return null; }
  const spans = [];   // {start,end,label,depth}
  const nameOfKey = (k) => (k && (k.name || (k.value !== undefined ? String(k.value) : null))) || '?';
  traverse(ast, {
    enter(p) {
      const n = p.node;
      let label = null;
      if (n.type === 'ClassMethod' || n.type === 'ClassPrivateMethod') label = `m:${nameOfKey(n.key)}`;
      else if (n.type === 'ClassProperty' && n.value && /Function/.test(n.value.type)) label = `m:${nameOfKey(n.key)}`;
      else if (n.type === 'ObjectMethod') label = `m:${nameOfKey(n.key)}`;
      else if (n.type === 'ObjectProperty' && n.value && /Function/.test(n.value.type)) label = `m:${nameOfKey(n.key)}`;
      else if (n.type === 'ObjectProperty' && n.value && n.value.type === 'ObjectExpression' && p.parentPath && p.parentPath.parentPath && ['VariableDeclarator', 'ExportDefaultDeclaration', 'ObjectProperty'].includes(p.parentPath.parentPath.node.type)) label = `o:${nameOfKey(n.key)}`;
      else if (n.type === 'FunctionDeclaration' && n.id) label = `f:${n.id.name}`;
      else if (n.type === 'VariableDeclarator' && n.id && n.id.name && n.init && /Function/.test(n.init.type)) label = `f:${n.id.name}`;
      else if (n.type === 'ClassDeclaration' && n.id) label = `c:${n.id.name}`;
      if (label && n.loc) spans.push({ start: n.loc.start.line, end: n.loc.end.line, label });
    },
  });
  spans.sort((a, b) => (a.start - b.start) || (b.end - a.end));
  const lines = src.split('\n').length;
  const out = new Array(lines + 2).fill('<module>');
  // outermost first; inner spans overwrite with a joined path, but class level is dropped when a method is inside
  const stackAt = new Array(lines + 2).fill(null).map(() => []);
  for (const s of spans) for (let i = s.start; i <= s.end && i <= lines; i++) stackAt[i].push(s.label);
  for (let i = 1; i <= lines; i++) {
    const st = stackAt[i];
    if (!st.length) continue;
    // scope = named containers that are not classes / mixin roots, i.e. the path below the class or module object
    const keep = st.filter((l) => !l.startsWith('c:'));
    out[i] = keep.length ? keep.join('>') : `<classbody>`;
  }
  return out;
}

const norm = (l) => l.trim();
const trivial = (t) => !t || /^[\]\[(){},;]*$/.test(t) || t === '});' || t === '})' || t === 'try{' || t === '}catch(e){' || t === 'return;' || t === 'break;' || t === '}else{' || t === 'return null;' || t === '/>' || t === '</div>' || t === '<div>' || t === 'default:' || t === ');';

function occurrences(src) {
  const map = scopeMap(src);
  const out = [];
  if (!map) return null;
  src.split('\n').forEach((l, i) => { const t = norm(l); if (!trivial(t)) out.push([t, map[i + 1]]); });
  return out;
}
function counter(list) { const m = new Map(); for (const k of list) m.set(k, (m.get(k) || 0) + 1); return m; }

// targets = files our previous release differed from old upstream in (its overlay targets) that upstream changed this round
const filter = process.argv[4] || '';
const prevApply = git(['show', 'HEAD:windows-adaptations/apply.sh'], REPO) || '';
const prevTargets = new Set(Array.from(prevApply.matchAll(/^apply_patch\s+\S+\s+"?([^\s"]+)"?\s+\S+/gm)).map((m) => m[1]));
const upChanged = new Set((git(['diff', '--name-only', OLD, NEW, '--', 'Horosa-Web/astrostudyui/src'], CLONE) || '').split('\n').filter(Boolean).map((f) => f.replace(/^Horosa-Web\//, '')));
const targets = Array.from(prevTargets).filter((k) => upChanged.has(k) && k.startsWith('astrostudyui/src') && k.endsWith('.js') && !k.includes('__tests__') && k.includes(filter)).sort();
let totalFlags = 0;
for (const rel of targets) {
  const oldUp = upShow(OLD, rel); const oldOurs = headShow(rel);
  if (oldUp === null || oldOurs === null) { console.log(`SKIP ${rel} (old side missing)`); continue; }
  const occOldUp = occurrences(oldUp); const occOldOurs = occurrences(oldOurs);
  if (!occOldUp || !occOldOurs) { console.log(`SKIP ${rel} (parse)`); continue; }
  // our added lines = multiset(text) in ours minus old upstream; keep scope of each surplus occurrence
  const upCount = counter(occOldUp.map(([t]) => t));
  const seen = new Map();
  const ours = [];   // [text, scope]
  for (const [t, sc] of occOldOurs) {
    const used = seen.get(t) || 0; seen.set(t, used + 1);
    if (used >= (upCount.get(t) || 0)) ours.push([t, sc]);
  }
  // NOTE: surplus attribution takes the LAST occurrences as ours; scope-level comparison below is multiset based, so
  // which physical occurrence is "ours" does not matter as long as old/new multisets of scopes are compared per text.
  const files = setFiles(rel);
  const newWs = []; const newUp = [];
  for (const f of files) {
    const w = wsRead(f); if (w !== null) { const o = occurrences(w); if (o) newWs.push(...o); }
    const u = upShow(NEW, f); if (u !== null) { const o = occurrences(u); if (o) newUp.push(...o); }
  }
  const oldOursByText = new Map(); for (const [t, sc] of occOldOurs) { if (!oldOursByText.has(t)) oldOursByText.set(t, []); oldOursByText.get(t).push(sc); }
  const oldUpByText = new Map(); for (const [t, sc] of occOldUp) { if (!oldUpByText.has(t)) oldUpByText.set(t, []); oldUpByText.get(t).push(sc); }
  const wsByText = new Map(); for (const [t, sc] of newWs) { if (!wsByText.has(t)) wsByText.set(t, []); wsByText.get(t).push(sc); }
  const upByText = new Map(); for (const [t, sc] of newUp) { if (!upByText.has(t)) upByText.set(t, []); upByText.get(t).push(sc); }
  const flags = [];
  for (const t of new Set(ours.map(([x]) => x))) {
    // overlay scopes then = scopes(ours old) - scopes(old upstream)   (multiset)
    const sub = (a, b) => { const c = counter(b); const out = []; for (const x of a) { if ((c.get(x) || 0) > 0) c.set(x, c.get(x) - 1); else out.push(x); } return out; };
    const then = sub(oldOursByText.get(t) || [], oldUpByText.get(t) || []).sort();
    const now = sub(wsByText.get(t) || [], upByText.get(t) || []).sort();
    if (then.join('|') === now.join('|')) continue;
    // upstream absorbed the line this round (it is in new upstream but was not in old upstream): fine when ws total scopes cover then
    const wsAll = (wsByText.get(t) || []).slice().sort();
    const lost = sub(then, wsAll);
    const extra = sub(now, then);
    if (!lost.length && !extra.length) continue;
    flags.push({ t, then, now, lost, extra });
  }
  if (flags.length) {
    console.log(`\n== ${rel.replace('astrostudyui/src/', '')}  (${flags.length} lines)`);
    for (const f of flags.slice(0, 60)) {
      const kind = f.lost.length && f.extra.length ? 'MOVED' : (f.lost.length ? 'LOST ' : 'EXTRA');
      console.log(`  ${kind} ${JSON.stringify(f.t.slice(0, 110))}\n         then=[${f.then.join(', ')}] now=[${f.now.join(', ')}]`);
    }
    if (flags.length > 60) console.log(`  ... ${flags.length - 60} more`);
    totalFlags += flags.length;
  }
}
console.log(`\ntargets=${targets.length} flagged-lines=${totalFlags}`);
