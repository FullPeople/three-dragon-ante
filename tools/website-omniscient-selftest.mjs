// Actual website + loopback authority, using synthetic rooms only. Evidence never stores projections or tokens.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build as buildSite } from 'vite';
import { build as buildServer } from 'rolldown';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..'), base = '/three-dragon-ante-dev/';
const evidenceRoot = join(root, '.local-evidence/website-omniscient'); mkdirSync(evidenceRoot, { recursive: true });
const out = mkdtempSync(join(evidenceRoot, 'run-')), dist = join(out, 'site');
const checks = [], errors = [], external = [], actors = [], sockets = [];
const transports = new Map();
const pass = label => { checks.push(label); console.log('PASS ' + label); };
const wait = async (check, label, timeout = 20000) => {
  const deadline = Date.now() + timeout;
  while (!await check()) { if (Date.now() > deadline) throw Error('Timed out: ' + label); await new Promise(done => setTimeout(done, 10)); }
};
await buildServer({ input: join(root, 'server/three-dragon/service.mjs'), platform: 'node', external: [/^node:/], output: { file: join(out, 'service.mjs'), format: 'esm', codeSplitting: false }, logLevel: 'warn' });
await buildSite({ configFile: join(root, 'vite.config.ts'), logLevel: 'warn', plugins: [{ name: 'loopback-api', enforce: 'pre', transform(code, id) {
  if (id.endsWith('/server-endpoint.ts') || id.endsWith('\\server-endpoint.ts')) return code.replaceAll('import.meta.env?.VITE_TDA_API', JSON.stringify('/three-dragon-api/v1'));
} }], build: { outDir: dist, emptyOutDir: true } });
const { createTableService } = await import(pathToFileURL(join(out, 'service.mjs')));
const WebSocket = createRequire(join(root, 'server/three-dragon/package.json'))('ws');
let service, failCommit = false, failure;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg' };
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith('/three-dragon-api/v1/')) { service.server.emit('request', req, res); return; }
  const file = resolve(dist, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
  if (!pathname.startsWith(base) || !file.startsWith(dist + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(readFileSync(file));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
service = createTableService({ database: ':memory:', origin, hostGraceMs: 4000, injectFailure() { if (failCommit) { failCommit = false; throw Error('storageFailed'); } } });
server.on('upgrade', (req, socket, head) => {
  const key = req.headers['user-agent']; transports.set(key, socket);
  socket.on('close', () => { if (transports.get(key) === socket) transports.delete(key); });
  service.server.emit('upgrade', req, socket, head);
});
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const options = { startingGold: 200, variant: { ruleSetId: 'provided-pack-20260910', deckId: 'wheel-of-fate-v1' } };
const state = room => JSON.parse(service.db.prepare('SELECT state FROM rooms WHERE id=?').get(room).state);
const patch = (old, value) => { const next = { ...old, ...value.set }; for (const key of value.remove) delete next[key]; return next; };
const acceptWire = (actor, message) => {
  if (message.type === 'view') actor.view = message.view;
  else if (message.type === 'patch') actor.view = { ...patch(actor.view, message.patch), game: message.gamePatch ? patch(actor.view.game, message.gamePatch) : message.game };
};
const privateAbsent = game => {
  for (const key of ['omniscient', 'privateHands', 'privateDeck', 'privateExcluded', 'privateCommittedAntes', 'deck']) assert.equal(game?.[key], undefined);
  for (const seat of game?.seats || []) assert.equal(seat.hand, undefined);
};
async function post(path, value) {
  const response = await fetch(origin + '/three-dragon-api/v1' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.ok(response.ok, 'synthetic admission succeeds'); return response.json();
}
async function actor(label) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce', userAgent: 'TDA-omniscient-' + label });
  const page = await context.newPage(), value = { context, page, view: null, commands: [] }; actors.push(value);
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push('unexpected-origin'); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  page.on('pageerror', () => errors.push('page-error'));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  page.on('websocket', socket => {
    socket.on('framereceived', event => { try { acceptWire(value, JSON.parse(event.payload.toString())); } catch { errors.push('wire-decode'); } });
    socket.on('framesent', event => { const packet = JSON.parse(event.payload.toString()); if (packet.type === 'command') value.commands.push(packet.command.type); });
  });
  await page.goto(origin + base); await page.locator('#guest-name').click(); await page.locator('#guest-name').fill(label);
  return value;
}
async function shortcut(actor) { await actor.page.locator('.tda-shell').focus(); await actor.page.keyboard.type('fuvtt'); await actor.page.keyboard.press('Enter'); }
async function raw(session) {
  const ws = new WebSocket(origin.replace('http:', 'ws:') + '/three-dragon-api/v1/socket', { origin });
  const value = { ws, view: null, acks: new Map(), closed: false }; sockets.push(ws);
  ws.on('close', () => { value.closed = true; }); ws.on('error', () => {});
  ws.on('message', bytes => { const packet = JSON.parse(bytes.toString()); acceptWire(value, packet); if (packet.type === 'ack') value.acks.set(packet.id, packet); });
  await new Promise((done, reject) => { ws.once('open', done); ws.once('error', reject); });
  ws.send(JSON.stringify({ type: 'auth', room: session.roomId, token: session.token })); await wait(() => value.view, 'raw authentication'); return value;
}
async function command(actor, value) {
  const id = crypto.randomUUID(); actor.ws.send(JSON.stringify({ type: 'command', id, command: value }));
  await wait(() => actor.acks.has(id), 'raw acknowledgement'); return actor.acks.get(id);
}
try {
  const host = await actor('Host');
  await host.page.locator('#guest-name').fill(''); await host.page.keyboard.type('fuvtt'); await host.page.keyboard.press('Enter');
  assert.equal(await host.page.locator('#guest-name').inputValue(), 'fuvtt'); assert.equal(await host.page.locator('#table-editor').count(), 0);
  assert.equal(service.stats().rooms, 0); pass('typing the sequence in the name field keeps normal text input and cannot enable inspection');
  await host.page.locator('#guest-name').fill('Host'); await host.page.getByRole('button', { name: '创建房间', exact: true }).click();
  await host.page.locator('.site-online-match[data-connected=true]').waitFor();
  const admission = await host.page.evaluate(() => JSON.parse(sessionStorage.getItem('three-dragon-site-active.v1')));
  const player = await actor('Player'); await player.page.locator('#guest-room-code').fill(admission.room.code); await player.page.getByRole('button', { name: '加入房间', exact: true }).click();
  await player.page.locator('.site-online-match[data-connected=true]').waitFor();
  await host.page.getByRole('button', { name: '开始', exact: true }).click();
  await host.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false' && document.querySelectorAll('.tda-card--hand.is-legal').length > 0);
  await wait(() => player.view?.game?.hand?.length, 'player receives own deal');
  for (const actor of [host, player]) { privateAbsent(actor.view.game); assert.equal(actor.view.canEdit, false); assert.equal(await actor.page.locator('#omniscient-toggle').count(), 0); }
  pass('normal host and player deals remain private, with no visible website omniscient entry');

  const before = structuredClone(state(admission.room.id)), peerBefore = structuredClone(player.view), sentBefore = host.commands.length;
  await host.page.locator('.tda-card--hand.is-legal').first().focus(); await host.page.keyboard.press('Space');
  await shortcut(host); await host.page.locator('#table-editor').waitFor();
  assert.equal(host.view.game.omniscient, true); assert.equal(host.view.canEdit, true);
  assert.deepEqual(host.view.game.privateHands, Object.fromEntries(before.game.seats.map(seat => [seat.id, seat.hand])));
  assert.deepEqual(state(admission.room.id), before); assert.deepEqual(player.view, peerBefore); privateAbsent(player.view.game);
  assert.deepEqual(host.commands.slice(sentBefore), ['omniscient']);
  pass('fuvtt plus Enter opens only the authenticated host editor, without playing a selected legal card or publishing inspection to the peer');

  const invite = host.page.getByRole('textbox', { name: '邀请链接', exact: true }); await invite.focus(); await host.page.keyboard.type('fuvtt'); await host.page.keyboard.press('Enter');
  assert.equal(host.view.game.omniscient, true);
  const gold = host.page.locator('.tda-editor-gold input').first(); await gold.focus(); await host.page.keyboard.type('fuvtt'); await host.page.keyboard.press('Enter');
  assert.equal(host.view.game.omniscient, true); assert.deepEqual(state(admission.room.id), before);
  await host.page.locator('.tda-editor-add').first().click();
  const search = host.page.locator('#table-editor-search'); await search.fill(''); await host.page.keyboard.type('fuvtt'); await host.page.keyboard.press('Enter');
  assert.equal(await search.inputValue(), 'fuvtt'); assert.equal(host.view.game.omniscient, true); assert.deepEqual(state(admission.room.id), before);
  pass('invite, real numeric editor and card-search inputs ignore the hidden sequence and preserve the authoritative game');

  await host.page.locator('#table-editor-close').click(); await host.page.locator('#table-editor').waitFor({ state: 'detached' });
  await wait(() => !host.view.game.omniscient && !host.view.canEdit, 'authoritative inspection close');
  privateAbsent(host.view.game); assert.equal(host.view.canEdit, false); assert.deepEqual(state(admission.room.id), before);
  await player.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false' && document.querySelectorAll('.tda-card--hand.is-legal').length > 0);
  await player.page.locator('.tda-card--hand.is-legal').first().focus(); await player.page.keyboard.press('Space');
  await shortcut(player); await player.page.waitForTimeout(100); privateAbsent(player.view.game); assert.equal(await player.page.locator('#table-editor').count(), 0);
  assert.deepEqual(state(admission.room.id), before); assert.equal(player.commands.includes('action'), false);
  assert.equal(player.commands.includes('omniscient'), false);
  pass('closing restores the host seat projection and the ordinary player shortcut sends no privileged command');

  await host.page.locator('.tda-shell').focus(); await host.page.keyboard.type('fuxtt'); await host.page.keyboard.press('Escape');
  assert.equal(await host.page.locator('#table-editor').count(), 0); assert.deepEqual(state(admission.room.id), before);
  await shortcut(host); await host.page.locator('#table-editor').waitFor();
  await host.page.reload(); await host.page.locator('.site-online-match[data-connected=true]').waitFor();
  await wait(() => host.view?.game && !host.view.game.omniscient, 'refresh drops inspection');
  assert.equal(host.view.isHost, true); assert.equal(host.view.canEdit, false); assert.equal(await host.page.locator('#table-editor').count(), 0);
  pass('a wrong sequence does not open inspection; a browser refresh reconnects as a normal host and requires a new sequence');

  await shortcut(host); await host.page.locator('#table-editor').waitFor();
  const disconnectedAt = Date.now(), transport = transports.get('TDA-omniscient-Host'); assert.ok(transport);
  transport.destroy();
  await host.page.waitForFunction(() => document.querySelector('.site-online-match')?.getAttribute('data-connected') === 'false' && document.querySelector('.tda-shell')?.getAttribute('data-omniscient') === 'false');
  assert.equal(await host.page.locator('#table-editor, .tda-editor-card, .tda-editor-gold').count(), 0);
  assert.ok(Date.now() - disconnectedAt < 500, 'host-only DOM disappears before the first automatic reconnect');
  await host.page.locator('.site-online-match[data-connected=true]').waitFor();
  await wait(() => host.view?.connected && !host.view.game.omniscient, 'disconnected website reconnects without inspection');
  assert.equal(host.view.canEdit, false); assert.equal(await host.page.locator('#table-editor').count(), 0);
  assert.deepEqual(state(admission.room.id).game, before.game);
  pass('cutting the real website WebSocket immediately removes all host-only editor DOM before reconnect and cannot restore inspection or editing');

  await shortcut(host); await host.page.locator('#table-editor').waitFor();
  const paused = transports.get('TDA-omniscient-Host'); assert.ok(paused); paused.pause();
  const beforeStall = structuredClone(state(admission.room.id));
  const stalledGold = host.page.locator('.tda-editor-gold input').first(); await stalledGold.fill('212');
  await host.page.locator('.tda-editor-head h2').click();
  await host.page.waitForFunction(() => document.querySelector('.site-online-match')?.getAttribute('data-connected') === 'false' && document.querySelector('.tda-shell')?.getAttribute('data-omniscient') === 'false', undefined, { timeout: 12000 });
  assert.equal(await host.page.locator('#table-editor, .tda-editor-card, .tda-editor-gold').count(), 0);
  assert.deepEqual(state(admission.room.id), beforeStall);
  paused.resume(); await host.page.locator('.site-online-match[data-connected=true]').waitFor();
  assert.equal(await host.page.locator('.tda-shell').getAttribute('data-omniscient'), 'false'); assert.equal(await host.page.locator('#table-editor').count(), 0);
  await host.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false' && document.querySelectorAll('.tda-card--hand.is-legal').length > 0);
  const recoveredRevision = state(admission.room.id).game.revision;
  await host.page.locator('.tda-card--hand.is-legal').first().focus(); await host.page.keyboard.press('Space'); await host.page.keyboard.press('Enter');
  await wait(() => state(admission.room.id).game.revision === recoveredRevision + 1, 'ordinary own action after timeout recovery');
  await host.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-pending-action') === 'false');
  assert.equal(await host.page.locator('#table-editor').count(), 0);
  pass('an actual paused socket reaches the receipt timeout, clears the editor, and late authoritative replies cannot reopen a mode that was locally revoked');

  const created = await post('/guest/rooms', { name: 'Authority owner' });
  const joined = await post('/guest/rooms/' + created.room.code + '/sessions', { name: 'Authority peer' });
  const owner = await raw(created.session), peer = await raw(joined.session);
  assert.equal((await command(owner, { type: 'omniscient', enabled: true })).code, 'notAllowed');
  assert.equal((await command(owner, { type: 'start', options })).ok, true); await wait(() => peer.view.game, 'raw deal');
  const gameId = owner.view.game.id, seatId = owner.view.game.selfSeatId, original = structuredClone(state(created.room.id));
  const edit = { type: 'edit', gameId, edit: { kind: 'gold', seatId, amount: 211 } };
  assert.equal((await command(owner, edit)).code, 'notAllowed');
  for (const type of ['inspect', 'omniscient']) assert.equal((await command(peer, { type, enabled: true })).code, 'notAllowed');
  assert.equal((await command(peer, edit)).code, 'notAllowed'); privateAbsent(peer.view.game); assert.deepEqual(state(created.room.id), original);
  pass('server rejects pre-game enabling, closed-mode owner edits, and forged player inspect or edit commands');

  assert.equal((await command(owner, { type: 'inspect', enabled: true })).ok, true); assert.equal(owner.view.canEdit, true);
  failCommit = true; assert.equal((await command(owner, edit)).code, 'storageFailed'); assert.deepEqual(state(created.room.id), original);
  assert.equal((await command(owner, edit)).ok, true); assert.equal(state(created.room.id).game.seats.find(seat => seat.id === seatId).gold, 211);
  privateAbsent(peer.view.game); assert.equal(peer.view.canEdit, false);
  pass('enabled host edits use the existing authoritative transaction, with failed commits rolling back and peers retaining private projections');

  assert.equal((await command(owner, { type: 'handover' })).ok, true); await wait(() => peer.view.isHost, 'host handover');
  privateAbsent(owner.view.game); assert.equal(owner.view.canEdit, false); assert.equal(peer.view.canEdit, false);
  assert.equal((await command(owner, { type: 'omniscient', enabled: true })).code, 'notAllowed'); assert.equal((await command(owner, edit)).code, 'notAllowed');
  assert.equal((await command(peer, { type: 'omniscient', enabled: true })).ok, true); assert.equal(peer.view.game.omniscient, true);
  pass('handover immediately revokes the old host inspection and editing; the new host must enable its own connection explicitly');

  peer.ws.close(); await wait(() => peer.closed && owner.view.isHost, 'automatic disconnect succession');
  privateAbsent(owner.view.game); assert.equal(owner.view.canEdit, false);
  const rejoined = await raw(joined.session); privateAbsent(rejoined.view.game); assert.equal(rejoined.view.isHost, false);
  assert.equal((await command(rejoined, { type: 'omniscient', enabled: true })).code, 'notAllowed');
  assert.equal((await command(owner, { type: 'omniscient', enabled: true })).ok, true);
  assert.equal((await command(owner, { type: 'handover' })).ok, true); await wait(() => rejoined.view.isHost, 'ownership returns');
  privateAbsent(owner.view.game); assert.equal(owner.view.canEdit, false);
  assert.equal((await command(rejoined, { type: 'inspect', enabled: true })).ok, true);
  await command(rejoined, { type: 'handover' }); await wait(() => owner.view.isHost, 'ownership leaves again');
  await command(owner, { type: 'handover' }); await wait(() => rejoined.view.isHost, 'ownership returns again');
  privateAbsent(rejoined.view.game); assert.equal(rejoined.view.canEdit, false);
  pass('disconnect succession and reconnect clear inspection, and losing then regaining ownership cannot revive a previous inspection flag');

  assert.deepEqual(errors, []); assert.deepEqual(external, []); pass('real website authority checks complete with no script errors or external requests');
} catch (error) { failure = error; }
finally {
  for (const socket of sockets) socket.terminate(); await browser.close(); await service.close(); await new Promise(done => server.close(done));
  const stats = { checks: checks.length, completed: !failure, scope: 'Real loopback website and authoritative service with synthetic data only; no production rooms or accounts.' };
  writeFileSync(join(out, 'result.json'), JSON.stringify({ checks, stats, errors, external, ...(failure ? { failure: { message: failure.message, stack: failure.stack } } : {}) }, null, 2));
  console.log(JSON.stringify(stats)); console.log(out);
}
if (failure) throw failure;
