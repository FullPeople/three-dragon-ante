// Real loopback HTTP/WS authority and disposable synthetic SQLite only.
// Run after npm run build:server; never accepts a database or remote endpoint.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';

const root = resolve(import.meta.dirname, '..');
const serviceFile = resolve(root, process.env.TDA_SERVER_OUT || 'dist-server', 'service.mjs');
const evidenceRoot = join(root, '.local-evidence', 'website-deck-order');
mkdirSync(evidenceRoot, { recursive: true });
const evidence = mkdtempSync(join(evidenceRoot, 'run-'));
const fixtureDirectory = mkdtempSync(join(tmpdir(), 'tda-deck-order-'));
const database = join(fixtureDirectory, 'synthetic.sqlite');
const origin = 'http://deck-order-selftest.local';
const WebSocket = createRequire(join(root, 'server/three-dragon/package.json'))('ws');
const checks = [], clients = [], generatedPhases = [], testedZones = new Set();
let service, rules, address, port, admission, peerAdmission, watcherAdmission, host, peer, watcher;
let failure, step = 'load-current-authority', failCommit = false, restarts = 0, topDrawVerified = false;
const delay = ms => new Promise(done => setTimeout(done, ms));
const pass = label => { checks.push(label); console.log('PASS ' + label); };
const equal = (actual, expected, label) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), label);
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const safeErrorName = error => ['Error', 'AssertionError', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError'].includes(error?.constructor?.name) ? error.constructor.name : 'OtherError';
async function wait(check, label, timeout = 7000) {
  const end = Date.now() + timeout;
  while (!check()) { assert.ok(Date.now() < end, label); await delay(5); }
}
function patch(old, change) {
  const next = { ...old, ...change.set };
  for (const key of change.remove) delete next[key];
  return next;
}
async function start() {
  service = createTableService({ database, origin, injectFailure() { if (failCommit) { failCommit = false; throw Error('storageFailed'); } } });
  await new Promise((done, reject) => { service.server.once('error', reject); service.server.listen(port || 0, '127.0.0.1', done); });
  port = service.server.address().port;
  address = 'http://127.0.0.1:' + port + '/three-dragon-api/v1';
}
async function stop() {
  if (!service) return;
  for (const client of clients) client.ws.terminate();
  await service.close(); service = null;
}
async function post(path, body) {
  const response = await fetch(address + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.ok(response.ok, 'synthetic HTTP admission succeeds');
  return response.json();
}
async function connect(session, isWatcher = false) {
  const ws = new WebSocket(address.replace('http:', 'ws:') + '/socket', { origin });
  const client = { ws, session, isWatcher, view: null, identity: null, seq: 0, messages: [], error: null, closed: false };
  clients.push(client);
  ws.on('error', () => { client.error = Error('Synthetic socket failed'); });
  ws.on('close', () => { client.closed = true; });
  ws.on('message', bytes => {
    try {
      const message = JSON.parse(String(bytes)); client.messages.push(message);
      if (message.type === 'view') { client.view = message.view; client.identity = message.identity; client.seq = message.seq; }
      else if (message.type === 'patch') {
        assert.equal(message.base, client.seq, 'patch follows its authentic predecessor');
        client.view = { ...patch(client.view, message.patch), game: message.gamePatch ? patch(client.view.game, message.gamePatch) : message.game };
        client.seq = message.seq;
      }
    } catch { client.error = Error('Synthetic wire validation failed'); }
  });
  await new Promise((done, reject) => { ws.once('open', done); ws.once('error', reject); });
  ws.send(JSON.stringify({ type: 'auth', room: session.roomId, token: session.token }));
  await wait(() => { if (client.error) throw client.error; assert.equal(client.closed, false, 'synthetic admission remains connected'); return client.view; }, 'authenticated projection');
  return client;
}
async function reconnect() {
  host = await connect(admission.session); peer = await connect(peerAdmission.session); watcher = await connect(watcherAdmission.session, true);
}
async function command(client, value, id = randomUUID()) {
  const offset = client.messages.length;
  client.ws.send(JSON.stringify({ type: 'command', id, command: value }));
  await wait(() => { if (client.error) throw client.error; return client.messages.slice(offset).some(message => message.type === 'ack' && message.id === id); }, 'real command receipt');
  return client.messages.slice(offset).find(message => message.type === 'ack' && message.id === id);
}
async function sync(client) {
  const prior = client.seq; client.ws.send(JSON.stringify({ type: 'sync' }));
  await wait(() => client.seq > prior, 'fresh full projection');
}
const state = () => JSON.parse(service.db.prepare('SELECT state FROM rooms WHERE id=?').get(admission.room.id).state);
const counts = () => Object.fromEntries(['rooms', 'members', 'credentials', 'guest_rooms', 'guest_members', 'history', 'receipts'].map(table => [table, service.db.prepare('SELECT count(*) n FROM ' + table).get().n]));
const edit = (game, cardIds, revision = game.revision) => ({ type: 'edit', gameId: game.id, edit: { kind: 'deckOrder', cardIds, revision } });
const reverse = game => [...game.deck].reverse();
const trim = game => ({ ...game, history: (game.history || []).slice(-24), historyComplete: false, accepted: {} });
function conserved(game) {
  assert.equal(rules.checkInvariants(game).length, 0, 'actual engine invariants remain satisfied');
  const pending = game.pending && ['seer-keep', 'sorcerer'].includes(game.pending.task.kind) ? game.pending.task.ids || [] : [];
  const reserved = game.queue.filter(task => task.kind === 'sorcerer-ante').flatMap(task => task.ids || []);
  const ids = [...game.deck, ...game.discard, ...game.ante, ...Object.values(game.committed), ...game.seats.flatMap(seat => [...seat.hand, ...seat.flight.map(value => value.cardId)]), ...pending, ...reserved, ...game.excluded];
  equal([...ids].sort(), rules.variantCards(game.variant).map(card => card.id).sort(), 'full variant card pool is conserved exactly');
  assert.equal(game.seats.reduce((sum, seat) => sum + seat.gold, game.stakes + game.hole), game.initialGold, 'currency is conserved');
}
function onlyDeckChanged(before, after, order) {
  equal(after, { ...before, deck: order, revision: before.revision + 1 }, 'only the exact deck permutation and game revision change');
  conserved(after);
}
const forbidden = new Set(['deck', 'privateDeck', 'privateExcluded', 'privateHands', 'privateCommittedAntes', 'privateHandPowerHints', 'omniscient', 'accepted']);
function privateKeysAbsent(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) { assert.equal(forbidden.has(key), false, 'ordinary channel contains no inspection fields'); privateKeysAbsent(child); }
}
function strings(value, output = new Set()) {
  if (typeof value === 'string') output.add(value);
  else if (value && typeof value === 'object') for (const child of Object.values(value)) strings(child, output);
  return output;
}
function privacy(client, saved, packets = [client.view]) {
  for (const packet of packets) privateKeysAbsent(packet);
  assert.equal(client.view.canEdit, false, 'ordinary projection has no edit permission');
  for (const seat of client.view.game.seats) assert.equal(seat.hand, undefined, 'public seat rows contain no hands');
  const own = saved.table.seats.find(seat => seat.playerId === client.session.memberId)?.seatId;
  const publicIds = strings(rules.projectPublic(saved.game));
  const hidden = [...saved.game.deck, ...saved.game.seats.filter(seat => client.isWatcher || seat.id !== own).flatMap(seat => seat.hand), ...Object.entries(saved.game.committed).filter(([seatId]) => client.isWatcher || seatId !== own).map(([, cardId]) => cardId)].filter(id => !publicIds.has(id));
  for (const packet of packets) { const delivered = strings(packet); for (const id of hidden) assert.equal(delivered.has(id), false, 'unseen deck and private hand identities are absent'); }
  if (client.isWatcher) {
    assert.equal(client.identity.spectating, true, 'real observer capability is retained');
    for (const key of ['hand', 'actions', 'selfSeatId', 'committedAnte', 'handPowerHints']) assert.equal(client.view.game[key], undefined, 'observer receives PublicView only');
  } else {
    equal(client.view.game.hand, saved.game.seats.find(seat => seat.id === own).hand, 'ordinary seat receives only its actual own hand');
  }
}
async function verifyOrdinaryStreams() {
  const saved = state();
  for (const client of [peer, watcher]) { await sync(client); privacy(client, saved, client.messages); }
}
async function inspect() {
  const before = state(); assert.equal((await command(host, { type: 'inspect', enabled: true })).ok, true);
  equal(state(), before, 'inspection itself never mutates the authority');
  assert.equal(host.view.canEdit, true); assert.equal(host.view.game.omniscient, true);
  equal(host.view.game.privateDeck, before.game.deck, 'inspection presents the authoritative next-draw-first order');
}
async function denied(client, value, code = 'invalidEdit') {
  const before = state(), beforeCounts = counts(); const receipt = await command(client, value);
  assert.equal(receipt.ok, false, 'invalid edit is refused'); assert.equal(receipt.code, code);
  equal(state(), before, 'rejected edit changes no saved table or zone'); equal(counts(), beforeCounts, 'rejected edit creates no durable receipt or history');
}
async function orderAccepted(order, id = randomUUID()) {
  const before = state(), request = edit(before.game, order); const response = await command(host, request, id);
  assert.equal(response.ok, true, 'authorized full deck permutation commits');
  const after = state(); onlyDeckChanged(before.game, after.game, order);
  assert.equal(after.table.revision, before.table.revision + 1, 'accepted edit has one table revision');
  equal(host.view.game.privateDeck, order, 'private projection follows the committed order');
  return { before, after, request, response, id };
}
async function malformedAndZones() {
  const game = state().game, order = reverse(game);
  for (const cardIds of [order.slice(1), [...order, order[0]], [order[0], ...order.slice(0, -1)], ['unknown-synthetic-card', ...order.slice(1)], [null, ...order.slice(1)], null]) await denied(host, edit(game, cardIds));
  for (const revision of [game.revision - 1, game.revision + 1, 1.5, null, String(game.revision)]) await denied(host, edit(game, order, revision));
  await denied(host, { type: 'edit', gameId: game.id, edit: { kind: 'deckOrder', cardIds: order } });
  const candidates = {
    hand: game.seats.flatMap(seat => seat.hand)[0], excluded: game.excluded[0], committed: Object.values(game.committed)[0], ante: game.ante[0],
    flight: game.seats.flatMap(seat => seat.flight.map(card => card.cardId))[0], discard: game.discard[0],
    pending: game.pending && ['seer-keep', 'sorcerer'].includes(game.pending.task.kind) ? game.pending.task.ids?.[0] : undefined,
    reserved: game.queue.find(task => task.kind === 'sorcerer-ante')?.ids?.[0], revealed: game.revealed[0],
  };
  for (const [zone, id] of Object.entries(candidates)) if (id) { assert.equal(game.deck.includes(id), false, 'cross-zone candidate is genuinely outside the deck'); await denied(host, edit(game, [id, ...order.slice(1)])); testedZones.add(zone); }
}
function apply(game, value) {
  const result = rules.applyAction(game, { id: randomUUID(), revision: game.revision, ...value });
  assert.equal(result.ok, true, 'fixture advances through actual legal engine actions'); conserved(result.state); return result.state;
}
function initial(seed, saved) {
  return rules.createGame({ id: saved.game.id, seed, startingGold: 200, seats: saved.table.seats.map(seat => ({ id: seat.seatId, name: seat.name })), variant: selectedVariant });
}
function powerPosition(saved, family, continuation) {
  for (let seed = 1; seed <= 2048; seed++) {
    const created = initial(seed, saved);
    for (let actor = 0; actor < 2; actor++) {
      const target = created.seats[actor].hand.find(id => rules.card(id).family === family); if (!target) continue;
      const other = 1 - actor;
      const ownAnte = created.seats[actor].hand.find(id => id !== target && created.seats[other].hand.some(opponent => rules.card(id).strength > rules.card(opponent).strength));
      const theirAnte = ownAnte && created.seats[other].hand.find(id => rules.card(id).strength < rules.card(ownAnte).strength); if (!theirAnte) continue;
      let next = apply(created, { seatId: created.seats[actor].id, kind: 'ante', cardId: ownAnte });
      next = apply(next, { seatId: created.seats[other].id, kind: 'ante', cardId: theirAnte });
      if (next.stage !== 'play' || next.active !== actor || !rules.handPowerHint(next, next.seats[actor].id, target).ruleTriggers) continue;
      const found = continuation(next, { seatId: next.seats[actor].id, kind: 'play', cardId: target });
      if (found) return found;
    }
  }
  throw Error('Actual engine fixture could not be generated');
}
async function fixture(label, make) {
  const saved = state(), generated = make(saved); conserved(generated.game);
  const next = { table: { ...saved.table, revision: saved.table.revision + 1, stage: 'playing', variant: generated.game.variant }, game: trim(generated.game) };
  await stop();
  // Only this process-created, disposable synthetic database is modified.
  const db = new DatabaseSync(database);
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare('UPDATE rooms SET state=?,updated=? WHERE id=?').run(JSON.stringify(next), Date.now(), admission.room.id);
    db.prepare('DELETE FROM receipts WHERE room=?').run(admission.room.id); db.prepare('DELETE FROM history WHERE room=?').run(admission.room.id);
    for (const entry of next.game.history) db.prepare('INSERT INTO history VALUES(?,?,?,?)').run(admission.room.id, next.game.id, entry.sequence, JSON.stringify(entry));
    db.exec('COMMIT');
  } finally { db.close(); }
  await start(); restarts++; await reconnect(); generatedPhases.push(label);
  equal(state(), next, 'real authority reloads the engine-generated synthetic fixture');
  for (const client of [host, peer, watcher]) privacy(client, next);
  return generated;
}

