/** 表现层本地状态。宿主只通过 `TableView` 进来、`TableUICommand` 出去；这里不持有任何规则状态。 */
import { useSyncExternalStore } from "react";
import type { TableView } from "../../game/protocol";
import type { GameAction, OmniscientView, PublicView, ScoreReport, SeatView } from "../../game/rules/types";
import type { HandGesture } from "../../game/gesture";
import type { PowerCue, RoundCue, RevealCue } from "../model/cues";
import type { Lang } from "../i18n";

export interface PendingAction { actionId: string; tableId: string; gameId: string; revision: number; cardId?: string; zone?: "ante" | "flight"; action: GameAction; retryable: boolean }
export interface DragState { cardId: string; x: number; y: number; legal: boolean; overZone: "ante" | "flight" | null }
export type RevealPhase = "placing" | "revealing" | "price" | "payment" | "discard";
export interface ShowState {
  reveal: RevealCue | null;
  revealPhase: RevealPhase | null;
  revealTopIds: string[];
  power: PowerCue | null;
  resolvingSeatId: string | null;
  banner: RoundCue | null;
  score: { report: ScoreReport; step: number; maxStep: number } | null;
  scoring: boolean;
}
export interface UIState {
  lang: Lang;
  hostKind: "local" | "obr";
  mode: "full" | "compact";
  view: TableView | null;
  display: TableView | null;
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
}

export const emptyShow = (): ShowState => ({ reveal: null, revealPhase: null, revealTopIds: [], power: null, resolvingSeatId: null, banner: null, score: null, scoring: false });

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
