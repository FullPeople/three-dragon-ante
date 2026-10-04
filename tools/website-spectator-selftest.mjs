import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

// Real local authority + WebSocket + synthetic SQLite only; no browser or production endpoint.
const root = resolve(import.meta.dirname, '..');
const {WebSocket} = createRequire(new URL('../server/three-dragon/package.json', import.meta.url))('ws');
const {createTableService} = await import(pathToFileURL(resolve(root, process.env.TDA_SERVER_OUT || 'dist-server', 'service.mjs')));
const area = join(root, '.local-evidence', 'website-spectator'); mkdirSync(area, {recursive:true});
const evidence = mkdtempSync(join(area, 'run-')), database = join(evidence, 'synthetic.sqlite');
const origin = 'http://spectator-selftest.local', clients = [], services = [], checks = [];
const pass = message => { checks.push(message); console.log('PASS ' + message); };
const sleep = ms => new Promise(done => setTimeout(done, ms));
async function until(check, label, ms = 6000) {
  const end = Date.now() + ms;
  while (!check()) { if (Date.now() > end) throw Error('Timed out: ' + label); await sleep(5); }
}
async function start(options = {}) {
  const service = createTableService({database, origin, hostGraceMs:100, emptyRoomGraceMs:220, emptyRoomSweepMs:30, ...options});
  await new Promise((done, reject) => { service.server.once('error', reject); service.server.listen(0, '127.0.0.1', done); });
  const handle = {service, url:'http://127.0.0.1:' + service.server.address().port + '/three-dragon-api/v1', closed:false};
  services.push(handle); return handle;
}
async function stop(handle) { if (!handle.closed) { handle.closed=true; await handle.service.close(); } }
async function post(handle, path, body) {
  const response = await fetch(handle.url + path, {method:'POST', headers:{Origin:origin, 'Content-Type':'application/json'}, body:JSON.stringify(body)});
  return {status:response.status, body:await response.json()};
}
const sessionPath = room => '/guest/rooms/' + room.code + '/sessions';
const state = (handle, room) => JSON.parse(handle.service.db.prepare('SELECT state FROM rooms WHERE id=?').get(room.id).state);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const patch = (value, change) => { const next={...value, ...change.set}; for(const key of change.remove)delete next[key];return next; };
async function connect(handle, session) {
  const ws = new WebSocket(handle.url.replace('http:', 'ws:') + '/socket', {origin});
  const client = {ws, session, packets:[], view:null, identity:null, seq:0, closed:null, error:null}; clients.push(client);
  ws.on('error', error => { client.error=error; });
  ws.on('close', (code, reason) => { client.closed={code, reason:reason.toString()}; });
  ws.on('message', raw => {
    try {
      const packet=JSON.parse(raw.toString());client.packets.push(packet);
      if(packet.type==='view'){client.view=packet.view;client.identity=packet.identity;client.seq=packet.seq;}
      if(packet.type==='patch'){assert.equal(packet.base,client.seq);client.view={...patch(client.view,packet.patch),game:packet.gamePatch?patch(client.view.game,packet.gamePatch):packet.game};client.seq=packet.seq;}
    } catch(error){client.error=error;}
  });
  await new Promise((done,reject)=>{ws.once('open',done);ws.once('error',reject);});
  ws.send(JSON.stringify({type:'auth',room:session.roomId,token:session.token}));
  await until(()=>{if(client.error)throw client.error;if(client.closed)throw Error('Authentication closed');return !!client.view;},'authenticated synthetic client');
  return client;
}
async function close(client) { if(!client.closed){client.ws.close();await until(()=>client.closed,'client close');} }
async function command(client, value) {
  const id=crypto.randomUUID(), offset=client.packets.length;
  client.ws.send(JSON.stringify({type:'command',id,command:{...value,gameId:client.view.game?.id||null}}));
  await until(()=>{if(client.error)throw client.error;return client.packets.slice(offset).some(p=>p.type==='ack'&&p.id===id);},'command '+value.type);
  return client.packets.slice(offset).find(p=>p.type==='ack'&&p.id===id);
}
function publicOnly(client) {
  assert.equal(client.identity.role,'PLAYER');assert.equal(client.identity.spectating,true);
  assert.equal(client.view.isHost,false);assert.equal(client.view.canEdit,false);assert.equal(client.view.canKick,false);assert.equal(client.view.canHandover,false);
  if(client.view.game)for(const key of ['hand','selfSeatId','actions','handPowerHints','committedAnte','omniscient','privateHands','privateDeck','privateExcluded','privateCommittedAntes','privateHandPowerHints','deck','accepted'])assert.ok(!(key in client.view.game),'observer cannot receive '+key);
}
let failure;
try {
  let handle=await start();
  const made=await post(handle,'/guest/rooms',{name:'Synthetic host'});assert.equal(made.status,201);
  const room=made.body.room, host=await connect(handle,made.body.session), players=[host];
  const watched=await post(handle,sessionPath(room),{name:'Synthetic watcher',spectating:true});assert.equal(watched.status,201);assert.equal(watched.body.spectating,true);
  let watch=await connect(handle,watched.body.session);publicOnly(watch);
  assert.equal(state(handle,room).table.seats.length,1);assert.equal(handle.service.db.prepare('SELECT role FROM members WHERE id=?').get(watch.session.memberId).role,'SPECTATOR');
  pass('lobby observers persist as SPECTATOR without occupying a seat or gaining host capabilities');
  let before=hash(state(handle,room));
  for(const value of [{type:'join'},{type:'start'},{type:'newGame'},{type:'handover'},{type:'kick',playerId:host.session.memberId},{type:'inspect',enabled:true},{type:'omniscient',enabled:true},{type:'edit',edit:{kind:'gold',seatId:host.session.memberId,amount:1}},{type:'action',action:{id:crypto.randomUUID(),revision:1,seatId:host.session.memberId,kind:'ante'}}]){
    const reply=await command(watch,value);assert.equal(reply.ok,false);assert.equal(reply.code,'notAllowed');assert.equal(hash(state(handle,room)),before);
  }
  pass('all forged observer seat, game, edit, inspection and host commands are refused without changing authority state');
  for(let i=1;i<6;i++){const reply=await post(handle,sessionPath(room),{name:'Synthetic player '+i});assert.equal(reply.status,201);assert.equal(reply.body.spectating,false);players.push(await connect(handle,reply.body.session));}
  assert.equal(state(handle,room).table.seats.length,6);
  assert.equal((await command(host,{type:'start'})).ok,true);await until(()=>watch.view.game,'public running game');publicOnly(watch);
  const snapshot=hash(state(handle,room));
  const late=await post(handle,sessionPath(room),{name:'Synthetic late watcher',spectating:true});assert.equal(late.status,201);
  let lateWatch=await connect(handle,late.body.session);publicOnly(lateWatch);assert.equal(hash(state(handle,room)),snapshot);
  assert.equal((await post(handle,sessionPath(room),{name:'Extra seated player'})).body.error,'gameStarted');
  pass('a full six-seat running table accepts late watchers with the existing PublicView and unchanged game/seats');
  const hostToken=handle.service.db.prepare('SELECT token_hash FROM members WHERE id=?').get(host.session.memberId).token_hash;
  assert.equal((await post(handle,sessionPath(room),{name:'Synthetic host',spectating:true,reconnect:true,reconnectToken:host.session.token})).body.error,'nameTaken');
  assert.equal(handle.service.db.prepare('SELECT token_hash FROM members WHERE id=?').get(host.session.memberId).token_hash,hostToken);
  assert.equal((await post(handle,sessionPath(room),{name:'Synthetic watcher',spectating:false,reconnect:true,reconnectToken:watch.session.token})).body.error,'nameTaken');
  assert.equal((await post(handle,sessionPath(room),{name:'Synthetic watcher',spectating:true})).body.error,'nameTaken');
  pass('watch requests cannot take an existing seat name, change its capability, or turn a watcher into a player');
  const oldSession=watch.session;
  const refreshed=await post(handle,sessionPath(room),{name:'Synthetic watcher',spectating:true,reconnect:true,reconnectToken:oldSession.token});assert.equal(refreshed.status,200);assert.equal(refreshed.body.spectating,true);assert.notEqual(refreshed.body.session.token,oldSession.token);
  await until(()=>watch.closed,'rotated watcher socket');assert.equal(watch.closed.code,4001);
  watch=await connect(handle,refreshed.body.session);publicOnly(watch);assert.equal(hash(state(handle,room)),snapshot);
  await assert.rejects(()=>connect(handle,oldSession));
  pass('cached watcher reconnect rotates credentials and replaces only its own connection while keeping a public projection');
  await close(lateWatch);
  const reclaimed=await post(handle,sessionPath(room),{name:'Synthetic late watcher',reconnect:true});assert.equal(reclaimed.status,200);assert.equal(reclaimed.body.spectating,true);assert.equal(reclaimed.body.session.memberId,late.body.session.memberId);
  lateWatch=await connect(handle,reclaimed.body.session);publicOnly(lateWatch);
  pass('explicit offline reconnect without cached mode restores the persisted spectator role and never creates a seat');
  assert.equal((await command(watch,{type:'leave'})).ok,true);assert.equal(hash(state(handle,room)),snapshot);
  assert.equal((await command(watch,{type:'omniscient',enabled:true})).code,'notAllowed');publicOnly(watch);
  pass('observer leave during a running game is allowed as a no-op and never grants inspection');
  for(let i=0;i<56;i++)assert.equal((await post(handle,sessionPath(room),{name:'Synthetic bounded watcher '+i,spectating:true})).status,201);
  assert.equal(handle.service.db.prepare('SELECT count(*) n FROM members WHERE room=?').get(room.id).n,64);
  assert.equal((await post(handle,sessionPath(room),{name:'Synthetic overflow',spectating:true})).body.error,'tableFull');
  const boundedReconnect=await post(handle,sessionPath(room),{name:'Synthetic watcher',spectating:true,reconnect:true,reconnectToken:watch.session.token});assert.equal(boundedReconnect.status,200);
  await until(()=>watch.closed,'bounded reconnect rotation');
  watch=await connect(handle,boundedReconnect.body.session);publicOnly(watch);
  pass('the 64-member cap includes watchers, while reconnecting an existing watcher stays within the cap');
  const restartSession=watch.session;
  const gameHash=hash(state(handle,room).game);
  await stop(handle);handle=await start();
  watch=await connect(handle,restartSession);publicOnly(watch);assert.equal(hash(state(handle,room).game),gameHash);assert.equal(state(handle,room).table.seats.length,6);
  pass('service restart reloads durable spectator credentials/role without converting its public view or changing the game');
  await sleep(380);assert.ok(handle.service.db.prepare('SELECT id FROM rooms WHERE id=?').get(room.id));
  assert.equal(state(handle,room).table.hostPlayerId,host.session.memberId);publicOnly(watch);
  pass('a watcher alone keeps a room alive beyond the configured empty grace and is never an automatic host successor');
  const successor=await connect(handle,players[1].session);await until(()=>successor.view.isHost,'actual seated successor');
  assert.equal(state(handle,room).table.hostPlayerId,players[1].session.memberId);assert.equal(hash(state(handle,room).game),gameHash);publicOnly(watch);
  pass('the next real seated player receives automatic ownership while the watcher and game remain unchanged');
  await close(successor);await close(watch);await until(()=>!handle.service.db.prepare('SELECT id FROM rooms WHERE id=?').get(room.id),'last watcher leaves and empty room expires');
  pass('the last watcher disconnect starts normal empty-room collection and removes the synthetic room');
  const limited=await start({database:':memory:',maxSockets:1,maxRooms:1});
  const limitedRoom=await post(limited,'/guest/rooms',{name:'Synthetic socket host'});const first=await connect(limited,limitedRoom.body.session);
  const limitedWatch=await post(limited,sessionPath(limitedRoom.body.room),{name:'Synthetic socket watcher',spectating:true});assert.equal(limitedWatch.status,201);
  await assert.rejects(()=>connect(limited,limitedWatch.body.session));assert.equal(limited.service.stats().sockets,1);
  assert.equal((await post(limited,'/guest/rooms',{name:'Synthetic extra room'})).body.error,'roomFull');await close(first);
  pass('watchers retain the real WebSocket and room-cap limits');
  for(const client of clients)if(client.error&&!client.closed)throw client.error;
} catch(error){failure=error;}
finally {
  for(const client of clients)if(client.ws.readyState<2)client.ws.terminate();
  for(const handle of services)await stop(handle);
  writeFileSync(join(evidence,'result.json'),JSON.stringify({completed:!failure,checks,error:failure?{name:failure.name,message:failure.message}:null,scope:'Synthetic real service/WebSocket/SQLite, accelerated 220ms empty-room and 100ms host-grace fixture; no browser or physical/public UAT'},null,2));
}
console.log(checks.length+' checks passed; '+evidence);
if(failure)throw failure;
