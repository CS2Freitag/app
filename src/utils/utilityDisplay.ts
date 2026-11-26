import { TacticalTool, UtilityMarker } from '../types';

export const MIN_UTILITY_LINE_SCALE = 0.2;
export const MAX_UTILITY_LINE_SCALE = 2.0;
export const DEFAULT_UTILITY_LINE_SCALE = 0.5;

export const MIN_UTILITY_SPOT_SCALE = 0.5;
export const MAX_UTILITY_SPOT_SCALE = 5.0;
export const DEFAULT_UTILITY_SPOT_SCALE = 1.0;

export const UTILITY_DISPLAY_STORAGE_KEY = 'cs2_utility_display_settings';
export const DEFAULT_THROW_ORIGIN_SNAP_RADIUS = 2.5;
export const ORIGIN_COLOCATION_TOLERANCE = 0.4;

export interface UtilityDisplaySettings {
  lineScale: number;
  spotScale: number;
  showUtilities: boolean;
}

export function clampUtilityLineScale(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_UTILITY_LINE_SCALE;
  }
  const clamped = Math.max(MIN_UTILITY_LINE_SCALE, Math.min(MAX_UTILITY_LINE_SCALE, value));
  return Math.round(clamped * 100) / 100;
}

export function clampUtilitySpotScale(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_UTILITY_SPOT_SCALE;
  }
  const clamped = Math.max(MIN_UTILITY_SPOT_SCALE, Math.min(MAX_UTILITY_SPOT_SCALE, value));
  return Math.round(clamped * 100) / 100;
}

export function getDefaultUtilityDisplaySettings(): UtilityDisplaySettings {
  return {
    lineScale: DEFAULT_UTILITY_LINE_SCALE,
    spotScale: DEFAULT_UTILITY_SPOT_SCALE,
    showUtilities: true,
  };
}

export function loadUtilityDisplaySettings(): UtilityDisplaySettings {
  const defaults = getDefaultUtilityDisplaySettings();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(UTILITY_DISPLAY_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UtilityDisplaySettings>;
    return {
      lineScale:
        typeof parsed.lineScale === 'number'
          ? clampUtilityLineScale(parsed.lineScale)
          : defaults.lineScale,
      spotScale:
        typeof parsed.spotScale === 'number'
          ? clampUtilitySpotScale(parsed.spotScale)
          : defaults.spotScale,
      showUtilities:
        typeof parsed.showUtilities === 'boolean' ? parsed.showUtilities : defaults.showUtilities,
    };
  } catch {
    return defaults;
  }
}

