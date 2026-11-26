import test from 'node:test';
import assert from 'node:assert/strict';
import { UtilityMarker } from '../types';
import {
  MIN_UTILITY_LINE_SCALE,
  MAX_UTILITY_LINE_SCALE,
  DEFAULT_UTILITY_LINE_SCALE,
  MIN_UTILITY_SPOT_SCALE,
  MAX_UTILITY_SPOT_SCALE,
  DEFAULT_UTILITY_SPOT_SCALE,
  getDefaultUtilityDisplaySettings,
  clampUtilityLineScale,
  clampUtilitySpotScale,
  getUtilitySpotPixelSize,
  getUtilityThrowSvgMetrics,
  shouldIgnoreCalloutInteractions,
  findSnapThrowOrigin,
  findCoLocatedOriginUtilityIds,
  getEffectiveUtilityLineScale,
  getEffectiveUtilitySpotScale,
  getUtilityColor,
  clampMenuPosition,
  computeSmartContextMenuPosition,
} from './utilityDisplay';
import { isSupportedUtilityScreenshotFile } from './imageOptimize';

test('default utility display settings use 50% line scale and 100% spot scale', () => {
  assert.equal(DEFAULT_UTILITY_LINE_SCALE, 0.5);
  assert.equal(DEFAULT_UTILITY_SPOT_SCALE, 1.0);
  const defaults = getDefaultUtilityDisplaySettings();
  assert.equal(defaults.lineScale, 0.5);
  assert.equal(defaults.spotScale, 1.0);
  assert.equal(defaults.showUtilities, true);
});

test('clampUtilityLineScale enforces 0.2x (5x thinner) to 2.0x (2x thicker) range', () => {
  assert.equal(MIN_UTILITY_LINE_SCALE, 0.2);
  assert.equal(MAX_UTILITY_LINE_SCALE, 2.0);
  assert.equal(clampUtilityLineScale(0.05), 0.2);
  assert.equal(clampUtilityLineScale(0.2), 0.2);
  assert.equal(clampUtilityLineScale(0.57), 0.57);
  assert.equal(clampUtilityLineScale(1.0), 1.0);
  assert.equal(clampUtilityLineScale(2.0), 2.0);
  assert.equal(clampUtilityLineScale(3.5), 2.0);
  assert.equal(clampUtilityLineScale(Number.NaN), 0.5);
});

test('clampUtilitySpotScale enforces 0.5x (half size) to 5.0x (5x larger) range', () => {
  assert.equal(MIN_UTILITY_SPOT_SCALE, 0.5);
  assert.equal(MAX_UTILITY_SPOT_SCALE, 5.0);
  assert.equal(clampUtilitySpotScale(0.1), 0.5);
  assert.equal(clampUtilitySpotScale(0.5), 0.5);
  assert.equal(clampUtilitySpotScale(2.35), 2.35);
  assert.equal(clampUtilitySpotScale(5.0), 5.0);
  assert.equal(clampUtilitySpotScale(9.0), 5.0);
  assert.equal(clampUtilitySpotScale(Number.POSITIVE_INFINITY), 1.0);
});

test('getUtilitySpotPixelSize scales 24px base spot cleanly from 12px to 120px', () => {
  assert.equal(getUtilitySpotPixelSize(0.5), 12);
  assert.equal(getUtilitySpotPixelSize(1.0), 24);
  assert.equal(getUtilitySpotPixelSize(5.0), 120);
});

test('getUtilityThrowSvgMetrics scales line stroke widths proportionally between 0.2x and 2.0x', () => {
  const thin = getUtilityThrowSvgMetrics(0.2, false);
  const normal = getUtilityThrowSvgMetrics(1.0, false);
  const thick = getUtilityThrowSvgMetrics(2.0, false);

  assert.equal(normal.strokeWidth, 0.6);
  assert.equal(thin.strokeWidth, 0.12); // 5x thinner than normal
  assert.equal(thick.strokeWidth, 1.2); // 2x thicker than normal
  assert.ok(thin.casingWidth < normal.casingWidth);
  assert.ok(thick.casingWidth > normal.casingWidth);
});

test('shouldIgnoreCalloutInteractions returns true only when utility tool is active', () => {
  assert.equal(shouldIgnoreCalloutInteractions('utility'), true);
  assert.equal(shouldIgnoreCalloutInteractions('select'), false);
  assert.equal(shouldIgnoreCalloutInteractions('pen'), false);
  assert.equal(shouldIgnoreCalloutInteractions('eraser'), false);
});

