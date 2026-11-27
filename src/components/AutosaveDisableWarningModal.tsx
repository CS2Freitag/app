import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Language } from '../types';

interface AutosaveDisableWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDisable: (dontShowAgain: boolean) => void;
  lang: Language;
}

export const AutosaveDisableWarningModal: React.FC<AutosaveDisableWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirmDisable,
  lang,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';

  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);

  return (
    <div
      data-no-map-click="true"
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-zinc-100 relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {isDe ? 'Autosave wirklich deaktivieren?' : 'Disable Autosave?'}
              </h3>
              <p className="text-xs text-rose-300/90 font-medium">
                {isDe ? 'Risiko von Datenverlust bei Browser-Löschung' : 'Risk of data loss if browser data is cleared'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-zinc-300 leading-relaxed mb-6">
          <p>
            {isDe
              ? 'Wenn du Autosave oder die automatische Datensicherung ausschaltest, werden deine Taktiken, Callouts und Utility-Bilder nicht mehr automatisch extern gesichert.'
              : 'If you disable autosave or automated backups, your tactics, callouts and utility images will no longer be automatically backed up externally.'}
          </p>
          <p className="text-zinc-400">
            {isDe
              ? 'Bei einem Leeren des Browser-Caches oder beim Wechsel des Geräts können ungespeicherte Änderungen verloren gehen.'
              : 'Clearing browser cache or changing devices may result in permanent data loss for unsaved changes.'}
          </p>

          <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-900 cursor-pointer"
            />
            <span className="text-xs text-zinc-300 font-medium">
              {isDe ? 'Nicht mehr warnen (diesen Hinweis nicht wieder anzeigen)' : "Don't warn me again"}
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            {isDe ? 'Abbrechen' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmDisable(dontShowAgain);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-rose-900/30"
          >
            {isDe ? 'Trotzdem deaktivieren' : 'Disable Anyway'}
          </button>
        </div>
      </div>
    </div>
  );
};
