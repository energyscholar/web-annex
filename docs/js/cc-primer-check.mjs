#!/usr/bin/env node
/**
 * cc-primer-check.mjs — the shared "Compass in one minute" primer is mounted correctly.
 *
 *   node docs/js/cc-primer-check.mjs [page.html …]   # no pages: every .html under docs/
 *   node docs/js/cc-primer-check.mjs --series         # also REQUIRE the mount on the four series pages
 *
 * For every page: a page with a <div class="cc-primer-mount"> loads primer.js EXACTLY ONCE, and that
 * script resolves to docs/diamond-node/critical-lines/primer.js; a page that loads primer.js has a
 * mount. The primer's text lives only in primer.js, so it is byte-identical wherever it is mounted.
 * Exit code 1 on any violation.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRIMER = path.join(DOCS, 'diamond-node', 'critical-lines', 'primer.js');
const SERIES = ['kosterlitz-thouless/index.html', 'diamond-node/critical-lines/index.html',
  'diamond-node/critical-lines/models/index.html', 'diamond-node/critical-lines/techniques/index.html'];
const argv = process.argv.slice(2);
const requireSeries = argv.includes('--series');

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) await walk(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = argv.filter((a) => !a.startsWith('--')).map((a) => path.resolve(a));
const list = pages.length ? pages : await walk(DOCS);
if (requireSeries) for (const s of SERIES) { const p = path.join(DOCS, s); if (!list.includes(p)) list.push(p); }
const bad = [];
let mounted = 0;
if (!existsSync(PRIMER)) bad.push('primer.js is missing: ' + path.relative(DOCS, PRIMER));
for (const f of list) {
  const rel = path.relative(DOCS, f).split(path.sep).join('/');
  if (!existsSync(f)) { bad.push(rel + ': page not found'); continue; }
  const html = (await readFile(f, 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
  const mounts = (html.match(/<div[^>]*class="[^"]*\bcc-primer-mount\b[^"]*"[^>]*>/g) || []).length;
  const srcs = [...html.matchAll(/<script[^>]*\bsrc="([^"]*primer\.js)"[^>]*>/g)].map((m) => m[1]);
  if (requireSeries && SERIES.includes(rel) && !mounts) bad.push(rel + ': series page without a primer mount');
  if (mounts && srcs.length !== 1) bad.push(`${rel}: ${mounts} mount(s) but primer.js loaded ${srcs.length} time(s)`);
  if (!mounts && srcs.length) bad.push(rel + ': loads primer.js with no mount');
  for (const s of srcs) {
    const target = path.resolve(path.dirname(f), s.split(/[?#]/)[0]);
    if (target !== PRIMER) bad.push(`${rel}: primer script "${s}" resolves to ${path.relative(DOCS, target)}, not diamond-node/critical-lines/primer.js`);
  }
  if (mounts) mounted++;
}
console.log(`cc-primer-check: ${list.length} page(s), ${mounted} with a primer mount, ${bad.length} violation(s)`);
bad.forEach((b) => console.log('  ' + b));
process.exit(bad.length ? 1 : 0);
