/** 新表现层入口。契约与旧 `game/ui.ts` 的 `mountTableUI` 完全一致，宿主页不感知内部实现。 */
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { createElement } from "react";
import type { TableView } from "../game/protocol";
import type { TableUICommand, TableDisplayMode, TableUIDraft } from "../game/ui-command";
import { readUIDraft } from "../game/ui-command";
import { readHandGesture, type HandGesture } from "../game/gesture";
import type { TableLanguage } from "../game/text";
import { createStore, emptyShow, privateGame, type Store, type UIState } from "./app/store";
import { createController } from "./app/controller";
import { createPresenter } from "./app/presenter";
import { TableApp } from "./app/TableApp";
import type { FxLayer } from "./fx/particles";
import type { FxStage } from "./fx3d/FxStage";
import type { Orientation } from "./model/layout";
import { createAudio } from "./audio/player";
import "./theme/fonts";
import "./theme/base.css";
import "./scene/scene.css";
import "./hud/hud.css";

export interface TableUIDeps {
  send(command: TableUICommand): void | Promise<void>;
  language: TableLanguage;
  mode?: TableDisplayMode;
  gesture?(value: HandGesture): void;
  id?(): string;
  onPresentationChange?(busy: boolean): void;
  /** 本地对战宿主传 "local"；枭熊页默认 "obr"。 */
  hostKind?: "local" | "obr";
  /** 宿主自己画顶栏时关掉 */
  topBar?: boolean;
  /** 用户在 UI 里切换语言时通知宿主（枭熊页用它写入本地语言偏好） */
  onLanguage?(language: TableLanguage): void;
}

export interface TableUISurface {
  update(view: TableView): void;
  gesture(seatId: string, value: unknown): void;
  language(value: TableLanguage): void;
  restore(value: unknown): void;
  draft(): TableUIDraft | null;
  waitingForReceipt(): boolean;
  presentationBusy(): boolean;
  getAnchor(zone: "hand" | "ownAnte" | "ownFlight" | "stakes"): DOMRect | null;
  suspend(): void;
  resume(): void;
  failed(): void;
  destroy(): void;
}

