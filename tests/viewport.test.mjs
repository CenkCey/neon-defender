import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorldBounds } from '../src/viewport.ts';
import { createGameState, restartGame, resizeGame, updateGame } from '../src/world.ts';
import { canvasPoint } from '../src/touch-input.ts';

test('masaüstü ve başlangıç menüsü 960×540 kalır', () => {
  assert.deepEqual(getWorldBounds(1100, 619, false), { width: 960, height: 540 });
  assert.deepEqual(getWorldBounds(345, 194, false), { width: 960, height: 540 });
});

test('iPhone dikey/yatay görünümde her iki eksen aynı ölçekte çizilir', () => {
  for (const [width, height] of [[393, 730], [320, 500], [852, 330]]) {
    const bounds = getWorldBounds(width, height, true);
    assert.equal(Math.min(bounds.width, bounds.height), 540);
    assert.ok(Math.abs(width / bounds.width - height / bounds.height) < 1e-9);
    assert.deepEqual(canvasPoint({ left: 0, top: 62, width, height }, width / 2, 62 + height / 2, bounds), { x: bounds.width / 2, y: bounds.height / 2 });
  }
});

test('ölçüsüz/geçici gizli Canvas için güvenli varsayılan kullanılır', () => {
  assert.deepEqual(getWorldBounds(0, 0, true), { width: 960, height: 540 });
});

test('yeniden boyutlama gemi/mermi/düşman/efekt konumunu oransal korur, skoru sıfırlamaz', () => {
  const state = createGameState(1500);
  restartGame(state);
  state.score = 400;
  state.shooting.bullets.push({ x: 480, y: 270 });
  state.enemies.enemies.push({ x: 240, y: 135, speed: 70 });
  state.effects.push({ x: 720, y: 405, age: 0.1, color: '#fff' });
  resizeGame(state, { width: 540, height: 1080 });
  assert.deepEqual(state.player, { x: 270, y: 864 });
  assert.deepEqual(state.shooting.bullets[0], { x: 270, y: 540 });
  assert.equal(state.enemies.enemies[0].x, 135);
  assert.equal(state.enemies.enemies[0].y, 270);
  assert.equal(state.effects[0].y, 810);
  assert.equal(state.score, 400);
  assert.equal(state.highScore, 1500);
  restartGame(state);
  assert.deepEqual(state.bounds, { width: 540, height: 1080 });
  assert.deepEqual(state.player, { x: 270, y: 864 });
});

test('dikey uçuşta hareket sınırları ve düşman temizliği yeni alanı kullanır', () => {
  const state = createGameState(0, { width: 540, height: 1080 });
  restartGame(state);
  state.player.x = 518;
  state.enemies.spawnRemaining = 10;
  state.enemies.enemies.push({ x: 50, y: 800, speed: 0 }, { x: 50, y: 1120, speed: 0 });
  updateGame(state, { x: 1, y: 0, shooting: false }, 0.05);
  assert.equal(state.player.x, 518);
  assert.equal(state.enemies.enemies.length, 1);
  assert.equal(state.enemies.enemies[0].y, 800);
});

test('dikey alanda iki dakikalık atışta mermi/düşman birikmez', () => {
  const state = createGameState(0, { width: 540, height: 1080 });
  restartGame(state);
  for (let i = 0; i < 7200; i++) {
    updateGame(state, { x: 0, y: 0, shooting: true }, 1 / 60, () => 0.9);
    assert.ok(state.shooting.bullets.length < 15);
    assert.ok(state.enemies.enemies.length < 25);
  }
  assert.equal(state.phase, 'PLAYING');
});
