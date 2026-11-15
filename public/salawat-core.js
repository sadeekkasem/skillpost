/* نور الإسلام — منطق عدّاد الصلاة على النبي (بلا DOM) يُستعمل في المتصفح وفي الاختبار */
(function(root){
  'use strict';
  var KEY='noor-salawat-counter';
  var DEFAULT_GOAL=100;
  var PRESETS=[100,500,1000];
  var MAX_GOAL=100000;

  function pad(n){return n<10?'0'+n:String(n);}
  function localDate(d){
    d=d||new Date();
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  }
  function isFriday(d){return (d||new Date()).getDay()===5;}
  function isPreset(n){return PRESETS.indexOf(n)!==-1;}
  function cleanCount(n){n=Math.floor(Number(n));return isFinite(n)&&n>=0?n:0;}
  function cleanGoal(n){n=Math.floor(Number(n));if(!isFinite(n)||n<1)return DEFAULT_GOAL;return Math.min(n,MAX_GOAL);}

  function empty(now){return {total:0,today:0,date:localDate(now),goal:DEFAULT_GOAL};}
  function normalize(raw,now){
    var state=empty(now);
    if(!raw||typeof raw!=='object')return state;
    state.total=cleanCount(raw.total);
    state.today=cleanCount(raw.today);
    state.goal=cleanGoal(raw.goal);
    var today=localDate(now);
    if(typeof raw.date==='string'&&raw.date===today){
      state.date=today;
    }else{
      state.today=0;
      state.date=today;
    }
    if(state.today>state.total)state.total=state.today;
    return state;
  }
  function load(now,storage){
    storage=storage||(typeof window!=='undefined'?window.localStorage:null);
    if(!storage)return {state:empty(now),ok:false};
    try{
      var raw=storage.getItem(KEY);
      var parsed=raw?JSON.parse(raw):null;
      return {state:normalize(parsed,now),ok:true};
    }catch(e){
      return {state:empty(now),ok:false};
    }
  }
  function save(state,storage){
    storage=storage||(typeof window!=='undefined'?window.localStorage:null);
    if(!storage)return false;
    try{
      storage.setItem(KEY,JSON.stringify({total:state.total,today:state.today,date:state.date,goal:state.goal}));
      return true;
    }catch(e){return false;}
  }
  function increment(state){state.today+=1;state.total+=1;return state;}
  function reset(state,now){state.today=0;state.total=0;state.date=localDate(now);return state;}
  function setGoal(state,goal){state.goal=cleanGoal(goal);return state;}
  function progress(state){
    if(!state.goal)return 0;
    var p=state.today/state.goal;
    if(p<0)return 0;
    if(p>1)return 1;
    return p;
  }

  var api={KEY:KEY,DEFAULT_GOAL:DEFAULT_GOAL,PRESETS:PRESETS,MAX_GOAL:MAX_GOAL,localDate:localDate,isFriday:isFriday,isPreset:isPreset,normalize:normalize,load:load,save:save,increment:increment,reset:reset,setGoal:setGoal,progress:progress,empty:empty,cleanGoal:cleanGoal};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NoorSalawat=api;
})(typeof window!=='undefined'?window:globalThis);
