/** 对齐调试：在地面画布画细环、在空中画布画小立柱，位置来自平面坐标；只在 ?fx3dDebug=1 时由场景挂上。 */
import { CylinderGeometry, Mesh, MeshBasicMaterial, RingGeometry } from "three";
import type { FxStage } from "./FxStage";

export function debugMarkers(stage: FxStage, points: { x: number; y: number; label?: string }[]): () => void {
  const made: Mesh[] = [];
  // 地面相机现在是 y 向上的标准相机：正面网格无需 DoubleSide 也可见
  const ringMat = new MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.9, depthTest: false });
  const postMat = new MeshBasicMaterial({ color: 0x33ddff, transparent: true, opacity: 0.85, depthTest: false });
  for (const p of points) {
    if (stage.ground) { const ring = new Mesh(new RingGeometry(26, 30, 48), ringMat); ring.position.copy(stage.local(p.x, p.y, 1)); stage.ground.scene.add(ring); made.push(ring); }
    const post = new Mesh(new CylinderGeometry(4, 4, 90, 12), postMat);
    post.position.copy(stage.local(p.x, p.y, 45)); post.rotation.x = Math.PI / 2; // 圆柱默认沿 y；平面组内 z 朝观者，立起来
    stage.air.group.add(post); made.push(post);
  }
  stage.add({ update: () => true });
  return () => { for (const m of made) { m.parent?.remove(m); m.geometry.dispose(); } ringMat.dispose(); postMat.dispose(); };
}
