// components/AdmobBanner.tsx

import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';

// Test ID (HER ZAMAN ÇALIŞIR)
const TEST_BANNER_ID = TestIds.BANNER;

// Üretim ID (Yayına çıkarken değiştireceksin)
const PROD_BANNER_ID = 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx';

const AdmobBanner: React.FC = () => {
  const [failed, setFailed] = useState(false);

  // Eğer cihaz Android değilse reklam gösterme
  if (Platform.OS !== 'android') return null;

  const adUnitId = __DEV__ ? TEST_BANNER_ID : PROD_BANNER_ID;

  return (
    <View style={styles.wrapper}>
      {!failed ? (
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => {
            console.log('AdMob Banner loaded');
            setFailed(false);
          }}
          onAdFailedToLoad={(error) => {
            console.log('AdMob Banner failed:', error);
            setFailed(true);
          }}
        />
      ) : (
        <View style={styles.fallback} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  fallback: {
    width: '100%',
    height: 50, // Banner yüksekliği kadar boşluk bırakalım
  },
});

export default AdmobBanner;
