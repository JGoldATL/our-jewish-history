// F-166 combined religion-spread draft page. Run: NODE_PATH=$(npm root -g) node tests/religion_draft.js (needs python3 -m http.server 8778 in the repo root; about 3 minutes under software WebGL)
const {chromium}=require('playwright');let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const [w,h] of [[390,844],[820,1180],[1024,768],[1280,800]]){const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();const errs=[],reqs=[];
 p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/status of 404/.test(m.text()))errs.push(m.text());});p.on('response',r=>{if(r.status()>=400&&!/judaism-draft/.test(r.url()))errs.push(r.status()+' '+r.url());});   // data/judaism-draft.json is optional until Dataset's tabs exist: its 404 is expectedp.on('request',r=>reqs.push(r.url()));
 await p.goto('http://localhost:8778/religion-draft.html');await p.waitForSelector('#card',{timeout:20000});await p.waitForTimeout(800);
 const info=await p.evaluate(()=>({n:document.querySelectorAll('.tick').length,robots:(document.querySelector('meta[name=robots]')||{}).content,gtag:typeof window.gtag,msg:document.getElementById('msg').textContent,badge:!document.getElementById('draftbadge').hidden,body:document.body.innerText}));
 ok(errs.length===0&&!info.msg,w+' no errors '+errs.join('|').slice(0,120)+info.msg);ok(info.n===8,w+' 8 shared steps ('+info.n+')');
 ok(/noindex/.test(info.robots)&&info.gtag==='undefined'&&!reqs.some(u=>/googletagmanager|google-analytics/.test(u)),w+' noindex, no gtag, no GA4 request');
 ok(!/disputed|Palestine/i.test(await p.evaluate(()=>document.getElementById('card').textContent)),w+' no banned words in cards');
 const yr=()=>p.textContent('#yr');
 for(let i=0;i<7;i++)await p.click('#next');await p.waitForTimeout(200);
 ok(await yr()==='2000'&&await p.evaluate(()=>document.getElementById('next').disabled),w+' 7 Next clicks reach 2000, Next disabled');
 ok(await p.evaluate(()=>/Islam/.test(document.getElementById('card').textContent)&&/Christianity/.test(document.getElementById('card').textContent)),w+' last step shows both layers\' cards');
 for(let i=0;i<7;i++)await p.click('#prev');await p.waitForTimeout(200);
 ok(await yr()==='400'&&await p.evaluate(()=>document.getElementById('prev').disabled),w+' 7 Prev clicks return to 400');
 // chips
 await p.click('.chip[data-l=christ]');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>document.getElementById('draftbadge').hidden),w+' Draft badge hides when Christianity is off');
 await p.click('.chip[data-l=islam]');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>document.querySelector('.chip[data-l=islam]').getAttribute('aria-pressed')==='true'),w+' the last layer cannot be switched off');
 await p.click('.chip[data-l=christ]');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>!document.getElementById('draftbadge').hidden),w+' Draft badge returns with Christianity');
 // drag slider to the end; play from start
 await p.evaluate(()=>{const s=document.getElementById('sl');s.value=s.max;s.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(250);
 ok(await yr()==='2000',w+' dragged slider reaches 2000');
 await p.evaluate(()=>document.querySelectorAll('.tick')[0].click());await p.click('#play');
 await p.waitForFunction(()=>document.getElementById('yr').innerText==='2000'&&document.getElementById('play').innerText==='Play',null,{timeout:150000}).then(()=>ok(true,w+' Play runs to 2000 and stops')).catch(()=>ok(false,w+' Play did not reach 2000'));
 ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),w+' no sideways scroll');
 await ctx.close();}
console.log(f?'FAILURES '+f:'ALL PASS');await b.close();process.exit(f?1:0);})();
