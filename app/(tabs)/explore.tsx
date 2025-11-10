// app/(tabs)/explore.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Ana ekrandaki (index.tsx) CachedPrayerData tipiyle aynı olmalı
interface CachedPrayerData {
  locationId: string;
  fetchDate: string;
  monthlyTimes: any[]; 
}

// Aylık API verisindeki her bir günün tipi
interface DailyTime {
  date: string;
  fajr: string; // imsak
  sun: string; // güneş
  dhuhr: string; // öğle
  asr: string; // ikindi
  maghrib: string; // akşam
  isha: string; // yatsı
}

// Tarihi "10 Kasım 2025" formatına çevirir
function formatDate(dateString: string) {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (e) {
    return dateString; // Hata olursa orijinal tarihi göster
  }
}

export default function MonthlyScreen() {
  const [monthlyData, setMonthlyData] = useState<DailyTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadCachedData();
    }, [])
  );

  async function loadCachedData() {
    setLoading(true);
    setError(null);
    setMonthlyData([]);
    try {
      const cachedDataJson = await AsyncStorage.getItem('@cached_prayer_data');
      if (!cachedDataJson) {
        setError('Ana sayfadan bir konum seçtiğinizde aylık veriler burada görünecektir.');
        setLoading(false);
        return;
      }
      
      const cachedData: CachedPrayerData = JSON.parse(cachedDataJson);
      
      if (cachedData.monthlyTimes && cachedData.monthlyTimes.length > 0) {
        setMonthlyData(cachedData.monthlyTimes);
      } else {
        setError('Aylık veri bulunamadı.');
      }

    } catch (e) {
      setError('Veri yüklenirken bir hata oluştu.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      </ThemedView>
    );
  }

  const renderHeader = () => (
    <View style={[styles.row, styles.headerRow]}>
      <ThemedText style={[styles.cell, styles.headerText, styles.dateCell]}>Tarih</ThemedText>
      <ThemedText style={[styles.cell, styles.headerText]}>İmsak</ThemedText>
      <ThemedText style={[styles.cell, styles.headerText]}>Öğle</ThemedText>
      <ThemedText style={[styles.cell, styles.headerText]}>Akşam</ThemedText>
    </View>
  );

  const renderItem = ({ item }: { item: DailyTime }) => (
    <View style={styles.row}>
      <ThemedText style={[styles.cell, styles.dateCell]}>{formatDate(item.date)}</ThemedText>
      <ThemedText style={styles.cell}>{item.fajr}</ThemedText>
      <ThemedText style={styles.cell}>{item.dhuhr}</ThemedText>
      <ThemedText style={styles.cell}>{item.maghrib}</ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Aylık Takvim</ThemedText>
      {/* FlatList'i yatayda da kaydırılabilir yapmak için ScrollView içine aldık.
        Bu, çok fazla veri için performanslı değildir ancak 30 günlük veri için yeterlidir.
      */}
      <ScrollView horizontal contentContainerStyle={{ width: '150%' }}>
        <FlatList
          data={monthlyData}
          keyExtractor={(item) => item.date}
          ListHeaderComponent={renderHeader}
          renderItem={renderItem}
          stickyHeaderIndices={[0]} // Başlık satırını sabitler
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
    color: 'gray',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 10,
  },
  headerRow: {
    backgroundColor: '#f5f5f5',
  },
  cell: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  dateCell: {
    flex: 1.5, // Tarih sütunu daha geniş
    textAlign: 'left',
    paddingLeft: 5,
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
});