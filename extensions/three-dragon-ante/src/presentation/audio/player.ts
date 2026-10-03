/** 音效播放器。真实音效文件（CC0）到位前为静音占位：接口与键去重逻辑先定下来，
 * 之后只需在 `SOUND_FILES` 里登记文件。禁止合成音。 */
export interface AudioPlayer { play(kind: string, key: string): boolean; suspend(): void; resume(): void; destroy(): void }

/** kind → 打包后的文件 URL；为空表示该音效尚未提供。 */
const SOUND_FILES: Record<string, string | undefined> = {};

export function createAudio(host: HTMLElement, enabled: () => boolean): AudioPlayer {
  const recent = new Set<string>();
  let suspended = false, destroyed = false, unlocked = false;
  const buffers = new Map<string, HTMLAudioElement>();
  const unlock = () => { unlocked = true; };
  for (const type of ["pointerdown", "keydown"]) host.addEventListener(type, unlock, { capture: true, passive: true });
  return {
    play(kind, key) {
      if (destroyed || suspended || !enabled() || !unlocked || !key) return false;
      const dedupe = `${kind}:${key}`; if (recent.has(dedupe)) return false;
      recent.add(dedupe); if (recent.size > 256) recent.delete(recent.values().next().value!);
      const file = SOUND_FILES[kind]; if (!file) return false;
      let audio = buffers.get(kind); if (!audio) { audio = new Audio(file); audio.preload = "auto"; buffers.set(kind, audio); }
      try { const clone = audio.cloneNode(true) as HTMLAudioElement; clone.volume = .6; void clone.play().catch(() => {}); return true; } catch { return false; }
    },
    suspend() { suspended = true; },
    resume() { suspended = false; },
    destroy() { destroyed = true; for (const type of ["pointerdown", "keydown"]) host.removeEventListener(type, unlock, { capture: true }); buffers.clear(); },
  };
}
