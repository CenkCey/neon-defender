import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_CONFIGS, BOSS_BALANCE } from '../src/content.ts';
import { createBoss, updateBoss, planBossAttack } from '../src/bosses.ts';
import { updateHostileProjectiles } from '../src/projectiles.ts';
import { createGameState, startRun, updateGame, resizeGame } from '../src/world.ts';
import { updatePlayer } from '../src/player.ts';
import { overlaps } from '../src/collision.ts';

const bounds = { width: 540, height: 1000 }, player = { x: 270, y: 800 };
const idle = { x: 0, y: 0, shooting: false };
function fireNext(boss, shots = []) {
  boss.cooldown = 0; updateBoss(boss, 0, bounds, player, shots);
  const plan = structuredClone(boss.plan);
  for (let i = 0; i < 100 && boss.attack === 0; i++) updateBoss(boss, .01, bounds, player, shots);
  return { shots, plan };
}
function intersectsGap(shot, gap) {
  if (shot.y > gap.bottom || shot.vy <= 0) return false;
  const x1 = shot.x + (Math.max(gap.top, shot.y) - shot.y) * shot.vx / shot.vy;
  const x2 = shot.x + (gap.bottom - shot.y) * shot.vx / shot.vy;
  return Math.max(x1, x2) + shot.radius + 10 >= gap.left && Math.min(x1, x2) - shot.radius - 10 <= gap.right;
}

