import {
  LOCKED_SHELL_CACHE,
  MAP_IMAGE_CACHE,
  shouldPreserveLockedShell,
  shouldDeleteCacheOnActivate,
  getUpdateAuthorized,
  setUpdateAuthorized,
} from './utils/updateLock';

interface ManifestEntry {
  url: string;
  revision?: string | null;
}

interface SwGlobalScope {
  __WB_MANIFEST?: Array<string | ManifestEntry>;
  registration: { scope: string };
  clients: { claim: () => Promise<void> };
  skipWaiting: () => Promise<void>;
  addEventListener: (type: string, listener: (event: any) => void) => void;
}

const sw = self as unknown as SwGlobalScope;
const PRECACHE_MANIFEST: Array<string | ManifestEntry> = (self as any).__WB_MANIFEST || [];

function getScopeIndexUrl(): string {
  return new URL('index.html', sw.registration.scope).href;
}

function getManifestUrls(): string[] {
  const scopeRoot = sw.registration.scope;
  const indexUrl = getScopeIndexUrl();
  const urls = new Set<string>([scopeRoot, indexUrl]);

  for (const entry of PRECACHE_MANIFEST) {
    const rawUrl = typeof entry === 'string' ? entry : entry?.url;
    if (!rawUrl) continue;
    try {
      const absUrl = new URL(rawUrl, scopeRoot).href;
      urls.add(absUrl);
    } catch {
      // ignore invalid manifest entry
    }
  }
  return Array.from(urls);
}

async function toCleanCachedResponse(res: Response): Promise<Response> {
  if (!res.redirected) return res;
  const body = await res.clone().arrayBuffer();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers(res.headers),
  });
}

async function hasLockedAppShell(): Promise<boolean> {
  try {
    const cache = await caches.open(LOCKED_SHELL_CACHE);
    const scopeMatch = await cache.match(sw.registration.scope, { ignoreSearch: true, ignoreVary: true });
    if (scopeMatch) return true;
    const indexMatch = await cache.match(getScopeIndexUrl(), { ignoreSearch: true, ignoreVary: true });
    if (indexMatch) return true;
    const keys = await cache.keys();
    return keys.length > 0;
  } catch {
    return false;
  }
}

async function precacheManifestIntoLockedShell(): Promise<void> {
  const cache = await caches.open(LOCKED_SHELL_CACHE);
  const scopeRoot = sw.registration.scope;
  const indexUrl = getScopeIndexUrl();
  const urls = getManifestUrls();

  await Promise.all(
    urls.map(async (absUrl) => {
      try {
        const fetchTarget = absUrl === scopeRoot ? indexUrl : absUrl;
        const res = await fetch(fetchTarget, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (res && res.status === 200) {
          const cleanRes = await toCleanCachedResponse(res);
          await cache.put(absUrl, cleanRes.clone());
          if (absUrl === indexUrl) {
            await cache.put(scopeRoot, cleanRes.clone());
          }
        }
      } catch {
        // ignore individual offline miss during precache
      }
    })
  );

  await setUpdateAuthorized(false);
}

sw.addEventListener('install', (event: any) => {
  event.waitUntil(
    (async () => {
      const hasShell = await hasLockedAppShell();
      const authorized = await getUpdateAuthorized();

      if (shouldPreserveLockedShell(hasShell, authorized)) {
        // Keep the currently locked app version completely untouched.
        // Never skipWaiting() or overwrite locked cache on passive installs.
        return;
      }

      if (authorized) {
        await caches.delete(LOCKED_SHELL_CACHE);
      }

      await precacheManifestIntoLockedShell();

      // First-ever installation with no prior locked shell activates immediately
      // so the current version is locked right away.
      if (!hasShell) {
        await sw.skipWaiting();
      }
    })()
  );
});

sw.addEventListener('activate', (event: any) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) =>
          shouldDeleteCacheOnActivate(key) ? caches.delete(key) : Promise.resolve(true)
        )
      );

      const hasShell = await hasLockedAppShell();
      const authorized = await getUpdateAuthorized();

      if (!shouldPreserveLockedShell(hasShell, authorized)) {
        if (authorized) {
          await caches.delete(LOCKED_SHELL_CACHE);
        }
        await precacheManifestIntoLockedShell();
      }

      await sw.clients.claim();
    })()
  );
});

