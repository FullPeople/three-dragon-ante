/** 演出调度：投影按序进入画面；翻注、落牌、聚焦、能力说明、能力特效、金币流转、特殊牌阵说明、拼点、计分板严格串行。
 * 规格见 AI_CONTEXT/GOAL.md §4.3：出牌落地（抽出 → 加速落下 → 尘土）→ 停一拍 → 聚焦 → 能力说明（玩家关闭）→ 能力特效与金币 → 停一拍；
 * 轮局结束：特殊牌阵说明（玩家关闭）→ 桌面拼点（数字浮现 → 最高亮 / 并列划掉）→ 计分板 → 发奖池 → 结算后的金币 → 阶段标签才变。
 * 末牌与结算同帧时，投影里牌阵已清空：用上一帧 + 公开的 ScoreReport 合成"结算帧"，整段演出都在这一帧上做，演完才切到结算后的投影。
 * 这里永远不改规则状态，只决定"什么时候把哪一帧给场景看"。减少动态偏好下动画瞬移，但顺序与等待时长不变。 */
import type { TableView } from "../../game/protocol";
import type { PublicEvent, PublicView, ScoreReport, SeatView } from "../../game/rules/types";
import { card } from "../../game/rules/cards";
import { derivePresentation, freshPublicEvents, type FormationCue, type Presentation, type PublicGoldFlow, type PowerCue, type RevealCue, type RoundCue } from "../model/cues";
import { wait } from "../fx/motion";
import type { FxLayer, Point, Rect } from "../fx/particles";
import { familyFx, isLegendary, powerScript, type PowerFxContext } from "../fx/powers";
import { emptyShow, type GhostCard, type Store, type TallyItem } from "./store";
import { CENTER, cardPlacements, fanPose, handShadowPose, seatPlacements, type Pose } from "../model/layout";
import type { Controller } from "./controller";

export { familyFx };
/** SETTLE 从显示落地帧起算，要盖住"抬起 + 落下"（约 480 ms）再停一拍。 */
export const BEAT_MS = 300, SETTLE_MS = 1100, FOCUS_MS = 420, PLACE_MS = 250, FLIP_MS = 360, PRICE_MS = 640, PAY_MS = 470, TALLY_MS = 700, MARK_MS = 1000;

export interface PresenterHooks { fx(): FxLayer | null; root(): { querySelector(selector: string): Element | null; querySelectorAll?(selector: string): ArrayLike<Element> }; onBusy(busy: boolean): void; sound(kind: string, key: string): void }

interface QueueItem { view: TableView; previous: TableView; pres: Presentation; events: PublicEvent[] }

const safeCard = (id: string) => { try { return card(id); } catch { return null; } };
const playedOf = (events: readonly PublicEvent[]) => events.find(e => e.code === "CARD_PLAYED" && e.seatId && e.cardIds?.[0]);
/** 本家视图：去掉刚打出的牌、清空可用动作 */
function withoutOwnCard(game: PublicView | SeatView, cardId: string | null) {
  if (!("selfSeatId" in game)) return game;
  const own = game as SeatView;
  return { ...own, hand: cardId ? own.hand.filter(c => c.id !== cardId) : own.hand, actions: [], handPowerHints: cardId ? own.handPowerHints.filter(h => h.cardId !== cardId) : own.handPowerHints } as SeatView;
}

/** 落地帧：上一帧 + 刚打出的那张牌放进牌阵。其余效果（偷牌、抽牌、金币）留到说明关闭后。
 *  只用公共事件里已公开的牌 id 与下一帧的公开牌阵条目，不碰任何私牌。 */
export function landingFrame(previous: TableView, next: TableView, events: PublicEvent[]): TableView | null {
  const pg = previous.game, ng = next.game; if (!pg || !ng) return null;
  const played = playedOf(events);
  if (!played) return null;
  const seatId = played.seatId!, cardId = played.cardIds![0];
  const entry = ng.seats.find(s => s.id === seatId)?.flight.find(f => f.cardId === cardId);
  if (!entry || pg.seats.some(s => s.flight.some(f => f.cardId === cardId))) return null;
  const seats = pg.seats.map(s => s.id === seatId ? { ...s, flight: [...s.flight, entry], handCount: Math.max(0, s.handCount - 1) } : s);
  const game = withoutOwnCard({ ...pg, seats, waitingSeatIds: [] } as PublicView | SeatView, cardId);
  return { ...next, game };
}