export function mountTableUI(root: HTMLElement, deps: TableUIDeps): TableUISurface {
  let soundOn = true; try { soundOn = localStorage.getItem("three-dragon-ante.sound.v2") !== "off"; } catch {}
  const initial: UIState = { lang: deps.language, hostKind: deps.hostKind ?? "obr", mode: deps.mode ?? "full", view: null, display: null, flow: null, selected: [], hovered: null, keyboardCard: null, keyboardHeld: false, drag: null, pending: null, sending: false, localMessage: "", inspect: null, show: emptyShow(), busy: false, soundOn, gestures: {}, slowSeatIds: [], suspended: false, helpOpen: false, goldHold: null, knockAt: 0, orientation: "landscape" };
  const store: Store = createStore(initial);
  let fx: FxLayer | null = null, fx3d: FxStage | null = null, orientation: Orientation = "landscape", destroyed = false, notifiedBusy = false;
  const audio = createAudio(root, () => store.get().soundOn);
  const controller = createController(store, { send: deps.send, gesture: deps.gesture, id: deps.id, onLanguage: deps.onLanguage });
  root.dataset.mode = deps.mode ?? "full";
  // 宿主与测试夹具从挂载根读取的状态镜像。
  store.subscribe(() => { const s = store.get(); root.dataset.pendingAction = s.pending ? "true" : "false"; root.dataset.omniscient = String(!!(s.view?.game && "omniscient" in s.view.game && (s.view.game as { omniscient?: boolean }).omniscient)); root.dataset.busy = String(s.busy); });
  (controller as unknown as { _setDrag(v: UIState["drag"]): void })._setDrag = value => store.set({ drag: value });
  const presenter = createPresenter(store, controller, { fx: () => fx, fx3d: () => fx3d, root: () => root, onBusy: busy => { if (busy !== notifiedBusy) { notifiedBusy = busy; deps.onPresentationChange?.(busy); } }, sound: (kind, key) => audio.play(kind, key) });
  root.classList.add("tda-root");
  const reactRoot: Root = createRoot(root);
  const render = () => flushSync(() => reactRoot.render(createElement(TableApp, { store, controller, onFx: value => { fx = value; }, onFx3d: value => { fx3d = value; }, onOrientation: value => { orientation = value; store.set({ orientation: value }); }, showTopBar: deps.topBar !== false, onLand: (key, zone) => audio.play("thud", `${key}:${zone}:${store.get().view?.game?.revision ?? 0}`) })));
  // 本家拍桌：声音在这里，震动与手掌在场景层
  let knockSeen = 0; store.subscribe(() => { const at = store.get().knockAt; if (at && at !== knockSeen) { knockSeen = at; audio.play("slap", `knock:${at}`); } });
  render();
  const gestureTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // 远端拍桌：每个座位自己的"手还在桌上"计时，连拍走短动作
  const slapResting = new Map<string, number>();
  const slowTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function applyReceipt(view: TableView) {
    const p = store.get().pending; if (!p) return;
    const game = view.game;
    if (view.table?.id !== p.tableId || !game || game.id !== p.gameId || !("selfSeatId" in game) || (game as { selfSeatId: string }).selfSeatId !== p.action.seatId) { store.set({ pending: null, sending: false }); return; }
    const receipt = view.actionReceipt;
    if (!receipt || receipt.actionId !== p.actionId || receipt.tableId !== p.tableId || receipt.gameId !== p.gameId || !Number.isSafeInteger(receipt.revision)) return;
    if (receipt.ok === true) { if (receipt.revision < p.revision + 1 || game.revision < receipt.revision) return; store.set({ pending: null, sending: false, selected: [] }); }
    else if (receipt.ok === false && receipt.revision === p.revision) {
      if (receipt.retryable === true) { store.set({ pending: { ...p, retryable: true }, sending: false, localMessage: receipt.code ?? "requestFailed" }); return; }
      store.set({ pending: null, sending: false, keyboardHeld: false, localMessage: receipt.code ?? "requestFailed" });
    }
  }
  function trackSlow(view: TableView) {
    const game = view.game, own = privateGame(view);
    const waiting = new Set(game && (game.phase === "ante" || game.phase === "play" || game.phase === "choice") ? game.waitingSeatIds.filter(id => id !== own?.selfSeatId) : []);
    for (const [id, timer] of slowTimers) if (!waiting.has(id)) { clearTimeout(timer); slowTimers.delete(id); }
    const key = game ? `${game.id}:${game.revision}` : "";
    for (const id of waiting) if (!slowTimers.has(id)) slowTimers.set(id, setTimeout(() => { if (!destroyed && store.get().view?.game && `${store.get().view!.game!.id}:${store.get().view!.game!.revision}` === key) store.set(s => ({ slowSeatIds: [...new Set([...s.slowSeatIds, id])] })); }, 20000));
    store.set(s => s.slowSeatIds.some(id => !waiting.has(id)) ? { slowSeatIds: s.slowSeatIds.filter(id => waiting.has(id)) } : {});
  }
  const surface: TableUISurface = {
    update(view) {
      if (destroyed) return;
      const s = store.get(), previous = s.view;
      const live = !!previous?.connected && view.connected && !s.suspended && !document.hidden;
      const game = view.game, prevGame = previous?.game;
      const selectionKey = game ? `${game.id}:${game.gambit}:${game.round}:${game.phase}` : "";
      const prevKey = prevGame ? `${prevGame.id}:${prevGame.gambit}:${prevGame.round}:${prevGame.phase}` : "";
      store.set({ view, sending: false, localMessage: s.localMessage === "requestFailed" && view.connected ? "" : s.localMessage, selected: selectionKey === prevKey ? s.selected : [], hovered: selectionKey === prevKey ? s.hovered : null });
      if (view.message === "requestFailed") store.set({ localMessage: "requestFailed" });
      applyReceipt(view);
      if (game && prevGame && game.id === prevGame.id && game.revision !== prevGame.revision) store.set({ gestures: {} });
      presenter.update(view, previous, live && !!game && !!prevGame && game.id === prevGame.id);
      trackSlow(view);
      const own = privateGame(view);
      if (own && s.keyboardHeld && !(own.actions[0] && own.actions[0].kind !== "choose" && own.actions[0].cardIds.includes(s.keyboardCard ?? ""))) store.set({ keyboardHeld: false });
    },
    gesture(seatId, value) {
      if (destroyed) return;
      const own = privateGame(store.get().view);
      if (value === null) { store.set(s => { const next = { ...s.gestures }; delete next[seatId]; return { gestures: next }; }); return; }
      const gesture = readHandGesture(value); if (!gesture || seatId === own?.selfSeatId) return;
      const old = store.get().gestures[seatId]; if (old && gesture.sequence <= old.sequence) return;
      if (gesture.slap) { const again = performance.now() < (slapResting.get(seatId) ?? 0); slapResting.set(seatId, performance.now() + 1200); fx?.shake(again ? 300 : 600); audio.play("slap", `slap:${seatId}:${gesture.sequence}`); const plate = root.querySelector<HTMLElement>(`[data-seat-plate="${CSS.escape(seatId)}"]`); if (plate && fx) { const r = plate.getBoundingClientRect(); const seat = plate.closest<HTMLElement>(".tda-seat"); const rot = Number(seat?.style.getPropertyValue("--seat-rot").replace("deg", "")) || 0; void fx.slap({ x: r.left + r.width / 2 + Math.cos(rot * Math.PI / 180) * 90, y: r.top + r.height / 2 + Math.sin(rot * Math.PI / 180) * 90 }, again); } }
      store.set(s => ({ gestures: { ...s.gestures, [seatId]: gesture } }));
      const timer = gestureTimers.get(seatId); if (timer) clearTimeout(timer);
      gestureTimers.set(seatId, setTimeout(() => { if (!destroyed) store.set(s => { const next = { ...s.gestures }; delete next[seatId]; return { gestures: next }; }); }, 30000));
    },
    language(value) { controller.setLanguage(value); },
    restore(value) { const draft = readUIDraft(value); if (!draft) return; const view = store.get().view; if (view?.table?.id === draft.tableId && view.game?.id === draft.gameId) store.set({ selected: draft.selected }); },
    draft() { const view = store.get().view; const game = view?.game; return view?.table && game ? { tableId: view.table.id, gameId: game.id, selectionKey: `${game.id}:${game.gambit}:${game.round}:${game.phase}`, selected: [...store.get().selected], boardScroll: 0, handScroll: 0, open: [] } : null; },
    waitingForReceipt: () => !!store.get().pending,
    presentationBusy: () => store.get().busy,
    getAnchor(zone) {
      const own = privateGame(store.get().view);
      const selector = zone === "hand" ? `[data-card="${own?.hand[0] ? CSS.escape(own.hand[0].id) : "-"}"]` : zone === "stakes" ? `.tda-stakes-plate` : `[data-drop-zone="${zone === "ownAnte" ? "ante" : "flight"}"][data-drop-seat="${own ? CSS.escape(own.selfSeatId) : "-"}"]`;
      return root.querySelector(selector)?.getBoundingClientRect() ?? null;
    },
    suspend() { store.set({ suspended: true, drag: null, keyboardHeld: false }); presenter.clear(); audio.suspend(); },
    resume() { store.set({ suspended: false }); audio.resume(); const view = store.get().view; if (view) store.set({ display: view, flow: view }); },
    failed() { const s = store.get(); store.set({ sending: false, localMessage: "requestFailed", pending: s.pending ? { ...s.pending, retryable: true } : null, view: s.view ? { ...s.view, pending: false, connected: false } : null }); presenter.clear(); },
    destroy() {
      if (destroyed) return; destroyed = true;
      presenter.destroy(); controller.destroy(); audio.destroy(); for (const timer of gestureTimers.values()) clearTimeout(timer); for (const timer of slowTimers.values()) clearTimeout(timer);
      // 宿主常在另一个 React 树的 effect 清理里销毁牌桌；同步 unmount 会被 React 19 推迟并在开发模式告警，
      // 所以放到下一个宏任务，且不再手动清空容器（否则推迟的 removeChild 会找不到节点）。
      setTimeout(() => reactRoot.unmount(), 0); root.classList.remove("tda-root");
    },
  };
  void orientation;
  return surface;
}
