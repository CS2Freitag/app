import React, { useState } from 'react';
import { ShieldAlert, FolderSync, Cloud, X, Check, ArrowRight } from 'lucide-react';
import { Language } from '../types';

interface BackupSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onSetupLocalFile: () => Promise<void>;
  onSetupCloudSync: () => void;
}

export const BackupSetupModal: React.FC<BackupSetupModalProps> = ({
  isOpen,
  onClose,
  lang,
  onSetupLocalFile,
  onSetupCloudSync,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';

  const [loadingLocal, setLoadingLocal] = useState(false);

  return (
    <div
      data-no-map-click="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        className="w-full max-w-md bg-zinc-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl text-zinc-100 relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {isDe ? 'Datensicherung einrichten' : 'Setup Data Backup'}
              </h3>
              <p className="text-xs text-amber-300/90 font-medium">
                {isDe ? 'Schütze deine Taktiken vor Datenverlust' : 'Protect your tactics from data loss'}
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

        <div className="space-y-4 text-xs text-zinc-300 leading-relaxed mb-6">
          <p>
            {isDe
              ? 'Du hast noch kein automatisches Backup (weder lokale Datei noch Cloud-Sync) eingerichtet. Damit erstellte Callouts, Bereiche oder Utilitys nicht bei gelöschten Browserdaten verloren gehen, empfehlen wir die Einrichtung einer automatischen Sicherung:'
              : 'You have not setup an automatic backup (local file or cloud sync) yet. To prevent losing callouts, areas, or utilities when browser data is cleared, we recommend setting up automatic backup:'}
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={loadingLocal}
              onClick={async () => {
                setLoadingLocal(true);
                try {
                  await onSetupLocalFile();
                  onClose();
                } finally {
                  setLoadingLocal(false);
                }
              }}
              className="w-full text-left p-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/60 transition-all flex items-center gap-3.5 group cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 shrink-0">
                <FolderSync className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-white group-hover:text-amber-300">
                  {isDe ? 'Lokale Backup-Datei (Autosave)' : 'Local Backup File (Autosave)'}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {isDe ? 'Speichert Änderungen direkt in einen Dateiordner auf deinem PC' : 'Saves changes directly to a file on your PC'}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                onSetupCloudSync();
                onClose();
              }}
              className="w-full text-left p-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-sky-500/60 transition-all flex items-center gap-3.5 group cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 group-hover:scale-105 shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-white group-hover:text-sky-300">
                  {isDe ? 'Google Cloud-Sync' : 'Google Cloud-Sync'}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {isDe ? 'Sichert deine Daten sicher in deinem Google-Konto' : 'Backs up your data securely to your Google account'}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-sky-400 shrink-0" />
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer py-1.5"
          >
            {isDe ? 'Später erinnern / Überspringen' : 'Remind me later / Skip'}
          </button>
        </div>
      </div>
    </div>
  );
};
