(function(){
  /* Counts distinct pages read. Storage may be missing, full, or blocked (reading
     window.localStorage itself throws a SecurityError when site data is blocked):
     every access is wrapped, so this script never throws and simply does nothing. */
  var ls = null;
  try { ls = window.localStorage || null; } catch (e) { ls = null; }
  if (!ls || typeof IntersectionObserver !== 'function') return;
  var marker = document.querySelector('.scroll-marker');
  if (!marker) return;
  var obs = new IntersectionObserver(function(entries){
    if (entries[0].isIntersecting) {
      obs.disconnect();
      try {
        var d = JSON.parse(ls.getItem('webannex_visits') || '{"count":0,"pages":{}}');
        if (!d || typeof d !== 'object' || !d.pages) d = {count: 0, pages: {}};
        var p = location.pathname;
        if (!d.pages[p]) {
          d.pages[p] = Date.now();
          d.count = (d.count | 0) + 1;
          ls.setItem('webannex_visits', JSON.stringify(d));
        }
      } catch (e) { /* storage blocked, full or corrupt: count nothing */ }
    }
  }, {threshold: 0.1});
  obs.observe(marker);
})();
