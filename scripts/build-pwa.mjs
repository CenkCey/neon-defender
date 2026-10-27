import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { createServiceWorker } from './pwa-worker.mjs';

const root = resolve('dist');
async function files(directory) {
  const found = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) found.push(...await files(path));
    else if (item.name !== 'sw.js') found.push(path);
  }
  return found.sort();
}
const assets = await files(root);
const hash = createHash('sha256');
for (const path of assets) { hash.update(relative(root, path)); hash.update(await readFile(path)); }
const version = hash.digest('hex').slice(0, 16);
const precache = assets.map(path => './' + relative(root, path).replaceAll('\\', '/'));

const worker = createServiceWorker(precache, version);
await writeFile(join(root, 'sw.js'), worker);
console.log(`PWA: ${precache.length} dosya çevrimdışı önbelleğe hazır; sürüm ${version}.`);
