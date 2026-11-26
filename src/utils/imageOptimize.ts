export const SUPPORTED_SCREENSHOT_MIME_TYPES = new Set([
  'image/webp',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export const SUPPORTED_SCREENSHOT_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png'];

export function isSupportedUtilityScreenshotFile(file: {
  name?: string;
  type?: string;
}): boolean {
  const mime = (file.type || '').toLowerCase().trim();
  if (mime && SUPPORTED_SCREENSHOT_MIME_TYPES.has(mime)) {
    return true;
  }
  const lowerName = (file.name || '').toLowerCase().trim();
  return SUPPORTED_SCREENSHOT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export async function optimizeUtilityScreenshotDataUrl(
  dataUrl: string,
  targetMaxBytes = 135 * 1024
): Promise<{ dataUrl: string; beforeBytes: number; afterBytes: number; wasOptimized: boolean }> {
  const beforeBytes = dataUrl.length;
  if (!dataUrl || dataUrl.startsWith('data:image/svg+xml')) {
    return { dataUrl, beforeBytes, afterBytes: beforeBytes, wasOptimized: false };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        if (!origW || !origH) {
          resolve({ dataUrl, beforeBytes, afterBytes: beforeBytes, wasOptimized: false });
          return;
        }

        const attempts: Array<{ maxDim: number; quality: number }> = [
          { maxDim: 1280, quality: 0.88 },
          { maxDim: 1280, quality: 0.8 },
          { maxDim: 960, quality: 0.82 },
          { maxDim: 800, quality: 0.78 },
          { maxDim: 640, quality: 0.75 },
        ];

        // If image already fits within targetMaxBytes AND <= 1280px, keep it untouched
        if (beforeBytes <= targetMaxBytes && Math.max(origW, origH) <= 1280) {
          resolve({ dataUrl, beforeBytes, afterBytes: beforeBytes, wasOptimized: false });
          return;
        }

        let bestUrl = dataUrl;
        let bestBytes = beforeBytes;

        for (const attempt of attempts) {
          const scale = Math.min(1, attempt.maxDim / Math.max(origW, origH));
          const targetW = Math.max(1, Math.round(origW * scale));
          const targetH = Math.max(1, Math.round(origH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          let candidate = canvas.toDataURL('image/webp', attempt.quality);
          if (!candidate.startsWith('data:image/webp')) {
            const jpgCanvas = document.createElement('canvas');
            jpgCanvas.width = targetW;
            jpgCanvas.height = targetH;
            const jpgCtx = jpgCanvas.getContext('2d');
            if (jpgCtx) {
              jpgCtx.fillStyle = '#09090b';
              jpgCtx.fillRect(0, 0, targetW, targetH);
              jpgCtx.imageSmoothingEnabled = true;
              jpgCtx.imageSmoothingQuality = 'high';
              jpgCtx.drawImage(img, 0, 0, targetW, targetH);
              candidate = jpgCanvas.toDataURL('image/jpeg', attempt.quality);
            }
          }

          if (candidate.length < bestBytes || Math.max(origW, origH) > 1280) {
            bestUrl = candidate;
            bestBytes = candidate.length;
          }

          if (bestBytes <= targetMaxBytes) {
            break;
          }
        }

        resolve({
          dataUrl: bestUrl,
          beforeBytes,
          afterBytes: bestBytes,
          wasOptimized: bestUrl !== dataUrl,
        });
      } catch {
        resolve({ dataUrl, beforeBytes, afterBytes: beforeBytes, wasOptimized: false });
      }
    };
    img.onerror = () => {
      resolve({ dataUrl, beforeBytes, afterBytes: beforeBytes, wasOptimized: false });
    };
    img.src = dataUrl;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}
