import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Modal, Text, Easing } from 'react-native';

const CommonLoader = ({ isLoading = false, text = 'Please wait...', smallArea = false }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [isLoading, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isLoading) return null;

  const loaderContent = (
    <View style={styles.loaderCard}>
      <View style={styles.spinnerWrapper}>
        <View style={styles.spinnerTrack} />
        <Animated.View style={[styles.spinnerArc, { transform: [{ rotate: spin }] }]} />
        <View style={styles.logoShell}>
          <Image
            source={require('../assets/images/CompanyLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
      <Text style={styles.loaderText}>{text}</Text>
    </View>
  );

  if (smallArea) {
    return (
      <View style={styles.smallLoader}>
        {loaderContent}
      </View>
    );
  }

  return (
    <Modal transparent visible={isLoading} animationType="fade">
      <View style={styles.loaderOverlay}>
        {loaderContent}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  loaderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  smallLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  loaderCard: {
    padding: 28,
    borderRadius: 14,
    alignItems: 'center',
    minWidth: 200,
  },
  spinnerWrapper: {
    position: 'relative',
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4fbf7',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d9efe3',
  },
  spinnerTrack: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: '#dff3ea',
  },
  spinnerArc: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: '#1f8f3a',
    borderRightColor: '#66bb6a',
  },
  logoShell: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 42,
    height: 42,
    zIndex: 2,
  },
  loaderText: {
    marginTop: 14,
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default CommonLoader;
