/** 一个全屏 2D 画布：有限时长的粒子、弧线与图元（光束 / 环 / 法阵 / 手掌 / 交换 / 威压 / 爪痕 / 爆发 / 尘土）。
 * 没有空闲循环：队列空了就停。只有"场地环境"粒子（ambient）在存在期间保持低速循环，移除后停止。
 * 所有图元都把桌面当成一个透视平面画：环与法阵是扁椭圆（squash），落地尘土横向铺开，让 2D 画布读出 3D 位置。 */
export type FxKind = "ember" | "tide" | "grove" | "arcane" | "crown" | "gold" | "dust";
interface Particle { x: number; y: number; vx: number; vy: number; life: number; age: number; size: number; color: string; kind: FxKind; spin: number; gravity: number; alpha: number }
interface Arc { from: Point; to: Point; start: number; duration: number; count: number; onLand?: () => void; landed: boolean }
interface Effect { start: number; duration: number; draw(ctx: CanvasRenderingContext2D, k: number, now: number): void }
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface AmbientSpec { kind: FxKind; rate: number; area: Rect | null; drift: Point; size: number; life: number; alpha?: number }

const PALETTE: Record<FxKind, string[]> = {
  ember: ["#ff7a45", "#ffb08d", "#ffd9a0", "#ff4d1a"],
  tide: ["#6fb7e6", "#b9e1f4", "#dff6ff", "#3f8fc9"],
  grove: ["#8bc46a", "#c6e4a4", "#e9f7d2", "#5f9a46"],
  arcane: ["#c79bff", "#ead8ff", "#fff0ff", "#9b6bdf"],
  crown: ["#ffd36b", "#ffe2a2", "#fff6d8", "#e0a62a"],
  gold: ["#ffd36b", "#ffe9b0", "#e0a62a"],
  dust: ["#b9a386", "#8c7558", "#d4c2a3", "#6b5742"],
};
/** 桌面透视：平面上的圆在屏幕上是这个比例的椭圆 */
export const SQUASH = 0.56;

export interface FxLayer {
  burst(point: Point, kind: FxKind, strength?: number): void;
  arc(from: Point, to: Point, count?: number, onLand?: () => void, duration?: number): void;
  ripple(point: Point, color?: string): void;
  shake(ms?: number): void;
  /** 落地尘土：横向铺开的尘粒 + 贴地冲击环 */
  dust(point: Point, size?: number): void;
  /** 光束：粒子头沿弧线从 from 飞到 to，拖尾渐隐 */
  beam(from: Point, to: Point, kind: FxKind, duration?: number): Promise<void>;
  /** 贴地扩散环 */
  ring(point: Point, kind: FxKind, radius?: number, duration?: number): Promise<void>;
  /** 法阵：同心椭圆 + 旋转符刻 + 族形纹 */
  sigil(point: Point, kind: FxKind, radius?: number, duration?: number): Promise<void>;
  /** 手掌剪影从 from 伸到 to 抓取再收回 */
  grab(from: Point, to: Point, kind: FxKind, duration?: number): Promise<void>;
  /** 两道轨迹交叉互换 */
  swap(a: Point, b: Point, kindA: FxKind, kindB: FxKind, duration?: number): Promise<void>;
  /** 区域威压：矩形框脉冲 + 边缘粒子 */
  pulse(rect: Rect, kind: FxKind, duration?: number): Promise<void>;
  /** 三道爪痕 */
  claw(point: Point, kind?: FxKind, duration?: number): Promise<void>;
  /** 大爆发：粒子 + 射线 + 环 */
  flare(point: Point, kind: FxKind, duration?: number): Promise<void>;
  /** 拍桌：手掌落下 + 冲击环 + 尘土 */
  slap(point: Point): Promise<void>;
  /** 持续环境粒子；传 null 移除 */
  ambient(id: string, spec: AmbientSpec | null): void;
  destroy(): void;
}

