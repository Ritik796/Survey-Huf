import { Image } from 'react-native';
import { getUserDetails } from '../../utils/storage';
import { getHouseCardsByWardLine, getWardLineJson } from '../../Services/Map/mapServices';

const getNormalizedLineId = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeRange = (fromRaw, toRaw) => {
  const from = toNumber(fromRaw);
  const to = toNumber(toRaw);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return from <= to ? { from, to } : { from: to, to: from };
};

const parseRangesFromString = (textRaw) => {
  const text = String(textRaw || '').trim();
  if (!text) return [];

  const matches = [...text.matchAll(/(\d+)\s*-\s*(\d+)/g)];
  return matches.map((m) => normalizeRange(m[1], m[2])).filter(Boolean);
};

const collectCardRanges = (descriptor) => {
  if (!descriptor) return [];
  if (Array.isArray(descriptor)) {
    return descriptor.flatMap((item) => collectCardRanges(item));
  }
  if (typeof descriptor === 'string') {
    return parseRangesFromString(descriptor);
  }
  if (typeof descriptor !== 'object') {
    return [];
  }

  const tupleRange = normalizeRange(
    descriptor.from ?? descriptor.start ?? descriptor.cardFrom ?? descriptor.fromCard ?? descriptor.houseFrom,
    descriptor.to ?? descriptor.end ?? descriptor.cardTo ?? descriptor.toCard ?? descriptor.houseTo,
  );

  const nestedRanges = [
    descriptor.range,
    descriptor.ranges,
    descriptor.cardRange,
    descriptor.cardRanges,
    descriptor.houseRange,
  ].flatMap((item) => collectCardRanges(item));

  return [
    ...(tupleRange ? [tupleRange] : []),
    ...nestedRanges,
  ];
};

const pushUniqueLineIds = (target, lineIdRaw) => {
  const lineId = getNormalizedLineId(lineIdRaw);
  if (!lineId) return;
  if (!target.includes(lineId)) {
    target.push(lineId);
  }
};

const parseAssignmentFromString = (assignedLineRaw) => {
  const assignedLineIds = [];
  const lineCardRanges = {};

  const tokens = String(assignedLineRaw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  tokens.forEach((token) => {
    const lineRangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (lineRangeMatch) {
      const lineRange = normalizeRange(lineRangeMatch[1], lineRangeMatch[2]);
      if (lineRange) {
        for (let i = lineRange.from; i <= lineRange.to; i += 1) {
          pushUniqueLineIds(assignedLineIds, String(i));
        }
      }
      return;
    }

    const tokenWithDelimiter = token.match(/^(\d+)\s*[:|/]\s*(.+)$/);
    if (tokenWithDelimiter) {
      const lineId = getNormalizedLineId(tokenWithDelimiter[1]);
      const ranges = parseRangesFromString(tokenWithDelimiter[2]);
      pushUniqueLineIds(assignedLineIds, lineId);
      if (lineId && ranges.length) {
        lineCardRanges[lineId] = [...(lineCardRanges[lineId] || []), ...ranges];
      }
      return;
    }

    const tokenWithBrackets = token.match(/^(\d+)\s*[([]\s*([^)\]]+)\s*[)\]]$/);
    if (tokenWithBrackets) {
      const lineId = getNormalizedLineId(tokenWithBrackets[1]);
      const ranges = parseRangesFromString(tokenWithBrackets[2]);
      pushUniqueLineIds(assignedLineIds, lineId);
      if (lineId && ranges.length) {
        lineCardRanges[lineId] = [...(lineCardRanges[lineId] || []), ...ranges];
      }
      return;
    }

    pushUniqueLineIds(assignedLineIds, token);
  });

  return {
    assignedLineIds,
    lineCardRanges,
  };
};

const parseAssignedLineMeta = (assignmentRaw) => {
  if (!assignmentRaw) {
    return {
      assignedLineIds: [],
      lineCardRanges: {},
    };
  }

  if (typeof assignmentRaw === 'string') {
    return parseAssignmentFromString(assignmentRaw);
  }

  if (Array.isArray(assignmentRaw)) {
    const assignedLineIds = [];
    const lineCardRanges = {};

    assignmentRaw.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        const lineId = getNormalizedLineId(entry.lineId ?? entry.line ?? entry.id ?? entry.lineNumber);
        const ranges = collectCardRanges(entry);
        if (lineId) {
          pushUniqueLineIds(assignedLineIds, lineId);
          if (ranges.length) {
            lineCardRanges[lineId] = [...(lineCardRanges[lineId] || []), ...ranges];
          }
        }
      } else {
        const parsed = parseAssignmentFromString(entry);
        parsed.assignedLineIds.forEach((lineId) => pushUniqueLineIds(assignedLineIds, lineId));
        Object.entries(parsed.lineCardRanges).forEach(([lineId, ranges]) => {
          lineCardRanges[lineId] = [...(lineCardRanges[lineId] || []), ...ranges];
        });
      }
    });

    return { assignedLineIds, lineCardRanges };
  }

  if (typeof assignmentRaw === 'object') {
    const assignedLineIds = [];
    const lineCardRanges = {};

    Object.entries(assignmentRaw).forEach(([lineKey, descriptor]) => {
      const lineId = getNormalizedLineId(lineKey);
      if (!lineId) return;
      pushUniqueLineIds(assignedLineIds, lineId);
      const ranges = collectCardRanges(descriptor);
      if (ranges.length) {
        lineCardRanges[lineId] = [...(lineCardRanges[lineId] || []), ...ranges];
      }
    });

    return { assignedLineIds, lineCardRanges };
  }

  return {
    assignedLineIds: [],
    lineCardRanges: {},
  };
};

const parseAssignedLineIds = (assignedLineRaw) => {
  const { assignedLineIds } = parseAssignedLineMeta(assignedLineRaw);
  return assignedLineIds;
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
  const { lineCardRanges } = parseAssignedLineMeta(user?.line);

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
    lineCardRanges,
    initialLineIndex: 0,
  };
};

const parseHouseCardNumericValue = (house) => {
  const match = String(house?.number || house?.id || '').match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

const filterHousesByCardRanges = (houses = [], ranges = []) => {
  if (!Array.isArray(ranges) || ranges.length === 0) return houses;

  return houses.filter((house) => {
    const cardNo = parseHouseCardNumericValue(house);
    if (!Number.isFinite(cardNo)) return true;

    return ranges.some((range) => (
      Number.isFinite(range?.from)
      && Number.isFinite(range?.to)
      && cardNo >= range.from
      && cardNo <= range.to
    ));
  });
};

export const loadLineHousesAction = async ({ ward, lineId, lineCardRanges = [] }) => {
  const hasLineId = lineId !== null && lineId !== undefined && String(lineId).trim() !== '';
  if (!ward || !hasLineId) {
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
  const filteredHouses = filterHousesByCardRanges(houses, lineCardRanges);
  filteredHouses.forEach((house) => {
    if (house.referenceImageUri) {
      Image.prefetch(house.referenceImageUri);
    }
  });

  return {
    ok: true,
    houses: filteredHouses,
  };
};






