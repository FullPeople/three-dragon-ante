/** 独立网站壳：首页 → 本地对战 / 怎么玩。 */
import { useEffect, useRef, useState } from "react";
import { getLocalLang, setLocalLang, type Language } from "../locale";
import { createLocalMatch, type LocalMatchHandle } from "../presentation/local/LocalMatch";
import { t } from "../presentation/i18n";
import { RULES } from "./rules";

type Screen = "home" | "play" | "howto";

export function SiteApp() {
  const [lang, setLang] = useState<Language>(() => getLocalLang());
  const [screen, setScreen] = useState<Screen>("home");
  const [opponents, setOpponents] = useState(2);
  const changeLang = (value: Language) => { setLocalLang(value); setLang(value); };
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; document.title = t("siteTitle", lang); }, [lang]);
  if (screen === "play") return <MatchScreen lang={lang} opponents={opponents} onClose={() => setScreen("home")} onLanguage={setLang} />;
  if (screen === "howto") return <HowTo lang={lang} onBack={() => setScreen("home")} />;
  return <main className="site-home">
    <section className="site-hero tda-parchment">
      <p className="site-eyebrow">{t("siteSubtitle", lang)}</p>
      <h1 className="site-title">{t("siteTitle", lang)}</h1>
      <hr className="site-rule" />
      <div className="site-controls">
        <label className="site-field"><span>{t("opponents", lang)}</span>
          <div className="site-segment" role="radiogroup" aria-label={t("opponents", lang)}>{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={opponents === n} className={opponents === n ? "is-on" : ""} onClick={() => setOpponents(n)}>{n}</button>)}</div>
          <small>{t("playersCount", lang, { n: opponents + 1 })}</small>
        </label>
        <label className="site-field"><span>{t("language", lang)}</span>
          <div className="site-segment"><button type="button" className={lang === "zh" ? "is-on" : ""} onClick={() => changeLang("zh")}>中文</button><button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => changeLang("en")}>English</button></div>
        </label>
      </div>
      <div className="site-actions">
        <button type="button" className="tda-btn tda-btn--primary site-start" onClick={() => setScreen("play")}>{t("startGame", lang)}</button>
        <button type="button" className="tda-btn" onClick={() => setScreen("howto")}>{t("howToPlay", lang)}</button>
      </div>
    </section>
    <footer className="site-foot"><span>Three-Dragon Ante · Legendary Edition</span><span>GPL-3.0 · 卡面 ©2021 Wizards · 材质 / 音效 CC0</span></footer>
  </main>;
}

function MatchScreen({ lang, opponents, onClose, onLanguage }: { lang: Language; opponents: number; onClose(): void; onLanguage(value: Language): void }) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<LocalMatchHandle | null>(null);
  useEffect(() => {
    if (!host.current) return;
    // 测试钩子：模拟慢回执，只在本机地址生效
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    const params = new URLSearchParams(location.search);
    const receiptDelayMs = localHost ? Number(params.get("receiptDelay")) || undefined : undefined;
    // 测试夹具：固定随机种子（只在本地主机生效），便于复现同一副牌
    const seed = localHost ? Number(params.get("seed")) || undefined : undefined;
    handle.current = createLocalMatch(host.current, { language: lang, opponents, receiptDelayMs, seed, onClose, onLanguage: value => { setLocalLang(value); onLanguage(value); } });
    return () => { handle.current?.destroy(); handle.current = null; };
  }, []);
  useEffect(() => { handle.current?.setLanguage(lang); }, [lang]);
  return <div ref={host} className="site-match" />;
}

function HowTo({ lang, onBack }: { lang: Language; onBack(): void }) {
  const rules = RULES[lang];
  return <main className="site-howto">
    <div className="site-howto-head"><button type="button" className="tda-btn tda-btn--quiet" onClick={onBack}>← {t("back", lang)}</button><h1>{t("rulesTitle", lang)}</h1></div>
    <div className="tda-parchment site-howto-body">
      {rules.map(section => <section key={section.title}><h2>{section.title}</h2>{section.body.map((p, i) => <p key={i}>{p}</p>)}</section>)}
    </div>
  </main>;
}
