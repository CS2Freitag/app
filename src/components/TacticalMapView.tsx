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
  Plus,
  ListFilter,
  Volume2,
  Layers,
  Lock,
  Unlock,
  Copy,
  Grid3X3,
  Users,
  CheckCircle2,
  History,
  MousePointer2,
  BoxSelect,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Map as MapIcon,
} from 'lucide-react';
import { UtilitySymbol, UTILITY_META } from './UtilitySymbol';
import { TacticalLayersPanel } from './TacticalLayersPanel';
import { TacticalHistoryPanel } from './TacticalHistoryPanel';
import { HelpDocsModal } from './HelpDocsModal';
import { CustomColorModal } from './CustomColorModal';
import { TacticPreviewModal } from './TacticPreviewModal';
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
  TacticalTool,
  TacticLayer,
  TacticSnapshot
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
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [selectedCalloutIds, setSelectedCalloutIds] = useState<string[]>([]);
  const [isToolbarVisible, setIsToolbarVisible] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
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
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingMinimap, setIsDraggingMinimap] = useState<boolean>(false);

  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showContextColorPicker, setShowContextColorPicker] = useState<boolean>(false);
  const [isTabletLayersOpen, setIsTabletLayersOpen] = useState<boolean>(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const [mobileSheetTab, setMobileSheetTab] = useState<'layers' | 'history'>('layers');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false);

  // Map Version History Snapshots (max 5 saved versions per map in localStorage — callouts, areas, drawings, utilities & players)
  const [snapshots, setSnapshots] = useState<TacticSnapshot[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`cs2_map_history_${mapData.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const valid = parsed
            .filter((s) => s && Array.isArray(s.callouts))
            .map((s) => ({
              ...s,
              drawings:
                Array.isArray(s.drawings) && s.drawings.length > 0
                  ? s.drawings
                  : mapData.tacticData?.drawings || [],
              utilities:
                Array.isArray(s.utilities) && s.utilities.length > 0
                  ? s.utilities
                  : mapData.tacticData?.utilities || [],
              players:
                Array.isArray(s.players) && s.players.length > 0
                  ? s.players
                  : mapData.tacticData?.players || [],
            }))
            .slice(0, 5);
          if (valid.length > 0) return valid;
        }
      }
    } catch {
      // ignore
    }
    return [
      {
        id: `map_snap_init_${Date.now()}`,
        timestamp: Date.now(),
        label: isDe ? 'Ausgangsversion' : 'Initial map',
        changedCount: mapData.callouts.length,
        callouts: JSON.parse(JSON.stringify(mapData.callouts)),
        drawings: JSON.parse(JSON.stringify(mapData.tacticData?.drawings || [])),
        utilities: JSON.parse(JSON.stringify(mapData.tacticData?.utilities || [])),
        players: JSON.parse(JSON.stringify(mapData.tacticData?.players || [])),
      },
    ];
  });

  // Sync map history updates cleanly (keeps max 5 versions in localStorage)
  useEffect(() => {
    try {
      localStorage.setItem(`cs2_map_history_${mapData.id}`, JSON.stringify(snapshots.slice(0, 5)));
    } catch {
      // ignore
    }
  }, [snapshots, mapData.id]);

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
  const [calloutFormHidePin, setCalloutFormHidePin] = useState<boolean>(true);
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

  const calculateFitZoom = (overrideFs?: boolean) => {
    const fs = overrideFs !== undefined ? overrideFs : isFullscreen;
    if (!mainWrapperRef.current) {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        return currentLevel === 'both' ? 0.5 : 0.95;
      }
      return 0.78;
    }
    const parentRect = mainWrapperRef.current.getBoundingClientRect();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const leftDeduction = fs || isMobile ? 0 : isToolbarVisible ? 224 : 0;
    const rightDeduction = fs || isMobile ? 0 : isDesktop ? 304 : 0;
    const topHeaderDeduction = fs ? 64 : isMobile ? (isToolbarVisible ? 116 : 64) : 80;
    const availW = Math.max(260, parentRect.width - (leftDeduction + rightDeduction));
    const availH = Math.max(260, parentRect.height - topHeaderDeduction);

    if (currentLevel === 'both') {
      const scaleW = availW / 1750;
      const scaleH = availH / 850;
      return Math.max(0.5, Math.min(2.5, Math.min(scaleW, scaleH) * (fs ? 0.96 : 0.92)));
    }
    const baseTileSize = Math.min(850, availW);
    const availableSize = Math.min(availW, availH);
    return Math.max(
      0.5,
      Math.min(2.5, (availableSize / Math.max(260, baseTileSize)) * (fs ? 0.95 : 0.92))
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

  // Layer, Selection & History Helpers
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

  const handleSaveSnapshot = useCallback(
    (customLabel?: string, overrideCallouts?: Callout[]) => {
      const targetCallouts = overrideCallouts || mapData.callouts;
      const serialized = JSON.stringify(targetCallouts);
      const serializedDrawings = JSON.stringify(drawings);
      const serializedUtilities = JSON.stringify(utilities);
      const serializedPlayers = JSON.stringify(players);
      setSnapshots((prev) => {
        if (
          prev.length > 0 &&
          JSON.stringify(prev[0].callouts) === serialized &&
          JSON.stringify(prev[0].drawings ?? []) === serializedDrawings &&
          JSON.stringify(prev[0].utilities ?? []) === serializedUtilities &&
          JSON.stringify(prev[0].players ?? []) === serializedPlayers
        ) {
          return prev;
        }
        const areaCount = targetCallouts.filter((c) => Boolean(c.area)).length;
        const newSnap: TacticSnapshot = {
          id: `map_snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          label:
            customLabel ||
            `${mapData.name} ${isDe ? 'gesichert' : 'saved'} (${targetCallouts.length} / ${areaCount})`,
          changedCount: targetCallouts.length,
          callouts: JSON.parse(serialized),
          drawings: JSON.parse(serializedDrawings),
          utilities: JSON.parse(serializedUtilities),
          players: JSON.parse(serializedPlayers),
        };
        return [newSnap, ...prev].slice(0, 5);
      });
    },
    [mapData.callouts, mapData.name, isDe, drawings, utilities, players]
  );

  const handleRestoreSnapshot = useCallback(
    (snap: TacticSnapshot) => {
      const currentSerialized = JSON.stringify(mapData.callouts);
      const targetSerialized = JSON.stringify(snap.callouts || []);
      const currentDrawingsStr = JSON.stringify(drawings);
      const currentUtilsStr = JSON.stringify(utilities);
      const currentPlayersStr = JSON.stringify(players);
      if (
        currentSerialized !== targetSerialized ||
        (snap.drawings && currentDrawingsStr !== JSON.stringify(snap.drawings)) ||
        (snap.utilities && currentUtilsStr !== JSON.stringify(snap.utilities)) ||
        (snap.players && currentPlayersStr !== JSON.stringify(snap.players))
      ) {
        const safetyBackup: TacticSnapshot = {
          id: `map_snap_pre_restore_${Date.now()}`,
          timestamp: Date.now(),
          label: isDe ? 'Sicherung vor Wiederherstellung' : 'Backup before restore',
          changedCount: mapData.callouts.length,
          callouts: JSON.parse(currentSerialized),
          drawings: JSON.parse(currentDrawingsStr),
          utilities: JSON.parse(currentUtilsStr),
          players: JSON.parse(currentPlayersStr),
        };
        setSnapshots((prev) => [safetyBackup, ...prev].slice(0, 5));
      }

      const restoredCallouts: Callout[] = JSON.parse(targetSerialized);
      const nextDrawings = snap.drawings ? JSON.parse(JSON.stringify(snap.drawings)) : drawings;
      const nextUtilities = snap.utilities ? JSON.parse(JSON.stringify(snap.utilities)) : utilities;
      const nextPlayers = snap.players ? JSON.parse(JSON.stringify(snap.players)) : players;

      if (snap.drawings) setDrawings(nextDrawings);
      if (snap.utilities) setUtilities(nextUtilities);
      if (snap.players) setPlayers(nextPlayers);

      onUpdateMap(
        {
          ...mapData,
          callouts: restoredCallouts,
          tacticData: {
            ...(mapData.tacticData || {}),
            drawings: nextDrawings,
            utilities: nextUtilities,
            players: nextPlayers,
            layers,
          },
          updatedAt: Date.now(),
        },
        true
      );
      setSelectedCallout(null);
      setSelectedCalloutIds([]);
      setHighlightedCalloutId(undefined);
      setHasChangesInSession(true);
    },
    [mapData, onUpdateMap, isDe, drawings, utilities, players, layers]
  );

  const handleSelectElement = useCallback(
    (elementId: string, multiKey = false) => {
      setSelectedCallout(null);
      const foundGroup =
        drawings.find((d) => d.id === elementId)?.groupId ||
        utilities.find((u) => u.id === elementId)?.groupId ||
        players.find((p) => p.id === elementId)?.groupId;

      const groupElementIds = foundGroup
        ? [
            ...drawings.filter((d) => d.groupId === foundGroup).map((d) => d.id),
            ...utilities.filter((u) => u.groupId === foundGroup).map((u) => u.id),
            ...players.filter((p) => p.groupId === foundGroup).map((p) => p.id),
          ]
        : [elementId];
      const groupCalloutPeers = foundGroup
        ? mapData.callouts.filter((c) => c.groupId === foundGroup).map((c) => c.id)
        : [];

      if (!multiKey) {
        setSelectedCalloutIds(groupCalloutPeers);
      } else if (groupCalloutPeers.length > 0) {
        setSelectedCalloutIds((prev) => Array.from(new Set([...prev, ...groupCalloutPeers])));
      }

      setSelectedElementIds((prev) => {
        if (multiKey) {
          const allAlready = groupElementIds.every((id) => prev.includes(id));
          if (allAlready) {
            return prev.filter((id) => !groupElementIds.includes(id));
          }
          return Array.from(new Set([...prev, ...groupElementIds]));
        }
        return groupElementIds;
      });
    },
    [drawings, utilities, players, mapData.callouts]
  );

  const handleSelectCalloutMulti = useCallback(
    (callout: Callout, multiKey = false, openInspector = true) => {
      const groupCalloutIds = callout.groupId
        ? mapData.callouts.filter((c) => c.groupId === callout.groupId).map((c) => c.id)
        : [callout.id];
      const groupElIds = callout.groupId
        ? [
            ...drawings.filter((d) => d.groupId === callout.groupId).map((d) => d.id),
            ...utilities.filter((u) => u.groupId === callout.groupId).map((u) => u.id),
            ...players.filter((p) => p.groupId === callout.groupId).map((p) => p.id),
          ]
        : [];

      if (multiKey) {
        setSelectedCalloutIds((prev) => {
          const allSelected = groupCalloutIds.every((id) => prev.includes(id));
          const next = allSelected
            ? prev.filter((id) => !groupCalloutIds.includes(id))
            : Array.from(new Set([...prev, ...groupCalloutIds]));
          if (next.length === 1 && openInspector) {
            const single = mapData.callouts.find((c) => c.id === next[0]) || null;
            setSelectedCallout(single);
            setHighlightedCalloutId(single?.id);
          } else {
            setSelectedCallout(null);
            setHighlightedCalloutId(next.length === 1 ? next[0] : undefined);
          }
          return next;
        });
        if (groupElIds.length > 0) {
          setSelectedElementIds((prev) => Array.from(new Set([...prev, ...groupElIds])));
        }
      } else {
        setSelectedCalloutIds(groupCalloutIds);
        setSelectedElementIds(groupElIds);
        if (openInspector && groupCalloutIds.length <= 1 && groupElIds.length === 0) {
          setSelectedCallout(callout);
          setHighlightedCalloutId(callout.id);
        } else {
          setSelectedCallout(null);
          setHighlightedCalloutId(callout.id);
        }
      }
    },
    [mapData.callouts, drawings, utilities, players]
  );

  const handleDuplicateSelected = useCallback(() => {
    const hasElements = selectedElementIds.length > 0;
    const hasCallouts = selectedCalloutIds.length > 0;
    if (!hasElements && !hasCallouts) return;

    const offset = 2.8;
    const newElIds: string[] = [];

    if (hasElements) {
      const clonedDrawings: TacticalDrawingLine[] = drawings
        .filter((d) => selectedElementIds.includes(d.id))
        .map((d, i) => {
          const nid = `draw_dup_${Date.now()}_${i}`;
          newElIds.push(nid);
          return {
            ...d,
            id: nid,
            groupId: undefined,
            locked: false,
            points: d.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
          };
        });

      const clonedUtilities: UtilityMarker[] = utilities
        .filter((u) => selectedElementIds.includes(u.id))
        .map((u, i) => {
          const nid = `util_dup_${Date.now()}_${i}`;
          newElIds.push(nid);
          return {
            ...u,
            id: nid,
            groupId: undefined,
            locked: false,
            x: u.x + offset,
            y: u.y + offset,
          };
        });

      const clonedPlayers: PlayerToken[] = players
        .filter((p) => selectedElementIds.includes(p.id))
        .map((p, i) => {
          const nid = `player_dup_${Date.now()}_${i}`;
          newElIds.push(nid);
          return {
            ...p,
            id: nid,
            groupId: undefined,
            locked: false,
            x: p.x + offset,
            y: p.y + offset,
          };
        });

      if (clonedDrawings.length > 0) setDrawings((prev) => [...prev, ...clonedDrawings]);
      if (clonedUtilities.length > 0) setUtilities((prev) => [...prev, ...clonedUtilities]);
      if (clonedPlayers.length > 0) setPlayers((prev) => [...prev, ...clonedPlayers]);
      setSelectedElementIds(newElIds);
    }

    if (hasCallouts) {
      const newCalloutIds: string[] = [];
      const clonedCallouts: Callout[] = mapData.callouts
        .filter((c) => selectedCalloutIds.includes(c.id))
        .map((c, i) => {
          const cid = `custom_dup_${Date.now()}_${i}`;
          newCalloutIds.push(cid);
          return {
            ...c,
            id: cid,
            name: `${c.name} (${isDe ? 'Kopie' : 'Copy'})`,
            x: Math.round(Math.min(48, c.x + offset) * 10) / 10,
            y: Math.round(Math.min(48, c.y + offset) * 10) / 10,
            groupId: undefined,
            locked: false,
            isCustom: true,
            area: c.area
              ? {
                  ...c.area,
                  x: Math.round((c.area.x + offset) * 10) / 10,
                  y: Math.round((c.area.y + offset) * 10) / 10,
                  points: c.area.points
                    ? c.area.points.map((pt) => ({
                        x: Math.round((pt.x + offset) * 10) / 10,
                        y: Math.round((pt.y + offset) * 10) / 10,
                      }))
                    : undefined,
                }
              : undefined,
          };
        });
      if (clonedCallouts.length > 0) {
        onUpdateMap({ ...mapData, callouts: [...mapData.callouts, ...clonedCallouts] }, true);
        setSelectedCalloutIds(newCalloutIds);
      }
    }

    setContextMenu(null);
    setHasChangesInSession(true);
  }, [selectedElementIds, selectedCalloutIds, drawings, utilities, players, mapData, onUpdateMap, isDe]);

  const handleGroupSelected = useCallback(() => {
    const totalCount = selectedElementIds.length + selectedCalloutIds.length;
    if (totalCount < 2) return;

    const selectedGroups = new Set([
      ...drawings.filter((d) => selectedElementIds.includes(d.id)).map((d) => d.groupId),
      ...utilities.filter((u) => selectedElementIds.includes(u.id)).map((u) => u.groupId),
      ...players.filter((p) => selectedElementIds.includes(p.id)).map((p) => p.groupId),
      ...mapData.callouts.filter((c) => selectedCalloutIds.includes(c.id)).map((c) => c.groupId),
    ]);
    const shouldUngroup = selectedGroups.size === 1 && !selectedGroups.has(undefined);
    const nextGroupId = shouldUngroup ? undefined : `grp_${Date.now()}`;

    if (selectedElementIds.length > 0) {
      setDrawings((prev) =>
        prev.map((d) => (selectedElementIds.includes(d.id) ? { ...d, groupId: nextGroupId } : d))
      );
      setUtilities((prev) =>
        prev.map((u) => (selectedElementIds.includes(u.id) ? { ...u, groupId: nextGroupId } : u))
      );
      setPlayers((prev) =>
        prev.map((p) => (selectedElementIds.includes(p.id) ? { ...p, groupId: nextGroupId } : p))
      );
    }

    if (selectedCalloutIds.length > 0) {
      const updatedCallouts = mapData.callouts.map((c) =>
        selectedCalloutIds.includes(c.id) ? { ...c, groupId: nextGroupId } : c
      );
      onUpdateMap({ ...mapData, callouts: updatedCallouts }, true);
    }

    setContextMenu(null);
    setHasChangesInSession(true);
  }, [selectedElementIds, selectedCalloutIds, drawings, utilities, players, mapData, onUpdateMap]);

  const handleToggleLockSelected = useCallback(() => {
    if (selectedElementIds.length === 0 && selectedCalloutIds.length === 0) return;

    const anyUnlocked =
      drawings.some((d) => selectedElementIds.includes(d.id) && !d.locked) ||
      utilities.some((u) => selectedElementIds.includes(u.id) && !u.locked) ||
      players.some((p) => selectedElementIds.includes(p.id) && !p.locked) ||
      mapData.callouts.some((c) => selectedCalloutIds.includes(c.id) && !c.locked);
    const nextLock = anyUnlocked;

    if (selectedElementIds.length > 0) {
      setDrawings((prev) =>
        prev.map((d) => (selectedElementIds.includes(d.id) ? { ...d, locked: nextLock } : d))
      );
      setUtilities((prev) =>
        prev.map((u) => (selectedElementIds.includes(u.id) ? { ...u, locked: nextLock } : u))
      );
      setPlayers((prev) =>
        prev.map((p) => (selectedElementIds.includes(p.id) ? { ...p, locked: nextLock } : p))
      );
    }

    if (selectedCalloutIds.length > 0) {
      const updatedCallouts = mapData.callouts.map((c) =>
        selectedCalloutIds.includes(c.id) ? { ...c, locked: nextLock } : c
      );
      onUpdateMap({ ...mapData, callouts: updatedCallouts }, true);
    }

    setContextMenu(null);
    setHasChangesInSession(true);
  }, [selectedElementIds, selectedCalloutIds, drawings, utilities, players, mapData, onUpdateMap]);

  const handleDeleteSelectedElements = useCallback(() => {
    if (selectedElementIds.length === 0 && selectedCalloutIds.length === 0) return;

    if (selectedElementIds.length > 0) {
      setDrawings((prev) =>
        prev.filter((d) => !(selectedElementIds.includes(d.id) && !d.locked && !isLayerLocked(d.layerId)))
      );
      setUtilities((prev) =>
        prev.filter((u) => !(selectedElementIds.includes(u.id) && !u.locked && !isLayerLocked(u.layerId || 'layer_util')))
      );
      setPlayers((prev) =>
        prev.filter(
          (p) =>
            !(
              selectedElementIds.includes(p.id) &&
              !p.locked &&
              !isLayerLocked(p.layerId || (p.side === 'ct' ? 'layer_ct' : 'layer_t'))
            )
        )
      );
      setSelectedElementIds([]);
    }

    if (selectedCalloutIds.length > 0) {
      const remainingCallouts = mapData.callouts.filter(
        (c) => !(selectedCalloutIds.includes(c.id) && !c.locked)
      );
      onUpdateMap({ ...mapData, callouts: remainingCallouts }, true);
      setSelectedCalloutIds([]);
      setSelectedCallout(null);
      setHighlightedCalloutId(undefined);
    }

    setContextMenu(null);
    setShowContextColorPicker(false);
    setShowContextColorSubmenu(false);
    setHasChangesInSession(true);
  }, [selectedElementIds, selectedCalloutIds, isLayerLocked, mapData, onUpdateMap]);

  const handleUpdateSelectedElementsProps = useCallback(
    (patch: { color?: string; opacity?: number; locked?: boolean }) => {
      if (selectedElementIds.length === 0 && selectedCalloutIds.length === 0) return;

      if (selectedElementIds.length > 0) {
        setDrawings((prev) =>
          prev.map((d) =>
            selectedElementIds.includes(d.id)
              ? {
                  ...d,
                  ...(patch.color !== undefined ? { color: patch.color } : {}),
                  ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
                  ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
                }
              : d
          )
        );
        setUtilities((prev) =>
          prev.map((u) =>
            selectedElementIds.includes(u.id)
              ? {
                  ...u,
                  ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
                  ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
                }
              : u
          )
        );
        setPlayers((prev) =>
          prev.map((p) =>
            selectedElementIds.includes(p.id)
              ? {
                  ...p,
                  ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
                  ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
                }
              : p
          )
        );
      }

      if (selectedCalloutIds.length > 0 && patch.color !== undefined) {
        const updatedCallouts = mapData.callouts.map((c) => {
          if (!selectedCalloutIds.includes(c.id)) return c;
          if (c.area) {
            return { ...c, area: { ...c.area, customColor: patch.color } };
          }
          const w = 10;
          const h = 10;
          return {
            ...c,
            area: {
              x: Math.max(-50, Math.min(50 - w, Math.round((c.x - w / 2) * 10) / 10)),
              y: Math.max(-50, Math.min(50 - h, Math.round((c.y - h / 2) * 10) / 10)),
              width: w,
              height: h,
              shape: 'rect' as const,
              customColor: patch.color,
            },
          };
        });
        onUpdateMap({ ...mapData, callouts: updatedCallouts }, true);
      }

      setHasChangesInSession(true);
    },
    [selectedElementIds, selectedCalloutIds, mapData, onUpdateMap]
  );

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
        if (isFullscreen && !document.fullscreenElement) {
          setIsFullscreen(false);
        }
        return;
      }

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
  }, [drawings, drawingsRedoStack, selectedElementIds, selectedCalloutIds, handleDuplicateSelected, handleDeleteSelectedElements, isFullscreen]);

  // Fullscreen listener — synchronizes browser fullscreen & re-fits map on viewport resize
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      requestAnimationFrame(() => {
        setZoom(calculateFitZoom(isFs));
        setPan({ x: 0, y: 0 });
      });
    };
    const handleResize = () => {
      setZoom(calculateFitZoom());
      setPan({ x: 0, y: 0 });
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('resize', handleResize);
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

    // Utility placement tool
    if (activeTool === 'utility') {
      const targetLayerId = activeLayerId || 'layer_util';
      if (isLayerLocked(targetLayerId)) return;
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

    // Select tool: clicking background clears inspector, callouts, elements & context menu
    if (activeTool === 'select') {
      setSelectedCallout(null);
      setHighlightedCalloutId(undefined);
      setSelectedElementIds([]);
      setSelectedCalloutIds([]);
      setContextMenu(null);
      setShowContextColorSubmenu(false);
      setShowContextColorPicker(false);
    }
  };

  // Mouse & Dragging handling
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingCalloutId || draggingAreaCalloutId || resizingAreaCalloutId) return;
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
      marqueeAdditiveRef.current = e.ctrlKey || e.metaKey || e.shiftKey;
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
    // 0. Panning takes TOP PRIORITY whenever user is panning
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

    // 0b. Marquee Selection Box resize while dragging
    if (marqueeRect) {
      const coords = getCoordinatesFromEvent(e);
      setMarqueeRect((prev) => (prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null));
      return;
    }

    if (isDrawingPolygonArea) {
      const coords = getCoordinatesFromEvent(e);
      setPolygonHoverCoord(coords);
      return;
    }

    // 1. Eraser Tool Brush Scrubbing (Real-time erase when dragging, respecting locks)
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
            .filter(
              (u) =>
                isLayerVisible(u.layerId, 'layer_util') &&
                u.x >= minX &&
                u.x <= maxX &&
                u.y >= minY &&
                u.y <= maxY
            )
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
        setDrawings((prev) => [...prev, currentDrawing]);
        setDrawingsRedoStack([]); // reset redo stack on new stroke
        setHasChangesInSession(true);
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
      if ((activeTool === 'pen' || activeTool === 'arrow' || activeTool === 'eraser' || activeTool === 'marquee') && e.cancelable) {
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
      const newZoom = Math.max(0.5, Math.min(2.5, initialPinchZoomRef.current * factor));
      setZoom(Math.round(newZoom * 100) / 100);
    } else if (e.touches.length === 1) {
      if ((activeTool === 'pen' || activeTool === 'arrow' || activeTool === 'eraser' || activeTool === 'marquee' || currentDrawing || marqueeRect) && e.cancelable) {
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
    if (target.locked || isLayerLocked(target.layerId)) return;
    setDrawings((prev) => prev.filter((d) => d.id !== lineId));
    setDrawingsRedoStack((prev) => [...prev, target]);
    setSelectedElementIds((prev) => prev.filter((id) => id !== lineId));
    setHasChangesInSession(true);
  };

  const handleClearTactics = () => {
    setDrawings((prev) => prev.filter((d) => d.locked || isLayerLocked(d.layerId)));
    setDrawingsRedoStack([]);
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
    const isMulti = 'ctrlKey' in e && (e.ctrlKey || e.metaKey || e.shiftKey);
    if (!isMulti && !selectedCalloutIds.includes(callout.id)) {
      handleSelectCalloutMulti(callout, false);
    }
    if (callout.locked) return;
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
                    handleSelectCalloutMulti(callout, e.ctrlKey || e.metaKey || e.shiftKey);
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
                        if (movingAreaCalloutId === callout.id) {
                          handleAreaMoveStart(callout, e);
                        }
                      }}
                      onClick={(e) => {
                        if (!hasMovedDistance) {
                          e.stopPropagation();
                          handleSelectCalloutMulti(callout, e.ctrlKey || e.metaKey || e.shiftKey);
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
                      onClick={(e) => {
                        if (activeTool === 'eraser') {
                          e.stopPropagation();
                          handleDeleteSingleLine(line.id);
                        } else if (activeTool === 'select' || activeTool === 'marquee') {
                          e.stopPropagation();
                          handleSelectElement(line.id, e.ctrlKey || e.metaKey || e.shiftKey);
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
                  style={{
                    left: `calc(50% + ${util.x}%)`,
                    top: `calc(50% + ${util.y}%)`,
                    opacity: elOpacity,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'eraser') {
                      if (isLockedEl) return;
                      setUtilities((prev) => prev.filter((u) => u.id !== util.id));
                      setSelectedElementIds((prev) => prev.filter((id) => id !== util.id));
                      setHasChangesInSession(true);
                    } else {
                      handleSelectElement(util.id, e.ctrlKey || e.metaKey || e.shiftKey);
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
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-25 w-6 h-6 flex items-center justify-center cursor-pointer hover:scale-115 transition-all ${
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
                      : `${isDe ? meta.labelDe : meta.labelEn} — ${
                          isDe ? 'Klicken zum Auswählen (Strg für Mehrfachauswahl)' : 'Click to select (Ctrl for multi-select)'
                        }`
                  }
                >
                  <UtilitySymbol type={util.type} size="md" />
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
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'eraser') {
                      if (isLockedEl) return;
                      setPlayers((prev) => prev.filter((p) => p.id !== player.id));
                      setSelectedElementIds((prev) => prev.filter((id) => id !== player.id));
                      setHasChangesInSession(true);
                    } else {
                      handleSelectElement(player.id, e.ctrlKey || e.metaKey || e.shiftKey);
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
                    handleSelectCalloutMulti(callout, e.ctrlKey || e.metaKey || e.shiftKey);
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
                        onMouseDown={(e) => {
                          if (movingAreaCalloutId === callout.id) {
                            handleAreaMoveStart(callout, e);
                          } else {
                            handleCalloutDragStart(callout, e);
                          }
                        }}
                        onTouchStart={(e) => {
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
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden"
    >
      {/* AREA MOVE MODE BANNER (HIDES OTHERS) */}
      {movingAreaCalloutId && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2.5 bg-amber-500 text-zinc-950 font-bold rounded-xl shadow-2xl animate-bounce">
          <Move className="w-4 h-4" />
          <span>{isDe ? 'Bereich-Verschiebungsmodus' : 'Area Move Mode'}</span>
          <button
            onClick={() => setMovingAreaCalloutId(null)}
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-950 text-white rounded-lg text-xs hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-amber-400" />
            <span>{isDe ? 'Fertig' : 'Done'}</span>
          </button>
        </div>
      )}

      {/* CUSTOM SELECTION ACTIVE BANNER */}
      {isCustomSelectionActive && !movingAreaCalloutId && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 bg-indigo-950/90 border border-indigo-500/40 text-indigo-200 text-xs font-semibold rounded-full shadow-xl backdrop-blur-md animate-in fade-in duration-200">
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
      <header className="h-13 sm:h-14 border-b border-zinc-800 bg-zinc-950/95 px-2 sm:px-4 flex items-center justify-between gap-2 shrink-0 backdrop-blur-md print:hidden z-40">
        {/* Left: Back, Brand + Map Name, Floor Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
          <button
            onClick={handleTryBack}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-bold rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition-colors cursor-pointer shrink-0"
            title={isDe ? 'Kartenübersicht' : 'Overview'}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden lg:inline">{isDe ? 'Kartenübersicht' : 'Overview'}</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-amber-400 font-black tracking-tight text-sm shrink-0">
            <Crosshair className="w-4 h-4" />
            <span className="hidden xl:inline text-white">CS2Freitag</span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white truncate max-w-[90px] sm:max-w-[160px] md:max-w-none">
              {mapData.name}
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-400 hidden xl:inline uppercase">
              {mapData.category}
            </span>
          </div>

          {/* Floor Switcher (Upper / Lower / Both) */}
          {mapData.lowerImage && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
              <button
                onClick={() => setCurrentLevel('upper')}
                className={`px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  currentLevel === 'upper'
                    ? 'bg-zinc-100 text-zinc-950 font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title={isDe ? 'Nur Obere Ebene (O)' : 'Upper floor only (U)'}
              >
                {isDe ? 'O' : 'U'}
              </button>
              <button
                onClick={() => setCurrentLevel('lower')}
                className={`px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  currentLevel === 'lower'
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title={isDe ? 'Nur Untere Ebene (U)' : 'Lower floor only (L)'}
              >
                {isDe ? 'U' : 'L'}
              </button>
              <button
                onClick={() => setCurrentLevel('both')}
                className={`hidden md:inline-flex px-2 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  currentLevel === 'both'
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title={isDe ? 'Beide Ebenen nebeneinander (O + U)' : 'Both floors side-by-side'}
              >
                {isDe ? 'O + U' : 'U + L'}
              </button>
            </div>
          )}
        </div>

        {/* Center: Zone Filter + Local Session Indicator */}
        <div className="hidden xl:flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs">
            <button
              onClick={() => setSelectedZoneFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                selectedZoneFilter === 'all'
                  ? 'bg-zinc-100 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isDe ? 'Alle' : 'All'}
            </button>
            <button
              onClick={() => setSelectedZoneFilter('a_site')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                selectedZoneFilter === 'a_site'
                  ? 'bg-amber-400 text-zinc-950 font-bold'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              A
            </button>
            <button
              onClick={() => setSelectedZoneFilter('b_site')}
              className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                selectedZoneFilter === 'b_site'
                  ? 'bg-sky-400 text-zinc-950 font-bold'
                  : 'text-sky-400/80 hover:text-sky-300'
              }`}
            >
              B
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
            <CheckCircle2
              className={`w-3.5 h-3.5 ${hasChangesInSession ? 'text-amber-400' : 'text-emerald-400'}`}
            />
            <span>
              {hasChangesInSession
                ? isDe
                  ? 'Änderungen offen'
                  : 'Unsaved edits'
                : isDe
                ? 'Bereit'
                : 'Ready'}
            </span>
          </div>
        </div>

        {/* Right: Undo/Redo/Clear, Share, Edit/Done, Filter, Color Mode, Legend, Tablet Drawer, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Undo / Redo / Clear Board */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <button
              onClick={handleUndoDrawing}
              disabled={drawings.length === 0}
              className={`p-1.5 rounded-md transition-colors ${
                drawings.length > 0
                  ? 'text-zinc-200 hover:text-white hover:bg-zinc-800 cursor-pointer'
                  : 'text-zinc-600 cursor-not-allowed'
              }`}
              title={isDe ? 'Rückgängig (Strg+Z)' : 'Undo (Ctrl+Z)'}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedoDrawing}
              disabled={drawingsRedoStack.length === 0}
              className={`p-1.5 rounded-md transition-colors ${
                drawingsRedoStack.length > 0
                  ? 'text-zinc-200 hover:text-white hover:bg-zinc-800 cursor-pointer'
                  : 'text-zinc-600 cursor-not-allowed'
              }`}
              title={isDe ? 'Wiederholen (Strg+Y)' : 'Redo (Ctrl+Y)'}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            {(drawings.length > 0 || utilities.length > 0 || players.length > 0) && (
              <button
                onClick={handleClearTactics}
                className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
                title={isDe ? 'Board leeren (entsperrte Elemente)' : 'Clear unlocked items'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Share / Export */}
          <button
            onClick={handleShareTactics}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-sky-500/40 bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
            title={isDe ? 'Taktik teilen & exportieren' : 'Share & export tactic'}
          >
            <Share2 className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold hidden md:inline">{isDe ? 'Teilen' : 'Share'}</span>
          </button>

          {/* Bearbeiten / Fertig */}
          <button
            onClick={() => {
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
            className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
              isEditMode || singleEditCalloutId
                ? 'border-amber-400 bg-amber-400 text-zinc-950 shadow-md'
                : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:text-white hover:bg-zinc-800'
            }`}
            title={isDe ? 'Callouts bearbeiten' : 'Edit callouts'}
          >
            {isEditMode || singleEditCalloutId ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">{isDe ? 'Fertig' : 'Done'}</span>
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">{isDe ? 'Bearbeiten' : 'Edit'}</span>
              </>
            )}
          </button>

          {/* Tablet-Only Layers Slide-Over Trigger */}
          <button
            onClick={() => setIsTabletLayersOpen((p) => !p)}
            className={`hidden md:inline-flex lg:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
              isTabletLayersOpen
                ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white'
            }`}
            title={isDe ? 'Ebenen & Eigenschaften' : 'Layers & Properties'}
          >
            <Layers className="w-4 h-4 text-sky-400" />
            <span>{isDe ? 'Ebenen' : 'Layers'}</span>
          </button>

          {/* Color Mode Toggle */}
          <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setColorMode('zone')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                colorMode === 'zone' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
              title={isDe ? 'Zonen-Farben' : 'Zone colors'}
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setColorMode('danger')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                colorMode === 'danger' ? 'bg-red-500 text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title={isDe ? 'Gefahren-Farben' : 'Danger levels'}
            >
              <Shield className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Meine Callout-Auswahl (Desktop & Mobil) */}
          <button
            onClick={() => {
              if (customSelectedCalloutIds.length === 0) {
                handleOpenCustomSelectionModal();
              } else {
                setIsCustomSelectionActive(!isCustomSelectionActive);
              }
            }}
            className={`relative p-1.5 rounded-lg border transition-all cursor-pointer inline-flex items-center ${
              isCustomSelectionActive
                ? 'border-indigo-400 bg-indigo-500/25 text-indigo-300'
                : 'border-zinc-800 bg-zinc-900 text-indigo-400 hover:text-white'
            }`}
            title={isDe ? 'Meine Callout-Auswahl' : 'My Callout Selection'}
          >
            <ListFilter className="w-4 h-4" />
            {customSelectedCalloutIds.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 text-[9px] font-bold rounded-full flex items-center justify-center leading-none bg-indigo-500 text-white">
                {customSelectedCalloutIds.length}
              </span>
            )}
          </button>

          {/* Quick Help & App Guide */}
          <button
            onClick={() => setIsHelpDocsOpen(true)}
            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-amber-400 hover:text-white hover:bg-zinc-800 cursor-pointer transition-colors"
            title={isDe ? 'Hilfe & App-Erklärungen' : 'Help & App Guide'}
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Fullscreen (nur für die Karte — blendet Menüs links & rechts aus, oberes Menü bleibt sichtbar) */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-lg border inline-flex cursor-pointer transition-colors ${
              isFullscreen
                ? 'border-amber-400 bg-amber-400 text-zinc-950'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white'
            }`}
            title={
              isFullscreen
                ? isDe
                  ? 'Karten-Vollbild beenden'
                  : 'Exit map fullscreen'
                : isDe
                ? 'Karten-Vollbild (Menüs links/rechts ausblenden)'
                : 'Map fullscreen (hide sidebars)'
            }
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. MOBILE-ONLY TOP DRAWING TOOLBAR (md:hidden — NEVER duplicated on Desktop/Tablet, toggleable, hidden in map fullscreen!) */}
      {isToolbarVisible && !isFullscreen && (
      <div className="md:hidden border-b border-zinc-800 bg-zinc-900/95 px-2 py-1.5 flex flex-col gap-1.5 shrink-0 print:hidden z-30">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setIsToolbarVisible(false)}
            className="p-2 min-h-[38px] rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0 cursor-pointer transition-colors"
            title={isDe ? 'Werkzeugleiste ausblenden' : 'Hide toolbar'}
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('select')}
            className={`flex items-center gap-1 px-2.5 min-h-[38px] rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              activeTool === 'select'
                ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
                : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span>{isDe ? 'Auswahl' : 'Select'}</span>
          </button>

          <button
            onClick={() => setActiveTool('marquee')}
            className={`flex items-center gap-1 px-2.5 min-h-[38px] rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              activeTool === 'marquee'
                ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
                : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
            }`}
          >
            <BoxSelect className="w-3.5 h-3.5" />
            <span>{isDe ? 'Bereich' : 'Area'}</span>
          </button>

          <button
            onClick={() => handleToolPress('pen', false)}
            className={`flex items-center gap-1 px-2.5 min-h-[38px] rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              activeTool === 'pen' && !penWithArrow
                ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
                : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{isDe ? 'Linie' : 'Line'}</span>
          </button>

          <button
            onClick={() => handleToolPress('arrow', true)}
            className={`flex items-center gap-1 px-2.5 min-h-[38px] rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              activeTool === 'arrow'
                ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
                : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5 rotate-45" />
            <span>{isDe ? 'Pfeil' : 'Arrow'}</span>
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`flex items-center gap-1 px-2.5 min-h-[38px] rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              activeTool === 'eraser'
                ? 'bg-red-500/25 text-red-200 border border-red-500/60'
                : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>{isDe ? 'Radierer' : 'Eraser'}</span>
          </button>

          <button
            onClick={() => setActiveTool('utility')}
            className={`flex items-center gap-1 px-2.5 min-h-[38px] rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              activeTool === 'utility'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50'
                : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
            }`}
          >
            <UtilitySymbol type={selectedUtility} size="xs" />
            <span>Utility</span>
          </button>

          <button
            onClick={() => setActiveTool('player')}
            className={`flex items-center gap-1 px-2.5 min-h-[38px] rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              activeTool === 'player'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50'
                : 'bg-zinc-950/60 text-zinc-300 border border-zinc-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>T / CT</span>
          </button>

          {/* Compact Color Picker Button */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="flex items-center gap-1 px-2.5 min-h-[38px] rounded-lg bg-zinc-950/60 border border-zinc-800 shrink-0 cursor-pointer"
            title={isDe ? 'Farbe wählen' : 'Color'}
          >
            <span
              className="w-4 h-4 rounded-full border border-white/50"
              style={{ backgroundColor: penColor }}
            />
          </button>
        </div>

        {/* Mobile Secondary Sub-Row for Utility / Player / Color Swatches */}
        {showColorPicker && (
          <div className="flex items-center gap-2 px-1 py-1 bg-zinc-950/90 rounded-lg border border-zinc-800 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-zinc-400 shrink-0">{isDe ? 'Farbe:' : 'Color:'}</span>
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setPenColor(c);
                  setShowColorPicker(false);
                }}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full border shrink-0 cursor-pointer ${
                  penColor === c ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105' : 'border-zinc-700'
                }`}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setCustomColorTarget('pen');
                setIsCustomColorModalOpen(true);
                setShowColorPicker(false);
              }}
              className="px-2.5 h-7 rounded-full bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 text-[11px] font-bold shrink-0 cursor-pointer flex items-center gap-1"
            >
              <Palette className="w-3 h-3" />
              <span>{isDe ? 'Eigene' : 'Custom'}</span>
            </button>
          </div>
        )}

        {activeTool === 'utility' && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['smoke', 'flash', 'molotov', 'he', 'decoy'] as UtilityType[]).map((u) => {
              const meta = UTILITY_META[u];
              return (
                <button
                  key={u}
                  onClick={() => setSelectedUtility(u)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold uppercase shrink-0 cursor-pointer border ${
                    selectedUtility === u
                      ? `${meta.bgClass} ${meta.borderClass}`
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                  }`}
                >
                  <UtilitySymbol type={u} size="xs" />
                  <span>{u === 'molotov' ? 'Molo' : u}</span>
                </button>
              );
            })}
          </div>
        )}

        {activeTool === 'player' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedPlayerSide('ct')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer border ${
                selectedPlayerSide === 'ct'
                  ? 'bg-blue-600 text-white border-blue-400'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800'
              }`}
            >
              <img src={resolveAssetPath('ct.png')} alt="CT" className="w-4 h-4 object-contain" />
              <span>CT-Spieler</span>
            </button>
            <button
              onClick={() => setSelectedPlayerSide('t')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer border ${
                selectedPlayerSide === 't'
                  ? 'bg-amber-600 text-zinc-950 border-amber-400'
                  : 'bg-zinc-950 text-zinc-300 border-zinc-800'
              }`}
            >
              <img src={resolveAssetPath('T.png')} alt="T" className="w-4 h-4 object-contain" />
              <span>T-Spieler</span>
            </button>
          </div>
        )}
      </div>
      )}

      {/* 3. MAIN 3-COLUMN STUDIO STAGE */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* LEFT VERTICAL TOOL RAIL (Desktop & Tablet ONLY — toggleable, hidden in map fullscreen!) */}
        {isToolbarVisible && !isFullscreen && (
        <aside className="hidden md:flex flex-col justify-between w-52 lg:w-56 border-r border-zinc-800 bg-zinc-950 p-2.5 overflow-y-auto shrink-0 print:hidden z-30">
          <div className="space-y-3">
            {/* Werkzeuge Section */}
            <div>
              <div className="flex items-center justify-between px-1.5 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {isDe ? 'Werkzeuge' : 'Tools'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsToolbarVisible(false)}
                  className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-900 cursor-pointer"
                  title={isDe ? 'Werkzeugleiste ausblenden' : 'Hide toolbar'}
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setActiveTool('select')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    activeTool === 'select'
                      ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                      : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <MousePointer2 className="w-4 h-4 shrink-0" />
                  <span>{isDe ? 'Auswählen' : 'Select'}</span>
                </button>

                <button
                  onClick={() => setActiveTool('marquee')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    activeTool === 'marquee'
                      ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                      : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <BoxSelect className="w-4 h-4 shrink-0" />
                  <span>{isDe ? 'Bereich' : 'Area Box'}</span>
                </button>

                <button
                  onClick={() => handleToolPress('pen', false)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    activeTool === 'pen' && !penWithArrow
                      ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                      : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Pencil className="w-4 h-4 shrink-0" />
                    <span>{isDe ? 'Linie' : 'Line'}</span>
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/40"
                    style={{ backgroundColor: penColor }}
                  />
                </button>

                <button
                  onClick={() => handleToolPress('arrow', true)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    activeTool === 'arrow'
                      ? 'bg-sky-500/15 border-sky-500/60 text-sky-200'
                      : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ArrowUp className="w-4 h-4 rotate-45 shrink-0" />
                    <span>{isDe ? 'Pfeil (Rush)' : 'Arrow'}</span>
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/40"
                    style={{ backgroundColor: penColor }}
                  />
                </button>

                <button
                  onClick={() => setActiveTool('eraser')}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    activeTool === 'eraser'
                      ? 'bg-red-500/20 border-red-500/60 text-red-200'
                      : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <Eraser className="w-4 h-4 shrink-0" />
                  <span>{isDe ? 'Radierer' : 'Eraser'}</span>
                </button>

                {/* Utility Tool + Symbol Sub-Selector (matching T/CT symbol style) */}
                <div className="space-y-1">
                  <button
                    onClick={() => setActiveTool('utility')}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      activeTool === 'utility'
                        ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
                        : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <UtilitySymbol type={selectedUtility} size="sm" />
                      <span>Utility</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">
                      {selectedUtility === 'molotov' ? 'Molo' : selectedUtility}
                    </span>
                  </button>
                  {activeTool === 'utility' && (
                    <div className="grid grid-cols-3 gap-1 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      {(['smoke', 'flash', 'molotov', 'he', 'decoy'] as UtilityType[]).map((u) => {
                        const meta = UTILITY_META[u];
                        return (
                          <button
                            key={u}
                            onClick={() => setSelectedUtility(u)}
                            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded text-[10px] font-bold uppercase cursor-pointer border transition-colors ${
                              selectedUtility === u
                                ? `${meta.bgClass} ${meta.borderClass} shadow-xs`
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                            }`}
                            title={isDe ? meta.labelDe : meta.labelEn}
                          >
                            <UtilitySymbol type={u} size="sm" />
                            <span className="leading-none text-[9px]">{u === 'molotov' ? 'Molo' : u}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Player Tokens (T / CT) + Inline Side Selector */}
                <div className="space-y-1">
                  <button
                    onClick={() => setActiveTool('player')}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      activeTool === 'player'
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                        : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 shrink-0" />
                      <span>T / CT</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase text-zinc-400">
                      {selectedPlayerSide.toUpperCase()}
                    </span>
                  </button>
                  {activeTool === 'player' && (
                    <div className="grid grid-cols-2 gap-1 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <button
                        onClick={() => setSelectedPlayerSide('ct')}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-bold cursor-pointer border ${
                          selectedPlayerSide === 'ct'
                            ? 'bg-blue-600 text-white border-blue-400'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        <img src={resolveAssetPath('ct.png')} alt="CT" className="w-3.5 h-3.5 object-contain" />
                        <span>CT</span>
                      </button>
                      <button
                        onClick={() => setSelectedPlayerSide('t')}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-bold cursor-pointer border ${
                          selectedPlayerSide === 't'
                            ? 'bg-amber-600 text-zinc-950 border-amber-400'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        <img src={resolveAssetPath('T.png')} alt="T" className="w-3.5 h-3.5 object-contain" />
                        <span>T</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Zeichenfarbe Swatches */}
            <div className="pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between px-1.5 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {isDe ? 'Farbe' : 'Color'}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">{penColor}</span>
              </div>
              <div className="flex items-center justify-between gap-1 px-1">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPenColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                      penColor === c
                        ? 'border-amber-400 ring-2 ring-amber-400/50 scale-110'
                        : 'border-zinc-700'
                    }`}
                    title={c}
                  />
                ))}
              </div>
              <div className="mt-2 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setCustomColorTarget('pen');
                    setIsCustomColorModalOpen(true);
                  }}
                  className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 text-[10px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <Palette className="w-3 h-3" />
                  <span>{isDe ? 'Eigene Farbe...' : 'Custom Color...'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Shortcut Hint Footer */}
          <div className="pt-3 mt-3 border-t border-zinc-800/80 px-1 text-[10px] text-zinc-500 leading-relaxed space-y-1">
            <div>
              <span className="text-zinc-300 font-semibold">Strg+Klick</span>:{' '}
              {isDe ? 'Mehrfachauswahl' : 'Multi-select'}
            </div>
            <div>
              <span className="text-zinc-300 font-semibold">Rechtsklick</span>:{' '}
              {isDe ? 'Kontextmenü' : 'Context menu'}
            </div>
          </div>
        </aside>
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
            className="absolute top-3 left-3 z-40 p-1.5 rounded-lg bg-zinc-950/90 border border-zinc-800/90 text-zinc-400 hover:text-white hover:bg-zinc-900 shadow-lg backdrop-blur-xs transition-colors cursor-pointer print:hidden"
            title={isDe ? 'Werkzeuge einblenden' : 'Show tools'}
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
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
          style={{ touchAction: 'none' }}
          className={`relative flex-1 bg-zinc-950 flex items-center justify-center overflow-hidden ${
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

          {/* FLOATING ELEMENT & CALLOUT SELECTION CONTEXT BAR */}
          {!isDrawingPolygonArea &&
            !isEditMode &&
            !contextMenu &&
            (selectedElementIds.length > 0 || selectedCalloutIds.length > 0) && (() => {
              const totalCount = selectedElementIds.length + selectedCalloutIds.length;
              const selectedGroupSet = new Set([
                ...drawings.filter((d) => selectedElementIds.includes(d.id) && d.groupId).map((d) => d.groupId),
                ...utilities.filter((u) => selectedElementIds.includes(u.id) && u.groupId).map((u) => u.groupId),
                ...players.filter((p) => selectedElementIds.includes(p.id) && p.groupId).map((p) => p.groupId),
                ...mapData.callouts.filter((c) => selectedCalloutIds.includes(c.id) && c.groupId).map((c) => c.groupId),
              ]);
              const isGrouped = selectedGroupSet.size > 0;
              const allLocked =
                drawings.filter((d) => selectedElementIds.includes(d.id)).every((d) => d.locked) &&
                utilities.filter((u) => selectedElementIds.includes(u.id)).every((u) => u.locked) &&
                players.filter((p) => selectedElementIds.includes(p.id)).every((p) => p.locked) &&
                mapData.callouts.filter((c) => selectedCalloutIds.includes(c.id)).every((c) => c.locked);

              return (
                <div
                  data-no-map-click="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded-xl bg-zinc-950/95 border border-zinc-700 shadow-2xl backdrop-blur-md text-xs text-zinc-100 w-max max-w-[calc(100%-72px)] print:hidden"
                >
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold tabular-nums shrink-0">
                    {totalCount} {isDe ? 'gewählt' : 'selected'}
                  </span>
                  {isGrouped && (
                    <span className="px-1.5 py-0.5 rounded border border-sky-500/50 bg-sky-500/10 text-sky-300 text-[10px] font-bold shrink-0">
                      {isDe ? 'Gruppe' : 'Group'}
                    </span>
                  )}

                  {(totalCount >= 2 || isGrouped) && (
                    <button
                      type="button"
                      onClick={handleGroupSelected}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
                      title={isDe ? 'Elemente gruppieren / Gruppe auflösen' : 'Group / Ungroup'}
                    >
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      <span className="hidden sm:inline">
                        {isGrouped ? (isDe ? 'Lösen' : 'Ungroup') : isDe ? 'Gruppieren' : 'Group'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
                    title={isDe ? 'Duplizieren (Strg+D)' : 'Duplicate (Ctrl+D)'}
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">{isDe ? 'Duplizieren' : 'Duplicate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleLockSelected}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
                    title={isDe ? 'Auswahl sperren / entsperren' : 'Lock / Unlock'}
                  >
                    {allLocked ? (
                      <Unlock className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="hidden sm:inline">
                      {allLocked ? (isDe ? 'Entsperren' : 'Unlock') : isDe ? 'Sperren' : 'Lock'}
                    </span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowContextColorPicker((p) => !p)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors shrink-0 cursor-pointer"
                      title={isDe ? 'Farbe ändern' : 'Change color'}
                    >
                      <Palette className="w-3.5 h-3.5 text-purple-400" />
                      <span className="hidden sm:inline">{isDe ? 'Farbe' : 'Color'}</span>
                    </button>
                    {showContextColorPicker && (
                      <div className="fixed top-24 left-1/2 -translate-x-1/2 p-2 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl flex items-center gap-1.5 z-50">
                        {colors.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              handleUpdateSelectedElementsProps({ color: c });
                              setShowContextColorPicker(false);
                            }}
                            style={{ backgroundColor: c }}
                            className="w-6 h-6 rounded-full border border-zinc-600 hover:scale-115 transition-transform cursor-pointer"
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setCustomColorTarget('selection');
                            setIsCustomColorModalOpen(true);
                            setShowContextColorPicker(false);
                          }}
                          className="px-2 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-600 text-[10px] font-bold cursor-pointer flex items-center gap-1"
                        >
                          <Palette className="w-3 h-3" />
                          <span>{isDe ? 'Eigene' : 'Custom'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleDeleteSelectedElements}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors shrink-0 cursor-pointer"
                    title={isDe ? 'Auswahl löschen (Entf)' : 'Delete selected (Del)'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isDe ? 'Löschen' : 'Delete'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedElementIds([]);
                      setSelectedCalloutIds([]);
                      setSelectedCallout(null);
                      setShowContextColorPicker(false);
                    }}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer shrink-0"
                    title={isDe ? 'Auswahl aufheben' : 'Deselect'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })()}

          {/* RIGHT-CLICK CONTEXT MENU POPOVER */}
          {contextMenu && !isDrawingPolygonArea && (() => {
            const totalCount = selectedElementIds.length + selectedCalloutIds.length;
            const singleCtxCallout =
              selectedCalloutIds.length === 1 && selectedElementIds.length === 0
                ? mapData.callouts.find((c) => c.id === selectedCalloutIds[0]) || null
                : null;
            const selectedGroupSet = new Set([
              ...drawings.filter((d) => selectedElementIds.includes(d.id) && d.groupId).map((d) => d.groupId),
              ...utilities.filter((u) => selectedElementIds.includes(u.id) && u.groupId).map((u) => u.groupId),
              ...players.filter((p) => selectedElementIds.includes(p.id) && p.groupId).map((p) => p.groupId),
              ...mapData.callouts.filter((c) => selectedCalloutIds.includes(c.id) && c.groupId).map((c) => c.groupId),
            ]);
            const isGrouped = selectedGroupSet.size > 0;
            const allLocked =
              totalCount > 0 &&
              drawings.filter((d) => selectedElementIds.includes(d.id)).every((d) => d.locked) &&
              utilities.filter((u) => selectedElementIds.includes(u.id)).every((u) => u.locked) &&
              players.filter((p) => selectedElementIds.includes(p.id)).every((p) => p.locked) &&
              mapData.callouts.filter((c) => selectedCalloutIds.includes(c.id)).every((c) => c.locked);

            const menuLeft =
              typeof window !== 'undefined' ? Math.min(contextMenu.x, window.innerWidth - 260) : contextMenu.x;
            const menuTop =
              typeof window !== 'undefined'
                ? Math.min(contextMenu.y, window.innerHeight - (singleCtxCallout ? 430 : 300))
                : contextMenu.y;

            return (
              <div
                data-no-map-click="true"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{ left: `${Math.max(12, menuLeft)}px`, top: `${Math.max(12, menuTop)}px` }}
                className="fixed z-[110] w-60 rounded-xl bg-zinc-900/95 border border-zinc-700/90 shadow-2xl backdrop-blur-md text-xs text-zinc-100 overflow-hidden print:hidden"
              >
                {/* Header */}
                <div className="px-3.5 py-2.5 border-b border-zinc-800 flex items-center justify-between gap-2 bg-zinc-950/60">
                  <span className="font-semibold text-zinc-100 truncate">
                    {singleCtxCallout
                      ? singleCtxCallout.name.replace(/\n/g, ' ')
                      : totalCount === 1
                      ? isDe
                        ? '1 Element ausgewählt'
                        : '1 element selected'
                      : isDe
                      ? `${totalCount} Elemente ausgewählt`
                      : `${totalCount} elements selected`}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                      isGrouped
                        ? 'border-sky-400/70 bg-sky-500/20 text-sky-300'
                        : 'border-sky-500/40 bg-sky-500/10 text-sky-300/80'
                    }`}
                  >
                    {isDe ? 'Gruppe' : 'Group'}
                  </span>
                </div>

                {/* Action Rows */}
                <div className="p-1.5 space-y-0.5">
                  {singleCtxCallout && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          handleOpenCalloutEditor(singleCtxCallout, e);
                          setContextMenu(null);
                        }}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Edit3 className="w-4 h-4 text-amber-400" />
                          <span className="font-medium">
                            {isDe ? 'Callout bearbeiten' : 'Edit callout'}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentTextRot =
                            singleCtxCallout.textRotation !== undefined
                              ? singleCtxCallout.textRotation
                              : singleCtxCallout.rotation || 0;
                          let nextRot = currentTextRot + 45;
                          if (nextRot > 180) nextRot = -135;
                          const updated = mapData.callouts.map((c) =>
                            c.id === singleCtxCallout.id ? { ...c, textRotation: nextRot } : c
                          );
                          handleMapUpdate({ ...mapData, callouts: updated });
                        }}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <RotateCw className="w-4 h-4 text-sky-400" />
                          <span className="font-medium">
                            {isDe ? 'Text drehen (+45°)' : 'Rotate text (+45°)'}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {singleCtxCallout.textRotation !== undefined
                            ? singleCtxCallout.textRotation
                            : singleCtxCallout.rotation || 0}
                          °
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (movingAreaCalloutId === singleCtxCallout.id) {
                            setMovingAreaCalloutId(null);
                          } else {
                            if (!singleCtxCallout.area) {
                              const width = 10;
                              const height = 10;
                              const areaX = Math.max(
                                -50,
                                Math.min(50 - width, Math.round((singleCtxCallout.x - width / 2) * 10) / 10)
                              );
                              const areaY = Math.max(
                                -50,
                                Math.min(50 - height, Math.round((singleCtxCallout.y - height / 2) * 10) / 10)
                              );
                              const updatedCallouts = mapData.callouts.map((c) =>
                                c.id === singleCtxCallout.id
                                  ? {
                                      ...c,
                                      area: { x: areaX, y: areaY, width, height, shape: 'rect' as const },
                                    }
                                  : c
                              );
                              handleMapUpdate({ ...mapData, callouts: updatedCallouts });
                            }
                            setIsEditMode(true);
                            setMovingAreaCalloutId(singleCtxCallout.id);
                          }
                          setContextMenu(null);
                        }}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Move className="w-4 h-4 text-amber-400" />
                          <span className="font-medium">
                            {movingAreaCalloutId === singleCtxCallout.id
                              ? isDe
                                ? 'Bereich-Verschieben beenden'
                                : 'Stop moving area'
                              : isDe
                              ? 'Bereich verschieben'
                              : 'Move area'}
                          </span>
                        </span>
                      </button>

                      <div className="my-1 border-t border-zinc-800" />
                    </>
                  )}
                  <button
                    type="button"
                    disabled={totalCount < 2 && !isGrouped}
                    onClick={handleGroupSelected}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                      totalCount >= 2 || isGrouped
                        ? 'hover:bg-zinc-800 text-zinc-100 cursor-pointer'
                        : 'text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-zinc-300" />
                      <span className="font-medium">
                        {isGrouped
                          ? isDe
                            ? 'Gruppe aufheben'
                            : 'Ungroup'
                          : isDe
                          ? 'Gruppieren'
                          : 'Group'}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Copy className="w-4 h-4 text-zinc-300" />
                      <span className="font-medium">{isDe ? 'Duplizieren' : 'Duplicate'}</span>
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">Ctrl+D</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleLockSelected}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      {allLocked ? (
                        <Unlock className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Lock className="w-4 h-4 text-zinc-300" />
                      )}
                      <span className="font-medium">
                        {allLocked ? (isDe ? 'Entsperren' : 'Unlock') : isDe ? 'Sperren' : 'Lock'}
                      </span>
                    </span>
                  </button>

                  {/* Farbe ändern > */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowContextColorSubmenu((p) => !p)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 text-zinc-100 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Palette className="w-4 h-4 text-zinc-300" />
                        <span className="font-medium">{isDe ? 'Farbe ändern' : 'Change color'}</span>
                      </span>
                      <ChevronRight
                        className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                          showContextColorSubmenu ? 'rotate-90' : ''
                        }`}
                      />
                    </button>
                    {showContextColorSubmenu && (
                      <div className="px-2.5 py-2 mt-0.5 rounded-lg bg-zinc-950/90 border border-zinc-800 flex items-center justify-between gap-1.5">
                        {colors.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              handleUpdateSelectedElementsProps({ color: c });
                              setShowContextColorSubmenu(false);
                              setContextMenu(null);
                            }}
                            style={{ backgroundColor: c }}
                            className="w-5 h-5 rounded-full border border-zinc-600 hover:scale-120 transition-transform cursor-pointer"
                            title={c}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="my-1 border-t border-zinc-800" />

                  <button
                    type="button"
                    onClick={handleDeleteSelectedElements}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="font-medium">{isDe ? 'Löschen' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            );
          })()}

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
          {!isDrawingPolygonArea &&
            (() => {
              const baseTileSize = mapContainerRef.current?.clientWidth || 720;
              const stageEl = mapContainerRef.current?.parentElement;
              const stageW = stageEl?.clientWidth || 900;
              const stageH = stageEl?.clientHeight || 700;
              const scaledW = Math.max(1, baseTileSize * zoom);
              const scaledH = Math.max(1, baseTileSize * zoom);
              const viewWFrac = Math.min(1, stageW / scaledW);
              const viewHFrac = Math.min(1, stageH / scaledH);
              const centerXFrac = 0.5 - pan.x / scaledW;
              const centerYFrac = 0.5 - pan.y / scaledH;
              const boxLeft = Math.max(0, Math.min(1 - viewWFrac, centerXFrac - viewWFrac / 2));
              const boxTop = Math.max(0, Math.min(1 - viewHFrac, centerYFrac - viewHFrac / 2));

              const panToMinimapEvent = (clientX: number, clientY: number) => {
                if (!minimapRef.current) return;
                const r = minimapRef.current.getBoundingClientRect();
                const nx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
                const ny = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
                setPan({
                  x: Math.round((0.5 - nx) * scaledW),
                  y: Math.round((0.5 - ny) * scaledH),
                });
              };

              if (!showMinimap) {
                return (
                  <button
                    type="button"
                    data-no-map-click="true"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMinimap(true);
                    }}
                    className="hidden lg:flex items-center gap-1.5 absolute bottom-3 right-3 z-30 px-2.5 py-1.5 rounded-xl bg-zinc-950/90 border border-zinc-800 hover:border-sky-500/50 text-xs font-bold text-zinc-200 hover:text-white shadow-2xl backdrop-blur-md cursor-pointer print:hidden"
                    title={isDe ? 'Minikarte anzeigen' : 'Show minimap'}
                  >
                    <MapIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>Minikarte</span>
                  </button>
                );
              }

              return (
                <div
                  data-no-map-click="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="hidden lg:flex flex-col absolute bottom-3 right-3 z-30 w-[156px] rounded-xl bg-zinc-950/95 border border-zinc-700/90 shadow-2xl backdrop-blur-md p-1.5 gap-1 print:hidden"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                      <MapIcon className="w-3 h-3 text-sky-400" />
                      <span>Minikarte</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMinimap(false)}
                      className="p-0.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer"
                      title={isDe ? 'Minikarte ausblenden' : 'Hide minimap'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div
                    ref={minimapRef}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingMinimap(true);
                      panToMinimapEvent(e.clientX, e.clientY);
                    }}
                    onMouseMove={(e) => {
                      if (!isDraggingMinimap) return;
                      e.stopPropagation();
                      panToMinimapEvent(e.clientX, e.clientY);
                    }}
                    onMouseUp={() => setIsDraggingMinimap(false)}
                    onMouseLeave={() => setIsDraggingMinimap(false)}
                    className="relative w-full aspect-square rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 cursor-crosshair select-none"
                    title={isDe ? 'Klicken oder ziehen zum Navigieren' : 'Click or drag to pan'}
                  >
                    <img
                      src={resolveAssetPath(activeImage)}
                      alt="Minimap"
                      className="w-full h-full object-cover opacity-80 pointer-events-none"
                      draggable={false}
                    />
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="-50 -50 100 100"
                      preserveAspectRatio="none"
                    >
                      {drawings
                        .filter((d) => isLayerVisible(d.layerId, 'layer_t'))
                        .map((d) => (
                          <polyline
                            key={`mini_${d.id}`}
                            points={d.points.map((p) => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke={d.color || '#ffffff'}
                            strokeWidth={1.6}
                            strokeLinecap="round"
                          />
                        ))}
                      {utilities
                        .filter((u) => isLayerVisible(u.layerId, 'layer_util'))
                        .map((u) => (
                          <circle
                            key={`mini_${u.id}`}
                            cx={u.x}
                            cy={u.y}
                            r={2.5}
                            fill={UTILITY_META[u.type]?.colorHex || '#38bdf8'}
                          />
                        ))}
                      {players
                        .filter((p) => isLayerVisible(p.layerId, p.side === 'ct' ? 'layer_ct' : 'layer_t'))
                        .map((p) => (
                          <circle
                            key={`mini_${p.id}`}
                            cx={p.x}
                            cy={p.y}
                            r={2.5}
                            fill={p.side === 'ct' ? '#2563eb' : '#d97706'}
                          />
                        ))}
                    </svg>

                    {/* Live Viewport Frame */}
                    <div
                      style={{
                        left: `${boxLeft * 100}%`,
                        top: `${boxTop * 100}%`,
                        width: `${viewWFrac * 100}%`,
                        height: `${viewHFrac * 100}%`,
                      }}
                      className="absolute border-[1.5px] border-sky-400 bg-sky-400/15 rounded-[2px] shadow-[0_0_8px_rgba(56,189,248,0.65)] pointer-events-none"
                    />
                  </div>
                </div>
              );
            })()}

        </div>

        {/* MOBILE FLOATING BOTTOM BAR (Karten-Zoom & Schrift-Zoom mit je einem Schieberegler, Bereiche, Raster & Ebenen-Button — md:hidden) */}
        {!isDrawingPolygonArea && (
          <div
            data-no-map-click="true"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="md:hidden absolute bottom-2 left-2 right-2 z-30 flex items-end justify-between gap-1.5 pointer-events-none print:hidden"
          >
            <div className="pointer-events-auto flex flex-col gap-1 p-1.5 rounded-xl bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-md max-w-[calc(100%-46px)]">
              {/* Zeile 1: Karten-Zoom (Schieberegler) + Fit + Bereiche + Raster */}
              <div className="flex flex-wrap items-center gap-1" style={{ touchAction: 'pan-x' }}>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="w-6 h-7 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer shrink-0"
                  title="Zoom -"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="50"
                  max="250"
                  step="1"
                  value={Math.round(zoom * 100)}
                  onChange={(e) => handleZoomChange(Number(e.target.value) / 100)}
                  onInput={(e) => handleZoomChange(Number((e.target as HTMLInputElement).value) / 100)}
                  style={{ touchAction: 'pan-x' }}
                  className="w-[74px] accent-sky-400 cursor-pointer h-2 bg-zinc-800 rounded-lg shrink-0"
                  title={isDe ? 'Karten-Zoom anpassen' : 'Adjust map zoom'}
                />
                <span className="text-[10px] font-mono font-bold tabular-nums text-zinc-100 min-w-[30px] text-center shrink-0">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="w-6 h-7 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer shrink-0"
                  title="Zoom +"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(calculateFitZoom());
                    setPan({ x: 0, y: 0 });
                  }}
                  className="px-1.5 h-7 rounded-lg text-[10px] font-mono font-bold bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer shrink-0"
                  title={isDe ? 'Karte einpassen' : 'Fit map'}
                >
                  Fit
                </button>
                <button
                  type="button"
                  onClick={() => setShowAreas((a) => !a)}
                  className={`w-6 h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    showAreas
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                  title={isDe ? 'Bereiche' : 'Areas'}
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowGrid((g) => !g)}
                  className={`w-6 h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    showGrid
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                  title={isDe ? 'Raster' : 'Grid'}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Zeile 2: Schriftgröße (Schieberegler) + Fit */}
              <div className="flex flex-wrap items-center gap-1" style={{ touchAction: 'pan-x' }}>
                <button
                  type="button"
                  onClick={() => setShowCalloutLabels((p) => !p)}
                  className={`w-6 h-7 flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    showCalloutLabels
                      ? 'border-zinc-700 bg-zinc-900 text-zinc-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                  }`}
                  title={isDe ? 'Callout-Namen ein-/ausblenden' : 'Toggle labels'}
                >
                  {showCalloutLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalloutScale((prev) => Math.max(0.4, Math.round((prev - 0.05) * 100) / 100))
                  }
                  className="px-1.5 h-7 rounded-lg text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 cursor-pointer shrink-0"
                  title={isDe ? 'Schrift kleiner' : 'Smaller text'}
                >
                  A-
                </button>
                <input
                  type="range"
                  min="40"
                  max="200"
                  step="1"
                  value={Math.round(calloutScale * 100)}
                  onChange={(e) => setCalloutScale(Number(e.target.value) / 100)}
                  onInput={(e) => setCalloutScale(Number((e.target as HTMLInputElement).value) / 100)}
                  style={{ touchAction: 'pan-x' }}
                  className="w-[82px] accent-amber-400 cursor-pointer h-2 bg-zinc-800 rounded-lg shrink-0"
                  title={isDe ? 'Schriftgröße anpassen' : 'Adjust font size'}
                />
                <span className="text-[10px] font-mono font-bold tabular-nums text-zinc-200 min-w-[30px] text-center shrink-0">
                  {Math.round(calloutScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCalloutScale((prev) => Math.min(2.0, Math.round((prev + 0.05) * 100) / 100))
                  }
                  className="px-1.5 h-7 rounded-lg text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 cursor-pointer shrink-0"
                  title={isDe ? 'Schrift größer' : 'Larger text'}
                >
                  A+
                </button>
                <button
                  type="button"
                  onClick={() => setCalloutScale(0.6)}
                  className="px-1.5 h-7 rounded-lg text-[10px] font-mono font-bold bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer shrink-0"
                  title={isDe ? 'Schriftgröße zurücksetzen (60%)' : 'Reset font size (60%)'}
                >
                  Fit
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileSheetTab('layers');
                setIsMobileSheetOpen(true);
              }}
              className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 shadow-2xl cursor-pointer transition-colors shrink-0"
              title={isDe ? 'Ebenen & Verlauf' : 'Layers & History'}
              aria-label={isDe ? 'Ebenen & Verlauf' : 'Layers & History'}
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
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

      {/* FULL-WIDTH DESKTOP & TABLET BOTTOM CONTROL BAR (nutzt den kompletten unteren Bereich über dem Verlauf, rechtes Fenster bleibt darüber) */}
      {!isDrawingPolygonArea && (
        <div
          data-no-map-click="true"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="hidden md:flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-zinc-800 bg-zinc-950/95 text-xs text-zinc-200 shrink-0 print:hidden z-30"
        >
          {/* Linke Steuerung: Bereiche, Raster & Schriftgröße */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAreas((a) => !a)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer shrink-0 ${
                showAreas
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title={isDe ? 'Callout-Bereiche ein-/ausblenden' : 'Toggle areas'}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{isDe ? 'Bereiche' : 'Areas'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGrid((g) => !g)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer shrink-0 ${
                showGrid
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
              title={isDe ? 'Koordinaten-Raster ein-/ausblenden' : 'Toggle grid'}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>{isDe ? 'Raster' : 'Grid'}</span>
            </button>

            <div className="h-4 w-px bg-zinc-800 shrink-0" />

            {/* Schriftgröße (Callout Scale) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowCalloutLabels((p) => !p)}
                className={`p-1 rounded-md border cursor-pointer transition-colors ${
                  showCalloutLabels
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white'
                }`}
                title={isDe ? 'Callout-Namen ein-/ausblenden' : 'Toggle labels'}
              >
                {showCalloutLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalloutScale((prev) => Math.max(0.4, Math.round((prev - 0.05) * 100) / 100))
                }
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                title={isDe ? 'Schrift kleiner' : 'Smaller text'}
              >
                A-
              </button>
              <input
                type="range"
                min="40"
                max="200"
                step="1"
                value={Math.round(calloutScale * 100)}
                onChange={(e) => setCalloutScale(Number(e.target.value) / 100)}
                onInput={(e) => setCalloutScale(Number((e.target as HTMLInputElement).value) / 100)}
                style={{ touchAction: 'pan-x' }}
                className="w-16 lg:w-24 accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                title={isDe ? 'Schriftgröße anpassen' : 'Adjust font size'}
              />
              <span className="font-mono font-bold tabular-nums text-[11px] text-zinc-300 w-9 text-center">
                {Math.round(calloutScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() =>
                  setCalloutScale((prev) => Math.min(2.0, Math.round((prev + 0.05) * 100) / 100))
                }
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                title={isDe ? 'Schrift größer' : 'Larger text'}
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => {
                  const defaultScale =
                    typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 1.0;
                  setCalloutScale(defaultScale);
                }}
                className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer"
                title={isDe ? 'Schriftgröße zurücksetzen (100%)' : 'Reset font size'}
              >
                Fit
              </button>
            </div>
          </div>

          {/* Rechte Steuerung: Zoom, Fit & Versionsverlauf */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                title="Zoom -"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min="50"
                max="250"
                step="1"
                value={Math.round(zoom * 100)}
                onChange={(e) => handleZoomChange(Number(e.target.value) / 100)}
                onInput={(e) => handleZoomChange(Number((e.target as HTMLInputElement).value) / 100)}
                style={{ touchAction: 'pan-x' }}
                className="w-20 lg:w-28 accent-sky-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
              <span className="font-mono font-bold tabular-nums text-[11px] text-zinc-100 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                title="Zoom +"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(calculateFitZoom());
                  setPan({ x: 0, y: 0 });
                  const defaultScale =
                    typeof window !== 'undefined' && window.innerWidth < 768 ? 0.6 : 1.0;
                  setCalloutScale(defaultScale);
                }}
                className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800 cursor-pointer"
                title={isDe ? 'Auf Bildschirm einpassen' : 'Fit to screen'}
              >
                Fit
              </button>
            </div>

            <div className="h-4 w-px bg-zinc-800 shrink-0" />

            {/* Compact Versionsverlauf Button */}
            <button
              type="button"
              onClick={() => setIsHistoryExpanded((p) => !p)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold transition-colors cursor-pointer shrink-0 ${
                isHistoryExpanded
                  ? 'bg-amber-500 text-zinc-950 border-amber-400'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white'
              }`}
              title={
                isDe
                  ? 'Versionsverlauf öffnen/schließen (max. 5 Versionen mit Vorschau)'
                  : 'Toggle version history (max 5 snapshots)'
              }
            >
              <History className="w-3.5 h-3.5" />
              <span>{isDe ? 'Verlauf' : 'History'}</span>
              <span
                className={`px-1 rounded text-[10px] font-mono tabular-nums ${
                  isHistoryExpanded ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-amber-300'
                }`}
              >
                {Math.min(5, snapshots.length)}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP & TABLET COLLAPSIBLE BOTTOM VERSION HISTORY BAR */}
      <TacticalHistoryPanel
        lang={lang}
        snapshots={snapshots}
        isExpanded={isHistoryExpanded}
        onToggleExpand={() => setIsHistoryExpanded((p) => !p)}
        onSaveSnapshot={handleSaveSnapshot}
        onRestoreSnapshot={handleRestoreSnapshot}
        onOpenPngPreview={(snap) => {
          setPreviewSnapshot(snap);
          setIsTacticPreviewOpen(true);
        }}
        drawings={drawings}
        utilities={utilities}
        players={players}
        mapImage={activeImage}
      />

      {/* MOBILE BOTTOM SHEET DRAWER (Ebenen, Eigenschaften, Callout-Info & Verlauf — md:hidden) */}
      {(isMobileSheetOpen || (Boolean(selectedCallout) && !isEditMode && !contextMenu)) && !isDrawingPolygonArea && (
        <div
          data-no-map-click="true"
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end print:hidden"
        >
          <div
            onClick={() => {
              setIsMobileSheetOpen(false);
              setSelectedCallout(null);
            }}
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
                    onClick={() => setMobileSheetTab('layers')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                      mobileSheetTab === 'layers'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{isDe ? 'Ebenen & Info' : 'Layers & Info'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileSheetTab('history')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                      mobileSheetTab === 'history'
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
                  onClick={() => {
                    setIsMobileSheetOpen(false);
                    setSelectedCallout(null);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
                  title={isDe ? 'Schließen' : 'Close'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {mobileSheetTab === 'layers' ? (
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
                />
              ) : (
                <TacticalHistoryPanel
                  lang={lang}
                  snapshots={snapshots}
                  isExpanded={true}
                  onToggleExpand={() => {}}
                  onSaveSnapshot={handleSaveSnapshot}
                  onRestoreSnapshot={handleRestoreSnapshot}
                  onOpenPngPreview={(snap) => {
                    setPreviewSnapshot(snap);
                    setIsTacticPreviewOpen(true);
                  }}
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
      )}

      {/* 5. KURZHILFE & FARBLEGENDE MODAL */}
      {showLegend && (
        <div
          onClick={() => setShowLegend(false)}
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
                onClick={() => setShowLegend(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 text-xs">
              {/* TEIL 1: KURZHILFE ZU DEN FUNKTIONEN */}
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

              {/* TEIL 2: FARBLEGENDE */}
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
            </div>

            <button
              onClick={() => setShowLegend(false)}
              className="mt-5 w-full py-2 text-xs font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors cursor-pointer"
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
                    ? `Callout bearbeiten: ${editingCallout.name.replace(/\n/g, ' ')}`
                    : `Edit Callout: ${editingCallout.name.replace(/\n/g, ' ')}`
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
              {/* Callout Name (Strictly max 2 lines, 2nd line only shown upon pressing Enter) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase text-zinc-400">
                    {isDe ? 'Callout-Name (Englisch)' : 'Callout Name (English)'} *
                  </label>
                  {calloutFormName.includes('\n') ? (
                    <span className="text-[10px] font-mono text-amber-400 font-bold px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30">
                      2 / 2 {isDe ? 'Zeilen' : 'Lines'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-zinc-500">
                      {isDe ? 'Enter für 2. Zeile' : 'Enter for 2nd line'}
                    </span>
                  )}
                </div>
                <textarea
                  rows={calloutFormName.includes('\n') ? 2 : 1}
                  required
                  placeholder={isDe ? "z. B. Bridge, Banana, Quad..." : "e.g. Bridge, Banana, Quad..."}
                  value={calloutFormName}
                  onChange={(e) => {
                    const rawLines = e.target.value.split(/\r?\n/);
                    // Strictly clamp to at most 2 lines (no 3rd line ever)
                    const limitedLines = rawLines.slice(0, 2);
                    const val = limitedLines.join('\n');
                    setCalloutFormName(val);
                    const lower = val.toLowerCase();
                    if (lower.includes('ct spawn') || lower === 'ct') {
                      setCalloutFormZone('ct_spawn');
                      setCalloutFormCustomImage('ct.png');
                      setCalloutFormDisplayMode((prev) => prev === 'text' ? 'image' : prev);
                      setCalloutFormHidePin(false);
                    } else if (lower.includes('t spawn') || lower === 't') {
                      setCalloutFormZone('t_spawn');
                      setCalloutFormCustomImage('T.png');
                      setCalloutFormDisplayMode((prev) => prev === 'text' ? 'image' : prev);
                      setCalloutFormHidePin(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const hasSecondLine = calloutFormName.includes('\n');
                      if (hasSecondLine && !e.ctrlKey && !e.metaKey) {
                        // STRICTLY block any 3rd line from ever being created!
                        e.preventDefault();
                        return;
                      }
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        handleSaveCalloutForm(e);
                      }
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-950 text-white focus:outline-hidden focus:border-zinc-400 resize-none font-medium leading-snug transition-all duration-150 ${
                    calloutFormName.includes('\n')
                      ? 'h-[62px]'
                      : 'h-[38px] overflow-hidden'
                  }`}
                />
                <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
                  {calloutFormName.includes('\n')
                    ? (isDe ? '✓ 2. Zeile aktiv (Keine 3. Zeile möglich) • Strg+Enter zum Speichern' : '✓ 2nd line active (No 3rd line allowed) • Ctrl+Enter to save')
                    : (isDe ? 'Tipp: Drücke Enter, um eine 2. Zeile hinzuzufügen' : 'Tip: Press Enter to add a 2nd line')}
                </span>
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
                      setCalloutFormHidePin(false);
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
                      setCalloutFormHidePin(false);
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
                          onClick={() => {
                            setCalloutFormCustomImage('ct.png');
                            setCalloutFormDisplayMode((prev) => prev === 'text' ? 'image' : prev);
                            setCalloutFormHidePin(false);
                          }}
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
                          onClick={() => {
                            setCalloutFormCustomImage('T.png');
                            setCalloutFormDisplayMode((prev) => prev === 'text' ? 'image' : prev);
                            setCalloutFormHidePin(false);
                          }}
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
                                className="mt-3 px-2 py-0.5 rounded bg-zinc-950/90 border border-zinc-700 text-white font-bold whitespace-nowrap text-center leading-tight shadow"
                              >
                                {calloutFormName.includes('\n') ? (
                                  calloutFormName.split('\n').slice(0, 2).map((l, i) => (
                                    <div key={i} className="whitespace-nowrap leading-tight">{l || '\u00A0'}</div>
                                  ))
                                ) : (
                                  <span>{calloutFormName.trim() || 'Callout-Name'}</span>
                                )}
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
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-4 h-4 rounded-full bg-amber-400 border-2 border-zinc-950 shadow-[0_0_10px_rgba(251,191,36,0.8)] pointer-events-none flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                      </div>

                      {/* MOVABLE Text Label Box relative to fixed center dot */}
                      <div
                        style={{
                          transform: `translate(${calloutFormPinOffsetX}px, ${calloutFormPinOffsetY}px) rotate(${calloutFormTextRotation}deg)`,
                          fontSize: `${calloutFormFontSize}px`,
                          fontFamily: getFontFamilyStyle(calloutFormFontFamily),
                        }}
                        className="relative z-20 px-2.5 py-1 rounded bg-zinc-950 border border-sky-400 text-sky-200 font-bold shadow-lg pointer-events-none whitespace-nowrap text-center leading-tight transition-transform duration-75"
                      >
                        {calloutFormName.includes('\n') ? (
                          calloutFormName.split('\n').slice(0, 2).map((l, i) => (
                            <div key={i} className="whitespace-nowrap leading-tight">{l || '\u00A0'}</div>
                          ))
                        ) : (
                          <span>{calloutFormName.trim() || 'Schriftfeld'}</span>
                        )}
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
                <div className="min-h-[44px] py-2 px-3 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                  <div
                    style={{
                      transform: `rotate(${calloutFormTextRotation}deg)`,
                      fontSize: `${calloutFormFontSize}px`,
                      fontFamily: getFontFamilyStyle(calloutFormFontFamily),
                    }}
                    className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-700 text-white font-bold transition-all whitespace-nowrap text-center leading-tight"
                  >
                    {calloutFormName.includes('\n') ? (
                      calloutFormName.split('\n').slice(0, 2).map((l, i) => (
                        <div key={i} className="whitespace-nowrap leading-tight">{l || '\u00A0'}</div>
                      ))
                    ) : (
                      <span>{calloutFormName.trim() || 'Vorschau-Callout'}</span>
                    )}
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
                      setCalloutFormCustomImage('ct.png');
                      setCalloutFormDisplayMode((prev) => prev === 'text' ? 'image' : prev);
                      setCalloutFormHidePin(false);
                    } else if (newZone === 't_spawn') {
                      setCalloutFormCustomImage('T.png');
                      setCalloutFormDisplayMode((prev) => prev === 'text' ? 'image' : prev);
                      setCalloutFormHidePin(false);
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
          setDrawings(loadedState.drawings || []);
          setUtilities(loadedState.utilities || []);
          setPlayers(loadedState.players || []);
          const stateWithLayers = loadedState as { layers?: TacticLayer[] };
          if (stateWithLayers.layers && stateWithLayers.layers.length > 0) {
            setLayers(stateWithLayers.layers);
          }
          setSelectedElementIds([]);
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
                  setSelectedCallout(null);
                  setSelectedCalloutIds([]);
                  setHighlightedCalloutId(undefined);
                  setContextMenu(null);
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
                      ? 'Schaltet alle Callouts auf der Karte in den Bearbeitungsmodus.'
                      : 'Switches all callouts on the map into edit mode.'}
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
                        ? 'Wähle ein Callout aus. Alle anderen werden ausgeblendet.'
                        : 'Select a callout. All others will be hidden.'}
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
                      ? 'Füge ein neuen Callout / Bereich auf der Karte hinzu.'
                      : 'Add a new callout / area to the map.'}
                  </p>
                </div>
              </button>

              {/* OPTION 4: MEINE CALLOUT AUSWAHL */}
              <button
                type="button"
                onClick={handleOpenCustomSelectionModal}
                className="w-full text-left p-4 rounded-xl bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-indigo-500/60 transition-all group cursor-pointer flex items-start gap-3.5"
              >
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                  <ListFilter className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-extrabold text-sm text-white group-hover:text-indigo-300 transition-colors">
                      {isDe ? '4. Meine Callout Auswahl' : '4. My Callout Selection'}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      {customSelectedCalloutIds.length > 0
                        ? `${customSelectedCalloutIds.length} ausgewählt`
                        : (isDe ? 'Auswahl' : 'Select')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {isDe
                      ? 'Wähle aus welche Callouts du angezeigt haben möchtest.'
                      : 'Choose which callouts you want to display.'}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEINE CALLOUT AUSWAHL MODAL (DESKTOP SPLIT VIEW & MOBILE TABS) */}
      {isCustomSelectionModalOpen && (
        <div
          data-no-map-click="true"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setIsCustomSelectionModalOpen(false)}
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
                      {tempSelectedCalloutIds.length} / {mapData.callouts.length}
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
                onClick={() => setIsCustomSelectionModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Tab Switcher (< md screens) */}
            <div className="flex md:hidden items-center p-1 rounded-xl bg-zinc-950 border border-zinc-800 mb-3 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setCustomSelectionTab('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  customSelectionTab === 'all'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>{isDe ? 'Alle Callouts' : 'All Callouts'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 font-mono">
                  {mapData.callouts.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCustomSelectionTab('selected')}
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
                {/* LEFT COLUMN: ALLE CALLOUTS (links bleiben immer alle erhalten) */}
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
                        ({mapData.callouts.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = mapData.callouts.map((c) => c.id);
                          setTempSelectedCalloutIds(allIds);
                        }}
                        className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        {isDe ? 'Alle hinzufügen' : 'Add all'}
                      </button>
                    </div>
                  </div>

                  {/* Search filter for all callouts */}
                  <div className="relative mb-2.5 shrink-0">
                    <input
                      type="text"
                      value={customSelectionSearch}
                      onChange={(e) => setCustomSelectionSearch(e.target.value)}
                      placeholder={isDe ? 'Callouts durchsuchen...' : 'Search callouts...'}
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-400"
                    />
                    <Crosshair className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                    {customSelectionSearch && (
                      <button
                        type="button"
                        onClick={() => setCustomSelectionSearch('')}
                        className="absolute right-2.5 top-2 text-zinc-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Scrollable list of all callouts */}
                  <div className="flex-1 overflow-y-auto max-h-[46vh] sm:max-h-[50vh] space-y-1.5 pr-1">
                    {mapData.callouts
                      .filter(
                        (c) =>
                          c.name.toLowerCase().includes(customSelectionSearch.toLowerCase()) ||
                          c.zone.toLowerCase().includes(customSelectionSearch.toLowerCase())
                      )
                      .map((c) => {
                        const isAdded = tempSelectedCalloutIds.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              if (isAdded) {
                                setTempSelectedCalloutIds((prev) => prev.filter((id) => id !== c.id));
                              } else {
                                setTempSelectedCalloutIds((prev) => [...prev, c.id]);
                              }
                            }}
                            className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isAdded
                                ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-100 hover:bg-indigo-950/60'
                                : 'bg-zinc-900/80 border-zinc-800 text-zinc-200 hover:bg-zinc-850 hover:border-zinc-700'
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
                                    setTempSelectedCalloutIds((prev) => prev.filter((id) => id !== c.id));
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
                                    setTempSelectedCalloutIds((prev) => [...prev, c.id]);
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

                    {mapData.callouts.filter(
                      (c) =>
                        c.name.toLowerCase().includes(customSelectionSearch.toLowerCase()) ||
                        c.zone.toLowerCase().includes(customSelectionSearch.toLowerCase())
                    ).length === 0 && (
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
                        onClick={() => setTempSelectedCalloutIds([])}
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
                        onClick={() => {
                          const allIds = mapData.callouts.map((c) => c.id);
                          setTempSelectedCalloutIds(allIds);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 text-xs font-bold transition-colors cursor-pointer"
                      >
                        {isDe ? 'Alle Callouts übernehmen' : 'Add all callouts'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto max-h-[50vh] sm:max-h-[55vh] space-y-1.5 pr-1">
                      {tempSelectedCalloutIds.map((id) => {
                        const callout = mapData.callouts.find((c) => c.id === id);
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
                              onClick={() => setTempSelectedCalloutIds((prev) => prev.filter((item) => item !== id))}
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
                  ? `von ${mapData.callouts.length} Callouts in deiner Auswahl`
                  : `of ${mapData.callouts.length} callouts selected`}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsCustomSelectionModalOpen(false)}
                  className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                >
                  {isDe ? 'Abbrechen' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCustomSelection(tempSelectedCalloutIds, true)}
                  className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isDe ? 'Auswahl anwenden & anzeigen' : 'Apply & Show Selection'}</span>
                </button>
              </div>
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
          drawings:
            previewSnapshot?.drawings && previewSnapshot.drawings.length > 0
              ? previewSnapshot.drawings
              : drawings,
          utilities:
            previewSnapshot?.utilities && previewSnapshot.utilities.length > 0
              ? previewSnapshot.utilities
              : utilities,
          players:
            previewSnapshot?.players && previewSnapshot.players.length > 0
              ? previewSnapshot.players
              : players,
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
