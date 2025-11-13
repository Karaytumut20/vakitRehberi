// app/(tabs)/index.tsx

import AdmobBanner from '@/components/AdmobBanner';
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * --- Tipler ---
 */

interface PrayerTimeData {
  imsak: string;
  gunes: string;
  ogle: string;
  ikindi: string;
  aksam: string;
  yatsi: string;
}

interface LocationData {
  id: string;
  name: string;
}

interface CachedPrayerData {
  locationId: string;
  fetchDate: string;
  monthlyTimes: any[];
}

type PrayerName = 'İmsak' | 'Güneş' | 'Öğle' | 'İkindi' | 'Akşam' | 'Yatsı';

const PRAYER_NAMES_ORDER: PrayerName[] = [
  'İmsak',
  'Güneş',
  'Öğle',
  'İkindi',
  'Akşam',
  'Yatsı',
];

export interface PrayerSettings {
  imsak: { adhan: boolean };
  gunes: { adhan: boolean };
  ogle: { adhan: boolean };
  ikindi: { adhan: boolean };
  aksam: { adhan: boolean };
  yatsi: { adhan: boolean };
}

/**
 * --- Varsayılan Ayarlar ---
 */
export const DEFAULT_SETTINGS: PrayerSettings = {
  imsak: { adhan: true },
  gunes: { adhan: false },
  ogle: { adhan: true },
  ikindi: { adhan: true },
  aksam: { adhan: true },
  yatsi: { adhan: true },
};

export const SETTINGS_KEY = '@prayer_settings';

/**
 * --- Bildirim Sabitleri ---
 */

// Kanal ID'si
const ANDROID_CHANNEL_ID = 'standard_notification_v2'; 

// BURAYI DEĞİŞTİRDİK: _v2 yaparak kodun bildirimleri zorla tekrar kurmasını sağlıyoruz.
const SCHEDULED_HASH_KEY = '@prayer_scheduled_hash_v2';

/**
 * --- Yardımcı Fonksiyonlar ---
 */

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToDateBase(timeString: string): Date {
  let t = timeString;

  if (typeof t !== 'string') {
    console.warn(`timeToDateBase: Geçersiz saat: ${t} -> '00:00' kullanıldı`);
    t = '00:00';
  }

  if (t.startsWith('24:')) {
    t = t.replace('24:', '00:');
  }

  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function safeTimeToFutureDate(
  timeString: string,
  now: Date = new Date()
): Date {
  const candidate = timeToDateBase(timeString);
  if (candidate.getTime() <= now.getTime()) {
    return new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return candidate;
}

function formatTimeRemaining(ms: number): string {
  if (ms < 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * --- Bildirim Davranışı ---
 */

function setForegroundAlerts(enabled: boolean) {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const behavior: any = {
        shouldShowAlert: enabled,
        shouldPlaySound: enabled,
        shouldSetBadge: false,
      };

      if (Platform.OS === 'ios') {
        (behavior as any).shouldShowBanner = enabled;
      }

      return behavior as Notifications.NotificationBehavior;
    },
  });
}

// Uygulama açıkken bildirim gelmesi için true yapıldı
setForegroundAlerts(true); 

async function getMergedSettings(): Promise<PrayerSettings> {
  try {
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(saved);

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      imsak: { ...DEFAULT_SETTINGS.imsak, ...(parsed.imsak || {}) },
      gunes: { ...DEFAULT_SETTINGS.gunes, ...(parsed.gunes || {}) },
      ogle: { ...DEFAULT_SETTINGS.ogle, ...(parsed.ogle || {}) },
      ikindi: { ...DEFAULT_SETTINGS.ikindi, ...(parsed.ikindi || {}) },
      aksam: { ...DEFAULT_SETTINGS.aksam, ...(parsed.aksam || {}) },
      yatsi: { ...DEFAULT_SETTINGS.yatsi, ...(parsed.yatsi || {}) },
    };
  } catch (e) {
    console.warn('getMergedSettings error:', e);
    return DEFAULT_SETTINGS;
  }
}

interface ScheduleItem {
  key: keyof PrayerSettings;
  name: PrayerName;
  time: string;
  enabled: boolean;
}

interface SchedulePayload {
  list: ScheduleItem[];
  hash: string;
}

