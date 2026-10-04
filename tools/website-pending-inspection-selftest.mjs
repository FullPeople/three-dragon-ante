// Actual compiled client and real loopback WS/RAM authority; no browser or persisted sessions/projections/SQL.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { build } from 'rolldown';
const root = resolve(import.meta.dirname, '..'), origin = 'http://127.0.0.1';
const WebSocket = createRequire(join(root, 'server/three-dragon/package.json'))('ws');
const { createTableService } = await import(pathToFileURL(join(root, 'dist-server/service.mjs')));
const evidenceRoot = join(root, '.local-evidence', 'website-pending-inspection');
mkdirSync(evidenceRoot, { recursive: true });
const out = mkdtempSync(join(evidenceRoot, 'run-'));
await build({ input: join(root, 'extensions/three-dragon-ante/src/game/server-client.ts'), platform: 'browser', plugins: [{ name: 'loopback-endpoint', transform(code, id) {
  if (id.replaceAll('\\', '/').endsWith('/server-endpoint.ts')) return code.replaceAll('import.meta.env?.VITE_TDA_API', JSON.stringify('/three-dragon-api/v1'));
} }], output: { file: join(out, 'client.js'), format: 'iife', name: 'TDAClient', codeSplitting: false }, logLevel: 'warn' });
const compiled = readFileSync(join(out, 'client.js'), 'utf8'), delay = ms => new Promise(done => setTimeout(done, ms));
async function wait(check, label, timeout = 12000) { const end = Date.now() + timeout; while (!check()) { assert.ok(Date.now() < end, label); await delay(5); } }
const cases = []; let activeCase, failure;
const safeErrorName = error => ['Error', 'AssertionError', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'AggregateError'].includes(error?.constructor?.name) ? error.constructor.name : 'OtherError';
const safeCauseCode = error => ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(error?.cause?.code) ? error.cause.code : null;

