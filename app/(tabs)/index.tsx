// app/(tabs)/index.tsx

import AdmobBanner from '@/components/AdmobBanner';
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

// -------------------------------------------
// 🔔 Yeni notification sistemi (TEK KULLANILACAK YER)
// -------------------------------------------
import {
  PrayerTimeData,
  schedulePrayerNotificationsForToday
} from '@/lib/notifications';

// --------------------------------------------------
// TYPES
// --------------------------------------------------

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

// Tarih formatlayıcı
function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

// Bir saati, verilen tarihe göre Date objesi yapma
function timeToDateBase(timeString: string, baseDate: Date): Date {
  let t = timeString;

  if (typeof t !== 'string') {
    t = '00:00';
  }

  let isNextDay = false;
  if (t.startsWith('24:')) {
    t = t.replace('24:', '00:');
    isNextDay = true;
  }

  const [h, m] = t.split(':').map(Number);
  const d = new Date(baseDate.getTime());
  d.setHours(h || 0, m || 0, 0, 0);

  if (isNextDay) d.setDate(d.getDate() + 1);

  return d;
}

function formatTimeRemaining(ms: number): string {
  if (ms < 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

// --------------------------------------------------
// MAIN SCREEN
// --------------------------------------------------

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

  // Duplicate schedule önlemek için
  const lastScheduledTimesJsonRef = useRef<string | null>(null);

  // ----------------------------------------------------------------------
  // 🔔 Namaz vakitleri yüklendiğinde bildirimleri PLANLA (TEK NOKTA)
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!times || !selectedLocation) return;

    const json = JSON.stringify(times);
    if (json === lastScheduledTimesJsonRef.current) {
      return; // aynı vakitler tekrar planlanmasın
    }

    schedulePrayerNotificationsForToday(times, selectedLocation.id)
      .catch((e) => console.warn('schedule error:', e));

    lastScheduledTimesJsonRef.current = json;
  }, [times, selectedLocation]);

  // ----------------------------------------------------------------------
  // Konumu & vakitleri yükleme
  // ----------------------------------------------------------------------

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
          processApiData(cached.monthlyTimes);
          return;
        }
      }

      await fetchPrayerTimes(location.id, TODAY_DATE);
    } catch (e) {
      console.warn('checkLocation error:', e);
      setError('Hafıza okunurken hata oluştu.');
      setLoading(false);
    }
  }, [router]);

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
      processApiData(monthly);

      const cache: CachedPrayerData = {
        locationId,
        fetchDate: todayDate,
        monthlyTimes: monthly,
      };

      await AsyncStorage.setItem('@cached_prayer_data', JSON.stringify(cache));
    } catch (e: any) {
      console.warn('fetchPrayerTimes error:', e);
      setError(e?.message ?? 'Vakitler çekilirken hata oluştu.');
      setLoading(false);
    }
  }

  function processApiData(monthlyTimesArray: any[]) {
    try {
      if (!Array.isArray(monthlyTimesArray) || monthlyTimesArray.length === 0) {
        throw new Error('API yanıtı geçersiz.');
      }

      const TODAY_DATE = getTodayDate();

      let todayTimes = monthlyTimesArray.find(
        (d: any) =>
          typeof d.date === 'string' && d.date.startsWith(TODAY_DATE)
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

  // ----------------------------------------------------------------------
  // ⏱ Kalan süre & Mevcut vakit hesaplama (dokunmadım)
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!times) return;

    const intervalId = setInterval(() => {
      const now = new Date();

      const prayerDateTimes: Record<PrayerName, Date> = {
        İmsak: timeToDateBase(times.imsak, now),
        Güneş: timeToDateBase(times.gunes, now),
        Öğle: timeToDateBase(times.ogle, now),
        İkindi: timeToDateBase(times.ikindi, now),
        Akşam: timeToDateBase(times.aksam, now),
        Yatsı: timeToDateBase(times.yatsi, now),
      };

      const allTimesToday = PRAYER_NAMES_ORDER.map((name) => ({
        name,
        time: prayerDateTimes[name],
      }));

      const tomorrowBase = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const nextImsak = timeToDateBase(times.imsak, tomorrowBase);

const allPrayerEntries = [
  ...allTimesToday,
  { name: 'İmsak' as PrayerName, time: nextImsak }
];

      let nextPrayerEntry: { name: PrayerName; time: Date } | null = null;
      let minPositiveDiff = Infinity;

      for (const entry of allPrayerEntries) {
        const diff = entry.time.getTime() - now.getTime();
        if (diff > 0 && diff < minPositiveDiff) {
          minPositiveDiff = diff;
          nextPrayerEntry = entry;
        }
      }

      if (!nextPrayerEntry) {
        nextPrayerEntry = { name: 'İmsak', time: nextImsak };
        minPositiveDiff = nextImsak.getTime() - now.getTime();
      }

      setNextPrayer(nextPrayerEntry.name);
      setTimeRemaining(formatTimeRemaining(minPositiveDiff));

      const nextIndex = PRAYER_NAMES_ORDER.indexOf(nextPrayerEntry.name);
      const currentIndex =
        nextIndex === 0 ? PRAYER_NAMES_ORDER.length - 1 : nextIndex - 1;

      setCurrentPrayer(PRAYER_NAMES_ORDER[currentIndex]);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [times]);

  // ---------------------------------------------------------
  // UI (dokunulmadı)
  // ---------------------------------------------------------

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

          {/* ERROR */}
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

          {/* ŞU ANKİ VAKİT */}
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

        {/* ALT ADMOB */}
        <View style={styles.bannerBottomWrapper}>
          <View style={styles.bannerInner} />
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// STYLES (dokunulmadı)
// ---------------------------------------------------------

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
