// app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

// ---- Sabit kanal ID'leri (kanal sesini değiştirirsen yeni ID aç)
const CHANNELS = {
  ADHAN: 'prayer_times_v2',
  REMINDER: 'prayer_reminders_v2',
} as const;

// ---- Tipler
interface PrayerTimeData {
  imsak: string;
  gunes: string;
  ogle: string;
  ikindi: string;
  aksam: string;
  yatsi: string;
}
interface LocationData { id: string; name: string }
interface CachedPrayerData { locationId: string; fetchDate: string; monthlyTimes: any[] }
type PrayerName = 'İmsak' | 'Güneş' | 'Öğle' | 'İkindi' | 'Akşam' | 'Yatsı';
const PRAYER_NAMES_ORDER: PrayerName[] = ['İmsak', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı'];

export interface PrayerSettings {
  imsak: { adhan: boolean; reminder: boolean };
  gunes: { adhan: boolean; reminder: boolean };
  ogle: { adhan: boolean; reminder: boolean };
  ikindi: { adhan: boolean; reminder: boolean };
  aksam: { adhan: boolean; reminder: boolean };
  yatsi: { adhan: boolean; reminder: boolean };
}
export const DEFAULT_SETTINGS: PrayerSettings = {
  imsak: { adhan: true, reminder: true },
  gunes: { adhan: false, reminder: false },
  ogle: { adhan: true, reminder: true },
  ikindi: { adhan: true, reminder: true },
  aksam: { adhan: true, reminder: true },
  yatsi: { adhan: true, reminder: true },
};
export const SETTINGS_KEY = '@prayer_settings';

// ---- Utils
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function timeToDate(timeString: string): Date {
  if (timeString.startsWith('24:')) timeString = timeString.replace('24:', '00:');
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}
function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds < 0) return '00:00:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

// ---- Bildirim handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ---- Android kanal + izin kurulumu (önce kanal, sonra izin) — kritik
async function ensureNotificationSetup() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNELS.ADHAN, {
      name: 'Namaz Vakitleri',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'adhan.wav', // asset adı (app.json plugin ile paketlenmeli)
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.REMINDER, {
      name: 'Namaz Hatırlatıcıları',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 200, 200],
      sound: 'default',
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Bildirim İzni', 'Namaz vakitlerinde uyarılmak için lütfen bildirim izni verin.');
  }
}

// ---- ANINDA SES TESTİ (Expo Go’da da çalışır)
async function testLocalAdhan(setBusy?: (b: boolean) => void) {
  try {
    setBusy?.(true);
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/adhan.wav'), // dosya yolu: app/assets/adhan.wav olacak şekilde ayarla
      { shouldPlay: true, volume: 1.0 }
    );
    // Neden: bellek sızıntısı olmasın
    sound.setOnPlaybackStatusUpdate(async (status: any) => {
      if (status.didJustFinish || status.isLoaded === false) {
        await sound.unloadAsync();
        setBusy?.(false);
      }
    });
  } catch (e) {
    setBusy?.(false);
    Alert.alert('Ses Hatası', 'Ezan ses dosyası yüklenemedi. Dosya yolu ve uzantıyı kontrol edin.');
    console.error(e);
  }
}

// ---- 5 sn sonra EZAN SESLİ bildirim testi
async function testAdhanNotification() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: 'adhan_TEST_5S',
      content: {
        title: '🔔 TEST EZAN BİLDİRİMİ!',
        body: '5 sn sonra çaldıysa ses OK.',
        sound: 'adhan.wav', // iOS & Android < 8
      },
      trigger: {
        seconds: 5,
        channelId: CHANNELS.ADHAN, // Android 8+
      },
    });
    Alert.alert('Test Kuruldu', '5 saniye içinde ezan sesi duymalısınız.');
  } catch (e) {
    Alert.alert('Bildirim Hatası', 'Test bildirimi kurulamadı.');
    console.error(e);
  }
}

