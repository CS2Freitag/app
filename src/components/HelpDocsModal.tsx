import React, { useState } from 'react';
import {
  X,
  HelpCircle,
  Layers,
  MousePointer2,
  ListFilter,
  Volume2,
  History,
  Palette,
  Sparkles,
  Maximize2,
  MapPin,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Language } from '../types';
import { resolveAssetPath } from '../utils/assets';

interface HelpDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const HelpDocsModal: React.FC<HelpDocsModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';
  const [enlargedImage, setEnlargedImage] = useState<{ src: string; title: string; subtitle: string } | null>(null);

  const galleryImages = [
    {
      src: resolveAssetPath('bild4.png'),
      title: isDe ? 'Taktik-Board & Radar' : 'Tactical Board & Radar',
      subtitle: isDe
        ? 'Interaktive Karte mit Callouts, Zonen, Linien, Pfeilen und Utility-Granaten'
        : 'Interactive map with callouts, zones, arrows and utility grenades',
      tag: isDe ? 'Bild 1: Editor' : 'Fig 1: Editor',
    },
    {
      src: resolveAssetPath('bild1.png'),
      title: isDe ? 'Karten-Pool & Favoriten' : 'Map Pool & Favorites',
      subtitle: isDe
        ? 'Schnellzugriff auf alle CS2-Maps, Active-Duty-Pool und eigene Taktiken'
        : 'Quick access to all CS2 maps, active duty pool and custom tactics',
      tag: isDe ? 'Bild 2: Übersicht' : 'Fig 2: Pool',
    },
    {
      src: resolveAssetPath('bild6.png'),
      title: isDe ? 'Bereichs- & Polygon-Tool' : 'Area & Polygon Tool',
      subtitle: isDe
        ? 'Präzise Zonen mit Polygon-Punkten, Farbauswahl und Drehregler'
        : 'Precise zones with polygon points, color swatches and rotation',
      tag: isDe ? 'Bild 3: Bereiche' : 'Fig 3: Areas',
    },
    {
      src: resolveAssetPath('bild5.png'),
      title: isDe ? 'Bearbeitungs-Modi' : 'Editing Modes',
      subtitle: isDe
        ? 'Alles bearbeiten, fokussierte Einzel-Bearbeitung oder neue Callouts anlegen'
        : 'Edit all, single focus edit, or create new callouts',
      tag: isDe ? 'Bild 4: Bearbeiten' : 'Fig 4: Modes',
    },
    {
      src: resolveAssetPath('bild3.png'),
      title: isDe ? 'Quiz, Cloud & Backup' : 'Quiz, Cloud & Backup',
      subtitle: isDe
        ? 'Callout-Trainer / Lern-Quiz, Google-Cloud-Sync und ZIP-Export'
        : 'Callout quiz trainer, Google cloud sync and ZIP exports',
      tag: isDe ? 'Bild 5: Training' : 'Fig 5: Training',
    },
    {
      src: resolveAssetPath('bild2.png'),
      title: isDe ? 'PWA & Offline-App' : 'PWA & Offline App',
      subtitle: isDe
        ? 'Als App auf Windows, Android oder iPhone installieren mit Autosave'
        : 'Install as app on Windows, Android or iOS with autosave',
      tag: isDe ? 'Bild 6: Installation' : 'Fig 6: PWA',
    },
  ];

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 print:hidden animate-in fade-in"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-4 sm:p-6 shadow-2xl text-zinc-100 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <h2 className="text-lg font-black text-white">
                  {isDe ? 'Hilfe & App-Übersicht' : 'Help & App Overview'}
                </h2>
                <p className="text-xs text-zinc-400">
                  {isDe
                    ? 'Funktionen, Bilder und Erklärungen aller Werkzeuge'
                    : 'Features, screenshots and explanations for all tools'}
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

          <div className="space-y-4 text-xs">
            {/* EINLEITUNG: CS2FREIFAG + UMFASSENDE BILD-GALERIE */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 border border-amber-500/40 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                <div className="flex items-center gap-2 font-black text-amber-400 text-base sm:text-lg tracking-wide">
                  <Sparkles className="w-5 h-5 shrink-0 text-amber-400" />
                  <span>CS2FREIFAG</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold">
                  {isDe ? 'Taktik-Board & Callout-Atlas' : 'Tactics & Atlas'}
                </span>
              </div>

              <p className="text-zinc-200 leading-relaxed text-xs sm:text-[13px]">
                {isDe
                  ? 'CS2Freitag Tactical Map ist dein interaktives Taktik-Board und Callout-Nachschlagewerk für Counter-Strike 2. Du kannst alle Map-Callouts samt Beschreibungen & Sprachausgabe lernen, dein Wissen im interaktiven Quiz trainieren, eigene Setups mit Laufwegen, Pfeilen, Granaten (Utilitys) und T/CT-Positionen einzeichnen, alles sauber in Ebenen organisieren und direkt als hochauflösendes PNG-Bild oder Link mit deinem Team teilen.'
                  : 'CS2Freitag Tactical Map is your interactive Counter-Strike 2 tactics board and callout guide. Learn map callouts with descriptions & voice playback, practice in the interactive quiz, draw strategies with paths, arrows, utilities and player tokens, organize layers, and share via high-res PNG or link.'}
              </p>

              {/* Bild-Galerie: 6 detaillierte Screenshots der App */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                  <span>{isDe ? 'Bilder der App (Antippen zum Vergrößern):' : 'App Screenshots (Tap to enlarge):'}</span>
                  <span className="text-amber-400 font-mono text-[10px]">6 Screenshots</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {galleryImages.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => setEnlargedImage(img)}
                      className="group rounded-xl overflow-hidden border border-zinc-800 hover:border-amber-400/70 bg-zinc-950 flex flex-col cursor-pointer transition-all hover:shadow-xl hover:shadow-amber-500/5 hover:-translate-y-0.5"
                    >
                      <div className="relative h-32 sm:h-36 bg-zinc-900 overflow-hidden">
                        <img
                          src={img.src}
                          alt={img.title}
                          className="w-full h-full object-cover object-top opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-70 group-hover:opacity-40 transition-opacity" />
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-zinc-950/90 border border-zinc-700 group-hover:border-amber-400 text-[10px] font-mono font-bold text-amber-300">
                          {img.tag}
                        </span>
                        <div className="absolute top-2 right-2 p-1 rounded-md bg-zinc-950/80 text-zinc-400 group-hover:text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="p-2.5 border-t border-zinc-800/80 flex-1 flex flex-col justify-between">
                        <div className="font-bold text-zinc-100 text-xs group-hover:text-amber-300 transition-colors">
                          {img.title}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                          {img.subtitle}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 1. Ebenen */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sky-400 text-sm">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>{isDe ? '1. Ebenen' : '1. Layers'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-sky-300 font-semibold">
                    CT
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold">
                    T-Rush
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold">
                    Utility
                  </span>
                </div>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Ebenen (Layers) trennen deine Taktik in saubere Schichten (z. B. CT-Setups, T-Rush, Granaten, Retake oder frei erstellte Ebenen). Jede Ebene lässt sich über das Auge-Symbol ein-/ausblenden, per Schloss vor versehentlichem Verschieben sperren, in der Deckkraft regeln und mit einer eigenen Farbe versehen.'
                  : 'Layers split your tactic into clean tiers (CT, T, Utility, Retake, or custom). Toggle visibility, lock against edits, adjust opacity, or change layer colors.'}
              </p>
            </div>

            {/* 2. Mehrere Bereiche markieren */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                <MousePointer2 className="w-4 h-4 shrink-0" />
                <span>{isDe ? '2. Mehrere Bereiche markieren' : '2. Select Multiple Areas'}</span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <p className="text-zinc-300 leading-relaxed">
                    {isDe
                      ? 'Halte Strg/Shift beim Klicken gedrückt oder ziehe mit dem Werkzeug „Bereich“ (Marquee) ein Auswahlrechteck um mehrere Callouts, Linien, Pfeile oder Utilitys.'
                      : 'Hold Ctrl/Shift while clicking or drag with the Area Box tool to select multiple callouts, lines, arrows, or utilities.'}
                  </p>
                  <p className="text-zinc-400 leading-relaxed text-[11px]">
                    {isDe
                      ? 'In der schwebenden Kontextleiste oben kannst du alle gewählten Objekte mit einem Klick gruppieren, duplizieren, sperren, gemeinsam umfärben oder löschen.'
                      : 'Use the floating action bar to group, duplicate, lock, recolor, or delete all selected items together.'}
                  </p>
                </div>
                <div
                  onClick={() =>
                    setEnlargedImage({
                      src: resolveAssetPath('bild6.png'),
                      title: isDe ? 'Bereichs-Markierung & Toolbar' : 'Area Selection & Toolbar',
                      subtitle: isDe ? 'Aktionsleiste für markierte Bereiche und Callouts' : 'Action bar for areas and callouts',
                    })
                  }
                  className="w-full sm:w-44 h-24 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 shrink-0 cursor-pointer group relative shadow-md"
                >
                  <img
                    src={resolveAssetPath('bild6.png')}
                    alt="Bereich markieren"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors flex items-center justify-center">
                    <span className="px-2 py-0.5 rounded bg-zinc-950/90 text-amber-300 text-[10px] font-bold border border-zinc-700">
                      {isDe ? 'Bild vergrößern' : 'Zoom'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Meine Callout-Auswahl */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-indigo-400 text-sm">
                <ListFilter className="w-4 h-4 shrink-0" />
                <span>{isDe ? '3. Meine Callout-Auswahl' : '3. My Callout Selection'}</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Über das Filter-Symbol oben in der Leiste (auf PC und Smartphone) aktivierst du deine persönliche Auswahl. So werden nur deine wichtigsten Callouts und Spots auf der Map eingeblendet, damit der Radar aufgeräumt und übersichtlich bleibt.'
                  : 'Use the filter icon in the top bar (PC & mobile) to pick only your preferred callouts and keep the radar clean.'}
              </p>
            </div>

            {/* 4. Callout-Beschreibung & Sprachausgabe */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                <Volume2 className="w-4 h-4 shrink-0" />
                <span>{isDe ? '4. Callout-Beschreibung & Sprachausgabe' : '4. Descriptions & Voice Output'}</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Klicke auf ein Callout, um Beschreibung, typische Winkel und taktische Hinweise zu öffnen. Über das Lautsprecher-Symbol liest dir die App den Text direkt flüssig per Sprachausgabe (TTS) vor – ideal zum Einprägen während des Trainings.'
                  : 'Click any callout to view its description, angles, and tips. Tap the speaker icon to hear it read aloud with text-to-speech.'}
              </p>
            </div>

            {/* 5. Karten-Verlauf & PNG-Vorschau */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-purple-400 text-sm">
                <History className="w-4 h-4 shrink-0" />
                <span>{isDe ? '5. Karten-Verlauf & PNG-Vorschau' : '5. Map History & PNG Preview'}</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Im Bereich „Verlauf“ (unten auf dem PC bzw. im Tab „Verlauf“ auf dem Smartphone) werden bis zu 5 Stände deiner Karte mit Zeitstempel gesichert. Dort gibt es für jeden Stand eine visuelle Radar-Vorschau sowie den Knopf „Vorschau-Bild (PNG)“, um die komplette Taktik inklusive aller gezeichneten Linien, Granaten und Spieler als Bild zu betrachten und herunterzuladen.'
                  : 'Map History stores up to 5 snapshots with mini radar previews and a "Preview Image (PNG)" button showing all lines, utilities, and players.'}
              </p>
            </div>

            {/* 6. Eigene Farben & Farblegende */}
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                <Palette className="w-4 h-4 shrink-0" />
                <span>{isDe ? '6. Eigene Farben & Zonen-Legende' : '6. Custom Colors & Zone Legend'}</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {isDe
                  ? 'Über den Knopf „Eigene“ / „Eigene Farbe...“ kannst du aus über 30 vordefinierten Taktik-Farben oder einem beliebigen HEX-Farbcode wählen. In der oberen Menüleiste schaltest du zusätzlich zwischen Zonen-Farben (A-Site, B-Site, Mid, Spawns) und Gefahrenstufen (Hoch, Mittel, Gering) um.'
                  : 'Click "Custom" or "Custom Color..." to pick from 30+ colors or any HEX code. Switch between Zone Colors and Danger Levels in the top bar.'}
              </p>

              {/* Kompakte Farblegende */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 text-[10px]">
                <div className="flex items-center gap-2 p-1.5 rounded bg-zinc-900 border border-zinc-800">
                  <span className="w-3 h-3 rounded-sm bg-red-500/70 border border-red-400 shrink-0" />
                  <span className="text-zinc-200 font-semibold">A / B Site (Spot)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-zinc-900 border border-zinc-800">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-zinc-200 font-semibold">Middle</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-zinc-900 border border-zinc-800">
                  <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0" />
                  <span className="text-zinc-200 font-semibold">CT-Spawn</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-zinc-900 border border-zinc-800">
                  <span className="w-3 h-3 rounded-full bg-amber-700 shrink-0" />
                  <span className="text-zinc-200 font-semibold">T-Spawn</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-zinc-900 border border-zinc-800">
                  <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                  <span className="text-zinc-200 font-semibold">{isDe ? 'Gefahr: Hoch' : 'Danger: High'}</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-zinc-900 border border-zinc-800">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-zinc-200 font-semibold">{isDe ? 'Gefahr: Mittel' : 'Danger: Med'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-zinc-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              {isDe ? 'Verstanden' : 'Got it'}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal für vergrößerte Screenshot-Ansicht */}
      {enlargedImage && (
        <div
          onClick={() => setEnlargedImage(null)}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 print:hidden animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white">{enlargedImage.title}</h3>
                <p className="text-xs text-zinc-400">{enlargedImage.subtitle}</p>
              </div>
              <button
                onClick={() => setEnlargedImage(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-auto max-h-[70vh] bg-zinc-900/60 rounded-xl p-2 border border-zinc-800">
              <img
                src={enlargedImage.src}
                alt={enlargedImage.title}
                className="max-w-full max-h-[66vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setEnlargedImage(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
              >
                {isDe ? 'Schließen' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
