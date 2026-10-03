/** 主持的全能编辑器。只读本机全能投影，每个改动以 `edit` 命令送出，从不改本地副本。 */
import { useState, type DragEvent } from "react";
import type { UIState } from "../app/store";
import { omniscientGame } from "../app/store";
import type { Controller } from "../app/controller";
import type { Card } from "../../game/rules/cards";
import { cardFaceURL } from "../../game/card-images";
import { cardName, t } from "../i18n";

interface EditorCard { id: string; name: string; image: string; strength: number }
const MAX_GOLD = 100000;

function Face({ card, picked, onContext }: { card: EditorCard; picked: boolean; onContext(event: React.MouseEvent): void }) {
  return <button type="button" className={`tda-editor-card${picked ? " is-picked" : ""}`} data-card={card.id} aria-pressed={picked} draggable
    onDragStart={event => { event.dataTransfer.setData("text/plain", card.id); event.dataTransfer.effectAllowed = "move"; }} onContextMenu={onContext} title={`${card.name} · ${card.strength}`}>
    <img src={card.image} alt="" draggable={false} /><span>{card.name}</span>
  </button>;
}

export function Editor({ state, controller }: { state: UIState; controller: Controller }) {
  const view = state.view, inspection = omniscientGame(view);
  const authorized = !!view?.isHost || view?.role === "GM";
  if (!inspection || !authorized) return null;
  return <EditorPanel key={inspection.id} state={state} controller={controller} />;
}

