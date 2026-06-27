(function(){
  if (!window.localStorage) return;
  var marker = document.querySelector('.scroll-marker');
  if (!marker) return;
  var obs = new IntersectionObserver(function(entries){
    if (entries[0].isIntersecting) {
      obs.disconnect();
      var d = JSON.parse(localStorage.getItem('webannex_visits') || '{"count":0,"pages":{}}');
      var p = location.pathname;
      if (!d.pages[p]) {
        d.pages[p] = Date.now();
        d.count++;
        localStorage.setItem('webannex_visits', JSON.stringify(d));
      }
    }
  }, {threshold: 0.1});
  obs.observe(marker);
})();
