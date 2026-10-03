/** 2.5D 平面布局模型（docs/design/VISUAL_SPEC.md §3）。
 * 只从投影推导物理位置：普通座位视图里对手永远是匿名牌背，全能视图才有对手正面。
 * 桌形继承原 3D 舞台的规则：2–3 人圆桌，4 人以上圆角方桌。
 * 每个座位有自己的朝向 θ（卡牌顶边指向桌心）：本家 0°，方桌侧边 ±90°、顶边 180°，圆桌对手按位置角；
 * 手牌背、前注、牌阵、点数铭牌、组合标签都随 θ 旋转，姓名铭牌与状态绶带保持正向（UI 铭牌）。 */
import type { Card } from "../../game/rules/cards";
import type { OmniscientView, PublicView, SeatView } from "../../game/rules/types";

export type Orientation = "landscape" | "portrait";
export type Zone = "hand" | "ante" | "flight" | "deck" | "discard" | "stakes" | "hole";
export interface Pose { x: number; y: number; rot: number; scale: number; z: number }
export interface Point { x: number; y: number }
export interface PlaneSpec { w: number; h: number; tilt: number; cardScaleHand: number }
export const PLANES: Record<Orientation, PlaneSpec> = {
  landscape: { w: 1800, h: 1100, tilt: 28, cardScaleHand: 1.0 },
  portrait: { w: 1100, h: 1500, tilt: 22, cardScaleHand: 1 },
};
export const CARD = { w: 140, h: 247 } as const;
export const OPPONENT_SCALE = 0.78;

export type TableShape = "round" | "square";
/** 原 `stage/layout.ts`：`players >= 4 ? "square" : "round"`。 */
export const tableShape = (players: number): TableShape => players >= 4 ? "square" : "round";

export type Edge = "bottom" | "left" | "top" | "right" | "round";
/** 对手锚点：平面坐标、朝向 θ（卡牌顶边指向桌心）、可选缩放。按本家顺时针次序排列（屏幕上左 → 上 → 右）。
 *  方桌边分布沿用原规则：4 人 左1 上1 右1、5 人 左1 上2 右1、6 人 左2 上1 右2；圆桌对手按位置角。 */
interface Anchor extends Point { edge: Edge; rot: number; scale?: number }
const OPPONENT_ANCHORS: Record<Orientation, Record<number, Anchor[]>> = {
  landscape: {
    1: [{ x: 900, y: 200, edge: "top", rot: 180 }],
    2: [{ x: 490, y: 265, edge: "round", rot: 150 }, { x: 1310, y: 265, edge: "round", rot: -150 }],
    3: [{ x: 300, y: 560, edge: "left", rot: 90 }, { x: 900, y: 200, edge: "top", rot: 180 }, { x: 1500, y: 560, edge: "right", rot: -90 }],
    4: [{ x: 300, y: 640, edge: "left", rot: 90 }, { x: 620, y: 190, edge: "top", rot: 180 }, { x: 1180, y: 190, edge: "top", rot: 180 }, { x: 1500, y: 640, edge: "right", rot: -90 }],
    5: [{ x: 300, y: 790, edge: "left", rot: 90, scale: 0.72 }, { x: 300, y: 300, edge: "left", rot: 90, scale: 0.72 }, { x: 900, y: 190, edge: "top", rot: 180 }, { x: 1500, y: 300, edge: "right", rot: -90, scale: 0.72 }, { x: 1500, y: 790, edge: "right", rot: -90, scale: 0.72 }],
  },
  // 竖屏：平面 1100 × 1500，左右两侧有大量纵向空间——对手各占一边（侧边 ±90°、顶边 180°），不斜对本家；两人以上每边最多两席
  portrait: {
    1: [{ x: 550, y: 230, edge: "top", rot: 180 }],
    2: [{ x: 175, y: 640, edge: "left", rot: 90, scale: 0.62 }, { x: 925, y: 640, edge: "right", rot: -90, scale: 0.62 }],
    3: [{ x: 175, y: 650, edge: "left", rot: 90, scale: 0.6 }, { x: 550, y: 200, edge: "top", rot: 180, scale: 0.62 }, { x: 925, y: 650, edge: "right", rot: -90, scale: 0.6 }],
    4: [{ x: 175, y: 700, edge: "left", rot: 90, scale: 0.56 }, { x: 330, y: 215, edge: "top", rot: 180, scale: 0.55 }, { x: 770, y: 215, edge: "top", rot: 180, scale: 0.55 }, { x: 925, y: 700, edge: "right", rot: -90, scale: 0.56 }],
    5: [{ x: 175, y: 760, edge: "left", rot: 90, scale: 0.5 }, { x: 175, y: 370, edge: "left", rot: 90, scale: 0.5 }, { x: 550, y: 190, edge: "top", rot: 180, scale: 0.55 }, { x: 925, y: 370, edge: "right", rot: -90, scale: 0.5 }, { x: 925, y: 760, edge: "right", rot: -90, scale: 0.5 }],
  },
};
export const CENTER: Record<Orientation, { table: Point; deck: Point; discard: Point; stakes: Point; hole: Point; neutral: Point; self: Point; fan: Point; fanRadius: number }> = {
  landscape: { table: { x: 900, y: 550 }, deck: { x: 720, y: 520 }, discard: { x: 1080, y: 520 }, stakes: { x: 900, y: 430 }, hole: { x: 1250, y: 580 }, neutral: { x: 900, y: 650 }, self: { x: 900, y: 800 }, fan: { x: 900, y: 1000 }, fanRadius: 900 },
  portrait: { table: { x: 550, y: 750 }, deck: { x: 398, y: 822 }, discard: { x: 702, y: 822 }, stakes: { x: 550, y: 608 }, hole: { x: 550, y: 870 }, neutral: { x: 550, y: 960 }, self: { x: 550, y: 1090 }, fan: { x: 550, y: 1340 }, fanRadius: 700 },
};

