// app/(tabs)/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications'; // Bildirimler etkinleştirildi
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, TextStyle, TouchableOpacity, View } from 'react-native';

// --- GEREKLİ İMPORTLAR ---
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
// -------------------

// --- TİPLER ---
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

// --- YENİ: AYAR TİPİ ---
// Bu tip, settings.tsx'teki ile aynı olmalı
export interface PrayerSettings {
  imsak: { adhan: boolean; reminder: boolean };
  gunes: { adhan: boolean; reminder: boolean };
  ogle: { adhan: boolean; reminder: boolean };
  ikindi: { adhan: boolean; reminder: boolean };
  aksam: { adhan: boolean; reminder: boolean };
  yatsi: { adhan: boolean; reminder: boolean };
}

// Varsayılan ayarlar (settings.tsx'teki ile aynı)
export const DEFAULT_SETTINGS: PrayerSettings = {
  imsak: { adhan: true, reminder: true },
  gunes: { adhan: false, reminder: false }, // Güneş vaktinde ezan/hatırlatıcı olmaz
  ogle: { adhan: true, reminder: true },
  ikindi: { adhan: true, reminder: true },
  aksam: { adhan: true, reminder: true },
  yatsi: { adhan: true, reminder: true },
};

export const SETTINGS_KEY = '@prayer_settings';
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


// --- BİLDİRİM AYARLARI (UYARI GİDERİLDİ) ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, // Yeni sürümler için eklendi
    shouldShowList: true, // Yeni sürümler için eklendi
  }),
});

// BİLDİRİM FONKSİYONU (TEST KODU EKLİ)
async function scheduleDailyNotifications(prayerTimes: PrayerTimeData) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert("Bildirim İzni", "Namaz vakitlerinde uyarılmak için lütfen bildirim izni verin.");
    return;
  }

  // Android'de Bildirim Kanalı Tanımlama (Zorunlu)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('prayer_times', {
      name: 'Namaz Vakitleri',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'adhan.wav', // Özel ezan sesi için kanal ayarı
      vibrationPattern: [0, 250, 250, 250],
    });
    
    await Notifications.setNotificationChannelAsync('prayer_reminders', {
      name: 'Namaz Hatırlatıcıları',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default', // Hatırlatıcı için varsayılan ses
    });
  }
  
  // Önceki tüm bildirimleri iptal et (Her zaman en güncel vakitleri kurmak için)
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('Tüm eski bildirimler iptal edildi.');


  // --- !!! TEST KODU BAŞLANGICI !!! ---
  // 10 SANİYE SONRASI İÇİN BİR TEST BİLDİRİMİ AYARLA
  try {
    console.log("!!! EZAN TEST BİLDİRİMİ 10 SANİYE İÇİN KURULUYOR !!!");
    await Notifications.scheduleNotificationAsync({
      identifier: `adhan_TEST`,
      content: {
        title: `🔔 TEST EZAN BİLDİRİMİ!`,
        body: `Bu bir ses testidir. Ezan sesini duymalısınız.`,
        sound: Platform.OS === 'android' ? 'adhan.wav' : 'adhan.wav',
      },
      trigger: { 
        seconds: 10, // 10 saniye sonra çal
        channelId: 'prayer_times',
      },
    });
    console.log('Test bildirimi 10 saniye sonrasına kuruldu.');
  } catch (e) {
    console.error(`Test bildirimi kurulurken hata:`, e);
  }
  // --- !!! TEST KODU BİTİŞİ !!! ---


  // 1. Kullanıcı ayarlarını çek
  let settings: PrayerSettings = DEFAULT_SETTINGS;
  try {
    const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
    if (settingsJson) {
      settings = JSON.parse(settingsJson);
    }
  } catch (e) {
    console.error("Bildirim ayarları okunamadı, varsayılanlar kullanılıyor.", e);
  }

  // 2. Bildirimi kurulacak vakitleri tanımla
  const notificationsToSchedule = [
    { id: 'imsak', name: 'İmsak', time: prayerTimes.imsak },
    { id: 'ogle', name: 'Öğle', time: prayerTimes.ogle },
    { id: 'ikindi', name: 'İkindi', time: prayerTimes.ikindi },
    { id: 'aksam', name: 'Akşam', time: prayerTimes.aksam },
    { id: 'yatsi', name: 'Yatsı', time: prayerTimes.yatsi },
  ];
  
  const now = new Date();

  for (const prayer of notificationsToSchedule) {
    const prayerSetting = settings[prayer.id as keyof PrayerSettings];
    if (!prayerSetting) continue; 

    const prayerDate = timeToDate(prayer.time);
    const reminderDate = new Date(prayerDate.getTime() - 15 * 60 * 1000); // 15 dk önce

    // 3. Hatırlatıcı Bildirimini Kur (Orijinal haliyle)
    if (prayerSetting.reminder && reminderDate.getTime() > now.getTime()) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `reminder_${prayer.id}`,
          content: {
            title: '⏰ Vakit Yaklaşıyor!',
            body: `${prayer.name} vaktine 15 dakika kaldı.`,
            sound: 'default', 
          },
          trigger: { 
            date: reminderDate,
            channelId: 'prayer_reminders',
          },
        });
        console.log(`${prayer.name} için 15dk hatırlatıcı kuruldu: ${reminderDate.toLocaleTimeString()}`);
      } catch (e) {
        console.error(`${prayer.name} hatırlatıcısı kurulurken hata:`, e);
      }
    }

    // 4. Ezan Vakti Bildirimini Kur (Orijinal haliyle)
    if (prayerSetting.adhan && prayerDate.getTime() > now.getTime()) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `adhan_${prayer.id}`,
          content: {
            title: `🔔 ${prayer.name} Vakti!`,
            body: `${prayer.name} namazı vakti girdi.`,
            sound: Platform.OS === 'android' ? 'adhan.wav' : 'adhan.wav',
          },
          trigger: { 
            date: prayerDate,
            channelId: 'prayer_times',
          },
        });
        console.log(`${prayer.name} için ezan bildirimi kuruldu: ${prayerDate.toLocaleTimeString()}`);
      } catch (e) {
        console.error(`${prayer.name} ezan bildirimi kurulurken hata:`, e);
      }
    }
  }
}
// -------------------


