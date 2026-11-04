import React, { useState, useRef } from 'react';
import { Star, ChevronRight, ChevronDown, GripVertical, Check, Layers } from 'lucide-react';
import { MapData, Language } from '../types';

interface FavoritesSectionProps {
  favoriteMaps: MapData[];
  onSelectMap: (map: MapData) => void;
  onToggleFavorite: (mapId: string, e: React.MouseEvent) => void;
  onReorderFavorites: (newFavoriteIds: string[]) => void;
  lang: Language;
}

export const FavoritesSection: React.FC<FavoritesSectionProps> = ({
  favoriteMaps,
  onSelectMap,
  onToggleFavorite,
  onReorderFavorites,
  lang,
}) => {
  const isDe = lang === 'de';

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isSortingMode, setIsSortingMode] = useState<boolean>(false);

  // Collapse state persisted in localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cs2freitag_fav_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cs2freitag_fav_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  if (favoriteMaps.length === 0) {
    return (
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <h2 className="text-sm font-bold tracking-wider uppercase text-zinc-300 dark:text-zinc-300 light:text-zinc-800">
            {isDe ? 'Favoriten' : 'Favorites'}
          </h2>
        </div>
        <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center dark:border-zinc-800 light:border-zinc-300">
          <p className="text-xs text-zinc-500 dark:text-zinc-500 light:text-zinc-600">
            {isDe
              ? 'Noch keine Favoriten festgelegt. Klicke auf den Stern (★) an einer Karte, um schnellen Zugriff zu erhalten.'
              : 'No favorites selected yet. Click the star icon (★) on any map card for 1-click tactical access.'}
          </p>
        </div>
      </section>
    );
  }

  // Reorder helper function
  const reorder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const currentIds = favoriteMaps.map((m) => m.id);
    const sourceIdx = currentIds.indexOf(sourceId);
    const targetIdx = currentIds.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const newIds = [...currentIds];
    const [removed] = newIds.splice(sourceIdx, 1);
    newIds.splice(targetIdx, 0, removed);

    onReorderFavorites(newIds);
  };

  // Long press handler start
  const handlePressStart = (mapId: string, clientX: number, clientY: number) => {
    isLongPressRef.current = false;
    touchStartPosRef.current = { x: clientX, y: clientY };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      setIsSortingMode(true);
      setDraggedId(mapId);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    }, 350);
  };

  // Long press cancel/clear
  const handlePressCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // HTML5 Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, mapId: string) => {
    e.dataTransfer.setData('text/plain', mapId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(mapId);
  };

  const handleDragOver = (e: React.DragEvent, mapId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== mapId) {
      setDragOverId(mapId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
    if (sourceId) {
      reorder(sourceId, targetId);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Touch Drag Handlers
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (dx > 8 || dy > 8) {
      if (!isLongPressRef.current) {
        handlePressCancel();
      }
    }

    if (draggedId && isSortingMode) {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      if (elem) {
        const cardElem = elem.closest('[data-favorite-id]') as HTMLElement | null;
        if (cardElem) {
          const targetId = cardElem.getAttribute('data-favorite-id');
          if (targetId && targetId !== draggedId) {
            reorder(draggedId, targetId);
          }
        }
      }
    }
  };

  const handleTouchEnd = () => {
    handlePressCancel();
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={toggleCollapse}
          className="flex items-center gap-2 group text-left cursor-pointer focus:outline-hidden"
          title={
            isCollapsed
              ? isDe
                ? 'Favoriten einblenden'
                : 'Expand favorites'
              : isDe
              ? 'Favoriten ausblenden'
              : 'Collapse favorites'
          }
        >
          <div className="p-1 rounded-md bg-zinc-800/80 group-hover:bg-zinc-700 text-amber-400 border border-zinc-700/80 transition-colors">
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isCollapsed ? '-rotate-90' : 'rotate-0'
              }`}
            />
          </div>
          <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
          <h2 className="text-sm font-bold tracking-wider uppercase text-zinc-200 group-hover:text-white transition-colors dark:text-zinc-200 light:text-zinc-800">
            {isDe ? 'Schnellzugriff Favoriten' : 'Quick Access Favorites'}
          </h2>
        </button>

        <div className="flex items-center gap-2">
          {!isCollapsed && favoriteMaps.length > 1 && (
            <button
              type="button"
              onClick={() => setIsSortingMode((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors border ${
                isSortingMode
                  ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold shadow-md'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80 hover:bg-zinc-700'
              }`}
              title={
                isDe
                  ? 'Gedrückt halten oder hier klicken zum Sortieren'
                  : 'Hold card or click to sort'
              }
            >
              {isSortingMode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-zinc-950" />
                  <span>{isDe ? 'Fertig' : 'Done'}</span>
                </>
              ) : (
                <>
                  <GripVertical className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">
                    {isDe ? 'Gedrückt halten zum Sortieren' : 'Hold to sort'}
                  </span>
                  <span className="sm:hidden">
                    {isDe ? 'Sortieren' : 'Sort'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {favoriteMaps.map((map) => {
            const isDraggingThis = draggedId === map.id;
            const isDragOverThis = dragOverId === map.id;

            return (
              <div
                key={map.id}
                data-favorite-id={map.id}
                draggable
                onDragStart={(e) => handleDragStart(e, map.id)}
                onDragOver={(e) => handleDragOver(e, map.id)}
                onDrop={(e) => handleDrop(e, map.id)}
                onDragEnd={handleDragEnd}
                onMouseDown={(e) => handlePressStart(map.id, e.clientX, e.clientY)}
                onMouseUp={handlePressCancel}
                onMouseLeave={handlePressCancel}
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  handlePressStart(map.id, touch.clientX, touch.clientY);
                }}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => {
                  if (isLongPressRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    isLongPressRef.current = false;
                    return;
                  }
                  if (!isSortingMode) {
                    onSelectMap(map);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMap(map);
                  }
                }}
                className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all shadow-md p-3 text-left select-none ${
                  isDraggingThis
                    ? 'opacity-40 border-amber-400 scale-95 ring-2 ring-amber-400/50'
                    : isDragOverThis
                    ? 'border-amber-400 bg-amber-400/10 scale-102 ring-2 ring-amber-400'
                    : isSortingMode
                    ? 'border-amber-400/60 bg-zinc-900/90 light:bg-zinc-100 animate-pulse cursor-grab active:cursor-grabbing'
                    : 'border-zinc-800 light:border-zinc-300 bg-zinc-900/60 light:bg-white hover:bg-zinc-800/80 light:hover:bg-zinc-100 hover:border-zinc-600'
                }`}
              >
                {/* Top row: Grip handle when sorting / Name & Favorite Star */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isSortingMode && (
                      <GripVertical className="w-4 h-4 text-amber-400 shrink-0 cursor-grab" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm text-zinc-100 light:text-zinc-950 group-hover:text-white transition-colors truncate">
                        {map.name}
                      </h3>
                      <span className="text-[11px] text-zinc-400 light:text-zinc-600">
                        {map.callouts.length} Callouts
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(map.id, e);
                    }}
                    className="p-1.5 rounded-md hover:bg-zinc-700/50 light:hover:bg-zinc-200 text-amber-400 transition-transform active:scale-90 shrink-0"
                    title={
                      isDe ? 'Aus Favoriten entfernen' : 'Remove from favorites'
                    }
                    aria-label="Remove favorite"
                  >
                    <Star className="w-4 h-4 fill-amber-400" />
                  </button>
                </div>

                {/* Radar Preview Thumbnail */}
                <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-zinc-950 light:bg-zinc-200 border border-zinc-800/80 light:border-zinc-300 flex items-center justify-center">
                  <img
                    src={map.image}
                    alt={`${map.name} Radar`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100 pointer-events-none"
                    loading="lazy"
                    draggable={false}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/icon.svg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent pointer-events-none" />
                  {map.lowerImage && (
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900/90 light:bg-white text-zinc-300 light:text-zinc-700 border border-zinc-800 light:border-zinc-300 backdrop-blur-xs pointer-events-none">
                      <Layers className="w-3 h-3 text-zinc-400 light:text-zinc-500" />
                      <span>{isDe ? '2 Ebenen' : '2 Levels'}</span>
                    </div>
                  )}
                  {isSortingMode && (
                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-900/90 light:bg-white text-zinc-300 light:text-zinc-700 border border-zinc-800 light:border-zinc-300 pointer-events-none">
                      <span>{isDe ? 'Ziehen' : 'Drag'}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
