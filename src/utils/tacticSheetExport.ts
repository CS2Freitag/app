import { Callout, MapData, TacticalDrawingLine, UtilityMarker, PlayerToken, Language, UtilityAimSlotId } from '../types';
import { resolveAssetPath } from './assets';
import {
  clampUtilityLineScale,
  clampUtilitySpotScale,
  DEFAULT_UTILITY_LINE_SCALE,
  DEFAULT_UTILITY_SPOT_SCALE,
  getEffectiveUtilityLineScale,
  getEffectiveUtilitySpotScale,
  getUtilityColor,
} from './utilityDisplay';
import { formatThrowTypeFull, getThrowGeometry, THROW_TYPE_META } from './utilityThrowGeometry';
import { UTILITY_META } from '../components/UtilitySymbol';

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = resolveAssetPath(src);
  });
}

function getAreaRenderStyle(c: Callout): {
  fill: string;
  stroke: string;
  isHatched: boolean;
  strokeWidth: number;
} {
  // If custom color is provided
  if (c.area?.customColor) {
    const col = c.area.customColor;
    return {
      fill: `${col}55`, // ~33% alpha
      stroke: col,
      isHatched: false,
      strokeWidth: 5,
    };
  }

  // 1. Bombsites (a_site or b_site)
  if (c.zone === 'a_site' || c.zone === 'b_site') {
    return {
      fill: 'rgba(239, 68, 68, 0.32)',
      stroke: '#ef4444',
      isHatched: true,
      strokeWidth: 5,
    };
  }

  // 2. CT Spawn
  if (c.zone === 'ct_spawn') {
    return {
      fill: 'rgba(37, 99, 235, 0.35)',
      stroke: '#2563eb',
      isHatched: false,
      strokeWidth: 5,
    };
  }

  // 3. T Spawn
  if (c.zone === 't_spawn') {
    return {
      fill: 'rgba(180, 83, 9, 0.38)',
      stroke: '#b45309',
      isHatched: false,
      strokeWidth: 5,
    };
  }

  // 4. Danger level based or Zone based
  if (c.danger === 'high') {
    return {
      fill: 'rgba(239, 68, 68, 0.32)',
      stroke: '#ef4444',
      isHatched: false,
      strokeWidth: 5,
    };
  }
  if (c.danger === 'low') {
    return {
      fill: 'rgba(34, 197, 94, 0.32)',
      stroke: '#22c55e',
      isHatched: false,
      strokeWidth: 5,
    };
  }

  // Medium / Default (Amber / Orange)
  return {
    fill: 'rgba(245, 158, 11, 0.30)',
    stroke: '#f59e0b',
    isHatched: false,
    strokeWidth: 5,
  };
}

function drawDiagonalStripes(
  ctx: CanvasRenderingContext2D,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  stripeColor: string = 'rgba(239, 68, 68, 0.7)',
  lineWidth: number = 4,
  spacing: number = 16
) {
  ctx.save();
  ctx.strokeStyle = stripeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';
  const width = maxX - minX;
  const height = maxY - minY;
  const diag = width + height;

  for (let offset = -diag; offset <= diag; offset += spacing) {
    ctx.beginPath();
    ctx.moveTo(minX + offset, minY);
    ctx.lineTo(minX + offset + height, maxY);
    ctx.stroke();
  }
  ctx.restore();
}

