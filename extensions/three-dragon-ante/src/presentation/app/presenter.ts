/** 演出调度：投影按序进入画面；翻注、能力说明、金币流转、横幅、计分板严格串行。
 * 规格见 AI_CONTEXT/GOAL.md §4.3：出牌落地 → 停一拍 → 能力说明（玩家关闭）→ 卡牌效果与金币 → 停一拍 → 阶段变更。
 * 这里永远不改规则状态，只决定"什么时候把哪一帧给场景看"。减少动态偏好下动画瞬移，但顺序与等待时长不变。 */
import type { TableView } from "../../game/protocol";
import type { PublicEvent, PublicView, SeatView } from "../../game/rules/types";
import { card } from "../../game/rules/cards";
import { derivePresentation, freshPublicEvents, type Presentation, type PublicGoldFlow, type PowerCue, type RoundCue } from "../model/cues";
import { wait } from "../fx/motion";
import type { FxLayer, FxKind } from "../fx/particles";
import { emptyShow, type Store } from "./store";
import type { Controller } from "./controller";

export const BEAT_MS = 300, SETTLE_MS = 520, PLACE_MS = 250, FLIP_MS = 360, PRICE_MS = 640, PAY_MS = 470;
const FAMILY_FX: Record<string, FxKind> = {
  black: "ember", red: "ember", thief: "ember", "red-destroyer": "ember", dracolich: "ember", "black-raider": "ember",
  blue: "tide", silver: "tide", white: "tide", "blue-overlord": "tide", "silver-seer": "tide", "white-hunter": "tide",
  green: "grove", copper: "grove", bronze: "grove", druid: "grove", "copper-trickster": "grove", "green-schemer": "grove", "bronze-warlord": "grove",
  prophet: "arcane", sorcerer: "arcane", illusionist: "arcane", archmage: "arcane", kobold: "arcane", "chromatic-wyrmling": "arcane", "time-dragon": "arcane",
};
export const familyFx = (family: string | undefined): FxKind => (family && FAMILY_FX[family]) || "crown";

export interface PresenterHooks { fx(): FxLayer | null; root(): { querySelector(selector: string): Element | null }; onBusy(busy: boolean): void; sound(kind: string, key: string): void }

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

const goldOf = (view: TableView | null) => { const g = view?.game; return g ? { seats: Object.fromEntries(g.seats.map(s => [s.id, s.gold])), stakes: g.stakes, hole: g.hole } : null; };

