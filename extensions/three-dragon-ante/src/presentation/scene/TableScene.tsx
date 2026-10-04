/** 2.5D 牌桌：透视视口 → 倾斜平面 → 桌面 / 座位 / 中央牌堆 / 场地层 / 卡牌层 / 拼点数字；特效画布覆盖其上。
 * 拖动是"指向器"：手牌抬起，一条弧线箭头从牌指向指针；松手在合法区即打出。落地时尘土 + 声音。 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { UIState } from "../app/store";
import { privateGame } from "../app/store";
import type { Controller } from "../app/controller";
import { CARD, CENTER, cardPlacements, fitPlane, handLayerPlacement, isHeldByPending, seatPlacements, tableShape, type Orientation } from "../model/layout";
import { SeatBlock } from "./SeatBlock";
import { TableSurface } from "./TableSurface";
import { CardLayer, type KnownEntry } from "./CardLayer";
import { CoinStack } from "./CoinStack";
import { FieldLayer } from "./FieldLayer";
import { GhostLayer } from "./GhostLayer";
import { t } from "../i18n";
import { mountFx, type FxLayer } from "../fx/particles";
import { mountFxStage, type FxStage } from "../fx3d/FxStage";
import { composeFx } from "../fx3d/composeFx";
import { debugMarkers } from "../fx3d/debug";

export interface TableSceneProps { state: UIState; controller: Controller; onFx(fx: FxLayer | null): void; onFx3d?(stage: FxStage | null): void; onOrientation(orientation: Orientation): void; onLand?(key: string, zone: string): void }

/** 指向器：二次贝塞尔上的 chevron 列，越靠近指针越大，末端箭头。 */
function PointerArrow({ from, to, legal }: { from: { x: number; y: number }; to: { x: number; y: number }; legal: boolean }) {
  const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy);
  const ctrl = { x: (from.x + to.x) / 2 - dx * 0.08, y: Math.min(from.y, to.y) - Math.max(60, dist * 0.35) };
  const at = (k: number) => ({ x: (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * ctrl.x + k * k * to.x, y: (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * ctrl.y + k * k * to.y });
  const n = Math.max(4, Math.min(18, Math.round(dist / 28)));
  const chevrons = [];
  for (let i = 1; i < n; i++) {
    const k = i / n, p = at(k), q = at(Math.min(1, k + 0.02)), ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI, s = 6 + 7 * k;
    chevrons.push(<path key={i} className="tda-pointer-chev" d={`M${-s} ${-s * 0.7} L${s * 0.4} 0 L${-s} ${s * 0.7} L${-s * 0.5} 0 Z`} transform={`translate(${p.x} ${p.y}) rotate(${ang})`} />);
  }
  const tail = at(0.96), ang = Math.atan2(to.y - tail.y, to.x - tail.x) * 180 / Math.PI;
  return <svg className={`tda-pointer${legal ? " is-legal" : " is-illegal"}`} aria-hidden="true">
    {chevrons}
    <path className="tda-pointer-head" d="M-18 -13 L10 0 L-18 13 L-10 0 Z" transform={`translate(${to.x} ${to.y}) rotate(${ang})`} />
  </svg>;
}

export function TableScene({ state, controller, onFx, onFx3d, onOrientation, onLand }: TableSceneProps) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), airCanvas = useRef<HTMLCanvasElement>(null), groundCanvas = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<FxLayer | null>(null), fx3dRef = useRef<FxStage | null>(null);
  const fx3dDebug = typeof location !== "undefined" && new URLSearchParams(location.search).get("fx3dDebug") === "1";
  const fx3dGallery = typeof location !== "undefined" && new URLSearchParams(location.search).get("fx3dGallery") === "1";
  const [fit, setFit] = useState(() => fitPlane(1440, 820));
  useLayoutEffect(() => {
    const el = host.current; if (!el) return;
    const measure = () => { const rect = el.getBoundingClientRect(); if (rect.width && rect.height) setFit(fitPlane(rect.width, rect.height)); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(el); return () => observer.disconnect();
  }, []);
  useEffect(() => { onOrientation(fit.orientation); }, [fit.orientation]);
  // 2D 贴图层 + three.js 舞台（空中 + 地面两张画布）合成一个 FxLayer：舞台不可用（WebGL / 减少动态 / 用户关掉 / 软件 GL）时就是纯 2D 层
  useEffect(() => {
    const c = canvas.current, h = host.current, a = airCanvas.current; if (!c || !h || !a) return;
    const fx2d = mountFx(c, h);
    const stage = mountFxStage(h, a, groundCanvas.current); fx3dRef.current = stage; onFx3d?.(stage);
    if (stage && (fx3dDebug || fx3dGallery)) (window as unknown as { __tdaFx3d?: FxStage }).__tdaFx3d = stage;
    const fx = composeFx(fx2d, stage); fxRef.current = fx; onFx(fx);
    if (stage && (fx3dDebug || fx3dGallery)) (window as unknown as { __tdaFx?: FxLayer }).__tdaFx = fx;
    return () => { fx.destroy(); stage?.destroy(); fxRef.current = null; fx3dRef.current = null; onFx(null); onFx3d?.(null); };
  }, []);

  const view = state.display, game = view?.game ?? null, own = privateGame(view);
  const orientation = fit.orientation, spec = fit.spec, center = CENTER[orientation];
  const seats = useMemo(() => game ? seatPlacements(game, own?.selfSeatId ?? null, orientation) : [], [game, own?.selfSeatId, orientation]);
  const placements = useMemo(() => game ? cardPlacements(game, orientation) : [], [game, orientation]);
  // 上一帧每个节点的位姿与所在层，两层共用；渲染后把已消失的 key 清掉，同一张牌日后再出现仍算"新来的"
  const known = useRef(new Map<string, KnownEntry>());
  useEffect(() => { const keys = new Set(placements.map(p => p.key)); for (const key of [...known.current.keys()]) if (!keys.has(key)) known.current.delete(key); for (const p of placements) known.current.set(p.key, { pose: p.pose, layer: isHeldByPending(p, state.pending, own?.selfSeatId ?? null) ? "table" : p.layer }); });
  useEffect(() => {
    const stage = fx3dRef.current; if (!stage || !fx3dDebug || !game) return;
    const pts = [center.deck, center.discard, center.stakes, center.hole, ...seats.flatMap(s => [s.ante, s.coins, s.flight])];
    return debugMarkers(stage, pts);
  }, [fx3dDebug, game?.id, seats.length, orientation]);
  // 画廊（截图验收用）：开局 0.8 s 后在固定锚点各放一个图元
  useEffect(() => {
    const stage = fx3dRef.current, fx = fxRef.current; if (!stage || !fx || !fx3dGallery || !game || !seats.length) return;
    const at = (p: { x: number; y: number }) => stage.project(p.x, p.y, 0);
    const timer = setTimeout(() => {
      void fx.sigil(at(center.deck), "arcane", 130, 1800);
      void fx.beam(at(center.discard), at(center.stakes), "tide", 800);
      fx.burst(at(seats[0].flight), "ember", 1);
      void fx.flare(at(center.hole), "crown", 1000);
      void fx.ring(at(seats[0].ante), "grove", 150, 900);
      fx.dust(at({ x: seats[0].flight.x + 180, y: seats[0].flight.y }), 1);
      const other = seats[1] ?? seats[0];
      void fx.claw(at(other.flight), "ember", 900);
      void fx.grab(at(seats[0].coins), at(center.stakes), "ember", 1100);
      void fx.swap(at(center.deck), at(other.ante), "tide", "crown", 1000);
      const hand = at(seats[0].anchor); fx.ambient("gallery", { kind: "grove", rate: 36, area: { x: hand.x - 150, y: hand.y + 120, w: 300, h: 90 }, drift: { x: 0, y: -22 }, size: 2.4, life: 2, alpha: 0.75 });
      setTimeout(() => fx.ambient("gallery", null), 2600);
    }, 800);
    return () => clearTimeout(timer);
  }, [fx3dGallery, game?.id, seats.length]);
  const handAt = handLayerPlacement(orientation);
  const shape = tableShape(game?.seats.length ?? 3);
  useEffect(() => { fx3dRef.current?.setShape(shape); }, [shape]);
  const legalZone = controller.legalZone();
  const targetSeatId = state.show.power?.targetSeatIds?.[0] ?? game?.resolutionStack.find(step => step.status === "active")?.targetSeatId ?? null;
  const waitingIds = new Set(game?.waitingSeatIds ?? []);
  const hold = state.goldHold;
  const stakesShown = hold?.stakes ?? game?.stakes ?? 0, holeShown = hold?.hole ?? game?.hole ?? 0;
  const tally = state.show.tally;
  const seatTally = new Map(tally?.kind === "score" ? tally.items.map(item => [item.seatId, item]) : []);
  // 翻注拼点：数字浮在前注牌上方
  const pips = useMemo(() => {
    if (!tally || tally.kind !== "reveal" || !game) return [];
    return tally.items.flatMap(item => { const p = placements.find(c => c.cardId === item.cardId); return p ? [{ ...item, x: p.pose.x, y: p.pose.y - CARD.h * p.pose.scale / 2 - 10 }] : []; });
  }, [tally, placements]);

  // 拍桌：本家铭牌旁落下掌印 + 震动；1.2 s 内再拍是"手还在桌上再拍"的短动作（每个座位独立，远端的在 mount 里走同一套）
  const lastKnock = useRef(0), restingUntil = useRef(0);
  useEffect(() => {
    if (!state.knockAt || state.knockAt === lastKnock.current) return; lastKnock.current = state.knockAt;
    const fx = fxRef.current, el = host.current?.querySelector<HTMLElement>(`[data-seat-plate="${own ? CSS.escape(own.selfSeatId) : "-"}"]`);
    if (!fx) return; const r = el?.getBoundingClientRect(); const point = r ? { x: r.left + r.width / 2 + 90, y: r.top + r.height / 2 } : (() => { const h = host.current!.getBoundingClientRect(); return { x: h.left + h.width / 2, y: h.top + h.height * 0.7 }; })();
    const again = performance.now() < restingUntil.current; restingUntil.current = performance.now() + 1200;
    fx.shake(again ? 300 : 520); void fx.slap(point, again);
  }, [state.knockAt]);

  // 拖动：手牌节点按下后超过 6px 才算拖动，否则保留点击语义。
  const dragRef = useRef<{ cardId: string; startX: number; startY: number; active: boolean; pointerId: number } | null>(null);
  const pendingMove = useRef<{ x: number; y: number } | null>(null), moveRaf = useRef(0);
  function onCardPointerDown(event: React.PointerEvent<HTMLDivElement>, cardId: string) {
    if (event.button !== 0 || !controller.legalCardIds().includes(cardId) || controller.locked()) return;
    dragRef.current = { cardId, startX: event.clientX, startY: event.clientY, active: false, pointerId: event.pointerId };
    const target = event.currentTarget;
    const move = (e: PointerEvent) => {
      const d = dragRef.current; if (!d || e.pointerId !== d.pointerId) return;
      if (!d.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      if (!d.active) { d.active = true; try { target.setPointerCapture(e.pointerId); } catch {} controller.inspect(null); }
      // 每帧最多一次状态更新：指针事件可达 120+ Hz，每次都整树重渲染会拖垮弱机
      pendingMove.current = { x: e.clientX, y: e.clientY };
      if (!moveRaf.current) moveRaf.current = requestAnimationFrame(() => { moveRaf.current = 0; const p = pendingMove.current; if (!p || !dragRef.current) return; const over = zoneAt(p.x, p.y, own?.selfSeatId ?? null); const legal = !!over && over === controller.legalZone(); controllerDrag(cardId, p.x, p.y, legal, over); });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current; if (!d || e.pointerId !== d.pointerId) return;
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      try { target.releasePointerCapture(e.pointerId); } catch {}
      dragRef.current = null; pendingMove.current = null; if (moveRaf.current) { cancelAnimationFrame(moveRaf.current); moveRaf.current = 0; }
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
  // 落地：尘土（横向铺开）+ 轻震 + 声音（声音由宿主层播放）
  function onCardLand(key: string, el: HTMLElement, zone: string) {
    const fx = fxRef.current; const r = el.getBoundingClientRect();
    if (fx && r.width) { fx.dust({ x: r.left + r.width / 2, y: r.top + r.height * 0.72 }, zone === "flight" ? 1.1 : 0.9); fx.shake(180); }
    onLand?.(key, zone);
  }

  const drag = state.drag;
  const hostRect = host.current?.getBoundingClientRect();
  let pointer: { from: { x: number; y: number }; to: { x: number; y: number }; legal: boolean } | null = null;
  if (drag && hostRect) { const el = host.current?.querySelector<HTMLElement>(`[data-card="${CSS.escape(drag.cardId)}"]`); const r = el?.getBoundingClientRect(); if (r) pointer = { from: { x: r.left + r.width / 2 - hostRect.left, y: r.top - hostRect.top + 8 }, to: { x: drag.x - hostRect.left, y: drag.y - hostRect.top }, legal: drag.legal }; }
  return <div ref={host} className={`tda-table tda-table--${orientation} tda-table--${shape}`} data-orientation={orientation} data-shape={shape} style={{ "--scale": fit.scale, "--tilt": `${spec.tilt}deg`, "--plane-w": spec.w, "--plane-h": spec.h } as React.CSSProperties}>
    <div className="tda-stage">
      <div className="tda-viewport">
        <div className="tda-plane">
          <TableSurface width={spec.w} height={spec.h} scale={fit.scale} shape={shape} />
          <canvas ref={groundCanvas} className="tda-fx3d-ground" aria-hidden="true" />
          {game ? <>
            <FieldLayer game={game} seats={seats} fx={fxRef.current} lang={state.lang} host={host.current} />
            <div className="tda-pile tda-pile--deck" style={{ left: center.deck.x - CARD.w / 2 - 8, top: center.deck.y - CARD.h / 2 - 8 }} data-pile="deck"><span className="tda-slot-label">{t("deck", state.lang)} · {game.deckCount}</span></div>
            <div className="tda-pile tda-pile--discard" style={{ left: center.discard.x - CARD.w / 2 - 8, top: center.discard.y - CARD.h / 2 - 8 }} data-pile="discard" onClick={() => { const top = game.discard[game.discard.length - 1]; if (top) controller.inspect(top.id, true); }}><span className="tda-slot-label">{t("discard", state.lang)} · {game.discard.length}</span></div>
            <div className="tda-stakes" style={{ left: center.stakes.x, top: center.stakes.y }}>
              <div className="tda-plate tda-stakes-plate"><span>{t("stakes", state.lang)}</span><span className="tda-num tda-stakes-amount">{stakesShown}</span></div>
              <div className="tda-coins-anchor tda-coins-anchor--pile" data-pile="stakes"><CoinStack amount={stakesShown} big /></div>
            </div>
            {/* 偿债池为 0 也保留（淡显）：第一笔偿债的金币需要一个落点，总额也要时刻可见 */}
            <div className={`tda-hole${holeShown > 0 ? "" : " is-empty"}`} style={{ left: center.hole.x, top: center.hole.y }}><div className="tda-plate tda-hole-plate"><span>{t("hole", state.lang)}</span><span className="tda-num">{holeShown}</span></div><div className="tda-coins-anchor tda-coins-anchor--pile" data-pile="hole"><CoinStack amount={holeShown} /></div></div>
            {seats.map(placement => { const seat = game.seats.find(s => s.id === placement.id)!; return <SeatBlock key={placement.id} seat={seat} placement={placement} game={game} selfSeatId={own?.selfSeatId ?? null} lang={state.lang}
              legalZone={legalZone} dragOver={drag?.cardId ? drag.overZone : null} targetSeatId={targetSeatId} waiting={waitingIds.has(placement.id)} gold={hold?.seats[seat.id] ?? seat.gold} tally={seatTally.get(seat.id)} onZoneClick={zone => controller.placeSelected(zone)} />; })}
            <CardLayer state={state} controller={controller} orientation={orientation} layer="table" placements={placements} seats={seats} known={known} onCardPointerDown={onCardPointerDown} onCardLand={onCardLand} />
            <GhostLayer ghosts={state.show.ghosts} />
            {pips.map(pip => <div key={pip.cardId} className={`tda-pip is-step${tally?.step ?? 1} is-${pip.mark}`} style={{ left: pip.x, top: pip.y }} aria-hidden="true"><b className="tda-num">{pip.value}</b>{tally?.step === 2 && pip.mark !== "none" ? <small>{t(pip.mark === "lead" ? "tallyLeader" : pip.mark === "tied" ? "tallyTied" : "tallyIneligible", state.lang)}</small> : null}</div>)}
          </> : null}
        </div>
        {game ? <div className="tda-hand-layer" style={{ left: handAt.left, top: handAt.top, transform: `translateZ(${handAt.z}px)` }} data-hand-layer>
          <CardLayer state={state} controller={controller} orientation={orientation} layer="hand" placements={placements} seats={seats} known={known} onCardPointerDown={onCardPointerDown} onCardLand={onCardLand} />
        </div> : null}
      </div>
    </div>
    <canvas ref={canvas} className="tda-fx" aria-hidden="true" />
    <canvas ref={airCanvas} className="tda-fx3d-air" aria-hidden="true" />
    {pointer ? <PointerArrow from={pointer.from} to={pointer.to} legal={pointer.legal} /> : null}
  </div>;
}
