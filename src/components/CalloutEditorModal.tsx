import React, { useRef, useState } from 'react';
import {
  X,
  Image as ImageIcon,
  Type,
  Upload,
  Crosshair,
  RotateCw,
  Square,
  Activity,
  PenTool,
  Trash2,
} from 'lucide-react';
import {
  Callout,
  CalloutDisplayMode,
  CalloutLevel,
  DangerLevel,
  Language,
  ZoneType,
} from '../types';
import { resolveAssetPath } from '../utils/assets';
import { getFontFamilyStyle } from '../utils/calloutFonts';

interface CalloutEditorModalProps {
  isOpen: boolean;
  lang: Language;
  hasLowerMap: boolean;
  editingCallout: Callout | null;
  pendingCalloutCoords: { x: number; y: number } | null;

  calloutFormName: string;
  onChangeName: (v: string) => void;
  calloutFormLevel: CalloutLevel;
  onChangeLevel: (v: CalloutLevel) => void;
  calloutFormZone: ZoneType;
  onChangeZone: (v: ZoneType) => void;
  calloutFormDanger: DangerLevel;
  onChangeDanger: (v: DangerLevel) => void;
  calloutFormTextRotation: number;
  onChangeTextRotation: (v: number) => void;
  calloutFormFontSize: number;
  onChangeFontSize: (v: number) => void;
  calloutFormFontFamily: string;
  onChangeFontFamily: (v: string) => void;
  calloutFormDisplayMode: CalloutDisplayMode;
  onChangeDisplayMode: React.Dispatch<React.SetStateAction<CalloutDisplayMode>>;
  calloutFormCustomImage: string;
  onChangeCustomImage: (v: string) => void;
  calloutFormImageSize: number;
  onChangeImageSize: (v: number) => void;
  calloutFormHidePin: boolean;
  onChangeHidePin: React.Dispatch<React.SetStateAction<boolean>>;
  calloutFormPinOffsetX: number;
  onChangePinOffsetX: (v: number) => void;
  calloutFormPinOffsetY: number;
  onChangePinOffsetY: (v: number) => void;

  calloutFormHasArea: boolean;
  onChangeHasArea: (v: boolean) => void;
  calloutFormAreaShape: 'rect' | 'polygon';
  onChangeAreaShape: (v: 'rect' | 'polygon') => void;
  calloutFormAreaPoints: { x: number; y: number }[];
  onChangeAreaPoints: React.Dispatch<React.SetStateAction<{ x: number; y: number }[]>>;
  onChangeAreaX: (v: number) => void;
  onChangeAreaY: (v: number) => void;
  calloutFormAreaWidth: number;
  onChangeAreaWidth: (v: number) => void;
  calloutFormAreaHeight: number;
  onChangeAreaHeight: (v: number) => void;

  calloutFormDescDe: string;
  onChangeDescDe: (v: string) => void;
  calloutFormTipDe: string;
  onChangeTipDe: (v: string) => void;

  onStartPolygonDrawing: () => void;
  onDeleteCallout: (id: string) => void;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const CalloutEditorModal: React.FC<CalloutEditorModalProps> = ({
  isOpen,
  lang,
  hasLowerMap,
  editingCallout,
  pendingCalloutCoords,
  calloutFormName,
  onChangeName,
  calloutFormLevel,
  onChangeLevel,
  calloutFormZone,
  onChangeZone,
  calloutFormDanger,
  onChangeDanger,
  calloutFormTextRotation,
  onChangeTextRotation,
  calloutFormFontSize,
  onChangeFontSize,
  calloutFormFontFamily,
  onChangeFontFamily,
  calloutFormDisplayMode,
  onChangeDisplayMode,
  calloutFormCustomImage,
  onChangeCustomImage,
  calloutFormImageSize,
  onChangeImageSize,
  calloutFormHidePin,
  onChangeHidePin,
  calloutFormPinOffsetX,
  onChangePinOffsetX,
  calloutFormPinOffsetY,
  onChangePinOffsetY,
  calloutFormHasArea,
  onChangeHasArea,
  calloutFormAreaShape,
  onChangeAreaShape,
  calloutFormAreaPoints,
  onChangeAreaPoints,
  onChangeAreaX,
  onChangeAreaY,
  calloutFormAreaWidth,
  onChangeAreaWidth,
  calloutFormAreaHeight,
  onChangeAreaHeight,
  calloutFormDescDe,
  onChangeDescDe,
  calloutFormTipDe,
  onChangeTipDe,
  onStartPolygonDrawing,
  onDeleteCallout,
  onSave,
  onClose,
}) => {
  const isDe = lang === 'de';
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingPinPreview, setIsDraggingPinPreview] = useState(false);

