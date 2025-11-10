// app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router'; // Yönlendirme ve Ekrana odaklanma
import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

// Namaz vakti verisinin tipi
interface PrayerTimeData {
  imsak: string;
  gunes: string;
  ogle: string;
  ikindi: string;
  aksam: string;
  yatsi: string;
}

// Hafızada saklanan konum verisinin tipi
interface LocationData {
  id: string;
  city_name: string;
  district_name: string;
}

// --- YENİ (DİNAMİK TARİH) ---
// O günün tarihini "YYYY-MM-DD" formatında döndüren fonksiyon
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Aylar 0'dan başlar
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
// ----------------------------

export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimeData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter(); // Yönlendirme için

  // --- YENİ (DİNAMİK TARİH) ---
  // Sabit tarihi sildik, fonksiyonu kullanıyoruz.
  // Not: Biz Supabase'e 10 Kasım 2025 verisi girdik.
  // Eğer bu kodu 10 Kasım 2025'te çalıştırmıyorsanız, HİÇBİR VERİ GELMEZ.
  // Test için ŞİMDİLİK tarihi manuel bırakalım, en son adımda değiştirelim.
  const TODAY_DATE = '2025-11-10'; // !! GEÇİCİ !!
  // const TODAY_DATE = getTodayDate(); // OLMASI GEREKEN
  // ----------------------------

  // Bu ekran her açıldığında (veya odaklandığında) çalışır
  useFocusEffect(
    React.useCallback(() => {
      checkLocationAndFetchTimes();
    }, [])
  );

  // 1. Hafızadaki konumu kontrol et
  async function checkLocationAndFetchTimes() {
    setLoading(true);
    try {
      const locationJson = await AsyncStorage.getItem('@selected_location');
      
      if (locationJson == null) {
        // Hafızada konum yoksa, kullanıcıya konum seçtir
        setError('Lütfen bir konum seçin.');
        setLoading(false);
        router.push('/select-location'); // Konum Seçme ekranına yönlendir
      } else {
        // Konum varsa, state'e kaydet ve vakitleri çek
        const location: LocationData = JSON.parse(locationJson);
        setSelectedLocation(location);
        fetchPrayerTimes(location.id);
      }
    } catch (e) {
      setError('Hafıza okunurken hata oluştu.');
    }
  }

  // 2. Vakitleri Supabase'den çek
  async function fetchPrayerTimes(locationId: string) {
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('prayer_times')
        .select('*')
        .eq('location_id', locationId) // Dinamik location_id
        .eq('date', TODAY_DATE)        // Dinamik tarih (şimdilik sabit)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setTimes(data);
      } else {
        // Bu hatayı görmen normal, çünkü Supabase'e o günün verisini girmedik
        setError(`Veri Bulunamadı. \nKonum: ${locationId} \nTarih: ${TODAY_DATE} \nSupabase'e bu tarih için veri eklediğinizden emin olun.`);
      }
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError('Bilinmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  // Yükleniyor ekranı
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  // Hata ekranı (Konum seçme butonu içerir)
  if (error && !times) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Hata Oluştu!</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/select-location')}>
          <Text style={styles.buttonText}>Konum Seç</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Ana Ekran
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Başlık ve Konum Alanı */}
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Vakit Rehberi</Text>
        {selectedLocation && (
          <Text style={styles.location}>
            {selectedLocation.city_name} / {selectedLocation.district_name}
          </Text>
        )}
      </View>

      {/* Vakitlerin Listelendiği Alan */}
      {times ? (
        <View style={styles.timesContainer}>
          <Text style={styles.timeRow}>İmsak:  <Text style={styles.time}>{times.imsak.substring(0, 5)}</Text></Text>
          <Text style={styles.timeRow}>Güneş:  <Text style={styles.time}>{times.gunes.substring(0, 5)}</Text></Text>
          <Text style={styles.timeRow}>Öğle:   <Text style={styles.time}>{times.ogle.substring(0, 5)}</Text></Text>
          <Text style={styles.timeRow}>İkindi: <Text style={styles.time}>{times.ikindi.substring(0, 5)}</Text></Text>
          <Text style={styles.timeRow}>Akşam:  <Text style={styles.time}>{times.aksam.substring(0, 5)}</Text></Text>
          <Text style={styles.timeRow}>Yatsı:  <Text style={styles.time}>{times.yatsi.substring(0, 5)}</Text></Text>
        </View>
      ) : (
        <Text>Vakitler yüklenemedi.</Text>
      )}

      {/* Konum Değiştirme Butonu */}
      <TouchableOpacity style={styles.button} onPress={() => router.push('/select-location')}>
        <Text style={styles.buttonText}>Konum Değiştir</Text>
      </TouchableOpacity>
      
    </SafeAreaView>
  );
}

// Stiller (Biraz güncellendi)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    paddingTop: 50,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  location: {
    fontSize: 18,
    color: 'gray',
    marginTop: 5,
  },
  timesContainer: {
    padding: 25,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    width: '90%',
  },
  timeRow: {
    fontSize: 22,
    marginVertical: 10,
    color: '#444',
  },
  time: {
    fontWeight: 'bold',
    color: '#000',
    marginLeft: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    padding: 10,
    marginBottom: 10,
  },
  button: {
    marginTop: 30,
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});