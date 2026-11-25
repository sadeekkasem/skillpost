/* نور الإسلام — «اسأل نور»: مساعد بحث في محتوى الموقع فقط.
   لا يولّد نصوصًا ولا يفتي: يعرض الآيات والأذكار والأحاديث كما وردت في ملفات المصدر، مع روابط مواضعها،
   ويرشد إلى أدوات الموقع. كل البحث يجري في المتصفح؛ لا يُرسل السؤال إلى أي خادم. */
(function(root){
  'use strict';
  /* ---------- Pure logic (tested in scripts/test-chat.mjs) ---------- */
  var STOP=('ما ماذا متى اين أين هل عن في من على الى إلى كيف لماذا اريد أريد اعطني أعطني ابحث أبحث عندي لي هو هي ان أن او أو ثم مع كل اي أي هذا هذه ذلك التي الذي يا لو سمحت من فضلك '+
    'اية آية ايه ايات آيات الاية الآية حديث احاديث أحاديث الحديث دعاء ادعية أدعية الدعاء ذكر اذكار أذكار الذكر سورة عن').split(' ');
  function norm(s,dagger){s=String(s||'').normalize('NFKD');if(dagger)s=s.replace(/ٰ/g,'ا');
    return s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]/g,'').replace(/[ٱأإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[^ء-ي0-9a-z\s]/gi,' ').replace(/\s+/g,' ').trim().toLowerCase();}
  function stem(w){var x=w;var pre=['وبال','فال','بال','كال','وال','لل','ال'];for(var i=0;i<pre.length;i++){if(x.indexOf(pre[i])===0&&x.length-pre[i].length>=3){x=x.slice(pre[i].length);break;}}
    if(x.length>4&&(/(ون|ين|ات|ها|هم|كم|نا)$/).test(x))x=x.slice(0,-2);return x;}
  var STOPN=STOP.map(function(w){return norm(w);});
  function terms(q){return norm(q).split(' ').filter(function(w){return w.length>1&&STOPN.indexOf(w)<0;}).map(stem).filter(function(w){return w.length>1;});}
  function intent(q){var n=norm(q);return {quran:/(^| )(ايه|ايات|الايه|سوره|القران|قران)( |$)/.test(n),hadith:/(^| )(حديث|احاديث|الحديث|النبي|رسول)( |$)/.test(n),dhikr:/(^| )(دعاء|ادعيه|الدعاء|ذكر|اذكار|الذكر|اقول|يقال|قول)( |$)/.test(n)};}
  var PFX=['',' ال',' و',' وال',' بال',' فال',' لل',' ب',' ف',' ل'];
  function score(text,ts){var hit=0,word=0,t=' '+text;for(var i=0;i<ts.length;i++){if(text.indexOf(ts[i])>=0){hit++;for(var k=0;k<PFX.length;k++){if(t.indexOf((PFX[k]||' ')+ts[i])>=0){word++;break;}}}}return hit*10+word*3;}
  function rank(items,ts,getText,limit){
    if(!ts.length)return [];var best=[];
    for(var i=0;i<items.length;i++){var sc=score(getText(items[i]),ts);if(sc>0)best.push([sc,i]);}
    if(!best.length)return [];var max=Math.max.apply(null,best.map(function(b){return b[0];}));
    var maxHits=Math.floor(max/10);var needHits=ts.length>=3?Math.max(2,maxHits):maxHits;
    return best.filter(function(b){return Math.floor(b[0]/10)>=needHits;}).sort(function(a,b){return b[0]-a[0]||getText(items[a[1]]).length-getText(items[b[1]]).length||a[1]-b[1];}).slice(0,limit).map(function(b){return {item:items[b[1]],score:b[0]};});
  }
  var FAQ=[
    {k:['مواقيت','الصلاه','الصلوات','الفجر','الظهر','العصر','المغرب','العشاء','الاذان','اذان','موعد'],t:'مواقيت الصلاة',a:'اختر مدينتك في لوحة المواقيت في الصفحة الرئيسية لترى أوقات اليوم والصلاة القادمة مع عدّاد تنازلي. ولتغيير طريقة الحساب أو المذهب افتح صفحة المواقيت.',l:[['/#home','لوحة المواقيت'],['/#prayer-tools','إعدادات الحساب']]},
    {k:['قبله','القبله','الكعبه','اتجاه'],t:'اتجاه القبلة',a:'صفحة القبلة تحسب الزاوية من موقعك، وتعمل كبوصلة على الهاتف بعد السماح بحساس الاتجاه.',l:[['/qibla','افتح القبلة']]},
    {k:['زكاه','الزكاه','نصاب','النصاب'],t:'حاسبة الزكاة',a:'حاسبة الزكاة تحسب ربع العشر للنقود والذهب والفضة وعروض التجارة، وتعرض الخلاف في النصاب والحلي والديون. وهي أداة مساعدة بانتظار مراجعة شرعية، وليست فتوى.',l:[['/zakat','افتح الحاسبة']]},
    {k:['هجري','الهجري','تقويم','التقويم','رمضان','عيد','العيد','عرفه','عاشوراء','البيض','التشريق','محرم','شوال','الحجه'],t:'التقويم الهجري',a:'التقويم الهجري يعرض الشهور والمناسبات الثابتة مثل رمضان والعيدين وعرفة وعاشوراء والأيام البيض، ويمكن إضافتها إلى تقويمك. بداية الشهور فعليًا تكون بالرؤية أو إعلان الجهة المختصة.',l:[['/calendar','افتح التقويم']]},
    {k:['تسبيح','التسبيح','سبحه','السبحه','عداد','سبح'],t:'عدّاد التسبيح',a:'سبحة إلكترونية بضغطة واحدة، مع صيغ التسبيح بعد الصلاة.',l:[['/#adhkar-reader/tasbeeh','افتح عدّاد التسبيح']]},
    {k:['حفظ','احفظ','الحفظ','حافظ','مراجعه'],t:'رفيق الحفظ',a:'رفيق الحفظ يضع لك خطة يومية لحفظ القرآن ويتابع تقدّمك.',l:[['/hifz','افتح رفيق الحفظ']]},
    {k:['الصلاه علي النبي','صلاه علي النبي','الصلاه علي الرسول','صلي الله عليه'],t:'الصلاة على النبي ﷺ',a:'صفحة الصلاة على النبي ﷺ فيها صيغ ثابتة الإسناد وعدّاد يومي بهدف تختاره.',l:[['/salawat','افتح الصفحة']]},
    {k:['تفسير','التفسير','معني','معنى','شرح'],t:'التفسير والشرح',a:'لكل آية تفسير الجلالين: اختر رقم الآية في قارئ القرآن. ولكل حديث في صفحة الحديث شرح وفوائد ومعاني الكلمات.',l:[['/#quran-reader','قارئ القرآن'],['/hadith','صفحة الحديث']]},
    {k:['تلاوه','التلاوه','قارئ','القراء','استماع','استمع','صوت','العفاسي','الحصري','المنشاوي','السديس','الشريم','المعيقلي','عبدالباسط'],t:'التلاوة',a:'في قارئ القرآن تلاوة كاملة لسبعة قرّاء، مع تلوين الآية أثناء التلاوة، وسرعة التشغيل والتكرار، والاستماع لآية واحدة.',l:[['/#quran-reader','قارئ القرآن']]},
    {k:['مشايخ','المشايخ','دروس','دروس','محاضرات','شيخ'],t:'دروس المشايخ',a:'صفحات المشايخ ودروسهم تُنشر بعد موافقتهم.',l:[['/sheikhs','صفحة المشايخ']]},
    {k:['تطبيق','تثبيت','ثبت','الهاتف','الجوال','انترنت','اتصال'],t:'التثبيت والعمل دون إنترنت',a:'يمكن تثبيت الموقع كتطبيق: في Android اختر «إضافة إلى الشاشة الرئيسية» من قائمة المتصفح، وفي iPhone من زر المشاركة. بعد أول زيارة تعمل الأذكار والسور التي فتحتها دون إنترنت.',l:[]},
    {k:['ليلي','الليلي','داكن','الخط','حجم','الوضع'],t:'إعدادات العرض',a:'زر ☾ أعلى الصفحة يبدّل الوضع الليلي، وزر ⚙ يغيّر حجم الخط. تُحفظ في متصفحك فقط.',l:[]},
    {k:['خصوصيه','الخصوصيه','بيانات','كوكيز','حساب'],t:'الخصوصية',a:'الموقع غير تجاري، بلا إعلانات ولا حاجة لحساب، واختياراتك تُحفظ في متصفحك فقط.',l:[['/privacy','سياسة الخصوصية'],['/sources','المصادر والترخيص']]},
    {k:['مصادر','المصادر','مصدر','ترخيص'],t:'المصادر',a:'نص القرآن من مشروع تنزيل، والتفسير للجلالين، والأذكار من حصن المسلم عبر OpenDua، والأحاديث من موسوعة الأحاديث النبوية المترجمة.',l:[['/sources','المصادر والترخيص']]},
    {k:['ميراث','الميراث','مواريث','المواريث','تركه','الورثه'],t:'المواريث',a:'حاسبة المواريث غير متاحة بعد، فهي تحت المراجعة الشرعية. اسأل أهل العلم أو المحكمة المختصة في بلدك.',l:[]}
  ];
  var FATWA=/(^| )(حكم|يجوز|حلال|حرام|فتوي|افتني|مكروه|واجب|بدعه)( |$)/;
  function faq(q){var n=' '+norm(q)+' ';var out=[];FAQ.forEach(function(f){if(f.k.some(function(k){return n.indexOf(' '+norm(k))>=0;}))out.push(f);});return out.slice(0,2);}
  function isFatwa(q){return FATWA.test(norm(q));}
  var api={norm:norm,stem:stem,terms:terms,intent:intent,rank:rank,faq:faq,isFatwa:isFatwa,FAQ:FAQ};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  root.NoorChatCore=api;

  /* ---------- UI ---------- */
  var V='20261125b';var data={};var loading={};
  var FILES={quran:'quran-text',hadith:'hadith-index',adhkar:'adhkar'};
  function loadAll(){return Promise.all([load2('adhkar'),load2('hadith'),load2('quran')]);}
  function load2(k){return data[k]?Promise.resolve(data[k]):(loading[k]||(loading[k]=fetch('/data/chat/'+FILES[k]+'.json?v='+V,{credentials:'omit'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(d){delete loading[k];data[k]=null;return d;}).then(function(d){
      if(k==='quran'){var list=[];d.surahs.forEach(function(s){s[2].forEach(function(t,i){list.push({s:s[0],name:s[1],a:i+1,text:t,n:norm(t)+' | '+norm(t,true)});});});data[k]=list;}
      else if(k==='hadith'){data[k]=d.hadiths.map(function(h){return {id:h[0],title:h[1],book:h[2],grade:h[3],cats:h[4],n:norm(h[1]+' '+h[4])};});}
      else {data[k]=d.adhkar.map(function(x){return {cat:x[0],label:x[1],text:x[2],count:x[3],ref:x[4],n:norm(x[0]+' '+x[1]+' '+x[2])};});}
      return data[k];})));}

  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  var panel,log,input,opened=false;
  var BOOKS={agreed:'متفق عليه',both:'البخاري ومسلم',bukhari:'صحيح البخاري',muslim:'صحيح مسلم'};
  function build(){
    panel=el('div','chat-panel');panel.id='chat-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','اسأل نور');panel.hidden=true;
    var head=el('div','chat-head');var h=el('div');h.appendChild(el('strong',null,'اسأل نور'));h.appendChild(el('small',null,'بحث في محتوى الموقع — لا يُرسل سؤالك لأي خادم'));
    var close=el('button','icon-btn','✕');close.type='button';close.setAttribute('aria-label','إغلاق');close.addEventListener('click',toggle);
    head.append(h,close);
    log=el('div','chat-log');log.setAttribute('aria-live','polite');
    var form=el('form','chat-form');input=el('input');input.type='search';input.placeholder='اكتب سؤالك… مثل: دعاء الخروج من المنزل';input.setAttribute('aria-label','سؤالك');input.maxLength=140;
    var send=el('button','button small','اسأل');send.type='submit';form.append(input,send);
    form.addEventListener('submit',function(e){e.preventDefault();var q=input.value.trim();if(q.length<2)return;input.value='';ask(q);});
    panel.append(head,log,form);document.body.appendChild(panel);
    var hello=el('div','chat-msg bot');hello.appendChild(el('p',null,'السلام عليكم. أبحث لك في آيات القرآن والأذكار والأحاديث وأدوات هذا الموقع، وأعرض النصوص كما وردت في مصادرها مع روابطها. لست مفتيًا؛ للأحكام الشرعية اسأل أهل العلم.'));
    var chips=el('div','chat-chips');['دعاء الخروج من المنزل','آية عن الصبر','حديث عن بر الوالدين','أذكار بعد الصلاة','كيف أحسب الزكاة','اتجاه القبلة'].forEach(function(s){var c=el('button','chip',s);c.type='button';c.addEventListener('click',function(){ask(s);});chips.appendChild(c);});
    hello.appendChild(chips);log.appendChild(hello);
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&opened)toggle();});
  }
  function toggle(){if(!panel)build();opened=!opened;panel.hidden=!opened;var b=document.getElementById('chat-fab');if(b)b.setAttribute('aria-expanded',String(opened));if(opened){input.focus();loadAll().catch(function(){});}}
  function linkRow(container,href,text){var a=el('a','text-link',text);a.href=href;container.appendChild(a);return a;}
  function section(msg,title){var s=el('div','chat-sec');s.appendChild(el('h4',null,title));msg.appendChild(s);return s;}
  function ask(q){
    var me=el('div','chat-msg me');me.appendChild(el('p',null,q));log.appendChild(me);
    var bot=el('div','chat-msg bot');var wait=el('p','mini-label','أبحث…');bot.appendChild(wait);log.appendChild(bot);log.scrollTop=log.scrollHeight;
    loadAll().then(function(){
      wait.remove();
      var ts=terms(q),it=intent(q),f=faq(q),any=false;
      if(isFatwa(q)){var w=el('p','chat-warn','أنا مساعد بحث ولا أفتي. هذه نصوص ذات صلة من الموقع؛ وللحكم الشرعي اسأل أهل العلم أو جهة الإفتاء في بلدك.');bot.appendChild(w);}
      f.forEach(function(x){any=true;var s=section(bot,x.t);s.appendChild(el('p',null,x.a));x.l.forEach(function(l){linkRow(s,l[0],l[1]+' ←');});});
      var only=it.quran||it.hadith||it.dhikr;
      var dh=(!only||it.dhikr)?rank(data.adhkar,ts,function(x){return x.n;},3):[];
      var qr=(!only||it.quran)?rank(data.quran,ts,function(x){return x.n;},it.quran?4:3):[];
      var hd=(!only||it.hadith)?rank(data.hadith,ts,function(x){return x.n;},it.hadith?4:3):[];
      if(dh.length){any=true;var s1=section(bot,'من الأذكار (حصن المسلم)');dh.forEach(function(r){var x=r.item;var c=el('div','chat-card');c.appendChild(el('p','chat-arabic',x.text));var m=el('p','mini-label',x.label+' · حصن المسلم '+x.ref+(x.count?' · يُقال '+x.count+' مرات':''));c.appendChild(m);linkRow(c,'/#adhkar-reader/'+encodeURIComponent(x.cat),'افتح قسم '+x.cat+' ←');s1.appendChild(c);});}
      if(qr.length){any=true;var s2=section(bot,'من القرآن الكريم');qr.forEach(function(r){var x=r.item;var c=el('div','chat-card');c.appendChild(el('p','chat-arabic','﴿'+x.text+'﴾'));linkRow(c,'/#quran-reader/'+x.s+'/'+x.a,'سورة '+x.name+' · الآية '+x.a+' — التفسير ←');s2.appendChild(c);});}
      if(hd.length){any=true;var s3=section(bot,'من الأحاديث (الصحيحان)');hd.forEach(function(r){var x=r.item;var c=el('div','chat-card');c.appendChild(el('p','chat-arabic',x.title));c.appendChild(el('p','mini-label',(BOOKS[x.book]||'')+' · '+x.grade));linkRow(c,'/hadith?id='+encodeURIComponent(x.id),'النص الكامل والشرح ←');s3.appendChild(c);});}
      if(!any){bot.appendChild(el('p',null,'لم أجد نتيجة في محتوى الموقع. جرّب كلمات أقصر أو أخرى، مثل: «الصبر» أو «دعاء السفر» أو «مواقيت الصلاة».'));}
      else bot.appendChild(el('p','mini-label','النصوص معروضة كما وردت في مصادرها. التطابق بالكلمات وليس فهمًا للمعنى، فراجع السياق عند فتح الرابط.'));
      log.scrollTop=me.offsetTop-8;
    }).catch(function(){wait.textContent='تعذّر تحميل بيانات البحث. تحقّق من الاتصال ثم أعد المحاولة.';});
  }
  root.NoorChat={toggle:toggle,ask:function(q){if(!opened)toggle();ask(q);}};
})(typeof window!=='undefined'?window:globalThis);
