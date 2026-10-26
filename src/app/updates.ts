import { registerSW } from 'virtual:pwa-register';

// Automatické aktualizace aplikace (PWA):
// - nová verze se hledá při každém návratu do aplikace a každých 30 minut,
// - když je aplikace na pozadí (nebo se teprve otevírá), nová verze se nasadí hned,
// - když ji právě používáš, ukáže se lišta „Nová verze“ a nasadí se, jakmile odejdeš na pozadí.

const CHECK_EVERY_MS = 30 * 60_000;
const STARTUP_WINDOW_MS = 8_000;

let ready = false;
const listeners = new Set<(ready: boolean) => void>();
let apply: (() => Promise<void>) | null = null;

export const onUpdateReady = (fn: (ready: boolean) => void) => {
  listeners.add(fn);
  fn(ready);
  return () => listeners.delete(fn);
};

export const applyUpdate = () => apply?.();

export const buildTime = () => (typeof __BUILD_TIME__ === 'string' ? new Date(__BUILD_TIME__) : null);

export function setupUpdates() {
  const started = Date.now();
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // právě se otevírá nebo je na pozadí → rovnou nová verze
      if (document.visibilityState === 'hidden' || Date.now() - started < STARTUP_WINDOW_MS) {
        updateSW(true);
        return;
      }
      ready = true;
      listeners.forEach((fn) => fn(true));
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine !== false) reg.update().catch(() => undefined);
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
  apply = () => updateSW(true);
  // připravená verze se nasadí, jakmile aplikaci přepneš na pozadí
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && ready) updateSW(true);
  });
}
