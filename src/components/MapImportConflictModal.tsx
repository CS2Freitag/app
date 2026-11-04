import React, { useState } from 'react';
import { AlertTriangle, Replace, PlusCircle, X, Check } from 'lucide-react';
import { MapData, Language } from '../types';

interface MapImportConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  incomingMap: MapData;
  existingMap: MapData;
  onOverwrite: () => void;
  onCreateNew: (newName: string) => void;
  lang: Language;
}

export const MapImportConflictModal: React.FC<MapImportConflictModalProps> = ({
  isOpen,
  onClose,
  incomingMap,
  existingMap,
  onOverwrite,
  onCreateNew,
  lang,
}) => {
  const isDe = lang === 'de';

  // Compute default suggested name e.g. "[Name]-Neu1"
  const defaultSuggestedName = `${incomingMap.name}-Neu1`;
  const [customNewName, setCustomNewName] = useState<string>(defaultSuggestedName);
  const [selectedAction, setSelectedAction] = useState<'overwrite' | 'new'>('new');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAction === 'overwrite') {
      onOverwrite();
    } else {
      onCreateNew(customNewName.trim() || defaultSuggestedName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isDe ? 'Karte bereits vorhanden' : 'Map Already Exists'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isDe ? 'Konflikt beim Importieren lösen' : 'Resolve map import conflict'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Details */}
        <div className="mb-5 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{isDe ? 'Kartenname:' : 'Map name:'}</span>
            <span className="font-bold text-white uppercase">{incomingMap.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{isDe ? 'Vorhandene Version:' : 'Existing version:'}</span>
            <span className="font-mono text-zinc-300">{existingMap.callouts.length} Callouts</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">{isDe ? 'Importierte Version:' : 'Imported version:'}</span>
            <span className="font-mono text-amber-400 font-bold">{incomingMap.callouts.length} Callouts</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-zinc-300 font-medium">
            {isDe
              ? 'Wie möchtest du mit der importierten Karte verfahren?'
              : 'How would you like to handle the imported map?'}
          </p>

          {/* Option 1: Create as new map (Recommended) */}
          <label
            onClick={() => setSelectedAction('new')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedAction === 'new'
                ? 'border-amber-400 bg-amber-500/10 ring-1 ring-amber-400/40 text-white'
                : 'border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800/40 text-zinc-300'
            }`}
          >
            <input
              type="radio"
              name="conflict_action"
              checked={selectedAction === 'new'}
              onChange={() => setSelectedAction('new')}
              className="mt-1 accent-amber-400"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300 mb-1">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{isDe ? 'Als neue Karte anlegen (Empfohlen)' : 'Create as New Map (Recommended)'}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mb-2.5">
                {isDe
                  ? 'Erstellt eine Kopie mit eigenem Namen, die bestehende Karte bleibt unverändert.'
                  : 'Creates a new map copy with a custom name; existing map remains intact.'}
              </p>

              {/* Custom Name Input */}
              {selectedAction === 'new' && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-zinc-400">
                    {isDe ? 'Neuer Name der Karte:' : 'New map name:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={customNewName}
                    onChange={(e) => setCustomNewName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-white focus:outline-hidden focus:border-amber-400"
                    placeholder="z. B. Mirage-Neu1"
                  />
                </div>
              )}
            </div>
          </label>

          {/* Option 2: Overwrite existing map */}
          <label
            onClick={() => setSelectedAction('overwrite')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedAction === 'overwrite'
                ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500/40 text-white'
                : 'border-zinc-800 bg-zinc-950/40 hover:bg-zinc-800/40 text-zinc-300'
            }`}
          >
            <input
              type="radio"
              name="conflict_action"
              checked={selectedAction === 'overwrite'}
              onChange={() => setSelectedAction('overwrite')}
              className="mt-1 accent-red-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-red-400 mb-1">
                <Replace className="w-3.5 h-3.5" />
                <span>{isDe ? 'Bestehende Karte überschreiben' : 'Overwrite Existing Map'}</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {isDe
                  ? 'Ersetzt die vorhandene Karte und alle ihre Callouts durch die Datei.'
                  : 'Replaces the existing map and all its callouts with the imported file.'}
              </p>
            </div>
          </label>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              {isDe ? 'Abbrechen' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isDe ? 'Bestätigen' : 'Confirm'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
