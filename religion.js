'use strict';
/* F-166 combined religious-spread map (UNLISTED DRAFT PAGE religion-draft.html): Islam, Christianity (Judaism waits for Dataset's tabs) on one flat world map.
   Jeffrey, 5 Nov: flat map; haze stays on once drawn (cumulative); each layer on its own or all together; one shared year slider; Previous and Next beside Play.
   Design's ruling (handoffs/CreativeDesign-to-Build-Combined-Religion-Map-Colour-Ruling-2026-11-05.txt, PROPOSED, Design's recommended defaults used until Jeffrey answers):
   stack order bottom to top Islam, Christianity, Judaism; every layer's alpha cap 0.6 when more than one is on (Islam alone .88 as on the live page, others .8 alone);
   where two layers overlap the pair is drawn as fine 45 degree stripes of their own colours; Islam keeps its faint dots, Christianity (gold) has no texture, Judaism faint vertical lines;
   Christianity is ONE gold colour (the branch pair needs the Group column, v3); a small cream "Draft" chip replaces the red banner.
   A flat-only copy of the haze.js engine (haze.js itself is untouched and still serves the public Islamic Rule page). */
const $=id=>document.getElementById(id);
const D2R=Math.PI/180;
const LAYERS=[
  {id:'islam',name:'Islam',file:'data/haze.json',col:[.306,.439,.282],tex:'dots',aloneCap:.88},   // locked Islam green #4E7048
  {id:'christ',name:'Christianity',file:'data/christianity-draft.json',col:[.910,.725,.137],tex:'none',aloneCap:.8,draft:true},   // gold #E8B923
  {id:'jew',name:'Judaism',file:'data/judaism-draft.json',col:[.239,.510,.831],tex:'lines',aloneCap:.8,draft:true,optional:true,noCarry:true},   // blue #3D82D4 (Design, proposed); Dataset's tabs not built yet, the layer switches on when data/judaism-draft.json exists
];
// Shared slider (Jeffrey and Dataset, 5 Nov): 8 stops. Each layer shows its latest wave up to the chosen stop. Jewish waves outside those stops (the ancient waves and 1950) become extra stops.
const BASE_STOPS=[400,700,1000,1200,1500,1700,1900,2000];
let STOPS=[],pos=0,auto=true,timer=null,cover=true,holdUntil=0,last=0;
const view={lon:10,lat:30,cx:0,cy:0,sc:1};

