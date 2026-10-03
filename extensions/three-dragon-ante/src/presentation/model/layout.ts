/** 2.5D 平面布局模型（docs/design/VISUAL_SPEC.md §3）。
 * 只从投影推导物理位置：普通座位视图里对手永远是匿名牌背，全能视图才有对手正面。
 * 桌形继承原 3D 舞台的规则：2–3 人圆桌，4 人以上圆角方桌；方桌的侧边座位整体旋转 ±90°，顶边与本家保持正向（可读性）。 */
import type { Card } from "../../game/rules/cards";
import type { OmniscientView, PublicView, SeatView } from "../../game/rules/types";

export type Orientation = "landscape" | "portrait";
export type Zone = "hand" | "ante" | "flight" | "deck" | "discard" | "stakes" | "hole";
export interface Pose { x: number; y: number; rot: number; scale: number; z: number }
export interface Point { x: number; y: number }
export interface PlaneSpec { w: number; h: number; tilt: number; cardScaleHand: number }
export const PLANES: Record<Orientation, PlaneSpec> = {
  landscape: { w: 1800, h: 1100, tilt: 28, cardScaleHand: 1.15 },
  portrait: { w: 1100, h: 1500, tilt: 22, cardScaleHand: 1 },
};
export const CARD = { w: 140, h: 247 } as const;
export const OPPONENT_SCALE = 0.78;

export type TableShape = "round" | "square";
/** 原 `stage/layout.ts`：`players >= 4 ? "square" : "round"`。 */
export const tableShape = (players: number): TableShape => players >= 4 ? "square" : "round";

export type Edge = "bottom" | "left" | "top" | "right";
interface Anchor extends Point { edge: Edge }
/** 对手锚点：按本家顺时针次序排列（屏幕上左 → 上 → 右）。方桌边分布沿用原规则：4 人 左1 上1 右1、5 人 左1 上2 右1、6 人 左2 上1 右2。 */
const OPPONENT_ANCHORS: Record<Orientation, Record<number, Anchor[]>> = {
  landscape: {
    1: [{ x: 900, y: 150, edge: "top" }],
    2: [{ x: 520, y: 250, edge: "top" }, { x: 1280, y: 250, edge: "top" }],
    3: [{ x: 300, y: 520, edge: "left" }, { x: 900, y: 150, edge: "top" }, { x: 1500, y: 520, edge: "right" }],
    4: [{ x: 300, y: 520, edge: "left" }, { x: 620, y: 170, edge: "top" }, { x: 1180, y: 170, edge: "top" }, { x: 1500, y: 520, edge: "right" }],
    5: [{ x: 300, y: 660, edge: "left" }, { x: 300, y: 300, edge: "left" }, { x: 900, y: 150, edge: "top" }, { x: 1500, y: 300, edge: "right" }, { x: 1500, y: 660, edge: "right" }],
  },
  portrait: {
    1: [{ x: 550, y: 180, edge: "top" }],
    2: [{ x: 300, y: 260, edge: "top" }, { x: 800, y: 260, edge: "top" }],
    3: [{ x: 230, y: 330, edge: "top" }, { x: 550, y: 150, edge: "top" }, { x: 870, y: 330, edge: "top" }],
    4: [{ x: 200, y: 420, edge: "top" }, { x: 400, y: 200, edge: "top" }, { x: 700, y: 200, edge: "top" }, { x: 900, y: 420, edge: "top" }],
    5: [{ x: 180, y: 480, edge: "top" }, { x: 330, y: 230, edge: "top" }, { x: 550, y: 140, edge: "top" }, { x: 770, y: 230, edge: "top" }, { x: 920, y: 480, edge: "top" }],
  },
};
export const CENTER: Record<Orientation, { deck: Point; discard: Point; stakes: Point; hole: Point; neutral: Point; self: Point; fan: Point; fanRadius: number }> = {
  landscape: { deck: { x: 720, y: 500 }, discard: { x: 1080, y: 500 }, stakes: { x: 900, y: 470 }, hole: { x: 1260, y: 470 }, neutral: { x: 900, y: 640 }, self: { x: 900, y: 800 }, fan: { x: 900, y: 960 }, fanRadius: 900 },
  portrait: { deck: { x: 420, y: 700 }, discard: { x: 680, y: 700 }, stakes: { x: 550, y: 640 }, hole: { x: 820, y: 640 }, neutral: { x: 550, y: 820 }, self: { x: 550, y: 1090 }, fan: { x: 550, y: 1300 }, fanRadius: 700 },
};

