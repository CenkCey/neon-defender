import { HIGH_SCORE_KEY } from './high-score.ts';
import type { GameMode } from './content.ts';

export const SAVE_KEY = 'neon-defender.progress.v2';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export interface RunSummary {
  mode: GameMode; level: number; wave: number; score: number; destroyed: number;
  escaped: number; seconds: number; accuracy: number; stars: number; completed: boolean;
}
export interface Progress {
  schemaVersion: 1;
  settings: { controlMode: 'drag' | 'tilt'; soundEnabled: boolean; tiltCalibration: number | null };
  campaign: { highestUnlockedLevel: number; completedLevels: number[]; starsByLevel: Record<string, number>; bestScoreByLevel: Record<string, number> };
  endless: { bestScore: number; highestWave: number; longestSurvivalSeconds: number; totalEnemiesDestroyed: number; lastRunSummary: RunSummary | null };
}
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? Math.min(max, v) : 0;
const seconds = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
export function defaultProgress(): Progress {
  return { schemaVersion: 1, settings: { controlMode: 'drag', soundEnabled: false, tiltCalibration: null },
    campaign: { highestUnlockedLevel: 1, completedLevels: [], starsByLevel: {}, bestScoreByLevel: {} },
    endless: { bestScore: 0, highestWave: 0, longestSurvivalSeconds: 0, totalEnemiesDestroyed: 0, lastRunSummary: null } };
}
export function normalizeProgress(raw: unknown): Progress {
  const data = object(raw), settings = object(data.settings), campaign = object(data.campaign), endless = object(data.endless);
  const result = defaultProgress();
  result.settings.controlMode = settings.controlMode === 'tilt' || settings.controlMode === 'tilt_tap' ? 'tilt' : 'drag';
  result.settings.soundEnabled = settings.soundEnabled === true;
  result.settings.tiltCalibration = typeof settings.tiltCalibration === 'number' && Number.isFinite(settings.tiltCalibration) ? settings.tiltCalibration : null;
  const stars = object(campaign.starsByLevel), scores = object(campaign.bestScoreByLevel);
  const completed = new Set(Array.isArray(campaign.completedLevels) ? campaign.completedLevels.filter(v => Number.isInteger(v) && v >= 1 && v <= 30) : []);
  for (let level = 1; level <= 30; level++) {
    const star = integer(stars[level], 3);
    if (star > 0) completed.add(level);
    if (completed.has(level)) result.campaign.starsByLevel[level] = Math.max(1, star);
    if (integer(scores[level])) result.campaign.bestScoreByLevel[level] = integer(scores[level]);
  }
  result.campaign.completedLevels = [...completed].sort((a, b) => a - b);
  result.campaign.highestUnlockedLevel = Math.max(1, integer(campaign.highestUnlockedLevel, 30), ...[...completed].map(v => Math.min(30, v + 1)));
  result.endless.bestScore = integer(endless.bestScore);
  result.endless.highestWave = integer(endless.highestWave);
  result.endless.longestSurvivalSeconds = seconds(endless.longestSurvivalSeconds);
  result.endless.totalEnemiesDestroyed = integer(endless.totalEnemiesDestroyed);
  const last = object(endless.lastRunSummary);
  if (last.mode === 'endless') result.endless.lastRunSummary = {
    mode: 'endless', level: 1, wave: Math.max(1, integer(last.wave)), score: integer(last.score), destroyed: integer(last.destroyed),
    escaped: integer(last.escaped), seconds: seconds(last.seconds), accuracy: Math.min(1, seconds(last.accuracy)), stars: 0, completed: false,
  };
  return result;
}

export function createProgressStore(storage?: StorageLike) {
  let available = Boolean(storage), value = defaultProgress();
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (raw) value = normalizeProgress(JSON.parse(raw));
  } catch { /* Bad content is recovered; a later successful write repairs it. */ }
  // Import v1 data without removing its keys or erasing any newer records.
  try {
    const oldScore = Number(storage?.getItem(HIGH_SCORE_KEY));
    value.endless.bestScore = Math.max(value.endless.bestScore, integer(oldScore));
    const mode = storage?.getItem('neon-defender.controls.v1');
    if (!storage?.getItem(SAVE_KEY) && mode === 'tilt') value.settings.controlMode = 'tilt';
  } catch { available = false; }
  function persist() {
    if (!available) return;
    try { storage?.setItem(SAVE_KEY, JSON.stringify(value)); }
    catch { available = false; }
  }
  return {
    get value() { return value; }, get available() { return available; },
    settings(patch: Partial<Progress['settings']>) {
      if (Object.entries(patch).every(([key, v]) => value.settings[key as keyof Progress['settings']] === v)) return;
      value.settings = normalizeProgress({ ...value, settings: { ...value.settings, ...patch } }).settings;
      persist();
    },
    finish(summary: RunSummary) {
      let newRecord = false;
      if (summary.mode === 'campaign') {
        if (summary.completed && summary.stars >= 1 && summary.level >= 1 && summary.level <= value.campaign.highestUnlockedLevel) {
          const level = summary.level;
          value.campaign.starsByLevel[level] = Math.max(value.campaign.starsByLevel[level] ?? 0, Math.min(3, summary.stars));
          value.campaign.bestScoreByLevel[level] = Math.max(value.campaign.bestScoreByLevel[level] ?? 0, summary.score);
          if (!value.campaign.completedLevels.includes(level)) value.campaign.completedLevels.push(level);
          value.campaign.completedLevels.sort((a, b) => a - b);
          value.campaign.highestUnlockedLevel = Math.min(30, Math.max(value.campaign.highestUnlockedLevel, level + 1));
        }
      } else {
        const record = value.endless;
        newRecord = summary.score > record.bestScore || summary.wave > record.highestWave || summary.seconds > record.longestSurvivalSeconds;
        record.bestScore = Math.max(record.bestScore, summary.score);
        record.highestWave = Math.max(record.highestWave, summary.wave);
        record.longestSurvivalSeconds = Math.max(record.longestSurvivalSeconds, summary.seconds);
        record.totalEnemiesDestroyed += summary.destroyed;
        record.lastRunSummary = { ...summary };
      }
      persist();
      return newRecord;
    },
  };
}
export type ProgressStore = ReturnType<typeof createProgressStore>;
