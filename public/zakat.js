/* نور الإسلام — حاسبة الزكاة. منطق الحساب منفصل (calculateZakat) ليُختبر آليًا في scripts/test-zakat.mjs. */
(function(root){
  'use strict';
  var NISAB_GOLD_G=85,NISAB_SILVER_G=595,RATE=0.025;
  function num(v){var n=Number(v);return Number.isFinite(n)&&n>0?n:0;}
  function calculateZakat(i){
    var goldPrice=num(i.goldPrice),silverPrice=num(i.silverPrice);
    if(!goldPrice&&i.nisab!=='silver')throw new Error('أدخل سعر غرام الذهب عيار 24.');
    if(!silverPrice&&i.nisab==='silver')throw new Error('أدخل سعر غرام الفضة لاعتماد نصاب الفضة.');
    var karat=[24,22,21,18].indexOf(Number(i.karat))>=0?Number(i.karat):24;
    var goldG=num(i.goldGrams),jewG=Math.min(num(i.jewelryGrams),goldG);
    var zakatableGoldG=i.jewelry==='include'?goldG:goldG-jewG;
    var pureGold=zakatableGoldG*karat/24;
    var lines=[
      {k:'النقود والحسابات الجارية',v:num(i.cash)},
      {k:'المدخرات والودائع',v:num(i.savings)},
      {k:'عروض التجارة',v:num(i.trade)},
      {k:'ديون مرجوّة السداد',v:num(i.receivable)},
      {k:'الذهب ('+zakatableGoldG.toFixed(2)+' غ عيار '+karat+' = '+pureGold.toFixed(2)+' غ خالص)',v:pureGold*goldPrice},
      {k:'الفضة ('+num(i.silverGrams).toFixed(2)+' غ)',v:num(i.silverGrams)*silverPrice}
    ];
    var gross=lines.reduce(function(s,l){return s+l.v;},0);
    var debts=i.deduct==='no'?0:Math.min(num(i.debts),gross);
    var net=gross-debts;
    var nisabValue=i.nisab==='silver'?NISAB_SILVER_G*silverPrice:NISAB_GOLD_G*goldPrice;
    var reached=net>=nisabValue&&net>0;
    var due=reached&&!!i.hawl;
    return {lines:lines,gross:gross,debts:debts,net:net,nisabValue:nisabValue,reached:reached,hawl:!!i.hawl,zakat:due?net*RATE:0,due:due,excludedJewelryG:i.jewelry==='include'?0:jewG};
  }
  var api={calculateZakat:calculateZakat,NISAB_GOLD_G:NISAB_GOLD_G,NISAB_SILVER_G:NISAB_SILVER_G,RATE:RATE};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  root.NoorZakat=api;

  var $=function(id){return document.getElementById(id);};
  if(!$('zakat-form'))return;
  var KEY='noor-zakat-prices-v1';
  try{var p=JSON.parse(localStorage.getItem(KEY)||'null');if(p){$('z-currency').value=p.currency||'';$('z-gold-price').value=p.gold||'';$('z-silver-price').value=p.silver||'';if(p.nisab)$('z-nisab').value=p.nisab;}}catch(e){}
  function money(v,cur){return v.toLocaleString('ar',{maximumFractionDigits:2,minimumFractionDigits:2,numberingSystem:'latn'})+(cur?' '+cur:'');}
  $('zakat-form').addEventListener('submit',function(e){
    e.preventDefault();$('z-error').textContent='';
    var cur=$('z-currency').value.trim();
    var input={goldPrice:$('z-gold-price').value,silverPrice:$('z-silver-price').value,nisab:$('z-nisab').value,cash:$('z-cash').value,savings:$('z-savings').value,trade:$('z-trade').value,receivable:$('z-receivable').value,goldGrams:$('z-gold-g').value,karat:$('z-gold-k').value,silverGrams:$('z-silver-g').value,jewelry:$('z-jewelry').value,jewelryGrams:$('z-jewelry-g').value,debts:$('z-debts').value,deduct:$('z-deduct').value,hawl:$('z-hawl').checked};
    var r;try{r=calculateZakat(input);}catch(err){$('z-error').textContent=err.message;return;}
    try{localStorage.setItem(KEY,JSON.stringify({currency:cur,gold:input.goldPrice,silver:input.silverPrice,nisab:input.nisab}));}catch(e){}
    $('z-result').textContent=r.due?money(r.zakat,cur):(r.reached?'لم يحل الحول بعد':'لا زكاة واجبة');
    $('z-verdict').textContent=r.due?'مقدار الزكاة الواجبة: ربع العشر (2.5%) من صافي المال الزكوي.':r.reached?'بلغ مالك النصاب، لكن الزكاة تجب عند تمام الحول الهجري على بلوغه النصاب.':'صافي مالك الزكوي أقل من النصاب ('+money(r.nisabValue,cur)+').';
    var tb=$('z-table').querySelector('tbody');tb.replaceChildren();
    function row(k,v,strong){var tr=document.createElement('tr');var a=document.createElement(strong?'th':'td');a.textContent=k;var b=document.createElement(strong?'th':'td');b.textContent=v;tr.append(a,b);tb.appendChild(tr);}
    r.lines.forEach(function(l){if(l.v>0)row(l.k,money(l.v,cur));});
    if(r.excludedJewelryG>0)row('حُلي للزينة غير محسوب ('+r.excludedJewelryG.toFixed(2)+' غ)','—');
    row('الإجمالي',money(r.gross,cur),true);
    row(input.deduct==='no'?'الديون الحالّة (غير مخصومة)':'يُخصم: الديون الحالّة',money(r.debts,cur));
    row('صافي المال الزكوي',money(r.net,cur),true);
    row('النصاب ('+(input.nisab==='silver'?'595 غ فضة':'85 غ ذهب')+')',money(r.nisabValue,cur));
    row('الزكاة (2.5%)',money(r.zakat,cur),true);
  });
  $('zakat-form').addEventListener('reset',function(){setTimeout(function(){$('z-result').textContent='—';$('z-verdict').textContent='';$('z-table').querySelector('tbody').replaceChildren();},0);});
})(typeof window!=='undefined'?window:globalThis);
