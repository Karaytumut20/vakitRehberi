// components/AdmobBannerTop.tsx
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
    BannerAd,
    BannerAdSize,
    TestIds,
} from 'react-native-google-mobile-ads';

// Test için ID
const TEST_ID = TestIds.BANNER;

// Prod ID — bunu yenisiyle değiştireceksin
const PROD_ID = 'ca-app-pub-4816381866965413/9089404028';

const AdmobBannerTop = () => {
  const [hasAd, setHasAd] = useState(false);

  if (Platform.OS !== 'android') return null;

  const unitId = __DEV__ ? TEST_ID : PROD_ID;

  return (
    <View style={styles.container}>
      {/* Reklam gelmezse hiç göstermiyoruz */}
      {hasAd && (
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.BANNER}
          onAdLoaded={() => setHasAd(true)}
          onAdFailedToLoad={() => setHasAd(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});

export default AdmobBannerTop;
