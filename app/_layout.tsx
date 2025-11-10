// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Ana Tab Bar Yönlendiricisi */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        
        {/* Modal Sayfalar (Tab Bar'da görünmezler) */}
        <Stack.Screen 
          name="modal" 
          options={{ presentation: 'modal', title: 'Modal' }} 
        />
        <Stack.Screen 
          name="select-location" 
          options={{ 
            presentation: 'modal', 
            title: 'Konum Seç', 
            headerShown: false // Bu sayfanın kendi başlığı var
          }} 
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}