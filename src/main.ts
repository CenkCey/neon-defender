import './style.css';
import { startGame } from './game.ts';
import { createProgressStore } from './progress.ts';
import { createInterface, element } from './ui.ts';
import { registerOffline } from './pwa.ts';
import { isNativeApp } from './native.ts';
import { createAudio, bindAudioLifecycle } from './audio.ts';
import type { GameState } from './world.ts';

document.body.classList.toggle('native-app', isNativeApp);
let storage: Storage | undefined;
try { storage = window.localStorage; } catch { /* In-memory progress is still usable. */ }
const progress = createProgressStore(storage);
const audio = createAudio();
audio.setEnabled(progress.value.settings.soundEnabled);
const unbindAudio = bindAudioLifecycle(audio);
const canvas = element<HTMLCanvasElement>('game-canvas');
const mobile = {
  panel: element('mobile-controls'), select: element<HTMLSelectElement>('control-mode'),
  enable: element<HTMLButtonElement>('enable-tilt'), calibrate: element<HTMLButtonElement>('calibrate-tilt'),
  fire: element<HTMLButtonElement>('touch-fire'), status: element('mobile-status'),
};
// Existing v1 controls keep their key for backward compatibility.
try { storage?.setItem('neon-defender.controls.v1', progress.value.settings.controlMode); } catch { /* Optional storage. */ }
let controller: ReturnType<typeof startGame> | undefined;
let latest: GameState | undefined;
let actionLocked = false;
const ui = createInterface(progress, (action, value) => {
  if (actionLocked) return;
  actionLocked = true;
  queueMicrotask(() => { actionLocked = false; });
  if (action !== 'sound') void audio.gesture(['launch', 'endless', 'retry', 'next', 'resume'].includes(action) ? 'start' : 'menu');
  const leave = () => { audio.setPaused(true); controller?.returnToMenu(); };
  switch (action) {
    case 'home': leave(); ui.navigate('home'); break;
    case 'campaign': leave(); ui.navigate('galaxies'); break;
    case 'galaxy': ui.navigate('levels', value); break;
    case 'level': ui.navigate('brief', value); break;
    case 'levels': ui.navigate('levels'); break;
    case 'launch': if (latest?.phase === 'MENU') { ui.navigate('run'); controller?.start('campaign', ui.level); } break;
    case 'endless': if (latest?.phase !== 'PLAYING') { ui.navigate('run'); controller?.start('endless'); } break;
    case 'resume': ui.navigate('run'); controller?.startOrResume(); break;
    case 'retry': ui.navigate('run'); controller?.retry(); break;
    case 'next':
      if (latest?.phase === 'LEVEL_COMPLETE' && latest.run && latest.run.level < 30) controller?.start('campaign', latest.run.level + 1);
      break;
    case 'level-select': { const galaxy = latest?.run?.galaxy ?? ui.galaxy; leave(); ui.navigate('levels', galaxy); break; }
    case 'settings': controller?.pause(); ui.navigate('settings'); break;
    case 'back-settings': ui.navigate(latest?.phase === 'MENU' ? 'home' : 'run'); break;
    case 'records': ui.navigate('records'); break;
    case 'sound': progress.settings({ soundEnabled: !progress.value.settings.soundEnabled }); audio.setEnabled(progress.value.settings.soundEnabled); void audio.gesture('menu'); ui.refresh(); break;
  }
});
function changed(state: GameState, paused: boolean) {
  latest = state;
  audio.setPaused(paused);
  ui.render(state, paused);
}
const pauseButton = element<HTMLButtonElement>('pause-button');
function pause() { void audio.gesture('menu'); controller?.pause(); }
function saveControl() { progress.settings({ controlMode: mobile.select.value === 'tilt' ? 'tilt' : 'drag' }); }
try {
  controller = startGame(canvas, changed, progress, mobile, { sound: audio.play, suspend: audio.suspend });
  pauseButton.addEventListener('click', pause);
  mobile.select.addEventListener('change', saveControl);
} catch (error) {
  element('game-error').textContent = error instanceof Error ? error.message : 'Oyun başlatılamadı.';
  element('game-error').hidden = false;
}
registerOffline(element('pwa-status'));
if (import.meta.hot) import.meta.hot.dispose(() => {
  controller?.dispose(); ui.dispose(); unbindAudio(); audio.dispose();
  pauseButton.removeEventListener('click', pause); mobile.select.removeEventListener('change', saveControl);
  document.body.classList.remove('game-session'); document.documentElement.classList.remove('game-session');
});
