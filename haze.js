'use strict';
/* F-021 "Islamic Conquest": the spread of Muslim rule as a soft haze on a globe, one wave at a time.
   Data: data/haze.json (written by tools/sheet-to-haze.py once Dataset's anchor table and wave cards are signed off; until then a MOCK file).
   Look (Jeffrey, 2026-10-31): haze colour E (moss green, provisional), cool land, punchy edge, organic shapes, camera follows the haze.
   The slider position is a wave index (0 to n-1) so every wave gets the same room; the year readout is interpolated between wave years. */
const $=id=>document.getElementById(id);
const D2R=Math.PI/180;
const HAZE=[0.373,0.478,0.333];            // #5F7A55, provisional: Creative Design sets the final green
let DATA=null,SNAP=[],ANCH=[],pos=0,auto=true,timer=null;
const view={lon:40,lat:28,deg:30,R:0,baseR:0,cx:0,cy:0};

/* ---------- globe (copied from app.js and haze-test.html; see the feasibility note on why it is copied, not shared) ---------- */
const VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FS=`precision highp float;
uniform vec2 uC;uniform float uR;uniform vec2 uCen;uniform float uK;uniform sampler2D uW;uniform sampler2D uG;uniform vec4 uGB;uniform float uDpr;uniform vec2 uSize;uniform sampler2D uWash;uniform vec3 uHaze;
void main(){
 vec2 px=vec2(gl_FragCoord.x,uSize.y-gl_FragCoord.y)/uDpr;
 vec2 d=(px-uC)/uR;float r=length(d);
 if(r>1.0){gl_FragColor=vec4(0.);return;}
 float dp=asin(min(r,1.0));float del=dp/uK;float th=atan(d.x,-d.y);
 float p0=uCen.y,l0=uCen.x;
 float lat=asin(sin(p0)*cos(del)+cos(p0)*sin(del)*cos(th));
 float lon=l0+atan(sin(th)*sin(del)*cos(p0),cos(del)-sin(p0)*sin(lat));
 float LON=degrees(lon),LAT=degrees(lat);
 LON=mod(LON+180.,360.)-180.;
 vec3 col;
 if(LON>=uGB.x&&LON<=uGB.y&&LAT>=uGB.z&&LAT<=uGB.w){col=texture2D(uG,vec2((LON-uGB.x)/(uGB.y-uGB.x),(uGB.w-LAT)/(uGB.w-uGB.z))).rgb;}
 else{col=texture2D(uW,vec2((LON+180.)/360.,(90.-LAT)/180.)).rgb;}
 float land=smoothstep(0.07,0.0,col.b-col.r);
 float wa=texture2D(uWash,vec2(gl_FragCoord.x/uSize.x,1.-gl_FragCoord.y/uSize.y)).a;
 float lum=dot(col,vec3(.3,.59,.11));col=mix(col,vec3(lum)*vec3(.90,.98,1.06),land*.6);   // cool land on this page only
 float ha=wa*land;float hs=clamp(ha*1.05,0.,0.8);col=mix(col,uHaze,hs);                    // 0.8 is Jeffrey's approved cap
 float L2=dot(col,vec3(.3,.59,.11));col=clamp(mix(vec3(L2),col,1.+1.1*hs),0.,1.);           // punchy: keep the haze colour saturated
 float nz=fract(sin(dot(floor(gl_FragCoord.xy/(uDpr*2.)),vec2(12.9898,78.233)))*43758.5453);
 if(nz<ha*0.35)col+=0.05;                                                                   // fine dot texture: meaning does not rest on colour alone
 vec3 n=vec3(d.x,-d.y,sqrt(max(0.,1.-r*r)));
 vec3 L=normalize(vec3(-.45,.55,.75));
 float diff=.62+.48*max(dot(n,L),0.);
 float limb=1.-.55*pow(r,3.2);
 col*=diff*limb;
 float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),24.)*.10;
 col+=spec;
 float a=clamp((1.-r)*uR*uDpr,0.,1.);
 gl_FragColor=vec4(col*a,a);
}`;
let gl,uni={},texReady=0,washTex;const wc=document.createElement('canvas'),wx=wc.getContext('2d');
function initGL(){
  const c=$('gl');gl=c.getContext('webgl',{premultipliedAlpha:true,antialias:true});if(!gl)throw new Error('WebGL is not available in this browser.');
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
  const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);gl.useProgram(p);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  for(const n of ['uC','uR','uCen','uK','uW','uG','uGB','uDpr','uSize','uWash','uHaze'])uni[n]=gl.getUniformLocation(p,n);
  gl.uniform1i(uni.uW,0);gl.uniform1i(uni.uG,1);gl.uniform1i(uni.uWash,2);gl.uniform4f(uni.uGB,-20,80,0,60);
  washTex=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,washTex);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
  loadTex('images/tex-world.jpg',0,true);loadTex('images/tex-region.jpg',1,false);
}
function loadTex(src,unit,wrap,tries){tries=tries||0;const img=new Image();img.onerror=()=>{if(tries<3)setTimeout(()=>loadTex(src,unit,wrap,tries+1),1500*(tries+1));};
  img.onload=()=>{gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);texReady++;draw();};img.src=src;}
