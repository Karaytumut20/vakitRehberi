// lib/notifications.ts

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ANDROID_CHANNEL_ID = 'prayer_times_adhan_v1'; // Kanal ID
const ADHAN_SOUND_FILENAME = 'adhan.wav';           // Sadece dosya adı

// 🔔 1) Bildirim handler – Uygulama açıksa da ses + alert gözüksün
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

// 🔧 2) İzin iste + Android için kanal oluştur
export async function setupNotifications() {
  try {
    // 1) İzinleri kontrol et
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('🔕 Bildirim izni verilmedi');
      return false;
    }

    // 2) Android kanalını oluştur
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Namaz Vakitleri',
        importance: Notifications.AndroidImportance.MAX,
        sound: ADHAN_SOUND_FILENAME, // app.json -> sounds ile eşleşiyor
        enableVibrate: true,
        vibrationPattern: [0, 500, 500, 500],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
      });
    }

    return true;
  } catch (error) {
    console.error('setupNotifications error:', error);
    return false;
  }
}

// Namaz vakti tipleri
export type PrayerKey = 'imsak' | 'gunes' | 'ogle' | 'ikindi' | 'aksam' | 'yatsi';

export interface PrayerTimeMap {
  imsak: string;
  gunes: string;
  ogle: string;
  ikindi: string;
  aksam: string;
  yatsi: string;
}

// Verilen "HH:mm" saati için bugün Date üret (eğer geçmişse: yarına atma, bugünkü için test)
function makeTodayDateFromTime(time: string): Date | null {
  const [hh, mm] = time.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  const now = new Date();
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hh,
    mm,
    0,
    0
  );

  // Burada gerçek kullanımda geleceğe de schedule edebilirsin,
  // ama ezan için o günün saatini baz alıyoruz.
  if (d.getTime() <= now.getTime()) {
    // Eğer çoktan geçmişse, test için 1 dakika ileriye atabiliriz
    const testDate = new Date(now.getTime() + 60 * 1000);
    return testDate;
  }

  return d;
}

// 🕌 3) Tek bir namaz için bildirim planla
export async function scheduleSinglePrayerNotification(
  key: PrayerKey,
  time: string,
  withSound: boolean
) {
  const date = makeTodayDateFromTime(time);
  if (!date) {
    console.log('Geçersiz saat, bildirim planlanmadı:', key, time);
    return;
  }

  const titleMap: Record<PrayerKey, string> = {
    imsak: 'İmsak Vakti',
    gunes: 'Güneş Vakti',
    ogle: 'Öğle Vakti',
    ikindi: 'İkindi Vakti',
    aksam: 'Akşam Vakti',
    yatsi: 'Yatsı Vakti'
  };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: titleMap[key] ?? 'Namaz Vakti',
      body: `${titleMap[key] ?? 'Namaz'} vakti girdi.`,
      sound: withSound ? ADHAN_SOUND_FILENAME : undefined
    },
    trigger: {
      date,
      ...(Platform.OS === 'android'
        ? ({ channelId: ANDROID_CHANNEL_ID } as any)
        : {})
    }
  });

  console.log('📅 Bildirim planlandı:', key, time, date.toString());
}

// 🔁 4) Gün içindeki tüm namazlar için bildirim planla
export async function scheduleAllPrayerNotifications(
  times: PrayerTimeMap,
  enabledMap: Partial<Record<PrayerKey, boolean>>
) {
  // Önce eski bildirimleri temizleyelim
  await Notifications.cancelAllScheduledNotificationsAsync();

  const keys: PrayerKey[] = [
    'imsak',
    'gunes',
    'ogle',
    'ikindi',
    'aksam',
    'yatsi'
  ];

  for (const key of keys) {
    const enabled = enabledMap[key];
    if (!enabled) continue;

    const time = times[key];
    if (!time) continue;

    await scheduleSinglePrayerNotification(key, time, true);
  }
}

// 🧪 5) Test için: 30 saniye sonrasına ezan sesli bildirim kur
export async function scheduleTestNotification(secondsFromNow = 30) {
  const now = Date.now();
  const date = new Date(now + secondsFromNow * 1000);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Ezan Bildirimi',
      body: 'Bu bir test bildirimi. Ezan sesi geliyorsa sistem çalışıyor.',
      sound: ADHAN_SOUND_FILENAME
    },
    trigger: {
      date,
      ...(Platform.OS === 'android'
        ? ({ channelId: ANDROID_CHANNEL_ID } as any)
        : {})
    }
  });

  console.log('🧪 Test bildirimi planlandı:', date.toString());
}
