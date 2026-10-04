import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Synthetic rooms only. No production endpoint, account, or database is used.
// Run after npm run build:server: node tools/three-dragon-guest-server-selftest.mjs
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {WebSocket} = createRequire(new URL('../server/three-dragon/package.json', import.meta.url))('ws');
const {createTableService} = await import(pathToFileURL(resolve(root, process.env.TDA_SERVER_OUT || 'dist-server', 'service.mjs')));
const evidenceRoot = join(root, '.local-evidence', 'guest-server');
mkdirSync(evidenceRoot, {recursive: true});
const evidence = mkdtempSync(join(evidenceRoot, 'run-'));
const database = join(evidence, 'synthetic.sqlite');
const origin = 'http://guest-selftest.local';
const options = {startingGold: 200, variant: {ruleSetId: 'provided-pack-20260910', deckId: 'wheel-of-fate-v1'}};
const clients = [], checks = [];
let service, url, port, failCommit = false, failure;
const pass = message => { checks.push(message); console.log('PASS ' + message); };
const wait = async (check, label, ms = 6000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw Error('Timed out: ' + label);
    await new Promise(done => setTimeout(done, 5));
  }
};
async function start(overrides = {}) {
  service = createTableService({database, origin, hostGraceMs: 180, ...overrides, injectFailure() {
    if (failCommit) { failCommit = false; throw Error('storageFailed'); }
  }});
  await new Promise(done => service.server.listen(port || 0, '127.0.0.1', done));
  port = service.server.address().port;
  url = 'http://127.0.0.1:' + port + '/three-dragon-api/v1';
}
async function post(path, data, token) {
  const response = await fetch(url + path, {method: 'POST', headers: {
    'Content-Type': 'application/json', Origin: origin,
    ...(token ? {Authorization: 'Bearer ' + token} : {})
  }, body: JSON.stringify(data)});
  return {status: response.status, data: await response.json()};
}
const guestPath = room => '/guest/rooms/' + room.code + '/sessions';
const state = room => JSON.parse(service.db.prepare('SELECT state FROM rooms WHERE id=?').get(room.id).state);
const count = table => service.db.prepare('SELECT count(*) n FROM ' + table).get().n;
const counts = () => Object.fromEntries(['rooms', 'members', 'credentials', 'guest_rooms', 'guest_members', 'receipts', 'history'].map(table => [table, count(table)]));
const patch = (old, change) => {
  const next = {...old, ...change.set};
  for (const key of change.remove) delete next[key];
  return next;
};
async function socket(session) {
  const ws = new WebSocket(url.replace('http:', 'ws:') + '/socket', {origin});
  const client = {ws, session, messages: [], view: null, identity: null, seq: 0, error: null, closed: null};
  clients.push(client);
  ws.on('error', error => { client.error = error; });
  ws.on('close', (code, reason) => { client.closed = {code, reason: reason.toString()}; });
  ws.on('message', data => {
    try {
      const message = JSON.parse(data.toString());
      client.messages.push(message);
      if (message.type === 'view') {
        client.view = message.view; client.identity = message.identity; client.seq = message.seq;
      } else if (message.type === 'patch') {
        assert.equal(message.base, client.seq, 'patch must follow the acknowledged projection');
        client.view = {...patch(client.view, message.patch), game: message.gamePatch ? patch(client.view.game, message.gamePatch) : message.game};
        client.seq = message.seq;
      }
    } catch (error) { client.error = error; }
  });
  await new Promise((done, reject) => { ws.once('open', done); ws.once('error', reject); });
  ws.send(JSON.stringify({type: 'auth', room: session.roomId, token: session.token}));
  return client;
}
async function connect(session) {
  const client = await socket(session);
  await wait(() => {
    if (client.error) throw client.error;
    if (client.closed) throw Error('Authentication closed: ' + JSON.stringify(client.closed));
    return !!client.view;
  }, 'authenticated guest projection');
  return client;
}
async function rejectedSocket(session) {
  const client = await socket(session);
  await wait(() => client.closed, 'invalid credential rejection');
  assert.equal(client.closed.code, 1008);
  assert.equal(client.view, null, 'invalid token must never receive a projection');
  return client;
}
async function command(client, value, id = crypto.randomUUID()) {
  const offset = client.messages.length;
  client.ws.send(JSON.stringify({type: 'command', id, command: value}));
  await wait(() => {
    if (client.error) throw client.error;
    return client.messages.slice(offset).some(message => message.id === id && ['ack', 'history'].includes(message.type));
  }, 'command ' + value.type);
  return client.messages.slice(offset).find(message => message.id === id && ['ack', 'history'].includes(message.type));
}
async function sync(client) {
  const seq = client.seq;
  client.ws.send(JSON.stringify({type: 'sync'}));
  await wait(() => client.seq > seq, 'full projection');
}
async function disconnected(client) {
  client.ws.close();
  await wait(() => client.closed, 'closed client');
}
const contains = (value, sentinel) => {
  if (typeof value === 'string') return value === sentinel;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(child => contains(child, sentinel));
};
function privateKeysAbsent(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!['privateDeck', 'privateHands', 'omniscient', 'deck', 'accepted'].includes(key), 'private field on guest channel: ' + key);
    privateKeysAbsent(child);
  }
}
function privacy(client, saved, messages = [client.view]) {
  for (const message of messages) privateKeysAbsent(message);
  const me = saved.table.seats.find(seat => seat.playerId === client.session.memberId);
  for (const seat of saved.game.seats) {
    if (seat.id === me?.seatId) continue;
    for (const cardId of seat.hand) for (const message of messages) {
      assert.ok(!contains(message, cardId), 'opponent hand ID was sent to guest');
    }
  }
  for (const cardId of saved.game.deck) for (const message of messages) {
    assert.ok(!contains(message, cardId), 'unseen deck ID was sent to guest');
  }
  for (const seat of client.view.game.seats) assert.equal(seat.hand, undefined);
  assert.equal(client.view.canEdit, false);
  assert.equal(client.view.role, 'PLAYER');
}

