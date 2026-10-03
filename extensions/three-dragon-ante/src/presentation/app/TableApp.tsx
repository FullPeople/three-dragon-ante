/** 牌桌根组件：顶栏 / 流程轨 + 等待行 / 场景 / 行动栏，再叠选择面板、详视、横幅、聚光、计分板、终局、大厅。 */
import { useEffect, useMemo, useRef } from "react";
import { privateGame, useStore, type Store } from "./store";
import type { Controller } from "./controller";
import { TableScene } from "../scene/TableScene";
import { FlowRail } from "../hud/FlowRail";
import { WaitingLine } from "../hud/WaitingLine";
import { ActionBar } from "../hud/ActionBar";
import { ChoicePanel } from "../hud/ChoicePanel";
import { CardInspector } from "../hud/CardInspector";
import { EndPanel, PhaseBanner, PowerSpotlight, ScoreBoard } from "../hud/Overlays";
import { Lobby } from "../hud/Lobby";
import { waitingLine, type PresentationFlags } from "../model/flow";
import { t } from "../i18n";
import type { FxLayer } from "../fx/particles";
import type { Orientation } from "../model/layout";

export interface TableAppProps { store: Store; controller: Controller; onFx(fx: FxLayer | null): void; onOrientation(orientation: Orientation): void; showTopBar: boolean }

export function TableApp({ store, controller, onFx, onOrientation, showTopBar }: TableAppProps) {
  const state = useStore(store);
  const view = state.view, display = state.display, game = display?.game ?? null, own = privateGame(display);
  const lang = state.lang;
  const flags: PresentationFlags = useMemo(() => ({ revealing: !!state.show.revealPhase, resolvingSeatId: state.show.resolvingSeatId, scoring: state.show.scoring }), [state.show.revealPhase, state.show.resolvingSeatId, state.show.scoring]);
  const seatName = (id: string) => game?.seats.find(s => s.id === id)?.name ?? id;
  const line = waitingLine(game, own?.selfSeatId ?? null, lang, flags, seatName, state.slowSeatIds);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = root.current; if (!el) return; const onKey = (event: KeyboardEvent) => { if ((event.target as HTMLElement)?.closest?.("input, select, textarea")) return; controller.keyboard(event); }; el.addEventListener("keydown", onKey); return () => el.removeEventListener("keydown", onKey); }, [controller]);
  const inGame = !!game;
  return <div ref={root} className={`tda-shell${state.busy ? " is-busy" : ""}${state.pending ? " is-pending" : ""}`} data-phase={game?.phase ?? "lobby"} data-busy={state.busy} data-pending-action={state.pending ? "true" : "false"} data-renderer="dom25" tabIndex={-1}>
    {showTopBar ? <header className="tda-topbar">
      <div className="tda-topbar-title">{t("siteTitle", lang)}<small>{t("siteSubtitle", lang)}</small></div>
      <div className="tda-topbar-tools">
        <button type="button" className="tda-btn tda-btn--quiet" onClick={() => controller.toggleSound()} aria-pressed={state.soundOn}>{t(state.soundOn ? "soundOn" : "soundOff", lang)}</button>
        <button type="button" className="tda-btn tda-btn--quiet" onClick={() => controller.setLanguage(lang === "zh" ? "en" : "zh")}>{lang === "zh" ? "English" : "中文"}</button>
        {state.hostKind === "local" || view?.isHost ? <button type="button" className="tda-btn tda-btn--quiet" onClick={() => controller.send({ type: "newGame" })} disabled={!inGame}>{t("newGame", lang)}</button> : null}
        <button type="button" className="tda-btn tda-btn--quiet" onClick={() => controller.send({ type: "close" })}>{t("leaveGame", lang)}</button>
      </div>
    </header> : <div />}
    <div className="tda-status">
      <FlowRail game={game} lang={lang} flags={flags} />
      <WaitingLine line={line} game={game} selfSeatId={own?.selfSeatId ?? null} />
    </div>
    <TableScene state={state} controller={controller} onFx={onFx} onOrientation={onOrientation} />
    <ActionBar state={state} controller={controller} />
    <ChoicePanel state={state} controller={controller} />
    <CardInspector state={state} controller={controller} />
    <PhaseBanner state={state} />
    <ScoreBoard state={state} />
    <PowerSpotlight state={state} controller={controller} />
    <EndPanel state={state} controller={controller} />
    <Lobby state={state} controller={controller} />
  </div>;
}
