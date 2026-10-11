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
 await p.evaluate(()=>OJJ_GATE.api('/roadmap'));await p.waitForTimeout(500);ck('expired token: login comes back with a plain message',await p.locator('#gatePw').isVisible()&&/session ended/i.test(await p.textContent('#gateErr')));await ctx.close();}

// ---- roadmap page: visitor view (password only)
{const {ctx,p,errs}=await mk({width:400,height:800});await p.goto(SITE+'roadmap.html');await p.waitForTimeout(400);await unlock(p);
 const heads=await p.$$eval('#thead th',a=>a.map(x=>x.textContent));
 ck('visitor: columns are ID, Feature, About, Recommended version, Status, Comments',heads.join('|')==='ID|Feature|About the feature|Recommended version|Status|Comments',heads);
 ck('visitor: help text shown',(await p.textContent('#help')).trim()==='Help shape the roadmap: tap any feature to leave a comment, or recommend a feature of your own.');
 ck('visitor: no search box, no owner filter, no admin buttons',await p.locator('#q').isHidden()&&await p.locator('#fOwner').isHidden()&&await p.locator('#admBar').isHidden()&&await p.locator('#colsBtn').isHidden()&&await p.locator('#expBtn').isHidden()&&await p.locator('#histBtn').isHidden());
 ck('visitor: no Source, Notes, Owner or Priority text anywhere on the page',!/Master doc s|WebDev-Handoff|Version plan/.test(await p.content()));
 const sb=await p.locator('#sugBtn').boundingBox(),fb=await p.locator('#fStatus').boundingBox();ck('visitor: Recommend a feature is on its own row, below the filters, right aligned',sb.y>fb.y+fb.height&&Math.abs(sb.x+sb.width-(400-16))<4,{sb,fb});
 ck('visitor 400px: page does not scroll sideways',!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)));
 await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(150);const nb=await p.locator('#siteNavBtn').boundingBox(),tw=await p.locator('#tw').boundingBox();
 ck('visitor 400px: nav tab does not cover the table',nb&&tw&&(nb.y>=tw.y+tw.height-1||nb.x+nb.width<=tw.x||nb.y+nb.height<=tw.y),{nb,tw});await p.evaluate(()=>window.scrollTo(0,0));
 const ctl=await p.$$eval('.bar button,.bar select,.pill',a=>a.filter(x=>x.offsetParent).map(x=>{const r=x.getBoundingClientRect();return [r.left,r.right,r.height];}));
 ck('visitor 400px: controls fit the screen and are 44 high',ctl.every(c=>c[0]>=0&&c[1]<=400&&c[2]>=43),ctl.filter(c=>c[1]>400||c[2]<43));
 await p.selectOption('#fStatus','Live');ck('visitor: status filter Live shows 12',(await p.locator('#tbody tr').count())===12);
 await p.selectOption('#fStatus','');await p.selectOption('#fArea','Quiz');const qn=await p.locator('#tbody tr').count();ck('visitor: area filter narrows rows',qn>0&&qn<69,qn);await p.selectOption('#fArea','');
 ck('visitor: comment cells invite a tap',/Tap to comment/.test(await p.locator('#tbody tr').first().locator('td.comments').textContent()));
 // comment
 const v0=vers();await p.locator('#tbody tr',{hasText:'F-002'}).first().click();await p.waitForTimeout(200);
 ck('visitor: tapping a row opens details with a comment box (no edit fields)',await p.locator('#c_text').isVisible()&&(await p.locator('#f_status').count())===0);
 await p.click('#sheet .btn.pri');ck('visitor: an empty comment is refused with a message',/write a comment/.test(await p.textContent('#sheet')));
 await p.fill('#c_text','<b id="boom">hi</b> Please add a hint.');await p.fill('#c_name','Dana');await p.click('#sheet .btn.pri');await p.waitForTimeout(700);
 ck('visitor: the comment is saved with the name; no roadmap version created',mw.raw.prepare("SELECT name,comment FROM roadmap_comments WHERE feature_id='F-002'").get().name==='Dana'&&vers()===v0);
 ck('visitor: the Comments cell now shows it, as text not markup',/1 comment/.test(await p.locator('#tbody tr',{hasText:'F-002'}).first().locator('td.comments').textContent())&&(await p.locator('#boom').count())===0);
 ck('visitor: thank-you message',/Thank you/.test(await p.textContent('#gmsg')));
 // recommend a feature
 await p.click('#sugBtn');const labs=await p.$$eval('#sheet label',a=>a.map(x=>x.textContent));
 ck('visitor: Recommend form asks name, accomplishes, about, vision',['Feature name','What the feature accomplishes','About the feature','Your vision for how it works','Your name (optional)'].every((x,i)=>labs[i]===x),labs);
 await p.click('#sheet .btn.pri');ck('visitor: Recommend needs the feature name and what it accomplishes',/fill in the feature name/.test(await p.textContent('#sheet')));
 await p.fill('#s_feature','Family tree view');await p.fill('#s_acc','Shows how families connect.');await p.fill('#s_about','A simple tree.');await p.fill('#s_vision','Tap a name, see the place.');await p.fill('#s_name','Sam');await p.click('#sheet .btn.pri');await p.waitForTimeout(700);
 const sug=mw.raw.prepare('SELECT * FROM roadmap_suggestions').get();ck('visitor: the idea is saved with all four answers',sug&&sug.feature==='Family tree view'&&sug.accomplishes.startsWith('Shows')&&sug.about==='A simple tree.'&&sug.vision.startsWith('Tap a name')&&sug.name==='Sam',sug);
 ck('visitor: thanks shown and panel closed',/Thank you/.test(await p.textContent('#gmsg'))&&await p.locator('#pnl').isHidden());
 // team tools: each asks for the admin code
 ck('visitor: Team tools row shows View comments, Suggested features and Feedback results',(await p.$$eval('#tools button',a=>a.map(x=>x.textContent))).join('|')==='View comments|Suggested features|Feedback results');
 ck('visitor 400px: Team tools fit the screen',await p.$$eval('#tools button',a=>a.every(x=>{const r=x.getBoundingClientRect();return r.left>=0&&r.right<=400&&r.height>=43;})));
 await p.click('#cmtListBtn');await p.waitForTimeout(300);ck('visitor: View comments asks for the admin code',await p.locator('#f_adm').isVisible()&&/admin code/i.test(await p.textContent('#sheet')));
 await p.fill('#f_adm','wrong');await p.click('#sheet .btn.pri');await p.waitForTimeout(500);ck('visitor: a wrong admin code is refused and nothing is shown',/Incorrect admin code/.test(await p.textContent('#sheet'))&&!/Comments \(/.test(await p.textContent('#sheet')));
 await p.fill('#f_adm',MW.ADMIN);await p.click('#sheet .btn.pri');await p.waitForTimeout(900);
 ck('visitor: the right admin code opens the comments list',/Comments \(1\)/.test(await p.textContent('#sheet'))&&/Please add a hint/.test(await p.textContent('#sheet')),(await p.textContent('#sheet')).slice(0,120));await p.keyboard.press('Escape');
 mw.raw.exec("INSERT INTO feedback (visit_id,topic,message,image) VALUES ('abcdefghij000001','Idea','Please add a family search.',NULL),('abcdefghij000002','Problem','The map is slow on my phone.','data:image/jpeg;base64,/9j/4AAQSkZJRg==')");
 await p.click('#fbListBtn');await p.waitForTimeout(700);ck('admin: Feedback results lists both messages (already unlocked, no second prompt)',/Feedback results \(2\)/.test(await p.textContent('#sheet'))&&/family search/.test(await p.textContent('#sheet'))&&await p.locator('#f_adm').count()===0);
 await p.locator('#sheet .cm button',{hasText:'Show photo'}).click();await p.waitForTimeout(500);ck('admin: Show photo loads the picture',await p.locator('#sheet .cm img').count()===1&&(await p.getAttribute('#sheet .cm img','src')).startsWith('data:image/jpeg;base64,'));await p.keyboard.press('Escape');
 mw.raw.exec("DELETE FROM feedback");
 // a hand-made call from the visitor's browser cannot edit
 await p.evaluate(()=>OJJ_GATE.setAdmin(''));
 const r=await p.evaluate(()=>OJJ_GATE.api('/roadmap/save',{method:'POST',body:{base_version:1,changes:[{id:'F-002',field:'status',value:'Idea'}]}}));ck('visitor: direct call to edit a row is refused (403)',r.status===403&&r.data.error==='admin_only',r);
 const r2=await p.evaluate(()=>OJJ_GATE.api('/roadmap/versions'));ck('visitor: direct call for the version history is refused (403)',r2.status===403,r2);
 ck('visitor: no page errors',errs.length===0,errs);await ctx.close();}
