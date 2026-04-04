export const getRegionFromPoints = (points = [], defaultRegion) => {
  if (!Array.isArray(points) || points.length === 0) {
    return defaultRegion;
  }

  const latitudes = points.map((p) => p.latitude);
  const longitudes = points.map((p) => p.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.005),
    longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.005),
  };
};

export const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const radius = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatDistanceForDisplay = (metersRaw) => {
  const meters = Number(metersRaw);
  if (!Number.isFinite(meters) || meters < 0) return '0 मीटर';
  if (meters >= 1000) {
    const km = meters / 1000;
    const kmText = km >= 10 ? km.toFixed(1) : km.toFixed(2);
    return `${kmText.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')} किलो मीटर`;
  }
  return `${Math.round(meters)} मीटर`;
};

const getRangeSignature = (rangesRaw = []) => {
  if (!Array.isArray(rangesRaw) || rangesRaw.length === 0) return 'all';
  const cleaned = rangesRaw
    .map((r) => ({
      from: Number(r?.from),
      to: Number(r?.to),
    }))
    .filter((r) => Number.isFinite(r.from) && Number.isFinite(r.to))
    .sort((a, b) => (a.from - b.from) || (a.to - b.to));

  if (cleaned.length === 0) return 'all';
  return cleaned.map((r) => `${r.from}-${r.to}`).join('|');
};

export const buildLineRangeCacheKey = (lineId, ranges = []) => (
  `${String(lineId || '')}::${getRangeSignature(ranges)}`
);

export const getLineEndBearing = (points = []) => {
  if (!Array.isArray(points) || points.length < 2) {
    return 0;
  }

  const from = points[points.length - 2];
  const to = points[points.length - 1];
  const lat1 = (Number(from.latitude) * Math.PI) / 180;
  const lat2 = (Number(to.latitude) * Math.PI) / 180;
  const dLon = ((Number(to.longitude) - Number(from.longitude)) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return (bearing + 360) % 360;
};
