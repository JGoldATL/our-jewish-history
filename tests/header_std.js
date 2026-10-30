// Header standard (v2.1.2): nav pill top right and level with the title at 901 px and up; centered above the title below; one title size; footer "version; data version".
// Titles only fit with the real web fonts: set FONTS=path to a module that attaches them (the sandbox cannot reach Google Fonts). Run: NODE_PATH=$(npm root -g) node tests/header_std.js   (needs python3 -m http.server 8778 in the repo root; headless Chromium only)
const {chromium}=require('playwright');const RF=process.env.FONTS?require(process.env.FONTS):null;const SITE=process.env.SITE||'http://localhost:8778/';
let fail=0;const ck=(n,ok,x)=>{console.log((ok?'ok   ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
const PAGES=['events','movements','jewhate','archaeology'];
(async()=>{const b=await chromium.launch();
for(const [vw,vh,wide] of [[1366,1024,1],[1180,820,1],[1140,700,1],[1139,700,0],[1024,768,0],[1000,700,0],[999,700,0],[960,700,0],[901,700,0],[900,700,0],[820,1180,0],[768,1024,0]]){
  const sizes=[];
  for(const pg of PAGES){
    const cx=await b.newContext({viewport:{width:vw,height:vh}});if(RF)await RF.attach(cx);const p=await cx.newPage();await p.goto(SITE+pg+'.html');await p.waitForTimeout(1800);
    const bt=await p.$('#begin');if(bt&&await bt.isVisible())await bt.click();
    const r=await p.evaluate(()=>{const nav=document.querySelector('.gn .gp'),h=document.querySelector('header.top .brand h1'),ft=document.querySelector('#version,#siteVer');
      const n=nav.getBoundingClientRect(),t=h.getBoundingClientRect();
      return {navR:n.right,navC:(n.left+n.right)/2,navT:n.top,navB:n.bottom,navW:n.width,titleL:t.left,titleR:(function(){const g=document.createRange();g.selectNodeContents(h);return g.getBoundingClientRect().right;})(),titleT:t.top,titleB:t.bottom,fs:parseFloat(getComputedStyle(h).fontSize),W:innerWidth,ft:ft&&ft.textContent,overflowX:document.documentElement.scrollWidth-innerWidth,sh:document.documentElement.scrollHeight-innerHeight};});
    const t=`${pg} ${vw}px`;sizes.push(r.fs);
    if(wide){
      ck(t+': nav top right',r.W-r.navR<=40,Math.round(r.W-r.navR));
      ck(t+': nav level with title (vertical overlap)',r.navT<r.titleB&&r.navB>r.titleT,[Math.round(r.navT),Math.round(r.navB),Math.round(r.titleT),Math.round(r.titleB)]);
      ck(t+': title does not run under nav',r.titleR<=r.navR-r.navW+4,[Math.round(r.titleR),Math.round(r.navR-r.navW)]);
      ck(t+': title 50 px',r.fs===50,r.fs);
    }else{
      ck(t+': nav centered',Math.abs(r.navC-r.W/2)<=3,Math.round(r.navC-r.W/2));
      ck(t+': nav above title',r.navB<=r.titleT+2,[Math.round(r.navB),Math.round(r.titleT)]);
    }
    ck(t+': footer reads version; data version',/^v\d+\.\d+\.\d+; data v?\S+/.test(r.ft||''),r.ft);
    ck(t+': no sideways scroll',r.overflowX<=0,r.overflowX);
    if(wide)console.log('INFO '+t+' page taller than screen by '+r.sh+' px');
    await cx.close();}
  if(wide)ck(`${vw}px: one title size on all pages`,new Set(sizes).size===1,sizes);
}
await b.close();process.exit(fail?1:0);})();