// ---- roadmap page: admin view (?admin plus the admin code)
{const {ctx,p,errs}=await mk({width:1000,height:800});await p.goto(SITE+'roadmap.html?admin');await p.waitForTimeout(400);await unlock(p);
 ck('admin view before unlock: admin buttons show but the data is still the visitor set',await p.locator('#admBar').isVisible()&&(await p.$$eval('#thead th',a=>a.length))===6);
 await p.click('#histBtn');await p.waitForTimeout(200);ck('admin view: history asks to unlock first',/Unlock admin first/.test(await p.textContent('#gmsg')));
 await p.click('#admBtn');await p.fill('#f_adm','nope');await p.click('#sheet .btn.pri');await p.waitForTimeout(500);ck('admin: wrong admin code is refused',/Incorrect admin code/.test(await p.textContent('#sheet')));
 await p.fill('#f_adm',MW.ADMIN);await p.click('#sheet .btn.pri');await p.waitForTimeout(800);
 const heads=await p.$$eval('#thead th',a=>a.map(x=>x.textContent));
 ck('admin: all 14 columns plus Comments, in the required order',heads.join('|')==='ID|Feature|About the feature|Area|Recommended version|My version|Status|Priority|Depends on|Gate|Effort|Owner|Source|Notes|Comments',heads);
 ck('admin: search, owner filter and Import CSV appear',await p.locator('#q').isVisible()&&await p.locator('#fOwner').isVisible()&&await p.locator('#impLbl').isVisible());
 await p.fill('#q','zzzzqqq');ck('admin: search with no match shows none',(await p.locator('#tbody tr').count())===0);await p.fill('#q','');ck('admin: cleared search shows 69',(await p.locator('#tbody tr').count())===69);
 await p.click('#colsBtn');await p.locator('#colsPop label',{hasText:'Notes'}).locator('input').uncheck();await p.keyboard.press('Escape');
 ck('admin: hiding Notes removes the column',!(await p.$$eval('#thead th',a=>a.map(x=>x.textContent))).includes('Notes'));
 await p.click('#colsBtn');await p.locator('#colsPop label',{hasText:'Notes'}).locator('input').check();await p.keyboard.press('Escape');
 const v0=vers();const f24=mw.raw.prepare("SELECT status FROM roadmap_features WHERE id='F-024'").get().status;
 await p.locator('#tbody tr',{hasText:'F-024'}).first().locator('td.status').click();await p.waitForTimeout(150);ck('admin: clicking a cell edits it in place, no dialog',await p.locator('td.editing select.ed').isVisible()&&await p.locator('#pnl').isHidden());
 await p.selectOption('td.editing select.ed','In build');await p.waitForTimeout(700);
 ck('admin: one save makes exactly one new version with the right summary',vers()===v0+1&&mw.raw.prepare('SELECT summary FROM roadmap_versions ORDER BY version_id DESC LIMIT 1').get().summary==='F-024 status '+f24+' to In build');
 ck('admin: change shows and panel closes',await p.locator('#pnl').isHidden()&&/In build/.test(await p.locator('#tbody tr',{hasText:'F-024'}).first().textContent()));
 await p.locator('#tbody tr',{hasText:'F-025'}).first().locator('td.notes').click();await p.fill('td.editing .ed','<b id="boom2">x</b><script>window.__x=1</script>');await p.keyboard.press('Control+Enter');await p.waitForTimeout(600);
 ck('admin: markup in a field is shown as text, not run',(await p.locator('#boom2').count())===0&&!(await p.evaluate(()=>window.__x)));
 {const vN=vers();await p.locator('#tbody tr',{hasText:'F-026'}).first().locator('td.notes').click();await p.keyboard.press('Escape');await p.waitForTimeout(300);ck('admin: Escape cancels an edit and makes no version',vers()===vN&&await p.locator('td.editing').count()===0);}
 // admin deletes a visitor comment
 await p.locator('#tbody tr',{hasText:'F-002'}).first().locator('td.comments').click();await p.waitForTimeout(200);ck('admin: the comments cell opens the visitor comment with a Delete button',await p.locator('#sheet .cm button').count()===1);
 await p.locator('#sheet .cm button').click();await p.waitForTimeout(800);ck('admin: Delete removes the comment',mw.raw.prepare('SELECT COUNT(*) n FROM roadmap_comments').get().n===0);
 {const ids=async()=>p.$$eval('#tbody td.id',a=>a.map(x=>x.textContent));
  await p.locator('#thead th',{hasText:'ID'}).locator('button').click();const up=await ids();ck('admin: first click on ID sorts ascending',up.slice().sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).join()===up.join()&&(await p.getAttribute('#thead th:first-child','aria-sort'))==='ascending');
  await p.locator('#thead th',{hasText:'ID'}).locator('button').click();const dn=await ids();ck('admin: second click sorts descending',dn.join()===up.slice().reverse().join());
  await p.locator('#thead th',{hasText:'ID'}).locator('button').click();ck('admin: third click returns to the saved order',(await p.getAttribute('#thead th:first-child','aria-sort'))==='none');
  await p.locator('#thead th',{hasText:'Status'}).locator('button').click();const sv=await p.$$eval('#tbody td.status',a=>a.map(x=>x.textContent));ck('admin: Status sorts as a table would',sv.slice().sort((a,b)=>a.localeCompare(b)).join()===sv.join());
  await p.locator('#thead th',{hasText:'Status'}).locator('button').click();await p.locator('#thead th',{hasText:'Status'}).locator('button').click();}
 await p.click('#histBtn');await p.waitForTimeout(500);ck('admin: history lists every version',(await p.locator('.vl li').count())===vers());
 ck('admin: history dates show Eastern time',/ET/.test(await p.locator('.vl li').first().textContent()));
 await p.locator('.vl li').last().locator('button').click();await p.waitForTimeout(500);ck('admin: an old version opens read only',/read only/.test(await p.textContent('#sheet')));
 const vR=vers();await p.locator('#sheet .btn.pri').click();ck('admin: first tap on Restore only asks to confirm',vers()===vR&&/confirm/i.test(await p.locator('#sheet .btn.pri').textContent()));
 await p.locator('#sheet .btn.pri').click();await p.waitForTimeout(800);ck('admin: second tap restores as a NEW version',vers()===vR+1&&mw.raw.prepare("SELECT status FROM roadmap_features WHERE id='F-024'").get().status===f24);
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#expBtn')]);const txt=require('fs').readFileSync(await dl.path(),'utf8');
 ck('admin: export CSV has the seed header and 69 rows',txt.startsWith('id,feature,about,area,rec,mine,status,deps,gate,effort,owner,source,notes,order,priority')&&txt.trim().split(/\r?\n/).length>=70);
 await p.click('#sugListBtn');await p.waitForTimeout(500);ck('admin: Suggestions lists the visitor idea',/Family tree view/.test(await p.textContent('#sheet'))&&/Tap a name/.test(await p.textContent('#sheet')));await p.keyboard.press('Escape');
 await p.locator('#tbody tr',{hasText:'F-001'}).first().locator('td.priority').click();await p.selectOption('td.editing select.ed','P1');await p.waitForTimeout(700);
 ck('admin: priority saved',mw.raw.prepare("SELECT priority FROM roadmap_features WHERE id='F-001'").get().priority==='P1');
 const fs=require('fs'),csv=txt.replace(/\r?\n$/,'').split(/\r?\n/).slice(0,4).join('\r\n')+'\r\n';fs.writeFileSync('/tmp/imp-test.csv',csv);
 p.on('dialog',d=>d.accept('Admin'));await p.setInputFiles('#impFile','/tmp/imp-test.csv');await p.waitForTimeout(900);
 ck('admin: CSV import replaces the rows (3 rows)',mw.raw.prepare('SELECT COUNT(*) n FROM roadmap_features').get().n===3&&/Imported 3 rows/.test(await p.textContent('#gmsg')),await p.textContent('#gmsg'));
 ck('admin: no page errors',errs.length===0,errs);await ctx.close();}
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
