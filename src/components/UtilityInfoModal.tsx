import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Edit3,
  GripHorizontal,
  Image as ImageIcon,
  Lock,
  Move,
  Share2,
  Spline,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  Language,
  MapData,
  UtilityAimSlotId,
  UtilityAimSpotImages,
  UtilityMarker,
} from '../types';
import { clampMenuPosition, getUtilityColor } from '../utils/utilityDisplay';
import {
  THROW_TYPE_META,
  UTILITY_THROW_TYPES,
  formatThrowTypeFull,
} from '../utils/utilityThrowGeometry';
import {
  isSupportedUtilityScreenshotFile,
  optimizeUtilityScreenshotDataUrl,
  readFileAsDataUrl,
} from '../utils/imageOptimize';
import { SelectedElementsPatch } from './TacticalLayersPanel';
import { UtilitySymbol, UTILITY_META } from './UtilitySymbol';
import { ShareUtilityModal } from './ShareUtilityModal';

interface UtilityInfoModalProps {
  util: UtilityMarker | null;
  allUtilities?: UtilityMarker[];
  mapData?: MapData;
  lang: Language;
  isMovingThis: boolean;
  onUpdate: (utilId: string, patch: SelectedElementsPatch) => void;
  onEdit: (util: UtilityMarker) => void;
  onMove: (util: UtilityMarker) => void;
  onAddLine: (util: UtilityMarker) => void;
  onSelectUtility?: (util: UtilityMarker) => void;
  onClose: () => void;
  isAutosaveActive?: boolean;
  onOpenBackupSetup?: () => void;
}

const AIM_SLOTS: UtilityAimSlotId[] = ['1', '2', '3', '4'];

type ScreenshotField = keyof UtilityAimSpotImages;