/* ---------- shader: the flat world, cool land, up to three haze layers ---------- */
const VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FS=`precision highp float;
uniform vec2 uC;uniform float uR;uniform vec2 uCen;uniform sampler2D uW;uniform sampler2D uG;uniform vec4 uGB;uniform float uDpr;uniform vec2 uSize;
uniform sampler2D uW0;uniform sampler2D uW1;uniform sampler2D uW2;uniform vec3 uK0;uniform vec3 uK1;uniform vec3 uK2;uniform vec3 uOn;uniform vec3 uCap;
void main(){
 vec2 px=vec2(gl_FragCoord.x,uSize.y-gl_FragCoord.y)/uDpr;
 vec2 d=(px-uC)/uR;
 float LON=degrees(uCen.x)+d.x,LAT=degrees(uCen.y)-d.y;
 if(abs(LAT)>84.){gl_FragColor=vec4(0.);return;}
 LON=mod(LON+180.,360.)-180.;
 vec3 col;
 if(LON>=uGB.x&&LON<=uGB.y&&LAT>=uGB.z&&LAT<=uGB.w){col=texture2D(uG,vec2((LON-uGB.x)/(uGB.y-uGB.x),(uGB.w-LAT)/(uGB.w-uGB.z))).rgb;}
 else{col=texture2D(uW,vec2((LON+180.)/360.,(90.-LAT)/180.)).rgb;}
 float land=smoothstep(0.07,0.0,col.b-col.r);
 vec2 wuv=vec2(gl_FragCoord.x/uSize.x,1.-gl_FragCoord.y/uSize.y);
 float lum=dot(col,vec3(.3,.59,.11));col=mix(col,vec3(lum),land*.32);col*=mix(vec3(1.),vec3(.96,.99,1.02),land);   // cool land (Creative Design)
 vec3 base=col;
 float a0=clamp(texture2D(uW0,wuv).a*land*1.05,0.,uCap.x)*uOn.x;
 float a1=clamp(texture2D(uW1,wuv).a*land*1.05,0.,uCap.y)*uOn.y;
 float a2=clamp(texture2D(uW2,wuv).a*land*1.05,0.,uCap.z)*uOn.z;
 col=mix(col,uK0,a0);col=mix(col,uK1,a1);col=mix(col,uK2,a2);                               // bottom to top: Islam, Christianity, Judaism
 float st=step(fract((gl_FragCoord.x+gl_FragCoord.y)/(6.*uDpr)),.5);                        // overlaps: fine 45 degree stripes of the two colours, so the pair reads by pattern
 float o01=smoothstep(.10,.28,min(a0,a1)),o12=smoothstep(.10,.28,min(a1,a2)),o02=smoothstep(.10,.28,min(a0,a2));
 col=mix(col,mix(base,mix(uK0,uK1,st),max(a0,a1)),o01);
 col=mix(col,mix(base,mix(uK1,uK2,st),max(a1,a2)),o12);
 col=mix(col,mix(base,mix(uK0,uK2,st),max(a0,a2)),o02);
 float hs=max(a0,max(a1,a2));
 float L2=dot(col,vec3(.3,.59,.11));col=clamp(mix(vec3(L2),col,1.+.9*hs),0.,1.);             // punchy
 float nz=fract(sin(dot(floor(gl_FragCoord.xy/(uDpr*2.)),vec2(12.9898,78.233)))*43758.5453);
 if(nz<a0*0.35)col+=0.05;                                                                    // Islam: faint fine dots (locked look)
 if(a2>.1&&fract(gl_FragCoord.x/(5.*uDpr))<.2)col-=.035;                                     // Judaism: faint fine vertical lines
 gl_FragColor=vec4(col,1.);
}`;
let gl,uni={},texReady=0;
function initGL(){
  const c=$('gl');gl=c.getContext('webgl',{premultipliedAlpha:true,antialias:true});if(!gl)throw new Error('WebGL is not available in this browser.');
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
  const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);gl.useProgram(p);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  for(const n of ['uC','uR','uCen','uW','uG','uGB','uDpr','uSize','uW0','uW1','uW2','uK0','uK1','uK2','uOn','uCap'])uni[n]=gl.getUniformLocation(p,n);
  gl.uniform1i(uni.uW,0);gl.uniform1i(uni.uG,1);gl.uniform1i(uni.uW0,2);gl.uniform1i(uni.uW1,3);gl.uniform1i(uni.uW2,4);gl.uniform4f(uni.uGB,-20,80,0,60);
  for(const u of [2,3,4]){gl.activeTexture(gl.TEXTURE0+u);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
    for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);LAYERS[u-2]&&(LAYERS[u-2].tex2=t);}
  loadTex('images/m1/tex-world.jpg',0,true);loadTex('images/m1/tex-region.jpg',1,false);
}
function loadTex(src,unit,wrap,tries){tries=tries||0;const img=new Image();img.onerror=()=>{if(tries<3)setTimeout(()=>loadTex(src,unit,wrap,tries+1),1500*(tries+1));};
  img.onload=()=>{gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);texReady++;draw();};img.src=src;}
function project(lon,lat){const dx=((lon-view.lon+540)%360+360)%360-180;return {x:view.cx+dx*view.sc,y:view.cy-(lat-view.lat)*view.sc};}

