/** 家族调色板：主色来自 theme/tokens.css（已验收的五族色 + 金币 / 尘土），派生亮色与深色。
 *  不引入新的饱和色；每张牌的"独一份"靠形态与节奏，不靠换色。 */
import { Color } from "three";
import type { FxKind } from "../fx/particles";

export interface Palette { main: Color; bright: Color; deep: Color }
const hex = (h: string) => new Color(h);
const mixTo = (c: Color, to: string, k: number) => c.clone().lerp(hex(to), k);
const base: Record<FxKind, string> = { ember: "#ff7a45", tide: "#6fb7e6", grove: "#8bc46a", arcane: "#c79bff", crown: "#ffd36b", gold: "#ffd36b", dust: "#9c8468", verdigris: "#b87333", necro: "#b7d98a" };
const cache = new Map<FxKind, Palette>();
export function palette(kind: FxKind): Palette {
  let p = cache.get(kind);
  if (!p) { const main = hex(base[kind]); p = { main, bright: kind === "verdigris" ? hex("#f0dca8") : kind === "necro" ? hex("#d9cfb8") : mixTo(main, "#ffffff", 0.55), deep: mixTo(main, "#1a0d06", 0.55) }; cache.set(kind, p); }
  return p;
}
