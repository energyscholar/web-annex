/* gloss-tip.js: the ride's tooltip component (plan 1554 phase 3d; moved out of ride3d.js and given levels by
 * plan 1564, ruling O4). One tooltip layer, outside every panel so it is never clipped, shared by every term.
 *
 *   var GT = window.GlossTip.create({ id: 'r3d-tip', className: 'r3d-tip' });
 *   GT.mount();                       // append the layer to <body>, follow scrolling
 *   GT.withTip(anchor, src);          // a two-way tooltip on anchor: hover and keyboard focus; src's content is shown
 *   GT.wireTerm(term, g);             // one jargon term: also tap or click, Enter or Space; describedby g
 *   GT.splitTerms(list);              // a builder's .tip.terms list -> one focusable term per .g[data-term]
 *   GT.show(anchor, src); GT.hide(); GT.el
 *
 * A gloss from docs/ride/glossary.json (scripts/ride-build.py) has up to three levels: .l1, the plain words, always
 * shown; .l2, a picture-word; .l3, the physicist's statement, hidden until the reader presses "More precisely".
 * Any other src is copied as it is. The tooltip stays open while the pointer or the focus is inside it, so the
 * control can be reached by mouse (move into the tooltip), by keyboard (Tab from the term) and by tap.
 * No dependencies; ES2019.
 */
