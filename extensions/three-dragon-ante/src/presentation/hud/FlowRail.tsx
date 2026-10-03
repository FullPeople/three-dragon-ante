import { flowSteps, type PresentationFlags } from "../model/flow";
import type { PublicView } from "../../game/rules/types";
import { t, type Lang } from "../i18n";

export function FlowRail({ game, lang, flags }: { game: PublicView | null; lang: Lang; flags: PresentationFlags }) {
  if (!game) return null;
  const steps = flowSteps(game, lang, flags);
  return <nav className="tda-flow" aria-label={t("gambit", lang)}>
    <span className="tda-flow-gambit"><span className="tda-flow-gambit-label">{t("gambit", lang)}</span><span className="tda-num">{game.gambit}</span></span>
    <ol className="tda-flow-steps">
      {steps.map(step => <li key={step.id} className={`tda-flow-step is-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
        <span className="tda-flow-dot">{step.state === "done" ? "✓" : ""}</span>
        <span className="tda-flow-label">{step.label}</span>
        {step.sub ? <span className="tda-flow-sub">{step.sub}</span> : null}
      </li>)}
    </ol>
  </nav>;
}
