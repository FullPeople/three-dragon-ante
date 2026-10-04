/** three.js 特效舞台：两张透明画布。
 *  - 空中画布（.tda-fx3d-air）：屏幕对齐、盖在卡牌之上；针孔相机与 CSS 透视链精确对齐（stage.ts），
 *    平面上的东西放进 `air.group`（平面组，已做 rotateX(−tilt)），用 `local(x, y, z)` 把平面坐标换成组内坐标。
 *  - 地面画布（.tda-fx3d-ground）：放在 .tda-plane 里、随平面一起被 CSS 倾斜，画在毛毡之上、卡牌之下；
 *    正交相机直接用平面坐标（y 向下），负责法阵 / 光池 / 裂痕 / 焦痕这类必须被卡牌盖住的贴地效果。
 *  按需渲染：没有活动效果就不跑循环。WebGL 不可用时 mount 返回 null，调用方退回贴图粒子层。 */
import { Group, OrthographicCamera, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { fitPlane, type Orientation, type PlaneSpec } from "../model/layout";
import { airCamera, screenToPlane, stageMetrics, type StageMetrics } from "./stage";
import { reducedMotion } from "../fx/motion";

export type Tier = "high" | "medium" | "low";
export interface Effect {
  /** 每帧调用；返回 false 表示结束（会被移除并 dispose） */
  update(dt: number, now: number): boolean;
  dispose?(): void;
}
export interface FxStage {
  readonly air: { scene: Scene; camera: PerspectiveCamera; group: Group; renderer: WebGLRenderer };
  readonly ground: { scene: Scene; camera: OrthographicCamera; renderer: WebGLRenderer } | null;
  readonly tier: Tier;
  metrics(): StageMetrics;
  /** 视口像素（clientX/Y 或 getBoundingClientRect 的坐标）→ 平面坐标（z = 0） */
  toPlane(point: { x: number; y: number }): { x: number; y: number };
  /** 平面坐标 → 空中平面组的本地坐标（three，y 向上） */
  local(x: number, y: number, z?: number): Vector3;
  /** 平面坐标 → 视口像素（用真实相机投影；对齐检查用） */
  project(x: number, y: number, z?: number): { x: number; y: number };
  add(effect: Effect): void;
  /** 唤醒渲染循环（场景里有东西变了） */
  wake(): void;
  destroy(): void;
}

function detectTier(renderer: WebGLRenderer, hostW: number): Tier {
  if (reducedMotion()) return "low";
  const gl = renderer.getContext();
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  if (/swiftshader|llvmpipe|software/i.test(name)) return "low";
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (hostW < 640 || (coarse && (navigator.hardwareConcurrency ?? 4) <= 4)) return "low";
  if (coarse || (navigator.hardwareConcurrency ?? 4) <= 4) return "medium";
  return "high";
}

const DPR_CAP: Record<Tier, number> = { high: 1.5, medium: 1.25, low: 1 };

function makeRenderer(canvas: HTMLCanvasElement, antialias: boolean): WebGLRenderer | null {
  try {
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias, premultipliedAlpha: true, powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: false });
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    return renderer;
  } catch { return null; }
}

