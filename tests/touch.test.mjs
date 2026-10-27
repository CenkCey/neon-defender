import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchInput, canvasPoint } from '../src/touch-input.ts';
import { updatePlayer } from '../src/player.ts';
import { mergeInput } from '../src/input.ts';

class Surface extends EventTarget {
  ids = new Set();
  classList = { add() {}, remove() {} };
  rect = { left: 10, top: 20, width: 480, height: 270 };
  setPointerCapture(id) { this.ids.add(id); }
  hasPointerCapture(id) { return this.ids.has(id); }
  releasePointerCapture(id) { this.ids.delete(id); }
  getBoundingClientRect() { return this.rect; }
  focus() {}
}
function setup(t, mode = 'drag', bounds = { width: 960, height: 540 }) {
  const previous = Object.fromEntries(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const host = new EventTarget(), doc = new EventTarget();
  Object.defineProperty(globalThis, 'window', { value: host, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  const canvas = new Surface(), fire = new Surface(), player = { x: 480, y: 432 };
  const input = createTouchInput(canvas, fire, () => player, () => bounds);
  input.setMode(mode); input.setActive(true);
  t.after(() => { input.dispose(); for (const key of ['window','document']) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key]; } });
  function pointer(target, type, id, x = 250, y = 236) {
    const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y });
    target.dispatchEvent(event);
    return event;
  }
  return { canvas, fire, player, input, pointer, host, doc };
}
test('CSS koordinatları mantıksal Canvas alanına ölçeklenir; DPR kullanılmaz', () => {
  assert.deepEqual(canvasPoint({ left: 10, top: 20, width: 480, height: 270 }, 250, 155), { x: 480, y: 270 });
  assert.deepEqual(canvasPoint({ left: 0, top: 0, width: 960, height: 540 }, 480, 270), { x: 480, y: 270 });
  assert.equal(canvasPoint({ left: 0, top: 0, width: 0, height: 0 }, 0, 0), null);
});
test('sürükleme başlangıcında sıçrama olmaz; hareket yalnızca yataydır ve hız sınırlıdır', (t) => {
  const s = setup(t);
  s.pointer(s.canvas, 'pointerdown', 1, 255, 236);
  assert.equal(s.input.read().targetX, 480);
  s.pointer(s.canvas, 'pointermove', 1, 305, 20);
  const input = s.input.read();
  assert.equal(input.targetX, 580);
  updatePlayer(s.player, input, 0.1, { width: 960, height: 540 });
  assert.deepEqual(s.player, { x: 508, y: 432 });
});
test('sürükleme ve ateş ayrı parmaklarla aynı anda çalışır; ateşi bırakmak sürüklemeyi bozmaz', (t) => {
  const s = setup(t); s.pointer(s.canvas, 'pointerdown', 1); s.pointer(s.fire, 'pointerdown', 2);
  assert.equal(s.input.read().shooting, true);
  s.pointer(s.fire, 'pointerup', 2);
  assert.equal(s.input.read().shooting, false);
  assert.equal(s.input.read().targetX, 480);
});
test('sürüklemeyi bırakmak ateşi bozmaz; ateş iptali takılı kalmaz', (t) => {
  const s = setup(t); s.pointer(s.canvas, 'pointerdown', 1); s.pointer(s.fire, 'pointerdown', 2);
  s.input.read(); s.pointer(s.canvas, 'pointerup', 1);
  assert.equal(s.input.read().shooting, true);
  s.pointer(s.fire, 'pointercancel', 2);
  assert.equal(s.input.read().shooting, false);
  assert.equal(s.input.read().targetX, undefined);
});
test('Tilt & Tap Canvas dokunması kısa basışta bir kere, tutuşta sürekli ateş verir', (t) => {
  const s = setup(t, 'tilt');
  assert.equal(s.pointer(s.canvas, 'pointerdown', 1).defaultPrevented, true);
  s.pointer(s.canvas, 'pointerup', 1);
  assert.equal(s.input.read().shooting, true);
  assert.equal(s.input.read().shooting, false);
  s.pointer(s.canvas, 'pointerdown', 2);
  assert.equal(s.input.read().shooting, true);
  assert.equal(s.input.read().shooting, true);
  s.pointer(s.canvas, 'pointercancel', 2);
  assert.equal(s.input.read().shooting, false);
});
test('menü/duraklama, odak kaybı ve mod değiştirme tüm dokunma durumunu temizler', (t) => {
  const s = setup(t);
  s.pointer(s.fire, 'pointerdown', 2); s.input.setActive(false);
  assert.equal(s.input.read().shooting, false);
  s.pointer(s.fire, 'pointerdown', 3);
  assert.equal(s.input.read().shooting, false);
  s.input.setActive(true); s.pointer(s.fire, 'pointerdown', 4);
  s.host.dispatchEvent(new Event('blur'));
  assert.equal(s.input.read().shooting, false);
  s.pointer(s.fire, 'pointerdown', 5); s.input.setMode('tilt');
  assert.equal(s.input.read().shooting, false);
  assert.equal(s.fire.ids.size, 0);
});
test('Drag & Fire uzak dokunuşla gemiyi ışınlamaz ve Canvas dokunuşuyla ateş etmez', (t) => {
  const s = setup(t);
  s.pointer(s.canvas, 'pointerdown', 1, 20, 30);
  assert.equal(s.input.read().targetX, undefined);
  assert.equal(s.input.read().shooting, false);
});
test('analog eğim büyüklüğü korunur; klavye hareketi mobil hedefe göre önceliklidir', () => {
  const player = { x: 480, y: 432 };
  updatePlayer(player, { x: 0.25, y: 0 }, 0.1, { width: 960, height: 540 });
  assert.equal(player.x, 487); assert.equal(player.y, 432);
  const merged = mergeInput({ x: 1, y: 0, shooting: false }, { x: 0, y: 0, targetX: 100, shooting: true });
  assert.deepEqual(merged, { x: 1, y: 0, shooting: true });
});
test('dokunma dinleyicileri dispose ile tamamen kaldırılır', (t) => {
  const s = setup(t); s.input.dispose();
  assert.equal(s.pointer(s.fire, 'pointerdown', 2).defaultPrevented, false);
  assert.equal(s.input.read().shooting, false);
});

test('tam ekran dikey Canvas sürüklemesi güncel sınır ve koordinatları kullanır', (t) => {
  const bounds = { width: 540, height: 1080 };
  const s = setup(t, 'drag', bounds);
  s.canvas.rect = { left: 0, top: 60, width: 393, height: 786 };
  Object.assign(s.player, { x: 270, y: 864 });
  s.pointer(s.canvas, 'pointerdown', 1, 196.5, 688.8);
  assert.equal(s.input.read().targetX, 270);
  s.pointer(s.canvas, 'pointermove', 1, 1000, 688.8);
  assert.equal(s.input.read().targetX, 518);
  s.input.clear();
  assert.equal(s.input.read().targetX, undefined);
});