/* ---------- layers: years, positions, haze state ---------- */
const ease=t=>t*t*(3-2*t);
const yearLabel=y=>y<0?(-y)+' BCE':String(y);
function idxAt(L,stop){let k=-1;for(let i=0;i<L.years.length;i++)if(L.years[i]<=stop)k=i;return k;}   // latest wave up to a stop; -1 before the layer's first wave
function layerState(L,p){   // {lp, fade}: the layer's fractional wave index at a slider position, or null before it starts
  const n=STOPS.length,k=Math.max(0,Math.min(n-2,Math.floor(p))),t=Math.max(0,Math.min(1,p-k)),a=idxAt(L,STOPS[k]),b=idxAt(L,STOPS[k+1]);
  if(a<0&&b<0)return null;if(a<0)return {lp:b,fade:t};return {lp:a+(b-a)*t,fade:1};}
function stateAt(L,a,p){
  if(p<0)return {km:0,k:0};
  const n=L.snaps.length,i=Math.max(0,Math.min(n-2,Math.floor(p))),t=ease(Math.max(0,Math.min(1,p-i))),A=a.s[i],B=a.s[i+1];
  const rA=A[1]?A[0]:B[0],rB=B[1]?B[0]:A[0];
  return {km:rA+(rB-rA)*t,k:(A[1]+(B[1]-A[1])*t)/5};
}
function rng(n){return()=>{n|=0;n=n+0x6D2B79F5|0;let t=Math.imul(n^n>>>15,1|n);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function lobesFor(a,i){if(a._lobes)return a._lobes;const r=rng(i*7919+13),L=[],tilt=r()*Math.PI,wide=.85+r()*.5;
  L.push({dx:0,dy:0,r:.62+r()*.12,sx:1.1+r()*.4,rot:tilt});
  for(let k=0;k<5;k++){const ang=r()*Math.PI*2,d=.28+r()*.4;L.push({dx:Math.cos(ang)*d*wide,dy:Math.sin(ang)*d/wide,r:.38+r()*.34,sx:.7+r()*.8,rot:r()*Math.PI});}
  a._lobes=L;return L;}
function lobe(wx,x,y,rad,sx,rot,m){const r=Math.max(2,rad);wx.save();wx.translate(x,y);wx.rotate(rot);wx.scale(sx,1);
  const g=wx.createRadialGradient(0,0,0,0,0,r);for(const [o,f] of [[0,1],[.5,.92],[.8,.5]])g.addColorStop(o,`rgba(255,255,255,${m*f})`);g.addColorStop(1,'rgba(255,255,255,0)');
  wx.fillStyle=g;wx.fillRect(-r,-r,r*2,r*2);wx.restore();}
function drawWash(L,st){const lp=st.lp;
  const c=$('gl'),w=Math.round(c.clientWidth/2),h=Math.round(c.clientHeight/2);if(L.cv.width!==w||L.cv.height!==h){L.cv.width=w;L.cv.height=h;}
  const wx=L.cx2;wx.clearRect(0,0,w,h);wx.globalCompositeOperation='lighter';
  L.anch.forEach((a,i)=>{const s=stateAt(L,a,lp);s.k*=st.fade;if(s.k<=0.005)return;const q=project(a.lon,a.lat);
    const rad=Math.max(34,view.sc*s.km/111)/2,x=q.x/2,y=q.y/2,m=.8*Math.min(1,s.k/.2)*(.4+.6*s.k);
    for(const l of lobesFor(a,i))lobe(wx,x+l.dx*rad,y+l.dy*rad,l.r*rad*1.25,l.sx,l.rot,m*.42);});
}
const active=()=>LAYERS.filter(L=>L.on);
function capFor(L){return active().length>1?.6:L.aloneCap;}


/* ---------- draw ---------- */
function draw(){
  if(!gl||texReady<2||!STOPS.length)return;const c=$('gl'),dpr=Math.min(2,window.devicePixelRatio||1),w=c.clientWidth,h=c.clientHeight;
  if(cover){view.sc=Math.max(w/360,Math.min(w/300,h/170));view.lon=10;view.lat=22;}
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  view.cx=w/2;view.cy=h/2;
  const on=[0,0,0],cap=[.8,.8,.8];
  LAYERS.forEach((L,i)=>{const st=L.on&&layerState(L,pos);if(st){on[i]=1;cap[i]=capFor(L);drawWash(L,st);gl.activeTexture(gl.TEXTURE2+i);gl.bindTexture(gl.TEXTURE_2D,L.tex2);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,L.cv);}});
  gl.viewport(0,0,c.width,c.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uni.uC,view.cx,view.cy);gl.uniform1f(uni.uR,view.sc);gl.uniform2f(uni.uCen,view.lon*D2R,view.lat*D2R);gl.uniform1f(uni.uDpr,dpr);gl.uniform2f(uni.uSize,c.width,c.height);
  gl.uniform3fv(uni.uK0,LAYERS[0].col);gl.uniform3fv(uni.uK1,LAYERS[1].col);gl.uniform3fv(uni.uK2,LAYERS[2].col);gl.uniform3f(uni.uOn,on[0],on[1],on[2]);gl.uniform3f(uni.uCap,cap[0],cap[1],cap[2]);
  gl.drawArrays(gl.TRIANGLES,0,6);
}
function camTarget(){
  const act=[];for(const L of active()){const st=layerState(L,pos);if(!st)continue;for(const a of L.anch)if(stateAt(L,a,st.lp).k*st.fade>0.3)act.push(a);}
  if(!act.length)return null;const c=$('gl'),w=c.clientWidth||390,h=c.clientHeight||420;
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const a of act){x0=Math.min(x0,a.lon);x1=Math.max(x1,a.lon);y0=Math.min(y0,a.lat);y1=Math.max(y1,a.lat);}
  const spanX=Math.max(30,x1-x0+44),spanY=Math.max(20,y1-y0+32);
  return {lon:(x0+x1)/2,lat:Math.max(-60,Math.min(70,(y0+y1)/2)),sc:Math.max(w/360,Math.min(6,w/spanX,(h-30)/spanY))};
}
function frame(t){const dt=Math.min(.1,(t-(frame.l||t))/1000);frame.l=t;
  if(auto){const g=camTarget();if(g){const k=1-Math.exp(-dt*3),nl=view.lon+(g.lon-view.lon)*k,nla=view.lat+(g.lat-view.lat)*k,ns=view.sc*Math.pow(g.sc/view.sc,k);
    if(Math.abs(nl-view.lon)+Math.abs(nla-view.lat)+Math.abs(Math.log(ns/view.sc))*50>0.002){view.lon=nl;view.lat=nla;view.sc=ns;draw();}}}
  requestAnimationFrame(frame);}

