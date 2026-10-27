export interface MovementInput {
  x: number;
  y: number;
  targetX?: number;
}

export interface InputState extends MovementInput {
  shooting: boolean;
}

export function mergeInput(keyboard: InputState, mobile: InputState): InputState {
  const movement = keyboard.x !== 0 || keyboard.y !== 0 ? keyboard : mobile;
  return { ...movement, shooting: keyboard.shooting || mobile.shooting };
}

const controlKeys = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'Space',
]);

/** Only capture game controls while the Canvas owns keyboard focus. */
export function createInput(canvas: HTMLCanvasElement, onStart: () => boolean = () => false) {
  const pressed = new Set<string>();
  let shootRequested = false;

  function keyDown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!event.repeat && (event.code === 'Enter' || event.code === 'KeyR') && onStart()) {
      event.preventDefault();
      clear();
      return;
    }
    if (document.activeElement !== canvas || !controlKeys.has(event.code)) return;
    event.preventDefault();
    // Keep a quick Space tap until the next frame, even if keyup arrives first.
    if (event.code === 'Space' && !pressed.has('Space')) shootRequested = true;
    pressed.add(event.code);
  }

  function keyUp(event: KeyboardEvent) {
    if (!controlKeys.has(event.code)) return;
    if (document.activeElement === canvas) event.preventDefault();
    pressed.delete(event.code);
  }

  function clear() {
    pressed.clear();
    shootRequested = false;
  }

  function read(): InputState {
    const left = pressed.has('KeyA') || pressed.has('ArrowLeft');
    const right = pressed.has('KeyD') || pressed.has('ArrowRight');
    const up = pressed.has('KeyW') || pressed.has('ArrowUp');
    const down = pressed.has('KeyS') || pressed.has('ArrowDown');
    const shooting = pressed.has('Space') || shootRequested;
    shootRequested = false;
    return { x: Number(right) - Number(left), y: Number(down) - Number(up), shooting };
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
