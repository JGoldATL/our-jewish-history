// Gate, Roadmap and Feedback pages (v0.5.0 branch). Run: NODE_PATH=$(npm root -g) node tests/gate.js  (server on :8778)
const {chromium}=require('playwright');const SITE=process.env.SITE||'http://localhost:8778/';
(async()=>{const b=await chromium.launch();let fail=0;const ck=(n,ok,x)=>{console.log((ok?'ok   ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
const ERR='Incorrect Password. Try again.';
for(const pg of ['strategy.html','roadmap.html']){
  const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  let docs=0;await p.route('**/docs.google.com/**',r=>{docs++;r.fulfill({status:200,contentType:'text/html',body:'<p>deck</p>'});});
  await p.goto(SITE+pg);await p.waitForTimeout(500);
  ck(pg+': locked on first visit (login shown, content hidden)',await p.locator('#gatePw').isVisible()&&await p.locator('#gated').isHidden());
  ck(pg+': nothing requested from Google while locked',docs===0,docs);
  await p.fill('#gatePw','1896');await p.click('.gate button');
  ck(pg+': wrong password shows the exact message',(await p.textContent('#gateErr')).trim()===ERR,await p.textContent('#gateErr'));
  ck(pg+': still locked after a wrong password',await p.locator('#gated').isHidden());
  await p.fill('#gatePw','');await p.click('.gate button');ck(pg+': empty password is also refused',(await p.textContent('#gateErr')).trim()===ERR);
  await p.fill('#gatePw','1897');await p.keyboard.press('Enter');await p.waitForTimeout(600);
  ck(pg+': 1897 opens the page',await p.locator('#gated').isVisible()&&await p.locator('#gateMount').isHidden());
  if(pg==='strategy.html')ck(pg+': deck loads only after unlock',docs>0&&(await p.getAttribute('#deck','src')).includes('/presentation/d/'));
  else ck(pg+': roadmap placeholder shows until a link is set',await p.locator('#roadEmpty').isVisible());
  await p.reload();await p.waitForTimeout(400);ck(pg+': stays open for the rest of the session',await p.locator('#gated').isVisible());
  ck(pg+': no page errors',errs.length===0,errs);await ctx.close();}
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
