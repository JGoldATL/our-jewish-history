/* High-resolution map insets for the flat maps (F-149 prototype). Used by movements.js and archaeology.js.
   images/inset/manifest.json lists regional pictures in the same Natural Earth projection as images/map-globe.webp, each with its box in map units.
   When you zoom in so far that the base picture would be enlarged baseScale times, and the box is on screen, the inset is drawn over the base picture.
   Insets are drawn lowest z first (z defaults to the order in the manifest), so a Tier 2 inset (z 1) sits under a Tier 1 inset (z 2). A soft edge is baked into each picture's alpha channel (see tools/build-inset.py feather).
   No manifest, a missing file or a failed load: nothing is drawn and the page looks exactly as before. See tools/build-inset.py.
   OJJInset.load() returns a promise of how many insets are ready; OJJInset.draw(svg,{x0,y0,NF,NE_XM,NE_YM,W,H}) draws the ones that apply (x0,y0 are the base picture's top-left on screen, NF is pixels per map unit). */
(function(){
'use strict';
var M=null,BAD={},WARM={};
/* F-159 cross-fade: an inset is fully drawn once the zoom reaches baseScale (as before). Over the last fadeBand (default 15 percent) of zoom before that it fades in from transparent, so the sharper picture eases in instead of switching on. */
var FADE_BAND=0.15;
function load(){
  return fetch('images/inset/manifest.json').then(function(r){return r.ok?r.json():null;}).then(function(j){M=j&&j.insets&&j.insets.length?j:null;return M?M.insets.length:0;}).catch(function(){M=null;return 0;});
}
function draw(svg,c){
  if(!M)return 0;var basePx=M.baseWidthPx/(2*c.NE_XM),n=0;
  M.insets.map(function(s,i){return [s.z==null?i:s.z,i,s];}).sort(function(p,q){return p[0]-q[0]||p[1]-q[1];}).forEach(function(t){var s=t[2];
    if(BAD[s.id])return;
    var band=s.fadeBand==null?FADE_BAND:s.fadeBand,r=c.NF/(s.baseScale*basePx),op=band>0?Math.max(0,Math.min(1,(r-(1-band))/band)):(r>=1?1:0);
    if(r>=1-2*band&&!WARM[s.id]){WARM[s.id]=1;try{(new Image()).src=s.file;}catch(e){}}   // load the picture just before it starts to fade in
    if(op<=0)return;op=op*op*(3-2*op);   // smoothstep
    var x=c.x0+(s.x0+c.NE_XM)*c.NF,y=c.y0+(c.NE_YM-s.y1)*c.NF,w=(s.x1-s.x0)*c.NF,h=(s.y1-s.y0)*c.NF;
    if(x>c.W||y>c.H||x+w<0||y+h<0)return;
    var im=document.createElementNS('http://www.w3.org/2000/svg','image');
    im.setAttribute('href',s.file);im.setAttribute('x',x);im.setAttribute('y',y);im.setAttribute('width',w);im.setAttribute('height',h);im.setAttribute('preserveAspectRatio','none');im.setAttribute('data-inset',s.id);if(op<1)im.setAttribute('opacity',op.toFixed(3));
    im.addEventListener('error',function(){BAD[s.id]=1;im.remove();});
    svg.appendChild(im);n++;
    if(MIX>0){var m=document.createElementNS('http://www.w3.org/2000/svg','image');   // M1 Satellite copy on top, faded in with the base map
      ['x','y','width','height'].forEach(function(k){m.setAttribute(k,im.getAttribute(k));});m.setAttribute('href',s.file.replace('images/inset/','images/m1/inset/'));m.setAttribute('preserveAspectRatio','none');m.setAttribute('opacity',(op*MIX).toFixed(3));svg.appendChild(m);}
  });
  return n;
}
/* M1 Satellite base map (3 Nov): the aged picture shows before 1898; from 1898 the M1 picture fades in over about 0.7 s (DECIDED 1 Nov). Used by movements.js. */
var MIX=0,TARGET=0,RAF=0,LAST=0,READY=0,LOADING=false,REDRAW=null,FADE_S=0.7,M1_FROM=1898,M1_BASE='images/m1/map-globe.webp';
function preload(){if(LOADING)return;LOADING=true;var n=0,files=[M1_BASE].concat((M&&M.insets||[]).map(function(s){return s.file.replace('images/inset/','images/m1/inset/');}));
  files.forEach(function(f){var i=new Image();i.onload=i.onerror=function(){if(++n===files.length){READY=1;kick();}};i.src=f;});}
function kick(){if(RAF||!READY)return;LAST=performance.now();RAF=requestAnimationFrame(step);}
function step(t){RAF=0;var dt=Math.max(0,(t-LAST)/1000);LAST=t;var dir=Math.sign(TARGET-MIX);if(!dir)return;MIX=Math.max(0,Math.min(1,MIX+dir*dt/FADE_S));if((dir>0&&MIX>=TARGET)||(dir<0&&MIX<=TARGET))MIX=TARGET;if(REDRAW)REDRAW();if(MIX!==TARGET)RAF=requestAnimationFrame(step);}
function setYear(y,redraw){REDRAW=redraw;var w=y>=M1_FROM?1:0;if(w)preload();if(w===TARGET)return;TARGET=w;kick();}
function base(svg,c,aged){var a=document.createElementNS('http://www.w3.org/2000/svg','image'),p={href:aged,x:c.x0,y:c.y0,width:2*c.NE_XM*c.NF,height:2*c.NE_YM*c.NF,preserveAspectRatio:'none'};
  Object.keys(p).forEach(function(k){a.setAttribute(k,p[k]);});svg.appendChild(a);
  if(MIX>0){var m=a.cloneNode();m.setAttribute('href',M1_BASE);m.setAttribute('opacity',MIX.toFixed(3));svg.appendChild(m);}}
window.OJJInset={load:load,draw:draw,base:base,setYear:setYear};
})();
