import { PLAYER_HEIGHT } from './player.ts';
import type { Player } from './player.ts';

export const SHOOTING_COOLDOWN = 0.18; // Seconds between shots; 180 ms by default.
export const BULLET_SPEED = 640; // Logical pixels per second.
export const BULLET_WIDTH = 4;
export const BULLET_HEIGHT = 14;

export interface Bullet {
  x: number;
  y: number;
}

export interface ShootingState {
  bullets: Bullet[];
  cooldownSeconds: number;
  cooldownRemaining: number;
}

export function createShootingState(cooldownSeconds = SHOOTING_COOLDOWN): ShootingState {
  return { bullets: [], cooldownSeconds, cooldownRemaining: 0 };
}

export function updateShooting(state: ShootingState, shooting: boolean, player: Player, deltaTime: number) {
  // Move existing projectiles first; a new shot starts exactly at the muzzle.
  for (const bullet of state.bullets) bullet.y -= BULLET_SPEED * deltaTime;
  state.bullets = state.bullets.filter((bullet) => bullet.y + BULLET_HEIGHT / 2 >= 0);

  state.cooldownRemaining = Math.max(0, state.cooldownRemaining - deltaTime);
  if (!shooting || state.cooldownRemaining > 1e-9) return;

  state.bullets.push({
    x: player.x,
    y: player.y - PLAYER_HEIGHT / 2 - BULLET_HEIGHT / 2,
  });
  // One shot per update; a delayed frame never creates a catch-up burst.
  state.cooldownRemaining = state.cooldownSeconds;
}

export function drawBullets(context: CanvasRenderingContext2D, bullets: Bullet[]) {
  context.save();
  context.fillStyle = '#bafaff';
  context.shadowColor = '#68e5ef';
  context.shadowBlur = 12;
  for (const bullet of bullets) {
    context.fillRect(bullet.x - BULLET_WIDTH / 2, bullet.y - BULLET_HEIGHT / 2, BULLET_WIDTH, BULLET_HEIGHT);
  }
  context.restore();
}
