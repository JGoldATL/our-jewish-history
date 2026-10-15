/* Glass sliding pill (F-085). ONE component, used for page navigation, the More menu, and any later segmented choice
   (quiz Default/Academic toggle, map options). Look and behaviour follow Nav_Comps_v3_Glass (CEO-chosen: glass 12, blur 0, fade 25).
   API:  OJJPill.create({label, items:[{label,value,href,soon}], value, scroll, onSelect}) -> {el, setValue(v), refresh()}
         OJJPill.fadeOn(element)   fades every pill to 25% while the visitor drags, pinches or wheel-zooms inside element.
   One option is always selected unless value is null (used on pages that are not in the pill). */
(function(){
  if(window.OJJPill)return;
  var css=
  ':root{--gp-top:.12;--gp-bot:.05;--gp-blur:0px;--gp-fade:.25}'+
  '.gp-wrap{position:relative;display:inline-block;max-width:100%;min-width:0}'+
  '.gp{position:relative;display:flex;align-items:center;padding:4px;border-radius:999px;max-width:100%;'+
    'background:linear-gradient(180deg,rgba(255,255,255,var(--gp-top)),rgba(255,255,255,var(--gp-bot)));'+
    'border:1px solid rgba(255,255,255,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 8px 24px rgba(0,0,0,.35);'+
    '-webkit-backdrop-filter:blur(var(--gp-blur)) saturate(150%);backdrop-filter:blur(var(--gp-blur)) saturate(150%);transition:opacity .35s ease}'+
  '.gp-track{position:relative;display:flex;gap:2px;flex:1 1 auto;min-width:0;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border-radius:999px;-webkit-overflow-scrolling:touch}'+
  '.gp-track::-webkit-scrollbar{display:none}'+
  '.gp.over .gp-track{-webkit-mask-image:linear-gradient(90deg,#000 80%,transparent);mask-image:linear-gradient(90deg,#000 80%,transparent)}'+
  '.gp.over.atend .gp-track{-webkit-mask-image:linear-gradient(90deg,transparent,#000 20%);mask-image:linear-gradient(90deg,transparent,#000 20%)}'+
  '.gp-thumb{position:absolute;top:0;bottom:0;left:0;width:0;border-radius:999px;pointer-events:none;'+
    'background:linear-gradient(180deg,rgba(240,186,98,.95),rgba(214,147,52,.92));'+
    'box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 2px 10px rgba(227,165,72,.45);'+
    'transition:left .3s cubic-bezier(.3,.7,.2,1),width .3s cubic-bezier(.3,.7,.2,1)}'+
  '.gp-thumb.none{opacity:0}'+
  '.gp-btn{position:relative;z-index:1;flex:0 0 auto;scroll-snap-align:start;font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#EEF2F8;background:transparent;border:0;border-radius:999px;padding:7px 14px;min-height:32px;cursor:pointer;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.35);transition:color .2s}'+
  '.gp-btn[aria-pressed="true"]{color:#1A1206;text-shadow:none}'+
  '.gp-btn[aria-disabled="true"]{opacity:.45;cursor:default}'+
  '.gp-btn[aria-disabled="true"]::after{content:" soon";font-weight:400;font-size:10.5px}'+
  '.gp-btn:focus-visible,.gp-next:focus-visible{outline:2px solid #F0BA62;outline-offset:2px}'+
  '.gp-next{display:none;flex:0 0 30px;height:30px;border-radius:50%;border:0;background:transparent;color:#F0BA62;font-size:17px;line-height:1;cursor:pointer;padding:0}'+
  '.gp.over .gp-next{display:block}'+
  '.gp-next span{display:inline-block;animation:gpnudge 1.6s ease-in-out infinite}'+
  '@keyframes gpnudge{0%,60%,100%{transform:none}30%{transform:translateX(3px)}}'+
  '.gp-dots{display:none;justify-content:center;gap:5px;margin-top:6px;transition:opacity .35s ease}'+
  '.gp-wrap.over .gp-dots{display:flex}'+
  '.gp-dots i{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.25)}.gp-dots i.on{background:#F0BA62}'+
  'html.gp-moving .gp,html.gp-moving .gp-dots,html.gp-moving .gn-menu{opacity:var(--gp-fade)}'+
  '.gc{display:inline-flex;flex-direction:column;align-items:center;max-width:100%}'+
  '.gc-col{position:relative;display:inline-flex;align-items:center;padding:4px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:linear-gradient(180deg,rgba(255,255,255,var(--gp-top)),rgba(255,255,255,var(--gp-bot)));box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 8px 24px rgba(0,0,0,.35);cursor:pointer;max-width:100%;overflow:hidden;font:inherit;color:inherit;-webkit-backdrop-filter:blur(var(--gp-blur)) saturate(150%);backdrop-filter:blur(var(--gp-blur)) saturate(150%);transition:opacity .35s ease}'+
  '.gc-cur{font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;padding:7px 14px;min-height:32px;border-radius:999px;color:#1A1206;background:linear-gradient(180deg,rgba(240,186,98,.95),rgba(214,147,52,.92));box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 2px 10px rgba(227,165,72,.45);white-space:nowrap;display:flex;align-items:center}'+
  '.gc-peek{font:600 13px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#EEF2F8;padding:7px 10px 7px 6px;white-space:nowrap;width:52px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,#000,transparent);mask-image:linear-gradient(90deg,#000,transparent);opacity:.85}'+
  '.gc-chev{color:#F0BA62;font-size:17px;line-height:1;padding:0 8px 0 2px}.gc-chev span{display:inline-block;animation:gpnudge 1.6s ease-in-out infinite}'+
  '.gc-col:focus-visible{outline:2px solid #F0BA62;outline-offset:2px}'+
  'html.gp-moving .gc-col{opacity:var(--gp-fade)}'+
  '@media (prefers-reduced-transparency:reduce){.gc-col{background:rgba(18,27,46,.96);-webkit-backdrop-filter:none;backdrop-filter:none}}'+
  '@media (prefers-reduced-motion:reduce){.gc-col{transition:none!important}.gc-chev span{animation:none!important}}'+
  '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.gp{background:rgba(18,27,46,.94)}}'+
  '@media (prefers-reduced-transparency:reduce){.gp{background:rgba(18,27,46,.96);-webkit-backdrop-filter:none;backdrop-filter:none}}'+
  '@media (prefers-reduced-motion:reduce){.gp,.gp-thumb,.gp-btn,.gp-dots{transition:none!important}.gp-next span{animation:none!important}.gp-track{scroll-behavior:auto}}';
  function inject(){if(document.getElementById('gp-css'))return;var s=document.createElement('style');s.id='gp-css';s.textContent=css;document.head.appendChild(s);}
  function h(tag,cls){var e=document.createElement(tag);if(cls)e.className=cls;return e;}
  var all=[];
  function create(o){
    inject();
    var wrap=h('div','gp-wrap'),pill=h('div','gp'),track=h('div','gp-track'),thumb=h('span','gp-thumb'),next=null,dots=h('div','gp-dots'),btns=[];
    pill.setAttribute('role','group');if(o.label)pill.setAttribute('aria-label',o.label);
    track.appendChild(thumb);
    o.items.forEach(function(it){var b=h('button','gp-btn');b.type='button';b.textContent=it.label;b.setAttribute('data-value',it.value);
      b.setAttribute('aria-pressed','false');if(it.soon)b.setAttribute('aria-disabled','true');
      b.addEventListener('click',function(){if(it.soon)return;if(it.value===cur&&!o.always)return;if(o.onSelect)o.onSelect(it,b);});
      if(it.style)b.style.cssText=it.style;track.appendChild(b);btns.push(b);});
    pill.appendChild(track);
    if(o.scroll){next=h('button','gp-next');next.type='button';next.setAttribute('aria-label',o.nextLabel||'More');next.innerHTML='<span aria-hidden="true">›</span>';pill.appendChild(next);}
    wrap.appendChild(pill);if(o.scroll)wrap.appendChild(dots);
    var cur=o.value==null?null:o.value;
    function place(){var on=btns.filter(function(b){return b.getAttribute('aria-pressed')==='true';})[0];
      if(!on){thumb.className='gp-thumb none';return;}thumb.className='gp-thumb';thumb.style.left=on.offsetLeft+'px';thumb.style.width=on.offsetWidth+'px';}
    function over(){if(!o.scroll)return;var max=track.scrollWidth-track.clientWidth,isOver=max>2;pill.classList.toggle('over',isOver);wrap.classList.toggle('over',isOver);
      var f=isOver?track.scrollLeft/max:0;pill.classList.toggle('atend',f>.95);if(next)next.firstChild.textContent=f>.95?'‹':'›';
      if(isOver){var n=Math.max(2,Math.min(5,Math.ceil(track.scrollWidth/track.clientWidth)));while(dots.children.length<n)dots.appendChild(h('i'));while(dots.children.length>n)dots.removeChild(dots.lastChild);
        var i=Math.min(n-1,Math.round(f*(n-1)));for(var k=0;k<n;k++)dots.children[k].className=k===i?'on':'';}}
    function setValue(v,noScroll){cur=v==null?null:v;btns.forEach(function(b){b.setAttribute('aria-pressed',String(cur!=null&&b.getAttribute('data-value')===cur));});place();
      if(o.scroll&&!noScroll){var on=btns.filter(function(b){return b.getAttribute('aria-pressed')==='true';})[0];if(on&&track.scrollWidth>track.clientWidth+2){track.scrollTo?track.scrollTo({left:Math.max(0,on.offsetLeft-20),behavior:'smooth'}):0;}}over();}
    function refresh(){place();over();}
    track.addEventListener('scroll',over,{passive:true});
    if(next)next.addEventListener('click',function(){var max=track.scrollWidth-track.clientWidth;track.scrollTo({left:track.scrollLeft>=max-4?0:track.scrollLeft+track.clientWidth*.7,behavior:'smooth'});});
    var api={el:wrap,setValue:setValue,refresh:refresh,buttons:btns};all.push(api);
    setValue(cur,true);
    // measure again once the element is in the page and fonts are ready
    if(window.ResizeObserver){new ResizeObserver(refresh).observe(wrap);}
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(refresh);
    requestAnimationFrame(function(){refresh();if(o.scroll&&cur!=null){var on=btns.filter(function(b){return b.getAttribute('aria-pressed')==='true';})[0];if(on&&track.scrollWidth>track.clientWidth+2)track.scrollLeft=Math.max(0,on.offsetLeft-20);over();}});
    return api;
  }

  // Collapsing pill (map options): open on first visit; about 2 s after a pick it tucks to the chosen value with a chevron and a peek of the next option; tap reopens it.
  // o: {label, items:[{label,value}], value, resetValue, onSelect(it), collapseMs, startOpen}. The item whose value is resetValue is an action, shown only after setResetVisible(true).
  function collapsible(o){
    var val=o.value,open=o.startOpen!==false,timer=0,resetOn=false,box=h('div','gc');
    var pill=create({label:o.label,value:val,items:o.items,onSelect:function(it,b){
      if(it.value===o.resetValue){if(o.onSelect)o.onSelect(it);arm();return;}
      val=it.value;pill.setValue(val);if(o.onSelect)o.onSelect(it);arm();}});
    var resetBtn=o.resetValue!=null?pill.buttons.filter(function(b){return b.getAttribute('data-value')===o.resetValue;})[0]:null;
    var col=h('div','gc-col');col.setAttribute('role','button');col.tabIndex=0;col.setAttribute('aria-label',(o.label||'Options')+', tap to open');
    var names={};o.items.forEach(function(it){if(it.value!==o.resetValue)names[it.value]=it.label;});
    function others(){return Object.keys(names).filter(function(k){return k!==val;});}
    function arm(){clearTimeout(timer);timer=setTimeout(function(){open=false;render();},o.collapseMs||2000);}
    function render(){
      box.textContent='';
      if(open){box.appendChild(pill.el);if(resetBtn)resetBtn.style.display=resetOn?'':'none';pill.setValue(val,true);setTimeout(pill.refresh,30);return;}
      col.textContent='';var cur=h('span','gc-cur');cur.textContent=names[val]||'';col.appendChild(cur);
      var nx=others()[0];if(nx){var pk=h('span','gc-peek');pk.textContent=names[nx];pk.setAttribute('aria-hidden','true');col.appendChild(pk);}
      var ch=h('span','gc-chev');ch.innerHTML='<span aria-hidden="true">\u203A</span>';col.appendChild(ch);
      box.appendChild(col);}
    function openIt(){open=true;clearTimeout(timer);render();}
    col.addEventListener('click',openIt);col.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openIt();}});
    render();
    return {el:box,setValue:function(v){if(v===val)return;val=v;render();},setResetVisible:function(v){v=!!v;if(v===resetOn)return;resetOn=v;if(resetBtn&&open){resetBtn.style.display=resetOn?'':'none';pill.refresh();}},get value(){return val;}};
  }
  // Fade every pill to 25% while the visitor moves the map (drag, pinch, wheel); full again about 250 ms after they stop. Touching a pill never fades.
  function fadeOn(el){if(!el||el.__gpFade)return;el.__gpFade=1;var t,root=document.documentElement,down=false;
    function on(){clearTimeout(t);root.classList.add('gp-moving');}
    function off(){clearTimeout(t);t=setTimeout(function(){root.classList.remove('gp-moving');},250);}
    el.addEventListener('pointerdown',function(e){if(e.target.closest&&e.target.closest('.gp,.gp-wrap,.gn'))return;down=true;on();});
    window.addEventListener('pointerup',function(){if(down){down=false;off();}});window.addEventListener('pointercancel',function(){if(down){down=false;off();}});
    el.addEventListener('wheel',function(e){if(e.target.closest&&e.target.closest('.gp,.gp-wrap,.gn'))return;on();off();},{passive:true});}
  window.addEventListener('resize',function(){all.forEach(function(a){a.refresh();});});
  window.OJJPill={create:create,collapsible:collapsible,fadeOn:fadeOn,inject:inject};
})();
