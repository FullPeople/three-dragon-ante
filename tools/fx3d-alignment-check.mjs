// three.js 特效层对齐检查：生产构建里真实相机的投影（window.__tdaFx3d.project）必须与浏览器对同一平面点
// （插进 .tda-plane 的 0×0 DOM 标记，含离地 z）的 getBoundingClientRect 一致（< 0.5 px），桌面与窄屏各一遍。
// 顺带断言：页面零脚本错误、零外部请求、两张特效画布都挂上。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';
const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'extensions/three-dragon-ante/dist');
const base = '/three-dragon-ante-dev/';
// Compile the real pre-audit stage as a control, changing only its relative import locations.
// This fixture retains public rendering counts; it contains no room or player projections.
const area = resolve(root, '.local-evidence/fx3d-alignment'); mkdirSync(area, { recursive: true });
const evidence = mkdtempSync(resolve(area, 'run-')), control = resolve(evidence, 'control');
const stagePath = 'extensions/three-dragon-ante/src/presentation/fx3d/FxStage.ts';
const oldStage = execFileSync('git', ['show', `2c4771c4ef4015b0befc9fbfb00052a4f01d60b7:${stagePath}`], { cwd: root, encoding: 'utf8' });
writeFileSync(resolve(evidence, 'old-stage.ts'), oldStage.replace(/from "(\.{1,2}\/[^\"]+)"/g, (_, relative) => `from ${JSON.stringify('/' + resolve(root, stagePath, '..', relative).slice(root.length + 1).replaceAll('\\', '/'))}`));
const controlEntry = resolve(evidence, 'control.ts');
writeFileSync(controlEntry, 'export {mountFxStage} from "./old-stage";');
await build({ root, configFile: false, logLevel: 'error', base: base + '__fx-control/', build: { outDir: control, emptyOutDir: true, lib: { entry: controlEntry, formats: ['es'], fileName: 'control' } } });
const {createTableService}=await import(pathToFileURL(resolve(root,process.env.TDA_SERVER_OUT||'dist-server','service.mjs')));
let service;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if(path.startsWith('/three-dragon-api/v1/')){service.server.emit('request',request,response);return;}
  if (!path.startsWith(base)) { response.writeHead(404); response.end(); return; }
  const file = path.startsWith(base + '__fx-control/') ? resolve(control, path.slice((base + '__fx-control/').length)) : resolve(dist, path.slice(base.length) || 'index.html');
  if (!existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); response.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
