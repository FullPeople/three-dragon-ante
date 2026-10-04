import type { UIState } from "../app/store";
import { omniscientGame, privateGame } from "../app/store";
import type { Controller } from "../app/controller";
import { cardName, t } from "../i18n";

export function ActionBar({ state, controller }: { state: UIState; controller: Controller }) {
  const view = state.view, own = privateGame(view), game = view?.game ?? null, lang = state.lang;
  const action = controller.action(), zone = controller.legalZone();
  const selected = state.selected[0] ?? null;
  const selectedCard = selected ? own?.hand.find(c => c.id === selected) : null;
  const hidePrivateLabels = !!(omniscientGame(view) ?? omniscientGame(state.display)) && state.revealOmniscientHands !== true;
  let prompt = "";
  if (state.pending) prompt = state.pending.retryable ? t("requestFailed", lang) : t("pendingReceipt", lang);
  else if (state.localMessage) prompt = t(state.localMessage, lang);
  else if (view?.message && !["connecting"].includes(view.message)) prompt = t(view.message, lang);
  else if (!view?.connected) prompt = t("connecting", lang);
  else if (action?.kind === "choose") prompt = "";
  else if (zone && selectedCard) prompt = hidePrivateLabels ? (lang === "zh" ? "牌背" : "Card back") : `${cardName(selectedCard.id, lang)} · ${selectedCard.strength}`;
  else if (own?.committedAnte && game?.phase === "ante") prompt = t("committedAnte", lang) + (hidePrivateLabels ? "" : ` · ${cardName(own.committedAnte.id, lang)} ${own.committedAnte.strength}`);
  return <div className="tda-actionbar">
    <div className="tda-actionbar-prompt">{prompt}</div>
    <div className="tda-actionbar-buttons">
      {zone && selectedCard ? <button type="button" className="tda-btn tda-btn--primary" onClick={() => controller.placeSelected(zone)}>{t(zone === "ante" ? "placeAnte" : "placeFlight", lang)}</button> : null}
      {state.pending?.retryable ? <button type="button" className="tda-btn" onClick={() => controller.retry()}>{t("retryAction", lang)}</button> : null}
      {own && game && game.phase !== "ended" ? <button type="button" className="tda-btn tda-btn--quiet" onClick={() => controller.knock()} title={t("knock", lang)}>{t("knock", lang)}</button> : null}
    </div>
  </div>;
}
