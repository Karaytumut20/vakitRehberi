// lib/background-task.ts
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleDailyNotifications } from './notifications';
import { LocationData, PrayerTimeData, CachedPrayerData } from '@/constants/types';

const TASK_NAME = 'BACKGROUND_PRAYER_NOTIFICATION_TASK';

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchPrayerTimesForTask(
  locationId: string,
): Promise<PrayerTimeData | null> {
  try {
    const res = await fetch(
      `https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locationId}`
    );

    if (!res.ok) {
      console.error(`[Task] Vakitler alınamadı (HTTP ${res.status}).`);
      return null;
    }

    const monthly = await res.json();
    const todayDate = getTodayDate();

    let todayTimes = monthly.find(
      (d: any) => typeof d.date === 'string' && d.date.startsWith(todayDate)
    );

    if (!todayTimes && monthly.length > 0) {
      todayTimes = monthly[0];
    }

    if (todayTimes) {
      const cache: CachedPrayerData = {
        locationId,
        fetchDate: todayDate,
        monthlyTimes: monthly,
      };

      await AsyncStorage.setItem(
        '@cached_prayer_data',
        JSON.stringify(cache)
      );

      return {
        imsak: todayTimes.fajr,
        gunes: todayTimes.sun,
        ogle: todayTimes.dhuhr,
        ikindi: todayTimes.asr,
        aksam: todayTimes.maghrib,
        yatsi: todayTimes.isha,
      };
    }
    return null;
  } catch (e: any) {
    console.error('[Task] fetchPrayerTimes error:', e);
    return null;
  }
}

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    console.log('[Task] Arka plan görevi çalışıyor...');
    const locationJson = await AsyncStorage.getItem('@selected_location');
    if (!locationJson) {
      console.log('[Task] Konum seçilmedi, görev atlanıyor.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const location: LocationData = JSON.parse(locationJson);
    const prayerTimes = await fetchPrayerTimesForTask(location.id);

    if (prayerTimes) {
      await scheduleDailyNotifications(prayerTimes);
      console.log('[Task] Bildirimler başarıyla planlandı.');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } else {
      console.log('[Task] Vakit verisi alınamadı.');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  } catch (error) {
    console.error('[Task] Görev yürütülürken hata oluştu:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundTask() {
  try {
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 60 * 6, // 6 saatte bir
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('Arka plan görevi başarıyla kaydedildi.');
  } catch (error) {
    console.error('Arka plan görevi kaydedilemedi:', error);
  }
}

export async function unregisterBackgroundTask() {
    try {
        await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
        console.log('Arka plan görevi başarıyla kaldırıldı.');
    } catch (error) {
        console.error('Arka plan görevi kaldırılamadı:', error);
    }
}
