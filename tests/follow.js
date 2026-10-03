// Previous / Next turns the globe to the card's place after the user has dragged or zoomed.
// For every card: knock the globe somewhere else (as a drag would), press Next, wait for the turn, and check the card's place
// is on the front of the globe and on screen, and that the user's zoom was kept unless the place could not fit.
const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});let bad=0;
for(const [name,dev,all] of [['desktop',devices['Desktop Chrome'],true],['iphone',devices['iPhone 13'],false],['ipad',devices['iPad (gen 7)'],false]]){
 const c=await b.newContext({...dev,viewport:name==='desktop'?{width:1440,height:900}:dev.viewport});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(''+(process.env.SITE||'http://localhost:8778/')+'');await p.waitForTimeout(2500);
 const press=async s=>name==='desktop'?p.locator(s).click():p.locator(s).tap();
 const probe=()=>p.evaluate(()=>{const pts=recordPlaces(selected.record,selected.type).map(svgToLonLat),st=$('stage'),w=st.clientWidth,h=st.clientHeight;
   return {id:selected.record.id,title:selected.record.title,n:pts.length,zoom:+view.zoom.toFixed(3),deg:+view.deg.toFixed(2),inView:pts.every(([lo,la])=>{const q=project(lo,la);return q.vis&&q.x>0&&q.x<w&&q.y>0&&q.y<h;}),animating:turnAnim!=null};});
 // 0. follow mode (user has not touched the globe): the story camera should already show each card's place
 await p.evaluate(()=>{dismissPrompt();setYearExact(-1300);closeStory();});
 const follow=[];const cards=await p.evaluate(()=>milestones.length);
 for(let i=0;i<(all?cards:4);i++){await press('#next');await p.waitForTimeout(250);const r=await probe();if(!r.inView)follow.push(r.title);}
 console.log(name,'follow mode: cards not in view:',JSON.stringify(follow));
 // 1. real drag + wheel zoom, then Next
 await p.evaluate(()=>{closeStory();setYearExact(-1300);});
 const box=await p.locator('#ov').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height*.45;
 if(name==='desktop'){await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx-260,cy+60,{steps:8});await p.mouse.up();await p.mouse.move(cx,cy);await p.mouse.wheel(0,-500);}
 else{await p.evaluate(()=>{view.lon+=140;view.lat=-40;view.manual=true;setZoom(2);});}
 await p.waitForTimeout(300);const before=await p.evaluate(()=>({manual:view.manual,zoom:+view.zoom.toFixed(3)}));
 // 2. every card: displace, press Next, check
 const rows=[];const n=all?cards:6;
 for(let i=0;i<n;i++){await p.evaluate(i=>{view.lon+=90+37*i;view.lat=[-50,60,10,-20,45,0][i%6];view.manual=true;render();},i);await p.waitForTimeout(120);
  const z0=await p.evaluate(()=>+view.zoom.toFixed(3)),id0=await p.evaluate(()=>selected?.record.id);await press('#next');await p.waitForTimeout(1100);const r=await probe();if(r.id===id0)break;   // no later card: Next does nothing
  r.zoomBefore=z0;r.zoomKept=Math.abs(r.zoom-z0)<.002;rows.push(r);}
 const missed=rows.filter(r=>!r.inView||r.animating),zoomChanged=rows.filter(r=>!r.zoomKept).map(r=>`${r.title} (${r.zoomBefore}→${r.zoom}, deg ${r.deg}, ${r.n} places)`);
 // 2b. every card is reachable: from the first card, Next visits every card once, in order; Previous walks back; no duplicates by title
 if(name==='desktop'){const walk=await p.evaluate(async()=>{closeStory();setYearExact(-1300);const want=milestones.map(m=>m.record.id),got=[];selectMilestone(0);got.push(selected.record.id);for(let i=0;i<60;i++){const before=selected.record.id;step(1);if(selected.record.id===before)break;got.push(selected.record.id);}
   const back=[];for(let i=0;i<60;i++){const before=selected.record.id;step(-1);if(selected.record.id===before)break;back.push(selected.record.id);}
   const titles=milestones.map(m=>m.type+'|'+m.record.title),dup=titles.filter((t,i)=>titles.indexOf(t)!==i);
   const destroyedTitles=milestones.filter(m=>m.type==='destruction').map(m=>m.record.title),changeClash=milestones.filter(m=>m.type==='change'&&destroyedTitles.includes(m.record.title)).map(m=>m.record.title);
   return {cards:want.length,reached:got.length,inOrder:JSON.stringify(got)===JSON.stringify(want),backOk:back.length===want.length-1&&JSON.stringify(back)===JSON.stringify(want.slice(0,-1).reverse()),dup,changeClash};});
  console.log('desktop walk',JSON.stringify(walk));if(!(walk.reached===walk.cards&&walk.inOrder&&walk.backOk&&!walk.dup.length&&!walk.changeClash.length)){bad++;console.log('walk FAIL');}}
 // 3. Previous works the same way, and touching the globe cancels a turn in progress
 await p.evaluate(()=>{view.lon+=120;view.lat=-35;view.manual=true;render();});await press('#prev');await p.waitForTimeout(1100);const prev=await probe();
 await p.evaluate(()=>{view.lon+=150;view.lat=30;view.manual=true;render();});await press('#next');await p.waitForTimeout(200);const mid=await p.evaluate(()=>turnAnim!=null);
 await p.evaluate(()=>stopTour());const cancelled=await p.evaluate(()=>turnAnim===null);
 if(name==='desktop'||name==='iphone'){await p.screenshot({path:`tests/out/follow-${name}.png`});}
 const ok=before.manual&&!missed.length&&prev.inView&&mid&&cancelled&&!errs.length;if(!ok)bad++;
 console.log(name,JSON.stringify({before,cards:rows.length,notInView:missed.map(r=>r.title),zoomChanged,prevInView:prev.inView,turnWasRunning:mid,cancelled,errs}),ok?'PASS':'FAIL');await c.close();}
await b.close();process.exit(bad?1:0);})();
