import type { WaitingLine as WaitingModel } from "../model/flow";
import type { PublicView } from "../../game/rules/types";

export function WaitingLine({ line, game, selfSeatId }: { line: WaitingModel; game: PublicView | null; selfSeatId: string | null }) {
  if (!line.text) return null;
  const chips = line.waitingSeatIds.filter(id => id !== selfSeatId).map(id => game?.seats.find(s => s.id === id)).filter((seat): seat is NonNullable<typeof seat> => !!seat);
  return <div className={`tda-waiting is-${line.emphasis}`} role="status" aria-live="polite">
    {line.emphasis === "you" ? <span className="tda-waiting-star" aria-hidden="true">★</span> : null}
    <span className="tda-waiting-text">{line.text}</span>
    {chips.length ? <span className="tda-waiting-chips" aria-hidden="true">{chips.map(seat => <span key={seat.id} className="tda-chip">{seat.name.slice(0, 1)}</span>)}</span> : null}
    {line.emphasis === "show" ? <span className="tda-waiting-bar" aria-hidden="true" /> : null}
  </div>;
}
