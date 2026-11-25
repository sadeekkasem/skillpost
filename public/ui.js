/* نور الإسلام — واجهة مشتركة: الوضع الليلي، حجم الخط، شريط التنقل السفلي، وتسجيل Service Worker.
   كل الإعدادات في localStorage لهذا المتصفح فقط؛ لا شيء يُرسل إلى خادم. */
(function(){
  'use strict';
  var KEY='noor-ui-v1';
  var root=document.documentElement;
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){return {};}}
  function save(s){try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){}}
  var state=load();
  var mq=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;

  function resolvedTheme(){return state.theme==='light'||state.theme==='dark'?state.theme:(mq&&mq.matches?'dark':'light');}
  function applyTheme(){
    var t=resolvedTheme();root.setAttribute('data-theme',t);
    var meta=document.querySelector('meta[name=theme-color]');if(meta)meta.setAttribute('content',t==='dark'?'#0b211d':'#123F38');
    document.querySelectorAll('[data-theme-choice]').forEach(function(b){b.setAttribute('aria-pressed',String((state.theme||'auto')===b.dataset.themeChoice));});
    var tb=document.getElementById('theme-toggle');if(tb){tb.textContent=t==='dark'?'☀':'☾';tb.setAttribute('aria-label',t==='dark'?'التبديل إلى الوضع النهاري':'التبديل إلى الوضع الليلي');}
  }
  function applyScale(){
    var k=Number(state.scale)||1;root.style.setProperty('--scale',String(k));
    document.querySelectorAll('[data-scale-choice]').forEach(function(b){b.setAttribute('aria-pressed',String(Number(b.dataset.scaleChoice)===k));});
  }
  if(mq&&mq.addEventListener)mq.addEventListener('change',function(){if(!state.theme||state.theme==='auto')applyTheme();});

  function el(tag,attrs,text){var n=document.createElement(tag);for(var k in attrs||{})n.setAttribute(k,attrs[k]);if(text!=null)n.textContent=text;return n;}

  var header=document.querySelector('header');
  var panel=null;
  function closePanel(){if(panel){panel.hidden=true;var b=document.getElementById('settings-toggle');if(b)b.setAttribute('aria-expanded','false');}}
  function togglePanel(){if(!panel)return;var open=panel.hidden;panel.hidden=!open;var b=document.getElementById('settings-toggle');if(b)b.setAttribute('aria-expanded',String(open));if(open){var f=panel.querySelector('button');if(f)f.focus();}}

  if(header&&!document.getElementById('theme-toggle')){
    var tools=el('div',{'class':'header-tools'});
    var theme=el('button',{'class':'icon-btn',id:'theme-toggle',type:'button'});
    theme.addEventListener('click',function(){state.theme=resolvedTheme()==='dark'?'light':'dark';save(state);applyTheme();});
    var gear=el('button',{'class':'icon-btn',id:'settings-toggle',type:'button','aria-label':'إعدادات العرض','aria-expanded':'false','aria-controls':'settings-panel'},'⚙');
    gear.addEventListener('click',togglePanel);
    tools.append(theme,gear);
    var toggle=document.getElementById('menu-toggle');
    if(toggle&&toggle.nextSibling)header.insertBefore(tools,toggle);else header.appendChild(tools);

    panel=el('div',{'class':'settings-panel',id:'settings-panel',role:'dialog','aria-label':'إعدادات العرض'});panel.hidden=true;
    panel.appendChild(el('h2',null,'إعدادات العرض'));
    var r1=el('div',{'class':'settings-row'});r1.appendChild(el('span',null,'الوضع'));
    var seg1=el('div',{'class':'seg',role:'group','aria-label':'الوضع'});
    [['auto','تلقائي'],['light','نهاري'],['dark','ليلي']].forEach(function(o){var b=el('button',{type:'button','data-theme-choice':o[0]},o[1]);b.addEventListener('click',function(){state.theme=o[0];save(state);applyTheme();});seg1.appendChild(b);});
    r1.appendChild(seg1);panel.appendChild(r1);
    var r2=el('div',{'class':'settings-row'});r2.appendChild(el('span',null,'حجم الخط'));
    var seg2=el('div',{'class':'seg',role:'group','aria-label':'حجم الخط'});
    [['0.9','أصغر'],['1','عادي'],['1.15','أكبر'],['1.3','كبير جدًا']].forEach(function(o){var b=el('button',{type:'button','data-scale-choice':o[0]},o[1]);b.addEventListener('click',function(){state.scale=Number(o[0]);save(state);applyScale();});seg2.appendChild(b);});
    r2.appendChild(seg2);panel.appendChild(r2);
    var note=el('p',{'class':'mini-label'},'تُحفظ هذه الإعدادات في متصفحك فقط.');panel.appendChild(note);
    header.appendChild(panel);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closePanel();});
    document.addEventListener('click',function(e){if(panel&&!panel.hidden&&!panel.contains(e.target)&&e.target.id!=='settings-toggle'&&!(e.target.closest&&e.target.closest('[data-open-settings]')))closePanel();});
  }

  /* Bottom navigation (mobile) */
  var ICONS={
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    quran:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5C17 4 14 4.5 12 6z"/><path d="M12 6v14.5"/></svg>',
    adhkar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="17.5" cy="9" r="2"/><circle cx="17.5" cy="15.5" r="2"/><circle cx="12" cy="19.5" r="2"/><circle cx="6.5" cy="15.5" r="2"/><circle cx="6.5" cy="9" r="2"/></svg>',
    prayer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };
  if(!document.querySelector('.bottom-nav')){
    var nav=el('nav',{'class':'bottom-nav','aria-label':'تنقل سريع'});
    [['home','/#home','الرئيسية'],['quran','/#quran-reader','القرآن'],['adhkar','/#adhkar-reader','الأذكار'],['prayer','/#prayer-tools','الصلاة']].forEach(function(o){var a=el('a',{href:o[1],'data-bottom':o[0]});a.innerHTML=ICONS[o[0]];a.appendChild(el('span',null,o[2]));nav.appendChild(a);});
    var sb=el('button',{type:'button','data-open-settings':'1','aria-label':'الإعدادات'});sb.innerHTML=ICONS.settings;sb.appendChild(el('span',null,'الإعدادات'));
    sb.addEventListener('click',function(){togglePanel();window.scrollTo({top:0,behavior:'smooth'});});
    nav.appendChild(sb);document.body.appendChild(nav);
  }
  function markBottom(){
    var path=location.pathname,hash=(location.hash||'#home').slice(1).split('/')[0];
    var cur=path==='/'||path==='/index.html'?({'quran-reader':'quran','adhkar-reader':'adhkar','prayer-tools':'prayer'})[hash]||'home':(path.indexOf('/qibla')===0||path.indexOf('/calendar')===0?'prayer':null);
    document.querySelectorAll('[data-bottom]').forEach(function(a){if(a.dataset.bottom===cur)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  }
  window.addEventListener('hashchange',markBottom);markBottom();

  /* «اسأل نور» — يُحمَّل chat.js عند أول ضغط فقط */
  var chatLoading=null;
  function openChat(q){
    if(window.NoorChat){if(q)window.NoorChat.ask(q);else window.NoorChat.toggle();return;}
    if(!chatLoading){chatLoading=new Promise(function(res,rej){var sc=document.createElement('script');sc.src='/chat.js?v=20261125b';sc.onload=res;sc.onerror=rej;document.body.appendChild(sc);});}
    chatLoading.then(function(){if(q)window.NoorChat.ask(q);else window.NoorChat.toggle();}).catch(function(){chatLoading=null;});
  }
  window.NoorOpenChat=openChat;
  if(!document.getElementById('chat-fab')&&!/^\/(login|admin|sheikh|student)(\/|$)/.test(location.pathname)){
    var fab=el('button',{'class':'chat-fab',id:'chat-fab',type:'button','aria-controls':'chat-panel','aria-expanded':'false','aria-label':'اسأل نور: ابحث في محتوى الموقع'});
    fab.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg><span>اسأل نور</span>';
    fab.addEventListener('click',function(){openChat();});
    document.body.appendChild(fab);
  }
  document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-open-chat]');if(t){e.preventDefault();openChat(t.getAttribute('data-open-chat')||'');}});

  applyTheme();applyScale();

  window.NoorUI={toast:function(text){var t=el('div',{'class':'toast',role:'status'},text);document.body.appendChild(t);setTimeout(function(){t.remove();},2600);}};

  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}
})();
