import { MapData, TacticalDrawingLine, UtilityMarker, PlayerToken } from '../types';
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

  // Preload all callout custom images in parallel
  const callouts = mapData.callouts || [];
  const calloutImgPromises = callouts.map((c) => {
    const name = (c.name || '').toLowerCase();
    const zone = c.zone || '';
    const isCT = zone === 'ct_spawn' || name.includes('ct spawn');
    const isT = zone === 't_spawn' || name.includes('t spawn');

    const imgSrc = c.customImage || (isCT ? 'ct.png' : isT ? 'T.png' : '');
    return imgSrc ? loadImage(imgSrc) : Promise.resolve(null);
  });

  const calloutImages = await Promise.all(calloutImgPromises);

  // 3. Draw Callout Areas, Circular Emblems (CT/T/Custom Images), and Text Labels
  for (let i = 0; i < callouts.length; i++) {
    const c = callouts[i];
    const calloutImg = calloutImages[i];
    const cx = ((c.x + 50) / 100) * size;
    const cy = ((c.y + 50) / 100) * size;

    // Draw Callout Area if present
    if (c.area) {
      ctx.save();
      const ax = ((c.area.x + 50) / 100) * size;
      const ay = ((c.area.y + 50) / 100) * size;
      const aw = (c.area.width / 100) * size;
      const ah = (c.area.height / 100) * size;

      ctx.fillStyle = c.area.customColor ? `${c.area.customColor}40` : 'rgba(251, 191, 36, 0.2)';
      ctx.strokeStyle = c.area.customColor || 'rgba(251, 191, 36, 0.8)';
      ctx.lineWidth = 2;

      if (c.area.shape === 'polygon' && c.area.points && c.area.points.length > 0) {
        ctx.beginPath();
        const p0 = c.area.points[0];
        ctx.moveTo(((p0.x + 50) / 100) * size, ((p0.y + 50) / 100) * size);
        for (let k = 1; k < c.area.points.length; k++) {
          const p = c.area.points[k];
          ctx.lineTo(((p.x + 50) / 100) * size, ((p.y + 50) / 100) * size);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(ax, ay, aw, ah);
        ctx.strokeRect(ax, ay, aw, ah);
      }
      ctx.restore();
    }

    const displayMode = c.displayMode || (calloutImg ? 'image' : 'text');
    const nameLower = (c.name || '').toLowerCase();
    const zoneLower = c.zone || '';
    const isCT = zoneLower === 'ct_spawn' || nameLower.includes('ct spawn');
    const isT = zoneLower === 't_spawn' || nameLower.includes('t spawn');

    // Draw Custom Image Emblem in a clean cropped circle if present & enabled
    if ((displayMode === 'image' || displayMode === 'both' || calloutImg) && calloutImg) {
      ctx.save();
      const imgRadius = Math.max(18, Math.round(((c.imageSize || 36) * (size / 800)) / 2));

      // Dark background circle & colored border
      ctx.beginPath();
      ctx.arc(cx, cy, imgRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(9, 9, 11, 0.92)';
      ctx.fill();

      ctx.strokeStyle = isCT ? '#38bdf8' : isT ? '#f59e0b' : '#52525b';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Clip image to circular area
      ctx.clip();
      ctx.drawImage(calloutImg, cx - imgRadius, cy - imgRadius, imgRadius * 2, imgRadius * 2);
      ctx.restore();
    }

    // Draw Text Box if enabled or displayMode is text/both
    if (displayMode === 'text' || displayMode === 'both' || !calloutImg) {
      ctx.save();
      const fontSize = Math.max(16, Math.round((c.fontSize || 14) * (size / 800)));
      ctx.font = `900 ${fontSize}px sans-serif`;
      const nameText = (c.name || '').replace(/\n/g, ' ');
      const textMetrics = ctx.measureText(nameText);
      const padX = 10;
      const padY = 6;
      const boxW = textMetrics.width + padX * 2;
      const boxH = fontSize + padY * 2;

      ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 2;

      const offsetY = displayMode === 'both' && calloutImg ? (c.imageSize || 36) * (size / 800) * 0.6 : 0;
      const rx = cx - boxW / 2;
      const ry = cy + offsetY - boxH / 2;

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
      ctx.fillText(nameText, cx, cy + offsetY);
      ctx.restore();
    }
  }

  // 4. Draw Tactical Lines & Arrows (Coordinates are centered -50 to +50)
  if (tacticState.drawings && Array.isArray(tacticState.drawings)) {
    for (const line of tacticState.drawings) {
      if (!line.points || line.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = line.color || '#f59e0b';
      ctx.lineWidth = Math.max(3, (line.width || 3) * (size / 300));
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
        const headLen = 24;

        ctx.beginPath();
        ctx.fillStyle = line.color || '#f59e0b';
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - headLen * Math.cos(angle - Math.PI / 6), ly - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(lx - headLen * Math.cos(angle + Math.PI / 6), ly - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 5. Draw Utility Markers
  if (tacticState.utilities && Array.isArray(tacticState.utilities)) {
    for (const u of tacticState.utilities) {
      const ux = ((u.x + 50) / 100) * size;
      const uy = ((u.y + 50) / 100) * size;
      const r = 20;

      ctx.save();
      ctx.beginPath();
      ctx.arc(ux, uy, r, 0, Math.PI * 2);

      let color = '#38bdf8'; // smoke
      if (u.type === 'flash') color = '#facc15';
      if (u.type === 'molotov') color = '#f97316';
      if (u.type === 'he') color = '#ef4444';
      if (u.type === 'decoy') color = '#a855f7';

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = (u.type || 'S').charAt(0).toUpperCase();
      ctx.fillText(label, ux, uy);
      ctx.restore();
    }
  }

  // 6. Draw Player Tokens (CT / T)
  if (tacticState.players && Array.isArray(tacticState.players)) {
    for (const p of tacticState.players) {
      const px = ((p.x + 50) / 100) * size;
      const py = ((p.y + 50) / 100) * size;
      const r = 24;

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);

      const isCT = p.side === 'ct';
      ctx.fillStyle = isCT ? '#0284c7' : '#ea580c';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.number || 1), px, py);

      // Bomb badge if present
      if (p.hasBomb) {
        ctx.beginPath();
        ctx.arc(px + r * 0.7, py - r * 0.7, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // 7. Header Branding Overlay Banner
  ctx.save();
  ctx.fillStyle = 'rgba(9, 9, 11, 0.9)';
  ctx.fillRect(0, 0, size, 90);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 90);
  ctx.lineTo(size, 90);
  ctx.stroke();

  ctx.font = '900 28px sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('CS2FREITAG', 30, 42);

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffffff';
  const displayTitle = tacticTitle || `${mapData.name} Taktik Sheet`;
  ctx.fillText(`${mapData.name} — ${displayTitle}`, 30, 72);

  ctx.font = '16px monospace';
  ctx.fillStyle = '#a1a1aa';
  ctx.textAlign = 'right';
  ctx.fillText('Tactical PWA Export', size - 30, 52);
  ctx.restore();

  return canvas.toDataURL('image/png');
}
