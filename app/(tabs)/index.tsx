// app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// --- YENİ TİPLER ---
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

// API'den gelen aylık veriyi ve tarihi saklamak için
interface CachedPrayerData {
  locationId: string;
  fetchDate: string; // Verinin çekildiği tarih (YYYY-MM-DD)
  monthlyTimes: any[]; // API'den gelen tam aylık dizi
}

// Geri sayım ve aktif vakit için tip
type PrayerName = 'İmsak' | 'Güneş' | 'Öğle' | 'İkindi' | 'Akşam' | 'Yatsı';
const PRAYER_NAMES_ORDER: PrayerName[] = ['İmsak', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı'];
// -------------------


// O günün tarihini "YYYY-MM-DD" formatında döndüren fonksiyon
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- YENİ YARDIMCI FONKSİYONLAR ---

// "05:45" gibi bir string'i bugünün tarihine sahip bir Date nesnesine çevirir
function timeToDate(timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0); // Saat ve dakikayı ayarla, saniye ve milisaniyeyi sıfırla
  return date;
}

// Kalan süreyi "HH:mm:ss" formatında string'e çevirir
function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds < 0) return '00:00:00';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map(val => val.toString().padStart(2, '0'))
    .join(':');
}
// ---------------------------------


export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimeData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // --- YENİ STATE'LER (Geri Sayım için) ---
  const [currentPrayer, setCurrentPrayer] = useState<PrayerName | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerName | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--:--');
  // ------------------------------------

  // Bu ekran her açıldığında (veya odaklandığında) çalışır
  useFocusEffect(
    React.useCallback(() => {
      checkLocationAndFetchTimes();
    }, [])
  );

  // --- YENİ useEffect (Saniyelik Geri Sayım) ---
  useEffect(() => {
    if (!times) return; // Vakitler yüklenmediyse sayacı başlatma

    // Her saniye çalışacak olan zamanlayıcı
    const interval = setInterval(() => {
      const now = new Date();
      
      // Vakitleri Date nesnelerine çevir
      const prayerDateTimes = {
        'İmsak': timeToDate(times.imsak),
        'Güneş': timeToDate(times.gunes),
        'Öğle': timeToDate(times.ogle),
        'İkindi': timeToDate(times.ikindi),
        'Akşam': timeToDate(times.aksam),
        'Yatsı': timeToDate(times.yatsi),
      };

      let current: PrayerName | null = null;
      let next: PrayerName | null = null;
      let minDiff = Infinity; // Kalan minimum süre (milisaniye)

      // Bir sonraki vakti ve içinde bulunan vakti bul
      for (const name of PRAYER_NAMES_ORDER) {
        const prayerTime = prayerDateTimes[name];
        const diff = prayerTime.getTime() - now.getTime();

        // Şu anki vakti bul (geçmiş son vakit)
        if (diff <= 0) {
          current = name;
        }

        // Bir sonraki vakti bul (gelecek ilk vakit)
        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          next = name;
        }
      }

      // Eğer tüm vakitler geçtiyse (Yatsı'dan sonra)
      if (next === null) {
        // Bir sonraki günün İmsak vaktini hedefle
        current = 'Yatsı';
        next = 'İmsak';
        const tomorrowImsak = timeToDate(times.imsak);
        tomorrowImsak.setDate(tomorrowImsak.getDate() + 1); // Tarihi 1 gün ileri al
        minDiff = tomorrowImsak.getTime() - now.getTime();
      }

      setCurrentPrayer(current);
      setNextPrayer(next);
      setTimeRemaining(formatTimeRemaining(minDiff));

    }, 1000); // Her 1000ms (1 saniye)
    
    // Ekran kapanınca veya times değişince sayacı temizle
    return () => clearInterval(interval); 

  }, [times]); // 'times' state'i değiştiğinde bu useEffect yeniden çalışır
  // ----------------------------------------------


  // 1. Hafızadaki konumu kontrol et
  async function checkLocationAndFetchTimes() {
    setLoading(true);
    setTimes(null); 
    setError(null);
    const TODAY_DATE = getTodayDate();
    
    try {
      // 1.A. Konum seçili mi?
      const locationJson = await AsyncStorage.getItem('@selected_location');
      if (locationJson == null) {
        setError('Lütfen bir konum seçin.');
        setLoading(false);
        router.push('/select-location');
        return; // Fonksiyondan çık
      }
      
      const location: LocationData = JSON.parse(locationJson);
      setSelectedLocation(location);

      // 1.B. Hafızada (Cache) bu konuma ait güncel veri var mı?
      const cachedDataJson = await AsyncStorage.getItem('@cached_prayer_data');
      if (cachedDataJson) {
        const cachedData: CachedPrayerData = JSON.parse(cachedDataJson);
        
        // Hafızadaki veri bugüne aitse ve aynı konumsa, API'ye gitme
        if (cachedData.fetchDate === TODAY_DATE && cachedData.locationId === location.id) {
          console.log('Veri hafızadan (cache) yüklendi.');
          processApiData(cachedData.monthlyTimes, location.id); // Hafızadaki veriyi işle
          return; // API'ye gitmeden fonksiyondan çık
        }
      }

      // 1.C. Hafızada yoksa veya güncel değilse API'den çek
      console.log('Veri API\'den çekiliyor...');
      fetchPrayerTimes(location.id, TODAY_DATE); 
      
    } catch (e) {
      setError('Hafıza okunurken hata oluştu.');
      setLoading(false);
    }
  }

  // 2. Vakitleri Diyanet API'sinden (abdus.dev) çek
  async function fetchPrayerTimes(locationId: string, todayDate: string) {
    try {
      const response = await fetch(
        `https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locationId}`
      );
      
      if (!response.ok) {
         throw new Error(`Vakitler alınamadı (HTTP ${response.status})`);
      }

      const monthlyTimesArray = await response.json();
      
      // Veriyi işle (Bu fonksiyonu ayırdık çünkü cache'den de çağıracağız)
      processApiData(monthlyTimesArray, locationId);

      // --- YENİ (Caching) ---
      // Gelen aylık veriyi hafızaya kaydet
      const dataToCache: CachedPrayerData = {
        locationId: locationId,
        fetchDate: todayDate,
        monthlyTimes: monthlyTimesArray,
      };
      await AsyncStorage.setItem('@cached_prayer_data', JSON.stringify(dataToCache));
      console.log('Veri hafızaya kaydedildi.');
      // --------------------

    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError('Bilinmeyen bir hata oluştu.');
      setLoading(false); // Sadece hata durumunda setLoading'i burada false yap
    }
  }

  // 3. Gelen API verisini işleyen fonksiyon (Yeni)
  function processApiData(monthlyTimesArray: any[], locationId: string) {
    if (!Array.isArray(monthlyTimesArray)) {
      console.error("API'den beklenen dizi formatı gelmedi:", monthlyTimesArray);
      throw new Error('API yanıtı geçersiz. Beklenen format alınamadı.');
    }
    
    const TODAY_DATE = getTodayDate();
    const todayTimes = monthlyTimesArray.find(
      (day: any) => day.date.startsWith(TODAY_DATE)
    );

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
      setError(`Veri Bulunamadı. \nKonum ID: ${locationId} \nTarih: ${TODAY_DATE}`);
    }
    
    setLoading(false); // Veri işlendikten sonra yüklemeyi bitir
  }


  // ----- RENDER KISMI -----

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Vakit Rehberi</Text>
        {selectedLocation && (
          <Text style={styles.location}>
            {selectedLocation.name}
          </Text>
        )}
      </View>

      {/* --- YENİ (Geri Sayım Alanı) --- */}
      <View style={styles.countdownContainer}>
        {nextPrayer ? (
          <>
            <Text style={styles.countdownText}>{nextPrayer} Vaktine Kalan Süre</Text>
            <Text style={styles.countdownTimer}>{timeRemaining}</Text>
          </>
        ) : (
          <ActivityIndicator color="#007bff" />
        )}
      </View>
      {/* --------------------------------- */}


      {times ? (
        <View style={styles.timesContainer}>
          <TimeRow label="İmsak" time={times.imsak} isActive={currentPrayer === 'İmsak'} />
          <TimeRow label="Güneş" time={times.gunes} isActive={currentPrayer === 'Güneş'} />
          <TimeRow label="Öğle" time={times.ogle} isActive={currentPrayer === 'Öğle'} />
          <TimeRow label="İkindi" time={times.ikindi} isActive={currentPrayer === 'İkindi'} />
          <TimeRow label="Akşam" time={times.aksam} isActive={currentPrayer === 'Akşam'} />
          <TimeRow label="Yatsı" time={times.yatsi} isActive={currentPrayer === 'Yatsı'} />
        </View>
      ) : (
        <Text>Bugüne ait vakitler yüklenemedi.</Text>
      )}

      <TouchableOpacity style={styles.button} onPress={() => router.push('/select-location')}>
        <Text style={styles.buttonText}>Konum Değiştir</Text>
      </TouchableOpacity>
      
    </SafeAreaView>
  );
}

