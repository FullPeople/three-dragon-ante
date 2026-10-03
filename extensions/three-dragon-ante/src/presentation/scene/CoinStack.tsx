/** 金币堆：整枚硬币照片裁图（art/currency，带透明通道），不再二次裁成椭圆——平面本身已倾斜，圆币自然成椭圆。
 * 每枚沿桌面法线（translateZ）叠高，形成真实的立体堆；数量只是示意，确切数字在铭牌上。 */
const GOLD = new URL("../../game/art/currency/dragon-gold.webp", import.meta.url).href;

export function CoinStack({ amount, scale = 1, big = false }: { amount: number; scale?: number; big?: boolean }) {
  const count = Math.min(big ? 30 : 18, Math.max(0, Math.round(amount)));
  const perStack = 6, stacks = Math.ceil(count / perStack);
  const coins: { x: number; y: number; z: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    const stack = Math.floor(i / perStack), level = i % perStack;
    const seed = Math.sin(i * 12.9898 + stack * 78.233) * 43758.5453, jitter = (seed - Math.floor(seed) - .5) * 3;
    coins.push({ x: (stack - (stacks - 1) / 2) * (big ? 36 : 30) + jitter, y: (stack % 2) * 4, z: level * 2.6, r: (i * 37) % 360 });
  }
  if (!count) return null;
  return <div className={`tda-coins${big ? " tda-coins--big" : ""}`} style={{ transform: `scale(${scale})` }} aria-hidden="true">
    {coins.map((coin, i) => <img key={i} className="tda-coin" src={GOLD} alt="" draggable={false} style={{ transform: `translate3d(${coin.x}px, ${coin.y}px, ${coin.z}px) rotateZ(${coin.r}deg)` }} />)}
  </div>;
}