/** 结算帧：上一帧 + 公开 ScoreReport 里每家结算时的牌（含刚打出的末牌）与总点数。结算后的投影里牌阵已空，不能直接拿来演。 */
export function settlementFrame(previous: TableView, next: TableView, events: PublicEvent[], report: ScoreReport): TableView | null {
  const pg = previous.game; if (!pg || !next.game) return null;
  const played = playedOf(events);
  const seats = pg.seats.map(s => {
    const row = report.rows.find(r => r.seatId === s.id);
    const flight = row ? row.cards.flatMap(c => { const prev = s.flight.find(f => f.cardId === c.cardId); if (prev) return [prev]; const value = safeCard(c.cardId); return value ? [{ cardId: c.cardId, card: value }] : []; }) : s.flight;
    const handCount = played?.seatId === s.id && !s.flight.some(f => f.cardId === played.cardIds![0]) ? Math.max(0, s.handCount - 1) : s.handCount;
    return { ...s, flight, handCount, strength: row ? row.total : s.strength, scoringStrength: row ? row.total : s.scoringStrength };
  });
  const game = withoutOwnCard({ ...pg, seats, waitingSeatIds: [], activeSeatId: null } as PublicView | SeatView, played?.cardIds?.[0] ?? null);
  return { ...next, game };
}

/** 翻注帧：全并列时引擎同帧已把前注牌弃掉，投影里找不到它们；按 ANTE_REVEALED 的座位次序把牌放回前注区来演翻开与划掉。 */
export function revealFrame(next: TableView, cue: RevealCue): TableView {
  const g = next.game; if (!g) return next;
  const present = new Set(g.ante.map(c => c.id));
  if (cue.cardIds.every(id => present.has(id))) return next;
  const ids = new Set(cue.cardIds);
  const ante = cue.cardIds.flatMap(id => { const value = safeCard(id); return value ? [value] : []; });
  const anteOrigins = cue.cardIds.map((cardId, i) => ({ seatId: g.seats[i]?.id ?? "", cardId })).filter(o => o.seatId);
  // 同一张牌不能既在前注区又在弃牌堆（节点 key 会重复）：弃牌堆里属于本次翻注的牌先拿掉，翻注演完再显示真实投影
  const discard = g.discard.filter(c => !ids.has(c.id));
  return { ...next, game: { ...g, ante, anteOrigins, discard, seats: g.seats.map(s => ({ ...s, committed: false })) } as PublicView | SeatView };
}

/** 翻注拼点：每张前注牌一个数字；领出者的牌打"领出"，点数重复的打"并列"（全并列时全部划掉）。 */
export function revealTally(game: PublicView, cardIds: readonly string[], allTied: boolean): TallyItem[] {
  const origins = new Map((game.anteOrigins ?? []).map(o => [o.cardId, o.seatId]));
  const strengths = new Map(cardIds.map(id => [id, safeCard(id)?.strength ?? 0] as const));
  const counts = new Map<number, number>(); for (const v of strengths.values()) counts.set(v, (counts.get(v) ?? 0) + 1);
  const leaderCard = [...origins].find(([, seatId]) => seatId === game.leaderSeatId)?.[0];
  return cardIds.map(cardId => { const value = strengths.get(cardId) ?? 0; const mark: TallyItem["mark"] = allTied ? "tied" : cardId === leaderCard ? "lead" : (counts.get(value) ?? 0) > 1 ? "tied" : "none"; return { seatId: origins.get(cardId) ?? "", cardId, value, mark }; });
}

