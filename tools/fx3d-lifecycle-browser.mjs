// Actual TableApp, controller, scene and effect adapter; all six seats are synthetic.
// Browser probes retain counts and public rendering state, never projections or card identities.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { build } from 'vite';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const area = join(root, '.local-evidence/fx3d-lifecycle'); mkdirSync(area, { recursive: true });
const out = mkdtempSync(join(area, 'run-')), entry = join(out, 'fixture.tsx');
writeFileSync(entry, `import React from 'react';
import {createRoot} from 'react-dom/client';
import '/extensions/three-dragon-ante/src/presentation/theme/base.css';
import '/extensions/three-dragon-ante/src/presentation/hud/hud.css';
import '/extensions/three-dragon-ante/src/presentation/scene/scene.css';
import {TableApp} from '/extensions/three-dragon-ante/src/presentation/app/TableApp.tsx';
import {createStore,emptyShow} from '/extensions/three-dragon-ante/src/presentation/app/store.ts';
import {createController} from '/extensions/three-dragon-ante/src/presentation/app/controller.ts';
import {createGame,projectSeat} from '/extensions/three-dragon-ante/src/game/rules/index.ts';
import {Burst} from '/extensions/three-dragon-ante/src/presentation/fx3d/primitives/Burst.ts';
import {powerScript} from '/extensions/three-dragon-ante/src/presentation/fx/powers.ts';
const probe=window.__lifecycle={stages:[],fx:null,dead:false,controllerAfterUnmount:0,fxDraws:0,updates:0,disposed:0,timerCalls:0,waitSettled:false,scriptSettled:false};
document.addEventListener('pointerdown',event=>{probe.realPointerId=event.pointerId;},{capture:true});
// Pixel hash assertions need a stable readback backend; this is a geometry test,
// not a performance sample. Other canvases (including both real WebGL ones) are unchanged.
const nativeContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,options){return Reflect.apply(nativeContext,this,[type,type==='2d'&&this.classList.contains('tda-coins-canvas')?{...options,willReadFrequently:true}:options]);};
const nativeDraw=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(...args){if(this.canvas.classList.contains('tda-fx'))probe.fxDraws++;return Reflect.apply(nativeDraw,this,args);};
const pointerTypes=['pointermove','pointerup','pointercancel'],listeners=new Map(pointerTypes.map(t=>[t,new Set()]));
const nativeAdd=window.addEventListener.bind(window),nativeRemove=window.removeEventListener.bind(window);
window.addEventListener=function(type,fn,options){listeners.get(type)?.add(fn);return nativeAdd(type,fn,options);};
window.removeEventListener=function(type,fn,options){listeners.get(type)?.delete(fn);return nativeRemove(type,fn,options);};
const nativeRaf=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window),rafs=new Set();
window.requestAnimationFrame=callback=>{const id=nativeRaf(now=>{rafs.delete(id);callback(now);});rafs.add(id);return id;};
window.cancelAnimationFrame=id=>{rafs.delete(id);nativeCancel(id);};
probe.pending=()=>({listeners:[...listeners.values()].reduce((n,s)=>n+s.size,0),rafs:rafs.size});
probe.listenerNames=()=>Object.fromEntries([...listeners].map(([type,set])=>[type,[...set].map(fn=>fn.name||'anonymous')]));
const seats=Array.from({length:6},(_,i)=>({id:'synthetic-seat-'+i,name:'Synthetic '+i}));
const game=projectSeat(createGame({id:'synthetic-lifecycle',seats,seed:31,startingGold:200}),seats[0].id);
const view={actionReceiptVersion:1,table:{id:'synthetic-table',hostPlayerId:seats[0].id,seats:seats.map(s=>({seatId:s.id,playerId:s.id,name:s.name})),stage:'playing'},selfPlayerId:seats[0].id,isHost:true,role:'PLAYER',connected:true,pending:false,canEdit:false,game};
const store=createStore({lang:'zh',hostKind:'website',mode:'full',view,display:view,flow:view,selected:[],hovered:null,keyboardCard:null,keyboardHeld:false,drag:null,pending:null,sending:false,localMessage:'',inspect:null,show:emptyShow(),busy:false,soundOn:false,gestures:{},slowSeatIds:[],suspended:false,helpOpen:false,goldHold:null,knockAt:0,orientation:'landscape'});
const actual=createController(store,{send(){},gesture(){}});
actual._setDrag=value=>store.set({drag:value});
const controller=new Proxy(actual,{get(target,key){const value=Reflect.get(target,key);return typeof value==='function'?function(...args){if(probe.dead)probe.controllerAfterUnmount++;return Reflect.apply(value,controller,args);}:value;}});
const onFx=value=>{probe.fx=value;},onStage=value=>{if(value&&probe.stages.at(-1)!==value)probe.stages.push(value);};
const reactRoot=createRoot(document.getElementById('fixture'));
reactRoot.render(<TableApp store={store} controller={controller} onFx={onFx} onFx3d={onStage} onOrientation={orientation=>store.set({orientation})} showTopBar={true}/>);
probe.current=()=>probe.stages.at(-1);
probe.dragging=()=>!!store.get().drag;
probe.coinState=()=>{
 const c=probe.coinCanvas;if(!c||!document.contains(c))return null;
 const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 let hash=2166136261;for(const byte of data){hash^=byte;hash=Math.imul(hash,16777619);}
 return {hash:(hash>>>0).toString(16),count:c.closest('[data-coins]').getAttribute('data-coins'),tilt:parseFloat(getComputedStyle(c).getPropertyValue('--tilt'))};
};
probe.unmount=()=>{reactRoot.unmount();probe.dead=true;};
probe.queueScript=()=>{
 probe.scriptSettled=false;
 const stage=probe.current(),fx=probe.fx,point=stage.project(900,550,0);
 const ctx={fx,cardPoint:()=>point,seatPoint:()=>point,seatRect:()=>null,coinsPoint:()=>point,handPoint:()=>point,pile:()=>point,seatIds:seats.map(s=>s.id),sound(){}};
 // The public cue and anchors are synthetic. Real family code supplies delayed volleys.
 void powerScript({key:'synthetic-public-cast',cardId:'red-2',family:'red',seatId:seats[0].id,targetSeatIds:seats.slice(1).map(s=>s.id)},[],ctx).then(()=>{probe.scriptSettled=true;});
};
probe.addLatePrimitive=stage=>{
 const before=stage.air.group.children.length;
 const burst=new Burst(stage,900,550,20,{kind:'ember',count:12,speed:100,up:0.5,size:20,life:0.5});
 return {before,after:stage.air.group.children.length,attached:burst.points.some(p=>!!p.parent)};
};
`);
// Build the actual source fixture before browser startup, matching production loading.
// The lifecycle probes and source components remain unchanged; only module delivery is static.
const dist = join(out, 'site');
await build({ configFile: false, root, base: '/', logLevel: 'warn', build: { outDir: dist, emptyOutDir: true, manifest: true, chunkSizeWarningLimit: 5000, rollupOptions: { input: entry } } });
const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8'));
const main = Object.values(manifest).find(value => value.isEntry); assert.ok(main);
const html = '<!doctype html><html><head><meta charset="UTF-8">' + (main.css || []).map(file => '<link rel="stylesheet" href="/' + file + '">').join('') + '</head><body><div id="fixture" class="tda-root"></div><script type="module" src="/' + main.file + '"></script></body></html>';
const types = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg' };
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/lifecycle-fixture') { res.setHeader('Content-Type', 'text/html; charset=UTF-8'); res.end(html); return; }
  const file = resolve(dist, decodeURIComponent(pathname.slice(1)));
  if (!file.startsWith(dist + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(readFileSync(file));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--no-proxy-server', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const checks = [], errors = [], external = [], resourceFailures = [], contextNotices = [];
let page, failure, phase = 'load';
const pass = label => { checks.push(label); console.log('PASS ' + label); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', reducedMotion: 'no-preference' });
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push('unexpected-origin'); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  page = await context.newPage();
  page.on('pageerror', () => errors.push('page-script-error'));
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) resourceFailures.push(response.status()); });
  page.on('requestfailed', request => { const url = new URL(request.url()); if (url.origin === origin && url.pathname !== '/favicon.ico') resourceFailures.push({ kind: 'request', path: url.pathname, error: request.failure()?.errorText }); });
  page.on('console', message => {
    const text = message.text();
    // These exact renderer notices are expected only because this test deliberately loses contexts.
    // Shader errors and all other console errors remain failures.
    if (/^THREE\.WebGLRenderer: Context (Lost|Restored)\.$/.test(text) || /^WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost$/.test(text)) contextNotices.push(text);
    else if (message.type() === 'error') errors.push('console-error: ' + text);
  });
  await page.goto(origin + '/lifecycle-fixture?fx3d=1');
  await page.waitForFunction(() => window.__lifecycle?.current()?.available && document.querySelector('.tda-shell')?.dataset.fx?.startsWith('three-'));
  assert.equal(await page.evaluate(() => window.__lifecycle.current().tableUniforms().uTableShape.value), 1);
  pass('actual six-seat TableApp starts with an available two-canvas stage and square table mask');

  phase = 'loss';
  await page.evaluate(() => {
    const p=window.__lifecycle,s=p.current();p.old=s;
    s.add({update(){p.updates++;return true;},dispose(){p.disposed++;}});
    s.schedule(()=>p.timerCalls++,1500);s.repeat(()=>p.timerCalls++,1500);
    void s.wait(10000).then(()=>{p.waitSettled=true;});
    p.airLoss=s.air.renderer.getContext().getExtension('WEBGL_lose_context');
    p.groundLoss=s.ground.renderer.getContext().getExtension('WEBGL_lose_context');
    if(!p.airLoss||!p.groundLoss)throw Error('WEBGL_lose_context unavailable');
    p.airLoss.loseContext();p.groundLoss.loseContext();
  });
  await page.waitForFunction(() => !window.__lifecycle.old.available && window.__lifecycle.disposed===1 && window.__lifecycle.waitSettled && document.querySelector('.tda-shell')?.dataset.fx==='canvas2d' && [...document.querySelectorAll('.tda-fx3d-air,.tda-fx3d-ground')].every(c=>getComputedStyle(c).display==='none'));
  const beforeLoss = await page.evaluate(() => ({ updates: window.__lifecycle.updates, timers: window.__lifecycle.timerCalls }));
  await page.waitForTimeout(1700);
  assert.deepEqual(await page.evaluate(() => ({ updates: window.__lifecycle.updates, timers: window.__lifecycle.timerCalls })), beforeLoss);
  const rejectedLost = await page.evaluate(() => {const p=window.__lifecycle;p.old.add({update(){return true;},dispose(){p.disposed++;}});return p.disposed;});
  assert.equal(rejectedLost, 2);
  pass('real loss of both contexts disposes effects, settles waits, cancels timers, hides canvases and rejects new effects');

  phase = 'fallback';
  await page.evaluate(() => {const p=window.__lifecycle;p.fxDraws=0;p.queueScript();});
  await page.waitForFunction(() => {
    const p=window.__lifecycle,c=document.querySelector('.tda-fx');if(p.fxDraws<5||!c)return false;
    const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    for(let i=3;i<data.length;i+=4)if(data[i]>0)return true;return false;
  });
  await page.waitForFunction(() => window.__lifecycle.scriptSettled);
  assert.equal(await page.evaluate(() => window.__lifecycle.old.available), false);
  pass('new ability effect during context loss uses actual 2D textured drawing with nontransparent pixels');

  phase = 'restore';
  await page.evaluate(() => window.__lifecycle.airLoss.restoreContext());
  await page.waitForFunction(() => !window.__lifecycle.old.air.renderer.getContext().isContextLost());
  assert.equal(await page.evaluate(() => window.__lifecycle.old.available), false);
  assert.equal(await page.locator('.tda-shell').getAttribute('data-fx'), 'canvas2d');
  pass('restoring only the air context does not restore availability or three routing');
  await page.evaluate(() => window.__lifecycle.groundLoss.restoreContext());
  await page.waitForFunction(() => window.__lifecycle.old.available && document.querySelector('.tda-shell')?.dataset.fx?.startsWith('three-'));
  await page.evaluate(() => {const p=window.__lifecycle;p.fx.burst(p.old.project(900,550),'ember',1);});
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.tda-fx3d-air')).display!=='none');
  pass('restoring both real contexts permits three effects again and synchronizes the public rendering mode');

  phase = 'quality-rebuild';
  await page.evaluate(() => {const p=window.__lifecycle;p.beforeQuality=p.current();p.queueScript();p.beforeQuality.schedule(()=>p.timerCalls++,700);});
  await page.locator('#fx-quality').click();
  await page.waitForFunction(() => window.__lifecycle.current()!==window.__lifecycle.beforeQuality && window.__lifecycle.current().available);
  assert.equal(await page.evaluate(() => window.__lifecycle.current().tableUniforms().uTableShape.value), 1);
  await page.waitForFunction(() => window.__lifecycle.scriptSettled);
  await page.waitForTimeout(1600);
  const rebuilt = await page.evaluate(() => {const p=window.__lifecycle;return {available:p.beforeQuality.available,children:p.beforeQuality.air.group.children.length,ground:p.beforeQuality.ground.scene.children.length,timers:p.timerCalls,settled:p.scriptSettled,late:p.addLatePrimitive(p.beforeQuality)};});
  assert.deepEqual(rebuilt, { available:false,children:0,ground:0,timers:beforeLoss.timers,settled:true,late:{before:0,after:0,attached:false} });
  pass('actual quality button rebuilds the square stage while queued family callbacks and late primitives cannot revive its predecessor');

  phase = 'coin-orientation';
  const coinBefore = await page.evaluate(() => {const p=window.__lifecycle;p.coinCanvas=document.querySelector('.tda-coins-canvas');p.coinBefore=p.coinState();return p.coinBefore;});
  assert.ok(coinBefore);assert.equal(coinBefore.tilt,28);
  await page.setViewportSize({width:390,height:844});
  phase = 'coin-portrait';
  await page.waitForFunction(before => {const s=window.__lifecycle.coinState();return s&&s.tilt===22&&s.hash!==before.hash;},coinBefore);
  assert.equal(await page.evaluate(() => window.__lifecycle.coinState().count),coinBefore.count);
  await page.setViewportSize({width:1440,height:900});
  phase = 'coin-landscape';
  await page.waitForFunction(before => {const s=window.__lifecycle.coinState();return s&&s.tilt===28&&s.hash===before.hash&&s.count===before.count;},coinBefore);
  pass('the same coin canvas redraws fixed-count pixels for portrait tilt and restores the exact landscape bitmap without remounting');

  phase = 'drag-unmount';
  // The browser/test framework may already own a pointer-up listener. Measure the
  // product's three newly installed drag handlers against the same-page baseline.
  const pointerBaseline = await page.evaluate(() => window.__lifecycle.pending().listeners);
  await page.locator('.tda-card--hand.is-legal').first().waitFor();
  const hit = await page.evaluate(() => {
    for(const card of document.querySelectorAll('.tda-card--hand.is-legal')){
      const r=card.getBoundingClientRect();
      for(const u of [0.5,0.25,0.75])for(const v of [0.15,0.3,0.5,0.7]){
        const x=r.left+r.width*u,y=r.top+r.height*v;
        if(x>0&&x<innerWidth&&y>0&&y<innerHeight&&document.elementFromPoint(x,y)?.closest('.tda-card--hand')===card)return{x,y};
      }
    }
    return null;
  });
  assert.ok(hit,'a legal card has a real visible pointer target');
  await page.mouse.move(hit.x,hit.y);await page.mouse.down();
  await page.mouse.move(hit.x+30,hit.y-40,{steps:3});
  await page.waitForFunction(() => window.__lifecycle.dragging());
  assert.equal(await page.evaluate(() => window.__lifecycle.pending().listeners), pointerBaseline + 3);
  const queuedDrag = await page.evaluate(() => {
    const p=window.__lifecycle;p.last=p.current();const before=p.pending().rafs;
    // Mouse input already established the real drag. A final standard move in this
    // same JS task guarantees that its coalesced frame is still pending at unmount.
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:p.realPointerId,clientX:100,clientY:100}));
    const added=p.pending().rafs-before;p.unmount();return added;
  });
  assert.equal(queuedDrag,1,'unmount starts with exactly one newly queued drag frame');
  await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(() => window.__lifecycle.pending()), {listeners:pointerBaseline,rafs:0});
  await page.mouse.move(100,100,{steps:3});await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__lifecycle.controllerAfterUnmount), 0);
  assert.equal(await page.evaluate(() => window.__lifecycle.last.available), false);
  pass('unmount halfway through a real legal-card drag removes window listeners and RAFs before later pointer input reaches the old controller');

  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(resourceFailures, []);
  pass('actual source components finish with no page or shader errors, missing resources or external requests');
} catch (error) {
  const diagnostics = page && await page.evaluate(() => {
    const p=window.__lifecycle;
    return p?{pending:p.pending(),listenerNames:p.listenerNames(),dragging:p.dragging(),controllerAfterUnmount:p.controllerAfterUnmount,available:p.current()?.available,legalNodes:document.querySelectorAll('.tda-card--hand.is-legal').length,coin:p.coinState(),coinBefore:p.coinBefore,orientation:document.querySelector('.tda-table')?.dataset.orientation}:null;
  }).catch(()=>null);
  failure={phase,kind:error.name,diagnostics,message:'Actual FX lifecycle assertion failed; evidence omits all projection and card data.'};
}
finally {
  await browser.close(); await new Promise(done => server.close(done));
  writeFileSync(join(out,'result.json'),JSON.stringify({checks,completed:!failure,errors,external,resourceFailures,contextNotices,scope:'Production-built actual source TableApp/Controller/FX with synthetic six-seat SeatView, real WebGL context loss, quality rebuild and pointer unmount. No production rooms, bots or player data.',...(failure?{failure}:{})},null,2));
  console.log(checks.length+' checks; '+out);
}
if(failure)throw Error(failure.phase+': '+failure.message);
