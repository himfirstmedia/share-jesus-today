import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const VideoCardSkeleton = () => {
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnimation, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnimation]);

  const translateX = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-350, 350],
  });

  return (
    <View style={styles.cardContainer}>
      {/* Shimmer Effect */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.shimmer,
          { transform: [{ translateX }] },
        ]}
      />
      
      {/* Thumbnail Placeholder */}
      <View style={styles.thumbnailPlaceholder} />
      
      {/* Info Placeholder */}
      <View style={styles.infoContainer}>
        <View style={styles.avatarPlaceholder} />
        <View style={styles.textContainer}>
          <View style={styles.textPlaceholderShort} />
          <View style={styles.textPlaceholderLong} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#f0f0f0', // Base color for skeleton items
    borderRadius: 12,
    marginBottom: 20,
    marginTop:30,
    overflow: 'hidden', // Important for the shimmer effect
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#e0e0e0',
  },
  infoContainer: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  textPlaceholderShort: {
    width: '60%',
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
  },
  textPlaceholderLong: {
    width: '80%',
    height: 14,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  shimmer: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: '100%',
    height: '100%',
  },
});

export default VideoCardSkeleton;