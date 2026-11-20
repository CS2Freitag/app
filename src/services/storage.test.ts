import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileWithDefaultMaps, loadStoredMaps } from './storage';
import { INITIAL_MAPS } from '../data/mapsData';

test('INITIAL_MAPS contains updated Italy standard map with 14 callouts & areas', () => {
  const italy = INITIAL_MAPS.find((m) => m.id === 'italy');
  assert.ok(italy, 'Italy map must exist in INITIAL_MAPS');
  assert.equal(italy.callouts.length, 14);
  assert.ok(
    italy.callouts.every((c) => Boolean(c.area)),
    'Every Italy callout should include an area definition'
  );
});

test('reconcileWithDefaultMaps upgrades legacy 3-callout Italy even if cloud timestamp was bumped', () => {
  const legacyItaly = {
    id: 'italy',
    name: 'Italy',
    slug: 'italy',
    category: 'hostage',
    image: 'maps/italy.png',
    descriptionDe: '',
    descriptionEn: '',
    updatedAt: Date.now() + 100000, // simulates previous bulk cloud upload timestamp
    tacticData: {
      drawings: [],
      utilities: [],
      players: [],
      presets: [{ id: 'user_preset_1', name: 'My Italy Setup', updatedAt: 123, drawings: [], utilities: [], players: [] }],
    },
    callouts: [
      { id: 'italy_market', name: 'Market', x: 18.1, y: 13.7, zone: 'mid', danger: 'high', descriptionDe: '', descriptionEn: '', tacticalTipDe: '', tacticalTipEn: '', commonAnglesDe: '', commonAnglesEn: '' },
      { id: 'italy_t_spawn', name: 'T Spawn (House)', x: 11.1, y: -39.8, zone: 't_spawn', danger: 'low', descriptionDe: '', descriptionEn: '', tacticalTipDe: '', tacticalTipEn: '', commonAnglesDe: '', commonAnglesEn: '' },
      { id: 'italy_ct_spawn', name: 'CT Spawn', x: -7.9, y: 41.4, zone: 'ct_spawn', danger: 'low', descriptionDe: '', descriptionEn: '', tacticalTipDe: '', tacticalTipEn: '', commonAnglesDe: '', commonAnglesEn: '' },
    ],
  } as any;

  const reconciled = reconcileWithDefaultMaps([legacyItaly]);
  const upgradedItaly = reconciled.find((m) => m.id === 'italy');
  assert.ok(upgradedItaly);
  assert.equal(upgradedItaly.callouts.length, 14);
  assert.equal(upgradedItaly.tacticData?.presets?.[0]?.id, 'user_preset_1');

  // Verify loadStoredMaps works cleanly in non-browser context too
  const loaded = loadStoredMaps();
  const loadedItaly = loaded.find((m) => m.id === 'italy');
  assert.equal(loadedItaly?.callouts.length, 14);
});
