import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Easing, ActivityIndicator, StatusBar, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../theme/appTheme';
import { useAlert } from '../Components/AlertToast/AlertToast';
import { useCommonAlert } from '../Components/CommonAlert/CommonAlert';
import { checkAndStartSurvey, logoutSurveyor } from '../Actions/StartSurvey/StartSurveyAction';
import { getUserDetails, saveUserDetails } from '../utils/storage';
import { getData } from '../Firebase/dbServices';
const { width } = Dimensions.get('window');
const StartSurveyScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const { showAlert } = useAlert();
    const { showCommonAlert } = useCommonAlert();
    useEffect(() => {
        const loadUserName = async () => {
            const user = await getUserDetails();
            if (!user?.userId) {
                return;
            }

            const localName = user?.name ?? user?.Name ?? '';
            if (localName) {
                setUserName(localName);
                return;
            }

            const surveyor = await getData(`Surveyors/${user.userId}`);
            const fetchedName = surveyor?.name ?? surveyor?.Name ?? '';
            if (fetchedName) {
                setUserName(fetchedName);
                await saveUserDetails({
                    ...user,
                    name: fetchedName,
                });
            }
        };

        loadUserName();
        // Ambient background glow rotation
        Animated.loop(Animated.timing(rotateAnim, {
            toValue: 1, duration: 20000,
            easing: Easing.linear, useNativeDriver: true,
        })).start();
        // Entrance fade + slide
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
        ]).start();
    }, [rotateAnim, fadeAnim, slideAnim]);
    const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const handleStartSurvey = () => {
        if (loading)
            return;
        checkAndStartSurvey((screen) => navigation.navigate(screen), showAlert, setLoading);
    };
    const handleLogoutPress = () => {
        setMenuOpen(false);
        showCommonAlert({
            title: 'Logout',
            message: 'Are you sure you want to logout?',
            icon: 'logout',
            iconType: 'destructive',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    icon: 'logout',
                    onPress: () => logoutSurveyor((screen) => navigation.navigate(screen), showAlert),
                },
            ],
        });
    };
    return (<SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.gradientEnd}/>

      {/* ── Gradient Header ── */}
      <LinearGradient colors={[theme.colors.gradientStart, theme.colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <View style={styles.headerSide}/>

        <Text style={styles.headerTitle}>Survey App</Text>

        <View style={styles.headerSide}>
          <TouchableOpacity onPress={() => setMenuOpen(prev => !prev)} style={styles.menuIconBtn} activeOpacity={0.7}>
            <MaterialIcons name="more-vert" size={26} color={theme.colors.white}/>
          </TouchableOpacity>

          {menuOpen && (<View style={styles.dropdown}>
              <TouchableOpacity style={styles.dropdownItem} onPress={handleLogoutPress}>
                <MaterialIcons name="logout" size={17} color="#e53e3e"/>
                <Text style={styles.dropdownText}>Logout</Text>
              </TouchableOpacity>
            </View>)}
        </View>
      </LinearGradient>

      {/* ── Body ── */}
      <View style={styles.body}>
        {/* Menu close backdrop */}
        {menuOpen && (<TouchableOpacity activeOpacity={1} style={styles.backdrop} onPress={() => setMenuOpen(false)}/>)}

        {/* Ambient glow */}
        <Animated.View style={[styles.bgGlow, { transform: [{ rotate: spin }] }]}/>

        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Welcome greeting */}
          <View style={styles.greetingRow}>
            <View style={styles.greetingIcon}>
              <MaterialIcons name="waving-hand" size={22} color={theme.colors.gradientEnd}/>
            </View>
            <View>
              <Text style={styles.greetingHello}>
                Hello, {userName || 'Surveyor'}!
              </Text>
              <Text style={styles.greetingSub}>Ready to begin today's work?</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider}/>

          {/* Start Survey action card */}
          <TouchableOpacity onPress={handleStartSurvey} disabled={loading} activeOpacity={0.82} style={styles.actionCard}>
            {/* Left: gradient icon box */}
            <LinearGradient colors={[theme.colors.gradientStart, theme.colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconBox}>
              <MaterialIcons name="assignment" size={30} color={theme.colors.white}/>
            </LinearGradient>

            {/* Middle: text */}
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Start Survey</Text>
              <Text style={styles.actionSub}>Tap to check your work assignment</Text>
            </View>

            {/* Right: arrow or loader */}
            <View style={styles.actionRight}>
              {loading
            ? <ActivityIndicator size="small" color={theme.colors.gradientEnd}/>
            : <MaterialIcons name="chevron-right" size={26} color={theme.colors.gradientEnd}/>}
            </View>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </SafeAreaView>);
};
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.colors.gradientEnd,
    },
    // ── Header ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 14,
    },
    headerSide: {
        width: 44,
        alignItems: 'flex-end',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '800',
        color: theme.colors.white,
        letterSpacing: 0.4,
    },
    menuIconBtn: {
        padding: 4,
    },
    dropdown: {
        position: 'absolute',
        top: 40,
        right: 0,
        backgroundColor: theme.colors.white,
        borderRadius: 10,
        paddingVertical: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
        elevation: 12,
        minWidth: 130,
        zIndex: 200,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 8,
    },
    dropdownText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.black,
    },
    // ── Body ──
    body: {
        flex: 1,
        backgroundColor: '#f5f6fa',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
    },
    bgGlow: {
        position: 'absolute',
        width: width * 1.5,
        height: width * 1.5,
        borderRadius: 120,
        backgroundColor: theme.colors.gradientStart,
        opacity: 0.05,
    },
    content: {
        width: '100%',
    },
    // ── Greeting ──
    greetingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 20,
    },
    greetingIcon: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: theme.colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.colors.gradientStart,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 6,
        elevation: 3,
    },
    greetingHello: {
        fontSize: 20,
        fontWeight: '800',
        color: theme.colors.black,
        marginBottom: 2,
    },
    greetingSub: {
        fontSize: 13,
        color: theme.colors.darkGrey,
    },
    divider: {
        height: 1,
        backgroundColor: '#e8eaed',
        marginBottom: 20,
    },
    // ── Action Card ──
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.white,
        borderRadius: 16,
        padding: 18,
        shadowColor: theme.colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 5,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    actionTextWrap: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.black,
        marginBottom: 4,
    },
    actionSub: {
        fontSize: 12,
        color: theme.colors.darkGrey,
    },
    actionRight: {
        marginLeft: 8,
    },
});
export default StartSurveyScreen;
