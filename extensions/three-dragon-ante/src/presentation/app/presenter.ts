/** 演出调度：投影按序进入画面；翻注、落牌、聚焦、能力说明、能力特效、金币流转、特殊牌阵说明、拼点、计分板严格串行。
 * 规格见 AI_CONTEXT/GOAL.md §4.3：出牌落地（抽出 → 加速落下 → 尘土）→ 停一拍 → 聚焦 → 能力说明（玩家关闭）→ 能力特效与金币 → 停一拍；
 * 轮局结束：特殊牌阵说明（玩家关闭）→ 桌面拼点（数字浮现 → 最高亮 / 并列划掉）→ 计分板 → 发奖池 → 结算后的金币 → 阶段标签才变。
 * 末牌与结算同帧时，投影里牌阵已清空：用上一帧 + 公开的 ScoreReport 合成"结算帧"，整段演出都在这一帧上做，演完才切到结算后的投影。
 * 这里永远不改规则状态，只决定"什么时候把哪一帧给场景看"。减少动态偏好下动画瞬移，但顺序与等待时长不变。 */
import type { TableView } from "../../game/protocol";
import type { OmniscientView, PublicEvent, PublicView, ScoreReport, SeatView } from "../../game/rules/types";
import { card } from "../../game/rules/cards";
import { derivePresentation, freshPublicEvents, type FormationCue, type Presentation, type PublicGoldFlow, type PowerCue, type RevealCue, type RoundCue } from "../model/cues";
import { wait } from "../fx/motion";
import type { FxLayer, Point, Rect } from "../fx/particles";
import type { FxStage } from "../fx3d/FxStage";
import { familyFx, isLegendary, powerScript, type PowerFxContext } from "../fx/powers";
import { emptyShow, type GhostCard, type Store, type TallyItem } from "./store";
import { CENTER, cardPlacements, fanPose, handShadowPose, seatPlacements, type Pose } from "../model/layout";
import type { Controller } from "./controller";

export { familyFx };
/** SETTLE 从显示落地帧起算，要盖住"抬起 + 落下"（约 480 ms）再停一拍。 */
export const BEAT_MS = 300, SETTLE_MS = 1100, FOCUS_MS = 420, PLACE_MS = 250, FLIP_MS = 360, PRICE_MS = 640, PAY_MS = 470, TALLY_MS = 700, MARK_MS = 1000;

export interface PresenterHooks { fx(): FxLayer | null; fx3d?(): FxStage | null; root(): { querySelector(selector: string): Element | null; querySelectorAll?(selector: string): ArrayLike<Element> }; onBusy(busy: boolean): void; sound(kind: string, key: string): void }

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
  if (pg.seats.some(s => s.flight.some(f => f.cardId === cardId))) return null;
  // 这张牌可能同帧已被替换掉（赤铜龙）：下一帧的牌阵里找不到它，就用公开的牌 id 自己造条目
  const entry = ng.seats.find(s => s.id === seatId)?.flight.find(f => f.cardId === cardId) ?? (safeCard(cardId) ? { cardId, card: safeCard(cardId)! } : null);
  if (!entry) return null;
  const seats = pg.seats.map(s => s.id === seatId ? { ...s, flight: [...s.flight, entry], handCount: Math.max(0, s.handCount - 1) } : s);
  const game = withoutOwnCard({ ...pg, seats, waitingSeatIds: [] } as PublicView | SeatView, cardId);
  return { ...next, game };
}

/** 替换链（赤铜龙 / 术士 / 雏龙 / 诡术师）：把 events 里第 upTo 条之前的 FLIGHT_REPLACED 应用到帧上——旧牌进弃牌堆、新牌占原位。
 *  只用公共事件里的两张公开牌 id。返回新帧与本次新进场的牌 id（它们要从牌库飞入）。 */
