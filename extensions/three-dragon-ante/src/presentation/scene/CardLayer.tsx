/** 卡牌节点层。两份：桌面层（平面里，preserve-3d）与手牌层（屏幕对齐的立板，z-index 叠放）。
 * 同一张牌换层时由本层识别来源：从手牌到桌面 = 抬起落下（dropIn）；到手牌 = 从下方升起（arriving）；
 * 抽牌 / 弃牌从牌库或奖池滑入；翻注时对手的匿名前注背换成真实牌 id，原地出现，不再"落下"一次。 */
import type { MutableRefObject } from "react";
import type { CardPlacement, Orientation, Pose, SeatPlacement } from "../model/layout";
import { CENTER, handShadowPose, isHeldByPending, pendingPose } from "../model/layout";
import { CardNode } from "./CardNode";
import type { UIState } from "../app/store";
import { omniscientGame, privateGame } from "../app/store";
import type { Controller } from "../app/controller";
import { cardName, t } from "../i18n";
import { card } from "../../game/rules/cards";

export interface KnownEntry { pose: Pose; layer: "table" | "hand" }
export interface CardLayerProps {
  state: UIState; controller: Controller; orientation: Orientation; layer: "table" | "hand";
  placements: CardPlacement[]; seats: SeatPlacement[];
  /** 上一帧每个 key 的位姿与所在层；由场景持有，两层共用 */
  known: MutableRefObject<Map<string, KnownEntry>>;
  onCardPointerDown(event: React.PointerEvent<HTMLDivElement>, cardId: string): void;
  onCardLand?(key: string, el: HTMLElement, zone: CardPlacement["zone"]): void;
}

