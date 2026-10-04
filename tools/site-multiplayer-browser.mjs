// Real website UI + WebSocket + a temporary SQLite service. No Owlbear SDK fixture and no production data.
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { readFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'vite';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';
import { finishWebSocketProxy, traceWebSocketFrames } from './site-websocket-fixture.mjs';

const root = resolve(import.meta.dirname, '..'), base = '/three-dragon-ante-dev/';
mkdirSync(join(root, '.local-evidence'), { recursive: true });
const out = mkdtempSync(join(root, '.local-evidence', 'site-multiplayer-')), dist = join(out, 'site');
const checks = [], errors = [], external = [], resourceFailures = [], actors = [], connections = new Map();
const gameplay = { antes: 0, plays: 0, choices: 0, visibleSettlements: 0 };
// Public, bounded fixture diagnostics: no URLs, room codes, capabilities, names or projections.
const transportTrace = [], traceStarted = Date.now(); let transportTraceDropped = 0, nextConnectionId = 0;
const publicActor = key => ['owner', 'player', 'duplicate', 'fresh', 'replacing'].find(label => key === 'TDA-site-browser-' + label) || 'probe';
const tcpTrace = (key, event, socket, code, metadata = {}) => {
  const allowed = ['ECONNRESET', 'EPIPE', 'ECONNREFUSED', 'ERR_STREAM_DESTROYED'];
  transportTrace.push({ actor: publicActor(key), event, ms: Date.now() - traceStarted, destroyed: !!socket?.destroyed, writableBytes: socket?.writableLength || 0, ...(code ? { code: allowed.includes(code) ? code : 'other' } : {}), ...metadata });
  if (transportTrace.length > 160) { transportTrace.shift(); transportTraceDropped++; }
};
async function publicDiagnostics() {
  const browserTrace = await Promise.all(actors.map(async actor => {
    let timer;
    try {
      const value = await Promise.race([actor.page.evaluate(() => {
        const status = document.querySelector('.site-room-identity [role="status"]')?.textContent?.trim();
        const allowed = ['已连接', 'Connected', '座位已在其他窗口连接', 'Seat connected in another window', '连接已失效，请返回首页重连', 'Session expired; return home to reconnect', '连接失败', 'Connection failed', '重连中', 'Reconnecting'];
        return { lang: ['zh-CN', 'en'].includes(document.documentElement.lang) ? document.documentElement.lang : 'other', status: status == null ? null : allowed.includes(status) ? status : 'other', connected: document.querySelector('.site-online-match')?.getAttribute('data-connected') || null, closes: window.__siteSocketCloseDiagnostics || [], socketEvents: window.__siteSocketEventDiagnostics || [], lifecycle: window.__sitePageLifecycleDiagnostics || [], dropped: window.__siteLifecycleDiagnosticsDropped || { socket: 0, page: 0 } };
      }), new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error('Public diagnostic read timed out'); error.name = 'DiagnosticsTimeout'; reject(error); }, 3000); })]);
      return { actor: actor.label, wsAttempts: actor.wsAttempts, ...value };
    } catch (error) { return { actor: actor.label, wsAttempts: actor.wsAttempts, readError: error.name }; }
    finally { clearTimeout(timer); }
  }));
  return { browsers: browserTrace, tcp: transportTrace, dropped: transportTraceDropped };
}
let overlayHelpVerified = false;
const connectionOnly = process.argv.includes('--connection-only') || process.argv.includes('--reconnect-only');
const pass = label => { checks.push(label); console.log('PASS ' + label); };
const wait = async (check, label, timeout = 20000) => {
  const end = Date.now() + timeout;
  while (!await check()) { if (Date.now() > end) throw Error('Timed out: ' + label); await new Promise(done => setTimeout(done, 30)); }
};
await build({ configFile: join(root, 'vite.config.ts'), logLevel: 'warn', plugins: [{
  name: 'local-site-api-only', enforce: 'pre',
  transform(code, id) { if (id.endsWith('/server-endpoint.ts') || id.endsWith('\\server-endpoint.ts')) return code.replaceAll('import.meta.env?.VITE_TDA_API', JSON.stringify('/three-dragon-api/v1')); },
}], build: { outDir: dist, emptyOutDir: true } });
const { createTableService } = await import(pathToFileURL(resolve(process.env.TDA_SERVER_OUT || join(root, 'dist-server'), 'service.mjs')));
const WebSocket = createRequire(join(root, 'server/three-dragon/package.json'))('ws');
let service, upstreamPort;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ogg': 'audio/ogg' };
const staticServer = createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname.startsWith('/three-dragon-api/v1/')) {
    const upstream = httpRequest({ hostname: '127.0.0.1', port: upstreamPort, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); }); req.pipe(upstream); return;
  }
  if (!pathname.startsWith(base)) { res.writeHead(404); res.end(); return; }
  const file = resolve(dist, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
  if ((!file.startsWith(dist + '/') && !file.startsWith(dist + '\\')) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(readFileSync(file));
});
staticServer.on('upgrade', (req, socket, head) => {
  const key = req.headers['user-agent'], connectionId = ++nextConnectionId;
  const upstream = httpRequest({ hostname: '127.0.0.1', port: upstreamPort, path: req.url, headers: req.headers });
  upstream.on('upgrade', (response, backend, backendHead) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n' + Object.entries(response.headers).map(([key, value]) => key + ': ' + value).join('\r\n') + '\r\n\r\n');
    if (backendHead.length) socket.write(backendHead); if (head.length) backend.write(head);
    const entry = { socket, backend }; connections.set(key, entry);
    const trace = (event, target, code, frame) => tcpTrace(key, event, target, code, { connectionId, ...frame });
    trace('upgrade', socket, undefined, { frontendHeadBytes: head.length, backendHeadBytes: backendHead.length });
    traceWebSocketFrames(socket, frame => trace('frame-to-server', socket, undefined, frame), head);
    traceWebSocketFrames(backend, frame => trace('frame-to-client', backend, undefined, frame), backendHead);
    for (const event of ['end', 'finish', 'close']) { socket.on(event, () => trace('frontend-' + event, socket)); backend.on(event, () => trace('backend-' + event, backend)); }
    socket.on('error', error => { trace('frontend-error', socket, error.code); backend.destroy(); }); backend.on('error', error => { trace('backend-error', backend, error.code); socket.destroy(); });
    socket.on('close', () => { backend.destroy(); if (connections.get(key) === entry) connections.delete(key); });
    // The pipe ends the frontend after flushing. Destroying it here can discard queued close frames.
    backend.on('close', () => finishWebSocketProxy(socket)); socket.pipe(backend); backend.pipe(socket);
  });
  upstream.on('error', error => { tcpTrace(key, 'upgrade-error', socket, error.code, { connectionId }); socket.destroy(); }); upstream.end();
});
await new Promise(done => staticServer.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + staticServer.address().port;
async function startService() {
  service = createTableService({ database: join(out, 'game.sqlite'), origin });
  await new Promise(done => service.server.listen(upstreamPort || 0, '127.0.0.1', done)); upstreamPort = service.server.address().port;
}
await startService();
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const state = () => { const row = service.db.prepare('SELECT state FROM rooms ORDER BY updated DESC LIMIT 1').get(); return row ? JSON.parse(row.state) : null; };
const active = actor => actor.page.evaluate(() => JSON.parse(sessionStorage.getItem('three-dragon-site-active.v1')));
function wirePacket(actor, raw) {
  const packet = JSON.parse(raw.toString());
  if (packet.type === 'view') actor.wire = packet.view;
  else if (packet.type === 'patch' && actor.wire) {
    const patch = (before, value) => { const after = { ...before, ...value.set }; for (const key of value.remove) delete after[key]; return after; };
    const next = patch(actor.wire, packet.patch); next.game = packet.gamePatch ? patch(actor.wire.game, packet.gamePatch) : packet.game; actor.wire = next;
  }
  const game = actor.wire?.game;
  if (game) {
    assert.equal(game.omniscient, undefined, 'guest cannot receive an omniscient projection');
    assert.equal(game.deck, undefined, 'guest cannot receive the deck');
    for (const seat of game.seats) assert.equal(seat.hand, undefined, 'opponent seats contain public hand counts only');
    actor.privateFrames++;
  }
}
async function actor(label, narrow = false) {
  const value = { label, privateFrames: 0, wsAttempts: 0, beforeUnloadPrompts: 0, wire: null }, context = await browser.newContext({ userAgent: 'TDA-site-browser-' + label, locale: 'zh-CN', viewport: narrow ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: narrow, hasTouch: narrow, reducedMotion: 'reduce' });
  await context.addInitScript(started => {
    const closes = window.__siteSocketCloseDiagnostics = [];
    // Fixed public states only; no URLs, event text, room/player identifiers or payloads.
    const socketEvents = window.__siteSocketEventDiagnostics = [], lifecycle = window.__sitePageLifecycleDiagnostics = [];
    const dropped = window.__siteLifecycleDiagnosticsDropped = { socket: 0, page: 0 };
    const statusKind = () => {
      const value = document.querySelector('.site-room-identity [role="status"]')?.textContent?.trim();
      if (value == null) return 'none';
      const groups = [
        ['connected', ['已连接', 'Connected']],
        ['replaced', ['座位已在其他窗口连接', 'Seat connected in another window']],
        ['expired', ['连接已失效，请返回首页重连', 'Session expired; return home to reconnect']],
        ['failed', ['连接失败', 'Connection failed']],
        ['reconnecting', ['重连中', 'Reconnecting']],
      ];
      return groups.find(([, texts]) => texts.includes(value))?.[0] || 'other';
    };
    const documentState = () => ({ visibility: ['visible', 'hidden', 'prerender'].includes(document.visibilityState) ? document.visibilityState : 'other', hasFocus: document.hasFocus(), documentReady: ['loading', 'interactive', 'complete'].includes(document.readyState) ? document.readyState : 'other', status: statusKind(), connected: ['true', 'false'].includes(document.querySelector('.site-online-match')?.getAttribute('data-connected')) ? document.querySelector('.site-online-match').getAttribute('data-connected') : null });
    const record = (list, kind, value) => { list.push({ ms: Date.now() - started, ...value }); if (list.length > 32) { list.shift(); dropped[kind]++; } };
    const recordLifecycle = event => record(lifecycle, 'page', { event, ...documentState() });
    for (const event of ['visibilitychange', 'readystatechange', 'DOMContentLoaded']) document.addEventListener(event, () => recordLifecycle(event));
    for (const event of ['focus', 'blur', 'pageshow', 'pagehide']) window.addEventListener(event, () => recordLifecycle(event));
    recordLifecycle('init');
    let nextSocketId = 0;
    const recordSocket = (event, socket, socketId) => record(socketEvents, 'socket', { event, socketId, readyState: socket.readyState, ...documentState() });
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(...args) {
        super(...args);
        const socketId = ++nextSocketId; recordSocket('create', this, socketId);
        let openedMs = null;
        this.addEventListener('open', () => { openedMs = Date.now() - started; recordSocket('open', this, socketId); });
        this.addEventListener('close', event => {
          const allowed = ['authenticationRequired', 'notAllowed', 'sessionReplaced', 'roomMissing', 'protocolMismatch'];
          closes.push({ ms: Date.now() - started, openedMs, code: event.code, wasClean: event.wasClean, reason: !event.reason ? '' : allowed.includes(event.reason) ? event.reason : 'other' });
          if (closes.length > 16) closes.shift();
          recordSocket('close', this, socketId);
        });
      }
    };
  }, traceStarted);
  value.context = context; value.page = await context.newPage(); actors.push(value);
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  value.page.on('pageerror', error => errors.push(value.label + ': ' + error.message));
  value.page.on('dialog', async dialog => { if (dialog.type() === 'beforeunload') { value.beforeUnloadPrompts++; await dialog.accept(); } else { errors.push(value.label + ': unexpected native ' + dialog.type() + ' dialog'); await dialog.dismiss(); } });
  value.page.on('response', response => { if (response.status() >= 400 && !response.url().includes('/three-dragon-api/') && !response.url().endsWith('/favicon.ico')) resourceFailures.push(response.status() + ' ' + response.url()); });
  value.page.on('websocket', socket => { value.wsAttempts++; assert.ok(socket.url().startsWith(origin.replace('http', 'ws') + '/'), 'all WebSockets stay on the local test origin'); socket.on('framereceived', event => { try { wirePacket(value, event.payload); } catch (error) { errors.push(value.label + ': ' + error.message); } }); });
  return value;
}
async function connected(actor) { await actor.page.locator('.site-online-match[data-connected="true"]').waitFor({ timeout: 30000 }); }
async function fillName(actor, name) { const input = actor.page.locator('#guest-name'); await input.click(); await input.fill(name); }
async function leaveRoom(actor, verifyCancel = false) {
  const before = JSON.stringify(state()), saved = await active(actor), transport = connections.get('TDA-site-browser-' + actor.label);
  await actor.page.getByTestId('leave-room').click();
  const dialog = actor.page.getByTestId('leave-confirmation');
  if (verifyCancel) {
    await dialog.waitFor(); assert.equal(await dialog.getAttribute('role'), 'dialog'); assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    await actor.page.getByTestId('leave-cancel').click(); await connected(actor);
    assert.equal(await dialog.count(), 0); assert.equal(JSON.stringify(state()), before);
    assert.deepEqual(await active(actor), saved); assert.equal(connections.get('TDA-site-browser-' + actor.label), transport);
    await actor.page.getByTestId('leave-room').click(); await dialog.waitFor();
  }
  if (await dialog.isVisible()) await actor.page.getByTestId('leave-confirm').click();
  await actor.page.locator('#guest-name').waitFor();
}
async function topbarControls(actor, label) {
  const before = JSON.stringify(state()), help = actor.page.getByTestId('table-help'), sound = actor.page.getByTestId('table-sound'), language = actor.page.getByTestId('table-language');
  await help.click(); await actor.page.getByTestId('table-help-panel').waitFor();
  assert.equal(await help.getAttribute('aria-pressed'), 'true');
  await actor.page.getByTestId('table-help-close').click(); assert.equal(await actor.page.getByTestId('table-help-panel').count(), 0);
  const prior = await sound.getAttribute('aria-pressed'); await sound.click(); assert.notEqual(await sound.getAttribute('aria-pressed'), prior);
  assert.equal(await actor.page.evaluate(() => localStorage.getItem('three-dragon-ante.sound.v2')), prior === 'true' ? 'off' : 'on');
  await sound.click(); assert.equal(await sound.getAttribute('aria-pressed'), prior);
  await language.click(); await actor.page.getByTestId('leave-room').filter({ hasText: 'Home' }).waitFor();
  assert.equal(await actor.page.evaluate(() => document.documentElement.lang), 'en');
  await language.click(); await actor.page.getByTestId('leave-room').filter({ hasText: '返回首页' }).waitFor();
  assert.equal(await actor.page.evaluate(() => document.documentElement.lang), 'zh-CN');
  assert.equal(JSON.stringify(state()), before);
  pass(`${label} help, sound and English controls accept real pointer clicks while preserving the room`);
}
async function dismiss(actor) {
  for (const selector of ['.tda-spotlight', '.tda-formation-spot']) {
    const overlay = actor.page.locator(selector).first();
    if (await overlay.isVisible()) {
      if (!overlayHelpVerified) {
        const before = JSON.stringify(state()), description = await overlay.textContent();
        await actor.page.getByTestId('table-help').click(); await actor.page.getByTestId('table-help-panel').waitFor();
        assert.equal(await overlay.isVisible(), true);
        await actor.page.getByTestId('table-help-close').click();
        assert.equal(await actor.page.getByTestId('table-help-panel').count(), 0);
        assert.equal(await overlay.isVisible(), true); assert.equal(await overlay.textContent(), description);
        assert.equal(JSON.stringify(state()), before);
        overlayHelpVerified = true;
        pass('help opens and closes above a real ability/formation overlay without dismissing the ongoing presentation or changing the game');
      }
      await overlay.locator('[data-dismiss-hint]').click(); return true;
    }
  }
  return false;
}
async function submitCard(actor, kind = 'ante') {
  while (await dismiss(actor)) await actor.page.waitForTimeout(100);
  await actor.page.waitForFunction(kind => document.querySelector('.tda-shell')?.getAttribute('data-phase') === kind && document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false' && document.querySelectorAll('.tda-card--hand.is-legal').length > 0, kind);
  const ready = actor.wire?.game?.handPowerHints?.filter(hint => hint.state === 'power-ready').map(hint => hint.cardId) || [];
  const preferred = kind === 'play' ? ready.find(id => /^(blue-|bronze-|red-|white-|copper-trickster|silver-seer|prophet|sorcerer|kobold|illusionist)/.test(id)) : null;
  const card = preferred ? actor.page.locator('.tda-card--hand.is-legal[data-card="' + preferred + '"]') : actor.page.locator('.tda-card--hand.is-legal').last(), id = await card.getAttribute('data-card');
  const revision = state().game.revision; await card.focus(); await actor.page.keyboard.press('Space'); await actor.page.keyboard.press('Enter');
  await wait(() => state().game.revision > revision, kind + ' via website keyboard');
  await actor.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-pending-action') === 'false'); return id;
}
async function rejectedOldToken(roomId, token) {
  await new Promise((done, reject) => {
    const socket = new WebSocket(origin.replace('http', 'ws') + '/three-dragon-api/v1/socket', { origin });
    const timer = setTimeout(() => { socket.terminate(); reject(Error('Old token rejection timed out')); }, 10000);
    socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', room: roomId, token })));
    socket.on('message', () => { clearTimeout(timer); socket.terminate(); reject(Error('Old token accepted')); });
    socket.on('close', code => { clearTimeout(timer); if (code !== 1008) reject(Error('Old token closed with unexpected code ' + code)); else done(); }); socket.on('error', reject);
  });
}
async function finishGambit(peers) {
  const end = Date.now() + 180000;
  while (Date.now() < end) {
    for (const actor of peers) { await dismiss(actor); if (await actor.page.locator('.tda-score').isVisible()) gameplay.visibleSettlements++; }
    if (state().game.lastGambit?.number >= 1 && gameplay.choices > 0 && gameplay.visibleSettlements > 0) return;
    if (state().game.stage === 'ended') throw Error('Game ended before a visible settlement with an ability choice');
    let moved = false;
    for (const actor of peers) {
      const current = state().game, own = actor.wire?.game;
      if (own?.revision !== current.revision || await actor.page.locator('.tda-shell').getAttribute('data-busy') !== 'false') continue;
      const action = own.actions?.[0]; if (!action) continue;
      if (action.kind === 'choose') {
        if (!await actor.page.locator('.tda-choice').isVisible()) continue;
        const options = action.choice.options.filter(option => option.id !== 'skip' && !['KEEP_CARD', 'SKIP_POWER', 'DO_NOT_COPY'].includes(option.code));
        const select = (options.length ? options : action.choice.options).slice(0, Math.max(action.choice.min, Math.min(1, action.choice.max)));
        for (const option of select) await actor.page.locator('.tda-choice [data-option="' + option.id + '"]').click();
        await actor.page.locator('#confirm-action:not([disabled])').click();
        await wait(() => state().game.revision > current.revision, 'ability choice from website'); gameplay.choices++;
      } else {
        await submitCard(actor, action.kind); gameplay[action.kind === 'ante' ? 'antes' : 'plays']++;
      }
      moved = true; break;
    }
    if (!moved) await new Promise(done => setTimeout(done, 100));
  }
  throw Error('Timed out: full website gambit, ability choice and visible settlement');
}
try {
  const owner = await actor('owner'), player = await actor('player', true), duplicate = await actor('duplicate');
  await owner.page.goto(origin + base);
  assert.equal(await owner.page.getByRole('button', { name: '开始', exact: true }).count(), 0);
  await fillName(owner, '甲'); await owner.page.getByRole('button', { name: '创建房间', exact: true }).click(); await connected(owner);
  const originalOwner = await active(owner), roomCode = await owner.page.getByTestId('online-room-code').textContent();
  assert.match(roomCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  const invitation = await owner.page.getByRole('textbox', { name: '邀请链接', exact: true }).inputValue();
  assert.equal(new URL(invitation).search, '?room=' + roomCode); assert.ok(!invitation.includes(originalOwner.session.token));
  pass('online-only website creates a unique coded room and a token-free invite without a local game');
  await player.page.goto(invitation); assert.equal(await player.page.locator('#guest-room-code').inputValue(), roomCode);
  await fillName(player, '乙'); await player.page.getByRole('button', { name: '加入房间', exact: true }).click(); await connected(player);
  await wait(() => state()?.table.seats.length === 2, 'both named seats'); const originalPlayer = await active(player);
  await duplicate.page.goto(invitation); await fillName(duplicate, ' 甲 '); const beforeDuplicate = JSON.stringify(state());
  await duplicate.page.getByRole('button', { name: '加入房间', exact: true }).click(); await duplicate.page.getByRole('alert').filter({ hasText: '名字已占用' }).waitFor();
  assert.equal(JSON.stringify(state()), beforeDuplicate); assert.equal(await duplicate.page.locator('.site-online-match').count(), 0);
  await duplicate.page.getByRole('button', { name: '重连房间', exact: true }).click(); await duplicate.page.getByRole('alert').filter({ hasText: '名字已占用' }).waitFor();
  assert.equal(JSON.stringify(state()), beforeDuplicate);
  pass('invite joins a narrow browser; ordinary and explicit name-only duplicate entry cannot claim an online seat');
  await topbarControls(owner, 'Desktop lobby'); await topbarControls(player, 'Narrow lobby');
  await owner.page.locator('.tda-setup input[type="number"]').first().fill('500');
  await owner.page.locator('#deck-choice').selectOption('wheel-of-fate-v1'); await owner.page.getByRole('button', { name: '开始', exact: true }).click();
  await wait(() => state()?.game?.variant.deckId === 'wheel-of-fate-v1', 'authoritative deal');
  for (const actor of [owner, player]) {
    await actor.page.locator('.tda-card--hand[data-card]').first().waitFor({ state: 'attached' });
    await wait(() => actor.wire?.game?.hand?.length > 0, 'private frame');
    const mine = actor.wire.game.selfSeatId, actual = state().game.seats.find(seat => seat.id === mine).hand;
    assert.deepEqual(actor.wire.game.hand, actual);
    const leak = await actor.page.evaluate(mine => ({ ids: document.querySelectorAll('.tda-card--hand[data-card]:not([data-seat="' + mine + '"])').length, faceUp: [...document.querySelectorAll('.tda-card--hand:not([data-seat="' + mine + '"])')].filter(node => !node.classList.contains('is-face-down')).length }), mine);
    assert.equal(leak.ids, 0); assert.equal(leak.faceUp, 0); assert.equal(await actor.page.locator('#omniscient-toggle').isVisible(), false);
  }
  pass('two browser deals have exact own hands, anonymous opponents and no omniscient capability');
  await topbarControls(owner, 'Desktop active table'); await topbarControls(player, 'Narrow active table');
  const beforeNewGame = JSON.stringify(state());
  await owner.page.getByTestId('table-new-game').click(); await owner.page.getByTestId('new-game-confirmation').waitFor();
  await owner.page.getByTestId('new-game-cancel').click(); assert.equal(JSON.stringify(state()), beforeNewGame);
  pass('new-game control is reachable during play and cancel keeps the current authoritative deal');
  let finalActor = owner;
  if (!connectionOnly) {
  const revealDeadline = Date.now() + 60000;
  do {
    await submitCard(player); await submitCard(owner); gameplay.antes += 2;
    if (state().game.stage !== 'ante') break;
    assert.ok(state().game.events.some(event => event.code === 'ANTE_ALL_TIED'), 'both acknowledged antes can repeat only after an authoritative tie');
    if (Date.now() > revealDeadline) throw Error('Timed out: repeated tied antes through the website');
    console.log('INFO authoritative tied antes; both browsers choose again');
  } while (true);
  await wait(() => state().game.stage !== 'ante', 'reveal accepted');
  for (const actor of [owner, player]) await wait(async () => { await dismiss(actor); return ['play', 'choice'].includes(await actor.page.locator('.tda-shell').getAttribute('data-phase')); }, 'visible ante reveal');
  const current = [owner, player].find(actor => actor.wire?.game?.selfSeatId === state().game.seats[state().game.active].id);
  await submitCard(current, 'play');
  gameplay.plays = 1;
  pass('named clients submit both antes, reveal and a legal play through the complete website UI and action ACKs');
  const revision = state().game.revision, hand = [...state().game.seats.find(seat => seat.id === originalPlayer.session.memberId).hand];
  const promptsBeforeRefresh = player.beforeUnloadPrompts;
  await player.page.reload(); await connected(player); await player.page.locator('.tda-card--hand[data-card]').first().waitFor();
  assert.equal(player.beforeUnloadPrompts, promptsBeforeRefresh + 1, 'in-progress refresh asks the browser to confirm navigation');
  assert.equal((await active(player)).session.memberId, originalPlayer.session.memberId); assert.equal(state().game.revision, revision);
  assert.deepEqual(state().game.seats.find(seat => seat.id === originalPlayer.session.memberId).hand, hand);
  assert.equal(state().table.hostPlayerId, originalOwner.session.memberId);
  pass('refresh restores the same private hand and seat without redealing or handing away the owner');
  const transport = connections.get('TDA-site-browser-player'); assert.ok(transport); transport.backend.destroy(); transport.socket.destroy();
  await wait(() => !connections.has('TDA-site-browser-player'), 'physical transport lost');
  await wait(() => connections.has('TDA-site-browser-player') && player.wire?.game?.revision === revision, 'automatic transport reconnect', 30000); await connected(player);
  assert.equal((await active(player)).session.memberId, originalPlayer.session.memberId); assert.equal(state().game.revision, revision);
  pass('a severed TCP/WebSocket transport reconnects automatically to the same authoritative seat');
  const durable = JSON.stringify(state()); await service.close(); await startService();
  await wait(() => service.stats().sockets === 2, 'both clients reconnect after server restart', 30000);
  await connected(owner); await connected(player); assert.equal(JSON.stringify(state()), durable);
  pass('server restart restores persisted SQLite state and both live browser sessions');
  await leaveRoom(owner, true);
  await wait(() => state().table.hostPlayerId === originalPlayer.session.memberId, 'automatic owner succession after disconnect', 30000);
  assert.equal(state().game.revision, revision); assert.deepEqual(state().game.seats.find(seat => seat.id === originalPlayer.session.memberId).hand, hand);
  await owner.page.getByRole('button', { name: '加入房间', exact: true }).click(); await owner.page.getByRole('alert').filter({ hasText: '名字已占用' }).waitFor();
  await owner.page.getByRole('button', { name: '重连房间', exact: true }).click(); await connected(owner);
  const ownerReconnected = await active(owner); assert.equal(ownerReconnected.session.memberId, originalOwner.session.memberId); assert.notEqual(ownerReconnected.session.token, originalOwner.session.token);
  await rejectedOldToken(originalOwner.room.id, originalOwner.session.token); assert.equal(state().table.hostPlayerId, originalPlayer.session.memberId);
  pass('owner disconnect preserves the game and transfers ownership; explicit cached reconnect rotates and revokes the old token');
  pass('in-progress exit requires a second dialog; cancel leaves the same connection, seat and game intact');
  await leaveRoom(owner); await wait(() => service.stats().sockets === 1, 'owner fully offline');
  const fresh = await actor('fresh'); await fresh.page.goto(invitation); await fillName(fresh, '甲');
  await fresh.page.getByRole('button', { name: '加入房间', exact: true }).click(); await fresh.page.getByRole('alert').filter({ hasText: '名字已占用' }).waitFor();
  await fresh.page.getByRole('button', { name: '重连房间', exact: true }).click(); await connected(fresh);
  assert.equal((await active(fresh)).session.memberId, originalOwner.session.memberId); await rejectedOldToken(originalOwner.room.id, ownerReconnected.session.token);
  assert.equal(state().game.revision, revision);
  pass('code plus name explicitly restores an offline seat in a fresh browser without an account or a saved capability');
  await finishGambit([player, fresh]);
  assert.ok(gameplay.choices >= 1); assert.ok(state().game.lastGambit?.number >= 1); assert.ok(gameplay.visibleSettlements >= 1);
  assert.equal(overlayHelpVerified, true, 'a real gameplay overlay must exercise the help controls');
  pass('both named seats continue a complete gambit through real ability choices and a visible authoritative settlement');
  finalActor = fresh;
  }
  if (process.argv.includes('--reconnect-only')) {
    await leaveRoom(owner); await wait(() => service.stats().sockets === 1, 'owner offline before fresh browser recovery');
    const fresh = await actor('fresh'); await fresh.page.goto(invitation); await fillName(fresh, '甲');
    await fresh.page.getByRole('button', { name: '重连房间', exact: true }).click(); await connected(fresh); finalActor = fresh;
  }
  if (!process.argv.includes('--connection-only')) {
    const beforeStaleReconnect = JSON.stringify(state());
    const expiredSession = await owner.page.evaluate(code => JSON.parse(localStorage.getItem('three-dragon-site-session.v1:' + code + ':甲')), roomCode);
    assert.ok(expiredSession); const attemptsBeforeRefresh = owner.wsAttempts;
    await owner.page.evaluate(saved => sessionStorage.setItem('three-dragon-site-active.v1', JSON.stringify(saved)), expiredSession); await owner.page.reload();
    console.log('PUBLIC expired-session-wait ' + JSON.stringify({ ms: Date.now() - traceStarted, checks: checks.length, wsAttempts: owner.wsAttempts, attemptsBeforeRefresh, transportEvents: transportTrace.length, transportDropped: transportTraceDropped }));
    await owner.page.locator('.site-room-identity [role="status"]').filter({ hasText: '连接已失效，请返回首页重连' }).waitFor();
    assert.equal(await owner.page.getByRole('button', { name: '重试连接', exact: true }).count(), 0); await owner.page.waitForTimeout(1600);
    assert.equal(owner.wsAttempts, attemptsBeforeRefresh + 1); assert.equal(JSON.stringify(state()), beforeStaleReconnect);
    await leaveRoom(owner);
    await owner.page.getByRole('button', { name: '重连房间', exact: true }).click();
    await owner.page.getByRole('alert').filter({ hasText: '名字已占用' }).waitFor(); assert.equal(JSON.stringify(state()), beforeStaleReconnect);
    const rotatingSession = await active(finalActor); await leaveRoom(finalActor); await wait(() => service.stats().sockets === 1, 'rotated-name seat fully offline');
    await owner.page.getByRole('button', { name: '重连房间', exact: true }).click(); await connected(owner);
    const recovered = await active(owner); assert.equal(recovered.session.memberId, originalOwner.session.memberId); assert.notEqual(recovered.session.token, rotatingSession.session.token);
    await rejectedOldToken(originalOwner.room.id, rotatingSession.session.token); assert.equal(JSON.stringify(state()), beforeStaleReconnect);
    finalActor = owner;
    pass('refresh with an expired stored session stops after one rejected WebSocket auth, shows the expiry and recovers through an explicit home reconnect');
    pass('explicit reconnect with an expired saved token falls back once to an offline name and still rejects an online name without changing the seat');
  }
  const replacing = await actor('replacing'), sameCapability = await active(finalActor);
  await replacing.context.addInitScript(saved => sessionStorage.setItem('three-dragon-site-active.v1', JSON.stringify(saved)), sameCapability);
  const beforeReplacement = JSON.stringify(state()); await replacing.page.goto(invitation); await connected(replacing);
  await finalActor.page.locator('.site-room-identity [role="status"]').filter({ hasText: '座位已在其他窗口连接' }).waitFor();
  assert.equal(await finalActor.page.getByRole('button', { name: '重试连接', exact: true }).count(), 0);
  const stableConnection = connections.get('TDA-site-browser-replacing'); assert.ok(stableConnection);
  await replacing.page.waitForTimeout(2500);
  assert.equal(await finalActor.page.locator('.site-online-match').getAttribute('data-connected'), 'false');
  assert.equal(connections.has('TDA-site-browser-' + finalActor.label), false); assert.equal(connections.get('TDA-site-browser-replacing'), stableConnection);
  assert.equal(JSON.stringify(state()), beforeReplacement); assert.equal((await active(replacing)).session.memberId, sameCapability.session.memberId);
  pass('a duplicate saved-capability window replaces the old connection once; the old window stops retrying and the new window stays stable');
  for (const actor of [player, replacing]) { assert.equal(await actor.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await actor.page.screenshot({ path: join(out, actor.label + '.png') }); }
  const membersBeforeReset = state().table.seats.map(seat => seat.id), ownerBeforeReset = state().table.hostPlayerId;
  assert.equal(ownerBeforeReset, connectionOnly ? originalOwner.session.memberId : originalPlayer.session.memberId);
  const resetActor = [player, replacing].find(actor => actor.wire?.game?.selfSeatId === ownerBeforeReset); assert.ok(resetActor);
  await resetActor.page.getByTestId('table-new-game').click(); await resetActor.page.getByTestId('new-game-confirmation').waitFor();
  await resetActor.page.getByTestId('new-game-confirm').click(); await wait(() => state().game === null, 'confirmed new game returns to server lobby');
  await resetActor.page.locator('.tda-setup').waitFor();
  assert.deepEqual(state().table.seats.map(seat => seat.id), membersBeforeReset); assert.equal(state().table.hostPlayerId, ownerBeforeReset);
  assert.equal((await active(player)).session.memberId, originalPlayer.session.memberId); await connected(player); await connected(replacing);
  await resetActor.page.getByRole('button', { name: '开始', exact: true }).click(); await wait(() => state().game?.stage === 'ante', 'a new deal through the same room');
  for (const actor of [player, replacing]) await actor.page.locator('.tda-card--hand[data-card]').first().waitFor();
  pass('confirmed new-game command returns to the authoritative lobby and redeals in the same named room without replacing seats');
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(resourceFailures, []);
  pass('desktop and narrow online pages have no page errors, failed assets, horizontal overflow or external requests');
  writeFileSync(join(out, 'result.json'), JSON.stringify({ checks, gameplay, connectionOnly, diagnostics: await publicDiagnostics(), errors, external, resourceFailures, privateFrames: actors.reduce((sum, actor) => sum + actor.privateFrames, 0), realOwlbearRoom: false, scope: 'Isolated production website build; real desktop/narrow browsers, local WebSocket proxy and temporary SQLite. No production room or real Owlbear account.' }, null, 2) + '\n'); console.log(out);
} catch (error) {
  for (const actor of actors) if (!actor.page.isClosed()) await actor.page.screenshot({ path: join(out, actor.label + '-failure.png') }).catch(() => {});
  writeFileSync(join(out, 'failure.json'), JSON.stringify({ error: String(error), checks, diagnostics: await publicDiagnostics(), errors, external, resourceFailures }, null, 2)); console.log(out); throw error;
} finally {
  await browser.close(); await service.close();
  for (const { socket, backend } of connections.values()) { socket.destroy(); backend.destroy(); }
  await new Promise(done => staticServer.close(done));
}
