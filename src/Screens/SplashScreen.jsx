import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Animated, Easing } from 'react-native';
import { theme } from '../theme/appTheme';
import { getUserDetails } from '../utils/storage';
import { checkForUpdates } from '../Services/otaService';
import { createOtaUpdateHandlers } from '../Actions/Ota/OtaActions';
import UpdateModal from '../Components/UpdateModal/UpdateModal';

const { width } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
    const logoTranslateY = useRef(new Animated.Value(50)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textTranslateY = useRef(new Animated.Value(30)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const pendingUpdateActionRef = useRef(null);
    const hasPendingOtaRef = useRef(false);
    const hasNavigatedRef = useRef(false);

    const [otaModal, setOtaModal] = useState({
        visible: false,
        title: 'Naya Update Available',
        actionLabel: 'Abhi Update Karein',
        updateType: 'js',
        progress: 0,
        status: '',
        version: '',
        description: '',
        isDownloading: false,
        canStartUpdate: false,
        showUnavailableMessage: false,
        unavailableMessage: '',
        isMandatoryBlock: false,
        blockApp: false,
        hideActions: false,
        hideFooterNote: false,
        nonDismissible: true,
    });

    const navigateBySession = useCallback(async () => {
        if (hasNavigatedRef.current || hasPendingOtaRef.current) return;
        const user = await getUserDetails();
        const hasActiveSession = Boolean(user?.userId);
        hasNavigatedRef.current = true;
        navigation.replace(hasActiveSession ? 'StartSurvey' : 'Login');
    }, [navigation]);

    const onUpdatePress = useCallback(() => {
        const startUpdate = pendingUpdateActionRef.current;
        if (!startUpdate) return;
        if (otaModal.updateType === 'native') {
            setOtaModal((prev) => ({
                ...prev,
                canStartUpdate: false,
                status: 'App band ho raha hai...',
                showUnavailableMessage: false,
                unavailableMessage: '',
            }));
            pendingUpdateActionRef.current = null;
            startUpdate();
            return;
        }
        setOtaModal((prev) => ({
            ...prev,
            isDownloading: true,
            canStartUpdate: false,
            status: 'Downloading update...',
            showUnavailableMessage: false,
            unavailableMessage: '',
        }));
        pendingUpdateActionRef.current = null;
        startUpdate();
    }, [otaModal.updateType]);

    useEffect(() => {
        // Entrance animations (staggered)
        Animated.sequence([
            Animated.parallel([
                Animated.timing(logoOpacity, {
                    toValue: 1, duration: 800, useNativeDriver: true,
                }),
                Animated.spring(logoTranslateY, {
                    toValue: 0, friction: 6, tension: 40, useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.timing(textOpacity, {
                    toValue: 1, duration: 600, useNativeDriver: true,
                }),
                Animated.spring(textTranslateY, {
                    toValue: 0, friction: 6, tension: 50, useNativeDriver: true,
                }),
            ]),
        ]).start(() => {
            // Continuous floating after entrance
            Animated.loop(Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -15, duration: 2000,
                    easing: Easing.inOut(Easing.ease), useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0, duration: 2000,
                    easing: Easing.inOut(Easing.ease), useNativeDriver: true,
                }),
            ])).start();
        });
        // Slow ambient rotation for background glow
        Animated.loop(Animated.timing(rotateAnim, {
            toValue: 1, duration: 20000,
            easing: Easing.linear, useNativeDriver: true,
        })).start();

        const timer = setTimeout(() => {
            navigateBySession();
        }, 4500);

        const otaHandlers = createOtaUpdateHandlers({
            setOtaModal,
            pendingUpdateActionRef,
        });

        const otaCheckTimer = setTimeout(async () => {
            const wrappedHandlers = {
                ...otaHandlers,
                onUpdateFound: (version, status, startUpdateFn, meta) => {
                    hasPendingOtaRef.current = true;
                    otaHandlers.onUpdateFound(version, status, startUpdateFn, meta);
                },
                onError: (error) => {
                    hasPendingOtaRef.current = false;
                    otaHandlers.onError(error);
                },
            };

            await checkForUpdates(wrappedHandlers, null, { forceRefreshDb: true, skipNativeExit: false });
        }, 1800);

        return () => {
            clearTimeout(timer);
            clearTimeout(otaCheckTimer);
        };
    }, [logoTranslateY, logoOpacity, textTranslateY, textOpacity, floatAnim, rotateAnim, navigateBySession]);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });
    return (<View style={styles.container}>
      {/* Rotating background geometry */}
      <Animated.View style={[styles.modernGlow, { transform: [{ rotate: spin }] }]}/>

      {/* Floating main content */}
      <Animated.View style={[styles.mainWrapper, { transform: [{ translateY: floatAnim }] }]}>

        {/* Logo */}
        <Animated.View style={[
            styles.logoContainer,
            { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }] },
        ]}>
          <View style={styles.imageWrapper}>
            <Image source={require('../assets/images/logo.png')} style={styles.logoImage}/>
          </View>
        </Animated.View>

        {/* Brand text */}
        <Animated.View style={[
            styles.textContainer,
            { opacity: textOpacity, transform: [{ translateY: textTranslateY }] },
        ]}>
          <Text style={styles.logoText}>SURVEY</Text>
          <Text style={styles.logoSubText}>APP</Text>
        </Animated.View>

      </Animated.View>

      <UpdateModal
        visible={otaModal.visible}
        title={otaModal.title}
        progress={otaModal.progress}
        status={otaModal.status}
        version={otaModal.version}
        description={otaModal.description}
        actionLabel={otaModal.actionLabel}
        onUpdatePress={onUpdatePress}
        isDownloading={otaModal.isDownloading}
        canStartUpdate={otaModal.canStartUpdate}
        showUnavailableMessage={otaModal.showUnavailableMessage}
        unavailableMessage={otaModal.unavailableMessage}
        hideActions={otaModal.hideActions}
        hideFooterNote={otaModal.hideFooterNote}
        nonDismissible={otaModal.nonDismissible}
      />
    </View>);
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.white,
    },
    modernGlow: {
        position: 'absolute',
        width: width * 1.5,
        height: width * 1.5,
        backgroundColor: theme.colors.gradientStart,
        opacity: 0.04,
        borderRadius: 120,
    },
    mainWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    imageWrapper: {
        width: 140,
        height: 140,
        backgroundColor: theme.colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderRadius: 35,
        shadowColor: theme.colors.gradientStart,
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.25,
        shadowRadius: 25,
        elevation: 12,
    },
    logoImage: {
        width: 100,
        height: 100,
        resizeMode: 'contain',
    },
    textContainer: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    logoText: {
        fontSize: 30,
        fontWeight: '800',
        color: theme.colors.black,
        letterSpacing: 2,
    },
    logoSubText: {
        fontSize: 30,
        fontWeight: '800',
        color: theme.colors.gradientStart,
        letterSpacing: 2,
        marginLeft: 8,
    },
});
export default SplashScreen;

