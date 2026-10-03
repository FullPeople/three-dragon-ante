/** 表现层本地状态。宿主只通过 `TableView` 进来、`TableUICommand` 出去；这里不持有任何规则状态。 */
import { useSyncExternalStore } from "react";
import type { TableView } from "../../game/protocol";
import type { GameAction, OmniscientView, PublicView, ScoreReport, SeatView } from "../../game/rules/types";
import type { HandGesture } from "../../game/gesture";
import type { FormationCue, PowerCue, RoundCue, RevealCue } from "../model/cues";
import type { Orientation, Pose } from "../model/layout";
import type { Lang } from "../i18n";

export interface PendingAction { actionId: string; tableId: string; gameId: string; revision: number; cardId?: string; zone?: "ante" | "flight"; action: GameAction; retryable: boolean }
export interface DragState { cardId: string; x: number; y: number; legal: boolean; overZone: "ante" | "flight" | null }
export type RevealPhase = "placing" | "revealing" | "price" | "payment" | "discard";
/** 桌面拼点：每个条目一个浮现的数字；step 1 数字出现，step 2 打标（领出 / 胜 / 并列划掉 / 不能获胜）。 */
export interface TallyItem { seatId: string; cardId?: string; value: number; mark: "none" | "lead" | "win" | "tied" | "out" }
export interface TallyState { kind: "reveal" | "score"; step: 1 | 2; items: TallyItem[] }
export interface ShowState {
  reveal: RevealCue | null;
  revealPhase: RevealPhase | null;
  revealTopIds: string[];
  power: PowerCue | null;
  resolvingSeatId: string | null;
  banner: RoundCue | null;
  score: { report: ScoreReport; step: number; maxStep: number } | null;
  scoring: boolean;
  /** 特殊牌阵说明层（玩家点击关闭） */
  formation: FormationCue | null;
  tally: TallyState | null;
  /** 刚落地、正要发动能力的那张牌：抬起聚焦 */
  focusCardId: string | null;
  /** 能力等待某家选择：特效在该家区域持续保持，直到选择结算 */
  powerHold: { cue: PowerCue; seatId: string; choiceId: string } | null;
  /** 转移中的幽灵牌：抽牌 / 偷牌 / 取前注 / 弃牌，一张一张飞 */
  ghosts: GhostCard[];
  /** 被偷的那张牌背：先前伸抖动，再被幽灵牌带走 */
  tug: { seatId: string; index: number } | null;
  /** 刚从牌库顶替换上来的牌（赤铜龙 / 术士 / 雏龙 / 诡术师）：新节点从牌库飞入而不是从手牌 */
  fromDeck: string[];
}
export interface GhostCard { key: string; cardId?: string; from: Pose; to: Pose; delay: number; duration: number; faceDown: boolean; flip?: boolean }
export interface UIState {
  lang: Lang;
  hostKind: "local" | "obr";
  mode: "full" | "compact";
  view: TableView | null;
  /** 场景正在画的帧 */
  display: TableView | null;
  /** 流程轨 / 等待行读的帧：演出结束后才跟进 */
  flow: TableView | null;
  selected: string[];
  hovered: string | null;
  keyboardCard: string | null;
  keyboardHeld: boolean;
  drag: DragState | null;
  pending: PendingAction | null;
  sending: boolean;
  localMessage: string;
  inspect: { cardId: string; pinned: boolean } | null;
  show: ShowState;
  busy: boolean;
  soundOn: boolean;
  gestures: Record<string, HandGesture>;
  slowSeatIds: string[];
  suspended: boolean;
  helpOpen: boolean;
  /** 演出期间冻结的金币数字：直到金币弧线落地才跳到新值。 */
  goldHold: { seats: Record<string, number>; stakes: number; hole: number } | null;
  /** 本家最近一次拍桌的时间戳（节流与表现） */
  knockAt: number;
  /** 场景当前的平面方向（幽灵牌的坐标按它算） */
  orientation: Orientation;
}

export const emptyShow = (): ShowState => ({ reveal: null, revealPhase: null, revealTopIds: [], power: null, resolvingSeatId: null, banner: null, score: null, scoring: false, formation: null, tally: null, focusCardId: null, powerHold: null, ghosts: [], tug: null, fromDeck: [] });

export interface Store {
  get(): UIState;
  set(patch: Partial<UIState> | ((state: UIState) => Partial<UIState>)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore(initial: UIState): Store {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      let changed = false;
      for (const key of Object.keys(next) as (keyof UIState)[]) if (!Object.is(next[key], state[key])) { changed = true; break; }
      if (!changed) return;
      state = { ...state, ...next };
      for (const listener of listeners) listener();
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

export function useStore(store: Store): UIState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** 投影助手 */
export const privateGame = (view: TableView | null): SeatView | null => view?.game && "selfSeatId" in view.game ? view.game as SeatView : null;
export const omniscientGame = (view: TableView | null): OmniscientView | null => { const game = view?.game; return game && "omniscient" in game && (game as OmniscientView).omniscient ? game as OmniscientView : null; };
export const publicGame = (view: TableView | null): PublicView | null => view?.game ?? null;
