// Logger Worker test (v0.4.0). Run: node tests/worker.js   (needs Node 22+ for node:sqlite; no network, no Cloudflare)
// Runs worker/worker.js against a real SQLite database built from worker/schema.sql and the question lock generated from data/history.json.
const fs=require('fs'),{execFileSync}=require('child_process');
const {DatabaseSync}=require('node:sqlite');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};

(async()=>{
  const src=fs.readFileSync('worker/worker.js','utf8');
  const W=(await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'))).default;
  const lockSql=execFileSync('python3',['tools/question_lock.py'],{encoding:'utf8'});
  ok(lockSql===fs.readFileSync('worker/question_lock.sql','utf8'),'worker/question_lock.sql is up to date with data/history.json');
  const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('worker/schema.sql','utf8'));raw.exec(lockSql);
  const DB={prepare:sql=>({first:async()=>raw.prepare(sql).get(),bind:(...a)=>({first:async()=>raw.prepare(sql).get(...a),run:async()=>raw.prepare(sql).run(...a)})})};
  const env={DB};
  const lock=Object.fromEntries(raw.prepare('SELECT * FROM question_lock').all().map(r=>[r.id,r]));
  const ids=Object.keys(lock);
  ok(ids.length===44,'44 locked questions ('+ids.length+')');
  const mc4=ids.find(i=>lock[i].kind==='mc'&&lock[i].n===4),mc5=ids.find(i=>lock[i].kind==='mc'&&lock[i].n===5),ord=ids.find(i=>lock[i].kind==='order');
  ok(mc4&&mc5&&ord,'bank has 4-choice ('+mc4+'), 5-choice ('+mc5+') and ordering ('+ord+') questions');
  let v=0;const visit=()=>'abcdefghij'+String(100000+(v++)).padStart(6,'0');
  const post=(b,vid)=>W.fetch(new Request('https://x/',{method:'POST',body:typeof b==='string'?b:JSON.stringify(b)}),env).then(r=>r.status);
  const ans=(vid,q,picked,extra={})=>post({visit_id:vid,kind:'answer',question_id:q,picked,...extra});
  const rows=()=>raw.prepare('SELECT * FROM responses ORDER BY id').all();
  const last=()=>rows().at(-1);

  // valid rows
  let A=visit();
  ok(await ans(A,mc4,String(lock[mc4].correct_idx))===204&&last().correct===1,'right multiple-choice pick stored as correct');
  ok(await ans(A,mc4,String((lock[mc4].correct_idx+1)%4))===204&&last().correct===0,'wrong multiple-choice pick stored as not correct');
  ok(await ans(A,mc5,'4')===204,'5-choice question accepts pick 4');
  ok(await ans(visit(),ord,[...Array(lock[ord].n).keys()].join(','))===204&&last().correct===1,'ordering in true order is correct');
  const rev=[...Array(lock[ord].n).keys()].reverse().join(',');
  ok(await ans(visit(),ord,rev)===204&&last().correct===0&&last().picked===rev,'ordering reversed is stored as not correct');
  ok(await post({visit_id:visit(),kind:'survey',survey:'A lot'})===204&&last().survey==='A lot'&&last().question_id===null,'survey tap stored');
  ok(await post({visit_id:'test-'+visit(),kind:'survey',survey:'Somewhat'})===204,'"test-" visit id accepted');

  // trust: the browser's claims are ignored
  const B=visit();
  ok(await ans(B,mc4,String((lock[mc4].correct_idx+1)%4),{correct:1,era:'Made up era',style:'Made up style',ip:'1.2.3.4',name:'Bob'})===204,'extra fields do not block a valid pick');
  const r=last();ok(r.correct===0&&r.era===lock[mc4].era&&r.style===lock[mc4].style,'forged correct/era/style ignored; era and style come from the lock ('+r.era+' | '+r.style+')');
  ok(!JSON.stringify(rows()).includes('1.2.3.4')&&!JSON.stringify(rows()).includes('Bob'),'no IP or name reaches the database');

  // impossible picks and questions
  const bad=async(label,p)=>{const n=rows().length;const s=await p;ok(s===400&&rows().length===n,label+' refused (400, no row)');};
  await bad('pick 4 on a 4-choice question',ans(visit(),mc4,'4'));
  await bad('pick 9',ans(visit(),mc4,'9'));
  await bad('five picks on one multiple-choice question',ans(visit(),mc4,'0,1,2,3,0'));
  await bad('two picks on multiple choice',ans(visit(),mc4,'0,1'));
  await bad('negative / text pick',ans(visit(),mc4,'-1'));
  await bad('ordering with a repeated position',ans(visit(),ord,'0,0,1,2'.split(',').slice(0,lock[ord].n).join(',')));
  await bad('ordering too short',ans(visit(),ord,'0,1'));
  await bad('ordering out of range',ans(visit(),ord,[...Array(lock[ord].n-1).keys(),lock[ord].n].join(',')));
  await bad('unknown question Q999',ans(visit(),'Q999','0'));
  await bad('SQL-looking question id',ans(visit(),"Q1'; DROP TABLE responses;--",'0'));
  await bad('bad survey text',post({visit_id:visit(),kind:'survey',survey:'Maybe'}));
  await bad('short visit id',post({visit_id:'abc',kind:'survey',survey:'A lot'}));
  await bad('unknown kind',post({visit_id:visit(),kind:'delete'}));
  await bad('broken JSON',post('{nope'));
  ok(await post('x'.repeat(2000))===413,'oversized body refused (413)');
  ok(await W.fetch(new Request('https://x/'),env).then(r=>r.status)===405,'GET refused (405)');
  ok(await W.fetch(new Request('https://x/',{method:'OPTIONS',headers:{Origin:'https://jgoldatl.github.io'}}),env).then(r=>r.status)===204,'OPTIONS answered');
  ok(raw.prepare('SELECT COUNT(*) n FROM sqlite_master WHERE name=\'responses\'').get().n===1,'table intact after injection attempt');

  // caps
  const C=visit();let s=[];for(let k=0;k<4;k++)s.push(await ans(C,mc4,'0'));
  ok(s.join()==='204,204,204,429','a visit may log one question at most 3 times (statuses '+s.join('/')+')');
  const D=visit();let n=0;for(let k=0;k<30;k++){await ans(D,ids[k%ids.length]===ord?mc4:ids[k%ids.length],'0');}
  const dRows=()=>raw.prepare('SELECT COUNT(*) n FROM responses WHERE visit_id=?').get(D).n;
  for(let k=0;k<80;k++)await post({visit_id:D,kind:'survey',survey:'A lot'});
  ok(dRows()===60,'a visit stops at 60 rows ('+dRows()+')');
  // hourly ceiling: old rows do not count, recent rows do
  raw.exec('DELETE FROM responses');
  const ins=raw.prepare("INSERT INTO responses (ts,visit_id,kind,survey) VALUES (?,?,'survey','A lot')");
  const old=new Date(Date.now()-2*3600e3).toISOString().replace(/\.\d+Z$/,'Z');
  raw.exec('BEGIN');for(let k=0;k<2000;k++)ins.run(old,'oldoldoldold'+k);raw.exec('COMMIT');
  ok(await post({visit_id:visit(),kind:'survey',survey:'A lot'})===204,'2000 rows from 2 hours ago do not block new rows');
  const now=new Date().toISOString().replace(/\.\d+Z$/,'Z');
  raw.exec('BEGIN');for(let k=0;k<1500;k++)ins.run(now,'newnewnewnew'+k);raw.exec('COMMIT');
  ok(await post({visit_id:visit(),kind:'survey',survey:'A lot'})===429,'1500 rows in the last hour: new rows refused (429)');

  // failure never throws
  ok(await W.fetch(new Request('https://x/',{method:'POST',body:JSON.stringify({visit_id:visit(),kind:'survey',survey:'A lot'})}),{DB:{prepare(){throw new Error('down')}}}).then(r=>r.status)===400,'database failure returns a plain error, never throws');

  console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
})();
