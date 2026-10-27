import type { SoundSink } from './audio.ts';
import { GAME_CONFIG } from './config.ts';
import { createPlayer, updatePlayer } from './player.ts';
import type { Player, Bounds } from './player.ts';
import { createShootingState, updateShooting } from './bullets.ts';
import type { ShootingState } from './bullets.ts';
import { createEnemyState, updateEnemies, getDifficulty, createActor, updateActors } from './enemies.ts';
import type { EnemyState } from './enemies.ts';
import type { Enemy } from './enemies.ts';
import { overlaps, resolveCollisions } from './collision.ts';
import { updateEffects } from './effects.ts';
import type { HitEffect } from './effects.ts';
import type { InputState } from './input.ts';
import { BOSS_CONFIGS, ENEMY_TYPES, ENEMY_BALANCE, ENDLESS_CONFIG, V2_CONFIG, pickEndlessEnemy } from './content.ts';
import type { GameMode } from './content.ts';
import { createRun, runDifficulty, bossForRun, nextWave, campaignStars, powerUpsAllowed, advanceEndlessTier, beginEndlessEncounter, finishEndlessEncounter } from './director.ts';
import type { RunState } from './director.ts';
import { createBoss, updateBoss } from './bosses.ts';
import type { Boss } from './bosses.ts';
import { updateHostileProjectiles } from './projectiles.ts';
import type { HostileProjectile } from './projectiles.ts';
import { updatePickups, dropPickup } from './powerups.ts';
import type { Pickup } from './powerups.ts';
import type { RunSummary } from './progress.ts';

export type GamePhase = 'MENU' | 'PLAYING' | 'GAME_OVER' | 'LEVEL_COMPLETE';

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
  run: RunState | null;
  boss: Boss | null;
  hostile: HostileProjectile[];
  pickups: Pickup[];
  pendingChildren: Enemy[];
  shield: boolean;
  rapidRemaining: number;
}

export function createGameState(highScore = 0, bounds: Bounds = GAME_CONFIG): GameState {
  return {
    phase: 'MENU', bounds: { ...bounds }, player: createPlayer(bounds),
    shooting: createShootingState(), enemies: createEnemyState(), effects: [],
    score: 0, highScore, lives: GAME_CONFIG.startingLives,
    invulnerabilityRemaining: 0, elapsedTime: 0,
    run: null, boss: null, hostile: [], pickups: [], pendingChildren: [], shield: false, rapidRemaining: 0,
  };
}

export function restartGame(state: GameState) {
  const run = state.run;
  Object.assign(state, createGameState(state.highScore, state.bounds), { phase: 'PLAYING' });
  if (run) state.run = createRun(run.mode, run.level);
}

export function startRun(state: GameState, mode: GameMode, level = 1, random = Math.random) {
  Object.assign(state, createGameState(state.highScore, state.bounds), { phase: 'PLAYING', run: createRun(mode, level, random) });
}

/** Preserve relative positions when the arena enters/leaves phone fullscreen. */
export function resizeGame(state: GameState, bounds: Bounds) {
  if (Math.abs(bounds.width - state.bounds.width) < 0.01 && Math.abs(bounds.height - state.bounds.height) < 0.01) return;
  const scaleX = bounds.width / state.bounds.width;
  const scaleY = bounds.height / state.bounds.height;
  for (const item of [state.player, ...state.shooting.bullets, ...state.enemies.enemies, ...state.effects, ...state.hostile, ...state.pickups, ...state.pendingChildren]) {
    item.x *= scaleX;
    item.y *= scaleY;
    if ('originX' in item && typeof item.originX === 'number') item.originX *= scaleX;
  }
  if (state.boss) {
    state.boss.x *= scaleX; state.boss.y *= scaleY;
    state.boss.targetX *= scaleX; state.boss.targetY *= scaleY; state.boss.dashTarget *= scaleX;
    // Re-plan a telegraphed volley after a viewport change instead of firing stale coordinates.
    state.boss.plan = null;
    state.boss.safeLane = null;
    if (state.boss.warning > 0) state.boss.warning = BOSS_CONFIGS[state.boss.index].telegraphDuration;
  }
  state.bounds = { ...bounds };
  updatePlayer(state.player, { x: 0, y: 0 }, 0, bounds);
}

