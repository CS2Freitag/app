import React, { useState, useRef, useEffect, useCallback } from 'react';
import LZString from 'lz-string';
import { User } from 'firebase/auth';
import { getCloudMap, smartMergeMap, syncUserMap, loginWithGoogle } from '../services/firebase';
import { CloudConflictModal } from './CloudConflictModal';
import { ShareTacticModal } from './ShareTacticModal';
import { resolveAssetPath } from '../utils/assets';
import { encodeCompactTactic } from '../utils/tacticCodec';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Pencil,
  Shield,
  Flame,
  RotateCcw,
  RotateCw,
  Undo2,
  Redo2,
  Trash2,
  Eraser,
  Eye,
  EyeOff,
  Crosshair,
  Move,
  Check,
  Edit3,
  HelpCircle,
  X,
  Type,
  Palette,
  Square,
  Download,
  Image as ImageIcon,
  Upload,
  Activity,
  PenTool,
  ArrowUp,
  Share2,
  Plus
} from 'lucide-react';
import {
  MapData,
  Callout,
  CalloutLevel,
  CalloutDisplayMode,
  CalloutArea,
  Language,
  ZoneType,
  DangerLevel,
  ColorMode,
  UtilityType,
  UtilityMarker,
  PlayerToken,
  TacticalDrawingLine,
  TacticalTool
} from '../types';

export const isCalloutForLevel = (
  callout: Callout,
  targetLevel: 'upper' | 'lower',
  hasLowerMap: boolean = true
): boolean => {
  // If the map has no second level (no lower image), all callouts belong to upper (main map)
  if (!hasLowerMap) {
    return targetLevel === 'upper';
  }

  if (callout.level === 'both') return true;
  if (callout.level === 'upper') return targetLevel === 'upper';
  if (callout.level === 'lower') return targetLevel === 'lower';

  // Heuristic fallback for legacy or unspecified callouts ONLY on multi-level maps
  const lowerKeywords = [
    'lower',
    'unten',
    'b site',
    'b_site',
    'secret',
    'ramp',
    'vent',
    'tunnels',
    'subway',
    'under'
  ];
  const nameAndZone = `${callout.name} ${callout.id} ${callout.zone}`.toLowerCase();
  const seemsLower = lowerKeywords.some((kw) => nameAndZone.includes(kw));

  return targetLevel === 'lower' ? seemsLower : !seemsLower;
};

export const getFontFamilyStyle = (fontKey?: string) => {
  switch (fontKey) {
    case 'rajdhani':
      return "'Rajdhani', sans-serif";
    case 'orbitron':
      return "'Orbitron', sans-serif";
    case 'russo':
      return "'Russo One', sans-serif";
    case 'teko':
      return "'Teko', sans-serif";
    case 'sans':
      return "'Inter', system-ui, sans-serif";
    case 'serif':
      return "'Georgia', serif";
    case 'mono':
    default:
      return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Roboto Mono', monospace";
  }
};

interface TacticalMapViewProps {
  mapData: MapData;
  onBack: () => void;
  onGoHome?: () => void;
  onUpdateMap: (updatedMap: MapData, skipCloudSync?: boolean) => void;
  onSaveAsMyTactic?: (baseMap: MapData, tacticTitle: string, tacticState: { drawings: TacticalDrawingLine[]; utilities: UtilityMarker[]; players: PlayerToken[] }) => void;
  onSyncMap: (mapData: MapData) => Promise<void>;
  currentUser: User | null;
  lang: Language;
  initialHighlightedCalloutId?: string;
}

