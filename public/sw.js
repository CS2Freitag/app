/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-dc59bdb6'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "launcher-icon.ico",
    "revision": "ef23cdc7e72c4dc13da79fc0b5d8d29f"
  }, {
    "url": "index.html",
    "revision": "03e79a213d1beea86df6d33f9f0334f0"
  }, {
    "url": "icon.svg",
    "revision": "b4b520fb0f629713d0d9396dfc573b28"
  }, {
    "url": "favicon32x32.ico",
    "revision": "c8456d1fe630ed8cda3885f7df36f6ab"
  }, {
    "url": "favicon16x16.ico",
    "revision": "c8f2b585ba07799363ceaf269fcd1e10"
  }, {
    "url": "favicon.ico",
    "revision": "6d2d9e923f4d127c48be94a5c3bea52b"
  }, {
    "url": "assets/index-DYWKEzC0.css",
    "revision": null
  }, {
    "url": "assets/index-CjR4WUMA.js",
    "revision": null
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "e34cd2cb690bf6746ed83b4a8e1ce058"
  }, {
    "url": "pwa-512x512.png",
    "revision": "e34cd2cb690bf6746ed83b4a8e1ce058"
  }, {
    "url": "pwa-192x192.png",
    "revision": "c3222a6c2eb7c68c27924512e217542f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "71a116e8b8ef8f049db5142db8906a6a"
  }, {
    "url": "screenshot-mobile.png",
    "revision": "4dbd48587604e5b19dbf305799dbb97c"
  }, {
    "url": "screenshot-desktop.png",
    "revision": "491320f6be24af2134dbd437f7d2d1d7"
  }, {
    "url": "ct.png",
    "revision": "f6cde839afa1f47afa12c9f5f7a6f80c"
  }, {
    "url": "T.png",
    "revision": "f66235ebcfe70ec00e4512a6a0252b35"
  }, {
    "url": "manifest.json",
    "revision": "adedc4bc9a44fd7656e4ee630dd265e0"
  }, {
    "url": "pwa-192x192.png",
    "revision": "c3222a6c2eb7c68c27924512e217542f"
  }, {
    "url": "pwa-512x512.png",
    "revision": "e34cd2cb690bf6746ed83b4a8e1ce058"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "e34cd2cb690bf6746ed83b4a8e1ce058"
  }, {
    "url": "manifest.webmanifest",
    "revision": "9117c13149ea633399569b8d5b570e5f"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(({
    request
  }) => request.destination === "image", new workbox.NetworkFirst({
    "cacheName": "cs2-maps-cache-v3",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 150,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    request
  }) => request.destination === "script" || request.destination === "style" || request.destination === "worker", new workbox.StaleWhileRevalidate({
    "cacheName": "cs2-static-resources-v3",
    plugins: []
  }), 'GET');

}));