function project(lon,lat){
  const l0=view.lon*D2R,p0=view.lat*D2R,l=lon*D2R,p=lat*D2R;
  const cosd=Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(l-l0);
  const d=Math.acos(Math.max(-1,Math.min(1,cosd)));
  const th=Math.atan2(Math.sin(l-l0)*Math.cos(p),Math.cos(p0)*Math.sin(p)-Math.sin(p0)*Math.cos(p)*Math.cos(l-l0));
  const dp=d*90/view.deg,r=Math.sin(Math.min(dp,Math.PI/2));
  return {x:view.cx+view.R*r*Math.sin(th),y:view.cy-view.R*r*Math.cos(th),vis:dp<Math.PI/2};
}

/* ---------- haze: anchors interpolated between waves, drawn as clusters of soft lobes ---------- */
const ease=t=>t*t*(3-2*t);
function stateAt(a,p){
  const i=Math.max(0,Math.min(SNAP.length-2,Math.floor(p))),t=ease(Math.max(0,Math.min(1,p-i))),A=a.s[i],B=a.s[i+1];
  const rA=A[1]?A[0]:B[0],rB=B[1]?B[0]:A[0];   // an anchor on only one side keeps that side's radius and fades in place
  return {km:rA+(rB-rA)*t,k:(A[1]+(B[1]-A[1])*t)/5};
}
function rng(n){return()=>{n|=0;n=n+0x6D2B79F5|0;let t=Math.imul(n^n>>>15,1|n);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function lobesFor(a,i){if(a._lobes)return a._lobes;const r=rng(i*7919+13),L=[],tilt=r()*Math.PI,wide=.85+r()*.5;
  L.push({dx:0,dy:0,r:.62+r()*.12,sx:1.1+r()*.4,rot:tilt});
  for(let k=0;k<5;k++){const ang=r()*Math.PI*2,d=.28+r()*.4;L.push({dx:Math.cos(ang)*d*wide,dy:Math.sin(ang)*d/wide,r:.38+r()*.34,sx:.7+r()*.8,rot:r()*Math.PI});}
  a._lobes=L;return L;}
function lobe(x,y,rad,sx,rot,m){const r=Math.max(2,rad);wx.save();wx.translate(x,y);wx.rotate(rot);wx.scale(sx,1);
  const g=wx.createRadialGradient(0,0,0,0,0,r);for(const [o,f] of [[0,1],[.5,.92],[.8,.5]])g.addColorStop(o,`rgba(255,255,255,${m*f})`);g.addColorStop(1,'rgba(255,255,255,0)');
  wx.fillStyle=g;wx.fillRect(-r,-r,r*2,r*2);wx.restore();}
function drawWash(p){
  const c=$('gl'),w=Math.round(c.clientWidth/2),h=Math.round(c.clientHeight/2);if(wc.width!==w||wc.height!==h){wc.width=w;wc.height=h;}
  wx.clearRect(0,0,w,h);wx.globalCompositeOperation='lighter';
  ANCH.forEach((a,i)=>{
    const s=stateAt(a,p);if(s.k<=0.005)return;const q=project(a.lon,a.lat);if(!q.vis)return;
    const rad=Math.max(34,view.R*Math.sin(Math.min(Math.PI/2,s.km/6371*90/view.deg)))/2;   // km to half-size canvas px; 34 is the minimum on-screen softness
    const x=q.x/2,y=q.y/2,m=.8*Math.min(1,s.k/.2)*(.4+.6*s.k);                                // a present anchor starts at 40 percent strength
    for(const l of lobesFor(a,i))lobe(x+l.dx*rad,y+l.dy*rad,l.r*rad*1.25,l.sx,l.rot,m*.42);
  });
}
function draw(){
  if(!gl||texReady<2||!SNAP.length)return;const c=$('gl'),dpr=Math.min(2,window.devicePixelRatio||1),w=c.clientWidth,h=c.clientHeight;
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  view.cx=w/2;view.cy=h/2;view.baseR=Math.max(w*0.95,h*0.62);view.R=view.baseR;
  drawWash(pos);
  gl.viewport(0,0,c.width,c.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uni.uC,view.cx,view.cy);gl.uniform1f(uni.uR,view.R);gl.uniform2f(uni.uCen,view.lon*D2R,view.lat*D2R);gl.uniform1f(uni.uK,90/view.deg);gl.uniform1f(uni.uDpr,dpr);gl.uniform2f(uni.uSize,c.width,c.height);
  gl.uniform3fv(uni.uHaze,HAZE);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,washTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,wc);
  gl.drawArrays(gl.TRIANGLES,0,6);
}

/* ---------- follow camera: centre on the strong anchors, widen until every one is on screen (limit 84 degrees) ---------- */
function camTarget(p){
  const act=[];for(const a of ANCH){const s=stateAt(a,p);if(s.k>0.3)act.push(a);}
  if(!act.length)return null;
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const a of act){x0=Math.min(x0,a.lon);x1=Math.max(x1,a.lon);y0=Math.min(y0,a.lat);y1=Math.max(y1,a.lat);}
  const lon=(x0+x1)/2,lat=Math.max(-60,Math.min(70,(y0+y1)/2)),sv={lon:view.lon,lat:view.lat,deg:view.deg},c=$('gl'),w=c.clientWidth||390,h=c.clientHeight||420,m=36;
  if(!view.R){view.cx=w/2;view.cy=h/2;view.baseR=Math.max(w*0.95,h*0.62);view.R=view.baseR;}
  let deg=84;view.lon=lon;view.lat=lat;
  for(let d=20;d<=84;d+=2){view.deg=d;let ok=true;for(const a of act){const q=project(a.lon,a.lat);if(!q.vis||q.x<m||q.x>w-m||q.y<m||q.y>h-m-30){ok=false;break;}}if(ok){deg=d;break;}}
  view.lon=sv.lon;view.lat=sv.lat;view.deg=sv.deg;
  return {lon,lat,deg};
}
let lastF=0;
function frame(t){const dt=Math.min(.1,(t-lastF)/1000);lastF=t;
  if(auto){const g=camTarget(pos);if(g){const k=1-Math.exp(-dt*3),dl=((g.lon-view.lon+540)%360)-180,nl=view.lon+dl*k,nla=view.lat+(g.lat-view.lat)*k,nd=view.deg+(g.deg-view.deg)*k;
    if(Math.abs(nl-view.lon)+Math.abs(nla-view.lat)+Math.abs(nd-view.deg)>0.002){view.lon=nl;view.lat=nla;view.deg=nd;draw();}}}
  requestAnimationFrame(frame);}

