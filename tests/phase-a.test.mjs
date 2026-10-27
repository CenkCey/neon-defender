import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, startRun, updateGame, restartGame, runSummary } from '../src/world.ts';
import { createRun, killsForTier, advanceEndlessTier, runDifficulty } from '../src/director.ts';
import { ENEMY_TYPES, ENDLESS_CONFIG, endlessDifficulty, BOSS_CONFIGS } from '../src/content.ts';
import { createActor, updateActors } from '../src/enemies.ts';
import { createProgressStore } from '../src/progress.ts';

const idle = { x: 0, y: 0, shooting: false }, bounds = { width: 540, height: 1000 };
function playing(mode = 'endless', level = 1) {
  const state = createGameState(0, bounds); startRun(state, mode, level, () => .5); return state;
}
function kill(state, enemy) {
  state.shooting.bullets.push(...Array.from({ length: enemy.hp }, () => ({ x: enemy.x, y: enemy.y })));
  updateGame(state, idle, 0, () => 1);
}
function actor(state, kind = 'S', x = 100) {
  const enemy = createActor(kind, state.bounds, 1, () => .5);
  Object.assign(enemy, { x, originX: x, y: 180, speed: 0 });
  state.enemies.enemies.push(enemy); state.run.spawned++; return enemy;
}