/** 座位朝向：卡牌旋转角、牌阵排列方向（dir）、指向桌心的方向（inward）。 */
const FACING: Record<Edge, { rot: number; dir: Point; inward: Point }> = {
  bottom: { rot: 0, dir: { x: 1, y: 0 }, inward: { x: 0, y: -1 } },
  top: { rot: 0, dir: { x: 1, y: 0 }, inward: { x: 0, y: 1 } },
  left: { rot: 90, dir: { x: 0, y: 1 }, inward: { x: 1, y: 0 } },
  right: { rot: -90, dir: { x: 0, y: -1 }, inward: { x: -1, y: 0 } },
};
/** 座位局部坐标 → 平面坐标。局部 x 沿座位的右手方向，局部 y 指向桌心。 */
export function toPlane(anchor: Anchor, lx: number, ly: number): Point {
  switch (anchor.edge) {
    case "left": return { x: anchor.x + ly, y: anchor.y + lx };
    case "right": return { x: anchor.x - ly, y: anchor.y - lx };
    default: return { x: anchor.x + lx, y: anchor.y + ly };
  }
}

export interface SeatPlacement {
  id: string; self: boolean; index: number; scale: number;
  edge: Edge; rot: number; dir: Point; inward: Point;
  anchor: Point; plate: Point; ribbon: Point; ante: Pose; coins: Point; flight: Point; hand: Point;
  /** 牌阵每张的步进（平面单位，沿 dir） */
  flightStep: number;
}

const pose = (x: number, y: number, scale = 1, rot = 0, z = 0): Pose => ({ x, y, rot, scale, z });

/** 本家永远底部居中；对手按投影顺序顺时针（屏幕上从左到右）分布。 */
export function seatPlacements(view: PublicView, selfSeatId: string | null, orientation: Orientation): SeatPlacement[] {
  const seats = view.seats, n = seats.length, shape = tableShape(n);
  const selfIndex = Math.max(0, seats.findIndex(seat => seat.id === selfSeatId));
  const center = CENTER[orientation];
  const anchors = OPPONENT_ANCHORS[orientation][Math.max(1, Math.min(5, n - 1))] ?? [];
  const shared = anchors.filter(a => a.edge === "left").length > 1;
  return seats.map((seat, index) => {
    const self = selfSeatId !== null && seat.id === selfSeatId;
    const order = (index - selfIndex + n) % n; // 0 = self, 1.. clockwise
    if (self || (selfSeatId === null && index === 0)) {
      const a = center.self, f = FACING.bottom;
      // 圆桌：铭牌在左；方桌（4 人以上）左下有侧边座位，铭牌改到左下、扇面之外
      const plate = orientation === "landscape" ? (shape === "square" ? { x: a.x - 440, y: a.y + 150 } : { x: a.x - 600, y: a.y - 24 }) : { x: a.x - 470, y: a.y - 24 };
      return { id: seat.id, self, index, scale: 1, edge: "bottom", rot: 0, dir: f.dir, inward: f.inward, anchor: a, plate, ribbon: { x: plate.x, y: plate.y + 44 },
        ante: pose(a.x - 300, a.y, 1), coins: { x: a.x - 160, y: a.y }, flight: { x: a.x - 20, y: a.y }, hand: center.fan, flightStep: 82 };
    }
    const a = anchors[Math.min(anchors.length - 1, order - 1)] ?? { x: center.stakes.x, y: 150, edge: "top" as Edge };
    const f = FACING[a.edge], s = shared && a.edge !== "top" ? 0.72 : OPPONENT_SCALE, side = a.edge === "left" || a.edge === "right";
    const at = (lx: number, ly: number) => toPlane(a, lx, ly);
    // 对手：牌背在最远处（桌沿），铭牌与绶带压在牌背之上（translateZ 由 CSS 给），再往桌心是前注 / 牌阵；金币堆贴着铭牌放，不进牌区。
    const plate = at(0, -112);
    const ante = at(-150, 40);
    return { id: seat.id, self: false, index, scale: s, edge: a.edge, rot: f.rot, dir: f.dir, inward: f.inward, anchor: a, plate, ribbon: side ? { x: plate.x, y: plate.y + 36 } : at(0, -78),
      ante: pose(ante.x, ante.y, s, f.rot), coins: at(118, -112), flight: at(40, 40), hand: at(0, -162), flightStep: side ? 54 : 58 };
  });
}

