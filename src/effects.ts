export const EFFECT_DURATION = 0.35;

export interface HitEffect {
  x: number;
  y: number;
  age: number;
  color: string;
}

export function updateEffects(effects: HitEffect[], deltaTime: number): HitEffect[] {
  for (const effect of effects) effect.age += deltaTime;
  return effects.filter((effect) => effect.age < EFFECT_DURATION);
}

export function drawEffects(context: CanvasRenderingContext2D, effects: HitEffect[]) {
  context.save();
  context.lineWidth = 2;
  for (const effect of effects) {
    const progress = effect.age / EFFECT_DURATION;
    const radius = 5 + progress * 28;
    context.globalAlpha = 1 - progress;
    context.strokeStyle = effect.color;
    context.beginPath();
    context.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    for (let ray = 0; ray < 6; ray++) {
      const angle = ray * Math.PI / 3;
      context.moveTo(effect.x + Math.cos(angle) * radius, effect.y + Math.sin(angle) * radius);
      context.lineTo(effect.x + Math.cos(angle) * (radius + 6), effect.y + Math.sin(angle) * (radius + 6));
    }
    context.stroke();
  }
  context.restore();
}
