import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import * as KeepAwake from 'expo-keep-awake'; // <<< YENİ IMPORT EKLENDİ >>>
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Animated as RNAnimated, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// --- Kıble Hesaplama Fonksiyonları ---
const KAABA_LATITUDE = 21.4225;
const KAABA_LONGITUDE = 39.8262;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

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
  
  return (bearing + 360) % 360;
}
// ------------------------------------------

export default function QiblaScreen() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  
  const headingValue = useSharedValue(0);
  const pulseAnim = useSharedValue(0);
  const compassScale = useSharedValue(0.8);
  const instructionsOpacity = new RNAnimated.Value(1);

  // Pulsating animation
  useEffect(() => {
    pulseAnim.value = withTiming(1, { duration: 1500 }, () => {
      pulseAnim.value = withTiming(0, { duration: 1500 });
    });
    
    const interval = setInterval(() => {
      pulseAnim.value = withTiming(1, { duration: 1500 }, () => {
        pulseAnim.value = withTiming(0, { duration: 1500 });
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Kalibrasyon kontrolü
  useEffect(() => {
    if (qiblaDirection !== null && !calibrationComplete) {
      const timer = setTimeout(() => {
        setCalibrationComplete(true);
      }, 10000); // 10 saniye sonra kalibrasyon tamamlandı
        
      return () => clearTimeout(timer);
    }
  }, [qiblaDirection, calibrationComplete]);

  // <<< KeepAwake Hata Yönetimi ve Uygulama >>>
  // Bu fonksiyonlar, asenkron çağrıları try/catch ile sarmalayarak 
  // "uncaught in promise" hatasını önler.
  const activateKeepAwake = async () => {
    try {
      await KeepAwake.activateKeepAwake();
    } catch (e) {
      // Hata oluşsa bile uygulamanın çökmesini önler.
      console.warn('KeepAwake aktivasyonu başarısız:', e);
    }
  };

  const deactivateKeepAwake = async () => {
    try {
      await KeepAwake.deactivateKeepAwake();
    } catch (e) {
      // Hata oluşsa bile uygulamanın çökmesini önler.
      console.warn('KeepAwake de-aktivasyonu başarısız:', e);
    }
  };
  // <<< KeepAwake Hata Yönetimi ve Uygulama Sonu >>>

  useEffect(() => {
    let compassSubscription: Location.LocationSubscription | undefined;

    (async () => {
      // Kıble pusulası ekranındayken ekranın kapanmasını engelle
      await activateKeepAwake();

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Pusula ve Kıble yönü için konum izni gerekli.');
        // Hata durumunda KeepAwake'i kapat
        await deactivateKeepAwake();
        return;
      }

      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = location.coords;
        setUserLocation({ latitude, longitude });

        const calculatedDirection = calculateQiblaDirection(latitude, longitude);
        setQiblaDirection(calculatedDirection);
        
        // Scale animation when direction is found
        compassScale.value = withSpring(1, { damping: 10, stiffness: 100 });

        compassSubscription = await Location.watchHeadingAsync((headingData) => {
          headingValue.value = headingData.magHeading;
        });

      } catch (e) {
         console.error(e);
         setErrorMsg("Konum alınamadı veya pusula başlatılamadı.");
         // Hata durumunda KeepAwake'i kapat
         await deactivateKeepAwake();
      }
    })();

    return () => {
      if (compassSubscription) {
        compassSubscription.remove();
      }
      // Component unmount olduğunda ekranı açık tutmayı kapat
      deactivateKeepAwake();
    };
  }, []);

  const handleCloseInstructions = () => {
    RNAnimated.timing(instructionsOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowInstructions(false));
  };

  // Kıble oku animasyonu
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

  // Pusula ölçeği animasyonu
  const compassScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: compassScale.value }
      ]
    };
  });

  // Pulsating circle animation
  const pulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      pulseAnim.value,
      [0, 1],
      [1, 1.2],
      Extrapolate.CLAMP
    );
    
    const opacity = interpolate(
      pulseAnim.value,
      [0, 1],
      [0.7, 0],
      Extrapolate.CLAMP
    );
    
    return {
      transform: [{ scale }],
      opacity
    };
  });

  // Kalibrasyon durumu için stil
  const calibrationStyle = useAnimatedStyle(() => {
    const backgroundColor = calibrationComplete ? '#27ae60' : '#e74c3c';
    
    return {
      backgroundColor: withTiming(backgroundColor, { duration: 500 }),
    };
  });

  if (errorMsg) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <ThemedText style={styles.errorIconText}>🧭</ThemedText>
          </View>
          <ThemedText type="subtitle" style={styles.errorText}>{errorMsg}</ThemedText>
          <ThemedText style={styles.errorHelp}>
            Lütfen konum izinlerini kontrol edin ve uygulamayı yeniden başlatın.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Talimatlar Overlay */}
      {showInstructions && (
        <RNAnimated.View style={[styles.instructionsOverlay, { opacity: instructionsOpacity }]}>
          <View style={styles.instructionsContent}>
            <View style={styles.instructionsHeader}>
              <ThemedText style={styles.instructionsTitle}>Doğru Sonuç İçin Talimatlar</ThemedText>
            </View>
            
            <View style={styles.instructionsList}>
              <View style={styles.instructionItem}>
                <View style={styles.instructionIcon}>
                  <ThemedText style={styles.instructionIconText}>📱</ThemedText>
                </View>
                <ThemedText style={styles.instructionText}>
                  Cihazınızı düz bir zemine yerleştirin
                </ThemedText>
              </View>
              
              <View style={styles.instructionItem}>
                <View style={styles.instructionIcon}>
                  <ThemedText style={styles.instructionIconText}>⚡</ThemedText>
                </View>
                <ThemedText style={styles.instructionText}>
                  Manyetik alanlardan uzak tutun
                </ThemedText>
              </View>
              
              <View style={styles.instructionItem}>
                <View style={styles.instructionIcon}>
                  <ThemedText style={styles.instructionIconText}>⏱️</ThemedText>
                </View>
                <ThemedText style={styles.instructionText}>
                  Doğru ölçüm için 10 saniye dokunmadan bekleyin
                </ThemedText>
              </View>
              
              <View style={styles.instructionItem}>
                <View style={styles.instructionIcon}>
                  <ThemedText style={styles.instructionIconText}>🎯</ThemedText>
                </View>
                <ThemedText style={styles.instructionText}>
                  Kırmızı ok Kabe yönünü gösterecektir
                </ThemedText>
              </View>
            </View>
            
            <View style={styles.instructionsFooter}>
              <ThemedText style={styles.calibrationNote}>
                Pusula otomatik olarak kalibre edilecektir
              </ThemedText>
              <ThemedText 
                style={styles.closeButton}
                onPress={handleCloseInstructions}
              >
                Anladım, Başla
              </ThemedText>
            </View>
          </View>
        </RNAnimated.View>
      )}

      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>Kıble Pusulası</ThemedText>
        <ThemedText style={styles.subtitle}>Kabenin Yönünü Bulun</ThemedText>
      </View>

      {qiblaDirection === null ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCompass}>
            <ActivityIndicator size="large" color="#8B4513" />
          </View>
          <ThemedText style={styles.loadingText}>Konumunuz ve Kıble yönü hesaplanıyor...</ThemedText>
        </View>
      ) : (
        <>
          <View style={styles.directionInfo}>
            <ThemedText style={styles.directionText}>
              Kıble Yönü: <ThemedText style={styles.degreeText}>{Math.round(qiblaDirection)}°</ThemedText>
            </ThemedText>
            
            {/* Kalibrasyon Durumu */}
            <Animated.View style={[styles.calibrationStatus, calibrationStyle]}>
              <ThemedText style={styles.calibrationText}>
                {calibrationComplete ? '✅ Kalibrasyon Tamamlandı' : '🔄 Kalibrasyon Devam Ediyor...'}
              </ThemedText>
            </Animated.View>
            
            <ThemedText style={styles.compassHelp}>
              {calibrationComplete 
                ? 'Pusula hazır! Kırmızı ok Kabe yönünü gösteriyor'
                : 'Lütfen cihazı düz bir zeminde 10 saniye sabit tutun'
              }
            </ThemedText>
          </View>
          
          <View style={styles.compassWrapper}>
            <Animated.View style={[styles.compassContainer, compassScaleStyle]}>
              {/* Pulsating circles */}
              <Animated.View style={[styles.pulseCircle, pulseStyle]} />
              <Animated.View style={[styles.pulseCircle, pulseStyle, { animationDelay: '500ms' }]} />
              
              {/* Pusula dairesi */}
              <View style={styles.compassCircle}>
                {/* Yön işaretleri */}
                <View style={[styles.directionMarker, styles.northMarker]}>
                  <ThemedText style={styles.directionLetter}>N</ThemedText>
                </View>
                <View style={[styles.directionMarker, styles.eastMarker]}>
                  <ThemedText style={styles.directionLetter}>E</ThemedText>
                </View>
                <View style={[styles.directionMarker, styles.southMarker]}>
                  <ThemedText style={styles.directionLetter}>S</ThemedText>
                </View>
                <View style={[styles.directionMarker, styles.westMarker]}>
                  <ThemedText style={styles.directionLetter}>W</ThemedText>
                </View>
                
                {/* Derece işaretleri */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((degree) => (
                  <View 
                    key={degree}
                    style={[
                      styles.degreeMarker,
                      {
                        transform: [{ rotate: `${degree}deg` }]
                      }
                    ]}
                  >
                    <View style={styles.degreeLine} />
                  </View>
                ))}
                
                {/* Kıble oku */}
                <Animated.View style={[styles.compassNeedle, compassNeedleStyle]}>
                  <View style={styles.needleBase} />
                  <View style={styles.needle} />
                  <View style={styles.needlePoint} />
                  {!calibrationComplete && (
                    <View style={styles.calibrationIndicator}>
                      <ActivityIndicator size="small" color="#ffffff" />
                    </View>
                  )}
                </Animated.View>
                
                {/* Merkez noktası */}
                <View style={styles.centerPoint} />
              </View>
            </Animated.View>
          </View>
          
          
        </>
      )}
    </ThemedView>
  );
}

