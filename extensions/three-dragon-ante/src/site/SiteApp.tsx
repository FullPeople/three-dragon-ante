/** 独立网站壳：首页 → 本地对战 / 在线房间 / 怎么玩。 */
import { useEffect, useRef, useState } from "react";
import { getLocalLang, setLocalLang, type Language } from "../locale";
import { createLocalMatch, type LocalMatchHandle } from "../presentation/local/LocalMatch";
import { t } from "../presentation/i18n";
import { RULES } from "./rules";
import { createOnlineMatch, type OnlineMatchHandle } from "./OnlineMatch";
import { clearActiveGuestSession, createGuestRoom, guestError, inviteCode, inviteURL, joinGuestRoom, lastGuestName, readActiveGuestSession, type GuestAdmission } from "./online-session";

type Screen = "home" | "play" | "online" | "howto";

export function SiteApp() {
  const [lang, setLang] = useState<Language>(() => getLocalLang());
  const [online, setOnline] = useState<GuestAdmission | null>(() => readActiveGuestSession());
  const [screen, setScreen] = useState<Screen>(() => readActiveGuestSession() ? "online" : "home");
  const [opponents, setOpponents] = useState(2);
  const [name, setName] = useState(() => lastGuestName());
  const [code, setCode] = useState(() => inviteCode());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changeLang = (value: Language) => { setLocalLang(value); setLang(value); };
  async function enterRoom(mode: "create" | "join" | "reconnect") {
    if (busy) return;
    if (!name.trim()) { setError("invalidName"); return; }
    setBusy(true); setError("");
    try {
      const admitted = mode === "create" ? await createGuestRoom(name) : await joinGuestRoom(code, name, mode === "reconnect");
      setOnline(admitted); setName(admitted.name); setCode(admitted.room.code); setScreen("online");
    } catch (value) { setError(value instanceof Error ? value.message : "requestFailed"); }
    finally { setBusy(false); }
  }
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; document.title = t("siteTitle", lang); }, [lang]);
  if (screen === "play") return <MatchScreen lang={lang} opponents={opponents} onClose={() => setScreen("home")} onLanguage={setLang} />;
  if (screen === "online" && online) return <OnlineScreen key={online.session.token} lang={lang} admission={online} onClose={() => { clearActiveGuestSession(); setOnline(null); setScreen("home"); }} onLanguage={changeLang} />;
  if (screen === "howto") return <HowTo lang={lang} onBack={() => setScreen("home")} />;
  return <main className="site-home">
    <section className="site-hero tda-parchment">
      <p className="site-eyebrow">{t("siteSubtitle", lang)}</p>
      <h1 className="site-title">{t("siteTitle", lang)}</h1>
      <hr className="site-rule" />
      <form className="site-online-form" onSubmit={event => { event.preventDefault(); void enterRoom("join"); }}>
        <h2>{lang === "zh" ? "在线房间" : "Online room"}</h2>
        <div className="site-room-fields">
          <label className="site-field"><span>{lang === "zh" ? "名字" : "Name"}</span><input id="guest-name" name="name" autoComplete="nickname" maxLength={60} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
          <label className="site-field"><span>{lang === "zh" ? "房间码" : "Room code"}</span><input id="guest-room-code" name="room" autoComplete="off" autoCapitalize="characters" maxLength={8} value={code} disabled={busy} onChange={event => setCode(event.target.value.toUpperCase())} /></label>
        </div>
        <p className="site-room-note">{lang === "zh" ? "房间内名字唯一；离线座位可重连" : "Unique names per room; offline seats can reconnect"}</p>
        <div className="site-actions">
          <button type="button" className="tda-btn tda-btn--primary" disabled={busy} onClick={() => void enterRoom("create")}>{lang === "zh" ? "创建房间" : "Create room"}</button>
          <button type="submit" className="tda-btn" disabled={busy || !code.trim()}>{lang === "zh" ? "加入房间" : "Join room"}</button>
          <button type="button" className="tda-btn" disabled={busy || !code.trim()} onClick={() => void enterRoom("reconnect")}>{lang === "zh" ? "重连房间" : "Reconnect"}</button>
        </div>
        {busy ? <p className="site-room-note" role="status">{lang === "zh" ? "连接中" : "Connecting"}</p> : null}
        {error ? <p className="site-room-error" role="alert">{guestError(error, lang)}</p> : null}
      </form>
      <h2 className="site-local-heading">{lang === "zh" ? "本地对战" : "Local match"}</h2>
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

function OnlineScreen({ lang, admission, onClose, onLanguage }: { lang: Language; admission: GuestAdmission; onClose(): void; onLanguage(value: Language): void }) {
  const host = useRef<HTMLDivElement>(null), handle = useRef<OnlineMatchHandle | null>(null), link = useRef<HTMLInputElement>(null);
  const [connected, setConnected] = useState(false), [message, setMessage] = useState(""), [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    handle.current = createOnlineMatch(host.current, { admission, language: lang, onClose, onLanguage, onStatus: (value, status) => { setConnected(value); setMessage(status || ""); } });
    return () => { handle.current?.destroy(); handle.current = null; };
  }, []);
  useEffect(() => { handle.current?.setLanguage(lang); }, [lang]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteURL(admission.room.code)); setCopied(true); }
    catch { link.current?.focus(); link.current?.select(); }
  };
  return <main className="site-online-match" data-connected={connected}>
    <header className="site-room-bar">
      <div className="site-room-identity"><span>{lang === "zh" ? "房间" : "Room"} <strong data-testid="online-room-code">{admission.room.code}</strong></span><span>{admission.name}</span><span role="status">{connected ? (lang === "zh" ? "已连接" : "Connected") : message === "sessionReplaced" ? (lang === "zh" ? "座位已在其他窗口连接" : "Seat connected in another window") : message === "notAllowed" ? (lang === "zh" ? "连接已失效，请返回首页重连" : "Session expired; return home to reconnect") : message === "requestFailed" ? (lang === "zh" ? "连接失败" : "Connection failed") : (lang === "zh" ? "重连中" : "Reconnecting")}</span></div>
      <div className="site-room-tools">
        <input ref={link} readOnly aria-label={lang === "zh" ? "邀请链接" : "Invite link"} value={inviteURL(admission.room.code)} />
        <button type="button" className="tda-btn tda-btn--quiet" onClick={() => void copy()}>{copied ? (lang === "zh" ? "已复制" : "Copied") : (lang === "zh" ? "复制邀请" : "Copy invite")}</button>
        {!connected && !["sessionReplaced", "notAllowed"].includes(message) ? <button type="button" className="tda-btn tda-btn--quiet" onClick={() => handle.current?.retry()}>{lang === "zh" ? "重试连接" : "Retry connection"}</button> : null}
        <button type="button" className="tda-btn tda-btn--quiet" onClick={onClose}>{lang === "zh" ? "返回首页" : "Home"}</button>
      </div>
    </header>
    <div ref={host} className="site-online-host" />
  </main>;
}

function MatchScreen({ lang, opponents, onClose, onLanguage }: { lang: Language; opponents: number; onClose(): void; onLanguage(value: Language): void }) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<LocalMatchHandle | null>(null);
  useEffect(() => {
    if (!host.current) return;
    // 测试钩子：模拟慢回执，只在本机地址生效
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    const receiptDelayMs = localHost ? Number(new URLSearchParams(location.search).get("receiptDelay")) || undefined : undefined;
    handle.current = createLocalMatch(host.current, { language: lang, opponents, receiptDelayMs, onClose, onLanguage: value => { setLocalLang(value); onLanguage(value); } });
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
