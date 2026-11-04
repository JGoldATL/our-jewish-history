/* The six map symbols, one drawing for every page (Creative Design's final art, claude/design-symbol-art.js; Jeffrey 3 Nov: "symbols are done").
   Types: oct (red octagon), cir (yellow circle), sq (black square), dia (purple diamond), split (split diamond with a cross), splitI (split diamond with a crescent).
   Every symbol carries a thin cream halo (#FFF2DE) about 1 CSS px outside its dark hairline, at every size (Jeffrey 3 Nov, "1a"). The halo is a non-scaling stroke, so it is 1 px
   whether the symbol is drawn at 22, 30 or 32 px.
   SIZE: the drawing sits in a 36-unit box (viewBox -18 -18 36 36) exactly as before, and the pages scale that box. R holds the half-size used for each shape so the shapes keep the live
   size (octagon about 15.7 units across its flats, square 13, diamond 17.4); only the art changes, not the size. */
(function(){
  var cid=0,OUT='#1B2328',CREAM='#FFF3DC',PURPLE='#5A3B7A',HALO='#FFF2DE';
  var R={oct:15.9,cir:14.1,sq:14.1,dia:14.1,split:14.1,splitI:14.1};
  function poly(n,r,rot,x,y){var a=[];for(var i=0;i<n;i++){var t=rot+i*2*Math.PI/n;a.push((x+r*Math.cos(t)).toFixed(2)+','+(y+r*Math.sin(t)).toFixed(2));}return a.join(' ');}
  function starP(x,y,s,col,w){var p=function(a){return [x+s*Math.cos(a),y+s*Math.sin(a)];},t1=[0,2,4].map(function(i){return p(-Math.PI/2+i*2*Math.PI/3);}),t2=[0,2,4].map(function(i){return p(Math.PI/2+i*2*Math.PI/3);});
    var f=function(t){return t.map(function(q){return q[0].toFixed(2)+','+q[1].toFixed(2);}).join(' ');};
    return '<polygon points="'+f(t1)+'" fill="none" stroke="'+col+'" stroke-width="'+w+'"/><polygon points="'+f(t2)+'" fill="none" stroke="'+col+'" stroke-width="'+w+'"/>';}
  var HS='fill="none" stroke="'+HALO+'" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round"';
  function haloPoly(pts){return '<polygon points="'+pts+'" '+HS+'/>';}
  function sym(t,x,y,r){
    var sw=Math.max(1,r*.09),w=Math.max(1,r*.14),s=r*.5,o=OUT;
    if(t==='oct'){var p=poly(8,r*1.07,Math.PI/8,x,y);return haloPoly(p)+'<polygon class="symShape" points="'+p+'" fill="#8C2A24" stroke="'+o+'" stroke-width="'+sw+'" stroke-linejoin="round"/>'+starP(x,y,s,CREAM,w);}
    if(t==='cir')return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" '+HS+'/><circle class="symShape" cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#E2B13C" stroke="'+o+'" stroke-width="'+sw+'"/>'+starP(x,y,s,'#3A2A08',w);
    if(t==='sq'){var a=r*.92,rp=(x-a)+','+(y-a)+' '+(x+a)+','+(y-a)+' '+(x+a)+','+(y+a)+' '+(x-a)+','+(y+a);return haloPoly(rp)+'<rect class="symShape" x="'+(x-a)+'" y="'+(y-a)+'" width="'+(2*a)+'" height="'+(2*a)+'" fill="#20272B" stroke="'+o+'" stroke-width="'+sw+'" stroke-linejoin="round"/>'+starP(x,y,s,CREAM,w);}
    if(t==='dia'){var d=poly(4,r*1.25,0,x,y);return haloPoly(d)+'<polygon class="symShape" points="'+d+'" fill="'+PURPLE+'" stroke="'+o+'" stroke-width="'+sw+'" stroke-linejoin="round"/>'+starP(x,y,s*.9,CREAM,w);}
    if(t==='splitI'){cid++;var idi='si'+cid,di=poly(4,r*1.25,0,x,y),cxx=x+r*.4,R2=r*.5,r2=r*.42,dx=r*.22;
      return haloPoly(di)+'<defs><clipPath id="L'+idi+'"><rect x="'+(x-r*1.4)+'" y="'+(y-r*1.4)+'" width="'+(r*1.4)+'" height="'+(r*2.8)+'"/></clipPath><mask id="M'+idi+'"><rect x="'+(x-r*2)+'" y="'+(y-r*2)+'" width="'+(r*4)+'" height="'+(r*4)+'" fill="#000"/><circle cx="'+cxx+'" cy="'+y+'" r="'+R2+'" fill="#fff"/><circle cx="'+(cxx+dx)+'" cy="'+y+'" r="'+r2+'" fill="#000"/></mask></defs>'+
        '<polygon points="'+di+'" fill="'+CREAM+'"/><polygon points="'+di+'" fill="'+PURPLE+'" clip-path="url(#L'+idi+')"/><polygon class="symShape" points="'+di+'" fill="none" stroke="'+o+'" stroke-width="'+sw+'" stroke-linejoin="round"/>'+
        '<g clip-path="url(#L'+idi+')">'+starP(x,y,r*.5*.9,CREAM,w)+'</g><rect x="'+(x-r*2)+'" y="'+(y-r*2)+'" width="'+(r*4)+'" height="'+(r*4)+'" fill="'+PURPLE+'" mask="url(#M'+idi+')"/>';}
    if(t==='split'){cid++;var id='sp'+cid,d2=poly(4,r*1.25,0,x,y);
      return haloPoly(d2)+'<defs><clipPath id="L'+id+'"><rect x="'+(x-r*1.4)+'" y="'+(y-r*1.4)+'" width="'+(r*1.4)+'" height="'+(r*2.8)+'"/></clipPath></defs><polygon points="'+d2+'" fill="'+CREAM+'"/><polygon points="'+d2+'" fill="'+PURPLE+'" clip-path="url(#L'+id+')"/><polygon class="symShape" points="'+d2+'" fill="none" stroke="'+o+'" stroke-width="'+sw+'" stroke-linejoin="round"/>'+
        '<g clip-path="url(#L'+id+')">'+starP(x,y,s*.9,CREAM,w)+'</g><rect x="'+(x+r*.28)+'" y="'+(y-r*.5)+'" width="'+(r*.2)+'" height="'+r+'" fill="'+PURPLE+'"/><rect x="'+(x+r*.1)+'" y="'+(y-r*.22)+'" width="'+(r*.56)+'" height="'+(r*.2)+'" fill="'+PURPLE+'"/>';}
    return '';
  }
  /* inner markup for the 36-unit box, centred on 0,0 */
  function box(t){return sym(t,0,0,R[t]);}
  function svg(t,px){px=px||30;return '<svg width="'+px+'" height="'+px+'" viewBox="-18 -18 36 36" aria-hidden="true">'+box(t)+'</svg>';}
  /* the six-symbol Map Key rows, agreed wording (Jeffrey 1 Nov). Built, but only shown when a page asks for it (see applyNewKey); the live labels stay until Dataset says which records get which symbol. */
  var SIX=[['oct','Pogrom or attack'],['cir','Holocaust'],['sq','Community destroyed'],['dia','<span>Forced conversion <small>(unknown)</small></span>'],['split','Forced conversion to Christianity'],['splitI','Forced conversion to Islam']];
  function newKeyRows(){return SIX.map(function(r){return '<div class="symrow">'+svg(r[0],30)+(r[1].charAt(0)==='<'?r[1]:r[1])+'</div>';}).join('');}
  function applyNewKey(key){if(!key)return;key.querySelectorAll('div').forEach(function(d){if(d.querySelector('svg[data-sym]'))d.remove();});
    var h=document.createElement('div');h.innerHTML=newKeyRows();while(h.firstChild)key.insertBefore(h.firstChild,null);}
  function fillStatic(){document.querySelectorAll('svg[data-sym]').forEach(function(s){s.innerHTML=box(s.getAttribute('data-sym'));});
    try{applyNewKey(document.getElementById('key'));}catch(e){}}
  window.SYM_ART={sym:sym,box:box,svg:svg,six:SIX,applyNewKey:applyNewKey,fill:fillStatic,R:R};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fillStatic);else fillStatic();
})();
