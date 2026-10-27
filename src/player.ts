import type { MovementInput } from './input.ts';

export const PLAYER_WIDTH = 44;
export const PLAYER_HEIGHT = 56;
const PLAYER_SPEED = 300; // Logical pixels per second.

export interface Player {
  x: number;
  y: number;
}

export interface Bounds {
  width: number;
  height: number;
}

export function createPlayer(bounds: Bounds): Player {
  return { x: bounds.width / 2, y: bounds.height * 0.8 };
}

export function updatePlayer(player: Player, input: MovementInput, deltaTime: number, bounds: Bounds) {
  // Normalization keeps diagonal movement at the same speed as one axis.
  const length = Math.hypot(input.x, input.y);
  if (length > 0) {
    const distance = PLAYER_SPEED * deltaTime;
    player.x += (input.x / length) * distance;
    player.y += (input.y / length) * distance;
  }

  const halfWidth = PLAYER_WIDTH / 2;
  const halfHeight = PLAYER_HEIGHT / 2;
  player.x = Math.max(halfWidth, Math.min(bounds.width - halfWidth, player.x));
  player.y = Math.max(halfHeight, Math.min(bounds.height - halfHeight, player.y));
}

export function drawPlayer(context: CanvasRenderingContext2D, player: Player, elapsedTime: number) {
  context.save();
  context.translate(player.x, player.y);

  // Engine light stays within the player's 44 × 56 logical bounding box.
  const flameLength = 7 + Math.sin(elapsedTime * 14) * 3;
  context.shadowColor = '#ad83ff';
  context.shadowBlur = 16;
  context.fillStyle = '#ad83ff';
  context.beginPath();
  context.moveTo(-5, 17);
  context.lineTo(0, 18 + flameLength);
  context.lineTo(5, 17);
  context.closePath();
  context.fill();

  context.shadowColor = '#68e5ef';
  context.shadowBlur = 15;
  context.strokeStyle = '#68e5ef';
  context.lineWidth = 1.5;
  context.fillStyle = '#142e40';
  context.beginPath();
  context.moveTo(0, -26);
  context.lineTo(21, 19);
  context.lineTo(8, 14);
  context.lineTo(0, 18);
  context.lineTo(-8, 14);
  context.lineTo(-21, 19);
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowBlur = 6;
  context.fillStyle = '#d5fcff';
  context.beginPath();
  context.moveTo(0, -17);
  context.lineTo(5, 7);
  context.lineTo(0, 3);
  context.lineTo(-5, 7);
  context.closePath();
  context.fill();

  context.shadowBlur = 0;
  context.strokeStyle = '#ad83ff';
  context.beginPath();
  context.moveTo(-16, 14);
  context.lineTo(-9, 5);
  context.moveTo(16, 14);
  context.lineTo(9, 5);
  context.stroke();
  context.restore();
}