export function createPresenter(store: Store, controller: Controller, hooks: PresenterHooks) {
  const queue: QueueItem[] = [];
  let running = false, destroyed = false, generation = 0;
  const centerOf = (selector: string) => { const el = hooks.root().querySelector(selector) as HTMLElement | null; if (!el || typeof el.getBoundingClientRect !== "function") return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
  const esc = (value: string) => typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
  const cardPoint = (cardId: string) => centerOf(`[data-card="${esc(cardId)}"]`);
  const seatCoins = (seatId: string) => centerOf(`[data-coins-seat="${esc(seatId)}"]`);
  const pile = (id: string) => centerOf(`[data-pile="${id}"]`);
  const endpoint = (id: string) => id === "stakes" || id === "hole" ? pile(id) : seatCoins(id);
  const beat = (ms = BEAT_MS) => wait(ms);
  const show = (patch: Partial<ReturnType<typeof emptyShow>>) => store.set(s => ({ show: { ...s.show, ...patch } }));
  /** 场景帧（卡牌、金币）。流程轨 / 等待行读的是 flow 帧，只在演出结束后更新。 */
  const display = (view: TableView) => store.set({ display: view });
  const commitFlow = (view: TableView) => store.set({ flow: view });
  const holdGold = (view: TableView | null) => store.set({ goldHold: goldOf(view) });
  const releaseGold = () => store.set({ goldHold: null });
  function setBusy(value: boolean) { if (store.get().busy !== value) { store.set({ busy: value }); hooks.onBusy(value); } }
  const flight = (from: { x: number; y: number } | null, to: { x: number; y: number } | null, amount: number, duration: number) => new Promise<void>(resolve => { const fx = hooks.fx(); if (!from || !to || !fx) return void setTimeout(resolve, duration); fx.arc(from, to, Math.min(5, Math.max(1, Math.ceil(amount / 3))), resolve, duration); setTimeout(resolve, duration + 300); });

  async function goldArcs(flows: readonly PublicGoldFlow[], gen: number) {
    // 每段金币弧之间都查代际：清场后剩下的弧不再播，也不再出声。
    for (const flow of flows) { if (gen !== generation) return; hooks.sound("coin", flow.key); await flight(endpoint(flow.fromSeatId), endpoint(flow.toSeatId), flow.amount, 620); }
  }

  async function runReveal(item: QueueItem, gen: number) {
    const reveal = item.pres.reveal!;
    const strengths = reveal.cardIds.map(id => { try { return card(id).strength; } catch { return 0; } });
    const top = Math.max(...strengths), topIds = reveal.cardIds.filter((id, i) => strengths[i] === top);
    holdGold(item.previous);
    show({ reveal, revealPhase: "placing", revealTopIds: [] }); display(item.view);
    await beat(PLACE_MS); if (gen !== generation) return;
    show({ revealPhase: "revealing" }); hooks.sound("flip", reveal.key);
    await beat(FLIP_MS); if (gen !== generation) return;
    show({ revealPhase: "price", revealTopIds: topIds });
    for (const id of topIds) { const p = cardPoint(id); if (p) hooks.fx()?.burst(p, "crown", 0.8); }
    await beat(PRICE_MS); if (gen !== generation) return;
    if (reveal.allTied) { show({ revealPhase: "discard" }); await beat(PAY_MS); }
    else {
      show({ revealPhase: "payment" }); hooks.sound("coin", reveal.key + ":pay");
      const stakes = pile("stakes");
      await Promise.all(reveal.payments.map(pay => flight(seatCoins(pay.seatId), stakes, pay.amount, PAY_MS)));
    }
    if (gen !== generation) return;
    releaseGold();
    show({ reveal: null, revealPhase: null, revealTopIds: [] });
  }

  function spotlight(cue: PowerCue): Promise<void> {
    return new Promise(resolve => {
      show({ power: cue, resolvingSeatId: cue.seatId });
      hooks.sound(`power-${familyFx(cue.family)}`, cue.key);
      controller.onPowerDismiss(() => { show({ power: null }); resolve(); });
    });
  }

  async function banner(cue: RoundCue, gen: number) {
    show({ banner: cue });
    if (cue.kind === "end") hooks.sound("gameover", cue.key); else if (cue.kind === "round" || cue.kind === "ante") hooks.sound("round", cue.key); else hooks.sound("turn", cue.key);
    await beat(cue.kind === "turn" ? 1500 : cue.kind === "end" ? 2600 : 1800);
    if (gen !== generation) return;
    show({ banner: null });
  }

  async function scoreboard(cue: Extract<RoundCue, { kind: "score" }>, gen: number) {
    const max = Math.max(0, ...cue.report.rows.map(row => row.cards.length));
    const maxStep = max + 2;
    show({ score: { report: cue.report, step: 0, maxStep }, scoring: true });
    await beat(650);
    for (let step = 1; step <= maxStep; step++) {
      if (gen !== generation) return;
      show({ score: { report: cue.report, step, maxStep } });
      hooks.sound(step > max + 1 ? "coin" : "flip", `${cue.key}:${step}`);
      await beat(step === maxStep ? 2400 : step === max + 1 ? 1000 : 650);
    }
    if (gen !== generation) return;
    show({ score: null, scoring: false });
    await beat(200); if (gen !== generation) return;
    const stakes = pile("stakes");
    await Promise.all(cue.report.payouts.map(payout => flight(stakes, seatCoins(payout.seatId), payout.amount, 620)));
    if (gen !== generation) return;
    releaseGold();
    await beat(400);
  }

  async function pump() {
    if (running || destroyed) return; running = true; const gen = ++generation;
    try {
      while (queue.length && !destroyed && gen === generation) {
        const item = queue.shift()!;
        const { view, pres, previous, events } = item;
        const played = events.some(e => e.code === "CARD_PLAYED" || e.code === "FLIGHT_REPLACED");
        const hasShow = !!(pres.reveal || pres.powers.length || pres.rounds.length || pres.gold.length);
        setBusy(hasShow);
        if (pres.reveal) { await runReveal(item, gen); if (gen !== generation) return; }
        else if (pres.powers.length) {
          // 第一步：只落牌。第二步：说明。第三步：效果与金币。
          const landing = landingFrame(previous, view, events);
          holdGold(previous);
          display(landing ?? view);
          await beat(SETTLE_MS); if (gen !== generation) return; await beat(); if (gen !== generation) return;
          for (const [i, cue] of pres.powers.entries()) {
            await spotlight(cue); if (gen !== generation) return;
            if (i === 0 && landing) display(view);
            const p = cardPoint(cue.cardId); if (p) { hooks.fx()?.burst(p, familyFx(cue.family), 1.2); hooks.sound("power-impact", cue.key); }
            await beat(420); if (gen !== generation) return;
          }
          await goldArcs(pres.gold, gen); if (gen !== generation) return;
          releaseGold();
          await beat(); if (gen !== generation) return;
          show({ resolvingSeatId: null });
        } else if (pres.gold.length) { holdGold(previous); display(view); await beat(SETTLE_MS); if (gen !== generation) return; await goldArcs(pres.gold, gen); if (gen !== generation) return; releaseGold(); await beat(); if (gen !== generation) return; }
        else { display(view); if (played && pres.rounds.length) { await beat(SETTLE_MS); if (gen !== generation) return; } }
        for (const cue of pres.rounds) {
          if (cue.kind === "score") { holdGold(previous); await beat(SETTLE_MS); if (gen !== generation) return; await scoreboard(cue, gen); } else await banner(cue, gen);
          if (gen !== generation) return;
        }
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
      if (events.some(e => e.code === "CARD_PLAYED" || e.code === "FLIGHT_REPLACED")) hooks.sound("play", key);
      if (nextGame.deckCount < prevGame.deckCount || events.some(e => e.code === "DECK_RESHUFFLED")) hooks.sound("draw", key);
      queue.push({ view: next, previous: previous!, pres, events });
      void pump();
    },
    clear() { generation++; queue.length = 0; running = false; store.set(s => ({ show: emptyShow(), goldHold: null, flow: s.display })); setBusy(false); controller.dismissPower(); },
    destroy() { destroyed = true; this.clear(); },
  };
}
