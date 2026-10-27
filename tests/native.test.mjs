import test from 'node:test';
import assert from 'node:assert/strict';
import { watchNativePause } from '../src/native.ts';
import { registerOffline } from '../src/pwa.ts';

test('tarayıcı sürümü native App dinleyicisi kurmaz', () => {
  let calls = 0;
  const stop = watchNativePause(() => {}, { addListener() { calls++; } }, false);
  stop(); stop();
  assert.equal(calls, 0);
});

test('native arka plan oyunu duraklatır; ön plana dönüş otomatik devam ettirmez', async () => {
  let callback, pauses = 0, removes = 0;
  const stop = watchNativePause(() => { pauses++; }, {
    async addListener(name, listener) {
      assert.equal(name, 'appStateChange');
      callback = listener;
      return { async remove() { removes++; } };
    },
  }, true);
  await Promise.resolve();
  callback({ isActive: false });
  callback({ isActive: true });
  assert.equal(pauses, 1);
  stop(); stop();
  callback({ isActive: false });
  assert.equal(pauses, 1);
  assert.equal(removes, 1);
});

test('geç bağlanan native dinleyici dispose sonrasında temizlenir', async () => {
  let resolve, removes = 0;
  const stop = watchNativePause(() => assert.fail('Disposed callback'), {
    addListener() { return new Promise(done => { resolve = done; }); },
  }, true);
  stop();
  resolve({ async remove() { removes++; } });
  await Promise.resolve();
  assert.equal(removes, 1);
});

test('native çevrimdışı durum service worker veya HTTPS beklemez', () => {
  const status = { textContent: '' };
  registerOffline(status, true); // No window/navigator in Node: touching either would fail.
  assert.equal(status.textContent, 'Çevrimdışı hazır · Oyun bu cihazda yüklü.');
});
