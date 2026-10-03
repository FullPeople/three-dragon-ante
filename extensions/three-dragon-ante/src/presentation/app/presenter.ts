/** 演出调度：投影按序进入画面；翻注、能力说明、金币流转、横幅、计分板严格串行。
 * 规格见 AI_CONTEXT/GOAL.md §4.3。这里永远不改规则状态，只决定"什么时候把哪一帧给场景看"。 */
import type { TableView } from "../../game/protocol";
import type { PublicView } from "../../game/rules/types";
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

export function createPresenter(store: Store, controller: Controller, hooks: PresenterHooks) {
  const queue: { view: TableView; pres: Presentation }[] = [];
  let running = false, destroyed = false, generation = 0;
  const centerOf = (selector: string) => { const el = hooks.root().querySelector<HTMLElement>(selector); if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
  const cardPoint = (cardId: string) => centerOf(`[data-card="${CSS.escape(cardId)}"]`);
  const seatCoins = (seatId: string) => centerOf(`[data-coins-seat="${CSS.escape(seatId)}"]`);
  const pile = (id: string) => centerOf(`[data-pile="${id}"]`);
  const endpoint = (id: string) => id === "stakes" || id === "hole" ? pile(id) : seatCoins(id);
  const beat = (ms = BEAT_MS) => reducedMotion() ? Promise.resolve() : wait(ms);
  const show = (patch: Partial<ReturnType<typeof emptyShow>>) => store.set(s => ({ show: { ...s.show, ...patch } }));

  function display(view: TableView) { store.set({ display: view }); }
  function setBusy(value: boolean) { if (store.get().busy !== value) { store.set({ busy: value }); hooks.onBusy(value); } }

  async function goldArcs(flows: readonly PublicGoldFlow[]) {
    for (const flow of flows) {
      const from = endpoint(flow.fromSeatId), to = endpoint(flow.toSeatId); if (!from || !to) continue;
      hooks.sound("coin", flow.key);
      await new Promise<void>(resolve => { const fx = hooks.fx(); if (!fx) return resolve(); fx.arc(from, to, Math.min(5, Math.max(1, Math.ceil(flow.amount / 3))), resolve); setTimeout(resolve, 900); });
    }
  }

  async function runReveal(view: TableView, pres: Presentation, gen: number) {
    const reveal = pres.reveal!;
    const game = view.game as PublicView;
    const strengths = reveal.cardIds.map(id => { try { return card(id).strength; } catch { return 0; } });
    const top = Math.max(...strengths), topIds = reveal.cardIds.filter((id, i) => strengths[i] === top);
    show({ reveal, revealPhase: "placing", revealTopIds: [] }); display(view);
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
      const flights = reveal.payments.map(pay => new Promise<void>(resolve => { const from = seatCoins(pay.seatId); const fx = hooks.fx(); if (!from || !stakes || !fx) return resolve(); fx.arc(from, stakes, Math.min(5, Math.ceil(pay.amount / 3)), resolve); setTimeout(resolve, 900); }));
      hooks.sound("coin", reveal.key + ":pay");
      await Promise.all(flights);
      void game;
    }
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
    const maxStep = max + 2; // 逐张 → 加成 → 结果
    show({ score: { report: cue.report, step: 0, maxStep }, scoring: true });
    await beat(650);
    for (let step = 1; step <= maxStep; step++) {
      if (gen !== generation) return;
      show({ score: { report: cue.report, step, maxStep } });
      hooks.sound(step > max + 1 ? "coin" : "flip", `${cue.key}:${step}`);
      await beat(step === maxStep ? 2600 : step === max + 1 ? 1000 : 650);
    }
    if (gen !== generation) return;
    for (const payout of cue.report.payouts) { const from = pile("stakes"), to = seatCoins(payout.seatId); if (from && to) hooks.fx()?.arc(from, to, Math.min(6, Math.ceil(payout.amount / 4))); }
    await beat(700);
    show({ score: null, scoring: false });
  }

  async function pump() {
    if (running || destroyed) return; running = true; const gen = ++generation;
    try {
      while (queue.length && !destroyed && gen === generation) {
        const item = queue.shift()!;
        const { view, pres } = item;
        setBusy(!!(pres.reveal || pres.powers.length || pres.rounds.length || pres.gold.length));
        if (pres.reveal) await runReveal(view, pres, gen); else display(view);
        if (gen !== generation) return;
        if (pres.powers.length) {
          await beat(SETTLE_MS); await beat();
          for (const cue of pres.powers) {
            if (gen !== generation) return;
            await spotlight(cue);
            const p = cardPoint(cue.cardId); if (p) { hooks.fx()?.burst(p, familyFx(cue.family), 1.2); hooks.sound(`power-impact`, cue.key); }
            await beat(420);
          }
          await goldArcs(pres.gold);
          show({ resolvingSeatId: null });
          await beat();
        } else if (pres.gold.length) { await beat(SETTLE_MS); await goldArcs(pres.gold); await beat(); }
        for (const cue of pres.rounds) {
          if (gen !== generation) return;
          if (cue.kind === "score") { await beat(SETTLE_MS); await scoreboard(cue, gen); } else await banner(cue);
        }
        if (pres.reveal || pres.powers.length || pres.rounds.length) await beat();
      }
    } finally { if (gen === generation) { running = false; setBusy(false); } }
  }

  return {
    /** 相邻、同一局、在线的投影走演出队列；其他一律直接替换画面。 */
    update(next: TableView, previous: TableView | null, live: boolean) {
      const prevGame = previous?.game ?? null, nextGame = next.game;
      const adjacent = live && !!prevGame && !!nextGame && prevGame.id === nextGame.id && nextGame.revision === prevGame.revision + 1;
      if (!adjacent) { this.clear(); display(next); return; }
      const pres = derivePresentation(prevGame, nextGame);
      // 落地即响的物理音：出牌、抽牌、买牌。能力与金币的声音由各自演出步骤负责。
      const events = freshPublicEvents(prevGame, nextGame), key = `${nextGame.id}:${nextGame.revision}`;
      if (events.some(e => e.code === "CARD_PLAYED" || e.code === "FLIGHT_REPLACED")) hooks.sound("play", key);
      if (nextGame.deckCount < prevGame.deckCount || events.some(e => e.code === "DECK_RESHUFFLED")) hooks.sound("draw", key);
      queue.push({ view: next, pres });
      void pump();
    },
    clear() { generation++; queue.length = 0; running = false; store.set({ show: emptyShow() }); setBusy(false); controller.dismissPower(); },
    destroy() { destroyed = true; this.clear(); },
  };
}
