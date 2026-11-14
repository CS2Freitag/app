import React from 'react';
import { Upload, Check, Trash2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { loginWithGoogle } from '../services/firebase';
import { Language } from '../types';

interface SyncPromptModalProps {
  isOpen: boolean;
  lang: Language;
  currentUser: User | null;
  isSyncing: boolean;
  onSetIsSyncing: (val: boolean) => void;
  onConfirmSync: (doSync: boolean, targetUser?: User | null) => Promise<void>;
  onDiscardAndExit: () => void;
  onClose: () => void;
}

export const SyncPromptModal: React.FC<SyncPromptModalProps> = ({
  isOpen,
  lang,
  currentUser,
  isSyncing,
  onSetIsSyncing,
  onConfirmSync,
  onDiscardAndExit,
  onClose,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in-50 print:hidden">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 scale-in-95 animate-in">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-tight">
              {isDe ? 'Änderungen synchronisieren?' : 'Sync Changes?'}
            </h3>
            <p className="text-[11px] text-zinc-400">
              {isDe ? 'Du hast Änderungen an dieser Karte vorgenommen.' : 'You have made changes to this map.'}
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {isDe
              ? 'Möchtest du diese Änderungen jetzt mit deinem Google-Konto synchronisieren (Cloud), damit sie auch auf anderen Geräten verfügbar sind, oder nur lokal auf diesem Gerät speichern?'
              : 'Would you like to sync these changes with your Google account (Cloud) now so they are available on other devices, or only save them locally on this device?'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {currentUser ? (
            <button
              onClick={() => onConfirmSync(true)}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-zinc-950 font-bold hover:bg-amber-300 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isDe ? 'In die Cloud synchronisieren' : 'Sync to Cloud'}</span>
            </button>
          ) : (
            <button
              onClick={async () => {
                onSetIsSyncing(true);
                try {
                  const res = await loginWithGoogle();
                  if (res?.user) {
                    await onConfirmSync(true, res.user);
                  }
                } catch (err) {
                  console.error('Login error:', err);
                } finally {
                  onSetIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-zinc-950 font-bold hover:bg-amber-300 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>{isDe ? 'Mit Google anmelden & synchronisieren' : 'Sign in with Google & Sync'}</span>
            </button>
          )}

          <button
            onClick={() => onConfirmSync(false)}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isDe ? 'Nur lokal auf diesem Gerät speichern' : 'Save Locally Only'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={onDiscardAndExit}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-semibold border border-red-800/60 transition-colors disabled:opacity-50 cursor-pointer"
              title={isDe ? 'Änderungen dieser Sitzung verwerfen' : 'Discard session changes'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDe ? 'Ohne zu speichern verlassen' : 'Discard & Exit'}</span>
            </button>
            <button
              onClick={onClose}
              disabled={isSyncing}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-transparent hover:bg-zinc-800 text-zinc-400 text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isDe ? 'Abbrechen' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
