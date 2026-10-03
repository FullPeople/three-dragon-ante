import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const server = process.argv.includes('--server');
const scripts = server ? [
  'tools/three-dragon-server-selftest.mjs',
  'tools/three-dragon-auto-host208.mjs',
] : [
  'extensions/three-dragon-ante/src/game/privacy-selftest.mjs',
  'extensions/three-dragon-ante/src/presentation/presentation-selftest.mjs',
  'tools/three-dragon-controller-selftest.mjs',
  'tools/three-dragon-handover-selftest.mjs',
  'tools/three-dragon-legacy-recovery-selftest.mjs',
  'tools/three-dragon-stable-recovery-selftest.mjs',
  'tools/three-dragon-local-connection-selftest.mjs',
  'tools/three-dragon-time-dragon-selftest.mjs',
];
const output = join(root, '.local-evidence', server ? 'server' : 'regression');
mkdirSync(output, { recursive: true });
const results = [];
for (const script of scripts) {
  const run = spawnSync(process.execPath, ['--experimental-strip-types', resolve(root, script)], {
    cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, TDA_SERVER_OUT: resolve(root, 'dist-server'), TDA_EVIDENCE_ROOT: output },
  });
  const log = (run.stdout || '') + (run.stderr || '') + (run.error ? '\n' + run.error : '');
  writeFileSync(join(output, script.split('/').pop() + '.log'), log);
  results.push({ script, passed: run.status === 0, exitCode: run.status });
  console.log(`${run.status === 0 ? 'PASS' : 'FAIL'} ${script}`);
  if (run.status !== 0) console.error(log);
}
writeFileSync(join(output, 'results.json'), JSON.stringify({ realOwlbearRoom: false, results }, null, 2) + '\n');
if (results.some(result => !result.passed)) process.exitCode = 1;
