import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';

export const isNativeApp = Capacitor.isNativePlatform();

interface AppEvents {
  addListener(name: 'appStateChange', listener: (state: { isActive: boolean }) => void): Promise<PluginListenerHandle>;
}

/** Native backgrounding pauses the same game; returning never resumes a held input. */
export function watchNativePause(onPause: () => void, app: AppEvents = App, native = isNativeApp) {
  let disposed = false;
  let handle: PluginListenerHandle | undefined;
  if (native) {
    void app.addListener('appStateChange', ({ isActive }) => {
      if (!disposed && !isActive) onPause();
    }).then((listener) => {
      if (disposed) void listener.remove();
      else handle = listener;
    }).catch(() => { /* Browser visibility/focus handlers remain a fallback. */ });
  }
  return () => {
    if (disposed) return;
    disposed = true;
    void handle?.remove();
  };
}
