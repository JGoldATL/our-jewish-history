// F-021 "Islamic Conquest" page. Run: NODE_PATH=$(npm root -g) node tests/haze.js   (needs python3 -m http.server 8778 in the repo root; headless Chromium with software WebGL)
// HAZE_DATA=/path/to/haze.json feeds the page other data (for example a draft review copy) in place of data/haze.json.
const {chromium}=require('playwright');const fs=require('fs');const BASE=process.env.BASE||'http://localhost:8778/';
const DATA=fs.readFileSync(process.env.HAZE_DATA||'data/haze.json','utf8');   // run from the repo root; the committed file is real once rows are LOCKED
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
  await setPos(p,2);const kh=await p.evaluate(()=>({txt:document.getElementById('key').innerText.trim(),disp:getComputedStyle(document.getElementById('key')).display}));ck(kh.txt===''&&kh.disp==='none','haze waves: no key is shown',kh);
  await setPos(p,last-1);const g1=await greens(p);await setPos(p,last-0.5);const gm=await greens(p);await setPos(p,last);await p.waitForTimeout(2500);const g2=await greens(p);
  ck(g1>2000&&gm>2000&&g2>2000,'green never drops out between 1900, the cross-fade and Today',{g1,gm,g2});
  const fin=await p.evaluate(()=>({ready:FIN.ready,n:FIN.states&&FIN.states.length,key:document.getElementById('key').innerText,cap:document.getElementById('cap').innerText,yr:document.getElementById('yr').textContent,ticks:[...document.querySelectorAll('.tick')].pop().textContent}));
  ck(fin.ready&&fin.n===50,'Today: the final map loaded with 50 states',fin);
  ck(/Muslim-majority state/.test(fin.key)&&/Arab League member/.test(fin.key)&&/recognized by many states, not all/.test(fin.key),'Today: key shows Muslim-majority, Arab League and the Kosovo footnote',fin.key);
  ck(fin.cap==='Present-day states'&&fin.yr==='Today'&&fin.ticks==='Today','Today: the last slider stop reads Today',fin);
  const titles=await p.evaluate(()=>document.querySelector('#card h2').textContent);ck(titles===d.snapshots[last].title,'card shows the Card title, not the slider label',titles);}
 // final map data and images
 {const st=JSON.parse(fs.readFileSync('data/states.json','utf8')),names=st.states.map(x=>x.name);
  ck(st.states.length===50&&new Set(names).size===50,'states.json: 50 distinct sovereign states',st.states.length);
  ck(st.states.filter(x=>x.arab).length===21&&st.states.filter(x=>x.arab).every(x=>x.joined>=1945),'states.json: 21 Arab League members, each with a year joined');
  ck(!/palestin|west bank|gaza|sahara|mayotte|footnote|disputed/i.test(JSON.stringify(st.states)),'states.json: no Palestine, West Bank, Gaza, Western Sahara, Mayotte, footnote text or "disputed" among the states');
  ck(names.includes('Kosovo')&&st.states.find(x=>x.name==='Kosovo').star===true,'states.json: Kosovo is in and carries the footnote star');
  ck(Object.keys(st.outlines).sort().join()==='westBankGaza,westernSahara'&&st.states.every(x=>x.shareYear===2020),'states.json: two dashed outlines only; every share is labelled 2020',Object.keys(st.outlines));
  const png=(f)=>{const b=fs.readFileSync(f);return [b.readUInt32BE(16),b.readUInt32BE(20)];};
  ck(png('images/final-fill.png').join()==='4096,2048'&&png('images/final-border.png').join()==='4096,2048','final map images are 4096 by 2048');}
 // Spread line shows only where there is one (fixture: two cards given a line)
 {const q=await b.newPage({viewport:{width:390,height:844}});const d=JSON.parse(DATA);d.snapshots.forEach(x=>{delete x.spread;});d.snapshots[1].spread={text:'Fixture spread line.',sources:[{name:'Fixture source',url:'https://example.org/x'},d.snapshots[1].sources[0]]};
  await q.route('**/data/haze.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)}));await q.goto(BASE+'haze.html');await q.waitForSelector('#card h2');await q.waitForTimeout(1500);
  const has=async i=>{await q.evaluate(x=>{const s=document.getElementById('sl');s.value=x;s.dispatchEvent(new Event('input'));},i);await q.waitForTimeout(150);return q.evaluate(()=>({h:[...document.querySelectorAll('#card h3')].map(x=>x.textContent).includes('How Islam spread'),li:document.querySelectorAll('#card li').length}));};
  const a1=await has(1),a2=await has(2);ck(a1.h&&!a2.h&&a1.li===d.snapshots[1].sources.length+1,'Spread line: shown only where present, with its source added and a duplicate source dropped',{a1,a2});await q.close();}
 { // jumping straight to Today in one move still shows the present-day key once the final map has loaded
  const j=await open(390,844);await j.evaluate(()=>{const s=document.getElementById('sl');s.value=document.getElementById('sl').max;s.dispatchEvent(new Event('input'));});await j.waitForTimeout(6000);
  const kj=await j.evaluate(()=>({txt:document.getElementById('key').innerText,disp:getComputedStyle(document.getElementById('key')).display}));
  ck(kj.disp!=='none'&&/Muslim-majority state/.test(kj.txt)&&/Arab League member/.test(kj.txt),'jump straight to Today: the key shows (solid green and green with white lines)',kj);await j.close();}
 // controls
 await setPos(p,0);const y0=await p.textContent('#yr');await setPos(p,3);const y3=await p.textContent('#yr');ck(y0!==y3&&/^\d{3,4}$/.test(y3),'slider moves the year readout',[y0,y3]);
 await p.click('#play');await p.waitForTimeout(1500);const pl=await p.textContent('#play');await p.click('#play');ck(pl==='Pause'&&(await p.textContent('#play'))==='Play','Play starts and pauses',pl);
 ck(p.__errs.length===0,'no page errors at 390 px',p.__errs);await p.close();
 for(const [w,h] of [[320,640],[390,844],[820,1180]]){const q=await open(w,h);let ov=0;for(let i=0;i<n;i+=2){await q.evaluate(x=>{const s=document.getElementById('sl');s.value=x;s.dispatchEvent(new Event('input'));},i);await q.waitForTimeout(120);ov=Math.max(ov,await q.evaluate(()=>document.documentElement.scrollWidth-innerWidth));}
  ck(ov<=0,w+' px: no sideways scroll on any wave',ov);ck(q.__errs.length===0,w+' px: no page errors',q.__errs);await q.close();}
 // v3.2.0 cover: the page opens on a bare globe with a green glow, title and Play; Play, the slider, a drag or a wheel turn start the story
 if(DATA&&JSON.parse(DATA).snapshots[0].year<650){const d0=JSON.parse(DATA);
  ck(d0.snapshots[0].hold!==true&&d0.anchors.every(a=>!a.s[0][1]),'opening wave has no haze anywhere and is not a hold card');
  const c1=await open(390,844);
  const st=await c1.evaluate(()=>({on:document.getElementById('stage').classList.contains('cover-on'),vis:getComputedStyle(document.getElementById('cover')).display,key:getComputedStyle(document.getElementById('key')).display,title:document.querySelector('#cover h2').textContent,btn:document.getElementById('coverPlay').textContent,yr:document.getElementById('yr').textContent,pos:pos}));
  ck(st.on&&st.vis==='flex'&&st.key==='none'&&st.title==='Islamic Conquest'&&st.btn==='Play'&&st.pos===0,'cover: shown at load with title and Play; the key is hidden',st);
  const gc=await greens(c1);ck(gc>1500,'cover: green glow round the rim',gc);
  await c1.click('#coverPlay');await c1.waitForTimeout(1200);
  const st2=await c1.evaluate(()=>({on:document.getElementById('stage').classList.contains('cover-on'),playing:document.getElementById('play').textContent,pos:pos}));
  ck(!st2.on&&st2.playing==='Pause'&&st2.pos>0,'cover Play: dismisses the cover and starts the spread',st2);await c1.close();
  const c2=await open(390,844);await c2.evaluate(()=>{const s=document.getElementById('sl');s.value=0;s.dispatchEvent(new Event('input'));});await c2.waitForTimeout(600);
  const g0=await greens(c2);ck(!(await c2.evaluate(()=>document.getElementById('stage').classList.contains('cover-on')))&&g0<gc/4,'slider: dismisses the cover; the first wave shows a bare globe (no green)',{g0,gc});
  const cap0=await c2.evaluate(()=>({k:document.querySelector('#card .k').textContent,h:document.querySelector('#card h2').textContent,yr:document.getElementById('yr').textContent}));
  ck(/^Wave 1 of 16/.test(cap0.k)&&cap0.h==='600: Before Muslim rule'&&cap0.yr==='600','first wave: card and year read 600',cap0);
  await setPos(c2,1);const g1=await greens(c2);ck(g1>g0+1500,'650 wave: the green has grown in',{g0,g1});await c2.close();
  const c3=await open(390,844);const box=await c3.locator('#gl').boundingBox();await c3.mouse.move(box.x+120,box.y+120);await c3.mouse.down();await c3.mouse.move(box.x+200,box.y+130);await c3.mouse.up();
  ck(!(await c3.evaluate(()=>document.getElementById('stage').classList.contains('cover-on'))),'dragging the globe dismisses the cover',null);await c3.close();
  const c4=await open(390,844);await c4.click('#play');await c4.waitForTimeout(300);
  ck(!(await c4.evaluate(()=>document.getElementById('stage').classList.contains('cover-on'))),'the bottom Play button also dismisses the cover',null);
  ck(c4.__errs.length===0,'cover: no page errors',c4.__errs);await c4.close();}
 // nav pill on a phone: Islamic Rule fits and Quiz is reachable
 const ph=await open(320,640);const reach=await ph.evaluate(()=>{const tr=document.querySelector('#gnBar .gp-track');if(!tr)return null;tr.scrollLeft=tr.scrollWidth;const q=[...document.querySelectorAll('#gnBar .gp-btn')].find(x=>x.textContent==='Quiz'),r=q.getBoundingClientRect(),t=tr.getBoundingClientRect();return {quizVisible:r.right<=t.right+2&&r.left>=t.left-2};});
 ck(reach&&reach.quizVisible,'320 px: scrolled to the end, Quiz is last and fully visible',reach);await ph.close();
 await b.close();console.log(bad?bad+' FAILED':'ALL PASSED');process.exit(bad?1:0);})();
