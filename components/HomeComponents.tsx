// components/HomeComponents.tsx
import { t } from '@/utils/i18n';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Image,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { type Video as VideoType } from '../services/apiService';
import { homeStyles } from '../styles/HomeStyles';
import AuthManager from '../utils/authManager';
import HeroSlider from './HeroSlider';

// Props interfaces
interface VideoCardProps {
  video: VideoType;
  onPress: (video: VideoType) => void;
}

interface PlayButtonProps {
  onPress: () => void;
}

interface LoadingStateProps {
  text: string;
}

interface EmptyStateProps {
  text: string;
  onRetry?: () => void;
}

interface VideoModalProps {
  visible: boolean;
  video: VideoType | null;
  isLoading: boolean;
  onClose: () => void;
  onVideoLoad: () => void;
  onVideoError: (error: any) => void;
  onPlaybackStatusUpdate: (status: any) => void;
}

// Logo Component
export const LogoIcon = () => (
  <View >
    <Image source={require('../assets/images/logo.png')} style={{ width: 300, height: 200 }} />
  </View>
);

// Loading State Component
export const LoadingState: React.FC<LoadingStateProps> = ({ text }) => (
  <View style={homeStyles.loadingContainer}>
    <ActivityIndicator size="large" color="#4472C4" />
    <Text style={homeStyles.loadingText}>{text}</Text>
  </View>
);

// Empty State Component
export const EmptyState: React.FC<EmptyStateProps> = ({ text, onRetry }) => (
  <View style={homeStyles.emptyContainer}>
    <Text style={homeStyles.emptyText}>{text}</Text>
    {onRetry && (
      <TouchableOpacity style={homeStyles.retryButton} onPress={onRetry}>
        <Text style={homeStyles.retryButtonText}>{t('loading.retryButton')}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// Navigation Icons
export const HomeIcon = () => (
  <View style={homeStyles.navIcon}>
    <View style={[homeStyles.iconRect, { width: 16, height: 10, marginBottom: 2 }]} />
    <View style={[homeStyles.iconRect, { width: 12, height: 8 }]} />
  </View>
);

export const MenuIcon = () => (
  <View style={homeStyles.navIcon}>
    <View style={[homeStyles.iconDot, { marginBottom: 3 }]} />
    <View style={[homeStyles.iconDot, { marginBottom: 3 }]} />
    <View style={homeStyles.iconDot} />
  </View>
);



// Header Section Component
export const HeaderSection: React.FC<{
  onSearchProfiles: () => void;
  onPostVideo: () => void;
}> = ({ onSearchProfiles, onPostVideo }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      await AuthManager.ensureInitialized();
      setIsAuthenticated(AuthManager.isAuthenticated());
    };

    checkAuth();

    const unsubscribe = AuthManager.subscribe(token => {
      setIsAuthenticated(!!token);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <View style={homeStyles.header}>
      <View style={homeStyles.logo}>
        <LogoIcon />
      </View>

      <View style={homeStyles.mainButtons}>
        <TouchableOpacity style={homeStyles.actionButton} onPress={onSearchProfiles}>
          <Text style={homeStyles.actionButtonText}>{t('home.searchProfiles')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={homeStyles.actionButton} onPress={onPostVideo}>
          <Text style={homeStyles.actionButtonText}>{t('home.postVideo')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={homeStyles.actionButton} onPress={onWatchVideos}>
          <Text style={homeStyles.actionButtonText}>{t('home.watchVideos')}</Text>
        </TouchableOpacity>
        {!isAuthenticated && (
          <TouchableOpacity onPress={() => router.push('/Signup')} style={homeStyles.actionButton}>
            <Text style={homeStyles.actionButtonText}>{t('menu.createAccount')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Hero Section Component
export const HeroSection = () => (
  <HeroSlider />
);

// Bottom Navigation Component


// Floating Action Button Component
export const FloatingActionButton: React.FC<{
  onPress: () => void;
}> = ({ onPress }) => (
  <TouchableOpacity style={homeStyles.floatingButton} onPress={onPress}>
    <Text style={homeStyles.floatingButtonText}>+</Text>
  </TouchableOpacity>
);

function onWatchVideos(event: GestureResponderEvent): void {
  router.push('/watchVideos');
}