test('altı boss yeni HP hedeflerini ve mevcut sınırlı Endless HP ölçeğini kullanır', () => {
  const hp = [32, 60, 52, 85, 76, 130];
  for (let index = 0; index < 6; index++) {
    const boss = createBoss(index, bounds); assert.equal(boss.hp, hp[index]); assert.equal(boss.maxHp, hp[index]);
    const late = createBoss(index, bounds, 10000); assert.equal(late.maxHp, Math.round(hp[index] * 1.8));
    assert.ok(BOSS_CONFIGS[index].telegraphDuration >= .7 && BOSS_CONFIGS[index].telegraphDuration <= .9);
  }
});
test('boss hareketleri kendi hız sınırlarına uyar; sınır/üst bölge korunur, teleport olmaz', () => {
  for (const arena of [bounds, { width: 960, height: 540 }]) for (let index = 0; index < 6; index++) {
    const boss = createBoss(index, arena), shots = []; boss.hp = boss.maxHp * .2;
    const config = BOSS_CONFIGS[index];
    for (let frame = 0; frame < 1800; frame++) {
      const previous = boss.x, dashing = boss.dashRemaining > 0;
      updateBoss(boss, 1 / 60, arena, { x: frame % 240 < 120 ? 22 : arena.width - 22, y: arena.height * .8 }, shots);
      const limit = dashing ? BOSS_BALANCE.dashSpeed + boss.phase * BOSS_BALANCE.phaseDashIncrease : config.maxMoveSpeed;
      assert.ok(Math.abs(boss.x - previous) <= limit / 60 + 1e-8);
      assert.ok(boss.x >= config.width / 2 && boss.x <= arena.width - config.width / 2);
      assert.ok(boss.y < arena.height * .3);
    }
  }
});
test('ilk ve sonraki atış uyarı süresini bekler; kayan nokta eşiğinde çift atış olmaz', () => {
  for (let index = 0; index < 6; index++) {
    const boss = createBoss(index, bounds), shots = []; boss.cooldown = 0;
    updateBoss(boss, 0, bounds, player, shots);
    const duration = BOSS_CONFIGS[index].telegraphDuration;
    for (let time = 0; time < duration - .011; time += .01) updateBoss(boss, .01, bounds, player, shots);
    assert.equal(boss.attack, 0); assert.equal(shots.length, 0);
    updateBoss(boss, .011, bounds, player, shots);
    assert.equal(boss.attack, 1); assert.ok(shots.length > 0); assert.equal(boss.warning, 0);
    updateBoss(boss, .00001, bounds, player, shots); assert.equal(boss.attack, 1);
  }
});
test('HP fazları eşik başına bir kez değişir; iyileştirilmiş faz geri/ileri titreşmez', () => {
  for (let index = 0; index < 6; index++) {
    const boss = createBoss(index, bounds);
    for (const [phase, threshold] of BOSS_CONFIGS[index].phaseThresholds.entries()) {
      boss.hp = boss.maxHp * threshold; updateBoss(boss, 0, bounds, player, []);
      assert.equal(boss.phase, phase + 1); assert.equal(boss.phaseChanges, phase + 1);
      for (let i = 0; i < 20; i++) updateBoss(boss, 0, bounds, player, []);
      assert.equal(boss.phaseChanges, phase + 1);
    }
    const changes = boss.phaseChanges; boss.hp = boss.maxHp;
    updateBoss(boss, 0, bounds, player, []); assert.equal(boss.phaseChanges, changes);
  }
});
test('uyarıdaki plan hedef/HP değişiminden etkilenmez; yeni faz sonraki plana uygulanır', () => {
  const boss = createBoss(1, bounds), shots = []; boss.cooldown = 0;
  updateBoss(boss, 0, bounds, player, shots);
  const plan = structuredClone(boss.plan);
  boss.hp = 1; updateBoss(boss, .1, bounds, { x: 22, y: 800 }, shots);
  assert.equal(boss.phase, 1); assert.deepEqual(boss.plan, plan);
  for (let i = 0; i < 100 && boss.attack === 0; i++) updateBoss(boss, .01, bounds, { x: 22, y: 800 }, shots);
  assert.deepEqual(shots, plan.projectiles);
  boss.cooldown = 0; updateBoss(boss, 0, bounds, player, []);
  assert.equal(boss.plan.phase, 1); assert.equal(boss.plan.kind, 'fan');
});
test('Sentinel tek/çift, Guardian çift/yelpaze ve Hunter yönlü/çapraz saldırıları ayrıdır', () => {
  for (const [index, phase, attack, kind] of [[0, 0, 0, 'single'], [0, 0, 1, 'double'], [1, 0, 0, 'double'], [1, 1, 1, 'fan'], [2, 1, 0, 'aimed'], [2, 1, 1, 'cross']]) {
    const boss = createBoss(index, bounds); boss.phase = phase; boss.attack = attack;
    const plan = planBossAttack(boss, bounds, player);
    assert.equal(plan.kind, kind); assert.ok(plan.projectiles.length > 0);
    if (kind === 'double' || kind === 'cross') assert.equal(plan.projectiles.length, 2);
  }
});
test('Nebula yelpazesi dönüşür; Overlord katmanlı ve koridor saldırılarını dönüşümlü kullanır', () => {
  const core = createBoss(3, bounds); core.phase = 2;
  const first = planBossAttack(core, bounds, player); core.attack++;
  const second = planBossAttack(core, bounds, player);
  assert.notDeepEqual(first.projectiles, second.projectiles); assert.ok(first.projectiles.length >= 4);
  const boss = createBoss(5, bounds); boss.phase = 2;
  const layered = planBossAttack(boss, bounds, player); boss.attack = 1;
  const corridor = planBossAttack(boss, bounds, player);
  assert.equal(layered.kind, 'layered'); assert.ok(layered.projectiles.length >= 6);
  assert.ok(new Set(layered.projectiles.map(p => p.y)).size > 1);
  assert.equal(corridor.kind, 'corridor'); assert.ok(corridor.projectiles.length >= 3);
  assert.ok(corridor.projectiles.every(p => p.vx === 0));
});
test('bütün desenler sınır içinden doğar; aşağı yönlü, sınırlı hızlı ve ulaşılabilir koridorludur', () => {
  for (const width of [320, 540, 960]) for (let index = 0; index < 6; index++) {
    const arena = { width, height: width === 960 ? 540 : 1000 }, config = BOSS_CONFIGS[index];
    for (const x of [config.width / 2 + 18, width / 2, width - config.width / 2 - 18])
      for (const targetX of [22, width / 2, width - 22])
        for (let phase = 0; phase <= config.phaseThresholds.length; phase++)
          for (let attack = 0; attack < 4; attack++) {
            const boss = createBoss(index, arena); Object.assign(boss, { x, phase, attack });
            const plan = planBossAttack(boss, arena, { x: targetX, y: arena.height * .8 });
            assert.equal(plan.deferred, false);
            const gap = plan.safeGap;
            assert.ok(gap.left >= 0 && gap.right <= width && gap.right - gap.left >= 90);
            const toSafety = Math.max(0, gap.left + 22 - targetX, targetX - gap.right + 22);
            assert.ok(toSafety <= 280 * config.telegraphDuration + 1e-8);
            for (const shot of plan.projectiles) {
              assert.ok(Number.isFinite(shot.vx + shot.vy) && shot.vy > 0);
              assert.ok(Math.hypot(shot.vx, shot.vy) <= 220 + 1e-8);
              assert.ok(shot.x >= 8 && shot.x <= width - 8 && shot.y < arena.height * .3);
              assert.equal(intersectsGap(shot, gap), false);
            }
          }
  }
});
test('yeni koridor önceki boss mermileriyle kapanmaz; yer kalmayınca yeni saldırı ertelenir', () => {
  const boss = createBoss(5, bounds); boss.phase = 2;
  const first = planBossAttack(boss, bounds, player);
  boss.safeLane = { left: first.safeGap.left, right: first.safeGap.right }; boss.attack++;
  const shots = structuredClone(first.projectiles);
  for (const shot of shots) { shot.x += shot.vx; shot.y += shot.vy; }
  const next = planBossAttack(boss, bounds, { x: (first.safeGap.left + first.safeGap.right) / 2, y: 800 }, shots);
  assert.equal(next.deferred, false);
  assert.ok([...shots, ...next.projectiles].every(p => !intersectsGap(p, next.safeGap)));
  const wall = Array.from({ length: 28 }, (_, i) => ({ x: i * 20, y: 650, vx: 0, vy: 170, radius: 6, boss: true }));
  const blocked = planBossAttack(boss, bounds, player, wall);
  assert.equal(blocked.deferred, true); assert.equal(blocked.projectiles.length, 0);
});
test('boss başına ve global 28 mermi sınırları dolu/dar bütçede aşılmaz', () => {
  for (let index = 0; index < 6; index++) {
    const boss = createBoss(index, bounds);
    const shots = Array.from({ length: BOSS_CONFIGS[index].maxProjectiles - 1 }, () => ({ x: 12, y: 10, vx: 0, vy: 170, radius: 6, boss: true }));
    fireNext(boss, shots);
    assert.ok(shots.filter(p => p.boss).length <= BOSS_CONFIGS[index].maxProjectiles);
    assert.ok(shots.length <= 28);
    for (const count of [27, 28]) {
      const limited = Array.from({ length: count }, () => ({ x: 12, y: 10, vx: 0, vy: 170, radius: 5, boss: false }));
      fireNext(createBoss(index, bounds), limited); assert.ok(limited.length <= 28);
    }
  }
});
test('Stalker sonraki fazda ikinci atılımı ayrıca uyarır ve atılım süresi sınırlıdır', () => {
  const boss = createBoss(4, bounds), shots = []; boss.hp = 1; boss.cooldown = 0;
  let starts = 0, wasWarning = false, previousX = boss.x;
  for (let i = 0; i < 600; i++) {
    updateBoss(boss, 1 / 60, bounds, { x: 400, y: 800 }, shots);
    if (boss.warning > 0 && !wasWarning) starts++;
    wasWarning = boss.warning > 0;
    assert.ok(Math.abs(boss.x - previousX) <= 300 / 60 + 1e-8); previousX = boss.x;
    assert.ok(boss.dashRemaining <= .55);
  }
  assert.ok(starts >= 3); assert.ok(boss.attack >= 3);
});
test('boyut değişimi eski saldırı planını iptal eder ve tam uyarıyla yeniden planlar', () => {
  const state = createGameState(0, bounds); startRun(state, 'campaign', 30);
  state.run.stage = 'BOSS'; state.boss = createBoss(5, bounds); state.boss.cooldown = 0;
  updateGame(state, idle, 0); const oldPlan = state.boss.plan;
  resizeGame(state, { width: 960, height: 540 });
  assert.equal(state.boss.plan, null);
  updateGame(state, idle, 0);
  assert.notDeepEqual(state.boss.plan, oldPlan); assert.equal(state.boss.warning, .9);
  assert.equal(state.hostile.length, 0); assert.equal(state.boss.attack, 0);
});
test('koridoru 0/200 ms gecikmeyle takip eden sınırlı hızlı oyuncu boss testinde hasar almaz', () => {
  for (const reactionTime of [0, .2]) for (let index = 0; index < 6; index++) {
    const boss = createBoss(index, bounds); boss.hp = boss.maxHp * .2;
    const ship = { ...player }; let shots = [], attacks = 0;
    let seenPlan = null, reactionRemaining = 0, targetX = ship.x;
    for (let i = 0; i < 45 * 60; i++) {
      shots = updateHostileProjectiles(shots, 1 / 60, bounds);
      updateBoss(boss, 1 / 60, bounds, ship, shots);
      if (boss.plan && boss.plan !== seenPlan) { seenPlan = boss.plan; reactionRemaining = reactionTime; }
      reactionRemaining = Math.max(0, reactionRemaining - 1 / 60);
      if (boss.plan && !boss.plan.deferred && reactionRemaining <= 1e-9) {
        const gap = boss.plan.safeGap;
        targetX = (gap.left + gap.right) / 2;
      }
      updatePlayer(ship, { x: 0, y: 0, targetX }, 1 / 60, bounds, 280);
      for (const shot of shots) assert.equal(overlaps({ ...ship, width: 30, height: 38 }, { ...shot, width: 12, height: 12 }), false, `${BOSS_CONFIGS[index].name} t=${i / 60}`);
      attacks = boss.attack;
    }
    assert.ok(attacks >= 6);
  }
});

