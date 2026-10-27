/** Editable gameplay content. Counts describe a wave, never a simultaneous spawn. */
export type EnemyKind = 'S' | 'Z' | 'T' | 'H' | 'P' | 'K' | 'C';
export type GameMode = 'campaign' | 'endless';
export const ENEMY_TYPES = {
  S: { name: 'Scout', hp: 1, speed: 105, score: 100, width: 44, height: 36, color: '#ff7795' },
  Z: { name: 'Zigzag', hp: 1, speed: 115, score: 125, width: 44, height: 36, color: '#c18aff' },
  T: { name: 'Tank', hp: 4, speed: 78, score: 180, width: 48, height: 40, color: '#ffc56e' },
  H: { name: 'Shooter', hp: 2, speed: 90, score: 160, width: 44, height: 36, color: '#ff927c' },
  P: { name: 'Splitter', hp: 3, speed: 95, score: 175, width: 46, height: 38, color: '#ff7ce9' },
  K: { name: 'Striker', hp: 2, speed: 105, score: 200, width: 44, height: 36, color: '#71f1df' },
  C: { name: 'Child', hp: 1, speed: 120, score: 75, width: 26, height: 24, color: '#fda9eb' },
} as const;

export const GALAXIES = [
  { name: 'NEON FRONTIER', short: 'FRONTIER', background: '#090f1b', accent: '#68e5ef', secondary: '#ad83ff' },
  { name: 'CRIMSON NEBULA', short: 'NEBULA', background: '#1b0917', accent: '#ff88cd', secondary: '#92365f' },
  { name: 'VOID RIFT', short: 'VOID', background: '#0e0920', accent: '#89e8e6', secondary: '#7454c7' },
] as const;

export const V2_CONFIG = Object.freeze({
  waveTransition: 1.75, bossIntro: 1.25, campaignNormalTarget: 55, campaignBossPreparationTarget: 50,
  maxNormalEnemies: 7, maxHostileProjectiles: 28, maxPickups: 2,
  dropChance: 0.08, rapidDuration: 7, rapidCooldown: 0.115,
  telegraphSeconds: 0.7, killThreshold: 0.6, threeStarThreshold: 0.85,
});

export const ENEMY_BALANCE = Object.freeze({
  shooterFirstShot: 1.4, shooterInitialInterval: 2.6, shooterMinInterval: 1.8,
  shooterInitialBulletSpeed: 170, shooterMaxBulletSpeed: 210,
  strikerDashMultiplier: 3.2, strikerDashSpeedCap: 320, strikerDashDuration: 0.45,
  campaignIntroLevels: 2, campaignSpawnIntervalScale: 0.9, campaignMaxFiringLevel: 30,
});
export const ENDLESS_CONFIG = Object.freeze({
  initialKillsPerTier: 8, maxKillsPerTier: 18, tiersPerKillIncrease: 3,
  initialSpawnInterval: 1.3, minSpawnInterval: 0.8, spawnReductionPerTier: 0.03,
  speedIncreasePerTier: 0.025, maxSpeedMultiplier: 1.4,
  initialConcurrent: 4, maxConcurrent: 7, tiersPerConcurrentIncrease: 5,
  playerProgressKills: 240, playerInitialCooldown: 0.18, playerMinCooldown: 0.16,
  bossEveryTiers: 5, healEveryEncounters: 10, bossNormalLimit: 2,
});

export interface LevelConfig { level: number; galaxy: number; waves: EnemyKind[][]; bossIndex: number | null }
const recipes = [
  ['S3', 'S3', 'S2'], ['S3', 'S4', 'S4'], ['S3', 'S3 Z1', 'S2 Z3'],
  ['S4', 'S3 Z2', 'S2 Z4'], ['S3 Z1', 'S3 Z2', 'S2 Z2'],
  ['S3 T1', 'S3 T2', 'S2 Z2 T2'], ['S3 H1', 'Z3 H1', 'S3 T1 H2'],
  ['S3 Z2', 'T2 H2 Z1', 'S3 T2 H2'], ['S4 Z3', 'T2 H2 Z2', 'S3 Z3 T2 H2'],
  ['S3 Z2', 'T2 H1 Z1', 'S3 T1 Z2 H1'],
  ['S3 P1', 'S3 P2', 'Z2 P2 S2'], ['Z3 P2', 'S2 T2 P2', 'S3 Z2 P3'],
  ['S4 P2', 'Z3 P2', 'T2 S2 P3'], ['Z3 H2', 'P2 T2 H2', 'Z3 H2 P2'],
  ['S3 P1', 'H2 Z2 P1', 'T1 P2 Z2'], ['S3 Z3 P2', 'T2 P2 H2', 'S3 Z3 T2 H2'],
  ['P3 S2', 'Z4 H2 P2', 'T2 H3 P2'], ['S4 H3', 'P3 T2 Z2', 'Z4 H3 P2'],
  ['P3 Z3 H2', 'T3 P3', 'Z4 S3 H3 P2'], ['S3 P2', 'Z3 H2', 'T2 P2 H2'],
  ['S3 K1', 'Z2 K1 S2', 'T1 K2 Z2'], ['K2 S3', 'H2 K2 Z2', 'T2 K2 S2'],
  ['P2 K2', 'Z3 H2 K2', 'T2 P2 K2'], ['S3 H2 K2', 'Z3 P2 K2', 'T2 H2 P2 K2'],
  ['S3 K2', 'H2 P2 K1', 'T2 Z2 K2'], ['S3 Z3 K2', 'T2 P2 H2', 'K3 H2 Z2 P2'],
  ['P3 K2 H2', 'T3 Z3', 'K3 S3 H3'], ['Z4 K3', 'P3 H3 T2', 'S3 Z3 K2 T2'],
  ['H3 P3 K2', 'T3 Z4 K2', 'S4 Z3 T2 H2 P2 K2'], ['S3 Z2 K1', 'T2 H2 P1', 'Z3 K2 P2'],
];

