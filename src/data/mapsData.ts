import { MapData } from '../types';
import backupJson from './defaultBackup.generated.json';

export const INITIAL_MAPS: MapData[] = (backupJson as any).maps || [];
export const INITIAL_BACKUP_EXPORTED_AT: string = (backupJson as any).exportedAt || '';
export const INITIAL_SETTINGS = (backupJson as any).settings || {
  theme: 'dark',
  lang: 'de',
  favorites: ['inferno', 'cache', 'ancient', 'dust2', 'nuke', 'train', 'anubis', 'cobblestone']
};
