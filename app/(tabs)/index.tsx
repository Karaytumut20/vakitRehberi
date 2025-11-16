// app/(tabs)/index.tsx

// app/(tabs)/index.tsx

import AdmobBanner from '@/components/AdmobBanner';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CachedPrayerData,
  LocationData,
  PrayerName,
  PRAYER_NAMES_ORDER,
  PrayerTimeData,
} from '@/constants/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  scheduleDailyNotifications,
  setForegroundAlerts,
  setupAndroidNotificationChannel,
} from '@/lib/notifications';

// Uygulama açıkken bildirim gelmesi için true yapıldı
setForegroundAlerts(true);

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

function formatTimeRemaining(ms: number): string {
  if (ms < 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * --- Android Bildirim Kanalı ---
 */
function useSetupAndroidNotificationChannel() {
  useEffect(() => {
    setupAndroidNotificationChannel();
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

  /**
   * --- Şu anki vakit, sonraki vakit ve geri sayım ---
   */
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
