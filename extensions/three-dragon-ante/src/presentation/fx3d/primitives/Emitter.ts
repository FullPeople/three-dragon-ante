/** 持续粒子发射器（等待选择的驻留态、场地环境）：N 个粒子在 GPU 上循环，每个周期用 hash 重新取出生点，
 *  CPU 零更新；release() 后 450 ms 淡出并移除。区域用平面坐标矩形；粒子沿 drift 漂、带轻微随机。 */
import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Texture, Vector4 } from "three";
import type { Effect, FxStage } from "../FxStage";
import { GLSL_COMMON, GLSL_NOISE } from "../shaders/lib";
import { palette } from "../palette";
import { sprite, type SpriteName } from "../textures";
import type { FxKind } from "../../fx/particles";

const VERT = /* glsl */`
attribute vec4 aLife;   // phase(s), duration(s), size, spin
attribute float aSeed;
uniform float uTime, uStart, uPointScale, uFade, uZ0; uniform vec4 uArea; uniform vec3 uDrift;
varying float vFade; varying float vSpin; varying float vSeed;
${GLSL_NOISE}
void main(){
  float age = uTime - uStart - aLife.x;
  float cyc = floor(age / aLife.y); float t = fract(age / aLife.y);
  float alive = step(0.0, age);
  vec2 j = vec2(hash12(vec2(aSeed * 31.7, cyc)), hash12(vec2(cyc + 3.1, aSeed * 17.3)));
  vec3 origin = vec3(uArea.x + (j.x - 0.5) * uArea.z, uArea.y + (j.y - 0.5) * uArea.w, uZ0);
  float wob = (hash12(vec2(aSeed, cyc + 9.0)) - 0.5) * 2.0;
  vec3 p = origin + uDrift * (t * aLife.y) * (0.7 + 0.6 * hash12(vec2(cyc, aSeed))) + vec3(wob * 10.0 * sin(t * 6.283 + aSeed * 6.0), 0.0, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aLife.z * (0.7 + 0.6 * t) * uPointScale / max(-mv.z, 1.0);
  vFade = (t < 0.2 ? t / 0.2 : 1.0 - (t - 0.2) / 0.8) * alive * uFade;
  vSpin = aLife.w * t * aLife.y; vSeed = aSeed;
}
`;
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap; uniform vec3 uColor, uBright; uniform float uAlpha;
varying float vFade; varying float vSpin; varying float vSeed;
${GLSL_COMMON}
void main(){
  vec2 c = gl_PointCoord - 0.5; float s = sin(vSpin), co = cos(vSpin);
  vec2 uv = vec2(c.x * co - c.y * s, c.x * s + c.y * co) + 0.5;
  vec4 tex = texture2D(uMap, uv);
  vec3 col = mix(uColor, uBright, vSeed * 0.6) * tex.a * vFade * uAlpha * 1.4;
  gl_FragColor = glowOut(col);
}
`;

export interface EmitterOptions { kind: FxKind; rate: number; life: number; drift: { x: number; y: number; z: number }; size: number; alpha?: number; sprites?: SpriteName[]; z0?: number }
const FAMILY_SPRITES: Record<FxKind, SpriteName[]> = {
  ember: ["spark_03", "flame_01"], tide: ["magic_02", "spark_01"], grove: ["star_01", "magic_04"], arcane: ["magic_01", "star_07"], crown: ["star_05", "spark_06"], gold: ["spark_06"], dust: ["smoke_01", "dirt_01"], verdigris: ["spark_06", "twirl_03"], necro: ["magic_05", "smoke_06"],
};

export class Emitter implements Effect {
  readonly points: Points[] = [];
  private readonly materials: ShaderMaterial[] = [];
  private readonly stage: FxStage; private released = -1;
  constructor(stage: FxStage, area: { x: number; y: number; w: number; h: number }, o: EmitterOptions) {
    this.stage = stage;
    const p = palette(o.kind), names = o.sprites ?? FAMILY_SPRITES[o.kind];
    const total = Math.min(160, Math.max(4, Math.round(o.rate * o.life)));
    const start = performance.now() / 1000;
    const c = stage.local(area.x, area.y, 0);
    names.forEach((name, gi) => {
      const n = Math.round(total / names.length); if (!n) return;
      const pos: number[] = [], life: number[] = [], seed: number[] = [];
      for (let i = 0; i < n; i++) { pos.push(0, 0, 0); life.push((i / n) * o.life, o.life * (0.8 + Math.random() * 0.4), o.size * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * 3); seed.push(Math.random()); }
      const geo = new BufferGeometry();
      geo.setAttribute("position", new Float32BufferAttribute(pos, 3)); geo.setAttribute("aLife", new Float32BufferAttribute(life, 4)); geo.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
      const mat = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, premultipliedAlpha: true, toneMapped: false,
        uniforms: { uMap: { value: sprite(name) as Texture }, uColor: { value: p.main }, uBright: { value: p.bright }, uTime: { value: start }, uStart: { value: start }, uPointScale: { value: stage.pointScale() }, uFade: { value: 1 }, uAlpha: { value: o.alpha ?? 0.8 }, uZ0: { value: o.z0 ?? 0 },
          uArea: { value: new Vector4(c.x, c.y, area.w, area.h) }, uDrift: { value: { x: o.drift.x, y: -o.drift.y, z: o.drift.z } } } });
      const pts = new Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 28;
      stage.air.group.add(pts); this.points.push(pts); this.materials.push(mat);
    });
    stage.add(this);
  }
  release() { if (this.released < 0) this.released = performance.now(); }
  update(_dt: number, now: number): boolean {
    const fade = this.released < 0 ? 1 : Math.max(0, 1 - (now - this.released) / 450);
    const scale = this.stage.pointScale();
    for (const m of this.materials) { m.uniforms.uTime.value = now / 1000; m.uniforms.uFade.value = fade; m.uniforms.uPointScale.value = scale; }
    return fade > 0;
  }
  dispose() { for (const p of this.points) { p.parent?.remove(p); p.geometry.dispose(); } for (const m of this.materials) m.dispose(); }
}
