// app/(tabs)/qibla.tsx

import * as KeepAwake from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const { width } = Dimensions.get('window');

// --- COLOR PALETTE (dark + gold) ---
const BG = '#090906';
const GOLD = '#e1c564';
const GOLD_LIGHT = '#e1af64';
const GOLD_SOFT = '#e1c56433';
const TICK_SOFT = '#e1c56422';
const CARD_BG = '#14120f';
const ACCENT_RED = '#ff3b30';

// Kaaba coords
const KAABA_LATITUDE = 21.4225;
const KAABA_LONGITUDE = 39.8262;

function toRadians(v: number): number {
  return v * (Math.PI / 180);
}
function toDegrees(v: number): number {
  return v * (180 / Math.PI);
}

// True north’a göre kıble açısı
function calculateQiblaDirection(lat1: number, lon1: number): number {
  const lat2 = KAABA_LATITUDE;
  const lon2 = KAABA_LONGITUDE;

  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const lat2Rad = toRadians(lat2);
  const lon2Rad = toRadians(lon2);

  const dLon = lon2Rad - lon1Rad;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = Math.atan2(y, x);
  bearing = toDegrees(bearing);

  return (bearing + 360) % 360;
}

// Web API ile kıble açısı
async function fetchQiblaFromWeb(
  lat: number,
  lon: number
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.aladhan.com/v1/qibla/${lat}/${lon}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    const dir = json?.data?.direction;
    if (typeof dir === 'number') return dir;
  } catch (e) {
    console.warn('Qibla web fetch error:', e);
  }
  return null;
}

