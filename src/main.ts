import './style.css';
import { startGame } from './game.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const inputStatus = document.querySelector<HTMLElement>('#input-status');
const errorMessage = document.querySelector<HTMLElement>('#game-error');

if (!canvas || !inputStatus || !errorMessage) throw new Error('Oyun arayüzü bulunamadı.');

function updateFocusStatus() {
  if (!canvas || !inputStatus) return;
  const active = document.activeElement === canvas;
  inputStatus.textContent = active ? 'Kontroller etkin' : 'Kontrolleri etkinleştirmek için alanı seç';
  inputStatus.classList.toggle('active', active);
}

function focusCanvas() {
  canvas?.focus({ preventScroll: true });
}

let stopGame: (() => void) | undefined;
try {
  stopGame = startGame(canvas);
  canvas.addEventListener('pointerdown', focusCanvas);
  canvas.addEventListener('focus', updateFocusStatus);
  canvas.addEventListener('blur', updateFocusStatus);
  focusCanvas();
} catch (error) {
  errorMessage.textContent = error instanceof Error ? error.message : 'Oyun başlatılamadı.';
  errorMessage.hidden = false;
  inputStatus.textContent = 'Oyun başlatılamadı';
}

// Vite updates must not leave a second loop or old keyboard listeners running.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopGame?.();
    canvas.removeEventListener('pointerdown', focusCanvas);
    canvas.removeEventListener('focus', updateFocusStatus);
    canvas.removeEventListener('blur', updateFocusStatus);
  });
}