export function saveUtilityDisplaySettings(settings: UtilityDisplaySettings): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized: UtilityDisplaySettings = {
      lineScale: clampUtilityLineScale(settings.lineScale),
      spotScale: clampUtilitySpotScale(settings.spotScale),
      showUtilities: Boolean(settings.showUtilities),
    };
    window.localStorage.setItem(UTILITY_DISPLAY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function getUtilitySpotPixelSize(spotScale: number, basePx = 24): number {
  const scale = clampUtilitySpotScale(spotScale);
  return Math.round(basePx * scale * 10) / 10;
}

export interface UtilityThrowSvgMetrics {
  casingWidth: number;
  strokeWidth: number;
  haloWidth: number;
  dashArray: string;
  chevronLength: number;
  originOuterRadius: number;
  originInnerRadius: number;
  originStrokeWidth: number;
}

export function getUtilityThrowSvgMetrics(
  lineScale: number,
  isSelected = false
): UtilityThrowSvgMetrics {
  const scale = clampUtilityLineScale(lineScale);
  const dashScale = 0.45 + 0.55 * scale;
  const originScale = Math.max(0.45, Math.min(1.5, 0.5 + 0.5 * scale));

  return {
    casingWidth: Math.round((isSelected ? 1.35 : 1.05) * scale * 1000) / 1000,
    strokeWidth: Math.round((isSelected ? 0.8 : 0.6) * scale * 1000) / 1000,
    haloWidth: Math.round(1.9 * Math.max(0.45, scale) * 1000) / 1000,
    dashArray: `${(1.7 * dashScale).toFixed(2)},${(1.1 * dashScale).toFixed(2)}`,
    chevronLength: Math.round(1.6 * (0.55 + 0.45 * scale) * 1000) / 1000,
    originOuterRadius: Math.round((isSelected ? 1.35 : 1.05) * originScale * 1000) / 1000,
    originInnerRadius: Math.round(0.45 * originScale * 1000) / 1000,
    originStrokeWidth: Math.round(0.45 * originScale * 1000) / 1000,
  };
}

export function shouldIgnoreCalloutInteractions(activeTool: TacticalTool): boolean {
  return activeTool === 'utility';
}

export function areThrowOriginsCoLocated(
  a: { x: number; y: number },
  b: { x: number; y: number },
  tolerance = ORIGIN_COLOCATION_TOLERANCE
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
}

export function findSnapThrowOrigin(
  coord: { x: number; y: number },
  utilities: UtilityMarker[],
  maxDistance = DEFAULT_THROW_ORIGIN_SNAP_RADIUS
): { x: number; y: number } | null {
  let closestOrigin: { x: number; y: number } | null = null;
  let bestDist = maxDistance;

  for (const util of utilities) {
    if (!util.throwFrom) continue;
    const dist = Math.hypot(coord.x - util.throwFrom.x, coord.y - util.throwFrom.y);
    if (dist <= bestDist) {
      bestDist = dist;
      closestOrigin = { x: util.throwFrom.x, y: util.throwFrom.y };
    }
  }

  return closestOrigin;
}

export function findCoLocatedOriginUtilityIds(
  utilities: UtilityMarker[],
  origin: { x: number; y: number },
  tolerance = ORIGIN_COLOCATION_TOLERANCE
): string[] {
  return utilities
    .filter((u) => u.throwFrom && areThrowOriginsCoLocated(u.throwFrom, origin, tolerance))
    .map((u) => u.id);
}

export function getEffectiveUtilityLineScale(
  util: Pick<UtilityMarker, 'lineScale'>,
  globalLineScale: number
): number {
  return clampUtilityLineScale(
    typeof util.lineScale === 'number' && Number.isFinite(util.lineScale)
      ? util.lineScale
      : globalLineScale
  );
}

export function getEffectiveUtilitySpotScale(
  util: Pick<UtilityMarker, 'spotScale'>,
  globalSpotScale: number
): number {
  return clampUtilitySpotScale(
    typeof util.spotScale === 'number' && Number.isFinite(util.spotScale)
      ? util.spotScale
      : globalSpotScale
  );
}

export function getUtilityColor(
  util: Pick<UtilityMarker, 'color'>,
  defaultColorHex: string
): string {
  const custom = typeof util.color === 'string' ? util.color.trim() : '';
  return custom.length > 0 ? custom : defaultColorHex;
}

export interface SafeViewportInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function clampMenuPosition(
  pos: { x: number; y: number },
  menuSize: { width: number; height: number },
  viewport: { width: number; height: number },
  padding: number | SafeViewportInsets = 12
): { x: number; y: number } {
  const insets: SafeViewportInsets =
    typeof padding === 'number'
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : padding;
  const maxX = Math.max(insets.left, viewport.width - menuSize.width - insets.right);
  const maxY = Math.max(insets.top, viewport.height - menuSize.height - insets.bottom);
  return {
    x: Math.round(Math.max(insets.left, Math.min(maxX, pos.x))),
    y: Math.round(Math.max(insets.top, Math.min(maxY, pos.y))),
  };
}

/**
 * Places a context menu completely inside the safe viewport next to (right, left, above, or below)
 * the clicked target so it never overflows off-screen or overlaps top/bottom toolbars.
 */
export function computeSmartContextMenuPosition(
  anchor: { x: number; y: number },
  menuSize: { width: number; height: number },
  viewport: { width: number; height: number },
  safeInsets: SafeViewportInsets = { top: 60, right: 12, bottom: 72, left: 12 },
  gap = 14
): { x: number; y: number } {
  const minX = safeInsets.left;
  const maxX = Math.max(minX, viewport.width - menuSize.width - safeInsets.right);
  const minY = safeInsets.top;
  const maxY = Math.max(minY, viewport.height - menuSize.height - safeInsets.bottom);

  const clampVal = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const alignedY = clampVal(anchor.y - Math.round(menuSize.height * 0.35), minY, maxY);
  const centeredX = clampVal(anchor.x - Math.round(menuSize.width * 0.5), minX, maxX);

  const rawCandidates = [
    // Right of target
    { x: anchor.x + gap, y: alignedY },
    // Left of target
    { x: anchor.x - menuSize.width - gap, y: alignedY },
    // Above target
    { x: centeredX, y: anchor.y - menuSize.height - gap },
    // Below target
    { x: centeredX, y: anchor.y + gap },
  ];

  const fitsSafe = (pos: { x: number; y: number }) =>
    pos.x >= minX &&
    pos.x <= maxX &&
    pos.y >= minY &&
    pos.y <= maxY;

  const clearOfAnchor = (pos: { x: number; y: number }) =>
    pos.x >= anchor.x + 8 ||
    pos.x + menuSize.width <= anchor.x - 8 ||
    pos.y >= anchor.y + 8 ||
    pos.y + menuSize.height <= anchor.y - 8;

  for (const candidate of rawCandidates) {
    if (fitsSafe(candidate) && clearOfAnchor(candidate)) {
      return { x: Math.round(candidate.x), y: Math.round(candidate.y) };
    }
  }

  // Try clamped candidates that still avoid covering the anchor point
  for (const candidate of rawCandidates) {
    const clamped = clampMenuPosition(candidate, menuSize, viewport, safeInsets);
    if (clearOfAnchor(clamped)) {
      return clamped;
    }
  }

  return clampMenuPosition(rawCandidates[0], menuSize, viewport, safeInsets);
}


