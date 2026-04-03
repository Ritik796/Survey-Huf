import { Image } from 'react-native';
import { getUserDetails } from '../../utils/storage';
import { getHouseCardsByWardLine, getWardLineJson } from '../../Services/Map/mapServices';

const parseAssignedLineIds = (assignedLineRaw) => {
  if (!assignedLineRaw) return [];

  const rawList = Array.isArray(assignedLineRaw)
    ? assignedLineRaw
    : String(assignedLineRaw).split(',');

  const normalized = rawList
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);

  return [...new Set(normalized)];
};

const filterWardLinesByAssignment = (wardLines = [], assignedLineIds = []) => {
  if (!Array.isArray(wardLines)) return [];
  if (!assignedLineIds.length) return wardLines;

  const lineById = new Map(wardLines.map((line) => [String(line.id), line]));
  return assignedLineIds
    .map((lineId) => lineById.get(String(lineId)))
    .filter(Boolean);
};

const mapHouseCards = (cards = []) => cards.map((item) => ({
  id: item.id || item.cardNumber || `${item.name || 'house'}_${item.houseType || 'na'}`,
  number: item.cardNumber || '',
  cardType: item.cardType || '',
  name: item.name || '',
  houseType: item.houseType || '',
  hufRfidNumber: item.hufRfidNumber || '',
  referenceImageUri: item.houseImage || null,
  latitude: item.latlng?.latitude ?? null,
  longitude: item.latlng?.longitude ?? null,
}));

export const loadWardLinesAction = async () => {
  const user = await getUserDetails();
  const ward = user?.ward || user?.zone || '';
  const zone = user?.ward || user?.zone || '';
  const assignedLineIds = parseAssignedLineIds(user?.line);

  const resp = await getWardLineJson(zone);
  if (!resp.ok || !Array.isArray(resp.data)) {
    return {
      ok: false,
      ward,
      wardLines: [],
      initialLineIndex: 0,
    };
  }

  const filteredWardLines = filterWardLinesByAssignment(resp.data, assignedLineIds);

  return {
    ok: true,
    ward,
    wardLines: filteredWardLines,
    initialLineIndex: 0,
  };
};

export const loadLineHousesAction = async ({ ward, lineId }) => {
  if (!ward || !lineId) {
    return {
      ok: true,
      houses: [],
    };
  }

  const resp = await getHouseCardsByWardLine({ ward, line: lineId });
  if (!resp.ok || !Array.isArray(resp.data)) {
    return {
      ok: false,
      houses: [],
    };
  }

  const houses = mapHouseCards(resp.data);
  houses.forEach((house) => {
    if (house.referenceImageUri) {
      Image.prefetch(house.referenceImageUri);
    }
  });

  return {
    ok: true,
    houses,
  };
};

