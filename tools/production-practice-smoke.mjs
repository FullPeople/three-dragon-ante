// 独立网站生产构建冒烟：首页 → 开局 → 暗置 → 翻注 → 轮到自己时出牌；对手手牌只能是匿名牌背；桌面与手机各一遍；零脚本错误、零失败资源、零外部请求。
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
    const hand = await page.locator('.tda-card--hand[data-seat="you"][data-card]').count();
    assert.ok(hand >= 4, 'own hand rendered');
    const surface = await page.evaluate(() => { const c = document.querySelector('.tda-surface-gl'); return c ? (c.dataset.fallback ? 'css' : 'webgl') : 'none'; });
    assert.equal(surface, 'webgl', 'table surface renders through WebGL in this browser');
    pass(`${name} site opens a local match (${hand} own cards, surface ${surface})`);
    // 隐私：对手手牌节点不得带卡牌 id，且全部面朝下
    const leak = await page.evaluate(() => ({ ids: document.querySelectorAll('.tda-card--hand[data-card]:not([data-seat="you"])').length, faceUp: [...document.querySelectorAll('.tda-card--hand:not([data-seat="you"])')].filter(n => !n.classList.contains('is-face-down')).length, backs: document.querySelectorAll('.tda-card--hand:not([data-seat="you"])').length }));
    assert.equal(leak.ids, 0); assert.equal(leak.faceUp, 0); assert.ok(leak.backs >= 2);
    pass(`${name} opponents show ${leak.backs} anonymous face-down backs and no card ids`);
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
    // 轮到自己时出牌：机器人的能力说明要人点击任意处关闭，自己的能力选择要人确认；这里像玩家一样推进，直到有合法手牌可打
    const deadline = Date.now() + 60000;
    while (true) {
      if (Date.now() > deadline) throw new Error(name + ': never reached an own play turn');
      if (await page.locator('.tda-spotlight, .tda-formation-spot').count()) { await page.locator('.tda-spotlight, .tda-formation-spot').first().click({ position: { x: 24, y: 24 } }); await page.waitForTimeout(400); continue; }
      if (await page.locator('.tda-choice').count()) {
        const option = page.locator('.tda-choice [data-option]:not([disabled])').first();
        if (await option.count()) { await option.click(); await page.locator('#confirm-action:not([disabled])').click({ timeout: 4000 }).catch(() => {}); }
        await page.waitForTimeout(400); continue;
      }
      const ready = await page.evaluate(() => document.querySelectorAll('.tda-card--hand.is-legal').length > 0 && document.querySelector('.tda-shell')?.getAttribute('data-phase') === 'play' && document.querySelector('.tda-shell')?.getAttribute('data-busy') === 'false');
      if (ready) break;
      await page.waitForTimeout(300);
    }
    const playable = page.locator('.tda-card--hand.is-legal').last();
    const playedId = await playable.getAttribute('data-card');
    // 真实坐标点击：扇面最后一张在最上层，点它的中心；再点牌阵槽
    const box = await playable.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(id => document.querySelector(`[data-card="${id}"]`)?.classList.contains('is-selected'), playedId, { timeout: 4000 });
    const slot = await page.locator('[data-drop-zone="flight"][data-drop-seat="you"]').boundingBox();
    await page.mouse.click(slot.x + slot.width / 2, slot.y + slot.height * 0.3); // 槽的上半段：下半段可能被手牌立板盖住
    await page.waitForFunction(() => document.querySelector('.tda-shell')?.getAttribute('data-pending-action') === 'false', null, { timeout: 10000 });
    // 牌离开手牌即可：某些能力（铜龙等）会立刻把刚打出的牌换进弃牌堆，所以落点可能是牌阵、弃牌顶，或已不在可见位置。
    await page.waitForFunction(id => { const zone = document.querySelector(`[data-card="${id}"]`)?.getAttribute('data-zone'); return zone === undefined || zone === null || zone === 'flight' || zone === 'discard'; }, playedId, { timeout: 10000 });
    assert.equal(await page.locator(`.tda-card--hand[data-card="${playedId}"]`).count(), 0, 'played card left the hand');
    pass(`${name} a card is played through the real action path and leaves the hand`);
    await page.screenshot({ path: join(output, name + '.png') });
    // 退出回首页，再进一局（先像玩家一样关掉还在播放的说明层 / 待确认的选择）
    for (let i = 0; i < 30; i++) {
      if (await page.locator('.tda-spotlight, .tda-formation-spot').count()) { await page.locator('.tda-spotlight, .tda-formation-spot').first().click({ position: { x: 24, y: 24 } }); await page.waitForTimeout(300); continue; }
      if (await page.locator('.tda-choice').count()) { const option = page.locator('.tda-choice [data-option]:not([disabled])').first(); if (await option.count()) { await option.click(); await page.locator('#confirm-action:not([disabled])').click({ timeout: 4000 }).catch(() => {}); } await page.waitForTimeout(400); continue; }
      break;
    }
    await page.getByRole('button', { name: '离开', exact: true }).click();
    // 慢回执：真实指针拖拽到前注区，回执延迟 60 / 300 ms（提交 ≠ 接受：牌先停在槽上方，接受后才落地）
    for (const delay of [60, 300]) {
      await page.goto(origin + base + 'index.html?receiptDelay=' + delay);
      await page.getByRole('button', { name: '开始', exact: true }).click();
      await page.locator('.tda-card--hand.is-legal').first().waitFor({ state: 'attached', timeout: 30000 });
      await page.waitForTimeout(600);
      const card = page.locator('.tda-card--hand.is-legal').last(); const id = await card.getAttribute('data-card');
      const cb = await card.boundingBox(); const ante = await page.locator('[data-drop-zone="ante"][data-drop-seat="you"]').boundingBox();
      await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.mouse.down();
      for (let i = 1; i <= 10; i++) { await page.mouse.move(cb.x + (ante.x + ante.width / 2 - cb.x) * i / 10, cb.y + (ante.y + ante.height / 2 - cb.y) * i / 10); await page.waitForTimeout(20); }
      assert.equal(await page.locator('.tda-pointer').count(), 1, 'pointer arrow shows while dragging');
      await page.mouse.up();
      await page.waitForTimeout(2500);
      const state = await page.evaluate(id => { const n = document.querySelector(`[data-card="${id}"]`); const r = n?.getBoundingClientRect(); return { zone: n?.getAttribute('data-zone'), cls: n?.className, pending: document.querySelector('.tda-shell')?.getAttribute('data-pending-action'), cx: r ? r.left + r.width / 2 : -1, cy: r ? r.top + r.height / 2 : -1 }; }, id);
      assert.equal(state.zone, 'ante', `card committed with ${delay}ms receipt`);
      const after = await page.locator('[data-drop-zone="ante"][data-drop-seat="you"]').boundingBox();
      assert.ok(state.cx > after.x && state.cx < after.x + after.width && state.cy > after.y && state.cy < after.y + after.height, `card rests inside the ante slot after a ${delay}ms receipt`);
      assert.equal(state.pending, 'false');
      assert.ok(!/is-entering|is-dropping|is-flying|is-pending/.test(state.cls), `no stuck animation class with ${delay}ms receipt: ${state.cls}`);
      pass(`${name} drag commits an ante with a ${delay}ms receipt and the card settles`);
    }
    await page.goto(origin + base + 'index.html');
    await page.getByRole('button', { name: '开始', exact: true }).waitFor({ timeout: 10000 });
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
