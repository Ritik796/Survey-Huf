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

const QrScanModal = ({ visible, onClose, onScanSuccess }) => {
  const [permissionStatus, setPermissionStatus] = useState('not-determined');
  const [requestingPermission, setRequestingPermission] = useState(false);
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
      if (!firstCode?.value || hasScannedRef.current) {
        return;
      }

      hasScannedRef.current = true;
      onScanSuccess?.(firstCode.value);
      onClose?.();
    },
  });

  const renderPermissionView = () => (
    <View style={styles.centerContent}>
      <MaterialIcons name="camera-alt" size={42} color="#fff" />
      <Text style={styles.infoTitle}>Camera Permission Required</Text>
      <Text style={styles.infoText}>
        QR scan ke liye camera permission allow karein.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={requestPermission}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryButtonText}>
          {requestingPermission ? 'Requesting...' : 'Allow Camera'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderScanner = () => {
    if (!device) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.infoText}>Camera loading...</Text>
        </View>
      );
    }

    return (
      <View style={styles.scannerWrap}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          codeScanner={codeScanner}
        />
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.helperText}>QR code frame ke andar laayein</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Scan QR Code</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={24} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {permissionStatus === 'granted' ? renderScanner() : renderPermissionView()}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 430,
  },
  header: {
    height: 56,
    backgroundColor: '#1f2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  title: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    minHeight: 374,
  },
  scannerWrap: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 2.5,
    borderColor: '#22c55e',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  helperText: {
    marginTop: 18,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  infoText: {
    color: '#d1d5db',
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default QrScanModal;
