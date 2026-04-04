import { getApp as getRNApp, getApps as getRNApps, initializeApp as initializeRNApp } from '@react-native-firebase/app';
import { getDatabase, ref, get, set, update } from '@react-native-firebase/database';
import {
  getStorage as getRNStorage,
  ref as getRNStorageRef,
  putFile as putRNFile,
  getDownloadURL as getRNDownloadURL,
} from '@react-native-firebase/storage';
import { FIREBASE_CONFIG } from './firebaseConfig';

// ─── Ensure native Firebase app is initialized ────────────────────────────────
const ensureRNFirebaseDefaultApp = () => {
  const existingApps = getRNApps();
  if (existingApps.length > 0) return getRNApp();
  return initializeRNApp({
    apiKey:            FIREBASE_CONFIG.apiKey,
    appId:             FIREBASE_CONFIG.appId,
    projectId:         FIREBASE_CONFIG.projectId,
    databaseURL:       FIREBASE_CONFIG.databaseURL,
    storageBucket:     FIREBASE_CONFIG.storageBucket,
    messagingSenderId: FIREBASE_CONFIG.messagingSenderId,
  });
};

// ─── Get data from a Firebase path ───────────────────────────────────────────
export const getData = async (path) => {
  const app = ensureRNFirebaseDefaultApp();
  const db = getDatabase(app);
  const snapshot = await get(ref(db, path));
  return snapshot.exists() ? snapshot.val() : null;
};

// ─── Save (overwrite) data at a Firebase path ────────────────────────────────
export const saveData = async (path, data) => {
  const app = ensureRNFirebaseDefaultApp();
  const db = getDatabase(app);
  await set(ref(db, path), data);
};

// ─── Update (merge) data at a Firebase path ──────────────────────────────────
export const updateData = async (path, data) => {
  const app = ensureRNFirebaseDefaultApp();
  const db = getDatabase(app);
  await update(ref(db, path), data);
};

// ─── Upload file to Firebase Storage ─────────────────────────────────────────
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
