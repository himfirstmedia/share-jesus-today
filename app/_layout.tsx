import { Slot, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AuthManager from '../utils/authManager';

const InitialLayout = () => {
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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
  }, [isReady, isAuthenticated, segments, router]);

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
