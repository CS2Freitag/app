import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, onSnapshot, serverTimestamp, Timestamp, getDocsFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { MapData, Theme, Language } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

export interface UserSyncData {
  theme: Theme;
  lang: Language;
  favorites: string[];
  updatedAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Recursively remove undefined values from objects/arrays for Firestore compatibility
export const sanitizeForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item));
  }
  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val);
    }
  }
  return clean;
};

// Sync user settings to Firestore
export const syncUserSettings = async (userId: string, data: Partial<UserSyncData>) => {
  const path = `users/${userId}`;
  try {
    const userDoc = doc(db, 'users', userId);
    const cleanData = sanitizeForFirestore(data);
    await setDoc(userDoc, {
      ...cleanData,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Sync a single map to Firestore
export const syncUserMap = async (userId: string, map: MapData, forceTimestamp?: number) => {
  const path = `users/${userId}/maps/${map.id}`;
  try {
    const mapDoc = doc(db, 'users', userId, 'maps', map.id);
    const ts = forceTimestamp || map.updatedAt || Date.now();
    const cleanMap = sanitizeForFirestore({
      ...map,
      updatedAt: ts,
    });
    await setDoc(mapDoc, {
      ...cleanMap,
      updatedAt: serverTimestamp(),
      updatedAtClient: ts,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Fetch a single map from Firestore with its normalized timestamp
export const getCloudMap = async (
  userId: string,
  mapId: string
): Promise<{ map: MapData | null; updatedAt: number }> => {
  const path = `users/${userId}/maps/${mapId}`;
  try {
    const mapDoc = doc(db, 'users', userId, 'maps', mapId);
    const snap = await getDoc(mapDoc);
    if (!snap.exists()) {
      return { map: null, updatedAt: 0 };
    }
    const data = snap.data();
    let ts = data.updatedAtClient || data.updatedAt;
    if (ts && typeof ts.toMillis === 'function') {
      ts = ts.toMillis();
    } else if (typeof ts === 'string') {
      ts = new Date(ts).getTime();
    }
    const mapData: MapData = {
      ...data,
      updatedAt: typeof ts === 'number' ? ts : (data.updatedAtClient || 0),
    } as MapData;
    return { map: mapData, updatedAt: mapData.updatedAt || 0 };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return { map: null, updatedAt: 0 };
  }
};

// Smart Merge: Merges local modifications on top of the newer cloud map
export const smartMergeMap = (localMap: MapData, cloudMap: MapData): MapData => {
  const merged: MapData = {
    ...cloudMap,
    name: localMap.name || cloudMap.name,
    category: localMap.category || cloudMap.category,
    descriptionDe: localMap.descriptionDe || cloudMap.descriptionDe,
    descriptionEn: localMap.descriptionEn || cloudMap.descriptionEn,
  };

  const cloudCalloutsMap = new Map<string, any>(cloudMap.callouts.map((c) => [c.id, c]));
  const mergedCallouts: any[] = [];
  const processedIds = new Set<string>();

  // 1. Add/update all local callouts (including edits, moves, new callouts)
  for (const localC of localMap.callouts) {
    processedIds.add(localC.id);
    mergedCallouts.push({ ...localC });
  }

  // 2. Keep any callouts present in the newer cloud map that were not present locally
  for (const cloudC of cloudMap.callouts) {
    if (!processedIds.has(cloudC.id)) {
      mergedCallouts.push({ ...cloudC });
    }
  }

  merged.callouts = mergedCallouts;

  // 3. Merge tacticData presets without losing local or cloud presets
  if (localMap.tacticData || cloudMap.tacticData) {
    const localPresets = localMap.tacticData?.presets || [];
    const cloudPresets = cloudMap.tacticData?.presets || [];
    const presetMap = new Map<string, any>();
    for (const p of cloudPresets) {
      if (p?.id) presetMap.set(p.id, p);
    }
    for (const p of localPresets) {
      if (p?.id) {
        const existing = presetMap.get(p.id);
        if (!existing || (p.updatedAt || 0) >= (existing.updatedAt || 0)) {
          presetMap.set(p.id, p);
        }
      }
    }
    const baseTactic = localMap.tacticData || cloudMap.tacticData!;
    merged.tacticData = {
      ...baseTactic,
      presets: Array.from(presetMap.values()),
    };
  }

  merged.updatedAt = Date.now();
  return merged;
};

// Delete a map from Firestore
export const deleteUserMapSync = async (userId: string, mapId: string) => {
  const path = `users/${userId}/maps/${mapId}`;
  try {
    const mapDoc = doc(db, 'users', userId, 'maps', mapId);
    await deleteDoc(mapDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// Load all data for a user with normalized timestamps
export const loadUserCloudData = async (userId: string) => {
  const path = `users/${userId}`;
  try {
    const timeout = 10000; // 10 seconds

    const loadData = async () => {
      const userDoc = doc(db, 'users', userId);
      const mapsCol = collection(db, 'users', userId, 'maps');

      const [userSnap, mapsSnap] = await Promise.all([
        getDoc(userDoc),
        getDocs(mapsCol),
      ]);

      const cloudMaps = mapsSnap.docs.map((d) => {
        const data = d.data();
        let ts = data.updatedAtClient || data.updatedAt;
        if (ts && typeof ts.toMillis === 'function') {
          ts = ts.toMillis();
        } else if (typeof ts === 'string') {
          ts = new Date(ts).getTime();
        }
        return {
          ...data,
          updatedAt: typeof ts === 'number' ? ts : (data.updatedAtClient || 0),
        } as MapData;
      });

      const cloudSettings = userSnap.exists() ? (userSnap.data() as UserSyncData) : null;

      return { cloudMaps, cloudSettings };
    };

    return await Promise.race([
      loadData(),
      new Promise<{ cloudMaps: MapData[]; cloudSettings: UserSyncData | null }>((_, reject) =>
        setTimeout(() => reject(new Error('Cloud load timed out')), timeout)
      ),
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return { cloudMaps: [], cloudSettings: null };
  }
};
