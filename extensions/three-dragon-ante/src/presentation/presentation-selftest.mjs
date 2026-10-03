// 表现层不变量自测（Node，真实规则引擎）：
// 1) 普通座位视图下，对手手牌与牌库永远不产生带 id 的节点；
// 2) 提交 ≠ 接受：回执未到时，哪怕投影已把牌画进牌阵，这张牌仍停在等待位；
// 3) 落地帧只含公共事件与公开牌阵，不含私牌，且本家手牌已去掉打出的牌；
// 4) 演出时序：落地帧 → ≥(SETTLE+BEAT) 后说明层 → 关闭后才显示完整投影 → 最后才更新流程帧。
import assert from 'node:assert/strict';
import { build } from 'rolldown';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const base = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'tda-presentation-'));
const abs = p => JSON.stringify(resolve(base, p));
const entry = `
export { createGame, applyAction, eligibleActions, projectSeat } from ${abs('game/rules/index.ts')};
export { cardPlacements, pendingPose } from ${abs('presentation/model/layout.ts')};
export { createStore, emptyShow } from ${abs('presentation/app/store.ts')};
export { createController } from ${abs('presentation/app/controller.ts')};
export { createPresenter, landingFrame, SETTLE_MS, BEAT_MS } from ${abs('presentation/app/presenter.ts')};
export { freshPublicEvents } from ${abs('presentation/model/cues.ts')};`;
await build({ input: 'entry', plugins: [{ name: 'entry', resolveId(id) { if (id === 'entry') return '\0entry.ts'; }, load(id) { if (id === '\0entry.ts') return entry; } }], output: { file: join(out, 'bundle.mjs'), format: 'esm', codeSplitting: false }, logLevel: 'silent' });
const m = await import(pathToFileURL(join(out, 'bundle.mjs')).href);
const checks = []; const pass = name => { checks.push(name); console.log('PASS ' + name); };

// --- 用真实引擎推进到"领出者打出一张会触发能力的牌" ---
const seats = [{ id: 'you', name: 'You' }, { id: 'b1', name: 'B1' }, { id: 'b2', name: 'B2' }];
let state = m.createGame({ id: 'selftest', seats, seed: 7341 });
for (const seat of state.seats) { const action = m.eligibleActions(state, seat.id)[0]; const r = m.applyAction(state, { id: 'ante-' + seat.id, revision: state.revision, seatId: seat.id, kind: 'ante', cardId: action.cardIds[0] }); assert.ok(r.ok); state = r.state; }
assert.equal(state.stage, 'play');
const leader = state.seats[state.active].id;
const ownBefore = m.projectSeat(state, leader);
const ready = ownBefore.handPowerHints.find(h => h.state === 'power-ready')?.cardId ?? ownBefore.actions[0].cardIds[0];
const before = state;
const played = m.applyAction(state, { id: 'play-1', revision: state.revision, seatId: leader, kind: 'play', cardId: ready }); assert.ok(played.ok); state = played.state;
const view = (s, extra = {}) => ({ actionReceiptVersion: 1, table: { version: 1, id: 'selftest', hostPlayerId: 'local', hostConnectionId: 'local', hostName: 'local', stage: 'playing', seats: seats.map(x => ({ playerId: x.id, seatId: x.id, name: x.name })), revision: s.revision }, selfPlayerId: leader, isHost: true, connected: true, pending: false, game: m.projectSeat(s, leader), ...extra });
const prevView = view(before), nextView = view(state);
const events = m.freshPublicEvents(prevView.game, nextView.game);
assert.ok(events.some(e => e.code === 'CARD_PLAYED' && e.cardIds?.[0] === ready), 'the play is a public event');

// --- 1) 隐私：对手手牌与牌库不带 id ---
{
  const placements = m.cardPlacements(nextView.game, 'landscape');
  const opponentHands = placements.filter(p => p.zone === 'hand' && p.seatId !== leader);
  assert.ok(opponentHands.length > 0);
  assert.ok(opponentHands.every(p => p.cardId === undefined && p.card === null && p.faceDown === true && !p.key.includes('-')), 'opponent hand nodes are anonymous backs');
  const deck = placements.find(p => p.zone === 'deck'); assert.ok(deck && deck.cardId === undefined && deck.card === null);
  for (const seat of nextView.game.seats) if (seat.id !== leader) assert.equal(opponentHands.filter(p => p.seatId === seat.id).length, Math.min(10, seat.handCount));
  const ownHand = placements.filter(p => p.zone === 'hand' && p.seatId === leader);
  assert.deepEqual(ownHand.map(p => p.cardId).sort(), nextView.game.hand.map(c => c.id).sort());
  pass('seat view renders opponents as anonymous backs and the deck without ids');
}

// --- 2) 待确认：投影已把牌画进牌阵，pending 仍把它按住 ---
{
  const placements = m.cardPlacements(nextView.game, 'landscape');
  const inFlight = placements.find(p => p.cardId === ready); assert.equal(inFlight?.zone, 'flight');
  const held = m.pendingPose(nextView.game, 'landscape', { cardId: ready, zone: 'flight' });
  assert.ok(held, 'a pending pose exists while the receipt is outstanding');
  assert.equal(held.z, 60); assert.notEqual(held.y, inFlight.pose.y);
  assert.equal(m.pendingPose(nextView.game, 'landscape', { cardId: ready }), null, 'no zone means nothing to hold');
  pass('pending card keeps its waiting pose even when the projection already shows it in the flight');
}

