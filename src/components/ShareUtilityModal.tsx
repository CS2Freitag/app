import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  FileCode,
  Image as ImageIcon,
  QrCode,
  Share2,
  X,
} from 'lucide-react';
import { Language, MapData, UtilityAimSlotId, UtilityMarker } from '../types';
import {
  buildSingleUtilitySharePayload,
  encodeCompactTactic,
  encodeSingleUtilityPackage,
} from '../utils/tacticCodec';
import { generateUtilityLineupCardPng } from '../utils/tacticSheetExport';
import { getUtilityColor } from '../utils/utilityDisplay';
import { UTILITY_META, UtilitySymbol } from './UtilitySymbol';

interface ShareUtilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  util: UtilityMarker;
  mapData: MapData;
  activeSlot: UtilityAimSlotId;
  lang: Language;
}

export const ShareUtilityModal: React.FC<ShareUtilityModalProps> = ({
  isOpen,
  onClose,
  util,
  mapData,
  activeSlot,
  lang,
}) => {
  const isDe = lang === 'de';
  const [lineupCardUrl, setLineupCardUrl] = useState<string>('');
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  const meta = UTILITY_META[util.type] || UTILITY_META.smoke;
  const activeColor = getUtilityColor(util, meta.colorHex);
  const typeLabel = isDe ? meta.labelDe : meta.labelEn;
  const utilName = util.label?.trim() || `${typeLabel}-${util.throwFrom ? 'Lineup' : 'Spot'}`;
  const safeFileSlug = utilName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'utility';

  // Count uploaded images across all 4 slots
  const uploadedImageCount = useMemo(() => {
    let count = 0;
    const spots = util.aimSpots || {};
    (['1', '2', '3', '4'] as UtilityAimSlotId[]).forEach((slot) => {
      const s = spots[slot];
      if (!s) return;
      if (s.standpunktImage) count++;
      if (s.aimImage) count++;
      if (s.resultImage) count++;
    });
    return count;
  }, [util.aimSpots]);

  const compactLink = useMemo(() => {
    const encoded = encodeCompactTactic(
      mapData.id,
      `${mapData.name} - ${utilName}`,
      [],
      [util],
      [],
      { showAreas: false, showCallouts: true }
    );
    return `${window.location.origin}${window.location.pathname}#t=${encoded}`;
  }, [mapData.id, mapData.name, util, utilName]);

  const fullPackageCode = useMemo(() => {
    return encodeSingleUtilityPackage(mapData.id, mapData.name, util);
  }, [mapData.id, mapData.name, util]);

  useEffect(() => {
    if (!isOpen) return;
    setCopiedCode(false);
    setCopiedLink(false);
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');

    let cancelled = false;
    setIsGeneratingCard(true);
    generateUtilityLineupCardPng(util, mapData, activeSlot, lang)
      .then((url) => {
        if (!cancelled) setLineupCardUrl(url);
      })
      .catch((err) => console.error('Utility lineup card error:', err))
      .finally(() => {
        if (!cancelled) setIsGeneratingCard(false);
      });

    QRCode.toDataURL(compactLink, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'L',
      color: { dark: '#09090b', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen, util, mapData, activeSlot, lang, compactLink]);

  if (!isOpen) return null;

  const copyText = async (text: string, onSuccess: () => void) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      onSuccess();
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const handleDownloadPng = () => {
    if (!lineupCardUrl) return;
    const a = document.createElement('a');
    a.href = lineupCardUrl;
    a.download = `CS2Freitag_${safeFileSlug}_Lineup.png`;
    a.click();
  };

  const handleNativeSharePng = async () => {
    if (!lineupCardUrl || !navigator.share) return;
    try {
      const res = await fetch(lineupCardUrl);
      const blob = await res.blob();
      const file = new File([blob], `CS2Freitag_${safeFileSlug}_Lineup.png`, { type: 'image/png' });
      const canFiles =
        typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      if (canFiles) {
        await navigator.share({
          title: `${mapData.name} – ${utilName}`,
          text: util.notes || utilName,
          files: [file],
        });
      } else {
        await navigator.share({
          title: `${mapData.name} – ${utilName}`,
          url: compactLink,
        });
      }
    } catch {
      // User dismissed share sheet
    }
  };

  const handleDownloadJson = () => {
    const payload = buildSingleUtilitySharePayload(mapData.id, mapData.name, util);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CS2Freitag_Utility_${safeFileSlug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-no-map-click="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-zinc-900 border border-zinc-700/90 rounded-2xl p-4 sm:p-5 shadow-2xl text-zinc-100 space-y-4 my-auto max-h-[92dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ color: activeColor }} className="shrink-0">
              <UtilitySymbol type={util.type} size="sm" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">
                {isDe ? `Utility teilen: ${utilName}` : `Share Utility: ${utilName}`}
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                {mapData.name} · {uploadedImageCount}{' '}
                {isDe ? 'Screenshot(s)' : 'screenshot(s)'} · {activeColor.toUpperCase()} ·{' '}
                {util.fontSize || 12}px
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isDe ? 'Schließen' : 'Close'}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Lineup Card PNG Preview & Download/Share (All 3 images + Name + Color + Radar) */}
        <div className="p-3 rounded-xl bg-zinc-950/85 border border-sky-500/35 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" />
              <span>
                {isDe
                  ? '1. Lineup-Bild (alle 3 Bilder, Name, Farbe & Radar)'
                  : '1. Lineup Card PNG (all 3 images, name, color & radar)'}
              </span>
            </span>
          </div>

          <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden aspect-[16/9] flex items-center justify-center">
            {isGeneratingCard ? (
              <span className="text-xs text-zinc-400">
                {isDe ? 'Erstelle Lineup-Vorschau...' : 'Generating preview...'}
              </span>
            ) : lineupCardUrl ? (
              <img
                src={lineupCardUrl}
                alt={utilName}
                className="w-full h-full object-contain"
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!lineupCardUrl || isGeneratingCard}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDe ? 'PNG-Lineup herunterladen' : 'Download PNG Lineup'}</span>
            </button>

            {canNativeShare && (
              <button
                type="button"
                onClick={handleNativeSharePng}
                disabled={!lineupCardUrl || isGeneratingCard}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                <span>{isDe ? 'Direkt teilen' : 'Share'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Complete Utility Package (JSON / Code with ALL 3 images + Slots 1-4 + Name + Colors + Notes) */}
        <div className="p-3 rounded-xl bg-zinc-950/85 border border-zinc-800 space-y-2">
          <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <FileCode className="w-4 h-4" />
            <span>
              {isDe
                ? '2. Komplettes Utility-Paket (inkl. aller 3 Bilder, Name, Farben & Notizen)'
                : '2. Complete Utility Package (incl. all 3 images, name, color & notes)'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-emerald-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{isDe ? 'Utility-Datei (.json) laden' : 'Download .json file'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                copyText(fullPackageCode, () => {
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2400);
                })
              }
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                copiedCode
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-100'
              }`}
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-emerald-400" />}
              <span>
                {copiedCode
                  ? isDe
                    ? 'Komplett-Code kopiert!'
                    : 'Full code copied!'
                  : isDe
                  ? 'Komplett-Code (mit Bildern) kopieren'
                  : 'Copy full code (with images)'}
              </span>
            </button>
          </div>
          <p className="text-[10px] text-zinc-400">
            {isDe
              ? 'Empfänger können die JSON-Datei oder den Komplett-Code unter „Teilen → Laden & Scannen“ direkt in ihre Karte laden.'
              : 'Recipients can import the JSON file or full code via "Share → Load & Scan".'}
          </p>
        </div>

        {/* 3. Compact Link & QR Code */}
        <div className="p-3 rounded-xl bg-zinc-950/85 border border-zinc-800 space-y-2">
          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <QrCode className="w-4 h-4" />
            <span>
              {isDe
                ? '3. Schneller Link & QR-Code (Name, Farbe, Wurflinie & Notizen)'
                : '3. Quick Link & QR Code (Name, color, throw line & notes)'}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {qrUrl && (
              <img
                src={qrUrl}
                alt="Utility QR Code"
                className="w-24 h-24 rounded-lg bg-white p-1.5 shrink-0 shadow"
              />
            )}
            <div className="flex-1 w-full space-y-1.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={compactLink}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-zinc-300 truncate"
                />
                <button
                  type="button"
                  onClick={() =>
                    copyText(compactLink, () => {
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2400);
                    })
                  }
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer ${
                    copiedLink
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? (isDe ? 'Kopiert' : 'Copied') : isDe ? 'Link' : 'Link'}</span>
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">
                {isDe
                  ? 'Hinweis: QR-Codes enthalten aus Platzgründen nur Positions-, Farb-, Namens- & Wurfliniendaten (ohne Fotos).'
                  : 'Note: QR links carry coordinates, color, name & throw line (use PNG/JSON/Code above for photos).'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
