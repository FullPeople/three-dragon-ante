/** 家族签名脚本（设计文档 §5.1 / §5.2 的第一版落地）：每个家族一段独一份的编排，只用公共信息。
 *  形态词汇：法阵 GlyphForm（星角 / 肋 / 钩 / 刻度 / 菱）、光柱、扩散环、爪痕、飘带、粒子爆发、发射器。
 *  标准龙再按点数调幅（半径、粒子数、肋数），让同家族不同点数也彼此不同。 */
import type { FamilyScript, ScriptCtx } from "./types";
import type { GlyphForm } from "../primitives/GroundMark";

const R = (c: ScriptCtx, base: number) => base * (0.85 + 0.3 * c.strength);
const N = (c: ScriptCtx, base: number) => Math.round(base * (0.8 + 0.4 * c.strength));
const ribs = (c: ScriptCtx, base = 4) => base + Math.round(4 * c.strength);
const form = (c: ScriptCtx, f: Partial<GlyphForm>): Partial<GlyphForm> => ({ ribs: ribs(c), ...f });

// ---------- 焰 · 掠夺与灼烧 ----------
const black: FamilyScript = { async cast(c) {
  const stakes = c.pile("stakes");
  c.kit.mark(c.source, { kind: "ember", radius: R(c, 110), duration: 1500, form: form(c, { points: 6, hooks: true, ticks: 0 }) });
  c.kit.pillar(c.source, { kind: "ember", height: R(c, 160), width: 90, duration: 700 });
  if (stakes) {
    await c.wait(260);
    c.sound("grab", c.cue.key); c.kit.claw(stakes, { kind: "ember", radius: 80, duration: 800 });
    await c.wait(260);
    c.kit.beam(stakes, c.source, { kind: "ember", duration: 620, lift: 70, width: 20 });
    await c.wait(480); c.kit.burst(c.source, 26, { kind: "ember", count: N(c, 26), speed: 220, up: 0.8, size: 34, life: 0.8 });
    await c.wait(380);
  } else { c.kit.burst(c.source, 20, { kind: "ember", count: N(c, 30), speed: 240, up: 0.8, size: 34, life: 0.9 }); await c.wait(700); }
} };
const thief: FamilyScript = { async cast(c) {
  const stakes = c.pile("stakes");
  c.kit.mark(c.source, { kind: "arcane", radius: 90, duration: 1200, form: { points: 5, hooks: true, ribs: 0, ticks: 0, rhombus: true } });
  if (stakes) { await c.wait(200); c.kit.beam(stakes, c.source, { kind: "ember", duration: 560, lift: 40, width: 14 }); await c.wait(420); c.kit.burst(c.source, 20, { kind: "gold", count: 18, speed: 160, up: 0.9, size: 26, life: 0.6 }); await c.wait(400); }
  else await c.wait(600);
} };
const blackRaider: FamilyScript = { async cast(c) {
  const stakes = c.pile("stakes");
  c.kit.mark(c.source, { kind: "ember", radius: 140, duration: 1900, form: { points: 6, hooks: true, ribs: 8, ticks: 12 } });
  c.kit.pillar(c.source, { kind: "ember", height: 240, width: 120, duration: 1000 });
  if (stakes) { c.kit.claw(stakes, { kind: "ember", radius: 90, duration: 800 }); c.stage.schedule(() => c.kit.beam(stakes, c.source, { kind: "ember", duration: 600, lift: 80, width: 22 }), 300); }
  await c.wait(500);
  const coins = c.others.map(id => c.coinsPoint(id));
  coins.forEach((p, i) => { if (p) c.stage.schedule(() => c.kit.strike(p, c.source, { kind: "ember", duration: 620, lift: 60, width: 14, impact: 0.8, impactZ: 26 }), i * 120); });
  await c.wait(620 + coins.length * 120 + 200);
} };
const red: FamilyScript = { async cast(c) {
  const ids = c.targets.length ? c.targets : c.others;
  c.kit.mark(c.source, { kind: "ember", radius: R(c, 120), duration: 1500, form: form(c, { points: 8, sharp: true, ticks: 8 }) });
  c.kit.pillar(c.source, { kind: "ember", height: R(c, 220), width: 110, duration: 900 });
  await c.wait(220);
  const st = Math.min(140, 420 / Math.max(1, ids.length));
  for (const [i, id] of ids.entries()) { const h = c.handPoint(id); if (!h) continue; c.stage.schedule(() => { c.kit.strike(c.source, h, { kind: "ember", duration: 620, lift: 120, width: 22, impact: 1.1, impactZ: 40 }); c.stage.schedule(() => c.kit.claw(h, { kind: "ember", radius: 70, duration: 700 }), 420); }, i * st); }
  await c.wait(620 + ids.length * st + 380);
} };
const redDestroyer: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "ember", radius: 150, duration: 2000, form: { points: 8, sharp: true, ticks: 16, ribs: 8 } });
  c.kit.pillar(c.source, { kind: "ember", height: 300, width: 150, duration: 1200 });
  c.kit.burst(c.source, 30, { kind: "ember", count: 40, speed: 260, up: 0.9, size: 40, life: 1.0 });
  await c.wait(320);
  const hands = c.others.map(id => c.handPoint(id));
  const st = Math.min(110, 400 / Math.max(1, hands.length));
  hands.forEach((h, i) => { if (h) c.stage.schedule(() => { c.kit.strike(c.source, h, { kind: "ember", duration: 640, lift: 150, width: 24, impact: 1.2, impactZ: 40 }); c.stage.schedule(() => c.kit.claw(h, { kind: "ember", radius: 80, duration: 800 }), 440); }, i * st); });
  await c.wait(640 + hands.length * st + 420);
} };

