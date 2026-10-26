// CEO 10/20: every arrow on every map is 100% opaque.
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8778/';let bad=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)bad++;};
(async()=>{const br=await chromium.launch();const errs=[];
const chk=async(url,pre,n)=>{const p=await br.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errs.push(e.message));await p.goto(BASE+url);await p.waitForTimeout(2500);if(pre)await pre(p);await p.waitForTimeout(1200);
 const r=await p.evaluate(()=>[...document.querySelectorAll('g.route')].map(g=>({o:+g.getAttribute('opacity'),fo:getComputedStyle(g.querySelector('.routeBody,.routeTrad')).fillOpacity,fill:getComputedStyle(g.querySelector('.routeTrad')||g.querySelector('.routeBody')).fill})));
 ck(r.length>0,n+': arrows drawn ('+r.length+')');ck(r.every(x=>x.o===1&&+x.fo===1),n+': every arrow group opacity 1 and fill opacity 1');ck(r.every(x=>!/rgba/.test(x.fill)),n+': no translucent fill colours');await p.close();};
await chk('movements.html',async p=>{await p.evaluate(()=>{const s=document.getElementById('slider')||document.querySelector('input[type=range]');if(s){s.value=s.max*0.6;s.dispatchEvent(new Event('input',{bubbles:true}));}});},'movements mid-timeline');
await chk('movements.html',async p=>{await p.evaluate(()=>{const s=document.querySelector('input[type=range]');s.value=s.max;s.dispatchEvent(new Event('input',{bubbles:true}));});},'movements end of timeline');
{const p=await br.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errs.push(e.message));await p.goto(BASE+'events.html');await p.waitForTimeout(2500);let found=null;
 for(let i=0;i<70&&!found;i++){await p.evaluate(()=>document.querySelector('#pgHost [data-step="1"]').click());await p.waitForTimeout(350);
  const r=await p.evaluate(()=>[...document.querySelectorAll('g.route')].map(g=>({o:+g.getAttribute('opacity'),fo:getComputedStyle(g.querySelector('.routeBody,.routeTrad')).fillOpacity})));if(r.length)found=r;}
 ck(!!found,'events: charcoal arrows drawn ('+(found?found.length:0)+')');ck(!!found&&found.every(x=>x.o===1&&+x.fo===1),'events: every arrow opacity 1');await p.close();}
await chk('index.html',async p=>{await p.evaluate(()=>{const s=document.querySelector('input[type=range]');if(s){s.value=s.max*0.5;s.dispatchEvent(new Event('input',{bubbles:true}));}});},'old globe');
ck(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));console.log(bad?'FAILED '+bad:'ALL PASS');await br.close();process.exit(bad?1:0);})();
