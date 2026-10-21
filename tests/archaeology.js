// Archaeology page "Found in the Ground" (v2.0.0 to v2.0.2, F-113; v2.0.2 is the Side card layout): rules from Dataset 10/21, Strategy pin simplification 10/21, Creative Design pins 10/21, CEO 10/21.
// Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/archaeology.js   (headless Chromium only; no real iPad or phone)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
const fs=require('fs');const D=JSON.parse(fs.readFileSync(__dirname+'/../data/archaeology.json','utf8')).records;
(async()=>{const b=await chromium.launch();const errs=[];
const ign=m=>/ERR_TUNNEL|fonts\.g|Failed to load resource/.test(m);
// ---- data rules (from the committed JSON) ----
const vis=D.filter(r=>['LOCKED','LEANING','DRAFT'].includes(r.status));
const linked=new Set(vis.filter(r=>r.type==='Object'&&r.linkedSite).map(r=>r.linkedSite));
const drawn=vis.filter(r=>!linked.has(r.id));
ck(D.length===47,'47 records in data/archaeology.json ('+D.length+')');
ck(['Site','Writing','Object'].every(k=>D.some(r=>r.symbol===k))&&D.every(r=>['Site','Writing','Object'].includes(r.symbol)),'every record has one of the three symbols');
ck(D.every(r=>!('internalNotes' in r)&&!('whereNow' in r)&&!('precision' in r)),'Internal notes, Where it is now and Coordinate precision are not in the file');
for(const [vw,vh,tag] of [[1280,800,'desktop'],[390,844,'phone'],[320,640,'small phone']]){
  const n=tag+': ';
  const ctx=await b.newContext({viewport:{width:vw,height:vh},hasTouch:vw<500});
  await ctx.addInitScript(()=>{window.__shared=null;Object.defineProperty(navigator,'share',{value:d=>{window.__shared=d;return Promise.resolve();},configurable:true});});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(n+e.message));p.on('console',m=>{if(m.type()==='error'&&!ign(m.text()))errs.push(n+m.text());});
  // public page: nothing is LOCKED today, so nothing draws and the page says so
  await p.goto(BASE+'archaeology.html');await p.waitForTimeout(1800);
  {const L=D.filter(r=>r.status==='LOCKED'),ln=new Set(L.filter(r=>r.type==='Object'&&r.linkedSite).map(r=>r.linkedSite)),exp=L.filter(r=>!ln.has(r.id)).map(r=>r.id).sort();
   ck(await p.evaluate(e=>JSON.stringify(ARC.pins().map(x=>x.id).sort())===JSON.stringify(e)&&ARC.pins().every(x=>x.r.status==='LOCKED'),exp),n+'public view (no ?drafts=1) draws only LOCKED records ('+exp.length+' pins)');}
  ck(await p.evaluate(()=>{const s=ARC.state();return !document.getElementById('intro')&&!!s.SEL&&s.shown.length>0&&/Tap a pin to open it/.test(document.getElementById('hint').textContent)&&document.querySelectorAll('#map .pin').length>0&&document.querySelector('#story h2').textContent.length>0;}),n+'page opens with pins on the map and a find already open in the card (no intro card)');
  ck(await p.evaluate(()=>{const s=ARC.state();return s.Y===new Date().getFullYear()&&document.getElementById('slider').value==='1000';}),n+'year and slider open at today');
  ck(await p.evaluate(()=>/noindex/.test(document.querySelector('meta[name=robots]').content)),n+'page is noindex');
  // preview
  await p.goto(BASE+'archaeology.html?drafts=1');await p.waitForTimeout(2000);
  ck(await p.evaluate(()=>document.querySelector('h1').textContent==='Found in the Ground'&&/Real objects\. Real places\. Real dates\./.test(document.querySelector('.brand p').textContent)),n+'title and tagline are the approved text');
  ck(await p.evaluate(()=>!document.querySelector('#play,#introPlay')&&!/\bplay\b/i.test(document.getElementById('card').textContent)&&!/\bplay\b/i.test(document.getElementById('stage').textContent.replace(/display/gi,''))),n+'no Play button anywhere');
  ck(await p.evaluate(()=>{const b=document.getElementById('tbar'),m=document.getElementById('mapWrap').getBoundingClientRect(),r=b.getBoundingClientRect();return b.contains(document.getElementById('year'))&&b.contains(document.getElementById('lens'))&&b.contains(document.getElementById('slider'))&&r.top>m.top+m.height*.5;}),n+'year, toggle and slider sit in the bottom bar, below the card');
  ck(await p.evaluate(()=>{const k=document.getElementById('keyBtn').getBoundingClientRect(),m=document.getElementById('mapWrap').getBoundingClientRect();return k.left-m.left<24&&k.top-m.top<24;}),n+'Map key button sits at the top left of the map');
  {const k0=await p.evaluate(()=>document.getElementById('keyBtn').getBoundingClientRect().left);await p.evaluate(()=>ARC.setView({lon:20,lat:40,degW:20},0));await p.waitForTimeout(200);
   ck(await p.evaluate(k=>document.getElementById('keyBtn').getBoundingClientRect().left===k,k0),n+'Map key stays in place when the map moves');await p.evaluate(()=>ARC.setView(ARC.homeView(),0));await p.waitForTimeout(200);}
  ck(await p.evaluate(()=>{const c=document.querySelector('#card .ojjpg');return !c.hidden&&c.querySelectorAll('.dotb').length>=2&&c.querySelectorAll('.dotb[aria-current=true]').length===1;}),n+'card has carousel dots with one current');
  {const s0=await p.evaluate(()=>ARC.state().SEL);await p.click('#card .ojjpg [data-step="1"]');await p.waitForTimeout(900);const s1=await p.evaluate(()=>ARC.state().SEL);
   ck(s1&&s1!==s0,n+'next arrow opens the next find ('+s0+' to '+s1+')');
   await p.click('#card .ojjpg [data-step="-1"]');await p.waitForTimeout(900);ck(await p.evaluate(s=>ARC.state().SEL===s,s0),n+'previous arrow returns');
   const g=await p.evaluate(()=>{const d=document.querySelectorAll('#card .ojjpg .dotb');return ARC.carousel()[+d[d.length-1].dataset.go].id;});await p.click('#card .ojjpg .dotb:last-child');await p.waitForTimeout(900);
   ck(await p.evaluate(g=>ARC.state().SEL===g,g),n+'tapping a dot opens that find');
   ck(await p.evaluate(()=>{const f=document.querySelector('#map .pin.selected');if(!f)return false;const r=f.getBoundingClientRect(),c=document.getElementById('card').getBoundingClientRect();return !(r.right>c.left&&r.left<c.right&&r.bottom>c.top&&r.top<c.bottom);}),n+'the open find’s pin is in view, not under the card');}
  await p.evaluate(()=>ARC.setYear(1830));await p.waitForTimeout(200);
  await p.evaluate(()=>ARC.setYear(1830));await p.waitForTimeout(200);
  const first=await p.evaluate(()=>ARC.state().shown);
  console.log('INFO  at 1830 the page shows: '+first.join(','));
  ck(await p.evaluate(()=>ARC.pins().every(p=>p.r.year>=1830)&&ARC.state().LO===1830&&ARC.state().HI===new Date().getFullYear()),n+'slider runs from 1830 to this year');
  // all finds, all tiers
  await p.evaluate(()=>{ARC.setView({lon:35,lat:32,degW:3},0);ARC.setYear(new Date().getFullYear());});await p.waitForTimeout(300);
  ck(await p.evaluate(()=>ARC.tierMax()===3),n+'city zoom shows all three Importance levels');
  ck(await p.evaluate(g=>ARC.pins().length===g,drawn.length),n+'one pin per place: '+drawn.length+' pins ('+linked.size+' sites skipped because a find is linked)');
  ck(await p.evaluate(l=>[...l].every(id=>!ARC.pins().some(p=>p.id===id)),[...linked]),n+'no Site pin is drawn when a find is linked to it');
  ck(await p.evaluate(()=>['ARC-013','ARC-031','ARC-039'].every(id=>ARC.pins().some(p=>p.id===id))),n+'City of David, Masada and Dura-Europos keep their own Site pin');
  // zoom by Importance at home
  await p.evaluate(()=>{ARC.setView({...ARC.homeView(),degW:200},0);});await p.waitForTimeout(300);
  const home=await p.evaluate(()=>({t:ARC.tierMax(),s:ARC.state().shown.filter(id=>id!==ARC.state().SEL).map(id=>ARC.pins().find(p=>p.id===id).imp)}));   // the open find is always drawn, whatever its Importance
  if(home.t!==1)console.log('INFO  this screen is too small to zoom out to Importance 1 only; skipped');
  ck((home.t!==1&&vw<340)||(home.t===1&&home.s.length>0&&home.s.every(i=>i===1)),n+'zoomed out shows Importance 1 only ('+home.s.length+' pins)');
  await p.evaluate(()=>ARC.setView({...ARC.homeView(),degW:(matchMedia('(max-width:620px)').matches?24:34)},0));await p.waitForTimeout(200);
  ck(await p.evaluate(()=>ARC.tierMax()===2&&ARC.state().shown.every(id=>ARC.pins().find(p=>p.id===id).imp<=2)),n+'regional zoom adds Importance 2');
  // pins: one size, tap target, anchored at the tip
  await p.evaluate(()=>ARC.setView({lon:35.3,lat:31.8,degW:3},0));await p.waitForTimeout(300);
  const geo=await p.evaluate(()=>[...document.querySelectorAll('#map .pin')].map(g=>{const r=g.querySelector('rect[data-id]').getBoundingClientRect(),pa=g.querySelector('path').getBoundingClientRect();return {w:r.width,h:r.height,pw:pa.width,ph:pa.height};}));
  ck(geo.length>0&&geo.every(x=>x.w>=43.5&&x.h>=43.5),n+'every pin has a tap target of at least 44 x 44 ('+geo.length+' pins in view)');
  ck(geo.every(x=>Math.abs(x.pw-geo[0].pw)<.6&&Math.abs(x.ph-geo[0].ph)<.6),n+'all pins are one size');
  ck(await p.evaluate(()=>{const s=new Set([...document.querySelectorAll('#map .pin')].map(g=>g.querySelector('g[transform^="translate(-7.20"] ').innerHTML));return s.size<=3;}),n+'only the three symbols are used');
  const sp=await p.evaluate(()=>{const xs=[...document.querySelectorAll('#map .pin')].map(g=>g.getAttribute('transform')).filter(Boolean);return {n:xs.length,u:new Set(xs).size};});
  ck(sp.n===sp.u,n+'pins that share a spot are nudged apart: no two pins sit at exactly the same place ('+sp.n+')');
  // card
  await p.evaluate(()=>{ARC.select('ARC-006',{center:true});});await p.waitForTimeout(900);
  if(await p.$('#moreBtn'))await p.click('#moreBtn');   // on a phone the card opens to its full text
  const card=await p.evaluate(()=>{const s=document.getElementById('story');return {t:s.innerText,det:s.querySelector('details')&&s.querySelector('details').open,share:s.querySelectorAll('.ojj-share').length,ev:[...s.querySelectorAll('.links a')].map(a=>a.getAttribute('href')),src:s.querySelectorAll('.src a').length,fa:s.querySelector('.found-at').textContent};});
  ck(/^Found at Tel Dan/i.test(card.fa),n+'a find’s card says "Found at" its site ('+card.fa+')');
  ck(/Tel Dan Stele/.test(card.t)&&/Found\s*1993/.test(card.t)&&/From\s*c\. 840 BCE/.test(card.t),n+'card shows the discovery year and the period label');
  ck(/What it shows/.test(card.t)&&!/Why it matters/.test(card.t),n+'card says "What it shows", not "Why it matters"');
  ck(card.det===false&&/Deep dive/.test(card.t),n+'Deep dive is collapsed');
  ck(!/Internal|Coordinate precision|Record status|Importance|LEANING|DRAFT/.test(card.t.replace(/Deep dive/,'')),n+'card never shows internal notes, record status, importance or precision');
  ck(card.ev.some(h=>h==='events.html?card=EVT-0008')&&card.src>=1,n+'card links to its Events card and its sources');
  ck(card.share===1,n+'one Share button on the card');
  await p.evaluate(()=>{const d=document.querySelector('#story details');d.open=true;});
  const dd=await p.evaluate(()=>document.querySelector('#story details').innerText);
  ck(/Limits/.test(dd),n+'Deep dive ends with Limits');
  await p.click('#story .ojj-share');await p.waitForTimeout(200);const s1=await p.evaluate(()=>window.__shared);
  ck(s1&&/archaeology\.html\?a=ARC-006$/.test(s1.url)&&!/drafts/.test(s1.url)&&s1.text==='Who said Jewish history wasn’t real? Check this out:',n+'Share sends the Archaeology line and a link with no drafts flag');
  // year note in the Deep dive
  await p.evaluate(()=>{ARC.select('ARC-002');});await p.waitForTimeout(200);
  // lens toggle
  await p.click('#lens button[data-lens=period]');await p.waitForTimeout(300);
  const L=await p.evaluate(()=>ARC.state());
  ck(L.lens==='period'&&L.LO===-1210&&/BCE/.test(await p.$eval('#ends',e=>e.textContent)),n+'Item’s period lens runs from 1210 BCE ('+L.LO+' to '+L.HI+')');
  await p.evaluate(()=>ARC.setYear(-1200));await p.waitForTimeout(200);
  ck(await p.evaluate(()=>{const ids=ARC.pins().filter(p=>p.r.periodStart<=-1200).map(p=>p.id);return ids.includes('ARC-002');}),n+'a find appears at the start of its own period (Merneptah Stele, c. 1207 BCE)');
  await p.click('#lens button[data-lens=found]');await p.waitForTimeout(200);
  ck(await p.evaluate(()=>ARC.state().lens==='found'&&ARC.state().LO===1830),n+'toggle returns to Discovery year');
  // key
  await p.click('#keyBtn');ck((await p.$$eval('#key .pinKey',x=>x.map(y=>y.textContent.trim()))).join()==='Site,Writing,Object',n+'Map key has three lines: Site, Writing, Object');
  // deep links
  await p.goto(BASE+'archaeology.html?drafts=1&a=ARC-006');await p.waitForTimeout(2000);
  ck(await p.evaluate(()=>ARC.state().SEL==='ARC-006'),n+'?a=ARC-006 opens that find (no intro card)');
  await p.goto(BASE+'archaeology.html?drafts=1&a=ARC-005');await p.waitForTimeout(2000);
  ck(await p.evaluate(()=>ARC.state().SEL==='ARC-006'),n+'?a= for a Site that is not drawn opens its find');
  // layout
  const ov=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.body.scrollWidth<=innerWidth+1);
  ck(ov,n+'no sideways scroll');
  ck(await p.evaluate(()=>/^v2\.0\.\d+; data v\d+\.\d+\.\d+$/.test(document.getElementById('version').textContent)),n+'footer reads "v2.0.x; data v#.#.#"');
  await ctx.close();}
