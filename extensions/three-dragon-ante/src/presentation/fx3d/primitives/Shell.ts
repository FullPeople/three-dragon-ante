/** 冲击壳：一个沿法线做噪声位移的球壳，从 r0 膨胀到 r1 并溶解；fresnel 掠射增亮，顶部撕裂。
 *  替代"闪光"做爆发的核心（沙盒 BurstSphere 的做法，细分按档位）。空中画布、平面组坐标；squash 压成贴地圆顶。 */
import { DoubleSide, IcosahedronGeometry, Mesh, ShaderMaterial } from "three";
import type { Effect, FxStage } from "../FxStage";
import { GLSL_COMMON, GLSL_NOISE } from "../shaders/lib";
import { palette } from "../palette";
import type { FxKind } from "../../fx/particles";

const VERT = /* glsl */`
uniform float uT, uSeed, uDisp;
varying vec3 vN; varying vec3 vView; varying float vNoise;
${GLSL_NOISE}
void main(){
  // 两层 value noise 沿法线位移，随 uT 增强（壳在膨胀时越来越碎）
  float n = vnoise(normal.xy * 3.0 + uSeed + uT * 2.0) * 0.6 + vnoise(normal.yz * 6.0 - uSeed) * 0.4;
  vNoise = n;
  vec3 p = position * (1.0 + (n - 0.5) * uDisp * (0.3 + uT));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const FRAG = /* glsl */`
precision highp float;
uniform vec3 uColor, uBright; uniform float uT;
varying vec3 vN; varying vec3 vView; varying float vNoise;
${GLSL_COMMON}
void main(){
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.6);
  // 溶解：噪声低于阈值的地方先消失
  float dissolve = smoothstep(uT * 1.1 - 0.15, uT * 1.1 + 0.05, vNoise);
  float env = (1.0 - smoothstep(0.55, 1.0, uT));
  vec3 col = (uColor * 0.55 + uBright * fres * 1.4) * dissolve * env * (0.35 + 0.65 * (1.0 - uT));
  gl_FragColor = glowOut(col);
}
`;

export class Shell implements Effect {
  readonly mesh: Mesh<IcosahedronGeometry, ShaderMaterial>;
  private readonly start: number; private readonly duration: number; private readonly r0: number; private readonly r1: number;
  constructor(stage: FxStage, x: number, y: number, z: number, o: { kind: FxKind; r0?: number; r1: number; duration: number; squash?: number; detail?: number }) {
    this.start = performance.now(); this.duration = o.duration; this.r0 = o.r0 ?? o.r1 * 0.2; this.r1 = o.r1;
    const p = palette(o.kind);
    const detail = o.detail ?? (stage.tier === "high" ? 3 : stage.tier === "medium" ? 2 : 1);
    const material = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, side: DoubleSide, premultipliedAlpha: true, toneMapped: false,
      uniforms: { uColor: { value: p.main }, uBright: { value: p.bright }, uT: { value: 0 }, uSeed: { value: Math.random() * 10 }, uDisp: { value: stage.tier === "low" ? 0.15 : 0.35 } } });
    this.mesh = new Mesh(new IcosahedronGeometry(1, detail), material);
    this.mesh.position.copy(stage.local(x, y, z)); this.mesh.scale.set(this.r0, this.r0, this.r0 * (o.squash ?? 1)); this.mesh.renderOrder = 22;
    this.squash = o.squash ?? 1;
    stage.air.group.add(this.mesh); stage.add(this);
  }
  private readonly squash: number;
  update(_dt: number, now: number): boolean {
    const t = Math.min(1, (now - this.start) / this.duration), e = 1 - Math.pow(1 - t, 4);
    const r = this.r0 + (this.r1 - this.r0) * e;
    this.mesh.scale.set(r, r, r * this.squash); this.mesh.material.uniforms.uT.value = t;
    return t < 1;
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
