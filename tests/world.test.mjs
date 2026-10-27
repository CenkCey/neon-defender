import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, restartGame, updateGame } from '../src/world.ts';
import { createEnemyState } from '../src/enemies.ts';
import { createPlayer } from '../src/player.ts';
import { GAME_CONFIG } from '../src/config.ts';

const idle = { x: 0, y: 0, shooting: false };
function playing() {
  const state = createGameState();
  restartGame(state);
  state.enemies.spawnRemaining = 10;
  return state;
}
const contact = (state) => state.enemies.enemies.push({ ...state.player, speed: 0 });

test('menüde ve Game Over durumunda aktif oyun tamamen donar', () => {
  for (const phase of ['MENU', 'GAME_OVER']) {
    const state = playing(); state.phase = phase;
    const before = structuredClone(state);
    updateGame(state, { x: 1, y: 1, shooting: true }, 0.05);
    assert.deepEqual(state, before);
  }
});
test('öldürülen düşman 100 puan kazandırır ve yeniden sayılmaz', () => {
  const state = playing();
  state.enemies.enemies.push({ x: 300, y: 200, speed: 0 });
  state.shooting.bullets.push({ x: 300, y: 200 });
  updateGame(state, idle, 0);
  assert.equal(state.score, 100);
  assert.equal(state.highScore, 100);
  updateGame(state, idle, 0);
  assert.equal(state.score, 100);
});
test('temas bir can alır; bir saniyelik koruma tekrar hasarı önler', () => {
  const state = playing();
  contact(state); contact(state); updateGame(state, idle, 0);
  assert.equal(state.lives, 2);
  assert.equal(state.invulnerabilityRemaining, 1);
  for (let frame = 0; frame < 19; frame++) {
    contact(state); updateGame(state, idle, 0.05);
    assert.equal(state.lives, 2);
  }
  contact(state); updateGame(state, idle, 0.05);
  assert.equal(state.lives, 1);
});
test('kaçan düşman can eksiltmez ve skor kazandırmaz', () => {
  const state = playing();
  state.enemies.enemies.push({ x: 480, y: 600, speed: 100 });
  updateGame(state, idle, 0.05);
  assert.equal(state.lives, 3);
  assert.equal(state.score, 0);
  assert.equal(state.enemies.enemies.length, 0);
});
test('sıfır canda Game Over oluşur; sonraki karede hiçbir şey ilerlemez', () => {
  const state = playing(); state.lives = 1;
  contact(state); updateGame(state, idle, 0);
  assert.equal(state.lives, 0);
  assert.equal(state.phase, 'GAME_OVER');
  const frozen = structuredClone(state);
  updateGame(state, { x: 1, y: 0, shooting: true }, 0.05);
  assert.deepEqual(state, frozen);
});
test('restart tüm geçici durumu sıfırlar ve rekoru korur', () => {
  const state = playing();
  Object.assign(state, { phase: 'GAME_OVER', score: 1300, highScore: 1500, lives: 0, invulnerabilityRemaining: 0.6, elapsedTime: 90 });
  state.player.x = 100;
  state.shooting.bullets.push({ x: 100, y: 100 });
  state.shooting.cooldownRemaining = 0.17;
  contact(state);
  state.enemies.spawnRemaining = 0.01;
  state.effects.push({ x: 100, y: 100, age: 0, color: '#fff' });
  for (let i = 0; i < 10; i++) {
    restartGame(state);
    assert.equal(state.phase, 'PLAYING');
    assert.equal(state.score, 0);
    assert.equal(state.highScore, 1500);
    assert.equal(state.lives, 3);
    assert.equal(state.elapsedTime, 0);
    assert.equal(state.invulnerabilityRemaining, 0);
    assert.equal(state.shooting.cooldownRemaining, 0);
    assert.deepEqual(state.player, createPlayer(GAME_CONFIG));
    assert.deepEqual(state.enemies, createEnemyState());
    assert.deepEqual(state.shooting.bullets, []);
    assert.deepEqual(state.effects, []);
  }
});
test('en yüksek hızda ve 50 ms karede mermi düşmanı atlamaz', () => {
  const state = playing();
  state.shooting.bullets.push({ x: 300, y: 220 });
  state.enemies.enemies.push({ x: 300, y: 180, speed: 190 });
  updateGame(state, idle, 0.05);
  assert.equal(state.score, 100);
});
test('iki dakikalık simülasyonda mermi, düşman ve efektler birikmez', () => {
  const state = playing();
  for (let frame = 0; frame < 7200; frame++) {
    updateGame(state, { ...idle, shooting: true }, 1 / 60, () => 0.9);
    assert.ok(state.shooting.bullets.length < 10);
    assert.ok(state.enemies.enemies.length < 25);
    assert.ok(state.effects.length <= 40);
  }
  assert.equal(state.phase, 'PLAYING');
});
test('efektler yaşam süreleri sonunda temizlenir', () => {
  const state = playing();
  state.effects.push({ x: 100, y: 100, age: 0, color: '#fff' });
  for (let i = 0; i < 8; i++) updateGame(state, idle, 0.05);
  assert.equal(state.effects.length, 0);
});

test('simülasyon düşman üretimine güncel skoru ve zorluk sınırını uygular', () => {
  const state = playing();
  state.score = 5000;
  state.enemies.spawnRemaining = 0;
  updateGame(state, idle, 0, () => 1);
  assert.equal(state.enemies.enemies[0].speed, 190);
  assert.ok(Math.abs(state.enemies.spawnRemaining - 0.45) < 1e-6);
});

test('gemi başlangıçta sakin kalır, düşmanla aynı skor eğrisinde kademeli hızlanır', () => {
  for (const [score, speed] of [[0, 280], [1000, 302], [2500, 335], [5000, 390], [50000, 390]]) {
    const state = playing();
    state.player.x = 200;
    state.score = score;
    updateGame(state, { x: 1, y: 0, shooting: false }, 0.05);
    assert.ok(Math.abs(state.player.x - (200 + speed * 0.05)) < 1e-9);
  }
});

test('skora bağlı hız klavye ve sürüklemede aynıdır; restart başlangıç hızına döner', () => {
  const keyboard = playing(), drag = playing();
  for (const state of [keyboard, drag]) {
    state.player.x = 200;
    state.score = 5000;
  }
  updateGame(keyboard, { x: 1, y: 0, shooting: false }, 0.05);
  updateGame(drag, { x: 0, y: 0, shooting: false, targetX: 600 }, 0.05);
  assert.equal(keyboard.player.x, drag.player.x);
  assert.equal(drag.player.x, 219.5);
  restartGame(drag);
  drag.player.x = 200;
  drag.enemies.spawnRemaining = 10;
  updateGame(drag, { x: 1, y: 0, shooting: false }, 0.05);
  assert.equal(drag.player.x, 214);
  assert.equal(drag.highScore, 5000);
});
