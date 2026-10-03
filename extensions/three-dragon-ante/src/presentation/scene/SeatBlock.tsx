/** 一个座位：铭牌、绶带、暗置槽、金币堆、牌阵区。卡牌本身由 CardLayer 画。 */
import type { PublicSeat, PublicView } from "../../game/rules/types";
import type { SeatPlacement } from "../model/layout";
import { CARD } from "../model/layout";
import { seatRibbon, type SeatRibbon } from "../model/flow";
import { publicFlightFormation } from "../../game/flight-formations";
import { t, type Lang } from "../i18n";
import { CoinStack } from "./CoinStack";

export interface SeatBlockProps { seat: PublicSeat; placement: SeatPlacement; game: PublicView; selfSeatId: string | null; lang: Lang; legalZone: "ante" | "flight" | null; dragOver: "ante" | "flight" | null; targetSeatId: string | null; waiting: boolean; gold: number; onZoneClick(zone: "ante" | "flight"): void }

const RIBBON_KEY: Record<Exclude<SeatRibbon, "">, string> = { waiting: "ribbonWaiting", committed: "ribbonCommitted", acting: "ribbonActing", thinking: "ribbonThinking", played: "ribbonPlayed", choosing: "ribbonChoosing" };

export function SeatBlock({ seat, placement, game, selfSeatId, lang, legalZone, dragOver, targetSeatId, waiting, gold, onZoneClick }: SeatBlockProps) {
  const self = placement.self, s = placement.scale;
  const ribbon = seatRibbon(game, seat.id, selfSeatId);
  const active = game.activeSeatId === seat.id && (game.phase === "play" || game.phase === "choice");
  const formation = publicFlightFormation(seat);
  const flightCount = Math.max(1, seat.flight.length + (self && legalZone === "flight" ? 1 : 0));
  const flightWidth = CARD.w * s + (flightCount - 1) * placement.flightStep + 24;
  const anteLegal = self && legalZone === "ante", flightLegal = self && legalZone === "flight";
  const at = (p: { x: number; y: number }) => ({ left: p.x, top: p.y });
  const cls = ["tda-seat", self ? "tda-seat--self" : "tda-seat--other"];
  if (active) cls.push("is-active"); if (waiting) cls.push("is-waiting"); if (targetSeatId === seat.id) cls.push("is-target"); if (seat.id === game.leaderSeatId) cls.push("is-leader");
  return <div className={cls.join(" ")} data-seat={seat.id} style={{ "--seat-scale": s } as React.CSSProperties}>
    <div className="tda-plate tda-seat-plate" style={at(placement.plate)} data-seat-plate={seat.id}>
      {seat.id === game.leaderSeatId ? <span className="tda-seat-leader" title={t("leader", lang)}>♛</span> : null}
      <span className="tda-seat-name">{seat.name}{self && seat.name !== t("you", lang) ? ` · ${t("you", lang)}` : ""}</span>
      <span className="tda-num tda-seat-gold">{gold}</span>
      {seat.debt ? <span className="tda-seat-debt">−{seat.debt}</span> : null}
      {!self ? <span className="tda-seat-hand" title={t("hand", lang)}><svg viewBox="0 0 12 14" width="10" height="12" aria-hidden="true"><rect x="0.5" y="2.5" width="7" height="10" rx="1" fill="none" stroke="currentColor" /><rect x="4.5" y="0.5" width="7" height="10" rx="1" fill="#15100b" stroke="currentColor" /></svg>{seat.handCount}</span> : null}
    </div>
    {ribbon ? <div className={`tda-ribbon tda-ribbon--${ribbon}`} style={at(placement.ribbon)}>{t(RIBBON_KEY[ribbon], lang)}</div> : null}
    <div className={`tda-slot tda-slot--ante${anteLegal ? " is-legal" : ""}${dragOver === "ante" && self ? " is-over" : ""}`} style={{ left: placement.ante.x - CARD.w * s / 2 - 8, top: placement.ante.y - CARD.h * s / 2 - 8, width: CARD.w * s + 16, height: CARD.h * s + 16 }}
      data-drop-zone="ante" data-drop-seat={seat.id} onClick={anteLegal ? () => onZoneClick("ante") : undefined} role={anteLegal ? "button" : undefined} aria-label={self ? t("placeAnte", lang) : undefined}>
      <span className="tda-slot-label">{t("ante", lang)}</span>
    </div>
    <div className="tda-coins-anchor" style={at(placement.coins)} data-coins-seat={seat.id}><CoinStack amount={gold} scale={s} /></div>
    <div className={`tda-slot tda-slot--flight${flightLegal ? " is-legal" : ""}${dragOver === "flight" && self ? " is-over" : ""}`} style={{ left: placement.flight.x - CARD.w * s / 2 - 12, top: placement.flight.y - CARD.h * s / 2 - 10, width: flightWidth, height: CARD.h * s + 20 }}
      data-drop-zone="flight" data-drop-seat={seat.id} onClick={flightLegal ? () => onZoneClick("flight") : undefined} role={flightLegal ? "button" : undefined} aria-label={self ? t("placeFlight", lang) : undefined}>
      <span className="tda-slot-label">{t("flight", lang)}</span>
      <span className="tda-flight-strength tda-num">{seat.scoringStrength !== seat.strength ? `${seat.strength} → ${seat.scoringStrength}` : seat.strength}</span>
      {formation ? <span className={`tda-formation tda-formation--${formation}`}>{t(formation === "color" ? "formationColor" : formation === "strength" ? "formationStrength" : "formationMortal", lang)}</span> : null}
      {seat.archmage ? <span className="tda-formation tda-formation--archmage">{t("archmage", lang)}</span> : null}
    </div>
  </div>;
}
