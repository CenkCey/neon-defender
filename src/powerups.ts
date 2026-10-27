import { V2_CONFIG } from './content.ts';
import type { Bounds, Player } from './player.ts';
export type PickupKind = 'shield' | 'rapid';
export interface Pickup { x: number; y: number; kind: PickupKind; age: number }
export function updatePickups(items: Pickup[], dt: number, player: Player, bounds: Bounds) {
  const collected: PickupKind[] = [];
  const remaining = items.filter(item => {
    item.age += dt; item.y += 54 * dt;
    if (Math.abs(item.x - player.x) < 29 && Math.abs(item.y - player.y) < 37) { collected.push(item.kind); return false; }
    return item.y < bounds.height + 16 && item.age < 16;
  });
  return { remaining, collected };
}
export function dropPickup(x: number, y: number, bounds: Bounds, items: Pickup[], random = Math.random) {
  if (items.length >= V2_CONFIG.maxPickups || random() >= V2_CONFIG.dropChance) return;
  items.push({ x: Math.max(40, Math.min(bounds.width - 40, x)), y: Math.max(24, Math.min(bounds.height * 0.7, y)),
    kind: random() < 0.5 ? 'shield' : 'rapid', age: 0 });
}
export function drawPickups(ctx: CanvasRenderingContext2D, items: Pickup[]) {
  ctx.save(); ctx.lineWidth = 1.5; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const item of items) {
    ctx.strokeStyle = item.kind === 'shield' ? '#68e5ef' : '#ffc56e'; ctx.fillStyle = '#122334';
    ctx.beginPath(); ctx.arc(item.x, item.y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.fillText(item.kind === 'shield' ? 'S' : 'R', item.x, item.y + 1);
  }
  ctx.restore();
}
