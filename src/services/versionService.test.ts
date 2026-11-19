import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compareVersions, CURRENT_BUILD_VERSION } from './versionService';

test('compareVersions compares major and patch numbers accurately', () => {
  assert.equal(compareVersions('3.117', '3.116'), 1);
  assert.equal(compareVersions('3.116', '3.117'), -1);
  assert.equal(compareVersions('3.117', '3.117'), 0);
  assert.equal(compareVersions('v3.117', '3.117'), 0);
  assert.equal(compareVersions('3.10', '3.2'), 1);
  assert.equal(compareVersions('4.0', '3.999'), 1);
});

test('CURRENT_BUILD_VERSION matches public/version.json manifest', () => {
  const manifestPath = path.resolve(process.cwd(), 'public', 'version.json');
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw) as {
    version: string;
    major: number;
    patch: number;
    history?: Array<{ version: string }>;
  };

  assert.equal(manifest.version, CURRENT_BUILD_VERSION);
  assert.equal(`${manifest.major}.${manifest.patch}`, CURRENT_BUILD_VERSION);
  assert.equal(manifest.history?.[0]?.version, CURRENT_BUILD_VERSION);
});
