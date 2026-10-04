/** 特效层：一张全屏 2D 画布 + 一个 DOM 精灵层。所有粒子与图元都用 Kenney Particle Pack（CC0）的软贴图绘制，
 * 不再画几何圆点：烟 / 尘 / 火焰 / 火星 / 星光 / 魔法符 / 光柱 / 光环 / 划痕 / 焦痕 / 闪光。
 * 贴图按家族色着色（离屏画布 source-in），加法混合；桌面上的环与法阵用 0.78 的透视压扁 + 竖直光柱读出立体感。
 * 没有空闲循环：队列空了就停。只有"场地环境"粒子（ambient）在存在期间保持低速循环，移除后停止。 */
import type { PublicEvent } from "../../game/rules/types";
import type { PowerCue } from "../model/cues";
import type { PowerFxContext } from "./powers";

export type FxKind = "ember" | "tide" | "grove" | "arcane" | "crown" | "gold" | "dust" | "verdigris" | "necro";
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface AmbientSpec { kind: FxKind; rate: number; area: Rect | null; drift: Point; size: number; life: number; alpha?: number;
  /** 等待选择：谁在选、选择码、源牌位置（three 层据此做"等自己 / 等对手"的驻留变体） */
  hold?: { who: "self" | "other"; code: string; from?: Point };
  /** 场地持续效果的种类（FieldLayer 的 item.kind） */
  field?: string }

type Sprite = "smoke_01" | "smoke_03" | "smoke_06" | "dirt_01" | "dirt_02" | "flame_01" | "flame_03" | "fire_01" | "spark_01" | "spark_03" | "spark_06" | "star_01" | "star_05" | "star_07" | "magic_01" | "magic_02" | "magic_04" | "magic_05" | "light_01" | "light_02" | "circle_01" | "circle_03" | "circle_05" | "twirl_01" | "twirl_03" | "slash_01" | "slash_03" | "scorch_01" | "symbol_01" | "symbol_02" | "flare_01" | "trace_01" | "trace_06" | "window_01" | "muzzle_01";
const sprite = (name: Sprite) => new URL(`../assets/fx/${name}.webp`, import.meta.url).href;
/** 烘焙了厚度与投影的龙金贴图（见 CoinStack.tsx），飞行精灵不再用 CSS filter */
const GOLD_COIN = new URL("../assets/coin-gold.webp", import.meta.url).href;

/** 家族色：主色、亮色、贴图组合 */
const FAMILY: Record<FxKind, { main: string; bright: string; burst: Sprite[]; glow: Sprite; trail: Sprite }> = {
  ember: { main: "#ff7a3c", bright: "#ffd2a0", burst: ["flame_01", "flame_03", "spark_03", "fire_01"], glow: "light_01", trail: "trace_06" },
  tide: { main: "#58b4ea", bright: "#dff6ff", burst: ["magic_02", "star_05", "spark_01", "smoke_06"], glow: "light_02", trail: "trace_01" },
  grove: { main: "#7fc45a", bright: "#e9f7d2", burst: ["star_01", "twirl_01", "magic_04", "smoke_03"], glow: "light_02", trail: "trace_01" },
  arcane: { main: "#b98cff", bright: "#f1e5ff", burst: ["magic_01", "magic_05", "symbol_02", "star_07"], glow: "light_01", trail: "trace_06" },
  crown: { main: "#ffcf5a", bright: "#fff4d0", burst: ["star_05", "flare_01", "spark_06", "star_01"], glow: "light_01", trail: "trace_01" },
  gold: { main: "#ffd36b", bright: "#fff0c0", burst: ["spark_06", "star_01"], glow: "light_01", trail: "trace_01" },
  dust: { main: "#9c8468", bright: "#d6c4a8", burst: ["dirt_01", "dirt_02", "smoke_01"], glow: "smoke_01", trail: "smoke_03" },
  // 铜绿：铜 / 青铜 / 黄铜的金属本色 + 锈；骨：龙巫妖的磷火与骨白
  verdigris: { main: "#b87333", bright: "#f0dca8", burst: ["spark_06", "twirl_03", "star_01"], glow: "light_01", trail: "trace_01" },
  necro: { main: "#b7d98a", bright: "#d9cfb8", burst: ["magic_05", "smoke_06", "star_07"], glow: "light_02", trail: "trace_06" },
};
/** 桌面透视：平面上的圆在屏幕上是这个比例的椭圆（比第一版的 0.56 立体得多） */
export const SQUASH = 0.78;

