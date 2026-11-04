import React, { useState } from 'react';
import { X, Upload, Trash2, Image as ImageIcon, Plus, Check, FolderCog, Layers, Shield, Crosshair, Users, Zap, Sparkles } from 'lucide-react';
import { MapData, MapCategory, Language } from '../types';

interface MapEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapToEdit?: MapData | null;
  onSaveMap: (map: MapData) => void;
  onDeleteMap?: (mapId: string) => void;
  customGroups?: string[];
  onAddCustomGroup?: (groupName: string) => void;
  onDeleteCustomGroup?: (groupName: string) => void;
  lang: Language;
}

export const MapEditorModal: React.FC<MapEditorModalProps> = ({
  isOpen,
  onClose,
  mapToEdit,
  onSaveMap,
  onDeleteMap,
  customGroups = [],
  onAddCustomGroup,
  onDeleteCustomGroup,
  lang,
}) => {
  const isDe = lang === 'de';

  const [name, setName] = useState(mapToEdit?.name || '');
  const [category, setCategory] = useState<MapCategory>(
    mapToEdit?.category || 'community'
  );
  const [descriptionDe, setDescriptionDe] = useState(mapToEdit?.descriptionDe || '');
  const [descriptionEn, setDescriptionEn] = useState(mapToEdit?.descriptionEn || '');
  const [imageUrl, setImageUrl] = useState(mapToEdit?.image || '/maps/mirage.png');
  const [lowerImageUrl, setLowerImageUrl] = useState<string | undefined>(mapToEdit?.lowerImage);
  const [hasLowerImage, setHasLowerImage] = useState<boolean>(Boolean(mapToEdit?.lowerImage));
  const [previewError, setPreviewError] = useState(false);
  const [lowerPreviewError, setLowerPreviewError] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupError, setGroupError] = useState<string | null>(null);

  // Sync state if mapToEdit changes
  React.useEffect(() => {
    if (mapToEdit) {
      setName(mapToEdit.name);
      setCategory(mapToEdit.category);
      setDescriptionDe(mapToEdit.descriptionDe);
      setDescriptionEn(mapToEdit.descriptionEn);
      setImageUrl(mapToEdit.image);
      setLowerImageUrl(mapToEdit.lowerImage);
      setHasLowerImage(Boolean(mapToEdit.lowerImage));
    } else {
      setName('');
      setCategory('community');
      setDescriptionDe('');
      setDescriptionEn('');
      setImageUrl('/maps/mirage.png');
      setLowerImageUrl(undefined);
      setHasLowerImage(false);
    }
    setPreviewError(false);
    setLowerPreviewError(false);
  }, [mapToEdit, isOpen]);

  if (!isOpen) return null;

  // Handle local file upload (Upper / Main)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result as string;
      if (result) {
        setImageUrl(result);
        setPreviewError(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle local file upload (Lower U)
  const handleLowerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result as string;
      if (result) {
        setLowerImageUrl(result);
        setHasLowerImage(true);
        setLowerPreviewError(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newMap: MapData = {
      id: mapToEdit?.id || `custom_${Date.now()}`,
      name: name.trim(),
      slug: mapToEdit?.slug || name.toLowerCase().replace(/\s+/g, '_'),
      category,
      image: imageUrl,
      lowerImage: hasLowerImage && lowerImageUrl ? lowerImageUrl : undefined,
      descriptionDe: descriptionDe.trim() || `${name.trim()} - Eigene taktische Karte`,
      descriptionEn: descriptionEn.trim() || `${name.trim()} - Custom tactical map`,
      callouts: mapToEdit?.callouts || [],
      isCustom: mapToEdit ? mapToEdit.isCustom : true,
    };

    onSaveMap(newMap);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-zinc-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {mapToEdit
                  ? isDe
                    ? `Karte bearbeiten: ${mapToEdit.name}`
                    : `Edit Map: ${mapToEdit.name}`
                  : isDe
                  ? 'Neue CS2 Karte anlegen'
                  : 'Add New CS2 Map'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isDe
                  ? 'Namen anpassen, Bild hochladen oder Kategorie ändern'
                  : 'Customize title, upload custom radar image, or change category'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              {isDe ? 'Kartenname' : 'Map Name'} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Cache, Tuscan, Cobblestone..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-zinc-400"
            />
          </div>

          {/* KARTEN-POOL & EIGENE GRUPPEN */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">
                <FolderCog className="w-4 h-4 text-amber-400" />
                <span>{isDe ? 'Karten-Pool & Gruppierung' : 'Map Pool & Category'}</span>
              </label>
              <span className="text-[11px] font-mono text-amber-400 font-bold uppercase">
                {category}
              </span>
            </div>

            {/* 1. Standard Pools */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'active', label: 'Active Duty', icon: <Crosshair className="w-3.5 h-3.5 text-amber-400" /> },
                { id: 'reserve', label: 'Reserve Pool', icon: <Shield className="w-3.5 h-3.5 text-sky-400" /> },
                { id: 'wingman', label: 'Wingman 2v2', icon: <Zap className="w-3.5 h-3.5 text-emerald-400" /> },
                { id: 'hostage', label: isDe ? 'Hostage (Geiseln)' : 'Hostage', icon: <Users className="w-3.5 h-3.5 text-purple-400" /> },
                { id: 'community', label: isDe ? 'Eigene / Custom' : 'Custom', icon: <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> },
              ].map((p) => {
                const isSelected = category === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCategory(p.id)}
                    className={`flex items-center justify-between py-2 px-2.5 text-xs font-semibold rounded-lg border transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/15 text-white ring-1 ring-amber-400/50 shadow-xs'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {p.icon}
                      <span className="truncate">{p.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>

            {/* 2. Eigene Gruppen */}
            {customGroups.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                <span className="text-[11px] font-mono text-zinc-400 uppercase font-semibold">
                  {isDe ? 'Eigene Gruppen:' : 'Custom Groups:'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {customGroups.map((grp) => {
                    const isSelected = category === grp;
                    return (
                      <div
                        key={grp}
                        className={`flex items-center justify-between py-1.5 px-2.5 text-xs font-semibold rounded-lg border transition-all ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/15 text-white ring-1 ring-amber-400/50'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setCategory(grp)}
                          className="flex items-center gap-1.5 truncate flex-1 text-left"
                        >
                          <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{grp}</span>
                        </button>
                        {onDeleteCustomGroup && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(isDe ? `Gruppe "${grp}" löschen?` : `Delete group "${grp}"?`)) {
                                onDeleteCustomGroup(grp);
                                if (category === grp) setCategory('community');
                              }
                            }}
                            className="p-0.5 text-zinc-500 hover:text-red-400 transition-colors ml-1"
                            title={isDe ? 'Gruppe löschen' : 'Delete group'}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Neue Gruppe anlegen */}
            <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-1.5">
              <span className="text-[11px] font-mono text-zinc-400 font-semibold uppercase">
                {isDe ? '+ Neue Gruppe anlegen:' : '+ Add New Custom Group:'}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={isDe ? 'z. B. Turnier 2026, Aim Maps, Team-Strat...' : 'e.g. Tournament, Aim Maps...'}
                  value={newGroupName}
                  onChange={(e) => {
                    setNewGroupName(e.target.value);
                    setGroupError(null);
                  }}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-white focus:outline-hidden focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newGroupName.trim();
                    if (!trimmed) return;
                    if (
                      ['active', 'reserve', 'wingman', 'hostage', 'community'].includes(trimmed.toLowerCase()) ||
                      customGroups.some((g) => g.toLowerCase() === trimmed.toLowerCase())
                    ) {
                      setGroupError(isDe ? 'Diese Gruppe existiert bereits!' : 'Group already exists!');
                      return;
                    }
                    if (onAddCustomGroup) {
                      onAddCustomGroup(trimmed);
                    }
                    setCategory(trimmed);
                    setNewGroupName('');
                    setGroupError(null);
                  }}
                  disabled={!newGroupName.trim()}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Gruppe anlegen' : 'Add Group'}</span>
                </button>
              </div>
              {groupError && <p className="text-[11px] text-red-400">{groupError}</p>}
            </div>
          </div>

          {/* 1. Hauptkarte / Obere Ebene (O) Radar */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              {isDe ? 'Hauptkarte / Obere Ebene (O) Radar *' : 'Main Radar Map / Upper Floor (O) *'}
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-zinc-700 bg-zinc-950 hover:bg-zinc-800 hover:border-zinc-500 cursor-pointer transition-colors text-xs text-zinc-300 font-medium">
                <Upload className="w-4 h-4 text-zinc-400" />
                <span>{isDe ? 'Bild für Ebene O (Oben) wählen...' : 'Choose image for Upper level (O)...'}</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
            {/* Vorschau Ebene O */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center">
              {!previewError ? (
                <img
                  src={imageUrl}
                  alt="Upper Radar Preview"
                  className="w-full h-full object-contain"
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <div className="text-xs text-zinc-500">
                  {isDe ? 'Bild (Ebene O) konnte nicht geladen werden' : 'Image (Floor O) could not be loaded'}
                </div>
              )}
            </div>
          </div>

          {/* 2. Optionale Zweite Ebene Unten (U) */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLowerImage}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasLowerImage(checked);
                    if (!checked) setLowerImageUrl(undefined);
                  }}
                  className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
                <Layers className="w-4 h-4 text-purple-400" />
                <span>{isDe ? 'Zweites Stockwerk / Ebene Unten (U)' : 'Second Level / Lower Floor (U)'}</span>
              </label>
              <span className="text-[11px] font-mono text-purple-400 font-bold uppercase">
                {hasLowerImage ? (isDe ? 'Aktiv (O + U)' : 'Active (O + U)') : (isDe ? 'Inaktiv (Nur O)' : 'Inactive (O Only)')}
              </span>
            </div>

            {hasLowerImage && (
              <div className="pt-2 space-y-3 border-t border-zinc-800 animate-in fade-in-50">
                <p className="text-[11px] text-zinc-400 leading-snug">
                  {isDe
                    ? 'Lade ein separates Radarbild für das untere Stockwerk (U) hoch (z. B. Keller bei Nuke oder Untergeschoss bei Vertigo).'
                    : 'Upload a separate radar image for the lower floor (U) (e.g. basement in Nuke or lower floor in Vertigo).'}
                </p>

                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-purple-500/40 bg-purple-950/20 hover:bg-purple-950/40 hover:border-purple-400 cursor-pointer transition-colors text-xs text-purple-200 font-medium">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>{isDe ? 'Bild für Ebene U (Unten) wählen...' : 'Choose image for Lower level (U)...'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      onChange={handleLowerFileUpload}
                      className="hidden"
                    />
                  </label>
                  {lowerImageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLowerImageUrl(undefined);
                        setHasLowerImage(false);
                      }}
                      className="p-2.5 text-red-400 hover:text-red-300 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors text-xs flex items-center gap-1"
                      title={isDe ? 'Ebene U entfernen' : 'Remove Floor U'}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">{isDe ? 'Entfernen' : 'Remove'}</span>
                    </button>
                  )}
                </div>

                {/* Vorschau Ebene U */}
                {lowerImageUrl ? (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-purple-500/50 bg-zinc-950 flex items-center justify-center">
                    {!lowerPreviewError ? (
                      <img
                        src={lowerImageUrl}
                        alt="Lower Radar Preview"
                        className="w-full h-full object-contain"
                        onError={() => setLowerPreviewError(true)}
                      />
                    ) : (
                      <div className="text-xs text-zinc-500">
                        {isDe ? 'Bild (Ebene U) konnte nicht geladen werden' : 'Image (Floor U) could not be loaded'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 border border-dashed border-zinc-800 rounded-xl text-xs text-purple-300/60 font-mono">
                    {isDe ? 'Noch kein Bild für Ebene U ausgewählt' : 'No image selected for Floor U yet'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description (DE) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              {isDe ? 'Kurzbeschreibung (Deutsch)' : 'Short Description (German)'}
            </label>
            <textarea
              rows={2}
              value={descriptionDe}
              onChange={(e) => setDescriptionDe(e.target.value)}
              placeholder="z. B. Taktische Wettkampfkarte mit..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-zinc-400"
            />
          </div>

          {/* Description (EN) */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              {isDe ? 'Kurzbeschreibung (Englisch)' : 'Short Description (English)'}
            </label>
            <textarea
              rows={2}
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              placeholder="e.g. Competitive tactical map featuring..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-zinc-400"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between gap-3">
            {mapToEdit && onDeleteMap ? (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      isDe
                        ? `Möchtest du die Karte "${mapToEdit.name}" wirklich löschen?`
                        : `Are you sure you want to delete "${mapToEdit.name}"?`
                    )
                  ) {
                    onDeleteMap(mapToEdit.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDe ? 'Löschen' : 'Delete'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm"
              >
                {isDe ? 'Speichern' : 'Save Map'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
