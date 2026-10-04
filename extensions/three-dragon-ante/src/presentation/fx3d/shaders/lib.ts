/** 特效层共用 GLSL 片段（three r186 ShaderMaterial，默认 GLSL1 语法由 three 转译到 ES3）。
 *  口径：
 *  - 颜色直接用 token 的 sRGB 值，不做线性转换；材质 toneMapped=false、渲染器 NoToneMapping。
 *  - 所有片元输出**预乘 alpha**（渲染器 premultipliedAlpha=true、材质 premultipliedAlpha=true、NormalBlending）。
 *    发光类用 glowOut：alpha = 最亮通道，等价 screen 合成，不依赖"预乘色 > alpha"的未定义行为。
 *  - 噪声只用 value noise 与最多 3 层 fbm，禁止全屏噪声 pass（像素预算）。
 *  - 地面图元一律乘 tableMask：地面画布不受 .tda-surface 的圆角 overflow 裁剪，得自己按桌形 SDF 裁。 */

export const GLSL_NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm3(vec2 p){ return vnoise(p) * 0.5 + vnoise(p * 2.03 + 7.1) * 0.25 + vnoise(p * 4.1 + 3.7) * 0.125; }
`;

export const GLSL_SDF = /* glsl */`
float sdCircle(vec2 p, float r){ return length(p) - r; }
float sdRing(vec2 p, float r, float w){ return abs(length(p) - r) - w; }
float sdRoundRect(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sdEllipse(vec2 p, vec2 ab){ float k0 = length(p / ab); float k1 = length(p / (ab * ab)); return k0 * (k0 - 1.0) / max(k1, 1e-4); }
float sdTable(vec2 p, vec2 hb, float corner, float shape){ return shape < 0.5 ? sdEllipse(p, hb) : sdRoundRect(p, hb, corner); }
float sdSegment(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
// 1 = 在内侧；按屏幕像素宽度抗锯齿
float fillAA(float d){ float w = max(fwidth(d), 1e-4); return 1.0 - smoothstep(-w, w, d); }
float strokeAA(float d, float w){ return fillAA(abs(d) - w); }
// 时间包络：淡入 a、淡出 r（都是 0..1 的占比）
float envelope(float t, float a, float r){ return smoothstep(0.0, a, t) * (1.0 - smoothstep(1.0 - r, 1.0, t)); }
`;

/** 桌形裁剪：w = 地面场景世界坐标（原点在平面中心、y 向上），毛毡半尺寸 uTableHalf、uTableShape 0 圆 / 1 方 */
export const GLSL_TABLE = /* glsl */`
uniform vec2 uTableHalf; uniform float uTableShape;
float tableMask(vec2 w){ vec2 c = vec2(w.x, -w.y); float sd = sdTable(c, uTableHalf, 170.0, uTableShape); return 1.0 - smoothstep(-3.0, 3.0, sd); }
`;

export const GLSL_OUT = /* glsl */`
// 预乘输出：实体类（覆盖）
vec4 solidOut(vec3 rgb, float a){ return vec4(rgb * a, a); }
// 预乘输出：发光类（alpha = 最亮通道 → screen 式叠加）
vec4 glowOut(vec3 rgb){ float a = clamp(max(rgb.r, max(rgb.g, rgb.b)), 0.0, 1.0); return vec4(rgb, a); }
`;

export const GLSL_COMMON = GLSL_NOISE + GLSL_SDF + GLSL_OUT;