(function () {
  'use strict';
  var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  var n = 0;

  function create(opts) {
    opts = opts || {};
    var tip = document.createElement('div');
    tip.id = opts.id || 'gloss-tip';
    tip.className = 'gloss-tip' + (opts.className ? ' ' + opts.className : '');
    tip.setAttribute('role', 'tooltip');
    tip.tabIndex = -1;                               // a click on its text keeps the focus inside it
    tip.hidden = true;
    var anchor = null, timer = null, pressing = false;

    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }
    function render(src) {
      var l1 = src.querySelector && src.querySelector('.l1');
      tip.innerHTML = '';
      tip.removeAttribute('aria-label');
      tip.setAttribute('role', 'tooltip');
      if (!l1) { tip.innerHTML = src.innerHTML; return; }
      var a = el('div', 'gt-l1'); a.innerHTML = l1.innerHTML; tip.appendChild(a);
      var l2 = src.querySelector('.l2'), l3 = src.querySelector('.l3');
      if (l2) {
        var b = el('div', 'gt-l2');
        b.appendChild(el('span', 'gt-label', 'Picture it: '));
        b.appendChild(document.createTextNode(l2.textContent));
        tip.appendChild(b);
      }
      if (l3) {
        var id = tip.id + '-l3-' + (++n);
        var more = el('button', 'gt-more', 'More precisely ▸');
        more.type = 'button';
        more.setAttribute('aria-expanded', 'false');
        more.setAttribute('aria-controls', id);
        var deep = el('div', 'gt-l3'); deep.id = id; deep.hidden = true;
        deep.appendChild(el('span', 'gt-label gt-deeper', 'More precisely (the physicist’s statement)'));
        deep.appendChild(el('span', 'gt-l3-text', l3.textContent));
        more.addEventListener('click', function () {
          deep.hidden = !deep.hidden;
          more.setAttribute('aria-expanded', deep.hidden ? 'false' : 'true');
          more.textContent = deep.hidden ? 'More precisely ▸' : 'More precisely ▾';
          grow();
        });
        tip.appendChild(more); tip.appendChild(deep);
        tip.setAttribute('role', 'dialog');          // it holds a control, so it is not a plain tooltip
        var g = src.getAttribute && src.getAttribute('data-term');
        if (g) tip.setAttribute('aria-label', g);
      }
    }
    function place() {
      if (tip.hidden || !anchor) return;
      tip.style.maxHeight = (window.innerHeight - 8) + 'px';
      var r = anchor.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      var x = Math.max(4, Math.min(window.innerWidth - tw - 4, r.left));
      var y = r.bottom + 6;
      if (y + th > window.innerHeight - 4) y = r.top - th - 6;              // no room below: above the term
      y = Math.max(4, Math.min(window.innerHeight - th - 4, y));
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    function grow() {                                // a level opened or closed: keep the top edge, so the control
      var th = tip.offsetHeight, y = parseFloat(tip.style.top) || 4;   // stays under the pointer; rise only as far as needed
      if (y + th > window.innerHeight - 4) y = Math.max(4, window.innerHeight - th - 4);
      tip.style.top = y + 'px';
    }
    function cancel() { if (timer) { clearTimeout(timer); timer = null; } }
    function show(a, src) {
      cancel();
      if (anchor === a && !tip.hidden) return;        // already open for this term: keep its state (L3 open or not)
      anchor = a;
      render(src);
      tip.hidden = false;
      tip.scrollTop = 0;
      place();
    }
    function hide() { cancel(); tip.hidden = true; anchor = null; }
    function focusInside() { return tip.contains(document.activeElement); }
    function later() { cancel(); timer = setTimeout(function () { timer = null; if (!focusInside() && document.activeElement !== anchor) hide(); }, 200); }
    function controls() { return Array.prototype.slice.call(tip.querySelectorAll('button')); }
    function nextAfter(a) {                          // the next focusable element after a, in document order
      var all = Array.prototype.filter.call(document.querySelectorAll(FOCUSABLE), function (e) {
        return !tip.contains(e) && e.getClientRects().length > 0;
      });
      var i = all.indexOf(a);
      return i >= 0 ? all[i + 1] || null : null;
    }

    tip.addEventListener('mouseenter', cancel);
    tip.addEventListener('mouseleave', function () { if (document.activeElement !== anchor && !focusInside()) later(); });
    tip.addEventListener('pointerdown', function () { pressing = true; setTimeout(function () { pressing = false; }, 0); });
    tip.addEventListener('focusout', function (ev) {
      var to = ev.relatedTarget;
      if (pressing || (to && (to === anchor || tip.contains(to)))) return;
      hide();
    });
    tip.addEventListener('keydown', function (ev) {
      var c = controls(), a = anchor;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); hide(); if (a) a.focus(); return; }
      if (ev.key !== 'Tab' || !a) return;
      if (ev.shiftKey && (document.activeElement === c[0] || document.activeElement === tip)) { ev.preventDefault(); a.focus(); return; }
      if (!ev.shiftKey && (document.activeElement === c[c.length - 1] || !c.length)) {
        ev.preventDefault();
        var nx = nextAfter(a);
        hide();
        if (nx) nx.focus(); else a.focus();
      }
    });

    function withTip(a, src) {                       // a two-way tooltip: on hover and on keyboard focus
      a.addEventListener('mouseenter', function () { show(a, src); });
      a.addEventListener('mouseleave', function () { if (document.activeElement !== a && !focusInside()) later(); });
      a.addEventListener('focus', function () { show(a, src); });
      a.addEventListener('blur', function (ev) {
        var to = ev.relatedTarget;
        if (pressing || (to && tip.contains(to))) return;   // the reader went into the tooltip
        if (anchor === a) hide();
      });
      a.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') { hide(); return; }
        if (ev.key === 'Tab' && !ev.shiftKey && anchor === a && !tip.hidden) {
          var c = controls();
          if (c.length) { ev.preventDefault(); c[0].focus(); }
        }
      });
    }
    function wireTerm(t, g) {                        // one term and its own gloss part (.g) from ride-build
      t.setAttribute('aria-describedby', g.id);
      t.setAttribute('role', 'button');
      withTip(t, g);
      var was = false;
      t.addEventListener('pointerdown', function (ev) { was = ev.pointerType !== 'mouse' && !tip.hidden && anchor === t; });
      t.addEventListener('click', function () {
        if (was) { hide(); t.blur(); } else show(t, g);
        was = false;
      });
      t.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (tip.hidden || anchor !== t) show(t, g); else hide(); }
      });
    }
    function splitTerms(list) {                      // .tip.terms "BKT, stiffness jump" -> one focusable term each
      var tt = list.querySelector('.tt'), parts = tt ? tt.querySelectorAll('.g[data-term]') : [];
      if (!parts.length) return;
      var box = document.createElement('span'); box.className = 'tip-terms';
      Array.prototype.forEach.call(parts, function (g, i) {
        if (i) box.appendChild(document.createTextNode(', '));
        var t = document.createElement('span'); t.className = 'tip term'; t.tabIndex = 0;
        t.setAttribute('data-term', g.getAttribute('data-term'));
        t.textContent = g.getAttribute('data-term');
        box.appendChild(t);
        wireTerm(t, g);
      });
      tt.setAttribute('aria-hidden', 'true');        // read through aria-describedby, once per term
      box.appendChild(tt);
      list.parentNode.replaceChild(box, list);
    }
    function onScroll(ev) {                          // a focused anchor keeps its tooltip, moved with it
      if (tip.hidden) return;
      if (ev && ev.target && ev.target.nodeType === 1 && tip.contains(ev.target)) return;   // the tooltip's own scroll
      if (anchor && (document.activeElement === anchor || focusInside())) place(); else hide();
    }
    function mount() {
      document.body.appendChild(tip);
      window.addEventListener('scroll', onScroll, true);
      document.addEventListener('pointerdown', function (ev) {
        if (tip.hidden || !anchor) return;
        if (anchor.contains(ev.target) || tip.contains(ev.target)) return;
        hide();
      }, true);
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !tip.hidden) hide(); });
    }
    return { el: tip, mount: mount, show: show, hide: hide, place: place, withTip: withTip, wireTerm: wireTerm,
             splitTerms: splitTerms, anchor: function () { return anchor; } };
  }

  window.GlossTip = { create: create };
})();
