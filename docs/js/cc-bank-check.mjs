#!/usr/bin/env node
/**
 * cc-bank-check.mjs — validate a page's question bank against the page.
 *
 *   node docs/js/cc-bank-check.mjs <bank.js> <page.html>
 *
 * Violations (exit 1): a required field missing; an unknown tier or type; mc without 4 distinct
 * options and one in-range answer; match without 3–5 pairs of distinct strings; order without 3–6
 * options and an answer that is a permutation of them; task without a graphic and a checker name;
 * an id not prefixed "<page>-" (that prefix is what makes ids unique across pages) or repeated;
 * a section missing from the page or from bank.sections; a cite that is not a `.footnotes li` id on
 * the page; a task graphic with no data-cc-id on the page; a section with fewer than 2 items;
 * a name tier below 30 %; a data-cc-quiz list that is not the section's canonical quiz (the first
 * bank.quizN, default 3, items of the section); a final pool smaller than the final's n.
 * Warnings (printed, exit 0): a final pool smaller than 2n (a retake cannot be fully fresh).
 * The canonical quiz and the pool come from the engine itself (CC.core.quizIds), so the checker
 * and the page cannot disagree.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const [bankPath, pagePath] = process.argv.slice(2);
if (!bankPath || !pagePath) { console.error('usage: node docs/js/cc-bank-check.mjs <bank.js> <page.html>'); process.exit(2); }
const CC = createRequire(import.meta.url)('./cc-tutor.js');
const html = readFileSync(pagePath, 'utf8');
const ctx = { window: {} };
ctx.window.window = ctx.window;
try { vm.runInNewContext(readFileSync(bankPath, 'utf8'), ctx.window, { filename: bankPath }); }
catch (e) { console.error('bank does not load: ' + e.message); process.exit(1); }
const banks = ctx.window.CC_BANKS || {};
const keys = Object.keys(banks);
const V = [], W = [];
const bad = (m) => V.push(m);
if (keys.length !== 1) bad(`the bank file defines ${keys.length} banks (${keys.join(', ')}); expected exactly one`);
const bank = banks[keys[0]] || {};
const page = bank.page;
if (!page || page !== keys[0]) bad(`CC_BANKS key '${keys[0]}' and bank.page '${page}' differ`);
if (!Array.isArray(bank.sections) || !bank.sections.length) bad('bank.sections is missing or empty');
if (!Array.isArray(bank.items) || !bank.items.length) bad('bank.items is missing or empty');
const items = bank.items || [], sections = bank.sections || [];
if (bank.quizN != null && ![2, 3].includes(bank.quizN)) bad(`bank.quizN must be 2 or 3 (got ${bank.quizN})`);

/* ---- what the page declares */
const pageSections = {};
for (const m of html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)) {
  const id = (m[1].match(/\bid="([^"]+)"/) || [])[1];
  if (id) pageSections[id] = m[2];
}
const fnStart = html.search(/class="footnotes"/);
const footnotes = new Set();
if (fnStart >= 0) for (const m of html.slice(fnStart).matchAll(/<li\b[^>]*\bid="([^"]+)"/g)) footnotes.add(m[1]);
const graphics = new Set([...html.matchAll(/data-cc-id="([^"]+)"/g)].map((m) => m[1]));
if (fnStart < 0) bad('the page has no .footnotes block');

/* ---- per item */
const TIERS = CC.core.TIERS, TYPES = CC.core.TYPES, seen = new Set();
const str = (x) => typeof x === 'string' && x.trim().length > 0;
items.forEach((it, k) => {
  const at = `item ${it && it.id ? it.id : '#' + k}`;
  for (const f of ['id', 'section', 'tier', 'type', 'prompt', 'explain', 'cite']) if (!str(it[f])) bad(`${at}: missing ${f}`);
  if (str(it.id)) {
    if (seen.has(it.id)) bad(`${at}: duplicate id`);
    seen.add(it.id);
    if (!it.id.startsWith(page + '-')) bad(`${at}: id must start with '${page}-'`);
  }
  if (it.tier && !TIERS.includes(it.tier)) bad(`${at}: unknown tier '${it.tier}'`);
  if (it.type && !TYPES.includes(it.type)) bad(`${at}: unknown type '${it.type}'`);
  if (it.section && !sections.includes(it.section)) bad(`${at}: section '${it.section}' not in bank.sections`);
  if (str(it.cite) && !footnotes.has(it.cite)) bad(`${at}: cite '${it.cite}' is not a .footnotes li id on the page`);
  if (it.type === 'mc') {
    if (!Array.isArray(it.options) || it.options.length !== 4) bad(`${at}: mc needs exactly 4 options`);
    else if (new Set(it.options.map((o) => CC.core.stripTags(o))).size !== 4) bad(`${at}: mc options are not distinct`);
    if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer > 3) bad(`${at}: mc answer must be an index 0–3`);
  } else if (it.type === 'match') {
    const a = it.answer;
    if (!Array.isArray(a) || a.length < 3 || a.length > 5) bad(`${at}: match needs 3–5 pairs`);
    else {
      if (!a.every((p) => Array.isArray(p) && p.length === 2 && str(p[0]) && str(p[1]))) bad(`${at}: every match pair is [left, right] strings`);
      if (new Set(a.map((p) => p[0])).size !== a.length || new Set(a.map((p) => p[1])).size !== a.length) bad(`${at}: match lefts and rights must be distinct`);
    }
  } else if (it.type === 'order') {
    const o = it.options, a = it.answer;
    if (!Array.isArray(o) || o.length < 3 || o.length > 6) bad(`${at}: order needs 3–6 options`);
    else if (!Array.isArray(a) || a.length !== o.length || [...a].sort((x, y) => x - y).some((v, i) => v !== i)) bad(`${at}: order answer must be a permutation of the option indices`);
  } else if (it.type === 'task') {
    if (!str(it.graphic) || !str(it.check)) bad(`${at}: task needs graphic and check`);
    else if (!graphics.has(it.graphic)) bad(`${at}: graphic '${it.graphic}' has no data-cc-id on the page`);
  }
  if (it.type === 'task' && it.tier !== 'task') W.push(`${at}: a task-type item in tier '${it.tier}' (the combined test drops task types)`);
});

