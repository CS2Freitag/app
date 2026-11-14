import React from 'react';
import { History, Layers, X } from 'lucide-react';
import {
  Callout,
  ColorMode,
  DangerLevel,
  Language,
  PlayerToken,
  TacticLayer,
  TacticSnapshot,
  TacticalDrawingLine,
  UtilityMarker,
  ZoneType,
} from '../types';
import { TacticalLayersPanel, SelectedElementsPatch } from './TacticalLayersPanel';
import { TacticalHistoryPanel } from './TacticalHistoryPanel';

interface TacticalMobileSheetProps {
  isOpen: boolean;
  lang: Language;
  activeTab: 'layers' | 'history';
  onChangeTab: (tab: 'layers' | 'history') => void;
  onClose: () => void;

  layers: TacticLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onToggleLayerExpand: (id: string) => void;
  onAddLayer: (name: string, color: string) => void;
  onDeleteLayer: (id: string) => void;
  onUpdateLayerProps: (id: string, patch: Partial<TacticLayer>) => void;

  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  selectedElementIds: string[];
  onSelectElements: (ids: string[]) => void;
  onUpdateSelectedElementsProps: (patch: SelectedElementsPatch) => void;
  onDeleteElement: (id: string) => void;

  showAreas: boolean;
  onToggleShowAreas: () => void;
  showCalloutLabels: boolean;
  onToggleShowCalloutLabels: () => void;
  selectedCallout: Callout | null;
  onCloseCallout: () => void;
  colorMode: ColorMode;
  getZoneBadgeColor: (z: ZoneType) => string;
  getDangerBadge: (d: DangerLevel) => { label: string; classes: string; dot: string };

  snapshots: TacticSnapshot[];
  onSaveSnapshot: (customLabel?: string) => void;
  onRestoreSnapshot: (snap: TacticSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  onClearHistory: () => void;
  onOpenPngPreview: (snap: TacticSnapshot | null) => void;
  activeImage: string;
}

export const TacticalMobileSheet: React.FC<TacticalMobileSheetProps> = ({
  isOpen,
  lang,
  activeTab,
  onChangeTab,
  onClose,
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onToggleLayerExpand,
  onAddLayer,
  onDeleteLayer,
  onUpdateLayerProps,
  drawings,
  utilities,
  players,
  selectedElementIds,
  onSelectElements,
  onUpdateSelectedElementsProps,
  onDeleteElement,
  showAreas,
  onToggleShowAreas,
  showCalloutLabels,
  onToggleShowCalloutLabels,
  selectedCallout,
  onCloseCallout,
  colorMode,
  getZoneBadgeColor,
  getDangerBadge,
  snapshots,
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onClearHistory,
  onOpenPngPreview,
  activeImage,
}) => {
  if (!isOpen) return null;
  const isDe = lang === 'de';

  return (
    <div
      data-no-map-click="true"
      className="md:hidden fixed inset-0 z-50 flex flex-col justify-end print:hidden"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[1px]"
      />
      <div className="relative z-10 w-full max-h-[78vh] rounded-t-2xl border-t border-zinc-700 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden">
        {/* Sheet Drag Handle & Tab Switcher */}
        <div className="px-3 pt-2 pb-2 border-b border-zinc-800 flex flex-col gap-2 shrink-0 bg-zinc-900/90">
          <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              <button
                type="button"
                onClick={() => onChangeTab('layers')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                  activeTab === 'layers'
                    ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isDe ? 'Ebenen & Info' : 'Layers & Info'}</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeTab('history')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                  activeTab === 'history'
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>{isDe ? 'Verlauf' : 'History'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              title={isDe ? 'Schließen' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'layers' ? (
            <TacticalLayersPanel
              lang={lang}
              layers={layers}
              activeLayerId={activeLayerId}
              onSelectLayer={onSelectLayer}
              onToggleLayerVisibility={onToggleLayerVisibility}
              onToggleLayerLock={onToggleLayerLock}
              onToggleLayerExpand={onToggleLayerExpand}
              onAddLayer={onAddLayer}
              onDeleteLayer={onDeleteLayer}
              onUpdateLayerProps={onUpdateLayerProps}
              drawings={drawings}
              utilities={utilities}
              players={players}
              selectedElementIds={selectedElementIds}
              onSelectElements={onSelectElements}
              onUpdateSelectedElementsProps={onUpdateSelectedElementsProps}
              onDeleteElement={onDeleteElement}
              showAreas={showAreas}
              onToggleShowAreas={onToggleShowAreas}
              showCalloutLabels={showCalloutLabels}
              onToggleShowCalloutLabels={onToggleShowCalloutLabels}
              selectedCallout={selectedCallout}
              onCloseCallout={onCloseCallout}
              colorMode={colorMode}
              getZoneBadgeColor={getZoneBadgeColor}
              getDangerBadge={getDangerBadge}
            />
          ) : (
            <TacticalHistoryPanel
              lang={lang}
              snapshots={snapshots}
              isExpanded={true}
              onToggleExpand={() => {}}
              onSaveSnapshot={onSaveSnapshot}
              onRestoreSnapshot={onRestoreSnapshot}
              onDeleteSnapshot={onDeleteSnapshot}
              onClearHistory={onClearHistory}
              onOpenPngPreview={onOpenPngPreview}
              drawings={drawings}
              utilities={utilities}
              players={players}
              mapImage={activeImage}
              isEmbeddedMobile={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};
