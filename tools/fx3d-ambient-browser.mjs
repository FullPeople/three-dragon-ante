// Actual TableApp, controller, scene and effect adapter; all six seats are synthetic.
// Browser probes retain counts and public rendering state, never projections or card identities.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { extname, join, resolve, sep } from 'node:path';
import { build } from 'vite';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..');
const baseline = process.argv.includes('--baseline-ambient');
const historical = '19d2ebd5110699c25fffb78cd9b8d44e7de5f51a';
const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const previous = new Map();
if (baseline) for (const file of ['fx3d/composeFx.ts', 'fx3d/FxStage.ts', 'scene/TableScene.tsx']) previous.set('/extensions/three-dragon-ante/src/presentation/' + file, execFileSync('git', ['show', historical + ':extensions/three-dragon-ante/src/presentation/' + file], { cwd: root, encoding: 'utf8', windowsHide: true }));
const area = join(root, '.local-evidence/fx3d-ambient-recovery'); mkdirSync(area, { recursive: true });
const out = mkdtempSync(join(area, baseline ? 'baseline-' : 'run-')), entry = join(out, 'fixture.tsx');
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
await build({ configFile: false, root, base: '/', logLevel: 'warn', plugins: [{ name: 'actual-historical-ambient-control', enforce: 'pre', transform(code,id) { const path=id.replaceAll('\\','/'); for(const [suffix,old] of previous) if(path.endsWith(suffix)) return old; } }], build: { outDir: dist, emptyOutDir: true, manifest: true, chunkSizeWarningLimit: 5000, rollupOptions: { input: entry } } });
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
let page, failure, phase = 'load'; const residents=[],finiteControls=[];
const residentInstall=()=>{
      const ledger=window.__resident={phase:'idle',samples:{},buffers:new WeakMap()};
      const cell=layer=>{const at=ledger.samples[ledger.phase]??={};return at[layer]??={draws:0,points:0,alphaSamples:0,alphaPositiveSamples:0,maxAlphaPixels:0};};
      for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(type)for(const name of ['drawArrays','drawElements']) {
        const native=type.prototype[name];
        type.prototype[name]=function(...args){
          const answer=Reflect.apply(native,this,args);
          const layer=this.canvas?.classList?.contains('tda-fx3d-air')?'air':this.canvas?.classList?.contains('tda-fx3d-ground')?'ground':null;
          if(layer&&ledger.phase!=='idle'&&args[1+(name==='drawArrays'?1:0)]>0) {
            const at=cell(layer);at.draws++;if(args[0]===this.POINTS)at.points++;
            if(at.alphaSamples<12&&!this.isContextLost()&&this.getParameter(this.FRAMEBUFFER_BINDING)===null) {
              at.alphaSamples++;
              const needed=this.drawingBufferWidth*this.drawingBufferHeight*4;
              let bytes=ledger.buffers.get(this);if(!bytes||bytes.length!==needed){bytes=new Uint8Array(needed);ledger.buffers.set(this,bytes);}
              this.readPixels(0,0,this.drawingBufferWidth,this.drawingBufferHeight,this.RGBA,this.UNSIGNED_BYTE,bytes);
              let nonzero=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i]>0)nonzero++;
              if(nonzero>0)at.alphaPositiveSamples++;at.maxAlphaPixels=Math.max(at.maxAlphaPixels,nonzero);
            }
          }
          return answer;
        };
      }
      ledger.begin=phase=>{ledger.phase=phase;ledger.samples[phase]={};if(window.__lifecycle)window.__lifecycle.fxDraws=0;};
      ledger.capture=()=>{
        const p=window.__lifecycle,c=document.querySelector('.tda-fx'),ctx=c?.getContext('2d');
        let nonzero=0;if(ctx){const pixels=ctx.getImageData(0,0,c.width,c.height).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)nonzero++;}
        return {gl:ledger.samples[ledger.phase]??{},draw2d:p.fxDraws,alpha2d:nonzero,display2d:!!c&&getComputedStyle(c).display!=='none',rafs:p.pending().rafs,available:p.current().available,mode:document.querySelector('.tda-shell').dataset.fx,airVisible:getComputedStyle(document.querySelector('.tda-fx3d-air')).display!=='none',groundVisible:getComputedStyle(document.querySelector('.tda-fx3d-ground')).display!=='none'};
      };
    };
