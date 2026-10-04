// Built authority + real loopback TCP/WS. All sessions and game state are synthetic and remain in RAM.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTableService } from '../dist-server/service.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const WebSocket = createRequire(join(root, 'server/three-dragon/package.json'))('ws');
const evidenceRoot = join(root, '.local-evidence', 'host-refresh-grace');
mkdirSync(evidenceRoot, { recursive: true });
const evidenceDirectory = mkdtempSync(join(evidenceRoot, 'run-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(check) { const end = Date.now() + 3000; while (!check()) { assert.ok(Date.now() < end, 'Synthetic operation completed within 3 seconds'); await delay(5); } }
const patch = (old, change) => { const next = { ...old, ...change.set }; for (const key of change.remove) delete next[key]; return next; };

async function run(grace, gap) {
  const started = Date.now(), origin = 'http://127.0.0.1', clients = [];
  const service = createTableService({ database: ':memory:', origin, ...(grace == null ? {} : { hostGraceMs: grace }) });
  let changedAt = null, closedAt = null;
  await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
  const base = origin + ':' + service.server.address().port + '/three-dragon-api/v1';
  async function post(path, body) { const response = await fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); assert.equal(response.ok, true); return response.json(); }
  async function raw(session, watchTransfer = false) {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/socket', { origin });
    const client = { ws, view: null, acks: new Map(), closed: false }; clients.push(client);
    ws.on('error', () => {}); ws.on('close', () => { client.closed = true; });
    ws.on('message', bytes => {
      const packet = JSON.parse(bytes.toString());
      if (packet.type === 'view') client.view = packet.view;
      else if (packet.type === 'patch') client.view = { ...patch(client.view, packet.patch), game: packet.gamePatch ? patch(client.view.game, packet.gamePatch) : packet.game };
      else if (packet.type === 'ack') client.acks.set(packet.id, packet);
      if (watchTransfer && closedAt != null && client.view?.isHost && changedAt == null) changedAt = Date.now();
    });
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    ws.send(JSON.stringify({ type: 'auth', room: session.roomId, token: session.token })); await wait(() => client.view); return client;
  }
  try {
    const hostAdmission = await post('/guest/rooms', { name: 'Synthetic host' });
    const playerAdmission = await post('/guest/rooms/' + hostAdmission.room.code + '/sessions', { name: 'Synthetic player' });
    const host = await raw(hostAdmission.session), player = await raw(playerAdmission.session, true);
    const commandId = crypto.randomUUID();
    host.ws.send(JSON.stringify({ type: 'command', id: commandId, command: { type: 'start', options: { startingGold: 200, variant: { ruleSetId: 'provided-pack-20260910', deckId: 'wheel-of-fate-v1' } } } }));
    await wait(() => host.acks.has(commandId)); assert.equal(host.acks.get(commandId).ok, true); await wait(() => !!player.view?.game);
    const state = () => JSON.parse(service.db.prepare('SELECT state FROM rooms WHERE id=?').get(hostAdmission.room.id).state);
    const hashGame = () => createHash('sha256').update(JSON.stringify(state().game)).digest('hex');
    const beforeHash = hashGame(), beforeSeatCount = state().table.seats.length;
    assert.equal(beforeSeatCount, 2); assert.equal(host.view.isHost, true); assert.equal(player.view.isHost, false);
    host.ws.close(1000, 'synthetic-validation'); await wait(() => host.closed && service.stats().sockets === 1); closedAt = Date.now();
    await delay(gap);
    const hostBeforeReconnect = state().table.hostPlayerId === hostAdmission.session.memberId;
    const resumed = await raw(hostAdmission.session); const reconnectAt = Date.now();
    const sameGame = hashGame() === beforeHash, sameSeats = state().table.seats.length === beforeSeatCount;
    const expectHost = grace == null && gap < 8000;
    assert.equal(hostBeforeReconnect, expectHost); assert.equal(resumed.view.isHost, expectHost); assert.equal(player.view.isHost, !expectHost);
    assert.equal(sameGame, true); assert.equal(sameSeats, true); assert.equal(resumed.view.canEdit, false); assert.notEqual(resumed.view.game?.omniscient, true);
    return { graceMs: grace ?? 'production-default-8000', requestedGapMs: gap, actualGapMs: reconnectAt - closedAt, ownerChangedAfterCloseMs: changedAt == null ? null : changedAt - closedAt, originalHostBeforeReconnect: hostBeforeReconnect, originalHostAfterReconnect: resumed.view.isHost, peerHost: player.view.isHost, gameDigestBefore: beforeHash, gameDigestAfter: hashGame(), gameUnchanged: sameGame, seatCount: beforeSeatCount, seatsUnchanged: sameSeats, inspectionClosed: resumed.view.canEdit === false && resumed.view.game?.omniscient !== true, socketsAfterReconnect: service.stats().sockets, totalMs: Date.now() - started };
  } finally { for (const client of clients) client.ws.terminate(); await service.close(); }
}

const results = [];
let failure;
try {
  for (const [grace, gap] of [[4000, 5000], [null, 5000], [null, 9000]]) {
    results.push(await run(grace, gap));
    console.log('PASS refresh grace ' + (grace ?? 'default-8000') + ' / reconnect gap ' + gap);
  }
} catch (error) { failure = error; }
const evidence = { completed: !failure, serviceSha256: createHash('sha256').update(readFileSync(join(root, 'dist-server/service.mjs'))).digest('hex'), cases: results.length, results,
  scope: 'Actual built authority, synthetic RAM database and real loopback TCP/WebSocket. No browser, production database or persisted payload/credential/name/room identifier.' };
writeFileSync(join(evidenceDirectory, 'result.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ completed: !failure, passed: results.length, evidence: evidenceDirectory }));
if (failure) throw failure;
