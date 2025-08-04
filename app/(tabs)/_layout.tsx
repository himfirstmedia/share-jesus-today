// app/(tabs)/_layout.tsx
import i18n from '@/utils/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import AuthManager from '../../utils/authManager';

import { Colors } from '@/constants/Colors';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 70;
const BUTTON_DIAMETER = 60;
const BRAND_BLUE = Colors.light.background; // Using color from constants

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  useEffect(() => {
    // Initialize AuthManager once when the app layout loads
    AuthManager.initialize().catch((error) => {
      console.error('Failed to initialize AuthManager:', error);
    });

    // Set the bottom system navigation bar color to blue permanently.
    // This will now apply to all screens.
    SystemUI.setBackgroundColorAsync('#3260ad'
  
    );
  }, []); // Runs only once when the layout is first loaded.

  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Define screens that should NOT show the bottom navigation
  const hideTabBarScreens = ['/login', '/Signup', '/VerifyOtp', '/CreatePassword', '/CameraRecord', '/camera', '/post'];
  
  const shouldHideTabBar = hideTabBarScreens.some(screen => pathname.startsWith(screen));

  const screenWidth = Dimensions.get('window').width;

  // Custom TabBar Background with circular cutout
  const TabBarBackground = () => {
    const centerX = screenWidth / 2;
    const cutoutRadius = BUTTON_DIAMETER / 2 + 8;
    const tabHeight = TAB_BAR_HEIGHT + insets.bottom;

    const pathData = `
      M 0,0
      L ${centerX - cutoutRadius},0
      A ${cutoutRadius},${cutoutRadius} 0 0,0 ${centerX + cutoutRadius},0
      L ${screenWidth},0
      L ${screenWidth},${tabHeight}
      L 0,${tabHeight}
      Z
    `;

    return (
      <Svg
        width={screenWidth}
        height={tabHeight}
        style={{ position: 'absolute', bottom: 0, left: 0 }}
      >
        <Path d={pathData} fill={BRAND_BLUE} fillRule="evenodd" />
      </Svg>
    );
  };

  // CustomTabBar component
  const CustomTabBar = ({
    state,
    navigation,
  }: {
    state: { index: number; routes: { key: string; name: string }[] };
    navigation: { navigate: (name: string) => void };
  }) => {
    
    if (shouldHideTabBar) {
      return null;
    }

    const leftTabName = 'index';
    const centerTabName = 'post';
    const rightTabName = 'menu';
    const currentRoute = state.routes[state.index]?.name;

    return (
      <View style={styles.tabBarContainer}>
        <View
          style={[
            styles.container,
            { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom },
          ]}
        >
          <TabBarBackground />
          <View style={styles.innerContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (currentRoute !== leftTabName) navigation.navigate(leftTabName);
              }}
              style={styles.sideTab}
            >
              <Ionicons
                name={currentRoute === leftTabName ? 'home' : 'home-outline'}
                size={24}
                color={currentRoute === leftTabName ? 'white' : '#cbd5e1'}
              />
              <Text style={[styles.tabLabel, currentRoute === leftTabName && styles.tabLabelActive]}>
                {i18n.t('bottomNav.home')}
              </Text>
            </TouchableOpacity>

            <View style={{ width: BUTTON_DIAMETER }} />

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (currentRoute !== rightTabName) navigation.navigate(rightTabName);
              }}
              style={styles.sideTab}
            >
              <Ionicons
                name={currentRoute === rightTabName ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'}
                size={24}
                color={currentRoute === rightTabName ? 'white' : '#cbd5e1'}
              />
              <Text style={[styles.tabLabel, currentRoute === rightTabName && styles.tabLabelActive]}>
                {i18n.t('bottomNav.menu')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={async () => {
            const isLoggedIn = AuthManager.isAuthenticated();
            if (!isLoggedIn) {
              navigation.navigate('AuthLanding');
            } else {
              if (currentRoute !== centerTabName) navigation.navigate(centerTabName);
            }
          }}
          style={[
            styles.floatingButton,
            { bottom: TAB_BAR_HEIGHT + insets.bottom - BUTTON_DIAMETER / 2 },
          ]}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      {/* This StatusBar component styles the top bar for all screens within this layout. */}
      {/* The blue color will persist because we are no longer resetting system UI colors. */}
      <StatusBar style="light" backgroundColor={BRAND_BLUE} translucent={false} />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="post"
          options={{
            title: 'Post',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'add-circle' : 'add-circle-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: 'Menu',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="AuthLanding"
          options={{
            href: null, // This tab will not be directly navigable via the tab bar
            title: 'Video Options',
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    backgroundColor: 'transparent',
  },
  innerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    flex: 1,
  },
  sideTab: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    paddingVertical: 8,
  },
  tabLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: 'white',
  },
  floatingButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -BUTTON_DIAMETER / 2,
    width: BUTTON_DIAMETER,
    height: BUTTON_DIAMETER,
    borderRadius: BUTTON_DIAMETER / 2,
    backgroundColor: BRAND_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    zIndex: 10,
  },
});
