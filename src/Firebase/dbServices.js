import database from '@react-native-firebase/database';
import { getApp as getRNApp, getApps as getRNApps, initializeApp as initializeRNApp } from '@react-native-firebase/app';
import {
  getStorage as getRNStorage,
  ref as getRNStorageRef,
  putFile as putRNFile,
  getDownloadURL as getRNDownloadURL,
} from '@react-native-firebase/storage';
import { FIREBASE_CONFIG, CITY } from './firebaseConfig';

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
  ensureRNFirebaseDefaultApp();
  const snapshot = await database().ref(path).once('value');
  return snapshot.exists() ? snapshot.val() : null;
};

// ─── Save (overwrite) data at a Firebase path ────────────────────────────────
export const saveData = async (path, data) => {
  ensureRNFirebaseDefaultApp();
  await database().ref(path).set(data);
};

// ─── Update (merge) data at a Firebase path ──────────────────────────────────
export const updateData = async (path, data) => {
  ensureRNFirebaseDefaultApp();
  await database().ref(path).update(data);
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
