// three.js 特效层对齐检查：生产构建里真实相机的投影（window.__tdaFx3d.project）必须与浏览器对同一平面点
// （插进 .tda-plane 的 0×0 DOM 标记，含离地 z）的 getBoundingClientRect 一致（< 0.5 px），桌面与窄屏各一遍。
// 顺带断言：页面零脚本错误、零外部请求、两张特效画布都挂上。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';
const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'extensions/three-dragon-ante/dist');
const base = '/three-dragon-ante-dev/';
const {createTableService}=await import(pathToFileURL(resolve(root,process.env.TDA_SERVER_OUT||'dist-server','service.mjs')));
let service;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if(path.startsWith('/three-dragon-api/v1/')){service.server.emit('request',request,response);return;}
  if (!path.startsWith(base)) { response.writeHead(404); response.end(); return; }
  const file = resolve(dist, path.slice(base.length) || 'index.html');
  if (!existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }); response.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
service=createTableService({database:':memory:',origin});
server.on('upgrade',(request,socket,head)=>service.server.emit('upgrade',request,socket,head));
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
    await page.goto(origin + base + 'index.html?fx3dDebug=1');
    await page.getByRole('button', { name: '创建房间', exact: true }).click();
    await page.locator('.site-online-match[data-connected="true"]').waitFor();
    const code=await page.getByTestId('online-room-code').textContent();
    const joined=await fetch(origin+'/three-dragon-api/v1/guest/rooms/'+code+'/sessions',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Camera peer'})});
    assert.equal(joined.status,201,'a second synthetic seat joins the actual local authority');
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.locator('.tda-card--hand[data-card]').first().waitFor();
    await page.locator('.tda-plane').waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    const res = await page.evaluate(() => {
      const stage = window.__tdaFx3d; if (!stage) return null;
      const plane = document.querySelector('.tda-plane');
      const pts = [[0, 0, 0], [900, 550, 0], [720, 520, 0], [900, 430, 120], [300, 900, 250], [1500, 200, 60], [550, 750, 0], [550, 1400, 300]];
      return { tier: stage.tier, ground: !!stage.ground, air: !!document.querySelector('.tda-fx3d-air'), groundCanvas: !!document.querySelector('.tda-plane > .tda-fx3d-ground'),
        rows: pts.map(([x, y, z]) => { const el = document.createElement('div'); el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;transform:translateZ(${z}px)`; plane.appendChild(el); const r = el.getBoundingClientRect(); el.remove(); const p = stage.project(x, y, z); return { x, y, z, err: Math.hypot(p.x - r.left, p.y - r.top) }; }) };
    });
    assert.ok(res, `${name}: fx3d stage mounted (window.__tdaFx3d)`);
    assert.ok(res.air && res.groundCanvas && res.ground, `${name}: air and ground canvases present`);
    const worst = Math.max(...res.rows.map(r => r.err));
    assert.ok(worst < 0.5, `${name}: camera matches CSS projection (worst ${worst.toFixed(3)} px)`);
    pass(`${name} three.js camera matches the CSS 2.5D projection within ${worst.toFixed(3)} px over ${res.rows.length} points (tier ${res.tier})`);
    assert.equal(errors.length, 0, `${name}: no page errors: ${errors.join(' | ')}`);
    assert.equal(external.length, 0, `${name}: no external requests: ${external.join(' ')}`);
    pass(`${name} no script errors and no external requests with the effects stage mounted`);
    await context.close();
  }
} finally { await browser.close(); await service.close(); await new Promise(done=>server.close(done)); }
console.log(`${passed} checks passed`);
