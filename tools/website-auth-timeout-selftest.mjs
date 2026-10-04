// Actual compiled client, real loopback WS and synthetic RAM authority. No browser or persisted credentials.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { build } from 'rolldown';
import { createTableService } from '../dist-server/service.mjs';

const root = resolve(import.meta.dirname, '..');
const NativeWebSocket = createRequire(join(root, 'server/three-dragon/package.json'))('ws');
const baselineIndex = process.argv.indexOf('--baseline-client');
const baseline = baselineIndex < 0 ? null : process.argv[baselineIndex + 1];
if (baselineIndex >= 0 && !/^[a-f0-9]{7,40}$/.test(baseline || '')) throw Error('Expected a Git commit for --baseline-client');
const clientPath = 'extensions/three-dragon-ante/src/game/server-client.ts';
const clientSource = baseline ? execFileSync('git', ['show', baseline + ':' + clientPath], { cwd: root, encoding: 'utf8', windowsHide: true }) : readFileSync(join(root, clientPath), 'utf8');
const evidenceRoot = join(root, '.local-evidence', 'website-auth-timeout'); mkdirSync(evidenceRoot, { recursive: true });
const out = mkdtempSync(join(evidenceRoot, baseline ? 'baseline-' : 'run-'));
await build({ input: join(root, clientPath), platform: 'browser', plugins: [{ name: 'actual-client-loopback-api', transform(code, id) {
  if (id.replaceAll('\\', '/').endsWith('/' + clientPath)) return clientSource;
  if (id.replaceAll('\\', '/').endsWith('/server-endpoint.ts')) return code.replaceAll('import.meta.env?.VITE_TDA_API', JSON.stringify('/three-dragon-api/v1'));
} }], output: { file: join(out, 'client.js'), format: 'iife', name: 'TDAAuthClient', codeSplitting: false }, logLevel: 'warn' });
const compiled = readFileSync(join(out, 'client.js'), 'utf8');
const delay = ms => new Promise(done => setTimeout(done, ms));
async function wait(check, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (!check()) { assert.ok(Date.now() < deadline, label); await delay(5); }
}
const measurements = [], checks = []; let activeCase = 'compile', failure;
const pass = label => { checks.push(label); console.log('PASS ' + label); };

function probe(origin, dropFirstAuth = false) {
  const started = Date.now(), sockets = [], opened = [], closed = [], counts = { auth: 0, droppedAuth: 0, command: 0, sync: 0, other: 0 };
  let attempts = 0;
  class Socket extends NativeWebSocket {
    constructor(url) {
      super(url, { origin: 'http://127.0.0.1' }); const attempt = ++attempts; sockets.push(this);
      this.on('open', () => opened.push({ attempt, ms: Date.now() - started }));
      this.on('error', () => {});
      this.on('close', (code, bytes) => {
        const reason = bytes.toString();
        closed.push({ attempt, ms: Date.now() - started, code, reason: ['authenticationRequired', 'notAllowed', 'syntheticUnknown', 'syntheticReplaced'].includes(reason) ? reason : 'other' });
      });
      this.attempt = attempt;
    }
    send(value, ...args) {
      const type = JSON.parse(String(value)).type;
      counts[Object.hasOwn(counts, type) && type !== 'droppedAuth' ? type : 'other']++;
      // Fault injection only: the first authentication frame never reaches the real authority.
      // Its unchanged production 5000ms deadline, rather than a test timer, closes this socket.
      if (dropFirstAuth && this.attempt === 1 && type === 'auth') { counts.droppedAuth++; return; }
      return super.send(value, ...args);
    }
  }
  const context = createContext({ WebSocket: Socket, location: { href: origin + '/' }, URL, crypto: { randomUUID }, setTimeout, clearTimeout });
  runInContext(compiled, context, { timeout: 5000 });
  const views = [];
  const create = session => new context.TDAAuthClient.ServerTableClient(session, view => {
    if (views.length < 32) views.push({ ms: Date.now() - started, connected: view.connected, pending: view.pending, message: ['connecting', 'notAllowed', 'sessionReplaced'].includes(view.message) ? view.message : 'other', gamePresent: !!view.game, canEdit: view.canEdit === true });
  }, () => {}, () => {});
  return { create, counts, opened, closed, views, get attempts() { return attempts; }, dispose() { for (const socket of sockets) socket.terminate(); } };
}

