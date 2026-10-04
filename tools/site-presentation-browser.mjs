// Real React website, real WebSocket receipts and finite animations. Every room and database is synthetic.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build as buildSite } from 'vite';
import { build as buildServer } from 'rolldown';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';
import { traceWebSocketFrames } from './site-websocket-fixture.mjs';

const root = resolve(import.meta.dirname, '..'), base = '/three-dragon-ante-dev/';
const baseline = process.argv.includes('--baseline-presenter');
const evidenceRoot = join(root, '.local-evidence/site-presentation'); mkdirSync(evidenceRoot, { recursive: true });
const out = mkdtempSync(join(evidenceRoot, baseline ? 'baseline-' : 'run-')), dist = join(out, 'site');
const checks = [], measurements = [], errors = [], external = [], actors = [];
const transportDiagnostics = []; let nextConnectionId = 0, droppedTransportDiagnostics = 0;
const traceTransport = value => {
  if (transportDiagnostics.length < 64) transportDiagnostics.push({ ms: Date.now(), ...value });
  else droppedTransportDiagnostics++;
};
const safeErrorKind = error => ['TimeoutError', 'AssertionError', 'Error', 'TypeError', 'SyntaxError', 'TargetClosedError'].includes(error?.name) ? error.name : 'OtherError';
let service, failure, stage = 'build';
const pass = label => { checks.push(label); console.log('PASS ' + label); };
const wait = async (check, label, timeout = 30000) => {
  const deadline = Date.now() + timeout;
  while (!await check()) { if (Date.now() > deadline) throw Error('Timed out: ' + label); await new Promise(done => setTimeout(done, 20)); }
};
await buildServer({ input: join(root, 'server/three-dragon/service.mjs'), platform: 'node', external: [/^node:/], output: { file: join(out, 'service.mjs'), format: 'esm', codeSplitting: false }, logLevel: 'warn' });
await buildServer({ input: join(root, 'extensions/three-dragon-ante/src/game/rules/index.ts'), platform: 'node', external: [/^node:/], output: { file: join(out, 'rules.mjs'), format: 'esm', codeSplitting: false }, logLevel: 'warn' });
const oldPresenter = baseline ? execFileSync('git', ['show', 'd7a4232:extensions/three-dragon-ante/src/presentation/app/presenter.ts'], { cwd: root, encoding: 'utf8', windowsHide: true }) : null;
await buildSite({ configFile: join(root, 'vite.config.ts'), logLevel: 'warn', plugins: [{ name: 'loopback-api-and-optional-baseline', enforce: 'pre', transform(code, id) {
  if (id.endsWith('/server-endpoint.ts') || id.endsWith('\\server-endpoint.ts')) return code.replaceAll('import.meta.env?.VITE_TDA_API', JSON.stringify('/three-dragon-api/v1'));
  if (oldPresenter && (id.endsWith('/presentation/app/presenter.ts') || id.endsWith('\\presentation\\app\\presenter.ts'))) return oldPresenter;
} }], build: { outDir: dist, emptyOutDir: true } });
const { createTableService } = await import(pathToFileURL(join(out, 'service.mjs')));
const rules = await import(pathToFileURL(join(out, 'rules.mjs')));
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
service = createTableService({ database: ':memory:', origin });
server.on('upgrade', (req, socket, head) => {
  const connectionId = ++nextConnectionId, outgoing = new EventEmitter();
  traceTransport({ connectionId, kind: 'upgrade', headBytes: head.length });
  socket.once('data', () => traceTransport({ connectionId, kind: 'first-client-data' }));
  traceWebSocketFrames(socket, frame => traceTransport({ connectionId, kind: 'client-frame', ...frame }), head);
  traceWebSocketFrames(outgoing, frame => traceTransport({ connectionId, kind: 'server-write-frame', ...frame }));
  // Observe existing writes; preserve all native arguments, callbacks and return values.
  // A write timestamp is not evidence of browser delivery or authentication decoding.
  const nativeWrite = socket.write; let upgraded = false;
  socket.write = function(...args) {
    const result = Reflect.apply(nativeWrite, this, args), chunk = args[0];
    if (!upgraded) { if (typeof chunk === 'string' && chunk.startsWith('HTTP/1.1 101')) upgraded = true; }
    else outgoing.emit('data', Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof args[1] === 'string' ? args[1] : undefined));
    return result;
  };
  socket.once('close', () => { traceTransport({ connectionId, kind: 'close' }); socket.write = nativeWrite; outgoing.removeAllListeners(); });
  service.server.emit('upgrade', req, socket, head);
});
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const post = async (path, value) => {
  const response = await fetch(origin + '/three-dragon-api/v1' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.ok(response.ok, 'synthetic admission succeeds'); return response.json();
};
const state = room => JSON.parse(service.db.prepare('SELECT state FROM rooms WHERE id=?').get(room).state);
const fresh = (before, after) => after.history.filter(entry => entry.sequence > (before.history.at(-1)?.sequence || 0)).map(entry => entry.event);
function apply(state, move) {
  const result = rules.applyAction(state, { id: 'fixture-' + state.revision, revision: state.revision, ...move });
  assert.ok(result.ok, 'the fixture advances through an accepted pure rules action'); return result.state;
}
function fixture(seats, kind) {
  for (let seed = 1; seed <= 1000; seed++) {
    let game = rules.createGame({ id: 'synthetic-' + kind + '-' + seed, seats, seed, startingGold: 200, startingHand: kind === 'purchase' ? 3 : 6, variant: { ruleSetId: 'provided-pack-20260910', deckId: 'wheel-of-fate-v1' } });
    // These are legal opening actions. Prefer the peer as first leader so "own" means a normal player too.
    for (const [index, seat] of game.seats.entries()) {
      const ids = [...rules.eligibleActions(game, seat.id)[0].cardIds].sort((a, b) => rules.card(a).strength - rules.card(b).strength);
      game = apply(game, { seatId: seat.id, kind: 'ante', cardId: index === 0 ? ids[0] : ids.at(-1) });
    }
    if (game.stage !== 'play' || game.pending || game.active !== 1) continue;
    for (let step = 0; step < 50; step++) {
      const seat = game.seats.find(seat => rules.eligibleActions(game, seat.id).length);
      if (!seat) break;
      const action = rules.eligibleActions(game, seat.id)[0];
      if (action.kind === 'choose') {
        game = apply(game, { seatId: seat.id, kind: 'choose', choiceId: action.choice.id, optionIds: action.choice.options.slice(0, action.choice.min).map(option => option.id) }); continue;
      }
      if (action.kind !== 'play') break;
      const candidates = action.cardIds.map(cardId => {
        const move = { seatId: seat.id, kind: 'play', cardId }, next = apply(game, move), events = fresh(game, next);
        return { before: game, after: next, move, events };
      });
      const found = candidates.find(value => {
        if (value.after.pending || value.after.stage === 'adjudication') return false;
        const has = code => value.events.some(event => event.code === code);
        if (kind === 'power') return step === 0 && seat.id === seats[1].id && rules.card(value.move.cardId).family === 'black' && has('POWER_TRIGGERED') && !has('BUY_PRICE') && !has('GAMBIT_SCORED') && value.after.active !== value.before.active;
        if (kind === 'round') return value.after.round === value.before.round + 1 && value.after.gambit === value.before.gambit && !has('POWER_TRIGGERED') && !has('BUY_PRICE') && !has('GAMBIT_SCORED');
        if (kind === 'score') return has('GAMBIT_SCORED') && !has('POWER_TRIGGERED') && !has('BUY_PRICE') && !has('SPECIAL_FLIGHT');
        return has('BUY_PRICE') && !has('POWER_TRIGGERED') && !has('GAMBIT_SCORED') && value.events.filter(event => event.code === 'BUY_PRICE').length === 1;
      });
      if (found) { assert.deepEqual(rules.checkInvariants(found.before), []); assert.deepEqual(rules.checkInvariants(found.after), []); return found; }
      if (kind === 'power') break;
      const preferred = candidates.find(value => !value.after.pending && !value.events.some(event => ['POWER_TRIGGERED', 'GAMBIT_SCORED', 'SPECIAL_FLIGHT'].includes(event.code))) || candidates.find(value => !value.after.pending) || candidates[0];
      game = preferred.after;
      if (preferred.events.some(event => event.code === 'GAMBIT_SCORED') || game.stage === 'ended') break;
    }
  }
  throw Error('No legal deterministic fixture: ' + kind);
}
async function actor(admission) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN', reducedMotion: 'no-preference' });
  await context.addInitScript(saved => {
    sessionStorage.setItem('three-dragon-site-active.v1', JSON.stringify(saved));
    const socketDiagnostics = window.__presentationSocketDiagnostics = { events: [], dropped: 0 };
    const recordSocket = value => { if (socketDiagnostics.events.length < 16) socketDiagnostics.events.push({ ms: Date.now(), ...value }); else socketDiagnostics.dropped++; };
    const NativeSocket = window.WebSocket; let socketId = 0;
    window.WebSocket = class extends NativeSocket {
      constructor(...args) {
        super(...args); this.diagnosticId = ++socketId;
        this.addEventListener('open', () => recordSocket({ socketId: this.diagnosticId, kind: 'open' }));
        this.addEventListener('close', event => {
          const allowed = ['authenticationRequired', 'notAllowed', 'sessionReplaced', 'roomMissing', 'protocolMismatch', 'slowConsumer', 'publicationFailed', 'temporarilyUnavailable'];
          recordSocket({ socketId: this.diagnosticId, kind: 'close', code: event.code, wasClean: event.wasClean, reason: !event.reason ? '' : allowed.includes(event.reason) ? event.reason : 'other' });
        });
      }
      send(...args) {
        let auth = false; try { auth = typeof args[0] === 'string' && JSON.parse(args[0]).type === 'auth'; } catch {}
        const result = super.send(...args);
        if (auth) recordSocket({ socketId: this.diagnosticId, kind: 'auth-send', sent: true });
        return result;
      }
    };
    const probe = window.__presentationProbe = { active: false, events: [], seen: {}, fxDraws: 0 };
    const nativeDraw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(...args) { if (probe.active && this.canvas.classList.contains('tda-fx')) probe.fxDraws++; return Reflect.apply(nativeDraw, this, args); };
    const scan = () => {
      if (!probe.active) return;
      const flags = {
        power: !!document.querySelector('.tda-spotlight'), turn: !!document.querySelector('.tda-banner--turn'), round: !!document.querySelector('.tda-banner--round'),
        purchase: !!document.querySelector('.tda-banner--purchase'), score: !!document.querySelector('.tda-score'), tally: !!document.querySelector('.tda-strength-plate.is-tally'),
        price: !!document.querySelector('.tda-ghost img'), flip: !!document.querySelector('.tda-ghost:not(.is-face-down) img'),
        draw: [...document.querySelectorAll('.tda-ghost')].some(ghost => !ghost.querySelector('.tda-card-face img')),
      };
      for (const [key, value] of Object.entries(flags)) if (value && !probe.seen[key]) { probe.seen[key] = true; probe.events.push({ kind: key, ms: performance.now() }); }
    };
    new MutationObserver(scan).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-busy', 'data-phase'] });
  }, admission);
  const page = await context.newPage(), actor = { context, page, acknowledgements: 0, actionFrames: [], lastRevision: 0, loadStep: 'navigation', waitingFor: 'navigation-load', closes: [], authSent: false, authSentMs: null, viewCount: 0, viewPresence: [] }; actors.push(actor);
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push('unexpected-origin'); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  page.on('pageerror', () => errors.push('script-error')); page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  page.on('websocket', socket => { if (!socket.url().startsWith(origin.replace('http:', 'ws:') + '/')) external.push('unexpected-websocket-origin'); socket.on('close', () => { if (actor.closes.length < 8) actor.closes.push({ ms: Date.now(), loadStep: actor.loadStep }); }); socket.on('framesent', event => {
    try { if (JSON.parse(event.payload.toString()).type === 'auth') { actor.authSent = true; actor.authSentMs ??= Date.now(); } } catch {}
  }); socket.on('framereceived', event => {
    const packet = JSON.parse(event.payload.toString());
    if (packet.type === 'view') { actor.viewCount++; if (actor.viewPresence.length < 8) actor.viewPresence.push({ ms: Date.now(), gamePresent: !!packet.view?.game }); }
    if (packet.type === 'ack' && packet.actionReceipt?.ok) { actor.acknowledgements++; actor.actionFrames.push('ack'); }
    else if (packet.type === 'view' && packet.view.game) { actor.lastRevision = packet.view.game.revision; actor.actionFrames.push('view'); }
    else if (packet.type === 'patch') { if (packet.gamePatch?.set?.revision) actor.lastRevision = packet.gamePatch.set.revision; actor.actionFrames.push('view'); }
  }); });
  await page.goto(origin + base + '?room=' + admission.room.code); actor.loadStep = 'connected'; actor.waitingFor = 'authority-connected'; await page.locator('.site-online-match[data-connected=true]').waitFor();
  actor.loadStep = 'own-hand'; actor.waitingFor = 'own-hand-visible';
  await page.locator('.tda-card--hand[data-card]').first().waitFor();
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), false);
  actor.loadStep = 'ready'; actor.waitingFor = null; return actor;
}
async function scenario(kind) {
  stage = kind + '-fixture';
  const owner = await post('/guest/rooms', { name: 'Synthetic host' });
  const peer = await post('/guest/rooms/' + owner.room.code + '/sessions', { name: 'Synthetic player' });
  const admissions = [owner, peer], seats = admissions.map(value => ({ id: value.session.memberId, name: value.name }));
  const found = fixture(seats, kind), table = state(owner.room.id).table;
  assert.equal(service.stats().sockets, 0, 'seed a fresh room only before any WebSocket authenticates');
  table.stage = 'playing'; table.variant = found.before.variant; table.revision++;
  service.db.prepare('UPDATE rooms SET state=? WHERE id=?').run(JSON.stringify({ table, game: found.before }), owner.room.id);
  stage = kind + '-website-load';
  const pair = [];
  for (const admission of admissions) pair.push(await actor(admission));
  const submitter = pair[seats.findIndex(seat => seat.id === found.move.seatId)], observer = pair.find(value => value !== submitter);
  for (const value of pair) await value.page.evaluate(() => { const probe = window.__presentationProbe; probe.active = true; probe.events = []; probe.seen = {}; probe.fxDraws = 0; });
  const ownCount = await submitter.page.locator('.tda-card--hand[data-card]').count();
  stage = kind + '-submit';
  const played = submitter.page.locator('.tda-card--hand.is-legal[data-card="' + found.move.cardId + '"]');
  const handIndex = found.before.seats.find(seat => seat.id === found.move.seatId).hand.indexOf(found.move.cardId);
  await played.waitFor(); await submitter.page.locator('.tda-shell').focus();
  for (let i = 0; i < handIndex; i++) await submitter.page.keyboard.press('ArrowRight');
  await submitter.page.keyboard.press('Space');
  assert.ok((await played.getAttribute('class')).includes('is-selected'), 'actual website keyboard selects the intended legal fixture card before Enter');
  await submitter.page.keyboard.press('Enter');
  stage = kind + '-authority-receipt';
  await wait(() => state(owner.room.id).game.revision === found.after.revision && submitter.acknowledgements === 1 && pair.every(value => value.lastRevision === found.after.revision), 'real committed action projection and receipt');
  assert.ok(fresh(found.before, state(owner.room.id).game).some(event => event.code === 'CARD_PLAYED' && event.cardIds?.[0] === found.move.cardId), 'the real authority accepted the intended fixture card');
  const stream = submitter.actionFrames;
  assert.ok(stream.indexOf('ack') > 0 && stream[stream.indexOf('ack') - 1] === 'view', 'the website really receives authoritative view then matching ack');
  await submitter.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-pending-action') === 'false');
  stage = kind + '-presentation';
  return { pair, submitter, observer, found, room: owner.room.id, ownCount };
}
const probe = actor => actor.page.evaluate(() => ({ ...window.__presentationProbe, events: [...window.__presentationProbe.events] }));
const time = (probe, kind) => probe.events.find(event => event.kind === kind)?.ms;
async function finish(pair, room) {
  for (const actor of pair) { await actor.context.close(); actors.splice(actors.indexOf(actor), 1); }
  await wait(() => service.stats().sockets === 0, 'synthetic browsers closed');
  // These four synthetic rooms stay below the creation cap. Let the actual lifecycle own cleanup;
  // service.close() destroys the in-memory test database after all scenarios finish.
}
try {
  const power = await scenario('power');
  if (baseline) {
    await power.observer.page.locator('.tda-spotlight').waitFor(); await power.submitter.page.waitForTimeout(300);
    assert.equal(await power.submitter.page.locator('.tda-spotlight').count(), 0); assert.equal(await power.observer.page.locator('.tda-spotlight').count(), 1);
    assert.equal(await power.submitter.page.locator('.tda-shell').getAttribute('data-busy'), 'false');
    pass('historical d7a4232 presenter reproduces the real view-then-ack bug: submitter ability cancelled while the observer receives it');
    await finish(power.pair, power.room);
  } else {
    await Promise.all(power.pair.map(actor => actor.page.locator('.tda-spotlight').waitFor()));
    for (const actor of power.pair) {
      assert.equal(await actor.page.locator('.tda-shell').getAttribute('data-busy'), 'true');
      assert.equal(await actor.page.locator('.tda-banner--turn').count(), 0);
      const active = await actor.page.locator('.tda-seat.is-active').getAttribute('data-seat'); assert.equal(active, power.found.move.seatId);
    }
    pass('real view then ack clears the exact pending action without cancelling either the submitting player or observer ability description');
    for (const actor of power.pair) await actor.page.evaluate(() => { window.__presentationProbe.fxDraws = 0; });
    await Promise.all(power.pair.map(actor => actor.page.locator('.tda-spotlight [data-dismiss-hint]').click()));
    await wait(async () => (await Promise.all(power.pair.map(probe))).every(value => value.fxDraws > 20), 'both actual ability canvases draw after dismissal');
    pass('both the player own page and observer draw the actual textured ability effect after dismissing its description');
    stage = 'power-turn-banner';
    await Promise.all(power.pair.map(actor => actor.page.locator('.tda-banner--turn').waitFor()));
    pass('the own page and observer both display the finite turn transition instead of jumping directly to the next active seat');
    await Promise.all(power.pair.map(actor => actor.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false')));
    for (const actor of power.pair) { const value = await probe(actor); assert.ok(time(value, 'turn') > time(value, 'power')); }
    await finish(power.pair, power.room);

    const round = await scenario('round');
    await Promise.all(round.pair.map(actor => actor.page.locator('.tda-banner--round').waitFor()));
    for (const actor of round.pair) {
      assert.equal(await actor.page.locator('.tda-shell').getAttribute('data-busy'), 'true');
      assert.ok((await actor.page.locator('.tda-flow-step[aria-current=step]').textContent()).includes(String(round.found.before.round)), 'flow retains the prior round until its transition finishes');
    }
    pass('both real clients preserve the round transition after the submitting client receives its ack');
    await Promise.all(round.pair.map(actor => actor.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false')));
    for (const actor of round.pair) assert.ok((await actor.page.locator('.tda-flow-step[aria-current=step]').textContent()).includes(String(round.found.after.round)));
    pass('the flow rail advances only after the actual new-round banner completes');
    await finish(round.pair, round.room);

    const score = await scenario('score');
    await Promise.all(score.pair.map(actor => actor.page.locator('.tda-strength-plate.is-tally').first().waitFor()));
    for (const actor of score.pair) assert.equal(await actor.page.locator('.tda-card--flight').count(), score.found.events.find(event => event.code === 'GAMBIT_SCORED').score.rows.reduce((sum, row) => sum + row.cards.length, 0));
    pass('both clients retain all public settlement cards while the real table tally appears before the scoreboard');
    await Promise.all(score.pair.map(actor => actor.page.locator('.tda-score').waitFor()));
    for (const actor of score.pair) { const value = await probe(actor); assert.ok(time(value, 'score') > time(value, 'tally')); assert.equal(await actor.page.locator('.tda-shell').getAttribute('data-busy'), 'true'); }
    pass('the submitting client and observer both show the actual gambit scoreboard despite view-then-ack delivery');
    await Promise.all(score.pair.map(actor => actor.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false')));
    for (const actor of score.pair) assert.equal(await actor.page.locator('.tda-score').count(), 0);
    pass('settlement finishes once on both clients and then releases the next authoritative phase');
    await finish(score.pair, score.room);

    const purchase = await scenario('purchase');
    const buyer = purchase.found.events.find(event => event.code === 'BUY_PRICE').seatId;
    const buyerPage = purchase.pair[purchase.found.before.seats.findIndex(seat => seat.id === buyer)].page;
    const oldBuyer = purchase.found.before.seats.find(seat => seat.id === buyer), newBuyer = purchase.found.after.seats.find(seat => seat.id === buyer);
    const playedByBuyer = buyer === purchase.found.move.seatId ? 1 : 0;
    await Promise.all(purchase.pair.map(actor => actor.page.locator('.tda-banner--purchase').waitFor()));
    for (const actor of purchase.pair) {
      assert.equal(await actor.page.locator('.tda-ghost').count(), 0);
      const banner = actor.page.locator('.tda-banner--purchase');
      assert.equal(await banner.locator('img').count(), 0);
      assert.equal(/\d/.test(await banner.textContent()), false, 'purchase explanation does not reveal the price amount before the flip');
    }
    assert.equal(await buyerPage.locator('.tda-card--hand[data-card]').count(), oldBuyer.hand.length - playedByBuyer);
    pass('on both actual clients the purchase explanation appears before any price-card flight, flip or replacement hand arrival');
    await wait(async () => (await Promise.all(purchase.pair.map(probe))).every(value => time(value, 'flip') !== undefined), 'real visible price flips');
    for (const actor of purchase.pair) { const value = await probe(actor); assert.ok(time(value, 'price') > time(value, 'purchase')); assert.ok(time(value, 'flip') > time(value, 'price')); }
    pass('the price card flies face down and visibly flips only after the purchase explanation has finished');
    await wait(async () => (await Promise.all(purchase.pair.map(probe))).every(value => time(value, 'draw') !== undefined), 'anonymous replacement card flight');
    for (const actor of purchase.pair) { const value = await probe(actor); assert.ok(time(value, 'draw') > time(value, 'flip')); }
    assert.equal(await buyerPage.locator('.tda-card--hand[data-card]').count(), oldBuyer.hand.length - playedByBuyer);
    pass('replacement cards stay anonymous in flight and new own-hand faces remain held until their flight lands');
    await Promise.all(purchase.pair.map(actor => actor.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false')));
    assert.equal(await buyerPage.locator('.tda-card--hand[data-card]').count(), newBuyer.hand.length);
    for (const [index, actor] of purchase.pair.entries()) { const value = await probe(actor), start = time(value, 'purchase'); measurements.push({ client: index === 0 ? 'host' : 'player', explanationToPriceMs: Math.round(time(value, 'price') - start), priceToFlipMs: Math.round(time(value, 'flip') - time(value, 'price')), flipToDrawMs: Math.round(time(value, 'draw') - time(value, 'flip')) }); }
    pass('the authoritative purchased hand appears on both clients after the finite purchase sequence completes');
    await finish(purchase.pair, purchase.room);
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []); pass('actual animated website scenarios complete with no script errors and no external requests');
} catch (error) {
  const publicDiagnostics = [];
  for (const actor of actors) try { publicDiagnostics.push(await actor.page.evaluate(() => {
    const status = document.querySelector('.site-room-identity [role="status"]')?.textContent?.trim();
    const allowedStatus = ['已连接', 'Connected', '重连中', 'Reconnecting', '连接失败', 'Connection failed', '座位已在其他窗口连接', 'Seat connected in another window', '连接已失效，请返回首页重连', 'Session expired; return home to reconnect'];
    return { busy: document.querySelector('.tda-shell')?.getAttribute('data-busy'), phase: document.querySelector('.tda-shell')?.getAttribute('data-phase'), status: status == null ? null : allowedStatus.includes(status) ? status : 'other', powerCount: document.querySelectorAll('.tda-spotlight').length, ghostCount: document.querySelectorAll('.tda-ghost').length, coinCount: document.querySelectorAll('.tda-fx-coin').length, socketDiagnostics: window.__presentationSocketDiagnostics || null, probe: window.__presentationProbe ? { events: window.__presentationProbe.events, fxDraws: window.__presentationProbe.fxDraws } : null };
  })); } catch {}
  failure = { stage, kind: safeErrorKind(error), publicDiagnostics, loadDiagnostics: actors.map(actor => ({ loadStep: actor.loadStep, waitingFor: actor.waitingFor, closes: actor.closes, authSent: actor.authSent, authSentMs: actor.authSentMs, viewCount: actor.viewCount, viewPresence: actor.viewPresence, authoritativeFrameCount: actor.actionFrames.length })), message: 'Real website presentation assertion failed; no private projection or selector is written to evidence.' };
}
finally {
  await browser.close(); await service.close(); await new Promise(done => server.close(done));
  const stats = { checks: checks.length, completed: !failure, mode: baseline ? 'historical-presenter-regression-proof' : 'current-production-source', reducedMotion: 'no-preference', scope: 'Real loopback website and authoritative receipts. Synthetic legal engine fixtures seeded only before authentication.' };
  writeFileSync(join(out, 'result.json'), JSON.stringify({ checks, stats, measurements, errors, external, transportDiagnostics, droppedTransportDiagnostics, ...(failure ? { failure } : {}) }, null, 2));
  console.log(JSON.stringify(stats)); console.log(out);
}
if (failure) throw Error(failure.stage + ': ' + failure.message);
