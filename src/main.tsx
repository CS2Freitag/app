import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log(
  "%c App signiert von [Jane Töbermann] ", 
  "background: #222; color: #bada55; font-size: 16px; font-weight: bold; padding: 4px;"
);
// PWA Service Worker Registration: only in production to prevent caching issues in development preview
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      const swUrl = `${import.meta.env.BASE_URL}sw.js`;
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          console.log('PWA ServiceWorker registered successfully with scope:', reg.scope);
          // Proactively check for service worker updates immediately on launch
          reg.update().catch(() => {});
          // Periodically check for updates
          setInterval(() => {
            reg.update().catch(() => {});
          }, 30 * 60 * 1000);
        })
        .catch((err) => {
          console.warn('PWA ServiceWorker registration error:', err);
        });
    });

    // Detect when updated service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('PWA updated: New ServiceWorker has taken control.');
    });
  } else {
    // In development mode, actively unregister any stale service workers
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      });
    }
  }
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
