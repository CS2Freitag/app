import React from 'react';
import { AlertTriangle, Upload, Download, Save } from 'lucide-react';
import { Language } from '../types';

interface UploadConflictModalProps {
  isOpen: boolean;
  onOverwriteCloud: () => void;
  onSaveLocallyAndDownloadCloud: () => void;
  onKeepLocallyAndSkip: () => void;
  onCancel: () => void;
  lang: Language;
  isProcessing?: boolean;
}

export const UploadConflictModal: React.FC<UploadConflictModalProps> = ({
  isOpen,
  onOverwriteCloud,
  onSaveLocallyAndDownloadCloud,
  onKeepLocallyAndSkip,
  onCancel,
  lang,
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
              {isDe ? 'ACHTUNG: CLOUD ENTHÄLT NEUERE DATEN!' : 'WARNING: CLOUD HAS NEWER DATA!'}
            </h3>
            <p className="text-[11px] text-zinc-400">
              {isDe
                ? 'Konflikt bei der manuellen Cloud-Synchronisierung'
                : 'Conflict during manual cloud synchronization'}
            </p>
          </div>
        </div>

        {/* Warning text requested verbatim */}
        <div className="space-y-4 mb-6">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {isDe
              ? 'Achtung: Die Cloud enthält neuere Daten. Wenn du fortfährst, werden die Daten in der Cloud unwiderruflich mit deinem lokalen Stand überschrieben.'
              : 'Warning: The cloud contains newer data. If you proceed, the cloud data will be permanently overwritten with your local version.'}
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {/* Option 1: Cloud trotzdem überschreiben (Erzwingen - Rot/Warnung) */}
          <button
            type="button"
            onClick={onOverwriteCloud}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              {isDe
                ? 'Cloud trotzdem überschreiben'
                : 'Overwrite cloud anyway'}
            </span>
          </button>

          {/* Option 2: Änderungen lokal speichern und dann neuesten Stand herunterladen */}
          <button
            type="button"
            onClick={onSaveLocallyAndDownloadCloud}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold text-xs transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-center">
              {isDe
                ? 'Änderungen lokal speichern und dann neuesten Stand herunterladen'
                : 'Save local backup & download latest cloud version'}
            </span>
          </button>

          {/* Option 3: Änderungen lokal speichern und den neuen Stand nicht herunterladen */}
          <button
            type="button"
            onClick={onKeepLocallyAndSkip}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/50 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-center">
              {isDe
                ? 'Änderungen lokal speichern und den neuen Stand nicht herunterladen'
                : 'Save changes locally & do not download cloud version'}
            </span>
          </button>

          {/* Option 4: Abbrechen */}
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
