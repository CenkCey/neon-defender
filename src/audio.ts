/** Short synthesized effects. Simulation emits names; only this module touches Web Audio. */
export type SoundEffect = 'laser' | 'hit' | 'destroy' | 'damage' | 'pickup' | 'bossArrival' | 'bossWarning' | 'bossAttack' | 'bossDefeat' | 'menu' | 'start' | 'transition' | 'gameOver' | 'complete';
export type SoundSink = (effect: SoundEffect) => void;
type Effect = { notes: number[]; end: number; duration: number; volume: number; throttle: number; priority: number };
export const AUDIO_CONFIG = { master: .55, maxVoices: 8 } as const;
export const SOUND_EFFECTS: Record<SoundEffect, Effect> = {
  laser: { notes: [1250], end: 650, duration: .045, volume: .025, throttle: .085, priority: 0 },
  hit: { notes: [340], end: 180, duration: .045, volume: .045, throttle: .06, priority: 0 },
  destroy: { notes: [190], end: 55, duration: .13, volume: .085, throttle: .08, priority: 1 },
  damage: { notes: [150, 100], end: 65, duration: .12, volume: .12, throttle: .35, priority: 3 },
  pickup: { notes: [660, 990], end: 1200, duration: .09, volume: .085, throttle: .12, priority: 2 },
  bossArrival: { notes: [220, 330, 220], end: 180, duration: .13, volume: .095, throttle: 1, priority: 3 },
  bossWarning: { notes: [420], end: 540, duration: .10, volume: .06, throttle: .5, priority: 2 },
  bossAttack: { notes: [260], end: 150, duration: .065, volume: .045, throttle: .15, priority: 1 },
  bossDefeat: { notes: [330, 495, 660], end: 880, duration: .12, volume: .10, throttle: .5, priority: 3 },
  menu: { notes: [700], end: 900, duration: .045, volume: .055, throttle: .06, priority: 2 },
  start: { notes: [440, 660], end: 880, duration: .075, volume: .075, throttle: .15, priority: 2 },
  transition: { notes: [440, 550], end: 660, duration: .07, volume: .06, throttle: .3, priority: 2 },
  gameOver: { notes: [440, 330, 165], end: 110, duration: .15, volume: .10, throttle: 1, priority: 3 },
  complete: { notes: [523, 659, 784], end: 1046, duration: .12, volume: .10, throttle: 1, priority: 3 },
};
const interfaceSounds = new Set<SoundEffect>(['menu', 'start', 'transition', 'gameOver', 'complete']);

