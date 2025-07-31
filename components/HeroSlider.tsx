// components/HeroSlider.tsx - Static Image Version
import React from 'react';
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import i18n from '../utils/i18n';

const { width: screenWidth } = Dimensions.get('window');

interface HeroSlide {
  id: number;
  title: string;
  subtitle: string;
  backgroundColor: string;
  icon?: string;
  imageUrl?: string;
  imageAsset?: ImageSourcePropType;
  imageStyle?: 'background' | 'overlay' | 'icon';
}

const HeroSlider: React.FC = () => {
  // Single hero slide data
  const slide: HeroSlide = {
    id: 1,
    title: i18n.t('heroSlider.title1'),
    subtitle: i18n.t('heroSlider.subtitle1'),
    backgroundColor: "#3260ad",
    imageAsset: require('../assets/images/banner.jpeg'),
    imageStyle: "background"
  };

  // Render slide content
  const renderSlideContent = (slide: HeroSlide) => {
    const hasImage = slide.imageUrl || slide.imageAsset;
    const imageSource = slide.imageUrl ? 
      { uri: slide.imageUrl } : slide.imageAsset;

    return (
      <View 
        style={[
          heroSliderStyles.slide, 
          { 
            backgroundColor: slide.backgroundColor,
            width: screenWidth
          }
        ]}
      >
        {/* Background Image */}
        {hasImage && slide.imageStyle === 'background' && (
          <Image
            source={imageSource!}
            style={heroSliderStyles.backgroundImage}
            resizeMode="cover"
          />
        )}
        
        {/* Overlay for background images */}
        {hasImage && slide.imageStyle === 'background' && (
          <View style={heroSliderStyles.overlay} />
        )}

        {/* Content Container */}
        <View style={heroSliderStyles.contentContainer}>
          {/* Icon or Icon Image */}
          {hasImage && slide.imageStyle === 'icon' ? (
            <Image
              source={imageSource!}
              style={heroSliderStyles.iconImage}
              resizeMode="contain"
            />
          ) : slide.icon ? (
            <Text style={heroSliderStyles.slideIcon}>{slide.icon}</Text>
          ) : null}

          <Text style={heroSliderStyles.slideTitle}>{slide.title}</Text>
          <Text style={heroSliderStyles.slideSubtitle}>{slide.subtitle}</Text>
        </View>

        {/* Overlay Image */}
        {hasImage && slide.imageStyle === 'overlay' && (
          <Image
            source={imageSource!}
            style={heroSliderStyles.overlayImage}
            resizeMode="contain"
          />
        )}
      </View>
    );
  };

  return (
    <View style={heroSliderStyles.container}>
      {/* Static Hero Image */}
      {renderSlideContent(slide)}
    </View>
  );
};

// Simplified styles for static image
const heroSliderStyles = StyleSheet.create({
  container: {
    height: 350,
    marginBottom: 30,
    position: 'relative',
  },
  slide: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    zIndex: 2,
  },
  slideIcon: {
    fontSize: 48,
    marginBottom: 15,
    textAlign: 'center',
  },
  iconImage: {
    width: 48,
    height: 48,
    marginBottom: 15,
    tintColor: 'white',
  },
  overlayImage: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 60,
    height: 60,
    opacity: 0.8,
    zIndex: 1,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  slideSubtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default HeroSlider;