// ---- Asıl planlayıcı (mevcut kodunuzun revizesi)
async function scheduleDailyNotifications(prayerTimes: PrayerTimeData) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Kısa test: 10 sn sonra
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `adhan_TEST_10S`,
      content: {
        title: '🔔 TEST EZAN BİLDİRİMİ!',
        body: '10 sn sonra çaldıysa kanal/ses OK.',
        sound: 'adhan.wav',
      },
      trigger: { seconds: 10, channelId: CHANNELS.ADHAN },
    });
  } catch (e) {
    console.error('Test bildirimi kurulurken hata:', e);
  }

  let settings: PrayerSettings = DEFAULT_SETTINGS;
  try {
    const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
    if (settingsJson) settings = JSON.parse(settingsJson);
  } catch (e) {
    console.error('Bildirim ayarları okunamadı, varsayılanlar kullanılıyor.', e);
  }

  const notificationsToSchedule = [
    { id: 'imsak', name: 'İmsak', time: prayerTimes.imsak },
    { id: 'ogle', name: 'Öğle', time: prayerTimes.ogle },
    { id: 'ikindi', name: 'İkindi', time: prayerTimes.ikindi },
    { id: 'aksam', name: 'Akşam', time: prayerTimes.aksam },
    { id: 'yatsi', name: 'Yatsı', time: prayerTimes.yatsi },
  ];

  const now = new Date();

  for (const prayer of notificationsToSchedule) {
    const prayerSetting = (settings as any)[prayer.id] as { adhan: boolean; reminder: boolean } | undefined;
    if (!prayerSetting) continue;

    const prayerDate = timeToDate(prayer.time);
    const reminderDate = new Date(prayerDate.getTime() - 15 * 60 * 1000);

    if (prayerSetting.reminder && reminderDate.getTime() > now.getTime()) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `reminder_${prayer.id}`,
          content: {
            title: '⏰ Vakit Yaklaşıyor!',
            body: `${prayer.name} vaktine 15 dakika kaldı.`,
            sound: 'default',
          },
          trigger: { date: reminderDate, channelId: CHANNELS.REMINDER },
        });
      } catch (e) {
        console.error(`${prayer.name} hatırlatıcısı kurulurken hata:`, e);
      }
    }

    if (prayerSetting.adhan && prayerDate.getTime() > now.getTime()) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `adhan_${prayer.id}`,
          content: {
            title: `🔔 ${prayer.name} Vakti!`,
            body: `${prayer.name} namazı vakti girdi.`,
            sound: 'adhan.wav',
          },
          trigger: { date: prayerDate, channelId: CHANNELS.ADHAN },
        });
      } catch (e) {
        console.error(`${prayer.name} ezan bildirimi kurulurken hata:`, e);
      }
    }
  }
}

