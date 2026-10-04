/** three.js 特效舞台：两张透明画布。
 *  - 空中画布（.tda-fx3d-air）：屏幕对齐、盖在卡牌之上；针孔相机与 CSS 透视链精确对齐（stage.ts），
 *    平面上的东西放进 `air.group`（平面组，已做 rotateX(−tilt)），用 `local(x, y, z)` 把平面坐标换成组内坐标。
 *  - 地面画布（.tda-fx3d-ground）：放在 .tda-plane 里、随平面一起被 CSS 倾斜，画在毛毡之上、卡牌之下；
 *    正交相机 y 向上、原点在平面中心，与空中画布共用同一套 `local(x, y, z)`（评审指出：直接用 y 向下的正交相机会翻转手性，
 *    three 只按物体矩阵的行列式补绕序，默认 FrontSide 的网格会整片被剔除）。负责法阵 / 光池 / 裂痕 / 焦痕这类必须被卡牌盖住的贴地效果。
 *  按需渲染：**只有一条 rAF 链**（帧内新加的效果不会再申请 rAF，审计 H1），没有活动效果就停；只剩驻留效果时按 30 fps 节拍渲染。
 *  WebGL 不可用 / 用户关掉 / 减少动态 / 紧凑弹窗 / 软件 GL（未强制）时 mount 返回 null，调用方退回贴图粒子层。
 *  软件 GL 的探测用一张不挂在页面上的画布（审计 H2：在可见画布上建上下文再 forceContextLoss 会留下一个白色"崩溃"方块）。 */
import { Group, NoToneMapping, OrthographicCamera, PerspectiveCamera, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import { fitPlane, type Orientation, type PlaneSpec } from "../model/layout";
import { airCamera, screenToPlane, stageMetrics, type StageMetrics } from "./stage";
import { reducedMotion } from "../fx/motion";

export type Tier = "high" | "medium" | "low";
export interface Effect {
  /** 每帧调用；返回 false 表示结束（会被移除并 dispose） */
  update(dt: number, now: number): boolean;
  dispose?(): void;
  /** 驻留类（发射器 / 驻留法阵 / 驻留光环）：只剩这类效果时渲染循环降到 30 fps */
  idleOk?: boolean;
}
export interface FxStage {
  /** 写进 root 的 data-fx：three-high / three-medium / three-low；上下文丢失期间为 canvas2d */
  readonly mode: string;
  readonly air: { scene: Scene; camera: PerspectiveCamera; group: Group; renderer: WebGLRenderer };
  readonly ground: { scene: Scene; camera: OrthographicCamera; renderer: WebGLRenderer } | null;
  readonly tier: Tier;
  /** 舞台可用（未销毁、上下文未丢失）：适配器据此决定走 three 还是 2D */
  available(): boolean;
  metrics(): StageMetrics;
  /** 视口像素（clientX/Y 或 getBoundingClientRect 的坐标）→ 平面坐标（z = 0） */
  toPlane(point: { x: number; y: number }): { x: number; y: number };
  /** 平面坐标 → 本地坐标（three，y 向上，原点在平面中心）；空中画布放进 air.group，地面画布直接放进 ground.scene，两者同一套坐标 */
  local(x: number, y: number, z?: number): Vector3;
  /** 平面坐标 → 视口像素（用真实相机投影；对齐检查用） */
  project(x: number, y: number, z?: number): { x: number; y: number };
  /** 地面图元共用的桌形裁剪 uniform（毛毡半尺寸、0 圆 / 1 方）；随布局与桌形更新 */
  tableUniforms(): { uTableHalf: { value: Vector2 }; uTableShape: { value: number } };
  setShape(shape: "round" | "square"): void;
  /** 点精灵尺寸系数：gl_PointSize = size × pointScale / 深度 */
  pointScale(): number;
  add(effect: Effect): void;
  /** 唤醒渲染循环（场景里有东西变了） */
  wake(): void;
  /** 统计（测试用）：rAF 帧数与渲染次数——同一条链下渲染次数 ≤ 帧数 */
  frameStats(): { frames: number; renders: number; effects: number; names: string[] };
  destroy(): void;
}

import { forced, fxPreference } from "./preference";

/** 软件 GL 探测：用离屏画布建一个临时上下文读渲染器名，用完立即丢弃（不碰页面上的画布） */
function probeSoftwareGL(): boolean | null {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|software/i.test(name);
  } catch { return null; }
}

function detectTier(software: boolean, hostW: number): Tier {
  if (reducedMotion() || software) return "low";
  const coarse = matchMedia("(pointer: coarse)").matches, cores = navigator.hardwareConcurrency ?? 4;
  // 手机 / 窄屏：设计要求判中档；核数很少的才判低
  if (hostW < 640 || coarse) return cores >= 6 ? "medium" : "low";
  if (cores <= 4) return "medium";
  return "high";
}

