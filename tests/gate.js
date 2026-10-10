// Gate, Roadmap, Strategy and Feedback pages (v0.5.0). Run: SEED=/path/roadmap-seed.csv NODE_PATH=$(npm root -g) node tests/gate.js  (server on :8778)
// The Worker is the real worker/worker.js run in-process behind Playwright (dummy secrets, in-memory database, seeded from the CSV).
const {chromium}=require('playwright');const SITE=process.env.SITE||'http://localhost:8778/';const MW=require('./mockworker');
(async()=>{const mw=await MW.start(process.env.SEED||'/tmp/claude-0/rm/seed.csv');const b=await chromium.launch();let fail=0;const ck=(n,ok,x)=>{console.log((ok?'ok   ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
const ERR='Incorrect Password. Try again.';const vers=()=>mw.raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n;
const mk=async(vp)=>{const ctx=await b.newContext({viewport:vp||{width:390,height:844},acceptDownloads:true});await mw.attach(ctx);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));return {ctx,p,errs};};
const unlock=async(p,code)=>{await p.fill('#gatePw',code||MW.CODE);await p.keyboard.press('Enter');await p.waitForTimeout(700);};
// ---- gate on both private pages
for(const pg of ['strategy.html','roadmap.html']){
  const {ctx,p,errs}=await mk();let docs=0;await p.route('**/docs.google.com/**',r=>{docs++;r.fulfill({status:200,contentType:'text/html',body:'<p>deck</p>'});});
  mw.log.length=0;await p.goto(SITE+pg);await p.waitForTimeout(500);
  ck(pg+': locked on first visit (login shown, content hidden)',await p.locator('#gatePw').isVisible()&&await p.locator('#gated').isHidden());
  ck(pg+': nothing loaded while locked (no Worker data call, nothing from Google)',mw.log.filter(x=>!/\/gate$/.test(x.url)).length===0&&docs===0);
  ck(pg+': no password or deck link in the page source',!/1897/.test(await p.content())&&!/presentation\/d\//.test(await p.content()));
  await p.fill('#gatePw','1896');await p.click('.gate button');await p.waitForTimeout(400);
  ck(pg+': wrong password shows the exact message',(await p.textContent('#gateErr')).trim()===ERR,await p.textContent('#gateErr'));
  ck(pg+': still locked after a wrong password',await p.locator('#gated').isHidden());
  await p.fill('#gatePw','');await p.click('.gate button');ck(pg+': empty password is also refused',(await p.textContent('#gateErr')).trim()===ERR);
  await unlock(p);
  ck(pg+': the right password opens the page',await p.locator('#gated').isVisible()&&await p.locator('#gateMount').isHidden());
  if(pg==='strategy.html')ck(pg+': deck loads only after unlock',docs>0&&(await p.getAttribute('#deck','src')).includes('/presentation/d/TESTDECK'),await p.getAttribute('#deck','src'));
  else ck(pg+': 69 rows load only after unlock',(await p.locator('#tbody tr').count())===69,await p.locator('#tbody tr').count());
  await p.reload();await p.waitForTimeout(700);ck(pg+': stays open for the rest of the session (reload)',await p.locator('#gated').isVisible());
  ck(pg+': no page errors',errs.length===0,errs);await ctx.close();}
// a fresh browser session is locked again
{const {ctx,p}=await mk();await p.goto(SITE+'roadmap.html');await p.waitForTimeout(400);ck('new session: locked again',await p.locator('#gated').isHidden());await ctx.close();}
// storage blocked: the gate still works for the page's life
{const {ctx,p,errs}=await mk();await p.addInitScript(()=>{const t=()=>{throw new Error('blocked')};Object.defineProperty(window,'sessionStorage',{get:t});Object.defineProperty(window,'localStorage',{get:t});});await p.goto(SITE+'roadmap.html');await p.waitForTimeout(400);await unlock(p);
 ck('storage blocked: still opens and loads rows',(await p.locator('#tbody tr').count())===69&&errs.length===0,errs);await ctx.close();}
// expired token: any call relocks the page
{const {ctx,p}=await mk();await p.goto(SITE+'roadmap.html');await p.waitForTimeout(400);await unlock(p);await p.evaluate(()=>sessionStorage.setItem('ojj-gate-token','gate.1.'+'0'.repeat(64)));
 await p.click('#histBtn');await p.waitForTimeout(500);ck('expired token: login comes back with a plain message',await p.locator('#gatePw').isVisible()&&/session ended/i.test(await p.textContent('#gateErr')));await ctx.close();}

// ---- roadmap page
{const {ctx,p,errs}=await mk({width:400,height:800});await p.goto(SITE+'roadmap.html');await p.waitForTimeout(400);await unlock(p);
 const heads=await p.$$eval('#thead th',a=>a.map(x=>x.textContent));
 ck('roadmap: 14 columns in the required order',heads.join('|')==='ID|Feature|About the feature|Area|Recommended version|My version|Status|Priority|Depends on|Gate|Effort|Owner|Source|Notes',heads);
 ck('roadmap: meta line shows 69 of 69',/^69 of 69 features/.test(await p.textContent('#meta')),await p.textContent('#meta'));
 // phone layout
 ck('roadmap 400px: page does not scroll sideways (only the table does)',!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));
 await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(150);const nb=await p.locator('#siteNavBtn').boundingBox();const tw=await p.locator('#tw').boundingBox();ck('roadmap 400px: nav tab does not cover the table',nb&&tw&&(nb.y>=tw.y+tw.height-1||nb.x+nb.width<=tw.x||nb.y+nb.height<=tw.y),{nb,tw});
 const ctl=await p.$$eval('.bar > *, .bar button, .bar select, .bar input',a=>a.filter(x=>x.offsetParent).map(x=>{const r=x.getBoundingClientRect();return [r.left,r.right,r.bottom,r.height];}));
 ck('roadmap 400px: every control fits the screen and is at least 44 high',ctl.every(c=>c[0]>=0&&c[1]<=400&&c[3]>=43),ctl.filter(c=>c[1]>400||c[3]<43));
 await p.evaluate(()=>window.scrollTo(0,0));
 // filters + search
 await p.selectOption('#fStatus','Live');ck('roadmap: status filter Live shows 12',(await p.locator('#tbody tr').count())===12);
 await p.selectOption('#fStatus','');await p.selectOption('#fArea','Quiz');const qn=await p.locator('#tbody tr').count();ck('roadmap: area filter narrows rows',qn>0&&qn<69,qn);
 await p.selectOption('#fArea','');await p.fill('#q','zzzzqqq');ck('roadmap: search with no match shows none',(await p.locator('#tbody tr').count())===0);await p.fill('#q','');
 ck('roadmap: cleared filters show all 69 again',(await p.locator('#tbody tr').count())===69);
 // columns chooser
 await p.click('#colsBtn');await p.locator('#colsPop label',{hasText:'Notes'}).locator('input').uncheck();await p.keyboard.press('Escape');
 ck('roadmap: hiding Notes removes the column',!(await p.$$eval('#thead th',a=>a.map(x=>x.textContent))).includes('Notes'));
 await p.reload();await p.waitForTimeout(700);ck('roadmap: hidden column remembered after reload',!(await p.$$eval('#thead th',a=>a.map(x=>x.textContent))).includes('Notes'));
 await p.click('#colsBtn');await p.locator('#colsPop label',{hasText:'Notes'}).locator('input').check();await p.keyboard.press('Escape');
 // edit
 const v0=vers();const f24=mw.raw.prepare("SELECT status FROM roadmap_features WHERE id='F-024'").get().status;
 await p.locator('#tbody tr',{hasText:'F-024'}).first().click();await p.waitForTimeout(200);
 ck('roadmap: tapping a row opens the edit panel',await p.locator('#pnl').isVisible());
 ck('roadmap: priority is disabled for a non-admin',await p.locator('#f_priority').isDisabled());
 await p.selectOption('#f_status','In build');await p.fill('#f_name','Tester');await p.click('#sheet .btn.pri');await p.waitForTimeout(700);
 ck('roadmap: one save makes exactly one new version with the right summary',vers()===v0+1&&mw.raw.prepare('SELECT summary FROM roadmap_versions ORDER BY version_id DESC LIMIT 1').get().summary==='F-024 status '+f24+' to In build');
 ck('roadmap: the change shows in the table and the panel closes',await p.locator('#pnl').isHidden()&&/In build/.test(await p.locator('#tbody tr',{hasText:'F-024'}).first().textContent()));
 ck('roadmap: saved message shows',/Saved as version/.test(await p.textContent('#gmsg')),await p.textContent('#gmsg'));
 // text is plain text, never markup
 await p.locator('#tbody tr',{hasText:'F-025'}).first().click();await p.fill('#f_notes','<b id="boom">x</b><script>window.__x=1</script>');await p.click('#sheet .btn.pri');await p.waitForTimeout(600);
 ck('roadmap: markup in a field is shown as text, not run',(await p.locator('#boom').count())===0&&!(await p.evaluate(()=>window.__x)));
 // nothing-changed save
 await p.locator('#tbody tr',{hasText:'F-026'}).first().click();const vN=vers();await p.click('#sheet .btn.pri');await p.waitForTimeout(300);ck('roadmap: saving with nothing changed makes no version',vers()===vN&&/Nothing changed/.test(await p.textContent('#sheet')));await p.keyboard.press('Escape');
 // history + restore
 await p.click('#histBtn');await p.waitForTimeout(500);const items=await p.locator('.vl li').count();ck('roadmap: history lists every version',items===vers(),items);
 ck('roadmap: history dates show Eastern time',/ET/.test(await p.locator('.vl li').first().textContent()));
 await p.locator('.vl li').last().locator('button').click();await p.waitForTimeout(500);
 ck('roadmap: an old version opens read only',/read only/.test(await p.textContent('#sheet'))&&(await p.locator('#sheet input[type=text]').count())===1);
 const vR=vers();await p.locator('#sheet .btn.pri').click();ck('roadmap: first tap on Restore only asks to confirm',vers()===vR&&/confirm/i.test(await p.locator('#sheet .btn.pri').textContent()));
 await p.locator('#sheet .btn.pri').click();await p.waitForTimeout(800);
 ck('roadmap: second tap restores as a NEW version (nothing deleted)',vers()===vR+1&&mw.raw.prepare("SELECT status FROM roadmap_features WHERE id='F-024'").get().status===f24);
 // export
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#expBtn')]);const txt=require('fs').readFileSync(await dl.path(),'utf8');
 ck('roadmap: export CSV has the seed header and 69 data rows',txt.startsWith('id,feature,about,area,rec,mine,status,deps,gate,effort,owner,source,notes,order,priority')&&txt.trim().split(/\r?\n/).length>=70,txt.split(/\r?\n/)[0]);
 // priority admin
 ck('roadmap: Import CSV hidden for non-admin',await p.locator('#impLbl').isHidden());
 await p.click('#admBtn');await p.fill('#f_adm','nope');await p.click('#sheet .btn.pri');await p.waitForTimeout(500);ck('roadmap: wrong admin code is refused',/Incorrect admin code/.test(await p.textContent('#sheet')));
 await p.fill('#f_adm',MW.ADMIN);await p.click('#sheet .btn.pri');await p.waitForTimeout(800);
 ck('roadmap: admin code unlocks priority and import',await p.locator('#impLbl').isVisible()&&/priority unlocked/.test(await p.textContent('#meta')));
 await p.locator('#tbody tr',{hasText:'F-001'}).first().click();ck('roadmap: priority is editable for the admin',await p.locator('#f_priority').isEnabled());
 await p.selectOption('#f_priority','P1');await p.click('#sheet .btn.pri');await p.waitForTimeout(700);
 ck('roadmap: admin priority saved',mw.raw.prepare("SELECT priority FROM roadmap_features WHERE id='F-001'").get().priority==='P1');
 // import
 const fs=require('fs'),csv=txt.replace(/\r?\n$/,'').split(/\r?\n/).slice(0,4).join('\r\n')+'\r\n';fs.writeFileSync('/tmp/imp-test.csv',csv);
 p.on('dialog',d=>d.accept('Admin'));await p.setInputFiles('#impFile','/tmp/imp-test.csv');await p.waitForTimeout(900);
 ck('roadmap: admin CSV import replaces the rows (3 rows)',mw.raw.prepare('SELECT COUNT(*) n FROM roadmap_features').get().n===3&&/Imported 3 rows/.test(await p.textContent('#gmsg')),await p.textContent('#gmsg'));
 ck('roadmap: no page errors',errs.length===0,errs);await ctx.close();}
// priority lock on the wire: even a hand-made call from a normal browser is refused
{const {ctx,p}=await mk();await p.goto(SITE+'roadmap.html');await p.waitForTimeout(400);await unlock(p);
 const r=await p.evaluate(()=>OJJ_GATE.api('/roadmap/save',{method:'POST',body:{base_version:1,changes:[{id:'F-002',field:'priority',value:'P2'}]}}));
 ck('direct route call to set priority without admin: 403',r.status===403&&r.data.error==='priority_locked',r);await ctx.close();}
// nav and Back to the globe from the private pages
{const {ctx,p}=await mk();await p.goto(SITE+'roadmap.html');await p.waitForTimeout(400);
 ck('roadmap: shared nav and Back to the globe are available while locked',await p.locator('#siteNavBtn').isVisible()&&await p.locator('#backGlobe').isVisible());
 await p.locator('#backGlobe').click();await p.waitForTimeout(600);ck('roadmap: Back to the globe goes to the globe',/\/(index\.html)?$/.test(p.url()),p.url());
 await p.goto(SITE+'index.html');await p.waitForTimeout(1500);await p.evaluate(()=>{try{dismissPrompt()}catch(e){}});await p.click('#siteNavBtn');
 await Promise.all([p.waitForURL('**/roadmap.html'),p.locator('#siteNavMenu a[href="roadmap.html"]').click()]);ck('globe: nav opens Roadmap',/roadmap\.html$/.test(p.url()));await ctx.close();}
// feedback page
{const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[],posts=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/workers\.dev/,r=>{posts.push(JSON.parse(r.request().postData()));r.fulfill({status:204,body:''});});
 await p.goto(SITE+'feedback.html');await p.waitForTimeout(400);
 ck('feedback: not gated, no robots block',await p.locator('#fbMsg').isVisible()&&(await p.locator('meta[name=robots]').count())===0);
 ck('feedback: Send disabled while empty',await p.locator('#fbSend').isDisabled());
 await p.fill('#fbMsg','Great map. The Ur arrow is lovely.');ck('feedback: Send enabled with a message',await p.locator('#fbSend').isEnabled());
 await p.click('#fbSend');await p.waitForTimeout(300);
 ck('feedback: preview host sends nothing and says so',posts.length===0&&/Preview only/.test(await p.textContent('#fbStatus')));
 await p.goto(SITE+'feedback.html?logtest=1');await p.waitForTimeout(300);await p.selectOption('#fbTopic','Idea');await p.fill('#fbMsg','Please add a family search.');await p.click('#fbSend');await p.waitForTimeout(500);
 ck('feedback: ?logtest=1 sends one row with only the planned fields',posts.length===1&&Object.keys(posts[0]).sort().join()==='kind,message,topic,visit_id'&&posts[0].kind==='feedback'&&posts[0].topic==='Idea'&&/^test-[a-z0-9]{12,32}$/.test(posts[0].visit_id),posts[0]);
 ck('feedback: thanks shown and box cleared',/Thank you/.test(await p.textContent('#fbStatus'))&&(await p.inputValue('#fbMsg'))==='');
 // photo: a big PNG is shrunk to a JPEG data URL, shown as a thumbnail, sent with the message, and removable
 await p.goto(SITE+'feedback.html?logtest=1');await p.waitForTimeout(300);
 const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=3000;c.height=2000;const x=c.getContext('2d');x.fillStyle='#39c';x.fillRect(0,0,3000,2000);x.fillStyle='#fc3';x.fillRect(200,200,1500,900);return c.toDataURL('image/png').split(',')[1];});
 await p.setInputFiles('#fbImg',{name:'shot.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await p.waitForTimeout(700);
 ck('feedback: photo shows a thumbnail',await p.locator('#fbThumb').isVisible());
 await p.click('#fbRm');ck('feedback: Remove image clears it',await p.locator('#fbThumb').isHidden());
 await p.setInputFiles('#fbImg',{name:'shot.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await p.waitForTimeout(700);
 await p.fill('#fbMsg','Screenshot attached');posts.length=0;await p.click('#fbSend');await p.waitForTimeout(600);
 const im=posts[0]&&posts[0].image;ck('feedback: photo sent as a JPEG data URL under the size cap',!!im&&im.startsWith('data:image/jpeg;base64,/9j/')&&im.length<880000,im&&im.length);
 const dim=await p.evaluate(src=>new Promise(r=>{const i=new Image();i.onload=()=>r([i.width,i.height]);i.src=src;}),im);ck('feedback: longest side shrunk to 1280',Math.max(...dim)===1280,dim);
 ck('feedback: thumbnail cleared after sending',await p.locator('#fbThumb').isHidden());
 const sw=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);ck('feedback: no sideways scroll',!sw);
 ck('feedback: no page errors',errs.length===0,errs);await ctx.close();}
console.log(fail?'FAIL '+fail:'PASS');await b.close();process.exit(fail?1:0);})();
