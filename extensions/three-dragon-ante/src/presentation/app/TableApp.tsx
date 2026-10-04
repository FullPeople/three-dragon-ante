/** 牌桌根组件：顶栏 / 流程轨 + 等待行 / 场景 / 行动栏，再叠选择面板、详视、横幅、聚光、计分板、终局、大厅。 */
import { useEffect, useMemo, useRef, useState } from "react";
import { omniscientGame, privateGame, useStore, type Store } from "./store";
import { Editor } from "../hud/Editor";
import type { Controller } from "./controller";
import { TableScene } from "../scene/TableScene";
import { FlowRail } from "../hud/FlowRail";
import { WaitingLine } from "../hud/WaitingLine";
import { ActionBar } from "../hud/ActionBar";
import { ChoicePanel } from "../hud/ChoicePanel";
import { CardInspector } from "../hud/CardInspector";
import { EndPanel, FormationSpotlight, PhaseBanner, PowerSpotlight, ScoreBoard } from "../hud/Overlays";
import { Lobby } from "../hud/Lobby";
import { waitingLine, type PresentationFlags } from "../model/flow";
import { t } from "../i18n";
import type { FxLayer } from "../fx/particles";
import type { FxStage } from "../fx3d/FxStage";
import type { Orientation } from "../model/layout";

export interface TableAppProps { store: Store; controller: Controller; onFx(fx: FxLayer | null): void; onFx3d?(stage: FxStage | null): void; onOrientation(orientation: Orientation): void; showTopBar: boolean; onLand?(key: string, zone: string): void }

