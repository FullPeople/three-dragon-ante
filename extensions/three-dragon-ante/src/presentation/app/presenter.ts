/** 演出调度：投影按序进入画面；翻注、能力说明、金币流转、横幅、计分板严格串行。
 * 规格见 AI_CONTEXT/GOAL.md §4.3：出牌落地 → 停一拍 → 能力说明（玩家关闭）→ 卡牌效果与金币 → 停一拍 → 阶段变更。
 * 这里永远不改规则状态，只决定"什么时候把哪一帧给场景看"。 */
import type { TableView } from "../../game/protocol";
import type { PublicEvent, PublicView, SeatView } from "../../game/rules/types";
import { card } from "../../game/rules/cards";
import { derivePresentation, freshPublicEvents, type Presentation, type PublicGoldFlow, type PowerCue, type RoundCue } from "../model/cues";
import { reducedMotion, wait } from "../fx/motion";
import type { FxLayer, FxKind } from "../fx/particles";
import { emptyShow, type Store } from "./store";
import type { Controller } from "./controller";

const BEAT_MS = 300, SETTLE_MS = 520, PLACE_MS = 250, FLIP_MS = 360, PRICE_MS = 640, PAY_MS = 470;
const FAMILY_FX: Record<string, FxKind> = {
  black: "ember", red: "ember", thief: "ember", "red-destroyer": "ember", dracolich: "ember", "black-raider": "ember",
  blue: "tide", silver: "tide", white: "tide", "blue-overlord": "tide", "silver-seer": "tide", "white-hunter": "tide",
  green: "grove", copper: "grove", bronze: "grove", druid: "grove", "copper-trickster": "grove", "green-schemer": "grove", "bronze-warlord": "grove",
  prophet: "arcane", sorcerer: "arcane", illusionist: "arcane", archmage: "arcane", kobold: "arcane", "chromatic-wyrmling": "arcane", "time-dragon": "arcane",
};
export const familyFx = (family: string | undefined): FxKind => (family && FAMILY_FX[family]) || "crown";

export interface PresenterHooks { fx(): FxLayer | null; root(): HTMLElement; onBusy(busy: boolean): void; sound(kind: string, key: string): void }

interface QueueItem { view: TableView; previous: TableView; pres: Presentation; events: PublicEvent[] }

/** 落地帧：上一帧 + 刚打出的那张牌放进牌阵。其余效果（偷牌、抽牌、金币）留到说明关闭后。
 *  只用公共事件里已公开的牌 id 与下一帧的公开牌阵条目，不碰任何私牌。 */
