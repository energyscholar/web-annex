/* ride3d.js: the ride's landscape as a 3D surface the reader can turn (plan 1554).
 *
 * The plane is the ride map's own plane: x is "the knob along the line" (map.x), y is "temperature,
 * scaled" (map.y), and the height is C, nearness to criticality. Each station is a bead: a peak that
 * reaches C = 1 at its declared place, with real valleys between neighbouring beads. The height is
 *   t = (d / W)^2, d the distance to the nearest bead (t = 0 exactly at a bead, bounded on the plane)
 *   xi = 1 + 1/t,  xi_eff = (xi^-4 + L^-4)^(-1/4),  L = 1000,  C = log(xi_eff) / log(L)
 * written as C = 1 - log1p(u L^4) / (4 log L) with u = xi^-4 = (t / (1 + t))^4, so C <= 1 because the
 * log1p term is never negative, and C >= 0 because u < 1 for every bounded t. No clamp is applied.
 * The track runs level at each station's declared c: through each summit in a tunnel, across each
 * valley on a bridge with pylons. The train starts paused.
 *
 * Station data comes from the li.station data attributes the builder writes; nothing is fetched.
 * Canvas 2D, own perspective projection, painter's order. No dependencies; ES2019.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var host = document.getElementById('ride3d');
  if (!host) return;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;

  var items = Array.prototype.slice.call(document.querySelectorAll('li.station'));
  var stations = items.map(function (li) {
    return {
      li: li,
      id: li.getAttribute('data-station'),
      state: li.getAttribute('data-state'),
      title: li.getAttribute('data-title') || '',
      x: parseFloat(li.getAttribute('data-x')),
      y: parseFloat(li.getAttribute('data-y')),
      c: parseFloat(li.getAttribute('data-c'))
    };
  });
  if (stations.length < 2) return;
  root.setAttribute('data-ride-app', '3d');

  /* ------------------------------------------------------------ the height function */
  var L = 1000, L4 = Math.pow(L, 4), LOG_L4 = 4 * Math.log(L), W = 0.5;
  function nearest(x, y) {
    var best = Infinity;
    for (var i = 0; i < stations.length; i++) {
      var dx = x - stations[i].x, dy = y - stations[i].y, d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }
  function C(x, y) {
    var d = nearest(x, y) / W, t = d * d, r = t / (1 + t), u = r * r * r * r;
    return 1 - Math.log1p(u * L4) / LOG_L4;
  }

  /* ------------------------------------------------------------ the mesh */
  var SX = 2, SY = 2, HZ = 0.38;                   // world size of the plane and of C = 1
  function WX(x) { return (x - 0.5) * SX; }
  function WY(y) { return (y - 0.5) * SY; }
  function samples(knots, h0, g, hmax) {           // graded samples on [0, 1] that hit every knot exactly
    var k = knots.slice().sort(function (a, b) { return a - b; }), out = [0], q = 0, i;
    while (q < 1 - 1e-9) {
      var d = Infinity;
      for (i = 0; i < k.length; i++) d = Math.min(d, Math.abs(q - k[i]));
      var h = Math.min(hmax, h0 + g * d), nx = Math.min(1, q + h);
      for (i = 0; i < k.length; i++) if (k[i] > q + 1e-9 && k[i] < nx + 0.5 * h) { nx = k[i]; break; }
      q = nx; out.push(q);
    }
    return out;
  }
  var xs = samples(stations.map(function (s) { return s.x; }), 0.0045, 0.4, 0.012);
  var ys = samples(stations.map(function (s) { return s.y; }), 0.0045, 0.4, 0.06);
  var NX = xs.length, NY = ys.length, NV = NX * NY, NQ = (NX - 1) * (NY - 1);
  var vx = new Float64Array(NV), vy = new Float64Array(NV), vz = new Float64Array(NV), vc = new Float64Array(NV);
  var meshMin = Infinity, meshMax = -Infinity, i, j;
  for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
    var n = j * NX + i, c = C(xs[i], ys[j]);
    vx[n] = WX(xs[i]); vy[n] = WY(ys[j]); vz[n] = c * HZ; vc[n] = c;
    if (c < meshMin) meshMin = c;
    if (c > meshMax) meshMax = c;
  }
  var LIGHT = norm3([-0.45, -0.55, 0.7]);
  function norm3(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function mix(stops, t) {
    for (var k = 1; k < stops.length; k++) {
      if (t <= stops[k][0] || k === stops.length - 1) {
        var a = stops[k - 1], b = stops[k], f = (t - a[0]) / (b[0] - a[0]);
        f = f < 0 ? 0 : (f > 1 ? 1 : f);
        return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3])];
      }
    }
    return stops[0].slice(1);
  }
  var WINDOW_GROUND = [[0, 64, 112, 62], [0.35, 82, 124, 60], [0.6, 112, 104, 72], [0.8, 128, 118, 106],
                       [0.92, 196, 200, 206], [1, 240, 243, 247]];
  // the map paint's colour scale on C (dark violet at 0, through blue and green, to yellow at 1)
  var MAP_SCALE = [[0, 68, 1, 84], [0.25, 59, 82, 139], [0.5, 33, 145, 140], [0.75, 94, 201, 98], [1, 253, 231, 37]];
  var BAND = [251, 191, 36], LEVEL = stations[0].c;
  function rgb(c, s) {
    return 'rgb(' + Math.min(255, Math.round(c[0] * s)) + ',' + Math.min(255, Math.round(c[1] * s)) + ',' +
      Math.min(255, Math.round(c[2] * s)) + ')';
  }
  var quadV = new Int32Array(NQ * 4), quadShade = new Float64Array(NQ), quadC = new Float64Array(NQ);
  var paints = { window: new Array(NQ), map: new Array(NQ) };
  var contStart = new Int32Array(NQ), contCount = new Int32Array(NQ), contSegs = [];   // contours every 0.1
  for (j = 0, n = 0; j < NY - 1; j++) for (i = 0; i < NX - 1; i++, n++) {
    var a = j * NX + i, b = a + 1, d = a + NX, e = d + 1;
    quadV[4 * n] = a; quadV[4 * n + 1] = b; quadV[4 * n + 2] = e; quadV[4 * n + 3] = d;
    var ux = vx[e] - vx[a], uy = vy[e] - vy[a], uz = vz[e] - vz[a];
    var wx = vx[d] - vx[b], wy = vy[d] - vy[b], wz = vz[d] - vz[b];
    var nrm = norm3([uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]);
    if (nrm[2] < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
    var lam = Math.max(0, nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]);
    quadShade[n] = lam;
    quadC[n] = (vc[a] + vc[b] + vc[d] + vc[e]) / 4;
    paints.window[n] = rgb(mix(WINDOW_GROUND, quadC[n]), 0.42 + 0.62 * lam);
    var mc = mix(MAP_SCALE, quadC[n]);
    if (Math.abs(quadC[n] - LEVEL) < 0.012) mc = [(mc[0] + 2 * BAND[0]) / 3, (mc[1] + 2 * BAND[1]) / 3, (mc[2] + 2 * BAND[2]) / 3];
    paints.map[n] = rgb(mc, 0.72 + 0.36 * lam);
    contStart[n] = contSegs.length / 7;
    contour([a, b, e, d]);
    contCount[n] = contSegs.length / 7 - contStart[n];
  }
  function contour(cv) {                            // marching squares on one quad, levels 0.1 .. 0.9
    for (var lv = 1; lv <= 9; lv++) {
      var L0 = lv / 10, pts = [];
      for (var k = 0; k < 4; k++) {
        var p = cv[k], q = cv[(k + 1) % 4], cp = vc[p] - L0, cq = vc[q] - L0;
        if ((cp >= 0) !== (cq >= 0)) {
          var f = cp / (cp - cq);
          pts.push(vx[p] + f * (vx[q] - vx[p]), vy[p] + f * (vy[q] - vy[p]), L0 * HZ);
        }
      }
      for (k = 0; k + 5 < pts.length; k += 6) contSegs.push(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], pts[k + 4], pts[k + 5], lv);
    }
  }
  contSegs = new Float64Array(contSegs);

  /* ------------------------------------------------------------ the track */
  function lineY(x) {                               // the line through the beads, in station order
    var s = stations;
    if (x <= s[0].x) return s[0].y;
    for (var k = 1; k < s.length; k++) {
      if (x <= s[k].x) { var f = (x - s[k - 1].x) / (s[k].x - s[k - 1].x); return s[k - 1].y + f * (s[k].y - s[k - 1].y); }
    }
    return s[s.length - 1].y;
  }
  function levelAt(x) {                             // the declared level of the nearest station
    var best = stations[0], dd = Infinity;
    for (var k = 0; k < stations.length; k++) { var q = Math.abs(stations[k].x - x); if (q < dd) { dd = q; best = stations[k]; } }
    return best.c;
  }
  var X_FIRST = stations[0].x, X_LAST = stations[stations.length - 1].x;
  var track = [];                                   // {x, y, lev, g}
  for (var tx = X_FIRST; tx <= X_LAST + 1e-9; tx += 0.003) {
    var ty = lineY(tx);
    track.push({ x: tx, y: ty, lev: levelAt(tx), g: C(tx, ty) });
  }
  var portals = [];
  for (i = 1; i < track.length; i++) {
    var p0 = track[i - 1], p1 = track[i], s0 = p0.g - p0.lev, s1 = p1.g - p1.lev;
    if ((s0 > 0) !== (s1 > 0)) {
      var f = s0 / (s0 - s1);
      portals.push({ x: p0.x + f * (p1.x - p0.x), y: p0.y + f * (p1.y - p0.y), lev: p0.lev });
    }
  }

  /* ------------------------------------------------------------ the camera */
  var DEF = { yaw: -0.62, pitch: 0.5, dist: 1.75 };
  var cam = { yaw: DEF.yaw, pitch: DEF.pitch, dist: DEF.dist, tx: 0, ty: 0, tz: 0 };
  var PITCH_MIN = 0.12, PITCH_MAX = 1.45, DIST_MIN = 0.9, DIST_MAX = 4.5;
  var basis = { ox: 0, oy: 0, oz: 0, rx: 0, ry: 0, ux: 0, uy: 0, uz: 0, fx: 0, fy: 0, fz: 0, f: 1, cx: 0, cy: 0 };
  function setBasis(w, h) {
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    var ox = cam.dist * cp * sy, oy = -cam.dist * cp * cy, oz = cam.dist * sp;
    basis.ox = cam.tx + ox; basis.oy = cam.ty + oy; basis.oz = cam.tz + oz;
    basis.fx = -ox / cam.dist; basis.fy = -oy / cam.dist; basis.fz = -oz / cam.dist;
    basis.rx = cy; basis.ry = sy;                   // right vector (rz = 0)
    basis.ux = basis.ry * basis.fz; basis.uy = -basis.rx * basis.fz; basis.uz = basis.rx * basis.fy - basis.ry * basis.fx;
    basis.f = Math.max(w, h * 1.3) * 0.9;
    basis.cx = w / 2; basis.cy = h * 0.45;
  }
  var out = { x: 0, y: 0, z: 0 };
  function project(px, py, pz) {
    var qx = px - basis.ox, qy = py - basis.oy, qz = pz - basis.oz;
    var z = qx * basis.fx + qy * basis.fy + qz * basis.fz;
    var xc = qx * basis.rx + qy * basis.ry;
    var yc = qx * basis.ux + qy * basis.uy + qz * basis.uz;
    out.z = z; out.x = basis.cx + basis.f * xc / z; out.y = basis.cy - basis.f * yc / z;
    return out;
  }
  function focusOn(s) { cam.tx = WX(s.x); cam.ty = WY(s.y); cam.tz = s.c * HZ; }

  /* ------------------------------------------------------------ drawing */
  var W_PX = 0, H_PX = 0, DPR = 1;
  var sx = new Float64Array(NV), sy = new Float64Array(NV), sz = new Float64Array(NV);
  var paint = 'window';
  var u = stations[0].x;                            // the train's place along the line
  var frameTimes = [];
  var NEAR = 0.05;

  function extras() {                               // track pieces, pylons, portals, posts, the train
    var list = [], k, p, q;
    for (k = 1; k < track.length; k++) {
      p = track[k - 1]; q = track[k];
      var gm = (p.g + q.g) / 2, lev = (p.lev + q.lev) / 2;
      if (gm > lev) continue;                       // inside the hill: the tunnel
      list.push({ kind: 'deck', a: [WX(p.x), WY(p.y), p.lev * HZ], b: [WX(q.x), WY(q.y), q.lev * HZ] });
      if (k % 4 === 0 && p.g < p.lev - 0.015) {
        list.push({ kind: 'pylon', a: [WX(p.x), WY(p.y), p.lev * HZ], b: [WX(p.x), WY(p.y), p.g * HZ] });
      }
    }
    for (k = 0; k < portals.length; k++) {
      p = portals[k];
      list.push({ kind: 'portal', a: [WX(p.x), WY(p.y), p.lev * HZ] });
    }
    for (k = 0; k < stations.length; k++) {
      p = stations[k];
      list.push({ kind: 'post', s: p, a: [WX(p.x), WY(p.y), HZ], b: [WX(p.x), WY(p.y), HZ * 1.16] });
    }
    return list;
  }
  var EXTRA = extras();
  EXTRA.forEach(function (e) { e.m = e.b ? [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2, (e.a[2] + e.b[2]) / 2] : e.a; });
  var ID_SPAN = 1 << 14, DEPTH_LEVELS = 1 << 17;   // key = depth level * ID_SPAN + item id
  var itemId = new Int32Array(NQ + EXTRA.length), itemDepth = new Float64Array(NQ + EXTRA.length);
  var keys = new Uint32Array(NQ + EXTRA.length);

  function trainPos() {
    var y = lineY(u), lev = levelAt(u);
    return { x: u, y: y, lev: lev, inside: C(u, y) > lev };
  }

  function render() {
    var t0 = performance.now();
    var w = W_PX, h = H_PX;
    if (!w || !h) return;
    setBasis(w, h);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (paint === 'map') ctx.fillStyle = '#0b1222';
    else {
      var sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#0d2340'); sky.addColorStop(0.6, '#2c5279'); sky.addColorStop(1, '#5b84a8');
      ctx.fillStyle = sky;
    }
    ctx.fillRect(0, 0, w, h);
    var k, n, p;
    for (k = 0; k < NV; k++) { p = project(vx[k], vy[k], vz[k]); sx[k] = p.x; sy[k] = p.y; sz[k] = p.z; }
    var cnt = 0, dmin = Infinity, dmax = -Infinity;
    for (n = 0; n < NQ; n++) {
      var a = quadV[4 * n], b = quadV[4 * n + 1], c = quadV[4 * n + 2], d = quadV[4 * n + 3];
      if (sz[a] < NEAR || sz[b] < NEAR || sz[c] < NEAR || sz[d] < NEAR) continue;
      var minx = Math.min(sx[a], sx[b], sx[c], sx[d]), maxx = Math.max(sx[a], sx[b], sx[c], sx[d]);
      var miny = Math.min(sy[a], sy[b], sy[c], sy[d]), maxy = Math.max(sy[a], sy[b], sy[c], sy[d]);
      if (maxx < 0 || minx > w || maxy < 0 || miny > h) continue;
      itemId[cnt] = n; itemDepth[cnt] = (sz[a] + sz[b] + sz[c] + sz[d]) / 4; cnt++;
    }
    for (k = 0; k < EXTRA.length; k++) {
      var e = EXTRA[k];
      p = project(e.m[0], e.m[1], e.m[2]);
      if (p.z < NEAR) continue;
      itemId[cnt] = NQ + k; itemDepth[cnt] = p.z - (e.kind === 'pylon' ? 0 : 0.012); cnt++;
    }
    for (k = 0; k < cnt; k++) { if (itemDepth[k] < dmin) dmin = itemDepth[k]; if (itemDepth[k] > dmax) dmax = itemDepth[k]; }
    var span = (DEPTH_LEVELS - 1) / Math.max(1e-9, dmax - dmin);
    for (k = 0; k < cnt; k++) keys[k] = Math.floor((itemDepth[k] - dmin) * span) * ID_SPAN + itemId[k];
    var sorted = keys.subarray(0, cnt).sort();                 // numeric, ascending: nearest first
    var fills = paints[paint] || paints.window;
    ctx.lineJoin = 'round'; ctx.lineWidth = 0.7;
    for (k = cnt - 1; k >= 0; k--) {                          // far to near
      n = sorted[k] % ID_SPAN;
      if (n < NQ) {
        var q0 = quadV[4 * n], q1 = quadV[4 * n + 1], q2 = quadV[4 * n + 2], q3 = quadV[4 * n + 3];
        // each corner pushed ~0.6 px out from the centre, so neighbouring quads overlap and no seam shows
        var mx = (sx[q0] + sx[q1] + sx[q2] + sx[q3]) / 4, my = (sy[q0] + sy[q1] + sy[q2] + sy[q3]) / 4;
        ctx.beginPath();
        grow(q0, mx, my, true); grow(q1, mx, my, false); grow(q2, mx, my, false); grow(q3, mx, my, false);
        ctx.closePath();
        ctx.fillStyle = fills[n]; ctx.fill();
        if (paint === 'map' && contCount[n]) drawContours(n);
      } else { drawExtra(EXTRA[n - NQ]); ctx.lineWidth = 0.7; }
    }
    drawTrain();
    if (paint === 'map') drawAxes();
    placeLabels();
    frameTimes.push(performance.now() - t0);
    if (frameTimes.length > 240) frameTimes.shift();
  }
  function grow(v, mx, my, first) {
    var dx = sx[v] - mx, dy = sy[v] - my, l = Math.sqrt(dx * dx + dy * dy) || 1, g = 0.6 / l;
    if (first) ctx.moveTo(sx[v] + dx * g, sy[v] + dy * g); else ctx.lineTo(sx[v] + dx * g, sy[v] + dy * g);
  }
  function drawContours(n) {
    var k0 = contStart[n], k1 = k0 + contCount[n], k, o, p, x0, y0, band = false;
    ctx.beginPath();
    for (k = k0; k < k1; k++) {
      o = 7 * k;
      if (contSegs[o + 6] === 9) { band = true; continue; }
      p = project(contSegs[o], contSegs[o + 1], contSegs[o + 2]); x0 = p.x; y0 = p.y;
      p = project(contSegs[o + 3], contSegs[o + 4], contSegs[o + 5]);
      ctx.moveTo(x0, y0); ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(8, 12, 24, 0.55)'; ctx.lineWidth = 0.8; ctx.stroke();
    if (!band) return;
    ctx.beginPath();
    for (k = k0; k < k1; k++) {
      o = 7 * k;
      if (contSegs[o + 6] !== 9) continue;
      p = project(contSegs[o], contSegs[o + 1], contSegs[o + 2]); x0 = p.x; y0 = p.y;
      p = project(contSegs[o + 3], contSegs[o + 4], contSegs[o + 5]);
      ctx.moveTo(x0, y0); ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.6; ctx.stroke();
  }
  function drawAxes() {
    var o = [WX(0), WY(0), 0];
    seg(o, [WX(1), WY(0), 0], '#cbd5e1', 1.5);
    seg(o, [WX(0), WY(1), 0], '#cbd5e1', 1.5);
    seg([WX(0), WY(1), 0], [WX(0), WY(1), HZ], '#cbd5e1', 1.5);
    ctx.fillStyle = '#cbd5e1'; ctx.font = '12px system-ui, sans-serif';
    for (var t = 0; t <= 1; t += 0.5) {
      var p = project(WX(0), WY(1), t * HZ);
      if (p.z < NEAR) continue;
      ctx.beginPath(); ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y); ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillText(t === 0.5 ? '0.5' : String(t), p.x + 7, p.y + 4);
    }
  }
  function seg(a, b, color, width) {
    var p = project(a[0], a[1], a[2]), x0 = p.x, y0 = p.y, z0 = p.z;
    p = project(b[0], b[1], b[2]);
    if (z0 < NEAR || p.z < NEAR) return;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function scaleAt(z) { return basis.f / z; }
  function drawExtra(e) {
    var p;
    if (e.kind === 'deck') {
      seg(e.a, e.b, '#6b4f1d', Math.max(2, scaleAt(project(e.a[0], e.a[1], e.a[2]).z) * 0.016));
      seg(e.a, e.b, '#fbbf24', Math.max(1.2, scaleAt(project(e.a[0], e.a[1], e.a[2]).z) * 0.008));
    } else if (e.kind === 'pylon') {
      seg(e.a, e.b, '#94a3b8', Math.max(1, scaleAt(project(e.a[0], e.a[1], e.a[2]).z) * 0.005));
    } else if (e.kind === 'portal') {
      p = project(e.a[0], e.a[1], e.a[2]);
      var r = Math.max(2.5, scaleAt(p.z) * 0.014);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, Math.PI, 2 * Math.PI); ctx.lineTo(p.x + r, p.y + r * 0.45); ctx.lineTo(p.x - r, p.y + r * 0.45); ctx.closePath();
      ctx.fillStyle = '#05080f'; ctx.fill(); ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1; ctx.stroke();
    } else if (e.kind === 'post') {
      seg(e.a, e.b, '#e2e8f0', Math.max(1, scaleAt(project(e.a[0], e.a[1], e.a[2]).z) * 0.004));
    }
  }
  function drawTrain() {
    var t = trainPos(), p = project(WX(t.x), WY(t.y), t.lev * HZ);
    if (p.z < NEAR) return;
    var s = scaleAt(p.z), w = Math.max(12, s * 0.06), h = Math.max(6, s * 0.026);
    ctx.save();
    ctx.globalAlpha = t.inside ? 0.55 : 1;                 // in a tunnel: seen through the rock
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(p.x - w / 2, p.y - h, w, h, h / 2.5); else ctx.rect(p.x - w / 2, p.y - h, w, h);
    ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fee2e2'; ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------ station signs (HTML, projected) */
  var layer = document.createElement('div');
  layer.className = 'r3d-labels';
  var signs = stations.map(function (s) {
    var el = document.createElement('span');
    el.className = 'r3d-sign' + (s.state === 'live' ? '' : ' hollow');
    var num = document.createElement('span'); num.className = 'n'; num.textContent = s.id;
    var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = s.title + (s.state === 'live' ? '' : ' (coming)');
    el.appendChild(num); el.appendChild(nm);
    layer.appendChild(el);
    return el;
  });
  var current = 0;
  function axisInfo(k) {                            // the axis legend the builder writes (dl.axes)
    var t = document.querySelector('#axis-' + k + ' .tip'), name = k, meaning = '';
    if (t && t.firstChild) name = t.firstChild.textContent.trim();
    var tt = t ? t.querySelector('.tt') : null;
    if (tt) meaning = tt.textContent.trim().replace(name + '; ', '');
    return { name: name, meaning: meaning };
  }
  var tip = document.createElement('div');
  tip.id = 'r3d-tip'; tip.className = 'r3d-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  var tipAnchor = null;
  function showTip(anchor, src) {
    tipAnchor = anchor;
    tip.innerHTML = src.innerHTML;
    tip.hidden = false;
    var r = anchor.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = Math.max(4, Math.min(window.innerWidth - tw - 4, r.left));
    var y = r.bottom + 6;
    if (y + th > window.innerHeight - 4) y = Math.max(4, r.top - th - 6);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.hidden = true; tipAnchor = null; }
  function tipOnScroll() {                           // a focused anchor keeps its tooltip, moved with it
    if (tip.hidden) return;
    if (tipAnchor && document.activeElement === tipAnchor) {
      var r = tipAnchor.getBoundingClientRect(), th = tip.offsetHeight, y = r.bottom + 6;
      if (y + th > window.innerHeight - 4) y = Math.max(4, r.top - th - 6);
      tip.style.left = Math.max(4, Math.min(window.innerWidth - tip.offsetWidth - 4, r.left)) + 'px'; tip.style.top = y + 'px';
    } else hideTip();
  }
  function withTip(el, src) {                       // a two-way tooltip: on hover and on keyboard focus
    el.addEventListener('mouseenter', function () { showTip(el, src); });
    el.addEventListener('mouseleave', function () { if (document.activeElement !== el) hideTip(); });
    el.addEventListener('focus', function () { showTip(el, src); });
    el.addEventListener('blur', hideTip);
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') hideTip(); });
  }
  var AXES = [{ k: 'x', at: [0.5, -0.07, 0] }, { k: 'y', at: [-0.07, 0.5, 0] }, { k: 'z', at: [0, 1, 1.12] }];
  var axisLabels = AXES.map(function (A) {
    var info = axisInfo(A.k), el = document.createElement('span');
    el.className = 'r3d-axis'; el.tabIndex = 0;
    el.textContent = info.name;
    var d = document.createElement('span');
    d.className = 'r3d-desc'; d.id = 'r3d-axis-' + A.k;
    var b1 = document.createElement('strong'); b1.textContent = 'What: ';
    var b2 = document.createElement('strong'); b2.textContent = 'How to read: ';
    var l1 = document.createElement('span'); l1.className = 'r3d-tl'; l1.appendChild(b1); l1.appendChild(document.createTextNode(info.name));
    var l2 = document.createElement('span'); l2.className = 'r3d-tl'; l2.appendChild(b2); l2.appendChild(document.createTextNode(info.meaning));
    d.appendChild(l1); d.appendChild(l2);
    el.setAttribute('aria-describedby', d.id);
    withTip(el, d);
    layer.appendChild(el); layer.appendChild(d);
    return { el: el, at: A.at, w: 0, h: 0 };
  });
  function placeAxes() {
    var on = paint === 'map';
    for (var k = 0; k < axisLabels.length; k++) {
      var A = axisLabels[k], el = A.el;
      el.style.display = on ? '' : 'none';
      if (!on) continue;
      if (!A.w) { A.w = el.offsetWidth; A.h = el.offsetHeight; }
      var p = project(WX(A.at[0]), WY(A.at[1]), A.at[2] * HZ);
      var x = p.x - A.w / 2, y = p.y - A.h / 2;
      if (p.z < NEAR) { x = 4; y = 4 + k * (A.h + 4); }
      // keep the label inside the scene's box whatever the camera does
      x = Math.max(4, Math.min(W_PX - A.w - 4, x)); y = Math.max(4, Math.min(H_PX - A.h - 4, y));
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    }
  }
  function placeLabels() {
    placeAxes();
    for (var k = 0; k < stations.length; k++) {
      var s = stations[k], p = project(WX(s.x), WY(s.y), HZ * 1.16), el = signs[k];
      var vis = p.z > NEAR && p.x > -40 && p.x < W_PX + 40 && p.y > -20 && p.y < H_PX + 20;
      el.style.display = vis ? '' : 'none';
      if (vis) el.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
      el.classList.toggle('cur', k === current);
    }
  }

  /* ------------------------------------------------------------ render on demand */
  var pending = 0;
  function requestRender() { if (!pending) pending = requestAnimationFrame(function () { pending = 0; render(); }); }
  function resize() {
    var r = host.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W_PX = Math.max(1, Math.round(r.width)); H_PX = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W_PX * DPR); canvas.height = Math.round(H_PX * DPR);
    render();
  }

  /* ------------------------------------------------------------ turning it */
  function rotate(dyaw, dpitch) {
    cam.yaw += dyaw;
    cam.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, cam.pitch + dpitch));
  }
  function zoom(f) { cam.dist = Math.min(DIST_MAX, Math.max(DIST_MIN, cam.dist * f)); }
  var pointers = {}, pinch = 0;
  canvas.addEventListener('pointerdown', function (ev) {
    pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* not capturable */ } }
    var ids = Object.keys(pointers);
    if (ids.length === 2) pinch = Math.hypot(pointers[ids[0]].x - pointers[ids[1]].x, pointers[ids[0]].y - pointers[ids[1]].y);
  });
  canvas.addEventListener('pointermove', function (ev) {
    var p = pointers[ev.pointerId];
    if (!p) return;
    var ids = Object.keys(pointers);
    if (ids.length === 1) {
      rotate(-(ev.clientX - p.x) * 0.008, (ev.clientY - p.y) * 0.006);
    } else if (ids.length === 2) {
      p.x = ev.clientX; p.y = ev.clientY;
      var dd = Math.hypot(pointers[ids[0]].x - pointers[ids[1]].x, pointers[ids[0]].y - pointers[ids[1]].y);
      if (pinch > 0 && dd > 0) zoom(pinch / dd);
      pinch = dd;
    }
    p.x = ev.clientX; p.y = ev.clientY;
    requestRender();
  });
  function lift(ev) { delete pointers[ev.pointerId]; pinch = 0; }
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
  canvas.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    zoom(ev.deltaY > 0 ? 1.08 : 1 / 1.08);
    requestRender();
  }, { passive: false });
  canvas.addEventListener('keydown', function (ev) {
    var k = ev.key, hit = true;
    if (k === 'ArrowLeft') rotate(0.08, 0);
    else if (k === 'ArrowRight') rotate(-0.08, 0);
    else if (k === 'ArrowUp') rotate(0, 0.06);
    else if (k === 'ArrowDown') rotate(0, -0.06);
    else if (k === '+' || k === '=') zoom(1 / 1.1);
    else if (k === '-' || k === '_') zoom(1.1);
    else hit = false;
    if (hit) { ev.preventDefault(); requestRender(); }
  });
  function resetView() { cam.yaw = DEF.yaw; cam.pitch = DEF.pitch; cam.dist = DEF.dist; focusOn(stations[current]); requestRender(); }

  /* ------------------------------------------------------------ the train */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var playing = false, raf = 0, last = 0, hopTimer = 0;
  var playBtn = document.querySelector('.play');
  function frame(t) {
    if (!playing) return;
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    u += dt * 0.05;
    if (u > X_LAST) u = X_FIRST;
    render();
    raf = requestAnimationFrame(frame);
  }
  function hopNext() {                               // reduced motion: a whole station at a time
    var k = 0;
    while (k < stations.length && stations[k].x <= u + 1e-9) k++;
    u = stations[k % stations.length].x;
    requestRender();
  }
  function setPlaying(pl) {
    playing = pl;
    if (playBtn) {
      playBtn.setAttribute('aria-pressed', pl ? 'true' : 'false');
      playBtn.textContent = pl ? 'Pause the train' : 'Play the train';
    }
    if (reduce) {
      clearTimeout(hopTimer);
      if (pl) { hopNext(); hopTimer = setTimeout(function tick() { if (playing) { hopNext(); hopTimer = setTimeout(tick, 2500); } }, 2500); }
      return;
    }
    if (pl) { last = 0; raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
  }
  if (playBtn) playBtn.addEventListener('click', function () { setPlaying(!playing); });

  /* ------------------------------------------------------------ the two paints */
  var viewButtons = Array.prototype.slice.call(document.querySelectorAll('.toggle button'));
  function setPaint(v) {                             // switches only the paint; the camera stays put
    paint = v === 'map' ? 'map' : 'window';
    document.body.setAttribute('data-view', paint);
    viewButtons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === paint ? 'true' : 'false'); });
    if (paint === 'window') hideTip();
    requestRender();
  }
  viewButtons.forEach(function (b) { b.addEventListener('click', function () { setPaint(b.getAttribute('data-view')); }); });

  /* ------------------------------------------------------------ controls */
  function button(label, cls) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = label;
    return b;
  }
  var resetBtn = button('Reset view', 'r3d-reset');
  resetBtn.addEventListener('click', resetView);
  var fsBtn = button('Full screen', 'r3d-fs');
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fsLabel() { fsBtn.textContent = fsElement() ? 'Exit full screen' : 'Full screen'; }
  function quiet(pr) { if (pr && typeof pr.catch === 'function') pr.catch(function () { fsLabel(); }); }
  fsBtn.addEventListener('click', function () {
    try {
      if (fsElement()) quiet((document.exitFullscreen || document.webkitExitFullscreen).call(document));
      else {
        var req = root.requestFullscreen || root.webkitRequestFullscreen;
        if (req) quiet(req.call(root));
      }
    } catch (e) { fsLabel(); }
  });
  document.addEventListener('fullscreenchange', fsLabel);
  document.addEventListener('webkitfullscreenchange', fsLabel);
  var controls = document.querySelector('.scene .controls');
  if (controls) { controls.appendChild(resetBtn); controls.appendChild(fsBtn); }

  /* ------------------------------------------------------------ one screen (contract 8) */
  // The page becomes one viewport-sized app. Nothing is cloned: the station cards themselves become the
  // accordion rows of the panel, and the rest of the page moves into the toolbar and its two disclosures.
  // With JS off none of this runs and the page is the stacked cards, as before.
  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function descFor(id, node) {                       // a visually hidden description that a tooltip copies
    var d = make('div', 'r3d-desc'); d.id = id;
    if (typeof node === 'string') d.textContent = node; else d.appendChild(node);
    return d;
  }
  var bar = make('div', 'r3d-bar');
  var home = document.querySelector('header.top a.home');
  if (home) bar.appendChild(home);
  var h1 = document.querySelector('main > h1');
  if (h1) { h1.classList.add('r3d-title'); bar.appendChild(h1); }
  var easyP = document.querySelector('.easy-marker');
  if (easyP) {
    var easy = make('span', 'r3d-easy', 'Easy version');
    easy.tabIndex = 0;
    var easyD = descFor('r3d-easy-desc', easyP);
    easy.setAttribute('aria-describedby', easyD.id);
    withTip(easy, easyD);
    bar.appendChild(easy); bar.appendChild(easyD);
  }
  if (controls) bar.appendChild(controls);
  var pops = [];
  function disclosure(label, cls) {
    var d = make('details', 'r3d-pop ' + cls), sm = make('summary', null, label), b = make('div', 'r3d-popbody');
    d.appendChild(sm); d.appendChild(b);
    d.addEventListener('toggle', function () {
      if (d.open) pops.forEach(function (o) { if (o !== d) o.open = false; });
    });
    pops.push(d); bar.appendChild(d);
    return { el: d, body: b, summary: sm };
  }
  var about = disclosure('About this map', 'r3d-about');
  var lede = document.querySelector('main > .lede'), howto = document.querySelector('section.list .howto');
  var figcap = document.querySelector('.ride-figure figcaption');
  [lede, figcap, howto].forEach(function (n) { if (n) about.body.appendChild(n); });
  var trips = disclosure('Side trips', 'r3d-trips');
  var spurH = document.getElementById('spurs'), spurList = document.querySelector('ul.spurs');
  var spurIntro = spurH && spurH.nextElementSibling && spurH.nextElementSibling.tagName === 'P' ? spurH.nextElementSibling : null;
  [spurH, spurIntro, spurList].forEach(function (n) { if (n) trips.body.appendChild(n); });
  function closePops() { pops.forEach(function (o) { o.open = false; }); }
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    pops.forEach(function (o) { if (o.open) { o.open = false; o.querySelector('summary').focus(); } });
  });
  document.addEventListener('pointerdown', function (ev) {
    pops.forEach(function (o) { if (o.open && !o.contains(ev.target)) o.open = false; });
  });
  document.body.insertBefore(bar, document.body.firstChild);

  // the map paint's caption, in the scene; it opens "About this map", which holds the whole caption
  var honest = figcap ? figcap.querySelector('.honest strong') : null;
  if (honest) {
    var capBtn = make('button', 'r3d-cap', honest.textContent);
    capBtn.type = 'button'; capBtn.setAttribute('data-layer', 'map');
    capBtn.addEventListener('click', function () { about.el.open = true; about.summary.focus(); });
    host.appendChild(capBtn);
  }

  // the panel: the station list itself, its cards made into accordion rows
  var panel = document.querySelector('section.list');
  if (panel) panel.classList.add('r3d-panel');
  var hall = document.getElementById('station-0-hall');
  // each stop's picture: a local file named by the builder (data-image, data-image-alt); its caption is
  // the station's own take-away picture. Lazy except the open row's; a tap shows it large.
  var lightbox = make('div', 'r3d-lightbox'), lbImg = make('img');
  lightbox.hidden = true; lightbox.setAttribute('role', 'dialog'); lightbox.setAttribute('aria-modal', 'true');
  lightbox.appendChild(lbImg);
  var lbFrom = null;
  function closeLightbox() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    if (lbFrom) lbFrom.focus();
  }
  lightbox.tabIndex = -1;
  lightbox.addEventListener('click', closeLightbox);
  lightbox.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); closeLightbox(); } });
  document.body.appendChild(lightbox);
  function picture(li) {
    var src = li.getAttribute('data-image'), alt = li.getAttribute('data-image-alt');
    if (!src) return null;
    var fig = make('figure', 'r3d-fig'), zoomBtn = make('button', 'r3d-zoom'), img = make('img', 'r3d-img');
    img.loading = 'lazy'; img.decoding = 'async'; img.alt = alt || ''; img.src = src;   // lazy before src
    zoomBtn.type = 'button';
    zoomBtn.appendChild(img);
    zoomBtn.addEventListener('click', function () {
      lbImg.src = img.src; lbImg.alt = img.alt; lbFrom = zoomBtn;
      lightbox.setAttribute('aria-label', img.alt);
      lightbox.hidden = false; lightbox.focus();
    });
    fig.appendChild(zoomBtn);
    var pic = li.querySelector('.carry strong');
    if (pic) fig.appendChild(make('figcaption', null, pic.textContent));
    return { el: fig, img: img };
  }
  var rows = stations.map(function (s, k) {
    var li = s.li, h3 = li.querySelector('h3'), btn = make('button', 'r3d-row'), body = make('div', 'r3d-body');
    btn.type = 'button'; btn.id = 'r3d-row-' + s.id; body.id = 'r3d-body-' + s.id;
    if (h3) { while (h3.firstChild) btn.appendChild(h3.firstChild); h3.appendChild(btn); }
    var kids = Array.prototype.slice.call(li.childNodes);
    kids.forEach(function (n) { if (n !== h3) body.appendChild(n); });
    li.appendChild(body);
    if (k === 0 && hall) body.insertBefore(hall, body.firstChild);
    var fig = picture(li);                           // the image comes first, so it shows without scrolling
    if (fig) body.insertBefore(fig.el, body.firstChild);
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', body.id);
    var ph = li.querySelector('.phase');
    var gloss = ph ? ph.textContent.trim().replace(/^On the map:\s*/, '') : s.title;
    var d = descFor('r3d-gloss-' + s.id, gloss);
    btn.setAttribute('aria-describedby', d.id);
    if (h3) h3.appendChild(d);
    withTip(btn, d);
    btn.addEventListener('click', function () { openRow(k, true); });
    btn.addEventListener('keydown', function (ev) {
      var to = ev.key === 'ArrowDown' ? k + 1 : ev.key === 'ArrowUp' ? k - 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? stations.length - 1 : -1;
      if (to < 0 || to >= stations.length) return;
      ev.preventDefault(); rows[to].btn.focus();
    });
    var next = li.querySelector('a.next-stop');
    if (next) {
      next.addEventListener('click', function (ev) { ev.preventDefault(); openRow((k + 1) % stations.length, true); });
      var prev = make('button', 'r3d-prev', '\u2190 Previous stop');
      prev.type = 'button';
      if (k === 0) prev.setAttribute('aria-disabled', 'true');
      prev.addEventListener('click', function () { if (k > 0) openRow(k - 1, true); });
      next.parentNode.insertBefore(prev, next);
    }
    body.hidden = true;
    return { li: li, btn: btn, body: body, img: fig ? fig.img : null };
  });
  function openRow(k, setHash) {
    for (var i = 0; i < rows.length; i++) {
      var on = i === k;
      rows[i].btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      rows[i].body.hidden = !on;
      rows[i].li.classList.toggle('r3d-open', on);
      if (on && rows[i].img) rows[i].img.loading = 'eager';
    }
    current = k;
    u = stations[k].x;
    focusOn(stations[k]);
    requestRender();
    if (panel) panel.scrollTop = Math.max(0, rows[k].li.offsetTop - 4);
    if (setHash && window.location.hash !== '#station-' + stations[k].id) window.location.hash = '#station-' + stations[k].id;
  }
  function stationIndex(id) {
    for (var i = 0; i < stations.length; i++) if (stations[i].id === id) return i;
    return -1;
  }
  function arrive(hash) {                            // #station-N opens that row; #spur-X opens Side trips too
    var m = /^#station-(.+)$/.exec(hash || ''), k = m ? stationIndex(m[1]) : -1;
    if (k >= 0) { closePops(); openRow(k, false); return true; }
    var spur = /^#spur-/.test(hash || '') ? document.getElementById(hash.slice(1)) : null;
    if (spur && trips.body.contains(spur)) {
      var back = spur.querySelector('a[href^="#station-"]');
      var j = back ? stationIndex(back.getAttribute('href').slice('#station-'.length)) : -1;
      openRow(j >= 0 ? j : current, false);
      trips.el.open = true;
      return true;
    }
    return false;
  }
  window.addEventListener('hashchange', function () { arrive(window.location.hash); });

  /* ------------------------------------------------------------ start */
  var svg = document.getElementById('ride-svg');
  if (svg) { svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('inert', ''); svg.classList.add('r3d-gone'); }
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A landscape you can turn: one peak for each station, lined up along one line with valleys between them, and a level monorail that runs through each summit in a tunnel and crosses each valley on a bridge.');
  host.appendChild(canvas);
  host.appendChild(layer);
  document.body.appendChild(tip);
  window.addEventListener('scroll', tipOnScroll, true);
  host.hidden = false;
  if (!arrive(window.location.hash)) openRow(0, false);   // no hash opens station 0
  setPaint('window');                                     // the first load uses the default paint
  if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(host);
  window.addEventListener('resize', resize);
  resize();

  window.__ride3d = {
    C: C,
    beads: stations.map(function (s) { return { id: s.id, x: s.x, y: s.y }; }),
    meshMin: meshMin, meshMax: meshMax, quadCount: NQ, grid: [NX, NY], frameTimes: frameTimes,
    rotate: function (a, b) { rotate(a, b); }, renderNow: render, paint: function () { return paint; },
    camera: function () { return { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, tx: cam.tx, ty: cam.ty }; }
  };
})();
