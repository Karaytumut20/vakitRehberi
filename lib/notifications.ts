// lib/notifications.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * İbadet vakti tipleri
 */
export interface PrayerTimeData {
  imsak: string;
  gunes: string;
  ogle: string;
  ikindi: string;
  aksam: string;
  yatsi: string;
}

const META_STORAGE_KEY = 'prayerNotificationMeta_v1';

// Meta bilgisi: Bugün için hangi saatler ile planlama yaptık?
interface NotificationMeta {
  date: string; // YYYY-MM-DD
  hash: string; // Saatlerin hash'i (JSON)
  locationId?: string; // Konum ID'si (şehir vs.)
}

// Bildirim handler: Uygulama ön plandayken bile alert göstersin.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, // Cihazın default sesi
    shouldSetBadge: false,
  }),
});

/**
 * Android için varsayılan bildirim kanalı oluştur.
 * - Özel ses yok
 * - Sadece cihazın default bildirim sesi
 */
export async function setupNotificationChannelAndroid() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'İbadet Vakitleri',
    importance: Notifications.AndroidImportance.HIGH,
    // sound: undefined => default sistem sesi
    sound: undefined,
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  console.log('LOG: Android bildirim kanalı (default) ayarlandı.');
}

/**
 * Bildirim iznini iste.
 */
export async function ensureNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * "YYYY-MM-DD" stringini üret (bugünün tarihi)
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Saat stringini ("HH:mm") alıp bugünün tarihine göre Date objesi üret.
 */
function makeDateForToday(time: string): Date | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(':');
  const hour = Number(hStr);
  const minute = Number(mStr);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const now = new Date();
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0
  );
  return d;
}

/**
 * Vakitleri hash'leyerek o gün için aynı planlamayı iki kere yapmamayı sağlar.
 */
function createPrayerHash(times: PrayerTimeData): string {
  const arr = [
    { k: 'imsak', t: times.imsak },
    { k: 'gunes', t: times.gunes },
    { k: 'ogle', t: times.ogle },
    { k: 'ikindi', t: times.ikindi },
    { k: 'aksam', t: times.aksam },
    { k: 'yatsi', t: times.yatsi },
  ];

  arr.sort((a, b) => a.k.localeCompare(b.k));
  return JSON.stringify(arr);
}

/**
 * Bugün için ibadet vakitleri bildirimlerini planla.
 * - Geçmiş saatler için bildirim yaratmaz (Yani İmsak / Öğle geçmişse, atlanır)
 * - Aynı gün, aynı vakitlerle yeniden planlama yapılmışsa tekrar schedule ETMEZ.
 * - Uygulama açık/kapalı fark etmez, sistem kendisi tetikler.
 */
export async function schedulePrayerNotificationsForToday(
  times: PrayerTimeData,
  locationId?: string
) {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    console.log('LOG: Bildirim izni verilmedi, scheduling iptal.');
    return;
  }

  if (Platform.OS === 'android') {
    await setupNotificationChannelAndroid();
  }

  const today = getTodayDateString();
  const hash = createPrayerHash(times);

  // Daha önce bugün için planlama yaptıysak tekrar yapma
  try {
    const rawMeta = await AsyncStorage.getItem(META_STORAGE_KEY);
    if (rawMeta) {
      const meta: NotificationMeta = JSON.parse(rawMeta);
      if (meta.date === today && meta.hash === hash && meta.locationId === locationId) {
        console.log(
          'LOG: Bildirim planlama atlandı (aynı gün, aynı vakitler, aynı konum).'
        );
        return;
      }
    }
  } catch (e) {
    console.log('LOG: Meta okuma hatası:', e);
  }

  // Eski planlanmış bildirimleri temizle
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('LOG: (schedule) Önceki tüm planlanmış bildirimler temizlendi.');

  const now = new Date();

  // Hangi vakitler için bildirim istiyorsan buraya ekle
  const entries: Array<{ key: keyof PrayerTimeData; label: string }> = [
    { key: 'imsak', label: 'İmsak' },
    { key: 'ogle', label: 'Öğle' },
    { key: 'ikindi', label: 'İkindi' },
    { key: 'aksam', label: 'Akşam' },
    { key: 'yatsi', label: 'Yatsı' },
    // Eğer Güneş için de bildirim istiyorsan alttaki satırı aç:
    // { key: 'gunes', label: 'Güneş' },
  ];

  for (const entry of entries) {
    const timeStr = times[entry.key];
    const fireDate = makeDateForToday(timeStr);

    if (!fireDate) {
      console.log(
        `LOG: Atlandı -> ${entry.label} (${timeStr}) (geçersiz saat formatı)`
      );
      continue;
    }

    // Geçmişte kalan vakitleri planlama
    if (fireDate.getTime() <= now.getTime()) {
      console.log(
        `LOG: Atlandı -> ${entry.label} saat: ${fireDate.toLocaleString()} (geçmiş saat)`
      );
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${entry.label} vakti geldi`,
        body: `${entry.label} vakti girdi.`,
        sound: undefined, // default sistem sesi
        data: { prayerKey: entry.key, time: timeStr },
      },
      trigger: fireDate,
    });

    console.log(
      `LOG: Planlandı -> ${entry.label} saat: ${fireDate.toLocaleString()}`
    );
  }

  const meta: NotificationMeta = { date: today, hash, locationId };
  await AsyncStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  console.log('LOG: Yeni bildirim meta kaydedildi:', JSON.stringify(meta));
}
