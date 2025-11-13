// lib/notifications.ts

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Android notification channel & sound
const ANDROID_CHANNEL_ID = 'prayer_times_adhan_v1';
const ANDROID_SOUND_NAME = 'adhan.wav';

// --------------------------------------------------
// Global notification handler
// --------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --------------------------------------------------
// Bildirim izinlerini iste + Android kanalını oluştur
// --------------------------------------------------
export async function setupNotifications(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission not granted.');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Ezan Notifications',
        importance: Notifications.AndroidImportance.MAX,
        sound: ANDROID_SOUND_NAME,
        vibrationPattern: [200, 100, 200],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    return true;
  } catch (error) {
    console.log('setupNotifications error:', error);
    return false;
  }
}

// --------------------------------------------------
// Tüm eski planlanmış bildirimleri temizler
// --------------------------------------------------
export async function clearAllScheduledNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All scheduled notifications cancelled.');
  } catch (error) {
    console.log('clearAllScheduledNotifications error:', error);
  }
}

// --------------------------------------------------
// Saniye bazlı ezan bildirimi planlar
// --------------------------------------------------
export async function scheduleAdhanNotificationInSeconds(
  seconds: number,
  prayerName: string
): Promise<void> {
  try {
    console.log(
      `Scheduling "${prayerName}" in ${seconds} seconds at`,
      new Date(Date.now() + seconds * 1000).toISOString()
    );

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Vakit Rehberi',
        body: `${prayerName} vaktine ulaşıldı`,
        sound: ANDROID_SOUND_NAME,
      },
      trigger: {
        seconds,
        channelId: ANDROID_CHANNEL_ID,
        repeats: false,
      },
    });
  } catch (error) {
    console.log('scheduleAdhanNotificationInSeconds error:', error);
  }
}
