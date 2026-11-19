import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRelevantChangelogEntries } from './changelogFilter.ts';
import type { VersionManifest } from '../services/versionService.ts';

const sampleManifest: VersionManifest = {
  version: '3.120',
  major: 3,
  patch: 120,
  history: [
    { version: '3.120', title: 'Update Lock', changes: ['Fix 3.120'] },
    { version: '3.119', title: 'Firefox Help', changes: ['Fix 3.119'] },
    { version: '3.118', title: 'Quiz Filter', changes: ['Fix 3.118'] },
    { version: '3.110', title: 'Old Update', changes: ['Old 3.110'] },
    { version: '3.109', title: 'Very Old', changes: ['Old 3.109'] },
  ],
};

test('when up to date, shows ONLY the single last completed update (not full 3.109..3.120 history)', () => {
  const entries = selectRelevantChangelogEntries(sampleManifest, '3.120', '3.120', false);
  assert.deepEqual(
    entries.map((e) => ({ version: e.version, status: e.status })),
    [{ version: '3.120', status: 'last_installed' }]
  );
});

test('when updates are pending, shows all not-yet-installed updates plus ONLY the single last completed update', () => {
  const entries = selectRelevantChangelogEntries(sampleManifest, '3.118', '3.120', true);
  assert.deepEqual(
    entries.map((e) => ({ version: e.version, status: e.status })),
    [
      { version: '3.120', status: 'pending' },
      { version: '3.119', status: 'pending' },
      { version: '3.118', status: 'last_installed' },
    ]
  );
});
