// 独立网站生产构建冒烟：首页 → 开局 → 暗置 → 翻注 → 出牌；桌面与手机各一遍；零脚本错误、零失败资源、零外部请求。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'extensions/three-dragon-ante/dist');
const base = '/three-dragon-ante-dev/';
assert.ok(existsSync(join(dist, 'index.html')), 'Run npm run build first.');
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ogg': 'audio/ogg' };
const server = createServer((request, response) => {
  const path = new URL(request.url || '/', 'http://localhost').pathname;
  if (!path.startsWith(base)) { response.writeHead(404); response.end(); return; }
  const file = resolve(dist, decodeURIComponent(path.slice(base.length)) || 'index.html');
  if (!file.startsWith(dist + '/') && !file.startsWith(dist + '\\')) { response.writeHead(403); response.end(); return; }
  if (!existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', contentTypes[extname(file)] || 'application/octet-stream');
  response.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const output = join(root, '.local-evidence/browser');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const checks = [], errors = [], external = [], failures = [];
const pass = name => { checks.push(name); console.log('PASS ' + name); };
try {
  const manifest = await (await fetch(origin + base + 'manifest.json')).json();
  assert.equal(manifest.background_url, base + 'background.html');
  assert.equal(manifest.action.popover, base + 'launcher.html');
  pass('manifest keeps the published background and launcher entries');
  assert.ok(existsSync(join(dist, 'table.html')), 'Owlbear table page is built');
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['narrow', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, locale: 'zh-CN', hasTouch: name === 'narrow', isMobile: name === 'narrow' });
    context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failures.push(response.status() + ' ' + response.url()); });
    await page.goto(origin + base + 'index.html');
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.locator('.tda-card--hand').first().waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForTimeout(1500);
    const hand = await page.locator('.tda-card--hand').count();
    assert.ok(hand >= 1, 'hand rendered');
    const surface = await page.evaluate(() => { const c = document.querySelector('.tda-surface-gl'); return c ? (c.dataset.fallback ? 'css' : 'webgl') : 'none'; });
    assert.notEqual(surface, 'none', 'table surface mounted');
    pass(`${name} site opens a local match (${hand} cards, surface ${surface})`);
    // 暗置：选最后一张合法牌，点自己的暗置槽；回执落地后 pending 标记清空
    const legal = page.locator('.tda-card--hand.is-legal').last();
    const cardId = await legal.getAttribute('data-card');
    await legal.click({ force: true, position: { x: 70, y: 40 } });
    await page.locator('[data-drop-zone="ante"][data-drop-seat="you"]').click({ force: true });
    await page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-pending-action') === 'false', null, { timeout: 10000 });
    assert.equal(await page.evaluate(id => document.querySelector(`[data-card="${id}"]`)?.getAttribute('data-zone'), cardId), 'ante');
    pass(`${name} ante is committed through the real action path`);
    // 机器人跟注、翻注、进入出牌阶段
    await page.waitForFunction(() => ['play', 'choice'].includes(document.querySelector('.tda-shell')?.getAttribute('data-phase') || ''), null, { timeout: 30000 });
    pass(`${name} reveal completes and play phase begins`);
    await page.screenshot({ path: join(output, name + '.png') });
    // 退出回首页，再进一局
    await page.getByRole('button', { name: '离开', exact: true }).click();
    await page.getByRole('button', { name: '开始', exact: true }).waitFor();
    await page.getByRole('button', { name: '开始', exact: true }).click();
    await page.locator('.tda-card--hand').first().waitFor({ state: 'attached', timeout: 30000 });
    await page.reload();
    await page.getByRole('button', { name: '开始', exact: true }).waitFor();
    pass(`${name} leave, re-enter and fresh reload work`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  assert.deepEqual(external, []);
  pass('no script errors, failed assets or external requests');
  writeFileSync(join(output, 'result.json'), JSON.stringify({ checks, errors, failures, external, realOwlbearRoom: false, scope: 'Built standalone site on desktop and narrow viewport; local bot match only.' }, null, 2) + '\n');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
