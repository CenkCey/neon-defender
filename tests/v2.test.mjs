import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, BOSS_CONFIGS, ENEMY_TYPES, endlessDifficulty, pickEndlessEnemy, galaxyForWave } from '../src/content.ts';
import { createGameState, startRun, restartGame, updateGame, damagePlayer, runSummary, resizeGame } from '../src/world.ts';
import { createRun, campaignStars } from '../src/director.ts';
import { createActor, updateActors } from '../src/enemies.ts';
import { createBoss, updateBoss } from '../src/bosses.ts';
import { createProgressStore, normalizeProgress, SAVE_KEY } from '../src/progress.ts';

const idle = { x: 0, y: 0, shooting: false };
const bounds = { width: 540, height: 1000 };
const run = (mode = 'campaign', level = 1) => { const state = createGameState(0, bounds); startRun(state, mode, level, () => .5); return state; };
function clearEnemies(state, dt = 0) {
  for (const enemy of state.enemies.enemies) {
    for (let i = 0; i < (enemy.hp ?? 1); i++) state.shooting.bullets.push({ x: enemy.x, y: enemy.y + (640 + enemy.speed) * dt });
  }
}
const memory = () => {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('30 level × 3 dalga, 3 galaksi, doğru altı boss ve ilk bölüm reçeteleri', () => {
  assert.equal(LEVELS.length, 30);
  assert.deepEqual(LEVELS.filter(l => l.bossIndex !== null).map(l => l.level), [5, 10, 15, 20, 25, 30]);
  for (const level of LEVELS) {
    assert.equal(level.waves.length, 3); assert.equal(level.galaxy, Math.floor((level.level - 1) / 10));
    for (const wave of level.waves) assert.ok(wave.length > 0 && wave.every(type => ENEMY_TYPES[type]));
    if (level.level < 3) assert.ok(level.waves.flat().every(k => k === 'S'));
    if (level.level < 11) assert.ok(!level.waves.flat().includes('P'));
    if (level.level < 21) assert.ok(!level.waves.flat().includes('K'));
  }
  assert.deepEqual(LEVELS[0].waves.map(w => w.length), [3, 3, 2]);
  assert.deepEqual(LEVELS[29].waves.map(w => w.length), [6, 5, 7]);
  assert.deepEqual(BOSS_CONFIGS.map(b => b.hp), [32, 60, 52, 85, 76, 130]);
});
test('Endless sınırları çok büyük wave değerinde de korunur; tema ve tür havuzları açılır', () => {
  for (const wave of [1, 10, 30, 35, 100, 1000000]) {
    const d = endlessDifficulty(wave);
    assert.ok(d.speedMultiplier <= 1.4 && d.spawnInterval >= .8 && d.maxConcurrent <= 7);
  }
  assert.deepEqual([1, 11, 21, 31, 41].map(galaxyForWave), [0, 1, 2, 0, 1]);
  assert.equal(pickEndlessEnemy(1), 'S');
  assert.equal(pickEndlessEnemy(11, () => 1), 'P');
  assert.equal(pickEndlessEnemy(31, () => 1), 'K');
});
test('yıldızlar %60/%85 eşiklerini, HP ve başarısızlığı doğru uygular', () => {
  const r = createRun('campaign');
  for (const [destroyed, escaped, hp, stars] of [[5, 5, 3, 0], [6, 4, 1, 1], [6, 4, 2, 2], [8, 2, 3, 2], [17, 3, 3, 3], [10, 0, 0, 0]]) {
    Object.assign(r, { destroyed, escaped }); assert.equal(campaignStars(r, hp), stars);
  }
});
test('30 bölümün gerçek wave/boss geçişleri tek seferlik sonuç ve doğru sayaçla biter', () => {
  for (let level = 1; level <= 30; level++) {
    const state = run('campaign', level);
    let bosses = 0, lastBoss = null;
    for (let frame = 0; frame < 18000 && state.phase === 'PLAYING'; frame++) {
      clearEnemies(state, .05);
      if (state.boss) {
        if (state.boss !== lastBoss) { bosses++; lastBoss = state.boss; }
        for (let i = 0; i < state.boss.hp; i++) state.shooting.bullets.push({ x: state.boss.x, y: state.boss.y + 32 });
      }
      updateGame(state, idle, .05, () => .5);
    }
    assert.equal(state.phase, 'LEVEL_COMPLETE', `L${level}`);
    assert.equal(state.run.stars, 3); assert.equal(state.run.spawned, state.run.destroyed + state.run.escaped);
    assert.equal(bosses, level % 5 === 0 ? 1 : 0); assert.equal(state.run.bossKills, bosses);
    const frozen = structuredClone(state); updateGame(state, idle, .05); assert.deepEqual(state, frozen);
  }
});
test('bütün düşmanları kaçıran Campaign oyuncusu unlock veya yıldız alamaz', () => {
  const state = run();
  for (let frame = 0; frame < 10000 && state.phase === 'PLAYING'; frame++) {
    for (const enemy of state.enemies.enemies) enemy.y = bounds.height + 100;
    updateGame(state, idle, .05, () => .1);
  }
  assert.equal(state.phase, 'GAME_OVER'); assert.equal(state.run.stars, 0);
  assert.equal(state.lives, 3); assert.match(state.run.failure, /%60/);
});
test('Tank dört mermiyle ölür; isabet, ölüm ve skor birbirine karışmaz', () => {
  const state = run('campaign', 6); state.run.spawnRemaining = 100;
  const enemy = createActor('T', bounds, 1); enemy.x = 200; enemy.y = 200; enemy.speed = 0;
  state.enemies.enemies.push(enemy); state.run.spawned++;
  for (let hit = 1; hit <= 4; hit++) {
    state.shooting.bullets.push({ x: 200, y: 200 }); updateGame(state, idle, 0, () => 1);
    assert.equal(state.run.hits, hit); assert.equal(state.run.destroyed, hit === 4 ? 1 : 0);
  }
  assert.equal(state.score, 180);
});
test('son Splitter çocuklarını ayrı sayar; çocuklar bitmeden wave ilerlemez', () => {
  const state = run('campaign', 11); state.run.pending = [];
  const enemy = createActor('P', bounds, 1); enemy.x = 200; enemy.y = 200;
  state.enemies.enemies.push(enemy); state.run.spawned = 1;
  clearEnemies(state); updateGame(state, idle, 0, () => 1);
  assert.equal(state.run.stage, 'WAVE'); assert.equal(state.run.destroyed, 1); assert.equal(state.pendingChildren.length, 2);
  updateGame(state, idle, 0); updateGame(state, idle, 0);
  assert.equal(state.run.spawned, 3); assert.equal(state.enemies.enemies.length, 2);
  clearEnemies(state); updateGame(state, idle, 0, () => 1);
  assert.equal(state.run.destroyed, 3); assert.equal(state.run.stage, 'TRANSITION');
});
test('Shield tek hit tüketilir; aynı karede çoklu hasar en fazla bir kez uygulanır', () => {
  const state = run(); state.shield = true;
  assert.equal(damagePlayer(state), true); assert.equal(state.lives, 3); assert.equal(state.shield, false);
  assert.equal(damagePlayer(state), false); assert.equal(state.lives, 3);
  state.invulnerabilityRemaining = 0; damagePlayer(state); assert.equal(state.lives, 2);
});
test('Rapid Fire yedi saniye sonra biter; yeniden pickup süresini yeniler, restart temizler', () => {
  const state = run('campaign', 6); state.run.spawnRemaining = 100;
  state.pickups.push({ ...state.player, kind: 'rapid', age: 0 }); updateGame(state, idle, 0);
  assert.equal(state.rapidRemaining, 7);
  for (let i = 0; i < 60; i++) updateGame(state, idle, .05);
  assert.ok(state.rapidRemaining < 4.01);
  state.pickups.push({ ...state.player, kind: 'rapid', age: 0 }); updateGame(state, idle, 0);
  assert.equal(state.rapidRemaining, 7);
  for (let i = 0; i < 141; i++) updateGame(state, idle, .05);
  assert.equal(state.rapidRemaining, 0); assert.equal(state.shooting.cooldownSeconds, .18);
  restartGame(state); assert.equal(state.rapidRemaining, 0); assert.equal(state.shield, false); assert.deepEqual(state.pickups, []);
});
test('iki eşzamanlı kaçış breach eşiğini bir kez geçer; üç can zincir hasarla bitmez', () => {
  const state = run('endless'); state.run.breach = 1; state.run.spawnRemaining = 100;
  for (let i = 0; i < 2; i++) { const enemy = createActor('S', bounds, 1); enemy.y = 1100; state.enemies.enemies.push(enemy); }
  updateGame(state, idle, 0); assert.equal(state.lives, 2); assert.equal(state.run.breach, 0); assert.equal(state.run.escaped, 2);
});
test('Endless boss sırası tier ilerlese bile değişmez ve normal üretim kesilmez', () => {
  const state = run('endless'); state.run.wave = 40;
  state.run.encountersStarted = 6; state.run.nextBossTier = 35;
  updateGame(state, idle, 0);
  assert.equal(state.run.stage, 'WAVE'); assert.notEqual(state.run.bossWarningRemaining, null);
  for (let i = 0; i < 26; i++) updateGame(state, idle, .05);
  assert.equal(state.boss.index, 0); assert.equal(state.run.activeBossEncounter, 7);
  const before = state.run.destroyed;
  state.shooting.bullets.push(...Array.from({ length: state.boss.hp }, () => ({ x: state.boss.x, y: state.boss.y })));
  updateGame(state, idle, 0);
  assert.equal(state.run.bossKills, 1); assert.equal(state.run.destroyed, before);
  assert.equal(state.run.activeBossEncounter, null); assert.equal(state.run.stage, 'WAVE');
});
test('boss ölümünde hostile mermiler temizlenir; ölüm/tamamlama yarışında oyuncu ölümü kazanır', () => {
  const state = run('campaign', 5); state.run.wave = 3; state.run.stage = 'BOSS'; state.run.pending = [];
  state.run.destroyed = 10; state.boss = createBoss(0, bounds); state.boss.hp = 1;
  state.hostile.push({ ...state.player, vx: 0, vy: 0, radius: 6, boss: true });
  state.shooting.bullets.push({ x: state.boss.x, y: state.boss.y }); updateGame(state, idle, 0);
  assert.equal(state.phase, 'LEVEL_COMPLETE'); assert.equal(state.lives, 3); assert.deepEqual(state.hostile, []);
  const dead = run('campaign', 5); dead.run.wave = 3; dead.run.stage = 'BOSS'; dead.run.pending = []; dead.run.destroyed = 10;
  dead.boss = createBoss(0, bounds); dead.boss.hp = 1; dead.lives = 1;
  const touching = createActor('S', bounds, 1); Object.assign(touching, dead.player); dead.enemies.enemies.push(touching);
  dead.shooting.bullets.push({ x: dead.boss.x, y: dead.boss.y }); updateGame(dead, idle, 0);
  assert.equal(dead.phase, 'GAME_OVER'); assert.equal(dead.run.stars, 0);
});
test('boss fazları bir kez değişir; her özel saldırıda uyarı, sınırlı mermi ve sahada kalma', () => {
  for (let index = 0; index < 6; index++) {
    const boss = createBoss(index, bounds), shots = [];
    boss.hp = boss.maxHp * .2;
    for (let i = 0; i < 3000; i++) {
      updateBoss(boss, .05, bounds, { x: 100, y: 800 }, shots);
      assert.ok(shots.length <= BOSS_CONFIGS[index].maxProjectiles);
      assert.ok(boss.x >= BOSS_CONFIGS[index].width / 2 && boss.x <= bounds.width - BOSS_CONFIGS[index].width / 2);
      assert.ok(boss.y < bounds.height * .3);
    }
    assert.equal(boss.phaseChanges, BOSS_CONFIGS[index].phaseThresholds.length);
    assert.ok(boss.attack > 2);
  }
});
test('Striker dash öncesi 700 ms uyarır; Zigzag sınırda ve Shooter mermileri limitlidir', () => {
  const striker = createActor('K', bounds, 1); striker.y = 20; striker.age = 1.4;
  updateActors([striker], 0, bounds, []); assert.equal(striker.warning, .7); assert.equal(striker.dashRemaining, 0);
  updateActors([striker], .69, bounds, []); assert.equal(striker.dashRemaining, 0);
  updateActors([striker], .01, bounds, []); assert.ok(striker.dashRemaining > 0);
  const enemies = ['Z', 'H'].map(kind => createActor(kind, bounds, 1, () => 0)), shots = [];
  for (let i = 0; i < 4000; i++) { updateActors(enemies, .05, bounds, shots); assert.ok(enemies[0].x >= 22); assert.ok(shots.length <= 28); }
});
test('yeni kayıt L1 ile başlar; başarı açar, düşük yıldız geriletmez, başarısızlık açmaz', () => {
  const storage = memory(), store = createProgressStore(storage);
  assert.equal(store.value.campaign.highestUnlockedLevel, 1);
  const summary = { mode: 'campaign', level: 1, wave: 3, score: 800, destroyed: 8, escaped: 0, seconds: 50, accuracy: .8, stars: 3, completed: true };
  store.finish(summary); assert.equal(store.value.campaign.highestUnlockedLevel, 2);
  store.finish({ ...summary, stars: 1, score: 500 }); assert.equal(store.value.campaign.starsByLevel[1], 3); assert.equal(store.value.campaign.bestScoreByLevel[1], 800);
  store.finish({ ...summary, level: 2, stars: 0, completed: false }); assert.equal(store.value.campaign.highestUnlockedLevel, 2);
  assert.equal(createProgressStore(storage).value.campaign.starsByLevel[1], 3);
  for (let level = 2; level <= 20; level++) store.finish({ ...summary, level });
  assert.equal(store.value.campaign.highestUnlockedLevel, 21);
});
test('eski rekor ve tercih taşınır; bozuk/eksik/yabancı şema güvenli açılır ve hata belleğe düşer', () => {
  const storage = memory(); storage.data.set('neon-defender.high-score.v1', '2500'); storage.data.set('neon-defender.controls.v1', 'tilt');
  let store = createProgressStore(storage); assert.equal(store.value.endless.bestScore, 2500); assert.equal(store.value.settings.controlMode, 'tilt');
  store.settings({ soundEnabled: true, tiltCalibration: 14.5 });
  store = createProgressStore(storage); assert.equal(store.value.settings.tiltCalibration, 14.5); assert.equal(store.value.settings.soundEnabled, true);
  for (const data of ['{', 'null', '[]', '{"campaign":{"starsByLevel":{"5":3}},"schemaVersion":0}']) {
    storage.data.set(SAVE_KEY, data); assert.doesNotThrow(() => createProgressStore(storage));
  }
  assert.equal(normalizeProgress({ campaign: { starsByLevel: { 10: 3 } } }).campaign.highestUnlockedLevel, 11);
  const blocked = createProgressStore({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  blocked.settings({ soundEnabled: true }); assert.equal(blocked.available, false); assert.equal(blocked.value.settings.soundEnabled, true);
});
test('Endless rekoru gerçek iyileşmede yükselir; run özeti ve kümülatif öldürme saklanır', () => {
  const store = createProgressStore(memory()); const state = run('endless'); state.score = 100; state.run.destroyed = 1; state.elapsedTime = 10;
  const summary = runSummary(state); assert.equal(store.finish(summary), true); assert.equal(store.finish(summary), false);
  assert.equal(store.value.endless.bestScore, 100); assert.equal(store.value.endless.totalEnemiesDestroyed, 2);
  assert.equal(store.value.endless.lastRunSummary.seconds, 10);
});
test('restart ve resize yeni veriyi temizler/ölçekler; sonuçta simülasyon ve timer donar', () => {
  const state = run('campaign', 25); state.run.stage = 'BOSS'; state.boss = createBoss(4, bounds); state.shield = true;
  state.hostile.push({ x: 100, y: 100, vx: 10, vy: 100, radius: 5, boss: true });
  resizeGame(state, { width: 1080, height: 2000 }); assert.equal(state.hostile[0].x, 200); assert.equal(state.boss.x, 540);
  state.phase = 'LEVEL_COMPLETE'; const frozen = structuredClone(state); updateGame(state, idle, .05); assert.deepEqual(state, frozen);
  restartGame(state); assert.equal(state.run.level, 25); assert.equal(state.run.wave, 1); assert.equal(state.lives, 3);
  assert.equal(state.shield, false); assert.equal(state.boss, null); assert.deepEqual(state.hostile, []);
});

test('30 dakikalık Endless stresinde wave 31+ ilerler, bütün nesne bütçeleri sınırlı kalır', () => {
  const state = run('endless');
  let seed = 9;
  const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let frame = 0; frame < 1800 * 30; frame++) {
    // Immunity belongs only to this load fixture, not to the playable game.
    state.invulnerabilityRemaining = 10;
    const target = state.boss ?? state.enemies.enemies.find(e => e.y > 0);
    updateGame(state, { x: 0, y: 0, targetX: target?.x ?? state.player.x, shooting: true }, 1 / 30, rng);
    assert.ok(state.enemies.enemies.length <= 7);
    assert.ok(state.hostile.length <= 28);
    assert.ok(state.pickups.length <= 2);
    assert.ok(state.shooting.bullets.length <= 20);
    assert.ok(state.pendingChildren.length <= 14);
    assert.ok(state.effects.length <= 40);
  }
  assert.ok(state.run.wave > 35); assert.ok(state.run.bossKills >= 7); assert.equal(state.phase, 'PLAYING');
});
test('V2 hareket/atış 30,60,144 FPS ile tutarlı kalır; küçük child hızlı mermiyi atlamaz', () => {
  const outcomes = [];
  for (const fps of [30, 60, 144]) {
    const state = run(); state.run.spawnRemaining = 100; state.player.x = 50;
    for (let i = 0; i < fps; i++) updateGame(state, { x: 1, y: 0, shooting: true }, 1 / fps);
    outcomes.push(state.player.x); assert.ok(state.run.shots >= 5 && state.run.shots <= 6);
  }
  assert.ok(Math.max(...outcomes) - Math.min(...outcomes) < 1e-6);
  const state = run('campaign', 11); state.run.spawnRemaining = 100;
  const child = createActor('C', bounds, 1); child.x = 200; child.originX = 200; child.y = 200;
  state.enemies.enemies.push(child); state.shooting.bullets.push({ x: 200, y: 230 });
  updateGame(state, idle, .05, () => 1); assert.equal(state.run.destroyed, 1);
});
test('wave arası spawn olmaz; geçiş bir sonraki wave’i bir kez açar ve restart temizler', () => {
  const state = run('campaign', 6); state.run.pending = []; state.shield = true; state.rapidRemaining = 7;
  updateGame(state, idle, 0); assert.equal(state.run.stage, 'TRANSITION');
  for (let i = 0; i < 34; i++) updateGame(state, idle, .05);
  assert.equal(state.enemies.enemies.length, 0); assert.equal(state.run.wave, 1);
  updateGame(state, idle, .05); assert.equal(state.run.wave, 2); assert.equal(state.run.stage, 'WAVE');
  restartGame(state); assert.equal(state.run.wave, 1); assert.equal(state.run.stage, 'WAVE');
  assert.equal(state.rapidRemaining, 0); assert.deepEqual(state.pendingChildren, []);
  assert.equal(state.hostile.length, 0); assert.equal(state.run.shots, 0);
});
