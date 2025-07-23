import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const handleBackPress = () => {
    router.navigate('/(tabs)/menu');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="white" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Welcome to Share Jesus Today</Text>
          <Text style={styles.sectionText}>
            The Share Jesus Today App provides video testimonies of how easy and fun it is to share the love of Jesus with people God puts in your path every day. You can even share your own video testimonies on the App so others can see how easy it is and be motivated by your experience!
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Mission</Text>
          <Text style={styles.sectionText}>
            Our mission is to inspire and equip people to spread the message of Jesus love Billions of times daily all around the world so Jesus can draw us all closer to Himself. Jesus himself said, &quot;And I, if I am lifted up, will draw all people to myself.&quot; WHEN WE LIFT – HE DRAWS!!!
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Offer</Text>
          <Text style={styles.sectionText}>
            The App provides video testimonies so we can all experience the powerful impact of Lifting the Name of Jesus in Love Today and Every Day. You see, every person we meet each day is an appointment by God, not a coincidence!
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