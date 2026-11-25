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
  var setLocation=function(lat,lon,label,persist){
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
  /* Map (Leaflet + OpenStreetMap), loaded on demand */
  var cur=null,map=null,layer=null;
  var _set=setLocation;setLocation=function(lat,lon,label,persist){cur={lat:lat,lon:lon,label:label};_set(lat,lon,label,persist);if(map)drawMap();};
  function greatCircle(a,b,n){var p1=a[0]*r,l1=a[1]*r,p2=b[0]*r,l2=b[1]*r;var d=2*Math.asin(Math.sqrt(Math.pow(Math.sin((p2-p1)/2),2)+Math.cos(p1)*Math.cos(p2)*Math.pow(Math.sin((l2-l1)/2),2)));if(d<1e-9)return [a,b];var pts=[];for(var i=0;i<=n;i++){var f=i/n;var A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d);var x=A*Math.cos(p1)*Math.cos(l1)+B*Math.cos(p2)*Math.cos(l2),y=A*Math.cos(p1)*Math.sin(l1)+B*Math.cos(p2)*Math.sin(l2),z=A*Math.sin(p1)+B*Math.sin(p2);pts.push([Math.atan2(z,Math.sqrt(x*x+y*y))/r,Math.atan2(y,x)/r]);}
    for(var k=1;k<pts.length;k++){while(pts[k][1]-pts[k-1][1]>180)pts[k][1]-=360;while(pts[k][1]-pts[k-1][1]<-180)pts[k][1]+=360;}return pts;}
  window.NoorQibla.greatCircle=greatCircle;
  function drawMap(){
    if(!map)return;if(layer)layer.remove();layer=L.layerGroup().addTo(map);
    var kaaba=L.circleMarker(KAABA,{radius:8,color:'#123F38',fillColor:'#D2B477',fillOpacity:1,weight:2}).bindTooltip('الكعبة المشرفة',{permanent:true,direction:'top'});kaaba.addTo(layer);
    if(!cur){map.setView(KAABA,5);return;}
    var me=L.circleMarker([cur.lat,cur.lon],{radius:7,color:'#ffffff',fillColor:'#1C6254',fillOpacity:1,weight:2}).bindTooltip(cur.label,{permanent:true,direction:'top'});me.addTo(layer);
    var line=L.polyline(greatCircle([cur.lat,cur.lon],KAABA,96),{color:'#b8975a',weight:4,dashArray:'8 6'}).addTo(layer);
    map.fitBounds(line.getBounds(),{padding:[40,40]});
  }
  function loadLeaflet(){return new Promise(function(res,rej){if(window.L)return res();var css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/leaflet/leaflet.css';document.head.appendChild(css);var sc=document.createElement('script');sc.src='/vendor/leaflet/leaflet.js';sc.onload=res;sc.onerror=rej;document.body.appendChild(sc);});}
  $('map-show').addEventListener('click',function(){
    var box=$('qibla-map');box.hidden=false;$('map-show').disabled=true;
    loadLeaflet().then(function(){
      map=L.map(box,{worldCopyJump:true,attributionControl:true});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
      drawMap();$('map-show').hidden=true;
    }).catch(function(){box.hidden=true;$('map-show').disabled=false;$('qibla-loc').textContent='تعذّر تحميل الخريطة. تحقّق من الاتصال.';});
  });

  try{var saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&Number.isFinite(saved.lat)&&Number.isFinite(saved.lon))setLocation(saved.lat,saved.lon,String(saved.label||'موقع محفوظ'),false);
    else{var home=JSON.parse(localStorage.getItem('noor-prayer-home-v1')||'null');if(home&&Number.isFinite(home.lat))setLocation(home.lat,home.lon,String(home.label||'مدينتك'),false);}}catch(e){}
  draw();
})();
