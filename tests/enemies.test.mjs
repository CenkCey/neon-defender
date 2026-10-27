import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_CONFIG, createEnemy, createEnemyState, updateEnemies, getDifficulty } from '../src/enemies.ts';

const bounds = { width: 960, height: 540 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test('düşman yatay sınırlar içinde, üst kenarda doğar', () => {
  for (const value of [0, 0.5, 1]) {
    const enemy = createEnemy(960, 0, () => value);
    assert.ok(enemy.x >= ENEMY_CONFIG.width / 2);
    assert.ok(enemy.x <= 960 - ENEMY_CONFIG.width / 2);
    assert.equal(enemy.y, -ENEMY_CONFIG.height / 2);
  }
});

test('düşman 30, 60 ve 144 FPS değerlerinde aynı mesafeyi alır', () => {
  for (const fps of [30, 60, 144]) {
    const state = createEnemyState();
    state.spawnRemaining = 10;
    state.enemies.push({ x: 300, y: 100, speed: 90 });
    for (let frame = 0; frame < fps; frame++) updateEnemies(state, 1 / fps, 0, bounds);
    near(state.enemies[0].y, 190);
  }
});

test('ilk doğum gecikmesi ve sonraki aralık uygulanır; gecikmede toplu doğum olmaz', () => {
  const state = createEnemyState();
  updateEnemies(state, 0.74, 0, bounds, () => 0.5);
  assert.equal(state.enemies.length, 0);
  updateEnemies(state, 0.01, 0, bounds, () => 0.5);
  assert.equal(state.enemies.length, 1);
  near(state.spawnRemaining, ENEMY_CONFIG.initialSpawnInterval);
  updateEnemies(state, 5, 0, bounds, () => 0.5);
  assert.equal(state.enemies.length, 2);
});

test('alt kenardan tamamen çıkan düşman silinir, kısmen görünür olan kalır', () => {
  const state = createEnemyState();
  state.enemies = [{ x: 300, y: 558, speed: 0 }, { x: 600, y: 559, speed: 0 }];
  updateEnemies(state, 0, 0, bounds);
  assert.equal(state.enemies.length, 1);
  assert.equal(state.enemies[0].x, 300);
});

test('puanla zorluk kademeli artar ve belirlenen üst sınırda kalır', () => {
  const easy = getDifficulty(0);
  const middle = getDifficulty(2500);
  const hard = getDifficulty(5000);
  assert.ok(easy.speed < middle.speed && middle.speed < hard.speed);
  near(easy.playerSpeed, 280);
  near(middle.playerSpeed, 335);
  near(hard.playerSpeed, 390);
  near((middle.playerSpeed - easy.playerSpeed) / (hard.playerSpeed - easy.playerSpeed), (middle.speed - easy.speed) / (hard.speed - easy.speed));
  assert.ok(easy.spawnInterval > middle.spawnInterval && middle.spawnInterval > hard.spawnInterval);
  assert.deepEqual(getDifficulty(1_000_000), hard);
  near(hard.speed, ENEMY_CONFIG.maxSpeed);
  near(hard.spawnInterval, ENEMY_CONFIG.minSpawnInterval);
  assert.ok(createEnemy(960, 1_000_000, () => 1).speed <= ENEMY_CONFIG.maxSpeed);
});
