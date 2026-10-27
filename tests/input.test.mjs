import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.ts';

// Exercise keyboard rules with EventTargets; these are not browser tests.
function setup(t, onStart) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const canvas = new EventTarget();
  const windowStub = new EventTarget();
  const documentStub = Object.assign(new EventTarget(), { activeElement: canvas });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowStub });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentStub });
  const input = createInput(canvas, onStart);

  function key(type, code, properties = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), { code, ...properties });
    windowStub.dispatchEvent(event);
    return event;
  }

  t.after(() => {
    input.dispose();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  });
  return { input, key, canvas, windowStub, documentStub };
}

test('Space oyun odaktayken kaydırmayı engeller; bırakılınca ateş durumu kapanır', (t) => {
  const { input, key } = setup(t);
  assert.equal(key('keydown', 'Space').defaultPrevented, true);
  assert.equal(input.read().shooting, true);
  key('keyup', 'Space');
  assert.equal(input.read().shooting, false);
});

test('Canvas odakta değilken Space tarayıcıya bırakılır', (t) => {
  const { input, key, documentStub } = setup(t);
  documentStub.activeElement = null;
  assert.equal(key('keydown', 'Space').defaultPrevented, false);
  assert.equal(input.read().shooting, false);
});

test('iki kare arasında basılıp bırakılan Space tek karelik atış isteği olarak korunur', (t) => {
  const { input, key } = setup(t);
  key('keydown', 'Space');
  key('keyup', 'Space');
  assert.equal(input.read().shooting, true);
  assert.equal(input.read().shooting, false);
});

test('hareket ve ateş aynı anda çalışır; tuş tekrarı yeni durum üretmez', (t) => {
  const { input, key } = setup(t);
  key('keydown', 'KeyD');
  key('keydown', 'ArrowUp');
  key('keydown', 'Space');
  for (let i = 0; i < 20; i++) key('keydown', 'Space', { repeat: true });
  assert.deepEqual(input.read(), { x: 1, y: -1, shooting: true });
  key('keyup', 'Space');
  assert.deepEqual(input.read(), { x: 1, y: -1, shooting: false });
});

test('odak kaybı ve görünürlük değişimi ateş durumunu temizler', (t) => {
  const { input, key, canvas, windowStub, documentStub } = setup(t);
  for (const [target, eventName] of [[canvas, 'blur'], [windowStub, 'blur'], [documentStub, 'visibilitychange']]) {
    key('keydown', 'Space');
    target.dispatchEvent(new Event(eventName));
    assert.equal(input.read().shooting, false);
  }
});

test('Ctrl, Meta veya Alt içeren Space kısayolları yakalanmaz', (t) => {
  const { input, key } = setup(t);
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    assert.equal(key('keydown', 'Space', { [modifier]: true }).defaultPrevented, false);
    assert.equal(input.read().shooting, false);
  }
});

test('Enter/R başlatma isteği tek kez işlenir, tekrar olayı ve değiştiriciler yok sayılır', (t) => {
  let starts = 0;
  const { input, key, documentStub } = setup(t, () => { starts++; return true; });
  documentStub.activeElement = null; // The menu/restart button may own focus.
  assert.equal(key('keydown', 'Enter').defaultPrevented, true);
  key('keydown', 'Enter', { repeat: true });
  key('keydown', 'KeyR', { ctrlKey: true });
  assert.equal(starts, 1);
  assert.equal(key('keydown', 'KeyR').defaultPrevented, true);
  assert.equal(starts, 2);
  assert.equal(input.read().shooting, false);
});

test('oyun başlatma isteğini kabul etmiyorsa Enter tarayıcıya bırakılır', (t) => {
  const { key } = setup(t, () => false);
  assert.equal(key('keydown', 'Enter').defaultPrevented, false);
});

test('dispose sonrası klavye dinleyicileri etkisizdir; tekrar dispose güvenlidir', (t) => {
  const { input, key } = setup(t);
  input.dispose(); input.dispose();
  assert.equal(key('keydown', 'Space').defaultPrevented, false);
  assert.equal(input.read().shooting, false);
});
