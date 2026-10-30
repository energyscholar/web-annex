// Plan 1339 smoke: node docs/criticality-math-kernel/smoke.mjs (PUPPETEER_DIR, PLAN1339_SHOTS set)
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(process.env.PUPPETEER_DIR + '/');
const puppeteer = require('puppeteer');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL = 'file://' + path.join(HERE, 'index.html');
const SHOTS = process.env.PLAN1339_SHOTS;
let fails = 0;
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${info ? ' · ' + info : ''}`); };
const near = (a, b) => (a === null && b === null) || (Array.isArray(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9));

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const noise = [];
try {
  const p = await b.newPage();
  p.on('pageerror', e => noise.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') noise.push(m.type() + ' ' + m.text()); });
  p.on('requestfailed', r => noise.push('requestfailed ' + r.url()));
  await p.setViewport({ width: 1280, height: 1024 });
  await p.goto(URL, { waitUntil: 'load' });

  // ---- §3.1 Interactive 1 ----
  const t = 1 / 3;
  const CASES = [
    [{ x: [3, 1, 0], rhoBase: .5, chi0: 1, interior: true }, { A: [2, 1], B: [3, 1], rho: [t, t], R: [3 + t, 0], Delta: null, Sigma: null }],
    [{ x: [3, 1, 0], rhoBase: .5, chi0: 1, interior: false }, { B: null, R: null, Delta: [2, 1], Sigma: [2 + t, t] }],
    [{ x: [0, 1, 3], rhoBase: .5, chi0: 1, interior: true }, { A: [-1, -2], B: [-3, -2], rho: [.25, t], R: [-3.5, -1] }],
    [{ x: [0, 1, 3], rhoBase: .5, chi0: 1, interior: false }, { Delta: [-1, -2], Sigma: [-1.5, -2 + t] }],
    [{ x: [4, 2, 1], rhoBase: .5, chi0: 1, interior: true }, { A: [2, 1], B: [3, 1], rho: [t, t], R: [3 + t, 0] }],
    [{ x: [3, 1, 0], rhoBase: .5, chi0: 5, interior: true }, { A: [2, 1], B: [3, 1], rho: [1 / 7, 1 / 7], R: [3 + 1 / 7, 1 - 3 / 7] }],
    [{ x: [3, 1, 0], rhoBase: 0, chi0: 1, interior: true }, { rho: [0, 0], R: [3, 1], B: [3, 1] }],
    [{ x: [3, 1, 0], rhoBase: 0, chi0: 1, interior: false }, { Sigma: [2, 1], Delta: [2, 1] }],
  ];
  const got = await p.evaluate(cs => cs.map(c => window.ABR_DEMO.compute(c[0])), CASES);
  const bad = [];
  CASES.forEach(([, want], i) => Object.keys(want).forEach(k => { if (!near(got[i][k], want[k])) bad.push(`case${i}.${k}=${JSON.stringify(got[i][k])}`); }));
  ok('I1(a) compute matches the assertion table to 1e-9', bad.length === 0, bad.join(' '));

  const set = (id, v) => p.evaluate((id, v) => { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input')); }, id, v);
  const row = k => p.evaluate(k => [...document.querySelectorAll(`#i1 td[data-k="${k}"]`)].map(td => td.textContent), k);
  const click = id => p.evaluate(id => document.getElementById(id).click(), id);
  const allRows = async () => [await row('A'), await row('B'), await row('rho'), await row('R')].flat().join('|');

  await set('x0', 0); await set('x2', 3);
  const rb = await row('R');
  ok('I1(b) x=[0,1,3] renders R −3.500, −1.000', rb[0] === '−3.500' && rb[1] === '−1.000', rb.join(' '));

  await click('reset');
  await p.evaluate(() => { const c = document.getElementById('interior'); c.checked = false; c.dispatchEvent(new Event('change')); });
  const bc = await row('B'), sc = await row('R'), rl = await p.$eval('#kR', e => e.textContent);
  ok('I1(c) unticked: B not evaluated, Σ 2.333/0.333', bc.every(s => s === 'not evaluated') && rl === 'Σ' && sc[0] === '2.333' && sc[1] === '0.333', `${bc} ${rl} ${sc}`);

  await click('reset');
  const before = await allRows();
  await click('shift');
  const after = await allRows();
  const labels = await p.evaluate(() => [0, 1, 2].map(i => document.getElementById('i1n' + i).textContent).join(','));
  ok('I1(d) +1 leaves every number unchanged; labels 4,2,1', before === after && labels === '4,2,1', labels);

  ok('I1(e) χ₀ slider min is 0.1', (await p.$eval('#c0', e => e.getAttribute('min'))) === '0.1');

  await click('reset'); await set('x0', 5);
  const d5 = await p.$eval('#shift', e => e.hasAttribute('disabled'));
  await set('x0', 4);
  const d4 = await p.$eval('#shift', e => e.hasAttribute('disabled'));
  ok('I1(f) +1 disabled at x0=5, enabled at x0=4', d5 && !d4);
  await click('reset');

  const svg = await p.$eval('#i1svg', e => [e.getAttribute('role'), e.getAttribute('aria-label')]);
  ok('I1(h) interactive SVG has role=img and aria-label', svg[0] === 'img' && !!svg[1]);

  // ---- page-wide rules ----
  const r7 = await p.evaluate(() => {
    document.querySelectorAll('details').forEach(d => { d.open = false; });
    const hidden = [...document.querySelectorAll('[data-interactive]')];
    hidden.forEach(e => { e.dataset.vis = e.style.visibility; e.style.visibility = 'hidden'; });
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('[data-interactive], script, style').forEach(e => e.remove());
    clone.style.position = 'absolute'; clone.style.left = '-99999px'; document.documentElement.appendChild(clone);
    const words = (clone.innerText.match(/\S+/g) || []).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
    clone.remove(); hidden.forEach(e => { e.style.visibility = e.dataset.vis; });
    return { h: document.documentElement.scrollHeight, words };
  });
  ok('R7 scrollHeight ≤ 2200 at 1280×1024, details closed', r7.h <= 2200, `${r7.h} px`);
  ok('R7 visible words ≤ 450 (interactives excluded)', r7.words <= 450, `${r7.words} words`);

  const full = await p.evaluate(() => { document.querySelectorAll('details').forEach(d => { d.open = true; }); return document.body.innerText; });
  const ph = full.match(/coming soon|placeholder|TODO|TBD|lorem/gi);
  ok('R9 no placeholder text', !ph, ph ? ph.join(',') : '');
  const badSent = full.split(/(?<=[.!?])\s+|\n+/).filter(s => /arXiv|preprint|Convergent Discovery|FACETS|Stephenson/.test(s) && /accepted|published in|under review/i.test(s));
  ok('R3 no paper-status claim in a paper sentence', badSent.length === 0, badSent.join(' // '));

  // ---- screenshots (inspected by eye; never committed) ----
  if (SHOTS) {
    for (const id of ['g1', 'g2', 'g3', 'g4', 'i1svg', 'i2svg']) { const e = await p.$('#' + id); if (e) await e.screenshot({ path: `${SHOTS}/${id}.png` }); }
    const th = await b.newPage(); await th.setViewport({ width: 560, height: 160 });
    await th.goto('file://' + path.join(HERE, '../art/thumbnails/criticality-math-kernel.svg'));
    await th.screenshot({ path: `${SHOTS}/thumbnail.png` }); await th.close();
    await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = false; }));
    await p.setViewport({ width: 380, height: 800 });
    await p.screenshot({ path: `${SHOTS}/page-380.png`, fullPage: true });
    console.log(`shots → ${SHOTS}`);
  }
  ok('I1(g) no console error/warning, page error or failed request', noise.length === 0, noise.join(' | '));
} finally { await b.close(); }
console.log(fails ? `FAIL ${fails}` : 'ALL PASS');
process.exit(fails ? 1 : 0);
