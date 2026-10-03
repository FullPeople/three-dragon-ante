/** 2.5D 平面布局模型（docs/design/VISUAL_SPEC.md §3）。
 * 只从投影推导物理位置：普通座位视图里对手永远是匿名牌背，全能视图才有对手正面。 */
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

const OPPONENT_ANCHORS: Record<Orientation, Record<number, Point[]>> = {
  landscape: {
    1: [{ x: 900, y: 150 }],
    2: [{ x: 470, y: 230 }, { x: 1330, y: 230 }],
    3: [{ x: 400, y: 330 }, { x: 900, y: 130 }, { x: 1400, y: 330 }],
    4: [{ x: 330, y: 430 }, { x: 620, y: 170 }, { x: 1180, y: 170 }, { x: 1470, y: 430 }],
    5: [{ x: 300, y: 500 }, { x: 520, y: 200 }, { x: 900, y: 120 }, { x: 1280, y: 200 }, { x: 1500, y: 500 }],
  },
  portrait: {
    1: [{ x: 550, y: 180 }],
    2: [{ x: 300, y: 260 }, { x: 800, y: 260 }],
    3: [{ x: 230, y: 330 }, { x: 550, y: 150 }, { x: 870, y: 330 }],
    4: [{ x: 200, y: 420 }, { x: 400, y: 200 }, { x: 700, y: 200 }, { x: 900, y: 420 }],
    5: [{ x: 180, y: 480 }, { x: 330, y: 230 }, { x: 550, y: 140 }, { x: 770, y: 230 }, { x: 920, y: 480 }],
  },
};
export const CENTER: Record<Orientation, { deck: Point; discard: Point; stakes: Point; hole: Point; neutral: Point; self: Point; fan: Point; fanRadius: number }> = {
  landscape: { deck: { x: 720, y: 500 }, discard: { x: 1080, y: 500 }, stakes: { x: 900, y: 470 }, hole: { x: 1260, y: 470 }, neutral: { x: 900, y: 640 }, self: { x: 900, y: 800 }, fan: { x: 900, y: 1000 }, fanRadius: 900 },
  portrait: { deck: { x: 420, y: 700 }, discard: { x: 680, y: 700 }, stakes: { x: 550, y: 640 }, hole: { x: 820, y: 640 }, neutral: { x: 550, y: 820 }, self: { x: 550, y: 1090 }, fan: { x: 550, y: 1330 }, fanRadius: 700 },
};

export interface SeatPlacement {
  id: string; self: boolean; index: number; scale: number;
  anchor: Point; plate: Point; ribbon: Point; ante: Pose; coins: Point; flight: Point; hand: Point;
  /** 牌阵每张的横向步进（平面单位） */
  flightStep: number;
}

const pose = (x: number, y: number, scale = 1, rot = 0, z = 0): Pose => ({ x, y, rot, scale, z });

