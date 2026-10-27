import test from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, resolveCollisions } from '../src/collision.ts';

const player = { x: 480, y: 432 };
const enemy = (x = 300, y = 200) => ({ x, y, speed: 0 });

test('AABB gerçek örtüşmeyi yakalar; yalnızca değen kenarlar çarpışmaz', () => {
  const box = { x: 0, y: 0, width: 10, height: 10 };
  assert.equal(overlaps(box, { ...box, x: 9 }), true);
  assert.equal(overlaps(box, { ...box, x: 10 }), false);
  assert.equal(overlaps(box, { ...box, y: 20 }), false);
});
test('aynı düşmana çarpan iki mermi tek ölüm ve tek puan olayı üretir', () => {
  const result = resolveCollisions([{ x: 300, y: 200 }, { x: 300, y: 200 }], [enemy()], player, false);
  assert.equal(result.destroyed.length, 1);
  assert.equal(result.enemies.length, 0);
  assert.equal(result.bullets.length, 1);
});
test('bir mermi üst üste duran iki düşmandan yalnızca birini vurur', () => {
  const result = resolveCollisions([{ x: 300, y: 200 }], [enemy(), enemy()], player, false);
  assert.equal(result.destroyed.length, 1);
  assert.equal(result.enemies.length, 1);
  assert.equal(result.bullets.length, 0);
});
test('dizi işlenirken ardışık çarpışmalar atlanmaz ve giriş dizileri değiştirilmez', () => {
  const enemies = [enemy(200), enemy(400), enemy(600)];
  const bullets = enemies.map(({ x, y }) => ({ x, y }));
  const result = resolveCollisions(bullets, enemies, player, false);
  assert.equal(result.destroyed.length, 3);
  assert.equal(result.bullets.length, 0);
  assert.equal(enemies.length, 3);
  assert.equal(bullets.length, 3);
});
test('aynı karedeki oyuncu temasları tek hasar üretir; dokunulan tüm düşmanlar silinir', () => {
  const result = resolveCollisions([], [enemy(480, 432), enemy(481, 432)], player, false);
  assert.equal(result.damaged, true);
  assert.equal(result.contacts.length, 2);
  assert.equal(result.enemies.length, 0);
});
test('koruma varken düşman silinir, oyuncu hasar almaz', () => {
  const result = resolveCollisions([], [enemy(480, 432)], player, true);
  assert.equal(result.damaged, false);
  assert.equal(result.enemies.length, 0);
});
test('aynı karede mermiyle vurulan düşman oyuncuya hasar vermez', () => {
  const result = resolveCollisions([{ x: 480, y: 432 }], [enemy(480, 432)], player, false);
  assert.equal(result.destroyed.length, 1);
  assert.equal(result.damaged, false);
});
