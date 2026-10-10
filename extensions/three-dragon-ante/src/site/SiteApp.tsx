/** 独立网站壳：首页 → 权威服务在线房间 / 怎么玩。 */
import { useEffect, useRef, useState } from "react";
import { getLocalLang, setLocalLang, type Language } from "../locale";
import { t } from "../presentation/i18n";
import { RULES } from "./rules";
import { createOnlineMatch, type OnlineMatchHandle } from "./OnlineMatch";
import { clearActiveGuestSession, createGuestRoom, guestError, inviteCode, inviteURL, joinGuestRoom, lastGuestName, randomGuestName, readActiveGuestSession, type GuestAdmission } from "./online-session";

type Screen = "home" | "online" | "howto";

export function SiteApp() {
  const [lang, setLang] = useState<Language>(() => getLocalLang());
  const [online, setOnline] = useState<GuestAdmission | null>(() => readActiveGuestSession());
  const [screen, setScreen] = useState<Screen>(() => readActiveGuestSession() ? "online" : "home");
  const [name, setName] = useState(() => lastGuestName() || randomGuestName(getLocalLang()));
  const [editingName, setEditingName] = useState(false);
  const [code, setCode] = useState(() => inviteCode());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changeLang = (value: Language) => { setLocalLang(value); setLang(value); };
  async function enterRoom(mode: "create" | "join" | "reconnect" | "watch") {
    if (busy) return;
    if (!name.trim()) { setError("invalidName"); return; }
    setBusy(true); setError("");
    try {
      const admitted = mode === "create" ? await createGuestRoom(name) : await joinGuestRoom(code, name, mode === "reconnect", mode === "watch" ? true : mode === "join" ? false : undefined);
      setOnline(admitted); setName(admitted.name); setCode(admitted.room.code); setScreen("online");
    } catch (value) { setError(value instanceof Error ? value.message : "requestFailed"); }
    finally { setBusy(false); }
  }
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; document.title = t("siteTitle", lang); }, [lang]);
  if (screen === "online" && online) return <OnlineScreen key={online.session.token} lang={lang} admission={online} onClose={() => { clearActiveGuestSession(); setOnline(null); setScreen("home"); }} onLanguage={changeLang} />;
  if (screen === "howto") return <HowTo lang={lang} onBack={() => setScreen("home")} />;
  return <main className="site-home">
    <section className="site-hero tda-parchment">
      <p className="site-eyebrow">{t("siteSubtitle", lang)}</p>
      <h1 className="site-title">{t("siteTitle", lang)}</h1>
      <hr className="site-rule" />
      <form className="site-online-form" autoComplete="off" onSubmit={event => { event.preventDefault(); void enterRoom("join"); }}>
        <h2>{lang === "zh" ? "在线房间" : "Online room"}</h2>
        <div className="site-room-fields">
          <div className="site-field"><label htmlFor="guest-name">{lang === "zh" ? "名字" : "Name"}</label><div className="site-name-tools">
            <input id="guest-name" name="table-alias" autoComplete="off" autoCorrect="off" spellCheck={false} readOnly={!editingName} maxLength={60} value={name} disabled={busy} onFocus={() => setEditingName(true)} onBlur={() => setEditingName(false)} onChange={event => setName(event.target.value)} data-lpignore="true" data-1p-ignore="true" />
            <button type="button" className="tda-btn" data-testid="random-name" disabled={busy} onClick={() => { setName(randomGuestName(lang, name)); setError(""); }}>{lang === "zh" ? "随机" : "Random"}</button>
          </div></div>
          <label className="site-field"><span>{lang === "zh" ? "房间码" : "Room code"}</span><input id="guest-room-code" name="room" autoComplete="off" autoCapitalize="characters" maxLength={8} value={code} disabled={busy} onChange={event => setCode(event.target.value.toUpperCase())} /></label>
        </div>
        <p className="site-room-note">{lang === "zh" ? "房间内名字唯一；离线座位可重连。无人房间 1 分钟后解散。" : "Unique names per room; offline seats can reconnect. Empty rooms close after 1 minute."}</p>
        <div className="site-actions">
          <button type="button" className="tda-btn tda-btn--primary" disabled={busy} onClick={() => void enterRoom("create")}>{lang === "zh" ? "创建房间" : "Create room"}</button>
          <button type="submit" className="tda-btn" disabled={busy || !code.trim()}>{lang === "zh" ? "加入房间" : "Join room"}</button>
          <button type="button" className="tda-btn" data-testid="watch-room" disabled={busy || !code.trim()} onClick={() => void enterRoom("watch")}>{lang === "zh" ? "观战" : "Watch"}</button>
          <button type="button" className="tda-btn" disabled={busy || !code.trim()} onClick={() => void enterRoom("reconnect")}>{lang === "zh" ? "重连房间" : "Reconnect"}</button>
        </div>
        {busy ? <p className="site-room-note" role="status">{lang === "zh" ? "连接中" : "Connecting"}</p> : null}
        {error ? <p className="site-room-error" role="alert">{guestError(error, lang)}</p> : null}
      </form>
      <div className="site-controls">
        <div className="site-field"><span>{t("language", lang)}</span>
          <div className="site-segment"><button type="button" className={lang === "zh" ? "is-on" : ""} onClick={() => changeLang("zh")}>中文</button><button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => changeLang("en")}>English</button></div>
        </div>
      </div>
      <div className="site-actions"><button type="button" className="tda-btn" data-testid="site-help" onClick={() => setScreen("howto")}>{t("howToPlay", lang)}</button></div>
    </section>
    <footer className="site-foot"><span>Three-Dragon Ante · Legendary Edition</span><span>GPL-3.0 · 卡面 ©2021 Wizards · 材质 / 音效 CC0</span></footer>
  </main>;
}

