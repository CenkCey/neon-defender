import './style.css';
import { startGame } from './game.ts';
import { createHighScoreStore } from './high-score.ts';
import type { GameState } from './world.ts';
import { registerOffline } from './pwa.ts';
import { isNativeApp } from './native.ts';

document.body.classList.toggle('native-app', isNativeApp);

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const inputStatus = document.querySelector<HTMLElement>('#input-status');
const errorMessage = document.querySelector<HTMLElement>('#game-error');

if (!canvas || !inputStatus || !errorMessage) throw new Error('Oyun arayüzü bulunamadı.');

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Arayüz öğesi eksik: ${id}`);
  return found as T;
}

const score = element('hud-score');
const lives = element('hud-lives');
const best = element('hud-best');
const overlay = element('game-overlay');
const overlayTitle = element('overlay-title');
const overlayText = element('overlay-text');
const overlayScores = element('overlay-scores');
const finalScore = element('final-score');
const finalBest = element('final-best');
const playButton = element<HTMLButtonElement>('play-button');
const overlayHint = element('overlay-hint');
const saveStatus = element('save-status');
const announcement = element('game-announcement');
const pauseButton = element<HTMLButtonElement>('pause-button');
const menuButton = element<HTMLButtonElement>('menu-button');
const mobileElements = {
  panel: element('mobile-controls'),
  select: element<HTMLSelectElement>('control-mode'),
  enable: element<HTMLButtonElement>('enable-tilt'),
  calibrate: element<HTMLButtonElement>('calibrate-tilt'),
  fire: element<HTMLButtonElement>('touch-fire'),
  status: element('mobile-status'),
};
let storage: Storage | undefined;
try { storage = window.localStorage; } catch { /* Session best still works. */ }
const highScore = createHighScoreStore(storage);
let signature = '';
let lastPhase = '';
let lastLives = 3;

function renderInterface(state: GameState, paused: boolean) {
  // The session stays fullscreen during pause/Game Over, until returning to menu.
  document.body.classList.toggle('game-session', state.phase !== 'MENU');
  document.documentElement.classList.toggle('game-session', state.phase !== 'MENU');
  const next = [state.phase, state.score, state.highScore, state.lives, paused, highScore.available].join('|');
  if (signature === next) return;
  signature = next;
  score.textContent = String(state.score).padStart(4, '0');
  lives.textContent = `${state.lives} / 3`;
  lives.setAttribute('aria-label', `Kalan can: ${state.lives}`);
  best.textContent = String(state.highScore).padStart(4, '0');
  overlay.hidden = state.phase === 'PLAYING' && !paused;
  overlayScores.hidden = state.phase !== 'GAME_OVER';
  pauseButton.hidden = state.phase !== 'PLAYING' || paused;
  menuButton.hidden = state.phase === 'MENU' || !paused && state.phase !== 'GAME_OVER';
  const over = state.phase === 'GAME_OVER';
  overlayTitle.textContent = over ? 'GAME OVER' : paused ? 'Kısa bir mola.' : 'Göreve hazır mısın?';
  overlayText.textContent = over ? 'Bir uçuş biter. Bir yenisi başlar.' : paused ? 'Hazır olduğunda kaldığın yerden devam et.' : 'Üç can. Sonsuz uzay. Her isabet 100 puan.';
  playButton.textContent = over ? 'Yeniden başlat' : paused ? 'Devam et' : 'Oyuna başla';
  overlayHint.textContent = paused ? 'Devam et ile uçuşa dön.' : 'Enter veya R ile de başlayabilirsin.';
  finalScore.textContent = String(state.score);
  finalBest.textContent = String(state.highScore);
  if (canvas && inputStatus) {
    canvas.tabIndex = overlay.hidden ? 0 : -1;
    inputStatus.textContent = over ? 'Uçuş tamamlandı' : paused ? 'Duraklatıldı' : state.phase === 'MENU' ? 'Görev bekleniyor' : 'Kontroller etkin';
    inputStatus.classList.toggle('active', state.phase === 'PLAYING' && !paused);
  }
  saveStatus.textContent = highScore.available ? (isNativeApp ? 'Rekorun bu cihazda saklanır.' : 'Rekorun bu tarayıcıda saklanır.') : 'Rekorun bu oturumda korunuyor.';
  if (state.lives < lastLives) announcement.textContent = over ? `Oyun bitti. Skor: ${state.score}. Rekor: ${state.highScore}.` : `Hasar aldın. Kalan can: ${state.lives}.`;
  if (lastPhase !== state.phase && state.phase === 'PLAYING') announcement.textContent = 'Yeni uçuş başladı. Üç canın var.';
  if (lastPhase !== state.phase && state.phase !== 'PLAYING') playButton.focus({ preventScroll: true });
  lastPhase = state.phase;
  lastLives = state.lives;
}

function focusCanvas() {
  controller?.startOrResume();
}
function pause() { canvas?.blur(); pauseButton.focus({ preventScroll: true }); }
function returnToMenu() { controller?.returnToMenu(); }

let controller: ReturnType<typeof startGame> | undefined;
try {
  controller = startGame(canvas, renderInterface, highScore, mobileElements);
  playButton.addEventListener('click', focusCanvas);
  pauseButton.addEventListener('click', pause);
  menuButton.addEventListener('click', returnToMenu);
} catch (error) {
  errorMessage.textContent = error instanceof Error ? error.message : 'Oyun başlatılamadı.';
  errorMessage.hidden = false;
  inputStatus.textContent = 'Oyun başlatılamadı';
  playButton.disabled = true;
}

// Vite updates must not leave a second loop or old keyboard listeners running.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    controller?.dispose();
    playButton.removeEventListener('click', focusCanvas);
    pauseButton.removeEventListener('click', pause);
    menuButton.removeEventListener('click', returnToMenu);
    document.body.classList.remove('game-session');
    document.documentElement.classList.remove('game-session');
  });
}
registerOffline(element('pwa-status'));
