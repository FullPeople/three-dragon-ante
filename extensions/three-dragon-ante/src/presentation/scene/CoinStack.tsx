/** 真实硬币照片裁图（art/currency，用户提供的参考图裁切）堆成金币堆；数量只是示意，确切数字在铭牌上。 */
const GOLD = new URL("../../game/art/currency/dragon-gold.webp", import.meta.url).href;

export function CoinStack({ amount, scale = 1, big = false }: { amount: number; scale?: number; big?: boolean }) {
  const count = Math.min(big ? 30 : 18, Math.max(0, Math.round(amount)));
  const perStack = 6, stacks = Math.ceil(count / perStack);
  const coins: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    const stack = Math.floor(i / perStack), level = i % perStack;
    const seed = Math.sin(i * 12.9898 + stack * 78.233) * 43758.5453, jitter = (seed - Math.floor(seed) - .5) * 4;
    coins.push({ x: (stack - (stacks - 1) / 2) * 30 + jitter, y: -level * 5, r: (i * 37) % 360 });
  }
  if (!count) return null;
  return <div className={`tda-coins${big ? " tda-coins--big" : ""}`} style={{ transform: `scale(${scale})` }} aria-hidden="true">
    {coins.map((coin, i) => <img key={i} className="tda-coin" src={GOLD} alt="" draggable={false} style={{ transform: `translate(${coin.x}px, ${coin.y}px) rotate(${coin.r}deg)` }} />)}
  </div>;
}