// ---------- 潮 · 雷霜月 ----------
const blue: FamilyScript = { async cast(c) {
  c.kit.ring(c.source, { kind: "tide", radius: R(c, 170), duration: 700 });
  c.kit.mark(c.source, { kind: "tide", radius: R(c, 100), duration: 1400, form: form(c, { points: 4, sharp: true, ribs: 6 }) });
  await c.wait(260);
  const hands = c.others.map(id => c.handPoint(id));
  await c.kit.volley(c.source, hands, { kind: "tide", duration: 560, stagger: 90, lift: 90, width: 16, impact: 0.8, impactZ: 36 });
  await c.wait(200);
} };
const blueOverlord: FamilyScript = { async cast(c) {
  c.kit.ring(c.source, { kind: "tide", radius: 220, duration: 900 }); c.kit.mark(c.source, { kind: "tide", radius: 150, duration: 1900, form: { points: 4, sharp: true, ribs: 12, ticks: 12 } });
  c.kit.pillar(c.source, { kind: "tide", height: 260, width: 130, duration: 1000 });
  await c.wait(300);
  await c.kit.volley(c.source, c.others.map(id => c.handPoint(id)), { kind: "tide", duration: 600, stagger: 90, lift: 140, width: 22, impact: 1.1, impactZ: 40 });
  await c.wait(300);
} };
const silver: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "tide", radius: R(c, 100), duration: 1400, form: form(c, { points: 6, sharp: true, rhombus: true }) });
  const seats = [c.self, ...c.others];
  seats.forEach((id, i) => { const p = c.handPoint(id); if (p) c.stage.schedule(() => { c.kit.ring(p, { kind: "tide", radius: 90, duration: 600 }); c.kit.burst(p, 30, { kind: "tide", count: N(c, 14), speed: 120, up: 1.0, size: 26, life: 0.7 }); }, 150 + i * 100); });
  await c.wait(150 + seats.length * 100 + 600);
} };
const silverSeer: FamilyScript = { async cast(c) {
  const deck = c.pile("deck");
  c.kit.mark(c.source, { kind: "tide", radius: 140, duration: 1800, form: { points: 6, sharp: true, rhombus: true, ribs: 12, ticks: 12 } });
  if (deck) { c.kit.pillar(deck, { kind: "tide", height: 240, width: 110, duration: 1100 }); c.kit.ring(deck, { kind: "tide", radius: 120, duration: 800 }); }
  await c.wait(300);
  await c.kit.volley(deck ?? c.source, [c.self, ...c.others].map(id => c.handPoint(id)), { kind: "tide", duration: 560, stagger: 100, lift: 110, width: 16, impact: 0.8, impactZ: 36 });
  await c.wait(200);
} };
const white: FamilyScript = { async cast(c) {
  const ids = c.targets.length ? c.targets : c.others;
  c.kit.mark(c.source, { kind: "tide", radius: R(c, 95), duration: 1300, form: form(c, { points: 5, sharp: false }) });
  c.kit.burst(c.source, 20, { kind: "tide", count: N(c, 30), speed: 180, up: 0.5, size: 30, life: 0.9, sprites: ["smoke_06", "star_05", "spark_01"] });
  await c.wait(240);
  await c.kit.volley(c.source, ids.map(id => c.coinsPoint(id)), { kind: "tide", duration: 560, stagger: 120, lift: 100, width: 18, impact: 0.9, impactZ: 20 });
  await c.wait(200);
} };
const whiteHunter: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "tide", radius: 140, duration: 1800, form: { points: 5, sharp: true, ribs: 10, ticks: 10 } });
  c.kit.pillar(c.source, { kind: "tide", height: 220, width: 120, duration: 1000 });
  await c.wait(300);
  const coins = c.others.map(id => c.coinsPoint(id));
  coins.forEach((p, i) => { if (p) c.stage.schedule(() => c.kit.strike(p, c.source, { kind: "tide", duration: 640, lift: 80, width: 16, impact: 0.8, impactZ: 26 }), i * 120); });
  await c.wait(640 + coins.length * 120 + 300);
} };
const dragonrider: FamilyScript = { async cast(c) {
  c.kit.ring(c.source, { kind: "tide", radius: 110, duration: 700 }); c.kit.mark(c.source, { kind: "tide", radius: 90, duration: 1100, form: { points: 4, ribs: 4, ticks: 0 } });
  await c.wait(800);
} };

