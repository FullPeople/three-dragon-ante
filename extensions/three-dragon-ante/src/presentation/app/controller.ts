/** 输入 → 命令。所有规则动作都先经引擎给出的 `actions` 校验，再以 `TableUICommand` 送出；
 * 提交永远不等于接受，只有匹配的回执才让卡牌落地。 */
import type { TableUICommand } from "../../game/ui-command";
import type { GameAction, EligibleAction } from "../../game/rules/types";
import type { HandGesture } from "../../game/gesture";
import { privateGame, type Store } from "./store";

export interface ControllerDeps {
  send(command: TableUICommand): void | Promise<void>;
  gesture?(value: HandGesture): void;
  id?(): string;
  onLanguage?(lang: "zh" | "en"): void;
}

export interface Controller {
  locked(): boolean;
  action(): EligibleAction | undefined;
  legalZone(): "ante" | "flight" | null;
  legalCardIds(): string[];
  selectCard(cardId: string): void;
  toggleOption(optionId: string): void;
  confirmChoice(): void;
  placeSelected(zone: "ante" | "flight"): boolean;
  drop(cardId: string, zone: "ante" | "flight"): boolean;
  hover(cardId: string | null): void;
  inspect(cardId: string | null, pinned?: boolean): void;
  dismissPower(): void;
  knock(): void;
  send(command: TableUICommand): void;
  retry(): void;
  setLanguage(lang: "zh" | "en"): void;
  toggleSound(): void;
  keyboard(event: KeyboardEvent): void;
  publishGesture(): void;
  cancelKeyboard(): void;
  /** 由挂载层注册：能力说明层被关闭时的回调 */
  onPowerDismiss(fn: () => void): void;
  /** 清掉手势节流定时器，销毁后不再向宿主发任何手势 */
  destroy(): void;
}