function OnlineScreen({ lang, admission, onClose, onLanguage }: { lang: Language; admission: GuestAdmission; onClose(): void; onLanguage(value: Language): void }) {
  const host = useRef<HTMLDivElement>(null), handle = useRef<OnlineMatchHandle | null>(null), link = useRef<HTMLInputElement>(null);
  const playing = useRef(false), leaveTrigger = useRef<HTMLElement | null>(null), leaveDialog = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false), [message, setMessage] = useState(""), [copied, setCopied] = useState(false), [leaveOpen, setLeaveOpen] = useState(false);
  const [spectating, setSpectating] = useState(admission.spectating === true);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [manualInvite, setManualInvite] = useState("");
  const requestClose = () => {
    if (!playing.current) { onClose(); return; }
    leaveTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLeaveOpen(true);
  };
  const cancelLeave = () => { setLeaveOpen(false); };
  useEffect(() => {
    if (!host.current) return;
    handle.current = createOnlineMatch(host.current, { admission, language: lang, onClose: requestClose, onLanguage, onStatus: (value, status, inProgress, watching, count) => { playing.current = inProgress; setSpectating(watching); setPlayerCount(value ? count : null); setConnected(value); setMessage(status || ""); } });
    return () => { handle.current?.destroy(); handle.current = null; };
  }, []);
  useEffect(() => { handle.current?.setLanguage(lang); }, [lang]);
  useEffect(() => { if (leaveOpen) leaveDialog.current?.querySelector<HTMLButtonElement>("[data-testid=leave-cancel]")?.focus(); else leaveTrigger.current?.focus(); }, [leaveOpen]);
  const copy = async () => {
    if (!connected || playerCount === null) return;
    const invitation = `${admission.name}邀请你来一把三龙牌！（${playerCount} 人）（${inviteURL(admission.room.code)}）`;
    setCopied(false);
    try { await navigator.clipboard.writeText(invitation); setManualInvite(""); setCopied(true); }
    catch {
      setManualInvite(invitation);
      requestAnimationFrame(() => { link.current?.focus(); link.current?.select(); });
    }
  };
  return <main className="site-online-match" data-connected={connected}>
    <header className="site-room-bar" inert={leaveOpen}>
      <div className="site-room-identity"><span>{lang === "zh" ? "房间" : "Room"} <strong data-testid="online-room-code">{admission.room.code}</strong></span><span>{admission.name}</span>{spectating ? <span data-testid="spectator-status">{lang === "zh" ? "观战" : "Watching"}</span> : null}<span role="status">{connected ? (lang === "zh" ? "已连接" : "Connected") : message === "sessionReplaced" ? (lang === "zh" ? "座位已在其他窗口连接" : "Seat connected in another window") : message === "notAllowed" ? (lang === "zh" ? "连接已失效，请返回首页重连" : "Session expired; return home to reconnect") : message === "requestFailed" ? (lang === "zh" ? "连接失败" : "Connection failed") : (lang === "zh" ? "重连中" : "Reconnecting")}</span></div>
      <div className="site-room-tools">
        <input ref={link} readOnly autoComplete="off" aria-label={lang === "zh" ? "邀请链接" : "Invite link"} value={manualInvite || inviteURL(admission.room.code)} />
        <button type="button" className="tda-btn tda-btn--quiet" disabled={!connected || playerCount === null} onClick={() => void copy()}>{copied ? (lang === "zh" ? "已复制" : "Copied") : (lang === "zh" ? "复制邀请" : "Copy invite")}</button>
        {!connected && !["sessionReplaced", "notAllowed"].includes(message) ? <button type="button" className="tda-btn tda-btn--quiet" onClick={() => handle.current?.retry()}>{lang === "zh" ? "重试连接" : "Retry connection"}</button> : null}
        <button type="button" className="tda-btn tda-btn--quiet" data-testid="leave-room" onClick={requestClose}>{lang === "zh" ? "返回首页" : "Home"}</button>
      </div>
    </header>
    <div ref={host} className="site-online-host" inert={leaveOpen} />
    {leaveOpen ? <div className="site-confirm-overlay"><div ref={leaveDialog} className="tda-parchment site-confirm" role="dialog" aria-modal="true" aria-labelledby="site-leave-title" aria-describedby="site-leave-description" data-testid="leave-confirmation" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); cancelLeave(); }
      if (event.key === "Tab") { event.preventDefault(); const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus(); }
    }}>
      <h2 id="site-leave-title">{lang === "zh" ? "退出对局？" : "Leave the game?"}</h2>
      <p id="site-leave-description">{spectating ? (lang === "zh" ? "退出观战？可用相同名字重连。" : "Leave watching? You can reconnect with the same name.") : lang === "zh" ? "对局仍在进行。退出后座位离线，可用相同名字重连；房间无人超过 1 分钟会解散。" : "The game is still in progress. Your seat can reconnect with the same name; the room closes after 1 minute with no one online."}</p>
      <div className="site-actions">
        <button type="button" className="tda-btn" data-testid="leave-cancel" onClick={cancelLeave}>{lang === "zh" ? "继续对局" : "Keep playing"}</button>
        <button type="button" className="tda-btn tda-btn--primary" data-testid="leave-confirm" onClick={onClose}>{lang === "zh" ? "确认退出" : "Leave game"}</button>
      </div>
    </div></div> : null}
  </main>;
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