export const UtilityInfoModal: React.FC<UtilityInfoModalProps> = ({
  util,
  allUtilities,
  mapData,
  lang,
  isMovingThis,
  onUpdate,
  onEdit,
  onMove,
  onAddLine,
  onSelectUtility,
  onClose,
  isAutosaveActive = true,
  onOpenBackupSetup,
}) => {
  const isDe = lang === 'de';
  const [isShareOpen, setIsShareOpen] = useState(false);
  const coLocatedUtils = React.useMemo(() => {
    if (!util?.throwFrom || !allUtilities) return [];
    return allUtilities.filter(
      (u) =>
        u.throwFrom &&
        Math.abs(u.throwFrom.x - util.throwFrom!.x) < 0.1 &&
        Math.abs(u.throwFrom.y - util.throwFrom!.y) < 0.1
    );
  }, [util?.throwFrom, allUtilities]);
  const windowRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDesktopOrTablet, setIsDesktopOrTablet] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [activeSlot, setActiveSlot] = useState<UtilityAimSlotId>('1');
  const [processingField, setProcessingField] = useState<ScreenshotField | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);
  const [isEditingThrow, setIsEditingThrow] = useState<boolean>(false);

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    initLeft: number;
    initTop: number;
  } | null>(null);

  useEffect(() => {
    if (!util) return;
    setActiveSlot(util.activeAimSpot || '1');
    setUploadError(null);
    setLightboxImage(null);
    setIsEditingThrow(false);
    setIsShareOpen(false);
  }, [util?.id]);

  useEffect(() => {
    if (!util || typeof window === 'undefined') return;
    const wide = window.innerWidth >= 768;
    setIsDesktopOrTablet(wide);
    if (!wide) {
      setPos(null);
      return;
    }
    if (!pos) {
      const defaultW = Math.min(680, window.innerWidth - 32);
      const defaultH = 540;
      const initial = clampMenuPosition(
        {
          x: Math.round((window.innerWidth - defaultW) / 2),
          y: Math.max(60, Math.round((window.innerHeight - defaultH) / 2)),
        },
        { width: defaultW, height: defaultH },
        { width: window.innerWidth, height: window.innerHeight },
        { top: 56, right: 12, bottom: 16, left: 12 }
      );
      setPos(initial);
    }
    const clampToActualSize = () => {
      if (!windowRef.current || window.innerWidth < 768) return;
      const rect = windowRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setPos((prev) =>
        prev
          ? clampMenuPosition(
              prev,
              { width: rect.width, height: rect.height },
              { width: window.innerWidth, height: window.innerHeight },
              { top: 56, right: 12, bottom: 16, left: 12 }
            )
          : prev
      );
    };
    const raf = window.requestAnimationFrame(clampToActualSize);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && windowRef.current) {
      ro = new ResizeObserver(clampToActualSize);
      ro.observe(windowRef.current);
    }
    return () => {
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [util?.id]);

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!dragStateRef.current || !windowRef.current || typeof window === 'undefined') return;
      if (window.innerWidth < 768) return;
      const rect = windowRef.current.getBoundingClientRect();
      const dx = clientX - dragStateRef.current.startX;
      const dy = clientY - dragStateRef.current.startY;
      setPos(
        clampMenuPosition(
          {
            x: dragStateRef.current.initLeft + dx,
            y: dragStateRef.current.initTop + dy,
          },
          { width: rect.width, height: rect.height },
          { width: window.innerWidth, height: window.innerHeight },
          { top: 56, right: 12, bottom: 16, left: 12 }
        )
      );
    };

    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const wide = window.innerWidth >= 768;
      setIsDesktopOrTablet(wide);
      if (!wide) {
        dragStateRef.current = null;
        return;
      }
      if (!windowRef.current) return;
      const rect = windowRef.current.getBoundingClientRect();
      setPos((prev) =>
        prev
          ? clampMenuPosition(
              prev,
              { width: rect.width || 660, height: rect.height || 400 },
              { width: window.innerWidth, height: window.innerHeight },
              { top: 56, right: 12, bottom: 16, left: 12 }
            )
          : prev
      );
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!util) return null;

  const meta = UTILITY_META[util.type] || UTILITY_META.smoke;
  const activeColor = getUtilityColor(util, meta.colorHex);
  const typeName = isDe ? meta.labelDe : meta.labelEn;
  const headerTitle = util.label?.trim()
    ? `${typeName}-${util.throwFrom ? 'Lineup' : 'Spot'}: ${util.label}`
    : `${typeName}-${util.throwFrom ? 'Lineup' : 'Spot'}`;

  const aimSpots = util.aimSpots || {};
  const slot1 = aimSpots['1'] || {};
  const currentSlotData = aimSpots[activeSlot] || {};

  // Standpunkt & Ergebnis cleanly fall back to #1 if unchanged across aimpoints 1..4
  const standpunktOwn = currentSlotData.standpunktImage;
  const standpunktImg =
    standpunktOwn || (activeSlot !== '1' ? slot1.standpunktImage : undefined);
  const standpunktIsInherited = Boolean(!standpunktOwn && standpunktImg);

  const aimImg = currentSlotData.aimImage;
  const resultImg = currentSlotData.resultImage;
  const resultIsInherited = false;

  const startDrag = (clientX: number, clientY: number) => {
    if (!windowRef.current || typeof window === 'undefined' || window.innerWidth < 768) return;
    const rect = windowRef.current.getBoundingClientRect();
    dragStateRef.current = {
      startX: clientX,
      startY: clientY,
      initLeft: rect.left,
      initTop: rect.top,
    };
  };

  const handleSelectSlot = (slot: UtilityAimSlotId) => {
    setActiveSlot(slot);
    setUploadError(null);
    onUpdate(util.id, { activeAimSpot: slot, skipHistory: true });
  };

  const handleFileChange = async (field: ScreenshotField, file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (!isSupportedUtilityScreenshotFile(file)) {
      setUploadError(
        isDe
          ? 'Bitte nur WebP, JPG oder PNG hochladen.'
          : 'Please upload WebP, JPG, or PNG images only.'
      );
      return;
    }

    setProcessingField(field);
    try {
      const rawDataUrl = await readFileAsDataUrl(file);
      const optimized = await optimizeUtilityScreenshotDataUrl(rawDataUrl);
      const nextSlot: UtilityAimSpotImages = {
        ...currentSlotData,
        [field]: optimized.dataUrl,
      };
      onUpdate(util.id, {
        activeAimSpot: activeSlot,
        aimSpots: {
          ...aimSpots,
          [activeSlot]: nextSlot,
        },
      });
    } catch {
      setUploadError(
        isDe ? 'Bild konnte nicht geladen werden.' : 'Failed to process image.'
      );
    } finally {
      setProcessingField(null);
    }
  };

  const handleRemoveImage = (field: ScreenshotField) => {
    const nextSlot: UtilityAimSpotImages = { ...currentSlotData };
    delete nextSlot[field];
    const nextAimSpots = { ...aimSpots };
    if (nextSlot.standpunktImage || nextSlot.aimImage || nextSlot.resultImage) {
      nextAimSpots[activeSlot] = nextSlot;
    } else {
      delete nextAimSpots[activeSlot];
    }
    onUpdate(util.id, { aimSpots: nextAimSpots });
  };

  const renderUploadCard = (
    title: string,
    field: ScreenshotField,
    imageSrc: string | undefined,
    isInherited: boolean,
    hasOwnImage: boolean,
    withAimSelector?: boolean
  ) => {
    const inputId = `util-screenshot-${util.id}-${activeSlot}-${field}`;
    const isBusy = processingField === field;

    return (
      <div className="flex flex-col gap-1.5 min-w-0">
        {/* Card Heading + Optional 1..4 Selector above Zielpunkt */}
        <div className="flex items-center justify-between gap-1.5 min-h-[22px]">
          <span className="text-[11px] font-bold text-zinc-200 truncate">{title}</span>
          {withAimSelector && (
            <div
              className="flex items-center gap-1 shrink-0"
              role="group"
              aria-label={isDe ? 'Zielauswahl 1 bis 4' : 'Aim target 1 to 4'}
            >
              {AIM_SLOTS.map((slot) => {
                const isSelected = activeSlot === slot;
                const slotEntry = aimSpots[slot];
                const hasData = Boolean(
                  slotEntry?.aimImage || slotEntry?.resultImage || slotEntry?.standpunktImage
                );
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleSelectSlot(slot)}
                    aria-pressed={isSelected}
                    title={isDe ? `Zielpunkt ${slot}` : `Aim point ${slot}`}
                    className={`relative w-5 h-5 rounded-md text-[10px] font-mono font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-sky-500 text-zinc-950 border-sky-400 shadow-sm'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    {slot}
                    {hasData && !isSelected && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Image Preview Box */}
        <div className="relative aspect-[16/10] w-full rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden group">
          {imageSrc ? (
            <>
              <button
                type="button"
                onClick={() => setLightboxImage({ src: imageSrc, title })}
                className="w-full h-full block cursor-zoom-in relative"
                title={isDe ? 'Zum Vergrößern klicken' : 'Click to enlarge'}
              >
                <img
                  src={imageSrc}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                </span>
              </button>

              {isInherited && (
                <span className="pointer-events-none absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-zinc-950/85 border border-zinc-700 text-[9px] font-semibold text-zinc-300">
                  #{1}
                </span>
              )}

              {hasOwnImage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(field);
                  }}
                  aria-label={isDe ? `${title} löschen` : `Remove ${title}`}
                  title={isDe ? 'Screenshot entfernen' : 'Remove screenshot'}
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-zinc-950/85 hover:bg-red-600 text-zinc-200 hover:text-white border border-zinc-700/80 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          ) : (
            <label
              htmlFor={inputId}
              className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors p-2 text-center"
            >
              <ImageIcon className="w-6 h-6 opacity-70" />
              <span className="text-[10px] leading-tight">
                {isBusy
                  ? isDe
                    ? 'Wird angepasst...'
                    : 'Resizing...'
                  : isDe
                  ? 'WebP, JPG, PNG'
                  : 'WebP, JPG, PNG'}
              </span>
            </label>
          )}
        </div>

        {/* Upload / Change Button */}
        <label
          htmlFor={inputId}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
            isBusy
              ? 'bg-zinc-800 border-zinc-700 text-zinc-400 cursor-wait'
              : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-700/90 text-zinc-200 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">
            {isBusy
              ? isDe
                ? 'Lädt...'
                : 'Loading...'
              : hasOwnImage
              ? isDe
                ? 'Bild ändern'
                : 'Change image'
              : isDe
              ? 'Bild hochladen'
              : 'Upload image'}
          </span>
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/webp,image/jpeg,image/png,.webp,.jpg,.jpeg,.png"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            void handleFileChange(field, picked);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>
    );
  };

  return (
    <>
      <div
        ref={windowRef}
        role="dialog"
        aria-label={isDe ? 'Utility-Info' : 'Utility Info'}
        data-no-map-click="true"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={
          isDesktopOrTablet && pos
            ? { left: `${pos.x}px`, top: `${pos.y}px` }
            : undefined
        }
        className={`fixed z-[105] flex flex-col rounded-2xl border border-zinc-700/90 bg-zinc-900/95 shadow-2xl backdrop-blur-md text-zinc-100 overflow-hidden animate-dialog-soft print:hidden ${
          isDesktopOrTablet
            ? 'w-[min(94vw,680px)] max-h-[calc(100dvh-76px)]'
            : 'left-1/2 -translate-x-1/2 bottom-16 w-[min(95vw,440px)] max-h-[82dvh]'
        }`}
      >
        {/* Header (Draggable on PC & Tablet) */}
        <div
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            startDrag(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            if (e.touches[0]) {
              e.stopPropagation();
              startDrag(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          className="flex items-center justify-between gap-2 px-4 py-2.5 bg-zinc-950/90 border-b border-zinc-800 md:cursor-grab md:active:cursor-grabbing select-none shrink-0"
          title={
            isDe
              ? 'Hier ziehen zum Verschieben (PC & Tablet)'
              : 'Drag header to move window (PC & Tablet)'
          }
        >
          <div className="flex items-center gap-2 min-w-0">
            <GripHorizontal className="hidden md:block w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span style={{ color: activeColor }} className="shrink-0">
              <UtilitySymbol type={util.type} size="sm" />
            </span>
            <h3 className="text-sm font-bold text-white truncate">{headerTitle}</h3>
            {util.locked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label={isDe ? 'Utility-Info schließen' : 'Close Utility Info'}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {/* Multiple Lineups from this Throw Origin Switcher */}
          {coLocatedUtils.length > 1 && (
            <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-zinc-950/80 border border-emerald-500/30">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Spline className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isDe ? 'Wurflinie an diesem Abwurfpunkt:' : 'Throw line at this origin:'}</span>
                </span>
                <span className="font-mono text-[10px] text-zinc-400">
                  {coLocatedUtils.length} {isDe ? 'Würfe' : 'throws'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {coLocatedUtils.map((item, idx) => {
                  const isSelected = item.id === util.id;
                  const iMeta = UTILITY_META[item.type] || UTILITY_META.smoke;
                  const label = item.label || `${isDe ? iMeta.labelDe : iMeta.labelEn} #${idx + 1}`;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectUtility?.(item)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500 text-zinc-950 border-sky-400 font-bold shadow-sm'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:text-white'
                      }`}
                    >
                      <UtilitySymbol type={item.type} size="sm" />
                      <span className="truncate max-w-[160px]">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Name / Beschriftung & Schriftgröße */}
          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-zinc-300">
                    {isDe ? 'Name / Beschriftung' : 'Label / Name'}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {isDe ? 'Auf Karte sichtbar' : 'Shown on map'}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={32}
                  value={util.label || ''}
                  onChange={(e) => onUpdate(util.id, { label: e.target.value })}
                  placeholder={isDe ? 'z. B. CT Smoke von T-Ramp' : 'e.g. CT Smoke from T Ramp'}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="sm:w-auto shrink-0">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-semibold text-zinc-300">{isDe ? 'Schriftgröße' : 'Font Size'}</span>
                  <span className="font-mono text-emerald-300 text-xs font-bold">{util.fontSize || 12}px</span>
                </div>
                <div className="flex items-center gap-1">
                  {[10, 12, 14, 16, 18, 22, 28].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onUpdate(util.id, { fontSize: val })}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-semibold cursor-pointer transition-colors ${
                        (util.fontSize || 12) === val
                          ? 'bg-sky-500 text-zinc-950 font-bold border border-sky-400'
                          : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {val}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3 Screenshot Cards (1. Standpunkt, 2. Zielpunkt with 1-4 switcher, 3. Ergebnis) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {renderUploadCard(
              isDe ? '1. Standpunkt (Spot)' : '1. Standpoint (Spot)',
              'standpunktImage',
              standpunktImg,
              standpunktIsInherited,
              Boolean(standpunktOwn)
            )}
            {renderUploadCard(
              isDe ? '2. Zielpunkt (Aim)' : '2. Aim Point',
              'aimImage',
              aimImg,
              false,
              Boolean(aimImg),
              true
            )}
            {renderUploadCard(
              isDe ? '3. Ergebnis (Spot)' : '3. Result (Spot)',
              'resultImage',
              resultImg,
              resultIsInherited,
              Boolean(resultImg)
            )}
          </div>

          {uploadError && (
            <div className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-[11px]">
              {uploadError}
            </div>
          )}

          {/* Throw Instruction & Notes */}
          <div className="rounded-xl bg-zinc-950/90 border border-zinc-800 px-3 py-2 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-zinc-200">
                <span className="text-zinc-400">
                  {isDe ? 'Wurf-Anweisung: ' : 'Throw instruction: '}
                </span>
                <span className="text-sky-300 font-bold">
                  {util.throwFrom
                    ? formatThrowTypeFull(util.throwType || 'left', lang)
                    : isDe
                    ? 'Nur Spot (ohne Wurflinie)'
                    : 'Spot only (no throw line)'}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-400">
                  {isDe ? `Zielpunkt #${activeSlot}` : `Aim #${activeSlot}`}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingThrow((p) => !p)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer transition-colors ${
                    isEditingThrow
                      ? 'bg-sky-500 text-zinc-950 border-sky-400 font-bold'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-sky-300'
                  }`}
                  title={isDe ? 'Wurfanweisung & Wurflinie anpassen' : 'Customize throw & instructions'}
                >
                  <Spline className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Wurf anpassen' : 'Customize throw'}</span>
                </button>
              </div>
            </div>

            {isEditingThrow && (
              <div className="pt-2 border-t border-zinc-800 space-y-2.5 animate-in fade-in duration-150">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>{isDe ? 'Wurfart auswählen' : 'Select throw type'}</span>
                    <span className="font-semibold text-sky-300">
                      {formatThrowTypeFull(util.throwType || 'left', lang)}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {UTILITY_THROW_TYPES.map((tt) => {
                      const tMeta = THROW_TYPE_META[tt];
                      const active = (util.throwType || 'left') === tt;
                      return (
                        <button
                          key={tt}
                          type="button"
                          onClick={() => onUpdate(util.id, { throwType: tt })}
                          className={`py-1.5 px-1 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors text-center ${
                            active
                              ? 'bg-sky-500 text-zinc-950 border-sky-400 font-black shadow-sm'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:text-white'
                          }`}
                          title={formatThrowTypeFull(tt, lang)}
                        >
                          {tMeta.short}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/80">
                  <span className="text-[11px] text-zinc-400">
                    {util.throwFrom
                      ? isDe
                        ? 'Wurflinie vorhanden'
                        : 'Throw curve active'
                      : isDe
                      ? 'Keine Wurflinie (nur Spot)'
                      : 'No throw line'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (util.throwFrom) {
                        onUpdate(util.id, { removeThrowFrom: true });
                      } else {
                        onAddLine(util);
                      }
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                      util.throwFrom
                        ? 'bg-red-500/15 text-red-300 border-red-500/40 hover:bg-red-500/25'
                        : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50 hover:bg-emerald-500/30'
                    }`}
                  >
                    {util.throwFrom
                      ? isDe
                        ? 'Linie entfernen'
                        : 'Remove line'
                      : isDe
                      ? '+ Wurflinie'
                      : '+ Add line'}
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-zinc-400 block">
                    {isDe ? 'Wurfanweisung / Notiz bearbeiten' : 'Throw notes / instructions'}
                  </span>
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={util.notes || ''}
                    onChange={(e) => onUpdate(util.id, { notes: e.target.value })}
                    placeholder={
                      isDe
                        ? 'z. B. Am Geländer ausrichten, Fadenkreuz auf Hausecke, Jumpthrow...'
                        : 'Aim at corner, jumpthrow...'
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 resize-y"
                  />
                </div>
              </div>
            )}

            {!isEditingThrow && util.notes?.trim() && (
              <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words pt-1 border-t border-zinc-800/80">
                {util.notes}
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions Footer (pinned at bottom, never clipped) */}
        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950/80 shrink-0 space-y-2.5">
            {!isAutosaveActive && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">
                    {isDe
                      ? 'Kein Autosave aktiv: Bilder & Änderungen werden nicht extern gesichert.'
                      : 'Autosave disabled: Images & edits are not backed up externally.'}
                  </span>
                </div>
                {onOpenBackupSetup && (
                  <button
                    type="button"
                    onClick={onOpenBackupSetup}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs whitespace-nowrap cursor-pointer transition-colors shrink-0 shadow-sm"
                  >
                    {isDe ? 'Aktivieren' : 'Enable'}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onEdit(util)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-semibold text-[11px] cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Bearbeiten' : 'Edit'}</span>
                </button>

              <button
                type="button"
                onClick={() => onMove(util)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-semibold text-[11px] cursor-pointer transition-colors ${
                  isMovingThis
                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                    : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-100'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>
                  {isMovingThis ? (isDe ? 'Fertig' : 'Done') : isDe ? 'Verschieben' : 'Move'}
                </span>
              </button>

              {!util.throwFrom && (
                <button
                  type="button"
                  onClick={() => onAddLine(util)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 font-semibold text-[11px] cursor-pointer transition-colors"
                >
                  <Spline className="w-3.5 h-3.5" />
                  <span>{isDe ? '+ Wurflinie' : '+ Add Throw'}</span>
                </button>
              )}

              {mapData && (
                <button
                  type="button"
                  onClick={() => setIsShareOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 font-semibold text-[11px] cursor-pointer transition-colors"
                  title={
                    isDe
                      ? 'Utility inkl. aller 3 Bilder, Name & Farbe teilen'
                      : 'Share utility incl. all 3 images, name & color'
                  }
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Teilen' : 'Share'}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-[11px] cursor-pointer transition-colors ml-auto"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isDe ? 'Fertig' : 'Done'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Zoom Preview */}
      {lightboxImage && (
        <div
          data-no-map-click="true"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 cursor-zoom-out print:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-[92vw] max-h-[88dvh] flex flex-col gap-2 bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-2xl cursor-default"
          >
            <div className="flex items-center justify-between gap-4 px-1">
              <span className="text-xs font-bold text-white truncate">
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                aria-label={isDe ? 'Vorschau schließen' : 'Close preview'}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.title}
              className="max-w-full max-h-[78dvh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
      {/* Single Utility Share Modal (All 3 Images, Name, Color, Font Size, Notes, QR) */}
      {mapData && (
        <ShareUtilityModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          util={util}
          mapData={mapData}
          activeSlot={activeSlot}
          lang={lang}
        />
      )}
    </>
  );
};
