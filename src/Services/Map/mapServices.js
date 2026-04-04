import AsyncStorage from '@react-native-async-storage/async-storage';
import { CITY } from '../../Firebase/firebaseConfig';
import { getData } from '../../Firebase/dbServices';

// ── Session-level in-memory house cache ───────────────────────────────────────
// Survives navigation (component mount/unmount) but resets when app is killed.
const _housesSessionCache = {};
const _houseSessionKey = (ward, line) => `${ward}_${line}`;

const isValidPoint = (point) => (
  Array.isArray(point)
  && point.length >= 2
  && Number.isFinite(Number(point[0]))
  && Number.isFinite(Number(point[1]))
);

const normalizeWardLines = (rawData) => {
  if (!rawData || typeof rawData !== 'object') {
    return [];
  }

  return Object.entries(rawData)
    .filter(([, value]) => value && typeof value === 'object' && Array.isArray(value.points))
    .map(([lineId, value]) => ({
      id: String(lineId),
      lineLength: Number(value.lineLength) || 0,
      houses: Array.isArray(value.Houses) ? value.Houses : [],
      points: value.points
        .filter(isValidPoint)
        .map(([latitude, longitude]) => ({
          latitude: Number(latitude),
          longitude: Number(longitude),
        })),
    }))
    .filter((line) => line.points.length > 1)
    .sort((a, b) => Number(a.id) - Number(b.id));
};

const buildStorageUrl = (zone, fileName) => {
  const storagePath = `${CITY.cityName}/WardLinesHouseJson/${zone}/${fileName}`;
  return `${CITY.firebaseStoragePath}${encodeURIComponent(storagePath)}?alt=media`;
};

const buildSurveyHouseImageUrl = (fileName) => {
  if (!fileName) return null;
  const storagePath = `${CITY.cityName}/SurveyHouseImage/${fileName}`;
  return `${CITY.firebaseStoragePath}${encodeURIComponent(storagePath)}?alt=media`;
};

