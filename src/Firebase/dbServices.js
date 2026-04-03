import { ref, get, set, update } from 'firebase/database';
import { getDB } from './firebaseConfig';
import { getApp as getRNApp, getApps as getRNApps, initializeApp as initializeRNApp } from '@react-native-firebase/app';
import {
  getStorage as getRNStorage,
  ref as getRNStorageRef,
  putFile as putRNFile,
  getDownloadURL as getRNDownloadURL,
} from '@react-native-firebase/storage';
import { FIREBASE_CONFIG } from './firebaseConfig';

// ─── Get data from a Firebase path ───────────────────────────────────────────
export const getData = async (path) => {
  const db = getDB();
  const snapshot = await get(ref(db, path));
  return snapshot.exists() ? snapshot.val() : null;
};

// ─── Save (overwrite) data at a Firebase path ────────────────────────────────
export const saveData = async (path, data) => {
  const db = getDB();
  await set(ref(db, path), data);
};

// ─── Update (merge) data at a Firebase path ──────────────────────────────────
export const updateData = async (path, data) => {
  const db = getDB();
  await update(ref(db, path), data);
};

const ensureRNFirebaseDefaultApp = () => {
  const existingApps = getRNApps();
  if (existingApps.length > 0) return getRNApp();

  return initializeRNApp({
    apiKey: FIREBASE_CONFIG.apiKey,
    appId: FIREBASE_CONFIG.appId,
    projectId: FIREBASE_CONFIG.projectId,
    databaseURL: FIREBASE_CONFIG.databaseURL,
    storageBucket: FIREBASE_CONFIG.storageBucket,
    messagingSenderId: FIREBASE_CONFIG.messagingSenderId,
  });
};

export const uploadFileToStorage = async (storagePath, localFilePath) => {
  try {
    if (!storagePath || !localFilePath) {
      return { success: false, error: 'Missing storagePath/localFilePath' };
    }

    const rnApp = ensureRNFirebaseDefaultApp();
    const rawPath = String(localFilePath);
    const normalizedPath = rawPath.startsWith('file://') ? rawPath.slice(7) : rawPath;

    const storage = getRNStorage(rnApp);
    const fileRef = getRNStorageRef(storage, storagePath);
    try {
      await putRNFile(fileRef, normalizedPath, { contentType: 'image/jpeg' });
    } catch {
      await putRNFile(fileRef, rawPath, { contentType: 'image/jpeg' });
    }

    const directUrl = await getRNDownloadURL(fileRef);
    return { success: true, data: directUrl };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
};
