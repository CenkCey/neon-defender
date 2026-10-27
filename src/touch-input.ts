import { GAME_CONFIG } from './config.ts';
import { PLAYER_WIDTH, PLAYER_HEIGHT } from './player.ts';
import type { Player, Bounds } from './player.ts';
import type { InputState } from './input.ts';

export type MobileMode = 'drag' | 'tilt';
export function canvasPoint(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number, bounds: Bounds = GAME_CONFIG) {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: (clientX - rect.left) / rect.width * bounds.width, y: (clientY - rect.top) / rect.height * bounds.height };
}

/** Separate pointer ownership permits dragging and firing with two fingers. */
export function createTouchInput(canvas: HTMLCanvasElement, fireButton: HTMLButtonElement, getPlayer: () => Player, getBounds: () => Bounds = () => GAME_CONFIG) {
  let active = false;
  let mode: MobileMode = 'drag';
  let drag: { id: number; startX: number; playerX: number; targetX: number } | null = null;
  let tapRequested = false;
  const firing = new Map<number, HTMLElement>();
  const captured = new Map<number, HTMLElement>();
  const targets: HTMLElement[] = [canvas, fireButton];

  function capture(target: HTMLElement, id: number) {
    try { target.setPointerCapture(id); captured.set(id, target); } catch { /* Window release still cleans up. */ }
  }
  function release(id: number) {
    const target = captured.get(id);
    captured.delete(id);
    try { if (target?.hasPointerCapture(id)) target.releasePointerCapture(id); } catch { /* Already cancelled. */ }
  }
  function down(event: PointerEvent) {
    if (!active || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    const target = event.currentTarget as HTMLElement;
    if ((mode === 'tilt' && target === canvas) || (mode === 'drag' && target === fireButton)) {
      firing.set(event.pointerId, target);
      tapRequested = true;
      capture(target, event.pointerId);
      fireButton.classList.add('pressed');
      return;
    }
    if (mode !== 'drag' || target !== canvas || drag) return;
    const rect = canvas.getBoundingClientRect();
    const point = canvasPoint(rect, event.clientX, event.clientY, getBounds());
    if (!point) return;
    const player = getPlayer();
    const touchRadius = Math.max(PLAYER_WIDTH / 2 + 12, 28 * getBounds().width / rect.width);
    if (Math.abs(point.x - player.x) > touchRadius || Math.abs(point.y - player.y) > Math.max(PLAYER_HEIGHT / 2 + 12, touchRadius)) return;
    drag = { id: event.pointerId, startX: point.x, playerX: player.x, targetX: player.x };
    capture(canvas, event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!active || !drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    const point = canvasPoint(canvas.getBoundingClientRect(), event.clientX, event.clientY, getBounds());
    if (!point) return;
    drag.targetX = Math.max(PLAYER_WIDTH / 2, Math.min(getBounds().width - PLAYER_WIDTH / 2, drag.playerX + point.x - drag.startX));
  }
  function finish(event: PointerEvent) {
    const wasFiring = firing.delete(event.pointerId);
    if (drag?.id === event.pointerId) drag = null;
    if (wasFiring && event.type !== 'pointerup' && firing.size === 0) tapRequested = false;
    if (firing.size === 0) fireButton.classList.remove('pressed');
    release(event.pointerId);
  }
  function clear() {
    drag = null; tapRequested = false; firing.clear();
    fireButton.classList.remove('pressed');
    for (const id of [...captured.keys()]) release(id);
  }
  function preventGesture(event: Event) { if (active) event.preventDefault(); }
  for (const target of targets) {
    target.addEventListener('pointerdown', down);
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', finish);
    target.addEventListener('lostpointercapture', finish);
    target.addEventListener('gesturestart', preventGesture, { passive: false });
  }
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  return {
    clear,
    setMode(next: MobileMode) { clear(); mode = next; },
    setActive(next: boolean) { if (!next) clear(); active = next; },
    read(): InputState {
      const shooting = tapRequested || firing.size > 0;
      tapRequested = false;
      return { x: 0, y: 0, shooting, ...(drag ? { targetX: drag.targetX } : {}) };
    },
    dispose() {
      active = false; clear();
      for (const target of targets) {
        target.removeEventListener('pointerdown', down);
        target.removeEventListener('pointerup', finish);
        target.removeEventListener('pointercancel', finish);
        target.removeEventListener('lostpointercapture', finish);
        target.removeEventListener('gesturestart', preventGesture);
      }
      canvas.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    },
  };
}
