import test from 'node:test';
import assert from 'node:assert/strict';
import { createHighScoreStore, HIGH_SCORE_KEY } from '../src/high-score.ts';

test('rekor yeni oturumda yüklenir; daha düşük skorla azalmaz', () => {
  const data = new Map();
  let writes = 0;
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { writes++; data.set(key, value); } };
  const store = createHighScoreStore(storage);
  store.record(300); store.record(100); store.record(300);
  assert.equal(store.value, 300);
  assert.equal(data.get(HIGH_SCORE_KEY), '300');
  assert.equal(writes, 1);
  assert.equal(createHighScoreStore(storage).value, 300);
});
test('bozuk ve geçersiz rekor kaydı oyunu bozmaz', () => {
  for (const value of ['{bad', 'null', '-1', '1.5', '"900"', '{}', '1e99']) {
    assert.equal(createHighScoreStore({ getItem: () => value, setItem() {} }).value, 0);
  }
});
test('engelli veya dolu localStorage durumunda rekor bellekte korunur', () => {
  for (const storage of [undefined, { getItem() { throw Error('blocked'); } }, { getItem() { return null; }, setItem() { throw Error('quota'); } }]) {
    const store = createHighScoreStore(storage);
    store.record(500);
    assert.equal(store.value, 500);
    assert.equal(store.available, false);
  }
});
