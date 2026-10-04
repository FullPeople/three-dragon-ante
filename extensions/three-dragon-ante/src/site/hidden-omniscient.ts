/** A local shortcut only; the server still checks the authenticated current host. */
export function bindHiddenOmniscient(target: Window, active: () => boolean, toggle: () => void): () => void {
  const sequence = "fuvtt";
  let typed = "", lastKeyAt = 0;
  const reset = () => { typed = ""; lastKeyAt = 0; };
  const onKey = (event: KeyboardEvent) => {
    const element = event.target instanceof Element ? event.target : null;
    if (!active() || event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        element?.closest("input, textarea, select, button, a, [contenteditable]:not([contenteditable=false]), [role=dialog], [role=menu]")) { reset(); return; }
    const now = performance.now();
    if (now - lastKeyAt > 5000) reset();
    if (event.key === "Enter") {
      const complete = typed === sequence; reset();
      if (complete) { event.preventDefault(); event.stopImmediatePropagation(); toggle(); }
      return;
    }
    if (event.key.length !== 1) { reset(); return; }
    typed = event.key === sequence[typed.length] ? typed + event.key : event.key === sequence[0] ? event.key : "";
    lastKeyAt = now;
  };
  target.addEventListener("keydown", onKey, true);
  target.addEventListener("blur", reset);
  return () => { target.removeEventListener("keydown", onKey, true); target.removeEventListener("blur", reset); reset(); };
}
