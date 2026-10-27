import type { SoundSink } from './audio.ts';
import { createInput, mergeInput } from './input.ts';
import { createMobileControls } from './mobile-controls.ts';
import type { MobileElements } from './mobile-controls.ts';
import { drawBullets } from './bullets.ts';
import { drawPlayer } from './player.ts';
import { drawEnemies } from './enemies.ts';
import { GAME_CONFIG } from './config.ts';
import { drawEffects } from './effects.ts';
import { createGameState, restartGame, resizeGame, updateGame, startRun, runSummary } from './world.ts';
import type { GameState } from './world.ts';
import type { ProgressStore } from './progress.ts';
import { watchNativePause, isNativeApp } from './native.ts';
import { getWorldBounds } from './viewport.ts';
import { BOSS_CONFIGS } from './content.ts';
import type { GameMode } from './content.ts';
import { drawBoss } from './bosses.ts';
import { drawHostileProjectiles } from './projectiles.ts';
import { drawPickups } from './powerups.ts';
import { createTheme } from './themes.ts';

/** Start one animation loop and return its complete cleanup function. */
export function startGame(canvas: HTMLCanvasElement, onChange: (state: GameState, paused: boolean) => void, progress: ProgressStore, mobileElements: MobileElements, feedback?: { sound: SoundSink; suspend: () => void }) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tarayıcınızda Canvas 2D kullanılamıyor.');

  const state = createGameState(progress.value.endless.bestScore);
  const input = createInput(canvas, () => {
    if (!state.run || state.phase === 'LEVEL_COMPLETE' || state.phase === 'PLAYING') return false;
    retry();
    return true;
  });
  const mobile = createMobileControls(canvas, () => state.player, mobileElements, () => state.bounds, {
    calibration: progress.value.settings.tiltCalibration,
    onCalibration: angle => progress.settings({ tiltCalibration: angle }),
    onMode: mode => progress.settings({ controlMode: mode }),
  });
  const mobileScreen = window.matchMedia('(pointer: coarse), (max-width: 760px)');
  const stars = Array.from({ length: 85 }, (_, index) => ({
    x: ((index * 137 + 47) % GAME_CONFIG.width) / GAME_CONFIG.width,
    y: ((index * 89 + 23) % GAME_CONFIG.height) / GAME_CONFIG.height,
    radius: index % 7 === 0 ? 1.2 : 0.65,
    opacity: 0.2 + (index % 5) * 0.1,
  }));

  let frameId = 0;
  let previousTime: number | null = null;
  let visualTime = 0;
  let disposed = false;
  let windowFocused = document.hasFocus();
  let nativePaused = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const theme = createTheme();
  let palette = theme.update(0, 0);

  function begin() {
    if (disposed) return;
    if (state.phase !== 'PLAYING') return;
    input.clear();
    mobile.clear();
    previousTime = null;
    nativePaused = false;
    onChange(state, false);
    feedback?.sound('start');
    resize();
    canvas.focus({ preventScroll: true });
    windowFocused = document.hasFocus();
  }
  function start(mode: GameMode, level = 1) {
    if (disposed) return;
    if (mode === 'campaign' && (level < 1 || level > progress.value.campaign.highestUnlockedLevel)) return;
    startRun(state, mode, level); begin();
  }
  function retry() {
    if (disposed || !state.run) return;
    recordAbandonedEndless();
    restartGame(state); begin();
  }
  function recordAbandonedEndless() {
    if (state.run?.mode === 'endless' && !state.run.recorded) {
      state.run.recorded = true;
      state.run.newRecord = progress.finish(runSummary(state)!);
    }
  }
  function pause() { nativePaused = true; resetClock(); mobile.setActive(false); onChange(state, state.phase === 'PLAYING'); }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const immersive = mobileScreen.matches && (isNativeApp || state.phase !== 'MENU');
    resizeGame(state, getWorldBounds(rect.width, rect.height, immersive));
    mobile.clear();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));
  }

  function resetClock() {
    previousTime = null;
    input.clear();
    mobile.clear();
  }

  function windowBlur() { windowFocused = false; resetClock(); }
  function windowFocus() { windowFocused = true; resetClock(); }

  function render() {
    if (!context) return;
    const WORLD = state.bounds;
    context.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);
    const background = context.createLinearGradient(0, 0, WORLD.width, WORLD.height);
    background.addColorStop(0, palette.background);
    background.addColorStop(0.6, '#080d18');
    background.addColorStop(1, palette.background);
    context.fillStyle = background;
    context.fillRect(0, 0, WORLD.width, WORLD.height);

    context.strokeStyle = 'rgba(104, 229, 239, 0.025)';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x < WORLD.width; x += 60) {
      context.moveTo(x, 0);
      context.lineTo(x, WORLD.height);
    }
    for (let y = 0; y < WORLD.height; y += 60) {
      context.moveTo(0, y);
      context.lineTo(WORLD.width, y);
    }
    context.stroke();
    if ((state.run?.galaxy ?? 0) !== 0) {
      context.save(); context.globalAlpha = 0.045; context.fillStyle = palette.secondary;
      context.beginPath(); context.ellipse(WORLD.width * .7, WORLD.height * .3, WORLD.width * .35, WORLD.height * .22, -.35, 0, Math.PI * 2); context.fill();
      context.restore();
    }

    for (const star of stars) {
      context.fillStyle = `rgba(189, 217, 246, ${star.opacity})`;
      context.beginPath();
      context.arc(star.x * WORLD.width, (star.y * WORLD.height + (reducedMotion ? 0 : visualTime * (5 + star.radius * 7))) % WORLD.height, star.radius, 0, Math.PI * 2);
      context.fill();
    }

    drawEnemies(context, state.enemies.enemies);
    drawBoss(context, state.boss);
    drawBullets(context, state.shooting.bullets);
    drawHostileProjectiles(context, state.hostile);
    drawPickups(context, state.pickups);
    drawEffects(context, state.effects);
    context.save();
    const protectedPlayer = state.invulnerabilityRemaining > 0;
    if (protectedPlayer || state.shield) {
      context.globalAlpha = state.shield ? 0.9 : reducedMotion ? 0.6 : (Math.floor(state.elapsedTime * 10) % 2 === 0 ? 0.3 : 1);
      context.strokeStyle = '#68e5ef';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(state.player.x, state.player.y, 32, 0, Math.PI * 2);
      context.stroke();
    }
    drawPlayer(context, state.player, reducedMotion ? 0 : visualTime);
    context.restore();
    if (state.run?.stage === 'TRANSITION' || state.run?.stage === 'BOSS_INTRO') {
      context.save(); context.textAlign = 'center'; context.fillStyle = palette.accent;
      context.font = '600 20px sans-serif';
      const title = state.run.stage === 'BOSS_INTRO' ? 'BOSS INBOUND' : `WAVE ${String(state.run.wave + 1).padStart(2, '0')}`;
      context.fillText(title, WORLD.width / 2, WORLD.height * 0.3); context.restore();
    }
    if (state.run?.mode === 'endless' && state.run.bossWarningRemaining !== null) {
      context.save(); context.textAlign = 'center'; context.fillStyle = '#ffb8a0'; context.font = '12px sans-serif';
      context.fillText('BOSS INBOUND', WORLD.width / 2, 23); context.restore();
    }
    if (state.boss) {
      const spec = BOSS_CONFIGS[state.boss.index], width = Math.min(260, WORLD.width - 50);
      context.save(); context.shadowBlur = 0; context.textAlign = 'center'; context.font = '12px sans-serif'; context.fillStyle = '#ffd0c5';
      context.fillText(spec.name.toUpperCase(), WORLD.width / 2, 23);
      context.fillStyle = '#3b2738'; context.fillRect((WORLD.width - width) / 2, 33, width, 5);
      context.fillStyle = '#ff9d9b'; context.fillRect((WORLD.width - width) / 2, 33, width * state.boss.hp / state.boss.maxHp, 5); context.restore();
    }
  }

  function frame(time: number) {
    if (disposed) return;
    if (!document.hidden) {
      const deltaTime = previousTime === null ? 0 : Math.min(Math.max((time - previousTime) / 1000, 0), GAME_CONFIG.maxDeltaTime);
      const landscape = window.matchMedia('(pointer: coarse) and (orientation: landscape)').matches;
      const paused = state.phase === 'PLAYING' && (nativePaused || landscape || !windowFocused || document.activeElement !== canvas);
      mobile.setActive(state.phase === 'PLAYING' && !paused);
      previousTime = paused ? null : time;
      visualTime += deltaTime;
      if (!paused) updateGame(state, mergeInput(input.read(), mobile.read(deltaTime)), deltaTime, Math.random, feedback?.sound);
      if (!paused) palette = theme.update(state.run?.galaxy ?? 0, deltaTime);
      if (state.phase !== 'PLAYING') mobile.setActive(false);
      if (state.run && !state.run.recorded && (state.phase === 'GAME_OVER' || state.phase === 'LEVEL_COMPLETE')) {
        state.run.recorded = true;
        state.run.newRecord = progress.finish(runSummary(state)!);
      }
      render();
      onChange(state, paused);
    } else {
      previousTime = null;
      mobile.setActive(false);
    }
    frameId = requestAnimationFrame(frame);
  }

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  window.addEventListener('resize', resize);
  function visibility() { if (document.hidden) pause(); else resetClock(); }
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pause);
  window.addEventListener('blur', windowBlur);
  window.addEventListener('focus', windowFocus);
  const stopNativePause = watchNativePause(() => {
    feedback?.suspend();
    nativePaused = true;
    resetClock();
    mobile.setActive(false);
    onChange(state, state.phase === 'PLAYING');
  });
  onChange(state, false);
  frameId = requestAnimationFrame(frame);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    input.dispose();
    mobile.dispose();
    stopNativePause();
    resizeObserver.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', pause);
    window.removeEventListener('blur', windowBlur);
    window.removeEventListener('focus', windowFocus);
  }
  function returnToMenu() {
    if (disposed) return;
    recordAbandonedEndless();
    Object.assign(state, createGameState(state.highScore));
    nativePaused = false;
    resetClock();
    mobile.setActive(false);
    onChange(state, false);
    resize();
  }
  return { start, retry, pause, startOrResume: begin, returnToMenu, dispose };
}
