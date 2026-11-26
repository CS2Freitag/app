import LZString from 'lz-string';
import { TacticalDrawingLine, UtilityMarker, PlayerToken, UtilityThrowType } from '../types';

export interface CompactTacticPayload {
  m: string; // Map ID
  n?: string; // Map or tactic name
  d: any[]; // Compact drawings: [colorIdxOrHex, hasArrow, [x,y,x,y...]]
  u: any[]; // Compact utilities: [typeIdx, x, y, label, fx?, fy?, bend?, throwTypeIdx?, color?, fontSize?, notes?, lineScale?, spotScale?]
  p: any[]; // Compact players: [sideIdx, number, x, y, hasBomb]
  va?: 0 | 1; // Visibility: areas (0 = hidden)
  vc?: 0 | 1; // Visibility: callouts (0 = hidden)
}

export interface SingleUtilitySharePayload {
  type: 'cs2freitag_single_utility';
  version: 1;
  mapId: string;
  mapName: string;
  exportedAt: string;
  utility: UtilityMarker;
}

const COLOR_MAP = ['#ffffff', '#000000', '#3b82f6', '#92400e', '#ef4444', '#22c55e', '#f97316'];
const UTIL_TYPES = ['smoke', 'flash', 'molotov', 'he', 'decoy'];
const THROW_TYPES: UtilityThrowType[] = ['left', 'right', 'both', 'jump', 'run_jump'];
const SINGLE_UTIL_PREFIX = 'CS2U1:';

/**
 * Compresses tactical drawing and markers into an ultra-compact JSON representation
 * to keep QR codes and URLs lightweight, clean, and easily scannable on mobile cameras.
 */