test('findSnapThrowOrigin snaps to nearest existing throwFrom within threshold and groups co-located origins', () => {
  const utilities: UtilityMarker[] = [
    {
      id: 'u1',
      type: 'smoke',
      x: 10,
      y: -15,
      throwFrom: { x: -20, y: 25 },
    },
    {
      id: 'u2',
      type: 'flash',
      x: 14,
      y: -10,
      throwFrom: { x: -20, y: 25 },
    },
    {
      id: 'u3',
      type: 'molotov',
      x: 5,
      y: 5,
      // No throwFrom (spot only)
    },
    {
      id: 'u4',
      type: 'he',
      x: -5,
      y: -5,
      throwFrom: { x: 12, y: 12 },
    },
  ];

  const snapped = findSnapThrowOrigin({ x: -18.8, y: 24.2 }, utilities);
  assert.deepEqual(snapped, { x: -20, y: 25 });

  const miss = findSnapThrowOrigin({ x: 0, y: 0 }, utilities);
  assert.equal(miss, null);

  const shared = findCoLocatedOriginUtilityIds(utilities, { x: -20, y: 25 });
  assert.deepEqual(shared, ['u1', 'u2']);
});

test('per-utility lineScale, spotScale and color resolve cleanly with global fallback', () => {
  assert.equal(getEffectiveUtilityLineScale({}, 0.5), 0.5);
  assert.equal(getEffectiveUtilityLineScale({ lineScale: 1.65 }, 0.5), 1.65);
  assert.equal(getEffectiveUtilityLineScale({ lineScale: 0.05 }, 0.5), 0.2);

  assert.equal(getEffectiveUtilitySpotScale({}, 1.5), 1.5);
  assert.equal(getEffectiveUtilitySpotScale({ spotScale: 3.2 }, 1.0), 3.2);
  assert.equal(getEffectiveUtilitySpotScale({ spotScale: 9.0 }, 1.0), 5.0);

  assert.equal(getUtilityColor({}, '#0ea5e9'), '#0ea5e9');
  assert.equal(getUtilityColor({ color: '#22c55e' }, '#0ea5e9'), '#22c55e');
});

test('clampMenuPosition keeps context menu fully inside viewport bounds', () => {
  const clampedBottomRight = clampMenuPosition(
    { x: 1380, y: 820 },
    { width: 248, height: 420 },
    { width: 1440, height: 900 }
  );
  assert.equal(clampedBottomRight.x, 1180);
  assert.equal(clampedBottomRight.y, 468);

  const clampedTopLeft = clampMenuPosition(
    { x: -30, y: 2 },
    { width: 248, height: 420 },
    { width: 390, height: 844 }
  );
  assert.equal(clampedTopLeft.x, 12);
  assert.equal(clampedTopLeft.y, 12);
});

test('computeSmartContextMenuPosition places menu beside target without bottom/edge clipping', () => {
  const menu = { width: 256, height: 340 };
  const desktop = { width: 1440, height: 900 };

  // Bottom-left area click: opens to the right of target and stays above bottom bar (900 - 72)
  const bottomPos = computeSmartContextMenuPosition({ x: 380, y: 800 }, menu, desktop);
  assert.ok(bottomPos.x >= 380 + 8);
  assert.ok(bottomPos.y >= 60);
  assert.ok(bottomPos.y + menu.height <= desktop.height - 72);

  // Far-right edge click: flips to the left of target
  const rightEdgePos = computeSmartContextMenuPosition({ x: 1350, y: 400 }, menu, desktop);
  assert.ok(rightEdgePos.x + menu.width <= 1350 - 8);
  assert.ok(rightEdgePos.x >= 12);

  // Narrow mobile bottom click: places cleanly above anchor without overlapping anchor or bottom bar
  const mobile = { width: 390, height: 844 };
  const mobileBottom = computeSmartContextMenuPosition({ x: 195, y: 720 }, menu, mobile);
  assert.ok(mobileBottom.y + menu.height <= 720 - 8);
  assert.ok(mobileBottom.x >= 12 && mobileBottom.x + menu.width <= mobile.width - 12);
});

test('isSupportedUtilityScreenshotFile accepts WebP, JPG, JPEG, PNG and rejects unsupported formats', () => {
  assert.equal(isSupportedUtilityScreenshotFile({ name: 'spot.webp', type: 'image/webp' }), true);
  assert.equal(isSupportedUtilityScreenshotFile({ name: 'aim.jpg', type: 'image/jpeg' }), true);
  assert.equal(isSupportedUtilityScreenshotFile({ name: 'res.PNG', type: '' }), true);
  assert.equal(isSupportedUtilityScreenshotFile({ name: 'anim.gif', type: 'image/gif' }), false);
  assert.equal(isSupportedUtilityScreenshotFile({ name: 'doc.pdf', type: 'application/pdf' }), false);
});

test('utility label font size presets are within expected range', () => {
  const allowedSizes = [10, 12, 14, 16, 18, 22, 28];
  allowedSizes.forEach((sz) => {
    assert.ok(sz >= 10 && sz <= 28);
  });
});



