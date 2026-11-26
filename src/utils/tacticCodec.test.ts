import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeCompactTactic,
  decodeCompactTactic,
  encodeSingleUtilityPackage,
  decodeSingleUtilityPackage,
} from './tacticCodec';
import { UtilityMarker } from '../types';

test('encodeCompactTactic & decodeCompactTactic preserve utility color, fontSize, notes and visibility flags', () => {
  const util: UtilityMarker = {
    id: 'u1',
    type: 'smoke',
    x: 12.4,
    y: -18.7,
    throwFrom: { x: -24.1, y: 31.2 },
    curveBend: 8.5,
    throwType: 'jump',
    label: 'CT Smoke',
    notes: 'Stand corner and jumpthrow',
    color: '#22c55e',
    fontSize: 18,
    lineScale: 1.4,
    spotScale: 1.5,
  };

  const encoded = encodeCompactTactic('inferno', 'Inferno Test', [], [util], [], {
    showAreas: false,
    showCallouts: true,
  });

  const decoded = decodeCompactTactic(encoded);
  assert.ok(decoded);
  assert.equal(decoded.mapId, 'inferno');
  assert.equal(decoded.showAreas, false);
  assert.equal(decoded.showCallouts, undefined);
  assert.equal(decoded.utilities.length, 1);
  assert.equal(decoded.utilities[0].label, 'CT Smoke');
  assert.equal(decoded.utilities[0].color, '#22c55e');
  assert.equal(decoded.utilities[0].fontSize, 18);
  assert.equal(decoded.utilities[0].notes, 'Stand corner and jumpthrow');
  assert.equal(decoded.utilities[0].throwType, 'jump');
  assert.equal(decoded.utilities[0].lineScale, 1.4);
  assert.equal(decoded.utilities[0].spotScale, 1.5);
});

test('encodeSingleUtilityPackage & decodeSingleUtilityPackage preserve all 3 images, name, color and notes', () => {
  const util: UtilityMarker = {
    id: 'u2',
    type: 'molotov',
    x: -5.5,
    y: -22.2,
    label: 'Coffins Molo',
    color: '#f97316',
    fontSize: 22,
    notes: 'Left click at roof corner',
    throwType: 'left',
    throwFrom: { x: -10, y: 12 },
    activeAimSpot: '2',
    aimSpots: {
      '1': {
        standpunktImage: 'data:image/png;base64,AAA',
        aimImage: 'data:image/png;base64,BBB',
        resultImage: 'data:image/png;base64,CCC',
      },
      '2': {
        aimImage: 'data:image/png;base64,DDD',
        resultImage: 'data:image/png;base64,EEE',
      },
    },
  };

  const encoded = encodeSingleUtilityPackage('inferno', 'Inferno', util);
  assert.ok(encoded.startsWith('CS2U1:'));

  const decoded = decodeSingleUtilityPackage(encoded);
  assert.ok(decoded);
  assert.equal(decoded.type, 'cs2freitag_single_utility');
  assert.equal(decoded.mapId, 'inferno');
  assert.equal(decoded.utility.label, 'Coffins Molo');
  assert.equal(decoded.utility.color, '#f97316');
  assert.equal(decoded.utility.fontSize, 22);
  assert.equal(decoded.utility.activeAimSpot, '2');
  assert.equal(decoded.utility.aimSpots?.['1']?.standpunktImage, 'data:image/png;base64,AAA');
  assert.equal(decoded.utility.aimSpots?.['2']?.resultImage, 'data:image/png;base64,EEE');
});
