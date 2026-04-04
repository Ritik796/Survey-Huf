import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {  Image,
  Linking,
  PermissionsAndroid,
  Platform,
  View,
  Text,
    TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  PanResponder,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Geolocation from '@react-native-community/geolocation';
import MapView, { AnimatedRegion, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import LinearGradient from 'react-native-linear-gradient';
import { theme } from '../theme/appTheme';
import CardDetailsModal from '../Components/MapScreen/CardDetailsModal';
import HouseMarker from '../Components/MapScreen/HouseMarker';
import HouseCard from '../Components/MapScreen/HouseCard';
import HousesBottomSheet from '../Components/MapScreen/HousesBottomSheet';
import MapOverlays from '../Components/MapScreen/MapOverlays';
import { useLoader } from '../Components/LoaderContext';
import { useAlert } from '../Components/AlertToast/AlertToast';
import { useCommonAlert } from '../Components/CommonAlert/CommonAlert';
import { loadLineHousesAction, loadWardLinesAction } from '../Actions/Map/MapAction';
import { buildLineRangeCacheKey, formatDistanceForDisplay, getDistanceMeters, getLineEndBearing, getRegionFromPoints } from '../Actions/Map/MapScreenAction';
import { updateHouseInSessionCache } from '../Services/Map/mapServices';
import { logoutSurveyor } from '../Actions/StartSurvey/StartSurveyAction';
import {
  flushPendingSurveyImageUploads,
  saveSurveyDetails,
  validateScanCardMapping,
} from '../Services/Map/SurveySaveService';
import { DEFAULT_HUF_SURVEY_SETTINGS, loadHUFSurveySettings } from '../Services/Settings/HUFSurveySettingsService';
import { getUserDetails } from '../utils/storage';
import styles from '../Styles/MapScreen/MapScreenStyles';

const { height, width } = Dimensions.get('window');
const cardWidthGrid = (width - 40 - 20) / 3;
const USER_MARKER_ICON = require('../assets/images/person.png');

const DEFAULT_REGION = DEFAULT_HUF_SURVEY_SETTINGS.map.defaultRegion;
const DISABLE_CARD_CLICK_RANGE_CHECK = false;
const DISABLE_SAVE_RANGE_CHECK = false;

const MAP_SAVE_LOG = (...args) => console.log('[MapSaveFlow]', ...args);
const resolveDuplicateCardMessage = (template, cardNumber) => {
  const rawTemplate = String(template || '');
  const withCard = rawTemplate
    .replace(/\$\{cardNumber\}/g, String(cardNumber || ''))
    .replace(/\{\{cardNumber\}\}/g, String(cardNumber || ''));
  return withCard.replace(/<\/?b>/g, '');
};

// ── Main Screen ────────────────────────────────────────────────────────────────
const MapScreen = ({ navigation }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [cardWorkflowState, setCardWorkflowState] = useState({});
  const [wardLines, setWardLines] = useState([]);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [lineCardRangesByLineId, setLineCardRangesByLineId] = useState({});
  const [wardLinesLoading, setWardLinesLoading] = useState(false);
  const [assignedWard, setAssignedWard] = useState('');
  const [lineHouses, setLineHouses] = useState([]);
  const [housesLoading, setHousesLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [runtimeSettings, setRuntimeSettings] = useState(DEFAULT_HUF_SURVEY_SETTINGS);
  const { showLoader, hideLoader } = useLoader();
  const { showAlert } = useAlert();
  const { showCommonAlert } = useCommonAlert();
  const housesByLineRef = useRef({});
  const currentLineId = wardLines[activeLineIndex]?.id ?? null;
  const surveySettings = runtimeSettings?.survey || DEFAULT_HUF_SURVEY_SETTINGS.survey;
  const mapSettings = runtimeSettings?.map || DEFAULT_HUF_SURVEY_SETTINGS.map;
  const locationSettings = runtimeSettings?.location || DEFAULT_HUF_SURVEY_SETTINGS.location;
  const syncSettings = runtimeSettings?.sync || DEFAULT_HUF_SURVEY_SETTINGS.sync;
  const msg = runtimeSettings?.messages || DEFAULT_HUF_SURVEY_SETTINGS.messages;
  const requiredSurveyDistance = Number(surveySettings?.requiredDistanceMeters) || 30;
  const maxAcceptableAccuracyMeters = Number(surveySettings?.maxAcceptableAccuracyMeters) || 25;
  const syncIntervalMs = Number(syncSettings?.intervalMs) || 20000;
  const markerAnimateDuration = Number(mapSettings?.markerAnimateDuration) || 800;
  const animateLatitudeDelta = Number(mapSettings?.locationAnimateRegion?.latitudeDelta) || 0.0045;
  const animateLongitudeDelta = Number(mapSettings?.locationAnimateRegion?.longitudeDelta) || 0.0045;
  const animateDuration = Number(mapSettings?.locationAnimateRegion?.animateDuration) || 450;
  const watchPositionOptions = locationSettings?.watchPosition || DEFAULT_HUF_SURVEY_SETTINGS.location.watchPosition;
  const getCurrentPositionOptions = locationSettings?.getCurrentPosition || DEFAULT_HUF_SURVEY_SETTINGS.location.getCurrentPosition;
  const msgMissingFields = String(msg?.survey?.missingFields || DEFAULT_HUF_SURVEY_SETTINGS.messages.survey.missingFields);
  const msgSaveSuccess = String(msg?.survey?.saveSuccess || DEFAULT_HUF_SURVEY_SETTINGS.messages.survey.saveSuccess);
  const msgSaveFailed = String(msg?.survey?.saveFailed || DEFAULT_HUF_SURVEY_SETTINGS.messages.survey.saveFailed);
  const msgGpsUnavailable = String(msg?.location?.gpsUnavailable || DEFAULT_HUF_SURVEY_SETTINGS.messages.location.gpsUnavailable);
  const msgGpsTurnOn = String(msg?.location?.gpsTurnOn || DEFAULT_HUF_SURVEY_SETTINGS.messages.location.gpsTurnOn);
  const msgAccuracyLow = String(msg?.location?.accuracyLow || DEFAULT_HUF_SURVEY_SETTINGS.messages.location.accuracyLow);
  const msgPermissionDenied = String(msg?.location?.permissionDenied || DEFAULT_HUF_SURVEY_SETTINGS.messages.location.permissionDenied);
  const msgLineStartUnavailable = String(msg?.location?.lineStartUnavailable || DEFAULT_HUF_SURVEY_SETTINGS.messages.location.lineStartUnavailable);
  const msgOutOfRangeTemplate = String(msg?.distance?.outOfRange || DEFAULT_HUF_SURVEY_SETTINGS.messages.distance.outOfRange);
  const msgDuplicateCardTemplate = String(msg?.card?.duplicateCardTemplate || DEFAULT_HUF_SURVEY_SETTINGS.messages.card.duplicateCardTemplate);

  const mapRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const activeWatchIdsRef = useRef(new Set());
  const trackingEnabledRef = useRef(true);
  const hasAnimatedToUserRef = useRef(false);
  const userAnimatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: DEFAULT_REGION.latitude,
      longitude: DEFAULT_REGION.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  useEffect(() => {
    let isMounted = true;
    const loadSettings = async () => {
      const settings = await loadHUFSurveySettings();
      if (!isMounted || !settings) return;
      setRuntimeSettings(settings);
    };
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Bottom Sheet PanResponder ──
  const translateY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  const MAX_UP = -height * 0.45;
  const MIN_DOWN = 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gs) => {
        let newY = lastY.current + gs.dy;
        if (newY < MAX_UP) newY = MAX_UP - (MAX_UP - newY) * 0.1;
        if (newY > MIN_DOWN + 50) newY = MIN_DOWN + 50 - (MIN_DOWN + 50 - newY) * 0.1;
        translateY.setValue(newY);
      },
      onPanResponderRelease: (e, gs) => {
        if (gs.dy < -40 || gs.vy < -0.5) {
          lastY.current = MAX_UP;
          setIsExpanded(true);
        } else if (gs.dy > 40 || gs.vy > 0.5) {
          lastY.current = MIN_DOWN;
          setIsExpanded(false);
        } else {
          setIsExpanded(lastY.current === MAX_UP);
        }
        Animated.spring(translateY, {
          toValue: lastY.current,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }).start();
      },
    })
  ).current;

  // ── Helpers ──
  const getCardState = useCallback(
    (cardId) => (cardId ? cardWorkflowState[cardId] || {} : {}),
    [cardWorkflowState]
  );

  const getHouseStatus = useCallback(
    (cardId) => {
      const house = lineHouses.find((h) => String(h.id) === String(cardId));
      if (String(house?.hufRfidNumber || '').trim()) return 'done';
      const s = cardWorkflowState[cardId];
      if (!s) return 'pending';
      if (s.saved) return 'done';
      if (s.qrData || s.cardImageUri) return 'progress';
      return 'pending';
    },
    [cardWorkflowState, lineHouses]
  );

  const surveyStats = useMemo(() => {
    const done = lineHouses.filter((h) => getHouseStatus(h.id) === 'done').length;
    const inProgress = lineHouses.filter((h) => getHouseStatus(h.id) === 'progress').length;
    return { done, inProgress, total: lineHouses.length };
  }, [getHouseStatus, lineHouses]);

  const showSurveyPopup = useCallback((title, message, iconType = 'warning', icon = 'warning-amber') => {
    showCommonAlert({
      title,
      message,
      icon,
      iconType,
      buttons: [{ text: 'OK', style: 'cancel' }],
    });
  }, [showCommonAlert]);

  // ── Actions ──
  const openCardModal = useCallback(async (house) => {
    const isAlreadySurveyed = Boolean(String(house?.hufRfidNumber || '').trim());
    if (isAlreadySurveyed) {
      setSelectedCard(house);
      setCardWorkflowState((prev) => ({
        ...prev,
        [house.id]: {
          ...prev[house.id],
          qrData: house.hufRfidNumber,
          saved: true,
        },
      }));
      setCardModalVisible(true);
      return;
    }

    const cardLat = Number(house?.latitude);
    const cardLng = Number(house?.longitude);
    let userLat = Number(currentUserLocation?.latitude);
    let userLng = Number(currentUserLocation?.longitude);
    let locationLoaderShown = false;

    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      locationLoaderShown = true;
      showLoader('Fetching location...');
      try {
        const position = await new Promise((resolve, reject) => {
          Geolocation.getCurrentPosition(resolve, reject, getCurrentPositionOptions);
        });
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        const accuracy = Number(position?.coords?.accuracy);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          showSurveyPopup('Location Error', msgGpsTurnOn, 'destructive', 'location-off');
          return;
        }
        if (!shouldAcceptAccuracy(accuracy)) {
          showSurveyPopup('Low Accuracy', msgAccuracyLow, 'warning', 'my-location');
          return;
        }
        updateUserLocation(latitude, longitude, false);
        userLat = latitude;
        userLng = longitude;
      } catch (_error) {
        showSurveyPopup('Location Error', msgGpsTurnOn, 'destructive', 'location-off');
        return;
      } finally {
        if (locationLoaderShown) {
          hideLoader();
        }
      }
    }

    if (
      !DISABLE_CARD_CLICK_RANGE_CHECK &&
      Number.isFinite(cardLat) && Number.isFinite(cardLng) &&
      Number.isFinite(userLat) && Number.isFinite(userLng)
    ) {
      const dist = Math.round(getDistanceMeters(userLat, userLng, cardLat, cardLng));
      if (dist > requiredSurveyDistance) {
        showSurveyPopup(
          'Out of Range',
          msgOutOfRangeTemplate
            .replace('{{currentDistance}}', formatDistanceForDisplay(dist))
            .replace('{{requiredDistance}}', formatDistanceForDisplay(requiredSurveyDistance)),
          'warning',
          'wrong-location'
        );
        return;
      }
    }
    setSelectedCard(house);
    setCardModalVisible(true);
  }, [currentUserLocation, getCurrentPositionOptions, hideLoader, msgAccuracyLow, msgGpsTurnOn, msgOutOfRangeTemplate, requiredSurveyDistance, shouldAcceptAccuracy, showLoader, showSurveyPopup, updateUserLocation]);

  const handleQrScanned = useCallback(
    async (scannedCode) => {
      if (!selectedCard?.id) return;

      const cleanCode = String(scannedCode || '').trim();
      const ward = String(assignedWard || '').trim();
      const lineNumber = String(currentLineId || '').trim();

      if (!cleanCode) {
        showSurveyPopup('Invalid QR', 'Invalid QR code', 'warning', 'qr-code-scanner');
        return;
      }

      try {
        showLoader('Checking duplicate card...');
        MAP_SAVE_LOG('handleQrScanned:duplicate_check:start', {
          selectedCardId: selectedCard.id,
          scanCardNumber: cleanCode,
          ward,
          lineNumber,
        });
        const mappingValidation = await validateScanCardMapping({
          scanCardNumber: cleanCode,
          ward,
          lineNumber,
        });
        MAP_SAVE_LOG('handleQrScanned:duplicate_check:result', mappingValidation);

        if (!mappingValidation?.ok) {
          showSurveyPopup(
            'Duplicate Card',
            resolveDuplicateCardMessage(msgDuplicateCardTemplate, cleanCode),
            'warning',
            'error-outline'
          );
          setCardWorkflowState((prev) => ({
            ...prev,
            [selectedCard.id]: { ...prev[selectedCard.id], qrData: null, saved: false },
          }));
          return;
        }

        setCardWorkflowState((prev) => ({
          ...prev,
          [selectedCard.id]: { ...prev[selectedCard.id], qrData: cleanCode, saved: false },
        }));
      } catch (error) {
        showSurveyPopup('Validation Error', error?.message || 'Unable to validate scanned card', 'destructive', 'error-outline');
      } finally {
        hideLoader();
      }
    },
    [assignedWard, currentLineId, hideLoader, msgDuplicateCardTemplate, selectedCard, showLoader, showSurveyPopup]
  );

  const handleCardImageCaptured = useCallback(
    (uri) => {
      if (!selectedCard?.id) return;
      setCardWorkflowState((prev) => ({
        ...prev,
        [selectedCard.id]: { ...prev[selectedCard.id], cardImageUri: uri, saved: false },
      }));
    },
    [selectedCard]
  );

  const handleHouseImageCaptured = useCallback(
    (uri) => {
      if (!selectedCard?.id) return;
      const captureLat = Number(currentUserLocation?.latitude);
      const captureLng = Number(currentUserLocation?.longitude);
      const houseCaptureLocation = (
        Number.isFinite(captureLat) && Number.isFinite(captureLng)
          ? { latitude: captureLat, longitude: captureLng }
          : null
      );
      setCardWorkflowState((prev) => ({
        ...prev,
        [selectedCard.id]: {
          ...prev[selectedCard.id],
          houseImageUri: uri,
          houseCaptureLocation,
          saved: false,
        },
      }));
    },
    [currentUserLocation, selectedCard]
  );

  const runSaveProcess = useCallback(async (cardId) => {
    if (!cardId || !selectedCard?.id) return;
    const lineNumber = String(currentLineId || '');
    const cardState = getCardState(cardId);
    const scanCardNumber = String(cardState?.qrData || '').trim();
    const cardImageUri = cardState?.cardImageUri || '';
    const houseImageUri = cardState?.houseImageUri || '';
    const capturedLocation = cardState?.houseCaptureLocation || currentUserLocation;
    const saveLatitude = Number(capturedLocation?.latitude);
    const saveLongitude = Number(capturedLocation?.longitude);
    const houseCardNumber = String(selectedCard.number || selectedCard.id || '').trim();
    const ward = String(assignedWard || '').trim();

    MAP_SAVE_LOG('runSaveProcess:start', {
      cardId,
      ward,
      lineNumber,
      houseCardNumber,
      scanCardNumber,
      hasCardImage: Boolean(cardImageUri),
      hasHouseImage: Boolean(houseImageUri),
      hasCurrentLocation: Number.isFinite(saveLatitude) && Number.isFinite(saveLongitude),
    });

    if (!ward || !lineNumber || !houseCardNumber || !scanCardNumber || !cardImageUri || !houseImageUri) {
      MAP_SAVE_LOG('runSaveProcess:blocked_missing_required', {
        ward,
        lineNumber,
        houseCardNumber,
        scanCardNumber,
        hasCardImage: Boolean(cardImageUri),
        hasHouseImage: Boolean(houseImageUri),
      });
      showAlert('error', msgMissingFields);
      return;
    }
    if (!Number.isFinite(saveLatitude) || !Number.isFinite(saveLongitude)) {
      showSurveyPopup('Location Error', msgGpsUnavailable, 'destructive', 'location-off');
      return;
    }

    const cardLat = Number(selectedCard?.latitude);
    const cardLng = Number(selectedCard?.longitude);
    if (!DISABLE_SAVE_RANGE_CHECK && Number.isFinite(cardLat) && Number.isFinite(cardLng)) {
      const userLat = Number(currentUserLocation?.latitude);
      const userLng = Number(currentUserLocation?.longitude);
      if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
        const distanceToCard = Math.round(getDistanceMeters(userLat, userLng, cardLat, cardLng));
        if (distanceToCard > requiredSurveyDistance) {
          showSurveyPopup(
            'Out of Range',
            msgOutOfRangeTemplate
              .replace('{{currentDistance}}', formatDistanceForDisplay(distanceToCard))
              .replace('{{requiredDistance}}', formatDistanceForDisplay(requiredSurveyDistance)),
            'warning',
            'wrong-location'
          );
          return;
        }
      }
    }

    setCardWorkflowState((prev) => ({
      ...prev,
      [cardId]: { ...prev[cardId], isSaving: true },
    }));
    showLoader('Saving survey...');

    try {
      const user = await getUserDetails();
      const surveyorId = String(user?.userId || '').trim();
      MAP_SAVE_LOG('runSaveProcess:user_loaded', {
        surveyorId,
        userName: user?.name || '',
      });
      if (!surveyorId) {
        throw new Error('User session not found');
      }

      const savePayload = {
        ward,
        lineNumber,
        cardNumber: houseCardNumber,
        scanCardNumber,
        latLng: {
          latitude: saveLatitude,
          longitude: saveLongitude,
        },
        surveyorId,
        cardImageUri,
        houseImageUri,
      };
      MAP_SAVE_LOG('runSaveProcess:service_call_payload', savePayload);
      const saveResp = await saveSurveyDetails(savePayload);
      MAP_SAVE_LOG('runSaveProcess:service_response', saveResp);

      if (!saveResp?.ok) {
        throw new Error(saveResp?.message || 'Save failed');
      }

      setCardWorkflowState((prev) => ({
        ...prev,
        [cardId]: { ...prev[cardId], isSaving: false, saved: true },
      }));
      setLineHouses((prev) => prev.map((house) => (
        String(house.id) === String(cardId)
          ? { ...house, hufRfidNumber: scanCardNumber }
          : house
      )));
      if (currentLineId) {
        const lineId = String(currentLineId);
        // Update in-component cache (filtered houses)
        const existing = housesByLineRef.current[lineId];
        if (Array.isArray(existing)) {
          housesByLineRef.current[lineId] = existing.map((house) => (
            String(house.id) === String(cardId)
              ? { ...house, hufRfidNumber: scanCardNumber }
              : house
          ));
        }
        // Update module-level session cache (raw houses) so remount gets fresh data
        updateHouseInSessionCache(assignedWard, lineId, cardId, { hufRfidNumber: scanCardNumber });
      }
      showAlert('success', msgSaveSuccess);
      setCardModalVisible(false);
      setSelectedCard(null);

      flushPendingSurveyImageUploads()
        .then((syncResp) => {
          MAP_SAVE_LOG('post_save_queue_flush', syncResp);
        })
        .catch((e) => {
          MAP_SAVE_LOG('post_save_queue_flush_error', e?.message || e);
        });
    } catch (error) {
      MAP_SAVE_LOG('runSaveProcess:error', error?.message || error, error);
      setCardWorkflowState((prev) => ({
        ...prev,
        [cardId]: { ...prev[cardId], isSaving: false },
      }));
      showAlert('error', error?.message || msgSaveFailed);
    } finally {
      hideLoader();
    }
  }, [assignedWard, currentLineId, currentUserLocation, getCardState, hideLoader, msgGpsUnavailable, msgMissingFields, msgOutOfRangeTemplate, msgSaveFailed, msgSaveSuccess, requiredSurveyDistance, selectedCard, showAlert, showLoader, showSurveyPopup]);


  const resetCurrentSurveyProgress = useCallback(() => {
    if (!selectedCard?.id) return;
    const cardId = selectedCard.id;
    setCardWorkflowState((prev) => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        // Keep completed cards intact; reset only in-progress work.
        ...(prev[cardId]?.saved ? {} : {
        qrData: null,
        cardImageUri: null,
        houseImageUri: null,
        saved: false,
        isSaving: false,
        }),
      },
    }));
  }, [selectedCard]);

  const handleProcessCloseAndReset = useCallback(() => {
    setCardModalVisible(false);
    resetCurrentSurveyProgress();
  }, [resetCurrentSurveyProgress]);

  const handleVerifyAndSave = useCallback(() => {
    if (!selectedCard?.id) return;
    MAP_SAVE_LOG('handleVerifyAndSave:click', {
      selectedCardId: selectedCard.id,
      selectedCardNumber: selectedCard.number || '',
    });
    runSaveProcess(selectedCard.id);
  }, [runSaveProcess, selectedCard]);

  // ── House Card Render ──
  const renderHouseCard = (item, isGrid) => {
    const status = getHouseStatus(item.id);
    const isSelected = selectedCard?.id === item.id;
    return (
      <HouseCard
        key={item.id}
        item={item}
        isGrid={isGrid}
        status={status}
        isSelected={isSelected}
        cardWidthGrid={cardWidthGrid}
        styles={styles}
        onPress={openCardModal}
      />
    );
  };

  const totalLines = wardLines.length;
  const currentLine = wardLines[activeLineIndex] || null;
  const hasPreviousLine = activeLineIndex > 0;
  const hasNextLine = activeLineIndex < totalLines - 1;

  const focusLineOnMap = useCallback((lineIndex) => {
    const line = wardLines[lineIndex];
    if (!line?.points?.length) return;
    mapRef.current?.animateToRegion(getRegionFromPoints(line.points, DEFAULT_REGION), 450);
  }, [wardLines]);

  const selectLine = useCallback((lineIndex) => {
    if (lineIndex < 0 || lineIndex >= totalLines) return;
    setActiveLineIndex(lineIndex);
    focusLineOnMap(lineIndex);
  }, [focusLineOnMap, totalLines]);

  const handleCycleLine = useCallback(() => {
    if (!hasNextLine) return;
    const nextIndex = activeLineIndex + 1;
    selectLine(nextIndex);
  }, [activeLineIndex, hasNextLine, selectLine]);

  const updateUserLocation = useCallback((latitude, longitude, animateMap = false) => {
    setCurrentUserLocation({ latitude, longitude });
    if (!hasAnimatedToUserRef.current) {
      userAnimatedCoordinate.setValue({ latitude, longitude });
      hasAnimatedToUserRef.current = true;
    } else {
      userAnimatedCoordinate.timing({ latitude, longitude, duration: markerAnimateDuration, useNativeDriver: false }).start();
    }
    if (animateMap) {
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: animateLatitudeDelta, longitudeDelta: animateLongitudeDelta }, animateDuration);
    }
  }, [animateDuration, animateLatitudeDelta, animateLongitudeDelta, markerAnimateDuration, userAnimatedCoordinate]);

  const shouldAcceptAccuracy = useCallback(
    (accuracy) => !Number.isFinite(accuracy) || accuracy <= maxAcceptableAccuracyMeters,
    [maxAcceptableAccuracyMeters]
  );

  const stopAllTracking = useCallback(() => {
    activeWatchIdsRef.current.forEach((watchId) => {
      try {
        Geolocation.clearWatch(watchId);
      } catch {}
    });
    activeWatchIdsRef.current.clear();
    locationWatchIdRef.current = null;
    try {
      Geolocation.stopObserving();
    } catch {}
  }, []);

  const pauseTracking = useCallback(() => {
    stopAllTracking();
  }, [stopAllTracking]);

  const resumeTracking = useCallback(() => {
    if (!trackingEnabledRef.current) return;
    if (activeWatchIdsRef.current.size > 0) return;
    const watchId = Geolocation.watchPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        const accuracy = Number(position?.coords?.accuracy);
        if (!shouldAcceptAccuracy(accuracy)) return;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        updateUserLocation(latitude, longitude, false);
      },
      (error) => {
        MAP_SAVE_LOG('location_watch_error', error?.message || error);
      },
      watchPositionOptions
    );
    activeWatchIdsRef.current.add(watchId);
    locationWatchIdRef.current = watchId;
  }, [shouldAcceptAccuracy, updateUserLocation, watchPositionOptions]);

  const handleGetCurrentLocation = useCallback(() => {
    if (locating) return;
    setLocating(true);
    Geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        const accuracy = Number(position?.coords?.accuracy);
        setLocating(false);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          showSurveyPopup('Location Error', msgGpsTurnOn, 'destructive', 'location-off');
          return;
        }
        if (!shouldAcceptAccuracy(accuracy)) {
          showSurveyPopup('Low Accuracy', msgAccuracyLow, 'warning', 'my-location');
          return;
        }
        updateUserLocation(latitude, longitude, true);
      },
      () => {
        setLocating(false);
        showSurveyPopup('Location Error', msgGpsTurnOn, 'destructive', 'location-off');
      },
      getCurrentPositionOptions
    );
  }, [getCurrentPositionOptions, locating, msgAccuracyLow, msgGpsTurnOn, shouldAcceptAccuracy, showSurveyPopup, updateUserLocation]);

  const handleNavigateToLineStart = useCallback(() => {
    const startPoint = currentLine?.points?.[0];
    if (!startPoint) {
      showAlert('error', msgLineStartUnavailable);
      return;
    }
    const { latitude, longitude } = startPoint;
    const googleNavUrl = `google.navigation:q=${latitude},${longitude}&mode=d`;
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    Linking.canOpenURL(googleNavUrl)
      .then((supported) => Linking.openURL(supported ? googleNavUrl : fallbackUrl))
      .catch(() => Linking.openURL(fallbackUrl));
  }, [currentLine, msgLineStartUnavailable, showAlert]);

  const handlePreviousLine = useCallback(() => {
    if (!hasPreviousLine) return;
    const prevIndex = activeLineIndex - 1;
    selectLine(prevIndex);
  }, [activeLineIndex, hasPreviousLine, selectLine]);

  useEffect(() => {
    let isMounted = true;

    const hydrateWardLines = async () => {
      setWardLinesLoading(true);
      showLoader('Loading map lines...');
      try {
        const resp = await loadWardLinesAction();
        if (!isMounted) return;

        setAssignedWard(resp.ward || '');
        if (resp.ok && Array.isArray(resp.wardLines)) {
          setWardLines(resp.wardLines);
          setLineCardRangesByLineId(resp.lineCardRanges || {});
          const initialIndex = Number.isFinite(Number(resp.initialLineIndex))
            ? Number(resp.initialLineIndex)
            : 0;
          setActiveLineIndex(initialIndex);
          if (resp.wardLines[initialIndex]?.points?.length) {
            mapRef.current?.animateToRegion(getRegionFromPoints(resp.wardLines[initialIndex].points, DEFAULT_REGION), 450);
          } else if (resp.wardLines[0]?.points?.length) {
            mapRef.current?.animateToRegion(getRegionFromPoints(resp.wardLines[0].points, DEFAULT_REGION), 450);
          }
        } else {
          setWardLines([]);
          setLineCardRangesByLineId({});
        }
      } finally {
        if (isMounted) {
          setWardLinesLoading(false);
          hideLoader();
        }
      }
    };

    hydrateWardLines();
    return () => {
      isMounted = false;
    };
  }, [showLoader, hideLoader]);

  useEffect(() => {
    const validLineIds = new Set(wardLines.map((line) => String(line.id)));
    const nextCache = {};
    Object.entries(housesByLineRef.current).forEach(([cacheKey, houses]) => {
      const [lineIdPart] = String(cacheKey).split('::');
      if (validLineIds.has(String(lineIdPart))) {
        nextCache[cacheKey] = houses;
      }
    });
    housesByLineRef.current = nextCache;
  }, [wardLines]);

  useEffect(() => {
    let isMounted = true;

    const hydrateLineHouses = async () => {
      const hasLineId = currentLineId !== null && currentLineId !== undefined && String(currentLineId).trim() !== '';
      if (!assignedWard || !hasLineId) {
        setLineHouses([]);
        return;
      }

      const lineId = String(currentLineId);
      const rangeForLine = lineCardRangesByLineId[lineId] || [];
      const cacheKey = buildLineRangeCacheKey(lineId, rangeForLine);
      const cachedHouses = housesByLineRef.current[cacheKey];
      if (Array.isArray(cachedHouses) && cachedHouses.length > 0) {
        setLineHouses(cachedHouses);
        return;
      }

      setHousesLoading(true);
      showLoader('Loading houses...');
      try {
        const resp = await loadLineHousesAction({
          ward: assignedWard,
          lineId,
          lineCardRanges: rangeForLine,
        });
        if (!isMounted) return;

        if (resp.ok && Array.isArray(resp.houses)) {
          setLineHouses(resp.houses);
          housesByLineRef.current[cacheKey] = resp.houses;
        } else {
          setLineHouses([]);
          housesByLineRef.current[cacheKey] = [];
        }
      } finally {
        if (isMounted) {
          setHousesLoading(false);
          hideLoader();
        }
      }
    };

    hydrateLineHouses();
    return () => {
      isMounted = false;
    };
  }, [assignedWard, currentLineId, lineCardRangesByLineId, showLoader, hideLoader]);

  useEffect(() => {
    let stopped = false;

    const syncNow = async () => {
      try {
        const syncResp = await flushPendingSurveyImageUploads();
        if (!stopped) {
          MAP_SAVE_LOG('queue_flush_tick', syncResp);
        }
      } catch (err) {
        if (!stopped) {
          MAP_SAVE_LOG('queue_flush_tick_error', err?.message || err);
        }
      }
    };

    syncNow();
    const intervalId = setInterval(syncNow, syncIntervalMs);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [syncIntervalMs]);

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS !== 'android') {
        return true;
      }

      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        MAP_SAVE_LOG('location_permission_error', error?.message || error);
        return false;
      }
    };

    const startLocationTracking = async () => {
      if (!trackingEnabledRef.current) return;
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        showAlert('error', msgPermissionDenied);
        return;
      }

      Geolocation.setRNConfiguration({
        skipPermissionRequests: true,
        authorizationLevel: 'whenInUse',
      });

      const watchId = Geolocation.watchPosition(
        (position) => {
          const latitude = Number(position?.coords?.latitude);
          const longitude = Number(position?.coords?.longitude);
          const accuracy = Number(position?.coords?.accuracy);
          if (!shouldAcceptAccuracy(accuracy)) return;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          updateUserLocation(latitude, longitude, false);
        },
        (error) => {
          MAP_SAVE_LOG('location_watch_error', error?.message || error);
        },
        watchPositionOptions
      );
      activeWatchIdsRef.current.add(watchId);
      locationWatchIdRef.current = watchId;
    };

    startLocationTracking();

    return () => {
      stopAllTracking();
    };
  }, [msgPermissionDenied, shouldAcceptAccuracy, showAlert, stopAllTracking, updateUserLocation, watchPositionOptions]);

  useEffect(() => {
    if (!selectedCard?.id) return;
    const exists = lineHouses.some((house) => house.id === selectedCard.id);
    if (!exists) {
      setSelectedCard(null);
      setCardModalVisible(false);
    }
  }, [lineHouses, selectedCard?.id]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.gradientStart} translucent={false} />

      {/* ── Header ── */}
      <LinearGradient
        colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <MaterialIcons name="map" size={16} color="rgba(255,255,255,0.9)" />
          </View>
          <Text style={styles.headerTitle}>
            {assignedWard ? `Ward: ${assignedWard}` : 'Survey Map'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerMenuBtn}
          activeOpacity={0.8}
          onPress={() => {
            showCommonAlert({
              title: 'Logout',
              message: 'Are you sure you want to logout?',
              icon: 'logout',
              iconType: 'destructive',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Logout',
                  style: 'destructive',
                  icon: 'logout',
                  onPress: () => {
                    trackingEnabledRef.current = false;
                    pauseTracking();
                    logoutSurveyor(
                      (screen) => navigation.navigate(screen),
                      showAlert,
                    );
                  },
                },
              ],
            });
          }}
        >
          <MaterialIcons name="logout" size={20} color={theme.colors.white} />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Map ── */}
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_REGION}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {currentLine ? (
            <React.Fragment key={`line-${currentLine.id}`}>
              <Polyline
                coordinates={currentLine.points}
                strokeColor="#000000"
                strokeWidth={5}
                tappable
              />
              {currentLine.points[0] ? (
                <Marker
                  coordinate={currentLine.points[0]}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={[styles.lineStartDot, styles.lineStartDotActive]} />
                </Marker>
              ) : null}
              {currentLine.points[currentLine.points.length - 1] ? (
                <Marker
                  coordinate={currentLine.points[currentLine.points.length - 1]}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View
                    style={[
                      styles.lineEndArrowWrap,
                      { transform: [{ rotate: `${getLineEndBearing(currentLine.points)}deg` }] },
                    ]}
                  >
                    <View style={[styles.lineEndArrowHead, styles.lineEndArrowHeadActive]} />
                  </View>
                </Marker>
              ) : null}
            </React.Fragment>
          ) : null}
          {lineHouses
            .filter((house) => Number.isFinite(Number(house.latitude)) && Number.isFinite(Number(house.longitude)))
            .map((house) => (
            <HouseMarker
              key={house.id}
              house={house}
              isSelected={selectedCard?.id === house.id}
              isDone={getHouseStatus(house.id) === 'done'}
              onPress={openCardModal}
            />
          ))}
          {currentUserLocation ? (
            <Marker.Animated
              coordinate={userAnimatedCoordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges
            >
              <Image
                source={USER_MARKER_ICON}
                style={styles.userMarkerIcon}
                resizeMode="contain"
                fadeDuration={0}
              />
            </Marker.Animated>
          ) : null}
        </MapView>
      </View>

            <MapOverlays
        styles={styles}
        hasPreviousLine={hasPreviousLine}
        hasNextLine={hasNextLine}
        wardLinesLoading={wardLinesLoading}
        housesLoading={housesLoading}
        activeLineIndex={activeLineIndex}
        totalLines={totalLines}
        handlePreviousLine={handlePreviousLine}
        handleCycleLine={handleCycleLine}
        handleNavigateToLineStart={handleNavigateToLineStart}
        handleGetCurrentLocation={handleGetCurrentLocation}
        locating={locating}
      />

      <HousesBottomSheet
        styles={styles}
        translateY={translateY}
        panHandlers={panResponder.panHandlers}
        surveyStats={surveyStats}
        currentLineId={currentLineId}
        isExpanded={isExpanded}
        lineHouses={lineHouses}
        renderHouseCard={renderHouseCard}
      />

      {/* ── Modals ── */}
      <CardDetailsModal
        visible={cardModalVisible}
        card={selectedCard}
        cardData={getCardState(selectedCard?.id)}
        ward={assignedWard}
        lineId={currentLine?.id}
        onClose={handleProcessCloseAndReset}
        onQrScanned={handleQrScanned}
        onCardImageCaptured={handleCardImageCaptured}
        onHouseImageCaptured={handleHouseImageCaptured}
        onVerifyAndSave={handleVerifyAndSave}
        onTrackingPause={pauseTracking}
        onTrackingResume={resumeTracking}
      />
    </View>
  );
};

export default MapScreen;







