/* Site nav: a small collapsible menu at the bottom left. Loaded by index.html, quiz.html, strategy.html, roadmap.html and feedback.html.
   To add a page later (Feedback, Roadmap), add one line to PAGES. Nothing else changes. */
(function(){
  var PAGES=[
    {label:'Feedback',href:'feedback.html'},
    {label:'Roadmap',href:'roadmap.html'},
    {label:'Strategy',href:'strategy.html'}
  ];
  if(!PAGES.length)return;
  function stamp(){if(document.getElementById('version')||document.getElementById('siteVer'))return;var v=document.createElement('div');v.id='siteVer';v.textContent='v'+(window.SITE_VERSION||'');v.style.cssText='position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));font:11.5px system-ui,sans-serif;color:#A9B4B8;opacity:.8;pointer-events:none;z-index:20';document.body.appendChild(v);}
  var here=(location.pathname.split('/').pop()||'index.html');
  var css=
  '.sn{position:relative;display:inline-block;font:inherit;z-index:30}'+
  '.sn.fixed{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom))}'+
  '@media (min-width:901px){.foot>.sn .sn-btn{min-height:24px;font-size:11.5px}}'+
  '.foot>.sn{margin-right:12px}.foot>.sn+span{margin-right:auto}'+
  '.sn-btn{font:inherit;font-size:12px;line-height:1;color:#EFE6D3;background:rgba(14,24,34,.92);border:1px solid rgba(239,230,211,.28);border-radius:999px;min-height:32px;padding:0 14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}'+
  '.sn-btn:hover{background:rgba(239,230,211,.14)}'+
  '.sn-btn:focus-visible,.sn-menu a:focus-visible{outline:2px solid #f2a65a;outline-offset:2px}'+
  '.sn-btn svg{flex:none}'+
  '.sn-menu{position:absolute;left:0;bottom:calc(100% + 8px);min-width:150px;padding:6px;border-radius:14px;background:rgba(18,30,41,.97);border:1px solid rgba(239,230,211,.18);box-shadow:0 14px 36px rgba(0,0,0,.5);display:grid;gap:2px}'+
  '.sn-menu[hidden]{display:none}'+
  '.sn-menu a{display:flex;align-items:center;min-height:40px;padding:0 12px;border-radius:10px;color:#EFE6D3;font-size:14px;text-decoration:none}'+
  '.sn-menu a:hover{background:rgba(239,230,211,.1)}'+
  '.sn-menu a[aria-current="page"]{color:#f2a65a;font-weight:600}'+
  '.sn-bad{margin-left:8px;font-size:11.5px;line-height:1;padding:3px 7px;border-radius:999px;border:1px solid rgba(239,230,211,.3);color:#A9B4B8}'+
  '.sn-bad.new{background:#f2a65a;border-color:#f2a65a;color:#0E1822;font-weight:700}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  var box=document.createElement('div');box.className='sn';box.id='siteNav';
  var btn=document.createElement('button');btn.type='button';btn.className='sn-btn';btn.id='siteNavBtn';
  btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','siteNavMenu');
  btn.innerHTML='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 3h10M1 6h10M1 9h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>More';
  var menu=document.createElement('nav');menu.className='sn-menu';menu.id='siteNavMenu';menu.hidden=true;menu.setAttribute('aria-label','More pages');
  PAGES.forEach(function(p){var a=document.createElement('a');a.href=p.href;a.textContent=p.label;a.setAttribute('data-nav',p.label);if(p.href===here)a.setAttribute('aria-current','page');menu.appendChild(a);});
  /* F-081: admin only. With an admin token in this tab, show new/total next to Feedback and Roadmap. Visitors have no token, so nothing is fetched or shown. */
  function ss(k){try{return sessionStorage.getItem(k)||'';}catch(e){return '';}}
  function badge(label,n,t){var a=menu.querySelector('[data-nav="'+label+'"]');if(!a)return;var b=a.querySelector('.sn-bad');if(!b){b=document.createElement('span');b.className='sn-bad';a.appendChild(b);}
    b.textContent=n+'/'+t;b.className='sn-bad'+(n>0?' new':'');b.setAttribute('aria-label',n+' new of '+t+' total');}
  function counts(){var g=ss('ojj-gate-token'),ad=ss('ojj-admin-token');if(!g||!ad||!window.fetch)return;
    fetch('https://patient-sound-f420journeysquiz-log.jeffreyagold-bbd.workers.dev/roadmap/counts',{headers:{'X-Gate-Token':g,'X-Admin-Token':ad}}).then(function(r){return r.ok?r.json():null;}).then(function(d){
      if(!d)return;badge('Feedback',d.feedback.fresh,d.feedback.total);badge('Roadmap',d.comment.fresh+d.suggestion.fresh,d.comment.total+d.suggestion.total);}).catch(function(){});}
  window.OJJ_NAV_COUNTS=counts;
  box.appendChild(btn);box.appendChild(menu);

  function set(open){menu.hidden=!open;btn.setAttribute('aria-expanded',open?'true':'false');}
  btn.addEventListener('click',function(e){e.stopPropagation();set(menu.hidden);});
  document.addEventListener('click',function(e){if(!box.contains(e.target))set(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!menu.hidden){set(false);btn.focus();}});

  function mount(){
    var foot=document.querySelector('footer.foot');
    if(foot){foot.insertBefore(box,foot.firstChild);}   /* globe page: sits in the footer, bottom left */
    else{box.classList.add('fixed');document.body.appendChild(box);document.body.style.paddingBottom='56px';}
    stamp();counts();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
