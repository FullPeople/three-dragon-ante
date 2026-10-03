/** 演出调度：投影按序进入画面；翻注、落牌、聚焦、能力说明、能力特效、金币流转、特殊牌阵说明、拼点、计分板严格串行。
 * 规格见 AI_CONTEXT/GOAL.md §4.3：出牌落地（抽出 → 加速落下 → 尘土）→ 停一拍 → 聚焦 → 能力说明（玩家关闭）→ 能力特效与金币 → 停一拍；
 * 轮局结束：特殊牌阵说明（玩家关闭）→ 桌面拼点（数字浮现 → 最高亮 / 并列划掉）→ 计分板 → 发奖池 → 阶段标签才变。
 * 这里永远不改规则状态，只决定"什么时候把哪一帧给场景看"。减少动态偏好下动画瞬移，但顺序与等待时长不变。 */
import type { TableView } from "../../game/protocol";
import type { PublicEvent, PublicView, ScoreReport, SeatView } from "../../game/rules/types";
import { card } from "../../game/rules/cards";
import { derivePresentation, freshPublicEvents, type FormationCue, type Presentation, type PublicGoldFlow, type PowerCue, type RoundCue } from "../model/cues";
import { wait } from "../fx/motion";
import type { FxLayer, Point, Rect } from "../fx/particles";
import { familyFx, isLegendary, powerScript, type PowerFxContext } from "../fx/powers";
import { emptyShow, type Store, type TallyItem } from "./store";
import type { Controller } from "./controller";

export { familyFx };
export const BEAT_MS = 300, SETTLE_MS = 640, FOCUS_MS = 420, PLACE_MS = 250, FLIP_MS = 360, PRICE_MS = 640, PAY_MS = 470, TALLY_MS = 700, MARK_MS = 1000;

export interface PresenterHooks { fx(): FxLayer | null; root(): { querySelector(selector: string): Element | null; querySelectorAll?(selector: string): ArrayLike<Element> }; onBusy(busy: boolean): void; sound(kind: string, key: string): void }

interface QueueItem { view: TableView; previous: TableView; pres: Presentation; events: PublicEvent[] }

/** 落地帧：上一帧 + 刚打出的那张牌放进牌阵。其余效果（偷牌、抽牌、金币）留到说明关闭后。
 *  只用公共事件里已公开的牌 id 与下一帧的公开牌阵条目，不碰任何私牌。 */
export function landingFrame(previous: TableView, next: TableView, events: PublicEvent[]): TableView | null {
  const pg = previous.game, ng = next.game; if (!pg || !ng) return null;
  const played = events.find(e => e.code === "CARD_PLAYED" && e.seatId && e.cardIds?.[0]);
  if (!played) return null;
  const seatId = played.seatId!, cardId = played.cardIds![0];
  const entry = ng.seats.find(s => s.id === seatId)?.flight.find(f => f.cardId === cardId);
  if (!entry || pg.seats.some(s => s.flight.some(f => f.cardId === cardId))) return null;
  const seats = pg.seats.map(s => s.id === seatId ? { ...s, flight: [...s.flight, entry], handCount: Math.max(0, s.handCount - 1) } : s);
  const game = { ...pg, seats, waitingSeatIds: [] } as PublicView | SeatView;
  if ("selfSeatId" in pg) { const own = pg as SeatView; Object.assign(game, { hand: own.hand.filter(c => c.id !== cardId), actions: [], handPowerHints: own.handPowerHints.filter(h => h.cardId !== cardId) }); }
  return { ...next, game };
}

/** 翻注拼点：每张前注牌一个数字；领出者的牌打"领出"，点数重复的打"并列"（全并列时全部划掉）。 */
export function revealTally(game: PublicView, cardIds: readonly string[], allTied: boolean): TallyItem[] {
  const origins = new Map((game.anteOrigins ?? []).map(o => [o.cardId, o.seatId]));
  const strengths = new Map(cardIds.map(id => { try { return [id, card(id).strength] as const; } catch { return [id, 0] as const; } }));
  const counts = new Map<number, number>(); for (const v of strengths.values()) counts.set(v, (counts.get(v) ?? 0) + 1);
  const leaderCard = [...origins].find(([, seatId]) => seatId === game.leaderSeatId)?.[0];
  return cardIds.map(cardId => { const value = strengths.get(cardId) ?? 0; const mark: TallyItem["mark"] = allTied ? "tied" : cardId === leaderCard ? "lead" : (counts.get(value) ?? 0) > 1 ? "tied" : "none"; return { seatId: origins.get(cardId) ?? "", cardId, value, mark }; });
}

