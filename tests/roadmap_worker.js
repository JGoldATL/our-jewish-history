// Roadmap / gate Worker test (v0.5.0). Run: SEED=/path/to/roadmap-seed.csv node tests/roadmap_worker.js  (Node 22+; dummy secrets only; the seed CSV is never committed)
const fs=require('fs'),{execFileSync}=require('child_process');
const {make,DatabaseSync}=require('./dbshim');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const CODE='test-code-'+Math.random().toString(36).slice(2),ADMIN='test-admin-'+Math.random().toString(36).slice(2);
(async()=>{
  const W=(await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('worker/worker.js','utf8')).toString('base64'))).default;
  const seed=process.env.SEED||'/tmp/claude-0/rm/seed.csv';
  if(!fs.existsSync(seed)){console.log('SKIP no seed CSV at '+seed);process.exit(0);}
  const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('worker/schema.sql','utf8'));
  raw.exec(execFileSync('python3',['tools/roadmap_seed.py',seed],{encoding:'utf8'}));
  const env={DB:make(raw),ROADMAP_CODE:CODE,ROADMAP_ADMIN:ADMIN};
  const call=async(method,path,{body,gate,admin,e=env}={})=>{const h={Origin:'https://jgoldatl.github.io'};if(gate)h['X-Gate-Token']=gate;if(admin)h['X-Admin-Token']=admin;
    const r=await W.fetch(new Request('https://x'+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}),e);let d={};try{d=await r.json();}catch(x){}return {s:r.status,d};};

  // seed
  const rows=raw.prepare('SELECT * FROM roadmap_features ORDER BY sort_order').all();
  ok(rows.length===69,'seed has 69 rows ('+rows.length+')');
  const cnt={};rows.forEach(r=>cnt[r.status]=(cnt[r.status]||0)+1);
  ok(cnt.Approved===31&&cnt.Idea===17&&cnt.Live===12&&cnt.Parked===5&&cnt['In build']===3&&cnt.Built===1,'status counts Approved 31, Idea 17, Live 12, Parked 5, In build 3, Built 1 '+JSON.stringify(cnt));
  ok(rows.every(r=>r.priority===''),'every Priority is blank');
  ok(raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n===1,'one starting version');

  // gate
  ok((await call('GET','/roadmap')).s===401,'no token: roadmap refused (401)');
  ok((await call('GET','/link?name=strategy')).s===401,'no token: strategy link refused (401)');
  ok((await call('POST','/gate',{body:{page:'roadmap',code:'1896'}})).s===401,'wrong code refused (401)');
  ok((await call('POST','/gate',{body:{page:'nope',code:CODE}})).s===400,'unknown page refused (400)');
  ok((await call('POST','/gate',{body:{page:'roadmap',code:CODE},e:{...env,ROADMAP_CODE:undefined}})).s===503,'secret not set: 503, never opens');
  const g=await call('POST','/gate',{body:{page:'roadmap',code:CODE}});ok(g.s===200&&!!g.d.token,'right code gives a token');
  const T=g.d.token;
  const A=(await call('POST','/admin',{gate:T,body:{code:ADMIN}})).d.admin_token;
  ok((await call('GET','/roadmap',{gate:T+'x'})).s===401,'tampered token refused');
  ok((await call('GET','/roadmap',{gate:T.replace(/^gate\.\d+/,'gate.9999999999')})).s===401,'token with a changed expiry refused');
  const old='gate.'+(Math.floor(Date.now()/1000)-10);ok((await call('GET','/roadmap',{gate:old+'.'+'0'.repeat(64)})).s===401,'expired / forged token refused');
  const lk=await call('GET','/link?name=strategy',{gate:T});ok(lk.s===404,'link route needs a row in site_links (404 until Jeffrey adds it)');
  raw.exec("INSERT INTO site_links VALUES ('strategy','https://example.test/deck')");
  ok((await call('GET','/link?name=strategy',{gate:T})).d.url==='https://example.test/deck','link returned with a token');
  ok((await call('GET','/link?name=../x',{gate:T})).s===400,'bad link name refused');
  // gate failure ceiling
  const e2={...env,DB:make(raw)};raw.exec('DELETE FROM gate_fail');let last=0;for(let i=0;i<62;i++)last=(await call('POST','/gate',{body:{page:'roadmap',code:'bad'+i}})).s;
  ok(last===429,'after 60 wrong codes in 10 minutes the gate answers 429');ok((await call('POST','/gate',{body:{page:'roadmap',code:CODE}})).s===429,'even the right code waits during the ceiling');
  raw.exec('DELETE FROM gate_fail');ok((await call('POST','/gate',{body:{page:'roadmap',code:CODE}})).s===200,'gate works again once the window clears');
  ok(!JSON.stringify(raw.prepare('SELECT * FROM gate_fail').all()).match(/\d+\.\d+\.\d+\.\d+/),'no IP stored with failed tries');

  // read
  const R=await call('GET','/roadmap',{gate:T,admin:A});ok(R.s===200&&R.d.rows.length===69&&R.d.version===1&&R.d.admin===true&&R.d.config.lists.status.length===6,'GET /roadmap (admin token) returns 69 rows, version 1, lists, admin true');

  // edit => one version, right summary
  const ed=await call('POST','/roadmap/save',{gate:T,admin:A,body:{base_version:1,name:'Tester',changes:[{id:'F-024',field:'status',value:'In build'}]}});
  const was=rows.find(r=>r.id==='F-024');
  ok(ed.s===200&&ed.d.version===2,'one edit makes version 2 ('+ed.s+')');
  const v2=raw.prepare('SELECT * FROM roadmap_versions WHERE version_id=2').get();
  ok(v2&&v2.summary==='F-024 status '+was.status+' to In build'&&v2.saved_by_label==='Tester','summary reads "'+(v2&&v2.summary)+'"');
  ok(raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n===2,'exactly one new version, not more');
  ok(raw.prepare("SELECT status FROM roadmap_features WHERE id='F-024'").get().status==='In build','row updated');
  const noop=await call('POST','/roadmap/save',{gate:T,admin:A,body:{base_version:2,changes:[{id:'F-024',field:'status',value:'In build'}]}});ok(noop.s===200&&noop.d.unchanged&&raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n===2,'saving no change makes no version');
  const multi=await call('POST','/roadmap/save',{gate:T,admin:A,body:{base_version:2,changes:[{id:'F-031',field:'mine',value:'v0.5.0'},{id:'F-031',field:'effort',value:'L'}]}});
  ok(multi.s===200&&/F-031 my version .* to v0\.5\.0; F-031 effort M to L/.test(raw.prepare('SELECT summary FROM roadmap_versions WHERE version_id=?').get(multi.d.version).summary),'several fields in one save make one version');
  const stale=await call('POST','/roadmap/save',{gate:T,admin:A,body:{base_version:1,changes:[{id:'F-040',field:'owner',value:'CEO'}]}});ok(stale.s===200&&stale.d.stale===true,'a save from an old page is flagged stale and still applied (last save wins)');
  // validation
  const bad=async(l,ch)=>{const n=raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n;const r=await call('POST','/roadmap/save',{gate:T,admin:A,body:{base_version:1,changes:ch}});ok(r.s===400&&raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n===n,l+' refused (400, no version)');};
  await bad('status not in list',[{id:'F-001',field:'status',value:'Done'}]);
  await bad('blank feature',[{id:'F-001',field:'feature',value:'  '}]);
  await bad('about over 1000',[{id:'F-001',field:'about',value:'x'.repeat(1001)}]);
  await bad('unknown row',[{id:'F-999',field:'status',value:'Idea'}]);
  await bad('unknown field (sort_order)',[{id:'F-001',field:'sort_order',value:'1'}]);
  await bad('unknown field (id)',[{id:'F-001',field:'id',value:'F-777'}]);
  await bad('non-text value',[{id:'F-001',field:'status',value:5}]);
  await bad('one bad change spoils the whole save',[{id:'F-001',field:'notes',value:'fine'},{id:'F-001',field:'area',value:'Nope'}]);
  ok(raw.prepare("SELECT notes FROM roadmap_features WHERE id='F-001'").get().notes===rows[0].notes,'the good half of a refused save was not applied');
  ok((await call('POST','/roadmap/save',{gate:T,admin:A,body:{changes:[{id:"F-001'; DROP TABLE roadmap_features;--",field:'status',value:'Idea'}]}})).s===400&&raw.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='roadmap_features'").get().n===1,'SQL-looking id refused, table intact');
  const xss=await call('POST','/roadmap/save',{gate:T,admin:A,body:{base_version:1,changes:[{id:'F-002',field:'notes',value:'<img src=x onerror=alert(1)>'}]}});ok(xss.s===200,'markup is stored as plain text (the page only shows it as text)');
  ok((await call('POST','/roadmap/save',{gate:'',body:{changes:[]}})).s===401,'save without a token refused');

  // priority lock, direct route call included
  const pn=raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n;
  const pl=await call('POST','/roadmap/save',{gate:T,body:{base_version:1,changes:[{id:'F-001',field:'priority',value:'P1'}]}});
  ok(pl.s===403&&pl.d.error==='admin_only'&&raw.prepare("SELECT priority FROM roadmap_features WHERE id='F-001'").get().priority===''&&raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n===pn,'priority change without admin: 403 admin_only, nothing changed');
  ok((await call('POST','/roadmap/save',{gate:T,admin:'admin.9999999999.'+'0'.repeat(64),body:{changes:[{id:'F-001',field:'priority',value:'P1'}]}})).s===403,'a forged admin token does not unlock priority');
  ok((await call('POST','/admin',{body:{code:ADMIN}})).s===401,'admin route needs the gate token first');
  ok((await call('POST','/admin',{gate:T,body:{code:CODE}})).s===401,'the gate code is not the admin code');
  const ad=await call('POST','/admin',{gate:T,body:{code:ADMIN}});ok(ad.s===200&&!!ad.d.admin_token,'admin code gives an admin token');
  ok((await call('GET','/roadmap',{gate:T,admin:A})).d.admin===true,'roadmap reports admin true with the admin token');
  const ps=await call('POST','/roadmap/save',{gate:T,admin:A,body:{base_version:1,changes:[{id:'F-001',field:'priority',value:'P1'}]}});
  ok(ps.s===200&&raw.prepare("SELECT priority FROM roadmap_features WHERE id='F-001'").get().priority==='P1','admin can set priority');
  ok((await call('POST','/roadmap/save',{gate:T,admin:A,body:{changes:[{id:'F-001',field:'priority',value:'P9'}]}})).s===400,'priority outside P1/P2/P3 refused even for the admin');
  ok((await call('POST','/roadmap/save',{gate:T,admin:A,body:{changes:[{id:'F-001',field:'priority',value:''}]}})).s===200,'admin can blank a priority');
  ok((await call('POST','/roadmap/save',{gate:T,admin:A,body:{changes:[{id:'F-001',field:'priority',value:'P1'}]}})).s===200,'(P1 set again for the restore check)');

  // history + restore
  const V=await call('GET','/roadmap/versions',{gate:T,admin:A});ok(V.s===200&&V.d.versions.length>=5&&V.d.versions[0].version_id>V.d.versions[1].version_id&&!('snapshot' in V.d.versions[0]),'history lists newest first without the snapshots');
  const V1=await call('GET','/roadmap/version?id=1',{gate:T,admin:A});ok(V1.s===200&&V1.d.rows.length===69&&V1.d.rows.find(r=>r.id==='F-024').status===was.status,'version 1 snapshot shows the original status');
  ok((await call('GET','/roadmap/version?id=999',{gate:T,admin:A})).s===404,'unknown version 404');
  const before=raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n;
  const rs=await call('POST','/roadmap/restore',{gate:T,admin:A,body:{version_id:1,name:'Tester'}});
  ok(rs.s===200&&raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n===before+1,'restore creates one NEW version, deletes none');
  ok(raw.prepare("SELECT status FROM roadmap_features WHERE id='F-024'").get().status===was.status&&raw.prepare('SELECT COUNT(*) n FROM roadmap_features').get().n===69,'restore brings back version 1 content (69 rows)');
  ok(/^Restored version 1/.test(raw.prepare('SELECT summary FROM roadmap_versions WHERE version_id=?').get(rs.d.version).summary),'restore summary names the version');
  ok(raw.prepare('SELECT COUNT(*) n FROM roadmap_versions WHERE version_id=1').get().n===1,'old versions are all still there');
  const rsa=await call('POST','/roadmap/restore',{gate:T,admin:A,body:{version_id:1}});ok(rsa.s===200&&raw.prepare("SELECT priority FROM roadmap_features WHERE id='F-001'").get().priority==='','a restore also restores priorities');

  // import (admin only)
  const imp=rows.slice(0,3).map(r=>({...r,priority:''}));
  ok((await call('POST','/roadmap/import',{gate:T,body:{rows:imp}})).s===403,'import without admin refused (403)');
  ok((await call('POST','/roadmap/import',{gate:T,admin:A,body:{rows:[{...imp[0]},{...imp[0]}]}})).s===400,'import with duplicate ids refused');
  ok((await call('POST','/roadmap/import',{gate:T,admin:A,body:{rows:[{...imp[0],status:'Weird'}]}})).s===400&&raw.prepare('SELECT COUNT(*) n FROM roadmap_features').get().n===69,'import with a bad value refused, nothing changed');
  const im=await call('POST','/roadmap/import',{gate:T,admin:A,body:{rows:imp,name:'Admin'}});ok(im.s===200&&im.d.count===3&&raw.prepare('SELECT COUNT(*) n FROM roadmap_features').get().n===3,'admin import replaces the rows');
  ok(raw.prepare('SELECT summary FROM roadmap_versions WHERE version_id=?').get(im.d.version).summary==='Imported from CSV','import is one version "Imported from CSV"');
  await call('POST','/roadmap/restore',{gate:T,admin:A,body:{version_id:1}});ok(raw.prepare('SELECT COUNT(*) n FROM roadmap_features').get().n===69,'an import can be undone by restoring');


  // v0.5.1: visitors (code only) see public columns, can comment and recommend; everything else is admin only
  const pub=await call('GET','/roadmap',{gate:T});
  ok(pub.s===200&&pub.d.admin===false&&pub.d.rows.length===69&&Object.keys(pub.d.rows[0]).sort().join()==='about,area,feature,id,rec,sort_order,status','a visitor gets only id, feature, about, area, rec, status (no source, notes, owner, priority, mine)');
  ok(!JSON.stringify(pub.d).match(/Master doc s1|WebDev-Handoff/),'no source text reaches a visitor');
  ok((await call('POST','/roadmap/save',{gate:T,body:{changes:[{id:'F-001',field:'status',value:'Live'}]}})).s===403,'a visitor cannot edit any field (403)');
  ok((await call('POST','/roadmap/restore',{gate:T,body:{version_id:1}})).s===403&&(await call('GET','/roadmap/versions',{gate:T})).s===403&&(await call('GET','/roadmap/version?id=1',{gate:T})).s===403,'a visitor cannot restore or read history (403)');
  ok((await call('POST','/roadmap/import',{gate:T,body:{rows:imp}})).s===403&&(await call('GET','/roadmap/suggestions',{gate:T})).s===403,'a visitor cannot import or read suggestions (403)');
  const vN=raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n;
  const cm=await call('POST','/roadmap/comment',{gate:T,body:{feature_id:'F-002',name:'Dana',comment:'Please add a hint.'}});
  ok(cm.s===200&&raw.prepare("SELECT comment,name FROM roadmap_comments WHERE feature_id='F-002'").get().name==='Dana','a visitor can add a comment');
  ok(raw.prepare('SELECT COUNT(*) n FROM roadmap_versions').get().n===vN,'a comment does not create a roadmap version');
  ok((await call('POST','/roadmap/comment',{gate:'',body:{feature_id:'F-002',comment:'hello there'}})).s===401,'comment without a token refused');
  ok((await call('POST','/roadmap/comment',{gate:T,body:{feature_id:'F-999',comment:'hello there'}})).s===400&&(await call('POST','/roadmap/comment',{gate:T,body:{feature_id:'F-002',comment:'x'}})).s===400&&(await call('POST','/roadmap/comment',{gate:T,body:{feature_id:'F-002',comment:'x'.repeat(501)}})).s===400,'unknown row, too-short and over-500 comments refused');
  const g2=await call('GET','/roadmap',{gate:T});ok(g2.d.comments['F-002']&&g2.d.comments['F-002'].length===1&&g2.d.comments['F-002'][0].comment==='Please add a hint.','comments come back grouped by row');
  const adm=await call('POST','/roadmap/comment/delete',{gate:T,body:{id:g2.d.comments['F-002'][0].id}});ok(adm.s===403,'a visitor cannot delete a comment');
  ok((await call('POST','/roadmap/comment/delete',{gate:T,admin:A,body:{id:g2.d.comments['F-002'][0].id}})).s===200&&raw.prepare('SELECT COUNT(*) n FROM roadmap_comments').get().n===0,'the admin can delete a comment');
  raw.exec("INSERT INTO roadmap_comments (feature_id,comment) VALUES ('F-003','x1'),('F-003','x2')");raw.exec("DELETE FROM roadmap_comments");
  const sg=await call('POST','/roadmap/suggest',{gate:T,body:{name:'Sam',feature:'Family tree view',accomplishes:'Shows how families connect.',about:'A simple tree.',vision:'Tap a name, see the place.'}});
  ok(sg.s===200&&raw.prepare('SELECT feature,accomplishes,about,vision,name FROM roadmap_suggestions').get().vision==='Tap a name, see the place.','a visitor can recommend a feature (name, accomplishes, about, vision)');
  ok((await call('POST','/roadmap/suggest',{gate:T,body:{feature:'ab',accomplishes:'ok ok'}})).s===400&&(await call('POST','/roadmap/suggest',{gate:T,body:{feature:'Good name',accomplishes:''}})).s===400&&(await call('POST','/roadmap/suggest',{gate:T,body:{feature:'Good name',accomplishes:'fine',vision:'v'.repeat(1001)}})).s===400,'suggestions missing the name or what it accomplishes, or too long, are refused');
  ok((await call('POST','/roadmap/suggest',{gate:'',body:{feature:'Good name',accomplishes:'fine'}})).s===401,'suggest without a token refused');
  ok((await call('GET','/roadmap/suggestions',{gate:T,admin:A})).d.suggestions.length===1,'the admin can read suggestions');
  raw.exec("DELETE FROM roadmap_suggestions");raw.exec("INSERT INTO roadmap_suggestions (feature,accomplishes) VALUES ('a1','b1')");
  raw.exec("DELETE FROM roadmap_suggestions");
  let cap=0;for(let i=0;i<102;i++){const r=await call('POST','/roadmap/suggest',{gate:T,body:{feature:'Idea '+i,accomplishes:'something'}});if(r.s===429)cap++;}ok(cap>=2,'more than 100 suggestions an hour are refused (429)');
  raw.exec("DELETE FROM roadmap_suggestions");
  const bigRow=[];for(let i=0;i<101;i++)raw.exec("INSERT INTO roadmap_comments (feature_id,comment) VALUES ('F-004','c"+i+"')");
  ok((await call('POST','/roadmap/comment',{gate:T,body:{feature_id:'F-004',comment:'one more'}})).s===429,'a row holds at most 100 comments (429)');raw.exec("DELETE FROM roadmap_comments");

  // logging endpoint still works next to the site routes; CORS allows the new headers
  ok(await W.fetch(new Request('https://x/',{method:'POST',body:'{nope'}),env).then(r=>r.status)===400,'logging route still answers (bad JSON 400)');
  const oh=await W.fetch(new Request('https://x/roadmap',{method:'OPTIONS',headers:{Origin:'https://jgoldatl.github.io'}}),env);
  ok(oh.status===204&&/X-Gate-Token/.test(oh.headers.get('Access-Control-Allow-Headers')||'')&&/GET/.test(oh.headers.get('Access-Control-Allow-Methods')||''),'CORS preflight allows GET and the token headers');
  ok(!/1897/.test(fs.readFileSync('worker/worker.js','utf8')+fs.readFileSync('gate.js','utf8')+fs.readFileSync('roadmap.js','utf8')+fs.readFileSync('roadmap.html','utf8')+fs.readFileSync('strategy.html','utf8')),'the password 1897 is not written in any site file');
  ok(!/docs\.google\.com\/presentation/.test(fs.readFileSync('strategy.html','utf8')+fs.readFileSync('roadmap.html','utf8')+fs.readFileSync('roadmap.js','utf8')),'no Slides link in the page files');
  console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
