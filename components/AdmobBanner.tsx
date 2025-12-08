import React, { useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';

// Test ID (Geliştirme sırasında bunu kullanır, yayınlarken PROD'a geçer)
const AD_UNIT_ID = __DEV__ 
  ? TestIds.BANNER 
  : 'ca-app-pub-4816381866965413/9089404028'; // Senin Prod ID'n

const AdmobBanner: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const { width } = useWindowDimensions();

  // Android/iOS değilse gösterme (Web vb.)
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;

  return (
    <View style={[styles.container, { width: width }]}>
      <BannerAd
        unitId={AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} // Responsive Boyut
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          console.log('Reklam yüklendi');
          setIsLoaded(true);
        }}
        onAdFailedToLoad={(error) => {
          console.error('Reklam yüklenemedi:', error);
          setIsLoaded(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden', // Taşmaları engeller
  },
});


export default AdmobBanner;


