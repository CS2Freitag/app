import React from 'react';
import { AlertTriangle, GitMerge, Download, HardDrive } from 'lucide-react';
import { Language } from '../types';

interface CloudConflictModalProps {
  isOpen: boolean;
  onSmartMerge: () => void;
  onDiscardAndLoadCloud: () => void;
  onSaveLocallyOnly: () => void;
  onCancel: () => void;
  lang: Language;
  mapName?: string;
  isProcessing?: boolean;
}

export const CloudConflictModal: React.FC<CloudConflictModalProps> = ({
  isOpen,
  onSmartMerge,
  onDiscardAndLoadCloud,
  onSaveLocallyOnly,
  onCancel,
  lang,
  mapName,
  isProcessing = false,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in-50">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 scale-in-95 animate-in">
        {/* Header matching Save Dialog */}
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-tight">
              {isDe ? 'KONFLIKT ERKANNT!' : 'CONFLICT DETECTED!'}
            </h3>
            <p className="text-[11px] text-zinc-400">
              {mapName
                ? isDe
                  ? `In der Cloud existiert bereits ein neuerer Stand von ${mapName}.`
                  : `A newer cloud version already exists for ${mapName}.`
                : isDe
                ? 'In der Cloud existiert bereits ein neuerer Stand dieser Karte.'
                : 'A newer cloud version of this map already exists.'}
            </p>
          </div>
        </div>

        {/* Description requested verbatim */}
        <div className="space-y-4 mb-6">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {isDe
              ? 'In der Cloud existiert bereits ein neuerer Stand dieser Karte. Möchtest du deine jetzigen Änderungen verwerfen und den neuesten Stand herunterladen, möchtest du die Karte oder alles Offline speichern oder möchtest du den neuesten Stand herunterladen, ohne dass deine jetzigen Änderungen verloren gehen?'
              : 'A newer version of this map exists in the cloud. Would you like to discard your current changes and download the latest version, save the map offline only, or download the latest version without losing your current changes?'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {/* Button 1 (Hauptaktion - Grün/Dunkel): Smart Merge */}
          <button
            type="button"
            onClick={onSmartMerge}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold text-xs transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <GitMerge className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-center">
              {isDe
                ? 'Änderungen beibehalten & Cloud-Stand zusammenführen (Smart Merge)'
                : 'Keep changes & merge with cloud (Smart Merge)'}
            </span>
          </button>

          {/* Button 2 (Kritisch - Rot): Verwerfen & Cloud-Stand laden */}
          <button
            type="button"
            onClick={onDiscardAndLoadCloud}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              {isDe
                ? 'Änderungen verwerfen & Cloud-Stand laden'
                : 'Discard changes & load cloud version'}
            </span>
          </button>

          {/* Button 3 (Textumrandung-Orange): Nur lokal speichern */}
          <button
            type="button"
            onClick={onSaveLocallyOnly}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/50 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isDe
                ? 'Nur lokal auf diesem Gerät speichern'
                : 'Save locally on this device only'}
            </span>
          </button>

          {/* Button 4 (Text-Link): Abbrechen */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="w-full text-center py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {isDe ? 'Abbrechen' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
