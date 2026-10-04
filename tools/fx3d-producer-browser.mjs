// Real production FieldLayer/presenter producers, actual mountTableUI, legal rules fixtures.
// Test-only Vite observers return each original spec unchanged. No player data or pixels are saved.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, resolve, sep } from 'node:path';
import ts from 'typescript';
import { build } from 'vite';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';
import { installPresentationRenderProbe } from './site-presentation-render-probe.mjs';

const root=resolve(import.meta.dirname,'..'), holdOnly=process.argv.includes('--hold-only');
const evidenceRoot=join(root,'.local-evidence/fx3d-producer');mkdirSync(evidenceRoot,{recursive:true});
const out=mkdtempSync(join(evidenceRoot,'run-')),dist=join(out,'site'),entry=join(out,'fixture.ts');
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const producerFiles=['scene/FieldLayer.tsx','app/presenter.ts','fx3d/composeFx.ts','fx3d/FxStage.ts','scene/TableScene.tsx','mount.ts'];
const sourceHashes=()=>producerFiles.map(path=>({path,sha256:createHash('sha256').update(readFileSync(join(root,'extensions/three-dragon-ante/src/presentation',path))).digest('hex')}));
const beforeHashes=sourceHashes(),observedSites={field:0,presenter:0,factory:0};
writeFileSync(entry,`import {mountTableUI} from '/extensions/three-dragon-ante/src/presentation/mount.ts';
import {createGame,eligibleActions,applyAction,projectSeat,checkInvariants,card} from '/extensions/three-dragon-ante/src/game/rules/index.ts';
const p=window.__producer,kind=new URLSearchParams(location.search).get('producer');
const seats=Array.from({length:3},(_,i)=>({id:'synthetic-producer-seat-'+i,name:'Synthetic '+i}));
function move(game,action){const result=applyAction(game,{id:'synthetic-producer-'+game.revision,revision:game.revision,...action});if(!result.ok)throw Error('Legal synthetic fixture action rejected');return result.state;}
function find(){
 for(let seed=1;seed<=5000;seed++){
  let game=createGame({id:'synthetic-producer',seats,seed,startingGold:200,startingHand:6,variant:{ruleSetId:'provided-pack-20260910',deckId:'wheel-of-fate-v1'}});
  for(const seat of game.seats){const action=eligibleActions(game,seat.id)[0];if(!action||action.kind!=='ante')break;const ids=action.cardIds.filter(id=>card(id).family!==(kind==='hold'?'blue':kind));game=move(game,{seatId:seat.id,kind:'ante',cardId:ids[0]??action.cardIds[0]});}
  if(game.stage!=='play'||game.pending)continue;
  const seat=game.seats[game.active],action=eligibleActions(game,seat.id)[0];if(!action||action.kind!=='play')continue;
  for(const id of action.cardIds){
   if(card(id).family!==(kind==='hold'?'blue':kind))continue;
   const next=move(game,{seatId:seat.id,kind:'play',cardId:id});
   const events=next.history.filter(entry=>entry.sequence>(game.history.at(-1)?.sequence??0)).map(entry=>entry.event);
   if(!events.some(event=>event.code==='POWER_TRIGGERED'&&event.cardIds?.[0]===id))continue;
   if(kind==='hold'?!next.pending||next.pending.sourceCardId!==id:!next.effects.some(effect=>effect.kind===kind))continue;
   if(checkInvariants(game).length||checkInvariants(next).length)throw Error('Synthetic fixture violates engine invariants');
   return {before:game,after:next,self:kind==='hold'?next.pending.seatId:seat.id};
  }
 }
 throw Error('No legal fixture found');
}
const found=find();p.legalFixture=true;
function view(game){return {actionReceiptVersion:1,table:{version:1,id:'synthetic-producer-table',hostPlayerId:seats[0].id,stage:'playing',seats:seats.map(seat=>({seatId:seat.id,playerId:seat.id,name:seat.name})),revision:game.revision},selfPlayerId:found.self,isHost:found.self===seats[0].id,role:'PLAYER',connected:true,pending:false,canEdit:false,game:projectSeat(game,found.self)};}
localStorage.setItem('three-dragon-ante.sound.v2','off');
p.surface=mountTableUI(document.getElementById('fixture'),{hostKind:'website',topBar:true,language:'zh',send(){}});
p.surface.update(view(kind==='hold'?found.before:found.after));
p.trigger=()=>p.surface.update(view(found.after));
p.choiceActive=()=>kind==='hold'&&!!found.after.pending&&document.querySelector('.tda-shell')?.dataset.phase==='choice';
`);