test('faz ilerledikçe bekleme kısalır ve örnek saldırı döngüsünün mermi baskısı azalmaz', () => {
  for (let index = 0; index < 6; index++) {
    const config = BOSS_CONFIGS[index], boss = createBoss(index, bounds);
    let previousCount = 0, previousCooldown = Infinity;
    for (let phase = 0; phase <= config.phaseThresholds.length; phase++) {
      boss.phase = phase;
      let count = 0;
      for (let attack = 0; attack < 2; attack++) {
        boss.attack = attack; count += planBossAttack(boss, bounds, player).projectiles.length;
      }
      const cooldown = Math.max(BOSS_BALANCE.minCooldown, config.fireCooldown - phase * BOSS_BALANCE.phaseCooldownReduction);
      assert.ok(count >= previousCount, config.name); assert.ok(cooldown <= previousCooldown);
      previousCount = count; previousCooldown = cooldown;
    }
  }
});
test('altı boss’un bekleyen planları ölümde düşer; Campaign biterken Endless kesilmez', () => {
  for (const mode of ['campaign', 'endless']) for (let index = 0; index < 6; index++) {
    const state = createGameState(0, bounds); startRun(state, mode, (index + 1) * 5);
    if (mode === 'campaign') {
      state.run.stage = 'BOSS'; state.run.wave = 3; state.run.pending = []; state.run.destroyed = 10;
      state.boss = createBoss(index, bounds);
    } else {
      Object.assign(state.run, { wave: (index + 1) * 5, nextBossTier: (index + 1) * 5, encountersStarted: index, bossWarningRemaining: 0 });
      updateGame(state, idle, 0);
    }
    state.boss.cooldown = 0; updateGame(state, idle, 0); assert.ok(state.boss.plan);
    state.hostile.push({ x: 400, y: 200, vx: 0, vy: 170, radius: 6, boss: true });
    state.hostile.push({ x: 450, y: 200, vx: 0, vy: 170, radius: 5, boss: false });
    state.shooting.bullets.push(...Array.from({ length: state.boss.hp }, () => ({ x: state.boss.x, y: state.boss.y })));
    updateGame(state, idle, 0);
    assert.equal(state.boss, null); assert.equal(state.run.bossKills, 1);
    assert.ok(state.hostile.every(p => !p.boss));
    if (mode === 'campaign') {
      assert.equal(state.phase, 'LEVEL_COMPLETE'); assert.equal(state.run.stars, 3); assert.equal(state.hostile.length, 0);
      const frozen = structuredClone(state); updateGame(state, idle, .05); assert.deepEqual(state, frozen);
    } else {
      assert.equal(state.phase, 'PLAYING'); assert.equal(state.run.stage, 'WAVE'); assert.equal(state.hostile.length, 1);
      assert.equal(state.run.activeBossEncounter, null); assert.equal(state.run.encountersStarted, index + 1);
      for (let frame = 0; frame < 12; frame++) updateGame(state, idle, 1 / 60);
      assert.ok(state.hostile.every(p => !p.boss)); assert.equal(state.run.bossKills, 1);
    }
  }
});