function buildSchedulePayload(
  times: PrayerTimeData,
  settings: PrayerSettings
): SchedulePayload {
  const baseList: ScheduleItem[] = [
    {
      key: 'imsak',
      name: 'İmsak',
      time: times.imsak,
      enabled: settings.imsak.adhan,
    },
    {
      key: 'gunes',
      name: 'Güneş',
      time: times.gunes,
      enabled: settings.gunes.adhan,
    },
    {
      key: 'ogle',
      name: 'Öğle',
      time: times.ogle,
      enabled: settings.ogle.adhan,
    },
    {
      key: 'ikindi',
      name: 'İkindi',
      time: times.ikindi,
      enabled: settings.ikindi.adhan,
    },
    {
      key: 'aksam',
      name: 'Akşam',
      time: times.aksam,
      enabled: settings.aksam.adhan,
    },
    {
      key: 'yatsi',
      name: 'Yatsı',
      time: times.yatsi,
      enabled: settings.yatsi.adhan,
    },
  ];

  const list = baseList.filter((x) => x.enabled);

  const normalized = list
    .map((x) => ({ k: x.key, t: x.time }))
    .sort((a, b) => String(a.k).localeCompare(String(b.k)));

  const hash = JSON.stringify(normalized);

  return { list, hash };
}

