export interface MovementInput {
  x: number;
  y: number;
}

const movementKeys = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);

/** Only capture movement while the Canvas owns keyboard focus. */
export function createInput(canvas: HTMLCanvasElement) {
  const pressed = new Set<string>();

  function keyDown(event: KeyboardEvent) {
    if (document.activeElement !== canvas || !movementKeys.has(event.code)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    pressed.add(event.code);
  }

  function keyUp(event: KeyboardEvent) {
    if (!movementKeys.has(event.code)) return;
    if (document.activeElement === canvas) event.preventDefault();
    pressed.delete(event.code);
  }

  function clear() {
    pressed.clear();
  }

  function read(): MovementInput {
    const left = pressed.has('KeyA') || pressed.has('ArrowLeft');
    const right = pressed.has('KeyD') || pressed.has('ArrowRight');
    const up = pressed.has('KeyW') || pressed.has('ArrowUp');
    const down = pressed.has('KeyS') || pressed.has('ArrowDown');
    return { x: Number(right) - Number(left), y: Number(down) - Number(up) };
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', clear);
  canvas.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);

  return {
    read,
    clear,
    dispose() {
      clear();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clear);
      canvas.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    },
  };
}
