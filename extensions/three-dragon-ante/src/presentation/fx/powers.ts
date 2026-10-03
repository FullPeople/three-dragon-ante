/** 每张牌独一份的能力特效脚本。只用公共信息：源牌、公开的目标座位、公共事件里已公开的牌 id 与金额。
 * 图元来自 FxLayer（光束 / 环 / 法阵 / 手 / 交换 / 威压 / 爪痕 / 爆发），这里只编排。所有脚本都是有限时长。 */
import type { PublicEvent } from "../../game/rules/types";
import { card } from "../../game/rules/cards";
import type { PowerCue } from "../model/cues";
import type { FxKind, FxLayer, Point, Rect } from "./particles";

export interface PowerFxContext {
  fx: FxLayer;
  cardPoint(cardId: string): Point | null;
  seatPoint(seatId: string): Point | null;
  seatRect(seatId: string): Rect | null;
  coinsPoint(seatId: string): Point | null;
  handPoint(seatId: string): Point | null;
  pile(id: "deck" | "discard" | "stakes" | "hole"): Point | null;
  seatIds: string[];
  sound(kind: string, key: string): void;
}

const FAMILY_FX: Record<string, FxKind> = {
  black: "ember", red: "ember", thief: "ember", "red-destroyer": "ember", dracolich: "ember", "black-raider": "ember", tiamat: "ember",
  blue: "tide", silver: "tide", white: "tide", "blue-overlord": "tide", "silver-seer": "tide", "white-hunter": "tide", dragonrider: "tide",
  green: "grove", copper: "grove", bronze: "grove", druid: "grove", "copper-trickster": "grove", "green-schemer": "grove", "bronze-warlord": "grove", kobold: "grove",
  prophet: "arcane", sorcerer: "arcane", illusionist: "arcane", archmage: "arcane", "chromatic-wyrmling": "arcane", "time-dragon": "arcane", wyrmpriest: "arcane", fool: "arcane",
  brass: "crown", "brass-sultan": "crown", gold: "crown", "gold-monarch": "crown", bahamut: "crown", queen: "crown", princess: "crown", priest: "crown", "merchant-prince": "crown", "metallic-wyrmling": "crown", dragonslayer: "crown",
};
export const familyFx = (family: string | undefined): FxKind => (family && FAMILY_FX[family]) || "crown";
export const isLegendary = (cardId: string) => { try { return card(cardId).category === "legendary"; } catch { return false; } };

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** 能力脚本：在说明层关闭、完整投影显示后播放；金币弧线随后由 presenter 播。 */
export async function powerScript(cue: PowerCue, events: readonly PublicEvent[], ctx: PowerFxContext): Promise<void> {
  const { fx } = ctx, kind = familyFx(cue.family), source = ctx.cardPoint(cue.cardId);
  const targets = cue.targetSeatIds ?? [];
  const others = ctx.seatIds.filter(id => id !== cue.seatId);
  const legendary = isLegendary(cue.cardId);
  const seg = (code: string) => events.filter(e => e.code === code);
  if (!source) return;
  ctx.sound(`power-${kind}`, cue.key);
  if (legendary) { void fx.sigil(source, kind, 150, 1600); ctx.sound("sigil", cue.key + ":sigil"); await wait(360); }
  switch (cue.family) {
    // 偷奖池：手从源牌伸向奖池抓取
    case "black": case "thief": { const stakes = ctx.pile("stakes"); if (stakes) { ctx.sound("grab", cue.key); await fx.grab(source, stakes, kind, 1000); } else await fx.flare(source, kind, 700); return; }
    case "black-raider": { const stakes = ctx.pile("stakes"); if (stakes) await fx.grab(source, stakes, kind, 900); await Promise.all(others.map((id, i) => { const p = ctx.coinsPoint(id); return p ? wait(i * 120).then(() => fx.beam(p, source, kind, 600)) : wait(0); })); return; }
    // 蓝龙：潮环向所有对手扩散，再从对手收束
    case "blue": case "blue-overlord": { await fx.ring(source, kind, 160, 700); await Promise.all(others.map((id, i) => { const p = ctx.seatPoint(id); return p ? wait(i * 90).then(() => fx.beam(source, p, kind, 520)) : wait(0); })); return; }
    // 索要：光束射向相邻对手，对手区域威压
    case "brass": case "brass-sultan": case "green": case "green-schemer": {
      const ids = targets.length ? targets : others.slice(0, 1);
      // 索要：光束射向对手的手牌，手牌上爆开（对手要从手里给牌或给钱）
      await Promise.all(ids.map(async (id, i) => { const h = ctx.handPoint(id) ?? ctx.seatPoint(id); await wait(i * 160); if (h) { await fx.beam(source, h, kind, 600); fx.burst(h, kind, 0.9); } }));
      await wait(400); return;
    }
    // 青铜：前注区的牌被取走——环在前注区扩散
    case "bronze": case "bronze-warlord": { const n = ctx.pile("stakes"); if (n) { await fx.ring({ x: n.x, y: n.y + 150 }, kind, 180, 800); } if (cue.family === "bronze-warlord") await fx.sigil(source, kind, 120, 1100); return; }
    // 赤铜：原位旋出，新牌落下
    case "copper": { await fx.ring(source, kind, 70, 500); await fx.flare(source, kind, 700); return; }
    case "copper-trickster": { await fx.ring(source, kind, 120, 700); return; }
    // 金龙：冠冕爆发，再从牌库引光到手牌
    case "gold": case "gold-monarch": { await fx.flare(source, kind, 800); const deck = ctx.pile("deck"), hand = ctx.handPoint(cue.seatId); if (deck && hand) await fx.beam(deck, hand, kind, 600); return; }
    // 银龙：每位抽牌者头上一圈潮环
    case "silver": case "silver-seer": { await Promise.all(ctx.seatIds.map((id, i) => { const p = ctx.seatPoint(id); return p ? wait(i * 100).then(() => fx.ring(p, kind, 80, 600)) : wait(0); })); if (cue.family === "silver-seer") { const deck = ctx.pile("deck"); if (deck) await fx.sigil(deck, kind, 90, 1000); } return; }
    // 白 / 红：对目标座位施加威压；红龙还从目标手牌抽走一张
    case "white": case "red": case "red-destroyer": {
      const ids = targets.length ? targets : others;
      // 白龙：光束射向对手的金币堆（它要付钱）；红龙：射向对手的手牌（它要被抽走一张）
      await Promise.all(ids.map(async id => { const p = cue.family === "white" ? ctx.coinsPoint(id) : ctx.handPoint(id); if (p) { await fx.beam(source, p, kind, 550); fx.burst(p, kind, 1); } }));
      await wait(300); return;
    }
    case "white-hunter": { await Promise.all(others.map((id, i) => { const p = ctx.coinsPoint(id); return p ? wait(i * 120).then(() => fx.beam(p, source, kind, 600)) : wait(0); })); return; }
    // 龙神：巨大法阵 + 爆发
    case "bahamut": { await fx.flare(source, kind, 1000); await Promise.all(targets.map((id, i) => { const p = ctx.coinsPoint(id); return p ? wait(i * 100).then(() => fx.beam(source, p, kind, 600)) : wait(0); })); return; }
    case "tiamat": { await fx.flare(source, kind, 1000); return; }
    case "queen": { await fx.flare(source, kind, 700); await Promise.all(targets.map(async id => { const c = ctx.coinsPoint(id), h = ctx.handPoint(id); if (c) await fx.beam(source, c, kind, 500); if (h) { await fx.beam(source, h, "arcane", 500); fx.burst(h, "arcane", 0.8); } })); return; }
    // 场地效果：法阵落在源牌上，环境变化由 FieldLayer 持续表现
    case "dracolich": case "druid": case "priest": case "merchant-prince": case "archmage": { await fx.sigil(source, kind, 140, 1500); return; }
    case "dragonrider": case "wyrmpriest": { await fx.ring(source, kind, 80, 600); await fx.sigil(source, kind, 90, 900); return; }
    // 屠龙者：被弃的龙牌上留下爪痕
    case "dragonslayer": { const removed = seg("DRAGON_REMOVED")[0]?.cardIds?.[0]; const p = removed ? ctx.cardPoint(removed) : null; if (p) { await fx.beam(source, p, kind, 450); ctx.sound("slash", cue.key); await fx.claw(p, "ember", 700); } else await fx.flare(source, kind, 600); return; }
    case "fool": { await fx.ring(source, kind, 100, 600); const deck = ctx.pile("deck"), hand = ctx.handPoint(cue.seatId); if (deck && hand) await fx.beam(deck, hand, kind, 600); return; }
    // 狗头人：手牌扔进弃牌堆，再从牌库补
    case "kobold": { const discard = ctx.pile("discard"), deck = ctx.pile("deck"), hand = ctx.handPoint(cue.seatId); if (hand && discard) await fx.beam(hand, discard, kind, 500); if (deck && hand) await fx.beam(deck, hand, kind, 500); return; }
    // 幻术师：两张凡人牌交换轨迹
    case "illusionist": { const swapped = seg("MORTALS_SWAPPED")[0]; const a = swapped?.cardIds?.[0] ? ctx.cardPoint(swapped.cardIds[0]) : null, b = swapped?.cardIds?.[1] ? ctx.cardPoint(swapped.cardIds[1]) : null; if (a && b) { ctx.sound("swap", cue.key); await fx.swap(a, b, kind, "crown", 900); } else await fx.ring(source, kind, 90, 600); return; }
    // 公主：每张善龙依次闪耀
    case "princess": { await fx.flare(source, kind, 700); return; }
    // 预言家：从自己手牌引一道秘法光到预言家
    case "prophet": { const hand = ctx.handPoint(cue.seatId); if (hand) await fx.beam(hand, source, kind, 600); await fx.sigil(source, kind, 100, 900); return; }
    case "sorcerer": { const deck = ctx.pile("deck"); if (deck) { await fx.sigil(deck, kind, 90, 800); await fx.beam(deck, source, kind, 500); } else await fx.sigil(source, kind, 100, 900); return; }
    case "time-dragon": { const discard = ctx.pile("discard"), hand = ctx.handPoint(cue.seatId); await fx.sigil(source, kind, 160, 1400); if (discard && hand) await fx.beam(discard, hand, kind, 700); return; }
    case "chromatic-wyrmling": case "metallic-wyrmling": { await fx.ring(source, kind, 80, 600); return; }
    default: { await fx.flare(source, kind, 800); return; }
  }
}
