// app/login.tsx - Updated with proper vertical centering
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import apiService from '@/services/apiService';
import AuthManager from '@/utils/authManager';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { t } from '@/utils/i18n';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Initialize AuthManager when component mounts
  useEffect(() => {
    const initAuth = async () => {
      try {
        await AuthManager.initialize();

        // Check if already authenticated
        if (AuthManager.isAuthenticated()) {
          console.log('✅ Already authenticated, redirecting...');
          router.replace('/' as any);
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    const backAction = () => {
      BackHandler.exitApp(); // Exits the app
      return true; // Prevent default behavior (going back)
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, []);

  // Updated login handler that properly stores user profile data
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert(t('login.error'), t('login.pleaseFillAllFields'));
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Attempting login...');

      const response = await apiService.login({
        userName: username,
        password: password,
      });

      if (response.success && response.data && response.data.jwt) {
        console.log('✅ Login successful, setting up authentication...');
        console.log('📋 Full login response:', response.data);

        // Store JWT token using AuthManager
        await AuthManager.setAuthToken(response.data.jwt);

        // CRITICAL: Store user profile data from login response
        if (response.data.person) {
          const person = response.data.person;
          console.log('👤 Storing user profile data:', person);

          // Store all user profile data (matching Android implementation)
          const userDataToStore = {
            id: person.id,
            firstName: person.firstName || '',
            lastName: person.lastName || '',
            email: person.email || '',
            gender: person.gender || '',
            dob: person.dob || '',
            country: person.country || '',
            state: person.state || '',
            city: person.city || '',
            zipcode: person.zipcode || person.zipCode || '', // Handle both cases
            church: person.church || person.signupchurch || '',
            biography: person.biography || '',
            profilepic: person.profilePicture || '',
            coverimg: person.coverPhoto || '',
            publicemail: person.churchFrom || '',
            phone: person.phone || '',
            address: person.address || '',
            signupchurch: person.church || '',
            createdby: person.createdby || person.createdBy || '',
            updatedby: person.updatedby || person.updatedBy || '',
            createdtimestamp: person.createdtimestamp || person.createdTimestamp || '',
            otp: person.otp ? person.otp.toString() : '',
          };

          // Store each field individually (matching Android SharedPreferences approach)
          for (const [key, value] of Object.entries(userDataToStore)) {
            if (value !== null && value !== undefined) {
              await AsyncStorage.setItem(key, value.toString());
            }
          }

          // Also store currentUserId for compatibility
          await AsyncStorage.setItem('currentUserId', person.id);

          console.log('✅ User profile data stored successfully');

          // Debug storage
          if (__DEV__) {
            console.log('🔍 Verifying stored data:');
            const storedId = await AsyncStorage.getItem('id');
            const storedEmail = await AsyncStorage.getItem('email');
            console.log('  Stored ID:', storedId);
            console.log('  Stored Email:', storedEmail);
            await AuthManager.debugAuthStatus();
          }
        } else {
          console.warn('⚠️ No person data in login response - this might cause profile issues');
        }

        router.replace('/');
      } else {
        const errorMessage = response.error || t('login.loginFailedCheckCredentials');
        Alert.alert(t('login.loginFailed'), errorMessage);
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      Alert.alert(t('login.error'), t('login.anErrorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Add debug function for development
  const debugAuth = async () => {
    if (__DEV__) {
      console.log('🔍 Manual Auth Debug:');
      await AuthManager.debugAuthStatus();

      // Also run the existing auth debugger
      const { AuthDebugger } = await import('@/utils/authDebug');
      await AuthDebugger.runCompleteAuthDiagnostic();
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'white',
    },
    header: {
      paddingTop: 10,
      paddingHorizontal: 20,
      paddingBottom: 0,
      // Remove flex properties to keep header at top
    },
    backButton: {
      padding: 8,
      alignSelf: 'flex-start',
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingBottom: 10,
      paddingTop: 1,
      // Ensure minimum height for proper centering
      minHeight: screenHeight - 120, // Account for header height and safe areas
    },
    contentContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 10,
      color: '#3260ad',
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 40,
      color: Colors.light.text,
    },
    inputContainer: {
      marginBottom: 20,
      width: '100%',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
      color: '#3260ad',
    },
    input: {
      borderWidth: 1,
      borderColor: Colors.dark.icon,
      borderRadius: 8,
      padding: 15,
      fontSize: 16,
      backgroundColor: Colors.dark.tint,
      color: '#000',
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Colors.dark.icon,
      borderRadius: 8,
      backgroundColor: Colors.dark.tint,
    },
    passwordInput: {
      flex: 1,
      padding: 15,
      fontSize: 16,
      color: '#000',
    },
    eyeIcon: {
      paddingHorizontal: 15,
    },
    loginButton: {
      backgroundColor: '#3260ad',
      borderRadius: 8,
      padding: 15,
      alignItems: 'center',
      marginTop: 20,
      width: '100%',
    },
    loginButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    logo: {
      width: 220,
      height: 180,
      alignSelf: 'center',
      marginBottom: 1,
    },
    linkContainer: {
      alignItems: 'center',
      width: '100%',
    },
    forgotPassword: {
      textAlign: 'center',
      marginTop: 15,
      color: '#3260ad',
      fontSize: 14,
    },
    linkText: {
      color: '#000',
      fontSize: 16,
      textDecorationLine: 'underline',
      marginTop: 10,
    },
    debugButton: {
      backgroundColor: '#FF6B6B',
      borderRadius: 8,
      padding: 10,
      alignItems: 'center',
      marginTop: 10,
      width: '100%',
    },
    debugButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: 'bold',
    },
  });

  const handleBack = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header with Back Button - Fixed at top */}
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={handleBack} style={dynamicStyles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#37455cff" />
          </TouchableOpacity>
        </View>

        {/* Scrollable content area - Vertically centered */}
        <ScrollView
          contentContainerStyle={dynamicStyles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={dynamicStyles.contentContainer}>
            <Image
              source={require('../assets/images/logo.png')}
              style={dynamicStyles.logo}
              resizeMode="contain"
            />

            <Text style={dynamicStyles.title}>{t('login.welcomeBack')}</Text>
            <Text style={dynamicStyles.subtitle}>{t('login.signInToContinue')}</Text>

            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.label}>{t('login.username')}</Text>
              <TextInput
                style={dynamicStyles.input}
                value={username}
                onChangeText={setUsername}
                placeholder={t('login.enterYourUsername')}
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.label}>{t('login.password')}</Text>
              <View style={dynamicStyles.passwordInputContainer}>
                <TextInput
                  style={dynamicStyles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('login.enterYourPassword')}
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={togglePasswordVisibility}
                  style={dynamicStyles.eyeIcon}
                  disabled={loading}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={dynamicStyles.loginButton}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <View style={dynamicStyles.loadingContainer}>
                  <ActivityIndicator color="white" />
                  <Text style={dynamicStyles.loadingText}>{t('login.signingIn')}</Text>
                </View>
              ) : (
                <Text style={dynamicStyles.loginButtonText}>{t('login.signIn')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={dynamicStyles.linkContainer}
              onPress={() => router.push('/forgotpassword')}
            >
              <Text style={dynamicStyles.forgotPassword}>
                {t('login.forgotPassword')}
              </Text>
            </TouchableOpacity>


            <TouchableOpacity
              style={dynamicStyles.linkContainer}
              onPress={() => router.push('/Signup')}
              disabled={loading}
            >
              <Text style={dynamicStyles.linkText}>{t('login.noAccountSignUp')}</Text>
            </TouchableOpacity>

            {/* Debug button for development */}
            {/* {__DEV__ && (
              <TouchableOpacity
                style={dynamicStyles.debugButton}
                onPress={debugAuth}
              >
                <Text style={dynamicStyles.debugButtonText}>Debug Auth</Text>
              </TouchableOpacity>
            )} */}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}