// app/(tabs)/monthly.tsx

import AdmobBanner from '@/components/AdmobBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

/** --- Tipler --- */

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

/** --- Yardımcı --- */

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

  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');

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

        // Cache yoksa veya farklı lokasyonsa yeniden çek
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
      <SafeAreaView style={{ flex: 1 }}>
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" color={tintColor} />
          <ThemedText style={styles.loadingText}>
            Aylık takvim yükleniyor...
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        {/* ÜST ADMOB */}
        <View style={styles.bannerTopWrapper}>
          <View style={styles.bannerInner}>
            <AdmobBanner />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Başlık */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>Aylık Takvim</ThemedText>
            {location && (
              <ThemedText style={styles.location}>
                {location.name}
              </ThemedText>
            )}
            <ThemedText style={styles.subtitle}>
              Bu ayın tüm namaz vakitlerini aşağıdaki listeden
              inceleyebilirsiniz.
            </ThemedText>
          </View>

          {/* Hata Mesajı */}
          {error && (
            <View style={styles.errorBox}>
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
                        borderColor: isToday ? tintColor : borderColor,
                      },
                      isToday && styles.dayCardToday,
                    ]}
                  >
                    {/* Tarih */}
                    <View style={styles.dayHeader}>
                      <ThemedText
                        style={[
                          styles.dayDate,
                          isToday && { color: tintColor },
                        ]}
                      >
                        {formatDateTR(day.date)}
                      </ThemedText>
                      {isToday && (
                        <ThemedText
                          style={[
                            styles.todayBadge,
                            { borderColor: tintColor, color: tintColor },
                          ]}
                        >
                          Bugün
                        </ThemedText>
                      )}
                    </View>

                    {/* Saatler */}
                    <View style={styles.timesGrid}>
                      <View style={styles.timeCol}>
                        <ThemedText style={styles.timeLabel}>İmsak</ThemedText>
                        <ThemedText style={styles.timeValue}>
                          {day.fajr || '--:--'}
                        </ThemedText>
                      </View>
                      <View style={styles.timeCol}>
                        <ThemedText style={styles.timeLabel}>Güneş</ThemedText>
                        <ThemedText style={styles.timeValue}>
                          {day.sun || '--:--'}
                        </ThemedText>
                      </View>
                      <View style={styles.timeCol}>
                        <ThemedText style={styles.timeLabel}>Öğle</ThemedText>
                        <ThemedText style={styles.timeValue}>
                          {day.dhuhr || '--:--'}
                        </ThemedText>
                      </View>
                      <View style={styles.timeCol}>
                        <ThemedText style={styles.timeLabel}>İkindi</ThemedText>
                        <ThemedText style={styles.timeValue}>
                          {day.asr || '--:--'}
                        </ThemedText>
                      </View>
                      <View style={styles.timeCol}>
                        <ThemedText style={styles.timeLabel}>Akşam</ThemedText>
                        <ThemedText style={styles.timeValue}>
                          {day.maghrib || '--:--'}
                        </ThemedText>
                      </View>
                      <View style={styles.timeCol}>
                        <ThemedText style={styles.timeLabel}>Yatsı</ThemedText>
                        <ThemedText style={styles.timeValue}>
                          {day.isha || '--:--'}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* ALT ADMOB */}
        <View style={styles.bannerBottomWrapper}>
          <View style={styles.bannerInner}>
          </View>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

/** --- Stil --- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 64,
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
    opacity: 0.7,
  } as TextStyle,
  errorBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#ffefef',
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  errorText: {
    fontSize: 14,
    color: '#b00020',
  } as TextStyle,
  monthList: {
    gap: 10,
  },
  dayCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  dayCardToday: {
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
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
    fontWeight: '500',
  } as TextStyle,
});
