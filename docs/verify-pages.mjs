#!/usr/bin/env node
/**
 * verify-pages.mjs — render every page under docs/ in a headless browser and
 * report the four things that have actually broken pages in this repo before.
 *
 *   1. uncaught JS errors (pageerror + console.error)
 *   2. failed resource loads (a missing script or image)
 *   3. any <svg> that carries neither role+aria-label nor aria-hidden="true"
 *   4. horizontal overflow of <body> at a 380 px viewport
 *   5. (--motion, on by default) autoplay that keeps running when the reader
 *      has asked for prefers-reduced-motion: reduce
 *
 * There is no build step and no package.json in this repo on purpose. Puppeteer
 * is resolved from wherever it already exists on the machine:
 *
 *     PUPPETEER_DIR=/path/to/node_modules/puppeteer node docs/verify-pages.mjs
 *
 * ...or, with nothing set, from a sibling checkout under ~/software/<x>/node_modules.
 *
 * Usage:
 *   node docs/verify-pages.mjs                  # compare against the committed baseline
 *   node docs/verify-pages.mjs --write-baseline # record the current state as the baseline
 *   node docs/verify-pages.mjs --strict         # ignore the baseline; any failure is a failure
 *   node docs/verify-pages.mjs --no-motion      # skip the reduced-motion pass (faster)
 *   node docs/verify-pages.mjs --only skeletons # substring filter on the page path
 *
 * Exit code is non-zero when there is any failure not present in the baseline
 * (or, under --strict, any failure at all).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = HERE;
const REPO = path.resolve(HERE, '..');
const BASELINE = path.join(DOCS, '.verify-baseline.json');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const WRITE_BASELINE = has('--write-baseline');
const STRICT = has('--strict');
const CHECK_MOTION = !has('--no-motion');
const ONLY = valOf('--only');
const CONCURRENCY = Number(valOf('--jobs') || 4);

/* Timeouts. page.evaluate and page.screenshot have NO default timeout in
   puppeteer — an unset one turns a failure into what looks like a hang. */
const NAV_TIMEOUT = 30_000;
const EVAL_TIMEOUT = 20_000;
const MOTION_SETTLE_MS = 1200;   // let first paint / one-shot renders finish
const MOTION_SAMPLES = 4;        // then take this many frame signatures...
const MOTION_GAP_MS = 900;       // ...this far apart,
const MOTION_MIN_CHANGES = 2;    // and call it animation only if this many intervals move.

/* ---------------------------------------------------------------- puppeteer */

async function loadPuppeteer() {
  try { return (await import('puppeteer')).default; } catch { /* keep looking */ }

  const candidates = [];
  if (process.env.PUPPETEER_DIR) candidates.push(process.env.PUPPETEER_DIR);
  const soft = path.join(os.homedir(), 'software');
  if (existsSync(soft)) {
    for (const d of await readdir(soft)) {
      candidates.push(path.join(soft, d, 'node_modules', 'puppeteer'));
    }
  }
  for (const c of candidates) {
    const entry = path.join(c, 'lib', 'esm', 'puppeteer', 'puppeteer.js');
    for (const p of [entry, c]) {
      try {
        if (!existsSync(p)) continue;
        const m = await import(pathToFileURL(p).href);
        const pp = m.default ?? m;
        if (pp && typeof pp.launch === 'function') {
          console.log(`  (puppeteer from ${c})`);
          return pp;
        }
      } catch { /* next */ }
    }
  }
  throw new Error(
    'puppeteer not found. Set PUPPETEER_DIR=/path/to/node_modules/puppeteer, ' +
    'or install puppeteer somewhere under ~/software/*/node_modules.'
  );
}

/* --------------------------------------------------------------- page walk */

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await htmlFiles(full));
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

/* --------------------------------------------------------------- the checks */

const SVG_AUDIT = `(() => {
  const bad = [];
  document.querySelectorAll('svg').forEach((s, i) => {
    if (s.getAttribute('aria-hidden') === 'true') return;
    if (s.closest('[aria-hidden="true"]')) return;
    const role = s.getAttribute('role');
    const label = s.getAttribute('aria-label') || s.getAttribute('aria-labelledby');
    const title = s.querySelector(':scope > title');
    if (role === 'img' && (label || title)) return;
    const id = s.id || s.getAttribute('class') || ('svg#' + i);
    bad.push(String(id).slice(0, 60) + (role ? '' : ' [no role]') + (label || title ? '' : ' [no label]'));
  });
  return bad;
})()`;

