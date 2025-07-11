// First, install the required packages:
// npm install react-native-localize i18n-js
// or
// yarn add react-native-localize i18n-js

// utils/i18n.ts - Internationalization setup
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

// Import all language files
import bg from '../locales/bg.json'; // Bulgarian
import da from '../locales/da.json'; // Danish
import de from '../locales/de.json'; // German
import el from '../locales/el.json'; // Greek
import en from '../locales/en.json';
import es from '../locales/es.json'; // Spanish
import fr from '../locales/fr.json'; // French
import ga from '../locales/ga.json'; // Irish
import hi from '../locales/hi.json'; // Hindi
import it from '../locales/it.json'; // Italian
import nl from '../locales/nl.json'; // Dutch
import pt from '../locales/pt.json'; // Portuguese
import sv from '../locales/sv.json'; // Swedish
import sw from '../locales/sw.json'; // Swahili

// Create i18n instance
const i18n = new I18n({
  en,
  bg,
  da,
  nl,
  fr,
  de,
  el,
  hi,
  ga,
  it,
  pt,
  es,
  sw,
  sv,
});

// Language configuration
export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
];

// Set fallback language
i18n.fallbacks = true;
i18n.defaultLocale = 'en';

// Initialize language from storage or device locale
export const initializeLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem('selectedLanguage');
    if (savedLanguage) {
      i18n.locale = savedLanguage;
    } else {
      // Use device locale or fallback to English
      const deviceLocale = Localization.locale.split('-')[0];
      const supportedCodes = supportedLanguages.map(lang => lang.code);
      i18n.locale = supportedCodes.includes(deviceLocale) ? deviceLocale : 'en';
    }
  } catch (error) {
    console.error('Error initializing language:', error);
    i18n.locale = 'en';
  }
};

// Change language and save to storage
export const changeLanguage = async (languageCode: string) => {
  try {
    i18n.locale = languageCode;
    await AsyncStorage.setItem('selectedLanguage', languageCode);
  } catch (error) {
    console.error('Error saving language:', error);
  }
};

// Get current language
export const getCurrentLanguage = () => {
  return supportedLanguages.find(lang => lang.code === i18n.locale) || supportedLanguages[0];
};

// Translation function
export const t = (key: string, options?: object) => {
  return i18n.t(key, options);
};

export default i18n;