sw.addEventListener('message', (event: any) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'SKIP_WAITING') {
    sw.skipWaiting();
    return;
  }

  if (data.type === 'AUTHORIZE_UPDATE') {
    event.waitUntil(
      (async () => {
        await setUpdateAuthorized(true);
        await caches.delete(LOCKED_SHELL_CACHE);
        event.ports?.[0]?.postMessage({ ok: true });
      })()
    );
  }
});

sw.addEventListener('fetch', (event: any) => {
  const req: Request = event.request;
  if (req.method !== 'GET') return;

  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Never cache version manifest, service worker script itself, API calls, or Vite pings
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
    if (
      url.pathname.includes('/en/') ||
      url.pathname.endsWith('/en') ||
      url.pathname.includes('/callouts/') ||
      url.pathname.endsWith('/callouts')
    ) {
      return;
    }
    event.respondWith(
      (async () => {
        const authorized = await getUpdateAuthorized();
        const cache = await caches.open(LOCKED_SHELL_CACHE);

        if (!authorized) {
          const cached =
            (await cache.match(sw.registration.scope, { ignoreSearch: true, ignoreVary: true })) ||
            (await cache.match(getScopeIndexUrl(), { ignoreSearch: true, ignoreVary: true })) ||
            (await cache.match(req, { ignoreSearch: true, ignoreVary: true }));
          if (cached) {
            return cached;
          }
        }

        const netRes = await fetch(req, { cache: 'no-store' });
        if (netRes && netRes.status === 200) {
          const cleanRes = await toCleanCachedResponse(netRes);
          await cache.put(sw.registration.scope, cleanRes.clone());
          await cache.put(getScopeIndexUrl(), cleanRes.clone());
          if (authorized) {
            await setUpdateAuthorized(false);
          }
          return cleanRes;
        }
        return netRes;
      })()
    );
    return;
  }

  if (req.destination === 'image') {
    event.respondWith(
      (async () => {
        const lockedCache = await caches.open(LOCKED_SHELL_CACHE);
        const coreCached =
          (await lockedCache.match(req, { ignoreVary: true })) ||
          (await lockedCache.match(url.origin + url.pathname, { ignoreVary: true }));
        if (coreCached) {
          return coreCached;
        }

        const mapCache = await caches.open(MAP_IMAGE_CACHE);
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          const netRes = await fetch(req, { signal: controller.signal });
          clearTimeout(timer);
          if (netRes && (netRes.status === 200 || netRes.type === 'opaque')) {
            mapCache.put(req, netRes.clone()).catch(() => {});
          }
          return netRes;
        } catch {
          const fallback = await mapCache.match(req, { ignoreVary: true });
          if (fallback) return fallback;
          return fetch(req);
        }
      })()
    );
    return;
  }

  // All other same-origin assets (JS bundles, CSS, fonts, manifest, workers):
  // strictly CacheFirst from LOCKED_SHELL_CACHE unless manual update was authorized.
  event.respondWith(
    (async () => {
      const authorized = await getUpdateAuthorized();
      const cache = await caches.open(LOCKED_SHELL_CACHE);

      if (!authorized) {
        const cached =
          (await cache.match(req, { ignoreVary: true })) ||
          (await cache.match(url.origin + url.pathname, { ignoreVary: true }));
        if (cached) {
          return cached;
        }
      }

      const netRes = await fetch(req, authorized ? { cache: 'no-store' } : undefined);
      if (netRes && netRes.status === 200) {
        await cache.put(req, netRes.clone());
      }
      return netRes;
    })()
  );
});
