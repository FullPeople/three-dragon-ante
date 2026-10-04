// Public acceptance: only this run's synthetic UI-created room. Never reads production SQL or stores projections.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const originIndex = process.argv.indexOf('--origin');
const origin = originIndex >= 0 ? process.argv[originIndex + 1] : '';
assert.equal(origin, 'https://obr.dnd.center', 'Explicit --origin https://obr.dnd.center is required.');
const gpuIndex = process.argv.indexOf('--gpu'), gpuMode = gpuIndex >= 0 ? process.argv[gpuIndex + 1] : 'software';
assert.ok(['software', 'default'].includes(gpuMode), 'GPU mode must be software or default.');
const root = resolve(import.meta.dirname, '..'), evidenceRoot = join(root, '.local-evidence/website-omniscient-live');
mkdirSync(evidenceRoot, { recursive: true }); const out = mkdtempSync(join(evidenceRoot, 'run-'));
const checks = [], errors = [], external = [], actors = [];
let failure, stage = 'startup';
const pass = label => { checks.push(label); console.log('PASS ' + label); };
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--no-proxy-server', '--enable-webgl', ...(gpuMode === 'software' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
async function actor() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__liveGpuClasses = [];
    const nativeContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const context = nativeContext.apply(this, args);
      if (context && ['webgl', 'webgl2'].includes(args[0]) && window.__liveGpuClasses.length < 8) {
        const ext = context.getExtension('WEBGL_debug_renderer_info');
        const renderer = ext ? String(context.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
        const kind = /swiftshader|llvmpipe|softpipe|software|microsoft basic render|warp/i.test(renderer) ? 'software' : /nvidia|radeon|intel|apple gpu|adreno|mali/i.test(renderer) ? 'reported-hardware' : 'unknown';
        window.__liveGpuClasses.push(kind);
      }
      return context;
    };
    const NativeWebSocket = window.WebSocket;
    window.__liveSocketEvents = [];
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        if (String(args[0]).includes('/three-dragon-api/v1/socket')) {
          window.__liveValidationSocket = this;
          const record = value => { if (window.__liveSocketEvents.length < 16) window.__liveSocketEvents.push({ ms: Date.now(), ...value }); };
          this.addEventListener('open', () => record({ kind: 'open' }));
          this.addEventListener('close', event => record({ kind: 'close', code: event.code, reason: ['authenticationRequired', 'notAllowed', 'sessionReplaced'].includes(event.reason) ? event.reason : 'other' }));
        }
      }
    };
  });
  const page = await context.newPage(), value = { context, page, privilegedCommands: 0, privateLeak: false, admissions: [], admissionEvents: [], viewEvents: [] }; actors.push(value);
  const guestOperation = request => {
    if (request.method() !== 'POST') return null;
    const path = new URL(request.url()).pathname;
    if (path === '/three-dragon-api/v1/guest/rooms') return 'create';
    return /^\/three-dragon-api\/v1\/guest\/rooms\/[^/]+\/sessions$/.test(path) ? 'join' : null;
  };
  const admissionEvent = (request, details) => {
    const operation = guestOperation(request);
    if (operation && value.admissionEvents.length < 16) value.admissionEvents.push({ ms: Date.now(), operation, ...details });
  };
  page.on('request', request => admissionEvent(request, { kind: 'request' }));
  page.on('requestfailed', request => admissionEvent(request, { kind: 'failed', failure: request.failure()?.errorText === 'net::ERR_ABORTED' ? 'aborted' : 'other' }));
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push('unexpected-origin'); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  page.on('pageerror', () => errors.push('page-error'));
  page.on('response', async response => {
    if (response.request().method() !== 'POST' || !new URL(response.url()).pathname.startsWith('/three-dragon-api/v1/guest/')) return;
    admissionEvent(response.request(), { kind: 'response', status: response.status() });
    try {
      const body = await response.json(), allowed = ['nameTaken', 'invalidName', 'invalidRoomCode', 'roomMissing', 'roomFull', 'notAllowed', 'gameStarted', 'rateLimited'];
      if (value.admissions.length < 8) value.admissions.push({ ms: Date.now(), status: response.status(), error: body.error == null ? null : allowed.includes(body.error) ? body.error : 'other' });
    } catch {}
  });
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  page.on('websocket', socket => {
    if (!socket.url().startsWith(origin.replace('https:', 'wss:') + '/')) external.push('unexpected-websocket-origin');
    socket.on('framesent', event => { const packet = JSON.parse(event.payload.toString()); if (packet.type === 'command' && ['omniscient', 'inspect', 'edit'].includes(packet.command?.type)) value.privilegedCommands++; });
    socket.on('close', () => { if (value.viewEvents.length < 32) value.viewEvents.push({ ms: Date.now(), kind: 'close' }); });
    // Inspect this run's own frame in memory only; retain booleans, never payload or identity.
    socket.on('framereceived', event => {
      if (value.watchPrivacy && /"(?:privateHands|privateDeck|privateExcluded|privateCommittedAntes)"\s*:|"omniscient"\s*:\s*true/.test(event.payload.toString())) value.privateLeak = true;
      try {
        const packet = JSON.parse(event.payload.toString()), state = packet.type === 'view' ? packet.view : packet.type === 'patch' ? packet.patch?.set : null;
        if (state && typeof state.isHost === 'boolean' && value.viewEvents.length < 32) value.viewEvents.push({ ms: Date.now(), kind: packet.type, isHost: state.isHost });
      } catch {}
    });
  });
  await page.goto(origin + '/three-dragon-ante/');
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
  assert.match(code, /^[A-Z0-9]{8}$/);
  stage = 'join-own-room'; const player = await actor(); player.watchPrivacy = true;
  stage = 'join-own-room-fill'; await player.page.locator('#guest-room-code').fill(code);
  assert.equal(await player.page.locator('#guest-room-code').inputValue(), code);
  stage = 'join-own-room-submit'; await player.page.getByRole('button', { name: '加入房间', exact: true }).click();
  stage = 'join-own-room-connected';
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
  stage = 'public-refresh-navigation'; await host.page.reload();
  stage = 'public-refresh-connected'; await host.page.locator('.site-online-match[data-connected=true]').waitFor();
  stage = 'public-refresh-closed'; await closed(host);
  stage = 'public-refresh-ownership';
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
} catch (error) {
  const diagnostics = [];
  for (const actor of actors) try {
    const browser = await actor.page.evaluate(() => {
      const error = document.querySelector('.site-room-error')?.textContent?.trim();
      const codes = { '名字须为 1–60 字': 'invalidName', '房间码须为 8 位': 'invalidRoomCode', '名字已占用': 'nameTaken', '房间不存在': 'roomMissing', '重连凭据已失效': 'notAllowed', '连接超时': 'requestTimeout', '连接失败': 'requestFailed', '服务版本不匹配': 'protocolMismatch' };
      const code = document.querySelector('#guest-room-code')?.value, name = document.querySelector('#guest-name')?.value;
      return { connected: document.querySelector('.site-online-match')?.getAttribute('data-connected') ?? null, homePresent: !!document.querySelector('.site-home'), omniscient: document.querySelector('.tda-shell')?.getAttribute('data-omniscient') ?? null, editorPresent: !!document.querySelector('#table-editor'), newGamePresent: !!document.querySelector('[data-testid=table-new-game]'), errorCode: error == null ? null : codes[error] || 'other', nameLength: name?.length ?? null, roomCodeLength: code?.length ?? null, roomCodeValid: code == null ? null : /^[A-Z0-9]{8}$/.test(code), joinDisabled: document.querySelector('.site-online-form button[type=submit]')?.disabled ?? null, socketEvents: window.__liveSocketEvents || [], gpuClasses: window.__liveGpuClasses || [] };
    });
    diagnostics.push({ admissions: actor.admissions, admissionEvents: actor.admissionEvents, viewEvents: actor.viewEvents, ...browser });
  } catch {}
  failure = { stage, kind: ['TimeoutError', 'AssertionError', 'Error'].includes(error.name) ? error.name : 'OtherError', diagnostics, message: 'Public synthetic website validation failed; no private payload, name, room code, token or URL query is written.' };
}
finally {
  const gpuClasses = [];
  for (const actor of actors) try { gpuClasses.push(await actor.page.evaluate(() => window.__liveGpuClasses || [])); } catch {}
  await browser.close();
  const stats = { checks: checks.length, completed: !failure, gpuMode, gpuClasses, scope: 'Actual public website and authority, one UI-created synthetic room only. No production SQL, existing rooms, account identity or dumps.' };
  writeFileSync(join(out, 'result.json'), JSON.stringify({ checks, stats, errors, external, ...(failure ? { failure } : {}) }, null, 2));
  console.log(JSON.stringify(stats)); console.log(out);
}
if (failure) throw Error(failure.stage + ': ' + failure.message);
