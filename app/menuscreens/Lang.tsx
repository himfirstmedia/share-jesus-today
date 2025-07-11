// app/menuscreens/LanguageSelection.tsx - Language selection screen
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { changeLanguage, getCurrentLanguage, supportedLanguages } from "../../utils/i18";

interface LanguageItemProps {
  code: string;
  name: string;
  nativeName: string;
  isSelected: boolean;
  onPress: () => void;
}

const LanguageItem: React.FC<LanguageItemProps> = ({
  code,
  name,
  nativeName,
  isSelected,
  onPress,
}) => (
  <TouchableOpacity style={styles.languageItem} onPress={onPress}>
    <View style={styles.languageInfo}>
      <Text style={styles.languageName}>{name}</Text>
      <Text style={styles.languageNativeName}>{nativeName}</Text>
    </View>
    {isSelected && (
      <Ionicons name="checkmark-circle" size={24} color="#3260AD" />
    )}
  </TouchableOpacity>
);

export default function LanguageSelectionScreen() {
  const [selectedLanguage, setSelectedLanguage] = useState(getCurrentLanguage().code);

  useEffect(() => {
    setSelectedLanguage(getCurrentLanguage().code);
  }, []);

  const handleLanguageSelect = async (languageCode: string) => {
    try {
      await changeLanguage(languageCode);
      setSelectedLanguage(languageCode);
      
      Alert.alert(
        "Language Changed",
        "The app language has been changed. Please restart the app to see all changes.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error("Error changing language:", error);
      Alert.alert("Error", "Failed to change language. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Language</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.languageContainer}>
          <Text style={styles.instruction}>
            Choose your preferred language for the app
          </Text>
          
          {supportedLanguages.map((language) => (
            <LanguageItem
              key={language.code}
              code={language.code}
              name={language.name}
              nativeName={language.nativeName}
              isSelected={selectedLanguage === language.code}
              onPress={() => handleLanguageSelect(language.code)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e1b1b",
  },
  scrollView: {
    flex: 1,
  },
  languageContainer: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  instruction: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e1b1b",
    marginBottom: 2,
  },
  languageNativeName: {
    fontSize: 14,
    color: "#666",
  },
});