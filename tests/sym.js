const {chromium}=require('playwright');const S=process.argv[2]||'tests/out';require('fs').mkdirSync(S+'/reg',{recursive:true});(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(''+(process.env.SITE||'http://localhost:8778/')+'');await p.waitForTimeout(2500);
const out={};
for(const y of [69,70,114,115,120]){out[y]=await p.evaluate(y=>{dismissPrompt();closeStory();setYearExact(y);return document.querySelectorAll('#lMark .sym').length},y);}
await p.evaluate(()=>{setYearExact(116)});await p.waitForTimeout(300);
const box=await p.evaluate(()=>{const g=document.querySelector('#lMark .sym');const r=g.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});
await p.screenshot({path:S+'/reg/sym116.png',clip:{x:Math.max(0,box[0]-260),y:Math.max(0,box[1]-160),width:560,height:360}});
await p.evaluate(()=>{document.querySelector('#lMark .sym').dispatchEvent(new MouseEvent('click',{bubbles:true}))});
out.card=await p.evaluate(()=>[$('storyKicker').textContent,$('storyDate').textContent,$('storyTitle').textContent,$('storyText').textContent]);
await p.evaluate(()=>{$('keyBtn').click()});await p.waitForTimeout(200);
const k=await p.evaluate(()=>{const r=$('key').getBoundingClientRect();return [r.x,r.y,r.width,r.height]});await p.screenshot({path:S+'/reg/key.png',clip:{x:k[0],y:k[1],width:k[2],height:k[3]}});
out.r=await p.evaluate(()=>{const m=DATA.movements.find(m=>m.id==='r');fillStory(m,'movement',true);return $('storyText').textContent});
out.src=await p.evaluate(()=>{openSources();return [...document.querySelectorAll('#allSources li')].some(li=>li.textContent.includes('Forgotten Revolt'))});
console.log(JSON.stringify(out,null,1),errs);await b.close();})();
