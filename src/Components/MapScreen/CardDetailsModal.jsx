import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { theme } from '../../theme/appTheme';

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;

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
  onClose,
  onQrScanned,
  onCardImageCaptured,
  onHouseImageCaptured,
  onVerifyAndSave,
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
    const init = async () => {
      const status = await Camera.getCameraPermissionStatus();
      setPermissionStatus(status);
      if (status !== 'granted') requestPermission();
    };
    init();
  }, [visible]);

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
          </View>
          <View style={styles.scanningRow}>
            <MaterialIcons name="qr-code-scanner" size={16} color="rgba(255,255,255,0.8)" />
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
        {/* Reference Photo */}
        <Text style={styles.fieldLabel}>REFERENCE PHOTO</Text>
        <View style={styles.refPhotoFrame}>
          {card?.referenceImageUri ? (
            <Image source={{ uri: card.referenceImageUri }} style={styles.refPhotoImage} />
          ) : (
            <View style={styles.refPhotoPlaceholder}>
              <MaterialIcons name="home-work" size={32} color="#94a3b8" />
              <Text style={styles.refPhotoPlaceholderText}>No reference photo available</Text>
              <Text style={styles.refPhotoPlaceholderSub}>सुपरवाइजर से पूछें</Text>
            </View>
          )}
        </View>

        {/* Card Number */}
        <View style={styles.cardInfoRow}>
          <View style={styles.cardIconCircle}>
            <MaterialIcons name="credit-card" size={17} color={theme.colors.gradientEnd} />
          </View>
          <View style={styles.cardInfoText}>
            <Text style={styles.cardInfoLabel}>CARD NUMBER</Text>
            <Text style={styles.cardInfoValue}>{card?.number || '—'}</Text>
          </View>
        </View>

        {/* Info hint before start */}
        {!hasQr && (
          <View style={styles.hintBox}>
            <MaterialIcons name="info-outline" size={15} color="#3b82f6" />
            <Text style={styles.hintText}>
              ऊपर दी पुरानी फोटो से पक्का करें कि आप सही घर पर हैं, फिर नीचे से सर्वे शुरू करें।
            </Text>
          </View>
        )}

        {/* ── Step 1: QR Scan ── */}
        <View style={styles.stepCard}>
          <View style={styles.stepCardHeader}>
            <View style={[styles.stepBadge, hasQr && styles.stepBadgeDone]}>
              {hasQr
                ? <MaterialIcons name="check" size={13} color="#fff" />
                : <Text style={styles.stepBadgeText}>1</Text>}
            </View>
            <Text style={[styles.stepTitle, hasQr && styles.stepTitleDone]}>QR Code Scan</Text>
            {hasQr && (
              <TouchableOpacity style={styles.stepRetakeBtn} onPress={() => setView('qr')} activeOpacity={0.8}>
                <MaterialIcons name="refresh" size={13} color={theme.colors.gradientEnd} />
                <Text style={styles.stepRetakeBtnText}>Rescan</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasQr ? (
            <View style={styles.qrDoneChip}>
              <MaterialIcons name="qr-code" size={15} color={theme.colors.gradientEnd} />
              <Text style={styles.qrDoneChipText} numberOfLines={1}>{cardData.qrData}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.stepActionBtn} onPress={() => setView('qr')} activeOpacity={0.85}>
              <MaterialIcons name="qr-code-scanner" size={19} color="#fff" />
              <Text style={styles.stepActionBtnText}>Scan QR Code</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Step 2: Card Photo ── */}
        <View style={[styles.stepCard, !hasQr && styles.stepCardDisabled]}>
          <View style={styles.stepCardHeader}>
            <View style={[
              styles.stepBadge,
              hasCardImage && styles.stepBadgeDone,
              hasQr && !hasCardImage && styles.stepBadgeActive,
            ]}>
              {hasCardImage
                ? <MaterialIcons name="check" size={13} color="#fff" />
                : <Text style={[styles.stepBadgeText, hasQr && !hasCardImage && styles.stepBadgeTextActive]}>2</Text>}
            </View>
            <Text style={[
              styles.stepTitle,
              hasCardImage && styles.stepTitleDone,
              hasQr && !hasCardImage && styles.stepTitleActive,
              !hasQr && styles.stepTitleMuted,
            ]}>
              Card Photo
            </Text>
            {hasCardImage && (
              <TouchableOpacity style={styles.stepRetakeBtn} onPress={() => openCamera('card')} activeOpacity={0.8}>
                <MaterialIcons name="refresh" size={13} color={theme.colors.gradientEnd} />
                <Text style={styles.stepRetakeBtnText}>Retake</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasCardImage ? (
            <View>
              <Image source={{ uri: cardData.cardImageUri }} style={styles.capturedThumb} />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.stepActionBtn, !hasQr && styles.stepActionBtnDisabled]}
              onPress={() => hasQr && openCamera('card')}
              disabled={!hasQr}
              activeOpacity={0.85}
            >
              <MaterialIcons name="photo-camera" size={19} color={hasQr ? '#fff' : '#94a3b8'} />
              <Text style={[styles.stepActionBtnText, !hasQr && styles.stepActionBtnTextDisabled]}>
                Take Card Photo
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Step 3: House Photo ── */}
        <View style={[styles.stepCard, !hasCardImage && styles.stepCardDisabled]}>
          <View style={styles.stepCardHeader}>
            <View style={[
              styles.stepBadge,
              hasHouseImage && styles.stepBadgeDone,
              hasCardImage && !hasHouseImage && styles.stepBadgeActive,
            ]}>
              {hasHouseImage
                ? <MaterialIcons name="check" size={13} color="#fff" />
                : <Text style={[styles.stepBadgeText, hasCardImage && !hasHouseImage && styles.stepBadgeTextActive]}>3</Text>}
            </View>
            <Text style={[
              styles.stepTitle,
              hasHouseImage && styles.stepTitleDone,
              hasCardImage && !hasHouseImage && styles.stepTitleActive,
              !hasCardImage && styles.stepTitleMuted,
            ]}>
              House Photo
            </Text>
            {hasHouseImage && (
              <TouchableOpacity style={styles.stepRetakeBtn} onPress={() => openCamera('house')} activeOpacity={0.8}>
                <MaterialIcons name="refresh" size={13} color={theme.colors.gradientEnd} />
                <Text style={styles.stepRetakeBtnText}>Retake</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasHouseImage ? (
            <View>
              <Image source={{ uri: cardData.houseImageUri }} style={styles.capturedThumb} />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.stepActionBtn, !hasCardImage && styles.stepActionBtnDisabled]}
              onPress={() => hasCardImage && openCamera('house')}
              disabled={!hasCardImage}
              activeOpacity={0.85}
            >
              <MaterialIcons name="home" size={19} color={hasCardImage ? '#fff' : '#94a3b8'} />
              <Text style={[styles.stepActionBtnText, !hasCardImage && styles.stepActionBtnTextDisabled]}>
                Take House Photo
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {isSaved ? (
          <View style={styles.savedRow}>
            <MaterialIcons name="check-circle" size={18} color="#16a34a" />
            <Text style={styles.savedRowText}>Survey completed and saved</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.saveBtn, !allDone && styles.saveBtnDisabled]}
            onPress={allDone ? onVerifyAndSave : null}
            disabled={!allDone}
            activeOpacity={0.85}
          >
            <MaterialIcons name="check-circle" size={20} color={allDone ? '#fff' : '#94a3b8'} />
            <Text style={[styles.saveBtnText, !allDone && styles.saveBtnTextDisabled]}>
              {allDone ? 'Verify and Save' : 'Complete all steps to save'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  // ── Header config per view ──
  const headerMap = {
    form:    { title: 'House Details',                          icon: 'home-work',       dark: false },
    qr:      { title: 'Scan QR', icon: 'qr-code-scanner', dark: true },
    camera:  { title: captureType === 'card' ? 'Card Photo' : 'House Photo', icon: captureType === 'card' ? 'credit-card' : 'home', dark: true },
    preview: { title: 'Preview Photo',                          icon: 'photo',           dark: true },
  };
  const { title: hTitle, icon: hIcon, dark: hDark } = headerMap[view] || headerMap.form;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={view !== 'form' ? handleBackToForm : onClose}
    >
      <View style={[styles.container, hDark && styles.containerDark]}>

        {/* ── Header ── */}
        <View style={[styles.header, hDark && styles.headerDark]}>
          <View style={styles.headerLeft}>
            {view !== 'form' && (
              <TouchableOpacity onPress={handleBackToForm} hitSlop={10} style={styles.backBtn}>
                <MaterialIcons name="arrow-back" size={18} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            )}
            <View style={[styles.headerIconWrap, hDark && styles.headerIconWrapDark]}>
              <MaterialIcons name={hIcon} size={18} color={theme.colors.white} />
            </View>
            <Text style={styles.headerTitle}>{hTitle}</Text>
          </View>
          {view === 'form' && (
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
            >
              <MaterialIcons name="close" size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Body ── */}
        <View style={styles.body}>
          {view === 'form'    && renderFormView()}
          {view === 'qr'     && renderQrView()}
          {view === 'camera' && renderCameraView()}
          {view === 'preview'&& renderPreviewView()}
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
    backgroundColor: theme.colors.gradientStart,
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
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    gap: 12,
  },

  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.7,
  },

  refPhotoFrame: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
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
    gap: 6,
  },
  refPhotoPlaceholderText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  refPhotoPlaceholderSub: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '400',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
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
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.gradientStart,
    borderRadius: 12,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: theme.colors.gradientEnd,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  saveBtnDisabled: {
    backgroundColor: '#f1f5f9',
    elevation: 0,
    shadowOpacity: 0,
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
