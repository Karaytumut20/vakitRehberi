import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// --- HATA ÇÖZÜMÜ: EKSİK FONKSİYONLAR BURADA ---

// Kâbe'nin (Mekke) koordinatları
const KAABA_LATITUDE = 21.4225;
const KAABA_LONGITUDE = 39.8262;

/**
 * Dereceyi radyana çevirir
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Radyanı dereceye çevirir
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * İki GPS noktası arasındaki yönü (Kuzey'e göre) hesaplar
 * @param lat1 Kullanıcının enlemi
 * @param lon1 Kullanıcının boylamı
 * @param lat2 Hedefin (Kâbe) enlemi
 * @param lon2 Hedefin (Kâbe) boylamı
 * @returns 0-360 arası derece cinsinden yön
 */
function calculateQiblaDirection(lat1: number, lon1: number): number {
  const lat2 = KAABA_LATITUDE;
  const lon2 = KAABA_LONGITUDE;

  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const lat2Rad = toRadians(lat2);
  const lon2Rad = toRadians(lon2);

  const dLon = lon2Rad - lon1Rad;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x);
  bearing = toDegrees(bearing);
  
  // Sonucu 0-360 derece aralığına normalize et
  return (bearing + 360) % 360;
}
// ------------------------------------------


export default function QiblaScreen() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null); 
  const headingValue = useSharedValue(0); 

  useEffect(() => {
    let compassSubscription: Location.LocationSubscription | undefined;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Pusula ve Kıble yönü için konum izni gerekli.');
        return;
      }

      try {
        // 1. Önce kullanıcının anlık GPS konumunu al
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, 
        });
        const { latitude, longitude } = location.coords;

        // 2. GPS konumuna göre Kıble yönünü hesapla
        // BU SATIR ARTIK ÇALIŞACAK
        const calculatedDirection = calculateQiblaDirection(latitude, longitude);
        setQiblaDirection(calculatedDirection);

        // 3. Konum ve yön hesaplandıktan sonra pusulayı (heading) izlemeye başla
        compassSubscription = await Location.watchHeadingAsync((headingData) => {
          headingValue.value = headingData.magHeading; 
        });

      } catch (e) {
         console.error(e);
         setErrorMsg("Konum alınamadı veya pusula başlatılamadı.");
      }
    })();

    // Ekrandan çıkıldığında izlemeyi durdur
    return () => {
      if (compassSubscription) {
        compassSubscription.remove();
      }
    };
  }, []); 

  // Okun dönüş animasyonu stili
  const compassNeedleStyle = useAnimatedStyle(() => {
    if (qiblaDirection === null) {
      return { transform: [{ rotate: '0deg' }] };
    }
    
    const rotation = qiblaDirection - headingValue.value;
    
    return {
      transform: [
        { rotate: withTiming(`${rotation}deg`, { duration: 300 }) },
      ],
    };
  });

  if (errorMsg) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.errorText}>{errorMsg}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Kıble Pusulası</ThemedText>

      {qiblaDirection === null ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <ThemedText style={styles.subText}>GPS konumu alınıyor...</ThemedText>
        </View>
      ) : (
        <>
          <ThemedText style={styles.subText}>Kırmızı Ok Kıble Yönünü Gösterir</ThemedText>
          <ThemedText style={styles.degreeText}>
            (Kuzeyden {Math.round(qiblaDirection)}° derece)
          </ThemedText>
          
          <View style={styles.compassContainer}>
            <Image 
              source={require('@/assets/images/splash-icon.png')} // Arka plan
              style={styles.compassBackground}
            />
            
            <Animated.View style={[styles.compassNeedle, compassNeedleStyle]}>
               <View style={styles.arrow} />
            </Animated.View>
          </View>
        </>
      )}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subText: {
    marginTop: 10,
    fontSize: 16,
    color: 'gray',
  },
  degreeText: { 
    marginTop: 5,
    fontSize: 14,
    color: 'gray',
  },
  compassContainer: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  compassBackground: {
    width: 300,
    height: 300,
    opacity: 0.3,
    resizeMode: 'contain',
  },
  compassNeedle: {
    position: 'absolute',
    width: 300,
    height: 300,
    alignItems: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderBottomWidth: 140, 
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'red', 
    transform: [{ translateY: -20 }], 
  },
});