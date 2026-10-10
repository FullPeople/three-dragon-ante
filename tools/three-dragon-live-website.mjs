// Opt-in acceptance against the local preview or the deployed HTTPS website.
// Creates one synthetic room through the UI. Never reads production SQLite,
// restarts the service, or saves capabilities, room identifiers, hands or frames.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--origin') throw Error('Use --origin http://127.0.0.1:4173 or --origin https://dnd.center. Creates a synthetic test room.');
const origin = args[1];
assert.ok(['http://127.0.0.1:4173', 'https://dnd.center'].includes(origin), 'Only the dedicated preview and authorized server are allowed');
const online = origin.startsWith('https:');
const stable = online ? '/3-dragon/' : '/three-dragon-ante-dev/';
const dev = online ? '/3-dragon/' : '/three-dragon-ante-dev/';
const checks = [], actors = [], errors = [], external = [], resourceFailures = [];
const gameplay = { antes: 0, plays: 0, choices: 0, visibleSettlements: 0 };
const prefix = 'qa-tda-' + new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + randomBytes(3).toString('hex');
const names = [prefix + '-host', prefix + '-player'];
const evidence = resolve('.local-evidence/live-website'); mkdirSync(evidence, { recursive: true });
const run = mkdtempSync(join(evidence, 'run-'));
const pass = name => { checks.push(name); console.log('PASS', name); };
const wait = async (predicate, label, timeout = 30000) => {
  const end = Date.now() + timeout;
  while (!await predicate()) { if (Date.now() > end) throw Error('Timed out: ' + label); await new Promise(done => setTimeout(done, 80)); }
};
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function actor(label, narrow = false) {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: narrow ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: narrow, hasTouch: narrow, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    const NativeSocket = window.WebSocket; window.__tdaAcceptanceSockets = [];
    window.WebSocket = class extends NativeSocket { constructor(...args) { super(...args); window.__tdaAcceptanceSockets.push(this); } };
  });
  const value = { label, context, page: await context.newPage(), wire: null, wsAttempts: 0, privateFrames: 0 }; actors.push(value);
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push({ origin: new URL(request.url()).origin }); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  value.page.on('pageerror', () => errors.push(label + ': pageError'));
  value.page.on('dialog', async dialog => { if(dialog.type()==='beforeunload')await dialog.accept();else{errors.push(label+': unexpectedDialog');await dialog.dismiss();} });
  value.page.on('response', response => { if (response.status() >= 400 && !response.url().includes('/three-dragon-api/') && !response.url().endsWith('/favicon.ico')) resourceFailures.push({ status: response.status() }); });
  value.page.on('websocket', socket => {
    value.wsAttempts++; assert.ok(socket.url().startsWith(origin.replace(/^http/, 'ws') + '/three-dragon-api/'));
    socket.on('framereceived', event => { try {
      const packet = JSON.parse(event.payload.toString());
      const patch = (before, change) => { const result = { ...before, ...change.set }; for (const key of change.remove) delete result[key]; return result; };
      if (packet.type === 'view') value.wire = packet.view;
      else if (packet.type === 'patch' && value.wire) {
        const result = patch(value.wire, packet.patch); result.game = packet.gamePatch ? patch(value.wire.game, packet.gamePatch) : packet.game; value.wire = result;
      }
      if (value.wire?.game) {
        assert.equal(value.wire.game.deck, undefined); assert.equal(value.wire.game.omniscient, undefined);
        for (const seat of value.wire.game.seats) assert.equal(seat.hand, undefined);
        value.privateFrames++;
      }
    } catch { errors.push(label + ': projectionError'); } });
  });
  return value;
}
const connected = value => value.page.locator('.site-online-match[data-connected="true"]').waitFor({ timeout: 30000 });
async function dismiss(value) {
  for (const selector of ['.tda-spotlight', '.tda-formation-spot']) if (await value.page.locator(selector).first().isVisible()) { await value.page.locator(selector).first().locator('[data-dismiss-hint]').click(); return true; }
  return false;
}
async function alias(value,name){const field=value.page.locator('#guest-name');await field.click();await field.fill(name);}
async function tableControls(value){
  const before=structuredClone(value.wire?.game);
  await value.page.getByTestId('table-help').click();await value.page.getByTestId('table-help-panel').waitFor();
  await value.page.getByTestId('table-help-close').click();assert.equal(await value.page.getByTestId('table-help-panel').count(),0);
  const sound=value.page.getByTestId('table-sound'),was=await sound.getAttribute('aria-pressed');await sound.click();assert.notEqual(await sound.getAttribute('aria-pressed'),was);await sound.click();
  await value.page.getByTestId('table-language').click();assert.equal(await value.page.evaluate(()=>document.documentElement.lang),'en');
  await value.page.getByTestId('table-language').click();assert.equal(await value.page.evaluate(()=>document.documentElement.lang),'zh-CN');
  assert.deepEqual(value.wire?.game,before);
}
async function finishGambit(peers) {
  const end = Date.now() + 240000;
  while (Date.now() < end) {
    for (const value of peers) { await dismiss(value); if (await value.page.locator('.tda-score').isVisible()) gameplay.visibleSettlements++; }
    if (gameplay.choices && gameplay.visibleSettlements && peers.some(value => value.wire?.game?.lastGambit?.number >= 1)) return;
    let moved = false;
    for (const value of peers) {
      const game = value.wire?.game;
      if (!game || await value.page.locator('.tda-shell').getAttribute('data-busy') !== 'false') continue;
      const action = game.actions?.[0]; if (!action) continue;
      const revision = game.revision;
      if (action.kind === 'choose') {
        if (!await value.page.locator('.tda-choice').isVisible()) continue;
        const choices = action.choice.options.filter(option => option.id !== 'skip' && !['KEEP_CARD', 'SKIP_POWER', 'DO_NOT_COPY'].includes(option.code));
        const selected = (choices.length ? choices : action.choice.options).slice(0, Math.max(action.choice.min, Math.min(1, action.choice.max)));
        for (const option of selected) await value.page.locator('.tda-choice [data-option="' + option.id + '"]').click();
        await value.page.locator('#confirm-action:not([disabled])').click(); gameplay.choices++;
      } else {
        const hints = game.handPowerHints?.filter(hint => hint.state === 'power-ready').map(hint => hint.cardId) || [];
        const preferred = action.kind === 'play' ? hints.find(id => /^(blue-|bronze-|red-|white-|copper-trickster|silver-seer|prophet|sorcerer|kobold|illusionist)/.test(id)) : null;
        const card = preferred ? value.page.locator('.tda-card--hand.is-legal[data-card="' + preferred + '"]') : value.page.locator('.tda-card--hand.is-legal').last();
        if (!await card.count()) continue;
        await card.focus(); await value.page.keyboard.press('Space'); await value.page.keyboard.press('Enter'); gameplay[action.kind === 'ante' ? 'antes' : 'plays']++;
      }
      await wait(() => value.wire?.game?.revision > revision, 'accepted gameplay action');
      await value.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-pending-action') === 'false');
      moved = true; break;
    }
    if (!moved) await new Promise(done => setTimeout(done, 100));
  }
  throw Error('Timed out: visible settlement and ability choice');
}
try {
  const health = await (await fetch(origin + '/three-dragon-api/v1/health')).json(); assert.deepEqual(health, { ok: true, protocol: 1 });
  for (const base of new Set([stable, dev])) {
    const manifest = await (await fetch(origin + base + 'manifest.json')).json();
    assert.equal(manifest.background_url, base + 'background.html'); assert.equal(manifest.action.popover, base + 'launcher.html');
    for (const file of ['index.html', 'table.html', 'background.html', 'launcher.html']) assert.equal((await fetch(origin + base + file)).status, 200);
  }
  pass('same-origin service health and complete website/extension entry points are reachable');
  const owner = await actor('owner'), player = await actor('player', true), duplicate = await actor('duplicate');
  await owner.page.goto(origin + stable); await alias(owner,names[0]);
  await owner.page.getByRole('button', { name: '创建房间', exact: true }).click(); await connected(owner);
  const invitation = await owner.page.getByRole('textbox', { name: '邀请链接', exact: true }).inputValue();
  assert.match(new URL(invitation).search, /^\?room=[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  const playerInvite = new URL(invitation); playerInvite.pathname = dev;
  await player.page.goto(playerInvite.href); await alias(player,names[1]);
  await player.page.getByRole('button', { name: '加入房间', exact: true }).click(); await connected(player);
  await wait(() => owner.wire?.table?.seats.length === 2, 'two seats on both channels');
  pass('desktop creates a synthetic room; narrow browser joins by token-free invite across channels');
  for(const value of [owner,player])await tableControls(value);
  pass('desktop and narrow lobby help, sound and language buttons respond to real pointer input');
  await duplicate.page.goto(invitation); await alias(duplicate,names[0]);
  await duplicate.page.getByRole('button', { name: '加入房间', exact: true }).click();
  await duplicate.page.getByRole('alert').filter({ hasText: '名字已占用' }).waitFor(); assert.equal(await duplicate.page.locator('.site-online-match').count(), 0);
  pass('ordinary duplicate-name entry is rejected');
  await owner.page.locator('.tda-setup input[type="number"]').first().fill('500');
  await owner.page.locator('#deck-choice').selectOption('wheel-of-fate-v1'); await owner.page.getByRole('button', { name: '开始', exact: true }).click();
  for (const value of [owner, player]) {
    await wait(() => value.wire?.game?.hand?.length > 0, 'private deal');
    await value.page.locator('.tda-card--hand[data-card]').first().waitFor();
    const leak = await value.page.evaluate(mine => document.querySelectorAll('.tda-card--hand[data-card]:not([data-seat="' + mine + '"])').length, value.wire.game.selfSeatId);
    assert.equal(leak, 0); assert.equal(await value.page.locator('#omniscient-toggle').isVisible(), false);
  }
  pass('real WebSocket deal reveals each own hand only and exposes no guest omniscient control');
  for(const value of [owner,player])await tableControls(value);
  await owner.page.getByTestId('table-new-game').click();await owner.page.getByTestId('new-game-confirmation').waitFor();await owner.page.getByTestId('new-game-cancel').click();
  assert.ok(owner.wire.game);await owner.page.getByTestId('leave-room').click();await owner.page.getByTestId('leave-confirmation').waitFor();await owner.page.getByTestId('leave-cancel').click();await connected(owner);
  pass('in-game controls remain clickable; cancelled new-game and leave confirmations preserve the current game');
  await finishGambit([owner, player]);
  pass('both browsers submit antes, reveal, plays, ability choices and a visible authoritative settlement');
  const hand = [...player.wire.game.hand], revision = player.wire.game.revision, seat = player.wire.game.selfSeatId;
  player.wire = null; await player.page.reload(); await connected(player);
  await wait(() => player.wire?.game?.revision === revision, 'refresh state');
  assert.equal(player.wire.game.selfSeatId, seat); assert.deepEqual(player.wire.game.hand, hand);
  pass('refresh recovers the same seat, hand and revision');
  const attempts = player.wsAttempts;
  await player.page.evaluate(() => { for (const socket of window.__tdaAcceptanceSockets) socket.close(); });
  await wait(() => player.wsAttempts > attempts, 'new physical WebSocket'); await connected(player);
  await wait(() => player.wire?.game?.revision === revision, 'reconnected state'); assert.deepEqual(player.wire.game.hand, hand);
  pass('closing the browser transport reconnects through WSS to the same saved state');
  const oldOwnerHand = [...owner.wire.game.hand], oldOwnerSeat = owner.wire.game.selfSeatId;
  await owner.page.getByRole('button', { name: '返回首页', exact: true }).click();
  await owner.page.getByTestId('leave-confirmation').waitFor();await owner.page.getByTestId('leave-confirm').click();
  await wait(() => player.wire?.isHost === true, 'automatic host succession'); assert.equal(player.wire.game.revision, revision);
  const fresh = await actor('fresh'); await fresh.page.goto(invitation); await alias(fresh,names[0]);
  await fresh.page.getByRole('button', { name: '重连房间', exact: true }).click(); await connected(fresh);
  await wait(() => fresh.wire?.game?.revision === revision, 'fresh-browser recovery');
  assert.equal(fresh.wire.game.selfSeatId, oldOwnerSeat); assert.deepEqual(fresh.wire.game.hand, oldOwnerHand); assert.equal(fresh.wire.isHost, false);
  pass('owner disconnect transfers hosting without redealing; room code plus offline name restores a fresh browser');
  for (const value of [player, fresh]) assert.equal(await value.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(resourceFailures, []);
  pass('desktop/narrow clients have no script errors, failed assets, horizontal overflow or external requests');
  for(const value of actors)await value.context.close();
  console.log('Waiting for the empty-room reconnect grace to expire.');
  await new Promise(done=>setTimeout(done,66000));
  const roomCode=new URL(invitation).searchParams.get('room');
  const expired=await fetch(origin+'/three-dragon-api/v1/guest/rooms/'+roomCode+'/sessions',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:names[0],reconnect:true})});
  assert.equal((await expired.json()).error,'roomMissing');
  pass('the self-created room dissolves after the final browser leaves and its reconnect grace expires');
  writeFileSync(join(run, 'result.json'), JSON.stringify({ checks, gameplay, errors, external, resourceFailures, origin, deployedServer: online, realOwlbearRoom: false, privateFrames: actors.reduce((sum, value) => sum + value.privateFrames, 0), syntheticRoom: true, scope: 'New isolated browser contexts and a self-created synthetic website room; real HTTP/WebSocket. No production database access or real Owlbear identity.' }, null, 2) + '\n');
  console.log(`${checks.length}/${checks.length} checks passed; ${run}`);
} catch {
  // Assertion messages can contain compared hands; retain fixed categories only.
  writeFileSync(join(run, 'failure.json'), JSON.stringify({ error: 'acceptanceFailed', failedAfterChecks: checks.length, checks, gameplay, errors, external, resourceFailures, origin, realOwlbearRoom: false }, null, 2) + '\n');
  console.error('FAIL website acceptance after ' + checks.length + ' completed checks; redacted evidence: ' + run);
  process.exitCode = 1;
} finally { await browser.close(); }
