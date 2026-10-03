/** 流程进展与等待（VISUAL_SPEC §4）。只读公共投影。 */
import type { PublicView } from "../../game/rules/types";
import { joinNames, t, type Lang } from "../i18n";

export type FlowState = "done" | "current" | "future";
export interface FlowStep { id: string; label: string; state: FlowState; sub?: string }

export interface PresentationFlags {
  revealing: boolean;
  resolvingSeatId: string | null;
  scoring: boolean;
}

export function flowSteps(game: PublicView | null, lang: Lang, flags: PresentationFlags): FlowStep[] {
  if (!game) return [];
  const rounds = Math.max(3, game.round);
  const ids: { id: string; label: string }[] = [
    { id: "ante", label: t("stepAnte", lang) },
    { id: "reveal", label: t("stepReveal", lang) },
    ...Array.from({ length: rounds }, (_, i) => ({ id: `round${i + 1}`, label: t("round", lang, { n: i + 1 }) })),
    { id: "score", label: t("stepScore", lang) },
  ];
  if (game.phase === "ended") ids.push({ id: "end", label: t("stepEnd", lang) });
  let current: string;
  if (game.phase === "ended") current = "end";
  else if (flags.scoring || game.phase === "resolve") current = "score";
  else if (game.phase === "ante" && !flags.revealing) current = "ante";
  else if (flags.revealing) current = "reveal";
  else if (game.phase === "adjudication") current = "score";
  else current = `round${Math.max(1, game.round)}`;
  const index = ids.findIndex(step => step.id === current);
  return ids.map((step, i) => ({ ...step, state: i < index ? "done" : i === index ? "current" : "future", sub: i === index && (game.phase === "choice" || flags.resolvingSeatId) ? t("stepPower", lang) : undefined }));
}

export type SeatRibbon = "waiting" | "committed" | "acting" | "thinking" | "played" | "choosing" | "";

export function seatRibbon(game: PublicView, seatId: string, selfSeatId: string | null): SeatRibbon {
  const seat = game.seats.find(s => s.id === seatId); if (!seat) return "";
  if (game.phase === "ante") return seat.committed ? "committed" : seatId === selfSeatId ? "acting" : "waiting";
  if (game.phase === "choice") return game.waitingSeatIds.includes(seatId) ? "choosing" : "";
  if (game.phase === "play") return game.activeSeatId === seatId ? (seatId === selfSeatId ? "acting" : "thinking") : "";
  return "";
}

export interface WaitingLine { text: string; emphasis: "you" | "others" | "show" | "none"; waitingSeatIds: string[] }

export function waitingLine(game: PublicView | null, selfSeatId: string | null, lang: Lang, flags: PresentationFlags, seatName: (id: string) => string, slowSeatIds: readonly string[] = []): WaitingLine {
  if (!game) return { text: "", emphasis: "none", waitingSeatIds: [] };
  const names = (ids: readonly string[]) => joinNames(ids.map(id => id === selfSeatId ? t("you", lang) : seatName(id)), lang);
  if (flags.revealing) return { text: t("revealing", lang), emphasis: "show", waitingSeatIds: [] };
  if (flags.resolvingSeatId) return { text: t("resolving", lang, { name: flags.resolvingSeatId === selfSeatId ? t("you", lang) : seatName(flags.resolvingSeatId) }), emphasis: "show", waitingSeatIds: [] };
  if (flags.scoring) return { text: t("scoring", lang), emphasis: "show", waitingSeatIds: [] };
  if (game.phase === "ended") return { text: t("gameOver", lang, { names: names(game.winners) }), emphasis: "none", waitingSeatIds: [] };
  if (game.phase === "adjudication") return { text: t("adjudication", lang), emphasis: "none", waitingSeatIds: [] };
  const waiting = game.waitingSeatIds;
  const mine = selfSeatId !== null && waiting.includes(selfSeatId);
  if (game.phase === "ante") {
    if (mine) return { text: t("yourTurnAnte", lang), emphasis: "you", waitingSeatIds: waiting };
    const others = waiting.filter(id => id !== selfSeatId);
    const slow = others.filter(id => slowSeatIds.includes(id));
    return { text: slow.length ? t("stillThinking", lang, { names: names(slow) }) : t("waitAnte", lang, { names: names(others) }), emphasis: "others", waitingSeatIds: others };
  }
  if (game.phase === "choice") {
    if (mine) return { text: t("yourTurnChoice", lang), emphasis: "you", waitingSeatIds: waiting };
    const actor = game.choice?.beneficiarySeatId ?? game.choice?.seatId ?? waiting[0] ?? "";
    return { text: t("waitChoice", lang, { name: actor === selfSeatId ? t("you", lang) : seatName(actor), names: names(waiting) }), emphasis: "others", waitingSeatIds: waiting };
  }
  if (mine) return { text: t("yourTurnPlay", lang), emphasis: "you", waitingSeatIds: waiting };
  const slow = waiting.filter(id => slowSeatIds.includes(id));
  return { text: slow.length ? t("stillThinking", lang, { names: names(slow) }) : t("waitPlay", lang, { names: names(waiting) }), emphasis: "others", waitingSeatIds: waiting };
}