try {
  await start();
  const empty = counts();
  failCommit = true;
  const failedCreate = await post('/guest/rooms', {name: 'Rollback creator'});
  assert.equal(failedCreate.status, 400); assert.deepEqual(failedCreate.data, {error: 'requestFailed'});
  assert.deepEqual(counts(), empty, 'failed HTTP room creation must commit no identity or room');
  pass('HTTP room creation rolls back every row and returns no room/session after a failed commit');

  for (const name of ['', '   ', 'zero\u200bwidth', 'control\nname', 'a'.repeat(61), 123]) {
    const reply = await post('/guest/rooms', {name});
    assert.equal(reply.status, 400); assert.deepEqual(reply.data, {error: 'invalidName'});
  }
  assert.deepEqual(counts(), empty);
  const created = await post('/guest/rooms', {name: '  Ｏｗｎｅｒ  ', role: 'GM', externalId: 'forged'});
  assert.equal(created.status, 201);
  const {room, session: owner} = created.data;
  assert.equal(created.data.name, 'Owner'); assert.equal(created.data.reconnected, false);
  assert.equal(room.version, 1); assert.match(room.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  assert.equal(room.joinKey, undefined); assert.equal(owner.role, 'PLAYER'); assert.equal(owner.owner, true);
  const host = await connect(owner);
  assert.equal(host.view.table.seats.length, 1); assert.equal(host.view.canEdit, false); assert.equal(host.view.canKick, true);
  pass('account-free room creation normalizes valid names, rejects invisible/control names and auto-seats a PLAYER owner');

  const raced = await Promise.all([' Ａｌｉｃｅ ', 'Alice', 'alice', 'ALICE'].map(name => post(guestPath(room), {name})));
  const winners = raced.filter(reply => reply.status === 201), losers = raced.filter(reply => reply.status === 409);
  assert.equal(winners.length, 1); assert.equal(losers.length, 3);
  for (const reply of losers) assert.deepEqual(reply.data, {error: 'nameTaken'});
  let aliceSession = winners[0].data.session;
  const aliceName = winners[0].data.name;
  assert.equal(service.db.prepare('SELECT count(*) n FROM guest_members WHERE room=? AND name_key=?').get(room.id, 'alice').n, 1);
  assert.equal(state(room).table.seats.length, 2);
  const lease = service.db.prepare('SELECT claimed_until FROM guest_members WHERE member=?').get(aliceSession.memberId).claimed_until;
  assert.ok(lease > Date.now() + 28000 && lease <= Date.now() + 30000, 'default unconnected issuance lease is 30 seconds');
  const leasedRecovery = await post(guestPath(room), {name: 'alice', reconnect: true});
  assert.equal(leasedRecovery.status, 409); assert.deepEqual(leasedRecovery.data, {error: 'nameTaken'});
  const missing = await post(guestPath(room), {name: 'Nobody', reconnect: true});
  assert.equal(missing.status, 404); assert.deepEqual(missing.data, {error: 'memberMissing'});
  let alice = await connect(aliceSession);
  for (const data of [{name: 'ALICE'}, {name: 'alice', reconnect: true}]) {
    const reply = await post(guestPath(room), data); assert.equal(reply.status, 409); assert.equal(reply.data.error, 'nameTaken');
  }
  pass('concurrent Unicode/case/space equivalent names have one winner; online names and the default 30-second issuance lease cannot be reclaimed');

  const beforeJoin = state(room), beforeJoinCounts = counts();
  failCommit = true;
  const failedJoin = await post(guestPath(room), {name: 'Join rollback'});
  assert.equal(failedJoin.status, 400); assert.deepEqual(failedJoin.data, {error: 'requestFailed'});
  assert.deepEqual(state(room), beforeJoin); assert.deepEqual(counts(), beforeJoinCounts);
  assert.equal(service.db.prepare('SELECT count(*) n FROM guest_members WHERE room=? AND name_key=?').get(room.id, 'join rollback').n, 0);
  const credentialBefore = service.db.prepare('SELECT * FROM credentials WHERE member=?').all(aliceSession.memberId);
  const memberBefore = service.db.prepare('SELECT * FROM members WHERE id=?').get(aliceSession.memberId);
  failCommit = true;
  const failedRotation = await post(guestPath(room), {name: 'alice', reconnectToken: aliceSession.token});
  assert.equal(failedRotation.status, 400); assert.deepEqual(failedRotation.data, {error: 'requestFailed'});
  assert.deepEqual(service.db.prepare('SELECT * FROM credentials WHERE member=?').all(aliceSession.memberId), credentialBefore);
  assert.deepEqual(service.db.prepare('SELECT * FROM members WHERE id=?').get(aliceSession.memberId), memberBefore);
  await sync(alice); assert.equal(alice.closed, null); assert.deepEqual(state(room), beforeJoin);
  pass('HTTP join and credential-rotation failures roll back seats/tokens and leave the existing socket authorized');

  const others = [];
  for (let index = 2; index < 6; index++) {
    const joined = await post(guestPath(room), {name: 'Player ' + index, role: 'GM', externalId: 'spoof-' + index});
    assert.equal(joined.status, 201); assert.equal(joined.data.session.role, 'PLAYER');
    others.push(await connect(joined.data.session));
  }
  await wait(() => host.view.table.seats.length === 6, 'six auto-seated guests');
  const full = await post(guestPath(room), {name: 'Seventh'});
  assert.equal(full.status, 409); assert.deepEqual(full.data, {error: 'tableFull'});
  assert.equal((await command(alice, {type: 'start', options})).code, 'notHost');
  assert.equal((await command(alice, {type: 'kick', playerId: others[3].session.memberId})).code, 'notAllowed');
  assert.equal((await command(host, {type: 'kick', playerId: owner.memberId})).code, 'notAllowed');
  assert.equal((await command(host, {type: 'kick', playerId: others[3].session.memberId})).ok, true);
  await wait(() => host.view.table.seats.length === 5, 'owner kick');
  const observer = others[3];
  const playing = [host, alice, ...others.slice(0, 3)];
  pass('six-seat limit is transactional; only the owner can start/kick and an owner cannot kick themselves');

  const beforeStart = state(room), beforeStartCounts = counts();
  failCommit = true;
  const failedStart = await command(host, {type: 'start', options}, 'failed-start-envelope');
  assert.equal(failedStart.ok, false); assert.equal(failedStart.code, 'storageFailed');
  assert.deepEqual(state(room), beforeStart); assert.deepEqual(counts(), beforeStartCounts); assert.equal(host.view.game, null);
  assert.equal((await command(host, {type: 'start', options}, 'failed-start-envelope')).ok, true);
  await wait(() => playing.every(client => client.view.game?.hand?.length) && observer.view.game, 'committed deal');
  const dealt = state(room);
  assert.equal(observer.view.game.hand, undefined); assert.equal(observer.view.game.selfSeatId, undefined);
  for (const client of [...playing, observer]) privacy(client, dealt, client.messages);
  for (const type of ['inspect', 'omniscient']) assert.equal((await command(alice, {type, enabled: true})).code, 'notAllowed');
  assert.equal((await command(host, {type: 'edit', gameId: dealt.game.id, edit: {type: 'gold', value: 999}})).code, 'notAllowed');
  for (const type of ['inspect', 'omniscient']) {
    assert.equal((await command(host, {type, enabled: true})).ok, true);
    assert.equal(host.view.game.omniscient, true); assert.equal(host.view.canEdit, true);
    assert.deepEqual(host.view.game.privateHands, Object.fromEntries(dealt.game.seats.map(seat => [seat.id, seat.hand])));
    privacy(alice, dealt);
    assert.equal((await command(host, {type, enabled: false})).ok, true);
    privacy(host, dealt);
  }
  const newcomer = await post(guestPath(room), {name: 'Late player'});
  assert.equal(newcomer.status, 409); assert.equal(newcomer.data.error, 'gameStarted');
  const kickedRecovery = await post(guestPath(room), {name: 'Player 5', reconnectToken: observer.session.token});
  assert.equal(kickedRecovery.status, 409); assert.equal(kickedRecovery.data.error, 'gameStarted');
  pass('failed start sends no deal; ordinary guest projections conceal other hands/deck; only the current owner can explicitly inspect and closing revokes editing');

  const firstAction = {id: 'guest-rollback-action', revision: dealt.game.revision, seatId: host.view.game.selfSeatId, kind: 'ante', cardId: host.view.game.hand[0]};
  const firstCommand = {type: 'action', gameId: dealt.game.id, action: firstAction};
  const actionCounts = counts(), actionOffset = host.messages.length;
  assert.equal((await command(alice, firstCommand)).code, 'notAllowed');
  failCommit = true;
  const failedAction = await command(host, firstCommand, 'guest-rollback-envelope');
  assert.equal(failedAction.ok, false); assert.equal(failedAction.code, 'storageFailed');
  assert.equal(failedAction.actionReceipt.ok, false); assert.equal(failedAction.actionReceipt.retryable, true);
  assert.deepEqual(state(room), dealt); assert.deepEqual(counts(), actionCounts);
  assert.ok(!host.messages.slice(actionOffset).some(message => message.actionReceipt?.ok || message.view?.actionReceipt?.ok));
  const accepted = await command(host, firstCommand, 'guest-rollback-envelope');
  assert.equal(accepted.ok, true); assert.equal(accepted.actionReceipt.revision, 1);
  const committed = state(room), committedCounts = counts();
  assert.deepEqual((await command(host, firstCommand, 'guest-rollback-envelope')).actionReceipt, accepted.actionReceipt);
  assert.deepEqual((await command(host, firstCommand, 'guest-another-envelope')).actionReceipt, accepted.actionReceipt);
  assert.deepEqual(state(room), committed); assert.deepEqual(counts(), committedCounts);
  const changed = {...firstCommand, action: {...firstAction, cardId: host.view.game.hand[0]}};
  assert.equal((await command(host, changed, 'guest-changed-envelope')).code, 'invalidCommand');
  assert.deepEqual(state(room), committed);
  await wait(() => [...playing, observer].every(client => client.view.game.revision === 1), 'committed projections');
  for (const client of [...playing, observer].filter(client => client !== host)) {
    assert.ok(!contains(client.messages, firstAction.cardId), 'concealed ante must stay private until reveal');
    const history = await command(client, {type: 'history', before: 100000});
    assert.ok(!contains(history.page, firstAction.cardId), 'history cannot reveal a concealed ante');
    privateKeysAbsent(history.page);
  }
  pass('seat forgery is rejected; failed action commits no state/history/receipt, exact retry commits once, and concealed ante stays private in streams/history');

  const badNameToken = await post(guestPath(room), {name: 'Player 2', reconnectToken: aliceSession.token});
  assert.equal(badNameToken.status, 403); assert.equal(badNameToken.data.error, 'notAllowed');
  const oldAliceSession = aliceSession, savedBeforeReconnect = state(room), reconnectCounts = counts();
  const rotated = await post('/guest/rooms/' + room.code.toLowerCase() + '/sessions', {name: 'ＡＬＩＣＥ', reconnectToken: aliceSession.token});
  assert.equal(rotated.status, 200); assert.equal(rotated.data.reconnected, true); assert.equal(rotated.data.name, aliceName);
  aliceSession = rotated.data.session;
  assert.equal(aliceSession.memberId, oldAliceSession.memberId); assert.notEqual(aliceSession.token, oldAliceSession.token);
  await wait(() => alice.closed, 'replaced guest socket'); assert.equal(alice.closed.code, 4001); assert.equal(alice.closed.reason, 'sessionReplaced');
  await rejectedSocket(oldAliceSession);
  const staleToken = await post(guestPath(room), {name: 'alice', reconnectToken: oldAliceSession.token});
  assert.equal(staleToken.status, 403); assert.equal(staleToken.data.error, 'notAllowed');
  alice = await connect(aliceSession);
  assert.deepEqual(alice.view.game.hand, savedBeforeReconnect.game.seats.find(seat => seat.id === aliceSession.memberId).hand);
  assert.deepEqual(state(room), savedBeforeReconnect); assert.deepEqual(counts(), reconnectCounts);
  assert.equal(service.db.prepare('SELECT count(*) n FROM credentials WHERE member=?').get(aliceSession.memberId).n, 1);
  pass('valid reconnect token rotates credentials/replaces the old socket; old or mismatched tokens cannot authenticate and reconnect never redeals');

  await disconnected(alice);
  const ordinaryOffline = await post(guestPath(room), {name: 'alice'});
  assert.equal(ordinaryOffline.status, 409); assert.equal(ordinaryOffline.data.error, 'nameTaken');
  const offlineRestore = await post(guestPath(room), {name: ' Alice ', reconnect: true});
  assert.equal(offlineRestore.status, 200); assert.equal(offlineRestore.data.reconnected, true);
  assert.equal(offlineRestore.data.session.memberId, aliceSession.memberId);
  await rejectedSocket(aliceSession);
  aliceSession = offlineRestore.data.session; alice = await connect(aliceSession);
  assert.deepEqual(state(room), savedBeforeReconnect);
  assert.deepEqual(alice.view.game.hand, savedBeforeReconnect.game.seats.find(seat => seat.id === aliceSession.memberId).hand);
  pass('ordinary offline-name join stays rejected; explicit offline recovery restores the same seat/hand and invalidates previous credentials');

  const obrCreated = await post('/rooms', {name: 'Owlbear host', externalId: 'synthetic-obr-host'});
  assert.equal(obrCreated.status, 201); assert.match(obrCreated.data.room.joinKey, /^[a-f0-9]{64}$/);
  const obrRoom = obrCreated.data.room, obrOwner = obrCreated.data.session;
  const obrHost = await connect(obrOwner); assert.equal(obrHost.view.canEdit, true);
  const obrJoined = await post('/rooms/' + obrRoom.id + '/sessions', {joinKey: obrRoom.joinKey, name: 'Owlbear player', externalId: 'synthetic-obr-player', role: 'GM'});
  assert.equal(obrJoined.status, 201); const obrPlayer = await connect(obrJoined.data);
  assert.equal(obrPlayer.view.role, 'PLAYER'); assert.equal(obrPlayer.view.message, 'admissionPending');
  assert.equal((await command(obrPlayer, {type: 'join'})).code, 'privateSync');
  const grant = await post('/rooms/' + obrRoom.id + '/grants', {memberId: obrJoined.data.memberId, challenge: obrJoined.data.challenge, externalId: 'synthetic-obr-player', role: 'PLAYER'}, obrOwner.token);
  assert.equal(grant.status, 200); assert.equal((await command(obrPlayer, {type: 'join'})).ok, true);
  assert.equal((await command(obrPlayer, {type: 'leave'})).ok, true, 'old clients may omit gameId');
  assert.equal((await command(obrPlayer, {type: 'join'})).ok, true);
  assert.equal((await command(obrHost, {type: 'start', options})).ok, true);
  assert.equal((await command(obrHost, {type: 'omniscient', enabled: true})).ok, true);
  assert.ok(obrHost.view.game.privateHands); assert.ok(obrHost.view.game.privateDeck);
  assert.equal((await command(obrPlayer, {type: 'omniscient', enabled: true})).code, 'notAllowed');
  for (const operation of ['sessions', 'grants']) {
    const reply = await post('/rooms/' + room.id + '/' + operation, {joinKey: 'forged', memberId: owner.memberId, role: 'GM'}, owner.token);
    assert.equal(reply.status, 403); assert.equal(reply.data.error, 'notAllowed');
  }
  await rejectedSocket({...obrOwner, roomId: room.id});
  assert.deepEqual(state(room), savedBeforeReconnect);
  pass('Owlbear admission/grants/authorized inspection and old leave envelopes coexist; guest rooms reject Owlbear grants and cross-room tokens');

  const restartState = state(room), restartCounts = counts();
  for (const client of clients) client.ws.terminate();
  await service.close(); service = null;
  await start();
  const restoredHost = await connect(owner), restoredAlice = await connect(aliceSession);
  const restoredOthers = [];
  for (const client of others) restoredOthers.push(await connect(client.session));
  const restoredPlayers = [restoredHost, restoredAlice, ...restoredOthers];
  assert.deepEqual(state(room), restartState); assert.deepEqual(counts(), restartCounts);
  assert.equal(service.db.prepare('SELECT code FROM guest_rooms WHERE room=?').get(room.id).code, room.code);
  for (const client of restoredPlayers) {
    const seat = restartState.game.seats.find(seat => seat.id === client.session.memberId);
    assert.deepEqual(client.view.game.hand, seat?.hand);
    privacy(client, restartState, client.messages);
  }
  assert.deepEqual((await command(restoredHost, firstCommand, 'post-restart-retry')).actionReceipt, accepted.actionReceipt);
  assert.deepEqual(state(room), restartState); assert.deepEqual(counts(), restartCounts);
  pass('real service restart preserves room code, guest credentials, seats, exact hands and durable action deduplication');

  restoredHost.ws.terminate();
  await wait(() => restoredAlice.view.isHost, 'automatic offline owner handover');
  const transferred = state(room);
  assert.equal(transferred.table.hostPlayerId, aliceSession.memberId);
  assert.deepEqual(transferred.game, restartState.game); assert.deepEqual(transferred.table.seats, restartState.table.seats);
  assert.equal(transferred.table.revision, restartState.table.revision + 1);
  assert.deepEqual(counts(), restartCounts);
  assert.equal(restoredAlice.view.canEdit, false); assert.equal(restoredAlice.view.canKick, true);
  const returningOwner = await connect(owner); assert.equal(returningOwner.view.isHost, false);
  assert.deepEqual(returningOwner.view.game.hand, restartState.game.seats.find(seat => seat.id === owner.memberId).hand);
  const beforeHandover = state(room);
  assert.equal((await command(restoredAlice, {type: 'handover'})).ok, true);
  await wait(() => [...restoredOthers, returningOwner].some(client => client.view.isHost), 'explicit owner handover');
  assert.deepEqual(state(room).game, beforeHandover.game); assert.deepEqual(state(room).table.seats, beforeHandover.table.seats);
  const currentOwner = [...restoredOthers, returningOwner].find(client => client.view.isHost);
  pass('offline owner automatically transfers after grace without changing cards/seats; returning former owner and explicit handover preserve the game');

  const oldGameId = state(room).game.id;
  assert.equal((await command(currentOwner, {type: 'newGame'})).ok, true);
  const lobby = state(room), staleCounts = counts();
  const delayedLobbyLeave = await command(currentOwner, {type: 'leave', gameId: oldGameId}, 'delayed-lobby-leave');
  assert.equal(delayedLobbyLeave.ok, false); assert.equal(delayedLobbyLeave.code, 'staleTable');
  assert.deepEqual(state(room), lobby); assert.deepEqual(counts(), staleCounts);
  assert.equal((await command(currentOwner, {type: 'start', options})).ok, true);
  const fresh = state(room), freshCounts = counts(); assert.notEqual(fresh.game.id, oldGameId);
  for (const staleGameId of [oldGameId, null]) {
    const delayed = await command(currentOwner, {type: 'leave', gameId: staleGameId});
    assert.equal(delayed.ok, false); assert.equal(delayed.code, 'staleTable');
    assert.deepEqual(state(room), fresh); assert.deepEqual(counts(), freshCounts);
  }
  assert.equal((await command(restoredAlice, {type: 'leave', gameId: fresh.game.id})).code, 'cannotLeave');
  assert.equal((await command(currentOwner, {type: 'leave', gameId: fresh.game.id})).ok, true);
  const afterLeave = state(room);
  assert.notEqual(afterLeave.table.hostPlayerId, fresh.table.hostPlayerId);
  assert.deepEqual(afterLeave.game, fresh.game); assert.deepEqual(afterLeave.table.seats, fresh.table.seats);
  pass('delayed leave for a previous game or lobby is rejected without changing the new table; matching-game owner leave transfers safely');

  for (const client of clients) client.ws.terminate();
  await service.close(); service = null;
  // Independent fixtures use fresh ports so fetch cannot reuse a connection
  // from a stopped service. The restart test above deliberately keeps its port.
  port = undefined;
  await start({database: join(evidence, 'auth-claim.sqlite')});
  const claimCreated = await post('/guest/rooms', {name: 'Retry after storage failure'});
  assert.equal(claimCreated.status, 201);
  const claimRoom = claimCreated.data.room, claimSession = claimCreated.data.session;
  const beforeClaim = state(claimRoom), beforeClaimCounts = counts();
  const beforeClaimCredential = service.db.prepare('SELECT * FROM credentials WHERE member=?').all(claimSession.memberId);
  const beforeClaimLease = service.db.prepare('SELECT claimed_until FROM guest_members WHERE member=?').get(claimSession.memberId).claimed_until;
  assert.deepEqual(service.stats(), {rooms: 0, sockets: 0});
  failCommit = true;
  const failedAuthentication = await socket(claimSession);
  await wait(() => failedAuthentication.closed, 'temporary guest authentication storage failure');
  assert.deepEqual(failedAuthentication.closed, {code: 1011, reason: 'temporarilyUnavailable'});
  assert.equal(failedAuthentication.view, null, 'failed authentication must send no projection');
  assert.deepEqual(service.stats(), {rooms: 0, sockets: 0}, 'failed authentication must not cache an active room');
  assert.deepEqual(state(claimRoom), beforeClaim); assert.deepEqual(counts(), beforeClaimCounts);
  assert.deepEqual(service.db.prepare('SELECT * FROM credentials WHERE member=?').all(claimSession.memberId), beforeClaimCredential);
  assert.equal(service.db.prepare('SELECT claimed_until FROM guest_members WHERE member=?').get(claimSession.memberId).claimed_until, beforeClaimLease);
  const claimRetry = await connect(claimSession);
  assert.equal(claimRetry.identity.memberId, claimSession.memberId);
  assert.deepEqual(service.stats(), {rooms: 1, sockets: 1});
  assert.deepEqual(state(claimRoom), beforeClaim); assert.deepEqual(counts(), beforeClaimCounts);
  pass('guest authentication commit failure closes with transient 1011, caches no room and preserves the original token for successful retry');

  claimRetry.ws.terminate();
  await service.close(); service = null;
  port = undefined;
  await start({database: join(evidence, 'auth-capacity.sqlite'), maxRooms: 1});
  // Website room issuance is now bounded too. A retained historical room can
  // occupy the live capacity while the one permitted guest room awaits auth.
  const capacityFirst = await post('/rooms', {name: 'Capacity first', externalId: 'historical-capacity'});
  const capacitySecond = await post('/guest/rooms', {name: 'Capacity second'});
  assert.equal(capacityFirst.status, 201); assert.equal(capacitySecond.status, 201);
  const firstCapacityClient = await connect(capacityFirst.data.session);
  const beforeCapacity = state(capacitySecond.data.room), beforeCapacityCounts = counts();
  const capacityLease = service.db.prepare('SELECT claimed_until FROM guest_members WHERE member=?').get(capacitySecond.data.session.memberId).claimed_until;
  assert.deepEqual(service.stats(), {rooms: 1, sockets: 1});
  const fullAuthentication = await socket(capacitySecond.data.session);
  await wait(() => fullAuthentication.closed, 'active room capacity authentication rejection');
  assert.deepEqual(fullAuthentication.closed, {code: 1013, reason: 'roomFull'});
  assert.equal(fullAuthentication.view, null);
  assert.deepEqual(service.stats(), {rooms: 1, sockets: 1}, 'rejected second room must not occupy active capacity');
  assert.deepEqual(state(capacitySecond.data.room), beforeCapacity); assert.deepEqual(counts(), beforeCapacityCounts);
  assert.equal(service.db.prepare('SELECT claimed_until FROM guest_members WHERE member=?').get(capacitySecond.data.session.memberId).claimed_until, capacityLease);
  await disconnected(firstCapacityClient);
  await wait(() => service.stats().rooms === 0 && service.stats().sockets === 0, 'first active room releases capacity');
  const capacityRetry = await connect(capacitySecond.data.session);
  assert.equal(capacityRetry.identity.memberId, capacitySecond.data.session.memberId);
  assert.deepEqual(service.stats(), {rooms: 1, sockets: 1});
  assert.deepEqual(state(capacitySecond.data.room), beforeCapacity); assert.deepEqual(counts(), beforeCapacityCounts);
  pass('maxRooms authentication rejection uses transient 1013; releasing the first room lets the second original token authenticate without rotation');
} catch (error) {
  failure = error;
} finally {
  const stats = {checks: checks.length, scope: 'Real loopback HTTP/WebSocket and synthetic SQLite. No production database, WAN, real Owlbear accounts, or device UAT.', hostGraceMs: 180, guestIssuanceLeaseMs: 30000, completed: !failure};
  writeFileSync(join(evidence, 'result.json'), JSON.stringify({checks, stats, ...(failure ? {failure: {message: failure.message, stack: failure.stack}} : {})}, null, 2));
  for (const client of clients) client.ws.terminate();
  await service?.close();
  console.log(JSON.stringify(stats));
  console.log(evidence);
}
if (failure) throw failure;
