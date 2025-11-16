// lib/notifications.ts
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PrayerSettings,
  PrayerTimeData,
  ScheduleMeta,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
  SCHEDULED_META_KEY,
  SchedulePayload,
  ScheduleItem,
  PrayerName,
} from '@/constants/types';

/**
 * --- Bildirim Sabitleri ---
 */
const ANDROID_CHANNEL_ID = 'prayer_times_adhan_v1';
const ANDROID_SOUND_NAME = 'adhan.wav';

/**
 * --- Yardımcı Fonksiyonlar ---
 */
function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeToDateBase(timeString: string): Date {
  let t = timeString;

  if (typeof t !== 'string') {
    console.warn(`timeToDateBase: Geçersiz saat: ${t} -> '00:00' kullanıldı`);
    t = '00:00';
  }

  if (t.startsWith('24:')) {
    t = t.replace('24:', '00:');
  }

  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function safeTimeToFutureDate(
  timeString: string,
  now: Date = new Date()
): Date {
  const candidate = timeToDateBase(timeString);

  if (candidate.getTime() <= now.getTime()) {
    return new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }

  return candidate;
}

/**
 * --- Bildirim Davranışı (Uygulama açıkken de gözüksün) ---
 */
export function setForegroundAlerts(enabled: boolean) {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const behavior: any = {
        shouldShowAlert: enabled,
        shouldPlaySound: enabled,
        shouldSetBadge: false,
      };

      if (Platform.OS === 'ios') {
        (behavior as any).shouldShowBanner = enabled;
      }

      return behavior as Notifications.NotificationBehavior;
    },
  });
}

async function getMergedSettings(): Promise<PrayerSettings> {
  try {
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(saved);

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      imsak: { ...DEFAULT_SETTINGS.imsak, ...(parsed.imsak || {}) },
      gunes: { ...DEFAULT_SETTINGS.gunes, ...(parsed.gunes || {}) },
      ogle: { ...DEFAULT_SETTINGS.ogle, ...(parsed.ogle || {}) },
      ikindi: { ...DEFAULT_SETTINGS.ikindi, ...(parsed.ikindi || {}) },
      aksam: { ...DEFAULT_SETTINGS.aksam, ...(parsed.aksam || {}) },
      yatsi: { ...DEFAULT_SETTINGS.yatsi, ...(parsed.yatsi || {}) },
    };
  } catch (e) {
    console.warn('getMergedSettings error:', e);
    return DEFAULT_SETTINGS;
  }
}

function buildSchedulePayload(
  times: PrayerTimeData,
  settings: PrayerSettings
): SchedulePayload {
  const baseList: ScheduleItem[] = [
    {
      key: 'imsak',
      name: 'İmsak',
      time: times.imsak,
      enabled: settings.imsak.adhan,
    },
    {
      key: 'gunes',
      name: 'Güneş',
      time: times.gunes,
      enabled: settings.gunes.adhan,
    },
    {
      key: 'ogle',
      name: 'Öğle',
      time: times.ogle,
      enabled: settings.ogle.adhan,
    },
    {
      key: 'ikindi',
      name: 'İkindi',
      time: times.ikindi,
      enabled: settings.ikindi.adhan,
    },
    {
      key: 'aksam',
      name: 'Akşam',
      time: times.aksam,
      enabled: settings.aksam.adhan,
    },
    {
      key: 'yatsi',
      name: 'Yatsı',
      time: times.yatsi,
      enabled: settings.yatsi.adhan,
    },
  ];

  const list = baseList.filter((x) => x.enabled);

  const normalized = list
    .map((x) => ({ k: x.key, t: x.time }))
    .sort((a, b) => String(a.k).localeCompare(String(b.k)));

  const hash = JSON.stringify(normalized);

  return { list, hash };
}

export async function scheduleDailyNotifications(
  prayerTimes: PrayerTimeData
): Promise<void> {
  let { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    existingStatus = status;
  }

  if (existingStatus !== 'granted') {
    console.log('Bildirim izni verilmedi.');
    return;
  }

  const settings = await getMergedSettings();
  const { list, hash } = buildSchedulePayload(prayerTimes, settings);
  const today = getTodayDate();

  let meta: ScheduleMeta | null = null;
  try {
    const metaJson = await AsyncStorage.getItem(SCHEDULED_META_KEY);
    if (metaJson) {
      meta = JSON.parse(metaJson) as ScheduleMeta;
    }
  } catch (e) {
    console.warn('scheduleDailyNotifications meta parse error:', e);
  }

  if (meta && meta.date === today && meta.hash === hash) {
    console.log(
      'LOG: Bildirimler zaten bugünün vakitlerine göre planlanmış, tekrar kurulmadı.'
    );
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('LOG: Önceki tüm planlanmış bildirimler temizlendi.');

  const now = new Date();

  for (const p of list) {
    const date = safeTimeToFutureDate(p.time, now);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Vakit Geldi',
        body: `${p.name} vakti girdi.`,
        sound: ANDROID_SOUND_NAME,
      },
      trigger: {
        date,
        ...(Platform.OS === 'android'
          ? ({ channelId: ANDROID_CHANNEL_ID } as any)
          : {}),
      },
    });

    console.log(
      `LOG: Planlandı -> ${p.name} saat: ${date.toLocaleString('tr-TR')}`
    );
  }

  const newMeta: ScheduleMeta = { hash, date: today };
  await AsyncStorage.setItem(SCHEDULED_META_KEY, JSON.stringify(newMeta));
  console.log('LOG: Yeni bildirim meta kaydedildi:', newMeta);
}

export async function setupAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Namaz Vakitleri',
      importance: Notifications.AndroidImportance.MAX,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: ANDROID_SOUND_NAME,
    });

    console.log('LOG: Android bildirim kanalı (Adhan) ayarlandı.');
  } catch (e) {
    console.warn('Android channel setup error:', e);
  }
}
