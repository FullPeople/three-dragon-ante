/** 图元工具箱：家族脚本用平面坐标说话，这里把图元的构造细节与档位缩放收起来。 */
import type { FxKind } from "../fx/particles";
import type { FxStage } from "./FxStage";
import { GroundMark, type GlyphForm } from "./primitives/GroundMark";
import { Pillar } from "./primitives/Pillar";
import { Burst, type BurstOptions } from "./primitives/Burst";
import { Beam } from "./primitives/Beam";
import { Emitter, type EmitterOptions } from "./primitives/Emitter";
import { Shell } from "./primitives/Shell";
import { Collar } from "./primitives/Collar";

export interface P { x: number; y: number }

export class Kit {
  constructor(readonly stage: FxStage) {}
  /** 粒子数系数：随自适应降档动态变化 */
  get k() { const t = this.stage.tier; return t === "low" ? 0.5 : t === "medium" ? 0.75 : 1; }
  get tier() { return this.stage.tier; }
  /** 冲击壳（爆发核心）；squash < 1 压成贴地圆顶 */
  shell(p: P, z: number, o: { kind: FxKind; r1: number; r0?: number; duration: number; squash?: number }) { return new Shell(this.stage, p.x, p.y, z, o); }
  /** 站立光环（可驻留：duration 0 → release()） */
  collar(p: P, o: { kind: FxKind; radius: number; height: number; duration: number; ticks?: number; pulse?: number }) { return new Collar(this.stage, p.x, p.y, o); }
  /** 法阵（mode 0，可驻留）；form 决定星角 / 肋 / 钩 / 刻度 / 菱 */
  mark(p: P, o: { kind: FxKind; radius: number; duration: number; form?: Partial<GlyphForm>; seed?: number }) { return new GroundMark(this.stage, p.x, p.y, { kind: o.kind, radius: o.radius, duration: o.duration, mode: 0, form: o.form, seed: o.seed }); }
  ring(p: P, o: { kind: FxKind; radius: number; duration: number }) { return new GroundMark(this.stage, p.x, p.y, { kind: o.kind, radius: o.radius, duration: o.duration, mode: 1 }); }
  claw(p: P, o: { kind: FxKind; radius?: number; duration?: number }) { return new GroundMark(this.stage, p.x, p.y, { kind: o.kind, radius: o.radius ?? 95, duration: o.duration ?? 700, mode: 2 }); }
  pillar(p: P, o: { kind: FxKind; height: number; width: number; duration: number }) { return new Pillar(this.stage, p.x, p.y, o); }
  burst(p: P, z: number, o: BurstOptions) { return new Burst(this.stage, p.x, p.y, z, { ...o, count: Math.max(4, Math.round(o.count * this.k)) }); }
  beam(a: P, b: P, o: { kind: FxKind; duration: number; lift?: number; width?: number; tail?: number; z?: number }) { return new Beam(this.stage, { ...a, z: o.z }, { ...b, z: o.z }, o); }
  emitter(area: { x: number; y: number; w: number; h: number }, o: EmitterOptions) { return new Emitter(this.stage, area, { ...o, rate: o.rate * this.k }); }
  /** 光束到达后在终点爆发（命中） */
  strike(a: P, b: P, o: { kind: FxKind; duration: number; lift?: number; width?: number; impact?: number; impactZ?: number }) {
    this.beam(a, b, { kind: o.kind, duration: o.duration, lift: o.lift, width: o.width });
    this.stage.schedule(() => this.burst(b, o.impactZ ?? 30, { kind: o.kind, count: Math.round(22 * (o.impact ?? 1)), speed: 210 * (o.impact ?? 1), up: 0.75, size: 32, life: 0.7 }), o.duration * 0.68);
  }
  /** 多目标齐射：错开 stagger 毫秒 */
  async volley(from: P, targets: (P | null)[], o: { kind: FxKind; duration: number; stagger?: number; lift?: number; width?: number; impact?: number; impactZ?: number }) {
    const ps = targets.filter((t): t is P => !!t);
    const stagger = Math.min(o.stagger ?? 110, Math.max(40, 420 / Math.max(1, ps.length)));
    ps.forEach((t, i) => this.stage.schedule(() => this.strike(from, t, o), i * stagger));
    await this.stage.wait(o.duration + ps.length * stagger);
  }
}
