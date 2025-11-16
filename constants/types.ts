// constants/types.ts

/**
 * --- Tipler ---
 */

export interface PrayerTimeData {
  imsak: string;
  gunes: string;
  ogle: string;
  ikindi: string;
  aksam: string;
  yatsi: string;
}

export interface LocationData {
  id: string;
  name: string;
}

export interface CachedPrayerData {
  locationId: string;
  fetchDate: string;
  monthlyTimes: any[];
}

export type PrayerName = 'İmsak' | 'Güneş' | 'Öğle' | 'İkindi' | 'Akşam' | 'Yatsı';

export const PRAYER_NAMES_ORDER: PrayerName[] = [
  'İmsak',
  'Güneş',
  'Öğle',
  'İkindi',
  'Akşam',
  'Yatsı',
];

export interface PrayerSettings {
  imsak: { adhan: boolean };
  gunes: { adhan: boolean };
  ogle: { adhan: boolean };
  ikindi: { adhan: boolean };
  aksam: { adhan: boolean };
  yatsi: { adhan: boolean };
}

/**
 * --- Varsayılan Ayarlar ---
 */
export const DEFAULT_SETTINGS: PrayerSettings = {
  imsak: { adhan: true },
  gunes: { adhan: false },
  ogle: { adhan: true },
  ikindi: { adhan: true },
  aksam: { adhan: true },
  yatsi: { adhan: true },
};

export const SETTINGS_KEY = '@prayer_settings';

// v3: Gün + hash meta
export const SCHEDULED_META_KEY = '@prayer_scheduled_meta_v3';

export interface ScheduleMeta {
  hash: string;
  date: string; // YYYY-MM-DD
}

export interface ScheduleItem {
  key: keyof PrayerSettings;
  name: PrayerName;
  time: string;
  enabled: boolean;
}

export interface SchedulePayload {
  list: ScheduleItem[];
  hash: string;
}
