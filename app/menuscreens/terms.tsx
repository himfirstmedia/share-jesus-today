import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../../utils/i18n';

export default function TermsAndConditionsScreen() {
  const handleBackPress = () => {
    router.navigate('/(tabs)/menu');
  };

  const handleEmailPress = () => {
    const email = 'support@sharejesustoday.org';
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert(t('common.error'), t('termsScreen.emailError'));
    });
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
        <Text style={styles.headerTitle}>{t('termsScreen.title')}</Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.mainTitle}>{t('termsScreen.mainTitle')}</Text>
        <Text style={styles.lastUpdated}>{t('termsScreen.lastUpdated')}</Text>

        {/* Section 1 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.acceptanceTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.acceptanceText')}
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.eligibilityTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.eligibilityText')}
          </Text>
        </View>

        {/* Section 3 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.registrationTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.registrationText')}
          </Text>
        </View>

        {/* Section 4 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.prohibitedTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.prohibitedText')}
          </Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.prohibitedItem1')}</Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.prohibitedItem2')}</Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.prohibitedItem3')}</Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.prohibitedItem4')}</Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.prohibitedItem5')}</Text>
        </View>

        {/* Section 5 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.moderationTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.moderationText')}
          </Text>
        </View>

        {/* Section 6 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.reportingTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.reportingText')}
          </Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.reportingItem1')}</Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.reportingItem2')}</Text>
        </View>

        {/* Section 7 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.blockingTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.blockingText')}
          </Text>
        </View>

        {/* Section 8 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.actionsTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.actionsText')}
          </Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.actionsItem1')}</Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.actionsItem2')}</Text>
          <Text style={styles.bulletPoint}>{t('termsScreen.actionsItem3')}</Text>
        </View>

        {/* Section 9 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.privacyTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.privacyText')}
          </Text>
        </View>

        {/* Section 10 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.terminationTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.terminationText')}
          </Text>
        </View>

        {/* Section 11 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.liabilityTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.liabilityText')}
          </Text>
        </View>

        {/* Section 12 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.governingLawTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.governingLawText')}
          </Text>
        </View>

        {/* Section 13 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.modificationsTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.modificationsText')}
          </Text>
        </View>

        {/* Section 14 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('termsScreen.contactTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('termsScreen.contactText')}
          </Text>
          <Text style={styles.contactLabel}>{t('termsScreen.emailLabel')}</Text>
          <TouchableOpacity onPress={handleEmailPress}>
            <Text style={styles.emailLink}>support@sharejesustoday.org</Text>
          </TouchableOpacity>
        </View>
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
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginBottom: 20,
  },
  lastUpdated: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: '#1e1b1b',
    lineHeight: 24,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#1e1b1b',
    lineHeight: 24,
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginBottom: 8,
  },
  emailLink: {
    fontSize: 16,
    color: '#0066CC',
    textDecorationLine: 'underline',
    marginBottom: 16,
  },
});