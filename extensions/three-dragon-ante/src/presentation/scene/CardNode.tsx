/** 一张可见的卡。按 key 保持身份，位置只通过 CSS 变量变化，所以跨区域移动自然成为飞行。
 * 进场方式由父层决定：
 *   - dropIn（炉石式放牌）：从起点飞到目标**上空**对齐（对手的牌此时反面）→ 停一小会 → 翻正并加速落下；
 *     落地回调只在回执已被接受后触发（提交 ≠ 接受）。
 *   - arriving：进入手牌立板，从下方升起。
 *   - 其他：从起点按飞行时长滑到位（抽牌到桌面、弃牌）。
 * 所有阶段都是 React 状态，定时器只在卸载时清理，回执早到或晚到都不会把牌卡住。 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cardFaceURL } from "../../game/card-images";
import { CardBackArt } from "./CardBack";
import type { CardPlacement, Pose } from "../model/layout";
import type { HandPowerHint } from "../../game/rules/types";
import { reducedMotion } from "../fx/motion";

export interface CardNodeProps {
  placement: CardPlacement;
  enterFrom?: Pose;
  dropIn?: boolean;
  /** dropIn 时：飞行与悬停阶段先反面（对手打出的牌） */
  dropFaceDown?: boolean;
  arriving?: boolean;
  faceDownOverride?: boolean;
  selected?: boolean;
  hovered?: boolean;
  legal?: boolean;
  pending?: boolean;
  dragging?: boolean;
  top?: boolean;
  resolving?: boolean;
  focus?: boolean;
  hint?: HandPowerHint;
  lifted?: boolean;
  /** 被偷：前伸 + 抖动 */
  tugged?: boolean;
  label?: string;
  wildLabel?: string;
  riderLabel?: string;
  onPointerDown?(event: React.PointerEvent<HTMLDivElement>, cardId: string): void;
  onClick?(cardId: string): void;
  onHover?(cardId: string | null): void;
  onLand?(key: string, el: HTMLElement, zone: CardPlacement["zone"]): void;
}

/** 炉石式放牌：飞到上空 320 ms → 悬停 180 ms → 落下 220 ms */
export const FLY_UP_MS = 320, HOVER_MS = 180, DROP_MS = 220, FLY_MS = 480, ARRIVE_MS = 480, ACCEPT_SLIDE_MS = 220;
type Phase = "enter" | "flyup" | "hover" | "drop" | "fly" | "arrive" | null;
const poseVars = (pose: Pose): Record<string, string> => ({ "--x": String(pose.x), "--y": String(pose.y), "--rot": `${pose.rot}deg`, "--s": String(pose.scale), "--z": String(pose.z) });
/** 目标上空：同一 x/y，抬高 120，略放大 */
const above = (target: Pose): Pose => ({ ...target, z: target.z + 120, scale: target.scale * 1.06 });
const liftedAt = (from: Pose, rot: number): Pose => ({ x: from.x, y: from.y - 20, rot, scale: from.scale * 1.04, z: from.z + 90 });