/** 本家永远底部居中；对手按投影顺序顺时针（屏幕上从左到右）分布。 */
export function seatPlacements(view: PublicView, selfSeatId: string | null, orientation: Orientation): SeatPlacement[] {
  const seats = view.seats, n = seats.length;
  const selfIndex = Math.max(0, seats.findIndex(seat => seat.id === selfSeatId));
  const center = CENTER[orientation];
  const anchors = OPPONENT_ANCHORS[orientation][Math.max(1, Math.min(5, n - 1))] ?? [];
  return seats.map((seat, index) => {
    const self = selfSeatId !== null && seat.id === selfSeatId;
    const order = (index - selfIndex + n) % n; // 0 = self, 1.. clockwise
    if (self || (selfSeatId === null && index === 0)) {
      const a = center.self;
      const plateX = orientation === "landscape" ? a.x - 600 : a.x - 470;
      return { id: seat.id, self, index, scale: 1, anchor: a, plate: { x: plateX, y: a.y - 24 }, ribbon: { x: plateX, y: a.y + 24 },
        ante: pose(a.x - 300, a.y, 1), coins: { x: a.x - 160, y: a.y }, flight: { x: a.x - 20, y: a.y }, hand: center.fan, flightStep: 82 };
    }
    const a = anchors[Math.min(anchors.length - 1, order - 1)] ?? { x: center.stakes.x, y: 150 };
    const s = OPPONENT_SCALE;
    // 对手：牌背在最远处（桌沿），铭牌与绶带压在牌背之上（translateZ 由 CSS 给），再往桌心是暗置 / 金币 / 牌阵。
    return { id: seat.id, self: false, index, scale: s, anchor: a, plate: { x: a.x, y: a.y - 112 }, ribbon: { x: a.x, y: a.y - 78 },
      ante: pose(a.x - 150, a.y + 40, s), coins: { x: a.x - 40, y: a.y + 40 }, flight: { x: a.x + 40, y: a.y + 40 }, hand: { x: a.x, y: a.y - 162 }, flightStep: 58 };
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
  return { x: center.fan.x + Math.sin(rad) * r, y: center.fan.y + (1 - Math.cos(rad)) * r, rot: a, scale: plane.cardScaleHand, z: 40 + i };
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
    if (seat.self && privateView) {
      privateView.hand.forEach((card, i) => result.push({ key: card.id, cardId: card.id, card, zone: "hand", seatId: seat.id, pose: fanPose(i, privateView.hand.length, orientation), faceDown: false, order: i, standing: true }));
    } else if (omniscient && Array.isArray(omniscient.privateHands[seat.id])) {
      const hand = omniscient.privateHands[seat.id];
      hand.forEach((card, i) => { const offset = i - (hand.length - 1) / 2; result.push({ key: `hand:${seat.id}:${card.id}`, cardId: card.id, card, zone: "hand", seatId: seat.id, pose: pose(seat.hand.x + offset * 26, seat.hand.y, 0.5, offset * 3, 1 + i), faceDown: false, order: i }); });
    } else {
      const count = Math.min(value.handCount, 10);
      for (let i = 0; i < count; i++) { const offset = i - (count - 1) / 2; result.push({ key: `back:${seat.id}:${i}`, card: null, zone: "hand", seatId: seat.id, pose: pose(seat.hand.x + offset * 26, seat.hand.y, 0.5, offset * 3, 1 + i), faceDown: true, order: i }); }
    }
    if (value.committed) {
      const own = seat.self && privateView ? privateView.committedAnte : null;
      const known = omniscient?.privateCommittedAntes[seat.id] ?? null;
      const cardId = known?.id ?? own?.id;
      result.push({ key: cardId ?? `ante:${seat.id}`, cardId, card: known, zone: "ante", seatId: seat.id, pose: { ...seat.ante, z: 2 }, faceDown: true, order: 0 });
    }
    value.flight.forEach((entry, i) => result.push({ key: entry.cardId, cardId: entry.cardId, card: entry.card, zone: "flight", seatId: seat.id, pose: pose(seat.flight.x + i * seat.flightStep, seat.flight.y, seat.scale, 0, 2 + i), faceDown: false, order: i, wild: entry.wild, rider: entry.rider }));
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

/** 由视口尺寸决定方向与缩放。 */
export function fitPlane(width: number, height: number): { orientation: Orientation; scale: number; spec: PlaneSpec } {
  const orientation: Orientation = width < 640 || width < height * 0.9 ? "portrait" : "landscape";
  const spec = PLANES[orientation];
  // 倾斜后平面的投影高度约为 h * cos(tilt)；再为近端立起的手牌预留约五分之一的高度。
  const projectedH = spec.h * Math.cos(spec.tilt * Math.PI / 180) * (orientation === "landscape" ? 1.22 : 1.16);
  const scale = Math.min(width / spec.w, height / projectedH);
  return { orientation, scale, spec };
}
