/** 金币堆：整枚硬币照片裁图（art/currency，带透明通道）。每枚只有 ±5° 的小角度与 1 px 的位移抖动，
 * 用两层深色边缘做出 3 px 厚度，沿桌面法线（translateZ）叠高；超过 8 枚分列（最多 4 列）。
 * 数量只是示意，确切数字在铭牌上。 */
const GOLD = new URL("../../game/art/currency/dragon-gold.webp", import.meta.url).href;

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

export function CoinStack({ amount, scale = 1, big = false }: { amount: number; scale?: number; big?: boolean }) {
  const coins = coinLayout(amount, big);
  if (!coins.length) return null;
  return <div className={`tda-coins${big ? " tda-coins--big" : ""}`} style={{ transform: `scale(${scale})` }} aria-hidden="true">
    {coins.map((coin, i) => <img key={i} className="tda-coin" src={GOLD} alt="" draggable={false} style={{ transform: `translate3d(${coin.x}px, ${coin.y}px, ${coin.z}px) rotateZ(${coin.r}deg)` }} />)}
  </div>;
}
