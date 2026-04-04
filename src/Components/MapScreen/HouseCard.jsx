import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../../theme/appTheme';

const HouseCard = ({ item, isGrid, status, isSelected, cardWidthGrid, styles, onPress }) => {
  return (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.houseCard,
        isGrid && { width: cardWidthGrid, height: 138 },
        status === 'done' && styles.houseCardDone,
        status === 'progress' && styles.houseCardProgress,
        isSelected && styles.houseCardSelected,
      ]}
      activeOpacity={0.88}
      onPress={() => onPress(item)}
    >
      <View style={[
        styles.houseImageArea,
        status === 'done' && styles.houseImageAreaDone,
        status === 'progress' && styles.houseImageAreaProgress,
      ]}>
        {item.referenceImageUri ? (
          <Image
            source={{ uri: item.referenceImageUri }}
            style={styles.housePreviewImage}
          />
        ) : (
          <MaterialIcons
            name="home-work"
            size={34}
            color={
              status === 'done' ? theme.colors.gradientStart
                : status === 'progress' ? '#f59e0b'
                  : '#b0bec5'
            }
          />
        )}

        {status === 'done' && (
          <View style={styles.cardBadgeDone}>
            <MaterialIcons name="check" size={9} color="#fff" />
          </View>
        )}
        {status === 'progress' && (
          <View style={styles.cardBadgeProgress} />
        )}
      </View>

      <View style={[
        styles.houseCardFooter,
        status === 'done' && styles.houseCardFooterDone,
      ]}>
        <Text
          style={[
            styles.houseCardNumber,
            status === 'done' && styles.houseCardNumberDone,
          ]}
          numberOfLines={1}
        >
          {item.number}
        </Text>
        <MaterialIcons
          name={status === 'done' ? 'check-circle' : status === 'progress' ? 'pending' : 'chevron-right'}
          size={15}
          color={
            status === 'done' ? theme.colors.gradientStart
              : status === 'progress' ? '#f59e0b'
                : '#cbd5e1'
          }
        />
      </View>
    </TouchableOpacity>
  );
};

export default HouseCard;
