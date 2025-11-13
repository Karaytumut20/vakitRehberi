// FULL WORKING - EXPO SDK 54 - expo-notifications@0.29.4
// "setNotificationHandler" %100 çalışan stabil sürüm

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

// --- NOTIFICATIONS ---
import * as Notifications from 'expo-notifications';
// setNotificationHandler burada EXPORT EDİLMEZ → Doğru kullanım budur.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --- ROUTER ---
import { useFocusEffect, useRouter } from 'expo-router';

// --- CUSTOM COMPONENTS ---
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';


// --------------------------------------------------------------------------------------
// TYPES
// --------------------------------------------------------------------------------------

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

// DEFAULT SETTINGS
export const DEFAULT_SETTINGS: PrayerSettings = {
  imsak: { adhan: true },
  gunes: { adhan: false },
  ogle: { adhan: true },
  ikindi: { adhan: true },
  aksam: { adhan: true },
  yatsi: { adhan: true },
};

export const SETTINGS_KEY = '@prayer_settings';


// --------------------------------------------------------------------------------------
// CONSTANTS
// --------------------------------------------------------------------------------------

const ANDROID_CHANNEL_ID = 'adhan_channel_v1';
const NOTIFICATION_SOUND_NAME = 'adhan.wav';

// APP içi çalınacak ses
const ADHAN_REQUIRE = require('../../assets/sounds/adhan.wav');

const SCHEDULED_HASH_KEY = '@prayer_scheduled_hash';

