// app/(tabs)/settings.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

// Bu tip, index.tsx'teki DEFAULT_SETTINGS ile eşleşmelidir.
export interface PrayerSettings {
  imsak: { adhan: boolean; reminder: boolean };
  gunes: { adhan: boolean; reminder: boolean };
  ogle: { adhan: boolean; reminder: boolean };
  ikindi: { adhan: boolean; reminder: boolean };
  aksam: { adhan: boolean; reminder: boolean };
  yatsi: { adhan: boolean; reminder: boolean };
}

// Anahtarlar (index.tsx'teki 'id'ler ile aynı olmalı)
const PRAYER_KEYS: Array<{ key: keyof PrayerSettings; name: string }> = [
  { key: 'imsak', name: 'İmsak' },
  // Güneş için ayar genellikle olmaz, ancak isterseniz açabilirsiniz
  // { key: 'gunes', name: 'Güneş' }, 
  { key: 'ogle', name: 'Öğle' },
  { key: 'ikindi', name: 'İkindi' },
  { key: 'aksam', name: 'Akşam' },
  { key: 'yatsi', name: 'Yatsı' },
];

export const SETTINGS_KEY = '@prayer_settings';

// Varsayılan ayarlar (index.tsx'teki ile aynı)
export const DEFAULT_SETTINGS: PrayerSettings = {
  imsak: { adhan: true, reminder: true },
  gunes: { adhan: false, reminder: false },
  ogle: { adhan: true, reminder: true },
  ikindi: { adhan: true, reminder: true },
  aksam: { adhan: true, reminder: true },
  yatsi: { adhan: true, reminder: true },
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<PrayerSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  // Ayarları Yükle
  useEffect(() => {
    async function loadSettings() {
      try {
        const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
        if (settingsJson) {
          setSettings(JSON.parse(settingsJson));
        } else {
          setSettings(DEFAULT_SETTINGS); // İlk açılışta varsayılanları ata
        }
      } catch (e) {
        console.error("Ayarlar yüklenemedi", e);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Ayarları Güncelle ve Kaydet
  const updateSetting = (
    prayer: keyof PrayerSettings,
    type: 'adhan' | 'reminder',
    value: boolean
  ) => {
    setSettings(prevSettings => {
      const newSettings = {
        ...(prevSettings ?? DEFAULT_SETTINGS),
        [prayer]: {
          ...(prevSettings ? prevSettings[prayer] : DEFAULT_SETTINGS[prayer]),
          [type]: value,
        },
      };

      // AsyncStorage'ye kaydet (asenkron)
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
        .catch(e => console.error("Ayar kaydedilemedi", e));

      return newSettings;
    });
  };

  if (loading || !settings) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" />
        <ThemedText>Ayarlar Yükleniyor...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>Bildirim Ayarları</ThemedText>
        <ThemedText style={styles.subtitle}>
          Hangi vakitler için ezan sesi ve hatırlatıcı almak istersiniz?
        </ThemedText>

        {PRAYER_KEYS.map(({ key, name }) => (
          <View key={key} style={[styles.card, { backgroundColor: cardBackgroundColor, borderColor: borderColor }]}>
            <ThemedText type="subtitle" style={styles.cardTitle}>{name}</ThemedText>
            
            {/* Ezan Sesi Ayarı */}
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingText}>Ezan Sesi (Vakit Girdiğinde)</ThemedText>
              <Switch
                trackColor={{ false: '#767577', true: tintColor }}
                thumbColor={settings[key].adhan ? '#f4f3f4' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={(value) => updateSetting(key, 'adhan', value)}
                value={settings[key].adhan}
              />
            </View>

            {/* Hatırlatıcı Ayarı */}
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingText}>Hatırlatıcı (15 Dk Önce)</ThemedText>
              <Switch
                trackColor={{ false: '#767577', true: tintColor }}
                thumbColor={settings[key].reminder ? '#f4f3f4' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={(value) => updateSetting(key, 'reminder', value)}
                value={settings[key].reminder}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 80, // Başlık için bolca yer
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    color: 'gray',
    marginBottom: 30,
  },
  card: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingText: {
    fontSize: 16,
    flex: 1, // Metnin sığmazsa kaymasını sağlar
    marginRight: 10,
  },
});