export function mountFx(canvas: HTMLCanvasElement, host: HTMLElement): FxLayer {
  const ctx = canvas.getContext("2d");
  const particles: Particle[] = [], arcs: Arc[] = [], ripples: { x: number; y: number; start: number; color: string }[] = [], effects: Effect[] = [];
  const ambients = new Map<string, AmbientSpec>();
  let raf = 0, last = 0, destroyed = false, shakeUntil = 0;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function resize() { const rect = host.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; ctx?.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function local(point: Point): Point { const rect = host.getBoundingClientRect(); return { x: point.x - rect.left, y: point.y - rect.top }; }
  function localRect(rect: Rect): Rect { const r = host.getBoundingClientRect(); return { x: rect.x - r.left, y: rect.y - r.top, w: rect.w, h: rect.h }; }
  const ease = (k: number) => k * k * (3 - 2 * k);
  const envelope = (k: number, inK = 0.15, outK = 0.3) => k < inK ? k / inK : k > 1 - outK ? (1 - k) / outK : 1;
  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  function tick(now: number) {
    raf = 0; if (destroyed || !ctx) return;
    const dt = Math.min(48, now - (last || now)) / 1000; last = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 环境粒子按速率生成
    for (const spec of ambients.values()) {
      const n = spec.rate * dt + (Math.random() < (spec.rate * dt) % 1 ? 1 : 0);
      for (let i = 0; i < Math.floor(n) && particles.length < 160; i++) {
        const area = spec.area ?? { x: 0, y: 0, w: canvas.clientWidth, h: canvas.clientHeight };
        particles.push({ x: area.x + Math.random() * area.w, y: area.y + Math.random() * area.h, vx: spec.drift.x * (0.6 + Math.random() * 0.8), vy: spec.drift.y * (0.6 + Math.random() * 0.8), life: spec.life * (0.7 + Math.random() * 0.6), age: 0, size: spec.size * (0.6 + Math.random() * 0.8), color: PALETTE[spec.kind][i % PALETTE[spec.kind].length], kind: spec.kind, spin: (Math.random() - .5) * 4, gravity: 0, alpha: spec.alpha ?? 0.7 });
      }
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt; if (p.age >= p.life) { particles.splice(i, 1); continue; }
      const k = p.age / p.life; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.vx *= 0.985;
      ctx.globalCompositeOperation = p.kind === "dust" ? "source-over" : "lighter";
      ctx.globalAlpha = (1 - k) * p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.kind === "grove") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin * p.age); ctx.ellipse(0, 0, p.size * 1.6, p.size * 0.7, 0, 0, Math.PI * 2); ctx.restore(); }
      else if (p.kind === "arcane") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4 + p.spin * p.age); ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore(); }
      else if (p.kind === "dust") ctx.ellipse(p.x, p.y, p.size * (1 + k * 1.6), p.size * (0.6 + k * 0.8), 0, 0, Math.PI * 2);
      else ctx.arc(p.x, p.y, p.size * (p.kind === "ember" ? 1 - k * 0.6 : 1), 0, Math.PI * 2);
      ctx.fill();
      if (p.kind !== "gold" && p.kind !== "dust") { ctx.globalAlpha = (1 - k) * 0.25 * p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i]; const k = Math.min(1, (now - a.start) / a.duration);
      for (let c = 0; c < a.count; c++) {
        const kk = Math.max(0, Math.min(1, k - c * 0.06)); if (kk <= 0) continue;
        const e = ease(kk);
        const x = a.from.x + (a.to.x - a.from.x) * e, y = a.from.y + (a.to.y - a.from.y) * e - Math.sin(kk * Math.PI) * 120 - c * 6;
        ctx.globalAlpha = 1; const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 11); g.addColorStop(0, "#fff3c8"); g.addColorStop(.5, "#f0c24a"); g.addColorStop(1, "#8a5a10");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = .55; ctx.fillStyle = "#ffe9b0"; ctx.beginPath(); ctx.arc(x - (a.to.x - a.from.x) * 0.02, y + 6, 3, 0, Math.PI * 2); ctx.fill();
      }
      if (k >= 1) { if (!a.landed) { a.landed = true; a.onLand?.(); spawn(a.to, "gold", 10, 90); } arcs.splice(i, 1); }
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]; const k = (now - e.start) / e.duration;
      if (k >= 1) { effects.splice(i, 1); continue; }
      if (k < 0) continue;
      ctx.save(); e.draw(ctx, k, now); ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; const k = (now - r.start) / 560; if (k >= 1) { ripples.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = r.color; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(r.x, r.y, 14 + k * 90, (14 + k * 90) * SQUASH, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (now < shakeUntil) { const s = (shakeUntil - now) / 600; host.style.transform = `translate(${(Math.random() - .5) * 10 * s}px, ${(Math.random() - .5) * 8 * s}px)`; } else if (host.style.transform) host.style.transform = "";
    if (particles.length || arcs.length || ripples.length || effects.length || ambients.size || now < shakeUntil) raf = requestAnimationFrame(tick); else { last = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  function request() { if (!raf && !destroyed) raf = requestAnimationFrame(tick); }
  function spawn(at: Point, kind: FxKind, count: number, speed: number, opts: Partial<Particle> & { squash?: number } = {}) {
    const colors = PALETTE[kind];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.9), sq = opts.squash ?? 1;
      particles.push({ x: at.x, y: at.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v * sq - (kind === "ember" ? speed * .4 : 0), life: 0.7 + Math.random() * 0.8, age: 0, size: 2 + Math.random() * (kind === "crown" ? 4 : 3), color: colors[i % colors.length], kind, spin: (Math.random() - .5) * 8, gravity: kind === "ember" ? -120 : kind === "grove" ? 60 : kind === "dust" ? 140 : 30, alpha: 0.95, ...opts });
    }
    request();
  }
  function add(duration: number, draw: Effect["draw"], delay = 0): Promise<void> {
    if (!reduced()) { effects.push({ start: performance.now() + delay, duration, draw }); request(); }
    return sleep(duration + delay);
  }
  /** 手掌剪影：掌心椭圆 + 五指胶囊，朝 heading 方向 */
  function drawHand(c: CanvasRenderingContext2D, at: Point, size: number, heading: number, closed: number, alpha: number) {
    c.save(); c.translate(at.x, at.y); c.rotate(heading); c.globalAlpha = alpha; c.fillStyle = "#1a0d0a"; c.strokeStyle = "rgba(239,227,200,.35)"; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(0, 0, size * 0.52, size * 0.62, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    const fingers = [-0.55, -0.2, 0.15, 0.5], len = size * (1.0 - closed * 0.55);
    for (const f of fingers) { c.save(); c.rotate(f * 0.55); c.beginPath(); c.roundRect(-size * 0.11, -size * 0.55 - len, size * 0.22, len + size * 0.1, size * 0.11); c.fill(); c.stroke(); c.restore(); }
    c.save(); c.rotate(-1.25); c.beginPath(); c.roundRect(-size * 0.12, -size * 0.3 - len * 0.6, size * 0.24, len * 0.6 + size * 0.1, size * 0.12); c.fill(); c.stroke(); c.restore();
    c.restore();
  }
  const sigilShape = (c: CanvasRenderingContext2D, kind: FxKind, r: number) => {
    c.beginPath();
    const n = kind === "ember" ? 3 : kind === "grove" ? 6 : kind === "arcane" ? 5 : kind === "crown" ? 8 : 0;
    if (n === 0) { for (let i = 0; i < 3; i++) { c.moveTo(-r + i * r * 0.5, 0); c.quadraticCurveTo(-r * 0.75 + i * r * 0.5, -r * 0.25, -r * 0.5 + i * r * 0.5, 0); } return; }
    const step = kind === "arcane" ? 2 : 1;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i * step % n) * Math.PI * 2 / n; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.closePath();
  };

  return {
    burst(point, kind, strength = 1) { if (reduced()) return; const at = local(point); spawn(at, kind, Math.round(46 * strength), 170 * strength); ripples.push({ x: at.x, y: at.y, start: performance.now(), color: PALETTE[kind][1] }); request(); },
    arc(from, to, count = 3, onLand, duration = 620) { if (reduced()) { setTimeout(() => onLand?.(), duration); return; } arcs.push({ from: local(from), to: local(to), start: performance.now(), duration, count: Math.max(1, Math.min(6, count)), onLand, landed: false }); request(); },
    ripple(point, color = "#ead38f") { if (reduced()) return; const at = local(point); ripples.push({ x: at.x, y: at.y, start: performance.now(), color }); request(); },
    shake(ms = 600) { if (reduced()) return; shakeUntil = performance.now() + ms; request(); },
    dust(point, size = 1) {
      if (reduced()) return; const at = local(point);
      spawn(at, "dust", Math.round(22 * size), 150 * size, { squash: SQUASH, alpha: 0.75, gravity: 90, life: 0.55 });
      void add(420, (c, k) => { c.globalAlpha = (1 - k) * 0.5; c.strokeStyle = "#b9a386"; c.lineWidth = 2.5 * (1 - k) + 0.5; c.beginPath(); c.ellipse(at.x, at.y, 10 + k * 80 * size, (10 + k * 80 * size) * SQUASH, 0, 0, Math.PI * 2); c.stroke(); });
    },
    beam(from, to, kind, duration = 700) {
      const a = local(from), b = local(to), colors = PALETTE[kind];
      return add(duration, (c, k) => {
        const e = ease(k); const lift = Math.sin(k * Math.PI) * 60;
        for (let i = 0; i < 12; i++) { const kk = Math.max(0, e - i * 0.035); const x = a.x + (b.x - a.x) * kk, y = a.y + (b.y - a.y) * kk - Math.sin(kk * Math.PI) * 60; c.globalAlpha = (1 - i / 12) * 0.9; c.fillStyle = colors[i % colors.length]; c.beginPath(); c.arc(x, y, 7 - i * 0.4, 0, Math.PI * 2); c.fill(); }
        if (k > 0.1 && Math.random() < 0.6) particles.push({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - lift, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, life: 0.4, age: 0, size: 2, color: colors[1], kind, spin: 0, gravity: 20, alpha: 0.8 });
        if (k > 0.96) spawn(b, kind, 18, 120);
      });
    },
    ring(point, kind, radius = 90, duration = 700) {
      const at = local(point), color = PALETTE[kind][1];
      return add(duration, (c, k) => { const r = 12 + ease(k) * radius; c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = color; c.lineWidth = 4 * (1 - k) + 1; c.beginPath(); c.ellipse(at.x, at.y, r, r * SQUASH, 0, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; c.globalAlpha = (1 - k) * 0.5; c.beginPath(); c.ellipse(at.x, at.y, r * 0.7, r * 0.7 * SQUASH, 0, 0, Math.PI * 2); c.stroke(); });
    },
    sigil(point, kind, radius = 110, duration = 1400) {
      const at = local(point), colors = PALETTE[kind];
      if (!reduced()) spawn(at, kind, 30, 60, { squash: SQUASH });
      return add(duration, (c, k, now) => {
        const a = envelope(k, 0.18, 0.3), grow = 0.7 + ease(Math.min(1, k * 3)) * 0.3, r = radius * grow;
        c.translate(at.x, at.y); c.scale(1, SQUASH); c.globalAlpha = a * 0.95; c.strokeStyle = colors[1]; c.lineWidth = 2.2;
        for (const f of [1, 0.82, 0.5]) { c.beginPath(); c.arc(0, 0, r * f, 0, Math.PI * 2); c.stroke(); }
        c.save(); c.rotate(now / 2600); for (let i = 0; i < 24; i++) { const ang = i * Math.PI / 12, l = i % 3 === 0 ? 14 : 7; c.beginPath(); c.moveTo(Math.cos(ang) * (r * 0.82 + 2), Math.sin(ang) * (r * 0.82 + 2)); c.lineTo(Math.cos(ang) * (r * 0.82 + 2 + l), Math.sin(ang) * (r * 0.82 + 2 + l)); c.stroke(); } c.restore();
        c.save(); c.rotate(-now / 3800); c.lineWidth = 1.8; c.strokeStyle = colors[0]; sigilShape(c, kind, r * 0.5); c.stroke(); c.restore();
        c.globalAlpha = a * 0.22; c.fillStyle = colors[2]; c.beginPath(); c.arc(0, 0, r * 0.5, 0, Math.PI * 2); c.fill();
      });
    },
    grab(from, to, kind, duration = 1100) {
      const a = local(from), b = local(to), heading = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      return add(duration, (c, k) => {
        const out = Math.min(1, k / 0.42), back = k > 0.62 ? (k - 0.62) / 0.38 : 0, closed = k > 0.42 && k < 0.62 ? (k - 0.42) / 0.2 : k >= 0.62 ? 1 : 0;
        const e = back ? 1 - ease(back) : ease(out);
        const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * 30;
        drawHand(c, { x, y }, 34, heading, closed, 0.85 * envelope(k, 0.1, 0.15));
        if (closed > 0 && closed < 1 && Math.random() < 0.5) spawn(b, kind, 4, 80);
      });
    },
    swap(aPoint, bPoint, kindA, kindB, duration = 900) {
      const a = local(aPoint), b = local(bPoint);
      return add(duration, (c, k) => {
        const e = ease(k);
        for (const [from, to, kind, sign] of [[a, b, kindA, -1], [b, a, kindB, 1]] as const) {
          const colors = PALETTE[kind];
          for (let i = 0; i < 10; i++) { const kk = Math.max(0, e - i * 0.04); const x = from.x + (to.x - from.x) * kk, y = from.y + (to.y - from.y) * kk + sign * Math.sin(kk * Math.PI) * 70; c.globalAlpha = (1 - i / 10) * 0.9; c.fillStyle = colors[i % colors.length]; c.beginPath(); c.arc(x, y, 8 - i * 0.5, 0, Math.PI * 2); c.fill(); }
        }
        if (k > 0.95) { spawn(a, kindB, 14, 110); spawn(b, kindA, 14, 110); }
      });
    },
    pulse(rect, kind, duration = 1100) {
      const r = localRect(rect), colors = PALETTE[kind];
      return add(duration, (c, k) => {
        const wave = 0.5 + 0.5 * Math.sin(k * Math.PI * 6), grow = 6 + wave * 10;
        c.globalAlpha = envelope(k, 0.1, 0.25) * (0.45 + wave * 0.45); c.strokeStyle = colors[0]; c.lineWidth = 3;
        c.beginPath(); c.roundRect(r.x - grow, r.y - grow, r.w + grow * 2, r.h + grow * 2, 12); c.stroke();
        c.globalAlpha *= 0.35; c.fillStyle = colors[1]; c.fill();
        if (Math.random() < 0.5) { const side = Math.random(); const x = side < 0.5 ? r.x + Math.random() * r.w : (side < 0.75 ? r.x : r.x + r.w), y = side < 0.5 ? (Math.random() < 0.5 ? r.y : r.y + r.h) : r.y + Math.random() * r.h; particles.push({ x, y, vx: 0, vy: -40, life: 0.6, age: 0, size: 2.5, color: colors[1], kind, spin: 0, gravity: -30, alpha: 0.9 }); }
      });
    },
    claw(point, kind = "ember", duration = 700) {
      const at = local(point), color = PALETTE[kind][0];
      return add(duration, (c, k) => {
        c.strokeStyle = color; c.lineCap = "round";
        for (let i = 0; i < 3; i++) { const kk = Math.max(0, Math.min(1, (k - i * 0.1) / 0.35)); if (kk <= 0) continue; c.globalAlpha = (1 - Math.max(0, (k - 0.5) / 0.5)) * 0.95; c.lineWidth = 4 - i * 0.6; const ox = (i - 1) * 22; c.beginPath(); c.moveTo(at.x + ox - 36, at.y - 60); c.lineTo(at.x + ox - 36 + 72 * kk, at.y - 60 + 120 * kk); c.stroke(); }
        if (k < 0.5 && Math.random() < 0.6) spawn(at, kind, 2, 150);
      });
    },
    flare(point, kind, duration = 1100) {
      const at = local(point), colors = PALETTE[kind];
      if (!reduced()) { spawn(at, kind, 110, 260); spawn(at, kind, 40, 120, { squash: SQUASH }); ripples.push({ x: at.x, y: at.y, start: performance.now(), color: colors[1] }); }
      return add(duration, (c, k) => {
        c.translate(at.x, at.y); c.globalAlpha = envelope(k, 0.08, 0.5) * 0.9; c.strokeStyle = colors[2]; c.lineWidth = 2;
        for (let i = 0; i < 14; i++) { const ang = i * Math.PI * 2 / 14 + k * 0.6, len = 60 + ease(k) * 160 * ((i % 2) ? 0.7 : 1); c.beginPath(); c.moveTo(Math.cos(ang) * 18, Math.sin(ang) * 18 * SQUASH); c.lineTo(Math.cos(ang) * len, Math.sin(ang) * len * SQUASH); c.stroke(); }
        c.globalAlpha = (1 - k) * 0.8; c.strokeStyle = colors[1]; c.lineWidth = 5 * (1 - k) + 1; const r = 20 + ease(k) * 200; c.beginPath(); c.ellipse(0, 0, r, r * SQUASH, 0, 0, Math.PI * 2); c.stroke();
      });
    },
    slap(point) {
      const at = local(point);
      const done = add(700, (c, k) => {
        const fall = Math.min(1, k / 0.22), s = 1.9 - ease(fall) * 0.9, alpha = k < 0.22 ? 0.6 + fall * 0.35 : 0.95 * (1 - (k - 0.22) / 0.78);
        drawHand(c, { x: at.x, y: at.y - (1 - fall) * 40 }, 46 * s, 0, 0, alpha);
      });
      setTimeout(() => { if (!reduced()) { this.dust(point, 1.3); this.ripple(point); } }, 160);
      return done;
    },
    ambient(id, spec) { if (spec) { ambients.set(id, { ...spec, area: spec.area ? localRect(spec.area) : null }); request(); } else ambients.delete(id); },
    destroy() { destroyed = true; if (raf) cancelAnimationFrame(raf); observer.disconnect(); host.style.transform = ""; ambients.clear(); },
  };
}
