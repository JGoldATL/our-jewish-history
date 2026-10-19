// Movements flat map: Natural Earth projection, rings removed, softer fade, glow off while moving.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const pin=async p=>p.evaluate(()=>{const c=[...document.querySelectorAll('#map circle')].map(e=>({x:+e.getAttribute('cx'),y:+e.getAttribute('cy')})).filter(q=>q.x>80&&q.y>80);const r=document.getElementById('mapWrap').getBoundingClientRect();return c.length?{...c[0],ox:r.left,oy:r.top,n:c.length,W:r.width,H:r.height}:null;});
(async()=>{const br=await chromium.launch();const errs=[];
for(const [vw,vh,tag] of [[1280,800,'desktop'],[390,844,'phone']]){
  const p=await (await br.newContext({viewport:{width:vw,height:vh},hasTouch:vw<500})).newPage();p.on('pageerror',e=>errs.push(e.message));const n=tag+': ';
  await p.goto(BASE+'movements.html');await p.waitForTimeout(2500);
  await p.evaluate(()=>{const s=document.getElementById('slider');s.value=720;s.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(2200);
  ck(await p.$eval('#map image',i=>/map-globe\.webp$/.test(i.getAttribute('href'))),n+'map image is the globe-style one');
  ck(await p.evaluate(()=>{const b=getComputedStyle(document.getElementById('mapWrap'),'::before');return b.content==='none'||b.content==='normal'||b.backgroundImage==='none';}),n+'orbit rings are gone');
  // city names: Cormorant Garamond bold, dark ink on a cream halo
  const f=await p.$eval('#map text.plname',x=>{const c=getComputedStyle(x);return {ff:c.fontFamily,fw:c.fontWeight,fill:c.fill,sz:parseFloat(c.fontSize)};}).catch(()=>null);
  ck(f&&/Cormorant/.test(f.ff)&&+f.fw>=700&&f.sz>=14,n+'city names are Cormorant Garamond bold ('+(f&&f.ff.split(',')[0]+' '+f.fw+' '+f.sz)+')');
  ck(f&&/rgb\(42, ?32, ?22\)/.test(f.fill),n+'city names are dark ink');
  // sea and region names: none on the zoomed-out start view of a phone; never over a city name
  const geoN=await p.$$eval('#map .geoLbl',a=>a.length);if(vw<500)ck(geoN===0,n+'no sea or region names when zoomed out on a phone');
  ck(await p.$eval('#mapWrap',w=>getComputedStyle(w).borderRadius==='26px'),n+'framed rounded card');
  const a=await pin(p);ck(!!a,n+'a pin is on the map ('+(a&&a.n)+' pins)');
  const b=await (await p.$('#mapWrap')).boundingBox();const cx=b.x+b.width*.5,cy=b.y+b.height*.55;
  // drag: the map point under the finger moves with it
  await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx+50,cy-20,{steps:5});await p.mouse.move(cx+110,cy-35,{steps:8});
  ck(await p.$eval('#mapWrap',w=>w.classList.contains('drag')),n+'drag class set');
  ck(await p.$eval('#map path.routeBody',x=>getComputedStyle(x).filter==='none').catch(()=>true),n+'glow off while dragging');
  await p.mouse.up();await p.waitForTimeout(400);
  const a2=await pin(p);
  if(a){const hit=await p.evaluate(([x,y])=>[...document.querySelectorAll('#map circle')].some(e=>Math.hypot(+e.getAttribute('cx')-x,+e.getAttribute('cy')-y)<2.5),[a.x+110,a.y-35]);ck(hit,n+'drag moves the map 1:1 (a pin lands 110,-35 px from where it started)');}
  ck(await p.$eval('#map path.routeBody',x=>getComputedStyle(x).filter!=='none').catch(()=>true),n+'glow returns after the drag');
  // wheel zoom anchored on the cursor
  const a3=await pin(p);
  if(vw>500&&a3){const sx=a3.ox+a3.x,sy=a3.oy+a3.y;await p.mouse.move(sx,sy);await p.mouse.wheel(0,-260);await p.waitForTimeout(500);
    const a4=await pin(p);const found=await p.evaluate(([x,y])=>[...document.querySelectorAll('#map circle')].some(e=>Math.hypot(+e.getAttribute('cx')-x,+e.getAttribute('cy')-y)<3),[a3.x,a3.y]);
    ck(found,n+'zoom keeps the point under the cursor fixed');}
  if(vw>500){await p.reload();await p.waitForTimeout(2500);await p.evaluate(()=>{const s=document.getElementById('slider');s.value=720;s.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(2200);
    const q=await pin(p);await p.mouse.move(q.ox+q.x,q.oy+q.y);for(let i=0;i<6;i++){await p.mouse.wheel(0,-240);await p.waitForTimeout(120);}await p.waitForTimeout(700);
    const g=await p.evaluate(()=>{const bb=e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom};};const C=[...document.querySelectorAll('#map text.plname')].map(bb),G=[...document.querySelectorAll('#map .geoLbl')].map(bb);let hit=0;for(const a of G)for(const c of C)if(a.l<c.r&&a.r>c.l&&a.t<c.b&&a.b>c.t)hit++;return {g:G.length,c:C.length,hit};});
    ck(g.hit===0&&g.c>0,n+'zoomed in: sea and region names never touch a city name ('+g.g+' sea/region, '+g.c+' city names)');
    await p.screenshot({path:(process.env.SHOT||'/dev/null')+'-'+tag+'-med.png'});}
  // zoom all the way out: the whole map fits, no page overflow, view stays centred
  for(let i=0;i<8;i++){await p.click('#zout');await p.waitForTimeout(120);}await p.waitForTimeout(500);
  {const m=await p.evaluate(()=>[document.documentElement.scrollWidth,innerWidth,document.documentElement.scrollHeight,innerHeight]);ck(m[0]<=m[1]+1&&m[2]<=m[3]+90,n+'max zoom-out fits the page ('+m.join('/')+')');}
  await p.screenshot({path:(process.env.SHOT||'/dev/null')+'-'+tag+'-out.png'});
  await p.click('button[aria-label^="Reset"]');await p.waitForTimeout(1200);
  await p.screenshot({path:(process.env.SHOT||'/dev/null')+'-'+tag+'-home.png'});
}
ck(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await br.close();process.exit(bad?1:0);})();
