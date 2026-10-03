/** 能力选择：羊皮纸面板，选项是真实卡面或按钮；只发 choose 命令。 */
import type { UIState } from "../app/store";
import { privateGame } from "../app/store";
import type { Controller } from "../app/controller";
import { cardFaceURL } from "../../game/card-images";
import { card } from "../../game/rules/cards";
import { cardName, prompt, t } from "../i18n";

export function ChoicePanel({ state, controller }: { state: UIState; controller: Controller }) {
  const view = state.view, own = privateGame(view), game = view?.game ?? null, lang = state.lang;
  const action = controller.action();
  if (!own || !game || !action || action.kind !== "choose" || state.show.power || state.show.score) return null;
  const choice = action.choice, selected = new Set(state.selected), max = choice.max, locked = controller.locked();
  const seatName = (id: string) => id === own.selfSeatId ? t("you", lang) : game.seats.find(s => s.id === id)?.name ?? id;
  const owner = (cardId: string) => game.seats.find(seat => seat.flight.some(entry => entry.cardId === cardId))?.name ?? null;
  const range = choice.min === choice.max ? String(choice.min) : `${choice.min}–${choice.max}`;
  return <section className="tda-choice tda-parchment" role="dialog" aria-label={prompt(choice.code, lang)}>
    <h2 className="tda-choice-title">{prompt(choice.code, lang)}</h2>
    {choice.beneficiarySeatId ? <p className="tda-choice-by">{t("powerBy", lang, { name: seatName(choice.beneficiarySeatId) })}{choice.sourceCardId ? ` · ${cardName(choice.sourceCardId, lang)}` : ""}</p> : null}
    <div className="tda-choice-options">
      {choice.options.map(option => {
        const value = option.cardId ? card(option.cardId) : null;
        const isSelected = selected.has(option.id), disabled = locked || !isSelected && selected.size >= max;
        if (value) return <button key={option.id} type="button" className={`tda-choice-card${isSelected ? " is-selected" : ""}`} data-option={option.id} aria-pressed={isSelected} disabled={disabled}
          onClick={() => controller.toggleOption(option.id)} onPointerEnter={event => { if (event.pointerType !== "touch") controller.inspect(value.id, false); }} onPointerLeave={() => { if (!state.inspect?.pinned) controller.inspect(null); }}>
          <img src={cardFaceURL(value.id)} alt={`${cardName(value.id, lang)} · ${value.strength}`} draggable={false} />
          {owner(value.id) ? <small>{owner(value.id)}</small> : null}
        </button>;
        return <button key={option.id} type="button" className={`tda-btn tda-choice-btn${isSelected ? " tda-btn--primary" : ""}`} data-option={option.id} aria-pressed={isSelected} disabled={disabled} onClick={() => controller.toggleOption(option.id)}>
          {option.seatId ? seatName(option.seatId) : prompt(option.code ?? option.id, lang)}
        </button>;
      })}
    </div>
    <div className="tda-choice-footer">
      <span className="tda-choice-count">{t("selection", lang)}: {selected.size} · {t("chooseRange", lang)}: {range}</span>
      <button type="button" id="confirm-action" className="tda-btn tda-btn--primary" disabled={locked || selected.size < choice.min || selected.size > choice.max} onClick={() => controller.confirmChoice()}>{t("confirm", lang)}</button>
    </div>
  </section>;
}
