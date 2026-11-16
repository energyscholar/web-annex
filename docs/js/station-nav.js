/* station-nav.js: fills in "previous station" and "next station" on an expert page of the line.
 *
 * The page carries <nav class="station-nav" data-station="N"> with a static link to the ride map;
 * js/station-data.js (written from ride/stations.json) loads first. This script adds the nearest live
 * station before and after N, linked to that station's physics page, so a reader already in the
 * physics layer can keep riding in it. It is for expert pages only: a beginner page must not load it
 * (STANDARD.md, S5). Spur pages (data-spur) get no previous/next. No dependencies; ES2019.
 */
(function () {
  'use strict';
  var nav = document.querySelector('nav.station-nav[data-station]');
  var rows = window.RIDE_STATIONS;
  if (!nav || !rows) return;
  var line = nav.querySelector('a[data-line]');
  var root = line ? line.getAttribute('href').replace(/ride\/.*$/, '') : '';
  var sid = nav.getAttribute('data-station');
  var at = -1;
  for (var i = 0; i < rows.length; i++) if (rows[i].id === sid) at = i;
  if (at < 0) return;
  function live(from, step) {
    for (var j = from + step; j >= 0 && j < rows.length; j += step) if (rows[j].state === 'live' && rows[j].expert) return rows[j];
    return null;
  }
  function link(row, cls, before, after) {
    var span = document.createElement('span');
    span.className = cls;
    if (row) {
      var a = document.createElement('a');
      a.href = root + row.expert.replace(/index\.html$/, '');
      a.textContent = before + 'station ' + row.id + ', ' + row.title + after;
      span.appendChild(a);
    }
    return span;
  }
  nav.insertBefore(link(live(at, -1), 'prev', '← ', ''), nav.firstChild);
  nav.appendChild(link(live(at, 1), 'next', '', ' →'));
})();
