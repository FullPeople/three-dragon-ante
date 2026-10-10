// Public Owlbear entry pages and cached embedded website entries open the online website through native links.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, extname, join, sep } from 'node:path';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'extensions/three-dragon-ante/dist');
const base = '/three-dragon-ante-dev/', onlineURL = 'https://dnd.center/3-dragon/';
assert.ok(existsSync(join(dist, 'index.html')), 'Run npm run build first.');
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
assert.equal(manifest.background_url, base + 'background.html', 'manifest keeps the published background entry');
assert.equal(manifest.action.popover, base + 'launcher.html', 'manifest opens the link-only launcher');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  if (url.pathname === '/embed') {
    const href = (url.searchParams.get('target') || '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
    response.setHeader('Content-Type', 'text/html');
    response.end(`<iframe name="legacy-target" src="${href}"></iframe>`); return;
  }
  if (!url.pathname.startsWith(base)) { response.writeHead(404); response.end(); return; }
  const file = resolve(dist, decodeURIComponent(url.pathname.slice(base.length)) || 'index.html');
  if (!file.startsWith(dist + sep)) { response.writeHead(403); response.end(); return; }
  if (!existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  response.end(readFileSync(file));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const evidence = join(root, '.local-evidence/site-entry'); mkdirSync(evidence, { recursive: true });
const run = mkdtempSync(join(evidence, 'run-'));
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true });
const checks = [], errors = [], external = [], apiRequests = [], sockets = [];
const pass = name => { checks.push(name); console.log('PASS', name); };
try {
  for (const [layout, viewport] of [['desktop', { width: 1280, height: 900 }], ['narrow', { width: 390, height: 600 }]]) {
    const context = await browser.newContext({ viewport, locale: 'zh-CN' });
    context.on('request', request => {
      if (!request.url().startsWith(origin + '/') && request.url() !== onlineURL) external.push(request.url());
      if (request.url().includes('/three-dragon-api/')) apiRequests.push(request.url());
    });
    // Only the explicit user-clicked destination is intercepted. No real Owlbear account or production request is used.
    await context.route(onlineURL, route => route.fulfill({ contentType: 'text/html', body: '<p id="website-target">Online website</p>' }));
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') || route.request().url() === onlineURL ? route.fallback() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    page.on('websocket', socket => sockets.push(socket.url()));
    const cases = [
      ['cached full panel', 'index.html?instance=cached-panel-full&mode=full&extra=kept#resume', true],
      ['cached compact panel', 'index.html?instance=cached-panel-compact&mode=compact', true],
      ['ordinary embedded website', 'index.html?room=ABCDEFGH', true],
      ['other embedded mode', 'index.html?instance=cached-panel&mode=other', true],
      ['public table', 'table.html?instance=panel&mode=compact', false],
      ['public launcher', 'launcher.html', false],
    ];
    for (const [index, [name, suffix, embedded]] of cases.entries()) {
      const entryURL = origin + base + suffix;
      await page.goto(embedded ? origin + '/embed?target=' + encodeURIComponent(base + suffix) : entryURL);
      const host = embedded ? page.frame({ name: 'legacy-target' }) : page; assert.ok(host);
      const link = host.locator(`a[href="${onlineURL}"][target="_blank"]`).first(); await link.waitFor();
      const rel = (await link.getAttribute('rel') || '').split(/\s+/);
      assert.ok(rel.includes('noopener')); assert.ok(rel.includes('noreferrer'));
      assert.equal(host.url(), entryURL);
      assert.equal(await host.locator('.tda-shell, .site-online-form').count(), 0);
      const parentURL = page.url();
      const opened = context.waitForEvent('page');
      if (index % 2 === 0) await link.click();
      else { await link.focus(); await page.keyboard.press('Enter'); }
      const target = await opened; await target.locator('#website-target').waitFor();
      assert.equal(target.url(), onlineURL); assert.equal(page.url(), parentURL); assert.equal(host.url(), entryURL);
      await target.close();
      pass(`${layout} ${name} opens the website by ${index % 2 === 0 ? 'pointer' : 'keyboard'} and preserves its parent`);
    }
    await context.close();
  }
  for(const [locale,label] of [['zh-CN','创建房间'],['en-US','Create room']]){
    const page = await browser.newPage({locale});
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
    await page.goto(origin + base + 'index.html?instance=direct-visit&mode=full');
    await page.getByRole('button', { name: label, exact: true }).waitFor();
    assert.ok(page.url().includes('index.html?instance=direct-visit'));
    assert.equal(await page.evaluate(()=>document.documentElement.lang),locale==='zh-CN'?'zh-CN':'en');
    pass(`${locale} direct website visits retain the localized online admission form`);
    await page.close();
  }
  assert.deepEqual(apiRequests, []); assert.deepEqual(sockets, []);
  pass('link-only embedded and extension entries start no room requests or WebSocket gameplay');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  pass('entry checks have no script errors or incidental external requests');
  writeFileSync(join(run, 'result.json'), JSON.stringify({ checks, errors, external, apiRequests, sockets, realOwlbearRoom: false, scope: 'Published manifest entries, built public launcher/table and cached iframe links; native link navigation is intercepted at the website destination. No SDK identity fixture, real Owlbear account or production game data.' }, null, 2) + '\n');
  console.log(`${checks.length}/${checks.length} checks passed; ${run}`);
} finally {
  await browser.close(); await new Promise(done => server.close(done));
}
