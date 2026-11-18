import React, { useMemo, useState } from 'react';
import { X, Upload, Trash2, Image as ImageIcon, Plus, Check, FolderCog, Layers, Shield, Crosshair, Users, Zap, Sparkles, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { MapData, MapCategory, Language } from '../types';

const FIRESTORE_SAFE_DOC_LIMIT_BYTES = 980 * 1024; // ~980 KB (leaving headroom below Firestore's 1 MiB / 1,048,576 byte hard limit)
const FIRESTORE_WARN_DOC_LIMIT_BYTES = 750 * 1024; // ~750 KB warning threshold

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function optimizeImagePreservingQuality(
  dataUrl: string,
  targetMaxBytes: number
): Promise<{ dataUrl: string; beforeBytes: number; afterBytes: number; wasOptimized: boolean }> {
  const beforeBytes = dataUrl.length;

  // Skip SVGs or images that already fit comfortably within the target size
  if (dataUrl.startsWith('data:image/svg+xml') || beforeBytes <= targetMaxBytes) {
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

        // Gentle steps: preserve crisp radar quality (never drop below quality 0.82 or 1024px unless original is smaller)
        const attempts: Array<{ maxDim: number; quality: number }> = [
          { maxDim: 1600, quality: 0.92 },
          { maxDim: 1600, quality: 0.86 },
          { maxDim: 1280, quality: 0.88 },
          { maxDim: 1280, quality: 0.82 },
          { maxDim: 1024, quality: 0.84 },
        ];

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
            // Fallback to JPEG if browser lacks WebP canvas encoding
            const jpgCanvas = document.createElement('canvas');
            jpgCanvas.width = targetW;
            jpgCanvas.height = targetH;
            const jpgCtx = jpgCanvas.getContext('2d');
            if (jpgCtx) {
              jpgCtx.fillStyle = '#09090b';
              jpgCtx.fillRect(0, 0, targetW, targetH);
              jpgCtx.drawImage(img, 0, 0, targetW, targetH);
              candidate = jpgCanvas.toDataURL('image/jpeg', attempt.quality);
            }
          }

          if (candidate.length < bestBytes) {
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
          wasOptimized: bestUrl !== dataUrl && bestBytes < beforeBytes,
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

interface MapEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapToEdit?: MapData | null;
  onSaveMap: (map: MapData) => void;
  onDeleteMap?: (mapId: string) => void;
  customGroups?: string[];
  onAddCustomGroup?: (groupName: string) => void;
  onDeleteCustomGroup?: (groupName: string) => void;
  lang: Language;
}

export const MapEditorModal: React.FC<MapEditorModalProps> = ({
  isOpen,
  onClose,
  mapToEdit,
  onSaveMap,
  onDeleteMap,
  customGroups = [],
  onAddCustomGroup,
  onDeleteCustomGroup,
  lang,
}) => {
  const isDe = lang === 'de';

  const [name, setName] = useState(mapToEdit?.name || '');
  const [category, setCategory] = useState<MapCategory>(
    mapToEdit?.category || 'community'
  );
  const [descriptionDe, setDescriptionDe] = useState(mapToEdit?.descriptionDe || '');
  const [descriptionEn, setDescriptionEn] = useState(mapToEdit?.descriptionEn || '');
  const [imageUrl, setImageUrl] = useState(mapToEdit?.image || '/maps/mirage.png');
  const [lowerImageUrl, setLowerImageUrl] = useState<string | undefined>(mapToEdit?.lowerImage);
  const [hasLowerImage, setHasLowerImage] = useState<boolean>(Boolean(mapToEdit?.lowerImage));
  const [previewError, setPreviewError] = useState(false);
  const [lowerPreviewError, setLowerPreviewError] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupError, setGroupError] = useState<string | null>(null);
  const [upperRawFileSize, setUpperRawFileSize] = useState<number | null>(null);
  const [lowerRawFileSize, setLowerRawFileSize] = useState<number | null>(null);
  const [upperOptInfo, setUpperOptInfo] = useState<{ before: number; after: number } | null>(null);
  const [lowerOptInfo, setLowerOptInfo] = useState<{ before: number; after: number } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  // Sync state if mapToEdit changes
  React.useEffect(() => {
    if (mapToEdit) {
      setName(mapToEdit.name);
      setCategory(mapToEdit.category);
      setDescriptionDe(mapToEdit.descriptionDe);
      setDescriptionEn(mapToEdit.descriptionEn);
      setImageUrl(mapToEdit.image);
      setLowerImageUrl(mapToEdit.lowerImage);
      setHasLowerImage(Boolean(mapToEdit.lowerImage));
    } else {
      setName('');
      setCategory('community');
      setDescriptionDe('');
      setDescriptionEn('');
      setImageUrl('/maps/mirage.png');
      setLowerImageUrl(undefined);
      setHasLowerImage(false);
    }
    setPreviewError(false);
    setLowerPreviewError(false);
    setUpperRawFileSize(null);
    setLowerRawFileSize(null);
    setUpperOptInfo(null);
    setLowerOptInfo(null);
    setIsOptimizing(false);
  }, [mapToEdit, isOpen]);

  const sizeMetrics = useMemo(() => {
    const encoder = new TextEncoder();
    const upperDataBytes = imageUrl.startsWith('data:') ? encoder.encode(imageUrl).length : 0;
    const lowerDataBytes =
      hasLowerImage && lowerImageUrl && lowerImageUrl.startsWith('data:')
        ? encoder.encode(lowerImageUrl).length
        : 0;
    const totalImagesBytes = upperDataBytes + lowerDataBytes;

    let estimatedDocBytes = totalImagesBytes;
    try {
      const simulatedDoc = {
        id: mapToEdit?.id || 'custom_preview',
        name: name.trim() || 'Map',
        slug: mapToEdit?.slug || 'map',
        category,
        image: imageUrl,
        lowerImage: hasLowerImage && lowerImageUrl ? lowerImageUrl : undefined,
        descriptionDe: descriptionDe.trim(),
        descriptionEn: descriptionEn.trim(),
        callouts: mapToEdit?.callouts || [],
        tacticData: mapToEdit?.tacticData,
        isCustom: mapToEdit ? mapToEdit.isCustom : true,
      };
      estimatedDocBytes = encoder.encode(JSON.stringify(simulatedDoc)).length;
    } catch {
      // Fallback to image size only
    }

    const isOverLimit = estimatedDocBytes > FIRESTORE_SAFE_DOC_LIMIT_BYTES;
    const isNearLimit = !isOverLimit && estimatedDocBytes > FIRESTORE_WARN_DOC_LIMIT_BYTES;

    return {
      upperDataBytes,
      lowerDataBytes,
      totalImagesBytes,
      estimatedDocBytes,
      isOverLimit,
      isNearLimit,
    };
  }, [imageUrl, lowerImageUrl, hasLowerImage, mapToEdit, name, category, descriptionDe, descriptionEn]);

  if (!isOpen) return null;

  const getImageByteBudget = (forFloor: 'upper' | 'lower') => {
    const encoder = new TextEncoder();
    let nonImageBytes = 4096;
    try {
      nonImageBytes = encoder.encode(
        JSON.stringify({
          id: mapToEdit?.id || 'custom_preview',
          name: name.trim() || 'Map',
          slug: mapToEdit?.slug || 'map',
          category,
          descriptionDe: descriptionDe.trim(),
          descriptionEn: descriptionEn.trim(),
          callouts: mapToEdit?.callouts || [],
          tacticData: mapToEdit?.tacticData,
        })
      ).length;
    } catch {
      // Fallback
    }
    const otherFloorBytes =
      forFloor === 'upper'
        ? hasLowerImage && lowerImageUrl?.startsWith('data:')
          ? lowerImageUrl.length
          : 0
        : imageUrl.startsWith('data:')
        ? imageUrl.length
        : 0;

    const available = FIRESTORE_SAFE_DOC_LIMIT_BYTES - nonImageBytes - otherFloorBytes - 30 * 1024;
    return Math.max(250 * 1024, available);
  };

  // Handle local file upload (Upper / Main)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUpperRawFileSize(file.size);
    setUpperOptInfo(null);
    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const result = loadEvent.target?.result as string;
      if (result) {
        setIsOptimizing(true);
        const budget = getImageByteBudget('upper');
        const optimized = await optimizeImagePreservingQuality(result, budget);
        setImageUrl(optimized.dataUrl);
        if (optimized.wasOptimized) {
          setUpperOptInfo({ before: optimized.beforeBytes, after: optimized.afterBytes });
        }
        setPreviewError(false);
        setIsOptimizing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle local file upload (Lower U)
  const handleLowerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLowerRawFileSize(file.size);
    setLowerOptInfo(null);
    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const result = loadEvent.target?.result as string;
      if (result) {
        setIsOptimizing(true);
        const budget = getImageByteBudget('lower');
        const optimized = await optimizeImagePreservingQuality(result, budget);
        setLowerImageUrl(optimized.dataUrl);
        if (optimized.wasOptimized) {
          setLowerOptInfo({ before: optimized.beforeBytes, after: optimized.afterBytes });
        }
        setHasLowerImage(true);
        setLowerPreviewError(false);
        setIsOptimizing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Optimize already-saved oversized data URLs on demand
  const handleOptimizeExistingImages = async () => {
    setIsOptimizing(true);
    try {
      if (imageUrl.startsWith('data:')) {
        const budget = getImageByteBudget('upper');
        const optUpper = await optimizeImagePreservingQuality(imageUrl, budget);
        if (optUpper.wasOptimized) {
          setImageUrl(optUpper.dataUrl);
          setUpperOptInfo({ before: optUpper.beforeBytes, after: optUpper.afterBytes });
        }
      }
      if (hasLowerImage && lowerImageUrl && lowerImageUrl.startsWith('data:')) {
        const budget = getImageByteBudget('lower');
        const optLower = await optimizeImagePreservingQuality(lowerImageUrl, budget);
        if (optLower.wasOptimized) {
          setLowerImageUrl(optLower.dataUrl);
          setLowerOptInfo({ before: optLower.beforeBytes, after: optLower.afterBytes });
        }
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newMap: MapData = {
      id: mapToEdit?.id || `custom_${Date.now()}`,
      name: name.trim(),
      slug: mapToEdit?.slug || name.toLowerCase().replace(/\s+/g, '_'),
      category,
      image: imageUrl,
      lowerImage: hasLowerImage && lowerImageUrl ? lowerImageUrl : undefined,
      descriptionDe: descriptionDe.trim() || `${name.trim()} - Eigene taktische Karte`,
      descriptionEn: descriptionEn.trim() || `${name.trim()} - Custom tactical map`,
      callouts: mapToEdit?.callouts || [],
      isCustom: mapToEdit ? mapToEdit.isCustom : true,
    };

    onSaveMap(newMap);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl text-zinc-100 overflow-hidden">
        {/* Header (always visible, never clipped) */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4 text-zinc-200" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">
                {mapToEdit
                  ? isDe
                    ? `Karte bearbeiten: ${mapToEdit.name}`
                    : `Edit Map: ${mapToEdit.name}`
                  : isDe
                  ? 'Neue CS2 Karte anlegen'
                  : 'Add New CS2 Map'}
              </h3>
              <p className="text-xs text-zinc-400 truncate">
                {isDe
                  ? 'Namen anpassen, Bild hochladen oder Kategorie ändern'
                  : 'Customize title, upload custom radar image, or change category'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form with scrollable body and fixed footer */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              {isDe ? 'Kartenname' : 'Map Name'} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Cache, Tuscan, Cobblestone..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-zinc-400"
            />
          </div>

          {/* KARTEN-POOL & EIGENE GRUPPEN */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
                <FolderCog className="w-4 h-4 text-amber-400" />
                <span>{isDe ? 'Karten-Pool & Gruppierung' : 'Map Pool & Category'}</span>
              </label>
              <span className="text-[11px] font-mono text-amber-400 font-bold uppercase">
                {category}
              </span>
            </div>

            {/* 1. Standard Pools */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'active', label: 'Active Duty', icon: <Crosshair className="w-3.5 h-3.5 text-amber-400" /> },
                { id: 'reserve', label: 'Reserve Pool', icon: <Shield className="w-3.5 h-3.5 text-sky-400" /> },
                { id: 'wingman', label: 'Wingman 2v2', icon: <Zap className="w-3.5 h-3.5 text-emerald-400" /> },
                { id: 'hostage', label: isDe ? 'Hostage (Geiseln)' : 'Hostage', icon: <Users className="w-3.5 h-3.5 text-purple-400" /> },
                { id: 'community', label: isDe ? 'Eigene / Custom' : 'Custom', icon: <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> },
              ].map((p) => {
                const isSelected = category === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCategory(p.id)}
                    className={`flex items-center justify-between py-2 px-2.5 text-xs font-semibold rounded-lg border transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/15 text-white ring-1 ring-amber-400/50 shadow-xs'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {p.icon}
                      <span className="truncate">{p.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>

            {/* 2. Eigene Gruppen */}
            {customGroups.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                <span className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">
                  {isDe ? 'Eigene Gruppen:' : 'Custom Groups:'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {customGroups.map((grp) => {
                    const isSelected = category === grp;
                    return (
                      <div
                        key={grp}
                        className={`flex items-center justify-between py-1.5 px-2.5 text-xs font-semibold rounded-lg border transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/15 text-white ring-1 ring-amber-400/50'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setCategory(grp)}
                          className="flex items-center gap-1.5 truncate flex-1 text-left"
                        >
                          <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{grp}</span>
                        </button>
                        {onDeleteCustomGroup && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(isDe ? `Gruppe "${grp}" löschen?` : `Delete group "${grp}"?`)) {
                                onDeleteCustomGroup(grp);
                                if (category === grp) setCategory('community');
                              }
                            }}
                            className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors ml-1"
                            title={isDe ? 'Gruppe löschen' : 'Delete group'}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Neue Gruppe anlegen */}
            <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-1.5">
              <span className="text-[11px] font-mono text-zinc-400 font-semibold uppercase">
                {isDe ? '+ Neue Gruppe anlegen:' : '+ Add New Custom Group:'}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={isDe ? 'z. B. Turnier 2026, Aim Maps, Team-Strat...' : 'e.g. Tournament, Aim Maps...'}
                  value={newGroupName}
                  onChange={(e) => {
                    setNewGroupName(e.target.value);
                    setGroupError(null);
                  }}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-white focus:outline-hidden focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newGroupName.trim();
                    if (!trimmed) return;
                    if (
                      ['active', 'reserve', 'wingman', 'hostage', 'community'].includes(trimmed.toLowerCase()) ||
                      customGroups.some((g) => g.toLowerCase() === trimmed.toLowerCase())
                    ) {
                      setGroupError(isDe ? 'Diese Gruppe existiert bereits!' : 'Group already exists!');
                      return;
                    }
                    if (onAddCustomGroup) {
                      onAddCustomGroup(trimmed);
                    }
                    setCategory(trimmed);
                    setNewGroupName('');
                    setGroupError(null);
                  }}
                  disabled={!newGroupName.trim()}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Gruppe anlegen' : 'Add Group'}</span>
                </button>
              </div>
              {groupError && <p className="text-[11px] text-red-400">{groupError}</p>}
            </div>
          </div>

          {/* 1. Hauptkarte / Obere Ebene (O) Radar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                {isDe ? 'Hauptkarte / Obere Ebene (O) Radar *' : 'Main Radar Map / Upper Floor (O) *'}
              </label>
              {sizeMetrics.upperDataBytes > 0 && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                    sizeMetrics.isOverLimit
                      ? 'bg-red-500/15 border-red-500/40 text-red-300'
                      : sizeMetrics.isNearLimit
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
                >
                  {upperRawFileSize !== null
                    ? `${isDe ? 'Datei' : 'File'}: ${formatBytes(upperRawFileSize)} · Base64: ${formatBytes(sizeMetrics.upperDataBytes)}`
                    : `Base64: ${formatBytes(sizeMetrics.upperDataBytes)}`}
                </span>
              )}
            </div>

            {/* Kurzer Firestore 1 MB Hinweis direkt beim Bildupload */}
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-sky-500/10 border border-sky-500/25 text-[11px] text-sky-200/90 leading-snug">
              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                {isDe
                  ? 'Hinweis: 1 MB maximale Größe pro Karte (Cloud-Sync). Große Bilder werden automatisch verlustarm optimiert.'
                  : 'Note: 1 MB maximum size per map (Cloud Sync). Large images are automatically optimized cleanly.'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-950 hover:bg-zinc-800 hover:border-zinc-500 cursor-pointer transition-colors text-xs text-zinc-300 font-medium">
                <Upload className="w-4 h-4 text-zinc-400" />
                <span>
                  {isOptimizing
                    ? isDe ? 'Optimiere Bild...' : 'Optimizing image...'
                    : isDe ? 'Bild für Ebene O (Oben) wählen...' : 'Choose image for Upper level (O)...'}
                </span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Erfolgsmeldung nach automatischer Optimierung */}
            {upperOptInfo && !sizeMetrics.isOverLimit && (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {isDe
                    ? `Automatisch verlustarm optimiert: ${formatBytes(upperOptInfo.before)} → ${formatBytes(upperOptInfo.after)} (Base64)`
                    : `Automatically optimized cleanly: ${formatBytes(upperOptInfo.before)} → ${formatBytes(upperOptInfo.after)} (Base64)`}
                </span>
              </div>
            )}

            {/* Warnung / Fehlermeldung bei Überschreitung des 1 MB Limits */}
            {sizeMetrics.isOverLimit && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/15 border border-red-500/50 text-red-200 text-xs leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <div className="space-y-1">
                    <p className="font-bold text-red-300">
                      {isDe
                        ? `Cloud-Sync Limit überschritten (${formatBytes(sizeMetrics.estimatedDocBytes)} / max. 1 MB)!`
                        : `Cloud Sync limit exceeded (${formatBytes(sizeMetrics.estimatedDocBytes)} / max. 1 MB)!`}
                    </p>
                    <p className="text-[11px] text-red-200/90">
                      {isDe
                        ? 'Trotz Qualitätserhalt überschreitet diese Karte 1 MB (inkl. Base64 & Callouts). Lokal speicherbar, aber Cloud-Sync schlägt fehl. Bitte Bild vorher etwas stärker verkleinern.'
                        : 'Even while preserving quality, this map exceeds 1 MB (incl. Base64 & callouts). Local save works, but Cloud Sync will fail. Please resize the image slightly beforehand.'}
                    </p>
                  </div>
                  {(imageUrl.startsWith('data:') || (hasLowerImage && lowerImageUrl?.startsWith('data:'))) && !upperOptInfo && (
                    <button
                      type="button"
                      onClick={handleOptimizeExistingImages}
                      disabled={isOptimizing}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-red-500/25 hover:bg-red-500/40 border border-red-400/50 text-red-100 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isOptimizing
                        ? isDe ? 'Optimiere...' : 'Optimizing...'
                        : isDe ? 'Bild jetzt verlustarm optimieren' : 'Optimize image cleanly now'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {sizeMetrics.isNearLimit && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px] leading-snug">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300">
                    {isDe
                      ? `Nahe am 1-MB-Limit (${formatBytes(sizeMetrics.estimatedDocBytes)}):`
                      : `Close to 1 MB limit (${formatBytes(sizeMetrics.estimatedDocBytes)}):`}
                  </span>{' '}
                  {isDe
                    ? 'Viele weitere Callouts oder Taktiken könnten das Cloud-Sync-Limit überschreiten.'
                    : 'Adding many more callouts or tactics may exceed the Cloud Sync limit.'}
                </div>
              </div>
            )}

            {/* Vorschau Ebene O */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center">
              {!previewError ? (
                <img
                  src={imageUrl}
                  alt="Upper Radar Preview"
                  className="w-full h-full object-contain"
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <div className="text-xs text-zinc-500">
                  {isDe ? 'Bild (Ebene O) konnte nicht geladen werden' : 'Image (Floor O) could not be loaded'}
                </div>
              )}
            </div>
          </div>

          {/* 2. Optionale Zweite Ebene Unten (U) */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLowerImage}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasLowerImage(checked);
                    if (!checked) {
                      setLowerImageUrl(undefined);
                      setLowerRawFileSize(null);
                    }
                  }}
                  className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
                <Layers className="w-4 h-4 text-purple-400" />
                <span>{isDe ? 'Zweites Stockwerk / Ebene Unten (U)' : 'Second Level / Lower Floor (U)'}</span>
              </label>
              <span className="text-[11px] font-mono text-purple-400 font-bold uppercase">
                {hasLowerImage ? (isDe ? 'Aktiv (O + U)' : 'Active (O + U)') : (isDe ? 'Inaktiv (Nur O)' : 'Inactive (O Only)')}
              </span>
            </div>

            {hasLowerImage && (
              <div className="pt-2 space-y-3 border-t border-zinc-800 animate-in fade-in-50">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    {isDe
                      ? 'Separates Radarbild für Ebene Unten (U). Das 1-MB-Limit gilt für Ebene O + U zusammen.'
                      : 'Separate radar image for Lower Floor (U). The 1 MB limit applies to Floor O + U combined.'}
                  </p>
                  {sizeMetrics.lowerDataBytes > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 shrink-0">
                      {lowerRawFileSize !== null
                        ? `${formatBytes(lowerRawFileSize)} · Base64: ${formatBytes(sizeMetrics.lowerDataBytes)}`
                        : `Base64: ${formatBytes(sizeMetrics.lowerDataBytes)}`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-purple-500/40 bg-purple-950/20 hover:bg-purple-950/40 hover:border-purple-400 cursor-pointer transition-colors text-xs text-purple-200 font-medium">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>
                      {isOptimizing
                        ? isDe ? 'Optimiere Bild...' : 'Optimizing image...'
                        : isDe ? 'Bild für Ebene U (Unten) wählen...' : 'Choose image for Lower level (U)...'}
                    </span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      onChange={handleLowerFileUpload}
                      className="hidden"
                    />
                  </label>
                  {lowerImageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLowerImageUrl(undefined);
                        setHasLowerImage(false);
                        setLowerRawFileSize(null);
                        setLowerOptInfo(null);
                      }}
                      className="p-2.5 text-red-400 hover:text-red-300 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors text-xs flex items-center gap-1"
                      title={isDe ? 'Ebene U entfernen' : 'Remove Floor U'}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">{isDe ? 'Entfernen' : 'Remove'}</span>
                    </button>
                  )}
                </div>

                {lowerOptInfo && !sizeMetrics.isOverLimit && (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {isDe
                        ? `Automatisch verlustarm optimiert: ${formatBytes(lowerOptInfo.before)} → ${formatBytes(lowerOptInfo.after)} (Base64)`
                        : `Automatically optimized cleanly: ${formatBytes(lowerOptInfo.before)} → ${formatBytes(lowerOptInfo.after)} (Base64)`}
                    </span>
                  </div>
                )}

                {/* Warnung bei Überschreitung durch Ebene O + U */}
                {sizeMetrics.lowerDataBytes > 0 && sizeMetrics.isOverLimit && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/15 border border-red-500/50 text-red-200 text-xs leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-red-300">
                        {isDe
                          ? `Gesamtgröße überschreitet 1-MB-Cloud-Limit (${formatBytes(sizeMetrics.estimatedDocBytes)})!`
                          : `Combined size exceeds 1 MB Cloud limit (${formatBytes(sizeMetrics.estimatedDocBytes)})!`}
                      </p>
                      <p className="text-[11px] text-red-200/90">
                        {isDe
                          ? 'Beide Bilder (Ebene O + U) plus Callouts dürfen zusammen max. 1 MB nicht überschreiten, sonst schlägt der Cloud-Sync fehl.'
                          : 'Both images (Floor O + U) plus callouts must not exceed 1 MB combined, otherwise Cloud Sync will fail.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Vorschau Ebene U */}
                {lowerImageUrl ? (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-purple-500/50 bg-zinc-950 flex items-center justify-center">
                    {!lowerPreviewError ? (
                      <img
                        src={lowerImageUrl}
                        alt="Lower Radar Preview"
                        className="w-full h-full object-contain"
                        onError={() => setLowerPreviewError(true)}
                      />
                    ) : (
                      <div className="text-xs text-zinc-500">
                        {isDe ? 'Bild (Ebene U) konnte nicht geladen werden' : 'Image (Floor U) could not be loaded'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 border border-dashed border-zinc-800 rounded-xl text-xs text-purple-300/60 font-mono">
                    {isDe ? 'Noch kein Bild für Ebene U ausgewählt' : 'No image selected for Floor U yet'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description (DE) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              {isDe ? 'Kurzbeschreibung (Deutsch)' : 'Short Description (German)'}
            </label>
            <textarea
              rows={2}
              value={descriptionDe}
              onChange={(e) => setDescriptionDe(e.target.value)}
              placeholder="z. B. Taktische Wettkampfkarte mit..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-zinc-400"
            />
          </div>

          {/* Description (EN) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              {isDe ? 'Kurzbeschreibung (Englisch)' : 'Short Description (English)'}
            </label>
            <textarea
              rows={2}
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              placeholder="e.g. Competitive tactical map featuring..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-zinc-400"
            />
          </div>
          </div>

          {/* Footer Actions (fixed at bottom of modal, never clipped) */}
          <div className="px-5 sm:px-6 py-4 border-t border-zinc-800 bg-zinc-900 shrink-0 flex items-center justify-between gap-3">
            {mapToEdit && onDeleteMap ? (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      isDe
                        ? `Möchtest du die Karte "${mapToEdit.name}" wirklich löschen?`
                        : `Are you sure you want to delete "${mapToEdit.name}"?`
                    )
                  ) {
                    onDeleteMap(mapToEdit.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDe ? 'Löschen' : 'Delete'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm"
              >
                {isDe ? 'Speichern' : 'Save Map'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
