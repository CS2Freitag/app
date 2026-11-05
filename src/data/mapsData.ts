import { MapData } from '../types';
import backupJson from '../../public/assets/aistudio/backup_12fb3ba1.json';

export const INITIAL_MAPS: MapData[] = (backupJson as any).maps || [];
export const INITIAL_SETTINGS = (backupJson as any).settings || {
  theme: 'dark',
  lang: 'de',
  favorites: ['inferno', 'cache', 'ancient', 'dust2', 'nuke', 'train', 'anubis']
};
