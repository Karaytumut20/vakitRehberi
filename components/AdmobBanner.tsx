// components/AdmobBanner.tsx

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
    BannerAd,
    BannerAdSize,
    TestIds,
} from 'react-native-google-mobile-ads';

// 🔹 Sadece Android'de göstermek için:
const isAndroid = Platform.OS === 'android';

// 🔹 Geliştirme ortamı için Google test banner ID'si kullanıyoruz.
// Yayına geçerken kendi gerçek Banner Ad Unit ID'ni yazacaksın.
const ANDROID_TEST_BANNER_ID = TestIds.BANNER;
// Örnek: const ANDROID_PROD_BANNER_ID = 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx';

const adUnitId = __DEV__
  ? ANDROID_TEST_BANNER_ID
  : 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx'; // ✅ Burayı gerçek banner ID'n ile değiştir

const AdmobBanner: React.FC = () => {
  if (!isAndroid) {
    // iOS veya diğer platformlarda hiçbir şey gösterme
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          console.log('AdMob Banner loaded successfully');
        }}
        onAdFailedToLoad={(error) => {
          console.log('AdMob Banner failed to load:', error);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
});

export default AdmobBanner;
