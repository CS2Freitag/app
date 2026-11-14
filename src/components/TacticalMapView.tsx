import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { getCloudMap, smartMergeMap, syncUserMap } from '../services/firebase';
import { getFontFamilyStyle } from '../utils/calloutFonts';
import { CloudConflictModal } from './CloudConflictModal';
import { ShareTacticModal } from './ShareTacticModal';
import { resolveAssetPath } from '../utils/assets';
import { encodeCompactTactic } from '../utils/tacticCodec';
import {
  Info,
  RotateCw,
  Trash2,
  Eraser,
  Move,
  Check,
  Edit3,
  X,
  ArrowUp,
  ListFilter,
  Layers,
  Lock,
  Copy,
  History,
  PanelLeftOpen,
  PanelRightOpen,
  Spline,
} from 'lucide-react';
import { UtilitySymbol, UTILITY_META } from './UtilitySymbol';
import { TacticalLayersPanel } from './TacticalLayersPanel';
import { TacticalHistoryPanel } from './TacticalHistoryPanel';
import { HelpDocsModal } from './HelpDocsModal';
import { CustomColorModal } from './CustomColorModal';
import { TacticPreviewModal } from './TacticPreviewModal';
import { TacticalSelectionBar } from './TacticalSelectionBar';
import { TacticalContextMenu } from './TacticalContextMenu';
import { TacticalMinimap } from './TacticalMinimap';
import { TacticPresetsModal } from './TacticPresetsModal';
import { EditOptionsModal } from './EditOptionsModal';
import { CustomSelectionModal } from './CustomSelectionModal';
import { TacticalBottomBar } from './TacticalBottomBar';
import { TacticalMobileBottomBar } from './TacticalMobileBottomBar';
import { TacticalLegendModal } from './TacticalLegendModal';
import { CalloutEditorModal } from './CalloutEditorModal';
import { SyncPromptModal } from './SyncPromptModal';
import { TacticalHeaderBar } from './TacticalHeaderBar';
import { TacticalMobileToolbar } from './TacticalMobileToolbar';
import { TacticalLeftSidebar } from './TacticalLeftSidebar';
import { TacticalMobileSheet } from './TacticalMobileSheet';
import {
  computeCurveBendFromHandlePoint,
  distanceToThrowCurve,
  evaluateQuadraticBezier,
  formatThrowTypeFull,
  getThrowGeometry,
  THROW_TYPE_META,
} from '../utils/utilityThrowGeometry';
import { useTacticPresets } from '../hooks/useTacticPresets';
import { useTacticHistory } from '../hooks/useTacticHistory';
import { useTacticSelectionActions } from '../hooks/useTacticSelectionActions';
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
  UtilityThrowType,
  UtilityPlacementMode,
  UtilityMarker,
  PlayerToken,
  TacticalDrawingLine,
  TacticalTool,
  TacticLayer,
  TacticSnapshot,
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