// ---------- 林 · 毒藤 ----------
const green: FamilyScript = { async cast(c) {
  const ids = c.targets.length ? c.targets : c.others.slice(0, 1);
  c.kit.mark(c.source, { kind: "grove", radius: R(c, 100), duration: 1500, form: form(c, { points: 3, hooks: true, ticks: 0 }) });
  await c.wait(200);
  const st = Math.min(160, 420 / Math.max(1, ids.length));
  for (const [i, id] of ids.entries()) { const h = c.handPoint(id); if (!h) continue; c.stage.schedule(() => { c.kit.strike(c.source, h, { kind: "grove", duration: 640, lift: 110, width: 18, impact: 0.9, impactZ: 40 }); c.stage.schedule(() => c.kit.burst(h, 30, { kind: "grove", count: 20, speed: 90, up: 1.0, size: 30, life: 1.1, sprites: ["smoke_03", "star_01"] }), 460); }, i * st); }
  await c.wait(640 + ids.length * st + 380);
} };
const greenSchemer: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "grove", radius: 140, duration: 1900, form: { points: 3, hooks: true, ribs: 9, ticks: 9 } });
  c.kit.pillar(c.source, { kind: "grove", height: 220, width: 120, duration: 1000 });
  await c.wait(300);
  await c.kit.volley(c.source, (c.targets.length ? c.targets : c.others).map(id => c.handPoint(id)), { kind: "grove", duration: 620, stagger: 120, lift: 120, width: 20, impact: 1, impactZ: 40 });
  await c.wait(300);
} };
const druid: FamilyScript = { async cast(c) {
  c.kit.ring(c.source, { kind: "grove", radius: 160, duration: 900 });
  c.kit.mark(c.source, { kind: "grove", radius: 120, duration: 1600, form: { points: 3, hooks: true, ribs: 6, ticks: 0 } });
  c.kit.burst(c.source, 10, { kind: "grove", count: 36, speed: 110, up: 1.0, size: 30, life: 1.4, sprites: ["star_01", "twirl_01", "smoke_03"] });
  await c.wait(1100);
} };

