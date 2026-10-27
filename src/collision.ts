import { BULLET_WIDTH, BULLET_HEIGHT } from './bullets.ts';
import type { Bullet } from './bullets.ts';
import { ENEMY_CONFIG } from './enemies.ts';
import type { Enemy } from './enemies.ts';
import { PLAYER_WIDTH, PLAYER_HEIGHT } from './player.ts';
import type { Player } from './player.ts';

interface Rectangle { x: number; y: number; width: number; height: number }

/** Rectangles use center coordinates, like the existing player and bullets. */
export function overlaps(a: Rectangle, b: Rectangle): boolean {
  return Math.abs(a.x - b.x) * 2 < a.width + b.width && Math.abs(a.y - b.y) * 2 < a.height + b.height;
}

export function resolveCollisions(bullets: Bullet[], enemies: Enemy[], player: Player, invulnerable: boolean) {
  const usedBullets = new Set<number>();
  const removedEnemies = new Set<number>();
  const destroyed: Enemy[] = [];
  const contacts: Enemy[] = [];
  const enemyBox = (enemy: Enemy) => ({ ...enemy, width: ENEMY_CONFIG.width - 4, height: ENEMY_CONFIG.height - 4 });

  for (let bulletIndex = 0; bulletIndex < bullets.length; bulletIndex++) {
    const bulletBox = { ...bullets[bulletIndex], width: BULLET_WIDTH, height: BULLET_HEIGHT };
    const enemyIndex = enemies.findIndex((enemy, index) => !removedEnemies.has(index) && overlaps(bulletBox, enemyBox(enemy)));
    if (enemyIndex === -1) continue;
    usedBullets.add(bulletIndex);
    removedEnemies.add(enemyIndex);
    destroyed.push(enemies[enemyIndex]);
  }

  // Slightly inset hitboxes avoid punishing transparent corners of the ships.
  const playerBox = { ...player, width: PLAYER_WIDTH - 14, height: PLAYER_HEIGHT - 18 };
  enemies.forEach((enemy, index) => {
    if (removedEnemies.has(index) || !overlaps(playerBox, enemyBox(enemy))) return;
    removedEnemies.add(index);
    contacts.push(enemy);
  });

  return {
    bullets: bullets.filter((_, index) => !usedBullets.has(index)),
    enemies: enemies.filter((_, index) => !removedEnemies.has(index)),
    destroyed,
    contacts,
    damaged: !invulnerable && contacts.length > 0,
  };
}