// a Sheet where a record is LOCKED shows publicly
{const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();p.on('pageerror',e=>errs.push('lock: '+e.message));
 await p.route('**/data/archaeology.json',async r=>{const res=await r.fetch();const j=await res.json();for(const x of j.records){x.status=['ARC-005','ARC-006'].includes(x.id)?'LOCKED':'DRAFT';}await r.fulfill({response:res,json:j});});
 await p.goto(BASE+'archaeology.html');await p.waitForTimeout(2000);
 ck(await p.evaluate(()=>ARC.pins().length===1&&ARC.pins()[0].id==='ARC-006'),'LOCKED records are public with no flag (a LOCKED find and its LOCKED site draw one pin)');
 await ctx.close();}
// a LOCKED site whose only find is not public still draws (the find is hidden, so the site is not skipped)
{const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();
 await p.route('**/data/archaeology.json',async r=>{const res=await r.fetch();const j=await res.json();for(const x of j.records){x.status=x.id==='ARC-005'?'LOCKED':'DRAFT';}await r.fulfill({response:res,json:j});});
 await p.goto(BASE+'archaeology.html');await p.waitForTimeout(2000);
 ck(await p.evaluate(()=>ARC.pins().length===1&&ARC.pins()[0].id==='ARC-005'),'a LOCKED site whose find is not public draws its own Site pin');
 await ctx.close();}
// nothing LOCKED: the page says the first finds are being checked
{const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();
 await p.route('**/data/archaeology.json',async r=>{const res=await r.fetch();const j=await res.json();for(const x of j.records)x.status='DRAFT';await r.fulfill({response:res,json:j});});
 await p.goto(BASE+'archaeology.html');await p.waitForTimeout(1800);
 ck(await p.evaluate(()=>ARC.pins().length===0&&/come back soon/.test(document.getElementById('story').textContent)),'with nothing LOCKED the public page draws no pins and says come back soon');
 await ctx.close();}
ck(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close();process.exit(bad?1:0);})();
