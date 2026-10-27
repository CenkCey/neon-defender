import { GAME_CONFIG } from './config.ts';
import { createPlayer, updatePlayer } from './player.ts';
import type { Player, Bounds } from './player.ts';
import { createShootingState, updateShooting } from './bullets.ts';
import type { ShootingState } from './bullets.ts';
import { createEnemyState, updateEnemies, getDifficulty } from './enemies.ts';
import type { EnemyState } from './enemies.ts';
import { resolveCollisions } from './collision.ts';
import { updateEffects } from './effects.ts';
import type { HitEffect } from './effects.ts';
import type { InputState } from './input.ts';

export type GamePhase = 'MENU' | 'PLAYING' | 'GAME_OVER';

export interface GameState {
  phase: GamePhase;
  bounds: Bounds;
  player: Player;
  shooting: ShootingState;
  enemies: EnemyState;
  effects: HitEffect[];
  score: number;
  highScore: number;
  lives: number;
  invulnerabilityRemaining: number;
  elapsedTime: number;
}

export function createGameState(highScore = 0, bounds: Bounds = GAME_CONFIG): GameState {
  return {
    phase: 'MENU', bounds: { ...bounds }, player: createPlayer(bounds),
    shooting: createShootingState(), enemies: createEnemyState(), effects: [],
    score: 0, highScore, lives: GAME_CONFIG.startingLives,
    invulnerabilityRemaining: 0, elapsedTime: 0,
  };
}

export function restartGame(state: GameState) {
  Object.assign(state, createGameState(state.highScore, state.bounds), { phase: 'PLAYING' });
}

/** Preserve relative positions when the arena enters/leaves phone fullscreen. */
export function resizeGame(state: GameState, bounds: Bounds) {
  if (Math.abs(bounds.width - state.bounds.width) < 0.01 && Math.abs(bounds.height - state.bounds.height) < 0.01) return;
  const scaleX = bounds.width / state.bounds.width;
  const scaleY = bounds.height / state.bounds.height;
  for (const item of [state.player, ...state.shooting.bullets, ...state.enemies.enemies, ...state.effects]) {
    item.x *= scaleX;
    item.y *= scaleY;
  }
  state.bounds = { ...bounds };
  updatePlayer(state.player, { x: 0, y: 0 }, 0, bounds);
}

/** Browser-free simulation: rendering, storage and event listeners stay outside. */
export function updateGame(state: GameState, input: InputState, deltaTime: number, random = Math.random) {
  if (state.phase !== 'PLAYING') return;
  const dt = Math.max(0, Math.min(deltaTime, GAME_CONFIG.maxDeltaTime));
  state.elapsedTime += dt;
  state.invulnerabilityRemaining = Math.max(0, state.invulnerabilityRemaining - dt);
  state.effects = updateEffects(state.effects, dt);
  updatePlayer(state.player, input, dt, state.bounds, getDifficulty(state.score).playerSpeed);
  updateShooting(state.shooting, input.shooting, state.player, dt);
  updateEnemies(state.enemies, dt, state.score, state.bounds, random);

  const hits = resolveCollisions(state.shooting.bullets, state.enemies.enemies, state.player, state.invulnerabilityRemaining > 1e-9);
  state.shooting.bullets = hits.bullets;
  state.enemies.enemies = hits.enemies;
  state.score += hits.destroyed.length * GAME_CONFIG.pointsPerEnemy;
  state.highScore = Math.max(state.highScore, state.score);
  for (const enemy of [...hits.destroyed, ...hits.contacts]) {
    state.effects.push({ x: enemy.x, y: enemy.y, age: 0, color: '#ff87a3' });
  }
  state.effects = state.effects.slice(-40);

  if (hits.damaged) {
    state.lives = Math.max(0, state.lives - 1);
    state.invulnerabilityRemaining = GAME_CONFIG.invulnerabilitySeconds;
    if (state.lives === 0) state.phase = 'GAME_OVER';
  }
}