function landingFrame(previous: TableView, next: TableView, events: PublicEvent[]): TableView | null {
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
  const centerOf = (selector: string) => { const el = hooks.root().querySelector<HTMLElement>(selector); if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
  const cardPoint = (cardId: string) => centerOf(`[data-card="${CSS.escape(cardId)}"]`);
  const seatCoins = (seatId: string) => centerOf(`[data-coins-seat="${CSS.escape(seatId)}"]`);
  const pile = (id: string) => centerOf(`[data-pile="${id}"]`);
  const endpoint = (id: string) => id === "stakes" || id === "hole" ? pile(id) : seatCoins(id);
  const beat = (ms = BEAT_MS) => reducedMotion() ? Promise.resolve() : wait(ms);
  const show = (patch: Partial<ReturnType<typeof emptyShow>>) => store.set(s => ({ show: { ...s.show, ...patch } }));
  const display = (view: TableView) => store.set({ display: view });
  const holdGold = (view: TableView | null) => store.set({ goldHold: goldOf(view) });
  const releaseGold = () => store.set({ goldHold: null });
  function setBusy(value: boolean) { if (store.get().busy !== value) { store.set({ busy: value }); hooks.onBusy(value); } }

  async function goldArcs(flows: readonly PublicGoldFlow[]) {
    for (const flow of flows) {
      const from = endpoint(flow.fromSeatId), to = endpoint(flow.toSeatId); if (!from || !to) continue;
      hooks.sound("coin", flow.key);
      await new Promise<void>(resolve => { const fx = hooks.fx(); if (!fx) return resolve(); fx.arc(from, to, Math.min(5, Math.max(1, Math.ceil(flow.amount / 3))), resolve); setTimeout(resolve, 900); });
    }
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
      show({ revealPhase: "payment" });
      const stakes = pile("stakes");
      hooks.sound("coin", reveal.key + ":pay");
      await Promise.all(reveal.payments.map(pay => new Promise<void>(resolve => { const from = seatCoins(pay.seatId); const fx = hooks.fx(); if (!from || !stakes || !fx) return resolve(); fx.arc(from, stakes, Math.min(5, Math.ceil(pay.amount / 3)), resolve); setTimeout(resolve, 900); })));
    }
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

  async function banner(cue: RoundCue) {
    show({ banner: cue });
    if (cue.kind === "end") hooks.sound("gameover", cue.key); else if (cue.kind === "round" || cue.kind === "ante") hooks.sound("round", cue.key); else hooks.sound("turn", cue.key);
    await beat(cue.kind === "turn" ? 1500 : cue.kind === "end" ? 2600 : 1800);
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
    await beat(200);
    await Promise.all(cue.report.payouts.map(payout => new Promise<void>(resolve => { const from = pile("stakes"), to = seatCoins(payout.seatId), fx = hooks.fx(); if (!from || !to || !fx) return resolve(); fx.arc(from, to, Math.min(6, Math.ceil(payout.amount / 4)), resolve); setTimeout(resolve, 900); })));
    releaseGold();
    await beat(400);
  }

  async function pump() {
    if (running || destroyed) return; running = true; const gen = ++generation;
    try {
      while (queue.length && !destroyed && gen === generation) {
        const item = queue.shift()!;
        const { view, pres, previous, events } = item;
        const hasShow = !!(pres.reveal || pres.powers.length || pres.rounds.length || pres.gold.length);
        setBusy(hasShow);
        if (pres.reveal) { await runReveal(item, gen); }
        else if (pres.powers.length) {
          // 第一步：只落牌。第二步：说明。第三步：效果与金币。
          const landing = landingFrame(previous, view, events);
          holdGold(previous);
          display(landing ?? view);
          await beat(SETTLE_MS); await beat();
          for (const [i, cue] of pres.powers.entries()) {
            if (gen !== generation) return;
            await spotlight(cue);
            if (i === 0 && landing) display(view);
            const p = cardPoint(cue.cardId); if (p) { hooks.fx()?.burst(p, familyFx(cue.family), 1.2); hooks.sound("power-impact", cue.key); }
            await beat(420);
          }
          await goldArcs(pres.gold); releaseGold();
          show({ resolvingSeatId: null });
          await beat();
        } else if (pres.gold.length) { holdGold(previous); display(view); await beat(SETTLE_MS); await goldArcs(pres.gold); releaseGold(); await beat(); }
        else display(view);
        if (gen !== generation) return;
        for (const cue of pres.rounds) {
          if (gen !== generation) return;
          if (cue.kind === "score") { holdGold(previous); await beat(SETTLE_MS); await scoreboard(cue, gen); } else await banner(cue);
        }
        if (hasShow) await beat();
      }
    } finally { if (gen === generation) { running = false; releaseGold(); setBusy(false); } }
  }

  return {
    /** 相邻、同一局、在线的投影走演出队列；其他一律直接替换画面。 */
    update(next: TableView, previous: TableView | null, live: boolean) {
      const prevGame = previous?.game ?? null, nextGame = next.game;
      const adjacent = live && !!previous && !!prevGame && !!nextGame && prevGame.id === nextGame.id && nextGame.revision === prevGame.revision + 1;
      if (!adjacent) { this.clear(); display(next); return; }
      const pres = derivePresentation(prevGame, nextGame);
      const events = freshPublicEvents(prevGame, nextGame), key = `${nextGame.id}:${nextGame.revision}`;
      if (events.some(e => e.code === "CARD_PLAYED" || e.code === "FLIGHT_REPLACED")) hooks.sound("play", key);
      if (nextGame.deckCount < prevGame.deckCount || events.some(e => e.code === "DECK_RESHUFFLED")) hooks.sound("draw", key);
      queue.push({ view: next, previous: previous!, pres, events });
      void pump();
    },
    clear() { generation++; queue.length = 0; running = false; store.set({ show: emptyShow(), goldHold: null }); setBusy(false); controller.dismissPower(); },
    destroy() { destroyed = true; this.clear(); },
  };
}
