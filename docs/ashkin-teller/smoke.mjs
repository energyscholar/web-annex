#!/usr/bin/env node
/**
 * smoke.mjs — acceptance checks for docs/ashkin-teller/index.html.
 *
 *   T1 no links out          T2 links in (index card, search entry, models page)
 *   T3 exact numbers (I1)    T4 Monte Carlo sanity (I2, seed 1)
 *   T7 size: scrollHeight at 1280x1024 with details closed, and visible prose words
 *
 * Puppeteer is resolved the same way as docs/verify-pages.mjs:
 *     PUPPETEER_DIR=/path/to/node_modules/puppeteer node docs/ashkin-teller/smoke.mjs
 *
 * Options:
 *   --page <file>   check another copy of the page (T1, T3, T4, T7 only)
 *   --only T3,T4    run a subset
 *
 * Exit code is non-zero if any test fails.
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const valOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const PAGE = path.resolve(valOf('--page') || path.join(HERE, 'index.html'));
const ONLY = (valOf('--only') || 'T1,T2,T3,T4,T7').split(',');

async function loadPuppeteer() {
  try { return (await import('puppeteer')).default; } catch { /* keep looking */ }
  const candidates = [];
  if (process.env.PUPPETEER_DIR) candidates.push(process.env.PUPPETEER_DIR);
  const soft = path.join(os.homedir(), 'software');
  if (existsSync(soft)) {
    for (const d of await readdir(soft)) candidates.push(path.join(soft, d, 'node_modules', 'puppeteer'));
  }
  for (const c of candidates) {
    for (const p of [path.join(c, 'lib', 'esm', 'puppeteer', 'puppeteer.js'), c]) {
      try {
        if (!existsSync(p)) continue;
        const m = await import(pathToFileURL(p).href);
        const pp = m.default ?? m;
        if (pp && typeof pp.launch === 'function') return pp;
      } catch { /* next */ }
    }
  }
  throw new Error('puppeteer not found; set PUPPETEER_DIR');
}

