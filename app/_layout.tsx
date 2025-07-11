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
      await AuthManager.initialize();
      const authStatus = AuthManager.isAuthenticated();
      setIsAuthenticated(authStatus);
      setIsReady(true);
    };

    checkAuth();

    const unsubscribe = AuthManager.subscribe((token) => {
      setIsAuthenticated(!!token);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    console.log('AuthGuard: app/_layout.tsx', { isReady, isAuthenticated, segments }); // Added log
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'Signup' || segments[0] === 'CreatePassword' || segments[0] === 'VerifyOtp';

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
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
