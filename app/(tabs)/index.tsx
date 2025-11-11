// app/(tabs)/index.tsx

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** --- expo-audio (yeni API) --- */
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio'; // why: expo-av yerine expo-audio API

interface PrayerTimeData { imsak: string; gunes: string; ogle: string; ikindi: string; aksam: string; yatsi: string; }
interface LocationData { id: string; name: string; }
interface CachedPrayerData { locationId: string; fetchDate: string; monthlyTimes: any[]; }
type PrayerName = 'İmsak' | 'Güneş' | 'Öğle' | 'İkindi' | 'Akşam' | 'Yatsı';
const PRAYER_NAMES_ORDER: PrayerName[] = ['İmsak', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı'];

export interface PrayerSettings {
  imsak: { adhan: boolean };
  gunes: { adhan: boolean };
  ogle: { adhan: boolean };
  ikindi: { adhan: boolean };
  aksam: { adhan: boolean };
  yatsi: { adhan: boolean };
}
export const DEFAULT_SETTINGS: PrayerSettings = {
  imsak: { adhan: true },
  gunes: { adhan: false },
  ogle: { adhan: true },
  ikindi: { adhan: true },
  aksam: { adhan: true },
  yatsi: { adhan: true },
};
export const SETTINGS_KEY = '@prayer_settings';

const ANDROID_CHANNEL_ID = 'prayer_times_v3';
const SOUND_NAME = 'adhan.mp3';
const ADHAN_REQUIRE = require('../../assets/sounds/adhan.mp3');

const SCHEDULED_HASH_KEY = '@prayer_scheduled_hash';
const SAFE_WINDOW_MS = 30_000;

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToDateBase(timeString: string): Date {
  let t = timeString;
  if (typeof t !== 'string') {
    console.warn(`timeToDateBase: Geçersiz saat: ${t} -> '00:00'`);
    t = '00:00';
  }
  if (t.startsWith('24:')) t = t.replace('24:', '00:');
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function safeTimeToFutureDate(timeString: string, now = new Date()): Date {
  const candidate = timeToDateBase(timeString);
  const diff = candidate.getTime() - now.getTime();
  if (diff > SAFE_WINDOW_MS) return candidate;
  return new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
}

function formatTimeRemaining(ms: number) {
  if (ms < 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [h, m, ss].map(v => String(v).padStart(2, '0')).join(':');
}

/** Bildirim davranışı */
function setForegroundAlerts(enabled: boolean) {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const behavior: any = {
        shouldShowAlert: enabled,
        shouldPlaySound: enabled,
        shouldSetBadge: false,
      };
      if (Platform.OS === 'ios') behavior.shouldShowBanner = enabled;
      if (Platform.OS === 'android') behavior.priority = Notifications.AndroidNotificationPriority.HIGH;
      return behavior as Notifications.NotificationBehavior;
    },
  });
}
setForegroundAlerts(false);

