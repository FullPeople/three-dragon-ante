import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'SOURCE.json'), 'utf8'));
let checked = 0;
for (const [file, expected] of Object.entries(manifest.originalFiles)) {
  if (manifest.adaptedFiles.includes(file)) continue;
  const actual = createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
  if (actual !== expected) throw Error(`Extracted upstream file changed: ${file}`);
  checked++;
}
console.log(`PASS ${checked} unchanged upstream files at ${manifest.commit}`);
