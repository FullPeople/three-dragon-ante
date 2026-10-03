/** 公共事件 → 演出提示。全部只读公共投影；私牌永不进入提示参数。 */
import type { PublicEvent, PublicView, ScoreReport } from "../../game/rules/types";
import { freshPublicEvents, powerEvents, publicGoldFlows, type PowerCue, type PublicGoldFlow } from "../../game/power-sequence";
import { publicFlightFormation, type PublicFlightFormationKind } from "../../game/flight-formations";

export type { PowerCue, PublicGoldFlow };
export { freshPublicEvents, powerEvents, publicGoldFlows };

export type RoundCue = { key: string } & (
  | { kind: "score"; report: ScoreReport }
  | { kind: "round" | "turn"; round: number; seatId: string }
  | { kind: "ante"; gambit: number }
  | { kind: "end"; winners: string[] }
  | { kind: "purchase"; seatId: string; cardId: string; price: number });

/** 特殊牌阵：公开的三张牌、组合种类、奖励金额，以及紧随其后的金币流（同色：对手付钱；同点：取奖池）。 */
export interface FormationCue { key: string; seatId: string; kind: PublicFlightFormationKind | "unknown"; amount: number; cardIds: string[]; flows: PublicGoldFlow[] }

/** 只处理相邻、已验证的投影差；跳档（历史缺口）不回放。 */
export function roundCues(before: PublicView, after: PublicView, events: PublicEvent[]): RoundCue[] {
  if (before.id !== after.id || after.revision <= before.revision || after.revision > before.revision + 1 && !events.length) return [];
  const cues: RoundCue[] = [], prefix = `${after.id}:${after.revision}`;
  for (const [i, event] of events.entries()) {
    const key = `${prefix}:event:${i}`;
    if (event.code === "GAMBIT_SCORED" && event.score) cues.push({ key, kind: "score", report: event.score });
    else if (event.code === "BUY_PRICE" && event.seatId && event.cardIds?.[0]) cues.push({ key, kind: "purchase", seatId: event.seatId, cardId: event.cardIds[0], price: event.amount ?? 0 });
  }
  if (after.phase === "ended" && before.phase !== "ended") cues.push({ key: prefix + ":end", kind: "end", winners: after.winners });
  else if (after.phase === "ante" && after.gambit !== before.gambit) cues.push({ key: prefix + ":ante", kind: "ante", gambit: after.gambit });
  else if (after.round > 0 && after.activeSeatId && after.phase !== "choice" && after.phase !== "adjudication") {
    if (before.round !== after.round || before.gambit !== after.gambit) cues.push({ key: prefix + ":round", kind: "round", round: after.round, seatId: after.activeSeatId });
    else if (before.activeSeatId !== after.activeSeatId || before.phase !== after.phase) cues.push({ key: prefix + ":turn", kind: "turn", round: after.round, seatId: after.activeSeatId });
  }
  return cues;
}

export interface RevealCue { key: string; cardIds: string[]; allTied: boolean; payments: { seatId: string; amount: number }[] }

/** 前注翻开：事件携带全部牌 id（已公开），付款事件紧随其后。 */
export function revealCue(after: PublicView, events: PublicEvent[]): RevealCue | null {
  const index = events.findIndex(event => event.code === "ANTE_REVEALED");
  if (index < 0) return null;
  const ids = events[index].cardIds ?? [];
  if (ids.length !== after.seats.length || new Set(ids).size !== ids.length) return null;
  const following = events.slice(index + 1), allTied = following.some(event => event.code === "ANTE_ALL_TIED");
  const payments = allTied ? [] : following.filter(event => event.code === "PAID_STAKES" && event.seatId && Number.isFinite(event.amount) && event.amount! > 0).map(event => ({ seatId: event.seatId!, amount: event.amount! }));
  return { key: `${after.id}:${after.revision}:reveal`, cardIds: ids, allTied, payments };
}

const flowIndex = (flow: PublicGoldFlow) => { const m = /:gold:(\d+)/.exec(flow.key); return m ? Number(m[1]) : -1; };

/** 特殊牌阵提示：每个 SPECIAL_FLIGHT 事件带走它之后、下一个边界事件之前的金币流。 */
export function formationCues(after: PublicView, events: PublicEvent[], flows: PublicGoldFlow[]): FormationCue[] {
  const cues: FormationCue[] = [];
  const boundary = new Set(["SPECIAL_FLIGHT", "GAMBIT_SCORED", "POWER_TRIGGERED", "ANTE_REVEALED"]);
  for (const [i, event] of events.entries()) {
    if (event.code !== "SPECIAL_FLIGHT" || !event.seatId) continue;
    const seat = after.seats.find(s => s.id === event.seatId); if (!seat) continue;
    let end = events.length; for (let j = i + 1; j < events.length; j++) if (boundary.has(events[j].code)) { end = j; break; }
    const own = flows.filter(flow => { const index = flowIndex(flow); return index > i && index < end; });
    cues.push({ key: `${after.id}:${after.revision}:formation:${i}`, seatId: seat.id, kind: publicFlightFormation(seat) ?? "unknown", amount: event.amount ?? 0, cardIds: seat.flight.map(f => f.cardId), flows: own });
  }
  return cues;
}

/** 一帧投影携带的全部演出。 */
export interface Presentation { reveal: RevealCue | null; powers: PowerCue[]; rounds: RoundCue[]; gold: PublicGoldFlow[]; formations: FormationCue[] }

export function derivePresentation(before: PublicView | null, after: PublicView | null): Presentation {
  if (!before || !after || before.id !== after.id || after.revision <= before.revision) return { reveal: null, powers: [], rounds: [], gold: [], formations: [] };
  const events = freshPublicEvents(before, after);
  const reveal = revealCue(after, events);
  const allFlows = publicGoldFlows(before, after);
  const formations = formationCues(after, events, allFlows);
  const taken = new Set(formations.flatMap(f => f.flows.map(flow => flow.key)));
  // 翻注付款走翻注序列；结算付款由计分板自己飞；特殊牌阵的金币流跟在它的说明层后面。三者都不重复进通用金币流。
  const gold = allFlows.filter(flow => !(reveal && flow.code === "PAID_STAKES") && flow.code !== "GAMBIT_SCORED" && flow.code !== "GAMBIT_WON" && !taken.has(flow.key));
  return { reveal, powers: powerEvents(before, after), rounds: roundCues(before, after, events), gold, formations };
}
