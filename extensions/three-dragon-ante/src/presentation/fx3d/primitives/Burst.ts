/** GPU 粒子爆发：一次 draw call 的 Points，运动全部在顶点着色器里按时间解析求值（CPU 零更新）。
 *  贴图用 Kenney 软贴图（白 + alpha），家族色在片元里乘上；预乘发光输出。
 *  空中画布、平面组坐标：z 为桌面法线方向（粒子向上喷再落下）。 */
import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Texture } from "three";
import type { Effect, FxStage } from "../FxStage";
import { GLSL_COMMON } from "../shaders/lib";
import { palette } from "../palette";
import { sprite, type SpriteName } from "../textures";
import type { FxKind } from "../../fx/particles";

const VERT = /* glsl */`
attribute vec3 aVel; attribute vec4 aLife;   // aLife: start(s), duration(s), size, spin
attribute float aSeed;
uniform float uTime, uGravity, uDrag, uPointScale;
varying float vFade; varying float vSpin; varying float vSeed;
void main(){
  float t = clamp((uTime - aLife.x) / aLife.y, 0.0, 1.0);
  float age = t * aLife.y;
  // 阻尼运动：位移 = v·(1−e^{−k·age})/k；重力作用在 z
  float k = max(uDrag, 0.01);
  vec3 p = position + aVel * (1.0 - exp(-k * age)) / k;
  p.z += -uGravity * age * age * 0.5;
  p.z = max(p.z, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float grow = 1.0 + 0.9 * t;
  gl_PointSize = aLife.z * grow * uPointScale / max(-mv.z, 1.0);
  vFade = (t < 0.12 ? t / 0.12 : 1.0 - (t - 0.12) / 0.88) * step(aLife.x, uTime) * step(uTime, aLife.x + aLife.y);
  vSpin = aLife.w * age; vSeed = aSeed;
}
`;
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap; uniform vec3 uColor, uBright; uniform float uSolid;
varying float vFade; varying float vSpin; varying float vSeed;
${GLSL_COMMON}
void main(){
  vec2 c = gl_PointCoord - 0.5; float s = sin(vSpin), co = cos(vSpin);
  vec2 uv = vec2(c.x * co - c.y * s, c.x * s + c.y * co) + 0.5;
  vec4 tex = texture2D(uMap, uv);
  vec3 tint = mix(uColor, uBright, vSeed * 0.7);
  if (uSolid > 0.5) { gl_FragColor = solidOut(tint, tex.a * vFade * 0.85); return; }
  vec3 col = tint * tex.a * vFade * 1.7;
  gl_FragColor = glowOut(col);
}
`;

export interface BurstOptions { kind: FxKind; count: number; speed: number; up?: number; gravity?: number; drag?: number; size?: number; life?: number; sprites?: SpriteName[]; spread?: number; solid?: boolean }
const FAMILY_SPRITES: Record<FxKind, SpriteName[]> = {
  ember: ["flame_01", "spark_03", "fire_01"], tide: ["magic_02", "star_05", "spark_01"], grove: ["star_01", "twirl_01", "magic_04"], arcane: ["magic_01", "magic_05", "star_07"],
  crown: ["star_05", "flare_01", "spark_06"], gold: ["spark_06", "star_01"], dust: ["dirt_01", "dirt_02", "smoke_01"],
  verdigris: ["spark_06", "twirl_03", "star_01"], necro: ["magic_05", "smoke_06", "star_07"],
};

export class Burst implements Effect {
  readonly points: Points[] = [];
  private readonly start: number; private readonly life: number; private readonly materials: ShaderMaterial[] = [];
  private readonly stage: FxStage;
  constructor(stage: FxStage, x: number, y: number, z: number, o: BurstOptions) {
    this.stage = stage; this.start = performance.now() / 1000; this.life = o.life ?? 0.9;
    const p = palette(o.kind), names = o.sprites ?? FAMILY_SPRITES[o.kind];
    // 按贴图分组：每种贴图一次 draw call
    const groups = names.map(() => ({ pos: [] as number[], vel: [] as number[], life: [] as number[], seed: [] as number[] }));
    const base = stage.local(x, y, z), spread = o.spread ?? 1, up = o.up ?? 0.6;
    for (let i = 0; i < o.count; i++) {
      const g = groups[i % groups.length];
      const a = Math.random() * Math.PI * 2, el = (Math.random() * 0.5 + 0.5) * up, sp = o.speed * (0.35 + Math.random() * 0.85);
      g.pos.push(base.x + (Math.random() - 0.5) * 6 * spread, base.y + (Math.random() - 0.5) * 6 * spread, base.z);
      g.vel.push(Math.cos(a) * sp * (1 - el * 0.5), Math.sin(a) * sp * (1 - el * 0.5), sp * el * 1.4);
      g.life.push(this.start + Math.random() * 0.08, this.life * (0.6 + Math.random() * 0.6), (o.size ?? 26) * (0.6 + Math.random() * 0.8), (Math.random() - 0.5) * 6);
      g.seed.push(Math.random());
    }
    groups.forEach((g, gi) => {
      if (!g.pos.length) return;
      const geo = new BufferGeometry();
      geo.setAttribute("position", new Float32BufferAttribute(g.pos, 3)); geo.setAttribute("aVel", new Float32BufferAttribute(g.vel, 3));
      geo.setAttribute("aLife", new Float32BufferAttribute(g.life, 4)); geo.setAttribute("aSeed", new Float32BufferAttribute(g.seed, 1));
      const mat = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, premultipliedAlpha: true, toneMapped: false,
        uniforms: { uMap: { value: sprite(names[gi]) as Texture }, uColor: { value: p.main }, uBright: { value: p.bright }, uTime: { value: this.start }, uGravity: { value: o.gravity ?? 900 }, uDrag: { value: o.drag ?? 2.2 }, uPointScale: { value: stage.pointScale() }, uSolid: { value: o.solid ? 1 : 0 } } });
      const pts = new Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 30;
      stage.air.group.add(pts); this.points.push(pts); this.materials.push(mat);
    });
    stage.add(this);
  }
  update(_dt: number, now: number): boolean {
    const t = now / 1000, scale = this.stage.pointScale();
    for (const m of this.materials) { m.uniforms.uTime.value = t; m.uniforms.uPointScale.value = scale; }
    return t < this.start + this.life * 1.25 + 0.1;
  }
  dispose() { for (const p of this.points) { p.parent?.remove(p); p.geometry.dispose(); } for (const m of this.materials) m.dispose(); }
}
