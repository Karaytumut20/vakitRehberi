// lib/notifications.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * API’den gelen ibadet vakti tipleri
 */
export interface PrayerTimeData {
  imsak: string;
  gunes: string;
  ogle: string;
  ikindi: string;
  aksam: string;
  yatsi: string;
}

/**
 * Monthly API day type
 */
export interface MonthlyPrayerDay {
  date: string; // "YYYY-MM-DD"
  fajr: string;
  sun: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

// Meta key
const META_STORAGE_KEY = 'prayerNotificationMeta_v2';

/**
 * Bildirim Ayarları
 */
export interface PrayerSettings {
  imsak: { adhan: boolean };
  gunes: { adhan: boolean };
  ogle: { adhan: boolean };
  ikindi: { adhan: boolean };
  aksam: { adhan: boolean };
  yatsi: { adhan: boolean };
}

export const SETTINGS_KEY = '@prayer_settings';

export const DEFAULT_SETTINGS: PrayerSettings = {
  imsak: { adhan: true },
  gunes: { adhan: false },
  ogle: { adhan: true },
  ikindi: { adhan: true },
  aksam: { adhan: true },
  yatsi: { adhan: true },
};

/**
 * Kullanıcı bildirim ayarlarını yükle
 */
async function getPrayerSettings(): Promise<PrayerSettings> {
  try {
    const s = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!s) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(s);
    return {
      imsak: { ...DEFAULT_SETTINGS.imsak, ...parsed.imsak },
      gunes: { ...DEFAULT_SETTINGS.gunes, ...parsed.gunes },
      ogle: { ...DEFAULT_SETTINGS.ogle, ...parsed.ogle },
      ikindi: { ...DEFAULT_SETTINGS.ikindi, ...parsed.ikindi },
      aksam: { ...DEFAULT_SETTINGS.aksam, ...parsed.aksam },
      yatsi: { ...DEFAULT_SETTINGS.yatsi, ...parsed.yatsi },
    };
  } catch (e) {
    console.warn('Ayarlar okunamadı:', e);
    return DEFAULT_SETTINGS;
  }
}

// ---- Double schedule protection ----
let isScheduling = false;

// Bildirim handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android notification channel
export async function setupNotificationChannelAndroid() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'İbadet Vakitleri',
    importance: Notifications.AndroidImportance.HIGH,
    sound: undefined,
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  console.log('LOG: Android notification channel set.');
}

// Permission
export async function ensureNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Time → Date converter
function makeDateForDay(time: string, dateStr: string): Date | null {
  if (!time || !dateStr) return null;

  try {
    const clean = dateStr.substring(0, 10);
    const [y, m, d] = clean.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);

    if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;

    return new Date(y, m - 1, d, hh, mm, 0, 0);
  } catch (e) {
    console.warn('makeDateForDay error:', time, dateStr, e);
    return null;
  }
}

/**
 * ANA FONKSİYON — 15 günlük bildirim planlama
 */
export async function schedulePrayerNotificationsFor15Days(
  monthlyTimes: MonthlyPrayerDay[],
  locationId?: string
) {
  if (isScheduling) {
    console.log('LOG: Scheduling already in progress. Skipped.');
    return;
  }
  isScheduling = true;

  try {
    const hasPerm = await ensureNotificationPermission();
    if (!hasPerm) {
      console.log('LOG: Permission denied.');
      return;
    }

    const settings = await getPrayerSettings();

    if (!monthlyTimes || monthlyTimes.length === 0) {
      console.log('LOG: Empty monthlyTimes.');
      return;
    }

    // Eski bildirimleri temizle
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('LOG: Previous notifications cleared.');

    let scheduledCount = 0;
    const now = new Date();

    // 15 gün
    const days = monthlyTimes.slice(0, 15);

    const entries: Array<{ key: keyof PrayerTimeData; label: string }> = [
      { key: 'imsak', label: 'İmsak' },
      { key: 'ogle', label: 'Öğle' },
      { key: 'ikindi', label: 'İkindi' },
      { key: 'aksam', label: 'Akşam' },
      { key: 'yatsi', label: 'Yatsı' },
    ];

    for (const day of days) {
      const times: PrayerTimeData = {
        imsak: day.fajr,
        gunes: day.sun,
        ogle: day.dhuhr,
        ikindi: day.asr,
        aksam: day.maghrib,
        yatsi: day.isha,
      };

      for (const entry of entries) {
        const key = entry.key;

        // Kullanıcı ayarı kapalıysa
        if (!settings[key]?.adhan) continue;

        const fireDate = makeDateForDay(times[key], day.date);
        if (!fireDate) continue;

        if (fireDate.getTime() <= now.getTime()) continue;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${entry.label} vakti geldi`,
            body: `${entry.label} vakti girdi. (${times[key]})`,
            sound: undefined,
            data: {
              prayerKey: key,
              time: times[key],
              date: day.date,
              locationId: locationId ?? null,
            },
          },
          trigger: fireDate,
        });

        scheduledCount++;
      }
    }

    console.log(`LOG: ${scheduledCount} bildirim başarıyla planlandı.`);

  } catch (e) {
    console.error('schedulePrayerNotificationsFor15Days ERROR:', e);
  } finally {
    isScheduling = false;
  }
}

/**
 * Tüm bildirimleri iptal et
 */
export async function cancelAllPrayerNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(META_STORAGE_KEY);
  console.log('LOG: All prayer notifications cancelled.');
}
