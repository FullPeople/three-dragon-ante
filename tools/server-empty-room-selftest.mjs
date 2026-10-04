import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const root=resolve(import.meta.dirname,'..');
const {WebSocket}=createRequire(new URL('../server/three-dragon/package.json',import.meta.url))('ws');
const {createTableService}=await import(pathToFileURL(join(root,process.env.TDA_SERVER_OUT||'dist-server','service.mjs')));
const evidenceRoot=join(root,'.local-evidence','empty-room');mkdirSync(evidenceRoot,{recursive:true});
const evidence=mkdtempSync(join(evidenceRoot,'run-')),database=join(evidence,'synthetic.sqlite');
const origin='http://empty-room-test.local',clients=[],checks=[];
let service,url,port,failNext=false,failedCommits=0,failure;
const pass=label=>{checks.push(label);console.log('PASS '+label);};
const delay=ms=>new Promise(done=>setTimeout(done,ms));
async function wait(check,label){const end=Date.now()+4000;while(!check()){if(Date.now()>end)throw Error('Timed out: '+label);await delay(5);}}
async function start(){service=createTableService({database,origin,maxRooms:2,hostGraceMs:80,emptyRoomGraceMs:300,emptyRoomSweepMs:50,injectFailure(){if(failNext){failNext=false;failedCommits++;throw Error('storageFailed');}}});await new Promise(done=>service.server.listen(port||0,'127.0.0.1',done));port=service.server.address().port;url=`http://127.0.0.1:${port}/three-dragon-api/v1`;}
async function post(path,data){const response=await fetch(url+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,data:await response.json()};}
const tables=['rooms','members','credentials','guest_rooms','guest_members','guest_room_lifecycle','receipts','history'];
const counts=()=>Object.fromEntries(tables.map(table=>[table,service.db.prepare(`SELECT count(*) n FROM ${table}`).get().n]));
const exists=room=>!!service.db.prepare('SELECT 1 FROM rooms WHERE id=?').get(room.id);
const stored=room=>JSON.parse(service.db.prepare('SELECT state FROM rooms WHERE id=?').get(room.id).state);
async function connect(session,expectedClose){
 const ws=new WebSocket(url.replace('http:','ws:')+'/socket',{origin}),client={ws,view:null,closed:null,messages:[]};clients.push(client);
 ws.on('error',()=>{});ws.on('close',code=>{client.closed=code;});ws.on('message',data=>{const message=JSON.parse(data.toString());client.messages.push(message);if(message.type==='view')client.view=message.view;});
 await new Promise((done,reject)=>{ws.once('open',done);ws.once('error',reject);});ws.send(JSON.stringify({type:'auth',room:session.roomId,token:session.token}));
 await wait(()=>expectedClose?client.closed!==null:client.view!==null,'authentication');if(expectedClose)assert.equal(client.closed,1008);return client;
}
async function disconnect(client){client.ws.close();await wait(()=>client.closed!==null,'disconnect');}
async function command(client,value){const id=crypto.randomUUID();client.ws.send(JSON.stringify({type:'command',id,command:value}));await wait(()=>client.messages.some(m=>m.id===id&&m.type==='ack'),'command '+value.type);assert.equal(client.messages.find(m=>m.id===id&&m.type==='ack').ok,true);}
try{
 await start();
 for(let i=0;i<2;i++)assert.equal((await post('/guest/rooms',{name:'Unused '+i})).status,201);
 const full=await post('/guest/rooms',{name:'Overflow'});assert.equal(full.status,503);assert.deepEqual(full.data,{error:'roomFull'});assert.equal(counts().rooms,2);
 pass('unconnected HTTP-created rooms are bounded; overflow is rejected without an extra row');
 await wait(()=>counts().rooms===0,'unused expiry');assert.ok(Object.values(counts()).every(n=>n===0));assert.deepEqual(service.stats(),{rooms:0,sockets:0});
 pass('unused rooms expire and cascade all membership and capability rows');

 const created=(await post('/guest/rooms',{name:'Owner'})).data,{room,session:owner}=created;
 let host=await connect(owner);
 const player=(await post(`/guest/rooms/${room.code}/sessions`,{name:'Player'})).data.session;
 const peer=await connect(player);
 await command(host,{type:'start',options:{startingGold:200,variant:{ruleSetId:'provided-pack-20260910',deckId:'wheel-of-fate-v1'}}});
 await command(host,{type:'action',gameId:stored(room).game.id,action:{id:'empty-test-ante',revision:stored(room).game.revision,seatId:owner.memberId,kind:'ante',cardId:stored(room).game.seats[0].hand[0]}});
 await command(peer,{type:'action',gameId:stored(room).game.id,action:{id:'empty-test-peer-ante',revision:stored(room).game.revision,seatId:player.memberId,kind:'ante',cardId:stored(room).game.seats[1].hand[0]}});
 const game=stored(room).game;
 assert.ok(counts().receipts>0&&counts().history>0);
 await disconnect(peer);await delay(400);assert.ok(exists(room));assert.deepEqual(stored(room).game,game);
 pass('a room with one remaining online browser keeps the exact game beyond the empty grace');
 await disconnect(host);assert.deepEqual(service.stats(),{rooms:0,sockets:0});assert.ok(exists(room));
 host=await connect(owner);await delay(400);assert.ok(exists(room));assert.deepEqual(stored(room).game,game);
 pass('last disconnect releases the live cache; reconnect within grace cancels deletion and preserves cards and receipts');
 await disconnect(host);await wait(()=>!exists(room),'last-browser expiry');assert.ok(Object.values(counts()).every(n=>n===0));
 assert.equal((await post(`/guest/rooms/${room.code}/sessions`,{name:'Owner',reconnect:true})).data.error,'roomMissing');await connect(owner,true);
 pass('last-browser expiry deletes history, receipts and all room rows; old code and token cannot resurrect it');

 const retry=(await post('/guest/rooms',{name:'Retry'})).data;
 const retryHost=await connect(retry.session);await disconnect(retryHost);failNext=true;
 await wait(()=>failedCommits===1,'failed cleanup commit');assert.ok(exists(retry.room));assert.equal(counts().members,1);
 await wait(()=>!exists(retry.room),'cleanup retry');assert.ok(Object.values(counts()).every(n=>n===0));
 pass('a failed cleanup transaction retains every row and the next sweep retries successfully');

 const restarted=(await post('/guest/rooms',{name:'Restart'})).data;
 let restartHost=await connect(restarted.session);await service.close();await start();restartHost=await connect(restarted.session);
 await delay(400);assert.ok(exists(restarted.room));await disconnect(restartHost);await wait(()=>!exists(restarted.room),'postrestart expiry');
 pass('service restart grants reconnect grace; recovered online room survives and later empties normally');

 // Older Owlbear rooms are not silently migrated into the new website policy.
 const legacy=(await post('/rooms',{name:'Historical',externalId:'historical-test'})).data;
 const legacyHost=await connect(legacy.session);await disconnect(legacyHost);await delay(400);assert.ok(exists(legacy.room));
 pass('retained historical Owlbear rooms are not deleted by the website-only lifecycle');
 assert.deepEqual(service.db.prepare('PRAGMA table_info(guest_rooms)').all().map(column=>column.name),['room','code']);
 service.db.prepare('INSERT INTO guest_rooms VALUES(?,?)').run(legacy.room.id,'OLDTEST2');
 assert.equal(service.db.prepare('SELECT count(*) n FROM guest_room_lifecycle WHERE room=?').get(legacy.room.id).n,0);
 await service.close();await start();await wait(()=>!exists(legacy.room),'previous-version room adoption');assert.ok(Object.values(counts()).every(n=>n===0));
 pass('the previous version two-column room insert remains valid; a subsequent upgrade adopts and cleans that room');
}catch(error){failure=error;console.error(error);}
finally{for(const c of clients)c.ws.terminate();await service?.close();writeFileSync(join(evidence,'result.json'),JSON.stringify({checks,passed:checks.length,scope:'Synthetic loopback HTTP/WebSocket and SQLite only.',emptyRoomGraceMs:300,emptyRoomSweepMs:50,completed:!failure,...(failure?{failure:String(failure)}:{})},null,2));console.log(evidence);}
if(failure)throw failure;
