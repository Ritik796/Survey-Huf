import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { theme } from '../../theme/appTheme';

const ImageCaptureModal = ({ visible, onClose, onCaptureSuccess }) => {
  const [permissionStatus, setPermissionStatus] = useState('not-determined');
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState('');
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);

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
      setCapturedImageUri('');
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
    if (!cameraRef.current || capturing) {
      return;
    }

    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });
      const normalizedUri = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;
      setCapturedImageUri(normalizedUri);
    } catch (error) {
      setCapturedImageUri('');
    } finally {
      setCapturing(false);
    }
  };

  const handleUsePhoto = () => {
    if (!capturedImageUri) {
      return;
    }
    onCaptureSuccess?.(capturedImageUri);
    onClose?.();
  };

  const renderPermissionView = () => (
    <View style={styles.centerContent}>
      <MaterialIcons name="camera-alt" size={42} color="#fff" />
      <Text style={styles.infoTitle}>Camera Permission Required</Text>
      <Text style={styles.infoText}>Card ki photo lene ke liye camera allow karein.</Text>
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

  const renderCameraView = () => {
    if (!device) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.infoText}>Camera loading...</Text>
        </View>
      );
    }

    if (capturedImageUri) {
      return (
        <View style={styles.previewWrap}>
          <Image source={{ uri: capturedImageUri }} style={styles.previewImage} />
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.actionButton]}
              onPress={() => setCapturedImageUri('')}
              activeOpacity={0.85}
            >
              <MaterialIcons name="refresh" size={18} color="#fff" />
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, styles.actionButton]}
              onPress={handleUsePhoto}
              activeOpacity={0.85}
            >
              <MaterialIcons name="check" size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Use Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.scannerWrap}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={visible}
          photo
        />
        <View style={styles.overlay}>
          <View style={styles.captureFrame} />
          <Text style={styles.helperText}>Card ko frame ke andar align karein</Text>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            activeOpacity={0.9}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="camera-alt" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Capture Card Image</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={24} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>
            {permissionStatus === 'granted' ? renderCameraView() : renderPermissionView()}
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
    minHeight: 500,
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
    minHeight: 444,
  },
  scannerWrap: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  captureFrame: {
    width: 280,
    height: 180,
    borderWidth: 2.5,
    borderColor: '#22c55e',
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  helperText: {
    marginTop: 14,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  captureButton: {
    marginTop: 26,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  previewWrap: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  previewImage: {
    flex: 1,
    borderRadius: 12,
    resizeMode: 'cover',
    backgroundColor: '#000',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
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
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
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
  secondaryButton: {
    backgroundColor: '#475569',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default ImageCaptureModal;