export function CardNode(props: CardNodeProps) {
  const { placement } = props;
  const ref = useRef<HTMLDivElement>(null);
  const reduced = reducedMotion();
  const [phase, setPhase] = useState<Phase>(props.enterFrom && !reduced ? "enter" : null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const awaitingLand = useRef(false);
  const onLand = useRef(props.onLand); onLand.current = props.onLand;
  const pendingNow = useRef(!!props.pending); pendingNow.current = !!props.pending;
  const zoneNow = useRef(placement.zone); zoneNow.current = placement.zone;
  const land = () => { const el = ref.current; if (el) onLand.current?.(placement.key, el, zoneNow.current); };
  const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };

  // 进场：第一帧停在起点（无过渡），下一帧切到对应阶段
  useLayoutEffect(() => {
    if (!props.enterFrom || reduced) { if (props.dropIn && reduced) { if (pendingNow.current) awaitingLand.current = true; else land(); } return; }
    const raf = requestAnimationFrame(() => {
      if (props.dropIn) {
        setPhase("flyup");
        later(FLY_UP_MS, () => setPhase("hover"));
        later(FLY_UP_MS + HOVER_MS, () => setPhase("drop"));
        later(FLY_UP_MS + HOVER_MS + DROP_MS + 30, () => { setPhase(null); if (pendingNow.current) awaitingLand.current = true; else land(); });
      }
      else if (props.arriving) { setPhase("arrive"); later(ARRIVE_MS + 30, () => setPhase(null)); }
      else { setPhase("fly"); later(FLY_MS + 30, () => setPhase(null)); }
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); timers.current = []; }, []);
  // 回执到达：待确认的牌被接受后才算真正落地（尘土与声音在这里），被拒回手则什么都不播
  useEffect(() => {
    if (props.pending || !awaitingLand.current) return;
    awaitingLand.current = false;
    if (placement.zone !== "hand") later(ACCEPT_SLIDE_MS, land);
  }, [props.pending, placement.zone]);

  const cardId = placement.cardId;
  // 对手的牌在飞行与悬停阶段反面，落下时翻正
  const faceDown = props.faceDownOverride ?? (props.dropFaceDown && (phase === "enter" || phase === "flyup" || phase === "hover") ? true : placement.faceDown);
  const cls = ["tda-card", `tda-card--${placement.zone}`, `tda-card--on-${placement.layer}`];
  if (faceDown) cls.push("is-face-down");
  if (placement.standing && !phase) cls.push("is-standing");
  if (phase) cls.push(`is-${phase === "enter" ? "entering" : phase === "flyup" ? "flying-up" : phase === "hover" ? "hovering" : phase === "drop" ? "dropping" : phase === "fly" ? "flying" : "arriving"}`);
  if (props.selected) cls.push("is-selected"); if (props.hovered) cls.push("is-hovered"); if (props.legal) cls.push("is-legal");
  if (props.pending) cls.push("is-pending"); if (props.dragging) cls.push("is-dragging"); if (props.top) cls.push("is-top"); if (props.resolving) cls.push("is-resolving"); if (props.focus) cls.push("is-focus"); if (props.lifted) cls.push("is-lifted"); if (props.tugged) cls.push("is-tugged");
  if (props.hint?.state === "power-ready") cls.push("is-power-ready"); else if (props.hint?.state === "playable-no-power") cls.push("is-playable");
  const shown = phase === "enter" && props.enterFrom ? (props.dropIn ? liftedAt(props.enterFrom, props.enterFrom.rot) : props.enterFrom)
    : phase === "flyup" || phase === "hover" ? above(placement.pose)
    : placement.pose;
  // 手牌层：叠放 = 位置次序；悬浮 / 选中 / 拖动的那张临时置顶，右邻不再盖住它
  const raised = props.hovered || props.selected || props.dragging ? 100 : 0;
  const style = { ...poseVars(shown), zIndex: (placement.layer === "hand" ? placement.order + raised : Math.round(shown.z)) + 10 } as CSSProperties;
  const interactive = !!cardId && !!(props.onClick || props.onPointerDown);
  return <div ref={ref} className={cls.join(" ")} style={style} data-key={placement.key} data-card={cardId} data-zone={placement.zone} data-seat={placement.seatId} data-layer={placement.layer}
    role={interactive ? "button" : undefined} tabIndex={interactive && placement.zone === "hand" ? 0 : undefined}
    aria-label={props.label}
    onPointerDown={props.onPointerDown && cardId ? event => props.onPointerDown!(event, cardId) : undefined}
    onClick={props.onClick && cardId ? () => props.onClick!(cardId) : undefined}
    onPointerEnter={props.onHover && cardId ? event => { if (event.pointerType !== "touch") props.onHover!(cardId); } : undefined}
    onPointerLeave={props.onHover && cardId ? () => props.onHover!(null) : undefined}
    onFocus={props.onHover && cardId ? () => props.onHover!(cardId) : undefined}
    onBlur={props.onHover && cardId ? () => props.onHover!(null) : undefined}>
    <div className="tda-card-flip">
      <div className="tda-card-face">{cardId ? <img src={cardFaceURL(cardId)} alt="" draggable={false} decoding="async" width={768} height={1357} /> : null}</div>
      <div className="tda-card-back"><CardBackArt /></div>
    </div>
    {placement.wild ? <span className="tda-card-tag">{props.wildLabel ?? "WILD"}</span> : null}
    {placement.rider ? <span className="tda-card-tag tda-card-tag--rider">{props.riderLabel ?? "RIDER"}</span> : null}
  </div>;
}
