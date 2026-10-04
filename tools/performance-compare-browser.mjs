// Actual six-seat React table, authentic component/CSS control, and software-GL rAF measurements.
// This is a synthetic local component comparison, not a whole-release benchmark or physical weak-device UAT.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { build } from 'vite';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const structureOnly = process.argv.includes('--structure-only');
const baselineRef = '4f6fc6a';
const modules = [
  'extensions/three-dragon-ante/src/presentation/scene/CoinStack.tsx',
  'extensions/three-dragon-ante/src/presentation/scene/scene.css',
  'extensions/three-dragon-ante/src/presentation/fx/particles.ts',
  'extensions/three-dragon-ante/src/presentation/scene/TableScene.tsx',
];
const baselineSha = execFileSync('git', ['rev-parse', baselineRef], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const oldSources = new Map(modules.map(file => [resolve(root, file).replaceAll('\\', '/'), execFileSync('git', ['show', baselineRef + ':' + file], { cwd: root, encoding: 'utf8', windowsHide: true })]));
const candidateModuleSha256 = Object.fromEntries(modules.map(file => [file, createHash('sha256').update(readFileSync(join(root,file))).digest('hex')]));
const startedAt = new Date().toISOString();
const evidenceRoot = join(root, '.local-evidence/performance-compare'); mkdirSync(evidenceRoot, { recursive: true });
const out = mkdtempSync(join(evidenceRoot, structureOnly ? 'structure-' : 'run-'));
const viewport = { width: 1440, height: 900 }, durationMs = 2000, repeats = 3;
const args = ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const checks = [], structures = {}, samples = [], errors = [], external = [], fixtures = [];
let browser, browserVersion, stage = 'build', failure;
const pass = label => { checks.push(label); console.log('PASS ' + label); };
const sleep = ms => new Promise(done => setTimeout(done, ms));
const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg' };

// Build both versions from the same current tree. Only the four authentic control modules differ.
// Both use the production FxStage's real ?fx3d=0 gate. The common WebGL2 table material remains enabled.
async function makeFixture(variant) {
  const directory = join(out, variant); mkdirSync(directory, { recursive: true });
  const entry = join(directory, 'fixture.tsx'), dist = join(directory, 'dist');
  writeFileSync(entry, `import { mountTableUI } from '/extensions/three-dragon-ante/src/presentation/mount.ts';
import { createGame, applyAction, eligibleActions, projectSeat, checkInvariants } from '/extensions/three-dragon-ante/src/game/rules/index.ts';
const seats = Array.from({length:6},(_,i)=>({id:'performance-seat-'+i,name:'Seat '+(i+1)}));
const apply = (s,move) => { const r=applyAction(s,{id:'synthetic-'+s.revision,revision:s.revision,...move}); if(!r.ok)throw Error('Invalid synthetic action'); return r.state; };
let game=null;
for(let seed=1;seed<=400&&!game;seed++) {
  let s=createGame({id:'synthetic-six-seat-table',seats,seed,startingGold:200,startingHand:10,variant:{ruleSetId:'provided-pack-20260910',deckId:'wheel-of-fate-v1'}});
  for(const seat of s.seats){const a=eligibleActions(s,seat.id)[0];s=apply(s,{seatId:seat.id,kind:'ante',cardId:a.cardIds[0]});}
  for(let step=0;step<80;step++) {
    if(s.stage==='play'&&!s.pending&&s.round===3&&s.seats.every(seat=>seat.flight.length===2)&&s.effects.length===0){if(checkInvariants(s).length)throw Error('Synthetic invariant');game=s;break;}
    const seat=s.seats.find(seat=>eligibleActions(s,seat.id).length);if(!seat)break;
    const a=eligibleActions(s,seat.id)[0];
    if(a.kind==='choose'){s=apply(s,{seatId:seat.id,kind:'choose',choiceId:a.choice.id,optionIds:a.choice.options.slice(0,a.choice.min).map(o=>o.id)});continue;}
    if(a.kind!=='play'||s.round>3)break;
    const candidates=a.cardIds.map(cardId=>{const next=apply(s,{seatId:seat.id,kind:'play',cardId});const events=next.history.filter(e=>e.sequence>(s.history.at(-1)?.sequence||0)).map(e=>e.event);return{next,events};});
    const candidate=candidates.find(c=>!c.next.pending&&c.next.effects.length===0&&!c.events.some(e=>['POWER_TRIGGERED','SPECIAL_FLIGHT','GAMBIT_SCORED'].includes(e.code)))||candidates.find(c=>!c.next.pending)||candidates[0];
    s=candidate.next;if(s.stage==='ended'||candidate.events.some(e=>e.code==='GAMBIT_SCORED'))break;
  }
}
if(!game)throw Error('No legal six-seat fixture');
const own=game.seats[game.active];const projected=projectSeat(game,own.id);
// Fixed public display amounts stress the same eight capped coin piles. Rules state above is never edited.
const display={...projected,seats:projected.seats.map(s=>({...s,gold:200,debt:0})),stakes:64,hole:32};
const view={actionReceiptVersion:1,table:{version:1,id:'synthetic-table',hostPlayerId:own.id,hostConnectionId:'synthetic-connection',hostName:'Synthetic',stage:'playing',seats:seats.map(s=>({playerId:s.id,seatId:s.id,name:s.name})),revision:1,variant:display.variant},selfPlayerId:own.id,isHost:false,role:'PLAYER',canEdit:false,connected:true,pending:false,game:display};
window.__performanceCommands=0;
const surface=mountTableUI(document.getElementById('fixture'),{language:'zh',mode:'full',hostKind:'website',topBar:false,send:()=>{window.__performanceCommands++;}});surface.update(view);
window.__performanceSurface=surface;
const bytes=new TextEncoder().encode(JSON.stringify(display));
crypto.subtle.digest('SHA-256',bytes).then(hash=>{window.__performanceFixture={hash:[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join(''),seats:6,flightCards:12,ownHand:display.hand.length,gold:200,stakes:64,hole:32};window.__performanceReady=true;});
`);
  const result = await build({ configFile: false, root, base: './', logLevel: 'warn', plugins: [{ name: 'authentic-component-control', enforce: 'pre', transform(code, id) { if (variant === 'control') return oldSources.get(id.split('?')[0].replaceAll('\\', '/')); } }], build: { outDir: dist, emptyOutDir: true, manifest: true, chunkSizeWarningLimit: 5000, rollupOptions: { input: entry } } });
  assert.ok(result);
  const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8'));
  const main = Object.values(manifest).find(value => value.isEntry); assert.ok(main);
  writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><meta charset="UTF-8">' + (main.css || []).map(file => '<link rel="stylesheet" href="/' + file + '">').join('') + '</head><body><div id="fixture"></div><script type="module" src="/' + main.file + '"></script></body></html>');
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(dist, pathname.slice(1) || 'index.html');
    if (!file.startsWith(dist + sep) || !existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream'); response.end(readFileSync(file));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'zh-CN', reducedMotion: 'no-preference' });
  await context.addInitScript(() => {
    localStorage.setItem('three-dragon-ante.sound.v2', 'off');
    window.__performancePointerEvents=0;window.__performanceFxLastDrawMs=0;
    window.addEventListener('pointermove',()=>window.__performancePointerEvents++);
    const native=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(...args){if(this.canvas.classList.contains('tda-fx'))window.__performanceFxLastDrawMs=performance.now();return Reflect.apply(native,this,args);};
  });
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push('unexpected-origin'); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const page = await context.newPage(); page.on('pageerror', () => errors.push(variant + '-script-error'));
  const fixture = { variant, context, page, server }; fixtures.push(fixture);
  await page.goto(origin + '/?fx3d=0'); await page.waitForFunction(() => window.__performanceReady === true);
  await page.locator('.tda-seat-plate').last().waitFor();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
  await page.waitForTimeout(2300); await page.mouse.move(8, 8); await page.waitForTimeout(250);
  // Initial card arrivals call real landing dust. Its simulation caps dt, so a slow control may
  // need longer wall time to become idle. Wait for actual 2D painting to stop, rather than
  // counting a loading effect as the control's static-table cost.
  await page.waitForFunction(()=>performance.now()-window.__performanceFxLastDrawMs>1500&&!document.querySelector('.tda-card.is-entering,.tda-card.is-flying-up,.tda-card.is-hovering,.tda-card.is-dropping,.tda-card.is-flying,.tda-card.is-arriving'),{},{timeout:45000});
  return fixture;
}

async function structure(fixture) {
  await fixture.page.bringToFront();
  return fixture.page.evaluate(() => {
    const coins = [...document.querySelectorAll('.tda-coin')];
    const coinCanvases = [...document.querySelectorAll('.tda-coins-canvas')];
    const painted = coinCanvases.map(canvas => {
      const ctx=canvas.getContext('2d');const rgba=ctx?.getImageData(0,0,canvas.width,canvas.height).data;let nonzero=0;
      if(rgba)for(let i=3;i<rgba.length;i+=4)if(rgba[i])nonzero++;
      return{width:canvas.width,height:canvas.height,painted:nonzero>0};
    });
    const surface=document.querySelector('.tda-surface-gl'),gl=surface?.getContext('webgl2');
    const info=gl?.getExtension('WEBGL_debug_renderer_info');
    return { fixture:window.__performanceFixture,seatPlates:document.querySelectorAll('.tda-seat-plate').length,flightCards:document.querySelectorAll('.tda-card--flight').length,ownHandCards:document.querySelectorAll('.tda-card--hand[data-card]').length,legalOwnCards:document.querySelectorAll('.tda-card--hand.is-legal[data-card]').length,coinPiles:document.querySelectorAll('.tda-coins').length,coinImageCount:coins.length,filteredCoinImageCount:coins.filter(el=>getComputedStyle(el).filter!=='none').length,coinCanvasCount:coinCanvases.length,coinCanvases:painted,idleFxDisplay:getComputedStyle(document.querySelector('.tda-fx')).display,airFxDisplay:getComputedStyle(document.querySelector('.tda-fx3d-air')).display,groundFxDisplay:getComputedStyle(document.querySelector('.tda-fx3d-ground')).display,fxMode:document.querySelector('.tda-shell').dataset.fx||null,shape:document.querySelector('.tda-table').dataset.shape,materialFallback:surface?.dataset.fallback||null,materialRenderer:info?String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)):null,devicePixelRatio,visibility:document.visibilityState,commands:window.__performanceCommands};
  });
}

