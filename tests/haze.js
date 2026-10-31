// F-021 "Islamic Conquest" page. Run: NODE_PATH=$(npm root -g) node tests/haze.js   (needs python3 -m http.server 8778 in the repo root; headless Chromium with software WebGL)
// HAZE_DATA=/path/to/haze.json feeds the page real or draft data in place of data/haze.json (the committed file is the mock until rows are LOCKED).
const {chromium}=require('playwright');const fs=require('fs');const BASE=process.env.BASE||'http://localhost:8778/';
const DATA=process.env.HAZE_DATA?fs.readFileSync(process.env.HAZE_DATA,'utf8'):null;
let bad=0;const ck=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)bad++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 async function open(w,h){const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});p.__errs=[];p.on('pageerror',e=>p.__errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.__errs.push(m.text())});
  if(DATA)await p.route('**/data/haze.json',r=>r.fulfill({status:200,contentType:'application/json',body:DATA}));await p.goto(BASE+'haze.html');await p.waitForSelector('#card h2');await p.waitForTimeout(2500);return p;}
 const setPos=async(p,v)=>{await p.evaluate(x=>{const s=document.getElementById('sl');s.value=x;s.dispatchEvent(new Event('input'));},v);await p.waitForTimeout(2800);};
 const greens=async p=>{const buf=await p.screenshot({clip:{x:0,y:0,width:390,height:560}});fs.writeFileSync('/tmp/_hz.png',buf);return +require('child_process').execSync(`python3 -W ignore -c "from PIL import Image;im=Image.open('/tmp/_hz.png').convert('RGB');print(sum(1 for r,g,b in im.getdata() if g>r+18 and g>b+18))"`).toString().trim();};
 const p=await open(390,844);
 const n=await p.evaluate(()=>document.querySelectorAll('.tick').length),info=await p.evaluate(()=>({title:document.title,h1:document.querySelector('.brand h1').textContent,nav:[...document.querySelectorAll('#gnBar .gp-btn')].map(x=>x.textContent),cur:document.querySelector('#gnBar .gp-btn[aria-selected=true],#gnBar .gp-btn.on,#gnBar .gp-btn[aria-current]')?.textContent}));
 ck(info.title==='Islamic Conquest | Our Jewish Journey'&&info.h1==='Islamic Conquest','page title and heading are Islamic Conquest',info);
 ck(info.nav.join()==='Events,Movements,JewHate,Archaeology,Thank Jews?,Islamic Rule,Quiz','nav: Islamic Rule after Thank Jews?, Quiz rightmost',info.nav);
 ck(n>=12,'one tick per wave',n);
 const foot=await p.textContent('#version');ck(/^v\d+\.\d+\.\d+; data v\d+\.\d+\.\d+$/.test(foot.trim()),'footer reads "version; data version"',foot);
 // text rules on every wave
 const forbidden=/direct rule|vassal|tributary|raid only|shared|disputed|approximate|exact|palestin|\d\s?CE\b/i;let seen=0,badTxt=[];const notes=[];
 for(let i=0;i<n;i++){await p.evaluate(x=>{const s=document.getElementById('sl');s.value=x;s.dispatchEvent(new Event('input'));},i);await p.waitForTimeout(150);
  const t=await p.evaluate(()=>({card:document.getElementById('card').innerText,cap:document.getElementById('cap').innerText,hasNote:!!document.querySelector('#card .nbc')}));seen++;if(forbidden.test(t.card+' '+t.cap))badTxt.push(i);if(t.hasNote)notes.push(i);}
 ck(seen===n&&badTxt.length===0,'no card or label ever shows control type, certainty, "disputed", "Palestine" or CE',badTxt);
 if(DATA){const d=JSON.parse(DATA);const noteIdx=d.snapshots.map((s,i)=>s.note?i:-1).filter(i=>i>=0);ck(JSON.stringify(notes)===JSON.stringify(noteIdx)&&noteIdx.length>=1,'the not-by-conquest note shows only on the cards that have one',{notes,noteIdx});
  const last=d.snapshots.length-1;ck(d.snapshots[last].hold===true,'closing card is a hold card in the data',d.snapshots[last].hold);
  await setPos(p,last-1);const g1=await greens(p);await setPos(p,last);const g2=await greens(p);ck(g2>g1*0.7&&g2>2000,'closing card keeps the last haze (it does not fade it out)',{g1,g2});
  const titles=await p.evaluate(()=>document.querySelector('#card h2').textContent);ck(titles===d.snapshots[last].title,'card shows the Card title, not the slider label',titles);}
 // controls
 await setPos(p,0);const y0=await p.textContent('#yr');await setPos(p,3);const y3=await p.textContent('#yr');ck(y0!==y3&&/^\d{3,4}$/.test(y3),'slider moves the year readout',[y0,y3]);
 await p.click('#play');await p.waitForTimeout(1500);const pl=await p.textContent('#play');await p.click('#play');ck(pl==='Pause'&&(await p.textContent('#play'))==='Play','Play starts and pauses',pl);
 ck(p.__errs.length===0,'no page errors at 390 px',p.__errs);await p.close();
 for(const [w,h] of [[320,640],[390,844],[820,1180]]){const q=await open(w,h);let ov=0;for(let i=0;i<n;i+=2){await q.evaluate(x=>{const s=document.getElementById('sl');s.value=x;s.dispatchEvent(new Event('input'));},i);await q.waitForTimeout(120);ov=Math.max(ov,await q.evaluate(()=>document.documentElement.scrollWidth-innerWidth));}
  ck(ov<=0,w+' px: no sideways scroll on any wave',ov);ck(q.__errs.length===0,w+' px: no page errors',q.__errs);await q.close();}
 // nav pill on a phone: Islamic Rule fits and Quiz is reachable
 const ph=await open(320,640);const reach=await ph.evaluate(()=>{const tr=document.querySelector('#gnBar .gp-track');if(!tr)return null;tr.scrollLeft=tr.scrollWidth;const q=[...document.querySelectorAll('#gnBar .gp-btn')].find(x=>x.textContent==='Quiz'),r=q.getBoundingClientRect(),t=tr.getBoundingClientRect();return {quizVisible:r.right<=t.right+2&&r.left>=t.left-2};});
 ck(reach&&reach.quizVisible,'320 px: scrolled to the end, Quiz is last and fully visible',reach);await ph.close();
 await b.close();console.log(bad?bad+' FAILED':'ALL PASSED');process.exit(bad?1:0);})();
