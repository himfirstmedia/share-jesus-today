// app/(tabs)/menu.tsx - Updated menu screen with i18n support
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profileService } from "../../services/profileService";
import { VideoStorageManager } from "../../services/videoStorageUtils";
import AuthManager from "../../utils/authManager";
import { getCurrentLanguage, initializeLanguage, t } from "../../utils/i18n";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  isDestructive?: boolean;
  hideChevron?: boolean;
  isSubItem?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  onPress,
  isDestructive = false,
  hideChevron = false,
  isSubItem = false,
}) => (
  <TouchableOpacity
    style={[styles.menuItem, isSubItem && styles.subMenuItem]}
    onPress={onPress}
  >
    <View style={styles.menuItemLeft}>
      <View
        style={[
          styles.iconContainer,
          isDestructive && styles.destructiveIconContainer,
          isSubItem && styles.subItemIconContainer,
        ]}
      >
        <Ionicons
          name={icon}
          size={isSubItem ? 18 : 20}
          color={isDestructive ? "#D32F2F" : "#1e1b1b"}
        />
      </View>
      <Text
        style={[
          styles.menuItemText,
          isDestructive && styles.destructiveText,
          isSubItem && styles.subItemText,
        ]}
      >
        {title}
      </Text>
    </View>
    {!hideChevron && <Ionicons name="chevron-forward" size={20} color="#999" />}
  </TouchableOpacity>
);

interface ShareSubItemProps {
  title: string;
  onPress: () => void;
}