async function points(fixture, selector) {
  return fixture.page.locator(selector).evaluateAll(cards => cards.flatMap(card => {
    const r=card.getBoundingClientRect();const ys=[r.top+Math.min(30,r.height*.2),r.top+r.height*.4];
    for(const y of ys)for(const x of [r.left+18,r.left+r.width*.5,r.right-18])if(x>0&&x<innerWidth&&y>0&&y<innerHeight&&document.elementFromPoint(x,y)?.closest('.tda-card')===card)return [{x,y}];
    return [];
  }));
}
async function sample(fixture, mode, trial) {
  const page = fixture.page; await page.bringToFront(); await page.mouse.move(8, 8);
  await page.locator('.tda-shell').focus(); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  assert.equal(await page.locator('.tda-card--hand.is-selected').count(), 0, 'Every capture starts from the same unselected static hand');
  assert.equal(await page.locator('.tda-pointer').count(), 0);
  assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
  const targets = mode === 'idle' ? [] : await points(fixture, mode === 'drag' ? '.tda-card--hand.is-legal[data-card]' : '.tda-card--hand[data-card]');
  if (mode !== 'idle') assert.ok(targets.length, 'Real exposed own-hand cards are available for ' + mode);
  if (mode === 'drag') {
    await page.mouse.move(targets.at(-1).x, targets.at(-1).y); await page.mouse.down();
    await page.mouse.move(targets.at(-1).x + 12, targets.at(-1).y - 20); await page.locator('.tda-pointer').waitFor();
  }
  const pointerBefore = await page.evaluate(() => window.__performancePointerEvents);
  const measurement = page.evaluate(durationMs => new Promise(done => {
    const intervals=[];let start=0,previous=0;
    const tick=now=>{if(!start){start=now;previous=now;}else{intervals.push(now-previous);previous=now;}if(now-start<durationMs)requestAnimationFrame(tick);else{const ordered=[...intervals].sort((a,b)=>a-b);done({frames:intervals.length,durationMs:now-start,fps:intervals.length*1000/(now-start),p95Ms:ordered[Math.max(0,Math.ceil(ordered.length*.95)-1)],intervalsMs:intervals});}};requestAnimationFrame(tick);
  }), durationMs);
  if (mode !== 'idle') {
    const started = Date.now(); let index = 0;
    while (Date.now() - started < durationMs + 30) {
      if (mode === 'hover') { const target=targets[index++%targets.length]; await page.mouse.move(target.x,target.y); }
      else { const t=(Date.now()-started)/durationMs;await page.mouse.move(720+Math.sin(t*Math.PI*8)*190,360+Math.cos(t*Math.PI*6)*75); }
      await sleep(12);
    }
  }
  const measured = await measurement;
  assert.ok(measured.frames > 0 && Number.isFinite(measured.fps) && Number.isFinite(measured.p95Ms), 'Every real rAF sample contains frames and finite measurements');
  const pointerAfter = await page.evaluate(() => window.__performancePointerEvents);
  if (mode === 'drag') {
    assert.equal(await page.locator('.tda-pointer').count(), 1, 'The real controller maintains the drag pointer during capture');
    await page.mouse.move(8, 8); await page.mouse.up(); await page.waitForTimeout(80); assert.equal(await page.locator('.tda-pointer').count(), 0);
  }
  await page.mouse.move(8, 8);
  assert.equal(await page.evaluate(() => window.__performanceCommands), 0, 'Synthetic interaction never submits a game action');
  samples.push({ variant:fixture.variant,mode,trial,pointerMoveEvents:pointerAfter-pointerBefore,...measured });
  console.log(fixture.variant+' '+mode+' #'+trial+': '+measured.fps.toFixed(2)+' FPS; p95 '+measured.p95Ms.toFixed(2)+' ms');
}

