import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const file = resolve(root, 'dist-server/server.mjs');
if (!existsSync(file)) throw Error('Run npm run build:server first.');
mkdirSync(resolve(root, '.local-data'), { recursive: true });
const child = spawn(process.execPath, [file], { stdio: 'inherit', env: {
  ...process.env,
  TDA_DATABASE: process.env.TDA_DATABASE || resolve(root, '.local-data/game.sqlite'),
  TDA_ORIGIN: process.env.TDA_ORIGIN || 'http://127.0.0.1:5173',
} });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code || 0; });
