// Roadmap Type column (v2.4.0). Run: SEED=/path/seed.csv NODE_PATH=$(npm root -g) node tests/roadmap_type.js  (server on :8778). Headless Chromium only.
const {chromium}=require('playwright');const SITE=process.env.SITE||'http://localhost:8778/';const MW=require('./mockworker');
(async()=>{const mw=await MW.start(process.env.SEED||'/tmp/claude-0/rm/seed.csv');const b=await chromium.launch();let fail=0;const ck=(n,ok,x)=>{console.log((ok?'ok   ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
const TYPES=['Feature','Enhancement','Bug fix','Content and data'];
mw.raw.prepare('SELECT id FROM roadmap_features ORDER BY sort_order').all().forEach((r,i)=>mw.raw.prepare('UPDATE roadmap_features SET type=? WHERE id=?').run(TYPES[i%4],r.id));
const vers=()=>mw.raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n;
const mk=async(vp)=>{const ctx=await b.newContext({viewport:vp,acceptDownloads:true});await mw.attach(ctx);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));return {ctx,p,errs};};
const open=async(p,q)=>{await p.goto(SITE+'roadmap.html'+(q||''));await p.fill('#gatePw',MW.CODE);await p.keyboard.press('Enter');await p.waitForSelector('#tbody tr');};
const heads=p=>p.$$eval('#thead th',t=>t.map(x=>x.textContent.replace(/[ ▲▼]/g,'')));
for(const vp of [{width:390,height:844},{width:1366,height:768}]){
  const w=vp.width;
  // visitor
  const v=await mk(vp);await open(v.p);
  const hv=await heads(v.p);ck(w+' visitor: Type column is shown, right after ID/Comments',hv.indexOf('Type')>=0&&hv.indexOf('Type')<hv.indexOf('Feature'),hv);
  const first=await v.p.$$eval('#tbody tr td.type',t=>t.slice(0,4).map(x=>x.textContent));ck(w+' visitor: Type cells show real values',first.every(x=>TYPES.includes(x)),first);
  ck(w+' visitor: Type is not editable (no click-to-edit)',await v.p.locator('#tbody td.type.clk').count()===0);
  ck(w+' visitor: page does not scroll sideways',await v.p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await v.p.screenshot({path:'/tmp/claude-0/rm/type-visitor-'+w+'.png'});
  await v.p.locator('#tbody tr').first().click();await v.p.waitForTimeout(300);ck(w+' visitor: row panel shows Type',/Type/.test(await v.p.textContent('#sheet'))&&TYPES.some(t=>true));
  ck(w+' visitor: no page errors',v.errs.length===0,v.errs);await v.ctx.close();
  // admin
  const a=await mk(vp);await open(a.p,'?admin');await a.p.click('#admBtn');await a.p.fill('#f_adm',MW.ADMIN);await a.p.click('#sheet .btn.pri');await a.p.waitForTimeout(900);
  const ha=await heads(a.p);ck(w+' admin: Type is column B (after ID, before Feature)',ha[0]==='ID'&&ha[1]==='Type'&&ha[2]==='Feature',ha.slice(0,4));
  const cell=a.p.locator('#tbody tr').first().locator('td.type');ck(w+' admin: Type cell is click-to-edit',await cell.getAttribute('title')==='Click to edit');
  await cell.click();const opts=await a.p.$$eval('#tbody select.ed option',o=>o.map(x=>x.value));ck(w+' admin: dropdown has exactly the four values, no blank',opts.join('|')===TYPES.join('|'),opts);
  const id=await a.p.locator('#tbody tr').first().locator('td.id').textContent(),was=mw.raw.prepare('SELECT type FROM roadmap_features WHERE id=?').get(id).type,pick=TYPES.find(t=>t!==was),v0=vers();
  await a.p.selectOption('#tbody select.ed',pick);await a.p.waitForTimeout(900);
  ck(w+' admin: choosing a value saves to the database as one new version',mw.raw.prepare('SELECT type FROM roadmap_features WHERE id=?').get(id).type===pick&&vers()===v0+1,{id,was,pick});
  ck(w+' admin: cell shows the new value',(await a.p.locator('#tbody tr').first().locator('td.type').textContent())===pick);
  ck(w+' admin: version summary names the change',new RegExp(id+' type '+was+' to '+pick).test(mw.raw.prepare('SELECT summary FROM roadmap_versions ORDER BY version_id DESC LIMIT 1').get().summary));
  await a.p.locator('#tbody tr').first().locator('td.type').click();await a.p.keyboard.press('Escape');await a.p.waitForTimeout(200);ck(w+' admin: Escape cancels with no save',vers()===v0+1);
  await a.p.screenshot({path:'/tmp/claude-0/rm/type-admin-'+w+'.png'});
  if(w===1366){const [dl]=await Promise.all([a.p.waitForEvent('download'),a.p.click('#expBtn')]);const txt=require('fs').readFileSync(await dl.path(),'utf8');const hdr=txt.split('\r\n')[0];ck('admin: CSV export header ends with order,priority,type',/,order,priority,type$/.test(hdr),hdr);
    ck('admin: CSV export has Type on every row',txt.trim().split('\r\n').slice(1).length===69);}
  ck(w+' admin: no page errors',a.errs.length===0,a.errs);await a.ctx.close();
}
await b.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);})();
