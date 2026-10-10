// Public acceptance: only this run's synthetic UI-created room. Never reads production SQL or stores projections.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const originIndex = process.argv.indexOf('--origin');
const origin = originIndex >= 0 ? process.argv[originIndex + 1] : '';
assert.equal(origin, 'https://dnd.center', 'Explicit --origin https://dnd.center is required.');
const root = resolve(import.meta.dirname, '..'), evidenceRoot = join(root, '.local-evidence/website-omniscient-live');
mkdirSync(evidenceRoot, { recursive: true }); const out = mkdtempSync(join(evidenceRoot, 'run-'));
const checks = [], errors = [], external = [], actors = [];
let failure, stage = 'startup';
const pass = label => { checks.push(label); console.log('PASS ' + label); };
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function actor() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) { super(...args); if (String(args[0]).includes('/three-dragon-api/v1/socket')) window.__liveValidationSocket = this; }
    };
  });
  const page = await context.newPage(), value = { context, page, privilegedCommands: 0, privateLeak: false }; actors.push(value);
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push('unexpected-origin'); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  page.on('pageerror', () => errors.push('page-error'));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  page.on('websocket', socket => {
    if (!socket.url().startsWith(origin.replace('https:', 'wss:') + '/')) external.push('unexpected-websocket-origin');
    socket.on('framesent', event => { const packet = JSON.parse(event.payload.toString()); if (packet.type === 'command' && ['omniscient', 'inspect', 'edit'].includes(packet.command?.type)) value.privilegedCommands++; });
    // Called only for the ordinary player: record a boolean, never any payload.
    socket.on('framereceived', event => { if (value.watchPrivacy && /"(?:privateHands|privateDeck|privateExcluded|privateCommittedAntes)"\s*:|"omniscient"\s*:\s*true/.test(event.payload.toString())) value.privateLeak = true; });
  });
  await page.goto(origin + '/3-dragon/');
  const name = page.locator('#guest-name'); await name.click(); await name.fill('验收-' + crypto.randomUUID().slice(0, 8));
  return value;
}
async function shortcut(actor) { await actor.page.locator('.tda-shell').focus(); await actor.page.keyboard.type('fuvtt'); await actor.page.keyboard.press('Enter'); }
async function closed(actor) {
  await actor.page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-omniscient') === 'false' && !document.querySelector('#table-editor'));
}
try {
  stage = 'create-own-room'; const host = await actor();
  await host.page.getByRole('button', { name: '创建房间', exact: true }).click(); await host.page.locator('.site-online-match[data-connected=true]').waitFor();
  const code = await host.page.getByTestId('online-room-code').textContent();
  stage = 'join-own-room'; const player = await actor(); player.watchPrivacy = true;
  await player.page.locator('#guest-room-code').fill(code); await player.page.getByRole('button', { name: '加入房间', exact: true }).click();
  await player.page.locator('.site-online-match[data-connected=true]').waitFor();
  pass('two fresh public browsers create and join only this run own synthetic room through actual website controls');

  stage = 'public-deal'; await host.page.getByRole('button', { name: '开始', exact: true }).click();
  for (const actor of [host, player]) { await actor.page.locator('.tda-card--hand[data-card]').first().waitFor(); assert.equal(await actor.page.locator('#omniscient-toggle').count(), 0); await closed(actor); }
  const playerOwnCards = await player.page.locator('.tda-card--hand[data-card]').count();
  pass('the actual public service deals private own hands and the website has no visible omniscient entry');

  stage = 'public-host-enable'; await shortcut(host); await host.page.locator('#table-editor').waitFor();
  assert.equal(await host.page.locator('.tda-shell').getAttribute('data-omniscient'), 'true');
  assert.equal(await host.page.locator('.tda-editor-seat').count(), 2);
  assert.equal(await player.page.locator('.tda-card--hand[data-card]').count(), playerOwnCards); await closed(player);
  assert.equal(player.privateLeak, false);
  pass('fuvtt plus Enter opens the real public host editor while the ordinary player receives no inspection payload');

  stage = 'public-player-rejection'; const sentBefore = player.privilegedCommands;
  await shortcut(player); await player.page.waitForTimeout(150); await closed(player);
  assert.equal(player.privilegedCommands, sentBefore); assert.equal(player.privateLeak, false);
  pass('the ordinary public player sequence sends no inspect or edit command and grants no host-only view');

  stage = 'public-host-close'; await host.page.locator('#table-editor-close').click(); await closed(host);
  await host.page.waitForFunction(() => document.querySelectorAll('.tda-card--hand.is-legal').length > 0);
  pass('closing the public editor immediately restores the host ordinary legal hand controls');

  stage = 'public-refresh-revocation'; await shortcut(host); await host.page.locator('#table-editor').waitFor();
  await host.page.reload(); await host.page.locator('.site-online-match[data-connected=true]').waitFor(); await closed(host);
  await host.page.getByTestId('table-new-game').waitFor();
  pass('public browser refresh preserves ownership and reconnects with inspection and editing closed');

  stage = 'public-real-websocket-close'; await shortcut(host); await host.page.locator('#table-editor').waitFor();
  await host.page.evaluate(() => { if (!window.__liveValidationSocket || window.__liveValidationSocket.readyState !== WebSocket.OPEN) throw Error('No actual validation socket'); window.__liveValidationSocket.close(1000, 'synthetic-validation'); });
  await host.page.waitForFunction(() => document.querySelector('.site-online-match')?.getAttribute('data-connected') === 'false' && document.querySelector('.tda-shell')?.getAttribute('data-omniscient') === 'false' && !document.querySelector('#table-editor'));
  assert.equal(await host.page.locator('.tda-editor-card, .tda-editor-gold').count(), 0);
  await host.page.locator('.site-online-match[data-connected=true]').waitFor(); await closed(host);
  await host.page.waitForFunction(() => document.querySelectorAll('.tda-card--hand.is-legal').length > 0);
  pass('closing the actual public WebSocket clears all host-only editor DOM before automatic reconnect and restores ordinary own actions');

  stage = 'public-final-boundaries'; assert.equal(player.privateLeak, false); assert.deepEqual(errors, []); assert.deepEqual(external, []);
  pass('public authorization checks finish with no ordinary-player private leak, script errors or external requests');
} catch (error) { failure = { stage, kind: error.name, message: 'Public synthetic website validation failed; no private payload, name, room code, token or URL query is written.' }; }
finally {
  await browser.close();
  const stats = { checks: checks.length, completed: !failure, scope: 'Actual public website and authority, one UI-created synthetic room only. No production SQL, existing rooms, account identity or dumps.' };
  writeFileSync(join(out, 'result.json'), JSON.stringify({ checks, stats, errors, external, ...(failure ? { failure } : {}) }, null, 2));
  console.log(JSON.stringify(stats)); console.log(out);
}
if (failure) throw Error(failure.stage + ': ' + failure.message);
