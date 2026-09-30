/* primer.js — "The Compass in one minute": ONE shared, visible block for every critical-lines page.
 *
 *   <div class="cc-primer-mount"></div>             where the primer goes (directly under the page intro)
 *   <script src="…/diamond-node/critical-lines/primer.js"></script>   once per page, anywhere
 *
 * The text lives only here, so it is byte-identical on every page. No storage, no animation, no
 * dependencies; links are resolved against this script's own URL so they work from any page. */
(function () {
  'use strict';
  var d = document;
  var self = d.currentScript;
  var base = '';
  try { base = new URL('./', self && self.src ? self.src : location.href).href; } catch (e) { base = ''; }
  var T = base + 'techniques/', K = base + '../../kosterlitz-thouless/';

  var tip = function (term, text) {
    return '<span class="tip" tabindex="0">' + term + '<span class="tt">' + text + '</span></span>';
  };

  var LINES = [
    'The ' + tip('Criticality Compass', 'An instrument being designed: it reads observations of a system and says what kind of critical geometry it has, then helps move along it.') +
      ' has two parts. The ' + tip('Detector', 'Reads a system’s observations and returns exactly one verdict about its critical geometry.') +
      ' returns one verdict; the ' + tip('Navigator', 'Finds a critical line and moves along it, keeping the system critical while its control parameters change.') + ' finds a critical line and moves along it.',
    'The verdicts: ' + tip('POINT', 'An isolated fixed point: the RG flow stops at one place and has one way out (the 2D Ising critical point).') + ' · ' +
      tip('LINE', 'A continuum of fixed points: the flow stops wherever it lands, because one direction is exactly marginal.') + ' · ' +
      tip('WALKING', 'The flow slows to a small nonzero minimum, never stops, then leaves; finite systems imitate criticality (Potts q = 5, 6).') + ' · ' +
      tip('REFUSE', 'The honest verdict when the data cannot tell. It is a value the instrument returns, and the default cell.') +
      '. A ' + tip('multicritical point', 'A point with two or more relevant directions at once (a tricritical or bicritical point).') + ' has no letter yet.',
    tip('SCALE', 'The relation between a system and its coarse-grained copies: RG level n and n + 1, or sizes L/2 and L.') + ' and ' +
      tip('CONTROL', 'The relation between runs at neighbouring values of a knob, such as temperature or a coupling.') +
      ' are the two families of relations the instrument follows the flow over.',
    'The ' + tip('firewall', 'The rule that ground truth never reaches the instrument’s inputs.') + ': exact answers live on the ' +
      tip('scoring side', 'Exact solutions and known phase diagrams, used only to grade the verdict after it is given.') + ' and are used only to grade the verdict.',
    'The ' + tip('relational kernel', 'A small set of operators defined over relations that are declared in advance. The operators are definitions, not agents.') + ': ' +
      tip('M', 'The declared mapping from observables to numbers. What M does not declare is not evaluated.') + ' maps observables to numbers; the ' +
      tip('declared relations', 'The directed edges between nodes, stated before any data are read; nothing is inferred.') + ' are the directed edges between them.',
    'A ' + tip('NodeField', 'One number per node.') + ' holds one number per node; an ' + tip('EdgeField', 'One number per declared directed edge.') + ' holds one number per declared edge.',
    tip('A', 'A(x)[e] = x[s] − x[t] over each declared edge e = (s, t); the only step from a NodeField to an EdgeField.') + ' is the directed difference over a declared relation; ' +
      tip('B', 'B(g)[e] = g[e] + the sum of g over the immediate successors of e; for a terminal edge (no successors) B(g)[e] = g[e].') + ' is the accumulation along it; ' +
      tip('R', 'R(g)[e] = g[e] + ρ·(sum over successors − sum over predecessors), with ρ = ρ_base·χ/(χ₀ + χ) at the edge’s source node, χ the largest |A| there; ρ_base and χ₀ are declared through M.') + ' is the antisymmetric response: successors minus predecessors, weighted by ρ. A missing declaration is ' +
      tip('NOT EVALUATED', 'A value of its own, never 0.') + '.',
    'The ' + tip('five-valued sign', 'A velocity v with band w, read against a declared margin ε, lands in exactly one of five cells.') + ': ' +
      tip('SIG+', 'The whole band lies above +ε: moving up.') + ' · ' +
      tip('SIG−', 'The whole band lies below −ε: moving down.') + ' · ' +
      tip('ZERO!', 'The whole band lies inside ±ε and includes zero: stopped, as far as ε can tell.') + ' · ' +
      tip('SLOW', 'The band excludes zero but does not lie wholly beyond ±ε: resolved, slow, not shown to stop. Where ZERO! and SLOW could both be claimed, the cell is SLOW.') + ' · ' +
      tip('?', 'The data cannot tell.') + ' (taught in <a href="' + T + '#3-drift">Techniques §3</a>; the kernel in <a href="' + T + '#4-kernel">§4</a>).',
    'A ' + tip('breaker', 'A control case built to break the instrument. A good failure is REFUSE; a bad failure is a confident wrong verdict.') +
      ' is a test case chosen to fool the instrument; the main one is ' +
      tip('BKT', 'The Berezinskii–Kosterlitz–Thouless transition of the 2D XY model.') + ', the Berezinskii–Kosterlitz–Thouless transition (<a href="' + K + '#8-finite-size">Part 1 §8</a>).'
  ];

  var CSS = '.cc-primer{background:#1e293b;border-left:3px solid #06b6d4;border-radius:8px;padding:0.8rem 1rem;margin:1.2rem 0;font-size:0.95rem;line-height:1.6;overflow-wrap:anywhere}' +
    '.cc-primer h2{font-family:Georgia,serif;font-size:1.15rem;margin:0 0 0.4rem;padding:0;border:0;color:#f1f5f9}' +
    '.cc-primer ul{margin:0;padding-left:1.1rem}.cc-primer li{margin:0.15rem 0}' +
    '.cc-primer .tip{position:relative;border-bottom:1px dotted rgba(148,163,184,0.6);cursor:help}' +
    '.cc-primer .tip .tt{display:none;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#1a2744;border:1px solid #94a3b8;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.82rem;font-style:normal;font-weight:normal;color:#cbd5e1;width:max-content;max-width:300px;z-index:100;line-height:1.5;pointer-events:none}' +
    '.cc-primer .tip:hover .tt,.cc-primer .tip:focus .tt{display:block}' +
    '@media (max-width:640px){.cc-primer .tip .tt{position:fixed;left:1rem;right:1rem;bottom:auto;top:30%;transform:none;max-width:none;width:auto}}';

  var HTML = '<h2>The Compass in one minute</h2><ul><li>' + LINES.join('</li><li>') + '</li></ul>';

  var mount = function () {
    if (!d.getElementById('cc-primer-css')) {
      var st = d.createElement('style'); st.id = 'cc-primer-css'; st.textContent = CSS;
      (d.head || d.documentElement).appendChild(st);
    }
    Array.prototype.forEach.call(d.querySelectorAll('.cc-primer-mount'), function (el) {
      if (el.getAttribute('data-cc-primer') === 'done') return;
      el.setAttribute('data-cc-primer', 'done');
      el.classList.add('cc-primer');
      el.setAttribute('role', 'note');
      el.setAttribute('aria-label', 'The Compass in one minute');
      el.innerHTML = HTML;
    });
  };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount); else mount();
  window.CC_PRIMER = { html: HTML, version: 1 };
})();
