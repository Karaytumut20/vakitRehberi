// app/(tabs)/settings.tsx

import AdmobBanner from '@/components/AdmobBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  TextStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * Index ekranındakiyle birebir aynı tipler ve anahtarlar
 */

export interface PrayerSettings {
  imsak: { adhan: boolean };
  gunes: { adhan: boolean };
  ogle: { adhan: boolean };
  ikindi: { adhan: boolean };
  aksam: { adhan: boolean };
  yatsi: { adhan: boolean };
}

// Anahtarlar (index.tsx'teki id'lerle uyumlu)
const PRAYER_KEYS: Array<{ key: keyof PrayerSettings; name: string }> = [
  { key: 'imsak', name: 'İmsak' },
  // İstersen burayı açıp Güneş için de ayar ekleyebilirsin
  // { key: 'gunes', name: 'Güneş' },
  { key: 'ogle', name: 'Öğle' },
  { key: 'ikindi', name: 'İkindi' },
  { key: 'aksam', name: 'Akşam' },
  { key: 'yatsi', name: 'Yatsı' },
];

export const SETTINGS_KEY = '@prayer_settings';

// Varsayılan ayarlar (index.tsx ile aynı)
export const DEFAULT_SETTINGS: PrayerSettings = {
  imsak: { adhan: true },
  gunes: { adhan: false }, // Güneş genelde kapalı
  ogle: { adhan: true },
  ikindi: { adhan: true },
  aksam: { adhan: true },
  yatsi: { adhan: true },
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<PrayerSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

  /**
   * Ayarları AsyncStorage'den yükle ve varsayılanlarla merge et
   */
  useEffect(() => {
    async function loadSettings() {
      try {
        const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);

        if (settingsJson) {
          const parsedSettings = JSON.parse(settingsJson);

          const merged: PrayerSettings = { ...DEFAULT_SETTINGS };
          for (const { key } of PRAYER_KEYS) {
            merged[key] = {
              adhan:
                parsedSettings[key]?.adhan ??
                DEFAULT_SETTINGS[key].adhan,
            };
          }

          setSettings(merged);
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (e) {
        console.error('Ayarlar yüklenemedi', e);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  /**
   * Ayar güncelleme + AsyncStorage'e kaydetme
   */
  const updateSetting = (
    prayer: keyof PrayerSettings,
    type: 'adhan',
    value: boolean
  ) => {
    setSettings((prev) => {
      const base = prev ?? DEFAULT_SETTINGS;

      const newSettings: PrayerSettings = {
        ...base,
        [prayer]: {
          ...base[prayer],
          [type]: value,
        },
      };

      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings)).catch(
        (e) => console.error('Ayar kaydedilemedi', e)
      );

      return newSettings;
    });
  };

  if (loading || !settings) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ThemedView style={styles.center}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={styles.loadingText}>
            Ayarlar Yükleniyor...
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        {/* ÜST ADMOB BANNER */}
        <View style={styles.bannerTopWrapper}>
          <View style={styles.bannerInner}>
            <AdmobBanner />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Başlık */}
          <ThemedText style={styles.title}>Bildirim Ayarları</ThemedText>
          <ThemedText style={styles.subtitle}>
            Hangi vakitler için ezan sesi almak istersiniz?
          </ThemedText>

          {/* Kart */}
          <View
            style={[
              styles.card,
              { backgroundColor: cardBackgroundColor, borderColor },
            ]}
          >
            <ThemedText
              style={[styles.cardTitle, { color: tintColor }]}
            >
              Ezan Sesi Tercihleri
            </ThemedText>

            {PRAYER_KEYS.map(({ key, name }, index) => {
              const isLast = index === PRAYER_KEYS.length - 1;
              return (
                <View
                  key={key}
                  style={[
                    styles.settingRow,
                    !isLast && {
                      borderBottomWidth: 1,
                      borderBottomColor: borderColor,
                    },
                  ]}
                >
                  <ThemedText style={styles.settingText}>
                    {name} vaktinde ezan sesi
                  </ThemedText>
                  <Switch
                    value={settings[key].adhan}
                    onValueChange={(value) =>
                      updateSetting(key, 'adhan', value)
                    }
                    thumbColor={
                      settings[key].adhan ? tintColor : undefined
                    }
                    trackColor={{
                      false: '#ccc',
                      true: tintColor,
                    }}
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* ALT ADMOB BANNER */}
        <View style={styles.bannerBottomWrapper}>
          <View style={styles.bannerInner}>
          </View>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  } as TextStyle,
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  } as TextStyle,
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: 'gray',
    marginBottom: 20,
  } as TextStyle,
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  } as TextStyle,
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingText: {
    fontSize: 16,
    flex: 1,
    marginRight: 10,
  } as TextStyle,
  bannerTopWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  bannerBottomWrapper: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  bannerInner: {
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
