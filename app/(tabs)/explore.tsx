import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextStyle,
  View, // SafeAreaView yerine View
} from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface PrayerDay {
  date: string;
  fajr: string;
  sun: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

interface CachedPrayerData {
  locationId: string;
  fetchDate: string;
  monthlyTimes: PrayerDay[];
}

interface LocationData {
  id: string;
  name: string;
}

const CACHE_KEY = '@cached_prayer_data';
const LOCATION_KEY = '@selected_location';

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTR(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
    });
  } catch {
    return dateStr;
  }
}

export default function MonthlyScreen() {
  const [monthlyTimes, setMonthlyTimes] = useState<PrayerDay[] | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gold = '#e1c564';
  const goldDark = '#e1af64ff';
  const cardBackgroundColor = '#0b0b0a';
  const borderGoldSoft = '#e1c56433';

  useEffect(() => {
    async function loadMonthly() {
      setLoading(true);
      setError(null);

      try {
        const locationJson = await AsyncStorage.getItem(LOCATION_KEY);
        if (!locationJson) {
          setError('Lütfen önce konum seçin.');
          setLoading(false);
          return;
        }

        const loc: LocationData = JSON.parse(locationJson);
        setLocation(loc);

        const cachedJson = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedJson) {
          const cached: CachedPrayerData = JSON.parse(cachedJson);
          if (cached.locationId === loc.id && Array.isArray(cached.monthlyTimes)) {
            setMonthlyTimes(cached.monthlyTimes);
            setLoading(false);
            return;
          }
        }

        const today = getTodayDate();
        const res = await fetch(
          `https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${loc.id}`
        );

        if (!res.ok) {
          throw new Error(`Vakitler alınamadı (HTTP ${res.status}).`);
        }

        const monthly: PrayerDay[] = await res.json();
        setMonthlyTimes(monthly);

        const cache: CachedPrayerData = {
          locationId: loc.id,
          fetchDate: today,
          monthlyTimes: monthly,
        };
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e: any) {
        console.warn('Monthly load error:', e);
        setError(e?.message ?? 'Aylık takvim yüklenirken hata oluştu.');
      } finally {
        setLoading(false);
      }
    }

    loadMonthly();
  }, []);

  const todayStr = getTodayDate();

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={gold} />
        <ThemedText style={[styles.loadingText, { color: gold }]}>
          Aylık takvim yükleniyor...
        </ThemedText>
      </View>
    );
  }

  // DÜZELTME: SafeAreaView yerine View
  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Başlık */}
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: gold }]}>
            Aylık Takvim
          </ThemedText>

          {location && (
            <ThemedText style={[styles.location, { color: goldDark }]}>
              {location.name}
            </ThemedText>
          )}

          <ThemedText style={[styles.subtitle, { color: goldDark }]}>
            Bu ayın tüm namaz vakitlerini aşağıdaki listeden
            inceleyebilirsiniz.
          </ThemedText>
        </View>

        {/* Hata Mesajı */}
        {error && (
          <View style={[styles.errorBox, { borderColor: '#b00020', backgroundColor: '#330000' }]}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {/* Aylık Liste */}
        {monthlyTimes && (
          <View style={styles.monthList}>
            {monthlyTimes.map((day) => {
              const isToday = day.date.startsWith(todayStr);
              return (
                <View
                  key={day.date}
                  style={[
                    styles.dayCard,
                    {
                      backgroundColor: cardBackgroundColor,
                      borderColor: isToday ? gold : borderGoldSoft,
                    },
                    isToday && {
                      shadowColor: gold,
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                    },
                  ]}
                >
                  <View style={styles.dayHeader}>
                    <ThemedText style={[styles.dayDate, { color: isToday ? gold : goldDark }]}>
                      {formatDateTR(day.date)}
                    </ThemedText>
                    {isToday && (
                      <ThemedText style={[styles.todayBadge, { borderColor: gold, color: gold }]}>
                        Bugün
                      </ThemedText>
                    )}
                  </View>

                  <View style={styles.timesGrid}>
                    {[
                      ['İmsak', day.fajr],
                      ['Güneş', day.sun],
                      ['Öğle', day.dhuhr],
                      ['İkindi', day.asr],
                      ['Akşam', day.maghrib],
                      ['Yatsı', day.isha],
                    ].map(([label, value]) => (
                      <View key={label} style={styles.timeCol}>
                        <ThemedText style={[styles.timeLabel, { color: goldDark }]}>
                          {label}
                        </ThemedText>
                        <ThemedText style={[styles.timeValue, { color: gold }]}>
                          {value || '--:--'}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  } as TextStyle,
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 30,
    gap: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  } as TextStyle,
  location: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.9,
  } as TextStyle,
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.8,
  } as TextStyle,
  errorBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    color: '#ff9999',
  } as TextStyle,
  monthList: {
    gap: 10,
  },
  dayCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayDate: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  todayBadge: {
    fontSize: 11,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  } as TextStyle,
  timesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  timeCol: {
    width: '30%',
    minWidth: '30%',
  },
  timeLabel: {
    fontSize: 12,
    opacity: 0.7,
  } as TextStyle,
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
});