const rad = (deg: number) => deg * Math.PI / 180;
/** 座位朝向 θ（度）：卡牌顶边指向桌心。锚点表里显式给出；没有的按位置角推算。 */
export function seatAngle(anchor: Anchor, table: Point): number {
  if (Number.isFinite(anchor.rot)) return anchor.rot;
  switch (anchor.edge) {
    case "bottom": return 0;
    case "left": return 90;
    case "right": return -90;
    case "top": return 180;
    default: return Math.round(Math.atan2(table.x - anchor.x, -(table.y - anchor.y)) * 180 / Math.PI);
  }
}
/** 铭牌旋转：跟随座位角但不倒置 */
export const plateAngle = (rot: number) => { let a = ((rot - 180) % 360 + 540) % 360 - 180; if (a <= -90) a += 180; if (a > 90) a -= 180; return a; };
/** 右手方向（局部 +x）与朝向桌心方向（局部 +y） */
export const facing = (rot: number) => ({ dir: { x: Math.cos(rad(rot)), y: Math.sin(rad(rot)) }, inward: { x: Math.sin(rad(rot)), y: -Math.cos(rad(rot)) } });
/** 座位局部坐标 → 平面坐标。局部 x 沿座位的右手方向，局部 y 指向桌心。 */
export function toPlane(anchor: Point, rot: number, lx: number, ly: number): Point {
  const f = facing(rot);
  return { x: anchor.x + f.dir.x * lx + f.inward.x * ly, y: anchor.y + f.dir.y * lx + f.inward.y * ly };
}