async function run({ label, type = 'inspect', enabled = true, authPending = false, terminal = null, actionFault = null, manualRetry = false, restart = false }) {
  const service = createTableService({ database: ':memory:', origin }), sockets = []; let client;
  await new Promise(done => service.server.listen(0, '127.0.0.1', done));
  const address = origin + ':' + service.server.address().port, started = Date.now(), events = [], envelopes = [], commandTimers = new Set();
  let connectionCount = 0, focusedCommands = 0, dropped = false, armed = false, activeSocket, stalled = 0, closeAt = null, freshConnectionView = null, commandDeadlineAtLoss = null;
  const result = { label, completed: false }; cases.push(result); let step = 'setup-admission';
  const record = value => { if (events.length < 32) events.push({ ms: Date.now() - started, ...value }); };
  const post = async (path, body) => { const response = await fetch(address + '/three-dragon-api/v1' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); assert.equal(response.ok, true); return response.json(); };
  async function raw(session) {
    const ws = new WebSocket(address.replace('http:', 'ws:') + '/three-dragon-api/v1/socket', { origin }); sockets.push(ws);
    const state = { ready: false, acks: new Map() }; ws.on('error', () => {});
    ws.on('message', bytes => { const p = JSON.parse(String(bytes)); if (p.type === 'view') state.ready = true; if (p.type === 'ack') state.acks.set(p.id, p.ok); });
    await new Promise((done, reject) => { ws.once('open', done); ws.once('error', reject); }); ws.send(JSON.stringify({ type: 'auth', room: session.roomId, token: session.token })); await wait(() => state.ready, 'setup authenticates'); return { ws, state };
  }
  try {
    step = 'setup-create-admission'; const admission = await post('/guest/rooms', { name: 'Synthetic host' });
    step = 'setup-join-admission';
    const peerAdmission = await post('/guest/rooms/' + admission.room.code + '/sessions', { name: 'Synthetic player' });
    step = 'setup-authentication'; const host = await raw(admission.session); await raw(peerAdmission.session);
    const setupId = randomUUID(); host.ws.send(JSON.stringify({ type: 'command', id: setupId, command: { type: 'start', options: { startingGold: 200, variant: { ruleSetId: 'provided-pack-20260910', deckId: 'wheel-of-fate-v1' } } } }));
    step = 'setup-start'; await wait(() => host.state.acks.has(setupId), 'setup starts'); assert.equal(host.state.acks.get(setupId), true);
    class FaultSocket extends WebSocket {
      constructor(url) {
        super(url, { origin }); sockets.push(this); activeSocket = this; this.attempt = ++connectionCount; this.on('error', () => {});
        this.on('open', () => record({ kind: 'socket-open', attempt: this.attempt }));
        this.on('close', code => { if (closeAt == null) closeAt = Date.now() - started; record({ kind: 'socket-close', attempt: this.attempt, code }); });
      }
      get onmessage() { return super.onmessage; }
      set onmessage(callback) {
        super.onmessage = event => {
          const packet = JSON.parse(String(event.data));
          if (actionFault === 'ack' && this.attempt === 1 && packet.type === 'ack' && packet.id === envelopes[0]?.id) {
            dropped = true; record({ kind: 'dropped-ack', commandCount: focusedCommands }); queueMicrotask(() => this.close(1000, 'synthetic-validation')); return;
          }
          callback(event);
          if (packet.type === 'view' && this.attempt === 2 && activeSocket === this && freshConnectionView == null) {
            freshConnectionView = { pending: client.view.pending, canEdit: client.view.canEdit === true, inspect: client.view.game?.omniscient === true };
            record({ kind: 'fresh-generation-view', attempt: this.attempt, ...freshConnectionView });
          }
        };
      }
      send(data, ...args) {
        const packet = JSON.parse(String(data));
        if (authPending && this.attempt === 1 && packet.type === 'auth') { record({ kind: 'dropped-auth' }); return; }
        if (armed && packet.type === 'command' && packet.command?.type === (actionFault ? 'action' : type)) {
          focusedCommands++; envelopes.push(packet);
          if (!dropped && !(actionFault === 'ack')) {
            dropped = true; record({ kind: 'dropped-command', commandCount: focusedCommands });
            if (!authPending || terminal) queueMicrotask(() => {
              commandDeadlineAtLoss = commandTimers.size;
              if (restart) { client.stop(); client.start(); }
              else {
                this.close(terminal?.code || 1000, terminal?.reason || 'synthetic-validation');
                if (manualRetry) { assert.equal(this.readyState, WebSocket.CLOSING); void client.command({ type: 'retry' }); }
              }
            });
            return;
          }
        }
        return super.send(data, ...args);
      }
    }
    const context = createContext({ WebSocket: FaultSocket, location: { href: address + '/' }, URL, crypto: { randomUUID },
      setTimeout(callback, ms, ...args) { let timer; timer = setTimeout(() => { commandTimers.delete(timer); callback(...args); }, ms); if (ms === 8000) commandTimers.add(timer); return timer; },
      clearTimeout(timer) { commandTimers.delete(timer); clearTimeout(timer); } });
    runInContext(compiled, context, { timeout: 5000 });
    client = new context.TDAClient.ServerTableClient(admission.session, view => {
      record({ kind: 'view', connected: view.connected, pending: view.pending, isHost: view.isHost === true, canEdit: view.canEdit === true, inspect: view.game?.omniscient === true, commandCount: focusedCommands });
    }, () => {}, () => {}, () => stalled++);
    step = 'initial-client-view'; client.start();
    if (authPending) await wait(() => activeSocket?.readyState === WebSocket.OPEN, 'first transport opens without authentication');
    else await wait(() => client.view.connected && client.view.game, 'client receives actual live game');
    step = 'prior-explicit-enable'; if (!enabled && !actionFault) { await client.command({ type, enabled: true }); await wait(() => !client.view.pending && client.view.canEdit, 'prior inspection is actively enabled'); }
    armed = true;
    let action, beforeRevision;
    step = 'fault-command'; if (actionFault) {
      const game = client.view.game; beforeRevision = game.revision;
      assert.ok(game.actions.some(a => a.kind === 'ante')); action = { id: randomUUID(), revision: game.revision, seatId: game.selfSeatId, kind: 'ante', cardId: game.hand[0].id };
      await client.command({ type: 'action', action });
    } else await client.command({ type, enabled });
    step = 'native-command-timer'; if (manualRetry || restart) {
      assert.equal(commandDeadlineAtLoss, 1, 'original native command deadline exists before the synchronous connection switch');
      assert.equal(commandTimers.size, !actionFault || restart ? 0 : 1, 'connection switch clears permission deadlines and stop clears its timers');
    } else assert.equal(commandTimers.size, 1, 'real command deadline is scheduled before loss');
    if (terminal) {
      step = 'terminal-denial'; await wait(() => client.view.message === (terminal.code === 4001 ? 'sessionReplaced' : 'notAllowed'), 'terminal denial stays terminal');
      assert.equal(client.view.pending, false); assert.equal(commandTimers.size, 0); await delay(750); assert.equal(connectionCount, 1); assert.equal(focusedCommands, 1); assert.equal(stalled, 0);
      Object.assign(result, { terminal: true, pendingCleared: true, timerCleared: true, connectionCount, commandCount: focusedCommands });
    } else if (actionFault) {
      step = 'transaction-receipt'; await wait(() => connectionCount === 2 && !client.view.pending && client.view.actionReceipt?.ok === true, 'actual transaction resumes and receives committed receipt');
      step = 'transaction-invariants';
      assert.equal(focusedCommands, 2, 'exactly one automatic transaction retry'); assert.deepEqual(envelopes[0], envelopes[1], 'retry preserves exact envelope and action');
      assert.equal(client.view.game.revision, beforeRevision + 1); assert.equal(client.view.actionReceipt.actionId, action.id); assert.equal(client.view.actionReceipt.revision, beforeRevision + 1); assert.equal(commandTimers.size, 0);
      const stored = JSON.parse(service.db.prepare('SELECT state FROM rooms WHERE id=?').get(admission.room.id).state);
      assert.equal(stored.game.revision, beforeRevision + 1, 'authority applies action only once');
      const receiptCount = service.db.prepare('SELECT count(*) n FROM receipts WHERE room=? AND member=? AND id IN (?,?)').get(admission.room.id, admission.session.memberId, envelopes[0].id, 'action:' + stored.game.id + ':' + action.id).n;
      assert.equal(receiptCount, 2, 'durable envelope and action receipt both exist');
      const beforeIdleCount = focusedCommands; await delay(750); assert.equal(focusedCommands, beforeIdleCount); assert.equal(client.view.game.revision, beforeRevision + 1);
      Object.assign(result, { connectionCount, commandCount: focusedCommands, pendingCleared: true, timerCleared: true, applicationCount: stored.game.revision - beforeRevision, durableReceiptCount: receiptCount, sameEnvelope: true, inspectionClosed: client.view.canEdit === false && client.view.game.omniscient !== true });
    } else {
      step = 'ordinary-reconnect'; await wait(() => closeAt != null && connectionCount === 2 && freshConnectionView != null && client.view.connected && !client.view.pending, 'ordinary reconnect clears pending permission');
      step = 'ordinary-reconnect-current-view';
      assert.equal(focusedCommands, 1, 'old capability command is never replayed'); assert.equal(client.view.isHost, true); assert.equal(client.view.canEdit, false); assert.notEqual(client.view.game.omniscient, true);
      step = 'ordinary-reconnect-fresh-view'; assert.equal(freshConnectionView.pending, false); assert.equal(freshConnectionView.canEdit, false); assert.equal(freshConnectionView.inspect, false); assert.equal(commandTimers.size, 0); assert.equal(stalled, 0);
      const beforeManual = focusedCommands; await delay(750); assert.equal(focusedCommands, beforeManual, 'no delayed automatic permission replay');
      step = 'fresh-explicit-enable'; await client.command({ type, enabled: true }); await wait(() => !client.view.pending && client.view.canEdit && client.view.game.omniscient === true, 'new explicit enable is still permitted');
      assert.equal(focusedCommands, 2); assert.equal(commandTimers.size, 0);
      Object.assign(result, { connectionCount, automaticCommandCount: beforeManual, commandCountAfterFreshEnable: focusedCommands, pendingCleared: true, timerCleared: true, ordinaryReconnect: true, freshExplicitEnable: true, stalledCount: stalled });
    }
    result.completed = true;
  } catch (error) {
    result.failureStep = step; result.errorName = safeErrorName(error); result.causeCode = safeCauseCode(error);
    result.failureObservation = { connectionCount, commandCount: focusedCommands, closeObserved: closeAt != null, freshViewObserved: freshConnectionView != null, connected: client?.view.connected === true, pending: client?.view.pending === true, activeReadyState: activeSocket?.readyState ?? null, commandTimerCount: commandTimers.size };
    throw error;
  } finally {
    result.events = events.map(v => ({ ...v })); client?.stop(); for (const ws of sockets) ws.terminate(); await service.close();
  }
}
const plans = [
  { label: 'inspect-enable-loss', type: 'inspect' }, { label: 'omniscient-enable-loss', type: 'omniscient' },
  { label: 'inspect-disable-loss', type: 'inspect', enabled: false }, { label: 'omniscient-disable-loss', type: 'omniscient', enabled: false },
  { label: 'pending-inspect-real-auth-deadline', authPending: true },
  { label: 'pending-inspect-unauth1008-terminal', authPending: true, terminal: { code: 1008, reason: 'notAllowed' } },
  { label: 'pending-omniscient-4001-terminal', type: 'omniscient', authPending: true, terminal: { code: 4001, reason: 'synthetic-validation' } },
  { label: 'action-unsent-retry', actionFault: 'send' }, { label: 'action-committed-ack-lost-retry', actionFault: 'ack' },
  { label: 'inspect-closing-manual-retry', manualRetry: true },
  { label: 'omniscient-stop-start-same-instance', type: 'omniscient', restart: true },
  { label: 'action-closing-manual-retry', actionFault: 'send', manualRetry: true },
  { label: 'action-stop-start-same-instance', actionFault: 'send', restart: true },
];
const caseIndex = process.argv.indexOf('--case'), caseSelection = caseIndex < 0 ? null : process.argv[caseIndex + 1];
assert.ok(caseSelection == null || plans.some(p => p.label === caseSelection), 'Selected control exists');
const selectedPlans = caseSelection == null ? plans : plans.filter(p => p.label === caseSelection);
try { for (const plan of selectedPlans) { activeCase = plan.label; await run(plan); console.log('PASS ' + plan.label); } } catch (error) { failure = error; }
writeFileSync(join(out, 'result.json'), JSON.stringify({ completed: !failure, cases, clientSourceSha256: createHash('sha256').update(readFileSync(join(root, 'extensions/three-dragon-ante/src/game/server-client.ts'))).digest('hex'), authoritySha256: createHash('sha256').update(readFileSync(join(root, 'dist-server/service.mjs'))).digest('hex'), failure: failure ? { case: activeCase, kind: safeErrorName(failure), step: cases.at(-1)?.failureStep } : null,
  scope: 'Real current client compiled with only loopback endpoint substitution; real RAM authority, native timers/WS. Fault injection drops synthetic sends/ACK. Only safe booleans/counts/times/code hashes persisted, never session/name/room/token/card/frame/SQL. This is not browser/UI acceptance.' }, null, 2));
console.log(JSON.stringify({ completed: !failure, passed: cases.filter(c => c.completed).length, total: selectedPlans.length, evidence: out }));
if (failure) { console.error('FAIL ' + activeCase); process.exitCode = 1; }