async function realAuthority(recover) {
  const origin = 'http://127.0.0.1', service = createTableService({ database: ':memory:', origin });
  const rawSockets = []; let client, observation;
  await new Promise(done => service.server.listen(0, '127.0.0.1', done));
  const address = origin + ':' + service.server.address().port;
  async function post(path, body) {
    const response = await fetch(address + '/three-dragon-api/v1' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.ok, true, 'synthetic admission succeeds'); return response.json();
  }
  async function raw(session) {
    const ws = new NativeWebSocket(address.replace('http:', 'ws:') + '/three-dragon-api/v1/socket', { origin }); rawSockets.push(ws);
    const state = { initialized: false, gamePresent: false, canEdit: false, acks: new Map() };
    ws.on('error', () => {}); ws.on('message', bytes => {
      const packet = JSON.parse(bytes.toString());
      if (packet.type === 'view') { state.initialized = true; state.gamePresent = !!packet.view.game; state.canEdit = packet.view.canEdit === true; }
      if (packet.type === 'patch') { if (Object.hasOwn(packet.patch.set, 'canEdit')) state.canEdit = packet.patch.set.canEdit === true; if (Object.hasOwn(packet, 'game')) state.gamePresent = !!packet.game; }
      if (packet.type === 'ack') state.acks.set(packet.id, packet.ok);
    });
    await new Promise((done, reject) => { ws.once('open', done); ws.once('error', reject); });
    ws.send(JSON.stringify({ type: 'auth', room: session.roomId, token: session.token })); await wait(() => state.initialized, 'raw synthetic authentication completes');
    return { ws, state };
  }
  async function command(actor, command) {
    const id = randomUUID(); actor.ws.send(JSON.stringify({ type: 'command', id, command }));
    await wait(() => actor.state.acks.has(id), 'synthetic command acknowledges'); assert.equal(actor.state.acks.get(id), true, 'synthetic setup command succeeds');
  }
  try {
    const admission = await post('/guest/rooms', { name: 'Synthetic host' });
    if (recover) {
      const peerAdmission = await post('/guest/rooms/' + admission.room.code + '/sessions', { name: 'Synthetic player' });
      const host = await raw(admission.session); await raw(peerAdmission.session);
      await command(host, { type: 'start', options: { startingGold: 200, variant: { ruleSetId: 'provided-pack-20260910', deckId: 'wheel-of-fate-v1' } } });
      await wait(() => host.state.gamePresent, 'synthetic game is live');
      await command(host, { type: 'inspect', enabled: true }); await wait(() => host.state.canEdit, 'prior connection has explicit inspection grant');
    }
    observation = probe(address, recover);
    client = observation.create(recover ? admission.session : { ...admission.session, token: '0'.repeat(64) });
    client.start();
    if (recover) {
      await wait(() => client.view.connected || client.view.message === 'notAllowed', 'client recovers after real authentication deadline');
      assert.equal(client.view.connected, true, 'authenticationRequired uses existing automatic backoff');
      assert.equal(observation.attempts, 2); assert.equal(observation.counts.auth, 2); assert.equal(observation.counts.droppedAuth, 1);
      assert.equal(observation.closed[0]?.code, 1008); assert.equal(observation.closed[0]?.reason, 'authenticationRequired');
      assert.ok(observation.closed[0].ms - observation.opened[0].ms >= 4900, 'actual unchanged five-second service deadline fired');
      assert.ok(observation.opened[1].ms - observation.closed[0].ms >= 450, 'retry uses existing 500ms backoff');
      assert.equal(client.view.pending, false); assert.equal(observation.counts.command, 0); assert.equal(observation.counts.sync, 0);
      assert.equal(client.view.isHost, true); assert.ok(client.view.game, 'recovered view contains the actual live game');
      assert.equal(client.view.canEdit, false); assert.notEqual(client.view.game.omniscient, true, 'prior connection inspection does not reopen');
      const previousViews = observation.views.length;
      await client.command({ type: 'retry' }); await wait(() => observation.views.length > previousViews, 'explicit sync returns a new real view');
      assert.equal(observation.counts.sync, 1); assert.equal(observation.counts.command, 0); assert.equal(observation.attempts, 2);
    } else {
      await wait(() => client.view.message === 'notAllowed', 'actual invalid credential is rejected');
      await delay(1100); assert.equal(client.view.connected, false); assert.equal(client.view.pending, false);
      assert.equal(observation.attempts, 1); assert.equal(observation.counts.auth, 1); assert.equal(observation.counts.command, 0);
      assert.equal(observation.closed[0]?.code, 1008); assert.equal(observation.closed[0]?.reason, 'notAllowed');
    }
    measurements.push({ case: recover ? 'authenticationRequired-recovery' : 'notAllowed-terminal', attempts: observation.attempts, counts: observation.counts, opened: observation.opened, closed: observation.closed, views: observation.views, inspectionClosed: client.view.canEdit !== true && client.view.game?.omniscient !== true });
  } finally { client?.stop(); observation?.dispose(); for (const ws of rawSockets) ws.terminate(); await service.close(); }
}

