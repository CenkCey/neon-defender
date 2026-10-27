import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createServiceWorker } from '../scripts/pwa-worker.mjs';

async function setup() {
  const scope = 'https://game.test/neon/';
  const handlers = new Map(), stores = new Map();
  const resolve = value => {
    const url = new URL(typeof value === 'string' ? value : value.url, scope);
    url.search = '';
    return url.href;
  };
  const caches = {
    async open(key) {
      if (!stores.has(key)) stores.set(key, new Map());
      const data = stores.get(key);
      return { async addAll(files) { for (const file of files) data.set(resolve(file), 'cached:' + file); }, async match(request) { const text = data.get(resolve(request)); return text === undefined ? undefined : new Response(text); } };
    },
    async keys() { return [...stores.keys()]; },
    async delete(key) { return stores.delete(key); },
  };
  const self = { registration: { scope }, location: { origin: 'https://game.test' }, addEventListener: (name, callback) => handlers.set(name, callback), clients: { async claim() {} }, skipWaiting() { throw Error('must not interrupt games'); } };
  vm.runInNewContext(createServiceWorker(['./index.html', './assets/game.js', './manifest.webmanifest'], 'test-v1'), { self, caches, URL, fetch: async () => { throw Error('offline'); } });
  async function lifecycle(name) {
    let task; handlers.get(name)({ waitUntil(promise) { task = promise; } }); await task;
  }
  function request(url, mode = 'cors', method = 'GET') {
    let task;
    handlers.get('fetch')({ request: { url, mode, method }, respondWith(promise) { task = promise; } });
    return task;
  }
  return { scope, stores, lifecycle, request };
}
test('manifest bağımsız PWA tanımlar; PNG ikonları doğru boyuttadır', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.orientation, 'portrait');
  for (const icon of manifest.icons) {
    const data = await readFile(new URL('../public/' + icon.src, import.meta.url));
    assert.equal(data.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes);
  }
});
test('service worker kurulumda tüm dosyaları önbellekler ve çevrimdışı gezinme/JS sunar', async () => {
  const s = await setup(); await s.lifecycle('install'); await s.lifecycle('activate');
  assert.equal(await (await s.request(s.scope, 'navigate')).text(), 'cached:./index.html');
  assert.equal(await (await s.request(s.scope + 'assets/game.js')).text(), 'cached:./assets/game.js');
  assert.equal(await (await s.request(s.scope + 'assets/game.js?v=2')).text(), 'cached:./assets/game.js');
});
test('aktivasyon yalnızca bu uygulama/kapsamdaki eski önbelleği temizler', async () => {
  const s = await setup();
  s.stores.set('neon-defender:' + s.scope + ':old', new Map());
  s.stores.set('neon-defender:https://game.test/other/:old', new Map());
  s.stores.set('unrelated-app', new Map());
  await s.lifecycle('install'); await s.lifecycle('activate');
  assert.equal(s.stores.has('neon-defender:' + s.scope + ':old'), false);
  assert.equal(s.stores.has('unrelated-app'), true);
  assert.equal(s.stores.has('neon-defender:https://game.test/other/:old'), true);
});
test('service worker başka kaynakları, başka kapsamı ve POST isteklerini yakalamaz', async () => {
  const s = await setup();
  assert.equal(s.request('https://other.test/'), undefined);
  assert.equal(s.request('https://game.test/other/'), undefined);
  assert.equal(s.request(s.scope, 'cors', 'POST'), undefined);
});