export function parseWave(recipe: string): EnemyKind[] {
  const groups = recipe.split(' ').map(part => ({ kind: part[0] as EnemyKind, count: Number(part.slice(1)) }));
  const wave: EnemyKind[] = [];
  // Interleave groups so new threats are introduced among familiar enemies.
  while (groups.some(group => group.count > 0)) {
    for (const group of groups) if (group.count-- > 0) wave.push(group.kind);
  }
  return wave;
}
export const LEVELS: LevelConfig[] = recipes.map((waves, index) => ({
  level: index + 1, galaxy: Math.floor(index / 10), waves: waves.map(parseWave),
  bossIndex: (index + 1) % 5 === 0 ? (index + 1) / 5 - 1 : null,
}));

export const BOSS_CONFIGS = [
  { name: 'Sentinel', hp: 32, movement: 0.65, moveSpeed: 100, maxMoveSpeed: 110, firePattern: 'sentinel', fireCooldown: 1.55, telegraphDuration: 0.7, phaseThresholds: [], projectileSpeed: 170, score: 1000, maxProjectiles: 10, width: 100, height: 64 },
  { name: 'Guardian', hp: 60, movement: 0.75, moveSpeed: 115, maxMoveSpeed: 125, firePattern: 'guardian', fireCooldown: 1.55, telegraphDuration: 0.75, phaseThresholds: [0.55], projectileSpeed: 180, score: 1500, maxProjectiles: 14, width: 114, height: 68 },
  { name: 'Crimson Hunter', hp: 52, movement: 0.95, moveSpeed: 125, maxMoveSpeed: 140, firePattern: 'hunter', fireCooldown: 1.4, telegraphDuration: 0.8, phaseThresholds: [0.6, 0.3], projectileSpeed: 195, score: 1000, maxProjectiles: 14, width: 106, height: 64 },
  { name: 'Nebula Core', hp: 85, movement: 0.6, moveSpeed: 110, maxMoveSpeed: 125, firePattern: 'core', fireCooldown: 1.75, telegraphDuration: 0.85, phaseThresholds: [0.6, 0.3], projectileSpeed: 175, score: 1500, maxProjectiles: 18, width: 116, height: 76 },
  { name: 'Rift Stalker', hp: 76, movement: 0.85, moveSpeed: 135, maxMoveSpeed: 145, firePattern: 'stalker', fireCooldown: 1.5, telegraphDuration: 0.8, phaseThresholds: [0.6, 0.3], projectileSpeed: 190, score: 1000, maxProjectiles: 16, width: 108, height: 64 },
  { name: 'Void Overlord', hp: 130, movement: 0.8, moveSpeed: 145, maxMoveSpeed: 145, firePattern: 'overlord', fireCooldown: 1.65, telegraphDuration: 0.9, phaseThresholds: [0.7, 0.35], projectileSpeed: 185, score: 1500, maxProjectiles: 22, width: 124, height: 78 },
] as const;

export const BOSS_BALANCE = Object.freeze({
  initialCooldown: 1.2, phaseCooldownReduction: 0.16, minCooldown: 1,
  phaseMoveIncrease: 8, phaseProjectileIncrease: 15, maxProjectileSpeed: 220,
  safeGapWidth: 110, gapShift: 120, gapPadding: 10, maxShotAngle: 0.65,
  dashSpeed: 280, phaseDashIncrease: 10, dashDuration: 0.55,
});

export function endlessDifficulty(tier: number, progress = 0) {
  const t = Math.max(1, Math.floor(tier)) + Math.max(0, Math.min(1, progress));
  return { speedMultiplier: Math.min(ENDLESS_CONFIG.maxSpeedMultiplier, 1 + ENDLESS_CONFIG.speedIncreasePerTier * (t - 1)),
    spawnInterval: Math.max(ENDLESS_CONFIG.minSpawnInterval, ENDLESS_CONFIG.initialSpawnInterval - ENDLESS_CONFIG.spawnReductionPerTier * (t - 1)),
    maxConcurrent: Math.min(ENDLESS_CONFIG.maxConcurrent, ENDLESS_CONFIG.initialConcurrent + Math.floor((t - 1) / ENDLESS_CONFIG.tiersPerConcurrentIncrease)) };
}
export function galaxyForWave(wave: number) { return Math.floor((Math.max(1, wave) - 1) / 10) % 3; }
export function pickEndlessEnemy(tier: number, random = Math.random): EnemyKind {
  const pool: EnemyKind[] = ['S'];
  if (tier >= 3) pool.push('Z');
  if (tier >= 6) pool.push('T');
  if (tier >= 7) pool.push('H');
  if (tier >= 11) pool.push('P');
  if (tier >= 21) pool.push('K');
  return pool[Math.max(0, Math.min(pool.length - 1, Math.floor(random() * pool.length)))];
}
