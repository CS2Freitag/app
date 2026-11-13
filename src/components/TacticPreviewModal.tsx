import React, { useEffect, useState } from 'react';
import { X, Image as ImageIcon, Download, RefreshCw } from 'lucide-react';
import { Language, MapData, TacticalDrawingLine, UtilityMarker, PlayerToken } from '../types';
import { generateTacticSheetPng } from '../utils/tacticSheetExport';

interface TacticPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapData: MapData;
  tacticState: {
    drawings: TacticalDrawingLine[];
    utilities: UtilityMarker[];
    players: PlayerToken[];
  };
  tacticTitle: string;
  lang: Language;
}

export const TacticPreviewModal: React.FC<TacticPreviewModalProps> = ({
  isOpen,
  onClose,
  mapData,
  tacticState,
  tacticTitle,
  lang,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);
    generateTacticSheetPng(mapData, tacticState, tacticTitle)
      .then((url) => {
        if (isMounted) {
          setPreviewUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to generate tactical sheet preview:', err);
        if (isMounted) setIsGenerating(false);
      });
    return () => {
      isMounted = false;
    };
  }, [mapData, tacticState, tacticTitle]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 print:hidden animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl text-zinc-100 flex flex-col space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-6 h-6 text-sky-400" />
            <div>
              <h3 className="text-base font-black text-white">
                {isDe ? 'Taktik-Vorschau (PNG)' : 'Tactical Preview (PNG)'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isDe ? 'Vorschau aller Linien, Utilitys, Spieler und Markierungen' : 'Preview of all drawings, utilities, players and markers'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 min-h-[350px] relative overflow-hidden">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-3 py-12 text-zinc-400">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
              <span className="text-xs font-medium">
                {isDe ? 'Generiere hochauflösende PNG-Vorschau...' : 'Generating high-res PNG preview...'}
              </span>
            </div>
          ) : previewUrl ? (
            <div className="relative max-w-full max-h-[60vh] overflow-auto rounded-lg shadow-2xl border border-zinc-800">
              <img
                src={previewUrl}
                alt="Tactical Sheet Preview"
                className="w-auto h-auto max-h-[55vh] object-contain mx-auto"
              />
            </div>
          ) : (
            <div className="text-xs text-red-400 font-medium">
              {isDe ? 'Fehler beim Generieren der Vorschau' : 'Failed to generate preview'}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            {isDe ? 'Schließen' : 'Close'}
          </button>
          {previewUrl && (
            <a
              href={previewUrl}
              download={`${mapData.name.toLowerCase().replace(/\s+/g, '_')}_taktik.png`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isDe ? 'PNG Herunterladen' : 'Download PNG'}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