async function getMergedSettings(): Promise<PrayerSettings> {
  try {
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const s = JSON.parse(saved);
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      imsak: { ...DEFAULT_SETTINGS.imsak, ...s.imsak },
      gunes: { ...DEFAULT_SETTINGS.gunes, ...s.gunes },
      ogle: { ...DEFAULT_SETTINGS.ogle, ...s.ogle },
      ikindi: { ...DEFAULT_SETTINGS.ikindi, ...s.ikindi },
      aksam: { ...DEFAULT_SETTINGS.aksam, ...s.aksam },
      yatsi: { ...DEFAULT_SETTINGS.yatsi, ...s.yatsi },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function buildSchedulePayload(times: PrayerTimeData, settings: PrayerSettings) {
  const list = [
    { key: 'imsak', name: 'İmsak', time: times.imsak, enabled: settings.imsak.adhan },
    { key: 'ogle', name: 'Öğle', time: times.ogle, enabled: settings.ogle.adhan },
    { key: 'ikindi', name: 'İkindi', time: times.ikindi, enabled: settings.ikindi.adhan },
    { key: 'aksam', name: 'Akşam', time: times.aksam, enabled: settings.aksam.adhan },
    { key: 'yatsi', name: 'Yatsı', time: times.yatsi, enabled: settings.yatsi.adhan },
  ].filter(x => x.enabled);
  const normalized = list.map(x => ({ k: x.key, t: x.time })).sort((a, b) => a.k.localeCompare(b.k));
  const hash = JSON.stringify(normalized);
  return { list, hash };
}

/** Bildirim fallback */
async function scheduleDailyNotifications(prayerTimes: PrayerTimeData, withSound = true) {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Bildirim İzni', 'Namaz vakitleri için lütfen bildirim izni verin.');
      return;
    }
  }

  const settings = await getMergedSettings();
  const { list, hash } = buildSchedulePayload(prayerTimes, settings);
  const lastHash = await AsyncStorage.getItem(SCHEDULED_HASH_KEY);
  if (lastHash === hash) {
    console.log('LOG: Kurulu bildirimler değişmedi.');
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  for (const p of list) {
    const date = safeTimeToFutureDate(p.time, now);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔔 ${p.name} Vakti!`,
        body: `${p.name} vakti girdi.`,
        sound: withSound ? SOUND_NAME : undefined,
      },
      trigger: {
        date,
        ...(Platform.OS === 'android' ? ({ channelId: ANDROID_CHANNEL_ID } as any) : {}),
      },
    });
    console.log(`LOG: Notification ${p.name} -> ${date.toLocaleString('tr-TR')}`);
  }
  await AsyncStorage.setItem(SCHEDULED_HASH_KEY, hash);
}

/** --- Ön planda gerçek ezan (expo-audio) --- */
let audioModeConfigured = false;
async function ensureAudioModeOnce() {
  if (audioModeConfigured) return;
  audioModeConfigured = true;
  // why: yeni API string tabanlı; iOS/Android tek seçenek seti
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionModeAndroid: 'duckOthers',
    interruptionMode: 'mixWithOthers',
  });
}

export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimeData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const router = useRouter();

  const [currentPrayer, setCurrentPrayer] = useState<PrayerName | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerName | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--:--');

  const theme = useColorScheme() ?? 'light';
  const highlightColor = useThemeColor({}, 'highlight');
  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mainAccentColor = useThemeColor({}, 'tint');

  const lastScheduledTimesJsonRef = useRef<string | null>(null);

  /** ✅ expo-audio player (hook yaşam döngüsünü yönetir) */
  const adhanPlayer = useAudioPlayer(ADHAN_REQUIRE);

  useEffect(() => {
    (async () => {
      try {
        await ensureAudioModeOnce();
      } catch (err) {
        console.warn('Audio init error', err);
      }
    })();
  }, []);

  const playAdhan = useMemo(() => {
    return async () => {
      try {
        await ensureAudioModeOnce();
        adhanPlayer.seekTo(0);
        await adhanPlayer.play();
      } catch (e) {
        console.warn('Ezan çalma hatası', e);
      }
    };
  }, [adhanPlayer]);

  // Ön plan timers
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!times) return;
    (async () => {
      const settings = await getMergedSettings();
      const { list } = buildSchedulePayload(times, settings);

      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];

      const now = new Date();
      for (const p of list) {
        const date = safeTimeToFutureDate(p.time, now);
        const ms = date.getTime() - now.getTime();
        const id = setTimeout(() => {
          // why: ön planda gerçek ezanı çal
          playAdhan();
        }, ms);
        timersRef.current.push(id);
        console.log(`LOG: Foreground timer ${p.name} -> ${date.toLocaleString('tr-TR')} (+${Math.round(ms / 1000)}s)`);
      }
    })();
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
    };
  }, [times, playAdhan]);

  // Bildirim fallback
  useEffect(() => {
    if (!times) return;
    const json = JSON.stringify(times);
    if (json !== lastScheduledTimesJsonRef.current) {
      scheduleDailyNotifications(times, /* withSound */ true).catch(() => {});
      lastScheduledTimesJsonRef.current = json;
    }
  }, [times]);

  useFocusEffect(React.useCallback(() => { checkLocationAndFetchTimes(); }, []));

  // Geri sayım
  useEffect(() => {
    if (!times) return;
    const i = setInterval(() => {
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
        ...PRAYER_NAMES_ORDER.map(name => ({ name, time: prayerDateTimes[name], isNextDay: false })),
        { name: 'İmsak' as PrayerName, time: new Date(prayerDateTimes['İmsak'].getTime() + 24 * 60 * 60 * 1000), isNextDay: true },
      ];
      for (const { name, time, isNextDay } of all) {
        const diff = time.getTime() - now.getTime();
        if (diff <= 0 && !isNextDay) current = name;
        if (diff > 0 && diff < minDiff) { minDiff = diff; next = name; }
      }
      if (next === null) {
        current = 'Yatsı';
        next = 'İmsak';
        minDiff = all[6].time.getTime() - now.getTime();
      }
      if (current === null && next === 'İmsak' && minDiff > 12 * 60 * 60 * 1000) current = 'Yatsı';
      if (current === null) current = 'Yatsı';
      setCurrentPrayer(current);
      setNextPrayer(next);
      setTimeRemaining(formatTimeRemaining(minDiff));
    }, 1000);
    return () => clearInterval(i);
  }, [times]);

  async function checkLocationAndFetchTimes() {
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
          if (!times) processApiData(cached.monthlyTimes, location.id);
          else setLoading(false);
          return;
        }
      }
      await fetchPrayerTimes(location.id, TODAY_DATE);
    } catch {
      setError('Hafıza okunurken hata oluştu.');
      setLoading(false);
    }
  }

  async function fetchPrayerTimes(locationId: string, todayDate: string) {
    try {
      const res = await fetch(`https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locationId}`);
      if (!res.ok) throw new Error(`Vakitler alınamadı (HTTP ${res.status}).`);
      const monthly = await res.json();
      processApiData(monthly, locationId);
      const cache: CachedPrayerData = { locationId, fetchDate: todayDate, monthlyTimes: monthly };
      await AsyncStorage.setItem('@cached_prayer_data', JSON.stringify(cache));
    } catch (e: any) {
      setError(e?.message ?? 'Vakitler çekilirken hata.');
      setLoading(false);
    }
  }

  function processApiData(monthlyTimesArray: any[], _locationId: string) {
    try {
      if (!Array.isArray(monthlyTimesArray) || monthlyTimesArray.length === 0) throw new Error('API yanıtı geçersiz.');
      const TODAY_DATE = getTodayDate();

      let todayTimes = monthlyTimesArray.find(
        (d: any) => typeof d.date === 'string' && d.date.startsWith(TODAY_DATE)
      );
      if (!todayTimes) todayTimes = monthlyTimesArray[0];

      if (todayTimes) {
        setTimes({
          imsak: todayTimes.fajr,
          gunes: todayTimes.sun,
          ogle: todayTimes.dhuhr,
          ikindi: todayTimes.asr,
          aksam: todayTimes.maghrib,
          yatsi: todayTimes.isha,
        });
      } else setError('Veri bulundu ancak işlenemedi.');
    } catch (e: any) {
      setError(e?.message ?? 'Veri işlenirken hata.');
    } finally {
      setLoading(false);
    }
  }

  async function triggerAdhanTest(setTestingFn: (v: boolean) => void) {
    try {
      setTestingFn(true);
      await playAdhan();
    } catch (e) {
      console.error('Test çalma hatası', e);
    } finally {
      setTestingFn(false);
    }
  }

  return loading ? (
    <ThemedView style={styles.center}>
      <ActivityIndicator size="large" color={mainAccentColor} />
      <ThemedText style={styles.loadingText}>Yükleniyor...</ThemedText>
    </ThemedView>
  ) : error && !times ? (
    <ThemedView style={styles.center}>
      <ThemedText style={styles.errorText} type="subtitle">Hata Oluştu!</ThemedText>
      <ThemedText style={styles.errorText}>{error}</ThemedText>
      <TouchableOpacity style={[styles.button, { backgroundColor: mainAccentColor }]} onPress={() => router.push('/select-location')}>
        <ThemedText style={styles.buttonText}>Konum Seç</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  ) : (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <ThemedText type="title" style={styles.title}>Vakit Rehberi</ThemedText>
          {selectedLocation && <ThemedText style={styles.location}>{selectedLocation.name}</ThemedText>}
        </View>

        <ThemedView style={[styles.countdownContainer, { backgroundColor: cardBackgroundColor, borderColor }]}>
          {nextPrayer ? (
            <>
              <ThemedText style={styles.countdownText} type="subtitle">{nextPrayer} Vaktine Kalan Süre</ThemedText>
              <ThemedText type="display" style={{ color: highlightColor, marginTop: 5 }}>{timeRemaining}</ThemedText>
              {currentPrayer && (<ThemedText style={styles.currentPrayerText}>Şu anki Vakit: <ThemedText style={{ fontWeight: 'bold' as const }}>{currentPrayer}</ThemedText></ThemedText>)}
            </>
          ) : (<ActivityIndicator color={mainAccentColor} />)}
        </ThemedView>

        {times ? (
          <View style={styles.timesList}>
            <TimeRow label="İmsak" time={times.imsak} isActive={currentPrayer === 'İmsak'} isNext={nextPrayer === 'İmsak'} />
            <TimeRow label="Güneş" time={times.gunes} isActive={currentPrayer === 'Güneş'} isNext={nextPrayer === 'Güneş'} />
            <TimeRow label="Öğle" time={times.ogle} isActive={currentPrayer === 'Öğle'} isNext={nextPrayer === 'Öğle'} />
            <TimeRow label="İkindi" time={times.ikindi} isActive={currentPrayer === 'İkindi'} isNext={nextPrayer === 'İkindi'} />
            <TimeRow label="Akşam" time={times.aksam} isActive={currentPrayer === 'Akşam'} isNext={nextPrayer === 'Akşam'} />
            <TimeRow label="Yatsı" time={times.yatsi} isActive={currentPrayer === 'Yatsı'} isNext={nextPrayer === 'Yatsı'} />
          </View>
        ) : (<ThemedText style={styles.emptyText}>Bugüne ait vakitler yüklenemedi.</ThemedText>)}

        <TouchableOpacity
          disabled={testing}
          style={[styles.button, { backgroundColor: testing ? '#9e9e9e' : mainAccentColor }]}
          onPress={() => triggerAdhanTest(setTesting)}
        >
          <ThemedText style={styles.buttonText}>{testing ? 'Çalıyor…' : 'Ezanı Test Et'}</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { backgroundColor: mainAccentColor }]} onPress={() => router.push('/select-location')}>
          <ThemedText style={styles.buttonText}>Konum Değiştir</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const TimeRow = ({ label, time, isActive, isNext }: { label: PrayerName; time: string; isActive: boolean; isNext: boolean }) => {
  const textColor = useThemeColor({}, 'text');
  const accentColor = useThemeColor({}, 'tint');
  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const containerStyle = { backgroundColor: isNext ? accentColor : cardBackgroundColor, borderColor: isNext ? accentColor : borderColor };
  const textStyle: TextStyle = { color: isNext ? '#FFFFFF' : textColor, fontWeight: isNext ? 'bold' as const : '400' as const };
  const timeTextStyle: TextStyle = { color: isNext ? '#FFFFFF' : accentColor, fontWeight: 'bold' as const };
  return (
    <ThemedView style={[styles.timeRowContainer, containerStyle]}>
      <ThemedText style={[styles.timeRowLabel, textStyle]}>{label}</ThemedText>
      <ThemedText style={[styles.timeRowTime, timeTextStyle]}>{time}</ThemedText>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingTop: 50, paddingBottom: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10 },
  headerContainer: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  title: { fontSize: 30 },
  location: { fontSize: 18, opacity: 0.7, marginTop: 4, textAlign: 'center' },
  countdownContainer: { marginHorizontal: 20, alignItems: 'center', padding: 25, borderRadius: 15, marginBottom: 25, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  countdownText: { fontSize: 18, fontWeight: '600', opacity: 0.8 },
  currentPrayerText: { marginTop: 10, fontSize: 16, opacity: 0.7 },
  timesList: { marginHorizontal: 20, gap: 10 },
  timeRowContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1 },
  timeRowLabel: { fontSize: 18 },
  timeRowTime: { fontSize: 18 },
  errorText: { color: '#FFC107', textAlign: 'center', padding: 10, marginBottom: 10 },
  button: { marginTop: 15, marginHorizontal: 20, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', padding: 20, fontSize: 16, opacity: 0.6 },
});
