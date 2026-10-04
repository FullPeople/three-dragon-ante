/** 把 three.js 图元接到现有 FxLayer 接口上：有舞台时 sigil / ring / beam / burst / flare 走 three，
 *  其余（金币 DOM 精灵、拍桌、尘土、抓取、交换、划痕、环境粒子…）仍走 2D 贴图层，逐步替换。
 *  没有舞台（WebGL 不可用 / 减少动态 / 用户关掉 / 软件 GL）→ 原样返回 2D 层，presenter 零改动。 */
import type { FxKind, FxLayer, Point } from "../fx/particles";
import type { FxStage } from "./FxStage";
import { GroundMark } from "./primitives/GroundMark";
import { Pillar } from "./primitives/Pillar";
import { Burst } from "./primitives/Burst";
import { Beam } from "./primitives/Beam";
import { Shell } from "./primitives/Shell";
import { Collar } from "./primitives/Collar";
import { Emitter } from "./primitives/Emitter";
import type { GlyphForm } from "./primitives/GroundMark";
import { Kit } from "./kit";
import { palette } from "./palette";
import { FAMILY_SCRIPTS, defaultScript } from "./scripts/families";
import type { ScriptCtx } from "./scripts/types";
import { familyFx, isLegendary } from "../fx/powers";
import { card } from "../../game/rules/cards";

