/* Soft gate for the private pages (Strategy, Roadmap). A pseudo login: it asks for a password and keeps the page hidden until it is right.
   This is a courtesy gate, not security: the password is in this file. Do not put anything secret behind it.
   Page contract: a <div id="gateMount"></div>, the private content inside <div id="gated" hidden>, and optional window.onGateOpen() to load content. */
(function(){
  var PASSWORD='1897',KEY='ojj-gate',ERR='Incorrect Password. Try again.';
  function remembered(){try{return sessionStorage.getItem(KEY)==='1';}catch(e){return false;}}
  function remember(){try{sessionStorage.setItem(KEY,'1');}catch(e){}}
  function open(){var g=document.getElementById('gated'),m=document.getElementById('gateMount');if(m)m.hidden=true;if(g)g.hidden=false;if(typeof window.onGateOpen==='function')window.onGateOpen();}
  function build(){
    var m=document.getElementById('gateMount');if(!m)return;
    var css='.gate{max-width:380px;margin:8vh auto 0;padding:26px 22px;border:1px solid rgba(239,230,211,.18);border-radius:14px;background:#162634;text-align:center}'+
      '.gate h2{font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:1.3rem;margin:0 0 6px;color:#E8B27A}'+
      '.gate p{margin:0 0 16px;color:#A9B4B8;font-size:.92rem}'+
      '.gate input{box-sizing:border-box;width:100%;height:48px;border-radius:10px;border:1px solid rgba(239,230,211,.28);background:#0E1822;color:#EFE6D3;font-size:16px;padding:0 14px;text-align:center}'+
      '.gate input:focus-visible,.gate button:focus-visible{outline:2px solid #f2a65a;outline-offset:2px}'+
      '.gate button{margin-top:12px;width:100%;height:48px;border-radius:999px;border:1px solid #E8B27A;background:#E8B27A;color:#0E1822;font-size:15px;font-weight:600;cursor:pointer}'+
      '.gate .err{min-height:1.3em;margin:10px 0 0;color:#F08A7B;font-size:.9rem}';
    var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
    m.innerHTML='<form class="gate" id="gateForm" autocomplete="off"><h2>Private page</h2><p>Enter the password to continue.</p>'+
      '<label for="gatePw" class="sr" style="position:absolute;left:-9999px">Password</label>'+
      '<input id="gatePw" type="password" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Password" aria-describedby="gateErr">'+
      '<button type="submit">Enter</button><p class="err" id="gateErr" role="alert"></p></form>';
    var f=document.getElementById('gateForm'),i=document.getElementById('gatePw'),e=document.getElementById('gateErr');
    f.addEventListener('submit',function(ev){ev.preventDefault();
      if(i.value.trim()===PASSWORD){remember();open();}
      else{e.textContent=ERR;i.value='';i.focus();}});
    i.addEventListener('input',function(){e.textContent='';});
    try{i.focus({preventScroll:true});}catch(x){}
  }
  function init(){if(remembered())open();else build();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
