/** 金币堆：每堆画在**一张** 2D 画布上（曾经是每枚一个 <img> + 三层 drop-shadow 滤镜，几百个带滤镜的合成图层是帧率的头号开销）。
 * 贴图 assets/coin-gold.webp 由原作龙金裁图烘焙而成：两层深色边缘（3 px 厚度）+ 软投影都在贴图里，不再用 CSS filter。
 * 每枚只有 ±5° 的小角度与 1 px 的位移抖动；叠高：原来是沿桌面法线 translateZ(3.2 px/层)，在倾斜 t 的平面上等价于
 * 平面内上移 3.2·tan(t)（倾角从 --tilt 读）。超过 8 枚分列（最多 4 列）。数量只是示意，确切数字在铭牌上。 */
import { useEffect, useRef } from "react";

const SPRITE = new URL("../assets/coin-gold.webp", import.meta.url).href;
/** 贴图几何：整图 161×182，硬币本体在 (10,6) 起 141×148，其余是厚度与投影的留白 */
const SPRITE_W = 161, SPRITE_H = 182, BODY_X = 10, BODY_Y = 6, BODY_W = 141, BODY_H = 148;
/** 画布尺寸（CSS px）与原点（= 金币锚点）：4 列 × 34 px + 抖动 + 投影留白 */
export const COIN_BOX = { w: 184, h: 112, ox: 92, oy: 66 } as const;

export const COIN_PER_COLUMN = 8, COIN_COLUMNS = 4;
export function coinLayout(amount: number, big = false): { x: number; y: number; z: number; r: number }[] {
  const count = Math.min(COIN_PER_COLUMN * COIN_COLUMNS, Math.max(0, Math.round(amount)));
  const columns = Math.min(COIN_COLUMNS, Math.ceil(count / COIN_PER_COLUMN));
  const coins: { x: number; y: number; z: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    const column = i % columns, level = Math.floor(i / columns);
    const seed = Math.sin(i * 12.9898 + column * 78.233) * 43758.5453, noise = seed - Math.floor(seed) - .5;
    coins.push({ x: (column - (columns - 1) / 2) * (big ? 34 : 30) + noise * 2, y: (column % 2) * 3, z: level * 3.2, r: noise * 10 });
  }
  return coins;
}

let image: HTMLImageElement | null = null;
const waiters = new Set<() => void>();
function sprite(): HTMLImageElement {
  if (!image) { image = new Image(); image.decoding = "async"; image.src = SPRITE; image.onload = () => { for (const w of waiters) w(); }; }
  return image;
}

export function CoinStack({ amount, scale = 1, big = false, tilt }: { amount: number; scale?: number; big?: boolean; tilt?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const coins = coinLayout(amount, big);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const draw = () => {
      const img = sprite(); if (!img.complete || !img.naturalWidth) return;
      const dpr = 2;
      if (c.width !== COIN_BOX.w * dpr) { c.width = COIN_BOX.w * dpr; c.height = COIN_BOX.h * dpr; }
      const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, COIN_BOX.w, COIN_BOX.h);
      const tiltDeg = tilt ?? (parseFloat(getComputedStyle(c).getPropertyValue("--tilt")) || 28), rise = Math.tan(tiltDeg * Math.PI / 180);
      const k = (big ? 36 : 30) / BODY_W;
      for (const coin of coins) {
        ctx.save();
        ctx.translate(COIN_BOX.ox + coin.x, COIN_BOX.oy + coin.y - coin.z * rise);
        ctx.rotate(coin.r * Math.PI / 180);
        ctx.drawImage(img, -(BODY_X + BODY_W / 2) * k, -(BODY_Y + BODY_H / 2) * k, SPRITE_W * k, SPRITE_H * k);
        ctx.restore();
      }
    };
    draw(); waiters.add(draw);
    return () => { waiters.delete(draw); };
  }, [amount, big, tilt]);
  if (!coins.length) return null;
  return <div className={`tda-coins${big ? " tda-coins--big" : ""}`} style={{ transform: `translateZ(1.5px) scale(${scale})` }} aria-hidden="true" data-coins={coins.length}>
    <canvas ref={ref} className="tda-coins-canvas" style={{ left: -COIN_BOX.ox, top: -COIN_BOX.oy, width: COIN_BOX.w, height: COIN_BOX.h }} />
  </div>;
}