export const TacticalMapView: React.FC<TacticalMapViewProps> = ({
  mapData,
  onBack,
  onGoHome,
  onUpdateMap,
  onSaveAsMyTactic,
  onSyncMap,
  currentUser,
  lang,
  initialHighlightedCalloutId,
}) => {
  const isDe = lang === 'de';

  // Tracking unsynced cloud changes and snapshot for discarding
  const initialMapDataRef = useRef<MapData>(mapData);
  const initialMapTimestampRef = useRef<number>(mapData.updatedAt || Date.now());
  const [hasChangesInSession, setHasChangesInSession] = useState(false);
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Cloud Conflict Resolution State
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [conflictCloudMap, setConflictCloudMap] = useState<MapData | null>(null);
  const [isProcessingConflict, setIsProcessingConflict] = useState<boolean>(false);

  // Share & Save Tactic Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [currentShareUrl, setCurrentShareUrl] = useState<string>('');

  // Multi-level floor state ('upper' | 'lower' | 'both')
  const [currentLevel, setCurrentLevel] = useState<'upper' | 'lower' | 'both'>('upper');
  const activeImage =
    currentLevel === 'lower' && mapData.lowerImage ? mapData.lowerImage : mapData.image;

  const handleMapUpdate = (updated: MapData) => {
    setHasChangesInSession(true);
    // During editing, we skip cloud sync and only save locally via localStorage
    onUpdateMap(updated, true);
  };

  const handleShareTactics = () => {
    try {
      const compressed = encodeCompactTactic(
        mapData.id,
        mapData.name,
        drawings,
        utilities,
        players
      );
      const url = `${window.location.origin}${window.location.pathname}#t=${compressed}`;
      setCurrentShareUrl(url);
      setIsShareModalOpen(true);
    } catch (err) {
      console.error('Error generating share URL:', err);
      alert(isDe ? 'Fehler beim Erstellen des Taktik-Links.' : 'Error generating tactic link.');
    }
  };

  // Continuous Zoom (10% to 200%, default 75% for non-fullscreen fit)
  const [zoom, setZoom] = useState<number>(0.75);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [hasMovedDistance, setHasMovedDistance] = useState(false);

  // Callout Label Size Scale: 0.6 (60%) on smartphones (<768px), 1.0 (100%) on tablets/PC
  const [calloutScale, setCalloutScale] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 0.6; // 60% auf Smartphones
    }
    return 1.0; // 100% auf Tablets & PC
  });

  // Keep 60% on smartphones and 100% on tablets/PC on screen resize if not explicitly changed
  useEffect(() => {
    const handleScaleResize = () => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth < 768) {
        setCalloutScale((prev) => (prev === 1.0 ? 0.6 : prev));
      } else {
        setCalloutScale((prev) => (prev === 0.6 ? 1.0 : prev));
      }
    };
    window.addEventListener('resize', handleScaleResize);
    return () => window.removeEventListener('resize', handleScaleResize);
  }, []);
  // Scroll to Top state & listener inside TacticalMapView
  const [showTacticalScrollTop, setShowTacticalScrollTop] = useState(false);
  useEffect(() => {
    const handleTacticalScroll = () => {
      if (window.scrollY > 250) {
        setShowTacticalScrollTop(true);
      } else {
        setShowTacticalScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleTacticalScroll);
    return () => window.removeEventListener('scroll', handleTacticalScroll);
  }, []);

  // Color Mode: 'zone' | 'danger'
  const [colorMode, setColorMode] = useState<ColorMode>('zone');

  // Toggle TotalCSGO-style areas overlay
  const [showAreas, setShowAreas] = useState<boolean>(true);

  // Color Legend Modal/Panel
  const [showLegend, setShowLegend] = useState<boolean>(false);

  // Tactical tools
  const [activeTool, setActiveTool] = useState<TacticalTool>('select');
  const [selectedUtility, setSelectedUtility] = useState<UtilityType>('smoke');
  const [selectedPlayerSide, setSelectedPlayerSide] = useState<'ct' | 't'>('ct');
  const [penColor, setPenColor] = useState<string>('#ffffff');
  const [penWithArrow, setPenWithArrow] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const pressTimer = useRef<number | null>(null);

  const colors = ['#ffffff', '#000000', '#3b82f6', '#92400e', '#ef4444', '#22c55e', '#f97316'];

  const handleToolPress = (tool: TacticalTool, isArrow: boolean) => {
    setActiveTool(tool);
    setPenWithArrow(isArrow);
    setShowColorPicker(false);
  };

  const handleToolLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setShowColorPicker(!showColorPicker);
  };

  const startPressTimer = (e: React.MouseEvent | React.TouchEvent) => {
    pressTimer.current = window.setTimeout(() => {
      handleToolLongPress(e);
    }, 500); // 500ms for long press
  };

  const clearPressTimer = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };


  // Tactical drawings and undo/redo stacks
  const [drawings, setDrawings] = useState<TacticalDrawingLine[]>(() => mapData.tacticData?.drawings || []);
  const [drawingsRedoStack, setDrawingsRedoStack] = useState<TacticalDrawingLine[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<TacticalDrawingLine | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);

  // Utility & Players
  const [utilities, setUtilities] = useState<UtilityMarker[]>(() => mapData.tacticData?.utilities || []);
  const [players, setPlayers] = useState<PlayerToken[]>(() => mapData.tacticData?.players || []);

  // Callouts & Inspector state
  const [hoveredCallout, setHoveredCallout] = useState<Callout | null>(null);
  const [selectedCallout, setSelectedCallout] = useState<Callout | null>(null);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<ZoneType | 'all'>('all');
  const [showCalloutLabels, setShowCalloutLabels] = useState<boolean>(true);
  const [highlightedCalloutId, setHighlightedCalloutId] = useState<string | undefined>(
    initialHighlightedCalloutId
  );

  // Edit mode, Options Modal & Single Callout Edit states
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isEditOptionsModalOpen, setIsEditOptionsModalOpen] = useState<boolean>(false);
  const [singleEditCalloutId, setSingleEditCalloutId] = useState<string | null>(null);
  const [singleEditSearchQuery, setSingleEditSearchQuery] = useState<string>('');
  const [draggingCalloutId, setDraggingCalloutId] = useState<string | null>(null);
  const [draggedCoords, setDraggedCoords] = useState<{ x: number; y: number } | null>(null);

  // Area Interactive Dragging, Resizing & Rotation in Edit Mode
  const [draggingAreaCalloutId, setDraggingAreaCalloutId] = useState<string | null>(null);
  const [resizingAreaCalloutId, setResizingAreaCalloutId] = useState<string | null>(null);
  const [rotatingAreaCalloutId, setRotatingAreaCalloutId] = useState<string | null>(null);
  const [areaDragStart, setAreaDragStart] = useState<{
    clientX: number;
    clientY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
  } | null>(null);
  const [rotationDragStart, setRotationDragStart] = useState<{
    clientX: number;
    clientY: number;
    initRotation: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  const handleAreaRotationStart = (callout: Callout, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode || !callout.area) return;
    e.stopPropagation();
    setRotatingAreaCalloutId(callout.id);
    const { clientX, clientY } = getClientCoords(e);
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const boxCenterX = rect.left + (50 + callout.area.x + callout.area.width / 2) * (rect.width / 100);
      const boxCenterY = rect.top + (50 + callout.area.y + callout.area.height / 2) * (rect.height / 100);
      setRotationDragStart({
        clientX,
        clientY,
        initRotation: callout.rotation || 0,
        centerX: boxCenterX,
        centerY: boxCenterY,
      });
    }
  };

  // Edit banner auto-hide timer (7 seconds)
  const [showEditBanner, setShowEditBanner] = useState<boolean>(true);
  const editBannerTimerRef = useRef<number | null>(null);

  // Form modal state
  const [isAddingCallout, setIsAddingCallout] = useState<boolean>(false);
  const [editingCallout, setEditingCallout] = useState<Callout | null>(null);
  const [pendingCalloutCoords, setPendingCalloutCoords] = useState<{ x: number; y: number } | null>(
    null
  );

  // Callout form fields
  const [calloutFormName, setCalloutFormName] = useState('');
  const [calloutFormLevel, setCalloutFormLevel] = useState<CalloutLevel>('upper');
  const [calloutFormZone, setCalloutFormZone] = useState<ZoneType>('a_site');
  const [calloutFormDanger, setCalloutFormDanger] = useState<DangerLevel>('medium');
  const [calloutFormRotation, setCalloutFormRotation] = useState<number>(0);
  const [calloutFormTextRotation, setCalloutFormTextRotation] = useState<number>(0);
  const [calloutFormFontSize, setCalloutFormFontSize] = useState<number>(12);
  const [calloutFormFontFamily, setCalloutFormFontFamily] = useState<string>('mono');
  const [calloutFormDisplayMode, setCalloutFormDisplayMode] = useState<CalloutDisplayMode>('text');
  const [calloutFormCustomImage, setCalloutFormCustomImage] = useState<string>('');
  const [calloutFormImageSize, setCalloutFormImageSize] = useState<number>(36);
  const [calloutFormHidePin, setCalloutFormHidePin] = useState<boolean>(false);
  const [calloutFormPinOffsetX, setCalloutFormPinOffsetX] = useState<number>(0);
  const [calloutFormPinOffsetY, setCalloutFormPinOffsetY] = useState<number>(0);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingPinPreview, setIsDraggingPinPreview] = useState<boolean>(false);

  const handlePreviewPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!previewBoxRef.current) return;
    const rect = previewBoxRef.current.getBoundingClientRect();
    const clientX = 'touches' in e && e.touches && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = Math.max(-120, Math.min(120, Math.round(clientX - centerX)));
    const dy = Math.max(-120, Math.min(120, Math.round(clientY - centerY)));
    setCalloutFormPinOffsetX(dx);
    setCalloutFormPinOffsetY(dy);
  };

  const [calloutFormDescDe, setCalloutFormDescDe] = useState('');
  const [calloutFormDescEn, setCalloutFormDescEn] = useState('');
  const [calloutFormTipDe, setCalloutFormTipDe] = useState('');
  const [calloutFormTipEn, setCalloutFormTipEn] = useState('');
  const [calloutFormAnglesDe, setCalloutFormAnglesDe] = useState('');
  const [calloutFormAnglesEn, setCalloutFormAnglesEn] = useState('');

  // Callout area form fields
  const [calloutFormHasArea, setCalloutFormHasArea] = useState<boolean>(false);
  const [calloutFormAreaShape, setCalloutFormAreaShape] = useState<'rect' | 'polygon'>('rect');
  const [calloutFormAreaPoints, setCalloutFormAreaPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawingPolygonArea, setIsDrawingPolygonArea] = useState<boolean>(false);
  const [polygonHoverCoord, setPolygonHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const [calloutFormAreaX, setCalloutFormAreaX] = useState<number>(0);
  const [calloutFormAreaY, setCalloutFormAreaY] = useState<number>(0);
  const [calloutFormAreaWidth, setCalloutFormAreaWidth] = useState<number>(8);
  const [calloutFormAreaHeight, setCalloutFormAreaHeight] = useState<number>(8);
  const [calloutFormAreaColor, setCalloutFormAreaColor] = useState<string>('auto');

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const mainWrapperRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pinch-to-zoom refs for touchscreens
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1.0);

  const calculateFitZoom = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return currentLevel === 'both' ? 0.45 : 1.0;
    }
    if (!mainWrapperRef.current) return 0.75;
    const parentRect = mainWrapperRef.current.getBoundingClientRect();
    if (currentLevel === 'both') {
      const availW = Math.max(300, parentRect.width - 48);
      const availH = Math.max(300, parentRect.height - 48);
      const scaleW = availW / 1750;
      const scaleH = availH / 850;
      return Math.max(0.2, Math.min(1.2, Math.min(scaleW, scaleH) * 0.92));
    }
    const availableSize = Math.min(parentRect.width - 40, parentRect.height - 40);
    // Based on max-w-[850px], reduced by 10%
    return Math.max(0.3, Math.min(1.5, (availableSize / 850) * 0.9));
  };

  // Auto-fit map zoom when switching maps or selecting floor level
  useEffect(() => {
    setZoom(calculateFitZoom());
    setPan({ x: 0, y: 0 });
  }, [mapData.id, currentLevel]);

  const startBannerTimer = useCallback(() => {
    setShowEditBanner(true);
    if (editBannerTimerRef.current) {
      window.clearTimeout(editBannerTimerRef.current);
    }
    editBannerTimerRef.current = window.setTimeout(() => {
      setShowEditBanner(false);
    }, 7000);
  }, []);

  useEffect(() => {
    if (isEditMode) {
      startBannerTimer();
    } else {
      if (editBannerTimerRef.current) {
        window.clearTimeout(editBannerTimerRef.current);
      }
      setShowEditBanner(false);
    }
  }, [isEditMode, startBannerTimer]);

  // Initial highlight from search
  useEffect(() => {
    if (initialHighlightedCalloutId) {
      const match = mapData.callouts.find((c) => c.id === initialHighlightedCalloutId);
      if (match) {
        setSelectedCallout(match);
        setHighlightedCalloutId(initialHighlightedCalloutId);
      }
    }
  }, [initialHighlightedCalloutId, mapData.callouts]);

  // Keyboard shortcut listener (Undo: Ctrl+Z, Redo: Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoDrawing();
        } else {
          handleUndoDrawing();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoDrawing();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawings, drawingsRedoStack]);

  // Fullscreen listener - Auto-fit map automatically on enter (100%) / exit (75%)
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      setZoom(calculateFitZoom());
      setPan({ x: 0, y: 0 });
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('resize', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('resize', handleFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mainWrapperRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Convert event client coordinates to centered coordinates (-80 to +80, origin 0,0 at center)
  const getCoordinatesFromClient = (
    clientX: number,
    clientY: number,
    targetTile?: HTMLElement | null
  ) => {
    const tile =
      targetTile ||
      (mapContainerRef.current?.classList.contains('map-canvas-tile')
        ? mapContainerRef.current
        : mapContainerRef.current?.querySelector<HTMLElement>('.map-canvas-tile')) ||
      mapContainerRef.current;
    if (!tile) return { x: 0, y: 0 };
    const rect = tile.getBoundingClientRect();
    const x = Math.max(-80, Math.min(80, ((clientX - rect.left) / rect.width) * 100 - 50));
    const y = Math.max(-80, Math.min(80, ((clientY - rect.top) / rect.height) * 100 - 50));
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  };

  const getCoordinatesFromEvent = (
    e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>
  ) => {
    const clientX =
      'touches' in e && e.touches && e.touches.length > 0
        ? e.touches[0].clientX
        : (e as React.MouseEvent).clientX;
    const clientY =
      'touches' in e && e.touches && e.touches.length > 0
        ? e.touches[0].clientY
        : (e as React.MouseEvent).clientY;
    const target = (e && e.target as HTMLElement) || null;
    const tile = (target && typeof target.closest === 'function' ? target.closest('.map-canvas-tile') as HTMLElement : null) || null;
    return getCoordinatesFromClient(clientX, clientY, tile);
  };

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (mapContainerRef.current && !mapContainerRef.current.contains(e.target as Node)) {
      if (!(e.target as HTMLElement).closest('[data-no-map-click]')) {
        if (isEditMode) {
          startBannerTimer();
        }
      }
    }
  };

  // Export this single map as JSON
  const handleExportThisMap = () => {
    const exportPayload = {
      type: 'cs2freitag_single_map',
      version: 1,
      exportedAt: new Date().toISOString(),
      map: mapData,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CS2Freitag_Karte_${mapData.slug || mapData.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Click on map canvas
  const handleMapCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hasMovedDistance || draggingCalloutId || draggingAreaCalloutId || resizingAreaCalloutId) return;
    if ((e.target as HTMLElement).closest('[data-no-map-click]')) return;

    // Polygon drawing tool for custom zone area
    if (isDrawingPolygonArea) {
      const coords = getCoordinatesFromEvent(e);
      if (calloutFormAreaPoints.length >= 3) {
        const first = calloutFormAreaPoints[0];
        const dist = Math.hypot(coords.x - first.x, coords.y - first.y);
        if (dist < 4.0) {
          // Connected! Close polygon and persist area
          handleFinishPolygonArea(calloutFormAreaPoints);
          return;
        }
      }
      setCalloutFormAreaPoints((prev) => [...prev, coords]);
      return;
    }

    const coords = getCoordinatesFromEvent(e);

    // Utility placement tool
    if (activeTool === 'utility') {
      const newMarker: UtilityMarker = {
        id: `util_${Date.now()}`,
        type: selectedUtility,
        x: coords.x,
        y: coords.y,
      };
      setUtilities((prev) => [...prev, newMarker]);
      return;
    }

    // Player placement tool
    if (activeTool === 'player') {
      const count = players.filter((p) => p.side === selectedPlayerSide).length;
      const newPlayer: PlayerToken = {
        id: `player_${Date.now()}`,
        side: selectedPlayerSide,
        number: (count % 5) + 1,
        x: coords.x,
        y: coords.y,
        hasBomb: selectedPlayerSide === 't' && players.filter((p) => p.hasBomb).length === 0,
      };
      setPlayers((prev) => [...prev, newPlayer]);
      return;
    }

    // Select tool: clicking background closes inspector
    if (activeTool === 'select') {
      setSelectedCallout(null);
      setHighlightedCalloutId(undefined);
    }
  };

  // Mouse & Dragging handling
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingCalloutId || draggingAreaCalloutId || resizingAreaCalloutId) return;
    if ((e.target as HTMLElement).closest('[data-no-map-click]')) return;

    // Right-click (e.button === 2) ALWAYS initiates panning, even while drawing lines or polygon areas!
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setMouseDownPos({ x: e.clientX, y: e.clientY });
      setHasMovedDistance(false);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (isDrawingPolygonArea) return;

    if (activeTool === 'pen' || activeTool === 'arrow') {
      if (e.button === 0) {
        const coords = getCoordinatesFromEvent(e);
        const newLine: TacticalDrawingLine = {
          id: `draw_${Date.now()}`,
          points: [coords],
          color: penColor,
          width: 3,
          hasArrow: penWithArrow,
        };
        setCurrentDrawing(newLine);
        return;
      }
    }

    if (activeTool === 'eraser') {
      return;
    }

    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setMouseDownPos({ x: e.clientX, y: e.clientY });
      setHasMovedDistance(false);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  // Global mouseup listener to ensure right-click panning releases cleanly anywhere
  useEffect(() => {
    if (!isPanning) return;
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 2 || e.buttons === 0) {
        setIsPanning(false);
        setMouseDownPos(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isPanning]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // 0. Panning takes TOP PRIORITY whenever user is panning (e.g. right-click held during drawing or polygon placement)
    if (isPanning && mouseDownPos) {
      const dx = Math.abs(e.clientX - mouseDownPos.x);
      const dy = Math.abs(e.clientY - mouseDownPos.y);
      if (dx > 4 || dy > 4) {
        setHasMovedDistance(true);
      }
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
      return;
    }

    if (isDrawingPolygonArea) {
      const coords = getCoordinatesFromEvent(e);
      setPolygonHoverCoord(coords);
      return;
    }

    // 1. Eraser Tool Brush Scrubbing (Real-time erase when dragging)
    if (activeTool === 'eraser' && mouseDownPos) {
      const coords = getCoordinatesFromEvent(e);
      setDrawings((prev) =>
        prev.filter((line) => {
          const isNear = line.points.some(
            (p) => Math.hypot(p.x - coords.x, p.y - coords.y) < 5
          );
          return !isNear;
        })
      );
      return;
    }

    // 2. Dragging Callout Pin (If area exists, move area along so pin stays in center!)
    if (draggingCalloutId && mapContainerRef.current) {
      const callout = mapData.callouts.find((c) => c.id === draggingCalloutId);
      let targetTile: HTMLElement | null = null;
      if (currentLevel === 'both' && callout) {
        const isLower = isCalloutForLevel(callout, 'lower') && !isCalloutForLevel(callout, 'upper');
        targetTile = document.getElementById(isLower ? 'map-tile-lower' : 'map-tile-upper');
      } else {
        targetTile = (e.target as HTMLElement).closest('.map-canvas-tile') as HTMLElement || null;
      }
      const coords = getCoordinatesFromClient(e.clientX, e.clientY, targetTile);
      setDraggedCoords(coords);

      const updatedCallouts = mapData.callouts.map((c) => {
        if (c.id === draggingCalloutId) {
          if (c.area) {
            const newAreaX = Math.round((coords.x - c.area.width / 2) * 10) / 10;
            const newAreaY = Math.round((coords.y - c.area.height / 2) * 10) / 10;
            return {
              ...c,
              x: coords.x,
              y: coords.y,
              area: { ...c.area, x: newAreaX, y: newAreaY },
            };
          }
          return { ...c, x: coords.x, y: coords.y };
        }
        return c;
      });
      handleMapUpdate({ ...mapData, callouts: updatedCallouts });
      return;
    }

    // 3. Dragging Callout Area (Move) -> Pin is AUTOMATICALLY CENTERED!
    if (draggingAreaCalloutId && areaDragStart && mapContainerRef.current) {
      let targetTile: HTMLElement | null = null;
      if (currentLevel === 'both') {
        const callout = mapData.callouts.find((c) => c.id === draggingAreaCalloutId);
        const isLower = callout && isCalloutForLevel(callout, 'lower') && !isCalloutForLevel(callout, 'upper');
        targetTile = document.getElementById(isLower ? 'map-tile-lower' : 'map-tile-upper');
      } else {
        targetTile = (e.target as HTMLElement).closest('.map-canvas-tile') as HTMLElement || mapContainerRef.current;
      }
      const tileEl = targetTile || mapContainerRef.current;
      const rect = tileEl.getBoundingClientRect();
      const dxPercent = ((e.clientX - areaDragStart.clientX) / rect.width) * 100;
      const dyPercent = ((e.clientY - areaDragStart.clientY) / rect.height) * 100;

      const newX = Math.round((areaDragStart.initX + dxPercent) * 10) / 10;
      const newY = Math.round((areaDragStart.initY + dyPercent) * 10) / 10;

      const updatedCallouts = mapData.callouts.map((c) => {
        if (c.id === draggingAreaCalloutId && c.area) {
          const centerX = Math.round((newX + c.area.width / 2) * 10) / 10;
          const centerY = Math.round((newY + c.area.height / 2) * 10) / 10;
          return {
            ...c,
            x: centerX,
            y: centerY,
            area: { ...c.area, x: newX, y: newY },
          };
        }
        return c;
      });
      handleMapUpdate({ ...mapData, callouts: updatedCallouts });
      return;
    }

    // 4. Resizing Callout Area (Bottom-Right handle) -> Pin is AUTOMATICALLY CENTERED!
    if (resizingAreaCalloutId && areaDragStart && mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const dxPercent = ((e.clientX - areaDragStart.clientX) / rect.width) * 100;
      const dyPercent = ((e.clientY - areaDragStart.clientY) / rect.height) * 100;

      const newW = Math.max(2, Math.round((areaDragStart.initW + dxPercent) * 10) / 10);
      const newH = Math.max(2, Math.round((areaDragStart.initH + dyPercent) * 10) / 10);

      const updatedCallouts = mapData.callouts.map((c) => {
        if (c.id === resizingAreaCalloutId && c.area) {
          const centerX = Math.round((c.area.x + newW / 2) * 10) / 10;
          const centerY = Math.round((c.area.y + newH / 2) * 10) / 10;
          return {
            ...c,
            x: centerX,
            y: centerY,
            area: { ...c.area, width: newW, height: newH },
          };
        }
        return c;
      });
      handleMapUpdate({ ...mapData, callouts: updatedCallouts });
      return;
    }

    // 5. Rotating Callout Area & Label
    if (rotatingAreaCalloutId && rotationDragStart) {
      const angleRad = Math.atan2(e.clientY - rotationDragStart.centerY, e.clientX - rotationDragStart.centerX);
      let angleDeg = Math.round(angleRad * (180 / Math.PI));
      const updatedCallouts = mapData.callouts.map((c) => {
        if (c.id === rotatingAreaCalloutId) {
          return { ...c, rotation: angleDeg };
        }
        return c;
      });
      handleMapUpdate({ ...mapData, callouts: updatedCallouts });
      return;
    }

    // 6. Drawing Line
    if (currentDrawing) {
      const coords = getCoordinatesFromEvent(e);
      setCurrentDrawing((prev) =>
        prev ? { ...prev, points: [...prev.points, coords] } : null
      );
      return;
    }
  };

  const handleMouseUp = () => {
    if (draggingCalloutId) {
      setDraggingCalloutId(null);
      setDraggedCoords(null);
    }
    if (draggingAreaCalloutId) {
      setDraggingAreaCalloutId(null);
      setAreaDragStart(null);
    }
    if (resizingAreaCalloutId) {
      setResizingAreaCalloutId(null);
      setAreaDragStart(null);
    }
    if (rotatingAreaCalloutId) {
      setRotatingAreaCalloutId(null);
      setRotationDragStart(null);
    }
    if (currentDrawing) {
      if (currentDrawing.points.length > 1) {
        setDrawings((prev) => [...prev, currentDrawing]);
        setDrawingsRedoStack([]); // reset redo stack on new stroke
      }
      setCurrentDrawing(null);
    }
    setIsPanning(false);
    setMouseDownPos(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // 2-finger pinch gesture start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialPinchDistRef.current = dist;
      initialPinchZoomRef.current = zoom;
      setIsPanning(false);
      setMouseDownPos(null);
    } else if (e.touches.length === 1) {
      if ((activeTool === 'pen' || activeTool === 'arrow' || activeTool === 'eraser') && e.cancelable) {
        e.preventDefault();
      }
      initialPinchDistRef.current = null;
      const touch = e.touches[0];
      handleMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        target: e.target,
      } as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialPinchDistRef.current && initialPinchDistRef.current > 0) {
      if (e.cancelable) {
        e.preventDefault();
      }
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = currentDist / initialPinchDistRef.current;
      const newZoom = Math.max(0.1, Math.min(2.0, initialPinchZoomRef.current * factor));
      setZoom(Math.round(newZoom * 100) / 100);
    } else if (e.touches.length === 1) {
      if ((activeTool === 'pen' || activeTool === 'arrow' || activeTool === 'eraser' || currentDrawing) && e.cancelable) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      handleMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: e.target,
      } as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      initialPinchDistRef.current = null;
    }
    if (e.touches.length === 0) {
      handleMouseUp();
    }
  };

  // Wheel zoom (up to 200%)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((prev) => {
      return Math.max(0.1, Math.min(2.0, Math.round((prev + delta) * 100) / 100));
    });
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(0.1, Math.min(2.0, Math.round(newZoom * 100) / 100));
    setZoom(clamped);
  };

  const handleZoomIn = () => handleZoomChange(zoom + 0.05);
  const handleZoomOut = () => handleZoomChange(zoom - 0.05);

  // Drawing undo, redo & single line delete
  const handleUndoDrawing = () => {
    if (drawings.length === 0) return;
    const last = drawings[drawings.length - 1];
    setDrawings((prev) => prev.slice(0, -1));
    setDrawingsRedoStack((prev) => [...prev, last]);
  };

  const handleRedoDrawing = () => {
    if (drawingsRedoStack.length === 0) return;
    const last = drawingsRedoStack[drawingsRedoStack.length - 1];
    setDrawingsRedoStack((prev) => prev.slice(0, -1));
    setDrawings((prev) => [...prev, last]);
  };

  const handleDeleteSingleLine = (lineId: string) => {
    const target = drawings.find((d) => d.id === lineId);
    if (!target) return;
    setDrawings((prev) => prev.filter((d) => d.id !== lineId));
    setDrawingsRedoStack((prev) => [...prev, target]);
  };

  const handleClearTactics = () => {
    setDrawings([]);
    setDrawingsRedoStack([]);
    setUtilities([]);
    setPlayers([]);
  };

  const getClientCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    if ('changedTouches' in e && e.changedTouches && e.changedTouches.length > 0) {
      return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    }
    const me = e as React.MouseEvent;
    return { clientX: me.clientX, clientY: me.clientY };
  };

  // Double click map to fit to screen size
  const handleMapDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-no-map-click]')) {
      return;
    }
    setZoom(calculateFitZoom());
    setPan({ x: 0, y: 0 });
  };

  // Callout Pin Drag Start
  const handleCalloutDragStart = (callout: Callout, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode) return;
    e.stopPropagation();
    const pinX = callout.x;
    const pinY = callout.y;
    setDraggingCalloutId(callout.id);
    setDraggedCoords({ x: pinX, y: pinY });
  };

  // Area Move Drag Start
  const handleAreaMoveStart = (callout: Callout, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode || !callout.area) return;
    e.stopPropagation();
    const { clientX, clientY } = getClientCoords(e);
    setDraggingAreaCalloutId(callout.id);
    setAreaDragStart({
      clientX,
      clientY,
      initX: callout.area.x,
      initY: callout.area.y,
      initW: callout.area.width,
      initH: callout.area.height,
    });
  };

  // Area Resize Drag Start
  const handleAreaResizeStart = (callout: Callout, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode || !callout.area) return;
    e.stopPropagation();
    const { clientX, clientY } = getClientCoords(e);
    setResizingAreaCalloutId(callout.id);
    setAreaDragStart({
      clientX,
      clientY,
      initX: callout.area.x,
      initY: callout.area.y,
      initW: callout.area.width,
      initH: callout.area.height,
    });
  };

  // Quick Rotate Callout by +45°
  const handleQuickRotateCallout = (callout: Callout, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentRot = callout.rotation || 0;
    let nextRot = currentRot + 45;
    if (nextRot > 180) nextRot = -135;
    const updated = mapData.callouts.map((c) =>
      c.id === callout.id ? { ...c, rotation: nextRot } : c
    );
    handleMapUpdate({ ...mapData, callouts: updated });
  };

  // Quick Toggle / Add Area for Callout (ALWAYS CENTERED!)
  const handleQuickToggleArea = (callout: Callout, e: React.MouseEvent) => {
    e.stopPropagation();
    let updatedCallouts: Callout[];
    if (callout.area) {
      // Remove area
      updatedCallouts = mapData.callouts.map((c) =>
        c.id === callout.id ? { ...c, area: undefined } : c
      );
    } else {
      // Add default 10x10 area centered around pin
      const width = 10;
      const height = 10;
      const areaX = Math.max(0, Math.min(100 - width, Math.round((callout.x - width / 2) * 10) / 10));
      const areaY = Math.max(0, Math.min(100 - height, Math.round((callout.y - height / 2) * 10) / 10));
      const area: CalloutArea = {
        x: areaX,
        y: areaY,
        width,
        height,
      };
      const centerX = Math.round((areaX + width / 2) * 10) / 10;
      const centerY = Math.round((areaY + height / 2) * 10) / 10;
      updatedCallouts = mapData.callouts.map((c) =>
        c.id === callout.id ? { ...c, x: centerX, y: centerY, area } : c
      );
    }
    handleMapUpdate({ ...mapData, callouts: updatedCallouts });
  };

  const handleOpenAddNewCalloutModal = (targetLevel?: 'upper' | 'lower' | React.MouseEvent) => {
    const centerCoords = { x: 0, y: 0 };
    setPendingCalloutCoords(centerCoords);
    const resolvedLevel = typeof targetLevel === 'string' ? targetLevel : (currentLevel === 'lower' ? 'lower' : 'upper');
    setCalloutFormLevel(resolvedLevel);
    setCalloutFormName('');
    setCalloutFormZone('a_site');
    setCalloutFormDanger('medium');
    setCalloutFormRotation(0);
    setCalloutFormTextRotation(0);
    setCalloutFormFontSize(12);
    setCalloutFormFontFamily('mono');
    setCalloutFormDisplayMode('text');
    setCalloutFormCustomImage('');
    setCalloutFormImageSize(36);
    setCalloutFormHidePin(false);
    setCalloutFormPinOffsetX(0);
    setCalloutFormPinOffsetY(0);
    setCalloutFormDescDe('');
    setCalloutFormDescEn('');
    setCalloutFormTipDe('');
    setCalloutFormTipEn('');
    setCalloutFormAnglesDe('');
    setCalloutFormAnglesEn('');
    setCalloutFormHasArea(true);
    setCalloutFormAreaShape('rect');
    setCalloutFormAreaPoints([]);
    setIsDrawingPolygonArea(false);
    setCalloutFormAreaX(-5);
    setCalloutFormAreaY(-5);
    setCalloutFormAreaWidth(10);
    setCalloutFormAreaHeight(10);
    setCalloutFormAreaColor('auto');
    setEditingCallout(null);
    setIsAddingCallout(true);
  };

  // Open Callout Editor Modal
  const handleOpenCalloutEditor = (callout: Callout, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCallout(callout);
    setCalloutFormLevel(callout.level || (currentLevel === 'lower' ? 'lower' : 'upper'));
    const pinX = callout.x;
    const pinY = callout.y;
    setPendingCalloutCoords({ x: pinX, y: pinY });
    setCalloutFormName(callout.name);
    setCalloutFormZone(callout.zone);
    setCalloutFormDanger(callout.danger);
    setCalloutFormRotation(callout.rotation || 0);
    setCalloutFormTextRotation(callout.textRotation !== undefined ? callout.textRotation : (callout.rotation || 0));
    setCalloutFormFontSize(callout.fontSize || 12);
    setCalloutFormFontFamily(callout.fontFamily || 'mono');

    const isCT = callout.zone === 'ct_spawn' || callout.name.toLowerCase().includes('ct spawn');
    const isT = callout.zone === 't_spawn' || callout.name.toLowerCase().includes('t spawn');
    const defaultMode = callout.displayMode || (callout.customImage ? 'image' : (isCT || isT ? 'image' : 'text'));
    const defaultImage = callout.customImage || (isCT ? 'ct.png' : isT ? 'T.png' : '');

    setCalloutFormDisplayMode(defaultMode);
    setCalloutFormCustomImage(defaultImage);
    setCalloutFormImageSize(callout.imageSize || 36);
    setCalloutFormHidePin(Boolean(callout.hidePin));
    setCalloutFormPinOffsetX(callout.pinOffsetX ?? 0);
    setCalloutFormPinOffsetY(callout.pinOffsetY ?? (callout.hidePin ? 0 : 25));

    setCalloutFormDescDe(callout.descriptionDe);
    setCalloutFormDescEn(callout.descriptionEn);
    setCalloutFormTipDe(callout.tacticalTipDe);
    setCalloutFormTipEn(callout.tacticalTipEn);
    setCalloutFormAnglesDe(callout.commonAnglesDe);
    setCalloutFormAnglesEn(callout.commonAnglesEn);
    setIsDrawingPolygonArea(false);

    if (callout.area) {
      setCalloutFormHasArea(true);
      setCalloutFormAreaShape(callout.area.shape || (callout.area.points && callout.area.points.length >= 3 ? 'polygon' : 'rect'));
      setCalloutFormAreaPoints(callout.area.points ? [...callout.area.points] : []);
      // STRICTLY PRESERVE EXISTING AREA POSITION AND DIMENSIONS
      setCalloutFormAreaX(callout.area.x);
      setCalloutFormAreaY(callout.area.y);
      setCalloutFormAreaWidth(callout.area.width);
      setCalloutFormAreaHeight(callout.area.height);
      setCalloutFormAreaColor(callout.area.customColor || 'auto');
    } else {
      setCalloutFormHasArea(false);
      setCalloutFormAreaShape('rect');
      setCalloutFormAreaPoints([]);
      setCalloutFormAreaX(Math.round((pinX - 4) * 10) / 10);
      setCalloutFormAreaY(Math.round((pinY - 4) * 10) / 10);
      setCalloutFormAreaWidth(8);
      setCalloutFormAreaHeight(8);
      setCalloutFormAreaColor('auto');
    }

    setIsAddingCallout(true);
  };

  // Save Callout Form
  const handleSaveCalloutForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calloutFormName.trim() || !pendingCalloutCoords) return;

    let areaObj: CalloutArea | undefined = undefined;
    if (calloutFormHasArea) {
      if (calloutFormAreaShape === 'polygon' && calloutFormAreaPoints.length >= 3) {
        const xs = calloutFormAreaPoints.map((p) => p.x);
        const ys = calloutFormAreaPoints.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        areaObj = {
          x: Math.round(minX * 10) / 10,
          y: Math.round(minY * 10) / 10,
          width: Math.max(1, Math.round((maxX - minX) * 10) / 10),
          height: Math.max(1, Math.round((maxY - minY) * 10) / 10),
          customColor: calloutFormAreaColor === 'auto' ? undefined : calloutFormAreaColor,
          shape: 'polygon',
          points: calloutFormAreaPoints,
        };
      } else {
        // Rectangle area: preserve existing x/y for editingCallout, or use current form values (-50 to 50)
        const targetX = editingCallout?.area && editingCallout?.area?.shape !== 'polygon' ? editingCallout.area.x : calloutFormAreaX;
        const targetY = editingCallout?.area && editingCallout?.area?.shape !== 'polygon' ? editingCallout.area.y : calloutFormAreaY;
        areaObj = {
          x: Math.round(targetX * 10) / 10,
          y: Math.round(targetY * 10) / 10,
          width: Math.max(2, Math.min(80, calloutFormAreaWidth)),
          height: Math.max(2, Math.min(80, calloutFormAreaHeight)),
          customColor: calloutFormAreaColor === 'auto' ? undefined : calloutFormAreaColor,
          shape: 'rect',
        };
      }
    }

    const effectiveX =
      editingCallout
        ? editingCallout.x
        : calloutFormAreaShape === 'polygon' && calloutFormAreaPoints.length >= 3
        ? Math.round((calloutFormAreaPoints.reduce((s, p) => s + p.x, 0) / calloutFormAreaPoints.length) * 10) / 10
        : pendingCalloutCoords?.x ?? 0;
    const effectiveY =
      editingCallout
        ? editingCallout.y
        : calloutFormAreaShape === 'polygon' && calloutFormAreaPoints.length >= 3
        ? Math.round((calloutFormAreaPoints.reduce((s, p) => s + p.y, 0) / calloutFormAreaPoints.length) * 10) / 10
        : pendingCalloutCoords?.y ?? 0;

    const finalCustomImage =
      calloutFormDisplayMode !== 'text' && calloutFormCustomImage.trim()
        ? calloutFormCustomImage.trim()
        : undefined;

    if (editingCallout) {
      const updatedCallouts = mapData.callouts.map((c) =>
        c.id === editingCallout.id
          ? {
              ...c,
              name: calloutFormName.trim(),
              // Strictly preserve existing callout pin coordinates
              x: c.x,
              y: c.y,
              zone: calloutFormZone,
              danger: calloutFormDanger,
              rotation: calloutFormRotation,
              textRotation: calloutFormTextRotation,
              fontSize: calloutFormFontSize,
              fontFamily: calloutFormFontFamily,
              displayMode: calloutFormDisplayMode,
              customImage: finalCustomImage,
              imageSize: calloutFormImageSize,
              hidePin: calloutFormHidePin,
              pinOffsetX: calloutFormHidePin ? 0 : calloutFormPinOffsetX,
              pinOffsetY: calloutFormHidePin ? 0 : calloutFormPinOffsetY,
              level: mapData.lowerImage ? calloutFormLevel : c.level,
              area: areaObj,
              descriptionDe: calloutFormDescDe.trim() || `${calloutFormName.trim()} Position`,
              descriptionEn: calloutFormDescEn.trim() || `${calloutFormName.trim()} position`,
              tacticalTipDe: calloutFormTipDe.trim() || 'Winkel beachten und Granaten nutzen.',
              tacticalTipEn: calloutFormTipEn.trim() || 'Check crossfire angles and use utility.',
              commonAnglesDe: calloutFormAnglesDe.trim() || 'Haupteingänge',
              commonAnglesEn: calloutFormAnglesEn.trim() || 'Main approaches',
            }
          : c
      );
      handleMapUpdate({ ...mapData, callouts: updatedCallouts });
    } else {
      const newCallout: Callout = {
        id: `callout_${Date.now()}`,
        name: calloutFormName.trim(),
        x: effectiveX,
        y: effectiveY,
        zone: calloutFormZone,
        danger: calloutFormDanger,
        rotation: calloutFormRotation,
        textRotation: calloutFormTextRotation,
        fontSize: calloutFormFontSize,
        fontFamily: calloutFormFontFamily,
        displayMode: calloutFormDisplayMode,
        customImage: finalCustomImage,
        imageSize: calloutFormImageSize,
        hidePin: calloutFormHidePin,
        pinOffsetX: calloutFormHidePin ? 0 : calloutFormPinOffsetX,
        pinOffsetY: calloutFormHidePin ? 0 : calloutFormPinOffsetY,
        level: mapData.lowerImage ? calloutFormLevel : undefined,
        area: areaObj,
        descriptionDe: calloutFormDescDe.trim() || `${calloutFormName.trim()} Position`,
        descriptionEn: calloutFormDescEn.trim() || `${calloutFormName.trim()} position`,
        tacticalTipDe: calloutFormTipDe.trim() || 'Winkel beachten und Granaten nutzen.',
        tacticalTipEn: calloutFormTipEn.trim() || 'Check crossfire angles and use utility.',
        commonAnglesDe: calloutFormAnglesDe.trim() || 'Haupteingänge',
        commonAnglesEn: calloutFormAnglesEn.trim() || 'Main approaches',
        isCustom: true,
      };
      handleMapUpdate({ ...mapData, callouts: [...mapData.callouts, newCallout] });
    }

    setIsAddingCallout(false);
    setIsDrawingPolygonArea(false);
    setEditingCallout(null);
    setPendingCalloutCoords(null);
  };

  // Complete and persist custom polygon area immediately
  const handleFinishPolygonArea = (pointsToUse: { x: number; y: number }[]) => {
    if (pointsToUse.length < 3) return;
    const xs = pointsToUse.map((p) => p.x);
    const ys = pointsToUse.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const avgX = Math.round((xs.reduce((a, b) => a + b, 0) / pointsToUse.length) * 10) / 10;
    const avgY = Math.round((ys.reduce((a, b) => a + b, 0) / pointsToUse.length) * 10) / 10;

    const newArea: CalloutArea = {
      x: Math.round(minX * 10) / 10,
      y: Math.round(minY * 10) / 10,
      width: Math.max(1, Math.round((maxX - minX) * 10) / 10),
      height: Math.max(1, Math.round((maxY - minY) * 10) / 10),
      shape: 'polygon',
      points: [...pointsToUse],
    };

    setCalloutFormHasArea(true);
    setCalloutFormAreaShape('polygon');
    setCalloutFormAreaPoints([...pointsToUse]);
    setCalloutFormAreaX(newArea.x);
    setCalloutFormAreaY(newArea.y);
    setCalloutFormAreaWidth(newArea.width);
    setCalloutFormAreaHeight(newArea.height);
    setShowAreas(true);

    if (editingCallout) {
      const updated = mapData.callouts.map((c) =>
        c.id === editingCallout.id
          ? {
              ...c,
              area: {
                ...newArea,
                customColor: c.area?.customColor,
              },
            }
          : c
      );
      handleMapUpdate({ ...mapData, callouts: updated });
      setEditingCallout((prev) =>
        prev
          ? {
              ...prev,
              area: {
                ...newArea,
                customColor: prev.area?.customColor,
              },
            }
          : null
      );
    } else {
      setPendingCalloutCoords({ x: avgX, y: avgY });
      if (!calloutFormName.trim()) {
        setCalloutFormName(isDe ? `Bereich ${mapData.callouts.length + 1}` : `Area ${mapData.callouts.length + 1}`);
      }
    }

    setIsDrawingPolygonArea(false);
    setIsAddingCallout(true);
  };

  const handleTryBack = () => {
    if (hasChangesInSession) {
      setShowSyncPrompt(true);
    } else {
      onBack();
    }
  };

  const handleDiscardAndExit = () => {
    onUpdateMap(initialMapDataRef.current, true);
    setHasChangesInSession(false);
    setShowSyncPrompt(false);
    if (onGoHome) onGoHome();
    else onBack();
  };

  const handleConfirmSync = async (doSync: boolean, targetUser?: User | null) => {
    const userToUse = targetUser || currentUser;
    if (!doSync || !userToUse) {
      // Save locally only
      const updated = { ...mapData, updatedAt: Date.now() };
      onUpdateMap(updated, true);
      setHasChangesInSession(false);
      setShowSyncPrompt(false);
      if (onGoHome) onGoHome();
      else onBack();
      return;
    }

    // Cloud sync requested: check if cloud has newer version
    setIsSyncing(true);
    try {
      const { map: cloudMap, updatedAt: cloudUpdatedAt } = await getCloudMap(
        userToUse.uid,
        mapData.id
      );
      const sessionStart = initialMapTimestampRef.current || 0;

      // Conflict if cloud map exists, has newer timestamp than session start,
      // and has callout differences vs initial snapshot
      const hasConflict = Boolean(
        cloudMap &&
        cloudUpdatedAt > sessionStart &&
        JSON.stringify(cloudMap.callouts) !== JSON.stringify(initialMapDataRef.current.callouts)
      );

      if (hasConflict && cloudMap) {
        setConflictCloudMap(cloudMap);
        setShowSyncPrompt(false);
        setShowConflictModal(true);
        setIsSyncing(false);
        return;
      }

      // No conflict -> normal upload
      const updated = { ...mapData, updatedAt: Date.now() };
      onUpdateMap(updated, false);
      setHasChangesInSession(false);
      setShowSyncPrompt(false);
      if (onGoHome) onGoHome();
      else onBack();

      await syncUserMap(userToUse.uid, updated);
    } catch (err) {
      console.warn('Conflict check or cloud sync failed, saving locally:', err);
      const updated = { ...mapData, updatedAt: Date.now() };
      onUpdateMap(updated, true);
      setHasChangesInSession(false);
      setShowSyncPrompt(false);
      if (onGoHome) onGoHome();
      else onBack();
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. Smart Merge (Keep changes & merge with cloud)
  const handleSmartMerge = async () => {
    if (!conflictCloudMap || !currentUser) return;
    setIsProcessingConflict(true);
    try {
      // 1. App lädt die neuere Karte herunter (conflictCloudMap)
      // 2. Wendet soeben lokal vorgenommene Änderungen auf diesen Cloud-Stand an
      const merged = smartMergeMap(mapData, conflictCloudMap);
      merged.updatedAt = Date.now();

      // 3. Das kombinierte Ergebnis erhält einen neuen Zeitstempel (updatedAt = jetzt) und wird sofort hochgeladen
      onUpdateMap(merged, true);
      await syncUserMap(currentUser.uid, merged);

      setShowConflictModal(false);
      setHasChangesInSession(false);
      if (onGoHome) onGoHome();
      else onBack();
    } catch (err) {
      console.error('Smart merge failed:', err);
    } finally {
      setIsProcessingConflict(false);
    }
  };

  // 2. Discard & load cloud version
  const handleDiscardAndLoadCloud = () => {
    if (!conflictCloudMap) return;
    onUpdateMap(conflictCloudMap, true);
    setShowConflictModal(false);
    setHasChangesInSession(false);
    if (onGoHome) onGoHome();
    else onBack();
  };

  // 3. Save locally only on this device
  const handleSaveLocallyOnly = () => {
    const updated = { ...mapData, updatedAt: Date.now() };
    onUpdateMap(updated, true);
    setShowConflictModal(false);
    setHasChangesInSession(false);
    if (onGoHome) onGoHome();
    else onBack();
  };

  // 4. Cancel conflict dialog (stay in editor)
  const handleCancelConflict = () => {
    setShowConflictModal(false);
  };

  // Delete Callout
  const handleDeleteCallout = (calloutId: string) => {
    const updated = {
      ...mapData,
      callouts: mapData.callouts.filter((c) => c.id !== calloutId),
    };
    handleMapUpdate(updated);
    if (selectedCallout?.id === calloutId) setSelectedCallout(null);
    if (editingCallout?.id === calloutId) {
      setIsAddingCallout(false);
      setEditingCallout(null);
    }
  };

  // Filter callouts by zone or single-edit focus
  const visibleCallouts = mapData.callouts.filter((c) => {
    if (singleEditCalloutId) {
      return c.id === singleEditCalloutId;
    }
    if (selectedZoneFilter === 'all') return true;
    return c.zone === selectedZoneFilter;
  });

  // Color System Helpers: T-SPAWN = BRAUN, CT-SPAWN = BLAU, Rest so belassen!
  const getZoneBadgeColor = (zone: ZoneType) => {
    switch (zone) {
      case 'a_site':
      case 'b_site':
        // Bombenplätze: Rot
        return 'bg-red-500/20 text-red-300 border-red-500/50';
      case 'mid':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
      case 't_spawn':
        // T-Spawn: Braun
        return 'bg-amber-900/40 text-amber-200 border-amber-700/60';
      case 'ct_spawn':
        // CT-Spawn: Blau
        return 'bg-blue-600/25 text-blue-300 border-blue-500/60';
      default:
        return 'bg-zinc-700/30 text-zinc-300 border-zinc-600/50';
    }
  };

  const getDangerBadge = (danger: DangerLevel) => {
    switch (danger) {
      case 'high':
        return {
          label: isDe ? 'Hohe Gefahr' : 'High Danger',
          classes: 'bg-red-500/20 text-red-300 border-red-500/50',
          dot: 'bg-red-500',
        };
      case 'medium':
        return {
          label: isDe ? 'Mittlere Gefahr' : 'Medium Danger',
          classes: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          dot: 'bg-amber-500',
        };
      case 'low':
        return {
          label: isDe ? 'Geringe Gefahr' : 'Low Danger',
          classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
          dot: 'bg-emerald-500',
        };
    }
  };

  // Dynamic Callout Pin Color according to active colorMode
  const getPinColorClass = (callout: Callout, mode: ColorMode) => {
    if (mode === 'danger') {
      switch (callout.danger) {
        case 'high':
          return 'bg-red-500';
        case 'medium':
          return 'bg-amber-400';
        case 'low':
          return 'bg-emerald-400';
      }
    }
    // Zone mode
    switch (callout.zone) {
      case 'a_site':
      case 'b_site':
        return 'bg-red-500'; // Bombenplatz Rot
      case 'mid':
        return 'bg-emerald-400';
      case 't_spawn':
        return 'bg-amber-800'; // Tactical Braun
      case 'ct_spawn':
        return 'bg-blue-600'; // Tactical Blau
      default:
        return 'bg-zinc-200';
    }
  };

  // Dynamic TotalCSGO Area styling according to rules:
  // - Bombenplätze (A-Site & B-Site) -> Rote quere Streifen!
  // - CT-Spawn -> Blau
  // - T-Spawn -> Braun
  // - Gefahrenstufe: Rot (Hoch), Gelb (Mittel), Grün (Gering)
  const getAreaStyling = (
    callout: Callout,
    mode: ColorMode
  ): { background: string; backgroundImage?: string; borderColor: string; textColor: string } => {
    // Check if custom color override is present
    if (callout.area?.customColor) {
      const c = callout.area.customColor;
      return {
        background: `${c}33`,
        borderColor: c,
        textColor: c,
      };
    }

    // 1. Bombenplätze (A-Site & B-Site) -> Rote quere Streifen (Red transverse stripes)
    if (callout.zone === 'a_site' || callout.zone === 'b_site') {
      return {
        background: 'rgba(239, 68, 68, 0.20)',
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.5) 0px, rgba(239, 68, 68, 0.5) 8px, rgba(120, 20, 20, 0.15) 8px, rgba(120, 20, 20, 0.15) 16px)',
        borderColor: '#ef4444',
        textColor: '#fca5a5',
      };
    }

    // 2. CT-Spawn -> Blau
    if (callout.zone === 'ct_spawn') {
      return {
        background: 'rgba(37, 99, 235, 0.28)',
        borderColor: '#2563eb',
        textColor: '#93c5fd',
      };
    }

    // 3. T-Spawn -> Braun
    if (callout.zone === 't_spawn') {
      return {
        background: 'rgba(146, 64, 14, 0.35)',
        borderColor: '#92400e',
        textColor: '#fde68a',
      };
    }

    // 4. Gefahrenstufe (Rot für Hoch, Gelb für Mittel, Grün für Gering)
    switch (callout.danger) {
      case 'high':
        return {
          background: 'rgba(239, 68, 68, 0.25)',
          borderColor: '#ef4444',
          textColor: '#fca5a5',
        };
      case 'medium':
        return {
          background: 'rgba(245, 158, 11, 0.22)',
          borderColor: '#f59e0b',
          textColor: '#fcd34d',
        };
      case 'low':
        return {
          background: 'rgba(34, 197, 94, 0.20)',
          borderColor: '#22c55e',
          textColor: '#86efac',
        };
      default:
        return {
          background: 'rgba(245, 158, 11, 0.22)',
          borderColor: '#f59e0b',
          textColor: '#fcd34d',
        };
    }
  };

  const currentDraggedCallout = mapData.callouts.find((c) => c.id === draggingCalloutId);

  const renderMapTile = (tileLevel: 'upper' | 'lower') => {
    const isLower = tileLevel === 'lower';
    const tileImage = isLower && mapData.lowerImage ? mapData.lowerImage : mapData.image;
    const tileCallouts = visibleCallouts.filter((c) =>
      isCalloutForLevel(c, tileLevel, Boolean(mapData.lowerImage))
    );
    const isBothMode = currentLevel === 'both';

    return (
      <div
        key={`tile_${tileLevel}`}
        id={isLower ? 'map-tile-lower' : 'map-tile-upper'}
        data-level={tileLevel}
        className={`map-canvas-tile relative ${
          isBothMode
            ? 'w-[680px] md:w-[750px] lg:w-[820px] xl:w-[850px]'
            : 'w-full max-w-[850px]'
        } aspect-square select-none rounded-lg overflow-visible shrink-0 transition-shadow ${
          isLower
            ? 'border-2 border-purple-500/80 ring-1 ring-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.35)] bg-zinc-900'
            : 'border border-zinc-800 bg-zinc-900 shadow-2xl'
        }`}
      >
        {/* Floor Level Badge */}
        {mapData.lowerImage && (
          <div
            className={`absolute top-3 left-3 z-30 px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-xs pointer-events-none select-none ${
              isLower
                ? 'bg-purple-950/90 border border-purple-500/70 text-purple-200 shadow-purple-950/50'
                : 'bg-zinc-900/90 border border-zinc-700/80 text-zinc-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLower ? 'bg-purple-400 animate-pulse' : 'bg-zinc-300'
              }`}
            />
            <span>
              {isLower
                ? isDe
                  ? 'U (Unten)'
                  : 'Lower (U)'
                : isDe
                ? 'O (Oben)'
                : 'Upper (O)'}
            </span>
          </div>
        )}

        {/* Background Radar Image (Clipped inside frame) */}
        <div className="absolute inset-0 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
          <img
            src={resolveAssetPath(tileImage)}
            alt={`${mapData.name} ${isLower ? 'Lower' : 'Upper'} Radar Map`}
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/icon.svg';
            }}
          />
        </div>

        {/* Center Origin Indicator (0,0) */}
        {!isDrawingPolygonArea && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center opacity-25 hover:opacity-75 transition-opacity">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div className="absolute w-full h-[1px] bg-amber-400"></div>
              <div className="absolute h-full w-[1px] bg-amber-400"></div>
              <div className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-black/50"></div>
              <span className="absolute bottom-[-16px] text-[9px] font-mono font-bold text-amber-400 bg-black/70 px-1 rounded">
                0,0
              </span>
            </div>
          </div>
        )}

        {/* TOTALCSGO-STYLE AREA ZONES (RECHTECKE) */}
        {!isDrawingPolygonArea &&
          showAreas &&
          tileCallouts.map((callout) => {
            if (!callout.area || callout.area.shape === 'polygon' || (callout.area.points && callout.area.points.length >= 3)) return null;
            const isHovered = hoveredCallout?.id === callout.id;
            const isSelected = selectedCallout?.id === callout.id;
            const areaStyle = getAreaStyling(callout, colorMode);

            return (
              <div
                key={`area_${tileLevel}_${callout.id}`}
                style={{
                  left: `calc(50% + ${callout.area.x}%)`,
                  top: `calc(50% + ${callout.area.y}%)`,
                  width: `${callout.area.width}%`,
                  height: `${callout.area.height}%`,
                  backgroundColor: areaStyle.background,
                  backgroundImage: areaStyle.backgroundImage,
                  borderColor: areaStyle.borderColor,
                  transform: `rotate(${callout.rotation || 0}deg)`,
                  transformOrigin: 'center center',
                }}
                onMouseEnter={() => !isEditMode && setHoveredCallout(callout)}
                onMouseLeave={() => !isEditMode && setHoveredCallout(null)}
                onClick={(e) => {
                  if (!isEditMode && !hasMovedDistance) {
                    e.stopPropagation();
                    setSelectedCallout(callout);
                    setHighlightedCalloutId(callout.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleOpenCalloutEditor(callout, e);
                }}
                className={`absolute rounded-sm border transition-all ${
                  isEditMode
                    ? 'border-dashed border-2 cursor-move z-40'
                    : isHovered || isSelected
                    ? 'border-2 shadow-lg ring-1 ring-white/50 z-20 cursor-pointer scale-[1.01]'
                    : 'border-1 border-opacity-70 z-10 cursor-pointer hover:border-opacity-100'
                }`}
              >
                {isEditMode && (
                  <>
                    <div
                      onMouseDown={(e) => handleAreaMoveStart(callout, e)}
                      onTouchStart={(e) => handleAreaMoveStart(callout, e)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleOpenCalloutEditor(callout, e);
                      }}
                      className="absolute inset-0 flex items-center justify-center cursor-move z-50 pointer-events-auto"
                      title={isDe ? 'Bereich verschieben (Callout bleibt zentriert)' : 'Move area (Callout stays centered)'}
                    >
                      <div className="p-1 rounded bg-zinc-950/90 border border-zinc-700 text-zinc-200 hover:text-amber-400 shadow-md">
                        <Move className="w-3 h-3" />
                      </div>
                    </div>
                    <div
                      onMouseDown={(e) => handleAreaResizeStart(callout, e)}
                      onTouchStart={(e) => handleAreaResizeStart(callout, e)}
                      className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-sm bg-amber-400 border border-zinc-950 cursor-nwse-resize hover:scale-125 transition-transform shadow-md z-50 pointer-events-auto"
                      title={isDe ? 'Größe anpassen' : 'Resize area'}
                    />
                    <div
                      onMouseDown={(e) => handleAreaRotationStart(callout, e)}
                      onTouchStart={(e) => handleAreaRotationStart(callout, e)}
                      className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-amber-400 border border-zinc-950 flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-125 transition-transform shadow-lg z-50 pointer-events-auto"
                      title={isDe ? `Frei drehen (Aktuell: ${callout.rotation || 0}°)` : `Free rotate (Current: ${callout.rotation || 0}°)`}
                    >
                      <RotateCw className="w-3 h-3 text-zinc-950 pointer-events-none" />
                    </div>
                  </>
                )}
              </div>
            );
          })}

        {/* SVG OVERLAY FOR TACTICAL DRAWING & ERASER */}
        <svg
          className={`absolute inset-0 w-full h-full overflow-visible z-15 ${
            activeTool === 'eraser' ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
          }`}
          viewBox="-50 -50 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            {colors.map((c) => {
              const colorId = c.replace('#', '');
              return (
                <marker
                  key={`arrow_${colorId}_${tileLevel}`}
                  id={`arrow-${colorId}-${tileLevel}`}
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill={c} />
                </marker>
              );
            })}
            <marker
              id={`arrow-eraser-${tileLevel}`}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
            </marker>
            <pattern
              id={`area-stripes-red-${tileLevel}`}
              width="4"
              height="4"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="4" height="4" fill="rgba(239, 68, 68, 0.2)" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="#ef4444" strokeWidth="1.5" strokeOpacity="0.75" />
              <line x1="2" y1="0" x2="2" y2="4" stroke="#7f1d1d" strokeWidth="1.5" strokeOpacity="0.35" />
            </pattern>
          </defs>

          {/* SAVED CUSTOM POLYGON AREAS */}
          {!isDrawingPolygonArea &&
            showAreas &&
            tileCallouts
              .filter((c) => c.area && (c.area.shape === 'polygon' || (c.area.points && c.area.points.length >= 3)))
              .map((callout) => {
                const area = callout.area!;
                const pts = area.points!;
                const ptsString = pts.map((p) => `${p.x},${p.y}`).join(' ');
                const isHovered = hoveredCallout?.id === callout.id;
                const isSelected = selectedCallout?.id === callout.id;
                const isBombsite = callout.zone === 'a_site' || callout.zone === 'b_site';
                const areaStyle = getAreaStyling(callout, colorMode);

                const fillValue = area.customColor
                  ? `${area.customColor}33`
                  : isBombsite
                  ? `url(#area-stripes-red-${tileLevel})`
                  : areaStyle.background;

                const strokeValue = area.customColor || areaStyle.borderColor || '#38bdf8';

                return (
                  <g key={`poly_${tileLevel}_${callout.id}`}>
                    <polygon
                      points={ptsString}
                      fill={fillValue}
                      stroke={strokeValue}
                      strokeWidth={isHovered || isSelected ? 1.0 : 0.5}
                      strokeDasharray={isEditMode ? '1,1' : undefined}
                      className="pointer-events-auto cursor-pointer transition-all"
                      onMouseEnter={() => !isEditMode && setHoveredCallout(callout)}
                      onMouseLeave={() => !isEditMode && setHoveredCallout(null)}
                      onClick={(e) => {
                        if (!isEditMode && !hasMovedDistance) {
                          e.stopPropagation();
                          setSelectedCallout(callout);
                          setHighlightedCalloutId(callout.id);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleOpenCalloutEditor(callout, e as unknown as React.MouseEvent);
                      }}
                    />
                  </g>
                );
              })}

          {/* LIVE POLYGON DRAWING PREVIEW */}
          {isDrawingPolygonArea && calloutFormAreaPoints.length > 0 && (
            <g className="pointer-events-none">
              {calloutFormAreaPoints.length >= 3 && (
                <polygon
                  points={calloutFormAreaPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(56, 189, 248, 0.2)"
                  stroke="none"
                />
              )}
              <polyline
                points={calloutFormAreaPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={0.8}
                strokeDasharray="1,1"
              />
              {polygonHoverCoord && (
                <line
                  x1={calloutFormAreaPoints[calloutFormAreaPoints.length - 1].x}
                  y1={calloutFormAreaPoints[calloutFormAreaPoints.length - 1].y}
                  x2={polygonHoverCoord.x}
                  y2={polygonHoverCoord.y}
                  stroke="#38bdf8"
                  strokeWidth={0.6}
                  strokeDasharray="0.8,0.8"
                  opacity="0.8"
                />
              )}
              {calloutFormAreaPoints.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={idx === 0 ? 1.4 : 0.9}
                    fill={idx === 0 ? '#f59e0b' : '#38bdf8'}
                    stroke="#000"
                    strokeWidth={0.3}
                  />
                </g>
              ))}
            </g>
          )}

          {/* SAVED TACTICAL DRAWING LINES */}
          {!isDrawingPolygonArea &&
            drawings.map((line) => {
              const isEraserHovered = hoveredLineId === line.id && activeTool === 'eraser';
              const arrowColorId = (line.color || '#ffffff').replace('#', '');
              return (
                <g key={line.id}>
                  <polyline
                    points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={isEraserHovered ? '#ef4444' : line.color}
                    strokeWidth={line.width * 0.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={isEraserHovered ? '2,2' : undefined}
                    markerEnd={line.hasArrow ? `url(#arrow-${isEraserHovered ? 'ef4444' : arrowColorId}-${tileLevel})` : undefined}
                    onMouseEnter={() => setHoveredLineId(line.id)}
                    onMouseLeave={() => setHoveredLineId(null)}
                    onClick={(e) => {
                      if (activeTool === 'eraser') {
                        e.stopPropagation();
                        handleDeleteSingleLine(line.id);
                      }
                    }}
                    className={activeTool === 'eraser' ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
                  />
                </g>
              );
            })}

          {/* Real-time stroke while drawing */}
          {currentDrawing && currentDrawing.points.length > 1 && (
            <polyline
              points={currentDrawing.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={currentDrawing.color}
              strokeWidth={0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={currentDrawing.hasArrow ? `url(#arrow-${(currentDrawing.color || '#ffffff').replace('#', '')}-${tileLevel})` : undefined}
            />
          )}
        </svg>

        {/* UTILITY MARKERS */}
        {!isDrawingPolygonArea &&
          utilities.map((util) => (
            <div
              key={util.id}
              style={{ left: `calc(50% + ${util.x}%)`, top: `calc(50% + ${util.y}%)` }}
              onClick={(e) => {
                e.stopPropagation();
                setUtilities((prev) => prev.filter((u) => u.id !== util.id));
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-25 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black uppercase shadow-lg border border-black/40 cursor-pointer hover:scale-125 transition-transform bg-zinc-200 text-zinc-950"
              title={isDe ? 'Klicken zum Entfernen' : 'Click to remove'}
            >
              {util.type}
            </div>
          ))}

        {/* PLAYER TOKENS */}
        {!isDrawingPolygonArea &&
          players.map((player) => (
            <div
              key={player.id}
              style={{ left: `calc(50% + ${player.x}%)`, top: `calc(50% + ${player.y}%)` }}
              onClick={(e) => {
                e.stopPropagation();
                setPlayers((prev) => prev.filter((p) => p.id !== player.id));
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-25 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-black shadow-lg border border-black/50 cursor-pointer hover:scale-125 transition-transform ${
                player.side === 'ct'
                  ? 'bg-blue-600 text-white ring-1 ring-white/60'
                  : 'bg-amber-800 text-amber-100 ring-1 ring-white/60'
              }`}
              title={isDe ? 'Klicken zum Entfernen' : 'Click to remove'}
            >
              {player.hasBomb ? 'C4' : player.number}
            </div>
          ))}

        {/* INTERACTIVE CALLOUT PINS & ROTATABLE LABELS */}
        {!isDrawingPolygonArea &&
          tileCallouts.map((callout) => {
            const isSelected = selectedCallout?.id === callout.id;
            const isHighlighted = highlightedCalloutId === callout.id;
            const isBeingDragged = draggingCalloutId === callout.id;
            const pinBgColor = getPinColorClass(callout, colorMode);

            const isImageMode = Boolean(
              (callout.displayMode === 'image' || callout.displayMode === 'both') &&
              callout.customImage
            );
            const showTextLabel = Boolean(
              showCalloutLabels && (!isImageMode || callout.displayMode === 'both' || callout.hidePin)
            );
            const calloutImgSize = Math.round((callout.imageSize || 36) * calloutScale);

            const dotSize = Math.round(14 * calloutScale);
            const baseFontSize = callout.fontSize || 12;
            const fontSize = Math.round(baseFontSize * calloutScale);

            const pinX = callout.x;
            const pinY = callout.y;
            const offX = Math.round((callout.pinOffsetX ?? 0) * calloutScale);
            const offY = Math.round((callout.pinOffsetY ?? 22) * calloutScale);

            return (
              <div
                key={`callout_${tileLevel}_${callout.id}`}
                style={{ left: `calc(50% + ${pinX}%)`, top: `calc(50% + ${pinY}%)` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 group flex items-center justify-center pointer-events-auto ${
                  isBeingDragged ? 'z-50' : 'z-25'
                }`}
                onMouseEnter={() => !draggingCalloutId && setHoveredCallout(callout)}
                onMouseLeave={() => setHoveredCallout(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isEditMode && !hasMovedDistance) {
                    setSelectedCallout(callout);
                    setHighlightedCalloutId(callout.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleOpenCalloutEditor(callout, e);
                }}
              >
                {!callout.hidePin && (
                  <div
                    className="absolute z-10 flex items-center justify-center pointer-events-auto"
                  >
                    {isImageMode ? (
                      <div
                        onMouseDown={(e) => handleCalloutDragStart(callout, e)}
                        onTouchStart={(e) => handleCalloutDragStart(callout, e)}
                        style={{
                          width: `${calloutImgSize}px`,
                          height: `${calloutImgSize}px`,
                        }}
                        className={`relative flex items-center justify-center transition-all select-none shrink-0 ${
                          isEditMode
                            ? 'cursor-grab active:cursor-grabbing hover:scale-110'
                            : isSelected || isHighlighted
                            ? 'scale-115 cursor-pointer'
                            : 'hover:scale-110 cursor-pointer'
                        }`}
                      >
                        {(isSelected || isHighlighted || isBeingDragged) && (
                          <span className="absolute -inset-2 rounded-full bg-white/40 animate-ping pointer-events-none" />
                        )}
                        <img
                          src={resolveAssetPath(callout.customImage)}
                          alt={callout.name}
                          draggable={false}
                          style={{
                            width: `${calloutImgSize}px`,
                            height: `${calloutImgSize}px`,
                            transform: `rotate(${callout.textRotation !== undefined ? callout.textRotation : (callout.rotation || 0)}deg)`,
                          }}
                          className={`rounded-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${
                            isBeingDragged
                              ? 'ring-4 ring-amber-400 scale-110'
                              : isSelected || isHighlighted
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-105'
                              : 'hover:brightness-110'
                          }`}
                        />
                      </div>
                    ) : (
                      <div
                        onMouseDown={(e) => handleCalloutDragStart(callout, e)}
                        onTouchStart={(e) => handleCalloutDragStart(callout, e)}
                        className={`relative flex items-center justify-center transition-transform shrink-0 ${
                          isEditMode
                            ? 'cursor-grab active:cursor-grabbing hover:scale-125'
                            : isSelected || isHighlighted
                            ? 'scale-125 cursor-pointer'
                            : 'hover:scale-115 cursor-pointer'
                        }`}
                      >
                        {(isSelected || isHighlighted || isBeingDragged) && (
                          <span className="absolute -inset-1.5 rounded-full bg-white/40 animate-ping pointer-events-none" />
                        )}

                        <div
                          style={{
                            width: `${dotSize}px`,
                            height: `${dotSize}px`,
                          }}
                          className={`rounded-full border-2 border-zinc-950 shadow-md flex items-center justify-center ${
                            isBeingDragged
                              ? 'ring-4 ring-amber-400 bg-white scale-125'
                              : pinBgColor
                          }`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ROTATABLE CALLOUT LABEL */}
                {showTextLabel && (
                  <div
                    onMouseDown={(e) => handleCalloutDragStart(callout, e)}
                    onTouchStart={(e) => handleCalloutDragStart(callout, e)}
                    style={{
                      fontSize: `${fontSize}px`,
                      fontFamily: getFontFamilyStyle(callout.fontFamily),
                      padding: `${Math.round(2 * calloutScale)}px ${Math.round(6 * calloutScale)}px`,
                      transform: `translate(${offX}px, ${offY}px) rotate(${callout.textRotation !== undefined ? callout.textRotation : (callout.rotation || 0)}deg)`,
                      transformOrigin: 'center center',
                    }}
                    className={`rounded font-bold tracking-tight whitespace-nowrap shadow-lg transition-transform shrink-0 relative z-20 ${
                      isEditMode
                        ? 'cursor-grab active:cursor-grabbing bg-zinc-950 border border-sky-400 text-sky-200 ring-1 ring-sky-400/50'
                        : isSelected || isHighlighted
                        ? 'bg-white text-zinc-950 scale-105 z-30 ring-1 ring-black'
                        : 'bg-zinc-950/85 text-zinc-200 border border-zinc-700/80 group-hover:bg-zinc-900 group-hover:text-white'
                    }`}
                  >
                    {callout.name}
                  </div>
                )}

                {/* EDIT MODE QUICK BAR */}
                {isEditMode && (
                  <div
                    style={{
                      top: callout.area
                        ? `calc(-${callout.area.height / 2}% - 18px)`
                        : isImageMode
                        ? `-${Math.round(calloutImgSize / 2 + 18)}px`
                        : '-22px',
                    }}
                    className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-zinc-900/95 rounded-lg border border-zinc-700 px-2 py-1 shadow-2xl z-[60] backdrop-blur-xs whitespace-nowrap"
                  >
                    {/* Quick Rotate +45° for Text */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentTextRot = callout.textRotation !== undefined ? callout.textRotation : (callout.rotation || 0);
                        let nextRot = currentTextRot + 45;
                        if (nextRot > 180) nextRot = -135;
                        const updated = mapData.callouts.map((c) =>
                          c.id === callout.id ? { ...c, textRotation: nextRot } : c
                        );
                        handleMapUpdate({ ...mapData, callouts: updated });
                      }}
                      className="text-zinc-300 hover:text-sky-400 p-0.5 transition-colors"
                      title={isDe ? 'Schrift separat drehen (+45°)' : 'Rotate text separately (+45°)'}
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>

                    {/* Edit Details Modal */}
                    <button
                      onClick={(e) => handleOpenCalloutEditor(callout, e)}
                      className="text-zinc-300 hover:text-white p-0.5 transition-colors"
                      title={isDe ? 'Callout bearbeiten (Details & Bereich)' : 'Edit callout'}
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    {/* Delete Callout */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCallout(callout.id);
                      }}
                      className="text-red-400 hover:text-red-300 p-0.5 transition-colors"
                      title={isDe ? 'Callout löschen' : 'Delete callout'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    );
  };

  return (
    <div
      ref={mainWrapperRef}
      onClick={handleOutsideClick}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden"
    >
      {/* 1. TOP HEADER BAR */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-950/95 px-2 sm:px-4 flex items-center justify-between gap-2 shrink-0 backdrop-blur-md overflow-x-auto no-scrollbar print:hidden">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={handleTryBack}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors shadow-xs"
            title={isDe ? 'Kartenübersicht' : 'Overview'}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden lg:inline">{isDe ? 'Kartenübersicht' : 'Overview'}</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2">
            <h1 className="text-xs sm:text-base font-extrabold uppercase tracking-wider text-white truncate max-w-[80px] sm:max-w-none">
              {mapData.name}
            </h1>
            <span className="text-[9px] sm:text-[11px] font-mono px-1 sm:px-2 py-0.5 rounded border border-zinc-800 text-zinc-500 hidden md:inline">
              {mapData.category === 'active'
                ? 'Active'
                : mapData.category === 'reserve'
                ? 'Reserve'
                : mapData.category === 'wingman'
                ? 'Wingman'
                : 'Custom'}
            </span>
          </div>

          {/* Floor Switcher */}
          {mapData.lowerImage && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <button
                onClick={() => setCurrentLevel('upper')}
                className={`px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-colors ${
                  currentLevel === 'upper'
                    ? 'bg-zinc-100 text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title={isDe ? 'Nur Obere Ebene (O)' : 'Upper floor only (O)'}
              >
                {isDe ? 'O' : 'U'}
              </button>
              <button
                onClick={() => setCurrentLevel('lower')}
                className={`px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-colors ${
                  currentLevel === 'lower'
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title={isDe ? 'Nur Untere Ebene (U)' : 'Lower floor only (U)'}
              >
                {isDe ? 'U' : 'L'}
              </button>
              <button
                onClick={() => setCurrentLevel('both')}
                className={`hidden md:inline-flex px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-colors ${
                  currentLevel === 'both'
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title={isDe ? 'Beide Ebenen nebeneinander (O + U)' : 'Both floors side-by-side (Upper + Lower)'}
              >
                {isDe ? 'O + U' : 'U + L'}
              </button>
            </div>
          )}
        </div>

        {/* Center: Zone Filter Buttons (Hidden on very small screens) */}
        <div className="hidden xl:flex items-center gap-1 p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs">
          <button
            onClick={() => setSelectedZoneFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
              selectedZoneFilter === 'all'
                ? 'bg-zinc-100 text-zinc-950 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {isDe ? 'Alle' : 'All'}
          </button>
          <button
            onClick={() => setSelectedZoneFilter('a_site')}
            className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
              selectedZoneFilter === 'a_site'
                ? 'bg-amber-400 text-zinc-950 font-bold'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}
          >
            A
          </button>
          <button
            onClick={() => setSelectedZoneFilter('b_site')}
            className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
              selectedZoneFilter === 'b_site'
                ? 'bg-sky-400 text-zinc-950 font-bold'
                : 'text-sky-400/80 hover:text-sky-300'
            }`}
          >
            B
          </button>
        </div>

        {/* Right Actions: Karte teilen & exportieren, Farbmodus, Farblegende, Bearbeiten, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* VEREINHEITLICHTER TEILEN / EXPORT BUTTON */}
          <button
            onClick={handleShareTactics}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-sky-500/40 bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 hover:text-white transition-all shadow-xs cursor-pointer"
            title={isDe ? 'Taktik / Karte teilen & exportieren (Link, QR, JSON, ZIP)' : 'Share & export tactic (Link, QR, JSON, ZIP)'}
          >
            <Share2 className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold hidden sm:inline">{isDe ? 'Teilen' : 'Share'}</span>
          </button>

          {/* COLOR MODE TOGGLE */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
            <button
              onClick={() => setColorMode('zone')}
              className={`p-1.5 rounded-md transition-all ${
                colorMode === 'zone'
                  ? 'bg-amber-400 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={isDe ? 'Zonen-Farben' : 'Zone colors'}
            >
              <Palette className="w-4 h-4" />
            </button>
            <button
              onClick={() => setColorMode('danger')}
              className={`p-1.5 rounded-md transition-all ${
                colorMode === 'danger'
                  ? 'bg-red-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={isDe ? 'Gefahren-Farben' : 'Danger levels'}
            >
              <Shield className="w-4 h-4" />
            </button>
          </div>

          {/* Legend */}
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
              showLegend
                ? 'border-zinc-400 bg-zinc-200 text-zinc-950 shadow-sm'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white'
            }`}
            title={isDe ? 'Farblegende' : 'Legend'}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </button>

          {/* Bearbeiten Haupt-Button */}
          <button
            onClick={() => {
              if (isEditMode || singleEditCalloutId) {
                setIsEditMode(false);
                setSingleEditCalloutId(null);
              } else {
                setIsEditOptionsModalOpen(true);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              isEditMode || singleEditCalloutId
                ? 'border-amber-400 bg-amber-400 text-zinc-950 shadow-md ring-2 ring-amber-400/30'
                : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:text-white hover:bg-zinc-800'
            }`}
            title={isDe ? 'Bearbeiten-Optionen (+Neu, Einzel-Bearbeitung, Alles Bearbeiten)' : 'Edit Options'}
          >
            {isEditMode || singleEditCalloutId ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{isDe ? 'Fertig' : 'Done'}</span>
              </>
            ) : (
              <>
                <Move className="w-3.5 h-3.5 text-amber-400" />
                <span>{isDe ? 'Bearbeiten' : 'Edit'}</span>
              </>
            )}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hidden sm:block"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. TACTICAL TOOLBAR: TOOLS, ERASER, UNDO/REDO, AREAS TOGGLE, TEXT SCALE, ZOOM */}
      <div className="relative z-50 min-h-12 border-b border-zinc-800/80 bg-zinc-900/90 px-2 sm:px-4 flex items-center justify-between gap-1.5 sm:gap-3 shrink-0 text-xs print:hidden overflow-visible">
        {/* Tactical tools */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-visible max-w-full">
          <button
            onClick={() => setActiveTool('select')}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTool === 'select'
                ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title={isDe ? 'Inspektor: Callouts & Infos auf der Karte anzeigen' : 'Inspect'}
          >
            <Crosshair className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{isDe ? 'Inspektor' : 'Inspect'}</span>
          </button>

          <button
            onClick={() => handleToolPress('pen', false)}
            onMouseDown={startPressTimer}
            onMouseUp={clearPressTimer}
            onMouseLeave={clearPressTimer}
            onTouchStart={startPressTimer}
            onTouchEnd={clearPressTimer}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTool === 'pen' && !penWithArrow
                ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            style={{ borderLeft: activeTool === 'pen' ? `4px solid ${penColor}` : undefined }}
            title={isDe ? 'Freihand Linie zeichnen' : 'Line'}
          >
            <Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{isDe ? 'Linie' : 'Line'}</span>
          </button>

          <button
            onClick={() => handleToolPress('arrow', true)}
            onMouseDown={startPressTimer}
            onMouseUp={clearPressTimer}
            onMouseLeave={clearPressTimer}
            onTouchStart={startPressTimer}
            onTouchEnd={clearPressTimer}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTool === 'arrow'
                ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            style={{ borderLeft: activeTool === 'arrow' ? `4px solid ${penColor}` : undefined }}
            title={isDe ? 'Pfeil (Rush) zeichnen' : 'Arrow'}
          >
            <Move className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{isDe ? 'Pfeil (Rush)' : 'Arrow'}</span>
          </button>

          {/* RADIERER (LÖSCHEN EINZELNER LINIEN / PFEILE) */}
          <button
            onClick={() => setActiveTool('eraser')}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              activeTool === 'eraser'
                ? 'bg-red-500 text-white shadow-xs font-bold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title={
              isDe
                ? 'Radierer: Klicke auf eine gezeichnete Linie oder einen Pfeil zum Löschen'
                : 'Eraser: Click on a drawn line or arrow to delete it'
            }
          >
            <Eraser className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{isDe ? 'Radierer' : 'Eraser'}</span>
          </button>

          {/* FARBPICKER DROPDOWN */}
          <div className="relative z-50">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-700/80 cursor-pointer"
              title={isDe ? 'Farbe wählen (7 Farben)' : 'Choose color (7 colors)'}
            >
              <div className="w-4 h-4 sm:w-3.5 sm:h-3.5 rounded-full border border-white/40 shadow-xs" style={{ backgroundColor: penColor }} />
              <span className="hidden sm:inline">{isDe ? 'Farbe' : 'Color'}</span>
            </button>
            {showColorPicker && (
              <div
                data-no-map-click="true"
                className="fixed top-16 left-1/2 -translate-x-1/2 sm:absolute sm:top-full sm:left-0 sm:translate-x-0 mt-1.5 p-2 bg-zinc-900/98 rounded-2xl sm:rounded-xl border border-zinc-700 shadow-2xl z-[200] flex items-center justify-center gap-2 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 max-w-[92vw] min-w-[240px]"
              >
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full border transition-transform hover:scale-115 active:scale-95 shrink-0 cursor-pointer ${
                      penColor === c ? 'border-amber-400 ring-2 ring-amber-400/50 scale-110' : 'border-zinc-600'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPenColor(c);
                      setShowColorPicker(false);
                    }}
                    title={c}
                  />
                ))}
              </div>
            )}
          </div>

          {/* UNDO & REDO CONTROLS */}
          <div className="flex items-center gap-0.5 border-l border-zinc-800 pl-1 ml-0.5">
            <button
              onClick={handleUndoDrawing}
              disabled={drawings.length === 0}
              className={`p-1.5 rounded transition-colors ${
                drawings.length > 0
                  ? 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  : 'text-zinc-600 cursor-not-allowed'
              }`}
              title={isDe ? 'Rückgängig (Strg+Z)' : 'Undo (Ctrl+Z)'}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedoDrawing}
              disabled={drawingsRedoStack.length === 0}
              className={`p-1.5 rounded transition-colors ${
                drawingsRedoStack.length > 0
                  ? 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  : 'text-zinc-600 cursor-not-allowed'
              }`}
              title={isDe ? 'Wiederholen (Strg+Y)' : 'Redo (Ctrl+Y)'}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            {(drawings.length > 0 || utilities.length > 0 || players.length > 0) && (
              <button
                onClick={handleClearTactics}
                className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800"
                title={isDe ? 'Gesamtes Board leeren' : 'Clear all board items'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. MAIN MAP STAGE */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* POLYGON DRAWING MODE FLOATING BANNER */}
        {isDrawingPolygonArea && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 sm:px-4 py-2 rounded-xl bg-zinc-950/95 border-2 border-sky-400 shadow-2xl backdrop-blur-md max-w-[92vw] sm:max-w-3xl pointer-events-auto text-xs text-white print:hidden">
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
              </span>
              <span className="font-extrabold uppercase tracking-wider text-[11px] sm:text-xs">
                {isDe ? 'Bereich zeichnen' : 'Draw Area'}
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                {calloutFormAreaPoints.length} {isDe ? 'Punkte' : 'Points'}
              </span>
            </div>

            <div className="text-[11px] text-zinc-300 hidden lg:block truncate max-w-xs">
              {isDe
                ? 'Klicke auf die Karte. Grünen Startpunkt oder "Verbinden" klicken.'
                : 'Click map. Click green start point or "Connect".'}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {calloutFormAreaPoints.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCalloutFormAreaPoints((prev) => prev.slice(0, -1));
                  }}
                  className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                >
                  ↶ {isDe ? 'Rückgängig' : 'Undo'}
                </button>
              )}

              {calloutFormAreaPoints.length >= 3 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFinishPolygonArea(calloutFormAreaPoints);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors shadow-md flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Verbinden' : 'Connect'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDrawingPolygonArea(false);
                  setIsAddingCallout(true);
                }}
                className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              >
                {isDe ? 'Abbrechen' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        <div
          style={{ touchAction: 'none' }}
          className={`relative flex-1 bg-zinc-950 flex items-center justify-center overflow-hidden ${
            isPanning
              ? 'cursor-grabbing'
              : activeTool === 'eraser'
              ? 'cursor-pointer'
              : activeTool === 'pen' || activeTool === 'arrow'
              ? 'cursor-crosshair'
              : isEditMode
              ? 'cursor-grab'
              : 'cursor-grab'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleMapCanvasClick}
          onDoubleClick={handleMapDoubleClick}
          onWheel={handleWheel}
        >
          {/* Zoomable & Pannable Container */}
          <div
            ref={mapContainerRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition:
                isPanning || draggingCalloutId || draggingAreaCalloutId || resizingAreaCalloutId
                  ? 'none'
                  : 'transform 0.05s ease-out',
            }}
            className={`relative select-none mx-auto ${
              currentLevel === 'both' && mapData.lowerImage
                ? 'flex flex-row items-center justify-center gap-6 w-auto'
                : 'w-full aspect-square max-w-[850px] shadow-2xl rounded-lg overflow-visible'
            }`}
          >
            {currentLevel === 'both' && mapData.lowerImage ? (
              <>
                {renderMapTile('upper')}
                {renderMapTile('lower')}
              </>
            ) : currentLevel === 'lower' && mapData.lowerImage ? (
              renderMapTile('lower')
            ) : (
              renderMapTile('upper')
            )}
          </div>

          {/* EDIT MODE AUTO-HIDE BANNER */}
          {!isDrawingPolygonArea && isEditMode && showEditBanner && (
            <div
              data-no-map-click="true"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowEditBanner(false);
              }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-200 text-xs font-semibold backdrop-blur-md shadow-2xl cursor-pointer hover:bg-amber-500/30 transition-all animate-in fade-in slide-in-from-top-2 duration-200 print:hidden"
              title={isDe ? 'Klicken zum Ausblenden' : 'Click to dismiss'}
            >
              <Move className="w-4 h-4 text-amber-400 animate-pulse shrink-0 pointer-events-none" />
              <span className="pointer-events-none select-none">
                {isDe
                  ? 'Callouts bleiben zentriert im Bereich • Schrift per Icon drehen • Klicke freie Stelle für neuen Callout'
                  : 'Callout stays centered in area • Rotate text • Click empty map to add callout'}
              </span>
            </div>
          )}

          {/* SINGLE-EDIT ACTIVE FLOATING BANNER */}
          {!isDrawingPolygonArea && singleEditCalloutId && (
            <div
              data-no-map-click="true"
              className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 px-4 py-2 rounded-xl bg-sky-950/95 border-2 border-sky-400 text-sky-100 text-xs font-semibold backdrop-blur-md shadow-2xl print:hidden max-w-[92vw]"
            >
              <div className="flex items-center gap-2 shrink-0">
                <Crosshair className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
                <span>
                  {isDe ? 'Einzel-Bearbeitung:' : 'Single Edit:'}{' '}
                  <strong className="text-sky-300 font-extrabold">
                    {mapData.callouts.find((c) => c.id === singleEditCalloutId)?.name || 'Callout'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditOptionsModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-sky-800 hover:bg-sky-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                >
                  {isDe ? 'Anderes Callout' : 'Switch Callout'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSingleEditCalloutId(null);
                    setIsEditMode(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-200 font-bold text-[11px] transition-colors cursor-pointer"
                  title={isDe ? 'Einzel-Bearbeitung beenden' : 'Exit single edit'}
                >
                  {isDe ? 'Beenden' : 'Exit'}
                </button>
              </div>
            </div>
          )}

          {/* FLOATING HOVER CARD */}
          {!isDrawingPolygonArea && hoveredCallout && !selectedCallout && !isEditMode && (
            <div className="absolute bottom-5 left-5 z-40 max-w-sm rounded-xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md text-zinc-100 pointer-events-none animate-in fade-in-50 duration-150 print:hidden">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-extrabold text-sm text-white">
                  {hoveredCallout.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getZoneBadgeColor(
                      hoveredCallout.zone
                    )}`}
                  >
                    {hoveredCallout.zone.replace('_', ' ')}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      getDangerBadge(hoveredCallout.danger).classes
                    }`}
                  >
                    {getDangerBadge(hoveredCallout.danger).label}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-300 mb-2">
                {isDe ? hoveredCallout.descriptionDe : hoveredCallout.descriptionEn}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="text-amber-400 font-semibold">{isDe ? 'Tipp:' : 'Tip:'}</span>
                <span className="line-clamp-1">
                  {isDe ? hoveredCallout.tacticalTipDe : hoveredCallout.tacticalTipEn}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 4. PINNED TACTICAL INSPECTOR SIDEBAR */}
        {!isDrawingPolygonArea && selectedCallout && !isEditMode && (
          <aside className="w-80 sm:w-96 border-l border-zinc-800 bg-zinc-900/95 p-5 flex flex-col justify-between overflow-y-auto z-40 backdrop-blur-md shrink-0 shadow-2xl animate-in slide-in-from-right-10 duration-200 print:hidden">
            <div>
              <div className="flex items-start justify-between pb-3 border-b border-zinc-800 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getZoneBadgeColor(
                        selectedCallout.zone
                      )}`}
                    >
                      {selectedCallout.zone.replace('_', ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        getDangerBadge(selectedCallout.danger).classes
                      }`}
                    >
                      {getDangerBadge(selectedCallout.danger).label}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white">{selectedCallout.name}</h2>
                </div>
                <button
                  onClick={() => setSelectedCallout(null)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4">
                <span className="block text-xs font-mono uppercase text-zinc-500 mb-1">
                  {isDe ? 'Positionsbeschreibung' : 'Position Overview'}
                </span>
                <p className="text-sm text-zinc-200 leading-relaxed">
                  {isDe ? selectedCallout.descriptionDe : selectedCallout.descriptionEn}
                </p>
              </div>

              <div className="mb-4 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Taktische Empfehlungen' : 'Tactical Briefing'}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {isDe ? selectedCallout.tacticalTipDe : selectedCallout.tacticalTipEn}
                </p>
              </div>

              <div className="mb-4">
                <span className="block text-xs font-mono uppercase text-zinc-500 mb-1">
                  {isDe ? 'Typische Blickwinkel & Gefahrenzonen' : 'Common Angles & Crossfires'}
                </span>
                <p className="text-xs font-mono text-zinc-300 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
                  {isDe ? selectedCallout.commonAnglesDe : selectedCallout.commonAnglesEn}
                </p>
              </div>

              {selectedCallout.area && (
                <div className="mb-4 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs">
                  <span className="block font-mono uppercase text-zinc-400 font-bold mb-1">
                    {isDe ? 'Zonenbereich (TotalCSGO-Stil)' : 'Zone Area Boundary'}
                  </span>
                  <div className="text-zinc-400 text-[11px]">
                    {isDe
                      ? `Rechteck: ${selectedCallout.area.width}% × ${selectedCallout.area.height}% auf der Karte (Callout zentriert)`
                      : `Rectangle: ${selectedCallout.area.width}% × ${selectedCallout.area.height}% on radar (Callout centered)`}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-500">
                Koord: {selectedCallout.x}% / {selectedCallout.y}%
                {selectedCallout.rotation ? ` • ${selectedCallout.rotation}°` : ''}
              </span>
              <button
                onClick={() => setSelectedCallout(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
              >
                {isDe ? 'Schließen' : 'Close'}
              </button>
            </div>
          </aside>
        )}
        {/* BOTTOM FLOATING CONTROL BAR (Areas, Text Scale, Zoom) */}
        {!isDrawingPolygonArea && (
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto z-30 flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-md text-xs print:hidden">
          {/* TotalCSGO-Style Area Toggle */}
          <button
            onClick={() => setShowAreas(!showAreas)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              showAreas
                ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={isDe ? 'TotalCSGO Zonenbereiche ein- oder ausblenden' : 'Toggle TotalCSGO areas'}
          >
            <Square className={`w-3.5 h-3.5 ${showAreas ? 'text-amber-400' : 'text-zinc-500'}`} />
            <span>{isDe ? 'Bereiche' : 'Areas'}</span>
          </button>

          {/* CALLOUT LABEL SIZE SCALE CONTROL */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 rounded-lg border border-zinc-800">
            <Type className="w-3.5 h-3.5 text-zinc-400" />
            <button
              onClick={() => setCalloutScale((prev) => Math.max(0.4, Math.round((prev - 0.1) * 10) / 10))}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              title={isDe ? 'Beschriftung verkleinern' : 'Decrease text size'}
            >
              A-
            </button>
            <span className="text-[11px] font-mono font-bold text-zinc-200 min-w-[32px] text-center">
              {Math.round(calloutScale * 100)}%
            </span>
            <button
              onClick={() => setCalloutScale((prev) => Math.min(2.0, Math.round((prev + 0.1) * 10) / 10))}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              title={isDe ? 'Beschriftung vergrößern' : 'Increase text size'}
            >
              A+
            </button>
            <button
              onClick={() => setShowCalloutLabels(!showCalloutLabels)}
              className="p-1 rounded text-zinc-400 hover:text-white border-l border-zinc-800 pl-1.5 ml-0.5"
              title={showCalloutLabels ? 'Beschriftung ausblenden' : 'Beschriftung einblenden'}
            >
              {showCalloutLabels ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-500" />}
            </button>
          </div>

          {/* CONTINUOUS ZOOM BAR */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 rounded-lg border border-zinc-800">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded text-zinc-400 hover:text-white"
              title="Zoom -5%"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="10"
              max="200"
              step="1"
              value={Math.round(zoom * 100)}
              onChange={(e) => handleZoomChange(Number(e.target.value) / 100)}
              className="w-20 accent-zinc-100 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              title={`${Math.round(zoom * 100)}%`}
            />
            <button
              onClick={handleZoomIn}
              className="p-1 rounded text-zinc-400 hover:text-white"
              title="Zoom +5%"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold text-zinc-100 min-w-[36px] text-right">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => {
                setZoom(isFullscreen ? 1.0 : 0.75);
                setPan({ x: 0, y: 0 });
              }}
              className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 ml-1 border border-zinc-700"
              title={isDe ? 'Zoom auf Standard zurücksetzen (75%)' : 'Reset zoom to fit (75%)'}
            >
              Fit
            </button>
          </div>
        </div>
        )}
      </div>

      {/* 5. COLOR EXPLANATION / LEGENDE MODAL (ZONEN & GEFAHRENSTUFEN) */}
      {showLegend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 print:hidden">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  {isDe ? 'Taktische Farbwahl & Farblegende' : 'Tactical Color System Legend'}
                </h3>
              </div>
              <button
                onClick={() => setShowLegend(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                <div className="font-bold text-zinc-200 mb-1">
                  {isDe ? 'Aktueller Farbmodus:' : 'Active Color Mode:'}{' '}
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
                <p className="text-zinc-400 text-[11px]">
                  {isDe
                    ? 'In der oberen Leiste kannst du jederzeit zwischen Zonen und Gefahrenstufen wechseln.'
                    : 'Switch between Zone and Danger view in the top bar anytime.'}
                </p>
              </div>

              {/* 1. ZONEN-FARBEN */}
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

                  {/* T-SPAWN: BRAUN */}
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-950/70 border border-zinc-800">
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-800 border border-black shrink-0" />
                    <div>
                      <div className="font-bold text-amber-300">T-Spawn (Braun)</div>
                      <div className="text-zinc-400 text-[10px]">Terroristen-Startbasis</div>
                    </div>
                  </div>

                  {/* CT-SPAWN: BLAU */}
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

              {/* 2. GEFAHRENSTUFEN */}
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

            <button
              onClick={() => setShowLegend(false)}
              className="mt-5 w-full py-2 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
            >
              {isDe ? 'Schließen' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* 6. ADD / EDIT CALLOUT MODAL */}
      {isAddingCallout && pendingCalloutCoords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto print:hidden">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="text-base font-bold text-white">
                {editingCallout
                  ? isDe
                    ? `Callout bearbeiten: ${editingCallout.name}`
                    : `Edit Callout: ${editingCallout.name}`
                  : isDe
                  ? 'Neuen Callout anlegen'
                  : 'Create New Callout'}
              </h3>
              <button
                onClick={() => {
                  setIsAddingCallout(false);
                  setEditingCallout(null);
                  setPendingCalloutCoords(null);
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCalloutForm} className="space-y-4 text-xs">
              {/* Callout Name */}
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  {isDe ? 'Callout-Name (Englisch)' : 'Callout Name (English)'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="z. B. Dark, Banana, Quad, Mirage Palace..."
                  value={calloutFormName}
                  onChange={(e) => setCalloutFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-zinc-400"
                />
              </div>

              {/* DARSTELLUNG: TEXT ODER BILD (MIT FREIER GRÖßENWAHL & 1:1 TATSÄCHLICHER VORSCHAU) */}
              <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold uppercase text-zinc-200 flex items-center gap-1.5 text-xs">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>{isDe ? 'Darstellung: Text oder Bild' : 'Display Mode: Text or Image'}</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700">
                    {calloutFormDisplayMode === 'image'
                      ? (isDe ? 'Nur Bild' : 'Image Only')
                      : calloutFormDisplayMode === 'both'
                      ? (isDe ? 'Bild + Text' : 'Image & Text')
                      : (isDe ? 'Nur Text' : 'Text Only')}
                  </span>
                </div>

                {/* Mode Selector Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCalloutFormDisplayMode('text')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      calloutFormDisplayMode === 'text'
                        ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md font-bold'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" />
                    <span>{isDe ? 'Text' : 'Text'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCalloutFormDisplayMode('image');
                      if (!calloutFormCustomImage) {
                        const isCT = calloutFormZone === 'ct_spawn' || calloutFormName.toLowerCase().includes('ct');
                        setCalloutFormCustomImage(isCT ? 'ct.png' : 'T.png');
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      calloutFormDisplayMode === 'image'
                        ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md font-bold'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{isDe ? 'Bild (Emblem)' : 'Image (Emblem)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCalloutFormDisplayMode('both');
                      if (!calloutFormCustomImage) {
                        const isCT = calloutFormZone === 'ct_spawn' || calloutFormName.toLowerCase().includes('ct');
                        setCalloutFormCustomImage(isCT ? 'ct.png' : 'T.png');
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      calloutFormDisplayMode === 'both'
                        ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md font-bold'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span className="text-[11px]">🖼️+📝</span>
                    <span>{isDe ? 'Bild + Text' : 'Both'}</span>
                  </button>
                </div>

                {/* TOGGLE CALLOUT PIN / EMBLEM DOT VISIBILITY */}
                <div className="pt-2.5 border-t border-zinc-800/90 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200">
                      {isDe ? 'Callout-Punkt / Emblem anzeigen' : 'Show Callout Pin / Emblem'}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {isDe
                        ? 'Punkt ausblenden, um nur die Beschriftung (Text) auf der Karte anzuzeigen'
                        : 'Hide pin marker to show text label only on the map'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCalloutFormHidePin((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      !calloutFormHidePin ? 'bg-amber-400' : 'bg-zinc-800 border border-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-zinc-950 transition-transform ${
                        !calloutFormHidePin ? 'translate-x-6' : 'translate-x-1 bg-zinc-400'
                      }`}
                    />
                  </button>
                </div>

                {/* Image Details (When 'image' or 'both' is selected) */}
                {(calloutFormDisplayMode === 'image' || calloutFormDisplayMode === 'both') && (
                  <div className="space-y-3 pt-2.5 border-t border-zinc-800/90 animate-in fade-in-50 duration-150">
                    {/* Emblem Quick Presets: CT Spawn / T Spawn */}
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                        {isDe ? 'Emblem wählen oder hochladen:' : 'Select or upload emblem:'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCalloutFormCustomImage('ct.png')}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                            calloutFormCustomImage === 'ct.png' || calloutFormCustomImage === '/ct.png'
                              ? 'border-sky-400 bg-sky-950/40 text-white ring-1 ring-sky-400 shadow-md'
                              : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          <img
                            src={resolveAssetPath('ct.png')}
                            alt="CT Spawn Emblem"
                            className="w-7 h-7 object-contain rounded-full shadow filter drop-shadow"
                          />
                          <div className="leading-tight">
                            <div className="font-bold text-xs text-sky-300">CT Spawn</div>
                            <div className="text-[10px] text-zinc-400">ct.png</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCalloutFormCustomImage('T.png')}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                            calloutFormCustomImage === 'T.png' || calloutFormCustomImage === '/T.png'
                              ? 'border-amber-500 bg-amber-950/40 text-white ring-1 ring-amber-500 shadow-md'
                              : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          <img
                            src={resolveAssetPath('T.png')}
                            alt="T Spawn Emblem"
                            className="w-7 h-7 object-contain rounded-full shadow filter drop-shadow"
                          />
                          <div className="leading-tight">
                            <div className="font-bold text-xs text-amber-300">T Spawn</div>
                            <div className="text-[10px] text-zinc-400">T.png</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Custom Image URL / Upload */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={calloutFormCustomImage}
                        onChange={(e) => setCalloutFormCustomImage(e.target.value)}
                        placeholder="ct.png, T.png oder Web-URL..."
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-amber-400"
                      />
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer text-xs font-medium shrink-0">
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isDe ? 'Datei' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                if (typeof evt.target?.result === 'string') {
                                  setCalloutFormCustomImage(evt.target.result);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* FREIE GRÖßENWAHL FÜR DAS BILD */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                          <span>{isDe ? 'Bildgröße frei bestimmen (Pixel)' : 'Custom Image Size (px)'}</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-amber-400 text-sm">
                            {calloutFormImageSize}px
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            ({calloutFormImageSize} × {calloutFormImageSize})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="16"
                          max="96"
                          step="2"
                          value={calloutFormImageSize}
                          onChange={(e) => setCalloutFormImageSize(Number(e.target.value))}
                          className="flex-1 accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                        />
                        <input
                          type="number"
                          min="16"
                          max="120"
                          value={calloutFormImageSize}
                          onChange={(e) =>
                            setCalloutFormImageSize(Math.max(12, Math.min(150, Number(e.target.value) || 36)))
                          }
                          className="w-16 px-2 py-1 text-center font-mono font-bold text-xs rounded bg-zinc-950 border border-zinc-700 text-amber-300"
                        />
                      </div>

                      {/* Schnell-Auswahl Presets */}
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
                        {[
                          { label: '24px (Klein)', val: 24 },
                          { label: '32px', val: 32 },
                          { label: '36px (Standard)', val: 36 },
                          { label: '48px (Mittel)', val: 48 },
                          { label: '64px (Groß)', val: 64 },
                          { label: '80px (XXL)', val: 80 },
                        ].map((p) => (
                          <button
                            key={p.val}
                            type="button"
                            onClick={() => setCalloutFormImageSize(p.val)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              calloutFormImageSize === p.val
                                ? 'bg-amber-400 text-zinc-950 font-bold'
                                : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* TATSÄCHLICHE GRÖßENANZEIGE & 1:1 LIVE-VORSCHAU */}
                    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                          <span>🎯</span>
                          <span>
                            {isDe
                              ? 'Tatsächliche Bildgröße auf der Karte'
                              : 'Actual Rendered Size on Map'}
                          </span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px] border border-amber-500/30">
                          {calloutFormImageSize} × {calloutFormImageSize} Pixel
                        </span>
                      </div>

                      {/* 1:1 Live Scale Display Container */}
                      <div className="relative min-h-[120px] py-4 flex flex-col items-center justify-center rounded-lg bg-zinc-950 border border-dashed border-zinc-700/80 overflow-hidden">
                        {/* Radar grid dots */}
                        <div
                          className="absolute inset-0 opacity-15 pointer-events-none"
                          style={{
                            backgroundImage: 'radial-gradient(circle, #888 1px, transparent 1px)',
                            backgroundSize: '16px 16px',
                          }}
                        />

                        {calloutFormCustomImage ? (
                          <div className="relative flex flex-col items-center justify-center z-10">
                            {/* The emblem rendered 1:1 with measurement frame */}
                            <div
                              style={{
                                width: `${calloutFormImageSize}px`,
                                height: `${calloutFormImageSize}px`,
                              }}
                              className="relative flex items-center justify-center transition-all"
                            >
                              <img
                                src={calloutFormCustomImage}
                                alt="Vorschau"
                                style={{
                                  width: `${calloutFormImageSize}px`,
                                  height: `${calloutFormImageSize}px`,
                                  transform: `rotate(${calloutFormTextRotation}deg)`,
                                }}
                                className="rounded-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ring-1 ring-white/50"
                              />

                              {/* Corner calipers to show exact bounding dimension */}
                              <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-amber-400 pointer-events-none" />
                              <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-amber-400 pointer-events-none" />
                              <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-amber-400 pointer-events-none" />
                              <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-amber-400 pointer-events-none" />
                            </div>

                            {/* Optional text underneath when 'both' mode is on */}
                            {calloutFormDisplayMode === 'both' && (
                              <div
                                style={{
                                  fontSize: `${calloutFormFontSize}px`,
                                  fontFamily: getFontFamilyStyle(calloutFormFontFamily),
                                  transform: `rotate(${calloutFormTextRotation}deg)`,
                                }}
                                className="mt-3 px-2 py-0.5 rounded bg-zinc-950/90 border border-zinc-700 text-white font-bold whitespace-nowrap shadow"
                              >
                                {calloutFormName.trim() || 'Callout-Name'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-zinc-500 text-xs italic z-10">
                            {isDe ? 'Kein Bild ausgewählt' : 'No image selected'}
                          </div>
                        )}

                        <div className="mt-2.5 text-[10px] font-mono text-zinc-500 text-center px-4 z-10">
                          {isDe
                            ? `Exakter 1:1 Maßstab — genau so groß erscheint das Bild auf der taktischen Karte (bei 100% Zoom).`
                            : `Exact 1:1 scale — this is how large the image will render on the tactical map (at 100% zoom).`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CALLOUT-TEXT POSITION */}
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                    <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isDe ? 'Callout-Text Position' : 'Callout Text Position'}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={calloutFormHidePin}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setCalloutFormHidePin(val);
                          if (val) {
                            setCalloutFormPinOffsetX(0);
                            setCalloutFormPinOffsetY(0);
                          }
                        }}
                        className="w-3.5 h-3.5 accent-amber-400 rounded cursor-pointer"
                      />
                      <span>{isDe ? 'Punkt ausblenden' : 'Hide Pin'}</span>
                    </label>
                    <span className="font-mono text-[10px] text-amber-300 font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      X: {calloutFormPinOffsetX} / Y: {calloutFormPinOffsetY}
                    </span>
                  </div>
                </div>

                {!calloutFormHidePin && (
                  <div className="space-y-2.5 pt-1">
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      {isDe
                        ? 'Bewege das Schriftfeld in der Vorschau frei per Drag & Drop um den fixierten Callout-Punkt herum (oder nutze Presets & Regler).'
                        : 'Drag the text box freely around the fixed callout pin in the preview box (or use presets & sliders).'}
                    </p>

                    {/* Interactive 2D Drag Preview Box */}
                    <div
                      ref={previewBoxRef}
                      onMouseDown={(e) => {
                        setIsDraggingPinPreview(true);
                        handlePreviewPointerMove(e);
                      }}
                      onMouseMove={(e) => {
                        if (isDraggingPinPreview || e.buttons === 1) {
                          handlePreviewPointerMove(e);
                        }
                      }}
                      onMouseUp={() => setIsDraggingPinPreview(false)}
                      onTouchStart={(e) => {
                        setIsDraggingPinPreview(true);
                        handlePreviewPointerMove(e);
                      }}
                      onTouchMove={(e) => {
                        if (isDraggingPinPreview) {
                          handlePreviewPointerMove(e);
                        }
                      }}
                      onTouchEnd={() => setIsDraggingPinPreview(false)}
                      className="relative h-64 w-full bg-zinc-900/90 rounded-xl border border-zinc-700/80 overflow-hidden cursor-crosshair select-none flex items-center justify-center shadow-inner group"
                    >
                      {/* Subtle grid lines */}
                      <div className="absolute inset-0 bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />
                      <div className="absolute w-full h-[1px] bg-zinc-800 pointer-events-none" />
                      <div className="absolute h-full w-[1px] bg-zinc-800 pointer-events-none" />

                      {/* FIXED Callout Pin Dot in Center (0,0) */}
                      <div className="absolute z-10 w-4 h-4 rounded-full bg-amber-400 border-2 border-zinc-950 shadow-[0_0_10px_rgba(251,191,36,0.8)] pointer-events-none flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                      </div>

                      {/* MOVABLE Text Label Box relative to fixed center dot */}
                      <div
                        style={{
                          transform: `translate(${calloutFormPinOffsetX}px, ${calloutFormPinOffsetY}px) rotate(${calloutFormTextRotation}deg)`,
                          fontSize: `${calloutFormFontSize}px`,
                          fontFamily: getFontFamilyStyle(calloutFormFontFamily),
                        }}
                        className="relative z-20 px-2.5 py-1 rounded bg-zinc-950 border border-sky-400 text-sky-200 font-bold shadow-lg pointer-events-none whitespace-nowrap transition-transform duration-75"
                      >
                        {calloutFormName.trim() || 'Schriftfeld'}
                      </div>

                      <span className="absolute bottom-1.5 right-2 text-[9px] font-mono text-zinc-500 pointer-events-none">
                        {isDe ? 'Schriftfeld ziehen' : 'Drag Text Label'}
                      </span>
                    </div>

                    {/* Quick Offset Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
                      {[
                        { label: 'Zentriert (Mid)', x: 0, y: 0 },
                        { label: 'Unten (Standard)', x: 0, y: 25 },
                        { label: 'Oben', x: 0, y: -25 },
                      ].map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCalloutFormPinOffsetX(p.x);
                            setCalloutFormPinOffsetY(p.y);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold cursor-pointer transition-colors ${
                            calloutFormPinOffsetX === p.x && calloutFormPinOffsetY === p.y
                              ? 'bg-amber-400 text-zinc-950 font-bold'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Fine-Tuning Sliders */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                          <span>X-Offset ({calloutFormPinOffsetX}px):</span>
                        </div>
                        <input
                          type="range"
                          min="-120"
                          max="120"
                          step="1"
                          value={calloutFormPinOffsetX}
                          onChange={(e) => setCalloutFormPinOffsetX(Number(e.target.value))}
                          className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                          <span>Y-Offset ({calloutFormPinOffsetY}px):</span>
                        </div>
                        <input
                          type="range"
                          min="-120"
                          max="120"
                          step="1"
                          value={calloutFormPinOffsetY}
                          onChange={(e) => setCalloutFormPinOffsetY(Number(e.target.value))}
                          className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SCHRIFT-DREHUNG */}
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                    <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isDe ? 'Schrift-Drehung' : 'Text Label Rotation'}</span>
                  </label>
                  <span className="font-mono font-bold text-sky-300">
                    {calloutFormTextRotation}°
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={calloutFormTextRotation}
                    onChange={(e) => setCalloutFormTextRotation(Number(e.target.value))}
                    className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
                  {[
                    { label: '0°', val: 0 },
                    { label: '45°', val: 45 },
                    { label: '90°', val: 90 },
                    { label: '-45°', val: -45 },
                    { label: '-90°', val: -90 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setCalloutFormTextRotation(p.val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        calloutFormTextRotation === p.val
                          ? 'bg-sky-400 text-zinc-950 font-bold'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Rotation preview */}
                <div className="h-10 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                  <div
                    style={{
                      transform: `rotate(${calloutFormTextRotation}deg)`,
                      fontSize: `${calloutFormFontSize}px`,
                      fontFamily: getFontFamilyStyle(calloutFormFontFamily),
                    }}
                    className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-700 text-white font-bold transition-all"
                  >
                    {calloutFormName.trim() || 'Vorschau-Callout'}
                  </div>
                </div>
              </div>

              {/* INDIVIDUAL CALLOUT FONT SIZE */}
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isDe ? 'Eigene Schriftgröße (px)' : 'Individual Font Size (px)'}</span>
                  </label>
                  <span className="font-mono font-bold text-emerald-300">
                    {calloutFormFontSize}px
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="40"
                    step="0.5"
                    value={calloutFormFontSize}
                    onChange={(e) => setCalloutFormFontSize(Number(e.target.value))}
                    className="flex-1 accent-emerald-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                  />
                </div>

                {/* Font size quick presets */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[10px] text-zinc-500 font-mono">Presets:</span>
                  {[
                    { label: '10px', val: 10 },
                    { label: '12px', val: 12 },
                    { label: '14px', val: 14 },
                    { label: '16px', val: 16 },
                    { label: '18px', val: 18 },
                    { label: '22px', val: 22 },
                    { label: '28px', val: 28 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setCalloutFormFontSize(p.val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        Math.round(calloutFormFontSize) === p.val
                          ? 'bg-emerald-400 text-zinc-950 font-bold'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SCHRIFTART (FONT FAMILY) WÄHLEN */}
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                    <Type className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isDe ? 'Schriftart (Font) wählen' : 'Select Font Family'}</span>
                  </label>
                  <span className="font-mono text-[10px] text-amber-300 font-bold uppercase px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                    {calloutFormFontFamily}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { id: 'mono', label: 'Taktisch (Mono)', style: "ui-monospace, SFMono-Regular, monospace" },
                    { id: 'rajdhani', label: 'Rajdhani (Esport)', style: "'Rajdhani', sans-serif" },
                    { id: 'orbitron', label: 'Orbitron (Sci-Fi)', style: "'Orbitron', sans-serif" },
                    { id: 'russo', label: 'Russo (Impact)', style: "'Russo One', sans-serif" },
                    { id: 'teko', label: 'Teko (Sharp)', style: "'Teko', sans-serif" },
                    { id: 'sans', label: 'Modern (Sans)', style: "'Inter', sans-serif" },
                    { id: 'serif', label: 'Serif (Klassisch)', style: "'Georgia', serif" },
                  ].map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => setCalloutFormFontFamily(font.id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                        calloutFormFontFamily === font.id
                          ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold shadow-md ring-1 ring-amber-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <span className="text-xs truncate w-full" style={{ fontFamily: font.style }}>
                        {calloutFormName.trim() || 'Callout'}
                      </span>
                      <span className="text-[9px] opacity-75 font-mono mt-0.5">
                        {font.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* TOTALCSGO-STYLE AREA (RECTANGLE OR CUSTOM DRAWN POLYGON) */}
              <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={calloutFormHasArea}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCalloutFormHasArea(checked);
                        if (checked && pendingCalloutCoords && !editingCallout?.area) {
                          setCalloutFormAreaX(
                            Math.round((pendingCalloutCoords.x - calloutFormAreaWidth / 2) * 10) / 10
                          );
                          setCalloutFormAreaY(
                            Math.round((pendingCalloutCoords.y - calloutFormAreaHeight / 2) * 10) / 10
                          );
                        }
                      }}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                    <Square className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isDe ? 'Zonenbereich (TotalCSGO-Stil)' : 'Zone Area Box / Polygon'}</span>
                  </label>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {calloutFormHasArea ? (isDe ? 'Aktiviert' : 'Active') : (isDe ? 'Kein Bereich' : 'None')}
                  </span>
                </div>

                {calloutFormHasArea && (
                  <div className="pt-2.5 space-y-3 border-t border-zinc-800 animate-in fade-in-50 duration-150">
                    {/* Shape Selector: Rechteck vs Linien zeichnen */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1.5">
                        {isDe ? 'Bereichs-Typ:' : 'Area Type:'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCalloutFormAreaShape('rect')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all ${
                            calloutFormAreaShape === 'rect'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-sm font-bold'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>{isDe ? 'Rechteck' : 'Rectangle'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalloutFormAreaShape('polygon')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border text-xs font-semibold transition-all ${
                            calloutFormAreaShape === 'polygon'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm font-bold'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>{isDe ? 'Linien zeichnen' : 'Draw Polygon'}</span>
                        </button>
                      </div>
                    </div>

                    {calloutFormAreaShape === 'rect' ? (
                      /* RECTANGLE CONTROLS (WITHOUT CLAMPING NEGATIVE COORDINATES) */
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-zinc-400">
                          {isDe
                            ? 'Rechteck-Bereich. Position wird exakt beibehalten und springt nicht zurück.'
                            : 'Rectangular boundary. Coordinates stay fixed without jumping.'}
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                              <span>{isDe ? 'Breite:' : 'Width:'}</span>
                              <span className="font-mono text-white">{calloutFormAreaWidth}%</span>
                            </div>
                            <input
                              type="range"
                              min="3"
                              max="35"
                              step="1"
                              value={calloutFormAreaWidth}
                              onChange={(e) => {
                                const newW = Number(e.target.value);
                                setCalloutFormAreaWidth(newW);
                              }}
                              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                              <span>{isDe ? 'Höhe:' : 'Height:'}</span>
                              <span className="font-mono text-white">{calloutFormAreaHeight}%</span>
                            </div>
                            <input
                              type="range"
                              min="3"
                              max="35"
                              step="1"
                              value={calloutFormAreaHeight}
                              onChange={(e) => {
                                const newH = Number(e.target.value);
                                setCalloutFormAreaHeight(newH);
                              }}
                              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* CUSTOM DRAWN POLYGON LINE-SEGMENTS CONTROLS */
                      <div className="space-y-2.5 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-zinc-200">
                            {isDe ? 'Freie Liniensegmente' : 'Custom Line Segments'}
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            calloutFormAreaPoints.length >= 3
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {calloutFormAreaPoints.length >= 3
                              ? (isDe ? `✓ ${calloutFormAreaPoints.length} Punkte (Geschlossen)` : `✓ ${calloutFormAreaPoints.length} points`)
                              : (isDe ? `${calloutFormAreaPoints.length} Punkte` : `${calloutFormAreaPoints.length} points`)}
                          </span>
                        </div>

                        <p className="text-[11px] text-zinc-400 leading-snug">
                          {isDe
                            ? 'Zeichne Eckpunkte mit Linien auf der Karte. Wenn die Linien verbunden werden, wird daraus ein Zonenbereich.'
                            : 'Draw vertices with lines on map. When lines connect, it forms a closed zone area.'}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCalloutFormHasArea(true);
                              setCalloutFormAreaShape('polygon');
                              setIsAddingCallout(false);
                              setIsDrawingPolygonArea(true);
                            }}
                            className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs shadow-md transition-colors"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            <span>{isDe ? 'Linien auf Karte zeichnen' : 'Draw Lines on Map'}</span>
                          </button>

                          {calloutFormAreaPoints.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setCalloutFormAreaPoints((prev) => prev.slice(0, -1))}
                              className="px-2.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
                              title={isDe ? 'Letzten Punkt entfernen' : 'Undo last point'}
                            >
                              ↶ {isDe ? 'Rückgängig' : 'Undo'}
                            </button>
                          )}

                          {calloutFormAreaPoints.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setCalloutFormAreaPoints([])}
                              className="px-2.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 text-xs font-semibold transition-colors"
                              title={isDe ? 'Alle Punkte löschen' : 'Clear points'}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Level Selector (nur wenn Karte zwei Ebenen O/U hat) */}
              {mapData.lowerImage && (
                <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold uppercase text-zinc-300 flex items-center gap-1.5 text-xs">
                      <span>{isDe ? 'Kartenebene / Stockwerk' : 'Floor / Level'}</span>
                    </label>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-900 border border-purple-500/50 text-purple-300">
                      {calloutFormLevel === 'upper'
                        ? isDe ? 'O (Oben)' : 'Upper (O)'
                        : calloutFormLevel === 'lower'
                        ? isDe ? 'U (Unten)' : 'Lower (U)'
                        : isDe ? 'O + U (Beide)' : 'Both (O + U)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCalloutFormLevel('upper')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        calloutFormLevel === 'upper'
                          ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold shadow-md'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {isDe ? 'O (Oben)' : 'Upper (O)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalloutFormLevel('lower')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        calloutFormLevel === 'lower'
                          ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-md'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {isDe ? 'U (Unten)' : 'Lower (U)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalloutFormLevel('both')}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        calloutFormLevel === 'both'
                          ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-md'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {isDe ? 'Beide (O + U)' : 'Both (O + U)'}
                    </button>
                  </div>
                </div>
              )}

              {/* Zone / Pin Color Selection: T-SPAWN BRAUN, CT-SPAWN BLAU */}
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  {isDe ? 'Zone (A/B/Mid/Spawns)' : 'Map Zone'}
                </label>
                <select
                  value={calloutFormZone}
                  onChange={(e) => {
                    const newZone = e.target.value as ZoneType;
                    setCalloutFormZone(newZone);
                    if (newZone === 'ct_spawn') {
                      if (!calloutFormCustomImage || calloutFormCustomImage === '/T.png') {
                        setCalloutFormCustomImage('/ct.png');
                      }
                    } else if (newZone === 't_spawn') {
                      if (!calloutFormCustomImage || calloutFormCustomImage === '/ct.png') {
                        setCalloutFormCustomImage('/T.png');
                      }
                    }
                  }}
                  className="w-full px-2.5 py-2 rounded-lg border border-zinc-700 bg-zinc-950 text-white"
                >
                  <option value="a_site">🟠 A-Site (Orange — Bombenplatz A)</option>
                  <option value="b_site">🔵 B-Site (Blau/Cyan — Bombenplatz B)</option>
                  <option value="mid">🟢 Middle (Grün — Mitte & Mid-Lanes)</option>
                  <option value="t_spawn">🟤 T-Spawn (Braun — Terroristen-Basis)</option>
                  <option value="ct_spawn">🔵 CT-Spawn (Blau — Antiterrorteam-Basis)</option>
                  <option value="other">⚪ Sonstige (Weiß/Grau — Außenflanken)</option>
                </select>
              </div>

              {/* Danger Level Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  {isDe ? 'Gefahrenstufe' : 'Danger Level'}
                </label>
                <select
                  value={calloutFormDanger}
                  onChange={(e) => setCalloutFormDanger(e.target.value as DangerLevel)}
                  className="w-full px-2.5 py-2 rounded-lg border border-zinc-700 bg-zinc-950 text-white"
                >
                  <option value="high">🔴 Hoch (Rot — Duell-Hotspots & Granaten-Brennpunkte)</option>
                  <option value="medium">🟡 Mittel (Gelb — Flankenrouten & Deckungswinkel)</option>
                  <option value="low">🟢 Gering (Grün — Sichere Rückzugszonen)</option>
                </select>
              </div>

              {/* Description & Tactical Tip */}
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  {isDe ? 'Positionsbeschreibung (Deutsch)' : 'Description (German)'}
                </label>
                <textarea
                  rows={2}
                  value={calloutFormDescDe}
                  onChange={(e) => setCalloutFormDescDe(e.target.value)}
                  placeholder="Genaue taktische Lagebeschreibung..."
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  {isDe ? 'Taktischer Tipp' : 'Tactical Tip'}
                </label>
                <textarea
                  rows={2}
                  value={calloutFormTipDe}
                  onChange={(e) => setCalloutFormTipDe(e.target.value)}
                  placeholder="z. B. Molotov werfen, vor Peeken flashen..."
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                {editingCallout ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingCallout) {
                        handleDeleteCallout(editingCallout.id);
                        setIsAddingCallout(false);
                        setEditingCallout(null);
                        setPendingCalloutCoords(null);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDe ? 'Callout löschen' : 'Delete Callout'}</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-mono text-zinc-500">
                    Position: {pendingCalloutCoords.x} / {pendingCalloutCoords.y}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCallout(false);
                      setEditingCallout(null);
                      setPendingCalloutCoords(null);
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  >
                    {isDe ? 'Abbrechen' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-white text-zinc-950 hover:bg-zinc-200"
                  >
                    {isDe ? 'Speichern' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* SYNC CHANGES CONFIRMATION MODAL */}
      {showSyncPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in-50 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 scale-in-95 animate-in">
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-800 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  {isDe ? 'Änderungen synchronisieren?' : 'Sync Changes?'}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {isDe ? 'Du hast Änderungen an dieser Karte vorgenommen.' : 'You have made changes to this map.'}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-xs text-zinc-300 leading-relaxed">
                {isDe 
                  ? 'Möchtest du diese Änderungen jetzt mit deinem Google-Konto synchronisieren (Cloud), damit sie auch auf anderen Geräten verfügbar sind, oder nur lokal auf diesem Gerät speichern?' 
                  : 'Would you like to sync these changes with your Google account (Cloud) now so they are available on other devices, or only save them locally on this device?'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {currentUser ? (
                <button
                  onClick={() => handleConfirmSync(true)}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-zinc-950 font-bold hover:bg-amber-300 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isDe ? 'In die Cloud synchronisieren' : 'Sync to Cloud'}</span>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      const res = await loginWithGoogle();
                      if (res?.user) {
                        await handleConfirmSync(true, res.user);
                      }
                    } catch (err) {
                      console.error('Login error:', err);
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-zinc-950 font-bold hover:bg-amber-300 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isDe ? 'Mit Google anmelden & synchronisieren' : 'Sign in with Google & Sync'}</span>
                </button>
              )}
              
              <button
                onClick={() => handleConfirmSync(false)}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 disabled:opacity-50 transition-colors"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isDe ? 'Nur lokal auf diesem Gerät speichern' : 'Save Locally Only'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleDiscardAndExit}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-semibold border border-red-800/60 transition-colors disabled:opacity-50"
                  title={isDe ? 'Änderungen dieser Sitzung verwerfen' : 'Discard session changes'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Ohne zu speichern verlassen' : 'Discard & Exit'}</span>
                </button>
                <button
                  onClick={() => setShowSyncPrompt(false)}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-transparent hover:bg-zinc-800 text-zinc-400 text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  {isDe ? 'Abbrechen' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLOUD CONFLICT RESOLUTION MODAL */}
      <CloudConflictModal
        isOpen={showConflictModal}
        onSmartMerge={handleSmartMerge}
        onDiscardAndLoadCloud={handleDiscardAndLoadCloud}
        onSaveLocallyOnly={handleSaveLocallyOnly}
        onCancel={handleCancelConflict}
        lang={lang}
        mapName={mapData.name}
        isProcessing={isProcessingConflict}
      />

      {/* SHARE & SAVE TACTIC MODAL */}
      <ShareTacticModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        mapData={mapData}
        shareUrl={currentShareUrl}
        defaultTitle={`${mapData.name} - Taktik`}
        tacticState={{
          drawings,
          utilities,
          players,
        }}
        onSaveAsMyTactic={(title) => {
          if (onSaveAsMyTactic) {
            onSaveAsMyTactic(mapData, title, {
              drawings,
              utilities,
              players,
            });
          }
        }}
        onLoadTacticState={(loadedState, title) => {
          setDrawings(loadedState.drawings || []);
          setUtilities(loadedState.utilities || []);
          setPlayers(loadedState.players || []);
          setDrawingsRedoStack([]);
          setHasChangesInSession(true);
        }}
        lang={lang}
      />

      {/* EDIT MODE OPTIONS SELECTION MODAL (3 CHOICES) */}
      {isEditOptionsModalOpen && (
        <div
          data-no-map-click="true"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setIsEditOptionsModalOpen(false)}
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
                onClick={() => setIsEditOptionsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* OPTION 1: ALLES BEARBEITEN */}
              <button
                type="button"
                onClick={() => {
                  setSingleEditCalloutId(null);
                  setIsEditMode(true);
                  setIsEditOptionsModalOpen(false);
                }}
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
                      {mapData.callouts.length} Callouts
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {isDe
                      ? 'Schaltet alle Callouts auf der Karte gleichzeitig interaktiv frei. Verschiebe Pins, erstelle Bereiche & rotiere Labels.'
                      : 'Unlocks all callouts on the map simultaneously for interactive dragging and area resizing.'}
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
                        ? 'Wähle ein bestimmtes Callout aus. Alle anderen Callouts werden ausgeblendet, damit du ungestört arbeiten kannst.'
                        : 'Focus on a single callout. All other callouts will be hidden for distortion-free editing.'}
                    </p>
                  </div>
                </div>

                {/* Search & Selector List */}
                <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={singleEditSearchQuery}
                      onChange={(e) => setSingleEditSearchQuery(e.target.value)}
                      placeholder={isDe ? 'Callout suchen...' : 'Search callout...'}
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-400"
                    />
                    <Crosshair className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {mapData.callouts
                      .filter((c) =>
                        c.name.toLowerCase().includes(singleEditSearchQuery.toLowerCase()) ||
                        c.zone.toLowerCase().includes(singleEditSearchQuery.toLowerCase())
                      )
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSingleEditCalloutId(c.id);
                            setIsEditMode(true);
                            setIsEditOptionsModalOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-all text-xs cursor-pointer ${
                            singleEditCalloutId === c.id
                              ? 'bg-sky-500/20 border border-sky-400 text-sky-200'
                              : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold truncate">{c.name}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase ${getZoneBadgeColor(c.zone)}`}>
                              {c.zone.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-[10px] text-sky-400 font-semibold shrink-0">
                            {isDe ? 'Bearbeiten →' : 'Edit →'}
                          </span>
                        </button>
                      ))}
                    {mapData.callouts.filter((c) =>
                      c.name.toLowerCase().includes(singleEditSearchQuery.toLowerCase()) ||
                      c.zone.toLowerCase().includes(singleEditSearchQuery.toLowerCase())
                    ).length === 0 && (
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
                onClick={() => {
                  setIsEditOptionsModalOpen(false);
                  handleOpenAddNewCalloutModal();
                }}
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
                      ? 'Füge einen völlig neuen Ort, Bombenplatz-Bereich oder Callout-Punkt zu dieser Karte hinzu.'
                      : 'Create a brand new callout point or custom area on this map.'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Floating Button inside TacticalMapView */}
      {showTacticalScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-900/60 hover:bg-amber-500 text-zinc-300 hover:text-zinc-950 border border-zinc-700/60 hover:border-amber-400 shadow-xl backdrop-blur-md opacity-70 hover:opacity-100 transition-all duration-300 active:scale-95 group cursor-pointer animate-in fade-in zoom-in-75 ring-1 ring-white/10 print:hidden"
          title={isDe ? 'Nach oben scrollen' : 'Scroll to top'}
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
        </button>
      )}
    </div>
  );
};
