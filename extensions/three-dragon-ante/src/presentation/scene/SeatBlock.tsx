/** 一个座位：铭牌、绶带、前注槽、金币堆、牌阵区、常显的总点数铭牌。卡牌本身由 CardLayer 画。
 * 方桌侧边座位整体旋转 ±90°：槽位随座位旋转，铭牌与文字保持正向。 */
import type { PublicSeat, PublicView } from "../../game/rules/types";
import { useLayoutEffect, useRef } from "react";
import type { SeatPlacement } from "../model/layout";
import { CARD, flightStepFor } from "../model/layout";
import { seatRibbon, type SeatRibbon } from "../model/flow";
import { publicFlightFormation } from "../../game/flight-formations";
import { t, type Lang } from "../i18n";
import { CoinStack } from "./CoinStack";
import type { TallyItem } from "../app/store";

export interface SeatBlockProps { seat: PublicSeat; placement: SeatPlacement; game: PublicView; selfSeatId: string | null; lang: Lang; legalZone: "ante" | "flight" | null; dragOver: "ante" | "flight" | null; targetSeatId: string | null; waiting: boolean; gold: number; tally?: TallyItem; onZoneClick(zone: "ante" | "flight"): void }

const RIBBON_KEY: Record<Exclude<SeatRibbon, "">, string> = { waiting: "ribbonWaiting", committed: "ribbonCommitted", acting: "ribbonActing", thinking: "ribbonThinking", played: "ribbonPlayed", choosing: "ribbonChoosing" };

/** 名字先按实际字宽缩小。极长昵称在可读字号下省略，完整名字仍在 DOM 和原生提示中。 */
function SeatName({ name }: { name: string }) {
  const slot = useRef<HTMLSpanElement>(null), text = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const outer = slot.current, inner = text.current; if (!outer || !inner) return;
    let alive = true;
    const fit = () => {
      if (!alive || !outer.clientWidth) return;
      inner.style.fontSize = "18px";
      const naturalWidth = inner.scrollWidth;
      const candidate = Math.max(12, Math.min(18, 18 * outer.clientWidth / Math.max(1, naturalWidth)));
      inner.style.fontSize = `${candidate}px`;
      // Font shaping can leave the estimated size clipped. Keep a measured
      // fitting lower bound; exceptionally long names retain the readable floor.
      if (candidate > 12 && inner.scrollWidth > inner.clientWidth) {
        let lower = 12, upper = candidate;
        inner.style.fontSize = "12px";
        if (inner.scrollWidth <= inner.clientWidth) {
          for (let attempt = 0; attempt < 8; attempt++) {
            const middle = (lower + upper) / 2;
            inner.style.fontSize = `${middle}px`;
            if (inner.scrollWidth <= inner.clientWidth) lower = middle;
            else upper = middle;
          }
          inner.style.fontSize = `${lower}px`;
        }
      }
    };
    fit(); const observer = new ResizeObserver(fit); observer.observe(outer);
    void document.fonts.ready.then(fit); document.fonts.addEventListener("loadingdone", fit);
    return () => { alive = false; observer.disconnect(); document.fonts.removeEventListener("loadingdone", fit); };
  }, [name]);
  return <span ref={slot} className="tda-seat-name" title={name}><span ref={text} className="tda-seat-name-text">{name}</span></span>;
}

