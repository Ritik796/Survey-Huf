import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Easing, Image, ActivityIndicator, StatusBar, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../theme/appTheme';
import { useAlert } from '../Components/AlertToast/AlertToast';
import { getLoggedInSurveyor } from '../Actions/Login/LoginAction.js';
const FloatingInput = ({ label, value, onChangeText, hasError, onSubmitEditing, }) => {
    const floatAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
    const [isFocused, setIsFocused] = useState(false);
    const animate = (val) => Animated.timing(floatAnim, {
        toValue: val, duration: 180,
        easing: Easing.out(Easing.ease), useNativeDriver: false,
    }).start();
    const handleFocus = () => { setIsFocused(true); animate(1); };
    const handleBlur = () => { setIsFocused(false); if (!value)
        animate(0); };
    const labelTop = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [17, -9] });
    const labelSize = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
    const labelClr = floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.colors.grey, hasError ? '#e05252' : theme.colors.gradientEnd],
    });
    const activeBorderColor = hasError ? '#e05252' : theme.colors.gradientEnd;
    const borderColor = isFocused || hasError ? activeBorderColor : theme.colors.inputBorder;
    const borderWidth = isFocused || hasError ? 1.8 : 1;
    return (<View style={[inputStyles.wrapper, { borderColor, borderWidth }]}>
      <MaterialIcons name="badge" size={20} color={isFocused ? theme.colors.gradientEnd : hasError ? '#e05252' : theme.colors.grey} style={inputStyles.icon}/>
      <Animated.Text style={[inputStyles.label, { top: labelTop, fontSize: labelSize, color: labelClr }]} numberOfLines={1}>
        {label}
      </Animated.Text>
      <TextInput style={inputStyles.input} value={value} onChangeText={onChangeText} onFocus={handleFocus} onBlur={handleBlur} autoCapitalize="characters" autoCorrect={false} returnKeyType="done" onSubmitEditing={onSubmitEditing} placeholder=" " placeholderTextColor="transparent"/>
    </View>);
};
const inputStyles = StyleSheet.create({
    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        borderRadius: 12,
        backgroundColor: theme.colors.white,
        height: 56,
        paddingHorizontal: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    icon: {
        marginRight: 10,
        marginTop: 8,
    },
    label: {
        position: 'absolute',
        left: 46,
        backgroundColor: theme.colors.white,
        paddingHorizontal: 4,
        zIndex: 1,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: theme.colors.primaryText,
        paddingTop: 12,
        paddingBottom: 0,
        letterSpacing: 2,
        fontWeight: '600',
    },
});
// ─── Screen ───────────────────────────────────────────────────────────────────
const LoginScreen = ({ navigation }) => {
    const [userId, setUserId] = useState('');
    const [hasError, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const { showAlert } = useAlert();
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoTranslateY = useRef(new Animated.Value(30)).current;
    const formOpacity = useRef(new Animated.Value(0)).current;
    const formTranslateY = useRef(new Animated.Value(40)).current;
    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.spring(logoTranslateY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(formOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.spring(formTranslateY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
            ]),
        ]).start();
    }, [logoOpacity, logoTranslateY, formOpacity, formTranslateY]);
    const handleChange = (text) => {
        const upper = text.toUpperCase().trim();
        setUserId(upper);
        if (hasError && upper !== '')
            setError(false);
    };
    const handleLogin = () => {
        if (userId.trim() === '') {
            setError(true);
            return;
        }
        setError(false);
        getLoggedInSurveyor((screen) => navigation.navigate(screen), userId.toUpperCase(), showAlert, setLoading);
    };
    return (<SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.gradientEnd}/>

      {/* ── Top green gradient section ── */}
      <LinearGradient colors={[theme.colors.gradientStart, theme.colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.topSection}>
        <Animated.View style={[styles.logoArea, { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] }]}>
          <View style={styles.imageWrapper}>
            <Image source={require('../assets/images/logo.png')} style={styles.logoImage} resizeMode="contain"/>
          </View>
          <View style={styles.brandRow}>
            <Text style={styles.logoText}>SURVEY</Text>
            <Text style={styles.logoSubText}> APP</Text>
          </View>
          <Text style={styles.subtitle}>LOG IN TO ACCESS SURVEY APP</Text>
        </Animated.View>
      </LinearGradient>

      {/* ── Bottom white form card ── */}
      <Animated.View style={[styles.card, { opacity: formOpacity, transform: [{ translateY: formTranslateY }] }]}>

        <Text style={styles.signInTitle}>Sign In</Text>
        <Text style={styles.signInSub}>Enter your User ID to continue</Text>

        <FloatingInput label="User ID" value={userId} onChangeText={handleChange} hasError={hasError} onSubmitEditing={handleLogin}/>

        {hasError && (<View style={styles.errorRow}>
            <MaterialIcons name="error-outline" size={15} color="#b91c1c"/>
            <Text style={styles.errorText}>  Please enter your User ID</Text>
          </View>)}

        <TouchableOpacity onPress={handleLogin} activeOpacity={0.85} disabled={loading} style={styles.btnWrap}>
          <LinearGradient colors={loading ? ['#aaa', '#888'] : [theme.colors.gradientStart, theme.colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginBtn}>
            {loading
            ? <ActivityIndicator size="small" color={theme.colors.white}/>
            : <MaterialIcons name="login" size={20} color={theme.colors.white}/>}
            <Text style={styles.loginBtnText}>
              {loading ? '  PLEASE WAIT...' : '  LOGIN'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

      </Animated.View>
    </SafeAreaView>);
};
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.colors.gradientEnd,
    },
    // ── Top gradient section ──
    topSection: {
        paddingTop: 36,
        paddingBottom: 48,
        alignItems: 'center',
    },
    logoArea: {
        alignItems: 'center',
    },
    imageWrapper: {
        width: 100,
        height: 100,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderRadius: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 10,
    },
    logoImage: {
        width: 65,
        height: 65,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    logoText: {
        fontSize: 26,
        fontWeight: '800',
        color: theme.colors.white,
        letterSpacing: 2,
    },
    logoSubText: {
        fontSize: 26,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.72)',
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.65)',
        letterSpacing: 0.5,
    },
    // ── Bottom white card (rounded top corners) ──
    card: {
        flex: 1,
        backgroundColor: theme.colors.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 32,
        paddingHorizontal: 24,
        paddingBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 8,
    },
    signInTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: theme.colors.black,
        marginBottom: 6,
    },
    signInSub: {
        fontSize: 13,
        color: theme.colors.darkGrey,
        marginBottom: 28,
    },
    // ── Error (Bootstrap-style alert) ──
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#fff5f5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
        borderLeftWidth: 3.5,
        borderLeftColor: '#ef4444',
    },
    errorText: {
        fontSize: 12.5,
        color: '#991b1b',
        fontWeight: '500',
        flexShrink: 1,
    },
    // ── Button ──
    btnWrap: { marginTop: 16 },
    loginBtn: {
        flexDirection: 'row',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.colors.gradientEnd,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
    loginBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: theme.colors.white,
        letterSpacing: 1.5,
    },
});
export default LoginScreen;
