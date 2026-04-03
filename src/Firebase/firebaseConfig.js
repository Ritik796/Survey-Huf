import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// ─── Production Config — Hisar ────────────────────────────────────────────────
const HISAR_CONFIG = {
  apiKey:            'AIzaSyBGZ_IB4y5Ov1nuqIhWndGU8hfJadlE85I',
  authDomain:        'dtdnavigator.firebaseapp.com',
  databaseURL:       'https://dtdhisar.firebaseio.com',
  projectId:         'dtdnavigator',
  storageBucket:     'dtdnavigator.appspot.com',
  messagingSenderId: '381118272786',
  appId:             '1:381118272786:android:8580682aed749a06ec0fcb',
};

export const HISAR_CITY = {
  cityName:            'Hisar',
  city:                'hisar',
  key:                 'HISAR',
  empCode:             'HIS',
  storagePath:         'gs://dtdnavigator.appspot.com/Hisar',
  firebaseStoragePath: 'https://firebasestorage.googleapis.com/v0/b/dtdnavigator.appspot.com/o/',
  databaseName:        'dtdhisar',
  isUCCApplied:        'no',
};

// ─── Test Config — DevTest ────────────────────────────────────────────────────
const DEVTEST_CONFIG = {
  apiKey:            'AIzaSyBNHi7UP5nwqLnFU2tuKpArS1MhZDYsiLM',
  authDomain:        'devtest-62768.firebaseapp.com',
  databaseURL:       'https://devtest-62768-default-rtdb.firebaseio.com',
  projectId:         'devtest-62768',
  storageBucket:     'devtest-62768.firebasestorage.app',
  messagingSenderId: '799504409644',
  appId:             '1:799504409644:android:8ce294ed91867118cedd89',
};

export const DEVTEST_CITY = {
  cityName:            'DevTest',
  city:                'devtest',
  key:                 'MNZ',
  empCode:             'DEV',
  storagePath:         'gs://devtest-62768.firebasestorage.app/DevTest',
  firebaseStoragePath: 'https://firebasestorage.googleapis.com/v0/b/devtest-62768.firebasestorage.app/o/',
  databaseName:        'devtest-62768-default-rtdb',
  isUCCApplied:        'yes',
};

// ─── Active Config Switch ─────────────────────────────────────────────────────
// __DEV__ = true  → development build  → uses DevTest
// __DEV__ = false → release/production → uses Hisar
const ACTIVE_CONFIG = __DEV__ ? DEVTEST_CONFIG : HISAR_CONFIG;
export const CITY   = __DEV__ ? DEVTEST_CITY   : HISAR_CITY;
export const FIREBASE_CONFIG = ACTIVE_CONFIG;

// ─── Initialize Firebase ──────────────────────────────────────────────────────
let _db = null;

export const initFirebase = () => {
  const app = getApps().length > 0 ? getApp() : initializeApp(ACTIVE_CONFIG);
  _db = getDatabase(app);
  return _db;
};

export const getDB = () => {
  if (!_db) return initFirebase();
  return _db;
};
