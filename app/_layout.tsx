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
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [introFinished, setIntroFinished] = useState(false);
  const [introChecked, setIntroChecked] = useState(false);

  useEffect(() => {
    const checkIntroStatus = async () => {
      try {
        const value = await AsyncStorage.getItem('introFinished');
        if (value !== null) {
          setIntroFinished(true);
        }
      } catch (e) {
        console.error('Failed to load intro status.', e);
      } finally {
        setIntroChecked(true);
      }
    };

    checkIntroStatus();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('AuthGuard: checkAuth - Initializing AuthManager...');
      await AuthManager.initialize();
      const authStatus = AuthManager.isAuthenticated();
      setIsAuthenticated(authStatus);
      setIsReady(true);
      console.log('AuthGuard: checkAuth - AuthManager initialized. isAuthenticated:', authStatus, 'isReady:', true);
    };

    checkAuth();

    const unsubscribe = AuthManager.subscribe((token) => {
      console.log('AuthGuard: AuthManager subscription update. Token present:', !!token);
      setIsAuthenticated(!!token);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
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

    preCachePublicVideos();
  }, []);

  useEffect(() => {
    if (!introFinished) {
        return;
    }
    console.log('AuthGuard: Routing useEffect triggered. isReady:', isReady, 'isAuthenticated:', isAuthenticated, 'segments:', segments);

    if (!isReady || isAuthenticated === null) {
      console.log('AuthGuard: Waiting for isReady or isAuthenticated to be set.');
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
  }, [isReady, isAuthenticated, segments, router, introFinished]);

  const handleIntroFinish = async () => {
    try {
      await AsyncStorage.setItem('introFinished', 'true');
      setIntroFinished(true);
    } catch (e) {
      console.error('Failed to save intro status.', e);
    }
  };

  if (!introChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!introFinished) {
    return <AppIntroScreen onIntroFinish={handleIntroFinish} />;
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
};

export default InitialLayout;