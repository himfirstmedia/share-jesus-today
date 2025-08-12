import { Slot, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import videoApiService from '../services/videoApiService';
import videoCacheService from '../services/videoCacheService';
import AuthManager from '../utils/authManager';
import AppIntroScreen from './AppIntro';

const InitialLayout = () => {
  const segments = useSegments();
  const router = useRouter();
  const [isAppReady, setAppReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const prepareApp = async () => {
      try {
        const introFinished = await AsyncStorage.getItem('introFinished');
        
        await AuthManager.initialize();
        const authStatus = AuthManager.isAuthenticated();
        setIsAuthenticated(authStatus);

        if (introFinished === null) {
          setShowIntro(true);
        } else {
          setAppReady(true);
        }
      } catch (e) {
        console.error('Failed to initialize the app', e);
        setAppReady(true); // Continue without intro on error
      }
    };

    const preCachePublicVideos = async () => {
      try {
        console.log('[AppLoadCache] Fetching public videos for pre-caching...');
        const response = await videoApiService.fetchPublicVideos(0, 5); // Fetch first 5 videos
        if (response.success && response.data) {
          const videos = response.data.data;
          console.log(`[AppLoadCache] Fetched ${videos.length} videos. Starting cache...`);
          videos.forEach(video => {
            if (video.url) {
              videoCacheService.startCachingVideo(video.url).catch(e => {
                console.error(`[AppLoadCache] Failed to cache ${video.url}:`, e);
              });
            }
          });
        } else {
          console.error('[AppLoadCache] Failed to fetch videos for caching:', response.error);
        }
      } catch (error) {
        console.error('[AppLoadCache] Error during video pre-caching:', error);
      }
    };

    prepareApp();
    preCachePublicVideos();

    const unsubscribe = AuthManager.subscribe((token) => {
      setIsAuthenticated(!!token);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAppReady) {
      return;
    }

    const path = segments.join('/');
    console.log('AuthGuard: Current path:', path);

    const publicRoutes = [
      '', // Represents the root route, which should resolve to /(tabs)
      '(tabs)',
      '(tabs)/menu',
      'login',
      'Signup',
      'CreatePassword',
      'VerifyOtp',
      'menuscreens/About',
      'menuscreens/how-it-works',
      'menuscreens/share-faith',
      'search',
      'menuscreens/contactus',
      'menuscreens/Lang',
      'menuscreens/terms',
      'userProfile',
      'watchVideos',
      'menuscreens/contactus',
      'forgotpassword',
      'otpresetpassword',
      'resetPassword',
      '(tabs)/AuthLanding',
    ];

    const isPublicRoute = publicRoutes.includes(path);
    console.log('AuthGuard: isPublicRoute:', isPublicRoute);

    if (!isAuthenticated && !isPublicRoute) {
      console.log('AuthGuard: Not authenticated and not a public route. Redirecting to /login.');
      router.replace('/login');
    } else if (isAuthenticated && (path === 'login' || path === 'Signup' || path === 'CreatePassword' || path === 'VerifyOtp')) {
      console.log('AuthGuard: Authenticated and on an auth page. Redirecting to /(tabs).');
      router.replace('/(tabs)');
    }
  }, [isAppReady, isAuthenticated, segments, router]);

  const handleIntroFinish = async () => {
    try {
      await AsyncStorage.setItem('introFinished', 'true');
      setShowIntro(false);
      setAppReady(true);
    } catch (e) {
      console.error('Failed to save intro status.', e);
    }
  };

  if (!isAppReady && !showIntro) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (showIntro) {
    return <AppIntroScreen onIntroFinish={handleIntroFinish} />;
  }

  return <Slot />;
};

export default InitialLayout;