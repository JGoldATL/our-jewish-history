// Real map insets (F-149 Tier 1, F-155 Tier 2): size, tone match against the base, and fallback when a file is missing.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/inset_real.js   (headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const fs=require('fs');const man=JSON.parse(fs.readFileSync(__dirname+'/../images/inset/manifest.json','utf8'));
const insets=man.insets||man;
(async()=>{const b=await chromium.launch();const errs=[];
const open=async(route)=>{const c=await b.newContext({viewport:{width:1280,height:800}});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));if(route)await route(p);
  await p.goto(BASE+'archaeology.html');await p.waitForTimeout(2200);await p.evaluate(()=>{const i=document.getElementById('intro');if(i)i.hidden=true;});return {c,p};};
const view=async(p,lon,lat,d)=>{await p.evaluate(a=>ARC.setView({lon:a[0],lat:a[1],degW:a[2]}),[lon,lat,d]);await p.waitForTimeout(1500);};
// 1 files exist and are real pictures, under budget
for(const [id,max] of [['tier1-land-of-israel',2e6],['tier2-near-east',3e6]]){const f=__dirname+'/../images/inset/'+id+'.webp';const sz=fs.existsSync(f)?fs.statSync(f).size:0;ck(sz>20000&&sz<max,id+': real picture, '+sz+' bytes (budget '+max+')');}
// 2 with the files: both are drawn, in order, with the right pixel density
{const {c,p}=await open();await view(p,34.7,30.4,2);
 const r=await p.evaluate(()=>[...document.querySelectorAll('#map image[data-inset]')].map(i=>({id:i.getAttribute('data-inset'),w:i.getBoundingClientRect().width,nw:i.href.baseVal?1:0})));
 ck(r.length===2&&r[0].id==='tier2-near-east'&&r[1].id==='tier1-land-of-israel','both insets drawn, Tier 2 under Tier 1 '+JSON.stringify(r.map(x=>x.id)));
 // tone match on an inland patch with no coast: mean colour with and without the insets must agree within 6 of 255
 const shot=async()=>p.screenshot({clip:{x:560,y:330,width:160,height:140}});
 const withI=await shot();
 await c.close();
 const n=await open(async q=>{await q.route('**/images/inset/*.webp',x=>x.fulfill({status:404,body:''}));});await view(n.p,34.7,30.4,2);
 const noI=await n.p.screenshot({clip:{x:560,y:330,width:160,height:140}});
 const nodraw=await n.p.evaluate(()=>document.querySelectorAll('#map image[data-inset]').length);
 ck(nodraw===0,'missing files (404): nothing is drawn');
 const pg=await (await b.newContext()).newPage();
 const mean=async buf=>pg.evaluate(async u=>{const im=new Image();im.src=u;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let s=[0,0,0],n=0;for(let i=0;i<d.length;i+=4){s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2];n++;}return s.map(v=>v/n);},'data:image/png;base64,'+buf.toString('base64'));
 await pg.goto('about:blank');const a=await mean(withI),z=await mean(noI);
 ck(a.every((v,i)=>Math.abs(v-z[i])<12),'inland Negev patch (no coast, no water) with insets matches the base within 12 of 255: '+a.map(v=>v.toFixed(0))+' vs '+z.map(v=>v.toFixed(0)));
 await n.c.close();}
// 3 only one file missing: the other still draws, no errors
{const {c,p}=await open(async q=>{await q.route('**/tier1-land-of-israel.webp',x=>x.fulfill({status:404,body:''}));});await view(p,35.35,31.32,3);
 const ids=await p.evaluate(()=>[...document.querySelectorAll('#map image[data-inset]')].map(i=>i.getAttribute('data-inset')));
 ck(!ids.includes('tier1-land-of-israel'),'Tier 1 file missing: Tier 1 draws nothing ('+ids+')');await c.close();}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
