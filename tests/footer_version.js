// F-footer: every page's footer reads "v<site>; data <data>" from the ONE value in version.js, and every data file that names a Sheet version still agrees with it.
// Run: NODE_PATH=$(npm root -g) node tests/footer_version.js   (needs python3 -m http.server 8778 in the repo root; headless Chromium only)
const {chromium}=require('playwright');const BASE=process.env.SITE||'http://localhost:8778/';
let fail=0;const ck=(n,ok,x)=>{console.log((ok?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
(async()=>{
 const vtxt=await (await fetch(BASE+'version.js')).text();const SITE=(vtxt.match(/SITE_VERSION='([^']+)'/)||[])[1],DATA=(vtxt.match(/SITE_DATA_VERSION='([^']+)'/)||[])[1];
 ck('version.js holds both a site version and a data version',!!SITE&&/^v\d+\.\d+\.\d+/.test(DATA||''),{SITE,DATA});
 const grab=async f=>JSON.parse(await (await fetch(BASE+'data/'+f)).text());
 const srcs={'history.json':(await grab('history.json')).sheet?.meta?.source,'archaeology.json':(await grab('archaeology.json')).source,'jewhate.json':(await grab('jewhate.json')).source,'inventions.json':(await grab('inventions.json')).source};
 for(const [f,s] of Object.entries(srcs))ck(f+' was built from the data version in version.js',typeof s==='string'&&s.includes(DATA),s);
 const want='v'+SITE+'; data '+DATA;
 const b=await chromium.launch();const errs=[];
 for(const pg of ['index.html','events.html','movements.html','jewhate.html','jewhate-entry.html','archaeology.html','thankjews.html','haze.html','thankjews-entry.html?id=INV-002','quiz.html','merch.html','roadmap.html','strategy.html','feedback.html']){
  for(const w of [390,1280]){const p=await b.newPage({viewport:{width:w,height:820}});p.on('pageerror',e=>errs.push(pg+': '+e.message));await p.goto(BASE+pg);await p.waitForTimeout(1500);
   const t=await p.evaluate(()=>{const v=document.getElementById('version')||document.getElementById('siteVer');if(!v)return null;const r=v.getBoundingClientRect();return {t:v.textContent.trim(),inside:r.right<=innerWidth+1&&r.left>=0};});
   ck(pg+' at '+w+' px: footer reads "'+want+'", fully on screen',!!t&&t.t===want&&t.inside,t);await p.close();}}
 ck('no page errors',errs.length===0,errs);await b.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);})();
