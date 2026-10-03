import { mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import upstream from './extensions/three-dragon-ante/vite.config';

// Retain the published extension base, entries, chunks and manifest. The root
// wrapper only makes development configuration independent of Full Suite.
export default mergeConfig(upstream, {
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  server: { proxy: { '/three-dragon-api': { target: 'http://127.0.0.1:5013', ws: true } } },
});
