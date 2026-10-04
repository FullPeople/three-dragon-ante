import { ServerTableClient } from "../game/server-client";
import { mountTableUI } from "../presentation/mount";
import type { TableLanguage } from "../game/text";
import { readUIDraft } from "../game/ui-command";
import type { TableView } from "../game/protocol";
import type { SeatView } from "../game/rules/types";
import { saveGuestSession, type GuestAdmission } from "./online-session";

export interface OnlineMatchHandle { setLanguage(language: TableLanguage): void; retry(): void; destroy(): void }
export interface OnlineMatchOptions {
  admission: GuestAdmission;
  language: TableLanguage;
  onClose(): void;
  onLanguage(language: TableLanguage): void;
  onStatus(connected: boolean, message: string | undefined, inProgress: boolean, spectating: boolean): void;
}

/** A lost website connection immediately discards the host-only projection. */
function websiteView(view: TableView, inspectionRequested: boolean): TableView {
  const game = view.game;
  if (view.connected && inspectionRequested || !game || !("omniscient" in game) || !game.omniscient) return view.connected ? view : { ...view, canEdit: false };
  // Explicit ordinary-seat whitelist: never leave an inspection field in the UI or its animation queue.
  const safe: SeatView = {
    version: game.version, id: game.id, revision: game.revision, phase: game.phase, seats: game.seats,
    stakes: game.stakes, hole: game.hole, variant: game.variant, gambit: game.gambit, round: game.round,
    leaderSeatId: game.leaderSeatId, activeSeatId: game.activeSeatId, waitingSeatIds: game.waitingSeatIds,
    ante: game.ante, discard: game.discard, deckCount: game.deckCount, revealed: game.revealed,
    events: game.events, history: game.history, historyComplete: game.historyComplete,
    historyStartSequence: game.historyStartSequence, anteOrigins: game.anteOrigins,
    choice: game.choice, resolutionStack: game.resolutionStack, lastGambit: game.lastGambit,
    winners: game.winners, issue: game.issue, effects: game.effects,
    selfSeatId: game.selfSeatId, hand: game.hand, committedAnte: game.committedAnte,
    actions: view.connected ? game.actions : [], handPowerHints: game.handPowerHints,
  };
  return { ...view, canEdit: false, game: safe };
}

/** Website host only. Private projections, action receipts and all rules remain with the authoritative service. */
export function createOnlineMatch(parent: HTMLElement, options: OnlineMatchOptions): OnlineMatchHandle {
  const host = document.createElement("div"); host.className = "site-online-table"; parent.append(host);
  const saved = options.admission, draftKey = "three-dragon-site-draft:" + saved.room.id + ":" + saved.session.memberId;
  let destroyed = false, restored = false, inProgress = false, inspectionRequested = false;
  const storeDraft = () => { const draft = surface.draft(); if (draft) try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch {} };
  const surface = mountTableUI(host, {
    language: options.language, hostKind: "website", mode: "full", onLanguage: options.onLanguage,
    gesture: value => client.sendGesture(value),
    send: async command => {
      if (destroyed) return;
      if (command.type === "close") { storeDraft(); options.onClose(); return; }
      if (command.type === "remember" || command.type === "display") { storeDraft(); return; }
      if (saved.spectating && !["retry", "history", "leave"].includes(command.type)) throw Error("notAllowed");
      if (command.type === "omniscient" || command.type === "inspect") {
        if (!client.view.connected || !client.view.isHost || !client.view.game) throw Error("notAllowed");
        inspectionRequested = command.enabled;
      }
      if (command.type === "edit" && (!inspectionRequested || !client.view.isHost || !client.view.canEdit || !client.view.game || !("omniscient" in client.view.game) || !client.view.game.omniscient)) throw Error("notAllowed");
      await client.command(command);
    },
  });
  const client = new ServerTableClient(saved.session, view => {
    if (destroyed) return;
    host.dataset.connected = String(view.connected); host.dataset.selfPlayerId = view.selfPlayerId;
    inProgress = !saved.spectating && !!view.game && view.game.phase !== "ended";
    if (!view.connected || !view.isHost) inspectionRequested = false;
    const visible = { ...websiteView(view, inspectionRequested), spectating: saved.spectating === true };
    surface.update(visible); options.onStatus(view.connected, view.message, inProgress, saved.spectating === true);
    if (!restored && view.game) {
      restored = true;
      try { const draft = readUIDraft(JSON.parse(sessionStorage.getItem(draftKey) || "null")); if (draft) surface.restore(draft); } catch {}
    }
  }, (seat, value) => surface.gesture(seat, value), identity => {
    if (!identity || destroyed) return;
    saved.session.owner = !!identity.owner; saved.session.role = identity.role === "GM" ? "GM" : "PLAYER";
    saved.spectating = identity.spectating === true;
    saveGuestSession(saved);
  }, () => {
    inspectionRequested = false;
    const visible = { ...websiteView({ ...client.view, connected: false, pending: false, message: "requestFailed" }, false), spectating: saved.spectating === true };
    surface.update(visible);
    surface.failed(); options.onStatus(false, "requestFailed", inProgress, saved.spectating === true);
  });
  const visibility = () => { if (document.hidden) surface.suspend(); else surface.resume(); };
  const pagehide = () => storeDraft();
  const beforeunload = (event: BeforeUnloadEvent) => { if (inProgress) { event.preventDefault(); event.returnValue = ""; } };
  document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", pagehide); window.addEventListener("beforeunload", beforeunload);
  client.start();
  return {
    setLanguage: language => surface.language(language),
    retry: () => { void client.command({ type: "retry" }); },
    destroy() {
      if (destroyed) return; storeDraft(); destroyed = true; client.stop();
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pagehide); window.removeEventListener("beforeunload", beforeunload);
      surface.destroy(); host.remove();
    },
  };
}