const watchPage=page=>{
    page.on('pageerror',()=>errors.push('page-script-error'));
    page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))resourceFailures.push(response.status());});
    page.on('console',message=>{const text=message.text();if(/^THREE\.WebGLRenderer: Context (Lost|Restored)\.$/.test(text)||/^WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost$/.test(text))contextNotices.push(text);else if(message.type()==='error')errors.push('console-error');});
};
const pass = label => { checks.push(label); console.log('PASS ' + label); };
try {
  for(const kind of ['druid','priest','hold']) {
    phase=kind+'-load';
    const context=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-CN',reducedMotion:'no-preference'});
    context.on('request',request=>{if(!request.url().startsWith(origin+'/'))external.push('unexpected-origin');});
    await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    await context.addInitScript(residentInstall);
    page=await context.newPage();
    watchPage(page);
    await page.goto(origin+'/lifecycle-fixture?fx3d=1');
    await page.waitForFunction(()=>window.__lifecycle?.current()?.available&&document.querySelector('.tda-shell')?.dataset.fx?.startsWith('three-'));
    await page.waitForTimeout(250);
    const idle=await page.evaluate(()=>window.__resident.capture());
    phase=kind+'-existing';
    await page.evaluate(kind=>{
      const p=window.__lifecycle,r=window.__resident,rect=document.querySelector('.tda-table').getBoundingClientRect();
      const common={kind:kind==='priest'?'crown':kind==='hold'?'ember':'grove',rate:24,area:kind==='hold'?{x:rect.x+rect.width*.45,y:rect.y+rect.height*.4,w:rect.width*.12,h:rect.height*.14}:null,drift:{x:0,y:-20},size:3.2,life:1.2,alpha:.85};
      p.residentSpec=kind==='hold'?{...common,hold:{who:'other',code:'GIVE_DRAGON_OR_GOLD'}}:{...common,field:kind};
      r.begin('existing');p.fx.ambient('resident-existing',p.residentSpec);
      p.airLoss=p.current().air.renderer.getContext().getExtension('WEBGL_lose_context');p.groundLoss=p.current().ground.renderer.getContext().getExtension('WEBGL_lose_context');
    },kind);
    await page.waitForTimeout(800);
    const existing=await page.evaluate(()=>window.__resident.capture());
    assert.ok(existing.gl.air?.points>0&&existing.gl.air.maxAlphaPixels>0&&existing.gl.ground?.draws>0&&existing.gl.ground.maxAlphaPixels>0,'existing resident draws actual nontransparent POINTS/ground without debug or gallery');
    pass(kind + ': existing resident really draws air POINTS and nontransparent ground without debug/gallery');
    phase=kind+'-lost-existing';
    await page.evaluate(()=>{const p=window.__lifecycle;window.__resident.begin('lostExisting');p.airLoss.loseContext();p.groundLoss.loseContext();});
    await page.waitForFunction(()=>!window.__lifecycle.current().available&&document.querySelector('.tda-shell').dataset.fx==='canvas2d');
    await page.waitForTimeout(600);
    const lostExisting=await page.evaluate(()=>window.__resident.capture());
    if(!baseline) {
      assert.ok(lostExisting.draw2d>0&&lostExisting.alpha2d>0&&lostExisting.display2d&&!lostExisting.available,'existing resident immediately falls back to real nontransparent 2D');
      pass(kind + ': existing resident survives actual dual context loss in textured 2D');
    }
    phase=kind+'-single-restore';
    await page.evaluate(()=>{window.__resident.begin('singleRestored');window.__lifecycle.airLoss.restoreContext();});
    await page.waitForFunction(()=>!window.__lifecycle.current().air.renderer.getContext().isContextLost());
    await page.waitForTimeout(250);
    const singleRestored=await page.evaluate(()=>window.__resident.capture());
    assert.equal(singleRestored.available,false);assert.equal(singleRestored.mode,'canvas2d');
    if(!baseline) { assert.ok(singleRestored.draw2d>0&&singleRestored.alpha2d>0&&singleRestored.display2d);pass(kind + ': one restored canvas keeps the owned resident in actual 2D'); }
    phase=kind+'-restored-existing';
    await page.evaluate(()=>{window.__resident.begin('restoredExisting');const p=window.__lifecycle;p.groundLoss.restoreContext();});
    await page.waitForFunction(()=>window.__lifecycle.current().available&&document.querySelector('.tda-shell').dataset.fx.startsWith('three-'));
    await page.waitForTimeout(800);
    const restoredExisting=await page.evaluate(()=>window.__resident.capture());
    if(!baseline) {
      assert.ok(restoredExisting.gl.air?.points>0&&restoredExisting.gl.air.maxAlphaPixels>0&&restoredExisting.gl.ground?.draws>0&&restoredExisting.gl.ground.maxAlphaPixels>0,'both restored contexts redraw the original owned resident, with no new ambient call');
      pass(kind + ': both restored real canvases redraw the existing resident as nonempty 3D');
    }
    await page.evaluate(()=>window.__lifecycle.fx.ambient('resident-existing',null));
    phase=kind+'-lost-new';
    await page.evaluate(()=>{window.__resident.begin('lossAgain');const p=window.__lifecycle;p.airLoss.loseContext();p.groundLoss.loseContext();});
    await page.waitForFunction(()=>!window.__lifecycle.current().available&&document.querySelector('.tda-shell').dataset.fx==='canvas2d');
    await page.evaluate(()=>{const p=window.__lifecycle;window.__resident.begin('lostNew');p.fx.ambient('resident-created-while-lost',p.residentSpec);});
    await page.waitForTimeout(800);
    const lostNew=await page.evaluate(()=>window.__resident.capture());
    assert.ok(lostNew.draw2d>0&&lostNew.alpha2d>0&&lostNew.display2d,'the loss-new positive control really draws textured 2D resident particles');
    pass(kind + ': a resident created during real loss draws actual nonempty textured 2D');
    phase=kind+'-restore-new-and-null';
    await page.evaluate(()=>{window.__resident.begin('restoredNew');const p=window.__lifecycle;p.airLoss.restoreContext();p.groundLoss.restoreContext();});
    await page.waitForFunction(()=>window.__lifecycle.current().available&&document.querySelector('.tda-shell').dataset.fx.startsWith('three-'));
    await page.waitForTimeout(800);
    const restoredNew=await page.evaluate(()=>window.__resident.capture());
    if(!baseline) {
      assert.ok(restoredNew.gl.air?.points>0&&restoredNew.gl.air.maxAlphaPixels>0&&restoredNew.gl.ground?.draws>0&&restoredNew.gl.ground.maxAlphaPixels>0);
      pass(kind + ': restoring both contexts migrates the loss-created resident to actual visible 3D');
    }
    await page.evaluate(()=>{window.__resident.begin('afterNull');window.__lifecycle.fx.ambient('resident-created-while-lost',null);});
    await page.waitForTimeout(2500);
    await page.evaluate(()=>window.__resident.begin('afterTail'));
    await page.waitForTimeout(450);
    const afterTail=await page.evaluate(()=>window.__resident.capture());
    const result={kind,idle,existing,lostExisting,singleRestored,restoredExisting,lostNew,restoredNew,afterTail,missingExistingFallback:lostExisting.draw2d===0&&lostExisting.alpha2d===0,missingExistingRestoration:!(restoredExisting.gl.air?.points>0)&&!(restoredExisting.gl.ground?.draws>0)&&!restoredExisting.airVisible&&!restoredExisting.groundVisible,leaked2dAfterNull:afterTail.draw2d>0&&afterTail.alpha2d>0&&afterTail.display2d&&afterTail.rafs>idle.rafs};
    residents.push(result);console.log(JSON.stringify(result));
    if(baseline) {
      assert.ok(result.missingExistingFallback&&result.missingExistingRestoration&&result.leaked2dAfterNull,'the actual historical adapter reproduces both resident loss and inverse cleanup leak');
      pass(kind + ': actual historical source reproduces missing fallback/restoration and continued 2D emissions after null');
    } else {
      assert.equal(afterTail.draw2d,0);assert.equal(afterTail.alpha2d,0);assert.equal(afterTail.display2d,false);assert.ok(afterTail.rafs<=idle.rafs);assert.equal(afterTail.airVisible,false);assert.equal(afterTail.groundVisible,false);
      pass(kind + ': restored null clears both renderers and stops RAF after the real particle lifetime tail');
    }
    await page.evaluate(()=>window.__lifecycle.unmount());await context.close();page=null;
  }
  if(!baseline) {
    for(const kind of ['direct-destroy','finite-gallery']) {
      phase=kind+'-load';
      const context=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-CN',reducedMotion:'no-preference'});
      context.on('request',request=>{if(!request.url().startsWith(origin+'/'))external.push('unexpected-origin');});
      await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
      await context.addInitScript(residentInstall);
      page=await context.newPage();watchPage(page);
      await page.goto(origin+'/lifecycle-fixture?fx3d=1'+(kind==='finite-gallery'?'&fx3dGallery=1':''));
      await page.waitForFunction(()=>window.__lifecycle?.current()?.available&&document.querySelector('.tda-shell')?.dataset.fx?.startsWith('three-'));
      await page.evaluate(()=>window.__resident.begin('finiteExisting'));
      if(kind==='direct-destroy') await page.evaluate(()=>{const p=window.__lifecycle;p.residentSpec={kind:'grove',rate:24,area:null,drift:{x:0,y:-20},size:3.2,life:1.2,alpha:.85,field:'druid'};p.fx.ambient('direct-owned',p.residentSpec);});
      await page.waitForTimeout(kind==='finite-gallery'?1300:800);
      const initial=await page.evaluate(()=>window.__resident.capture());
      assert.ok(initial.gl.air?.points>0&&initial.gl.air.maxAlphaPixels>0&&initial.gl.ground?.draws>0&&initial.gl.ground.maxAlphaPixels>0,'the finite/destroy control begins with real resident rendering');
      if(kind==='direct-destroy') {
        await page.evaluate(()=>{const p=window.__lifecycle;window.__resident.begin('directDestroyed');p.current().destroy();p.fx.ambient('late-after-stage-destroy',p.residentSpec);});
        await page.waitForTimeout(2500);
      } else {
        await page.evaluate(()=>{const p=window.__lifecycle;window.__resident.begin('galleryLost');p.airLoss=p.current().air.renderer.getContext().getExtension('WEBGL_lose_context');p.groundLoss=p.current().ground.renderer.getContext().getExtension('WEBGL_lose_context');p.airLoss.loseContext();p.groundLoss.loseContext();});
        await page.waitForFunction(()=>!window.__lifecycle.current().available);
        await page.waitForTimeout(3000); // The actual original 2.6s gallery release deadline has expired.
        await page.evaluate(()=>{const p=window.__lifecycle;window.__resident.begin('galleryRestored');p.airLoss.restoreContext();p.groundLoss.restoreContext();});
        await page.waitForFunction(()=>window.__lifecycle.current().available);
        await page.waitForTimeout(800);
      }
      await page.evaluate(()=>window.__resident.begin('noResurrection'));await page.waitForTimeout(450);
      const after=await page.evaluate(()=>window.__resident.capture());
      assert.equal(after.draw2d,0);assert.equal(after.alpha2d,0);assert.equal(after.display2d,false);assert.equal(after.gl.air?.points??0,0);assert.equal(after.gl.ground?.draws??0,0);assert.equal(after.airVisible,false);assert.equal(after.groundVisible,false);assert.equal(after.rafs,0);
      finiteControls.push({directDestroy:kind==='direct-destroy',initial,after});
      pass(kind==='direct-destroy'?'direct actual stage destruction and later ambient calls never create fallback emissions':'loss cancels the actual finite gallery release and its old residents never resurrect after the deadline');
      await page.evaluate(()=>window.__lifecycle.unmount());await context.close();page=null;
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(resourceFailures,[]);
  pass('only actual source/composeFx plus real context loss; all native rendering positive controls and privacy/error boundaries hold');
} catch(error) {
  let observation=null, diagnosticTimer;
  try { observation=page&&await Promise.race([page.evaluate(()=>window.__resident?.capture()??null),new Promise(resolve=>{diagnosticTimer=setTimeout(()=>resolve(null),3000);})]); } catch {}
  finally { clearTimeout(diagnosticTimer); }
  failure={observation,phase,kind:['AssertionError','TimeoutError','Error'].includes(error?.name)?error.name:'OtherError',message:'Resident context-loss diagnostic stopped; no projection or pixel buffers retained.'};
} finally {
  await browser.close();await new Promise(done=>server.close(done));
  const confirmed=residents.length===3&&residents.every(value=>value.missingExistingFallback&&value.missingExistingRestoration&&value.leaked2dAfterNull);
  writeFileSync(join(out,'result.json'),JSON.stringify({source,mode:baseline?'actual-historical-ambient-control':'current-source-resident-recovery',historicalControl:baseline?historical:null,checks,finiteControls,scope:'Synthetic six-seat actual source TableApp/composeFx persistent druid/priest/selection hold, real dual WEBGL_lose_context, native actual draw/POINTS/alpha. Not game networking or human UAT. Public numbers/booleans only; pixel buffers and private projections are never retained.',completed:!failure,counterexampleConfirmed:confirmed,residents,errors,external,resourceFailures,contextNotices,...(failure?{failure}:{})},null,2));
  console.log('Resident evidence: '+out);
}
if(failure)throw Error(failure.phase+': '+failure.message);
