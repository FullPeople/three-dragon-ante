// Actual card/ghost components, with the previous layer as an occlusion control.
// Synthetic card backs and one public price face; no multiplayer state or player data is retained.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, dirname, relative, sep } from 'node:path';
import { build } from 'vite';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root=resolve(import.meta.dirname,'..'), area=join(root,'.local-evidence/flight-layer');
mkdirSync(area,{recursive:true}); const out=mkdtempSync(join(area,'run-'));
const source='extensions/three-dragon-ante/src/presentation/scene/GhostLayer.tsx';
const baseline=execFileSync('git',['show','d7a4232:'+source],{cwd:root,encoding:'utf8'});
const rewritten=baseline.replace(/from "(\.[^"]+)"/g,(_all,path)=>'from '+JSON.stringify('/'+relative(root,resolve(dirname(join(root,source)),path)).replaceAll('\\','/')));
writeFileSync(join(out,'baseline.tsx'),rewritten);
const entry=join(out,'fixture.tsx'), url=file=>'/'+relative(root,file).replaceAll('\\','/');
writeFileSync(entry,`import React from 'react';
import {createRoot} from 'react-dom/client';
import '/extensions/three-dragon-ante/src/presentation/theme/base.css';
import '/extensions/three-dragon-ante/src/presentation/scene/scene.css';
import {CardNode} from '/extensions/three-dragon-ante/src/presentation/scene/CardNode.tsx';
import {GhostLayer} from '/extensions/three-dragon-ante/src/presentation/scene/GhostLayer.tsx';
import {GhostLayer as PreviousGhostLayer} from ${JSON.stringify(url(join(out,'baseline.tsx')))};
import {fitPlane,CENTER,handLayerPlacement} from '/extensions/three-dragon-ante/src/presentation/model/layout.ts';
const fit=fitPlane(innerWidth,innerHeight),center=CENTER[fit.orientation],hand=handLayerPlacement(fit.orientation);
const old=new URLSearchParams(location.search).has('baseline');
const reveal=new URLSearchParams(location.search).has('reveal');
const ghost={key:'synthetic-flight',from:{...center.deck,rot:0,scale:1,z:20},to:{x:center.fan.x,y:center.fan.y,rot:0,scale:1,z:20},faceDown:true,delay:0,duration:60000,...(reveal?{cardId:'black-5',flip:true}:{})};
const placement={layer:'table',key:'deck',card:null,zone:'deck',pose:{...center.deck,rot:0,scale:1,z:1},faceDown:true,order:0};
createRoot(document.getElementById('fixture')).render(<div className={'tda-table tda-table--'+fit.orientation+(old?' fixture-baseline':'')} style={{'--scale':fit.scale,'--tilt':fit.spec.tilt+'deg','--plane-w':fit.spec.w,'--plane-h':fit.spec.h}}><div className='tda-stage'><div className='tda-viewport'><div className='tda-plane'><div className='tda-card-layer'><CardNode placement={placement}/></div>{old?<PreviousGhostLayer ghosts={[ghost]}/>:null}</div><div className='tda-hand-layer' style={{left:hand.left,top:hand.top,transform:'translateZ('+hand.z+'px)'}}><div className='tda-card-layer'><CardNode placement={{...placement,key:'hand-back',zone:'hand',layer:'hand',pose:{x:0,y:0,rot:0,scale:1,z:0}}}/></div></div>{old?null:<GhostLayer ghosts={[ghost]}/>}</div></div></div>);
`);
// Compile the actual current and git-show control components before browser navigation,
// matching production loading and avoiding request-time dev module compilation.
const dist=join(out,'site');
await build({configFile:false,root,base:'/',logLevel:'warn',build:{outDir:dist,emptyOutDir:true,manifest:true,rollupOptions:{input:entry}}});
const manifest=JSON.parse(readFileSync(join(dist,'.vite/manifest.json'),'utf8'));
const main=Object.values(manifest).find(value=>value.isEntry);assert.ok(main);
const html='<!doctype html><html><head><meta charset="UTF-8">'+(main.css||[]).map(file=>'<link rel="stylesheet" href="/'+file+'">').join('')+'</head><body style="margin:0"><style>.fixture-baseline .tda-ghost-layer{position:static;transform-style:flat;pointer-events:auto}</style><div id="fixture" style="height:100dvh"></div><script type="module" src="/'+main.file+'"></script></body></html>';
const types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/flight-fixture'){res.setHeader('Content-Type','text/html; charset=UTF-8');res.end(html);return;}
  const file=resolve(dist,decodeURIComponent(pathname.slice(1)));
  if(!file.startsWith(dist+sep)||!existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(readFileSync(file));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({...browserLaunchOptions(),headless:true});
const checks=[],errors=[],external=[],resourceFailures=[],measurements=[];
const pass=label=>{checks.push(label);console.log('PASS '+label);};
function trackResources(context){
  context.on('response',response=>{const value=new URL(response.url());if(value.origin===origin&&value.pathname!=='/favicon.ico'&&response.status()>=400)resourceFailures.push({kind:'http',path:value.pathname,status:response.status()});});
  context.on('requestfailed',request=>{const value=new URL(request.url());if(value.origin===origin&&value.pathname!=='/favicon.ico')resourceFailures.push({kind:'request',path:value.pathname,error:request.failure()?.errorText});});
}
async function at(page,fraction){
  return page.evaluate(fraction=>{
    const node=document.querySelector('.tda-ghost'),animation=node.getAnimations()[0];
    animation.pause();animation.currentTime=60000*fraction;
    // Opt in only in this probe so elementsFromPoint can measure paint ordering.
    for(const part of [node,...node.querySelectorAll('*')])part.style.pointerEvents='auto';
    const r=node.getBoundingClientRect(),top=document.elementsFromPoint(r.left+r.width/2,r.top+r.height/2)[0];
    return {fraction,onTop:!!top?.closest('.tda-ghost'),visible:r.width>0&&r.height>0};
  },fraction);
}
try{
  for(const [name,viewport] of [['desktop',{width:1440,height:900}],['narrow',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,locale:'zh-CN',reducedMotion:'no-preference'});
    trackResources(context);
    context.on('request',r=>{if(!r.url().startsWith(origin+'/'))external.push('external-origin');});
    const page=await context.newPage();page.on('pageerror',()=>errors.push('script-error'));
    await page.goto(origin+'/flight-fixture?baseline=1');await page.locator('.tda-ghost').waitFor();
    const before=[];for(const fraction of [0,0.22,0.6,0.9,0.99])before.push(await at(page,fraction));
    assert.ok(before.some(s=>s.visible&&!s.onTop),'The previous table-local layer is occluded during a transfer across the hand');
    pass(name+' reproduces the old card transfer occlusion');
    await page.goto(origin+'/flight-fixture');await page.locator('.tda-ghost').waitFor();
    const alignment=await page.evaluate(()=>{
      const a=document.querySelector('.tda-plane'),b=document.querySelector('.tda-flight-plane');
      return [[0,0,0],[300,200,0],[720,520,20],[900,700,120],[500,1100,300]].map(([x,y,z])=>{
        const pose=host=>{const p=document.createElement('i');p.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;width:0;height:0;transform:translateZ('+z+'px)';host.append(p);const r=p.getBoundingClientRect();p.remove();return r;};
        const p=pose(a),q=pose(b);return Math.hypot(p.left-q.left,p.top-q.top);
      });
    });
    assert.ok(Math.max(...alignment)<0.5,'Flight plane preserves the existing perspective and anchors');
    pass(name+' flight plane matches the actual table projection within 0.5px');
    const samples=[];for(const fraction of [0,0.22,0.6,0.9,0.99])samples.push(await at(page,fraction));
    assert.ok(samples.every(s=>s.visible&&s.onTop),'Departing and airborne backs remain above deck, table cards and own hand');
    measurements.push({name,before,alignment,samples});
    pass(name+' departure, lift, flight and arrival remain visible above other cards');
    await page.screenshot({path:join(out,name+'-flight.png')});
    const hit=await page.evaluate(()=>getComputedStyle(document.querySelector('.tda-flight-layer')).pointerEvents);
    assert.equal(hit,'none');pass(name+' flight layer leaves pointer input available to the table');
    await context.close();
  }
  const reduced=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  trackResources(reduced);
  reduced.on('request',r=>{if(!r.url().startsWith(origin+'/'))external.push('external-origin');});
  const reducedPage=await reduced.newPage();reducedPage.on('pageerror',()=>errors.push('script-error'));
  await reducedPage.goto(origin+'/flight-fixture?reveal=1');await reducedPage.locator('.tda-ghost:not(.is-face-down) .tda-card-face img').waitFor();
  await reducedPage.waitForFunction(()=>document.querySelector('.tda-ghost .tda-card-face img')?.naturalWidth>0);
  assert.equal(await reducedPage.locator('.tda-ghost').evaluate(node=>node.getAnimations().length),0);
  pass('reduced motion still reveals the public price face before the ghost is removed');
  await reduced.close();
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(resourceFailures,[]);pass('card assets and actual components have no script errors or external requests');
  writeFileSync(join(out,'result.json'),JSON.stringify({checks,measurements,errors,external,resourceFailures,scope:'Production-built actual GhostLayer/CardNode/CSS with synthetic backs and a frozen pre-fix occlusion control. Not a multiplayer acceptance.'},null,2));
  console.log(checks.length+'/'+checks.length+' checks passed; '+out);
}catch(error){writeFileSync(join(out,'failure.json'),JSON.stringify({checks,error:String(error),measurements,errors,external,resourceFailures},null,2));console.log(out);throw error;}
finally{await browser.close();await new Promise(done=>server.close(done));}
