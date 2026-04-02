import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, rs } from '../theme/appTheme';
// Placeholder — replace with actual Home/Survey screen
const HomeScreen = () => {
    return (<SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.text}>Home</Text>
      </View>
    </SafeAreaView>);
};
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.primaryBackground },
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    text: { fontSize: rs.font(20), fontWeight: '700', color: colors.black },
});
export default HomeScreen;