export function SeatBlock({ seat, placement, game, selfSeatId, lang, legalZone, dragOver, targetSeatId, waiting, gold, tally, onZoneClick }: SeatBlockProps) {
  const self = placement.self, s = placement.scale, rot = placement.rot, dir = placement.dir, inward = placement.inward, plateRot = placement.plateRot;
  const ribbon = seatRibbon(game, seat.id, selfSeatId);
  const active = game.activeSeatId === seat.id && (game.phase === "play" || game.phase === "choice");
  const formation = publicFlightFormation(seat);
  const flightCount = Math.max(1, seat.flight.length + (self && legalZone === "flight" ? 1 : 0));
  const step = flightStepFor(placement, flightCount);
  const flightLength = CARD.w * s + (flightCount - 1) * step + 24, flightDepth = CARD.h * s + 20;
  const anteLegal = self && legalZone === "ante", flightLegal = self && legalZone === "flight";
  // 牌阵槽：按中心定位再旋转，侧边座位的槽就沿桌边竖排
  const flightCenter = { x: placement.flight.x + dir.x * (flightCount - 1) * step / 2, y: placement.flight.y + dir.y * (flightCount - 1) * step / 2 };
  const flightEnd = { x: placement.flight.x + dir.x * ((flightCount - 1) * step + CARD.w * s / 2 - 34), y: placement.flight.y + dir.y * ((flightCount - 1) * step + CARD.w * s / 2 - 34) };
  const depthOut = CARD.h * s / 2 + 22;
  // 总点数铭牌：本家放在牌阵右侧（与牌阵同一行，远离弃牌堆与牌库）；对手放在牌阵末端朝桌心一侧
  const strengthAt = self ? { x: placement.flight.x + dir.x * ((flightCount - 1) * step + CARD.w * s / 2 + 62), y: placement.flight.y } : { x: flightEnd.x + inward.x * depthOut, y: flightEnd.y + inward.y * depthOut };
  const formationAt = { x: placement.flight.x + inward.x * depthOut, y: placement.flight.y + inward.y * depthOut };
  const at = (p: { x: number; y: number }) => ({ left: p.x, top: p.y });
  // 槽位带了 transform 就会成为与桌面画布同深度的独立层，命中测试会随机落到画布上；抬高 2 单位保证槽位永远在桌面之上
  const box = (c: { x: number; y: number }, w: number, h: number) => ({ left: c.x - w / 2, top: c.y - h / 2, width: w, height: h, transform: `rotate(${rot}deg) translateZ(2px)` });
  const cls = ["tda-seat", self ? "tda-seat--self" : "tda-seat--other", `tda-seat--${placement.edge}`];
  if (active) cls.push("is-active"); if (waiting) cls.push("is-waiting"); if (targetSeatId === seat.id) cls.push("is-target"); if (seat.id === game.leaderSeatId) cls.push("is-leader");
  const changed = seat.scoringStrength !== seat.strength;
  return <div className={cls.join(" ")} data-seat={seat.id} style={{ "--seat-scale": s, "--seat-rot": `${rot}deg` } as React.CSSProperties}>
    <div className="tda-plate tda-seat-plate" style={{ ...at(placement.plate), "--rot": `${plateRot}deg` } as React.CSSProperties} data-seat-plate={seat.id}>
      <div className="tda-seat-identity">
        {seat.id === game.leaderSeatId ? <span className="tda-seat-leader" title={t("leader", lang)}>♛</span> : null}
        <SeatName name={seat.name} />
      </div>
      <div className="tda-seat-funds">
        {self && seat.name !== t("you", lang) ? <span className="tda-seat-self">{t("you", lang)}</span> : null}
        <span className="tda-num tda-seat-gold">{gold}</span>
        {seat.debt ? <span className="tda-num tda-seat-debt">−{seat.debt}</span> : null}
        {!self ? <span className="tda-seat-hand" title={t("hand", lang)}><svg viewBox="0 0 12 14" width="10" height="12" aria-hidden="true"><rect x="0.5" y="2.5" width="7" height="10" rx="1" fill="none" stroke="currentColor" /><rect x="4.5" y="0.5" width="7" height="10" rx="1" fill="#15100b" stroke="currentColor" /></svg>{seat.handCount}</span> : null}
      </div>
    </div>
    {ribbon ? <div className={`tda-ribbon tda-ribbon--${ribbon}`} style={{ ...at(placement.ribbon), "--rot": `${plateRot}deg` } as React.CSSProperties}>{t(RIBBON_KEY[ribbon], lang)}</div> : null}
    {/* 大法师效果：绶带位置旁的第二条绶带（身份标签区，不往桌心伸、不压牌堆） */}
    {seat.archmage ? <div className="tda-ribbon tda-ribbon--archmage" style={{ ...at({ x: placement.ribbon.x + dir.x * 80, y: placement.ribbon.y + dir.y * 80 }), "--rot": `${plateRot}deg` } as React.CSSProperties}>{t("archmage", lang)}</div> : null}
    <div className={`tda-slot tda-slot--ante${anteLegal ? " is-legal" : ""}${dragOver === "ante" && self ? " is-over" : ""}`} style={box(placement.ante, CARD.w * s + 16, CARD.h * s + 16)}
      data-drop-zone="ante" data-drop-seat={seat.id} onClick={anteLegal ? () => onZoneClick("ante") : undefined} role={anteLegal ? "button" : undefined} aria-label={self ? t("placeAnte", lang) : undefined}>
      <span className="tda-slot-label">{t("ante", lang)}</span>
    </div>
    <div className="tda-coins-anchor" style={at(placement.coins)} data-coins-seat={seat.id}><CoinStack amount={gold} scale={s} /></div>
    <div className={`tda-slot tda-slot--flight${flightLegal ? " is-legal" : ""}${dragOver === "flight" && self ? " is-over" : ""}`} style={box(flightCenter, flightLength, flightDepth)}
      data-drop-zone="flight" data-drop-seat={seat.id} onClick={flightLegal ? () => onZoneClick("flight") : undefined} role={flightLegal ? "button" : undefined} aria-label={self ? t("placeFlight", lang) : undefined}>
      <span className="tda-slot-label">{t("flight", lang)}</span>
    </div>
    <div className={`tda-plate tda-strength-plate${changed ? " is-changed" : ""}${tally ? ` is-tally is-${tally.mark}` : ""}`} style={{ ...at(strengthAt), "--rot": `${rot}deg` } as React.CSSProperties} data-strength-seat={seat.id}>
      <span>{t("strength", lang)}</span>
      <span className="tda-num">{tally ? tally.value : changed ? `${seat.strength} → ${seat.scoringStrength}` : seat.strength}</span>
    </div>
    {formation ? <span className={`tda-formation tda-formation--${formation}`} style={{ left: formationAt.x, top: formationAt.y, position: "absolute", transform: `translate(-50%, -50%) translateZ(26px) rotate(${rot}deg)` }}>{t(formation === "color" ? "formationColor" : formation === "strength" ? "formationStrength" : "formationMortal", lang)}</span> : null}
  </div>;
}
