/* F-085 subnav (CEO chose Option A, Comp 1, 2026-10-15). Only with the glass nav (?nav=glass): Map key plus one collapsing routes pill.
   Routes pill: This moment | With past routes | Reset (Reset shows only when the map is moved or zoomed; it returns the map position only).
   It reuses the page's own controls (the hidden This moment / With past routes buttons), so nothing in the maps changes.
   On Movements the pair sits above the time slider with the era pill under it; on the globe it stays at the top right. */
(function(){
  var m=/[?&]nav=(glass|old)\b/.exec(location.search),GLASS=false;
  try{if(m)sessionStorage.setItem('ojj-nav',m[1]);GLASS=sessionStorage.getItem('ojj-nav')==='glass';}catch(e){GLASS=!!m&&m[1]==='glass';}
  if(!GLASS||!window.OJJPill)return;
  var root=document.documentElement;root.classList.add('sub-glass');
  var css=
  'html.sub-glass #options,html.sub-glass #reset{display:none!important}'+
  'html.sub-glass #keyBtn{font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#EEF2F8;padding:8px 14px;min-height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 8px 24px rgba(0,0,0,.35);text-shadow:0 1px 3px rgba(0,0,0,.35);cursor:pointer}'+
  'html.sub-glass #keyBtn:hover{background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.09))}'+
  'html.sub-glass .sd-row{position:relative;display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap}'+
  'html.sub-glass .sd-row .key{top:auto;bottom:calc(100% + 10px);left:50%;right:auto;transform:translateX(-50%);width:min(300px,calc(100vw - 32px))}'+
  'html.sub-glass .sd-row>#keyBtn{order:0!important}html.sub-glass .sd-row>.gc{order:1}'+
  'html.sub-glass .subdock{flex:none;display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 12px 0}'+
  'html.sub-glass .sd-era{display:flex;justify-content:center;width:100%;max-width:640px}'+
  'html.sub-glass .sd-era .gp-wrap{width:100%}'+
  '@media (max-width:620px){html.sub-glass .sd-era .gp-dots{display:none!important}html.sub-glass .subdock{gap:6px;padding:6px 10px 0}}'+
  'html.sub-glass .ticks button{color:transparent!important;pointer-events:none}'+
  'html.sub-glass .tl{height:34px}'+
  'html.sub-glass .gc,html.sub-glass .sd-row>*{transition:opacity .35s ease}html.gp-moving .sd-row>#keyBtn{opacity:var(--gp-fade)}';
  var st=document.createElement('style');st.id='sd-css';st.textContent=css;document.head.appendChild(st);
  function init(){
    var key=document.getElementById('keyBtn'),keyBox=document.getElementById('key'),opts=document.getElementById('options');
    if(!key||!opts)return;
    var onMove=!!document.getElementById('ticks'),host;
    var routes=OJJPill.collapsible({label:'Routes',value:'moment',resetValue:'reset',startOpen:!(window.matchMedia&&matchMedia('(max-width:620px)').matches),
      items:[{label:'This moment',value:'moment'},{label:'With past routes',value:'past'},{label:'↺ Reset',value:'reset'}],
      onSelect:function(it){
        if(it.value==='reset'){if(window.OJJ_SUB)window.OJJ_SUB.resetView();return;}
        var b=document.querySelector('[data-trails="'+(it.value==='past'?'on':'off')+'"]');if(b)b.click();}});
    if(onMove){
      var stage=document.getElementById('stage'),tl=stage&&stage.querySelector('.tl');if(!tl)return;
      var dock=document.createElement('div');dock.className='subdock';
      var row=document.createElement('div');row.className='sd-row';
      var era=document.createElement('div');era.className='sd-era';era.id='subEra';
      dock.appendChild(row);dock.appendChild(era);stage.insertBefore(dock,tl);host=row;
      row.appendChild(key);if(keyBox)row.appendChild(keyBox);row.appendChild(routes.el);
      if(window.OJJPill.fadeOn)OJJPill.fadeOn(document.getElementById('mapWrap'));
    }else{
      key.parentNode.insertBefore(routes.el,key.nextSibling);host=routes.el;
      if(window.OJJPill.fadeOn)OJJPill.fadeOn(document.getElementById('stage'));
    }
    // keep the pill in step with the page: past/moment, Reset visibility, and the globe's hidden-until-started options
    setInterval(function(){
      var on=document.querySelector('[data-trails="on"]');routes.setValue(on&&on.getAttribute('aria-pressed')==='true'?'past':'moment');
      routes.setResetVisible(window.OJJ_SUB?window.OJJ_SUB.moved():false);
      routes.el.style.display=opts.hidden?'none':'';
    },300);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
