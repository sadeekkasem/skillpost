/* نور الإسلام — صفحة الصلاة على النبي ﷺ. نصوص الأحاديث تُعرض بـ textContent كما وردت من المصدر دون أي تعديل. */
(function(){
  'use strict';
  var H=window.NoorHadith;
  var C=window.NoorSalawat;
  var DATA_V='20261115a';
  var DATA_URL='/data/hadith/salawat.json?v='+DATA_V;
  var el=function(id){return document.getElementById(id);};
  var state=null;
  var storageOk=true;

  function make(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function row(label,value,cls){var d=make('div','hadith-field'+(cls?' '+cls:''));d.appendChild(make('dt',null,label));d.appendChild(make('dd',null,value));return d;}
  function credit(h){var c=make('p','hadith-credit');var link=make('a','text-link',H.CREDIT);link.href=h.url;link.target='_blank';link.rel='noopener noreferrer';c.appendChild(link);return c;}
  function arabic(n){return Number(n).toLocaleString('ar-EG');}

  function persist(){
    storageOk=C.save(state);
    var note=el('salawat-storage-note');
    if(!storageOk)note.textContent='تعذّر الحفظ في هذا المتصفح؛ العداد يعمل دون تخزين.';
  }

  function renderCounts(){
    el('salawat-today').textContent=arabic(state.today);
    el('salawat-total').textContent=arabic(state.total);
    var bar=el('salawat-progress-bar');
    var fill=el('salawat-progress-fill');
    var pct=Math.round(C.progress(state)*100);
    fill.style.width=pct+'%';
    bar.setAttribute('aria-valuemin','0');
    bar.setAttribute('aria-valuemax',String(state.goal));
    bar.setAttribute('aria-valuenow',String(state.today));
    var reached=state.today>=state.goal;
    el('salawat-progress-label').textContent=reached
      ?('بلغت الهدف اليومي: '+arabic(state.today)+' من '+arabic(state.goal))
      :('اليوم: '+arabic(state.today)+' من '+arabic(state.goal));
    syncGoalUI();
  }

  function syncGoalUI(){
    var preset=C.isPreset(state.goal);
    document.querySelectorAll('[data-goal]').forEach(function(b){
      var v=b.dataset.goal;
      var on=(v==='custom'&&!preset)||(v!=='custom'&&Number(v)===state.goal);
      b.setAttribute('aria-checked',String(on));
    });
    var custom=el('salawat-goal-custom');
    custom.hidden=preset;
    if(!preset)custom.value=String(state.goal);
  }

  function onTap(){
    C.increment(state);
    persist();
    renderCounts();
  }
  function onReset(){
    if(!window.confirm('هل تريد تصفير العداد؟ سيُحذف العدد المحفوظ على هذا الجهاز.'))return;
    C.reset(state);
    persist();
    renderCounts();
  }
  function applyGoal(n){
    C.setGoal(state,n);
    persist();
    renderCounts();
  }

  function card(h,withCopy){
    var a=make('article','card hadith-card');a.id='h-'+h.id;
    var top=make('div','hadith-top');top.appendChild(make('span','hadith-book hadith-book-'+h.book,H.BOOKS[h.book]));
    a.appendChild(top);
    a.appendChild(make('h3','hadith-title',h.title));
    var t=make('p','hadith-text',h.hadeeth);t.lang='ar';a.appendChild(t);
    var dl=make('dl','hadith-meta');
    dl.appendChild(row('الدرجة',h.grade));
    dl.appendChild(row('التخريج',h.attribution));
    if(h.reference)dl.appendChild(row('المرجع',h.reference,'hadith-ref'));
    a.appendChild(dl);
    if(withCopy){
      var actions=make('div','salawat-copy-row');
      var btn=make('button','button salawat-copy', 'نسخ النص');btn.type='button';
      var status=make('span','mini-label salawat-copy-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      btn.addEventListener('click',function(){copyText(h.hadeeth,status,btn);});
      actions.appendChild(btn);actions.appendChild(status);a.appendChild(actions);
    }
    a.appendChild(credit(h));
    return a;
  }

  function copyText(text,status,btn){
    function ok(){status.textContent='تم النسخ';btn.textContent='تم النسخ';setTimeout(function(){status.textContent='';btn.textContent='نسخ النص';},1800);}
    function fail(){status.textContent='تعذّر النسخ؛ حدّد النص وانسخه يدويًا.';}
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(ok).catch(fail);
      return;
    }
    try{
      var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.insetInlineStart='-9999px';
      document.body.appendChild(ta);ta.select();
      var done=document.execCommand('copy');document.body.removeChild(ta);
      if(done)ok();else fail();
    }catch(e){fail();}
  }

  function renderHadiths(data){
    var wordings=el('salawat-wordings-list');wordings.textContent='';
    (data.wordings||[]).forEach(function(h){wordings.appendChild(card(h,true));});
    var virtue=el('salawat-virtue-list');virtue.textContent='';
    (data.virtue||[]).forEach(function(h){virtue.appendChild(card(h,true));});
    var m=(data.meta)||{};
    if(m.version)el('salawat-version').textContent='الإصدار: '+m.version+'، تاريخ الجلب: '+String(m.fetchedAt||'').slice(0,10)+'.';
  }

  function bind(){
    el('salawat-tap').addEventListener('click',onTap);
    el('salawat-reset').addEventListener('click',onReset);
    document.querySelectorAll('[data-goal]').forEach(function(b){
      b.addEventListener('click',function(){
        if(b.dataset.goal==='custom'){
          var custom=el('salawat-goal-custom');
          custom.hidden=false;
          custom.focus();
          if(custom.value)applyGoal(custom.value);
          else {b.setAttribute('aria-checked','true');document.querySelectorAll('[data-goal]').forEach(function(x){if(x!==b)x.setAttribute('aria-checked','false');});}
          return;
        }
        applyGoal(Number(b.dataset.goal));
      });
    });
    el('salawat-goal-custom').addEventListener('change',function(e){applyGoal(e.target.value);});
  }

  var loaded=C.load();
  state=loaded.state;
  storageOk=loaded.ok;
  if(C.isFriday())el('salawat-friday').hidden=false;
  bind();
  persist();
  renderCounts();

  fetch(DATA_URL,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(data){
    renderHadiths(data);
  }).catch(function(){
    el('salawat-wordings-list').textContent='';
    el('salawat-wordings-list').appendChild(make('p','disclaimer','تعذّر تحميل الصيغ والأحاديث. أعد تحميل الصفحة.'));
    el('salawat-virtue-list').textContent='';
  });
})();