/** 轮局拼点：每家总点数；胜者打"胜"，多人并列打"并列"，龙神限制打"不能获胜"。 */
export function scoreTally(report: ScoreReport): TallyItem[] {
  return report.rows.map(row => ({ seatId: row.seatId, value: row.total, mark: !row.eligible ? "out" : report.winners.includes(row.seatId) ? (report.winners.length > 1 ? "tied" : "win") : "none" }));
}

/** 这个能力提示对应的事件段：从它的 POWER_TRIGGERED 到下一个 POWER_TRIGGERED 之前。 */
export function powerSegment(events: readonly PublicEvent[], cue: PowerCue): PublicEvent[] {
  const index = Number(/:(\d+)$/.exec(cue.key)?.[1] ?? -1);
  if (index < 0 || events[index]?.code !== "POWER_TRIGGERED") return [...events];
  let end = events.length; for (let j = index + 1; j < events.length; j++) if (events[j].code === "POWER_TRIGGERED") { end = j; break; }
  return events.slice(index + 1, end);
}

/** 卡牌转移：公共事件 + 两帧公开计数差 → 一张一张的幽灵牌（抽牌从牌库、偷牌从被偷者手里、取前注从前注区、弃手牌到弃牌堆、时间龙从弃牌堆）。
 *  只用公共信息：对手手牌永远是牌背；本家拿到的牌在幽灵落地后才由手牌层显示。 */
export function cardMoves(previous: TableView, next: TableView, events: readonly PublicEvent[], orientation: "landscape" | "portrait"): { ghosts: GhostCard[]; tug: { seatId: string; index: number } | null } {
  const pg = previous.game, ng = next.game; if (!pg || !ng) return { ghosts: [], tug: null };
  const selfId = "selfSeatId" in ng ? (ng as SeatView).selfSeatId : null;
  const seats = seatPlacements(ng, selfId, orientation), center = CENTER[orientation];
  const placements = cardPlacements(pg, orientation);
  const handOf = (seatId: string): Pose => { const seat = seats.find(s => s.id === seatId)!; return seat.self ? handShadowPose(orientation, fanPose(0, 1, orientation)) : { x: seat.hand.x, y: seat.hand.y, rot: seat.rot, scale: 0.5, z: 30 }; };
  const deck: Pose = { x: center.deck.x, y: center.deck.y, rot: 0, scale: 1, z: 20 }, discard: Pose = { x: center.discard.x, y: center.discard.y, rot: 4, scale: 1, z: 20 };
  const ghosts: GhostCard[] = []; let tug: { seatId: string; index: number } | null = null;
  const inflow = new Map<string, number>(); // 已由事件解释的进牌数
  let t = 0; const push = (g: Omit<GhostCard, "delay" | "duration" | "key">, ms = 520) => { ghosts.push({ key: `g${ghosts.length}`, delay: t, duration: ms, ...g }); t += 110; };
  for (const e of events) {
    if (e.code === "CARD_TRANSFERRED" && e.seatId && e.targetSeatId) {
      const victim = pg.seats.find(s => s.id === e.seatId); if (victim && e.seatId !== selfId) tug = { seatId: e.seatId, index: Math.floor(Math.min(victim.handCount, 10) / 2) };
      push({ cardId: e.cardIds?.[0], from: handOf(e.seatId), to: handOf(e.targetSeatId), faceDown: !e.cardIds?.[0], flip: !!e.cardIds?.[0] }, 700);
      inflow.set(e.targetSeatId, (inflow.get(e.targetSeatId) ?? 0) + 1);
    } else if (e.code === "DISCARD_RECLAIMED" && e.seatId) {
      const n = Math.min(6, e.cardIds?.length ?? e.amount ?? 0);
      for (let i = 0; i < n; i++) push({ cardId: e.cardIds?.[i], from: discard, to: handOf(e.seatId), faceDown: false }, 480);
      inflow.set(e.seatId, (inflow.get(e.seatId) ?? 0) + n);
    }
  }
  // 前注区的牌被拿进手牌（青铜龙 / 同点牌阵奖励）
  for (const card of pg.ante) if (!ng.ante.some(c => c.id === card.id) && !ng.discard.some(c => c.id === card.id) && !ng.seats.some(s => s.flight.some(f => f.cardId === card.id))) {
    const from = placements.find(p => p.cardId === card.id)?.pose; const taker = ng.seats.find(s => s.handCount > (pg.seats.find(p => p.id === s.id)?.handCount ?? 0) + (inflow.get(s.id) ?? 0));
    if (from && taker) { push({ cardId: card.id, from, to: handOf(taker.id), faceDown: false }, 560); inflow.set(taker.id, (inflow.get(taker.id) ?? 0) + 1); }
  }
  // 弃手牌（狗头人）：手牌减少且弃牌堆增加
  const discarded = ng.discard.length - pg.discard.length;
  // 其余的手牌增加 = 从牌库抽的；一张一张飞
  for (const s of ng.seats) {
    const before = pg.seats.find(p => p.id === s.id)?.handCount ?? 0, delta = s.handCount - before - (inflow.get(s.id) ?? 0);
    if (delta < 0 && discarded > 0) for (let i = 0; i < Math.min(4, -delta); i++) push({ from: handOf(s.id), to: discard, faceDown: s.id !== selfId }, 460);
    for (let i = 0; i < Math.min(5, delta); i++) push({ from: deck, to: handOf(s.id), faceDown: true, flip: s.id === selfId }, 520);
  }
  return { ghosts, tug };
}

