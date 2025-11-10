import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Kâbe'nin (Mekke) yaklaşık yönü (Kuzey'den derece cinsinden)
// Türkiye'nin batısı için yaklaşık 150-160 derece.
// TODO: Bu değeri GPS konumuna göre dinamik hesapla (Adım 1'den sonra)
const QIBLA_DIRECTION = 156; 

export default function QiblaScreen() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const headingValue = useSharedValue(0); // Cihazın baktığı yön (Kuzey=0)

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Pusulayı kullanmak için konum izni gerekli.');
        return;
      }

      // Cihazın yönünü izlemeye başla
      subscription = await Location.watchHeadingAsync((headingData) => {
        // headingValue.value = headingData.trueHeading; // Gerçek kuzey
         headingValue.value = headingData.magHeading; // Manyetik kuzey (daha stabil)
      });
    })();

    // Ekrandan çıkıldığında izlemeyi durdur
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // Okun dönüş animasyonu stili
  const compassNeedleStyle = useAnimatedStyle(() => {
    // Cihazın kuzeye göre yönü (headingValue) ile Kıble yönü arasındaki farkı hesapla
    // Bu, okun her zaman Kıble'yi göstermesini sağlar.
    const rotation = QIBLA_DIRECTION - headingValue.value;
    
    return {
      transform: [
        { rotate: withTiming(`${rotation}deg`, { duration: 300 }) },
      ],
    };
  });

  if (errorMsg) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">{errorMsg}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Kıble Pusulası</ThemedText>
      <ThemedText style={styles.subText}>Kırmızı Ok Kıble Yönünü Gösterir</ThemedText>
      
      <View style={styles.compassContainer}>
        {/* Pusula Gülü (Arka Plan) */}
        <Image 
          source={require('@/assets/images/splash-icon.png')} // Basit bir pusula arkaplanı (veya kendi görselinizi ekleyin)
          style={styles.compassBackground}
        />
        
        {/* Kıble Oku (Dönen) */}
        <Animated.View style={[styles.compassNeedle, compassNeedleStyle]}>
           {/* Basit bir "ok" çizimi */}
           <View style={styles.arrow} />
        </Animated.View>
      </View>

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
  subText: {
    marginTop: 10,
    fontSize: 16,
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
    borderBottomWidth: 140, // Okun uzunluğu
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'red', // Okun rengi
    transform: [{ translateY: -20 }], // Okun merkezlenmesi
  },
});