/* ---------- cards, key chips, controls ---------- */
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const hex=c=>'#'+c.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
let cardKey='';
function showCards(){
  const stop=STOPS[Math.round(pos)],parts=[],keyp=[];
  for(const L of active()){const i=idxAt(L,stop);if(i<0)continue;keyp.push(L.id+i);const s=L.snaps[i];
    parts.push('<section class="lc" style="--lc:'+hex(L.col)+'"><div class="lh"><i></i>'+esc(L.name)+'</div><div class="k">Wave '+(i+1)+' of '+L.snaps.length+' · '+esc(s.period)+'</div><h2>'+esc(s.title||s.label)+'</h2><p>'+esc(s.summary)+'</p>'
      +(s.note?'<p class="nbc">'+esc(s.note)+'</p>':'')+(s.spread&&s.spread.text?'<h3>How '+esc(L.name)+' spread</h3><p>'+esc(s.spread.text)+'</p>':'')
      +'<h3>What it meant for Jewish communities</h3><p>'+esc(s.jewish)+'</p>'+(L.draft?'<p class="draftchip">Draft: sources under review</p>':'')+'</section>');}
  const k=keyp.join('|');if(k===cardKey)return;cardKey=k;
  $('card').innerHTML=parts.length?parts.join(''):'<p>Nothing is drawn yet for the layers that are on at this year. Move the slider forward.</p>';
  const lab=$('cap');if(lab)lab.textContent=active().filter(L=>idxAt(L,stop)>=0).map(L=>L.snaps[idxAt(L,stop)].label).join(' · ');
}
function syncChips(){
  document.querySelectorAll('.chip[data-l]').forEach(b=>{const L=LAYERS.find(x=>x.id===b.dataset.l);b.setAttribute('aria-pressed',L.on?'true':'false');});
  $('draftbadge').hidden=!LAYERS.some(L=>L.draft&&L.on);
}
function setPos(p){const n=STOPS.length;pos=Math.max(0,Math.min(n-1,p));$('sl').value=pos;$('yr').textContent=yearLabel(STOPS[Math.round(pos)]);
  $('prev').disabled=Math.round(pos)<=0;$('next').disabled=Math.round(pos)>=n-1;
  document.querySelectorAll('.tick').forEach((t,k)=>t.setAttribute('aria-current',k===Math.round(pos)?'true':'false'));showCards();draw();}