/* ---------- controls and card ---------- */
const yearAt=p=>{const i=Math.max(0,Math.min(SNAP.length-2,Math.floor(p))),t=Math.max(0,Math.min(1,p-i));return SNAP[i].year+(SNAP[i+1].year-SNAP[i].year)*t;};
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
let shown=-1;
function showCard(){const i=Math.max(0,Math.min(SNAP.length-1,Math.round(pos)));if(i===shown)return;shown=i;const s=SNAP[i];
  $('card').innerHTML='<div class="k">Wave '+(i+1)+' of '+SNAP.length+' · '+esc(s.period)+'</div><h2>'+esc(s.label)+'</h2><p>'+esc(s.summary)+'</p><h3>What it meant for Jewish communities</h3><p>'+esc(s.jewish)+'</p><h3>Sources</h3><ul>'+s.sources.map(x=>'<li>'+esc(x.name)+(x.url?' | <a href="'+esc(x.url)+'" rel="noopener">'+esc(x.url)+'</a>':'')+'</li>').join('')+'</ul>';
  document.querySelectorAll('.tick').forEach((t,k)=>t.setAttribute('aria-current',k===i?'true':'false'));}
function setPos(p,fromUser){pos=Math.max(0,Math.min(SNAP.length-1,p));$('sl').value=pos;$('yr').textContent=String(Math.round(yearAt(pos)));showCard();draw();}
function stop(){if(timer){cancelAnimationFrame(timer);timer=null;}$('play').textContent='Play';}
function tick(t){const dt=Math.min(.1,(t-last)/1000);last=t;const p=pos+dt*(SNAP.length-1)/14;   // about 14 seconds end to end (a starting guess to tune on a phone)
  if(p>=SNAP.length-1){setPos(SNAP.length-1);stop();return;}setPos(p);timer=requestAnimationFrame(tick);}