// ---------- 铜绿 · 金属鸣响 ----------
const copper: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "verdigris", radius: R(c, 95), duration: 1200, form: form(c, { points: 7, ticks: 14, sharp: false }) });
  c.kit.ring(c.source, { kind: "verdigris", radius: R(c, 120), duration: 600 });
  c.kit.shell(c.source, 14, { kind: "verdigris", r1: R(c, 90), duration: 500, squash: 0.5 });
  await c.wait(200);
  c.kit.burst(c.source, 16, { kind: "verdigris", count: N(c, 30), speed: 170, up: 0.9, size: 26, life: 0.8, sprites: ["spark_06", "twirl_03", "star_01"] });
  await c.wait(700);
} };
const copperTrickster: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "verdigris", radius: 140, duration: 1700, form: { points: 7, ticks: 21, ribs: 7 } });
  c.kit.ring(c.source, { kind: "verdigris", radius: 200, duration: 800 }); c.kit.pillar(c.source, { kind: "verdigris", height: 200, width: 120, duration: 900 });
  c.kit.burst(c.source, 16, { kind: "verdigris", count: 44, speed: 200, up: 0.9, size: 30, life: 0.9, sprites: ["spark_06", "twirl_03"] });
  await c.wait(1000);
} };
const bronze: FamilyScript = { async cast(c) {
  const stakes = c.pile("stakes"); const at = stakes ? { x: stakes.x, y: stakes.y + 150 } : c.source;
  c.kit.mark(c.source, { kind: "verdigris", radius: R(c, 90), duration: 1300, form: form(c, { points: 8, ribs: 8, sharp: false }) });
  for (let i = 0; i < 3; i++) c.stage.schedule(() => c.kit.ring(at, { kind: "verdigris", radius: 150 + i * 40, duration: 800 }), 150 + i * 120);
  if (stakes) c.stage.schedule(() => c.kit.beam(at, c.source, { kind: "verdigris", duration: 560, lift: 60, width: 16 }), 520);
  await c.wait(1300);
} };
const bronzeWarlord: FamilyScript = { async cast(c) {
  const stakes = c.pile("stakes"); const at = stakes ? { x: stakes.x, y: stakes.y + 150 } : c.source;
  c.kit.mark(c.source, { kind: "verdigris", radius: 140, duration: 1900, form: { points: 8, ribs: 16, ticks: 8 } });
  c.kit.pillar(c.source, { kind: "verdigris", height: 240, width: 130, duration: 1000 });
  for (let i = 0; i < 4; i++) c.stage.schedule(() => c.kit.ring(at, { kind: "verdigris", radius: 140 + i * 45, duration: 900 }), 200 + i * 110);
  await c.wait(1400);
} };
const brass: FamilyScript = { async cast(c) {
  const ids = c.targets.length ? c.targets : c.others.slice(0, 1);
  c.kit.mark(c.source, { kind: "verdigris", radius: R(c, 100), duration: 1400, form: form(c, { points: 12, ribs: 12, sharp: false }) });
  c.kit.pillar(c.source, { kind: "verdigris", height: R(c, 240), width: 100, duration: 900 });
  await c.wait(220);
  await c.kit.volley(c.source, ids.map(id => c.handPoint(id)), { kind: "verdigris", duration: 600, stagger: 140, lift: 100, width: 18, impact: 0.9, impactZ: 40 });
  await c.wait(200);
} };
const brassSultan: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "verdigris", radius: 150, duration: 1900, form: { points: 12, ribs: 12, ticks: 24 } });
  c.kit.pillar(c.source, { kind: "verdigris", height: 320, width: 150, duration: 1200 });
  await c.wait(300);
  await c.kit.volley(c.source, (c.targets.length ? c.targets : c.others).map(id => c.handPoint(id)), { kind: "verdigris", duration: 620, stagger: 120, lift: 120, width: 20, impact: 1, impactZ: 40 });
  await c.wait(300);
} };