/** host = .tda-table；airCanvas 盖在 host 上；groundCanvas 位于 .tda-plane 内（可为 null：只要空中层） */
export function mountFxStage(host: HTMLElement, airCanvas: HTMLCanvasElement, groundCanvas: HTMLCanvasElement | null): FxStage | null {
  const made = makeRenderer(airCanvas, true);
  if (!made) return null;
  const airRenderer: WebGLRenderer = made;
  const hostRect = () => host.getBoundingClientRect();
  const tier = detectTier(airRenderer, hostRect().width || 1440);
  if (tier !== "high") { /* 低档：关掉抗锯齿，重建一次更省 */ }
  const dpr = Math.min(DPR_CAP[tier], devicePixelRatio || 1);
  airRenderer.setPixelRatio(dpr);
  const groundRenderer = groundCanvas ? makeRenderer(groundCanvas, false) : null;
  groundRenderer?.setPixelRatio(dpr);

  const airScene = new Scene(), airCam = new PerspectiveCamera(), group = new Group();
  airScene.add(group);
  const groundScene = new Scene(), groundCam = new OrthographicCamera(0, 1, 0, 1, -2000, 2000);
  groundCam.position.set(0, 0, 1000);

  const effects: Effect[] = [];
  let raf = 0, last = 0, dirty = true, destroyed = false;
  let metrics: StageMetrics = stageMetrics(1440, 820, fitPlane(1440, 820).spec, fitPlane(1440, 820).scale, "landscape");
  let orientation: Orientation = "landscape", spec: PlaneSpec = fitPlane(1440, 820).spec;

  function layout() {
    const r = hostRect(); if (!r.width || !r.height) return;
    const fit = fitPlane(r.width, r.height);
    orientation = fit.orientation; spec = fit.spec;
    metrics = stageMetrics(r.width, r.height, spec, fit.scale, orientation);
    // 空中：渲染尺寸 = 宿主像素；视锥覆盖整个宿主
    airRenderer.setSize(r.width, r.height, false);
    airCanvas.style.width = `${r.width}px`; airCanvas.style.height = `${r.height}px`;
    const f = airCamera(metrics);
    airCam.position.set(f.eye.x, f.eye.y, f.eye.z); airCam.rotation.set(0, 0, 0); airCam.near = f.near; airCam.far = f.far;
    airCam.projectionMatrix.makePerspective(f.left, f.right, f.top, f.bottom, f.near, f.far);
    airCam.projectionMatrixInverse.copy(airCam.projectionMatrix).invert();
    airCam.updateMatrixWorld(true);
    group.position.set(spec.w / 2, -spec.h / 2, 0); group.rotation.set(-spec.tilt * Math.PI / 180, 0, 0); group.updateMatrixWorld(true);
    // 地面：CSS 尺寸 = 平面单位（在 stage 的缩放之内），后备存储按显示像素 × dpr
    if (groundRenderer && groundCanvas) {
      groundRenderer.setSize(Math.max(1, spec.w * fit.scale), Math.max(1, spec.h * fit.scale), false);
      groundCanvas.style.width = `${spec.w}px`; groundCanvas.style.height = `${spec.h}px`;
      groundCam.left = 0; groundCam.right = spec.w; groundCam.top = 0; groundCam.bottom = spec.h; groundCam.updateProjectionMatrix();
    }
    dirty = true;
  }
  // three 内部可能调用 updateProjectionMatrix（例如 setViewOffset）；锁定为我们的视锥
  airCam.updateProjectionMatrix = () => { const f = airCamera(metrics); airCam.projectionMatrix.makePerspective(f.left, f.right, f.top, f.bottom, f.near, f.far); airCam.projectionMatrixInverse.copy(airCam.projectionMatrix).invert(); };
  const observer = new ResizeObserver(() => { layout(); if (effects.length) wake(); });
  observer.observe(host); layout(); setVisible(false);

  function frame(now: number) {
    raf = 0; if (destroyed) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    for (let i = effects.length - 1; i >= 0; i--) { let alive = false; try { alive = effects[i].update(dt, now); } catch { alive = false; } if (!alive) { const e = effects.splice(i, 1)[0]; e.dispose?.(); } }
    airRenderer.render(airScene, airCam);
    if (groundRenderer) groundRenderer.render(groundScene, groundCam);
    dirty = false;
    if (effects.length) raf = requestAnimationFrame(frame); else { last = 0; setVisible(false); }
  }
  // 没有活动效果时两张画布都不参与合成
  function setVisible(on: boolean) { airCanvas.style.display = on ? "" : "none"; if (groundCanvas) groundCanvas.style.display = on ? "" : "none"; }
  function wake() { if (!raf && !destroyed) { setVisible(true); raf = requestAnimationFrame(frame); } }

  const stage: FxStage = {
    air: { scene: airScene, camera: airCam, group, renderer: airRenderer },
    ground: groundRenderer ? { scene: groundScene, camera: groundCam, renderer: groundRenderer } : null,
    tier,
    metrics: () => metrics,
    toPlane(point) { const r = hostRect(); return screenToPlane(metrics, point.x - r.left, point.y - r.top); },
    local(x, y, z = 0) { return new Vector3(x - spec.w / 2, spec.h / 2 - y, z); },
    project(x, y, z = 0) {
      const v = stage.local(x, y, z); group.localToWorld(v); v.project(airCam);
      const r = hostRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
    add(effect) { effects.push(effect); wake(); },
    wake,
    destroy() {
      destroyed = true; observer.disconnect(); if (raf) cancelAnimationFrame(raf);
      for (const e of effects.splice(0)) e.dispose?.();
      airRenderer.dispose(); groundRenderer?.dispose();
    },
  };
  return stage;
}
