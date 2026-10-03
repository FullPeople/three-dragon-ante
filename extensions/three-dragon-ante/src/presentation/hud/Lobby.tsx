/** 枭熊大厅的最小版本（阶段 5 重做视觉）。本地对战不会进入这里。 */
import type { UIState } from "../app/store";
import type { Controller } from "../app/controller";
import { t } from "../i18n";

export function Lobby({ state, controller }: { state: UIState; controller: Controller }) {
  const view = state.view; if (!view || view.game) return null;
  const lang = state.lang, table = view.table, locked = controller.locked();
  const seated = !!table?.seats.some(seat => seat.playerId === view.selfPlayerId);
  return <div className="tda-lobby"><div className="tda-parchment tda-lobby-board">
    <h2>{t("lobbyTitle", lang)}</h2>
    {!table ? <><p>{t("noTable", lang)}</p><button type="button" className="tda-btn tda-btn--primary" disabled={locked} onClick={() => controller.send({ type: "create" })}>{t("create", lang)}</button></> : <>
      <ul className="tda-lobby-seats">{table.seats.map(seat => <li key={seat.seatId}>{seat.name}{seat.playerId === view.selfPlayerId ? ` · ${t("you", lang)}` : ""}{seat.playerId === table.hostPlayerId ? ` · ${t("host", lang)}` : ""}</li>)}</ul>
      {table.seats.length < 2 ? <p className="tda-lobby-note">{t("needPlayers", lang)}</p> : null}
      <div className="tda-end-actions">
        {!seated && table.stage !== "playing" ? <button type="button" className="tda-btn tda-btn--primary" disabled={locked || table.seats.length >= 6} onClick={() => controller.send({ type: "join" })}>{t("join", lang)}</button> : null}
        {seated && table.stage !== "playing" ? <button type="button" className="tda-btn" disabled={locked} onClick={() => controller.send({ type: "leave" })}>{t("leave", lang)}</button> : null}
        {view.isHost && table.stage === "lobby" ? <button type="button" className="tda-btn tda-btn--primary" disabled={locked || table.seats.length < 2} onClick={() => controller.send({ type: "start", options: { startingHand: 6 } })}>{t("start", lang)}</button> : null}
      </div>
    </>}
    {view.message ? <p className="tda-lobby-note">{t(view.message, lang)}</p> : null}
  </div></div>;
}
