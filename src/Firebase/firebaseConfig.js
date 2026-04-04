// ─── Production Config — Hisar (commented for now) ───────────────────────────
/*
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
  dbPath:              `${HISAR_CONFIG.databaseURL}/`,
  empCode:             'HIS',
  storagePath:         'gs://dtdnavigator.appspot.com/Hisar',
  firebaseStoragePath: 'https://firebasestorage.googleapis.com/v0/b/dtdnavigator.appspot.com/o/',
  apiKey:              HISAR_CONFIG.apiKey,
  appId:               HISAR_CONFIG.appId,
  authDomain:          HISAR_CONFIG.authDomain,
  databaseURL:         HISAR_CONFIG.databaseURL,
  projectId:           HISAR_CONFIG.projectId,
  storageBucket:       HISAR_CONFIG.storageBucket,
  messagingSenderId:   HISAR_CONFIG.messagingSenderId,
  databaseName:        'dtdhisar',
  isUCCApplied:        'no',
};
*/

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
  dbPath:              `${DEVTEST_CONFIG.databaseURL}/`,
  empCode:             'DEV',
  storagePath:         'gs://devtest-62768.firebasestorage.app/DevTest',
  firebaseStoragePath: 'https://firebasestorage.googleapis.com/v0/b/devtest-62768.firebasestorage.app/o/',
  apiKey:              DEVTEST_CONFIG.apiKey,
  appId:               DEVTEST_CONFIG.appId,
  authDomain:          DEVTEST_CONFIG.authDomain,
  databaseURL:         DEVTEST_CONFIG.databaseURL,
  projectId:           DEVTEST_CONFIG.projectId,
  storageBucket:       DEVTEST_CONFIG.storageBucket,
  messagingSenderId:   DEVTEST_CONFIG.messagingSenderId,
  databaseName:        'devtest-62768-default-rtdb',
  isUCCApplied:        'yes',
};

// ─── Manual Active Config Selection ───────────────────────────────────────────
// firebase config 1 -> DevTest
const FIREBASE_CONFIG_1 = DEVTEST_CONFIG;
const CITY_CONFIG_1 = DEVTEST_CITY;

// firebase config 2 -> Hisar (commented for now)
// const FIREBASE_CONFIG_2 = HISAR_CONFIG;
// const CITY_CONFIG_2 = HISAR_CITY;

// Keep only one ACTIVE config id uncommented at a time.
const ACTIVE_CONFIG = FIREBASE_CONFIG_1;
const ACTIVE_CITY = CITY_CONFIG_1;

export const CITY = ACTIVE_CITY;
export const FIREBASE_CONFIG = ACTIVE_CONFIG;
