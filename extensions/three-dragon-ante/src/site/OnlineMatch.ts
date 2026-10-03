import { ServerTableClient } from "../game/server-client";
import { mountTableUI } from "../presentation/mount";
import type { TableLanguage } from "../game/text";
import { readUIDraft } from "../game/ui-command";
import { saveGuestSession, type GuestAdmission } from "./online-session";

export interface OnlineMatchHandle { setLanguage(language: TableLanguage): void; retry(): void; destroy(): void }
export interface OnlineMatchOptions {
  admission: GuestAdmission;
  language: TableLanguage;
  onClose(): void;
  onLanguage(language: TableLanguage): void;
  onStatus(connected: boolean, message?: string): void;
}

/** Website host only. Private projections, action receipts and all rules remain with the authoritative service. */
export function createOnlineMatch(parent: HTMLElement, options: OnlineMatchOptions): OnlineMatchHandle {
  const host = document.createElement("div"); host.className = "site-online-table"; parent.append(host);
  const saved = options.admission, draftKey = "three-dragon-site-draft:" + saved.room.id + ":" + saved.session.memberId;
  let destroyed = false, restored = false;
  const storeDraft = () => { const draft = surface.draft(); if (draft) try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch {} };
  const surface = mountTableUI(host, {
    language: options.language, hostKind: "obr", mode: "full", onLanguage: options.onLanguage,
    gesture: value => client.sendGesture(value),
    send: async command => {
      if (destroyed) return;
      if (command.type === "close") { storeDraft(); options.onClose(); return; }
      if (command.type === "remember" || command.type === "display") { storeDraft(); return; }
      if (command.type === "omniscient" || command.type === "inspect" || command.type === "edit") throw Error("notAllowed");
      await client.command(command);
    },
  });
  const client = new ServerTableClient(saved.session, view => {
    if (destroyed) return;
    host.dataset.connected = String(view.connected); host.dataset.selfPlayerId = view.selfPlayerId;
    surface.update(view); options.onStatus(view.connected, view.message);
    if (!restored && view.game) {
      restored = true;
      try { const draft = readUIDraft(JSON.parse(sessionStorage.getItem(draftKey) || "null")); if (draft) surface.restore(draft); } catch {}
    }
  }, (seat, value) => surface.gesture(seat, value), identity => {
    if (!identity || destroyed) return;
    saved.session.owner = !!identity.owner; saved.session.role = identity.role === "GM" ? "GM" : "PLAYER";
    saveGuestSession(saved);
  }, () => { surface.failed(); options.onStatus(false, "requestFailed"); });
  const visibility = () => { if (document.hidden) surface.suspend(); else surface.resume(); };
  const pagehide = () => storeDraft();
  document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", pagehide);
  client.start();
  return {
    setLanguage: language => surface.language(language),
    retry: () => { void client.command({ type: "retry" }); },
    destroy() {
      if (destroyed) return; storeDraft(); destroyed = true; client.stop();
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", pagehide);
      surface.destroy(); host.remove();
    },
  };
}
