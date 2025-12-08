import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View, // SafeAreaView yerine View kullanıyoruz
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

import { getRandomContent } from '@/constants/islamicContent';
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPrayer, setCurrentPrayer] = useState<PrayerName | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerName | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('—:—:—');

  const [dailyInfo, setDailyInfo] = useState<{
    verse: { text: string; source: string };
    hadith: { text: string; source: string };
  } | null>(null);

  const theme = useColorScheme() ?? 'light';
  const router = useRouter();
  const highlightColor = useThemeColor({}, 'highlight');

  useEffect(() => {
    setDailyInfo(getRandomContent());
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
      const res = await fetch(
        `https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locationId}`
      );
      if (!res.ok) throw new Error(`Vakitler alınamadı (HTTP ${res.status}).`);

      const monthly: MonthlyPrayerDay[] = await res.json();
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

  // DÜZELTME: SafeAreaView yerine View kullanıldı
  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
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
            style={[styles.locationButton, { borderColor: '#e1c564' }]}
            onPress={() => router.push('/select-location')}
          >
            <ThemedText style={[styles.locationButtonText, { color: '#e1c564' }]}>
              Konum Değiştir
            </ThemedText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.quranButton, { borderColor: '#e1c56433', backgroundColor: '#14120f' }]}
          onPress={() => router.push('/quran')}
        >
          <ThemedText style={{fontSize: 24}}>📖</ThemedText>
          <View style={{flex: 1, marginLeft: 12}}>
            <ThemedText style={[styles.premiumLabel, {color: '#e1c564'}]}>Kur'an-ı Kerim</ThemedText>
            <ThemedText style={{color: '#888', fontSize: 12}}>Sureleri oku</ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#e1c564" />
        </TouchableOpacity>

        {error && (
          <View style={styles.errorBox}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <TouchableOpacity style={styles.retryButton} onPress={checkLocationAndFetchTimes}>
              <ThemedText style={styles.retryButtonText}>Tekrar dene</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {times && (
          <View style={[styles.currentCard, { backgroundColor: '#090906', borderColor: '#e1af64ff' }]}>
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

      

        {dailyInfo && (
          <>
            <View style={[styles.infoCard, { borderColor: '#e1c56433' }]}>
              <View style={styles.cardHeader}>
                <ThemedText style={styles.cardIcon}>📖</ThemedText>
                <ThemedText style={[styles.cardTitle, { color: '#e1c564' }]}>Günün Ayeti</ThemedText>
              </View>
              <ThemedText style={styles.cardText}>"{dailyInfo.verse.text}"</ThemedText>
              <ThemedText style={styles.cardSource}>— {dailyInfo.verse.source}</ThemedText>
            </View>

         
          </>
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
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 30,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
  quranButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  infoCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#0b0b0a',
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardIcon: {
    fontSize: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  } as TextStyle,
  cardText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#e5e5e5',
    fontStyle: 'italic',
  } as TextStyle,
  cardSource: {
    fontSize: 12,
    color: '#e1c564',
    textAlign: 'right',
    marginTop: 4,
    fontWeight: '600',
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
});