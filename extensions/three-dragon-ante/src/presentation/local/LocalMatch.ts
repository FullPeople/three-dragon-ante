/** 独立网站的本地对战宿主：真实规则引擎 + 机器人对手 + 真实回执。没有 SDK、存储、网络。
 * 从旧 tutorial.ts 抽出，去掉课程体系。机器人只看自己的投影，不偷看任何人的手牌。 */
import { applyAction, createGame, eligibleActions, projectSeat } from "../../game/rules";
import type { GameAction, GameState } from "../../game/rules";
import { card } from "../../game/rules/cards";
import type { ActionReceipt, TableView } from "../../game/protocol";
import type { TableLanguage } from "../../game/text";
import { mountTableUI, type TableUISurface } from "../mount";

export interface LocalMatchOptions {
  language: TableLanguage;
  opponents: number;
  startingGold?: number;
  startingHand?: number;
  seed?: number;
  onClose(): void;
  onLanguage?(language: TableLanguage): void;
}
export interface LocalMatchHandle { setLanguage(language: TableLanguage): void; suspend(): void; resume(): void; restart(): void; destroy(): void }

const BOT_NAMES: Record<TableLanguage, string[]> = { zh: ["余烬", "翡翠", "暮霜", "铜鳞", "夜潮"], en: ["Ember", "Jade", "Duskfrost", "Copperscale", "Nighttide"] };
const SELF = "you";

/** 机器人策略：只用引擎给出的合法动作。前注取中等点数；出牌优先会触发能力的牌，否则最强；选择取第一个非跳过选项。 */
function botMove(state: GameState, seatId: string, actionId: string): GameAction | null {
  const own = projectSeat(state, seatId), action = own.actions[0]; if (!action) return null;
  const base = { id: actionId, revision: state.revision, seatId };
  if (action.kind === "choose") {
    const options = action.choice.options.filter(option => option.id !== "skip" && option.code !== "KEEP_CARD" && option.code !== "DO_NOT_COPY" && option.code !== "SKIP_POWER");
    const picked = (options.length ? options : action.choice.options).slice(0, Math.max(action.choice.min, Math.min(1, action.choice.max))).map(option => option.id);
    return { ...base, kind: "choose", choiceId: action.choice.id, optionIds: picked.length >= action.choice.min ? picked : action.choice.options.slice(0, action.choice.min).map(option => option.id) };
  }
  const sorted = [...action.cardIds].sort((a, b) => card(b).strength - card(a).strength || a.localeCompare(b));
  if (action.kind === "ante") return { ...base, kind: "ante", cardId: sorted[Math.floor(sorted.length / 2)] };
  const ready = own.handPowerHints.filter(hint => hint.state === "power-ready" && action.cardIds.includes(hint.cardId)).map(hint => hint.cardId).sort((a, b) => card(b).strength - card(a).strength);
  return { ...base, kind: "play", cardId: ready[0] ?? sorted[0] };
}