let last=0;
function wire(){
  const n=SNAP.length,LABELLED=new Set(n<8?SNAP.map((_,i)=>i):[0,Math.round((n-1)/3),Math.round((n-1)*2/3),Math.round((n-1)*5/6),n-1]);   // first, last and a few between, so the labels never crowd
  $('sl').max=SNAP.length-1;
  const mk=()=>{const W=$('ticks').clientWidth||250,max=Math.max(2,Math.floor(W/48)),pick=new Set([0,n-1]);for(let k=1;k<max-1;k++)pick.add(Math.round(k*(n-1)/(max-1)));document.querySelectorAll('.tick').forEach((t,i)=>{t.textContent=pick.has(i)?SNAP[i].year:'·';});};
  $('ticks').innerHTML=SNAP.map((s,i)=>'<button type="button" class="tick" data-i="'+i+'" style="left:'+(i/(SNAP.length-1)*100)+'%" aria-label="Wave '+(i+1)+': '+s.year+'">'+(LABELLED.has(i)?s.year:'·')+'</button>').join('');
  mk();window.addEventListener('resize',mk);
  $('ticks').addEventListener('click',e=>{const b=e.target.closest('.tick');if(!b)return;stop();auto=true;setPos(+b.dataset.i);});
  $('sl').addEventListener('input',e=>{stop();auto=true;setPos(+e.target.value);});
  $('play').addEventListener('click',()=>{if(timer){stop();return;}if(pos>=SNAP.length-1)pos=0;auto=true;$('play').textContent='Pause';last=performance.now();timer=requestAnimationFrame(tick);});
  const cv=$('gl'),ptrs=new Map();let pinch=0;
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0;});
  cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;auto=false;
    if(ptrs.size===1){const dpp=1/(view.R*90/view.deg)/D2R;view.lon-=(e.clientX-p.x)*dpp/Math.max(.2,Math.cos(view.lat*D2R));view.lat=Math.max(-70,Math.min(80,view.lat+(e.clientY-p.y)*dpp));p.x=e.clientX;p.y=e.clientY;}
    else{p.x=e.clientX;p.y=e.clientY;const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)view.deg=Math.max(14,Math.min(84,view.deg*pinch/d));pinch=d;}
    draw();});
  const up=e=>{ptrs.delete(e.pointerId);pinch=0;};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{e.preventDefault();auto=false;view.deg=Math.max(14,Math.min(84,view.deg*(e.deltaY<0?1/1.1:1.1)));draw();},{passive:false});
  window.addEventListener('resize',draw);
}
function fail(m){const e=$('msg');e.hidden=false;e.textContent=m;$('hz').hidden=true;}
function check(d){   // reports problems, never fixes them (same stance as the loaders)
  if(!d||!Array.isArray(d.snapshots)||d.snapshots.length<2||!Array.isArray(d.anchors))throw new Error('haze.json is missing snapshots or anchors');
  for(const a of d.anchors){if(!(a.lat>=-90&&a.lat<=90&&a.lon>=-180&&a.lon<=180))throw new Error('Bad latitude or longitude on '+a.id);if(!Array.isArray(a.s)||a.s.length!==d.snapshots.length)throw new Error('Anchor '+a.id+' does not have one entry per wave');}
}
(async()=>{
  try{
    const r=await fetch('data/haze.json');if(!r.ok)throw new Error('Could not load data/haze.json');DATA=await r.json();check(DATA);
    SNAP=DATA.snapshots;ANCH=DATA.anchors;
    $('mock').hidden=!DATA.mock;
    window.SITE_DATA_VERSION=DATA.mock?'mock':(((DATA.source||'').match(/v\d+(?:\.\d+)+/)||['unknown'])[0]);
    $('version').textContent='v'+(window.SITE_VERSION||'')+'; data '+window.SITE_DATA_VERSION;
    wire();initGL();const g=camTarget(0);if(g){view.lon=g.lon;view.lat=g.lat;view.deg=g.deg;}setPos(0);requestAnimationFrame(frame);
  }catch(e){fail('This page could not load: '+e.message);}
})();
