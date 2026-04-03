import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { theme } from '../../theme/appTheme';

const STEPS = [
  {
    key: 'card',
    title: 'Capture Card Photo',
    hint: 'कार्ड को फ्रेम के अंदर रखें',
    icon: 'credit-card',
    label: 'Card Photo',
    frameW: 260,
    frameH: 165,
    frameRadius: 12,
  },
  {
    key: 'house',
    title: 'Capture House Photo',
    hint: 'घर पर कार्ड लगाकर फोटो लें',
    icon: 'home',
    label: 'House Photo',
    frameW: 290,
    frameH: 210,
    frameRadius: 10,
  },
];

const CORNER_SIZE = 20;
const CORNER_THICKNESS = 3;
const HEADER_TOP_PADDING = (StatusBar.currentHeight || 0) + 10;

const ImageCaptureModal = ({ visible, onClose, onCaptureSuccess, onCancelBeforeSave, qrData }) => {
  const [permissionStatus, setPermissionStatus] = useState('not-determined');
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [cardImageUri, setCardImageUri] = useState('');
  const [houseImageUri, setHouseImageUri] = useState('');
  const [previewUri, setPreviewUri] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [recaptureFromReviewStep, setRecaptureFromReviewStep] = useState(null);

  const device = useCameraDevice('back');
  const cameraRef = useRef(null);

  const currentStep = STEPS[stepIndex];

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
      setStepIndex(0);
      setCardImageUri('');
      setHouseImageUri('');
      setPreviewUri('');
      setShowReview(false);
      setRecaptureFromReviewStep(null);
      return;
    }

    const initPermission = async () => {
      const currentStatus = await Camera.getCameraPermissionStatus();
      setPermissionStatus(currentStatus);
      if (currentStatus !== 'granted') {
        await requestPermission();
      }
    };

    initPermission();
  }, [visible]);

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      setPreviewUri(uri);
    } catch {
      setPreviewUri('');
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = () => setPreviewUri('');

  // Step 0 confirmed → store card image, move to step 1
  const handleNext = () => {
    setCardImageUri(previewUri);
    setPreviewUri('');
    if (recaptureFromReviewStep === 0) {
      setRecaptureFromReviewStep(null);
      setShowReview(true);
      return;
    }
    setStepIndex(1);
  };

  // Step 1 confirmed → show review screen
  const handleGoToReview = () => {
    setHouseImageUri(previewUri);
    setShowReview(true);
    setRecaptureFromReviewStep(null);
  };

  // Review: Save → call success + close
  const handleSave = () => {
    onCaptureSuccess?.({ cardImageUri, houseImageUri: houseImageUri || previewUri });
    onClose?.();
  };

  // Review: Cancel → go back to step 1 preview
  const handleCancelReview = () => {
    setShowReview(false);
    setStepIndex(1);
    setPreviewUri(houseImageUri);
  };

  const handleBack = () => {
    if (showReview) {
      setShowReview(false);
      setStepIndex(1);
      setPreviewUri(houseImageUri);
      return;
    }

    if (previewUri) {
      setPreviewUri('');
      return;
    }

    if (stepIndex === 1) {
      if (recaptureFromReviewStep === 1) {
        setRecaptureFromReviewStep(null);
        setShowReview(true);
      } else {
        setStepIndex(0);
        setPreviewUri(cardImageUri);
      }
    }
  };

  const handleRecaptureFromReview = (targetStep) => {
    setShowReview(false);
    setRecaptureFromReviewStep(targetStep);
    setStepIndex(targetStep);
    setPreviewUri('');
  };

  const handleCloseBeforeSave = () => {
    onCancelBeforeSave?.();
    onClose?.();
  };

  // ── Permission View ──
  const renderPermissionView = () => (
    <View style={styles.centerContent}>
      <View style={styles.permIconCircle}>
        <MaterialIcons name="no-photography" size={34} color="#94a3b8" />
      </View>
      <Text style={styles.infoTitle}>Camera Permission Required</Text>
      <Text style={styles.infoText}>फोटो लेने के लिए कैमरा अनुमति दें।</Text>
      <TouchableOpacity style={styles.allowBtn} onPress={requestPermission} activeOpacity={0.85}>
        {requestingPermission ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.allowBtnText}>Allow Permission</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ── Preview View ──
  const renderPreview = () => (
    <View style={styles.previewWrap}>
      <Image source={{ uri: previewUri }} style={styles.previewImage} />

      <View style={styles.previewLabelRow}>
        <MaterialIcons name="photo" size={14} color="rgba(255,255,255,0.8)" />
        <Text style={styles.previewLabelText}>
          {stepIndex === 0 ? 'Card Photo' : 'House Photo'}
        </Text>
      </View>

      <View style={styles.previewActions}>
        <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={17} color={theme.colors.gradientEnd} />
          <Text style={styles.retakeBtnText}>Retake</Text>
        </TouchableOpacity>

        {stepIndex === 0 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            {recaptureFromReviewStep === 0 ? (
              <>
                <MaterialIcons name="check" size={17} color="#fff" />
                <Text style={styles.nextBtnText}>Update Photo</Text>
              </>
            ) : (
              <>
                <Text style={styles.nextBtnText}>Next: House Photo</Text>
                <MaterialIcons name="arrow-forward" size={17} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleGoToReview} activeOpacity={0.85}>
            {recaptureFromReviewStep === 1 ? (
              <>
                <MaterialIcons name="check" size={17} color="#fff" />
                <Text style={styles.nextBtnText}>Update Photo</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="fact-check" size={17} color="#fff" />
                <Text style={styles.nextBtnText}>Verify</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ── Review View ──
  const renderReview = () => (
    <ScrollView
      contentContainerStyle={styles.reviewContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.reviewHeading}>Review Photos</Text>
      <Text style={styles.reviewSubHeading}>फोटो सही लगें तो आगे बढ़ें, अंतिम Save House Details स्क्रीन पर होगा।</Text>

      {/* QR data */}
      {qrData ? (
        <View style={styles.reviewQrChip}>
          <MaterialIcons name="qr-code" size={16} color={theme.colors.gradientEnd} />
          <Text style={styles.reviewQrLabel}>QR:</Text>
          <Text style={styles.reviewQrValue} numberOfLines={1}>{qrData}</Text>
        </View>
      ) : null}

      {/* Both images */}
      <View style={styles.reviewImagesRow}>
        <TouchableOpacity
          style={styles.reviewImageTile}
          activeOpacity={0.85}
          onPress={() => handleRecaptureFromReview(0)}
        >
          <Text style={styles.reviewImageLabel}>Card Photo</Text>
          <Image source={{ uri: cardImageUri }} style={styles.reviewImage} />
          <Text style={styles.tapToRetakeText}>Tap to recapture</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.reviewImageTile}
          activeOpacity={0.85}
          onPress={() => handleRecaptureFromReview(1)}
        >
          <Text style={styles.reviewImageLabel}>House Photo</Text>
          <Image source={{ uri: houseImageUri || previewUri }} style={styles.reviewImage} />
          <Text style={styles.tapToRetakeText}>Tap to recapture</Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={styles.reviewActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelReview} activeOpacity={0.85}>
          <MaterialIcons name="arrow-back" size={17} color={theme.colors.gradientEnd} />
          <Text style={styles.cancelBtnText}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <MaterialIcons name="check" size={17} color="#fff" />
          <Text style={styles.saveBtnText}>Use Photos</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ── Camera View ──
  const renderCamera = () => {
    if (!device) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.gradientStart} />
          <Text style={styles.infoText}>कैमरा लोड हो रहा है...</Text>
        </View>
      );
    }

    return (
      <View style={styles.scannerWrap}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible && !previewUri && !showReview}
          photo
        />
        <View style={styles.overlay}>
          <Text style={styles.scanHintTop}>{currentStep.hint}</Text>

          <View style={[styles.captureFrame, { width: currentStep.frameW, height: currentStep.frameH, borderRadius: currentStep.frameRadius }]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            activeOpacity={0.9}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const headerTitle = showReview
    ? 'Review Photos'
    : previewUri
    ? 'Preview'
    : currentStep.title;

  const headerIcon = showReview ? 'fact-check' : currentStep.icon;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCloseBeforeSave}>
      <View style={styles.container}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {stepIndex === 1 && !previewUri && !showReview && (
              <TouchableOpacity onPress={handleBack} hitSlop={10} style={styles.backBtn}>
                <MaterialIcons name="arrow-back" size={18} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            )}
            <View style={styles.headerIconWrap}>
              <MaterialIcons name={headerIcon} size={18} color={theme.colors.white} />
            </View>
            <Text style={styles.title}>{headerTitle}</Text>
          </View>
          <TouchableOpacity onPress={handleCloseBeforeSave} hitSlop={12} style={styles.closeBtn}>
            <MaterialIcons name="close" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {/* ── Step Indicator ── */}
        {!showReview && (
          <View style={styles.stepIndicator}>
            {STEPS.map((s, idx) => (
              <React.Fragment key={s.key}>
                <View style={styles.stepChip}>
                  <View style={[
                    styles.stepNum,
                    idx < stepIndex && styles.stepNumDone,
                    idx === stepIndex && styles.stepNumActive,
                  ]}>
                    {idx < stepIndex ? (
                      <MaterialIcons name="check" size={11} color="#fff" />
                    ) : (
                      <Text style={[
                        styles.stepNumText,
                        idx === stepIndex && styles.stepNumTextActive,
                      ]}>{idx + 1}</Text>
                    )}
                  </View>
                  <Text style={[
                    styles.stepChipLabel,
                    idx === stepIndex && styles.stepChipLabelActive,
                    idx < stepIndex && styles.stepChipLabelDone,
                  ]}>{s.label}</Text>
                </View>
                {idx < STEPS.length - 1 && (
                  <View style={[styles.stepBar, idx < stepIndex && styles.stepBarDone]} />
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Body ── */}
        <View style={styles.body}>
          {showReview
            ? renderReview()
            : permissionStatus !== 'granted'
            ? renderPermissionView()
            : previewUri
            ? renderPreview()
            : renderCamera()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },

  // Header
  header: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: HEADER_TOP_PADDING,
    paddingBottom: 12,
    zIndex: 20,
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
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 19,
  },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumActive: {
    backgroundColor: theme.colors.gradientStart,
  },
  stepNumDone: {
    backgroundColor: theme.colors.gradientEnd,
  },
  stepNumText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  stepNumTextActive: {
    color: '#fff',
  },
  stepChipLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  stepChipLabelActive: {
    color: '#f1f5f9',
  },
  stepChipLabelDone: {
    color: theme.colors.gradientStart,
  },
  stepBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#334155',
    marginHorizontal: 8,
    borderRadius: 1,
  },
  stepBarDone: {
    backgroundColor: theme.colors.gradientStart,
  },

  body: {
    flex: 1,
  },

  // Camera
  scannerWrap: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  scanHintTop: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  captureFrame: {
    position: 'relative',
    borderWidth: 0,
  },
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
  captureButton: {
    marginTop: 28,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
  },

  // Preview
  previewWrap: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
    backgroundColor: '#000',
  },
  previewLabelRow: {
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
    color: 'rgba(255,255,255,0.85)',
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
    borderColor: theme.colors.gradientStart,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  retakeBtnText: {
    color: theme.colors.gradientStart,
    fontSize: 14,
    fontWeight: '700',
  },
  nextBtn: {
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
  nextBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Review
  reviewContent: {
    padding: 20,
    gap: 16,
  },
  reviewHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f1f5f9',
    letterSpacing: 0.3,
  },
  reviewSubHeading: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: -8,
  },
  reviewQrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reviewQrLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  reviewQrValue: {
    flex: 1,
    color: theme.colors.gradientStart,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewImagesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewImageTile: {
    flex: 1,
    gap: 6,
  },
  reviewImageLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  tapToRetakeText: {
    color: theme.colors.gradientStart,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  reviewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    resizeMode: 'cover',
    backgroundColor: '#1e293b',
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.gradientStart,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  cancelBtnText: {
    color: theme.colors.gradientStart,
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
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
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Permission
  centerContent: {
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
  infoTitle: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  allowBtn: {
    marginTop: 4,
    backgroundColor: theme.colors.gradientStart,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  allowBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default ImageCaptureModal;