/* ---- per section, tiers */
const perSec = {};
items.forEach((it) => { perSec[it.section] = (perSec[it.section] || 0) + 1; });
sections.forEach((s) => {
  if (!(s in pageSections)) bad(`section '${s}' is not a <section id> on the page`);
  if ((perSec[s] || 0) < 2) bad(`section '${s}' has ${perSec[s] || 0} items (need ≥ 2)`);
});
const tierN = {};
items.forEach((it) => { tierN[it.tier] = (tierN[it.tier] || 0) + 1; });
const nameShare = items.length ? (tierN.name || 0) / items.length : 0;
if (nameShare < 0.3) bad(`name tier is ${(100 * nameShare).toFixed(0)} % of the bank (need ≥ 30 %)`);

/* ---- declared section quizzes must be the canonical ones */
const canon = {};
sections.forEach((s) => { canon[s] = CC.core.quizIdsFor(bank, s); });
let quizMounts = 0;
for (const [sid, body] of Object.entries(pageSections)) {
  for (const m of body.matchAll(/data-cc-quiz="([^"]*)"/g)) {
    quizMounts++;
    const ids = m[1].split(',').map((x) => x.trim()).filter(Boolean);
    if (!ids.length || ids[0] === 'auto') continue;
    const want = canon[sid] || [];
    if (ids.slice().sort().join() !== want.slice().sort().join()) bad(`section '${sid}': data-cc-quiz lists [${ids.join(', ')}], the canonical quiz is [${want.join(', ')}]`);
  }
}

/* ---- the final's pool */
const quiz = new Set(CC.core.quizIds(bank));
const pool = items.filter((it) => !quiz.has(it.id));
const nFinal = +((html.match(/data-cc-final="(\d+)"/) || [])[1] || (html.match(/CC\.final\.mount\([^)]*\bn\s*:\s*(\d+)/) || [])[1] || 0);
if (!nFinal) W.push('no final test found on the page (data-cc-final="n" or CC.final.mount(el, {n}))');
else if (pool.length < nFinal) bad(`the final draws ${nFinal} items but only ${pool.length} are outside the section quizzes`);
else if (pool.length < 2 * nFinal) W.push(`the final pool (${pool.length}) is under 2 × n (${2 * nFinal}): a retake will repeat items`);

/* ---- report */
const byType = {};
items.forEach((it) => { byType[it.type] = (byType[it.type] || 0) + 1; });
console.log(`cc-bank-check: bank '${page}' (${bankPath}) against ${pagePath}`);
console.log(`  items ${items.length} · sections ${sections.length} · quiz items ${quiz.size} (quizN ${bank.quizN || 3}) · final pool ${pool.length}${nFinal ? ' for n = ' + nFinal : ''} · quiz mounts ${quizMounts}`);
console.log(`  by tier: ${TIERS.map((t) => t + ' ' + (tierN[t] || 0)).join(' · ')} (name ${(100 * nameShare).toFixed(0)} %)`);
console.log(`  by type: ${TYPES.map((t) => t + ' ' + (byType[t] || 0)).join(' · ')}`);
console.log(`  footnotes on page ${footnotes.size} · graphics on page ${graphics.size}`);
W.forEach((w) => console.log('  WARN ' + w));
V.forEach((v) => console.log('  VIOLATION ' + v));
console.log(V.length ? `\n${V.length} violation(s)` : '\n0 violations');
process.exit(V.length ? 1 : 0);
