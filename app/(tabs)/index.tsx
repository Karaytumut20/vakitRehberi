import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetchAladhanTimes } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDailyFixedContent } from '@/constants/islamicContent';
import {
  MonthlyPrayerDay,
  PrayerTimeData,
  schedulePrayerNotificationsFor15Days,
} from '@/lib/notifications';

// --- TYPES ---
interface LocationData {
  id: string;
  name: string;
}

interface CachedPrayerData {
  locationId: string;
  fetchDate: string;
  monthlyTimes: MonthlyPrayerDay[];
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

// --- HELPER FUNCTIONS ---
function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToDateBase(timeString: string, baseDate: Date): Date {
  let t = timeString;
  if (typeof t !== 'string') t = '00:00';

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

// --- MAIN COMPONENT ---
export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimeData | null>(null);
  const [monthlyTimes, setMonthlyTimes] = useState<MonthlyPrayerDay[] | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPrayer, setCurrentPrayer] = useState<PrayerName | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerName | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('—:—:—');

  const [dailyInfo, setDailyInfo] = useState<{
    verse: { text: string; source: string };
    hadith: { text: string; source: string };
    dua: { text: string; source: string };
  } | null>(null);

  const theme = useColorScheme() ?? 'light';
  const router = useRouter();
  const highlightColor = useThemeColor({}, 'highlight');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setDailyInfo(getDailyFixedContent());
  }, []);

  useEffect(() => {
    if (!monthlyTimes || !selectedLocation) return;
    schedulePrayerNotificationsFor15Days(monthlyTimes, selectedLocation.id).catch(
      (e) => console.warn('15-day schedule error:', e)
    );
  }, [monthlyTimes, selectedLocation]);

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

      if (!location.id.includes(',')) {
        await AsyncStorage.removeItem('@selected_location');
        await AsyncStorage.removeItem('@cached_prayer_data');
        router.push('/select-location');
        return;
      }

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

  async function fetchPrayerTimes(locationId: string, todayDate: string): Promise<void> {
    try {
      const [lat, lon] = locationId.split(',');
      const monthly = await fetchAladhanTimes(lat, lon);
      processApiData(monthly);

      const cache: CachedPrayerData = {
        locationId,
        fetchDate: todayDate,
        monthlyTimes: monthly,
      };
      await AsyncStorage.setItem('@cached_prayer_data', JSON.stringify(cache));
    } catch (e: any) {
      setError(e?.message ?? 'Vakitler çekilirken hata oluştu.');
      setLoading(false);
    }
  }

  function processApiData(monthlyTimesArray: MonthlyPrayerDay[]) {
    try {
      if (!Array.isArray(monthlyTimesArray) || monthlyTimesArray.length === 0) {
        throw new Error('API yanıtı geçersiz.');
      }
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
        if (todayTimes.hijriDate) {
          setHijriDate(todayTimes.hijriDate);
        }
        setMonthlyTimes(monthlyTimesArray);
      } else {
        setError('Veri bulundu ancak işlenemedi.');
      }
    } catch (e: any) {
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
        { name: 'İmsak' as PrayerName, time: nextImsak },
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

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top + 20, 40) }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <ThemedText style={styles.appTitle}>Vakit Rehberi</ThemedText>
            {hijriDate && (
              <ThemedText style={styles.hijriText}>{hijriDate}</ThemedText>
            )}
            {selectedLocation && (
              <ThemedText style={styles.locationText}>
                <MaterialIcons name="location-pin" size={14} color="#e1c564" /> {selectedLocation.name}
              </ThemedText>
            )}
          </View>

          <TouchableOpacity
            style={styles.locationButton}
            onPress={() => router.push('/select-location')}
          >
            <ThemedText style={styles.locationButtonText}>Konum Değiştir</ThemedText>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <TouchableOpacity style={styles.retryButton} onPress={checkLocationAndFetchTimes}>
              <ThemedText style={styles.retryButtonText}>Tekrar dene</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {times && (
          <View style={styles.currentCard}>
            <ThemedText style={styles.currentLabel}>Şu anki vakit</ThemedText>
            <ThemedText style={[styles.currentName, { color: highlightColor }]}>
              {currentPrayer ?? '—'}
            </ThemedText>

            <View style={styles.nextRow}>
              <View>
                <ThemedText style={styles.nextLabel}>Sonraki vakit</ThemedText>
                <ThemedText style={styles.nextName}>{nextPrayer ?? '—'}</ThemedText>
              </View>
              <View style={styles.countdownBox}>
                <ThemedText style={styles.countdownLabel}>Kalan süre</ThemedText>
                <ThemedText style={styles.countdownValue}>{timeRemaining}</ThemedText>
              </View>
            </View>
          </View>
        )}

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
                  <ThemedText style={styles.premiumLabel}>{item.label}</ThemedText>
                  <ThemedText style={styles.premiumTime}>{item.value || '--:--'}</ThemedText>
                </View>
              );
            })}
          </View>
        )}

        {/* Günün İçerikleri Widgetları */}
        {dailyInfo && (
          <View style={styles.dailyContentsContainer}>
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, { backgroundColor: 'rgba(225,197,100,0.1)' }]}>
                   <MaterialCommunityIcons name="book-open-variant" size={18} color="#e1c564" />
                </View>
                <ThemedText style={styles.cardTitle}>Günün Ayeti</ThemedText>
              </View>
              <ThemedText style={styles.cardText}>"{dailyInfo.verse.text}"</ThemedText>
              <ThemedText style={styles.cardSource}>— {dailyInfo.verse.source}</ThemedText>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, { backgroundColor: 'rgba(25,130,196,0.1)' }]}>
                   <MaterialCommunityIcons name="comment-quote" size={18} color="#1982c4" />
                </View>
                <ThemedText style={styles.cardTitle}>Günün Hadisi</ThemedText>
              </View>
              <ThemedText style={styles.cardText}>"{dailyInfo.hadith.text}"</ThemedText>
              <ThemedText style={styles.cardSource}>— {dailyInfo.hadith.source}</ThemedText>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, { backgroundColor: 'rgba(138,201,38,0.1)' }]}>
                  <MaterialCommunityIcons name="hands-pray" size={18} color="#8ac926" />
                </View>
                <ThemedText style={styles.cardTitle}>Günün Duası</ThemedText>
              </View>
              <ThemedText style={styles.cardText}>"{dailyInfo.dua.text}"</ThemedText>
              <ThemedText style={styles.cardSource}>— {dailyInfo.dua.source}</ThemedText>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090906',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800',
    color: '#e1c564',
    letterSpacing: -0.5,
  } as TextStyle,
  hijriText: {
    fontSize: 13,
    color: '#a0a0a0',
    marginTop: 2,
    fontWeight: '500',
  } as TextStyle,
  locationText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#e1c564',
  } as TextStyle,
  locationButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e1c56433',
    backgroundColor: '#1a1814',
  },
  locationButtonText: {
    color: '#e1c564',
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  errorBox: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffefef',
    borderWidth: 1,
    borderColor: '#ffcccc',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#b00020',
  } as TextStyle,
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#b00020',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  currentCard: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#14120f',
    borderWidth: 1,
    borderColor: '#e1c56444',
    gap: 12,
    shadowColor: '#e1c564',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  currentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e1af64ff',
  } as TextStyle,
  currentName: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1,
  } as TextStyle,
  nextRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  nextLabel: {
    fontSize: 13,
    color: '#888',
  } as TextStyle,
  nextName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e1af64ff',
  } as TextStyle,
  countdownBox: {
    alignItems: 'flex-end',
  },
  countdownLabel: {
    fontSize: 13,
    color: '#888',
  } as TextStyle,
  countdownValue: {
    marginTop: 2,
    fontSize: 20,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    color: '#e1af64ff',
  } as TextStyle,
  premiumTable: {
    width: '100%',
    backgroundColor: '#14120f',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e1c56422',
  },
  premiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  premiumRowLast: {
    borderBottomWidth: 0,
  },
  premiumRowActive: {
    backgroundColor: 'rgba(225,197,100,0.1)',
    borderRadius: 12,
  },
  premiumLabel: {
    color: '#ddd',
    fontSize: 16,
    fontWeight: '500',
  } as TextStyle,
  premiumTime: {
    color: '#e1c564',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  dailyContentsContainer: {
    gap: 16,
    marginTop: 8,
  },
  infoCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#111',
    borderColor: '#333',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  } as TextStyle,
  cardText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#ccc',
    fontStyle: 'italic',
  } as TextStyle,
  cardSource: {
    fontSize: 13,
    color: '#888',
    textAlign: 'right',
    marginTop: 4,
    fontWeight: '600',
  } as TextStyle,
});