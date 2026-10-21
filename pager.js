/* One card pager for the whole site (Creative Design comp P1, counter wording W1; CEO 10/22).
   Previous and Next arrows, a window of 5 or 7 tappable dots with the current one larger and amber, and a counter ("9 of 11").
   Always the bottom strip of a card, under a thin divider. No wrap-around: the ends dim and dash.
   Used by: archaeology.js (reference). JewHate and Events move onto it next.

   var pg=OJJPager.mount(hostElement,{label:'find',onStep:function(d){},onGo:function(i){}});
   pg.update({count:11,index:8,title:'Dead Sea Scrolls',names:['A','B',...]});   // names are optional, used in the dot labels
   OJJPager.swipe(cardElement,function(d){});   // sideways swipe on a card steps it
   OJJPager.keys(function(d){}, function(){return true;});   // left and right arrow keys (not while typing)  */
(function(){
'use strict';
var ARROW=44,DOT=24,COUNTER=64,GAPS=42;   // GAPS: three 6 px gaps plus 12 px padding each side
var CSS='.ojjpg{flex:none;display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 12px 10px;border-top:1px solid var(--line,rgba(239,230,211,.18));font-family:var(--sans,Arial,sans-serif)}'
+'.ojjpg[hidden]{display:none}'
+'.ojjpg .pgb{width:44px;height:44px;flex:none;border-radius:50%;border:1px solid var(--line,rgba(239,230,211,.18));background:rgba(239,230,211,.08);color:var(--text,#EFE6D3);font-size:22px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0}'
+'.ojjpg .pgb:hover{background:rgba(239,230,211,.16)}'
+'.ojjpg .pgb[aria-disabled="true"]{opacity:.4;border-style:dashed;background:none;cursor:default}'
+'.ojjpg .pgb svg{display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}'
+'.ojjpg .pgd{display:flex;align-items:center;justify-content:center;flex:1 1 auto;min-width:0}'
+'.ojjpg .dotb{width:24px;height:44px;flex:none;border:0;background:none;padding:0;cursor:pointer;display:grid;place-items:center}'
+'.ojjpg .dotb::before{content:"";width:8px;height:8px;border-radius:50%;background:rgba(239,230,211,.4);transition:transform .15s,background .15s}'
+'.ojjpg .dotb.sm::before{width:5px;height:5px}'
+'.ojjpg .dotb[aria-current="true"]::before{background:var(--amber,#E8B27A);transform:scale(1.5)}'
+'.ojjpg .pgn{flex:none;min-width:64px;text-align:right;font-size:14px;font-weight:600;color:var(--soft,#D2CABB);white-space:nowrap}'
+'.ojjpg :focus-visible{outline:3px solid var(--amber,#E8B27A);outline-offset:2px;border-radius:50%}'
+'.ojjpg .dotb:focus-visible{border-radius:8px}'
+'.ojjpg .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'
+'@media (prefers-reduced-motion:reduce){.ojjpg .dotb::before{transition:none}}';
function style(){if(document.getElementById('ojjpgCss'))return;var s=document.createElement('style');s.id='ojjpgCss';s.textContent=CSS;document.head.appendChild(s);}
var ICON={'-1':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>','1':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
/* How many dots fit between the arrows: 7 when the card is wide enough, otherwise 5, and 3 on a very narrow card. Always odd. */
function windowFor(w){var base=2*ARROW+COUNTER+GAPS;return w>=base+7*DOT?7:w>=base+5*DOT?5:3;}   // 3 only on a very narrow card, so nothing overlaps
function mount(host,o){
  o=o||{};style();
  var el=document.createElement('div');el.className='ojjpg';el.hidden=true;el.setAttribute('role','group');el.setAttribute('aria-label',(o.label?o.label.charAt(0).toUpperCase()+o.label.slice(1)+' pager':'Pager'));
  host.appendChild(el);
  var st={count:0,index:0,title:'',names:null},key='';
  function render(force){
    var N=st.count,i=st.index;
    if(N<2){el.hidden=true;key='';return;}
    var span=Math.min(N,windowFor(el.clientWidth||host.clientWidth||334)),key2=[N,i,span,st.title].join('|');
    if(!force&&key2===key)return;key=key2;el.hidden=false;
    var s=Math.max(0,Math.min(i-Math.floor(span/2),N-span)),dots='';
    for(var k=s;k<s+span;k++){
      var edge=((k===s&&s>0)||(k===s+span-1&&s+span<N))&&k!==i,nm=st.names&&st.names[k]?esc(st.names[k])+', ':'';
      dots+='<button type="button" class="dotb'+(edge?' sm':'')+'" data-go="'+k+'" aria-label="Go to '+nm+(k+1)+' of '+N+'"'+(k===i?' aria-current="true"':'')+'></button>';
    }
    el.innerHTML='<button type="button" class="pgb" data-step="-1" aria-label="Previous"'+(i<=0?' aria-disabled="true"':'')+'>'+ICON['-1']+'</button>'
      +'<div class="pgd">'+dots+'</div>'
      +'<button type="button" class="pgb" data-step="1" aria-label="Next"'+(i>=N-1?' aria-disabled="true"':'')+'>'+ICON['1']+'</button>'
      +'<span class="pgn" role="status" aria-live="polite">'+(i+1)+' of '+N+(st.title?'<span class="sr">, '+esc(st.title)+'</span>':'')+'</span>';
  }
  el.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-step],[data-go]');if(!b)return;
    if(b.hasAttribute('data-step')){if(b.getAttribute('aria-disabled')==='true')return;o.onStep&&o.onStep(+b.getAttribute('data-step'));}
    else{var g=+b.getAttribute('data-go');if(g!==st.index)o.onGo&&o.onGo(g);}
  });
  if(window.ResizeObserver){var t=0;new ResizeObserver(function(){clearTimeout(t);t=setTimeout(function(){render(false);},30);}).observe(host);}
  return {
    el:el,
    update:function(s){st={count:s.count|0,index:Math.max(0,Math.min((s.count|0)-1,s.index|0)),title:s.title||'',names:s.names||null};render(true);},
    hide:function(){st.count=0;render(true);}
  };
}
function swipe(card,fn){
  var x0=null,y0=null;
  card.addEventListener('touchstart',function(e){if(e.touches.length===1){x0=e.touches[0].clientX;y0=e.touches[0].clientY;}else x0=null;},{passive:true});
  card.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.6)fn(dx<0?1:-1);},{passive:true});
}
function keys(fn,active){
  document.addEventListener('keydown',function(e){
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;if(active&&!active())return;
    var t=e.target;if(t&&t.closest&&t.closest('input,select,textarea,[contenteditable]'))return;
    if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
    fn(e.key==='ArrowRight'?1:-1);
  });
}
window.OJJPager={mount:mount,swipe:swipe,keys:keys,windowFor:windowFor};
})();
