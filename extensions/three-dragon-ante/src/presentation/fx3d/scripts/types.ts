/** 家族脚本的上下文：只含公共信息（能力提示 cue、公共事件、公开的锚点），坐标全是平面坐标。 */
import type { PublicEvent } from "../../../game/rules/types";
import type { PowerCue } from "../../model/cues";
import type { FxKind } from "../../fx/particles";
import type { FxStage, Tier } from "../FxStage";
import type { Kit, P } from "../kit";
import type { Palette } from "../palette";

export interface ScriptCtx {
  stage: FxStage; kit: Kit; cue: PowerCue; events: readonly PublicEvent[];
  kind: FxKind; palette: Palette; tier: Tier;
  /** 源牌中心（平面） */
  source: P;
  /** 标准龙按点数的调幅 0..1（传说 / 凡人固定 0.6） */
  strength: number;
  legendary: boolean;
  /** 公开的目标座位（能力提示里给的），与除出牌者之外的全部座位 */
  targets: string[]; others: string[]; self: string;
  cardPoint(cardId: string): P | null;
  handPoint(seatId: string): P | null;
  coinsPoint(seatId: string): P | null;
  seatPoint(seatId: string): P | null;
  pile(id: "deck" | "discard" | "stakes" | "hole"): P | null;
  seg(code: string): PublicEvent[];
  sound(kind: string, key: string): void;
  wait(ms: number): Promise<void>;
}

export interface FamilyScript {
  /** 发动 + 内联结算；非等待脚本 ≤ 2000 ms */
  cast(c: ScriptCtx): Promise<void>;
}