const parseLatLng = (latLngRaw) => {
  if (!latLngRaw) return null;
  const raw = String(latLngRaw).trim().replace(/[()]/g, '');
  const [latText, lngText] = raw.split(',');
  const latitude = Number(latText);
  const longitude = Number(lngText);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const parseHistoryDate = (historyPayload) => {
  const historyList = Array.isArray(historyPayload)
    ? historyPayload
    : (historyPayload && typeof historyPayload === 'object' ? Object.values(historyPayload) : []);

  const cleanedDates = historyList
    .filter((item) => item !== null && item !== undefined && item !== '')
    .map((item) => String(item).trim());

  return cleanedDates.length > 0 ? cleanedDates[cleanedDates.length - 1] : null;
};

const getCachedWardLines = async (zone) => {
  const cacheKey = `ward_lines_${zone}`;
  const dateKey = `ward_lines_last_date_${zone}`;
  const [cachedLinesRaw, cachedDateRaw] = await Promise.all([
    AsyncStorage.getItem(cacheKey),
    AsyncStorage.getItem(dateKey),
  ]);

  let cachedLines = [];
  try {
    cachedLines = cachedLinesRaw ? JSON.parse(cachedLinesRaw) : [];
  } catch (err) {
    cachedLines = [];
  }

  return {
    cacheKey,
    dateKey,
    cachedDate: cachedDateRaw || null,
    cachedLines: Array.isArray(cachedLines) ? cachedLines : [],
  };
};

const saveWardLinesCache = async ({ cacheKey, dateKey, latestDate, lines }) => {
  await Promise.all([
    AsyncStorage.setItem(cacheKey, JSON.stringify(lines)),
    AsyncStorage.setItem(dateKey, latestDate),
  ]);
};

export const getWardLineJson = async (zone) => {
  if (!zone) {
    return {
      ok: false,
      message: 'Invalid zone',
      data: [],
      latestDate: null,
      fromCache: false,
    };
  }

  const { cacheKey, dateKey, cachedDate, cachedLines } = await getCachedWardLines(zone);

  try {
    const historyResp = await fetch(buildStorageUrl(zone, 'mapUpdateHistoryJson.json'));
    if (!historyResp.ok) {
      throw new Error(`History fetch failed (${historyResp.status})`);
    }

    const historyPayload = await historyResp.json();
    const latestDate = parseHistoryDate(historyPayload);

    if (!latestDate) {
      return {
        ok: cachedLines.length > 0,
        message: cachedLines.length > 0 ? 'No history date found, using cached lines' : 'No map update history found',
        data: cachedLines,
        latestDate: cachedDate,
        fromCache: cachedLines.length > 0,
      };
    }

    if (cachedDate === latestDate && cachedLines.length > 0) {
      return {
        ok: true,
        message: 'Success (Cached)',
        data: cachedLines,
        latestDate,
        fromCache: true,
      };
    }

    const linesResp = await fetch(buildStorageUrl(zone, `${latestDate}.json`));
    if (!linesResp.ok) {
      throw new Error(`Line data fetch failed (${linesResp.status})`);
    }

    const linePayload = await linesResp.json();
    const normalizedLines = normalizeWardLines(linePayload);

    if (normalizedLines.length === 0) {
      return {
        ok: false,
        message: 'Ward line data format invalid',
        data: [],
        latestDate,
        fromCache: false,
      };
    }

    await saveWardLinesCache({
      cacheKey,
      dateKey,
      latestDate,
      lines: normalizedLines,
    });

    return {
      ok: true,
      message: 'Success',
      data: normalizedLines,
      latestDate,
      fromCache: false,
    };
  } catch (error) {
    if (cachedLines.length > 0) {
      return {
        ok: true,
        message: 'Network failed, using cached lines',
        data: cachedLines,
        latestDate: cachedDate,
        fromCache: true,
      };
    }

    return {
      ok: false,
      message: 'Unable to load ward lines',
      data: [],
      latestDate: null,
      fromCache: false,
      error: error?.message || String(error),
    };
  }
};

export const updateHouseInSessionCache = (ward, line, cardId, updatedFields) => {
  const key = _houseSessionKey(ward, line);
  if (!_housesSessionCache[key]) return;
  _housesSessionCache[key] = _housesSessionCache[key].map((house) =>
    String(house.id) === String(cardId) ? { ...house, ...updatedFields } : house
  );
};

export const getHouseCardsByWardLine = async ({ ward, line }) => {
  if (!ward || line === null || line === undefined || line === '') {
    return {
      ok: false,
      message: 'Invalid ward/line params',
      data: [],
    };
  }

  // Return from session cache immediately if available
  const sessionKey = _houseSessionKey(ward, line);
  if (_housesSessionCache[sessionKey]) {
    return {
      ok: true,
      message: 'Success (Session Cache)',
      data: _housesSessionCache[sessionKey],
      fromCache: true,
    };
  }

  try {
    const housesPath = `Houses/${ward}/${line}`;
    const housesPayload = await getData(housesPath);

    if (!housesPayload || typeof housesPayload !== 'object') {
      return {
        ok: true,
        message: 'No houses found',
        data: [],
        fromCache: false,
      };
    }

    const cards = Object.entries(housesPayload)
      .filter(([, value]) => value && typeof value === 'object')
      .map(([cardKey, value]) => ({
        id: String(cardKey),
        cardNumber: value.cardNo || cardKey || '',
        cardType: value.cardType || '',
        houseImage: buildSurveyHouseImageUrl(value.houseImage),
        name: value.name || '',
        latlng: parseLatLng(value.latLng),
        houseType: value.houseType || '',
        hufRfidNumber: value.hufRfidNumber || '',
      }));

    _housesSessionCache[sessionKey] = cards;

    return {
      ok: true,
      message: 'Success',
      data: cards,
      fromCache: false,
    };
  } catch (error) {
    return {
      ok: false,
      message: 'Unable to load house cards',
      data: [],
      fromCache: false,
      error: error?.message || String(error),
    };
  }
};
