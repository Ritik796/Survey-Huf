import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../../theme/appTheme';

// ── Context ───────────────────────────────────────────────────────────────────
const CommonAlertContext = createContext({ showCommonAlert: () => {} });
export const useCommonAlert = () => useContext(CommonAlertContext);

// ── Icon color map by type ────────────────────────────────────────────────────
const TYPE_COLORS = {
  destructive: { bg: '#fef2f2', border: '#fecaca', icon: '#ef4444' },
  warning:     { bg: '#fffbeb', border: '#fde68a', icon: '#d97706' },
  success:     { bg: '#f0fdf4', border: '#bbf7d0', icon: theme.colors.gradientEnd },
  info:        { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb' },
};

// ── Provider ──────────────────────────────────────────────────────────────────
export const CommonAlertProvider = ({ children }) => {
  const [cfg, setCfg] = useState(null);
  const slideY    = useRef(new Animated.Value(500)).current;
  const bdOpacity = useRef(new Animated.Value(0)).current;

  const dismiss = useCallback((cb) => {
    Animated.parallel([
      Animated.timing(slideY,    { toValue: 500, duration: 220, useNativeDriver: true }),
      Animated.timing(bdOpacity, { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(() => { setCfg(null); cb?.(); });
  }, [slideY, bdOpacity]);

  const showCommonAlert = useCallback((options) => {
    const wrappedButtons = (options.buttons || []).map(btn => ({
      ...btn,
      onPress: () => dismiss(() => btn.onPress?.()),
    }));
    setCfg({ iconType: 'destructive', ...options, buttons: wrappedButtons });
    slideY.setValue(500);
    bdOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY,    { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
      Animated.timing(bdOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [dismiss, slideY, bdOpacity]);

  const colors = TYPE_COLORS[cfg?.iconType] || TYPE_COLORS.destructive;

  return (
    <CommonAlertContext.Provider value={{ showCommonAlert }}>
      {children}
      {cfg && (
        <Modal visible transparent animationType="none" onRequestClose={() => dismiss()}>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: bdOpacity }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if ((cfg.buttons || []).some(b => b.style === 'cancel')) dismiss();
              }}
            />
          </Animated.View>

          {/* Sheet */}
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
            <View style={styles.handleBar} />

            {/* Icon */}
            {cfg.icon ? (
              <View style={[styles.iconCircle, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <MaterialIcons name={cfg.icon} size={30} color={colors.icon} />
              </View>
            ) : null}

            {/* Text */}
            <Text style={styles.title}>{cfg.title}</Text>
            {Boolean(cfg.message) && (
              <Text style={styles.message}>{cfg.message}</Text>
            )}

            {/* Buttons */}
            <View style={styles.btnGroup}>
              {(cfg.buttons || []).map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.btn, isDestructive ? styles.btnDestructive : styles.btnCancel]}
                    onPress={btn.onPress}
                    activeOpacity={0.82}
                  >
                    {isDestructive && btn.icon ? (
                      <MaterialIcons name={btn.icon} size={16} color={colors.icon} />
                    ) : null}
                    <Text style={[styles.btnTxt, isDestructive ? { color: colors.icon } : styles.btnTxtCancel]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </Modal>
      )}
    </CommonAlertContext.Provider>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 22,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  btnGroup: {
    alignSelf: 'stretch',
    marginTop: 24,
    gap: 10,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  btnDestructive: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  btnCancel: {
    backgroundColor: '#f1f5f9',
  },
  btnTxt: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnTxtCancel: {
    color: '#475569',
  },
});
