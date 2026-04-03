import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  
  const insets = useSafeAreaInsets(); 

  const tabBarBackground = '#0b0b0a';
  const activeTintColor = '#e1c564';
  const inactiveTintColor = '#7f7f7f';
  const screenBackground = '#090906';

  const tabBarHeight = 60 + insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: screenBackground }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: activeTintColor,
          tabBarInactiveTintColor: inactiveTintColor,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: tabBarBackground,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: tabBarHeight,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
            paddingTop: 10,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Anasayfa',
            tabBarIcon: ({ color, size }) => (
              <IconSymbol name="house.fill" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="quran"
          options={{
            title: 'Kur\'an',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="book-open-page-variant" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Keşfet',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="explore" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Ayarlar',
            tabBarIcon: ({ color, size }) => (
              <IconSymbol name="gearshape.fill" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});