test('tier gereksinimi 8 ile başlar, her üç tier artar ve 18’de durur', () => {
  assert.deepEqual([1, 2, 3, 4, 7, 30, 31, 1000].map(killsForTier), [8, 8, 8, 9, 10, 17, 18, 18]);
  const run = createRun('endless');
  run.destroyed = 7; advanceEndlessTier(run); assert.equal(run.wave, 1);
  run.destroyed = 8; advanceEndlessTier(run); assert.equal(run.wave, 2); assert.equal(run.nextTierKills, 16);
  run.destroyed = 24; advanceEndlessTier(run); assert.equal(run.wave, 4); assert.equal(run.nextTierKills, 33);
  assert.equal(run.tierStartKills, 24);
  advanceEndlessTier(run); assert.equal(run.wave, 4);
});
test('tier değişimi mermileri, düşmanları ve üretim saatini sıfırlamaz', () => {
  const state = playing(); state.run.destroyed = 7; state.run.spawnRemaining = .33;
  state.shooting.bullets.push({ x: 420, y: 600 });
  state.hostile.push({ x: 410, y: 300, vx: 0, vy: 170, radius: 5, boss: false });
  const survivor = actor(state, 'S', 300), victim = actor(state);
  kill(state, victim);
  assert.equal(state.run.wave, 2); assert.equal(state.run.stage, 'WAVE'); assert.equal(state.run.spawnRemaining, .33);
  assert.ok(state.enemies.enemies.includes(survivor));
  assert.ok(state.shooting.bullets.some(b => b.x === 420)); assert.equal(state.hostile.length, 1);
});
test('Endless sahası boşalsa bile yeni üretim için wave beklemez', () => {
  const state = playing(); state.run.spawnRemaining = 0;
  updateGame(state, idle, 0, () => .5); assert.equal(state.run.spawned, 1);
  state.enemies.enemies[0].y = 180;
  kill(state, state.enemies.enemies[0]); assert.equal(state.enemies.enemies.length, 0); assert.equal(state.run.stage, 'WAVE');
  const elapsed = state.run.spawnRemaining;
  for (let i = 0; i < Math.ceil(elapsed * 60) + 1; i++) updateGame(state, { ...idle, shooting: true }, 1 / 60, () => .5);
  assert.ok(state.run.spawned >= 2); assert.ok(state.run.shots > 0); assert.equal(state.run.stage, 'WAVE');
});
test('kaçış veya boss ölümü tier öldürmesine eklenmez; Splitter ve çocukları ayrı sayılır', () => {
  const state = playing(); state.run.spawnRemaining = 100;
  const escape = actor(state); escape.y = bounds.height + 100;
  updateGame(state, idle, 0); assert.equal(state.run.destroyed, 0); assert.equal(state.run.escaped, 1);
  const parent = actor(state, 'P'); kill(state, parent);
  assert.equal(state.run.destroyed, 1); assert.equal(state.pendingChildren.length, 2);
  updateGame(state, idle, 0); updateGame(state, idle, 0);
  for (const child of [...state.enemies.enemies]) kill(state, child);
  assert.equal(state.run.destroyed, 3);
});
test('boss uyarısı sırasında hareket, ateş ve normal düşmanlar ilerler', () => {
  const state = playing(); state.run.wave = 5; state.run.spawnRemaining = 0;
  const beforeX = state.player.x;
  updateGame(state, { x: 1, y: 0, shooting: true }, .05, () => .5);
  assert.ok(state.player.x > beforeX); assert.equal(state.run.shots, 1);
  assert.equal(state.run.stage, 'WAVE'); assert.ok(state.run.bossWarningRemaining > 0);
  assert.ok(state.enemies.enemies.length > 0);
});
test('boss, eski kalabalık doğal çözülene kadar bekler; düşmanlar silinmez', () => {
  const state = playing(); state.run.wave = 5; state.run.spawnRemaining = 100;
  const old = [actor(state, 'S', 100), actor(state, 'S', 200), actor(state, 'S', 300)];
  updateGame(state, idle, 0);
  for (let i = 0; i < 90; i++) updateGame(state, idle, 1 / 60);
  assert.equal(state.boss, null); assert.equal(state.enemies.enemies.length, 3);
  assert.ok(old.every(e => state.enemies.enemies.includes(e)));
  kill(state, old[0]); updateGame(state, idle, 0);
  assert.ok(state.boss); assert.equal(state.enemies.enemies.length, 2);
});
test('boss yanında children dahil en fazla iki normal düşman; boss ölümü oyuncu ateşini silmez', () => {
  const state = playing(); state.run.wave = 11; state.run.bossWarningRemaining = 0;
  updateGame(state, idle, 0); assert.ok(state.boss);
  for (let i = 0; i < 180; i++) {
    state.invulnerabilityRemaining = 10;
    updateGame(state, idle, 1 / 60, () => .999);
    assert.ok(state.enemies.enemies.length <= 2);
  }
  const parent = state.enemies.enemies.find(enemy => enemy.kind === 'P');
  assert.ok(parent); kill(state, parent);
  assert.equal(state.pendingChildren.length, 2);
  updateGame(state, idle, 0);
  assert.equal(state.enemies.enemies.length, 2); assert.equal(state.pendingChildren.length, 1);
  updateGame(state, idle, 0);
  assert.equal(state.enemies.enemies.length, 2); assert.equal(state.pendingChildren.length, 1);
  state.shooting.bullets.push({ x: 400, y: 600 });
  state.hostile.push({ x: 400, y: 300, vx: 0, vy: 170, radius: 5, boss: false });
  state.hostile.push({ x: 420, y: 300, vx: 0, vy: 170, radius: 5, boss: true });
  const normalKills = state.run.destroyed;
  state.shooting.bullets.push(...Array.from({ length: state.boss.hp }, () => ({ x: state.boss.x, y: state.boss.y })));
  updateGame(state, idle, 0);
  assert.equal(state.run.destroyed, normalKills); assert.equal(state.run.bossKills, 1);
  assert.ok(state.shooting.bullets.some(b => b.x === 400)); assert.ok(state.hostile.some(b => !b.boss));
  assert.ok(state.hostile.every(b => !b.boss)); assert.equal(state.run.stage, 'WAVE');
});
test('aktif boss sırasında gerçek tier ilerlemesi boss kimliğini/HP’sini ve sonraki sırayı değiştirmez', () => {
  const state = playing(); state.run.destroyed = 33; advanceEndlessTier(state.run);
  state.run.spawnRemaining = 100; state.run.bossWarningRemaining = 0;
  updateGame(state, idle, 0);
  const boss = state.boss, hp = boss.maxHp;
  assert.equal(state.run.activeBossEncounter, 1); assert.equal(boss.index, 0);
  state.run.destroyed = 240; advanceEndlessTier(state.run); updateGame(state, idle, 0);
  assert.ok(state.run.wave > 20); assert.equal(state.boss, boss); assert.equal(state.boss.maxHp, hp);
  assert.equal(state.run.activeBossEncounter, 1); assert.equal(state.run.nextBossTier, 10);
  state.shooting.bullets.push(...Array.from({ length: boss.hp }, () => ({ x: boss.x, y: boss.y })));
  updateGame(state, idle, 0);
  for (let i = 0; i < 26; i++) updateGame(state, idle, .05);
  assert.equal(state.boss.index, 1); assert.equal(state.run.activeBossEncounter, 2);
});
test('12 karşılaşma doğru boss dizisini sürdürür; can yalnız 10. karşılaşmada bir kez verilir', () => {
  const state = playing(); state.run.wave = 100; state.run.spawnRemaining = 1000; state.lives = 2;
  for (let encounter = 1; encounter <= 12; encounter++) {
    updateGame(state, idle, 0);
    for (let i = 0; i < 26; i++) updateGame(state, idle, .05);
    assert.ok(state.boss); assert.equal(state.boss.index, (encounter - 1) % 6);
    assert.equal(state.run.activeBossEncounter, encounter); assert.equal(state.run.encountersStarted, encounter);
    const before = state.run.destroyed;
    state.shooting.bullets.push(...Array.from({ length: state.boss.hp }, () => ({ x: state.boss.x, y: state.boss.y })));
    updateGame(state, idle, 0);
    assert.equal(state.run.destroyed, before); assert.equal(state.run.bossKills, encounter);
    assert.equal(state.lives, encounter < 10 ? 2 : 3);
    assert.equal(state.run.nextBossTier, (encounter + 1) * 5);
    assert.equal(state.run.activeBossEncounter, null);
  }
  assert.equal(state.run.rewardedBossEncounter, 10);
});
test('10. boss ödülü tier 57’de de geçerli; 3 HP üstüne çıkmaz, ölümden döndürmez', () => {
  for (const lives of [0, 1, 3]) {
    const state = playing(); Object.assign(state.run, { wave: 57, encountersStarted: 9, nextBossTier: 50, bossWarningRemaining: 0, spawnRemaining: 100 });
    state.lives = 3; updateGame(state, idle, 0); state.lives = lives;
    state.shooting.bullets.push(...Array.from({ length: state.boss.hp }, () => ({ x: state.boss.x, y: state.boss.y })));
    updateGame(state, idle, 0);
    assert.equal(state.lives, lives === 0 ? 0 : Math.min(3, lives + 1));
    assert.equal(state.phase, lives === 0 ? 'GAME_OVER' : 'PLAYING');
  }
});
test('Endless oyuncusu skorla değil öldürmeyle 180→160 ms ve 280→390 hız alır', () => {
  for (const [mode, kills, score, speed, cooldown] of [['endless', 0, 99999, 280, .18], ['endless', 120, 0, 335, .17], ['endless', 240, 0, 390, .16], ['endless', 10000, 0, 390, .16], ['campaign', 240, 0, 280, .18]]) {
    const state = playing(mode); Object.assign(state.run, { destroyed: kills, spawnRemaining: 100 });
    advanceEndlessTier(state.run); state.score = score; state.player.x = 100;
    updateGame(state, { x: 1, y: 0, shooting: false }, .05, () => .5);
    assert.ok(Math.abs(state.player.x - (100 + speed * .05)) < 1e-6);
    assert.ok(Math.abs(state.shooting.cooldownSeconds - cooldown) < 1e-9);
  }
});
test('düşman baskısı oyuncudan önce sınırına gelir; bütün değerler sınırlı ve monoton', () => {
  let previous = endlessDifficulty(1);
  for (let tier = 1; tier <= 1000; tier++) {
    const value = endlessDifficulty(tier);
    assert.ok(value.speedMultiplier >= previous.speedMultiplier && value.speedMultiplier <= 1.4);
    assert.ok(value.spawnInterval <= previous.spawnInterval && value.spawnInterval >= .8);
    assert.ok(value.maxConcurrent >= previous.maxConcurrent && value.maxConcurrent <= 7);
    previous = value;
  }
  assert.equal(endlessDifficulty(1).maxConcurrent, 4); assert.equal(endlessDifficulty(1).spawnInterval, 1.3);
  const run = createRun('endless'); run.destroyed = 180; advanceEndlessTier(run);
  assert.equal(runDifficulty(run).speedMultiplier, 1.4); assert.ok(run.destroyed < ENDLESS_CONFIG.playerProgressKills);
});
test('Shooter ilk atış 1,4 sn; tekrar 2,6→1,8 sn ve mermi 170→210', () => {
  for (const [progress, interval, speed] of [[0, 2.6, 170], [1, 1.8, 210]]) {
    const enemy = createActor('H', bounds, 1); enemy.y = 30; enemy.speed = 0;
    const shots = [];
    updateActors([enemy], 1.39, bounds, shots, progress); assert.equal(shots.length, 0);
    updateActors([enemy], .01, bounds, shots, progress); assert.equal(shots.length, 1);
    assert.equal(shots[0].vy, speed); assert.ok(Math.abs(enemy.fireRemaining - interval) < 1e-9);
    updateActors([enemy], interval - .01, bounds, shots, progress); assert.equal(shots.length, 1);
    updateActors([enemy], .01, bounds, shots, progress); assert.equal(shots.length, 2);
  }
});
test('yeni düşman HP/hız tablosu iki modda aynı; Striker dash 320 birim/sn ile sınırlıdır', () => {
  const expected = { S: [105, 1], Z: [115, 1], T: [78, 4], H: [90, 2], P: [95, 3], K: [105, 2], C: [120, 1] };
  for (const [kind, [speed, hp]] of Object.entries(expected)) {
    assert.equal(ENEMY_TYPES[kind].speed, speed); assert.equal(ENEMY_TYPES[kind].hp, hp);
    const enemy = createActor(kind, bounds, 1, () => 1); assert.equal(enemy.speed, speed); assert.equal(enemy.hp, hp);
  }
  const striker = createActor('K', bounds, 5); striker.y = 100; striker.dashRemaining = 1;
  updateActors([striker], .05, bounds, []); assert.ok(Math.abs(striker.y - 116) < 1e-9);
  assert.deepEqual(BOSS_CONFIGS.map(b => b.hp), [32, 60, 52, 85, 76, 130]);
});
test('Campaign L1–2 tempo ve reçetelerini korur; sonrakiler kontrollü üretim baskısı alır', () => {
  assert.equal(runDifficulty(createRun('campaign', 1)).spawnInterval, 8);
  assert.equal(runDifficulty(createRun('campaign', 2)).spawnInterval, 45 / 8);
  assert.equal(runDifficulty(createRun('campaign', 1)).maxConcurrent, 3);
  assert.equal(runDifficulty(createRun('campaign', 3)).spawnInterval, 4.5);
  assert.equal(runDifficulty(createRun('campaign', 3)).maxConcurrent, 4);
  const campaign = createRun('campaign'); campaign.destroyed = 1000; advanceEndlessTier(campaign);
  assert.equal(campaign.wave, 1); assert.equal(campaign.pending.length, 3);
});
test('restart encounter/tier sayaçlarını temizler; kalıcı Campaign ve rekor korunur', () => {
  const data = new Map(), store = createProgressStore({ getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) });
  store.finish({ mode: 'campaign', level: 1, wave: 3, score: 800, destroyed: 8, escaped: 0, seconds: 50, accuracy: 1, stars: 3, completed: true });
  const state = playing(); state.run.wave = 12; state.run.destroyed = 150; state.run.encountersStarted = 2;
  state.highScore = 2000; state.score = 2000; store.finish(runSummary(state));
  restartGame(state); assert.equal(state.run.wave, 1); assert.equal(state.run.destroyed, 0); assert.equal(state.run.encountersStarted, 0);
  assert.equal(state.run.nextBossTier, 5); assert.equal(state.run.bossWarningRemaining, null); assert.equal(state.highScore, 2000);
  assert.equal(store.value.campaign.highestUnlockedLevel, 2); assert.equal(store.value.campaign.starsByLevel[1], 3);
  assert.equal(store.value.endless.bestScore, 2000); assert.equal(store.value.endless.highestWave, 12);
});