service=createTableService({database:':memory:',origin});
server.on('upgrade',(request,socket,head)=>service.server.emit('upgrade',request,socket,head));
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let passed = 0; const pass = m => { passed++; console.log('PASS', m); };
async function startOnline(page, query) {
  await page.goto(origin + base + 'index.html' + query);
  await page.getByRole('button', { name: '创建房间', exact: true }).click();
  await page.locator('.site-online-match[data-connected="true"]').waitFor();
  const code = await page.getByTestId('online-room-code').textContent();
  const joined = await fetch(origin + '/three-dragon-api/v1/guest/rooms/' + code + '/sessions', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Camera peer' }) });
  assert.equal(joined.status, 201, 'a second synthetic seat joins the actual local authority');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.locator('.tda-card--hand[data-card]').first().waitFor();
  await page.locator('.tda-plane').waitFor({ timeout: 30000 });
}
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['narrow', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, locale: 'zh-CN', isMobile: name === 'narrow', hasTouch: name === 'narrow' });
    const external = [], errors = [];
    context.on('request', r => { if (!r.url().startsWith(origin + '/')) external.push(r.url()); });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await startOnline(page, '?fx3dDebug=1&fx3d=1');
    await page.waitForFunction(() => !!window.__tdaFx3d, null, { timeout: 15000 });
    await page.waitForTimeout(600);
    const res = await page.evaluate(() => {
      const stage = window.__tdaFx3d; if (!stage) return null;
      const plane = document.querySelector('.tda-plane');
      const pts = [[0, 0, 0], [900, 550, 0], [720, 520, 0], [900, 430, 120], [300, 900, 250], [1500, 200, 60], [550, 750, 0], [550, 1400, 300]];
      const card = document.querySelector('.tda-card--hand'); const cr = card.getBoundingClientRect(); const hit = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
      const x = cr.left + cr.width / 2, y = cr.top + cr.height / 2, tableRect = document.querySelector('.tda-table').getBoundingClientRect();
      const transformAnimations = card.getAnimations().filter(animation => animation.effect?.getKeyframes().some(frame => 'transform' in frame));
      const transformAnimationRunning = transformAnimations.some(animation => animation.playState === 'running'), transformAnimationPending = transformAnimations.some(animation => animation.pending);
      const hitCategory = !hit ? 'none' : hit instanceof HTMLCanvasElement ? 'canvas' : hit.closest('.tda-card') ? 'card' : hit.closest('.tda-spotlight, .tda-formation-spot, .tda-score, .tda-choice, .tda-confirm-overlay, .site-confirm-overlay, .tda-help, .tda-lobby-board, .tda-inspector') ? 'overlay' : 'other';
      const publicDiagnostic = { stageAvailable: stage.available, stageEffects: stage.frameStats().effects,
        cardRect: { left: cr.left, top: cr.top, width: cr.width, height: cr.height }, viewport: { width: innerWidth, height: innerHeight }, point: { x, y },
        pointInsideViewport: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight, pointInsideTable: x >= tableRect.left && y >= tableRect.top && x < tableRect.right && y < tableRect.bottom,
        arriving: card.classList.contains('is-arriving'), entering: card.classList.contains('is-entering'), hovered: card.classList.contains('is-hovered'),
        transformAnimationRunning, transformAnimationPending, transformAnimationsIdle: !transformAnimationRunning && !transformAnimationPending,
        hitCategory, hitIsFxCanvas: hit === document.querySelector('.tda-fx3d-air') || hit === document.querySelector('.tda-fx3d-ground'),
        airPointerEventsNone: getComputedStyle(document.querySelector('.tda-fx3d-air')).pointerEvents === 'none', groundPointerEventsNone: getComputedStyle(document.querySelector('.tda-fx3d-ground')).pointerEvents === 'none', cardPointerEventsNone: getComputedStyle(card).pointerEvents === 'none',
        busy: document.querySelector('.tda-shell')?.dataset.busy === 'true', powerVisible: !!document.querySelector('.tda-spotlight'), revealActive: !!document.querySelector('.tda-root')?.dataset.reveal,
        choiceVisible: !!document.querySelector('.tda-choice'), scoreVisible: !!document.querySelector('.tda-score'), confirmationVisible: !!document.querySelector('.tda-confirm-overlay, .site-confirm-overlay'), helpVisible: !!document.querySelector('.tda-help') };
      return { tier: stage.tier, ground: !!stage.ground, air: !!document.querySelector('.tda-fx3d-air'), groundCanvas: !!document.querySelector('.tda-plane > .tda-fx3d-ground'), dataFx: document.querySelector('.tda-shell')?.getAttribute('data-fx'), airShown: getComputedStyle(document.querySelector('.tda-fx3d-air')).display !== 'none', hitIsCard: !!hit && !!hit.closest('.tda-card'),
        publicDiagnostic,
        rows: pts.map(([x, y, z]) => { const el = document.createElement('div'); el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;transform:translateZ(${z}px)`; plane.appendChild(el); const r = el.getBoundingClientRect(); el.remove(); const p = stage.project(x, y, z); return { x, y, z, err: Math.hypot(p.x - r.left, p.y - r.top) }; }) };
    });
    writeFileSync(resolve(evidence, name + '-public-diagnostic.json'), JSON.stringify({ viewportKind: name, stageSnapshotPresent: !!res, airShown: res?.airShown ?? null, hitIsCard: res?.hitIsCard ?? null, ...res?.publicDiagnostic }, null, 2));
    console.log('PUBLIC', name, JSON.stringify({ airShown: res?.airShown ?? null, hitIsCard: res?.hitIsCard ?? null }));
    assert.ok(res, `${name}: fx3d stage mounted (window.__tdaFx3d)`);
    assert.ok(res.air && res.groundCanvas && res.ground, `${name}: air and ground canvases present`);
    const worst = Math.max(...res.rows.map(r => r.err));
    assert.ok(worst < 0.5, `${name}: camera matches CSS projection (worst ${worst.toFixed(3)} px)`);
    pass(`${name} three.js camera matches the CSS 2.5D projection within ${worst.toFixed(3)} px over ${res.rows.length} points (tier ${res.tier})`);
    assert.equal(res.dataFx, `three-${res.tier}`, `${name}: root data-fx reflects the stage tier`);
    assert.ok(res.airShown && res.hitIsCard, `${name}: effects canvases never intercept pointer hits on cards`);
    pass(`${name} canvases are visible while effects run yet pointer hits still land on cards (data-fx=${res.dataFx})`);
    assert.equal(errors.length, 0, `${name}: no page errors: ${errors.join(' | ')}`);
    assert.equal(external.length, 0, `${name}: no external requests: ${external.join(' ')}`);
    pass(`${name} no script errors and no external requests with the effects stage mounted`);
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', error => errors.push(String(error)));
    context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
    await startOnline(page, '');
    await page.waitForTimeout(1500);
    const gate = await page.evaluate(() => ({ mode: document.querySelector('.tda-shell')?.getAttribute('data-fx'), air: getComputedStyle(document.querySelector('.tda-fx3d-air')).display, ground: getComputedStyle(document.querySelector('.tda-fx3d-ground')).display }));
    assert.equal(gate.mode, 'canvas2d', 'unforced software GL uses the full 2D adapter');
    assert.equal(gate.air, 'none'); assert.equal(gate.ground, 'none');
    assert.equal(errors.length, 0, errors.join(' | ')); assert.equal(external.length, 0);
    pass('software GL without the force flag keeps both fx3d canvases hidden and reports canvas2d');
    await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
    await context.addInitScript(() => { localStorage.setItem('tda.fx', 'high'); });
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (/shader error|VALIDATE_STATUS|failed to compile/i.test(message.text())) errors.push(message.text()); });
    context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
    await startOnline(page, '?fx3d=1&fx3dGallery=scripts');
    await page.waitForFunction(() => !!window.__tdaFx && !!window.__tdaFx3d, null, { timeout: 15000 });
    const comparison = await page.evaluate(async controlUrl => {
      const nativeRaf = window.requestAnimationFrame;
      let logicalFrame = null;
      window.requestAnimationFrame = callback => nativeRaf.call(window, now => { const previous = logicalFrame; logicalFrame = now; try { callback(now); } finally { logicalFrame = previous; } });
      async function sample(stage) {
        const render = stage.air.renderer.render, ticks = new Map(), before = stage.frameStats?.();
        let triggered = 0, updates = 0;
        stage.air.renderer.render = function (...args) { ticks.set(logicalFrame, (ticks.get(logicalFrame) ?? 0) + 1); return Reflect.apply(render, this, args); };
        const until = performance.now() + 900;
        try {
          stage.add({ update(_dt, now) { updates++; if (triggered < 3) { triggered++; stage.add({ update: (_dt, time) => time < until }); stage.wake(); } return now < until; } });
          await new Promise(resolve => setTimeout(resolve, 1250));
          const after = stage.frameStats?.();
          return { tier: stage.tier, triggered, updates, ticks: ticks.size, maxRendersPerTick: Math.max(...ticks.values()), effectsAfter: after?.effects ?? null, frames: before && after ? after.frames - before.frames : null, renders: before && after ? after.renders - before.renders : null };
        } finally { stage.air.renderer.render = render; }
      }
      let old;
      try {
        const module = await import(controlUrl), host = document.querySelector('.tda-table'), air = document.createElement('canvas'), ground = document.createElement('canvas');
        host.appendChild(air); document.querySelector('.tda-plane').appendChild(ground);
        try {
          old = module.mountFxStage(host, air, ground); if (!old) throw new Error('historical stage did not mount');
          const baseline = await sample(old), stage = window.__tdaFx3d, candidate = await sample(stage);
          // Retain the incoming actual persistent tether + four beam workload alongside the strong nested-wake control.
          const point = selector => { const rect = document.querySelector(selector)?.getBoundingClientRect(); if (!rect) throw new Error('public anchor missing'); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; };
          const fx = window.__tdaFx, plate = point('[data-seat-plate]'), deck = point('[data-pile="deck"]'), start = stage.frameStats();
          const render = stage.air.renderer.render, ticks = new Map();
          stage.air.renderer.render = function (...args) { ticks.set(logicalFrame, (ticks.get(logicalFrame) ?? 0) + 1); return Reflect.apply(render, this, args); };
          let workload;
          try {
            fx.ambient('chain:hold', { kind: 'ember', rate: 3, area: { x: plate.x - 90, y: plate.y - 50, w: 180, h: 100 }, drift: { x: 0, y: -22 }, size: 2.4, life: 2, alpha: 0.75, hold: { who: 'other', code: 'GIVE_DRAGON_OR_GOLD', from: deck } });
            for (let i = 0; i < 4; i++) { void fx.beam(deck, plate, 'tide', 600); await new Promise(resolve => setTimeout(resolve, 350)); }
            await new Promise(resolve => setTimeout(resolve, 600));
            const finish = stage.frameStats(); fx.ambient('chain:hold', null);
            await new Promise(resolve => setTimeout(resolve, 2600));
            workload = { frames: finish.frames - start.frames, renders: finish.renders - start.renders, maxRendersPerTick: Math.max(...ticks.values()), effectsAfter: stage.frameStats().effects };
          } finally { fx.ambient('chain:hold', null); stage.air.renderer.render = render; }
          return { baseline, candidate, workload };
        }
        finally { old?.destroy(); air.remove(); ground.remove(); }
      } finally { window.requestAnimationFrame = nativeRaf; }
    }, origin + base + '__fx-control/control.js');
    writeFileSync(resolve(evidence, 'render-chain.json'), JSON.stringify(comparison, null, 2));
    console.log('PUBLIC render-chain', JSON.stringify({
      baseline: { triggered: comparison.baseline.triggered, updates: comparison.baseline.updates, ticks: comparison.baseline.ticks, maxRendersPerTick: comparison.baseline.maxRendersPerTick, frames: comparison.baseline.frames, renders: comparison.baseline.renders, effectsAfter: comparison.baseline.effectsAfter },
      candidate: { triggered: comparison.candidate.triggered, updates: comparison.candidate.updates, ticks: comparison.candidate.ticks, maxRendersPerTick: comparison.candidate.maxRendersPerTick, frames: comparison.candidate.frames, renders: comparison.candidate.renders, effectsAfter: comparison.candidate.effectsAfter },
      workload: { frames: comparison.workload.frames, renders: comparison.workload.renders, maxRendersPerTick: comparison.workload.maxRendersPerTick, effectsAfter: comparison.workload.effectsAfter }
    }));
    assert.equal(comparison.baseline.triggered, 3); assert.equal(comparison.candidate.triggered, 3);
    assert.ok(comparison.baseline.ticks > 20 && comparison.candidate.ticks > 20, 'both real renderers sample enough browser ticks');
    assert.ok(comparison.baseline.maxRendersPerTick > 1, 'historical real source reproduces multiple renders in one browser frame');
    assert.equal(comparison.candidate.maxRendersPerTick, 1, 'nested add/wake preserves a single chain per actual browser timestamp');
    assert.equal(comparison.candidate.tier, 'high'); assert.equal(comparison.candidate.effectsAfter, 0);
    assert.ok(comparison.workload.frames > 20); assert.ok(comparison.workload.renders <= comparison.workload.frames + 1);
    assert.equal(comparison.workload.maxRendersPerTick, 1); assert.equal(comparison.workload.effectsAfter, 0);
    assert.equal(errors.length, 0, errors.join(' | ')); assert.equal(external.length, 0);
    pass(`high tier nested add/wake: historical ${comparison.baseline.maxRendersPerTick} renders/tick, candidate ${comparison.candidate.maxRendersPerTick}`);
    await context.close();
  }
} finally { await browser.close(); await service.close(); await new Promise(done=>server.close(done)); }
// No entry preloads three: it becomes a lazy dependency only after the actual table mounts.
for (const html of ['launcher.html', 'background.html', 'index.html', 'table.html']) { const text = readFileSync(resolve(dist, html), 'utf8'); assert.ok(!/assets\/three-[\w-]+\.js/.test(text), `${html} must not statically reference the three chunk`); }
assert.ok(readdirSync(resolve(dist, 'assets')).some(file => /^three-[\w-]+\.js$/.test(file)), 'the lazy three chunk is still included in the local build');
pass('bundle gate: three.js is a lazy chunk, referenced by no HTML entry');
console.log(`${passed} checks passed`);
