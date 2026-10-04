import { useState } from "react";
import type { Card } from "../../game/rules/cards";
import { cardFaceURL } from "../../game/card-images";
import type { Controller } from "../app/controller";
import { cardName, type Lang } from "../i18n";

/** A local draft only: the server validates and applies the complete permutation. */
export function DeckOrderPanel({ cards, revision, lang, disabled, controller }: { cards: Card[]; revision: number; lang: Lang; disabled: boolean; controller: Controller }) {
  const [order, setOrder] = useState(() => cards.map(card => card.id));
  const changed = order.some((id, index) => id !== cards[index]?.id);
  const move = (from: number, to: number) => setOrder(current => { const next = [...current]; const [id] = next.splice(from, 1); next.splice(to, 0, id); return next; });
  const zh = lang === "zh";
  return <section className="tda-editor-deck" aria-label={zh ? "牌堆顺序" : "Deck order"}>
    <p>{zh ? "从上到下排列，第 1 张是下一张抽牌。修改只在点击应用后提交；牌局变化会重置未提交的顺序。" : "Top to bottom: card 1 is the next draw. Apply to submit; game changes reset the draft."}</p>
    <div className="tda-editor-deck-actions">
      <button type="button" className="tda-btn" data-testid="deck-order-reset" disabled={disabled || !changed} onClick={() => setOrder(cards.map(card => card.id))}>{zh ? "恢复当前顺序" : "Reset order"}</button>
      <button type="button" className="tda-btn tda-btn--primary" data-testid="deck-order-apply" disabled={disabled || !changed} onClick={() => controller.send({ type: "edit", edit: { kind: "deckOrder", cardIds: order, revision } })}>{zh ? "应用牌堆顺序" : "Apply deck order"}</button>
    </div>
    <ol className="tda-editor-deck-list">{order.map((id, index) => <li key={id} data-deck-index={index}>
      <b className="tda-num">{index + 1}</b><img src={cardFaceURL(id)} alt="" draggable={false} decoding="async" loading="lazy" />
      <span>{cardName(id, lang)}{index === 0 ? (zh ? " · 下一张" : " · Next draw") : ""}</span>
      <div className="tda-editor-deck-moves">
        <button type="button" data-testid="deck-order-top" disabled={disabled || index === 0} onClick={() => move(index, 0)} aria-label={zh ? "放到牌堆顶" : "Move to top"}>⇈</button>
        <button type="button" data-testid="deck-order-up" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={zh ? "上移一张" : "Move up"}>↑</button>
        <button type="button" data-testid="deck-order-down" disabled={disabled || index === order.length - 1} onClick={() => move(index, index + 1)} aria-label={zh ? "下移一张" : "Move down"}>↓</button>
        <button type="button" data-testid="deck-order-bottom" disabled={disabled || index === order.length - 1} onClick={() => move(index, order.length - 1)} aria-label={zh ? "放到牌堆底" : "Move to bottom"}>⇊</button>
      </div>
    </li>)}</ol>
    {!order.length ? <p>{zh ? "牌堆已空" : "The deck is empty"}</p> : null}
  </section>;
}
