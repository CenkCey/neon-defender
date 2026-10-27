import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio, bindAudioLifecycle, SOUND_EFFECTS, AUDIO_CONFIG } from '../src/audio.ts';
import { createProgressStore } from '../src/progress.ts';
import { createGameState, startRun, updateGame, damagePlayer } from '../src/world.ts';
import { createActor } from '../src/enemies.ts';
import { createBoss } from '../src/bosses.ts';

function fakeContext(state = 'suspended') {
  const nodes = [];
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() { this.disconnected = true; } });
  return { state, currentTime: 0, destination: {}, nodes, resumes: 0, suspends: 0,
    createGain() { return { ...node(), gain: param() }; },
    createOscillator() { const result = { ...node(), frequency: param(), start() {}, stop() { this.stopped = true; }, onended: null }; nodes.push(result); return result; },
    async resume() { this.resumes++; this.state = 'running'; },
    async suspend() { this.suspends++; this.state = 'suspended'; },
    async close() { this.state = 'closed'; },
  };
}
async function setup() { const ctx = fakeContext(), audio = createAudio(() => ctx); audio.setEnabled(true); await audio.unlock(); return { ctx, audio }; }
const idle = { x: 0, y: 0, shooting: false };
function simulation(mode = 'endless') {
  const state = createGameState(0, { width: 540, height: 1000 }); startRun(state, mode, 1, () => .5);
  state.run.spawnRemaining = 100;
  const events = [], step = (input = idle, dt = 0) => updateGame(state, input, dt, () => .99, event => events.push(event));
  return { state, events, step };
}

