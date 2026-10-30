// Roadmap statuses Killed and Merged, JewHate footer data version, old-globe subtitle (v2.4.2). Run: SEED=/path/seed.csv NODE_PATH=$(npm root -g) node tests/roadmap_status.js  (server on :8778). Headless Chromium only.
const {chromium}=require('playwright');const SITE=process.env.SITE||'http://localhost:8778/';const MW=require('./mockworker');
(async()=>{const mw=await MW.start(process.env.SEED||'/tmp/claude-0/rm/seed.csv');const b=await chromium.launch();let fail=0;const ck=(n,ok,x)=>{console.log((ok?'ok   ':'FAIL ')+n+(x!==undefined&&!ok?' '+JSON.stringify(x):''));if(!ok)fail++;};
const ids=mw.raw.prepare("SELECT id FROM roadmap_features WHERE status='Approved' ORDER BY sort_order").all().map(r=>r.id);
const K=ids.slice(0,3),M=ids.slice(3,5);
K.forEach(i=>mw.raw.prepare("UPDATE roadmap_features SET status='Killed' WHERE id=?").run(i));M.forEach(i=>mw.raw.prepare("UPDATE roadmap_features SET status='Merged' WHERE id=?").run(i));
const base=mw.raw.prepare("SELECT COUNT(*) n FROM roadmap_features WHERE status IN ('In build','Approved','Idea','Parked')").get().n;
const mk=async(vp)=>{const ctx=await b.newContext({viewport:vp||{width:1366,height:800}});await mw.attach(ctx);const p=await ctx.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));return {ctx,p};};
const rowsShown=p=>p.$$eval('#tbody tr',t=>t.length);const idsShown=p=>p.$$eval('#tbody td.id',t=>t.map(x=>x.textContent));
const open=async(p,q)=>{await p.goto(SITE+'roadmap.html'+(q||''));await p.fill('#gatePw',MW.CODE);await p.keyboard.press('Enter');await p.waitForSelector('#tbody tr');};
// visitor
{const {ctx,p}=await mk();await open(p);
 const d=await idsShown(p);ck('default view hides Killed and Merged ('+d.length+' rows)',d.length===base&&[...K,...M].every(i=>!d.includes(i)),d.length);
 ck('the chip exists, labelled Show killed and merged',(await p.textContent('#showKilled')).trim()==='Show killed and merged'&&await p.getAttribute('#showKilled','aria-pressed')==='false');
 await p.click('#showKilled');const d2=await idsShown(p);ck('the chip reveals the 3 Killed and 2 Merged rows',d2.length===base+5&&[...K,...M].every(i=>d2.includes(i)),d2.length);
 ck('the chip shows as pressed',await p.getAttribute('#showKilled','aria-pressed')==='true');
 ck('Killed and Merged status text is displayed',(await p.$$eval('#tbody td.status',t=>t.map(x=>x.textContent))).filter(x=>x==='Killed').length===3);
 await p.click('#showKilled');ck('pressing again hides them again',(await rowsShown(p))===base);
 await p.click('#showAll');const d3=await idsShown(p);ck('Show all (Built and Live) does not bring back Killed or Merged',d3.length>base&&[...K,...M].every(i=>!d3.includes(i)));
 const opts=await p.$$eval('#fStatus option',o=>o.map(x=>x.value));ck('status filter lists Killed and Merged',opts.includes('Killed')&&opts.includes('Merged'),opts);
 await p.selectOption('#fStatus','Killed');ck('picking Killed in the status menu shows just those',(await rowsShown(p))===3);
 ck('no page errors (visitor)',p.errs.length===0,p.errs);await ctx.close();}
// admin: save and display both statuses
{const {ctx,p}=await mk();await open(p,'?admin');await p.click('#admBtn');await p.fill('#f_adm',MW.ADMIN);await p.click('#sheet .btn.pri');await p.waitForTimeout(900);
 const target=ids[6];const v0=mw.raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n;
 const row=p.locator('#tbody tr',{has:p.locator('td.id',{hasText:new RegExp('^'+target+'$')})});
 await row.locator('td.status').click();const so=await p.$$eval('#tbody select.ed option',o=>o.map(x=>x.value));ck('admin status dropdown offers Killed and Merged',so.includes('Killed')&&so.includes('Merged'),so);
 await p.selectOption('#tbody select.ed','Killed');await p.waitForTimeout(900);
 ck('admin can save Killed: written to the database as one new version',mw.raw.prepare('SELECT status FROM roadmap_features WHERE id=?').get(target).status==='Killed'&&mw.raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n===v0+1);
 ck('the row leaves the default view after it is killed',!(await idsShown(p)).includes(target));
 await p.click('#showKilled');const row2=p.locator('#tbody tr',{has:p.locator('td.id',{hasText:new RegExp('^'+target+'$')})});await row2.locator('td.status').click();await p.selectOption('#tbody select.ed','Merged');await p.waitForTimeout(900);
 ck('admin can save Merged',mw.raw.prepare('SELECT status FROM roadmap_features WHERE id=?').get(target).status==='Merged');
 ck('the summary names the change',/status Killed to Merged/.test(mw.raw.prepare('SELECT summary FROM roadmap_versions ORDER BY version_id DESC LIMIT 1').get().summary));
 ck('no page errors (admin)',p.errs.length===0,p.errs);await ctx.close();}
// old globe subtitle
for(const vp of [{width:1280,height:800},{width:390,height:844}]){
 const {ctx,p}=await mk(vp);await p.goto(SITE+'index.html');await p.waitForTimeout(2500);
 const s=await p.evaluate(()=>{const e=document.querySelector('.brand p'),c=getComputedStyle(e),r=e.getBoundingClientRect();return {txt:e.textContent,style:c.fontStyle,size:c.fontSize,color:c.color,shown:c.display!=='none'&&r.height>0,side:document.documentElement.scrollWidth<=innerWidth+1};});
 ck('index '+vp.width+': subtitle italic, visible, no sideways scroll',s.style==='italic'&&s.shown&&s.side&&/history of presence/i.test(s.txt),s);await ctx.close();}
await b.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);})();
