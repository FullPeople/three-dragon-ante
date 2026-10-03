/** 布局重叠检查：把每个座位的区域（前注槽、牌阵槽、手牌背、铭牌、点数铭牌、金币）与中央牌堆（牌库、弃牌、奖池、偿债池）
 * 都算成平面上的**有向矩形**（随座位旋转），用分离轴定理判相交，报告不该相交的对；再检查区域四角是否落在毛毡内。
 * 自测对 2–6 人 × 横竖屏跑一遍，锚点调整后这里必须为空。 */
import type { PublicView } from "../../game/rules/types";
import { CARD, CENTER, PLANES, flightStepFor, seatPlacements, tableShape, type Orientation, type Point } from "./layout";

export interface OBox { id: string; c: Point; w: number; h: number; rot: number }
export interface Overlap { a: string; b: string; area: number }

const rad = (d: number) => d * Math.PI / 180;
export function corners(b: OBox): Point[] {
  const r = rad(b.rot), cs = Math.cos(r), sn = Math.sin(r), hw = b.w / 2, hh = b.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => ({ x: b.c.x + x * cs - y * sn, y: b.c.y + x * sn + y * cs }));
}
/** 分离轴：两个有向矩形是否相交；返回近似相交量（最小穿透深度 × 另一轴长度），只用于排序 */
export function obbOverlap(a: OBox, b: OBox): number {
  const ca = corners(a), cb = corners(b);
  const axes = [[Math.cos(rad(a.rot)), Math.sin(rad(a.rot))], [-Math.sin(rad(a.rot)), Math.cos(rad(a.rot))], [Math.cos(rad(b.rot)), Math.sin(rad(b.rot))], [-Math.sin(rad(b.rot)), Math.cos(rad(b.rot))]];
  let minPen = Infinity;
  for (const [ax, ay] of axes) {
    const pa = ca.map(p => p.x * ax + p.y * ay), pb = cb.map(p => p.x * ax + p.y * ay);
    const pen = Math.min(Math.max(...pa) - Math.min(...pb), Math.max(...pb) - Math.min(...pa));
    if (pen <= 0) return 0;
    minPen = Math.min(minPen, pen);
  }
  return Math.round(minPen * Math.min(a.w, a.h, b.w, b.h));
}

export function layoutBoxes(view: PublicView, selfSeatId: string, orientation: Orientation, flightCards = 3, backs = 6): OBox[] {
  const boxes: OBox[] = [];
  const center = CENTER[orientation];
  for (const seat of seatPlacements(view, selfSeatId, orientation)) {
    const s = seat.scale, tag = seat.self ? "self" : seat.id;
    boxes.push({ id: `${tag}:ante`, c: seat.ante, w: CARD.w * s + 16, h: CARD.h * s + 16, rot: seat.rot });
    const step = flightStepFor(seat, flightCards);
    const length = CARD.w * s + (flightCards - 1) * step + 24;
    const fc = { x: seat.flight.x + seat.dir.x * (flightCards - 1) * step / 2, y: seat.flight.y + seat.dir.y * (flightCards - 1) * step / 2 };
    boxes.push({ id: `${tag}:flight`, c: fc, w: length, h: CARD.h * s + 20, rot: seat.rot });
    // 本家铭牌在 CSS 里是左对齐（translate(0,-50%)），中心要往右挪半个宽度
    // 本家铭牌 CSS 限宽 160（名字超长省略）；对手铭牌 180
    boxes.push({ id: `${tag}:plate`, c: seat.self ? { x: seat.plate.x + 80, y: seat.plate.y } : seat.plate, w: seat.self ? 160 : 180, h: 36, rot: seat.plateRot });
    boxes.push({ id: `${tag}:ribbon`, c: seat.self ? { x: seat.ribbon.x + 36, y: seat.ribbon.y } : seat.ribbon, w: 72, h: 26, rot: seat.plateRot });
    boxes.push({ id: `${tag}:coins`, c: seat.coins, w: 70, h: 50, rot: 0 });
    const depthOut = CARD.h * s / 2 + 22;
    // 点数铭牌：本家在牌阵左端上方，对手在牌阵末端朝桌心一侧（与 SeatBlock 同一公式）
    const end = { x: seat.flight.x + seat.dir.x * ((flightCards - 1) * step + CARD.w * s / 2 - 34), y: seat.flight.y + seat.dir.y * ((flightCards - 1) * step + CARD.w * s / 2 - 34) };
    boxes.push({ id: `${tag}:strength`, c: seat.self ? { x: seat.flight.x + seat.dir.x * ((flightCards - 1) * step + CARD.w * s / 2 + 62), y: seat.flight.y } : { x: end.x + seat.inward.x * depthOut, y: end.y + seat.inward.y * depthOut }, w: 96, h: 30, rot: seat.rot });
    // 组合标签：牌阵起点朝桌心一侧
    boxes.push({ id: `${tag}:formation`, c: { x: seat.flight.x + seat.inward.x * depthOut, y: seat.flight.y + seat.inward.y * depthOut }, w: 92, h: 26, rot: seat.rot });
    if (!seat.self) {
      const bk = Math.min(1, s / 0.78);
      boxes.push({ id: `${tag}:hand`, c: seat.hand, w: (backs - 1) * 26 * bk + CARD.w * 0.5 * bk, h: CARD.h * 0.5 * bk, rot: seat.rot });
    }
  }
  boxes.push({ id: "deck", c: center.deck, w: CARD.w + 16, h: CARD.h + 16, rot: 0 });
  boxes.push({ id: "discard", c: center.discard, w: CARD.w + 16, h: CARD.h + 16, rot: 0 });
  boxes.push({ id: "stakes", c: { x: center.stakes.x, y: center.stakes.y + 20 }, w: 170, h: 110, rot: 0 });
  boxes.push({ id: "hole", c: { x: center.hole.x, y: center.hole.y + 16 }, w: 150, h: 90, rot: 0 });
  return boxes;
}

