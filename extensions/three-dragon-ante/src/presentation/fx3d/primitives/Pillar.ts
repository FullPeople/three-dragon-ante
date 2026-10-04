/** 竖直光柱：两张十字交叉的立面 quad（从任何方向看都有厚度），底亮顶淡，噪声条纹向上流动。
 *  画在空中画布（卡牌之上），放在平面组里：本地 z 轴 = 桌面法线。 */
import { DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import type { Effect, FxStage } from "../FxStage";
import { GLSL_COMMON } from "../shaders/lib";
import { palette } from "../palette";
import type { FxKind } from "../../fx/particles";

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */`
precision highp float;
uniform vec3 uColor, uBright; uniform float uT, uTime, uSeed;
varying vec2 vUv;
${GLSL_COMMON}
void main(){
  float x = vUv.x * 2.0 - 1.0, y = vUv.y;              // y: 0 底 → 1 顶
  float env = smoothstep(0.0, 0.18, uT) * (1.0 - smoothstep(0.62, 1.0, uT));
  float core = exp(-x * x * 7.0), halo = exp(-x * x * 1.8) * 0.5;
  float streak = 0.7 + 0.6 * fbm3(vec2(x * 2.5 + uSeed, y * 3.0 - uTime * 1.1));
  float vert = pow(1.0 - y, 1.25) * 1.5 + 0.12;             // 底亮，往上慢慢淡
  float top = 1.0 - smoothstep(0.7, 1.0, y);
  vec3 col = (uBright * core * 1.3 + uColor * halo) * streak * vert * top * env;
  gl_FragColor = glowOut(col);
}
`;

export class Pillar implements Effect {
  readonly group = new Group();
  private readonly start: number; private readonly duration: number; private readonly material: ShaderMaterial;
  constructor(stage: FxStage, x: number, y: number, o: { kind: FxKind; height: number; width: number; duration: number; seed?: number }) {
    this.start = performance.now(); this.duration = o.duration;
    const p = palette(o.kind);
    this.material = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, side: DoubleSide, premultipliedAlpha: true, toneMapped: false,
      uniforms: { uColor: { value: p.main }, uBright: { value: p.bright }, uT: { value: 0 }, uTime: { value: 0 }, uSeed: { value: o.seed ?? Math.random() * 10 } } });
    const geo = new PlaneGeometry(o.width, o.height);
    // 先绕 X 立起（局部 Y → 桌面法线 Z），再绕世界 Z 偏航：欧拉顺序必须是 ZYX，否则第二张面会倒在桌面上
    for (const yaw of [0, Math.PI / 2]) { const m = new Mesh(geo, this.material); m.rotation.set(Math.PI / 2, 0, yaw, "ZYX"); m.position.z = o.height / 2; this.group.add(m); }
    this.group.position.copy(stage.local(x, y, 0)); this.group.renderOrder = 20;
    stage.air.group.add(this.group); stage.add(this);
  }
  update(_dt: number, now: number): boolean {
    const t = Math.min(1, (now - this.start) / this.duration);
    this.material.uniforms.uT.value = t; this.material.uniforms.uTime.value = now / 1000;
    return t < 1;
  }
  dispose() { this.group.parent?.remove(this.group); for (const m of this.group.children) (m as Mesh).geometry.dispose(); this.material.dispose(); }
}