function stop(){if(timer){cancelAnimationFrame(timer);timer=null;}$('play').textContent='Play';}
const PLAY_MS=20000,HOLD_MS=1500;   // same pace as the Events and Islamic Rule pages
function tick(t){const dt=Math.min(.1,(t-last)/1000);last=t;
  if(t<holdUntil){timer=requestAnimationFrame(tick);return;}
  const n=STOPS.length;let p=pos+dt*(n-1)/(PLAY_MS/1000);
  if(p>=n-1){setPos(n-1);stop();return;}
  const w=Math.floor(p+1e-9);if(w>Math.floor(pos+1e-9)){p=w;holdUntil=t+HOLD_MS;}
  setPos(p);timer=requestAnimationFrame(tick);}
function dismissCover(){if(!cover)return;cover=false;$('stage').classList.remove('cover-on');draw();}
function wire(){
  const n=STOPS.length,LABELLED=new Set([0,Math.round((n-1)/3),Math.round((n-1)*2/3),Math.round((n-1)*5/6),n-1]);
  $('sl').max=n-1;
  const mk=()=>{const W=$('ticks').clientWidth||250,max=Math.max(2,Math.floor(W/48)),pick=new Set([0,n-1]);for(let k=1;k<max-1;k++)pick.add(Math.round(k*(n-1)/(max-1)));document.querySelectorAll('.tick').forEach((t,i)=>{t.textContent=pick.has(i)?yearLabel(STOPS[i]):'·';});};
  $('ticks').innerHTML=STOPS.map((y,i)=>'<button type="button" class="tick" data-i="'+i+'" style="left:'+(i/(n-1)*100)+'%" aria-label="Year '+yearLabel(y)+'">'+(LABELLED.has(i)?yearLabel(y):'·')+'</button>').join('');
  mk();window.addEventListener('resize',mk);
  $('ticks').addEventListener('click',e=>{const b=e.target.closest('.tick');if(!b)return;dismissCover();stop();auto=true;setPos(+b.dataset.i);});
  $('sl').addEventListener('input',e=>{dismissCover();stop();auto=true;setPos(+e.target.value);});
  $('coverPlay').addEventListener('click',()=>$('play').click());
  $('play').addEventListener('click',()=>{dismissCover();if(timer){stop();return;}if(pos>=n-1)pos=0;auto=true;$('play').textContent='Pause';last=performance.now();holdUntil=Math.abs(pos-Math.round(pos))<1e-6?last+HOLD_MS:0;timer=requestAnimationFrame(tick);});
  const stepTo=d=>{dismissCover();stop();auto=true;setPos(Math.max(0,Math.min(n-1,Math.round(pos)+d)));};
  $('prev').addEventListener('click',()=>stepTo(-1));$('next').addEventListener('click',()=>stepTo(1));
  document.querySelectorAll('.chip[data-l]').forEach(b=>b.addEventListener('click',()=>{const L=LAYERS.find(x=>x.id===b.dataset.l);
    if(L.on&&active().length===1)return;   // one layer always stays on
    L.on=!L.on;auto=true;dismissCover();cardKey='';syncChips();showCards();draw();}));
  const cv=$('gl'),ptrs=new Map();let pinch=0;
  cv.addEventListener('pointerdown',e=>{dismissCover();cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0;});
  cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;auto=false;const mn=(cv.clientWidth||390)/360;
    if(ptrs.size===1){view.lon-=(e.clientX-p.x)/view.sc;view.lat=Math.max(-70,Math.min(80,view.lat+(e.clientY-p.y)/view.sc));p.x=e.clientX;p.y=e.clientY;}
    else{p.x=e.clientX;p.y=e.clientY;const [a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)view.sc=Math.max(mn,Math.min(10,view.sc*d/pinch));pinch=d;}
    draw();});
  const up=e=>{ptrs.delete(e.pointerId);pinch=0;};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{e.preventDefault();dismissCover();auto=false;view.sc=Math.max((cv.clientWidth||390)/360,Math.min(10,view.sc*(e.deltaY<0?1.1:1/1.1)));draw();},{passive:false});
  window.addEventListener('resize',draw);
}
function fail(m){const e=$('msg');e.hidden=false;e.textContent=m;$('hz').hidden=true;}
function check(L,d){   // reports problems, never fixes them
  if(!d||!Array.isArray(d.snapshots)||d.snapshots.length<2||!Array.isArray(d.anchors))throw new Error(L.file+' is missing snapshots or anchors');
  for(const s of d.snapshots)if(!s.label||!s.summary||!s.jewish)throw new Error(L.name+' wave '+s.year+' is missing card text');
  for(const a of d.anchors){if(!(a.lat>=-90&&a.lat<=90&&a.lon>=-180&&a.lon<=180))throw new Error('Bad latitude or longitude on '+a.id);if(!Array.isArray(a.s)||a.s.length!==d.snapshots.length)throw new Error(L.name+' anchor '+a.id+' does not have one entry per wave');}
}
(async()=>{
  try{
    for(const L of LAYERS){let r;try{r=await fetch(L.file);}catch(e){r=null;}
      if(!r||!r.ok){if(L.optional){L.missing=true;L.on=false;continue;}throw new Error('Could not load '+L.file);}
      const d=await r.json();check(L,d);
      L.snaps=d.snapshots;L.anch=d.anchors;L.years=d.snapshots.map(s=>s.year);L.on=true;L.cv=document.createElement('canvas');L.cx2=L.cv.getContext('2d');
      if(!L.noCarry)for(const a of L.anch){let lastS=null;a.s=a.s.map(s=>{if(s[1]>0){lastS=s;return s;}return lastS?lastS.slice():s;});}   // cumulative (Jeffrey 5 Nov): once drawn, a place keeps its last radius and intensity
    }
    const extra=LAYERS.filter(L=>L.on&&L.noCarry).flatMap(L=>L.years).filter(y=>!BASE_STOPS.includes(y)&&(y<BASE_STOPS[0]||y===1950));
    STOPS=[...new Set([...BASE_STOPS,...extra])].sort((a,b)=>a-b);
    const jc=document.querySelector('.chip[data-l=jew]');if(jc){if(LAYERS[2].missing){jc.disabled=true;}else{jc.disabled=false;jc.querySelector('span').textContent='Judaism';}}
    $('version').textContent=window.SITE_FOOTER;
    initGL();
    syncChips();wire();setPos(0);requestAnimationFrame(frame);
  }catch(e){fail('This page could not load: '+e.message);}
})();