// ---------- 秘 · 凡人与秘法 ----------
const mortalBase = (c: ScriptCtx, f: Partial<GlyphForm>, radius = 90) => c.kit.mark(c.source, { kind: "arcane", radius, duration: 1200, form: { points: 5, ribs: 10, hooks: true, ticks: 20, ...f } });
const prophet: FamilyScript = { async cast(c) {
  const hand = c.handPoint(c.self); mortalBase(c, { rhombus: true });
  if (hand) { await c.wait(150); c.kit.beam(hand, c.source, { kind: "arcane", duration: 560, lift: 120, width: 16 }); await c.wait(500); }
  c.kit.pillar(c.source, { kind: "arcane", height: 180, width: 90, duration: 700 }); await c.wait(600);
} };
const sorcerer: FamilyScript = { async cast(c) {
  const deck = c.pile("deck"); mortalBase(c, { ribs: 0, ticks: 12 });
  if (deck) { c.kit.pillar(deck, { kind: "arcane", height: 200, width: 100, duration: 800 }); await c.wait(300); c.kit.beam(deck, c.source, { kind: "arcane", duration: 520, lift: 90, width: 16 }); await c.wait(500); }
  await c.wait(500);
} };
const illusionist: FamilyScript = { async cast(c) {
  const sw = c.seg("MORTALS_SWAPPED")[0]; const a = sw?.cardIds?.[0] ? c.cardPoint(sw.cardIds[0]) : null, b = sw?.cardIds?.[1] ? c.cardPoint(sw.cardIds[1]) : null;
  mortalBase(c, { points: 3, rhombus: true });
  if (a && b) { c.sound("swap", c.cue.key); c.kit.beam(a, b, { kind: "arcane", duration: 820, lift: 150, width: 18 }); c.kit.beam(b, a, { kind: "crown", duration: 820, lift: 60, width: 18 }); c.stage.schedule(() => { c.kit.burst(b, 30, { kind: "arcane", count: 18, speed: 180, up: 0.8, size: 30, life: 0.7 }); c.kit.burst(a, 30, { kind: "crown", count: 18, speed: 180, up: 0.8, size: 30, life: 0.7 }); }, 560); await c.wait(1000); }
  else await c.wait(700);
} };
const archmage: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "arcane", radius: 150, duration: 1900, form: { points: 5, ribs: 10, hooks: true, ticks: 30, rhombus: true } });
  c.kit.pillar(c.source, { kind: "arcane", height: 320, width: 150, duration: 1300 });
  c.kit.burst(c.source, 30, { kind: "arcane", count: 40, speed: 200, up: 1.0, size: 32, life: 1.2 });
  await c.wait(1300);
} };
const kobold: FamilyScript = { async cast(c) {
  const discard = c.pile("discard"), deck = c.pile("deck"), hand = c.handPoint(c.self);
  mortalBase(c, { points: 3, hooks: false, ribs: 3 }, 70);
  if (hand && discard) { c.kit.beam(hand, discard, { kind: "arcane", duration: 480, lift: 80, width: 14 }); await c.wait(380); }
  if (deck && hand) { c.kit.beam(deck, hand, { kind: "arcane", duration: 520, lift: 110, width: 14 }); await c.wait(520); }
  await c.wait(200);
} };
const fool: FamilyScript = { async cast(c) {
  const deck = c.pile("deck"), hand = c.handPoint(c.self);
  c.kit.ring(c.source, { kind: "arcane", radius: 120, duration: 700 }); mortalBase(c, { points: 4, ribs: 0, ticks: 8 });
  if (deck && hand) { await c.wait(200); c.kit.beam(deck, hand, { kind: "arcane", duration: 560, lift: 120, width: 16 }); await c.wait(560); }
  await c.wait(300);
} };
const dragonslayer: FamilyScript = { async cast(c) {
  const removed = c.seg("DRAGON_REMOVED")[0]?.cardIds?.[0]; const p = removed ? c.cardPoint(removed) : null;
  mortalBase(c, { points: 4, sharp: true, ribs: 0, ticks: 0 }, 80);
  if (p) { c.kit.beam(c.source, p, { kind: "arcane", duration: 420, lift: 90, width: 16 }); await c.wait(380); c.sound("slash", c.cue.key); c.kit.claw(p, { kind: "ember", radius: 100, duration: 800 }); c.kit.burst(p, 20, { kind: "ember", count: 22, speed: 200, up: 0.8, size: 30, life: 0.7 }); await c.wait(700); }
  else await c.wait(600);
} };
const wyrmpriest: FamilyScript = { async cast(c) {
  c.kit.ring(c.source, { kind: "arcane", radius: 110, duration: 700 }); mortalBase(c, { points: 5, rhombus: true, ticks: 10 });
  c.kit.pillar(c.source, { kind: "arcane", height: 160, width: 90, duration: 800 }); await c.wait(900);
} };
const wyrmling = (kind: "arcane" | "crown"): FamilyScript => ({ async cast(c) {
  c.kit.ring(c.source, { kind, radius: 90, duration: 600 }); c.kit.mark(c.source, { kind, radius: 70, duration: 900, form: { points: 3, ribs: 3, ticks: 0 } });
  c.kit.burst(c.source, 16, { kind, count: 16, speed: 140, up: 0.9, size: 24, life: 0.7 }); await c.wait(800);
} });
const timeDragon: FamilyScript = { async cast(c) {
  const discard = c.pile("discard"), hand = c.handPoint(c.self);
  c.kit.mark(c.source, { kind: "arcane", radius: 160, duration: 2100, form: { points: 12, ribs: 12, ticks: 60, sharp: false } });
  c.kit.pillar(c.source, { kind: "arcane", height: 300, width: 150, duration: 1400 });
  c.kit.collar(c.source, { kind: "arcane", radius: 140, height: 110, duration: 2000, ticks: 60, pulse: 2 });
  await c.wait(400);
  if (discard && hand) { c.kit.beam(discard, hand, { kind: "arcane", duration: 700, lift: 150, width: 20 }); await c.wait(700); }
  await c.wait(500);
} };