export function encodeCompactTactic(
  mapId: string,
  mapName: string,
  drawings: TacticalDrawingLine[],
  utilities: UtilityMarker[],
  players: PlayerToken[],
  visibility?: { showAreas?: boolean; showCallouts?: boolean }
): string {
  // 1. Minify drawings: round coordinates to 1 decimal place, convert points to flat array
  const minDrawings = drawings.map((line) => {
    const colIdx = COLOR_MAP.indexOf(line.color);
    const colorVal = colIdx >= 0 ? colIdx : line.color;
    const flatPoints: number[] = [];
    line.points.forEach((pt) => {
      flatPoints.push(Math.round(pt.x * 10) / 10, Math.round(pt.y * 10) / 10);
    });
    return [colorVal, line.hasArrow ? 1 : 0, flatPoints];
  });

  // 2. Minify utilities (keep compact tuple, append extra metadata only when present)
  const minUtils = utilities.map((u) => {
    const uIdx = UTIL_TYPES.indexOf(u.type);
    const base: any[] = [
      uIdx >= 0 ? uIdx : u.type,
      Math.round(u.x * 10) / 10,
      Math.round(u.y * 10) / 10,
      u.label || '',
    ];
    const hasExtras = Boolean(
      u.throwFrom ||
        u.throwType ||
        u.color ||
        u.fontSize !== undefined ||
        u.notes ||
        u.lineScale !== undefined ||
        u.spotScale !== undefined
    );
    if (hasExtras) {
      const fx = u.throwFrom ? Math.round(u.throwFrom.x * 10) / 10 : null;
      const fy = u.throwFrom ? Math.round(u.throwFrom.y * 10) / 10 : null;
      const bend = u.curveBend !== undefined ? Math.round(u.curveBend * 10) / 10 : null;
      const ttIdx = u.throwType ? THROW_TYPES.indexOf(u.throwType) : -1;
      base.push(fx, fy, bend, ttIdx >= 0 ? ttIdx : null);

      const hasRichMeta = Boolean(
        u.color || u.fontSize !== undefined || u.notes || u.lineScale !== undefined || u.spotScale !== undefined
      );
      if (hasRichMeta) {
        base.push(
          u.color || null,
          u.fontSize !== undefined ? u.fontSize : null,
          u.notes || null,
          u.lineScale !== undefined ? Math.round(u.lineScale * 100) / 100 : null,
          u.spotScale !== undefined ? Math.round(u.spotScale * 100) / 100 : null
        );
      }
    }
    return base;
  });

  // 3. Minify players
  const minPlayers = players.map((p) => {
    return [
      p.side === 'ct' ? 1 : 0,
      p.number,
      Math.round(p.x * 10) / 10,
      Math.round(p.y * 10) / 10,
      p.hasBomb ? 1 : 0,
    ];
  });

  const payload: CompactTacticPayload = {
    m: mapId,
    n: mapName,
    d: minDrawings,
    u: minUtils,
    p: minPlayers,
  };

  if (visibility?.showAreas === false) {
    payload.va = 0;
  }
  if (visibility?.showCallouts === false) {
    payload.vc = 0;
  }

  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

/**
 * Decodes either compact or legacy tactic codes/JSON into standard tactical objects.
 */
export function decodeCompactTactic(rawString: string): {
  mapId?: string;
  name?: string;
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  showAreas?: boolean;
  showCallouts?: boolean;
} | null {
  let clean = rawString.trim();
  if (clean.includes('#tactic=')) {
    clean = clean.split('#tactic=')[1];
  } else if (clean.includes('#t=')) {
    clean = clean.split('#t=')[1];
  }

  let payload: any = null;

  // Try LZString decompress
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(clean);
    if (decompressed) {
      payload = JSON.parse(decompressed);
    }
  } catch (e) {}

  // Try direct JSON parse
  if (!payload) {
    try {
      payload = JSON.parse(clean);
    } catch (e) {}
  }

  if (!payload) return null;

  // If someone pasted a single-utility package JSON here, promote it smoothly
  if (payload.type === 'cs2freitag_single_utility' && payload.utility) {
    return {
      mapId: payload.mapId,
      name: payload.utility.label || payload.mapName || 'Utility',
      drawings: [],
      utilities: [
        {
          ...payload.utility,
          id: `util_${Date.now()}_0`,
        },
      ],
      players: [],
    };
  }

  const mapId = payload.m || payload.mapId;
  const name = payload.n || payload.name;

  // Unpack drawings
  const rawDrawings = payload.d || payload.drawings || [];
  const drawings: TacticalDrawingLine[] = rawDrawings.map((item: any, idx: number) => {
    // Compact array format: [color, hasArrow, flatPoints]
    if (Array.isArray(item)) {
      const colorVal = typeof item[0] === 'number' && COLOR_MAP[item[0]] ? COLOR_MAP[item[0]] : String(item[0]);
      const hasArrow = Boolean(item[1]);
      const flatPts = Array.isArray(item[2]) ? item[2] : [];
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < flatPts.length; i += 2) {
        points.push({ x: flatPts[i], y: flatPts[i + 1] });
      }
      return {
        id: `draw_${Date.now()}_${idx}`,
        color: colorVal,
        hasArrow,
        width: 3,
        points,
      };
    }
    // Legacy object format
    return {
      id: item.id || `draw_${Date.now()}_${idx}`,
      color: item.color || '#ffffff',
      hasArrow: item.hasArrow !== undefined ? item.hasArrow : true,
      width: item.width || 3,
      points: item.points || [],
    };
  });

  // Unpack utilities
  const rawUtils = payload.u || payload.utilities || [];
  const utilities: UtilityMarker[] = rawUtils.map((item: any, idx: number) => {
    if (Array.isArray(item)) {
      const uType = typeof item[0] === 'number' && UTIL_TYPES[item[0]] ? UTIL_TYPES[item[0]] : String(item[0]);
      const hasThrow = typeof item[4] === 'number' && typeof item[5] === 'number';
      const bendVal = typeof item[6] === 'number' ? item[6] : undefined;
      const throwTypeVal =
        typeof item[7] === 'number' && THROW_TYPES[item[7]] ? THROW_TYPES[item[7]] : undefined;
      const colorVal = typeof item[8] === 'string' && item[8] ? item[8] : undefined;
      const fontSizeVal = typeof item[9] === 'number' ? item[9] : undefined;
      const notesVal = typeof item[10] === 'string' && item[10] ? item[10] : undefined;
      const lineScaleVal = typeof item[11] === 'number' ? item[11] : undefined;
      const spotScaleVal = typeof item[12] === 'number' ? item[12] : undefined;
      return {
        id: `util_${Date.now()}_${idx}`,
        type: uType as any,
        x: item[1],
        y: item[2],
        label: item[3] || undefined,
        ...(hasThrow ? { throwFrom: { x: item[4], y: item[5] } } : {}),
        ...(bendVal !== undefined ? { curveBend: bendVal } : {}),
        ...(throwTypeVal ? { throwType: throwTypeVal } : {}),
        ...(colorVal ? { color: colorVal } : {}),
        ...(fontSizeVal !== undefined ? { fontSize: fontSizeVal } : {}),
        ...(notesVal ? { notes: notesVal } : {}),
        ...(lineScaleVal !== undefined ? { lineScale: lineScaleVal } : {}),
        ...(spotScaleVal !== undefined ? { spotScale: spotScaleVal } : {}),
      };
    }
    return {
      ...item,
      id: item.id || `util_${Date.now()}_${idx}`,
      type: item.type || 'smoke',
      x: item.x,
      y: item.y,
    };
  });

  // Unpack players
  const rawPlayers = payload.p || payload.players || [];
  const players: PlayerToken[] = rawPlayers.map((item: any, idx: number) => {
    if (Array.isArray(item)) {
      return {
        id: `player_${Date.now()}_${idx}`,
        side: item[0] === 1 ? 'ct' : 't',
        number: item[1] || 1,
        x: item[2],
        y: item[3],
        hasBomb: Boolean(item[4]),
      };
    }
    return {
      id: item.id || `player_${Date.now()}_${idx}`,
      side: item.side || 'ct',
      number: item.number || 1,
      x: item.x,
      y: item.y,
      hasBomb: Boolean(item.hasBomb),
    };
  });

  return {
    mapId,
    name,
    drawings,
    utilities,
    players,
    ...(payload.va === 0 ? { showAreas: false } : {}),
    ...(payload.vc === 0 ? { showCallouts: false } : {}),
  };
}

