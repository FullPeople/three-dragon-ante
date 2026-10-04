// Current built website + real loopback authority. Disposable synthetic rooms only.
// Run after npm run build and npm run build:server. No site/service build here;
// only the actual rule module is compiled for explicitly synthetic legal-choice fixtures.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..'), base = '/three-dragon-ante-dev/';
const dist = resolve(root, process.env.TDA_SITE_OUT || 'extensions/three-dragon-ante/dist');
const serviceFile = resolve(root, process.env.TDA_SERVER_OUT || 'dist-server', 'service.mjs');
const evidenceRoot = join(root, '.local-evidence', 'website-omniscient-controls');
mkdirSync(evidenceRoot, { recursive: true });
const evidence = mkdtempSync(join(evidenceRoot, 'run-'));
const fixtureDirectory = mkdtempSync(join(tmpdir(), 'tda-omniscient-controls-'));
const database = join(fixtureDirectory, 'synthetic.sqlite');
const checks = [], errors = [], external = [], actors = [], cases = [], failureDiagnostics = [];
const gpuIndex = process.argv.indexOf('--gpu'), gpu = gpuIndex < 0 ? 'default' : process.argv[gpuIndex + 1];
let service, server, browser, origin, rules, createTableService, failure, step = 'load-current-build';
const delay = ms => new Promise(done => setTimeout(done, ms));
const pass = label => { checks.push(label); console.log('PASS ' + label); };
const equal = (actual, expected, label) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), label);
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const safeKind = error => [error?.name, error?.constructor?.name].find(name => ['Error', 'AssertionError', 'TypeError', 'RangeError', 'SyntaxError', 'TimeoutError'].includes(name)) || 'OtherError';
async function captureFailure(currentActors, error) {
  // Capture before contexts close. Never save exception messages, DOM text,
  // selectors containing card IDs, projections, commands or session storage.
  const location = String(error?.stack || '').match(/website-omniscient-controls-browser\.mjs:(\d+):(\d+)/);
  const diagnostic = { step, kind: safeKind(error), ...(location ? { sourceLine: Number(location[1]), sourceColumn: Number(location[2]) } : {}), actors: [] };
  for (const actor of currentActors) {
    const unavailable = { unavailable: true };
    const snapshot = await Promise.race([
      actor.page.evaluate(() => ({ ...globalThis.__tdaControlsDiagnostics.snapshot(), events: globalThis.__tdaControlsDiagnostics.events })).catch(() => unavailable),
      delay(2000).then(() => unavailable),
    ]);
    diagnostic.actors.push(snapshot);
  }
  failureDiagnostics.push(diagnostic);
}
async function wait(check, label, timeout = 12000) { const end = Date.now() + timeout; while (!await check()) { assert.ok(Date.now() < end, label); await delay(10); } }
function patch(old, change) { const next = { ...old, ...change.set }; for (const key of change.remove) delete next[key]; return next; }
function accept(actor, packet) {
  if (packet.type === 'view') actor.view = packet.view;
  else if (packet.type === 'patch') actor.view = { ...patch(actor.view, packet.patch), game: packet.gamePatch ? patch(actor.view.game, packet.gamePatch) : packet.game };
}
const state = admission => JSON.parse(service.db.prepare('SELECT state FROM rooms WHERE id=?').get(admission.room.id).state);
async function actor(label, viewport) {
  const context = await browser.newContext({ viewport, locale: 'zh-CN', reducedMotion: 'reduce' });
  const page = await context.newPage(), value = { context, page, view: null, commands: [], privateLeak: false, privateNames: [], generation: 0, viewGeneration: 0 }; actors.push(value);
  await page.addInitScript(() => {
    const events = [];
    const zone = element => {
      if (!(element instanceof Element)) return 'other';
      if (element.closest('#table-editor')) return 'editor';
      if (element.closest('.tda-card--hand')) return 'hand';
      if (element.closest('.tda-card--ante')) return 'ante';
      if (element.closest('.tda-choice')) return 'choice';
      if (element.closest('.tda-shell')) return 'table';
      return 'other';
    };
    const snapshot = () => {
      const shell = document.querySelector('.tda-shell');
      const flag = name => shell?.getAttribute(name) === 'true' ? true : shell?.getAttribute(name) === 'false' ? false : null;
      return { focus: zone(document.activeElement), busy: flag('data-busy'), pendingAction: flag('data-pending-action'), hostNewGameDisabled: document.querySelector('[data-testid=table-new-game]')?.disabled ?? null, omniscient: flag('data-omniscient'), inspectorCount: document.querySelectorAll('.tda-inspector').length, ownHandCount: document.querySelectorAll('.tda-card--hand[data-layer=hand][data-card]').length, editorCount: document.querySelectorAll('#table-editor').length, powerCount: document.querySelectorAll('.tda-spotlight').length, formationCount: document.querySelectorAll('.tda-formation-spot').length };
    };
    globalThis.__tdaControlsDiagnostics = { events, snapshot };
    for (const type of ['focusin', 'focusout', 'pointerover', 'pointerout', 'keydown']) (type === 'keydown' ? window : document).addEventListener(type, event => {
      if (!(event.target instanceof Element) || !event.target.closest('.tda-shell')) return;
      if (type === 'keydown' && !['ArrowLeft', 'ArrowRight', 'Enter', 'Escape', ' ', 'f', 'u', 'v', 't'].includes(event.key)) return;
      events.push({ at: Math.round(performance.now()), type, zone: zone(event.target), ...(type === 'keydown' ? { key: event.key === ' ' ? 'Space' : event.key } : {}), ...snapshot() });
      if (events.length > 48) events.shift();
    }, { capture: true, passive: true });
  });
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push('unexpected-origin'); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  page.on('pageerror', () => errors.push('page-error'));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  page.on('websocket', socket => {
    if (!socket.url().startsWith(origin.replace('http:', 'ws:') + '/')) external.push('unexpected-websocket-origin');
    const generation = ++value.generation;
    socket.on('framesent', event => {
      try { const packet = JSON.parse(String(event.payload)); if (packet.type === 'command') value.commands.push(packet.command); } catch { errors.push('wire-decode'); }
    });
    socket.on('framereceived', event => {
      try {
        if (generation !== value.generation) return;
        const packet = JSON.parse(String(event.payload)); accept(value, packet);
        if (packet.type === 'view') value.viewGeneration = generation;
        if (value.watchPrivacy && /"(?:privateHands|privateDeck|privateExcluded|privateCommittedAntes|privateHandPowerHints)"\s*:|"omniscient"\s*:\s*true/.test(String(event.payload))) value.privateLeak = true;
      } catch { errors.push('wire-decode'); }
    });
  });
  await page.goto(origin + base);
  await page.locator('#guest-name').click(); await page.locator('#guest-name').fill(label);
  return value;
}
async function shortcut(actor) {
  // A committed server revision and busy=false can precede the action ACK.
  // The real host control also reflects client pending/sending, unlike the
  // raw service view's pending=false. Wait for that existing input guard;
  // then send the shortcut once. Never retry keys or bypass authority guards.
  await actor.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false' && document.querySelector('.tda-shell')?.getAttribute('data-pending-action') === 'false' && document.querySelector('[data-testid=table-new-game]')?.disabled === false);
  await actor.page.locator('.tda-shell').focus(); await actor.page.keyboard.type('fuvtt'); await actor.page.keyboard.press('Enter');
}
async function ordinaryOwnHand(actor, admission) {
  const saved = state(admission), ownId = actor.view.game.selfSeatId, hand = saved.game.seats.find(seat => seat.id === ownId).hand;
  await actor.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false');
  assert.equal(await actor.page.locator('.tda-card--hand[data-layer=hand][data-card]').count(), hand.length, 'ordinary player displays the actual own hand');
  assert.equal(await actor.page.locator('.tda-card--hand[data-layer=hand].is-face-down').count(), 0, 'ordinary own hand remains face up');
  assert.equal(await actor.page.locator('.tda-card--hand[data-layer=hand][aria-label="牌背"]').count(), 0, 'ordinary own hand names remain available');
}
async function rememberPrivateLabels(actors) {
  // Names come from each real player's own ordinary DOM before concealment.
  // Keep them in memory only so the hidden ActionBar can be checked independently.
  const names = [];
  for (const actor of actors) names.push(...await actor.page.locator('.tda-card--hand[data-layer=hand][data-card]').evaluateAll(nodes => nodes.map(node => (node.getAttribute('aria-label') || '').split(' · ')[0]).filter(Boolean)));
  assert.ok(names.length > 0, 'real ordinary own hand labels are available for negative privacy checks');
  for (const actor of actors) actor.privateNames = [...new Set(names)];
}
async function hiddenPrompt(actor) {
  const prompt = (await actor.page.locator('.tda-actionbar-prompt').textContent()).trim();
  assert.ok(['', '牌背', '你的前注'].includes(prompt), 'hidden ActionBar uses only a generic selection or committed-ante label');
  assert.equal(/[0-9]/.test(prompt), false, 'hidden ActionBar contains no card strength');
  for (const name of actor.privateNames) assert.equal(prompt.includes(name), false, 'hidden ActionBar contains no current private card name');
  return prompt;
}
async function hidden(actor, admission) {
  const saved = state(admission), privateCount = saved.game.seats.reduce((sum, seat) => sum + seat.hand.length, 0) + Object.keys(saved.game.committed).length;
  const faces = actor.page.locator('#table-editor .tda-editor-card[data-card]');
  assert.equal(await actor.page.getByTestId('omniscient-hands-toggle').getAttribute('aria-pressed'), 'false', 'show-all control defaults off');
  assert.equal(await faces.count(), privateCount, 'editor covers every current seat hand and concealed ante');
  assert.equal(await faces.locator('> img').count(), 0, 'hidden editor cards contain no front image nodes');
  assert.equal(await faces.locator('[data-face=front]').count(), 0);
  assert.equal(await faces.evaluateAll(nodes => nodes.every(node => node.dataset.face === 'back' && node.getAttribute('title') === '牌背' && node.querySelector('span')?.textContent === '牌背')), true, 'hidden editor cards contain only the back label');
  for (const seat of saved.game.seats) {
    const article = actor.page.locator('#table-editor .tda-editor-seat[data-seat="' + seat.id + '"]');
    assert.equal(await article.locator('.tda-editor-hand [data-card][data-face=back]').count(), seat.hand.length, 'each seat, including self, starts with hidden hands');
    assert.equal(await article.locator('.tda-editor-ante [data-card][data-face=back]').count(), Object.hasOwn(saved.game.committed, seat.id) ? 1 : 0, 'every present concealed ante starts hidden');
  }
  const tableHands = actor.page.locator('.tda-card--hand[data-card]');
  assert.equal(await tableHands.count(), saved.game.seats.reduce((sum, seat) => sum + seat.hand.length, 0), 'table receives all authorized private placements');
  assert.equal(await tableHands.evaluateAll(nodes => nodes.every(node => node.classList.contains('is-face-down') && node.getAttribute('aria-label') === '牌背')), true, 'table masks every private hand, including self');
  for (const id of Object.values(saved.game.committed)) assert.equal(await actor.page.locator('.tda-card--ante[data-card="' + id + '"].is-face-down[aria-label="牌背"]').count(), 1, 'table masks every concealed ante');
  assert.equal(await actor.page.locator('.tda-inspector').count(), 0, 'hidden entry retains no private inspector');
  await hiddenPrompt(actor);
}
async function geometry(actor) {
  const geometry = await actor.page.evaluate(() => {
    const editor = document.querySelector('#table-editor'), deck = document.querySelector('.tda-editor-deck-list');
    return { pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth, editorOverflow: editor ? editor.scrollWidth - editor.clientWidth : 0, deckOverflow: deck ? deck.scrollWidth - deck.clientWidth : 0 };
  });
  assert.ok(geometry.pageOverflow <= 1, 'website has no horizontal overflow'); assert.ok(geometry.editorOverflow <= 1, 'editor has no horizontal overflow'); assert.ok(geometry.deckOverflow <= 1, 'deck controls have no horizontal overflow');
  return geometry;
}
async function closeInspection(actor) {
  await actor.page.locator('#table-editor-close').click();
  await actor.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-omniscient') === 'false' && !document.querySelector('#table-editor'));
  await wait(() => actor.view?.canEdit === false && !actor.view?.game?.omniscient, 'closing uses the actual ordinary projection');
}
async function run(viewport) {
  const label = viewport.width === 390 ? 'mobile-390' : 'desktop-1280', result = { label, viewport, completed: false }; cases.push(result);
  const host = await actor('Synthetic owner', viewport), peer = await actor('Synthetic peer', viewport); peer.watchPrivacy = true;
  try {
    step = label + '-real-room';
    await host.page.getByRole('button', { name: '创建房间', exact: true }).click(); await host.page.locator('.site-online-match[data-connected=true]').waitFor();
    const admission = await host.page.evaluate(() => JSON.parse(sessionStorage.getItem('three-dragon-site-active.v1')));
    await peer.page.locator('#guest-room-code').fill(admission.room.code); await peer.page.getByRole('button', { name: '加入房间', exact: true }).click(); await peer.page.locator('.site-online-match[data-connected=true]').waitFor();
    await host.page.getByRole('button', { name: '开始', exact: true }).click();
    for (const actor of [host, peer]) await actor.page.locator('.tda-card--hand[data-layer=hand][data-card]').first().waitFor();
    await wait(() => host.view?.game && peer.view?.game, 'both actual seat projections arrive');
    await ordinaryOwnHand(host, admission); await ordinaryOwnHand(peer, admission);
    await rememberPrivateLabels([host, peer]);
    const initial = state(admission); await host.page.locator('.tda-card--hand.is-legal[data-layer=hand]').first().focus(); await host.page.keyboard.press('Space'); await host.page.keyboard.press('Enter');
    await wait(() => state(admission).game.revision === initial.game.revision + 1 && Object.keys(state(admission).game.committed).length === 1, 'real legal host ante is concealed');
    await host.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false');
    pass(label + ': actual two-player website deals normal own hands and commits a legal concealed self ante');

    step = label + '-default-backs';
    // Prime a normal private inspector, then verify entering inspection clears it.
    step = label + '-prime-private-inspector-focus';
    await host.page.locator('.tda-card--hand[data-layer=hand][data-card]').first().focus(); await host.page.keyboard.press('ArrowRight');
    step = label + '-prime-private-inspector-visible';
    await host.page.locator('.tda-inspector').waitFor();
    const beforeInspection = state(admission);
    step = label + '-inspection-shortcut';
    await shortcut(host);
    step = label + '-inspection-editor-visible';
    await host.page.locator('#table-editor').waitFor();
    step = label + '-inspection-authorized-view';
    await wait(() => host.view?.game?.omniscient && host.view?.canEdit, 'actual hidden shortcut is authorized');
    step = label + '-default-backs';
    equal(state(admission), beforeInspection, 'hidden shortcut does not play or edit'); await hidden(host, admission);
    await host.page.locator('#table-editor .tda-editor-hand [data-card]').first().hover(); assert.equal(await host.page.locator('.tda-inspector').count(), 0, 'hover on a hidden editor card cannot show private inspection');
    await host.page.locator('.tda-card--hand[data-layer=hand][data-card]').first().focus(); await host.page.keyboard.press('ArrowRight'); await host.page.keyboard.press('Space'); await host.page.keyboard.press('Escape');
    assert.equal(await host.page.locator('.tda-inspector').count(), 0, 'real hand focus and keyboard cannot reveal hidden private cards');
    equal(state(admission), beforeInspection, 'hidden focus/keyboard does not submit an action');
    await ordinaryOwnHand(peer, admission); assert.equal(await peer.page.locator('#table-editor').count(), 0); assert.equal(peer.privateLeak, false);
    result.initialGeometry = await geometry(host);
    await host.page.locator('#table-editor').screenshot({ path: join(evidence, label + '-default-backs.png'), animations: 'disabled' });
    pass(label + ': editor and table default to backs for both seats and concealed ante; stale inspector, hover and keyboard cannot expose private faces');

    step = label + '-show-hide-hands';
    await host.page.getByTestId('omniscient-hands-toggle').click();
    const allCards = host.page.locator('#table-editor .tda-editor-card[data-card]');
    assert.equal(await host.page.getByTestId('omniscient-hands-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await allCards.evaluateAll(nodes => nodes.every(node => node.dataset.face === 'front' && node.querySelector(':scope > img') && node.querySelector('span')?.textContent !== '牌背')), true, 'show all exposes actual card names and front images');
    assert.equal(await host.page.locator('.tda-card--hand[data-card].is-face-down').count(), 0, 'show all also exposes both seats on the table');
    await host.page.getByTestId('omniscient-hands-toggle').click(); await hidden(host, admission); equal(state(admission), beforeInspection, 'show/hide is local presentation only');
    pass(label + ': actual Show all / Hide all buttons toggle names and fronts without mutating the game');

    step = label + '-independent-deck-draft';
    await host.page.getByTestId('omniscient-deck-toggle').click(); await host.page.locator('.tda-editor-deck').waitFor(); await hidden(host, admission);
    const beforeDeck = state(admission), rows = host.page.locator('.tda-editor-deck-list > li');
    assert.equal(await rows.count(), beforeDeck.game.deck.length); assert.ok((await rows.first().textContent()).includes('下一张'), 'first row visibly identifies the next draw');
    const secondImage = await rows.nth(1).locator('img').getAttribute('src'); await rows.nth(1).getByTestId('deck-order-up').click();
    assert.equal(await rows.first().locator('img').getAttribute('src'), secondImage, 'Up changes the local visual order'); equal(state(admission), beforeDeck, 'moving Up does not send a premature write');
    const fifthImage = await rows.nth(4).locator('img').getAttribute('src'); await rows.nth(4).getByTestId('deck-order-top').click();
    assert.equal(await rows.first().locator('img').getAttribute('src'), fifthImage, 'Top visibly moves the selected row to next draw');
    const expected = [...beforeDeck.game.deck]; [expected[0], expected[1]] = [expected[1], expected[0]]; expected.unshift(...expected.splice(4, 1));
    equal(state(admission), beforeDeck, 'Top remains a local draft until Apply'); result.deckGeometry = await geometry(host);
    step = label + '-actual-deck-apply';
    const editOffset = host.commands.length; await host.page.getByTestId('deck-order-apply').click();
    await wait(() => state(admission).game.revision === beforeDeck.game.revision + 1, 'actual Apply command is committed');
    await wait(() => host.view?.game?.revision === beforeDeck.game.revision + 1 && !host.view.pending, 'committed projection clears pending');
    const afterDeck = state(admission), sent = host.commands.slice(editOffset).filter(command => command.type === 'edit');
    assert.equal(sent.length, 1); equal(sent[0].edit, { kind: 'deckOrder', cardIds: expected, revision: beforeDeck.game.revision }, 'actual website sends one complete revision-bound deckOrder command');
    equal(afterDeck.game, { ...beforeDeck.game, deck: expected, revision: beforeDeck.game.revision + 1 }, 'Apply changes only the authority deck and one game revision');
    assert.equal(afterDeck.table.revision, beforeDeck.table.revision + 1); equal(host.view.game.privateDeck, expected, 'actual private view follows the committed order');
    await hidden(host, admission); assert.equal(await host.page.getByTestId('deck-order-apply').isDisabled(), true, 'committed revision resets the draft');
    await rows.first().getByTestId('deck-order-down').click(); await host.page.getByTestId('deck-order-reset').click(); equal(state(admission), afterDeck, 'Reset discards only the local draft');
    await host.page.getByTestId('omniscient-deck-toggle').click(); assert.equal(await host.page.locator('.tda-editor-deck').count(), 0); await hidden(host, admission);
    pass(label + ': independent deck button preserves hidden hands; Up / Top / Apply commits one exact WS permutation and Reset / Close make no writes');

    step = label + '-close-reopen-refresh';
    await host.page.getByTestId('omniscient-hands-toggle').click(); await closeInspection(host); await ordinaryOwnHand(host, admission);
    await shortcut(host); await host.page.locator('#table-editor').waitFor(); await hidden(host, admission); assert.equal(await host.page.locator('.tda-editor-deck').count(), 0, 'reopened inspection does not revive the deck panel');
    await host.page.getByTestId('omniscient-hands-toggle').click(); await host.page.getByTestId('omniscient-deck-toggle').click();
    const beforeRefresh = state(admission), generation = host.generation; host.view = null;
    await host.page.reload(); await host.page.locator('.site-online-match[data-connected=true]').waitFor();
    await wait(() => host.viewGeneration > generation && host.view?.game && !host.view.game.omniscient && host.view.canEdit === false, 'refresh has a fresh ordinary authenticated projection');
    assert.equal(await host.page.locator('#table-editor').count(), 0); equal(state(admission).game, beforeRefresh.game, 'refresh preserves all saved game zones');
    await ordinaryOwnHand(host, admission); await shortcut(host); await host.page.locator('#table-editor').waitFor(); await hidden(host, admission);
    assert.equal(await host.page.locator('.tda-editor-deck').count(), 0); assert.equal(await host.page.getByTestId('omniscient-deck-toggle').getAttribute('aria-expanded'), 'false');
    pass(label + ': closing, reopening and refresh revoke prior hand/deck visibility and require fresh inspection with default backs');

    step = label + '-public-discard-inspector';
    const beforeRemove = state(admission), target = host.page.locator('#table-editor .tda-editor-hand [data-card]').first(); const removed = await target.getAttribute('data-card');
    await target.click({ button: 'right' }); await host.page.getByRole('menu').getByRole('menuitem').nth(1).click();
    await wait(() => state(admission).game.revision === beforeRemove.game.revision + 1 && state(admission).game.discard.includes(removed), 'actual authorized editor moves one synthetic card to public discard');
    await closeInspection(host); await host.page.locator('.tda-card--discard[data-card="' + removed + '"]').hover();
    await host.page.locator('.tda-inspector[data-card-inspector="' + removed + '"]').waitFor();
    assert.equal(await host.page.locator('.tda-card--discard[data-card="' + removed + '"].is-face-down').count(), 0, 'public discard stays face up');
    assert.ok(await host.page.locator('.tda-inspector-face').isVisible(), 'real pointer inspection still exposes public card art');
    await shortcut(host); await host.page.locator('#table-editor').waitFor(); await hidden(host, admission); result.finalGeometry = await geometry(host);
    await ordinaryOwnHand(peer, admission); assert.equal(peer.privateLeak, false); result.completed = true;
    pass(label + ': public discard remains face up and pointer-inspectable; private hidden mode and ordinary peer hand remain intact');
  } catch (error) { await captureFailure([host, peer], error); throw error; }
  finally { await host.context.close(); await peer.context.close(); }
}
async function runUncommittedSelection(viewport) {
  const label = (viewport.width === 390 ? 'mobile-390' : 'desktop-1280') + '-uncommitted-selection';
  const result = { label, viewport, completed: false }; cases.push(result);
  const host = await actor('Synthetic selection owner', viewport), peer = await actor('Synthetic selection peer', viewport); peer.watchPrivacy = true;
  try {
    step = label + '-real-room';
    await host.page.getByRole('button', { name: '创建房间', exact: true }).click(); await host.page.locator('.site-online-match[data-connected=true]').waitFor();
    const admission = await host.page.evaluate(() => JSON.parse(sessionStorage.getItem('three-dragon-site-active.v1')));
    await peer.page.locator('#guest-room-code').fill(admission.room.code); await peer.page.getByRole('button', { name: '加入房间', exact: true }).click(); await peer.page.locator('.site-online-match[data-connected=true]').waitFor();
    await host.page.getByRole('button', { name: '开始', exact: true }).click();
    for (const actor of [host, peer]) await actor.page.locator('.tda-card--hand[data-layer=hand][data-card]').first().waitFor();
    await wait(() => host.view?.game && peer.view?.game, 'selection room receives actual private deals');
    await ordinaryOwnHand(host, admission); await ordinaryOwnHand(peer, admission); await rememberPrivateLabels([host, peer]);
    const before = state(admission); assert.equal(Object.keys(before.game.committed).length, 0, 'separate selection room has no committed ante');
    await shortcut(host); await host.page.locator('#table-editor').waitFor(); await hidden(host, admission);
    step = label + '-show-select-hide';
    await host.page.getByTestId('omniscient-hands-toggle').click();
    await host.page.locator('.tda-card--hand[data-layer=hand][data-card]').first().focus(); await host.page.keyboard.press('Space');
    const visiblePrompt = await host.page.locator('.tda-actionbar-prompt').textContent();
    assert.ok(host.privateNames.some(name => visiblePrompt.includes(name)), 'real face-up selection actually produces its card label before Hide');
    assert.ok(/[0-9]/.test(visiblePrompt), 'real face-up selection actually has its strength before Hide');
    const ante = host.page.locator('.tda-actionbar-buttons').getByRole('button', { name: '前注', exact: true });
    assert.equal(await ante.count(), 1); assert.equal(await ante.isEnabled(), true, 'real legal selected card retains its Ante action');
    await host.page.getByTestId('omniscient-hands-toggle').click(); await hidden(host, admission);
    assert.equal(await hiddenPrompt(host), '牌背', 'Hide clears selected-card name and strength from the prompt');
    assert.equal(await ante.count(), 1); assert.equal(await ante.isEnabled(), true, 'Hide preserves the legal selected-card Ante action');
    equal(state(admission), before, 'Show/select/Hide are local state only and do not commit the ante');
    step = label + '-direct-hidden-space';
    await host.page.locator('.tda-shell').focus(); await host.page.keyboard.press('Escape');
    await host.page.locator('.tda-card--hand[data-layer=hand][data-card]').first().focus(); await host.page.keyboard.press('Space');
    await hidden(host, admission); assert.equal(await hiddenPrompt(host), '牌背', 'direct Space on a hidden legal card also keeps the prompt generic');
    assert.equal(await ante.count(), 1); assert.equal(await ante.isEnabled(), true, 'direct hidden selection keeps the Ante action available');
    equal(state(admission), before, 'direct hidden selection does not change the authority');
    await ordinaryOwnHand(peer, admission); assert.equal(peer.privateLeak, false);
    Object.assign(result, { completed: true, selectionPromptHidden: true, directHiddenSpacePromptHidden: true, anteButtonRetained: true, gameUnchanged: true });
    pass(label + ': Show all / real Space selection / Hide and direct hidden Space retain Ante while the ActionBar exposes no private name or strength');
  } catch (error) { await captureFailure([host, peer], error); throw error; }
  finally { await host.context.close(); await peer.context.close(); }
}
const choiceVariant = { ruleSetId: 'provided-pack-20260910', deckId: 'selected-specials-v1', specialIds: ['bahamut', 'black-raider', 'blue-overlord', 'brass-sultan', 'bronze-warlord', 'chromatic-wyrmling', 'copper-trickster', 'dracolich', 'kobold', 'sorcerer'] };
const trimRuleGame = game => ({ ...game, history: (game.history || []).slice(-24), historyComplete: false, accepted: {} });
function invariant(game) {
  assert.equal(rules.checkInvariants(game).length, 0, 'choice fixture passes the unchanged actual engine invariants');
  const pending = game.pending && ['seer-keep', 'sorcerer'].includes(game.pending.task.kind) ? game.pending.task.ids || [] : [];
  const reserved = game.queue.filter(task => task.kind === 'sorcerer-ante').flatMap(task => task.ids || []);
  const ids = [...game.deck, ...game.discard, ...game.ante, ...Object.values(game.committed), ...game.seats.flatMap(seat => [...seat.hand, ...seat.flight.map(item => item.cardId)]), ...pending, ...reserved, ...game.excluded];
  equal([...ids].sort(), rules.variantCards(game.variant).map(card => card.id).sort(), 'legal choice fixture conserves the complete variant pool');
  assert.equal(game.seats.reduce((sum, seat) => sum + seat.gold, game.stakes + game.hole), game.initialGold, 'legal choice fixture conserves currency');
}
function engineAction(game, value) {
  const result = rules.applyAction(game, { id: randomUUID(), revision: game.revision, ...value });
  assert.equal(result.ok, true, 'choice fixture advances with an actual legal engine action'); invariant(result.state); return result.state;
}
function legalChoice(saved, family) {
  for (let seed = 1; seed <= 2048; seed++) {
    const created = rules.createGame({ id: saved.game.id, seed, startingGold: 200, seats: saved.table.seats.map(seat => ({ id: seat.seatId, name: seat.name })), variant: choiceVariant });
    // The website owner must also be the chooser in this fixture.
    const caster = created.seats[0], other = created.seats[1], target = caster.hand.find(id => rules.card(id).family === family); if (!target) continue;
    const ownAnte = caster.hand.find(id => id !== target && other.hand.some(cardId => rules.card(cardId).strength < rules.card(id).strength));
    const theirAnte = ownAnte && other.hand.find(id => rules.card(id).strength < rules.card(ownAnte).strength); if (!theirAnte) continue;
    let next = engineAction(created, { seatId: caster.id, kind: 'ante', cardId: ownAnte });
    next = engineAction(next, { seatId: other.id, kind: 'ante', cardId: theirAnte });
    if (next.stage !== 'play' || next.active !== 0 || !rules.handPowerHint(next, caster.id, target).ruleTriggers) continue;
    next = engineAction(next, { seatId: caster.id, kind: 'play', cardId: target });
    if (next.pending?.task.kind === family && next.pending.seatId === caster.id) return next;
  }
  throw Error('Actual legal choice fixture could not be generated');
}
async function installChoiceFixture(admission, actors, family) {
  const saved = state(admission), game = trimRuleGame(legalChoice(saved, family)); invariant(game);
  const next = { table: { ...saved.table, revision: saved.table.revision + 1, stage: 'playing', variant: game.variant }, game };
  const generations = actors.map(actor => actor.generation);
  await service.close(); service = null;
  // Real engine state only, written while the actual authority/cache is stopped.
  // This path is exclusively the disposable synthetic SQLite created above.
  const db = new DatabaseSync(database);
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare('UPDATE rooms SET state=?,updated=? WHERE id=?').run(JSON.stringify(next), Date.now(), admission.room.id);
    db.prepare('DELETE FROM receipts WHERE room=?').run(admission.room.id); db.prepare('DELETE FROM history WHERE room=?').run(admission.room.id);
    for (const entry of game.history) db.prepare('INSERT INTO history VALUES(?,?,?,?)').run(admission.room.id, game.id, entry.sequence, JSON.stringify(entry));
    db.exec('COMMIT');
  } finally { db.close(); }
  service = createTableService({ database, origin });
  for (let i = 0; i < actors.length; i++) await wait(() => actors[i].viewGeneration > generations[i] && actors[i].view?.game?.revision === game.revision && !actors[i].view.game.omniscient, 'actual WS reconnect reloads the legal engine choice fixture');
  equal(state(admission), next, 'fresh actual authority reads the generated fixture exactly');
  // Dismiss actual power descriptions if recovery legitimately schedules them.
  await wait(async () => {
    for (const actor of actors) for (const selector of ['.tda-spotlight', '.tda-formation-spot']) if (await actor.page.locator(selector).count()) await actor.page.locator(selector).click();
    return await actors[0].page.locator('.tda-choice').count() > 0 && await actors[0].page.locator('.tda-shell').getAttribute('data-busy') === 'false';
  }, 'actual recovered choice presentation becomes ready');
  return next;
}
async function choiceCards(actor, game, isPrivate, revealed) {
  const options = actor.page.locator('.tda-choice .tda-tile--card[data-option]'), expected = game.pending.options.filter(option => option.cardId);
  assert.equal(await options.count(), expected.length, 'all actual legal card candidates are present');
  for (let i = 0; i < expected.length; i++) {
    const option = options.nth(i), hidden = isPrivate && !revealed, id = expected[i].cardId;
    assert.equal(await option.getAttribute('data-option'), expected[i].id);
    if (hidden) {
      assert.equal(await option.locator('> img').count(), 0, 'hidden private choice has no front image node');
      assert.equal(await option.locator('.tda-choice-card-back[role=img]').getAttribute('aria-label'), '牌背 ' + (i + 1), 'hidden choice image has only a numbered back label');
      assert.equal(await option.locator('.tda-tile-strength').textContent(), '牌背 ' + (i + 1), 'hidden choice strength slot contains a back ordinal, never strength');
      assert.equal(await option.locator('img').evaluateAll(nodes => nodes.every(node => (node.getAttribute('alt') || '') === '')), true, 'back texture alt exposes no private card label');
      const labels = await option.evaluate(node => [node.textContent || '', node.getAttribute('title') || '', node.getAttribute('aria-label') || ''].join(' '));
      for (const name of actor.privateNames) assert.equal(labels.includes(name), false, 'hidden candidate text and accessibility expose no private card name');
    } else {
      assert.equal(await option.locator('> img').count(), 1, 'authorized revealed or public choice keeps its actual front image');
      const alt = await option.locator('> img').getAttribute('alt'); assert.ok(alt && !alt.startsWith('牌背') && alt.endsWith(' · ' + rules.card(id).strength), 'front alt contains the actual card name and strength');
      assert.equal(await option.locator('.tda-tile-strength').textContent(), String(rules.card(id).strength), 'public or intentionally shown candidate strength stays exact');
      assert.equal(await option.locator('.tda-choice-card-back').count(), 0, 'public cards are never masked as private hands');
    }
  }
}
async function runLegalChoice(viewport, family) {
  const label = (viewport.width === 390 ? 'mobile-390' : 'desktop-1280') + '-legal-' + family + '-choice';
  const result = { label, viewport, completed: false, ruleGeneratedFixture: true, omniscientBackgroundPointerAcceptance: false }; cases.push(result);
  const host = await actor('Synthetic choice owner', viewport), peer = await actor('Synthetic choice peer', viewport); peer.watchPrivacy = true;
  try {
    step = label + '-real-room';
    await host.page.getByRole('button', { name: '创建房间', exact: true }).click(); await host.page.locator('.site-online-match[data-connected=true]').waitFor();
    const admission = await host.page.evaluate(() => JSON.parse(sessionStorage.getItem('three-dragon-site-active.v1')));
    await peer.page.locator('#guest-room-code').fill(admission.room.code); await peer.page.getByRole('button', { name: '加入房间', exact: true }).click(); await peer.page.locator('.site-online-match[data-connected=true]').waitFor();
    await host.page.getByRole('button', { name: '开始', exact: true }).click(); await wait(() => host.view?.game && peer.view?.game, 'choice room starts through actual website');
    step = label + '-actual-engine-fixture'; const fixture = await installChoiceFixture(admission, [host, peer], family), isPrivate = family === 'kobold';
    await ordinaryOwnHand(host, admission); await ordinaryOwnHand(peer, admission); await rememberPrivateLabels([host, peer]);
    assert.equal(fixture.game.pending.code, isPrivate ? 'EXCHANGE_HAND_CARDS' : 'SORCERER_REPLACEMENT');
    for (const option of fixture.game.pending.options) {
      assert.equal(fixture.game.seats[0].hand.includes(option.cardId), isPrivate, 'fixture distinguishes genuinely private hand candidates from public reveal');
      if (!isPrivate) assert.equal(fixture.game.revealed.includes(option.cardId), true, 'Sorcerer candidates are genuinely public engine reveals');
    }
    const firstId = fixture.game.pending.options[0].id;
    await host.page.locator('.tda-choice [data-option="' + firstId + '"]').hover(); await host.page.locator('.tda-inspector[data-card-inspector="' + firstId + '"]').waitFor();
    step = label + '-hidden-candidate-dom-keyboard';
    await shortcut(host); await host.page.locator('#table-editor').waitFor(); await hidden(host, admission); await choiceCards(host, fixture.game, isPrivate, false);
    const first = host.page.locator('.tda-choice [data-option="' + firstId + '"]');
    // Editor intentionally covers the background ChoicePanel. Real focus/keys
    // exercise the attack path; no force pointer or DOM/style manipulation.
    await first.focus(); await first.press('Space'); assert.equal(await first.getAttribute('aria-pressed'), 'true', 'real keyboard can select a legal background candidate');
    if (isPrivate) assert.equal(await host.page.locator('.tda-inspector').count(), 0, 'stale ordinary hover and hidden candidate focus/Space do not expose private inspection');
    assert.equal(await host.page.locator('.tda-choice #confirm-action').isEnabled(), true, 'hidden candidate selection remains confirmable');
    equal(state(admission), fixture, 'candidate selection is local until confirmation');
    step = label + '-show-hide-candidate'; await host.page.getByTestId('omniscient-hands-toggle').click(); await choiceCards(host, fixture.game, isPrivate, true);
    await host.page.getByTestId('omniscient-hands-toggle').click(); await choiceCards(host, fixture.game, isPrivate, false); await hidden(host, admission);
    assert.equal(await first.getAttribute('aria-pressed'), 'true', 'Hide preserves the actual legal choice selection');
    const before = state(admission), commandOffset = host.commands.length;
    step = label + '-real-choice-confirmation';
    if (isPrivate) {
      const confirm = host.page.locator('.tda-choice #confirm-action'); await confirm.focus(); await confirm.press('Enter');
    } else {
      await closeInspection(host); await host.page.locator('.tda-choice [data-option="' + firstId + '"]').hover(); await host.page.locator('.tda-inspector[data-card-inspector="' + firstId + '"]').waitFor();
      const publicOption = host.page.locator('.tda-choice [data-option="' + firstId + '"]');
      if (await publicOption.getAttribute('aria-pressed') !== 'true') await publicOption.click();
      await host.page.locator('.tda-choice #confirm-action').click();
    }
    await wait(() => state(admission).game.revision === before.game.revision + 1, 'actual legal choice command commits exactly one revision');
    const sent = host.commands.slice(commandOffset).filter(command => command.type === 'action'); assert.equal(sent.length, 1); assert.equal(sent[0].action.kind, 'choose');
    equal(sent[0].action.optionIds, [firstId], 'real confirmation submits exactly the selected candidate');
    const expected = rules.applyAction(before.game, sent[0].action); assert.equal(expected.ok, true); equal(state(admission).game, trimRuleGame(expected.state), 'actual authority resolves the legal choice exactly as the unchanged engine'); invariant(state(admission).game);
    assert.equal(peer.privateLeak, false);
    Object.assign(result, { completed: true, privateCandidateMasked: isPrivate, publicCandidatesRemainFront: !isPrivate, showHidePreservesSelection: true, actualLegalChoiceConfirmed: true, ordinaryPublicPointerInspector: !isPrivate });
    pass(label + ': actual legal fixture masks private candidate fronts/alt/strength and stale inspect, preserves public Sorcerer candidates, and real keyboard or normal pointer confirmation commits once');
  } catch (error) { await captureFailure([host, peer], error); throw error; }
  finally { await host.context.close(); await peer.context.close(); }
}
try {
  assert.ok(['default', 'software'].includes(gpu), 'GPU mode is default or software');
  assert.ok(existsSync(join(dist, 'index.html')), 'Build the current website before this independent browser test');
  ({ createTableService } = await import(pathToFileURL(serviceFile)));
  step = 'compile-real-legal-choice-fixtures';
  await build({ input: join(root, 'extensions/three-dragon-ante/src/game/rules/index.ts'), platform: 'node', external: [/^node:/], output: { file: join(evidence, 'rules.mjs'), format: 'esm', codeSplitting: false }, logLevel: 'warn' });
  rules = await import(pathToFileURL(join(evidence, 'rules.mjs')));
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.startsWith('/three-dragon-api/v1/')) { service.server.emit('request', request, response); return; }
    const file = resolve(dist, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
    if (!pathname.startsWith(base) || !file.startsWith(dist + sep) || !existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); response.end(readFileSync(file));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done)); origin = 'http://127.0.0.1:' + server.address().port;
  service = createTableService({ database, origin }); server.on('upgrade', (request, socket, head) => service.server.emit('upgrade', request, socket, head));
  browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--no-proxy-server', '--enable-webgl', ...(gpu === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) { await run(viewport); await runUncommittedSelection(viewport); await runLegalChoice(viewport, 'kobold'); await runLegalChoice(viewport, 'sorcerer'); }
  assert.equal(errors.length, 0, 'current website has no script/wire errors'); assert.equal(external.length, 0, 'all website requests remain loopback');
  pass('both real browser viewports complete without script errors or external requests');
} catch (error) { failure = { step, kind: safeKind(error) }; }
finally {
  try { if (browser) await browser.close(); } catch { failure ||= { step: 'browser-cleanup', kind: 'Error' }; }
  try { if (service) await service.close(); if (server) await new Promise(done => server.close(done)); } catch { failure ||= { step: 'service-cleanup', kind: 'Error' }; }
  try { for (const suffix of ['', '-wal', '-shm']) if (existsSync(database + suffix)) unlinkSync(database + suffix); rmdirSync(fixtureDirectory); } catch { failure ||= { step: 'synthetic-fixture-cleanup', kind: 'Error' }; }
}
writeFileSync(join(evidence, 'result.json'), JSON.stringify({ completed: !failure, checks, passed: checks.length, expectedChecks: 19, cases, gpu, authoritySha256: existsSync(serviceFile) ? hash(serviceFile) : null, siteIndexSha256: existsSync(join(dist, 'index.html')) ? hash(join(dist, 'index.html')) : null, sourceHashes: Object.fromEntries(['presentation/hud/Editor.tsx', 'presentation/hud/DeckOrderPanel.tsx', 'presentation/hud/ActionBar.tsx', 'presentation/hud/ChoicePanel.tsx', 'presentation/app/TableApp.tsx', 'presentation/scene/CardLayer.tsx', 'presentation/mount.ts'].map(file => [file, hash(join(root, 'extensions/three-dragon-ante/src', file))])), scriptErrors: errors.length, externalRequests: external.length, fixtureDatabaseRemoved: !existsSync(database), failure, failureDiagnostics,
  scope: 'Real built website controls in desktop and 390px browser viewports, actual loopback HTTP/WS authority and disposable synthetic SQLite. Choice cases are explicit actual-engine-generated legal fixtures, not natural complete games. Omniscient background choices are DOM/focus/keyboard checks, not visible pointer acceptance; public normal Sorcerer is actual pointer acceptance. Safe labels/counts/booleans/code hashes plus default-back screenshots only; no stored session/projection/token/card ID/SQL or revealed-hand screenshots. No production rooms, public deployment or physical-device UAT.' }, null, 2) + '\n');
console.log(JSON.stringify({ completed: !failure, passed: checks.length, evidence, ...(failure ? { failure } : {}) }));
if (failure) process.exitCode = 1;
