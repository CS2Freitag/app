import React, { useState, useMemo } from 'react';
import { Star, Plus, Edit2, ChevronRight, Layers, Upload, Download, Trash2 } from 'lucide-react';
import { MapData, Language } from '../types';
import { resolveAssetPath } from '../utils/assets';

interface MapGridProps {
  maps: MapData[];
  favorites: string[];
  onSelectMap: (map: MapData) => void;
  onToggleFavorite: (mapId: string, e: React.MouseEvent) => void;
  onEditMap: (map: MapData, e: React.MouseEvent) => void;
  onDeleteMap: (mapId: string) => void;
  onAddNewMap: () => void;
  onImportSingleMap?: () => void;
  onExportSingleMap?: (map: MapData, e: React.MouseEvent) => void;
  customGroups?: string[];
  lang: Language;
  filterQuery: string;
}

type CategoryFilter = 'all' | 'active' | 'reserve' | 'wingman' | 'hostage' | 'community' | string;

export const MapGrid: React.FC<MapGridProps> = ({
  maps,
  favorites,
  onSelectMap,
  onToggleFavorite,
  onEditMap,
  onDeleteMap,
  onAddNewMap,
  onImportSingleMap,
  onExportSingleMap,
  customGroups = [],
  lang,
  filterQuery,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const isDe = lang === 'de';

  // Filter and sort: prioritizing map name in search results
  const filteredAndSortedMaps = useMemo(() => {
    let list = [...maps];

    // Filter by category
    if (selectedCategory !== 'all') {
      list = list.filter((m) => m.category === selectedCategory);
    }

    // Filter by query if present
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.callouts.some(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.alternativeNames?.some((a) => a.toLowerCase().includes(q))
          )
      );

      // In der Suche wird der Name der Karten bevorzugt
      list.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === q;
        const bExact = bName === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        const aIncludes = aName.includes(q);
        const bIncludes = bName.includes(q);
        if (aIncludes && !bIncludes) return -1;
        if (!aIncludes && bIncludes) return 1;

        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    } else {
      // Sort alphabetically by name
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }

    return list;
  }, [maps, selectedCategory, filterQuery]);

  return (
    <section>
      {/* Category Filter Bar & Add Map Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        {/* Interactive Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 dark:bg-zinc-900 dark:border-zinc-800 light:bg-zinc-100 light:border-zinc-200 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950 light:bg-zinc-900 light:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white light:text-zinc-600 light:hover:text-zinc-950'
            }`}
          >
            {isDe ? 'Alle' : 'All'} ({maps.length})
          </button>
          <button
            onClick={() => setSelectedCategory('active')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'active'
                ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950 light:bg-zinc-900 light:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white light:text-zinc-600 light:hover:text-zinc-950'
            }`}
          >
            Active Duty
          </button>
          <button
            onClick={() => setSelectedCategory('reserve')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'reserve'
                ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950 light:bg-zinc-900 light:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white light:text-zinc-600 light:hover:text-zinc-950'
            }`}
          >
            Reserve Pool
          </button>
          <button
            onClick={() => setSelectedCategory('wingman')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'wingman'
                ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950 light:bg-zinc-900 light:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white light:text-zinc-600 light:hover:text-zinc-950'
            }`}
          >
            Wingman 2v2
          </button>
          <button
            onClick={() => setSelectedCategory('hostage')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'hostage'
                ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950 light:bg-zinc-900 light:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white light:text-zinc-600 light:hover:text-zinc-950'
            }`}
          >
            {isDe ? 'Hostage (Geiseln)' : 'Hostage'}
          </button>
          <button
            onClick={() => setSelectedCategory('community')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'community'
                ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950 light:bg-zinc-900 light:text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white light:text-zinc-600 light:hover:text-zinc-950'
            }`}
          >
            {isDe ? 'Eigene / Custom' : 'Custom'}
          </button>
          {customGroups.map((grp) => (
            <button
              key={grp}
              onClick={() => setSelectedCategory(grp)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedCategory === grp
                  ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-950 light:bg-zinc-900 light:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white light:text-zinc-600 light:hover:text-zinc-950'
              }`}
            >
              {grp}
            </button>
          ))}
        </div>

        {/* Actions: Add New Map & Import Map */}
        <div className="flex items-center gap-2 shrink-0">
          {onImportSingleMap && (
            <button
              onClick={onImportSingleMap}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 transition-all shadow-xs"
              title={isDe ? 'Einzelne Karte aus JSON-Datei importieren' : 'Import single map from JSON'}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isDe ? 'Karte importieren' : 'Import Map'}</span>
            </button>
          )}

          <button
            onClick={onAddNewMap}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white hover:border-zinc-500 transition-all shadow-xs dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 light:border-zinc-300 light:bg-white light:text-zinc-900 light:hover:bg-zinc-100"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isDe ? 'Neue Karte hinzufügen' : 'Add New Map'}</span>
          </button>
        </div>
      </div>

      {/* Alphabetical Grid of Map Buttons */}
      {filteredAndSortedMaps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-12 text-center text-zinc-400">
          <p className="text-sm font-medium">
            {isDe ? 'Keine Karten für diese Auswahl gefunden.' : 'No maps found matching criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedMaps.map((map) => {
            const isFav = favorites.includes(map.id);
            return (
              <div
                key={map.id}
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-800/90 light:border-zinc-300 bg-zinc-900/50 light:bg-white hover:bg-zinc-900 light:hover:bg-zinc-50 hover:border-zinc-600 light:hover:border-zinc-400 transition-all duration-200 overflow-hidden shadow-sm"
              >
                {/* Top preview & banner */}
                <div
                  onClick={() => onSelectMap(map)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMap(map);
                    }
                  }}
                  className="relative aspect-video w-full overflow-hidden bg-zinc-950 light:bg-zinc-200 cursor-pointer"
                >
                  <img
                    src={resolveAssetPath(map.image)}
                    alt={`${map.name} Overview`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 opacity-85 group-hover:opacity-100"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/icon.svg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-black/20" />

                  {/* Multi-level indicator if map has lower level */}
                  {map.lowerImage && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900/90 light:bg-white text-zinc-300 light:text-zinc-700 border border-zinc-700 light:border-zinc-300 backdrop-blur-xs">
                      <Layers className="w-3 h-3 text-zinc-400 light:text-zinc-500" />
                      <span>{isDe ? '2 Ebenen' : '2 Levels'}</span>
                    </div>
                  )}

                  {/* Favorite Star at top-right */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(map.id, e);
                    }}
                    className={`absolute top-2 right-2 p-2 rounded-lg backdrop-blur-md transition-all active:scale-90 ${
                      isFav
                        ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40 shadow-xs'
                        : 'bg-zinc-900/60 light:bg-zinc-100/80 text-zinc-400 light:text-zinc-600 hover:text-white light:hover:text-zinc-900 border border-zinc-700/60 light:border-zinc-300 hover:bg-zinc-800'
                    }`}
                    title={
                      isFav
                        ? isDe
                          ? 'Aus Favoriten entfernen'
                          : 'Remove from favorites'
                        : isDe
                        ? 'Zu Favoriten hinzufügen'
                        : 'Add to favorites'
                    }
                    aria-label="Toggle favorite"
                  >
                    <Star
                      className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 light:text-zinc-500'}`}
                    />
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-3.5 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-extrabold text-base text-zinc-100 light:text-zinc-950 group-hover:text-white transition-colors">
                        {map.name}
                      </h3>
                      <div className="flex items-center gap-1">
                        {onExportSingleMap && (
                          <button
                            type="button"
                            onClick={(e) => onExportSingleMap(map, e)}
                            className="p-1.5 rounded-md text-zinc-500 light:text-zinc-600 hover:text-sky-300 hover:bg-zinc-800/80 light:hover:bg-zinc-200 transition-colors"
                            title={isDe ? 'Diese Karte als JSON exportieren' : 'Export this map as JSON'}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                          <button
                            type="button"
                            onClick={(e) => onEditMap(map, e)}
                            className="p-1.5 rounded-md text-zinc-500 light:text-zinc-600 hover:text-zinc-200 light:hover:text-zinc-900 hover:bg-zinc-800/80 light:hover:bg-zinc-200 transition-colors"
                            title={isDe ? 'Karte bearbeiten / umbenennen' : 'Edit / rename map'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    <p className="text-xs text-zinc-400 light:text-zinc-600 line-clamp-2 mb-3">
                      {isDe ? map.descriptionDe : map.descriptionEn}
                    </p>
                  </div>

                  {/* Main Action Button for the Map */}
                  <div className="pt-2 border-t border-zinc-800/70 light:border-zinc-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-zinc-400 light:text-zinc-500">
                      {map.callouts.length} Callouts
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectMap(map)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-100 light:bg-zinc-900 text-zinc-950 light:text-white hover:bg-white light:hover:bg-zinc-800 transition-all shadow-xs group-hover:ring-2 group-hover:ring-zinc-400"
                    >
                      <span>{isDe ? 'Callouts Vollbild' : 'Fullscreen'}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
