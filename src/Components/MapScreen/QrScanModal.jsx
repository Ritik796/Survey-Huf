import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { theme } from '../../theme/appTheme';

const QrScanModal = ({ visible, onClose, onScanSuccess, onCancel }) => {
  const [permissionStatus, setPermissionStatus] = useState('not-determined');
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [scannedCode, setScannedCode] = useState(null);
  const hasScannedRef = useRef(false);
  const device = useCameraDevice('back');

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
      hasScannedRef.current = false;
      setScannedCode(null);
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

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      const firstCode = codes?.[0];
      if (!firstCode?.value || hasScannedRef.current) return;
      hasScannedRef.current = true;
      setScannedCode(firstCode.value);
    },
  });

  const handleProceed = () => {
    if (!scannedCode) return;
    onScanSuccess?.(scannedCode);
    onClose?.();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose?.();
  };

  const handleRescan = () => {
    hasScannedRef.current = false;
    setScannedCode(null);
  };

  // ── Permission View ──
  const renderPermissionView = () => (
    <View style={styles.centerContent}>
      <View style={styles.permIconCircle}>
        <MaterialIcons name="no-photography" size={36} color="#94a3b8" />
      </View>
      <Text style={styles.infoTitle}>Camera Permission Required</Text>
      <Text style={styles.infoText}>QR स्कैन करने के लिए कैमरा की परमिशन दें।</Text>
      <TouchableOpacity style={styles.allowBtn} onPress={requestPermission} activeOpacity={0.85}>
        {requestingPermission ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.allowBtnText}>Allow Permission</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ── Scan Result View ──
  const renderScanResult = () => (
    <View style={styles.resultWrap}>
      <View style={styles.resultIconCircle}>
        <MaterialIcons name="qr-code" size={52} color={theme.colors.gradientStart} />
      </View>

      <View style={styles.resultSuccessRow}>
        <MaterialIcons name="check-circle" size={18} color="#16a34a" />
        <Text style={styles.resultSuccessText}>QR Scanned</Text>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>Card Number / QR Data</Text>
        <Text style={styles.resultValue}>{scannedCode}</Text>
      </View>

      <Text style={styles.resultHint}>
        अब कार्ड और घर की फोटो लें।
      </Text>

      <View style={styles.resultActions}>
        <TouchableOpacity style={styles.rescanBtn} onPress={handleRescan} activeOpacity={0.85}>
          <MaterialIcons name="refresh" size={17} color={theme.colors.gradientEnd} />
          <Text style={styles.rescanBtnText}>Rescan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.proceedBtn} onPress={handleProceed} activeOpacity={0.85}>
          <Text style={styles.proceedBtnText}>Capture Photos</Text>
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Scanner View ──
  const renderScanner = () => {
    if (!device) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.gradientStart} />
          <Text style={styles.infoText}>कैमरा खुल रहा है...</Text>
        </View>
      );
    }

    return (
      <View style={styles.scannerWrap}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible && !scannedCode}
          codeScanner={codeScanner}
        />
        <View style={styles.overlay}>
          <Text style={styles.scanHintTop}>कार्ड का QR कोड फ्रेम में रखें</Text>

          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          <View style={styles.scanHintRow}>
            <MaterialIcons name="qr-code-scanner" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.scanHintBottom}>स्कैन हो रहा है...</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCancel}>
      <View style={[styles.container, scannedCode && styles.containerResult]}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <MaterialIcons name="qr-code-scanner" size={18} color={theme.colors.white} />
            </View>
            <Text style={styles.title}>
              {scannedCode ? 'QR Scanned' : 'Scan QR'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleCancel} hitSlop={12} style={styles.closeBtn}>
            <MaterialIcons name="close" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {permissionStatus !== 'granted'
            ? renderPermissionView()
            : scannedCode
            ? renderScanResult()
            : renderScanner()}
        </View>
      </View>
    </Modal>
  );
};

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  containerResult: {
    backgroundColor: '#fff',
  },

  // Header
  header: {
    backgroundColor: theme.colors.gradientStart,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 16,
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

  body: {
    flex: 1,
  },

  // Scanner
  scannerWrap: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  scanHintTop: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 24,
    letterSpacing: 0.2,
  },
  scanFrame: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: theme.colors.gradientStart,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 6 },
  scanHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scanHintBottom: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },

  // Scan Result
  resultWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
    gap: 16,
  },
  resultIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#c8e6c9',
  },
  resultSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultSuccessText: {
    color: '#16a34a',
    fontSize: 16,
    fontWeight: '700',
  },
  resultCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 4,
    alignItems: 'center',
  },
  resultLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resultValue: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  resultHint: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.gradientStart,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rescanBtnText: {
    color: theme.colors.gradientEnd,
    fontSize: 14,
    fontWeight: '700',
  },
  proceedBtn: {
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
  proceedBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Permission / Loading
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

export default QrScanModal;