export interface CardPlacement {
  /** 节点身份：公开牌用卡牌 id；匿名牌背用 `back:seat:i` / `ante:seat` / `deck`。 */
  key: string;
  cardId?: string;
  card: Card | null;
  zone: Zone;
  seatId?: string;
  pose: Pose;
  faceDown: boolean;
  /** 同区内的叠放次序 */
  order: number;
  /** 本家手牌：是否立起朝向镜头 */
  standing?: boolean;
  wild?: boolean;
  rider?: boolean;
}

function fanPose(i: number, n: number, orientation: Orientation): Pose {
  const center = CENTER[orientation], plane = PLANES[orientation];
  const stepDeg = Math.min(orientation === "landscape" ? 6 : 7, (orientation === "landscape" ? 54 : 62) / Math.max(1, n - 1));
  const a = (i - (n - 1) / 2) * stepDeg, rad = a * Math.PI / 180;
  const r = center.fanRadius;
  return { x: center.fan.x + Math.sin(rad) * r, y: center.fan.y + (1 - Math.cos(rad)) * r, rot: a, scale: plane.cardScaleHand, z: 40 + i * 3 };
}

/** 牌阵第 i 张的位姿（沿座位 dir 排列，随座位旋转）。 */
export function flightPose(seat: SeatPlacement, i: number, z = 2): Pose {
  return { x: seat.flight.x + seat.dir.x * i * seat.flightStep, y: seat.flight.y + seat.dir.y * i * seat.flightStep, rot: seat.rot, scale: seat.scale, z: z + i };
}

/** 每张可见卡一个位置。只有真实可见的物理位置才产生节点；`revealed` 列表不重复渲染。 */
export function cardPlacements(view: PublicView | SeatView | OmniscientView, orientation: Orientation): CardPlacement[] {
  const result: CardPlacement[] = [];
  const privateView = "selfSeatId" in view ? view as SeatView : null;
  const omniscient = "omniscient" in view && (view as OmniscientView).omniscient === true ? view as OmniscientView : null;
  const selfId = privateView?.selfSeatId ?? null;
  const seats = seatPlacements(view, selfId, orientation);
  const center = CENTER[orientation];
  const origins = new Map((view.anteOrigins ?? []).map(origin => [origin.cardId, origin.seatId]));

  for (const seat of seats) {
    const value = view.seats.find(s => s.id === seat.id)!;
    const backPose = (offset: number, i: number) => pose(seat.hand.x + seat.dir.x * offset * 26, seat.hand.y + seat.dir.y * offset * 26, 0.5, seat.rot + offset * 3, 1 + i);
    if (seat.self && privateView) {
      privateView.hand.forEach((card, i) => result.push({ key: card.id, cardId: card.id, card, zone: "hand", seatId: seat.id, pose: fanPose(i, privateView.hand.length, orientation), faceDown: false, order: i, standing: true }));
    } else if (omniscient && Array.isArray(omniscient.privateHands[seat.id])) {
      const hand = omniscient.privateHands[seat.id];
      hand.forEach((card, i) => { const offset = i - (hand.length - 1) / 2; result.push({ key: `hand:${seat.id}:${card.id}`, cardId: card.id, card, zone: "hand", seatId: seat.id, pose: backPose(offset, i), faceDown: false, order: i }); });
    } else {
      const count = Math.min(value.handCount, 10);
      for (let i = 0; i < count; i++) { const offset = i - (count - 1) / 2; result.push({ key: `back:${seat.id}:${i}`, card: null, zone: "hand", seatId: seat.id, pose: backPose(offset, i), faceDown: true, order: i }); }
    }
    if (value.committed) {
      const own = seat.self && privateView ? privateView.committedAnte : null;
      const known = omniscient?.privateCommittedAntes[seat.id] ?? null;
      const cardId = known?.id ?? own?.id;
      result.push({ key: cardId ?? `ante:${seat.id}`, cardId, card: known, zone: "ante", seatId: seat.id, pose: { ...seat.ante, z: 2 }, faceDown: true, order: 0 });
    }
    value.flight.forEach((entry, i) => result.push({ key: entry.cardId, cardId: entry.cardId, card: entry.card, zone: "flight", seatId: seat.id, pose: flightPose(seat, i), faceDown: false, order: i, wild: entry.wild, rider: entry.rider }));
  }
  if (view.deckCount > 0) result.push({ key: "deck", card: null, zone: "deck", pose: pose(center.deck.x, center.deck.y, 1, 0, 1), faceDown: true, order: 0 });
  const top = view.discard[view.discard.length - 1];
  if (top) result.push({ key: top.id, cardId: top.id, card: top, zone: "discard", pose: pose(center.discard.x, center.discard.y, 1, 4, 1), faceDown: false, order: 0 });
  const neutral = view.ante.filter(card => !seats.some(seat => seat.id === origins.get(card.id)));
  view.ante.forEach(card => {
    const seat = seats.find(seat => seat.id === origins.get(card.id));
    if (seat) result.push({ key: card.id, cardId: card.id, card, zone: "ante", seatId: seat.id, pose: { ...seat.ante, z: 3 }, faceDown: false, order: 1 });
    else { const i = neutral.findIndex(v => v.id === card.id); result.push({ key: card.id, cardId: card.id, card, zone: "ante", pose: pose(center.neutral.x + (i - (neutral.length - 1) / 2) * 110, center.neutral.y, 0.9, 0, 3 + i), faceDown: false, order: i }); }
  });
  return result;
}

