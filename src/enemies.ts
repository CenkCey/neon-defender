import type { Bounds } from './player.ts';
import { GAME_CONFIG } from './config.ts';
import { ENEMY_TYPES, ENEMY_BALANCE, V2_CONFIG } from './content.ts';
import type { EnemyKind } from './content.ts';
import type { HostileProjectile } from './projectiles.ts';

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
  kind?: EnemyKind;
  hp?: number;
  maxHp?: number;
  age?: number;
  originX?: number;
  fireRemaining?: number;
  warning?: number;
  dashRemaining?: number;
  grace?: number;
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
    const kind = enemy.kind ?? 'S';
    const spec = ENEMY_TYPES[kind];
    context.strokeStyle = spec.color;
    context.shadowColor = spec.color;
    if (kind === 'C') context.scale(0.59, 0.67);
    if (kind === 'T') context.scale(1.08, 1.1);
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
    if (kind === 'T') context.strokeRect(-16, -12, 32, 26);
    if (kind === 'H') { context.fillStyle = spec.color; context.fillRect(-10, 12, 4, 8); context.fillRect(6, 12, 4, 8); }
    if (kind === 'P') { context.beginPath(); context.moveTo(-9, -14); context.lineTo(-9, 14); context.moveTo(9, -14); context.lineTo(9, 14); context.stroke(); }
    if (kind === 'Z') { context.beginPath(); context.moveTo(-10, -8); context.lineTo(6, 0); context.lineTo(-6, 8); context.stroke(); }
    if (kind === 'K' && (enemy.warning ?? 0) > 0) {
      context.setLineDash([6, 5]); context.globalAlpha = 0.65;
      context.beginPath(); context.moveTo(0, 22); context.lineTo(0, 155); context.stroke();
    }
    if (kind === 'H' && (enemy.fireRemaining ?? 5) < 0.7) {
      context.beginPath(); context.arc(0, 21, 7, 0, Math.PI * 2); context.stroke();
    }
    if ((enemy.maxHp ?? 1) > 1) {
      context.shadowBlur = 0; context.fillStyle = '#334052'; context.fillRect(-18, -24, 36, 3);
      context.fillStyle = spec.color; context.fillRect(-18, -24, 36 * Math.max(0, enemy.hp ?? 1) / (enemy.maxHp ?? 1), 3);
    }
    context.restore();
  }
  context.restore();
}

export function enemySize(enemy: Enemy) {
  const spec = ENEMY_TYPES[enemy.kind ?? 'S'];
  return { width: spec.width - 4, height: spec.height - 4 };
}
export function createActor(kind: EnemyKind, bounds: Bounds, multiplier: number, random = Math.random): Enemy {
  const spec = ENEMY_TYPES[kind], margin = spec.width / 2 + 14;
  const x = margin + Math.max(0, bounds.width - margin * 2) * Math.max(0, Math.min(1, random()));
  return { x, y: -spec.height / 2, speed: spec.speed * multiplier * (0.94 + random() * 0.06),
    kind, hp: spec.hp, maxHp: spec.hp, age: 0, originX: x, fireRemaining: ENEMY_BALANCE.shooterFirstShot, warning: 0, dashRemaining: 0, grace: 0 };
}
/** Movement/AI shared by Campaign and Endless; the director owns spawning. */
export function updateActors(enemies: Enemy[], dt: number, bounds: Bounds, shots: HostileProjectile[], firingProgress = 0) {
  const pressure = Math.max(0, Math.min(1, firingProgress));
  for (const enemy of enemies) {
    const kind = enemy.kind ?? 'S';
    enemy.age = (enemy.age ?? 0) + dt;
    enemy.grace = Math.max(0, (enemy.grace ?? 0) - dt);
    let speed = enemy.speed;
    if (kind === 'K') {
      if ((enemy.dashRemaining ?? 0) > 0) { speed = Math.min(ENEMY_BALANCE.strikerDashSpeedCap, speed * ENEMY_BALANCE.strikerDashMultiplier); enemy.dashRemaining = Math.max(0, enemy.dashRemaining! - dt); }
      else if ((enemy.warning ?? 0) > 0) {
        speed *= 0.15; enemy.warning = Math.max(0, enemy.warning! - dt);
        if (enemy.warning <= 1e-9) { enemy.dashRemaining = ENEMY_BALANCE.strikerDashDuration; enemy.age = 0; }
      } else if (enemy.age >= 1.4 && enemy.y > 0) enemy.warning = V2_CONFIG.telegraphSeconds;
    }
    enemy.y += speed * dt * ((enemy.grace ?? 0) > 0 ? 0.35 : 1);
    if (kind === 'Z' || kind === 'C') {
      const amplitude = kind === 'C' ? 20 : Math.min(55, bounds.width * 0.1);
      enemy.x = (enemy.originX ?? enemy.x) + Math.sin(enemy.age * 2.2) * amplitude;
    }
    const half = ENEMY_TYPES[kind].width / 2;
    enemy.x = Math.max(half + 5, Math.min(bounds.width - half - 5, enemy.x));
    if (kind === 'H') {
      enemy.fireRemaining = (enemy.fireRemaining ?? ENEMY_BALANCE.shooterFirstShot) - dt;
      if (enemy.fireRemaining <= 1e-9 && enemy.y > 0 && enemy.y < bounds.height * 0.62) {
        const bulletSpeed = ENEMY_BALANCE.shooterInitialBulletSpeed + (ENEMY_BALANCE.shooterMaxBulletSpeed - ENEMY_BALANCE.shooterInitialBulletSpeed) * pressure;
        if (shots.length < V2_CONFIG.maxHostileProjectiles) shots.push({ x: enemy.x, y: enemy.y + 24, vx: 0, vy: bulletSpeed, radius: 5, boss: false });
        enemy.fireRemaining = ENEMY_BALANCE.shooterInitialInterval + (ENEMY_BALANCE.shooterMinInterval - ENEMY_BALANCE.shooterInitialInterval) * pressure;
      }
    }
  }
  return enemies.filter(enemy => enemy.y - ENEMY_TYPES[enemy.kind ?? 'S'].height / 2 > bounds.height);
}
