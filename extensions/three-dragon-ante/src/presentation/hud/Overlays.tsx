/** 阶段横幅、能力聚光层、计分板、终局面板。全部由演出调度决定何时出现。 */
import type { UIState } from "../app/store";
import { privateGame } from "../app/store";
import type { Controller } from "../app/controller";
import { cardFaceURL } from "../../game/card-images";
import { card } from "../../game/rules/cards";
import { cardHint, cardName, joinNames, t } from "../i18n";
import { familyFx } from "../app/presenter";

function useNames(state: UIState) {
  const game = state.display?.game ?? state.view?.game ?? null, own = privateGame(state.display ?? state.view);
  return (id: string) => id === own?.selfSeatId ? t("you", state.lang) : game?.seats.find(s => s.id === id)?.name ?? id;
}

export function PhaseBanner({ state }: { state: UIState }) {
  const cue = state.show.banner; if (!cue) return null;
  const lang = state.lang, name = useNames(state);
  let title = "", sub = "";
  if (cue.kind === "round") { title = t("round", lang, { n: cue.round }); sub = t("bannerRound", lang, { n: cue.round, name: name(cue.seatId) }); }
  else if (cue.kind === "turn") { title = t("bannerTurn", lang, { name: name(cue.seatId) }); }
  else if (cue.kind === "ante") { title = t("bannerAnte", lang, { n: cue.gambit }); }
  else if (cue.kind === "end") { title = t("ended", lang); sub = t("bannerEnd", lang, { names: joinNames(cue.winners.map(name), lang) }); }
  else if (cue.kind === "purchase") { title = t("bannerPurchase", lang, { name: name(cue.seatId), n: cue.price }); }
  else if (cue.kind === "reward") { title = t("bannerReward", lang, { name: name(cue.seatId), n: cue.amount }); }
  return <div className={`tda-banner tda-banner--${cue.kind}`} key={cue.key} role="status" aria-live="polite">
    <div className="tda-banner-scroll tda-parchment"><h2>{title}</h2>{sub ? <p>{sub}</p> : null}{cue.kind === "purchase" ? <img className="tda-banner-card" src={cardFaceURL(cue.cardId)} alt="" /> : null}</div>
  </div>;
}

export function PowerSpotlight({ state, controller }: { state: UIState; controller: Controller }) {
  const cue = state.show.power; if (!cue) return null;
  const lang = state.lang, name = useNames(state);
  let value; try { value = card(cue.cardId); } catch { return null; }
  const kind = familyFx(cue.family);
  const relationLabel = (relation: "direct" | "choice" | "payment" | "transfer" | "swap") => t(({ direct: "powerTargetDirect", choice: "powerTargetChoice", payment: "powerTargetPayment", transfer: "powerTargetTransfer", swap: "powerTargetSwap" } as const)[relation], lang);
  const groups = new Map<string, string[]>();
  for (const target of cue.targetRelations ?? []) { const label = relationLabel(target.relation); groups.set(label, [...(groups.get(label) ?? []), name(target.seatId)]); }
  return <div className={`tda-spotlight is-${kind}`} role="dialog" aria-modal="true" aria-label={cardName(value.id, lang)} onClick={() => controller.dismissPower()}>
    <div className="tda-spotlight-card"><img src={cardFaceURL(value.id)} alt="" draggable={false} /></div>
    <div className="tda-spotlight-copy tda-parchment">
      <p className="tda-spotlight-by">{t("powerBy", lang, { name: name(cue.seatId) })}</p>
      <h2>{cardName(value.id, lang)} <span className="tda-num">{value.strength}</span></h2>
      {groups.size ? <p className="tda-spotlight-targets">{[...groups].map(([label, names]) => `${label}${lang === "zh" ? "：" : ": "}${joinNames(names, lang)}`).join(" · ")}</p> : null}
      <p className="tda-spotlight-text">{cardHint(value, lang)}</p>
      <div className="tda-spotlight-actions"><button type="button" className="tda-btn tda-btn--primary" onClick={event => { event.stopPropagation(); controller.dismissPower(); }}>{t("continue", lang)}</button></div>
    </div>
  </div>;
}

