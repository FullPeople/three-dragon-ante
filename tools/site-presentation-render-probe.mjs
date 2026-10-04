// Passed directly to Playwright addInitScript. It never imports or calls product effects.
// Buffers stay in browser RAM; evidence contains only bounded counts and booleans.
export function installPresentationRenderProbe({ countThreeDraws }) {
  const cells = {}, contexts = new Map(), buffers = new WeakMap();
  const blank = () => ({ draws: 0, points: 0, samples: 0, pointSamples: 0, alphaPixels: 0, changedAlphaPixels: 0, pointChangedAlphaPixels: 0, readbackErrors: 0, rendererKnown: false, software: false });
  const layerOf = canvas => canvas?.classList.contains('tda-fx3d-air') ? 'air' : canvas?.classList.contains('tda-fx3d-ground') ? 'ground' : null;
  const active = () => window.__presentationProbe?.active && window.__presentationProbe.effectCapture && !document.querySelector('.tda-spotlight') && !document.querySelector('.tda-banner--turn');
  const snapshot = gl => {
    const length = gl.drawingBufferWidth * gl.drawingBufferHeight * 4;
    let pair = buffers.get(gl);
    if (!pair || pair[0].length !== length) { pair = [new Uint8Array(length), new Uint8Array(length)]; buffers.set(gl, pair); }
    return pair;
  };
  for (const proto of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
    if (!proto) continue;
    for (const key of ['drawArrays', 'drawElements']) {
      const native = proto[key];
      if (typeof native !== 'function') continue;
      proto[key] = function(...args) {
        const layer = layerOf(this.canvas), count = key === 'drawArrays' ? args[2] : args[1];
        if (!layer || !active() || !(count > 0) || this.isContextLost()) return Reflect.apply(native, this, args);
        const cell = cells[layer] ??= blank(), points = args[0] === this.POINTS;
        contexts.set(layer, this); cell.draws++; if (points) cell.points++;
        if (countThreeDraws) window.__presentationProbe.fxDraws++;
        if (!cell.rendererKnown) {
          const info = this.getExtension('WEBGL_debug_renderer_info');
          cell.rendererKnown = !!info;
          if (info) cell.software = /swiftshader|llvmpipe|software/i.test(String(this.getParameter(info.UNMASKED_RENDERER_WEBGL)));
        }
        // A separate POINTS budget prevents early meshes from consuming particle samples.
        const sampled = points ? cell.pointSamples < 12 : cell.samples < 12;
        let pair;
        if (sampled) try {
          pair = snapshot(this);
          this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, pair[0]);
        } catch { cell.readbackErrors++; }
        const result = Reflect.apply(native, this, args);
        if (sampled && pair) try {
          this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, pair[1]);
          let alpha = 0, changed = 0;
          for (let i = 0; i < pair[1].length; i += 4) if (pair[1][i + 3]) {
            alpha++;
            if (pair[0][i] !== pair[1][i] || pair[0][i + 1] !== pair[1][i + 1] || pair[0][i + 2] !== pair[1][i + 2] || pair[0][i + 3] !== pair[1][i + 3]) changed++;
          }
          if (points) cell.pointSamples++; else cell.samples++;
          cell.alphaPixels = Math.max(cell.alphaPixels, alpha);
          cell.changedAlphaPixels = Math.max(cell.changedAlphaPixels, changed);
          if (points) cell.pointChangedAlphaPixels = Math.max(cell.pointChangedAlphaPixels, changed);
        } catch { cell.readbackErrors++; }
        return result;
      };
    }
  }
  window.__presentationRenderProbe = {
    reset() { for (const layer of Object.keys(cells)) delete cells[layer]; contexts.clear(); },
    capture() {
      const layer = name => ({ ...(cells[name] ?? blank()), contextAvailable: !!contexts.get(name) && !contexts.get(name).isContextLost() });
      return { air: layer('air'), ground: layer('ground'), threeMode: /^three-(low|medium|high)$/.test(document.querySelector('.tda-shell')?.dataset.fx ?? '') };
    },
  };
}
