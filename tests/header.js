// Header regroup: Play lives with Previous/Next; header holds Take a Quiz, Map key, toggle, Reset.
// Desktop widths (>960): one row. Narrower: title + Quiz on row 1, controls on row 2. Nothing off screen.
const {chromium}=require('playwright');
const W=[1440,1180,1024,961,960,901,834,768,621,430,390,360];
let bad=0;const ok=(c,m)=>{if(!c){bad++;console.log('FAIL',m);}};
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for(const w of W){
 const p=await (await b.newContext({viewport:{width:w,height:w>900?900:844}})).newPage();
 await p.goto('http://localhost:8778/');await p.waitForTimeout(1500);await p.evaluate(()=>dismissPrompt());await p.waitForTimeout(300);
 const r=await p.evaluate(()=>{
  const R=id=>document.getElementById(id).getBoundingClientRect();
  const ids=['quizLink','keyBtn','options','reset'];const rs=ids.map(R);
  return {inNav:!!document.querySelector('#panel .mnav #play'),inTools:!!document.querySelector('.tools #play'),
   rects:rs.map(x=>({l:x.left,r:x.right,t:x.top,b:x.bottom})),vw:innerWidth,sw:document.documentElement.scrollWidth,
   order:[...document.querySelectorAll('.mnav > *')].map(e=>e.id||e.tagName),
   brand:(()=>{const x=document.querySelector('.brand').getBoundingClientRect();return {r:x.right,b:x.bottom}})()};});
 ok(r.inNav&&!r.inTools,w+': Play is in the story nav, not the header');
 ok(r.order.join()==='prev,play,next'||r.order.includes('play'),w+': nav order '+r.order);
 ok(r.sw<=r.vw,w+': horizontal scroll '+r.sw+'>'+r.vw);
 r.rects.forEach((x,i)=>ok(x.l>=0&&x.r<=r.vw,w+': control '+i+' off screen '+x.l+'..'+x.r));
 const q=r.rects[0],k=r.rects[1],o=r.rects[2],rs=r.rects[3];
 if(w<=960)ok(q.r>=r.vw-40,w+': Take a Quiz not at the right edge '+q.r);else ok(rs.r>=r.vw-40,w+': Reset not at the right edge');
 if(w>960){ok([k,o,rs].every(x=>Math.abs(x.t-q.t)<6),w+': desktop controls not on one row');}
 else if(w>=390){ok([k,o,rs].every(x=>Math.abs(x.t-k.t)<6),w+': controls row 2 not level');ok(k.t>=q.b-2,w+': row 2 not below Quiz');}
 console.log(w,'quiz',Math.round(q.l)+'-'+Math.round(q.r),'row2 y',Math.round(k.t),'reset r',Math.round(rs.r));
 await p.screenshot({path:`/tmp/claude-0/comps/built-${w}.png`});await p.context().close();}
await b.close();console.log(bad?bad+' FAIL':'PASS');process.exit(bad?1:0);})();