  if (!isOpen || !pendingCalloutCoords) return null;

  const handlePreviewPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!previewBoxRef.current) return;
    const rect = previewBoxRef.current.getBoundingClientRect();
    const clientX =
      'touches' in e && e.touches && e.touches.length > 0
        ? e.touches[0].clientX
        : (e as React.MouseEvent).clientX;
    const clientY =
      'touches' in e && e.touches && e.touches.length > 0
        ? e.touches[0].clientY
        : (e as React.MouseEvent).clientY;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = Math.max(-120, Math.min(120, Math.round(clientX - centerX)));
    const dy = Math.max(-120, Math.min(120, Math.round(clientY - centerY)));
    onChangePinOffsetX(dx);
    onChangePinOffsetY(dy);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto print:hidden">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
          <h3 className="text-base font-bold text-white">
            {editingCallout
              ? isDe
                ? `Callout bearbeiten: ${editingCallout.name.replace(/\n/g, ' ')}`
                : `Edit Callout: ${editingCallout.name.replace(/\n/g, ' ')}`
              : isDe
              ? 'Neuen Callout anlegen'
              : 'Create New Callout'}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4 text-xs">
          {/* Callout Name (Strictly max 2 lines) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold uppercase text-zinc-400">
                {isDe ? 'Callout-Name (Englisch)' : 'Callout Name (English)'} *
              </label>
              {calloutFormName.includes('\n') ? (
                <span className="text-[10px] font-mono text-amber-400 font-bold px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30">
                  2 / 2 {isDe ? 'Zeilen' : 'Lines'}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-zinc-500">
                  {isDe ? 'Enter für 2. Zeile' : 'Enter for 2nd line'}
                </span>
              )}
            </div>
            <textarea
              rows={calloutFormName.includes('\n') ? 2 : 1}
              required
              placeholder={isDe ? 'z. B. Bridge, Banana, Quad...' : 'e.g. Bridge, Banana, Quad...'}
              value={calloutFormName}
              onChange={(e) => {
                const rawLines = e.target.value.split(/\r?\n/);
                const limitedLines = rawLines.slice(0, 2);
                const val = limitedLines.join('\n');
                onChangeName(val);
                const lower = val.toLowerCase();
                if (lower.includes('ct spawn') || lower === 'ct') {
                  onChangeZone('ct_spawn');
                  onChangeCustomImage('ct.png');
                  onChangeDisplayMode((prev) => (prev === 'text' ? 'image' : prev));
                  onChangeHidePin(false);
                } else if (lower.includes('t spawn') || lower === 't') {
                  onChangeZone('t_spawn');
                  onChangeCustomImage('T.png');
                  onChangeDisplayMode((prev) => (prev === 'text' ? 'image' : prev));
                  onChangeHidePin(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const hasSecondLine = calloutFormName.includes('\n');
                  if (hasSecondLine && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    return;
                  }
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    onSave(e);
                  }
                }
              }}
              className={`w-full px-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-zinc-400 resize-none font-medium leading-snug transition-all duration-150 ${
                calloutFormName.includes('\n') ? 'h-[62px]' : 'h-[38px] overflow-hidden'
              }`}
            />
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
              {calloutFormName.includes('\n')
                ? isDe
                  ? '✓ 2. Zeile aktiv (Keine 3. Zeile möglich) • Strg+Enter zum Speichern'
                  : '✓ 2nd line active (No 3rd line allowed) • Ctrl+Enter to save'
                : isDe
                ? 'Tipp: Drücke Enter, um eine 2. Zeile hinzuzufügen'
                : 'Tip: Press Enter to add a 2nd line'}
            </span>
          </div>

          {/* DARSTELLUNG: TEXT ODER BILD */}
          <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold uppercase text-zinc-200 flex items-center gap-1.5 text-xs">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>{isDe ? 'Darstellung: Text oder Bild' : 'Display Mode: Text or Image'}</span>
              </label>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700">
                {calloutFormDisplayMode === 'image'
                  ? isDe
                    ? 'Nur Bild'
                    : 'Image Only'
                  : calloutFormDisplayMode === 'both'
                  ? isDe
                    ? 'Bild + Text'
                    : 'Image & Text'
                  : isDe
                  ? 'Nur Text'
                  : 'Text Only'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChangeDisplayMode('text')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  calloutFormDisplayMode === 'text'
                    ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md font-bold'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Text</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChangeDisplayMode('image');
                  onChangeHidePin(false);
                  if (!calloutFormCustomImage) {
                    const isCT =
                      calloutFormZone === 'ct_spawn' ||
                      calloutFormName.toLowerCase().includes('ct');
                    onChangeCustomImage(isCT ? 'ct.png' : 'T.png');
                  }
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  calloutFormDisplayMode === 'image'
                    ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md font-bold'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{isDe ? 'Bild (Emblem)' : 'Image (Emblem)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChangeDisplayMode('both');
                  onChangeHidePin(false);
                  if (!calloutFormCustomImage) {
                    const isCT =
                      calloutFormZone === 'ct_spawn' ||
                      calloutFormName.toLowerCase().includes('ct');
                    onChangeCustomImage(isCT ? 'ct.png' : 'T.png');
                  }
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  calloutFormDisplayMode === 'both'
                    ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md font-bold'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span className="text-[11px]">🖼️+📝</span>
                <span>{isDe ? 'Bild + Text' : 'Both'}</span>
              </button>
            </div>

            <div className="pt-2.5 border-t border-zinc-800/90 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-200">
                  {isDe ? 'Callout-Punkt / Emblem anzeigen' : 'Show Callout Pin / Emblem'}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {isDe
                    ? 'Punkt ausblenden, um nur die Beschriftung (Text) auf der Karte anzuzeigen'
                    : 'Hide pin marker to show text label only on the map'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onChangeHidePin((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                  !calloutFormHidePin ? 'bg-amber-400' : 'bg-zinc-800 border border-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-zinc-950 transition-transform ${
                    !calloutFormHidePin ? 'translate-x-6' : 'translate-x-1 bg-zinc-400'
                  }`}
                />
              </button>
            </div>

            {(calloutFormDisplayMode === 'image' || calloutFormDisplayMode === 'both') && (
              <div className="space-y-3 pt-2.5 border-t border-zinc-800/90 animate-in fade-in-50 duration-150">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                    {isDe ? 'Emblem wählen oder hochladen:' : 'Select or upload emblem:'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeCustomImage('ct.png');
                        onChangeDisplayMode((prev) => (prev === 'text' ? 'image' : prev));
                        onChangeHidePin(false);
                      }}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        calloutFormCustomImage === 'ct.png' || calloutFormCustomImage === '/ct.png'
                          ? 'border-sky-400 bg-sky-950/40 text-white ring-1 ring-sky-400 shadow-md'
                          : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <img
                        src={resolveAssetPath('ct.png')}
                        alt="CT Spawn Emblem"
                        className="w-7 h-7 object-contain rounded-full shadow filter drop-shadow"
                      />
                      <div className="leading-tight">
                        <div className="font-bold text-xs text-sky-300">CT Spawn</div>
                        <div className="text-[10px] text-zinc-400">ct.png</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onChangeCustomImage('T.png');
                        onChangeDisplayMode((prev) => (prev === 'text' ? 'image' : prev));
                        onChangeHidePin(false);
                      }}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        calloutFormCustomImage === 'T.png' || calloutFormCustomImage === '/T.png'
                          ? 'border-amber-500 bg-amber-950/40 text-white ring-1 ring-amber-500 shadow-md'
                          : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <img
                        src={resolveAssetPath('T.png')}
                        alt="T Spawn Emblem"
                        className="w-7 h-7 object-contain rounded-full shadow filter drop-shadow"
                      />
                      <div className="leading-tight">
                        <div className="font-bold text-xs text-amber-300">T Spawn</div>
                        <div className="text-[10px] text-zinc-400">T.png</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={calloutFormCustomImage}
                    onChange={(e) => onChangeCustomImage(e.target.value)}
                    placeholder="ct.png, T.png oder Web-URL..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-amber-400"
                  />
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer text-xs font-medium shrink-0">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isDe ? 'Datei' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            if (typeof evt.target?.result === 'string') {
                              onChangeCustomImage(evt.target.result);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                      <span>{isDe ? 'Bildgröße frei bestimmen (Pixel)' : 'Custom Image Size (px)'}</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {calloutFormImageSize}px
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        ({calloutFormImageSize} × {calloutFormImageSize})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="16"
                      max="96"
                      step="2"
                      value={calloutFormImageSize}
                      onChange={(e) => onChangeImageSize(Number(e.target.value))}
                      className="flex-1 accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                    />
                    <input
                      type="number"
                      min="16"
                      max="120"
                      value={calloutFormImageSize}
                      onChange={(e) =>
                        onChangeImageSize(Math.max(12, Math.min(150, Number(e.target.value) || 36)))
                      }
                      className="w-16 px-2 py-1 text-center font-mono font-bold text-xs rounded bg-zinc-950 border border-zinc-700 text-amber-300"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                    <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
                    {[
                      { label: '24px (Klein)', val: 24 },
                      { label: '32px', val: 32 },
                      { label: '36px (Standard)', val: 36 },
                      { label: '48px (Mittel)', val: 48 },
                      { label: '64px (Groß)', val: 64 },
                      { label: '80px (XXL)', val: 80 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => onChangeImageSize(p.val)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer ${
                          calloutFormImageSize === p.val
                            ? 'bg-amber-400 text-zinc-950 font-bold'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1:1 Live Scale Preview */}
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                      <span>🎯</span>
                      <span>
                        {isDe
                          ? 'Tatsächliche Bildgröße auf der Karte'
                          : 'Actual Rendered Size on Map'}
                      </span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px] border border-amber-500/30">
                      {calloutFormImageSize} × {calloutFormImageSize} Pixel
                    </span>
                  </div>

                  <div className="relative min-h-[120px] py-4 flex flex-col items-center justify-center rounded-lg bg-zinc-950 border border-dashed border-zinc-700/80 overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-15 pointer-events-none"
                      style={{
                        backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)',
                        backgroundSize: '16px 16px',
                      }}
                    />

                    {calloutFormCustomImage ? (
                      <div className="relative flex flex-col items-center justify-center z-10">
                        <div
                          style={{
                            width: `${calloutFormImageSize}px`,
                            height: `${calloutFormImageSize}px`,
                          }}
                          className="relative flex items-center justify-center transition-all"
                        >
                          <img
                            src={resolveAssetPath(calloutFormCustomImage)}
                            alt="Vorschau"
                            style={{
                              width: `${calloutFormImageSize}px`,
                              height: `${calloutFormImageSize}px`,
                              transform: `rotate(${calloutFormTextRotation}deg)`,
                            }}
                            className="rounded-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ring-1 ring-white/50"
                          />

                          <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-400 pointer-events-none" />
                          <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-400 pointer-events-none" />
                          <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-amber-400 pointer-events-none" />
                          <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-amber-400 pointer-events-none" />
                        </div>

                        {calloutFormDisplayMode === 'both' && (
                          <div
                            style={{
                              fontSize: `${calloutFormFontSize}px`,
                              fontFamily: getFontFamilyStyle(calloutFormFontFamily),
                              transform: `rotate(${calloutFormTextRotation}deg)`,
                            }}
                            className="mt-3 px-2 py-0.5 rounded bg-zinc-950/90 border border-zinc-700 text-white font-bold whitespace-nowrap text-center leading-tight shadow"
                          >
                            {calloutFormName.includes('\n') ? (
                              calloutFormName.split('\n').slice(0, 2).map((l, i) => (
                                <div key={i} className="whitespace-nowrap leading-tight">
                                  {l || '\u00A0'}
                                </div>
                              ))
                            ) : (
                              <span>{calloutFormName.trim() || 'Callout-Name'}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-zinc-500 text-xs italic z-10">
                        {isDe ? 'Kein Bild ausgewählt' : 'No image selected'}
                      </div>
                    )}

                    <div className="mt-2.5 text-[10px] font-mono text-zinc-500 text-center px-4 z-10">
                      {isDe
                        ? 'Exakter 1:1 Maßstab — genau so groß erscheint das Bild auf der taktischen Karte (bei 100% Zoom).'
                        : 'Exact 1:1 scale — this is how large the image will render on the tactical map (at 100% zoom).'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CALLOUT-TEXT POSITION */}
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                <span>{isDe ? 'Callout-Text Position' : 'Callout Text Position'}</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calloutFormHidePin}
                    onChange={(e) => {
                      const val = e.target.checked;
                      onChangeHidePin(val);
                      if (val) {
                        onChangePinOffsetX(0);
                        onChangePinOffsetY(0);
                      }
                    }}
                    className="w-3.5 h-3.5 accent-amber-400 rounded cursor-pointer"
                  />
                  <span>{isDe ? 'Punkt ausblenden' : 'Hide Pin'}</span>
                </label>
                <span className="font-mono text-[10px] text-amber-300 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                  X: {calloutFormPinOffsetX} / Y: {calloutFormPinOffsetY}
                </span>
              </div>
            </div>

            {!calloutFormHidePin && (
              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] text-zinc-400 leading-snug">
                  {isDe
                    ? 'Bewege das Schriftfeld in der Vorschau frei per Drag & Drop um den fixierten Callout-Punkt herum (oder nutze Presets & Regler).'
                    : 'Drag the text box freely around the fixed callout pin in the preview box (or use presets & sliders).'}
                </p>

                <div
                  ref={previewBoxRef}
                  onMouseDown={(e) => {
                    setIsDraggingPinPreview(true);
                    handlePreviewPointerMove(e);
                  }}
                  onMouseMove={(e) => {
                    if (isDraggingPinPreview || e.buttons === 1) {
                      handlePreviewPointerMove(e);
                    }
                  }}
                  onMouseUp={() => setIsDraggingPinPreview(false)}
                  onTouchStart={(e) => {
                    setIsDraggingPinPreview(true);
                    handlePreviewPointerMove(e);
                  }}
                  onTouchMove={(e) => {
                    if (isDraggingPinPreview) {
                      handlePreviewPointerMove(e);
                    }
                  }}
                  onTouchEnd={() => setIsDraggingPinPreview(false)}
                  className="relative h-64 w-full bg-zinc-900/90 rounded-xl border border-zinc-700/80 overflow-hidden cursor-crosshair select-none flex items-center justify-center shadow-inner group"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />
                  <div className="absolute w-full h-[1px] bg-zinc-800 pointer-events-none" />
                  <div className="absolute h-full w-[1px] bg-zinc-800 pointer-events-none" />

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-4 h-4 rounded-full bg-amber-400 border-2 border-zinc-950 shadow-[0_0_10px_rgba(251,191,36,0.8)] pointer-events-none flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                  </div>

                  <div
                    style={{
                      transform: `translate(${calloutFormPinOffsetX}px, ${calloutFormPinOffsetY}px) rotate(${calloutFormTextRotation}deg)`,
                      fontSize: `${calloutFormFontSize}px`,
                      fontFamily: getFontFamilyStyle(calloutFormFontFamily),
                    }}
                    className="relative z-20 px-2.5 py-1 rounded bg-zinc-950 border border-sky-400 text-sky-200 font-bold shadow-lg pointer-events-none whitespace-nowrap text-center leading-tight transition-transform duration-75"
                  >
                    {calloutFormName.includes('\n') ? (
                      calloutFormName.split('\n').slice(0, 2).map((l, i) => (
                        <div key={i} className="whitespace-nowrap leading-tight">
                          {l || '\u00A0'}
                        </div>
                      ))
                    ) : (
                      <span>{calloutFormName.trim() || 'Schriftfeld'}</span>
                    )}
                  </div>

                  <span className="absolute bottom-1.5 right-2 text-[9px] font-mono text-zinc-500 pointer-events-none">
                    {isDe ? 'Schriftfeld ziehen' : 'Drag Text Label'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
                  {[
                    { label: 'Zentriert (Mid)', x: 0, y: 0 },
                    { label: 'Unten (Standard)', x: 0, y: 25 },
                    { label: 'Oben', x: 0, y: -25 },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onChangePinOffsetX(p.x);
                        onChangePinOffsetY(p.y);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer transition-colors ${
                        calloutFormPinOffsetX === p.x && calloutFormPinOffsetY === p.y
                          ? 'bg-amber-400 text-zinc-950 font-bold'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                      <span>X-Offset ({calloutFormPinOffsetX}px):</span>
                    </div>
                    <input
                      type="range"
                      min="-120"
                      max="120"
                      step="1"
                      value={calloutFormPinOffsetX}
                      onChange={(e) => onChangePinOffsetX(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                      <span>Y-Offset ({calloutFormPinOffsetY}px):</span>
                    </div>
                    <input
                      type="range"
                      min="-120"
                      max="120"
                      step="1"
                      value={calloutFormPinOffsetY}
                      onChange={(e) => onChangePinOffsetY(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SCHRIFT-DREHUNG */}
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                <span>{isDe ? 'Schrift-Drehung' : 'Text Label Rotation'}</span>
              </label>
              <span className="font-mono font-bold text-sky-300">{calloutFormTextRotation}°</span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={calloutFormTextRotation}
                onChange={(e) => onChangeTextRotation(Number(e.target.value))}
                className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
              {[
                { label: '0°', val: 0 },
                { label: '45°', val: 45 },
                { label: '90°', val: 90 },
                { label: '-45°', val: -45 },
                { label: '-90°', val: -90 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => onChangeTextRotation(p.val)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer ${
                    calloutFormTextRotation === p.val
                      ? 'bg-sky-400 text-zinc-950 font-bold'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="min-h-[44px] py-2 px-3 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
              <div
                style={{
                  transform: `rotate(${calloutFormTextRotation}deg)`,
                  fontSize: `${calloutFormFontSize}px`,
                  fontFamily: getFontFamilyStyle(calloutFormFontFamily),
                }}
                className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-700 text-white font-bold transition-all whitespace-nowrap text-center leading-tight"
              >
                {calloutFormName.includes('\n') ? (
                  calloutFormName.split('\n').slice(0, 2).map((l, i) => (
                    <div key={i} className="whitespace-nowrap leading-tight">
                      {l || '\u00A0'}
                    </div>
                  ))
                ) : (
                  <span>{calloutFormName.trim() || 'Vorschau-Callout'}</span>
                )}
              </div>
            </div>
          </div>

          {/* INDIVIDUAL CALLOUT FONT SIZE */}
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isDe ? 'Eigene Schriftgröße (px)' : 'Individual Font Size (px)'}</span>
              </label>
              <span className="font-mono font-bold text-emerald-300">{calloutFormFontSize}px</span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="40"
                step="0.5"
                value={calloutFormFontSize}
                onChange={(e) => onChangeFontSize(Number(e.target.value))}
                className="flex-1 accent-emerald-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
              {[10, 12, 14, 16, 18, 22, 28].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChangeFontSize(val)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer ${
                    Math.round(calloutFormFontSize) === val
                      ? 'bg-emerald-400 text-zinc-950 font-bold'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {val}px
                </button>
              ))}
            </div>
          </div>

          {/* SCHRIFTART (FONT FAMILY) */}
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                <Type className="w-3.5 h-3.5 text-amber-400" />
                <span>{isDe ? 'Schriftart (Font) wählen' : 'Select Font Family'}</span>
              </label>
              <span className="font-mono text-[10px] text-amber-300 font-bold uppercase px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                {calloutFormFontFamily}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { id: 'mono', label: 'Taktisch (Mono)', style: 'ui-monospace, SFMono-Regular, monospace' },
                { id: 'rajdhani', label: 'Rajdhani (Esport)', style: "'Rajdhani', sans-serif" },
                { id: 'orbitron', label: 'Orbitron (Sci-Fi)', style: "'Orbitron', sans-serif" },
                { id: 'russo', label: 'Russo (Impact)', style: "'Russo One', sans-serif" },
                { id: 'teko', label: 'Teko (Sharp)', style: "'Teko', sans-serif" },
                { id: 'sans', label: 'Modern (Sans)', style: "'Inter', sans-serif" },
                { id: 'serif', label: 'Serif (Klassisch)', style: "'Georgia', serif" },
              ].map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => onChangeFontFamily(font.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    calloutFormFontFamily === font.id
                      ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold shadow-md ring-1 ring-amber-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <span className="text-xs truncate w-full" style={{ fontFamily: font.style }}>
                    {calloutFormName.trim() || 'Callout'}
                  </span>
                  <span className="text-[9px] opacity-75 font-mono mt-0.5">{font.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* TOTALCSGO-STYLE AREA */}
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={calloutFormHasArea}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onChangeHasArea(checked);
                    if (checked && pendingCalloutCoords && !editingCallout?.area) {
                      onChangeAreaX(
                        Math.round((pendingCalloutCoords.x - calloutFormAreaWidth / 2) * 10) / 10
                      );
                      onChangeAreaY(
                        Math.round((pendingCalloutCoords.y - calloutFormAreaHeight / 2) * 10) / 10
                      );
                    }
                  }}
                  className="w-4 h-4 accent-amber-400 rounded"
                />
                <Square className="w-3.5 h-3.5 text-sky-400" />
                <span>{isDe ? 'Zonenbereich (TotalCSGO-Stil)' : 'Zone Area Box / Polygon'}</span>
              </label>
              <span className="text-[10px] font-mono text-zinc-400">
                {calloutFormHasArea ? (isDe ? 'Aktiviert' : 'Active') : isDe ? 'Kein Bereich' : 'None'}
              </span>
            </div>

            {calloutFormHasArea && (
              <div className="pt-2.5 space-y-3 border-t border-zinc-800 animate-in fade-in-50 duration-150">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1.5">
                    {isDe ? 'Bereichs-Typ:' : 'Area Type:'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onChangeAreaShape('rect')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        calloutFormAreaShape === 'rect'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-sm font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>{isDe ? 'Rechteck' : 'Rectangle'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeAreaShape('polygon')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        calloutFormAreaShape === 'polygon'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>{isDe ? 'Linien zeichnen' : 'Draw Polygon'}</span>
                    </button>
                  </div>
                </div>

                {calloutFormAreaShape === 'rect' ? (
                  <div className="space-y-2.5">
                    <p className="text-[11px] text-zinc-400">
                      {isDe
                        ? 'Rechteck-Bereich. Position wird exakt beibehalten und springt nicht zurück.'
                        : 'Rectangular boundary. Coordinates stay fixed without jumping.'}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                          <span>{isDe ? 'Breite:' : 'Width:'}</span>
                          <span className="font-mono text-white">{calloutFormAreaWidth}%</span>
                        </div>
                        <input
                          type="range"
                          min="3"
                          max="35"
                          step="1"
                          value={calloutFormAreaWidth}
                          onChange={(e) => onChangeAreaWidth(Number(e.target.value))}
                          className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                          <span>{isDe ? 'Höhe:' : 'Height:'}</span>
                          <span className="font-mono text-white">{calloutFormAreaHeight}%</span>
                        </div>
                        <input
                          type="range"
                          min="3"
                          max="35"
                          step="1"
                          value={calloutFormAreaHeight}
                          onChange={(e) => onChangeAreaHeight(Number(e.target.value))}
                          className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-200">
                        {isDe ? 'Freie Liniensegmente' : 'Custom Line Segments'}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          calloutFormAreaPoints.length >= 3
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {calloutFormAreaPoints.length >= 3
                          ? isDe
                            ? `✓ ${calloutFormAreaPoints.length} Punkte (Geschlossen)`
                            : `✓ ${calloutFormAreaPoints.length} points`
                          : isDe
                          ? `${calloutFormAreaPoints.length} Punkte`
                          : `${calloutFormAreaPoints.length} points`}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {isDe
                        ? 'Zeichne Eckpunkte mit Linien auf der Karte. Wenn die Linien verbunden werden, wird daraus ein Zonenbereich.'
                        : 'Draw vertices with lines on map. When lines connect, it forms a closed zone area.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={onStartPolygonDrawing}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>{isDe ? 'Linien auf Karte zeichnen' : 'Draw Lines on Map'}</span>
                      </button>

                      {calloutFormAreaPoints.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onChangeAreaPoints((prev) => prev.slice(0, -1))}
                          className="px-2.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                          title={isDe ? 'Letzten Punkt entfernen' : 'Undo last point'}
                        >
                          ↶ {isDe ? 'Rückgängig' : 'Undo'}
                        </button>
                      )}

                      {calloutFormAreaPoints.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onChangeAreaPoints([])}
                          className="px-2.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 text-xs font-semibold transition-colors cursor-pointer"
                          title={isDe ? 'Alle Punkte löschen' : 'Clear points'}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Level Selector */}
          {hasLowerMap && (
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                  <span>{isDe ? 'Kartenebene / Stockwerk' : 'Floor / Level'}</span>
                </label>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-900 border border-purple-500/50 text-purple-300">
                  {calloutFormLevel === 'upper'
                    ? isDe
                      ? 'O (Oben)'
                      : 'Upper (O)'
                    : calloutFormLevel === 'lower'
                    ? isDe
                      ? 'U (Unten)'
                      : 'Lower (U)'
                    : isDe
                    ? 'O + U (Beide)'
                    : 'Both (O + U)'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onChangeLevel('upper')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    calloutFormLevel === 'upper'
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {isDe ? 'O (Oben)' : 'Upper (O)'}
                </button>
                <button
                  type="button"
                  onClick={() => onChangeLevel('lower')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    calloutFormLevel === 'lower'
                      ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {isDe ? 'U (Unten)' : 'Lower (U)'}
                </button>
                <button
                  type="button"
                  onClick={() => onChangeLevel('both')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    calloutFormLevel === 'both'
                      ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {isDe ? 'Beide (O + U)' : 'Both (O + U)'}
                </button>
              </div>
            </div>
          )}

          {/* Zone Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
              {isDe ? 'Zone (A/B/Mid/Spawns)' : 'Map Zone'}
            </label>
            <select
              value={calloutFormZone}
              onChange={(e) => {
                const newZone = e.target.value as ZoneType;
                onChangeZone(newZone);
                if (newZone === 'ct_spawn') {
                  onChangeCustomImage('ct.png');
                  onChangeDisplayMode((prev) => (prev === 'text' ? 'image' : prev));
                  onChangeHidePin(false);
                } else if (newZone === 't_spawn') {
                  onChangeCustomImage('T.png');
                  onChangeDisplayMode((prev) => (prev === 'text' ? 'image' : prev));
                  onChangeHidePin(false);
                }
              }}
              className="w-full px-2.5 py-2 rounded-lg border border-zinc-700 bg-zinc-950 text-white"
            >
              <option value="a_site">🟠 A-Site (Orange — Bombenplatz A)</option>
              <option value="b_site">🔵 B-Site (Blau/Cyan — Bombenplatz B)</option>
              <option value="mid">🟢 Middle (Grün — Mitte & Mid-Lanes)</option>
              <option value="t_spawn">🟤 T-Spawn (Braun — Terroristen-Basis)</option>
              <option value="ct_spawn">🔵 CT-Spawn (Blau — Antiterrorteam-Basis)</option>
              <option value="other">⚪ Sonstige (Weiß/Grau — Außenflanken)</option>
            </select>
          </div>

          {/* Danger Level Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
              {isDe ? 'Gefahrenstufe' : 'Danger Level'}
            </label>
            <select
              value={calloutFormDanger}
              onChange={(e) => onChangeDanger(e.target.value as DangerLevel)}
              className="w-full px-2.5 py-2 rounded-lg border border-zinc-700 bg-zinc-950 text-white"
            >
              <option value="high">🔴 Hoch (Rot — Duell-Hotspots & Granaten-Brennpunkte)</option>
              <option value="medium">🟡 Mittel (Gelb — Flankenrouten & Deckungswinkel)</option>
              <option value="low">🟢 Gering (Grün — Sichere Rückzugszonen)</option>
            </select>
          </div>

          {/* Description & Tactical Tip */}
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
              {isDe ? 'Positionsbeschreibung (Deutsch)' : 'Description (German)'}
            </label>
            <textarea
              rows={2}
              value={calloutFormDescDe}
              onChange={(e) => onChangeDescDe(e.target.value)}
              placeholder="Genaue taktische Lagebeschreibung..."
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
              {isDe ? 'Taktischer Tipp' : 'Tactical Tip'}
            </label>
            <textarea
              rows={2}
              value={calloutFormTipDe}
              onChange={(e) => onChangeTipDe(e.target.value)}
              placeholder="z. B. Molotov werfen, vor Peeken flashen..."
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white"
            />
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            {editingCallout ? (
              <button
                type="button"
                onClick={() => {
                  onDeleteCallout(editingCallout.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDe ? 'Callout löschen' : 'Delete Callout'}</span>
              </button>
            ) : (
              <span className="text-[11px] font-mono text-zinc-500">
                Position: {pendingCalloutCoords.x} / {pendingCalloutCoords.y}
              </span>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer"
              >
                {isDe ? 'Speichern' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
