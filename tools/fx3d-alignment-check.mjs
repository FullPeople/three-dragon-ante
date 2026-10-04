// three.js 特效层对齐检查：生产构建里真实相机的投影（window.__tdaFx3d.project）必须与浏览器对同一平面点
// （插进 .tda-plane 的 0×0 DOM 标记，含离地 z）的 getBoundingClientRect 一致（< 0.5 px），桌面与窄屏各一遍。
// 顺带断言：页面零脚本错误、零外部请求、两张特效画布都挂上。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';
const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'extensions/three-dragon-ante/dist');
const base = '/three-dragon-ante-dev/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (!path.startsWith(base)) { response.writeHead(404); response.end(); return; }
  const file = resolve(dist, path.slice(base.length) || 'index.html');
  if (!existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); response.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let passed = 0; const pass = m => { passed++; console.log('PASS', m); };
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['narrow', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, locale: 'zh-CN', isMobile: name === 'narrow', hasTouch: name === 'narrow' });
    const external = [], errors = [];
    context.on('request', r => { if (!r.url().startsWith(origin + '/')) external.push(r.url()); });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(origin + base + 'index.html?fx3dDebug=1&fx3d=1');
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.locator('.tda-plane').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => !!window.__tdaFx3d, null, { timeout: 15000 });
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => {
      const stage = window.__tdaFx3d; if (!stage) return null;
      const plane = document.querySelector('.tda-plane');
      const pts = [[0, 0, 0], [900, 550, 0], [720, 520, 0], [900, 430, 120], [300, 900, 250], [1500, 200, 60], [550, 750, 0], [550, 1400, 300]];
      const card = document.querySelector('.tda-card--hand'); const cr = card.getBoundingClientRect(); const hit = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
      return { tier: stage.tier, ground: !!stage.ground, air: !!document.querySelector('.tda-fx3d-air'), groundCanvas: !!document.querySelector('.tda-plane > .tda-fx3d-ground'), dataFx: document.querySelector('.tda-shell')?.getAttribute('data-fx'), airShown: getComputedStyle(document.querySelector('.tda-fx3d-air')).display !== 'none', hitIsCard: !!hit && !!hit.closest('.tda-card'),
        rows: pts.map(([x, y, z]) => { const el = document.createElement('div'); el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;transform:translateZ(${z}px)`; plane.appendChild(el); const r = el.getBoundingClientRect(); el.remove(); const p = stage.project(x, y, z); return { x, y, z, err: Math.hypot(p.x - r.left, p.y - r.top) }; }) };
    });
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

  // 默认模式（不带 ?fx3d=1）：软件 GL 不建舞台，两张画布保持隐藏、根标 canvas2d（审计 H2：不能留下丢失上下文的白方块）
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto(origin + base + 'index.html');
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.locator('.tda-plane').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    const d = await page.evaluate(() => ({ fx: document.querySelector('.tda-shell')?.getAttribute('data-fx'), air: getComputedStyle(document.querySelector('.tda-fx3d-air')).display, ground: getComputedStyle(document.querySelector('.tda-fx3d-ground')).display }));
    assert.equal(d.fx, 'canvas2d', 'software GL without ?fx3d=1 falls back to canvas2d');
    assert.ok(d.air === 'none' && d.ground === 'none', 'fx3d canvases stay hidden when no stage is mounted');
    pass('software GL without the force flag keeps both fx3d canvases hidden and reports canvas2d');
    await context.close();
  }
  // 高档单条渲染链：驻留（系绳）+ 飘带同时活动时，渲染次数不得超过 rAF 帧数（审计 H1）
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
    await context.addInitScript(() => { try { localStorage.setItem('tda.fx', 'high'); } catch {} });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(origin + base + 'index.html?fx3d=1&fx3dGallery=scripts&opponents=2');
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.locator('.tda-plane').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => !!window.__tdaFx && !!window.__tdaFx3d, null, { timeout: 15000 });
    const stats = await page.evaluate(async () => {
      const el = sel => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
      const fx = window.__tdaFx, stage = window.__tdaFx3d;
      const plate = el('[data-seat-plate]:not([data-seat-plate="you"])'), deck = el('[data-pile="deck"]');
      fx.ambient('t:hold', { kind: 'ember', rate: 3, area: { x: plate.x - 90, y: plate.y - 50, w: 180, h: 100 }, drift: { x: 0, y: -22 }, size: 2.4, life: 2, alpha: 0.75, hold: { who: 'other', code: 'GIVE_DRAGON_OR_GOLD', from: deck } });
      const s0 = stage.frameStats();
      for (let i = 0; i < 4; i++) { void fx.beam(deck, plate, 'tide', 600); await new Promise(r => setTimeout(r, 350)); }
      await new Promise(r => setTimeout(r, 600));
      const s1 = stage.frameStats();
      fx.ambient('t:hold', null);
      await new Promise(r => setTimeout(r, 2600));   // 最后一条系绳飘带（1.3 s）+ 其火星（0.7 s）+ 淡出要走完
      return { tier: stage.tier, frames: s1.frames - s0.frames, renders: s1.renders - s0.renders, effectsAfter: stage.frameStats().effects };
    });
    assert.equal(stats.tier, 'high', 'forced flag honours the stored high preference');
    assert.ok(stats.frames > 20, `enough frames sampled (${stats.frames})`);
    assert.ok(stats.renders <= stats.frames + 1, `one render per animation frame at most (renders ${stats.renders}, frames ${stats.frames})`);
    assert.equal(stats.effectsAfter, 0, 'effects are released after the hold ends');
    assert.equal(errors.length, 0, errors.join(' | '));
    pass(`high tier keeps a single render chain under hold + beams (${stats.renders} renders / ${stats.frames} frames)`);
    await context.close();
  }
} finally { await browser.close(); server.close(); }
// 分包闸：three 只随牌桌 mount 加载，枭熊的后台页与启动器页不得引用 three chunk
for (const html of ['launcher.html', 'background.html', 'index.html', 'table.html']) { const text = readFileSync(resolve(dist, html), 'utf8'); assert.ok(!/assets\/three-[\w-]+\.js/.test(text), `${html} must not statically reference the three chunk (lazy-loaded)`); }
assert.ok(readdirSync(resolve(dist, 'assets')).some(f => /^three-[\w-]+\.js$/.test(f)), 'the three chunk exists in dist/assets');
pass('bundle gate: three.js is a lazy chunk, referenced by no HTML entry');
console.log(`${passed} checks passed`);
