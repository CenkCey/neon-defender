import { LEVELS, V2_CONFIG, ENEMY_BALANCE, ENDLESS_CONFIG, endlessDifficulty, galaxyForWave } from './content.ts';
import type { EnemyKind, GameMode } from './content.ts';

export interface RunState {
  mode: GameMode; level: number; wave: number; galaxy: number;
  stage: 'WAVE' | 'TRANSITION' | 'BOSS_INTRO' | 'BOSS' | 'FINISHED';
  pending: EnemyKind[]; spawnRemaining: number; transitionRemaining: number;
  spawned: number; destroyed: number; escaped: number; shots: number; hits: number;
  breach: number; bossKills: number; stars: number; failure: string;
  recorded: boolean; newRecord: boolean;
  tierStartKills: number; nextTierKills: number;
  nextBossTier: number; encountersStarted: number; activeBossEncounter: number | null;
  rewardedBossEncounter: number; bossWarningRemaining: number | null;
}
export function createRun(mode: GameMode, level = 1, _random = Math.random): RunState {
  const safeLevel = Math.max(1, Math.min(30, Math.floor(level)));
  return { mode, level: safeLevel, wave: 1, galaxy: mode === 'campaign' ? LEVELS[safeLevel - 1].galaxy : 0,
    stage: 'WAVE', pending: mode === 'campaign' ? [...LEVELS[safeLevel - 1].waves[0]] : [],
    spawnRemaining: 0.75, transitionRemaining: 0, spawned: 0, destroyed: 0, escaped: 0,
    shots: 0, hits: 0, breach: 0, bossKills: 0, stars: 0, failure: '', recorded: false, newRecord: false,
    tierStartKills: 0, nextTierKills: killsForTier(1), nextBossTier: ENDLESS_CONFIG.bossEveryTiers,
    encountersStarted: 0, activeBossEncounter: null, rewardedBossEncounter: 0, bossWarningRemaining: null };
}
export function runDifficulty(run: RunState) {
  if (run.mode === 'endless') return endlessDifficulty(run.wave, tierProgress(run));
  const level = LEVELS[run.level - 1];
  const gaps = Math.max(1, level.waves.flat().length - 3);
  const target = level.bossIndex === null ? V2_CONFIG.campaignNormalTarget : V2_CONFIG.campaignBossPreparationTarget;
  return { speedMultiplier: 1 + Math.min(0.28, (run.level - 1) * 0.009),
    spawnInterval: Math.max(1.4, Math.min(8, (target - 10) / gaps) * (run.level <= ENEMY_BALANCE.campaignIntroLevels ? 1 : ENEMY_BALANCE.campaignSpawnIntervalScale)),
    maxConcurrent: run.level <= ENEMY_BALANCE.campaignIntroLevels ? 3 : Math.min(7, 4 + Math.floor((run.level - 3) / 5)) };
}
export function bossForRun(run: RunState): number | null {
  return run.mode === 'campaign' ? LEVELS[run.level - 1].bossIndex : run.wave % 5 === 0 ? (run.wave / 5 - 1) % 6 : null;
}
export function powerUpsAllowed(run: RunState) { return run.mode === 'campaign' ? run.level >= 6 : run.wave >= 4; }
export function killRatio(run: RunState) { const count = run.destroyed + run.escaped; return count > 0 ? run.destroyed / count : 0; }
export function campaignStars(run: RunState, hp: number) {
  if (hp <= 0 || killRatio(run) + 1e-9 < V2_CONFIG.killThreshold) return 0;
  return hp >= 3 && killRatio(run) + 1e-9 >= V2_CONFIG.threeStarThreshold ? 3 : hp >= 2 ? 2 : 1;
}
export function nextWave(run: RunState) {
  if (run.mode !== 'campaign') return;
  run.wave++;
  run.galaxy = LEVELS[run.level - 1].galaxy;
  run.pending = [...LEVELS[run.level - 1].waves[run.wave - 1]];
  run.stage = 'WAVE'; run.spawnRemaining = 0.5;
}

export function killsForTier(tier: number) {
  return Math.min(ENDLESS_CONFIG.maxKillsPerTier, ENDLESS_CONFIG.initialKillsPerTier + Math.floor((Math.max(1, tier) - 1) / ENDLESS_CONFIG.tiersPerKillIncrease));
}
export function tierProgress(run: RunState) {
  return Math.max(0, Math.min(1, (run.destroyed - run.tierStartKills) / killsForTier(run.wave)));
}
/** Tier changes never reset actors, projectiles, spawn clocks or encounter identity. */
export function advanceEndlessTier(run: RunState) {
  if (run.mode !== 'endless') return;
  while (run.destroyed >= run.nextTierKills) {
    run.tierStartKills = run.nextTierKills;
    run.wave++;
    run.nextTierKills += killsForTier(run.wave);
  }
  run.galaxy = galaxyForWave(run.wave);
}
export function beginEndlessEncounter(run: RunState) {
  const tier = run.nextBossTier;
  run.encountersStarted++;
  run.activeBossEncounter = run.encountersStarted;
  run.nextBossTier += ENDLESS_CONFIG.bossEveryTiers;
  run.bossWarningRemaining = null;
  return { index: (run.encountersStarted - 1) % 6, tier };
}
export function finishEndlessEncounter(run: RunState) {
  const encounter = run.activeBossEncounter;
  run.activeBossEncounter = null;
  if (encounter === null || encounter % ENDLESS_CONFIG.healEveryEncounters !== 0 || encounter <= run.rewardedBossEncounter) return false;
  run.rewardedBossEncounter = encounter;
  return true;
}