export function createController(store: Store, deps: ControllerDeps): Controller {
  let gestureTimer: ReturnType<typeof setTimeout> | undefined, gestureSequence = Date.now(), lastGesture = "", dead = false;
  let powerDismiss: (() => void) | null = null;
  const receiptCompatible = () => store.get().view?.actionReceiptVersion === 1;
  const locked = () => {
    const s = store.get(), view = s.view;
    return s.busy || s.sending || !!s.pending || !!view?.pending || s.suspended || !receiptCompatible() || !view?.connected || !!view?.message && ["hostOffline", "recoveryMissing", "protocolMismatch", "privateSync"].includes(view.message);
  };
  const action = () => privateGame(store.get().view)?.actions[0];
  const legalCardIds = () => { const a = action(); return a && a.kind !== "choose" ? a.cardIds : []; };
  const legalZone = () => { const a = action(); return !locked() && a && a.kind !== "choose" && a.cardIds.length ? (a.kind === "ante" ? "ante" : "flight") : null; };
  function dispatch(move: GameAction, cardId?: string, zone?: "ante" | "flight"): boolean {
    const s = store.get(), own = privateGame(s.view), table = s.view?.table;
    if (!own || !table || s.pending || locked() || move.revision !== own.revision || move.seatId !== own.selfSeatId) return false;
    const pending = { actionId: move.id, tableId: table.id, gameId: own.id, revision: move.revision, cardId, zone, action: structuredClone(move), retryable: false };
    store.set({ pending, sending: true, localMessage: "", keyboardHeld: false, drag: null, selected: zone ? [] : s.selected });
    publish();
    try {
      Promise.resolve(deps.send({ type: "action", action: move })).catch(() => { const now = store.get(); if (now.pending?.actionId !== move.id) return; store.set({ sending: false, pending: { ...now.pending, retryable: true }, localMessage: "requestFailed" }); });
    } catch { const now = store.get(); if (now.pending?.actionId === move.id) store.set({ sending: false, pending: { ...now.pending, retryable: true }, localMessage: "requestFailed" }); }
    return true;
  }
  function drop(cardId: string, zone: "ante" | "flight"): boolean {
    const own = privateGame(store.get().view), a = action();
    if (!own || !a || a.kind === "choose" || !a.cardIds.includes(cardId) || (a.kind === "ante" ? "ante" : "flight") !== zone) return false;
    return dispatch({ id: deps.id?.() ?? crypto.randomUUID(), revision: own.revision, seatId: own.selfSeatId, kind: a.kind, cardId }, cardId, zone);
  }
  function publish() {
    if (!deps.gesture || gestureTimer || dead) return;
    gestureTimer = setTimeout(() => {
      gestureTimer = undefined; const s = store.get(), own = privateGame(s.view); if (dead || !own || s.suspended) return;
      const hover = own.hand.findIndex(c => c.id === s.hovered);
      const value = { gameId: own.id, revision: own.revision, count: own.hand.length, hover: hover < 0 ? null : hover, selected: own.hand.flatMap((c, i) => s.selected.includes(c.id) || s.drag?.cardId === c.id || s.keyboardHeld && s.keyboardCard === c.id ? [i] : []), sequence: 0 };
      const signature = JSON.stringify(value); if (signature === lastGesture) return; lastGesture = signature;
      deps.gesture!({ ...value, sequence: gestureSequence = Math.max(gestureSequence + 1, Date.now()) });
    }, 125);
  }
  return {
    locked, action, legalZone, legalCardIds,
    selectCard(cardId) {
      const s = store.get(); if (locked()) { store.set({ inspect: { cardId, pinned: true } }); return; }
      if (!legalCardIds().includes(cardId)) { store.set({ inspect: { cardId, pinned: true } }); return; }
      store.set({ selected: s.selected.includes(cardId) ? [] : [cardId], keyboardCard: cardId, inspect: { cardId, pinned: false } }); publish();
    },
    toggleOption(optionId) {
      const s = store.get(), a = action(); if (locked() || !a || a.kind !== "choose" || !a.choice.options.some(o => o.id === optionId)) return;
      const max = a.choice.max, has = s.selected.includes(optionId);
      store.set({ selected: has ? s.selected.filter(id => id !== optionId) : max === 1 ? [optionId] : s.selected.length < max ? [...s.selected, optionId] : s.selected });
    },
    confirmChoice() {
      const s = store.get(), own = privateGame(s.view), a = action(); if (!own || !a || a.kind !== "choose" || locked()) return;
      const ids = [...s.selected]; if (ids.length < a.choice.min || ids.length > a.choice.max || ids.some(id => !a.choice.options.some(o => o.id === id))) return;
      dispatch({ id: deps.id?.() ?? crypto.randomUUID(), revision: own.revision, seatId: own.selfSeatId, kind: "choose", choiceId: a.choice.id, optionIds: ids });
    },
    placeSelected(zone) { const id = store.get().selected[0] ?? store.get().keyboardCard; return !!id && drop(id, zone); },
    drop,
    hover(cardId) { const s = store.get(); if (s.hovered === cardId) return; store.set({ hovered: cardId, inspect: cardId ? { cardId, pinned: false } : s.inspect?.pinned ? s.inspect : null }); publish(); },
    inspect(cardId, pinned = true) { store.set({ inspect: cardId ? { cardId, pinned } : null }); },
    dismissPower() { const fn = powerDismiss; powerDismiss = null; fn?.(); },
    onPowerDismiss(fn) { powerDismiss = fn; },
    knock() {
      const s = store.get(), own = privateGame(s.view); if (!own || s.suspended || Date.now() - s.knockAt < 350) return;
      store.set({ knockAt: Date.now() });
      gestureSequence = Math.max(gestureSequence + 1, Date.now());
      deps.gesture?.({ gameId: own.id, revision: own.revision, count: own.hand.length, hover: null, selected: [], sequence: gestureSequence, slap: true });
      store.set(s => ({ gestures: { ...s.gestures, [own.selfSeatId]: { gameId: own.id, revision: own.revision, count: own.hand.length, hover: null, selected: [], sequence: gestureSequence, slap: true } } }));
    },
    send(command) {
      const s = store.get(), view = s.view;
      const windowCommand = command.type === "close" || command.type === "display" || command.type === "remember";
      if (!windowCommand && !receiptCompatible() && !(command.type === "retry" && !view)) return;
      if (!windowCommand && command.type !== "retry" && (s.sending || !!view?.pending || !!s.pending || (!view?.connected && !(command.type === "newGame" && view?.isHost && view.message === "recoveryMissing")))) return;
      if (!windowCommand) store.set({ sending: true, localMessage: "" });
      try { Promise.resolve(deps.send(command)).catch(() => store.set({ sending: false, localMessage: "requestFailed" })); } catch { store.set({ sending: false, localMessage: "requestFailed" }); }
    },
    retry() {
      const p = store.get().pending;
      if (p) { store.set({ sending: true, localMessage: "" }); void Promise.resolve(deps.send({ type: "retry", tableId: p.tableId, gameId: p.gameId, action: structuredClone(p.action) })).catch(() => store.set({ sending: false, localMessage: "requestFailed" })); }
      else this.send({ type: "retry" });
    },
    setLanguage(lang) { if (store.get().lang === lang) return; store.set({ lang }); deps.onLanguage?.(lang); },
    toggleSound() { const next = !store.get().soundOn; try { localStorage.setItem("three-dragon-ante.sound.v2", next ? "on" : "off"); } catch {} store.set({ soundOn: next }); },
    cancelKeyboard() { store.set({ keyboardHeld: false }); publish(); },
    publishGesture: publish,
    destroy() { dead = true; if (gestureTimer) clearTimeout(gestureTimer); gestureTimer = undefined; powerDismiss = null; },
    keyboard(event) {
      const s = store.get(), own = privateGame(s.view); if (!own?.hand.length) return;
      if (s.show.power || s.show.formation) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!event.repeat) this.dismissPower(); } return; }
      const index = Math.max(0, own.hand.findIndex(c => c.id === s.keyboardCard));
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); if (s.keyboardHeld) return;
        const next = own.hand[(index + (event.key === "ArrowRight" ? 1 : own.hand.length - 1)) % own.hand.length].id;
        store.set({ keyboardCard: next, hovered: next, inspect: { cardId: next, pinned: false } }); publish();
      } else if (event.key === " " && !s.keyboardHeld) {
        event.preventDefault(); const id = own.hand[index].id; if (!legalCardIds().includes(id) || locked()) return;
        store.set({ keyboardCard: id, keyboardHeld: true, selected: [id] }); publish();
      } else if (event.key === "Enter") {
        event.preventDefault(); const zone = legalZone(); const id = s.keyboardHeld ? s.keyboardCard : own.hand[index].id;
        if (!zone || !id) { if (id) store.set({ inspect: { cardId: id, pinned: true } }); return; }
        drop(id, zone);
      } else if (event.key === "Escape") {
        event.preventDefault(); if (s.keyboardHeld || s.selected.length) store.set({ keyboardHeld: false, selected: [] }); else if (s.inspect) store.set({ inspect: null });
        publish();
      }
    },
  };
}
