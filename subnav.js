/* F-085 subnav, Layout 3 (CEO chose it 2026-10-15). On by default; ?nav=old turns it off.
   A slim glass rail floats over the map's left edge: Map key, routes (This moment / With past routes), Reset (map position only).
   It reuses the page's own controls (the original Map key button and the hidden routes buttons), so nothing in the maps changes.
   On Movements the era pill stays above the time slider and replaces the tick labels; the rail takes no layout height. */
(function(){
  var m=/[?&]nav=(glass|old)\b/.exec(location.search),GLASS=true;
  try{if(m)sessionStorage.setItem('ojj-nav',m[1]);GLASS=sessionStorage.getItem('ojj-nav')!=='old';}catch(e){GLASS=!(m&&m[1]==='old');}
  if(!GLASS||!window.OJJPill)return;
  var root=document.documentElement;root.classList.add('sub-glass');
  // ?mapopts=1: the rail becomes a slim silver text-pill bar centred under the main nav (CEO chose it 2026-10-19). Off by default; ?mapopts=0 clears it for the tab.
  var mo=/[?&]mapopts=([01])\b/.exec(location.search),MAPOPTS=false;
  try{if(mo)sessionStorage.setItem('ojj-mapopts',mo[1]);MAPOPTS=sessionStorage.getItem('ojj-mapopts')==='1';}catch(e){MAPOPTS=!!(mo&&mo[1]==='1');}
  if(MAPOPTS)root.classList.add('mapopts');
  var G='linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.06))',SH='inset 0 1px 0 rgba(255,255,255,.28),0 8px 24px rgba(0,0,0,.35)';
  var css=
  'html.sub-glass #options,html.sub-glass #reset{display:none!important}'+
  'html.sub-glass .rail{position:absolute;left:14px;top:30%;z-index:15;display:flex;flex-direction:column;gap:8px;transition:opacity .35s ease}'+
  'html.sub-glass .rail .rb,html.sub-glass .rail #keyBtn{position:relative;width:40px;height:40px;min-height:40px;padding:0;margin:0;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:'+G+',rgba(18,27,46,.55);box-shadow:'+SH+';color:#EEF2F8;font:600 17px/1 system-ui,-apple-system,"Segoe UI",sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.35);cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}'+
  'html.sub-glass .rail>*{order:0!important}html.sub-glass .rail #keyBtn{font-size:0}html.sub-glass .rail #keyBtn::before{content:"\\24D8";font-size:19px}'+
  'html.sub-glass .rail .rb:hover,html.sub-glass .rail #keyBtn:hover{background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.1)),rgba(18,27,46,.6)}'+
  'html.sub-glass .rail .rb.on,html.sub-glass .rail #keyBtn[aria-expanded=true]{border-color:rgba(240,186,98,.9);color:#F0BA62}'+
  'html.sub-glass .rail .rb.dim{opacity:.5}'+
  'html.sub-glass .rail .rb:focus-visible,html.sub-glass .rail #keyBtn:focus-visible{outline:2px solid #F0BA62;outline-offset:2px}'+
  'html.sub-glass .rail .key{position:absolute;left:52px;top:0;right:auto;bottom:auto;transform:none;width:min(300px,calc(100vw - 84px));max-height:70vh;overflow:auto}'+
  'html.sub-glass .rail .rpop{position:absolute;left:52px;top:48px;display:grid;gap:6px;padding:8px;border-radius:16px;background:'+G+',rgba(18,27,46,.94);border:1px solid rgba(255,255,255,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 14px 36px rgba(0,0,0,.5)}'+
  'html.sub-glass .rail .rpop[hidden]{display:none}'+
  'html.sub-glass .rail .rpop button{font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#EEF2F8;padding:9px 14px;min-height:40px;text-align:left;white-space:nowrap;border-radius:999px;border:1px solid transparent;background:transparent;cursor:pointer}'+
  'html.sub-glass .rail .rpop button.on{background:linear-gradient(180deg,rgba(240,186,98,.95),rgba(214,147,52,.92));color:#1A1206}'+
  'html.sub-glass .subdock{flex:none;display:flex;flex-direction:column;align-items:center;padding:8px 12px 0}'+
  'html.sub-glass .sd-era{display:flex;justify-content:center;width:100%;max-width:640px}'+
  'html.sub-glass .sd-era .gp-wrap{width:100%}'+
  '@media (max-width:620px){html.sub-glass .rail{left:8px;gap:6px}html.sub-glass .rail .rb,html.sub-glass .rail #keyBtn{width:38px;height:38px;min-height:38px}html.sub-glass .rail .key,html.sub-glass .rail .rpop{left:46px}html.sub-glass .sd-era .gp-dots{display:none!important}html.sub-glass .subdock{padding:6px 10px 0}}'+
  'html.sub-glass .ticks button{color:transparent!important;pointer-events:none}'+
  'html.sub-glass .tl{height:34px}'+
  'html.gp-moving .rail{opacity:var(--gp-fade)}';
  if(MAPOPTS){
    var S='html.sub-glass.mapopts ',F='system-ui,-apple-system,"Segoe UI",sans-serif',INK='#1b222c';
    css+=
    S+'.rail{position:relative;left:auto;top:auto;z-index:20;display:flex!important;flex-direction:row;align-items:center;gap:2px;width:fit-content;max-width:calc(100% - 24px);margin:2px auto 4px;padding:3px;border-radius:999px;background:linear-gradient(180deg,#f3f5f8,#b5bbc6);border:1px solid #fbfcfd;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 6px 18px rgba(0,0,0,.3)}'+
    S+'.rail .rb,'+S+'.rail #keyBtn{width:auto;height:24px;min-height:24px;padding:0 13px;border-radius:999px;border:0;background:transparent;box-shadow:none;color:'+INK+';font-size:0;line-height:0;text-shadow:none;display:block;white-space:nowrap;-webkit-backdrop-filter:none;backdrop-filter:none}'+
    S+'.rail #keyBtn::before,'+S+'.rail .mo-rt::before,'+S+'.rail .mo-rs::before{font:600 12px/24px '+F+'}'+
    S+'.rail #keyBtn::before{content:"Map key"}'+S+'.rail .mo-rt::before{content:"Routes"}'+S+'.rail .mo-rs::before{content:"Reset"}'+
    S+'.rail .rb:hover,'+S+'.rail #keyBtn:hover{background:rgba(27,34,44,.1)}'+
    S+'.rail .rb.on,'+S+'.rail #keyBtn[aria-expanded=true]{background:rgba(27,34,44,.14);box-shadow:inset 0 0 0 1px rgba(27,34,44,.35);color:'+INK+'}'+
    S+'.rail .rb:focus-visible,'+S+'.rail #keyBtn:focus-visible{outline:2px solid '+INK+';outline-offset:1px}'+
    S+'.rail .rb.dim{opacity:.45}'+
    S+'.rail .key{position:absolute;left:50%;right:auto;top:calc(100% + 8px);bottom:auto;transform:translateX(-50%);width:min(300px,calc(100vw - 24px));max-height:60vh;overflow:auto;z-index:30}'+
    S+'.rail .rpop{left:50%;top:calc(100% + 8px);transform:translateX(-50%);z-index:30}'+
    'html.mo-events.mapopts .rail .mo-rt{display:none!important}'+
    '@media (min-width:901px){html.sub-glass.mapopts.nav-glass #stage{height:calc(100svh - 198px)}}'+
    // wide screens: the title goes top left and the bar sits right-aligned on the main nav's row (CEO, 2026-10-19). Narrower screens keep the bar centred under the nav.
    '@media (min-width:1080px){'+
      'html.sub-glass.mapopts.nav-glass header.top{margin-top:-54px;padding-top:6px;padding-left:28px;position:relative;z-index:46;pointer-events:none}'+
      'html.sub-glass.mapopts.nav-glass header.top .brand{pointer-events:auto}'+
      S+'.rail{position:absolute;top:14px;right:24px;left:auto;margin:0;z-index:47}'+
      S+'.rail .key,'+S+'.rail .rpop{left:auto;right:0;transform:none}'+
      'html.sub-glass.mapopts.nav-glass #stage{height:calc(100svh - 122px)}'+
    '}'+
    '@media (prefers-reduced-motion:reduce){'+S+'.rail{transition:none!important}}';
  }
  var st=document.createElement('style');st.id='sd-css';st.textContent=css;document.head.appendChild(st);
  function mk(cls,txt,label){var b=document.createElement('button');b.type='button';b.className=cls;b.textContent=txt;b.setAttribute('aria-label',label);b.title=label;return b;}
  function init(){
    var key=document.getElementById('keyBtn'),keyBox=document.getElementById('key'),opts=document.getElementById('options');
    if(!key||!opts)return;
    var onMove=!!document.getElementById('ticks'),host;
    var rail=document.createElement('div');rail.className='rail';rail.setAttribute('role','group');rail.setAttribute('aria-label','Map controls');
    key.setAttribute('aria-label','Map key');key.title='Map key';
    var rt=mk('rb','⇄','Routes: this moment or with past routes');rt.setAttribute('aria-expanded','false');
    var pop=document.createElement('div');pop.className='rpop';pop.hidden=true;
    var bm=document.createElement('button'),bp=document.createElement('button');bm.type=bp.type='button';bm.textContent='This moment';bp.textContent='With past routes';
    pop.appendChild(bm);pop.appendChild(bp);
    var rs=mk('rb dim','↺','Reset map position');rt.classList.add('mo-rt');rs.classList.add('mo-rs');
    function placeBar(r){var hd=document.querySelector('header.top');if(hd&&hd.parentNode)hd.parentNode.insertBefore(r,hd);else document.body.insertBefore(r,document.body.firstChild);}   // mapopts: the bar sits in the page flow, directly under the main nav
    var t=null;
    function closePop(){pop.hidden=true;rt.setAttribute('aria-expanded','false');clearTimeout(t);}
    function pick(v){var b=document.querySelector('[data-trails="'+(v==='past'?'on':'off')+'"]');if(b)b.click();sync();clearTimeout(t);t=setTimeout(closePop,600);}
    rt.addEventListener('click',function(e){e.stopPropagation();var o=pop.hidden;pop.hidden=!o;rt.setAttribute('aria-expanded',String(o));if(o&&keyBox&&!keyBox.hidden)key.click();});
    bm.addEventListener('click',function(){pick('moment');});bp.addEventListener('click',function(){pick('past');});
    rs.addEventListener('click',function(){closePop();if(window.OJJ_SUB)window.OJJ_SUB.resetView();});
    key.addEventListener('click',closePop);
    document.addEventListener('click',function(e){if(!pop.hidden&&!pop.contains(e.target)&&e.target!==rt)closePop();});
    ['pointerdown','wheel','touchstart'].forEach(function(n){rail.addEventListener(n,function(e){e.stopPropagation();},{passive:true});});
    rail.appendChild(key);rail.appendChild(rt);rail.appendChild(rs);rail.appendChild(pop);if(keyBox)rail.appendChild(keyBox);
    if(onMove){
      var stage=document.getElementById('stage'),tl=stage&&stage.querySelector('.tl'),wrap=document.getElementById('mapWrap');if(!tl||!wrap)return;
      var dock=document.createElement('div');dock.className='subdock';
      var era=document.createElement('div');era.className='sd-era';era.id='subEra';
      dock.appendChild(era);stage.insertBefore(dock,tl);if(MAPOPTS)placeBar(rail);else wrap.appendChild(rail);host=wrap;
      if(window.OJJPill&&OJJPill.fadeOn)OJJPill.fadeOn(wrap);
    }else{
      var sg=document.getElementById('stage');if(!sg)return;if(MAPOPTS){placeBar(rail);root.classList.add('mo-events');}else sg.appendChild(rail);host=sg;
      if(OJJPill.fadeOn)OJJPill.fadeOn(sg);
    }
    function sync(){
      var on=document.querySelector('[data-trails="on"]'),past=!!on&&on.getAttribute('aria-pressed')==='true';
      bm.classList.toggle('on',!past);bp.classList.toggle('on',past);rt.classList.toggle('on',past);
      var mv=window.OJJ_SUB?window.OJJ_SUB.moved():false;rs.classList.toggle('dim',!mv);
      rail.style.display=(opts.hidden&&!MAPOPTS)?'none':'';
    }
    setInterval(sync,300);sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