const OVERFLOW = `(() => {
  const de = document.documentElement;
  return { scrollWidth: Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0),
           innerWidth: window.innerWidth };
})()`;

const SCROLL_SWEEP = `(async () => {
  const h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  for (let y = 0; y < h; y += Math.floor(window.innerHeight * 0.6)) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 120));
  return h;
})()`;

const SNAPSHOT = `(() => {
  // A cheap fingerprint of everything that an animation would move: element
  // count, all text, and the geometry-bearing attributes of SVG children.
  let s = '';
  document.querySelectorAll('svg *').forEach(n => {
    for (const a of ['d','cx','cy','x','y','x1','y1','x2','y2','points','transform','r','width','height','opacity','fill','stroke','stroke-dashoffset']) {
      const v = n.getAttribute(a);
      if (v !== null) s += a + v + '|';
    }
  });
  s += document.body ? document.body.innerText.replace(/\\s+/g, ' ') : '';
  let h = 5381;
  for (let i = 0; i < s.length; i++) { h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; }
  return h.toString(16) + ':' + s.length;
})()`;

async function checkPage(browser, file) {
  const rel = path.relative(REPO, file);
  const url = pathToFileURL(file).href;
  const fail = { jsErrors: [], resources: [], svg: [], overflow: null, motion: null };

  const page = await browser.newPage();
  page.setDefaultTimeout(EVAL_TIMEOUT);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);

  page.on('pageerror', (e) => fail.jsErrors.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') fail.jsErrors.push('console: ' + m.text().slice(0, 200));
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('chrome-extension:')) return;
    fail.resources.push(path.basename(u.split('?')[0]) + ' — ' + (r.failure()?.errorText || 'failed'));
  });

  try {
    await page.setViewport({ width: 380, height: 900, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    await new Promise((r) => setTimeout(r, 400));

    const ov = await page.evaluate(OVERFLOW);
    if (ov.scrollWidth > ov.innerWidth + 1) {
      fail.overflow = `${ov.scrollWidth}px content in a ${ov.innerWidth}px viewport`;
    }

    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
    fail.svg = await page.evaluate(SVG_AUDIT);
  } catch (e) {
    fail.jsErrors.push('HARNESS: ' + String(e.message).slice(0, 200));
  } finally {
    await page.close().catch(() => {});
  }

  if (CHECK_MOTION) {
    const p2 = await browser.newPage();
    p2.setDefaultTimeout(EVAL_TIMEOUT);
    p2.setDefaultNavigationTimeout(NAV_TIMEOUT);
    try {
      await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await p2.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
      await p2.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
      /* Most animations here are gated on an IntersectionObserver, so a page
         that is never scrolled never starts them and the check would pass
         vacuously. Sweep the whole page, then come back to the top. */
      await p2.evaluate(SCROLL_SWEEP);
      await new Promise((r) => setTimeout(r, MOTION_SETTLE_MS));
      /* A single before/after comparison cannot tell a running animation from a
         one-shot settle — a lazy render finishing, a font swapping, a counter
         ticking once. Both look like "the page changed". Sample several times
         instead and require the change to be SUSTAINED: an animation moves in
         every interval, a settle moves in exactly one. Without this the check
         fires at random and a gate that fails at random is worse than none. */
      const sig = [];
      for (let i = 0; i < MOTION_SAMPLES; i++) {
        if (i) await new Promise((r) => setTimeout(r, MOTION_GAP_MS));
        sig.push(await p2.evaluate(SNAPSHOT));
      }
      let changes = 0;
      for (let i = 1; i < sig.length; i++) if (sig[i] !== sig[i - 1]) changes++;
      if (changes >= MOTION_MIN_CHANGES) {
        fail.motion = `still animating under prefers-reduced-motion: ${changes}/${sig.length - 1} ` +
          `intervals moved (${sig.join(' -> ')})`;
      }
    } catch (e) {
      fail.motion = 'HARNESS: ' + String(e.message).slice(0, 200);
    } finally {
      await p2.close().catch(() => {});
    }
  }

  const n = fail.jsErrors.length + fail.resources.length + fail.svg.length +
            (fail.overflow ? 1 : 0) + (fail.motion ? 1 : 0);
  return { page: rel, count: n, ...fail };
}

/* -------------------------------------------------------------------- main */

async function main() {
  const puppeteer = await loadPuppeteer();
  let files = await htmlFiles(DOCS);
  if (ONLY) files = files.filter((f) => f.includes(ONLY));
  console.log(`verify-pages: ${files.length} pages, motion check ${CHECK_MOTION ? 'on' : 'off'}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  const results = [];
  try {
    const queue = files.slice();
    const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, async () => {
      for (;;) {
        const f = queue.shift();
        if (!f) return;
        const r = await checkPage(browser, f);
        results.push(r);
        process.stdout.write(r.count === 0 ? '.' : 'X');
      }
    });
    await Promise.all(workers);
  } finally {
    await browser.close().catch(() => {});   // kill every browser, including on error
  }

  results.sort((a, b) => a.page.localeCompare(b.page));
  process.stdout.write('\n\n');

  const failing = results.filter((r) => r.count > 0);
  for (const r of failing) {
    console.log(`FAIL ${r.page}`);
    for (const e of r.jsErrors) console.log(`   js       ${e}`);
    for (const e of r.resources) console.log(`   resource ${e}`);
    for (const e of r.svg) console.log(`   svg      unlabelled: ${e}`);
    if (r.overflow) console.log(`   overflow ${r.overflow}`);
    if (r.motion) console.log(`   motion   ${r.motion}`);
  }

  const totals = {
    pages: results.length,
    failingPages: failing.length,
    jsErrors: results.reduce((a, r) => a + r.jsErrors.length, 0),
    resources: results.reduce((a, r) => a + r.resources.length, 0),
    unlabelledSvg: results.reduce((a, r) => a + r.svg.length, 0),
    overflow: results.filter((r) => r.overflow).length,
    motion: results.filter((r) => r.motion).length,
  };
  console.log(`\n${results.length} pages · ${failing.length} failing · ` +
    `${totals.jsErrors} js · ${totals.resources} resource · ` +
    `${totals.unlabelledSvg} unlabelled svg · ${totals.overflow} overflow · ${totals.motion} motion`);

  /* a page's failure signature, for baseline comparison */
  const sig = (r) => ({
    js: r.jsErrors.length, res: r.resources.length, svg: r.svg.length,
    ovf: r.overflow ? 1 : 0, mot: r.motion ? 1 : 0,
  });
  const current = {};
  for (const r of failing) current[r.page] = sig(r);

  if (WRITE_BASELINE) {
    await writeFile(BASELINE, JSON.stringify(
      { recorded: new Date().toISOString().slice(0, 10), totals, pages: current }, null, 2) + '\n');
    console.log(`\nbaseline written to ${path.relative(REPO, BASELINE)}`);
    return 0;
  }

  if (STRICT) return failing.length ? 1 : 0;

  let base = null;
  try { base = JSON.parse(await readFile(BASELINE, 'utf8')); } catch { /* none */ }
  if (!base) {
    console.log('\nno baseline recorded — treating every failure as new');
    return failing.length ? 1 : 0;
  }

  const regressions = [];
  for (const [p, s] of Object.entries(current)) {
    const b = base.pages[p];
    if (!b) { regressions.push(`${p}: newly failing`); continue; }
    for (const k of Object.keys(s)) {
      if (s[k] > (b[k] || 0)) regressions.push(`${p}: ${k} ${b[k] || 0} -> ${s[k]}`);
    }
  }
  const fixed = Object.keys(base.pages).filter((p) => !current[p]);

  console.log(`\nbaseline ${base.recorded}: ${Object.keys(base.pages).length} failing pages`);
  if (fixed.length) console.log(`fixed since baseline: ${fixed.join(', ')}`);
  if (regressions.length) {
    console.log('\nREGRESSIONS against baseline:');
    for (const r of regressions) console.log('  ' + r);
    return 1;
  }
  console.log('no regressions against baseline');
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(2); });
