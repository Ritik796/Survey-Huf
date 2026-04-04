import React from 'react';
import { Animated, ScrollView, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../../theme/appTheme';

const HousesBottomSheet = ({
  styles,
  translateY,
  panHandlers,
  surveyStats,
  currentLineId,
  isExpanded,
  lineHouses,
  renderHouseCard,
}) => {
  return (
    <Animated.View style={[styles.bottomSheet, { transform: [{ translateY }] }]}>
      <View style={styles.sheetHandleWrap} {...panHandlers}>
        <View style={styles.sheetHandle} />
      </View>

      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Houses</Text>
        <View style={styles.statsRow}>
          <View style={styles.statChipDone}>
            <MaterialIcons name="check-circle" size={11} color={theme.colors.gradientEnd} />
            <Text style={[styles.statChipText, { color: theme.colors.gradientEnd }]}>{surveyStats.done}</Text>
          </View>
          {surveyStats.inProgress > 0 && (
            <View style={styles.statChipProgress}>
              <MaterialIcons name="pending" size={11} color="#d97706" />
              <Text style={[styles.statChipText, { color: '#d97706' }]}>{surveyStats.inProgress}</Text>
            </View>
          )}
          <View style={styles.statChipTotal}>
            <MaterialIcons name="home-work" size={11} color="#64748b" />
            <Text style={[styles.statChipText, { color: '#64748b' }]}>{surveyStats.total}</Text>
          </View>
        </View>
      </View>

      {surveyStats.total > 0 && (
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.round((surveyStats.done / surveyStats.total) * 100)}%` },
            ]}
          />
        </View>
      )}

      <View style={styles.listContainer}>
        {isExpanded ? (
          <ScrollView
            key={`vertical-grid-${currentLineId || 'na'}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.housesGrid}
          >
            {lineHouses.map((item) => renderHouseCard(item, true))}
          </ScrollView>
        ) : (
          <ScrollView
            key={`horizontal-list-${currentLineId || 'na'}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.housesScroll}
          >
            {lineHouses.map((item) => renderHouseCard(item, false))}
          </ScrollView>
        )}
      </View>
    </Animated.View>
  );
};

export default HousesBottomSheet;
