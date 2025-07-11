// components/HeroSlider.tsx - Completely Web-Safe Version
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
  const [currentPage, setCurrentPage] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  
  // Refs for different implementations
  const scrollViewRef = useRef<ScrollView>(null);

  // Hero slides data
  const slides: HeroSlide[] = [
    {
      id: 1,
      title: "SPREAD THE LOVE",
      subtitle: "Just tell someone Jesus Loves You!",
      backgroundColor: "#3260ad",
      imageAsset: require('../assets/images/banner.jpeg'),
      imageStyle: "background"
      
    },
    {
      id: 2,
      title: "SHARE YOUR FAITH",
      subtitle: "Share the good news with everyone around you",
      backgroundColor: "#3260ad",
      icon: "✝️",
      imageStyle: "icon"
    },
    {
      id: 3,
      title: "CONNECT TOGETHER",
      subtitle: "Build a community of believers",
      backgroundColor: "#3260ad",
      icon: "🤝",
      imageStyle: "icon"
    },
    {
      id: 4,
      title: "GROW IN FAITH",
      subtitle: "Strengthen your relationship with God",
      backgroundColor: "#3260ad",
      icon: "🌱",
      imageStyle: "icon"
    }
  ];

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlay) return;

    const interval = setInterval(() => {
      const nextPage = (currentPage + 1) % slides.length;
      goToPage(nextPage);
    }, 4000);

    return () => clearInterval(interval);
  }, [currentPage, isAutoPlay, slides.length]);

  // Navigation function
  const goToPage = (pageIndex: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: pageIndex * screenWidth,
        animated: true
      });
    }
    setCurrentPage(pageIndex);
  };

  // Handle scroll end to update current page
  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setCurrentPage(pageIndex);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlay(!isAutoPlay);
  };

  // Render slide content
  const renderSlideContent = (slide: HeroSlide) => {
    const hasImage = slide.imageUrl || slide.imageAsset;
    const imageSource = slide.imageUrl ? 
      { uri: slide.imageUrl } : slide.imageAsset;

    return (
      <View 
        key={slide.id.toString()}
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
      {/* Universal ScrollView Implementation */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={heroSliderStyles.pagerView}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={screenWidth}
        snapToAlignment="center"
        contentContainerStyle={{ flexDirection: 'row' }}
      >
        {slides.map((slide) => renderSlideContent(slide))}
      </ScrollView>

      {/* Play/Pause Button */}
      {/* <TouchableOpacity
        style={heroSliderStyles.playPauseBtn}
        onPress={toggleAutoPlay}
        activeOpacity={0.7}
      >
        <Text style={heroSliderStyles.playPauseText}>
          {isAutoPlay ? '⏸' : '▶'}
        </Text>
      </TouchableOpacity> */}

      {/* Pagination Dots */}
      <View style={heroSliderStyles.paginationContainer}>
        {slides.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              heroSliderStyles.paginationDot,
              index === currentPage && heroSliderStyles.activePaginationDot
            ]}
            onPress={() => goToPage(index)}
            activeOpacity={0.7}
          />
        ))}
      </View>

      {/* Progress Indicator */}
      <View style={heroSliderStyles.progressContainer}>
        <View 
          style={[
            heroSliderStyles.progressBar,
            { width: `${((currentPage + 1) / slides.length) * 100}%` }
          ]}
        />
      </View>

      {/* Platform Indicator (for development/debugging) */}

    </View>
  );
};

// Enhanced styles with cross-platform support
const heroSliderStyles = StyleSheet.create({
  container: {
    height: 350,
    marginBottom: 30,
    position: 'relative',
  },
  pagerView: {
    flex: 1,
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
  playPauseBtn: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  playPauseText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activePaginationDot: {
    backgroundColor: 'white',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
    zIndex: 3,
  },
  progressBar: {
    height: 2,
    backgroundColor: 'white',
    borderRadius: 1,
    ...Platform.select({
      web: {
        transition: 'width 0.3s ease',
      },
    }),
  },
  platformIndicator: {
    position: 'absolute',
    top: 60,
    right: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 3,
  },
  platformText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default HeroSlider;