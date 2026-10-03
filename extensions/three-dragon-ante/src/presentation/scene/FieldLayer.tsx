/** 场地层：公开的持续效果（德鲁伊 / 祭司 / 商人王子 / 金龙君王 / 龙巫妖 / 青铜战将 / 大法师）改变桌面环境：
 * 桌面整体色调、座位下的法阵标记与铭牌、低密度的环境粒子。出现与消失都是渐变，效果消失后粒子停止。 */
import { useEffect, useRef, useState } from "react";
import type { PublicView } from "../../game/rules/types";
import type { SeatPlacement } from "../model/layout";
import { CARD } from "../model/layout";
import type { AmbientSpec, FxKind, FxLayer } from "../fx/particles";
import { t, type Lang } from "../i18n";

interface FieldItem { id: string; kind: string; seatId: string; label: string; fx: FxKind; global: boolean }
const SPEC: Record<string, { label: string; fx: FxKind; global: boolean }> = {
  druid: { label: "fieldDruid", fx: "grove", global: true },
  priest: { label: "fieldPriest", fx: "crown", global: true },
  merchant: { label: "fieldMerchant", fx: "crown", global: false },
  monarch: { label: "fieldMonarch", fx: "crown", global: false },
  dracolich: { label: "fieldDracolich", fx: "ember", global: true },
  warlord: { label: "fieldWarlord", fx: "grove", global: false },
  archmage: { label: "fieldArchmage", fx: "arcane", global: false },
};
const AMBIENT: Record<string, Omit<AmbientSpec, "area">> = {
  druid: { kind: "grove", rate: 5, drift: { x: -14, y: 26 }, size: 3.2, life: 4, alpha: 0.6 },
  priest: { kind: "crown", rate: 3, drift: { x: 0, y: -18 }, size: 2.2, life: 3.5, alpha: 0.55 },
  dracolich: { kind: "ember", rate: 6, drift: { x: 6, y: -30 }, size: 2.4, life: 3, alpha: 0.6 },
  merchant: { kind: "gold", rate: 2, drift: { x: 0, y: -12 }, size: 2, life: 2, alpha: 0.6 },
  monarch: { kind: "crown", rate: 2.5, drift: { x: 0, y: -16 }, size: 2.4, life: 2.5, alpha: 0.6 },
  warlord: { kind: "grove", rate: 2, drift: { x: 0, y: -14 }, size: 2.6, life: 2.5, alpha: 0.5 },
  archmage: { kind: "arcane", rate: 3, drift: { x: 0, y: -20 }, size: 2.4, life: 2.5, alpha: 0.6 },
};

export function fieldItems(game: PublicView | null): FieldItem[] {
  if (!game) return [];
  const items: FieldItem[] = [];
  for (const effect of game.effects) { const spec = SPEC[effect.kind]; if (spec) items.push({ id: `${effect.kind}:${effect.seatId}:${effect.sourceCardId ?? ""}`, kind: effect.kind, seatId: effect.seatId, ...spec }); }
  for (const seat of game.seats) if (seat.archmage) items.push({ id: `archmage:${seat.id}`, kind: "archmage", seatId: seat.id, ...SPEC.archmage });
  return items;
}

export interface FieldLayerProps { game: PublicView | null; seats: SeatPlacement[]; fx: FxLayer | null; lang: Lang; host: HTMLElement | null }

export function FieldLayer({ game, seats, fx, lang, host }: FieldLayerProps) {
  const items = fieldItems(game);
  // 离场的效果保留 800 ms 做淡出
  const [leaving, setLeaving] = useState<FieldItem[]>([]);
  const known = useRef<FieldItem[]>([]);
  useEffect(() => {
    const gone = known.current.filter(old => !items.some(item => item.id === old.id));
    known.current = items;
    if (gone.length) { setLeaving(prev => [...prev, ...gone]); const timer = setTimeout(() => setLeaving(prev => prev.filter(item => !gone.includes(item))), 820); return () => clearTimeout(timer); }
  }, [items.map(item => item.id).join("|")]);
  // 环境粒子：全局效果铺满桌面，座位效果只在该座位的牌阵附近
  useEffect(() => {
    if (!fx) return;
    const active = new Set<string>();
    for (const item of items) {
      const spec = AMBIENT[item.kind]; if (!spec) continue;
      let area: AmbientSpec["area"] = null;
      if (!item.global && host) { const el = host.querySelector(`[data-drop-zone="flight"][data-drop-seat="${CSS.escape(item.seatId)}"]`) as HTMLElement | null; const r = el?.getBoundingClientRect(); if (r) area = { x: r.left - 20, y: r.top - 20, w: r.width + 40, h: r.height + 40 }; }
      fx.ambient(item.id, { ...spec, area }); active.add(item.id);
    }
    return () => { for (const id of active) fx.ambient(id, null); };
  }, [fx, host, items.map(item => item.id).join("|")]);
  const tint = items.find(item => item.global);
  const place = (item: FieldItem) => { const seat = seats.find(s => s.id === item.seatId); if (!seat) return null; const n = Math.max(1, game?.seats.find(s => s.id === item.seatId)?.flight.length ?? 1); return { x: seat.flight.x + seat.dir.x * (n - 1) * seat.flightStep / 2, y: seat.flight.y + seat.dir.y * (n - 1) * seat.flightStep / 2, w: CARD.w * seat.scale + (n - 1) * seat.flightStep + 60, h: CARD.h * seat.scale + 50 }; };
  return <>
    {tint ? <div className={`tda-field-tint is-${tint.kind}`} aria-hidden="true" /> : null}
    {[...items.map(item => ({ item, out: false })), ...leaving.map(item => ({ item, out: true }))].map(({ item, out }) => {
      const p = place(item); if (!p) return null;
      return <div key={item.id + (out ? ":out" : "")} className={`tda-field is-${item.fx}${out ? " is-leaving" : ""}`} style={{ left: p.x, top: p.y, width: p.w, height: p.h }} aria-hidden="true">
        <div className="tda-field-ring" /><div className="tda-field-ring tda-field-ring--inner" />
        <span className="tda-field-label">{t(item.label, lang)}</span>
      </div>;
    })}
  </>;
}
