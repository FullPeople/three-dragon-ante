import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {resolve, join, extname, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium, browserLaunchOptions} from './browser-runtime.mjs';

// Run after the current npm run build and npm run build:server. No product hooks or copied rules.
// All rooms are created through the actual website; only numeric/boolean metadata is saved.
const root=resolve(import.meta.dirname,'..'), dist=resolve(root,'extensions/three-dragon-ante/dist'), base='/three-dragon-ante-dev/';
if(!existsSync(join(dist,'index.html')))throw Error('Build the current website before the spectator browser check');
const area=join(root,'.local-evidence/website-spectator-browser');mkdirSync(area,{recursive:true});
const evidence=mkdtempSync(join(area,'run-')), checks=[], errors=[], external=[], resourceFailures=[], actors=[];
const paths=['server/three-dragon/service.mjs','extensions/three-dragon-ante/src/site/online-session.ts','extensions/three-dragon-ante/src/site/SiteApp.tsx','extensions/three-dragon-ante/src/site/OnlineMatch.ts','extensions/three-dragon-ante/src/presentation/hud/Lobby.tsx'];
const hashes=()=>paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')}));
const beforeHashes=hashes(), gameHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const {createTableService}=await import(pathToFileURL(resolve(root,process.env.TDA_SERVER_OUT||'dist-server','service.mjs')));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon'};
let service,browser,origin,failure,stage='startup';
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/three-dragon-api/v1/')){service.server.emit('request',req,res);return;}
  const file=resolve(dist,decodeURIComponent(pathname.slice(base.length))||'index.html');
  if(!pathname.startsWith(base)||!file.startsWith(dist+sep)||!existsSync(file)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
const pass=message=>{checks.push(message);console.log('PASS '+message);};
async function until(check,label,timeout=30000){const end=Date.now()+timeout;while(!await check()){if(Date.now()>end)throw Error('Timed out: '+label);await new Promise(done=>setTimeout(done,20));}}
const state=room=>JSON.parse(service.db.prepare('SELECT state FROM rooms WHERE id=?').get(room).state);
async function actor(label,narrow=false){
  const context=await browser.newContext({locale:'zh-CN',viewport:narrow?{width:390,height:844}:{width:1440,height:900},isMobile:narrow,hasTouch:narrow,reducedMotion:'reduce'}),page=await context.newPage();
  const value={context,page,label,observer:false,publicFrames:0,privateFrames:0,identityWatching:false};actors.push(value);
  context.on('request',request=>{if(!request.url().startsWith(origin+'/'))external.push(label);});
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  page.on('pageerror',error=>errors.push({actor:label,kind:error.name}));
  page.on('response',response=>{if(response.status()>=400)resourceFailures.push({actor:label,status:response.status()});});
  page.on('dialog',dialog=>{errors.push({actor:label,kind:'UnexpectedDialog'});void dialog.dismiss();});
  page.on('websocket',socket=>socket.on('framereceived',event=>{
    if(!value.observer)return;
    try{
      const packet=JSON.parse(event.payload.toString());
      if(packet.identity)value.identityWatching=packet.identity.spectating===true;
      if(packet.type==='view'||packet.type==='patch'){
        value.publicFrames++;
        const banned=new Set(['hand','selfSeatId','actions','handPowerHints','committedAnte','omniscient','privateHands','privateDeck','privateExcluded','privateCommittedAntes','privateHandPowerHints','deck','accepted']);
        const privateKey=value=>!!value&&typeof value==='object'&&Object.entries(value).some(([key,child])=>banned.has(key)||privateKey(child));
        if(privateKey(packet.view?.game)||privateKey(packet.game)||privateKey(packet.gamePatch?.set))value.privateFrames++;
      }
    }catch{errors.push({actor:label,kind:'InvalidSocketFrame'});}
  }));
  return value;
}
async function name(actor,value){const field=actor.page.locator('#guest-name');await field.click();await field.fill(value);}
async function connected(actor){await actor.page.locator('.site-online-match[data-connected="true"]').waitFor();}
async function observerDOM(actor){
  await actor.page.getByTestId('spectator-status').waitFor();
  assert.equal(await actor.page.locator('.tda-card--hand[data-card]').count(),0,'observer hands remain anonymous');
  assert.equal(await actor.page.locator('.tda-card--hand:not(.is-face-down)').count(),0,'observer never shows hand faces');
  assert.equal(await actor.page.locator('#table-editor, #omniscient-toggle').count(),0);
  assert.equal(await actor.page.getByRole('button',{name:'出牌',exact:true}).count(),0);
  assert.equal(await actor.page.getByRole('button',{name:'前注',exact:true}).count(),0);
  assert.equal(actor.identityWatching,true);assert.equal(actor.privateFrames,0);assert.ok(actor.publicFrames>0);
}
async function ante(actor,room){
  await actor.page.waitForFunction(()=>document.querySelector('.tda-shell')?.dataset.phase==='ante'&&document.querySelector('.tda-shell')?.dataset.busy==='false'&&document.querySelector('.tda-card--hand.is-legal'));
  const before=state(room).game.revision,card=actor.page.locator('.tda-card--hand.is-legal').last();
  await card.focus();await actor.page.keyboard.press('Space');await actor.page.keyboard.press('Enter');
  await until(()=>state(room).game.revision>before,'accepted real website ante');
  await actor.page.waitForFunction(()=>document.querySelector('.tda-shell')?.dataset.pendingAction==='false');
}
try{
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);done();});});
  origin='http://127.0.0.1:'+server.address().port;service=createTableService({database:':memory:',origin});
  server.on('upgrade',(req,socket,head)=>service.server.emit('upgrade',req,socket,head));
  browser=await chromium.launch({...browserLaunchOptions(),headless:true,args:['--no-proxy-server','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const viewport of ['desktop','narrow']){
    stage=viewport+'-admission';
    const host=await actor(viewport+'-host'),peer=await actor(viewport+'-peer'),watch=await actor(viewport+'-watch',viewport==='narrow');
    await host.page.goto(origin+base);await name(host,'Synthetic '+viewport+' host');await host.page.getByRole('button',{name:'创建房间',exact:true}).click();await connected(host);
    const roomCode=await host.page.getByTestId('online-room-code').textContent(),roomId=await host.page.evaluate(()=>JSON.parse(sessionStorage.getItem('three-dragon-site-active.v1')).room.id);
    await peer.page.goto(origin+base+'?room='+roomCode);await name(peer,'Synthetic '+viewport+' player');await peer.page.getByRole('button',{name:'加入房间',exact:true}).click();await connected(peer);
    await until(()=>state(roomId).table.seats.length===2,'two actual website seats');
    watch.observer=true;
    await watch.page.goto(origin+base+'?room='+roomCode);await name(watch,'Synthetic '+viewport+' lobby watcher');await watch.page.getByTestId('watch-room').click();await connected(watch);
    await watch.page.locator('.tda-lobby').waitFor();await watch.page.getByTestId('spectator-status').waitFor();
    assert.equal(await watch.page.locator('.tda-lobby').getByRole('button',{name:'加入',exact:true}).count(),0);assert.equal(await watch.page.getByRole('button',{name:'开始',exact:true}).count(),0);
    assert.equal(state(roomId).table.seats.length,2);await watch.page.getByTestId('leave-room').click();await watch.page.locator('.site-home').waitFor();
    pass(viewport+': actual Watch button opens an unseated lobby without Join/Start and exits without seat changes');
    await host.page.getByRole('button',{name:'开始',exact:true}).click();await host.page.locator('.tda-card--hand[data-card]').first().waitFor();await peer.page.locator('.tda-card--hand[data-card]').first().waitFor();
    const beforeLate=gameHash(state(roomId));
    await name(watch,'Synthetic '+viewport+' late watcher');await watch.page.getByTestId('watch-room').click();await connected(watch);await observerDOM(watch);
    assert.equal(gameHash(state(roomId)),beforeLate);assert.equal(state(roomId).table.seats.length,2);
    pass(viewport+': a late actual website watcher sees anonymous hands and PublicView while the two-player game stays unchanged');
    stage=viewport+'-public-cards';
    for(let round=0;round<8&&state(roomId).game.stage==='ante';round++){await ante(peer,roomId);await ante(host,roomId);}
    assert.notEqual(state(roomId).game.stage,'ante','a real non-tied ante finishes within the bounded legal sequence');
    const publicCards=state(roomId).game.ante;assert.ok(publicCards.length>0,'the authority has actual public ante cards');
    await watch.page.waitForFunction(ids=>ids.every(id=>document.querySelector('.tda-card--ante[data-card="'+CSS.escape(id)+'"]:not(.is-face-down)')),publicCards);
    await observerDOM(watch);
    pass(viewport+': accepted player antes become visible public cards without exposing either private hand');
    const stable=gameHash(state(roomId));stage=viewport+'-refresh';
    await watch.page.reload();await connected(watch);await observerDOM(watch);assert.equal(gameHash(state(roomId)),stable);
    pass(viewport+': actual browser refresh restores the watcher mode and public projection');
    stage=viewport+'-offline-reconnect';
    await watch.page.getByTestId('leave-room').click();await watch.page.locator('.site-home').waitFor();assert.equal(await watch.page.getByTestId('leave-confirmation').count(),0);assert.equal(gameHash(state(roomId)),stable);
    await watch.page.getByRole('button',{name:'重连房间',exact:true}).click();await connected(watch);await observerDOM(watch);assert.equal(gameHash(state(roomId)),stable);
    pass(viewport+': returning home skips the player game confirmation and cached offline reconnect keeps observer capability');
    await watch.page.getByTestId('leave-room').click();await watch.page.locator('.site-home').waitFor();
    await watch.page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key.startsWith('three-dragon-site-session.v1:'))localStorage.removeItem(key);});
    await watch.page.getByRole('button',{name:'重连房间',exact:true}).click();await connected(watch);await observerDOM(watch);assert.equal(gameHash(state(roomId)),stable);
    pass(viewport+': explicit reconnect without cached mode is resolved by the durable spectator role');
    await watch.page.getByTestId('leave-room').click();await watch.page.locator('.site-home').waitFor();assert.equal(gameHash(state(roomId)),stable);
    assert.equal(await host.page.locator('.site-online-match').getAttribute('data-connected'),'true');assert.equal(await peer.page.locator('.site-online-match').getAttribute('data-connected'),'true');
    for(const actor of [watch,peer,host])await actor.context.close();
  }
  stage='source-and-errors';assert.deepEqual(hashes(),beforeHashes);assert.equal(errors.length,0);assert.equal(external.length,0);assert.equal(resourceFailures.length,0);
  pass('unchanged source finishes desktop/narrow watching with no page errors, failed resources or external requests');
}catch(error){failure=error;}
finally{
  try{await browser?.close();}finally{try{await service?.close();}finally{if(server.listening)await new Promise(done=>server.close(done));}}
  writeFileSync(join(evidence,'result.json'),JSON.stringify({completed:!failure,stage,checks,beforeHashes,afterHashes:hashes(),observerFrames:actors.filter(a=>a.observer).map(a=>({viewport:a.label.startsWith('narrow')?'narrow':'desktop',publicFrames:a.publicFrames,privateFrames:a.privateFrames,identityWatching:a.identityWatching})),errors:errors.length,external:external.length,resourceFailures:resourceFailures.length,errorCategory:failure?.name||null,scope:'Actual built website buttons, real loopback authority, synthetic rooms; software GL browser fixture, no public/physical-device UAT'},null,2));
}
console.log(checks.length+' checks passed; '+evidence);if(failure)throw failure;