const DPR_CAP: Record<Tier, number> = { high: 1.5, medium: 1.25, low: 1 };

function makeRenderer(canvas: HTMLCanvasElement, tier: Tier): WebGLRenderer | null {
  try {
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: tier === "high", premultipliedAlpha: true, powerPreference: tier === "low" ? "low-power" : "high-performance", stencil: false, preserveDrawingBuffer: false });
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true; renderer.toneMapping = NoToneMapping;
    return renderer;
  } catch { return null; }
}

/** host = .tda-table；airCanvas 盖在 host 上；groundCanvas 位于 .tda-plane 内。两张画布的 CSS 默认 display:none，只在有效果时显示。 */
export function mountFxStage(host: HTMLElement, airCanvas: HTMLCanvasElement, groundCanvas: HTMLCanvasElement | null): FxStage | null {
  const pref = fxPreference();
  const hostRect = () => host.getBoundingClientRect();
  const r0 = hostRect();
  // 门控：用户关掉 / 减少动态 / 枭熊紧凑弹窗（< 420×320）→ 不建；软件 GL 默认不建（?fx3d=1 可强制，测试用）
  if (pref === "off" || (!forced() && (reducedMotion() || (r0.width > 0 && r0.width < 420 && r0.height < 320)))) return null;
  if (!groundCanvas) return null;
  const groundEl: HTMLCanvasElement = groundCanvas;
  const software = probeSoftwareGL();
  if (software === null) return null;
  if (software && !forced()) return null;
  let tier: Tier = pref === "low" ? "low" : pref === "medium" ? "medium" : pref === "high" ? "high" : detectTier(software, r0.width || 1440);
  const made = makeRenderer(airCanvas, tier);
  if (!made) return null;
  const airRenderer: WebGLRenderer = made;
  const groundMade = makeRenderer(groundEl, "low");
  if (!groundMade) { airRenderer.dispose(); airRenderer.forceContextLoss(); return null; }
  const groundRenderer: WebGLRenderer = groundMade;
  let dpr = Math.min(DPR_CAP[tier], devicePixelRatio || 1);
  airRenderer.setPixelRatio(dpr); groundRenderer.setPixelRatio(dpr);

  const airScene = new Scene(), airCam = new PerspectiveCamera(), group = new Group();
  airScene.add(group);
  const groundScene = new Scene(), groundCam = new OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
  groundCam.position.set(0, 0, 1000);

  const effects: Effect[] = [];
  let raf = 0, last = 0, destroyed = false, lost = false, frames = 0, renders = 0, lastRender = 0;
  const tableUniforms = { uTableHalf: { value: new Vector2(826, 486) }, uTableShape: { value: 0 } };
  let pointScaleValue = 1000;
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
    // 点精灵：像素/单位 = 绘制缓冲高度 / (视锥高度 × 深度/近平面)
    pointScaleValue = r.height * dpr * f.near / (f.top - f.bottom);
    tableUniforms.uTableHalf.value.set(spec.w / 2 - 74, spec.h / 2 - 64);
    group.position.set(spec.w / 2, -spec.h / 2, 0); group.rotation.set(-spec.tilt * Math.PI / 180, 0, 0); group.updateMatrixWorld(true);
    // 地面：CSS 尺寸 = 平面单位（在 stage 的缩放之内），后备存储按显示像素 × dpr
    groundRenderer.setSize(Math.max(1, spec.w * fit.scale), Math.max(1, spec.h * fit.scale), false);
    groundEl.style.width = `${spec.w}px`; groundEl.style.height = `${spec.h}px`;
    groundCam.left = -spec.w / 2; groundCam.right = spec.w / 2; groundCam.top = spec.h / 2; groundCam.bottom = -spec.h / 2; groundCam.updateProjectionMatrix();
  }
  // three 内部可能调用 updateProjectionMatrix（例如 setViewOffset）；锁定为我们的视锥
  airCam.updateProjectionMatrix = () => { const f = airCamera(metrics); airCam.projectionMatrix.makePerspective(f.left, f.right, f.top, f.bottom, f.near, f.far); airCam.projectionMatrixInverse.copy(airCam.projectionMatrix).invert(); };
  const observer = new ResizeObserver(() => { layout(); if (effects.length) wake(); });
  observer.observe(host); layout(); setVisible(false);

  // 上下文丢失：停循环、清空效果、档位标 canvas2d（适配器据 available() 退回 2D）；恢复后重新布局
  const clearEffects = () => { for (const e of effects.splice(0)) { try { e.dispose?.(); } catch { /* 已失效 */ } } };
  const onLost = (e: Event) => { e.preventDefault(); lost = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } clearEffects(); setVisible(false); (stage as { mode: string }).mode = "canvas2d"; window.dispatchEvent(new CustomEvent("tda-fx-tier", { detail: "canvas2d" })); };
  const onRestored = () => { lost = false; (stage as { mode: string }).mode = `three-${tier}`; layout(); window.dispatchEvent(new CustomEvent("tda-fx-tier", { detail: tier })); };
  for (const c of [airCanvas, groundEl]) { c.addEventListener("webglcontextlost", onLost); c.addEventListener("webglcontextrestored", onRestored); }

  // 自适应降档：效果活跃期间 rAF 间隔的 EMA 连续 1.5 s > 28 ms 就降一档（只降不升），同时降 DPR；循环停下时复位，避免陈旧样本误降
  let ema = 16.7, slowSince = 0;
  function downgrade() {
    if (tier === "low") return;
    tier = tier === "high" ? "medium" : "low";
    dpr = Math.min(DPR_CAP[tier], devicePixelRatio || 1); airRenderer.setPixelRatio(dpr); groundRenderer.setPixelRatio(dpr); layout();
    (stage as { mode: string }).mode = `three-${tier}`;
    window.dispatchEvent(new CustomEvent("tda-fx-tier", { detail: tier }));
  }
  function frame(now: number) {
    if (destroyed || lost) { raf = 0; return; }
    frames++;
    const gap = last ? now - last : 0;
    const dt = Math.min(0.05, last ? gap / 1000 : 0.016); last = now;
    if (gap > 0) { ema = ema * 0.9 + Math.min(100, gap) * 0.1; if (ema > 28) { if (!slowSince) slowSince = now; else if (now - slowSince > 1500) { downgrade(); slowSince = 0; ema = 16.7; } } else slowSince = 0; }
    for (let i = effects.length - 1; i >= 0; i--) { let alive = false; try { alive = effects[i].update(dt, now); } catch (err) { alive = false; console.error("fx3d effect failed", effects[i]?.constructor?.name, err); } if (!alive) { const e = effects.splice(i, 1)[0]; try { e.dispose?.(); } catch (err) { console.error("fx3d dispose failed", err); } } }
    // 只剩驻留效果：30 fps 节拍
    const idleOnly = effects.length > 0 && effects.every(e => e.idleOk);
    if (!idleOnly || now - lastRender >= 31) { airRenderer.render(airScene, airCam); groundRenderer.render(groundScene, groundCam); renders++; lastRender = now; }
    // 单条链：帧内 add() 看到 raf ≠ 0 不会再申请；这里统一续链或停下
    if (effects.length) raf = requestAnimationFrame(frame); else { raf = 0; last = 0; ema = 16.7; slowSince = 0; setVisible(false); }
  }
  // 没有活动效果时两张画布都不参与合成
  function setVisible(on: boolean) { airCanvas.style.display = on ? "block" : "none"; groundEl.style.display = on ? "block" : "none"; }
  function wake() { if (!raf && !destroyed && !lost) { setVisible(true); raf = requestAnimationFrame(frame); } }

  const stage: FxStage = {
    mode: `three-${tier}`,
    air: { scene: airScene, camera: airCam, group, renderer: airRenderer },
    ground: { scene: groundScene, camera: groundCam, renderer: groundRenderer },
    get tier() { return tier; },
    available: () => !destroyed && !lost,
    metrics: () => metrics,
    toPlane(point) { const r = hostRect(); return screenToPlane(metrics, point.x - r.left, point.y - r.top); },
    local(x, y, z = 0) { return new Vector3(x - spec.w / 2, spec.h / 2 - y, z); },
    project(x, y, z = 0) {
      const v = stage.local(x, y, z); group.localToWorld(v); v.project(airCam);
      const r = hostRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    },
    tableUniforms: () => tableUniforms,
    setShape(shape) { tableUniforms.uTableShape.value = shape === "square" ? 1 : 0; },
    pointScale: () => pointScaleValue,
    // 舞台销毁 / 丢失后在途的定时器仍可能 add：直接 dispose，不入队
    add(effect) { if (destroyed || lost) { try { effect.dispose?.(); } catch { /* 已失效 */ } return; } effects.push(effect); wake(); },
    wake,
    frameStats: () => ({ frames, renders, effects: effects.length, names: effects.map(e => e.constructor?.name ?? "?") }),
    destroy() {
      destroyed = true; observer.disconnect(); if (raf) cancelAnimationFrame(raf);
      clearEffects();
      for (const c of [airCanvas, groundEl]) { c.removeEventListener("webglcontextlost", onLost); c.removeEventListener("webglcontextrestored", onRestored); }
      // 释放 GL 上下文（浏览器每页上限约 16 个；牌桌反复挂载时不能堆积）
      airRenderer.dispose(); airRenderer.forceContextLoss(); groundRenderer.dispose(); groundRenderer.forceContextLoss();
    },
  };
  return stage;
}
