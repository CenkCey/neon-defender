import { createTouchInput } from './touch-input.ts';
import type { MobileMode } from './touch-input.ts';
import { createTiltInput } from './tilt.ts';
import type { TiltStatus } from './tilt.ts';
import type { Player, Bounds } from './player.ts';
import { isNativeApp } from './native.ts';

export const CONTROL_MODE_KEY = 'neon-defender.controls.v1';
export interface MobileElements {
  panel: HTMLElement;
  select: HTMLSelectElement;
  enable: HTMLButtonElement;
  calibrate: HTMLButtonElement;
  fire: HTMLButtonElement;
  status: HTMLElement;
}
const messages: Record<TiltStatus, string> = {
  idle: 'Eğim için önce izin ver. Drag & Fire sensör gerektirmez.',
  waiting: 'İzin alındı; gerçek sensör verisi bekleniyor…',
  ready: 'Eğim hazır. Rahat tutuşunu Kalibre et ile merkezle.',
  denied: 'Sensör izni verilmedi. Drag & Fire etkin.',
  unsupported: 'Eğim için HTTPS ve desteklenen sensör gerekir. Drag & Fire etkin.',
  unavailable: 'Sensör verisi gelmedi. Drag & Fire etkin.',
};

export function createMobileControls(canvas: HTMLCanvasElement, getPlayer: () => Player, ui: MobileElements, getBounds?: () => Bounds) {
  let mode: MobileMode = 'drag';
  let active = false;
  let disposed = false;
  const touch = createTouchInput(canvas, ui.fire, getPlayer, getBounds);
  const tilt = createTiltInput((status) => {
    ui.status.textContent = messages[status];
    ui.calibrate.disabled = !tilt.ready;
  }, (reason) => {
    setMode('drag');
    ui.status.textContent = messages[reason];
  }, undefined, isNativeApp);
  try { if (localStorage.getItem(CONTROL_MODE_KEY) === 'tilt' && tilt.supported) mode = 'tilt'; } catch { /* Optional preference. */ }

  function paint() {
    ui.select.value = mode;
    ui.enable.hidden = mode !== 'tilt';
    ui.calibrate.hidden = mode !== 'tilt';
    ui.calibrate.disabled = !tilt.ready;
    ui.panel.hidden = active;
    ui.fire.hidden = !(active && mode === 'drag');
    document.body.dataset.controlMode = mode;
    document.body.classList.toggle('game-active', active);
    touch.setMode(mode);
  }
  function clear() { touch.clear(); tilt.calibrate(); }
  function setMode(next: MobileMode) {
    clear(); tilt.disable();
    mode = next;
    if (mode === 'tilt' && !tilt.supported) {
      mode = 'drag';
      ui.status.textContent = messages.unsupported;
    } else ui.status.textContent = mode === 'drag' ? 'Gemini yatay sürükle. Sağdaki küçük düğmeyle ateş et.' : messages.idle;
    paint();
    try { localStorage.setItem(CONTROL_MODE_KEY, mode); } catch { /* Session preference still works. */ }
    if (mode === 'tilt' && tilt.permitted) void tilt.enable();
  }
  function change() { setMode(ui.select.value === 'tilt' ? 'tilt' : 'drag'); }
  function enable() { void tilt.enable(); } // Direct click -> iOS permission API.
  function calibrate() { if (tilt.calibrate()) ui.status.textContent = 'Kalibre edildi. Bu tutuş artık merkez.'; }
  function visibility() {
    clear();
    if (document.hidden) tilt.disable();
    else if (mode === 'tilt' && tilt.permitted) void tilt.enable();
  }
  ui.select.addEventListener('change', change);
  ui.enable.addEventListener('click', enable);
  ui.calibrate.addEventListener('click', calibrate);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', clear);
  window.addEventListener('resize', clear);
  setMode(mode);
  return {
    clear,
    setActive(next: boolean) {
      if (disposed || active === next) return;
      active = next;
      if (active && mode === 'tilt' && !tilt.ready) {
        setMode('drag');
        ui.status.textContent = 'Eğim henüz hazır değil; Drag & Fire ile devam edebilirsin.';
      }
      clear();
      touch.setActive(active);
      ui.panel.hidden = active;
      ui.fire.hidden = !(active && mode === 'drag');
      document.body.classList.toggle('game-active', active);
    },
    read(deltaTime: number) {
      const input = touch.read();
      if (!active) return { x: 0, y: 0, shooting: false };
      return mode === 'tilt' ? { ...input, x: tilt.read(deltaTime) } : input;
    },
    dispose() {
      disposed = true; touch.dispose(); tilt.dispose();
      ui.select.removeEventListener('change', change);
      ui.enable.removeEventListener('click', enable);
      ui.calibrate.removeEventListener('click', calibrate);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', clear);
      window.removeEventListener('resize', clear);
      document.body.classList.remove('game-active');
    },
  };
}
