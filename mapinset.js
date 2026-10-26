/* High-resolution map insets for the flat maps (F-149 prototype). Used by movements.js and archaeology.js.
   images/inset/manifest.json lists regional pictures in the same Natural Earth projection as images/map-globe.webp, each with its box in map units.
   When you zoom in so far that the base picture would be enlarged baseScale times, and the box is on screen, the inset is drawn over the base picture.
   Insets are drawn lowest z first (z defaults to the order in the manifest), so a Tier 2 inset (z 1) sits under a Tier 1 inset (z 2). A soft edge is baked into each picture's alpha channel (see tools/build-inset.py feather).
   No manifest, a missing file or a failed load: nothing is drawn and the page looks exactly as before. See tools/build-inset.py.
   OJJInset.load() returns a promise of how many insets are ready; OJJInset.draw(svg,{x0,y0,NF,NE_XM,NE_YM,W,H}) draws the ones that apply (x0,y0 are the base picture's top-left on screen, NF is pixels per map unit). */
(function(){
'use strict';
var M=null,BAD={};
function load(){
  return fetch('images/inset/manifest.json').then(function(r){return r.ok?r.json():null;}).then(function(j){M=j&&j.insets&&j.insets.length?j:null;return M?M.insets.length:0;}).catch(function(){M=null;return 0;});
}
function draw(svg,c){
  if(!M)return 0;var basePx=M.baseWidthPx/(2*c.NE_XM),n=0;
  M.insets.map(function(s,i){return [s.z==null?i:s.z,i,s];}).sort(function(p,q){return p[0]-q[0]||p[1]-q[1];}).forEach(function(t){var s=t[2];
    if(BAD[s.id]||c.NF<s.baseScale*basePx)return;
    var x=c.x0+(s.x0+c.NE_XM)*c.NF,y=c.y0+(c.NE_YM-s.y1)*c.NF,w=(s.x1-s.x0)*c.NF,h=(s.y1-s.y0)*c.NF;
    if(x>c.W||y>c.H||x+w<0||y+h<0)return;
    var im=document.createElementNS('http://www.w3.org/2000/svg','image');
    im.setAttribute('href',s.file);im.setAttribute('x',x);im.setAttribute('y',y);im.setAttribute('width',w);im.setAttribute('height',h);im.setAttribute('preserveAspectRatio','none');im.setAttribute('data-inset',s.id);
    im.addEventListener('error',function(){BAD[s.id]=1;im.remove();});
    svg.appendChild(im);n++;
  });
  return n;
}
window.OJJInset={load:load,draw:draw};
})();