/** Browser-free simulation: rendering, storage and event listeners stay outside. */
export function updateGame(state: GameState, input: InputState, deltaTime: number, random = Math.random, sound?: SoundSink) {
  if (state.phase !== 'PLAYING') return;
  const dt = Math.max(0, Math.min(deltaTime, GAME_CONFIG.maxDeltaTime));
  if (state.run) {
    // Small collision steps prevent fast bullets skipping the smaller children.
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let step = 0; step < steps && state.phase === 'PLAYING'; step++) updateRun(state, input, dt / steps, random, sound);
    return;
  }
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

/** All run timers are simulation time: pausing requires no pending timeout cleanup. */
function updateRun(state: GameState, input: InputState, dt: number, random: () => number, sound?: SoundSink) {
  const run = state.run!;
  state.elapsedTime += dt;
  state.invulnerabilityRemaining = Math.max(0, state.invulnerabilityRemaining - dt);
  state.rapidRemaining = Math.max(0, state.rapidRemaining - dt);
  state.effects = updateEffects(state.effects, dt);
  const difficulty = runDifficulty(run);
  const progress = Math.min(1, run.mode === 'endless' ? run.destroyed / ENDLESS_CONFIG.playerProgressKills : state.score / 5000);
  updatePlayer(state.player, input, dt, state.bounds, GAME_CONFIG.initialPlayerSpeed + (GAME_CONFIG.maxPlayerSpeed - GAME_CONFIG.initialPlayerSpeed) * progress);
  if (run.mode === 'campaign' && (run.stage === 'TRANSITION' || run.stage === 'BOSS_INTRO')) {
    run.transitionRemaining = Math.max(0, run.transitionRemaining - dt);
    if (run.transitionRemaining <= 1e-9) {
      if (run.stage === 'BOSS_INTRO') {
        state.boss = createBoss(bossForRun(run)!, state.bounds); run.stage = 'BOSS'; sound?.('bossArrival');
      } else nextWave(run);
    }
    return;
  }
  const normalCooldown = run.mode === 'endless' ? ENDLESS_CONFIG.playerInitialCooldown + (ENDLESS_CONFIG.playerMinCooldown - ENDLESS_CONFIG.playerInitialCooldown) * progress : 0.18;
  state.shooting.cooldownSeconds = state.rapidRemaining > 0 ? V2_CONFIG.rapidCooldown : normalCooldown;
  // Count fired projectiles independently from cleanup, not by array length delta.
  const canFire = input.shooting && state.shooting.cooldownRemaining - dt <= 1e-9;
  updateShooting(state.shooting, input.shooting, state.player, dt);
  if (canFire) { run.shots++; sound?.('laser'); }
  state.hostile = updateHostileProjectiles(state.hostile, dt, state.bounds);
  if (run.stage === 'WAVE' || run.mode === 'endless') {
    const firingProgress = Math.min(1, run.mode === 'endless' ? (difficulty.speedMultiplier - 1) / (ENDLESS_CONFIG.maxSpeedMultiplier - 1) : (run.level - 1) / (ENEMY_BALANCE.campaignMaxFiringLevel - 1));
    const escaped = updateActors(state.enemies.enemies, dt, state.bounds, state.hostile, firingProgress);
    run.escaped += escaped.length;
    state.enemies.enemies = state.enemies.enemies.filter(e => !escaped.includes(e));
    if (run.mode === 'endless' && escaped.length) {
      const breaches = run.breach + escaped.length;
      run.breach = breaches % 3;
      if (breaches >= 3) damagePlayer(state, sound);
    }
    if (run.mode === 'endless' && !state.boss && run.activeBossEncounter === null && run.wave >= run.nextBossTier && run.bossWarningRemaining === null) {
      run.bossWarningRemaining = V2_CONFIG.bossIntro; sound?.('bossArrival');
    }
    const encounterPressure = run.mode === 'endless' && (state.boss !== null || run.bossWarningRemaining !== null);
    const concurrentLimit = encounterPressure ? Math.min(ENDLESS_CONFIG.bossNormalLimit, difficulty.maxConcurrent) : difficulty.maxConcurrent;
    // Children share the same cap. During a boss approach, excess actors resolve naturally.
    if (state.pendingChildren.length && state.enemies.enemies.length < concurrentLimit) {
      const child = state.pendingChildren.shift()!;
      // Delay at a safe height, even if its parent died next to the player.
      child.y = Math.min(child.y, state.player.y - 100);
      state.enemies.enemies.push(child); run.spawned++;
    }
    run.spawnRemaining = Math.max(0, run.spawnRemaining - dt);
    if ((run.mode === 'endless' || run.pending.length > 0) && run.spawnRemaining <= 1e-9 && state.enemies.enemies.length < concurrentLimit && !state.pendingChildren.length) {
      const kind = run.mode === 'endless' ? pickEndlessEnemy(run.wave, random) : run.pending.shift()!;
      state.enemies.enemies.push(createActor(kind, state.bounds, difficulty.speedMultiplier, random));
      run.spawned++; run.spawnRemaining = difficulty.spawnInterval;
    }
    if (run.mode === 'endless' && run.bossWarningRemaining !== null) {
      run.bossWarningRemaining = Math.max(0, run.bossWarningRemaining - dt);
      if (run.bossWarningRemaining <= 1e-9 && !state.boss && state.enemies.enemies.length <= ENDLESS_CONFIG.bossNormalLimit) {
        const encounter = beginEndlessEncounter(run);
        state.boss = createBoss(encounter.index, state.bounds, encounter.tier);
      }
    }
  }
  if (state.boss) {
    const plan = state.boss.plan, count = state.hostile.length;
    updateBoss(state.boss, dt, state.bounds, state.player, state.hostile);
    if (state.boss.plan && state.boss.plan !== plan && !state.boss.plan.deferred) sound?.('bossWarning');
    if (state.hostile.length > count) sound?.('bossAttack');
  }
  const hits = resolveCollisions(state.shooting.bullets, state.enemies.enemies, state.player, state.invulnerabilityRemaining > 1e-9, true);
  state.shooting.bullets = hits.bullets; state.enemies.enemies = hits.enemies;
  run.hits += hits.hitCount;
  if (hits.hitCount) sound?.('hit');
  if (hits.destroyed.length) sound?.('destroy');
  for (const enemy of hits.destroyed) {
    run.destroyed++; state.score += ENEMY_TYPES[enemy.kind ?? 'S'].score;
    state.effects.push({ x: enemy.x, y: enemy.y, age: 0, color: ENEMY_TYPES[enemy.kind ?? 'S'].color });
    if (enemy.kind === 'P') {
      for (const side of [-1, 1]) {
        const child = createActor('C', state.bounds, difficulty.speedMultiplier, random);
        child.x = Math.max(24, Math.min(state.bounds.width - 24, enemy.x + side * 27));
        child.originX = child.x; child.y = Math.max(0, Math.min(enemy.y, state.player.y - 100)); child.grace = 0.7;
        state.pendingChildren.push(child);
      }
    }
    if (powerUpsAllowed(run)) dropPickup(enemy.x, enemy.y, state.bounds, state.pickups, random);
  }
  advanceEndlessTier(run);
  if (hits.damaged) damagePlayer(state, sound);
  if (state.boss) {
    const boss = state.boss, spec = BOSS_CONFIGS[boss.index];
    const remaining = [];
    for (const bullet of state.shooting.bullets) {
      if (boss.hp > 0 && overlaps({ ...bullet, width: 4, height: 14 }, { ...boss, width: spec.width - 12, height: spec.height - 10 })) {
        boss.hp--; run.hits++; sound?.('hit');
      } else remaining.push(bullet);
    }
    state.shooting.bullets = remaining;
    if (boss.hp <= 0) {
      sound?.('bossDefeat');
      state.score += spec.score; run.bossKills++; state.boss = null;
      if (run.mode === 'endless') {
        // Preserve normal projectiles and player fire; only the defeated boss is disarmed.
        state.hostile = state.hostile.filter(shot => !shot.boss);
        const heal = finishEndlessEncounter(run);
        if (heal && state.lives > 0) state.lives = Math.min(3, state.lives + 1);
      } else state.hostile = [];
    } else if (overlaps({ ...state.player, width: 30, height: 38 }, { ...boss, width: spec.width - 12, height: spec.height - 10 })) damagePlayer(state, sound);
  }
  const playerBox = { ...state.player, width: 30, height: 38 };
  state.hostile = state.hostile.filter(shot => {
    if (!overlaps(playerBox, { ...shot, width: shot.radius * 2, height: shot.radius * 2 })) return true;
    damagePlayer(state, sound); return false;
  });
  const pickupResult = updatePickups(state.pickups, dt, state.player, state.bounds);
  state.pickups = pickupResult.remaining;
  for (const kind of pickupResult.collected) {
    sound?.('pickup');
    if (kind === 'shield') state.shield = true;
    else state.rapidRemaining = V2_CONFIG.rapidDuration;
    state.effects.push({ ...state.player, age: 0, color: kind === 'shield' ? '#68e5ef' : '#ffc56e' });
  }
  state.effects = state.effects.slice(-40);
  state.highScore = Math.max(state.highScore, state.score);
  // Death wins a same-frame completion race; no progress can unlock afterward.
  if (state.lives <= 0) { finishRun(state, false, sound); return; }
  if (run.mode === 'endless') return;
  const waveClear = run.stage === 'WAVE' && !run.pending.length && !state.enemies.enemies.length && !state.pendingChildren.length;
  const bossClear = run.stage === 'BOSS' && !state.boss;
  if (waveClear || bossClear) {
    state.hostile = []; state.shooting.bullets = [];
    if (waveClear && bossForRun(run) !== null && run.wave === 3) {
      sound?.('bossArrival'); run.stage = 'BOSS_INTRO'; run.transitionRemaining = V2_CONFIG.bossIntro;
    } else if (run.mode === 'campaign' && run.wave === 3) finishRun(state, true, sound);
    else { sound?.('transition'); run.stage = 'TRANSITION'; run.transitionRemaining = V2_CONFIG.waveTransition; }
  }
}

