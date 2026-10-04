// Prepare a frozen release locally. This script performs no remote operations.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
if (args.includes('--help')) {
  console.log('node tools/release-three-dragon.mjs --out <new-directory> (--overlay <frozen-suite-overlay> | --website-only)');
  process.exit(0);
}
const websiteOnly = args.includes('--website-only');
const seenOptions = new Set();
for (let i = 0; i < args.length; i++) {
  const name = args[i];
  if (seenOptions.has(name)) throw Error('Duplicate argument: ' + name);
  seenOptions.add(name);
  if (name === '--website-only') continue;
  if (!['--out', '--overlay'].includes(name) || !args[i + 1] || args[i + 1].startsWith('--')) throw Error('Unknown or incomplete argument: ' + name);
  i++;
}
if (!option('--out') || (!websiteOnly && !option('--overlay'))) throw Error('--out and either --overlay or --website-only are required.');
if (websiteOnly && option('--overlay')) throw Error('--website-only cannot include a Suite overlay.');
const out = resolve(option('--out')), overlay = websiteOnly ? null : resolve(option('--overlay'));
if (existsSync(out)) throw Error('Release output must be a new directory; existing artifacts are never removed.');
if (out === root || out.startsWith(root + '\\') || out.startsWith(root + '/')) throw Error('Keep release artifacts outside the source repository.');
const git = (...argv) => execFileSync('git', argv, { cwd: root, encoding: 'utf8' }).trim();
if (git('diff', '--name-only') || git('diff', '--cached', '--name-only')) throw Error('Tracked source must be frozen and clean before packaging.');
const untracked = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(file => file && !file.startsWith('.claude/'));
if (untracked.length) throw Error('Commit the reviewed release/runtime source before final packaging: ' + untracked.join(', '));
const head = git('rev-parse', 'HEAD');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version.replace(/-dev$/, '');
const api = '/three-dragon-api/v1';
const overlays = websiteOnly ? null : JSON.parse(readFileSync(join(overlay, 'overlay-manifest.json'), 'utf8'));
if (overlays) {
  if (overlays.tdaSource !== head || overlays.api !== api) throw Error('Suite overlay must match the exact frozen source and same-origin API.');
  if (JSON.stringify([...overlays.targets].sort()) !== JSON.stringify(['suite', 'suite-dev'])) throw Error('Both Suite overlays are required.');
  if (overlays.hostOverlay && (overlays.hostOverlay.mode !== 'website-link-only' || overlays.hostOverlay.website !== 'https://obr.dnd.center/three-dragon-ante/')) throw Error('Only the reviewed website-link host overlay is allowed.');
}
const hostOutputs = new Map((overlays?.hostOverlay?.outputs || []).map(item => [item.path, item]));
const slash = value => value.replaceAll('\\', '/');
const safeRelative = value => {
  if (!value || isAbsolute(value) || value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Unsafe package path: ' + value);
  if (/^(?:\.git|\.claude|\.local-evidence|\.local-data)(?:\/|$)/.test(value) || (value !== '.env.example' && /(?:^|\/)\.env(?:\.|$)/.test(value)) || /\.sqlite(?:-|$)/.test(value)) throw Error('Private file cannot enter a release: ' + value);
  return value;
};
const sha = filename => createHash('sha256').update(readFileSync(filename)).digest('hex');
const walk = directory => {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error('Symlink cannot enter release: ' + file);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (entry.isFile()) files.push(file);
    else throw Error('Special file cannot enter release: ' + file);
  }
  return files.sort();
};
const run = (script, env = {}) => execFileSync(process.execPath, [join(root, script)], { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit' });
mkdirSync(out, { recursive: true });
const payload = join(out, 'payload');
mkdirSync(payload);
run('node_modules/typescript/bin/tsc', {}); // tsconfig contains noEmit.
const targets = [];
for (const channel of ['dev', 'stable']) {
  const name = channel === 'dev' ? 'three-dragon-ante-dev' : 'three-dragon-ante';
  const directory = join(payload, name);
  execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', directory, '--logLevel', 'warn'], {
    cwd: root, env: { ...process.env, THREE_DRAGON_CHANNEL: channel, VITE_TDA_API: api }, stdio: 'inherit',
  });
  const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== version + (channel === 'dev' ? '-dev' : '') || manifest.background_url !== `/${name}/background.html`) throw Error('Manifest version/base does not match target.');
  for (const file of ['index.html', 'table.html', 'background.html', 'launcher.html', 'manifest.json']) if (!existsSync(join(directory, file))) throw Error('Missing entry: ' + file);
  targets.push({ name, kind: 'independent', version: manifest.version, files: walk(directory).map(file => ({ path: safeRelative(slash(relative(directory, file))), sha256: sha(file), size: statSync(file).size })) });
}
const sourcePaths = git('ls-files', '-z').split('\0').filter(Boolean);
sourcePaths.forEach(safeRelative);
const sourceName = `three-dragon-source-${head.slice(0, 12)}.zip`;
const sourceArchive = join(payload, sourceName);
execFileSync('git', ['archive', '--format=zip', '--prefix=three-dragon-ante/', '--output=' + sourceArchive, head], { cwd: root, stdio: 'inherit' });
const sourceInfo = { path: sourceName, sha256: sha(sourceArchive), files: sourcePaths.length, head };
for (const name of websiteOnly ? [] : ['suite-dev', 'suite']) {
  const entries = overlays.outputs.filter(item => item.path.startsWith(name + '/'));
  if (!entries.length) throw Error('Missing overlay files for ' + name);
  const seen = new Set();
  const files = entries.map(entry => {
    const path = safeRelative(entry.path.slice(name.length + 1));
    const allowed = name === 'suite-dev' ? /^(?:workbench-panels\/table\.html|workbench-panels\/assets\/[A-Za-z0-9_.-]+)$/ : /^(?:three-dragon-ante\.html|three-dragon-assets\/[A-Za-z0-9_.-]+)$/;
    const host = hostOutputs.get(entry.path);
    const hostAllowed = /^(?:settings\.html|assets\/[A-Za-z0-9_.-]+\.(?:js|css)|three-dragon-link-source-[a-f0-9]{12}\.zip|workbench\/(?:index\.html|sw\.js|assets\/[A-Za-z0-9_.-]+\.(?:js|css)|three-dragon-link-source-[a-f0-9]{12}\.zip)|workbench-panels\/(?:settings\.html|settings-[A-Za-z0-9_.-]+\.js))$/;
    if ((!allowed.test(path) && !(host && host.sha256 === entry.sha256 && hostAllowed.test(path))) || seen.has(path)) throw Error('Unexpected or duplicated Suite overlay output: ' + path);
    seen.add(path);
    const source = join(overlay, name, path), destination = join(payload, name, path);
    if (sha(source) !== entry.sha256) throw Error('Overlay SHA mismatch: ' + entry.path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    return { path, sha256: entry.sha256, size: statSync(destination).size };
  });
  targets.push({ name, kind: 'suite-overlay', suiteSource: overlays.suiteSource, files });
}
run('tools/build-three-dragon-server.mjs', { TDA_SERVER_OUT: join(payload, 'server') });
const server = { path: 'server/server.mjs', sha256: sha(join(payload, 'server/server.mjs')), size: statSync(join(payload, 'server/server.mjs')).size };
const scope = websiteOnly ? 'website-only' : 'all-four';
const manifest = { format: 1, repository: 'FullPeople/three-dragon-ante', source: head, version, api, scope, sourceArchive: sourceInfo, server, targets, hostOverlay: overlays?.hostOverlay || null,
  preservation: 'Merge compiled files only; preserve existing cached assets, Suite manifests/runtime/legacy modules, nginx, unit, relay, card and live SQLite.' };
writeFileSync(join(payload, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const deployScript = join(root, 'tools/deploy-three-dragon-release.py');
copyFileSync(deployScript, join(out, 'deploy-three-dragon-release.py'));
const archive = join(out, 'three-dragon-release.tar.gz');
execFileSync('python', ['-c', 'import pathlib,sys,tarfile; p=pathlib.Path(sys.argv[1]); t=tarfile.open(sys.argv[2],"w:gz"); [t.add(f,arcname=f.relative_to(p).as_posix(),recursive=False) for f in sorted(p.rglob("*")) if f.is_file() and f.relative_to(p).as_posix()!="server/service.mjs"]; t.close()', payload, archive], { stdio: 'inherit' });
const result = { out, source: head, version, api, scope, targets: targets.map(target => ({ name: target.name, files: target.files.length })), sourceArchive: sourceInfo,
  archive: { path: archive, sha256: sha(archive), size: statSync(archive).size }, deployScript: { path: join(out, 'deploy-three-dragon-release.py'), sha256: sha(join(out, 'deploy-three-dragon-release.py')) } };
writeFileSync(join(out, 'release-preparation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