const results = [];
function report(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'GREEN' : 'RED  '} ${name}  ${detail}`);
}

/* ------------------------------------------------------------------ T2 (fs) */
async function findDir(root, suffix) {           // the models page, located by its path suffix
  for (const e of await readdir(root, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(root, e.name);
    if (full.endsWith(path.sep + suffix)) return full;
    const hit = await findDir(full, suffix);
    if (hit) return hit;
  }
  return null;
}
async function t2() {
  const problems = [];
  const idxPath = path.join(DOCS, 'index.html');
  const modelsDir = await findDir(DOCS, path.join('critical-lines', 'models'));
  const modelsPath = path.join(modelsDir || DOCS, 'index.html');
  if (!modelsDir) problems.push('models page not found');
  const thumb = path.join(DOCS, 'art', 'thumbnails', 'ashkin-teller.svg');
  for (const f of [idxPath, modelsPath, thumb, path.join(HERE, 'index.html')]) {
    if (!existsSync(f)) problems.push('missing ' + path.relative(DOCS, f));
  }
  if (problems.length) return report('T2 links in', false, problems.join('; '));
  const idx = await readFile(idxPath, 'utf8');
  const cards = idx.match(/<a class="card" data-level="0" href="ashkin-teller\/">[\s\S]*?<\/a>/g) || [];
  if (cards.length !== 1) problems.push(`index cards for ashkin-teller/: ${cards.length} (want 1)`);
  else {
    const c = cards[0];
    if (!c.includes('src="art/thumbnails/ashkin-teller.svg"')) problems.push('card thumbnail src');
    if (!/card-title">Ashkin&ndash;Teller for the Working Mathematician <span class="card-tag tag-tutorial">Tutorial<\/span>/.test(c)) problems.push('card title/tag');
    if (!c.includes('class="card-desc"') || !c.includes('class="card-meta"')) problems.push('card-desc/card-meta');
  }
  const kt = idx.indexOf('href="kosterlitz-thouless/"'), at = idx.indexOf('href="ashkin-teller/"');
  if (!(kt >= 0 && at > kt)) problems.push('card not after the kosterlitz-thouless card');
  const entries = idx.match(/\{level:0, path:'ashkin-teller\/'[^}]*\}/g) || [];
  if (entries.length !== 1) problems.push(`search entries: ${entries.length} (want 1)`);
  const models = await readFile(modelsPath, 'utf8');
  const s1 = models.slice(models.indexOf('<section id="1-'), models.indexOf('<section id="2-'));
  const hrefs = [...s1.matchAll(/href="([^"#][^"]*)"/g)].map((m) => m[1]);
  const toAT = hrefs.filter((h) => path.resolve(path.dirname(modelsPath), h) === path.join(DOCS, 'ashkin-teller'));
  if (toAT.length !== 1) problems.push(`models §1 links resolving to docs/ashkin-teller/: ${toAT.length} (want 1)`);
  const allModelsLinks = [...models.matchAll(/href="([^"#][^"]*ashkin-teller[^"]*)"/g)];
  if (allModelsLinks.length !== 1) problems.push(`models page ashkin-teller links overall: ${allModelsLinks.length}`);
  report('T2 links in', problems.length === 0, problems.length ? problems.join('; ') : 'card, thumbnail, search entry and models link resolve');
}

/* --------------------------------------------------------- browser-side tests */
async function browserTests(browser) {
  if (!existsSync(PAGE)) {
    for (const t of ['T1', 'T3', 'T4', 'T7']) if (ONLY.includes(t)) report(t, false, 'page missing: ' + PAGE);
    return;
  }
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.setViewport({ width: 1280, height: 1024, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 300));
  if (errors.length) console.log('  page errors: ' + errors.join(' | '));

  if (ONLY.includes('T1')) {
    const r = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('a[href]').forEach((a) => {
        const h = a.getAttribute('href');
        if (!h.startsWith('#')) bad.push('href ' + h);
        else if (h.length < 2 || !document.getElementById(h.slice(1))) bad.push('dangling ' + h);
      });
      document.querySelectorAll('[src],[href]').forEach((el) => {
        for (const at of ['src', 'href']) {
          const v = el.getAttribute(at);
          if (v && /^(http|\/\/|\.\.\/)/i.test(v)) bad.push(el.tagName + ' ' + at + '=' + v);
        }
      });
      if (document.querySelector('link[rel~="stylesheet"]')) bad.push('link rel=stylesheet');
      if (document.querySelector('script[src]')) bad.push('script src');
      document.querySelectorAll('style').forEach((s) => {
        if (/@import/i.test(s.textContent)) bad.push('@import');
        if (/url\(\s*['"]?\s*(https?:|\/\/)/i.test(s.textContent)) bad.push('url(http');
      });
      return { bad, anchors: document.querySelectorAll('a[href]').length };
    });
    report('T1 no links out', r.bad.length === 0, r.bad.length ? r.bad.slice(0, 8).join('; ') : `${r.anchors} anchors, all in-page and resolving`);
  }

  if (ONLY.includes('T3')) {
    const r = await page.evaluate(() => {
      const at = window.__at; const bad = [];
      if (!at) return { bad: ['window.__at missing'] };
      const want = [[0, 0, 1e-9], [0.25, 0.2096, 5e-5], [0.5, 0.4182, 5e-5], [0.75, 0.6383, 5e-5], [1, 1, 1e-9]];
      const got = [];
      for (const [t, v, tol] of want) {
        const a = at.alphaNu(t); got.push(a);
        if (!(Math.abs(a - v) <= tol)) bad.push(`alphaNu(${t})=${a} want ${v}±${tol}`);
      }
      const k0 = at.KL(0), k1 = at.KL(1);
      if (!(Math.abs(k0.K - 0.44069) <= 5e-6)) bad.push('KL(0).K=' + k0.K);
      if (!(Math.abs(k0.L) <= 1e-12)) bad.push('KL(0).L=' + k0.L);
      if (!(Math.abs(k1.K - 0.27465) <= 5e-6 && Math.abs(k1.L - 0.27465) <= 5e-6)) bad.push(`KL(1)=${k1.K},${k1.L}`);
      for (let i = 0; i <= 10; i++) {
        const c = at.coords(i / 10);
        if (!(Math.abs(c.Z - (1 - 2 * c.X)) <= 1e-12)) bad.push(`coords(${i / 10}) off line by ${c.Z - (1 - 2 * c.X)}`);
      }
      return { bad, got, k0, k1 };
    });
    report('T3 exact numbers', r.bad.length === 0, r.bad.length ? r.bad.join('; ')
      : `alphaNu=${r.got.map((x) => x.toFixed(5)).join(',')}; KL(0)=(${r.k0.K.toFixed(6)},${r.k0.L.toExponential(1)}); KL(1)=(${r.k1.K.toFixed(6)},${r.k1.L.toFixed(6)}); 11 coords on Z=1-2X`);
  }

  if (ONLY.includes('T4')) {
    const r = await page.evaluate(() => {
      const mc = window.__mc;
      if (!mc) return { bad: ['window.__mc missing'] };
      const run = (t, f) => { mc.reset(1, t, f); mc.sweep(100); mc.sweep(300); return mc.stats(); };
      const cold = run(0.5, 0.85), hot = run(0.5, 1.15), potts = run(1, 1);
      const bad = [];
      if (!(cold.m2s > 0.5)) bad.push('f=0.85 <m_s^2>=' + cold.m2s);
      if (!(hot.m2s < 0.05)) bad.push('f=1.15 <m_s^2>=' + hot.m2s);
      const v = [potts.m2s, potts.m2t, potts.m2st];
      if (!(Math.max(...v) <= 2 * Math.min(...v))) bad.push('Potts means ' + v.join(','));
      return { bad, cold, hot, potts };
    });
    const f = (s) => s ? `σ²=${s.m2s.toFixed(4)} τ²=${s.m2t.toFixed(4)} στ²=${s.m2st.toFixed(4)} e=${s.e.toFixed(4)} sweeps=${s.sweeps}` : '';
    report('T4 Monte Carlo sanity', r.bad.length === 0, (r.bad.length ? r.bad.join('; ') + ' | ' : '') +
      `t=.5 f=.85 [${f(r.cold)}] · t=.5 f=1.15 [${f(r.hot)}] · t=1 f=1 [${f(r.potts)}]`);
  }

  if (ONLY.includes('T7')) {
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 300));
    const r = await page.evaluate(() => {
      document.querySelectorAll('details').forEach((d) => { d.open = false; });
      const h = document.documentElement.scrollHeight;
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('[data-wc="skip"], script, style').forEach((n) => n.remove());
      clone.querySelectorAll('details').forEach((d) => { d.open = false; });
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-20000px;top:0;width:900px;';
      host.appendChild(clone);
      document.body.appendChild(host);
      const words = (clone.innerText.match(/\S+/g) || []).length;
      host.remove();
      return { h, words };
    });
    report('T7 size', r.h <= 8200 && r.words <= 3000, `scrollHeight=${r.h} (≤8200), words=${r.words} (≤3000)`);
  }
  await page.close();
}

async function main() {
  if (ONLY.includes('T2')) await t2();
  if (ONLY.some((t) => ['T1', 'T3', 'T4', 'T7'].includes(t))) {
    const puppeteer = await loadPuppeteer();
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    try { await browserTests(browser); } finally { await browser.close().catch(() => {}); }
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} green`);
  return failed ? 1 : 0;
}
main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(2); });
