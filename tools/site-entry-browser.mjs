// Production entry compatibility only; table.html is intercepted, with no Owlbear identity fixture.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, extname, join, sep } from 'node:path';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'extensions/three-dragon-ante/dist');
const base = '/three-dragon-ante-dev/';
assert.ok(existsSync(join(dist, 'index.html')), 'Run npm run build first.');
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
const checks = [], errors = [], external = [];
const pass = name => { checks.push(name); console.log('PASS', name); };
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
  await page.route('**/table.html?**', route => route.fulfill({ contentType: 'text/html', body: '<p id="table-target">Table entry</p>' }));
  for (const mode of ['full', 'compact']) {
    const suffix = `?instance=cached-panel-${mode}&mode=${mode}&extra=kept#resume`;
    await page.goto(origin + '/embed?target=' + encodeURIComponent(base + 'index.html' + suffix));
    const frame = page.frame({ name: 'legacy-target' }); assert.ok(frame);
    await frame.waitForURL(origin + base + 'table.html' + suffix);
    await frame.locator('#table-target').waitFor();
    pass(`cached ${mode} background reaches table.html with instance, query and hash intact`);
  }
  for (const suffix of ['?room=ABCDEFGH', '?instance=cached-panel&mode=other']) {
    await page.goto(origin + '/embed?target=' + encodeURIComponent(base + 'index.html' + suffix));
    const frame = page.frame({ name: 'legacy-target' }); assert.ok(frame);
    await frame.getByRole('button', { name: '开始', exact: true }).waitFor();
    assert.equal(frame.url(), origin + base + 'index.html' + suffix);
    pass(`embedded website keeps its entry for ${suffix}`);
  }
  await page.goto(origin + base + 'index.html?instance=direct-visit&mode=full');
  await page.getByRole('button', { name: '开始', exact: true }).waitFor();
  assert.ok(page.url().includes('index.html?instance=direct-visit'));
  pass('direct website visits keep index.html');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  pass('entry checks have no script errors or external requests');
  writeFileSync(join(run, 'result.json'), JSON.stringify({ checks, errors, external, realOwlbearRoom: false, scope: 'Built website entry and cached background URL compatibility; intercepted table, no game or account data.' }, null, 2) + '\n');
  console.log(`${checks.length}/${checks.length} checks passed; ${run}`);
} finally {
  await browser.close(); await new Promise(done => server.close(done));
}