export function damagePlayer(state: GameState, sound?: SoundSink) {
  if (state.phase !== 'PLAYING' || state.lives <= 0 || state.invulnerabilityRemaining > 1e-9) return false;
  sound?.('damage');
  if (state.shield) state.shield = false;
  else state.lives = Math.max(0, state.lives - 1);
  state.invulnerabilityRemaining = GAME_CONFIG.invulnerabilitySeconds;
  return true;
}
function finishRun(state: GameState, cleared: boolean, sound?: SoundSink) {
  const run = state.run!;
  run.stars = cleared ? campaignStars(run, state.lives) : 0;
  run.failure = state.lives <= 0 ? 'Üç canın tükendi.' : run.stars === 0 ? 'Görev için düşmanların en az %60’ını yok etmelisin.' : '';
  state.phase = cleared && run.stars > 0 ? 'LEVEL_COMPLETE' : 'GAME_OVER';
  sound?.(state.phase === 'LEVEL_COMPLETE' ? 'complete' : 'gameOver');
  run.stage = 'FINISHED'; state.hostile = []; state.shooting.bullets = []; state.pickups = [];
  state.rapidRemaining = 0; state.shield = false;
}
export function runSummary(state: GameState): RunSummary | null {
  const run = state.run;
  if (!run) return null;
  return { mode: run.mode, level: run.level, wave: run.wave, score: state.score, destroyed: run.destroyed,
    escaped: run.escaped, seconds: state.elapsedTime, accuracy: run.shots ? Math.min(1, run.hits / run.shots) : 0,
    stars: run.stars, completed: state.phase === 'LEVEL_COMPLETE' };
}
