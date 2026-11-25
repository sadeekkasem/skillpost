/* نور الإسلام — إضافات قارئ القرآن: فهرس الأجزاء، البحث، المفضلة، النسخ والمشاركة، الاستماع للآية وتكرارها،
   سرعة التلاوة، تكرار السورة، ملء الشاشة. نص القرآن يُقرأ من ملفات تنزيل نفسها ويُعرض بـ textContent دون تعديل. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};
  if(!$('quran-reader')||!window.__quranState)return;
  var SITE='https://www.noorislamsite.com';
  var FAV_KEY='noor-quran-favs-v1';
  function toast(t){if(window.NoorUI)window.NoorUI.toast(t);}
  function status(t){$('ayah-tools-status').textContent=t||'';}
  function cur(){var st=window.__quranState();var v=st.surah.verses&&st.surah.verses[st.verseIndex];return {s:st.surah.id,name:st.surah.name,a:st.verseIndex+1,text:v?v.text:null};}
  function plain(c){return '﴿'+c.text+'﴾ [سورة '+c.name+': '+c.a+']';}
  function copy(text,msg){if(window.NoorShare)return window.NoorShare.copy(text,msg);if(navigator.clipboard)navigator.clipboard.writeText(text).then(function(){toast(msg);});}
  function share(title,text,url){if(window.NoorShare)return window.NoorShare.share(title,text,url);copy(text+'\n'+url,'نُسخ');}
  function pad3(n){return String(n).padStart(3,'0');}
  function ayahUrl(s,a){return 'https://everyayah.com/data/Alafasy_128kbps/'+pad3(s)+pad3(a)+'.mp3';}

  /* Juz index */
  fetch('/data/mushaf.json',{credentials:'omit'}).then(function(r){return r.json();}).then(function(m){
    var sel=$('juz-select');
    (m.juzs||[]).forEach(function(j){var st=window.__quranState().quranData[j.surah-1];var o=document.createElement('option');o.value=j.surah+'/'+j.ayah;o.textContent='الجزء '+j.id+' — '+(st?st.name:'')+' '+j.ayah;sel.appendChild(o);});
  }).catch(function(){});
  $('juz-select').addEventListener('change',function(e){if(!e.target.value)return;location.hash='#quran-reader/'+e.target.value;e.target.value='';});

  /* Favorites */
  function loadFavs(){try{var v=JSON.parse(localStorage.getItem(FAV_KEY)||'[]');return Array.isArray(v)?v.filter(function(x){return x&&Number.isInteger(x.s)&&Number.isInteger(x.a);}):[];}catch(e){return [];}}
  function saveFavs(v){try{localStorage.setItem(FAV_KEY,JSON.stringify(v));}catch(e){}}
  function isFav(c){return loadFavs().some(function(x){return x.s===c.s&&x.a===c.a;});}
  function renderFavs(){
    var list=$('fav-list');list.replaceChildren();var favs=loadFavs();
    if(!favs.length){var li=document.createElement('li');li.textContent='لا آيات في المفضلة بعد. اختر رقم آية ثم اضغط «إضافة للمفضلة».';list.appendChild(li);return;}
    favs.forEach(function(f){var li=document.createElement('li');var a=document.createElement('a');a.className='text-link';a.href='#quran-reader/'+f.s+'/'+f.a;a.textContent='سورة '+f.name+' — الآية '+f.a;var rm=document.createElement('button');rm.type='button';rm.className='button secondary small';rm.textContent='إزالة';rm.setAttribute('aria-label','إزالة سورة '+f.name+' الآية '+f.a+' من المفضلة');rm.addEventListener('click',function(){saveFavs(loadFavs().filter(function(x){return !(x.s===f.s&&x.a===f.a);}));renderFavs();syncTools();});li.append(a,rm);list.appendChild(li);});
  }
  function syncTools(){var c=cur();var on=c.text&&isFav(c);$('ayah-fav').setAttribute('aria-pressed',String(!!on));$('ayah-fav').textContent=on?'★ في المفضلة':'☆ إضافة للمفضلة';
    document.querySelectorAll('.ayah-marker').forEach(function(m){var n=Number(m.textContent);m.classList.toggle('is-fav',loadFavs().some(function(x){return x.s===c.s&&x.a===n;}));});}
  $('ayah-fav').addEventListener('click',function(){var c=cur();if(!c.text)return;var favs=loadFavs();if(isFav(c)){favs=favs.filter(function(x){return !(x.s===c.s&&x.a===c.a);});toast('أُزيلت من المفضلة');}else{favs.unshift({s:c.s,a:c.a,name:c.name});toast('أُضيفت إلى المفضلة');}saveFavs(favs.slice(0,200));renderFavs();syncTools();});
  $('ayah-copy').addEventListener('click',function(){var c=cur();if(c.text)copy(plain(c),'نُسخت الآية');});
  $('ayah-share').addEventListener('click',function(){var c=cur();if(c.text)share('سورة '+c.name+' — '+c.a,plain(c),SITE+'/#quran-reader/'+c.s+'/'+c.a);});

  /* Single-ayah audio (listen / repeat) */
  var aAudio=$('ayah-audio');var repeatOn=false;
  function playAyah(loop){var c=cur();if(!c.text)return;var main=$('quran-audio');if(main&&!main.paused){main.pause();}aAudio.loop=!!loop;aAudio.src=ayahUrl(c.s,c.a);status('تلاوة الآية '+c.a+' بصوت مشاري العفاسي عبر EveryAyah'+(loop?' — تكرار مستمر':'')+'.');aAudio.playbackRate=Number($('audio-speed').value)||1;aAudio.play().catch(function(){status('تعذّر تشغيل الصوت. تحقّق من الاتصال.');});}
  $('ayah-listen').addEventListener('click',function(){if(!aAudio.paused&&!repeatOn){aAudio.pause();$('ayah-listen').textContent='▶ استمع للآية';return;}repeatOn=false;$('ayah-repeat').setAttribute('aria-pressed','false');playAyah(false);$('ayah-listen').textContent='❚❚ إيقاف';});
  aAudio.addEventListener('ended',function(){$('ayah-listen').textContent='▶ استمع للآية';});
  aAudio.addEventListener('pause',function(){$('ayah-listen').textContent='▶ استمع للآية';});
  $('ayah-repeat').addEventListener('click',function(){repeatOn=!repeatOn;this.setAttribute('aria-pressed',String(repeatOn));this.textContent=repeatOn?'إيقاف تكرار الآية':'تكرار الآية المختارة';if(repeatOn)playAyah(true);else{aAudio.pause();aAudio.loop=false;status('');}});

  /* Speed + loop for the full-surah player */
  var main=$('quran-audio');
  try{var sp=Number(localStorage.getItem('noor-audio-speed-v1'));if([0.75,1,1.25,1.5].indexOf(sp)>=0)$('audio-speed').value=String(sp);}catch(e){}
  function applySpeed(){var r=Number($('audio-speed').value)||1;main.playbackRate=r;main.defaultPlaybackRate=r;aAudio.playbackRate=r;}
  $('audio-speed').addEventListener('change',function(){applySpeed();try{localStorage.setItem('noor-audio-speed-v1',$('audio-speed').value);}catch(e){}});
  main.addEventListener('play',applySpeed);main.addEventListener('loadedmetadata',applySpeed);applySpeed();
  $('audio-loop').addEventListener('change',function(){main.loop=this.checked;});
  main.addEventListener('loadstart',function(){main.loop=$('audio-loop').checked;});

  /* Fullscreen reading */
  $('reader-fullscreen').addEventListener('click',function(){var el=$('quran-reader');if(document.fullscreenElement){document.exitFullscreen();return;}if(el.requestFullscreen)el.requestFullscreen().catch(function(){document.body.classList.toggle('reader-fullscreen');});else document.body.classList.toggle('reader-fullscreen');});

  /* Search (diacritics-insensitive) */
  var index=null,loading=null;
  function norm(s,keepDaggerAlef){s=String(s).normalize('NFKD');if(keepDaggerAlef)s=s.replace(/\u0670/g,'\u0627');return s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]/g,'').replace(/[ٱأإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/\s+/g,' ').trim();}
  function buildIndex(){
    if(loading)return loading;
    var st=window.__quranState();var done=0;$('quran-search-status').textContent='جارٍ تحميل نص المصحف للبحث… 0 / 114';
    var ids=st.quranData.map(function(_,i){return i;});var out=[];
    function worker(){var i=ids.shift();if(i===undefined)return Promise.resolve();return window.__quranLoadSurah(i).then(function(s){s.verses.forEach(function(v,k){out.push({s:s.id,name:s.name,a:k+1,text:v.text,n:norm(v.text)+' | '+norm(v.text,true)});});done++;$('quran-search-status').textContent='جارٍ تحميل نص المصحف للبحث… '+done+' / 114';return worker();});}
    loading=Promise.all([worker(),worker(),worker(),worker(),worker(),worker()]).then(function(){out.sort(function(x,y){return x.s-y.s||x.a-y.a;});index=out;return out;}).catch(function(e){loading=null;throw e;});
    return loading;
  }
  $('quran-search-open').addEventListener('click',function(){$('quran-search-card').scrollIntoView({behavior:'smooth',block:'center'});$('quran-search-input').focus({preventScroll:true});});
  $('quran-search-form').addEventListener('submit',function(e){
    e.preventDefault();var q=norm($('quran-search-input').value);
    if(q.length<2){$('quran-search-status').textContent='اكتب حرفين على الأقل.';return;}
    buildIndex().then(function(idx){
      var words=q.split(' ');var res=idx.filter(function(x){return words.every(function(w){return x.n.indexOf(w)>=0;});});
      var ol=$('quran-search-results');ol.replaceChildren();
      res.slice(0,100).forEach(function(r){var li=document.createElement('li');var a=document.createElement('a');a.className='text-link';a.href='#quran-reader/'+r.s+'/'+r.a;a.textContent='سورة '+r.name+' — الآية '+r.a;var p=document.createElement('p');p.className='ayah-text';p.textContent=r.text;li.append(a,p);ol.appendChild(li);});
      $('quran-search-status').textContent=res.length?('عدد النتائج: '+res.length+(res.length>100?' (تُعرض أول 100)':'')):'لا نتائج. جرّب كلمة أخرى أو جزءًا من الكلمة.';
    }).catch(function(){$('quran-search-status').textContent='تعذّر تحميل نص المصحف. تحقّق من الاتصال ثم أعد المحاولة.';});
  });

  /* Translation of meanings — QuranEnc.com (live API, unmodified; credit + version shown) */
  var TR_KEY='noor-translation-v1',trList=null,trCache={},trChoice='';
  try{trChoice=localStorage.getItem(TR_KEY)||'';}catch(e){}
  function trMeta(){return trList&&trList.find(function(t){return t.key===trChoice;});}
  function credit(){var m=trMeta();return m?('الترجمة: '+m.title+' — الإصدار '+m.version+' · المصدر: موسوعة القرآن الكريم QuranEnc.com، تُعرض كما هي دون تعديل. الترجمة بيان لمعاني القرآن وليست قرآنًا.'):'';}
  function loadSura(key,s){var id=key+'/'+s;if(!trCache[id])trCache[id]=fetch('https://quranenc.com/api/v1/translation/sura/'+encodeURIComponent(key)+'/'+s,{credentials:'omit'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){var map={};(d.result||[]).forEach(function(x){map[Number(x.aya)]=x;});return map;}).catch(function(e){delete trCache[id];throw e;});return trCache[id];}
  function renderTr(){
    var box=$('translation-aya'),page=$('translation-page');
    if(!trChoice){box.hidden=true;page.hidden=true;$('translation-credit').textContent='ترجمات معتمدة بعشرات اللغات من QuranEnc.com، تُجلب من موقعهم عند اختيارها.';return;}
    var st=window.__quranState();if(!st.surah.verses)return;var m=trMeta();var dir=m&&m.direction==='rtl'?'rtl':'ltr';var lang=m?m.language_iso_code:'en';
    box.dir=dir;box.lang=lang;box.hidden=false;box.textContent='جارٍ تحميل الترجمة…';
    loadSura(trChoice,st.surah.id).then(function(map){
      var x=map[st.verseIndex+1];box.replaceChildren();
      if(x){var t=document.createElement('p');t.textContent=x.translation;box.appendChild(t);if(x.footnotes){var f=document.createElement('p');f.className='footnotes';f.textContent=x.footnotes;box.appendChild(f);}}
      $('translation-credit').textContent=credit();
      var list=$('translation-list');list.replaceChildren();var r=st.range||{start:0,end:st.surah.verses.length};
      for(var i=r.start;i<r.end;i++){var y=map[i+1];if(!y)continue;var li=document.createElement('li');li.dir=dir;li.lang=lang;var n=document.createElement('span');n.className='num';n.textContent=String(i+1);li.appendChild(n);li.appendChild(document.createTextNode(y.translation));list.appendChild(li);}
      $('translation-page-credit').textContent=credit();page.hidden=false;
    }).catch(function(){box.textContent='تعذّر تحميل الترجمة من QuranEnc.com. تحقّق من الاتصال.';page.hidden=true;});
  }
  var listLoading=null;function ensureList(){if(listLoading||$('quran-reader').hidden)return;listLoading=fetch('https://quranenc.com/api/v1/translations/list?localization=ar',{credentials:'omit'}).then(function(r){return r.json();}).then(function(d){
    trList=(d.translations||[]).filter(function(t){return t&&t.key;});
    var sel=$('translation-select');var byLang={};
    trList.forEach(function(t){(byLang[t.language_iso_code]=byLang[t.language_iso_code]||[]).push(t);});
    var prefer=['en','fr','es','de','tr','ur','id','ms','bn','ru','fa','zh','sw','ha','so','am','bs','sq'];
    Object.keys(byLang).sort(function(a,b){var ia=prefer.indexOf(a),ib=prefer.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);}).forEach(function(l){var og=document.createElement('optgroup');og.label=l.toUpperCase();byLang[l].forEach(function(t){var o=document.createElement('option');o.value=t.key;o.textContent=t.title;og.appendChild(o);});sel.appendChild(og);});
    if(trChoice&&!trMeta())trChoice='';sel.value=trChoice;renderTr();
  }).catch(function(){listLoading=null;$('translation-credit').textContent='تعذّر تحميل قائمة الترجمات من QuranEnc.com.';});}
  window.addEventListener('hashchange',function(){setTimeout(ensureList,0);});ensureList();
  $('translation-select').addEventListener('change',function(e){trChoice=e.target.value;try{localStorage.setItem(TR_KEY,trChoice);}catch(x){}renderTr();});

  window.addEventListener('noor:ayah-selected',function(){syncTools();ensureList();if(trChoice&&trList)renderTr();});
  renderFavs();syncTools();
})();
