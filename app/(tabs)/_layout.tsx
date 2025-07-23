// app/(tabs)/_layout.tsx
import i18n from '@/utils/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
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
import AuthManager from '../../utils/authManager'; // Import AuthManager

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 80 : 70;
const BUTTON_DIAMETER = 60; // Reduced diameter to match the image

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  useEffect(() => {
    // Initialize AuthManager when the app layout loads
    AuthManager.initialize().catch((error) => {
      console.error('Failed to initialize AuthManager:', error);
      // Optionally handle initialization error, e.g., show a message to the user
    });
  }, []); // Empty dependency array ensures this runs only once on mount

  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  console.log('Current pathname:', pathname);

  // Define screens that should NOT show the bottom navigation
  const hideTabBarScreens = ['/login', '/Signup', '/VerifyOtp', '/CreatePassword', '/CameraRecord','/camera',];

  const shouldHideTabBar =
    hideTabBarScreens.includes(pathname) ||
    pathname.includes('CameraRecord') ||
    pathname.endsWith('/CameraRecord');

  // Screen width is required for SVG width
  const screenWidth = Dimensions.get('window').width;

  // Custom TabBar Background with circular cutout using Path
  const TabBarBackground = () => {
    const centerX = screenWidth / 2;
    const cutoutRadius = BUTTON_DIAMETER / 2 + 8; // Cutout radius
    const tabHeight = TAB_BAR_HEIGHT + insets.bottom;
    
    // Create path with proper circular cutout
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
        <Path
          d={pathData}
          fill="#3260AD"
          fillRule="evenodd"
        />
      </Svg>
    );
  };

  // CustomTabBar component with transparent cutout and floating center button
  const CustomTabBar = ({
    state,
    descriptors,
    navigation,
  }: {
    state: {
      index: number;
      routes: { key: string; name: string }[];
    };
    descriptors: {
      [key: string]: {
        options: {
          tabBarLabel?: string;
          title?: string;
          tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
        };
      };
    };
    navigation: {
      navigate: (name: string) => void;
    };
  }) => {
    // Don't render the tab bar for auth screens
    if (shouldHideTabBar) {
      return null;
    }

    // Names for tabs
    const leftTabName = 'index'; // Home
    const centerTabName = 'post'; // Post
    const rightTabName = 'menu'; // Menu

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
            {/* Left Tab */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (currentRoute !== leftTabName) {
                  navigation.navigate(leftTabName);
                }
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

            {/* Empty space for center button */}
            <View style={{ width: BUTTON_DIAMETER }} />

            {/* Right Tab */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (currentRoute !== rightTabName) {
                  navigation.navigate(rightTabName);
                }
              }}
              style={styles.sideTab}
            >
              <Ionicons
                name={currentRoute === rightTabName ? 'menu' : 'menu-outline'}
                size={24}
                color={currentRoute === rightTabName ? 'white' : '#cbd5e1'}
              />
              <Text style={[styles.tabLabel, currentRoute === rightTabName && styles.tabLabelActive]}>
                {i18n.t('bottomNav.menu')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Center floating button: positioned absolutely over the tab bar */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (currentRoute !== centerTabName) {
              navigation.navigate(centerTabName);
            }
          }}
          style={[
            styles.floatingButton,
            { bottom: TAB_BAR_HEIGHT + insets.bottom - BUTTON_DIAMETER / 2 }
          ]}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
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
            <TabBarIcon name={focused ? 'menu' : 'menu-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
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
    marginLeft: -BUTTON_DIAMETER / 2, // Center the button
    width: BUTTON_DIAMETER,
    height: BUTTON_DIAMETER,
    borderRadius: BUTTON_DIAMETER / 2,
    backgroundColor: '#3260AD',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#3260AD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    zIndex: 10,
  },
});