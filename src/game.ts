import { createInput } from './input.ts';
import { createPlayer, drawPlayer, updatePlayer } from './player.ts';

const WORLD = { width: 960, height: 540 };
const MAX_DELTA_TIME = 0.05;

/** Start one animation loop and return its complete cleanup function. */
export function startGame(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tarayıcınızda Canvas 2D kullanılamıyor.');

  const input = createInput(canvas);
  const player = createPlayer(WORLD);
  const stars = Array.from({ length: 85 }, (_, index) => ({
    x: ((index * 137 + 47) % WORLD.width),
    y: ((index * 89 + 23) % WORLD.height),
    radius: index % 7 === 0 ? 1.2 : 0.65,
    opacity: 0.2 + (index % 5) * 0.1,
  }));

  let frameId = 0;
  let previousTime: number | null = null;
  let elapsedTime = 0;
  let disposed = false;

  function resize() {
    // Keep gameplay in 960 × 540 coordinates; scale only the backing buffer.
    const cssWidth = canvas.getBoundingClientRect().width;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(cssWidth * (WORLD.height / WORLD.width) * pixelRatio));
  }

  function resetClock() {
    previousTime = null;
    input.clear();
  }

  function render() {
    if (!context) return;
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
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }

    drawPlayer(context, player, elapsedTime);
  }

  function frame(time: number) {
    if (disposed) return;
    if (!document.hidden) {
      const deltaTime = previousTime === null ? 0 : Math.min(Math.max((time - previousTime) / 1000, 0), MAX_DELTA_TIME);
      previousTime = time;
      elapsedTime += deltaTime;
      updatePlayer(player, input.read(), deltaTime, WORLD);
      render();
    } else {
      previousTime = null;
    }
    frameId = requestAnimationFrame(frame);
  }

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', resetClock);
  frameId = requestAnimationFrame(frame);

  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    input.dispose();
    resizeObserver.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', resetClock);
  };
}
