/** 一张可见的卡。按 key 保持身份，位置只通过 CSS 变量变化，所以跨区域移动自然成为飞行。
 * 离开手牌（打出 / 前注）走两段式：先抽出并转正（快出慢停），再加速落下（慢起快落），落地时回调（尘土与声音由场景层做）。 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cardFaceURL } from "../../game/card-images";
import { CardBackArt } from "./CardBack";
import type { CardPlacement, Pose } from "../model/layout";
import type { HandPowerHint } from "../../game/rules/types";
import { reducedMotion } from "../fx/motion";

export interface CardNodeProps {
  placement: CardPlacement;
  enterFrom?: Pose;
  /** 新节点从 enterFrom 以"抽出 → 落下"方式进场（对手出牌 / 前注） */
  dropIn?: boolean;
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
  label?: string;
  onPointerDown?(event: React.PointerEvent<HTMLDivElement>, cardId: string): void;
  onClick?(cardId: string): void;
  onHover?(cardId: string | null): void;
  onLand?(key: string, el: HTMLElement, zone: CardPlacement["zone"]): void;
}

export const LIFT_MS = 190, DROP_MS = 260;
const poseVars = (pose: Pose): Record<string, string> => ({ "--x": String(pose.x), "--y": String(pose.y), "--rot": `${pose.rot}deg`, "--s": String(pose.scale), "--z": String(pose.z) });
const lifted = (from: Pose, rot: number): Pose => ({ x: from.x, y: from.y - 26, rot, scale: from.scale * 1.06, z: from.z + 110 });

export function CardNode(props: CardNodeProps) {
  const { placement } = props;
  const ref = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const [phase, setPhase] = useState<"lift" | "drop" | null>(null);
  const liftPose = useRef<Pose | null>(null);
  // 上一帧的区域 / 位姿 / 待确认标志，用来判断"这张牌刚离开手牌"
  const history = useRef({ zone: placement.zone, pose: placement.pose, pending: !!props.pending });
  // React 只在 style 变化时才重写内联变量，所以入场动画结束后必须自己把目标位姿写回去，
  // 不能删除属性（删除会让 transform 失效、卡牌掉到平面原点）。
  const latest = useRef(placement.pose);
  latest.current = placement.pose;
  const onLand = useRef(props.onLand); onLand.current = props.onLand;

  useLayoutEffect(() => {
    const el = ref.current; if (!el || entered.current) return; entered.current = true;
    if (!props.enterFrom) return;
    const from = props.dropIn && !reducedMotion() ? lifted(props.enterFrom, latest.current.rot) : props.enterFrom;
    for (const [name, value] of Object.entries(poseVars(from))) el.style.setProperty(name, value);
    el.style.transition = "none";
    void el.offsetWidth;
    el.style.transition = "";
    if (props.dropIn && !reducedMotion()) {
      el.classList.add("is-dropping");
      requestAnimationFrame(() => { for (const [name, value] of Object.entries(poseVars(latest.current))) el.style.setProperty(name, value); });
      const timer = setTimeout(() => { el.classList.remove("is-dropping"); onLand.current?.(placement.key, el, placement.zone); }, DROP_MS + 40);
      return () => clearTimeout(timer);
    }
    requestAnimationFrame(() => { for (const [name, value] of Object.entries(poseVars(latest.current))) el.style.setProperty(name, value); });
  }, []);

  // 离开手牌：先在原地抽出转正，再加速落向目标
  useLayoutEffect(() => {
    const was = history.current;
    const leaving = was.zone === "hand" && !was.pending && (placement.zone !== "hand" || !!props.pending);
    history.current = { zone: placement.zone, pose: placement.pose, pending: !!props.pending };
    if (!leaving) return;
    if (reducedMotion()) { onLand.current?.(placement.key, ref.current!, placement.zone); return; }
    liftPose.current = lifted(was.pose, 0);
    setPhase("lift");
    const t1 = setTimeout(() => setPhase("drop"), LIFT_MS);
    const t2 = setTimeout(() => { setPhase(null); if (ref.current) onLand.current?.(placement.key, ref.current, placement.zone); }, LIFT_MS + DROP_MS + 30);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [placement.zone, !!props.pending]);
  useEffect(() => () => { liftPose.current = null; }, []);

  const faceDown = props.faceDownOverride ?? placement.faceDown;
  const cardId = placement.cardId;
  const cls = ["tda-card", `tda-card--${placement.zone}`];
  if (faceDown) cls.push("is-face-down");
  const standing = phase ? false : placement.standing;
  if (standing) cls.push("is-standing");
  if (phase === "lift") cls.push("is-lifting"); else if (phase === "drop") cls.push("is-dropping");
  if (props.selected) cls.push("is-selected"); if (props.hovered) cls.push("is-hovered"); if (props.legal) cls.push("is-legal");
  if (props.pending) cls.push("is-pending"); if (props.dragging) cls.push("is-dragging"); if (props.top) cls.push("is-top"); if (props.resolving) cls.push("is-resolving"); if (props.focus) cls.push("is-focus"); if (props.lifted) cls.push("is-lifted");
  if (props.hint?.state === "power-ready") cls.push("is-power-ready"); else if (props.hint?.state === "playable-no-power") cls.push("is-playable");
  const shown = phase === "lift" && liftPose.current ? liftPose.current : placement.pose;
  const style = { ...poseVars(shown), zIndex: Math.round(shown.z) + 10 } as CSSProperties;
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