const ShareSubItem: React.FC<ShareSubItemProps> = ({ title, onPress }) => (
  <TouchableOpacity style={styles.shareSubItem} onPress={onPress}>
    <Text style={styles.shareSubItemText}>{title}</Text>
  </TouchableOpacity>
);

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function MenuScreen() {
  const [showAccountSubMenu, setShowAccountSubMenu] = useState(false);
  const [showShareSubMenu, setShowShareSubMenu] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState(getCurrentLanguage());
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadProfileData = useCallback(async () => {
    try {
      await initializeLanguage();
      setCurrentLanguage(getCurrentLanguage());

      const authenticated = await AuthManager.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        const userData = await profileService.getUserProfile();
        if (userData) {
          setProfile(userData);
        }
      }
    } catch (error) {
      console.error('Error loading profile for sharing:', error);
    }
  }, []);

  // useFocusEffect to reload data when the screen is focused
  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  const handleLogout = async () => {
    Alert.alert(
      t('alerts.confirmLogout'),
      t('alerts.logoutMessage'),
      [
        {
          text: t('alerts.cancel'),
          style: "cancel",
        },
        {
          text: t('alerts.logout'),
          style: "destructive",
          onPress: async () => {
            try {
              console.log("🚪 Starting logout process...");
              await AuthManager.clearAuthToken();
              console.log("✅ Logout successful, redirecting to login...");
              router.replace("/login");
            } catch (error) {
              console.error("❌ Logout failed:", error);
              Alert.alert(
                t('alerts.logoutError'),
                t('alerts.logoutErrorMessage')
              );
            }
          },
        },
      ]
    );
  };

  const handleAbout = () => {
    router.push("/menuscreens/About")
  };

  const handleHowItWorks = () => {
    router.push("/menuscreens/how-it-works")
  };

  const handleShareYourFaith = () => {
    router.push("/menuscreens/share-faith");
  };

  const handleSearchProfiles = () => {
    router.push("/search");
  };

  const handleMyAccount = () => {
    if (isAuthenticated) {
      setShowAccountSubMenu(!showAccountSubMenu);
    } else {
      router.push('/login');
    }
  };

  const handleCreateAccount = () => {
    router.push('/Signup');
  };

  const handleProfile = () => {
    router.push("/profile");
  };

  const handleChangePassword = () => {
    router.push('/menuscreens/changepassword');
  };

  const handleNotifications = () => {
    Alert.alert(
      t('alerts.notifications'),
      t('alerts.notificationsMessage')
    );
  };

  const handleCustomerSupport = () => {
    router.push('/menuscreens/contactus')
  };

  const handleShare = () => {
    setShowShareSubMenu(!showShareSubMenu);
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: t('share.appMessage', { 
          url: 'https://play.google.com/store/apps/details?id=com.himfirstapps.sharejesustoday' 
        }),
        title: t('share.appTitle')
      });
    } catch (error) {
      console.error('Error sharing app:', error);
      Alert.alert(t('alerts.error'), t('alerts.shareAppFailed'));
    }
  };

  const handleShareProfile = async () => {
    if (!profile?.id) {
      Alert.alert(t('alerts.error'), t('alerts.shareProfileError'));
      return;
    }

    try {
      const shareUrl = profileService.getProfileShareUrl(profile.id);
      const message = t('menu.shareProfile', { profileUrl: shareUrl });
      
      await Share.share({
        message,
        title: t('share.profileTitle')
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
      Alert.alert(t('alerts.error'), t('alerts.shareProfileFailed'));
    }
  };

  const handleShareVideos = () => {
    router.push('/profile')
  };

  const handleLanguage = () => {
    router.push('/menuscreens/Lang');
  };

  const handleTermsAndConditions = () => {
    router.push('/menuscreens/terms')
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('alerts.deleteAccount'),
      t('alerts.deleteAccountMessage'),
      [
        {
          text: t('alerts.cancel'),
          style: "cancel",
        },
        {
          text: t('alerts.delete'),
          style: "destructive",
          onPress: () => {
            Alert.alert(
              t('alerts.deleteAccount'),
              t('alerts.deleteAccountFeature')
            );
          },
        },
      ]
    );
  };

  const handleClearVideoCache = () => {
    Alert.alert(
      "Clear Video Cache",
      "Are you sure you want to delete all cached videos?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const deletedCount = await VideoStorageManager.clearAllVideos();
              Alert.alert(
                "Cache Cleared",
                `Successfully deleted ${deletedCount} video(s).`
              );
            } catch (error) {
              console.error("Failed to clear video cache:", error);
              Alert.alert("Error", "Failed to clear video cache.");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('menu.title')}</Text>
        {/* <Text style={styles.version}>{t('common.version')}</Text> */}
        <Text style={styles.version}>{'v22.0.0'}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuContainer}>
          <MenuItem
            icon="information-circle"
            title={t('menu.about')}
            onPress={handleAbout}
          />

          <MenuItem
            icon="help-circle"
            title={t('menu.howItWorks')}
            onPress={handleHowItWorks}
          />

          <MenuItem
            icon="send"
            title={t('menu.shareYourFaith')}
            onPress={handleShareYourFaith}
          />

          <MenuItem
            icon="search"
            title={t('menu.searchProfiles')}
            onPress={handleSearchProfiles}
          />

          <MenuItem
            icon="person"
            title={isAuthenticated ? t('menu.myAccount') : t('menu.login')}
            onPress={handleMyAccount}
          />

          {!isAuthenticated && (
            <MenuItem
              icon="person-add"
              title={t('menu.createAccount')}
              onPress={handleCreateAccount}
            />
          )}

          {isAuthenticated && showAccountSubMenu && (
            <>
              <MenuItem
                icon="person"
                title={t('menu.profile')}
                onPress={handleProfile}
                isSubItem={true}
              />

              <MenuItem
                icon="lock-closed"
                title={t('menu.changePassword')}
                onPress={handleChangePassword}
                isSubItem={true}
              />

              <MenuItem
                icon="notifications"
                title={t('menu.notifications')}
                onPress={handleNotifications}
                isSubItem={true}
              />

              <MenuItem
                icon="trash-bin"
                title="Clear Video Cache"
                onPress={handleClearVideoCache}
                isSubItem={true}
              />
            </>
          )}

          <MenuItem
            icon="headset"
            title={t('menu.customerSupport')}
            onPress={handleCustomerSupport}
          />

          {isAuthenticated && (
            <MenuItem 
              icon="share" 
              title={t('menu.share')} 
              onPress={handleShare} 
            />
          )}

          {isAuthenticated && showShareSubMenu && (
            <>
              <ShareSubItem 
                title={t('menu.shareApp')} 
                onPress={handleShareApp} 
              />

              <ShareSubItem
                title={t('share.profileTitle')}
                onPress={handleShareProfile}
              />

              <ShareSubItem 
                title={t('menu.shareVideos')} 
                onPress={handleShareVideos} 
              />
            </>
          )}

          <MenuItem
            icon="globe"
            title={`Language: ${currentLanguage.name}`}
            onPress={handleLanguage}
          />

          <MenuItem
            icon="document-text"
            title={t('menu.termsAndConditions')}
            onPress={handleTermsAndConditions}
          />

          {isAuthenticated && (
            <>
              <MenuItem
                icon="log-out"
                title={t('menu.logout')}
                onPress={handleLogout}
                isDestructive={true}
              />

              <MenuItem
                icon="trash"
                title={t('menu.deleteAccount')}
                onPress={handleDeleteAccount}
                isDestructive={true}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingBottom:10
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e1b1b",
  },
  version: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  menuContainer: {
    paddingTop: 20,
    paddingBottom:100
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  subMenuItem: {
    paddingLeft: 60,
    paddingVertical: 14,
    backgroundColor: "#fafafa",
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  subItemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  destructiveIconContainer: {
    backgroundColor: "#ffebee",
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1e1b1b",
    flex: 1,
  },
  subItemText: {
    fontSize: 15,
    fontWeight: "400",
    color: "#333",
  },
  destructiveText: {
    color: "#D32F2F",
  },
  shareSubItem: {
    paddingLeft: 60,
    paddingVertical: 12,
    paddingRight: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fafafa",
  },
  shareSubItemText: {
    fontSize: 15,
    fontWeight: "400",
    color: "#333",
  },
});
//url: 'https://apps.apple.com/ug/app/share-jesus-today/id6739215196' 
// https://play.google.com/store/apps/details?id=com.himfirstapps.sharejesustoday