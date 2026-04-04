import { FIREBASE_CONFIG } from './firebaseConfig';

// ─── Lazy app cache ───────────────────────────────────────────────────────────
let _rnApp = null;

const ensureApp = () => {
  if (_rnApp) return _rnApp;
  const { getApp, getApps, initializeApp } = require('@react-native-firebase/app');
  const existing = getApps();
  if (existing.length > 0) {
    _rnApp = getApp();
  } else {
    _rnApp = initializeApp({
      apiKey:            FIREBASE_CONFIG.apiKey,
      appId:             FIREBASE_CONFIG.appId,
      projectId:         FIREBASE_CONFIG.projectId,
      databaseURL:       FIREBASE_CONFIG.databaseURL,
      storageBucket:     FIREBASE_CONFIG.storageBucket,
      messagingSenderId: FIREBASE_CONFIG.messagingSenderId,
    });
  }
  return _rnApp;
};

// ─── Get data from a Firebase path ───────────────────────────────────────────
export const getData = async (path) => {
  const { getDatabase } = require('@react-native-firebase/database');
  const snapshot = await getDatabase(ensureApp()).ref(path).once('value');
  return snapshot.exists() ? snapshot.val() : null;
};

// ─── Save (overwrite) data at a Firebase path ────────────────────────────────
export const saveData = async (path, data) => {
  const { getDatabase } = require('@react-native-firebase/database');
  await getDatabase(ensureApp()).ref(path).set(data);
};

// ─── Update (merge) data at a Firebase path ──────────────────────────────────
export const updateData = async (path, data) => {
  const { getDatabase } = require('@react-native-firebase/database');
  await getDatabase(ensureApp()).ref(path).update(data);
};

// ─── Upload file to Firebase Storage ─────────────────────────────────────────
export const uploadFileToStorage = async (storagePath, localFilePath) => {
  try {
    if (!storagePath || !localFilePath) {
      return { success: false, error: 'Missing storagePath/localFilePath' };
    }

    const { getStorage } = require('@react-native-firebase/storage');
    const rawPath = String(localFilePath);
    const normalizedPath = rawPath.startsWith('file://') ? rawPath.slice(7) : rawPath;

    const fileRef = getStorage(ensureApp()).ref(storagePath);
    try {
      await fileRef.putFile(normalizedPath, { contentType: 'image/jpeg' });
    } catch {
      await fileRef.putFile(rawPath, { contentType: 'image/jpeg' });
    }

    const directUrl = await fileRef.getDownloadURL();
    return { success: true, data: directUrl };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
};
