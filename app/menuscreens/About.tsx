import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../../utils/i18n';

export default function AboutScreen() {
  const handleBackPress = () => {
    router.navigate('/(tabs)/menu');
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
        <Text style={styles.headerTitle}>{t('aboutScreen.title')}</Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aboutScreen.welcomeTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('aboutScreen.welcomeText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aboutScreen.missionTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('aboutScreen.missionText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aboutScreen.offerTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('aboutScreen.offerText')}
          </Text>
        </View>

        {/* <View style={styles.versionSection}>
          <Text style={styles.versionText}>Share Jesus Today v13.2</Text>
        </View> */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#3260ad',
    paddingHorizontal: 20,
    paddingVertical: 45,
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
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginBottom: 16,
    lineHeight: 28,
  },
  sectionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    textAlign: 'left',
  },
  versionSection: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  versionText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
});