/** 只有本家动作的精确回执与权威投影匹配时才能放下等待中的卡牌。 */
import type { TableView } from "../../game/protocol";
import type { PendingAction } from "./store";

export type PendingReceipt = { kind: "ignore" | "accepted" | "invalidated" } | { kind: "retry" | "rejected"; code: string };

export function pendingReceipt(view: TableView, pending: PendingAction): PendingReceipt {
  const game = view.game;
  if (view.table?.id !== pending.tableId || !game || game.id !== pending.gameId || !("selfSeatId" in game) || game.selfSeatId !== pending.action.seatId) return { kind: "invalidated" };
  const receipt = view.actionReceipt;
  if (!receipt || receipt.actionId !== pending.actionId || receipt.tableId !== pending.tableId || receipt.gameId !== pending.gameId || !Number.isSafeInteger(receipt.revision)) return { kind: "ignore" };
  if (receipt.ok === true && receipt.revision >= pending.revision + 1 && game.revision >= receipt.revision) return { kind: "accepted" };
  if (receipt.ok === false && receipt.revision === pending.revision) return { kind: receipt.retryable === true ? "retry" : "rejected", code: receipt.code ?? "requestFailed" };
  return { kind: "ignore" };
}
