import React, { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, ChevronRight } from 'lucide-react';
import { MapData, Callout, Language } from '../types';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  allMaps: MapData[];
  onSelectCalloutMatch: (map: MapData, calloutId: string) => void;
  onSelectMap?: (map: MapData) => void;
  lang: Language;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  allMaps,
  onSelectCalloutMatch,
  onSelectMap,
  lang,
}) => {
  const [isOpenSuggestions, setIsOpenSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDe = lang === 'de';

  const query = searchQuery.toLowerCase().trim();

  // 1. BEVORZUGT: Finde passende Karten zuerst
  const matchingMaps = React.useMemo(() => {
    if (!query || query.length < 2) return [];

    const maps = allMaps.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.slug.toLowerCase().includes(query)
    );

    // Sortiere: Exakter Name zuerst, dann beginnt mit Query, dann alphabetisch
    maps.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aExact = aName === query;
      const bExact = bName === query;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return maps.slice(0, 5);
  }, [query, allMaps]);

  // 2. Finde passende Callouts über alle Karten
  const matchingCallouts = React.useMemo(() => {
    if (!query || query.length < 2) return [];

    const results: { map: MapData; callout: Callout; priority: number }[] = [];

    for (const map of allMaps) {
      const mapNameMatches = map.name.toLowerCase().includes(query);

      for (const callout of map.callouts) {
        const matchesName = callout.name.toLowerCase().includes(query);
        const matchesAlt = callout.alternativeNames?.some((a) =>
          a.toLowerCase().includes(query)
        );
        const matchesDesc =
          callout.descriptionDe.toLowerCase().includes(query) ||
          callout.descriptionEn.toLowerCase().includes(query);

        if (matchesName || matchesAlt || matchesDesc) {
          // Priority ranking: Callout exact > Callout startsWith > Callout name includes > Map match
          let priority = 0;
          if (callout.name.toLowerCase() === query) priority = 10;
          else if (callout.name.toLowerCase().startsWith(query)) priority = 8;
          else if (matchesName) priority = 6;
          else if (mapNameMatches) priority = 4;
          else priority = 2;

          results.push({ map, callout, priority });
        }
      }
    }

    results.sort((a, b) => b.priority - a.priority);
    return results.slice(0, 6);
  }, [query, allMaps]);

  const hasResults = matchingMaps.length > 0 || matchingCallouts.length > 0;

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpenSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full mb-6">
      <div className="relative flex items-center">
        <div className="absolute left-3.5 pointer-events-none text-zinc-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpenSuggestions(true);
          }}
          onFocus={() => setIsOpenSuggestions(true)}
          placeholder={
            isDe
              ? 'Karte (bevorzugt) oder Callout suchen (z. B. Mirage, Dust II, Inferno, Banana)...'
              : 'Search map (preferred) or callout (e.g. Mirage, Dust II, Inferno, Banana)...'
          }
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-zinc-800 bg-zinc-900/90 text-sm text-zinc-100 placeholder-zinc-500 shadow-sm transition-all focus:outline-hidden focus:border-zinc-400 focus:ring-2 focus:ring-zinc-600/30 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-100 dark:placeholder-zinc-500 light:border-zinc-300 light:bg-white light:text-zinc-900 light:placeholder-zinc-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              setIsOpenSuggestions(false);
            }}
            className="absolute right-3 p-1 rounded-md text-zinc-400 hover:text-white transition-colors"
            title={isDe ? 'Suche leeren' : 'Clear search'}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Instant Results Dropdown (Maps prioritized first) */}
      {isOpenSuggestions && hasResults && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-zinc-800 light:border-zinc-300 bg-zinc-900/95 light:bg-white/95 shadow-2xl backdrop-blur-md overflow-hidden text-zinc-100 light:text-zinc-950 animate-in fade-in-50 duration-150">
          {/* 1. BEVORZUGT: KARTEN */}
          {matchingMaps.length > 0 && (
            <div>
              <div className="px-3.5 py-1.5 bg-zinc-950/70 light:bg-zinc-100 border-b border-zinc-800/80 light:border-zinc-300 flex items-center justify-between text-[11px] font-mono font-bold text-amber-400 uppercase">
                <span>{isDe ? '★ Gefundene Karten (Bevorzugt)' : '★ Matching Maps (Preferred)'}</span>
                <span>{matchingMaps.length} {isDe ? 'Karten' : 'maps'}</span>
              </div>
              <div className="divide-y divide-zinc-800/40 light:divide-zinc-200">
                {matchingMaps.map((map) => (
                  <button
                    key={`map-${map.id}`}
                    onClick={() => {
                      if (onSelectMap) {
                        onSelectMap(map);
                      } else {
                        onSelectCalloutMatch(map, map.callouts[0]?.id || '');
                      }
                      setIsOpenSuggestions(false);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-zinc-800/90 light:hover:bg-zinc-100 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={map.image}
                        alt={map.name}
                        className="w-10 h-7 rounded object-cover border border-zinc-700 light:border-zinc-300 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/icon.svg';
                        }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white light:text-zinc-950 group-hover:text-amber-300 transition-colors">
                            {map.name}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 light:bg-zinc-200 text-zinc-300 light:text-zinc-600 border border-zinc-700 light:border-zinc-300">
                            {map.category}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 light:text-zinc-600">
                          {map.callouts.length} Callouts · {isDe ? map.descriptionDe : map.descriptionEn}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold text-amber-400 group-hover:text-amber-300 shrink-0">
                      <span>{isDe ? 'Karte öffnen' : 'Open map'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. GEFUNDENE CALLOUTS */}
          {matchingCallouts.length > 0 && (
            <div>
              <div className="px-3.5 py-1.5 bg-zinc-950/70 light:bg-zinc-100 border-y border-zinc-800/80 light:border-zinc-300 flex items-center justify-between text-[11px] font-mono text-zinc-400 light:text-zinc-500 uppercase">
                <span>{isDe ? 'Taktische Positionen' : 'Tactical Callouts'}</span>
                <span>{matchingCallouts.length} {isDe ? 'Treffer' : 'results'}</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-zinc-800/40 light:divide-zinc-200">
                {matchingCallouts.map(({ map, callout }) => (
                  <button
                    key={`${map.id}-${callout.id}`}
                    onClick={() => {
                      onSelectCalloutMatch(map, callout.id);
                      setIsOpenSuggestions(false);
                    }}
                    className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-zinc-800/80 light:hover:bg-zinc-100 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-zinc-800 light:bg-zinc-200 border border-zinc-700 light:border-zinc-300 flex items-center justify-center text-zinc-300 light:text-zinc-600 group-hover:text-white light:group-hover:text-zinc-950 group-hover:border-zinc-500 transition-colors shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white light:text-zinc-950 group-hover:text-zinc-100">
                            {callout.name}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 light:bg-zinc-200 text-zinc-300 light:text-zinc-600 border border-zinc-700 light:border-zinc-300">
                            {map.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 light:text-zinc-600 line-clamp-1">
                          {isDe ? callout.descriptionDe : callout.descriptionEn}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-zinc-400 light:text-zinc-600 group-hover:text-zinc-200 light:group-hover:text-zinc-900 shrink-0">
                      <span className="hidden sm:inline text-[11px]">
                        {isDe ? 'Ansehen' : 'View'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
