/**
 * Inline analytics beacon for published Atlas sites.
 * Values must be passed pre-validated; strings are JSON-encoded for JS safety.
 */
export function renderAnalyticsScript(input: {
  apiBaseUrl: string;
  projectId: string;
}): string {
  const base = input.apiBaseUrl.trim().replace(/\/+$/, "");
  const projectId = input.projectId.trim();
  if (!base || !projectId) return "";

  const endpoint = JSON.stringify(`${base}/api/analytics/collect`);
  const projectIdJs = JSON.stringify(projectId);

  return `<script data-atlas-analytics>
(function(){
  try {
    var endpoint=${endpoint};
    var projectId=${projectIdJs};
    var STORAGE_V="atlas_vid";
    var STORAGE_S="atlas_sid";
    function log(){}
    function rid(){
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return "v_"+Math.random().toString(36).slice(2)+Date.now().toString(36);
    }
    function getVisitor(){
      try {
        var v=localStorage.getItem(STORAGE_V);
        if(!v){ v=rid(); localStorage.setItem(STORAGE_V,v); }
        return v;
      } catch(e){ return rid(); }
    }
    function getSession(){
      try {
        var s=sessionStorage.getItem(STORAGE_S);
        if(!s){ s=rid().replace(/-/g,""); sessionStorage.setItem(STORAGE_S,s); }
        return s;
      } catch(e){ return rid().replace(/-/g,""); }
    }
    function params(){
      var out={utmSource:"",utmMedium:"",utmCampaign:""};
      try {
        var q=new URLSearchParams(location.search);
        out.utmSource=q.get("utm_source")||"";
        out.utmMedium=q.get("utm_medium")||"";
        out.utmCampaign=q.get("utm_campaign")||"";
      } catch(e){}
      return out;
    }
    var started=Date.now();
    var visitorId=getVisitor();
    var sessionId=getSession();
    var utm=params();
    function payload(event, extra){
      var body={
        event:event,
        projectId:projectId,
        sessionId:sessionId,
        visitorId:visitorId,
        pagePath:location.pathname||"/",
        referrer:document.referrer||"",
        utmSource:utm.utmSource,
        utmMedium:utm.utmMedium,
        utmCampaign:utm.utmCampaign,
        language:(navigator.language||"").slice(0,40),
        screenSize:(screen&&screen.width&&screen.height)?(screen.width+"x"+screen.height):"",
        userAgent:navigator.userAgent||"",
        durationSeconds:Math.max(0, Math.floor((Date.now()-started)/1000))
      };
      if(extra){ for(var k in extra){ if(k!=="keepalive") body[k]=extra[k]; } }
      return body;
    }
    function send(event, opts){
      opts=opts||{};
      var body=JSON.stringify(payload(event, opts));
      log("beacon_sent", { event: event, pagePath: location.pathname||"/" });
      try {
        if(opts.keepalive && navigator.sendBeacon){
          var ok=navigator.sendBeacon(endpoint, new Blob([body],{type:"application/json"}));
          log("beacon_result", { event: event, via: "sendBeacon", ok: !!ok });
          return;
        }
      } catch(e){}
      fetch(endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:body,
        mode:"cors",
        keepalive:!!opts.keepalive,
        credentials:"omit"
      }).then(function(res){
        log("beacon_result", { event: event, via: "fetch", status: res.status });
      }).catch(function(err){
        log("beacon_result", { event: event, via: "fetch", error: "network" });
      });
    }
    send("pageview");
    var heart=setInterval(function(){ send("heartbeat"); }, 15000);
    function onLeave(){
      try { clearInterval(heart); } catch(e){}
      send("unload",{keepalive:true});
    }
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
  } catch(e){
    try { console.info("[atlas.analytics] script_error"); } catch(err){}
  }
})();
</script>`;
}