test('ses tercihi mevcut kayıt ile açılıp kapanır; varsayılan kapalı ve depolama hatası güvenli', () => {
  const data = new Map(), storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  const store = createProgressStore(storage); assert.equal(store.value.settings.soundEnabled, false);
  store.settings({ soundEnabled: true }); assert.equal(createProgressStore(storage).value.settings.soundEnabled, true);
  store.settings({ soundEnabled: false }); assert.equal(createProgressStore(storage).value.settings.soundEnabled, false);
  const blocked = createProgressStore({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  blocked.settings({ soundEnabled: true }); assert.equal(blocked.value.settings.soundEnabled, true);
});
test('kapalı durumda context oluşturulmaz; aynı resume ve tek context paylaşılır', async () => {
  const ctx = fakeContext(); let factories = 0;
  const audio = createAudio(() => { factories++; return ctx; });
  await audio.unlock(); assert.equal(factories, 0); audio.setEnabled(true);
  await Promise.all([audio.unlock(), audio.unlock()]); assert.equal(factories, 1); assert.equal(ctx.resumes, 1);
});
test('ilk UI sesi async resume bittikten sonra çalınır; erken oyun sesi kuyrukta birikmez', async () => {
  const ctx = fakeContext(); let release;
  ctx.resume = () => new Promise(resolve => { release = () => { ctx.state = 'running'; resolve(); }; });
  const audio = createAudio(() => ctx); audio.setEnabled(true);
  const ready = audio.gesture('menu'); audio.play('laser'); assert.equal(ctx.nodes.length, 0);
  release(); await ready; await Promise.resolve(); assert.equal(ctx.nodes.length, 1);
});
test('resume sırasında mute veya background eski UI sesini iptal eder', async () => {
  for (const action of ['mute', 'background']) {
    const ctx = fakeContext(); let release;
    ctx.resume = () => new Promise(resolve => { release = () => { ctx.state = 'running'; resolve(); }; });
    const audio = createAudio(() => ctx); audio.setEnabled(true); const ready = audio.gesture('menu');
    if (action === 'mute') audio.setEnabled(false); else audio.suspend();
    release(); await ready; await Promise.resolve(); assert.equal(ctx.nodes.length, 0);
  }
});
test('Web Audio yoksa, constructor veya resume reddedilirse oyun etkilenmez', async () => {
  for (const factory of [() => undefined, () => { throw Error(); }, () => ({ ...fakeContext(), resume: () => Promise.reject(Error()) })]) {
    const audio = createAudio(factory); audio.setEnabled(true); assert.equal(await audio.unlock(), false);
    audio.play('damage'); audio.setEnabled(false); audio.dispose();
  }
});
test('mute devam eden ve ileri zamanlanmış notaları anında durdurup bağlantıları temizler', async () => {
  const { audio, ctx } = await setup(); audio.play('complete'); assert.equal(audio.status.voices, 3);
  audio.setEnabled(false); assert.equal(audio.status.voices, 0);
  assert.ok(ctx.nodes.every(n => n.stopped && n.disconnected)); audio.play('menu'); assert.equal(ctx.nodes.length, 3);
});
test('tekrar sesleri throttle edilir; voice sınırı aşılmaz ve kritik ses yer bulur', async () => {
  const { audio, ctx } = await setup();
  for (let i = 0; i < 100; i++) audio.play('laser'); assert.equal(ctx.nodes.length, 1);
  ctx.currentTime = .1; audio.play('laser'); assert.equal(ctx.nodes.length, 2);
  for (let i = 0; i < 30; i++) { ctx.currentTime += .2; audio.play('hit'); }
  assert.equal(audio.status.voices, AUDIO_CONFIG.maxVoices);
  const count = ctx.nodes.length; audio.play('gameOver'); assert.ok(ctx.nodes.length > count);
  assert.ok(audio.status.voices <= AUDIO_CONFIG.maxVoices);
  assert.ok(Math.max(...Object.values(SOUND_EFFECTS).map(s => s.volume)) * AUDIO_CONFIG.maxVoices * AUDIO_CONFIG.master < 1);
});
test('biten oscillator temizlenir; pause oyun seslerini keser ama menü çalışır', async () => {
  const { audio, ctx } = await setup(); audio.play('laser'); ctx.nodes[0].onended(); assert.equal(audio.status.voices, 0);
  ctx.currentTime = 1; audio.play('destroy'); audio.setPaused(true); assert.equal(audio.status.voices, 0);
  audio.play('damage'); assert.equal(audio.status.voices, 0); audio.play('menu'); assert.equal(audio.status.voices, 1);
  audio.setPaused(false); audio.play('damage'); assert.equal(audio.status.voices, 3);
});
test('background suspend, interrupted resume, dispose ve listener temizliği güvenli', async () => {
  const { audio, ctx } = await setup(); const page = new EventTarget(), host = new EventTarget(); page.hidden = false;
  const cleanup = bindAudioLifecycle(audio, page, host);
  audio.play('laser'); page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(audio.status.voices, 0); assert.equal(ctx.state, 'suspended');
  page.hidden = false; ctx.state = 'interrupted'; page.dispatchEvent(new Event('pointerdown')); await Promise.resolve();
  assert.equal(ctx.state, 'running');
  cleanup(); const before = ctx.suspends; host.dispatchEvent(new Event('blur')); assert.equal(ctx.suspends, before);
  audio.dispose(); assert.equal(ctx.state, 'closed'); assert.equal(await audio.unlock(), false);
});
test('lazer olayı gerçek atışla birebir; cooldown ve pause/sonuçta sessiz', () => {
  const { state, step, events } = simulation(); step({ ...idle, shooting: true }); step({ ...idle, shooting: true });
  assert.deepEqual(events, ['laser']); assert.equal(state.run.shots, 1);
  state.phase = 'GAME_OVER'; step({ ...idle, shooting: true }, .05); assert.deepEqual(events, ['laser']);
});
test('düşman isabet/yok oluş, iki pickup türü ve tekrar kalkan toplama olayları bağlı', () => {
  const { state, step, events } = simulation();
  const enemy = createActor('T', state.bounds, 1, () => .5); enemy.y = 150;
  state.enemies.enemies = [enemy]; state.shooting.bullets = [{ x: enemy.x, y: enemy.y }]; step();
  assert.ok(events.includes('hit')); assert.ok(!events.includes('destroy'));
  enemy.hp = 1; state.shooting.bullets = [{ x: enemy.x, y: enemy.y }]; step(); assert.ok(events.includes('destroy'));
  for (const kind of ['shield', 'shield', 'rapid']) { state.pickups = [{ ...state.player, kind, age: 0 }]; step(); }
  assert.equal(events.filter(e => e === 'pickup').length, 3);
});
test('hasar yalnızca kabul edilince ses verir; son can Game Over tek sefer', () => {
  const { state, events, step } = simulation();
  damagePlayer(state, e => events.push(e)); damagePlayer(state, e => events.push(e)); assert.deepEqual(events, ['damage']);
  state.lives = 1; state.invulnerabilityRemaining = 0;
  state.hostile = [{ ...state.player, radius: 5, vx: 0, vy: 0 }]; step(); step();
  assert.equal(events.filter(e => e === 'gameOver').length, 1);
});
test('Endless boss geliş, telegraph, gerçek saldırı ve defeat olayları bağlı', () => {
  const { state, step, events } = simulation(); state.run.wave = state.run.nextBossTier;
  step(); assert.equal(events.filter(e => e === 'bossArrival').length, 1);
  state.run.bossWarningRemaining = 0; step(); assert.ok(state.boss);
  state.boss.cooldown = 0; step(); assert.ok(events.includes('bossWarning'));
  for (let i = 0; i < 100 && !events.includes('bossAttack'); i++) step(idle, .02);
  assert.ok(events.includes('bossAttack')); state.boss.hp = 0; step(); step();
  assert.equal(events.filter(e => e === 'bossDefeat').length, 1);
});
test('Campaign wave ve boss intro, bölüm/final sonuç sesleri tek sefer; simülasyon değişmez', () => {
  for (const level of [1, 30]) {
    const { state, step, events } = simulation('campaign'); state.run.level = level;
    state.run.pending = []; step(); assert.ok(events.includes('transition'));
    state.run.level = 5; state.run.stage = 'BOSS_INTRO'; state.run.transitionRemaining = 0; step(); assert.ok(events.includes('bossArrival'));
    state.boss = null; state.run.stage = 'BOSS'; state.run.wave = 3; state.run.level = level;
    state.run.destroyed = 10; state.run.escaped = 0; state.run.pending = []; step(); step();
    assert.equal(events.filter(e => e === 'complete').length, 1);
  }
});
test('ses bağlantısı aynı girdide Phase A/B oyun durumunu değiştirmez', () => {
  const { state } = simulation(); state.boss = createBoss(5, state.bounds);
  const silent = structuredClone(state), events = [];
  for (let frame = 0; frame < 300; frame++) {
    const input = { x: Math.sin(frame), y: 0, shooting: true };
    updateGame(state, input, 1/60, () => .5, e => events.push(e)); updateGame(silent, input, 1/60, () => .5);
  }
  assert.ok(events.length); assert.deepEqual(state, silent);
});

test('sistem interruption aktif notaları temizler, sonraki gesture aynı context ile devam eder', async () => {
  const { audio, ctx } = await setup(); audio.play('bossDefeat');
  ctx.state = 'interrupted'; ctx.onstatechange(); assert.equal(audio.status.voices, 0);
  await audio.gesture('menu'); assert.equal(ctx.state, 'running'); assert.equal(audio.status.voices, 1);
  audio.dispose(); assert.equal(ctx.onstatechange, null);
});
