// app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 1. Eklendi

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'dark';
  
  // 2. Cihazın güvenli alanlarını alıyoruz (özellikle alt kısım için)
  const insets = useSafeAreaInsets(); 

  // Dark + Gold palet
  const tabBarBackground = '#0b0b0a';
  const activeTintColor = '#e1c564';
  const inactiveTintColor = '#7f7f7f';
  const screenBackground = '#090906';

  // 3. Tab Bar Yüksekliğini Dinamik Hesapla
  // Standart yükseklik (60) + Cihazın alt güvenli alanı (insets.bottom)
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
            
            // 4. Kritik Düzeltmeler:
            height: tabBarHeight, // Toplam yükseklik artık dinamik
            paddingBottom: insets.bottom > 0 ? insets.bottom : 10, // Alt boşluk güvenli alan kadar, yoksa 10px
            paddingTop: 10, // Üstten biraz boşluk ferahlık katar
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
          name="explore"
          options={{
            title: 'Aylık Takvim',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="date-range" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="qibla"
          options={{
            title: 'Kıble',
            tabBarIcon: ({ color, size }) => (
              <IconSymbol name="safari.fill" color={color} size={size} />
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