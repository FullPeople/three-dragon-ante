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
export { createGame, applyAction, eligibleActions, projectSeat, projectOmniscient } from ${abs('game/rules/index.ts')};
export { card } from ${abs('game/rules/cards.ts')};
export { cardPlacements, pendingPose, isHeldByPending } from ${abs('presentation/model/layout.ts')};
export { createStore, emptyShow } from ${abs('presentation/app/store.ts')};
export { createController } from ${abs('presentation/app/controller.ts')};
export { pendingReceipt } from ${abs('presentation/app/action-receipt.ts')};
export { createPresenter, landingFrame, settlementFrame, revealFrame, purchaseHoldFrame, cardMoves, applyReplacements, powerSegment, revealTally, scoreTally, SETTLE_MS, BEAT_MS, FOCUS_MS, TALLY_MS, MARK_MS } from ${abs('presentation/app/presenter.ts')};
export { freshPublicEvents, derivePresentation, formationCues } from ${abs('presentation/model/cues.ts')};
export { seatPlacements, tableShape } from ${abs('presentation/model/layout.ts')};
export { layoutOverlaps, outsideTable } from ${abs('presentation/model/layout-check.ts')};`;
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
  // CardLayer 用的判定：本家那张牌在手牌 / 暗置 / 牌阵都按住，弃牌堆放行，别人的牌和没有 pending 时不按
  const pending = { cardId: ready, zone: 'flight' };
  for (const zone of ['hand', 'ante', 'flight']) assert.ok(m.isHeldByPending({ cardId: ready, seatId: leader, zone }, pending, leader), `held in ${zone}`);
  assert.ok(!m.isHeldByPending({ cardId: ready, seatId: leader, zone: 'discard' }, pending, leader), 'released once discarded');
  const other = seats.find(x => x.id !== leader).id;
  assert.ok(!m.isHeldByPending({ cardId: ready, seatId: other, zone: 'flight' }, pending, leader), 'another seat\'s card is never held');
  assert.ok(!m.isHeldByPending(inFlight, null, leader), 'nothing is held without a pending action');
  assert.ok(!m.isHeldByPending({ cardId: 'other', seatId: leader, zone: 'flight' }, pending, leader), 'only the pending card is held');
  const exact = { actionId: 'play-1', tableId: 'selftest', gameId: state.id, revision: before.revision, cardId: ready, zone: 'flight', action: { id: 'play-1', revision: before.revision, seatId: leader, kind: 'play', cardId: ready }, retryable: false };
  const receipt = { actionId: exact.actionId, tableId: exact.tableId, gameId: exact.gameId, revision: state.revision, ok: true };
  assert.equal(m.pendingReceipt(nextView, exact).kind, 'ignore', 'a newer projection alone never acknowledges the move');
  for (const change of [{ actionId: 'unrelated' }, { tableId: 'another' }, { gameId: 'another' }, { revision: before.revision }, { revision: state.revision + 1 }]) assert.equal(m.pendingReceipt({ ...nextView, actionReceipt: { ...receipt, ...change } }, exact).kind, 'ignore', 'every receipt field and its matching projection are required');
  assert.equal(m.pendingReceipt({ ...nextView, actionReceipt: receipt }, exact).kind, 'accepted');
  pass('pending card keeps its waiting pose in any projected zone until the receipt arrives');
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
  const initial = { lang: 'zh', hostKind: 'website', mode: 'full', view: null, display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null, knockAt: 0, orientation: 'landscape' };
  const store = m.createStore(initial);
  const controller = m.createController(store, { send() {} });
  const t0 = performance.now(), log = [], sounds = [];
  store.subscribe(() => { const s = store.get(); log.push({ t: performance.now() - t0, display: s.display?.game?.revision ?? null, flow: s.flow?.game?.revision ?? null, power: !!s.show.power, busy: s.busy, inFlight: !!s.display?.game?.seats.find(x => x.id === leader)?.flight.some(f => f.cardId === ready) }); });
  const presenter = m.createPresenter(store, controller, { fx: () => null, root: () => ({ querySelector: () => null }), onBusy() {}, sound(kind, key) { sounds.push({ kind, key }); } });
  store.set({ view: prevView }); presenter.update(prevView, null, false);
  store.set({ view: nextView }); presenter.update(nextView, prevView, true);
  const ackView = { ...nextView, pending: false, actionReceipt: { actionId: 'play-1', tableId: 'selftest', gameId: state.id, revision: state.revision, ok: true } };
  store.set({ view: ackView }); presenter.update(ackView, nextView, true);
  const until = async (fn, ms) => { const end = Date.now() + ms; while (!fn()) { if (Date.now() > end) throw new Error('timeout'); await new Promise(r => setTimeout(r, 15)); } };
  await until(() => store.get().show.power, 4000);
  const opened = performance.now() - t0;
  const atOpen = log[log.length - 1];
  assert.ok(opened >= m.SETTLE_MS + m.FOCUS_MS - 40, `spotlight waited ${Math.round(opened)}ms (>= ${m.SETTLE_MS + m.FOCUS_MS})`);
  assert.equal(store.get().show.focusCardId, ready, 'the played card is focused while the explanation is open');
  assert.equal(atOpen.display, prevView.game.revision, 'scene still shows the landing frame when the explanation opens');
  assert.ok(atOpen.inFlight, 'the played card is in the flight on the landing frame');
  assert.equal(atOpen.flow, prevView.game.revision, 'flow rail has not advanced yet');
  assert.ok(atOpen.busy);
  const identityView = { ...ackView, isHost: false, role: 'PLAYER', canEdit: false };
  store.set({ view: identityView }); presenter.update(identityView, ackView, true);
  assert.ok(store.get().show.power && store.get().busy, 'same-revision identity and ack updates preserve the explanation');
  assert.equal(store.get().display.isHost, false, 'identity refreshes on the held landing frame');
  assert.equal(store.get().display.game.revision, prevView.game.revision, 'identity refresh never substitutes the complete next projection');
  controller.dismissPower();
  await until(() => store.get().display?.game?.revision === nextView.game.revision, 1000);
  assert.ok(!store.get().show.power);
  assert.equal(store.get().flow?.game?.revision, prevView.game.revision, 'flow frame still waits for the settlement beats');
  const tFull = performance.now() - t0;
  await until(() => store.get().flow?.game?.revision === nextView.game.revision, 4000);
  const tFlow = performance.now() - t0;
  assert.ok(tFlow - tFull >= m.BEAT_MS - 40, `flow frame committed ${Math.round(tFlow - tFull)}ms after the full projection`);
  await until(() => !store.get().busy, 1000);
  presenter.update(identityView, identityView, true);
  assert.equal(sounds.filter(sound => sound.kind === 'spotlight').length, 1, 'duplicate projections never replay the power');
  assert.equal(store.get().display.isHost, false, 'old queue envelopes never restore lost host privileges');
  assert.equal(store.get().flow.role, 'PLAYER');
  presenter.destroy();
  pass(`presentation order: landing (${Math.round(opened)}ms) -> explanation -> effects -> flow rail (${Math.round(tFlow)}ms)`);
}

// --- 4b) 代际：说明层打开时清场，旧调度不得再写回旧帧 ---
{
  const initial = { lang: 'zh', hostKind: 'website', mode: 'full', view: null, display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null, knockAt: 0, orientation: 'landscape' };
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

// --- 5) 选择切换：单选时点另一项直接切换，多选时选满后其余不再加入 ---
{
  const choose = (max, min = 1) => ({ kind: 'choose', choice: { id: 'c', seatId: leader, code: 'LOWEST_ANTE_CARD', min, max, options: [{ id: 'a', cardId: 'red-1' }, { id: 'b', cardId: 'black-1' }, { id: 'c2', cardId: 'blue-1' }] } });
  const mk = max => { const g = { ...m.projectSeat(state, leader), actions: [choose(max)] }; const store = m.createStore({ lang: 'zh', hostKind: 'website', mode: 'full', view: view(state, { game: g }), display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null, knockAt: 0, orientation: 'landscape' }); return { store, c: m.createController(store, { send() {} }) }; };
  const single = mk(1); single.c.toggleOption('a'); single.c.toggleOption('b');
  assert.deepEqual(single.store.get().selected, ['b'], 'single choice switches on the second click');
  single.c.toggleOption('b'); assert.deepEqual(single.store.get().selected, [], 'clicking the selected option clears it');
  const multi = mk(2); multi.c.toggleOption('a'); multi.c.toggleOption('b'); multi.c.toggleOption('c2');
  assert.deepEqual(multi.store.get().selected, ['a', 'b'], 'multi choice ignores a third pick when full');
  pass('choice panel: single choice switches by clicking another option');
}

// --- 6) 拼点标记：翻注领出 / 并列；轮局胜 / 并列 / 不能获胜 ---
{
  const game = { ...m.projectSeat(state, leader), leaderSeatId: 's1', anteOrigins: [{ seatId: 's1', cardId: 'red-10' }, { seatId: 's2', cardId: 'blue-6' }, { seatId: 's3', cardId: 'green-6' }] };
  const items = m.revealTally(game, ['red-10', 'blue-6', 'green-6'], false);
  assert.deepEqual(items.map(i => i.mark), ['lead', 'tied', 'tied']);
  assert.deepEqual(items.map(i => i.value), [10, 6, 6]);
  assert.ok(m.revealTally(game, ['red-10', 'blue-6', 'green-6'], true).every(i => i.mark === 'tied'), 'all tied strikes every card');
  const report = { gambit: 1, round: 3, reason: 'round-complete', weakest: false, rows: [{ seatId: 'a', cards: [], bonus: 0, total: 20, eligible: true }, { seatId: 'b', cards: [], bonus: 0, total: 20, eligible: true }, { seatId: 'c', cards: [], bonus: 0, total: 25, eligible: false }], winners: ['a', 'b'], stakes: 9, payouts: [] };
  assert.deepEqual(m.scoreTally(report).map(i => i.mark), ['tied', 'tied', 'out']);
  assert.deepEqual(m.scoreTally({ ...report, winners: ['a'] }).map(i => i.mark), ['win', 'none', 'out']);
  pass('tally marks: leader / tied at reveal, win / tied / ineligible at scoring');
}

// --- 7) 演出不重复付款：结算付款只由计分板飞，特殊牌阵的金币流跟在它的说明层后 ---
{
  const before = { ...m.projectSeat(state, leader), events: [] };
  const seatA = before.seats[0].id, seatB = before.seats[1].id;
  const after = { ...before, revision: before.revision + 1, events: [
    { code: 'SPECIAL_FLIGHT', seatId: seatA, amount: 3 }, { code: 'PAID_PLAYER', seatId: seatB, targetSeatId: seatA, amount: 3 },
    { code: 'GAMBIT_SCORED', score: { gambit: 1, round: 3, reason: 'round-complete', weakest: false, rows: [], winners: [seatA], stakes: 6, payouts: [{ seatId: seatA, amount: 6 }] } },
  ] };
  const pres = m.derivePresentation(before, after);
  assert.equal(pres.formations.length, 1, 'one formation cue');
  assert.equal(pres.formations[0].flows.length, 1, 'the opponent payment belongs to the formation');
  assert.equal(pres.gold.length, 0, 'scoring payouts are not in the generic gold flows');
  assert.equal(pres.rounds.filter(c => c.kind === 'score').length, 1);
  pass('formation cue takes its own gold flows and scoring payouts fly only once');
}

// --- 8) 桌形与座位朝向：2–3 人圆桌正向；6 人方桌侧边座位旋转 ±90° ---
{
  assert.equal(m.tableShape(3), 'round'); assert.equal(m.tableShape(4), 'square');
  const three = m.seatPlacements(m.projectSeat(state, leader), leader, 'landscape');
  assert.ok(three.find(s => s.self).rot === 0 && three.filter(s => !s.self).every(s => Math.abs(s.rot) === 150), 'round table: self upright, the two opponents angled toward the centre');
  assert.ok(three.every(s => s.plateRot > -90 && s.plateRot <= 90), 'nameplates never read upside-down');
  const six = m.createGame({ id: 'six', seats: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, name: id })), seed: 1 });
  const places = m.seatPlacements(m.projectSeat(six, 'a'), 'a', 'landscape');
  assert.deepEqual(places.map(s => s.edge), ['bottom', 'left', 'left', 'top', 'right', 'right'], 'six players: left 2, top 1, right 2 clockwise');
  assert.deepEqual(places.map(s => s.rot), [0, 90, 90, 180, -90, -90], 'top seat faces the viewer, sides turn in');
  assert.deepEqual(places.map(s => s.plateRot), [0, 90, 90, 0, 90, 90], 'side nameplates turn with their seat and read the same way on both sides, never upside-down');
  for (const s of places.filter(s => s.edge !== 'bottom')) { assert.ok(s.plate.x > 60 && s.plate.x < 1740 && s.plate.y > 20 && s.plate.y < 1080, 'plates stay on the table'); }
  pass('table shape: round for three, square with rotated side seats for six');
}

// --- 9) 层标记：本家手牌画在手牌立板上（z=0，叠放靠 order），其余都在桌面层 ---
{
  const placements = m.cardPlacements(nextView.game, 'landscape');
  const own = placements.filter(p => p.zone === 'hand' && p.seatId === leader);
  assert.ok(own.length > 0 && own.every(p => p.layer === 'hand' && p.pose.z === 0), 'own hand is on the hand layer');
  assert.ok(placements.filter(p => !(p.zone === 'hand' && p.seatId === leader)).every(p => p.layer === 'table'), 'everything else is on the table layer');
  pass('own hand lives on the screen-aligned hand layer, never inside the table plane');
}

// --- 10) 末牌与结算同帧：合成结算帧上每家都有牌、总点数来自 ScoreReport；结算后的金币排在最后 ---
{
  // 用真实引擎把一局打到第一次结算
  let g = m.createGame({ id: 'settle', seats, seed: 4242 });
  const step = () => { for (const seat of g.seats) { const a = m.eligibleActions(g, seat.id)[0]; if (!a) continue; const base = { id: 's' + g.revision + ':' + seat.id, revision: g.revision, seatId: seat.id }; const move = a.kind === 'choose' ? { ...base, kind: 'choose', choiceId: a.choice.id, optionIds: a.choice.options.slice(0, Math.max(a.choice.min, Math.min(1, a.choice.max))).map(o => o.id) } : { ...base, kind: a.kind, cardId: a.cardIds[0] }; const r = m.applyAction(g, move); if (r.ok) return r.state; } return null; };
  let prev = null, next = null;
  for (let i = 0; i < 400 && !next; i++) { const before = g; const after = step(); if (!after) break; g = after; const ev = m.freshPublicEvents(m.projectSeat(before, 'you'), m.projectSeat(after, 'you')); if (ev.some(e => e.code === 'GAMBIT_SCORED')) { prev = before; next = after; } }
  assert.ok(next, 'reached a scoring frame');
  const pv = view(prev), nv = view(next);
  const events = m.freshPublicEvents(pv.game, nv.game), report = events.find(e => e.code === 'GAMBIT_SCORED').score;
  assert.ok(nv.game.seats.every(s => s.flight.length === 0), 'the real post-score projection has empty flights');
  const frame = m.settlementFrame(pv, nv, events, report);
  assert.ok(frame, 'settlement frame built');
  for (const row of report.rows) { const seat = frame.game.seats.find(s => s.id === row.seatId); assert.equal(seat.flight.length, row.cards.length, 'every scored card is back on the table'); assert.equal(seat.strength, row.total); }
  const played = events.find(e => e.code === 'CARD_PLAYED');
  if (played && played.seatId === 'you') assert.ok(!frame.game.hand.some(c => c.id === played.cardIds[0]), 'own played card is not in the hand on the settlement frame');
  const pres = m.derivePresentation(pv.game, nv.game);
  assert.ok(pres.gold.every(f => f.code !== 'PAID_HOLE' && f.code !== 'TOOK_HOLE'), 'debt flows never precede the scoreboard');
  // 演出：桌面拼点时场景帧还是结算帧（有牌、有点数），演完才切到结算后的投影
  const initial = { lang: 'zh', hostKind: 'website', mode: 'full', view: null, display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null, knockAt: 0, orientation: 'landscape' };
  const store = m.createStore(initial), controller = m.createController(store, { send() {} });
  const presenter = m.createPresenter(store, controller, { fx: () => null, root: () => ({ querySelector: () => null }), onBusy() {}, sound() {} });
  store.set({ view: pv }); presenter.update(pv, null, false); store.set({ view: nv }); presenter.update(nv, pv, true);
  const scoreAck = { ...nv, actionReceipt: { actionId: 'settle-ack', tableId: nv.table.id, gameId: nv.game.id, revision: nv.game.revision, ok: true } };
  store.set({ view: scoreAck }); presenter.update(scoreAck, nv, true);
  const until = async (fn, ms) => { const end = Date.now() + ms; while (!fn()) { if (Date.now() > end) throw new Error('timeout'); const s = store.get(); if (s.show.power || s.show.formation) controller.dismissPower(); await new Promise(r => setTimeout(r, 15)); } };
  await until(() => store.get().show.tally?.kind === 'score', 15000);
  const atTally = store.get();
  assert.ok(atTally.display.game.seats.every(s => s.flight.length === (report.rows.find(r => r.seatId === s.id)?.cards.length ?? 0)), 'cards stay on the table during the showdown');
  assert.equal(atTally.flow?.game?.revision, pv.game.revision, 'flow rail has not advanced during the showdown');
  presenter.update(scoreAck, scoreAck, true);
  assert.equal(store.get().show.tally.kind, 'score', 'a repeated acknowledgement cannot cancel the showdown');
  await until(() => !!store.get().show.score, 4000);
  const board = store.get().show.score;
  presenter.update(scoreAck, scoreAck, true);
  assert.equal(store.get().show.score, board, 'a repeated acknowledgement cannot cancel the scoreboard');
  await until(() => store.get().display?.game?.revision === nv.game.revision && !store.get().busy, 25000);
  assert.equal(store.get().flow.game.revision, nv.game.revision, 'flow rail advances only after the whole settlement');
  presenter.destroy();
  pass('end-of-gambit frame keeps every scored card on the table through the showdown and scoreboard');
}

// --- 11) 全并列翻注：投影里前注牌已弃，翻注帧把它们按座位次序放回前注区 ---
{
  const g = { ...m.projectSeat(state, leader), ante: [], anteOrigins: [], discard: [m.card('green-6')] }; // 全并列：末张前注牌已成弃牌顶
  const cue = { key: 'r', cardIds: ['red-10', 'blue-6', 'green-6'], allTied: true, payments: [] };
  const frame = m.revealFrame(view(state, { game: g }), cue);
  assert.deepEqual(frame.game.ante.map(c => c.id), cue.cardIds);
  assert.ok(!frame.game.discard.some(c => cue.cardIds.includes(c.id)), 'revealed cards are not also on the discard pile');
  const keys = m.cardPlacements(frame.game, 'landscape').map(p => p.key);
  assert.equal(new Set(keys).size, keys.length, 'every card node key is unique on the reveal frame');
  assert.deepEqual(frame.game.anteOrigins.map(o => o.seatId), g.seats.map(s => s.id));
  assert.ok(m.revealTally(frame.game, cue.cardIds, true).every(i => i.mark === 'tied' && i.seatId), 'all-tied pips exist and are struck');
  pass('all-tied reveal still shows every ante card and strikes them');
}

// --- 12) 拍桌节流；能力事件段切分 ---
{
  const initial = { lang: 'zh', hostKind: 'website', mode: 'full', view: view(state), display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null, knockAt: 0, orientation: 'landscape' };
  const store = m.createStore(initial); let sent = 0; const c = m.createController(store, { send() {}, gesture() { sent++; } });
  c.knock(); const first = store.get().knockAt; c.knock();
  assert.ok(first > 0 && store.get().knockAt === first && sent === 1, 'second knock within 350 ms is ignored');
  const evs = [{ code: 'POWER_TRIGGERED', seatId: 'a', cardIds: ['black-3'] }, { code: 'TOOK_STAKES', seatId: 'a', amount: 3 }, { code: 'POWER_TRIGGERED', seatId: 'a', cardIds: ['red-5'] }, { code: 'PAID_PLAYER', seatId: 'b', targetSeatId: 'a', amount: 1 }];
  assert.deepEqual(m.powerSegment(evs, { key: 'g:1:0', cardId: 'black-3', seatId: 'a', family: 'black' }).map(e => e.code), ['TOOK_STAKES']);
  assert.deepEqual(m.powerSegment(evs, { key: 'g:1:2', cardId: 'red-5', seatId: 'a', family: 'red' }).map(e => e.code), ['PAID_PLAYER']);
  pass('knock is throttled and each power script only sees its own event segment');
}

// --- 13) 布局：2–6 人 × 横竖屏，座位区域（含 4 张牌阵）与中央牌堆互不重叠、都在桌面内 ---
{
  const problems = [];
  for (const n of [2, 3, 4, 5, 6]) for (const o of ['landscape', 'portrait']) {
    const ids = Array.from({ length: n }, (_, i) => ({ id: i ? 'b' + i : 'you', name: i ? 'B' + i : 'You' }));
    const v = m.projectSeat(m.createGame({ id: 'layout', seats: ids, seed: 1 }), 'you');
    for (const cards of [3, 4, 5]) for (const ov of m.layoutOverlaps(v, 'you', o, cards)) problems.push(`${n}p ${o} ${cards}: ${ov.a} x ${ov.b}`);
    for (const id of m.outsideTable(v, 'you', o)) problems.push(`${n}p ${o}: ${id} outside`);
  }
  assert.deepEqual(problems, [], 'layout overlaps / out-of-table');
  pass('layout: every player count and orientation keeps zones apart and on the table');
}

// --- 14) 赤铜龙替换链：落地帧先只放赤铜龙；第二个能力之前，替换才落到桌上（旧牌进弃牌堆、新牌从牌库来） ---
{
  const pv = view(before), g = pv.game, seatId = leader;
  const copper = 'copper-5', silver = 'silver-7';
  // 下一帧：赤铜龙已被银龙替换，且银龙能力已让大家抽牌（公开事件链）
  const nextGame = { ...g, revision: g.revision + 1, seats: g.seats.map(s => s.id === seatId ? { ...s, flight: [...s.flight, { cardId: silver, card: m.card(silver) }], handCount: s.handCount - 1 } : s), discard: [...g.discard, m.card(copper)], events: [...g.events,
    { code: 'CARD_PLAYED', seatId, cardIds: [copper] }, { code: 'POWER_TRIGGERED', seatId, cardIds: [copper] }, { code: 'FLIGHT_REPLACED', seatId, cardIds: [copper, silver] }, { code: 'POWER_TRIGGERED', seatId, cardIds: [silver] } ] };
  const nv = view(state, { game: nextGame });
  const events = m.freshPublicEvents(pv.game, nv.game);
  const landing = m.landingFrame(pv, nv, events);
  assert.ok(landing, 'landing frame exists even though the played card was replaced in the same frame');
  const seatL = landing.game.seats.find(s => s.id === seatId);
  assert.ok(seatL.flight.some(f => f.cardId === copper) && !seatL.flight.some(f => f.cardId === silver), 'first the copper dragon lands, not its replacement');
  const r = m.applyReplacements(landing, events, 3); // 到第二个 POWER_TRIGGERED 之前
  assert.deepEqual(r.fromDeck, [silver], 'the replacement enters from the deck before the second explanation');
  const seatR = r.frame.game.seats.find(s => s.id === seatId);
  assert.ok(seatR.flight.some(f => f.cardId === silver) && !seatR.flight.some(f => f.cardId === copper), 'the silver dragon now sits where the copper was');
  assert.ok(r.frame.game.discard.some(c => c.id === copper), 'the copper dragon went to the discard pile');
  assert.equal(m.applyReplacements(landing, events, 2).fromDeck.length, 0, 'nothing is replaced before the first power resolves');
  pass('copper chain: explanation, then replacement lands, then the new card explains');
}

// --- 15) 真实买牌：说明 → 价格牌 → 付款 → 匿名补牌；同帧多家各自说明且付款只记一次 ---
{
  let found = null;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    let g = m.createGame({ id: 'purchase', seats, seed, startingHand: 3 });
    for (let step = 0; step < 150 && !found; step++) {
      let moved = null;
      for (const seat of g.seats) {
        const action = m.eligibleActions(g, seat.id)[0]; if (!action) continue;
        const base = { id: 'buy-' + g.revision + ':' + seat.id, revision: g.revision, seatId: seat.id };
        const move = action.kind === 'choose' ? { ...base, kind: 'choose', choiceId: action.choice.id, optionIds: action.choice.options.slice(0, action.choice.min).map(option => option.id) } : { ...base, kind: action.kind, cardId: action.cardIds[0] };
        const result = m.applyAction(g, move); if (result.ok) { moved = result.state; break; }
      }
      if (!moved) break;
      const fresh = m.freshPublicEvents(m.projectSeat(g, 'you'), m.projectSeat(moved, 'you'));
      if (fresh.some(event => event.code === 'BUY_PRICE') && !fresh.some(event => event.code === 'POWER_TRIGGERED' || event.code === 'GAMBIT_SCORED' || event.code === 'SPECIAL_FLIGHT' || event.code === 'ANTE_REVEALED')) found = { before: g, after: moved, fresh };
      g = moved;
    }
  }
  assert.ok(found, 'real engine reached an ordinary purchase frame');
  const buyer = found.fresh.find(event => event.code === 'BUY_PRICE').seatId;
  const pv = view(found.before, { game: m.projectSeat(found.before, buyer) }), nv = view(found.after, { game: m.projectSeat(found.after, buyer) });
  const pres = m.derivePresentation(pv.game, nv.game), purchases = pres.rounds.filter(cue => cue.kind === 'purchase');
  assert.ok(purchases.length);
  const held = m.purchaseHoldFrame(pv, nv, found.fresh, 'landscape');
  assert.ok(held.game.hand.every(value => pv.game.hand.some(old => old.id === value.id)), 'not-yet-supplied own cards stay hidden');
  assert.equal(held.game.seats.find(seat => seat.id === buyer).handCount, held.game.hand.length, 'own visible count and held hand agree');
  assert.ok(!held.game.discard.some(value => purchases.some(cue => cue.cardId === value.id)), 'price cards have not reached the discard pile');
  const observer = found.before.seats.find(seat => seat.id !== buyer).id;
  const fullPrevious = { ...pv, game: m.projectOmniscient(found.before, observer) }, fullNext = { ...nv, game: m.projectOmniscient(found.after, observer) };
  const heldFull = m.purchaseHoldFrame(fullPrevious, fullNext, found.fresh, 'landscape');
  for (const cue of purchases) {
    assert.ok(heldFull.game.privateHands[cue.seatId].every(value => fullPrevious.game.privateHands[cue.seatId].some(old => old.id === value.id)), 'even an authorized omniscient observer waits for purchased cards to arrive');
    assert.equal(heldFull.game.seats.find(seat => seat.id === cue.seatId).handCount, heldFull.game.privateHands[cue.seatId].length);
  }
  assert.ok(!('privateHands' in held.game), 'normal purchase holding cannot introduce omniscient data');
  assert.ok(purchases.every(cue => cue.flows.every(flow => !pres.gold.some(generic => generic.key === flow.key))), 'purchase payments cannot also use generic gold paths');
  const initial = { lang: 'zh', hostKind: 'website', mode: 'full', view: null, display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null, knockAt: 0, orientation: 'landscape' };
  const store = m.createStore(initial), controller = m.createController(store, { send() {} }), log = [], sounded = [];
  store.subscribe(() => { const current = store.get(); log.push({ at: performance.now(), banner: current.show.banner?.kind === 'purchase' ? current.show.banner.key : null, ghosts: current.show.ghosts.map(ghost => ({ key: ghost.purchaseKey, cardId: ghost.cardId ?? null })), flowRevision: current.flow?.game?.revision }); });
  const presenter = m.createPresenter(store, controller, { fx: () => null, root: () => ({ querySelector: () => null }), onBusy() {}, sound(kind, key) { sounded.push({ kind, key, at: performance.now() }); } });
  store.set({ view: pv }); presenter.update(pv, null, false); store.set({ view: nv }); presenter.update(nv, pv, true);
  const ack = { ...nv, pending: false }; store.set({ view: ack }); presenter.update(ack, nv, true);
  const deadline = Date.now() + 25000;
  while (store.get().busy) { assert.ok(Date.now() < deadline, 'purchase schedule completed'); await new Promise(resolve => setTimeout(resolve, 15)); }
  for (const cue of purchases) {
    const opened = log.find(entry => entry.banner === cue.key), price = log.find(entry => entry.ghosts.some(ghost => ghost.key === cue.key && ghost.cardId === cue.cardId)), draws = log.find(entry => entry.ghosts.some(ghost => ghost.key === cue.key && ghost.cardId === null));
    assert.ok(opened && price && draws, 'each buyer has an explanation, price flight and replenishment');
    assert.ok(price.at - opened.at >= 1750, 'the purchase explanation is visible before price flipping');
    for (const flow of cue.flows) { const payment = sounded.filter(sound => sound.kind === 'coin' && sound.key === flow.key); assert.equal(payment.length, 1, 'purchase gold runs exactly once'); assert.ok(payment[0].at > price.at && payment[0].at < draws.at, 'payment follows flipping and precedes replenishment'); }
    assert.ok(draws.flowRevision === pv.game.revision, 'turn flow waits for replenishment');
  }
  assert.ok(!store.get().show.ghosts.length && !store.get().show.arrived.length, 'all transient purchase markers clear');
  assert.deepEqual(store.get().display.game.hand, nv.game.hand);
  presenter.destroy();
  pass('real purchase: explanation precedes price flip, each payment runs once, then anonymous replenishment');
}

// --- 16) 跳档仍不回放，当前代际清场 ---
{
  const initial = { lang: 'zh', hostKind: 'website', mode: 'full', view: prevView, display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null, knockAt: 0, orientation: 'landscape' };
  const store = m.createStore(initial), controller = m.createController(store, { send() {} });
  const presenter = m.createPresenter(store, controller, { fx: () => null, root: () => ({ querySelector: () => null }), onBusy() {}, sound() {} });
  presenter.update(prevView, null, false); store.set({ view: nextView }); presenter.update(nextView, prevView, true);
  const jump = { ...nextView, game: { ...nextView.game, revision: nextView.game.revision + 2 } };
  store.set({ view: jump }); presenter.update(jump, nextView, true);
  await new Promise(resolve => setTimeout(resolve, m.SETTLE_MS + m.FOCUS_MS + 50));
  assert.equal(store.get().display, jump); assert.equal(store.get().flow, jump);
  assert.ok(!store.get().show.power && !store.get().busy);
  presenter.destroy();
  pass('revision gaps clear old schedules instead of replaying incomplete events');
}

// --- 17) 公开事件夹具：同一投影的两家购买保持各自归属，牌阵/翻注不重复带走购买款 ---
{
  const pg = prevView.game, a = pg.seats[0].id, b = pg.seats[1].id;
  const fresh = [{ code: 'SPECIAL_FLIGHT', seatId: a, amount: 3 }, { code: 'PAID_PLAYER', seatId: b, targetSeatId: a, amount: 3 }, { code: 'BUY_PRICE', seatId: a, cardIds: ['red-10'], amount: 10 }, { code: 'PAID_STAKES', seatId: a, amount: 10 }, { code: 'BUY_PRICE', seatId: b, cardIds: ['blue-6'], amount: 6 }, { code: 'PAID_PLAYER', seatId: b, targetSeatId: a, amount: 6 }];
  const ng = { ...pg, revision: pg.revision + 1, deckCount: pg.deckCount - 8, discard: [...pg.discard, m.card('red-10'), m.card('blue-6')], seats: pg.seats.map(seat => ({ ...seat, handCount: seat.handCount + (seat.id === a || seat.id === b ? 3 : 0) })), events: [...pg.events, ...fresh] };
  const nv = { ...prevView, game: ng }, pres = m.derivePresentation(pg, ng), cues = pres.rounds.filter(cue => cue.kind === 'purchase');
  assert.deepEqual(cues.map(cue => cue.seatId), [a, b]);
  assert.deepEqual(cues.map(cue => cue.flows.map(flow => flow.fromSeatId)), [[a], [b]], 'each buyer owns only its immediate payment');
  assert.equal(pres.formations[0].flows.length, 1, 'formation stops before the first purchase');
  assert.equal(pres.gold.length, 0, 'formation and purchase payments never duplicate generic flows');
  const moves = m.cardMoves(prevView, nv, fresh, 'landscape');
  for (const cue of cues) {
    const group = moves.ghosts.filter(ghost => ghost.purchaseKey === cue.key);
    assert.equal(group.filter(ghost => ghost.cardId === cue.cardId).length, 1, 'one public price card per buyer');
    assert.equal(group.filter(ghost => !ghost.cardId).length, 3, 'anonymous replenishment belongs to the same buyer');
  }
  pass('public multiple-purchase fixture keeps price cards, private-free draws and gold owned by each buyer');
}

// --- 18) 同 revision 访问范围 / 本家变化立即清除私牌场景、流程与检查器 ---
{
  const other = seats.find(seat => seat.id !== leader).id;
  const fullBefore = { ...prevView, game: m.projectOmniscient(before, leader) }, fullNext = { ...nextView, game: m.projectOmniscient(state, leader) };
  const switched = { ...nextView, game: m.projectSeat(state, other) };
  const cases = [
    { name: 'omniscient to own seat', previous: fullBefore, next: fullNext, changed: nextView },
    { name: 'own seat to omniscient', previous: prevView, next: nextView, changed: fullNext },
    { name: 'self seat changes', previous: prevView, next: nextView, changed: switched },
    { name: 'omniscient to no game', previous: fullBefore, next: fullNext, changed: { ...nextView, game: null } },
  ];
  for (const item of cases) {
    const initial = { lang: 'zh', hostKind: 'website', mode: 'full', view: item.previous, display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: '', inspect: null, show: m.emptyShow(), busy: false, soundOn: false, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null, knockAt: 0, orientation: 'landscape' };
    const store = m.createStore(initial), controller = m.createController(store, { send() {} });
    const presenter = m.createPresenter(store, controller, { fx: () => null, root: () => ({ querySelector: () => null }), onBusy() {}, sound() {} });
    presenter.update(item.previous, null, false); store.set({ view: item.next }); presenter.update(item.next, item.previous, true);
    assert.ok(store.get().busy, item.name + ': a presentation is underway');
    store.set({ inspect: { cardId: ready, pinned: true }, hovered: ready, selected: [ready], keyboardCard: ready, keyboardHeld: true });
    store.set({ view: item.changed }); presenter.update(item.changed, item.next, true);
    assert.equal(store.get().display, item.changed, item.name + ': new projection replaces the old scene immediately');
    assert.equal(store.get().flow, item.changed, item.name + ': old private flow cannot remain');
    assert.ok(!store.get().busy && !store.get().show.power && !store.get().show.score);
    assert.equal(store.get().inspect, null, item.name + ': a previously selected private face is cleared');
    assert.deepEqual(store.get().selected, []);
    assert.equal(store.get().hovered, null);
    assert.equal(store.get().keyboardCard, null);
    await new Promise(resolve => setTimeout(resolve, m.SETTLE_MS + m.FOCUS_MS + 50));
    assert.equal(store.get().display, item.changed, item.name + ': old queue never restores its private projection');
    if (item.changed.game && !('omniscient' in item.changed.game)) for (const key of ['privateHands', 'privateCommittedAntes', 'privateHandPowerHints', 'privateDeck', 'privateExcluded']) { assert.ok(!(key in store.get().display.game)); assert.ok(!(key in store.get().flow.game)); }
    presenter.destroy();
  }
  pass('same-revision projection scope or self-seat changes clear old private frames and inspection immediately');
}

writeFileSync(join(out, 'result.json'), JSON.stringify({ checks }, null, 2));
console.log(`${checks.length} checks passed`);
