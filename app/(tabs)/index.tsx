// app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// Bildirimleri Expo Go'da hata verdiği için geçici olarak devre dışı bırakıyoruz
// import * as Notifications from 'expo-notifications'; 

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

interface CachedPrayerData {
  locationId: string;
  fetchDate: string; // Verinin çekildiği tarih (YYYY-MM-DD)
  monthlyTimes: any[]; // API'den gelen tam aylık dizi
}

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

// "05:45" gibi bir string'i bugünün tarihine sahip bir Date nesnesine çevirir
function timeToDate(timeString: string): Date {
  // Eğer saat "24:00" gibi gelirse, JS'nin anlayacağı "00:00" yap
  if (timeString.startsWith('24:')) {
      timeString = timeString.replace('24:', '00:');
  }
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0); 
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

/*
// --- BİLDİRİM AYARLARI (Expo Go'da çalışmaz) ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
// ---------------------------------
*/

export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimeData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [currentPrayer, setCurrentPrayer] = useState<PrayerName | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerName | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--:--');

  useFocusEffect(
    React.useCallback(() => {
      checkLocationAndFetchTimes();
    }, [])
  );

  useEffect(() => {
    if (!times) return; 

    const interval = setInterval(() => {
      const now = new Date();
      
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
      let minDiff = Infinity; 

      for (const name of PRAYER_NAMES_ORDER) {
        const prayerTime = prayerDateTimes[name];
        const diff = prayerTime.getTime() - now.getTime();

        if (diff <= 0) {
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
        const tomorrowImsak = timeToDate(times.imsak);
        tomorrowImsak.setDate(tomorrowImsak.getDate() + 1); 
        minDiff = tomorrowImsak.getTime() - now.getTime();
      }

      setCurrentPrayer(current);
      setNextPrayer(next);
      setTimeRemaining(formatTimeRemaining(minDiff));

    }, 1000); 
    
    return () => clearInterval(interval); 

  }, [times]); 

  /*
  // --- BİLDİRİM PLANLAMA (Expo Go'da çalışmaz) ---
  useEffect(() => {
    if (times) {
      // scheduleDailyNotifications(times);
      Alert.alert(
        "Bildirimler Devre Dışı", 
        "Uygulamayı Expo Go'da çalıştırdığınız için bildirimler devre dışı bırakıldı. Bildirimleri test etmek için 'npx expo run:android' komutu ile development build oluşturun."
      );
    }
  }, [times]); 
  // ------------------------------------------
  */

  async function checkLocationAndFetchTimes() {
    setLoading(true);
    setTimes(null); 
    setError(null);
    const TODAY_DATE = getTodayDate();
    
    try {
      const locationJson = await AsyncStorage.getItem('@selected_location');
      if (locationJson == null) {
        setError('Lütfen bir konum seçin.');
        setLoading(false);
        router.push('/select-location');
        return; 
      }
      
      const location: LocationData = JSON.parse(locationJson);
      setSelectedLocation(location);

      const cachedDataJson = await AsyncStorage.getItem('@cached_prayer_data');
      if (cachedDataJson) {
        const cachedData: CachedPrayerData = JSON.parse(cachedDataJson);
        
        if (cachedData.fetchDate === TODAY_DATE && cachedData.locationId === location.id) {
          console.log('Veri hafızadan (cache) yüklendi.');
          processApiData(cachedData.monthlyTimes, location.id); 
          return; 
        }
      }

      console.log('Veri API\'den çekiliyor...');
      await fetchPrayerTimes(location.id, TODAY_DATE); 
      
    } catch (e) {
      setError('Hafıza okunurken hata oluştu.');
      setLoading(false);
    }
  }

  async function fetchPrayerTimes(locationId: string, todayDate: string) {
    try {
      const response = await fetch(
        `https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locationId}`
      );
      
      if (!response.ok) {
         throw new Error(`Vakitler alınamadı (HTTP ${response.status})`);
      }

      const monthlyTimesArray = await response.json();
      
      processApiData(monthlyTimesArray, locationId);

      const dataToCache: CachedPrayerData = {
        locationId: locationId,
        fetchDate: todayDate,
        monthlyTimes: monthlyTimesArray,
      };
      await AsyncStorage.setItem('@cached_prayer_data', JSON.stringify(dataToCache));
      console.log('Veri hafızaya kaydedildi.');

    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError('Bilinmeyen bir hata oluştu.');
      setLoading(false); 
    }
  }

  // BU FONKSİYON DÜZELTİLDİ
  function processApiData(monthlyTimesArray: any[], locationId: string) {
    try {
      if (!Array.isArray(monthlyTimesArray)) {
        console.error("API'den beklenen dizi formatı gelmedi:", monthlyTimesArray);
        throw new Error('API yanıtı geçersiz. Beklenen format alınamadı.');
      }
      
      const TODAY_DATE = getTodayDate();
      
      // API 'date' alanını "YYYY-MM-DDTHH:mm:ss" formatında döndürüyor
      const todayTimes = monthlyTimesArray.find(
        (day: any) => day.date && day.date.startsWith(TODAY_DATE)
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
    } catch (e) {
        if (e instanceof Error) setError(e.message);
        else setError('Veri işlenirken bilinmeyen bir hata oluştu.');
    } finally {
        setLoading(false); // Yüklemeyi bitir
    }
  }

  /* // --- BİLDİRİM FONKSİYONU (Expo Go'da çalışmaz) ---
  async function scheduleDailyNotifications(prayerTimes: PrayerTimeData) {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Bildirim izni reddedildi.');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Vakit Bildirimleri',
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Önceki bildirimler iptal edildi.');

    const UYARI_SURESI_DAKIKA = 15; 

    const notificationsToSchedule = [
      { name: 'İmsak', time: prayerTimes.imsak },
      { name: 'Öğle', time: prayerTimes.ogle },
      { name: 'İkindi', time: prayerTimes.ikindi },
      { name: 'Akşam', time: prayerTimes.aksam },
      { name: 'Yatsı', time: prayerTimes.yatsi },
    ];

    for (const prayer of notificationsToSchedule) {
      const prayerDate = timeToDate(prayer.time);
      const triggerDate = new Date(prayerDate.getTime() - UYARI_SURESI_DAKIKA * 60000);
      
      if (triggerDate.getTime() > new Date().getTime()) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Vakit Yaklaşıyor!',
              body: `${prayer.name} vaktine ${UYARI_SURESI_DAKIKA} dakika kaldı.`,
              sound: 'default',
            },
            trigger: triggerDate,
          });
          console.log(`${prayer.name} için bildirim ${triggerDate.toLocaleTimeString()} saatine kuruldu.`);
        } catch (e) {
          console.error(`${prayer.name} bildirimi kurulurken hata:`, e);
        }
      }
    }
  }
  // ------------------------------------------
  */

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

// TimeRow Component
const TimeRow = ({ label, time, isActive }: { label: PrayerName; time: string; isActive: boolean }) => {
  return (
    <View style={[
      styles.timeRowContainer, 
      isActive && styles.timeRowActive 
    ]}>
      <Text style={[styles.timeRowLabel, isActive && styles.timeRowTextActive]}>{label}:</Text>
      <Text style={[styles.timeRowTime, isActive && styles.timeRowTextActive]}>{time}</Text>
    </View>
  );
};

// Stiller
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
    marginBottom: 20,
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
  timesContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    width: '90%',
    overflow: 'hidden',
  },
  timeRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timeRowActive: {
    backgroundColor: '#007bff',
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
    color: '#ffffff',
    fontWeight: 'bold',
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