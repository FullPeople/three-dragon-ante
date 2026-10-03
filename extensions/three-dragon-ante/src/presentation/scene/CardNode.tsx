/** 一张可见的卡。按 key 保持身份，位置只通过 CSS 变量变化，所以跨区域移动自然成为飞行。 */
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { cardFaceURL } from "../../game/card-images";
import { CardBackArt } from "./CardBack";
import type { CardPlacement, Pose } from "../model/layout";
import type { HandPowerHint } from "../../game/rules/types";

export interface CardNodeProps {
  placement: CardPlacement;
  enterFrom?: Pose;
  faceDownOverride?: boolean;
  selected?: boolean;
  hovered?: boolean;
  legal?: boolean;
  pending?: boolean;
  dragging?: boolean;
  top?: boolean;
  resolving?: boolean;
  hint?: HandPowerHint;
  lifted?: boolean;
  label?: string;
  onPointerDown?(event: React.PointerEvent<HTMLDivElement>, cardId: string): void;
  onClick?(cardId: string): void;
  onHover?(cardId: string | null): void;
}

const poseVars = (pose: Pose): Record<string, string> => ({ "--x": String(pose.x), "--y": String(pose.y), "--rot": `${pose.rot}deg`, "--s": String(pose.scale), "--z": String(pose.z) });

export function CardNode(props: CardNodeProps) {
  const { placement } = props;
  const ref = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  // React 只在 style 变化时才重写内联变量，所以入场动画结束后必须自己把目标位姿写回去，
  // 不能删除属性（删除会让 transform 失效、卡牌掉到平面原点）。
  const latest = useRef(placement.pose);
  latest.current = placement.pose;
  useLayoutEffect(() => {
    const el = ref.current; if (!el || entered.current) return; entered.current = true;
    if (!props.enterFrom) return;
    const from = poseVars(props.enterFrom);
    for (const [name, value] of Object.entries(from)) el.style.setProperty(name, value);
    el.style.transition = "none";
    void el.offsetWidth;
    el.style.transition = "";
    requestAnimationFrame(() => { for (const [name, value] of Object.entries(poseVars(latest.current))) el.style.setProperty(name, value); });
  }, []);
  const faceDown = props.faceDownOverride ?? placement.faceDown;
  const cardId = placement.cardId;
  const cls = ["tda-card", `tda-card--${placement.zone}`];
  if (faceDown) cls.push("is-face-down"); if (placement.standing) cls.push("is-standing");
  if (props.selected) cls.push("is-selected"); if (props.hovered) cls.push("is-hovered"); if (props.legal) cls.push("is-legal");
  if (props.pending) cls.push("is-pending"); if (props.dragging) cls.push("is-dragging"); if (props.top) cls.push("is-top"); if (props.resolving) cls.push("is-resolving"); if (props.lifted) cls.push("is-lifted");
  if (props.hint?.state === "power-ready") cls.push("is-power-ready"); else if (props.hint?.state === "playable-no-power") cls.push("is-playable");
  const style = { ...poseVars(placement.pose), zIndex: Math.round(placement.pose.z) + 10 } as CSSProperties;
  const interactive = !!cardId && !!(props.onClick || props.onPointerDown);
  return <div ref={ref} className={cls.join(" ")} style={style} data-key={placement.key} data-card={cardId} data-zone={placement.zone} data-seat={placement.seatId}
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
    {placement.wild ? <span className="tda-card-tag">★</span> : null}
    {placement.rider ? <span className="tda-card-tag tda-card-tag--rider">⚑</span> : null}
  </div>;
}