// --- YENİ (Vurgulama için Ayrı Component) ---
// Vakit satırını, aktif olup olmamasına göre stil vermek için ayırıyoruz.
const TimeRow = ({ label, time, isActive }: { label: PrayerName; time: string; isActive: boolean }) => {
  return (
    <View style={[
      styles.timeRowContainer, 
      isActive && styles.timeRowActive // Aktif ise arkaplanı vurgula
    ]}>
      <Text style={[styles.timeRowLabel, isActive && styles.timeRowTextActive]}>{label}:</Text>
      <Text style={[styles.timeRowTime, isActive && styles.timeRowTextActive]}>{time}</Text>
    </View>
  );
};
// ------------------------------------------

// --- GÜNCELLENMİŞ STİLLER ---
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
    marginBottom: 20, // Azaltıldı
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
    paddingHorizontal: 20, 
    textAlign: 'center', 
  },
  // YENİ (Geri Sayım Alanı Stilleri)
  countdownContainer: {
    width: '90%',
    alignItems: 'center',
    backgroundColor: '#e6f2ff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  countdownText: {
    fontSize: 16,
    color: '#0056b3',
    fontWeight: '600',
  },
  countdownTimer: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#004a99',
    marginTop: 5,
  },
  // ------------------------------
  timesContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    width: '90%',
    overflow: 'hidden', // Vurgulama için eklendi
  },
  // YENİ (TimeRow Component Stilleri)
  timeRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeRowActive: {
    backgroundColor: '#007bff', // Vurgu rengi
  },
  timeRowLabel: {
    fontSize: 20,
    color: '#444',
  },
  timeRowTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  timeRowTextActive: {
    color: '#ffffff', // Vurgu metin rengi
    fontWeight: 'bold',
  },
  // ------------------------------
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