try {
  browser = await chromium.launch({ ...browserLaunchOptions(), headless:true, args });
  browserVersion = browser.version();
  const control = await makeFixture('control'), candidate = await makeFixture('candidate');
  stage = 'structure';
  structures.control = await structure(control); structures.candidate = await structure(candidate);
  assert.deepEqual(structures.control.fixture, structures.candidate.fixture);
  for (const values of Object.values(structures)) {
    assert.equal(values.seatPlates, 6); assert.equal(values.flightCards, 12); assert.equal(values.shape, 'square');
    assert.equal(values.ownHandCards, values.fixture.ownHand); assert.ok(values.legalOwnCards > 0); assert.equal(values.coinPiles, 8);
    assert.equal(values.materialFallback, null, 'Both real tables render the same WebGL2 table material');
    assert.match(values.materialRenderer, /SwiftShader/i); assert.equal(values.devicePixelRatio, 1); assert.equal(values.commands, 0);
  }
  assert.equal(structures.control.materialRenderer, structures.candidate.materialRenderer);
  pass('Same legal synthetic six-seat card arrangement, eight fixed coin amounts, square layout, viewport, DPR and software-GL material renderer');
  assert.equal(structures.control.coinCanvasCount, 0); assert.equal(structures.control.coinImageCount, 256); assert.ok(structures.control.filteredCoinImageCount > 0);
  assert.equal(structures.candidate.coinImageCount, 0); assert.equal(structures.candidate.filteredCoinImageCount, 0); assert.equal(structures.candidate.coinCanvasCount, 8);
  assert.ok(structures.candidate.coinCanvases.every(canvas => canvas.width > 0 && canvas.height > 0 && canvas.painted));
  pass('Authentic control renders 256 filtered coin images; the candidate renders eight genuinely painted canvases and no filtered coin images');
  assert.equal(structures.candidate.idleFxDisplay, 'none');
  assert.equal(structures.control.fxMode, 'canvas2d'); assert.equal(structures.candidate.fxMode, 'canvas2d');
  pass('Candidate hides its idle 2D effect canvas and both tables use the identical real fx3d=0 gate');
  if (!structureOnly) {
    stage = 'measurement';
    for(let trial=1;trial<=repeats;trial++)for(const mode of ['idle','hover','drag'])for(const fixture of trial%2 ? [control,candidate] : [candidate,control])await sample(fixture,mode,trial);
    pass('Idle, actual hover and actual drag each capture three interleaved 2-second rAF samples per component variant without submitting an action');
  } else {
    stage = 'interaction-smoke';
    // Smoke interaction is deliberately excluded from FPS reports and the final sample set.
    for(const fixture of [control,candidate]){
      const page=fixture.page;await page.bringToFront();const exposed=await points(fixture,'.tda-card--hand.is-legal');assert.ok(exposed.length);
      await page.mouse.move(exposed.at(-1).x,exposed.at(-1).y);await page.mouse.down();await page.mouse.move(exposed.at(-1).x+20,exposed.at(-1).y-25);await page.locator('.tda-pointer').waitFor();await page.mouse.move(8,8);await page.mouse.up();
      await page.waitForTimeout(100);assert.equal(await page.locator('.tda-pointer').count(),0);assert.equal(await page.evaluate(()=>window.__performanceCommands),0);
    }
    pass('Both variants accept real own-hand drag and cancel it outside the table without a game action; no FPS samples recorded');
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  pass('Both production builds, actual components and locally hosted licensed assets have no script errors or external requests');
} catch (error) { failure = { stage, name:error.name, message:error.message }; }
finally {
  for(const fixture of fixtures){ await fixture.context.close();await new Promise(done=>fixture.server.close(done)); }
  await browser?.close();
}
const summary = structureOnly ? [] : ['idle','hover','drag'].map(mode=>{
  const values=variant=>samples.filter(s=>s.mode===mode&&s.variant===variant);
  const control=values('control'),candidate=values('candidate');
  if(control.length!==repeats||candidate.length!==repeats)return {mode,incomplete:true};
  const controlMedianFps=median(control.map(s=>s.fps)),candidateMedianFps=median(candidate.map(s=>s.fps));
  return{mode,controlMedianFps,candidateMedianFps,fpsRatio:candidateMedianFps/controlMedianFps,controlMedianP95Ms:median(control.map(s=>s.p95Ms)),candidateMedianP95Ms:median(candidate.map(s=>s.p95Ms))};
});
writeFileSync(join(out, failure ? 'failure.json' : 'result.json'),JSON.stringify({ scope:'Synthetic six-seat production React component comparison. The control substitutes four authentic pre-performance modules from 4f6fc6a; all other code is the same current tree. Three.js FX is disabled by the shared production URL gate; WebGL2 table material remains enabled. Software rendering in headless Edge is not physical weak-device acceptance and has no pass/fail FPS threshold.', structureOnly, baselineSha,sourceSha,candidateModuleSha256,startedAt,completedAt:new Date().toISOString(),controlModules:modules,commonFxGate:'?fx3d=0',browserVersion,browserArgs:args,viewport,dpr:1,platform:process.platform,durationMs,repeats,checks,structures,samples,summary,errors,external,failure},null,2));
for(const value of summary)if(!value.incomplete)console.log(value.mode+': median '+value.controlMedianFps.toFixed(2)+' -> '+value.candidateMedianFps.toFixed(2)+' FPS ('+value.fpsRatio.toFixed(2)+'x)');
console.log(checks.length+'/'+checks.length+' checks passed; '+out);
if(failure)throw Error(failure.stage+': '+failure.message);
