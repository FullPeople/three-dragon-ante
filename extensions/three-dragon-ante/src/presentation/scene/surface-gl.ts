/** 桌面材质渲染器：一张 WebGL2 画布，照片扫描的颜色 / 法线 / 粗糙度贴图，真实的法线贴图光照。
 * 只在尺寸或贴图变化时画一帧，没有渲染循环。WebGL 不可用时返回 null，由 CSS 照片材质兜底。 */

export interface SurfaceMaterials { wood: MaterialSet; felt: MaterialSet; leather: MaterialSet }
export interface MaterialSet { color: string; normal: string; rough: string; tile: number; tint?: [number, number, number]; brightness?: number }
export type SurfaceShape = "round" | "square";
export interface SurfaceHandle { render(): void; destroy(): void; readonly ready: boolean }

const VS = `#version 300 es
in vec2 aPos; out vec2 vUv; void main(){ vUv = aPos; gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform vec2 uSize;            // 平面尺寸（平面单位）
uniform sampler2D uWoodC, uWoodN, uWoodR, uFeltC, uFeltN, uFeltR, uLeatherC, uLeatherN, uLeatherR;
uniform vec3 uFeltTint; uniform float uFeltBright, uWoodBright, uLeatherBright;
uniform vec3 uWoodTile;        // x: tile size, y/z unused
uniform float uFeltTile, uLeatherTile;
uniform vec3 uKeyDir;          // 定向光方向（指向光源）
uniform vec3 uCandlePos;       // 点光位置（平面单位，z 为高度）
uniform float uShape;          // 0 = 圆桌（椭圆），1 = 圆角方桌
float sdRoundRect(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
// 椭圆距离的一阶近似（IQ），足够画包边与倒角
float sdEllipse(vec2 p, vec2 ab){ float k0 = length(p / ab); float k1 = length(p / (ab * ab)); return k0 * (k0 - 1.0) / max(k1, 1e-4); }
float sdTable(vec2 p, vec2 hb, float corner){ return uShape < 0.5 ? sdEllipse(p, hb) : sdRoundRect(p, hb, corner); }
vec3 toLinear(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
vec3 shade(vec3 albedo, vec3 n, float rough, vec2 p){
  vec3 v = vec3(0.0, 0.0, 1.0);
  // 定向光
  vec3 l = normalize(uKeyDir);
  float diff = max(dot(n, l), 0.0);
  vec3 h = normalize(l + v);
  float shin = mix(96.0, 6.0, clamp(rough, 0.0, 1.0));
  float spec = pow(max(dot(n, h), 0.0), shin) * (1.0 - rough) * 0.35;
  vec3 key = vec3(1.0, 0.93, 0.82) * (diff * 0.95 + spec);
  // 暖色点光（烛台）
  vec3 toC = uCandlePos - vec3(p, 0.0);
  float d = length(toC); vec3 lc = toC / d;
  float att = 1.0 / (1.0 + d * d / (520.0 * 520.0));
  float diffC = max(dot(n, lc), 0.0);
  vec3 hc = normalize(lc + v);
  float specC = pow(max(dot(n, hc), 0.0), shin) * (1.0 - rough) * 0.25;
  vec3 candle = vec3(1.0, 0.72, 0.42) * (diffC * 0.9 + specC) * att * 1.4;
  vec3 ambient = vec3(0.30, 0.27, 0.24);
  return albedo * (ambient + key + candle);
}
vec3 unpackN(vec4 t){ vec3 n = t.xyz * 2.0 - 1.0; n.xy *= 1.15; return normalize(n); }
void main(){
  vec2 p = vUv * uSize;                       // 平面坐标
  vec2 c = p - uSize * 0.5;                   // 以中心为原点
  float tableSd = sdTable(c, uSize * 0.5, 230.0);
  if (tableSd > 0.0) { outColor = vec4(0.0); return; }
  vec2 feltHalf = uSize * 0.5 - vec2(74.0, 64.0);
  float feltSd = sdTable(c, feltHalf, 170.0);
  float bandW = 26.0;
  vec3 col;
  if (feltSd <= 0.0) {
    vec2 uv = p / uFeltTile;
    vec3 a = toLinear(texture(uFeltC, uv).rgb);
    float g = dot(a, vec3(0.333));
    vec3 albedo = uFeltTint * g * uFeltBright;
    vec3 n = unpackN(texture(uFeltN, uv)); n.xy *= 0.6; n = normalize(n);
    float r = texture(uFeltR, uv).r;
    col = shade(albedo, n, mix(0.85, 1.0, r), p);
    // 毛毡边缘的接触阴影与皮革压边的落影
    float edge = clamp(-feltSd / 48.0, 0.0, 1.0);
    col *= mix(0.42, 1.0, edge);
  } else if (feltSd <= bandW) {
    vec2 uv = p / uLeatherTile;
    vec3 albedo = toLinear(texture(uLeatherC, uv).rgb) * uLeatherBright;
    vec3 n = unpackN(texture(uLeatherN, uv));
    // 包边有弧度：法线向毛毡一侧倾斜
    float t = feltSd / bandW;
    vec2 g = normalize(c / max(abs(c), vec2(1.0)));
    n = normalize(n + vec3(-g * (t - 0.5) * 1.2, 0.0));
    float r = texture(uLeatherR, uv).r;
    col = shade(albedo, n, r, p);
    col *= mix(0.75, 1.0, smoothstep(0.0, 0.25, t));
  } else {
    vec2 uv = p / uWoodTile.x;
    vec3 albedo = toLinear(texture(uWoodC, uv).rgb) * uWoodBright;
    vec3 n = unpackN(texture(uWoodN, uv));
    float r = texture(uWoodR, uv).r;
    col = shade(albedo, n, r, p);
    // 桌沿倒角：靠外缘变暗
    float rim = clamp((-tableSd) / 30.0, 0.0, 1.0);
    col *= mix(0.55, 1.0, rim);
    // 皮革带外侧的接缝阴影
    col *= mix(0.78, 1.0, clamp((feltSd - bandW) / 10.0, 0.0, 1.0));
  }
  // 轻微暗角
  float vig = 1.0 - 0.18 * smoothstep(0.55, 1.0, length(c / (uSize * 0.5)));
  outColor = vec4(toSrgb(col * vig), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(log ?? "shader"); }
  return shader;
}

export function mountSurface(canvas: HTMLCanvasElement, materials: SurfaceMaterials, size: () => { w: number; h: number; pixelScale: number; shape: SurfaceShape }): SurfaceHandle | null {
  let gl: WebGL2RenderingContext | null = null;
  try { gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power", preserveDrawingBuffer: true }); } catch { gl = null; }
  if (!gl) return null;
  const ctx = gl;
  let program: WebGLProgram;
  try {
    program = ctx.createProgram()!;
    ctx.attachShader(program, compile(ctx, ctx.VERTEX_SHADER, VS)); ctx.attachShader(program, compile(ctx, ctx.FRAGMENT_SHADER, FS)); ctx.linkProgram(program);
    if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) throw new Error(ctx.getProgramInfoLog(program) ?? "link");
  } catch (error) { console.warn("surface shader failed", error); return null; }
  const buffer = ctx.createBuffer(); ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer); ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), ctx.STATIC_DRAW);
  const aPos = ctx.getAttribLocation(program, "aPos"); ctx.enableVertexAttribArray(aPos); ctx.vertexAttribPointer(aPos, 2, ctx.FLOAT, false, 0, 0);
  const uniforms = (name: string) => ctx.getUniformLocation(program, name);
  const textures = new Map<string, WebGLTexture>();
  let destroyed = false, loaded = 0;
  const slots: [string, string, boolean][] = [
    ["uWoodC", materials.wood.color, true], ["uWoodN", materials.wood.normal, false], ["uWoodR", materials.wood.rough, false],
    ["uFeltC", materials.felt.color, true], ["uFeltN", materials.felt.normal, false], ["uFeltR", materials.felt.rough, false],
    ["uLeatherC", materials.leather.color, true], ["uLeatherN", materials.leather.normal, false], ["uLeatherR", materials.leather.rough, false],
  ];
  function placeholder(name: string, value: [number, number, number]) {
    const tex = ctx.createTexture()!; ctx.bindTexture(ctx.TEXTURE_2D, tex);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, 1, 1, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, new Uint8Array([...value, 255]));
    textures.set(name, tex);
  }
  for (const [name, , isColor] of slots) placeholder(name, isColor ? [120, 100, 80] : name.endsWith("N") ? [128, 128, 255] : [200, 200, 200]);
  for (const [name, url] of slots) {
    const image = new Image(); image.decoding = "async";
    image.onload = () => {
      if (destroyed) return;
      const tex = textures.get(name)!; ctx.bindTexture(ctx.TEXTURE_2D, tex);
      ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, image);
      ctx.generateMipmap(ctx.TEXTURE_2D);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.REPEAT); ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.REPEAT);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR_MIPMAP_LINEAR); ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
      const ext = ctx.getExtension("EXT_texture_filter_anisotropic"); if (ext) ctx.texParameterf(ctx.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
      loaded++; render();
    };
    image.src = url;
  }
  function render() {
    if (destroyed) return;
    const { w, h, pixelScale, shape } = size();
    const width = Math.max(2, Math.min(2560, Math.round(w * pixelScale))), height = Math.max(2, Math.min(2560, Math.round(h * pixelScale)));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.viewport(0, 0, width, height); ctx.useProgram(program);
    ctx.uniform2f(uniforms("uSize"), w, h); ctx.uniform1f(uniforms("uShape"), shape === "round" ? 0 : 1);
    slots.forEach(([name], i) => { ctx.activeTexture(ctx.TEXTURE0 + i); ctx.bindTexture(ctx.TEXTURE_2D, textures.get(name)!); ctx.uniform1i(uniforms(name), i); });
    const tint = materials.felt.tint ?? [0.16, 0.36, 0.27];
    ctx.uniform3f(uniforms("uFeltTint"), tint[0], tint[1], tint[2]);
    ctx.uniform1f(uniforms("uFeltBright"), materials.felt.brightness ?? 1); ctx.uniform1f(uniforms("uWoodBright"), materials.wood.brightness ?? 1); ctx.uniform1f(uniforms("uLeatherBright"), materials.leather.brightness ?? 1);
    ctx.uniform3f(uniforms("uWoodTile"), materials.wood.tile, 0, 0); ctx.uniform1f(uniforms("uFeltTile"), materials.felt.tile); ctx.uniform1f(uniforms("uLeatherTile"), materials.leather.tile);
    ctx.uniform3f(uniforms("uKeyDir"), -0.42, -0.55, 0.72);
    ctx.uniform3f(uniforms("uCandlePos"), w * 0.5, h * 0.3, 520);
    ctx.clearColor(0, 0, 0, 0); ctx.clear(ctx.COLOR_BUFFER_BIT);
    ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
  }
  render();
  return {
    render,
    get ready() { return loaded >= slots.length; },
    destroy() { destroyed = true; for (const tex of textures.values()) ctx.deleteTexture(tex); ctx.deleteProgram(program); ctx.deleteBuffer(buffer); },
  };
}
