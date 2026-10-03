/** 特效层的相机数学：把 DOM 2.5D 牌桌的 CSS 变换链（.tda-stage 缩放 → .tda-viewport 透视 → .tda-plane 倾斜）
 * 翻译成 three.js 能用的针孔相机与平面组变换。纯数学、无 three 依赖，便于在 Node 自测里和真实 DOM 的
 * getBoundingClientRect 对照。
 *
 * CSS 链（scene.css）：
 *   .tda-stage    left 50% / top 46%（竖屏 47%），宽高 = 平面尺寸，transform: translate(-50%,-50%) scale(--scale)
 *   .tda-viewport perspective: 1600px; perspective-origin: 50% 30%   （单位 = 平面单位，因为它在 stage 的缩放之内）
 *   .tda-plane    transform: rotateX(--tilt)，origin 50% 50%，preserve-3d
 *   卡牌          translate3d(x, y, z) …，x/y 为平面坐标（y 向下），z 朝观者为正
 *
 * three.js 侧约定：世界单位 = 平面单位；y 向上（= −CSS y）；z 朝观者为正；相机位于透视原点正前方 d 处看向 −z；
 * 平面上的物体放进一个"平面组"，组绕 x 轴转 −tilt（CSS 的 y 向下与 three 的 y 向上手性相反，所以符号取反）。 */
import type { Orientation, PlaneSpec } from "../model/layout";

export const PERSPECTIVE = 1600, PERSPECTIVE_ORIGIN = { x: 0.5, y: 0.3 };
export const STAGE_CENTER_Y: Record<Orientation, number> = { landscape: 0.46, portrait: 0.47 };

export interface StageMetrics {
  /** 宿主（.tda-table）的 CSS 像素尺寸 */
  hostW: number; hostH: number;
  /** 平面单位尺寸与倾角（度） */
  planeW: number; planeH: number; tilt: number;
  /** --scale：平面单位 → CSS 像素 */
  scale: number;
  /** stage 左上角在宿主里的像素位置 */
  stageLeft: number; stageTop: number;
  /** 透视距离与原点（平面单位，CSS 坐标：y 向下） */
  d: number; ox: number; oy: number;
}

export function stageMetrics(hostW: number, hostH: number, spec: PlaneSpec, scale: number, orientation: Orientation): StageMetrics {
  const stageW = spec.w * scale, stageH = spec.h * scale;
  return {
    hostW, hostH, planeW: spec.w, planeH: spec.h, tilt: spec.tilt, scale,
    stageLeft: hostW / 2 - stageW / 2, stageTop: hostH * STAGE_CENTER_Y[orientation] - stageH / 2,
    d: PERSPECTIVE, ox: spec.w * PERSPECTIVE_ORIGIN.x, oy: spec.h * PERSPECTIVE_ORIGIN.y,
  };
}

const rad = (deg: number) => deg * Math.PI / 180;

/** 平面坐标（CSS：x 右、y 下、z 朝观者）→ three.js 世界坐标（y 上）。先绕平面中心做 CSS rotateX(tilt)，再翻 y。 */
export function planeToWorld(m: StageMetrics, x: number, y: number, z = 0): { x: number; y: number; z: number } {
  const cx = m.planeW / 2, cy = m.planeH / 2, t = rad(m.tilt), c = Math.cos(t), s = Math.sin(t);
  // CSS rotateX(θ)：y' = y cosθ − z sinθ；z' = y sinθ + z cosθ（相对平面中心）
  const ly = y - cy, lz = z;
  const ry = ly * c - lz * s, rz = ly * s + lz * c;
  return { x, y: -(cy + ry), z: rz };
}

/** three.js 世界坐标 → 宿主 CSS 像素（与浏览器对同一个 DOM 点的 getBoundingClientRect 中心一致）。 */
export function worldToScreen(m: StageMetrics, wx: number, wy: number, wz: number): { x: number; y: number } {
  // 针孔：眼睛在 (ox, −oy, d)（three 坐标），像平面 z = 0
  const k = m.d / (m.d - wz);
  const sx = m.ox + (wx - m.ox) * k;          // 平面单位，CSS x
  const sy = m.oy + (-wy - m.oy) * k;         // 平面单位，CSS y（向下）
  return { x: m.stageLeft + sx * m.scale, y: m.stageTop + sy * m.scale };
}

/** 平面坐标直接投到宿主像素（两步合一，给自测与对齐检查用）。 */
export function planeToScreen(m: StageMetrics, x: number, y: number, z = 0): { x: number; y: number } {
  const w = planeToWorld(m, x, y, z);
  return worldToScreen(m, w.x, w.y, w.z);
}

/** 空中画布的相机参数：眼睛位置（three 坐标）与近平面上的非对称视锥（覆盖整个宿主矩形）。 */
export function airCamera(m: StageMetrics, near = 60, far = 6000): { eye: { x: number; y: number; z: number }; left: number; right: number; top: number; bottom: number; near: number; far: number } {
  // 宿主矩形换算到平面单位（CSS 坐标）
  const hl = (0 - m.stageLeft) / m.scale, hr = (m.hostW - m.stageLeft) / m.scale;
  const ht = (0 - m.stageTop) / m.scale, hb = (m.hostH - m.stageTop) / m.scale;
  const k = near / m.d;
  return { eye: { x: m.ox, y: -m.oy, z: m.d }, left: (hl - m.ox) * k, right: (hr - m.ox) * k, top: (m.oy - ht) * k, bottom: (m.oy - hb) * k, near, far };
}

/** 屏幕像素 → 平面坐标（z = 0 的那一点）：用于把 DOM 锚点（getBoundingClientRect）变回平面坐标。 */
export function screenToPlane(m: StageMetrics, px: number, py: number): { x: number; y: number } {
  // 像平面上的点（平面单位，CSS 坐标）
  const sx = (px - m.stageLeft) / m.scale, sy = (py - m.stageTop) / m.scale;
  // 从眼睛 (ox, oy, d) 穿过像平面点 (sx, sy, 0) 的射线与倾斜平面相交。倾斜平面：平面坐标 (x, y, 0) 经 rotateX 后
  // 世界(CSS) 点 = (x, cy + (y − cy) cos t, (y − cy) sin t)。射线：E + λ (S − E)。
  const cy = m.planeH / 2, t = rad(m.tilt), c = Math.cos(t), s = Math.sin(t);
  const ex = m.ox, ey = m.oy, ez = m.d;
  const dx = sx - ex, dy = sy - ey, dz = 0 - ez;
  // 平面方程（CSS 世界坐标）：法线 n = (0, −sin t, cos t)，过点 (0, cy, 0)：n·(P − (0,cy,0)) = 0
  const nY = -s, nZ = c;
  const denom = nY * dy + nZ * dz;
  const lambda = (nY * (cy - ey) + nZ * (0 - ez)) / denom;
  const wx = ex + lambda * dx, wy = ey + lambda * dy;
  // 反解平面坐标：y = cy + (wy − cy) / cos t（也可用 z/sin t，取 cos 分支更稳）
  return { x: wx, y: cy + (wy - cy) / c };
}
