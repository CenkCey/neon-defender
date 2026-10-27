import test from 'node:test';
import assert from 'node:assert/strict';
import { createShootingState, updateShooting, SHOOTING_COOLDOWN, BULLET_SPEED, BULLET_HEIGHT } from '../src/bullets.ts';
import { PLAYER_HEIGHT } from '../src/player.ts';

const player = { x: 480, y: 432 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} ≠ ${expected}`);

test('ilk atış geminin üst merkezinden beklemeden doğar', () => {
  const state = createShootingState();
  updateShooting(state, true, player, 0);
  assert.equal(state.bullets.length, 1);
  assert.equal(state.bullets[0].x, player.x);
  assert.equal(state.bullets[0].y + BULLET_HEIGHT / 2, player.y - PLAYER_HEIGHT / 2);
});

test('180 ms tamamlanmadan yeni atış yapılmaz', () => {
  const state = createShootingState();
  updateShooting(state, true, player, 0);
  updateShooting(state, true, player, 0.179);
  assert.equal(state.bullets.length, 1);
  updateShooting(state, true, player, 0.001);
  assert.equal(state.bullets.length, 2);
});

test('Space basılı tutulunca saniyede altı atış oluşur', () => {
  const state = createShootingState();
  let shots = 0;
  for (let frame = 0; frame <= 100; frame++) {
    const previousNewest = state.bullets.at(-1);
    updateShooting(state, true, player, frame === 0 ? 0 : 0.01);
    if (state.bullets.at(-1) !== previousNewest) shots++;
  }
  assert.equal(shots, 6);
});

test('Space bırakılınca ateş kesilir; tekrar basmak beklemeyi atlamaz', () => {
  const state = createShootingState();
  updateShooting(state, true, player, 0);
  updateShooting(state, false, player, 0.05);
  updateShooting(state, true, player, 0.05);
  assert.equal(state.bullets.length, 1);
  updateShooting(state, false, player, 0.08);
  assert.equal(state.bullets.length, 1);
  updateShooting(state, true, player, 0);
  assert.equal(state.bullets.length, 2);
});

test('atış aralığı ayarlanabilir', () => {
  const state = createShootingState(0.3);
  assert.equal(SHOOTING_COOLDOWN, 0.18);
  updateShooting(state, true, player, 0);
  updateShooting(state, true, player, 0.18);
  assert.equal(state.bullets.length, 1);
  updateShooting(state, true, player, 0.12);
  assert.equal(state.bullets.length, 2);
});

test('mermi 30, 60 ve 144 FPS için aynı sürede aynı mesafeyi alır', () => {
  for (const fps of [30, 60, 144]) {
    const state = createShootingState();
    updateShooting(state, true, player, 0);
    const initialY = state.bullets[0].y;
    for (let frame = 0; frame < fps; frame++) updateShooting(state, false, player, 0.25 / fps);
    near(state.bullets[0].y, initialY - BULLET_SPEED * 0.25);
    assert.equal(state.bullets[0].x, player.x);
  }
});

test('yalnızca tamamen üst sınırdan çıkan mermiler temizlenir', () => {
  const state = createShootingState();
  const visible = { x: 480, y: 100 };
  const partlyVisible = { x: 480, y: -BULLET_HEIGHT / 2 + 1 };
  state.bullets.push(visible, { x: 480, y: -BULLET_HEIGHT / 2 - 1 }, partlyVisible);
  updateShooting(state, false, player, 0);
  assert.deepEqual(state.bullets, [visible, partlyVisible]);
  updateShooting(state, false, player, 1);
  assert.equal(state.bullets.length, 0);
});

test('hareket sonrası yeni atış geminin güncel konumunu kullanır', () => {
  const state = createShootingState();
  updateShooting(state, true, player, 0);
  const movedPlayer = { x: 600, y: 300 };
  updateShooting(state, true, movedPlayer, 0.18);
  assert.equal(state.bullets[1].x, movedPlayer.x);
  assert.equal(state.bullets[1].y + BULLET_HEIGHT / 2, movedPlayer.y - PLAYER_HEIGHT / 2);
});

test('uzun frame gecikmesi toplu atış üretmez', () => {
  const state = createShootingState();
  updateShooting(state, true, player, 0);
  updateShooting(state, true, player, 5);
  assert.equal(state.bullets.length, 1);
});
