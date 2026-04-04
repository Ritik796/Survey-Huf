import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CITY } from '../../Firebase/firebaseConfig';
import { getData, saveData, updateData, uploadFileToStorage } from '../../Firebase/dbServices';

const MAX_IMAGE_SIZE_BYTES = 50 * 1024; // 50KB
const DEFAULT_LAT_LNG = '0,0';
const SURVEY_SAVE_LOG = (...args) => console.log('[SurveySaveService]', ...args);
const IMAGE_UPLOAD_QUEUE_KEY = 'survey_image_upload_queue_v1';

const normalizeFilePath = (uri = '') => (
  uri.startsWith('file://') ? uri.replace('file://', '') : uri
);

const ensureFileUri = (uri = '') => (
  uri.startsWith('file://') ? uri : `file://${uri}`
);

const toDateTimeString = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
};

const sanitizePathPart = (value) => String(value ?? '')
  .trim()
  .replace(/[.#$/[\]]/g, '_')
  .replace(/\s+/g, '_');

const resolveCardMappingPath = (scanCardNumber) => {
  const qrKey = sanitizePathPart(scanCardNumber);
  return `HUFCardData/CardMapping/${qrKey}`;
};

const getFileSizeInBytes = async (uri) => {
  const stat = await RNFS.stat(normalizeFilePath(uri));
  const fileSize = Number(stat?.size || 0);
  return Number.isFinite(fileSize) && fileSize > 0 ? fileSize : 0;
};

const resizeImageForUpload = async (photoUri, label) => {
  const originalUri = ensureFileUri(photoUri);
  const originalSize = await getFileSizeInBytes(originalUri);
  let resizedUri = null;
  let qualityUsed = 100;
  let finalUri = originalUri;
  let finalSize = originalSize;

  SURVEY_SAVE_LOG('resize:start', { label, inputUri: originalUri, sizeBytes: originalSize });

  try {
    let quality = 85;
    let resized = null;
    let resizedSize = originalSize;

    do {
      resized = await ImageResizer.createResizedImage(
        originalUri,
        800,
        800,
        'JPEG',
        quality,
        0,
        undefined,
        false,
        { mode: 'cover', onlyScaleDown: true }
      );
      resizedUri = ensureFileUri(resized?.uri || resized?.path || originalUri);
      resizedSize = await getFileSizeInBytes(resizedUri);
      finalUri = resizedUri;
      finalSize = resizedSize;
      qualityUsed = quality;

      SURVEY_SAVE_LOG('resize:attempt', {
        label,
        quality,
        outputUri: resizedUri,
        sizeBytes: resizedSize,
      });

      quality -= 10;
      if (quality < 30) break;
    } while (resizedSize > MAX_IMAGE_SIZE_BYTES);
  } catch (resizeErr) {
    SURVEY_SAVE_LOG('resize:error_fallback_original', { label, error: resizeErr?.message || resizeErr });
    resizedUri = null;
    finalUri = originalUri;
    finalSize = originalSize;
    qualityUsed = 100;
  }

  SURVEY_SAVE_LOG('resize:done', {
    label,
    originalSizeBytes: originalSize,
    finalSizeBytes: finalSize,
    qualityUsed,
    outputUri: finalUri,
    overLimit: finalSize > MAX_IMAGE_SIZE_BYTES,
  });

  return {
    uri: finalUri,
    sizeBytes: finalSize,
    originalSizeBytes: originalSize,
    resized: Boolean(resizedUri && resizedUri !== originalUri),
    qualityUsed,
    overLimit: finalSize > MAX_IMAGE_SIZE_BYTES,
    cleanupPath: resizedUri && resizedUri !== originalUri ? normalizeFilePath(resizedUri) : null,
  };
};

const getQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(IMAGE_UPLOAD_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveQueue = async (queue) => {
  await AsyncStorage.setItem(IMAGE_UPLOAD_QUEUE_KEY, JSON.stringify(queue));
};

const makeQueueId = ({ ward, lineNumber, cardNumber, scanCardNumber }) => (
  `${sanitizePathPart(ward)}__${sanitizePathPart(lineNumber)}__${sanitizePathPart(cardNumber)}__${sanitizePathPart(scanCardNumber)}`
);

const enqueuePendingUpload = async (payload) => {
  const queue = await getQueue();
  const item = {
    id: makeQueueId(payload),
    ward: payload.ward,
    lineNumber: payload.lineNumber,
    cardNumber: payload.cardNumber,
    scanCardNumber: payload.scanCardNumber,
    cardImageUri: payload.cardImageUri,
    houseImageUri: payload.houseImageUri,
    _at: toDateTimeString(),
  };
  const nextQueue = [item, ...queue.filter((q) => q.id !== item.id)];
  await saveQueue(nextQueue);
  SURVEY_SAVE_LOG('queue:enqueued', item);
  return item;
};

const uploadLocalImage = async ({ uri, storageRelativePath }) => {
  SURVEY_SAVE_LOG('upload:start', { storageRelativePath, sourceUri: uri });
  const localPath = normalizeFilePath(uri);
  const uploadRes = await uploadFileToStorage(storageRelativePath, localPath);
  if (!uploadRes?.success) {
    throw new Error(uploadRes?.error || 'Image upload failed');
  }
  SURVEY_SAVE_LOG('upload:done', { storageRelativePath });

  return {
    path: storageRelativePath,
    downloadUrl: uploadRes?.data || '',
  };
};

const buildStorageRelativePath = ({ ward, lineNumber, cardNumber, fileName }) => {
  const safeWard = sanitizePathPart(ward);
  const safeLine = sanitizePathPart(lineNumber);
  const safeCard = sanitizePathPart(cardNumber);
  return `${CITY.cityName}/HUFCardData/${safeWard}/${safeLine}/${safeCard}/${fileName}`;
};

const parseLatLngForSave = (latLng) => {
  if (!latLng) return DEFAULT_LAT_LNG;
  if (typeof latLng === 'string') return latLng.trim() || DEFAULT_LAT_LNG;
  if (typeof latLng === 'object' && latLng.latitude != null && latLng.longitude != null) {
    const latitude = Number(latLng.latitude);
    const longitude = Number(latLng.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return `${latitude},${longitude}`;
    }
  }
  return DEFAULT_LAT_LNG;
};

const uploadSurveyImages = async ({
  ward,
  lineNumber,
  cardNumber,
  scanCardNumber,
  cardImageUri,
  houseImageUri,
}) => {
  const safeCardNumber = sanitizePathPart(cardNumber);
  const cardImageName = `${sanitizePathPart(scanCardNumber)}.jpg`;
  const houseImageName = 'houseImg.jpg';

  const [cardPrepared, housePrepared] = await Promise.all([
    resizeImageForUpload(cardImageUri, 'Card image'),
    resizeImageForUpload(houseImageUri, 'House image'),
  ]);

  const cardImagePath = buildStorageRelativePath({
    ward,
    lineNumber,
    cardNumber: safeCardNumber,
    fileName: cardImageName,
  });

  const houseImagePath = buildStorageRelativePath({
    ward,
    lineNumber,
    cardNumber: safeCardNumber,
    fileName: houseImageName,
  });

  try {
    const [cardUpload, houseUpload] = await Promise.all([
      uploadLocalImage({
        uri: cardPrepared.uri,
        storageRelativePath: cardImagePath,
      }),
      uploadLocalImage({
        uri: housePrepared.uri,
        storageRelativePath: houseImagePath,
      }),
    ]);

    return {
      cardUpload,
      houseUpload,
      cardPrepared,
      housePrepared,
      cardImagePath,
      houseImagePath,
      cardImageName,
    };
  } finally {
    if (cardPrepared.cleanupPath) {
      RNFS.unlink(cardPrepared.cleanupPath).catch(() => {});
    }
    if (housePrepared.cleanupPath) {
      RNFS.unlink(housePrepared.cleanupPath).catch(() => {});
    }
  }
};

export const flushPendingSurveyImageUploads = async () => {
  const queue = await getQueue();
  if (!queue.length) {
    return { ok: true, synced: 0, pending: 0 };
  }

  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      await uploadSurveyImages(item);
      synced += 1;
      SURVEY_SAVE_LOG('queue:sync_success', { id: item.id });
    } catch (error) {
      remaining.push(item);
      SURVEY_SAVE_LOG('queue:sync_failed_keep', {
        id: item.id,
        error: error?.message || String(error),
      });
    }
  }

  await saveQueue(remaining);
  return {
    ok: true,
    synced,
    pending: remaining.length,
  };
};

export const validateScanCardMapping = async ({
  scanCardNumber,
  ward,
  lineNumber,
}) => {
  if (!scanCardNumber || !ward || !lineNumber) {
    return {
      ok: false,
      message: 'Missing required params for card mapping validation',
    };
  }

  try {
    const safeWard = sanitizePathPart(ward);
    const safeLine = sanitizePathPart(lineNumber);
    const mappingPath = resolveCardMappingPath(scanCardNumber);
    const existingMapping = await getData(mappingPath);

    if (existingMapping && typeof existingMapping === 'object') {
      const mappedWard = String(existingMapping?.ward || '').trim();
      const mappedLine = String(existingMapping?.line || existingMapping?.lineNumber || '').trim();

      if (
        mappedWard
        && mappedLine
        && (mappedWard !== safeWard || mappedLine !== safeLine)
      ) {
        return {
          ok: false,
          code: 'CARD_MAPPED_TO_OTHER_LINE_OR_WARD',
          message: `This card is already mapped to ward ${mappedWard}, line ${mappedLine}`,
          data: {
            mappedWard,
            mappedLine,
            mappingPath,
          },
        };
      }
    }

    return {
      ok: true,
      data: {
        mappingPath,
        existingMapping,
      },
    };
  } catch (error) {
    SURVEY_SAVE_LOG('validateScanCardMapping:error', error?.message || error, error);
    return {
      ok: false,
      message: error?.message || 'Unable to validate card mapping',
    };
  }
};

export const saveSurveyDetails = async ({
  ward,
  lineNumber,
  cardNumber,
  scanCardNumber,
  latLng,
  surveyorId,
  cardImageUri,
  houseImageUri,
}) => {
  SURVEY_SAVE_LOG('saveSurveyDetails:input', {
    ward,
    lineNumber,
    cardNumber,
    scanCardNumber,
    surveyorId,
    latLng,
    hasCardImageUri: Boolean(cardImageUri),
    hasHouseImageUri: Boolean(houseImageUri),
  });
  if (!ward || !lineNumber || !cardNumber || !scanCardNumber || !surveyorId || !cardImageUri || !houseImageUri) {
    SURVEY_SAVE_LOG('saveSurveyDetails:missing_required');
    return {
      ok: false,
      message: 'Missing required params',
    };
  }

  try {
    const qrKey = sanitizePathPart(scanCardNumber);
    const safeWard = sanitizePathPart(ward);
    const safeLine = sanitizePathPart(lineNumber);
    const safeCardNumber = sanitizePathPart(cardNumber);
    const cardMappingPath = resolveCardMappingPath(scanCardNumber);
    const dbPath = `HUFCardData/${safeWard}/${safeLine}/${safeCardNumber}/${qrKey}`;
    const houseCardPath = `Houses/${safeWard}/${safeLine}/${safeCardNumber}`;
    // const houseLinePath = `Houses/${safeWard}/${safeLine}`;
    // const lineCards = await getData(houseLinePath);

    // NOTE: Temporarily disabled — re-enable after testing
    // if (lineCards && typeof lineCards === 'object') {
    //   const sameRfidOnAnotherCard = Object.entries(lineCards).find(([lineCardNo, lineCardData]) => (
    //     String(lineCardNo) !== String(safeCardNumber)
    //     && String(lineCardData?.hufRfidNumber || '').trim() === String(scanCardNumber)
    //   ));
    //
    //   if (sameRfidOnAnotherCard) {
    //     SURVEY_SAVE_LOG('saveSurveyDetails:rfid_used_on_other_card', {
    //       scanCardNumber,
    //       otherCardNumber: sameRfidOnAnotherCard[0],
    //     });
    //     return {
    //       ok: false,
    //       code: 'RFID_ALREADY_USED',
    //       message: `This scan card is already used on card ${sameRfidOnAnotherCard[0]}`,
    //     };
    //   }
    // }

    const mappingCheck = await validateScanCardMapping({
      scanCardNumber,
      ward: safeWard,
      lineNumber: safeLine,
    });
    if (!mappingCheck?.ok) {
      return mappingCheck;
    }

    const payload = {
      imgName: `${sanitizePathPart(scanCardNumber)}.jpg`,
      latLng: parseLatLngForSave(latLng),
      _at: toDateTimeString(),
      surveyorId: String(surveyorId),
    };
    SURVEY_SAVE_LOG('db:save:start', {
      dbPath,
      houseCardPath,
      payload,
    });
    await saveData(dbPath, payload);
    await updateData(houseCardPath, { hufRfidNumber: String(scanCardNumber || '') });
    await updateData(cardMappingPath, {
      ward: safeWard,
      line: safeLine,
      cardNumber: safeCardNumber,
      scanCardNumber: String(scanCardNumber || '').trim(),
      _at: toDateTimeString(),
    });
    SURVEY_SAVE_LOG('db:save:done', { dbPath });

    const queueItem = await enqueuePendingUpload({
      ward,
      lineNumber,
      cardNumber,
      scanCardNumber,
      cardImageUri,
      houseImageUri,
    });
    SURVEY_SAVE_LOG('upload:queued_for_background', { queueItem });

    const response = {
      ok: true,
      message: 'Survey saved. Images will sync in background.',
      data: {
        dbPath,
        houseCardPath,
        payload,
        queued: true,
        queueItemId: queueItem?.id || null,
      },
    };
    SURVEY_SAVE_LOG('saveSurveyDetails:success', response);
    return response;
  } catch (error) {
    SURVEY_SAVE_LOG('saveSurveyDetails:error', error?.message || error, error);
    return {
      ok: false,
      message: error?.message || 'Unable to save survey details',
    };
  }
};
