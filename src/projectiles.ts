import type { Bounds } from './player.ts';
export interface HostileProjectile { x: number; y: number; vx: number; vy: number; radius: number; boss: boolean }
export function updateHostileProjectiles(projectiles: HostileProjectile[], dt: number, bounds: Bounds) {
  for (const shot of projectiles) { shot.x += shot.vx * dt; shot.y += shot.vy * dt; }
  return projectiles.filter(p => p.x >= -20 && p.x <= bounds.width + 20 && p.y >= -20 && p.y <= bounds.height + 20);
}
export function drawHostileProjectiles(ctx: CanvasRenderingContext2D, shots: HostileProjectile[]) {
  ctx.save(); ctx.shadowBlur = 6; ctx.shadowColor = '#ff8b87';
  for (const shot of shots) {
    ctx.fillStyle = shot.boss ? '#ffc77b' : '#ff8b87';
    ctx.beginPath(); ctx.moveTo(shot.x, shot.y - shot.radius - 2);
    ctx.lineTo(shot.x + shot.radius, shot.y); ctx.lineTo(shot.x, shot.y + shot.radius + 2);
    ctx.lineTo(shot.x - shot.radius, shot.y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