/** 轮局拼点：每家总点数；胜者打"胜"，多人并列打"并列"，龙神限制打"不能获胜"。 */
export function scoreTally(report: ScoreReport): TallyItem[] {
  return report.rows.map(row => ({ seatId: row.seatId, value: row.total, mark: !row.eligible ? "out" : report.winners.includes(row.seatId) ? (report.winners.length > 1 ? "tied" : "win") : "none" }));
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
  const bookFlow = (from: string, to: string, amount: number) => store.set(s => { const h = s.goldHold; if (!h) return {}; const next = { seats: { ...h.seats }, stakes: h.stakes, hole: h.hole }; const sub = (id: string, n: number) => { if (id === "stakes") next.stakes = Math.max(0, next.stakes - n); else if (id === "hole") next.hole = Math.max(0, next.hole - n); else if (id in next.seats) next.seats[id] -= n; }; const add = (id: string, n: number) => { if (id === "stakes") next.stakes += n; else if (id === "hole") next.hole += n; else if (id in next.seats) next.seats[id] += n; }; sub(from, amount); add(to, amount); return { goldHold: next }; });
  function setBusy(value: boolean) { if (store.get().busy !== value) { store.set({ busy: value }); hooks.onBusy(value); } }
  const flight = (from: Point | null, to: Point | null, amount: number, duration: number) => new Promise<void>(resolve => { const fx = hooks.fx(); if (!from || !to || !fx) return void setTimeout(resolve, duration); fx.arc(from, to, Math.min(5, Math.max(1, Math.ceil(amount / 3))), resolve, duration); setTimeout(resolve, duration + 300); });
  const seatIds = () => store.get().view?.game?.seats.map(s => s.id) ?? [];
  const fxContext = (): PowerFxContext | null => { const fx = hooks.fx(); if (!fx) return null; return { fx, cardPoint, seatPoint: id => centerOf(`[data-seat-plate="${esc(id)}"]`), seatRect: id => rectOf(`[data-drop-zone="flight"][data-drop-seat="${esc(id)}"]`), coinsPoint: seatCoins, handPoint, pile: id => pile(id), seatIds: seatIds(), sound: hooks.sound }; };

  async function goldArcs(flows: readonly PublicGoldFlow[], gen: number) {
    // 每段金币弧之间都查代际：清场后剩下的弧不再播，也不再出声。
    for (const flow of flows) { if (gen !== generation) return; hooks.sound("coin", flow.key); await flight(endpoint(flow.fromSeatId), endpoint(flow.toSeatId), flow.amount, 620); if (gen !== generation) return; bookFlow(flow.fromSeatId, flow.toSeatId, flow.amount); }
  }

  async function runReveal(item: QueueItem, gen: number) {
    const reveal = item.pres.reveal!, game = item.view.game!;
    const strengths = reveal.cardIds.map(id => { try { return card(id).strength; } catch { return 0; } });
    const top = Math.max(...strengths), topIds = reveal.cardIds.filter((id, i) => strengths[i] === top);
    holdGold(item.previous);
    show({ reveal, revealPhase: "placing", revealTopIds: [] }); display(item.view);
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
        const hasShow = !!(pres.reveal || pres.powers.length || pres.rounds.length || pres.gold.length || pres.formations.length);
        setBusy(hasShow);
        if (pres.reveal) { await runReveal(item, gen); if (gen !== generation) return; }
        else if (pres.powers.length) {
          // 第一步：只落牌（抽出 → 落下 → 尘土）。第二步：停一拍、聚焦。第三步：说明。第四步：能力特效与金币。
          const landing = landingFrame(previous, view, events);
          holdGold(previous);
          display(landing ?? view);
          await beat(SETTLE_MS); if (gen !== generation) return;
          const first = pres.powers[0];
          if (isLegendary(first.cardId)) { const p = cardPoint(first.cardId); if (p) { hooks.sound("sigil", first.key + ":presence"); void hooks.fx()?.sigil(p, familyFx(first.family), 150, 1500); await beat(700); if (gen !== generation) return; } }
          show({ focusCardId: first.cardId });
          await beat(FOCUS_MS); if (gen !== generation) return;
          for (const [i, cue] of pres.powers.entries()) {
            await spotlight(cue); if (gen !== generation) return;
            if (i === 0 && landing) display(view);
            show({ focusCardId: null });
            const ctx = fxContext();
            if (ctx) { await powerScript(cue, events, ctx); } else await beat(200);
            if (gen !== generation) return;
            hooks.sound("power-impact", cue.key);
            await beat(260); if (gen !== generation) return;
          }
          await goldArcs(pres.gold, gen); if (gen !== generation) return;
          await beat(); if (gen !== generation) return;
          show({ resolvingSeatId: null });
        } else if (pres.gold.length) { holdGold(previous); display(view); await beat(SETTLE_MS); if (gen !== generation) return; await goldArcs(pres.gold, gen); if (gen !== generation) return; await beat(); if (gen !== generation) return; }
        else { display(view); if (played && (pres.rounds.length || pres.formations.length)) { await beat(SETTLE_MS); if (gen !== generation) return; } }
        for (const cue of pres.formations) {
          holdGold(previous);
          const p = cue.cardIds.map(cardPoint).find(Boolean);
          if (p) { hooks.sound("sigil", cue.key + ":sigil"); void hooks.fx()?.sigil(p, cue.kind === "strength" ? "tide" : cue.kind === "mortal" ? "arcane" : "crown", 170, 1600); await beat(500); if (gen !== generation) return; }
          await formation(cue); if (gen !== generation) return;
          await goldArcs(cue.flows, gen); if (gen !== generation) return;
          await beat(); if (gen !== generation) return;
        }
        for (const cue of pres.rounds) {
          if (cue.kind === "score") { holdGold(previous); await beat(SETTLE_MS); if (gen !== generation) return; await scoreboard(cue, gen); } else await banner(cue, gen);
          if (gen !== generation) return;
        }
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
      if (nextGame.deckCount < prevGame.deckCount || events.some(e => e.code === "DECK_RESHUFFLED")) hooks.sound("draw", key);
      queue.push({ view: next, previous: previous!, pres, events });
      void pump();
    },
    clear() { generation++; queue.length = 0; running = false; store.set(s => ({ show: emptyShow(), goldHold: null, flow: s.display })); setBusy(false); controller.dismissPower(); },
    destroy() { destroyed = true; this.clear(); },
  };
}
