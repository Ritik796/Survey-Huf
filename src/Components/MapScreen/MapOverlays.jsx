import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../../theme/appTheme';

const MapOverlays = ({
  styles,
  hasPreviousLine,
  hasNextLine,
  wardLinesLoading,
  housesLoading,
  activeLineIndex,
  totalLines,
  handlePreviousLine,
  handleCycleLine,
  handleNavigateToLineStart,
  handleGetCurrentLocation,
  locating,
}) => {
  return (
    <View style={styles.overlaysContainer}>
      <View style={styles.lineNumberCard}>
        <View style={styles.lineNumberLeft}>
          <MaterialIcons name="map" size={16} color={theme.colors.gradientEnd} />
          <Text style={styles.lineNumberLabel}>Line Number</Text>
        </View>
        <View style={styles.lineNumberRight}>
          {hasPreviousLine ? (
            <TouchableOpacity
              style={styles.lineStepBtn}
              activeOpacity={0.8}
              onPress={handlePreviousLine}
            >
              <MaterialIcons name="chevron-left" size={20} color={theme.colors.gradientEnd} />
            </TouchableOpacity>
          ) : (
            <View style={styles.lineStepBtnHidden} />
          )}
          {wardLinesLoading ? (
            <ActivityIndicator size="small" color={theme.colors.gradientEnd} />
          ) : (
            <Text style={styles.lineNumberCount}>
              {totalLines > 0 ? `${activeLineIndex + 1} / ${totalLines}` : '-- / --'}{housesLoading ? ' ...' : ''}
            </Text>
          )}
          {hasNextLine ? (
            <TouchableOpacity
              style={styles.lineStepBtn}
              activeOpacity={0.8}
              onPress={handleCycleLine}
            >
              <MaterialIcons name="chevron-right" size={20} color={theme.colors.gradientEnd} />
            </TouchableOpacity>
          ) : (
            <View style={styles.lineStepBtnHidden} />
          )}
        </View>
      </View>

      <View style={styles.mapActions}>
        <TouchableOpacity style={styles.mapActionBtn} onPress={handleNavigateToLineStart}>
          <FontAwesome6 name="route" size={18} color={theme.colors.gradientEnd} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapActionBtn}
          onPress={handleGetCurrentLocation}
          disabled={locating}
        >
          {locating
            ? <ActivityIndicator size="small" color={theme.colors.gradientEnd} />
            : <MaterialIcons name="my-location" size={22} color={theme.colors.gradientEnd} />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MapOverlays;
