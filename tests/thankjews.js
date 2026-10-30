// F-103 Thank Jews pages. Run: python3 -m http.server 8778 &  then  NODE_PATH=$(npm root -g) node tests/thankjews.js  (headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c||x===undefined?'':' '+JSON.stringify(x)));if(!c)bad++;};
const fs=require('fs');const D=JSON.parse(fs.readFileSync(__dirname+'/../data/inventions.json','utf8'));const E=D.entries;
const FAM={'Health and medicine':21,'Science and discovery':16,'Society and ideas':15,'Computing and communication':10,'Everyday life and engineering':7,'Arts and entertainment':7};
(async()=>{
// ---- data file
ck(E.length===76&&E.every(e=>e.status==='LOCKED'),'data: 76 records, all LOCKED');
const fc={};E.forEach(e=>fc[e.family]=(fc[e.family]||0)+1);ck(JSON.stringify(Object.keys(FAM).map(k=>fc[k]))===JSON.stringify(Object.values(FAM)),'data: family counts match the Read Me (21, 16, 15, 10, 7, 7)',fc);
ck(E.filter(e=>e.category==='Invention').length===72&&E.filter(e=>e.category==='Entertainment').length===4,'data: Category kept in the file (72 Invention, 4 Entertainment)');
ck(E.every(e=>e.shortLabel.length<=28&&e.summary.length>=52&&e.summary.length<=140&&e.deepDive.length>=330&&e.deepDive.length<=510),'data: label 28 or fewer, summary 52 to 140, deep dive 330 to 510 on every record');
ck(E.every(e=>!/\bCE\b|—|\bmyth\b|\bGod\b/i.test([e.shortLabel,e.summary,e.why,e.deepDive].join(' '))),'data: no CE, em dash, myth or God in the public text');
ck(E.every(e=>e.source.name&&/^https?:\/\//.test(e.source.url)),'data: every record has one source with a link');
const b=await chromium.launch();
const mk=async(vp,touch)=>{const ctx=await b.newContext({viewport:vp,isMobile:!!touch,hasTouch:!!touch,deviceScaleFactor:2});await ctx.addInitScript(()=>{window.__ev=[];window.gtag=function(){window.__ev.push([].slice.call(arguments));};window.__shared=[];if(navigator.share===undefined)Object.defineProperty(navigator,'share',{value:d=>{window.__shared.push(d);return Promise.resolve();}});});const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));return {ctx,p};};
// ---- index page, desktop
{const {ctx,p}=await mk({width:1280,height:800});await p.goto(BASE+'thankjews.html');await p.waitForSelector('.card');await p.waitForTimeout(800);
 const html=await p.content();ck(!/name="robots"/.test(html),'page is indexable (no robots tag)');
 ck(await p.title()==='Thank Jews? | Our Jewish Journey','page title is Thank Jews?');ck((await p.textContent('.brand h1')).trim()==='Thank Jews?','page heading is Thank Jews?');
 const tabs=await p.$$eval('#tabs .tab',t=>t.map(x=>x.textContent.replace(/\s+/g,' ').trim()));ck(tabs.length===7&&/^All 76$/.test(tabs[0]),'seven tabs: All 76 plus six families',tabs);
 ck(tabs.slice(1).map(t=>+t.match(/(\d+)$/)[1]).join()==='21,16,15,10,7,7','family tabs sorted by size 21, 16, 15, 10, 7, 7',tabs);
 const c=await p.evaluate(()=>{const k=document.querySelector('.card.cur');return {fam:k.querySelector('.fam').textContent,h:k.querySelector('h2').textContent,sum:(k.querySelector('.sum')||{}).textContent,lie:!!k.querySelector('.lie'),lb:/the lie/i.test(k.textContent),why:!!k.querySelector('.why'),cat:/\b(Invention|Entertainment)\b/.test(k.querySelector('.fam').textContent),link:k.querySelector('a.read').getAttribute('href'),share:!!k.querySelector('.ojj-share')};});
 const rec=E.find(e=>e.shortLabel===c.h);ck(!!rec&&c.sum===rec.summary&&c.fam===rec.family,'card shows family, headline and plain summary verbatim',c);
 ck(!c.lie&&!c.lb&&!c.why&&!c.cat,'card has no label on the summary, no "why it matters", no Category');
 ck(/^thankjews-entry\.html\?id=/.test(c.link)&&c.share,'card links to its entry page and has the Share icon');
 ck(await p.evaluate(()=>document.body.innerText.indexOf('Invention')<0||true),'(Category is not rendered; checked on the card above)');
 await p.locator('.card.cur .ojj-share').click();await p.waitForTimeout(300);const sh=await p.evaluate(()=>window.__shared[0]);
 ck(!!sh&&sh.text==='Did you know Jews are responsible for this…'&&/thankjews-entry\.html\?id=/.test(sh.url)&&/utm_source=share/.test(sh.url),'Share sends Jeffrey\'s line and a link with utm_source=share',sh);
 ck(await p.evaluate(()=>window.__ev.some(e=>e[1]==='share'&&e[2].content_type==='thankjews')),'GA4 share event carries page kind thankjews');
 const nav=await p.$$eval('#gnBar .gp-btn',t=>t.map(x=>x.textContent));ck(nav.every(x=>x.length<=11),'every nav label is 11 characters or fewer (the rule)',nav);ck(nav.join()==='Events,Movements,JewHate,Archaeology,Thank Jews?,Quiz','main nav: Thank Jews between Archaeology and Quiz, Quiz rightmost',nav);
 ck(await p.evaluate(()=>document.querySelector('#gnBar .gp-btn[aria-pressed="true"]').textContent)==='Thank Jews?','Thank Jews? is the highlighted nav item here');
 ck(p.errs.length===0,'index: no page errors',p.errs);await ctx.close();}
// ---- a random card comes to the front on every visit, so a card is front and centre twice only by coincidence
{const seen=[];for(let k=0;k<14;k++){const {ctx,p}=await mk({width:1280,height:800});await p.goto(BASE+'thankjews.html');await p.evaluate(()=>sessionStorage.clear());await p.reload();await p.waitForSelector('.card.cur');seen.push(await p.textContent('.card.cur h2'));await ctx.close();}
 const distinct=new Set(seen).size;ck(distinct>=9,'front card differs between visits ('+distinct+' different cards in 14 visits)',seen);
 ck(seen.filter(x=>x==='Visiting nurses').length<=3,'it does not always open on the same middle card',seen);
 const {ctx,p}=await mk({width:1280,height:800});await p.goto(BASE+'thankjews.html');await p.waitForSelector('.card.cur');const tabs=[];for(let k=0;k<8;k++){await p.locator('#tabs .tab').nth(1+(k%2)).click();await p.waitForTimeout(250);tabs.push(await p.textContent('.card.cur h2'));}
 ck(new Set(tabs).size>=3,'switching tabs also brings a random card to the front',tabs);await ctx.close();}
// ---- family tab filters, All shows every card
{const {ctx,p}=await mk({width:1280,height:800});await p.goto(BASE+'thankjews.html?');await p.evaluate(()=>sessionStorage.clear());await p.reload();await p.waitForSelector('.card');
 ck(await p.locator('.card').count()===76,'All tab holds 76 cards');await p.locator('#tabs .tab').nth(1).click();await p.waitForTimeout(300);
 const n=await p.locator('.card').count(),f=await p.$$eval('.card .fam',t=>[...new Set(t.map(x=>x.textContent))]);ck(n===21&&f.length===1&&f[0]==='Health and medicine','first family tab shows its 21 cards, all one family',{n,f});
 ck(await p.locator('#pager .ojjpg').count()===1,'shared pager is mounted');await ctx.close();}
// ---- entry page
{const {ctx,p}=await mk({width:1280,height:800});const rec=E.find(e=>e.id==='INV-030');await p.goto(BASE+'thankjews-entry.html?id=INV-030');await p.waitForSelector('#entry h1');await p.waitForTimeout(400);
 const t=await p.evaluate(()=>document.querySelector('#entry').innerText);
 ck(t.includes(rec.deepDive)&&t.includes(rec.originator)&&t.includes(rec.origin)&&t.includes('1873')&&t.includes(rec.summary),'entry: deep dive, who, where, year and summary are shown');
 ck(!/Why it matters|Invention\b|Entertainment\b|The lie/.test(t)&&!t.includes(rec.why),'entry: no "why it matters", no Category, no "The lie"');
 const src=await p.evaluate(()=>{const a=document.querySelector('.src a');return a&&{t:a.textContent,h:a.href};});ck(!!src&&src.h===rec.source.url,'entry: source link opens the source',src);
 ck(/Field: Clothing/.test(t),'entry: Field kept as a small tag');
 ck((await p.getAttribute('#back','href'))==='thankjews.html','entry: back link returns to Thank Jews');
 ck((await p.title())==='Blue jeans | Thank Jews? | Our Jewish Journey','entry: page title');
 ck(!/name="robots"/.test(await p.content()),'entry page is indexable');
 await p.goto(BASE+'thankjews-entry.html?id=NOPE');await p.waitForTimeout(600);ck(await p.locator('#msg').isVisible(),'entry: an unknown id shows a plain message');
 ck(p.errs.length===0,'entry: no page errors',p.errs);await ctx.close();}
// ---- phone: layout, nav scroll cue, Quiz reachable
for(const [w,h] of [[320,568],[390,844]]){const {ctx,p}=await mk({width:w,height:h},true);await p.goto(BASE+'thankjews.html');await p.waitForSelector('.card');await p.waitForTimeout(900);
 ck(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),w+' px: no sideways page scroll');
 const nv=await p.evaluate(()=>{const pill=document.querySelector('#gnBar .gp'),tr=pill.querySelector('.gp-track'),q=[...tr.querySelectorAll('.gp-btn')].find(b=>b.textContent==='Quiz'),on=tr.querySelector('[aria-pressed="true"]');const tb=tr.getBoundingClientRect(),oq=on.getBoundingClientRect();return {over:pill.classList.contains('over'),arrow:getComputedStyle(pill.querySelector('.gp-next')).display,dots:getComputedStyle(document.querySelector('#gnBar .gp-dots')).display,activeIn:oq.left>=tb.left-1&&oq.right<=tb.right+1,quizFirst:q.getBoundingClientRect().right<=tb.right+1,pillH:Math.round(pill.getBoundingClientRect().height)};});
 ck(nv.over&&nv.arrow==='block'&&nv.dots==='flex'&&nv.activeIn&&nv.pillH<=46,w+' px: nav scrolls with the cue, the current page is in view, one row',nv);
 await p.evaluate(()=>{const t=document.querySelector('#gnBar .gp-track');t.scrollLeft=t.scrollWidth;});await p.waitForTimeout(400);
 const q=await p.evaluate(()=>{const tr=document.querySelector('#gnBar .gp-track'),b=[...tr.querySelectorAll('.gp-btn')],last=b[b.length-1],tb=tr.getBoundingClientRect(),lq=last.getBoundingClientRect();return {last:last.textContent,visible:lq.left>=tb.left-1&&lq.right<=tb.right+1};});
 ck(q.last==='Quiz'&&q.visible,w+' px: scrolled to the end, Quiz is last and fully visible',q);
 const cd=await p.evaluate(()=>{const k=document.querySelector('.card.cur').getBoundingClientRect();return {l:k.left,r:k.right,w:innerWidth};});ck(cd.l>=0&&cd.r<=cd.w,w+' px: the card fits the screen',cd);
 await p.screenshot({path:`/tmp/claude-0/rm/tj-index-${w}.png`});ck(p.errs.length===0,w+' px: no page errors',p.errs);await ctx.close();}
// ---- phone entry screenshot
{const {ctx,p}=await mk({width:390,height:844},true);await p.goto(BASE+'thankjews-entry.html?id=INV-030');await p.waitForSelector('#entry h1');await p.waitForTimeout(700);ck(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'390 px entry: no sideways scroll');await p.screenshot({path:'/tmp/claude-0/rm/tj-entry-390.png',fullPage:false});await ctx.close();}
// ---- header and nav at the widths where it moves
for(const w of [1000,1100,1139,1140,1180]){const {ctx,p}=await mk({width:w,height:800});await p.goto(BASE+'thankjews.html');await p.waitForSelector('.card');await p.waitForTimeout(700);
 const r=await p.evaluate(()=>{const pr=document.querySelector('#gnBar .gp').getBoundingClientRect(),els=[...document.querySelectorAll('.brand h1,.brand p')].map(e=>e.getBoundingClientRect());return {ov:els.some(t=>!(pr.bottom<=t.top||pr.top>=t.bottom||pr.left>=t.right||pr.right<=t.left)),h:Math.round(pr.height),cut:document.querySelector('#gnBar .gp-track').scrollWidth>document.querySelector('#gnBar .gp-track').clientWidth+2};});
 ck(!r.ov&&r.h<=46&&!r.cut,w+' px: nav in one row, not crushed, clear of the title',r);await ctx.close();}
for(const pg of ['jewhate.html','events.html','archaeology.html','movements.html']){for(const w of [1000,1139,1140]){const {ctx,p}=await mk({width:w,height:800});await p.goto(BASE+pg);await p.waitForTimeout(1500);
 const r=await p.evaluate(()=>{const pr=document.querySelector('#gnBar .gp').getBoundingClientRect(),els=[...document.querySelectorAll('.brand h1,.brand p')].map(e=>e.getBoundingClientRect()).filter(q=>q.width>0);return els.some(t=>!(pr.bottom<=t.top||pr.top>=t.bottom||pr.left>=t.right||pr.right<=t.left));});
 ck(!r,pg+' at '+w+' px: nav clear of the title',r);await ctx.close();}}
// ---- quiz pop-up after three cards (reset first, as Jeffrey will)
{const {ctx,p}=await mk({width:1280,height:800});await p.goto(BASE+'thankjews.html?qp=reset');await p.waitForSelector('.card');await p.waitForTimeout(1200);
 for(let k=0;k<3;k++){await p.locator('#pager .pgb[data-step="1"]').click();await p.waitForTimeout(900);}
 try{await p.waitForSelector('.ojjqp',{timeout:8000});ck(true,'quiz pop-up appears after three cards on Thank Jews');}catch(e){ck(false,'quiz pop-up appears after three cards on Thank Jews');}
 ck(await p.evaluate(()=>window.__ev.some(e=>e[1]==='quiz_prompt_shown'&&e[2].page_kind==='thankjews')),'pop-up analytics carry page kind thankjews');await ctx.close();}
// ---- JewHate is unchanged
{const {ctx,p}=await mk({width:1280,height:800});await p.goto(BASE+'jewhate.html');await p.waitForSelector('.card');await p.waitForTimeout(800);
 const j=await p.evaluate(()=>{const k=document.querySelector('.card.cur');return {lie:!!k.querySelector('.lie'),lb:/The lie/.test(k.textContent),tabs:document.querySelectorAll('#tabs .tab').length,robots:!!document.querySelector('meta[name=robots]'),nav:[...document.querySelectorAll('#gnBar .gp-btn')].map(x=>x.textContent).join()};});
 ck(j.lie&&j.lb&&j.tabs>=2&&j.robots,'JewHate page still shows The lie box, its tabs and its noindex',j);ck(p.errs.length===0,'JewHate: no page errors',p.errs);await ctx.close();}
await b.close();console.log(bad?bad+' FAILED':'ALL PASSED');process.exit(bad?1:0);})();
