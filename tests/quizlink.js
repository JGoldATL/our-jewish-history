// "Take a Quiz" pill in the globe header: present, points to quiz.html, tap target size, no overlap with the other controls, no horizontal scroll.
// Run: NODE_PATH=$(npm root -g) node tests/quizlink.js   (server on :8778)
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for(const [name,vp,min] of [['desktop',{width:1440,height:900},44],['ipad',{width:820,height:1180},44],['iphone',{width:390,height:844},38],['iphone SE',{width:320,height:568},38]]){
  const p=await (await b.newContext({viewport:vp,deviceScaleFactor:name.startsWith('iphone')?2:1})).newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8778/');await p.waitForTimeout(2200);await p.evaluate(()=>dismissPrompt());await p.waitForTimeout(300);
  const r=await p.evaluate(()=>{const a=document.getElementById('quizLink'),q=a.getBoundingClientRect();
    const others=[...document.querySelectorAll('.tools > *')].filter(x=>x!==a&&x.getBoundingClientRect().width>0).map(x=>x.getBoundingClientRect());
    const overlap=others.some(o=>!(q.right<=o.left+.5||q.left>=o.right-.5||q.bottom<=o.top+.5||q.top>=o.bottom-.5));
    return {text:a.textContent.trim(),href:a.getAttribute('href'),h:Math.round(q.height),left:Math.round(q.left),right:Math.round(q.right),overlap,hs:document.documentElement.scrollWidth>innerWidth,vis:q.width>0&&q.left>=0&&q.right<=innerWidth};});
  ok(r.text==='Take a Quiz'&&r.href==='quiz.html',name+': label and link ('+r.text+' -> '+r.href+')');
  ok(r.h>=min,name+': tap target '+r.h+' px (min '+min+')');
  ok(!r.overlap,name+': no overlap with other header controls');
  ok(r.vis&&!r.hs,name+': fully on screen, no horizontal scroll');
  ok(!errs.length,name+': no page errors');
  if(name==='desktop'||name==='iphone')await p.screenshot({path:`/tmp/claude-0/comps/final-${name.replace(' ','')}.png`,clip:{x:0,y:0,width:vp.width,height:name==='desktop'?120:330}});
  if(name==='desktop'){await Promise.all([p.waitForURL(/quiz\.html/),p.click('#quizLink')]);ok(await p.waitForSelector('#stage .card',{timeout:8000}).then(()=>true,()=>false),'click opens the quiz page and a question shows');}
  await p.context().close();}
await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
