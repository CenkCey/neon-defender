import type { Bounds } from './player.ts';
import { GAME_CONFIG } from './config.ts';

export const ENEMY_CONFIG = Object.freeze({
  width: 44,
  height: 36,
  initialSpawnDelay: 0.75,
  initialSpawnInterval: 1.35,
  minSpawnInterval: 0.45,
  initialSpeed: 70,
  maxSpeed: 190,
  difficultyScore: 5000,
});

export interface Enemy {
  x: number;
  y: number;
  speed: number;
}

export interface EnemyState {
  enemies: Enemy[];
  spawnRemaining: number;
}

export function getDifficulty(score: number) {
  const progress = Math.max(0, Math.min(1, score / ENEMY_CONFIG.difficultyScore));
  return {
    spawnInterval: ENEMY_CONFIG.initialSpawnInterval - (ENEMY_CONFIG.initialSpawnInterval - ENEMY_CONFIG.minSpawnInterval) * progress,
    speed: ENEMY_CONFIG.initialSpeed + (ENEMY_CONFIG.maxSpeed - ENEMY_CONFIG.initialSpeed) * progress,
    // Share one score curve, but cap ship acceleration independently for control.
    playerSpeed: GAME_CONFIG.initialPlayerSpeed + (GAME_CONFIG.maxPlayerSpeed - GAME_CONFIG.initialPlayerSpeed) * progress,
  };
}

export function createEnemyState(): EnemyState {
  return { enemies: [], spawnRemaining: ENEMY_CONFIG.initialSpawnDelay };
}

export function createEnemy(width: number, score: number, random = Math.random): Enemy {
  const margin = ENEMY_CONFIG.width / 2 + 10;
  return {
    x: margin + random() * (width - margin * 2),
    y: -ENEMY_CONFIG.height / 2,
    speed: getDifficulty(score).speed * (0.9 + random() * 0.1),
  };
}

export function updateEnemies(state: EnemyState, deltaTime: number, score: number, bounds: Bounds, random = Math.random) {
  for (const enemy of state.enemies) enemy.y += enemy.speed * deltaTime;
  // Escape is cleanup only: it never causes player damage.
  state.enemies = state.enemies.filter((enemy) => enemy.y - ENEMY_CONFIG.height / 2 <= bounds.height);
  state.spawnRemaining -= deltaTime;
  if (state.spawnRemaining <= 1e-9) {
    state.enemies.push(createEnemy(bounds.width, score, random));
    state.spawnRemaining = getDifficulty(score).spawnInterval;
  }
}

export function drawEnemies(context: CanvasRenderingContext2D, enemies: Enemy[]) {
  context.save();
  context.strokeStyle = '#ff7795';
  context.fillStyle = '#38182f';
  context.shadowColor = '#ff557f';
  context.shadowBlur = 9;
  context.lineWidth = 1.5;
  for (const enemy of enemies) {
    context.save();
    context.translate(enemy.x, enemy.y);
    context.beginPath();
    context.moveTo(-21, -16);
    context.lineTo(0, -9);
    context.lineTo(21, -16);
    context.lineTo(13, 6);
    context.lineTo(0, 17);
    context.lineTo(-13, 6);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = '#ffc1d1';
    context.fillRect(-3, -3, 6, 9);
    context.restore();
  }
  context.restore();
}
