/** 2.5D 牌桌：透视视口 → 倾斜平面 → 桌面 / 座位 / 中央牌堆 / 卡牌层；特效画布覆盖其上。 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { UIState } from "../app/store";
import { privateGame } from "../app/store";
import type { Controller } from "../app/controller";
import { CARD, CENTER, fitPlane, seatPlacements, type Orientation } from "../model/layout";
import { SeatBlock } from "./SeatBlock";
import { TableSurface } from "./TableSurface";
import { CardLayer } from "./CardLayer";
import { CoinStack } from "./CoinStack";
import { cardFaceURL } from "../../game/card-images";
import { t } from "../i18n";
import { mountFx, type FxLayer } from "../fx/particles";

export interface TableSceneProps { state: UIState; controller: Controller; onFx(fx: FxLayer | null): void; onOrientation(orientation: Orientation): void }

export function TableScene({ state, controller, onFx, onOrientation }: TableSceneProps) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [fit, setFit] = useState(() => fitPlane(1440, 820));
  useLayoutEffect(() => {
    const el = host.current; if (!el) return;
    const measure = () => { const rect = el.getBoundingClientRect(); if (rect.width && rect.height) setFit(fitPlane(rect.width, rect.height)); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(el); return () => observer.disconnect();
  }, []);
  useEffect(() => { onOrientation(fit.orientation); }, [fit.orientation]);
  useEffect(() => { const c = canvas.current, h = host.current; if (!c || !h) return; const fx = mountFx(c, h); onFx(fx); return () => { fx.destroy(); onFx(null); }; }, []);

  const view = state.display, game = view?.game ?? null, own = privateGame(view);
  const orientation = fit.orientation, spec = fit.spec, center = CENTER[orientation];
  const seats = useMemo(() => game ? seatPlacements(game, own?.selfSeatId ?? null, orientation) : [], [game, own?.selfSeatId, orientation]);
  const legalZone = controller.legalZone();
  const targetSeatId = state.show.power?.targetSeatIds?.[0] ?? game?.resolutionStack.find(step => step.status === "active")?.targetSeatId ?? null;
  const waitingIds = new Set(game?.waitingSeatIds ?? []);
  const hold = state.goldHold;
  const stakesShown = hold?.stakes ?? game?.stakes ?? 0, holeShown = hold?.hole ?? game?.hole ?? 0;

  // 拖动：手牌节点按下后超过 6px 才算拖动，否则保留点击语义。
  const dragRef = useRef<{ cardId: string; startX: number; startY: number; active: boolean; pointerId: number } | null>(null);
  function onCardPointerDown(event: React.PointerEvent<HTMLDivElement>, cardId: string) {
    if (event.button !== 0 || !controller.legalCardIds().includes(cardId) || controller.locked()) return;
    dragRef.current = { cardId, startX: event.clientX, startY: event.clientY, active: false, pointerId: event.pointerId };
    const target = event.currentTarget;
    const move = (e: PointerEvent) => {
      const d = dragRef.current; if (!d || e.pointerId !== d.pointerId) return;
      if (!d.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      if (!d.active) { d.active = true; try { target.setPointerCapture(e.pointerId); } catch {} controller.inspect(null); }
      const over = zoneAt(e.clientX, e.clientY, own?.selfSeatId ?? null);
      const legal = !!over && over === controller.legalZone();
      controllerDrag(cardId, e.clientX, e.clientY, legal, over);
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current; if (!d || e.pointerId !== d.pointerId) return;
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      try { target.releasePointerCapture(e.pointerId); } catch {}
      dragRef.current = null;
      if (!d.active) return;
      const over = e.type === "pointerup" ? zoneAt(e.clientX, e.clientY, own?.selfSeatId ?? null) : null;
      controllerDrag(null, 0, 0, false, null);
      if (over && over === controller.legalZone()) controller.drop(cardId, over);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }
  function controllerDrag(cardId: string | null, x: number, y: number, legal: boolean, overZone: "ante" | "flight" | null) {
    (controller as unknown as { _setDrag?(v: UIState["drag"]): void })._setDrag?.(cardId ? { cardId, x, y, legal, overZone } : null);
  }
  function zoneAt(x: number, y: number, selfSeatId: string | null): "ante" | "flight" | null {
    for (const el of document.elementsFromPoint(x, y)) { const zone = (el as HTMLElement).dataset?.dropZone; if ((zone === "ante" || zone === "flight") && (el as HTMLElement).dataset.dropSeat === selfSeatId) return zone; }
    return null;
  }

  const drag = state.drag;
  const dragCard = drag ? own?.hand.find(c => c.id === drag.cardId) : null;
  const hostRect = host.current?.getBoundingClientRect();
  return <div ref={host} className={`tda-table tda-table--${orientation}`} data-orientation={orientation} style={{ "--scale": fit.scale, "--tilt": `${spec.tilt}deg`, "--plane-w": spec.w, "--plane-h": spec.h } as React.CSSProperties}>
    <div className="tda-stage">
      <div className="tda-viewport">
        <div className="tda-plane">
          <TableSurface width={spec.w} height={spec.h} scale={fit.scale} />
          {game ? <>
            <div className="tda-pile tda-pile--deck" style={{ left: center.deck.x - CARD.w / 2 - 8, top: center.deck.y - CARD.h / 2 - 8 }} data-pile="deck"><span className="tda-slot-label">{t("deck", state.lang)} · {game.deckCount}</span></div>
            <div className="tda-pile tda-pile--discard" style={{ left: center.discard.x - CARD.w / 2 - 8, top: center.discard.y - CARD.h / 2 - 8 }} data-pile="discard" onClick={() => { const top = game.discard[game.discard.length - 1]; if (top) controller.inspect(top.id, true); }}><span className="tda-slot-label">{t("discard", state.lang)} · {game.discard.length}</span></div>
            <div className="tda-stakes" style={{ left: center.stakes.x, top: center.stakes.y }} data-pile="stakes">
              <CoinStack amount={stakesShown} big />
              <div className="tda-plate tda-stakes-plate"><span>{t("stakes", state.lang)}</span><span className="tda-num tda-stakes-amount">{stakesShown}</span></div>
            </div>
            {holeShown > 0 ? <div className="tda-hole" style={{ left: center.hole.x, top: center.hole.y }} data-pile="hole"><CoinStack amount={holeShown} /><div className="tda-plate tda-hole-plate"><span>{t("hole", state.lang)}</span><span className="tda-num">{holeShown}</span></div></div> : null}
            {seats.map(placement => { const seat = game.seats.find(s => s.id === placement.id)!; return <SeatBlock key={placement.id} seat={seat} placement={placement} game={game} selfSeatId={own?.selfSeatId ?? null} lang={state.lang}
              legalZone={legalZone} dragOver={drag?.cardId ? drag.overZone : null} targetSeatId={targetSeatId} waiting={waitingIds.has(placement.id)} gold={hold?.seats[seat.id] ?? seat.gold} onZoneClick={zone => controller.placeSelected(zone)} />; })}
            <CardLayer state={state} controller={controller} orientation={orientation} onCardPointerDown={onCardPointerDown} />
          </> : null}
        </div>
      </div>
    </div>
    <canvas ref={canvas} className="tda-fx" aria-hidden="true" />
    {drag && dragCard && hostRect ? <div className={`tda-drag-ghost${drag.legal ? " is-legal" : ""}`} style={{ left: drag.x - hostRect.left, top: drag.y - hostRect.top }} aria-hidden="true"><img src={cardFaceURL(dragCard.id)} alt="" draggable={false} /></div> : null}
  </div>;
}
