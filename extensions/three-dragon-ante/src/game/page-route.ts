import { TABLE_ROOM_KEY } from "./protocol";
import { SERVER_ROOM_KEY, serverRoom } from "./server-protocol";
import { TABLE_ROOM_KEY as STABLE_TABLE_ROOM_KEY } from "../../../../src/modules/threeDragonAnte/protocol";

type PageHost = "stable-legacy" | "legacy" | "server";
const active = (value: unknown) => !!value && typeof value === "object" &&
  ["lobby", "playing"].includes((value as { stage?: string }).stage || "");

/** Preserve a live legacy game in the entry's channel before considering newer invitations. */
export function pageHost(pathname: string, metadata: Record<string, unknown>): PageHost {
  const suite = pathname.endsWith("/workbench-panels/table.html") || pathname.endsWith("/three-dragon-ante.html");
  if (suite && active(metadata[STABLE_TABLE_ROOM_KEY])) return "stable-legacy";
  if (!serverRoom(metadata[SERVER_ROOM_KEY]) && active(metadata[TABLE_ROOM_KEY])) return "legacy";
  return "server";
}