export function ScoreBoard({ state }: { state: UIState }) {
  const score = state.show.score; if (!score) return null;
  const lang = state.lang, name = useNames(state), report = score.report, step = score.step;
  const max = Math.max(0, ...report.rows.map(row => row.cards.length)), bonusStep = max + 1, finished = step > bonusStep;
  return <div className="tda-score" role="status" aria-live="polite">
    <div className="tda-score-board tda-parchment">
      <h2>{t("scoreTitle", lang, { n: report.gambit })}</h2>
      <p className="tda-score-sub">{t(report.weakest ? "scoreLow" : "scoreHigh", lang)}</p>
      <div className="tda-score-rows">
        {report.rows.map(row => {
          const visible = row.cards.slice(0, Math.min(step, row.cards.length)), bonus = step >= bonusStep ? row.bonus : 0;
          const total = visible.reduce((sum, c) => sum + c.points, 0) + bonus;
          return <div key={row.seatId} className={`tda-score-row${finished && report.winners.includes(row.seatId) ? " is-winner" : ""}${row.eligible ? "" : " is-ineligible"}`}>
            <strong className="tda-score-name">{name(row.seatId)}</strong>
            <div className="tda-score-cards">{row.cards.map((entry, i) => <span key={entry.cardId} className={`tda-score-card${i < step ? " is-counted" : ""}${i === step - 1 ? " is-counting" : ""}`}><img src={cardFaceURL(entry.cardId)} alt={cardName(entry.cardId, lang)} /><b>+{entry.points}</b></span>)}</div>
            <div className="tda-score-sum"><span className="tda-score-eq">{visible.map(c => c.points).join(" + ")}{bonus ? ` + ${bonus}` : ""}</span><b className="tda-num tda-score-total">= {total}</b>
              {row.bonus ? <small>{t("bonusDracolich", lang)} +{step >= bonusStep ? row.bonus : "…"}</small> : null}
              {!row.eligible ? <small className="tda-score-bad">{t("ineligible", lang)}</small> : null}</div>
          </div>;
        })}
      </div>
      {finished ? <div className="tda-score-result">
        <h3>{report.reason === "tied" ? t("scoreTied", lang) : report.reason === "warlord" ? t("scoreWarlord", lang) : t("scoreWins", lang, { names: joinNames(report.winners.map(name), lang) })}</h3>
        {report.reason !== "tied" && report.reason !== "warlord" ? report.payouts.map(pay => <p key={pay.seatId} className="tda-score-payout">{name(pay.seatId)} <span className="tda-num">+{pay.amount}</span> {t("gold", lang)}</p>) : null}
        {report.reason === "empty-stakes" ? <small>{t("scoreEmpty", lang)}</small> : null}
      </div> : null}
    </div>
  </div>;
}

export function EndPanel({ state, controller }: { state: UIState; controller: Controller }) {
  const game = state.display?.game ?? null; if (!game || game.phase !== "ended" || state.show.banner || state.show.score) return null;
  const lang = state.lang, name = useNames(state);
  return <div className="tda-end"><div className="tda-parchment tda-end-board">
    <h2>{t("ended", lang)}</h2>
    <p className="tda-end-winners">{t("winners", lang)}: {joinNames(game.winners.map(name), lang)}</p>
    <ul className="tda-end-table">{[...game.seats].sort((a, b) => b.gold - a.gold).map(seat => <li key={seat.id}><span>{name(seat.id)}</span><b className="tda-num">{seat.gold}</b></li>)}</ul>
    <div className="tda-end-actions">
      {state.hostKind === "local" || state.view?.isHost ? <button type="button" className="tda-btn tda-btn--primary" onClick={() => controller.send({ type: "newGame" })}>{t("newGame", lang)}</button> : null}
      <button type="button" className="tda-btn" onClick={() => controller.send({ type: "close" })}>{t("leaveGame", lang)}</button>
    </div>
  </div></div>;
}
