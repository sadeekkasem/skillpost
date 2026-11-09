window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};

(function(){
  try {
    var payload = JSON.stringify({path: location.pathname || "/"});
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/pv", new Blob([payload], {type: "application/json"}));
    } else {
      fetch("/pv", {method:"POST", headers:{"Content-Type":"application/json"}, body: payload, keepalive: true}).catch(function(){});
    }
  } catch (e) {}
})();
