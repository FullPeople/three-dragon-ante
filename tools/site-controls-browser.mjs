// Online-only production website controls. This replaces the removed local bot-match smoke test.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, extname, join, sep } from 'node:path';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'extensions/three-dragon-ante/dist'), base = '/three-dragon-ante-dev/';
assert.ok(existsSync(join(dist, 'index.html')), 'Run npm run build first.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ogg': 'audio/ogg' };
const requests = [], errors = [], external = [], failures = [], checks = [];
const pass = name => { checks.push(name); console.log('PASS ' + name); };
const server = createServer((request, response) => {
  requests.push(request.url);
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (!pathname.startsWith(base)) { response.writeHead(404); response.end(); return; }
  const file = resolve(dist, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
  if (!file.startsWith(dist + sep) || !existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  response.end(readFileSync(file));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const evidence = join(root, '.local-evidence/site-controls'); mkdirSync(evidence, { recursive: true });
const out = mkdtempSync(join(evidence, 'run-'));
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true });
let currentPage;
try {
  for (const [layout, viewport] of [['desktop', { width: 1440, height: 900 }], ['narrow', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, locale: 'zh-CN', hasTouch: layout === 'narrow', isMobile: layout === 'narrow' });
    context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    currentPage = page;
    page.on('pageerror', error => errors.push(layout + ': ' + error.message));
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failures.push(response.status() + ' ' + response.url()); });
    await page.goto(origin + base);
    const field = page.locator('#guest-name'), random = page.getByTestId('random-name');
    await random.waitFor();
    assert.equal(await page.getByRole('button', { name: '开始', exact: true }).count(), 0);
    assert.equal(await page.getByText('本地对战', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('radiogroup').count(), 0);
    assert.equal(await page.locator('.site-match, .tda-shell').count(), 0);
    pass(`${layout} homepage exposes online room admission and no local game or bot selection`);

    const firstName = await field.inputValue(); assert.ok(firstName.trim());
    await random.click(); const nextName = await field.inputValue();
    assert.ok(nextName.trim()); assert.notEqual(nextName, firstName);
    pass(`${layout} a fresh browser receives a default name and the random button generates another`);

    assert.equal(await field.getAttribute('autocomplete'), 'off');
    assert.equal(await field.getAttribute('name'), 'table-alias');
    assert.equal(await field.evaluate(input => input.readOnly), true);
    const bounds = await field.boundingBox(); assert.ok(bounds);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.waitForTimeout(350);
    assert.equal(await field.evaluate(input => document.activeElement === input), false);
    assert.equal(await field.evaluate(input => input.readOnly), true);
    await field.click(); assert.equal(await field.evaluate(input => input.readOnly), false);
    await field.fill('桌边旅客'); await random.focus();
    assert.equal(await field.evaluate(input => input.readOnly), true);
    assert.equal(await field.inputValue(), '桌边旅客');
    pass(`${layout} name editing requires focus, disables autocomplete and preserves typed text after blur`);

    await field.click(); await field.fill('   ');
    const before = requests.length;
    await page.getByRole('button', { name: '创建房间', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(requests.slice(before).some(path => path.includes('/three-dragon-api/')), false);
    assert.equal(await page.locator('.site-online-match').count(), 0);
    await random.click(); assert.ok((await field.inputValue()).trim());
    pass(`${layout} blank names stay on the form without contacting the server and can be replaced`);

    await page.getByRole('button', { name: '规则', exact: true }).click();
    await page.locator('.site-howto-body section').first().waitFor();
    assert.ok(await page.locator('.site-howto-body section').count() > 2);
    await page.locator('.site-howto-head button').click(); await random.waitFor();
    pass(`${layout} help opens the real rules and returns to the online admission form`);

    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByRole('button', { name: 'Create room', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await page.getByText('Local match', { exact: true }).count(), 0);
    await page.reload(); await page.getByRole('button', { name: 'Create room', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await page.getByRole('button', { name: '创建房间', exact: true }).waitFor();
    pass(`${layout} English and Chinese controls change the interface and language survives refresh`);

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const controls = page.locator('.site-online-form button');
    for (let index = 0; index < await controls.count(); index++) {
      const button = controls.nth(index); if (await button.isDisabled()) continue;
      assert.equal(await button.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }), true);
    }
    pass(`${layout} enabled room controls are reachable at their visible centers without horizontal overflow`);
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(failures, []); assert.deepEqual(external, []);
  pass('website controls load without script errors, failed resources or external requests');
  writeFileSync(join(out, 'result.json'), JSON.stringify({ checks, errors, failures, external, realOwlbearRoom: false, scope: 'Built online-only website homepage controls on desktop and narrow viewport. No bot match, real Owlbear room or production data.' }, null, 2) + '\n');
  console.log(`${checks.length}/${checks.length} checks passed; ${out}`);
} catch (error) {
  const controls = currentPage && !currentPage.isClosed() ? await currentPage.locator('.site-controls').ariaSnapshot().catch(() => '') : '';
  writeFileSync(join(out, 'failure.json'), JSON.stringify({ error: String(error), checks, errors, failures, external, controls }, null, 2) + '\n');
  console.log(out); throw error;
} finally {
  await browser.close(); await new Promise(done => server.close(done));
}