/** 待确认判定：本家未回执的那张牌，不论投影把它画在手牌、前注还是牌阵，都要按住；只有进了弃牌堆才放行。 */
export function isHeldByPending(placement: Pick<CardPlacement, "cardId" | "seatId" | "zone">, pending: { cardId?: string } | null, selfSeatId: string | null): boolean {
  return !!pending?.cardId && !!selfSeatId && placement.cardId === pending.cardId && placement.seatId === selfSeatId && placement.zone !== "discard";
}

/** 待确认卡牌的位姿：只要本家有未回执的提交，这张牌就停在目标区域上方，
 *  不管投影把它画在哪（投影可能先于回执到达）。回执匹配后 pending 清空，牌才落到真实位姿。 */
export function pendingPose(view: PublicView | SeatView | OmniscientView, orientation: Orientation, pending: { cardId: string; zone?: "ante" | "flight" }): Pose | null {
  if (!("selfSeatId" in view) || !pending.zone) return null;
  const selfId = (view as SeatView).selfSeatId;
  const seat = seatPlacements(view, selfId, orientation).find(s => s.self); if (!seat) return null;
  if (pending.zone === "ante") return { ...seat.ante, y: seat.ante.y - 10, z: 60 };
  const flightCount = view.seats.find(s => s.id === selfId)?.flight.filter(f => f.cardId !== pending.cardId).length ?? 0;
  const p = flightPose(seat, flightCount, 60);
  return { ...p, y: p.y - 10, z: 60 };
}

/** 由视口尺寸决定方向与缩放。 */
export function fitPlane(width: number, height: number): { orientation: Orientation; scale: number; spec: PlaneSpec } {
  const orientation: Orientation = width < 640 || width < height * 0.9 ? "portrait" : "landscape";
  const spec = PLANES[orientation];
  // 倾斜后平面的投影高度约为 h * cos(tilt)；再为近端立起的手牌预留约三分之一的高度（立起的牌不被透视压缩）。
  const projectedH = spec.h * Math.cos(spec.tilt * Math.PI / 180) * (orientation === "landscape" ? 1.34 : 1.24);
  const scale = Math.min(width / spec.w, height / projectedH);
  return { orientation, scale, spec };
}
