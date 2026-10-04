/** 光束飘带：从 A 沿抬升的二次贝塞尔飞到 B，整条带子由顶点着色器摆放（沙盒 NeonTrail 的做法）：
 *  头部跟随进度，身后留一段渐隐的尾巴；宽度朝尾部收窄。空中画布、平面组坐标（z 为高度）。 */
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, ShaderMaterial, Vector3 } from "three";
import type { Effect, FxStage } from "../FxStage";
import { GLSL_COMMON } from "../shaders/lib";
import { palette } from "../palette";
import { Burst } from "./Burst";
import type { FxKind } from "../../fx/particles";

const VERT = /* glsl */`
attribute float aT; attribute float aSide;
uniform vec3 uA, uC, uB; uniform float uProgress, uTail, uWidth;
varying float vAlong; varying float vSide; varying float vVisible;
vec3 bez(float t){ float u = 1.0 - t; return u * u * uA + 2.0 * u * t * uC + t * t * uB; }
void main(){
  // 带子覆盖 [头 − 尾长, 头]，aT 从尾(0)到头(1)
  float head = uProgress, tailStart = head - uTail;
  float t = clamp(tailStart + aT * uTail, 0.0, 1.0);
  vec3 p = bez(t), q = bez(min(t + 0.01, 1.0));
  vec3 tan3 = normalize(q - p + vec3(1e-4)); vec3 side = normalize(cross(tan3, vec3(0.0, 0.0, 1.0)));
  float w = uWidth * (0.25 + 0.75 * aT);
  vec3 pos = p + side * aSide * w;
  vVisible = step(0.0, tailStart + aT * uTail) * step(tailStart + aT * uTail, 1.0);
  vAlong = aT; vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;
const FRAG = /* glsl */`
precision highp float;
uniform vec3 uColor, uBright; uniform float uTime, uFade;
varying float vAlong; varying float vSide; varying float vVisible;
${GLSL_COMMON}
void main(){
  float across = pow(1.0 - vSide * vSide, 1.5);             // 中间亮、边缘软
  float along = 0.15 + 0.85 * pow(vAlong, 1.3);              // 尾淡头亮
  float head = smoothstep(0.8, 1.0, vAlong) * 1.6;
  float flicker = 0.85 + 0.3 * vnoise(vec2(vAlong * 12.0 - uTime * 6.0, vSide * 2.0));
  vec3 col = (uColor * along * across * 1.6 + uBright * head * across) * flicker * vVisible * uFade;
  gl_FragColor = glowOut(col);
}
`;

export class Beam implements Effect {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly start: number; private readonly duration: number;
  private readonly stage: FxStage; private readonly kind: FxKind; private readonly a: Vector3; private readonly b: Vector3; private readonly c: Vector3; private lastDrop = 0;
  constructor(stage: FxStage, from: { x: number; y: number; z?: number }, to: { x: number; y: number; z?: number }, o: { kind: FxKind; duration: number; lift?: number; width?: number; tail?: number }) {
    this.start = performance.now(); this.duration = o.duration; this.stage = stage; this.kind = o.kind;
    const p = palette(o.kind);
    const a = stage.local(from.x, from.y, from.z ?? 30), b = stage.local(to.x, to.y, to.z ?? 30);
    const c = new Vector3().addVectors(a, b).multiplyScalar(0.5); c.z += o.lift ?? 90 + a.distanceTo(b) * 0.18;
    this.a = a; this.b = b; this.c = c;
    const N = 48, pos: number[] = [], at: number[] = [], side: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) { const t = i / N; for (const s of [-1, 1]) { pos.push(0, 0, 0); at.push(t); side.push(s); } }
    for (let i = 0; i < N; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pos, 3)); geo.setAttribute("aT", new Float32BufferAttribute(at, 1)); geo.setAttribute("aSide", new Float32BufferAttribute(side, 1)); geo.setIndex(idx);
    const material = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, side: DoubleSide, premultipliedAlpha: true, toneMapped: false,
      uniforms: { uA: { value: a }, uC: { value: c }, uB: { value: b }, uProgress: { value: 0 }, uTail: { value: o.tail ?? 0.5 }, uWidth: { value: o.width ?? 22 }, uColor: { value: p.main }, uBright: { value: p.bright }, uTime: { value: 0 }, uFade: { value: 1 } } });
    this.mesh = new Mesh(geo, material); this.mesh.frustumCulled = false; this.mesh.renderOrder = 25;
    stage.air.group.add(this.mesh); stage.add(this);
  }
  update(_dt: number, now: number): boolean {
    const u = this.mesh.material.uniforms, k = (now - this.start) / this.duration;
    // 头部在 70% 时到达，余下时间尾巴追上并淡出
    u.uProgress.value = Math.min(1, k / 0.7) + Math.max(0, (k - 0.7) / 0.3) * u.uTail.value;
    u.uFade.value = 1 - Math.max(0, (k - 0.85) / 0.15); u.uTime.value = now / 1000;
    // 头部掉落火星：行进期间每 120 ms 在头部位置撒 3 颗（低档不撒）
    if (k < 0.7 && now - this.lastDrop > 120 && this.stage.tier !== "low") {
      this.lastDrop = now; const t = Math.min(1, k / 0.7), u1 = 1 - t;
      const hx = u1 * u1 * this.a.x + 2 * u1 * t * this.c.x + t * t * this.b.x, hy = u1 * u1 * this.a.y + 2 * u1 * t * this.c.y + t * t * this.b.y, hz = u1 * u1 * this.a.z + 2 * u1 * t * this.c.z + t * t * this.b.z;
      const m = this.stage.metrics();
      new Burst(this.stage, hx + m.planeW / 2, m.planeH / 2 - hy, hz, { kind: this.kind, count: 3, speed: 40, up: 0.2, gravity: 700, drag: 1.5, size: 16, life: 0.45, sprites: ["spark_01"] });
    }
    return k < 1;
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
