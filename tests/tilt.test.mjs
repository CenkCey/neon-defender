import test from 'node:test';
import assert from 'node:assert/strict';
import { createTiltInput, tiltAxis, horizontalAngle } from '../src/tilt.ts';

function setup(permission = 'granted', secure = true, native = false) {
  const timers = new Map();
  const statuses = [], failures = [];
  let calls = 0;
  const host = Object.assign(new EventTarget(), {
    isSecureContext: secure,
    DeviceOrientationEvent: { requestPermission: async () => { calls++; return permission; } },
    screen: { orientation: { angle: 0 } },
    setTimeout: (callback) => { timers.set(1, callback); return 1; },
    clearTimeout: (id) => timers.delete(id),
  });
  const controller = createTiltInput(s => statuses.push(s), s => failures.push(s), host, native);
  const sample = (gamma, beta = 30) => host.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma, beta }));
  return { controller, host, sample, timers, statuses, failures, calls: () => calls };
}

test('paketlenmiş native bağlam izin ve gerçek sensör verisi kontrolünü atlamaz', async () => {
  const s = setup('granted', false, true);
  assert.equal(s.controller.supported, true);
  assert.equal(s.calls(), 0);
  await s.controller.enable();
  assert.equal(s.calls(), 1);
  assert.equal(s.controller.ready, false);
  s.sample(10);
  assert.equal(s.controller.ready, true);
  assert.equal(s.controller.read(0.1), 0);
  s.controller.dispose();
  const denied = setup('denied', false, true);
  await denied.controller.enable();
  assert.equal(denied.controller.ready, false);
  assert.deepEqual(denied.failures, ['denied']);
});

test('sensör izni yaratılışta istenmez; izin verilmesi kullanılabilir veri sayılmaz', async () => {
  const s = setup();
  assert.equal(s.calls(), 0);
  await s.controller.enable();
  assert.equal(s.calls(), 1);
  assert.equal(s.controller.ready, false);
  assert.equal(s.controller.read(0.1), 0);
  s.sample(null);
  assert.equal(s.controller.ready, false);
  s.sample(8);
  assert.equal(s.controller.ready, true);
  assert.equal(s.controller.read(0.1), 0); // First real sample calibrates neutral.
  s.controller.dispose();
});
test('reddedilen izin ve güvensiz bağlam fallback üretir; tekrar prompt açılmaz', async () => {
  const denied = setup('denied');
  await denied.controller.enable(); await denied.controller.enable();
  assert.equal(denied.calls(), 1);
  assert.equal(denied.failures[0], 'denied');
  const insecure = setup('granted', false);
  await insecure.controller.enable();
  assert.equal(insecure.calls(), 0);
  assert.equal(insecure.failures[0], 'unsupported');
});
test('izin verilse bile olay gelmeyince zaman aşımı fallback üretir', async () => {
  const s = setup(); await s.controller.enable();
  [...s.timers.values()][0]();
  assert.equal(s.controller.ready, false);
  assert.deepEqual(s.failures, ['unavailable']);
  s.sample(10);
  assert.equal(s.controller.ready, false);
});
test('sol/sağ, ölü bölge ve hız sınırı normalize edilir', () => {
  assert.equal(tiltAxis(12, 10), 0);
  assert.equal(tiltAxis(8, 10), 0);
  assert.equal(tiltAxis(40, 10), 1);
  assert.equal(tiltAxis(-30, 10), -1);
  assert.ok(tiltAxis(20, 10) > 0 && tiltAxis(20, 10) < 1);
  assert.ok(Math.abs(horizontalAngle(20, 10, 90) - 20) < 1e-6);
});
test('kalibrasyon anında hareketi durdurur ve yeni tutuşu merkez kabul eder', async () => {
  const s = setup(); await s.controller.enable(); s.sample(0); s.sample(15);
  assert.ok(s.controller.read(0.1) > 0);
  assert.equal(s.controller.calibrate(), true);
  assert.equal(s.controller.read(0.1), 0);
  s.sample(15);
  assert.equal(s.controller.read(0.1), 0);
});
test('eğim yumuşatması 30/60/144 FPS için aynı zaman sonunda aynı sonucu verir', async () => {
  const results = [];
  for (const fps of [30, 60, 144]) {
    const s = setup(); await s.controller.enable(); s.sample(0); s.sample(18);
    let value = 0;
    for (let i = 0; i < fps; i++) value = s.controller.read(1 / fps);
    results.push(value); s.controller.dispose();
  }
  assert.ok(Math.abs(results[0] - results[1]) < 1e-9);
  assert.ok(Math.abs(results[1] - results[2]) < 1e-9);
});
test('eşzamanlı etkinleştirme tek izin isteği yapar; mod değişimi geç yanıtı etkisiz bırakır', async () => {
  const s = setup();
  await Promise.all([s.controller.enable(), s.controller.enable()]);
  assert.equal(s.calls(), 1);
  assert.equal(s.timers.size, 1);
  s.controller.disable();
  let resolve;
  s.host.DeviceOrientationEvent.requestPermission = () => new Promise(r => { resolve = r; });
  const fresh = createTiltInput(() => {}, () => {}, s.host);
  const pending = fresh.enable(); fresh.disable(); resolve('granted'); await pending;
  s.sample(0);
  assert.equal(fresh.ready, false);
  fresh.dispose();
});
test('devre dışı bırakma ve dispose sensörleri temizler; yeniden etkinleştirme yeni örnek ister', async () => {
  const s = setup(); await s.controller.enable(); s.sample(0); s.sample(15);
  s.controller.disable(); s.sample(20);
  assert.equal(s.controller.read(0.1), 0);
  await s.controller.enable();
  assert.equal(s.calls(), 1);
  assert.equal(s.controller.ready, false);
  s.sample(20);
  assert.equal(s.controller.read(0.1), 0);
  s.controller.dispose(); s.sample(-20);
  assert.equal(s.controller.read(0.1), 0);
});
