/* نور الإسلام — التقويم الهجري. التحويل عبر Intl في المتصفح (islamic-umalqura أو islamic-civil). */
(function(root){
  'use strict';
  var MONTHS=['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
  // Fixed Hijri-date occasions only (month 1-12, day). Contested-date occasions are deliberately not listed.
  var EVENTS=[
    {m:1,d:1,t:'رأس السنة الهجرية'},
    {m:1,d:10,t:'يوم عاشوراء'},
    {m:9,d:1,t:'بداية شهر رمضان (تقديرًا)'},
    {m:9,d:21,t:'بداية العشر الأواخر من رمضان'},
    {m:10,d:1,t:'عيد الفطر (تقديرًا)'},
    {m:12,d:1,t:'بداية عشر ذي الحجة'},
    {m:12,d:8,t:'يوم التروية'},
    {m:12,d:9,t:'يوم عرفة'},
    {m:12,d:10,t:'عيد الأضحى'},
    {m:12,d:11,t:'أول أيام التشريق'},
    {m:12,d:13,t:'آخر أيام التشريق'}
  ];
  function fmt(system){return new Intl.DateTimeFormat('en-u-ca-'+system+'-nu-latn',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});}
  function hijriParts(date,system){var p=fmt(system).formatToParts(date);var g=function(t){var x=p.find(function(q){return q.type===t;});return x?parseInt(x.value,10):NaN;};return {y:g('year')||g('relatedYear'),m:g('month'),d:g('day')};}
  function supported(system){try{return new Intl.DateTimeFormat('en-u-ca-'+system,{}).resolvedOptions().calendar===system;}catch(e){return false;}}
  function utcDay(y,m,d){return new Date(Date.UTC(y,m,d,12));}
  function addDays(date,n){return new Date(date.getTime()+n*864e5);}
  function monthOf(anchor,system){
    var h=hijriParts(anchor,system);var start=addDays(anchor,-(h.d-1));
    while(hijriParts(start,system).d!==1)start=addDays(start,hijriParts(start,system).d>15?1:-1);
    var days=[];var cur=start;var hm=hijriParts(start,system).m;
    while(hijriParts(cur,system).m===hm&&days.length<31){days.push(cur);cur=addDays(cur,1);}
    return {y:hijriParts(start,system).y,m:hm,days:days};
  }
  function eventsFor(m,d){return EVENTS.filter(function(e){return e.m===m&&e.d===d;}).map(function(e){return e.t;}).concat(d>=13&&d<=15&&!(m===12&&d===13)?['من الأيام البيض']:[]);}
  function upcoming(from,system,count){
    var out=[];var cur=from;
    for(var i=0;i<400&&out.length<count;i++){var h=hijriParts(cur,system);EVENTS.forEach(function(e){if(e.m===h.m&&e.d===h.d)out.push({date:cur,h:h,t:e.t});});cur=addDays(cur,1);}
    return out;
  }
  function ics(ev){
    var d=ev.date.toISOString().slice(0,10).replace(/-/g,'');var n=addDays(ev.date,1).toISOString().slice(0,10).replace(/-/g,'');
    var stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//noorislamsite.com//hijri//AR','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+d+'-'+ev.h.m+'-'+ev.h.d+'@noorislamsite.com','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+d,'DTEND;VALUE=DATE:'+n,'SUMMARY:'+ev.t+' — '+ev.h.d+' '+MONTHS[ev.h.m-1]+' '+ev.h.y+'هـ','DESCRIPTION:تاريخ تقديري؛ يُرجع إلى إعلان الجهة المختصة. نور الإسلام — noorislamsite.com','END:VEVENT','END:VCALENDAR'].join('\r\n');
  }
  var api={MONTHS:MONTHS,EVENTS:EVENTS,hijriParts:hijriParts,monthOf:monthOf,upcoming:upcoming,ics:ics,supported:supported};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  root.NoorCalendar=api;

  var $=function(id){return document.getElementById(id);};
  if(!$('cal-grid'))return;
  var sysSel=$('cal-system');
  if(!supported('islamic-umalqura'))sysSel.querySelector('option[value=islamic-umalqura]').disabled=true,sysSel.value='islamic-civil';
  try{var s=localStorage.getItem('noor-cal-system-v1');if(s&&supported(s))sysSel.value=s;}catch(e){}
  var now=new Date();var today=utcDay(now.getFullYear(),now.getMonth(),now.getDate());
  var anchor=today;
  var gFmt=new Intl.DateTimeFormat('ar',{timeZone:'UTC',day:'numeric',month:'short',numberingSystem:'latn'});
  var gLong=new Intl.DateTimeFormat('ar',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric',numberingSystem:'latn'});
  function render(){
    var system=sysSel.value;var mo=monthOf(anchor,system);
    $('cal-title').textContent=MONTHS[mo.m-1]+' '+mo.y+' هـ';
    var grid=$('cal-grid');grid.replaceChildren();
    ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'].forEach(function(n){var d=document.createElement('div');d.className='cal-dow';d.textContent=n;grid.appendChild(d);});
    for(var i=0;i<mo.days[0].getUTCDay();i++){var pad=document.createElement('div');pad.className='cal-day cal-pad';pad.setAttribute('aria-hidden','true');grid.appendChild(pad);}
    mo.days.forEach(function(day,idx){
      var cell=document.createElement('div');cell.className='cal-day';cell.setAttribute('role','gridcell');
      var hd=idx+1;var evs=eventsFor(mo.m,hd);
      if(day.getTime()===today.getTime()){cell.classList.add('is-today');cell.setAttribute('aria-current','date');}
      if(evs.length)cell.classList.add('has-event');
      var b=document.createElement('strong');b.textContent=String(hd);
      var g=document.createElement('span');g.textContent=gFmt.format(day);
      cell.append(b,g);
      evs.forEach(function(t){var e=document.createElement('span');e.className='ev';e.textContent=t;cell.appendChild(e);});
      cell.setAttribute('aria-label',hd+' '+MONTHS[mo.m-1]+' — '+gLong.format(day)+(evs.length?' — '+evs.join('، '):''));
      grid.appendChild(cell);
    });
    renderEvents(system);
  }
  function renderEvents(system){
    var list=$('cal-events');list.replaceChildren();
    upcoming(today,system,8).forEach(function(ev){
      var li=document.createElement('li');var info=document.createElement('div');
      var t=document.createElement('strong');t.textContent=ev.t;
      var d=document.createElement('p');d.className='mini-label';d.style.margin='0';d.textContent=ev.h.d+' '+MONTHS[ev.h.m-1]+' '+ev.h.y+'هـ — '+gLong.format(ev.date);
      info.append(t,d);
      var btn=document.createElement('button');btn.type='button';btn.className='button secondary small';btn.textContent='أضف إلى تقويمي';
      btn.addEventListener('click',function(){var blob=new Blob([ics(ev)],{type:'text/calendar;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='noor-'+ev.date.toISOString().slice(0,10)+'.ics';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);});
      li.append(info,btn);list.appendChild(li);
    });
  }
  $('cal-prev').addEventListener('click',function(){var mo=monthOf(anchor,sysSel.value);anchor=addDays(mo.days[0],-1);render();});
  $('cal-next').addEventListener('click',function(){var mo=monthOf(anchor,sysSel.value);anchor=addDays(mo.days[mo.days.length-1],1);render();});
  $('cal-today').addEventListener('click',function(){anchor=today;render();});
  sysSel.addEventListener('change',function(){try{localStorage.setItem('noor-cal-system-v1',sysSel.value);}catch(e){}render();});
  render();
})(typeof window!=='undefined'?window:globalThis);
