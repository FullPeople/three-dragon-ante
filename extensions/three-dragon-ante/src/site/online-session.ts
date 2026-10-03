import type { ServerSession } from "../game/server-protocol";
import { serverPost } from "../game/server-endpoint";

export interface GuestRoom { version: 1; id: string; code: string }
export interface GuestAdmission { room: GuestRoom; session: ServerSession; name: string; reconnected: boolean }
const ACTIVE_KEY = "three-dragon-site-active.v1";
const roomCode = /^[A-Z0-9]{8}$/;
const normalizedName = (name: string) => name.trim().normalize("NFKC").toLowerCase();
const cacheKey = (code: string, name: string) => "three-dragon-site-session.v1:" + code + ":" + normalizedName(name);

function admission(value: unknown): GuestAdmission | null {
  if (!value || typeof value !== "object") return null;
  const v = value as GuestAdmission, s = v.session, r = v.room;
  if (r?.version !== 1 || !/^[a-f0-9]{32}$/.test(r.id) || !roomCode.test(r.code) || s?.roomId !== r.id ||
      !/^[a-f0-9]{32}$/.test(s.memberId) || !/^[a-f0-9]{64}$/.test(s.token) ||
      !["GM", "PLAYER"].includes(s.role) || typeof s.owner !== "boolean" || typeof v.name !== "string" || v.name.length > 60) return null;
  return { room: { version: 1, id: r.id, code: r.code }, session: { roomId: s.roomId, memberId: s.memberId, token: s.token, role: s.role, owner: s.owner }, name: v.name, reconnected: !!v.reconnected };
}

/** Only room access and this browser's seat capability are stored, never a game or a hand. */
export function saveGuestSession(value: GuestAdmission) {
  const text = JSON.stringify(value);
  try { localStorage.setItem(cacheKey(value.room.code, value.name), text); localStorage.setItem("three-dragon-site-last-name", value.name); } catch {}
  try { sessionStorage.setItem(ACTIVE_KEY, text); } catch {}
}
export function clearActiveGuestSession() { try { sessionStorage.removeItem(ACTIVE_KEY); } catch {} }
export function readActiveGuestSession(): GuestAdmission | null {
  try {
    const saved = admission(JSON.parse(sessionStorage.getItem(ACTIVE_KEY) || "null"));
    return saved && saved.room.code === inviteCode() ? saved : null;
  } catch { return null; }
}
export function readGuestSession(code: string, name: string): GuestAdmission | null {
  try { return admission(JSON.parse(localStorage.getItem(cacheKey(code, name)) || "null")); } catch { return null; }
}
export function lastGuestName() { try { return localStorage.getItem("three-dragon-site-last-name") || ""; } catch { return ""; } }
export function inviteCode() { return (new URLSearchParams(location.search).get("room") || "").trim().toUpperCase(); }
export function inviteURL(code: string) {
  const url = new URL(location.href); url.search = ""; url.hash = ""; url.searchParams.set("room", code); return url.href;
}
export function setActiveRoomURL(code?: string) {
  const url = new URL(location.href); if (code) url.searchParams.set("room", code); else url.searchParams.delete("room");
  history.replaceState(null, "", url);
}

async function post(path: string, body: unknown): Promise<GuestAdmission> {
  try {
    const result = await serverPost(path, body);
    const parsed = admission(result); if (!parsed) throw Error("protocolMismatch");
    saveGuestSession(parsed); setActiveRoomURL(parsed.room.code); return parsed;
  } catch (error) {
    if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) throw Error("requestTimeout");
    throw error;
  }
}
export function createGuestRoom(name: string) { return post("/guest/rooms", { name }); }
export function joinGuestRoom(code: string, name: string, reconnect = false) {
  const normalized = code.trim().toUpperCase();
  if (!roomCode.test(normalized)) return Promise.reject(Error("invalidRoomCode"));
  const cached = reconnect ? readGuestSession(normalized, name) : null;
  const path = "/guest/rooms/" + normalized + "/sessions";
  return post(path, { name, ...(reconnect ? { reconnect: true, ...(cached ? { reconnectToken: cached.session.token } : {}) } : {}) }).catch(error => {
    // An explicitly requested reconnect may recover an offline name after another browser rotated the saved capability.
    // The service still rejects an online seat or an unexpired claim; ordinary joins never use this fallback.
    if (reconnect && cached && error instanceof Error && error.message === "notAllowed") return post(path, { name, reconnect: true });
    throw error;
  });
}

export function guestError(code: string, language: "zh" | "en") {
  const errors: Record<string, [string, string]> = {
    nameTaken: ["名字已占用", "Name already in use"], invalidName: ["名字须为 1–60 字", "Name must contain 1–60 characters"],
    invalidRoomCode: ["房间码须为 8 位", "Room code must contain 8 characters"], roomMissing: ["房间不存在", "Room not found"],
    notFound: ["房间不存在", "Room not found"], roomFull: ["房间已满", "Room full"], tableFull: ["牌桌已满", "Table full"],
    memberMissing: ["没有这个名字的离线座位", "No offline seat with this name"], notAllowed: ["重连凭据已失效", "Reconnect capability expired"],
    gameStarted: ["牌局已开始，仅可重连", "Game started; reconnect only"], requestTimeout: ["连接超时", "Connection timed out"],
    protocolMismatch: ["服务版本不匹配", "Server version mismatch"], requestFailed: ["连接失败", "Connection failed"],
  };
  return (errors[code] || errors.requestFailed)[language === "zh" ? 0 : 1];
}
