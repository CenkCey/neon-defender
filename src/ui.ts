import { GALAXIES, LEVELS, BOSS_CONFIGS } from './content.ts';
import type { GameState } from './world.ts';
import type { ProgressStore } from './progress.ts';
import { killRatio, killsForTier } from './director.ts';

export type Screen = 'home' | 'galaxies' | 'levels' | 'brief' | 'settings' | 'records' | 'run';
export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Arayüz öğesi eksik: ${id}`);
  return found as T;
}
const button = (action: string, label: string, secondary = false, extra = '') => `<button type="button" data-action="${action}" class="${secondary ? 'secondary' : ''}" ${extra}>${label}</button>`;
const put = (id: string, value: string) => { const target = element(id); if (target.textContent !== value) target.textContent = value; };
const number = (value: number) => String(value).padStart(2, '0');
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** HTML menus stay separate from Canvas rendering and gameplay rules. */
export function createInterface(progress: ProgressStore, onAction: (action: string, value?: number) => void) {
  let screen: Screen = 'home', galaxy = 0, level = 1, signature = '';
  let lastState: GameState | undefined, lastPaused = false;
  const overlay = element('game-overlay'), content = element('screen-content');
  const title = element('overlay-title'), subtitle = element('overlay-text');
  function click(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!target || target.disabled) return;
    onAction(target.dataset.action!, target.dataset.value === undefined ? undefined : Number(target.dataset.value));
  }
  content.addEventListener('click', click);
  function render(state: GameState, paused: boolean) {
    lastState = state; lastPaused = paused;
    const run = state.run;
    const session = run !== null && state.phase !== 'MENU';
    document.body.classList.toggle('game-session', session);
    document.documentElement.classList.toggle('game-session', session);
    if (state.phase === 'MENU' && screen === 'run') screen = 'home';
    if (state.phase !== 'MENU' && screen !== 'settings') screen = 'run';
    const playing = state.phase === 'PLAYING' && !paused && screen === 'run';
    overlay.hidden = playing;
    const canvas = element<HTMLCanvasElement>('game-canvas');
    if (canvas.tabIndex !== (playing ? 0 : -1)) canvas.tabIndex = playing ? 0 : -1;
    element('pause-button').hidden = state.phase !== 'PLAYING' || paused;
    element('mobile-controls').hidden = screen !== 'settings';
    const label = !run ? 'CAMPAIGN / ENDLESS' : run.mode === 'campaign' ? `${GALAXIES[run.galaxy].short} · LEVEL ${number(run.level)} · ${run.stage === 'BOSS' || run.stage === 'BOSS_INTRO' ? 'BOSS' : `WAVE ${run.wave}/3`}` : `TIER ${number(run.wave)} · ${run.destroyed - run.tierStartKills}/${killsForTier(run.wave)} KILL · BREACH ${run.breach}/3`;
    put('mission-label', label);
    put('hud-score', String(state.score).padStart(4, '0'));
    put('hud-lives', `${state.lives} / 3`);
    if (element('hud-lives').getAttribute('aria-label') !== `Kalan can: ${state.lives}`) element('hud-lives').setAttribute('aria-label', `Kalan can: ${state.lives}`);
    put('hud-best', String(progress.value.endless.bestScore).padStart(4, '0'));
    put('power-status', [state.shield ? 'SHIELD' : '', state.rapidRemaining > 0 ? `RAPID ${Math.ceil(state.rapidRemaining)}s` : ''].filter(Boolean).join(' · '));
    put('save-status', progress.available ? 'İlerleme ve rekor bu cihazda saklanır.' : 'Kayıt kullanılamıyor; ilerleme bu oturumda korunuyor.');
    put('input-status', paused ? 'Duraklatıldı' : playing ? 'Kontroller etkin' : 'Görev bekleniyor');
    const next = [screen, galaxy, level, state.phase, paused, state.score, state.lives, run?.stage, run?.wave, run?.recorded, progress.available, progress.value.campaign.highestUnlockedLevel, progress.value.settings.soundEnabled].join('|');
    if (signature === next) return;
    signature = next;
    document.body.dataset.screen = screen;
    content.innerHTML = '';
    if (playing) return;
    let html = '';
    const back = button('home', 'ANA MENÜ', true);
    subtitle.hidden = false;
    if (screen === 'home') {
      title.textContent = 'Göreve hazır mısın?'; subtitle.textContent = 'Üç galaksi. Otuz görev. Sonsuz mücadele.';
      html = `<div class="menu-stack">${button('campaign', 'CAMPAIGN')}${button('endless', 'ENDLESS')}</div><div class="menu-row">${button('settings', 'SETTINGS', true)}${button('records', 'RECORDS', true)}</div><p class="menu-caption">v2 · Aynı gemi, yeni rotalar.</p>`;
    } else if (screen === 'galaxies') {
      title.textContent = 'Galaksini seç'; subtitle.textContent = `${progress.value.campaign.completedLevels.length}/30 görev tamamlandı`;
      html = '<div class="galaxy-list">' + GALAXIES.map((g, index) => {
        const unlocked = progress.value.campaign.highestUnlockedLevel >= index * 10 + 1;
        const stars = Array.from({ length: 10 }, (_, n) => progress.value.campaign.starsByLevel[index * 10 + n + 1] ?? 0).reduce((a, b) => a + b, 0);
        return button('galaxy', `<strong>${g.name}</strong><small>LEVEL ${index * 10 + 1}–${index * 10 + 10} · ${stars}/30 ★ ${unlocked ? '' : '· KİLİTLİ'}</small>`, true, `data-value="${index}" ${unlocked ? '' : 'disabled'}`);
      }).join('') + '</div>' + back;
    } else if (screen === 'levels') {
      title.textContent = GALAXIES[galaxy].name; subtitle.textContent = 'Bir görev seç. ★ yıldızlar kilit koşulu değildir.';
      html = '<div class="level-grid">' + Array.from({ length: 10 }, (_, index) => {
        const lv = galaxy * 10 + index + 1, unlocked = lv <= progress.value.campaign.highestUnlockedLevel, stars = progress.value.campaign.starsByLevel[lv] ?? 0;
        return button('level', `${number(lv)}${lv % 5 === 0 ? ' ◆' : ''}<small>${unlocked ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : 'KİLİTLİ'}</small>`, true, `data-value="${lv}" ${unlocked ? '' : 'disabled'}`);
      }).join('') + '</div>' + button('campaign', 'GALAKSİLER', true);
    } else if (screen === 'brief') {
      const config = LEVELS[level - 1];
      title.textContent = `LEVEL ${number(level)}`; subtitle.textContent = GALAXIES[config.galaxy].name;
      html = `<p class="brief-text">3 wave · 3 can<br/>Düşmanların en az %60’ını yok et.<br/>${config.bossIndex === null ? 'Tüm wave’leri tamamla.' : `Boss: ${BOSS_CONFIGS[config.bossIndex].name}`}</p><div class="menu-stack">${button('launch', 'GÖREVİ BAŞLAT')}${button('levels', 'LEVEL SELECT', true)}</div>`;
    } else if (screen === 'settings') {
      title.textContent = 'Ayarlar'; subtitle.textContent = 'Mobil kontrolünü seç. Eğim için izin ve kalibrasyon kullan.';
      html = `<div class="menu-stack">${button('sound', `SES: ${progress.value.settings.soundEnabled ? 'AÇIK' : 'KAPALI'}`, true)}${button('back-settings', session ? 'DURAKLATMAYA DÖN' : 'ANA MENÜ', true)}</div><p class="menu-caption">Hafif sentez efektleri. Müzik kullanılmaz.</p>`;
    } else if (screen === 'records') {
      const p = progress.value, stars = Object.values(p.campaign.starsByLevel).reduce((a, b) => a + b, 0);
      title.textContent = 'Kayıtlar'; subtitle.textContent = 'Bu cihazdaki yolculuğun.';
      html = `<dl class="record-list"><div><dt>CAMPAIGN</dt><dd>${p.campaign.completedLevels.length}/30 · ${stars}/90 ★</dd></div><div><dt>ENDLESS SKOR</dt><dd>${p.endless.bestScore}</dd></div><div><dt>EN YÜKSEK KADEME</dt><dd>${p.endless.highestWave}</dd></div><div><dt>EN UZUN UÇUŞ</dt><dd>${time(p.endless.longestSurvivalSeconds)}</dd></div><div><dt>TOPLAM YOK EDİLEN</dt><dd>${p.endless.totalEnemiesDestroyed}</dd></div></dl>${back}`;
    } else if (paused) {
      title.textContent = 'Kısa bir mola.'; subtitle.textContent = 'Hazır olduğunda kaldığın yerden devam et.';
      html = `<div class="menu-stack">${button('resume', 'DEVAM ET')}${button('retry', 'RESTART', true)}${button('settings', 'SETTINGS', true)}${back}</div>`;
    } else if (state.phase === 'LEVEL_COMPLETE' && run) {
      const galaxyDone = run.level % 10 === 0;
      title.textContent = `LEVEL ${number(run.level)} COMPLETE`; subtitle.textContent = galaxyDone ? 'GALAXY COMPLETE' : 'Görev tamamlandı.';
      html = `<div class="result-stars" aria-label="${run.stars} yıldız">${'★'.repeat(run.stars)}${'☆'.repeat(3 - run.stars)}</div><p class="result-data">SKOR ${state.score} · İSABET %${run.shots ? Math.round(run.hits / run.shots * 100) : 0}<br/>YOK EDİLEN %${Math.round(killRatio(run) * 100)} · SÜRE ${time(state.elapsedTime)}</p><div class="menu-stack">${run.level < 30 ? button('next', 'NEXT LEVEL') : button('endless', 'ENDLESS’A GEÇ')}${button('retry', 'RETRY', true)}${button('level-select', 'LEVEL SELECT', true)}</div>`;
    } else if (run) {
      title.textContent = state.lives > 0 ? 'MISSION FAILED' : 'GAME OVER';
      subtitle.textContent = run.newRecord ? 'NEW RECORD' : run.failure;
      html = `<p class="result-data">SKOR ${state.score} · ${run.mode === 'endless' ? 'TIER' : 'WAVE'} ${run.wave}<br/>${run.destroyed} DÜŞMAN · ${time(state.elapsedTime)}<br/>${run.mode === 'endless' ? `REKOR ${progress.value.endless.bestScore}` : 'Görev tamamlanmadı; yeni level açılmadı.'}</p><div class="menu-stack">${button('retry', 'RETRY')}${run.mode === 'campaign' ? button('level-select', 'LEVEL SELECT', true) : ''}${back}</div>`;
    }
    content.innerHTML = html;
    element('game-announcement').textContent = `${title.textContent}. ${subtitle.textContent}`;
  }
  return {
    render,
    get screen() { return screen; }, get level() { return level; }, get galaxy() { return galaxy; },
    navigate(next: Screen, value?: number) {
      if (next === 'levels' && value !== undefined) galaxy = value;
      if (next === 'brief' && value !== undefined) level = value;
      screen = next; signature = '';
      if (lastState) render(lastState, lastPaused);
      content.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    },
    refresh() { signature = ''; if (lastState) render(lastState, lastPaused); },
    dispose() { content.removeEventListener('click', click); },
  };
}
