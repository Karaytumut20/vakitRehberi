import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BG_COLOR = '#090906';
const CARD_BG = '#14120f';
const GOLD = '#e1c564';
const TEXT_LIGHT = '#e5e5e5';
const TEXT_ARABIC = '#ffffff';

interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
}

interface ArabicAyah {
  number: number;
  text: string;
  numberInSurah: number;
}

export default function QuranDetailScreen() {
  const { id, name } = useLocalSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [arabicAyahs, setArabicAyahs] = useState<ArabicAyah[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSurah() {
      try {
        const [trResponse, arResponse] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/surah/${id}/tr.diyanet`),
          fetch(`https://api.alquran.cloud/v1/surah/${id}/quran-simple`)
        ]);

        const trData = await trResponse.json();
        const arData = await arResponse.json();

        if (trData.code === 200 && arData.code === 200) {
          setAyahs(trData.data.ayahs);
          setArabicAyahs(arData.data.ayahs);
        } else {
          setError('Sure yüklenirken hata oluştu.');
        }
      } catch (e) {
        setError('Bağlantı hatası. Lütfen internetinizi kontrol edin.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchSurah();
    }
  }, [id]);

  // DÜZELTME: SafeAreaView yerine View
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={28} color={GOLD} />
        </TouchableOpacity>
        <Text style={styles.title}>{name} Suresi</Text>
        <View style={{ width: 28 }} /> 
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.loadingText}>Sure yükleniyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {Number(id) !== 9 && (
            <View style={styles.bismillahContainer}>
              <Text style={styles.bismillahText}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
            </View>
          )}

          {ayahs.map((ayah, index) => {
            const arabicText = arabicAyahs[index]?.text || '';
            return (
              <View key={ayah.number} style={styles.ayahCard}>
                <Text style={styles.ayahArabic}>{arabicText}</Text>
                <View style={styles.divider}>
                  <View style={styles.line} />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{ayah.numberInSurah}</Text>
                  </View>
                  <View style={styles.line} />
                </View>
                <Text style={styles.ayahTurkish}>{ayah.text}</Text>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_COLOR },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1c56433',
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: GOLD },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: GOLD, marginTop: 10 },
  errorText: { color: '#ff6b6b', fontSize: 16, marginBottom: 20 },
  retryBtn: { padding: 10, backgroundColor: '#333', borderRadius: 8 },
  retryText: { color: '#fff' },
  scrollContent: { padding: 16, gap: 16 },
  bismillahContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  bismillahText: {
    fontSize: 28,
    color: GOLD,
    fontFamily: 'System', 
  },
  ayahCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1c56411',
  },
  ayahArabic: {
    fontSize: 26,
    color: TEXT_ARABIC,
    textAlign: 'right',
    lineHeight: 40,
    marginBottom: 12,
    fontFamily: 'System',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#e1c56422',
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e1c56422',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GOLD,
  },
  badgeText: {
    color: GOLD,
    fontSize: 12,
    fontWeight: 'bold',
  },
  ayahTurkish: {
    fontSize: 16,
    color: TEXT_LIGHT,
    lineHeight: 24,
  },
});