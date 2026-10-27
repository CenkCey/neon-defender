import { GAME_CONFIG } from './config.ts';
import type { Bounds } from './player.ts';

/** Match the visible arena without stretching ships or changing desktop scale. */
export function getWorldBounds(width: number, height: number, immersive: boolean): Bounds {
  if (!immersive || width <= 0 || height <= 0) return { width: GAME_CONFIG.width, height: GAME_CONFIG.height };
  const scale = 540 / Math.min(width, height);
  return { width: width * scale, height: height * scale };
}
