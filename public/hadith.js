/* نور الإسلام — صفحة الحديث الشريف. النصوص تُعرض بـ textContent كما وردت من المصدر دون أي تعديل. */
(function(){
  'use strict';
  var H=window.NoorHadith;var PAGE=20;
  var DATA_V='20261114m';var DATA_URL='/data/hadith/hadith.json?v='+DATA_V;
  var el=function(id){return document.getElementById(id);};
  var state={book:'all',root:'all',topic:'all',q:'',shown:0,list:[]};var db=null;

  function make(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function row(label,value,cls){var d=make('div','hadith-field'+(cls?' '+cls:''));d.appendChild(make('dt',null,label));d.appendChild(make('dd',null,value));return d;}

  function card(h){
    var a=make('article','card hadith-card');a.id='h-'+h.id;
    var top=make('div','hadith-top');top.appendChild(make('span','hadith-book hadith-book-'+h.book,H.BOOKS[h.book]));
    a.appendChild(top);
    a.appendChild(make('h2','hadith-title',h.title));
    var t=make('p','hadith-text',h.hadeeth);t.lang='ar';a.appendChild(t);
    var dl=make('dl','hadith-meta');
    dl.appendChild(row('الدرجة',h.grade));
    dl.appendChild(row('التخريج',h.attribution));
    if(h.reference)dl.appendChild(row('المرجع',h.reference,'hadith-ref'));
    a.appendChild(dl);
    var d=make('details','hadith-sharh');var sum=make('summary',null,'الشرح والفوائد ومعاني الكلمات');d.appendChild(sum);
    var body=make('div','hadith-sharh-body');d.appendChild(body);
    d.addEventListener('toggle',function(){if(d.open&&!body.dataset.loaded)loadSharh(h,body);});
    a.appendChild(d);
    a.appendChild(credit(h));
    return a;
  }
  function credit(h){var c=make('p','hadith-credit');var link=make('a','text-link',H.CREDIT);link.href=h.url;link.target='_blank';link.rel='noopener noreferrer';c.appendChild(link);return c;}

  var chunks={};
  function getChunk(n){if(!chunks[n])chunks[n]=fetch('/data/hadith/sharh/'+n+'.json?v='+DATA_V,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).catch(function(e){delete chunks[n];throw e;});return chunks[n];}
  function loadSharh(h,body){
    body.textContent='';body.appendChild(make('p','mini-label','جارٍ تحميل الشرح…'));
    getChunk(h.s).then(function(c){
      var x=c[h.id]||{};body.textContent='';body.dataset.loaded='1';
      if(x.explanation){body.appendChild(make('h3',null,'الشرح'));body.appendChild(make('p','hadith-explanation',x.explanation));}
      if(x.hints&&x.hints.length){body.appendChild(make('h3',null,'من فوائد الحديث'));var ul=make('ul','hadith-hints');x.hints.forEach(function(t){ul.appendChild(make('li',null,t));});body.appendChild(ul);}
      if(x.words_meanings&&x.words_meanings.length){body.appendChild(make('h3',null,'معاني الكلمات'));var dl=make('dl','hadith-words');x.words_meanings.forEach(function(w){var r=make('div');r.appendChild(make('dt',null,w.word));r.appendChild(make('dd',null,w.meaning));dl.appendChild(r);});body.appendChild(dl);}
      body.appendChild(credit(h));
    }).catch(function(){body.textContent='';body.appendChild(make('p','mini-label','تعذّر تحميل الشرح. أغلق القسم وافتحه مرة أخرى.'));});
  }

  function topicId(){return state.topic!=='all'?state.topic:state.root;}
  function apply(reset){
    var base=H.filter(db,{category:topicId(),q:state.q});
    var c=H.counts(base);
    var shown={all:c.all,agreed:c.agreed,bukhari:c.bukhariAll,muslim:c.muslimAll};
    document.querySelectorAll('[data-count]').forEach(function(s){s.textContent='('+shown[s.dataset.count].toLocaleString('ar-EG')+')';});
    state.list=base.filter(function(h){return H.inBook(h,state.book);});
    if(reset){state.shown=0;el('hadith-list').textContent='';}
    more();
  }
  function more(){
    var list=el('hadith-list');var next=state.list.slice(state.shown,state.shown+PAGE);
    var frag=document.createDocumentFragment();next.forEach(function(h){frag.appendChild(card(h));});list.appendChild(frag);
    state.shown+=next.length;
    var total=state.list.length;
    el('hadith-results').textContent=total?('عدد الأحاديث: '+total.toLocaleString('ar-EG')+' · المعروض: '+state.shown.toLocaleString('ar-EG')):'لا توجد أحاديث مطابقة. جرّب كلمة أخرى أو باباً آخر.';
    el('hadith-more').hidden=state.shown>=total;
  }

  function fillRoots(){
    var sel=el('hadith-root');
    db.categories.filter(function(c){return !c.parent;}).forEach(function(c){var o=make('option',null,c.title+' ('+c.count.toLocaleString('ar-EG')+')');o.value=c.id;sel.appendChild(o);});
  }
  function fillTopics(){
    var sel=el('hadith-topic');sel.textContent='';var o0=make('option',null,'كل الموضوعات');o0.value='all';sel.appendChild(o0);
    if(state.root==='all'){sel.disabled=true;return;}
    var kids=function(pid,depth){db.categories.filter(function(c){return c.parent===pid;}).forEach(function(c){var o=make('option',null,new Array(depth+1).join('— ')+c.title+' ('+c.count.toLocaleString('ar-EG')+')');o.value=c.id;sel.appendChild(o);kids(c.id,depth+1);});};
    kids(state.root,0);sel.disabled=sel.options.length<2;
  }

  function showTarget(){
    var id=new URLSearchParams(location.search).get('id');if(!id||!/^\d+$/.test(id))return;
    var h=db.hadiths.find(function(x){return x.id===id;});if(!h)return;
    var c=card(h);c.classList.add('is-target');var lead=make('p','mini-label','الحديث المطلوب:');
    var list=el('hadith-list');list.insertBefore(c,list.firstChild);list.insertBefore(lead,c);
    var d=c.querySelector('details');if(d)d.open=true;
    setTimeout(function(){c.scrollIntoView({block:'start'});},0);
  }
  var timer=null;
  function bind(){
    el('hadith-search').addEventListener('input',function(e){clearTimeout(timer);timer=setTimeout(function(){state.q=e.target.value;apply(true);},220);});
    el('hadith-root').addEventListener('change',function(e){state.root=e.target.value;state.topic='all';fillTopics();apply(true);});
    el('hadith-topic').addEventListener('change',function(e){state.topic=e.target.value;apply(true);});
    document.querySelectorAll('.hadith-books [data-book]').forEach(function(b){b.addEventListener('click',function(){state.book=b.dataset.book;document.querySelectorAll('.hadith-books [data-book]').forEach(function(x){x.setAttribute('aria-checked',String(x===b));});apply(true);});});
    el('hadith-more').addEventListener('click',more);
  }

  fetch(DATA_URL,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(data){
    db=H.prepare(data);
    var m=db.meta||{};
    if(m.version)el('hadith-version').textContent='الإصدار: '+m.version+'، تاريخ الجلب: '+String(m.fetchedAt||'').slice(0,10)+'.';
    fillRoots();bind();apply(true);showTarget();
  }).catch(function(){el('hadith-results').textContent='تعذّر تحميل الأحاديث. أعد تحميل الصفحة.';});
})();
