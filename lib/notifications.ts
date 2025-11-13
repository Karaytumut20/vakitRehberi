// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'prayer_times_adhan_v1';

// --- 1) Bildirim Handler ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,       // Bildirim görünsün
    shouldPlaySound: true,       // Ses çalsın
    shouldSetBadge: false,       // iOS badge yok
  }),
});

// --- 2) İzin iste & Android kanalı oluştur ---
export async function setupNotifications() {
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Bildirim izni reddedildi');
    return false;
  }

  // Android için özel kanal — ezan sesi çalması için şart
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Adhan Channel',
      importance: 5,          // MAX önem — ses garanti çalar
      sound: 'adhan.wav',     // android/app/src/main/res/raw/
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ffffff',
    });
  }

  return true;
}

// --- 3) Test için alarm ---
export async function testAdhanNow() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📿 Test Ezan',
      body: 'Ezan sesi test ediliyor.',
      sound: 'adhan.wav',
    },
    trigger: null, // Hemen çalışır
  });
}
