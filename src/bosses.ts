import { BOSS_CONFIGS, BOSS_BALANCE, V2_CONFIG } from './content.ts';
import type { Bounds, Player } from './player.ts';
import type { HostileProjectile } from './projectiles.ts';
import { GAME_CONFIG } from './config.ts';
export interface BossAttackPlan {
  kind: 'single' | 'double' | 'fan' | 'aimed' | 'cross' | 'corridor' | 'layered';
  phase: number;
  projectiles: HostileProjectile[];
  safeGap: { left: number; right: number; top: number; bottom: number };
  dashTargetX: number | null;
  deferred: boolean;
}
export interface Boss {
  index: number; x: number; y: number; hp: number; maxHp: number; age: number;
  phase: number; phaseChanges: number; cooldown: number; warning: number; targetX: number; targetY: number;
  plan: BossAttackPlan | null; safeLane: { left: number; right: number } | null;
  attack: number; dashRemaining: number; dashTarget: number; dashStep: number;
}
export function createBoss(index: number, bounds: Bounds, wave = 1): Boss {
  const config = BOSS_CONFIGS[index];
  const hp = Math.round(config.hp * Math.min(1.8, 1 + Math.max(0, wave - 30) * 0.008));
  return { index, x: bounds.width / 2, y: Math.min(105, bounds.height * 0.17), hp, maxHp: hp,
    age: 0, phase: 0, phaseChanges: 0, cooldown: BOSS_BALANCE.initialCooldown, warning: 0, targetX: bounds.width / 2, targetY: bounds.height * 0.8,
    plan: null, safeLane: null, attack: 0, dashRemaining: 0, dashTarget: bounds.width / 2, dashStep: 0 };
}
/** One immutable plan drives both the warning and the subsequent volley. */
function warn(boss: Boss, bounds: Bounds, player: Player, shots: HostileProjectile[]) {
  boss.targetX = player.x; boss.targetY = player.y;
  boss.plan = planBossAttack(boss, bounds, player, shots);
  if (!boss.plan.deferred) boss.safeLane = { left: boss.plan.safeGap.left, right: boss.plan.safeGap.right };
  boss.warning = BOSS_CONFIGS[boss.index].telegraphDuration;
}
export function updateBoss(boss: Boss, dt: number, bounds: Bounds, player: Player, shots: HostileProjectile[]) {
  if (boss.hp <= 0) return;
  const spec = BOSS_CONFIGS[boss.index];
  boss.age += dt;
  const phase = spec.phaseThresholds.filter(threshold => boss.hp / boss.maxHp <= threshold).length;
  if (phase > boss.phase) { boss.phaseChanges += phase - boss.phase; boss.phase = phase; }
  const margin = spec.width / 2 + 18;
  if (boss.dashRemaining > 0) {
    const step = (BOSS_BALANCE.dashSpeed + boss.phase * BOSS_BALANCE.phaseDashIncrease) * dt;
    boss.x += Math.max(-step, Math.min(step, boss.dashTarget - boss.x));
    boss.dashRemaining = Math.max(0, boss.dashRemaining - dt);
    if (boss.dashRemaining <= 1e-9) {
      boss.dashRemaining = 0;
      if (boss.phase > 0 && boss.dashStep === 1) { boss.dashStep = 2; warn(boss, bounds, player, shots); }
    }
  } else if (boss.warning <= 0) {
    const amplitude = Math.max(0, (bounds.width - margin * 2) * 0.46);
    let target = bounds.width / 2 + Math.sin(boss.age * spec.movement) * amplitude;
    if (spec.firePattern === 'hunter') target = player.x + (boss.attack % 2 ? -1 : 1) * Math.min(140, bounds.width * .22);
    target = Math.max(margin, Math.min(bounds.width - margin, target));
    const step = Math.min(spec.maxMoveSpeed, spec.moveSpeed + boss.phase * BOSS_BALANCE.phaseMoveIncrease) * dt;
    boss.x += Math.max(-step, Math.min(step, target - boss.x));
  }
  boss.x = Math.max(margin, Math.min(bounds.width - margin, boss.x));
  if (boss.warning > 0) {
    // A viewport resize invalidates the old geometry and grants a full new warning.
    if (!boss.plan) warn(boss, bounds, player, shots);
    boss.warning = Math.max(0, boss.warning - dt);
    if (boss.warning <= 1e-9) {
      boss.warning = 0;
      const plan = boss.plan!;
      fireBoss(boss, shots);
      if (!plan.deferred && plan.dashTargetX !== null) {
        boss.dashTarget = plan.dashTargetX;
        boss.dashRemaining = BOSS_BALANCE.dashDuration;
        boss.dashStep = boss.dashStep === 2 ? 0 : 1;
      }
      boss.plan = null;
      boss.attack++;
      boss.cooldown = Math.max(BOSS_BALANCE.minCooldown, spec.fireCooldown - boss.phase * BOSS_BALANCE.phaseCooldownReduction);
    }
  } else if (boss.dashRemaining <= 0) {
    boss.cooldown -= dt;
    if (boss.cooldown <= 1e-9) warn(boss, bounds, player, shots);
  }
}
function fireBoss(boss: Boss, shots: HostileProjectile[]) {
  const spec = BOSS_CONFIGS[boss.index];
  const room = Math.max(0, Math.min(V2_CONFIG.maxHostileProjectiles - shots.length, spec.maxProjectiles - shots.filter(s => s.boss).length));
  for (const projectile of boss.plan!.projectiles.slice(0, room)) shots.push({ ...projectile });
}

