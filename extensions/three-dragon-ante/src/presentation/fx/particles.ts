/** 一个全屏 2D 画布，只画有限时长的粒子与金币弧线。没有空闲循环：队列空了就停。 */
export type FxKind = "ember" | "tide" | "grove" | "arcane" | "crown" | "gold";
interface Particle { x: number; y: number; vx: number; vy: number; life: number; age: number; size: number; color: string; kind: FxKind; spin: number }
interface Arc { from: { x: number; y: number }; to: { x: number; y: number }; start: number; duration: number; color: string; count: number; onLand?: () => void; landed: boolean }

const PALETTE: Record<FxKind, string[]> = {
  ember: ["#ff7a45", "#ffb08d", "#ffd9a0", "#ff4d1a"],
  tide: ["#6fb7e6", "#b9e1f4", "#dff6ff", "#3f8fc9"],
  grove: ["#8bc46a", "#c6e4a4", "#e9f7d2", "#5f9a46"],
  arcane: ["#c79bff", "#ead8ff", "#fff0ff", "#9b6bdf"],
  crown: ["#ffd36b", "#ffe2a2", "#fff6d8", "#e0a62a"],
  gold: ["#ffd36b", "#ffe9b0", "#e0a62a"],
};

export interface FxLayer { burst(point: { x: number; y: number }, kind: FxKind, strength?: number): void; arc(from: { x: number; y: number }, to: { x: number; y: number }, count?: number, onLand?: () => void, duration?: number): void; ripple(point: { x: number; y: number }, color?: string): void; shake(ms?: number): void; destroy(): void }

export function mountFx(canvas: HTMLCanvasElement, host: HTMLElement): FxLayer {
  const ctx = canvas.getContext("2d");
  const particles: Particle[] = [], arcs: Arc[] = [], ripples: { x: number; y: number; start: number; color: string }[] = [];
  let raf = 0, last = 0, destroyed = false, shakeUntil = 0;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function resize() { const rect = host.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; ctx?.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  function local(point: { x: number; y: number }) { const rect = host.getBoundingClientRect(); return { x: point.x - rect.left, y: point.y - rect.top }; }
  function tick(now: number) {
    raf = 0; if (destroyed || !ctx) return;
    const dt = Math.min(48, now - (last || now)) / 1000; last = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter";
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt; if (p.age >= p.life) { particles.splice(i, 1); continue; }
      const k = p.age / p.life; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === "ember" ? -120 : p.kind === "grove" ? 60 : 30) * dt; p.vx *= 0.985;
      ctx.globalAlpha = (1 - k) * 0.95; ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.kind === "grove") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin * p.age); ctx.ellipse(0, 0, p.size * 1.6, p.size * 0.7, 0, 0, Math.PI * 2); ctx.restore(); }
      else if (p.kind === "arcane") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4 + p.spin * p.age); ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore(); }
      else ctx.arc(p.x, p.y, p.size * (p.kind === "ember" ? 1 - k * 0.6 : 1), 0, Math.PI * 2);
      ctx.fill();
      if (p.kind !== "gold") { ctx.globalAlpha = (1 - k) * 0.25; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2); ctx.fill(); }
    }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i]; const k = Math.min(1, (now - a.start) / a.duration);
      for (let c = 0; c < a.count; c++) {
        const kk = Math.max(0, Math.min(1, k - c * 0.06)); if (kk <= 0) continue;
        const e = kk * kk * (3 - 2 * kk);
        const x = a.from.x + (a.to.x - a.from.x) * e, y = a.from.y + (a.to.y - a.from.y) * e - Math.sin(kk * Math.PI) * 120 - c * 6;
        ctx.globalAlpha = 1; const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 11); g.addColorStop(0, "#fff3c8"); g.addColorStop(.5, "#f0c24a"); g.addColorStop(1, "#8a5a10");
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = .55; ctx.fillStyle = "#ffe9b0"; ctx.beginPath(); ctx.arc(x - (a.to.x - a.from.x) * 0.02, y + 6, 3, 0, Math.PI * 2); ctx.fill();
      }
      if (k >= 1) { if (!a.landed) { a.landed = true; a.onLand?.(); spawn(a.to, "gold", 10, 90); } arcs.splice(i, 1); }
    }
    ctx.globalCompositeOperation = "source-over";
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; const k = (now - r.start) / 560; if (k >= 1) { ripples.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - k) * .8; ctx.strokeStyle = r.color; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, 14 + k * 90, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (now < shakeUntil) { const s = (shakeUntil - now) / 600; host.style.transform = `translate(${(Math.random() - .5) * 10 * s}px, ${(Math.random() - .5) * 8 * s}px)`; } else if (host.style.transform) host.style.transform = "";
    if (particles.length || arcs.length || ripples.length || now < shakeUntil) raf = requestAnimationFrame(tick); else { last = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  function request() { if (!raf && !destroyed) raf = requestAnimationFrame(tick); }
  function spawn(at: { x: number; y: number }, kind: FxKind, count: number, speed: number) {
    const colors = PALETTE[kind];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.9);
      particles.push({ x: at.x, y: at.y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - (kind === "ember" ? speed * .4 : 0), life: 0.7 + Math.random() * 0.8, age: 0, size: 2 + Math.random() * (kind === "crown" ? 4 : 3), color: colors[i % colors.length], kind, spin: (Math.random() - .5) * 8 });
    }
    request();
  }
  return {
    burst(point, kind, strength = 1) { if (reduced()) return; const at = local(point); spawn(at, kind, Math.round(46 * strength), 170 * strength); ripples.push({ x: at.x, y: at.y, start: performance.now(), color: PALETTE[kind][1] }); request(); },
    arc(from, to, count = 3, onLand, duration = 620) { if (reduced()) { setTimeout(() => onLand?.(), duration); return; } arcs.push({ from: local(from), to: local(to), start: performance.now(), duration, color: "#ffd36b", count: Math.max(1, Math.min(6, count)), onLand, landed: false }); request(); },
    ripple(point, color = "#ead38f") { if (reduced()) return; const at = local(point); ripples.push({ x: at.x, y: at.y, start: performance.now(), color }); request(); },
    shake(ms = 600) { if (reduced()) return; shakeUntil = performance.now() + ms; request(); },
    destroy() { destroyed = true; if (raf) cancelAnimationFrame(raf); observer.disconnect(); host.style.transform = ""; },
  };
}
