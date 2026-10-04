// Real Edge/Chromium checks of the actual SeatBlock and 2.5D layout, using only synthetic public seats.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const evidence = join(root, '.local-evidence/nameplate'); mkdirSync(evidence, { recursive: true });
const out = mkdtempSync(join(evidence, 'run-'));
const entry = join(out, 'fixture.tsx');
writeFileSync(entry, `import React from 'react';
import { createRoot } from 'react-dom/client';
import '/extensions/three-dragon-ante/src/presentation/theme/fonts.ts';
import '/extensions/three-dragon-ante/src/presentation/theme/base.css';
import '/extensions/three-dragon-ante/src/presentation/scene/scene.css';
import { SeatBlock } from '/extensions/three-dragon-ante/src/presentation/scene/SeatBlock.tsx';
import { fitPlane, seatPlacements } from '/extensions/three-dragon-ante/src/presentation/model/layout.ts';
const count = Number(new URLSearchParams(location.search).get('players'));
const names = ['金色巨龙牌桌测试', 'GoldenSilverDragon', '青'.repeat(60), 'W'.repeat(60), '翡翠Silver'.repeat(5), '钱币铭牌多位数'];
const seats = Array.from({length: count}, (_, i) => ({id: 'fixture-' + i, name: names[i], gold: i % 2 ? 999999 : 12345, debt: i % 2 ? 9999 : 123, handCount: 10, flight: [], strength: 33, scoringStrength: 33, committed: false, archmage: false}));
const game = {version: 1, id: 'synthetic', revision: 1, phase: 'play', seats, leaderSeatId: seats[0].id, activeSeatId: seats[0].id, waitingSeatIds: [seats[0].id], resolutionStack: [], effects: [], variant: {deckId: 'legendary', timeDragonMode: 'off'}};
const fit = fitPlane(innerWidth, innerHeight);
const placements = seatPlacements(game, seats[0].id, fit.orientation);
createRoot(document.getElementById('fixture')).render(<div className={'tda-table tda-table--' + fit.orientation} style={{'--scale':fit.scale, '--tilt':fit.spec.tilt+'deg', '--plane-w':fit.spec.w, '--plane-h':fit.spec.h}}><div className='tda-stage'><div className='tda-viewport'><div className='tda-plane'><div className='tda-surface'><div className='tda-felt-fallback' style={{display:'block'}} /></div>{placements.map((placement, i) => <SeatBlock key={placement.id} seat={seats[i]} placement={placement} game={game} selfSeatId={seats[0].id} lang='zh' legalZone={null} dragOver={null} targetSeatId={null} waiting={false} gold={seats[i].gold} onZoneClick={() => {}} />)}</div></div></div></div>);
`);
const server = await createServer({ configFile: false, root, base: '/', appType: 'custom', server: {host:'127.0.0.1', port:0} });
server.middlewares.use((request, response, next) => {
  if (!request.url?.startsWith('/nameplate-fixture?')) return next();
  response.setHeader('Content-Type', 'text/html');
  response.end(`<html><body style="margin:0"><div id="fixture" style="height:100dvh"></div><script type="module" src="/${entry.slice(root.length + 1).replaceAll('\\', '/')}"></script></body></html>`);
});
await server.listen();
const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
const browser = await chromium.launch({...browserLaunchOptions(), headless:true});
const checks = [], errors = [], external = [], measurements = [];
const pass = name => { checks.push(name); console.log('PASS ' + name); };
try {
  for (const [layout, viewport] of [['desktop',{width:1440,height:900}],['narrow',{width:390,height:844}]]) {
    const context = await browser.newContext({viewport, locale:'zh-CN'});
    await context.addInitScript(() => { window.__fixtureErrors = []; window.addEventListener('error', event => window.__fixtureErrors.push(event.message)); });
    context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    for (const count of [2,3,4,5,6]) {
      await page.goto(origin + '/nameplate-fixture?players=' + count);
      await page.locator('.tda-seat-plate').last().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(100);
      const values = await page.locator('.tda-seat-plate').evaluateAll(plates => plates.map(plate => {
        const name = plate.querySelector('.tda-seat-name'), text = name.querySelector('.tda-seat-name-text'), gold = plate.querySelector('.tda-seat-gold'), row = plate.querySelector('.tda-seat-funds');
        const rect = plate.getBoundingClientRect();
        const contained = [...row.children].every(child => { const r = child.getBoundingClientRect(); return r.left >= rect.left - 1 && r.top >= rect.top - 1 && r.right <= rect.right + 1 && r.bottom <= rect.bottom + 1; });
        return {name: text.textContent, title: name.title, font: parseFloat(getComputedStyle(text).fontSize), clipped: text.scrollWidth > text.clientWidth, gold: gold.textContent, contained, height:plate.offsetHeight, width:plate.offsetWidth, fundsWidth:row.scrollWidth, availableWidth:row.clientWidth};
      }));
      assert.equal(values.length, count);
      for (let i=0; i<count; i++) {
        const value = values[i]; assert.equal(value.gold, i % 2 ? '999999' : '12345');
        assert.equal(value.contained, true, 'All gold, debt and hand-count text stays inside the plate: ' + JSON.stringify(value));
        assert.equal(value.height, 44); assert.equal(value.width, i ? 180 : 160);
        assert.equal(value.name, value.title); assert.ok(value.font >= 12 && value.font <= 18);
        if (i<2) assert.equal(value.clipped, false, 'Normal long Chinese/English names fit through font compression');
      }
      measurements.push({layout, count, values});
      errors.push(...await page.evaluate(() => window.__fixtureErrors));
      pass(layout + ' ' + count + ' seats keep names and complete multi-digit finances inside bounded plates');
      const material = await page.evaluate(() => ({funds:getComputedStyle(document.querySelector('.tda-seat-plate')).backgroundImage, score:getComputedStyle(document.querySelector('.tda-strength-plate')).backgroundImage, overflow:document.documentElement.scrollWidth > innerWidth}));
      assert.notEqual(material.funds, material.score); assert.match(material.score, /metal_plate/); assert.match(material.funds, /dark_wood/); assert.equal(material.overflow,false);
      pass(layout + ' ' + count + ' seats distinguish existing wood and metal textures without page overflow');
      if (count===6) await page.screenshot({path:join(out,layout+'-6-seats.png'),fullPage:true});
    }
    await context.close();
  }
  assert.deepEqual(errors,[]); assert.deepEqual(external,[]); pass('Actual components and self-hosted materials render without script errors or external requests');
  writeFileSync(join(out,'result.json'),JSON.stringify({checks,measurements,errors,external,scope:'Actual React SeatBlock and CSS with synthetic public-seat data. Not a multiplayer or production-room acceptance.'},null,2));
  console.log(checks.length + '/' + checks.length + ' checks passed; ' + out);
} catch(error) {
  writeFileSync(join(out,'failure.json'),JSON.stringify({error:String(error),checks,measurements,errors,external},null,2)); console.log(out); throw error;
} finally { await browser.close(); await server.close(); }
