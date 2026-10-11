// F-081 page test: new/total badges for the admin only, shared across devices, reset by opening a list.
// Run: NODE_PATH=$(npm root -g) node tests/counts_ui.js  (server on :8778; real worker in-process, dummy secrets)
const {chromium}=require('playwright');const SITE=process.env.SITE||'http://localhost:8778/';const MW=require('./mockworker');
(async()=>{const mw=await MW.start(process.env.SEED||'/tmp/claude-0/rm/seed.csv');const b=await chromium.launch();let fail=0;const ck=(n,ok,x)=>{console.log((ok?'ok   ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
const mk=async(vp)=>{const ctx=await b.newContext({viewport:vp||{width:1000,height:800}});await mw.attach(ctx);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));return {ctx,p,errs};};
const unlock=async(p)=>{await p.fill('#gatePw',MW.CODE);await p.keyboard.press('Enter');await p.waitForTimeout(700);};
const adminIn=async(p)=>{await p.click('#arcListBtn');await p.waitForTimeout(300);await p.fill('#f_adm',MW.ADMIN);await p.click('#sheet .btn.pri');await p.waitForTimeout(900);await p.keyboard.press('Escape');};
const badge=async(p,id)=>((await p.locator('#'+id+' .nb').count())?(await p.textContent('#'+id+' .nb')).trim():null);
const navBadge=async(p,l)=>{const e=p.locator('#siteNavMenu [data-nav="'+l+'"] .sn-bad');return (await e.count())?(await e.textContent()).trim():null;};
mw.raw.exec("INSERT INTO roadmap_comments (feature_id,name,comment) VALUES ('F-001','A','c1'),('F-002','B','c2'),('F-002','C','c3')");
mw.raw.exec("INSERT INTO roadmap_suggestions (name,feature,accomplishes) VALUES ('A','Idea one','does a thing')");
mw.raw.exec("INSERT INTO feedback (visit_id,topic,message) VALUES ('v1','Idea','f1'),('v2','Problem','f2')");
// visitor: nothing
{const {ctx,p,errs}=await mk();await p.goto(SITE+'roadmap.html');await p.waitForTimeout(400);await unlock(p);
 ck('visitor: no badges on Team tools',(await p.locator('.nb').count())===0);
 await p.click('#siteNavBtn');ck('visitor: no badges in More',(await navBadge(p,'Roadmap'))===null&&(await navBadge(p,'Feedback'))===null);
 ck('visitor: no counts call made',!mw.log.some(x=>/\/roadmap\/counts/.test(x.url)));ck('visitor: no page errors',errs.length===0,errs);await ctx.close();}
// admin on device A
const A=await mk();await A.p.goto(SITE+'roadmap.html');await A.p.waitForTimeout(400);await unlock(A.p);await adminIn(A.p);await A.p.waitForTimeout(500);
ck('admin: View comments 3/3',(await badge(A.p,'cmtListBtn'))==='3/3',await badge(A.p,'cmtListBtn'));
ck('admin: Suggested features 1/1',(await badge(A.p,'sugListBtn'))==='1/1');
ck('admin: Feedback results 2/2',(await badge(A.p,'fbListBtn'))==='2/2');
await A.p.click('#siteNavBtn');ck('admin: More shows Roadmap 4/4 (comments plus recommendations)',(await navBadge(A.p,'Roadmap'))==='4/4',await navBadge(A.p,'Roadmap'));
ck('admin: More shows Feedback 2/2, to the right of the word',(await navBadge(A.p,'Feedback'))==='2/2'&&/^Feedback\s*2\/2$/.test((await A.p.textContent('#siteNavMenu [data-nav="Feedback"]')).trim()));
await A.p.keyboard.press('Escape');
// opening comments marks them and resets
await A.p.click('#cmtListBtn');await A.p.waitForTimeout(900);
ck('admin: new comments are tagged NEW in the list',(await A.p.locator('#sheet .w',{hasText:'NEW'}).count())===3);
await A.p.keyboard.press('Escape');await A.p.waitForTimeout(500);
ck('admin: comments badge resets to 0/3',(await badge(A.p,'cmtListBtn'))==='0/3',await badge(A.p,'cmtListBtn'));
ck('admin: other badges untouched (feedback 2/2)',(await badge(A.p,'fbListBtn'))==='2/2');
await A.p.click('#siteNavBtn');ck('admin: More Roadmap now 1/4 (the suggestion is still new)',(await navBadge(A.p,'Roadmap'))==='1/4',await navBadge(A.p,'Roadmap'));
await A.p.keyboard.press('Escape');
await A.p.click('#cmtListBtn');await A.p.waitForTimeout(700);ck('admin: second open shows no NEW tags',(await A.p.locator('#sheet .w',{hasText:'NEW'}).count())===0);await A.p.keyboard.press('Escape');
// shared across devices: device B (fresh browser, same database)
{const B=await mk({width:390,height:844});await B.p.goto(SITE+'roadmap.html');await B.p.waitForTimeout(400);await unlock(B.p);await adminIn(B.p);await B.p.waitForTimeout(500);
 ck('device B sees the same counts: comments 0/3',(await badge(B.p,'cmtListBtn'))==='0/3',await badge(B.p,'cmtListBtn'));
 ck('device B: feedback still 2/2',(await badge(B.p,'fbListBtn'))==='2/2');
 mw.raw.exec("INSERT INTO feedback (visit_id,topic,message) VALUES ('v3','Praise','f3')");
 await B.p.reload();await B.p.waitForTimeout(900);ck('a new feedback item shows 3/3 after reload',(await badge(B.p,'fbListBtn'))==='3/3',await badge(B.p,'fbListBtn'));
 await B.p.click('#fbListBtn');await B.p.waitForTimeout(900);ck('feedback list: all three tagged NEW, newest first',(await B.p.locator('#sheet .w',{hasText:'NEW'}).count())===3);
 await B.p.keyboard.press('Escape');await B.p.waitForTimeout(500);ck('feedback resets to 0/3',(await badge(B.p,'fbListBtn'))==='0/3');
 ck('device B: no page errors',B.errs.length===0,B.errs);await B.ctx.close();}
// More badge on the globe page for the admin tab
await A.p.goto(SITE+'index.html');await A.p.waitForTimeout(1500);await A.p.click('#siteNavBtn');
ck('globe page: admin sees Roadmap and Feedback badges in More',(await navBadge(A.p,'Roadmap'))==='1/4'&&(await navBadge(A.p,'Feedback'))==='0/3',[await navBadge(A.p,'Roadmap'),await navBadge(A.p,'Feedback')]);
ck('admin: no page errors',A.errs.length===0,A.errs);
await b.close();console.log(fail?fail+' FAILED':'all passed');process.exit(fail?1:0);})();