// --- 3) 落地帧 ---
{
  const landing = m.landingFrame(prevView, nextView, events);
  assert.ok(landing, 'landing frame built from the public CARD_PLAYED event');
  assert.equal(landing.game.revision, prevView.game.revision);
  const seat = landing.game.seats.find(s => s.id === leader);
  assert.ok(seat.flight.some(f => f.cardId === ready));
  assert.ok(!landing.game.hand.some(c => c.id === ready));
  assert.deepEqual(landing.game.seats.filter(s => s.id !== leader).map(s => s.handCount), prevView.game.seats.filter(s => s.id !== leader).map(s => s.handCount));
  assert.ok(!('privateHands' in landing.game) && !('omniscient' in landing.game));
  assert.deepEqual(landing.game.actions, []);
  pass('landing frame adds only the played public card and strips the actor\'s own copy');
}

// --- 4) 演出时序 ---
{
  const triggered = events.some(e => e.code === 'POWER_TRIGGERED');
  assert.ok(triggered, 'fixture play triggers a power');
  const initial = { lang: 'zh', hostKind: 'local', mode: 'full', view: null, display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null };
  const store = m.createStore(initial);
  const controller = m.createController(store, { send() {} });
  const t0 = performance.now(), log = [];
  store.subscribe(() => { const s = store.get(); log.push({ t: performance.now() - t0, display: s.display?.game?.revision ?? null, flow: s.flow?.game?.revision ?? null, power: !!s.show.power, busy: s.busy, inFlight: !!s.display?.game?.seats.find(x => x.id === leader)?.flight.some(f => f.cardId === ready) }); });
  const presenter = m.createPresenter(store, controller, { fx: () => null, root: () => ({ querySelector: () => null }), onBusy() {}, sound() {} });
  store.set({ view: prevView }); presenter.update(prevView, null, false);
  store.set({ view: nextView }); presenter.update(nextView, prevView, true);
  const until = async (fn, ms) => { const end = Date.now() + ms; while (!fn()) { if (Date.now() > end) throw new Error('timeout'); await new Promise(r => setTimeout(r, 15)); } };
  await until(() => store.get().show.power, 4000);
  const opened = performance.now() - t0;
  const atOpen = log[log.length - 1];
  assert.ok(opened >= m.SETTLE_MS + m.BEAT_MS - 40, `spotlight waited ${Math.round(opened)}ms (>= ${m.SETTLE_MS + m.BEAT_MS})`);
  assert.equal(atOpen.display, prevView.game.revision, 'scene still shows the landing frame when the explanation opens');
  assert.ok(atOpen.inFlight, 'the played card is in the flight on the landing frame');
  assert.equal(atOpen.flow, prevView.game.revision, 'flow rail has not advanced yet');
  assert.ok(atOpen.busy);
  controller.dismissPower();
  await until(() => store.get().display?.game?.revision === nextView.game.revision, 1000);
  assert.ok(!store.get().show.power);
  assert.equal(store.get().flow?.game?.revision, prevView.game.revision, 'flow frame still waits for the settlement beats');
  const tFull = performance.now() - t0;
  await until(() => store.get().flow?.game?.revision === nextView.game.revision, 4000);
  const tFlow = performance.now() - t0;
  assert.ok(tFlow - tFull >= m.BEAT_MS - 40, `flow frame committed ${Math.round(tFlow - tFull)}ms after the full projection`);
  await until(() => !store.get().busy, 1000);
  presenter.destroy();
  pass(`presentation order: landing (${Math.round(opened)}ms) -> explanation -> effects -> flow rail (${Math.round(tFlow)}ms)`);
}

// --- 4b) 代际：说明层打开时清场，旧调度不得再写回旧帧 ---
{
  const initial = { lang: 'zh', hostKind: 'local', mode: 'full', view: null, display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null };
  const store = m.createStore(initial);
  const controller = m.createController(store, { send() {} });
  const presenter = m.createPresenter(store, controller, { fx: () => null, root: () => ({ querySelector: () => null }), onBusy() {}, sound() {} });
  presenter.update(prevView, null, false); presenter.update(nextView, prevView, true);
  const until = async (fn, ms) => { const end = Date.now() + ms; while (!fn()) { if (Date.now() > end) throw new Error('timeout'); await new Promise(r => setTimeout(r, 15)); } };
  await until(() => store.get().show.power, 4000);
  const fresh = view(state, { game: { ...m.projectSeat(state, leader), id: 'another-game' } });
  presenter.update(fresh, nextView, false); // 非相邻：清场并直接显示新帧
  await new Promise(r => setTimeout(r, 1200));
  assert.equal(store.get().display?.game?.id, 'another-game', 'a cleared schedule never writes the old frame back');
  assert.equal(store.get().flow?.game?.id, 'another-game');
  assert.ok(!store.get().show.power && !store.get().busy);
  presenter.destroy();
  pass('clearing the schedule during an explanation leaves the newest frame on screen');
}

writeFileSync(join(out, 'result.json'), JSON.stringify({ checks }, null, 2));
console.log(`${checks.length} checks passed`);