export function TableApp({ store, controller, onFx, onFx3d, onOrientation, showTopBar, onLand }: TableAppProps) {
  const state = useStore(store);
  const view = state.view, display = state.display, game = display?.game ?? null, own = privateGame(display);
  const flowGame = (state.flow ?? display)?.game ?? null;
  const lang = state.lang;
  const flags: PresentationFlags = useMemo(() => ({ revealing: !!state.show.revealPhase, resolvingSeatId: state.show.resolvingSeatId, scoring: state.show.scoring }), [state.show.revealPhase, state.show.resolvingSeatId, state.show.scoring]);
  const seatName = (id: string) => game?.seats.find(s => s.id === id)?.name ?? id;
  const line = waitingLine(flowGame, own?.selfSeatId ?? null, lang, flags, seatName, state.slowSeatIds);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = root.current; if (!el) return; const onKey = (event: KeyboardEvent) => { if ((event.target as HTMLElement)?.closest?.("input, select, textarea, button, a, [role=dialog]")) return; controller.keyboard(event); }; el.addEventListener("keydown", onKey); return () => el.removeEventListener("keydown", onKey); }, [controller]);
  const inGame = !!game;
  const omniscient = !!omniscientGame(view);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const newGameDialog = useRef<HTMLDivElement>(null), newGameTrigger = useRef<HTMLButtonElement>(null);
  const cancelNewGame = () => { setNewGameOpen(false); newGameTrigger.current?.focus(); };
  const requestNewGame = () => { if (view?.game && view.game.phase !== "ended") setNewGameOpen(true); else controller.send({ type: "newGame" }); };
  useEffect(() => { if (newGameOpen) newGameDialog.current?.querySelector<HTMLButtonElement>("[data-testid=new-game-cancel]")?.focus(); }, [newGameOpen]);
  useEffect(() => { setNewGameOpen(false); }, [view?.game?.id]);
  return <div ref={root} className={`tda-shell${state.busy ? " is-busy" : ""}${state.pending ? " is-pending" : ""}`} data-phase={game?.phase ?? "lobby"} data-busy={state.busy} data-pending-action={state.pending ? "true" : "false"} data-omniscient={String(omniscient)} data-mode={state.mode} data-renderer="dom25" tabIndex={-1}>
    {showTopBar ? <header className="tda-topbar">
      <div className="tda-topbar-title">{t("siteTitle", lang)}</div>
      <div className="tda-topbar-tools">
        <button type="button" className="tda-btn tda-btn--quiet" data-testid="table-help" onClick={() => store.set(s => ({ helpOpen: !s.helpOpen }))} aria-pressed={state.helpOpen}>{t("help", lang)}</button>
        <button type="button" className="tda-btn tda-btn--quiet" data-testid="table-sound" onClick={() => controller.toggleSound()} aria-pressed={state.soundOn}>{t(state.soundOn ? "soundOn" : "soundOff", lang)}</button>
        <button type="button" className="tda-btn tda-btn--quiet" data-testid="table-language" onClick={() => controller.setLanguage(lang === "zh" ? "en" : "zh")}>{lang === "zh" ? "English" : "中文"}</button>
        {state.hostKind === "obr" && inGame && (view?.isHost || view?.role === "GM") ? <button type="button" id="omniscient-toggle" className={`tda-btn tda-btn--quiet${omniscient ? " is-on" : ""}`} aria-pressed={omniscient} onClick={() => controller.send({ type: "omniscient", enabled: !omniscient })}>{t(omniscient ? "omniscientOn" : "omniscientOff", lang)}</button> : null}
        {view?.isHost ? <button ref={newGameTrigger} type="button" className="tda-btn tda-btn--quiet" data-testid="table-new-game" onClick={requestNewGame} disabled={!view.game || view.table?.stage === "lobby" || state.sending || !!view.pending || !!state.pending}>{t("newGame", lang)}</button> : null}
        {state.hostKind === "obr" ? <button type="button" id="display-mode" className="tda-btn tda-btn--quiet" onClick={() => controller.send({ type: "display", mode: state.mode === "compact" ? "full" : "compact" })}>{t(state.mode === "compact" ? "expand" : "minimize", lang)}</button> : null}
        {state.hostKind === "obr" ? <button type="button" id="close" className="tda-btn tda-btn--quiet" onClick={() => controller.send({ type: "close" })}>{t("backToMap", lang)}</button> : null}
      </div>
    </header> : <div />}
    <div className="tda-status">
      <FlowRail game={flowGame} lang={lang} flags={flags} />
      <WaitingLine line={line} game={flowGame} selfSeatId={own?.selfSeatId ?? null} />
    </div>
    <TableScene state={state} controller={controller} onFx={onFx} onFx3d={onFx3d} onOrientation={onOrientation} onLand={onLand} />
    <ActionBar state={state} controller={controller} />
    {state.helpOpen ? <aside className="tda-help tda-parchment" role="dialog" aria-label={t("help", lang)} data-testid="table-help-panel">
      <h3>{t("helpFlow", lang)}</h3><p>{t("helpFlowText", lang)}</p>
      <h3>{t("helpPower", lang)}</h3><p>{t("helpPowerText", lang)}</p>
      <h3>{t("helpKeys", lang)}</h3><p>{t("keyboardHint", lang)}</p>
      <button type="button" className="tda-btn tda-btn--quiet tda-help-close" data-testid="table-help-close" onClick={() => store.set({ helpOpen: false })} aria-label={t("close", lang)}>×</button>
    </aside> : null}
    <ChoicePanel state={state} controller={controller} />
    <CardInspector state={state} controller={controller} />
    <PhaseBanner state={state} />
    <ScoreBoard state={state} />
    <PowerSpotlight state={state} controller={controller} />
    <FormationSpotlight state={state} controller={controller} />
    <EndPanel state={state} controller={controller} />
    <Editor state={state} controller={controller} />
    <Lobby state={state} controller={controller} />
    {newGameOpen ? <div className="tda-confirm-overlay"><div ref={newGameDialog} className="tda-parchment tda-confirm" role="dialog" aria-modal="true" aria-labelledby="tda-new-game-title" aria-describedby="tda-new-game-description" data-testid="new-game-confirmation" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); cancelNewGame(); }
      if (event.key === "Tab") { event.preventDefault(); const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus(); }
    }}>
      <h2 id="tda-new-game-title">{lang === "zh" ? "新开一局？" : "Start a new game?"}</h2>
      <p id="tda-new-game-description">{lang === "zh" ? "当前对局将结束，所有玩家返回准备大厅。" : "The current game will end and all players will return to the lobby."}</p>
      <div className="tda-end-actions">
        <button type="button" className="tda-btn" data-testid="new-game-cancel" onClick={cancelNewGame}>{lang === "zh" ? "继续对局" : "Keep playing"}</button>
        <button type="button" className="tda-btn tda-btn--primary" data-testid="new-game-confirm" onClick={() => { setNewGameOpen(false); controller.send({ type: "newGame" }); }}>{lang === "zh" ? "确认重开" : "New game"}</button>
      </div>
    </div></div> : null}
  </div>;
}
