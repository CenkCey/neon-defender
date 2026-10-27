import { createInput, mergeInput } from './input.ts';
import { createMobileControls } from './mobile-controls.ts';
import type { MobileElements } from './mobile-controls.ts';
import { drawBullets } from './bullets.ts';
import { drawPlayer } from './player.ts';
import { drawEnemies } from './enemies.ts';
import { GAME_CONFIG } from './config.ts';
import { drawEffects } from './effects.ts';
import { createGameState, restartGame, resizeGame, updateGame } from './world.ts';
import type { GameState } from './world.ts';
import type { createHighScoreStore } from './high-score.ts';
import { watchNativePause, isNativeApp } from './native.ts';
import { getWorldBounds } from './viewport.ts';

/** Start one animation loop and return its complete cleanup function. */
export function startGame(canvas: HTMLCanvasElement, onChange: (state: GameState, paused: boolean) => void, highScore: ReturnType<typeof createHighScoreStore>, mobileElements: MobileElements) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tarayıcınızda Canvas 2D kullanılamıyor.');

  const state = createGameState(highScore.value);
  const input = createInput(canvas, () => {
    if (state.phase === 'PLAYING') return false;
    begin();
    return true;
  });
  const mobile = createMobileControls(canvas, () => state.player, mobileElements, () => state.bounds);
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

  function begin() {
    if (disposed) return;
    if (state.phase !== 'PLAYING') restartGame(state);
    input.clear();
    mobile.clear();
    previousTime = null;
    nativePaused = false;
    onChange(state, false);
    resize();
    canvas.focus({ preventScroll: true });
    windowFocused = document.hasFocus();
  }

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
    background.addColorStop(0, '#090f1b');
    background.addColorStop(0.6, '#080d18');
    background.addColorStop(1, '#111126');
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

    for (const star of stars) {
      context.fillStyle = `rgba(189, 217, 246, ${star.opacity})`;
      context.beginPath();
      context.arc(star.x * WORLD.width, (star.y * WORLD.height + (reducedMotion ? 0 : visualTime * (5 + star.radius * 7))) % WORLD.height, star.radius, 0, Math.PI * 2);
      context.fill();
    }

    drawEnemies(context, state.enemies.enemies);
    drawBullets(context, state.shooting.bullets);
    drawEffects(context, state.effects);
    context.save();
    const protectedPlayer = state.invulnerabilityRemaining > 0;
    if (protectedPlayer) {
      context.globalAlpha = reducedMotion ? 0.6 : (Math.floor(state.elapsedTime * 10) % 2 === 0 ? 0.3 : 1);
      context.strokeStyle = '#68e5ef';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(state.player.x, state.player.y, 32, 0, Math.PI * 2);
      context.stroke();
    }
    drawPlayer(context, state.player, reducedMotion ? 0 : visualTime);
    context.restore();
  }

  function frame(time: number) {
    if (disposed) return;
    if (!document.hidden) {
      const deltaTime = previousTime === null ? 0 : Math.min(Math.max((time - previousTime) / 1000, 0), GAME_CONFIG.maxDeltaTime);
      const paused = state.phase === 'PLAYING' && (nativePaused || !windowFocused || document.activeElement !== canvas);
      mobile.setActive(state.phase === 'PLAYING' && !paused);
      previousTime = paused ? null : time;
      visualTime += deltaTime;
      if (!paused) updateGame(state, mergeInput(input.read(), mobile.read(deltaTime)), deltaTime);
      if (state.phase !== 'PLAYING') mobile.setActive(false);
      highScore.record(state.highScore);
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
  document.addEventListener('visibilitychange', resetClock);
  window.addEventListener('blur', windowBlur);
  window.addEventListener('focus', windowFocus);
  const stopNativePause = watchNativePause(() => {
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
    document.removeEventListener('visibilitychange', resetClock);
    window.removeEventListener('blur', windowBlur);
    window.removeEventListener('focus', windowFocus);
  }
  function returnToMenu() {
    if (disposed) return;
    highScore.record(state.highScore);
    Object.assign(state, createGameState(state.highScore));
    nativePaused = false;
    resetClock();
    mobile.setActive(false);
    onChange(state, false);
    resize();
  }
  return { startOrResume: begin, returnToMenu, dispose };
}
