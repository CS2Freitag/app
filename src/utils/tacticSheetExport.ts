import { MapData, TacticalDrawingLine, UtilityMarker, PlayerToken, Callout } from '../types';
import { resolveAssetPath } from './assets';

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
  tacticTitle: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  const size = 1600; // High-resolution 1600x1600 canvas
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
  // STEP 5: DRAW UTILITY MARKERS
  // ==========================================
  if (tacticState.utilities && Array.isArray(tacticState.utilities)) {
    for (const u of tacticState.utilities) {
      const ux = ((u.x + 50) / 100) * size;
      const uy = ((u.y + 50) / 100) * size;
      const symbolSize = 54; // Clearly visible on high-res canvas
      const scale = symbolSize / 24;

      let color = '#0ea5e9'; // smoke
      if (u.type === 'flash') color = '#fcd34d';
      if (u.type === 'molotov') color = '#f97316';
      if (u.type === 'he') color = '#dc2626';
      if (u.type === 'decoy') color = '#9333ea';

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

  // Preload all callout custom images in parallel
  const calloutImgPromises = callouts.map((c) => {
    const name = (c.name || '').toLowerCase();
    const zone = c.zone || '';
    const isCT = zone === 'ct_spawn' || name.includes('ct spawn');
    const isT = zone === 't_spawn' || name.includes('t spawn');

    const imgSrc = c.customImage || (isCT ? 'ct.png' : isT ? 'T.png' : '');
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
    if ((displayMode === 'image' || displayMode === 'both' || calloutImg) && calloutImg) {
      ctx.save();
      const imgRadius = Math.max(22, Math.round(((c.imageSize || 36) * (size / 800)) / 2));

      // Dark background circle & colored border
      ctx.beginPath();
      ctx.arc(cx, cy, imgRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(9, 9, 11, 0.95)';
      ctx.fill();

      ctx.strokeStyle = isCT ? '#38bdf8' : isT ? '#f59e0b' : '#52525b';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Clip image to circular area
      ctx.clip();
      ctx.drawImage(calloutImg, cx - imgRadius, cy - imgRadius, imgRadius * 2, imgRadius * 2);
      ctx.restore();
    }

    // Draw Text Box if enabled or displayMode is text/both
    if (displayMode === 'text' || displayMode === 'both' || !calloutImg) {
      ctx.save();
      const fontSize = Math.max(18, Math.round((c.fontSize || 16) * (size / 750)));
      ctx.font = `900 ${fontSize}px sans-serif`;
      const nameText = (c.name || '').replace(/\n/g, ' ');
      const textMetrics = ctx.measureText(nameText);
      const padX = 12;
      const padY = 8;
      const boxW = textMetrics.width + padX * 2;
      const boxH = fontSize + padY * 2;

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
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      if ('roundRect' in ctx && typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(rx, ry, boxW, boxH, 8);
      } else {
        ctx.rect(rx, ry, boxW, boxH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nameText, 0, 0);
      ctx.restore();
    }
  }

  // ==========================================
  // STEP 8: HEADER BRANDING OVERLAY BANNER
  // ==========================================
  ctx.save();
  ctx.fillStyle = 'rgba(9, 9, 11, 0.94)';
  ctx.fillRect(0, 0, size, 96);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 96);
  ctx.lineTo(size, 96);
  ctx.stroke();

  ctx.font = '900 30px sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('CS2FREITAG', 30, 44);

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffffff';
  const displayTitle = tacticTitle || `${mapData.name} Taktik Sheet`;
  ctx.fillText(`${mapData.name} — ${displayTitle}`, 30, 76);

  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'right';
  ctx.fillText('Tactical Sheet Export (PNG)', size - 30, 56);
  ctx.restore();

  return canvas.toDataURL('image/png');
}
