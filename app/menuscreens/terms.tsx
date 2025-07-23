import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsAndConditionsScreen() {
  const handleBackPress = () => {
    router.navigate('/(tabs)/menu');
  };

  const handleEmailPress = () => {
    const email = 'support@sharejesustoday.org';
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('Error', 'Unable to open email client');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#1e1b1b" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.mainTitle}>Terms and Conditions for Share Jesus Today App</Text>
        <Text style={styles.lastUpdated}>Last Updated: 10th March 2025</Text>

        {/* Section 1 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.sectionText}>
            By accessing or using the Share Jesus Today App (the &apos;App&apos;), you agree to be bound by these Terms and Conditions (&apos;Terms&apos;). If you do not agree with any of these Terms, you must immediately stop using the App and uninstall it. These Terms form a binding legal agreement between you and the developer of the App.
          </Text>
        </View>

        {/* Section 2 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. User Eligibility</Text>
          <Text style={styles.sectionText}>
            You must be at least 13 years old to use the Share Jesus Today App. If you are under the age of 13, you are prohibited from using the App. By using the App, you represent and warrant that you are at least 13 years old and have the legal authority to enter into this agreement.
          </Text>
        </View>

        {/* Section 3 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Account Registration</Text>
          <Text style={styles.sectionText}>
            To access certain features of the App, you may be required to create an account. You agree to provide accurate, complete, and up-to-date information when registering for an account. You are responsible for maintaining the confidentiality of your account and password. If you suspect unauthorized access to your account, you agree to notify us immediately.
          </Text>
        </View>

        {/* Section 4 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Prohibited Content and Conduct</Text>
          <Text style={styles.sectionText}>
            You agree to not post, share, or transmit any content or engage in any conduct that is unlawful, harmful, offensive, defamatory, harassing, or otherwise objectionable. Specifically, you may not:
          </Text>
          <Text style={styles.bulletPoint}>- Post content that is abusive, discriminatory, offensive, or inflammatory.</Text>
          <Text style={styles.bulletPoint}>- Share obscene, pornographic, or sexually explicit material.</Text>
          <Text style={styles.bulletPoint}>- Engage in harassment, bullying, or discriminatory behavior.</Text>
          <Text style={styles.bulletPoint}>- Use hate speech, threats, or language that promotes violence or harm.</Text>
          <Text style={styles.bulletPoint}>- Post content that violates the intellectual property rights of others.</Text>
        </View>

        {/* Section 5 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Content Moderation and Reporting</Text>
          <Text style={styles.sectionText}>
            We employ a system to moderate content within the App. This includes both automated tools and human moderation to identify, report, and remove harmful content. While we strive to ensure the App remains safe and welcoming, we cannot guarantee that all objectionable content will be removed immediately.
          </Text>
        </View>

        {/* Section 6 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. User Flagging and Reporting Mechanism</Text>
          <Text style={styles.sectionText}>
            The App provides a reporting feature for users to flag content they believe violates these Terms. If you come across objectionable content, you may report it as follows:
          </Text>
          <Text style={styles.bulletPoint}>- Tap the &apos;Flag&apos; or &apos;Report&apos; button next to the offending content.</Text>
          <Text style={styles.bulletPoint}>- Provide a description of the issue and why the content violates the Terms.</Text>
        </View>

        {/* Section 7 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Blocking Abusive Users</Text>
          <Text style={styles.sectionText}>
            If you encounter an abusive user, you have the ability to block them within the App. Blocking a user prevents them from interacting with you, sending you messages, or accessing your content. If you believe a user is violating these Terms, you may also report them for further action.
          </Text>
        </View>

        {/* Section 8 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Actions on Objectionable Content</Text>
          <Text style={styles.sectionText}>
            We take reports of objectionable content seriously. When a report is received, we aim to review and resolve the issue within 24 hours. Our actions may include:
          </Text>
          <Text style={styles.bulletPoint}>- Removing the offending content.</Text>
          <Text style={styles.bulletPoint}>- Suspending or terminating the user&apos;s account.</Text>
          <Text style={styles.bulletPoint}>- Taking additional measures as necessary to maintain the safety and integrity of the App.</Text>
        </View>

        {/* Section 9 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Privacy and Data Collection</Text>
          <Text style={styles.sectionText}>
            Your privacy is important to us. Please refer to our Privacy Policy for detailed information on how we collect, use, and protect your personal data. By using the App, you consent to the collection and use of your data as described in the Privacy Policy.
          </Text>
        </View>

        {/* Section 10 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Termination of Account</Text>
          <Text style={styles.sectionText}>
            We may suspend or terminate your account if you are found to be in violation of these Terms. In the event of termination, you will lose access to the App, and your account and associated content may be deleted. You may also terminate your account at any time by contacting us or through the App&apos;s settings.
          </Text>
        </View>

        {/* Section 11 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Limitation of Liability</Text>
          <Text style={styles.sectionText}>
            To the maximum extent permitted by law, Share Jesus Today, its affiliates, and its employees are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App. This includes any loss of data, revenue, profits, or other damages incurred as a result of using the App or relying on its features.
          </Text>
        </View>

        {/* Section 12 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Governing Law and Dispute Resolution</Text>
          <Text style={styles.sectionText}>
            These Terms are governed by and construed in accordance with the laws of [Your Jurisdiction]. Any disputes arising from these Terms will be resolved in the courts of [Your Jurisdiction]. You agree to resolve any disputes through binding arbitration, with the arbitration location being [Your Jurisdiction].
          </Text>
        </View>

        {/* Section 13 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Modifications to Terms</Text>
          <Text style={styles.sectionText}>
            We reserve the right to modify these Terms at any time. Any changes to these Terms will be posted on this page with an updated &apos;Last Updated&apos; date. You are responsible for reviewing the Terms regularly. Your continued use of the App after changes have been posted constitutes your acceptance of the new Terms.
          </Text>
        </View>

        {/* Section 14 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>14. Contact Information</Text>
          <Text style={styles.sectionText}>
            If you have any questions, concerns, or feedback regarding these Terms, please contact us at:
          </Text>
          <Text style={styles.contactLabel}>Email:</Text>
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
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 9,
  },
  backText: {
    fontSize: 20,
    color: '#1e1b1b',
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1e1b1b',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
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