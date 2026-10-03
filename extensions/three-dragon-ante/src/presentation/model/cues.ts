/** 公共事件 → 演出提示。全部只读公共投影；私牌永不进入提示参数。 */
import type { PublicEvent, PublicView, ScoreReport } from "../../game/rules/types";
import { freshPublicEvents, powerEvents, publicGoldFlows, type PowerCue, type PublicGoldFlow } from "../../game/power-sequence";

export type { PowerCue, PublicGoldFlow };
export { freshPublicEvents, powerEvents, publicGoldFlows };

export type RoundCue = { key: string } & (
  | { kind: "score"; report: ScoreReport }
  | { kind: "round" | "turn"; round: number; seatId: string }
  | { kind: "ante"; gambit: number }
  | { kind: "end"; winners: string[] }
  | { kind: "purchase"; seatId: string; cardId: string; price: number }
  | { kind: "reward"; seatId: string; amount: number });

/** 只处理相邻、已验证的投影差；跳档（历史缺口）不回放。 */
export function roundCues(before: PublicView, after: PublicView, events: PublicEvent[]): RoundCue[] {
  if (before.id !== after.id || after.revision <= before.revision || after.revision > before.revision + 1 && !events.length) return [];
  const cues: RoundCue[] = [], prefix = `${after.id}:${after.revision}`;
  for (const [i, event] of events.entries()) {
    const key = `${prefix}:event:${i}`;
    if (event.code === "GAMBIT_SCORED" && event.score) cues.push({ key, kind: "score", report: event.score });
    else if (event.code === "BUY_PRICE" && event.seatId && event.cardIds?.[0]) cues.push({ key, kind: "purchase", seatId: event.seatId, cardId: event.cardIds[0], price: event.amount ?? 0 });
    else if (event.code === "SPECIAL_FLIGHT" && event.seatId) cues.push({ key, kind: "reward", seatId: event.seatId, amount: event.amount ?? 0 });
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

/** 一帧投影携带的全部演出。 */
export interface Presentation { reveal: RevealCue | null; powers: PowerCue[]; rounds: RoundCue[]; gold: PublicGoldFlow[] }

export function derivePresentation(before: PublicView | null, after: PublicView | null): Presentation {
  if (!before || !after || before.id !== after.id || after.revision <= before.revision) return { reveal: null, powers: [], rounds: [], gold: [] };
  const events = freshPublicEvents(before, after);
  const reveal = revealCue(after, events);
  return { reveal, powers: powerEvents(before, after), rounds: roundCues(before, after, events), gold: publicGoldFlows(before, after).filter(flow => !reveal || flow.code !== "PAID_STAKES") };
}
