export type Language = 'de' | 'en';
export type Theme = 'dark' | 'light';

export type ZoneType = 'a_site' | 'b_site' | 'mid' | 't_spawn' | 'ct_spawn' | 'other';
export type DangerLevel = 'high' | 'medium' | 'low';
export type ColorMode = 'zone' | 'danger';

export interface CalloutArea {
  x: number; // top-left x in percent (-50 to 50)
  y: number; // top-left y in percent (-50 to 50)
  width: number; // width in percent (0-100)
  height: number; // height in percent (0-100)
  customColor?: string;
  shape?: 'rect' | 'polygon';
  points?: { x: number; y: number }[]; // custom drawn vertices in percent (-50 to 50)
}

export type CalloutDisplayMode = 'text' | 'image' | 'both';
export type CalloutLevel = 'upper' | 'lower' | 'both';

export interface Callout {
  id: string;
  name: string; // Competitive English callout name (e.g., "Palace", "Banana")
  alternativeNames?: string[]; // e.g. ["Apps", "Apartments"]
  x: number; // percentage 0-100% on the radar map (pin position)
  y: number; // percentage 0-100% on the radar map (pin position)
  level?: CalloutLevel; // for multi-level maps: 'upper' (O), 'lower' (U), or 'both'
  rotation?: number; // rotation angle in degrees for the area box
  textRotation?: number; // rotation angle in degrees for the callout text label separately
  fontSize?: number; // custom font size in pixels (e.g. 6 to 24)
  fontFamily?: string; // custom font family ('mono' | 'rajdhani' | 'orbitron' | 'russo' | 'teko' | 'sans' | 'serif')
  displayMode?: CalloutDisplayMode; // 'text' | 'image' | 'both'
  customImage?: string; // image path or data URL (e.g. '/ct.png' or '/T.png')
  imageSize?: number; // image diameter/size in pixels (e.g. 16 to 96, default 36)
  hidePin?: boolean; // when true, hides the circular pin dot / emblem while keeping text label visible
  pinOffsetX?: number; // custom horizontal offset in px of the pin dot relative to the text label box (-50 to +50)
  pinOffsetY?: number; // custom vertical offset in px of the pin dot relative to the text label box (-50 to +50)
  area?: CalloutArea; // optional semi-transparent rectangular area like totalcsgo.com
  zone: ZoneType;
  danger: DangerLevel;
  descriptionDe: string;
  descriptionEn: string;
  tacticalTipDe: string;
  tacticalTipEn: string;
  commonAnglesDe: string;
  commonAnglesEn: string;
  isCustom?: boolean;
  groupId?: string;
  locked?: boolean;
}

export type MapCategory = 'active' | 'reserve' | 'wingman' | 'hostage' | 'community' | string;

export interface TacticLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0.1 to 1.0
  isExpanded?: boolean;
}

export interface TacticSnapshot {
  id: string;
  timestamp: number;
  label: string;
  changedCount: number;
  callouts: Callout[];
  drawings?: TacticalDrawingLine[];
  utilities?: UtilityMarker[];
  players?: PlayerToken[];
}

export interface TacticPreset {
  id: string;
  name: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  layers?: TacticLayer[];
}

export interface TacticalState {
  drawings: TacticalDrawingLine[];
  utilities: UtilityMarker[];
  players: PlayerToken[];
  layers?: TacticLayer[];
  presets?: TacticPreset[];
}

export interface MapData {
  id: string;
  name: string;
  slug: string;
  category: MapCategory;
  image: string; // path or base64 data URL
  lowerImage?: string; // for multi-level maps like Nuke, Vertigo, Train
  descriptionDe: string;
  descriptionEn: string;
  callouts: Callout[];
  isCustom?: boolean;
  updatedAt?: number;
  isCustomTactic?: boolean;
  baseMapId?: string;
  tacticData?: TacticalState;
}

export type UtilityType = 'smoke' | 'flash' | 'molotov' | 'he' | 'decoy';
export type UtilityThrowType = 'left' | 'right' | 'both' | 'jump' | 'run_jump';
export type UtilityPlacementMode = 'point' | 'throw';

export interface UtilityMarker {
  id: string;
  type: UtilityType;
  x: number;
  y: number;
  throwFrom?: { x: number; y: number };
  curveBend?: number;
  throwType?: UtilityThrowType;
  label?: string;
  layerId?: string;
  groupId?: string;
  locked?: boolean;
  opacity?: number;
}

export interface PlayerToken {
  id: string;
  side: 'ct' | 't';
  number: number;
  x: number;
  y: number;
  hasBomb?: boolean;
  layerId?: string;
  groupId?: string;
  locked?: boolean;
  opacity?: number;
}

export interface TacticalDrawingLine {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  hasArrow?: boolean;
  layerId?: string;
  groupId?: string;
  locked?: boolean;
  opacity?: number;
  label?: string;
}

export type TacticalTool = 'select' | 'marquee' | 'pen' | 'arrow' | 'eraser' | 'utility' | 'player';
