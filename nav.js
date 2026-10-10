/* Site nav: a small collapsible menu at the bottom left. Loaded by index.html, quiz.html, strategy.html, roadmap.html and feedback.html.
   To add a page later (Feedback, Roadmap), add one line to PAGES. Nothing else changes. */
(function(){
  var PAGES=[
    {label:'Feedback',href:'feedback.html'},
    {label:'Roadmap',href:'roadmap.html'},
    {label:'Strategy',href:'strategy.html'}
  ];
  if(!PAGES.length)return;
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
  '.sn-menu a[aria-current="page"]{color:#f2a65a;font-weight:600}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  var box=document.createElement('div');box.className='sn';box.id='siteNav';
  var btn=document.createElement('button');btn.type='button';btn.className='sn-btn';btn.id='siteNavBtn';
  btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','siteNavMenu');
  btn.innerHTML='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 3h10M1 6h10M1 9h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>More';
  var menu=document.createElement('nav');menu.className='sn-menu';menu.id='siteNavMenu';menu.hidden=true;menu.setAttribute('aria-label','More pages');
  PAGES.forEach(function(p){var a=document.createElement('a');a.href=p.href;a.textContent=p.label;if(p.href===here)a.setAttribute('aria-current','page');menu.appendChild(a);});
  box.appendChild(btn);box.appendChild(menu);

  function set(open){menu.hidden=!open;btn.setAttribute('aria-expanded',open?'true':'false');}
  btn.addEventListener('click',function(e){e.stopPropagation();set(menu.hidden);});
  document.addEventListener('click',function(e){if(!box.contains(e.target))set(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!menu.hidden){set(false);btn.focus();}});

  function mount(){
    var foot=document.querySelector('footer.foot');
    if(foot){foot.insertBefore(box,foot.firstChild);}   /* globe page: sits in the footer, bottom left */
    else{box.classList.add('fixed');document.body.appendChild(box);document.body.style.paddingBottom='56px';}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
