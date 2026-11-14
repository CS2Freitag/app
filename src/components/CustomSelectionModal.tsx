import React from 'react';
import { ListFilter, X, Crosshair, Check, Plus } from 'lucide-react';
import { Callout, Language, ZoneType } from '../types';

interface CustomSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  callouts: Callout[];
  tempSelectedCalloutIds: string[];
  onChangeTempSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  customSelectionTab: 'all' | 'selected';
  onChangeTab: (tab: 'all' | 'selected') => void;
  customSelectionSearch: string;
  onChangeSearch: (q: string) => void;
  getZoneBadgeColor: (zone: ZoneType) => string;
  onApply: (ids: string[]) => void;
}

export const CustomSelectionModal: React.FC<CustomSelectionModalProps> = ({
  isOpen,
  onClose,
  lang,
  callouts,
  tempSelectedCalloutIds,
  onChangeTempSelectedIds,
  customSelectionTab,
  onChangeTab,
  customSelectionSearch,
  onChangeSearch,
  getZoneBadgeColor,
  onApply,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';

  const filteredCallouts = callouts.filter(
    (c) =>
      c.name.toLowerCase().includes(customSelectionSearch.toLowerCase()) ||
      c.zone.toLowerCase().includes(customSelectionSearch.toLowerCase())
  );

  return (
    <div
      data-no-map-click="true"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-zinc-900 border border-zinc-700/80 rounded-2xl p-4 sm:p-6 shadow-2xl text-zinc-100 relative my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-zinc-800 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shrink-0">
              <ListFilter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>{isDe ? 'Meine Callout Auswahl' : 'My Callout Selection'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {tempSelectedCalloutIds.length} / {callouts.length}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {isDe
                  ? 'Wähle aus welche Callouts du angezeigt haben möchtest.'
                  : 'Choose which callouts you want to display on this map.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Tab Switcher (< md screens) */}
        <div className="flex md:hidden items-center p-1 rounded-xl bg-zinc-950 border border-zinc-800 mb-3 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChangeTab('all')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              customSelectionTab === 'all'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>{isDe ? 'Alle Callouts' : 'All Callouts'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 font-mono">
              {callouts.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('selected')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              customSelectionTab === 'selected'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>{isDe ? 'Meine Auswahl' : 'My Selection'}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                tempSelectedCalloutIds.length > 0 ? 'bg-white text-indigo-900' : 'bg-zinc-900 text-zinc-400'
              }`}
            >
              {tempSelectedCalloutIds.length}
            </span>
          </button>
        </div>

        {/* Main Selection Area: Responsive 2-column or tabbed view */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* LEFT COLUMN: ALLE CALLOUTS */}
            <div
              className={`flex flex-col bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 sm:p-3.5 ${
                customSelectionTab !== 'all' ? 'hidden md:flex' : 'flex'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800 shrink-0">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-200">
                    {isDe ? 'Alle Callouts' : 'All Callouts'}
                  </span>
                  <span className="ml-1.5 text-[10px] font-mono text-zinc-500">
                    ({callouts.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeTempSelectedIds(callouts.map((c) => c.id))}
                  className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  {isDe ? 'Alle hinzufügen' : 'Add all'}
                </button>
              </div>

              <div className="relative mb-2.5 shrink-0">
                <input
                  type="text"
                  value={customSelectionSearch}
                  onChange={(e) => onChangeSearch(e.target.value)}
                  placeholder={isDe ? 'Callouts durchsuchen...' : 'Search callouts...'}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-400"
                />
                <Crosshair className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                {customSelectionSearch && (
                  <button
                    type="button"
                    onClick={() => onChangeSearch('')}
                    className="absolute right-2.5 top-2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto max-h-[46vh] sm:max-h-[50vh] space-y-1.5 pr-1">
                {filteredCallouts.map((c) => {
                  const isAdded = tempSelectedCalloutIds.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (isAdded) {
                          onChangeTempSelectedIds((prev) => prev.filter((id) => id !== c.id));
                        } else {
                          onChangeTempSelectedIds((prev) => [...prev, c.id]);
                        }
                      }}
                      className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isAdded
                          ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-100 hover:bg-indigo-950/60'
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isAdded ? 'bg-indigo-400 ring-2 ring-indigo-400/30' : 'bg-zinc-600'
                          }`}
                        />
                        <div className="truncate">
                          <span className="text-xs font-bold block truncate">{c.name}</span>
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded border uppercase ${getZoneBadgeColor(
                              c.zone
                            )}`}
                          >
                            {c.zone.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 ml-2">
                        {isAdded ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangeTempSelectedIds((prev) => prev.filter((id) => id !== c.id));
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 transition-colors"
                            title={isDe ? 'Aus Auswahl entfernen' : 'Remove from selection'}
                          >
                            <Check className="w-3 h-3" />
                            <span>{isDe ? 'Ausgewählt' : 'Selected'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangeTempSelectedIds((prev) => [...prev, c.id]);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-indigo-600 text-zinc-300 hover:text-white transition-colors text-[11px] font-semibold cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{isDe ? 'Hinzufügen' : 'Add'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredCallouts.length === 0 && (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    {isDe ? 'Kein Callout gefunden.' : 'No callout found.'}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: MEINE AUSWAHL */}
            <div
              className={`flex flex-col bg-zinc-950/70 border border-indigo-900/40 rounded-xl p-3 sm:p-3.5 ${
                customSelectionTab !== 'selected' ? 'hidden md:flex' : 'flex'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-1.5">
                  <ListFilter className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                    {isDe ? 'Meine Auswahl' : 'My Selection'}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {tempSelectedCalloutIds.length}
                  </span>
                </div>
                {tempSelectedCalloutIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChangeTempSelectedIds([])}
                    className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    {isDe ? 'Alle entfernen' : 'Clear all'}
                  </button>
                )}
              </div>

              {tempSelectedCalloutIds.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-500 min-h-[200px]">
                  <ListFilter className="w-8 h-8 text-zinc-600 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-bold text-zinc-300 mb-1">
                    {isDe ? 'Noch keine Callouts in deiner Auswahl' : 'No callouts selected yet'}
                  </p>
                  <p className="text-[11px] text-zinc-400 max-w-xs mb-3">
                    {isDe
                      ? 'Klicke auf Callouts aus der linken Liste, um sie zu deiner eigenen Anzeige hinzuzufügen.'
                      : 'Click callouts from the left list to add them to your custom display.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onChangeTempSelectedIds(callouts.map((c) => c.id))}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isDe ? 'Alle Callouts übernehmen' : 'Add all callouts'}
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[50vh] sm:max-h-[55vh] space-y-1.5 pr-1">
                  {tempSelectedCalloutIds.map((id) => {
                    const callout = callouts.find((c) => c.id === id);
                    if (!callout) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-zinc-900/90 border border-indigo-500/30 text-zinc-100 hover:border-indigo-400 transition-all"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-bold truncate">{callout.name}</span>
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded border uppercase ${getZoneBadgeColor(
                              callout.zone
                            )}`}
                          >
                            {callout.zone.replace('_', ' ')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeTempSelectedIds((prev) => prev.filter((item) => item !== id))
                          }
                          className="p-1 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                          title={isDe ? 'Entfernen' : 'Remove'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3.5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 shrink-0">
          <div className="text-xs text-zinc-400 w-full sm:w-auto text-center sm:text-left">
            <span className="font-extrabold text-white">{tempSelectedCalloutIds.length}</span>{' '}
            {isDe
              ? `von ${callouts.length} Callouts in deiner Auswahl`
              : `of ${callouts.length} callouts selected`}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
            >
              {isDe ? 'Abbrechen' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => onApply(tempSelectedCalloutIds)}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isDe ? 'Auswahl anwenden & anzeigen' : 'Apply & Show Selection'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