/** Plans reserve a clear vertical escape corridor in the lower combat area. */
export function planBossAttack(boss: Boss, bounds: Bounds, player: Player, existing: HostileProjectile[] = []): BossAttackPlan {
  const spec = BOSS_CONFIGS[boss.index];
  const gapWidth = Math.min(BOSS_BALANCE.safeGapWidth, bounds.width * .3);
  let direction = boss.attack % 2 ? -1 : 1;
  if (player.x < gapWidth) direction = 1;
  if (player.x > bounds.width - gapWidth) direction = -1;
  const clampCenter = (x: number) => Math.max(gapWidth / 2 + 12, Math.min(bounds.width - gapWidth / 2 - 12, x));
  const center = clampCenter(player.x + direction * BOSS_BALANCE.gapShift);
  const safeGap = { left: center - gapWidth / 2, right: center + gapWidth / 2,
    top: Math.max(boss.y + spec.height / 2 + 70, bounds.height * .6), bottom: bounds.height - 28 };
  function crossesGap(shot: HostileProjectile) {
    if (shot.y > safeGap.bottom || shot.vy <= 0) return false;
    const slope = shot.vx / shot.vy;
    const top = Math.max(safeGap.top, shot.y);
    const atTop = shot.x + (top - shot.y) * slope;
    const atBottom = shot.x + (safeGap.bottom - shot.y) * slope;
    const padding = shot.radius + BOSS_BALANCE.gapPadding;
    return Math.max(atTop, atBottom) + padding >= safeGap.left && Math.min(atTop, atBottom) - padding <= safeGap.right;
  }
  const candidates = [center, clampCenter(player.x - direction * BOSS_BALANCE.gapShift)];
  if (boss.safeLane) candidates.push((boss.safeLane.left + boss.safeLane.right) / 2);
  for (let x = gapWidth / 2 + 12; x <= bounds.width - gapWidth / 2 - 12; x += gapWidth / 2) candidates.push(x);
  candidates.push(clampCenter(player.x));
  function chooseLane(keepWholePattern: boolean) {
    return candidates.find(x => {
      if (x < gapWidth / 2 + 12 || x > bounds.width - gapWidth / 2 - 12) return false;
      safeGap.left = x - gapWidth / 2; safeGap.right = x + gapWidth / 2;
      const distanceToGap = Math.max(0, safeGap.left + 22 - player.x, player.x - (safeGap.right - 22));
      return distanceToGap <= GAME_CONFIG.initialPlayerSpeed * spec.telegraphDuration
        && !existing.some(shot => shot.boss && crossesGap(shot))
        && (!keepWholePattern || !projectiles.some(crossesGap));
    });
  }
  const speed = Math.min(BOSS_BALANCE.maxProjectileSpeed, spec.projectileSpeed + boss.phase * BOSS_BALANCE.phaseProjectileIncrease);
  const originY = boss.y + spec.height / 2;
  const aim = Math.atan2(player.x - boss.x, Math.max(130, player.y - originY));
  const projectiles: HostileProjectile[] = [];
  let kind: BossAttackPlan['kind'] = 'single';
  function ray(angle: number, offsetX = 0, layer = 0) {
    const a = Math.max(-BOSS_BALANCE.maxShotAngle, Math.min(BOSS_BALANCE.maxShotAngle, angle));
    const velocity = Math.min(BOSS_BALANCE.maxProjectileSpeed, speed + layer * 10);
    projectiles.push({ x: Math.max(8, Math.min(bounds.width - 8, boss.x + offsetX)), y: originY - layer * 14,
      vx: Math.sin(a) * velocity, vy: Math.cos(a) * velocity, radius: 6, boss: true });
  }
  function fan(count: number, spread: number, angle = aim, offsetX = 0, layer = 0) {
    for (let i = 0; i < count; i++) ray(angle - spread + spread * 2 * i / Math.max(1, count - 1), offsetX, layer);
  }
  switch (spec.firePattern) {
    case 'sentinel':
      kind = boss.attack % 2 ? 'double' : 'single';
      if (kind === 'single') ray(aim); else { ray(aim - .18); ray(aim + .18); }
      break;
    case 'guardian':
      kind = boss.attack % 2 ? 'fan' : 'double';
      if (kind === 'double') { ray(aim - .18); ray(aim + .18); }
      else fan(boss.phase ? 5 : 3, boss.phase ? .52 : .38);
      break;
    case 'hunter':
      kind = boss.phase === 0 || boss.attack % 2 === 0 ? 'aimed' : 'cross';
      if (kind === 'aimed') fan(boss.phase === 2 ? 3 : 1, boss.phase === 2 ? .17 : 0);
      else { ray(aim - .32, -20); ray(aim + .32, 20); }
      break;
    case 'core':
      kind = 'fan';
      fan(boss.phase === 2 ? 7 : 5, boss.attack % 2 ? .6 : .43, aim + (boss.attack % 2 ? .1 : -.1));
      break;
    case 'stalker':
      kind = boss.phase === 2 ? 'fan' : 'aimed';
      fan(boss.phase === 2 ? 3 : boss.phase === 1 ? 2 : 1, boss.phase > 0 ? .2 : 0);
      break;
    case 'overlord':
      kind = boss.phase > 0 && boss.attack % 2 ? 'corridor' : boss.phase > 0 ? 'layered' : 'fan';
      if (kind === 'corridor') {
        const columns = Math.max(3, Math.ceil(bounds.width / 70));
        for (let i = 0; i < columns; i++) {
          // Corridor rounds enter along the upper edge, never next to the player.
          projectiles.push({ x: (i + .5) * bounds.width / columns, y: originY, vx: 0, vy: speed, radius: 6, boss: true });
        }
      } else if (kind === 'layered') {
        fan(5, .52, aim, -spec.width * .22);
        fan(boss.phase === 2 ? 5 : 3, .36, aim, spec.width * .22, 1);
      } else fan(5, .48);
      break;
  }
  const lane = chooseLane(true) ?? chooseLane(false);
  const deferred = lane === undefined;
  safeGap.left = (lane ?? center) - gapWidth / 2; safeGap.right = (lane ?? center) + gapWidth / 2;
  const clearShots = deferred ? [] : projectiles.filter(shot => !crossesGap(shot));
  const margin = spec.width / 2 + 18;
  return { kind, phase: boss.phase, projectiles: clearShots, safeGap, deferred,
    dashTargetX: spec.firePattern === 'stalker' ? Math.max(margin, Math.min(bounds.width - margin, player.x)) : null };
}
export function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss | null) {
  if (!boss || boss.hp <= 0) return;
  const spec = BOSS_CONFIGS[boss.index];
  ctx.save(); ctx.translate(boss.x, boss.y);
  ctx.strokeStyle = boss.warning > 0 ? '#ffe2a0' : '#ff8ba6'; ctx.fillStyle = '#30182d';
  ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = boss.warning > 0 ? 15 : 8; ctx.lineWidth = 2;
  const w = spec.width / 2, h = spec.height / 2;
  ctx.beginPath(); ctx.moveTo(-w, -h); ctx.lineTo(-w * 0.6, h * 0.6); ctx.lineTo(0, h);
  ctx.lineTo(w * 0.6, h * 0.6); ctx.lineTo(w, -h); ctx.lineTo(0, -h * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffb0c4'; ctx.fillRect(-6, -8, 12, 22);
  for (let i = 0; i <= boss.index % 3; i++) ctx.strokeRect(-w + 14 + i * 12, -h + 7, 6, 12);
  if (boss.warning > 0) {
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.6; ctx.setLineDash([7, 7]);
    const plan = boss.plan;
    for (const shot of plan?.projectiles ?? []) {
      const x = shot.x - boss.x, y = shot.y - boss.y;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + shot.vx / shot.vy * 210, y + 210); ctx.stroke();
    }
    if (plan && !plan.deferred && (plan.kind === 'corridor' || plan.kind === 'layered')) {
      const gap = plan.safeGap;
      ctx.strokeStyle = '#68e5ef'; ctx.globalAlpha = .35;
      ctx.strokeRect(gap.left - boss.x, gap.top - boss.y, gap.right - gap.left, gap.bottom - gap.top);
    }
    if (plan?.dashTargetX !== null && plan?.dashTargetX !== undefined) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(plan.dashTargetX - boss.x, 0); ctx.stroke();
    }
  }
  ctx.restore();
}
