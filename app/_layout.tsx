import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';
import 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdmobBanner from '@/components/AdmobBanner';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Uygulamanın ana arka plan rengi (Diğer sayfalarla uyumlu olması için)

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        console.log('Mobile Ads SDK başlatıldı:', adapterStatuses);
      });
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Ana kapsayıcıya uygulamanın rengini veriyoruz, siyah değil */}
      <View style={[styles.container, ]}>
        
        {/* REKLAM ALANI:
           - Siyah arka plan kaldırıldı.
           - paddingTop ile çentik altına itildi.
        */}
        <View style={[styles.adContainer, { paddingTop: insets.top }]}>
          <AdmobBanner />
        </View>

        {/* İÇERİK ALANI */}
        <View style={styles.content}>
          <Stack>
            {/* Ana Tab Bar */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            
            {/* Modal ve Diğer Sayfalar */}
            <Stack.Screen 
              name="modal" 
              options={{ presentation: 'modal', title: 'Modal' }} 
            />
            <Stack.Screen 
              name="select-location" 
              options={{ 
                presentation: 'modal', 
                title: 'Konum Seç', 
                headerShown: false 
              }} 
            />
            
            {/* Kur'an Sayfaları */}
            <Stack.Screen 
              name="quran" 
              options={{ 
                headerShown: false, 
                title: 'Kur\'an-ı Kerim' 
              }} 
            />
            <Stack.Screen 
              name="quran-detail" 
              options={{ 
                headerShown: false,
                title: 'Sure Oku',
                presentation: 'card'
              }} 
            />
          </Stack>
        </View>

      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    flex: 1, // Kalan tüm alanı kapla
  },
  adContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent', // Siyah yerine şeffaf yaptık
    zIndex: 10,
    // Altına hafif bir boşluk ekleyerek içeriğe yapışmasını önleyelim
    paddingBottom: 5,
  },
});