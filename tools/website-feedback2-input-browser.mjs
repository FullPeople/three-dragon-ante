// Synthetic legal games, the production mount and ordinary browser pointer input.
// Evidence contains numeric hand positions and public geometry, never game snapshots.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build as buildSite } from 'vite';
import { build as buildNode } from 'rolldown';
import { chromium, browserLaunchOptions } from './browser-runtime.mjs';

const root = resolve(import.meta.dirname, '..'), baseline = process.argv.includes('--baseline'), diagnose = process.argv.includes('--diagnose');
const anteOnly=process.argv.includes('--ante-geometry'),dragCenter=process.argv.includes('--drag-center'),dragOverlap=process.argv.includes('--drag-overlap');
const area = join(root, '.local-evidence/website-feedback2-input'); mkdirSync(area, { recursive: true });
const out = mkdtempSync(join(area, baseline ? 'baseline-' : 'run-')), dist = join(out, 'site');
const scratch=join(out,'tmp');mkdirSync(scratch);process.env.TEMP=scratch;process.env.TMP=scratch;
const checks = [], measurements = [], errors = [], external = [], resourceFailures = [];
const sourcePaths = ['scene/TableScene.tsx','scene/CardNode.tsx','app/controller.ts','model/layout.ts','hud/ChoicePanel.tsx','hud/hud.css'].map(path=>'extensions/three-dragon-ante/src/presentation/'+path);
const sha = source => createHash('sha256').update(source).digest('hex');
const sourceBefore = Object.fromEntries(sourcePaths.map(path=>[path,sha(readFileSync(join(root,path)))]));
const headBefore = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const pass = label => { checks.push(label); console.log('PASS ' + label); };
await buildNode({ input: join(root, 'extensions/three-dragon-ante/src/game/rules/index.ts'), platform: 'node', output: { file: join(out, 'rules.mjs'), format: 'esm', codeSplitting: false }, logLevel: 'warn' });
const rules = await import(pathToFileURL(join(out, 'rules.mjs')));
function apply(game, move) {
  const result = rules.applyAction(game, { id: 'synthetic-' + game.revision, revision: game.revision, ...move });
  assert.ok(result.ok, 'fixture advances only through legal rules actions');
  assert.deepEqual(rules.checkInvariants(result.state), []); return result.state;
}
const fixtures = [];
for (let count = 2; count <= 6; count++) {
  const seats = Array.from({ length: count }, (_, i) => ({ id: 'synthetic-seat-' + i, name: 'Synthetic ' + (i + 1) }));
  let found;
  for (let seed = 1; seed <= 4000; seed++) {
    let game = rules.createGame({ id: 'synthetic-choice-' + count, seats, seed, startingGold: 200, variant: { ruleSetId: 'provided-pack-20260910', deckId: 'wheel-of-fate-v1' } });
    for (const seat of seats) {
      const ids = rules.eligibleActions(game, seat.id)[0].cardIds;
      game = apply(game, { seatId: seat.id, kind: 'ante', cardId: [...ids].sort((a, b) => rules.card(a).strength - rules.card(b).strength)[0] });
    }
    const seat = game.seats[game.active], action = seat && rules.eligibleActions(game, seat.id)[0];
    if (!action || action.kind !== 'play' || !action.cardIds.includes('sorcerer')) continue;
    const next = apply(game, { seatId: seat.id, kind: 'play', cardId: 'sorcerer' });
    if (next.pending?.code !== 'SORCERER_REPLACEMENT') continue;
    const choice=rules.eligibleActions(next,seat.id)[0].choice;
    const optionIndex=choice.options.findIndex(option=>{const after=apply(next,{seatId:seat.id,kind:'choose',choiceId:choice.id,optionIds:[option.id]});return !after.pending&&next.revealed.filter(id=>id!==option.cardId).every(id=>after.ante.includes(id));});
    if(optionIndex===-1)continue;
    found = { count, seed, self: seat.id,optionIndex }; break;
  }
  assert.ok(found, 'finds a legal Sorcerer opening for ' + count + ' seats'); fixtures.push(found);
}
pass('legal engine fixtures for Sorcerer replacement at each of two through six seats');
const entry = join(out, 'fixture.ts');
writeFileSync(entry, `
import {mountTableUI} from '/extensions/three-dragon-ante/src/presentation/mount.ts';
import {createGame,applyAction,eligibleActions,projectSeat,card,checkInvariants} from '/extensions/three-dragon-ante/src/game/rules/index.ts';
const fixtures=${JSON.stringify(fixtures)};
const p=window.__feedbackInput={calls:[],events:[],sent:[],lands:[],mode:'hold',surface:null,game:null,seats:[],self:null};
const index=id=>p.hand.indexOf(id);
p.index=index;
for(const type of ['pointerdown','pointerup','click','pointercancel'])document.addEventListener(type,e=>{if(p.events.length<80)p.events.push({type,card:index(e.target.closest?.('[data-card]')?.dataset.card),zone:e.target.closest?.('[data-drop-zone]')?.dataset.dropZone??null});},{capture:true});
function advance(game,move){const r=applyAction(game,{id:'synthetic-'+game.revision,revision:game.revision,...move});if(!r.ok||checkInvariants(r.state).length)throw Error('Illegal fixture action');return r.state;}
function view(receipt){return {actionReceiptVersion:1,table:{version:1,id:'synthetic-table',hostPlayerId:p.seats[0].id,hostConnectionId:'synthetic-host',hostName:'Synthetic',seats:p.seats.map(s=>({seatId:s.id,playerId:s.id,name:s.name})),stage:'playing',revision:p.game.revision},selfPlayerId:p.self,isHost:false,role:'PLAYER',connected:true,pending:false,canEdit:false,game:projectSeat(p.game,p.self),...(receipt?{actionReceipt:receipt}:{})};}
p.reset=(kind,count=6)=>{
 p.surface?.destroy();document.getElementById('fixture').remove();const host=document.createElement('div');host.id='fixture';document.body.append(host);
 p.calls=[];p.events=[];p.sent=[];p.lands=[];p.mode='hold';
 p.seats=Array.from({length:count},(_,i)=>({id:'synthetic-seat-'+i,name:'Synthetic '+(i+1)}));
 const f=fixtures.find(f=>f.count===count),sorcerer=kind==='choice'||kind==='postchoice';p.game=createGame({id:'synthetic-'+kind+'-'+count,seats:p.seats,seed:sorcerer?f.seed:31,startingGold:200,startingHand:sorcerer?6:10,variant:{ruleSetId:'provided-pack-20260910',deckId:'wheel-of-fate-v1'}});p.self=p.seats[0].id;
 if(sorcerer){
  for(const seat of p.seats){const ids=eligibleActions(p.game,seat.id)[0].cardIds;p.game=advance(p.game,{seatId:seat.id,kind:'ante',cardId:[...ids].sort((a,b)=>card(a).strength-card(b).strength)[0]});}
  p.self=p.game.seats[p.game.active].id;p.game=advance(p.game,{seatId:p.self,kind:'play',cardId:'sorcerer'});
  if(kind==='postchoice'){const choice=eligibleActions(p.game,p.self)[0].choice;p.game=advance(p.game,{seatId:p.self,kind:'choose',choiceId:choice.id,optionIds:[choice.options[f.optionIndex].id]});}
 }
 p.hand=projectSeat(p.game,p.self).hand.map(c=>c.id);
 p.surface=mountTableUI(host,{language:'zh',hostKind:'website',send(command){if(command.type!=='action')return;p.sent.push({kind:command.action.kind,card:index(command.action.cardId),options:command.action.optionIds?.length??0});p.last=command.action;if(p.mode==='accept'){p.game=advance(p.game,command.action);p.surface.update(view({actionId:command.action.id,tableId:'synthetic-table',gameId:p.game.id,revision:p.game.revision,ok:true,source:'host'}));}},id:()=>crypto.randomUUID()});
 p.surface.update(view());return {hand:p.hand.length,choice:projectSeat(p.game,p.self).actions[0]?.choice?.code??null};
};
p.accept=()=>{p.game=advance(p.game,p.last);p.surface.update(view({actionId:p.last.id,tableId:'synthetic-table',gameId:p.game.id,revision:p.game.revision,ok:true,source:'host'}));};
p.disconnect=()=>p.surface.update({...view(),connected:false});
p.suspend=()=>p.surface.suspend();
p.destroy=()=>p.surface.destroy();
p.wrongReceipt=()=>p.surface.update(view({actionId:'synthetic-unrelated-action',tableId:'synthetic-table',gameId:p.game.id,revision:p.game.revision,ok:true,source:'host'}));
p.choiceState=()=>({revealed:p.game.revealed.length,ante:p.game.ante.length,pending:p.game.pending?.code??null,sourceInFlight:p.game.seats.find(s=>s.id===p.self).flight.some(f=>f.cardId==='sorcerer')});
p.reset('drag');
`);
const replacements = new Map();
if (baseline) for (const file of ['scene/TableScene.tsx', 'scene/CardNode.tsx', 'model/layout.ts']) {
  const path = 'extensions/three-dragon-ante/src/presentation/' + file;
  replacements.set(path, execFileSync('git', ['show', '7e64866:' + path], { cwd: root, encoding: 'utf8', windowsHide: true }));
}
await buildSite({ configFile: false, root, base: '/', logLevel: 'warn', plugins: [{ name: 'exact-baseline-and-controller-observation', enforce: 'pre', transform(source, rawId) {
  const id = rawId.replaceAll('\\', '/');
  for (const [path, code] of replacements) if (id.endsWith('/' + path)) source = code;
  if(id.endsWith('/presentation/scene/TableScene.tsx'))source=source.replace('onLand?.(key, zone);','window.__feedbackInput.lands.push({card:window.__feedbackInput.index(key),zone}); onLand?.(key, zone);');
  if (id.endsWith('/presentation/app/controller.ts')) {
    source = source.replace('export function createController(', 'function actualCreateController(');
    source += '\nexport function createController(store,deps){const c=actualCreateController(store,deps);for(const key of ["drop","placeSelected","selectCard","hover"]){const native=c[key];c[key]=function(...args){const p=window.__feedbackInput;if(p&&p.calls.length<100)p.calls.push({method:key,card:p.index(args[0]),selected:store.get().selected.map(p.index),drag:store.get().drag?p.index(store.get().drag.cardId):null});return Reflect.apply(native,c,args);};}return c;}';
  }
  return source;
} }], build: { outDir: dist, emptyOutDir: true, manifest: true, chunkSizeWarningLimit: 5000, rollupOptions: { input: entry } } });
const sourceIdentity = {headBefore,sourceBefore,builtOverrides:Object.fromEntries([...replacements].map(([path,source])=>[path,sha(source)]))};
if (process.argv.includes('--prepare')) { writeFileSync(join(out, 'prepared.json'), JSON.stringify({ baseline, checks, fixtures,sourceIdentity }, null, 2)); console.log('PREPARED ' + out); process.exit(0); }
const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8')), main = Object.values(manifest).find(x => x.isEntry); assert.ok(main);
const html = '<!doctype html><html><head><meta charset="UTF-8">' + (main.css || []).map(file => '<link rel="stylesheet" href="/' + file + '">').join('') + '</head><body><div id="fixture"></div><script type="module" src="/' + main.file + '"></script></body></html>';
const types = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg' };
const server = createServer((req, res) => { const path = new URL(req.url, 'http://localhost').pathname; if (path === '/fixture') { res.setHeader('Content-Type', 'text/html;charset=UTF-8'); res.end(html); return; } const file = resolve(dist, decodeURIComponent(path.slice(1))); if (!file.startsWith(dist + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; } res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); res.end(readFileSync(file)); });
await new Promise(done => server.listen(0, '127.0.0.1', done)); const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ ...browserLaunchOptions(), headless: true, args: ['--no-proxy-server'] });
let page, failure, phase = 'load';
const point = async index => page.evaluate(index => {
  const cards = [...document.querySelectorAll('.tda-hand-layer [data-card]')], node = cards[index], r = node.getBoundingClientRect();
  for (const fy of [.25, .4, .6, .75, .85]) for (const fx of [.15, .35, .5, .7, .85]) { const x=r.left+r.width*fx,y=r.top+r.height*fy; if (document.elementFromPoint(x,y)?.closest('[data-card]')===node) return {x,y}; }
  return null;
}, index);
const reset = async (kind, count) => { await page.evaluate(([kind,count]) => window.__feedbackInput.reset(kind,count), [kind,count]); await page.waitForTimeout(850); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', reducedMotion: 'no-preference' });
  context.on('request', request => { if (!request.url().startsWith(origin + '/')) external.push('unexpected-origin'); });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) resourceFailures.push(response.status()); });
  page.on('requestfailed', request => { if (request.url().startsWith(origin + '/') && !request.url().endsWith('/favicon.ico')) resourceFailures.push(request.failure()?.errorText); });
  await page.goto(origin + '/fixture');
  for (const [layout, viewport] of [['desktop', { width:1440,height:900 }], ['narrow',{width:390,height:844}]]) {
    await page.setViewportSize(viewport); phase = layout + '-drag';
    {
      const hiddenUI=await page.addStyleTag({content:'.tda-choice,.tda-inspector,.tda-spotlight{visibility:hidden!important}'});
      for(let count=2;count<=6;count++){
        await reset('postchoice',count);
        const geometry=await page.evaluate(()=>{
          const neutral=[...document.querySelectorAll('[data-zone="ante"][data-card]:not([data-seat])')],flights=[...document.querySelectorAll('[data-zone="flight"][data-card]')],plates=[...document.querySelectorAll('[data-seat-plate],.tda-strength-plate')],piles=[...document.querySelectorAll('.tda-pile')],other=[...document.querySelectorAll('[data-zone="ante"][data-seat],[data-zone="hand"][data-seat],.tda-stakes,.tda-hole,.tda-coins-canvas')],rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
          const overlap=(a,b)=>{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;};
          const covered=[];
          for(const [anteIndex,node]of neutral.entries())for(const [targetIndex,target]of [...flights,...plates,...piles,...other].entries()){
            const r=overlap(rect(node),rect(target));if(!r)continue;let hits=0;
            for(const fx of [.15,.35,.5,.7,.85])for(const fy of [.15,.35,.5,.7,.85]){const stack=document.elementsFromPoint(r.x+r.width*fx,r.y+r.height*fy);const above=stack.findIndex(e=>e===node||node.contains(e)),below=stack.findIndex(e=>e===target||target.contains(e));if(above>=0&&below>=0&&above<below)hits++;}
            covered.push({anteIndex,targetIndex,target:target.dataset.zone??(target.dataset.seatPlate?'plate':target.dataset.pile??target.className),overlap:r,hits});
          }
          return {neutral:neutral.map(n=>({rect:rect(n),x:n.style.getPropertyValue('--x'),y:n.style.getPropertyValue('--y'),z:n.style.getPropertyValue('--z'),transform:getComputedStyle(n).transform})),flights:flights.map(rect),plates:plates.map(rect),covered,state:window.__feedbackInput.choiceState()};
        });
        measurements.push({kind:'post-sorcerer-ante',layout,count,...geometry});assert.equal(geometry.neutral.length,2,'both leftovers reach public neutral ante only after replacement ability');assert.equal(geometry.state.revealed,0);assert.equal(geometry.state.sourceInFlight,false);
        if(!diagnose)assert.ok(geometry.covered.every(item=>item.hits===0),'neutral ante does not cover flight, seat plates or piles');
        if(count===6)await page.screenshot({path:join(out,'fully-synthetic-'+layout+'-neutral-ante.png')});
        await hiddenUI.evaluate(node=>{node.sheet.disabled=true;});
        const neutral=page.locator('[data-zone="ante"][data-card]:not([data-seat])');
        for(let i=0;i<await neutral.count();i++){await neutral.nth(i).click();assert.equal(await page.evaluate(i=>document.querySelector('.tda-inspector')?.dataset.cardInspector===[...document.querySelectorAll('[data-zone="ante"][data-card]:not([data-seat])')][i].dataset.card,i),true,'each public neutral card opens its matching inspector');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.tda-inspector'));}
        await hiddenUI.evaluate(node=>{node.sheet.disabled=false;});
      }
      await hiddenUI.evaluate(node=>node.remove());
      pass(layout+' records actual public neutral ante and matching inspection after legal Sorcerer resolution at two through six seats');if(anteOnly)continue;
    }
    const aims=dragCenter?[.5,.82]:dragOverlap?[.82]:[null];
    for(const aim of aims)for (const delay of [0, 25, 180]) {
      await reset('drag',6); const a = await point(5); assert.ok(a, 'A has a real exposed input point'); await page.mouse.click(a.x,a.y); await page.waitForTimeout(180);
      const b = await point(4); assert.ok(b, 'B has a real exposed input point'); await page.mouse.move(b.x,b.y); if (delay) await page.waitForTimeout(delay);
      let start=b;if(aim!==null){const box=await page.locator('.tda-hand-layer [data-card]').nth(4).boundingBox();start={x:box.x+box.width*aim,y:box.y+box.height/2};await page.mouse.move(start.x,start.y);}
      await page.mouse.down();await page.mouse.move(start.x,start.y-12);
      const zone = await page.locator('[data-drop-zone="ante"][data-drop-seat="synthetic-seat-0"]').boundingBox(); assert.ok(zone);
      await page.mouse.move(zone.x+zone.width/2,zone.y+zone.height/2,{steps:2}); await page.mouse.up(); await page.waitForTimeout(80);
      const data = await page.evaluate(() => ({ events:window.__feedbackInput.events,calls:window.__feedbackInput.calls,sent:window.__feedbackInput.sent,waiting:window.__feedbackInput.surface.waitingForReceipt(),lands:window.__feedbackInput.lands,pendingCard:window.__feedbackInput.index(document.querySelector('.is-pending[data-card]')?.dataset.card) }));
      measurements.push({kind:'drag',layout,delay,aim,...data});
      if (!diagnose) { assert.equal(data.events.filter(e=>e.type==='pointerdown').at(-1)?.card,4,'B receives the pointerdown'); assert.deepEqual(data.sent,[{kind:'ante',card:4,options:0}],'the dragged B is the only submitted card'); assert.ok(data.waiting);assert.equal(data.pendingCard,4);assert.deepEqual(data.lands,[],'submission has not landed before its receipt'); await page.evaluate(()=>window.__feedbackInput.wrongReceipt()); assert.equal(await page.evaluate(()=>window.__feedbackInput.surface.waitingForReceipt()),true);assert.deepEqual(await page.evaluate(()=>window.__feedbackInput.lands),[]); await page.evaluate(()=>window.__feedbackInput.accept()); await page.waitForFunction(()=>window.__feedbackInput.lands.some(x=>x.card===4));await page.waitForTimeout(100); assert.equal(await page.evaluate(()=>window.__feedbackInput.surface.waitingForReceipt()),false);assert.deepEqual(await page.evaluate(()=>window.__feedbackInput.lands),[{card:4,zone:'ante'}],'only accepted B lands exactly once'); }
    }
    pass(layout + ' records selected A followed by ordinary rapid B drag at three hover timings and each requested aiming point');
    for(const cancellation of ['suspend','disconnect','destroy']) {
      await reset('drag',6);const b=await point(4);assert.ok(b);await page.mouse.move(b.x,b.y);await page.mouse.down();await page.mouse.move(b.x,b.y-20);await page.waitForTimeout(20);
      const zone=await page.locator('[data-drop-zone="ante"][data-drop-seat="synthetic-seat-0"]').boundingBox();await page.evaluate(kind=>window.__feedbackInput[kind](),cancellation);await page.waitForTimeout(20);await page.mouse.move(zone.x+zone.width/2,zone.y+zone.height/2);await page.mouse.up();await page.waitForTimeout(50);
      assert.deepEqual(await page.evaluate(()=>window.__feedbackInput.sent),[],'retired drag cannot submit after '+cancellation);
    }
    pass(layout+' cancels active drags on suspension, disconnect and destruction');
    await reset('drag',6);const touchPoint=await point(4);assert.ok(touchPoint);const input=await context.newCDPSession(page);
    await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchPoint.x,y:touchPoint.y,id:1}]});
    await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchPoint.x,y:touchPoint.y-18,id:1}]});
    await input.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(50);
    const canceled=await page.evaluate(()=>({events:window.__feedbackInput.events,sent:window.__feedbackInput.sent}));assert.ok(canceled.events.some(e=>e.type==='pointercancel'),'native browser touch cancellation reaches pointercancel');assert.deepEqual(canceled.sent,[]);await input.detach();
    pass(layout+' native canceled touch gesture cannot submit a card');
    phase = layout + '-choice';
    for (let count=2;count<=6;count++) {
      await reset('choice',count); await page.locator('.tda-choice').waitFor();
      const option=page.locator('.tda-choice-options [data-option]').first(), optionBox=await option.boundingBox(); assert.ok(optionBox); await page.mouse.move(optionBox.x+optionBox.width/2,optionBox.y+optionBox.height/2); await page.waitForTimeout(180);
      const geometry=await page.evaluate(()=>{const panel=document.querySelector('.tda-choice'),r=panel.getBoundingClientRect(),table=document.querySelector('.tda-table').getBoundingClientRect(),rect=x=>({x:x.x,y:x.y,width:x.width,height:x.height});return {panel:rect(r),table:rect(table),options:[...document.querySelectorAll('.tda-choice [data-option],.tda-choice #confirm-action')].map(node=>{const r=node.getBoundingClientRect();return {rect:rect(r),centerHit:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}),inspector:!!document.querySelector('.tda-inspector'),overflow:document.documentElement.scrollWidth>innerWidth};});
      measurements.push({kind:'choice',layout,count,...geometry}); assert.equal(geometry.overflow,false); assert.ok(geometry.options.every(x=>x.centerHit),'all replacement options and confirmation are reachable');
      if(count===6)await page.screenshot({path:join(out,'fully-synthetic-'+layout+'-sorcerer.png')});
      await option.click(); await page.evaluate(()=>{window.__feedbackInput.mode='accept';}); await page.locator('#confirm-action').click();
      const result=await page.evaluate(()=>({sent:window.__feedbackInput.sent,state:window.__feedbackInput.choiceState()})); assert.deepEqual(result.sent,[{kind:'choose',card:-1,options:1}]); assert.equal(result.state.sourceInFlight,false); measurements.push({kind:'choice-accepted',layout,count,...result});
    }
    pass(layout+' legally selects Sorcerer replacement at two through six seats without covered controls');
  }
  assert.deepEqual(errors,[]); assert.deepEqual(external,[]); assert.deepEqual(resourceFailures,[]); pass('zero script errors, external requests and failed local resources');
} catch(error) { failure={phase,name:error.name,message:error.message}; console.error(error); process.exitCode=1; }
finally { const sourceAfter=Object.fromEntries(sourcePaths.map(path=>[path,sha(readFileSync(join(root,path)))]));writeFileSync(join(out,'result.json'),JSON.stringify({baseline,diagnose,checks,measurements,errors,external,resourceFailures,failure,sourceIdentity:{...sourceIdentity,sourceAfter}},null,2)); console.log('EVIDENCE '+out); await browser.close(); await new Promise(done=>server.close(done)); }
