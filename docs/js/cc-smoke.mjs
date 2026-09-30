#!/usr/bin/env node
/**
 * cc-smoke.mjs — headless checks of a critical-lines tutorial page, beyond verify-pages.mjs.
 *
 *   PUPPETEER_DIR=/path/to/node_modules/puppeteer node docs/js/cc-smoke.mjs <page.html> [--verbose]
 *
 * Serves docs/ over http://127.0.0.1:<port>/web-annex/ (so localStorage and the Path=/web-annex/
 * cookie behave as on the live site) and runs eight checks:
 *   (i)    every accordion starts closed; with all closed, each section.cc-sec shows a headline, a
 *          graphic registered in CC.graphics, and a CC takeaway (data-cc-exempt="graphic takeaway" opts out)
 *   (ii)   answer the first section-quiz item, reload, the mark is still there
 *   (iii)  localStorage and document.cookie throw: grading still works and the "not saved" notice shows
 *   (iv)   360 px viewport: no horizontal overflow; every canvas and graphic fits the viewport
 *   (v)    prefers-reduced-motion: no requestAnimationFrame loop running after 2 s idle
 *   (vi)   zero console errors, warnings and page errors from the page's own scripts
 *   (vii)  every task item's checker returns a boolean for its graphic's current state, without throwing
 *   (viii) final test taken twice: the item sets differ, and best and latest persist across a reload
 * A series landing (no section quizzes, no final) is checked in its own terms: (ii) and (iii) use the
 * first name-drill item, and (ii) reads the stored result after the reload (the drill starts a new round);
 * (viii) takes the combined test instead of a final.
 * Exit code 1 if any check fails.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith('--'));
const VERBOSE = argv.includes('--verbose');
if (!target) { console.error('usage: node docs/js/cc-smoke.mjs <page.html>'); process.exit(2); }
const abs = path.resolve(target);
if (!abs.startsWith(DOCS + path.sep) || !existsSync(abs)) { console.error('not a page under docs/: ' + target); process.exit(2); }
const REL = path.relative(DOCS, abs).split(path.sep).join('/');

async function loadPuppeteer() {
  const candidates = [];
  if (process.env.PUPPETEER_DIR) candidates.push(process.env.PUPPETEER_DIR);
  const soft = path.join(os.homedir(), 'software');
  if (existsSync(soft)) for (const d of await readdir(soft)) candidates.push(path.join(soft, d, 'node_modules', 'puppeteer'));
  for (const c of candidates) {
    for (const p of [path.join(c, 'lib', 'esm', 'puppeteer', 'puppeteer.js'), c]) {
      try {
        if (!existsSync(p)) continue;
        const m = await import(pathToFileURL(p).href);
        const pp = m.default ?? m;
        if (pp && typeof pp.launch === 'function') { console.log(`  (puppeteer from ${c})`); return pp; }
      } catch { /* next */ }
    }
  }
  throw new Error('puppeteer not found; set PUPPETEER_DIR=/path/to/node_modules/puppeteer');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (u === '/favicon.ico' || !u.startsWith('/web-annex/')) { res.writeHead(u === '/favicon.ico' ? 204 : 404); return res.end(); }
      let f = path.join(DOCS, u.slice('/web-annex/'.length));
      if (!f.startsWith(DOCS)) { res.writeHead(403); return res.end(); }
      if (f.endsWith('/') || (existsSync(f) && !path.extname(f))) f = path.join(f, 'index.html');
      try { const b = await readFile(f); res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(b); }
      catch { res.writeHead(404); res.end(); }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function record(key, pass, detail) { results.push({ key, pass, detail }); }

const BLOCK_STORAGE = `(() => {
  const boom = () => { throw new DOMException('blocked by the smoke test', 'SecurityError'); };
  Object.defineProperty(window, 'localStorage', { configurable: true, get: boom });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, get: boom });
  Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get: boom, set: boom });
})()`;
const COUNT_RAF = `(() => {
  window.__raf = 0;
  const o = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { window.__raf++; return o(cb); };
})()`;
const SCROLL_SWEEP = `(async () => {
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += Math.floor(innerHeight * 0.6)) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); }
  scrollTo(0, 0);
})()`;

