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
  const DB=require('./dbshim').make(raw);
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

  // v0.4.3: round_id groups the 3 answers and the survey tap of one round
  const R=visit();
  ok(await ans(R,mc4,'0',{round_id:'abcd1234ef'})===204&&last().round_id==='abcd1234ef','answer stores a valid round_id');
  ok(await post({visit_id:R,round_id:'abcd1234ef',kind:'survey',survey:'A lot'})===204&&last().round_id==='abcd1234ef','survey tap stores the same round_id');
  ok(await ans(R,mc5,'0',{round_id:'BAD ID!!'})===204&&last().round_id===null,'a malformed round_id is dropped, the row still saves');
  ok(await ans(R,ord,[...Array(lock[ord].n).keys()].join(','),{})===204&&last().round_id===null,'rows without a round_id (older pages) still save');

  // v0.5.0: feedback page rows go to their own table, nothing else about the visitor is stored
  const F=visit(),fb=(m,t='Idea',extra={})=>post({visit_id:F,kind:'feedback',topic:t,message:m,...extra});
  const frows=()=>raw.prepare('SELECT * FROM feedback ORDER BY id').all();
  ok(await fb('Please add a family search.')===204&&frows().at(-1).message==='Please add a family search.'&&frows().at(-1).topic==='Idea','feedback saved with its topic');
  ok(await fb('x'.repeat(1000))===204&&frows().at(-1).message.length===1000,'a 1000-character message is accepted');
  ok(await fb('x'.repeat(1001))===400,'a 1001-character message is refused');
  ok(await fb('ab')===400&&await fb('   ')===400,'too-short or blank messages are refused');
  ok(await fb('hello there','Rant')===400,'unknown topic refused');
  const n0=frows().length;await fb('ok message','Praise',{email:'a@b.c',name:'Bob'});ok(Object.keys(frows().at(-1)).sort().join()==='id,image,message,topic,ts,visit_id','extra fields (email, name) are dropped; only id, ts, visit, topic, message, image exist');
  ok(frows().length===n0+1&&rows().every(r=>r.kind!=='feedback'),'feedback never lands in the answers table');
  for(let i=0;i<5;i++)await fb('another '+i);ok(await fb('one too many')===429,'more than 5 feedback messages per visit are refused (429)');

  // photo on a feedback message: JPEG data URL only, size and count capped, never allowed on answers or surveys
  const J='data:image/jpeg;base64,/9j/'+'A'.repeat(2000)+'==';
  const G=visit();const fbi=(img,m='with a photo')=>post({visit_id:G,kind:'feedback',topic:'Problem',message:m,image:img});
  ok(await fbi(J)===204&&frows().at(-1).image===J,'a JPEG photo is stored with the message');
  ok(await post({visit_id:visit(),kind:'feedback',topic:'Idea',message:'no photo here'})===204&&frows().at(-1).image===null,'a message with no photo stores null');
  ok(await fbi('data:image/png;base64,iVBORw0KGgo=')===400,'a PNG data URL is refused (the page converts to JPEG)');
  ok(await fbi('data:text/html;base64,/9j/AAAA')===400&&await fbi('javascript:alert(1)')===400&&await fbi(123)===400,'non-image and script-looking values are refused');
  ok(await fbi('data:image/jpeg;base64,/9j/'+'A'.repeat(900000))===400,'a photo over the size cap is refused');
  ok(await fbi(J,'second photo')===204&&await fbi(J,'third photo')===429,'more than 2 photos per visit are refused (429)');
  ok(await post({visit_id:visit(),kind:'survey',survey:'A lot',image:J})===204&&rows().at(-1).kind==='survey','a photo sent with a survey tap is ignored');
  ok(await post({visit_id:visit(),kind:'answer',question_id:mc4,picked:'0',pad:'x'.repeat(5000)})===413,'a large body on an answer is refused (413)');
  ok(await post('x'.repeat(1100000))===413,'a body over 1 MB is refused (413)');


  // v0.6.0: one row per visit with the device id, Cloudflare's coarse location and a coarse device description
  const vrows=()=>raw.prepare('SELECT * FROM visits ORDER BY first_ts, rowid').all();
  const withCf=(b,cf,ua)=>{const r=new Request('https://x/',{method:'POST',body:JSON.stringify(b),headers:ua?{'User-Agent':ua}:{}});Object.defineProperty(r,'cf',{value:cf});return W.fetch(r,env).then(x=>x.status);};
  const V1=visit(),DEVID='abcd1234efgh5678ijkl';
  ok(await withCf({visit_id:V1,kind:'answer',question_id:mc4,picked:'0',device_id:DEVID,lang:'en-US',tz:'America/New_York',screen:'1180x820',dev:'tablet',ref:'whatsapp.com'},{country:'US',region:'Georgia',city:'Atlanta'},'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')===204,'an answer with visit details is accepted');
  const vr=vrows().find(x=>x.visit_id===V1);
  ok(vr&&vr.device_id===DEVID&&vr.country==='US'&&vr.region==='Georgia'&&vr.city==='Atlanta'&&vr.device_type==='tablet'&&vr.browser==='Safari'&&vr.os==='iOS'&&vr.lang==='en-US'&&vr.tz==='America/New_York'&&vr.screen==='1180x820'&&vr.ref==='whatsapp.com','visit row has device id, country/region/city, device type, browser, OS, language, time zone, screen and referrer');
  ok(Object.keys(vr).sort().join()==='browser,city,country,device_id,device_type,first_ts,lang,os,ref,region,screen,tz,visit_id','only those columns exist (no IP, no raw User-Agent)');
  ok(!JSON.stringify(vrows()).match(/Mozilla|AppleWebKit|\d+\.\d+\.\d+\.\d+/),'no User-Agent text or IP-looking text is stored');
  await withCf({visit_id:V1,kind:'survey',survey:'A lot',device_id:'zzzzzzzzzzzzzzzzzz'},{country:'CA'});
  ok(vrows().filter(x=>x.visit_id===V1).length===1&&vrows().find(x=>x.visit_id===V1).country==='US','a second row in the same visit does not add or change the visit row');
  const V2=visit();ok(await withCf({visit_id:V2,kind:'survey',survey:'Somewhat',device_id:DEVID},{country:'US',region:'Georgia'},'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36')===204&&vrows().filter(x=>x.device_id===DEVID).length===2,'two visits with the same device id can be linked (a returning device)');
  const V3=visit();ok(await withCf({visit_id:V3,kind:'survey',survey:'Somewhat',device_id:'BAD ID!',lang:'<script>',tz:'x'.repeat(80),screen:'99999999x1',dev:'toaster',ref:'a b'},{})===204,'bad detail values do not block the row');
  const v3=vrows().find(x=>x.visit_id===V3);ok(v3&&v3.device_id===null&&v3.lang===null&&v3.tz===null&&v3.screen===null&&v3.device_type===null&&v3.ref===null&&v3.country===null,'bad detail values are dropped, not stored');
  const nV=vrows().length;await ans(visit(),'Q999','0',{device_id:DEVID});await post({visit_id:visit(),kind:'survey',survey:'Maybe',device_id:DEVID});ok(vrows().length===nV,'a refused row creates no visit row');
  const brk={prepare:(sql)=>/INSERT OR IGNORE INTO visits/.test(sql)?{bind:()=>({run:async()=>{throw new Error('visits down')}})}:DB.prepare(sql)};
  ok(await W.fetch(new Request('https://x/',{method:'POST',body:JSON.stringify({visit_id:visit(),kind:'survey',survey:'A lot'})}),{DB:brk}).then(r=>r.status)===204,'if the visit table fails, the answer is still saved');

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
  ok(await post('x'.repeat(1100000))===413,'oversized body refused (413)');
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