// --------------------------------------------------------------------------------------
// UTILS
// --------------------------------------------------------------------------------------

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToDateBase(timeString: string): Date {
  let t = timeString;

  if (!t) t = '00:00';
  if (t.startsWith('24:')) t = t.replace('24:', '00:');

  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function safeTimeToFutureDate(timeString: string, now = new Date()): Date {
  const candidate = timeToDateBase(timeString);
  if (candidate <= now) {
    return new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return candidate;
}

function formatTimeRemaining(ms: number): string {
  if (ms < 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

// --------------------------------------------------------------------------------------
// SETTINGS LOAD
// --------------------------------------------------------------------------------------

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
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// --------------------------------------------------------------------------------------
// SCHEDULE SYSTEM
// --------------------------------------------------------------------------------------

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
  const base: ScheduleItem[] = [
    { key: 'imsak', name: 'İmsak', time: times.imsak, enabled: settings.imsak.adhan },
    { key: 'gunes', name: 'Güneş', time: times.gunes, enabled: settings.gunes.adhan },
    { key: 'ogle', name: 'Öğle', time: times.ogle, enabled: settings.ogle.adhan },
    { key: 'ikindi', name: 'İkindi', time: times.ikindi, enabled: settings.ikindi.adhan },
    { key: 'aksam', name: 'Akşam', time: times.aksam, enabled: settings.aksam.adhan },
    { key: 'yatsi', name: 'Yatsı', time: times.yatsi, enabled: settings.yatsi.adhan },
  ];

  const list = base.filter((x) => x.enabled);

  const normalized = list
    .map((x) => ({ k: x.key, t: x.time }))
    .sort((a, b) => String(a.k).localeCompare(String(b.k)));

  const hash = JSON.stringify(normalized);
  return { list, hash };
}

async function scheduleDailyNotifications(times: PrayerTimeData) {
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const res = await Notifications.requestPermissionsAsync();
    status = res.status;
  }
  if (status !== 'granted') return;

  const settings = await getMergedSettings();
  const { list, hash } = buildSchedulePayload(times, settings);

  const last = await AsyncStorage.getItem(SCHEDULED_HASH_KEY);
  if (last === hash) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  for (const p of list) {
    const date = safeTimeToFutureDate(p.time, now);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${p.name} Vakti`,
        body: `${p.name} vakti girdi.`,
        sound: NOTIFICATION_SOUND_NAME as any,
      },
trigger: {
  type: Notifications.SchedulableTriggerInputTypes.DATE,
  date,
  ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {})
}
    });
  }

  await AsyncStorage.setItem(SCHEDULED_HASH_KEY, hash);
}

// --------------------------------------------------------------------------------------
// ANDROID CHANNEL
// --------------------------------------------------------------------------------------

function useSetupAndroidNotificationChannel() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    (async () => {
      try {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: 'Namaz Vakitleri',
          importance: Notifications.AndroidImportance.MAX,
          sound: NOTIFICATION_SOUND_NAME as any,
        });
      } catch {}
    })();
  }, []);
}

// --------------------------------------------------------------------------------------
// AUDIO MODE
// --------------------------------------------------------------------------------------

let audioModeConfigured = false;
async function ensureAudioModeOnce() {
  if (audioModeConfigured) return;
  audioModeConfigured = true;

  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {}
}

// --------------------------------------------------------------------------------------
// MAIN SCREEN
// --------------------------------------------------------------------------------------

export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimeData | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const theme = useColorScheme() ?? 'light';
  const router = useRouter();

  const highlightColor = useThemeColor({}, 'highlight');
  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mainAccentColor = useThemeColor({}, 'tint');

  const player = useAudioPlayer(ADHAN_REQUIRE);
  useSetupAndroidNotificationChannel();

  useEffect(() => {
    ensureAudioModeOnce();
  }, []);

  const playAdhan = useMemo(
    () => async () => {
      try {
        await ensureAudioModeOnce();
        player.seekTo(0);
        await player.play();
      } catch {}
    },
    [player]
  );

  const checkLocationAndFetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const today = getTodayDate();

    try {
      const locationJson = await AsyncStorage.getItem('@selected_location');
      if (!locationJson) {
        setError('Lütfen bir konum seçin.');
        setLoading(false);
        router.push('/select-location');
        return;
      }

      const loc: LocationData = JSON.parse(locationJson);
      setSelectedLocation(loc);

      const cacheJson = await AsyncStorage.getItem('@cached_prayer_data');
      if (cacheJson) {
        const cached: CachedPrayerData = JSON.parse(cacheJson);
        if (cached.fetchDate === today && cached.locationId === loc.id) {
          setTimes({
            imsak: cached.monthlyTimes[0].fajr,
            gunes: cached.monthlyTimes[0].sun,
            ogle: cached.monthlyTimes[0].dhuhr,
            ikindi: cached.monthlyTimes[0].asr,
            aksam: cached.monthlyTimes[0].maghrib,
            yatsi: cached.monthlyTimes[0].isha,
          });
          setLoading(false);
          return;
        }
      }

      await fetchTimes(loc.id, today);
    } catch {
      setError('Hata oluştu.');
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      checkLocationAndFetch();
    }, [checkLocationAndFetch])
  );

  async function fetchTimes(locationId: string, today: string) {
    try {
      const res = await fetch(
        `https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locationId}`
      );
      const monthly = await res.json();

      const todayData = monthly.find((d: any) => d.date.startsWith(today));
      setTimes({
        imsak: todayData.fajr,
        gunes: todayData.sun,
        ogle: todayData.dhuhr,
        ikindi: todayData.asr,
        aksam: todayData.maghrib,
        yatsi: todayData.isha,
      });

      const cache: CachedPrayerData = {
        locationId,
        fetchDate: today,
        monthlyTimes: monthly,
      };
      await AsyncStorage.setItem('@cached_prayer_data', JSON.stringify(cache));

      // SCHEDULE AFTER FETCH
      scheduleDailyNotifications({
        imsak: todayData.fajr,
        gunes: todayData.sun,
        ogle: todayData.dhuhr,
        ikindi: todayData.asr,
        aksam: todayData.maghrib,
        yatsi: todayData.isha,
      }).catch(() => {});

    } catch {
      setError('Veri alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  async function triggerAdhanTest() {
    try {
      player.seekTo(0);
      await player.play();
    } catch {}
  }

  // --------------------------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <ThemedView style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={mainAccentColor} />
          <ThemedText style={styles.loadingText}>Yükleniyor...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* HEADER */}
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
              <ThemedText style={[styles.locationButtonText, { color: mainAccentColor }]}>
                Konum Değiştir
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Hata */}
          {error && (
            <View style={styles.errorBox}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <TouchableOpacity style={styles.retryButton} onPress={checkLocationAndFetch}>
                <ThemedText style={styles.retryButtonText}>Tekrar dene</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Günlük vakitler burada listelenir */}
          {times && (
            <View style={styles.prayerList}>
              {[ 
                { label: 'İmsak', value: times.imsak },
                { label: 'Güneş', value: times.gunes },
                { label: 'Öğle', value: times.ogle },
                { label: 'İkindi', value: times.ikindi },
                { label: 'Akşam', value: times.aksam },
                { label: 'Yatsı', value: times.yatsi },
              ].map((item) => (
                <View key={item.label} style={[styles.prayerRow, { borderColor }]}>
                  <ThemedText style={styles.prayerName}>{item.label}</ThemedText>
                  <ThemedText style={styles.prayerTime}>{item.value}</ThemedText>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: mainAccentColor }]}
              onPress={triggerAdhanTest}
            >
              <ThemedText style={styles.primaryButtonText}>Ezan Sesini Test Et</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor }]}
              onPress={() => router.push('/settings')}
            >
              <ThemedText style={styles.secondaryButtonText}>Ayarlar</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}


// --------------------------------------------------------------------------------------
// STYLES
// --------------------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 16, fontWeight: '500' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appTitle: { fontSize: 22, fontWeight: '700' },
  locationText: { marginTop: 4, fontSize: 14, opacity: 0.8 },
  locationButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 50, borderWidth: 1 },
  locationButtonText: { fontSize: 13, fontWeight: '500' },
  errorBox: { padding: 12, borderRadius: 12, backgroundColor: '#ffefef', borderColor: '#ffcccc', borderWidth: 1 },
  errorText: { fontSize: 14, color: '#b00020' },
  retryButton: { marginTop: 8, backgroundColor: '#b00020', padding: 8, borderRadius: 12 },
  retryButtonText: { color: 'white', fontSize: 13, fontWeight: '500' },
  prayerList: { gap: 10 },
  prayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  prayerName: { fontSize: 15, fontWeight: '500' },
  prayerTime: { fontSize: 15, fontWeight: '600' },
  actionsRow: { gap: 10 },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
  },
  primaryButtonText: { color: 'white', fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    paddingVertical: 10,
    borderRadius: 50,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '500' },
});
