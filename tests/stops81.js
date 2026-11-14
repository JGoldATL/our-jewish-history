// Camera stops 8.1a (1904, Second Aliyah, Jerusalem) and 8.1c (1905, hold back on Kiev) load from the Sheet in year order (data v6.0.0, 51 stops).
// Run: node tests/stops81.js   (reads data/history.json directly; no server needed)
const fs=require('fs');let fail=0;const ck=(n,ok,x)=>{console.log((ok?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));if(!ok)fail++;};
const s=JSON.parse(fs.readFileSync(__dirname+'/../data/history.json','utf8')).sheet;const st=s.cameraStops;
ck('51 camera stops',st.length===51,st.length);
const e8=st.filter(x=>x.era===8).map(x=>x.id);
ck('Era 8 has 13 stops in year order',JSON.stringify(e8)===JSON.stringify(['STOP-8.1','STOP-8.1a','STOP-8.1c','STOP-8.1b','STOP-8.2','STOP-8.3','STOP-8.4','STOP-8.5','STOP-8.6','STOP-8.7','STOP-8.7b','STOP-8.8','STOP-8.9']),e8);
const a=st.find(x=>x.id==='STOP-8.1a'),c=st.find(x=>x.id==='STOP-8.1c');
ck('8.1a is 1904, centred on Jerusalem, Yemen and Eastern Europe in frame, carries EVT-0103 (movement ids map to their parent Event since data v6.0.0)',a&&a.startYear===1904&&a.centerPlaceId==='place-j'&&a.framePlaceIds.includes('place-yemen')&&a.framePlaceIds.includes('place-eastern-europe')&&['EVT-0103'].every(i=>a.recordIds.includes(i)));
ck('8.1c is 1905, centred on Kiev, fits',c&&c.startYear===1905&&c.centerPlaceId==='place-kiev'&&c.fits===true);
ck('both approved',a.status==='approved'&&c.status==='approved');
ck('the old duplicate 7.1 is now two stops, STOP-7.1 (1700) and STOP-7.10 (1881)',st.filter(x=>/^STOP-7\.10?$/.test(x.id)).length===2);
console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
