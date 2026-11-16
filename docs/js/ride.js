/* ride.js: draws the ride map from the static station list on docs/ride/index.html.
 *
 * One geometry, two views. Every station is a bead: a peak of "nearness to criticality" (0..1) at
 * its declared place (x, y) on a schematic plane. The beads are lined up along one line; between them
 * are real valleys. The track rides at each station's declared level c (just below the peak tops).
 *   window view: the line seen from the side, as hills with a monorail across them
 *   map view:    the surface over the two control settings, drawn as stacked slices
 * The train starts paused. Markers link only to this page's own station entries (#station-N).
 * No dependencies; ES2019.
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.getElementById('ride-svg');
  if (!svg) return;

  var items = Array.prototype.slice.call(document.querySelectorAll('li.station'));
  var stations = items.map(function (li) {
    var h = li.querySelector('h3');
    return {
      id: li.getAttribute('data-station'),
      state: li.getAttribute('data-state'),
      x: parseFloat(li.getAttribute('data-x')),
      y: parseFloat(li.getAttribute('data-y')),
      c: parseFloat(li.getAttribute('data-c')),
      title: h ? h.textContent.replace(/\s+/g, ' ').trim() : ''
    };
  });
  if (!stations.length) return;
  var axisText = function (k) {
    var dd = document.getElementById('axis-' + k);
    var t = dd ? dd.querySelector('.tip') : null;
    return {
      name: t && t.firstChild ? t.firstChild.textContent.trim() : k,
      tip: t && t.querySelector('.tt') ? t.querySelector('.tt').textContent.trim() : ''
    };
  };

  var W = 0.028;                       // half-width of a bead along the line (plane units)
  function bead(dx) { return 1 / (1 + (dx / W) * (dx / W)); }
  function along(x) {                  // height of the beaded line at position x along it
    var m = 0;
    for (var i = 0; i < stations.length; i++) m = Math.max(m, bead(x - stations[i].x));
    return m;
  }
  function lineY(x) {                  // where the line of beads sits in the second setting
    var s = stations;
    if (x <= s[0].x) return s[0].y;
    for (var i = 1; i < s.length; i++) {
      if (x <= s[i].x) {
        var t = (x - s[i - 1].x) / (s[i].x - s[i - 1].x);
        return s[i - 1].y + t * (s[i].y - s[i - 1].y);
      }
    }
    return s[s.length - 1].y;
  }
  function levelAt(x) {                // the track's declared level, from the nearest station
    var best = stations[0], d = Infinity;
    for (var i = 0; i < stations.length; i++) {
      var dd = Math.abs(stations[i].x - x);
      if (dd < d) { d = dd; best = stations[i]; }
    }
    return best.c;
  }
  var SIG = 0.07;                      // width of the line across the second setting
  function surface(x, y) {
    var dy = y - lineY(x);
    return along(x) * Math.exp(-(dy * dy) / (2 * SIG * SIG));
  }

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function tipTitle(parent, text) { var t = el('title', {}, parent); t.textContent = text; return t; }
  function clear() {
    var keep = [document.getElementById('ride-svg-title'), document.getElementById('ride-svg-desc')];
    while (svg.lastChild && keep.indexOf(svg.lastChild) < 0) svg.removeChild(svg.lastChild);
  }
  function marker(parent, s, cx, cy, r) {
    var a = el('a', { href: '#station-' + s.id }, parent);
    tipTitle(a, 'Station ' + s.id + ': ' + s.title + (s.state === 'live' ? '' : ' (' + s.state + ')'));
    el('circle', { cx: cx, cy: cy, r: r, 'class': 'stn' + (s.state === 'live' ? '' : ' hollow') }, a);
    var lab = el('text', { x: cx, y: cy - r - 8, 'class': 'stn-label' }, a);
    lab.textContent = s.id;
    return a;
  }

  /* ---------------------------------------------------------------- window view */
  var X0 = 40, X1 = 960, GROUND = 430, HPX = 300;
  function wx(x) { return X0 + x * (X1 - X0); }
  function wy(h) { return GROUND - h * HPX; }

  function drawWindow() {
    var d = 'M ' + X0 + ' ' + GROUND, n = 400, i, x;
    for (i = 0; i <= n; i++) { x = i / n; d += ' L ' + wx(x).toFixed(1) + ' ' + wy(along(x)).toFixed(1); }
    d += ' L ' + X1 + ' ' + GROUND + ' Z';
    el('path', { d: d, 'class': 'hill' }, svg);
    // piers where the track crosses a valley
    for (i = 0; i < stations.length - 1; i++) {
      var mx = (stations[i].x + stations[i + 1].x) / 2;
      el('line', { x1: wx(mx), y1: wy(levelAt(mx)), x2: wx(mx), y2: wy(along(mx)), 'class': 'pier' }, svg);
    }
    var t = 'M ' + wx(0) + ' ' + wy(levelAt(0));
    for (i = 1; i <= n; i++) { x = i / n; t += ' L ' + wx(x).toFixed(1) + ' ' + wy(levelAt(x)).toFixed(1); }
    el('path', { d: t, 'class': 'track' }, svg);
    stations.forEach(function (s) {
      if (s.id === '6') {   // the tunnel: the track runs into the hill
        var tx = wx(s.x), ty = wy(s.c);
        el('path', { d: 'M ' + (tx - 16) + ' ' + (ty + 8) + ' v -10 a 16 16 0 0 1 32 0 v 10 z', 'class': 'tunnel' }, svg);
      }
      marker(svg, s, wx(s.x), wy(s.c) - 2, 8);
    });
  }

  /* ------------------------------------------------------------------- map view */
  var MX0 = 250, MX1 = 950, SKEW = 110, DEPTH = 160, BASE = 400, ZPX = 175;
  function mx(x, y) { return MX0 + x * (MX1 - MX0) - y * SKEW; }
  function my(y, z) { return BASE - y * DEPTH - z * ZPX; }

  function drawMap() {
    var K = 48, n = 260, k, i, x, y, d;
    var ax = axisText('x'), ay = axisText('y'), az = axisText('z');
    for (k = K; k >= 0; k--) {          // back to front, so nearer slices hide farther ones
      y = k / K;
      d = 'M ' + mx(0, y).toFixed(1) + ' ' + my(y, 0).toFixed(1);
      for (i = 0; i <= n; i++) { x = i / n; d += ' L ' + mx(x, y).toFixed(1) + ' ' + my(y, surface(x, y)).toFixed(1); }
      d += ' L ' + mx(1, y).toFixed(1) + ' ' + my(y, 0).toFixed(1) + ' Z';
      el('path', { d: d, 'class': 'slice' }, svg);
    }
    // the crest of the beaded line itself, so every peak reaches its true height
    d = '';
    for (i = 0; i <= 4 * n; i++) {
      x = i / (4 * n); y = lineY(x);
      d += (i ? ' L ' : 'M ') + mx(x, y).toFixed(1) + ' ' + my(y, along(x)).toFixed(1);
    }
    el('path', { d: d, 'class': 'crest' }, svg);
    var lbl = el('text', { x: mx(0.62, 0.08), y: my(0.08, 0) - 4, 'class': 'schematic', 'text-anchor': 'middle' }, svg);
    lbl.textContent = 'schematic';
    // the track: along the line, at the declared level; dashed where it bridges a valley
    var on = '', off = '', prevOn = null;
    for (i = 0; i <= n; i++) {
      x = i / n; y = lineY(x);
      var lev = levelAt(x), px = mx(x, y).toFixed(1), py = my(y, lev).toFixed(1);
      var isOn = surface(x, y) >= lev - 1e-9;
      if (isOn) on += (prevOn === true ? ' L ' : ' M ') + px + ' ' + py;
      else off += (prevOn === false ? ' L ' : ' M ') + px + ' ' + py;
      prevOn = isOn;
    }
    el('path', { d: off, 'class': 'bridge' }, svg);
    el('path', { d: on, 'class': 'track' }, svg);
    var vx = (stations[1].x + stations[2].x) / 2;
    var vn = el('text', { x: mx(vx, lineY(vx) - 0.12), y: my(lineY(vx) - 0.12, 0.08), 'class': 'valley-note' }, svg);
    vn.textContent = 'a real valley';
    stations.forEach(function (s) { marker(svg, s, mx(s.x, s.y), my(s.y, 1), 7); });
    // axes, each with a two-part tooltip (the quantity; its units or meaning)
    var g = el('g', {}, svg);
    el('line', { x1: mx(0, 0), y1: my(0, 0) + 14, x2: mx(1, 0), y2: my(0, 0) + 14, 'class': 'axis' }, g);
    var tx = el('text', { x: mx(0.5, 0), y: my(0, 0) + 34, 'class': 'axis-label', 'text-anchor': 'middle' }, g);
    tx.textContent = ax.name + ' →'; tipTitle(tx, ax.tip);
    el('line', { x1: mx(0, 0) - 14, y1: my(0, 0), x2: mx(0, 1) - 14, y2: my(1, 0), 'class': 'axis' }, g);
    var ty = el('text', { x: mx(0, 0.55) - 22, y: my(0.55, 0), 'class': 'axis-label', 'text-anchor': 'end' }, g);
    ty.textContent = ay.name + ' ↗'; tipTitle(ty, ay.tip);
    el('line', { x1: mx(0, 1) - 14, y1: my(1, 0), x2: mx(0, 1) - 14, y2: my(1, 1), 'class': 'axis' }, g);
    var tz = el('text', { x: mx(0, 1) - 20, y: my(1, 1) - 8, 'class': 'axis-label', 'text-anchor': 'start' }, g);
    tz.textContent = '↑ ' + az.name; tipTitle(tz, az.tip);
  }

  /* ------------------------------------------------------------------- the train */
  var view = 'window', u = stations[0].x, playing = false, raf = 0, last = 0, hop = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var train = null;
  function trainAt(x) {
    var px, py;
    if (view === 'window') { px = wx(x); py = wy(levelAt(x)); }
    else { var y = lineY(x); px = mx(x, y); py = my(y, levelAt(x)); }
    train.setAttribute('transform', 'translate(' + px.toFixed(1) + ' ' + (py - 9).toFixed(1) + ')');
  }
  function drawTrain() {
    train = el('g', { 'aria-hidden': 'true' }, svg);
    el('rect', { x: -14, y: -7, width: 28, height: 12, rx: 5, 'class': 'train' }, train);
    trainAt(u);
  }
  function render() {
    clear();
    if (view === 'window') drawWindow(); else drawMap();
    drawTrain();
  }
  function frame(t) {
    if (!playing) return;
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    u += dt * 0.05;
    if (u > stations[stations.length - 1].x) u = stations[0].x;
    trainAt(u);
    raf = requestAnimationFrame(frame);
  }
  function stepHop() {               // reduced motion: move a whole station at a time, no sliding
    hop = (hop + 1) % stations.length;
    u = stations[hop].x;
    trainAt(u);
  }
  var playBtn = document.querySelector('.play');
  var hopTimer = 0;
  function setPlaying(p) {
    playing = p;
    playBtn.setAttribute('aria-pressed', p ? 'true' : 'false');
    playBtn.textContent = p ? 'Pause the train' : 'Play the train';
    if (reduce) {
      if (p) { stepHop(); hopTimer = setTimeout(function tick() { if (playing) { stepHop(); hopTimer = setTimeout(tick, 2500); } }, 2500); }
      else clearTimeout(hopTimer);
      return;
    }
    if (p) { last = 0; raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
  }
  if (playBtn) playBtn.addEventListener('click', function () { setPlaying(!playing); });

  var buttons = Array.prototype.slice.call(document.querySelectorAll('.toggle button'));
  function setView(v) {
    view = v;
    document.body.setAttribute('data-view', v);
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === v ? 'true' : 'false'); });
    render();
  }
  buttons.forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-view')); }); });
  window.addEventListener('hashchange', function () { if (/^#station-/.test(window.location.hash) && view !== 'window') setView('window'); });
  setView('window');
})();
