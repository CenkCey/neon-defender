export const HIGH_SCORE_KEY = 'neon-defender.high-score.v1';
type ScoreStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Storage failures must never interrupt a game or lose the in-memory best. */
export function createHighScoreStore(storage?: ScoreStorage) {
  let available = Boolean(storage);
  let best = 0;
  let raw: string | null = null;
  try { raw = storage?.getItem(HIGH_SCORE_KEY) ?? null; }
  catch { available = false; }
  if (raw !== null) {
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) best = value;
    } catch { /* Ignore malformed data; the next record replaces it. */ }
  }

  return {
    get value() { return best; },
    get available() { return available; },
    record(score: number) {
      if (!Number.isSafeInteger(score) || score <= best) return;
      best = score;
      if (!available) return;
      try { storage?.setItem(HIGH_SCORE_KEY, String(best)); }
      catch { available = false; }
    },
  };
}
