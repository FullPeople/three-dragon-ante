/** 能力选择：羊皮纸面板。每个选项都是同尺寸的"瓦片"：卡牌选项放真实卡面，文字选项放大字与短句。
 * 只发 choose 命令；单选时点另一项直接切换，多选时才会禁用多余项。 */
import type { UIState } from "../app/store";
import { privateGame } from "../app/store";
import type { Controller } from "../app/controller";
import { cardFaceURL } from "../../game/card-images";
import { card } from "../../game/rules/cards";
import { cardName, prompt, t } from "../i18n";

/** 选项短标题：大字 + 小字。只做展示，规则文本仍以 prompt() 为准。 */
function optionLabel(code: string | undefined, id: string, lang: "zh" | "en"): { big: string; small: string } {
  const zh = lang === "zh";
  switch (code ?? id) {
    case "PAY_FIVE": return { big: "5", small: zh ? "金币 · 支付" : "gold · pay" };
    case "TAKE_GOLD": return { big: zh ? "收" : "Take", small: zh ? "对手付给你" : "opponents pay you" };
    case "INCREASE_STAKES": return { big: zh ? "池" : "Pot", small: zh ? "对手付入奖池" : "opponents pay stakes" };
    case "KEEP_CARD": return { big: zh ? "留" : "Keep", small: zh ? "不替换" : "no replacement" };
    case "TRIGGER_POWER": return { big: zh ? "发" : "Fire", small: zh ? "发动新牌能力" : "trigger power" };
    case "SKIP_POWER": return { big: zh ? "不" : "No", small: zh ? "不发动" : "skip power" };
    case "DO_NOT_COPY": return { big: zh ? "不" : "No", small: zh ? "不借用" : "do not copy" };
    default: return { big: "·", small: prompt(code ?? id, lang) };
  }
}

export function ChoicePanel({ state, controller }: { state: UIState; controller: Controller }) {
  const view = state.view, own = privateGame(view), game = view?.game ?? null, lang = state.lang;
  const action = controller.action();
  if (!own || !game || !action || action.kind !== "choose" || state.show.power || state.show.score || state.show.formation || state.show.tally) return null;
  const choice = action.choice, selected = new Set(state.selected), max = choice.max, min = choice.min, locked = controller.locked();
  const seatName = (id: string) => id === own.selfSeatId ? t("you", lang) : game.seats.find(s => s.id === id)?.name ?? id;
  const owner = (cardId: string) => game.seats.find(seat => seat.flight.some(entry => entry.cardId === cardId))?.name ?? null;
  const cardOptions = choice.options.filter(o => o.cardId);
  // 并列提示：只对"取最低前注牌"一类按点数筛出来的选择，且全部卡牌选项同点数、只能选一张
  const tied = ["LOWEST_ANTE_CARD", "STRENGTH_FLIGHT_ANTE", "KEEP_ONE_ANTE_CARD"].includes(choice.code) && cardOptions.length > 1 && max === 1 && cardOptions.every(o => { try { return card(o.cardId!).strength === card(cardOptions[0].cardId!).strength; } catch { return false; } });
  const range = min === 0 ? t("choiceOptional", lang) : min === max ? t("choicePickN", lang, { n: min }) : t("choicePickRange", lang, { a: min, b: max });
  return <section className="tda-choice tda-parchment" role="dialog" aria-label={prompt(choice.code, lang)}>
    <div className="tda-choice-head">
      <h2 className="tda-choice-title">{prompt(choice.code, lang)}</h2>
      <p className="tda-choice-by">
        {choice.beneficiarySeatId ? `${t("powerBy", lang, { name: seatName(choice.beneficiarySeatId) })}${choice.sourceCardId ? ` · ${cardName(choice.sourceCardId, lang)}` : ""} · ` : ""}
        {range}{tied ? ` · ${t("choiceTieAny", lang)}` : ""}
      </p>
    </div>
    <div className="tda-choice-options" role="group">
      {choice.options.map(option => {
        const value = option.cardId ? card(option.cardId) : null;
        const isSelected = selected.has(option.id);
        // 单选：永远可点，点别的直接切换；多选：选满后其余禁用
        const disabled = locked || (max > 1 && !isSelected && selected.size >= max);
        if (value) return <button key={option.id} type="button" className={`tda-tile tda-tile--card${isSelected ? " is-selected" : ""}`} data-option={option.id} aria-pressed={isSelected} disabled={disabled}
          onClick={() => controller.toggleOption(option.id)} onPointerEnter={event => { if (event.pointerType !== "touch") controller.inspect(value.id, false); }} onPointerLeave={() => { if (!state.inspect?.pinned) controller.inspect(null); }}>
          <img src={cardFaceURL(value.id)} alt={`${cardName(value.id, lang)} · ${value.strength}`} draggable={false} />
          <span className="tda-tile-strength tda-num">{value.strength}</span>
          {owner(value.id) ? <small className="tda-tile-owner">{owner(value.id)}</small> : null}
        </button>;
        const label = option.seatId ? { big: seatName(option.seatId).slice(0, 2), small: seatName(option.seatId) } : optionLabel(option.code, option.id, lang);
        return <button key={option.id} type="button" className={`tda-tile tda-tile--text${isSelected ? " is-selected" : ""}`} data-option={option.id} aria-pressed={isSelected} disabled={disabled} onClick={() => controller.toggleOption(option.id)}>
          <b className="tda-tile-big tda-num">{label.big}</b>
          <span className="tda-tile-small">{label.small}</span>
        </button>;
      })}
    </div>
    <div className="tda-choice-footer">
      <span className="tda-choice-count">{t("selection", lang)} {selected.size} / {max}</span>
      <button type="button" id="confirm-action" className="tda-btn tda-btn--primary" disabled={locked || selected.size < min || selected.size > max} onClick={() => controller.confirmChoice()}>{t("confirm", lang)}</button>
    </div>
  </section>;
}
