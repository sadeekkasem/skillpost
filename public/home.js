/* نور الإسلام — الصفحة الرئيسية: لوحة المواقيت، آية اليوم، حديث اليوم، متابعة القراءة، الأذكار حسب الوقت.
   يعتمد على دوال app.js (prayerCities, validatePrayerInput, calculatePrayer, civilHijri, prayerNames).
   النصوص الدينية تُعرض بـ textContent كما وردت في ملفات المصدر دون تعديل. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};
  if(!$('prayer-panel'))return;
  var HOME_KEY='noor-prayer-home-v1';
  var SITE='https://www.noorislamsite.com';

  function toast(t){if(window.NoorUI)window.NoorUI.toast(t);}
  function copyText(text,okMsg){
    var done=function(){toast(okMsg||'نُسخ النص');};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,function(){fallback();});}else fallback();
    function fallback(){var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){toast('تعذّر النسخ');}ta.remove();}
  }
  function share(title,text,url){
    if(navigator.share){navigator.share({title:title,text:text,url:url}).catch(function(){});}
    else copyText(text+'\n'+url,'نُسخ النص والرابط للمشاركة');
  }
  window.NoorShare={copy:copyText,share:share};

  /* ---------- Smooth scroll for "ابدأ رحلتك" ---------- */
  document.querySelectorAll('[data-scroll-to]').forEach(function(a){a.addEventListener('click',function(e){var t=$(a.dataset.scrollTo);if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth',block:'start'});}});});

  /* ---------- Prayer panel ---------- */
  var ORDER=['fajr','sunrise','dhuhr','asr','maghrib','isha'];
  var PRAYERS=['fajr','dhuhr','asr','maghrib','isha'];
  var tick=null,current=null;

  function loadHome(){try{var v=JSON.parse(localStorage.getItem(HOME_KEY)||'null');if(v&&Number.isFinite(v.lat)&&Number.isFinite(v.lon)&&typeof v.zone==='string')return v;}catch(e){}return null;}
  function saveHome(v){try{localStorage.setItem(HOME_KEY,JSON.stringify(v));}catch(e){}}
  function dateInZone(zone,offsetDays){var d=new Date(Date.now()+(offsetDays||0)*864e5);var p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);var g=function(t){return p.find(function(x){return x.type===t;}).value;};return g('year')+'-'+g('month')+'-'+g('day');}
  function hm(instant,zone){return instant?new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(instant):'—';}
  function compute(cfg,offset){
    var input=validatePrayerInput({lat:cfg.lat,lon:cfg.lon,zone:cfg.zone,date:dateInZone(cfg.zone,offset),method:cfg.method||'MWL',madhab:cfg.madhab||'Standard',high:cfg.high||'NightMiddle'});
    return {input:input,result:calculatePrayer(input)};
  }
  function fillSelect(){
    var sel=$('pp-select');if(typeof prayerCities==='undefined')return;
    var groups={};Object.keys(prayerCities).forEach(function(id){var c=prayerCities[id];(groups[c.group]=groups[c.group]||[]).push([id,c]);});
    Object.keys(groups).forEach(function(g){var og=document.createElement('optgroup');og.label=g;groups[g].forEach(function(pair){var o=document.createElement('option');o.value=pair[0];o.textContent=pair[1].label;og.appendChild(o);});sel.appendChild(og);});
  }
  function suggest(){
    var zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(typeof prayerCityForZone!=='function')return;
    var m=prayerCityForZone(zone);if(!m)return;
    $('pp-status').textContent='';
    var b=document.createElement('button');b.type='button';b.className='button small';b.textContent='اعرض مواقيت '+m[1].label;
    b.addEventListener('click',function(){useCity(m[0]);});
    var span=document.createElement('span');span.textContent='اقتراح حسب المنطقة الزمنية لجهازك: ';
    $('pp-status').append(span,b);
  }
  function useCity(id){
    var c=prayerCities[id];if(!c)return;
    var prev=loadHome()||{};
    saveHome({lat:c.lat,lon:c.lon,zone:c.zone,method:prev.method||'MWL',madhab:prev.madhab||'Standard',high:prev.high||'NightMiddle',label:c.label,city:id});
    render();
  }
  function render(){
    var cfg=loadHome();
    if(tick){clearInterval(tick);tick=null;}
    if(!cfg){$('pp-body').hidden=true;$('pp-city').textContent='مدينتك';$('pp-hijri').textContent='—';$('pp-greg').textContent=new Intl.DateTimeFormat('ar',{dateStyle:'long',numberingSystem:'latn'}).format(new Date());suggest();return;}
    try{
      var today=compute(cfg,0);
      current={cfg:cfg,today:today,tomorrow:null};
      $('pp-city').textContent=cfg.label||'موقعك';
      $('pp-select').value=cfg.city||'';
      $('pp-hijri').textContent=today.result.hijri?today.result.hijri+' (حسابي)':'غير مدعوم في المتصفح';
      $('pp-greg').textContent=new Intl.DateTimeFormat('ar',{dateStyle:'long',timeZone:cfg.zone,numberingSystem:'latn'}).format(new Date());
      var strip=$('pp-strip');strip.replaceChildren();
      ORDER.forEach(function(key){var ev=today.result.events.find(function(e){return e.key===key;});var d=document.createElement('div');d.className='prayer-slot';d.dataset.key=key;var s=document.createElement('span');s.textContent=prayerNames[key]+(ev&&ev.estimated?' *':'');var t=document.createElement('strong');t.textContent=hm(ev&&ev.instant,cfg.zone);d.append(s,t);strip.appendChild(d);});
      var methods={MWL:'رابطة العالم الإسلامي',ISNA:'أمريكا الشمالية',Egypt:'الهيئة المصرية',Karachi:'كراتشي'};
      $('pp-note').textContent='حساب فلكي على جهازك · طريقة '+(methods[cfg.method]||cfg.method)+' · العصر '+(cfg.madhab==='Hanafi'?'حنفي':'جمهور')+' · المنطقة '+cfg.zone+(today.result.events.some(function(e){return e.estimated;})?' · (*) تقدير لخطوط العرض العالية':'')+'. راجع مسجدك المحلي عند الاختلاف.';
      $('pp-body').hidden=false;$('pp-status').textContent='';
      tickNow();tick=setInterval(tickNow,1000);
    }catch(err){$('pp-body').hidden=true;$('pp-status').textContent='تعذّر حساب المواقيت: '+err.message;}
  }
  function nextEvent(){
    var now=Date.now();
    var list=current.today.result.events.filter(function(e){return PRAYERS.indexOf(e.key)>=0&&e.instant&&e.instant.getTime()>now;});
    if(list.length)return {ev:list[0],tomorrow:false};
    if(!current.tomorrow)current.tomorrow=compute(current.cfg,1);
    var f=current.tomorrow.result.events.find(function(e){return e.key==='fajr'&&e.instant;});
    return f?{ev:f,tomorrow:true}:null;
  }
  function pad(n){return String(n).padStart(2,'0');}
  function tickNow(){
    if(!current)return;
    if(dateInZone(current.cfg.zone,0)!==current.today.input.date){render();return;}
    var n=nextEvent();
    document.querySelectorAll('.prayer-slot').forEach(function(s){s.classList.toggle('is-next',!!n&&!n.tomorrow&&s.dataset.key===n.ev.key);});
    if(!n){$('pp-next').textContent='غير متاح';$('pp-countdown').textContent='--:--:--';return;}
    $('pp-next').textContent=prayerNames[n.ev.key]+(n.tomorrow?' (غدًا)':'')+' · '+hm(n.ev.instant,current.cfg.zone);
    var ms=Math.max(0,n.ev.instant.getTime()-Date.now());var s=Math.floor(ms/1000);
    $('pp-countdown').textContent=pad(Math.floor(s/3600))+':'+pad(Math.floor(s%3600/60))+':'+pad(s%60);
    $('pp-countdown').setAttribute('aria-label','متبقٍّ '+Math.floor(s/3600)+' ساعة و'+Math.floor(s%3600/60)+' دقيقة');
  }
  fillSelect();
  $('pp-select').addEventListener('change',function(e){if(e.target.value)useCity(e.target.value);});
  $('pp-geo').addEventListener('click',function(){
    if(!navigator.geolocation){$('pp-status').textContent='تحديد الموقع غير متاح في هذا المتصفح؛ اختر مدينتك من القائمة.';return;}
    $('pp-status').textContent='بانتظار إذنك من المتصفح…';
    navigator.geolocation.getCurrentPosition(function(pos){
      var prev=loadHome()||{};
      saveHome({lat:Math.round(pos.coords.latitude*1e4)/1e4,lon:Math.round(pos.coords.longitude*1e4)/1e4,zone:Intl.DateTimeFormat().resolvedOptions().timeZone,method:prev.method||'MWL',madhab:prev.madhab||'Standard',high:prev.high||'NightMiddle',label:'موقعي الحالي',city:''});
      render();
    },function(err){$('pp-status').textContent=(typeof geolocateErrorMessage==='function'?geolocateErrorMessage(err):'تعذّر تحديد الموقع.')+' يمكنك اختيار مدينتك من القائمة.';},{timeout:20000,maximumAge:600000});
  });
  window.addEventListener('noor:prayer-home',render);
  render();

  /* ---------- Day index (local calendar day) ---------- */
  var now=new Date();
  var dayIndex=Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/864e5);

  /* ---------- Ayah of the day ---------- */
  // References only (surah, ayah). The text and tafsir are loaded verbatim from the Tanzil files of the site.
  var AYAT=[[2,152],[2,153],[2,186],[2,201],[2,216],[2,255],[2,286],[3,8],[3,26],[3,92],[3,139],[3,173],[3,190],[3,200],[4,110],[7,23],[7,56],[8,2],[9,51],[10,57],[11,88],[12,87],[13,28],[14,7],[16,97],[16,128],[17,24],[17,82],[18,10],[20,114],[21,87],[23,118],[25,74],[28,24],[29,69],[33,41],[33,56],[39,53],[40,44],[40,60],[47,7],[49,13],[50,16],[51,56],[55,13],[64,11],[65,3],[67,2],[93,5],[94,5]];
  var pick=AYAT[((dayIndex%AYAT.length)+AYAT.length)%AYAT.length];
  var ayah=null;
  fetch('/data/quran/'+String(pick[0]).padStart(3,'0')+'.json',{credentials:'omit'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){
    var v=d.verses[pick[1]-1];if(!v)throw new Error('missing');
    ayah={s:pick[0],a:pick[1],name:d.name,text:v.text,tafsir:v.tafsir||''};
    $('da-text').textContent=v.text;
    $('da-ref').textContent='سورة '+d.name+' · الآية '+pick[1];
    $('da-tafsir').textContent=ayah.tafsir;$('da-tafsir-wrap').hidden=!ayah.tafsir;
    $('da-open').href='#quran-reader/'+pick[0]+'/'+pick[1];
  }).catch(function(){$('da-text').textContent='تعذّر تحميل آية اليوم.';});
  function ayahPlain(){return ayah?'﴿'+ayah.text+'﴾ [سورة '+ayah.name+': '+ayah.a+']':'';}
  $('da-copy').addEventListener('click',function(){if(ayah)copyText(ayahPlain(),'نُسخت الآية');});
  $('da-share').addEventListener('click',function(){if(ayah)share('آية اليوم',ayahPlain(),SITE+'/#quran-reader/'+ayah.s+'/'+ayah.a);});
  var daAudio=$('da-audio');
  $('da-listen').addEventListener('click',function(){
    if(!ayah)return;
    if(!daAudio.paused){daAudio.pause();$('da-listen').textContent='▶ استمع';return;}
    if(!daAudio.src){daAudio.src='https://everyayah.com/data/Alafasy_128kbps/'+String(ayah.s).padStart(3,'0')+String(ayah.a).padStart(3,'0')+'.mp3';$('da-status').textContent='تلاوة مشاري العفاسي عبر EveryAyah — يتصل متصفحك بخادم المصدر عند التشغيل فقط.';}
    daAudio.play().then(function(){$('da-listen').textContent='❚❚ إيقاف';}).catch(function(){$('da-status').textContent='تعذّر تشغيل الصوت. تحقّق من الاتصال.';});
  });
  daAudio.addEventListener('ended',function(){$('da-listen').textContent='▶ استمع';});

  /* ---------- Hadith of the day ---------- */
  var month=now.getMonth()+1,dom=now.getDate();var hadith=null;
  fetch('/data/hadith/daily/'+String(month).padStart(2,'0')+'.json?v=20261125a',{credentials:'omit'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){
    var h=d.items[(dom-1)%d.items.length];hadith=h;
    $('dh-text').textContent=h.hadeeth;
    $('dh-ref').textContent=h.attribution;
    $('dh-grade').textContent='الدرجة: '+h.grade+' · المرجع: '+String(h.reference||'').split('\n')[0];
    $('dh-open').href='/hadith?id='+encodeURIComponent(h.id);
    $('dh-source').href=h.url;
  }).catch(function(){$('dh-text').textContent='تعذّر تحميل حديث اليوم.';});
  $('dh-sharh-wrap').addEventListener('toggle',function(){
    var box=$('dh-sharh');if(!this.open||!hadith||box.dataset.loaded)return;box.textContent='جارٍ تحميل الشرح…';
    fetch('/data/hadith/sharh/'+hadith.s+'.json?v=20261114m',{credentials:'omit'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(c){var x=c[hadith.id]||{};box.textContent=x.explanation||'لا يوجد شرح في المصدر لهذا الحديث.';box.dataset.loaded='1';}).catch(function(){box.textContent='تعذّر تحميل الشرح.';});
  });
  function hadithPlain(){return hadith?hadith.hadeeth+'\n['+hadith.attribution+' — '+hadith.grade+'] المصدر: HadeethEnc.com':'';}
  $('dh-copy').addEventListener('click',function(){if(hadith)copyText(hadithPlain(),'نُسخ الحديث');});
  $('dh-share').addEventListener('click',function(){if(hadith)share('حديث اليوم',hadithPlain(),SITE+'/hadith?id='+hadith.id);});

  /* ---------- Continue reading ---------- */
  function showContinue(){
    try{var v=JSON.parse(localStorage.getItem('noor-last-read-v1')||'null');
      if(v&&Number.isInteger(v.surah)&&Number.isInteger(v.verse)&&typeof v.name==='string'){$('continue-label').textContent='سورة '+v.name+' — الآية '+v.verse;$('continue-link').href='#quran-reader/'+v.surah+'/'+v.verse;$('continue-card').hidden=false;}
    }catch(e){}
  }
  showContinue();window.addEventListener('hashchange',showContinue);

  /* ---------- Adhkar by time of day ---------- */
  (function(){
    var h=now.getHours();var cat,title,text;
    if(h>=4&&h<12){cat='الصباح';title='حان وقت أذكار الصباح';text='من بعد الفجر إلى ارتفاع الضحى. ابدأ يومك بذكر الله.';}
    else if(h>=15&&h<21){cat='المساء';title='حان وقت أذكار المساء';text='من بعد العصر إلى الليل. اختم نهارك بذكر الله.';}
    else if(h>=21||h<4){cat='النوم';title='أذكار النوم';text='أذكار تقولها قبل أن تنام.';}
    else{cat='بعد الصلاة';title='الأذكار بعد الصلاة';text='الاستغفار والتسبيح والتحميد والتكبير بعد السلام.';}
    $('an-eyebrow').textContent='الأذكار اليومية';$('an-title').textContent=title;$('an-text').textContent=text;$('an-link').href='#adhkar-reader/'+cat;
  })();

  /* ---------- Tasbeeh counter ---------- */
  (function(){
    var KEY='noor-tasbeeh-v1';var st={phrase:'سُبْحَانَ اللَّهِ',goal:33,count:0};
    try{var v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&typeof v.phrase==='string'&&Number.isInteger(v.count)&&Number.isInteger(v.goal))st=v;}catch(e){}
    function save(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
    function draw(){$('tasbeeh-count').textContent=String(st.count);$('tasbeeh-tap').textContent=st.phrase||'سبّح';$('tasbeeh-goal').textContent=st.goal?('الهدف: '+st.goal+(st.count>=st.goal?' — اكتمل ✓':' — المتبقي '+(st.goal-st.count))):'عدّ حر بلا هدف';
      document.querySelectorAll('[data-tasbeeh]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.tasbeeh===st.phrase&&Number(b.dataset.goal)===st.goal));});}
    document.querySelectorAll('[data-tasbeeh]').forEach(function(b){b.addEventListener('click',function(){st={phrase:b.dataset.tasbeeh,goal:Number(b.dataset.goal)||0,count:0};save();draw();});});
    $('tasbeeh-tap').addEventListener('click',function(){st.count++;if(st.goal&&st.count===st.goal&&navigator.vibrate)try{navigator.vibrate([60,40,60]);}catch(e){}save();draw();});
    $('tasbeeh-reset').addEventListener('click',function(){st.count=0;save();draw();});
    draw();
  })();
})();
