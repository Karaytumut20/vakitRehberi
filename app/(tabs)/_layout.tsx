// app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import AdmobBanner from '@/components/AdmobBanner';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={styles.root}>
      {/* TABBAR + SAYFALAR */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.tabIconSelected,
          tabBarInactiveTintColor: theme.tabIconDefault,
          tabBarButton: HapticTab,
          tabBarStyle: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: '#e0e0e0',
            height: 56,
            paddingBottom: 4,
            paddingTop: 4,
            backgroundColor: theme.background,

            // Tab bar'ı biraz yukarı alıyoruz ki altına AdMob sığsın
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 55, // 🔹 AdMob yüksekliği kadar boşluk
          },
        }}
      >
        {/* ANASAYFA */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Anasayfa',
            tabBarIcon: ({ color, size }) => (
              <IconSymbol name="house.fill" color={color} size={size} />
            ),
          }}
        />

        {/* AYLIK TAKVİM */}
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Aylık Takvim',
            tabBarIcon: ({ color, size }) => (
      <MaterialIcons name="date-range" size={size} color={color} />
            ),
          }}
        />

        {/* KIBLE */}
        <Tabs.Screen
          name="qibla"
          options={{
            title: 'Kıble',
            tabBarIcon: ({ color, size }) => (
              <IconSymbol name="safari.fill" color={color} size={size} />
            ),
          }}
        />

        {/* AYARLAR */}
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

      {/* EN ALTA SABİT ADMOB BANNER */}
      <View
        style={[
          styles.adContainer,
          { backgroundColor: theme.background },
        ]}
      >
        <AdmobBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  adContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
});
