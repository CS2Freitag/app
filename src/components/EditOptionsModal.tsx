import React from 'react';
import { Move, X, Crosshair, Plus, ListFilter } from 'lucide-react';
import { Callout, Language, ZoneType } from '../types';

interface EditOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  callouts: Callout[];
  singleEditCalloutId: string | null;
  singleEditSearchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  customSelectedCount: number;
  getZoneBadgeColor: (zone: ZoneType) => string;
  onEnableGlobalEdit: () => void;
  onEnableSingleEdit: (calloutId: string) => void;
  onOpenNewCallout: () => void;
  onOpenCustomSelection: () => void;
}

export const EditOptionsModal: React.FC<EditOptionsModalProps> = ({
  isOpen,
  onClose,
  lang,
  callouts,
  singleEditCalloutId,
  singleEditSearchQuery,
  onChangeSearchQuery,
  customSelectedCount,
  getZoneBadgeColor,
  onEnableGlobalEdit,
  onEnableSingleEdit,
  onOpenNewCallout,
  onOpenCustomSelection,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';

  const filteredCallouts = callouts.filter(
    (c) =>
      c.name.toLowerCase().includes(singleEditSearchQuery.toLowerCase()) ||
      c.zone.toLowerCase().includes(singleEditSearchQuery.toLowerCase())
  );

  return (
    <div
      data-no-map-click="true"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl p-5 sm:p-6 shadow-2xl text-zinc-100 relative my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-zinc-800 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Move className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-black text-white">
                {isDe ? 'Bearbeitungs-Modus' : 'Edit Mode Options'}
              </h3>
            </div>
            <p className="text-xs text-zinc-400">
              {isDe
                ? 'Wähle, wie du die Karte oder Callouts anpassen möchtest:'
                : 'Choose how you want to edit map callouts:'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* OPTION 1: ALLES BEARBEITEN */}
          <button
            type="button"
            onClick={onEnableGlobalEdit}
            className="w-full text-left p-4 rounded-xl bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/60 transition-all group cursor-pointer flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 group-hover:scale-105 transition-transform shrink-0">
              <Move className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-extrabold text-sm text-white group-hover:text-amber-300 transition-colors">
                  {isDe ? '1. Alles Bearbeiten (Global)' : '1. Edit All Callouts (Global)'}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {callouts.length} Callouts
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isDe
                  ? 'Schaltet alle Callouts auf der Karte in den Bearbeitungsmodus.'
                  : 'Switches all callouts on the map into edit mode.'}
              </p>
            </div>
          </button>

          {/* OPTION 2: EINZEL-BEARBEITUNG */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
                <Crosshair className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="font-extrabold text-sm text-white block mb-0.5">
                  {isDe ? '2. Einzel-Bearbeitung (Fokussiert)' : '2. Single Callout Edit'}
                </span>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {isDe
                    ? 'Wähle ein Callout aus. Alle anderen werden ausgeblendet.'
                    : 'Select a callout. All others will be hidden.'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={singleEditSearchQuery}
                  onChange={(e) => onChangeSearchQuery(e.target.value)}
                  placeholder={isDe ? 'Callout suchen...' : 'Search callout...'}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-400"
                />
                <Crosshair className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {filteredCallouts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onEnableSingleEdit(c.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all text-xs cursor-pointer ${
                      singleEditCalloutId === c.id
                        ? 'bg-sky-500/20 border border-sky-400 text-sky-200'
                        : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold truncate">{c.name}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase ${getZoneBadgeColor(
                          c.zone
                        )}`}
                      >
                        {c.zone.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-sky-400 font-semibold shrink-0">
                      {isDe ? 'Bearbeiten →' : 'Edit →'}
                    </span>
                  </button>
                ))}
                {filteredCallouts.length === 0 && (
                  <div className="p-3 text-center text-xs text-zinc-500">
                    {isDe ? 'Kein Callout gefunden.' : 'No callout found.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* OPTION 3: NEUEN CALLOUT ERSTELLEN */}
          <button
            type="button"
            onClick={onOpenNewCallout}
            className="w-full text-left p-4 rounded-xl bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-emerald-500/60 transition-all group cursor-pointer flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-extrabold text-sm text-white group-hover:text-emerald-300 transition-colors">
                  {isDe ? '3. Neues Callout erstellen' : '3. Create New Callout'}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  +Neu
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isDe
                  ? 'Füge ein neuen Callout / Bereich auf der Karte hinzu.'
                  : 'Add a new callout / area to the map.'}
              </p>
            </div>
          </button>

          {/* OPTION 4: MEINE CALLOUT AUSWAHL */}
          <button
            type="button"
            onClick={onOpenCustomSelection}
            className="w-full text-left p-4 rounded-xl bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-indigo-500/60 transition-all group cursor-pointer flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
              <ListFilter className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-extrabold text-sm text-white group-hover:text-indigo-300 transition-colors">
                  {isDe ? '4. Meine Callout Auswahl' : '4. My Callout Selection'}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {customSelectedCount > 0
                    ? `${customSelectedCount} ausgewählt`
                    : isDe
                    ? 'Auswahl'
                    : 'Select'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isDe
                  ? 'Wähle aus welche Callouts du angezeigt haben möchtest.'
                  : 'Choose which callouts you want to display.'}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
