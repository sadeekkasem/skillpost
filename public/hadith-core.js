/* نور الإسلام — منطق صفحة الحديث (بلا DOM) يُستعمل في المتصفح وفي الاختبار */
(function(root){
  'use strict';
  var BOOKS={agreed:'متفق عليه',both:'البخاري ومسلم',bukhari:'صحيح البخاري',muslim:'صحيح مسلم'};
  function inBook(h,book){return book==='all'||h.book===book||(h.book==='both'&&(book==='bukhari'||book==='muslim'));}
  var CREDIT='المصدر: موسوعة الأحاديث النبوية المترجمة – HadeethEnc.com';
  function norm(s){return String(s||'').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/[^\u0621-\u064A0-9a-z\s]/gi,' ').replace(/\s+/g,' ').trim().toLowerCase();}
  function prepare(data){
    var cats={};(data.categories||[]).forEach(function(c){cats[c.id]=c;});
    (data.hadiths||[]).forEach(function(h){h._s=norm(h.title+' '+h.hadeeth+' '+h.attribution+' '+h.reference);});
    return {meta:data.meta,categories:data.categories||[],byId:cats,hadiths:data.hadiths||[]};
  }
  function descendants(db,id){var out={};out[id]=1;var changed=true;while(changed){changed=false;db.categories.forEach(function(c){if(c.parent&&out[c.parent]&&!out[c.id]){out[c.id]=1;changed=true;}});}return out;}
  function filter(db,opts){
    opts=opts||{};var book=opts.book||'all';var q=norm(opts.q||'');var words=q?q.split(' '):[];
    var catSet=opts.category&&opts.category!=='all'?descendants(db,String(opts.category)):null;
    return db.hadiths.filter(function(h){
      if(!inBook(h,book))return false;
      if(catSet&&!h.categories.some(function(c){return catSet[c];}))return false;
      for(var i=0;i<words.length;i++){if(h._s.indexOf(words[i])===-1)return false;}
      return true;
    });
  }
  function counts(list){var c={all:list.length,agreed:0,both:0,bukhari:0,muslim:0};list.forEach(function(h){c[h.book]++;});c.bukhariAll=c.bukhari+c.both;c.muslimAll=c.muslim+c.both;return c;}
  var api={inBook:inBook,BOOKS:BOOKS,CREDIT:CREDIT,norm:norm,prepare:prepare,filter:filter,counts:counts,descendants:descendants};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NoorHadith=api;
})(typeof window!=='undefined'?window:globalThis);