async function main() {
  const puppeteer = await loadPuppeteer();
  const srv = await serve();
  const URL0 = `http://127.0.0.1:${srv.address().port}/web-annex/${REL}`;
  console.log(`cc-smoke: ${REL}\n`);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const newCtx = () => (browser.createBrowserContext ? browser.createBrowserContext() : browser.createIncognitoBrowserContext());
  const open = async (ctx, { width = 1200, pre = [], media = null } = {}) => {
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    /* Every error counts, the shared annex-tracker's included: a page error from any script fails (iii) and (vi). */
    const log = { errors: [] };
    page.on('pageerror', (e) => {
      const s = String(e.stack || e.message);
      const at = (s.match(/[\w.-]+\.js/) || [''])[0];
      log.errors.push('pageerror: ' + String(e.message).slice(0, 160) + (at ? ' @' + at : ''));
    });
    page.on('console', (m) => {
      if (m.type() !== 'error' && m.type() !== 'warn' && m.type() !== 'warning') return;
      const loc = (m.location && m.location().url) || '';
      log.errors.push(m.type() + ': ' + m.text().slice(0, 160) + (loc ? ' @' + loc.split('/').pop() : ''));
    });
    for (const p of pre) await page.evaluateOnNewDocument(p);
    if (media) await page.emulateMediaFeatures(media);
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.goto(URL0, { waitUntil: 'load' });
    await sleep(400);
    return { page, log };
  };

  try {
    /* ---------- (i), (ii), (vi), (vii), (viii) in one clean context */
    const ctx1 = await newCtx();
    let { page, log } = await open(ctx1, { pre: [COUNT_RAF] });
    const hasCC = await page.evaluate(() => !!(window.CC && (window.CC.page || window.CC._inited)));
    if (!hasCC) throw new Error('window.CC is missing or CC.init was not called');

    const r1 = await page.evaluate(() => {
      const openAtLoad = [...document.querySelectorAll('details')].filter((d) => d.open).map((d) => d.id || d.className);
      document.querySelectorAll('details').forEach((d) => { d.open = false; });
      const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' &&
        !(el.closest('details:not([open])') && !el.closest('summary'));
      const secs = [...document.querySelectorAll('section.cc-sec')];
      const bad = [], exempt = [];
      secs.forEach((s) => {
        const ex = (s.getAttribute('data-cc-exempt') || '').split(/\s+/);
        const miss = [];
        if (!vis(s.querySelector('.headline'))) miss.push('headline');
        if (!ex.includes('graphic')) {
          const g = [...s.querySelectorAll('.graphic')].find((x) => vis(x) && window.CC.graphics[x.getAttribute('data-cc-id')]);
          if (!g) miss.push('registered graphic');
        } else exempt.push(s.id + ':graphic');
        if (!ex.includes('takeaway')) { if (!vis(s.querySelector('.cc-takeaway'))) miss.push('takeaway'); } else exempt.push(s.id + ':takeaway');
        if (miss.length) bad.push(s.id + ' (' + miss.join(', ') + ')');
      });
      return { n: secs.length, bad, exempt, openAtLoad };
    });
    record('i', r1.n > 0 && !r1.bad.length && !r1.openAtLoad.length,
      `${r1.n} sections; missing: ${r1.bad.join('; ') || 'none'}; open at load: ${r1.openAtLoad.join(', ') || 'none'}; exempt: ${r1.exempt.join(', ') || 'none'}`);

    /* (ii) answer the first section-quiz item correctly, reload, still marked */
    const ANSWER = `(() => {
      let where = 'quiz', el = document.querySelector('[data-cc-quiz] .cc-item');
      if (!el) { where = 'names'; el = document.querySelector('[data-cc-names] .cc-item'); }
      if (!el) return { err: 'no section-quiz or name-drill item on the page' };
      const id = el.getAttribute('data-cc-item');
      let it = null, pg = null;
      for (const p in CC.banks) { const f = CC.banks[p].items.find((x) => x.id === id); if (f) { it = f; pg = p; } }
      if (it.type === 'mc') el.querySelector('input[value="' + it.answer + '"]').checked = true;
      else if (it.type === 'match') el.querySelectorAll('select').forEach((s, i) => { s.value = it.answer[i][1]; });
      el.querySelector('[data-cc-act="check"]').click();
      return { id, page: pg, where, type: it.type, status: el.getAttribute('data-cc-status') };
    })()`;
    const a1 = await page.evaluate(ANSWER);
    await page.reload({ waitUntil: 'load' }); await sleep(400);
    const a2 = a1.err ? {} : await page.evaluate((a) => {
      if (a.where === 'names') { const n = ((CC.store.state.pages[a.page] || {}).names || {})[a.id]; return { status: n ? (n.ok ? 'ok' : 'wrong') : null }; }
      const el = document.querySelector('[data-cc-quiz] [data-cc-item="' + a.id + '"]');
      return { status: el && el.getAttribute('data-cc-status') };
    }, a1);
    record('ii', !a1.err && a1.status === 'ok' && a2.status === 'ok',
      a1.err || `${a1.where === 'names' ? 'name-drill ' : ''}item ${a1.id} (${a1.type}) marked '${a1.status}' after Check, '${a2.status}' after reload`);

    /* (vii) every task item's checker returns a boolean */
    const r7 = await page.evaluate(() => {
      const b = CC.banks[CC.page], bad = [], okIds = [];
      (b ? b.items : []).filter((it) => it.type === 'task').forEach((it) => {
        const g = CC.graphics[it.graphic];
        if (!g) return bad.push(it.id + ': graphic ' + it.graphic + ' not registered');
        const fn = g.checks && g.checks[it.check];
        if (typeof fn !== 'function') return bad.push(it.id + ': checker ' + it.check + ' missing');
        try { const r = fn(g.state()); if (typeof r !== 'boolean') bad.push(it.id + ': returned ' + typeof r); else okIds.push(it.id); }
        catch (e) { bad.push(it.id + ': threw ' + e.message); }
      });
      return { bad, okIds };
    });
    record('vii', !r7.bad.length, `${r7.okIds.length} task checkers returned booleans${r7.bad.length ? '; ' + r7.bad.join('; ') : ''}`);

    /* (viii) the final test, twice */
    const TAKE = `(async () => {
      let kind = 'final', f = document.querySelector('[data-cc-final]');
      if (!f) { kind = 'combined'; f = document.querySelector('[data-cc-combined]'); }
      if (!f) return { err: 'no final or combined test on the page' };
      const act = (a) => { const b = f.querySelector('[data-cc-act="' + a + '"]'); if (!b) throw new Error('no ' + a + ' button'); b.click(); };
      act('start');
      const s1 = [...f.querySelectorAll('.cc-item')].map((e) => e.getAttribute('data-cc-item'));
      f.querySelectorAll('.cc-item').forEach((e) => { const i = e.querySelector('input[type=radio]'); if (i) i.checked = true; });
      act('submit');
      act('retake');
      const s2 = [...f.querySelectorAll('.cc-item')].map((e) => e.getAttribute('data-cc-item'));
      act('submit');
      return { kind, s1, s2, state: f.getAttribute('data-cc-state') };
    })()`;
    const t = await page.evaluate(TAKE);
    let r8 = {};
    if (!t.err) {
      await page.reload({ waitUntil: 'load' }); await sleep(400);
      r8 = await page.evaluate((kind) => { const f = (kind === 'combined' ? CC.store.state.combined : CC.store.get(CC.page).final) || {}; return { best: f.best, latest: f.latest, attempts: f.attempts, avail: CC.store.available }; }, t.kind);
    }
    const differ = !t.err && t.s1.slice().sort().join() !== t.s2.slice().sort().join();
    record('viii', !t.err && differ && t.s1.length > 0 && !!r8.best && !!r8.latest && r8.attempts >= 2,
      t.err || `${t.kind === 'combined' ? 'combined test: ' : ''}attempt 1 [${t.s1.join(', ')}] vs attempt 2 [${t.s2.join(', ')}] ${differ ? 'differ' : 'IDENTICAL'}; after reload best ${r8.best ? r8.best.score + '/' + r8.best.n : 'missing'}, latest ${r8.latest ? r8.latest.score + '/' + r8.latest.n : 'missing'}, attempts ${r8.attempts}`);

    const rafControl = await page.evaluate(() => window.__raf);
    await page.close();

    /* (vi) console hygiene over everything ctx1 did */
    record('vi', !log.errors.length, log.errors.length ? log.errors.slice(0, 6).join(' | ') : '0 errors, 0 warnings');
    await ctx1.close();

    /* ---------- (iii) both storages blocked */
    const ctx2 = await newCtx();
    ({ page, log } = await open(ctx2, { pre: [BLOCK_STORAGE] }));
    const b1 = await page.evaluate(ANSWER);
    const b2 = await page.evaluate(() => {
      const n = [...document.querySelectorAll('.cc-unsaved')].filter((e) => /not being saved/i.test(e.textContent));
      const visible = n.filter((e) => e.getClientRects().length > 0 && !e.closest('details:not([open])'));
      return { avail: CC.store.available, notices: n.length, visible: visible.length };
    });
    record('iii', !b1.err && b1.status === 'ok' && b2.avail === false && b2.visible > 0 && !log.errors.length,
      (b1.err || `item ${b1.id} graded '${b1.status}' with storage blocked`) + `; CC.store.available=${b2.avail}; "not saved" notices ${b2.notices} (${b2.visible} visible with accordions closed)` +
      (log.errors.length ? '; errors: ' + log.errors.slice(0, 3).join(' | ') : ''));
    await ctx2.close();

    /* ---------- (iv) 360 px */
    const ctx3 = await newCtx();
    ({ page, log } = await open(ctx3, { width: 360 }));
    const r4 = await page.evaluate(() => {
      const vw = window.innerWidth, sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const wide = [...document.querySelectorAll('canvas, .cc-graphic, .graphic')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > vw + 0.5 || r.right > vw + 0.5; })
        .map((e) => (e.getAttribute('data-cc-id') || e.tagName.toLowerCase()) + ' ' + Math.round(e.getBoundingClientRect().width) + 'px');
      return { vw, sw, wide, canvases: document.querySelectorAll('canvas').length };
    });
    record('iv', r4.sw <= r4.vw + 1 && !r4.wide.length, `scrollWidth ${r4.sw} in ${r4.vw}; ${r4.canvases} canvases; too wide: ${r4.wide.join(', ') || 'none'}`);
    await ctx3.close();

    /* ---------- (v) reduced motion */
    const ctx4 = await newCtx();
    ({ page, log } = await open(ctx4, { pre: [COUNT_RAF], media: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }));
    await page.evaluate(SCROLL_SWEEP);
    await sleep(2000);
    const c1 = await page.evaluate(() => window.__raf);
    await sleep(1000);
    const c2 = await page.evaluate(() => window.__raf);
    const runButtons = await page.evaluate(() => document.querySelectorAll('[data-cc-act="run"], [data-cc-act="play"]').length);
    record('v', c2 === c1 && runButtons === 0, `rAF calls ${c1} → ${c2} over 1 s after 2 s idle (control without reduced motion: ${rafControl}); Run/Play buttons shown: ${runButtons}`);
    await ctx4.close();

    /* in-browser self-test (information, not one of the eight) */
    const ctx5 = await newCtx();
    ({ page } = await open(ctx5));
    const st = await page.evaluate(() => CC.selftest().then((r) => r, (e) => ({ err: String(e) })));
    console.log(`  (in-browser CC.selftest(): ${st.err ? 'ERROR ' + st.err : st.pass + ' pass, ' + st.fail.length + ' fail'})`);
    await ctx5.close();
  } catch (e) {
    record('harness', false, String(e.stack || e).slice(0, 300));
  } finally {
    await browser.close().catch(() => {});
    srv.close();
  }

  const order = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'harness'];
  results.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'} (${r.key}) ${r.detail}`);
  }
  const missing = order.slice(0, 8).filter((k) => !results.find((r) => r.key === k));
  if (missing.length) { failed += missing.length; console.log('NOT RUN: ' + missing.join(', ')); }
  console.log(`\n${8 - Math.min(8, failed)}/8 checks passed`);
  if (VERBOSE) console.log(JSON.stringify(results, null, 1));
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
