/** Kenney Particle Pack（CC0）的软贴图作为 three 纹理：白色 + 透明通道，着色在着色器里做。 */
import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture, TextureLoader } from "three";

export type SpriteName = "smoke_01" | "smoke_03" | "smoke_06" | "dirt_01" | "dirt_02" | "flame_01" | "flame_03" | "fire_01" | "spark_01" | "spark_03" | "spark_06" | "star_01" | "star_05" | "star_07" | "magic_01" | "magic_02" | "magic_04" | "magic_05" | "light_01" | "light_02" | "circle_01" | "circle_03" | "circle_05" | "twirl_01" | "twirl_03" | "slash_01" | "slash_03" | "scorch_01" | "symbol_01" | "symbol_02" | "trace_01" | "trace_06" | "flare_01" | "muzzle_01" | "window_01";

const loader = new TextureLoader();
const cache = new Map<SpriteName, Texture>();
export function sprite(name: SpriteName): Texture {
  let t = cache.get(name);
  if (!t) {
    t = loader.load(new URL(`../assets/fx/${name}.webp`, import.meta.url).href);
    t.colorSpace = SRGBColorSpace; t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter; t.generateMipmaps = true;
    cache.set(name, t);
  }
  return t;
}
export function disposeSprites() { for (const t of cache.values()) t.dispose(); cache.clear(); }
