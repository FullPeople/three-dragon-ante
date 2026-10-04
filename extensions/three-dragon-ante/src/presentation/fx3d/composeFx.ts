/** 把 three.js 图元接到现有 FxLayer 接口上：有舞台时 sigil / ring / beam / burst / flare 走 three，
 *  其余（金币 DOM 精灵、拍桌、尘土、抓取、交换、划痕、环境粒子…）仍走 2D 贴图层，逐步替换。
 *  没有舞台（WebGL 不可用 / 减少动态 / 用户关掉 / 软件 GL）→ 原样返回 2D 层，presenter 零改动。 */
import type { FxLayer, Point } from "../fx/particles";
import type { FxStage } from "./FxStage";
import { GroundMark } from "./primitives/GroundMark";
import { Pillar } from "./primitives/Pillar";
import { Burst } from "./primitives/Burst";
import { Beam } from "./primitives/Beam";

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function composeFx(fx2d: FxLayer, stage: FxStage | null): FxLayer {
  if (!stage || !stage.ground) return fx2d;
  const plane = (p: Point) => stage.toPlane(p);
  const low = stage.tier === "low", k = low ? 0.5 : stage.tier === "medium" ? 0.75 : 1;
  return {
    ...fx2d,
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
    destroy() { fx2d.destroy(); },
  };
}