// ---------- 冠 · 日轮与王座 ----------
const gold: FamilyScript = { async cast(c) {
  const deck = c.pile("deck"), hand = c.handPoint(c.self);
  c.kit.mark(c.source, { kind: "crown", radius: R(c, 110), duration: 1500, form: form(c, { points: 12, sharp: true, ticks: 12 }) });
  c.kit.pillar(c.source, { kind: "crown", height: R(c, 220), width: 110, duration: 900 });
  c.kit.burst(c.source, 20, { kind: "crown", count: N(c, 34), speed: 230, up: 0.9, size: 34, life: 0.9 });
  await c.wait(300);
  if (deck && hand) { c.kit.beam(deck, hand, { kind: "crown", duration: 600, lift: 130, width: 18 }); await c.wait(600); }
  await c.wait(300);
} };
const goldMonarch: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "crown", radius: 160, duration: 2000, form: { points: 12, sharp: true, ticks: 24, ribs: 12 } });
  c.kit.pillar(c.source, { kind: "crown", height: 320, width: 160, duration: 1300 });
  c.kit.burst(c.source, 30, { kind: "crown", count: 56, speed: 280, up: 0.9, size: 40, life: 1.0 });
  await c.wait(400);
  await c.kit.volley(c.source, [c.self, ...c.others].map(id => c.handPoint(id)), { kind: "crown", duration: 600, stagger: 90, lift: 130, width: 18, impact: 0.8, impactZ: 40 });
  await c.wait(300);
} };
const queen: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "crown", radius: 130, duration: 1800, form: { points: 7, sharp: true, ticks: 14, ribs: 0, rhombus: true } });
  c.kit.pillar(c.source, { kind: "crown", height: 240, width: 120, duration: 1000 });
  await c.wait(300);
  const ids = c.targets.length ? c.targets : c.others;
  const st = Math.min(140, 420 / Math.max(1, ids.length));
  for (const [i, id] of ids.entries()) { const co = c.coinsPoint(id), h = c.handPoint(id); c.stage.schedule(() => { if (co) c.kit.strike(c.source, co, { kind: "crown", duration: 560, lift: 100, width: 16, impact: 0.8, impactZ: 20 }); if (h) c.kit.strike(c.source, h, { kind: "arcane", duration: 620, lift: 140, width: 16, impact: 0.8, impactZ: 40 }); }, i * st); }
  await c.wait(620 + ids.length * st + 300);
} };
const princess: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "crown", radius: 130, duration: 1700, form: { points: 5, sharp: true, ticks: 10, ribs: 5 } });
  c.kit.burst(c.source, 20, { kind: "crown", count: 40, speed: 200, up: 0.95, size: 34, life: 1.1 });
  c.kit.pillar(c.source, { kind: "crown", height: 220, width: 110, duration: 900 });
  await c.wait(1000);
} };
const priest: FamilyScript = { async cast(c) {
  c.kit.ring(c.source, { kind: "crown", radius: 180, duration: 900 }); c.kit.mark(c.source, { kind: "crown", radius: 120, duration: 1700, form: { points: 4, ribs: 8, ticks: 0 } });
  c.kit.pillar(c.source, { kind: "crown", height: 260, width: 120, duration: 1100 });
  c.kit.burst(c.source, 10, { kind: "crown", count: 30, speed: 90, up: 1.0, size: 30, life: 1.4, sprites: ["star_05", "light_02"] });
  await c.wait(1200);
} };
const merchantPrince: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "crown", radius: 120, duration: 1700, form: { points: 8, ribs: 0, ticks: 16, rhombus: true } });
  c.kit.pillar(c.source, { kind: "crown", height: 200, width: 110, duration: 900 });
  await c.wait(300);
  const stakes = c.pile("stakes"); if (stakes) { c.kit.ring(stakes, { kind: "gold", radius: 120, duration: 700 }); c.kit.burst(stakes, 20, { kind: "gold", count: 24, speed: 150, up: 0.9, size: 26, life: 0.8 }); }
  await c.wait(900);
} };
const bahamut: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "crown", radius: 190, duration: 2300, form: { points: 7, sharp: true, ribs: 14, ticks: 28, rhombus: true } });
  c.kit.pillar(c.source, { kind: "crown", height: 380, width: 190, duration: 1500 });
  c.kit.collar(c.source, { kind: "crown", radius: 150, height: 120, duration: 1800, ticks: 28, pulse: 1.5 });
  c.kit.shell(c.source, 30, { kind: "crown", r1: 220, duration: 900, squash: 0.6 });
  c.kit.burst(c.source, 30, { kind: "crown", count: 70, speed: 300, up: 0.95, size: 44, life: 1.1 });
  await c.wait(420);
  await c.kit.volley(c.source, c.targets.map(id => c.coinsPoint(id)), { kind: "crown", duration: 620, stagger: 100, lift: 140, width: 20, impact: 1, impactZ: 20 });
  await c.wait(300);
} };
const tiamat: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "ember", radius: 200, duration: 2300, form: { points: 5, sharp: true, ribs: 15, ticks: 5, hooks: true } });
  c.kit.pillar(c.source, { kind: "ember", height: 400, width: 200, duration: 1600 });
  c.kit.shell(c.source, 30, { kind: "ember", r1: 240, duration: 1000, squash: 0.55 });
  const kinds = ["ember", "tide", "grove", "arcane", "crown"] as const;
  kinds.forEach((kind, i) => c.stage.schedule(() => { const a = i / 5 * Math.PI * 2; c.kit.burst({ x: c.source.x + Math.cos(a) * 90, y: c.source.y + Math.sin(a) * 60 }, 30, { kind, count: 26, speed: 220, up: 0.9, size: 36, life: 1.0 }); }, 200 + i * 130));
  await c.wait(1700);
} };
const dracolich: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: "necro", radius: 180, duration: 2300, form: { points: 4, hooks: true, ribs: 0, ticks: 16, rhombus: true } });
  c.kit.pillar(c.source, { kind: "necro", height: 340, width: 170, duration: 1500 });
  c.kit.collar(c.source, { kind: "necro", radius: 140, height: 100, duration: 1900, ticks: 16, pulse: 0.8 });
  c.kit.burst(c.source, 10, { kind: "necro", count: 40, speed: 100, up: 1.0, size: 34, life: 1.6, sprites: ["smoke_06", "magic_05", "star_07"] });
  const others = c.others.map(id => c.handPoint(id));
  others.forEach((p, i) => { if (p) c.stage.schedule(() => c.kit.claw(p, { kind: "necro", radius: 80, duration: 900 }), 500 + i * 120); });
  await c.wait(1700);
} };

