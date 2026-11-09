(function(){
  function load(box){
    var embed = box.getAttribute('data-embed');
    if(!embed) return;
    var f = document.createElement('iframe');
    f.src = embed;
    f.title = 'مشغّل الفيديو';
    f.setAttribute('allow','accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen');
    f.setAttribute('allowfullscreen','');
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.className = 'yt-frame';
    box.replaceChildren(f);
  }
  document.addEventListener('click', function(ev){
    var btn = ev.target.closest('[data-yt-load]');
    if(!btn) return;
    var box = btn.closest('.yt-facade');
    if(box) load(box);
  });
})();
