import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  PermissionsAndroid,
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
  PanResponder,
} from 'react-native';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Geolocation from '@react-native-community/geolocation';
import MapView, { AnimatedRegion, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { theme } from '../theme/appTheme';
import CardDetailsModal from '../Components/MapScreen/CardDetailsModal';
import { useLoader } from '../Components/LoaderContext';
import { useAlert } from '../Components/AlertToast/AlertToast';
import { loadLineHousesAction, loadWardLinesAction } from '../Actions/Map/MapAction';
import { flushPendingSurveyImageUploads, saveSurveyDetails } from '../Services/Map/SurveySaveService';
import { getUserDetails } from '../utils/storage';

const { height, width } = Dimensions.get('window');
const cardWidthGrid = (width - 40 - 20) / 3;
const HOUSE_MARKER_ICON = require('../assets/images/house.png');
const HOUSE_MARKER_DONE_ICON = require('../assets/images/green_marker.png');
const USER_MARKER_ICON = require('../assets/images/person.png');

const DEFAULT_REGION = {
  latitude: 28.6139,
  longitude: 77.2090,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

const getRegionFromPoints = (points = []) => {
  if (!Array.isArray(points) || points.length === 0) {
    return DEFAULT_REGION;
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

const getLineEndBearing = (points = []) => {
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

// ── Custom Map Marker ──────────────────────────────────────────────────────────
const HouseMarker = ({ house, isSelected, isDone, onPress }) => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const t = setTimeout(() => setTracksViewChanges(false), 300);
    return () => clearTimeout(t);
  }, [isSelected]);

  return (
    <Marker
      coordinate={{ latitude: Number(house.latitude), longitude: Number(house.longitude) }}
      onPress={() => onPress(house)}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <Image
        source={isDone ? HOUSE_MARKER_DONE_ICON : HOUSE_MARKER_ICON}
        style={[
          markerStyles.houseMarkerIcon,
          isSelected && markerStyles.houseMarkerIconSelected,
        ]}
        resizeMode="contain"
        onLoad={() => setTracksViewChanges(false)}
      />
    </Marker>
  );
};

const markerStyles = StyleSheet.create({
  houseMarkerIcon: {
    width: 30,
    height: 30,
  },
  houseMarkerIconSelected: {
    width: 32,
    height: 32,
  }
});

const MAP_SAVE_LOG = (...args) => console.log('[MapSaveFlow]', ...args);

// ── Main Screen ────────────────────────────────────────────────────────────────
const MapScreen = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [cardWorkflowState, setCardWorkflowState] = useState({});
  const [wardLines, setWardLines] = useState([]);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [wardLinesLoading, setWardLinesLoading] = useState(false);
  const [assignedWard, setAssignedWard] = useState('');
  const [lineHouses, setLineHouses] = useState([]);
  const [housesLoading, setHousesLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const { showLoader, hideLoader } = useLoader();
  const { showAlert } = useAlert();
  const housesByLineRef = useRef({});

  const mapRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const hasAnimatedToUserRef = useRef(false);
  const userAnimatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: DEFAULT_REGION.latitude,
      longitude: DEFAULT_REGION.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

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

  // ── Actions ──
  const openCardModal = useCallback((house) => {
    setSelectedCard(house);
    if (String(house?.hufRfidNumber || '').trim()) {
      setCardWorkflowState((prev) => ({
        ...prev,
        [house.id]: {
          ...prev[house.id],
          qrData: house.hufRfidNumber,
          saved: true,
        },
      }));
    }
    setCardModalVisible(true);
  }, []);

  const handleQrScanned = useCallback(
    (scannedCode) => {
      if (!selectedCard?.id) return;
      setCardWorkflowState((prev) => ({
        ...prev,
        [selectedCard.id]: { ...prev[selectedCard.id], qrData: scannedCode, saved: false },
      }));
    },
    [selectedCard]
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
    const lineNumber = String(currentLine?.id || '');
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
      showAlert('error', 'सभी जरूरी सर्वे स्टेप पूरे करें।');
      return;
    }
    if (!Number.isFinite(saveLatitude) || !Number.isFinite(saveLongitude)) {
      showAlert('error', 'Current location not available. कृपया GPS on करके फिर से कोशिश करें।');
      return;
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
      if (currentLine?.id) {
        const lineId = String(currentLine.id);
        const existing = housesByLineRef.current[lineId];
        if (Array.isArray(existing)) {
          housesByLineRef.current[lineId] = existing.map((house) => (
            String(house.id) === String(cardId)
              ? { ...house, hufRfidNumber: scanCardNumber }
              : house
          ));
        }
      }
      showAlert('success', 'सर्वे डेटा सफलतापूर्वक सहेजा गया।');
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
      showAlert('error', error?.message || 'Survey save failed');
    } finally {
      hideLoader();
    }
  }, [assignedWard, currentLine?.id, currentUserLocation, getCardState, hideLoader, selectedCard, showAlert, showLoader]);


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
      <TouchableOpacity
        key={item.id}
        style={[
          styles.houseCard,
          isGrid && { width: cardWidthGrid, height: 122 },
          status === 'done' && styles.houseCardDone,
          status === 'progress' && styles.houseCardProgress,
          isSelected && styles.houseCardSelected,
        ]}
        activeOpacity={0.88}
        onPress={() => openCardModal(item)}
      >
        {/* Image area */}
        <View style={[
          styles.houseImageArea,
          status === 'done' && styles.houseImageAreaDone,
          status === 'progress' && styles.houseImageAreaProgress,
        ]}>
          {item.referenceImageUri ? (
            <Image
              source={{ uri: item.referenceImageUri }}
              style={styles.housePreviewImage}
            />
          ) : (
            <MaterialIcons
              name="home-work"
              size={34}
              color={
                status === 'done' ? theme.colors.gradientStart
                : status === 'progress' ? '#f59e0b'
                : '#b0bec5'
              }
            />
          )}

          {/* Status badge top-right */}
          {status === 'done' && (
            <View style={styles.cardBadgeDone}>
              <MaterialIcons name="check" size={9} color="#fff" />
            </View>
          )}
          {status === 'progress' && (
            <View style={styles.cardBadgeProgress} />
          )}
        </View>

        {/* Footer */}
        <View style={[
          styles.houseCardFooter,
          status === 'done' && styles.houseCardFooterDone,
        ]}>
          <Text
            style={[
              styles.houseCardNumber,
              status === 'done' && styles.houseCardNumberDone,
            ]}
            numberOfLines={1}
          >
            {item.number}
          </Text>
          <MaterialIcons
            name={status === 'done' ? 'check-circle' : status === 'progress' ? 'pending' : 'chevron-right'}
            size={15}
            color={
              status === 'done' ? theme.colors.gradientStart
              : status === 'progress' ? '#f59e0b'
              : '#cbd5e1'
            }
          />
        </View>
      </TouchableOpacity>
    );
  };

  const totalLines = wardLines.length;
  const currentLine = wardLines[activeLineIndex] || null;
  const hasPreviousLine = activeLineIndex > 0;
  const hasNextLine = activeLineIndex < totalLines - 1;

  const focusLineOnMap = useCallback((lineIndex) => {
    const line = wardLines[lineIndex];
    if (!line?.points?.length) return;
    mapRef.current?.animateToRegion(getRegionFromPoints(line.points), 450);
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
      userAnimatedCoordinate.timing({ latitude, longitude, duration: 800, useNativeDriver: false }).start();
    }
    if (animateMap) {
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.0045, longitudeDelta: 0.0045 }, 450);
    }
  }, [userAnimatedCoordinate]);

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
          showAlert('error', 'Location मिल नहीं सकी। GPS on करें।');
          return;
        }
        if (Number.isFinite(accuracy) && accuracy > 25) {
          showAlert('error', `Signal कमज़ोर है (${Math.round(accuracy)}m)। खुली जगह पर जाकर फिर try करें।`);
          return;
        }
        updateUserLocation(latitude, longitude, true);
      },
      () => {
        setLocating(false);
        showAlert('error', 'Location नहीं मिली। Location permission और internet check करें।');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [locating, showAlert, updateUserLocation]);

  const handleNavigateToLineStart = useCallback(() => {
    const startPoint = currentLine?.points?.[0];
    if (!startPoint) {
      showAlert('error', 'Line start point available नहीं है।');
      return;
    }
    const { latitude, longitude } = startPoint;
    const googleNavUrl = `google.navigation:q=${latitude},${longitude}&mode=w`;
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`;
    Linking.canOpenURL(googleNavUrl)
      .then((supported) => Linking.openURL(supported ? googleNavUrl : fallbackUrl))
      .catch(() => Linking.openURL(fallbackUrl));
  }, [currentLine, showAlert]);

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
          setActiveLineIndex(resp.initialLineIndex || 0);
          if (resp.wardLines[0]?.points?.length) {
            mapRef.current?.animateToRegion(getRegionFromPoints(resp.wardLines[0].points), 450);
          }
        } else {
          setWardLines([]);
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
    Object.entries(housesByLineRef.current).forEach(([lineId, houses]) => {
      if (validLineIds.has(String(lineId))) {
        nextCache[lineId] = houses;
      }
    });
    housesByLineRef.current = nextCache;
  }, [wardLines]);

  useEffect(() => {
    let isMounted = true;

    const hydrateLineHouses = async () => {
      if (!assignedWard || !currentLine?.id) {
        setLineHouses([]);
        return;
      }

      const lineId = String(currentLine.id);
      const cachedHouses = housesByLineRef.current[lineId];
      if (Array.isArray(cachedHouses) && cachedHouses.length > 0) {
        setLineHouses(cachedHouses);
        return;
      }

      setHousesLoading(true);
      showLoader('Loading houses...');
      try {
        const resp = await loadLineHousesAction({ ward: assignedWard, lineId });
        if (!isMounted) return;

        if (resp.ok && Array.isArray(resp.houses)) {
          setLineHouses(resp.houses);
          housesByLineRef.current[lineId] = resp.houses;
        } else {
          setLineHouses([]);
          housesByLineRef.current[lineId] = [];
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
  }, [assignedWard, currentLine?.id, showLoader, hideLoader]);

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
    const intervalId = setInterval(syncNow, 20000);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, []);

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
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        showAlert('error', 'Location permission denied. कृपया location अनुमति दें।');
        return;
      }

      Geolocation.setRNConfiguration({
        skipPermissionRequests: true,
        authorizationLevel: 'whenInUse',
      });

      locationWatchIdRef.current = Geolocation.watchPosition(
        (position) => {
          const latitude = Number(position?.coords?.latitude);
          const longitude = Number(position?.coords?.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          updateUserLocation(latitude, longitude, false);
        },
        (error) => {
          MAP_SAVE_LOG('location_watch_error', error?.message || error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 5000,
          fastestInterval: 3000,
          timeout: 15000,
          maximumAge: 2000,
        }
      );
    };

    startLocationTracking();

    return () => {
      if (locationWatchIdRef.current !== null) {
        Geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
    };
  }, [showAlert, updateUserLocation]);

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ward Prashant</Text>
        <TouchableOpacity style={styles.headerMenuBtn}>
          <MaterialIcons name="more-vert" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

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
                  tracksViewChanges={false}
                >
                  <View style={[styles.lineStartDot, styles.lineStartDotActive]} />
                </Marker>
              ) : null}
              {currentLine.points[currentLine.points.length - 1] ? (
                <Marker
                  coordinate={currentLine.points[currentLine.points.length - 1]}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
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
            <Marker
              coordinate={currentUserLocation}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <Image
                source={USER_MARKER_ICON}
                style={styles.userMarkerIcon}
                resizeMode="contain"
              />
            </Marker>
          ) : null}
        </MapView>
      </View>

      {/* ── Floating Overlays ── */}
      <View style={styles.overlaysContainer}>
        {/* Line Number Card */}
	        <View style={styles.lineNumberCard}>
	          <View style={styles.lineNumberLeft}>
	            <MaterialIcons name="map" size={16} color={theme.colors.gradientEnd} />
	            <Text style={styles.lineNumberLabel}>Line Number</Text>
	          </View>
	          <View style={styles.lineNumberRight}>
              {hasPreviousLine ? (
                <TouchableOpacity
                  style={styles.lineStepBtn}
                  activeOpacity={0.8}
                  onPress={handlePreviousLine}
                >
                  <MaterialIcons name="chevron-left" size={20} color={theme.colors.gradientEnd} />
                </TouchableOpacity>
              ) : (
                <View style={styles.lineStepBtnHidden} />
              )}
	            {wardLinesLoading ? (
	              <ActivityIndicator size="small" color={theme.colors.gradientEnd} />
	            ) : (
              <Text style={styles.lineNumberCount}>
                {totalLines > 0 ? `${activeLineIndex + 1} / ${totalLines}` : '-- / --'}{housesLoading ? ' ...' : ''}
              </Text>
	            )}
              {hasNextLine ? (
                <TouchableOpacity
                  style={styles.lineStepBtn}
                  activeOpacity={0.8}
                  onPress={handleCycleLine}
                >
	                <MaterialIcons name="chevron-right" size={20} color={theme.colors.gradientEnd} />
                </TouchableOpacity>
              ) : (
                <View style={styles.lineStepBtnHidden} />
              )}
	          </View>
	        </View>

        {/* Map Action Buttons */}
        <View style={styles.mapActions}>
          <TouchableOpacity style={styles.mapActionBtn} onPress={handleNavigateToLineStart}>
            <FontAwesome6 name="route" size={18} color={theme.colors.gradientEnd} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mapActionBtn}
            onPress={handleGetCurrentLocation}
            disabled={locating}
          >
            {locating
              ? <ActivityIndicator size="small" color={theme.colors.gradientEnd} />
              : <MaterialIcons name="my-location" size={22} color={theme.colors.gradientEnd} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Bottom Sheet ── */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY }] }]}>
        {/* Drag Handle */}
        <View style={styles.sheetHandleWrap} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
        </View>

        {/* Sheet Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Select House</Text>
          <View style={styles.totalPill}>
            <MaterialIcons name="home-work" size={13} color={theme.colors.gradientEnd} />
            <Text style={styles.totalPillText}>{surveyStats.total}</Text>
          </View>
        </View>

        {/* Houses List / Grid */}
        <View style={styles.listContainer}>
          {isExpanded ? (
            <ScrollView
              key="vertical-grid"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.housesGrid}
            >
              {lineHouses.map((item) => renderHouseCard(item, true))}
            </ScrollView>
          ) : (
            <ScrollView
              key="horizontal-list"
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.housesScroll}
            >
              {lineHouses.map((item) => renderHouseCard(item, false))}
            </ScrollView>
          )}
        </View>
      </Animated.View>

      {/* ── Modals ── */}
      <CardDetailsModal
        visible={cardModalVisible}
        card={selectedCard}
        cardData={getCardState(selectedCard?.id)}
        onClose={handleProcessCloseAndReset}
        onQrScanned={handleQrScanned}
        onCardImageCaptured={handleCardImageCaptured}
        onHouseImageCaptured={handleHouseImageCaptured}
        onVerifyAndSave={handleVerifyAndSave}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },

  // ── Header ──
  header: {
    backgroundColor: theme.colors.gradientStart,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.white,
    letterSpacing: 0.3,
  },
  headerMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Map ──
  mapArea: {
    position: 'absolute',
    top: 65,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  map: {
    flex: 1,
  },
  userMarkerIcon: {
    width: 50,
    height: 50,
  },
  lineStartDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0ea5e9',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  lineStartDotActive: {
    backgroundColor: '#ef4444',
  },
  lineEndArrowWrap: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineEndArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#0ea5e9',
  },
  lineEndArrowHeadActive: {
    borderBottomColor: '#ef4444',
  },

  // ── Overlays ──
  overlaysContainer: {
    position: 'absolute',
    top: 65 + 14,
    left: 14,
    right: 14,
    zIndex: 5,
  },
  lineNumberCard: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  lineNumberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  lineNumberLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  lineNumberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lineStepBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  lineStepBtnHidden: {
    width: 28,
    height: 28,
  },
  lineNumberCount: {
    fontSize: 15,
    color: theme.colors.gradientEnd,
    fontWeight: '800',
  },
  mapActions: {
    position: 'absolute',
    top: 70,
    right: 0,
    gap: 10,
  },
  mapActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  // ── Bottom Sheet ──
  bottomSheet: {
    position: 'absolute',
    bottom: -height * 0.45,
    height: height * 0.75,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 100,
  },
  sheetHandleWrap: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 4,
  },

  // Sheet Header
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  totalPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.gradientEnd,
  },

  listContainer: { flex: 1 },
  housesScroll: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  housesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
    justifyContent: 'flex-start',
  },

  // ── House Card ──
  houseCard: {
    width: 124,
    height: 134,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  houseCardDone: {
    borderColor: theme.colors.gradientStart,
  },
  houseCardProgress: {
    borderColor: '#f59e0b',
  },
  houseCardSelected: {
    elevation: 6,
    shadowOpacity: 0.15,
    transform: [{ scale: 1.02 }],
  },
  houseImageArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  housePreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  houseImageAreaDone: {
    backgroundColor: '#ecfdf5',
  },
  houseImageAreaProgress: {
    backgroundColor: '#fffbeb',
  },
  cardBadgeDone: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.gradientStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadgeProgress: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  houseCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 3,
    backgroundColor: '#fff',
  },
  houseCardFooterDone: {
    backgroundColor: '#f0fdf4',
  },
  houseCardNumber: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
  },
  houseCardNumberDone: {
    color: theme.colors.gradientEnd,
  },
});

export default MapScreen;
