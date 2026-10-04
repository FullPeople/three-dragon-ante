/** 地面法阵 / 印记：一张贴地 quad，SDF 画出外环、内环、刻度与一圈程序化符文（按 seed 变体），
 *  符文环缓慢旋转、内环反向；噪声让线条呼吸。mode 0 = 法阵（可驻留），mode 1 = 单环扩散（ring），mode 2 = 三道爪痕（依次划出、焦痕余烬）。
 *  画在地面画布（卡牌之下），乘桌形裁剪。 */
import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import type { Effect, FxStage } from "../FxStage";
import { GLSL_COMMON, GLSL_TABLE } from "../shaders/lib";
import { palette } from "../palette";
import type { FxKind } from "../../fx/particles";

const VERT = /* glsl */`
varying vec2 vUv; varying vec2 vWorld;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xy; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const FRAG = /* glsl */`
precision highp float;
uniform vec3 uColor, uBright; uniform float uT, uTime, uSeed, uMode, uOut;
varying vec2 vUv; varying vec2 vWorld;
${GLSL_COMMON}${GLSL_TABLE}
void main(){
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p); float ang = atan(p.y, p.x);
  float env = (uMode > 1.5) ? 1.0 : (uMode > 0.5) ? (1.0 - smoothstep(0.55, 1.0, uT)) : smoothstep(0.0, 0.22, uT) * (1.0 - uOut);
  float shimmer = 0.8 + 0.4 * fbm3(p * 3.0 + uTime * 0.35 + uSeed);
  vec3 col = vec3(0.0);
  if (uMode > 1.5) {
    // 爪痕：三道平行斜线依次划出（uT 0→1 内错开），亮芯 + 暗焦痕边，末段余烬闪烁
    for (int i = 0; i < 3; i++) {
      float fi = float(i); float on = clamp((uT - fi * 0.12) / 0.18, 0.0, 1.0);
      vec2 o = vec2((fi - 1.0) * 0.26, 0.0);
      vec2 a = o + vec2(-0.55, 0.62), b = o + vec2(0.55, -0.62);
      vec2 bb = mix(a, b, on);
      float d = sdSegment(p, a, bb);
      float core = fillAA(d - 0.022) * on, scorch = fillAA(d - 0.06) * 0.55 * on;
      float ember = 0.75 + 0.5 * vnoise(p * 9.0 + uTime * 4.0 + fi);
      col += uBright * core * ember + mix(uColor, vec3(0.08, 0.03, 0.01), 0.6) * scorch;
    }
    col *= 1.0 - smoothstep(0.7, 1.0, uT);
  } else if (uMode > 0.5) {
    // 单环扩散：半径随 uT 长到 1，带内侧余晖
    float rr = mix(0.15, 0.98, smoothstep(0.0, 1.0, uT));
    float ring = strokeAA(r - rr, 0.025 + 0.02 * (1.0 - uT));
    float wake = smoothstep(rr, rr - 0.35, r) * 0.22 * (1.0 - uT);
    col = uBright * ring * shimmer + uColor * wake;
  } else {
    // 外环 + 内环 + 12 刻度 + 8 符文（由 seed 决定每格的两笔）
    float outer = strokeAA(r - 0.92, 0.028);
    float inner = strokeAA(r - 0.60, 0.016);
    float a2 = ang + uTime * 0.12; float sector = 6.2831853 / 12.0;
    float ta = mod(a2 + sector * 0.5, sector) - sector * 0.5;
    vec2 tp = vec2(r * cos(ta), r * sin(ta));
    float ticks = fillAA(sdSegment(tp, vec2(0.66, 0.0), vec2(0.86, 0.0)) - 0.012) * step(0.0, r);
    float a3 = ang - uTime * 0.08; float rs = 6.2831853 / 8.0; float k = floor((a3 + 3.14159265) / rs);
    float ra = mod(a3 + rs * 0.5, rs) - rs * 0.5;
    vec2 rp = vec2(r * cos(ra), r * sin(ra)) - vec2(0.76, 0.0);
    float h1 = hash12(vec2(k, uSeed)), h2 = hash12(vec2(k + 11.0, uSeed));
    vec2 g0 = vec2(-0.05, (h1 - 0.5) * 0.08), g1 = vec2(0.05, (h2 - 0.5) * 0.08), g2 = vec2((h1 - 0.5) * 0.06, 0.05), g3 = vec2((h2 - 0.5) * 0.06, -0.05);
    float rune = fillAA(min(sdSegment(rp, g0, g1), sdSegment(rp, g2, g3)) - 0.009);
    float glow = smoothstep(1.0, 0.0, r) * 0.16 + smoothstep(0.08, 0.0, abs(r - 0.92)) * 0.25;
    col = uBright * (outer + inner + ticks + rune) * shimmer + uColor * glow;
  }
  col *= env * tableMask(vWorld);
  gl_FragColor = glowOut(col);
}
`;

export interface GroundMarkOptions { kind: FxKind; radius: number; duration: number; mode?: 0 | 1 | 2; seed?: number; z?: number }
export class GroundMark implements Effect {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly start: number; private released = -1; private readonly duration: number;
  constructor(stage: FxStage, x: number, y: number, o: GroundMarkOptions) {
    this.duration = o.duration; this.start = performance.now();
    const p = palette(o.kind);
    const material = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, premultipliedAlpha: true, toneMapped: false,
      uniforms: { uColor: { value: p.main }, uBright: { value: p.bright }, uT: { value: 0 }, uTime: { value: 0 }, uSeed: { value: o.seed ?? Math.random() * 100 }, uMode: { value: o.mode ?? 0 }, uOut: { value: 0 }, ...stage.tableUniforms() } });
    this.mesh = new Mesh(new PlaneGeometry(o.radius * 2, o.radius * 2), material);
    this.mesh.position.copy(stage.local(x, y, o.z ?? 0.6)); this.mesh.renderOrder = 10;
    if (!stage.ground) throw new Error("ground canvas missing");
    stage.ground.scene.add(this.mesh); stage.add(this);
  }
  /** 驻留态（duration = 0）：调用后 500 ms 内淡出 */
  release() { if (this.released < 0) this.released = performance.now(); }
  update(_dt: number, now: number): boolean {
    const u = this.mesh.material.uniforms, age = (now - this.start) / 1000;
    u.uTime.value = now / 1000;
    if (this.duration > 0) { const t = Math.min(1, (now - this.start) / this.duration); u.uT.value = t; u.uOut.value = Math.max(0, (t - 0.72) / 0.28); return t < 1; }
    u.uT.value = Math.min(1, age / 0.4);
    if (this.released >= 0) { const k = (now - this.released) / 500; u.uOut.value = Math.min(1, k); return k < 1; }
    return true;
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