interface Particle { img: Sprite; tint: string | null; x: number; y: number; vx: number; vy: number; gravity: number; rot: number; spin: number; size: number; grow: number; life: number; age: number; alpha: number; add: boolean; squash: number }
interface Effect { start: number; duration: number; draw(ctx: CanvasRenderingContext2D, k: number, now: number): void }

export interface FxLayer {
  /** 真实硬币精灵逐枚沿弧线飞行（DOM，WAAPI），落点弹一下；resolve 在最后一枚落地后 */
  coins(from: Point, to: Point, count?: number, duration?: number): Promise<void>;
  burst(point: Point, kind: FxKind, strength?: number): void;
  ripple(point: Point, color?: string): void;
  shake(ms?: number): void;
  /** 落地尘土：横向铺开的尘粒 + 贴地冲击环 */
  dust(point: Point, size?: number): void;
  /** 光束：粒子头沿弧线从 from 飞到 to，拖尾渐隐 */
  beam(from: Point, to: Point, kind: FxKind, duration?: number): Promise<void>;
  /** 贴地扩散环 */
  ring(point: Point, kind: FxKind, radius?: number, duration?: number): Promise<void>;
  /** 法阵：符文贴图 + 同心环 + 竖直光柱 + 上升魔法粒子 */
  sigil(point: Point, kind: FxKind, radius?: number, duration?: number): Promise<void>;
  /** 抓取：从 to 处把粒子流拉向 from（偷奖池 / 偷牌），伴随贴地焦痕 */
  grab(from: Point, to: Point, kind: FxKind, duration?: number): Promise<void>;
  /** 两道轨迹交叉互换 */
  swap(a: Point, b: Point, kindA: FxKind, kindB: FxKind, duration?: number): Promise<void>;
  /** 区域威压：区域内光环压暗脉冲 + 边缘上升粒子 */
  pulse(rect: Rect, kind: FxKind, duration?: number): Promise<void>;
  /** 三道划痕 */
  claw(point: Point, kind?: FxKind, duration?: number): Promise<void>;
  /** 大爆发：闪光 + 星爆 + 光环 */
  flare(point: Point, kind: FxKind, duration?: number): Promise<void>;
  /** 拍桌掌印：闪光 + 焦痕 + 尘土冲击环（手的贴图待素材） */
  slap(point: Point, again?: boolean): Promise<void>;
  /** 持续环境粒子；传 null 移除 */
  ambient(id: string, spec: AmbientSpec | null): void;
  /** three 舞台存在时由适配器提供：按家族跑独一份的脚本；返回 true 表示已处理，false 退回 2D 脚本 */
  script?(cue: PowerCue, events: readonly PublicEvent[], ctx: PowerFxContext): Promise<boolean>;
  destroy(): void;
}

const images = new Map<Sprite, HTMLImageElement>();
const tinted = new Map<string, HTMLCanvasElement>();
function load(name: Sprite): HTMLImageElement {
  let img = images.get(name);
  if (!img) { img = new Image(); img.decoding = "async"; img.src = sprite(name); images.set(name, img); }
  return img;
}
/** 着色贴图：白色贴图 × 家族色（缓存） */
function tintOf(name: Sprite, color: string | null): CanvasImageSource | null {
  const img = load(name); if (!img.complete || !img.naturalWidth) return null;
  if (!color) return img;
  const key = `${name}:${color}`; const cached = tinted.get(key); if (cached) return cached;
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  tinted.set(key, c); return c;
}
export function preloadFx() { for (const f of Object.values(FAMILY)) { for (const s of f.burst) load(s); load(f.glow); load(f.trail); } for (const s of ["circle_01", "circle_03", "circle_05", "symbol_01", "symbol_02", "light_01", "light_02", "scorch_01", "slash_01", "slash_03", "window_01", "muzzle_01", "flare_01", "smoke_01", "dirt_01"] as Sprite[]) load(s); }