async function syntheticClose(code, reason, stopDuringBackoff = false) {
  const server = createServer(), wss = new NativeWebSocket.WebSocketServer({ server }); let client, observation;
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  wss.on('connection', ws => { ws.on('error', () => {}); ws.once('message', () => ws.close(code, reason)); });
  try {
    observation = probe('http://127.0.0.1:' + server.address().port);
    client = observation.create({ roomId: 'synthetic-room', memberId: 'synthetic-member', token: '0'.repeat(64), role: 'PLAYER', owner: false });
    client.start();
    if (stopDuringBackoff) {
      await wait(() => observation.closed.length === 1 && client.view.message === 'connecting', 'authenticationRequired enters backoff before stop');
      client.stop(); await delay(750); assert.equal(observation.attempts, 1); assert.equal(client.view.connected, false);
    } else {
      await wait(() => client.view.message === (code === 4001 ? 'sessionReplaced' : 'notAllowed'), 'non-retryable close remains terminal');
      await delay(1100); assert.equal(observation.attempts, 1); assert.equal(client.view.connected, false); assert.equal(client.view.pending, false);
    }
    assert.equal(observation.closed[0]?.code, code); assert.equal(observation.closed[0]?.reason, reason);
    assert.equal(observation.counts.auth, 1); assert.equal(observation.counts.command, 0); assert.equal(observation.counts.sync, 0);
    measurements.push({ case: stopDuringBackoff ? 'stop-during-backoff' : code === 4001 ? 'sessionReplaced-terminal' : 'unknown1008-terminal', attempts: observation.attempts, counts: observation.counts, opened: observation.opened, closed: observation.closed, views: observation.views });
  } finally { client?.stop(); observation?.dispose(); for (const ws of wss.clients) ws.terminate(); await new Promise(done => server.close(done)); await new Promise(done => wss.close(done)); }
}

try {
  activeCase = 'authenticationRequired-recovery'; await realAuthority(true); pass(activeCase);
  activeCase = 'notAllowed-terminal'; await realAuthority(false); pass(activeCase);
  activeCase = 'unknown1008-terminal'; await syntheticClose(1008, 'syntheticUnknown'); pass(activeCase);
  activeCase = 'sessionReplaced-terminal'; await syntheticClose(4001, 'syntheticReplaced'); pass(activeCase);
  activeCase = 'stop-during-backoff'; await syntheticClose(1008, 'authenticationRequired', true); pass(activeCase);
} catch (error) { failure = error; }
writeFileSync(join(out, 'result.json'), JSON.stringify({ completed: !failure, checks, measurements, baselineClient: baseline, clientSourceSha256: createHash('sha256').update(clientSource).digest('hex'), serviceSha256: createHash('sha256').update(readFileSync(join(root, 'dist-server/service.mjs'))).digest('hex'), failure: failure ? { case: activeCase, kind: failure.name === 'AssertionError' ? 'AssertionError' : 'Error' } : null,
  scope: 'Real compiled client and loopback TCP/WS; recovery and invalid credentials use unchanged built authority with synthetic RAM sessions/game. First auth is intentionally not delivered. Three additional real WS close controls. No browser/UI acceptance or explanation of browser callback delay. No payload, credential, room identifier, SQL or private cards persisted.' }, null, 2) + '\n');
console.log(JSON.stringify({ completed: !failure, passed: checks.length, evidence: out }));
if (failure) { console.error('FAIL ' + activeCase + ' (' + (failure.name === 'AssertionError' ? 'AssertionError' : 'Error') + ')'); process.exitCode = 1; }
