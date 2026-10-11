// Runs the REAL worker/worker.js (against an in-memory SQLite built from worker/schema.sql + the seed CSV) behind Playwright's network routing,
// so the page tests exercise the actual gate and roadmap routes. Dummy secrets only. Never touches Cloudflare.
const fs=require('fs'),{execFileSync}=require('child_process');
const {make,DatabaseSync}=require('./dbshim');
exports.CODE='dummy-code-for-tests';exports.ADMIN='dummy-admin-for-tests';
exports.start=async function(seed){
  const W=(await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('worker/worker.js','utf8')).toString('base64'))).default;
  const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('worker/schema.sql','utf8'));
  raw.exec(execFileSync('python3',['tools/roadmap_seed.py',seed],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
  raw.exec("INSERT INTO site_links VALUES ('strategy','https://docs.google.com/presentation/d/TESTDECK/embed')");
  const env={DB:make(raw),ROADMAP_CODE:exports.CODE,ROADMAP_ADMIN:exports.ADMIN};
  const log=[];
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Gate-Token, X-Admin-Token','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
  const attach=async ctx=>ctx.route(/workers\.dev/,async route=>{
    const rq=route.request();
    if(rq.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    const h=rq.headers();log.push({method:rq.method(),url:rq.url(),gate:!!h['x-gate-token'],admin:!!h['x-admin-token'],body:rq.postData()});
    const r=await W.fetch(new Request(rq.url(),{method:rq.method(),headers:h,body:rq.method()==='GET'?undefined:rq.postData()}),env);
    route.fulfill({status:r.status,headers:{...cors,'Content-Type':r.headers.get('Content-Type')||'text/plain'},body:await r.text()});});
  return {raw,env,W,log,attach};
};
