/** 把 three.js 图元接到现有 FxLayer 接口上：有舞台时 sigil / ring / beam / burst / flare 走 three，
 *  其余（金币 DOM 精灵、拍桌、尘土、抓取、交换、划痕、环境粒子…）仍走 2D 贴图层，逐步替换。
 *  没有舞台（WebGL 不可用 / 减少动态 / 用户关掉 / 软件 GL）→ 原样返回 2D 层，presenter 零改动。 */
import type { FxLayer, Point } from "../fx/particles";
import type { FxStage } from "./FxStage";
import { GroundMark } from "./primitives/GroundMark";
import { Pillar } from "./primitives/Pillar";
import { Burst } from "./primitives/Burst";
import { Beam } from "./primitives/Beam";
import { Emitter } from "./primitives/Emitter";

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function composeFx(fx2d: FxLayer, stage: FxStage | null): FxLayer {
  if (!stage || !stage.ground) return fx2d;
  const plane = (p: Point) => stage.toPlane(p);
  const low = stage.tier === "low", k = low ? 0.5 : stage.tier === "medium" ? 0.75 : 1;
  const ambients = new Map<string, Emitter>();
  return {
    ...fx2d,
    // 落地尘土：贴地的实体烟尘横向铺开 + 小扩散环
    dust(point, size = 1) {
      const p = plane(point);
      new Burst(stage, p.x, p.y, 4, { kind: "dust", count: Math.round(26 * size * k), speed: 170 * size, up: 0.22, gravity: 260, drag: 3.2, size: 48 * size, life: 0.7, solid: true, sprites: ["dirt_01", "smoke_01", "dirt_02"] });
      new GroundMark(stage, p.x, p.y, { kind: "dust", radius: 70 * size, duration: 420, mode: 1 });
    },
    // 抓取：目标处爪痕 + 反向飘带把东西拉回源头，源头处爆发
    grab(from, to, kind, duration = 1000) {
      const a = plane(from), b = plane(to);
      new GroundMark(stage, b.x, b.y, { kind: "ember", radius: 80, duration: duration * 0.7, mode: 2 });
      setTimeout(() => { new Beam(stage, b, a, { kind, duration: duration * 0.6, lift: 70, width: 20 }); }, duration * 0.3);
      setTimeout(() => new Burst(stage, a.x, a.y, 30, { kind, count: Math.round(28 * k), speed: 220, up: 0.8, size: 34, life: 0.8 }), duration * 0.72);
      return wait(duration);
    },
    // 交换：两道飘带交叉对飞（一高一低），各自到站爆发
    swap(a, b, kindA, kindB, duration = 900) {
      const pa = plane(a), pb = plane(b);
      new Beam(stage, pa, pb, { kind: kindA, duration, lift: 150, width: 18 });
      new Beam(stage, pb, pa, { kind: kindB, duration, lift: 60, width: 18 });
      setTimeout(() => { new Burst(stage, pb.x, pb.y, 30, { kind: kindA, count: Math.round(20 * k), speed: 200, up: 0.8, size: 30, life: 0.7 }); new Burst(stage, pa.x, pa.y, 30, { kind: kindB, count: Math.round(20 * k), speed: 200, up: 0.8, size: 30, life: 0.7 }); }, duration * 0.68);
      return wait(duration);
    },
    // 爪痕：三道划痕 + 余烬
    claw(point, kind = "ember", duration = 700) {
      const p = plane(point);
      new GroundMark(stage, p.x, p.y, { kind, radius: 95, duration, mode: 2 });
      setTimeout(() => new Burst(stage, p.x, p.y, 8, { kind, count: Math.round(18 * k), speed: 140, up: 0.9, size: 26, life: 0.7 }), duration * 0.25);
      return wait(duration);
    },
    // 持续环境粒子（等待选择 / 场地）：GPU 循环发射器；传 null 淡出
    ambient(id, spec) {
      const old = ambients.get(id); if (old) { old.release(); ambients.delete(id); }
      if (!spec) return;
      const s = stage.metrics().scale;
      const r = spec.area; let area: { x: number; y: number; w: number; h: number };
      if (r) { const p1 = plane({ x: r.x, y: r.y }), p2 = plane({ x: r.x + r.w, y: r.y + r.h }); area = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) }; }
      else { const m = stage.metrics(); area = { x: m.planeW / 2, y: m.planeH / 2, w: m.planeW * 0.8, h: m.planeH * 0.8 }; }
      ambients.set(id, new Emitter(stage, area, { kind: spec.kind, rate: spec.rate * k, life: spec.life, drift: { x: spec.drift.x / s, y: 0, z: -spec.drift.y / s }, size: 14 * spec.size, alpha: spec.alpha ?? 0.75 }));
    },
    sigil(point, kind, radius = 120, duration = 1400) {
      const p = plane(point);
      new GroundMark(stage, p.x, p.y, { kind, radius, duration });
      new Pillar(stage, p.x, p.y, { kind, height: radius * 2.2, width: radius * 1.1, duration: duration * 0.9 });
      new Burst(stage, p.x, p.y, 10, { kind, count: Math.round(36 * k), speed: 150, up: 0.95, gravity: 420, size: 34, life: 1.2 });
      return wait(duration);
    },
    ring(point, kind, radius = 160, duration = 700) { const p = plane(point); new GroundMark(stage, p.x, p.y, { kind, radius, duration, mode: 1 }); return wait(duration); },
    beam(from, to, kind, duration = 600) {
      const a = plane(from), b = plane(to);
      new Beam(stage, a, b, { kind, duration, width: 14 * (low ? 0.8 : 1) });
      setTimeout(() => new Burst(stage, b.x, b.y, 30, { kind, count: Math.round(22 * k), speed: 200, up: 0.7, size: 32, life: 0.7 }), duration * 0.68);
      return wait(duration);
    },
    burst(point, kind, strength = 1) { const p = plane(point); new Burst(stage, p.x, p.y, 20, { kind, count: Math.round(26 * strength * k), speed: 230 * strength, up: 0.8, size: 38, life: 0.9 }); },
    flare(point, kind, duration = 800) {
      const p = plane(point);
      new GroundMark(stage, p.x, p.y, { kind, radius: 100, duration: duration * 0.9, mode: 1 });
      new Pillar(stage, p.x, p.y, { kind, height: 300, width: 150, duration });
      new Burst(stage, p.x, p.y, 20, { kind, count: Math.round(64 * k), speed: 290, up: 0.9, size: 40, life: 1.0 });
      return wait(duration);
    },
    destroy() { for (const e of ambients.values()) e.release(); ambients.clear(); fx2d.destroy(); },
  };
}
