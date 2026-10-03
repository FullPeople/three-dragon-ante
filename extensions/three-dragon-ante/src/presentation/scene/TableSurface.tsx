/** 桌面：优先用 WebGL 法线贴图渲染，失败时回退到 CSS 照片材质（无渐变）。 */
import { useEffect, useRef } from "react";
import { mountSurface, type SurfaceHandle, type SurfaceShape } from "./surface-gl";

const tex = (name: string, map: string) => new URL(`../assets/textures/${name}/${map}.webp`, import.meta.url).href;
const MATERIALS = {
  wood: { color: tex("dark_wood", "color"), normal: tex("dark_wood", "normal"), rough: tex("dark_wood", "rough"), tile: 900, brightness: 0.78 },
  felt: { color: tex("felt", "color"), normal: tex("felt", "normal"), rough: tex("felt", "rough"), tile: 520, tint: [0.12, 0.34, 0.24] as [number, number, number], brightness: 0.92 },
  leather: { color: tex("brown_leather", "color"), normal: tex("brown_leather", "normal"), rough: tex("brown_leather", "rough"), tile: 420, brightness: 0.6 },
};

export function TableSurface({ width, height, scale, shape }: { width: number; height: number; scale: number; shape: SurfaceShape }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const handle = useRef<SurfaceHandle | null>(null);
  const dims = useRef({ width, height, scale, shape }); dims.current = { width, height, scale, shape };
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    handle.current = mountSurface(el, MATERIALS, () => ({ w: dims.current.width, h: dims.current.height, pixelScale: Math.min(1.4, dims.current.scale * Math.min(2, devicePixelRatio || 1)), shape: dims.current.shape }));
    if (!handle.current) el.dataset.fallback = "css";
    return () => { handle.current?.destroy(); handle.current = null; };
  }, []);
  useEffect(() => { handle.current?.render(); }, [width, height, scale, shape]);
  return <div className="tda-surface" data-shape={shape}><canvas ref={canvas} className="tda-surface-gl" aria-hidden="true" /><div className="tda-felt-fallback" /></div>;
}
