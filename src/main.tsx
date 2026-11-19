import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log(
  "%c App signiert von [Jane Töbermann] ", 
  "background: #222; color: #bada55; font-size: 16px; font-weight: bold; padding: 4px;"
);
// PWA Service Worker Registration: runs in both dev preview and production so
// browser refreshes remain strictly locked to the installed version until manual update.
if ('serviceWorker' in navigator) {
  const warmDevCache = (worker: ServiceWorker | null | undefined) => {
    if (!worker || import.meta.env.PROD) return;
    try {
      const resourceUrls = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.startsWith(window.location.origin));
      const allUrls = Array.from(
        new Set([
          `${window.location.origin}/`,
          `${window.location.origin}/index.html`,
          ...resourceUrls,
        ])
      );
      worker.postMessage({ type: 'WARM_CACHE', urls: allUrls });
    } catch {
      // ignore performance entry issues
    }
  };

  window.addEventListener('load', async () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    const hadController = Boolean(navigator.serviceWorker.controller);

    try {
      const existingReg = await navigator.serviceWorker.getRegistration();
      const reg =
        existingReg ||
        (await navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' }));

      // First-ever installation: activate immediately without waiting so current session locks cleanly
      if (!hadController) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else if (reg.installing) {
          const installing = reg.installing;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && !navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
        navigator.serviceWorker.ready.then((readyReg) => {
          warmDevCache(readyReg.active);
        });
      } else {
        // Existing controller present: keep any new SW in `waiting` state until user clicks Update!
        if (reg.waiting) {
          window.dispatchEvent(new CustomEvent('app-sw-update-ready'));
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('app-sw-update-ready'));
            }
          });
        });
        // Warm current active cache in case any dynamic chunk loaded
        if (reg.active) {
          warmDevCache(reg.active);
        }
      }

      // Do NOT call reg.update() or register() again automatically in the background!
      // Version discovery uses /version.json (NetworkOnly) and SW updates run
      // exclusively when the user explicitly clicks "Update durchführen".
    } catch (err) {
      console.warn('PWA ServiceWorker registration error:', err);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!import.meta.env.PROD) {
      navigator.serviceWorker.ready.then((readyReg) => {
        warmDevCache(readyReg.active);
      });
    }
  });
}

// Universal Tactile Press Feedback:
// Ensures quick clicks and fast mobile taps visibly trigger `.is-pressing` for at least 150ms
// across ALL buttons, header icons, map cards, switches, and editor controls.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const MIN_PRESS_MS = 150;
  const activePressTimers = new WeakMap<HTMLElement, number>();
  const pressStartTimes = new WeakMap<HTMLElement, number>();
  const pressedElements = new Set<HTMLElement>();

  const releaseElement = (el: HTMLElement) => {
    const start = pressStartTimes.get(el) || 0;
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, MIN_PRESS_MS - elapsed);

    const existingTimer = activePressTimers.get(el);
    if (existingTimer) window.clearTimeout(existingTimer);

    const timer = window.setTimeout(() => {
      el.classList.remove('is-pressing');
      pressedElements.delete(el);
      activePressTimers.delete(el);
    }, remaining);
    activePressTimers.set(el, timer);
  };

  window.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const rawTarget = e.target as Element | null;
      if (!rawTarget || typeof rawTarget.closest !== 'function') return;

      const target = rawTarget.closest(
        'button, [role="button"], [role="switch"], .map-card, .interactive-card, label.cursor-pointer'
      ) as HTMLElement | null;
      if (!target) return;

      if (
        target.matches(':disabled') ||
        target.getAttribute('aria-disabled') === 'true'
      ) {
        return;
      }

      const existingTimer = activePressTimers.get(target);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
        activePressTimers.delete(target);
      }

      pressStartTimes.set(target, Date.now());
      target.classList.add('is-pressing');
      pressedElements.add(target);
    },
    { capture: true, passive: true }
  );

  const releaseAllPressed = () => {
    if (pressedElements.size === 0) return;
    for (const el of Array.from(pressedElements)) {
      releaseElement(el);
    }
  };

  window.addEventListener('pointerup', releaseAllPressed, { capture: true, passive: true });
  window.addEventListener('pointercancel', releaseAllPressed, { capture: true, passive: true });
  window.addEventListener('blur', releaseAllPressed, { passive: true });
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
