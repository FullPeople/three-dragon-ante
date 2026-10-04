/** 联机大厅：座位、主持的开局设置、加入 / 离座 / 移交 / 开始 / 重试。 */
import { useState } from "react";
import type { UIState } from "../app/store";
import type { Controller } from "../app/controller";
import { DECK_CATALOG, DEFAULT_VARIANT, RULE_SET_CATALOG, SPECIAL_CARDS } from "../../game/rules";
import type { DeckId, RuleSetId, TableVariant } from "../../game/rules/types";
import { cardFaceURL } from "../../game/card-images";
import { cardName, t } from "../i18n";

export function Lobby({ state, controller }: { state: UIState; controller: Controller }) {
  const view = state.view; if (!view || view.game) return null;
  return <LobbyPanel key={view.table?.id ?? "none"} state={state} controller={controller} />;
}

function LobbyPanel({ state, controller }: { state: UIState; controller: Controller }) {
  const view = state.view!, lang = state.lang, table = view.table, locked = controller.locked();
  const initial = table?.variant ?? DEFAULT_VARIANT;
  const [startingGold, setStartingGold] = useState<number | undefined>(undefined);
  const [startingHand, setStartingHand] = useState(6);
  const [ruleSetId, setRuleSetId] = useState<RuleSetId>(initial.ruleSetId);
  const [deckId, setDeckId] = useState<DeckId>(initial.deckId);
  const [specialIds, setSpecialIds] = useState<string[]>(initial.specialIds ? [...initial.specialIds] : SPECIAL_CARDS.slice(0, 10).map(c => c.id));
  const seated = !!table?.seats.some(seat => seat.playerId === view.selfPlayerId);
  const canRetry = !view.connected || !!view.message || !!state.localMessage || !!state.pending?.retryable;
  const selected = SPECIAL_CARDS.map(c => c.id).filter(id => specialIds.includes(id));
  const variant: TableVariant = deckId === "selected-specials-v1" ? { ruleSetId, deckId, specialIds: selected } : { ruleSetId, deckId };
  const deck = DECK_CATALOG.find(d => d.id === deckId);
  const startDisabled = locked || !table || table.seats.length < 2 || (deckId === "selected-specials-v1" && selected.length !== 10);
  const canKick = !!table && table.stage === "lobby" && (view.canKick === true || !!view.isHost);
  const bounded = (input: HTMLInputElement, fallback: number) => { const v = input.valueAsNumber; return Number.isFinite(v) ? Math.max(Number(input.min), Math.min(Number(input.max), Math.round(v))) : fallback; };
  return <div className="tda-lobby"><div className="tda-parchment tda-lobby-board">
    <h2>{t("lobbyTitle", lang)}</h2>
    {!table ? <>
      <p className="tda-lobby-note">{t("noTable", lang)}</p>
      <div className="tda-end-actions">
        <button type="button" className="tda-btn tda-btn--primary" disabled={locked} onClick={() => controller.send({ type: "create" })}>{t("create", lang)}</button>
        {canRetry ? <button type="button" className="tda-btn" onClick={() => controller.retry()}>{t("retry", lang)}</button> : null}
      </div>
    </> : <>
      <ul className="tda-lobby-seats">{table.seats.map(seat => <li key={seat.seatId}>
        <span>{seat.name}{seat.playerId === view.selfPlayerId ? ` · ${t("you", lang)}` : ""}{seat.playerId === table.hostPlayerId ? ` · ${t("host", lang)}` : ""}</span>
        {canKick && seat.playerId !== view.selfPlayerId && seat.playerId !== table.hostPlayerId ? <button type="button" className="tda-btn tda-btn--quiet tda-lobby-kick" onClick={() => controller.send({ type: "kick", playerId: seat.playerId })}>{t("kick", lang)}</button> : null}
      </li>)}</ul>
      {table.seats.length < 2 ? <p className="tda-lobby-note">{t("needPlayers", lang)}</p> : null}
      {view.isHost && table.stage === "lobby" ? <fieldset className="tda-setup">
        <label><span>{t("startingGold", lang)}</span><input type="number" min={10} max={1000} step={1} value={startingGold ?? table.seats.length * 10} onChange={e => setStartingGold(bounded(e.currentTarget, table.seats.length * 10))} /></label>
        <label><span>{t("startingHand", lang)}</span><input type="number" min={3} max={10} step={1} value={startingHand} onChange={e => setStartingHand(bounded(e.currentTarget, 6))} /></label>
        <label><span>{t("ruleSet", lang)}</span><select id="rule-set" value={ruleSetId} onChange={e => setRuleSetId(e.currentTarget.value as RuleSetId)}>{RULE_SET_CATALOG.map(r => <option key={r.id} value={r.id}>{lang === "zh" ? r.name : r.nameEn}</option>)}</select></label>
        <label><span>{t("deckChoice", lang)}</span><select id="deck-choice" value={deckId} onChange={e => { const id = e.currentTarget.value as DeckId; setDeckId(id); }}>{DECK_CATALOG.map(d => <option key={d.id} value={d.id}>{lang === "zh" ? d.name : d.nameEn}</option>)}</select></label>
        {deck ? <p className="tda-setup-summary">{lang === "zh" ? deck.summary : deck.summaryEn}</p> : null}
        {deckId === "selected-specials-v1" ? <div className="tda-specials" role="group" aria-label={t("chooseSpecials", lang)}>
          <p className="tda-setup-summary">{t("specialsCount", lang, { n: selected.length })}</p>
          <div className="tda-specials-grid">{SPECIAL_CARDS.map(card => { const on = specialIds.includes(card.id); return <label key={card.id} className={`tda-special${on ? " is-on" : ""}`}>
            <input type="checkbox" data-card={card.id} checked={on} onChange={e => { const checked = e.currentTarget.checked; if (checked && !on && specialIds.length >= 10) return; setSpecialIds(checked ? [...new Set([...specialIds, card.id])] : specialIds.filter(id => id !== card.id)); }} />
            <img src={cardFaceURL(card.id)} alt="" loading="lazy" decoding="async" /><span>{cardName(card.id, lang)} · {card.strength}</span>
          </label>; })}</div>
        </div> : null}
        <p className="tda-lobby-note">{t("setupNote", lang)}</p>
      </fieldset> : null}
      <div className="tda-end-actions">
        {!seated && table.stage !== "playing" ? <button type="button" className="tda-btn tda-btn--primary" disabled={locked || table.seats.length >= 6} onClick={() => controller.send({ type: "join" })}>{t("join", lang)}</button> : null}
        {seated && table.stage !== "playing" ? <button type="button" className="tda-btn" disabled={locked} onClick={() => controller.send({ type: "leave" })}>{t("leave", lang)}</button> : null}
        {view.isHost && view.canHandover && table.hostConnectionId !== "server" ? <button type="button" className="tda-btn" disabled={locked} onClick={() => controller.send({ type: "handover" })}>{t("handover", lang)}</button> : null}
        {view.isHost && table.stage === "lobby" ? <button type="button" className="tda-btn tda-btn--primary" disabled={startDisabled} onClick={() => controller.send({ type: "start", options: { ...(startingGold === undefined ? {} : { startingGold }), startingHand, variant } })}>{t("start", lang)}</button> : null}
        {canRetry ? <button type="button" className="tda-btn" disabled={state.sending} onClick={() => controller.retry()}>{t("retry", lang)}</button> : null}
      </div>
    </>}
    {view.message ? <p className="tda-lobby-note">{t(view.message, lang)}</p> : state.localMessage ? <p className="tda-lobby-note">{t(state.localMessage, lang)}</p> : null}
  </div></div>;
}
