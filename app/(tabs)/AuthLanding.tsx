import { t } from '@/utils/i18n';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AuthLandingScreen() {
  const handleCreateAccount = () => {
    router.push('/Signup');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const handleBackPress = () => {
    router.navigate('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#3260ad" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="white" />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('post.videoOptions')}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.optionItem} onPress={handleLogin}>
            <View style={styles.iconContainer}>
              <Ionicons name="person" size={24} color="#333" />
            </View>
            <Text style={styles.optionText}>{t('menu.login')}</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.optionItem} onPress={handleCreateAccount}>
            <View style={styles.iconContainer}>
              <Ionicons name="person-add-outline" size={24} color="#333" />
            </View>
            <Text style={styles.optionText}>{t('menu.createAccount')}</Text>
          </TouchableOpacity>

          <View style={styles.separator} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    backgroundColor: '#3260ad',
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: 'white',
  },
  optionsContainer: {
    backgroundColor: 'white',
    marginTop: 20,
    paddingHorizontal: 0,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: 'white',
  },
  iconContainer: {
    width: 40,
    alignItems: 'flex-start',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    fontWeight: '400',
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginLeft: 60,
  },
});