export const FAMILY_SCRIPTS: Record<string, FamilyScript> = {
  black, thief, "black-raider": blackRaider, red, "red-destroyer": redDestroyer,
  blue, "blue-overlord": blueOverlord, silver, "silver-seer": silverSeer, white, "white-hunter": whiteHunter, dragonrider,
  green, "green-schemer": greenSchemer, druid,
  copper, "copper-trickster": copperTrickster, bronze, "bronze-warlord": bronzeWarlord, brass, "brass-sultan": brassSultan,
  prophet, sorcerer, illusionist, archmage, kobold, fool, dragonslayer, wyrmpriest, "chromatic-wyrmling": wyrmling("arcane"), "metallic-wyrmling": wyrmling("crown"), "time-dragon": timeDragon,
  gold, "gold-monarch": goldMonarch, queen, princess, priest, "merchant-prince": merchantPrince, bahamut, tiamat, dracolich,
};

/** 没有专属脚本的家族：按家族色做一次法阵 + 爆发（仍比旧 flare 有形态） */
export const defaultScript: FamilyScript = { async cast(c) {
  c.kit.mark(c.source, { kind: c.kind, radius: R(c, 100), duration: 1300, form: form(c, { points: 6 }) });
  c.kit.burst(c.source, 20, { kind: c.kind, count: N(c, 28), speed: 220, up: 0.8, size: 32, life: 0.9 });
  await c.wait(900);
} };
