import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { theme } from '../../theme/appTheme';

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;

// ── Module-level image load cache (survives modal re-mounts) ──────────────────
const _imgLoadCache = {};

// ── Cached network image — skips spinner if already loaded this session ───────
const CachedNetworkImage = ({ uri, style }) => {
  const [loaded, setLoaded] = useState(_imgLoadCache[uri] ?? false);
  const [error, setError] = useState(false);
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      {!loaded && !error && (
        <View style={[StyleSheet.absoluteFill, styles.imgLoadingWrap]}>
          <ActivityIndicator color={theme.colors.gradientEnd} />
        </View>
      )}
      {error && (
        <View style={[StyleSheet.absoluteFill, styles.imgLoadingWrap]}>
          <MaterialIcons name="broken-image" size={28} color="#94a3b8" />
          <Text style={styles.imgErrText}>Photo nahi mili</Text>
        </View>
      )}
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: loaded && !error ? 1 : 0 }]}
          onLoad={() => { _imgLoadCache[uri] = true; setLoaded(true); }}
          onError={() => setError(true)}
        />
      ) : null}
    </View>
  );
};

// ── Firebase Storage URL builder ──────────────────────────────────────────────
const buildStorageUrl = (ward, lineId, cardNumber, fileName) => {
  const path = `DevTest/HUFCardData/${ward}/${lineId}/${cardNumber}/${fileName}`;
  const encoded = path.split('/').map(encodeURIComponent).join('%2F');
  return `https://firebasestorage.googleapis.com/v0/b/devtest-62768.firebasestorage.app/o/${encoded}?alt=media`;
};

