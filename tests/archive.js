// Archive routes test. Run: node tests/archive.js  (Node 22+; dummy secrets only; in-memory SQLite built from worker/schema.sql)
const fs=require('fs');const {make,DatabaseSync}=require('./dbshim');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const CODE='test-code-'+Math.random().toString(36).slice(2),ADMIN='test-admin-'+Math.random().toString(36).slice(2);
(async()=>{
  const W=(await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('worker/worker.js','utf8')).toString('base64'))).default;
  const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('worker/schema.sql','utf8'));
  const cols=raw.prepare("PRAGMA table_info(roadmap_features)").all().filter(c=>c.notnull&&c.dflt_value===null&&!c.pk).map(c=>c.name);
  raw.prepare('INSERT INTO roadmap_features (id'+cols.map(c=>','+c).join('')+') VALUES (?'+cols.map(()=>',?').join('')+')').run('F-001',...cols.map(()=>'x'));
  const env={DB:make(raw),ROADMAP_CODE:CODE,ROADMAP_ADMIN:ADMIN};
  const call=async(method,path,{body,gate,admin}={})=>{const h={Origin:'https://jgoldatl.github.io'};if(gate)h['X-Gate-Token']=gate;if(admin)h['X-Admin-Token']=admin;
    const r=await W.fetch(new Request('https://x'+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}),env);let d={};try{d=await r.json();}catch(x){}return {s:r.status,d};};
  const T=(await call('POST','/gate',{body:{page:'roadmap',code:CODE}})).d.token;
  const A=(await call('POST','/admin',{gate:T,body:{code:ADMIN}})).d.admin_token;
  ok(!!T&&!!A,'gate and admin tokens issued');
  const c1=(await call('POST','/roadmap/comment',{gate:T,body:{feature_id:'F-001',name:'A',comment:'first test comment'}})).d.id;
  await call('POST','/roadmap/comment',{gate:T,body:{feature_id:'F-001',name:'B',comment:'second test comment'}});
  await call('POST','/roadmap/suggest',{gate:T,body:{name:'A',feature:'Test feature',accomplishes:'Test accomplishes',about:'',vision:''}});
  raw.exec("INSERT INTO feedback (visit_id,topic,message) VALUES ('v1','Idea','Test feedback message')");
  const list=async(admin)=>(await call('GET','/roadmap',{gate:T,admin})).d.comments['F-001']||[];
  ok((await list()).length===2,'two comments visible before archiving');
  // visitors and non-admins cannot archive
  ok((await call('POST','/roadmap/archive',{gate:T,body:{kind:'comment',id:c1,archived:1}})).s===403,'archive refused without the admin token (403)');
  ok((await call('GET','/roadmap/archive',{gate:T})).s===403,'archive list refused without the admin token (403)');
  ok((await call('POST','/roadmap/archive/delete',{gate:T,body:{kind:'comment',id:c1}})).s===403,'archive delete refused without the admin token (403)');
  // bad input
  ok((await call('POST','/roadmap/archive',{gate:T,admin:A,body:{kind:'visits',id:1,archived:1}})).s===400,'unknown kind refused (400)');
  ok((await call('POST','/roadmap/archive',{gate:T,admin:A,body:{kind:'comment',id:'1; DROP TABLE x',archived:1}})).s===400,'non-integer id refused (400)');
  ok((await call('POST','/roadmap/archive',{gate:T,admin:A,body:{kind:'comment',id:c1,archived:2}})).s===400,'bad archived flag refused (400)');
  // archive one of each
  ok((await call('POST','/roadmap/archive',{gate:T,admin:A,body:{kind:'comment',id:c1,archived:1}})).s===200,'comment archived');
  ok((await call('POST','/roadmap/archive',{gate:T,admin:A,body:{kind:'suggestion',id:1,archived:1}})).s===200,'suggestion archived');
  ok((await call('POST','/roadmap/archive',{gate:T,admin:A,body:{kind:'feedback',id:1,archived:1}})).s===200,'feedback archived');
  ok((await list()).length===1,'visitors no longer see the archived comment');
  ok((await list(A)).length===1,'admin Roadmap view also leaves it out (it lives in the archive)');
  ok((await call('GET','/roadmap/suggestions',{gate:T,admin:A})).d.suggestions.length===0,'archived suggestion leaves the Suggested features list');
  ok((await call('GET','/roadmap/feedback',{gate:T,admin:A})).d.feedback.length===0,'archived feedback leaves the Feedback results list');
  const ar=(await call('GET','/roadmap/archive',{gate:T,admin:A})).d;
  ok(ar.comments.length===1&&ar.suggestions.length===1&&ar.feedback.length===1,'archive lists one of each');
  ok(raw.prepare('SELECT archived_ts FROM roadmap_comments WHERE id=?').get(c1).archived_ts!==null,'archive date stored');
  // delete forever only touches archived items
  const live=raw.prepare('SELECT id FROM roadmap_comments WHERE archived=0').get().id;
  await call('POST','/roadmap/archive/delete',{gate:T,admin:A,body:{kind:'comment',id:live}});
  ok(raw.prepare('SELECT COUNT(*) n FROM roadmap_comments').get().n===2,'delete forever ignores an item that is not archived');
  // restore
  await call('POST','/roadmap/archive',{gate:T,admin:A,body:{kind:'comment',id:c1,archived:0}});
  ok((await list()).length===2,'restored comment is visible again');
  ok(raw.prepare('SELECT archived_ts FROM roadmap_comments WHERE id=?').get(c1).archived_ts===null,'archive date cleared on restore');
  // delete forever for an archived item
  await call('POST','/roadmap/archive',{gate:T,admin:A,body:{kind:'feedback',id:1,archived:1}});
  await call('POST','/roadmap/archive/delete',{gate:T,admin:A,body:{kind:'feedback',id:1}});
  ok(raw.prepare('SELECT COUNT(*) n FROM feedback').get().n===0,'delete forever removes an archived item');
  // migration file runs on the old table shapes
  const old=new DatabaseSync(':memory:');old.exec("CREATE TABLE roadmap_comments (id INTEGER PRIMARY KEY, comment TEXT);CREATE TABLE roadmap_suggestions (id INTEGER PRIMARY KEY, feature TEXT);CREATE TABLE feedback (id INTEGER PRIMARY KEY, message TEXT);INSERT INTO feedback VALUES (1,'x')");
  old.exec(fs.readFileSync('worker/archive.sql','utf8'));
  ok(old.prepare('SELECT archived FROM feedback').get().archived===0,'migration adds the columns and existing rows default to not archived');
  console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