export function createAudio(factory: () => AudioContext | undefined = () => {
  const Constructor = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Constructor ? new Constructor() : undefined;
}) {
  let context: AudioContext | undefined, master: GainNode | undefined;
  let enabled = false, paused = false, disposed = false, generation = 0;
  let resuming: Promise<boolean> | undefined;
  const last = new Map<SoundEffect, number>();
  const voices = new Set<{ oscillator: OscillatorNode; gain: GainNode; priority: number; gameplay: boolean }>();
  function stop(gameplayOnly = false) {
    for (const voice of [...voices]) {
      if (gameplayOnly && !voice.gameplay) continue;
      voices.delete(voice);
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch { /* Already ended. */ }
      voice.oscillator.disconnect(); voice.gain.disconnect();
    }
  }
  function setEnabled(value: boolean) {
    enabled = value;
    if (!value) { generation++; stop(); last.clear(); }
    if (master && context) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(value ? AUDIO_CONFIG.master : 0, context.currentTime);
    }
  }
  /** Called directly from pointer/key gestures; resume is asynchronous on Safari. */
  function unlock(): Promise<boolean> {
    if (disposed || !enabled) return Promise.resolve(false);
    try {
      if (!context) {
        context = factory();
        if (!context) return Promise.resolve(false);
        master = context.createGain(); master.gain.setValueAtTime(AUDIO_CONFIG.master, context.currentTime);
        master.connect(context.destination);
        context.onstatechange = () => {
          if (context?.state !== 'running') stop();
          // Interruptions (calls, Siri, audio route changes) must not replay stale notes.
          if (String(context?.state) === 'interrupted') { generation++; last.clear(); }
        };
      }
      if (context.state === 'running') return Promise.resolve(true);
      if (context.state === 'closed') return Promise.resolve(false);
      if (!resuming) resuming = context.resume().then(() => context?.state === 'running', () => false).finally(() => { resuming = undefined; });
      return resuming;
    } catch { return Promise.resolve(false); }
  }
  function play(effect: SoundEffect) {
    if (disposed || !enabled || !context || !master || context.state !== 'running' || (paused && !interfaceSounds.has(effect))) return;
    const spec = SOUND_EFFECTS[effect], now = context.currentTime;
    if (now - (last.get(effect) ?? -Infinity) < spec.throttle) return;
    last.set(effect, now);
    try {
      for (const [index, frequency] of spec.notes.entries()) {
        if (voices.size >= AUDIO_CONFIG.maxVoices) {
          const victim = [...voices].find(voice => voice.priority < spec.priority);
          if (!victim) break;
          voices.delete(victim); victim.oscillator.onended = null;
          try { victim.oscillator.stop(); } catch { /* Already stopped. */ }
          victim.oscillator.disconnect(); victim.gain.disconnect();
        }
        const oscillator = context.createOscillator(), gain = context.createGain();
        const start = now + index * spec.duration, end = start + spec.duration;
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(spec.end, end);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.linearRampToValueAtTime(spec.volume, start + .004);
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        oscillator.connect(gain); gain.connect(master);
        const voice = { oscillator, gain, priority: spec.priority, gameplay: !interfaceSounds.has(effect) };
        voices.add(voice);
        oscillator.onended = () => { voices.delete(voice); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(end + .01);
      }
    } catch { stop(); /* Audio must never interrupt gameplay. */ }
  }
  function gesture(effect?: SoundEffect) {
    const ticket = generation, requested = Date.now();
    // Never queue gameplay sounds while unlocking: only the current UI gesture may chime.
    const ready = unlock();
    if (effect) void ready.then(ok => { if (ok && ticket === generation && Date.now() - requested < 350) play(effect); });
    return ready;
  }
  function setPaused(value: boolean) { if (value && !paused) stop(true); paused = value; }
  function suspend() {
    generation++; stop(); last.clear();
    if (context && context.state !== 'closed') void context.suspend().catch(() => {});
  }
  function dispose() {
    disposed = true; enabled = false; generation++; stop();
    if (context) context.onstatechange = null;
    master?.disconnect();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
  return { setEnabled, unlock, gesture, play, setPaused, suspend, dispose,
    get status() { return { enabled, paused, state: context?.state ?? 'uninitialized', voices: voices.size }; } };
}

/** One removable gesture/lifecycle binding, also used by the native WebView. */
export function bindAudioLifecycle(audio: ReturnType<typeof createAudio>, page: Document = document, host: Window = window) {
  const gesture = (event: Event) => { if (event.type === 'keydown' && (event as KeyboardEvent).repeat) return; if (!page.hidden) void audio.gesture(); };
  const visibility = () => { if (page.hidden) audio.suspend(); };
  const suspend = () => audio.suspend();
  page.addEventListener('pointerdown', gesture, true); page.addEventListener('keydown', gesture, true);
  page.addEventListener('visibilitychange', visibility);
  host.addEventListener('pagehide', suspend); host.addEventListener('blur', suspend);
  return () => {
    page.removeEventListener('pointerdown', gesture, true); page.removeEventListener('keydown', gesture, true);
    page.removeEventListener('visibilitychange', visibility);
    host.removeEventListener('pagehide', suspend); host.removeEventListener('blur', suspend);
  };
}