export function applyReplacements(frame: TableView, events: readonly PublicEvent[], upTo: number): { frame: TableView; fromDeck: string[] } {
  const g = frame.game; if (!g) return { frame, fromDeck: [] };
  let seats = g.seats, discard = g.discard; const fromDeck: string[] = [];
  for (const e of events.slice(0, upTo)) {
    if (e.code !== "FLIGHT_REPLACED" || !e.cardIds || e.cardIds.length < 2) continue;
    const [old, next] = e.cardIds; const value = safeCard(next); if (!value) continue;
    let hit = false;
    seats = seats.map(s => ({ ...s, flight: s.flight.map(f => { if (f.cardId !== old) return f; hit = true; return { cardId: next, card: value }; }) }));
    if (hit) { const oldCard = safeCard(old); if (oldCard) discard = [...discard, oldCard]; fromDeck.push(next); }
  }
  if (!fromDeck.length) return { frame, fromDeck };
  return { frame: { ...frame, game: { ...g, seats, discard } as PublicView | SeatView }, fromDeck };
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
export function cardMoves(previous: TableView, next: TableView, events: readonly PublicEvent[], orientation: "landscape" | "portrait"): { ghosts: GhostCard[]; tug: { seatId: string; index: number } | null; arrived: string[] } {
  const pg = previous.game, ng = next.game; if (!pg || !ng) return { ghosts: [], tug: null, arrived: [] };
  const selfId = "selfSeatId" in ng ? (ng as SeatView).selfSeatId : null;
  const seats = seatPlacements(ng, selfId, orientation), center = CENTER[orientation];
  const placements = cardPlacements(pg, orientation);
  const handOf = (seatId: string): Pose => { const seat = seats.find(s => s.id === seatId)!; return seat.self ? handShadowPose(orientation, fanPose(0, 1, orientation)) : { x: seat.hand.x, y: seat.hand.y, rot: seat.rot, scale: 0.5, z: 30 }; };
  // 幽灵牌的落点：对手落在手牌背中心；本家落在扇面里这张新牌将要出现的位置（按先后排到扇面末端）
  const selfBefore = Math.max(0, (pg.seats.find(s => s.id === selfId)?.handCount ?? 0) - (events.some(e => e.code === "CARD_PLAYED" && e.seatId === selfId) ? 1 : 0));
  const selfTotal = Math.max(1, ng.seats.find(s => s.id === selfId)?.handCount ?? 1);
  let selfArrivals = 0; const arrivedSeats = new Set<string>();
  const handTo = (seatId: string): Pose => { arrivedSeats.add(seatId); if (seatId !== selfId) return handOf(seatId); const slot = Math.min(selfTotal - 1, selfBefore + selfArrivals++); return handShadowPose(orientation, fanPose(slot, selfTotal, orientation)); };
  const deck: Pose = { x: center.deck.x, y: center.deck.y, rot: 0, scale: 1, z: 20 }, discard: Pose = { x: center.discard.x, y: center.discard.y, rot: 4, scale: 1, z: 20 };
  const ghosts: GhostCard[] = []; let tug: { seatId: string; index: number } | null = null;
  const inflow = new Map<string, number>(), outflow = new Map<string, number>(); // 已由事件解释的进牌 / 出牌数
  const bump = (m: Map<string, number>, id: string, n = 1) => m.set(id, (m.get(id) ?? 0) + n);
  const stamp = `${ng.id}:${ng.revision}`;
  let t = 0; const push = (g: Omit<GhostCard, "delay" | "duration" | "key">, ms = 520) => { ghosts.push({ key: `${stamp}:g${ghosts.length}`, delay: t, duration: ms, ...g }); t += 110; };
  const played = events.find(e => e.code === "CARD_PLAYED" && e.seatId);
  const buy = events.find(e => e.code === "BUY_PRICE" && e.seatId);
  const purchaseKeys = new Map(events.flatMap((e, i) => e.code === "BUY_PRICE" && e.seatId ? [[e.seatId, `${stamp}:event:${i}`] as const] : []));
  for (const [i, e] of events.entries()) {
    if (e.code === "CARD_TRANSFERRED" && e.seatId && e.targetSeatId) {
      // 被偷的是最后一张牌背（它正是下一帧消失的那张）
      const victim = pg.seats.find(s => s.id === e.seatId); if (victim && e.seatId !== selfId) tug = { seatId: e.seatId, index: Math.max(0, Math.min(victim.handCount, 10) - 1) };
      push({ cardId: e.cardIds?.[0], from: handOf(e.seatId), to: handTo(e.targetSeatId), faceDown: !e.cardIds?.[0], flip: !!e.cardIds?.[0] }, 700);
      bump(inflow, e.targetSeatId); bump(outflow, e.seatId);
    } else if (e.code === "DISCARD_RECLAIMED" && e.seatId) {
      const n = Math.min(6, e.cardIds?.length ?? e.amount ?? 0);
      for (let i = 0; i < n; i++) push({ cardId: e.cardIds?.[i], from: discard, to: handTo(e.seatId), faceDown: false }, 480);
      bump(inflow, e.seatId, n);
    } else if (e.code === "BUY_PRICE" && e.cardIds?.length) {
      // 买牌的"价格牌"：牌库顶翻到弃牌堆（公开 id）
      for (const id of e.cardIds) push({ cardId: id, from: deck, to: discard, faceDown: true, flip: true, purchaseKey: `${stamp}:event:${i}` }, 480);
    }
  }
  // 前注区的牌被拿进手牌（青铜龙 / 同点牌阵奖励）
  for (const card of pg.ante) if (!ng.ante.some(c => c.id === card.id) && !ng.discard.some(c => c.id === card.id) && !ng.seats.some(s => s.flight.some(f => f.cardId === card.id))) {
    const from = placements.find(p => p.cardId === card.id)?.pose; const taker = ng.seats.find(s => s.handCount > (pg.seats.find(p => p.id === s.id)?.handCount ?? 0) + (inflow.get(s.id) ?? 0) - (outflow.get(s.id) ?? 0) - (played?.seatId === s.id ? 1 : 0));
    if (from && taker) { push({ cardId: card.id, from, to: handTo(taker.id), faceDown: false }, 560); bump(inflow, taker.id); }
  }
  // 弃牌堆的增加里，被替换 / 被屠龙者弃掉 / 翻注全并列 / 结算收牌的都不是"弃手牌"；价格牌已单独解释
  const priceCount = events.filter(e => e.code === "BUY_PRICE").reduce((n, e) => n + (e.cardIds?.length ?? 0), 0);
  const unexplained = !events.some(e => e.code === "FLIGHT_REPLACED" || e.code === "DRAGON_REMOVED" || e.code === "ANTE_ALL_TIED" || e.code === "GAMBIT_SCORED");
  const discardDelta = unexplained ? Math.max(0, ng.discard.length - pg.discard.length - priceCount) : 0;
  const deckDelta = Math.max(0, pg.deckCount - ng.deckCount - priceCount);
  let drawn = 0;
  for (const s of ng.seats) {
    const before = pg.seats.find(p => p.id === s.id)?.handCount ?? 0;
    // 打出的那张不是"弃牌"，也不抵消抽牌；被偷走 / 交出的那张已由幽灵牌解释
    const delta = s.handCount - before + (played?.seatId === s.id ? 1 : 0) + (outflow.get(s.id) ?? 0) - (inflow.get(s.id) ?? 0);
    if (delta < 0 && discardDelta > 0) for (let i = 0; i < Math.min(4, -delta, discardDelta); i++) push({ from: handOf(s.id), to: discard, faceDown: s.id !== selfId }, 460);
    for (let i = 0; i < Math.min(6, delta); i++) push({ from: deck, to: handTo(s.id), faceDown: true, purchaseKey: purchaseKeys.get(s.id) }, 520);
    drawn += Math.max(0, delta);
  }
  // 手牌数不变却既抽了牌又弃了牌（狗头人"弃 N 抽 N"、买牌后弃到上限）：牌库多出的减少量 = 这家先弃后抽的张数，归到买牌 / 刚做选择的那家
  const extra = Math.min(deckDelta - drawn, discardDelta);
  const who = buy?.seatId ?? pg.choice?.seatId ?? null;
  if (extra > 0 && who) {
    for (let i = 0; i < Math.min(4, extra); i++) push({ from: handOf(who), to: discard, faceDown: who !== selfId }, 460);
    for (let i = 0; i < Math.min(4, extra); i++) push({ from: deck, to: handTo(who), faceDown: true, purchaseKey: purchaseKeys.get(who) }, 520);
  }
  const arrived = [...arrivedSeats];
  return { ghosts, tug, arrived };
}

type GoldHold = { seats: Record<string, number>; stakes: number; hole: number };
const goldOf = (view: TableView | null): GoldHold | null => { const g = view?.game; return g ? { seats: Object.fromEntries(g.seats.map(s => [s.id, s.gold])), stakes: g.stakes, hole: g.hole } : null; };

/** 同帧还有购买时，先保留购买前的手牌与牌堆。只遮住已收到的新牌，不造牌或推断对手牌面。 */
export function purchaseHoldFrame(previous: TableView, next: TableView, events: readonly PublicEvent[], orientation: "landscape" | "portrait"): TableView {
  const pg = previous.game, ng = next.game;
  const buys = events.filter(event => event.code === "BUY_PRICE");
  if (!pg || !ng || !buys.length) return next;
  const moves = cardMoves(previous, next, events, orientation);
  const counts = new Map(buys.flatMap(event => {
    if (!event.seatId) return [];
    const key = `${ng.id}:${ng.revision}:event:${events.indexOf(event)}`;
    return [[event.seatId, moves.ghosts.filter(ghost => ghost.purchaseKey === key && !ghost.cardId).length] as const];
  }));
  const priceIds = new Set(buys.flatMap(event => event.cardIds ?? []));
  const own = "selfSeatId" in ng && "hand" in ng ? ng as SeatView : null;
  const previousOwn = "hand" in pg ? pg as SeatView : null;
  const keptHand = own && counts.has(own.selfSeatId) ? own.hand.filter(value => previousOwn?.hand.some(old => old.id === value.id)) : own?.hand;
  const omniscient = "omniscient" in ng && ng.omniscient === true ? ng as OmniscientView : null;
  const previousOmniscient = "omniscient" in pg && pg.omniscient === true ? pg as OmniscientView : null;
  // 已授权的全能画面同样等补牌飞到后才显示新牌；普通投影绝不新增全能字段。
  const keptHands = omniscient ? Object.fromEntries(Object.entries(omniscient.privateHands).map(([seatId, hand]) => [seatId, counts.has(seatId) ? hand.filter(value => previousOmniscient?.privateHands[seatId]?.some(old => old.id === value.id)) : hand])) : null;
  const seats = ng.seats.map(seat => ({ ...seat, handCount: keptHands && counts.has(seat.id) ? keptHands[seat.id]?.length ?? 0 : seat.id === own?.selfSeatId && keptHand ? keptHand.length : Math.max(0, seat.handCount - (counts.get(seat.id) ?? 0)) }));
  const game = { ...ng, seats, deckCount: pg.deckCount, discard: ng.discard.filter(value => !priceIds.has(value.id)), ...(own && keptHand ? { hand: keptHand, actions: [], handPowerHints: own.handPowerHints.filter(hint => keptHand.some(value => value.id === hint.cardId)) } : {}), ...(keptHands ? { privateHands: keptHands } : {}) } as PublicView | SeatView;
  return { ...next, game };
}

export function createPresenter(store: Store, controller: Controller, hooks: PresenterHooks) {
  const queue: QueueItem[] = [];
  let running = false, destroyed = false, generation = 0;
  let powerHoldGameId: string | null = null, powerHoldFx: FxLayer | null = null, powerHoldKey: string | null = null;
  // 0×0 的锚点（奖池 / 偿债池的金币锚点）也是合法终点：没有宽高就用它的位置
  const centerOf = (selector: string): Point | null => { const el = hooks.root().querySelector(selector) as HTMLElement | null; if (!el || typeof el.getBoundingClientRect !== "function") return null; const r = el.getBoundingClientRect(); if (!r.width && !r.height && !r.left && !r.top) return null; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const rectOf = (selector: string): Rect | null => { const el = hooks.root().querySelector(selector) as HTMLElement | null; if (!el || typeof el.getBoundingClientRect !== "function") return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; };
  const esc = (value: string) => typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
  const cardPoint = (cardId: string) => centerOf(`[data-card="${esc(cardId)}"]`);
  const seatCoins = (seatId: string) => centerOf(`[data-coins-seat="${esc(seatId)}"]`);
  const pile = (id: string) => centerOf(`[data-pile="${id}"]`);
  const endpoint = (id: string) => id === "stakes" || id === "hole" ? pile(id) : seatCoins(id);
  /** 一家手牌（匿名牌背或本家扇面）的总包围盒 */
  const handRect = (seatId: string): Rect | null => {
    const root = hooks.root(); const all = root.querySelectorAll ? Array.from(root.querySelectorAll(`[data-zone="hand"][data-seat="${esc(seatId)}"]`)) as HTMLElement[] : [];
    const rects = all.filter(el => typeof el.getBoundingClientRect === "function").map(el => el.getBoundingClientRect()).filter(r => r.width);
    if (!rects.length) return null;
    const x = Math.min(...rects.map(r => r.left)), y = Math.min(...rects.map(r => r.top));
    return { x, y, w: Math.max(...rects.map(r => r.right)) - x, h: Math.max(...rects.map(r => r.bottom)) - y };
  };
  const handPoint = (seatId: string): Point | null => {
    const root = hooks.root(); const all = root.querySelectorAll ? Array.from(root.querySelectorAll(`[data-zone="hand"][data-seat="${esc(seatId)}"]`)) : [];
    const el = all[Math.floor(all.length / 2)] as HTMLElement | undefined; if (!el || typeof el.getBoundingClientRect !== "function") return null;
    const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  const releasePowerHold = () => {
    if (powerHoldFx && powerHoldKey) powerHoldFx.ambient(powerHoldKey, null);
    powerHoldFx = null; powerHoldKey = null;
  };
  const emitPowerHold = (view: TableView, hold: NonNullable<ReturnType<typeof emptyShow>["powerHold"]>) => {
    const fx = hooks.fx(); if (!fx) return;
    const key = `hold:${hold.choiceId}`;
    releasePowerHold();
    const rect = handRect(hold.seatId), choice = view.game!.choice!;
    const selfSeat = view.game && "selfSeatId" in view.game ? (view.game as SeatView).selfSeatId : null;
    powerHoldFx = fx; powerHoldKey = key;
    fx.ambient(key, { kind: familyFx(hold.cue.family), rate: 3, area: rect ? { x: rect.x - 16, y: rect.y - 16, w: rect.w + 32, h: rect.h + 32 } : null, drift: { x: 0, y: -22 }, size: 2.4, life: 2, alpha: 0.75,
      hold: { who: choice.seatId === selfSeat ? "self" : "other", code: choice.code, from: cardPoint(hold.cue.cardId) ?? undefined } });
  };
  const beat = (ms = BEAT_MS) => wait(ms);
  const show = (patch: Partial<ReturnType<typeof emptyShow>>) => store.set(s => ({ show: { ...s.show, ...patch } }));
  /** 场景帧（卡牌、金币）。流程轨 / 等待行读的是 flow 帧，只在演出结束后更新。 */
  // 同 revision 的 ack / 身份更新只换宿主字段，不能把落地帧、结算帧或队列换成完整新投影。
  const latestEnvelope = (view: TableView): TableView => {
    const latest = store.get().view;
    return latest !== view && latest?.game && view.game && latest.game.id === view.game.id && latest.game.revision === view.game.revision ? { ...latest, game: view.game } : view;
  };
  const display = (view: TableView) => store.set({ display: latestEnvelope(view) });
  const commitFlow = (view: TableView) => store.set({ flow: latestEnvelope(view) });
  // 金币数字冻结在上一帧，每段弧线落地后再把这一笔记进去，直到演出结束才解除冻结
  const holdGold = (view: TableView | null) => { if (!store.get().goldHold) store.set({ goldHold: goldOf(view) }); };
  const releaseGold = () => store.set({ goldHold: null });
  const bookFlow = (from: string, to: string, amount: number) => store.set(s => { const h = s.goldHold; if (!h) return {}; const next = { seats: { ...h.seats }, stakes: h.stakes, hole: h.hole }; const sub = (id: string, n: number) => { if (id === "stakes") next.stakes = Math.max(0, next.stakes - n); else if (id === "hole") next.hole = Math.max(0, next.hole - n); else if (id in next.seats) next.seats[id] = Math.max(0, next.seats[id] - n); }; const add = (id: string, n: number) => { if (id === "stakes") next.stakes += n; else if (id === "hole") next.hole += n; else if (id in next.seats) next.seats[id] += n; }; sub(from, amount); add(to, amount); return { goldHold: next }; });
  function setBusy(value: boolean) { if (store.get().busy !== value) { store.set({ busy: value }); hooks.onBusy(value); } }
  const flight = (from: Point | null, to: Point | null, amount: number, duration: number) => { const fx = hooks.fx(); if (!from || !to || !fx) return wait(duration); return Promise.race([fx.coins(from, to, Math.min(8, Math.max(1, Math.ceil(amount / 2))), duration), wait(duration + 8 * 70 + 400)]); };
  const seatIds = () => store.get().view?.game?.seats.map(s => s.id) ?? [];
  const fxContext = (): PowerFxContext | null => { const fx = hooks.fx(); if (!fx) return null; return { fx, cardPoint, seatPoint: id => centerOf(`[data-seat-plate="${esc(id)}"]`), seatRect: id => handRect(id), coinsPoint: seatCoins, handPoint, pile: id => pile(id), seatIds: seatIds(), sound: hooks.sound }; };

  async function goldArcs(flows: readonly PublicGoldFlow[], gen: number) {
    // 每段金币弧之间都查代际：清场后剩下的弧不再播，也不再出声。付款方的区域先亮一下（被收钱的人也有反馈）。
    for (const flow of flows) {
      if (gen !== generation) return;
      const payer = flow.fromSeatId !== "stakes" && flow.fromSeatId !== "hole" ? seatCoins(flow.fromSeatId) : null;
      if (payer) { hooks.fx()?.burst(payer, "gold", 0.7); hooks.sound("pay", flow.key + ":pay"); await beat(160); if (gen !== generation) return; }
      hooks.sound("coin", flow.key); await flight(endpoint(flow.fromSeatId), endpoint(flow.toSeatId), flow.amount, 620); if (gen !== generation) return; bookFlow(flow.fromSeatId, flow.toSeatId, flow.amount);
    }
  }
  /** 卡牌转移动画：先让被偷的牌背前伸抖动，再放幽灵牌一张张飞；全部落地后才显示新帧。
   *  没有幽灵牌时**同步返回**（不让出事件循环）：否则待确认的牌会在中间帧回到手牌再飞一次。
   *  接收方的新节点在下一帧直接到位（arrived），不再播自己的进场动画。 */
  function transfers(previous: TableView, view: TableView, events: readonly PublicEvent[], gen: number): Promise<void> | null {
    const moves = cardMoves(previous, view, events, store.get().orientation);
    const ghosts = moves.ghosts.filter(ghost => !ghost.purchaseKey), tug = moves.tug;
    const purchaseSeats = new Set(events.filter(event => event.code === "BUY_PRICE").map(event => event.seatId));
    const arrived = moves.arrived.filter(seatId => !purchaseSeats.has(seatId));
    if (!ghosts.length) return null;
    return (async () => {
      const wasBusy = store.get().busy; setBusy(true);
      if (tug) { show({ tug }); hooks.sound("draw", `${view.game?.id}:${view.game?.revision}:tug`); await beat(620); if (gen !== generation) return; show({ tug: null }); }
      show({ ghosts, arrived: [...new Set([...store.get().show.arrived, ...arrived])] }); for (const g of ghosts) hooks.sound("draw", `${view.game?.id}:${view.game?.revision}:${g.key}`);
      const total = Math.max(...ghosts.map(g => g.delay + g.duration)) + 60;
      await beat(total); if (gen !== generation) return;
      show({ ghosts: [] });
      if (!wasBusy) setBusy(false);
    })();
  }
  /** 刚到位的新节点显示完一帧后，解除"免进场"标记 */
  async function settleArrivals(gen: number) { if (!store.get().show.arrived.length) return; await beat(80); if (gen !== generation) return; show({ arrived: [] }); }

  async function runReveal(item: QueueItem, gen: number) {
    const reveal = item.pres.reveal!;
    const frame = revealFrame(purchaseHoldFrame(item.previous, item.view, item.events, store.get().orientation), reveal), game = frame.game!;
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
    if (frame !== item.view) display(purchaseHoldFrame(item.previous, item.view, item.events, store.get().orientation));
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

  /** 公开购买逐家演：说明先出现，之后翻价牌、付款、补牌。补牌始终为匿名牌背。 */
  async function purchase(item: QueueItem, cue: Extract<RoundCue, { kind: "purchase" }>, gen: number) {
    holdGold(item.previous);
    const moves = cardMoves(item.previous, item.view, item.events, store.get().orientation);
    await banner(cue, gen); if (gen !== generation) return;
    const ghosts = moves.ghosts.filter(ghost => ghost.purchaseKey === cue.key);
    const prices = ghosts.filter(ghost => !!ghost.cardId), draws = ghosts.filter(ghost => !ghost.cardId);
    const fly = async (cards: GhostCard[]) => {
      if (!cards.length) return;
      // 原转移队列的全局延迟不能让下一家购买等待上一家的重复空档。
      const rebased = cards.map((ghost, i) => ({ ...ghost, delay: i * 110 }));
      show({ ghosts: rebased });
      for (const ghost of rebased) hooks.sound(ghost.flip ? "flip" : "draw", ghost.key);
      await beat(Math.max(...rebased.map(ghost => ghost.delay + ghost.duration)) + 60);
      if (gen === generation) show({ ghosts: [] });
    };
    await fly(prices); if (gen !== generation) return;
    await goldArcs(cue.flows, gen); if (gen !== generation) return;
    if (draws.length) show({ arrived: [...new Set([...store.get().show.arrived, cue.seatId])] });
    await fly(draws); if (gen !== generation) return;
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
          powerHoldGameId = null; releasePowerHold();
          const p = handPoint(hold.seatId) ?? centerOf(`[data-seat-plate="${esc(hold.seatId)}"]`);
          if (p) { hooks.sound("power-impact", `${hold.choiceId}:close`); hooks.fx()?.burst(p, familyFx(hold.cue.family), 1); await beat(420); if (gen !== generation) return; }
          show({ powerHold: null });
        }
        const hasShow = !!(pres.reveal || pres.powers.length || pres.rounds.length || pres.gold.length || pres.goldAfterScore.length || pres.formations.length);
        setBusy(hasShow);
        const scoreCue = pres.rounds.find((c): c is Extract<RoundCue, { kind: "score" }> => c.kind === "score");
        // 结算帧：末牌与结算同帧时，整段演出（落牌、能力、特殊牌阵、拼点、计分板）都在合成帧上做
        const settlement = scoreCue ? settlementFrame(previous, view, events, scoreCue.report) : null;
        const beforePurchases = purchaseHoldFrame(previous, view, events, store.get().orientation);
        const shown = settlement ?? beforePurchases;
        if (pres.reveal) { await runReveal(item, gen); if (gen !== generation) return; }
        else if (pres.powers.length) {
          // 第一步：只落牌（抽出 → 落下 → 尘土）。第二步：停一拍、聚焦。第三步：说明。第四步：能力特效与金币。
          const landing = settlement ?? landingFrame(previous, view, events);
          holdGold(previous);
          display(landing ?? view);
          await beat(SETTLE_MS); if (gen !== generation) return;
          const first = pres.powers[0];
          if (isLegendary(first.cardId)) { const p = cardPoint(first.cardId); if (p) { hooks.sound("sigil", first.key + ":presence"); void hooks.fx()?.sigil(p, familyFx(first.family), 150, 1500); await beat(700); if (gen !== generation) return; } }
          let shownFrame = landing ?? view;
          for (const [i, cue] of pres.powers.entries()) {
            // 替换链：这个能力之前发生的替换先落到桌上（旧牌进弃牌堆、新牌从牌库飞入落下），再聚焦、说明
            if (i > 0 && landing) {
              const cueIndex = Number(/:(\d+)$/.exec(cue.key)?.[1] ?? -1);
              const replaced = applyReplacements(landing, events, cueIndex < 0 ? events.length : cueIndex);
              if (replaced.fromDeck.length && replaced.frame !== shownFrame) {
                show({ fromDeck: replaced.fromDeck }); display(replaced.frame); shownFrame = replaced.frame;
                hooks.sound("draw", `${cue.key}:replace`);
                await beat(SETTLE_MS); if (gen !== generation) return;
                show({ fromDeck: [] });
              }
            }
            // 每个能力（含连锁、替换上来的牌）都先聚焦再说明
            show({ focusCardId: cue.cardId });
            await beat(i === 0 ? FOCUS_MS : 320); if (gen !== generation) return;
            await spotlight(cue); if (gen !== generation) return;
            show({ focusCardId: null });
            const ctx = fxContext();
            if (ctx) { await powerScript(cue, powerSegment(events, cue), ctx); } else await beat(200);
            if (gen !== generation) return;
            // 卡牌转移（抽 / 偷 / 取前注）在特效之后、显示新帧之前，一张一张飞
            if (i === pres.powers.length - 1) { const moving = transfers(previous, view, events, gen); if (moving) { await moving; if (gen !== generation) return; } }
            if (i === pres.powers.length - 1 && landing && !settlement) { display(beforePurchases); await settleArrivals(gen); if (gen !== generation) return; }
            hooks.sound("power-impact", cue.key);
            await beat(260); if (gen !== generation) return;
            // 能力需要某家选择：特效停在该家区域（持续粒子 + 标记），释放 busy 让面板出现；选择结算后在下一帧播收尾
            const choice = view.game?.choice;
            if (choice && (choice.sourceCardId === cue.cardId || view.game?.resolutionStack.some(step => step.status === "active" && step.sourceCardId === cue.cardId))) {
              const hold = { cue, seatId: choice.seatId, choiceId: choice.id };
              powerHoldGameId = view.game!.id; show({ powerHold: hold });
              emitPowerHold(view, hold);
            }
          }
          await goldArcs(pres.gold, gen); if (gen !== generation) return;
          await beat(); if (gen !== generation) return;
          show({ resolvingSeatId: null });
        } else if (pres.gold.length) {
          holdGold(previous);
          // 有幽灵牌时也不能让待确认的牌回到手牌：先同步显示落地帧（上一帧 + 刚打出的牌），再等幽灵牌飞完
          const moving = transfers(previous, shown, events, gen); if (moving) { const landing = landingFrame(previous, shown, events); if (landing) display(landing); await moving; if (gen !== generation) return; }
          display(shown); await settleArrivals(gen); if (gen !== generation) return;
          // 只有金币流、没有出牌的帧（例如选完"付 5 金"）不必等落牌那么久
          await beat(played ? SETTLE_MS : BEAT_MS); if (gen !== generation) return;
          await goldArcs(pres.gold, gen); if (gen !== generation) return; await beat(); if (gen !== generation) return;
        } else {
          // 没有幽灵牌时 display 必须同步发生（不能先 await）：否则待确认的牌会在中间帧回到手牌再飞一次
          // 有幽灵牌时也不能让待确认的牌回到手牌：先同步显示落地帧（上一帧 + 刚打出的牌），再等幽灵牌飞完
          const moving = transfers(previous, shown, events, gen); if (moving) { const landing = landingFrame(previous, shown, events); if (landing) display(landing); await moving; if (gen !== generation) return; }
          display(shown); await settleArrivals(gen); if (gen !== generation) return;
          if (played && (pres.rounds.length || pres.formations.length)) { await beat(SETTLE_MS); if (gen !== generation) return; }
        }
        for (const cue of pres.formations) {
          holdGold(previous);
          const p = cue.cardIds.map(cardPoint).find(Boolean);
          if (p) { hooks.sound("sigil", cue.key + ":sigil"); void hooks.fx()?.sigil(p, cue.kind === "strength" ? "tide" : cue.kind === "mortal" ? "arcane" : "crown", 170, 1600); await beat(500); if (gen !== generation) return; }
          await formation(cue); if (gen !== generation) return;
          await goldArcs(cue.flows, gen); if (gen !== generation) return;
          await beat(); if (gen !== generation) return;
        }
        for (const cue of pres.rounds) {
          if (cue.kind === "purchase") { await purchase(item, cue, gen); }
          else if (cue.kind === "score") {
            holdGold(previous); await beat(SETTLE_MS); if (gen !== generation) return;
            await scoreboard(cue, gen); if (gen !== generation) return;
            // 发完奖池才切到结算后的投影，再播结算后的金币（偿债、君王付款、终局取偿债池）
            if (settlement) display(beforePurchases);
            await goldArcs(pres.goldAfterScore, gen); if (gen !== generation) return;
          } else await banner(cue, gen);
          if (gen !== generation) return;
        }
        if (!scoreCue && pres.goldAfterScore.length) { await goldArcs(pres.goldAfterScore, gen); if (gen !== generation) return; }
        if (store.get().display !== view) display(view);
        if (store.get().show.arrived.length) { await settleArrivals(gen); if (gen !== generation) return; }
        releaseGold();
        if (hasShow) { await beat(); if (gen !== generation) return; }
        // 阶段标签、等待行只在整个演出结束后才换到新帧。
        commitFlow(view);
      }
    } finally { if (gen === generation) { running = false; releaseGold(); setBusy(false); } }
  }

  return {
    /** 新 FX owner 只接回仍有效的驻留能力，不重播演出队列或声音。 */
    restorePowerHold() {
      const state = store.get(), hold = state.show.powerHold, view = state.view, game = view?.game, displayed = state.display?.game;
      const matches = (value: PublicView) => { const choice = value.choice; return !!choice && !!hold && choice.id === hold.choiceId && choice.seatId === hold.seatId && (choice.sourceCardId === hold.cue.cardId || value.resolutionStack.some(step => step.status === "active" && step.sourceCardId === hold.cue.cardId)); };
      if (destroyed || state.suspended || !view?.connected || !hold || !game || !displayed || game.id !== powerHoldGameId || displayed.id !== powerHoldGameId || !matches(game) || !matches(displayed)) { releasePowerHold(); return; }
      if (powerHoldFx === hooks.fx() && powerHoldKey === `hold:${hold.choiceId}`) return;
      emitPowerHold(view, hold);
    },
    /** 相邻、同一局、在线的投影走演出队列；其他一律直接替换画面。 */
    update(next: TableView, previous: TableView | null, live: boolean) {
      const prevGame = previous?.game ?? null, nextGame = next.game;
      const sameRevision = live && !!prevGame && !!nextGame && prevGame.id === nextGame.id && prevGame.revision === nextGame.revision;
      const scope = (game: PublicView | SeatView | null) => game && "omniscient" in game && game.omniscient === true ? "omniscient" : game && "selfSeatId" in game ? "seat" : "public";
      const sameViewer = prevGame && nextGame && previous?.selfPlayerId === next.selfPlayerId && previous.table?.id === next.table?.id && ("selfSeatId" in prevGame ? prevGame.selfSeatId : null) === ("selfSeatId" in nextGame ? nextGame.selfSeatId : null) && scope(prevGame) === scope(nextGame);
      if (prevGame && (!nextGame || !sameViewer)) {
        // 私牌访问范围或座位改变时，旧私牌帧与检查器立即失效，不能等当前演出结束。
        this.clear(next, true);
        return;
      }
      if (sameRevision && sameViewer) {
        // 提交者会收到 view → ack 两次 update；ack 仍由挂载层精确匹配并清除 pending。
        // 身份和权限立即更新，但不重播，也不取消尚在演出的公开事件。
        store.set(s => ({ display: s.display ? { ...next, game: s.display.game } : next, flow: s.flow ? { ...next, game: s.flow.game } : next }));
        return;
      }
      const adjacent = live && !!previous && !!prevGame && !!nextGame && prevGame.id === nextGame.id && nextGame.revision === prevGame.revision + 1;
      if (!adjacent) { this.clear(next); return; }
      const pres = derivePresentation(prevGame, nextGame);
      const events = freshPublicEvents(prevGame, nextGame), key = `${nextGame.id}:${nextGame.revision}`;
      if (events.some(e => e.code === "DECK_RESHUFFLED")) hooks.sound("shuffle", key);
      queue.push({ view: next, previous: previous!, pres, events });
      void pump();
    },
    clear(next?: TableView, scopeChanged = false) {
      generation++; queue.length = 0; running = false;
      powerHoldGameId = null; releasePowerHold();
      store.set(s => ({ show: emptyShow(), goldHold: null, flow: next ?? s.display, ...(next ? { display: next } : {}), ...(scopeChanged ? { inspect: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null } : {}) }));
      setBusy(false); controller.dismissPower();
    },
    destroy() { destroyed = true; this.clear(); },
  };
}
