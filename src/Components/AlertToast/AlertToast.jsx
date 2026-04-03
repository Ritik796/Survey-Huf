import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Text, Animated, StyleSheet, TouchableOpacity, } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors, rs, radius } from '../../theme/appTheme';
// ─── Context ──────────────────────────────────────────────────────────────────
const AlertContext = createContext({ showAlert: () => { } });
export const useAlert = () => useContext(AlertContext);
// ─── Config per type ──────────────────────────────────────────────────────────
const CONFIG = {
    success: { bg: '#f0fdf4', icon: 'check-circle', border: colors.gradientEnd },
    error: { bg: '#fff1f0', icon: 'error', border: colors.error },
    info: { bg: '#eff6ff', icon: 'info', border: '#3b82f6' },
};
// jo text samjena wale hein unhein hindi mein likho baki english mein hi rakho button header
// ─── Provider ────────────────────────────────────────────────────────────────
export const AlertProvider = ({ children }) => {
    const [alert, setAlert] = useState({ visible: false, type: 'success', message: '' });
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timer = useRef(null);
    const show = (translateTo, opacityTo, cb) => {
        Animated.parallel([
            Animated.spring(translateY, { toValue: translateTo, friction: 8, tension: 60, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: opacityTo, duration: 250, useNativeDriver: true }),
        ]).start(cb);
    };
    const dismiss = useCallback(() => {
        show(-120, 0, () => setAlert(prev => ({ ...prev, visible: false })));
    }, []);
    const showAlert = useCallback((type, message) => {
        if (timer.current)
            clearTimeout(timer.current);
        setAlert({ visible: true, type, message });
        translateY.setValue(-120);
        opacity.setValue(0);
        show(0, 1);
        timer.current = setTimeout(dismiss, 2500);
    }, [dismiss, translateY, opacity]);
    const cfg = CONFIG[alert.type];
    return (<AlertContext.Provider value={{ showAlert }}>
      {children}
      {alert.visible && (<Animated.View style={[styles.toast, { backgroundColor: cfg.bg, borderLeftColor: cfg.border, transform: [{ translateY }], opacity }]}>
          <MaterialIcons name={cfg.icon} size={rs.ms(22)} color={cfg.border}/>
          <Text style={[styles.msg, { color: colors.black }]} numberOfLines={2}>
            {alert.message}
          </Text>
          <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="close" size={rs.ms(18)} color={colors.darkGrey}/>
          </TouchableOpacity>
        </Animated.View>)}
    </AlertContext.Provider>);
};
const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        top: rs.sp(52),
        left: rs.sp(16),
        right: rs.sp(16),
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.md,
        borderLeftWidth: 4,
        paddingHorizontal: rs.sp(14),
        paddingVertical: rs.sp(13),
        gap: rs.sp(10),
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 10,
    },
    msg: {
        flex: 1,
        fontSize: rs.font(14),
        fontWeight: '500',
        lineHeight: rs.font(20),
    },
});
