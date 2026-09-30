/* cc-tutor.js — shared engine for the critical-lines tutorials (window.CC). Plain ES2019, no deps,
 * no build. The demo page diamond-node/critical-lines/dev/engine-demo.html
 * mounts one of everything. Node loads it with require() for the self-test and the bank checker.
 * Science code is structure, not control: the five-valued sign is a TOTAL table; '?' is a value.
 */
(function (root, factory) {
  var CC = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = CC;
  if (root && root.document) root.CC = CC;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
'use strict';

var doc = root.document;
var CC = { version: '1.0.0', graphics: {}, banks: {}, page: null };

/* ================================================================ pure core */

function mulberry32(a) {
  a = a >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  var h = 2166136261 >>> 0;
  s = String(s);
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function shuffle(arr, rng) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function seedFor(salt, k) { return (hashStr(salt) ^ Math.imul(k >>> 0, 0x9E3779B1)) >>> 0; }

var TIERS = ['name', 'concept', 'equation', 'task'];
var TYPES = ['mc', 'match', 'order', 'task'];
var DEFAULT_STRATA = { name: 0.35, concept: 0.35, equation: 0.15, task: 0.15 };
var COMBINED_STRATA = { name: 0.4, concept: 0.4, equation: 0.2 };

/* The section quiz of a section is the FIRST quizN items of that section in bank order
   (bank.quizN, default 3). One rule, used by the page, the final, the landing and the checker. */
function quizIds(bank) {
  var q = bank.quizN || 3, seen = {}, out = [];
  (bank.items || []).forEach(it => {
    var c = seen[it.section] || 0;
    if (c < q) out.push(it.id);
    seen[it.section] = c + 1;
  });
  return out;
}
function quizIdsFor(bank, section) {
  var all = quizIds(bank), set = {};
  all.forEach(id => { set[id] = 1; });
  return (bank.items || []).filter(it => { return it.section === section && set[it.id]; })
    .map(it => { return it.id; });
}

/* Largest-remainder allocation of n slots over tiers, capped by availability; the shortfall of a
   thin tier is passed on in remainder order. tie[t] (lower first) breaks equal remainders. */
function allocate(n, strata, avail, tie) {
  var tiers = Object.keys(strata).filter(t => { return strata[t] > 0; });
  var sum = tiers.reduce((a, t) => { return a + strata[t]; }, 0) || 1;
  var out = {}, rem = [], total = 0;
  tiers.forEach(t => {
    var x = n * strata[t] / sum;
    out[t] = Math.floor(x); total += out[t];
    rem.push([t, x - out[t]]);
  });
  rem.sort((a, b) => { return (b[1] - a[1]) || ((tie[a[0]] || 0) - (tie[b[0]] || 0)); });
  for (var i = 0; total < n && i < rem.length; i++) { out[rem[i][0]]++; total++; }
  var short = 0;
  tiers.forEach(t => { var a = avail[t] || 0; if (out[t] > a) { short += out[t] - a; out[t] = a; } });
  var moved = true;
  while (short > 0 && moved) {
    moved = false;
    for (i = 0; i < rem.length && short > 0; i++) {
      var t = rem[i][0];
      if (out[t] < (avail[t] || 0)) { out[t]++; short--; moved = true; }
    }
  }
  return out;
}

/* One attempt's draw. pool entries: {id, tier, section, page}. usage: {id: times drawn before}. */
function drawOnce(pool, n, strata, rng, usage) {
  var byTier = {}, key = {}, tie = {}, avail = {};
  pool.forEach(it => { key[it.id] = rng(); (byTier[it.tier] = byTier[it.tier] || []).push(it); });
  Object.keys(strata).forEach(t => {
    var g = byTier[t] || [];
    avail[t] = g.length;
    var mu = g.reduce((m, it) => { return Math.min(m, usage[it.id] || 0); }, Infinity);
    tie[t] = (g.length ? mu : Infinity) + rng() * 0.5;
  });
  var target = allocate(n, strata, avail, tie);
  var picked = [], taken = {}, secN = {}, pageN = {};
  Object.keys(strata).forEach(t => {
    var g = byTier[t] || [];
    for (var k = 0; k < (target[t] || 0); k++) {
      var best = null, bk = null;
      for (var i = 0; i < g.length; i++) {
        var it = g[i];
        if (taken[it.id]) continue;
        var s = (it.page || '') + ':' + it.section;
        var kk = [usage[it.id] || 0, pageN[it.page || ''] || 0, secN[s] || 0, key[it.id]];
        if (!bk || cmpKey(kk, bk) < 0) { best = it; bk = kk; }
      }
      if (!best) break;
      taken[best.id] = 1; picked.push(best);
      secN[(best.page || '') + ':' + best.section] = (secN[(best.page || '') + ':' + best.section] || 0) + 1;
      pageN[best.page || ''] = (pageN[best.page || ''] || 0) + 1;
    }
  });
  return shuffle(picked, rng);
}
function cmpKey(a, b) { for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; } return 0; }

/* The final test's item set for attempt k (k ≥ 1). Seed k; usage from attempts 1…k−1 is replayed,
   so a retake prefers unseen items and every attempt is reproducible from its number alone. */
function drawFinal(banks, opts) {
  banks = Array.isArray(banks) ? banks : [banks];
  var n = opts.n, strata = opts.strata || (opts.noTask ? COMBINED_STRATA : DEFAULT_STRATA);
  var attempt = Math.max(1, opts.attempt | 0), salt = opts.salt || banks.map(b => { return b.page; }).join('+');
  var pool = [];
  banks.forEach(b => {
    var ex = {};
    quizIds(b).forEach(id => { ex[id] = 1; });
    (b.items || []).forEach(it => {
      if (ex[it.id]) return;
      if (opts.noTask && (it.tier === 'task' || it.type === 'task')) return;
      pool.push({ id: it.id, tier: it.tier, section: it.section, page: b.page });
    });
  });
  var usage = {}, res = [];
  for (var k = 1; k <= attempt; k++) {
    res = drawOnce(pool, n, strata, mulberry32(seedFor(salt, k)), usage);
    if (k < attempt) res.forEach(it => { usage[it.id] = (usage[it.id] || 0) + 1; });
  }
  return res.map(it => { return it.id; });
}

/* Grading: one grader per item type (a table, not a chain). */
var GRADERS = {
  mc: (it, r) => { return r === it.answer; },
  match: (it, r) => {
    return !!r && it.answer.every(p => { return r[p[0]] === p[1]; });
  },
  order: (it, r) => {
    return Array.isArray(r) && r.length === it.answer.length &&
      it.answer.every((v, i) => { return r[i] === v; });
  },
  task: (it, r) => { return r === true; }
};
function grade(item, resp) { var g = GRADERS[item.type]; return g ? !!g(item, resp) : false; }
function score(items, oks) {
  var by = {}, ok = 0;
  items.forEach((it, i) => {
    var s = by[it.section] = by[it.section] || { ok: 0, n: 0 };
    s.n++; if (oks[i]) { s.ok++; ok++; }
  });
  var weak = Object.keys(by).filter(s => { return by[s].ok < by[s].n; });
  return { ok: ok, n: items.length, bySection: by, weak: weak };
}

/* The five-valued sign over (v, w, ε): v a velocity estimate, w ≥ 0 its band, ε ≥ 0 a DECLARED
   equivalence margin. The key is four predicates; the TABLE is total over all 16 keys.
     a = v − w > ε         (the whole band beyond +ε)
     b = v + w < −ε        (the whole band beyond −ε)
     c = |v| + w < ε       (the whole band inside the margin)
     r = v − w > 0 or v + w < 0   (the band excludes zero: resolved nonzero)
   A resolved nonzero inside the margin (c and r) is SLOW, not ZERO!: a zero is never claimed while
   a nonzero is resolved. Keys that cannot occur for w, ε ≥ 0 (a with b, a with c, a without r, …)
   are '?'. NaN makes every predicate false: key 0000, '?'. ε = 0 collapses to the three-valued sign. */
var SIGN_CELLS = ['SIG+', 'SIG−', 'ZERO!', 'SLOW', '?'];
var SIGN_TABLE = Object.freeze({
  '0000': '?',     '0001': 'SLOW',  '0010': 'ZERO!', '0011': 'SLOW',
  '0100': '?',     '0101': 'SIG−', '0110': '?',   '0111': '?',
  '1000': '?',     '1001': 'SIG+',  '1010': '?',     '1011': '?',
  '1100': '?',     '1101': '?',     '1110': '?',     '1111': '?'
});
function signKey(v, w, eps) {
  var a = v - w > eps, b = v + w < -eps, c = Math.abs(v) + w < eps, r = (v - w > 0) || (v + w < 0);
  return (a ? '1' : '0') + (b ? '1' : '0') + (c ? '1' : '0') + (r ? '1' : '0');
}
CC.sign = {
  cells: SIGN_CELLS, table: SIGN_TABLE, key: signKey,
  classify: (v, w, eps) => { return SIGN_TABLE[signKey(v, w, eps)]; }
};

/* ---- state, codec, export (pure) */
function emptyState() { return { v: 1, pages: {}, combined: {}, ui: { open: {} } }; }
function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
function deepMerge(a, b) {
  Object.keys(b).forEach(k => {
    if (isObj(b[k]) && isObj(a[k])) deepMerge(a[k], b[k]);
    else a[k] = isObj(b[k]) ? deepMerge({}, b[k]) : b[k];
  });
  return a;
}
function pct(r) { return r && r.n ? Math.round(100 * r.score / r.n) : -1; }
function compactRecord(state) {
  var parts = ['1'];
  Object.keys(state.pages || {}).sort().forEach(p => {
    var s = state.pages[p] || {}, f = s.final || {}, sum = s.sum || {};
    parts.push([p.replace(/[^a-z0-9-]/gi, ''), pct(f.best), pct(f.latest), f.attempts || 0,
      sum.mask || '0', sum.nsec || 0].join('.'));
  });
  var c = state.combined || {};
  parts.push(['*', pct(c.best), pct(c.latest), c.attempts || 0].join('.'));
  return parts.join('|');
}
function b64u(s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return atob(s); }
function encodeCookie(state) { return b64u(compactRecord(state)); }
function decodeCookie(str) {
  var raw;
  try { raw = unb64u(str); } catch (e) { return null; }
  var parts = raw.split('|');
  if (parts[0] !== '1') return null;
  var st = emptyState(), num = x => { var v = parseInt(x, 10); return isFinite(v) ? v : -1; };
  var rec = p => { return p >= 0 ? { score: p, n: 100, restored: true } : undefined; };
  parts.slice(1).forEach(q => {
    var f = q.split('.');
    if (f[0] === '*') {
      st.combined = { best: rec(num(f[1])), latest: rec(num(f[2])), attempts: Math.max(0, num(f[3])) };
    } else if (f.length >= 6) {
      st.pages[f[0]] = { sec: {}, names: {}, restored: true,
        final: { best: rec(num(f[1])), latest: rec(num(f[2])), attempts: Math.max(0, num(f[3])), history: [] },
        sum: { mask: f[4], nsec: Math.max(0, num(f[5])) } };
    }
  });
  return st;
}
function maskCount(hex) { var n = 0; String(hex || '0').split('').forEach(h => { var v = parseInt(h, 16) || 0; while (v) { n += v & 1; v >>= 1; } }); return n; }
function mastery(bank, ps) {
  var bits = [], sec = (ps && ps.sec) || {};
  (bank.sections || []).forEach(s => {
    var ids = quizIdsFor(bank, s);
    bits.push(ids.length > 0 && ids.every(id => { return sec[s] && sec[s][id] && sec[s][id].ok; }));
  });
  var hex = '';
  for (var i = 0; i < bits.length; i += 4) {
    var v = 0;
    for (var j = 0; j < 4; j++) if (bits[i + j]) v |= 1 << j;
    hex = v.toString(16) + hex;
  }
  return { mask: hex || '0', nsec: bits.length, mastered: bits.filter(Boolean).length };
}
function fmtRec(r) {
  if (!r) return null;
  return r.restored ? r.score + '%' : r.score + '/' + r.n + (r.seed ? ' (attempt ' + r.seed + ')' : '');
}
function exportText(state, date, notes) {
  var L = ['CC tutorials — score export ' + date];
  var pages = Object.keys(state.pages || {}).sort();
  pages.forEach(p => {
    var s = state.pages[p] || {}, f = s.final || {}, sum = s.sum || {}, bits = [];
    bits.push(f.best ? 'final best ' + fmtRec(f.best) + ', latest ' + fmtRec(f.latest) : 'no final yet');
    bits.push('sections mastered ' + maskCount(sum.mask) + '/' + (sum.nsec || 0));
    var weak = (f.latest && f.latest.weak) || [];
    if (weak.length) bits.push('weak: ' + weak.slice(0, 8).join(', ') + (weak.length > 8 ? ' …' : ''));
    var nm = s.names || {}, missed = Object.keys(nm).filter(id => { return nm[id] && !nm[id].ok; })
      .map(id => { return nm[id].label || id; });
    if (missed.length) bits.push('names missed: ' + missed.slice(0, 10).join(', ') + (missed.length > 10 ? ' …' : ''));
    if (s.restored) bits.push('(restored from cookie)');
    L.push(p + ': ' + bits.join('; '));
  });
  var c = state.combined || {};
  if (c.best) L.push('combined: best ' + fmtRec(c.best) + ', latest ' + fmtRec(c.latest));
  (notes || []).forEach(n => { L.push(n); });
  if (L.length > 40) L = L.slice(0, 39).concat(['… ' + (L.length - 39) + ' more lines not shown']);
  return L.join('\n');
}
function stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/&[a-z]+;|&#\d+;/gi, e => { return ENT[e] || ' '; }).trim(); }
var ENT = { '&ndash;': '–', '&mdash;': '—', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&minus;': '−', '&auml;': 'ä', '&ouml;': 'ö', '&eacute;': 'é' };
function itemLabel(it) {
  if (it.label) return it.label;
  if (it.type === 'mc' && it.options) return stripTags(it.options[it.answer]).slice(0, 48);
  return it.id;
}

CC.core = {
  mulberry32: mulberry32, hashStr: hashStr, shuffle: shuffle, seedFor: seedFor, TIERS: TIERS, TYPES: TYPES,
  DEFAULT_STRATA: DEFAULT_STRATA, COMBINED_STRATA: COMBINED_STRATA, quizIds: quizIds, quizIdsFor: quizIdsFor,
  allocate: allocate, drawOnce: drawOnce, drawFinal: drawFinal, grade: grade, score: score, emptyState: emptyState,
  deepMerge: deepMerge, compactRecord: compactRecord, encodeCookie: encodeCookie, decodeCookie: decodeCookie,
  mastery: mastery, maskCount: maskCount, exportText: exportText, itemLabel: itemLabel, stripTags: stripTags
};

/* ================================================================ store */

var KEY = 'cc-tutor:v1', CK = 'cct1';
var store = {
  available: false, cookieOk: false, restored: false, state: emptyState(), _dirty: {}, _loaded: false,
  _ls: () => { try { return root.localStorage || null; } catch (e) { return null; } },
  load: function () {
    if (this._loaded) return;
    this._loaded = true;
    var ls = this._ls(), raw = null;
    try { if (ls) { ls.setItem(KEY + ':probe', '1'); ls.removeItem(KEY + ':probe'); this.available = true; raw = ls.getItem(KEY); } }
    catch (e) { this.available = false; }
    var st = null;
    try { st = raw ? JSON.parse(raw) : null; } catch (e) { st = null; }
    if (st && st.v === 1) { this.state = deepMerge(emptyState(), st); return; }
    var ck = this._readCookie();
    if (ck) { var r = decodeCookie(ck); if (r) { this.state = r; this.restored = true; this._dirty = { '*all': 1 }; this.persist(); } }
  },
  _readCookie: function () {
    try {
      var m = String(doc.cookie || '').match(/(?:^|;\s*)cct1=([A-Za-z0-9_-]+)/);
      this.cookieOk = true;
      return m ? m[1] : null;
    } catch (e) { this.cookieOk = false; return null; }
  },
  _writeCookie: function () {
    try {
      var loc = root.location || {}, path = /^\/web-annex\//.test(loc.pathname || '') ? '/web-annex/' : '/';
      doc.cookie = CK + '=' + encodeCookie(this.state) + '; Path=' + path + '; SameSite=Lax; Max-Age=31536000' +
        (loc.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { this.cookieOk = false; }
  },
  get: function (page) {
    var p = this.state.pages[page];
    if (!p) p = this.state.pages[page] = { sec: {}, final: {}, names: {} };
    p.sec = p.sec || {}; p.final = p.final || {}; p.names = p.names || {};
    return p;
  },
  set: function (page, patch) {
    if (page === '*combined') deepMerge(this.state.combined, patch);
    else if (page === '*ui') deepMerge(this.state.ui, patch);
    else { deepMerge(this.get(page), patch); updateSum(page); }
    this._dirty[page] = 1;
    this.persist();
  },
  persist: function () {
    if (this.available) {
      var ls = this._ls();
      try {
        var cur = null;
        try { cur = JSON.parse(ls.getItem(KEY) || 'null'); } catch (e) { cur = null; }
        var out = (cur && cur.v === 1 && !this._dirty['*all']) ? deepMerge(emptyState(), cur) : emptyState();
        if (this._dirty['*all']) out = this.state;
        else {
          var self = this;
          Object.keys(this.state.pages).forEach(k => { if (!out.pages[k]) out.pages[k] = self.state.pages[k]; });
          Object.keys(this._dirty).forEach(k => {
            if (k === '*combined') out.combined = self.state.combined;
            else if (k === '*ui') out.ui = self.state.ui;
            else out.pages[k] = self.state.pages[k];
          });
          this.state = out;
          Object.keys(CC.banks).forEach(p => { if (out.pages[p]) updateSum(p); });
        }
        ls.setItem(KEY, JSON.stringify(out));
      } catch (e) { this.available = false; }
    }
    this._dirty = {};
    this._writeCookie();
  },
  notes: function () {
    var n = [];
    if (!this.available) n.push('(scores are not being saved in this browser)');
    if (this.restored) n.push('(some scores were restored from the cookie mirror; details were lost)');
    return n;
  },
  exportText: function () { return exportText(this.state, new Date().toISOString().slice(0, 10), this.notes()); },
  reset: function (which) {
    if (which === 'all') this.state = emptyState();
    else if (which === 'combined') this.state.combined = {};
    else delete this.state.pages[which];
    this.restored = false;
    this._dirty = { '*all': 1 };
    this.persist();
  },
  _cookieBytes: function () { return (CK + '=' + encodeCookie(this.state)).length; }
};
CC.store = store;
function updateSum(page) {
  var b = CC.banks[page];
  if (b) store.state.pages[page].sum = mastery(b, store.state.pages[page]);
}
function recordResult(page, item, ok, resp, source) {
  var ps = store.get(page), patch = { names: {} };
  if (source === 'quiz') {
    var prev = (ps.sec[item.section] || {})[item.id] || {};
    patch.sec = {}; patch.sec[item.section] = {};
    patch.sec[item.section][item.id] = { ok: ok, tries: (prev.tries || 0) + 1, t: Date.now(), r: resp };
  }
  if (item.tier === 'name') patch.names[item.id] = { ok: ok, label: itemLabel(item) };
  store.set(page, patch);
}

/* ================================================================ DOM helpers */

var uid = 0;
function nextId(p) { uid++; return (p || 'cc') + '-' + uid; }
function h(tag, attrs, kids) {
  var el = doc.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(k => {
    var v = attrs[k];
    if (v == null || v === false) return;
    if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  });
  (kids || []).forEach(c => { if (c != null) el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
  return el;
}
function btn(label, act, fn, cls) { return h('button', { type: 'button', 'class': 'cc-btn' + (cls ? ' ' + cls : ''), 'data-cc-act': act, onclick: fn, text: label }); }
var SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  var el = doc.createElementNS(SVGNS, tag);
  Object.keys(attrs || {}).forEach(k => { if (attrs[k] != null) el.setAttribute(k, attrs[k]); });
  return el;
}
function reduced() {
  try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
CC.reducedMotion = reduced;
function register(id, handle) { handle.id = id; CC.graphics[id] = handle; return handle; }
function graphicId(el, spec, pre) {
  var id = spec.id || el.getAttribute('data-cc-id') || nextId(pre);
  el.setAttribute('data-cc-id', id);
  return id;
}
function unsavedNote() {
  return store.available ? null :
    h('p', { 'class': 'cc-unsaved', role: 'status', text: 'Scores are not being saved in this browser (storage is blocked). Grading still works for this visit.' });
}
function findItem(id) {
  for (var p in CC.banks) {
    var it = (CC.banks[p].items || []).filter(x => { return x.id === id; })[0];
    if (it) return { item: it, page: p, bank: CC.banks[p] };
  }
  return null;
}
function citeHref(bank, cite) { return (bank.page !== CC.page && bank.url ? bank.url : '') + '#' + cite; }

/* ---- one rendered item. mode: 'quiz' | 'final' | 'drill' */
function renderItem(it, bank, mode, rng, onGraded) {
  var wrap = h('div', { 'class': 'cc-item', 'data-cc-item': it.id, 'data-cc-type': it.type, 'data-cc-tier': it.tier });
  wrap.appendChild(h('div', { 'class': 'cc-prompt' }, [h('span', { 'class': 'cc-tier', text: it.tier }), h('span', { html: it.prompt })]));
  var body = h('div', { 'class': 'cc-body' }), get;
  var gname = nextId('opt');
  if (it.type === 'mc') {
    var idx = it.options.map((_, i) => { return i; });
    if (rng) idx = shuffle(idx, rng);
    idx.forEach(i => {
      var inp = h('input', { type: 'radio', name: gname, value: String(i) });
      body.appendChild(h('label', { 'class': 'cc-opt' }, [inp, h('span', { html: it.options[i] })]));
    });
    get = () => { var c = body.querySelector('input:checked'); return c ? +c.value : null; };
  } else if (it.type === 'match') {
    var rights = it.answer.map(p => { return p[1]; });
    rights = shuffle(rights, rng || mulberry32(hashStr(it.id)));
    var sels = {};
    it.answer.forEach(p => {
      var sel = h('select', { 'aria-label': 'match for ' + stripTags(p[0]) }, [h('option', { value: '', text: '—' })]
        .concat(rights.map(r => { return h('option', { value: r, text: stripTags(r) }); })));
      sels[p[0]] = sel;
      body.appendChild(h('div', { 'class': 'cc-match' }, [h('span', { html: p[0] }), sel]));
    });
    get = () => { var r = {}; Object.keys(sels).forEach(k => { r[k] = sels[k].value; }); return r; };
  } else if (it.type === 'order') {
    var ord = shuffle(it.options.map((_, i) => { return i; }), rng || mulberry32(hashStr(it.id)));
    if (ord.length > 1 && ord.every((v, i) => { return v === it.answer[i]; })) ord.push(ord.shift());
    var ol = h('ol', { 'class': 'cc-order' });
    var draw = () => {
      ol.innerHTML = '';
      ord.forEach((oi, pos) => {
        var mv = d => { return () => { var j = pos + d; if (j < 0 || j >= ord.length) return; var t = ord[pos]; ord[pos] = ord[j]; ord[j] = t; draw(); }; };
        ol.appendChild(h('li', {}, [h('span', { html: it.options[oi] }),
          h('button', { type: 'button', 'class': 'cc-mini', 'aria-label': 'move up', onclick: mv(-1), text: '↑' }),
          h('button', { type: 'button', 'class': 'cc-mini', 'aria-label': 'move down', onclick: mv(1), text: '↓' })]));
      });
    };
    draw();
    body.appendChild(ol);
    get = () => { return ord.slice(); };
  } else if (it.type === 'task') {
    body.appendChild(btn('Show the graphic', 'goto', () => {
      var g = doc.querySelector('[data-cc-id="' + it.graphic + '"]');
      if (g && g.scrollIntoView) g.scrollIntoView({ block: 'center' });
    }, 'cc-ghost'));
    get = () => {
      var g = CC.graphics[it.graphic], fn = g && g.checks && g.checks[it.check];
      if (!fn) return null;
      try { return fn(g.state()) === true; } catch (e) { return null; }
    };
  }
  wrap.appendChild(body);
  var fb = h('div', { 'class': 'cc-fb', 'aria-live': 'polite' });
  var show = (ok, note) => {
    wrap.setAttribute('data-cc-status', ok ? 'ok' : 'wrong');
    fb.className = 'cc-fb ' + (ok ? 'ok' : 'bad');
    fb.innerHTML = '';
    fb.appendChild(h('strong', { text: note || (ok ? 'Correct.' : 'Not quite.') }));
    if (it.explain) fb.appendChild(h('span', { html: ' ' + it.explain }));
    if (it.cite) fb.appendChild(h('a', { href: citeHref(bank, it.cite), 'class': 'cc-cite', text: ' [source]' }));
  };
  if (mode !== 'final') {
    wrap.appendChild(btn('Check', 'check', function () {
      var r = get();
      if (it.type === 'task' && r === null) { fb.className = 'cc-fb bad'; fb.textContent = 'That graphic is not on this page.'; return; }
      var ok = grade(it, r);
      show(ok);
      if (onGraded) onGraded(it, ok, r);
    }));
  }
  wrap.appendChild(fb);
  var restore = rec => {
    if (!rec) return;
    if (it.type === 'mc' && rec.r != null) { var inp = body.querySelector('input[value="' + rec.r + '"]'); if (inp) inp.checked = true; }
    show(!!rec.ok, rec.ok ? 'Answered correctly before.' : 'Your last try was not right.');
  };
  return { el: wrap, item: it, response: get, show: show, restore: restore };
}

/* ================================================================ quiz */

CC.quiz = {
  mount: (el, ids) => {
    if (typeof ids === 'string') ids = ids.split(',');
    ids = (ids || []).map(s => { return String(s).trim(); }).filter(Boolean);
    if (!ids.length || ids[0] === 'auto') {
      var sec = el.closest && el.closest('section[id]'), b = CC.banks[CC.page];
      ids = sec && b ? quizIdsFor(b, sec.id) : [];
    }
    el.innerHTML = '';
    el.classList.add('cc-quiz');
    var note = unsavedNote(); if (note) el.appendChild(note);
    ids.forEach(id => {
      var f = findItem(id);
      if (!f) { el.appendChild(h('p', { 'class': 'cc-fb bad', text: 'Missing item ' + id })); return; }
      var r = renderItem(f.item, f.bank, 'quiz', null, (it, ok, resp) => { recordResult(f.page, it, ok, resp, 'quiz'); });
      var ps = store.get(f.page);
      r.restore((ps.sec[f.item.section] || {})[f.item.id]);
      el.appendChild(r.el);
    });
    return el;
  }
};

/* ================================================================ final / combined */

function mountTest(el, cfg) {
  el.innerHTML = '';
  el.classList.add('cc-final');
  var head = h('div', { 'class': 'cc-final-head' }), list = h('div', { 'class': 'cc-final-items' }), foot = h('div', { 'class': 'cc-final-foot' });
  var note = unsavedNote();
  el.appendChild(head); if (note) el.appendChild(note); el.appendChild(list); el.appendChild(foot);
  var rec = () => { return cfg.kind === 'combined' ? store.state.combined : store.get(cfg.key).final; };
  var summary = () => {
    var r = rec() || {};
    return 'Best: ' + (fmtRec(r.best) || '—') + ' · Latest: ' + (fmtRec(r.latest) || '—') + ' · Attempts: ' + (r.attempts || 0);
  };
  var rendered = [], attempt = 0;
  var idle = () => {
    el.setAttribute('data-cc-state', 'idle');
    head.innerHTML = ''; list.innerHTML = ''; foot.innerHTML = '';
    head.appendChild(h('p', { 'class': 'cc-score', text: summary() }));
    head.appendChild(btn('Start attempt ' + (((rec() || {}).attempts || 0) + 1) + ' (' + cfg.n + ' items)', 'start', start, 'cc-primary'));
  };
  var start = () => {
    attempt = ((rec() || {}).attempts || 0) + 1;
    var ids = drawFinal(cfg.banks, { n: cfg.n, strata: cfg.strata, attempt: attempt, noTask: cfg.kind === 'combined', salt: cfg.salt });
    var rng = mulberry32(seedFor(cfg.salt + ':opts', attempt));
    head.innerHTML = ''; list.innerHTML = ''; foot.innerHTML = '';
    head.appendChild(h('p', { 'class': 'cc-score', text: 'Attempt ' + attempt + ' · ' + ids.length + ' items · ' + summary() }));
    rendered = ids.map(id => { var f = findItem(id); var r = renderItem(f.item, f.bank, 'final', rng); r.page = f.page; list.appendChild(r.el); return r; });
    if (ids.length < cfg.n) list.appendChild(h('p', { 'class': 'cc-fb bad', text: 'The bank holds only ' + ids.length + ' items outside the section quizzes.' }));
    foot.appendChild(btn('Submit', 'submit', submit, 'cc-primary'));
    el.setAttribute('data-cc-state', 'taking');
  };
  var submit = () => {
    var oks = rendered.map(r => { var resp = r.response(); var ok = grade(r.item, resp); r.show(ok); return ok; });
    var sc = score(rendered.map(r => { return r.item; }), oks);
    var items = {};
    rendered.forEach((r, i) => { items[r.item.id] = oks[i] ? 1 : 0; });
    var cur = rec() || {}, now = { score: sc.ok, n: sc.n, seed: attempt, t: Date.now(), weak: sc.weak };
    var best = cur.best && cur.best.score / cur.best.n >= sc.ok / (sc.n || 1) ? cur.best : now;
    var hist = (cur.history || []).concat([{ s: sc.ok, n: sc.n, seed: attempt, t: now.t }]).slice(-20);
    var patch = { best: best, latest: deepMerge({ items: items }, now), attempts: attempt, history: hist };
    if (cfg.kind === 'combined') store.set('*combined', patch);
    else store.set(cfg.key, { final: patch });
    rendered.forEach((r, i) => { if (r.item.tier === 'name') recordResult(r.page, r.item, oks[i], null, 'final'); });
    foot.innerHTML = '';
    foot.appendChild(h('p', { 'class': 'cc-score cc-result', text: 'Score ' + sc.ok + '/' + sc.n + '. ' + summary() }));
    if (sc.weak.length) {
      var w = h('p', { 'class': 'cc-weak' }, ['Weak spots: ']);
      sc.weak.forEach((s, i) => { if (i) w.appendChild(doc.createTextNode(', ')); w.appendChild(h('a', { href: '#' + s, text: s })); });
      foot.appendChild(w);
    }
    foot.appendChild(btn('Retake (new items)', 'retake', start, 'cc-primary'));
    foot.appendChild(exportUI());
    el.setAttribute('data-cc-state', 'done');
  };
  idle();
  var gid = el.getAttribute('data-cc-id');
  if (gid) register(gid, { el: el, state: () => { return { attempt: attempt, state: el.getAttribute('data-cc-state') }; }, checks: {} });
  return { el: el, start: start, submit: submit };
}
CC.final = {
  mount: (el, opts) => {
    opts = opts || {};
    var b = CC.banks[CC.page];
    return mountTest(el, { kind: 'final', key: CC.page, banks: b ? [b] : [], n: opts.n || +el.getAttribute('data-cc-final') || 20,
      strata: opts.strata || DEFAULT_STRATA, salt: CC.page });
  }
};
CC.combined = {
  mount: (el, opts) => {
    opts = opts || {};
    var pages = opts.pages || Object.keys(CC.banks);
    var banks = pages.map(p => { return CC.banks[p]; }).filter(Boolean);
    return mountTest(el, { kind: 'combined', banks: banks, n: opts.n || 30, strata: opts.strata || COMBINED_STRATA, salt: 'combined:' + pages.join('+') });
  }
};

/* ================================================================ names drill */

CC.names = {
  mount: function (el, opts) {
    opts = opts || {};
    var pages = opts.pages || Object.keys(CC.banks);
    var pool = [];
    pages.forEach(p => { var b = CC.banks[p]; if (b) b.items.forEach(it => { if (it.tier === 'name' && it.type === 'mc') pool.push({ it: it, b: b, p: p }); }); });
    el.innerHTML = ''; el.classList.add('cc-names');
    var round = ((store.state.ui.drill || 0) + 1), order = shuffle(pool, mulberry32(seedFor('names', round))), i = 0, right = 0, done = 0;
    var tally = h('p', { 'class': 'cc-score' }), slot = h('div'), ctl = h('div', { 'class': 'cc-ctl' });
    var note = unsavedNote();
    el.appendChild(tally); if (note) el.appendChild(note); el.appendChild(slot); el.appendChild(ctl);
    var upd = function () { tally.textContent = 'Name drill: ' + right + ' of ' + done + ' this round · ' + pool.length + ' names in the roll'; };
    var show = () => {
      slot.innerHTML = '';
      if (!order.length) { slot.appendChild(h('p', { text: 'No name items loaded.' })); return; }
      var e = order[i % order.length];
      slot.appendChild(renderItem(e.it, e.b, 'drill', mulberry32(seedFor(e.it.id, round)), (it, ok) => {
        done++; if (ok) right++; upd(); recordResult(e.p, it, ok, null, 'drill');
      }).el);
    };
    ctl.appendChild(btn('Next name', 'next', () => { i++; show(); }));
    try { store.state.ui.drill = round; store.set('*ui', {}); } catch (e) { /* in-memory only */ }
    upd(); show();
    return el;
  }
};

/* ================================================================ scoreboard + export */

function exportUI() {
  var box = h('div', { 'class': 'cc-export' });
  box.appendChild(btn('Export scores', 'export', function () {
    var text = store.exportText();
    var fallback = function () {
      var old = box.querySelector('textarea'); if (old) old.remove();
      var ta = h('textarea', { readonly: true, rows: '6', 'aria-label': 'score export' });
      ta.value = text; box.appendChild(ta); ta.focus(); ta.select();
      box.appendChild(h('span', { 'class': 'cc-hint', text: ' Copy this text.' }));
    };
    try {
      if (root.navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          var s = h('span', { 'class': 'cc-hint', text: ' Copied to the clipboard.' }); box.appendChild(s);
        }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
  }));
  return box;
}
CC.exportUI = exportUI;
CC.scoreboard = {
  mount: (el, opts) => {
    opts = opts || {};
    el.classList.add('cc-scoreboard');
    var draw = () => {
      el.innerHTML = '';
      var pages = opts.pages || Object.keys(store.state.pages);
      var tb = h('tbody');
      pages.forEach(p => {
        var s = store.get(p), f = s.final || {}, sum = s.sum || {};
        tb.appendChild(h('tr', {}, [h('td', { text: (CC.banks[p] && CC.banks[p].title) || p }), h('td', { text: fmtRec(f.best) || '—' }),
          h('td', { text: fmtRec(f.latest) || '—' }), h('td', { text: maskCount(sum.mask) + '/' + (sum.nsec || 0) }),
          h('td', { text: ((f.latest && f.latest.weak) || []).join(', ') || '—' })]));
      });
      var c = store.state.combined || {};
      if (c.best) tb.appendChild(h('tr', {}, [h('td', { text: 'combined' }), h('td', { text: fmtRec(c.best) }), h('td', { text: fmtRec(c.latest) }), h('td', { text: '' }), h('td', { text: '' })]));
      el.appendChild(h('div', { 'class': 'cc-tablewrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['Page', 'Final best', 'Latest', 'Sections mastered', 'Weak'].map(t => { return h('th', { text: t }); }))]), tb])]));
      store.notes().forEach(n => { el.appendChild(h('p', { 'class': n.indexOf('not being saved') >= 0 ? 'cc-unsaved' : 'cc-hint', text: n.replace(/[()]/g, '') })); });
      var armed = false, rb;
      rb = btn('Reset all scores', 'reset', () => {
        if (!armed) { armed = true; rb.textContent = 'Click again to erase every score'; return; }
        store.reset('all'); draw();
      }, 'cc-ghost');
      el.appendChild(h('div', { 'class': 'cc-ctl' }, [exportUI(), rb]));
    };
    draw();
    return { el: el, redraw: draw };
  }
};

/* ================================================================ accordion */

CC.accordion = {
  init: () => {
    if (!doc) return;
    var bar = doc.querySelector('[data-cc-accordion-bar]');
    if (!bar) {
      var first = doc.querySelector('section.cc-sec');
      if (!first) return;
      bar = h('div', { 'data-cc-accordion-bar': '' });
      first.parentNode.insertBefore(bar, first);
    }
    if (bar.getAttribute('data-cc-done')) return;
    bar.setAttribute('data-cc-done', '1');
    bar.classList.add('cc-bar');
    var all = () => { return Array.prototype.slice.call(doc.querySelectorAll('details')); };
    bar.appendChild(btn('Open all working equations', 'open-l2', () => { all().forEach(d => { if (d.classList.contains('l2')) d.open = true; }); }));
    bar.appendChild(btn('Close all', 'close-all', () => { all().forEach(d => { d.open = false; }); }));
    var note = unsavedNote(); if (note) bar.appendChild(note);
    var open = (store.state.ui && store.state.ui.open) || {};
    all().forEach(d => {
      if (!d.id) return;
      if (open[d.id] === true) d.open = true;
      d.addEventListener('toggle', () => {
        var p = { open: {} }; p.open[d.id] = d.open;
        store.set('*ui', p);
      });
    });
  }
};

/* ================================================================ init */

CC.register = bank => { if (bank && bank.page) CC.banks[bank.page] = bank; return bank; };
CC.init = opts => {
  opts = opts || {};
  if (CC._inited) return CC;
  CC._inited = true;
  var B = root.CC_BANKS || {};
  Object.keys(B).forEach(k => { CC.register(B[k]); });
  if (opts.bank) CC.register(opts.bank);
  CC.page = opts.page || (opts.bank && opts.bank.page) || null;
  if (opts.accent && doc) doc.documentElement.style.setProperty('--cc-accent', opts.accent);
  store.load();
  Object.keys(CC.banks).forEach(p => { if (store.state.pages[p]) updateSum(p); });
  if (CC.page && CC.banks[CC.page]) { store.get(CC.page); updateSum(CC.page); }
  if (!doc) return CC;
  var each = (sel, fn) => { Array.prototype.forEach.call(doc.querySelectorAll(sel), fn); };
  each('[data-cc-quiz]', el => { CC.quiz.mount(el, el.getAttribute('data-cc-quiz')); });
  each('[data-cc-final]', el => { CC.final.mount(el, { n: +el.getAttribute('data-cc-final') || 20 }); });
  each('[data-cc-combined]', el => {
    var pg = el.getAttribute('data-cc-pages');
    CC.combined.mount(el, { n: +el.getAttribute('data-cc-combined') || 30, pages: pg ? pg.split(',') : null });
  });
  each('[data-cc-names]', el => { var pg = el.getAttribute('data-cc-names'); CC.names.mount(el, { pages: pg ? pg.split(',') : null }); });
  each('[data-cc-scoreboard]', el => { var pg = el.getAttribute('data-cc-scoreboard'); CC.scoreboard.mount(el, { pages: pg ? pg.split(',') : null }); });
  if (opts.accordion !== false) CC.accordion.init();
  return CC;
};

/* ================================================================ drawing API (SVG) */

function makeG(svg, W, H) {
  var g = { w: W, h: H, svg: svg, X: x => { return x; }, Y: y => { return y; } };
  var add = (tag, a, o) => {
    o = o || {};
    var e = svgEl(tag, a);
    if (o.cls) e.setAttribute('class', o.cls);
    ['stroke', 'fill', 'opacity'].forEach(k => { if (o[k] != null) e.setAttribute(k, o[k]); });
    if (o.width != null) e.setAttribute('stroke-width', o.width);
    if (o.dash) e.setAttribute('stroke-dasharray', o.dash);
    (o.parent || svg).appendChild(e);
    return e;
  };
  g.add = add;
  g.clear = () => { while (svg.lastChild) svg.removeChild(svg.lastChild); };
  g.line = (x1, y1, x2, y2, o) => { return add('line', { x1: x1, y1: y1, x2: x2, y2: y2 }, deepMerge({ cls: 'cc-ink' }, o || {})); };
  g.path = (d, o) => { return add('path', { d: d }, deepMerge({ cls: 'cc-ink', fill: 'none' }, o || {})); };
  g.dot = (x, y, r, o) => { return add('circle', { cx: x, cy: y, r: r || 4 }, deepMerge({ cls: 'cc-dot' }, o || {})); };
  g.rect = (x, y, w, hh, o) => { return add('rect', { x: x, y: y, width: w, height: hh }, o); };
  g.text = (x, y, s, o) => {
    o = o || {};
    var e = add('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', 'font-size': o.size || 12 }, deepMerge({ cls: 'cc-lbl' }, o));
    e.textContent = s; return e;
  };
  g.axis = a => {
    var p = deepMerge({ l: 44, r: 12, t: 12, b: 32 }, a.pad || {});
    var x0 = a.x[0], x1 = a.x[1], y0 = a.y[0], y1 = a.y[1];
    g.xr0 = x0; g.xr1 = x1;
    g.X = x => { return p.l + (x - x0) / (x1 - x0) * (W - p.l - p.r); };
    g.Y = y => { return H - p.b - (y - y0) / (y1 - y0) * (H - p.t - p.b); };
    g.box = p;
    g.line(p.l, H - p.b, W - p.r, H - p.b, { cls: 'cc-axis' });
    g.line(p.l, p.t, p.l, H - p.b, { cls: 'cc-axis' });
    var ticks = (lo, hi) => { var n = a.ticks || 4, out = []; for (var i = 0; i <= n; i++) out.push(lo + (hi - lo) * i / n); return out; };
    var f = v => { return Math.abs(v) >= 100 || v === Math.round(v) ? String(Math.round(v)) : v.toFixed(Math.abs(v) < 1 ? 2 : 1); };
    ticks(x0, x1).forEach(v => { g.text(g.X(v), H - p.b + 14, f(v), { anchor: 'middle', size: 10, cls: 'cc-tick' }); });
    ticks(y0, y1).forEach(v => { g.text(p.l - 5, g.Y(v) + 3, f(v), { anchor: 'end', size: 10, cls: 'cc-tick' }); });
    if (a.xlabel) g.text(W - p.r, H - 4, a.xlabel, { anchor: 'end', size: 11 });
    if (a.ylabel) g.text(p.l + 4, p.t + 10, a.ylabel, { size: 11 });
    return g;
  };
  g.curve = (pts, o) => {
    var d = '', pen = false;
    pts.forEach(q => {
      var X = g.X(q[0]), Y = g.Y(q[1]);
      if (!isFinite(X) || !isFinite(Y)) { pen = false; return; }
      d += (pen ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1); pen = true;
    });
    return g.path(d, o);
  };
  g.plot = (fn, o) => {
    o = o || {};
    var a = o.x || [g.xr0, g.xr1], n = o.n || 160, pts = [];
    for (var i = 0; i <= n; i++) { var x = a[0] + (a[1] - a[0]) * i / n, y = fn(x); pts.push([x, y]); }
    var clipY = o.clip;
    if (clipY) pts = pts.map(q => { return q[1] < clipY[0] || q[1] > clipY[1] ? [q[0], NaN] : q; });
    return g.curve(pts, o);
  };
  return g;
}
function newSvg(el, W, H, label) {
  var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': label, 'class': 'cc-svg', preserveAspectRatio: 'xMidYMid meet' });
  el.appendChild(svg);
  return svg;
}
function slider(k, v, onInput) {
  var id = nextId('rng'), out = h('output', { 'for': id, text: String(v.init) });
  var inp = h('input', { type: 'range', id: id, min: v.min, max: v.max, step: v.step || 'any', value: v.init });
  inp.addEventListener('input', () => { out.textContent = inp.value; onInput(k, +inp.value); });
  return { el: h('label', { 'class': 'cc-slider' }, [h('span', { html: v.label || k }), inp, out]), input: inp, out: out };
}

/* ================================================================ trace */

CC.trace = (el, spec) => {
  var id = graphicId(el, spec, 'trace');
  el.classList.add('cc-trace', 'cc-graphic');
  el.innerHTML = '';
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  var W = spec.width || ((el.clientWidth || 600) < 480 ? 400 : 600), H = spec.height || 260, steps = spec.steps || [], mode = spec.mode || 'both';
  var eq = h('div', { 'class': 'cc-eq math-block' });
  var terms = {};
  (spec.eq || []).forEach(t => {
    var s = h('span', { 'class': t.t ? 'term' : 'op', html: t.html });
    if (t.t) { s.setAttribute('data-t', t.t); terms[t.t] = s; }
    eq.appendChild(s); eq.appendChild(doc.createTextNode(' '));
  });
  el.appendChild(eq);
  var svg = newSvg(el, W, H, spec.label || ('Equation trace ' + id));
  var g = makeG(svg, W, H);
  var cap = h('p', { 'class': 'cc-cap', 'aria-live': 'polite' });
  el.appendChild(cap);
  var ctl = h('div', { 'class': 'cc-ctl' });
  el.appendChild(ctl);
  var vars = {}, sliders = {}, step = 0, timer = null;
  Object.keys(spec.vars || {}).forEach(k => { vars[k] = spec.vars[k].init; });
  var counter = h('span', { 'class': 'cc-hint' });
  var render = () => {
    g.clear();
    if (spec.base) spec.base(g, vars);
    var from = spec.cumulative === false ? step : 0;
    for (var i = from; i <= step && i < steps.length; i++) if (steps[i].draw) steps[i].draw(g, vars, i === step);
    var lit = {}, done = {};
    ((steps[step] || {}).lit || []).forEach(t => { lit[t] = 1; });
    if (spec.cumulative !== false) for (i = 0; i < step; i++) (steps[i].lit || []).forEach(t => { done[t] = 1; });
    Object.keys(terms).forEach(t => { terms[t].classList.toggle('lit', !!lit[t]); terms[t].classList.toggle('done', !lit[t] && !!done[t]); });
    var c = (steps[step] || {}).caption;
    cap.innerHTML = typeof c === 'function' ? c(vars) : (c || '');
    counter.textContent = steps.length ? 'step ' + (step + 1) + ' / ' + steps.length : '';
  };
  var go = i => { step = Math.max(0, Math.min(steps.length - 1, i)); render(); };
  var stop = () => { if (timer) { clearTimeout(timer); timer = null; } if (playB) playB.textContent = 'Play'; };
  var play = () => {
    if (timer) return stop();
    if (step >= steps.length - 1) go(0);
    playB.textContent = 'Pause';
    var tick = () => { if (step >= steps.length - 1) return stop(); go(step + 1); timer = setTimeout(tick, spec.interval || 1600); };
    timer = setTimeout(tick, spec.interval || 1600);
  };
  var playB = null;
  if (mode !== 'slider' && steps.length > 1) {
    ctl.appendChild(btn('Prev', 'prev', () => { stop(); go(step - 1); }));
    ctl.appendChild(btn('Next', 'next', () => { stop(); go(step + 1); }));
    if (!reduced()) { playB = btn('Play', 'play', play); ctl.appendChild(playB); }
    ctl.appendChild(counter);
  }
  if (mode !== 'stepper') {
    Object.keys(spec.vars || {}).forEach(k => {
      var s = slider(k, spec.vars[k], (kk, v) => { vars[kk] = v; if (spec.stepOf) step = Math.max(0, Math.min(steps.length - 1, spec.stepOf(vars) | 0)); render(); });
      sliders[k] = s; ctl.appendChild(s.el);
    });
  }
  el.addEventListener('keydown', e => {
    if (e.target !== el) return;
    if (e.key === 'ArrowRight') { stop(); go(step + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { stop(); go(step - 1); e.preventDefault(); }
    else if (e.key === ' ' && playB) { play(); e.preventDefault(); }
  });
  if (spec.stepOf) step = Math.max(0, Math.min(steps.length - 1, spec.stepOf(vars) | 0));
  render();
  return register(id, {
    el: el, g: g, checks: spec.checks || {},
    state: () => { return { step: step, vars: deepMerge({}, vars) }; },
    set: v => {
      Object.keys(v).forEach(k => { vars[k] = v[k]; if (sliders[k]) { sliders[k].input.value = v[k]; sliders[k].out.textContent = String(v[k]); } });
      if (spec.stepOf) step = Math.max(0, Math.min(steps.length - 1, spec.stepOf(vars) | 0));
      render();
    },
    go: go, render: render
  });
};

/* ================================================================ flow */

function rk4(f, x, y, dt) {
  var a = f(x, y), b = f(x + dt / 2 * a[0], y + dt / 2 * a[1]), c = f(x + dt / 2 * b[0], y + dt / 2 * b[1]), d = f(x + dt * c[0], y + dt * c[1]);
  return [x + dt / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]), y + dt / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1])];
}
function integrate(f, x0, y0, o) {
  var pts = [[x0, y0]], x = x0, y = y0, dt = o.dt || 0.02, n = o.steps || 2000, xr = o.x, yr = o.y;
  var wx = xr[1] - xr[0], wy = yr[1] - yr[0], k;
  for (k = 0; k < n; k++) {
    var q = rk4(f, x, y, dt);
    if (!isFinite(q[0]) || !isFinite(q[1])) break;
    x = q[0]; y = q[1]; pts.push([x, y]);
    if (x < xr[0] - wx || x > xr[1] + wx || y < yr[0] - wy || y > yr[1] + wy) { k++; break; }
  }
  return { pts: pts, ell: k * dt };
}
CC.core.integrate = integrate;
function contour(fn, level, xr, yr, nx, ny) {
  var segs = [], dx = (xr[1] - xr[0]) / nx, dy = (yr[1] - yr[0]) / ny, v = [];
  for (var j = 0; j <= ny; j++) { v.push([]); for (var i = 0; i <= nx; i++) v[j].push(fn(xr[0] + i * dx, yr[0] + j * dy) - level); }
  var lerp = (a, b) => { return a / (a - b); };
  for (j = 0; j < ny; j++) for (i = 0; i < nx; i++) {
    var c = [v[j][i], v[j][i + 1], v[j + 1][i + 1], v[j + 1][i]];
    var X = xr[0] + i * dx, Y = yr[0] + j * dy, P = [];
    var E = [[0, 1, t => { return [X + t * dx, Y]; }], [1, 2, t => { return [X + dx, Y + t * dy]; }],
             [3, 2, t => { return [X + t * dx, Y + dy]; }], [0, 3, t => { return [X, Y + t * dy]; }]];
    E.forEach(e => { var a = c[e[0]], b = c[e[1]]; if ((a < 0) !== (b < 0) && isFinite(a) && isFinite(b)) P.push(e[2](lerp(a, b))); });
    if (P.length >= 2) segs.push([P[0], P[1]]);
    if (P.length === 4) segs.push([P[2], P[3]]);
  }
  return segs;
}
CC.flow = (el, spec) => {
  var id = graphicId(el, spec, 'flow');
  el.classList.add('cc-flow', 'cc-graphic');
  el.innerHTML = '';
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  var W = spec.width || ((el.clientWidth || 600) < 480 ? 400 : 600), H = spec.height || 360;
  var svg = newSvg(el, W, H, spec.label || ('Flow diagram ' + id));
  var g = makeG(svg, W, H);
  var read = h('p', { 'class': 'cc-readout', 'aria-live': 'polite' });
  el.appendChild(read);
  var x0 = spec.start ? spec.start[0] : (spec.x[0] + spec.x[1]) / 2, y0 = spec.start ? spec.start[1] : (spec.y[0] + spec.y[1]) / 2;
  var traj = null, layer = {}, anim = null, visible = true;
  var draw = () => {
    g.clear();
    g.axis({ x: spec.x, y: spec.y, xlabel: spec.xlabel, ylabel: spec.ylabel, pad: spec.pad });
    var nx = spec.grid || 14, ny = Math.max(4, Math.round(nx * (H / W))), cx = (spec.x[1] - spec.x[0]) / nx, cy = (spec.y[1] - spec.y[0]) / ny;
    for (var i = 0; i <= nx; i++) for (var j = 0; j <= ny; j++) {
      var x = spec.x[0] + i * cx, y = spec.y[0] + j * cy, v = spec.f(x, y), X = g.X(x), Y = g.Y(y);
      var vx = g.X(x + v[0]) - X, vy = g.Y(y + v[1]) - Y, m = Math.sqrt(vx * vx + vy * vy);
      if (!(m > 1e-9)) { g.dot(X, Y, 1.5, { cls: 'cc-arrow-0' }); continue; }
      var Lp = Math.min(W / nx, H / ny) * 0.38, ux = vx / m * Lp, uy = vy / m * Lp;
      g.line(X - ux / 2, Y - uy / 2, X + ux / 2, Y + uy / 2, { cls: 'cc-arrow' });
      g.dot(X + ux / 2, Y + uy / 2, 1.6, { cls: 'cc-arrow-head' });
    }
    if (spec.draw) spec.draw(g);
    if (spec.inv) {
      contour(spec.inv, spec.inv(x0, y0), spec.x, spec.y, 60, 40).forEach(s => {
        g.line(g.X(s[0][0]), g.Y(s[0][1]), g.X(s[1][0]), g.Y(s[1][1]), { cls: 'cc-inv' });
      });
    }
    traj = integrate(spec.f, x0, y0, { dt: spec.dt, steps: spec.steps, x: spec.x, y: spec.y });
    g.curve(traj.pts, { cls: 'cc-traj', width: 2.5 });
    if (spec.overlay) spec.overlay(g, api.state());
    layer.mover = g.dot(g.X(x0), g.Y(y0), 3, { cls: 'cc-mover' });
    layer.handle = g.dot(g.X(x0), g.Y(y0), 7, { cls: 'cc-handle' });
    var end = traj.pts[traj.pts.length - 1];
    read.innerHTML = (spec.readout ? spec.readout(api.state()) + ' · ' : '') +
      'start (' + x0.toFixed(3) + ', ' + y0.toFixed(3) + ') → end (' + end[0].toFixed(3) + ', ' + end[1].toFixed(3) + ') after ℓ = ' + traj.ell.toFixed(2);
  };
  var toData = e => {
    var r = svg.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H);
    var ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2;
    var px = (e.clientX - r.left - ox) / s, py = (e.clientY - r.top - oy) / s, b = g.box;
    var x = spec.x[0] + (px - b.l) / (W - b.l - b.r) * (spec.x[1] - spec.x[0]);
    var y = spec.y[0] + (H - b.b - py) / (H - b.t - b.b) * (spec.y[1] - spec.y[0]);
    return [Math.max(spec.x[0], Math.min(spec.x[1], x)), Math.max(spec.y[0], Math.min(spec.y[1], y))];
  };
  var down = false;
  svg.addEventListener('pointerdown', e => { down = true; try { svg.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } var p = toData(e); api.set(p[0], p[1]); e.preventDefault(); });
  svg.addEventListener('pointermove', e => { if (!down) return; var p = toData(e); api.set(p[0], p[1]); });
  svg.addEventListener('pointerup', () => { down = false; });
  svg.addEventListener('pointercancel', () => { down = false; });
  svg.style.touchAction = 'none';
  el.addEventListener('keydown', e => {
    var sx = (spec.x[1] - spec.x[0]) / 100, sy = (spec.y[1] - spec.y[0]) / 100, d = { ArrowLeft: [-sx, 0], ArrowRight: [sx, 0], ArrowUp: [0, sy], ArrowDown: [0, -sy] }[e.key];
    if (!d || e.target !== el) return;
    api.set(x0 + d[0], y0 + d[1]); e.preventDefault();
  });
  var api = register(id, {
    el: el, g: g, checks: spec.checks || {},
    state: () => { return { x0: x0, y0: y0, traj: traj ? traj.pts : [], ell: traj ? traj.ell : 0 }; },
    set: (x, y) => { x0 = x; y0 = y; draw(); },
    redraw: () => { draw(); }
  });
  draw();
  if (spec.animate && !reduced() && root.requestAnimationFrame) {
    var k = 0;
    if (root.IntersectionObserver) new IntersectionObserver(en => { visible = en[0].isIntersecting; if (visible && !anim) anim = requestAnimationFrame(tick); }).observe(el);
    var tick = () => {
      anim = null;
      if (!visible) return;
      var p = traj.pts, q = p[Math.floor(k) % p.length];
      if (layer.mover && q) { layer.mover.setAttribute('cx', g.X(q[0])); layer.mover.setAttribute('cy', g.Y(q[1])); }
      k += Math.max(1, p.length / 240);
      anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }
  return api;
};

/* ================================================================ Monte Carlo toy */

function hsl(hue) { // hue 0..1 → [r,g,b], s = 0.65, l = 0.55
  var s = 0.65, l = 0.55, q = l + s - l * s, p = 2 * l - q;
  var f = t => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(hue + 1 / 3) * 255 | 0, f(hue) * 255 | 0, f(hue - 1 / 3) * 255 | 0];
}
var PAL = [[59, 130, 246], [245, 158, 11], [34, 197, 94], [168, 85, 247], [239, 68, 68], [6, 182, 212], [236, 72, 153], [203, 213, 225]];
var MODELS = {
  ising: {
    params: { T: 2.5, h: 0 }, sliders: { T: { min: 0.5, max: 5, step: 0.01, label: 'T' } },
    alloc: N => { return new Int8Array(N); },
    init: (s, rng) => { for (var i = 0; i < s.length; i++) s[i] = rng() < 0.5 ? 1 : -1; },
    sweep: (s, nb, N, P, rng) => {
      var w = new Float64Array(18);
      for (var sum = -4; sum <= 4; sum++) for (var sp = 0; sp < 2; sp++) { var si = sp ? 1 : -1; w[(sum + 4) * 2 + sp] = Math.exp(-2 * si * (sum + P.h) / P.T); }
      for (var k = 0; k < N; k++) {
        var i = (rng() * N) | 0, t = nb[4 * i];
        var su = s[t] + s[nb[4 * i + 1]] + s[nb[4 * i + 2]] + s[nb[4 * i + 3]];
        var x = w[(su + 4) * 2 + (s[i] > 0 ? 1 : 0)];
        if (x >= 1 || rng() < x) s[i] = -s[i];
      }
    },
    measure: (s, nb, N, P) => {
      var e = 0, m = 0;
      for (var i = 0; i < N; i++) { m += s[i]; e -= s[i] * (s[nb[4 * i]] + s[nb[4 * i + 2]]) + P.h * s[i]; }
      return { e: e / N, m: Math.abs(m) / N };
    },
    color: (s, i) => { return s[i] > 0 ? PAL[1] : PAL[0]; },
    hist: true
  },
  xy: {
    params: { T: 0.7, delta: 1.0 }, sliders: { T: { min: 0.1, max: 2, step: 0.01, label: 'T' } },
    alloc: N => { return new Float32Array(N); },
    init: (s, rng) => { for (var i = 0; i < s.length; i++) s[i] = rng() * 2 * Math.PI; },
    sweep: (s, nb, N, P, rng) => {
      for (var k = 0; k < N; k++) {
        var i = (rng() * N) | 0, o = s[i], n = o + (rng() - 0.5) * 2 * P.delta, dE = 0;
        for (var d = 0; d < 4; d++) { var t = s[nb[4 * i + d]]; dE -= Math.cos(n - t) - Math.cos(o - t); }
        if (dE <= 0 || rng() < Math.exp(-dE / P.T)) s[i] = n;
      }
    },
    measure: (s, nb, N) => {
      var e = 0, c = 0, sn = 0;
      for (var i = 0; i < N; i++) { c += Math.cos(s[i]); sn += Math.sin(s[i]); e -= Math.cos(s[i] - s[nb[4 * i]]) + Math.cos(s[i] - s[nb[4 * i + 2]]); }
      return { e: e / N, m: Math.sqrt(c * c + sn * sn) / N };
    },
    color: (s, i) => { return hsl(s[i] / (2 * Math.PI)); }
  },
  at: {
    params: { K: 0.3, L: 0.0 }, sliders: { K: { min: 0, max: 1, step: 0.005, label: 'K' }, L: { min: -0.5, max: 1, step: 0.005, label: 'L (four-spin)' } },
    alloc: N => { return new Int8Array(2 * N); },
    init: (s, rng) => { for (var i = 0; i < s.length; i++) s[i] = rng() < 0.5 ? 1 : -1; },
    sweep: (s, nb, N, P, rng) => {
      for (var k = 0; k < 2 * N; k++) {
        var i = (rng() * N) | 0, layer = rng() < 0.5 ? 0 : N, other = layer ? 0 : N, a = s[layer + i], b = s[other + i], acc = 0;
        for (var d = 0; d < 4; d++) { var j = nb[4 * i + d]; acc += s[layer + j] * (P.K + P.L * b * s[other + j]); }
        var dE = 2 * a * acc;
        if (dE <= 0 || rng() < Math.exp(-dE)) s[layer + i] = -a;
      }
    },
    measure: (s, nb, N, P) => {
      var e = 0, ms = 0, mt = 0, mp = 0;
      for (var i = 0; i < N; i++) {
        var si = s[i], ti = s[N + i]; ms += si; mt += ti; mp += si * ti;
        for (var d = 0; d < 4; d += 2) { var j = nb[4 * i + d]; e -= P.K * (si * s[j] + ti * s[N + j]) + P.L * si * s[j] * ti * s[N + j]; }
      }
      return { e: e / N, m: Math.abs(ms) / N, m_tau: Math.abs(mt) / N, m_sigma_tau: Math.abs(mp) / N };
    },
    color: (s, i, N) => { return PAL[(s[i] > 0 ? 1 : 0) + (s[N + i] > 0 ? 2 : 0)]; },
    hist: true
  },
  bc: {
    params: { T: 1.2, D: 1.0, J: 1 }, sliders: { D: { min: 0, max: 2.5, step: 0.005, label: '&Delta;' }, T: { min: 0.2, max: 3, step: 0.005, label: 'T' } },
    alloc: N => { return new Int8Array(N); },
    init: (s, rng) => { for (var i = 0; i < s.length; i++) s[i] = ((rng() * 3) | 0) - 1; },
    sweep: (s, nb, N, P, rng) => {
      for (var k = 0; k < N; k++) {
        var i = (rng() * N) | 0, o = s[i], n = o + 1 + ((rng() * 2) | 0); n = ((n + 1) % 3) - 1;
        var su = s[nb[4 * i]] + s[nb[4 * i + 1]] + s[nb[4 * i + 2]] + s[nb[4 * i + 3]];
        var dE = -P.J * (n - o) * su + P.D * (n * n - o * o);
        if (dE <= 0 || rng() < Math.exp(-dE / P.T)) s[i] = n;
      }
    },
    measure: (s, nb, N, P) => {
      var e = 0, m = 0, z = 0;
      for (var i = 0; i < N; i++) { m += s[i]; if (!s[i]) z++; e += -P.J * s[i] * (s[nb[4 * i]] + s[nb[4 * i + 2]]) + P.D * s[i] * s[i]; }
      return { e: e / N, m: Math.abs(m) / N, vacancy: z / N };
    },
    color: (s, i) => { return s[i] > 0 ? PAL[1] : s[i] < 0 ? PAL[0] : [30, 41, 59]; }
  },
  potts: {
    params: { T: 0.8, q: 3 }, sliders: { q: { min: 2, max: 8, step: 1, label: 'q' }, T: { min: 0.3, max: 2, step: 0.005, label: 'T' } },
    alloc: N => { return new Int8Array(N); },
    init: (s, rng, P) => { for (var i = 0; i < s.length; i++) s[i] = (rng() * P.q) | 0; },
    sweep: (s, nb, N, P, rng) => {
      var q = P.q | 0;
      for (var k = 0; k < N; k++) {
        var i = (rng() * N) | 0, o = s[i], n = (o + 1 + ((rng() * (q - 1)) | 0)) % q, dn = 0;
        for (var d = 0; d < 4; d++) { var t = s[nb[4 * i + d]]; dn += (t === n ? 1 : 0) - (t === o ? 1 : 0); }
        if (dn >= 0 || rng() < Math.exp(dn / P.T)) s[i] = n;
      }
    },
    measure: (s, nb, N, P) => {
      var q = P.q | 0, c = new Int32Array(8), e = 0;
      for (var i = 0; i < N; i++) { c[s[i]]++; e -= (s[i] === s[nb[4 * i]] ? 1 : 0) + (s[i] === s[nb[4 * i + 2]] ? 1 : 0); }
      var mx = 0; for (i = 0; i < q; i++) mx = Math.max(mx, c[i]);
      return { e: e / N, m: (q * mx / N - 1) / (q - 1) };
    },
    color: (s, i) => { return PAL[s[i] % 8]; },
    hist: true
  }
};
CC.toy = { models: MODELS };
function neighbours(L) {
  var nb = new Int32Array(4 * L * L);
  for (var y = 0; y < L; y++) for (var x = 0; x < L; x++) {
    var i = y * L + x;
    nb[4 * i] = y * L + (x + 1) % L; nb[4 * i + 1] = y * L + (x + L - 1) % L;
    nb[4 * i + 2] = ((y + 1) % L) * L + x; nb[4 * i + 3] = ((y + L - 1) % L) * L + x;
  }
  return nb;
}
/* One 2×2 block step. Discrete spins: the majority (Ising/BC: sign of the sum; Potts: the most
   frequent state), ties resolved by the block's top-left spin (deterministic). XY: the mean angle. */
function blockOnce(model, s, L) {
  var M = L >> 1, out = model === 'xy' ? new Float32Array(M * M) : new Int8Array(M * M);
  for (var y = 0; y < M; y++) for (var x = 0; x < M; x++) {
    var ids = [(2 * y) * L + 2 * x, (2 * y) * L + 2 * x + 1, (2 * y + 1) * L + 2 * x, (2 * y + 1) * L + 2 * x + 1], v;
    if (model === 'xy') { var c = 0, sn = 0; ids.forEach(i => { c += Math.cos(s[i]); sn += Math.sin(s[i]); }); v = Math.atan2(sn, c); }
    else if (model === 'potts') {
      var cnt = {}, best = s[ids[0]], bn = 0;
      ids.forEach(i => { cnt[s[i]] = (cnt[s[i]] || 0) + 1; });
      ids.forEach(i => { if (cnt[s[i]] > bn) { bn = cnt[s[i]]; best = s[i]; } });
      v = cnt[s[ids[0]]] === bn ? s[ids[0]] : best;
    } else { var su = 0; ids.forEach(i => { su += s[i]; }); v = su > 0 ? 1 : su < 0 ? -1 : s[ids[0]]; }
    out[y * M + x] = v;
  }
  return out;
}
function nnCorr(model, s, L) {
  var t = 0, n = 0;
  for (var y = 0; y < L; y++) for (var x = 0; x < L; x++) {
    var i = y * L + x, r = y * L + (x + 1) % L, d = ((y + 1) % L) * L + x;
    [r, d].forEach(j => { t += model === 'xy' ? Math.cos(s[i] - s[j]) : model === 'potts' ? (s[i] === s[j] ? 1 : 0) : s[i] * s[j]; n++; });
  }
  return t / n;
}
CC.core.blockOnce = blockOnce; CC.core.nnCorr = nnCorr;

CC.toy.lattice = (el, spec) => {
  spec = spec || {};
  var id = graphicId(el, spec, 'toy');
  var M = MODELS[spec.model || 'ising'];
  var model = spec.model || 'ising';
  el.classList.add('cc-toy', 'cc-graphic');
  el.innerHTML = '';
  var narrow = (el.clientWidth || 600) < 420;
  var L = spec.size || (narrow ? 32 : 64), N = L * L, nb = neighbours(L);
  var P = deepMerge(deepMerge({}, M.params), spec.params || {});
  var seed = spec.seed == null ? 1 : spec.seed, rng, s, sweeps = 0, running = false, raf = null, visible = true;
  var hist = [], obs = {};
  var wrapC = h('div', { 'class': 'cc-toy-main' });
  var cv = h('canvas', { 'class': 'cc-canvas', role: 'img', 'aria-label': spec.label || (model + ' Monte Carlo toy, ' + L + ' by ' + L) });
  wrapC.appendChild(cv);
  el.appendChild(wrapC);
  var off = doc.createElement('canvas'); off.width = L; off.height = L;
  var octx = off.getContext('2d'), img = octx.createImageData(L, L);
  var levels = Math.max(0, Math.min(3, (spec.levels || 1) - 1));
  var lvWrap = null, lvCanvases = [];
  if (levels) {
    lvWrap = h('div', { 'class': 'cc-levels' });
    for (var k = 0; k <= levels; k++) {
      var c = h('canvas', { 'class': 'cc-canvas cc-level', role: 'img', 'aria-label': 'block level ' + k + ', ' + (L >> k) + ' by ' + (L >> k) });
      var fig = h('figure', {}, [c, h('figcaption', { text: (L >> k) + '×' + (L >> k) })]);
      lvWrap.appendChild(fig); lvCanvases.push({ c: c, cap: fig.lastChild });
    }
    el.appendChild(lvWrap);
  }
  var hc = null;
  if (M.hist && spec.hist !== false) { hc = h('canvas', { 'class': 'cc-canvas cc-hist', role: 'img', 'aria-label': 'energy histogram' }); el.appendChild(hc); }
  var read = h('p', { 'class': 'cc-readout', 'aria-live': 'off' });
  el.appendChild(read);
  var ctl = h('div', { 'class': 'cc-ctl' });
  el.appendChild(ctl);
  var dpr = () => { return Math.min(2, root.devicePixelRatio || 1); };
  var size = (canvas, cssW, cssH) => {
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr()); canvas.height = Math.round(cssH * dpr());
  };
  var layout = () => {
    var w = Math.min(spec.px || 320, Math.max(120, (el.clientWidth || 320) - 2));
    size(cv, w, w);
    lvCanvases.forEach(o => { var lw = Math.max(40, Math.floor((Math.min(el.clientWidth || 320, 640) - 24) / lvCanvases.length) - 8); size(o.c, lw, lw); });
    if (hc) size(hc, Math.min(w, 320), 70);
  };
  var paint = (canvas, arr, n, colorFn) => {
    var o = n === L ? { c: off, x: octx, im: img } : (function () { var cc = doc.createElement('canvas'); cc.width = n; cc.height = n; var x = cc.getContext('2d'); return { c: cc, x: x, im: x.createImageData(n, n) }; })();
    var d = o.im.data;
    for (var i = 0; i < n * n; i++) { var col = colorFn(arr, i, n * n); d[4 * i] = col[0]; d[4 * i + 1] = col[1]; d[4 * i + 2] = col[2]; d[4 * i + 3] = 255; }
    o.x.putImageData(o.im, 0, 0);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(o.c, 0, 0, canvas.width, canvas.height);
  };
  var layer0 = () => { return model === 'at' ? s.subarray(0, N) : s; };
  var blockModel = model === 'at' ? 'ising' : model === 'bc' ? 'ising' : model;
  var draw = () => {
    paint(cv, s, L, M.color);
    if (levels) {
      var cur = layer0(), n = L, bm = blockModel;
      lvCanvases.forEach((o, k) => {
        if (k) { cur = blockOnce(bm, cur, n); n = n >> 1; }
        paint(o.c, cur, n, bm === model ? M.color : MODELS.bc.color);
        o.cap.textContent = n + '×' + n + ' · nn ' + nnCorr(bm, cur, n).toFixed(3);
      });
    }
    if (hc) {
      var ctx = hc.getContext('2d'), W = hc.width, H = hc.height, bins = 40;
      ctx.clearRect(0, 0, W, H);
      if (hist.length > 1) {
        var lo = Math.min.apply(null, hist), hi = Math.max.apply(null, hist), cnt = new Array(bins).fill(0), mx = 1;
        if (hi - lo < 1e-9) { lo -= 0.01; hi += 0.01; }
        hist.forEach(e => { var b = Math.min(bins - 1, Math.floor((e - lo) / (hi - lo) * bins)); cnt[b]++; });
        cnt.forEach(c => { mx = Math.max(mx, c); });
        ctx.fillStyle = '#f59e0b';
        cnt.forEach((c, i) => { var bh = c / mx * (H - 4); ctx.fillRect(i * W / bins + 1, H - bh, W / bins - 2, bh); });
      }
    }
    obs = M.measure(s, nb, N, P);
    read.innerHTML = 'sweeps ' + sweeps + ' · energy/site ' + obs.e.toFixed(4) + ' · ' +
      Object.keys(obs).filter(k => { return k !== 'e'; }).map(k => { return (k === 'm' ? '|m|' : k.replace(/_/g, ' ')) + ' ' + obs[k].toFixed(4); }).join(' · ');
  };
  var doSweeps = n => {
    for (var i = 0; i < n; i++) {
      M.sweep(s, nb, N, P, rng); sweeps++;
      if (hc) { hist.push(M.measure(s, nb, N, P).e); if (hist.length > (spec.histN || 400)) hist.shift(); }
    }
  };
  var reset = () => {
    rng = mulberry32(seed); s = M.alloc(N); M.init(s, rng, P); sweeps = 0; hist = [];
    if (spec.start === 'cold') for (var i = 0; i < s.length; i++) s[i] = model === 'xy' ? 0 : model === 'potts' ? 0 : 1;
    draw();
  };
  var frame = () => {
    raf = null;
    if (!running || !visible) return;
    var t0 = (root.performance || Date).now(), n = 0;
    do { doSweeps(1); n++; } while ((root.performance || Date).now() - t0 < (spec.budgetMs || 12) && n < (spec.maxPerFrame || 50));
    draw();
    raf = requestAnimationFrame(frame);
  };
  var runB = null;
  var run = () => { if (reduced() || running) return; running = true; if (runB) runB.textContent = 'Pause'; if (!raf) raf = requestAnimationFrame(frame); };
  var pause = () => { running = false; if (runB) runB.textContent = 'Run'; if (raf) { cancelAnimationFrame(raf); raf = null; } };
  if (!reduced()) { runB = btn('Run', 'run', () => { if (running) pause(); else run(); }, 'cc-primary'); ctl.appendChild(runB); }
  ctl.appendChild(btn('Step', 'step', () => { doSweeps(spec.stepSweeps || 1); draw(); }));
  ctl.appendChild(btn('Reset', 'reset', () => { pause(); reset(); }));
  var sliders = {};
  var sl = spec.sliders || M.sliders;
  Object.keys(sl).forEach(k => {
    var v = deepMerge({}, sl[k]); v.init = P[k];
    var o = slider(k, v, (kk, val) => { P[kk] = val; hist = []; if (kk === 'q') { for (var i = 0; i < N; i++) s[i] = s[i] % val; } if (!running) draw(); if (spec.onParams) spec.onParams(P, api); });
    sliders[k] = o; ctl.appendChild(o.el);
  });
  cv.addEventListener('pointerdown', e => {
    if (!spec.onCell) return;
    var r = cv.getBoundingClientRect(), i = Math.floor((e.clientY - r.top) / r.height * L), j = Math.floor((e.clientX - r.left) / r.width * L);
    spec.onCell(Math.max(0, Math.min(L - 1, i)), Math.max(0, Math.min(L - 1, j)), api, e);
  });
  if (root.IntersectionObserver) new IntersectionObserver(en => { visible = en[0].isIntersecting; if (visible && running && !raf) raf = requestAnimationFrame(frame); }).observe(el);
  if (root.addEventListener) root.addEventListener('resize', () => { layout(); draw(); });
  var api = register(id, {
    el: el, checks: spec.checks || {}, model: model,
    get size() { return L; }, get spins() { return s; },
    state: () => { return { model: model, size: L, params: deepMerge({}, P), sweeps: sweeps, obs: deepMerge({}, obs), running: running }; },
    set: p => { Object.keys(p).forEach(k => { P[k] = p[k]; if (sliders[k]) { sliders[k].input.value = p[k]; sliders[k].out.textContent = String(p[k]); } }); hist = []; draw(); },
    step: n => { doSweeps(n || 1); draw(); }, run: run, pause: pause, reset: reset, redraw: () => { draw(); },
    block: b => {
      var cur = layer0(), n = L;
      while (b > 1 && n > 1) { cur = blockOnce(blockModel, cur, n); n >>= 1; b >>= 1; }
      return { size: n, spins: cur };
    },
    nn: () => { return nnCorr(blockModel, layer0(), L); },
    plant: (ci, cj, q) => { // XY only: add a vortex of charge q centred on the plaquette below-right of (ci, cj)
      for (var y = 0; y < L; y++) for (var x = 0; x < L; x++) s[y * L + x] += q * Math.atan2(y - ci - 0.5, x - cj - 0.5);
      draw();
    },
    winding: (i0, j0, i1, j1) => { // XY only: sum of wrapped phase differences round the rectangle, in turns
      var path = [], y, x;
      for (x = j0; x < j1; x++) path.push([i0, x]);
      for (y = i0; y < i1; y++) path.push([y, j1]);
      for (x = j1; x > j0; x--) path.push([i1, x]);
      for (y = i1; y > i0; y--) path.push([y, j0]);
      var tot = 0;
      for (var k = 0; k < path.length; k++) {
        var a = s[path[k][0] * L + path[k][1]], b = s[path[(k + 1) % path.length][0] * L + path[(k + 1) % path.length][1]];
        var d = b - a; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); tot += d;
      }
      return { turns: Math.round(tot / (2 * Math.PI)), raw: tot };
    }
  });
  layout(); reset();
  if (spec.autorun) run();
  return api;
};

/* ================================================================ self-test */
/* The suite lives in cc-tutor.selftest.mjs (node runs it directly); in a browser console
   CC.selftest() loads it beside this script and resolves to {pass, fail:[names]}. */
var SELF = (doc && doc.currentScript && doc.currentScript.src) || '';
CC.selftest = () => {
  return import(SELF.replace(/[^\/]*$/, '') + 'cc-tutor.selftest.mjs').then(m => { return m.run(CC); });
};
CC.core.signKey = signKey; CC.core.SIGN_TABLE = SIGN_TABLE; CC.core.SIGN_CELLS = SIGN_CELLS; CC.core.b64u = b64u;

return CC;
});