async function scheduleDailyNotifications(
  prayerTimes: PrayerTimeData
): Promise<void> {
  let { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    existingStatus = status;
  }

  if (existingStatus !== 'granted') {
    console.log('Bildirim izni verilmedi.');
    return;
  }

  const settings = await getMergedSettings();
  const { list, hash } = buildSchedulePayload(prayerTimes, settings);

  const lastHash = await AsyncStorage.getItem(SCHEDULED_HASH_KEY);
  
  // Hash değişmemiş olsa bile, eğer kullanıcı "bildirim gelmedi" diyorsa
  // belki ilk kurulumda hata oldu. Debug için bu kontrolü geçici olarak kaldırabilirsin
  // ya da HASH_KEY adını değiştirdiğimiz için zaten tekrar kuracak.
  if (lastHash === hash) {
    console.log('LOG: Bildirimler güncel, işlem yapılmadı.');
    return;
  }

  // Önceki planlanmış bildirimleri temizle
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  for (const p of list) {
    const date = safeTimeToFutureDate(p.time, now);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Vakit Geldi`, 
        body: `${p.name} vakti girdi.`,
        sound: 'default',
      },
      trigger: {
        date,
        ...(Platform.OS === 'android'
          ? ({ channelId: ANDROID_CHANNEL_ID } as any)
          : {}),
      },
    });

    console.log(
      `LOG: Planlandı -> ${p.name} saat: ${date.toLocaleString('tr-TR')}`
    );
  }

  await AsyncStorage.setItem(SCHEDULED_HASH_KEY, hash);
  // Kullanıcıya bilgi verebiliriz (isteğe bağlı)
  // Alert.alert('Bilgi', 'Bildirimler güncellendi.');
}

// Test bildirimi gönderme fonksiyonu
async function sendTestNotification() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Hata', 'Bildirim izni yok!');
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Test Bildirimi",
      body: "Bu bir test bildirimidir. Ses ve titreşim kontrolü.",
      sound: 'default',
    },
    trigger: null, // Hemen gönder
  });
}

function useSetupAndroidNotificationChannel() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    (async () => {
      try {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: 'Namaz Vakitleri',
          importance: Notifications.AndroidImportance.HIGH,
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          sound: 'default',
        });

        console.log('LOG: Android bildirim kanalı (Standart) ayarlandı.');
      } catch (e) {
        console.warn('Android channel setup error:', e);
      }
    })();
  }, []);
}

/**
 * --- Ana Ekran ---
 */

export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimeData | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPrayer, setCurrentPrayer] = useState<PrayerName | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerName | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('—:—:—');

  const theme = useColorScheme() ?? 'light';
  const router = useRouter();

  const highlightColor = useThemeColor({}, 'highlight');
  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mainAccentColor = useThemeColor({}, 'tint');

  const lastScheduledTimesJsonRef = useRef<string | null>(null);

  useSetupAndroidNotificationChannel();

  useEffect(() => {
    if (!times) return;

    const json = JSON.stringify(times);
    if (json === lastScheduledTimesJsonRef.current) return;

    scheduleDailyNotifications(times).catch((e) =>
      console.warn('scheduleDailyNotifications error:', e)
    );

    lastScheduledTimesJsonRef.current = json;
  }, [times]);

  const checkLocationAndFetchTimes = useCallback(async () => {
    setLoading(true);
    setError(null);

    const TODAY_DATE = getTodayDate();

    try {
      const locationJson = await AsyncStorage.getItem('@selected_location');

      if (!locationJson) {
        setError('Lütfen bir konum seçin.');
        setLoading(false);
        router.push('/select-location');
        return;
      }

      const location: LocationData = JSON.parse(locationJson);
      setSelectedLocation(location);

      const cachedDataJson = await AsyncStorage.getItem('@cached_prayer_data');

      if (cachedDataJson) {
        const cached: CachedPrayerData = JSON.parse(cachedDataJson);

        if (cached.fetchDate === TODAY_DATE && cached.locationId === location.id) {
          if (!times) {
            processApiData(cached.monthlyTimes, location.id);
          } else {
            setLoading(false);
          }
          return;
        }
      }

      await fetchPrayerTimes(location.id, TODAY_DATE);
    } catch (e) {
      console.warn('checkLocationAndFetchTimes error:', e);
      setError('Hafıza okunurken hata oluştu.');
      setLoading(false);
    }
  }, [router, times]);

  useFocusEffect(
    useCallback(() => {
      checkLocationAndFetchTimes();
    }, [checkLocationAndFetchTimes])
  );

  async function fetchPrayerTimes(
    locationId: string,
    todayDate: string
  ): Promise<void> {
    try {
      const res = await fetch(
        `https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locationId}`
      );

      if (!res.ok) {
        throw new Error(`Vakitler alınamadı (HTTP ${res.status}).`);
      }

      const monthly = await res.json();
      processApiData(monthly, locationId);

      const cache: CachedPrayerData = {
        locationId,
        fetchDate: todayDate,
        monthlyTimes: monthly,
      };

      await AsyncStorage.setItem(
        '@cached_prayer_data',
        JSON.stringify(cache)
      );
    } catch (e: any) {
      console.warn('fetchPrayerTimes error:', e);
      setError(e?.message ?? 'Vakitler çekilirken hata oluştu.');
      setLoading(false);
    }
  }

  function processApiData(monthlyTimesArray: any[], _locationId: string) {
    try {
      if (!Array.isArray(monthlyTimesArray) || monthlyTimesArray.length === 0) {
        throw new Error('API yanıtı geçersiz.');
      }

      const TODAY_DATE = getTodayDate();

      let todayTimes = monthlyTimesArray.find(
        (d: any) =>
          typeof d.date === 'string' && d.date.startsWith(TODAY_DATE)
      );

      if (!todayTimes) {
        todayTimes = monthlyTimesArray[0];
      }

      if (todayTimes) {
        setTimes({
          imsak: todayTimes.fajr,
          gunes: todayTimes.sun,
          ogle: todayTimes.dhuhr,
          ikindi: todayTimes.asr,
          aksam: todayTimes.maghrib,
          yatsi: todayTimes.isha,
        });
      } else {
        setError('Veri bulundu ancak işlenemedi.');
      }
    } catch (e: any) {
      console.warn('processApiData error:', e);
      setError(e?.message ?? 'Veri işlenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!times) return;

    const intervalId = setInterval(() => {
      const now = new Date();

      const prayerDateTimes: Record<PrayerName, Date> = {
        İmsak: timeToDateBase(times.imsak),
        Güneş: timeToDateBase(times.gunes),
        Öğle: timeToDateBase(times.ogle),
        İkindi: timeToDateBase(times.ikindi),
        Akşam: timeToDateBase(times.aksam),
        Yatsı: timeToDateBase(times.yatsi),
      };

      let current: PrayerName | null = null;
      let next: PrayerName | null = null;

      let minDiff = Infinity;

      const all = [
        ...PRAYER_NAMES_ORDER.map((name) => ({
          name,
          time: prayerDateTimes[name],
          isNextDay: false,
        })),
        {
          name: 'İmsak' as PrayerName,
          time: new Date(
            prayerDateTimes['İmsak'].getTime() + 24 * 60 * 60 * 1000
          ),
          isNextDay: true,
        },
      ];

      for (const { name, time, isNextDay } of all) {
        const diff = time.getTime() - now.getTime();

        if (diff <= 0 && !isNextDay) {
          current = name;
        }

        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          next = name;
        }
      }

      if (next === null) {
        current = 'Yatsı';
        next = 'İmsak';
        minDiff =
          all[all.length - 1].time.getTime() - now.getTime();
      }

      if (current === null && next === 'İmsak' && minDiff > 12 * 60 * 60 * 1000) {
        current = 'Yatsı';
      }

      if (current === null) {
        current = 'Yatsı';
      }

      setCurrentPrayer(current);
      setNextPrayer(next);
      setTimeRemaining(formatTimeRemaining(minDiff));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [times]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ThemedView style={styles.container}>
        <View style={styles.bannerTopWrapper}>
          <View style={styles.bannerInner}>
            <AdmobBanner />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View>
              <ThemedText style={styles.appTitle}>Vakit Rehberi</ThemedText>
              {selectedLocation && (
                <ThemedText style={styles.locationText}>
                  {selectedLocation.name}
                </ThemedText>
              )}
            </View>

            <TouchableOpacity
              style={[styles.locationButton, { borderColor: mainAccentColor }]}
              onPress={() => router.push('/select-location')}
            >
              <ThemedText
                style={[styles.locationButtonText, { color: mainAccentColor }]}
              >
                Konum Değiştir
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* --- YENİ TEST BUTONU --- */}
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: mainAccentColor }]}
            onPress={sendTestNotification}
          >
            <ThemedText style={styles.testButtonText}>🔔 Test Bildirimi Gönder</ThemedText>
          </TouchableOpacity>
          {/* ----------------------- */}

          {error && (
            <View style={styles.errorBox}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={checkLocationAndFetchTimes}
              >
                <ThemedText style={styles.retryButtonText}>
                  Tekrar dene
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {times && (
            <View
              style={[
                styles.currentCard,
                {
                  backgroundColor: cardBackgroundColor,
                  borderColor,
                },
              ]}
            >
              <ThemedText style={styles.currentLabel}>
                Şu anki vakit
              </ThemedText>
              <ThemedText
                style={[
                  styles.currentName,
                  { color: highlightColor },
                ]}
              >
                {currentPrayer ?? '—'}
              </ThemedText>

              <View style={styles.nextRow}>
                <View>
                  <ThemedText style={styles.nextLabel}>
                    Sonraki vakit
                  </ThemedText>
                  <ThemedText style={styles.nextName}>
                    {nextPrayer ?? '—'}
                  </ThemedText>
                </View>
                <View style={styles.countdownBox}>
                  <ThemedText style={styles.countdownLabel}>
                    Kalan süre
                  </ThemedText>
                  <ThemedText style={styles.countdownValue}>
                    {timeRemaining}
                  </ThemedText>
                </View>
              </View>
            </View>
          )}

          {times && (
            <ThemedText style={styles.sectionTitle}>
              Günlük Namaz Vakitleri
            </ThemedText>
          )}

          {times && (
            <View style={styles.prayerList}>
              {[
                { label: 'İmsak', value: times.imsak },
                { label: 'Güneş', value: times.gunes },
                { label: 'Öğle', value: times.ogle },
                { label: 'İkindi', value: times.ikindi },
                { label: 'Akşam', value: times.aksam },
                { label: 'Yatsı', value: times.yatsi },
              ].map((item) => {
                const isCurrent = item.label === currentPrayer;
                const containerStyle = [
                  styles.prayerRow,
                  {
                    backgroundColor: cardBackgroundColor,
                    borderColor: isCurrent ? highlightColor : borderColor,
                  },
                ];

                const timeStyle: TextStyle = {
                  ...styles.prayerTime,
                  color: isCurrent ? highlightColor : undefined,
                };

                return (
                  <View key={item.label} style={containerStyle}>
                    <ThemedText style={styles.prayerName}>
                      {item.label}
                    </ThemedText>
                    <ThemedText style={timeStyle}>
                      {item.value || '--:--'}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={styles.bannerBottomWrapper}>
          <View style={styles.bannerInner}>
          </View>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

/**
 * --- Stil Tanımları ---
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 104,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
  } as TextStyle,
  locationText: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.8,
  } as TextStyle,
  locationButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  locationButtonText: {
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
  // Yeni Test Butonu Stili
  testButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  testButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  } as TextStyle,
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffefef',
    borderWidth: 1,
    borderColor: '#ffcccc',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#b00020',
  } as TextStyle,
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#b00020',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
  currentCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  currentLabel: {
    fontSize: 13,
    opacity: 0.8,
  } as TextStyle,
  currentName: {
    fontSize: 22,
    fontWeight: '700',
  } as TextStyle,
  nextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextLabel: {
    fontSize: 12,
    opacity: 0.7,
  } as TextStyle,
  nextName: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  countdownBox: {
    alignItems: 'flex-end',
  },
  countdownLabel: {
    fontSize: 12,
    opacity: 0.7,
  } as TextStyle,
  countdownValue: {
    marginTop: 2,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  } as TextStyle,
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  } as TextStyle,
  prayerList: {
    gap: 8,
  },
  prayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  prayerName: {
    fontSize: 15,
    fontWeight: '500',
  } as TextStyle,
  prayerTime: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
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