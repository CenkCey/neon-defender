import { isNativeApp } from './native.ts';

export function registerOffline(status: HTMLElement, native = isNativeApp) {
  if (native) {
    status.textContent = 'Çevrimdışı hazır · Oyun bu cihazda yüklü.';
    return; // Bundled app files need neither a service worker nor a remote site.
  }
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) {
    status.textContent = import.meta.env.DEV ? '' : 'Çevrimdışı kullanım için HTTPS gerekir.';
    return;
  }
  status.textContent = 'Çevrimdışı kullanım hazırlanıyor…';
  const workerURL = new URL('sw.js', document.baseURI);
  void navigator.serviceWorker.register(workerURL, { scope: './', updateViaCache: 'none' }).then((registration) => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'redundant') status.textContent = 'Çevrimdışı hazırlık tamamlanamadı; internetle oynamaya devam edebilirsin.';
    });
    return navigator.serviceWorker.ready;
  }).then(() => { status.textContent = 'Çevrimdışı hazır · Safari’den Ana Ekran’a ekleyebilirsin.'; }).catch(() => {
    status.textContent = 'Çevrimdışı hazırlık tamamlanamadı; internetle oynamaya devam edebilirsin.';
  });
}
