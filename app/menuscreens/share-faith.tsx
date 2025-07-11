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

export default function ShareFaithScreen() {
  const handleBackPress = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="white" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Your Faith</Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why Share The Love of Jesus:</Text>
          <Text style={styles.sectionText}>
            Sharing the Love of Jesus and showing the positive effect His Love has on others will help embolden more people to do the same. As we lift Jesus in Love, He promises to draw both us and the listeners closer to himself.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Can You Share:</Text>
          <Text style={styles.sectionText}>
            Record and upload a video through the App or the website and share it with your friends, family and beyond. Just a few clicks and you will make a difference in the lives of others around the world.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Be The Light:</Text>
          <Text style={styles.sectionText}>
            By speaking the Love of Jesus (the Light) to others you open the door for the Holy Spirit to draw them to Jesus. Just like turning the light on in a dark room, when you shine the Love of Jesus, Darkness must flee!
          </Text>
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
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
});