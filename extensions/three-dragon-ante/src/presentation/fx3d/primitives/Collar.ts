/** 站立光环：开口圆柱（无顶无底），底部实、往上淡；竖向条纹上流 + 转动刻度 + 呼吸；掠射角 fresnel 让它在 22–28° 低机位也看得见
 *  （平贴环在这个机位几乎是一条线）。可驻留（duration 0 → release()）。空中画布、平面组坐标。 */
import { CylinderGeometry, DoubleSide, Mesh, ShaderMaterial } from "three";
import type { Effect, FxStage } from "../FxStage";
import { GLSL_COMMON } from "../shaders/lib";
import { palette } from "../palette";
import type { FxKind } from "../../fx/particles";

const VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }
`;
const FRAG = /* glsl */`
precision highp float;
uniform vec3 uColor, uBright; uniform float uT, uTime, uOut, uTicks, uPulse;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
${GLSL_COMMON}
void main(){
  float y = vUv.y;                                   // 0 底 → 1 顶
  float env = smoothstep(0.0, 0.25, uT) * (1.0 - uOut);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.2) * 0.8 + 0.2;
  float breathe = 0.85 + 0.15 * sin(uTime * 2.2 * uPulse);
  float stripes = 0.7 + 0.5 * fbm3(vec2(vUv.x * 14.0, y * 2.0 - uTime * 0.8));
  float base = pow(1.0 - y, 1.6);
  float ticks = 0.0;
  if (uTicks > 0.5) { float s = fract(vUv.x * uTicks + uTime * 0.05); ticks = (1.0 - smoothstep(0.02, 0.06, abs(s - 0.5))) * smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.35, 0.5, y)); }
  vec3 col = (uColor * base * stripes + uBright * (ticks + base * 0.25)) * fres * breathe * env;
  gl_FragColor = glowOut(col);
}
`;

export class Collar implements Effect {
  readonly mesh: Mesh<CylinderGeometry, ShaderMaterial>;
  private readonly start: number; private readonly duration: number; private released = -1;
  get idleOk() { return this.duration === 0; }
  constructor(stage: FxStage, x: number, y: number, o: { kind: FxKind; radius: number; height: number; duration: number; ticks?: number; pulse?: number }) {
    this.start = performance.now(); this.duration = o.duration;
    const p = palette(o.kind);
    const material = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, side: DoubleSide, premultipliedAlpha: true, toneMapped: false,
      uniforms: { uColor: { value: p.main }, uBright: { value: p.bright }, uT: { value: 0 }, uTime: { value: 0 }, uOut: { value: 0 }, uTicks: { value: o.ticks ?? 0 }, uPulse: { value: o.pulse ?? 1 } } });
    const seg = stage.tier === "low" ? 32 : 64;
    this.mesh = new Mesh(new CylinderGeometry(o.radius, o.radius * 1.04, o.height, seg, 1, true), material);
    // CylinderGeometry 沿 y 轴：立起来（y → 平面法线 z），底在桌面
    this.mesh.rotation.x = Math.PI / 2; this.mesh.position.copy(stage.local(x, y, o.height / 2)); this.mesh.renderOrder = 18;
    stage.air.group.add(this.mesh); stage.add(this);
  }
  release() { if (this.released < 0) this.released = performance.now(); }
  update(_dt: number, now: number): boolean {
    const u = this.mesh.material.uniforms; u.uTime.value = now / 1000;
    if (this.duration > 0) { const t = Math.min(1, (now - this.start) / this.duration); u.uT.value = t; u.uOut.value = Math.max(0, (t - 0.7) / 0.3); return t < 1; }
    u.uT.value = Math.min(1, (now - this.start) / 400);
    if (this.released >= 0) { const k = (now - this.released) / 500; u.uOut.value = Math.min(1, k); return k < 1; }
    return true;
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
