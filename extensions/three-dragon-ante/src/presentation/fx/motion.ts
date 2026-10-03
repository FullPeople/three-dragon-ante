/** 有限时长动画助手。减少动态偏好下直接完成，但顺序与等待不变。 */
export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function wait(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }

export function animate(el: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
  if (!el || reducedMotion()) return Promise.resolve();
  try {
    const animation = el.animate(keyframes, options);
    return animation.finished.then(() => {}, () => {});
  } catch { return Promise.resolve(); }
}

/** 等待某个元素的 transform 过渡结束（有上限，避免挂死）。 */
export function afterTransition(el: Element | null, limitMs = 700): Promise<void> {
  if (!el || reducedMotion()) return Promise.resolve();
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; el.removeEventListener("transitionend", finish); resolve(); };
    el.addEventListener("transitionend", finish);
    setTimeout(finish, limitMs);
  });
}