// -180..180
function normalizeDiff(angle: number): number {
  let a = ((angle % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

const DISC_SIZE = width * 0.8;

export default function QiblaScreen() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qiblaDirection, setQiblaDirection] = useState<number | null>(null);
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);

  const headingValue = useSharedValue(0); // smoothed heading
  const discRotation = useSharedValue(0); // disc rotation
  const qiblaAbsoluteAngle = useSharedValue(0); // kıble N’e göre açı

  const qiblaReadyRef = useRef(false);

  // Ekranı açık tut
  const activateKeepAwake = async () => {
    try {
      await KeepAwake.activateKeepAwake();
    } catch (e) {
      console.warn('KeepAwake activate error:', e);
    }
  };
  const deactivateKeepAwake = async () => {
    try {
      await KeepAwake.deactivateKeepAwake();
    } catch (e) {
      console.warn('KeepAwake deactivate error:', e);
    }
  };

  // Konum + heading
  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;

    (async () => {
      await activateKeepAwake();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Kıble pusulası için konum izni gereklidir.');
        await deactivateKeepAwake();
        return;
      }

      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const { latitude, longitude } = pos.coords;

        // 1) Lokalde hesapla
        const localAngle = calculateQiblaDirection(latitude, longitude);
        // 2) Web’den alabilirsek override et
        const webAngle = await fetchQiblaFromWeb(latitude, longitude);
        const finalAngle =
          typeof webAngle === 'number' ? webAngle : localAngle;

        setQiblaDirection(finalAngle);
        qiblaAbsoluteAngle.value = finalAngle;
        qiblaReadyRef.current = true;

        // heading’i dinle – low-pass filter ile yumuşat
        subscription = await Location.watchHeadingAsync((headingData) => {
          const baseHeading =
            headingData.trueHeading != null &&
            headingData.trueHeading >= 0
              ? headingData.trueHeading
              : headingData.magHeading ?? 0;

          const raw = ((baseHeading % 360) + 360) % 360;

          const prev = headingValue.value;
          const delta = normalizeDiff(raw - prev);
          const alpha = 0.22;
          const blended = prev + delta * alpha;

          headingValue.value = blended;

          discRotation.value = withSpring(-blended, {
            damping: 20,
            stiffness: 90,
            mass: 0.8,
          });

          const normalized = ((blended % 360) + 360) % 360;
          setHeadingDeg(Math.round(normalized));
        });
      } catch (e) {
        console.warn('Qibla location error:', e);
        setErrorMsg('Konum alınamadı veya pusula başlatılamadı.');
        await deactivateKeepAwake();
      }
    })();

    return () => {
      if (subscription) subscription.remove();
      deactivateKeepAwake();
    };
  }, [discRotation, headingValue, qiblaAbsoluteAngle]);

  // Disk animasyon stili
  const discStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${discRotation.value}deg` }],
  }));

  // Kıble marker – N’e göre sabit
  const qiblaMarkerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${qiblaAbsoluteAngle.value}deg` }],
  }));

  if (errorMsg) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <ThemedText style={styles.errorIconEmoji}>🧭</ThemedText>
          </View>
          <ThemedText style={styles.errorTitle}>Bir sorun oluştu</ThemedText>
          <ThemedText style={styles.errorMessage}>{errorMsg}</ThemedText>
          <ThemedText style={styles.errorHint}>
            Lütfen konum izinlerini açıp uygulamayı yeniden başlatın.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const currentHeadingText =
    headingDeg != null ? `${headingDeg}°` : '--°';
  const qiblaAngleText =
    qiblaDirection != null ? `${Math.round(qiblaDirection)}°` : '--°';

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.title}>Kıble Pusulası</ThemedText>
        <ThemedText style={styles.subtitle}>
          Cihazını düz tut, kırmızı çizgiyi Kâbe ikonuna hizala
        </ThemedText>
      </View>

      {qiblaDirection == null ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingRing}>
            <ActivityIndicator size="large" color={GOLD} />
          </View>
          <ThemedText style={styles.loadingText}>
            Kıble yönü hesaplanıyor...
          </ThemedText>
        </View>
      ) : (
        <>
          {/* Compass */}
          <View style={styles.compassWrapper}>
            {/* Üst sabit kırmızı referans çizgisi */}
            <View style={styles.topRedLine} />

            {/* Dönen disk */}
            <Animated.View style={[styles.compassCircle, discStyle]}>
              {/* Tick marks */}
              {Array.from({ length: 120 }).map((_, i) => {
                const deg = i * 3;
                const isMajor = deg % 30 === 0;
                return (
                  <View
                    key={`tick-${deg}`}
                    style={[
                      styles.tickContainer,
                      { transform: [{ rotate: `${deg}deg` }] },
                    ]}
                  >
                    <View
                      style={[
                        styles.tick,
                        isMajor && styles.tickMajor,
                      ]}
                    />
                  </View>
                );
              })}

              {/* 30° label'lar */}
              {[
                0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
              ].map((deg) => (
                <View
                  key={`deg-${deg}`}
                  style={[
                    styles.degreeLabelContainer,
                    { transform: [{ rotate: `${deg}deg` }] },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.degreeLabelText,
                      { transform: [{ rotate: `${-deg}deg` }] },
                    ]}
                  >
                    {deg === 0 ? '0' : deg}
                  </ThemedText>
                </View>
              ))}

              {/* Ana yönler */}
              <View style={[styles.cardinal, styles.cardinalN]}>
                <ThemedText style={styles.cardinalText}>N</ThemedText>
              </View>
              <View style={[styles.cardinal, styles.cardinalE]}>
                <ThemedText style={styles.cardinalText}>E</ThemedText>
              </View>
              <View style={[styles.cardinal, styles.cardinalS]}>
                <ThemedText style={styles.cardinalText}>S</ThemedText>
              </View>
              <View style={[styles.cardinal, styles.cardinalW]}>
                <ThemedText style={styles.cardinalText}>W</ThemedText>
              </View>

              {/* Kıble marker */}
              <Animated.View
                style={[styles.qiblaMarkerContainer, qiblaMarkerStyle]}
              >
                <View style={styles.qiblaMarker}>
                  <View style={styles.qiblaBubble}>
                    <ThemedText style={styles.qiblaBubbleText}>
                      🕋
                    </ThemedText>
                  </View>
                  <View style={styles.qiblaTriangle} />
                </View>
              </Animated.View>

              {/* Merkez nokta */}
              <View style={styles.centerDot} />
            </Animated.View>
          </View>

          {/* Alt bilgiler – SADECE DERECELER */}
          <View style={styles.bottomInfo}>
            <View style={styles.degreesRow}>
              <ThemedText style={styles.bottomDegree}>
                {currentHeadingText}
              </ThemedText>
              <ThemedText style={styles.bottomDegreeSeparator}>/</ThemedText>
              <ThemedText style={styles.bottomDegree}>
                {qiblaAngleText}
              </ThemedText>
            </View>

            <View style={styles.degreesLabelsRow}>
              <ThemedText style={styles.degreesLabel}>Şu an</ThemedText>
              <ThemedText style={styles.degreesLabel}>Kıble</ThemedText>
            </View>
          </View>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: 60,
    paddingHorizontal: 16,
  },

  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 0.6,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: GOLD_LIGHT,
    opacity: 0.9,
    textAlign: 'center',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: GOLD_SOFT,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: GOLD,
    shadowRadius: 16,
    shadowOpacity: 0.7,
    elevation: 10,
  },
  loadingText: {
    marginTop: 18,
    fontSize: 14,
    color: GOLD_LIGHT,
  },

  // Compass
  compassWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  topRedLine: {
    width: 4,
    height: 34,
    borderRadius: 999,
    backgroundColor: ACCENT_RED,
    marginBottom: 8,
  },
  compassCircle: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GOLD_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tickContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
  },
  tick: {
    marginTop: 10,
    width: 1,
    height: 8,
    backgroundColor: TICK_SOFT,
  },
  tickMajor: {
    height: 14,
    backgroundColor: GOLD_SOFT,
  },

  degreeLabelContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
  },
  degreeLabelText: {
    marginTop: 28,
    fontSize: 11,
    color: GOLD_LIGHT,
    opacity: 0.9,
  },

  // Cardinal labels
  cardinal: {
    position: 'absolute',
  },
  cardinalText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardinalN: {
    top: 18,
    alignSelf: 'center',
  },
  cardinalS: {
    bottom: 18,
    alignSelf: 'center',
  },
  cardinalE: {
    right: 18,
    top: '50%',
    marginTop: -10,
  },
  cardinalW: {
    left: 18,
    top: '50%',
    marginTop: -10,
  },

  // Qibla marker
  qiblaMarkerContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 18,
  },
  qiblaMarker: {
    alignItems: 'center',
  },
  qiblaBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1f1910',
    borderWidth: 1,
    borderColor: GOLD_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qiblaBubbleText: {
    fontSize: 20,
  },
  qiblaTriangle: {
    marginTop: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: ACCENT_RED,
  },

  centerDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GOLD,
  },

  // Bottom info: only degrees
  bottomInfo: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40, // 🔥 Tabbar + AdMob'tan kurtulmak için
  },
  degreesRow: {
    flexDirection: 'row',
    alignItems: 'center', // 🔥 Ortala, kesilmesin
    gap: 8,
  },
  bottomDegree: {
    fontSize: 40,
    lineHeight: 48, // 🔥 Üst-alt tam gözüksün
    fontWeight: '700',
    color: '#ffffff',
  },
  bottomDegreeSeparator: {
    fontSize: 30,
    lineHeight: 40,
    fontWeight: '600',
    color: GOLD_LIGHT,
    marginBottom: 2,
  },
  degreesLabelsRow: {
    marginTop: 6,
    width: 180,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  degreesLabel: {
    fontSize: 12,
    color: GOLD_LIGHT,
    opacity: 0.9,
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GOLD_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIconEmoji: {
    fontSize: 38,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: GOLD,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: GOLD_LIGHT,
    textAlign: 'center',
    marginBottom: 6,
  },
  errorHint: {
    fontSize: 12,
    color: GOLD_LIGHT,
    opacity: 0.8,
    textAlign: 'center',
  },
});
