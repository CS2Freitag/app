import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCKED_SHELL_CACHE,
  MAP_IMAGE_CACHE,
  shouldPreserveLockedShell,
  shouldDeleteCacheOnActivate,
} from './updateLock.ts';

test('shouldPreserveLockedShell keeps locked shell whenever one exists and user did not authorize update', () => {
  assert.equal(shouldPreserveLockedShell(true, false), true);
  assert.equal(shouldPreserveLockedShell(true, true), false);
  assert.equal(shouldPreserveLockedShell(false, false), false);
  assert.equal(shouldPreserveLockedShell(false, true), false);
});

test('shouldDeleteCacheOnActivate never deletes locked app shell or offline map image caches', () => {
  assert.equal(shouldDeleteCacheOnActivate(LOCKED_SHELL_CACHE), false);
  assert.equal(shouldDeleteCacheOnActivate(MAP_IMAGE_CACHE), false);
  assert.equal(shouldDeleteCacheOnActivate('cs2-dev-app-v3.118'), true);
  assert.equal(shouldDeleteCacheOnActivate('cs2-static-resources-v3'), true);
  assert.equal(shouldDeleteCacheOnActivate('workbox-precache-v2-https://example.com/'), true);
});
