/** 幽灵牌：转移动画的临时节点。每张从 from 飘起（抬高）、飞到 to（可带翻面），一张接一张；落地后由 presenter 清空。
 * 只画公共信息：对手之间转移的是牌背；给本家的牌落地后才由手牌层显示真实卡面。 */
import { useLayoutEffect, useRef } from "react";
import type { GhostCard } from "../app/store";
import { cardFaceURL } from "../../game/card-images";
import { CardBackArt } from "./CardBack";
import type { Pose } from "../model/layout";
import { reducedMotion } from "../fx/motion";

const transformOf = (p: Pose) => `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateZ(${p.rot}deg) scale(${p.scale})`;

function Ghost({ ghost }: { ghost: GhostCard }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    if (reducedMotion()) { el.style.transform = transformOf(ghost.to); return; }
    const { from, to } = ghost;
    const mid: Pose = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, rot: (from.rot + to.rot) / 2, scale: Math.max(from.scale, to.scale) * 1.08, z: Math.max(from.z, to.z) + 120 };
    const lift: Pose = { ...from, z: from.z + 70 };
    const anim = el.animate([
      { transform: transformOf(from), offset: 0 },
      { transform: transformOf(lift), offset: 0.22, easing: "ease-out" },
      { transform: transformOf(mid), offset: 0.6, easing: "ease-in-out" },
      { transform: transformOf({ ...to, z: to.z + 24 }), offset: 0.9 },
      { transform: transformOf(to), offset: 1 },
    ], { duration: ghost.duration, delay: ghost.delay, fill: "both", easing: "linear" });
    let flipTimer: ReturnType<typeof setTimeout> | undefined;
    if (ghost.flip) flipTimer = setTimeout(() => el.classList.toggle("is-face-down"), ghost.delay + ghost.duration * 0.55);
    return () => { anim.cancel(); if (flipTimer) clearTimeout(flipTimer); };
  }, [ghost.key]);
  return <div ref={ref} className={`tda-ghost${ghost.faceDown ? " is-face-down" : ""}`} data-ghost={ghost.key} aria-hidden="true" style={{ transform: transformOf(ghost.from) }}>
    <div className="tda-card-flip">
      <div className="tda-card-face">{ghost.cardId ? <img src={cardFaceURL(ghost.cardId)} alt="" draggable={false} decoding="async" width={768} height={1357} /> : null}</div>
      <div className="tda-card-back"><CardBackArt /></div>
    </div>
  </div>;
}

export function GhostLayer({ ghosts }: { ghosts: GhostCard[] }) {
  if (!ghosts.length) return null;
  return <div className="tda-ghost-layer">{ghosts.map(ghost => <Ghost key={ghost.key} ghost={ghost} />)}</div>;
}