export async function generateTacticSheetPng(
  mapData: MapData,
  tacticState: { drawings: TacticalDrawingLine[]; utilities: UtilityMarker[]; players: PlayerToken[] },
  tacticTitle: string,
  options?: {
    utilityLineScale?: number;
    utilitySpotScale?: number;
    showAreas?: boolean;
    showCallouts?: boolean;
    size?: number;
    includeHeader?: boolean;
  }
): Promise<string> {
  const utilityLineScale = clampUtilityLineScale(options?.utilityLineScale ?? DEFAULT_UTILITY_LINE_SCALE);
  const utilitySpotScale = clampUtilitySpotScale(options?.utilitySpotScale ?? DEFAULT_UTILITY_SPOT_SCALE);
  const showAreas = options?.showAreas !== false;
  const showCallouts = options?.showCallouts !== false;
  const includeHeader = options?.includeHeader !== false;
  const size = options?.size && options.size >= 320 ? Math.round(options.size) : 1600;
  const ratio = size / 1600;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // 1. Fill dark background
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, size, size);

  // 2. Load and draw Radar Base Image
  if (mapData.image) {
    const bgImg = await loadImage(mapData.image);
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, size, size);
    }
  }

  const callouts = mapData.callouts || [];

  // ==========================================
  // STEP 3: DRAW ALL CALLOUT AREAS (FIRST PASS - BEHIND LABELS AND LINES)
  // ==========================================
  if (showAreas) {
  for (const c of callouts) {
    if (!c.area) continue;
    const style = getAreaRenderStyle(c);

    if (c.area.shape === 'polygon' && c.area.points && c.area.points.length >= 3) {
      // Polygon Area
      ctx.save();
      ctx.beginPath();
      const p0 = c.area.points[0];
      const p0x = ((p0.x + 50) / 100) * size;
      const p0y = ((p0.y + 50) / 100) * size;
      ctx.moveTo(p0x, p0y);

      let minX = p0x;
      let maxX = p0x;
      let minY = p0y;
      let maxY = p0y;

      for (let k = 1; k < c.area.points.length; k++) {
        const p = c.area.points[k];
        const px = ((p.x + 50) / 100) * size;
        const py = ((p.y + 50) / 100) * size;
        ctx.lineTo(px, py);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      ctx.closePath();

      // Fill base
      ctx.fillStyle = style.fill;
      ctx.fill();

      // Hatching for bombsites
      if (style.isHatched) {
        ctx.save();
        ctx.clip();
        drawDiagonalStripes(ctx, minX, minY, maxX, maxY, 'rgba(239, 68, 68, 0.65)', 4, 16);
        ctx.restore();
      }

      // Stroke boundary
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    } else {
      // Rectangle Area
      ctx.save();
      const ax = ((c.area.x + 50) / 100) * size;
      const ay = ((c.area.y + 50) / 100) * size;
      const aw = (c.area.width / 100) * size;
      const ah = (c.area.height / 100) * size;
      const rot = c.rotation || 0;

      ctx.translate(ax + aw / 2, ay + ah / 2);
      if (rot !== 0) {
        ctx.rotate((rot * Math.PI) / 180);
      }

      // Fill base
      ctx.fillStyle = style.fill;
      ctx.fillRect(-aw / 2, -ah / 2, aw, ah);

      // Hatching for bombsites
      if (style.isHatched) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-aw / 2, -ah / 2, aw, ah);
        ctx.clip();
        drawDiagonalStripes(ctx, -aw / 2, -ah / 2, aw / 2, ah / 2, 'rgba(239, 68, 68, 0.65)', 4, 16);
        ctx.restore();
      }

      // Stroke boundary
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth;
      ctx.strokeRect(-aw / 2, -ah / 2, aw, ah);
      ctx.restore();
    }
  }
  }

  // ==========================================
  // STEP 4: DRAW TACTICAL DRAWING LINES & ARROWS
  // ==========================================
  if (tacticState.drawings && Array.isArray(tacticState.drawings)) {
    for (const line of tacticState.drawings) {
      if (!line.points || line.points.length < 2) continue;
      ctx.save();
      const strokeColor = line.color || '#f59e0b';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(6, Math.round((line.width || 3) * (size / 280)));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      const p0 = line.points[0];
      const p0x = ((p0.x + 50) / 100) * size;
      const p0y = ((p0.y + 50) / 100) * size;
      ctx.moveTo(p0x, p0y);

      for (let k = 1; k < line.points.length; k++) {
        const p = line.points[k];
        const px = ((p.x + 50) / 100) * size;
        const py = ((p.y + 50) / 100) * size;
        ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Draw Arrowhead at end if enabled
      if (line.hasArrow && line.points.length >= 2) {
        const last = line.points[line.points.length - 1];
        const prev = line.points[line.points.length - 2];
        const lx = ((last.x + 50) / 100) * size;
        const ly = ((last.y + 50) / 100) * size;
        const px = ((prev.x + 50) / 100) * size;
        const py = ((prev.y + 50) / 100) * size;
        const angle = Math.atan2(ly - py, lx - px);
        const headLen = 34;

        ctx.beginPath();
        ctx.fillStyle = strokeColor;
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - headLen * Math.cos(angle - Math.PI / 6), ly - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(lx - headLen * Math.cos(angle + Math.PI / 6), ly - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ==========================================
  // STEP 5: DRAW UTILITY THROW CURVES & MARKERS
  // ==========================================
  if (tacticState.utilities && Array.isArray(tacticState.utilities)) {
    // Pass 5a: Throw trajectories underneath landing icons
    for (const u of tacticState.utilities) {
      if (!u.throwFrom) continue;
      const defaultColor =
        u.type === 'flash'
          ? '#fcd34d'
          : u.type === 'molotov'
          ? '#f97316'
          : u.type === 'he'
          ? '#dc2626'
          : u.type === 'decoy'
          ? '#9333ea'
          : '#0ea5e9';
      const color = getUtilityColor(u, defaultColor);
      const effLineScale = getEffectiveUtilityLineScale(u, utilityLineScale);

      const geom = getThrowGeometry(u.throwFrom, u, u.curveBend);
      const fx = ((geom.from.x + 50) / 100) * size;
      const fy = ((geom.from.y + 50) / 100) * size;
      const cpx = ((geom.cp.x + 50) / 100) * size;
      const cpy = ((geom.cp.y + 50) / 100) * size;
      const ux = ((u.x + 50) / 100) * size;
      const uy = ((u.y + 50) / 100) * size;

      ctx.save();
      ctx.lineCap = 'round';

      const dashScale = 0.45 + 0.55 * effLineScale;
      const originScale = Math.max(0.45, Math.min(1.5, 0.5 + 0.5 * effLineScale));

      // Dark outer casing for crisp legibility on bright maps
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(cpx, cpy, ux, uy);
      ctx.strokeStyle = 'rgba(9,9,11,0.82)';
      ctx.lineWidth = Math.max(2, 13 * effLineScale);
      ctx.stroke();

      // Colored dashed flight arc
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(cpx, cpy, ux, uy);
      ctx.setLineDash([16 * dashScale, 11 * dashScale]);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.2, 7 * effLineScale);
      ctx.stroke();
      ctx.setLineDash([]);

      // Origin anchor dot (1. Abwurfpunkt)
      ctx.beginPath();
      ctx.arc(fx, fy, 15 * originScale, 0, Math.PI * 2);
      ctx.fillStyle = '#09090b';
      ctx.fill();
      ctx.lineWidth = 5 * originScale;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(fx, fy, 5.5 * originScale, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Optional throw type pill near throw origin (e.g. JT / R / L+R)
      if (u.throwType && u.throwType !== 'left') {
        const badgeText = THROW_TYPE_META[u.throwType]?.short || '';
        if (badgeText) {
          ctx.font = '900 18px sans-serif';
          const tw = ctx.measureText(badgeText).width + 14;
          const bx = fx - tw / 2;
          const by = fy - 38;
          ctx.fillStyle = 'rgba(9,9,11,0.92)';
          ctx.fillRect(bx, by, tw, 24);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, tw, 24);
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, fx, by + 12);
        }
      }
      ctx.restore();
    }

    // Pass 5b: Utility landing icons & optional notes
    for (const u of tacticState.utilities) {
      const ux = ((u.x + 50) / 100) * size;
      const uy = ((u.y + 50) / 100) * size;
      const effSpotScale = getEffectiveUtilitySpotScale(u, utilitySpotScale);
      const symbolSize = 54 * effSpotScale; // Scaled cleanly (0.5x to 5.0x)
      const scale = symbolSize / 24;

      let defaultColor = '#0ea5e9'; // smoke
      if (u.type === 'flash') defaultColor = '#fcd34d';
      if (u.type === 'molotov') defaultColor = '#f97316';
      if (u.type === 'he') defaultColor = '#dc2626';
      if (u.type === 'decoy') defaultColor = '#9333ea';
      const color = getUtilityColor(u, defaultColor);

      ctx.save();
      ctx.translate(ux - 12 * scale, uy - 12 * scale);
      ctx.scale(scale, scale);
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      if (u.type === 'smoke') {
        ctx.fillStyle = color;
        ctx.fill(
          new Path2D(
            'M7 16a4 4 0 0 1-.88-7.9A5 5 0 0 1 15.9 6a3.5 3.5 0 0 1 1.6 6.62A3 3 0 0 1 16 18H8a3 3 0 0 1-1-2z'
          )
        );
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(12,74,110,0.45)';
        ctx.beginPath();
        ctx.arc(9.5, 14, 1.4, 0, Math.PI * 2);
        ctx.arc(14, 12, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (u.type === 'flash') {
        ctx.fillStyle = color;
        ctx.fill(
          new Path2D(
            'M12 2l2.2 5.4L20 6l-3.4 4.8L22 13l-5.6 1.8L18 20l-5.2-3.2L10 22l-.8-5.8L4 17l3.2-4.6L2 10l5.6-1.6L6 3.2l4.8 3.2L12 2z'
          )
        );
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(120,53,15,0.45)';
        ctx.beginPath();
        ctx.arc(12, 12, 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (u.type === 'molotov') {
        ctx.fillStyle = color;
        ctx.fill(
          new Path2D(
            'M12.5 2.5c.8 2.2 3.5 3.7 3.5 7.1 0 1.4-.5 2.5-1.3 3.3 1.4-.4 2.5-1.6 2.8-3.1 1.6 1.4 2.5 3.5 2.5 5.6A7 7 0 0 1 5 15.4c0-3.2 2-5.7 4-7.4 0 1.3.5 2.3 1.3 2.8-.2-2.8.8-5.6 2.2-8.3z'
          )
        );
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(254,240,138,0.9)';
        ctx.fill(
          new Path2D(
            'M12 19.5a3 3 0 0 0 3-3c0-1.5-1.1-2.7-2.4-3.7-.3 1-.9 1.6-1.6 1.9-.6.3-1.4 1-1.4 2.1a2.7 2.7 0 0 0 2.4 2.7z'
          )
        );
      } else if (u.type === 'he') {
        ctx.fillStyle = color;
        ctx.fill(new Path2D('M10 3h4a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z'));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke(new Path2D('M12 6v2'));
        ctx.beginPath();
        ctx.arc(12, 14, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 1.3;
        ctx.stroke(new Path2D('M6.5 14h11M12 8v12M8.2 10.2l7.6 7.6M15.8 10.2l-7.6 7.6'));
      } else {
        // decoy
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(12, 12, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.stroke(new Path2D('M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4'));
        ctx.globalAlpha *= 0.7;
        ctx.lineWidth = 1.7;
        ctx.stroke(new Path2D('M4.8 4.8a10.2 10.2 0 0 0 0 14.4M19.2 4.8a10.2 10.2 0 0 1 0 14.4'));
      }
      ctx.restore();

      // Utility custom label (if set)
      if (u.label && u.label.trim()) {
        ctx.save();
        const labelPx = Math.max(12, Math.round((u.fontSize || 12) * (size / 760)));
        ctx.font = `800 ${labelPx}px sans-serif`;
        const text = u.label.trim();
        const tw = ctx.measureText(text).width;
        const padX = Math.round(9 * ratio);
        const padY = Math.round(5 * ratio);
        const bw = tw + padX * 2;
        const bh = labelPx + padY * 2;
        const bx = ux - bw / 2;
        const by = uy + Math.max(22 * ratio, 14 * scale);

        ctx.fillStyle = 'rgba(9, 9, 11, 0.9)';
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, 2.2 * ratio);
        ctx.beginPath();
        if ('roundRect' in ctx && typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(bx, by, bw, bh, Math.max(4, 6 * ratio));
        } else {
          ctx.rect(bx, by, bw, bh);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, ux, by + bh / 2);
        ctx.restore();
      }
    }
  }

  // ==========================================
  // STEP 6: DRAW PLAYER TOKENS (CT / T)
  // ==========================================
  if (tacticState.players && Array.isArray(tacticState.players)) {
    for (const p of tacticState.players) {
      const px = ((p.x + 50) / 100) * size;
      const py = ((p.y + 50) / 100) * size;
      const r = 28;

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);

      const isCT = p.side === 'ct';
      ctx.fillStyle = isCT ? '#0284c7' : '#ea580c';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.number || 1), px, py);

      // Bomb badge if present
      if (p.hasBomb) {
        ctx.beginPath();
        ctx.arc(px + r * 0.7, py - r * 0.7, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Preload all callout custom images in parallel (only when image mode is enabled and callouts are shown)
  if (showCallouts) {
    const calloutImgPromises = callouts.map((c) => {
      const wantsImage = c.displayMode === 'image' || c.displayMode === 'both' || (!c.displayMode && Boolean(c.customImage));
      if (!wantsImage) return Promise.resolve(null);
      const imgSrc = c.customImage || '';
      return imgSrc ? loadImage(imgSrc) : Promise.resolve(null);
    });
    const calloutImages = await Promise.all(calloutImgPromises);

    // ==========================================
    // STEP 7: DRAW CALLOUT PINS, EMBLEMS AND TEXT LABELS (ON TOP)
    // ==========================================
    for (let i = 0; i < callouts.length; i++) {
      const c = callouts[i];
      const calloutImg = calloutImages[i];
      const cx = ((c.x + 50) / 100) * size;
      const cy = ((c.y + 50) / 100) * size;

      const displayMode = c.displayMode || (calloutImg ? 'image' : 'text');
      const nameLower = (c.name || '').toLowerCase();
      const zoneLower = c.zone || '';
      const isCT = zoneLower === 'ct_spawn' || nameLower.includes('ct spawn');
      const isT = zoneLower === 't_spawn' || nameLower.includes('t spawn');

      // Draw Custom Image Emblem in a clean cropped circle if present & enabled
      if ((displayMode === 'image' || displayMode === 'both') && calloutImg) {
        ctx.save();
        const imgRadius = Math.max(10, Math.round(((c.imageSize || 36) * (size / 800)) / 2));

        // Dark background circle & colored border
        ctx.beginPath();
        ctx.arc(cx, cy, imgRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(9, 9, 11, 0.95)';
        ctx.fill();

        ctx.strokeStyle = isCT ? '#38bdf8' : isT ? '#f59e0b' : '#52525b';
        ctx.lineWidth = Math.max(1.5, 3.5 * ratio);
        ctx.stroke();

        // Clip image to circular area
        ctx.clip();
        ctx.drawImage(calloutImg, cx - imgRadius, cy - imgRadius, imgRadius * 2, imgRadius * 2);
        ctx.restore();
      }

      // Draw Text Box if enabled or displayMode is text/both
      if (displayMode === 'text' || displayMode === 'both' || !calloutImg) {
        ctx.save();
        const fontSize = Math.max(10, Math.round((c.fontSize || 16) * (size / 750)));
        ctx.font = `900 ${fontSize}px sans-serif`;
        const lines = (c.name || '').split(/\r?\n/).slice(0, 2);
        const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
        const lineHeight = Math.round(fontSize * 1.18);
        const padX = Math.max(5, Math.round(12 * ratio));
        const padY = Math.max(3, Math.round(8 * ratio));
        const boxW = maxLineWidth + padX * 2;
        const boxH = lines.length > 1 ? lineHeight * lines.length + padY * 2 : fontSize + padY * 2;

        const offsetY = displayMode === 'both' && calloutImg ? (c.imageSize || 36) * (size / 800) * 0.6 : 0;
        const rx = -boxW / 2;
        const ry = -boxH / 2;
        const textRot = c.textRotation || 0;

        ctx.translate(cx, cy + offsetY);
        if (textRot !== 0) {
          ctx.rotate((textRot * Math.PI) / 180);
        }

        ctx.fillStyle = 'rgba(9, 9, 11, 0.92)';
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = Math.max(1.2, 2.5 * ratio);

        ctx.beginPath();
        if ('roundRect' in ctx && typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(rx, ry, boxW, boxH, Math.max(3, Math.round(8 * ratio)));
        } else {
          ctx.rect(rx, ry, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (lines.length > 1) {
          const startY = -((lines.length - 1) * lineHeight) / 2;
          lines.forEach((line, idx) => {
            ctx.fillText(line, 0, startY + idx * lineHeight);
          });
        } else {
          ctx.fillText(lines[0] || '', 0, 0);
        }
        ctx.restore();
      }
    }
  }

  // ==========================================
  // STEP 8: HEADER BRANDING OVERLAY BANNER
  // ==========================================
  if (includeHeader) {
    ctx.save();
    ctx.fillStyle = 'rgba(9, 9, 11, 0.94)';
    ctx.fillRect(0, 0, size, Math.round(96 * ratio));
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.lineWidth = Math.max(1.5, 3.5 * ratio);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(96 * ratio));
    ctx.lineTo(size, Math.round(96 * ratio));
    ctx.stroke();

    ctx.font = `900 ${Math.round(30 * ratio)}px sans-serif`;
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('CS2FREITAG', Math.round(30 * ratio), Math.round(44 * ratio));

    ctx.font = `bold ${Math.round(22 * ratio)}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    const displayTitle = tacticTitle || `${mapData.name} Taktik Sheet`;
    ctx.fillText(`${mapData.name} — ${displayTitle}`, Math.round(30 * ratio), Math.round(76 * ratio));

    ctx.font = `bold ${Math.round(16 * ratio)}px monospace`;
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'right';
    ctx.fillText('Tactical Sheet Export (PNG)', size - Math.round(30 * ratio), Math.round(56 * ratio));
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generates a high-res single-utility Lineup Card PNG containing all 3 images
 * (Standpunkt, Zielpunkt, Ergebnis), custom name, color, throw instruction, notes & mini-radar.
 */
export async function generateUtilityLineupCardPng(
  util: UtilityMarker,
  mapData: MapData,
  activeSlot: UtilityAimSlotId,
  lang: Language
): Promise<string> {
  const isDe = lang === 'de';
  const meta = UTILITY_META[util.type] || UTILITY_META.smoke;
  const color = getUtilityColor(util, meta.colorHex);
  const typeLabel = isDe ? meta.labelDe : meta.labelEn;
  const slotData = util.aimSpots?.[activeSlot] || {};
  const slot1 = util.aimSpots?.['1'] || {};

  const standpunktSrc = slotData.standpunktImage || (activeSlot !== '1' ? slot1.standpunktImage : undefined);
  const aimSrc = slotData.aimImage;
  const resultSrc = slotData.resultImage;

  const width = 1600;
  const hasNotes = Boolean(util.notes && util.notes.trim());
  const height = hasNotes ? 980 : 900;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // Background
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, width, height);

  // Header bar
  ctx.fillStyle = '#111114';
  ctx.fillRect(0, 0, width, 112);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 112);
  ctx.lineTo(width, 112);
  ctx.stroke();

  // Accent color badge pill on left
  ctx.fillStyle = color;
  ctx.beginPath();
  if ('roundRect' in ctx && typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(36, 28, 16, 56, 8);
  } else {
    ctx.rect(36, 28, 16, 56);
  }
  ctx.fill();

  const mainTitle = util.label?.trim()
    ? util.label.trim()
    : `${typeLabel}-${util.throwFrom ? 'Lineup' : 'Spot'}`;
  ctx.font = '900 34px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(mainTitle, 70, 56);

  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#a1a1aa';
  const throwInfo = util.throwFrom
    ? formatThrowTypeFull(util.throwType || 'left', lang)
    : isDe
    ? 'Nur Spot (ohne Wurflinie)'
    : 'Spot only';
  ctx.fillText(
    `${mapData.name} · ${typeLabel} · ${throwInfo} · ${isDe ? `Zielpunkt #${activeSlot}` : `Aim #${activeSlot}`}`,
    70,
    90
  );

  // Branding on right
  ctx.textAlign = 'right';
  ctx.font = '900 24px sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('CS2FREITAG', width - 36, 52);
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`${typeLabel.toUpperCase()} LINEUP`, width - 36, 82);
  ctx.textAlign = 'left';

  // Load 3 screenshot images + radar map preview in parallel
  const [standpunktImg, aimImg, resultImg, radarDataUrl] = await Promise.all([
    standpunktSrc ? loadImage(standpunktSrc) : Promise.resolve(null),
    aimSrc ? loadImage(aimSrc) : Promise.resolve(null),
    resultSrc ? loadImage(resultSrc) : Promise.resolve(null),
    generateTacticSheetPng(
      mapData,
      { drawings: [], utilities: [util], players: [] },
      mainTitle,
      { showAreas: false, showCallouts: true, size: 420, includeHeader: false }
    ).then((url) => loadImage(url)),
  ]);

  // 3 Screenshot cards across top/center row
  const cardTop = 148;
  const gap = 24;
  const sidePad = 36;
  const cardW = Math.floor((width - sidePad * 2 - gap * 2) / 3);
  const cardH = Math.round(cardW * (10 / 16));

  const cards = [
    {
      title: isDe ? '1. Standpunkt (Spot)' : '1. Standpoint (Spot)',
      img: standpunktImg,
    },
    {
      title: isDe ? `2. Zielpunkt #${activeSlot} (Aim)` : `2. Aim Point #${activeSlot}`,
      img: aimImg,
    },
    {
      title: isDe ? '3. Ergebnis (Spot)' : '3. Result (Spot)',
      img: resultImg,
    },
  ];

  cards.forEach((card, idx) => {
    const cx = sidePad + idx * (cardW + gap);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#e4e4e7';
    ctx.fillText(card.title, cx, cardTop - 12);

    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if ('roundRect' in ctx && typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(cx, cardTop, cardW, cardH, 16);
    } else {
      ctx.rect(cx, cardTop, cardW, cardH);
    }
    ctx.fill();
    ctx.stroke();

    if (card.img) {
      ctx.save();
      ctx.beginPath();
      if ('roundRect' in ctx && typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(cx + 1, cardTop + 1, cardW - 2, cardH - 2, 15);
      } else {
        ctx.rect(cx + 1, cardTop + 1, cardW - 2, cardH - 2);
      }
      ctx.clip();
      const scale = Math.max(cardW / card.img.width, cardH / card.img.height);
      const dw = card.img.width * scale;
      const dh = card.img.height * scale;
      ctx.drawImage(card.img, cx + (cardW - dw) / 2, cardTop + (cardH - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.font = '600 18px sans-serif';
      ctx.fillStyle = '#71717a';
      ctx.textAlign = 'center';
      ctx.fillText(isDe ? 'Kein Bild hinterlegt' : 'No image uploaded', cx + cardW / 2, cardTop + cardH / 2);
      ctx.textAlign = 'left';
    }
  });

  // Bottom Row: Mini Radar Map + Info / Notes
  const bottomTop = cardTop + cardH + 30;
  const bottomH = height - bottomTop - 32;
  const radarSize = Math.min(bottomH, 340);

  if (radarDataUrl) {
    ctx.save();
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if ('roundRect' in ctx && typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(sidePad, bottomTop, radarSize, radarSize, 16);
    } else {
      ctx.rect(sidePad, bottomTop, radarSize, radarSize);
    }
    ctx.fill();
    ctx.stroke();
    ctx.clip();
    ctx.drawImage(radarDataUrl, sidePad, bottomTop, radarSize, radarSize);
    ctx.restore();
  }

  const infoX = sidePad + radarSize + 28;
  const infoW = width - infoX - sidePad;
  ctx.fillStyle = '#141418';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if ('roundRect' in ctx && typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(infoX, bottomTop, infoW, radarSize, 16);
  } else {
    ctx.rect(infoX, bottomTop, infoW, radarSize);
  }
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(isDe ? 'Lineup-Details' : 'Lineup Details', infoX + 26, bottomTop + 40);

  ctx.font = '600 20px sans-serif';
  ctx.fillStyle = '#e4e4e7';
  ctx.fillText(
    `${isDe ? 'Wurf-Anweisung' : 'Throw instruction'}: ${throwInfo}`,
    infoX + 26,
    bottomTop + 80
  );
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText(
    `${isDe ? 'Farbe' : 'Color'}: ${color.toUpperCase()}  ·  ${isDe ? 'Schriftgröße' : 'Font size'}: ${util.fontSize || 12}px`,
    infoX + 26,
    bottomTop + 114
  );

  if (hasNotes) {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(isDe ? 'Notizen / Ausrichtung:' : 'Notes / Aiming:', infoX + 26, bottomTop + 162);

    ctx.font = '500 20px sans-serif';
    ctx.fillStyle = '#f4f4f5';
    const words = util.notes!.trim().split(/\s+/);
    let line = '';
    let ly = bottomTop + 196;
    const maxW = infoW - 52;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, infoX + 26, ly);
        line = word;
        ly += 28;
        if (ly > bottomTop + radarSize - 24) break;
      } else {
        line = test;
      }
    }
    if (line && ly <= bottomTop + radarSize - 16) {
      ctx.fillText(line, infoX + 26, ly);
    }
  } else {
    ctx.font = '500 18px sans-serif';
    ctx.fillStyle = '#71717a';
    ctx.fillText(
      isDe
        ? 'Importierbar über CS2Freitag → Teilen → Laden & Scannen'
        : 'Importable via CS2Freitag → Share → Load & Scan',
      infoX + 26,
      bottomTop + 170
    );
  }

  return canvas.toDataURL('image/png');
}