export function mountFx(canvas: HTMLCanvasElement, host: HTMLElement): FxLayer {
  const ctx = canvas.getContext("2d");
  const particles: Particle[] = [], effects: Effect[] = [], ripples: { x: number; y: number; start: number; color: string }[] = [];
  const ambients = new Map<string, AmbientSpec>();
  let raf = 0, last = 0, destroyed = false, shakeUntil = 0;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  preloadFx();
  function resize() { const rect = host.getBoundingClientRect(); const dpr = Math.min(1.5, devicePixelRatio || 1); canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; ctx?.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const dom = document.createElement("div"); dom.className = "tda-fx-dom"; dom.setAttribute("aria-hidden", "true"); dom.style.display = "none"; host.appendChild(dom);
  canvas.style.display = "none";
  function local(point: Point): Point { const rect = host.getBoundingClientRect(); return { x: point.x - rect.left, y: point.y - rect.top }; }
  function localRect(rect: Rect): Rect { const r = host.getBoundingClientRect(); return { x: rect.x - r.left, y: rect.y - r.top, w: rect.w, h: rect.h }; }
  const ease = (k: number) => k * k * (3 - 2 * k);
  const envelope = (k: number, inK = 0.15, outK = 0.3) => k < inK ? k / inK : k > 1 - outK ? (1 - k) / outK : 1;
  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

  /** 画一张贴图：中心 (x,y)，边长 size，旋转 rot，透视压扁 squash（竖直方向），加法或普通混合 */
  function draw(c: CanvasRenderingContext2D, name: Sprite, tint: string | null, x: number, y: number, size: number, rot = 0, alpha = 1, add = true, squash = 1, sizeY = size) {
    const img = tintOf(name, tint); if (!img) return;
    c.save(); c.globalCompositeOperation = add ? "lighter" : "source-over"; c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.translate(x, y); c.scale(1, squash); c.rotate(rot); c.drawImage(img, -size / 2, -sizeY / 2, size, sizeY); c.restore();
  }

  function tick(now: number) {
    raf = 0; if (destroyed || !ctx) return;
    const dt = Math.min(48, now - (last || now)) / 1000; last = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const spec of ambients.values()) {
      const n = spec.rate * dt + (Math.random() < (spec.rate * dt) % 1 ? 1 : 0);
      const fam = FAMILY[spec.kind];
      for (let i = 0; i < Math.floor(n) && particles.length < 220; i++) {
        const area = spec.area ?? { x: 0, y: 0, w: canvas.clientWidth, h: canvas.clientHeight };
        particles.push({ img: pick(fam.burst), tint: fam.main, x: area.x + Math.random() * area.w, y: area.y + Math.random() * area.h, vx: spec.drift.x * rnd(0.6, 1.4), vy: spec.drift.y * rnd(0.6, 1.4), gravity: 0, rot: rnd(0, 6.28), spin: rnd(-1, 1), size: spec.size * 7 * rnd(0.7, 1.4), grow: 6, life: spec.life * rnd(0.7, 1.3), age: 0, alpha: (spec.alpha ?? 0.7) * 0.9, add: true, squash: 1 });
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt; if (p.age >= p.life) { particles.splice(i, 1); continue; }
      const k = p.age / p.life; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.vx *= 0.985; p.rot += p.spin * dt; p.size += p.grow * dt;
      const fade = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
      draw(ctx, p.img, p.tint, p.x, p.y, p.size, p.rot, p.alpha * fade, p.add, p.squash);
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]; const k = (now - e.start) / e.duration;
      if (k >= 1) { effects.splice(i, 1); continue; }
      if (k < 0) continue;
      ctx.save(); e.draw(ctx, k, now); ctx.restore();
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; const k = (now - r.start) / 560; if (k >= 1) { ripples.splice(i, 1); continue; }
      draw(ctx, "circle_03", r.color, r.x, r.y, 40 + k * 220, 0, (1 - k) * 0.9, true, SQUASH);
    }
    if (now < shakeUntil) { const s = (shakeUntil - now) / 600; host.style.transform = `translate(${(Math.random() - .5) * 10 * s}px, ${(Math.random() - .5) * 8 * s}px)`; } else if (host.style.transform) host.style.transform = "";
    if (particles.length || ripples.length || effects.length || ambients.size || now < shakeUntil) raf = requestAnimationFrame(tick); else { last = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = "none"; }
  }
  // 空闲时整张画布不参与合成（display:none）；有东西要画再显示
  function request() { if (!raf && !destroyed) { canvas.style.display = ""; raf = requestAnimationFrame(tick); } }
  /** 贴图爆发：从 at 向四周喷出家族贴图粒子 */
  function spawn(at: Point, kind: FxKind, count: number, speed: number, opts: Partial<Particle> = {}) {
    const fam = FAMILY[kind];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, v = speed * rnd(0.35, 1.2), sq = opts.squash ?? 1;
      particles.push({ img: pick(fam.burst), tint: kind === "dust" ? null : i % 3 === 0 ? fam.bright : fam.main, x: at.x, y: at.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v * sq - (kind === "ember" ? speed * .5 : 0), gravity: kind === "ember" ? -90 : kind === "dust" ? 120 : kind === "grove" ? 40 : 15, rot: rnd(0, 6.28), spin: rnd(-3, 3), size: rnd(14, 30), grow: kind === "dust" ? 36 : 8, life: rnd(0.5, 1.1), age: 0, alpha: kind === "dust" ? 0.55 : 0.9, add: kind !== "dust", squash: 1, ...opts });
    }
    request();
  }
  function add(duration: number, draw: Effect["draw"], delay = 0): Promise<void> {
    if (!reduced()) { effects.push({ start: performance.now() + delay, duration, draw }); request(); }
    return sleep(duration + delay);
  }
  /** 竖直光柱：底部贴地、向上渐隐 */
  const pillar = (c: CanvasRenderingContext2D, fam: typeof FAMILY[FxKind], x: number, y: number, h: number, w: number, alpha: number) => { const img = tintOf(fam.glow, fam.bright); if (!img) return; c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = alpha; c.drawImage(img, x - w / 2, y - h, w, h * 1.15); c.restore(); };

  return {
    coins(from, to, count = 3, duration = 720) {
      const a = local(from), b = local(to), n = Math.max(1, Math.min(8, count)), gap = 70;
      if (reduced()) return sleep(duration);
      const dist = Math.hypot(b.x - a.x, b.y - a.y), lift = 70 + dist * 0.18;
      for (let i = 0; i < n; i++) {
        const img = document.createElement("img"); img.src = GOLD_COIN; img.className = "tda-coin-fly"; img.alt = ""; dom.style.display = ""; dom.appendChild(img);
        const spread = (i - (n - 1) / 2) * 6, frames: Keyframe[] = [];
        for (let s = 0; s <= 14; s++) { const t = s / 14, e = ease(t); const x = a.x + (b.x - a.x) * e + spread, y = a.y + (b.y - a.y) * e - Math.sin(t * Math.PI) * lift; const sc = 1 + Math.sin(t * Math.PI) * 0.45; frames.push({ transform: `translate(${x}px, ${y}px) scale(${sc}) rotate(${(t * 140 - 70) * (i % 2 ? 1 : -1)}deg)`, offset: t * 0.86 }); }
        frames.push({ transform: `translate(${b.x + spread}px, ${b.y - 8}px) scale(1.12)`, offset: 0.93 }, { transform: `translate(${b.x + spread}px, ${b.y}px) scale(1)`, offset: 1 });
        const anim = img.animate(frames, { duration, delay: i * gap, easing: "linear", fill: "forwards" });
        anim.finished.then(() => { spawn({ x: b.x + spread, y: b.y }, "gold", 4, 60, { size: 16, life: 0.4 }); img.remove(); if (!dom.childElementCount) dom.style.display = "none"; }, () => { img.remove(); if (!dom.childElementCount) dom.style.display = "none"; });
      }
      request();
      return sleep(duration + (n - 1) * gap + 40);
    },
    burst(point, kind, strength = 1) { if (reduced()) return; const at = local(point); spawn(at, kind, Math.round(22 * strength), 150 * strength); ripples.push({ x: at.x, y: at.y, start: performance.now(), color: FAMILY[kind].bright }); request(); },
    ripple(point, color = "#ead38f") { if (reduced()) return; const at = local(point); ripples.push({ x: at.x, y: at.y, start: performance.now(), color }); request(); },
    shake(ms = 600) { if (reduced()) return; shakeUntil = performance.now() + ms; request(); },
    dust(point, size = 1) {
      if (reduced()) return; const at = local(point);
      spawn(at, "dust", Math.round(14 * size), 120 * size, { squash: SQUASH, size: 22 * size, grow: 40, life: 0.7, gravity: 70, alpha: 0.5 });
      void add(420, (c, k) => draw(c, "circle_03", null, at.x, at.y, 30 + k * 170 * size, 0, (1 - k) * 0.45, false, SQUASH));
    },
    beam(from, to, kind, duration = 700) {
      const a = local(from), b = local(to), fam = FAMILY[kind], ang = Math.atan2(b.y - a.y, b.x - a.x), len = Math.hypot(b.x - a.x, b.y - a.y);
      return add(duration, (c, k) => {
        const e = ease(k);
        // 轨迹贴图沿线拉伸（从起点伸到当前头部），头部一枚闪光
        const hx = a.x + (b.x - a.x) * e, hy = a.y + (b.y - a.y) * e - Math.sin(k * Math.PI) * 40;
        const tail = Math.max(0.15, e - 0.35), tx = a.x + (b.x - a.x) * tail, ty = a.y + (b.y - a.y) * tail - Math.sin(tail * Math.PI) * 40;
        const seg = Math.hypot(hx - tx, hy - ty);
        draw(c, fam.trail, fam.main, (hx + tx) / 2, (hy + ty) / 2, seg, Math.atan2(hy - ty, hx - tx), envelope(k, 0.1, 0.25) * 0.9, true, 1, 26);
        draw(c, "flare_01", fam.bright, hx, hy, 46, k * 4, envelope(k, 0.1, 0.2), true);
        if (Math.random() < 0.7) particles.push({ img: pick(fam.burst), tint: fam.main, x: hx, y: hy, vx: rnd(-30, 30), vy: rnd(-30, 30), gravity: 10, rot: rnd(0, 6), spin: rnd(-2, 2), size: 14, grow: 10, life: 0.45, age: 0, alpha: 0.8, add: true, squash: 1 });
        if (k > 0.96) spawn(b, kind, 10, 90, { size: 18 });
        void len; void ang;
      });
    },
    ring(point, kind, radius = 90, duration = 700) {
      const at = local(point), fam = FAMILY[kind];
      return add(duration, (c, k) => { const r = (24 + ease(k) * radius) * 2; draw(c, "circle_05", fam.main, at.x, at.y, r, 0, (1 - k) * 0.95, true, SQUASH); draw(c, "circle_01", fam.bright, at.x, at.y, r * 0.72, 0, (1 - k) * 0.6, true, SQUASH); });
    },
    sigil(point, kind, radius = 110, duration = 1400) {
      const at = local(point), fam = FAMILY[kind], symbol: Sprite = kind === "arcane" || kind === "tide" ? "symbol_02" : "symbol_01";
      if (!reduced()) spawn(at, kind, 18, 40, { squash: SQUASH, size: 18, gravity: -40, life: 1.2 });
      return add(duration, (c, k, now) => {
        const a = envelope(k, 0.18, 0.3), grow = 0.75 + ease(Math.min(1, k * 3)) * 0.25, r = radius * grow * 2;
        pillar(c, fam, at.x, at.y, r * 0.9, r * 0.55, a * 0.5);
        draw(c, "circle_01", fam.main, at.x, at.y, r, now / 2600, a * 0.95, true, SQUASH);
        draw(c, "circle_03", fam.bright, at.x, at.y, r * 0.86, -now / 3800, a * 0.7, true, SQUASH);
        draw(c, symbol, fam.bright, at.x, at.y, r * 0.62, now / 3000, a * 0.9, true, SQUASH);
        draw(c, "light_01", fam.bright, at.x, at.y, r * 0.5, 0, a * 0.35, true, SQUASH);
        if (Math.random() < 0.5) particles.push({ img: pick(fam.burst), tint: fam.main, x: at.x + rnd(-r / 3, r / 3), y: at.y + rnd(-r / 6, r / 6), vx: 0, vy: -rnd(30, 70), gravity: 0, rot: rnd(0, 6), spin: rnd(-2, 2), size: rnd(10, 20), grow: 8, life: 0.9, age: 0, alpha: 0.8, add: true, squash: 1 });
      });
    },
    grab(from, to, kind, duration = 1100) {
      const a = local(from), b = local(to), fam = FAMILY[kind];
      return add(duration, (c, k) => {
        // 目标处焦痕 + 旋涡，粒子流被拉向发动者
        draw(c, "scorch_01", null, b.x, b.y, 110, 0, envelope(k, 0.15, 0.3) * 0.6, false, SQUASH);
        draw(c, "twirl_03", fam.main, b.x, b.y, 90 + Math.sin(k * 6) * 10, k * 7, envelope(k, 0.15, 0.3) * 0.8, true, SQUASH);
        if (k > 0.25 && k < 0.8 && Math.random() < 0.9) { const t = Math.random(); particles.push({ img: pick(fam.burst), tint: fam.main, x: b.x + rnd(-20, 20), y: b.y + rnd(-10, 10), vx: (a.x - b.x) * 1.4, vy: (a.y - b.y) * 1.4 - 60, gravity: 90, rot: rnd(0, 6), spin: rnd(-3, 3), size: rnd(10, 18), grow: 4, life: 0.75, age: 0, alpha: 0.9, add: true, squash: 1 }); void t; }
        if (k > 0.8) draw(c, "flare_01", fam.bright, a.x, a.y, 70, k * 3, (1 - k) / 0.2 * 0.9, true);
      });
    },
    swap(aPoint, bPoint, kindA, kindB, duration = 900) {
      const a = local(aPoint), b = local(bPoint);
      return add(duration, (c, k) => {
        const e = ease(k);
        for (const [from, to, kind, sign] of [[a, b, kindA, -1], [b, a, kindB, 1]] as const) {
          const fam = FAMILY[kind], hx = from.x + (to.x - from.x) * e, hy = from.y + (to.y - from.y) * e + sign * Math.sin(k * Math.PI) * 70;
          const tail = Math.max(0, e - 0.3), tx = from.x + (to.x - from.x) * tail, ty = from.y + (to.y - from.y) * tail + sign * Math.sin(tail * Math.PI) * 70;
          draw(c, fam.trail, fam.main, (hx + tx) / 2, (hy + ty) / 2, Math.hypot(hx - tx, hy - ty), Math.atan2(hy - ty, hx - tx), envelope(k, 0.1, 0.2) * 0.9, true, 1, 24);
          draw(c, "flare_01", fam.bright, hx, hy, 44, k * 5, envelope(k, 0.1, 0.2), true);
        }
        if (k > 0.95) { spawn(a, kindB, 10, 100, { size: 18 }); spawn(b, kindA, 10, 100, { size: 18 }); }
      });
    },
    pulse(rect, kind, duration = 1100) {
      const r = localRect(rect), fam = FAMILY[kind], cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      return add(duration, (c, k) => {
        const wave = 0.5 + 0.5 * Math.sin(k * Math.PI * 6), a = envelope(k, 0.1, 0.25);
        // 区域内压暗的色雾 + 外圈光环脉冲
        c.save(); c.globalCompositeOperation = "source-over"; c.globalAlpha = a * 0.25; c.fillStyle = fam.main; c.beginPath(); c.roundRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 12); c.fill(); c.restore();
        draw(c, "circle_05", fam.main, cx, cy, Math.max(r.w, r.h) * (1.15 + wave * 0.1), 0, a * (0.5 + wave * 0.4), true, r.h / Math.max(r.w, r.h) || 1);
        if (Math.random() < 0.6) particles.push({ img: pick(fam.burst), tint: fam.main, x: r.x + Math.random() * r.w, y: r.y + r.h, vx: 0, vy: -rnd(30, 60), gravity: -20, rot: rnd(0, 6), spin: rnd(-2, 2), size: rnd(10, 18), grow: 6, life: 0.7, age: 0, alpha: 0.8, add: true, squash: 1 });
      });
    },
    claw(point, kind = "ember", duration = 700) {
      const at = local(point), fam = FAMILY[kind];
      return add(duration, (c, k) => {
        for (let i = 0; i < 3; i++) { const kk = Math.max(0, Math.min(1, (k - i * 0.1) / 0.3)); if (kk <= 0) continue; const a = (1 - Math.max(0, (k - 0.5) / 0.5)); draw(c, i % 2 ? "slash_01" : "slash_03", fam.bright, at.x + (i - 1) * 26, at.y, 150 * kk, -0.9 + i * 0.12, a, true, 1, 60); }
        if (k < 0.5 && Math.random() < 0.7) spawn(at, kind, 2, 140, { size: 14 });
      });
    },
    flare(point, kind, duration = 1100) {
      const at = local(point), fam = FAMILY[kind];
      if (!reduced()) { spawn(at, kind, 36, 220, { size: 26 }); spawn(at, kind, 18, 110, { squash: SQUASH, size: 20 }); ripples.push({ x: at.x, y: at.y, start: performance.now(), color: fam.bright }); }
      return add(duration, (c, k, now) => {
        const a = envelope(k, 0.08, 0.5);
        draw(c, "window_01", fam.bright, at.x, at.y, 120 + ease(k) * 220, k * 0.4, a * 0.9, true);
        draw(c, "flare_01", fam.bright, at.x, at.y, 90 + ease(k) * 120, -k * 0.6, a, true);
        draw(c, "star_05", fam.main, at.x, at.y, 60 + ease(k) * 280, now / 2000, a * 0.8, true);
        draw(c, "circle_05", fam.main, at.x, at.y, 60 + ease(k) * 420, 0, (1 - k) * 0.8, true, SQUASH);
      });
    },
    slap(point, again = false) {
      const at = local(point);
      const done = add(again ? 420 : 620, (c, k) => {
        // 掌印：闪光落下 → 焦痕留在桌上渐隐
        const fall = Math.min(1, k / (again ? 0.3 : 0.22));
        if (fall < 1) draw(c, "window_01", "#ead38f", at.x, at.y - (1 - fall) * 40, 150 - fall * 60, 0, 0.7 * fall, true);
        else draw(c, "scorch_01", null, at.x, at.y, 120, 0.4, 0.8 * (1 - (k - 0.22) / 0.78), false, SQUASH);
      });
      setTimeout(() => { if (!reduced()) { this.dust(point, 1.4); this.ripple(point); } }, again ? 90 : 160);
      return done;
    },
    ambient(id, spec) { if (spec) { ambients.set(id, { ...spec, area: spec.area ? localRect(spec.area) : null }); request(); } else ambients.delete(id); },
    destroy() { destroyed = true; if (raf) cancelAnimationFrame(raf); observer.disconnect(); host.style.transform = ""; ambients.clear(); dom.remove(); },
  };
}
