export type TiltStatus = 'idle' | 'waiting' | 'ready' | 'denied' | 'unsupported' | 'unavailable';
type OrientationConstructor = { requestPermission?: () => Promise<'granted' | 'denied'> };
export interface TiltHost extends EventTarget {
  isSecureContext: boolean;
  DeviceOrientationEvent?: OrientationConstructor;
  screen?: { orientation?: { angle: number } };
  orientation?: number;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
}

export function horizontalAngle(beta: number, gamma: number, screenAngle: number): number {
  const radians = screenAngle * Math.PI / 180;
  return gamma * Math.cos(radians) + beta * Math.sin(radians);
}

export function tiltAxis(angle: number, neutral: number): number {
  const relative = ((angle - neutral + 540) % 360) - 180;
  const magnitude = Math.max(0, Math.min(1, (Math.abs(relative) - 2.5) / 15.5));
  return magnitude === 0 ? 0 : Math.sign(relative) * magnitude;
}

/** Permission and usable data are separate states; no prompts occur at creation. */
export function createTiltInput(onStatus: (status: TiltStatus) => void, onUnavailable: (status: TiltStatus) => void, host = window as unknown as TiltHost, native = false, savedCalibration: number | null = null, onCalibration?: (angle: number) => void) {
  let status: TiltStatus = 'idle';
  let permission: 'unknown' | 'granted' | 'denied' = 'unknown';
  let permissionRequest: Promise<'granted' | 'denied'> | null = null;
  let enabled = false;
  let attached = false;
  let disposed = false;
  let timer: number | undefined;
  let latest: number | null = null;
  let neutral: number | null = null;
  let smooth = 0;
  let lastScreenAngle: number | null = null;
  let restoredCalibration = false;
  // Capacitor's bundled WKWebView uses capacitor://, not a remote HTTPS page.
  const supported = Boolean((host.isSecureContext || native) && host.DeviceOrientationEvent);

  function setStatus(next: TiltStatus) {
    if (status === next) return;
    status = next;
    onStatus(next);
  }
  function stopTimer() { if (timer !== undefined) host.clearTimeout(timer); timer = undefined; }
  function sample(event: Event) {
    const { beta, gamma } = event as DeviceOrientationEvent;
    if (typeof beta !== 'number' || typeof gamma !== 'number' || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    const angle = host.screen?.orientation?.angle ?? host.orientation ?? 0;
    if (lastScreenAngle !== angle) { neutral = null; smooth = 0; lastScreenAngle = angle; }
    latest = horizontalAngle(beta, gamma, angle);
    if (neutral === null) {
      neutral = !restoredCalibration && savedCalibration !== null && Number.isFinite(savedCalibration) ? savedCalibration : latest;
      restoredCalibration = true;
    }
    stopTimer();
    setStatus('ready');
  }
  function detach() {
    stopTimer();
    if (attached) host.removeEventListener('deviceorientation', sample);
    attached = false;
    latest = null; neutral = null; smooth = 0; lastScreenAngle = null;
  }
  function fail(reason: TiltStatus) {
    enabled = false;
    detach();
    setStatus(reason);
    onUnavailable(reason);
    return false;
  }
  async function enable() {
    if (disposed) return false;
    if (!supported) return fail('unsupported');
    if (permission === 'denied') return fail('denied');
    if (attached) return true;
    enabled = true;
    try {
      if (permission === 'unknown') {
        // Called synchronously from the enable button's click, before any await.
        const request = host.DeviceOrientationEvent?.requestPermission;
        permissionRequest ??= request ? request.call(host.DeviceOrientationEvent) : Promise.resolve('granted');
        permission = await permissionRequest;
      }
    } catch { permission = 'denied'; }
    if (!enabled || disposed) return false; // Mode may have changed while a prompt was open.
    if (permission !== 'granted') return fail('denied');
    if (attached) return true;
    host.addEventListener('deviceorientation', sample);
    attached = true;
    setStatus('waiting');
    timer = host.setTimeout(() => { if (status === 'waiting') fail('unavailable'); }, 4000);
    return true;
  }
  function calibrate() {
    smooth = 0;
    if (latest === null) return false;
    neutral = latest;
    onCalibration?.(neutral);
    return true;
  }
  return {
    supported,
    get ready() { return status === 'ready'; },
    get permitted() { return permission === 'granted'; },
    enable,
    calibrate,
    read(deltaTime: number) {
      if (!enabled || !attached || status !== 'ready' || latest === null || neutral === null) return 0;
      const target = tiltAxis(latest, neutral);
      smooth += (target - smooth) * (1 - Math.exp(-Math.max(0, deltaTime) / 0.1));
      if (target === 0 && Math.abs(smooth) < 0.01) smooth = 0;
      return smooth;
    },
    disable() { enabled = false; detach(); setStatus('idle'); },
    dispose() { disposed = true; enabled = false; detach(); },
  };
}
