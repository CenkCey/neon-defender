import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, updatePlayer, PLAYER_WIDTH, PLAYER_HEIGHT } from '../src/player.ts';

const bounds = { width: 960, height: 540 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} ≠ ${expected}`);

test('gemi başlangıçta oyun alanı içinde yer alır', () => {
  const player = createPlayer(bounds);
  assert.equal(player.x, 480);
  assert.equal(player.y, 432);
});

test('hareket mesafesi saniye cinsinden delta time kullanır', () => {
  const player = { x: 200, y: 200 };
  updatePlayer(player, { x: 1, y: 0 }, 0.25, bounds);
  near(player.x, 270);
  near(player.y, 200);
});

test('çapraz hareket düz hareketle aynı toplam hızdadır', () => {
  const diagonal = { x: 200, y: 200 };
  const straight = { x: 200, y: 200 };
  updatePlayer(diagonal, { x: 1, y: 1 }, 0.1, bounds);
  updatePlayer(straight, { x: 1, y: 0 }, 0.1, bounds);
  near(Math.hypot(diagonal.x - 200, diagonal.y - 200), straight.x - 200);
});

test('30, 60 ve 144 frame aynı sürede aynı konuma ulaşır', () => {
  for (const fps of [30, 60, 144]) {
    const player = { x: 100, y: 200 };
    for (let frame = 0; frame < fps; frame++) updatePlayer(player, { x: 1, y: 0 }, 1 / fps, bounds);
    near(player.x, 380);
  }
});

test('dört sınırda geminin tamamı oyun alanı içinde kalır', () => {
  const player = { x: 200, y: 200 };
  updatePlayer(player, { x: -1, y: 0 }, 10, bounds);
  near(player.x, PLAYER_WIDTH / 2);
  updatePlayer(player, { x: 1, y: 0 }, 10, bounds);
  near(player.x, bounds.width - PLAYER_WIDTH / 2);
  updatePlayer(player, { x: 0, y: -1 }, 10, bounds);
  near(player.y, PLAYER_HEIGHT / 2);
  updatePlayer(player, { x: 0, y: 1 }, 10, bounds);
  near(player.y, bounds.height - PLAYER_HEIGHT / 2);
});

test('yön girdisi yoksa gemi yerinde kalır', () => {
  const player = { x: 300, y: 200 };
  updatePlayer(player, { x: 0, y: 0 }, 0.5, bounds);
  assert.deepEqual(player, { x: 300, y: 200 });
});