export function createLocalMatch(parent: HTMLElement, options: LocalMatchOptions): LocalMatchHandle {
  let lang = options.language, destroyed = false, suspended = false, generation = 0, serial = 0, presentationHeld = false, botTimer: ReturnType<typeof setTimeout> | undefined;
  const opponents = Math.max(1, Math.min(5, Math.round(options.opponents)));
  const seats = () => [{ id: SELF, name: lang === "zh" ? "你" : "You" }, ...BOT_NAMES[lang].slice(0, opponents).map((name, i) => ({ id: `bot${i + 1}`, name }))];
  void seats;
  let game: GameState = newGame(), receipt: ActionReceipt | undefined;
  function newGame(): GameState { return createGame({ id: `local:${Date.now().toString(36)}:${++generation}`, seats: seats(), startingGold: options.startingGold, startingHand: options.startingHand, ...(options.seed !== undefined ? { seed: options.seed + generation } : {}) }); }
  const host = document.createElement("div"); host.className = "tda-local-host"; parent.append(host);
  let table: TableUISurface;
  function cancelBot() { if (botTimer !== undefined) clearTimeout(botTimer); botTimer = undefined; }
  function paused() { return destroyed || suspended || document.hidden; }
  function nextBot(): { seatId: string; delay: number } | null {
    if (game.stage === "ended" || game.stage === "adjudication") return null;
    const actors = game.seats.filter(seat => seat.id !== SELF && eligibleActions(game, seat.id).length);
    if (!actors.length) return null;
    // 前注阶段让机器人错峰提交，等待感更真实；出牌阶段固定一秒思考。
    const actor = actors[0];
    return { seatId: actor.id, delay: game.stage === "ante" ? 900 + Math.random() * 1400 : 1000 + Math.random() * 500 };
  }
  function scheduleBot() {
    cancelBot(); if (paused() || presentationHeld) return;
    if (table.presentationBusy()) { presentationHeld = true; return; }
    const plan = nextBot(); if (!plan) return;
    const gen = generation, gameId = game.id;
    botTimer = setTimeout(() => {
      botTimer = undefined; if (destroyed || gen !== generation || gameId !== game.id || paused()) return;
      if (table.presentationBusy()) { presentationHeld = true; return; }
      const move = botMove(game, plan.seatId, `local:${generation}:${++serial}`);
      if (move) take(move, false); else scheduleBot();
    }, plan.delay);
  }
  function take(move: GameAction, human: boolean) {
    if (paused() || human && move.seatId !== SELF || !human && move.seatId === SELF) return;
    const result = applyAction(game, move);
    if (human) receipt = { actionId: move.id, tableId: game.id, gameId: game.id, revision: result.ok ? result.state.revision : move.revision, ok: result.ok, ...(!result.ok ? { code: result.error.code, retryable: false } : {}), source: "host" };
    if (result.ok && !result.duplicate) game = result.state;
    render();
  }
  function view(): TableView {
    const projected = projectSeat(game, SELF);
    const names = new Map(seats().map(seat => [seat.id, seat.name]));
    projected.seats.forEach(seat => { seat.name = names.get(seat.id) ?? seat.name; });
    return { actionReceiptVersion: 1, table: { version: 1, id: game.id, hostPlayerId: "local", hostConnectionId: "local", hostName: "local", stage: game.stage === "ended" ? "ended" : "playing", seats: seats().map(seat => ({ playerId: seat.id, seatId: seat.id, name: seat.name })), revision: game.revision }, selfPlayerId: SELF, isHost: true, connected: true, pending: false, game: projected, ...(receipt?.gameId === game.id ? { actionReceipt: receipt } : {}) };
  }
  function render() { if (destroyed) return; table.update(view()); scheduleBot(); }
  table = mountTableUI(host, {
    language: lang, hostKind: "local", id: () => `local:${generation}:${++serial}`,
    onPresentationChange(busy) { if (destroyed) return; const held = presentationHeld; presentationHeld = busy; if (busy) cancelBot(); else if (held) scheduleBot(); },
    send(command) {
      if (destroyed) return;
      if (command.type === "action") { take(command.action, true); return; }
      if (command.type === "newGame") { restart(); return; }
      if (command.type === "close") { options.onClose(); return; }
      if (command.type === "retry" && command.action) { take(command.action, true); return; }
      render();
    },
  });
  function restart() { cancelBot(); presentationHeld = false; game = newGame(); receipt = undefined; render(); }
  const visibility = () => { if (paused()) { cancelBot(); table.suspend(); } else { table.resume(); render(); } };
  document.addEventListener("visibilitychange", visibility);
  render();
  return {
    setLanguage(value) { if (destroyed || value === lang) return; lang = value; table.language(value); render(); options.onLanguage?.(value); },
    suspend() { suspended = true; visibility(); },
    resume() { suspended = false; visibility(); },
    restart,
    destroy() { if (destroyed) return; destroyed = true; cancelBot(); document.removeEventListener("visibilitychange", visibility); table.destroy(); host.remove(); },
  };
}