const selectedVariant = { ruleSetId: 'provided-pack-20260910', deckId: 'selected-specials-v1', specialIds: ['bahamut', 'black-raider', 'blue-overlord', 'brass-sultan', 'bronze-warlord', 'chromatic-wyrmling', 'copper-trickster', 'dracolich', 'druid', 'sorcerer'] };
let createTableService;
try {
  ({ createTableService } = await import(pathToFileURL(serviceFile)));
  step = 'compile-real-rule-fixture-generator';
  await build({ input: join(root, 'extensions/three-dragon-ante/src/game/rules/index.ts'), platform: 'node', external: [/^node:/], output: { file: join(evidence, 'rules.mjs'), format: 'esm', codeSplitting: false }, logLevel: 'warn' });
  rules = await import(pathToFileURL(join(evidence, 'rules.mjs')));
  step = 'real-http-ws-start'; await start();
  admission = await post('/guest/rooms', { name: 'Synthetic owner' });
  peerAdmission = await post('/guest/rooms/' + admission.room.code + '/sessions', { name: 'Synthetic player' });
  watcherAdmission = await post('/guest/rooms/' + admission.room.code + '/sessions', { name: 'Synthetic observer', spectating: true });
  assert.equal(watcherAdmission.spectating, true); await reconnect();
  assert.equal((await command(host, { type: 'start', options: { startingGold: 200, variant: selectedVariant } })).ok, true);
  for (const client of [host, peer, watcher]) await sync(client);
  conserved(state().game);
  step = 'authorization-denials';
  const initialGame = state().game;
  await denied(host, edit(initialGame, reverse(initialGame)), 'notAllowed');
  for (const client of [peer, watcher]) { await denied(client, { type: 'inspect', enabled: true }, 'notAllowed'); await denied(client, edit(initialGame, reverse(initialGame)), 'notAllowed'); }
  for (const client of [host, peer, watcher]) privacy(client, state(), client.messages);
  pass('actual owner without inspection, ordinary player and persisted observer cannot reorder or inspect private cards');
  step = 'full-permutation-validation'; await inspect(); await malformedAndZones();
  pass('revision, complete-permutation, duplicate, missing, extra, unknown and current hand/excluded guards reject before mutation');
  step = 'accepted-order-and-durable-nonce';
  const committed = await orderAccepted(reverse(state().game), 'synthetic-deck-order-nonce'), committedCounts = counts();
  equal(await command(host, committed.request, committed.id), committed.response, 'same nonce returns the original durable receipt');
  equal(state(), committed.after, 'same nonce cannot apply or revise twice'); equal(counts(), committedCounts, 'same nonce creates no second receipt');
  const conflict = await command(host, { ...committed.request, edit: { ...committed.request.edit, cardIds: [...committed.request.edit.cardIds].reverse() } }, committed.id);
  assert.equal(conflict.ok, false); assert.equal(conflict.code, 'invalidCommand'); equal(state(), committed.after, 'conflicting nonce payload remains inert');
  await denied(host, edit(state().game, reverse(state().game), committed.before.game.revision));
  const noOpBefore = state(); assert.equal((await command(host, edit(noOpBefore.game, [...noOpBefore.game.deck]))).ok, true); equal(state().game, noOpBefore.game, 'unchanged deck order preserves the game revision and all zones');
  await verifyOrdinaryStreams();
  pass('authorized inspection commits the precise order once; nonce retries, conflicting reuse, stale writes and unchanged orders preserve revisions and zones');
  step = 'storage-rollback-retry';
  const rollbackBefore = state(), rollbackCounts = counts(), retryId = 'synthetic-deck-storage-retry', retryCommand = edit(rollbackBefore.game, reverse(rollbackBefore.game));
  failCommit = true; const failed = await command(host, retryCommand, retryId); assert.equal(failed.ok, false); assert.equal(failed.code, 'storageFailed');
  equal(state(), rollbackBefore, 'failed SQLite transaction preserves every zone'); equal(counts(), rollbackCounts, 'failed commit publishes no durable receipt');
  assert.equal((await command(host, retryCommand, retryId)).ok, true); onlyDeckChanged(rollbackBefore.game, state().game, retryCommand.edit.cardIds);
  pass('real failed SQLite commit rolls back the reorder and receipt; exact retry commits once');
  step = 'durable-service-restart';
  const persistent = state(), persistentCounts = counts(); await stop(); await start(); restarts++; await reconnect();
  equal(state(), persistent, 'actual service stop/restart preserves every saved zone and deck position'); equal(counts(), persistentCounts, 'restart preserves durable receipts');
  for (const client of [host, peer, watcher]) privacy(client, persistent, client.messages);
  assert.equal((await command(host, retryCommand, retryId)).ok, true); equal(state(), persistent, 'original accepted nonce remains idempotent after restart without reopening inspection');
  pass('actual SQLite restart retains order and receipt while owner inspection is revoked and observer remains public');
  for (const label of ['committed-ante', 'active-druid', 'pending-sorcerer', 'reserved-sorcerer']) {
    step = 'engine-generated-' + label;
    await fixture(label, saved => {
      if (label === 'committed-ante') { const game = initial(1, saved); return { game: apply(game, { seatId: game.seats[0].id, kind: 'ante', cardId: game.seats[0].hand[0] }) }; }
      if (label === 'active-druid') return powerPosition(saved, 'druid', (game, play) => { const next = apply(game, play); return next.effects.some(effect => effect.kind === 'druid') ? { game: next } : null; });
      return powerPosition(saved, 'sorcerer', (game, play) => {
        const pending = apply(game, play); if (pending.pending?.task.kind !== 'sorcerer') return null;
        if (label === 'pending-sorcerer') return { game: pending };
        for (const option of pending.pending.options) {
          const next = apply(pending, { seatId: pending.pending.seatId, kind: 'choose', choiceId: pending.pending.id, optionIds: [option.id] });
          if (next.pending && next.queue.some(task => task.kind === 'sorcerer-ante' && task.ids?.length)) return { game: next };
        }
        return null;
      });
    });
    await inspect(); await malformedAndZones(); await orderAccepted(reverse(state().game)); await verifyOrdinaryStreams();
    pass('real engine ' + label + ' keeps all non-deck zones, effects and pending continuations exact and refuses cross-zone IDs');
  }
  step = 'next-legal-draw-fixture';
  const drawFixture = await fixture('legal-gold-draw', saved => powerPosition(saved, 'gold', (game, play) => ({ game, play })));
  await inspect(); const arranged = await orderAccepted(reverse(state().game));
  const top = arranged.after.game.deck[0]; await stop(); await start(); restarts++; await reconnect();
  equal(state(), arranged.after, 'prepared draw order survives a second actual persistence restart');
  const action = { id: randomUUID(), revision: state().game.revision, ...drawFixture.play };
  const expected = rules.applyAction(state().game, action); assert.equal(expected.ok, true, 'the follow-up draw is a real legal rule action');
  const actor = [host, peer].find(client => client.session.memberId === action.seatId);
  const receipt = await command(actor, { type: 'action', gameId: state().game.id, action }); assert.equal(receipt.ok, true); assert.equal(receipt.actionReceipt.revision, action.revision + 1);
  const drawn = state().game; equal(drawn.deck, arranged.after.game.deck.slice(1), 'the next legal draw consumes exactly the reordered first card');
  const actorSeat = drawn.seats.find(seat => seat.id === action.seatId); assert.equal(actorSeat.hand.at(-1), top, 'actual drawn card is the persisted deck top');
  equal(drawn, trim(expected.state), 'authority resolves the real action exactly as the unchanged engine'); conserved(drawn);
  for (const client of [host, peer, watcher]) { await sync(client); privacy(client, state()); }
  topDrawVerified = true;
  pass('the next real legal gold-dragon draw after SQLite restart takes the exact reordered top card and stays private');
  for (const zone of ['hand', 'excluded', 'committed', 'ante', 'flight', 'discard', 'pending', 'reserved', 'revealed']) assert.equal(testedZones.has(zone), true, 'all non-deck zone guards are exercised');
} catch (error) { failure = { step, kind: safeErrorName(error) }; }
finally {
  try { await stop(); } catch { failure ||= { step: 'service-cleanup', kind: 'Error' }; }
  try {
    for (const suffix of ['', '-wal', '-shm']) if (existsSync(database + suffix)) unlinkSync(database + suffix);
    rmdirSync(fixtureDirectory);
  } catch { failure ||= { step: 'synthetic-fixture-cleanup', kind: 'Error' }; }
}
writeFileSync(join(evidence, 'result.json'), JSON.stringify({ completed: !failure, checks, passed: checks.length, authoritySha256: existsSync(serviceFile) ? hash(serviceFile) : null, editSourceSha256: hash(join(root, 'extensions/three-dragon-ante/src/game/rules/edits.ts')), generatedPhases, crossZoneGuards: [...testedZones].sort(), serviceRestarts: restarts, nextLegalTopDrawVerified: topDrawVerified, fixtureDatabaseRemoved: !existsSync(database), failure,
  scope: 'Actual current authority, real loopback HTTP/WebSocket, actual engine-generated legal phases and disposable synthetic SQLite. Evidence contains safe labels/counts/booleans/code hashes only. No browser, production database, remote endpoint, real player data or device UAT.' }, null, 2) + '\n');
console.log(JSON.stringify({ completed: !failure, passed: checks.length, evidence, ...(failure ? { failure } : {}) }));
if (failure) process.exitCode = 1;
