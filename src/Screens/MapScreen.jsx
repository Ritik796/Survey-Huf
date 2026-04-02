import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
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
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { theme } from '../theme/appTheme';
import QrScanModal from '../Components/MapScreen/QrScanModal';
import ImageCaptureModal from '../Components/MapScreen/ImageCaptureModal';
import CardDetailsModal from '../Components/MapScreen/CardDetailsModal';

const { height, width } = Dimensions.get('window');

const dummyHouses = [
  { id: '1', number: 'MNZ12243' },
  { id: '2', number: 'MNZ12244' },
  { id: '3', number: 'MNZ12245' },
  { id: '4', number: 'MNZ12246' },
  { id: '5', number: 'MNZ12247' },
  { id: '6', number: 'MNZ12248' },
];

// 3 columns when expanded, padding 20 on sides, 2 gaps of 10
const cardWidthGrid = (width - 40 - 20) / 3;
const DEFAULT_COORDINATES = {
  latitude: 28.6139,
  longitude: 77.2090,
};

const DEFAULT_REGION = {
  ...DEFAULT_COORDINATES,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const MapScreen = ({ navigation }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [imageCaptureVisible, setImageCaptureVisible] = useState(false);
  const [cardWorkflowState, setCardWorkflowState] = useState({});

  // ─── Bottom Sheet PanResponder Logic ───
  const translateY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);
  
  // MIN_DOWN = 0 (showing ~25% height). MAX_UP = -height * 0.45 (showing the full 70% height).
  const MAX_UP = -height * 0.45;
  const MIN_DOWN = 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        let newY = lastY.current + gestureState.dy;
        if (newY < MAX_UP) newY = MAX_UP - (MAX_UP - newY) * 0.1;
        if (newY > MIN_DOWN + 50) newY = MIN_DOWN + 50 - (MIN_DOWN + 50 - newY) * 0.1;
        translateY.setValue(newY);
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy < -40 || gestureState.vy < -0.5) {
          // Dragged up
          lastY.current = MAX_UP;
          setIsExpanded(true);
        } else if (gestureState.dy > 40 || gestureState.vy > 0.5) {
          // Dragged down
          lastY.current = MIN_DOWN;
          setIsExpanded(false);
        } else {
          // If tapped but not dragged far, keep it in same state
          if (lastY.current === MAX_UP) setIsExpanded(true);
          else setIsExpanded(false);
        }

        Animated.spring(translateY, {
          toValue: lastY.current,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }).start();
      }
    })
  ).current;

  const openCardModal = useCallback((card) => {
    setSelectedCard(card);
    setCardModalVisible(true);
  }, []);

  const getCardState = useCallback((cardId) => {
    if (!cardId) {
      return {};
    }
    return cardWorkflowState[cardId] || {};
  }, [cardWorkflowState]);

  const handleQrScanSuccess = useCallback((scannedCode) => {
    if (!selectedCard?.id) {
      return;
    }

    setCardWorkflowState((prev) => ({
      ...prev,
      [selectedCard.id]: {
        ...prev[selectedCard.id],
        qrData: scannedCode,
        saved: false,
      },
    }));

    setTimeout(() => {
      setImageCaptureVisible(true);
    }, 250);
  }, [selectedCard]);

  const runSaveProcess = useCallback(async (cardId) => {
    if (!cardId) {
      return;
    }

    setCardWorkflowState((prev) => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        isSaving: true,
      },
    }));

    await new Promise((resolve) => {
      setTimeout(resolve, 1200);
    });

    setCardWorkflowState((prev) => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        isSaving: false,
        saved: true,
      },
    }));

    Alert.alert('Saved', 'QR data aur card image successfully save ho gaye.');
  }, []);

  const handleCardImageCaptured = useCallback((imageUri) => {
    if (!selectedCard?.id) {
      return;
    }

    const cardId = selectedCard.id;
    setCardWorkflowState((prev) => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        imageUri,
        saved: false,
      },
    }));

    runSaveProcess(cardId);
  }, [runSaveProcess, selectedCard]);

  const handleManualSave = useCallback(() => {
    if (!selectedCard?.id) {
      return;
    }
    runSaveProcess(selectedCard.id);
  }, [runSaveProcess, selectedCard]);

  // Render a single card component
  const renderCard = (item, isGrid) => (
    <TouchableOpacity 
      key={item.id} 
      style={[styles.houseCard, isGrid && { width: cardWidthGrid, height: 125 }]} 
      activeOpacity={0.9}
      onPress={() => openCardModal(item)}
    >
      <View style={styles.houseImageArea}>
        <MaterialIcons name="home-work" size={40} color="#94a3b8" />
      </View>

      <View style={styles.houseCardFooter}>
        <View style={styles.houseCardNumberWrap}>
          <Text style={styles.houseCardNumber}>{item.number}</Text>
        </View>
        <View style={styles.houseCardIconWrap}>
          <MaterialIcons name="remove-red-eye" size={18} color={theme.colors.gradientEnd} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4CAF50" translucent={false} />
      
      {/* ── Top Header (Solid Green) ── */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Ward Prashant</Text>
        </View>
        <TouchableOpacity>
          <MaterialIcons name="more-vert" size={26} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* ── Map Background ── */}
      <View style={styles.mapArea}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={DEFAULT_REGION}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          <Marker coordinate={DEFAULT_COORDINATES} title="Default Location" />
        </MapView>
      </View>

      {/* ── Floating Overlays ── */}
      <View style={styles.overlaysContainer}>
        {/* Floating Line Number Card */}
        <TouchableOpacity style={styles.lineNumberCard} activeOpacity={0.8}>
          <Text style={styles.lineNumberLeft}>Line Number</Text>
          <View style={styles.lineNumberRight}>
            <Text style={styles.lineNumberCount}>1/9</Text>
            <MaterialIcons name="chevron-right" size={22} color={theme.colors.gradientEnd} />
          </View>
        </TouchableOpacity>

        {/* Floating Map Action Buttons */}
        <View style={styles.mapActions}>
          <TouchableOpacity style={styles.mapActionBtn}>
            <FontAwesome6 name="route" size={20} color={theme.colors.gradientEnd} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapActionBtn}>
            <MaterialIcons name="my-location" size={24} color={theme.colors.gradientEnd} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Draggable Bottom Sheet ── */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY }] }]}>
        <View style={styles.sheetHandleWrap} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
        </View>

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Select House</Text>
          <Text style={styles.totalHousesText}>Total Houses: 20</Text>
        </View>

        {/* Dynamic Houses Scroll */}
        <View style={styles.listContainer}>
          {isExpanded ? (
            <ScrollView
              key="vertical-grid"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.housesGrid}
            >
              {dummyHouses.map((item) => renderCard(item, true))}
            </ScrollView>
          ) : (
            <ScrollView
              key="horizontal-list"
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.housesScroll}
            >
              {dummyHouses.map((item) => renderCard(item, false))}
            </ScrollView>
          )}
        </View>
      </Animated.View>

      <QrScanModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        onScanSuccess={handleQrScanSuccess}
      />
      <ImageCaptureModal
        visible={imageCaptureVisible}
        onClose={() => setImageCaptureVisible(false)}
        onCaptureSuccess={handleCardImageCaptured}
      />
      <CardDetailsModal
        visible={cardModalVisible}
        card={selectedCard}
        cardData={getCardState(selectedCard?.id)}
        onClose={() => setCardModalVisible(false)}
        onScanQr={() => setQrModalVisible(true)}
        onCaptureImage={() => setImageCaptureVisible(true)}
        onSave={handleManualSave}
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
  header: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    zIndex: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  mapArea: {
    ...StyleSheet.absoluteFillObject,
    top: 60,
    zIndex: 1,
  },
  map: {
    flex: 1,
  },
  overlaysContainer: {
    position: 'absolute',
    top: 56 + 16,
    left: 16,
    right: 16,
    zIndex: 5,
  },
  lineNumberCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  lineNumberLeft: {
    fontSize: 16,
    color: theme.colors.black,
    fontWeight: '500',
  },
  lineNumberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineNumberCount: {
    fontSize: 16,
    color: theme.colors.black,
    fontWeight: '600',
  },
  mapActions: {
    position: 'absolute',
    top: 80,
    right: 0,
    gap: 12,
  },
  mapActionBtn: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: -height * 0.45,
    height: height * 0.75,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 100,
  },
  sheetHandleWrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  sheetHandle: {
    width: 50,
    height: 5,
    backgroundColor: '#cbd5e1',
    borderRadius: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.black,
  },
  totalHousesText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.gradientEnd,
  },
  listContainer: {
    flex: 1, // Let scrollview take remaining height
  },
  housesScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  housesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
    justifyContent: 'flex-start',
  },
  houseCard: {
    width: 130, // For horizontal list default
    height: 140, // Height remains consistent
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  houseImageArea: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  houseCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  houseCardNumberWrap: {
    flex: 1,
  },
  houseCardNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.black,
  },
  houseCardIconWrap: {
    width: 24,
    alignItems: 'flex-end',
  },
});

export default MapScreen;
