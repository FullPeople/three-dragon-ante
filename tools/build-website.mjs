import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir',
  resolve(process.env.TDA_WEBSITE_OUT || join(root, 'dist-website'))], {
  cwd: root, stdio: 'inherit', env: { ...process.env, THREE_DRAGON_CHANNEL: 'website', VITE_TDA_API: '/three-dragon-api/v1' },
});
