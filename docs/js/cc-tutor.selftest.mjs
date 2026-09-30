#!/usr/bin/env node
/* cc-tutor.selftest.mjs — the self-test of the engine's pure core (docs/js/cc-tutor.js).
 *
 *   node docs/js/cc-tutor.selftest.mjs                 run against the engine beside this file
 *   node docs/js/cc-tutor.selftest.mjs --engine <path> run against another copy (used to see a test go red)
 *
 * The same suite runs in a browser console as CC.selftest() (it imports this module and calls run(CC)).
 * No dependencies. Exit 1 on any failure.
 */
export function suite(CC) {
  const { mulberry32, drawFinal, drawOnce, quizIds, allocate, grade, score, emptyState, encodeCookie, decodeCookie,
    compactRecord, mastery, exportText, blockOnce, nnCorr, integrate, signKey, SIGN_TABLE, SIGN_CELLS, TIERS,
    DEFAULT_STRATA, b64u } = CC.core;
  function synthBank(page, nsec, per) {
    var items = [], secs = [];
    for (var s = 0; s < nsec; s++) {
      secs.push('s' + s);
      for (var k = 0; k < per; k++) {
        var t = TIERS[(s + k) % 4];
        items.push({ id: page + '-' + s + '-' + k, section: 's' + s, tier: t, type: t === 'task' ? 'task' : 'mc', prompt: 'p', options: ['a', 'b', 'c', 'd'], answer: k % 4, cite: 'fn1' });
      }
    }
    return { page: page, sections: secs, items: items };
  }
  return [
    ['prng is deterministic', function (ok) { var a = mulberry32(7), b = mulberry32(7); ok(a() === b() && a() === b(), 'same seed'); ok(mulberry32(8)() !== mulberry32(7)(), 'different seed'); }],
    ['final draw is deterministic per attempt', function (ok) {
      var b = synthBank('t', 10, 8);
      ok(drawFinal(b, { n: 20, attempt: 3 }).join() === drawFinal(b, { n: 20, attempt: 3 }).join(), 'attempt 3 twice');
    }],
    ['final draw differs across attempts', function (ok) {
      var b = synthBank('t', 10, 8), prev = {};
      for (var k = 1; k <= 6; k++) { var s = drawFinal(b, { n: 20, attempt: k }).slice().sort().join(); ok(!prev[s], 'attempt ' + k + ' repeats an earlier set'); prev[s] = 1; }
    }],
    ['strata proportions hold within rounding', function (ok) {
      var b = synthBank('t', 12, 10);
      [[1, 20], [2, 20], [7, 20], [1, 10], [3, 13]].forEach(function (kn) {
        var k = kn[0], N = kn[1], ids = drawFinal(b, { n: N, attempt: k }), c = {};
        ids.forEach(function (id) { var it = b.items.filter(function (x) { return x.id === id; })[0]; c[it.tier] = (c[it.tier] || 0) + 1; });
        ok(ids.length === N, 'n = ' + N + ', drew ' + ids.length);
        Object.keys(DEFAULT_STRATA).forEach(function (t) { var x = N * DEFAULT_STRATA[t]; ok((c[t] || 0) >= Math.floor(x) && (c[t] || 0) <= Math.ceil(x), t + ' ' + c[t] + ' vs ' + x); });
      });
    }],
    ['section-quiz items never appear in a final or combined test', function (ok) {
      var b1 = synthBank('p1', 10, 6), b2 = synthBank('p2', 8, 5), q = {};
      quizIds(b1).concat(quizIds(b2)).forEach(function (id) { q[id] = 1; });
      for (var k = 1; k <= 30; k++) {
        drawFinal(b1, { n: 20, attempt: k }).forEach(function (id) { ok(!q[id], id + ' in final ' + k); });
        drawFinal([b1, b2], { n: 30, attempt: k, noTask: true }).forEach(function (id) { ok(!q[id], id + ' in combined ' + k); });
      }
    }],
    ['combined test excludes tasks and spans pages', function (ok) {
      var b1 = synthBank('p1', 10, 6), b2 = synthBank('p2', 8, 6), all = {};
      b1.items.concat(b2.items).forEach(function (it) { all[it.id] = it; });
      var ids = drawFinal([b1, b2], { n: 30, attempt: 1, noTask: true });
      ok(ids.every(function (id) { return all[id].tier !== 'task'; }), 'a task item was drawn');
      ok(ids.some(function (id) { return /^p1-/.test(id); }) && ids.some(function (id) { return /^p2-/.test(id); }), 'both pages');
    }],
    ['final spreads across sections', function (ok) {
      var b = synthBank('t', 10, 8), ids = drawFinal(b, { n: 20, attempt: 1 }), c = {};
      ids.forEach(function (id) { c[id.split('-')[1]] = 1; });
      ok(Object.keys(c).length >= 8, 'only ' + Object.keys(c).length + ' of 10 sections');
    }],
    ['a retake prefers unseen items', function (ok) {
      var b = synthBank('t', 10, 11), a1 = drawFinal(b, { n: 20, attempt: 1 }), a2 = drawFinal(b, { n: 20, attempt: 2 });
      var shared = a1.filter(function (id) { return a2.indexOf(id) >= 0; });
      ok(shared.length === 0, shared.length + ' items repeated from attempt 1 with a pool of 80, 20 per tier');
    }],
    ['the seed alone changes the draw', function (ok) {
      var b = synthBank('t', 10, 8), pool = b.items.filter(function (it) { return quizIds(b).indexOf(it.id) < 0; })
        .map(function (it) { return { id: it.id, tier: it.tier, section: it.section, page: 't' }; });
      var s1 = drawOnce(pool, 10, DEFAULT_STRATA, mulberry32(1), {}).map(function (x) { return x.id; }).sort().join();
      var s2 = drawOnce(pool, 10, DEFAULT_STRATA, mulberry32(2), {}).map(function (x) { return x.id; }).sort().join();
      ok(s1 !== s2, 'seeds 1 and 2 drew the same set with no usage history');
      ok(CC.core.seedFor('t', 1) !== CC.core.seedFor('t', 2), 'seedFor ignores the attempt');
    }],
    ['combined test drops task-TYPE items in any tier', function (ok) {
      var b = synthBank('p1', 6, 6);
      b.items.forEach(function (it) { if (it.tier !== 'task') { it.type = 'task'; } });
      var ids = drawFinal([b], { n: 10, attempt: 1, noTask: true });
      ok(ids.length === 0, ids.length + ' task-type items drawn');
    }],
    ['allocation sums to n and passes a thin tier on', function (ok) {
      var a = allocate(20, DEFAULT_STRATA, { name: 50, concept: 50, equation: 50, task: 1 }, {});
      ok(a.name + a.concept + a.equation + a.task === 20 && a.task === 1, JSON.stringify(a));
    }],
    ['grading, one grader per type', function (ok) {
      ok(grade({ type: 'mc', answer: 2 }, 2) && !grade({ type: 'mc', answer: 2 }, 1), 'mc');
      var m = { type: 'match', answer: [['a', 'x'], ['b', 'y'], ['c', 'z']] };
      ok(grade(m, { a: 'x', b: 'y', c: 'z' }) && !grade(m, { a: 'y', b: 'x', c: 'z' }) && !grade(m, null), 'match');
      var o = { type: 'order', answer: [2, 0, 1] };
      ok(grade(o, [2, 0, 1]) && !grade(o, [0, 1, 2]) && !grade(o, [2, 0]), 'order');
      ok(grade({ type: 'task' }, true) && !grade({ type: 'task' }, null) && !grade({ type: 'task' }, 1), 'task');
      ok(!grade({ type: 'essay' }, 'x'), 'unknown type');
      var s = score([{ section: 'a' }, { section: 'a' }, { section: 'b' }], [true, false, true]);
      ok(s.ok === 2 && s.n === 3 && s.weak.join() === 'a', 'score');
    }],
    ['storage codec round-trips', function (ok) {
      var st = emptyState();
      st.pages.kt = { final: { best: { score: 17, n: 20 }, latest: { score: 15, n: 20 }, attempts: 4 }, sum: { mask: '1f3', nsec: 13 } };
      st.combined = { best: { score: 24, n: 30 }, latest: { score: 20, n: 30 }, attempts: 2 };
      var r = decodeCookie(encodeCookie(st));
      ok(r && r.pages.kt.final.best.score === 85 && r.pages.kt.final.latest.score === 75 && r.pages.kt.final.attempts === 4, 'page');
      ok(r.pages.kt.sum.mask === '1f3' && r.pages.kt.sum.nsec === 13 && r.combined.best.score === 80, 'mask/combined');
      ok(decodeCookie('!!!') === null && decodeCookie(b64u('2|x')) === null, 'garbage refused');
      ok(compactRecord(r) === compactRecord(st), 'idempotent');
    }],
    ['cookie ≤ 3900 bytes for 3 pages × 20 sections × 200 items', function (ok) {
      var st = emptyState();
      ['kt', 'models', 'techniques'].forEach(function (p) {
        var b = synthBank(p, 20, 10), ps = { sec: {}, names: {}, final: { best: { score: 999, n: 999 }, latest: { score: 999, n: 999 }, attempts: 99999, history: [] } };
        b.items.forEach(function (it) { (ps.sec[it.section] = ps.sec[it.section] || {})[it.id] = { ok: true, tries: 99, t: Date.now() }; ps.names[it.id] = { ok: false, label: 'A very long name label' }; });
        ps.sum = mastery(b, ps); st.pages[p] = ps;
      });
      st.combined = { best: { score: 30, n: 30 }, latest: { score: 30, n: 30 }, attempts: 99999 };
      var bytes = ('cct1=' + encodeCookie(st) + '; Path=/web-annex/; SameSite=Lax; Max-Age=31536000; Secure').length;
      ok(bytes <= 3900, bytes + ' bytes');
      ok(st.pages.kt.sum.mask === 'fffff' && st.pages.kt.sum.nsec === 20, 'mastery mask ' + st.pages.kt.sum.mask);
    }],
    ['export text ≤ 40 lines', function (ok) {
      var st = emptyState();
      for (var p = 0; p < 60; p++) st.pages['p' + p] = { final: { best: { score: 1, n: 2, seed: 1 }, latest: { score: 1, n: 2, seed: 2, weak: ['a', 'b'] } }, names: { x: { ok: false, label: 'Wen' } }, sum: { mask: '3', nsec: 4 } };
      st.combined = { best: { score: 1, n: 2 }, latest: { score: 1, n: 2 } };
      var t = exportText(st, '2026-10-02', ['(scores are not being saved in this browser)']);
      ok(t.split('\n').length <= 40, t.split('\n').length + ' lines');
      var st3 = emptyState(); st3.pages.kt = st.pages.p0;
      var t3 = exportText(st3, '2026-10-02', []);
      ok(/kt: final best 1\/2 \(attempt 1\), latest 1\/2 \(attempt 2\); sections mastered 2\/4; weak: a, b; names missed: Wen/.test(t3), t3);
    }],
    ['five-valued sign table is total and reached exactly', function (ok) {
      var keys = Object.keys(SIGN_TABLE);
      ok(keys.length === 16, keys.length + ' keys');
      for (var i = 0; i < 16; i++) { var k = ('000' + i.toString(2)).slice(-4); ok(SIGN_CELLS.indexOf(SIGN_TABLE[k]) >= 0, 'cell ' + k); }
      var rng = mulberry32(11), seen = {};
      for (i = 0; i < 20000; i++) {
        var v = (rng() - 0.5) * 4, w = rng() * rng() * 2, e = rng() < 0.1 ? 0 : rng();
        var key = signKey(v, w, e); seen[key] = 1;
        ok(CC.sign.classify(v, w, e) === SIGN_TABLE[key], 'classify uses the table');
        if (e === 0) ok(['SIG+', 'SIG−', '?'].indexOf(CC.sign.classify(v, w, 0)) >= 0, 'ε = 0 collapse');
      }
      ok(Object.keys(seen).sort().join() === '0000,0001,0010,0011,0101,1001', 'reached ' + Object.keys(seen).sort().join());
      ok(CC.sign.classify(NaN, 0.1, 0.2) === '?', 'NaN is ?');
      ok(CC.sign.classify(0.5, 0.1, 0.2) === 'SIG+' && CC.sign.classify(0, 0.05, 0.2) === 'ZERO!' && CC.sign.classify(0.12, 0.05, 0.2) === 'SLOW' && CC.sign.classify(0.1, 0.2, 0.2) === '?', 'cells');
    }],
    ['block-spin and correlation', function (ok) {
      var s = new Int8Array(16).fill(1); s[0] = -1;
      var b = blockOnce('ising', s, 4);
      ok(b.length === 4 && b[0] === 1, 'majority');
      var t = new Int8Array([1, -1, -1, 1]); ok(blockOnce('ising', t, 2)[0] === 1, 'tie → top-left');
      ok(nnCorr('ising', new Int8Array(16).fill(1), 4) === 1, 'ordered nn = 1');
    }],
    ['RK4 integrates the KT critical branch', function (ok) {
      var f = function (x, y) { return [-y * y, -x * y]; }, r = integrate(f, 0.2, 0.2, { dt: 0.01, steps: 1000, x: [-1, 1], y: [0, 1] });
      var yEnd = r.pts[r.pts.length - 1][1], want = 1 / (1 / 0.2 + r.ell);
      ok(Math.abs(yEnd - want) < 1e-6, yEnd + ' vs ' + want);
    }]
    ];
}

export function run(CC) {
  const fail = [];
  let pass = 0;
  for (const [name, fn] of suite(CC)) {
    const bad = [];
    try { fn((c, msg) => { if (!c) bad.push(msg); }); } catch (e) { bad.push('threw ' + e.message); }
    if (bad.length) fail.push(name + ': ' + bad.slice(0, 3).join('; ')); else pass++;
  }
  return { pass, fail };
}

const isMain = typeof process !== 'undefined' && process.argv && process.argv[1] &&
  import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { createRequire } = await import('node:module');
  const path = await import('node:path');
  const i = process.argv.indexOf('--engine');
  const eng = i > 0 ? path.resolve(process.argv[i + 1]) : new URL('./cc-tutor.js', import.meta.url).pathname;
  const CC = createRequire(import.meta.url)(eng);
  const tests = suite(CC);
  let failed = 0;
  for (const [name, fn] of tests) {
    const bad = [];
    try { fn((c, msg) => { if (!c) bad.push(msg); }); } catch (e) { bad.push('threw ' + e.stack); }
    console.log((bad.length ? 'FAIL ' : 'ok   ') + name + (bad.length ? '\n       ' + bad.slice(0, 3).join('\n       ') : ''));
    if (bad.length) failed++;
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
}