await build({configFile:false,root,base:'/',logLevel:'warn',plugins:[{name:'observe-actual-producers-without-changing-specs',enforce:'pre',transform(code,id){
  const path=id.split(String.fromCharCode(92)).join('/');
  if(path.endsWith('/presentation/fx3d/composeFx.ts')){
    const needle='export function composeFx(';
    assert.ok(code.includes(needle));observedSites.factory++;
    return code.replace(needle,'function actualComposeFx(')+`\nexport function composeFx(...args: Parameters<typeof actualComposeFx>): FxLayer {const fx=actualComposeFx(...args);const p=(window as any).__producer;if(p){p.fx=fx;p.stage=args[1];p.generations++;}return fx;}\n`;
  }
  const origin=path.endsWith('/presentation/scene/FieldLayer.tsx')?'field':path.endsWith('/presentation/app/presenter.ts')?'presenter':null;
  if(!origin)return;
  const file=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,origin==='field'?ts.ScriptKind.TSX:ts.ScriptKind.TS),edits=[];
  const visit=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='ambient'&&node.arguments.length===2){const value=node.arguments[1];edits.push({start:value.getStart(file),end:value.end,text:'observeActualProducerSpec('+node.arguments[0].getText(file)+','+value.getText(file)+')'});}ts.forEachChild(node,visit);};visit(file);
  assert.ok(edits.length>0);observedSites[origin]+=edits.length;
  for(const edit of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,edit.start)+edit.text+code.slice(edit.end);
  return code+`\nfunction observeActualProducerSpec(id:string,spec:any){(window as any).__producer?.captureAmbient(${JSON.stringify(origin)},id,spec);return spec;}\n`;
}}],build:{outDir:dist,emptyOutDir:true,manifest:true,chunkSizeWarningLimit:5000,rollupOptions:{input:entry}}});
assert.ok(observedSites.factory>0&&observedSites.field>0&&observedSites.presenter>0);
const manifest=JSON.parse(readFileSync(join(dist,'.vite/manifest.json'),'utf8')),main=Object.values(manifest).find(value=>value.isEntry);assert.ok(main);
const html='<!doctype html><html><head><meta charset="UTF-8">'+(main.css??[]).map(file=>'<link rel="stylesheet" href="/'+file+'">').join('')+'</head><body><div id="fixture"></div><script type="module" src="/'+main.file+'"></script></body></html>';
const types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ogg':'audio/ogg'};
const server=createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/producer-fixture'){res.setHeader('Content-Type','text/html; charset=UTF-8');res.end(html);return;}const file=resolve(dist,decodeURIComponent(pathname.slice(1)));if(!file.startsWith(dist+sep)||!existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(readFileSync(file));});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({...browserLaunchOptions(),headless:true,args:['--no-proxy-server','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],measurements=[],errors=[],external=[],resourceFailures=[];let page,failure,phase='load';
const pass=label=>{checks.push(label);console.log('PASS '+label);};
const sample=()=>page.evaluate(()=>({render:window.__presentationRenderProbe.capture(),producer:window.__producer.public(),choice:window.__producer.choiceActive(),busy:window.__producer.surface.presentationBusy()}));
const actual3d=value=>value.render.air.points>0&&value.render.air.pointChangedAlphaPixels>0&&value.render.ground.draws>0&&value.render.ground.changedAlphaPixels>0;
try{
  for(const kind of holdOnly?['hold']:['hold','druid','priest']){
    phase=kind+'-load';
    const context=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-CN',reducedMotion:'no-preference'});
    context.on('request',request=>{if(!request.url().startsWith(origin+'/'))external.push('unexpected-origin');});
    await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
    await context.addInitScript(installPresentationRenderProbe,{countThreeDraws:true});
    await context.addInitScript(kind=>{
      window.__presentationProbe={active:true,effectCapture:true,fxDraws:0};
      const p=window.__producer={kind,generations:0,specCalls:0,nullCalls:0,latest:null,activeId:null,legalFixture:false};
      const nativeDraw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(...args){if(this.canvas.classList.contains('tda-fx'))window.__presentationProbe.fxDraws++;return Reflect.apply(nativeDraw,this,args);};
      p.captureAmbient=(origin,id,spec)=>{if(spec&&(kind==='hold'?origin==='presenter'&&!!spec.hold:origin==='field'&&spec.field===kind)){p.latest=spec;p.activeId=id;p.specCalls++;}else if(!spec&&id===p.activeId)p.nullCalls++;};
      p.public=()=>{const s=p.latest;return{generations:p.generations,specCalls:p.specCalls,nullCalls:p.nullCalls,legalFixture:p.legalFixture,stageAvailable:!!p.stage?.available,parameters:s?{rate:s.rate,life:s.life,size:s.size,alpha:s.alpha,driftX:s.drift.x,driftY:s.drift.y,global:s.area===null,hold:!!s.hold,holdSelf:s.hold?.who==='self',hasOrigin:!!s.hold?.from}:null};};
      p.clearRenderer=()=>{window.__presentationRenderProbe.reset();window.__presentationProbe.fxDraws=0;};
      p.read2d=()=>{const c=document.querySelector('.tda-fx'),ctx=c?.getContext('2d');let alpha=0;if(ctx){const data=ctx.getImageData(0,0,c.width,c.height).data;for(let i=3;i<data.length;i+=4)if(data[i])alpha++;}return{draws:window.__presentationProbe.fxDraws,alpha,visible:!!c&&getComputedStyle(c).display!=='none'};};
    },kind);
    page=await context.newPage();page.on('pageerror',()=>errors.push('page-script-error'));page.on('console',message=>{if(message.type()==='error')errors.push('console-error');});page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))resourceFailures.push(response.status());});
    await page.goto(origin+'/producer-fixture?fx3d=1&producer='+kind);
    await page.waitForFunction(()=>window.__producer?.stage?.available&&document.querySelector('#fixture')?.dataset.fx?.startsWith('three-'));
    if(kind==='hold'){
      phase='hold-trigger';await page.evaluate(()=>window.__producer.trigger());
      await page.locator('.tda-spotlight').waitFor();await page.locator('.tda-spotlight [data-dismiss-hint]').click();
      await page.waitForFunction(()=>window.__producer.latest?.hold&&!window.__producer.surface.presentationBusy());
    }else await page.waitForFunction(()=>!!window.__producer.latest?.field);
    // Producer is already resident; finite ability effects have ended before sampling it.
    await page.waitForTimeout(1600);await page.evaluate(()=>window.__producer.clearRenderer());await page.waitForTimeout(800);
    const existing=await sample();assert.equal(existing.producer.legalFixture,true);assert.ok(actual3d(existing),'the actual producer resident changes nontransparent POINTS and ground pixels');measurements.push({hold:kind==='hold',existing});
    pass(kind+': actual production producer supplies its unchanged parameters and renders nonempty resident 3D');
    if(kind==='hold'){
      phase='hold-quality';const generation=existing.producer.generations;
      await page.locator('#fx-quality').click();
      await page.waitForFunction(previous=>window.__producer.generations>previous&&window.__producer.stage?.available&&document.querySelector('#fixture')?.dataset.fx?.startsWith('three-'),generation);
      await page.waitForTimeout(1600);await page.evaluate(()=>window.__producer.clearRenderer());await page.waitForTimeout(800);
      const after=await sample();measurements.push({hold:true,quality:after});
      phase='hold-quality-render';assert.equal(after.choice,true);assert.equal(after.busy,false);assert.ok(actual3d(after),'an unchanged active actual presenter hold continues real resident rendering after the user quality button rebuilds the stage');
      pass('active actual presenter hold survives the real user quality button and renders on the replacement stage');
    }
    phase=kind+'-loss';await page.evaluate(()=>{const p=window.__producer;p.clearRenderer();p.airLoss=p.stage.air.renderer.getContext().getExtension('WEBGL_lose_context');p.groundLoss=p.stage.ground.renderer.getContext().getExtension('WEBGL_lose_context');p.airLoss.loseContext();p.groundLoss.loseContext();});
    await page.waitForFunction(()=>!window.__producer.stage.available);await page.waitForTimeout(1600);
    const loss=await page.evaluate(()=>({producer:window.__producer.public(),two:window.__producer.read2d()}));assert.ok(loss.two.draws>0&&loss.two.alpha>0&&loss.two.visible);measurements.push({hold:kind==='hold',loss});pass(kind+': the real producer parameters survive context loss in actual textured 2D');
    phase=kind+'-restore';await page.evaluate(()=>{const p=window.__producer;p.clearRenderer();p.airLoss.restoreContext();p.groundLoss.restoreContext();});await page.waitForFunction(()=>window.__producer.stage.available);await page.waitForTimeout(1600);
    const restored=await sample();assert.ok(actual3d(restored));measurements.push({hold:kind==='hold',restored});pass(kind+': both real restored canvases redraw the unchanged production resident');
    // Give null cleanup a fresh actual 2D positive; a restored 3D resident alone cannot prove a 2D tail.
    phase=kind+'-tail-loss';await page.evaluate(()=>{const p=window.__producer;p.clearRenderer();p.airLoss=p.stage.air.renderer.getContext().getExtension('WEBGL_lose_context');p.groundLoss=p.stage.ground.renderer.getContext().getExtension('WEBGL_lose_context');p.airLoss.loseContext();p.groundLoss.loseContext();});
    await page.waitForFunction(()=>{const p=window.__producer;return !p.stage.available&&p.stage.air.renderer.getContext().isContextLost()&&p.stage.ground.renderer.getContext().isContextLost();});await page.waitForTimeout(1600);
    const tailLoss=await page.evaluate(()=>({producer:window.__producer.public(),two:window.__producer.read2d()}));assert.equal(tailLoss.producer.stageAvailable,false);assert.ok(tailLoss.two.draws>0&&tailLoss.two.alpha>0&&tailLoss.two.visible);measurements.push({hold:kind==='hold',tailLoss});
    phase=kind+'-tail';const tailMs=Math.ceil(existing.producer.parameters.life*1.3*1000)+900;
    await page.evaluate(()=>{const p=window.__producer;p.fx.ambient(p.activeId,null);});await page.waitForTimeout(tailMs);await page.evaluate(()=>window.__producer.clearRenderer());await page.waitForTimeout(450);
    const tail=await page.evaluate(()=>window.__producer.read2d());assert.equal(tail.draws,0);assert.equal(tail.alpha,0);assert.equal(tail.visible,false);measurements.push({hold:kind==='hold',tailMs,tail});pass(kind+': actual producer lifetime determines the real 2D particle tail before null cleanup assertions');
    await page.evaluate(()=>window.__producer.surface.destroy());await context.close();page=null;
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(resourceFailures,[]);pass('actual producer scenarios finish without script/console/resource errors or external requests');
}catch(error){
  let observation=null,timer;try{observation=page&&await Promise.race([sample(),new Promise(done=>{timer=setTimeout(()=>done(null),3000);})]);}catch{}finally{clearTimeout(timer);}
  failure={phase,kind:['AssertionError','TimeoutError','Error'].includes(error?.name)?error.name:'OtherError',observation,message:'Actual producer assertion failed; no private state, identities, selectors or pixels are retained.'};
}finally{
  await browser.close();await new Promise(done=>server.close(done));
  writeFileSync(join(out,'result.json'),JSON.stringify({source,beforeHashes,afterHashes:sourceHashes(),checks,completed:!failure,holdOnly,measurements,errors,external,resourceFailures,observedSites,scope:'Actual mountTableUI/FieldLayer/presenter, unchanged captured production AmbientSpecs, engine-legal synthetic fixtures. Null uses the real composition API as a routing cleanup control; actual choice resolution is not exercised. Component acceptance only, not networking/public players/human UAT/FPS.',...(failure?{failure}:{})},null,2));console.log(out);
}
if(failure)throw Error(failure.phase+': '+failure.message);
