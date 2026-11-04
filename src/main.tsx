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
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('PWA ServiceWorker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('PWA ServiceWorker registration error:', err);
        });
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