export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimeData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const router = useRouter();

  const [currentPrayer, setCurrentPrayer] = useState<PrayerName | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerName | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--:--');

  const theme = useColorScheme() ?? 'light';
  const highlightColor = useThemeColor({}, 'highlight');
  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mainAccentColor = useThemeColor({}, 'tint');

  useFocusEffect(
    React.useCallback(() => {
      ensureNotificationSetup().catch(console.error);
      checkLocationAndFetchTimes();
    }, [])
  );

  useEffect(() => { if (times) scheduleDailyNotifications(times).catch(console.error); }, [times]);

  useEffect(() => {
    if (!times) return;
    const interval = setInterval(() => {
      const now = new Date();
      const prayerDateTimes: Record<PrayerName, Date> = {
        'İmsak': timeToDate(times.imsak),
        'Güneş': timeToDate(times.gunes),
        'Öğle': timeToDate(times.ogle),
        'İkindi': timeToDate(times.ikindi),
        'Akşam': timeToDate(times.aksam),
        'Yatsı': timeToDate(times.yatsi),
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
    return () => clearInterval(interval);
  }, [times]);

  async function checkLocationAndFetchTimes() {
    setLoading(true);
    setTimes(null);
    setError(null);
    const TODAY_DATE = getTodayDate();
    try {
      const locationJson = await AsyncStorage.getItem('@selected_location');
      if (locationJson == null) {
        setError('Lütfen bir konum seçin.');
        setLoading(false);
        router.push('/select-location');
        return;
      }
      const location: LocationData = JSON.parse(locationJson);
      setSelectedLocation(location);
      await fetchPrayerTimes(location.id, TODAY_DATE);
    } catch {
      setError('Hafıza okunurken hata oluştu.');
      setLoading(false);
    }
  }

  async function fetchPrayerTimes(locationId: string, todayDate: string) {
    try {
      const response = await fetch(`https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locationId}`);
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vakitler alınamadı (HTTP ${response.status}). Detay: ${errorBody.substring(0, 50)}...`);
      }
      const monthlyTimesArray = await response.json();
      processApiData(monthlyTimesArray, locationId);
      const dataToCache: CachedPrayerData = { locationId, fetchDate: todayDate, monthlyTimes: monthlyTimesArray };
      await AsyncStorage.setItem('@cached_prayer_data', JSON.stringify(dataToCache));
    } catch (e: any) {
      setError(e?.message ?? 'Vakitler çekilirken bilinmeyen bir hata oluştu.');
      setLoading(false);
    }
  }

  function processApiData(monthlyTimesArray: any[], locationId: string) {
    try {
      if (!Array.isArray(monthlyTimesArray) || monthlyTimesArray.length === 0) {
        throw new Error('API yanıtı geçersiz. Beklenen format alınamadı.');
      }
      const TODAY_DATE = getTodayDate();
      let todayTimes = monthlyTimesArray.find((day: any) => day.date && day.date.startsWith(TODAY_DATE));
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
      } else {
        setError('Veri bulundu ancak işlenemedi.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Veri işlenirken bilinmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={mainAccentColor} />
        <ThemedText style={styles.loadingText}>Yükleniyor...</ThemedText>
      </ThemedView>
    );
  }

  if (error && !times) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.errorText} type="subtitle">Hata Oluştu!</ThemedText>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity style={[styles.button, { backgroundColor: mainAccentColor }]} onPress={() => router.push('/select-location')}>
          <ThemedText style={styles.buttonText}>Konum Seç</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <ThemedText type="title" style={styles.title}>Vakit Rehberi</ThemedText>
          {selectedLocation && <ThemedText style={styles.location}>{selectedLocation.name}</ThemedText>}
        </View>

        {/* COUNTDOWN */}
        <ThemedView style={[styles.countdownContainer, { backgroundColor: cardBackgroundColor, borderColor }]}>
          {nextPrayer ? (
            <>
              <ThemedText style={styles.countdownText} type="subtitle">
                {nextPrayer} Vaktine Kalan Süre
              </ThemedText>
              <ThemedText type="display" style={{ color: highlightColor, marginTop: 5 }}>
                {timeRemaining}
              </ThemedText>
              {currentPrayer && (
                <ThemedText style={styles.currentPrayerText}>
                  Şu anki Vakit: <ThemedText style={{ fontWeight: 'bold' as const }}>{currentPrayer}</ThemedText>
                </ThemedText>
              )}
            </>
          ) : (
            <ActivityIndicator color={mainAccentColor} />
          )}
        </ThemedView>

        {/* TEST PANELİ */}
        <ThemedView style={[styles.testCard, { borderColor }]}>
          <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Test Paneli</ThemedText>
          <TouchableOpacity
            disabled={playing}
            style={[styles.button, { backgroundColor: playing ? '#888' : mainAccentColor }]}
            onPress={() => testLocalAdhan(setPlaying)}
          >
            <ThemedText style={styles.buttonText}>{playing ? 'Çalıyor...' : 'Ezan Sesini Çal (Anında)'}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: mainAccentColor }]}
            onPress={testAdhanNotification}
          >
            <ThemedText style={styles.buttonText}>5 sn Sonra Bildirim Testi (Ezan)</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* VAKİTLER */}
        {times ? (
          <View style={styles.timesList}>
            <TimeRow label="İmsak" time={times.imsak} isActive={currentPrayer === 'İmsak'} isNext={nextPrayer === 'İmsak'} />
            <TimeRow label="Güneş" time={times.gunes} isActive={currentPrayer === 'Güneş'} isNext={nextPrayer === 'Güneş'} />
            <TimeRow label="Öğle" time={times.ogle} isActive={currentPrayer === 'Öğle'} isNext={nextPrayer === 'Öğle'} />
            <TimeRow label="İkindi" time={times.ikindi} isActive={currentPrayer === 'İkindi'} isNext={nextPrayer === 'İkindi'} />
            <TimeRow label="Akşam" time={times.aksam} isActive={currentPrayer === 'Akşam'} isNext={nextPrayer === 'Akşam'} />
            <TimeRow label="Yatsı" time={times.yatsi} isActive={currentPrayer === 'Yatsı'} isNext={nextPrayer === 'Yatsı'} />
          </View>
        ) : (
          <ThemedText style={styles.emptyText}>Bugüne ait vakitler yüklenemedi.</ThemedText>
        )}

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
  countdownContainer: {
    marginHorizontal: 20, alignItems: 'center', padding: 25, borderRadius: 15, marginBottom: 25,
    borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1,
    shadowRadius: 10, elevation: 5,
  },
  countdownText: { fontSize: 18, fontWeight: '600', opacity: 0.8 },
  currentPrayerText: { marginTop: 10, fontSize: 16, opacity: 0.7 },
  timesList: { marginHorizontal: 20, gap: 10 },
  timeRowContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1 },
  timeRowLabel: { fontSize: 18 },
  timeRowTime: { fontSize: 18 },
  errorText: { color: '#FFC107', textAlign: 'center', padding: 10, marginBottom: 10 },
  button: { marginTop: 14, marginHorizontal: 20, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', padding: 20, fontSize: 16, opacity: 0.6 },
  testCard: { marginHorizontal: 20, marginBottom: 20, padding: 16, borderRadius: 12, borderWidth: 1 },
});
