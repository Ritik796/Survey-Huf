import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

const HOUSE_MARKER_ICON = require('../../assets/images/house.png');
const HOUSE_MARKER_DONE_ICON = require('../../assets/images/green_marker.png');

const HouseMarker = ({ house, isSelected, isDone, onPress }) => {
  return (
    <Marker
      coordinate={{ latitude: Number(house.latitude), longitude: Number(house.longitude) }}
      onPress={() => onPress(house)}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges
    >
      <Image
        source={isDone ? HOUSE_MARKER_DONE_ICON : HOUSE_MARKER_ICON}
        style={[
          styles.houseMarkerIcon,
          isSelected && styles.houseMarkerIconSelected,
        ]}
        resizeMode="contain"
        fadeDuration={0}
      />
    </Marker>
  );
};

const styles = StyleSheet.create({
  houseMarkerIcon: {
    width: 30,
    height: 30,
  },
  houseMarkerIconSelected: {
    width: 32,
    height: 32,
  },
});

export default HouseMarker;
