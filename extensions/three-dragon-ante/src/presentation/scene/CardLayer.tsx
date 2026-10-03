/** 所有卡牌节点的单一层。新出现的节点从合理的来源位置进场：抽牌从牌库飞入，
 * 对手打出 / 前注的牌从它的手牌位置抽出再落下；翻注时同一位置的节点先面朝下再翻开，避免"凭空出现"。 */
import { useMemo, useRef } from "react";
import type { CardPlacement, Orientation, Pose } from "../model/layout";
import { CENTER, cardPlacements, isHeldByPending, pendingPose, seatPlacements } from "../model/layout";
import { CardNode } from "./CardNode";
import type { UIState } from "../app/store";
import { privateGame } from "../app/store";
import type { Controller } from "../app/controller";
import { cardName, t } from "../i18n";
import { card } from "../../game/rules/cards";

export interface CardLayerProps { state: UIState; controller: Controller; orientation: Orientation; onCardPointerDown(event: React.PointerEvent<HTMLDivElement>, cardId: string): void; onCardLand?(key: string, el: HTMLElement, zone: CardPlacement["zone"]): void }

export function CardLayer({ state, controller, orientation, onCardPointerDown, onCardLand }: CardLayerProps) {
  const view = state.display, game = view?.game ?? null;
  const own = privateGame(view);
  const placements = useMemo(() => game ? cardPlacements(game, orientation) : [], [game, orientation]);
  const seats = useMemo(() => game ? seatPlacements(game, own?.selfSeatId ?? null, orientation) : [], [game, own?.selfSeatId, orientation]);
  const known = useRef(new Map<string, Pose>());
  const center = CENTER[orientation];
  const legal = new Set(controller.locked() ? [] : controller.legalCardIds());
  const reveal = state.show.revealPhase;
  const revealIds = new Set(state.show.reveal?.cardIds ?? []);
  const topIds = new Set(state.show.revealTopIds);
  const resolvingId = state.show.power?.cardId ?? null;
  const focusId = state.show.focusCardId;
  const gestures = state.gestures;
  const hints = new Map(own?.handPowerHints.map(hint => [hint.cardId, hint]) ?? []);

  const next = new Map<string, Pose>();
  const nodes = placements.map(placement => {
    let enterFrom: Pose | undefined, dropIn = false;
    const previous = known.current.get(placement.key);
    if (!previous) {
      const seat = placement.seatId ? seats.find(s => s.id === placement.seatId) : undefined;
      const fromSeat = seat && !seat.self;
      if ((placement.zone === "ante" || placement.zone === "flight") && fromSeat) { enterFrom = { x: seat.hand.x, y: seat.hand.y, rot: seat.rot, scale: seat.scale, z: 30 }; dropIn = true; }
      else if (placement.zone === "ante" && seat) enterFrom = { ...seat.ante, z: 2 };
      else if (placement.zone === "discard") enterFrom = { x: center.stakes.x, y: center.stakes.y, rot: 0, scale: 1, z: 30 };
      else if (placement.zone !== "deck") enterFrom = { x: center.deck.x, y: center.deck.y, rot: 0, scale: 1, z: 30 };
    }
    next.set(placement.key, placement.pose);
    const cardId = placement.cardId;
    const isOwnHand = placement.zone === "hand" && !!own && placement.seatId === own.selfSeatId;
    let pose = placement.pose, lifted = false;
    if (!placement.cardId && placement.zone === "hand" && placement.seatId) {
      const gesture = gestures[placement.seatId];
      if (gesture && (gesture.hover === placement.order || gesture.selected.includes(placement.order))) { lifted = true; pose = { ...pose, y: pose.y - 18, z: pose.z + 15 }; }
    }
    const dragging = !!cardId && state.drag?.cardId === cardId;
    if (dragging) pose = { ...pose, y: pose.y - 70, z: pose.z + 60, rot: 0, scale: pose.scale * 1.04 };
    else if (isOwnHand && cardId && (state.selected.includes(cardId) || state.keyboardHeld && state.keyboardCard === cardId)) pose = { ...pose, y: pose.y - 36, z: pose.z + 30 };
    else if (isOwnHand && cardId && state.hovered === cardId) pose = { ...pose, y: pose.y - 18, z: pose.z + 20, scale: pose.scale * 1.04 };
    // 提交 ≠ 接受：只要回执还没到，这张牌停在目标区上方，哪怕投影已经把它画进牌阵。
    const pendingHere = isHeldByPending(placement, state.pending, own?.selfSeatId ?? null);
    if (pendingHere && game && state.pending?.cardId) { const held = pendingPose(game, orientation, { cardId: state.pending.cardId, zone: state.pending.zone }); if (held) pose = held; }
    // 聚焦：刚落地、将要发动能力的牌抬起放大
    if (cardId && focusId === cardId && placement.zone === "flight") pose = { ...pose, z: pose.z + 46, scale: pose.scale * 1.12 };
    const faceDownOverride = cardId && placement.zone === "ante" && revealIds.has(cardId) && reveal === "placing" ? true : undefined;
    const label = cardId ? (() => { try { const value = card(cardId); return `${cardName(cardId, state.lang)} · ${t("cardStrength", state.lang, { n: value.strength })}`; } catch { return undefined; } })() : undefined;
    return <CardNode key={placement.key} placement={{ ...placement, pose, standing: pendingHere ? false : isOwnHand ? true : placement.standing }} enterFrom={enterFrom} dropIn={dropIn} faceDownOverride={faceDownOverride}
      selected={isOwnHand && !!cardId && state.selected.includes(cardId)} hovered={isOwnHand && !!cardId && state.hovered === cardId}
      legal={isOwnHand && !!cardId && legal.has(cardId)} pending={pendingHere} dragging={dragging}
      top={!!cardId && topIds.has(cardId) && reveal === "price"} resolving={!!cardId && cardId === resolvingId} focus={!!cardId && cardId === focusId} lifted={lifted}
      hint={isOwnHand && cardId ? hints.get(cardId) : undefined} label={label}
      onPointerDown={isOwnHand ? onCardPointerDown : undefined}
      onClick={cardId ? id => { if (isOwnHand) controller.selectCard(id); else controller.inspect(id, true); } : undefined}
      onHover={cardId ? id => { if (isOwnHand) controller.hover(id); else controller.inspect(id, false); } : undefined}
      onLand={onCardLand} />;
  });
  known.current = next;
  return <div className="tda-card-layer">{nodes}</div>;
}