// ── Corner guides for camera frame ────────────────────────────────────────────
const CameraCorners = () => (
  <>
    <View style={[styles.corner, styles.cornerTL]} />
    <View style={[styles.corner, styles.cornerTR]} />
    <View style={[styles.corner, styles.cornerBL]} />
    <View style={[styles.corner, styles.cornerBR]} />
  </>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const CardDetailsModal = ({
  visible,
  card,
  cardData,
  ward,
  lineId,
  onClose,
  onQrScanned,
  onCardImageCaptured,
  onHouseImageCaptured,
  onVerifyAndSave,
  onTrackingPause,
  onTrackingResume,
}) => {
  // view: 'form' | 'qr' | 'camera' | 'preview'
  const [view, setView] = useState('form');
  const [captureType, setCaptureType] = useState(null); // 'card' | 'house'
  const [previewUri, setPreviewUri] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('not-determined');
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const hasScannedRef = useRef(false);
  const cameraRef = useRef(null);
  const onQrScannedRef = useRef(onQrScanned);
  onQrScannedRef.current = onQrScanned;
  const device = useCameraDevice('back');
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Scanning line animation — runs while QR view is active
  useEffect(() => {
    if (view !== 'qr') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [view, scanLineAnim]);

  // Pause GPS tracking when camera is active, resume when not
  useEffect(() => {
    if (view === 'camera') {
      onTrackingPause?.();
    } else {
      onTrackingResume?.();
    }
  }, [view, onTrackingPause, onTrackingResume]);

  const hasQr = Boolean(cardData?.qrData);
  const hasCardImage = Boolean(cardData?.cardImageUri);
  const hasHouseImage = Boolean(cardData?.houseImageUri);
  const isSaved = Boolean(cardData?.saved);
  const allDone = hasQr && hasCardImage && hasHouseImage;

  // ── Permission ──
  const requestPermission = async () => {
    try {
      setRequestingPermission(true);
      const status = await Camera.requestCameraPermission();
      setPermissionStatus(status);
    } finally {
      setRequestingPermission(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      setView('form');
      setPreviewUri(null);
      setCaptureType(null);
      hasScannedRef.current = false;
      return;
    }
    // If already surveyed (has hufRfidNumber from Firebase), show read-only view
    if (String(card?.hufRfidNumber || '').trim()) {
      setView('surveyed');
      return;
    }
    const init = async () => {
      const status = await Camera.getCameraPermissionStatus();
      setPermissionStatus(status);
      if (status !== 'granted') requestPermission();
    };
    init();
  }, [visible, card?.hufRfidNumber]);

  useEffect(() => {
    if (view === 'qr') {
      hasScannedRef.current = false;
    }
  }, [view]);

  // ── QR Code Scanner ──
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (hasScannedRef.current) return;
      const val = codes?.[0]?.value;
      if (!val) return;
      hasScannedRef.current = true;
      onQrScannedRef.current?.(val);
      setView('form');
    },
  });

  // ── Camera / Photo Actions ──
  const openCamera = (type) => {
    setCaptureType(type);
    setPreviewUri(null);
    setView('camera');
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      setPreviewUri(uri);
      setView('preview');
    } catch {
      setPreviewUri(null);
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = () => {
    setPreviewUri(null);
    setView('camera');
  };

  const handleUsePhoto = () => {
    if (!previewUri) return;
    if (captureType === 'card') {
      onCardImageCaptured?.(previewUri);
    } else {
      onHouseImageCaptured?.(previewUri);
    }
    setPreviewUri(null);
    setView('form');
  };

  const handleBackToForm = () => {
    setView('form');
    setPreviewUri(null);
    hasScannedRef.current = false;
  };

  // ── RENDER: Permission Screen ──
  const renderPermission = () => (
    <View style={styles.centeredWrap}>
      <View style={styles.permIconCircle}>
        <MaterialIcons name="no-photography" size={36} color="#94a3b8" />
      </View>
      <Text style={styles.darkTitle}>Camera Permission Required</Text>
      <Text style={styles.darkSubText}>QR स्कैन और फोटो के लिए कैमरा की परमिशन दें।</Text>
      <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
        {requestingPermission ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.permBtnText}>Allow Camera Permission</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ── RENDER: QR Scan View ──
  const renderQrView = () => {
    if (permissionStatus !== 'granted') return renderPermission();

    if (!device) {
      return (
        <View style={styles.centeredWrap}>
          <ActivityIndicator size="large" color={theme.colors.gradientStart} />
          <Text style={styles.darkSubText}>कैमरा खुल रहा है...</Text>
        </View>
      );
    }

    return (
      <View style={styles.cameraWrap}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible && view === 'qr'}
          codeScanner={codeScanner}
        />
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraHintText}>कार्ड का QR कोड फ्रेम में रखें</Text>
          <View style={styles.scanFrame}>
            <CameraCorners />
            {/* Animated scan line */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [{
                    translateY: scanLineAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 230],
                    }),
                  }],
                },
              ]}
            />
          </View>
          <View style={styles.scanningRow}>
            <Animated.View style={{ opacity: scanLineAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1, 0.5] }) }}>
              <MaterialIcons name="qr-code-scanner" size={16} color="#4ade80" />
            </Animated.View>
            <Text style={styles.scanningText}>स्कैन हो रहा है...</Text>
          </View>
        </View>
      </View>
    );
  };

  // ── RENDER: Photo Camera View ──
  const renderCameraView = () => {
    if (permissionStatus !== 'granted') return renderPermission();

    if (!device) {
      return (
        <View style={styles.centeredWrap}>
          <ActivityIndicator size="large" color={theme.colors.gradientStart} />
          <Text style={styles.darkSubText}>कैमरा लोड हो रहा है...</Text>
        </View>
      );
    }

    const isCard = captureType === 'card';
    return (
      <View style={styles.cameraWrap}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible && view === 'camera'}
          photo
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraTopSection}>
            <Text style={styles.cameraHintText}>
              {isCard ? 'कार्ड को फ्रेम के अंदर रखें' : 'घर पर कार्ड लगाकर फोटो लें'}
            </Text>
            <View style={[styles.captureFrame, { width: isCard ? 260 : 290, height: isCard ? 165 : 210 }]}>
              <CameraCorners />
            </View>
          </View>
          <View style={styles.cameraBottomSection}>
            <TouchableOpacity
              style={styles.captureBtn}
              onPress={handleCapture}
              disabled={capturing}
              activeOpacity={0.9}
            >
              {capturing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.captureBtnInner} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ── RENDER: Photo Preview View ──
  const renderPreviewView = () => (
    <View style={styles.previewWrap}>
      <Image source={{ uri: previewUri }} style={styles.previewImage} />
      <View style={styles.previewLabelBadge}>
        <MaterialIcons name="photo" size={13} color="rgba(255,255,255,0.85)" />
        <Text style={styles.previewLabelText}>
          {captureType === 'card' ? 'Card Photo' : 'House Photo'}
        </Text>
      </View>
      <View style={styles.previewActions}>
        <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={17} color="#475569" />
          <Text style={styles.retakeBtnText}>Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.usePhotoBtn} onPress={handleUsePhoto} activeOpacity={0.85}>
          <MaterialIcons name="check" size={17} color="#fff" />
          <Text style={styles.usePhotoBtnText}>Use Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── RENDER: Main Form View ──
  const renderFormView = () => (
    <>
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Reference Photo + Card Info combined hero ── */}
        <View style={styles.heroCard}>
          <View style={styles.refPhotoFrame}>
            {card?.referenceImageUri ? (
              <Image source={{ uri: card.referenceImageUri }} style={styles.refPhotoImage} />
            ) : (
              <View style={styles.refPhotoPlaceholder}>
                <MaterialIcons name="home-work" size={36} color="#94a3b8" />
                <Text style={styles.refPhotoPlaceholderText}>Reference photo nahi hai</Text>
                <Text style={styles.refPhotoPlaceholderSub}>सुपरवाइजर से पूछें</Text>
              </View>
            )}
            <View style={styles.refPhotoLabel}>
              <MaterialIcons name="photo-library" size={11} color="rgba(255,255,255,0.85)" />
              <Text style={styles.refPhotoLabelText}>Reference</Text>
            </View>
          </View>
          {/* Card info bar below photo */}
          <View style={styles.cardInfoBar}>
            <View style={styles.cardInfoBarLeft}>
              <View style={styles.cardIconCircle}>
                <MaterialIcons name="credit-card" size={16} color={theme.colors.gradientEnd} />
              </View>
              <View>
                <Text style={styles.cardInfoLabel}>CARD NUMBER</Text>
                <Text style={styles.cardInfoValue}>{card?.number || '—'}</Text>
              </View>
            </View>
            {isSaved && (
              <View style={styles.savedBadge}>
                <MaterialIcons name="verified" size={13} color={theme.colors.gradientEnd} />
                <Text style={styles.savedBadgeText}>Saved</Text>
              </View>
            )}
          </View>
        </View>

        {/* Info hint before start */}
        {!hasQr && (
          <View style={styles.hintBox}>
            <MaterialIcons name="lightbulb-outline" size={16} color="#f59e0b" />
            <Text style={styles.hintText}>
              ऊपर दिखाई गई पुरानी फोटो से घर की पहचान सुनिश्चित करें, उसके बाद सर्वे शुरू करें।
            </Text>
          </View>
        )}

        {/* ── Steps Section ── */}
        <View style={styles.stepsSection}>

          {/* Step 1: QR Scan */}
          <View style={styles.stepRow}>
            <View style={styles.stepLeft}>
              <View style={[styles.stepCircle, hasQr ? styles.stepCircleDone : styles.stepCircleActive]}>
                {hasQr
                  ? <MaterialIcons name="check" size={15} color="#fff" />
                  : <MaterialIcons name="qr-code-scanner" size={15} color="#fff" />}
              </View>
              <View style={[styles.stepConnector, hasQr && styles.stepConnectorDone]} />
            </View>
            <View style={[styles.stepContent, { marginBottom: 8 }]}>
              <View style={styles.stepTitleRow}>
                <Text style={[styles.stepLabel, hasQr && styles.stepLabelDone]}>QR Code Scan</Text>
                {hasQr && (
                  <TouchableOpacity style={styles.stepRetakeBtn} onPress={() => { hasScannedRef.current = false; setView('qr'); }} activeOpacity={0.8}>
                    <MaterialIcons name="refresh" size={12} color={theme.colors.gradientEnd} />
                    <Text style={styles.stepRetakeBtnText}>Rescan</Text>
                  </TouchableOpacity>
                )}
              </View>
              {hasQr ? (
                <View style={styles.qrDoneChip}>
                  <MaterialIcons name="qr-code" size={13} color={theme.colors.gradientEnd} />
                  <Text style={styles.qrDoneChipText} numberOfLines={1}>{cardData.qrData}</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.stepActionBtn} onPress={() => setView('qr')} activeOpacity={0.85}>
                  <MaterialIcons name="qr-code-scanner" size={18} color="#fff" />
                  <Text style={styles.stepActionBtnText}>Scan QR Code</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Step 2: Card Photo */}
          <View style={styles.stepRow}>
            <View style={styles.stepLeft}>
              <View style={[
                styles.stepCircle,
                hasCardImage ? styles.stepCircleDone : hasQr ? styles.stepCircleActive : styles.stepCircleIdle,
              ]}>
                {hasCardImage
                  ? <MaterialIcons name="check" size={15} color="#fff" />
                  : <MaterialIcons name="photo-camera" size={15} color={hasQr ? '#fff' : '#94a3b8'} />}
              </View>
              <View style={[styles.stepConnector, hasCardImage && styles.stepConnectorDone]} />
            </View>
            <View style={[styles.stepContent, !hasQr && styles.stepContentMuted, { marginBottom: 8 }]}>
              <View style={styles.stepTitleRow}>
                <Text style={[styles.stepLabel, hasCardImage && styles.stepLabelDone, !hasQr && styles.stepLabelMuted]}>Card Photo</Text>
                {hasCardImage && (
                  <TouchableOpacity style={styles.stepRetakeBtn} onPress={() => openCamera('card')} activeOpacity={0.8}>
                    <MaterialIcons name="refresh" size={12} color={theme.colors.gradientEnd} />
                    <Text style={styles.stepRetakeBtnText}>Retake</Text>
                  </TouchableOpacity>
                )}
              </View>
              {hasCardImage ? (
                <Image source={{ uri: cardData.cardImageUri }} style={styles.capturedThumb} />
              ) : (
                <TouchableOpacity
                  style={[styles.stepActionBtn, !hasQr && styles.stepActionBtnDisabled]}
                  onPress={() => hasQr && openCamera('card')}
                  disabled={!hasQr}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="photo-camera" size={18} color={hasQr ? '#fff' : '#94a3b8'} />
                  <Text style={[styles.stepActionBtnText, !hasQr && styles.stepActionBtnTextDisabled]}>
                    Take Card Photo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Step 3: House Photo */}
          <View style={[styles.stepRow, { marginBottom: 0 }]}>
            <View style={styles.stepLeft}>
              <View style={[
                styles.stepCircle,
                hasHouseImage ? styles.stepCircleDone : hasCardImage ? styles.stepCircleActive : styles.stepCircleIdle,
              ]}>
                {hasHouseImage
                  ? <MaterialIcons name="check" size={15} color="#fff" />
                  : <MaterialIcons name="home" size={15} color={hasCardImage ? '#fff' : '#94a3b8'} />}
              </View>
            </View>
            <View style={[styles.stepContent, !hasCardImage && styles.stepContentMuted]}>
              <View style={styles.stepTitleRow}>
                <Text style={[styles.stepLabel, hasHouseImage && styles.stepLabelDone, !hasCardImage && styles.stepLabelMuted]}>House Photo</Text>
                {hasHouseImage && (
                  <TouchableOpacity style={styles.stepRetakeBtn} onPress={() => openCamera('house')} activeOpacity={0.8}>
                    <MaterialIcons name="refresh" size={12} color={theme.colors.gradientEnd} />
                    <Text style={styles.stepRetakeBtnText}>Retake</Text>
                  </TouchableOpacity>
                )}
              </View>
              {hasHouseImage ? (
                <Image source={{ uri: cardData.houseImageUri }} style={styles.capturedThumb} />
              ) : (
                <TouchableOpacity
                  style={[styles.stepActionBtn, !hasCardImage && styles.stepActionBtnDisabled]}
                  onPress={() => hasCardImage && openCamera('house')}
                  disabled={!hasCardImage}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="home" size={18} color={hasCardImage ? '#fff' : '#94a3b8'} />
                  <Text style={[styles.stepActionBtnText, !hasCardImage && styles.stepActionBtnTextDisabled]}>
                    Take House Photo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {isSaved ? (
          <View style={styles.savedRow}>
            <MaterialIcons name="check-circle" size={18} color="#16a34a" />
            <Text style={styles.savedRowText}>Survey completed</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.saveBtnWrapper}
            onPress={allDone ? onVerifyAndSave : null}
            disabled={!allDone}
            activeOpacity={0.85}
          >
            {allDone ? (
              <LinearGradient
                colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <MaterialIcons name="check-circle" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Verify and Save</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.saveBtn, styles.saveBtnDisabled]}>
                <MaterialIcons name="check-circle" size={20} color="#94a3b8" />
                <Text style={[styles.saveBtnText, styles.saveBtnTextDisabled]}>
                  Complete all steps to save
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  // ── RENDER: Surveyed House Details View ──
  const renderSurveyedView = () => {
    const hufNumber  = String(card?.hufRfidNumber || '').trim();
    const cardNumber = String(card?.number || '').trim();
    const cardImgUrl  = (ward && lineId && cardNumber && hufNumber)
      ? buildStorageUrl(ward, lineId, cardNumber, `${hufNumber}.jpg`)
      : null;
    const houseImgUrl = (ward && lineId && cardNumber)
      ? buildStorageUrl(ward, lineId, cardNumber, 'houseImg.jpg')
      : null;

    return (
      <>
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HUF Number info card */}
          <View style={styles.hufInfoCard}>
            <View style={styles.hufIconCircle}>
              <MaterialIcons name="nfc" size={22} color={theme.colors.gradientEnd} />
            </View>
            <View style={styles.hufInfoText}>
              <Text style={styles.hufLabel}>HUF RFID NUMBER</Text>
              <Text style={styles.hufValue}>{hufNumber}</Text>
            </View>
            <View style={styles.surveyedBadge}>
              <MaterialIcons name="verified" size={12} color={theme.colors.gradientEnd} />
              <Text style={styles.surveyedBadgeText}>Surveyed</Text>
            </View>
          </View>

          {/* Card Number info */}
          <View style={styles.cardNumRow}>
            <View style={styles.cardNumIconCircle}>
              <MaterialIcons name="credit-card" size={16} color={theme.colors.gradientEnd} />
            </View>
            <View>
              <Text style={styles.cardNumLabel}>CARD NUMBER</Text>
              <Text style={styles.cardNumValue}>{cardNumber || '—'}</Text>
            </View>
          </View>

          {/* Card Photo */}
          <View style={styles.surveyedImgCard}>
            <View style={styles.surveyedImgCardHeader}>
              <MaterialIcons name="credit-card" size={15} color={theme.colors.gradientEnd} />
              <Text style={styles.surveyedImgCardTitle}>Card Photo</Text>
            </View>
            <CachedNetworkImage uri={cardImgUrl} style={styles.surveyedImg} />
          </View>

          {/* House Photo */}
          <View style={styles.surveyedImgCard}>
            <View style={styles.surveyedImgCardHeader}>
              <MaterialIcons name="home" size={15} color={theme.colors.gradientEnd} />
              <Text style={styles.surveyedImgCardTitle}>House Photo</Text>
            </View>
            <CachedNetworkImage uri={houseImgUrl} style={styles.surveyedImg} />
          </View>
        </ScrollView>
      </>
    );
  };

  // ── Header config per view ──
  const headerMap = {
    form:     { title: 'House Details',                         icon: 'home-work',       dark: false },
    surveyed: { title: 'Survey Details',                        icon: 'verified',        dark: false },
    qr:       { title: 'Scan QR',                               icon: 'qr-code-scanner', dark: true },
    camera:   { title: captureType === 'card' ? 'Card Photo' : 'House Photo', icon: captureType === 'card' ? 'credit-card' : 'home', dark: true },
    preview:  { title: 'Preview Photo',                         icon: 'photo',           dark: true },
  };
  const { title: hTitle, icon: hIcon, dark: hDark } = headerMap[view] || headerMap.form;

  const isTopLevel = view === 'form' || view === 'surveyed';

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={isTopLevel ? onClose : handleBackToForm}
    >
      <View style={[styles.container, hDark && styles.containerDark]}>

        {/* ── Header ── */}
        <LinearGradient
          colors={hDark
            ? ['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.55)']
            : [theme.colors.gradientStart, theme.colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.header, hDark && styles.headerDark]}
        >
          <View style={styles.headerLeft}>
            {!isTopLevel && (
              <TouchableOpacity onPress={handleBackToForm} hitSlop={10} style={styles.backBtn}>
                <MaterialIcons name="arrow-back" size={18} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            )}
            <View style={[styles.headerIconWrap, hDark && styles.headerIconWrapDark]}>
              <MaterialIcons name={hIcon} size={18} color={theme.colors.white} />
            </View>
            <Text style={styles.headerTitle}>{hTitle}</Text>
          </View>
          {isTopLevel && (
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
            >
              <MaterialIcons name="close" size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* ── Body ── */}
        <View style={styles.body}>
          {view === 'form'     && renderFormView()}
          {view === 'surveyed' && renderSurveyedView()}
          {view === 'qr'       && renderQrView()}
          {view === 'camera'   && renderCameraView()}
          {view === 'preview'  && renderPreviewView()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#0f172a',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  headerDark: {
    elevation: 0,
    shadowOpacity: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconWrapDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  body: { flex: 1 },

  // ── Form View ──
  scrollBody: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 14,
  },

  // ── Hero Card (photo + card info) ──
  heroCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  refPhotoFrame: {
    height: 170,
    backgroundColor: '#f8fafc',
  },
  refPhotoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  refPhotoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  refPhotoPlaceholderText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  refPhotoPlaceholderSub: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '400',
  },
  refPhotoLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  refPhotoLabelText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  cardInfoBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  savedBadgeText: {
    color: theme.colors.gradientEnd,
    fontSize: 11,
    fontWeight: '700',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  cardIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Steps Section ──
  stepsSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  stepLeft: {
    alignItems: 'center',
    width: 32,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.gradientStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleDone: {
    backgroundColor: theme.colors.gradientEnd,
  },
  stepCircleActive: {
    backgroundColor: theme.colors.gradientStart,
  },
  stepCircleIdle: {
    backgroundColor: '#e2e8f0',
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 1,
    marginVertical: 3,
  },
  stepConnectorDone: {
    backgroundColor: theme.colors.gradientStart,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 14,
  },
  stepContentMuted: {
    opacity: 0.5,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 32,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  stepLabelDone: {
    color: theme.colors.gradientEnd,
  },
  stepLabelMuted: {
    color: '#94a3b8',
  },
  cardInfoText: { flex: 1, gap: 2 },
  cardInfoLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardInfoValue: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hintText: {
    flex: 1,
    color: '#1e40af',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },

  // ── Step Cards ──
  stepCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  stepCardDisabled: {
    opacity: 0.5,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeActive: {
    backgroundColor: theme.colors.gradientStart,
  },
  stepBadgeDone: {
    backgroundColor: theme.colors.gradientEnd,
  },
  stepBadgeText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  stepBadgeTextActive: {
    color: '#fff',
  },
  stepTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  stepTitleActive: {
    color: '#0f172a',
  },
  stepTitleDone: {
    color: theme.colors.gradientEnd,
  },
  stepTitleMuted: {
    color: '#94a3b8',
  },
  stepRetakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  stepRetakeBtnText: {
    color: theme.colors.gradientEnd,
    fontSize: 11,
    fontWeight: '700',
  },

  stepActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 10,
    backgroundColor: theme.colors.gradientStart,
    borderRadius: 9,
    paddingVertical: 11,
    elevation: 2,
    shadowColor: theme.colors.gradientEnd,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  stepActionBtnDisabled: {
    backgroundColor: '#f1f5f9',
    elevation: 0,
    shadowOpacity: 0,
  },
  stepActionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stepActionBtnTextDisabled: {
    color: '#94a3b8',
  },

  qrDoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    margin: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  qrDoneChipText: {
    flex: 1,
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
  },

  capturedThumb: {
    margin: 10,
    height: 120,
    borderRadius: 9,
    resizeMode: 'cover',
    backgroundColor: '#f1f5f9',
  },
  tapRetakeText: {
    textAlign: 'center',
    color: theme.colors.gradientEnd,
    fontSize: 11,
    fontWeight: '600',
    marginTop: -6,
    marginBottom: 10,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  // ── Image loading wrapper ──
  imgLoadingWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  imgErrText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },

  // ── Surveyed View ──
  hufInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    paddingHorizontal: 14,
    paddingVertical: 14,
    elevation: 1,
    shadowColor: theme.colors.gradientEnd,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  hufIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hufInfoText: {
    flex: 1,
  },
  hufLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  hufValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  surveyedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },
  surveyedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.gradientEnd,
  },
  cardNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardNumIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardNumLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  cardNumValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  surveyedImgCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  surveyedImgCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  surveyedImgCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  surveyedImg: {
    height: 200,
    backgroundColor: '#f8fafc',
  },
  saveBtnClose: {
    backgroundColor: '#f1f5f9',
  },
  saveBtnTextClose: {
    color: '#475569',
  },

  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingVertical: 13,
  },
  savedRowText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtnWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: theme.colors.gradientEnd,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveBtnDisabled: {
    backgroundColor: '#f1f5f9',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  saveBtnTextDisabled: {
    color: '#94a3b8',
  },

  // ── Camera / QR Views ──
  cameraWrap: { flex: 1 },
  cameraOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
  },
  cameraTopSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBottomSection: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  cameraHintText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 22,
    letterSpacing: 0.2,
  },

  // QR frame
  scanFrame: {
    width: 240,
    height: 240,
    position: 'relative',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#4ade80',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  // Capture frame for photos
  captureFrame: {
    position: 'relative',
  },
  // Corner guides
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#ffffff',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 6 },

  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 26,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scanningText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },

  captureBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
  },

  // ── QR Result ──
  qrResultWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 16,
  },
  qrResultIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#c8e6c9',
  },
  qrSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qrSuccessText: {
    color: '#16a34a',
    fontSize: 16,
    fontWeight: '700',
  },
  qrResultCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 4,
    alignItems: 'center',
  },
  qrResultLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  qrResultValue: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  qrResultHint: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  qrResultActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  qrRescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.gradientStart,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  qrRescanBtnText: {
    color: theme.colors.gradientEnd,
    fontSize: 14,
    fontWeight: '700',
  },
  qrConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.gradientStart,
    borderRadius: 10,
    paddingVertical: 13,
    elevation: 3,
    shadowColor: theme.colors.gradientEnd,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  qrConfirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Preview ──
  previewWrap: { flex: 1 },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
    backgroundColor: '#000',
  },
  previewLabelBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  previewLabelText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: '#0f172a',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  retakeBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  usePhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.gradientStart,
    borderRadius: 10,
    paddingVertical: 13,
    elevation: 3,
    shadowColor: theme.colors.gradientEnd,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  usePhotoBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Shared dark views ──
  centeredWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  permIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkTitle: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  darkSubText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  permBtn: {
    marginTop: 4,
    backgroundColor: theme.colors.gradientStart,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 160,
    alignItems: 'center',
  },
  permBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default CardDetailsModal;
