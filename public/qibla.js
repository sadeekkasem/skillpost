/* نور الإسلام — بوصلة القبلة. حساب الدائرة العظمى على الجهاز، وقراءة حساس الاتجاه بعد إذن المستخدم. */
(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};
  var KAABA=[21.4225,39.8262];
  var KEY='noor-qibla-loc-v1';
  var bearing=null,heading=null,listening=false;
  var r=Math.PI/180;
  function qiblaBearing(lat,lon){var p1=lat*r,p2=KAABA[0]*r,dl=(KAABA[1]-lon)*r;var y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);if(Math.abs(lat)>89.9999||Math.hypot(x,y)<1e-10)return null;return (Math.atan2(y,x)/r+360)%360;}
  function distanceKm(lat,lon){var p1=lat*r,p2=KAABA[0]*r,dp=p2-p1,dl=(KAABA[1]-lon)*r;var a=Math.sin(dp/2)*Math.sin(dp/2)+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2);return 6371.0088*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
  window.NoorQibla={bearing:qiblaBearing,distanceKm:distanceKm};
  if(!$('compass'))return;

  function dir8(b){return ['الشمال','الشمال الشرقي','الشرق','الجنوب الشرقي','الجنوب','الجنوب الغربي','الغرب','الشمال الغربي'][Math.round(b/45)%8];}
  function setLocation(lat,lon,label,persist){
    bearing=qiblaBearing(lat,lon);
    $('qibla-loc').textContent=label+' ('+lat.toFixed(3)+'، '+lon.toFixed(3)+')';
    $('qibla-bearing').textContent=bearing===null?'غير محددة عند هذا الموضع':bearing.toFixed(1)+'° من الشمال الجغرافي (نحو '+dir8(bearing)+')';
    $('qibla-distance').textContent=Math.round(distanceKm(lat,lon)).toLocaleString('ar-EG')+' كم تقريبًا';
    if(persist){try{localStorage.setItem(KEY,JSON.stringify({lat:lat,lon:lon,label:label}));}catch(e){}}
    draw();
  }
  function draw(){
    var h=heading===null?0:heading;
    $('compass-rose').style.transform='rotate('+(-h)+'deg)';
    if(bearing===null){$('qibla-needle').style.opacity='0';$('qibla-readout').textContent='اختر موقعك أولًا';return;}
    $('qibla-needle').style.opacity='1';
    var rel=((bearing-h)%360+360)%360;
    $('qibla-needle').style.transform='translateY(-100%) rotate('+rel+'deg)';
    var off=rel>180?rel-360:rel;
    var aligned=heading!==null&&Math.abs(off)<5;
    $('compass').classList.toggle('is-aligned',aligned);
    if(heading===null)$('qibla-readout').textContent='القبلة: '+bearing.toFixed(0)+'° من الشمال';
    else $('qibla-readout').textContent=aligned?'أنت باتجاه القبلة ✓':(off>0?'استدر يمينًا '+Math.round(off)+'°':'استدر يسارًا '+Math.round(-off)+'°');
  }
  function screenAngle(){return (screen.orientation&&typeof screen.orientation.angle==='number')?screen.orientation.angle:(typeof window.orientation==='number'?window.orientation:0);}
  function onOrient(e){
    var h=null;
    if(typeof e.webkitCompassHeading==='number')h=e.webkitCompassHeading;
    else if(e.absolute&&typeof e.alpha==='number')h=360-e.alpha;
    if(h===null)return;
    heading=((h+screenAngle())%360+360)%360;
    $('compass-status').textContent='البوصلة تعمل. الدقة تتأثر بالمعادن القريبة؛ عايِر الهاتف بحركة الرقم 8 عند الحاجة.';
    draw();
  }
  function startCompass(){
    if(listening)return;
    if(typeof DeviceOrientationEvent==='undefined'){$('compass-status').textContent='هذا الجهاز لا يدعم حساس الاتجاه. استخدم الزاوية المكتوبة مع بوصلة.';return;}
    var go=function(){listening=true;if('ondeviceorientationabsolute' in window)window.addEventListener('deviceorientationabsolute',onOrient);else window.addEventListener('deviceorientation',onOrient);$('compass-status').textContent='حرّك الهاتف قليلًا… إن لم تتحرك البوصلة فالجهاز لا يوفّر اتجاهًا مطلقًا.';$('compass-start').hidden=true;};
    if(typeof DeviceOrientationEvent.requestPermission==='function'){DeviceOrientationEvent.requestPermission().then(function(s){if(s==='granted')go();else $('compass-status').textContent='لم يُمنح إذن حساس الحركة. يمكنك استخدام الزاوية المكتوبة.';}).catch(function(){$('compass-status').textContent='تعذّر طلب إذن الحساس.';});}
    else go();
  }
  $('compass-start').addEventListener('click',startCompass);

  var sel=$('qibla-city');
  if(typeof prayerCities!=='undefined'){var groups={};Object.keys(prayerCities).forEach(function(id){var c=prayerCities[id];(groups[c.group]=groups[c.group]||[]).push([id,c]);});Object.keys(groups).forEach(function(g){var og=document.createElement('optgroup');og.label=g;groups[g].forEach(function(p){var o=document.createElement('option');o.value=p[0];o.textContent=p[1].label;og.appendChild(o);});sel.appendChild(og);});}
  sel.addEventListener('change',function(){var c=prayerCities[sel.value];if(c)setLocation(c.lat,c.lon,c.label,true);});
  $('qibla-geo').addEventListener('click',function(){
    if(!navigator.geolocation){$('qibla-loc').textContent='تحديد الموقع غير متاح؛ اختر مدينة.';return;}
    $('qibla-loc').textContent='بانتظار إذنك من المتصفح…';
    navigator.geolocation.getCurrentPosition(function(p){setLocation(p.coords.latitude,p.coords.longitude,'موقعك الحالي',false);startCompass();},function(){$('qibla-loc').textContent='تعذّر تحديد الموقع. اختر مدينة من القائمة.';},{enableHighAccuracy:true,timeout:20000,maximumAge:300000});
  });
  try{var saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&Number.isFinite(saved.lat)&&Number.isFinite(saved.lon))setLocation(saved.lat,saved.lon,String(saved.label||'موقع محفوظ'),false);
    else{var home=JSON.parse(localStorage.getItem('noor-prayer-home-v1')||'null');if(home&&Number.isFinite(home.lat))setLocation(home.lat,home.lon,String(home.label||'مدينتك'),false);}}catch(e){}
  draw();
})();
