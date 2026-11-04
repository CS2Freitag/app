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
define(['./workbox-06918fc1'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "8dc5f9172e57105aab6f2e4aa85d867b"
  }, {
    "url": "icon.svg",
    "revision": "b4b520fb0f629713d0d9396dfc573b28"
  }, {
    "url": "favicon.ico",
    "revision": "18c827bf6b7c72ab6eb0116a2893269c"
  }, {
    "url": "assets/index-p4yF1yR9.css",
    "revision": null
  }, {
    "url": "assets/index-BxQMteXp.js",
    "revision": null
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "568ab296e9e5c16e4a19d31ad38ed735"
  }, {
    "url": "pwa-512x512.png",
    "revision": "ffdcd600fee6ab0bcd96287b823b3fd8"
  }, {
    "url": "pwa-192x192.png",
    "revision": "ca88a83870ecde613fdc882ba9f1874d"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "d80622d3160e1824c063284c7670a403"
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
    "revision": "9117c13149ea633399569b8d5b570e5f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "d80622d3160e1824c063284c7670a403"
  }, {
    "url": "favicon.ico",
    "revision": "18c827bf6b7c72ab6eb0116a2893269c"
  }, {
    "url": "icon.svg",
    "revision": "b4b520fb0f629713d0d9396dfc573b28"
  }, {
    "url": "manifest.json",
    "revision": "9117c13149ea633399569b8d5b570e5f"
  }, {
    "url": "pwa-192x192.png",
    "revision": "ca88a83870ecde613fdc882ba9f1874d"
  }, {
    "url": "pwa-512x512.png",
    "revision": "ffdcd600fee6ab0bcd96287b823b3fd8"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "568ab296e9e5c16e4a19d31ad38ed735"
  }, {
    "url": "screenshot-desktop.png",
    "revision": "491320f6be24af2134dbd437f7d2d1d7"
  }, {
    "url": "screenshot-mobile.png",
    "revision": "4dbd48587604e5b19dbf305799dbb97c"
  }, {
    "url": "manifest.json",
    "revision": "9117c13149ea633399569b8d5b570e5f"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(({
    request
  }) => request.destination === "image", new workbox.CacheFirst({
    "cacheName": "cs2-maps-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 150,
      maxAgeSeconds: 31536000
    })]
  }), 'GET');
  workbox.registerRoute(({
    request
  }) => request.destination === "script" || request.destination === "style" || request.destination === "worker", new workbox.StaleWhileRevalidate({
    "cacheName": "cs2-static-resources",
    plugins: []
  }), 'GET');

}));