export default function HomeScreen() {
  const [times, setTimes] = useState<PrayerTimeData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [currentPrayer, setCurrentPrayer] = useState<PrayerName | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerName | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--:--');

  const theme = useColorScheme() ?? 'light';
  const highlightColor = useThemeColor({}, 'highlight');
  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mainAccentColor = useThemeColor({}, 'tint');

  useFocusEffect(
    React.useCallback(() => {
      checkLocationAndFetchTimes();
    }, [])
  );
  
  // Bildirimleri [times] değiştiğinde (yani vakitler çekildiğinde) kur
  useEffect(() => {
    if (times) {
      // Bildirimleri kur (yeni, gelişmiş fonksiyon)
      scheduleDailyNotifications(times);
    }
  }, [times]);
  

  useEffect(() => {
    if (!times) return; 

    const interval = setInterval(() => {
      const now = new Date();
      
      const prayerDateTimes: Record<PrayerName, Date> = {
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
      
      // 1. Bugünün tüm vakitlerini (ve yarının ilk vaktini) kontrol et
      const allPrayerTimesWithNextDay = [
        ...PRAYER_NAMES_ORDER.map(name => ({
          name, 
          time: prayerDateTimes[name],
          isNextDay: false
        })),
        { // Yarının İmsak'ı
          name: 'İmsak' as PrayerName,
          // İmsak vaktine 24 saat ekle
          time: new Date(prayerDateTimes['İmsak'].getTime() + 24 * 60 * 60 * 1000), 
          isNextDay: true
        }
      ];

      // 2. En yakın ve geçmiş olan vakitleri bul
      for (let i = 0; i < allPrayerTimesWithNextDay.length; i++) {
        const { name, time, isNextDay } = allPrayerTimesWithNextDay[i];
        const diff = time.getTime() - now.getTime();

        // Eğer vakit geçtiyse ve bugüne aitse (Yatsı'dan sonraki İmsak'ı atla)
        if (diff <= 0 && !isNextDay) {
          current = name;
        }

        // En yakın gelecek vakti bul
        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          next = name;
        }
      }

      // 3. Geçiş durumlarını ele al
      if (next === null) {
        current = 'Yatsı';
        next = 'İmsak';
        minDiff = allPrayerTimesWithNextDay[6].time.getTime() - now.getTime();
      }
      
      if (current === null && next === 'İmsak' && minDiff > (12 * 60 * 60 * 1000)) {
          current = 'Yatsı';
      }

      if (current === null) {
          current = 'Yatsı'; 
      }


      setCurrentPrayer(current);
      setNextPrayer(next);
      setTimeRemaining(formatTimeRemaining(minDiff));

    }, 1000); 
    
    return () => clearInterval(interval); 

  }, [times]); 

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
        
        // Veri bulunamadı hatasını önlemek için bu kontrolü geçici olarak kapattık
        /*
        if (cachedData.fetchDate === TODAY_DATE && cachedData.locationId === location.id) {
          console.log('Veri hafızadan (cache) yüklendi.');
          processApiData(cachedData.monthlyTimes, location.id); 
          return; 
        }
        */
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
         const errorBody = await response.text();
         throw new Error(`Vakitler alınamadı (HTTP ${response.status}). Detay: ${errorBody.substring(0, 50)}...`);
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
      else setError('Vakitler çekilirken bilinmeyen bir hata oluştu.');
      setLoading(false); 
    }
  }

  // --- "Veri Bulunamadı" Hatasını Gideren Fonksiyon ---
  function processApiData(monthlyTimesArray: any[], locationId: string) {
    try {
      if (!Array.isArray(monthlyTimesArray) || monthlyTimesArray.length === 0) {
        console.error("API'den beklenen dizi formatı gelmedi veya boş:", monthlyTimesArray);
        throw new Error('API yanıtı geçersiz. Beklenen format alınamadı.');
      }
      
      const TODAY_DATE = getTodayDate(); // örn: "2025-11-10"
      
      let todayTimes = monthlyTimesArray.find(
        (day: any) => day.date && day.date.startsWith(TODAY_DATE)
      );

      // --- HATA AYIKLAMA (API GELECEK TARİHİNİ DESTEKLEMİYORSA) ---
      // Eğer bugünün verisi bulunamazsa, API'den gelen ilk günü kullan
      if (!todayTimes) {
        console.warn(`Bugünün tarihi (${TODAY_DATE}) için veri bulunamadı.`);
        console.warn(`API'den gelen ilk günün verisi (${monthlyTimesArray[0].date}) kullanılacak.`);
        todayTimes = monthlyTimesArray[0]; // API'den gelen ilk günü al
      }
      // --- HATA AYIKLAMA SONU ---

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
        setError(`Veri bulundu ancak işlenemedi.`);
      }
    } catch (e) {
        if (e instanceof Error) setError(e.message);
        else setError('Veri işlenirken bilinmeyen bir hata oluştu.');
    } finally {
        setLoading(false); // Yüklemeyi bitir
    }
  }

  // ----- RENDER KISMI -----

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={mainAccentColor} />
        <ThemedText style={styles.loadingText}>Yükleniyor...</ThemedText>
      </ThemedView>
    );
  }

  if (error && !times) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.errorText} type="subtitle">Hata Oluştu!</ThemedText>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity style={[styles.button, { backgroundColor: mainAccentColor }]} onPress={() => router.push('/select-location')}>
          <ThemedText style={styles.buttonText}>Konum Seç</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <ThemedText type="title" style={styles.title}>Vakit Rehberi</ThemedText>
          {selectedLocation && (
            <ThemedText style={styles.location}>
              {selectedLocation.name}
            </ThemedText>
          )}
        </View>

        {/* LUXURIOUS COUNTDOWN CARD */}
        <ThemedView 
          style={[
            styles.countdownContainer, 
            { backgroundColor: cardBackgroundColor, borderColor: borderColor }
          ]}
        >
          {nextPrayer ? (
            <>
              <ThemedText style={styles.countdownText} type="subtitle">
                {nextPrayer} Vaktine Kalan Süre
              </ThemedText>
              <ThemedText 
                type="display" 
                style={{ color: highlightColor, marginTop: 5 }}
              >
                {timeRemaining}
              </ThemedText>
              {currentPrayer && (
                  <ThemedText style={styles.currentPrayerText}>
                      Şu anki Vakit: <ThemedText style={{ fontWeight: 'bold' as const }}>{currentPrayer}</ThemedText>
                  </ThemedText>
              )}
            </>
          ) : (
            <ActivityIndicator color={mainAccentColor} />
          )}
        </ThemedView>

        {/* ELEGANT TIMES LIST */}
        {times ? (
          <View style={styles.timesList}>
            <TimeRow 
              label="İmsak" 
              time={times.imsak} 
              isActive={currentPrayer === 'İmsak'} 
              isNext={nextPrayer === 'İmsak'} 
            />
            <TimeRow 
              label="Güneş" 
              time={times.gunes} 
              isActive={currentPrayer === 'Güneş'} 
              isNext={nextPrayer === 'Güneş'} 
            />
            <TimeRow 
              label="Öğle" 
              time={times.ogle} 
              isActive={currentPrayer === 'Öğle'} 
              isNext={nextPrayer === 'Öğle'} 
            />
            <TimeRow 
              label="İkindi" 
              time={times.ikindi} 
              isActive={currentPrayer === 'İkindi'} 
              isNext={nextPrayer === 'İkindi'} 
            />
            <TimeRow 
              label="Akşam" 
              time={times.aksam} 
              isActive={currentPrayer === 'Akşam'} 
              isNext={nextPrayer === 'Akşam'} 
            />
            <TimeRow 
              label="Yatsı" 
              time={times.yatsi} 
              isActive={currentPrayer === 'Yatsı'} 
              isNext={nextPrayer === 'Yatsı'} 
            />
          </View>
        ) : (
          <ThemedText style={styles.emptyText}>Bugüne ait vakitler yüklenemedi.</ThemedText>
        )}

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: mainAccentColor }]} 
          onPress={() => router.push('/select-location')}
        >
          <ThemedText style={styles.buttonText}>Konum Değiştir</ThemedText>
        </TouchableOpacity>
      </ScrollView>
      
    </SafeAreaView>
  );
}

