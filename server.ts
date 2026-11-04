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

  // PWA Core Assets: Explicitly serve Service Worker and Manifest with correct headers
  // This ensures they are always served as JavaScript and JSON, not intercepted by SPA HTML fallback
  app.get('/sw.js', (req, res) => {
    if (!isProd) {
      // In development / preview mode, serve a self-unregistering service worker
      // to immediately clear any stale service workers or caches causing white screen
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(
        `self.addEventListener('install', () => self.skipWaiting());\n` +
        `self.addEventListener('activate', (event) => {\n` +
        `  event.waitUntil(\n` +
        `    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))\n` +
        `      .then(() => self.registration.unregister())\n` +
        `      .then(() => self.clients.claim())\n` +
        `  );\n` +
        `});\n`
      );
    }

    const swPath = path.join(distPath, 'sw.js');
    const publicSw = path.join(__dirname, 'public', 'sw.js');
    const target = fs.existsSync(swPath) ? swPath : (fs.existsSync(publicSw) ? publicSw : null);
    if (target) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Access-Control-Allow-Origin', req.header('Origin') || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      return res.sendFile(target);
    }
    res.status(404).send('Service Worker not found');
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