export { getFontFamilyStyle };

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
      const visibleDrawings = drawings.filter((d) => isLayerVisible(d.layerId, 'layer_t'));
      const visibleUtilities = utilities.filter((u) => isLayerVisible(u.layerId, 'layer_util'));
      const visiblePlayers = players.filter((p) =>
        isLayerVisible(p.layerId, p.side === 'ct' ? 'layer_ct' : 'layer_t')
      );
      const compressed = encodeCompactTactic(
        mapData.id,
        mapData.name,
        visibleDrawings,
        visibleUtilities,
        visiblePlayers
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

  const [isMobileView, setIsMobileView] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });

  // Callout Label Size Scale: 0.6 (60%) on smartphones (<768px), 1.0 (100%) on tablets/PC
  const [calloutScale, setCalloutScale] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 0.6; // 60% auf Smartphones
    }
    return 1.0; // 100% auf Tablets & PC
  });

  // Keep 60% on smartphones and 100% on tablets/PC on screen resize and clamp to mobile max (150%)
  useEffect(() => {
    const handleScaleResize = () => {
      if (typeof window === 'undefined') return;
      const mobile = window.innerWidth < 768;
      setIsMobileView(mobile);
      if (mobile) {
        setCalloutScale((prev) => (prev > 1.5 ? 1.5 : (prev === 1.0 ? 0.6 : prev)));
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

  // Color Legend Modal/Panel & Help Guides Modal
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [isHelpDocsOpen, setIsHelpDocsOpen] = useState<boolean>(false);
  const [isCustomColorModalOpen, setIsCustomColorModalOpen] = useState<boolean>(false);
  const [customColorTarget, setCustomColorTarget] = useState<'pen' | 'selection'>('pen');
  const [isTacticPreviewOpen, setIsTacticPreviewOpen] = useState<boolean>(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<TacticSnapshot | null>(null);

  // Tactical tools
  const [activeTool, setActiveTool] = useState<TacticalTool>('select');
  const [selectedUtility, setSelectedUtility] = useState<UtilityType>('smoke');
  const [utilityPlacementMode, setUtilityPlacementMode] = useState<UtilityPlacementMode>('throw');
  const [selectedThrowType, setSelectedThrowType] = useState<UtilityThrowType>('left');
  const [pendingUtilityThrowOrigin, setPendingUtilityThrowOrigin] = useState<{ x: number; y: number } | null>(null);
  const [utilityHoverCoord, setUtilityHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const [hoveredUtilityId, setHoveredUtilityId] = useState<string | null>(null);
  const [draggingUtilityHandle, setDraggingUtilityHandle] = useState<{
    utilId: string;
    mode: 'origin' | 'curve' | 'landing';
    tileEl: HTMLElement | null;
  } | null>(null);
  const [selectedPlayerSide, setSelectedPlayerSide] = useState<'ct' | 't'>('ct');
  const [penColor, setPenColor] = useState<string>('#ffffff');
  const [penWithArrow, setPenWithArrow] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const pressTimer = useRef<number | null>(null);

  // Clear pending throw origin when switching away from utility throw mode
  useEffect(() => {
    if (activeTool !== 'utility' || utilityPlacementMode !== 'throw') {
      setPendingUtilityThrowOrigin(null);
      setUtilityHoverCoord(null);
    }
  }, [activeTool, utilityPlacementMode]);

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


  // Tactical drawings, utilities, players & unified undo/redo stacks
  const [drawings, setDrawings] = useState<TacticalDrawingLine[]>(() => mapData.tacticData?.drawings || []);
  const [currentDrawing, setCurrentDrawing] = useState<TacticalDrawingLine | null>(null);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);

  // Utility & Players
  const [utilities, setUtilities] = useState<UtilityMarker[]>(() => mapData.tacticData?.utilities || []);
  const [players, setPlayers] = useState<PlayerToken[]>(() => mapData.tacticData?.players || []);

  // Studio Editor Layers, Selection, Grid & Responsive Drawers
  const defaultLayers: TacticLayer[] = [
    { id: 'layer_ct', name: 'CT-Setups', color: '#3b82f6', visible: true, locked: false, opacity: 1, isExpanded: false },
    { id: 'layer_t', name: 'T-Rush', color: '#eab308', visible: true, locked: false, opacity: 1, isExpanded: true },
    { id: 'layer_util', name: 'Utility', color: '#22c55e', visible: true, locked: false, opacity: 1, isExpanded: false },
    { id: 'layer_retake', name: 'Retake', color: '#a855f7', visible: true, locked: false, opacity: 1, isExpanded: false },
  ];
  const [layers, setLayers] = useState<TacticLayer[]>(() =>
    mapData.tacticData?.layers && mapData.tacticData.layers.length > 0
      ? mapData.tacticData.layers
      : defaultLayers
  );
  const [activeLayerId, setActiveLayerId] = useState<string>(() =>
    mapData.tacticData?.layers?.[1]?.id || mapData.tacticData?.layers?.[0]?.id || 'layer_t'
  );

  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState<boolean>(false);

  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [selectedCalloutIds, setSelectedCalloutIds] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState<boolean>(true);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState<boolean>(true);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [marqueeRect, setMarqueeRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marqueeAdditiveRef = useRef<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showContextColorSubmenu, setShowContextColorSubmenu] = useState<boolean>(false);
  const [longPressVisual, setLongPressVisual] = useState<{ x: number; y: number } | null>(null);

  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showContextColorPicker, setShowContextColorPicker] = useState<boolean>(false);
  const [isTabletLayersOpen, setIsTabletLayersOpen] = useState<boolean>(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const [mobileSheetTab, setMobileSheetTab] = useState<'layers' | 'history'>('layers');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false);

  // Callouts & Inspector state
  const [hoveredCallout, setHoveredCallout] = useState<Callout | null>(null);
  const [selectedCallout, setSelectedCallout] = useState<Callout | null>(null);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<ZoneType | 'all'>('all');
  const [showCalloutLabels, setShowCalloutLabels] = useState<boolean>(true);
  const [highlightedCalloutId, setHighlightedCalloutId] = useState<string | undefined>(
    initialHighlightedCalloutId
  );

  // Layer helper predicates
  const isLayerLocked = useCallback(
    (layerId?: string) => {
      const target = layers.find((l) => l.id === (layerId || activeLayerId));
      return Boolean(target?.locked);
    },
    [layers, activeLayerId]
  );

  const isLayerVisible = useCallback(
    (layerId?: string, defaultFallbackId = 'layer_t') => {
      const target = layers.find((l) => l.id === (layerId || defaultFallbackId));
      return target ? target.visible : true;
    },
    [layers]
  );

  const getLayerOpacity = useCallback(
    (layerId?: string, defaultFallbackId = 'layer_t') => {
      const target = layers.find((l) => l.id === (layerId || defaultFallbackId));
      return target ? target.opacity : 1;
    },
    [layers]
  );

  // Persistent per-map tactic presets
  const pushHistorySnapshotRef = useRef<() => void>(() => {});
  const onBeforeLoadPreset = useCallback(() => {
    pushHistorySnapshotRef.current();
  }, []);

  const {
    tacticPresets,
    handleSavePreset,
    handleLoadPreset,
    handleRenamePreset,
    handleOverwritePreset,
    handleDeletePreset,
  } = useTacticPresets({
    mapData,
    drawings,
    utilities,
    players,
    layers,
    setDrawings,
    setUtilities,
    setPlayers,
    setLayers,
    setSelectedElementIds,
    setSelectedCalloutIds,
    setSelectedCallout,
    setContextMenu,
    setHasChangesInSession,
    onUpdateMap,
    onBeforeLoadPreset,
  });

  // Unified Undo / Redo + Map Version History Snapshots
  const {
    canUndo,
    canRedo,
    dragInitialHistoryRef,
    eraserInitialHistoryRef,
    createEditorSnapshot,
    pushHistorySnapshot,
    handleUndo,
    handleRedo,
    snapshots,
    handleSaveSnapshot,
    handleDeleteSnapshot,
    handleClearHistory,
    handleRestoreSnapshot,
  } = useTacticHistory({
    mapData,
    isDe,
    drawings,
    utilities,
    players,
    layers,
    tacticPresets,
    setDrawings,
    setUtilities,
    setPlayers,
    setLayers,
    setSelectedElementIds,
    setSelectedCalloutIds,
    setSelectedCallout,
    setHighlightedCalloutId,
    setContextMenu,
    setHasChangesInSession,
    onUpdateMap,
  });
  pushHistorySnapshotRef.current = () => pushHistorySnapshot();

  // Multi-element & callout selection / manipulation actions
  const {
    handleSelectElement,
    handleSelectCalloutMulti,
    handleDuplicateSelected,
    handleGroupSelected,
    handleToggleLockSelected,
    handleDeleteSelectedElements,
    handleUpdateSelectedElementsProps,
  } = useTacticSelectionActions({
    mapData,
    isDe,
    drawings,
    utilities,
    players,
    selectedElementIds,
    selectedCalloutIds,
    isLayerLocked,
    pushHistorySnapshot,
    setDrawings,
    setUtilities,
    setPlayers,
    setSelectedElementIds,
    setSelectedCalloutIds,
    setSelectedCallout,
    setHighlightedCalloutId,
    setContextMenu,
    setShowContextColorPicker,
    setShowContextColorSubmenu,
    setHasChangesInSession,
    onUpdateMap,
  });

  // Edit mode, Options Modal & Single Callout Edit states
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isEditOptionsModalOpen, setIsEditOptionsModalOpen] = useState<boolean>(false);
  const [singleEditCalloutId, setSingleEditCalloutId] = useState<string | null>(null);
  const [singleEditSearchQuery, setSingleEditSearchQuery] = useState<string>('');

  // Meine Callout-Auswahl (Custom Selection) states per map
  const [customSelectedCalloutIds, setCustomSelectedCalloutIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`cs2_callout_selection_${mapData.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isCustomSelectionActive, setIsCustomSelectionActive] = useState<boolean>(false);
  const [isCustomSelectionModalOpen, setIsCustomSelectionModalOpen] = useState<boolean>(false);
  const [tempSelectedCalloutIds, setTempSelectedCalloutIds] = useState<string[]>([]);
  const [customSelectionTab, setCustomSelectionTab] = useState<'all' | 'selected'>('all');
  const [customSelectionSearch, setCustomSelectionSearch] = useState<string>('');

  const [draggingCalloutId, setDraggingCalloutId] = useState<string | null>(null);
  const [draggedCoords, setDraggedCoords] = useState<{ x: number; y: number } | null>(null);
  const [calloutDragStart, setCalloutDragStart] = useState<{
    clientX: number;
    clientY: number;
    initX: number;
    initY: number;
  } | null>(null);

  // Area Interactive Dragging, Resizing & Rotation in Edit Mode
  const [draggingAreaCalloutId, setDraggingAreaCalloutId] = useState<string | null>(null);
  const [resizingAreaCalloutId, setResizingAreaCalloutId] = useState<string | null>(null);
  const [rotatingAreaCalloutId, setRotatingAreaCalloutId] = useState<string | null>(null);
  const [movingAreaCalloutId, setMovingAreaCalloutId] = useState<string | null>(null);
  const [areaDragStart, setAreaDragStart] = useState<{
    clientX: number;
    clientY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
    initPoints?: { x: number; y: number }[];
  } | null>(null);
  const [rotationDragStart, setRotationDragStart] = useState<{
    clientX: number;
    clientY: number;
    initRotation: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  const handleAreaRotationStart = (callout: Callout, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode || !callout.area || callout.locked) return;
    if ('button' in e && e.button !== 0) return;
    e.stopPropagation();
    dragInitialHistoryRef.current = createEditorSnapshot();
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

  // Mobile initial shortcut hint banner (auto-hides after 10 seconds or on first tap/click anywhere)
  const [showMobileHintBanner, setShowMobileHintBanner] = useState<boolean>(true);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowMobileHintBanner(false);
    }, 10000);
    const dismissHandler = () => {
      setShowMobileHintBanner(false);
    };
    window.addEventListener('click', dismissHandler, { capture: true });
    window.addEventListener('touchstart', dismissHandler, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('click', dismissHandler, { capture: true });
      window.removeEventListener('touchstart', dismissHandler, { capture: true });
    };
  }, []);

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
  const [calloutFormHidePin, setCalloutFormHidePin] = useState<boolean>(true);
  const [calloutFormPinOffsetX, setCalloutFormPinOffsetX] = useState<number>(0);
  const [calloutFormPinOffsetY, setCalloutFormPinOffsetY] = useState<number>(0);

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
  const stageRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pinch-to-zoom refs for touchscreens
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1.0);

  const calculateFitZoom = (overrideFs?: boolean) => {
    const fs = overrideFs !== undefined ? overrideFs : isFullscreen;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (stageRef.current) {
      const stageRect = stageRef.current.getBoundingClientRect();
      const bottomDeduction = isMobile ? 76 : 16;
      const availW = Math.max(240, stageRect.width - 16);
      const availH = Math.max(220, stageRect.height - bottomDeduction);

      if (currentLevel === 'both') {
        const scaleW = availW / 1750;
        const scaleH = availH / 850;
        return Math.max(0.5, Math.min(2.5, Math.min(scaleW, scaleH) * (fs ? 0.96 : 0.92)));
      }
      const baseTileSize = Math.min(850, availW);
      const availableSize = Math.min(availW, availH);
      return Math.max(
        0.5,
        Math.min(2.5, (availableSize / Math.max(240, baseTileSize)) * (fs ? 0.95 : 0.92))
      );
    }

    if (!mainWrapperRef.current) {
      if (isMobile) {
        return currentLevel === 'both' ? 0.5 : 0.92;
      }
      return 0.78;
    }
    const parentRect = mainWrapperRef.current.getBoundingClientRect();
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const leftDeduction = fs || isMobile ? 0 : isToolbarVisible ? 224 : 0;
    const rightDeduction = fs || isMobile ? 0 : isDesktop ? 304 : 0;
    const topHeaderDeduction = fs ? 64 : isMobile ? (isToolbarVisible ? 168 : 132) : 80;
    const availW = Math.max(240, parentRect.width - (leftDeduction + rightDeduction));
    const availH = Math.max(220, parentRect.height - topHeaderDeduction);

    if (currentLevel === 'both') {
      const scaleW = availW / 1750;
      const scaleH = availH / 850;
      return Math.max(0.5, Math.min(2.5, Math.min(scaleW, scaleH) * (fs ? 0.96 : 0.92)));
    }
    const baseTileSize = Math.min(850, availW);
    const availableSize = Math.min(availW, availH);
    return Math.max(
      0.5,
      Math.min(2.5, (availableSize / Math.max(240, baseTileSize)) * (fs ? 0.95 : 0.92))
    );
  };

  // Ensure mobile bottom sheet switches to Layers/Callout tab when a callout is selected
  useEffect(() => {
    if (selectedCallout) {
      setMobileSheetTab('layers');
    }
  }, [selectedCallout?.id]);

  // Auto-fit map zoom when switching maps, floor levels, toolbar visibility, or map-only Fullscreen
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setZoom(calculateFitZoom(isFullscreen));
      setPan({ x: 0, y: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [mapData.id, currentLevel, isFullscreen, isToolbarVisible]);

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

  // Sync custom callout selection when map changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`cs2_callout_selection_${mapData.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCustomSelectedCalloutIds(Array.isArray(parsed) ? parsed : []);
      } else {
        setCustomSelectedCalloutIds([]);
      }
    } catch {
      setCustomSelectedCalloutIds([]);
    }
    setIsCustomSelectionActive(false);
  }, [mapData.id]);

  const handleOpenCustomSelectionModal = () => {
    setTempSelectedCalloutIds([...customSelectedCalloutIds]);
    setCustomSelectionSearch('');
    setCustomSelectionTab('all');
    setIsEditOptionsModalOpen(false);
    setIsCustomSelectionModalOpen(true);
  };

  const handleSaveCustomSelection = (newIds: string[], activateFilter = true) => {
    setCustomSelectedCalloutIds(newIds);
    try {
      localStorage.setItem(`cs2_callout_selection_${mapData.id}`, JSON.stringify(newIds));
    } catch {
      // ignore
    }
    if (activateFilter && newIds.length > 0) {
      setIsCustomSelectionActive(true);
    } else if (newIds.length === 0) {
      setIsCustomSelectionActive(false);
    }
    setIsCustomSelectionModalOpen(false);
  };



  // Keyboard shortcut listener (Undo: Ctrl+Z, Redo: Ctrl+Y / Ctrl+Shift+Z, Duplicate: Ctrl+D, Delete: Del/Backspace, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (isInput) return;

      if (e.key === 'Escape') {
        setContextMenu(null);
        setShowContextColorSubmenu(false);
        setShowContextColorPicker(false);
        setMarqueeRect(null);
        setPendingUtilityThrowOrigin(null);
        setUtilityHoverCoord(null);
        if (isFullscreen && !document.fullscreenElement) {
          setIsFullscreen(false);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedElementIds.length > 0 || selectedCalloutIds.length > 0) {
          e.preventDefault();
          handleDuplicateSelected();
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedElementIds.length > 0 || selectedCalloutIds.length > 0)) {
        e.preventDefault();
        handleDeleteSelectedElements();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedElementIds, selectedCalloutIds, handleDuplicateSelected, handleDeleteSelectedElements, isFullscreen]);

  // Fullscreen listener — synchronizes browser fullscreen & re-fits map on viewport resize
  const calculateFitZoomRef = useRef(calculateFitZoom);
  calculateFitZoomRef.current = calculateFitZoom;

  useEffect(() => {
    window.scrollTo(0, 0);
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      requestAnimationFrame(() => {
        setZoom(calculateFitZoomRef.current(isFs));
        setPan({ x: 0, y: 0 });
      });
    };
    const handleResize = () => {
      requestAnimationFrame(() => {
        setZoom(calculateFitZoomRef.current());
        setPan({ x: 0, y: 0 });
      });
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggleFullscreen = () => {
    const nextFs = !isFullscreen;
    setIsFullscreen(nextFs);
    if (nextFs) {
      if (!document.fullscreenElement) {
        mainWrapperRef.current?.requestFullscreen?.().catch(() => {});
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
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

    // Utility placement tool (1-click Spot OR 2-click Throw Curve)
    if (activeTool === 'utility') {
      const targetLayerId = activeLayerId || 'layer_util';
      if (isLayerLocked(targetLayerId)) return;

      if (utilityPlacementMode === 'throw') {
        if (!pendingUtilityThrowOrigin) {
          setPendingUtilityThrowOrigin(coords);
          setUtilityHoverCoord(coords);
          return;
        }
        const dist = Math.hypot(
          coords.x - pendingUtilityThrowOrigin.x,
          coords.y - pendingUtilityThrowOrigin.y
        );
        pushHistorySnapshot();
        const newMarker: UtilityMarker = {
          id: `util_${Date.now()}`,
          type: selectedUtility,
          x: coords.x,
          y: coords.y,
          ...(dist >= 1.2
            ? {
                throwFrom: pendingUtilityThrowOrigin,
                throwType: selectedThrowType,
              }
            : {}),
          layerId: targetLayerId,
        };
        setUtilities((prev) => [...prev, newMarker]);
        setPendingUtilityThrowOrigin(null);
        setUtilityHoverCoord(null);
        setHasChangesInSession(true);
        return;
      }

      pushHistorySnapshot();
      const newMarker: UtilityMarker = {
        id: `util_${Date.now()}`,
        type: selectedUtility,
        x: coords.x,
        y: coords.y,
        layerId: targetLayerId,
      };
      setUtilities((prev) => [...prev, newMarker]);
      setHasChangesInSession(true);
      return;
    }

    // Player placement tool
    if (activeTool === 'player') {
      const targetLayerId = activeLayerId || (selectedPlayerSide === 'ct' ? 'layer_ct' : 'layer_t');
      if (isLayerLocked(targetLayerId)) return;
      pushHistorySnapshot();
      const count = players.filter((p) => p.side === selectedPlayerSide).length;
      const newPlayer: PlayerToken = {
        id: `player_${Date.now()}`,
        side: selectedPlayerSide,
        number: (count % 5) + 1,
        x: coords.x,
        y: coords.y,
        hasBomb: selectedPlayerSide === 't' && players.filter((p) => p.hasBomb).length === 0,
        layerId: targetLayerId,
      };
      setPlayers((prev) => [...prev, newPlayer]);
      setHasChangesInSession(true);
      return;
    }

    // Select tool: clicking background clears inspector, callouts, elements & context menu (unless mobile multi-select mode is active)
    if (activeTool === 'select') {
      setSelectedCallout(null);
      setHighlightedCalloutId(undefined);
      if (!isMultiSelectMode) {
        setSelectedElementIds([]);
        setSelectedCalloutIds([]);
      }
      setContextMenu(null);
      setShowContextColorSubmenu(false);
      setShowContextColorPicker(false);
    }
  };

  const startUtilityHandleDrag = (
    util: UtilityMarker,
    mode: 'origin' | 'curve' | 'landing',
    e: React.MouseEvent | React.TouchEvent
  ) => {
    if (activeTool !== 'select') return;
    if ('button' in e && e.button !== 0) return;
    const isLockedEl = Boolean(util.locked || isLayerLocked(util.layerId || 'layer_util'));
    if (isLockedEl) return;
    setHasMovedDistance(false);
    dragInitialHistoryRef.current = createEditorSnapshot();
    const targetEl = e.currentTarget as HTMLElement | null;
    const tileEl = (targetEl?.closest('.map-canvas-tile') as HTMLElement) || null;
    setDraggingUtilityHandle({ utilId: util.id, mode, tileEl });
  };

  // Mouse & Dragging handling
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      draggingCalloutId ||
      draggingAreaCalloutId ||
      resizingAreaCalloutId ||
      draggingUtilityHandle ||
      (e.target as HTMLElement)?.closest?.('[data-utility-handle]')
    ) {
      return;
    }
    if ((e.target as HTMLElement).closest('[data-no-map-click]')) return;
    setContextMenu(null);
    setShowContextColorSubmenu(false);

    // Right-click (e.button === 2) initiates panning if dragged >4px; if tapped without dragging, opens Context Menu
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setMouseDownPos({ x: e.clientX, y: e.clientY });
      setHasMovedDistance(false);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (isDrawingPolygonArea) return;

    // Marquee area selection box tool ('marquee')
    if (activeTool === 'marquee' && e.button === 0) {
      const coords = getCoordinatesFromEvent(e);
      marqueeAdditiveRef.current = e.ctrlKey || e.metaKey || e.shiftKey || isMultiSelectMode;
      setMarqueeRect({
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
      });
      return;
    }

    if (activeTool === 'pen' || activeTool === 'arrow') {
      if (e.button === 0) {
        if (isLayerLocked(activeLayerId)) return;
        const coords = getCoordinatesFromEvent(e);
        const newLine: TacticalDrawingLine = {
          id: `draw_${Date.now()}`,
          points: [coords],
          color: penColor,
          width: 3,
          hasArrow: penWithArrow,
          layerId: activeLayerId,
        };
        setCurrentDrawing(newLine);
        return;
      }
    }

    if (activeTool === 'eraser') {
      eraserInitialHistoryRef.current = createEditorSnapshot();
      setMouseDownPos({ x: e.clientX, y: e.clientY });
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
    // 0a. Dragging utility throw handle (1. origin, 2. landing, or 3. Bezier curve bend)
    if (draggingUtilityHandle) {
      const coords = getCoordinatesFromClient(e.clientX, e.clientY, draggingUtilityHandle.tileEl);
      setHasMovedDistance(true);
      setUtilities((prev) =>
        prev.map((u) => {
          if (u.id !== draggingUtilityHandle.utilId) return u;
          if (draggingUtilityHandle.mode === 'origin') {
            return { ...u, throwFrom: coords };
          }
          if (draggingUtilityHandle.mode === 'landing') {
            return { ...u, x: coords.x, y: coords.y };
          }
          if (draggingUtilityHandle.mode === 'curve' && u.throwFrom) {
            return {
              ...u,
              curveBend: computeCurveBendFromHandlePoint(u.throwFrom, u, coords),
            };
          }
          return u;
        })
      );
      setHasChangesInSession(true);
      return;
    }

    // 0b. Panning when user drags empty canvas
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

    // 0c. Marquee Selection Box resize while dragging
    if (marqueeRect) {
      const coords = getCoordinatesFromEvent(e);
      setMarqueeRect((prev) => (prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null));
      return;
    }

    // 0d. Live curved throw preview while Step 2 landing spot is pending
    if (activeTool === 'utility' && utilityPlacementMode === 'throw' && pendingUtilityThrowOrigin) {
      setUtilityHoverCoord(getCoordinatesFromEvent(e));
    }

    if (isDrawingPolygonArea) {
      const coords = getCoordinatesFromEvent(e);
      setPolygonHoverCoord(coords);
      return;
    }

    // 1. Eraser Tool Brush Scrubbing (Real-time erase for drawings & utilities, respecting locks)
    if (activeTool === 'eraser' && mouseDownPos) {
      const coords = getCoordinatesFromEvent(e);
      setDrawings((prev) =>
        prev.filter((line) => {
          if (line.locked || isLayerLocked(line.layerId)) return true;
          const isNear = line.points.some(
            (p) => Math.hypot(p.x - coords.x, p.y - coords.y) < 5
          );
          return !isNear;
        })
      );
      setUtilities((prev) =>
        prev.filter((util) => {
          if (util.locked || isLayerLocked(util.layerId || 'layer_util')) return true;
          const nearLanding = Math.hypot(util.x - coords.x, util.y - coords.y) < 4.5;
          const nearCurve = util.throwFrom
            ? distanceToThrowCurve(coords, util.throwFrom, util, util.curveBend) < 3.5
            : false;
          return !(nearLanding || nearCurve);
        })
      );
      setHasChangesInSession(true);
      return;
    }

    // 2. Dragging Callout Pin (Smooth delta movement preserving initial relative offset)
    if (draggingCalloutId && calloutDragStart && mapContainerRef.current) {
      let targetTile: HTMLElement | null = null;
      if (currentLevel === 'both') {
        const callout = mapData.callouts.find((c) => c.id === draggingCalloutId);
        const isLower = callout && isCalloutForLevel(callout, 'lower') && !isCalloutForLevel(callout, 'upper');
        targetTile = document.getElementById(isLower ? 'map-tile-lower' : 'map-tile-upper');
      } else {
        targetTile = (e.target as HTMLElement).closest('.map-canvas-tile') as HTMLElement || mapContainerRef.current;
      }
      const tileEl = targetTile || mapContainerRef.current;
      const rect = tileEl.getBoundingClientRect();
      const dxPercent = ((e.clientX - calloutDragStart.clientX) / rect.width) * 100;
      const dyPercent = ((e.clientY - calloutDragStart.clientY) / rect.height) * 100;

      const newX = Math.round((calloutDragStart.initX + dxPercent) * 10) / 10;
      const newY = Math.round((calloutDragStart.initY + dyPercent) * 10) / 10;
      setDraggedCoords({ x: newX, y: newY });

      // Move only the callout name / pin independently - do not alter the zone area
      const updatedCallouts = mapData.callouts.map((c) => {
        if (c.id === draggingCalloutId) {
          return { ...c, x: newX, y: newY };
        }
        return c;
      });
      handleMapUpdate({ ...mapData, callouts: updatedCallouts });
      return;
    }

    // 3. Dragging Callout Area (Move)
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
          if (c.area.points && areaDragStart.initPoints) {
            const newPoints = areaDragStart.initPoints.map((p: { x: number; y: number }) => ({
              x: Math.round((p.x + dxPercent) * 10) / 10,
              y: Math.round((p.y + dyPercent) * 10) / 10,
            }));
            const minX = Math.min(...newPoints.map((p: { x: number; y: number }) => p.x));
            const minY = Math.min(...newPoints.map((p: { x: number; y: number }) => p.y));
            const maxX = Math.max(...newPoints.map((p: { x: number; y: number }) => p.x));
            const maxY = Math.max(...newPoints.map((p: { x: number; y: number }) => p.y));
            const width = Math.round((maxX - minX) * 10) / 10;
            const height = Math.round((maxY - minY) * 10) / 10;

            return {
              ...c,
              area: {
                ...c.area,
                x: minX,
                y: minY,
                width,
                height,
                points: newPoints,
              },
            };
          } else {
            return {
              ...c,
              area: { ...c.area, x: newX, y: newY },
            };
          }
        }
        return c;
      });
      handleMapUpdate({ ...mapData, callouts: updatedCallouts });
      return;
    }

    // 4. Resizing Callout Area (Bottom-Right handle)
    if (resizingAreaCalloutId && areaDragStart && mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const dxPercent = ((e.clientX - areaDragStart.clientX) / rect.width) * 100;
      const dyPercent = ((e.clientY - areaDragStart.clientY) / rect.height) * 100;

      const newW = Math.max(2, Math.round((areaDragStart.initW + dxPercent) * 10) / 10);
      const newH = Math.max(2, Math.round((areaDragStart.initH + dyPercent) * 10) / 10);

      const updatedCallouts = mapData.callouts.map((c) => {
        if (c.id === resizingAreaCalloutId && c.area) {
          return {
            ...c,
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
    if (marqueeRect) {
      const minX = Math.min(marqueeRect.startX, marqueeRect.currentX);
      const maxX = Math.max(marqueeRect.startX, marqueeRect.currentX);
      const minY = Math.min(marqueeRect.startY, marqueeRect.currentY);
      const maxY = Math.max(marqueeRect.startY, marqueeRect.currentY);
      const draggedEnough = maxX - minX > 1.2 || maxY - minY > 1.2;

      if (draggedEnough) {
        const hitCalloutIds = mapData.callouts
          .filter((c) => {
            const centerHit = c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY;
            let areaHit = false;
            if (c.area) {
              if (c.area.points && c.area.points.length > 0) {
                areaHit = c.area.points.some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
              } else {
                const ax1 = c.area.x;
                const ax2 = c.area.x + c.area.width;
                const ay1 = c.area.y;
                const ay2 = c.area.y + c.area.height;
                areaHit = ax1 <= maxX && ax2 >= minX && ay1 <= maxY && ay2 >= minY;
              }
            }
            return centerHit || areaHit;
          })
          .map((c) => c.id);

        const hitElIds = [
          ...drawings
            .filter(
              (d) =>
                isLayerVisible(d.layerId, 'layer_t') &&
                d.points.some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY)
            )
            .map((d) => d.id),
          ...utilities
            .filter((u) => {
              if (!isLayerVisible(u.layerId, 'layer_util')) return false;
              const landingHit = u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY;
              const originHit =
                Boolean(u.throwFrom) &&
                u.throwFrom!.x >= minX &&
                u.throwFrom!.x <= maxX &&
                u.throwFrom!.y >= minY &&
                u.throwFrom!.y <= maxY;
              return landingHit || originHit;
            })
            .map((u) => u.id),
          ...players
            .filter(
              (p) =>
                isLayerVisible(p.layerId, p.side === 'ct' ? 'layer_ct' : 'layer_t') &&
                p.x >= minX &&
                p.x <= maxX &&
                p.y >= minY &&
                p.y <= maxY
            )
            .map((p) => p.id),
        ];

        const additive = marqueeAdditiveRef.current;
        setSelectedCalloutIds((prev) =>
          additive ? Array.from(new Set([...prev, ...hitCalloutIds])) : hitCalloutIds
        );
        setSelectedElementIds((prev) =>
          additive ? Array.from(new Set([...prev, ...hitElIds])) : hitElIds
        );
        setSelectedCallout(null);
      } else if (!marqueeAdditiveRef.current) {
        setSelectedCalloutIds([]);
        setSelectedElementIds([]);
        setSelectedCallout(null);
      }
      setMarqueeRect(null);
    }

    if (draggingUtilityHandle) {
      if (
        dragInitialHistoryRef.current &&
        JSON.stringify(dragInitialHistoryRef.current.utilities) !== JSON.stringify(utilities)
      ) {
        pushHistorySnapshot(dragInitialHistoryRef.current);
      }
      dragInitialHistoryRef.current = null;
      setDraggingUtilityHandle(null);
    }

    if (draggingCalloutId || draggingAreaCalloutId || resizingAreaCalloutId || rotatingAreaCalloutId) {
      if (
        dragInitialHistoryRef.current &&
        JSON.stringify(dragInitialHistoryRef.current.callouts) !== JSON.stringify(mapData.callouts)
      ) {
        pushHistorySnapshot(dragInitialHistoryRef.current);
      }
      dragInitialHistoryRef.current = null;
    }
    if (eraserInitialHistoryRef.current) {
      if (
        JSON.stringify(eraserInitialHistoryRef.current.drawings) !== JSON.stringify(drawings) ||
        JSON.stringify(eraserInitialHistoryRef.current.utilities) !== JSON.stringify(utilities)
      ) {
        pushHistorySnapshot(eraserInitialHistoryRef.current);
      }
      eraserInitialHistoryRef.current = null;
    }

    if (draggingCalloutId) {
      setDraggingCalloutId(null);
      setCalloutDragStart(null);
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
        pushHistorySnapshot();
        setDrawings((prev) => [...prev, currentDrawing]);
        setHasChangesInSession(true);
      }
      setCurrentDrawing(null);
    }
    setIsPanning(false);
    setMouseDownPos(null);
  };

  // Mobile long-press (touch & hold) context menu handlers with 500ms visual ring
  const touchLongPressTimerRef = useRef<number | null>(null);
  const touchStartCoordRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTargetCandidateRef = useRef<{ callout?: Callout; elementId?: string } | null>(null);

  const cancelTouchLongPress = useCallback(() => {
    if (touchLongPressTimerRef.current) {
      window.clearTimeout(touchLongPressTimerRef.current);
      touchLongPressTimerRef.current = null;
    }
    touchStartCoordRef.current = null;
    setLongPressVisual(null);
  }, []);

  const startTouchLongPress = useCallback(
    (clientX: number, clientY: number, targetCallout?: Callout, targetElementId?: string) => {
      cancelTouchLongPress();
      touchStartCoordRef.current = { x: clientX, y: clientY };
      setLongPressVisual({ x: clientX, y: clientY });
      touchLongPressTimerRef.current = window.setTimeout(() => {
        if (touchStartCoordRef.current && !isDrawingPolygonArea) {
          setLongPressVisual(null);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate(40);
            } catch {
              // ignore
            }
          }
          if (targetCallout) {
            if (!selectedCalloutIds.includes(targetCallout.id)) {
              handleSelectCalloutMulti(targetCallout, isMultiSelectMode, false);
            } else {
              setSelectedCallout(null);
            }
          } else if (targetElementId) {
            if (!selectedElementIds.includes(targetElementId)) {
              handleSelectElement(targetElementId, isMultiSelectMode);
            }
          }
          setShowContextColorSubmenu(false);
          setContextMenu({ x: clientX, y: clientY });
        }
      }, 500);
    },
    [
      isDrawingPolygonArea,
      handleSelectCalloutMulti,
      handleSelectElement,
      cancelTouchLongPress,
      selectedCalloutIds,
      selectedElementIds,
      isMultiSelectMode,
    ]
  );

  const checkTouchLongPressMove = useCallback(
    (clientX: number, clientY: number) => {
      if (touchStartCoordRef.current) {
        const dist = Math.hypot(
          clientX - touchStartCoordRef.current.x,
          clientY - touchStartCoordRef.current.y
        );
        if (dist > 10) {
          cancelTouchLongPress();
        }
      }
    },
    [cancelTouchLongPress]
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      longPressTargetCandidateRef.current = null;
      cancelTouchLongPress();
      // 2-finger pinch gesture start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialPinchDistRef.current = dist;
      initialPinchZoomRef.current = zoom;
      setIsPanning(false);
      setMouseDownPos(null);
    } else if (e.touches.length === 1) {
      if ((activeTool === 'pen' || activeTool === 'arrow' || activeTool === 'eraser' || activeTool === 'marquee') && e.cancelable) {
        e.preventDefault();
      }
      initialPinchDistRef.current = null;
      const touch = e.touches[0];
      const candidate = longPressTargetCandidateRef.current;
      longPressTargetCandidateRef.current = null;
      if (
        activeTool !== 'pen' &&
        activeTool !== 'arrow' &&
        activeTool !== 'eraser' &&
        activeTool !== 'marquee'
      ) {
        startTouchLongPress(touch.clientX, touch.clientY, candidate?.callout, candidate?.elementId);
      }
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
      cancelTouchLongPress();
      if (e.cancelable) {
        e.preventDefault();
      }
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = currentDist / initialPinchDistRef.current;
      const newZoom = Math.max(0.5, Math.min(2.5, initialPinchZoomRef.current * factor));
      setZoom(Math.round(newZoom * 100) / 100);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      checkTouchLongPressMove(touch.clientX, touch.clientY);
      if ((activeTool === 'pen' || activeTool === 'arrow' || activeTool === 'eraser' || activeTool === 'marquee' || currentDrawing || marqueeRect) && e.cancelable) {
        e.preventDefault();
      }
      handleMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: e.target,
      } as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    longPressTargetCandidateRef.current = null;
    cancelTouchLongPress();
    if (e.touches.length < 2) {
      initialPinchDistRef.current = null;
    }
    if (e.touches.length === 0) {
      handleMouseUp();
    }
  };

  // Wheel zoom (50% to 250%)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((prev) => {
      return Math.max(0.5, Math.min(2.5, Math.round((prev + delta) * 100) / 100));
    });
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(0.5, Math.min(2.5, Math.round(newZoom * 100) / 100));
    setZoom(clamped);
  };

  const handleZoomIn = () => handleZoomChange(zoom + 0.05);
  const handleZoomOut = () => handleZoomChange(zoom - 0.05);

  const handleDeleteSingleLine = (lineId: string) => {
    const target = drawings.find((d) => d.id === lineId);
    if (!target) return;
    if (target.locked || isLayerLocked(target.layerId)) return;
    pushHistorySnapshot();
    setDrawings((prev) => prev.filter((d) => d.id !== lineId));
    setSelectedElementIds((prev) => prev.filter((id) => id !== lineId));
    setHasChangesInSession(true);
  };

  const handleClearTactics = () => {
    const unlockedDrawings = drawings.filter((d) => !d.locked && !isLayerLocked(d.layerId));
    const unlockedUtilities = utilities.filter((u) => !u.locked && !isLayerLocked(u.layerId || 'layer_util'));
    const unlockedPlayers = players.filter(
      (p) => !p.locked && !isLayerLocked(p.layerId || (p.side === 'ct' ? 'layer_ct' : 'layer_t'))
    );
    if (unlockedDrawings.length === 0 && unlockedUtilities.length === 0 && unlockedPlayers.length === 0) {
      return;
    }
    pushHistorySnapshot();
    setDrawings((prev) => prev.filter((d) => d.locked || isLayerLocked(d.layerId)));
    setUtilities((prev) => prev.filter((u) => u.locked || isLayerLocked(u.layerId || 'layer_util')));
    setPlayers((prev) =>
      prev.filter((p) => p.locked || isLayerLocked(p.layerId || (p.side === 'ct' ? 'layer_ct' : 'layer_t')))
    );
    setSelectedElementIds([]);
    setShowContextColorPicker(false);
    setHasChangesInSession(true);
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

  // Double click map to fit to screen size & reset font size to default
  const handleMapDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-no-map-click]')) {
      return;
    }
    setZoom(calculateFitZoom());
    setPan({ x: 0, y: 0 });
    const defaultScale = typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 1.0;
    setCalloutScale(defaultScale);
  };

  // Callout Pin Drag Start
  const handleCalloutDragStart = (callout: Callout, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode) return;
    if ('button' in e && e.button !== 0) return;
    e.stopPropagation();
    setHasMovedDistance(false);
    const isMulti = ('ctrlKey' in e && (e.ctrlKey || e.metaKey || e.shiftKey)) || isMultiSelectMode;
    if (!isMulti && !selectedCalloutIds.includes(callout.id)) {
      handleSelectCalloutMulti(callout, false);
    }
    if (callout.locked) return;
    dragInitialHistoryRef.current = createEditorSnapshot();
    const { clientX, clientY } = getClientCoords(e);
    setDraggingCalloutId(callout.id);
    setDraggedCoords({ x: callout.x, y: callout.y });
    setCalloutDragStart({
      clientX,
      clientY,
      initX: callout.x,
      initY: callout.y,
    });
  };

  // Area Move Drag Start
  const handleAreaMoveStart = (callout: Callout, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode || !callout.area || callout.locked) return;
    if ('button' in e && e.button !== 0) return;
    e.stopPropagation();
    dragInitialHistoryRef.current = createEditorSnapshot();
    const { clientX, clientY } = getClientCoords(e);
    setDraggingAreaCalloutId(callout.id);
    setAreaDragStart({
      clientX,
      clientY,
      initX: callout.area.x,
      initY: callout.area.y,
      initW: callout.area.width,
      initH: callout.area.height,
      initPoints: callout.area.points ? JSON.parse(JSON.stringify(callout.area.points)) : undefined,
    });
  };

  // Area Resize Drag Start
  const handleAreaResizeStart = (callout: Callout, e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode || !callout.area || callout.locked) return;
    if ('button' in e && e.button !== 0) return;
    e.stopPropagation();
    dragInitialHistoryRef.current = createEditorSnapshot();
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
    pushHistorySnapshot();
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
    pushHistorySnapshot();
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
    setCalloutFormHidePin(true);
    setCalloutFormPinOffsetX(0);
    setCalloutFormPinOffsetY(0);
    setCalloutFormDescDe('');
    setCalloutFormDescEn('');
    setCalloutFormTipDe('');
    setCalloutFormTipEn('');
    setCalloutFormAnglesDe('');
    setCalloutFormAnglesEn('');
    setCalloutFormHasArea(false);
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
    setCalloutFormName(callout.name.split(/\r?\n/).slice(0, 2).join('\n'));
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
    const sanitizedName = calloutFormName.split(/\r?\n/).slice(0, 2).join('\n').trim();
    if (!sanitizedName || !pendingCalloutCoords) return;
    pushHistorySnapshot();

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
              name: sanitizedName,
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
      const targetCallout = updatedCallouts.find((c) => c.id === editingCallout.id) || null;
      setSelectedCallout(null);
      setIsEditMode(true);
      setSingleEditCalloutId(editingCallout.id);
      if (areaObj) {
        setShowAreas(true);
      }
    } else {
      const newCallout: Callout = {
        id: `callout_${Date.now()}`,
        name: sanitizedName,
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

      // Stay in edit mode for this newly created callout until user clicks "Fertig"
      setIsEditMode(true);
      setSingleEditCalloutId(newCallout.id);
      setSelectedCallout(null);
      if (areaObj) {
        setShowAreas(true);
      }
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
      pushHistorySnapshot();
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
      // Save locally only & capture map version snapshot
      const updated = { ...mapData, updatedAt: Date.now() };
      handleSaveSnapshot(isDe ? 'Lokal gespeichert' : 'Saved locally', updated.callouts);
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

      // No conflict -> normal upload & capture map snapshot
      const updated = { ...mapData, updatedAt: Date.now() };
      handleSaveSnapshot(isDe ? 'Gespeichert (Cloud)' : 'Saved (Cloud)', updated.callouts);
      onUpdateMap(updated, false);
      setHasChangesInSession(false);
      setShowSyncPrompt(false);
      if (onGoHome) onGoHome();
      else onBack();

      await syncUserMap(userToUse.uid, updated);
    } catch (err) {
      console.warn('Conflict check or cloud sync failed, saving locally:', err);
      const updated = { ...mapData, updatedAt: Date.now() };
      handleSaveSnapshot(isDe ? 'Lokal gespeichert' : 'Saved locally', updated.callouts);
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
      handleSaveSnapshot(isDe ? 'Cloud-Merge gespeichert' : 'Saved Cloud Merge', merged.callouts);
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
    handleSaveSnapshot(isDe ? 'Lokal gespeichert' : 'Saved locally', updated.callouts);
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
    const target = mapData.callouts.find((c) => c.id === calloutId);
    if (target?.locked) return;
    pushHistorySnapshot();
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
    if (singleEditCalloutId === calloutId) {
      setSingleEditCalloutId(null);
      setIsEditMode(false);
      setSelectedCallout(null);
      setHighlightedCalloutId(undefined);
    }
  };

  // Filter callouts by zone, single-edit focus or custom selection
  const visibleCallouts = mapData.callouts.filter((c) => {
    if (singleEditCalloutId) {
      return c.id === singleEditCalloutId;
    }
    if (isCustomSelectionActive && customSelectedCalloutIds.length > 0) {
      if (!customSelectedCalloutIds.includes(c.id)) {
        return false;
      }
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
    const tileCallouts = visibleCallouts.filter((c) => {
      if (movingAreaCalloutId && c.id !== movingAreaCalloutId) return false;
      return isCalloutForLevel(c, tileLevel, Boolean(mapData.lowerImage));
    });
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
            style={{ opacity: movingAreaCalloutId ? 0.25 : 1 }}
            className="w-full h-full object-cover pointer-events-none transition-opacity"
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/icon.svg';
            }}
          />
          {/* Optional Tactical Coordinate Grid Overlay */}
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none z-10">
              <div
                className="w-full h-full opacity-35"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)',
                  backgroundSize: '12.5% 12.5%',
                }}
              />
              <div className="absolute top-1 left-0 right-0 flex justify-around px-2 text-[9px] font-mono font-bold text-white/50 tabular-nums">
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((col) => (
                  <span key={col}>{col}</span>
                ))}
              </div>
              <div className="absolute top-0 bottom-0 left-1 flex flex-col justify-around py-2 text-[9px] font-mono font-bold text-white/50 tabular-nums">
                {['1', '2', '3', '4', '5', '6', '7', '8'].map((row) => (
                  <span key={row}>{row}</span>
                ))}
              </div>
            </div>
          )}
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
            if (movingAreaCalloutId && movingAreaCalloutId !== callout.id) return null;
            const isHovered = hoveredCallout?.id === callout.id;
            const isSelected = selectedCallout?.id === callout.id;
            const isMultiSelected = selectedCalloutIds.includes(callout.id);
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
                  borderColor: isMultiSelected && !isEditMode ? '#38bdf8' : areaStyle.borderColor,
                  transform: `rotate(${callout.rotation || 0}deg)`,
                  transformOrigin: 'center center',
                }}
                onMouseEnter={() => !isEditMode && setHoveredCallout(callout)}
                onMouseLeave={() => !isEditMode && setHoveredCallout(null)}
                onClick={(e) => {
                  if (!hasMovedDistance) {
                    e.stopPropagation();
                    handleSelectCalloutMulti(callout, e.ctrlKey || e.metaKey || e.shiftKey || isMultiSelectMode);
                  }
                }}
                onContextMenu={(e) => {
                  if (isDrawingPolygonArea) return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selectedCalloutIds.includes(callout.id)) {
                    handleSelectCalloutMulti(callout, false, false);
                  } else {
                    setSelectedCallout(null);
                  }
                  setShowContextColorSubmenu(false);
                  setContextMenu({ x: e.clientX, y: e.clientY });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleOpenCalloutEditor(callout, e);
                }}
                className={`absolute rounded-sm border transition-all ${
                  movingAreaCalloutId === callout.id
                    ? 'border-dashed border-2 cursor-move z-40'
                    : isEditMode
                    ? 'border-dashed border-2 z-10'
                    : isMultiSelected
                    ? 'border-dashed border-2 shadow-lg ring-2 ring-sky-400/40 z-25 cursor-pointer'
                    : isHovered || isSelected
                    ? 'border-2 shadow-lg ring-1 ring-white/50 z-20 cursor-pointer scale-[1.01]'
                    : 'border-1 border-opacity-70 z-10 cursor-pointer hover:border-opacity-100'
                }`}
                onMouseDown={(e) => {
                  if (movingAreaCalloutId === callout.id) {
                    handleAreaMoveStart(callout, e);
                  }
                }}
                onTouchStart={(e) => {
                  longPressTargetCandidateRef.current = { callout };
                  if (movingAreaCalloutId === callout.id) {
                    handleAreaMoveStart(callout, e);
                  }
                }}
              >
                {isMultiSelected && !isEditMode && (
                  <>
                    <span className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-sky-500 rounded-[1px] pointer-events-none shadow-xs" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-sky-500 rounded-[1px] pointer-events-none shadow-xs" />
                    <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-sky-500 rounded-[1px] pointer-events-none shadow-xs" />
                    <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-sky-500 rounded-[1px] pointer-events-none shadow-xs" />
                  </>
                )}
                {callout.locked && (
                  <span
                    className="absolute -top-2 -right-2 w-4 h-4 rounded bg-purple-950/95 border border-purple-400 flex items-center justify-center shadow-md pointer-events-none z-30"
                    title={isDe ? 'Gesperrt' : 'Locked'}
                  >
                    <Lock className="w-2.5 h-2.5 text-purple-200" />
                  </span>
                )}
                {isEditMode && (isSelected || isMultiSelected || singleEditCalloutId === callout.id) && (
                  <>
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
            activeTool === 'eraser' || activeTool === 'select' ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          viewBox="-50 -50 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            {Array.from(new Set([...colors, '#eab308', '#a855f7', '#38bdf8'])).map((c) => {
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
                if (movingAreaCalloutId && movingAreaCalloutId !== callout.id) return null;
                const area = callout.area!;
                const pts = area.points!;
                const ptsString = pts.map((p) => `${p.x},${p.y}`).join(' ');
                const isHovered = hoveredCallout?.id === callout.id;
                const isSelected = selectedCallout?.id === callout.id;
                const isMultiSelected = selectedCalloutIds.includes(callout.id);
                const isBombsite = callout.zone === 'a_site' || callout.zone === 'b_site';
                const areaStyle = getAreaStyling(callout, colorMode);

                const fillValue = area.customColor
                  ? `${area.customColor}33`
                  : isBombsite
                  ? `url(#area-stripes-red-${tileLevel})`
                  : areaStyle.background;

                const strokeValue =
                  isMultiSelected && !isEditMode
                    ? '#38bdf8'
                    : area.customColor || areaStyle.borderColor || '#38bdf8';

                return (
                  <g key={`poly_${tileLevel}_${callout.id}`}>
                    <polygon
                      points={ptsString}
                      fill={fillValue}
                      stroke={strokeValue}
                      strokeWidth={isMultiSelected ? 1.15 : isHovered || isSelected ? 1.0 : 0.5}
                      strokeDasharray={isEditMode ? '1,1' : isMultiSelected ? '1.5,1' : undefined}
                      className={`transition-all ${
                        movingAreaCalloutId === callout.id
                          ? 'cursor-move pointer-events-auto'
                          : isEditMode
                          ? 'pointer-events-auto'
                          : 'pointer-events-auto cursor-pointer'
                      }`}
                      onMouseDown={(e) => {
                        if (movingAreaCalloutId === callout.id) {
                          handleAreaMoveStart(callout, e);
                        }
                      }}
                      onTouchStart={(e) => {
                        longPressTargetCandidateRef.current = { callout };
                        if (movingAreaCalloutId === callout.id) {
                          handleAreaMoveStart(callout, e);
                        }
                      }}
                      onClick={(e) => {
                        if (!hasMovedDistance) {
                          e.stopPropagation();
                          handleSelectCalloutMulti(callout, e.ctrlKey || e.metaKey || e.shiftKey || isMultiSelectMode);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (isDrawingPolygonArea) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selectedCalloutIds.includes(callout.id)) {
                          handleSelectCalloutMulti(callout, false, false);
                        } else {
                          setSelectedCallout(null);
                        }
                        setShowContextColorSubmenu(false);
                        setContextMenu({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseEnter={() => !isEditMode && setHoveredCallout(callout)}
                      onMouseLeave={() => !isEditMode && setHoveredCallout(null)}
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
            drawings
              .filter((line) => isLayerVisible(line.layerId, 'layer_t'))
              .map((line) => {
                const isEraserHovered = hoveredLineId === line.id && activeTool === 'eraser';
                const isSelectedEl = selectedElementIds.includes(line.id);
                const elOpacity = (line.opacity ?? 1) * getLayerOpacity(line.layerId, 'layer_t');
                const arrowColorId = (line.color || '#ffffff').replace('#', '');
                return (
                  <g key={line.id} opacity={elOpacity}>
                    {isSelectedEl && (
                      <polyline
                        points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={line.width * 0.3 + 1.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity={0.6}
                        className="pointer-events-none"
                      />
                    )}
                    <polyline
                      points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={isEraserHovered ? '#ef4444' : line.color}
                      strokeWidth={line.width * 0.3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={isEraserHovered ? '2,2' : undefined}
                      markerEnd={
                        line.hasArrow
                          ? `url(#arrow-${isEraserHovered ? 'eraser' : arrowColorId}-${tileLevel})`
                          : undefined
                      }
                      onMouseEnter={() => setHoveredLineId(line.id)}
                      onMouseLeave={() => setHoveredLineId(null)}
                      onTouchStart={() => {
                        if (activeTool === 'select' || activeTool === 'marquee') {
                          longPressTargetCandidateRef.current = { elementId: line.id };
                        }
                      }}
                      onClick={(e) => {
                        if (activeTool === 'eraser') {
                          e.stopPropagation();
                          handleDeleteSingleLine(line.id);
                        } else if (activeTool === 'select' || activeTool === 'marquee') {
                          e.stopPropagation();
                          handleSelectElement(line.id, e.ctrlKey || e.metaKey || e.shiftKey || isMultiSelectMode);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (isEditMode || isDrawingPolygonArea) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selectedElementIds.includes(line.id)) {
                          handleSelectElement(line.id, false);
                        }
                        setShowContextColorSubmenu(false);
                        setContextMenu({ x: e.clientX, y: e.clientY });
                      }}
                      className={
                        activeTool === 'eraser' || activeTool === 'select' || activeTool === 'marquee'
                          ? 'pointer-events-auto cursor-pointer'
                          : 'pointer-events-none'
                      }
                    />
                  </g>
                );
              })}

          {/* SAVED UTILITY THROW TRAJECTORIES (CURVED BEZIER ARCS + ORIGIN BULLSEYES) */}
          {!isDrawingPolygonArea &&
            utilities
              .filter((util) => util.throwFrom && isLayerVisible(util.layerId, 'layer_util'))
              .map((util) => {
                const geom = getThrowGeometry(util.throwFrom!, util, util.curveBend);
                const meta = UTILITY_META[util.type] || UTILITY_META.smoke;
                const utilColor = meta.colorHex || '#38bdf8';
                const isSelectedEl = selectedElementIds.includes(util.id);
                const isLockedEl = Boolean(util.locked || isLayerLocked(util.layerId || 'layer_util'));
                const isEraserHovered = hoveredUtilityId === util.id && activeTool === 'eraser';
                const elOpacity = (util.opacity ?? 1) * getLayerOpacity(util.layerId, 'layer_util');
                const pathD = `M ${geom.from.x} ${geom.from.y} Q ${geom.cp.x} ${geom.cp.y} ${util.x} ${util.y}`;

                // Chevron slightly before landing spot oriented cleanly along arrival tangent
                const tip =
                  geom.dist > 5
                    ? evaluateQuadraticBezier(geom.from, geom.cp, util, 0.85)
                    : null;
                const chevLen = 1.6;
                const chevAngle = geom.arrivalAngleRad;
                const chevronPoints = tip
                  ? `${tip.x + Math.cos(chevAngle) * 0.8},${tip.y + Math.sin(chevAngle) * 0.8} ` +
                    `${tip.x - chevLen * Math.cos(chevAngle - Math.PI / 5)},${tip.y - chevLen * Math.sin(chevAngle - Math.PI / 5)} ` +
                    `${tip.x - chevLen * Math.cos(chevAngle + Math.PI / 5)},${tip.y - chevLen * Math.sin(chevAngle + Math.PI / 5)}`
                  : null;

                return (
                  <g key={`throw_svg_${util.id}`} opacity={elOpacity}>
                    {isSelectedEl && (
                      <>
                        <line
                          x1={geom.from.x}
                          y1={geom.from.y}
                          x2={geom.cp.x}
                          y2={geom.cp.y}
                          stroke="#38bdf8"
                          strokeWidth={0.28}
                          strokeDasharray="0.8,0.8"
                          strokeOpacity={0.55}
                          className="pointer-events-none"
                        />
                        <line
                          x1={geom.cp.x}
                          y1={geom.cp.y}
                          x2={util.x}
                          y2={util.y}
                          stroke="#38bdf8"
                          strokeWidth={0.28}
                          strokeDasharray="0.8,0.8"
                          strokeOpacity={0.55}
                          className="pointer-events-none"
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth={1.9}
                          strokeOpacity={0.5}
                          strokeLinecap="round"
                          className="pointer-events-none"
                        />
                      </>
                    )}

                    {/* Outer dark casing for high contrast */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="rgba(9,9,11,0.82)"
                      strokeWidth={isSelectedEl ? 1.35 : 1.05}
                      strokeLinecap="round"
                      className="pointer-events-none"
                    />

                    {/* Dashed flight trajectory */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isEraserHovered ? '#ef4444' : utilColor}
                      strokeWidth={isSelectedEl ? 0.8 : 0.6}
                      strokeDasharray={isEraserHovered ? '1.2,1.2' : '1.7,1.1'}
                      strokeLinecap="round"
                      className="pointer-events-none"
                    />

                    {/* Arrival directional triangle near landing spot */}
                    {chevronPoints && (
                      <polygon
                        points={chevronPoints}
                        fill={isEraserHovered ? '#ef4444' : utilColor}
                        stroke="rgba(9,9,11,0.9)"
                        strokeWidth={0.25}
                        className="pointer-events-none"
                      />
                    )}

                    {/* Origin bullseye in SVG */}
                    <circle
                      cx={geom.from.x}
                      cy={geom.from.y}
                      r={isSelectedEl ? 1.35 : 1.05}
                      fill="#09090b"
                      stroke={isEraserHovered ? '#ef4444' : utilColor}
                      strokeWidth={0.45}
                      className="pointer-events-none"
                    />
                    <circle
                      cx={geom.from.x}
                      cy={geom.from.y}
                      r={0.45}
                      fill="#ffffff"
                      className="pointer-events-none"
                    />

                    {/* Wide transparent hit area along trajectory for effortless click/erase */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={3.6}
                      onMouseEnter={() => setHoveredUtilityId(util.id)}
                      onMouseLeave={() => setHoveredUtilityId(null)}
                      onTouchStart={() => {
                        if (activeTool === 'select' || activeTool === 'marquee') {
                          longPressTargetCandidateRef.current = { elementId: util.id };
                        }
                      }}
                      onClick={(e) => {
                        if (activeTool === 'eraser') {
                          e.stopPropagation();
                          if (isLockedEl) return;
                          pushHistorySnapshot();
                          setUtilities((prev) => prev.filter((u) => u.id !== util.id));
                          setSelectedElementIds((prev) => prev.filter((id) => id !== util.id));
                          setHasChangesInSession(true);
                        } else if (activeTool === 'select' || activeTool === 'marquee') {
                          e.stopPropagation();
                          handleSelectElement(
                            util.id,
                            e.ctrlKey || e.metaKey || e.shiftKey || isMultiSelectMode
                          );
                        }
                      }}
                      onContextMenu={(e) => {
                        if (isEditMode || isDrawingPolygonArea) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selectedElementIds.includes(util.id)) {
                          handleSelectElement(util.id, false);
                        }
                        setShowContextColorSubmenu(false);
                        setContextMenu({ x: e.clientX, y: e.clientY });
                      }}
                      className={
                        activeTool === 'eraser' || activeTool === 'select' || activeTool === 'marquee'
                          ? 'pointer-events-auto cursor-pointer'
                          : 'pointer-events-none'
                      }
                    />
                  </g>
                );
              })}

          {/* LIVE PENDING 2-POINT UTILITY THROW PREVIEW */}
          {!isDrawingPolygonArea &&
            activeTool === 'utility' &&
            utilityPlacementMode === 'throw' &&
            pendingUtilityThrowOrigin && (() => {
              const previewColor = UTILITY_META[selectedUtility]?.colorHex || '#0ea5e9';
              const hoverTarget = utilityHoverCoord || pendingUtilityThrowOrigin;
              const previewGeom = getThrowGeometry(pendingUtilityThrowOrigin, hoverTarget);
              const showArc =
                Math.hypot(
                  hoverTarget.x - pendingUtilityThrowOrigin.x,
                  hoverTarget.y - pendingUtilityThrowOrigin.y
                ) >= 1.2;
              return (
                <g className="pointer-events-none">
                  {showArc && (
                    <>
                      <path
                        d={`M ${pendingUtilityThrowOrigin.x} ${pendingUtilityThrowOrigin.y} Q ${previewGeom.cp.x} ${previewGeom.cp.y} ${hoverTarget.x} ${hoverTarget.y}`}
                        fill="none"
                        stroke="rgba(9,9,11,0.75)"
                        strokeWidth={1.2}
                        strokeLinecap="round"
                      />
                      <path
                        d={`M ${pendingUtilityThrowOrigin.x} ${pendingUtilityThrowOrigin.y} Q ${previewGeom.cp.x} ${previewGeom.cp.y} ${hoverTarget.x} ${hoverTarget.y}`}
                        fill="none"
                        stroke={previewColor}
                        strokeWidth={0.7}
                        strokeDasharray="1.6,1.1"
                        strokeLinecap="round"
                      />
                      <circle
                        cx={hoverTarget.x}
                        cy={hoverTarget.y}
                        r={1.8}
                        fill={previewColor}
                        fillOpacity={0.22}
                        stroke={previewColor}
                        strokeWidth={0.45}
                      />
                    </>
                  )}
                  <circle
                    cx={pendingUtilityThrowOrigin.x}
                    cy={pendingUtilityThrowOrigin.y}
                    r={2.1}
                    fill={previewColor}
                    fillOpacity={0.25}
                  />
                  <circle
                    cx={pendingUtilityThrowOrigin.x}
                    cy={pendingUtilityThrowOrigin.y}
                    r={1.2}
                    fill="#09090b"
                    stroke={previewColor}
                    strokeWidth={0.55}
                  />
                  <circle cx={pendingUtilityThrowOrigin.x} cy={pendingUtilityThrowOrigin.y} r={0.45} fill="#ffffff" />
                </g>
              );
            })()}

          {/* Real-time stroke while drawing */}
          {currentDrawing && currentDrawing.points.length > 1 && (
            <polyline
              points={currentDrawing.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={currentDrawing.color}
              strokeWidth={0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={
                currentDrawing.hasArrow
                  ? `url(#arrow-${(currentDrawing.color || '#ffffff').replace('#', '')}-${tileLevel})`
                  : undefined
              }
            />
          )}
        </svg>

        {/* INTERACTIVE THROW ORIGIN & CURVE BEND HANDLES (HTML overlay above SVG) */}
        {!isDrawingPolygonArea &&
          utilities
            .filter((util) => util.throwFrom && isLayerVisible(util.layerId, 'layer_util'))
            .map((util) => {
              const geom = getThrowGeometry(util.throwFrom!, util, util.curveBend);
              const isSelectedEl = selectedElementIds.includes(util.id);
              const isLockedEl = Boolean(util.locked || isLayerLocked(util.layerId || 'layer_util'));
              const elOpacity = (util.opacity ?? 1) * getLayerOpacity(util.layerId, 'layer_util');
              const meta = UTILITY_META[util.type] || UTILITY_META.smoke;
              const throwBadge =
                util.throwType && util.throwType !== 'left'
                  ? THROW_TYPE_META[util.throwType]?.short
                  : null;

              return (
                <React.Fragment key={`throw_handles_${util.id}`}>
                  {/* 1. Abwurfpunkt Interactive Origin Handle */}
                  <div
                    data-utility-handle="origin"
                    style={{
                      left: `calc(50% + ${geom.from.x}%)`,
                      top: `calc(50% + ${geom.from.y}%)`,
                      opacity: elOpacity,
                    }}
                    onMouseDown={(e) => {
                      if (activeTool === 'select' && !isLockedEl) {
                        e.stopPropagation();
                        startUtilityHandleDrag(util, 'origin', e);
                      }
                    }}
                    onTouchStart={(e) => {
                      if (activeTool === 'select' && !isLockedEl && isSelectedEl) {
                        e.stopPropagation();
                        cancelTouchLongPress();
                        startUtilityHandleDrag(util, 'origin', e);
                      } else if (activeTool !== 'eraser') {
                        longPressTargetCandidateRef.current = { elementId: util.id };
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasMovedDistance) return;
                      if (activeTool === 'eraser') {
                        if (isLockedEl) return;
                        pushHistorySnapshot();
                        setUtilities((prev) => prev.filter((u) => u.id !== util.id));
                        setSelectedElementIds((prev) => prev.filter((id) => id !== util.id));
                        setHasChangesInSession(true);
                      } else {
                        handleSelectElement(
                          util.id,
                          e.ctrlKey || e.metaKey || e.shiftKey || isMultiSelectMode
                        );
                      }
                    }}
                    onContextMenu={(e) => {
                      if (isEditMode || isDrawingPolygonArea) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (!selectedElementIds.includes(util.id)) {
                        handleSelectElement(util.id, false);
                      }
                      setShowContextColorSubmenu(false);
                      setContextMenu({ x: e.clientX, y: e.clientY });
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 z-26 flex items-center justify-center ${
                      activeTool === 'select' && !isLockedEl
                        ? 'cursor-grab active:cursor-grabbing'
                        : 'cursor-pointer'
                    } ${isSelectedEl ? 'w-6 h-6' : 'w-4 h-4 hover:scale-125'} transition-transform`}
                    title={
                      isDe
                        ? `Abwurfpunkt (${meta.labelDe})${activeTool === 'select' && !isLockedEl ? ' · Ziehen zum Verschieben' : ''}`
                        : `Throw Origin (${meta.labelEn})`
                    }
                  >
                    {isSelectedEl && (
                      <span
                        className="w-4 h-4 rounded-full border-2 border-sky-300 bg-zinc-950/90 shadow-lg flex items-center justify-center"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: meta.colorHex }}
                        />
                      </span>
                    )}
                    {throwBadge && (
                      <span
                        style={{ borderColor: meta.colorHex }}
                        className="absolute -top-4 left-1/2 -translate-x-1/2 px-1 py-0 rounded bg-zinc-950/95 border text-[8px] font-mono font-black text-white whitespace-nowrap shadow-md pointer-events-none"
                      >
                        {throwBadge}
                      </span>
                    )}
                  </div>

                  {/* 2. Draggable Curve Bend Handle (when selected & unlocked) */}
                  {isSelectedEl && activeTool === 'select' && !isLockedEl && (
                    <div
                      data-utility-handle="curve"
                      style={{
                        left: `calc(50% + ${geom.midOnCurve.x}%)`,
                        top: `calc(50% + ${geom.midOnCurve.y}%)`,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        startUtilityHandleDrag(util, 'curve', e);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        cancelTouchLongPress();
                        startUtilityHandleDrag(util, 'curve', e);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-35 w-4 h-4 rounded-full bg-sky-400 border-2 border-zinc-950 shadow-[0_0_8px_rgba(56,189,248,0.85)] cursor-move hover:scale-125 transition-transform flex items-center justify-center"
                      title={
                        isDe
                          ? 'Kurvenbogen ziehen (z.B. Bandenwurf anpassen)'
                          : 'Drag to bend throw curve'
                      }
                    >
                      <span className="w-1 h-1 rounded-full bg-zinc-950 pointer-events-none" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}

        {/* UTILITY MARKERS (Granaten-Symbole ohne Kreis, in Kreisgröße w-6 h-6 mit Originalfarben) */}
        {!isDrawingPolygonArea &&
          utilities
            .filter((util) => isLayerVisible(util.layerId, 'layer_util'))
            .map((util) => {
              const isSelectedEl = selectedElementIds.includes(util.id);
              const isLockedEl = Boolean(util.locked || isLayerLocked(util.layerId || 'layer_util'));
              const elOpacity = (util.opacity ?? 1) * getLayerOpacity(util.layerId, 'layer_util');
              const meta = UTILITY_META[util.type] || UTILITY_META.smoke;
              return (
                <div
                  key={util.id}
                  data-utility-handle="landing"
                  style={{
                    left: `calc(50% + ${util.x}%)`,
                    top: `calc(50% + ${util.y}%)`,
                    opacity: elOpacity,
                  }}
                  onMouseDown={(e) => {
                    if (activeTool === 'select' && !isLockedEl) {
                      e.stopPropagation();
                      startUtilityHandleDrag(util, 'landing', e);
                    }
                  }}
                  onTouchStart={(e) => {
                    if (activeTool === 'select' && !isLockedEl && isSelectedEl) {
                      cancelTouchLongPress();
                      startUtilityHandleDrag(util, 'landing', e);
                    } else if (activeTool !== 'eraser') {
                      longPressTargetCandidateRef.current = { elementId: util.id };
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasMovedDistance) return;
                    if (activeTool === 'eraser') {
                      if (isLockedEl) return;
                      pushHistorySnapshot();
                      setUtilities((prev) => prev.filter((u) => u.id !== util.id));
                      setSelectedElementIds((prev) => prev.filter((id) => id !== util.id));
                      setHasChangesInSession(true);
                    } else {
                      handleSelectElement(util.id, e.ctrlKey || e.metaKey || e.shiftKey || isMultiSelectMode);
                    }
                  }}
                  onContextMenu={(e) => {
                    if (isEditMode || isDrawingPolygonArea) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (!selectedElementIds.includes(util.id)) {
                      handleSelectElement(util.id, false);
                    }
                    setShowContextColorSubmenu(false);
                    setContextMenu({ x: e.clientX, y: e.clientY });
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-25 w-6 h-6 flex items-center justify-center ${
                    activeTool === 'select' && !isLockedEl ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  } hover:scale-115 transition-all ${
                    meta.textClass
                  } drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                    isSelectedEl
                      ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-zinc-950 rounded-md scale-115 bg-zinc-950/60'
                      : ''
                  }`}
                  title={
                    activeTool === 'eraser'
                      ? isDe
                        ? 'Klicken zum Entfernen'
                        : 'Click to remove'
                      : `${isDe ? meta.labelDe : meta.labelEn}${util.label ? ` · ${util.label}` : ''} — ${
                          isDe ? 'Klicken zum Auswählen · Ziehen zum Verschieben' : 'Click to select · Drag to move'
                        }`
                  }
                >
                  <UtilitySymbol type={util.type} size="md" />
                  {util.label && (
                    <span className="absolute top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-zinc-950/90 border border-zinc-700/80 text-[9px] font-semibold text-zinc-100 whitespace-nowrap shadow-md pointer-events-none">
                      {util.label}
                    </span>
                  )}
                  {isLockedEl && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-zinc-950 border border-amber-400 flex items-center justify-center">
                      <Lock className="w-2 h-2 text-amber-400" />
                    </span>
                  )}
                </div>
              );
            })}

        {/* PLAYER TOKENS */}
        {!isDrawingPolygonArea &&
          players
            .filter((player) =>
              isLayerVisible(player.layerId, player.side === 'ct' ? 'layer_ct' : 'layer_t')
            )
            .map((player) => {
              const isSelectedEl = selectedElementIds.includes(player.id);
              const defaultLid = player.side === 'ct' ? 'layer_ct' : 'layer_t';
              const isLockedEl = Boolean(player.locked || isLayerLocked(player.layerId || defaultLid));
              const elOpacity = (player.opacity ?? 1) * getLayerOpacity(player.layerId, defaultLid);
              return (
                <div
                  key={player.id}
                  style={{
                    left: `calc(50% + ${player.x}%)`,
                    top: `calc(50% + ${player.y}%)`,
                    opacity: elOpacity,
                  }}
                  onTouchStart={() => {
                    if (activeTool !== 'eraser') {
                      longPressTargetCandidateRef.current = { elementId: player.id };
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'eraser') {
                      if (isLockedEl) return;
                      pushHistorySnapshot();
                      setPlayers((prev) => prev.filter((p) => p.id !== player.id));
                      setSelectedElementIds((prev) => prev.filter((id) => id !== player.id));
                      setHasChangesInSession(true);
                    } else {
                      handleSelectElement(player.id, e.ctrlKey || e.metaKey || e.shiftKey || isMultiSelectMode);
                    }
                  }}
                  onContextMenu={(e) => {
                    if (isEditMode || isDrawingPolygonArea) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (!selectedElementIds.includes(player.id)) {
                      handleSelectElement(player.id, false);
                    }
                    setShowContextColorSubmenu(false);
                    setContextMenu({ x: e.clientX, y: e.clientY });
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-25 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-black tabular-nums shadow-lg border cursor-pointer hover:scale-115 transition-all ${
                    player.side === 'ct'
                      ? 'bg-blue-600/95 text-white border-blue-200/80'
                      : 'bg-amber-700/95 text-amber-50 border-amber-200/80'
                  } ${
                    isSelectedEl
                      ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-zinc-950 scale-115'
                      : 'ring-1 ring-black/50'
                  }`}
                  title={
                    activeTool === 'eraser'
                      ? isDe
                        ? 'Klicken zum Entfernen'
                        : 'Click to remove'
                      : `${player.side.toUpperCase()} #${player.number}${
                          player.hasBomb ? ' (C4)' : ''
                        } — ${isDe ? 'Klicken zum Auswählen (Strg für Mehrfachauswahl)' : 'Click to select'}`
                  }
                >
                  <img
                    src={resolveAssetPath(player.side === 'ct' ? 'ct.png' : 'T.png')}
                    alt={player.side.toUpperCase()}
                    className="w-3.5 h-3.5 object-contain opacity-30 pointer-events-none absolute inset-0 m-auto"
                    draggable={false}
                  />
                  <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {player.hasBomb ? 'C4' : player.number}
                  </span>
                  {isLockedEl && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-zinc-950 border border-amber-400 flex items-center justify-center">
                      <Lock className="w-2 h-2 text-amber-400" />
                    </span>
                  )}
                </div>
              );
            })}

        {/* INTERACTIVE CALLOUT PINS & ROTATABLE LABELS */}
        {!isDrawingPolygonArea &&
          tileCallouts.map((callout) => {
            const isSelected = selectedCallout?.id === callout.id;
            const isMultiSelected = selectedCalloutIds.includes(callout.id);
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
                className={`absolute w-0 h-0 flex items-center justify-center pointer-events-auto group ${
                  isBeingDragged ? 'z-50' : 'z-25'
                }`}
                onMouseEnter={() => !draggingCalloutId && setHoveredCallout(callout)}
                onMouseLeave={() => setHoveredCallout(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasMovedDistance) {
                    handleSelectCalloutMulti(callout, e.ctrlKey || e.metaKey || e.shiftKey || isMultiSelectMode);
                  }
                }}
                onContextMenu={(e) => {
                  if (isDrawingPolygonArea) return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selectedCalloutIds.includes(callout.id)) {
                    handleSelectCalloutMulti(callout, false, false);
                  } else {
                    setSelectedCallout(null);
                  }
                  setShowContextColorSubmenu(false);
                  setContextMenu({ x: e.clientX, y: e.clientY });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleOpenCalloutEditor(callout, e);
                }}
              >
                {!callout.hidePin && (
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-auto"
                  >
                    {isImageMode ? (
                      <div
                        onMouseDown={(e) => handleCalloutDragStart(callout, e)}
                        onTouchStart={(e) => {
                          longPressTargetCandidateRef.current = { callout };
                          handleCalloutDragStart(callout, e);
                        }}
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
                        onMouseDown={(e) => {
                          if (movingAreaCalloutId === callout.id) {
                            handleAreaMoveStart(callout, e);
                          } else {
                            handleCalloutDragStart(callout, e);
                          }
                        }}
                        onTouchStart={(e) => {
                          longPressTargetCandidateRef.current = { callout };
                          if (movingAreaCalloutId === callout.id) {
                            handleAreaMoveStart(callout, e);
                          } else {
                            handleCalloutDragStart(callout, e);
                          }
                        }}
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
                    onMouseDown={(e) => {
                      if (movingAreaCalloutId === callout.id) {
                        handleAreaMoveStart(callout, e);
                      } else {
                        handleCalloutDragStart(callout, e);
                      }
                    }}
                    onTouchStart={(e) => {
                      longPressTargetCandidateRef.current = { callout };
                      if (movingAreaCalloutId === callout.id) {
                        handleAreaMoveStart(callout, e);
                      } else {
                        handleCalloutDragStart(callout, e);
                      }
                    }}
                    style={{
                      fontSize: `${fontSize}px`,
                      fontFamily: getFontFamilyStyle(callout.fontFamily),
                      padding: `${Math.round(2 * calloutScale)}px ${Math.round(6 * calloutScale)}px`,
                      transform: `translate(${offX}px, ${offY}px) rotate(${callout.textRotation !== undefined ? callout.textRotation : (callout.rotation || 0)}deg)`,
                      transformOrigin: 'center center',
                    }}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded font-bold tracking-tight whitespace-nowrap text-center leading-tight shadow-lg transition-transform shrink-0 z-30 flex items-center gap-1 ${
                      isEditMode
                        ? isSelected || isMultiSelected || singleEditCalloutId === callout.id
                          ? 'cursor-grab active:cursor-grabbing bg-zinc-950 border border-amber-400 text-amber-200 ring-2 ring-amber-400/70'
                          : 'cursor-grab active:cursor-grabbing bg-zinc-950 border border-sky-400 text-sky-200 ring-1 ring-sky-400/50'
                        : isMultiSelected
                        ? 'bg-sky-500/95 text-zinc-950 scale-105 z-30 ring-2 ring-sky-300'
                        : isSelected || isHighlighted
                        ? 'bg-white text-zinc-950 scale-105 z-30 ring-1 ring-black'
                        : 'bg-zinc-950/85 text-zinc-200 border border-zinc-700/80 group-hover:bg-zinc-900 group-hover:text-white'
                    }`}
                  >
                    {callout.name.includes('\n') ? (
                      callout.name.split('\n').slice(0, 2).map((line, idx) => (
                        <div key={idx} className="whitespace-nowrap leading-tight">
                          {line}
                        </div>
                      ))
                    ) : (
                      <span className="whitespace-nowrap">{callout.name}</span>
                    )}
                    {callout.locked && !callout.area && (
                      <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                )}

                {/* EDIT MODE QUICK BAR (erst nach Klick / Rechtsklick sichtbar) */}
                {isEditMode && (isSelected || isMultiSelected || singleEditCalloutId === callout.id) && (
                  <div
                    data-no-map-click="true"
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      transform: `translate(calc(-50% + ${offX}px), calc(-50% + ${offY - Math.max(34, fontSize + 24)}px))`,
                    }}
                    className="absolute top-1/2 left-1/2 flex items-center gap-1.5 bg-zinc-900/95 rounded-lg border border-zinc-700 px-2 py-1 shadow-2xl z-[60] backdrop-blur-xs whitespace-nowrap"
                  >
                    {/* Quick Rotate +45° for Text */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        pushHistorySnapshot();
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

                    {/* Move Area & Hide Others */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (movingAreaCalloutId === callout.id) {
                          setMovingAreaCalloutId(null);
                          return;
                        }
                        if (!callout.area) {
                          const width = 10;
                          const height = 10;
                          const areaX = Math.max(-50, Math.min(50 - width, Math.round((callout.x - width / 2) * 10) / 10));
                          const areaY = Math.max(-50, Math.min(50 - height, Math.round((callout.y - height / 2) * 10) / 10));
                          const updatedCallouts = mapData.callouts.map((c) =>
                            c.id === callout.id
                              ? {
                                  ...c,
                                  area: { x: areaX, y: areaY, width, height, shape: 'rect' as const },
                                }
                              : c
                          );
                          handleMapUpdate({ ...mapData, callouts: updatedCallouts });
                        }
                        setMovingAreaCalloutId(callout.id);
                      }}
                      className={`p-0.5 transition-colors ${
                        movingAreaCalloutId === callout.id
                          ? 'text-amber-400 bg-amber-400/20 rounded ring-1 ring-amber-400'
                          : 'text-zinc-300 hover:text-amber-400'
                      }`}
                      title={isDe ? 'Bereich verschieben' : 'Move area'}
                    >
                      <Move className="w-3 h-3" />
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

        {/* LIVE MARQUEE AREA SELECTION BOX */}
        {marqueeRect && (
          <div
            style={{
              left: `calc(50% + ${Math.min(marqueeRect.startX, marqueeRect.currentX)}%)`,
              top: `calc(50% + ${Math.min(marqueeRect.startY, marqueeRect.currentY)}%)`,
              width: `${Math.abs(marqueeRect.currentX - marqueeRect.startX)}%`,
              height: `${Math.abs(marqueeRect.currentY - marqueeRect.startY)}%`,
            }}
            className="absolute pointer-events-none z-50 border-2 border-dashed border-sky-400 bg-sky-400/15 rounded-xs shadow-[0_0_12px_rgba(56,189,248,0.35)]"
          />
        )}
      </div>
    );
  };

  return (
    <div
      ref={mainWrapperRef}
      onClick={handleOutsideClick}
      style={{ overscrollBehavior: 'none' }}
      className="fixed inset-0 h-dvh w-full z-50 flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden overscroll-none"
    >
      {/* AREA MOVE MODE BANNER (HIDES OTHERS) */}
      {movingAreaCalloutId && (
        <div className="absolute top-26 md:top-16 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-500 text-zinc-950 font-bold rounded-xl shadow-2xl animate-bounce max-w-[92vw] text-xs sm:text-sm">
          <Move className="w-4 h-4 shrink-0" />
          <span className="truncate">{isDe ? 'Bereich-Verschiebungsmodus' : 'Area Move Mode'}</span>
          <button
            onClick={() => setMovingAreaCalloutId(null)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-zinc-950 text-white rounded-lg text-xs hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
          >
            <Check className="w-3.5 h-3.5 text-amber-400" />
            <span>{isDe ? 'Fertig' : 'Done'}</span>
          </button>
        </div>
      )}

      {/* CUSTOM SELECTION ACTIVE BANNER */}
      {isCustomSelectionActive && !movingAreaCalloutId && (
        <div className="absolute top-26 md:top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 bg-indigo-950/90 border border-indigo-500/40 text-indigo-200 text-xs font-semibold rounded-full shadow-xl backdrop-blur-md animate-in fade-in duration-200 max-w-[92vw]">
          <ListFilter className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>{isDe ? `Meine Auswahl: ${visibleCallouts.length} Callouts` : `My Selection: ${visibleCallouts.length} Callouts`}</span>
          <button
            onClick={handleOpenCustomSelectionModal}
            className="ml-1 text-[11px] underline text-indigo-300 hover:text-white cursor-pointer"
          >
            {isDe ? 'Anpassen' : 'Edit'}
          </button>
          <button
            onClick={() => setIsCustomSelectionActive(false)}
            className="ml-1 p-0.5 text-indigo-400 hover:text-white rounded hover:bg-indigo-900/60 cursor-pointer"
            title={isDe ? 'Filter ausschalten (Alle anzeigen)' : 'Disable filter'}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {/* 1. CLEAN STUDIO TOP HEADER BAR */}
      <TacticalHeaderBar
        lang={lang}
        mapName={mapData.name}
        mapCategory={mapData.category}
        hasLowerImage={Boolean(mapData.lowerImage)}
        currentLevel={currentLevel}
        onChangeLevel={setCurrentLevel}
        selectedZoneFilter={selectedZoneFilter}
        onChangeZoneFilter={setSelectedZoneFilter}
        hasChangesInSession={hasChangesInSession}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        hasBoardElements={drawings.length > 0 || utilities.length > 0 || players.length > 0}
        onClearTactics={handleClearTactics}
        presetCount={tacticPresets.length}
        onOpenPresets={() => setIsPresetsModalOpen(true)}
        onShare={handleShareTactics}
        isEditActive={Boolean(isEditMode || singleEditCalloutId)}
        onEditAction={() => {
          if (isEditMode || singleEditCalloutId) {
            if (hasChangesInSession) {
              handleSaveSnapshot(
                isDe
                  ? `Karte bearbeitet (${mapData.callouts.length} Callouts)`
                  : `Map edited (${mapData.callouts.length} Callouts)`
              );
            }
            setIsEditMode(false);
            setSingleEditCalloutId(null);
            setSelectedCallout(null);
            setSelectedCalloutIds([]);
            setHighlightedCalloutId(undefined);
            setMovingAreaCalloutId(null);
            setContextMenu(null);
          } else {
            setIsEditOptionsModalOpen(true);
          }
        }}
        isTabletLayersOpen={isTabletLayersOpen}
        onToggleTabletLayers={() => setIsTabletLayersOpen((p) => !p)}
        colorMode={colorMode}
        onChangeColorMode={setColorMode}
        customSelectedCount={customSelectedCalloutIds.length}
        onToggleCustomSelection={() => {
          if (customSelectedCalloutIds.length === 0) {
            handleOpenCustomSelectionModal();
          } else {
            setIsCustomSelectionActive(!isCustomSelectionActive);
          }
        }}
        isCustomSelectionActive={isCustomSelectionActive}
        onOpenHelp={() => setIsHelpDocsOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onTryBack={handleTryBack}
      />

      {/* 2. MOBILE-ONLY TOP DRAWING TOOLBAR */}
      {isToolbarVisible && !isFullscreen && (
        <TacticalMobileToolbar
          lang={lang}
          activeTool={activeTool}
          penWithArrow={penWithArrow}
          isMultiSelectMode={isMultiSelectMode}
          penColor={penColor}
          colors={colors}
          showColorPicker={showColorPicker}
          selectedUtility={selectedUtility}
          utilityPlacementMode={utilityPlacementMode}
          selectedThrowType={selectedThrowType}
          selectedPlayerSide={selectedPlayerSide}
          onHideToolbar={() => setIsToolbarVisible(false)}
          onSelectTool={setActiveTool}
          onToggleMultiSelect={() => {
            setIsMultiSelectMode((prev) => !prev);
            setActiveTool('select');
          }}
          onToolPress={handleToolPress}
          onToggleColorPicker={() => setShowColorPicker(!showColorPicker)}
          onSelectColor={(c) => {
            setPenColor(c);
            setShowColorPicker(false);
          }}
          onOpenCustomColor={() => {
            setCustomColorTarget('pen');
            setIsCustomColorModalOpen(true);
            setShowColorPicker(false);
          }}
          onSelectUtility={setSelectedUtility}
          onSelectUtilityPlacementMode={setUtilityPlacementMode}
          onSelectThrowType={setSelectedThrowType}
          onSelectPlayerSide={setSelectedPlayerSide}
        />
      )}

      {/* 3. MAIN 3-COLUMN STUDIO STAGE */}
      <div className="relative flex-1 min-h-0 min-w-0 flex overflow-hidden">
        {/* LEFT VERTICAL TOOL RAIL (Desktop & Tablet ONLY) */}
        {isToolbarVisible && !isFullscreen && (
          <TacticalLeftSidebar
            lang={lang}
            activeTool={activeTool}
            penWithArrow={penWithArrow}
            penColor={penColor}
            colors={colors}
            selectedUtility={selectedUtility}
            utilityPlacementMode={utilityPlacementMode}
            selectedThrowType={selectedThrowType}
            selectedPlayerSide={selectedPlayerSide}
            canUndo={canUndo}
            canRedo={canRedo}
            hasBoardElements={drawings.length > 0 || utilities.length > 0 || players.length > 0}
            onHideToolbar={() => setIsToolbarVisible(false)}
            onSelectTool={setActiveTool}
            onToolPress={handleToolPress}
            onSelectUtility={setSelectedUtility}
            onSelectUtilityPlacementMode={setUtilityPlacementMode}
            onSelectThrowType={setSelectedThrowType}
            onSelectPlayerSide={setSelectedPlayerSide}
            onSelectColor={setPenColor}
            onOpenCustomColor={() => {
              setCustomColorTarget('pen');
              setIsCustomColorModalOpen(true);
            }}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClearTactics={handleClearTactics}
          />
        )}

        {/* MINIMALIST LEFT-SIDE REOPEN BUTTON (an Werkzeuge-Position wenn ausgeblendet) */}
        {!isToolbarVisible && !isFullscreen && (
          <button
            type="button"
            data-no-map-click="true"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setIsToolbarVisible(true);
            }}
            className="absolute top-2.5 left-2.5 z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-950/90 border border-zinc-800/90 text-zinc-300 hover:text-white hover:bg-zinc-900 shadow-lg backdrop-blur-xs transition-colors cursor-pointer text-[11px] font-semibold print:hidden"
            title={isDe ? 'Werkzeuge einblenden' : 'Show tools'}
          >
            <PanelLeftOpen className="w-3.5 h-3.5 text-sky-400" />
            <span className="md:hidden">{isDe ? 'Werkzeuge' : 'Tools'}</span>
          </button>
        )}

        {/* MINIMALIST RIGHT-SIDE REOPEN BUTTON (PC wenn rechtes Menü ausgeblendet) */}
        {!isRightPanelVisible && !isFullscreen && (
          <button
            type="button"
            data-no-map-click="true"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setIsRightPanelVisible(true);
            }}
            className="hidden lg:flex absolute top-3 right-3 z-40 p-1.5 rounded-lg bg-zinc-950/90 border border-zinc-800/90 text-zinc-400 hover:text-white hover:bg-zinc-900 shadow-lg backdrop-blur-xs transition-colors cursor-pointer print:hidden"
            title={isDe ? 'Rechtes Menü einblenden' : 'Show right panel'}
          >
            <PanelRightOpen className="w-3.5 h-3.5" />
          </button>
        )}

        {/* CENTER MAP CANVAS STAGE */}
        <div
          ref={stageRef}
          style={{ touchAction: 'none' }}
          className={`relative flex-1 min-h-0 min-w-0 bg-zinc-950 flex items-center justify-center overflow-hidden ${
            isPanning
              ? 'cursor-grabbing'
              : activeTool === 'eraser'
              ? 'cursor-pointer'
              : activeTool === 'pen' || activeTool === 'arrow' || activeTool === 'marquee'
              ? 'cursor-crosshair'
              : 'cursor-grab'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!hasMovedDistance && !isDrawingPolygonArea) {
              if (selectedElementIds.length > 0 || selectedCalloutIds.length > 0) {
                setShowContextColorSubmenu(false);
                setContextMenu({ x: e.clientX, y: e.clientY });
              }
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleMapCanvasClick}
          onDoubleClick={handleMapDoubleClick}
          onWheel={handleWheel}
        >
          {/* POLYGON DRAWING MODE FLOATING BANNER */}
          {isDrawingPolygonArea && (
            <div
              data-no-map-click="true"
              className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 sm:px-4 py-2 rounded-xl bg-zinc-950/95 border-2 border-sky-400 shadow-2xl backdrop-blur-md max-w-[92vw] sm:max-w-3xl pointer-events-auto text-xs text-white print:hidden"
            >
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

          {/* 2-POINT UTILITY THROW STEP GUIDANCE PILL */}
          {!isDrawingPolygonArea &&
            !isEditMode &&
            selectedElementIds.length === 0 &&
            selectedCalloutIds.length === 0 &&
            activeTool === 'utility' &&
            utilityPlacementMode === 'throw' && (
              <div
                data-no-map-click="true"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className={`absolute ${
                  !isToolbarVisible && !isFullscreen ? 'top-12 md:top-3' : 'top-3'
                } left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/95 border border-emerald-500/60 text-xs text-zinc-100 shadow-2xl backdrop-blur-md w-max max-w-[94vw] print:hidden`}
              >
                <Spline className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {pendingUtilityThrowOrigin ? (
                  <>
                    <span className="font-semibold text-emerald-200">
                      {isDe
                        ? '1. Abwurf gesetzt → 2. Landeplatz wählen'
                        : '1. Origin set → 2. Tap landing spot'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/40 text-[10px] font-semibold text-sky-300 whitespace-nowrap">
                      {formatThrowTypeFull(selectedThrowType, lang)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingUtilityThrowOrigin(null);
                        setUtilityHoverCoord(null);
                      }}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold text-zinc-300 hover:text-white cursor-pointer"
                    >
                      {isDe ? 'Abbrechen' : 'Cancel'}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-zinc-200">
                      {isDe
                        ? '1. Punkt tippen: Abwurfort wählen'
                        : 'Step 1: Tap throw origin'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/40 text-[10px] font-semibold text-sky-300 whitespace-nowrap">
                      {formatThrowTypeFull(selectedThrowType, lang)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUtilityPlacementMode('point')}
                      className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-zinc-300 hover:text-white border border-zinc-700 cursor-pointer"
                    >
                      {isDe ? 'Nur Spot' : 'Spot'}
                    </button>
                  </>
                )}
              </div>
            )}

          {/* 500ms TOUCH LONG-PRESS VISUAL PROGRESS RING */}
          {longPressVisual && (
            <div
              style={{
                left: `${longPressVisual.x}px`,
                top: `${longPressVisual.y}px`,
              }}
              className="fixed -translate-x-1/2 -translate-y-1/2 z-[120] pointer-events-none"
            >
              <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90 drop-shadow-[0_0_8px_rgba(56,189,248,0.65)]">
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="rgba(9,9,11,0.45)"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="3.5"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="138.23"
                  strokeDashoffset="138.23"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="138.23"
                    to="0"
                    dur="0.5s"
                    fill="freeze"
                  />
                </circle>
              </svg>
            </div>
          )}

          {/* FLOATING ELEMENT & CALLOUT SELECTION CONTEXT BAR */}
          {!isDrawingPolygonArea && !isEditMode && !contextMenu && (
            <TacticalSelectionBar
              lang={lang}
              selectedElementIds={selectedElementIds}
              selectedCalloutIds={selectedCalloutIds}
              callouts={mapData.callouts}
              drawings={drawings}
              utilities={utilities}
              players={players}
              colors={colors}
              movingAreaCalloutId={movingAreaCalloutId}
              showContextColorPicker={showContextColorPicker}
              onToggleContextColorPicker={() => setShowContextColorPicker((p) => !p)}
              onShowCalloutInfo={(c) => {
                setSelectedCallout(c);
                setMobileSheetTab('layers');
                setIsMobileSheetOpen(true);
              }}
              onEditCallout={handleOpenCalloutEditor}
              onToggleMoveArea={(c) => {
                if (movingAreaCalloutId === c.id) {
                  setMovingAreaCalloutId(null);
                } else {
                  if (!c.area) {
                    pushHistorySnapshot();
                    const width = 10;
                    const height = 10;
                    const areaX = Math.max(-50, Math.min(50 - width, Math.round((c.x - width / 2) * 10) / 10));
                    const areaY = Math.max(-50, Math.min(50 - height, Math.round((c.y - height / 2) * 10) / 10));
                    const updatedCallouts = mapData.callouts.map((item) =>
                      item.id === c.id
                        ? { ...item, area: { x: areaX, y: areaY, width, height, shape: 'rect' as const } }
                        : item
                    );
                    handleMapUpdate({ ...mapData, callouts: updatedCallouts });
                  }
                  setIsEditMode(true);
                  setMovingAreaCalloutId(c.id);
                }
              }}
              onGroupSelected={handleGroupSelected}
              onDuplicateSelected={handleDuplicateSelected}
              onToggleLockSelected={handleToggleLockSelected}
              onUpdateColor={(c) => {
                handleUpdateSelectedElementsProps({ color: c });
                setShowContextColorPicker(false);
              }}
              onUpdateSelectedElementsProps={handleUpdateSelectedElementsProps}
              onOpenCustomColor={() => {
                setCustomColorTarget('selection');
                setIsCustomColorModalOpen(true);
                setShowContextColorPicker(false);
              }}
              onDeleteSelected={handleDeleteSelectedElements}
              onClearSelection={() => {
                setSelectedElementIds([]);
                setSelectedCalloutIds([]);
                setSelectedCallout(null);
                setShowContextColorPicker(false);
              }}
            />
          )}

          {/* RIGHT-CLICK / LONG-PRESS CONTEXT MENU POPOVER */}
          {contextMenu && !isDrawingPolygonArea && (
            <TacticalContextMenu
              lang={lang}
              position={contextMenu}
              selectedElementIds={selectedElementIds}
              selectedCalloutIds={selectedCalloutIds}
              callouts={mapData.callouts}
              drawings={drawings}
              utilities={utilities}
              players={players}
              colors={colors}
              movingAreaCalloutId={movingAreaCalloutId}
              showColorSubmenu={showContextColorSubmenu}
              onToggleColorSubmenu={() => setShowContextColorSubmenu((p) => !p)}
              onEditCallout={handleOpenCalloutEditor}
              onRotateCalloutText={(c) => {
                pushHistorySnapshot();
                const currentTextRot =
                  c.textRotation !== undefined ? c.textRotation : c.rotation || 0;
                let nextRot = currentTextRot + 45;
                if (nextRot > 180) nextRot = -135;
                const updated = mapData.callouts.map((item) =>
                  item.id === c.id ? { ...item, textRotation: nextRot } : item
                );
                handleMapUpdate({ ...mapData, callouts: updated });
              }}
              onToggleMoveArea={(c) => {
                if (movingAreaCalloutId === c.id) {
                  setMovingAreaCalloutId(null);
                } else {
                  if (!c.area) {
                    pushHistorySnapshot();
                    const width = 10;
                    const height = 10;
                    const areaX = Math.max(-50, Math.min(50 - width, Math.round((c.x - width / 2) * 10) / 10));
                    const areaY = Math.max(-50, Math.min(50 - height, Math.round((c.y - height / 2) * 10) / 10));
                    const updatedCallouts = mapData.callouts.map((item) =>
                      item.id === c.id
                        ? { ...item, area: { x: areaX, y: areaY, width, height, shape: 'rect' as const } }
                        : item
                    );
                    handleMapUpdate({ ...mapData, callouts: updatedCallouts });
                  }
                  setIsEditMode(true);
                  setMovingAreaCalloutId(c.id);
                }
              }}
              onGroupSelected={handleGroupSelected}
              onDuplicateSelected={handleDuplicateSelected}
              onToggleLockSelected={handleToggleLockSelected}
              onUpdateColor={(c) => {
                handleUpdateSelectedElementsProps({ color: c });
                setShowContextColorSubmenu(false);
                setContextMenu(null);
              }}
              onUpdateSelectedElementsProps={handleUpdateSelectedElementsProps}
              onDeleteSelected={handleDeleteSelectedElements}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* Zoomable & Pannable Radar Map Container */}
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
              className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-200 text-xs font-semibold backdrop-blur-md shadow-2xl cursor-pointer hover:bg-amber-500/30 transition-all print:hidden"
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

          {/* MOBILE INITIAL SHORTCUT HINT BANNER (Touch-Gesten: 10 Sekunden oder Tippen zum Schließen) */}
          {showMobileHintBanner &&
            !isDrawingPolygonArea &&
            !isEditMode &&
            selectedElementIds.length === 0 &&
            selectedCalloutIds.length === 0 &&
            !(activeTool === 'utility' && utilityPlacementMode === 'throw') && (
            <div
              data-no-map-click="true"
              onClick={() => setShowMobileHintBanner(false)}
              className={`md:hidden absolute ${
                !isToolbarVisible && !isFullscreen ? 'top-12' : 'top-3'
              } left-2 right-2 z-40 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-950/95 border border-sky-500/60 text-zinc-100 text-xs font-medium backdrop-blur-md shadow-2xl cursor-pointer transition-all animate-in fade-in slide-in-from-top-2 print:hidden`}
              title={isDe ? 'Tippen zum Schließen' : 'Tap to dismiss'}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Info className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-snug">
                  <span className="inline-flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-300 font-bold text-[10px]">
                      {isDe ? 'Tippen' : 'Tap'}
                    </span>
                    <span className="text-zinc-300">{isDe ? 'Auswählen' : 'Select'}</span>
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-sky-300 font-bold text-[10px]">
                      {isDe ? 'Halten (0,5s)' : 'Hold (0.5s)'}
                    </span>
                    <span className="text-zinc-300">{isDe ? 'Menü' : 'Menu'}</span>
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-indigo-300 font-bold text-[10px]">
                      {isDe ? 'Mehrfach' : 'Multi'}
                    </span>
                    <span className="text-zinc-300">{isDe ? 'Multi-Wahl' : 'Multi-select'}</span>
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-emerald-300 font-bold text-[10px]">
                      {isDe ? 'Info' : 'Info'}
                    </span>
                    <span className="text-zinc-300">{isDe ? 'Details' : 'Details'}</span>
                  </span>
                </div>
              </div>
              <X className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            </div>
          )}

          {/* FLOATING HOVER CARD (Desktop Hover Preview) */}
          {!isDrawingPolygonArea && hoveredCallout && !selectedCallout && !isEditMode && (
            <div className="hidden md:block absolute bottom-16 left-3 z-30 max-w-sm rounded-xl border border-zinc-700 bg-zinc-950/95 p-3.5 shadow-2xl backdrop-blur-md text-zinc-100 pointer-events-none print:hidden">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-extrabold text-sm text-white">{hoveredCallout.name}</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${getZoneBadgeColor(
                      hoveredCallout.zone
                    )}`}
                  >
                    {hoveredCallout.zone.replace('_', ' ')}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      getDangerBadge(hoveredCallout.danger).classes
                    }`}
                  >
                    {getDangerBadge(hoveredCallout.danger).label}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-300 line-clamp-2">
                {isDe ? hoveredCallout.descriptionDe : hoveredCallout.descriptionEn}
              </p>
            </div>
          )}

          {/* PC-ONLY INTERACTIVE LIVE RADAR MINIMAP (hidden lg:block) */}
          {!isDrawingPolygonArea && (
            <TacticalMinimap
              lang={lang}
              activeImage={activeImage}
              showMinimap={showMinimap}
              onToggleShowMinimap={setShowMinimap}
              mapContainerEl={mapContainerRef.current}
              zoom={zoom}
              pan={pan}
              onSetPan={setPan}
              drawings={drawings}
              utilities={utilities}
              players={players}
              isLayerVisible={isLayerVisible}
            />
          )}

        </div>

        {/* MOBILE FLOATING BOTTOM BAR */}
        {!isDrawingPolygonArea && (
          <TacticalMobileBottomBar
            lang={lang}
            zoom={zoom}
            onZoomOut={handleZoomOut}
            onZoomIn={handleZoomIn}
            onZoomChange={handleZoomChange}
            onFitZoom={() => {
              setZoom(calculateFitZoom());
              setPan({ x: 0, y: 0 });
            }}
            showAreas={showAreas}
            onToggleAreas={() => setShowAreas((a) => !a)}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((g) => !g)}
            showCalloutLabels={showCalloutLabels}
            onToggleLabels={() => setShowCalloutLabels((p) => !p)}
            calloutScale={calloutScale}
            onChangeCalloutScale={setCalloutScale}
            hasSelectedCallout={Boolean(selectedCallout || selectedCalloutIds.length > 0)}
            onOpenCalloutInfo={() => {
              const target =
                selectedCallout ||
                (selectedCalloutIds.length > 0
                  ? mapData.callouts.find((c) => selectedCalloutIds.includes(c.id))
                  : null);
              if (target) setSelectedCallout(target);
              setMobileSheetTab('layers');
              setIsMobileSheetOpen(true);
            }}
            onOpenLayersSheet={() => {
              setMobileSheetTab('layers');
              setIsMobileSheetOpen(true);
            }}
          />
        )}

        {/* DESKTOP PINNED RIGHT INSPECTOR SIDEBAR (lg+ — kürzer durch volle untere Leiste, anfangs eingeblendet) */}
        {!isFullscreen && isRightPanelVisible && (
        <aside className="hidden lg:flex w-72 xl:w-80 border-l border-zinc-800 bg-zinc-950 shrink-0 overflow-hidden print:hidden z-30">
          <TacticalLayersPanel
            lang={lang}
            layers={layers}
            activeLayerId={activeLayerId}
            onSelectLayer={setActiveLayerId}
            onToggleLayerVisibility={(id) =>
              setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)))
            }
            onToggleLayerLock={(id) =>
              setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)))
            }
            onToggleLayerExpand={(id) =>
              setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, isExpanded: !l.isExpanded } : l)))
            }
            onAddLayer={(name, color) => {
              const nid = `layer_${Date.now()}`;
              setLayers((prev) => [
                ...prev,
                { id: nid, name, color, visible: true, locked: false, opacity: 1, isExpanded: true },
              ]);
              setActiveLayerId(nid);
              setHasChangesInSession(true);
            }}
            onDeleteLayer={(id) => {
              if (layers.length <= 1) return;
              setLayers((prev) => prev.filter((l) => l.id !== id));
              if (activeLayerId === id) {
                const fallback = layers.find((l) => l.id !== id);
                if (fallback) setActiveLayerId(fallback.id);
              }
              setHasChangesInSession(true);
            }}
            onUpdateLayerProps={(id, patch) => {
              if (patch.color !== undefined) {
                pushHistorySnapshot();
              }
              setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
              if (patch.color !== undefined) {
                setDrawings((prev) =>
                  prev.map((d) => (d.layerId === id ? { ...d, color: patch.color! } : d))
                );
              }
              setHasChangesInSession(true);
            }}
            drawings={drawings}
            utilities={utilities}
            players={players}
            selectedElementIds={selectedElementIds}
            onSelectElements={(ids) => {
              setSelectedCallout(null);
              setSelectedElementIds(ids);
            }}
            onUpdateSelectedElementsProps={handleUpdateSelectedElementsProps}
            onDeleteElement={(id) => {
              pushHistorySnapshot();
              setDrawings((prev) =>
                prev.filter((d) => !(d.id === id && !d.locked && !isLayerLocked(d.layerId)))
              );
              setUtilities((prev) =>
                prev.filter(
                  (u) => !(u.id === id && !u.locked && !isLayerLocked(u.layerId || 'layer_util'))
                )
              );
              setPlayers((prev) =>
                prev.filter(
                  (p) =>
                    !(
                      p.id === id &&
                      !p.locked &&
                      !isLayerLocked(p.layerId || (p.side === 'ct' ? 'layer_ct' : 'layer_t'))
                    )
                )
              );
              setSelectedElementIds((prev) => prev.filter((sid) => sid !== id));
              setHasChangesInSession(true);
            }}
            showAreas={showAreas}
            onToggleShowAreas={() => setShowAreas((p) => !p)}
            showCalloutLabels={showCalloutLabels}
            onToggleShowCalloutLabels={() => setShowCalloutLabels((p) => !p)}
            selectedCallout={selectedCallout}
            onCloseCallout={() => setSelectedCallout(null)}
            colorMode={colorMode}
            getZoneBadgeColor={getZoneBadgeColor}
            getDangerBadge={getDangerBadge}
            onCollapsePanel={() => setIsRightPanelVisible(false)}
          />
        </aside>
        )}

        {/* TABLET SLIDE-OVER RIGHT DRAWER (md to <lg — hidden in map fullscreen) */}
        {!isFullscreen && (isTabletLayersOpen || (Boolean(selectedCallout) && !isEditMode && !contextMenu)) && !isDrawingPolygonArea && (
          <div
            data-no-map-click="true"
            className="hidden md:flex lg:hidden fixed inset-y-0 right-0 z-50 print:hidden"
          >
            <div
              onClick={() => {
                setIsTabletLayersOpen(false);
                setSelectedCallout(null);
              }}
              className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            />
            <aside className="relative w-80 h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl z-10 flex flex-col">
              <TacticalLayersPanel
                lang={lang}
                layers={layers}
                activeLayerId={activeLayerId}
                onSelectLayer={setActiveLayerId}
                onToggleLayerVisibility={(id) =>
                  setLayers((prev) =>
                    prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
                  )
                }
                onToggleLayerLock={(id) =>
                  setLayers((prev) =>
                    prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
                  )
                }
                onToggleLayerExpand={(id) =>
                  setLayers((prev) =>
                    prev.map((l) => (l.id === id ? { ...l, isExpanded: !l.isExpanded } : l))
                  )
                }
                onAddLayer={(name, color) => {
                  const nid = `layer_${Date.now()}`;
                  setLayers((prev) => [
                    ...prev,
                    {
                      id: nid,
                      name,
                      color,
                      visible: true,
                      locked: false,
                      opacity: 1,
                      isExpanded: true,
                    },
                  ]);
                  setActiveLayerId(nid);
                  setHasChangesInSession(true);
                }}
                onDeleteLayer={(id) => {
                  if (layers.length <= 1) return;
                  setLayers((prev) => prev.filter((l) => l.id !== id));
                  if (activeLayerId === id) {
                    const fallback = layers.find((l) => l.id !== id);
                    if (fallback) setActiveLayerId(fallback.id);
                  }
                  setHasChangesInSession(true);
                }}
                onUpdateLayerProps={(id, patch) => {
                  if (patch.color !== undefined) {
                    pushHistorySnapshot();
                  }
                  setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
                  if (patch.color !== undefined) {
                    setDrawings((prev) =>
                      prev.map((d) => (d.layerId === id ? { ...d, color: patch.color! } : d))
                    );
                  }
                  setHasChangesInSession(true);
                }}
                drawings={drawings}
                utilities={utilities}
                players={players}
                selectedElementIds={selectedElementIds}
                onSelectElements={(ids) => {
                  setSelectedCallout(null);
                  setSelectedElementIds(ids);
                }}
                onUpdateSelectedElementsProps={handleUpdateSelectedElementsProps}
                onDeleteElement={(id) => {
                  pushHistorySnapshot();
                  setDrawings((prev) =>
                    prev.filter((d) => !(d.id === id && !d.locked && !isLayerLocked(d.layerId)))
                  );
                  setUtilities((prev) =>
                    prev.filter(
                      (u) => !(u.id === id && !u.locked && !isLayerLocked(u.layerId || 'layer_util'))
                    )
                  );
                  setPlayers((prev) =>
                    prev.filter(
                      (p) =>
                        !(
                          p.id === id &&
                          !p.locked &&
                          !isLayerLocked(p.layerId || (p.side === 'ct' ? 'layer_ct' : 'layer_t'))
                        )
                    )
                  );
                  setSelectedElementIds((prev) => prev.filter((sid) => sid !== id));
                  setHasChangesInSession(true);
                }}
                showAreas={showAreas}
                onToggleShowAreas={() => setShowAreas((p) => !p)}
                showCalloutLabels={showCalloutLabels}
                onToggleShowCalloutLabels={() => setShowCalloutLabels((p) => !p)}
                selectedCallout={selectedCallout}
                onCloseCallout={() => setSelectedCallout(null)}
                colorMode={colorMode}
                getZoneBadgeColor={getZoneBadgeColor}
                getDangerBadge={getDangerBadge}
                onCloseDrawer={() => {
                  setIsTabletLayersOpen(false);
                  setSelectedCallout(null);
                }}
              />
            </aside>
          </div>
        )}
      </div>

      {/* FULL-WIDTH DESKTOP & TABLET BOTTOM CONTROL BAR */}
      {!isDrawingPolygonArea && (
        <TacticalBottomBar
          lang={lang}
          showAreas={showAreas}
          onToggleAreas={() => setShowAreas((a) => !a)}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((g) => !g)}
          showCalloutLabels={showCalloutLabels}
          onToggleLabels={() => setShowCalloutLabels((p) => !p)}
          calloutScale={calloutScale}
          onChangeCalloutScale={setCalloutScale}
          zoom={zoom}
          onZoomOut={handleZoomOut}
          onZoomIn={handleZoomIn}
          onZoomChange={handleZoomChange}
          onFitView={() => {
            setZoom(calculateFitZoom());
            setPan({ x: 0, y: 0 });
            const defaultScale =
              typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 1.0;
            setCalloutScale(defaultScale);
          }}
          isHistoryExpanded={isHistoryExpanded}
          onToggleHistory={() => setIsHistoryExpanded((p) => !p)}
          snapshotCount={snapshots.length}
        />
      )}

      {/* DESKTOP & TABLET COLLAPSIBLE BOTTOM VERSION HISTORY BAR */}
      <TacticalHistoryPanel
        lang={lang}
        snapshots={snapshots}
        isExpanded={isHistoryExpanded}
        onToggleExpand={() => setIsHistoryExpanded((p) => !p)}
        onSaveSnapshot={handleSaveSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
        onDeleteSnapshot={handleDeleteSnapshot}
        onClearHistory={handleClearHistory}
        onOpenPngPreview={(snap) => {
          setPreviewSnapshot(snap);
          setIsTacticPreviewOpen(true);
        }}
        drawings={drawings}
        utilities={utilities}
        players={players}
        mapImage={activeImage}
      />

      {/* MOBILE BOTTOM SHEET DRAWER */}
      <TacticalMobileSheet
        isOpen={Boolean(isMobileSheetOpen && !isDrawingPolygonArea)}
        lang={lang}
        activeTab={mobileSheetTab}
        onChangeTab={setMobileSheetTab}
        onClose={() => {
          setIsMobileSheetOpen(false);
          setSelectedCallout(null);
        }}
        layers={layers}
        activeLayerId={activeLayerId}
        onSelectLayer={setActiveLayerId}
        onToggleLayerVisibility={(id) =>
          setLayers((prev) =>
            prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
          )
        }
        onToggleLayerLock={(id) =>
          setLayers((prev) =>
            prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))
          )
        }
        onToggleLayerExpand={(id) =>
          setLayers((prev) =>
            prev.map((l) => (l.id === id ? { ...l, isExpanded: !l.isExpanded } : l))
          )
        }
        onAddLayer={(name, color) => {
          const nid = `layer_${Date.now()}`;
          setLayers((prev) => [
            ...prev,
            {
              id: nid,
              name,
              color,
              visible: true,
              locked: false,
              opacity: 1,
              isExpanded: true,
            },
          ]);
          setActiveLayerId(nid);
          setHasChangesInSession(true);
        }}
        onDeleteLayer={(id) => {
          if (layers.length <= 1) return;
          setLayers((prev) => prev.filter((l) => l.id !== id));
          if (activeLayerId === id) {
            const fallback = layers.find((l) => l.id !== id);
            if (fallback) setActiveLayerId(fallback.id);
          }
          setHasChangesInSession(true);
        }}
        onUpdateLayerProps={(id, patch) => {
          if (patch.color !== undefined) {
            pushHistorySnapshot();
          }
          setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
          if (patch.color !== undefined) {
            setDrawings((prev) =>
              prev.map((d) => (d.layerId === id ? { ...d, color: patch.color! } : d))
            );
          }
          setHasChangesInSession(true);
        }}
        drawings={drawings}
        utilities={utilities}
        players={players}
        selectedElementIds={selectedElementIds}
        onSelectElements={(ids) => {
          setSelectedCallout(null);
          setSelectedElementIds(ids);
        }}
        onUpdateSelectedElementsProps={handleUpdateSelectedElementsProps}
        onDeleteElement={(id) => {
          pushHistorySnapshot();
          setDrawings((prev) =>
            prev.filter((d) => !(d.id === id && !d.locked && !isLayerLocked(d.layerId)))
          );
          setUtilities((prev) =>
            prev.filter(
              (u) => !(u.id === id && !u.locked && !isLayerLocked(u.layerId || 'layer_util'))
            )
          );
          setPlayers((prev) =>
            prev.filter(
              (p) =>
                !(
                  p.id === id &&
                  !p.locked &&
                  !isLayerLocked(p.layerId || (p.side === 'ct' ? 'layer_ct' : 'layer_t'))
                )
            )
          );
          setSelectedElementIds((prev) => prev.filter((sid) => sid !== id));
          setHasChangesInSession(true);
        }}
        showAreas={showAreas}
        onToggleShowAreas={() => setShowAreas((p) => !p)}
        showCalloutLabels={showCalloutLabels}
        onToggleShowCalloutLabels={() => setShowCalloutLabels((p) => !p)}
        selectedCallout={selectedCallout}
        onCloseCallout={() => setSelectedCallout(null)}
        colorMode={colorMode}
        getZoneBadgeColor={getZoneBadgeColor}
        getDangerBadge={getDangerBadge}
        snapshots={snapshots}
        onSaveSnapshot={handleSaveSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
        onDeleteSnapshot={handleDeleteSnapshot}
        onClearHistory={handleClearHistory}
        onOpenPngPreview={(snap) => {
          setIsMobileSheetOpen(false);
          setPreviewSnapshot(snap);
          setIsTacticPreviewOpen(true);
        }}
        activeImage={activeImage}
      />

      {/* 5. KURZHILFE & FARBLEGENDE MODAL */}
      <TacticalLegendModal
        isOpen={showLegend}
        onClose={() => setShowLegend(false)}
        lang={lang}
        colorMode={colorMode}
      />

      {/* 6. ADD / EDIT CALLOUT MODAL */}
      <CalloutEditorModal
        isOpen={isAddingCallout}
        lang={lang}
        hasLowerMap={Boolean(mapData.lowerImage)}
        editingCallout={editingCallout}
        pendingCalloutCoords={pendingCalloutCoords}
        calloutFormName={calloutFormName}
        onChangeName={setCalloutFormName}
        calloutFormLevel={calloutFormLevel}
        onChangeLevel={setCalloutFormLevel}
        calloutFormZone={calloutFormZone}
        onChangeZone={setCalloutFormZone}
        calloutFormDanger={calloutFormDanger}
        onChangeDanger={setCalloutFormDanger}
        calloutFormTextRotation={calloutFormTextRotation}
        onChangeTextRotation={setCalloutFormTextRotation}
        calloutFormFontSize={calloutFormFontSize}
        onChangeFontSize={setCalloutFormFontSize}
        calloutFormFontFamily={calloutFormFontFamily}
        onChangeFontFamily={setCalloutFormFontFamily}
        calloutFormDisplayMode={calloutFormDisplayMode}
        onChangeDisplayMode={setCalloutFormDisplayMode}
        calloutFormCustomImage={calloutFormCustomImage}
        onChangeCustomImage={setCalloutFormCustomImage}
        calloutFormImageSize={calloutFormImageSize}
        onChangeImageSize={setCalloutFormImageSize}
        calloutFormHidePin={calloutFormHidePin}
        onChangeHidePin={setCalloutFormHidePin}
        calloutFormPinOffsetX={calloutFormPinOffsetX}
        onChangePinOffsetX={setCalloutFormPinOffsetX}
        calloutFormPinOffsetY={calloutFormPinOffsetY}
        onChangePinOffsetY={setCalloutFormPinOffsetY}
        calloutFormHasArea={calloutFormHasArea}
        onChangeHasArea={setCalloutFormHasArea}
        calloutFormAreaShape={calloutFormAreaShape}
        onChangeAreaShape={setCalloutFormAreaShape}
        calloutFormAreaPoints={calloutFormAreaPoints}
        onChangeAreaPoints={setCalloutFormAreaPoints}
        onChangeAreaX={setCalloutFormAreaX}
        onChangeAreaY={setCalloutFormAreaY}
        calloutFormAreaWidth={calloutFormAreaWidth}
        onChangeAreaWidth={setCalloutFormAreaWidth}
        calloutFormAreaHeight={calloutFormAreaHeight}
        onChangeAreaHeight={setCalloutFormAreaHeight}
        calloutFormDescDe={calloutFormDescDe}
        onChangeDescDe={setCalloutFormDescDe}
        calloutFormTipDe={calloutFormTipDe}
        onChangeTipDe={setCalloutFormTipDe}
        onStartPolygonDrawing={() => {
          setCalloutFormHasArea(true);
          setCalloutFormAreaShape('polygon');
          setIsAddingCallout(false);
          setIsDrawingPolygonArea(true);
        }}
        onDeleteCallout={handleDeleteCallout}
        onSave={handleSaveCalloutForm}
        onClose={() => {
          setIsAddingCallout(false);
          setEditingCallout(null);
          setPendingCalloutCoords(null);
        }}
      />

      {/* SYNC CHANGES CONFIRMATION MODAL */}
      <SyncPromptModal
        isOpen={showSyncPrompt}
        lang={lang}
        currentUser={currentUser}
        isSyncing={isSyncing}
        onSetIsSyncing={setIsSyncing}
        onConfirmSync={handleConfirmSync}
        onDiscardAndExit={handleDiscardAndExit}
        onClose={() => setShowSyncPrompt(false)}
      />

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
          drawings: drawings.filter((d) => isLayerVisible(d.layerId, 'layer_t')),
          utilities: utilities.filter((u) => isLayerVisible(u.layerId, 'layer_util')),
          players: players.filter((p) =>
            isLayerVisible(p.layerId, p.side === 'ct' ? 'layer_ct' : 'layer_t')
          ),
        }}
        onSaveAsMyTactic={(title) => {
          if (onSaveAsMyTactic) {
            (onSaveAsMyTactic as (
              baseMap: MapData,
              tacticTitle: string,
              tacticState: {
                drawings: TacticalDrawingLine[];
                utilities: UtilityMarker[];
                players: PlayerToken[];
                layers?: TacticLayer[];
              }
            ) => void)(mapData, title, {
              drawings,
              utilities,
              players,
              layers,
            });
          }
        }}
        onLoadTacticState={(loadedState) => {
          pushHistorySnapshot();
          setDrawings(loadedState.drawings || []);
          setUtilities(loadedState.utilities || []);
          setPlayers(loadedState.players || []);
          const stateWithLayers = loadedState as { layers?: TacticLayer[] };
          if (stateWithLayers.layers && stateWithLayers.layers.length > 0) {
            setLayers(stateWithLayers.layers);
          }
          setSelectedElementIds([]);
          setSelectedCalloutIds([]);
          setHasChangesInSession(true);
        }}
        lang={lang}
      />

      {/* TACTIC PRESETS LIBRARY MODAL (per map, persistent + cloud synced) */}
      <TacticPresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        lang={lang}
        mapData={mapData}
        activeImage={activeImage}
        presets={tacticPresets}
        currentDrawings={drawings}
        currentUtilities={utilities}
        currentPlayers={players}
        currentLayers={layers}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
        onRenamePreset={handleRenamePreset}
        onOverwritePreset={handleOverwritePreset}
        onDeletePreset={handleDeletePreset}
        onOpenPngPreview={(preset) => {
          setIsPresetsModalOpen(false);
          setPreviewSnapshot({
            id: preset.id,
            timestamp: preset.updatedAt,
            label: preset.name,
            changedCount:
              (preset.drawings?.length || 0) +
              (preset.utilities?.length || 0) +
              (preset.players?.length || 0),
            callouts: mapData.callouts,
            drawings: preset.drawings,
            utilities: preset.utilities,
            players: preset.players,
          });
          setIsTacticPreviewOpen(true);
        }}
      />

      {/* EDIT MODE OPTIONS SELECTION MODAL */}
      <EditOptionsModal
        isOpen={isEditOptionsModalOpen}
        onClose={() => setIsEditOptionsModalOpen(false)}
        lang={lang}
        callouts={mapData.callouts}
        singleEditCalloutId={singleEditCalloutId}
        singleEditSearchQuery={singleEditSearchQuery}
        onChangeSearchQuery={setSingleEditSearchQuery}
        customSelectedCount={customSelectedCalloutIds.length}
        getZoneBadgeColor={getZoneBadgeColor}
        onEnableGlobalEdit={() => {
          setSingleEditCalloutId(null);
          setSelectedCallout(null);
          setSelectedCalloutIds([]);
          setHighlightedCalloutId(undefined);
          setContextMenu(null);
          setIsEditMode(true);
          setIsEditOptionsModalOpen(false);
        }}
        onEnableSingleEdit={(calloutId) => {
          setSingleEditCalloutId(calloutId);
          setIsEditMode(true);
          setIsEditOptionsModalOpen(false);
        }}
        onOpenNewCallout={() => {
          setIsEditOptionsModalOpen(false);
          handleOpenAddNewCalloutModal();
        }}
        onOpenCustomSelection={handleOpenCustomSelectionModal}
      />

      {/* MEINE CALLOUT AUSWAHL MODAL */}
      <CustomSelectionModal
        isOpen={isCustomSelectionModalOpen}
        onClose={() => setIsCustomSelectionModalOpen(false)}
        lang={lang}
        callouts={mapData.callouts}
        tempSelectedCalloutIds={tempSelectedCalloutIds}
        onChangeTempSelectedIds={setTempSelectedCalloutIds}
        customSelectionTab={customSelectionTab}
        onChangeTab={setCustomSelectionTab}
        customSelectionSearch={customSelectionSearch}
        onChangeSearch={setCustomSelectionSearch}
        getZoneBadgeColor={getZoneBadgeColor}
        onApply={(ids) => handleSaveCustomSelection(ids, true)}
      />

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

      {/* Help & App Explanations Modal */}
      <HelpDocsModal
        isOpen={isHelpDocsOpen}
        onClose={() => setIsHelpDocsOpen(false)}
        lang={lang}
      />

      {/* Custom Color Selection Modal */}
      <CustomColorModal
        isOpen={isCustomColorModalOpen}
        onClose={() => setIsCustomColorModalOpen(false)}
        currentColor={penColor}
        onSelectColor={(c) => {
          if (customColorTarget === 'selection') {
            handleUpdateSelectedElementsProps({ color: c });
          } else {
            setPenColor(c);
          }
        }}
        lang={lang}
      />

      {/* Tactical Sheet PNG Preview Modal (opened from Map History) */}
      <TacticPreviewModal
        isOpen={isTacticPreviewOpen}
        onClose={() => {
          setIsTacticPreviewOpen(false);
          setPreviewSnapshot(null);
        }}
        mapData={
          previewSnapshot
            ? { ...mapData, callouts: previewSnapshot.callouts || mapData.callouts }
            : mapData
        }
        tacticState={{
          drawings: previewSnapshot ? (previewSnapshot.drawings ?? []) : drawings,
          utilities: previewSnapshot ? (previewSnapshot.utilities ?? []) : utilities,
          players: previewSnapshot ? (previewSnapshot.players ?? []) : players,
        }}
        tacticTitle={
          previewSnapshot
            ? `${mapData.name} — ${previewSnapshot.label}`
            : `${mapData.name} — ${isDe ? 'Aktuelle Taktik' : 'Current Tactic'}`
        }
        lang={lang}
      />
    </div>
  );
};
