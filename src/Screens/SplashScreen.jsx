import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Animated, Easing } from 'react-native';
import { theme } from '../theme/appTheme';
import { getUserDetails } from '../utils/storage';
import { loadHUFSurveySettings } from '../Services/Settings/HUFSurveySettingsService';

const { width } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
    const logoTranslateY = useRef(new Animated.Value(50)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textTranslateY = useRef(new Animated.Value(30)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const hasNavigatedRef = useRef(false);

    const navigateBySession = useCallback(async () => {
        if (hasNavigatedRef.current) return;
        await loadHUFSurveySettings({ forceRefresh: true });
        const user = await getUserDetails();
        const hasActiveSession = Boolean(user?.userId);
        hasNavigatedRef.current = true;
        navigation.replace(hasActiveSession ? 'StartSurvey' : 'Login');
    }, [navigation]);

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

        return () => {
            clearTimeout(timer);
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
