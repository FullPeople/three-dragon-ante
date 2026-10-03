import assert from 'node:assert/strict';
import { build } from 'rolldown';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const evidence = resolve('.local-evidence/page-route');
mkdirSync(evidence, { recursive: true });
const run = mkdtempSync(join(evidence, 'run-'));
const file = join(run, 'route.mjs');
await build({ input: resolve('extensions/three-dragon-ante/src/game/page-route.ts'), platform: 'node', output: { file, format: 'esm', codeSplitting: false }, logLevel: 'warn' });
const { pageHost } = await import(pathToFileURL(file).href);
const stable = 'com.obr-suite/three-dragon-ante/table';
const pack = 'com.fullpeople/three-dragon-ante/pack-20260910/table';
const server = 'com.fullpeople/three-dragon-ante/server-v1';
const invite = { version: 1, id: 'a'.repeat(32), joinKey: 'b'.repeat(64) };
const cases = [
  ['independent empty room', '/three-dragon-ante/table.html', {}, 'server'],
  ['independent live pack without service invitation', '/three-dragon-ante/table.html', { [pack]: { stage: 'playing' } }, 'legacy'],
  ['independent pack lobby plus service invitation', '/three-dragon-ante/table.html', { [pack]: { stage: 'lobby' }, [server]: invite }, 'server'],
  ['independent live pack plus service invitation retains service precedence', '/three-dragon-ante-dev/table.html', { [pack]: { stage: 'playing' }, [server]: invite }, 'server'],
  ['independent extension ignores the Suite stable channel', '/three-dragon-ante/table.html', { [stable]: { stage: 'playing' }, [server]: invite }, 'server'],
  ['Suite direct stable game plus ended pack', '/suite/three-dragon-ante.html', { [stable]: { stage: 'playing' }, [pack]: { stage: 'ended' } }, 'stable-legacy'],
  ['Suite direct stable game plus newer service invitation', '/suite/three-dragon-ante.html', { [stable]: { stage: 'playing' }, [server]: invite }, 'stable-legacy'],
  ['Suite bridged stable lobby plus live pack and service invitation', '/suite-dev/workbench-panels/table.html', { [stable]: { stage: 'lobby' }, [pack]: { stage: 'playing' }, [server]: invite }, 'stable-legacy'],
  ['Suite bridged ended stable game permits service', '/suite-dev/workbench-panels/table.html', { [stable]: { stage: 'ended' }, [server]: invite }, 'server'],
  ['Suite direct live pack without stable game', '/suite/three-dragon-ante.html', { [pack]: { stage: 'playing' } }, 'legacy'],
  ['invalid service metadata cannot hide an active pack', '/three-dragon-ante/table.html', { [pack]: { stage: 'playing' }, [server]: { version: 1, id: 'bad', joinKey: 'bad' } }, 'legacy'],
  ['malformed or ended legacy metadata opens the server lobby', '/three-dragon-ante/table.html', { [pack]: { stage: 'ended' }, [stable]: { stage: 'playing' } }, 'server'],
];
const checks = [];
for (const [name, path, metadata, expected] of cases) {
  assert.equal(pageHost(path, metadata), expected, name);
  checks.push(name); console.log('PASS', name);
}
writeFileSync(join(run, 'result.json'), JSON.stringify({ checks, realOwlbearRoom: false, scope: 'Pure entry routing for coexisting legacy and server metadata; no room state or private hands.' }, null, 2) + '\n');
console.log(`${checks.length} checks passed`);
