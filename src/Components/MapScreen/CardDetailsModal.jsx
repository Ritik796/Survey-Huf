import React from 'react';
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
import { theme } from '../../theme/appTheme';

const CardDetailsModal = ({
  visible,
  card,
  cardData,
  onClose,
  onScanQr,
  onCaptureImage,
  onSave,
}) => {
  const hasQr = Boolean(cardData?.qrData);
  const hasImage = Boolean(cardData?.imageUri);
  const canSave = hasQr && hasImage && !cardData?.isSaving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Card Verification</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={24} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.label}>Card Number</Text>
            <Text style={styles.cardNumber}>{card?.number || '-'}</Text>

            <Text style={[styles.label, styles.sectionGap]}>Card Image</Text>
            <View style={styles.imageWrap}>
              {hasImage ? (
                <Image source={{ uri: cardData.imageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholderWrap}>
                  <MaterialIcons name="image" size={42} color="#9ca3af" />
                  <Text style={styles.placeholderText}>Image not captured</Text>
                </View>
              )}
            </View>

            <Text style={[styles.label, styles.sectionGap]}>QR Data</Text>
            <View style={styles.qrDataBox}>
              <Text style={styles.qrDataText} numberOfLines={2}>
                {cardData?.qrData || 'QR not scanned'}
              </Text>
            </View>

            {cardData?.saved ? (
              <View style={styles.savedTag}>
                <MaterialIcons name="check-circle" size={16} color="#16a34a" />
                <Text style={styles.savedText}>Saved Successfully</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.actionBtn} onPress={onScanQr} activeOpacity={0.85}>
              <MaterialIcons name="qr-code-scanner" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Scan QR</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={onCaptureImage} activeOpacity={0.85}>
              <MaterialIcons name="camera-alt" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Capture Image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={onSave}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              {cardData?.isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="save" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#1f2937',
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    padding: 14,
  },
  label: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardNumber: {
    marginTop: 3,
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionGap: {
    marginTop: 14,
  },
  imageWrap: {
    marginTop: 8,
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  placeholderText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  qrDataBox: {
    marginTop: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  qrDataText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  savedTag: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  savedText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  actionBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
});

export default CardDetailsModal;