export interface SeatPlacement {
  id: string; self: boolean; index: number; scale: number;
  edge: Edge; rot: number; dir: Point; inward: Point;
  /** 铭牌 / 绶带 / 点数铭牌的旋转：跟随座位角但永不倒置（θ − 180 归一到 (-90, 90]） */
  plateRot: number;
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
  return seats.map((seat, index) => {
    const self = selfSeatId !== null && seat.id === selfSeatId;
    const order = (index - selfIndex + n) % n; // 0 = self, 1.. clockwise
    if (self || (selfSeatId === null && index === 0)) {
      const a = center.self, f = facing(0);
      // 圆桌：铭牌在左；方桌（4 人以上）左下有侧边座位，铭牌改到左下、扇面之外
      // 本家铭牌是左对齐的（translate(0,-50%)）：圆桌放左侧；方桌左下有侧席，放右下扇面之外；竖屏放左上角、前注槽上方
      if (orientation === "portrait") {
        // 竖屏：本家一整行从左到右「铭牌 | 前注 | 金币 | 牌阵 | 点数」。铭牌靠左（透视下平面底边比屏幕宽，x<40 会被切掉）；左侧对手的牌阵是往下伸的，放前注上方会被压到
        const plate = { x: 40, y: a.y };
        return { id: seat.id, self, index, scale: 1, edge: "bottom", rot: 0, dir: f.dir, inward: f.inward, plateRot: 0, anchor: a, plate, ribbon: { x: plate.x, y: plate.y + 44 },
          ante: pose(a.x - 240, a.y, 1), coins: { x: a.x - 90, y: a.y }, flight: { x: a.x + 26, y: a.y }, hand: center.fan, flightStep: 82 };
      }
      // 方桌：右下有侧席、正下方是手牌扇面，铭牌放前注槽左上角——左侧席的标签列（x≤471）与牌库（x≥642）之间，铭牌限宽 160
      const plate = shape === "square" ? { x: a.x - 424, y: a.y - 190 } : { x: a.x - 600, y: a.y - 24 };
      const ribbon = shape === "square" ? { x: plate.x, y: plate.y + 40 } : { x: plate.x, y: plate.y + 44 };
      return { id: seat.id, self, index, scale: 1, edge: "bottom", rot: 0, dir: f.dir, inward: f.inward, plateRot: 0, anchor: a, plate, ribbon,
        ante: pose(a.x - 300, a.y, 1), coins: { x: a.x - 160, y: a.y }, flight: { x: a.x - 20, y: a.y }, hand: center.fan, flightStep: 82 };
    }
    const a = anchors[Math.min(anchors.length - 1, order - 1)] ?? { x: center.stakes.x, y: 190, edge: "top" as Edge, rot: 180 };
    const rot = seatAngle(a, center.table), f = facing(rot);
    const s = a.scale ?? OPPONENT_SCALE, top = Math.abs(rot) === 180, k = s / OPPONENT_SCALE;
    // 座位块内的偏移随缩放收紧（相对标准 0.78）；侧向座位的正向铭牌是横的，放得更靠外才不会压到牌阵
    const at = (lx: number, ly: number) => toPlane(a, rot, lx * k, ly * k);
    // 铭牌、绶带、金币压在手牌背之上，随座位角旋转但不倒置；它们是固定大小的 UI 件，深度不随座位缩放
    const plate = toPlane(a, rot, 0, -112), ribbon = toPlane(a, rot, 0, -76);
    const ante = at(-150, 40);
    return { id: seat.id, self: false, index, scale: s, edge: a.edge, rot, dir: f.dir, inward: f.inward, plateRot: plateAngle(rot), anchor: a, plate, ribbon,
      ante: pose(ante.x, ante.y, s, rot), coins: toPlane(a, rot, 118, -112), flight: at(40, 40), hand: at(0, -162), flightStep: Math.round((top ? 58 : 54) * k) };
  });
}

