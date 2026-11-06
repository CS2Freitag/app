import LZString from 'lz-string';
import { TacticalDrawingLine, UtilityMarker, PlayerToken } from '../types';

export interface CompactTacticPayload {
  m: string; // Map ID
  n?: string; // Map or tactic name
  d: any[]; // Compact drawings: [colorIdxOrHex, hasArrow, [x,y,x,y...]]
  u: any[]; // Compact utilities: [typeIdx, x, y, label]
  p: any[]; // Compact players: [sideIdx, number, x, y, hasBomb]
}

const COLOR_MAP = ['#ffffff', '#000000', '#3b82f6', '#92400e', '#ef4444', '#22c55e', '#f97316'];
const UTIL_TYPES = ['smoke', 'flash', 'molotov', 'he', 'decoy'];

/**
 * Compresses tactical drawing and markers into a ultra-compact JSON representation
 * to keep QR codes and URLs lightweight, clean, and easily scannable on mobile cameras.
 */
export function encodeCompactTactic(
  mapId: string,
  mapName: string,
  drawings: TacticalDrawingLine[],
  utilities: UtilityMarker[],
  players: PlayerToken[]
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

  // 2. Minify utilities
  const minUtils = utilities.map((u) => {
    const uIdx = UTIL_TYPES.indexOf(u.type);
    return [
      uIdx >= 0 ? uIdx : u.type,
      Math.round(u.x * 10) / 10,
      Math.round(u.y * 10) / 10,
      u.label || '',
    ];
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
      return {
        id: `util_${Date.now()}_${idx}`,
        type: uType as any,
        x: item[1],
        y: item[2],
        label: item[3] || undefined,
      };
    }
    return {
      id: item.id || `util_${Date.now()}_${idx}`,
      type: item.type || 'smoke',
      x: item.x,
      y: item.y,
      label: item.label,
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
  };
}
