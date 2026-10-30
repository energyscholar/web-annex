// Plan 1339 smoke (env PUPPETEER_DIR, PLAN1339_SHOTS)
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { createHash } from 'crypto';
const require = createRequire(process.env.PUPPETEER_DIR + '/');
const puppeteer = require('puppeteer');
const HERE = path.dirname(fileURLToPath(import.meta.url)), SHOTS = process.env.PLAN1339_SHOTS;
let fails = 0;
const ok = (n, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'} ${n}${info ? ' · ' + info : ''}`); };
const near = (a, b) => a === b || (Array.isArray(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9));
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const noise = [], N = m => noise.push(m);
try {
  const p = await b.newPage();
  p.on('pageerror', e => N('pageerror ' + e.message));
  p.on('console', m => { if (/^(error|warn|warning)$/.test(m.type())) N(m.type() + ' ' + m.text()); });
  p.on('requestfailed', r => N('requestfailed ' + r.url()));
  await p.setViewport({ width: 1280, height: 1024 });
  await p.evaluateOnNewDocument(() => { window.Q$ = s => document.querySelectorAll(s); window.G = i => document.getElementById(i); });
  await p.goto('file://' + path.join(HERE, 'index.html'), { waitUntil: 'load' });
  const ev = (f, ...a) => p.evaluate(f, ...a);

  const t = 1 / 3, I = (x, rhoBase, chi0, interior) => ({ x, rhoBase, chi0, interior }), X = [3, 1, 0], Y = [0, 1, 3];
  const D0 = { A: [2, 1], B: [3, 1], rho: [t, t], R: [3 + t, 0] };
  const CASES = [
    [I(X, .5, 1, true), { ...D0, Delta: null, Sigma: null }],
    [I(X, .5, 1, false), { B: null, R: null, Delta: [2, 1], Sigma: [2 + t, t] }],
    [I(Y, .5, 1, true), { A: [-1, -2], B: [-3, -2], rho: [.25, t], R: [-3.5, -1] }],
    [I(Y, .5, 1, false), { Delta: [-1, -2], Sigma: [-1.5, -2 + t] }],
    [I([4, 2, 1], .5, 1, true), D0],
    [I(X, .5, 5, true), { A: [2, 1], B: [3, 1], rho: [1 / 7, 1 / 7], R: [3 + 1 / 7, 4 / 7] }],
    [I(X, 0, 1, true), { rho: [0, 0], R: [3, 1], B: [3, 1] }],
    [I(X, 0, 1, false), { Sigma: [2, 1], Delta: [2, 1] }],
  ];
  const got = await ev(cs => cs.map(c => window.ABR_DEMO.compute(c[0])), CASES), bad = [];
  CASES.forEach(([, w], i) => Object.keys(w).forEach(k => { if (!near(got[i][k], w[k])) bad.push(`case${i}.${k}=${JSON.stringify(got[i][k])}`); }));
  ok('I1(a) compute to 1e-9', !bad.length, bad.join(' '));

  const set = (id, v) => ev((id, v) => { const e = G(id); e.value = String(v); e.dispatchEvent(new Event('input')); }, id, v);
  const row = k => ev(k => [...Q$(`#i1 td[data-k="${k}"]`)].map(td => td.textContent), k);
  const click = id => ev(id => G(id).click(), id);
  const all = async () => (await Promise.all(['A', 'B', 'rho', 'R'].map(row))).flat().join('|');

  await set('x0', 0); await set('x2', 3);
  const rb = await row('R');
  ok('I1(b) R cells', rb.join() === '−3.500,−1.000', rb.join(' '));
  await click('reset');
  await ev(() => { const c = G('interior'); c.checked = false; c.dispatchEvent(new Event('change')); });
  const bc = await row('B'), sc = await row('R'), rl = await p.$eval('#kR', e => e.textContent);
  ok('I1(c) unticked: B not evaluated, Σ shown', bc.every(s => s === 'not evaluated') && rl === 'Σ' && sc.join() === '2.333,0.333', `${bc} ${rl} ${sc}`);
  await click('reset');
  const before = await all(); await click('shift');
  const lab = await ev(() => [0, 1, 2].map(i => G('i1n' + i).textContent).join());
  ok('I1(d) +1 changes no number', before === await all() && lab === '4,2,1', lab);
  ok('I1(e) χ₀ min is 0.1', (await p.$eval('#c0', e => e.getAttribute('min'))) === '0.1');
  const dis = () => p.$eval('#shift', e => e.disabled);
  await click('reset'); await set('x0', 5);
  const d5 = await dis();
  await set('x0', 4);
  ok('I1(f) +1 disabled iff x>4', d5 && !(await dis()));
  await click('reset');
  const lbl = id => p.$eval('#' + id, e => e.getAttribute('role') === 'img' && !!e.getAttribute('aria-label'));
  ok('I1(h) SVG role=img + aria-label', await lbl('i1svg'));

  const Q = await ev(() => {
    const R = window.ABR_DEMO.ROWS, ch = [...Q$('#i2 .chip')], card = G('i2card');
    const o = { n: R.length, ch: ch.length, btn: ch.every(c => c.tagName === 'BUTTON'), bad: [], hrv: '', eq: [] };
    ch.forEach((c, i) => {
      c.click(); const s = card.innerText, r = R[+c.dataset.i];
      if (![r.symbol, r.name, r.critical].every(v => s.includes(v))) o.bad.push(i);
      if (r.domain === 'HRV') o.hrv = s;
      if (s.includes('fGn/fBm') && s.includes('α = H + 1')) o.eq.push(r.domain);
    });
    const tr = [...Q$('#rowsTab tr[data-row]')];
    o.rows = tr.length;
    o.cells = tr.every((e, i) => ['domain', 'symbol', 'name', 'measures', 'critical', 'category'].every((k, j) => e.cells[j].textContent === R[i][k]));
    o.view = G('i2view').innerText;
    o.links = [...Q$('#acc-domains a[href^="../"]')].map(a => a.getAttribute('href'));
    return o;
  });
  ok('I2(a) ten chips fill the card', Q.ch === 10 && Q.n === 10 && !Q.bad.length, Q.bad.join());
  ok('I2(b) HRV card: "away from criticality"', Q.hrv.includes('away from criticality'));
  ok('I2(c) α = H line on DFA and Finance only', Q.eq.join() === 'DFA,Finance', Q.eq.join());
  await p.focus('#i2 .chip[data-i="5"]'); await p.keyboard.press('Enter');
  ok('I2(e) chips are buttons; Enter activates', Q.btn && await p.$eval('#i2card', e => e.innerText.includes('Short-term DFA')));
  ok('I2(f) curve SVG labelled', await lbl('i2svg'));
  ok('5.3 table = ROWS', Q.rows === Q.n && Q.cells, `${Q.rows} rows`);
  ok('5.3 go-deeper links on disk', Q.links.length === 2 && Q.links.every(h => fs.existsSync(path.join(HERE, h, 'index.html'))), Q.links.join(' '));

  const r7 = await ev(() => {
    Q$('details').forEach(d => { d.open = false; });
    const c = document.body.cloneNode(true);
    c.querySelectorAll('[data-interactive], script, style').forEach(e => e.remove());
    c.style.cssText = 'position:absolute;left:-99999px'; document.documentElement.appendChild(c);
    const w = (c.innerText.match(/\S+/g) || []).filter(x => /[\p{L}\p{N}]/u.test(x)).length;
    c.remove(); return { h: document.documentElement.scrollHeight, w };
  });
  ok('R7 scrollHeight ≤ 2200', r7.h <= 2200, `${r7.h} px`);
  ok('R7 visible words ≤ 450', r7.w <= 450, `${r7.w} words`);

  const full = await ev(() => { Q$('details').forEach(d => { d.open = true; }); return document.body.innerText; });
  ok('I2(d) coincidence; convergen* only in title', Q.view.includes('coincidence') &&
    !/convergen/i.test(full.split('Convergent Discovery of Critical Phenomena Mathematics Across Disciplines').join('')));
  const ph = full.match(/coming soon|placeholder|TODO|TBD|lorem/gi);
  ok('R9 no placeholder text', !ph, ph ? ph.join() : '');
  const bs = full.split(/(?<=[.!?])\s+|\n+/).filter(s => /arXiv|preprint|Convergent Discovery|FACETS|Stephenson/.test(s) && /accepted|published in|under review/i.test(s));
  ok('R3 no paper-status claim', !bs.length, bs.join(' // '));
  const nm = await p.$$eval('[data-onename]', e => e.map(x => x.textContent));
  ok('R1a lineage name once (sha256-checked)', nm.length === 1 && createHash('sha256').update(nm[0]).digest('hex').startsWith('996800b39e0d4649') && full.split(nm[0]).length === 2);

  if (SHOTS) {
    for (const id of ['g1', 'g2', 'g3', 'g4', 'i1svg', 'i2svg']) { const e = await p.$('#' + id); if (e) await e.screenshot({ path: `${SHOTS}/${id}.png` }); }
    const th = await b.newPage(); await th.setViewport({ width: 560, height: 160 });
    await th.goto('file://' + path.join(HERE, '../art/thumbnails/criticality-math-kernel.svg'));
    await th.screenshot({ path: `${SHOTS}/thumbnail.png` }); await th.close();
    await ev(() => Q$('details').forEach(d => { d.open = false; }));
    await p.setViewport({ width: 380, height: 800 });
    await p.screenshot({ path: `${SHOTS}/page-380.png`, fullPage: true });
    console.log(`shots → ${SHOTS}`);
  }
  ok('I1(g) no console noise', !noise.length, noise.join(' | '));
} finally { await b.close(); }
console.log(fails ? `FAIL ${fails}` : 'ALL PASS');
process.exit(fails ? 1 : 0);