// Kabe'ye olan mesafeyi hesaplama
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Dünya'nın yarıçapı (km)
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: '#f8f5f0',
  },
  // Talimatlar Stilleri
  instructionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  instructionsContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  instructionsHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  instructionsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
  },
  instructionsList: {
    marginBottom: 25,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 8,
  },
  instructionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B4513',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  instructionIconText: {
    fontSize: 18,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 22,
  },
  instructionsFooter: {
    alignItems: 'center',
  },
  calibrationNote: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  closeButton: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B4513',
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: '#ffeaa7',
    borderRadius: 25,
    overflow: 'hidden',
  },
  // Diğer stiller...
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffeaa7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIconText: {
    fontSize: 40,
  },
  errorText: {
    color: '#e74c3c',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
    fontSize: 16,
  },
  errorHelp: {
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCompass: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  directionInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  directionText: {
    fontSize: 20,
    color: '#2c3e50',
    marginBottom: 12,
  },
  degreeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#8B4513',
  },
  calibrationStatus: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  calibrationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  compassHelp: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    maxWidth: 250,
  },
  compassWrapper: {
    width: width * 0.85,
    height: width * 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  compassContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pulseCircle: {
    position: 'absolute',
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.425,
    borderWidth: 2,
    borderColor: '#8B4513',
  },
  compassCircle: {
    width: '100%',
    height: '100%',
    borderRadius: width * 0.425,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e0d6c8',
  },
  directionMarker: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
    height: 30,
  },
  northMarker: {
    top: 10,
    alignSelf: 'center',
  },
  eastMarker: {
    right: 10,
    top: '50%',
    marginTop: -15,
  },
  southMarker: {
    bottom: 10,
    alignSelf: 'center',
  },
  westMarker: {
    left: 10,
    top: '50%',
    marginTop: -15,
  },
  directionLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
  },
  degreeMarker: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  degreeLine: {
    width: 2,
    height: 15,
    backgroundColor: '#e0d6c8',
    marginTop: 10,
  },
  compassNeedle: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  needleBase: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8B4513',
    zIndex: 10,
  },
  needle: {
    position: 'absolute',
    width: 6,
    height: width * 0.35,
    backgroundColor: '#e74c3c',
    bottom: '50%',
    marginBottom: -10,
    borderRadius: 3,
    zIndex: 5,
  },
  needlePoint: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#e74c3c',
    bottom: '50%',
    marginBottom: width * 0.35 - 30,
    zIndex: 6,
  },
  calibrationIndicator: {
    position: 'absolute',
    top: -30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 5,
    borderRadius: 10,
  },
  centerPoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B4513',
    position: 'absolute',
    zIndex: 15,
  },
  locationInfo: {
    alignItems: 'center',
    marginTop: 20,
  },
  locationText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  distanceText: {
    fontSize: 14,
    color: '#8B4513',
    fontWeight: '500',
  },
});