// TimeRow Component
const TimeRow = ({ 
    label, 
    time, 
    isActive, 
    isNext 
}: { 
    label: PrayerName; 
    time: string; 
    isActive: boolean;
    isNext: boolean;
}) => {
  const textColor = useThemeColor({}, 'text');
  const accentColor = useThemeColor({}, 'tint');
  const cardBackgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');


  const containerStyle = {
    // Sonraki namaz vaktini belirginleştirmek için tema rengini kullan
    backgroundColor: isNext ? accentColor : cardBackgroundColor,
    borderColor: isNext ? accentColor : borderColor,
  };

  const textStyle: TextStyle = {
    color: isNext ? '#FFFFFF' : textColor,
    fontWeight: isNext ? 'bold' as const : '400' as const,
  };
  
  const timeTextStyle: TextStyle = {
    // Vakit bilgisini her zaman vurgu renginde tut
    color: isNext ? '#FFFFFF' : accentColor,
    fontWeight: 'bold' as const,
  };

  return (
    <ThemedView style={[styles.timeRowContainer, containerStyle]}>
      <ThemedText style={[styles.timeRowLabel, textStyle]}>{label}</ThemedText>
      <ThemedText style={[styles.timeRowTime, timeTextStyle]}>{time}</ThemedText>
    </ThemedView>
  );
};

// Yeni Şık Stiller
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 50,
    paddingBottom: 30, 
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 30, 
  },
  location: {
    fontSize: 18,
    opacity: 0.7,
    marginTop: 4,
    textAlign: 'center', 
  },
  countdownContainer: {
    marginHorizontal: 20,
    alignItems: 'center',
    padding: 25,
    borderRadius: 15,
    marginBottom: 25,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  countdownText: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.8,
  },
  currentPrayerText: {
    marginTop: 10,
    fontSize: 16,
    opacity: 0.7,
  },
  timesList: {
    marginHorizontal: 20,
    gap: 10,
  },
  timeRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  timeRowLabel: {
    fontSize: 18,
  },
  timeRowTime: {
    fontSize: 18,
  },
  errorText: {
    color: '#FFC107', 
    textAlign: 'center',
    padding: 10,
    marginBottom: 10,
  },
  button: {
    marginTop: 30,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
    opacity: 0.6,
  }
});