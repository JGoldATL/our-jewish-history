/* Shared gate for the private pages (Strategy, Roadmap). A pseudo login: it asks for a password and keeps the page hidden until the Worker accepts it.
   The password is NOT in this file or anywhere in the repo: the Worker compares what is typed with a secret (ROADMAP_CODE) that Jeffrey sets in Cloudflare,
   and answers with a short-lived signed token. The roadmap rows and the Strategy link come from the Worker only when that token is sent.
   HONEST NOTE: this is a courtesy lock. It keeps casual visitors out and keeps the data and link out of the page source. It is not real security:
   anyone who is given the password can pass it on.
   Page contract: <div id="gateMount" data-page="roadmap|strategy"></div>, the private content inside <div id="gated" hidden>, and window.onGateOpen() to load it. */
(function(){
  var WORKER='https://patient-sound-f420journeysquiz-log.jeffreyagold-bbd.workers.dev',KEY='ojj-gate-token',AKEY='ojj-admin-token';
  var ERR='Incorrect Password. Try again.',mem={};
  function get(k){try{var v=sessionStorage.getItem(k);if(v)return v;}catch(e){}return mem[k]||'';}
  function set(k,v){mem[k]=v;try{if(v)sessionStorage.setItem(k,v);else sessionStorage.removeItem(k);}catch(e){}}
  function el(i){return document.getElementById(i);}
  function open(){var g=el('gated'),m=el('gateMount');if(m)m.hidden=true;if(g)g.hidden=false;if(typeof window.onGateOpen==='function')window.onGateOpen();}
  function lock(msg){var g=el('gated'),m=el('gateMount');set(KEY,'');set(AKEY,'');if(g)g.hidden=true;if(m){m.hidden=false;build(msg||'');}}
  // api(path, {method, body}) -> Promise of {status, data}. A 401 with no_token means the token expired: show the login again.
  function api(path,o){o=o||{};var h={'X-Gate-Token':get(KEY)};if(get(AKEY))h['X-Admin-Token']=get(AKEY);if(o.body)h['Content-Type']='application/json';
    return fetch(WORKER+path,{method:o.method||'GET',headers:h,body:o.body?JSON.stringify(o.body):undefined}).then(function(r){return r.json().catch(function(){return {};}).then(function(d){
      if(r.status===401&&d.error==='no_token'){lock('Your session ended. Please enter the password again.');}
      return {status:r.status,data:d};});});}
  window.OJJ_GATE={api:api,worker:WORKER,getAdmin:function(){return get(AKEY);},setAdmin:function(t){set(AKEY,t);},lock:lock};
  function build(msg){
    var m=el('gateMount');if(!m)return;
    if(!el('gateStyle')){var st=document.createElement('style');st.id='gateStyle';st.textContent=
      '.gate{max-width:380px;margin:8vh auto 0;padding:26px 22px;border:1px solid rgba(239,230,211,.18);border-radius:14px;background:#162634;text-align:center}'+
      '.gate h2{font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:1.3rem;margin:0 0 6px;color:#E8B27A}'+
      '.gate p{margin:0 0 16px;color:#A9B4B8;font-size:.92rem}'+
      '.gate input{box-sizing:border-box;width:100%;height:48px;border-radius:10px;border:1px solid rgba(239,230,211,.28);background:#0E1822;color:#EFE6D3;font-size:16px;padding:0 14px;text-align:center}'+
      '.gate input:focus-visible,.gate button:focus-visible{outline:2px solid #f2a65a;outline-offset:2px}'+
      '.gate button{margin-top:12px;width:100%;height:48px;border-radius:999px;border:1px solid #E8B27A;background:#E8B27A;color:#0E1822;font-size:15px;font-weight:600;cursor:pointer}'+
      '.gate button[disabled]{opacity:.6;cursor:default}.gate .err{min-height:1.3em;margin:10px 0 0;color:#F08A7B;font-size:.9rem}';document.head.appendChild(st);}
    m.innerHTML='<form class="gate" id="gateForm" autocomplete="off"><h2>Private page</h2><p>Enter the password to continue.</p>'+
      '<label for="gatePw" style="position:absolute;left:-9999px">Password</label>'+
      '<input id="gatePw" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Password" aria-describedby="gateErr">'+
      '<button type="submit" id="gateGo">Enter</button><p class="err" id="gateErr" role="alert"></p></form>';
    var f=el('gateForm'),i=el('gatePw'),e=el('gateErr'),b=el('gateGo');e.textContent=msg||'';
    f.addEventListener('submit',function(ev){ev.preventDefault();if(b.disabled)return;
      var code=i.value;if(!code.trim()){e.textContent=ERR;i.focus();return;}
      b.disabled=true;e.textContent='';
      fetch(WORKER+'/gate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:m.getAttribute('data-page')||'roadmap',code:code})})
        .then(function(r){return r.json().catch(function(){return {};}).then(function(d){
          if(r.status===200&&d.token){set(KEY,d.token);open();}
          else if(r.status===401){e.textContent=ERR;i.value='';i.focus();}
          else if(r.status===429){e.textContent='Too many tries. Please wait a few minutes and try again.';}
          else{e.textContent='Could not check the password right now. Please try again.';}
          b.disabled=false;});})
        .catch(function(){e.textContent='Could not reach the server. Check your connection and try again.';b.disabled=false;});});
    i.addEventListener('input',function(){e.textContent='';});
    try{i.focus({preventScroll:true});}catch(x){}
  }
  function init(){if(get(KEY))open();else build('');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