/** 允许相交的对：同座位的铭牌压在手牌背 / 金币上、金币贴着手牌背、点数铭牌贴在牌阵槽边 */
const allowed = (a: OBox, b: OBox) => { const sa = a.id.split(":"), sb = b.id.split(":"); if (sa[0] !== sb[0]) return false; const kinds = new Set([sa[1], sb[1]]); return kinds.has("plate") && (kinds.has("hand") || kinds.has("coins") || kinds.has("ribbon")) || kinds.has("ribbon") && (kinds.has("hand") || kinds.has("coins")) || kinds.has("coins") && kinds.has("hand") || (kinds.has("strength") || kinds.has("formation")) && kinds.has("flight") || kinds.has("strength") && kinds.has("formation"); };

export function layoutOverlaps(view: PublicView, selfSeatId: string, orientation: Orientation, flightCards = 3): Overlap[] {
  const boxes = layoutBoxes(view, selfSeatId, orientation, flightCards);
  const out: Overlap[] = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (allowed(boxes[i], boxes[j])) continue;
    const area = obbOverlap(boxes[i], boxes[j]);
    if (area >= 300) out.push({ a: boxes[i].id, b: boxes[j].id, area }); // 300 以下只是槽位边框互相擦到
  }
  return out;
}

/** 区域四角是否落在桌面毛毡内（圆桌用椭圆，方桌用圆角矩形的内接近似）。铭牌 / 手牌背 / 金币允许压在桌沿上。 */
export function outsideTable(view: PublicView, selfSeatId: string, orientation: Orientation): string[] {
  const plane = PLANES[orientation], shape = tableShape(view.seats.length), hx = plane.w / 2 - 74, hy = plane.h / 2 - 64, cx = plane.w / 2, cy = plane.h / 2;
  // 允许压到皮革包边上（椭圆放大 6%）；方桌按毛毡边
  const inside = (p: Point) => shape === "round" ? ((p.x - cx) / hx) ** 2 + ((p.y - cy) / hy) ** 2 <= 1.06 : Math.abs(p.x - cx) <= hx && Math.abs(p.y - cy) <= hy;
  return layoutBoxes(view, selfSeatId, orientation).filter(b => !/:(hand|plate|coins|ribbon)$/.test(b.id) && !b.id.startsWith("self:")).filter(b => corners(b).some(p => !inside(p))).map(b => b.id);
}
