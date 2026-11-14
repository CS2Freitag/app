import React from 'react';
import { HelpCircle, X } from 'lucide-react';
import { ColorMode, Language } from '../types';

interface TacticalLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  colorMode: ColorMode;
}

export const TacticalLegendModal: React.FC<TacticalLegendModalProps> = ({
  isOpen,
  onClose,
  lang,
  colorMode,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 print:hidden"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6 shadow-2xl text-zinc-100"
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              {isDe ? 'Kurzhilfe & Farblegende' : 'Quick Help & Color Legend'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 text-xs">
          <div>
            <h4 className="font-mono uppercase font-bold text-sky-400 mb-2">
              {isDe ? 'Funktionen kurz erklärt' : 'Features Overview'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-zinc-950/75 border border-zinc-800 space-y-1">
                <div className="font-bold text-zinc-100">
                  {isDe ? 'Werkzeuge & Seitenleisten' : 'Tools & Sidebars'}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {isDe
                    ? 'Auswählen, Bereich (Rahmen ziehen), Linie, Pfeil, Radierer, Utility (Granaten) und T/CT-Spieler. Leisten lassen sich links & rechts über das Panel-Symbol ein-/ausblenden.'
                    : 'Select, Area Box, Line, Arrow, Eraser, Utility grenades and T/CT tokens. Sidebars toggle via the panel icons.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/75 border border-zinc-800 space-y-1">
                <div className="font-bold text-zinc-100">
                  {isDe ? 'Mehrfachauswahl & Rechtsklick' : 'Multi-Select & Right-Click'}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {isDe
                    ? 'Mehrere Callouts/Elemente per Strg+Klick oder Bereich-Werkzeug markieren. Rechtsklick öffnet Gruppieren, Duplizieren (Strg+D), Sperren, Umfärben & Löschen.'
                    : 'Select multiple items with Ctrl+Click or Area Box. Right-click opens Group, Duplicate (Ctrl+D), Lock, Color & Delete.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/75 border border-zinc-800 space-y-1">
                <div className="font-bold text-zinc-100">
                  {isDe ? 'Callouts bearbeiten (Stift)' : 'Edit Callouts (Pencil)'}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {isDe
                    ? 'In „Alle bearbeiten“ bleibt die Leiste versteckt, bis du ein Callout anklickst oder per Rechtsklick drehst, verschiebst, bearbeitest oder löschst.'
                    : 'In Edit All mode, the action bar stays hidden until you click or right-click a callout.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/75 border border-zinc-800 space-y-1">
                <div className="font-bold text-zinc-100">
                  {isDe ? 'Ebenen, Verlauf & Vollbild' : 'Layers, History & Fullscreen'}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {isDe
                    ? 'Rechts Ebenen & Infos verwalten, unten Bereiche, Raster, Zoom, Fit & den Karten-Verlauf (max. 5 Stände mit PNG-Vorschau) steuern. Vollbild maximiert nur die Karte.'
                    : 'Manage layers on the right; control Areas, Grid, Zoom, Fit & Map History (last 5 snapshots with PNG preview) at the bottom. Fullscreen maximizes the map only.'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 space-y-3">
            <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-zinc-200">
                {isDe ? 'Aktiver Farbmodus:' : 'Active Color Mode:'}{' '}
                <span className="text-amber-400 uppercase font-mono">
                  {colorMode === 'zone'
                    ? isDe
                      ? 'Zonen-Farben (A/B/Mid/Spawns)'
                      : 'Zone Colors'
                    : isDe
                    ? 'Gefahrenstufen (Hoch/Mittel/Gering)'
                    : 'Danger Levels'}
                </span>
              </div>
              <span className="text-zinc-400 text-[11px]">
                {isDe
                  ? 'Umschaltbar über Palette / Schild oben.'
                  : 'Switch via Palette / Shield in top bar.'}
              </span>
            </div>

            <div>
              <h4 className="font-mono uppercase font-bold text-zinc-400 mb-2">
                {isDe ? '1. Zonen & Bombenplätze (Zonen-Modus)' : '1. Map Zones (Zone Mode)'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-950/70 border border-zinc-800 col-span-1 sm:col-span-2">
                  <span
                    className="w-5 h-5 rounded-sm border border-red-500 shrink-0 shadow-xs"
                    style={{
                      background: 'rgba(239, 68, 68, 0.25)',
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.6) 0px, rgba(239, 68, 68, 0.6) 4px, transparent 4px, transparent 8px)',
                    }}
                  />
                  <div>
                    <div className="font-bold text-red-300">Bombenplätze (A-Site & B-Site)</div>
                    <div className="text-zinc-400 text-[10px]">Rote quere Streifen (Spot-Areal für C4)</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 border border-black shrink-0" />
                  <div>
                    <div className="font-bold text-emerald-300">Middle (Grün)</div>
                    <div className="text-zinc-400 text-[10px]">Mitte & Rotationskorridore</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-800 border border-black shrink-0" />
                  <div>
                    <div className="font-bold text-amber-300">T-Spawn (Braun)</div>
                    <div className="text-zinc-400 text-[10px]">Terroristen-Startbasis</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                  <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-black shrink-0" />
                  <div>
                    <div className="font-bold text-blue-300">CT-Spawn (Blau)</div>
                    <div className="text-zinc-400 text-[10px]">Antiterror-Startbasis</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                  <span className="w-3.5 h-3.5 rounded-full bg-zinc-200 border border-black shrink-0" />
                  <div>
                    <div className="font-bold text-zinc-300">Sonstige (Grau/Weiß)</div>
                    <div className="text-zinc-400 text-[10px]">Flanken & Außenbereiche</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-mono uppercase font-bold text-zinc-400 mb-2">
                {isDe ? '2. Gefahrenstufen (Gefahren-Modus)' : '2. Danger Levels (Danger Mode)'}
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 text-center">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mb-1" />
                  <div className="font-bold text-red-300 text-[11px]">{isDe ? 'Hoch (Rot)' : 'High (Red)'}</div>
                  <div className="text-[10px] text-zinc-400">{isDe ? 'Duell-Hotspot' : 'Hotspot duel'}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-center">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mb-1" />
                  <div className="font-bold text-amber-300 text-[11px]">{isDe ? 'Mittel (Gelb)' : 'Medium'}</div>
                  <div className="text-[10px] text-zinc-400">{isDe ? 'Flankenroute' : 'Flank lane'}</div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-center">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mb-1" />
                  <div className="font-bold text-emerald-300 text-[11px]">{isDe ? 'Gering (Grün)' : 'Low'}</div>
                  <div className="text-[10px] text-zinc-400">{isDe ? 'Sichere Zone' : 'Safe hold'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors cursor-pointer"
        >
          {isDe ? 'Schließen' : 'Close'}
        </button>
      </div>
    </div>
  );
};
