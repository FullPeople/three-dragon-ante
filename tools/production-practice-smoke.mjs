import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'extensions/three-dragon-ante/dist');
const base = '/three-dragon-ante-dev/';
assert.ok(existsSync(join(dist, 'practice.html')), 'Run npm run build first.');
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
  assert.equal(manifest.version, '0.7.21-dev');
  assert.equal(manifest.background_url, base + 'background.html');
  pass('independent manifest preserves version and published entry paths');
  for (const [name, viewport] of [['desktop', { width: 1440, height: 960 }], ['narrow', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: name === 'narrow' });
    context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    page.on('response', response => { if (response.status() >= 400) failures.push(response.status() + ' ' + response.url()); });
    await page.goto(origin + base + 'practice.html');
    await page.getByRole('button', { name: '开始完整练习', exact: true }).click();
    await page.locator('.tda-tutorial #hand [data-card]').first().waitFor({ state: 'attached', timeout: 30000 });
    assert.ok(await page.locator('.tda-tutorial #hand [data-card]').count() > 0);
    await page.getByRole('button', { name: '重新练习', exact: true }).click();
    await page.locator('.tda-tutorial #hand [data-card]').first().waitFor({ state: 'attached' });
    await page.screenshot({ path: join(output, name + '.png'), fullPage: true });
    pass(name + ' production practice loads real cards and restarts');
    await page.getByRole('button', { name: '返回体验说明', exact: true }).click();
    await page.getByRole('button', { name: '查看手牌能力特效', exact: true }).click();
    await page.locator('.tda-tutorial #hand [data-card]').first().waitFor({ state: 'attached' });
    await page.getByRole('button', { name: '返回体验说明', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: '开始完整练习', exact: true }).waitFor();
    pass(name + ' exit, alternate exercise, re-entry and fresh reload work');
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  assert.deepEqual(external, []);
  pass('no script errors, failed assets or Owlbear/production requests');
  writeFileSync(join(output, 'result.json'), JSON.stringify({ checks, errors, failures, external, realOwlbearRoom: false, scope: 'Built production practice on desktop and narrow viewport; no authenticated room or physical device.' }, null, 2) + '\n');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
