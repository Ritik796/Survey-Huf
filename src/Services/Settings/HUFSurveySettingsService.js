import AsyncStorage from '@react-native-async-storage/async-storage';
import { CITY } from '../../Firebase/firebaseConfig';

export const DEFAULT_HUF_SURVEY_SETTINGS = {
  survey: {
    requiredDistanceMeters: 30,
    maxAcceptableAccuracyMeters: 25,
  },
  map: {
    defaultRegion: {
      latitude: 28.6139,
      longitude: 77.2090,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    },
    locationAnimateRegion: {
      latitudeDelta: 0.0045,
      longitudeDelta: 0.0045,
      animateDuration: 450,
    },
    markerAnimateDuration: 800,
  },
  location: {
    watchPosition: {
      enableHighAccuracy: true,
      distanceFilter: 10,
      interval: 5000,
      fastestInterval: 3000,
      timeout: 15000,
      maximumAge: 2000,
    },
    getCurrentPosition: {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  },
  sync: {
    intervalMs: 20000,
  },
  messages: {
    survey: {
      missingFields: 'सभी जरूरी सर्वे स्टेप पूरे करें।',
      saveSuccess: 'Survey saved successfully!',
      saveFailed: 'Survey save failed',
    },
    location: {
      gpsUnavailable: 'GPS बंद है या उपलब्ध नहीं है। कृपया पुनः प्रयास करें।',
      gpsTurnOn: 'कृपया GPS / Location चालू करें।',
      accuracyLow: 'GPS accuracy कम है। पुनः प्रयास करें।',
      permissionDenied: 'Location permission denied. कृपया location अनुमति दें।',
      lineStartUnavailable: 'Line start point available नहीं है।',
    },
    distance: {
      outOfRange: 'आप अभी {{currentDistance}} मीटर दूर हैं। कृपया सर्वे के लिए {{requiredDistance}} मीटर की रेंज में आएँ।',
    },
    card: {
      duplicateCardTemplate: 'यह कार्ड <b>${cardNumber}</b> किसी ओर house पे पहले से ही लगा है',
    },
  },
};

const SETTINGS_FILE_NAME = 'HUFSurveySettings.json';
const SETTINGS_FOLDER = 'Settings';

const getCityName = (cityName) => String(cityName || CITY?.cityName || 'DevTest').trim();

const getCacheKey = (cityName) => `huf_survey_settings_cache_v1_${getCityName(cityName).toLowerCase()}`;

const getStorageBaseUrl = () => {
  const firebaseStoragePath = String(CITY?.firebaseStoragePath || '').trim();
  if (firebaseStoragePath) {
    return firebaseStoragePath.endsWith('/') ? firebaseStoragePath : `${firebaseStoragePath}/`;
  }
  const bucket = String(CITY?.storageBucket || '').trim();
  if (!bucket) return '';
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`;
};

export const buildHUFSurveySettingsStorageUrl = (cityName) => {
  const baseUrl = getStorageBaseUrl();
  const resolvedCity = getCityName(cityName);
  const objectPath = `${resolvedCity}/${SETTINGS_FOLDER}/${SETTINGS_FILE_NAME}`;
  const encodedPath = encodeURIComponent(objectPath);
  return `${baseUrl}${encodedPath}?alt=media`;
};

const isPlainObject = (val) => Boolean(val && typeof val === 'object' && !Array.isArray(val));

const mergeWithDefaults = (incoming) => {
  const defaults = DEFAULT_HUF_SURVEY_SETTINGS;
  if (!isPlainObject(incoming)) return defaults;
  return {
    ...defaults,
    ...incoming,
    survey: { ...defaults.survey, ...(incoming.survey || {}) },
    map: {
      ...defaults.map,
      ...(incoming.map || {}),
      defaultRegion: {
        ...defaults.map.defaultRegion,
        ...(incoming?.map?.defaultRegion || {}),
      },
      locationAnimateRegion: {
        ...defaults.map.locationAnimateRegion,
        ...(incoming?.map?.locationAnimateRegion || {}),
      },
    },
    location: {
      ...defaults.location,
      ...(incoming.location || {}),
      watchPosition: {
        ...defaults.location.watchPosition,
        ...(incoming?.location?.watchPosition || {}),
      },
      getCurrentPosition: {
        ...defaults.location.getCurrentPosition,
        ...(incoming?.location?.getCurrentPosition || {}),
      },
    },
    sync: { ...defaults.sync, ...(incoming.sync || {}) },
    messages: {
      ...defaults.messages,
      ...(incoming.messages || {}),
      survey: { ...defaults.messages.survey, ...(incoming?.messages?.survey || {}) },
      location: { ...defaults.messages.location, ...(incoming?.messages?.location || {}) },
      distance: { ...defaults.messages.distance, ...(incoming?.messages?.distance || {}) },
      card: { ...defaults.messages.card, ...(incoming?.messages?.card || {}) },
    },
  };
};

export const getCachedHUFSurveySettings = async (cityName) => {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(cityName));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return null;
  }
};

export const saveCachedHUFSurveySettings = async (cityName, settings) => {
  await AsyncStorage.setItem(getCacheKey(cityName), JSON.stringify(mergeWithDefaults(settings)));
};

export const fetchHUFSurveySettingsFromStorage = async (cityName) => {
  const url = buildHUFSurveySettingsStorageUrl(cityName);
  if (!url.startsWith('http')) {
    throw new Error('Invalid Firebase Storage URL');
  }
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Settings fetch failed (${response.status})`);
  }
  const json = await response.json();
  return mergeWithDefaults(json);
};

export const loadHUFSurveySettings = async ({ cityName, forceRefresh = false } = {}) => {
  const resolvedCity = getCityName(cityName);

  if (!forceRefresh) {
    const cached = await getCachedHUFSurveySettings(resolvedCity);
    if (cached) return cached;
  }

  try {
    const remote = await fetchHUFSurveySettingsFromStorage(resolvedCity);
    await saveCachedHUFSurveySettings(resolvedCity, remote);
    return remote;
  } catch {
    const cached = await getCachedHUFSurveySettings(resolvedCity);
    if (cached) return cached;
    return mergeWithDefaults(DEFAULT_HUF_SURVEY_SETTINGS);
  }
};