type GoldHold = { seats: Record<string, number>; stakes: number; hole: number };
const goldOf = (view: TableView | null): GoldHold | null => { const g = view?.game; return g ? { seats: Object.fromEntries(g.seats.map(s => [s.id, s.gold])), stakes: g.stakes, hole: g.hole } : null; };

export function createPresenter(store: Store, controller: Controller, hooks: PresenterHooks) {
  const queue: QueueItem[] = [];
  let running = false, destroyed = false, generation = 0;
  const centerOf = (selector: string): Point | null => { const el = hooks.root().querySelector(selector) as HTMLElement | null; if (!el || typeof el.getBoundingClientRect !== "function") return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
  const rectOf = (selector: string): Rect | null => { const el = hooks.root().querySelector(selector) as HTMLElement | null; if (!el || typeof el.getBoundingClientRect !== "function") return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
  const esc = (value: string) => typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
  const cardPoint = (cardId: string) => centerOf(`[data-card="${esc(cardId)}"]`);
  const seatCoins = (seatId: string) => centerOf(`[data-coins-seat="${esc(seatId)}"]`);
  const pile = (id: string) => centerOf(`[data-pile="${id}"]`);
  const endpoint = (id: string) => id === "stakes" || id === "hole" ? pile(id) : seatCoins(id);
  const handPoint = (seatId: string): Point | null => {
    const root = hooks.root(); const all = root.querySelectorAll ? Array.from(root.querySelectorAll(`[data-zone="hand"][data-seat="${esc(seatId)}"]`)) : [];
    const el = all[Math.floor(all.length / 2)] as HTMLElement | undefined; if (!el || typeof el.getBoundingClientRect !== "function") return null;
    const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  const beat = (ms = BEAT_MS) => wait(ms);
  const show = (patch: Partial<ReturnType<typeof emptyShow>>) => store.set(s => ({ show: { ...s.show, ...patch } }));
  /** 场景帧（卡牌、金币）。流程轨 / 等待行读的是 flow 帧，只在演出结束后更新。 */
  const display = (view: TableView) => store.set({ display: view });
  const commitFlow = (view: TableView) => store.set({ flow: view });
  // 金币数字冻结在上一帧，每段弧线落地后再把这一笔记进去，直到演出结束才解除冻结
  const holdGold = (view: TableView | null) => { if (!store.get().goldHold) store.set({ goldHold: goldOf(view) }); };
  const releaseGold = () => store.set({ goldHold: null });
  const bookFlow = (from: string, to: string, amount: number) => store.set(s => { const h = s.goldHold; if (!h) return {}; const next = { seats: { ...h.seats }, stakes: h.stakes, hole: h.hole }; const sub = (id: string, n: number) => { if (id === "stakes") next.stakes = Math.max(0, next.stakes - n); else if (id === "hole") next.hole = Math.max(0, next.hole - n); else if (id in next.seats) next.seats[id] = Math.max(0, next.seats[id] - n); }; const add = (id: string, n: number) => { if (id === "stakes") next.stakes += n; else if (id === "hole") next.hole += n; else if (id in next.seats) next.seats[id] += n; }; sub(from, amount); add(to, amount); return { goldHold: next }; });
  function setBusy(value: boolean) { if (store.get().busy !== value) { store.set({ busy: value }); hooks.onBusy(value); } }
  const flight = (from: Point | null, to: Point | null, amount: number, duration: number) => { const fx = hooks.fx(); if (!from || !to || !fx) return wait(duration); return Promise.race([fx.coins(from, to, Math.min(8, Math.max(1, Math.ceil(amount / 2))), duration), wait(duration + 8 * 70 + 400)]); };
  const seatIds = () => store.get().view?.game?.seats.map(s => s.id) ?? [];
  const fxContext = (): PowerFxContext | null => { const fx = hooks.fx(); if (!fx) return null; return { fx, cardPoint, seatPoint: id => centerOf(`[data-seat-plate="${esc(id)}"]`), seatRect: id => rectOf(`[data-drop-zone="flight"][data-drop-seat="${esc(id)}"]`), coinsPoint: seatCoins, handPoint, pile: id => pile(id), seatIds: seatIds(), sound: hooks.sound }; };

  async function goldArcs(flows: readonly PublicGoldFlow[], gen: number) {
    // 每段金币弧之间都查代际：清场后剩下的弧不再播，也不再出声。付款方的区域先亮一下（被收钱的人也有反馈）。
    for (const flow of flows) {
      if (gen !== generation) return;
      const payer = flow.fromSeatId !== "stakes" && flow.fromSeatId !== "hole" ? rectOf(`[data-drop-zone="flight"][data-drop-seat="${esc(flow.fromSeatId)}"]`) : null;
      if (payer) { void hooks.fx()?.pulse(payer, "ember", 520); hooks.sound("pay", flow.key + ":pay"); await beat(180); if (gen !== generation) return; }
      hooks.sound("coin", flow.key); await flight(endpoint(flow.fromSeatId), endpoint(flow.toSeatId), flow.amount, 620); if (gen !== generation) return; bookFlow(flow.fromSeatId, flow.toSeatId, flow.amount);
    }
  }
  /** 卡牌转移动画：先让被偷的牌背前伸抖动，再放幽灵牌一张张飞；全部落地后才显示新帧 */
  async function transfers(previous: TableView, view: TableView, events: readonly PublicEvent[], gen: number) {
    const { ghosts, tug } = cardMoves(previous, view, events, store.get().orientation);
    if (!ghosts.length) return;
    if (tug) { show({ tug }); hooks.sound("draw", `${view.game?.id}:${view.game?.revision}:tug`); await beat(620); if (gen !== generation) return; show({ tug: null }); }
    show({ ghosts }); for (const g of ghosts) hooks.sound("draw", `${view.game?.id}:${view.game?.revision}:${g.key}`);
    const total = Math.max(...ghosts.map(g => g.delay + g.duration)) + 60;
    await beat(total); if (gen !== generation) return;
    show({ ghosts: [] });
  }

  async function runReveal(item: QueueItem, gen: number) {
    const reveal = item.pres.reveal!;
    const frame = revealFrame(item.view, reveal), game = frame.game!;
    const strengths = reveal.cardIds.map(id => safeCard(id)?.strength ?? 0);
    const top = Math.max(...strengths), topIds = reveal.cardIds.filter((id, i) => strengths[i] === top);
    holdGold(item.previous);
    show({ reveal, revealPhase: "placing", revealTopIds: [] }); display(frame);
    await beat(PLACE_MS); if (gen !== generation) return;
    show({ revealPhase: "revealing" }); hooks.sound("flip", reveal.key);
    await beat(FLIP_MS); if (gen !== generation) return;
    // 拼点：数字浮现，再打标（领出 / 并列）
    const items = revealTally(game, reveal.cardIds, reveal.allTied);
    show({ revealPhase: "price", tally: { kind: "reveal", step: 1, items } }); hooks.sound("tally", reveal.key + ":tally");
    await beat(TALLY_MS); if (gen !== generation) return;
    show({ revealTopIds: reveal.allTied ? [] : topIds, tally: { kind: "reveal", step: 2, items } }); hooks.sound("mark", reveal.key + ":mark");
    for (const id of reveal.allTied ? [] : topIds) { const p = cardPoint(id); if (p) hooks.fx()?.burst(p, "crown", 0.8); }
    await beat(PRICE_MS); if (gen !== generation) return;
    if (reveal.allTied) { show({ revealPhase: "discard" }); await beat(PAY_MS); }
    else {
      show({ revealPhase: "payment" }); hooks.sound("coin", reveal.key + ":pay");
      const stakes = pile("stakes");
      await Promise.all(reveal.payments.map(pay => flight(seatCoins(pay.seatId), stakes, pay.amount, PAY_MS)));
      if (gen !== generation) return;
      for (const pay of reveal.payments) bookFlow(pay.seatId, "stakes", pay.amount);
    }
    if (gen !== generation) return;
    show({ reveal: null, revealPhase: null, revealTopIds: [], tally: null });
    if (frame !== item.view) display(item.view);
  }

  function waitDismiss(open: () => void, close: () => void): Promise<void> {
    return new Promise(resolve => { open(); controller.onPowerDismiss(() => { close(); resolve(); }); });
  }
  function spotlight(cue: PowerCue): Promise<void> {
    return waitDismiss(() => { show({ power: cue, resolvingSeatId: cue.seatId }); hooks.sound("spotlight", cue.key); }, () => show({ power: null }));
  }
  function formation(cue: FormationCue): Promise<void> {
    return waitDismiss(() => { show({ formation: cue }); hooks.sound("round", cue.key); }, () => show({ formation: null }));
  }

  async function banner(cue: RoundCue, gen: number) {
    show({ banner: cue });
    if (cue.kind === "end") hooks.sound("gameover", cue.key); else if (cue.kind === "round" || cue.kind === "ante") hooks.sound("round", cue.key); else hooks.sound("turn", cue.key);
    await beat(cue.kind === "turn" ? 1500 : cue.kind === "end" ? 2600 : 1800);
    if (gen !== generation) return;
    show({ banner: null });
  }

  async function scoreboard(cue: Extract<RoundCue, { kind: "score" }>, gen: number) {
    // 先在桌面上拼点，再展开计分板讲细节
    const items = scoreTally(cue.report);
    show({ tally: { kind: "score", step: 1, items }, scoring: true }); hooks.sound("tally", cue.key + ":tally");
    await beat(TALLY_MS); if (gen !== generation) return;
    show({ tally: { kind: "score", step: 2, items } }); hooks.sound("mark", cue.key + ":mark");
    for (const id of cue.report.winners) { const p = centerOf(`[data-strength-seat="${esc(id)}"]`); if (p) hooks.fx()?.burst(p, "crown", 0.9); }
    await beat(MARK_MS); if (gen !== generation) return;
    const max = Math.max(0, ...cue.report.rows.map(row => row.cards.length));
    const maxStep = max + 2;
    show({ score: { report: cue.report, step: 0, maxStep } });
    await beat(650);
    for (let step = 1; step <= maxStep; step++) {
      if (gen !== generation) return;
      show({ score: { report: cue.report, step, maxStep } });
      hooks.sound(step > max + 1 ? "coin" : "flip", `${cue.key}:${step}`);
      await beat(step === maxStep ? 2400 : step === max + 1 ? 1000 : 650);
    }
    if (gen !== generation) return;
    show({ score: null, scoring: false, tally: null });
    await beat(200); if (gen !== generation) return;
    const stakes = pile("stakes");
    await Promise.all(cue.report.payouts.map(payout => flight(stakes, seatCoins(payout.seatId), payout.amount, 620)));
    if (gen !== generation) return;
    for (const payout of cue.report.payouts) bookFlow("stakes", payout.seatId, payout.amount);
    await beat(400);
  }

  async function pump() {
    if (running || destroyed) return; running = true; const gen = ++generation;
    try {
      while (queue.length && !destroyed && gen === generation) {
        const item = queue.shift()!;
        const { view, pres, previous, events } = item;
        const played = events.some(e => e.code === "CARD_PLAYED" || e.code === "FLIGHT_REPLACED");
        // 上一帧留下的"等待选择"特效：选择已结算 → 收尾（环 + 爆发），再继续本帧
        const hold = store.get().show.powerHold;
        if (hold && view.game?.choice?.id !== hold.choiceId) {
          setBusy(true);
          hooks.fx()?.ambient(`hold:${hold.choiceId}`, null);
          const p = centerOf(`[data-strength-seat="${esc(hold.seatId)}"]`) ?? centerOf(`[data-seat-plate="${esc(hold.seatId)}"]`);
          if (p) { hooks.sound("power-impact", `${hold.choiceId}:close`); await hooks.fx()?.ring(p, familyFx(hold.cue.family), 120, 600); if (gen !== generation) return; }
          show({ powerHold: null });
        }
        const hasShow = !!(pres.reveal || pres.powers.length || pres.rounds.length || pres.gold.length || pres.goldAfterScore.length || pres.formations.length);
        setBusy(hasShow);
        const scoreCue = pres.rounds.find((c): c is Extract<RoundCue, { kind: "score" }> => c.kind === "score");
        // 结算帧：末牌与结算同帧时，整段演出（落牌、能力、特殊牌阵、拼点、计分板）都在合成帧上做
        const settlement = scoreCue ? settlementFrame(previous, view, events, scoreCue.report) : null;
        const shown = settlement ?? view;
        if (pres.reveal) { await runReveal(item, gen); if (gen !== generation) return; }
        else if (pres.powers.length) {
          // 第一步：只落牌（抽出 → 落下 → 尘土）。第二步：停一拍、聚焦。第三步：说明。第四步：能力特效与金币。
          const landing = settlement ?? landingFrame(previous, view, events);
          holdGold(previous);
          display(landing ?? view);
          await beat(SETTLE_MS); if (gen !== generation) return;
          const first = pres.powers[0];
          if (isLegendary(first.cardId)) { const p = cardPoint(first.cardId); if (p) { hooks.sound("sigil", first.key + ":presence"); void hooks.fx()?.sigil(p, familyFx(first.family), 150, 1500); await beat(700); if (gen !== generation) return; } }
          for (const [i, cue] of pres.powers.entries()) {
            // 每个能力（含连锁、替换上来的牌）都先聚焦再说明
            show({ focusCardId: cue.cardId });
            await beat(i === 0 ? FOCUS_MS : 320); if (gen !== generation) return;
            await spotlight(cue); if (gen !== generation) return;
            show({ focusCardId: null });
            const ctx = fxContext();
            if (ctx) { await powerScript(cue, powerSegment(events, cue), ctx); } else await beat(200);
            if (gen !== generation) return;
            // 卡牌转移（抽 / 偷 / 取前注）在特效之后、显示新帧之前，一张一张飞
            if (i === pres.powers.length - 1) { await transfers(previous, view, events, gen); if (gen !== generation) return; }
            if (i === pres.powers.length - 1 && landing && !settlement) display(view);
            hooks.sound("power-impact", cue.key);
            await beat(260); if (gen !== generation) return;
            // 能力需要某家选择：特效停在该家区域（持续粒子 + 标记），释放 busy 让面板出现；选择结算后在下一帧播收尾
            const choice = view.game?.choice;
            if (choice && (choice.sourceCardId === cue.cardId || view.game?.resolutionStack.some(step => step.status === "active" && step.sourceCardId === cue.cardId))) {
              show({ powerHold: { cue, seatId: choice.seatId, choiceId: choice.id } });
              const rect = rectOf(`[data-drop-zone="flight"][data-drop-seat="${esc(choice.seatId)}"]`);
              hooks.fx()?.ambient(`hold:${choice.id}`, { kind: familyFx(cue.family), rate: 4, area: rect ? { x: rect.x - 30, y: rect.y - 30, w: rect.w + 60, h: rect.h + 60 } : null, drift: { x: 0, y: -22 }, size: 2.6, life: 2.2, alpha: 0.8 });
            }
          }
          await goldArcs(pres.gold, gen); if (gen !== generation) return;
          await beat(); if (gen !== generation) return;
          show({ resolvingSeatId: null });
        } else if (pres.gold.length) { holdGold(previous); await transfers(previous, shown, events, gen); if (gen !== generation) return; display(shown); await beat(SETTLE_MS); if (gen !== generation) return; await goldArcs(pres.gold, gen); if (gen !== generation) return; await beat(); if (gen !== generation) return; }
        else { await transfers(previous, shown, events, gen); if (gen !== generation) return; display(shown); if (played && (pres.rounds.length || pres.formations.length)) { await beat(SETTLE_MS); if (gen !== generation) return; } }
        for (const cue of pres.formations) {
          holdGold(previous);
          const p = cue.cardIds.map(cardPoint).find(Boolean);
          if (p) { hooks.sound("sigil", cue.key + ":sigil"); void hooks.fx()?.sigil(p, cue.kind === "strength" ? "tide" : cue.kind === "mortal" ? "arcane" : "crown", 170, 1600); await beat(500); if (gen !== generation) return; }
          await formation(cue); if (gen !== generation) return;
          await goldArcs(cue.flows, gen); if (gen !== generation) return;
          await beat(); if (gen !== generation) return;
        }
        for (const cue of pres.rounds) {
          if (cue.kind === "score") {
            holdGold(previous); await beat(SETTLE_MS); if (gen !== generation) return;
            await scoreboard(cue, gen); if (gen !== generation) return;
            // 发完奖池才切到结算后的投影，再播结算后的金币（偿债、君王付款、终局取偿债池）
            if (settlement) display(view);
            await goldArcs(pres.goldAfterScore, gen); if (gen !== generation) return;
          } else await banner(cue, gen);
          if (gen !== generation) return;
        }
        if (!scoreCue && pres.goldAfterScore.length) { await goldArcs(pres.goldAfterScore, gen); if (gen !== generation) return; }
        if (store.get().display !== view) display(view);
        releaseGold();
        if (hasShow) { await beat(); if (gen !== generation) return; }
        // 阶段标签、等待行只在整个演出结束后才换到新帧。
        commitFlow(view);
      }
    } finally { if (gen === generation) { running = false; releaseGold(); setBusy(false); } }
  }

  return {
    /** 相邻、同一局、在线的投影走演出队列；其他一律直接替换画面。 */
    update(next: TableView, previous: TableView | null, live: boolean) {
      const prevGame = previous?.game ?? null, nextGame = next.game;
      const adjacent = live && !!previous && !!prevGame && !!nextGame && prevGame.id === nextGame.id && nextGame.revision === prevGame.revision + 1;
      if (!adjacent) { this.clear(); display(next); commitFlow(next); return; }
      const pres = derivePresentation(prevGame, nextGame);
      const events = freshPublicEvents(prevGame, nextGame), key = `${nextGame.id}:${nextGame.revision}`;
      if (events.some(e => e.code === "DECK_RESHUFFLED")) hooks.sound("shuffle", key);
      queue.push({ view: next, previous: previous!, pres, events });
      void pump();
    },
    clear() { generation++; queue.length = 0; running = false; const hold = store.get().show.powerHold; if (hold) hooks.fx()?.ambient(`hold:${hold.choiceId}`, null); store.set(s => ({ show: emptyShow(), goldHold: null, flow: s.display })); setBusy(false); controller.dismissPower(); },
    destroy() { destroyed = true; this.clear(); },
  };
}
