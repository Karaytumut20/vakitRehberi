// app/(tabs)/index.tsx

import AdmobBanner from '@/components/AdmobBanner';
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import {
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
const ANDROID_CHANNEL_ID = 'prayer_times_adhan_v1';
const ANDROID_SOUND_NAME = 'adhan.wav';

// v3: Gün + hash meta
const SCHEDULED_META_KEY = '@prayer_scheduled_meta_v3';

interface ScheduleMeta {
  hash: string;
  date: string; // YYYY-MM-DD
}

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

// --- YENİ VE DÜZELTİLMİŞ FONKSİYON 1 ---
/**
 * Verilen saat string'ini (örn: "04:30" veya "24:10")
 * DİKKATE ALARAK, temel tarihe (baseDate) uygular.
 */
function timeToDateBase(timeString: string, baseDate: Date): Date {
  let t = timeString;

  if (typeof t !== 'string') {
    console.warn(`timeToDateBase: Geçersiz saat: ${t} -> '00:00' kullanıldı`);
    t = '00:00';
  }

  // "24:10" gibi bir saat gelirse, bunun bir sonraki güne ait 00:10 olduğunu not al
  let isNextDay = false;
  if (t.startsWith('24:')) {
    t = t.replace('24:', '00:');
    isNextDay = true;
  }

  const [h, m] = t.split(':').map(Number);
  
  // Temel tarihi klonla, orijinalini bozma
  const d = new Date(baseDate.getTime());
  d.setHours(h || 0, m || 0, 0, 0);

  // Eğer saat "24:xx" formatındaysa, tarihi bir gün ileri al
  if (isNextDay) {
    d.setDate(d.getDate() + 1);
  }
  
  return d;
}

// --- YENİ VE DÜZELTİLMİŞ FONKSİYON 2 ---
/**
 * Bu fonksiyon, verilen saatin "geçmişte" kalıp kalmadığını kontrol eder.
 * Eğer geçmişte kaldıysa (ve "24:xx" formatında değilse), 24 saat ekler.
 */
function safeTimeToFutureDate(
  timeString: string,
  now: Date = new Date()
): Date {
  // 'now' değişkenini temel tarih olarak timeToDateBase'e yolla
  const candidate = timeToDateBase(timeString, now);

  // Eğer adayın saati '24:' ile başlamıyorsa (yani normal bir vakitse, örn: "04:30")
  // VE 'şimdi'den önceyse (yani geçmişte kalmışsa)
  if (!timeString.startsWith('24:') && candidate.getTime() <= now.getTime()) {
    // 24 saat ekleyerek yarına planla
    return new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }

  // Aksi takdirde, aday zaten doğrudur:
  // 1. "17:30" (gelecekteki bir vakit)
  // 2. "24:10" (timeToDateBase bunu zaten "yarın 00:10" yaptı)
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
 * --- Bildirim Davranışı (Uygulama açıkken de gözüksün) ---
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

/**
 * --- EZAN BİLDİRİMLERİ PLANLAMA (REVİZE) ---
 *
 * 1. Aynı gün ve aynı hash için tekrar planlama YAPMAZ
 * 2. Yeni güne geçildiğinde, hash değiştiğinde veya saatler değiştiğinde
 * önce eski bildirimleri temizler → sonra yenilerini planlar
 * 3. Geçmiş vakitleri ertesi güne kaydırır (ANINDA 4–5 bildirim patlamaz)
 */

async function scheduleDailyNotifications(
  prayerTimes: PrayerTimeData
): Promise<void> {
  // 1) İzin kontrolü
  let { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    existingStatus = status;
  }

  if (existingStatus !== 'granted') {
    console.log('Bildirim izni verilmedi.');
    return;
  }

  // 2) Ayarlar + payload
  const settings = await getMergedSettings();
  const { list, hash } = buildSchedulePayload(prayerTimes, settings);
  const today = getTodayDate();

  // 3) Eski meta'yı oku
  let meta: ScheduleMeta | null = null;
  try {
    const metaJson = await AsyncStorage.getItem(SCHEDULED_META_KEY);
    if (metaJson) {
      meta = JSON.parse(metaJson) as ScheduleMeta;
    }
  } catch (e) {
    console.warn('scheduleDailyNotifications meta parse error:', e);
  }

  // 4) Aynı gün ve aynı hash ise tekrar planlama YAPMA
  if (meta && meta.date === today && meta.hash === hash) {
    console.log(
      'LOG: Bildirimler zaten bugünün vakitlerine göre planlanmış, tekrar kurulmadı.'
    );
    return;
  }

  // 5) Eski planlanmış bildirimleri temizle
  // NOT: Bu kod, 'select-location.tsx' dosyasındaki iptal işlemine ek
  // olarak bir güvencedir. (örn. gün değişimi, ayar değişimi için)
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('LOG: (schedule) Önceki tüm planlanmış bildirimler temizlendi.');

  const now = new Date();

  // 6) Her vakit için planlama
  for (const p of list) {
    // DÜZELTME: 'safeTimeToFutureDate' artık doğru çalışıyor
    const date = safeTimeToFutureDate(p.time, now);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Vakit Geldi',
        body: `${p.name} vakti girdi.`,
        sound: ANDROID_SOUND_NAME,
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

  // 7) Yeni meta'yı kaydet
  const newMeta: ScheduleMeta = { hash, date: today };
  await AsyncStorage.setItem(SCHEDULED_META_KEY, JSON.stringify(newMeta));
  console.log('LOG: Yeni bildirim meta kaydedildi:', newMeta);
}

/**
 * --- Android Bildirim Kanalı ---
 */

function useSetupAndroidNotificationChannel() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    (async () => {
      try {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
          name: 'Namaz Vakitleri',
          importance: Notifications.AndroidImportance.MAX,
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          sound: ANDROID_SOUND_NAME,
        });

        console.log('LOG: Android bildirim kanalı (Adhan) ayarlandı.');
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

  // Aynı times ile tekrar tekrar planlamayı engellemek için
  const lastScheduledTimesJsonRef = useRef<string | null>(null);

  useSetupAndroidNotificationChannel();

  /**
   * Vakitler her gün / konum değiştiğinde bildirim planlama
   */
  useEffect(() => {
    if (!times) return;

    const json = JSON.stringify(times);
    if (json === lastScheduledTimesJsonRef.current) {
      // Aynı vakitler → tekrar planlama yapma
      return;
    }

    scheduleDailyNotifications(times).catch((e) =>
      console.warn('scheduleDailyNotifications error:', e)
    );

    lastScheduledTimesJsonRef.current = json;
  }, [times]);

  
  // DÜZELTME: 'times' bağımlılığını kaldırdık.
  // Bu fonksiyonun 'times' state'ine ihtiyacı yok,
  // sadece 'AsyncStorage'dan okuma yapmalı.
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
          // ÖNEMLİ DÜZELTME: 'times' state'ini kontrol etmeyi bıraktık.
          // Veri taze ve doğruysa, state'i her zaman güncellemeliyiz.
          // Bu, 'processApiData'nın sadece bir kez çağrılmasını sağlar.
          processApiData(cached.monthlyTimes, location.id);
          return;
        }
      }

      await fetchPrayerTimes(location.id, TODAY_DATE);
    } catch (e) {
      console.warn('checkLocationAndFetchTimes error:', e);
      setError('Hafıza okunurken hata oluştu.');
      setLoading(false);
    }
  }, [router]); // 'times' bağımlılığı kaldırıldı

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
        // Bugünün vaktini bulamazsa, dizideki ilk günü kullan (genelde ayın 1'i)
        // Bu, gece yarısı API'den henüz bugünün verisi gelmediyse bile uygulamanın çalışmasını sağlar
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

  // --- YENİ VE DÜZELTİLMİŞ GERİ SAYIM BLOĞU ---
  /**
   * --- Şu anki vakit, sonraki vakit ve geri sayım ---
   */
  useEffect(() => {
    if (!times) return;

    const intervalId = setInterval(() => {
      const now = new Date(); // 'now' burada tanımlanıyor

      // DÜZELTME: 'now' değişkenini timeToDateBase'e iletiyoruz
      const prayerDateTimes: Record<PrayerName, Date> = {
        İmsak: timeToDateBase(times.imsak, now),
        Güneş: timeToDateBase(times.gunes, now),
        Öğle: timeToDateBase(times.ogle, now),
        İkindi: timeToDateBase(times.ikindi, now),
        Akşam: timeToDateBase(times.aksam, now),
        Yatsı: timeToDateBase(times.yatsi, now), // Artık '24:xx' saatleri doğru işlenecek
      };

      // YENİ VE BASİT GERİ SAYIM MANTIĞI:
      
      // Bugünün tüm vakitlerini (Date objeleriyle) al
      const allTimesToday = PRAYER_NAMES_ORDER.map((name) => ({
        name,
        time: prayerDateTimes[name],
      }));

      // Bir sonraki günün İmsak vaktini de hesaba kat
      const tomorrowBase = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const nextImsak = timeToDateBase(times.imsak, tomorrowBase);

      // Bugünün vakitlerini + yarının ilk vaktini birleştir
      const allPrayerEntries = [
        ...allTimesToday,
        {
          name: 'İmsak' as PrayerName,
          time: nextImsak,
        },
      ];

      let nextPrayerEntry: { name: PrayerName; time: Date } | null = null;
      let minPositiveDiff = Infinity;

      // 'now'dan sonraki en yakın vakti bul
      for (const entry of allPrayerEntries) {
        const diff = entry.time.getTime() - now.getTime();

        // Sadece gelecekteki vakitlere bak
        if (diff > 0 && diff < minPositiveDiff) {
          minPositiveDiff = diff;
          nextPrayerEntry = entry;
        }
      }

      // Normalde bu 'if'e girmez ama garanti olsun
      if (!nextPrayerEntry) {
        nextPrayerEntry = { name: 'İmsak', time: nextImsak };
        minPositiveDiff = nextImsak.getTime() - now.getTime();
      }

      // 'next' bulundu. 'current' ise 'next'ten bir öncekidir.
      setNextPrayer(nextPrayerEntry.name);
      setTimeRemaining(formatTimeRemaining(minPositiveDiff));

      const nextIndex = PRAYER_NAMES_ORDER.indexOf(nextPrayerEntry.name);
      let currentIndex: number;

      if (nextIndex === 0) {
        // Sonraki vakit İmsak ise, şu anki vakit Yatsı'dır
        currentIndex = PRAYER_NAMES_ORDER.length - 1; // Yatsı
      } else {
        // Diğer durumlarda bir öncekidir
        currentIndex = nextIndex - 1;
      }
      
      setCurrentPrayer(PRAYER_NAMES_ORDER[currentIndex]);

    }, 1000);

    return () => clearInterval(intervalId);
  }, [times, setCurrentPrayer, setNextPrayer, setTimeRemaining]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <ThemedView style={styles.container}>
        {/* ÜST ADMOB */}
        <View style={styles.bannerTopWrapper}>
          <View style={styles.bannerInner}>
            <AdmobBanner />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
              style={[styles.locationButton, { borderColor: '#e1c564' }]}
              onPress={() => router.push('/select-location')}
            >
              <ThemedText
                style={[styles.locationButtonText, { color: '#e1c564' }]}
              >
                Konum Değiştir
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* HATA MESAJI */}
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

          {/* ŞU ANKİ VAKİT CARD */}
          {times && (
            <View
              style={[
                styles.currentCard,
                {
                  backgroundColor: '#090906',
                  borderColor: '#e1af64ff',
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

          {/* PREMIUM GOLD TABLO */}
          {times && (
            <View style={styles.premiumTable}>
              {[
                { label: 'İmsak', value: times.imsak },
                { label: 'Güneş', value: times.gunes },
                { label: 'Öğle', value: times.ogle },
                { label: 'İkindi', value: times.ikindi },
                { label: 'Akşam', value: times.aksam },
                { label: 'Yatsı', value: times.yatsi },
              ].map((item, index, arr) => {
                const isLast = index === arr.length - 1;
                const isCurrent = item.label === currentPrayer;

                return (
                  <View
                    key={item.label}
                    style={[
                      styles.premiumRow,
                      isLast && styles.premiumRowLast,
                      isCurrent && styles.premiumRowActive,
                    ]}
                  >
                    <ThemedText style={styles.premiumLabel}>
                      {item.label}
                    </ThemedText>
                    <ThemedText style={styles.premiumTime}>
                      {item.value || '--:--'}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* ALT ADMOB AYRACI (BOŞ KUTU) */}
        <View style={styles.bannerBottomWrapper}>
          <View style={styles.bannerInner} />
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
    backgroundColor: '#090906',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 3,
    paddingBottom: 160,
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
    color: '#e1c564',
  } as TextStyle,
  locationText: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.8,
    color: '#e1c564',
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
    color: '#e1af64ff',
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
    color: '#e1af64ff',
  } as TextStyle,
  nextName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e1af64ff',
  } as TextStyle,
  countdownBox: {
    alignItems: 'flex-end',
  },
  countdownLabel: {
    fontSize: 12,
    opacity: 0.7,
    color: '#e1af64ff',
  } as TextStyle,
  countdownValue: {
    marginTop: 2,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    color: '#e1af64ff',
  } as TextStyle,
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    color: '#e1af64ff',
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
  premiumTable: {
    backgroundColor: '#0b0b0a',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e1c56433',
    marginTop: 6,
  },
  premiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e1c56422',
  },
  premiumRowLast: {
    borderBottomWidth: 0,
  },
  premiumRowActive: {
    backgroundColor: 'rgba(225,197,100,0.06)',
  },
  premiumLabel: {
    color: '#e1c564',
    fontSize: 15,
    fontWeight: '500',
  } as TextStyle,
  premiumTime: {
    color: '#e1c564',
    fontSize: 15,
    fontWeight: '600',
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