export function CardLayer({ state, controller, orientation, layer, placements, seats, known, onCardPointerDown, onCardLand }: CardLayerProps) {
  const view = state.display, game = view?.game ?? null;
  const own = privateGame(view);
  const center = CENTER[orientation];
  const legal = new Set(controller.locked() ? [] : controller.legalCardIds());
  const reveal = state.show.revealPhase;
  const revealIds = new Set(state.show.reveal?.cardIds ?? []);
  const topIds = new Set(state.show.revealTopIds);
  const resolvingId = state.show.power?.cardId ?? null;
  const focusId = state.show.focusCardId;
  const gestures = state.gestures;
  const hints = new Map(own?.handPowerHints.map(hint => [hint.cardId, hint]) ?? []);
  const selfId = own?.selfSeatId ?? null;
  const inspection = omniscientGame(state.view) ?? omniscientGame(view);

  const nodes = placements.flatMap(placement => {
    const cardId = placement.cardId;
    const hiddenPrivateCard = !!inspection && state.revealOmniscientHands !== true && (placement.zone === "hand" || placement.zone === "ante" && placement.faceDown);
    const pendingHere = isHeldByPending(placement, state.pending, selfId);
    // 待确认的牌永远画在桌面层（停在目标区上方），哪怕投影还把它算在手牌里
    const target: "table" | "hand" = pendingHere ? "table" : placement.layer;
    if (target !== layer) return [];
    const previous = known.current.get(placement.key);
    let enterFrom: Pose | undefined, dropIn = false, dropFaceDown = false, arriving = false;
    const justArrived = !!placement.seatId && state.show.arrived.includes(placement.seatId) && placement.zone === "hand";
    if (layer === "hand") {
      if (!justArrived && (!previous || previous.layer !== "hand")) { enterFrom = { x: 0, y: 320, rot: 0, scale: 0.85, z: 0 }; arriving = true; }
    } else if (previous?.layer === "hand") { enterFrom = handShadowPose(orientation, previous.pose); dropIn = true; }
    else if (!previous && !justArrived) {
      const seat = placement.seatId ? seats.find(s => s.id === placement.seatId) : undefined;
      const fromSeat = seat && !seat.self;
      if (cardId && state.show.fromDeck.includes(cardId)) { enterFrom = { x: center.deck.x, y: center.deck.y, rot: 0, scale: 1, z: 30 }; dropIn = true; dropFaceDown = true; }
      else if (placement.zone === "ante" && placement.seatId && known.current.has(`ante:${placement.seatId}`)) enterFrom = undefined; // 翻注：匿名背换成真实牌，原地出现
      else if ((placement.zone === "ante" || placement.zone === "flight") && fromSeat) { enterFrom = { x: seat.hand.x, y: seat.hand.y, rot: seat.rot, scale: seat.scale, z: 30 }; dropIn = true; dropFaceDown = placement.zone === "flight"; }
      else if (placement.zone === "discard") enterFrom = { x: center.stakes.x, y: center.stakes.y, rot: 0, scale: 1, z: 30 };
      else if (placement.zone !== "deck") enterFrom = { x: center.deck.x, y: center.deck.y, rot: 0, scale: 1, z: 30 };
    }
    let pose = placement.pose, lifted = false;
    const isOwnHand = layer === "hand";
    if (!cardId && placement.zone === "hand" && placement.seatId) {
      const gesture = gestures[placement.seatId];
      if (gesture && (gesture.hover === placement.order || gesture.selected.includes(placement.order))) { lifted = true; pose = { ...pose, y: pose.y - 18, z: pose.z + 15 }; }
    }
    const tugged = !!state.show.tug && placement.zone === "hand" && placement.seatId === state.show.tug.seatId && placement.order === state.show.tug.index;
    if (tugged) { const seat = seats.find(s => s.id === placement.seatId); if (seat) pose = { ...pose, x: pose.x + seat.inward.x * 22, y: pose.y + seat.inward.y * 22, z: pose.z + 8 }; }
    const dragging = !!cardId && state.drag?.cardId === cardId;
    if (isOwnHand && dragging) pose = { ...pose, y: pose.y - 70, rot: 0, scale: pose.scale * 1.04 };
    else if (isOwnHand && cardId && (state.selected.includes(cardId) || state.keyboardHeld && state.keyboardCard === cardId)) pose = { ...pose, y: pose.y - 36 };
    else if (isOwnHand && cardId && state.hovered === cardId) pose = { ...pose, y: pose.y - 18, scale: pose.scale * 1.04 };
    // 提交 ≠ 接受：只要回执还没到，这张牌停在目标区上方，哪怕投影已经把它画进牌阵。
    if (pendingHere && game && state.pending?.cardId) { const held = pendingPose(game, orientation, { cardId: state.pending.cardId, zone: state.pending.zone }); if (held) pose = held; }
    // 聚焦：刚落地、将要发动能力的牌抬起放大
    if (cardId && focusId === cardId && placement.zone === "flight") pose = { ...pose, z: pose.z + 46, scale: pose.scale * 1.12 };
    const faceDownOverride = hiddenPrivateCard ? true : cardId && placement.zone === "ante" && revealIds.has(cardId) && reveal === "placing" ? true : inspection && placement.zone === "ante" && placement.faceDown && state.revealOmniscientHands === true ? false : undefined;
    const label = hiddenPrivateCard ? (state.lang === "zh" ? "牌背" : "Card back") : cardId ? (() => { try { const value = card(cardId); return `${cardName(cardId, state.lang)} · ${t("cardStrength", state.lang, { n: value.strength })}`; } catch { return undefined; } })() : undefined;
    return [<CardNode key={placement.key} placement={{ ...placement, pose, layer: target, standing: false }} enterFrom={enterFrom} dropIn={dropIn} dropFaceDown={dropFaceDown} arriving={arriving} faceDownOverride={faceDownOverride}
      selected={isOwnHand && !!cardId && state.selected.includes(cardId)} hovered={isOwnHand && !!cardId && state.hovered === cardId}
      legal={isOwnHand && !!cardId && legal.has(cardId)} pending={pendingHere} dragging={dragging}
      top={!!cardId && topIds.has(cardId) && reveal === "price"} resolving={!!cardId && cardId === resolvingId} focus={!!cardId && cardId === focusId} lifted={lifted}
      hint={!hiddenPrivateCard && isOwnHand && cardId ? hints.get(cardId) : undefined} label={label} wildLabel={t("wild", state.lang)} riderLabel={t("rider", state.lang)} tugged={tugged}
      onPointerDown={isOwnHand ? onCardPointerDown : undefined}
      onClick={cardId ? id => { if (isOwnHand) controller.selectCard(id); else if (!hiddenPrivateCard) controller.inspect(id, true); } : undefined}
      onHover={cardId ? id => { if (isOwnHand) controller.hover(id); else if (!hiddenPrivateCard) controller.inspect(id, false); } : undefined}
      onLand={onCardLand} />];
  });
  // 桌面层按 key 排序：一张牌换区（手牌 → 前注 → 弃牌堆）时在兄弟节点里的次序不变，React 不会移动 DOM 节点，正在进行的过渡不会被打断；前后遮挡由 translateZ 决定。
  // 手牌扇面保持手牌顺序：立板是平的，层叠靠 DOM 次序。
  return <>{layer === "table" ? nodes.sort((a, b) => String(a.key).localeCompare(String(b.key))) : nodes}</>;
}
