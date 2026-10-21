// One password box (v2.1.0, F-107): the viewer code opens the private pages; the admin code opens them AND signs in as admin; anything else is refused.
// Runs the real worker/worker.js in-process (dummy secrets, in-memory database). Run: NODE_PATH=$(npm root -g) node tests/gate_admin.js   (from the repo root)
const fs=require('fs');const {make,DatabaseSync}=require('./dbshim');let bad=0;const ck=(c,m,x)=>{console.log((c?'PASS ':'FAIL ')+m+(x!==undefined&&!c?' '+JSON.stringify(x):''));if(!c)bad++;};
(async()=>{
const W=(await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('worker/worker.js','utf8')).toString('base64'))).default;
const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('worker/schema.sql','utf8'));raw.exec("INSERT INTO site_links VALUES ('strategy','https://docs.google.com/presentation/d/TESTDECK/embed')");
const env={DB:make(raw),ROADMAP_CODE:'dummy-viewer-code',ROADMAP_ADMIN:'dummy-admin-code'};
const call=async(path,o)=>{const r=await W.fetch(new Request('https://w.test'+path,{method:o&&o.body?'POST':'GET',headers:Object.assign({'Content-Type':'application/json'},(o&&o.h)||{}),body:o&&o.body?JSON.stringify(o.body):undefined}),env);return {s:r.status,d:await r.json().catch(()=>({}))};};
const v=await call('/gate',{body:{page:'roadmap',code:env.ROADMAP_CODE}});
ck(v.s===200&&!!v.d.token&&!v.d.admin_token,'viewer code opens the page and gives no admin token');
const a=await call('/gate',{body:{page:'roadmap',code:env.ROADMAP_ADMIN}});
ck(a.s===200&&!!a.d.token&&!!a.d.admin_token,'admin code opens the page and gives an admin token in the same step');
const w=await call('/gate',{body:{page:'strategy',code:'nope'}});ck(w.s===401&&!w.d.token&&!w.d.admin_token,'a wrong code is refused with nothing returned');
const e=await call('/gate',{body:{page:'strategy',code:''}});ck(e.s===401,'an empty code is refused');
const bp=await call('/gate',{body:{page:'other',code:env.ROADMAP_ADMIN}});ck(bp.s===400,'an unknown page is refused');
const vt=await call('/link?page=strategy',{h:{'X-Gate-Token':v.d.token}});const at=await call('/link?page=strategy',{h:{'X-Gate-Token':a.d.token}});
ck(vt.s!==401&&at.s!==401,'both tokens open the gated data (the admin one is a normal gate token)');
// admin token is accepted by an admin-only route; the viewer one is not
const adm=async(t,adminTok)=>call('/roadmap',{h:Object.assign({'X-Gate-Token':t},adminTok?{'X-Admin-Token':adminTok}:{})});
const r1=await adm(v.d.token),r2=await adm(a.d.token,a.d.admin_token);ck(r1.s===200&&r1.d.admin!==true,'viewer: page data loads, admin flag is false',[r1.s,r1.d.admin]);
ck(r2.s===200&&r2.d.admin===true,'admin: page data loads with the admin flag true',[r2.s,r2.d.admin]);
// the viewer code is never accepted as an admin code, and the old second box still works
const bad2=await call('/admin',{h:{'X-Gate-Token':v.d.token},body:{code:env.ROADMAP_CODE}});ck(bad2.s===401,'the viewer code does not give admin on the old /admin route');
const old=await call('/admin',{h:{'X-Gate-Token':v.d.token},body:{code:env.ROADMAP_ADMIN}});ck(old.s===200&&!!old.d.admin_token,'the old second password box still works as a fallback');
console.log(bad?'FAILED '+bad:'ALL PASS');process.exit(bad?1:0);})();