export function composeFx(fx2d: FxLayer, stage: FxStage | null): FxLayer {
  if (!stage || !stage.ground) return fx2d;
  const plane = (p: Point) => stage.toPlane(p);
  const kOf = () => stage.tier === "low" ? 0.5 : stage.tier === "medium" ? 0.75 : 1;
  const lowNow = () => stage.tier === "low";
  // 驻留态（等待选择 / 场地）：发射器 + 可选的驻留法阵 + 可选的系绳飘带循环
  interface Hold { emitter: Emitter | null; marks: GroundMark[]; collar: Collar | null; tether: (() => void) | null }
  const ambients = new Map<string, Hold>();
  const releaseHold = (h: Hold) => { h.emitter?.release(); for (const m of h.marks) m.release(); h.collar?.release(); h.tether?.(); };
  const domPoint = (selector: string): { x: number; y: number } | null => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r ? plane({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : null; };
  // 等待选择的形态：按选择码分 索要 / 去向 / 顺序 / 挑牌
  const holdForm = (code: string): Partial<GlyphForm> => {
    if (/GIVE|PAY|GOLD|DEMAND/.test(code)) return { points: 0, ticks: 24, ribs: 0 };
    if (/DESTINATION/.test(code)) return { points: 2, ticks: 0, ribs: 0 };
    if (/ORDER|NEXT_GOOD/.test(code)) return { points: 5, sharp: true, ticks: 0, ribs: 5 };
    return { points: 6, rhombus: true, ticks: 12, ribs: 0 };
  };
  // 牌阵 / 传说到场的法阵形态（presenter 只给 kind 与半径：170 = 牌阵，150 = 传说到场）
  const sigilForm = (kind: FxKind, radius: number): Partial<GlyphForm> | undefined => {
    if (radius >= 165) return kind === "tide" ? { points: 4, sharp: true, rhombus: true, ribs: 0, ticks: 0 } : kind === "arcane" ? { points: 5, rhombus: true, ribs: 10, ticks: 10 } : { points: 12, sharp: true, ticks: 24, ribs: 0 };
    if (radius >= 140) return { points: 7, ribs: 14, ticks: 28, hooks: true };
    return undefined;
  };
  const kit = new Kit(stage);
  let destroyed = false;
  const removeUnavailable = stage.onUnavailable(() => { for (const hold of ambients.values()) releaseHold(hold); ambients.clear(); });
  const wait = (ms: number) => stage.wait(ms);
  const composed: FxLayer = {
    ...fx2d,
    // 家族脚本：把 PowerFxContext 的视口像素锚点换成平面坐标，交给家族专属编排
    async script(cue, events, ctx) {
      const src = ctx.cardPoint(cue.cardId); if (!src) return false;
      const kind = familyFx(cue.family), legendary = isLegendary(cue.cardId);
      let strength = 0.6; try { const v = card(cue.cardId); if (v.category === "standard") strength = Math.max(0, Math.min(1, (v.strength - 1) / 12)); } catch { /* 未知牌 */ }
      const pt = (p: Point | null) => p ? plane(p) : null;
      const c: ScriptCtx = {
        stage, kit, cue, events, kind, palette: palette(kind), tier: stage.tier, source: plane(src), strength, legendary,
        targets: cue.targetSeatIds ?? [], others: ctx.seatIds.filter(id => id !== cue.seatId), self: cue.seatId,
        cardPoint: id => pt(ctx.cardPoint(id)), handPoint: id => pt(ctx.handPoint(id)), coinsPoint: id => pt(ctx.coinsPoint(id)), seatPoint: id => pt(ctx.seatPoint(id)), pile: id => pt(ctx.pile(id)),
        seg: code => events.filter(e => e.code === code), sound: (kind, key) => { if (stage.available && !destroyed) ctx.sound(kind, key); }, wait,
      };
      const s = FAMILY_SCRIPTS[cue.family ?? ""] ?? defaultScript;
      try { await s.cast(c); } catch (err) { console.error("fx3d family script failed", cue.family, err); }
      return true;
    },
    // 落地尘土：贴地的实体烟尘横向铺开 + 小扩散环
    dust(point, size = 1) {
      const p = plane(point);
      new Burst(stage, p.x, p.y, 4, { kind: "dust", count: Math.round(26 * size * kOf()), speed: 170 * size, up: 0.22, gravity: 260, drag: 3.2, size: 48 * size, life: 0.7, solid: true, sprites: ["dirt_01", "smoke_01", "dirt_02"] });
      new GroundMark(stage, p.x, p.y, { kind: "dust", radius: 70 * size, duration: 420, mode: 1 });
    },
    // 抓取：目标处爪痕 + 反向飘带把东西拉回源头，源头处爆发
    grab(from, to, kind, duration = 1000) {
      const a = plane(from), b = plane(to);
      new GroundMark(stage, b.x, b.y, { kind: "ember", radius: 80, duration: duration * 0.7, mode: 2 });
      stage.schedule(() => { new Beam(stage, b, a, { kind, duration: duration * 0.6, lift: 70, width: 20 }); }, duration * 0.3);
      stage.schedule(() => new Burst(stage, a.x, a.y, 30, { kind, count: Math.round(28 * kOf()), speed: 220, up: 0.8, size: 34, life: 0.8 }), duration * 0.72);
      return wait(duration);
    },
    // 交换：两道飘带交叉对飞（一高一低），各自到站爆发
    swap(a, b, kindA, kindB, duration = 900) {
      const pa = plane(a), pb = plane(b);
      new Beam(stage, pa, pb, { kind: kindA, duration, lift: 150, width: 18 });
      new Beam(stage, pb, pa, { kind: kindB, duration, lift: 60, width: 18 });
      stage.schedule(() => { new Burst(stage, pb.x, pb.y, 30, { kind: kindA, count: Math.round(20 * kOf()), speed: 200, up: 0.8, size: 30, life: 0.7 }); new Burst(stage, pa.x, pa.y, 30, { kind: kindB, count: Math.round(20 * kOf()), speed: 200, up: 0.8, size: 30, life: 0.7 }); }, duration * 0.68);
      return wait(duration);
    },
    // 爪痕：三道划痕 + 余烬
    claw(point, kind = "ember", duration = 700) {
      const p = plane(point);
      new GroundMark(stage, p.x, p.y, { kind, radius: 95, duration, mode: 2 });
      stage.schedule(() => new Burst(stage, p.x, p.y, 8, { kind, count: Math.round(18 * kOf()), speed: 140, up: 0.9, size: 26, life: 0.7 }), duration * 0.25);
      return wait(duration);
    },
    // 持续环境粒子（等待选择 / 场地）：GPU 循环发射器；传 null 淡出
    ambient(id, spec) {
      const old = ambients.get(id); if (old) { releaseHold(old); ambients.delete(id); }
      if (!spec) return;
      const s = stage.metrics().scale;
      const r = spec.area; let area: { x: number; y: number; w: number; h: number };
      if (r) { const p1 = plane({ x: r.x, y: r.y }), p2 = plane({ x: r.x + r.w, y: r.y + r.h }); area = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) }; }
      else { const m = stage.metrics(); area = { x: m.planeW / 2, y: m.planeH / 2, w: m.planeW * 0.8, h: m.planeH * 0.8 }; }
      const drift = { x: spec.drift.x / s, y: 0, z: -spec.drift.y / s };
      const k = kOf();
      const hold: Hold = { emitter: null, marks: [], collar: null, tether: null };
      const markR = Math.max(90, Math.min(220, Math.max(area.w, area.h) * 0.55));
      if (spec.hold) {
        // 等待选择：等自己 → 本家手牌下暖色驻留法阵 + 更密的上升粒子；等对手 → 对手手牌下法阵 + 源牌到等待者的系绳飘带
        const self = spec.hold.who === "self";
        hold.marks.push(new GroundMark(stage, area.x, area.y, { kind: spec.kind, radius: markR, duration: 0, form: holdForm(spec.hold.code) }));
        hold.emitter = new Emitter(stage, area, { kind: spec.kind, rate: spec.rate * k * (self ? 3 : 1.6), life: spec.life, drift, size: 14 * spec.size, alpha: spec.alpha ?? 0.75 });
        if (self) hold.collar = new Collar(stage, area.x, area.y, { kind: spec.kind, radius: markR * 0.9, height: 90, duration: 0, ticks: /GIVE|PAY|GOLD|DEMAND/.test(spec.hold.code) ? 24 : 0, pulse: 1.2 });
        if (!self && spec.hold.from) {
          const from = plane(spec.hold.from), to = { x: area.x, y: area.y };
          const fire = () => new Beam(stage, { ...from, z: 30 }, { ...to, z: 30 }, { kind: spec.kind, duration: 1300, lift: 60, width: 9, tail: 0.6 });
          fire(); hold.tether = stage.repeat(fire, 1400);
        }
        if (/DESTINATION/.test(spec.hold.code)) { const st = domPoint('[data-pile="stakes"]'); if (st) hold.marks.push(new GroundMark(stage, st.x, st.y + 20, { kind: "gold", radius: 110, duration: 0, form: { points: 0, ticks: 16, ribs: 0 } })); }
      } else if (spec.field) {
        // 场地持续效果按种类：德鲁伊落叶 + 藤纹；祭司暖光上升 + 四角印；龙巫妖磷火 + 骨色钩印；大法师秘法刻度环；其余小印 + 粒子
        const f = spec.field;
        const sprites = f === "druid" ? ["star_01", "twirl_01"] as const : f === "dracolich" ? ["smoke_06", "magic_05"] as const : f === "priest" ? ["light_02", "star_05"] as const : undefined;
        const z0 = f === "druid" || f === "dracolich" ? 160 : 0;
        hold.emitter = new Emitter(stage, area, { kind: spec.kind, rate: spec.rate * k * 1.5, life: spec.life, drift: z0 ? { x: drift.x, y: 0, z: -Math.abs(drift.z) - 20 } : drift, size: 14 * spec.size, alpha: spec.alpha ?? 0.7, sprites: sprites ? [...sprites] : undefined, z0 });
        const form: Partial<GlyphForm> = f === "druid" ? { points: 3, hooks: true, ribs: 6, ticks: 0 } : f === "priest" ? { points: 4, ribs: 8, ticks: 0 } : f === "dracolich" ? { points: 4, hooks: true, rhombus: true, ticks: 16, ribs: 0 } : f === "archmage" ? { points: 5, ticks: 30, ribs: 10, rhombus: true } : f === "monarch" ? { points: 12, ticks: 12, ribs: 0 } : f === "merchant" ? { points: 8, ticks: 16, rhombus: true, ribs: 0 } : { points: 8, ribs: 8, ticks: 0 };
        hold.marks.push(new GroundMark(stage, area.x, area.y, { kind: spec.kind, radius: spec.area ? markR : 240, duration: 0, form }));
      } else {
        hold.emitter = new Emitter(stage, area, { kind: spec.kind, rate: spec.rate * k, life: spec.life, drift, size: 14 * spec.size, alpha: spec.alpha ?? 0.75 });
      }
      ambients.set(id, hold);
    },
    sigil(point, kind, radius = 120, duration = 1400) {
      const p = plane(point);
      new GroundMark(stage, p.x, p.y, { kind, radius, duration, form: sigilForm(kind, radius) });
      new Pillar(stage, p.x, p.y, { kind, height: radius * 2.2, width: radius * 1.1, duration: duration * 0.9 });
      // 传说到场：再立一圈站立光环（低机位也看得见的"立体环"）
      if (radius >= 140 && radius < 165) new Collar(stage, p.x, p.y, { kind, radius: radius * 0.85, height: 110, duration: duration * 0.95, ticks: 28, pulse: 1.4 });
      new Burst(stage, p.x, p.y, 10, { kind, count: Math.round(36 * kOf()), speed: 150, up: 0.95, gravity: 420, size: 34, life: 1.2 });
      return wait(duration);
    },
    ring(point, kind, radius = 160, duration = 700) { const p = plane(point); new GroundMark(stage, p.x, p.y, { kind, radius, duration, mode: 1 }); return wait(duration); },
    beam(from, to, kind, duration = 600) {
      const a = plane(from), b = plane(to);
      new Beam(stage, a, b, { kind, duration, width: 22 * (lowNow() ? 0.8 : 1) });
      stage.schedule(() => new Burst(stage, b.x, b.y, 30, { kind, count: Math.round(22 * kOf()), speed: 200, up: 0.7, size: 32, life: 0.7 }), duration * 0.68);
      return wait(duration);
    },
    burst(point, kind, strength = 1) { const p = plane(point); new Burst(stage, p.x, p.y, 20, { kind, count: Math.round(26 * strength * kOf()), speed: 230 * strength, up: 0.8, size: 38, life: 0.9 }); if (strength >= 0.9) new Shell(stage, p.x, p.y, 16, { kind, r1: 70 * strength, duration: 420, squash: 0.55 }); },
    flare(point, kind, duration = 800) {
      const p = plane(point);
      new GroundMark(stage, p.x, p.y, { kind, radius: 100, duration: duration * 0.9, mode: 1 });
      new Shell(stage, p.x, p.y, 20, { kind, r1: 130, duration: duration * 0.7, squash: 0.6 });
      new Pillar(stage, p.x, p.y, { kind, height: 300, width: 150, duration });
      new Burst(stage, p.x, p.y, 20, { kind, count: Math.round(64 * kOf()), speed: 290, up: 0.9, size: 40, life: 1.0 });
      return wait(duration);
    },
    destroy() { if (destroyed) return; destroyed = true; removeUnavailable(); for (const h of ambients.values()) releaseHold(h); ambients.clear(); fx2d.destroy(); },
  };
  // Check availability for every call: losing either context restores the complete 2D path.
  return new Proxy(composed, { get(target, key: keyof FxLayer) {
    const method = target[key];
    if (typeof method !== "function" || key === "destroy") return method;
    return (...args: unknown[]) => {
      if (destroyed) return key === "script" ? Promise.resolve(false) : Promise.resolve();
      const live = stage.available ? target[key] : fx2d[key];
      if (typeof live === "function") return Reflect.apply(live, stage.available ? target : fx2d, args);
      return key === "script" ? Promise.resolve(false) : undefined;
    };
  } });
}