export interface CardPlacement {
  /** 节点身份：公开牌用卡牌 id；匿名牌背用 `back:seat:i` / `ante:seat` / `deck`。 */
  key: string;
  /** 画在桌面平面里，还是本家的手牌立板上 */
  layer: "table" | "hand";
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

/** 本家手牌：扇面画在一块独立的、屏幕对齐的立板上（不进桌面的 3D 上下文，永不被桌面切片，叠放靠 z-index）。
 *  位姿相对扇面枢轴（CENTER.fan）；z 永远 0，叠放次序 = order。 */
export function fanPose(i: number, n: number, orientation: Orientation): Pose {
  const center = CENTER[orientation], plane = PLANES[orientation];
  const stepDeg = Math.min(orientation === "landscape" ? 6 : 7, (orientation === "landscape" ? 54 : 62) / Math.max(1, n - 1));
  const a = (i - (n - 1) / 2) * stepDeg, r = center.fanRadius;
  return { x: Math.sin(rad(a)) * r, y: (1 - Math.cos(rad(a))) * r, rot: a, scale: plane.cardScaleHand, z: 0 };
}
/** 手牌立板在视口（透视容器）里的位置：枢轴点经桌面倾斜后的投影位置与深度，再抬高 40 单位。 */
export function handLayerPlacement(orientation: Orientation): { left: number; top: number; z: number } {
  const center = CENTER[orientation], plane = PLANES[orientation], cy = plane.h / 2, tilt = rad(plane.tilt);
  return { left: center.fan.x, top: cy + (center.fan.y - cy) * Math.cos(tilt), z: (center.fan.y - cy) * Math.sin(tilt) + 40 };
}
/** 一张手牌离开扇面时，在桌面坐标里的起点（扇面在桌面上的"影子"位置）。 */
export function handShadowPose(orientation: Orientation, pose: Pose): Pose {
  const center = CENTER[orientation];
  return { x: center.fan.x + pose.x, y: center.fan.y - 120 + pose.y * 0.4, rot: 0, scale: 1.05, z: 20 };
}

/** 牌阵步进：超过 4 张（加赛）时收紧到 4 张的总长度，不往邻座伸 */
export const flightStepFor = (seat: Pick<SeatPlacement, "flightStep">, count: number) => count > 4 ? seat.flightStep * 3 / (count - 1) : seat.flightStep;
/** 牌阵第 i 张的位姿（沿座位 dir 排列，随座位旋转）。 */
export function flightPose(seat: SeatPlacement, i: number, z = 2, count = i + 1): Pose {
  const step = flightStepFor(seat, count);
  return { x: seat.flight.x + seat.dir.x * i * step, y: seat.flight.y + seat.dir.y * i * step, rot: seat.rot, scale: seat.scale, z: z + i };
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
    const bk = Math.min(1, seat.scale / OPPONENT_SCALE), backScale = 0.5 * bk, backGap = 26 * bk;
    const backPose = (offset: number, i: number) => pose(seat.hand.x + seat.dir.x * offset * backGap, seat.hand.y + seat.dir.y * offset * backGap, backScale, seat.rot + offset * 3, 1 + i);
    if (seat.self && privateView) {
      privateView.hand.forEach((card, i) => result.push({ key: card.id, layer: "hand", cardId: card.id, card, zone: "hand", seatId: seat.id, pose: fanPose(i, privateView.hand.length, orientation), faceDown: false, order: i, standing: false }));
    } else if (omniscient && Array.isArray(omniscient.privateHands[seat.id])) {
      const hand = omniscient.privateHands[seat.id];
      hand.forEach((card, i) => { const offset = i - (hand.length - 1) / 2; result.push({ layer: "table", key: `hand:${seat.id}:${card.id}`, cardId: card.id, card, zone: "hand", seatId: seat.id, pose: backPose(offset, i), faceDown: false, order: i }); });
    } else {
      const count = Math.min(value.handCount, 10);
      for (let i = 0; i < count; i++) { const offset = i - (count - 1) / 2; result.push({ layer: "table", key: `back:${seat.id}:${i}`, card: null, zone: "hand", seatId: seat.id, pose: backPose(offset, i), faceDown: true, order: i }); }
    }
    if (value.committed) {
      const own = seat.self && privateView ? privateView.committedAnte : null;
      const known = omniscient?.privateCommittedAntes[seat.id] ?? null;
      const cardId = known?.id ?? own?.id;
      result.push({ layer: "table", key: cardId ?? `ante:${seat.id}`, cardId, card: known, zone: "ante", seatId: seat.id, pose: { ...seat.ante, z: 2 }, faceDown: true, order: 0 });
    }
    value.flight.forEach((entry, i) => result.push({ layer: "table", key: entry.cardId, cardId: entry.cardId, card: entry.card, zone: "flight", seatId: seat.id, pose: flightPose(seat, i, 2, value.flight.length), faceDown: false, order: i, wild: entry.wild, rider: entry.rider }));
  }
  if (view.deckCount > 0) result.push({ layer: "table", key: "deck", card: null, zone: "deck", pose: pose(center.deck.x, center.deck.y, 1, 0, 1), faceDown: true, order: 0 });
  const top = view.discard[view.discard.length - 1];
  if (top) result.push({ layer: "table", key: top.id, cardId: top.id, card: top, zone: "discard", pose: pose(center.discard.x, center.discard.y, 1, 4, 1), faceDown: false, order: 0 });
  const neutral = view.ante.filter(card => !seats.some(seat => seat.id === origins.get(card.id)));
  view.ante.forEach(card => {
    const seat = seats.find(seat => seat.id === origins.get(card.id));
    if (seat) result.push({ layer: "table", key: card.id, cardId: card.id, card, zone: "ante", seatId: seat.id, pose: { ...seat.ante, z: 3 }, faceDown: false, order: 1 });
    else { const i = neutral.findIndex(v => v.id === card.id); result.push({ layer: "table", key: card.id, cardId: card.id, card, zone: "ante", pose: pose(center.neutral.x + (i - (neutral.length - 1) / 2) * 110, center.neutral.y, 0.9, 0, 3 + i), faceDown: false, order: i }); }
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
  const p = flightPose(seat, flightCount, 60, flightCount + 1);
  return { ...p, y: p.y - 10, z: 60 };
}

/** 由视口尺寸决定方向与缩放。 */
export function fitPlane(width: number, height: number): { orientation: Orientation; scale: number; spec: PlaneSpec } {
  const orientation: Orientation = width < 640 || width < height * 0.9 ? "portrait" : "landscape";
  const spec = PLANES[orientation];
  // 倾斜后平面的投影高度约为 h * cos(tilt)；再为近端立起的手牌预留约三分之一的高度（立起的牌不被透视压缩）。
  const projectedH = spec.h * Math.cos(rad(spec.tilt)) * (orientation === "landscape" ? 1.34 : 1.24);
  const scale = Math.min(width / spec.w, height / projectedH);
  return { orientation, scale, spec };
}