/**
 * Encodes a complete single utility (including all 3 images across slots 1..4, label, fontSize, color, notes, throw line).
 */
export function buildSingleUtilitySharePayload(
  mapId: string,
  mapName: string,
  utility: UtilityMarker
): SingleUtilitySharePayload {
  return {
    type: 'cs2freitag_single_utility',
    version: 1,
    mapId,
    mapName,
    exportedAt: new Date().toISOString(),
    utility: JSON.parse(JSON.stringify(utility)),
  };
}

export function encodeSingleUtilityPackage(
  mapId: string,
  mapName: string,
  utility: UtilityMarker
): string {
  const payload = buildSingleUtilitySharePayload(mapId, mapName, utility);
  return `${SINGLE_UTIL_PREFIX}${LZString.compressToEncodedURIComponent(JSON.stringify(payload))}`;
}

export function decodeSingleUtilityPackage(rawString: string): SingleUtilitySharePayload | null {
  let clean = rawString.trim();
  if (!clean) return null;

  if (clean.includes('#u=')) {
    clean = clean.split('#u=')[1];
  }

  if (clean.startsWith(SINGLE_UTIL_PREFIX)) {
    const encoded = clean.slice(SINGLE_UTIL_PREFIX.length);
    try {
      const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
      if (decompressed) {
        const parsed = JSON.parse(decompressed);
        if (parsed?.type === 'cs2freitag_single_utility' && parsed?.utility) {
          return parsed as SingleUtilitySharePayload;
        }
      }
    } catch {
      return null;
    }
  }

  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(clean);
    if (decompressed) {
      const parsed = JSON.parse(decompressed);
      if (parsed?.type === 'cs2freitag_single_utility' && parsed?.utility) {
        return parsed as SingleUtilitySharePayload;
      }
    }
  } catch {
    // ignore
  }

  try {
    const parsed = JSON.parse(clean);
    if (parsed?.type === 'cs2freitag_single_utility' && parsed?.utility) {
      return parsed as SingleUtilitySharePayload;
    }
  } catch {
    // ignore
  }

  return null;
}