function EditorPanel({ state, controller }: { state: UIState; controller: Controller }) {
  const lang = state.lang, inspection = omniscientGame(state.view)!;
  const toCard = (value: Card): EditorCard => ({ id: value.id, name: cardName(value.id, lang), image: cardFaceURL(value.id), strength: value.strength });
  const seats = inspection.seats.map(seat => ({ id: seat.id, name: seat.name, gold: seat.gold, debt: seat.debt, isSelf: seat.id === inspection.selfSeatId, isLeader: seat.id === inspection.leaderSeatId, committed: seat.committed,
    hand: (inspection.privateHands[seat.id] ?? []).map(toCard), ante: inspection.privateCommittedAntes[seat.id] ? toCard(inspection.privateCommittedAntes[seat.id]!) : null }));
  const taken = new Set(Object.values(inspection.privateHands).flat().map(value => value.id));
  const pool = [...(inspection.privateDeck ?? []), ...inspection.discard, ...(inspection.privateExcluded ?? [])].filter(value => !taken.has(value.id)).map(toCard);
  const [picked, setPicked] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ cardId: string; x: number; y: number; send: boolean } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const send = controller.send;
  const setGold = (seatId: string, amount: number) => send({ type: "edit", edit: { kind: "gold", seatId, amount } });
  const moveCard = (cardId: string, toSeatId: string | null) => send({ type: "edit", edit: { kind: "moveCard", cardId, toSeatId } });
  const replace = (cardId: string, withCardId: string) => send({ type: "edit", edit: { kind: "replaceCard", cardId, withCardId } });
  const needle = query.trim().toLowerCase();
  const picking = adding ? adding : picked && replacing ? picked : null;
  const candidates = picking ? pool.filter(card => card.id !== picking && (!needle || card.name.toLowerCase().includes(needle) || card.id.includes(needle))).slice(0, 60) : [];
  const drop = (event: DragEvent, toSeatId: string | null) => {
    const cardId = event.dataTransfer.getData("text/plain") || picked; if (!cardId) return; event.preventDefault();
    if (replacing && picked && cardId === picked) { setReplacing(false); return; }
    if (toSeatId === null || !replacing) moveCard(cardId, toSeatId);
    setPicked(null); setReplacing(false);
  };
  const info: [string, number][] = [[t("editorDeck", lang), inspection.deckCount], [t("editorDiscard", lang), inspection.discard.length], [t("editorStakes", lang), inspection.stakes], [t("editorHole", lang), inspection.hole], [t("editorRound", lang), inspection.round], [t("editorGambit", lang), inspection.gambit]];
  return <section id="table-editor" className="tda-editor tda-parchment" role="dialog" aria-label={t("omniscientTitle", lang)}>
    <header className="tda-editor-head">
      <h2>{t("omniscientTitle", lang)}</h2>
      <p>{t("editorHint", lang)}</p>
      <div className="tda-editor-piles">{info.map(([label, value]) => <span key={label} className="tda-editor-pile"><small>{label}</small><b className="tda-num">{value}</b></span>)}</div>
      <button id="table-editor-close" type="button" className="tda-btn tda-btn--quiet" onClick={() => send({ type: "omniscient", enabled: false })}>{t("close", lang)}</button>
    </header>
    <div className="tda-editor-body">
      {seats.map(seat => <article key={seat.id} className="tda-editor-seat" data-seat={seat.id} onDragOver={event => { if (picked || event.dataTransfer.types.includes("text/plain")) event.preventDefault(); }} onDrop={event => drop(event, seat.id)}>
        <h3>{seat.name}{seat.isSelf ? " ★" : ""}{seat.isLeader ? ` · ${t("leader", lang)}` : ""}</h3>
        <p className="tda-editor-gold"><span>{t("editorGold", lang)}</span>
          <input key={seat.gold} type="number" min={0} max={MAX_GOLD} defaultValue={seat.gold} aria-label={`${seat.name} ${t("editorAmount", lang)}`} onKeyDown={event => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }}
            onBlur={event => { const value = Math.max(0, Math.min(MAX_GOLD, Math.round(event.target.valueAsNumber))); if (Number.isFinite(value) && value !== seat.gold) setGold(seat.id, value); }} />
          {seat.debt ? <small>· {t("debt", lang)} {seat.debt}</small> : null}</p>
        <p className="tda-editor-ante">{t("editorAnte", lang)}: {seat.ante ? <Face card={seat.ante} picked={false} onContext={event => { event.preventDefault(); setPicked(seat.ante!.id); setReplacing(true); }} /> : <em>{seat.committed ? "•" : t("editorEmpty", lang)}</em>}</p>
        <div className="tda-editor-hand" aria-label={`${seat.name} ${t("editorHand", lang)}`}>
          {seat.hand.length ? seat.hand.map(card => <Face key={card.id} card={card} picked={picked === card.id} onContext={event => { event.preventDefault(); setPicked(null); setReplacing(false); setMenu({ cardId: card.id, x: event.clientX, y: event.clientY, send: false }); }} />) : <em>{t("editorEmpty", lang)}</em>}
          <button type="button" className="tda-editor-card tda-editor-add" data-add={seat.id} title={t("editorAddCard", lang)} onClick={() => { setAdding(seat.id); setQuery(""); setPicked(null); setReplacing(false); }}>＋</button>
        </div>
      </article>)}
      <article className="tda-editor-remove" id="table-editor-remove" onDragOver={event => event.preventDefault()} onDrop={event => drop(event, null)} onClick={() => { if (picked) { moveCard(picked, null); setPicked(null); } }}>
        <h3>{t("editorRemove", lang)}</h3><p>{t("editorRemoveHint", lang)}</p>
      </article>
    </div>
    {menu ? <section className="tda-editor-menu tda-parchment" role="menu" style={{ left: menu.x, top: menu.y }}>
      <button type="button" role="menuitem" onClick={() => { setPicked(menu.cardId); setReplacing(true); setMenu(null); }}>{t("editorReplace", lang)}</button>
      <button type="button" role="menuitem" onClick={() => { moveCard(menu.cardId, null); setMenu(null); setPicked(null); }}>{t("editorRemove", lang)}</button>
      <button type="button" role="menuitem" onClick={() => setMenu({ ...menu, send: !menu.send })} aria-expanded={menu.send}>{t("editorGiveTo", lang)} ▸</button>
      {menu.send ? <div className="tda-editor-submenu">{seats.filter(seat => !seat.hand.some(card => card.id === menu.cardId)).map(seat => <button key={seat.id} type="button" role="menuitem" data-give={seat.id} onClick={() => { moveCard(menu.cardId, seat.id); setMenu(null); setPicked(null); }}>{seat.name}</button>)}</div> : null}
      <button type="button" role="menuitem" onClick={() => setMenu(null)}>{t("close", lang)}</button>
    </section> : null}
    {replacing || adding ? <section className="tda-editor-search" role="region" aria-label={t("editorSearch", lang)}>
      <h3>{t("editorSearch", lang)}</h3>
      <input id="table-editor-search" type="search" value={query} placeholder={t("editorSearchPlaceholder", lang)} onChange={event => setQuery(event.target.value)} autoFocus />
      <div className="tda-editor-candidates">{candidates.length ? candidates.map(card => <button key={card.id} type="button" className="tda-editor-card" data-candidate={card.id} title={`${card.name} · ${card.strength}`} onClick={() => { if (adding) moveCard(card.id, adding); else if (picked) replace(picked, card.id); setPicked(null); setReplacing(false); setAdding(null); setQuery(""); }}><img src={card.image} alt="" draggable={false} decoding="async" loading="lazy" /><span>{card.name}</span></button>) : <p>{t("editorNoResults", lang)}</p>}</div>
    </section> : null}
  </section>;
}
