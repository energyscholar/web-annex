#!/usr/bin/env node
/**
 * jumps-selftest.mjs — model truth and determinism checks for
 * docs/diamond-node/jumps-and-critical-lines/{index,navigator}.html
 *
 *     PUPPETEER_DIR=/path/to/node_modules/puppeteer node docs/js/jumps-selftest.mjs
 *
 * Opens each page via file://, calls window.__tutorialSelfTest(), and checks the
 * numbers against closed-form truth for the Schlogl cubic. The closed form lives
 * HERE only; the pages' procedures never see it. Prints PASS/FAIL per line and
 * exits 1 on any FAIL.
 */
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '..', 'diamond-node', 'jumps-and-critical-lines');

async function loadPuppeteer() {
  try { return (await import('puppeteer')).default; } catch { /* keep looking */ }
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
        if (pp && typeof pp.launch === 'function') return pp;
      } catch { /* next */ }
    }
  }
  throw new Error('puppeteer not found; set PUPPETEER_DIR=/path/to/node_modules/puppeteer');
}

/* ---- closed-form truth (hidden from the pages) ----
   x' = a x^2 - x^3 + b - x.  u = x - a/3:  u^3 - mu u - nu = 0 with
   mu = a^2/3 - 1, nu = b + 2a^3/27 - a/3. Folds at nu = +-2 (mu/3)^(3/2). */
const MU = (a) => a * a / 3 - 1;
const NU = (a, b) => b + 2 * a ** 3 / 27 - a / 3;
const bFold = (a, s) => s * 2 * Math.pow(MU(a) / 3, 1.5) - 2 * a ** 3 / 27 + a / 3; /* b where nu = s*2(mu/3)^1.5 */
function solveA(s, b) { /* bisection on a in (sqrt3, 3) for bFold(a,s) = b */
  let lo = Math.sqrt(3) + 1e-9, hi = 3;
  const g = (a) => bFold(a, s) - b;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if ((g(m) < 0) === (g(lo) < 0)) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const A_STAR = Math.sqrt(3), B_STAR = 1 / (3 * Math.sqrt(3));

let failures = 0;
const check = (name, ok, detail) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };

const puppeteer = await loadPuppeteer();
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
try {
  /* ---------------- entry page ---------------- */
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message)));
    await page.goto(pathToFileURL(path.join(DIR, 'index.html')).href, { waitUntil: 'load' });
    const r = await page.evaluate(() => window.__tutorialSelfTest());

    /* 1: the two jumps against the closed-form folds at b = 0.12.
       Upward jump: the low branch dies at the fold with nu = -2(mu/3)^1.5 ... sign chosen by bisection range below. */
    const fa = solveA(1, 0.12), fb = solveA(-1, 0.12);
    const aUpTrue = Math.max(fa, fb), aDnTrue = Math.min(fa, fb);
    check('1 up-jump a_eff', Math.abs(r.p1.aUp - aUpTrue) <= 0.02, `page ${r.p1.aUp.toFixed(4)} (c=${r.p1.cUp.toFixed(3)}) vs fold ${aUpTrue.toFixed(4)}`);
    check('1 down-jump a_eff', Math.abs(r.p1.aDown - aDnTrue) <= 0.02, `page ${r.p1.aDown.toFixed(4)} (c=${r.p1.cDown.toFixed(3)}) vs fold ${aDnTrue.toFixed(4)}`);

    /* 2: lambda1 monotone toward 0 over the last 10 steps before each jump; |lambda1| < 0.15 at the last */
    for (const [nm, l] of [['up', r.p1.lamUp], ['down', r.p1.lamDown]]) {
      const mono = l.every((v, i) => !i || Math.abs(v) < Math.abs(l[i - 1]));
      check(`2 slowing before ${nm}-jump`, l.length === 10 && mono && Math.abs(l[9]) < 0.15,
        `lambda1 = [${l.map((v) => v.toFixed(3)).join(', ')}]`);
    }

    /* 3: indicators, seeds 1-5 */
    for (const c of r.cases) {
      check(`3 case A seed ${c.seed}`, c.A.dAC > 0.2 && c.A.varRatio > 2,
        `dAC1=${c.A.dAC.toFixed(3)} varRatio=${c.A.varRatio.toFixed(2)} tau=${c.A.tAC.toFixed(2)}/${c.A.tVar.toFixed(2)} reading=${c.A.reading} jumpAt=${(c.A.pre / c.A.n).toFixed(3)}`);
      check(`3 case B seed ${c.seed}`, Math.abs(c.B.dAC) < 0.1 && c.B.varRatio >= 0.6 && c.B.varRatio <= 1.6,
        `dAC1=${c.B.dAC.toFixed(3)} varRatio=${c.B.varRatio.toFixed(2)} tau=${c.B.tAC.toFixed(2)}/${c.B.tVar.toFixed(2)} reading=${c.B.reading}`);
    }

    /* 4: determinism */
    check('4 same seed identical', r.det.same, '');
    check('4 seed 1 vs 2 differ', r.det.differ, '');

    /* 5: RAF */
    check('5a hand fixture', r.raf.fixture === 'r1,r2', `maxRAF = {${r.raf.fixture}}`);
    check('5b f = 0 gives empty maxRAF', r.raf.zeroOK, '');
    check('5b all-catalyse gives maxRAF = R', r.raf.allOK, '');
    check('5c monotone along additions', r.raf.mono.every(Boolean), `seeds 1-3: ${r.raf.mono}`);
    check('5d |R|', r.raf.R5 === 196 && r.raf.R6 === 516, `n=5: ${r.raf.R5}, n=6: ${r.raf.R6}`);

    /* 6: the one conditional link */
    const links = await page.evaluate(() => {
      const all = [...document.querySelectorAll('a[href="navigator.html"]')];
      return { n: all.length, inA: all.filter((a) => a.closest('#case-a')).length, inB: all.filter((a) => a.closest('#case-b')).length,
        inNav: all.filter((a) => a.closest('.tutorial-nav, .footer-note')).length };
    });
    check('6 link only in case A', links.n === 1 && links.inA === 1 && links.inB === 0 && links.inNav === 0, JSON.stringify(links));

    /* 7: default ensemble wall time (synchronous core, then the chunked UI run) */
    const ui = await page.evaluate(() => new Promise((res) => {
      const t0 = performance.now();
      document.getElementById('p4-run').click();
      const poll = () => (typeof p4 !== "undefined" && !p4.busy && p4.res) ? res(performance.now() - t0) : setTimeout(poll, 20);
      setTimeout(poll, 20);
    }));
    check('7 default ensemble <= 3 s', r.ensemble.ms <= 3000 && ui <= 3000, `sync ${r.ensemble.ms.toFixed(0)} ms, UI ${ui.toFixed(0)} ms, jumps ${r.ensemble.jumps}`);
    check('entry page JS errors', errs.length === 0, errs.join(' | '));
    await page.close();
  }

  /* ---------------- line page ---------------- */
  {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message)));
    await page.goto(pathToFileURL(path.join(DIR, 'navigator.html')).href, { waitUntil: 'load' });
    const r = await page.evaluate(() => window.__tutorialSelfTest());
    const [lo, hi] = r.interval;
    check('8 end point contains sqrt3, width < 0.02', lo <= A_STAR && A_STAR <= hi && hi - lo < 0.02,
      `[${lo.toFixed(5)}, ${hi.toFixed(5)}] width ${(hi - lo).toFixed(5)}`);
    check('8 end point b', Math.abs(r.bEnd - B_STAR) <= 0.01, `b=${r.bEnd.toFixed(5)} vs ${B_STAR.toFixed(5)}`);
    check('9 exponent in [0.42, 0.58]', r.slope >= 0.42 && r.slope <= 0.58, `slope ${r.slope.toFixed(3)} from ${r.nFit} points`);
    check('10 probes <= 400', r.probes <= 400, `${r.probes} probes (other edge: ${r.edgeProbes})`);
    const nav = await page.evaluate(() => {
      const all = [...document.querySelectorAll('a[href="index.html"]')];
      const panel = document.getElementById('p3');
      const before = (x, y) => !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { n: all.length, crit: document.querySelectorAll('a[href*="critical-lines"]').length,
        topFirst: all.length > 0 && before(all[0], panel), bottomLast: all.length > 1 && before(panel, all[all.length - 1]) };
    });
    check('11 back links top and bottom, none to critical-lines', nav.n === 2 && nav.topFirst && nav.bottomLast && nav.crit === 0, JSON.stringify(nav));
    check('line page JS errors', errs.length === 0, errs.join(' | '));
    await page.close();
  }
} finally {
  await browser.close().catch(() => {});
}
console.log(failures ? `\n${failures} FAIL` : '\nall PASS');
process.exit(failures ? 1 : 0);
