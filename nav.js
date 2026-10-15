/* Site nav: a small collapsible menu at the bottom left. Loaded by index.html, quiz.html, strategy.html, roadmap.html and feedback.html.
   To add a page later (Feedback, Roadmap), add one line to PAGES. Nothing else changes. */
(function(){
  var PAGES=[
    {label:'Feedback',href:'feedback.html'},
    {label:'Roadmap',href:'roadmap.html'},
    {label:'Strategy',href:'strategy.html'}
  ];
  if(!PAGES.length)return;
  /* v0.8.0 (F-085): the glass sliding-pill navigation. Off unless the address carries ?nav=glass (remembered for this tab; ?nav=old turns it off).
     Until the CEO says "push it" for the cut-over, visitors see the old nav. */
  var GLASS=(function(){var m=/[?&]nav=(glass|old)\b/.exec(location.search);try{if(m)sessionStorage.setItem('ojj-nav',m[1]);return sessionStorage.getItem('ojj-nav')==='glass';}catch(e){return !!m&&m[1]==='glass';}})();
  if(GLASS)PAGES=[{label:'Roadmap',href:'roadmap.html'},{label:'Strategy',href:'strategy.html'},{label:'Feedback',href:'feedback.html'},{label:'Sources',href:'index.html?sources=1',sources:true}];
  function stamp(){if(document.getElementById('version')||document.getElementById('siteVer'))return;var v=document.createElement('div');v.id='siteVer';v.textContent='v'+(window.SITE_VERSION||'');v.style.cssText='position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));font:11.5px system-ui,sans-serif;color:#A9B4B8;opacity:.8;pointer-events:none;z-index:20';document.body.appendChild(v);}
  function loadPill(cb){if(window.OJJPill){cb();return;}var me=document.querySelector('script[src*="nav.js"]'),src=me?me.getAttribute('src').replace(/nav\.js.*$/,'pill.js'):'pill.js';
    var s=document.createElement('script');s.src=src;s.onload=cb;document.head.appendChild(s);}
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
  PAGES.forEach(function(p){var a=document.createElement('a');a.href=GLASS&&!p.sources?p.href+'?nav=glass':p.href;if(p.sources)a.setAttribute('data-sources','1');a.textContent=p.label;a.setAttribute('data-nav',p.label);if(p.href===here)a.setAttribute('aria-current','page');menu.appendChild(a);});
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

  var CSS_G=
  '.gn{position:sticky;top:0;z-index:45;display:flex;justify-content:center;align-items:flex-start;padding:10px 16px 0;padding-top:max(10px,env(safe-area-inset-top));min-height:54px;pointer-events:none;transition:transform .3s ease}'+
  '.gn>*{pointer-events:auto}.gn.tuck{transform:translateY(-140%)}'+
  '.gn-full{display:none;width:min(100%,360px)}'+
  '.gn-more{position:absolute;right:max(16px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top))}'+
  '.gn-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:170px;padding:6px;border-radius:16px;display:grid;gap:2px;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.07)),rgba(18,27,46,.9);border:1px solid rgba(255,255,255,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 14px 36px rgba(0,0,0,.5);transition:opacity .35s ease}'+
  '.gn-menu[hidden]{display:none}'+
  '.gn-menu a{display:flex;align-items:center;min-height:40px;padding:0 12px;border-radius:12px;color:#EEF2F8;font:600 14px system-ui,sans-serif;text-decoration:none;text-shadow:0 1px 3px rgba(0,0,0,.35)}'+
  '.gn-menu a:hover{background:rgba(255,255,255,.1)}.gn-menu a[aria-current="page"]{color:#F0BA62}'+
  '.gn-menu a:focus-visible{outline:2px solid #F0BA62;outline-offset:-2px}'+
  'html.nav-glass #quizLink,html.nav-glass #moveLink,html.nav-glass #globeLink,html.nav-glass #backGlobe,html.nav-glass .sn{display:none!important}'+
  '@media (min-width:901px){html.nav-glass #stage{height:calc(100svh - 164px)}}'+
  '@media (max-width:700px){.gn-short,.gn-more{display:none}.gn-full{display:block}}';
  function glassMount(){
    var P=window.OJJPill;if(!P)return;var root=document.documentElement;root.classList.add('nav-glass');
    var s=document.createElement('style');s.textContent=CSS_G;document.head.appendChild(s);
    var cur=({'index.html':'globe','':'globe','movements.html':'movements','quiz.html':'quiz','roadmap.html':'roadmap','strategy.html':'strategy','feedback.html':'feedback'})[here];
    function go(it){if(it.sources){var sl=document.getElementById('sourcesLink');if(sl){sl.click();return;}}location.href=it.href+(/\?/.test(it.href)?'&':'?')+'nav=glass';}
    var main=[{label:'Globe',value:'globe',href:'index.html'},{label:'Movements',value:'movements',href:'movements.html'},{label:'Quiz',value:'quiz',href:'quiz.html'},{label:'JewHate',value:'jewhate',soon:true}];
    var more=[{label:'Roadmap',value:'roadmap',href:'roadmap.html'},{label:'Strategy',value:'strategy',href:'strategy.html'},{label:'Feedback',value:'feedback',href:'feedback.html'},{label:'Sources',value:'sources',href:'index.html?sources=1',sources:true}];
    var bar=document.createElement('div');bar.className='gn';bar.id='gnBar';
    var short=document.createElement('div');short.className='gn-short';
    var pShort=P.create({label:'Pages',items:main,value:main.some(function(m){return m.value===cur;})?cur:null,onSelect:go});short.appendChild(pShort.el);
    var full=document.createElement('div');full.className='gn-full';
    var pFull=P.create({label:'Pages',items:main.concat(more),value:cur||null,scroll:true,nextLabel:'More pages',onSelect:go});full.appendChild(pFull.el);
    var mw=document.createElement('div');mw.className='gn-more';
    var onMore=cur==='roadmap'||cur==='strategy'||cur==='feedback';
    var pMore=P.create({label:'More pages',items:[{label:'More \u25BE',value:'more'}],value:onMore?'more':null,always:true,onSelect:function(){menu.hidden=!menu.hidden;}});
    mw.appendChild(pMore.el);menu.className='gn-menu';menu.hidden=true;menu.id='siteNavMenu';mw.appendChild(menu);
    menu.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-sources]');if(a){var sl=document.getElementById('sourcesLink');if(sl){e.preventDefault();menu.hidden=true;sl.click();}}});
    document.addEventListener('click',function(e){if(!mw.contains(e.target))menu.hidden=true;});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!menu.hidden){menu.hidden=true;}});
    bar.appendChild(short);bar.appendChild(full);bar.appendChild(mw);document.body.insertBefore(bar,document.body.firstChild);
    pShort.refresh();pFull.refresh();pMore.refresh();
    P.fadeOn(document.getElementById('stage'));
    // pages that scroll: the pill tucks away on scroll down and returns on scroll up
    var last=window.scrollY||0;window.addEventListener('scroll',function(){var y=window.scrollY||0;if(y>last+6&&y>60)bar.classList.add('tuck');else if(y<last-6||y<=60)bar.classList.remove('tuck');last=y;},{passive:true});
    stamp();counts();
  }
  function mount(){
    if(GLASS){loadPill(glassMount);return;}
    var foot=document.querySelector('footer.foot');
    if(foot){foot.insertBefore(box,foot.firstChild);}   /* globe page: sits in the footer, bottom left */
    else{box.classList.add('fixed');document.body.appendChild(box);document.body.style.paddingBottom='56px';}
    stamp();counts();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
