import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // CRITICAL:
  // In AI Studio and Cloud Run environments, process.env.PORT is often set to 8080 (where nginx listens).
  // Nginx reverse-proxies incoming external traffic to port 3000 (DEFAULT_APP_PORT=3000).
  // If the Node app attempts to listen on 8080, it crashes with EADDRINUSE!
  // Therefore, the server must listen on port 3000 (or DEFAULT_APP_PORT if explicitly set).
  const port = process.env.DEFAULT_APP_PORT 
    ? Number(process.env.DEFAULT_APP_PORT) 
    : (process.env.APP_PORT ? Number(process.env.APP_PORT) : 3000);
  
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, 'dist');

  console.log(`Server starting: NODE_ENV=${process.env.NODE_ENV}, isProd=${isProd}, port=${port}`);

  // Always serve version.json directly from disk with strict no-cache headers
  app.get('/version.json', (req, res) => {
    const distVer = path.join(distPath, 'version.json');
    const publicVer = path.join(__dirname, 'public', 'version.json');
    const target = isProd && fs.existsSync(distVer) ? distVer : publicVer;
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (fs.existsSync(target)) {
      return res.sendFile(target);
    }
    res.status(404).json({ error: 'version.json not found' });
  });

  // PWA Core Assets: Explicitly serve Service Worker and Manifest with correct headers
  // This ensures they are always served as JavaScript and JSON, not intercepted by SPA HTML fallback
  app.get('/sw.js', (req, res) => {
    const swPath = path.join(distPath, 'sw.js');
    if (isProd && fs.existsSync(swPath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Access-Control-Allow-Origin', req.header('Origin') || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      return res.sendFile(swPath);
    }

    // Read current version dynamically from public/version.json so a new version produces
    // a new SW byte signature that sits in `waiting` until the user explicitly triggers update.
    let appVersion = '0.0';
    try {
      const verPath = path.join(__dirname, 'public', 'version.json');
      if (fs.existsSync(verPath)) {
        const parsed = JSON.parse(fs.readFileSync(verPath, 'utf-8'));
        if (parsed && parsed.version) {
          appVersion = String(parsed.version);
        }
      }
    } catch {
      // fallback to 0.0
    }

    const cacheName = `cs2-dev-app-v${appVersion}`;
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Service-Worker-Allowed', '/');
    return res.send(`/* CS2Freitag Version-Locked Prompt Service Worker (${appVersion}) */
const APP_VERSION = ${JSON.stringify(appVersion)};
const CACHE_NAME = ${JSON.stringify(cacheName)};
const CORE_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  // Never call self.skipWaiting() automatically here!
  // New versions must stay in waiting state until the user clicks "Update durchführen".
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_SHELL.map((url) =>
          fetch(url, { cache: 'no-store', credentials: 'same-origin' })
            .then((res) => {
              if (res && res.status === 200) {
                return cache.put(url, res.clone());
              }
            })
            .catch(() => {})
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key.startsWith('cs2-dev-app-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve(true);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) =>
            key.startsWith('cs2-dev-app-') ? caches.delete(key) : Promise.resolve(true)
          )
        )
      )
    );
    return;
  }

  if (data.type === 'WARM_CACHE' && Array.isArray(data.urls)) {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        for (const rawUrl of data.urls) {
          try {
            const u = new URL(rawUrl, self.location.origin);
            if (u.origin !== self.location.origin) continue;
            if (
              u.pathname.endsWith('/version.json') ||
              u.pathname.endsWith('/sw.js') ||
              u.pathname.startsWith('/api/') ||
              u.pathname.includes('__vite_ping')
            ) {
              continue;
            }
            const existing = await cache.match(u.href);
            if (!existing) {
              const res = await fetch(u.href, { credentials: 'same-origin' });
              if (res && res.status === 200) {
                await cache.put(u.href, res.clone());
              }
            }
          } catch {
            // Ignore individual warm-cache misses
          }
        }
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Never cache version manifest, service worker itself, API calls, or Vite pings/SSE
  if (
    url.pathname.endsWith('/version.json') ||
    url.pathname.endsWith('/sw.js') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('__vite_ping') ||
    (req.headers.get('accept') || '').includes('text/event-stream')
  ) {
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = (await cache.match('/')) || (await cache.match('/index.html')) || (await cache.match(req));
        if (cached) {
          return cached;
        }
        const netRes = await fetch(req);
        if (netRes && netRes.status === 200) {
          cache.put('/', netRes.clone());
        }
        return netRes;
      })
    );
    return;
  }

  // Strictly CacheFirst for same-origin static assets & Vite module graph so
  // browser refreshes preserve the locked version until manual update is triggered.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) {
        return cached;
      }
      const netRes = await fetch(req);
      if (netRes && netRes.status === 200) {
        cache.put(req, netRes.clone());
      }
      return netRes;
    })
  );
});
`);
  });

  app.get('/workbox-:hash.js', (req, res) => {
    const filename = `workbox-${req.params.hash}.js`;
    const distWorkbox = path.join(distPath, filename);
    const publicWorkbox = path.join(__dirname, 'public', filename);
    const target = fs.existsSync(distWorkbox) ? distWorkbox : (fs.existsSync(publicWorkbox) ? publicWorkbox : null);
    if (target) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.sendFile(target);
    }
    res.status(404).send('Workbox file not found');
  });

  app.get('/manifest.json', (req, res) => {
    const distManifest = path.join(distPath, 'manifest.json');
    const publicManifest = path.join(__dirname, 'public', 'manifest.json');
    const target = fs.existsSync(distManifest) ? distManifest : publicManifest;
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', req.header('Origin') || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.sendFile(target);
  });

  app.get('/favicon.ico', (req, res) => {
    const distFavicon = path.join(distPath, 'favicon.ico');
    const publicFavicon = path.join(__dirname, 'public', 'favicon.ico');
    const target = fs.existsSync(distFavicon) ? distFavicon : publicFavicon;
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Content-Type', 'image/x-icon');
    res.sendFile(target);
  });

  app.get('/favicon.png', (req, res) => {
    const distFavicon = path.join(distPath, 'favicon.png');
    const publicFavicon = path.join(__dirname, 'public', 'favicon.png');
    const target = fs.existsSync(distFavicon) ? distFavicon : publicFavicon;
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(target);
  });

  if (isProd && fs.existsSync(distPath)) {
    console.log(`Production mode: Serving static files from ${distPath}`);
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Service-Worker-Allowed', '/');
        } else if (filePath.endsWith('manifest.json')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        }
      }
    }));

    // SPA fallback for production
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log(isProd 
      ? 'Production mode with dist folder not ready yet: Falling back to Vite middleware...'
      : 'Development mode: Starting Vite middleware (appType: spa)...'
    );
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
      appType: 'spa', // Let Vite handle index.html transformation and serving
    });
    
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


