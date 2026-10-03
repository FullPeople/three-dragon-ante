/** 音效播放器。真实录音（Kenney Casino Audio，CC0，登记见 docs/design/ASSETS.md），不合成。
 * 同一事件键只响一次；未解锁（无用户交互）时静默。 */
export interface AudioPlayer { play(kind: string, key: string): boolean; suspend(): void; resume(): void; destroy(): void }

const snd = (name: string) => new URL(`../assets/audio/${name}.ogg`, import.meta.url).href;
const FILES: Record<string, string> = {
  draw: snd("draw"), play: snd("play"), flip: snd("flip"), shuffle: snd("shuffle"), coin: snd("coin"), gain: snd("gain"), pay: snd("pay"), slap: snd("knock"), turn: snd("turn"), round: snd("round"),
  gameover: snd("shuffle"), victory: snd("gain"), verdict: snd("knock"), phase: snd("turn"),
  "power-ember": snd("round"), "power-tide": snd("round"), "power-grove": snd("round"), "power-arcane": snd("round"), "power-crown": snd("round"), "power-impact": snd("gain"),
  thud: snd("play"), spotlight: snd("turn"), sigil: snd("round"), grab: snd("draw"), swap: snd("flip"), slash: snd("knock"), tally: snd("turn"), mark: snd("gain"),
};
const GAIN: Record<string, number> = { coin: .7, gain: .7, pay: .6, draw: .6, play: .8, flip: .8, slap: .9, turn: .45, round: .55, shuffle: .6, thud: .9, spotlight: .4, sigil: .5, grab: .5, swap: .6, slash: .7, tally: .4, mark: .6 };

export function createAudio(host: HTMLElement, enabled: () => boolean): AudioPlayer {
  const recent = new Set<string>();
  let suspended = false, destroyed = false, unlocked = false;
  const cache = new Map<string, HTMLAudioElement>();
  const unlock = () => { unlocked = true; };
  for (const type of ["pointerdown", "keydown"]) host.addEventListener(type, unlock, { capture: true, passive: true });
  return {
    play(kind, key) {
      if (destroyed || suspended || !enabled() || !unlocked || !key) return false;
      const dedupe = `${kind}:${key}`; if (recent.has(dedupe)) return false;
      recent.add(dedupe); if (recent.size > 256) recent.delete(recent.values().next().value!);
      const file = FILES[kind]; if (!file) return false;
      let base = cache.get(file); if (!base) { base = new Audio(file); base.preload = "auto"; cache.set(file, base); }
      try { const voice = base.cloneNode(true) as HTMLAudioElement; voice.volume = GAIN[kind] ?? .6; void voice.play().catch(() => {}); return true; } catch { return false; }
    },
    suspend() { suspended = true; },
    resume() { suspended = false; },
    destroy() { destroyed = true; for (const type of ["pointerdown", "keydown"]) host.removeEventListener(type, unlock, { capture: true }); cache.clear(); },
  };
}
