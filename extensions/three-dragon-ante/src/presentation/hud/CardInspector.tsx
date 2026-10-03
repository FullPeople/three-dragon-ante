import { cardFaceURL } from "../../game/card-images";
import { card } from "../../game/rules/cards";
import type { UIState } from "../app/store";
import { privateGame } from "../app/store";
import type { Controller } from "../app/controller";
import { alignmentWord, cardHint, cardName, t } from "../i18n";

export function CardInspector({ state, controller }: { state: UIState; controller: Controller }) {
  const inspect = state.inspect; if (!inspect || state.show.power) return null;
  let value; try { value = card(inspect.cardId); } catch { return null; }
  const lang = state.lang, own = privateGame(state.view);
  const hint = own?.handPowerHints.find(h => h.cardId === value.id);
  const hintText = hint?.state === "power-ready" ? t(hint.reason === "first-player" ? "powerReadyFirst" : hint.reason === "archmage" ? "powerReadyArchmage" : "powerReadyLower", lang) : hint?.state === "playable-no-power" ? t(hint.reason === "no-ordinary-power" ? "powerNoOrdinary" : "powerNoTrigger", lang) : "";
  return <aside className={`tda-inspector${inspect.pinned ? " is-pinned" : ""}`} data-card-inspector={value.id} aria-live="polite">
    <img className="tda-inspector-face" src={cardFaceURL(value.id)} alt={cardName(value.id, lang)} draggable={false} />
    <div className="tda-inspector-copy tda-parchment">
      <div className="tda-inspector-head"><span className="tda-num tda-inspector-strength">{value.strength}</span><h2>{cardName(value.id, lang)}</h2><span className={`tda-inspector-align is-${value.alignment}`}>{alignmentWord(value, lang)}</span></div>
      <p className="tda-inspector-hint">{cardHint(value, lang)}</p>
      {hintText ? <p className={`tda-inspector-power is-${hint?.state}`}>{hintText}</p> : null}
      {inspect.pinned ? <button type="button" className="tda-btn tda-btn--quiet tda-inspector-close" onClick={() => controller.inspect(null)} aria-label={t("close", lang)}>×</button> : null}
    </div>
  </aside>;
}
